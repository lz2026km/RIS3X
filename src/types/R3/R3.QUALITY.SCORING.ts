/**
 * G005 RIS v3.0.5.1 - R3.QUALITY.SCORING 质控评分类型
 *
 * 80 点 = 60 点 (15 维度评分 5 完整+5 准确+5 时效) + 20 点 (阈值/历史/报表/奖励联动/模板)
 *
 * 模块: A5-REPORT / R3.QUALITY
 * 状态机事件: PUBLISH (qualityScoreSufficient >= 60)
 */
export type ScoringDimensionCategory =
  "completeness" | "accuracy" | "timeliness";

export type ScoringDimensionKey =
  | "completeness_findings"
  | "completeness_impression"
  | "completeness_recommendation"
  | "completeness_structured"
  | "completeness_signature"
  | "accuracy_diagnosis_match"
  | "accuracy_anatomy_laterality"
  | "accuracy_clinical_reference"
  | "accuracy_critical_marking"
  | "accuracy_no_contradiction"
  | "timeliness_tat_met"
  | "timeliness_priority_handling"
  | "timeliness_on_time_rate"
  | "timeliness_submit_within_window"
  | "timeliness_sign_within_window";

export type ScoringGrade = "A" | "B" | "C" | "D";

export type BonusLinkageType =
  | "priority-distribution"
  | "template-promotion"
  | "kpi-bonus"
  | "peer-review-shortcut"
  | "publish-fast-track";

export interface ScoringDimension {
  key: ScoringDimensionKey;
  category: ScoringDimensionCategory;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  weight: number;
  enabled: boolean;
  color: string;
  icon: string;
  rules: ScoringRule[];
  passingRule: string;
  passingRuleEn: string;
  source?: "demo" | "database";
}

export interface ScoringRule {
  key: string;
  name: string;
  nameEn: string;
  description: string;
  weight: number;
  evaluator: "auto" | "manual" | "ai" | "hybrid";
  detector?: string;
}

export interface ScoringThresholdConfig {
  grade: ScoringGrade;
  minScore: number;
  maxScore: number;
  color: string;
  bg: string;
  border: string;
  label: string;
  labelEn: string;
  publishable: boolean;
  bonusEligible: boolean;
  description: string;
  descriptionEn: string;
  source?: "demo" | "database";
}

export interface ThresholdConfig {
  id: string;
  criticalMaxMinutes: number;
  emergencyMaxHours: number;
  routineMaxHours: number;
  inpatientMaxHours: number;
  publishBlockThreshold: number;
  bonusThreshold: number;
  hardFailCodes: string[];
  updatedAt: string;
  updatedBy: string;
  version: number;
  source?: "demo" | "database";
}

export interface ScoreHistoryEntry {
  id: string;
  scoreId: string;
  reportId: string;
  patientName: string;
  modality: string;
  doctorId: string;
  doctorName: string;
  department: string;
  categoryScores: Record<ScoringDimensionCategory, number>;
  totalScore: number;
  grade: ScoringGrade;
  evaluatedBy: string;
  evaluatedAt: string;
  trigger: "submit" | "review" | "sign" | "manual";
  deltaVsPrev?: number;
  notes?: string;
  source?: "demo" | "database";
}

export interface QualityScoreReportItem {
  dimension: ScoringDimensionKey;
  category: ScoringDimensionCategory;
  name: string;
  score: number;
  weight: number;
  weightedScore: number;
  issues: Array<{
    code: string;
    description: string;
    severity: "minor" | "major" | "critical";
  }>;
}

export interface QualityScoreReport {
  id: string;
  scoreId: string;
  reportId: string;
  generatedAt: string;
  generatedBy: string;
  totalScore: number;
  grade: ScoringGrade;
  categoryScores: Record<
    ScoringDimensionCategory,
    { raw: number; weighted: number; weight: number }
  >;
  items: QualityScoreReportItem[];
  summary: {
    strengths: string[];
    weaknesses: string[];
    recommendations: string[];
  };
  bonusEligible: boolean;
  publishable: boolean;
  format: "pdf" | "word" | "excel" | "html";
  downloadUrl?: string;
}

export interface BonusLinkage {
  id: string;
  type: BonusLinkageType;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  thresholdScore: number;
  active: boolean;
  enabled: boolean;
  benefits: string[];
  beneficiariesCount: number;
  triggeredCount: number;
  lastTriggeredAt?: string;
  source?: "demo" | "database";
}

export interface TemplateScoreRule {
  templateId: string;
  templateName: string;
  modality: string;
  bodyPart: string;
  baseScore: number;
  bonusRules: Array<{
    dimension: ScoringDimensionKey;
    bonus: number;
    description: string;
  }>;
  penaltyRules: Array<{
    dimension: ScoringDimensionKey;
    penalty: number;
    description: string;
  }>;
  passingScore: number;
  published: boolean;
  source?: "demo" | "database";
}

export interface ScoreTemplateResult {
  templateId: string;
  templateName: string;
  baseScore: number;
  bonusApplied: number;
  penaltyApplied: number;
  finalScore: number;
  passingScore: number;
  passed: boolean;
  details: Array<{
    dimension: ScoringDimensionKey;
    base: number;
    bonus: number;
    penalty: number;
    final: number;
  }>;
}

export interface ScoringSubmission {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  bodyPart: string;
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  department: string;
  findings: string;
  impression: string;
  diagnosis: string;
  recommendation: string;
  criticalMarked: boolean;
  structuredFieldsComplete: number;
  signed: boolean;
  submitAt: string;
  reviewStartedAt: string;
  signedAt: string;
  priority: "stat" | "urgent" | "routine";
  templateId?: string;
}

export interface ScoringEvaluationResult {
  scoreId: string;
  reportId: string;
  dimensionScores: Record<ScoringDimensionKey, number>;
  categoryScores: Record<ScoringDimensionCategory, number>;
  weightedTotal: number;
  totalScore: number;
  grade: ScoringGrade;
  passed: boolean;
  publishable: boolean;
  bonusEligible: boolean;
  hardFailTriggered: string[];
  evaluatedAt: string;
  modelVersion: string;
  evaluator: "auto" | "ai" | "manual" | "hybrid";
  evidence: Array<{
    dimension: ScoringDimensionKey;
    rule: string;
    score: number;
    explanation: string;
  }>;
  durationMs: number;
}

export interface QualityScoringKPI {
  totalEvaluated: number;
  avgTotal: number;
  avgByCategory: Record<ScoringDimensionCategory, number>;
  gradeDistribution: Record<ScoringGrade, number>;
  publishableRate: number;
  bonusEligibleRate: number;
  hardFailRate: number;
  dimensionPassRate: Record<ScoringDimensionKey, number>;
  trend30d: Array<{
    date: string;
    avgScore: number;
    evaluated: number;
    gradeA: number;
  }>;
  doctorRanking: Array<{
    doctorId: string;
    doctorName: string;
    avgScore: number;
    bonusCount: number;
    rank: number;
  }>;
  templateRanking: Array<{
    templateId: string;
    templateName: string;
    avgScore: number;
    usageCount: number;
    rank: number;
  }>;
  source?: "demo" | "database";
}

export interface ScoreHistoryQuery {
  doctorId?: string;
  department?: string;
  modality?: string;
  grade?: ScoringGrade;
  dateFrom?: string;
  dateTo?: string;
  trigger?: ScoreHistoryEntry["trigger"];
  page?: number;
  pageSize?: number;
}

export interface ScoreHistoryResponse {
  items: ScoreHistoryEntry[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
