/** G005 眼科 PACS/RIS 类型定义 v3.0.6.8-21 — 500 升级点深化 */

/** 眼别 */
export type EyeSide = "OD" | "OS" | "OU";

/** 视力记法 */
export type VisionNotation = "snellen" | "decimal" | "five" | "logmar";

/** 视力类型 */
export type VisionType = "ucva" | "bcva" | "phva";

/** 视力距离 */
export type VisionDistance = "far" | "near";

/** 视力记录 */
export interface VisionRecord {
  od: number | null;
  os: number | null;
  notation: VisionNotation;
  type: VisionType;
  distance: VisionDistance;
}

/** 眼压测量方式 */
export type IopDevice = "nct" | "goldmann" | "icare" | "diaton" | "tonopen";

/** 眼压记录 */
export interface IopRecord {
  od: number;
  os: number;
  device: IopDevice;
  timestamp: string;
}

/** 眼压 24h 曲线 */
export interface Iop24hCurve {
  records: IopRecord[];
  patientId: string;
  date: string;
  sleepPeriod?: { start: string; end: string };
}

/** 验光处方 */
export interface RefractionPrescription {
  od: {
    sph: number;
    cyl: number;
    axis: number;
    prism?: number;
    base?: string;
    add?: number;
    va?: number;
  };
  os: {
    sph: number;
    cyl: number;
    axis: number;
    prism?: number;
    base?: string;
    add?: number;
    va?: number;
  };
  pd: number;
  ph: number;
}

/** IOL 计算输入 */
export interface IolInput {
  al: number;
  k1: number;
  k2: number;
  km: number;
  acd: number;
  lt: number;
  wtw: number;
  cct: number;
  gender: "male" | "female";
  iolModel: string;
  aConstant: number;
  pAcd?: number;
  surgeonFactor?: number;
}

/** IOL 公式结果 */
export interface IolResult {
  formula: string;
  targetRefraction: number;
  iolPower: number;
  recommended: boolean;
  note?: string;
}

/** 裂隙灯 7 段记录 */
export interface SlitLampRecord {
  lid: string;
  conjunctiva: string;
  cornea: string;
  anteriorChamber: string;
  iris: string;
  pupil: string;
  lens: string;
}

/** 眼底 4 段记录 */
export interface FundusRecord {
  disc: string;
  macula: string;
  vessel: string;
  periphery: string;
}

/** 糖尿病视网膜病变分级（国际临床分级 0-4） */
export type DrGrade = 0 | 1 | 2 | 3 | 4;

/** 青光眼类型 */
export type GlaucomaType =
  | "primary_open"
  | "primary_close"
  | "secondary_open"
  | "secondary_close"
  | "acute"
  | "chronic";

/** 白内障分级 LOCS III */
export interface CataractGradeLOCS3 {
  nuclear: number;
  cortical: number;
  posteriorSubcapsular: number;
}

/** 糖网分级 */
export interface DrGrading {
  left: DrGrade;
  right: DrGrade;
  hasDiabeticMacularEdema: boolean;
  hasHighRisk: boolean;
}

/** 扩展检查类型 (新增 OCT-A / ERG / VEP / 角膜内皮 / 泪液 / 眼前节 / 立体照 / 多焦ERG) */
export type EyeModality =
  | "fundus_photo"
  | "oct"
  | "oct_a"
  | "ffa"
  | "icga"
  | "visual_field"
  | "topography"
  | "pentacam"
  | "iol_master"
  | "ubm"
  | "corvis"
  | "wavefront"
  | "hrt"
  | "gdx"
  | "slit_lamp"
  | "fundus_autofluorescence"
  | "erg"
  | "vep"
  | "multifocal_erg"
  | "corneal_endothelium"
  | "tear_film"
  | "anterior_segment_photo"
  | "stereo_fundus"
  | "gonioscopy"
  | "refraction"
  | "specular_microscopy";

/** 检查状态 */
export type StudyStatus =
  | "ordered"
  | "scheduled"
  | "arrived"
  | "in_progress"
  | "completed"
  | "verified"
  | "published"
  | "cancelled";

/** 影像系列 */
export interface EyeImageSeries {
  id: string;
  studyId: string;
  seriesNumber: number;
  modality: EyeModality;
  description: string;
  eyeSide: EyeSide;
  laterality: "right" | "left" | "both";
  instances: EyeImageInstance[];
  acquisitionDateTime: string;
  protocolName: string;
  manufacturer: string;
  deviceModel: string;
  softwareVersion: string;
  seriesDateTime: string;
  bodyPart: string;
  numberOfInstances: number;
  seriesType: string[];
  operatorName: string;
  performerName: string;
  institutionName: string;
}

/** 影像实例 */
export interface EyeImageInstance {
  id: string;
  seriesId: string;
  studyId: string;
  instanceNumber: number;
  sopClassUid: string;
  sopInstanceUid: string;
  url: string;
  thumbnail: string;
  description: string;
  eyeSide: EyeSide;
  rows: number;
  columns: number;
  bitsAllocated: number;
  pixelRepresentation: number;
  resize: number[];
  windowCenter: number;
  windowWidth: number;
  acquisitionNumber: number;
  imageType: string[];
  laterality: string;
  viewPosition: string;
  imageLaterality: string;
  contentDate: string;
  contentTime: string;
}

/** 窗宽窗位 */
export interface WindowLevel {
  windowCenter: number;
  windowWidth: number;
  description: string;
  presetName: string;
}

/** 影像标注 */
export interface EyeImageAnnotation {
  id: string;
  instanceId: string;
  type:
    | "point"
    | "line"
    | "circle"
    | "ellipse"
    | "rectangle"
    | "polygon"
    | "freehand"
    | "angle"
    | "text";
  coordinates: number[];
  label: string;
  color: string;
  measurement?: number;
  unit?: string;
  createdBy: string;
  createdAt: string;
  visibility: boolean;
}

/** 关键影像标记 */
export interface KeyImage {
  id: string;
  studyId: string;
  instanceId: string;
  reason: string;
  description: string;
  flaggedBy: string;
  flaggedAt: string;
  category:
    | "diagnostic"
    | "representative"
    | "abnormal"
    | "follow_up"
    | "quality_issue";
}

/** 测量记录 */
export interface EyeMeasurement {
  id: string;
  studyId: string;
  category:
    | "cdr"
    | "oct_thickness"
    | "vessel_caliber"
    | "lesion_size"
    | "corneal"
    | "anterior_segment"
    | "field"
    | "axial"
    | "endothelium";
  type: string;
  source: EyeModality;
  eyeSide: EyeSide;
  value: number;
  unit: string;
  normalRange?: [number, number];
  interpretation?: "normal" | "borderline" | "abnormal" | "critical";
  notes?: string;
  measuredAt: string;
  measuredBy: string;
  method: string;
  device: string;
}

/** OCT 厚度图 */
export interface OctThicknessMap {
  id: string;
  studyId: string;
  eyeSide: EyeSide;
  device: string;
  protocol: string;
  scanPattern: string;
  /** ETDRS 9 区 */
  central: number;
  superior: number;
  inferior: number;
  temporal: number;
  nasal: number;
  superoTemporal: number;
  superoNasal: number;
  inferoTemporal: number;
  inferoNasal: number;
  /** RNFL 4 象限 */
  rnflSuperior: number;
  rnflInferior: number;
  rnflTemporal: number;
  rnflNasal: number;
  /** Ganglion 细胞 */
  gciplAvg: number;
  gciplMin: number;
  /** 脉络膜 */
  choroidalThickness: number;
  signalStrength: number;
  qualityScore: number;
  segmentationErrors: boolean;
}

/** 视野分析 */
export interface VisualFieldAnalysis {
  id: string;
  studyId: string;
  eyeSide: EyeSide;
  device: string;
  strategy: string;
  pattern: string;
  md: number;
  psd: number;
  vfi: number;
  fovealThreshold: number;
  fixationLosses: number;
  falsePositives: number;
  falseNegatives: number;
  ght: "normal" | "borderline" | "outside_normal" | "not_reliable";
  reliability: "good" | "fair" | "poor";
  patternDeviation: number[][];
  totalDeviation: number[][];
  defectDepth: number;
  sectorDefects: { sector: string; md: number; pattern: string }[];
  glaucomaHemifieldTest: string;
  meanSensitivity: number;
}

/** AI 诊断结果 */
export interface AiDiagnosis {
  id: string;
  studyId: string;
  modelName: string;
  modelVersion: string;
  vendor: string;
  modality: EyeModality;
  eyeSide: EyeSide;
  findings: string[];
  probabilities: Record<string, number>;
  primaryDiagnosis: string;
  primaryConfidence: number;
  severity: "none" | "mild" | "moderate" | "severe" | "proliferative";
  classificationCards: AiClassificationCard[];
  recommendAction: string;
  reviewStatus: "pending" | "accepted" | "rejected" | "modified";
  reviewedBy?: string;
  reviewedAt?: string;
  processedAt: string;
  processingTimeMs: number;
  alerts: string[];
}

/** AI 分类卡 */
export interface AiClassificationCard {
  condition: string;
  probability: number;
  grade: string;
  confidence: number;
  evidenceText: string;
  heatmapUrl?: string;
  critical: boolean;
}

/** AI 模型 */
export interface AiModel {
  id: string;
  name: string;
  version: string;
  vendor: string;
  modality: EyeModality[];
  conditions: string[];
  accuracy: number;
  sensitivity: number;
  specificity: number;
  fdaApproved: boolean;
  ceMarked: boolean;
  nmpaApproved: boolean;
  releaseDate: string;
  inputRequirements: string;
  processingTime: string;
}

/** 结构化报告 */
export interface StructuredReport {
  id: string;
  studyId: string;
  patientId: string;
  templateId: string;
  templateName: string;
  findings: ReportFinding[];
  gradings: ReportGrading[];
  impressions: string;
  recommendations: string;
  criticalValues: string[];
  createdBy: string;
  createdAt: string;
  verifiedBy?: string;
  verifiedAt?: string;
  status: "draft" | "pending_review" | "verified" | "published" | "amended";
}

/** 报告所见 */
export interface ReportFinding {
  id: string;
  category: string;
  laterality: EyeSide;
  description: string;
  location: string;
  severity: string;
  qualitative: boolean;
  measurementId?: string;
  annotations: string[];
}

/** 报告分级量表 */
export interface ReportGrading {
  id: string;
  scale:
    | "locs3"
    | "etdrs"
    | "kellogg"
    | "dr_international"
    | "isnt"
    | "glaucoma_staging";
  eyeSide: EyeSide;
  grade: string;
  value: number;
  description: string;
}

/** 危急值 */
export interface CriticalValue {
  id: string;
  patientId: string;
  patientName: string;
  studyId: string;
  category: string;
  finding: string;
  severity: "urgent" | "emergent" | "significant";
  status: "open" | "acknowledged" | "resolved" | "false_alarm";
  reportedTo?: string;
  reportedAt?: string;
  acknowledgedBy?: string;
  acknowledgedAt?: string;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNote?: string;
  createdAt: string;
  createdBy: string;
  followUpRecommended: boolean;
  followUpDays?: number;
}

/** 检查预约 */
export interface EyeAppointment {
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  modality: EyeModality;
  eyeSide: EyeSide;
  scheduledDate: string;
  scheduledTime: string;
  doctorId: string;
  doctorName: string;
  department: string;
  room: string;
  status:
    | "scheduled"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show";
  notes?: string;
  isFollowUp: boolean;
  priorStudyId?: string;
  createdAt: string;
  priority: "routine" | "urgent" | "emergent";
  insuranceType: string;
  fastingRequired: boolean;
  specialPrep: string;
  reminderSent: boolean;
  reminderMethod: "sms" | "phone" | "wechat" | "app";
  reminderSentAt?: string;
}

/** 手术预约 */
export interface SurgeryAppointment {
  id: string;
  patientId: string;
  patientName: string;
  procedure: string;
  eyeSide: EyeSide;
  surgeonId: string;
  surgeonName: string;
  assistantId?: string;
  anesthesiologistId?: string;
  scheduledDate: string;
  orRoom: string;
  status:
    | "scheduled"
    | "pre_checked"
    | "in_progress"
    | "completed"
    | "cancelled";
  preOpDiagnosis: string;
  implantInfo?: string;
  anesthesiaType: "local" | "topical" | "general" | "regional";
  estimatedDuration: number;
  notes?: string;
}

/** 完整眼科 EMR */
export interface OphthalmologyEmr {
  id: string;
  patientId: string;
  chiefComplaint: string;
  hpi: string;
  pastHistory: string[];
  systemicHistory: string[];
  medicationHistory: string[];
  allergyHistory: string[];
  familyHistory: string[];
  socialHistory: string[];
  visionOd: number[];
  visionOs: number[];
  iopOd: IopRecord[];
  iopOs: IopRecord[];
  slitLamp: SlitLampRecord;
  fundus: FundusRecord;
  refraction: RefractionPrescription;
  gonioscopy: string;
  diagnosis: string[];
  icdCodes: string[];
  plan: string;
  followUpDays?: number;
  preOpAssessment?: PreOpAssessment;
  postOpNote?: PostOpNote;
  surgicalRecord?: SurgicalRecord;
  informedConsent?: InformedConsent;
  createdAt: string;
  updatedAt: string;
  doctorName: string;
  department: string;
}

/** 术前评估 */
export interface PreOpAssessment {
  asaGrade: number;
  bloodPressure: string;
  heartRate: number;
  ecgNormal: boolean;
  labResults: { test: string; result: string; normal: boolean }[];
  medicationAdjustments: string;
  anesthesiologistNote: string;
  assessedBy: string;
  assessedAt: string;
}

/** 术后记录 */
export interface PostOpNote {
  dayOfSurgery: string;
  visionOd?: number[];
  visionOs?: number[];
  iopOd?: number;
  iopOs?: number;
  slitLamp: string;
  complications: string[];
  medicationPrescribed: string[];
  followUpDate: string;
  notes: string;
  doctorName: string;
}

/** 手术记录 */
export interface SurgicalRecord {
  procedureName: string;
  procedureCode: string;
  eyeSide: EyeSide;
  surgeonName: string;
  assistantName?: string;
  anesthesiaType: string;
  incisionType: string;
  incisionSize: number;
  phacoTime?: number;
  phacoPower?: number;
  iolModel?: string;
  iolPower?: number;
  iolPosition?: string;
  vitrectomyType?: string;
  tamponade?: string;
  endolaser?: boolean;
  complications: string[];
  estimatedBloodLoss: number;
  procedureDuration: number;
  specimenRemoved: string[];
  implantInfo: string;
  surgeryDate: string;
  operativeFindings: string;
  procedureDetails: string;
  disposition: string;
}

/** 知情同意 */
export interface InformedConsent {
  documentId: string;
  procedureName: string;
  risks: string[];
  benefits: string[];
  alternatives: string[];
  patientSigned: boolean;
  patientSignedAt?: string;
  witnessName: string;
  doctorName: string;
  createdDate: string;
  expiryDate: string;
}

/** 影像对比对 */
export interface ComparisonPair {
  id: string;
  patientId: string;
  patientName: string;
  priorStudyId: string;
  currentStudyId: string;
  priorDate: string;
  currentDate: string;
  priorModality: EyeModality;
  currentModality: EyeModality;
  eyeSide: EyeSide;
  measurements: ComparisonMeasurement[];
  aiProgression: string;
  conclusion: string;
  createdBy: string;
  createdAt: string;
}

/** 对比测量 */
export interface ComparisonMeasurement {
  parameter: string;
  priorValue: number;
  currentValue: number;
  unit: string;
  change: number;
  changePercent: number;
  direction: "improved" | "stable" | "worsened";
  significant: boolean;
}

/** 时间序列变化 */
export interface TimeSeriesPoint {
  date: string;
  value: number;
  unit: string;
  note?: string;
}

/** 变化趋势 */
export interface EvolutionCurve {
  parameter: string;
  modality: EyeModality;
  eyeSide: EyeSide;
  series: TimeSeriesPoint[];
  trend: "stable" | "improving" | "worsening" | "fluctuating";
  slope?: number;
  significantChange: boolean;
  lastChangeDays: number;
}

/** 随访提醒 */
export interface FollowUpReminder {
  id: string;
  patientId: string;
  patientName: string;
  condition: string;
  recommendedInterval: number;
  nextVisitDate: string;
  lastVisitDate: string;
  overdue: boolean;
  daysOverdue: number;
  status: "active" | "completed" | "lost_to_followup" | "cancelled";
  priority: "low" | "medium" | "high";
  notes: string;
  notificationSent: boolean;
}

/** 转诊记录 */
export interface EyeReferral {
  id: string;
  patientId: string;
  patientName: string;
  referringDoctor: string;
  referringDept: string;
  referredTo: string;
  referredDept: string;
  reason: string;
  diagnosis: string;
  urgency: "routine" | "urgent" | "emergent";
  status: "pending" | "accepted" | "completed" | "declined";
  createdAt: string;
  completedAt?: string;
  response?: string;
}

/** 科研病例 */
export interface ResearchCase {
  id: string;
  patientId: string;
  studyIds: string[];
  cohort: string;
  condition: string;
  inclusionCriteria: string[];
  biomarkers: Record<string, number>;
  imageUrls: string[];
  annotations: string[];
  annotationsProjectId?: string;
  enrolledAt: string;
  enrolledBy: string;
  phase:
    | "screening"
    | "baseline"
    | "follow_up_1"
    | "follow_up_2"
    | "endpoint"
    | "completed";
  status: "active" | "withdrawn" | "completed";
}

/** 科研标注项目 */
export interface AnnotationProject {
  id: string;
  name: string;
  description: string;
  condition: string;
  annotationType:
    | "bounding_box"
    | "segmentation"
    | "landmark"
    | "grade"
    | "text";
  totalImages: number;
  annotatedImages: number;
  annotators: string[];
  reviewers: string[];
  status: "setup" | "in_progress" | "review" | "completed";
  createdAt: string;
  ioaScore?: number;
}

/** 统计报告 */
export interface EyeStatReport {
  id: string;
  type:
    | "volume"
    | "diagnosis"
    | "modality"
    | "surgery"
    | "quality"
    | "productivity";
  dateRange: [string, string];
  metrics: Record<string, number>;
  charts: { type: string; data: any[] }[];
  generatedAt: string;
  generatedBy: string;
}

/** DICOM 节点配置 */
export interface DicomNodeConfig {
  aeTitle: string;
  hostname: string;
  port: number;
  type: "scu" | "scp" | "storescp" | "storescu";
  description: string;
  status: "online" | "offline" | "error";
  lastHeartbeat?: string;
  vendor: string;
  version: string;
}

/** 路由规则 */
export interface RoutingRule {
  id: string;
  name: string;
  modality: EyeModality[];
  sourceAe: string;
  destinationAe: string;
  condition: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** IOL 库存 */
export interface IolItem {
  id: string;
  manufacturer: string;
  model: string;
  power: number;
  sn: string;
  expiryDate: string;
  patientId?: string;
  implantDate?: string;
  surgeon?: string;
  lotNumber: string;
  location: string;
  quantity: number;
  status: "in_stock" | "reserved" | "implanted" | "expired" | "damaged";
}

/** 拼接/拼图配置 */
export interface MontageConfig {
  type: "panoramic" | "mosaic" | "widefield";
  images: string[];
  overlapPercent: number;
  blending: "linear" | "multi_band" | "feathering";
  autoCrop: boolean;
  quality: "draft" | "standard" | "high";
}

/** 血管追踪 */
export interface VesselTracking {
  id: string;
  studyId: string;
  eyeSide: EyeSide;
  source: "fundus_photo" | "ffa" | "oct_a";
  vessels: VesselSegment[];
  arteryCount: number;
  veinCount: number;
  avRatio: number;
  tortuosityIndex: number;
  fractalDimension: number;
}

export interface VesselSegment {
  id: string;
  type: "artery" | "vein" | "capillary";
  caliber: number;
  length: number;
  tortuosity: number;
  points: number[][];
  branchLevel: number;
}

/** 病灶分割 */
export interface LesionSegmentation {
  id: string;
  studyId: string;
  instanceId: string;
  type:
    | "microaneurysm"
    | "hemorrhage"
    | "exudate"
    | "cotton_wool"
    | "drusen"
    | "geographic_atrophy"
    | "cnv"
    | "retinal_tear"
    | "retinal_detachment"
    | "lattice"
    | "nevus"
    | "melanoma";
  eyeSide: EyeSide;
  area: number;
  diameter: number;
  distanceFromFovea: number;
  quadrant: string;
  confidence: number;
  contour: number[][];
  automated: boolean;
  validatedBy?: string;
}

// ===== v3.0.6.8-22 报告/征象/量表/OCT/QC/设备/教学/满意度 =====

/** 报告状态 */
export type ReportStatus =
  | "draft"
  | "pending_review"
  | "reviewing"
  | "published"
  | "amended"
  | "printed"
  | "critical_value";

/** 报告模板 */
export interface ReportTemplate {
  id: string;
  name: string;
  modality: EyeModality;
  sections: ReportTemplateSection[];
  description: string;
  version: string;
  createdAt: string;
  updatedAt: string;
  author: string;
}

export interface ReportTemplateSection {
  key: string;
  title: string;
  type:
    | "text"
    | "findings_multi"
    | "grading_scale"
    | "images"
    | "measurements"
    | "diagnosis";
  required: boolean;
  order: number;
}

/** 报告所见征象库项 */
export interface FindingLibraryItem {
  id: string;
  category: string;
  name: string;
  laterality: "OD" | "OS" | "OU" | "any";
  modality: EyeModality[];
  severity: string;
  common: boolean;
  description: string;
  keywords: string[];
  gradingScaleId?: string;
}

/** 眼科报告 */
export interface OphthalmologyReport {
  id: string;
  patientId: string;
  patientName: string;
  studyId: string;
  templateId: string;
  templateName: string;
  modality: EyeModality;
  eyeSide: EyeSide;
  status: ReportStatus;
  sections: ReportSectionData[];
  findings: string[];
  impression: string;
  recommendations: string;
  aiSuggestion?: string;
  aiAccepted?: boolean;
  criticalValue?: string;
  version: number;
  previousVersionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy?: string;
  reviewedAt?: string;
  publishedBy?: string;
  publishedAt?: string;
  amendedBy?: string;
  amendedAt?: string;
  amendmentReason?: string;
  printedBy?: string;
  printedAt?: string;
  signedBy?: string;
  signedAt?: string;
  signMethod?: "digital" | "handwritten" | "ca";
  consultationRef?: string;
  notes?: string;
}

export interface ReportSectionData {
  key: string;
  content: string;
  findings: string[];
  gradingResults?: GradingResult[];
  imageRefs?: string[];
  measurementRefs?: string[];
}

/** 分级量表定义 */
export interface GradingScaleDefinition {
  id: string;
  name: string;
  fullName: string;
  category: string;
  options: GradingScaleOption[];
  description: string;
}

export interface GradingScaleOption {
  grade: string;
  value: number;
  label: string;
  description: string;
  imageUrl?: string;
}

export interface GradingResult {
  scaleId: string;
  scaleName: string;
  eyeSide: EyeSide;
  grade: string;
  value: number;
  laterality: "OD" | "OS" | "OU";
}

/** OCT B-scan 切片 */
export interface OctBscanSlice {
  id: string;
  seriesId: string;
  studyId: string;
  sliceNumber: number;
  bscanIndex: number;
  url: string;
  thumbnail: string;
  description: string;
  eyeSide: EyeSide;
  rows: number;
  columns: number;
  pixelSpacing: [number, number];
  sliceLocation: number;
  scanPosition: string;
  bscanType: string;
  qualityScore: number;
  segmentationValid: boolean;
}

/** OCT B-scan 系列 */
export interface OctBscanSeries {
  id: string;
  studyId: string;
  seriesNumber: number;
  scanPattern: string;
  slices: OctBscanSlice[];
  totalSlices: number;
  acquisitionDateTime: string;
  device: string;
  eyeSide: EyeSide;
  manufacturer: string;
  softwareVersion: string;
}

/** 眼底彩照全景方位 */
export type FundusViewPosition =
  | "posterior_pole"
  | "temporal_superior"
  | "temporal_inferior"
  | "nasal_superior"
  | "nasal_inferior"
  | "macula_center"
  | "optic_disc_center";

/** 完整 DICOM 头 */
export interface DicomImageMetadata {
  sopClassUid: string;
  sopInstanceUid: string;
  studyInstanceUid: string;
  seriesInstanceUid: string;
  transferSyntaxUid: string;
  institutionName: string;
  institutionAddress: string;
  referringPhysician: string;
  modality: EyeModality;
  manufacturer: string;
  deviceSerialNumber: string;
  softwareVersion: string;
  pixelSpacing: [number, number];
  sliceThickness: number;
  rows: number;
  columns: number;
  bitsAllocated: number;
  pixelRepresentation: number;
  windowCenter: number;
  windowWidth: number;
  rescaleIntercept: number;
  rescaleSlope: number;
  imageLaterality: string;
  imageType: string[];
  bodyPartExamined: string;
  patientOrientation: string;
  acquisitionDateTime: string;
  contentDate: string;
  contentTime: string;
  accessionNumber: string;
  requestedProcedureId: string;
  scheduledProcedureStepId: string;
  operatorsName: string[];
  performersName: string[];
}

/** 影像 QC 报告 */
export interface ImageQualityQc {
  id: string;
  studyId: string;
  seriesId: string;
  instanceId: string;
  patientId: string;
  modality: EyeModality;
  eyeSide: EyeSide;
  overallScore: number;
  signalStrength: number;
  artifactsScore: number;
  exposureScore: number;
  focusScore: number;
  positioningScore: number;
  patientMotion: boolean;
  eyelidArtifact: boolean;
  tearFilmArtifact: boolean;
  mediaOpacity: boolean;
  segmentationErrors: boolean;
  qcStatus: "passed" | "marginal" | "failed" | "not_reviewed";
  qcReviewer?: string;
  qcReviewedAt?: string;
  qcNotes: string;
  automated: boolean;
}

/** 视野随访点 */
export interface VfTrendPoint {
  date: string;
  md: number;
  psd: number;
  vfi: number;
  fovealThreshold: number;
  reliability: string;
}

/** 视野随访趋势 */
export interface VisualFieldTrend {
  patientId: string;
  eyeSide: EyeSide;
  points: VfTrendPoint[];
  mdSlope: number;
  mdSlopeSignificant: boolean;
  vfiSlope: number;
  vfiSlopeSignificant: boolean;
  progressionAlert: boolean;
}

/** 设备工作量 */
export interface DeviceWorkload {
  date: string;
  deviceId: string;
  deviceName: string;
  totalExams: number;
  completedExams: number;
  failedExams: number;
  avgDuration: number;
  patientCount: number;
  uptimePercent: number;
}

/** 设备-检查类型映射 */
export interface DeviceModalityMap {
  deviceId: string;
  deviceName: string;
  modalities: EyeModality[];
  defaultTemplateId?: string;
}

/** 报告会诊 */
export interface ReportConsultation {
  id: string;
  reportId: string;
  requestedBy: string;
  requestedAt: string;
  consultantName: string;
  consultantDept: string;
  status: "pending" | "accepted" | "completed" | "declined";
  response?: string;
  respondedAt?: string;
  findings?: string;
  conclusion?: string;
}

/** 报告修改记录 */
export interface ReportAuditEntry {
  id: string;
  reportId: string;
  version: number;
  action:
    | "created"
    | "reviewed"
    | "published"
    | "amended"
    | "printed"
    | "consulted"
    | "critical_value"
    | "reverted";
  userId: string;
  userName: string;
  role: string;
  timestamp: string;
  changes?: string;
  notes?: string;
}

/** 打印/胶片记录 */
export interface ReportPrintRecord {
  id: string;
  reportId: string;
  patientName: string;
  printedBy: string;
  printedAt: string;
  copies: number;
  filmCount: number;
  printerName: string;
  status: "completed" | "failed" | "cancelled";
  notes?: string;
}

/** 典型病例 */
export interface TypicalCase {
  id: string;
  title: string;
  condition: string;
  modality: EyeModality;
  eyeSide: EyeSide;
  patientAge: number;
  patientGender: string;
  keyFindings: string[];
  images: TypicalCaseImage[];
  diagnosis: string;
  differentialDiagnosis: string[];
  management: string;
  outcome: string;
  teachingPoints: string[];
  references: string[];
  author: string;
  createdAt: string;
  tags: string[];
  difficulty: "basic" | "intermediate" | "advanced";
}

export interface TypicalCaseImage {
  url: string;
  caption: string;
  annotation?: string;
  key: boolean;
}

/** 教学培训 */
export interface TrainingSession {
  id: string;
  title: string;
  type:
    | "case_discussion"
    | "lecture"
    | "journal_club"
    | "morbidity_mortality"
    | "hands_on";
  date: string;
  duration: number;
  presenter: string;
  attendees: string[];
  topics: string[];
  caseIds: string[];
  status: "scheduled" | "completed" | "cancelled";
  notes?: string;
}

/** 患者满意度 */
export interface PatientSatisfaction {
  id: string;
  patientId: string;
  patientName: string;
  visitDate: string;
  overallScore: number;
  communicationScore: number;
  waitTimeScore: number;
  facilityScore: number;
  recommendationScore: number;
  comments?: string;
  complaints?: string;
  submittedAt: string;
}

/** 设备-检查类型映射 */
export interface EyeModalityDeviceMap {
  deviceName: string;
  aeTitle: string;
  type: string;
  modality: EyeModality;
  defaultTemplate: string;
  room: string;
}

// ===== v3.0.6.8-23 患者综合/药物/保险/质控/排班/教育/亚专科 =====

/** 患者档案（扩充版） */
export interface PatientProfile {
  id: string;
  name: string;
  gender: string;
  age: number;
  dob: string;
  phone: string;
  email: string;
  address: string;
  insuranceType: string;
  insuranceProvider: string;
  insurancePolicyNo: string;
  primaryPhysician: string;
  referringPhysician: string;
  emergencyContact: string;
  emergencyPhone: string;
  allergies: string[];
  chronicConditions: string[];
  pastOcularSurgeries: string[];
  medications: string[];
  smoking: boolean;
  alcohol: boolean;
  occupation: string;
  lastVisit: string;
  nextAppointment: string;
  totalVisits: number;
  totalExams: number;
}

/** 眼科药品 */
export interface OphthalmicDrug {
  id: string;
  name: string;
  genericName: string;
  category: 'antibiotic' | 'antiviral' | 'antiinflammatory' | 'antiglaucoma' | 'antiallergy' | 'antivegf' | 'immunosuppressant' | 'lubricant' | 'mydriatic' | 'anesthetic' | 'diagnostic' | 'other';
  form: 'drops' | 'ointment' | 'gel' | 'injection' | 'tablet' | 'capsule';
  concentration: string;
  volume: string;
  manufacturer: string;
  unitPrice: number;
  insuranceCovered: boolean;
  requiresPrescription: boolean;
  minAge: number;
  pregnancyCategory: string;
  sideEffects: string[];
  storage: string;
}

/** 药物处方 */
export interface MedicationPrescription {
  id: string;
  patientId: string;
  patientName: string;
  drugId: string;
  drugName: string;
  eyeSide: EyeSide;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  refills: number;
  instructions: string;
  prescribedBy: string;
  prescribedAt: string;
  filledAt?: string;
  pharmacyName?: string;
  status: 'prescribed' | 'filled' | 'active' | 'discontinued' | 'expired';
  notes?: string;
}

/** 保险理赔 */
export interface InsuranceClaim {
  id: string;
  patientId: string;
  patientName: string;
  claimNumber: string;
  serviceDate: string;
  procedureCode: string;
  procedureName: string;
  diagnosisCodes: string[];
  billedAmount: number;
  allowedAmount: number;
  paidAmount: number;
  patientResponsibility: number;
  deductibleApplied: number;
  coPayAmount: number;
  status: 'submitted' | 'approved' | 'denied' | 'pending' | 'appealed';
  denialReason?: string;
  submittedAt: string;
  processedAt?: string;
  remittanceDate?: string;
}

/** 临床指南 */
export interface ClinicalGuideline {
  id: string;
  title: string;
  organization: string;
  year: number;
  condition: string;
  modality: EyeModality[];
  recommendations: string[];
  evidenceLevel: string;
  strength: 'strong' | 'moderate' | 'weak' | 'expert_opinion';
  url?: string;
}

/** 决策支持规则 */
export interface DecisionSupportRule {
  id: string;
  name: string;
  condition: string;
  trigger: string;
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  evidence: string;
  enabled: boolean;
}

/** 质量指标 */
export interface QualityMetric {
  id: string;
  category: 'productivity' | 'clinical' | 'operational' | 'financial' | 'satisfaction';
  name: string;
  value: number;
  target: number;
  unit: string;
  trend: 'up' | 'down' | 'stable';
  period: string;
  doctorId?: string;
  department?: string;
}

/** 排班 */
export interface DoctorSchedule {
  id: string;
  doctorId: string;
  doctorName: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'clinic' | 'surgery' | 'consultation' | 'admin' | 'teaching' | 'on_call';
  location: string;
  maxPatients: number;
  bookedPatients: number;
  notes?: string;
}

/** 通知模板 */
export interface NotificationTemplate {
  id: string;
  name: string;
  channel: 'sms' | 'email' | 'wechat' | 'app' | 'phone';
  trigger: string;
  subject: string;
  body: string;
  variables: string[];
  enabled: boolean;
}

/** 患者教育材料 */
export interface PatientEducationMaterial {
  id: string;
  title: string;
  condition: string;
  type: 'article' | 'video' | 'infographic' | 'handout' | 'faq';
  summary: string;
  content: string;
  readingLevel: 'basic' | 'intermediate' | 'advanced';
  language: string;
  tags: string[];
  authoredBy: string;
  createdAt: string;
  version: string;
}

/** 角膜接触镜验配 */
export interface ContactLensFitting {
  id: string;
  patientId: string;
  patientName: string;
  eyeSide: EyeSide;
  lensType: 'soft' | 'rgp' | 'scleral' | 'ortho_k' | 'hybrid' | 'toric' | 'multifocal';
  brand: string;
  baseCurve: number;
  diameter: number;
  power: number;
  cylinder?: number;
  axis?: number;
  add?: number;
  material: string;
  waterContent: number;
  dk: number;
  replacementSchedule: string;
  wearingSchedule: string;
  fittingDate: string;
  followUpDate?: string;
  fitAssessment: 'good' | 'acceptable' | 'poor';
  complications?: string[];
  prescribedBy: string;
}

/** 低视力评估 */
export interface LowVisionAssessment {
  id: string;
  patientId: string;
  patientName: string;
  distanceVA: { od: string; os: string };
  nearVA: { od: string; os: string };
  contrastSensitivity: number;
  visualFieldConstriction: boolean;
  centralScotoma: boolean;
  preferredRetinalLocus: string;
  magnificationNeeded: number;
  lightingAssessment: string;
  recommendedAids: string[];
  trainingPlan: string;
  assessedBy: string;
  assessedAt: string;
}

/** 斜视检查 */
export interface StrabismusExam {
  id: string;
  patientId: string;
  patientName: string;
  age: number;
  eyeSide: EyeSide;
  type: 'esotropia' | 'exotropia' | 'hypertropia' | 'hypotropia' | 'dissociated_vertical';
  pattern: 'constant' | 'intermittent' | 'alternating';
  distanceDeviation: number;
  nearDeviation: number;
  acRatio: number;
  stereoacuity: number;
  worth4Dot: string;
  coverTest: string;
  extraocularMovements: string;
  cycloplegicRefraction: string;
  treatment: string;
  followUp: string;
}

/** 神经眼科检查 */
export interface NeuroOphthalmicExam {
  id: string;
  patientId: string;
  patientName: string;
  chiefComplaint: string;
  visualAcuityOd: string;
  visualAcuityOs: string;
  colorVisionOd: number;
  colorVisionOs: number;
  visualFieldDefect: string;
  pupillaryExam: string;
  opticDiscAppearance: string;
  extraocularMotility: string;
  ptosis: boolean;
  proptosis: boolean;
  HertelExophthalmometry: { od: number; os: number; base: number };
  imagingFindings: string;
  diagnosis: string;
  management: string;
  referredTo: string;
  examinedBy: string;
  examinedAt: string;
}

/** 眼肿瘤记录 */
export interface OcularOncologyRecord {
  id: string;
  patientId: string;
  patientName: string;
  tumorType: 'uveal_melanoma' | 'retinoblastoma' | 'choroidal_nevus' | 'choroidal_hemangioma' | 'optic_nerve_glioma' | 'orbital_lymphoma' | 'basal_cell' | 'squamous_cell' | 'sebaceous_cell' | 'metastasis';
  eyeSide: EyeSide;
  location: string;
  sizeMm: { length: number; width: number; height: number };
  pigmentation: string;
  ultrasoundFeatures: string;
  octFeatures: string;
  biopsyResult?: string;
  geneticMarkers?: string[];
  tnmStaging?: string;
  treatmentPlan: string;
  followUpInterval: string;
  status: 'active_surveillance' | 'under_treatment' | 'remission' | 'recurrence' | 'metastatic';
  oncologist: string;
  lastReview: string;
}

/** 手术器械 */
export interface SurgicalInstrument {
  id: string;
  name: string;
  category: 'phaco' | 'vitrectomy' | 'glaucoma' | 'refractive' | 'corneal' | 'orbital' | 'general';
  manufacturer: string;
  model: string;
  serialNumber: string;
  purchaseDate: string;
  lastServiceDate: string;
  nextServiceDate: string;
  sterilizationCycles: number;
  maxCycles: number;
  status: 'sterile' | 'in_use' | 'needs_sterilization' | 'in_repair' | 'retired';
  location: string;
  notes?: string;
}

/** 灭菌记录 */
export interface SterilizationRecord {
  id: string;
  instrumentId: string;
  instrumentName: string;
  cycleNumber: number;
  method: 'autoclave' | 'ethylene_oxide' | 'plasma' | 'chemical';
  date: string;
  operator: string;
  temperature: number;
  duration: number;
  biologicalIndicator: boolean;
  chemicalIndicator: boolean;
  result: 'passed' | 'failed';
  notes?: string;
}

/** 流程代码映射 */
export interface ProcedureCode {
  code: string;
  name: string;
  category: string;
  rvu: number;
  medicareReimbursement: number;
  typicalCharge: number;
  typicalDuration: number;
  requiresAssistant: boolean;
  facilityType: string[];
  anesthesiaRequired: boolean;
  preOpPrep: string;
  postOpCare: string;
}

/** 文献引用 */
export interface JournalReference {
  id: string;
  title: string;
  authors: string[];
  journal: string;
  year: number;
  volume: string;
  issue: string;
  pages: string;
  pmid: string;
  doi: string;
  keywords: string[];
  abstract: string;
  evidenceLevel: string;
  citedBy: number;
}

/** 临床试验 */
export interface ClinicalTrial {
  id: string;
  nctNumber: string;
  title: string;
  condition: string;
  phase: '0' | 'I' | 'II' | 'III' | 'IV';
  enrollment: number;
  status: 'not_yet_recruiting' | 'recruiting' | 'active' | 'completed' | 'terminated';
  sponsor: string;
  interventions: string[];
  inclusionCriteria: string[];
  exclusionCriteria: string[];
  locations: string[];
  startDate: string;
  completionDate?: string;
  results?: string;
}


export type EyeStudy = any;
