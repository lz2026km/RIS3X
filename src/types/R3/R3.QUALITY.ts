/**
 * G005 RIS v3.0.5.1 - R3.QUALITY 质控类型定义
 */
export type QualityGrade = '甲' | '乙' | '丙' | '丁';
export type QualityDimensionKey =
  | 'completeness'
  | 'standardization'
  | 'accuracy'
  | 'timeliness'
  | 'terminology'
  | 'criticalMarking'
  | 'consistency'
  | 'imageQuality';

export interface QualityDimension {
  key: QualityDimensionKey;
  name: string;
  nameEn: string;
  description: string;
  descriptionEn: string;
  weight: number;
  enabled: boolean;
  subCriteria: QualitySubCriterion[];
  color: string;
  icon: string;
}

export interface QualitySubCriterion {
  key: string;
  name: string;
  nameEn: string;
  weight: number;
  description: string;
  evaluator: 'auto' | 'manual' | 'ai';
  passingRule: string;
}

export interface QualityScore {
  id: string;
  reportId: string;
  patientName: string;
  modality: string;
  doctorId: string;
  doctorName: string;
  doctorTitle: string;
  dimensionScores: Record<QualityDimensionKey, number>;
  subScores: Record<string, number>;
  totalScore: number;
  grade: QualityGrade;
  defects: string[];
  defectDetails: QualityDefectHit[];
  evaluatedBy: string;
  evaluatedAt: string;
  modelVersion: string;
  reviewStatus: 'pending' | 'reviewed' | 're-reviewed' | 'overridden';
  overrideReason?: string;
  overriddenBy?: string;
  overriddenAt?: string;
  hash: string;
  signedBy?: string;
  signedAt?: string;
  evidenceChain?: QualityEvidence[];
}

export interface QualityEvidence {
  id: string;
  dimension: QualityDimensionKey;
  subKey: string;
  evidence: string;
  location?: string;
  weight: number;
  score: number;
  timestamp: string;
}

export interface QualityGradeConfig {
  grade: QualityGrade;
  minScore: number;
  maxScore: number;
  color: string;
  bg: string;
  border: string;
  description: string;
  descriptionEn: string;
  action: string;
  publishable: boolean;
}

export interface QualityWeightConfig {
  completeness: number;
  standardization: number;
  accuracy: number;
  timeliness: number;
  terminology: number;
  criticalMarking: number;
  consistency: number;
  imageQuality: number;
  updatedAt: string;
  updatedBy: string;
  version: number;
}

export interface QualityKPI {
  totalEvaluated: number;
  avgScore: number;
  p50Score: number;
  p95Score: number;
  gradeDistribution: Record<QualityGrade, number>;
  gradeRate: Record<QualityGrade, number>;
  defectTopList: Array<{ code: string; name: string; count: number; severity: string }>;
  doctorRanking: Array<{ doctorId: string; doctorName: string; avgScore: number; totalReports: number; rank: number }>;
  departmentRanking: Array<{ department: string; avgScore: number; totalReports: number; rank: number }>;
  aiAcceptanceRate: number;
  trend30d: Array<{ date: string; avgScore: number; evaluated: number; defectRate: number }>;
  autoRate: number;
  retrainingNeeded: number;
  criticalMissedCount: number;
}

export interface QualityDefectHit {
  code: string;
  name: string;
  category: DefectCategoryCode;
  severity: 'minor' | 'major' | 'critical';
  location?: string;
  context?: string;
  suggestion: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
}

export type DefectCategoryCode = 'DSC' | 'TER' | 'FMT' | 'LOG' | 'CRI' | 'CMP' | 'CON' | 'IMG' | 'TIM' | 'OTH';

export interface QualityDefect {
  id: string;
  code: string;
  name: string;
  nameEn?: string;
  category: DefectCategoryCode;
  severity: 'minor' | 'major' | 'critical';
  description: string;
  descriptionEn: string;
  examples: string[];
  solution: string;
  solutionEn: string;
  references?: string[];
  count: number;
  isActive: boolean;
  customDefect: boolean;
  level: 1 | 2;
  parentId?: string;
  tags: string[];
  triggerPattern?: string;
  exampleFix?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  sla?: number;
  trainingRequired?: boolean;
}

export interface MonthlyQualityReport {
  id: string;
  year: number;
  month: number;
  totalReports: number;
  avgScore: number;
  monthOverMonth: number;
  gradeDistribution: Record<QualityGrade, number>;
  defectStatistics: Array<{ code: string; name: string; count: number; changeRate: number }>;
  doctorRanking: Array<{ doctorId: string; doctorName: string; avgScore: number; total: number; rank: number }>;
  departmentRanking: Array<{ department: string; avgScore: number; total: number; rank: number }>;
  trends: Array<{ date: string; avgScore: number; evaluated: number; defects: number }>;
  topDefects: Array<{ code: string; name: string; count: number }>;
  criticalMissed: number;
  fixRate: number;
  autoRate: number;
  generatedAt: string;
  generatedBy: string;
  sections: MonthlyReportSection[];
}

export interface MonthlyReportSection {
  key: string;
  title: string;
  titleEn: string;
  content: string;
  charts?: Array<{ type: 'line' | 'bar' | 'pie' | 'table'; data: unknown; config?: unknown }>;
}

export interface QualityDashboard {
  realtime: {
    pendingEvaluation: number;
    completedToday: number;
    inProgressEvaluation: number;
    criticalMissedToday: number;
  };
  byModality: Array<{ modality: string; count: number; avgScore: number; passRate: number }>;
  byDoctor: Array<{ doctorId: string; doctorName: string; count: number; avgScore: number; passRate: number }>;
  byHour: Array<{ hour: number; count: number; avgScore: number }>;
  recentScores: Array<{ id: string; reportId: string; patientName: string; doctorName: string; score: number; grade: QualityGrade; evaluatedAt: string }>;
  alerts: Array<{ id: string; type: 'critical-miss' | 'low-score' | 'overdue-eval' | 'rejection-spike'; message: string; severity: 'warning' | 'critical'; timestamp: string }>;
}

export interface DefectRemediation {
  id: string;
  defectCode: string;
  defectName: string;
  reportId: string;
  patientName: string;
  doctorId: string;
  doctorName: string;
  reportedBy: string;
  reportedAt: string;
  deadlineAt: string;
  status: 'pending' | 'in-progress' | 'rectified' | 'overdue' | 'cancelled';
  severity: 'minor' | 'major' | 'critical';
  description: string;
  suggestedFix: string;
  rectifiedAt?: string;
  rectifiedNote?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  evidenceUrl?: string;
  remindersSent: number;
}

export interface QualityRuleVersion {
  id: string;
  version: string;
  effectiveAt: string;
  createdBy: string;
  createdAt: string;
  changes: Array<{ dimension: QualityDimensionKey; before: number; after: number; reason: string }>;
  status: 'draft' | 'active' | 'rolled-back' | 'archived';
  note?: string;
}

export interface QualityScoringConfig {
  weights: QualityWeightConfig;
  grades: QualityGradeConfig[];
  hardFailItems: string[];
  passThreshold: number;
  publishBlockThreshold: number;
  autoEvaluateOn: string[];
  modelVersion: string;
  useAI: boolean;
  useRadLex: boolean;
  useAcr: boolean;
  useRSNA: boolean;
}
