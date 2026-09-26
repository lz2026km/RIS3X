/**
 * G005 放射RIS v3.0.6.12 - AI 平台 / 工作流概念数据引擎 (确定性模拟)
 * W4-AI-A
 *
 * 本文件为纯数据层: 不依赖 React / antd, 不产生副作用。
 * 全部指标均由模型 / 检查 ID 的种子确定性生成 (mulberry32 + FNV-1a),
 * 页面刷新、重挂载结果完全一致, 无 Math.random。
 *
 * 说明: 所有数值为演示用模拟值, 非真实模型推理结果, UI 明确标注「AI 辅助 (模拟)」。
 */

/* ------------------------------------------------------------------ */
/* 确定性随机数工具                                                    */
/* ------------------------------------------------------------------ */

/** FNV-1a 字符串哈希 → uint32 */
export function hashString(input: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32 PRNG: 给定种子返回 [0,1) 序列 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 由 key 派生的确定性 [0,1) 取值 */
export function seededUnit(key: string): number {
  return mulberry32(hashString(key))();
}

const clamp = (v: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, v));

const round1 = (v: number): number => Math.round(v * 10) / 10;
const round2 = (v: number): number => Math.round(v * 100) / 100;
const round3 = (v: number): number => Math.round(v * 1000) / 1000;

/* ------------------------------------------------------------------ */
/* 模型注册表 / 市场                                                   */
/* ------------------------------------------------------------------ */

export type AiVendorKey = "shukun" | "yizhun" | "inhouse";
export type AiModelStatus = "deployed" | "gray" | "offline";
export type AiModality = "CT" | "MR" | "DR" | "MG" | "US" | "PET";

export interface AiModelMetrics {
  /** 准确率 0-100 */
  accuracy: number;
  /** 灵敏度 0-100 */
  sensitivity: number;
  /** 特异度 0-100 */
  specificity: number;
  /** 审核通过率 0-100 */
  approvalRate: number;
  /** AUC 0-1 */
  auc: number;
  /** 医师一致性 0-100 */
  consistency: number;
}

export interface AiModelRegulatory {
  ce: boolean;
  ceClass: string;
  fda: boolean;
  nmpa: boolean;
}

export interface AiModelVersion {
  version: string;
  releasedAt: string;
  metrics: AiModelMetrics;
  note: string;
  noteEn: string;
}

export interface AiModelEntry {
  id: string;
  name: string;
  nameEn: string;
  indication: string;
  indicationEn: string;
  modality: AiModality[];
  vendor: AiVendorKey;
  version: string;
  status: AiModelStatus;
  metrics: AiModelMetrics;
  updatedAt: string;
  trainingSet: string;
  trainingSetEn: string;
  regulatory: AiModelRegulatory;
  validationReport: string;
  validationReportEn: string;
  /** 本月调用量 */
  monthlyCalls: number;
  /** 版本历史 (新 → 旧), 用于版本对比 / 回滚 */
  versions: AiModelVersion[];
}

interface ModelBase {
  id: string;
  name: string;
  nameEn: string;
  indication: string;
  indicationEn: string;
  modality: AiModality[];
  vendor: AiVendorKey;
  status: AiModelStatus;
  version: string;
  updatedAt: string;
  trainingSet: string;
  trainingSetEn: string;
  regulatory: AiModelRegulatory;
  validationReport: string;
  validationReportEn: string;
  /** 指标基准档位 (影响确定性指标的取值范围) */
  tier: "high" | "mid" | "base";
}

const MODEL_BASE: ModelBase[] = [
  {
    id: "shukun-lung-nodule",
    name: "数坤肺结节智能分析",
    nameEn: "Shukun Lung Nodule AI",
    indication: "肺结节检出与 Lung-RADS 分级",
    indicationEn: "Pulmonary nodule detection & Lung-RADS grading",
    modality: ["CT"],
    vendor: "shukun",
    status: "deployed",
    version: "4.2.0",
    updatedAt: "2026-09-18",
    trainingSet: "12.4 万例胸部 CT (含 3.1 万例病理证实)",
    trainingSetEn: "124k chest CT (31k pathology-confirmed)",
    regulatory: { ce: true, ceClass: "IIa", fda: true, nmpa: true },
    validationReport: "多中心回顾性验证: 敏感性 96.8% / 特异度 94.1% (n=4,208)",
    validationReportEn: "Multi-center retrospective: sensitivity 96.8% / specificity 94.1% (n=4,208)",
    tier: "high",
  },
  {
    id: "shukun-stroke",
    name: "数坤卒中智能分诊",
    nameEn: "Shukun Stroke Triage",
    indication: "大血管闭塞 (LVO) / ASPECTS 评分",
    indicationEn: "Large vessel occlusion & ASPECTS scoring",
    modality: ["CT", "MR"],
    vendor: "shukun",
    status: "deployed",
    version: "3.1.0",
    updatedAt: "2026-09-21",
    trainingSet: "8.6 万例头颅 NCCT/CTA/CTP",
    trainingSetEn: "86k head NCCT/CTA/CTP studies",
    regulatory: { ce: true, ceClass: "IIb", fda: true, nmpa: true },
    validationReport: "急诊前瞻验证: 分诊平均耗时 38s, LVO 敏感度 97.2%",
    validationReportEn: "Prospective ED study: mean triage 38s, LVO sensitivity 97.2%",
    tier: "high",
  },
  {
    id: "shukun-coronary",
    name: "数坤冠脉 CTA 智能分析",
    nameEn: "Shukun Coronary CTA AI",
    indication: "冠脉狭窄定量 / CAD-RADS / FFR-CT",
    indicationEn: "Coronary stenosis quantification / CAD-RADS / FFR-CT",
    modality: ["CT"],
    vendor: "shukun",
    status: "gray",
    version: "2.8.0",
    updatedAt: "2026-09-12",
    trainingSet: "3.9 万例冠脉 CTA + 有创 FFR 金标准",
    trainingSetEn: "39k coronary CTA with invasive FFR reference",
    regulatory: { ce: true, ceClass: "IIb", fda: true, nmpa: true },
    validationReport: "血管水平验证: 狭窄分级一致率 91.4% (κ=0.87)",
    validationReportEn: "Per-vessel validation: stenosis agreement 91.4% (κ=0.87)",
    tier: "mid",
  },
  {
    id: "shukun-liver",
    name: "数坤肝脏病变智能分析",
    nameEn: "Shukun Liver Lesion AI",
    indication: "肝占位检出 / LI-RADS 分类 / 体积测量",
    indicationEn: "Liver lesion detection / LI-RADS / volumetry",
    modality: ["CT", "MR"],
    vendor: "shukun",
    status: "deployed",
    version: "2.5.1",
    updatedAt: "2026-09-09",
    trainingSet: "5.2 万例腹部增强 CT/MR",
    trainingSetEn: "52k contrast-enhanced abdomen CT/MR",
    regulatory: { ce: true, ceClass: "IIa", fda: false, nmpa: true },
    validationReport: "病灶水平验证: 检出率 93.6%, 体积误差 ≤ 4.8%",
    validationReportEn: "Per-lesion validation: detection 93.6%, volume error ≤ 4.8%",
    tier: "mid",
  },
  {
    id: "shukun-rib",
    name: "数坤肋骨骨折智能检出",
    nameEn: "Shukun Rib Fracture AI",
    indication: "肋骨骨折定位与分型",
    indicationEn: "Rib fracture localization & classification",
    modality: ["CT"],
    vendor: "shukun",
    status: "deployed",
    version: "1.9.0",
    updatedAt: "2026-08-28",
    trainingSet: "2.7 万例胸部 CT 骨重建",
    trainingSetEn: "27k chest CT bone reconstruction",
    regulatory: { ce: true, ceClass: "IIa", fda: false, nmpa: true },
    validationReport: "骨折水平: 敏感度 91.3%, 假阳性 0.42 处/例",
    validationReportEn: "Per-fracture: sensitivity 91.3%, FP 0.42/study",
    tier: "mid",
  },
  {
    id: "yizhun-pe",
    name: "医准肺栓塞智能预警",
    nameEn: "Yizhun Pulmonary Embolism AI",
    indication: "CTPA 肺栓塞检出 / 右心负荷评估",
    indicationEn: "CTPA PE detection & RV strain assessment",
    modality: ["CT"],
    vendor: "yizhun",
    status: "deployed",
    version: "3.0.2",
    updatedAt: "2026-09-19",
    trainingSet: "6.1 万例 CTPA (含 1.2 万阳性)",
    trainingSetEn: "61k CTPA (12k positive)",
    regulatory: { ce: true, ceClass: "IIa", fda: true, nmpa: true },
    validationReport: "前瞻验证: 敏感度 96.5%, 分诊时间中位数 41s",
    validationReportEn: "Prospective: sensitivity 96.5%, median triage 41s",
    tier: "high",
  },
  {
    id: "yizhun-pneumothorax",
    name: "医准气胸智能分诊",
    nameEn: "Yizhun Pneumothorax Triage",
    indication: "气胸 / 张力性气胸快速预警",
    indicationEn: "Pneumothorax / tension pneumothorax alert",
    modality: ["DR", "CT"],
    vendor: "yizhun",
    status: "deployed",
    version: "2.2.0",
    updatedAt: "2026-09-05",
    trainingSet: "9.8 万例胸部 DR/CT",
    trainingSetEn: "98k chest DR/CT",
    regulatory: { ce: true, ceClass: "IIa", fda: true, nmpa: false },
    validationReport: "急诊队列: 敏感度 95.1%, 平均报告前预警 6.4min",
    validationReportEn: "ED cohort: sensitivity 95.1%, pre-read alert 6.4min",
    tier: "high",
  },
  {
    id: "yizhun-ich",
    name: "医准颅内出血智能检出",
    nameEn: "Yizhun Intracranial Hemorrhage AI",
    indication: "颅内出血分型 / 体积 / 中线移位",
    indicationEn: "ICH subtyping / volume / midline shift",
    modality: ["CT"],
    vendor: "yizhun",
    status: "deployed",
    version: "3.4.0",
    updatedAt: "2026-09-23",
    trainingSet: "7.4 万例头颅 NCCT",
    trainingSetEn: "74k non-contrast head CT",
    regulatory: { ce: true, ceClass: "IIa", fda: true, nmpa: true },
    validationReport: "验证集: 敏感度 97.8%, 特异度 95.2%, 体积 ICC=0.94",
    validationReportEn: "Validation: sens 97.8%, spec 95.2%, volume ICC=0.94",
    tier: "high",
  },
  {
    id: "yizhun-breast",
    name: "医准乳腺钼靶智能分析",
    nameEn: "Yizhun Mammography AI",
    indication: "钙化 / 肿块检出与 BI-RADS 分级",
    indicationEn: "Calcification / mass detection & BI-RADS",
    modality: ["MG"],
    vendor: "yizhun",
    status: "gray",
    version: "2.0.0",
    updatedAt: "2026-08-30",
    trainingSet: "4.5 万例乳腺钼靶 / DBT",
    trainingSetEn: "45k mammography / DBT",
    regulatory: { ce: true, ceClass: "IIa", fda: true, nmpa: false },
    validationReport: "筛查队列: 召回率 88.2%, 敏感度 90.6%",
    validationReportEn: "Screening cohort: recall 88.2%, sensitivity 90.6%",
    tier: "mid",
  },
  {
    id: "yizhun-boneage",
    name: "医准骨龄智能评估",
    nameEn: "Yizhun Bone Age AI",
    indication: "儿童骨龄评估 (GP / TW3)",
    indicationEn: "Pediatric bone age (GP / TW3)",
    modality: ["DR"],
    vendor: "yizhun",
    status: "offline",
    version: "1.6.0",
    updatedAt: "2026-07-22",
    trainingSet: "1.8 万例左手骨龄片",
    trainingSetEn: "18k left-hand X-ray",
    regulatory: { ce: false, ceClass: "-", fda: false, nmpa: true },
    validationReport: "与放射科医师平均偏差 0.42 岁",
    validationReportEn: "Mean deviation 0.42y vs radiologists",
    tier: "base",
  },
  {
    id: "inhouse-report",
    name: "自研多模态报告助手",
    nameEn: "In-house Multimodal Report Assistant",
    indication: "报告初稿生成 / RAG 引用 / 结构化",
    indicationEn: "Report drafting / RAG citation / structuring",
    modality: ["CT", "MR", "DR"],
    vendor: "inhouse",
    status: "deployed",
    version: "1.3.0",
    updatedAt: "2026-09-24",
    trainingSet: "院内在库 42 万份结构化报告 (脱敏) + 指南语料",
    trainingSetEn: "420k de-identified in-house reports + guidelines",
    regulatory: { ce: false, ceClass: "-", fda: false, nmpa: false },
    validationReport: "内部评测: 关键所见召回 92.1%, 采纳率 78.5%",
    validationReportEn: "Internal eval: key finding recall 92.1%, adoption 78.5%",
    tier: "mid",
  },
  {
    id: "inhouse-qc",
    name: "自研报告质控引擎",
    nameEn: "In-house Report QC Engine",
    indication: "缺陷检测 / 术语规范 / 危急值识别",
    indicationEn: "Defect detection / terminology / critical-value flags",
    modality: ["CT", "MR", "DR", "MG", "US", "PET"],
    vendor: "inhouse",
    status: "deployed",
    version: "1.2.0",
    updatedAt: "2026-09-20",
    trainingSet: "院内在库 38 万份报告 + 缺陷标注集",
    trainingSetEn: "380k in-house reports + defect annotations",
    regulatory: { ce: false, ceClass: "-", fda: false, nmpa: false },
    validationReport: "内部评测: 缺陷检出 F1 0.89, 危急值召回 96.4%",
    validationReportEn: "Internal eval: defect F1 0.89, critical recall 96.4%",
    tier: "mid",
  },
  {
    id: "inhouse-triage",
    name: "自研影像优先级分诊",
    nameEn: "In-house Imaging Triage",
    indication: "多病种优先级排序 / 阳性预警",
    indicationEn: "Multi-finding priority ranking / positivity alert",
    modality: ["CT", "DR"],
    vendor: "inhouse",
    status: "gray",
    version: "0.9.0",
    updatedAt: "2026-09-15",
    trainingSet: "院内 15 万例混合模态检查",
    trainingSetEn: "150k mixed-modality in-house exams",
    regulatory: { ce: false, ceClass: "-", fda: false, nmpa: false },
    validationReport: "灰度评测: 危重优先级命中率 87.3%",
    validationReportEn: "Gray eval: critical priority hit rate 87.3%",
    tier: "base",
  },
  {
    id: "inhouse-denoise",
    name: "自研低剂量智能降噪",
    nameEn: "In-house Low-dose Denoise",
    indication: "CT 低剂量图像降噪增强",
    indicationEn: "Low-dose CT denoising & enhancement",
    modality: ["CT"],
    vendor: "inhouse",
    status: "offline",
    version: "1.1.0",
    updatedAt: "2026-06-30",
    trainingSet: "2.1 万例配对高/低剂量 CT",
    trainingSetEn: "21k paired high/low-dose CT",
    regulatory: { ce: false, ceClass: "-", fda: false, nmpa: false },
    validationReport: "降噪后 SNR 提升 31%, 未见诊断信息丢失",
    validationReportEn: "SNR +31% post-denoise, no diagnostic loss",
    tier: "base",
  },
];

function tierBias(tier: ModelBase["tier"]): number {
  if (tier === "high") return 0.06;
  if (tier === "mid") return 0.02;
  return -0.01;
}

function deriveMetrics(seedKey: string, tier: ModelBase["tier"], offset = 0): AiModelMetrics {
  const rand = mulberry32(hashString(seedKey));
  const bias = tierBias(tier) - offset;
  const accuracy = clamp(0.885 + bias + rand() * 0.075, 0.8, 0.995);
  const sensitivity = clamp(accuracy + (rand() - 0.42) * 0.05, 0.8, 0.995);
  const specificity = clamp(accuracy + (rand() - 0.46) * 0.05, 0.8, 0.995);
  const approvalRate = clamp(0.79 + bias + rand() * 0.17, 0.6, 0.99);
  const auc = clamp(0.895 + bias + rand() * 0.085, 0.8, 0.999);
  const consistency = clamp(0.82 + bias + rand() * 0.14, 0.65, 0.99);
  return {
    accuracy: round1(accuracy * 100),
    sensitivity: round1(sensitivity * 100),
    specificity: round1(specificity * 100),
    approvalRate: round1(approvalRate * 100),
    auc: round3(auc),
    consistency: round1(consistency * 100),
  };
}

function previousVersion(version: string, step: number): string {
  const parts = version.split(".").map((p) => Number.parseInt(p, 10));
  const major = parts[0] ?? 1;
  const minor = parts[1] ?? 0;
  const patch = parts[2] ?? 0;
  const nextPatch = patch - step;
  if (nextPatch >= 0) return `${major}.${minor}.${nextPatch}`;
  return `${major}.${Math.max(0, minor - 1)}.9`;
}

function buildModel(base: ModelBase): AiModelEntry {
  const metrics = deriveMetrics(`${base.id}:current`, base.tier);
  const rand = mulberry32(hashString(`${base.id}:meta`));
  const monthlyCalls = 800 + Math.round(rand() * 42000);
  const versionCount = base.status === "offline" ? 2 : 3;
  const versions: AiModelVersion[] = [];
  for (let i = 0; i < versionCount; i += 1) {
    const v = i === 0 ? base.version : previousVersion(base.version, i);
    const vMetrics = i === 0 ? metrics : deriveMetrics(`${base.id}:v${v}`, base.tier, i * 0.012);
    versions.push({
      version: v,
      releasedAt: i === 0 ? base.updatedAt : `2026-0${Math.max(1, 8 - i)}-1${(i * 3) % 9}`,
      metrics: vMetrics,
      note: i === 0 ? "当前在线版本" : `历史版本 (回滚候选 ${i})`,
      noteEn: i === 0 ? "Current online version" : `Historical version (rollback candidate ${i})`,
    });
  }
  return {
    ...base,
    metrics,
    monthlyCalls,
    versions,
  };
}

/** 模型注册表 (确定性生成) */
export function getAiModelCatalog(): AiModelEntry[] {
  return MODEL_BASE.map(buildModel);
}

export interface RegistryStats {
  total: number;
  deployed: number;
  gray: number;
  offline: number;
  avgAccuracy: number;
  monthlyCalls: number;
}

export function computeRegistryStats(catalog: AiModelEntry[]): RegistryStats {
  const total = catalog.length;
  const deployed = catalog.filter((m) => m.status === "deployed").length;
  const gray = catalog.filter((m) => m.status === "gray").length;
  const offline = catalog.filter((m) => m.status === "offline").length;
  const avgAccuracy =
    total > 0
      ? round1(catalog.reduce((s, m) => s + m.metrics.accuracy, 0) / total)
      : 0;
  const monthlyCalls = catalog.reduce((s, m) => s + m.monthlyCalls, 0);
  return { total, deployed, gray, offline, avgAccuracy, monthlyCalls };
}

/* ------------------------------------------------------------------ */
/* AI 优先级分诊队列                                                   */
/* ------------------------------------------------------------------ */

export type TriagePriority = "CRITICAL" | "URGENT" | "SEMI" | "ROUTINE";
export type TriageStatus = "pending" | "reviewing" | "holded" | "adopted";
export type TriageSuggestionCode =
  | "LVO"
  | "PE"
  | "pneumothorax"
  | "hemorrhage"
  | "fracture"
  | "nodule"
  | "none";

export interface TriageQueueItem {
  id: string;
  patientName: string;
  patientNameEn: string;
  sex: "男" | "女";
  age: number;
  examNo: string;
  examItem: string;
  examItemEn: string;
  modality: string;
  bodyPart: string;
  arrivalAt: string;
  aiScore: number;
  priority: TriagePriority;
  suggestion: TriageSuggestionCode;
  suggestionPositive: boolean;
  confidence: number;
  status: TriageStatus;
  assignedDoctor: string | null;
}

interface TriageBase {
  patientName: string;
  patientNameEn: string;
  sex: "男" | "女";
  age: number;
  modality: string;
  bodyPart: string;
  examItem: string;
  examItemEn: string;
  suggestion: TriageSuggestionCode;
}

const TRIAGE_BASE: TriageBase[] = [
  { patientName: "王建国", patientNameEn: "Wang Jianguo", sex: "男", age: 68, modality: "CT", bodyPart: "头颅", examItem: "头颅 CT 平扫", examItemEn: "Head CT (non-contrast)", suggestion: "LVO" },
  { patientName: "李秀兰", patientNameEn: "Li Xiulan", sex: "女", age: 71, modality: "CT", bodyPart: "肺动脉", examItem: "CTPA 肺动脉", examItemEn: "CTPA pulmonary", suggestion: "PE" },
  { patientName: "张伟", patientNameEn: "Zhang Wei", sex: "男", age: 34, modality: "DR", bodyPart: "胸部", examItem: "胸部 DR 正位", examItemEn: "Chest DR PA", suggestion: "pneumothorax" },
  { patientName: "陈敏", patientNameEn: "Chen Min", sex: "女", age: 55, modality: "CT", bodyPart: "头颅", examItem: "头颅 CT 平扫", examItemEn: "Head CT (non-contrast)", suggestion: "hemorrhage" },
  { patientName: "刘洋", patientNameEn: "Liu Yang", sex: "男", age: 42, modality: "CT", bodyPart: "胸部", examItem: "胸部 CT 平扫", examItemEn: "Chest CT", suggestion: "pneumothorax" },
  { patientName: "赵丽", patientNameEn: "Zhao Li", sex: "女", age: 63, modality: "CT", bodyPart: "胸部", examItem: "胸部 CT 增强", examItemEn: "Chest CT contrast", suggestion: "nodule" },
  { patientName: "孙浩", patientNameEn: "Sun Hao", sex: "男", age: 29, modality: "MRI", bodyPart: "头颅", examItem: "头颅 MR 平扫", examItemEn: "Head MR", suggestion: "LVO" },
  { patientName: "周雪", patientNameEn: "Zhou Xue", sex: "女", age: 48, modality: "CT", bodyPart: "胸部", examItem: "胸部 CT 肋骨重建", examItemEn: "Chest CT rib recon", suggestion: "fracture" },
  { patientName: "吴强", patientNameEn: "Wu Qiang", sex: "男", age: 77, modality: "CT", bodyPart: "肺动脉", examItem: "CTPA 肺动脉", examItemEn: "CTPA pulmonary", suggestion: "PE" },
  { patientName: "郑楠", patientNameEn: "Zheng Nan", sex: "女", age: 38, modality: "DR", bodyPart: "胸部", examItem: "胸部 DR 正侧位", examItemEn: "Chest DR PA/lateral", suggestion: "pneumothorax" },
  { patientName: "冯军", patientNameEn: "Feng Jun", sex: "男", age: 59, modality: "CT", bodyPart: "头颅", examItem: "头颅 CT 灌注", examItemEn: "Head CT perfusion", suggestion: "LVO" },
  { patientName: "何静", patientNameEn: "He Jing", sex: "女", age: 66, modality: "CT", bodyPart: "胸部", examItem: "胸部 CT 平扫", examItemEn: "Chest CT", suggestion: "nodule" },
];

function priorityOf(score: number): TriagePriority {
  if (score >= 90) return "CRITICAL";
  if (score >= 78) return "URGENT";
  if (score >= 60) return "SEMI";
  return "ROUTINE";
}

export function getTriageQueue(): TriageQueueItem[] {
  return TRIAGE_BASE.map((base, index) => {
    const id = `triage-${String(index + 1).padStart(3, "0")}`;
    const rand = mulberry32(hashString(id));
    const raw = rand();
    const aiScore = Math.round(38 + raw * 60);
    const confidence = round1(clamp(58 + raw * 40, 40, 99));
    const positive = aiScore >= 62;
    const status: TriageStatus =
      index % 5 === 0 ? "holded" : index % 3 === 0 ? "reviewing" : index % 4 === 0 ? "adopted" : "pending";
    const hour = 7 + Math.floor(index / 2);
    const minute = (index * 13) % 60;
    return {
      id,
      patientName: base.patientName,
      patientNameEn: base.patientNameEn,
      sex: base.sex,
      age: base.age,
      examNo: `EX20260926${String(100 + index)}`,
      examItem: base.examItem,
      examItemEn: base.examItemEn,
      modality: base.modality,
      bodyPart: base.bodyPart,
      arrivalAt: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
      aiScore,
      priority: priorityOf(aiScore),
      suggestion: positive ? base.suggestion : "none",
      suggestionPositive: positive,
      confidence,
      status,
      assignedDoctor: index % 4 === 1 ? "D1008" : index % 4 === 2 ? "D1012" : null,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 审核 / 采纳统计 + 周趋势                                            */
/* ------------------------------------------------------------------ */

export interface ModelReviewStat {
  modelId: string;
  modelName: string;
  modelNameEn: string;
  reviewed: number;
  adoptRate: number;
  rejectRate: number;
  modifyRate: number;
  doctorConsistency: number;
}

export function getModelReviewStats(catalog: AiModelEntry[]): ModelReviewStat[] {
  return catalog.map((m) => {
    const rand = mulberry32(hashString(`${m.id}:review`));
    const adopt = 58 + rand() * 33;
    const modify = (100 - adopt) * (0.45 + rand() * 0.25);
    const reject = 100 - adopt - modify;
    return {
      modelId: m.id,
      modelName: m.name,
      modelNameEn: m.nameEn,
      reviewed: 120 + Math.round(rand() * 2600),
      adoptRate: round1(adopt),
      rejectRate: round1(Math.max(0, reject)),
      modifyRate: round1(modify),
      doctorConsistency: m.metrics.consistency,
    };
  });
}

export interface WeeklyTrendPoint {
  week: string;
  adopt: number;
  modify: number;
  reject: number;
}

/** 近 8 周采纳 / 修改 / 驳回趋势 (确定性) */
export function getWeeklyAdoptionTrend(seedKey = "platform"): WeeklyTrendPoint[] {
  const rand = mulberry32(hashString(`${seedKey}:weekly`));
  const points: WeeklyTrendPoint[] = [];
  for (let i = 0; i < 8; i += 1) {
    const base = 62 + i * 1.6;
    const adopt = clamp(base + (rand() - 0.5) * 10, 40, 96);
    const modify = clamp(22 + (rand() - 0.5) * 8 - i * 0.4, 4, 45);
    const reject = clamp(100 - adopt - modify, 1, 30);
    points.push({
      week: `W${i + 1}`,
      adopt: round1(adopt),
      modify: round1(modify),
      reject: round1(reject),
    });
  }
  return points;
}

/* ------------------------------------------------------------------ */
/* 质量控制: 出图体检 / 模型漂移 / 假阳假阴复核                         */
/* ------------------------------------------------------------------ */

export interface QcImageCheck {
  id: string;
  studyId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  /** 伪影 / 运动 / 曝光 问题分 (0-100, 越高越差) */
  artifact: number;
  motion: number;
  exposure: number;
  verdict: "pass" | "warn" | "fail";
  note: string;
  noteEn: string;
  checkedAt: string;
}

interface QcBase {
  patientName: string;
  modality: string;
  bodyPart: string;
  note: string;
  noteEn: string;
}

const QC_BASE: QcBase[] = [
  { patientName: "王建国", modality: "CT", bodyPart: "头颅", note: "颅底金属伪影, 建议双窗重建", noteEn: "Skull-base metal artifact; dual-window review advised" },
  { patientName: "李秀兰", modality: "CT", bodyPart: "肺动脉", note: "对比剂充盈欠佳, 上腔静脉高浓度伪影", noteEn: "Suboptimal contrast; SVC beam-hardening" },
  { patientName: "张伟", modality: "DR", bodyPart: "胸部", note: "吸气不足, 膈肌位置偏高", noteEn: "Insufficient inspiration; elevated diaphragm" },
  { patientName: "陈敏", modality: "CT", bodyPart: "头颅", note: "轻微运动伪影, 不影响诊断", noteEn: "Mild motion artifact; non-diagnostic-impact" },
  { patientName: "刘洋", modality: "CT", bodyPart: "胸部", note: "曝光适度, 图像质量优", noteEn: "Adequate exposure; excellent quality" },
  { patientName: "赵丽", modality: "MG", bodyPart: "乳腺", note: "压迫不足, 腺体显示欠清", noteEn: "Insufficient compression; glandular blur" },
  { patientName: "孙浩", modality: "MR", bodyPart: "头颅", note: "运动伪影明显, 建议镇静后复查", noteEn: "Significant motion; consider sedation re-scan" },
  { patientName: "周雪", modality: "CT", bodyPart: "胸部", note: "骨窗重建参数建议优化", noteEn: "Bone-window reconstruction tuning advised" },
];

export function getQcImageChecks(): QcImageCheck[] {
  return QC_BASE.map((base, index) => {
    const id = `qcimg-${String(index + 1).padStart(3, "0")}`;
    const artifact = Math.round(clamp(18 + seededUnit(`${id}:a`) * 70, 3, 96));
    const motion = Math.round(clamp(12 + seededUnit(`${id}:m`) * 72, 2, 95));
    const exposure = Math.round(clamp(10 + seededUnit(`${id}:e`) * 60, 2, 92));
    const worst = Math.max(artifact, motion, exposure);
    const verdict: QcImageCheck["verdict"] = worst >= 70 ? "fail" : worst >= 42 ? "warn" : "pass";
    return {
      id,
      studyId: `STU20260926${String(200 + index)}`,
      patientName: base.patientName,
      modality: base.modality,
      bodyPart: base.bodyPart,
      artifact,
      motion,
      exposure,
      verdict,
      note: base.note,
      noteEn: base.noteEn,
      checkedAt: `2026-09-26 0${(7 + index) % 10}:${String((index * 7) % 60).padStart(2, "0")}`,
    };
  });
}

export interface DriftAlert {
  id: string;
  modelId: string;
  modelName: string;
  modelNameEn: string;
  metric: "accuracy" | "sensitivity" | "specificity";
  baseline: number;
  current: number;
  delta: number;
  severity: "high" | "medium" | "low";
  detectedAt: string;
  hint: string;
  hintEn: string;
}

export function getDriftAlerts(catalog: AiModelEntry[]): DriftAlert[] {
  const candidates = catalog.filter((m) => m.status !== "offline");
  const alerts: DriftAlert[] = [];
  candidates.forEach((m, index) => {
    if (index % 2 !== 0) return;
    const rand = mulberry32(hashString(`${m.id}:drift`));
    const delta = -round2(1.8 + rand() * 5.6);
    const metric: DriftAlert["metric"] =
      index % 6 === 0 ? "accuracy" : index % 6 === 2 ? "specificity" : "sensitivity";
    const baseline =
      metric === "accuracy"
        ? m.metrics.accuracy
        : metric === "sensitivity"
          ? m.metrics.sensitivity
          : m.metrics.specificity;
    const severity: DriftAlert["severity"] = delta <= -5 ? "high" : delta <= -3 ? "medium" : "low";
    alerts.push({
      id: `drift-${m.id}`,
      modelId: m.id,
      modelName: m.name,
      modelNameEn: m.nameEn,
      metric,
      baseline,
      current: round1(baseline + delta),
      delta,
      severity,
      detectedAt: `2026-09-${String(20 + (index % 6)).padStart(2, "0")}`,
      hint:
        severity === "high"
          ? "建议暂停自动采纳并触发人工复核"
          : severity === "medium"
            ? "建议加密质控抽样并关注分布偏移"
            : "建议持续监测, 暂无需干预",
      hintEn:
        severity === "high"
          ? "Pause auto-adoption and trigger manual review"
          : severity === "medium"
            ? "Increase QC sampling; watch distribution shift"
            : "Continue monitoring; no action required",
    });
  });
  return alerts;
}

export interface ErrorReviewItem {
  id: string;
  kind: "FP" | "FN";
  modelId: string;
  modelName: string;
  modelNameEn: string;
  studyId: string;
  patientName: string;
  finding: string;
  findingEn: string;
  confidence: number;
  reviewerVerdict: "pending" | "confirmed" | "dismissed";
  reportedAt: string;
}

interface ErrorBase {
  kind: "FP" | "FN";
  modelId: string;
  patientName: string;
  finding: string;
  findingEn: string;
}

const ERROR_BASE: ErrorBase[] = [
  { kind: "FP", modelId: "shukun-lung-nodule", patientName: "赵丽", finding: "右下肺 4mm 实性结节 (血管断面误判)", findingEn: "RLL 4mm solid nodule (vessel cross-section FP)" },
  { kind: "FN", modelId: "shukun-stroke", patientName: "冯军", finding: "左侧大脑中动脉 M1 段闭塞漏检", findingEn: "Missed left MCA M1 occlusion" },
  { kind: "FP", modelId: "yizhun-pe", patientName: "吴强", finding: "亚段肺栓塞误报 (呼吸伪影)", findingEn: "Subsegmental PE FP (respiratory artifact)" },
  { kind: "FN", modelId: "yizhun-ich", patientName: "陈敏", finding: "少量蛛网膜下腔出血漏检", findingEn: "Missed small SAH" },
  { kind: "FP", modelId: "inhouse-report", patientName: "何静", finding: "报告建议出现无依据随访周期", findingEn: "Unsupported follow-up interval in draft" },
  { kind: "FP", modelId: "yizhun-pneumothorax", patientName: "郑楠", finding: "肺大疱误报为气胸", findingEn: "Bullae misreported as pneumothorax" },
];

export function getErrorReviewQueue(catalog: AiModelEntry[]): ErrorReviewItem[] {
  return ERROR_BASE.map((base, index) => {
    const id = `err-${String(index + 1).padStart(3, "0")}`;
    const model = catalog.find((m) => m.id === base.modelId);
    const rand = mulberry32(hashString(`${id}:err`));
    return {
      id,
      kind: base.kind,
      modelId: base.modelId,
      modelName: model?.name ?? base.modelId,
      modelNameEn: model?.nameEn ?? base.modelId,
      studyId: `STU20260926${String(300 + index)}`,
      patientName: base.patientName,
      finding: base.finding,
      findingEn: base.findingEn,
      confidence: round1(52 + rand() * 44),
      reviewerVerdict: index % 4 === 3 ? "confirmed" : "pending",
      reportedAt: `2026-09-2${(index % 6)} 1${index % 9}:30`,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 多模态报告助手 (草稿 + RAG 引用 + 护栏)                             */
/* ------------------------------------------------------------------ */

export type ReportGuardrailKey =
  | "lowConfidence"
  | "needHumanReview"
  | "noEvidence"
  | "criticalDiff"
  | "templateConflict";

export interface ReportGuardrail {
  key: ReportGuardrailKey;
  level: "warn" | "info";
}

export interface ReportCitation {
  id: string;
  reportNo: string;
  date: string;
  snippet: string;
  snippetEn: string;
  similarity: number;
}

export interface ReportSuggestion {
  id: string;
  section: "findings" | "impression";
  text: string;
  textEn: string;
  confidence: number;
  citations: ReportCitation[];
  guardrails: ReportGuardrail[];
}

export interface ReportAssistantDraft {
  studyId: string;
  patientName: string;
  patientNameEn: string;
  modality: string;
  bodyPart: string;
  generatedAt: string;
  modelVersion: string;
  draftText: string;
  draftTextEn: string;
  suggestions: ReportSuggestion[];
}

const CITATIONS: ReportCitation[] = [
  {
    id: "cit-1",
    reportNo: "R2026-08-1142",
    date: "2026-08-14",
    snippet: "右肺下叶可见混合磨玻璃结节, 建议 3 个月低剂量 CT 随访。",
    snippetEn: "Part-solid GGN in RLL; 3-month low-dose CT follow-up advised.",
    similarity: 0.91,
  },
  {
    id: "cit-2",
    reportNo: "R2026-05-0873",
    date: "2026-05-21",
    snippet: "右肺下叶结节较前相仿, 未见明显增大, 边缘光整。",
    snippetEn: "RLL nodule stable versus prior, no interval growth, smooth margin.",
    similarity: 0.87,
  },
  {
    id: "cit-3",
    reportNo: "R2026-02-0331",
    date: "2026-02-09",
    snippet: "双肺散在细小结节, 建议年度随访。",
    snippetEn: "Scattered tiny bilateral nodules; annual follow-up suggested.",
    similarity: 0.78,
  },
];

export function getReportAssistantDraft(): ReportAssistantDraft {
  const base: ReportSuggestion[] = [
    {
      id: "sug-f1",
      section: "findings",
      text: "右肺下叶见混合磨玻璃结节, 大小约 12mm×9mm, 边缘光整, 未见明确分叶及毛刺。",
      textEn: "Part-solid GGN in the right lower lobe, ~12mm×9mm, smooth margin, no spiculation.",
      confidence: 92.4,
      citations: [CITATIONS[0]!, CITATIONS[1]!],
      guardrails: [],
    },
    {
      id: "sug-f2",
      section: "findings",
      text: "双肺可见散在细小类结节影, 建议随访观察。",
      textEn: "Scattered tiny nodular opacities in both lungs; follow-up suggested.",
      confidence: 81.1,
      citations: [CITATIONS[2]!],
      guardrails: [{ key: "lowConfidence", level: "warn" }],
    },
    {
      id: "sug-i1",
      section: "impression",
      text: "右肺下叶结节, 较前相仿, 建议 3 个月后低剂量 CT 随访复查。",
      textEn: "RLL nodule, stable versus prior; 3-month low-dose CT follow-up.",
      confidence: 88.6,
      citations: [CITATIONS[1]!, CITATIONS[0]!],
      guardrails: [{ key: "needHumanReview", level: "info" }],
    },
    {
      id: "sug-i2",
      section: "impression",
      text: "纵隔未见明确肿大淋巴结。",
      textEn: "No definite enlarged mediastinal lymph nodes.",
      confidence: 64.3,
      citations: [],
      guardrails: [
        { key: "lowConfidence", level: "warn" },
        { key: "noEvidence", level: "warn" },
      ],
    },
  ];
  return {
    studyId: "STU20260926-042",
    patientName: "赵丽",
    patientNameEn: "Zhao Li",
    modality: "CT",
    bodyPart: "胸部",
    generatedAt: "2026-09-26 09:12",
    modelVersion: "inhouse-report v1.3.0",
    draftText:
      "【检查技术】胸部 CT 平扫, 层厚 5mm。\n" +
      "【影像所见】右肺下叶见混合磨玻璃结节, 大小约 12mm×9mm, 边缘光整; 双肺可见散在细小类结节影。\n" +
      "【诊断意见】右肺下叶结节, 较前相仿, 建议 3 个月后低剂量 CT 随访复查。",
    draftTextEn:
      "[Technique] Non-contrast chest CT, 5mm slice.\n" +
      "[Findings] Part-solid GGN in RLL ~12mm×9mm, smooth margin; scattered tiny bilateral nodules.\n" +
      "[Impression] RLL nodule, stable; 3-month low-dose CT follow-up.",
    suggestions: base,
  };
}

/* ------------------------------------------------------------------ */
/* 厂商 / 状态 / 优先级 键映射 (供 UI 选择 i18n)                        */
/* ------------------------------------------------------------------ */

export const AI_VENDOR_KEYS: ReadonlyArray<AiVendorKey> = ["shukun", "yizhun", "inhouse"];
export const AI_STATUS_KEYS: ReadonlyArray<AiModelStatus> = ["deployed", "gray", "offline"];
export const TRIAGE_PRIORITY_KEYS: ReadonlyArray<TriagePriority> = [
  "CRITICAL",
  "URGENT",
  "SEMI",
  "ROUTINE",
];
