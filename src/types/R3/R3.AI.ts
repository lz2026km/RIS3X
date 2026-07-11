/**
 * G005 放射RIS系统 v3.0.5.1 - R3.AI 智能 类型定义
 * A5-REPORT 模块 / 80 点（全 mock）
 *
 * 覆盖:
 *  - AI 初稿 (.001 ~ .020)
 *  - AI 续写 + 预审 (.021 ~ .040)
 *  - AI 智能辅助 (.041 ~ .060)
 *  - AI 管理 + 监控 (.061 ~ .080)
 */

export type AIScenario =
  | 'chest-ct'
  | 'head-mri'
  | 'abdomen-ct'
  | 'spine-mri'
  | 'breast-mg'
  | 'cardiac-cta';

export const AI_SCENARIOS: { id: AIScenario; label: string; modality: string; description: string }[] = [
  { id: 'chest-ct', label: '胸部 CT', modality: 'CT', description: '肺结节/纵隔/胸膜' },
  { id: 'head-mri', label: '头颅 MRI', modality: 'MR', description: '脑梗塞/出血/占位' },
  { id: 'abdomen-ct', label: '腹部 CT', modality: 'CT', description: '肝胆胰脾肾' },
  { id: 'spine-mri', label: '脊柱 MRI', modality: 'MR', description: '椎间盘/脊髓/韧带' },
  { id: 'breast-mg', label: 'MG', modality: 'MG', description: 'BI-RADS 分类' },
  { id: 'cardiac-cta', label: '心脏 CTA', modality: 'CT', description: '冠脉/瓣膜/心肌' },
];

export const AI_MODEL_VERSION = 'v2.3-mock';
export const AI_RATE_LIMIT_PER_MIN = 100;
export const AI_TIMEOUT_MS = 30000;
export const AI_CACHE_TTL_MIN = 5;
export const AI_MIN_DELAY_MS = 200;
export const AI_MAX_DELAY_MS = 1500;

export type AIConfidenceLevel = 'high' | 'medium' | 'low';

export interface AIConfidence {
  overall: number;
  findings: number;
  diagnosis: number;
  impression: number;
  level: AIConfidenceLevel;
}

export const AI_CONFIDENCE_THRESHOLD: Record<AIConfidenceLevel, number> = {
  high: 0.85,
  medium: 0.6,
  low: 0,
};

export type AIDraftStage =
  | 'idle'
  | 'extracting-history'
  | 'analyzing-images'
  | 'generating-findings'
  | 'generating-diagnosis'
  | 'generating-impression'
  | 'post-processing'
  | 'done';

export const AI_DRAFT_STAGE_LABEL: Record<AIDraftStage, string> = {
  idle: '空闲',
  'extracting-history': '提取病史',
  'analyzing-images': '分析影像',
  'generating-findings': '生成所见',
  'generating-diagnosis': '生成诊断',
  'generating-impression': '生成意见',
  'post-processing': '后处理',
  done: '完成',
};

export interface AIDraftResult {
  id: string;
  reportId: string;
  scenario: AIScenario;
  clinicalHistory: string;
  findings: string;
  diagnosis: string;
  impression: string;
  recommendations?: string;
  confidence: AIConfidence;
  references: AIReference[];
  generatedAt: string;
  modelVersion: string;
  tokenUsage: { prompt: number; completion: number; total: number };
  processingMs: number;
}

export interface AIReference {
  id: string;
  title: string;
  source: string;
  url?: string;
  year?: number;
  excerpt?: string;
}

export interface AIPreReview {
  id: string;
  reportId: string;
  score: number;
  defects: AIDefect[];
  suggestions: AISuggestion[];
  diff: AIFieldDiff[];
  keyImages?: AIKeyImage[];
  criticalHits: AICriticalHit[];
  radsSuggestion?: AIRadsSuggestion;
  consistency: AIConsistency;
  terminology: AITerminologyCheck;
  confidence: AIConfidence;
  reviewedAt: string;
  modelVersion: string;
  processingMs: number;
}

export interface AIDefect {
  id: string;
  type: 'missing-key-finding' | 'terminology-error' | 'inconsistency' | 'grammar' | 'specification';
  field: 'examFindings' | 'diagnosis' | 'impression' | 'recommendations';
  severity: 'high' | 'medium' | 'low';
  description: string;
  location?: { start: number; end: number };
  fixSuggestion?: string;
}

export interface AISuggestion {
  id: string;
  category: 'rewrite' | 'expand' | 'shorten' | 'translate' | 'replace-synonym';
  field: 'examFindings' | 'diagnosis' | 'impression' | 'recommendations';
  before: string;
  after: string;
  rationale: string;
}

export interface AIFieldDiff {
  field: 'examFindings' | 'diagnosis' | 'impression' | 'recommendations';
  aiValue: string;
  doctorValue: string;
  agreementPercent: number;
  changedSections: { text: string; type: 'agree' | 'different' | 'ai-only' | 'doctor-only' }[];
}

export interface AIKeyImage {
  id: string;
  sopInstanceUid: string;
  seriesNumber: number;
  instanceNumber: number;
  reason: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface AICriticalHit {
  id: string;
  keyword: string;
  matchType: 'partial' | 'exact' | 'semantic';
  field: string;
  confidence: number;
  recommendation: string;
}

export interface AIRadsSuggestion {
  system: string;
  category: string;
  description: string;
  riskPercent: string;
  recommendation: string;
}

export interface AIConsistency {
  imageReportMatch: boolean;
  clinicalReportMatch: boolean;
  priorReportMatch: boolean;
  mismatchedFields: string[];
  score: number;
}

export interface AITerminologyCheck {
  totalTerms: number;
  matchedTerms: number;
  radlexHits: { term: string; radlexCode: string; replaced: boolean }[];
  snomedHits: { term: string; snomedCode: string }[];
}

export interface AIRiskPrediction {
  id: string;
  reportId: string;
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  riskScore: number;
  riskFactors: AIRiskFactor[];
  predictedOutcomes: AIOutcome[];
  earlyWarnings: AIWarning[];
  recommendedActions: string[];
  confidence: AIConfidence;
  predictedAt: string;
  modelVersion: string;
}

export interface AIRiskFactor {
  id: string;
  category: 'patient' | 'finding' | 'history' | 'comparison';
  name: string;
  weight: number;
  description: string;
  evidence?: string;
}

export interface AIOutcome {
  id: string;
  outcome: string;
  probability: number;
  timeframeDays: number;
  rationale: string;
}

export interface AIWarning {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  field?: string;
  suggestedAction?: string;
}

export interface AIDifferentialDx {
  id: string;
  reportId: string;
  primaryDiagnosis: string;
  differentials: AIDifferentialEntry[];
  recommendedTests: string[];
  similarCases: AISimilarCase[];
  confidence: AIConfidence;
  generatedAt: string;
  modelVersion: string;
}

export interface AIDifferentialEntry {
  id: string;
  diagnosis: string;
  icd10Code?: string;
  probability: number;
  supportingFindings: string[];
  contradictingFindings: string[];
  reasoning: string;
}

export interface AISimilarCase {
  id: string;
  reportId: string;
  patientAge: number;
  patientGender: string;
  diagnosis: string;
  similarity: number;
  thumbnail?: string;
  outcome?: string;
}

export interface AISynonymSuggestion {
  original: string;
  synonyms: string[];
  preferred: string;
  rationale: string;
}

export interface AILesionDetection {
  id: string;
  reportId: string;
  lesions: AIDetectedLesion[];
  modality: string;
  totalLesions: number;
  detectedAt: string;
}

export interface AIDetectedLesion {
  id: string;
  type: 'nodule' | 'mass' | 'calcification' | 'hemorrhage' | 'infarct' | 'other';
  location: string;
  sizeMm?: { length: number; width: number; height?: number };
  density?: number;
  measurements?: { type: 'length' | 'area' | 'volume' | 'density'; value: number; unit: string }[];
  classification: string;
  confidence: number;
  sopInstanceUid?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

export interface AIUsageLog {
  id: string;
  userId: string;
  reportId?: string;
  endpoint: string;
  requestTokens?: number;
  responseTokens?: number;
  processingMs: number;
  success: boolean;
  errorCode?: string;
  calledAt: string;
}

export interface AIHealth {
  status: 'healthy' | 'degraded' | 'down';
  avgLatencyMs: number;
  queueDepth: number;
  rateLimitRemaining: number;
  lastErrorAt?: string;
  lastErrorMessage?: string;
  checkedAt: string;
}

export interface AIQuota {
  userId: string;
  period: 'hour' | 'day' | 'month';
  used: number;
  limit: number;
  resetAt: string;
}

export interface AIReviewError {
  id: string;
  reportId?: string;
  errorCode: string;
  message: string;
  stack?: string;
  endpoint: string;
  occurredAt: string;
}

export const AI_ACCEPTANCE_RATE = 0.785;

export interface AIUsageRank {
  userId: string;
  userName: string;
  department: string;
  callsToday: number;
  callsMonth: number;
  acceptanceRate: number;
}