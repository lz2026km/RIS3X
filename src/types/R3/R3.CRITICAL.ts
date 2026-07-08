/**
 * G005 RIS v3.0.5.1 - R3.CRITICAL 危急值类型定义
 */
export type CriticalLevel = 'critical' | 'urgent' | 'warning' | 'info';
export type CriticalStatus = 'pending' | 'notified' | 'acknowledged' | 'resolved' | 'overdue' | 'escalated' | 'cancelled';
export type NotificationChannel = 'phone' | 'sms' | 'wechat' | 'inApp' | 'email' | 'pager';
export type CriticalCategory =
  | 'neuro'
  | 'cardio'
  | 'pulmo'
  | 'abdomen'
  | 'trauma'
  | 'vascular'
  | 'contrast'
  | 'obstetric'
  | 'pediatric'
  | 'other';

export interface CriticalRule {
  id: string;
  code: string;
  name: string;
  nameEn: string;
  category: CriticalCategory;
  level: CriticalLevel;
  modality: string[];
  bodyPart: string[];
  keywords: string[];
  findings: string;
  channels: NotificationChannel[];
  responseDeadline: number;
  escalateDeadline?: number;
  description: string;
  reference: string;
  isActive: boolean;
  customRule: boolean;
  triggerCount: number;
  hitRate: number;
  lastTriggeredAt?: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  veto: boolean;
  dualReviewRequired: boolean;
}

export interface CriticalEvent {
  id: string;
  ruleId: string;
  ruleCode: string;
  ruleName: string;
  level: CriticalLevel;
  reportId: string;
  examId: string;
  patientId: string;
  patientName: string;
  gender: '男' | '女' | '其他';
  age: number;
  modality: string;
  bodyPart: string;
  reportedById: string;
  reportedByName: string;
  reportedByTitle: string;
  reportedAt: string;
  receivingDoctorId?: string;
  receivingDoctorName?: string;
  receivingTime?: string;
  acknowledgedById?: string;
  acknowledgedByName?: string;
  acknowledgedTime?: string;
  resolvedTime?: string;
  status: CriticalStatus;
  channels: NotificationChannel[];
  channelAttempts: Array<{ channel: NotificationChannel; attemptedAt: string; success: boolean; recipientId?: string }>;
  detail: string;
  responseTimeMinutes?: number;
  onTimeNotification: boolean;
  escalatedAt?: string;
  escalatedToId?: string;
  escalatedToName?: string;
  escalationReason?: string;
  escalationLevel: number;
  sop: CriticalSopStep[];
  dualReview?: {
    firstReviewerId?: string;
    firstReviewerName?: string;
    firstReviewAt?: string;
    secondReviewerId?: string;
    secondReviewerName?: string;
    secondReviewAt?: string;
  };
  note?: string;
  attachments?: CriticalAttachment[];
  veto?: boolean;
  dualReviewRequired?: boolean;
  hash: string;
  auditChain?: AuditStep[];
}

export interface CriticalSopStep {
  step: number;
  title: string;
  description: string;
  action: string;
  deadlineMinutes: number;
  completed?: boolean;
  completedAt?: string;
  completedBy?: string;
}

export interface CriticalAttachment {
  id: string;
  fileName: string;
  fileType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
}

export interface AuditStep {
  id: string;
  action: string;
  actorId: string;
  actorName: string;
  detail?: string;
  timestamp: string;
  hash: string;
  prevHash?: string;
}

export interface CriticalLevelConfig {
  level: CriticalLevel;
  label: string;
  labelEn: string;
  color: string;
  bg: string;
  border: string;
  defaultChannels: NotificationChannel[];
  responseDeadline: number;
  description: string;
  priority: number;
}

export interface CriticalEscalationRule {
  id: string;
  triggerAfterMinutes: number;
  fromLevel: CriticalLevel;
  toRole: 'attending' | 'associateChief' | 'chief' | 'director' | 'medicalAffairs';
  toRoleLabel: string;
  channels: NotificationChannel[];
  messageTemplate: string;
  enabled: boolean;
  priority: number;
}

export interface CriticalKPI {
  totalThisMonth: number;
  pendingCount: number;
  notifiedCount: number;
  acknowledgedCount: number;
  resolvedCount: number;
  overdueCount: number;
  onTimeNotificationRate: number;
  avgResponseTimeMinutes: number;
  medianResponseTimeMinutes: number;
  p95ResponseTimeMinutes: number;
  topRules: Array<{ ruleCode: string; ruleName: string; count: number; rate: number }>;
  byCategory: Record<CriticalCategory, number>;
  byModality: Record<string, number>;
  byLevel: Record<CriticalLevel, number>;
  byStatus: Record<CriticalStatus, number>;
  byDoctor: Array<{ doctorId: string; doctorName: string; reportedCount: number; avgTime: number; onTimeRate: number }>;
  trend30d: Array<{ date: string; count: number; resolvedCount: number; onTimeRate: number }>;
  missedReports: number;
  dualReviewCompletion: number;
}

export interface CriticalStat {
  eventId: string;
  patientName: string;
  ruleName: string;
  level: CriticalLevel;
  status: CriticalStatus;
  reportedAt: string;
  reportedByName: string;
  receivingDoctorName?: string;
  responseTimeMinutes?: number;
  onTime: boolean;
  channels: NotificationChannel[];
}
