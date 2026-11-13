/**
 * G005 RIS v3.0.5.1 - R3.REVIEW 审核流类型定义
 */
export type ReviewStage = "initial" | "final" | "cosign" | "sign";
export type ReviewDecision =
  "approve" | "reject" | "escalate" | "withdraw" | "request-info";
export type ReviewerRole =
  "resident" | "attending" | "associateChief" | "chief" | "director";
export type ReviewerStatus = "online" | "away" | "busy" | "offline";

export interface ReviewTask {
  id: string;
  reportId: string;
  examId?: string;
  requestedLaterality?: string | null;
  patientId: string;
  patientName: string;
  gender: "男" | "女" | "其他";
  age: number;
  modality: string;
  bodyPart: string;
  priority: "routine" | "urgent" | "stat" | "critical";
  stage: ReviewStage;
  status:
    | "pending"
    | "in-progress"
    | "completed"
    | "rejected"
    | "overdue"
    | "escalated"
    | "cosign-required";
  authorId: string;
  authorName: string;
  authorTitle: string;
  submittedAt: string;
  deadline: string;
  completedAt?: string;
  initialReviewerId?: string;
  initialReviewerName?: string;
  initialReviewAt?: string;
  initialReviewScore?: number;
  initialReviewComment?: string;
  finalReviewerId?: string;
  finalReviewerName?: string;
  finalReviewAt?: string;
  finalReviewScore?: number;
  finalReviewComment?: string;
  cosignReviewerId?: string;
  cosignReviewerName?: string;
  cosignAt?: string;
  cosignCertificateId?: string;
  rejectReason?: string;
  rejectCategory?: RejectCategory;
  rectifyCount: number;
  qualityScore: number;
  criticalFinding: boolean;
  isOverdue: boolean;
  hoursToDeadline: number;
  flags: string[];
  history: ReviewHistoryEntry[];
  auditChain?: AuditChainStep[];
  needsCosign: boolean;
  cosignReason?: string;
  attachments?: ReviewAttachment[];
  aiPreReview?: AIPreReviewResult;
}

export type RejectCategory =
  | "unclear-description"
  | "terminology-error"
  | "left-right-confusion"
  | "missing-key-finding"
  | "inconsistent-with-image"
  | "missing-recommendation"
  | "critical-not-marked"
  | "other";

export interface RejectTemplate {
  id: string;
  category: RejectCategory;
  title: string;
  body: string;
  presetComment: string;
  requiredMinLength: number;
  suggestedScore?: number;
  isSystem: boolean;
  createdBy?: string;
}

export interface ReviewHistoryEntry {
  id: string;
  taskId: string;
  reportId: string;
  action:
    | "submit"
    | "assign"
    | "start-initial"
    | "approve-initial"
    | "reject"
    | "start-final"
    | "approve-final"
    | "start-cosign"
    | "complete-cosign"
    | "escalate"
    | "withdraw"
    | "reopen"
    | "rectify"
    | "request-info";
  actorId: string;
  actorName: string;
  actorRole: ReviewerRole;
  comment?: string;
  score?: number;
  reason?: string;
  fromStage:
    ReviewStage | "submitted" | "rejected" | "rectifying" | "withdrawn";
  toStage:
    | ReviewStage
    | "reviewed"
    | "rejected"
    | "rectifying"
    | "withdrawn"
    | "cosignReview";
  timestamp: string;
  ipAddress?: string;
  hash?: string;
}

export interface ReviewComment {
  id: string;
  taskId: string;
  reportId: string;
  authorId: string;
  authorName: string;
  authorColor: string;
  content: string;
  fieldRef?: string;
  selectionRef?: string;
  position: { x: number; y: number };
  resolved: boolean;
  parentId?: string;
  mentions: string[];
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface Reviewer {
  id: string;
  name: string;
  title: ReviewerRole;
  titleLabel: string;
  department: string;
  avatar?: string;
  status: ReviewerStatus;
  currentLoad: number;
  maxLoad: number;
  pendingCount: number;
  inProgressCount: number;
  completedToday: number;
  avgReviewMinutes: number;
  onTimeRate: number;
  rejectionRate: number;
  specialty: string[];
  email?: string;
  phone?: string;
  lastActiveAt?: string;
}

export interface CosignSchedule {
  id: string;
  date: string;
  shiftType: "morning" | "afternoon" | "evening" | "night";
  reviewerId: string;
  reviewerName: string;
  reviewerTitle: ReviewerRole;
  maxCapacity: number;
  reserved: number;
  startTime: string;
  endTime: string;
  status: "scheduled" | "on-duty" | "off-duty" | "leave";
  note?: string;
}

export interface SLAMetrics {
  initialReviewSLA: number;
  finalReviewSLA: number;
  signSLA: number;
  cosignSLA: number;
  escalateSLA: number;
  onTimeRate: number;
  overdueCount: number;
  averageInitialMinutes: number;
  averageFinalMinutes: number;
  averageCosignMinutes: number;
  p95InitialMinutes: number;
  p95FinalMinutes: number;
  breachByStage: Record<ReviewStage, number>;
}

export interface WorkloadStat {
  reviewerId: string;
  reviewerName: string;
  reviewerTitle: ReviewerRole;
  period: "day" | "week" | "month";
  totalAssigned: number;
  totalCompleted: number;
  totalRejected: number;
  totalEscalated: number;
  averageMinutes: number;
  onTimeRate: number;
  rejectionRate: number;
  byStage: { stage: ReviewStage; count: number; avgMinutes: number }[];
  byModality: { modality: string; count: number }[];
  byPriority: { priority: string; count: number }[];
  trend: { date: string; completed: number; rejected: number }[];
}

export interface AIPreReviewResult {
  id: string;
  reportId: string;
  suggestedScore: number;
  confidence: number;
  defects: {
    code: string;
    name: string;
    severity: "minor" | "major" | "critical";
    position?: string;
    suggestion?: string;
  }[];
  suggestions: string[];
  riskLevel: "low" | "medium" | "high" | "critical";
  consistencyScore: number;
  completenessScore: number;
  terminologyScore: number;
  criticalFindingDetected: boolean;
  generatedAt: string;
  modelVersion: string;
}

export interface ReviewAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileType: "image" | "pdf" | "doc" | "other";
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  url: string;
}

export interface ReviewerAssignment {
  id: string;
  taskId: string;
  reviewerId: string;
  reviewerName: string;
  assignedBy: string;
  assignedAt: string;
  strategy: "manual" | "auto-workload" | "auto-shift" | "round-robin";
  note?: string;
}

export interface AuditChainStep {
  id: string;
  step:
    | "submit"
    | "initial"
    | "final"
    | "cosign"
    | "sign"
    | "publish"
    | "amend"
    | "archive";
  actorId: string;
  actorName: string;
  action: string;
  detail?: string;
  timestamp: string;
  hash: string;
  prevHash?: string;
  signature?: string;
}

export interface ReviewFilter {
  stage?: ReviewStage | "all";
  status?: string;
  priority?: string;
  modality?: string;
  reviewerId?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  criticalOnly?: boolean;
  overdueOnly?: boolean;
}

export interface ReviewKPI {
  totalToday: number;
  pendingInitial: number;
  inProgressInitial: number;
  pendingFinal: number;
  inProgressFinal: number;
  pendingCosign: number;
  pendingSign: number;
  rejected: number;
  overdue: number;
  completedToday: number;
  avgInitialHours: number;
  avgFinalHours: number;
  avgCosignHours: number;
  onTimeRate: number;
  rejectionRate: number;
  criticalHandledRate: number;
  cosignPendingHours: number;
}
