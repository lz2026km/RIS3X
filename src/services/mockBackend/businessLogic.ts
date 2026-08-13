// [v3.0.6.8-32] 业务逻辑核心 - 状态机 + SLA + 工作流

// ==================== 报告状态机 ====================
export type ReportStatus = 'draft' | 'submitted' | 'reviewed' | 'cosigned' | 'published' | 'rejected' | 'revised';

const REPORT_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  draft: ['submitted', 'rejected'],
  submitted: ['reviewed', 'rejected', 'revised'],
  reviewed: ['cosigned', 'published', 'rejected', 'revised'],
  cosigned: ['published', 'rejected'],
  // [v3.0.6.11-92 Wave2A P1] 补发自环: 已发布可重新发布 (对齐后端 REPORT_TRANSITIONS.PUBLISHED)
  published: ['revised', 'published'],
  rejected: ['draft', 'submitted'],
  revised: ['submitted', 'reviewed'],
};

export function canTransitionReport(from: ReportStatus, to: ReportStatus): boolean {
  return REPORT_TRANSITIONS[from]?.includes(to) || false;
}

export function transitionReport<T extends { status: ReportStatus }>(
  report: T,
  to: ReportStatus,
  reason?: string,
): T {
  if (!canTransitionReport(report.status, to)) {
    throw new Error(`Invalid report transition: ${report.status} → ${to}`);
  }
  const updated = {
    ...report,
    status: to,
    updatedTime: new Date().toISOString(),
    ...(to === 'rejected' && reason ? { rejectReason: reason } : {}),
  } as T;
  return updated;
}

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft: '草稿',
  submitted: '已提交',
  reviewed: '已审核',
  cosigned: '已双签',
  published: '已发布',
  rejected: '已驳回',
  revised: '已修订',
};

// ==================== 工作列表状态机 ====================
export type WorklistStatus = 'pending' | 'checkedIn' | 'inProgress' | 'completed' | 'cancelled';

// G005 P0: 统一为后端规范英文状态 (SCHEDULED/ARRIVED/IN_PROGRESS/COMPLETED/CANCELLED)
// 同时兼容旧 mock 状态机与历史中文状态。
export const WORKLIST_STATUS_ALIASES: Record<string, string> = {
  // 历史中文
  待登记: 'SCHEDULED',
  已登记: 'SCHEDULED',
  待检查: 'SCHEDULED',
  已报到: 'ARRIVED',
  检查中: 'IN_PROGRESS',
  已暂停: 'IN_PROGRESS',
  待报告: 'COMPLETED',
  已报告: 'COMPLETED',
  已发布: 'COMPLETED',
  已归档: 'COMPLETED',
  已取消: 'CANCELLED',
  质控退回: 'COMPLETED',
  检查异常: 'COMPLETED',
  // 旧 mock 状态机
  pending: 'SCHEDULED',
  checkedIn: 'ARRIVED',
  inProgress: 'IN_PROGRESS',
  completed: 'COMPLETED',
  cancelled: 'CANCELLED',
  // EXAM_REPORT_PRE 报告态
  draft: 'SCHEDULED',
  submitted: 'COMPLETED',
  reviewed: 'COMPLETED',
  cosigned: 'COMPLETED',
  published: 'COMPLETED',
};

export function normalizeWorklistStatus(s: string | undefined | null): string {
  if (!s) return 'SCHEDULED';
  return WORKLIST_STATUS_ALIASES[s] ?? s;
}

const WORKLIST_TRANSITIONS: Record<string, string[]> = {
  SCHEDULED: ['ARRIVED', 'CANCELLED'],
  ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['IMAGE_READY'],
  IMAGE_READY: ['QC_PASS', 'QC_REJECT'],
  QC_REJECT: ['IMAGE_READY'],
  QC_PASS: [],
  PENDING_REPORT: [],
  CANCELLED: [],
};

export function canTransitionWorklist(from: string, to: string): boolean {
  const fromNorm = normalizeWorklistStatus(from);
  const toNorm = normalizeWorklistStatus(to);
  return WORKLIST_TRANSITIONS[fromNorm]?.includes(toNorm) ?? false;
}

// ==================== 危急值 SLA 升级链 ====================
export type CriticalSeverity = 'life-threatening' | 'critical' | 'warning' | 'info';
export type CriticalStatus = 'pending' | 'notified' | 'acknowledged' | 'processed' | 'closed';

const SLA_BY_SEVERITY_MINUTES: Record<CriticalSeverity, number> = {
  'life-threatening': 5,
  critical: 15,
  warning: 30,
  info: 60,
};

const ESCALATION_CHAIN: Record<CriticalSeverity, string[]> = {
  'life-threatening': ['discoverDoctor', 'chief', 'director', 'medicalAffairs'],
  critical: ['discoverDoctor', 'chief', 'director'],
  warning: ['discoverDoctor', 'chief'],
  info: ['discoverDoctor'],
};

export function getSlaMinutes(severity: CriticalSeverity): number {
  return SLA_BY_SEVERITY_MINUTES[severity];
}

export function getEscalationTargets(severity: CriticalSeverity): string[] {
  return ESCALATION_CHAIN[severity] || [];
}

export function checkSlaBreach(
  severity: CriticalSeverity,
  discoveredAt: string,
): { breached: boolean; slaMinutes: number; elapsedMinutes: number } {
  const slaMinutes = getSlaMinutes(severity);
  const elapsedMinutes = (Date.now() - new Date(discoveredAt).getTime()) / 60000;
  return {
    breached: elapsedMinutes > slaMinutes,
    slaMinutes,
    elapsedMinutes: Math.round(elapsedMinutes),
  };
}

export function shouldEscalate(severity: CriticalSeverity, elapsedMinutes: number, currentLevel: number): boolean {
  const chain = ESCALATION_CHAIN[severity];
  if (currentLevel >= chain.length) return false;
  const sla = SLA_BY_SEVERITY_MINUTES[severity];
  // 每超时 50% 升级一级
  return elapsedMinutes > sla * (1 + currentLevel * 0.5);
}

// ==================== 双签触发条件 ====================
export type CosignTriggerReason = 'junior_author' | 'critical_value' | 'special_exam' | 'vip_patient' | 'complex_case' | 'low_quality';

export interface CosignTriggerInput {
  reportDoctorTitle: string;
  isCriticalValue: boolean;
  examItem: string;
  isVipPatient: boolean;
  qcScore: number;
  isComplex: boolean;
}

export function determineCosignTrigger(input: CosignTriggerInput): CosignTriggerReason | null {
  if (input.reportDoctorTitle === '住院医师') return 'junior_author';
  if (input.isCriticalValue) return 'critical_value';
  if (input.examItem.includes('增强') || input.examItem.includes('CTA') || input.examItem.includes('DSA')) return 'special_exam';
  if (input.isVipPatient) return 'vip_patient';
  if (input.isComplex) return 'complex_case';
  if (input.qcScore < 85) return 'low_quality';
  return null;
}

export function getCosignSlaMinutes(priority: '急诊' | '加急' | '普通' | '体检'): number {
  const map = { 急诊: 30, 加急: 60, 普通: 240, 体检: 480 };
  return map[priority];
}

// ==================== 审核 SLA ====================
export function getReviewSlaMinutes(priority: '急诊' | '加急' | '普通' | '体检'): number {
  const map = { 急诊: 30, 加急: 60, 普通: 120, 体检: 240 };
  return map[priority];
}

// ==================== 设备维护周期 ====================
export type MaintenanceCycle = '季度' | '半年' | '年度' | '按需';

export function getNextMaintenanceDate(lastDate: string, cycle: MaintenanceCycle): string {
  const last = new Date(lastDate);
  const next = new Date(last);
  switch (cycle) {
    case '季度': next.setMonth(next.getMonth() + 3); break;
    case '半年': next.setMonth(next.getMonth() + 6); break;
    case '年度': next.setFullYear(next.getFullYear() + 1); break;
    case '按需': next.setMonth(next.getMonth() + 1); break;
  }
  return next.toISOString().split('T')[0]!;
}

export function isMaintenanceOverdue(nextDate: string): boolean {
  return new Date(nextDate) < new Date();
}

export function daysUntilMaintenance(nextDate: string): number {
  const days = Math.ceil((new Date(nextDate).getTime() - Date.now()) / 86400000);
  return days;
}

// ==================== 影像质控等级判定 ====================
export type ImageQualityGrade = 'A' | 'B' | 'C' | 'D';

export function calculateImageGrade(params: {
  snrDb: number;
  cnr: number;
  uniformityPct: number;
  artifactScore: number; // 0-10, 越高越差
}): ImageQualityGrade {
  const { snrDb, cnr, uniformityPct, artifactScore } = params;
  let score = 100;
  if (snrDb < 40) score -= 15;
  else if (snrDb < 50) score -= 5;
  if (cnr < 3) score -= 20;
  else if (cnr < 5) score -= 10;
  if (uniformityPct < 70) score -= 15;
  else if (uniformityPct < 85) score -= 5;
  if (artifactScore > 5) score -= 30;
  else if (artifactScore > 2) score -= 15;
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  return 'D';
}

// ==================== 工作流日志 ====================
export interface WorkflowEvent {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  fromState?: string;
  toState?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const workflowEvents: WorkflowEvent[] = [];

export function recordWorkflowEvent(event: Omit<WorkflowEvent, 'id' | 'timestamp'>): WorkflowEvent {
  const full: WorkflowEvent = {
    id: `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    ...event,
  };
  workflowEvents.unshift(full);
  if (workflowEvents.length > 5000) workflowEvents.length = 5000;
  return full;
}

export function listWorkflowEvents(filter?: {
  entityType?: string;
  entityId?: string;
  limit?: number;
}): WorkflowEvent[] {
  let result = [...workflowEvents];
  if (filter?.entityType) result = result.filter(e => e.entityType === filter.entityType);
  if (filter?.entityId) result = result.filter(e => e.entityId === filter.entityId);
  if (filter?.limit) result = result.slice(0, filter.limit);
  return result;
}

// ==================== 限流 ====================
const rateLimitMap: Map<string, { count: number; windowStart: number }> = new Map();

export interface RateLimitOptions {
  maxPerMinute?: number;
  windowMs?: number;
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {},
): { allowed: boolean; remaining: number; resetIn: number } {
  const max = options.maxPerMinute || 100;
  const window = options.windowMs || 60000;
  const now = Date.now();
  const record = rateLimitMap.get(key);
  if (!record || now - record.windowStart > window) {
    rateLimitMap.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: max - 1, resetIn: window };
  }
  if (record.count >= max) {
    return {
      allowed: false,
      remaining: 0,
      resetIn: Math.max(0, window - (now - record.windowStart)),
    };
  }
  record.count++;
  return {
    allowed: true,
    remaining: max - record.count,
    resetIn: Math.max(0, window - (now - record.windowStart)),
  };
}

export function resetRateLimit(key?: string): void {
  if (key) rateLimitMap.delete(key);
  else rateLimitMap.clear();
}
