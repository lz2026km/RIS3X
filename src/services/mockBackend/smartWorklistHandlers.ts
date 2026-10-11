/**
 * [v3.0.6.11-60] Smart MWL 深度化
 * /api/v1/worklist-smart/* (评分/权重/优先级统计/MWL 列表)
 * /api/v1/smart-route/*   (路由规则/医生资质/分配)
 * 算法与 backend/src/modules/{worklist-smart,smart-route} 保持一致
 * [G005 Demo-Expand] GET /worklist-smart/mwl (+ /mwl/stats): 60 条 MWL 排程项,
 *   锚点检查来自 store.exams (selectAnchorExams().worklist, 含 AI 分诊 30 条 → 三端串联),
 *   accessionNumber 直接复用检查主数据, 分配到 DEVICE_MASTER 设备 (含 AE Title / 机房),
 *   排程槽位落在未来 24h, MPPS 状态 SCHEDULED/IN_PROGRESS/COMPLETED。
 */
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';
import { DEVICES_BY_MODALITY, type DeviceMaster } from '../../data/master';
import { hashSeed, mulberry32 } from '../../utils/seededRandom';
import { selectAnchorExams, queuePriorityOf } from './aiTriageHandlers';

// 与 emergencyChannelHandlers/criticalExtHandlers 一致: 浏览器用页面 origin, node 测试兜底 localhost
const API_BASE = (() => {
  try { return window.location.origin + '/api/v1'; } catch { return 'http://localhost/api/v1'; }
})();

interface ScoreInput {
  id: string;
  urgency: number;
  waitingMinutes: number;
  age?: number;
  modality?: string;
  bodyPart?: string;
  patientType?: string;
  priority?: string;
  criticalFinding?: boolean;
}

interface WeightConfig {
  urgencyWeight: number;
  waitWeight: number;
  ageWeight: number;
  examTypeWeight: number;
}

const DEFAULT_WEIGHTS: WeightConfig = { urgencyWeight: 0.35, waitWeight: 0.3, ageWeight: 0.15, examTypeWeight: 0.2 };
const PATIENT_TYPE_WEIGHT = 0.15;
const AI_TRIAGE_WEIGHT = 0.1;

const HIGH_PRIORITY_BODY_PARTS = new Set(['头颅', '头部', '脑血管', '主动脉', '冠状动脉', '肺动脉']);
const HIGH_PRIORITY_EXAM_KEYWORDS = ['ct头', 'cta', 'ctp', '头颈cta', '冠状动脉cta', '主动脉cta'];
const CRITICAL_PRIORITY_KEYWORDS = ['危急', '危重', '紧急', '急诊', '加急', 'urgent', 'critical', 'high', 'stat', 'emergent'];
const MID_PRIORITY_KEYWORDS = ['中', '中等', 'medium', 'normal'];

let weights: WeightConfig = { ...DEFAULT_WEIGHTS };
const scoreHistory: { examId: string; score: number; scoredAt: string }[] = [];

function normalizeUrgency(u: number): number {
  return Math.max(0, Math.min(1, (u + 3) / 6));
}
function calcWaitScore(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.min(1, Math.log2(1 + minutes) / 12);
}
function calcAgeScore(age?: number): number {
  if (age === undefined || age === null) return 0;
  if (age >= 65) return 0.8;
  if (age <= 12) return 0.6;
  return 0;
}
function calcExamTypeScore(modality?: string, bodyPart?: string, examItem?: string): number {
  const text = [modality, bodyPart, examItem].filter(Boolean).join('').toLowerCase();
  if (HIGH_PRIORITY_BODY_PARTS.has(bodyPart ?? '')) return 1.0;
  if (HIGH_PRIORITY_EXAM_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()))) return 1.0;
  return 0;
}
function calcPatientTypeScore(patientType?: string): number {
  const t = (patientType ?? '').toLowerCase();
  if (t.includes('急诊') || t.includes('住院') || t.includes('危重') || t.includes('emergency') || t.includes('inpatient') || t.includes('critical')) return 1.0;
  if (t.includes('体检') || t.includes('门诊') || t.includes('outpatient') || t.includes('physical')) return 0.2;
  return 0;
}
function calcAiTriageScore(priority?: string, criticalFinding?: boolean): number {
  if (criticalFinding) return 1.0;
  const p = (priority ?? '').toLowerCase();
  if (CRITICAL_PRIORITY_KEYWORDS.some((kw) => p.includes(kw))) return 1.0;
  if (MID_PRIORITY_KEYWORDS.some((kw) => p.includes(kw))) return 0.5;
  return 0;
}

function computeScore(input: ScoreInput) {
  const urgencyScore = normalizeUrgency(input.urgency);
  const waitScore = calcWaitScore(input.waitingMinutes);
  const ageScore = calcAgeScore(input.age);
  const examTypeScore = calcExamTypeScore(input.modality, input.bodyPart);
  const patientTypeScore = calcPatientTypeScore(input.patientType);
  const aiTriageScore = calcAiTriageScore(input.priority, input.criticalFinding);

  const total =
    urgencyScore * weights.urgencyWeight +
    waitScore * weights.waitWeight +
    ageScore * weights.ageWeight +
    examTypeScore * weights.examTypeWeight +
    patientTypeScore * PATIENT_TYPE_WEIGHT +
    aiTriageScore * AI_TRIAGE_WEIGHT;
  const raw = Math.round(total * 1000) / 10;

  const factors = [
    { key: 'urgency', label: '紧急度', score: urgencyScore, weight: weights.urgencyWeight, contribution: urgencyScore * weights.urgencyWeight },
    { key: 'wait', label: '等待时长', score: waitScore, weight: weights.waitWeight, contribution: waitScore * weights.waitWeight },
    { key: 'age', label: '年龄', score: ageScore, weight: weights.ageWeight, contribution: ageScore * weights.ageWeight },
    { key: 'examType', label: '检查类型', score: examTypeScore, weight: weights.examTypeWeight, contribution: examTypeScore * weights.examTypeWeight },
    { key: 'patientType', label: '患者状态', score: patientTypeScore, weight: PATIENT_TYPE_WEIGHT, contribution: patientTypeScore * PATIENT_TYPE_WEIGHT },
    { key: 'aiTriage', label: 'AI 分检', score: aiTriageScore, weight: AI_TRIAGE_WEIGHT, contribution: aiTriageScore * AI_TRIAGE_WEIGHT },
  ];

  const reasons: string[] = [];
  if (input.urgency > 0) reasons.push(`紧急度+${input.urgency}`);
  if (input.urgency < 0) reasons.push(`紧急度${input.urgency}`);
  if (input.waitingMinutes > 30) reasons.push(`等待${input.waitingMinutes}min`);
  if ((input.age ?? 0) >= 65) reasons.push('高龄患者');
  if ((input.age ?? 0) <= 12) reasons.push('儿童患者');
  if (examTypeScore > 0) reasons.push(`${input.bodyPart || input.modality || ''}优先`.trim() || '检查类型优先');
  if (patientTypeScore >= 1) reasons.push(`患者状态${input.patientType}`);
  if (aiTriageScore > 0) reasons.push('AI 分检高风险');
  if (reasons.length === 0) reasons.push('常规排序');

  let level: 'low' | 'normal' | 'urgent' | 'critical' = 'low';
  if (raw >= 70) level = 'critical';
  else if (raw >= 45) level = 'urgent';
  else if (raw >= 20) level = 'normal';

  return { studyId: input.id, score: raw, reasons, level, factors };
}

// ═══ [G005 Demo-Expand] Smart MWL 60 条 (锚点 = store.exams) ═══
type MppsStatus = 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED';
type MwlState = 'SCHEDULED' | 'ARRIVED' | 'IN_PROGRESS' | 'COMPLETED';
type DeviceModalityKey = keyof typeof DEVICES_BY_MODALITY;

const MODALITY_TO_DEVICE: Record<string, DeviceModalityKey> = {
  CT: 'CT',
  MR: 'MR',
  DR: 'DR',
  DX: 'DR',
  X线: 'DR',
  普放: 'DR',
  US: 'US',
  超声: 'US',
  MG: 'MG',
  钼靶: 'MG',
  乳腺钼靶: 'MG',
  DSA: 'DSA',
  XA: 'DSA',
  'PET-CT': 'PET-CT',
  PETCT: 'PET-CT',
  核医学: 'PET-CT',
};

// DICOM AE Title (≤16 字符), 由主数据设备 ID 派生: DEV-CT-001 → G005_CT_001
function aeTitleOf(device: DeviceMaster): string {
  return `G005_${String(device.id).replace(/^DEV-/, '').replace(/-/g, '_')}`;
}

const pad2 = (n: number, len = 2): string => String(n).padStart(len, '0');

interface SmartMwlBase {
  id: string;
  examId: string;
  reportId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  patientSex: string;
  patientAge: number | null;
  patientType: string;
  modality: string;
  bodyPart: string;
  requestedProcedureDescription: string;
  requestedProcedureId: string;
  studyInstanceUid: string;
  scheduledStationAeTitle: string;
  stationName: string;
  deviceId: string;
  deviceModel: string;
  mppsStatus: MppsStatus;
  state: MwlState;
  priority: 'STAT' | 'URGENT' | 'ROUTINE';
  priorityZh: '急诊' | '加急' | '普通';
  slotOffsetMin: number;
  source: string;
}

type SmartMwlItem = SmartMwlBase & { scheduledAt: string; scheduledDate: string; scheduledTime: string };

let mwlBases: SmartMwlBase[] | null = null;

function ensureMwl(): SmartMwlBase[] {
  if (mwlBases) return mwlBases;
  const { worklist } = selectAnchorExams();
  const deviceCursor: Record<string, number> = {};
  mwlBases = worklist.map((row, idx) => {
    const rand = mulberry32(hashSeed(`g005-smart-mwl:${row.examId}`));
    const modKey: DeviceModalityKey = MODALITY_TO_DEVICE[row.modality] ?? 'CT';
    const pool = DEVICES_BY_MODALITY[modKey];
    const cursor = deviceCursor[modKey] ?? 0;
    deviceCursor[modKey] = cursor + 1;
    const device = pool[cursor % pool.length];
    const priorityZh = queuePriorityOf(row.examPriority);
    const priority: SmartMwlBase['priority'] = priorityZh === '急诊' ? 'STAT' : priorityZh === '加急' ? 'URGENT' : 'ROUTINE';
    const roll = rand();
    const mppsStatus: MppsStatus = roll < 0.15 ? 'COMPLETED' : roll < 0.4 ? 'IN_PROGRESS' : 'SCHEDULED';
    const state: MwlState = mppsStatus === 'IN_PROGRESS'
      ? 'IN_PROGRESS'
      : mppsStatus === 'COMPLETED'
        ? 'COMPLETED'
        : rand() < 0.3
          ? 'ARRIVED'
          : 'SCHEDULED';
    const uidSeed = hashSeed(`g005-mwl-uid:${row.examId}`);
    return {
      id: `SW-MWL-${pad2(idx + 1, 4)}`,
      examId: row.examId,
      reportId: row.reportId,
      accessionNumber: row.accessionNumber || `ACC-${uidSeed.toString(36).toUpperCase()}`,
      patientId: row.patientId,
      patientName: row.patientName,
      patientSex: row.gender,
      patientAge: row.age,
      patientType: row.patientType || '门诊',
      modality: row.modality,
      bodyPart: row.bodyPart,
      requestedProcedureDescription: row.examItem,
      requestedProcedureId: `RP-${row.examId}`,
      studyInstanceUid: `1.2.840.114350.1.136.${uidSeed}`,
      scheduledStationAeTitle: device ? aeTitleOf(device) : `G005_${modKey}`,
      stationName: device?.room ?? `${modKey}室`,
      deviceId: device?.id ?? '',
      deviceModel: device ? `${device.brand} ${device.model}` : '',
      mppsStatus,
      state,
      priority,
      priorityZh,
      // 未来 24h 内的排程槽位 (10min ~ 23h50m)
      slotOffsetMin: 10 + Math.floor(rand() * 1420),
      source: 'store.exams',
    };
  });
  return mwlBases;
}

// 每次请求按 now 重新物化排程时间, 保证槽位始终落在「未来 24h」
function materializeMwl(bases: SmartMwlBase[]): SmartMwlItem[] {
  const now = Date.now();
  return bases.map((b) => {
    const at = new Date(now + b.slotOffsetMin * 60_000);
    return {
      ...b,
      scheduledAt: at.toISOString(),
      scheduledDate: `${at.getFullYear()}-${pad2(at.getMonth() + 1)}-${pad2(at.getDate())}`,
      scheduledTime: `${pad2(at.getHours())}:${pad2(at.getMinutes())}:00`,
    };
  });
}

const DEFAULT_RULES = [
  { id: 'rr-001', name: 'CT Chest - Senior', modality: 'CT', bodyPart: 'Chest', patientStatus: 'Inpatient', maxLoad: 10, priority: 1, enabled: true },
  { id: 'rr-002', name: 'MR Brain - Specialist', modality: 'MR', bodyPart: 'Brain', patientStatus: 'Any', maxLoad: 8, priority: 2, enabled: true },
  { id: 'rr-003', name: 'DX Routine', modality: 'DX', bodyPart: 'Any', patientStatus: 'Outpatient', maxLoad: 20, priority: 3, enabled: true },
  { id: 'rr-004', name: 'CT Emergency', modality: 'CT', bodyPart: 'Any', patientStatus: 'Emergency', maxLoad: 5, priority: 0, enabled: true },
];

const DEFAULT_QUALIFICATIONS = [
  { doctorId: 'doc-001', name: 'Dr. Wang', subspecialty: '胸部影像', modality: ['CT', 'DX'], bodyParts: ['Chest', '胸部'], qualifications: ['CT 高级资质', '胸部亚专科'], currentLoad: 3, maxLoad: 10, priority: 1, accuracy: 0.94 },
  { doctorId: 'doc-002', name: 'Dr. Li', subspecialty: '神经影像', modality: ['MR', 'CT'], bodyParts: ['Brain', '头部', '头颅'], qualifications: ['MR 神经专科', '造影资质'], currentLoad: 2, maxLoad: 8, priority: 2, accuracy: 0.97 },
  { doctorId: 'doc-003', name: 'Dr. Zhang', subspecialty: '急诊影像', modality: ['CT', 'DX'], bodyParts: ['Any'], qualifications: ['急诊资质', '危急值处理'], currentLoad: 5, maxLoad: 5, priority: 0, accuracy: 0.88 },
  { doctorId: 'doc-004', name: 'Dr. Liu', subspecialty: '腹部影像', modality: ['MR', 'CT', 'US'], bodyParts: ['Abdomen', '腹部'], qualifications: ['腹部亚专科'], currentLoad: 6, maxLoad: 12, priority: 3, accuracy: 0.92 },
  { doctorId: 'doc-005', name: 'Dr. Chen', subspecialty: '骨科影像', modality: ['DX', 'CT'], bodyParts: ['Any'], qualifications: ['骨科亚专科'], currentLoad: 4, maxLoad: 20, priority: 4, accuracy: 0.9 },
];

let routeRules = DEFAULT_RULES.map((r) => ({ ...r }));
const qualifications = DEFAULT_QUALIFICATIONS.map((q) => ({ ...q, modality: [...q.modality], bodyParts: [...q.bodyParts], qualifications: [...q.qualifications] }));
const assignments = [
  { id: 'as-001', studyId: 'STU001', patientName: 'Zhang San', modality: 'CT', assignedTo: 'Dr. Wang', ruleName: 'CT Chest - Senior', assignedAt: '2026-07-10T08:30:00Z', stage: 'load-balance', qualification: '胸部影像', reason: '资质匹配→负载均衡' },
  { id: 'as-002', studyId: 'STU002', patientName: 'Li Si', modality: 'MR', assignedTo: 'Dr. Li', ruleName: 'MR Brain - Specialist', assignedAt: '2026-07-10T09:00:00Z', stage: 'qualification', qualification: '神经影像', reason: '资质匹配' },
];

interface Recommendation {
  doctorId: string;
  name: string;
  subspecialty: string;
  qualified: boolean;
  matchScore: number;
  currentLoad: number;
  maxLoad: number;
  accuracy: number;
  composite: number;
  reasons: string[];
}

function buildRecommendations(modality: string, bodyPart: string): Recommendation[] {
  const recs: Recommendation[] = qualifications.map((q) => {
    const exactBodyPart = q.bodyParts.includes(bodyPart);
    const anyBodyPart = q.bodyParts.includes('Any');
    const modalityMatch = q.modality.includes(modality);
    const matchScore = modalityMatch && exactBodyPart ? 1 : modalityMatch && anyBodyPart ? 0.8 : modalityMatch ? 0.5 : 0;
    const loadScore = q.maxLoad <= 0 ? 0 : Math.max(0, 1 - q.currentLoad / q.maxLoad);
    const composite = +(0.5 * matchScore + 0.3 * loadScore + 0.2 * q.accuracy).toFixed(3);
    const reasons: string[] = [];
    if (matchScore >= 1) reasons.push(`资质匹配: 模态+亚专科精确匹配(${q.subspecialty})`);
    else if (matchScore >= 0.8) reasons.push(`通用资质匹配: 可接诊任意部位(${q.subspecialty})`);
    else if (matchScore >= 0.5) reasons.push(`仅模态匹配(${q.subspecialty}), 亚专科需复核`);
    else reasons.push('无匹配资质');
    reasons.push(q.currentLoad < q.maxLoad ? `负载 ${q.currentLoad}/${q.maxLoad}, 可接诊` : `负载已满 ${q.currentLoad}/${q.maxLoad}, 不建议接诊`);
    reasons.push(`历史准确率 ${Math.round(q.accuracy * 100)}分`);
    return { doctorId: q.doctorId, name: q.name, subspecialty: q.subspecialty, qualified: matchScore > 0, matchScore, currentLoad: q.currentLoad, maxLoad: q.maxLoad, accuracy: q.accuracy, composite, reasons };
  });
  recs.sort((a, b) => b.composite - a.composite || b.matchScore - a.matchScore || a.currentLoad - b.currentLoad);
  return recs;
}

function routeAssign(body: { studyId: string; patientName: string; modality: string; bodyPart: string; patientStatus: string; doctorId?: string }) {
  const matched = routeRules
    .filter((r) => r.enabled && (r.modality === body.modality || r.modality === 'Any') && (r.bodyPart === body.bodyPart || r.bodyPart === 'Any') && (r.patientStatus === body.patientStatus || r.patientStatus === 'Any'))
    .sort((a, b) => a.priority - b.priority);
  const rule =
    matched[0] ?? routeRules[0] ?? { id: 'rr-000', name: '默认规则', modality: 'Any', bodyPart: 'Any', patientStatus: 'Any', maxLoad: 10, priority: 9, enabled: true };

  const ranked = buildRecommendations(body.modality, body.bodyPart);
  const qualified = ranked.filter((r) => r.qualified);
  let doctor: Recommendation | undefined;
  let stage: 'qualification' | 'load-balance' | 'priority' | 'fallback' = 'fallback';
  let reason = '无匹配资质,按规则兜底分配';
  if (body.doctorId) {
    const forced = ranked.find((r) => r.doctorId === body.doctorId);
    if (forced && forced.matchScore >= 0.8) {
      doctor = forced;
      stage = 'qualification';
      reason = `资质匹配(${doctor.subspecialty})→按推荐指定分配,推荐分${Math.round(doctor.composite * 100)}`;
    }
  }
  if (!doctor && qualified.length > 0) {
    const top = qualified[0];
    if (top) {
      doctor = top;
      if (doctor.currentLoad < doctor.maxLoad) {
        stage = 'load-balance';
        reason = `资质匹配(${doctor.subspecialty})→负载均衡(${doctor.currentLoad}/${doctor.maxLoad})→历史准确率${Math.round(doctor.accuracy * 100)}%`;
      } else {
        stage = 'priority';
        reason = `资质匹配(${doctor.subspecialty})→满载,按优先级兜底`;
      }
    }
  }
  if (doctor) {
    const base = qualifications.find((q) => q.doctorId === doctor!.doctorId);
    if (base) base.currentLoad += 1;
  }

  const assignment = {
    id: `as-${uuidv4().slice(0, 6)}`,
    studyId: body.studyId,
    patientName: body.patientName,
    modality: body.modality,
    assignedTo: doctor ? doctor.name : `Dr. ${['Wang', 'Li', 'Zhang', 'Liu', 'Chen'][Math.floor(mulberry32(hashSeed(`g005-smart-route-fallback:${body.studyId}`))() * 5)]}`,
    ruleName: rule.name,
    assignedAt: new Date().toISOString(),
    stage,
    qualification: doctor?.subspecialty,
    reason,
  };
  assignments.push(assignment as never);
  return assignment;
}

export const smartWorklistHandlers = [
  // ── worklist-smart ──
  http.get(`${API_BASE}/worklist-smart/weights`, async () => {
    await delay(60);
    // [G005 Wave4A] persisted 标志对齐后端 system_config 持久化
    return HttpResponse.json({ success: true, data: { ...weights, persisted: true } });
  }),

  http.put(`${API_BASE}/worklist-smart/weights`, async ({ request }) => {
    await delay(80);
    const body = (await request.json()) as Partial<WeightConfig>;
    weights = { ...weights, ...body };
    return HttpResponse.json({ success: true, data: { ...weights, persisted: true } });
  }),

  http.post(`${API_BASE}/worklist-smart/score`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as ScoreInput;
    const result = computeScore(body);
    scoreHistory.push({ examId: body.id, score: result.score, scoredAt: new Date().toISOString() });
    return HttpResponse.json({ success: true, data: result });
  }),

  http.post(`${API_BASE}/worklist-smart/reorder`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { items: ScoreInput[] };
    const scored = body.items.map((input, idx) => ({ ...input, ...computeScore(input), beforeRank: idx + 1, rank: 0 }));
    scored.sort((a, b) => b.score - a.score);
    scored.forEach((item, idx) => { item.rank = idx + 1; });
    return HttpResponse.json({ success: true, data: scored });
  }),

  http.get(`${API_BASE}/worklist-smart/priorities`, async () => {
    await delay(60);
    if (scoreHistory.length === 0) {
      return HttpResponse.json({ success: true, data: { critical: 3, high: 5, medium: 12, low: 10 } });
    }
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const r of scoreHistory.slice(-200)) {
      if (r.score >= 70) counts.critical++;
      else if (r.score >= 45) counts.high++;
      else if (r.score >= 20) counts.medium++;
      else counts.low++;
    }
    return HttpResponse.json({ success: true, data: counts });
  }),

  // ── [G005 Demo-Expand] Smart MWL 排程列表 (60 条, accessionNumber 与 store.exams 一致) ──
  http.get(`${API_BASE}/worklist-smart/mwl`, async ({ request }) => {
    await delay(80);
    const url = new URL(request.url);
    const modality = url.searchParams.get('modality');
    const stationAE = url.searchParams.get('stationAE');
    const mppsStatus = url.searchParams.get('mppsStatus');
    const priority = url.searchParams.get('priority');
    const search = url.searchParams.get('search');
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
    const pageSize = Math.max(1, Math.min(200, Number(url.searchParams.get('pageSize') ?? 20) || 20));
    let items = materializeMwl(ensureMwl());
    if (modality) items = items.filter((i) => i.modality === modality);
    if (stationAE) items = items.filter((i) => i.scheduledStationAeTitle === stationAE);
    if (mppsStatus) items = items.filter((i) => i.mppsStatus === mppsStatus);
    if (priority) items = items.filter((i) => i.priority === priority || i.priorityZh === priority);
    if (search) {
      const kw = search.toLowerCase();
      items = items.filter((i) => [i.patientName, i.patientId, i.accessionNumber, i.examId, i.requestedProcedureDescription].join(' ').toLowerCase().includes(kw));
    }
    items = [...items].sort((a, b) => a.slotOffsetMin - b.slotOffsetMin);
    const total = items.length;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    return HttpResponse.json({ success: true, data: items.slice(start, start + pageSize), meta: { total, page, pageSize, totalPages } });
  }),

  http.get(`${API_BASE}/worklist-smart/mwl/stats`, async () => {
    await delay(60);
    const bases = ensureMwl();
    const items = materializeMwl(bases);
    const byModality: Record<string, number> = {};
    const byMpps: Record<string, number> = {};
    const byStation: Record<string, number> = {};
    const byDevice: Record<string, number> = {};
    for (const i of items) {
      byModality[i.modality] = (byModality[i.modality] ?? 0) + 1;
      byMpps[i.mppsStatus] = (byMpps[i.mppsStatus] ?? 0) + 1;
      byStation[i.scheduledStationAeTitle] = (byStation[i.scheduledStationAeTitle] ?? 0) + 1;
      byDevice[i.deviceId] = (byDevice[i.deviceId] ?? 0) + 1;
    }
    const next = [...items].sort((a, b) => a.slotOffsetMin - b.slotOffsetMin)[0];
    return HttpResponse.json({
      success: true,
      data: {
        total: items.length,
        source: 'store.exams',
        masterDevicesUsed: Object.keys(byDevice).length,
        windowHours: 24,
        nextScheduledAt: next?.scheduledAt ?? null,
        byModality,
        byMpps,
        byStation,
      },
    });
  }),

  // ── smart-route ──
  http.get(`${API_BASE}/smart-route/rules`, async () => {
    await delay(60);
    return HttpResponse.json({ success: true, data: routeRules.map((r) => ({ ...r })) });
  }),

  http.put(`${API_BASE}/smart-route/rules`, async ({ request }) => {
    await delay(100);
    const body = (await request.json()) as { rules: typeof DEFAULT_RULES };
    routeRules = (body.rules ?? []).map((r) => ({ ...r }));
    return HttpResponse.json({ success: true, data: routeRules.map((r) => ({ ...r })) });
  }),

  http.get(`${API_BASE}/smart-route/qualifications`, async () => {
    await delay(60);
    return HttpResponse.json({
      success: true,
      data: qualifications.map((q) => ({ ...q, modality: [...q.modality], bodyParts: [...q.bodyParts], qualifications: [...q.qualifications] })),
    });
  }),

  http.post(`${API_BASE}/smart-route/assign`, async ({ request }) => {
    await delay(150);
    const body = (await request.json()) as { studyId: string; patientName: string; modality: string; bodyPart: string; patientStatus: string; doctorId?: string };
    return HttpResponse.json({ success: true, data: routeAssign(body) });
  }),

  http.post(`${API_BASE}/smart-route/recommend`, async ({ request }) => {
    await delay(120);
    const body = (await request.json()) as { modality: string; bodyPart: string; patientStatus: string };
    return HttpResponse.json({ success: true, data: buildRecommendations(body.modality, body.bodyPart) });
  }),

  http.get(`${API_BASE}/smart-route/history`, async () => {
    await delay(60);
    return HttpResponse.json({ success: true, data: assignments });
  }),

  http.get(`${API_BASE}/smart-route/stats`, async () => {
    await delay(60);
    const byModality: Record<string, number> = {};
    const byDoctor: Record<string, number> = {};
    assignments.forEach((h) => {
      byModality[h.modality] = (byModality[h.modality] || 0) + 1;
      byDoctor[h.assignedTo] = (byDoctor[h.assignedTo] || 0) + 1;
    });
    return HttpResponse.json({ success: true, data: { total: assignments.length, byModality, byDoctor } });
  }),
];
