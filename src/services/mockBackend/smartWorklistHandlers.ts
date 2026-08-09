/**
 * [v3.0.6.11-60] Smart MWL 深度化
 * /api/v1/worklist-smart/* (评分/权重/优先级统计)
 * /api/v1/smart-route/*   (路由规则/医生资质/分配)
 * 算法与 backend/src/modules/{worklist-smart,smart-route} 保持一致
 */
import { http, HttpResponse, delay } from 'msw';
import { v4 as uuidv4 } from 'uuid';

const API_BASE = '/api/v1';

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
    assignedTo: doctor ? doctor.name : `Dr. ${['Wang', 'Li', 'Zhang', 'Liu', 'Chen'][Math.floor(Math.random() * 5)]}`,
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
