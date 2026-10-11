// [W3-2] AI 智能分检 MSW handlers (/api/v1/triage/*)
// 页面: /ai-triage (AiTriagePage) / TriageDashboardPage
// [G005 Wave1A P0] 路径与后端 triage.controller 对齐 (/triage/score|batch-score|assign|pending|stats)。
// 后端已实现同路径真实端点, MSW 仅用于 dev mock 模式支撑。
// [G005 Demo-Expand] 演示分诊队列: 30 条 pending/assigned 病例全部锚定 store.exams 中的检查
//   (patientId / examId / accessionNumber 与检查主数据一致)。Mix: 急诊 12 (40%) / 加急 9 (30%) / 普通 9 (30%)。
//   每例含 AI 严重度评分 0-100、NIHSS 类生命体征预警、DOCTOR_MASTER 分配放射医师、ESI 1-5,
//   createdAt 均落在最近 2h 内。
//   selectAnchorExams() 为 triage / MWL / emergency-channel 三端共享的锚点选择规则
//   (smartWorklistHandlers 60 条 MWL ⊇ 本队列 30 条; emergencyChannelHandlers 15 条 ⊂ 本队列),
//   保证「AI 分诊 → 智能工作列表 → 急诊通道 → 报告」端到端可串联。
import { http, HttpResponse, delay } from 'msw';
import { get, list } from './store';
import { DOCTOR_MASTER } from '../../data/master';
import { hashSeed, mulberry32 } from '../../utils/seededRandom';

// 与 emergencyChannelHandlers/criticalExtHandlers 一致: 浏览器用页面 origin, node 测试兜底 localhost
const API = (() => {
  try { return window.location.origin + '/api/v1/triage'; } catch { return 'http://localhost/api/v1/triage'; }
})();

// ==================== 确定性 PRNG (mulberry32 + FNV-1a, 见 utils/seededRandom) ====================
// 固定 tag 种子 → 同一 tag 永远产生同一序列。禁止 module-scope Math.random()。
function rngFor(tag: string): () => number {
  return mulberry32(hashSeed(tag));
}

const LEVEL_DOCTORS: Record<string, string> = {
  CRITICAL: '急诊放射科·值班二线',
  URGENT: '放射科·高年资主治',
  SEMI_URGENT: '放射科·主治医师',
  ROUTINE: '放射科·住院医师',
};

function buildFactors(score: number, level: string) {
  const base = [
    { name: '危急征象', weight: 0.4, contribution: level === 'CRITICAL' ? 0.38 : level === 'URGENT' ? 0.3 : 0.15, description: 'AI 检出危急征象(出血/张力性气胸/主动脉夹层等)' },
    { name: '症状相关性', weight: 0.25, contribution: 0.18, description: '主诉与影像征象关联度' },
    { name: '病史风险', weight: 0.2, contribution: 0.14, description: '年龄/既往史/危险因素' },
    { name: '检查类别', weight: 0.15, contribution: 0.1, description: '急诊/平诊检查类别权重' },
  ];
  return base.map((f) => ({
    ...f,
    contribution: Math.round(f.weight * score * 100) / 100,
  }));
}

// ==================== 锚点检查 (store.exams → triage / MWL / emergency 共享) ====================
export interface ExamAnchor {
  examId: string;
  reportId: string;
  patientId: string;
  patientName: string;
  gender: string;
  age: number | null;
  modality: string;
  bodyPart: string;
  examItem: string;
  examPriority: string;
  patientType: string;
  accessionNumber: string;
  hasAccession: boolean;
  deviceId: string;
  deviceName: string;
  status: string;
  examAt: string;
  technologistId: string;
  technologistName: string;
  clinicalDiagnosis: string;
}

function normalizeExam(r: unknown): ExamAnchor | null {
  if (!r || typeof r !== 'object') return null;
  const row = r as Record<string, unknown>;
  const str = (v: unknown): string => (v === undefined || v === null ? '' : String(v));
  const examId = str(row.id ?? row.reportId ?? row.examId).trim();
  const patientId = str(row.patientId ?? row.patientID).trim();
  if (!examId || !patientId) return null;
  const accessionNumber = str(row.accessionNumber).trim();
  const ageRaw = row.age ?? row.patientAge;
  const ageNum = typeof ageRaw === 'number' ? ageRaw : Number(ageRaw);
  const reportId = str(row.reportId).trim();
  return {
    examId,
    reportId: reportId || examId,
    patientId,
    patientName: str(row.patientName) || '未知患者',
    gender: str(row.gender ?? row.patientGender) || '男',
    age: Number.isFinite(ageNum) ? ageNum : null,
    modality: str(row.modality) || 'CT',
    bodyPart: str(row.bodyPart) || '未注明',
    examItem: str(row.examItemName ?? row.examItem) || `${str(row.modality) || 'CT'}检查`,
    examPriority: str(row.priority) || '普通',
    patientType: str(row.patientType) || '门诊',
    accessionNumber,
    hasAccession: accessionNumber.length > 0,
    deviceId: str(row.deviceId),
    deviceName: str(row.deviceName ?? row.deviceModel),
    status: str(row.status),
    examAt: str(row.examAt ?? row.examDate ?? row.createdAt ?? row.scheduledAt),
    technologistId: str(row.technologistId ?? row.doctorId),
    technologistName: str(row.technologistName),
    clinicalDiagnosis: str(row.clinicalDiagnosis),
  };
}

function byExamIdAsc(a: ExamAnchor, b: ExamAnchor): number {
  return a.examId < b.examId ? -1 : a.examId > b.examId ? 1 : 0;
}

export function queuePriorityOf(examPriority: string): '急诊' | '加急' | '普通' {
  if (examPriority === '危重' || examPriority === '急诊') return '急诊';
  if (examPriority === '紧急' || examPriority === '加急') return '加急';
  return '普通';
}

// 分诊队列构成: 急诊 12 (危重/急诊) · 加急 9 (紧急/加急) · 普通 9 → 30 条
const TRIAGE_MIX: Array<{ queuePriority: '急诊' | '加急' | '普通'; count: number; match: (p: string) => boolean }> = [
  { queuePriority: '急诊', count: 12, match: (p) => p === '危重' || p === '急诊' },
  { queuePriority: '加急', count: 9, match: (p) => p === '紧急' || p === '加急' },
  { queuePriority: '普通', count: 9, match: (p) => p !== '危重' && p !== '急诊' && p !== '紧急' && p !== '加急' },
];

export interface AnchorSelection {
  triage: ExamAnchor[];
  worklist: ExamAnchor[];
  emergency: ExamAnchor[];
  poolSize: number;
  tierASize: number;
}

let anchorCache: AnchorSelection | null = null;

// 锚点选择 (确定性): 带 accessionNumber 的检查 (RAD-EX001..200) 优先, 便于 MWL 复用 accession 钻取。
// 嵌套关系: emergency (15) ⊂ triage (30) ⊂ worklist (60)。
export function selectAnchorExams(): AnchorSelection {
  if (anchorCache) return anchorCache;
  const rawRows = list<unknown>('exams');
  const rows: ExamAnchor[] = [];
  for (const raw of rawRows) {
    const row = normalizeExam(raw);
    if (row) rows.push(row);
  }
  rows.sort(byExamIdAsc);
  const tierA = rows.filter((r) => r.hasAccession);
  const ordered = [...tierA, ...rows.filter((r) => !r.hasAccession)];

  const used = new Set<string>();
  const take = (count: number, match: (p: string) => boolean): ExamAnchor[] => {
    const out: ExamAnchor[] = [];
    for (const r of ordered) {
      if (out.length >= count) break;
      if (used.has(r.examId)) continue;
      if (!match(r.examPriority)) continue;
      used.add(r.examId);
      out.push(r);
    }
    return out;
  };
  const topUp = (out: ExamAnchor[], target: number): void => {
    for (const r of ordered) {
      if (out.length >= target) break;
      if (used.has(r.examId)) continue;
      used.add(r.examId);
      out.push(r);
    }
  };

  const triage: ExamAnchor[] = [];
  for (const mix of TRIAGE_MIX) {
    const picked = take(mix.count, mix.match);
    triage.push(...picked);
  }
  if (triage.length < 30) topUp(triage, 30);

  // emergency: 分诊集内急诊/加急病例的前 15 条 (priority 急诊/加急, 与分诊/MWL 同源)
  const emergency = triage
    .filter((r) => queuePriorityOf(r.examPriority) !== '普通')
    .slice(0, 15);
  const emergencyIds = new Set(emergency.map((r) => r.examId));

  // worklist: 分诊集 30 条 + 按 examId 顺序补足 30 条 → 60 条 MWL 锚点
  const filler = ordered.filter((r) => !used.has(r.examId) && !emergencyIds.has(r.examId)).slice(0, 30);
  const worklist = [...triage, ...filler].sort(byExamIdAsc);

  anchorCache = { triage, worklist, emergency, poolSize: rows.length, tierASize: tierA.length };
  return anchorCache;
}

// ==================== 分诊病例 (vitals / ESI / NIHSS 类标记) ====================
interface TriageVitals {
  systolicBp: number;
  diastolicBp: number;
  heartRate: number;
  temperature: number;
  spo2: number;
  respiratoryRate: number;
}

interface Scenario {
  key: string;
  symptoms: string;
  clinicalInfo: string;
  referringDept: string;
  nihss?: [number, number];
  gcs?: [number, number];
}

const EMERGENCY_SCENARIOS: Scenario[] = [
  { key: 'stroke', symptoms: '突发右侧肢体无力伴言语不清 1 小时', clinicalInfo: '急性脑卒中绿色通道, 房颤病史, NIHSS 待评', referringDept: '急诊内科(卒中中心)', nihss: [6, 18] },
  { key: 'pe', symptoms: '突发胸闷气促 2 小时, 活动后加重', clinicalInfo: '疑急性肺栓塞, D-二聚体 5.2 mg/L, 下肢静脉血栓史', referringDept: '急诊内科' },
  { key: 'trauma', symptoms: '车祸致头部外伤伴意识障碍 30 分钟', clinicalInfo: '多发伤待查, GCS 呈下降趋势, 不排除颅骨骨折', referringDept: '急诊外科(创伤中心)', gcs: [8, 14] },
  { key: 'aorta', symptoms: '撕裂样胸痛 40 分钟并向背部放射', clinicalInfo: '疑主动脉夹层, 高血压 3 级 (200/110 mmHg)', referringDept: '急诊内科' },
  { key: 'stemi', symptoms: '持续性胸痛 1 小时, 含服硝酸甘油不缓解', clinicalInfo: '心电图 V2-V4 ST 段抬高, 疑急性 STEMI, 胸痛中心已激活', referringDept: '急诊胸痛中心' },
  { key: 'ich', symptoms: '突发剧烈头痛伴喷射性呕吐 40 分钟', clinicalInfo: '疑急性脑出血, 高血压病史, 长期抗凝治疗', referringDept: '急诊内科', nihss: [8, 22] },
];

const URGENT_SCENARIOS: Scenario[] = [
  { key: 'abd-pain', symptoms: '右下腹痛 8 小时伴发热', clinicalInfo: '疑急性阑尾炎, WBC 14.2×10⁹/L', referringDept: '急诊外科' },
  { key: 'fracture', symptoms: '摔伤致左踝肿痛、活动受限 3 小时', clinicalInfo: '疑踝关节骨折, 需评估移位情况', referringDept: '急诊骨科' },
  { key: 'pneumonia', symptoms: '咳嗽咳痰 5 天加重伴高热 2 天', clinicalInfo: '疑社区获得性肺炎, CRP 86 mg/L', referringDept: '呼吸内科' },
  { key: 'gi-bleed', symptoms: '黑便 2 天伴头晕乏力', clinicalInfo: '疑上消化道出血, Hb 78 g/L', referringDept: '消化内科' },
  { key: 'head-injury', symptoms: '跌倒后头痛 4 小时, 无意识丧失', clinicalInfo: '老年患者抗凝治疗中, 需排除迟发性颅内血肿', referringDept: '急诊外科' },
];

const ROUTINE_SCENARIOS: Scenario[] = [
  { key: 'checkup', symptoms: '健康体检, 无特殊不适', clinicalInfo: '年度健康体检影像项目', referringDept: '体检中心' },
  { key: 'followup', symptoms: '既往病灶复查, 无新发症状', clinicalInfo: '治疗后定期随访评估', referringDept: '门诊' },
  { key: 'chronic', symptoms: '慢性咳嗽 2 周, 无发热', clinicalInfo: '门诊常规影像学检查', referringDept: '呼吸内科门诊' },
  { key: 'spine', symptoms: '腰部酸痛 2 月, 无下肢放射痛', clinicalInfo: '腰椎退行性变待查', referringDept: '骨科门诊' },
];

const RADIOLOGIST_TITLES = new Set(['主任医师', '副主任医师', '主治医师', '住院医师']);
const RADIOLOGISTS = DOCTOR_MASTER.filter((d) => d.active && RADIOLOGIST_TITLES.has(d.title));
const PREFERRED_SUBS: Record<'急诊' | '加急' | '普通', string[]> = {
  急诊: ['急诊放射', '神经放射', '胸部放射', '心血管放射', '骨肌放射'],
  加急: ['急诊放射', 'CT', 'MR', '胸部放射', '腹部放射'],
  普通: ['CT', 'MR', '普放', '骨肌放射', '腹部放射', '乳腺放射'],
};

function pickDoctor(rand: () => number, queuePriority: '急诊' | '加急' | '普通') {
  const subs = PREFERRED_SUBS[queuePriority];
  const preferred = RADIOLOGISTS.filter((d) => subs.includes(d.subspecialty));
  const pool = preferred.length > 0 ? preferred : RADIOLOGISTS;
  const doc = pool[Math.floor(rand() * pool.length)];
  return doc ?? RADIOLOGISTS[0] ?? DOCTOR_MASTER[0];
}

function pickScenario(rand: () => number, queuePriority: '急诊' | '加急' | '普通'): Scenario {
  const pool = queuePriority === '急诊' ? EMERGENCY_SCENARIOS : queuePriority === '加急' ? URGENT_SCENARIOS : ROUTINE_SCENARIOS;
  return pool[Math.floor(rand() * pool.length)] ?? ROUTINE_SCENARIOS[0] ?? EMERGENCY_SCENARIOS[0]!;
}

function buildVitals(rand: () => number, severity: 'critical' | 'urgent' | 'routine'): TriageVitals {
  const ri = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  if (severity === 'critical') {
    return { systolicBp: ri(88, 196), diastolicBp: ri(52, 116), heartRate: ri(46, 136), temperature: Math.round((36 + rand() * 3.3) * 10) / 10, spo2: ri(87, 99), respiratoryRate: ri(16, 32) };
  }
  if (severity === 'urgent') {
    return { systolicBp: ri(96, 168), diastolicBp: ri(58, 100), heartRate: ri(58, 118), temperature: Math.round((36.1 + rand() * 2.6) * 10) / 10, spo2: ri(92, 99), respiratoryRate: ri(14, 26) };
  }
  return { systolicBp: ri(104, 138), diastolicBp: ri(64, 88), heartRate: ri(60, 96), temperature: Math.round((36.2 + rand() * 1.3) * 10) / 10, spo2: ri(96, 100), respiratoryRate: ri(12, 20) };
}

function buildVitalsBreaches(v: TriageVitals, nihss?: number, gcs?: number): string[] {
  const out: string[] = [];
  if (v.systolicBp >= 180) out.push(`收缩压 ${v.systolicBp} mmHg (≥180, 高血压危象)`);
  else if (v.systolicBp <= 90) out.push(`收缩压 ${v.systolicBp} mmHg (≤90, 低血压/休克)`);
  if (v.diastolicBp >= 110) out.push(`舒张压 ${v.diastolicBp} mmHg (≥110)`);
  if (v.heartRate >= 120) out.push(`心率 ${v.heartRate} 次/分 (≥120, 心动过速)`);
  else if (v.heartRate <= 50) out.push(`心率 ${v.heartRate} 次/分 (≤50, 心动过缓)`);
  if (v.spo2 < 94) out.push(`SpO₂ ${v.spo2}% (<94%, 低氧血症)`);
  if (v.temperature >= 38.5) out.push(`体温 ${v.temperature}℃ (≥38.5℃, 高热)`);
  if (v.respiratoryRate >= 24) out.push(`呼吸频率 ${v.respiratoryRate} 次/分 (≥24, 呼吸急促)`);
  if (nihss !== undefined && nihss >= 5) out.push(`NIHSS ${nihss} 分 (${nihss >= 16 ? '重度' : '中度'}神经功能缺损)`);
  if (gcs !== undefined && gcs <= 12) out.push(`GCS ${gcs} 分 (≤12, 意识障碍)`);
  return out;
}

interface TriageCase {
  id: string;
  examId: string;
  reportId: string;
  accessionNumber: string;
  patientId: string;
  patientName: string;
  examType: string;
  examItemName: string;
  bodyPart: string;
  symptoms: string;
  clinicalInfo: string;
  referringDept: string;
  patientAge: number | null;
  gender: string;
  score: number;
  level: 'CRITICAL' | 'URGENT' | 'SEMI_URGENT' | 'ROUTINE';
  factors: ReturnType<typeof buildFactors>;
  suggestedDoctor: string;
  aiConfidence: number;
  reasoning: string;
  status: 'PENDING' | 'ASSIGNED' | 'COMPLETED';
  assignedDoctor?: string;
  assignedDoctorId?: string;
  createdAt: string;
  queuePriority: '急诊' | '加急' | '普通';
  examPriority: string;
  esiLevel: 1 | 2 | 3 | 4 | 5;
  vitals: TriageVitals;
  vitalsBreaches: string[];
  nihss?: number;
  gcs?: number;
  modality: string;
  deviceId: string;
  deviceName: string;
}

function levelOf(score: number): TriageCase['level'] {
  return score >= 80 ? 'CRITICAL' : score >= 65 ? 'URGENT' : score >= 45 ? 'SEMI_URGENT' : 'ROUTINE';
}

function buildTriageCase(row: ExamAnchor, index: number): TriageCase {
  const rand = rngFor(`g005-ai-triage:${row.examId}`);
  const queuePriority = queuePriorityOf(row.examPriority);
  const scenario = pickScenario(rand, queuePriority);
  const severity: 'critical' | 'urgent' | 'routine' = queuePriority === '急诊' ? 'critical' : queuePriority === '加急' ? 'urgent' : 'routine';
  const score = queuePriority === '急诊'
    ? 78 + Math.floor(rand() * 22)
    : queuePriority === '加急'
      ? 55 + Math.floor(rand() * 30)
      : 18 + Math.floor(rand() * 42);
  const level = levelOf(score);

  let nihss: number | undefined;
  let gcs: number | undefined;
  if (scenario.nihss) nihss = scenario.nihss[0] + Math.floor(rand() * (scenario.nihss[1] - scenario.nihss[0] + 1));
  if (scenario.gcs) gcs = scenario.gcs[0] + Math.floor(rand() * (scenario.gcs[1] - scenario.gcs[0] + 1));

  const vitals = buildVitals(rand, severity);
  const vitalsBreaches = buildVitalsBreaches(vitals, nihss, gcs);

  let esiLevel: 1 | 2 | 3 | 4 | 5;
  if (queuePriority === '急诊') {
    esiLevel = (nihss !== undefined && nihss >= 16) || (gcs !== undefined && gcs <= 9) || vitals.spo2 < 90 || vitals.systolicBp <= 90 ? 1 : 2;
  } else if (queuePriority === '加急') {
    esiLevel = vitals.heartRate >= 120 || vitals.temperature >= 39 ? 2 : 3;
  } else {
    esiLevel = (row.age ?? 0) >= 75 ? 3 : index % 2 === 0 ? 4 : 5;
  }

  const doctor = pickDoctor(rand, queuePriority);
  const doctorLabel = doctor ? `${doctor.name}(${doctor.title}·${doctor.subspecialty})` : LEVEL_DOCTORS[level] ?? '放射科·住院医师';
  const status: TriageCase['status'] = index % 5 < 3 ? 'PENDING' : 'ASSIGNED';
  const createdAt = new Date(Date.now() - Math.floor(rand() * 120) * 60_000).toISOString();
  const aiConfidence = Math.round((0.78 + rand() * 0.19) * 100) / 100;

  const reasoning = `AI 多因子评分 ${score} 分 (${level}): ${scenario.symptoms}。${vitalsBreaches.length > 0 ? `生命体征预警: ${vitalsBreaches.join('; ')}。` : '生命体征平稳, 未触发预警。'}检查 ${row.modality} ${row.bodyPart} (${row.examItem}), 建议 ${doctorLabel} 优先处理, ESI ${esiLevel} 级。`;

  return {
    id: `TRG-${String(index + 1).padStart(4, '0')}`,
    examId: row.examId,
    reportId: row.reportId,
    accessionNumber: row.accessionNumber,
    patientId: row.patientId,
    patientName: row.patientName,
    examType: row.modality,
    examItemName: row.examItem,
    bodyPart: row.bodyPart,
    symptoms: scenario.symptoms,
    clinicalInfo: scenario.clinicalInfo,
    referringDept: scenario.referringDept,
    patientAge: row.age,
    gender: row.gender,
    score,
    level,
    factors: buildFactors(score / 100, level),
    suggestedDoctor: doctorLabel,
    aiConfidence,
    reasoning,
    status,
    assignedDoctor: status === 'ASSIGNED' ? doctorLabel : undefined,
    assignedDoctorId: status === 'ASSIGNED' ? doctor?.id : undefined,
    createdAt,
    queuePriority,
    examPriority: row.examPriority,
    esiLevel,
    vitals,
    vitalsBreaches,
    ...(nihss !== undefined ? { nihss } : {}),
    ...(gcs !== undefined ? { gcs } : {}),
    modality: row.modality,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
  };
}

let pendingItems: TriageCase[] = [];
let seeded = false;
let triageSeq = 0;

function ensureSeeded(): void {
  if (seeded) return;
  seeded = true;
  const { triage } = selectAnchorExams();
  const cases = triage.map((row, i) => buildTriageCase(row, i));
  cases.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  pendingItems = cases;
  triageSeq = cases.length;
}

function nextTriageId(): string {
  triageSeq += 1;
  return `TRG-${String(triageSeq).padStart(4, '0')}`;
}

function enrichFromStore(examId: string): Partial<TriageCase> {
  if (!examId) return {};
  const exam = get<Record<string, unknown>>('exams', examId);
  const anchor = normalizeExam(exam);
  if (!anchor) return {};
  return {
    patientId: anchor.patientId,
    patientName: anchor.patientName,
    examType: anchor.modality,
    examItemName: anchor.examItem,
    bodyPart: anchor.bodyPart,
    accessionNumber: anchor.accessionNumber,
    reportId: anchor.reportId,
    examPriority: anchor.examPriority,
    queuePriority: queuePriorityOf(anchor.examPriority),
    patientAge: anchor.age,
    gender: anchor.gender,
  };
}

const HISTORICAL_BY_LEVEL = { CRITICAL: 3, URGENT: 11, SEMI_URGENT: 27, ROUTINE: 57 };

export const aiTriageHandlers = [
  http.get(`${API}/pending`, async () => {
    await delay(80);
    ensureSeeded();
    return HttpResponse.json({ success: true, data: pendingItems, meta: { total: pendingItems.length, seededFrom: 'store.exams' } });
  }),

  http.get(`${API}/stats`, async () => {
    await delay(50);
    ensureSeeded();
    const byLevel = { ...HISTORICAL_BY_LEVEL };
    let scoreSum = 0;
    for (const item of pendingItems) {
      byLevel[item.level] += 1;
      scoreSum += item.score;
    }
    const total = pendingItems.length + HISTORICAL_BY_LEVEL.CRITICAL + HISTORICAL_BY_LEVEL.URGENT + HISTORICAL_BY_LEVEL.SEMI_URGENT + HISTORICAL_BY_LEVEL.ROUTINE;
    const avgScore = pendingItems.length > 0 ? Math.round(scoreSum / pendingItems.length) : 61;
    return HttpResponse.json({ success: true, data: { total, byLevel, avgScore, accuracy: 95, queue: { total: pendingItems.length, pending: pendingItems.filter((i) => i.status === 'PENDING').length, assigned: pendingItems.filter((i) => i.status === 'ASSIGNED').length } } });
  }),

  http.post(`${API}/score`, async ({ request }) => {
    await delay(150);
    ensureSeeded();
    const body = (await request.json()) as Record<string, unknown>;
    const examId = String(body.examId ?? '');
    const score = 62 + Math.floor((examId.length % 30));
    const level = levelOf(score);
    const rand = rngFor(`g005-triage-score:${examId || 'anonymous'}`);
    const vitals = buildVitals(rand, score >= 80 ? 'critical' : score >= 65 ? 'urgent' : 'routine');
    const linked = enrichFromStore(examId);
    const doctor = pickDoctor(rand, linked.queuePriority ?? '加急');
    const doctorLabel = doctor ? `${doctor.name}(${doctor.title}·${doctor.subspecialty})` : LEVEL_DOCTORS[level] ?? '放射科·住院医师';
    const queuePriority = linked.queuePriority ?? (score >= 80 ? '急诊' : score >= 60 ? '加急' : '普通');
    const result: TriageCase = {
      id: nextTriageId(),
      examId: examId || `EXAM-${Date.now()}`,
      reportId: linked.reportId ?? examId,
      accessionNumber: linked.accessionNumber ?? '',
      patientId: String(body.patientId ?? linked.patientId ?? `P${Date.now()}`),
      patientName: String(body.patientName ?? linked.patientName ?? '当前患者'),
      examType: String(body.examType ?? linked.examType ?? 'CT'),
      examItemName: linked.examItemName ?? '',
      bodyPart: linked.bodyPart ?? '',
      symptoms: String(body.symptoms ?? '未提供'),
      clinicalInfo: String(body.symptoms ?? ''),
      referringDept: String(body.referringDept ?? '急诊科'),
      patientAge: linked.patientAge ?? null,
      gender: String(body.gender ?? linked.gender ?? '男'),
      score,
      level,
      factors: buildFactors(score / 100, level),
      suggestedDoctor: doctorLabel,
      aiConfidence: Math.round((0.82 + (score % 15) / 100) * 100) / 100,
      reasoning: `基于症状(${String(body.symptoms ?? '无')})、病史与检查类别的多因子加权评分, 综合得分 ${score} 分, 建议 ${doctorLabel} 优先处理。`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
      queuePriority,
      examPriority: linked.examPriority ?? '普通',
      esiLevel: score >= 80 ? 1 : score >= 65 ? 2 : score >= 45 ? 3 : 4,
      vitals,
      vitalsBreaches: buildVitalsBreaches(vitals),
      modality: String(body.examType ?? linked.examType ?? 'CT'),
      deviceId: '',
      deviceName: '',
    };
    pendingItems.unshift(result);
    return HttpResponse.json({ success: true, data: result }, { status: 201 });
  }),

  http.post(`${API}/assign`, async ({ request }) => {
    await delay(120);
    ensureSeeded();
    const body = (await request.json()) as Record<string, unknown>;
    const examId = String(body.examId ?? '');
    const item = pendingItems.find((i) => i.examId === examId);
    const rand = rngFor(`g005-triage-assign:${examId || 'anonymous'}`);
    const doctor = pickDoctor(rand, item?.queuePriority ?? '加急');
    const assignedDoctor = String(body.assignedDoctor ?? '') || (item ? item.suggestedDoctor : doctor ? `${doctor.name}(${doctor.title}·${doctor.subspecialty})` : '放射科·住院医师');
    const linked: Partial<TriageCase> = item ? {} : enrichFromStore(examId);
    const result: TriageCase = {
      id: item?.id ?? nextTriageId(),
      examId,
      reportId: item?.reportId ?? linked.reportId ?? examId,
      accessionNumber: item?.accessionNumber ?? linked.accessionNumber ?? '',
      patientId: String(body.patientId ?? item?.patientId ?? linked.patientId ?? ''),
      patientName: String(body.patientName ?? item?.patientName ?? linked.patientName ?? '当前患者'),
      examType: String(body.examType ?? item?.examType ?? linked.examType ?? 'CT'),
      examItemName: item?.examItemName ?? linked.examItemName ?? '',
      bodyPart: item?.bodyPart ?? linked.bodyPart ?? '',
      symptoms: item?.symptoms ?? '未提供',
      clinicalInfo: item?.clinicalInfo ?? '',
      referringDept: item?.referringDept ?? '急诊科',
      patientAge: item?.patientAge ?? linked.patientAge ?? null,
      gender: String(item?.gender ?? linked.gender ?? '男'),
      score: item?.score ?? 60,
      level: item?.level ?? 'SEMI_URGENT',
      factors: item?.factors ?? buildFactors(0.6, 'SEMI_URGENT'),
      suggestedDoctor: item?.suggestedDoctor ?? assignedDoctor,
      aiConfidence: item?.aiConfidence ?? 0.8,
      reasoning: item?.reasoning ?? 'AI 自动分诊并分配。',
      status: 'ASSIGNED',
      assignedDoctor,
      assignedDoctorId: item?.assignedDoctorId ?? doctor?.id,
      createdAt: item?.createdAt ?? new Date().toISOString(),
      queuePriority: item?.queuePriority ?? linked.queuePriority ?? '加急',
      examPriority: item?.examPriority ?? linked.examPriority ?? '普通',
      esiLevel: item?.esiLevel ?? 3,
      vitals: item?.vitals ?? buildVitals(rand, 'urgent'),
      vitalsBreaches: item?.vitalsBreaches ?? [],
      modality: item?.modality ?? String(body.examType ?? linked.examType ?? 'CT'),
      deviceId: item?.deviceId ?? '',
      deviceName: item?.deviceName ?? '',
    };
    if (item) {
      item.status = 'ASSIGNED';
      item.assignedDoctor = assignedDoctor;
      item.assignedDoctorId = doctor?.id;
    } else {
      pendingItems.unshift(result);
    }
    return HttpResponse.json({ success: true, data: result });
  }),

  http.post(`${API}/batch-score`, async ({ request }) => {
    await delay(200);
    ensureSeeded();
    const body = (await request.json()) as Record<string, unknown>;
    const inputs = Array.isArray(body.items) ? (body.items as Record<string, unknown>[]) : [];
    const items = inputs.map((input, idx) => {
      const examId = String(input?.examId ?? `batch-${idx}`);
      const rand = rngFor(`g005-triage-batch:${examId}`);
      const score = 55 + Math.floor(rand() * 35);
      const level = levelOf(score);
      const linked = enrichFromStore(examId);
      return {
        id: `TRG-B${String(idx + 1).padStart(3, '0')}`,
        examId,
        patientId: input?.patientId ?? linked.patientId ?? '',
        patientName: input?.patientName ?? linked.patientName ?? '',
        examType: input?.examType ?? linked.examType ?? 'CT',
        accessionNumber: linked.accessionNumber ?? '',
        score,
        level,
        factors: buildFactors(score / 100, level),
        suggestedDoctor: LEVEL_DOCTORS[level] ?? '放射科·住院医师',
        aiConfidence: 0.8,
        reasoning: '批量分诊完成。',
        queuePriority: linked.queuePriority ?? (score >= 80 ? '急诊' : score >= 60 ? '加急' : '普通'),
      };
    });
    return HttpResponse.json({ success: true, data: items });
  }),
];

export default aiTriageHandlers;
