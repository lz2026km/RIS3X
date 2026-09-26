// [v3.0.6.8-27] 程序化生成器
// 6 个核心函数用于批量生成放射科质控数据

import { DOCTOR_MASTER, DOCTORS_BY_TITLE, PATIENT_MASTER, PATIENTS_BY_MODALITY, DEVICE_MASTER, DEVICES_BY_MODALITY, EXAMS_BY_MODALITY } from '../master';

// ============================================================
// 随机数工具
// ============================================================
let _seed = 0x12345;
export function seedRandom(seed: number = 0x12345): number {
  _seed = seed;
  return seed;
}
export function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
export function randInt(min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]!;
}
export function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => rand() - 0.5);
  return shuffled.slice(0, Math.min(n, arr.length));
}
export function chance(p: number): boolean {
  return rand() < p;
}

// ============================================================
// 时间生成器
// ============================================================
const NOW = new Date("2026-06-23T10:00:00");
const DAY = 86400000;
const HOUR = 3600000;

/** 生成过去 N 天的随机时刻 */
export function timeAgo(daysAgo: number, hoursAgo = 0, minsAgo = 0): string {
  const t = NOW.getTime() - daysAgo * DAY - hoursAgo * HOUR - minsAgo * 60000;
  const d = new Date(t);
  return d.toISOString();
}

/** 生成过去 30 天均匀分布的时间点 (按 idx 0..count) */
export function timeSeries(start: number, end: number, count: number, idx: number): string {
  const t = start + (end - start) * (idx / Math.max(count - 1, 1));
  return new Date(t).toISOString();
}

/** ISO 日期 (yyyy-mm-dd) */
export function isoDate(daysAgo: number): string {
  return timeAgo(daysAgo).split("T")[0]!;
}

// ============================================================
// 1. 医生工作绩效记录生成器
// ============================================================
export interface DoctorPerformanceRecord {
  id: string;
  doctorId: string;
  doctorName: string;
  title: string;
  month: string; // 2026-06
  reportCount: number;
  defectCount: number;
  criticalValueCount: number;
  cosignCount: number;
  avgTAT: number; // 分钟
  qcScore: number; // 0-100
  grade: "A" | "B" | "C" | "D";
  timelyRate: number; // %
  defectRate: number; // %
  radPathMatch: number; // 病理符合率 %
  peerReview: number; // 同级评审数
}

export function generateDoctorPerformance(records: number, months: number = 6): DoctorPerformanceRecord[] {
  const monthsArr: string[] = [];
  for (let m = 0; m < months; m++) {
    const d = new Date(2026, m + 1, 1);
    monthsArr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const out: DoctorPerformanceRecord[] = [];
  let idx = 0;
  for (const month of monthsArr) {
    for (const d of DOCTOR_MASTER) {
      if (d.title === "技师" || d.title === "护士" || d.title === "护师") continue;
      if (rand() < 0.05) continue; // 5% 漏报
      const baseReport = d.monthlyReportCount;
      const reportCount = Math.round(baseReport * (0.9 + rand() * 0.2));
      const defectCount = Math.round(reportCount * (0.005 + rand() * 0.02));
      const criticalValueCount = Math.round(d.monthlyCriticalValueCount * (0.8 + rand() * 0.4));
      const cosignCount = Math.round(d.monthlyCosignCount * (0.9 + rand() * 0.3));
      const avgTAT = 120 + Math.floor(rand() * 180);
      const baseQCScore = d.annualQCScore - 5 + Math.floor(rand() * 10);
      const grade: DoctorPerformanceRecord["grade"] = baseQCScore >= 92 ? "A" : baseQCScore >= 85 ? "B" : baseQCScore >= 75 ? "C" : "D";
      const timelyRate = 85 + rand() * 15;
      const defectRate = (defectCount / reportCount) * 100;
      const radPathMatch = 88 + rand() * 12;
      const peerReview = Math.round(reportCount * (0.05 + rand() * 0.1));
      out.push({
        id: `DPR-${month}-${d.id}-${idx++}`,
        doctorId: d.id,
        doctorName: d.name,
        title: d.title,
        month,
        reportCount,
        defectCount,
        criticalValueCount,
        cosignCount,
        avgTAT,
        qcScore: Math.round(baseQCScore),
        grade,
        timelyRate: Math.round(timelyRate * 10) / 10,
        defectRate: Math.round(defectRate * 10) / 10,
        radPathMatch: Math.round(radPathMatch * 10) / 10,
        peerReview,
      });
    }
  }
  return out.slice(0, records);
}

// ============================================================
// 2. 检查报告生成器 (统一报告池)
// ============================================================
export interface ExamReportRecord {
  reportId: string; // RPT-202606-00001
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: "男" | "女";
  modality: "CT" | "MR" | "DR" | "US" | "MG" | "DSA" | "PET-CT";
  examItem: string;
  examItemCode: string;
  bodyPart: string;
  deviceId: string;
  deviceModel: string;
  doctorId: string; // 检查医生 (技师)
  reportDoctorId: string; // 报告医生
  reviewDoctorId: string | null; // 审核医生
  cosignDoctorId: string | null; // 双签医生
  icd10: string;
  clinicalDiagnosis: string;
  // 报告内容
  findings: string; // 检查所见
  impression: string; // 诊断意见
  // 时间
  examAt: string;
  reportAt: string;
  reviewedAt: string | null;
  signedAt: string | null;
  // 状态
  status: "draft" | "submitted" | "reviewed" | "cosigned" | "published";
  priority: "急诊" | "加急" | "普通" | "体检";
  // 质控
  defectCount: number;
  qcScore: number; // 0-100
  hasCriticalValue: boolean;
  criticalValueType: string | null;
}

const FINDINGS_TEMPLATES = [
  "{bodyPart}扫描示{size}占位, 边界{boundary}, 内部{texture}, 增强后{enhancement}。周围组织{env}。未见明显{neg}。",
  "{bodyPart}结构{normal}, 未见明显{neg}。{vessels}。",
  "双侧{bilateral}{bodyPart}对称, {normal}。",
  "{bodyPart}{lesion}范围约{size}cm, CT值约{ct}HU, 边界{boundary}。",
  "{bodyPart}MR平扫+增强示{lesion}, T1WI呈{T1}信号, T2WI呈{T2}信号, 增强后{enhancement}。",
  "{bodyPart}造影显示{size}管壁{wall}斑块形成, 管腔狭窄约{stenosis}%, 远端血流TIMI{flow}级。",
  "{bodyPart}各房室{normal}, 室壁厚度{wall}mm, {contractility}。",
  "{bodyPart}管壁{wall}, 内中膜厚度约{size}mm, 管腔内{lesion}, 彩色多普勒示血流{flow}。",
  "{bodyPart}腺体{texture}, 可见{size}×{size2}cm{lesion}, 边界{boundary}, 内可见{calc}样钙化。增强后{enhancement}。",
  "{bodyPart}平扫+增强示{lesion}, 动脉期{enhancement}, 静脉期{neg}, 延迟期{neg}。",
  "{bodyPart}{lesion}呈分叶状, 有毛刺征, 临近胸膜{env}。",
  "{bodyPart}示{size}cm低密度影, CT值约{ct}HU, 增强后{enhancement}, 周围{env}。",
];

const IMPRESSIONS = [
  "{bodyPart}{diagnosis}, 建议随访。",
  "{bodyPart}{diagnosis}, 建议进一步检查。",
  "{bodyPart}未见明显异常。",
  "{bodyPart}{diagnosis}。",
  "符合{diagnosis}表现。",
  "{bodyPart}符合{diagnosis}的影像学表现, {suggest}。",
  "{bodyPart}{diagnosis}, BI-RADS{birads}类, 建议{followup}。",
  "{bodyPart}{diagnosis}, 建议结合临床。",
  "与{dayago}日老片比较, {diagnosis}, 病变{progress}。",
  "{bodyPart}{diagnosis}, {suggest}。",
];

const MODALITY_WEIGHTS: { modality: ExamReportRecord["modality"]; weight: number }[] = [
  { modality: "CT", weight: 35 },
  { modality: "DR", weight: 30 },
  { modality: "MR", weight: 15 },
  { modality: "US", weight: 15 },
  { modality: "MG", weight: 3 },
  { modality: "DSA", weight: 1.5 },
  { modality: "PET-CT", weight: 0.5 },
];

function pickModality(): ExamReportRecord["modality"] {
  const totalWeight = MODALITY_WEIGHTS.reduce((s, m) => s + m.weight, 0);
  let r = rand() * totalWeight;
  for (const m of MODALITY_WEIGHTS) {
    r -= m.weight;
    if (r <= 0) return m.modality;
  }
  return MODALITY_WEIGHTS[MODALITY_WEIGHTS.length - 1]!.modality;
}

function fillTemplate(t: string, vars: Record<string, string>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => vars[k] || "");
}

export function generateExamReport(records: number, daysAgo: number = 180, seed?: number): ExamReportRecord[] {
  if (seed !== undefined) seedRandom(seed);
  const out: ExamReportRecord[] = [];
  const doctorsReport = DOCTORS_BY_TITLE["主治医师"].concat(DOCTORS_BY_TITLE["副主任医师"]).concat(DOCTORS_BY_TITLE["主任医师"]);
  const doctorsReview = DOCTORS_BY_TITLE["副主任医师"].concat(DOCTORS_BY_TITLE["主任医师"]);
  const doctorsCosign = DOCTORS_BY_TITLE["主任医师"];
  const techs = DOCTORS_BY_TITLE["技师"];

  for (let i = 0; i < records; i++) {
    const modality = pickModality();
    const patientPool = PATIENTS_BY_MODALITY[modality];
    const patient = patientPool.length > 0 ? pick(patientPool) : PATIENT_MASTER[0]!;
    const examItem = EXAMS_BY_MODALITY[modality].length > 0 ? pick(EXAMS_BY_MODALITY[modality]) : null;
    const devicePool = DEVICES_BY_MODALITY[modality];
    const device = devicePool.length > 0 ? pick(devicePool) : null;
    const tech = pick(techs);
    const reportDoctor = pick(doctorsReport);
    const reviewDoctor = chance(0.5) ? pick(doctorsReview) : null;
    const cosignDoctor = reviewDoctor && chance(0.4) ? pick(doctorsCosign) : null;

    const examDayAgo = Math.floor(rand() * daysAgo);
    const reportDelay = randInt(30, 240);
    const reviewDelay = randInt(60, 360);
    const signDelay = randInt(120, 600);
    const examAt = timeAgo(examDayAgo, randInt(8, 18), randInt(0, 59));
    const reportAt = new Date(new Date(examAt).getTime() + reportDelay * 60000).toISOString();
    const reviewedAt = reviewDoctor ? new Date(new Date(reportAt).getTime() + reviewDelay * 60000).toISOString() : null;
    const signedAt = cosignDoctor ? new Date(new Date(reviewedAt!).getTime() + signDelay * 60000).toISOString() : null;
    const status: ExamReportRecord["status"] = signedAt ? "published" : reviewedAt ? (cosignDoctor ? "cosigned" : "reviewed") : "submitted";
    const hasCritical = chance(0.02 + rand() * 0.02);
    const defectCount = chance(0.15) ? randInt(1, 3) : 0;

    const findings = fillTemplate(pick(FINDINGS_TEMPLATES), {
      bodyPart: patient.bodyPart,
      size: `${randInt(1, 5)}.${randInt(0, 9)}×${randInt(1, 4)}.${randInt(0, 9)}`,
      size2: `${randInt(1, 3)}.${randInt(0, 9)}`,
      boundary: pick(["清楚", "欠清", "不规则", "分叶状"]),
      texture: pick(["均匀", "不均匀", "囊实性", "混合回声", "纤维腺体"]),
      enhancement: pick(["明显强化", "轻度强化", "环形强化", "未见明显强化", "不均匀强化", "渐进性强化"]),
      env: pick(["无受侵", "受压移位", "粘连", "牵拉", "侵犯"]),
      neg: pick(["占位", "出血", "积液", "梗阻", "狭窄", "钙化"]),
      normal: pick(["形态正常", "密度均匀", "信号均匀", "未见异常信号", "结构清晰"]),
      vessels: pick(["血管走行自然", "未见狭窄", "未见充盈缺损", "血流信号丰富", "血流信号稀疏"]),
      bilateral: pick(["", "双侧", "对称"]),
      lesion: pick(["异常信号", "占位", "结节", "斑片", "肿块", "钙化灶", "囊性灶"]),
      ct: `${randInt(20, 80)}`,
      T1: pick(["低", "等", "高", "混杂"]),
      T2: pick(["低", "等", "高", "混杂"]),
      stenosis: `${randInt(25, 95)}`,
      flow: pick(["0", "1", "2", "3"]),
      wall: pick(["光滑", "不光滑", "增厚", "钙化", "软"]),
      contractility: pick(["室壁运动正常", "节段性室壁运动异常", "室壁运动弥漫性减低", "室壁运动增强"]),
      calc: pick(["沙砾样", "粗大", "爆米花样", "环形"]),
    });
    const impression = fillTemplate(pick(IMPRESSIONS), {
      bodyPart: patient.bodyPart,
      diagnosis: pick(["占位性病变", "炎性改变", "退行性变", "未见明显异常", "考虑为肿瘤性病变", "考虑为血管性病变", "考虑为感染性病变", "冠心病", "动脉硬化", "狭窄性病变"]),
      suggest: pick(["建议随访复查", "建议增强扫描进一步检查", "建议穿刺活检", "建议临床干预", "建议抗炎治疗后复查", "建议定期随访"]),
      followup: pick(["短期复查(3月)", "定期随访(6月)", "年度复查", "进一步检查"]),
      birads: pick(["0", "1", "2", "3", "4A", "4B", "4C", "5"]),
      dayago: `${randInt(3, 180)}`,
      progress: pick(["无明显变化", "较前增大", "较前缩小", "部分吸收", "进展", "好转"]),
    });

    out.push({
      reportId: `RPT-${isoDate(examDayAgo).replace(/-/g, "")}-${String(i + 1).padStart(5, "0")}`,
      patientId: patient.id,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      modality,
      examItem: examItem?.name || "未指定",
      examItemCode: examItem?.code || "",
      bodyPart: patient.bodyPart,
      deviceId: device?.id || "",
      deviceModel: device?.model || "",
      doctorId: tech.id,
      reportDoctorId: reportDoctor.id,
      reviewDoctorId: reviewDoctor?.id || null,
      cosignDoctorId: cosignDoctor?.id || null,
      icd10: patient.icd10,
      clinicalDiagnosis: patient.clinicalDiagnosis,
      findings,
      impression,
      examAt,
      reportAt,
      reviewedAt,
      signedAt,
      status,
      priority: patient.priority,
      defectCount,
      qcScore: 80 + Math.floor(rand() * 20),
      hasCriticalValue: hasCritical,
      criticalValueType: hasCritical ? pick(["肺栓塞", "主动脉夹层", "气胸", "脑出血", "急性心肌梗死", "消化道穿孔", "急性脑梗死", "主动脉瘤破裂", "心脏压塞", "急性冠脉闭塞"]) : null,
    });
  }
  return out;
}

// ============================================================
// 3. 质控评分生成器
// ============================================================
export interface QualityScoreRecord {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  doctorId: string;
  doctorName: string;
  reviewerId: string;
  reviewerName: string;
  // 15 维度评分
  dimensions: {
    completeness: number; // 完整性
    accuracy: number; // 准确性
    timeliness: number; // 及时性
    terminology: number; // 术语规范
    structure: number; // 结构规范
    measurement: number; // 测量准确
    comparison: number; // 对比分析
    conclusion: number; // 结论规范
    signature: number; // 签名规范
    images: number; // 图像质量
    radiation: number; // 辐射防护
    contrast: number; // 对比剂使用
    privacy: number; // 隐私保护
    critical: number; // 危急值
    followUp: number; // 随访建议
  };
  totalScore: number;
  grade: "A+" | "A" | "B+" | "B" | "C" | "D";
  reviewedAt: string;
  defects: string[]; // 缺陷代码列表
  comments: string;
}

const DEFECT_CODES = ["DSC-001", "DSC-002", "FMT-001", "FMT-002", "LOG-001", "TIM-001", "TER-001", "IMG-001", "MEAS-001"];

export function generateQualityScore(records: number, daysAgo: number = 90): QualityScoreRecord[] {
  const out: QualityScoreRecord[] = [];
  const reports = generateExamReport(records, daysAgo);
  const reviewers = DOCTORS_BY_TITLE["副主任医师"].concat(DOCTORS_BY_TITLE["主任医师"]);

  for (let i = 0; i < reports.length; i++) {
    const r = reports[i]!;
    const reviewer = pick(reviewers);
    const dim = {
      completeness: 12 + randInt(0, 8),
      accuracy: 18 + randInt(0, 12),
      timeliness: 8 + randInt(0, 7),
      terminology: 6 + randInt(0, 4),
      structure: 6 + randInt(0, 4),
      measurement: 6 + randInt(0, 4),
      comparison: 5 + randInt(0, 5),
      conclusion: 10 + randInt(0, 5),
      signature: 4 + randInt(0, 2),
      images: 6 + randInt(0, 4),
      radiation: 4 + randInt(0, 2),
      contrast: 4 + randInt(0, 2),
      privacy: 4 + randInt(0, 2),
      critical: 6 + randInt(0, 4),
      followUp: 3 + randInt(0, 3),
    };
    const total = Object.values(dim).reduce((s, v) => s + v, 0);
    const grade: QualityScoreRecord["grade"] = total >= 95 ? "A+" : total >= 90 ? "A" : total >= 85 ? "B+" : total >= 80 ? "B" : total >= 70 ? "C" : "D";
    const defects = chance(0.3) ? pickN(DEFECT_CODES, randInt(1, 3)) : [];
    out.push({
      id: `QS-${String(i + 1).padStart(6, "0")}`,
      reportId: r.reportId,
      patientName: r.patientName,
      modality: r.modality,
      bodyPart: r.bodyPart,
      doctorId: r.reportDoctorId,
      doctorName: DOCTOR_MASTER.find((d) => d.id === r.reportDoctorId)?.name || "",
      reviewerId: reviewer.id,
      reviewerName: reviewer.name,
      dimensions: dim,
      totalScore: total,
      grade,
      reviewedAt: r.reviewedAt || r.reportAt,
      defects,
      comments: defects.length > 0 ? "存在 " + defects.join("、") + " 缺陷, 建议改进" : "报告规范, 符合质控要求",
    });
  }
  return out;
}

// ============================================================
// 4. 危急值事件生成器
// ============================================================
export interface CriticalValueEvent {
  id: string; // CVE-202606-00001
  patientId: string;
  patientName: string;
  patientAge: number;
  patientGender: "男" | "女";
  modality: string;
  examItem: string;
  deviceId: string;
  // 危急值
  category: "神经系统" | "心血管系统" | "呼吸系统" | "消化系统" | "创伤" | "儿科" | "产科" | "介入";
  value: string; // 危急值描述
  valueType: "影像表现" | "测量值" | "对比剂反应" | "设备异常";
  // 时间
  discoveredAt: string; // 发现时间
  notifiedAt: string; // 通知时间
  acknowledgedAt: string; // 接收时间
  processedAt: string; // 处理时间
  closedAt: string | null;
  // 责任
  discoverDoctorId: string; // 发现医生
  notifyDoctorId: string; // 通知医生
  receiverDoctorId: string; // 接收医生
  clinicalDoctorId: string; // 临床医生
  // 状态
  status: "已发现" | "已通知" | "已接收" | "已处理" | "已闭环";
  // SLA
  notifyDurationMin: number; // 通知耗时 (分钟)
  ackDurationMin: number;
  processDurationMin: number;
  totalDurationMin: number;
  slaMet: boolean;
  // 元
  outcome: "住院" | "手术" | "门诊处理" | "随访" | "转院" | "死亡" | null;
  notes: string;
}

const CRITICAL_CATEGORIES: { category: CriticalValueEvent["category"]; values: string[] }[] = [
  {
    category: "神经系统",
    values: ["急性大面积脑梗死", "脑出血破入脑室", "颅内动脉瘤", "脑疝形成", "急性硬膜外血肿", "急性硬膜下血肿", "脑干出血", "大脑中动脉闭塞"],
  },
  {
    category: "心血管系统",
    values: ["急性主动脉夹层", "急性心肌梗死", "肺动脉栓塞", "心脏压塞", "主动脉瘤破裂先兆", "急性冠脉闭塞"],
  },
  {
    category: "呼吸系统",
    values: ["张力性气胸", "大量胸腔积液", "急性呼吸窘迫综合征", "气管支气管异物", "急性肺脓肿破裂"],
  },
  {
    category: "消化系统",
    values: ["消化道穿孔", "急性肠梗阻", "急性化脓性胆管炎", "急性坏死性胰腺炎", "肝脾破裂", "肠系膜血管栓塞", "消化道大出血"],
  },
  {
    category: "创伤",
    values: ["脊柱骨折伴脊髓损伤", "骨盆骨折", "多发肋骨骨折伴血气胸", "腹腔脏器破裂", "颅底骨折", "四肢离断伤"],
  },
  {
    category: "儿科",
    values: ["新生儿气胸", "先天性膈疝", "婴幼儿肠套叠", "颅内出血(新生儿)", "气管异物(儿童)"],
  },
  {
    category: "产科",
    values: ["异位妊娠破裂", "胎盘早剥", "前置胎盘大出血", "子宫破裂", "脐带脱垂", "胎儿窘迫"],
  },
  {
    category: "介入",
    values: ["术中大出血", "对比剂过敏性休克", "血管夹层", "栓塞剂异位", "假性动脉瘤"],
  },
];

export function generateCriticalValueEvents(records: number, daysAgo: number = 30): CriticalValueEvent[] {
  const out: CriticalValueEvent[] = [];
  const reportDoctors = DOCTORS_BY_TITLE["主治医师"].concat(DOCTORS_BY_TITLE["副主任医师"]).concat(DOCTORS_BY_TITLE["主任医师"]);
  const reviewers = DOCTORS_BY_TITLE["副主任医师"].concat(DOCTORS_BY_TITLE["主任医师"]);

  for (let i = 0; i < records; i++) {
    // 优先选择急诊/重症患者
    let patient: typeof PATIENT_MASTER[number];
    if (i < records * 0.3) {
      const emergencyPool = PATIENT_MASTER.filter((p) => p.priority === "急诊" || p.priority === "加急");
      patient = pick(emergencyPool.length > 0 ? emergencyPool : PATIENT_MASTER);
    } else {
      patient = pick(PATIENT_MASTER);
    }
    const catData = pick(CRITICAL_CATEGORIES);
    const value = pick(catData.values);
    const valueType: CriticalValueEvent["valueType"] = pick(["影像表现", "测量值", "对比剂反应", "设备异常"]);

    // 时间轴
    const discoveredDayAgo = Math.floor(rand() * daysAgo);
    const discoverHour = randInt(0, 23);
    const discoverMin = randInt(0, 59);
    const discoveredAt = timeAgo(discoveredDayAgo, discoverHour, discoverMin);
    const discoverTime = new Date(discoveredAt).getTime();
    const notifyDuration = randInt(2, 12); // 危急值通知应在 10 分钟内
    const ackDuration = randInt(1, 30);
    const processDuration = randInt(5, 60);
    const totalDuration = notifyDuration + ackDuration + processDuration;
    const notifyTime = discoverTime + notifyDuration * 60000;
    const ackTime = notifyTime + ackDuration * 60000;
    const processTime = ackTime + processDuration * 60000;
    const closed = chance(0.7) ? processTime + randInt(15, 90) * 60000 : null;

    const discoverDoctor = pick(reportDoctors);
    const notifyDoctor = discoverDoctor;
    const receiverDoctor = pick(reviewers);
    const clinicalDoctorId = `D${String(randInt(0, 75) + 1).padStart(3, "0")}`;

    const slaMet = notifyDuration <= 10; // 10 分钟内通知
    const outcome: CriticalValueEvent["outcome"] = closed
      ? pick(["住院", "手术", "门诊处理", "随访", "转院", "死亡"])
      : null;

    out.push({
      id: `CVE-2026${String(6 - Math.floor(discoveredDayAgo / 30) || 0).padStart(2, "0")}-${String(i + 1).padStart(5, "0")}`,
      patientId: patient.id,
      patientName: patient.name,
      patientAge: patient.age,
      patientGender: patient.gender,
      modality: patient.modality,
      examItem: patient.examItem,
      deviceId: "",
      category: catData.category,
      value,
      valueType,
      discoveredAt,
      notifiedAt: new Date(notifyTime).toISOString(),
      acknowledgedAt: new Date(ackTime).toISOString(),
      processedAt: new Date(processTime).toISOString(),
      closedAt: closed ? new Date(closed).toISOString() : null,
      discoverDoctorId: discoverDoctor.id,
      notifyDoctorId: notifyDoctor.id,
      receiverDoctorId: receiverDoctor.id,
      clinicalDoctorId,
      status: closed ? "已闭环" : processTime > Date.now() ? "已处理" : "已接收",
      notifyDurationMin: notifyDuration,
      ackDurationMin: ackDuration,
      processDurationMin: processDuration,
      totalDurationMin: totalDuration,
      slaMet,
      outcome,
      notes: valueType === "对比剂反应" ? "已给予地塞米松 10mg 静推" : "已通知临床",
    });
  }
  return out.sort((a, b) => b.discoveredAt.localeCompare(a.discoveredAt));
}

// ============================================================
// 5. 双签任务生成器
// ============================================================
export interface CosignTask {
  id: string;
  reportId: string;
  patientId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  // 触发
  triggerReason: "junior_author" | "critical_value" | "special_exam" | "vip_patient" | "complex_case" | "low_quality";
  priority: "急诊" | "加急" | "普通" | "体检";
  // 责任
  authorId: string; // 主写医生
  authorName: string;
  cosignerId: string; // 双签医生
  cosignerName: string;
  // 时间
  submittedAt: string;
  cosignedAt: string | null;
  deadline: string;
  // SLA
  slaMinutes: number;
  elapsedMinutes: number;
  overdue: boolean;
  // 状态
  status: "待签" | "已签" | "已拒" | "撤回" | "已转签" | "已催办";
  // 元
  rejectReason: string | null;
  reminderCount: number;
  complexity: "低" | "中" | "高" | "极高";
  triggerDetails: string;
}

export function generateCosignTasks(records: number, daysAgo: number = 7): CosignTask[] {
  const out: CosignTask[] = [];DOCTORS_BY_TITLE["住院医师"].concat(DOCTORS_BY_TITLE["主治医师"]);
  const seniors = DOCTORS_BY_TITLE["副主任医师"].concat(DOCTORS_BY_TITLE["主任医师"]);
  const now = Date.now();
  const reportDoctors = DOCTORS_BY_TITLE["住院医师"].concat(DOCTORS_BY_TITLE["主治医师"]);

  for (let i = 0; i < records; i++) {
    const patient = pick(PATIENT_MASTER);
    const trigger = pick<CosignTask["triggerReason"]>(["junior_author", "critical_value", "special_exam", "vip_patient", "complex_case", "low_quality"]);
    const author = pick(reportDoctors);
    const cosigner = pick(seniors);
    const dayAgo = Math.floor(rand() * daysAgo);
    const submittedAt = timeAgo(dayAgo, randInt(8, 18), randInt(0, 59));
    const submitTime = new Date(submittedAt).getTime();
    // SLA 急诊 30min 普通 240min 加急 60min
    const sla = patient.priority === "急诊" ? 30 : patient.priority === "加急" ? 60 : 240;
    const deadline = new Date(submitTime + sla * 60000).toISOString();
    const elapsed = Math.floor((now - submitTime) / 60000);
    const overdue = elapsed > sla;
    const signed = chance(0.7) && !overdue;
    const cosignedAt = signed ? new Date(submitTime + Math.min(elapsed, sla - 5) * 60000).toISOString() : null;
    const status: CosignTask["status"] = cosignedAt ? "已签" : overdue ? pick(["待签", "已催办", "已拒"] as CosignTask["status"][]) : pick(["待签", "已催办"] as CosignTask["status"][]);

    out.push({
      id: `CSIGN-${String(i + 1).padStart(6, "0")}`,
      reportId: `RPT-${patient.registeredAt.slice(0, 10).replace(/-/g, "")}-${String(i + 1).padStart(5, "0")}`,
      patientId: patient.id,
      patientName: patient.name,
      modality: patient.modality,
      bodyPart: patient.bodyPart,
      triggerReason: trigger,
      priority: patient.priority,
      authorId: author.id,
      authorName: author.name,
      cosignerId: cosigner.id,
      cosignerName: cosigner.name,
      submittedAt,
      cosignedAt,
      deadline,
      slaMinutes: sla,
      elapsedMinutes: elapsed,
      overdue,
      status,
      rejectReason: status === "已拒" ? pick(["报告依据不足", "诊断需补充", "影像质量不达标"]) : null,
      reminderCount: Math.floor(elapsed / 60),
      complexity: pick(["低", "中", "高", "极高"]),
      triggerDetails: trigger === "junior_author" ? "住院医师初写报告" : trigger === "critical_value" ? "报告涉及危急值" : trigger === "special_exam" ? "特殊检查需高年资审核" : trigger === "vip_patient" ? "VIP 患者报告" : trigger === "complex_case" ? "复杂病例" : "AI 预审低分",
    });
  }
  return out;
}

// ============================================================
// 6. 30 天 KPI 时序生成器
// ============================================================
export interface RadiologyKPIDaily {
  date: string; // yyyy-mm-dd
  examCount: number;
  reportCount: number;
  criticalCount: number;
  cosignCount: number;
  avgTAT: number;
  defectCount: number;
  qcAvgScore: number;
  // 按模态
  byModality: { CT: number; MR: number; DR: number; US: number; MG: number; DSA: number; "PET-CT": number; 介入: number };
  // 按设备
  topDevices: { deviceId: string; count: number }[];
}

export function generateDailyKPI(days: number = 30): RadiologyKPIDaily[] {
  const out: RadiologyKPIDaily[] = [];
  for (let d = 0; d < days; d++) {
    const date = new Date(NOW.getTime() - (days - d - 1) * DAY);
    const dayOfWeek = date.getDay();
    // 周末量少
    const weekendFactor = dayOfWeek === 0 || dayOfWeek === 6 ? 0.6 : 1.0;
    const baseExam = 800 * weekendFactor;
    const examCount = Math.round(baseExam + (rand() - 0.5) * 200);
    const reportCount = Math.round(examCount * 0.98);
    const criticalCount = Math.round(examCount * 0.05);
    const cosignCount = Math.round(reportCount * 0.3);
    const avgTAT = 180 + Math.floor(rand() * 60);
    const defectCount = Math.round(reportCount * 0.02);
    const qcAvgScore = 85 + rand() * 5;
    const byModality = {
      CT: Math.round(examCount * 0.28),
      MR: Math.round(examCount * 0.19),
      DR: Math.round(examCount * 0.28),
      US: Math.round(examCount * 0.14),
      MG: Math.round(examCount * 0.03),
      DSA: Math.round(examCount * 0.02),
      "PET-CT": Math.round(examCount * 0.03),
      介入: Math.round(examCount * 0.03),
    };
    // 排前面
    const topDevices = DEVICE_MASTER
      .map((d) => ({ deviceId: d.id, count: Math.round(d.monthlyScans / 30 * (0.8 + rand() * 0.4)) }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    out.push({
      date: date.toISOString().split("T")[0]!,
      examCount,
      reportCount,
      criticalCount,
      cosignCount,
      avgTAT,
      defectCount,
      qcAvgScore: Math.round(qcAvgScore * 10) / 10,
      byModality,
      topDevices,
    });
  }
  return out;
}

// 工具: 重新导出
export { pickDoctors, pickPatients, pickByModality } from "../master";
