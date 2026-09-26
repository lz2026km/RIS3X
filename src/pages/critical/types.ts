export interface TimelineEvent {
  time: string
  event: string
  user: string
  detail?: string
}

export interface DocumentItem {
  id: string
  name: string
  type: string
  uploadTime: string
  url?: string
}

/**
 * v3.0.6.11: CriticalValue.status 改为与 criticalStore 的状态机对齐。
 * 中文旧值('待处理'/'处理中'/'已处理'/'超时')由 store.statusToCn() 反向映射。
 */
export type CriticalValueStatus =
  | 'pending'
  | 'notified'
  | 'voice_called'
  | 'acknowledged'
  | 'receipted'
  | 'resolving'
  | 'resolved'
  | 'closed_loop'
  | 'escalated'
  | 'cancelled'
  | 'overdue'

export interface CriticalValue {
  id: string
  reportId: string
  examId: string
  patientId: string
  patientName: string
  gender: string
  age: number
  patientType: string
  phone?: string
  contactPerson?: string
  modality: string
  examItemName: string
  bodyPart?: string
  criticalFinding: string
  findingDetails: string
  severity: '危及生命' | '危急' | '高危' | '紧急' | '警告'
  resultValue?: string
  resultUnit?: string
  normalRange?: string
  criticalRange?: string
  exceedRatio?: string
  reportedBy: string
  reportedByName: string
  reportedTime: string
  createdAt?: string
  receivingDoctorId?: string
  receivingDoctorName?: string
  receivingTime?: string
  receivingDepartment?: string
  notificationMethod?: string
  acknowledged?: boolean
  acknowledgedBy?: string
  acknowledgedTime?: string
  voiceCalledAt?: string
  voiceCalledBy?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmedSignature?: string
  confirmedComment?: string
  status: CriticalValueStatus | string
  state?: CriticalValueStatus | string
  processingDoctor?: string
  processingDoctorName?: string
  processingTime?: string
  processingDepartment?: string
  processingMeasure?: string
  processingResult?: string
  processingDuration?: string
  followUpNotes?: string
  examDoctor?: string
  examDoctorName?: string
  examTime?: string
  deviceName?: string
  accessionNumber?: string
  timeline: TimelineEvent[]
  documents?: DocumentItem[]
  transferredToFollowUp?: boolean
  followUpId?: string
  followUpDate?: string
}

export interface ClosedLoopStage5 {
  key: string
  label: string
  time?: string
  user?: string
  measure?: string
  done: boolean
  active: boolean
}

export interface FollowUpRecord {
  id: string
  time: string
  type: '电话回访' | '短信确认' | '现场走访' | '系统通知'
  result: '已回复' | '无响应' | '转接成功' | '需再次回访'
  operator: string
  content: string
  relatedCVId?: string
  followUpDate?: string
}

export const PRIMARY_COLOR = '#1e40af'
export const PRIMARY_LIGHT = '#3b82f6'
export const PRIMARY_BG = '#eff6ff'

/**
 * v3.0.6.11: STATUS_CONFIG 改为以 criticalStore 的英文状态为 key。
 * 兼容旧的中文 status: '待处理'→'pending' / '处理中'→'resolving' /
 * '已处理'→'resolved' / '超时'→'overdue'
 */
export const STATUS_CONFIG: Record<string, { bg: string; color: string; label: string }> = {
  pending: { bg: '#fee2e2', color: '#dc2626', label: '待处理' },
  notified: { bg: '#fef3c7', color: '#d97706', label: '已通知' },
  voice_called: { bg: '#fef2f2', color: '#ea580c', label: '电话通知' },
  acknowledged: { bg: '#dbeafe', color: '#2563eb', label: '已接收' },
  receipted: { bg: '#f0fdf4', color: '#16a34a', label: '已回执' },
  resolving: { bg: '#fef3c7', color: '#d97706', label: '处理中' },
  resolved: { bg: '#d1fae5', color: '#059669', label: '已处理' },
  closed_loop: { bg: '#dcfce7', color: '#047857', label: '已闭环' },
  escalated: { bg: '#fecaca', color: '#991b1b', label: '已升级' },
  cancelled: { bg: '#f1f5f9', color: '#64748b', label: '已取消' },
  overdue: { bg: '#fecaca', color: '#991b1b', label: '超时' },
  // legacy Chinese keys → 兼容
  '待处理': { bg: '#fee2e2', color: '#dc2626', label: '待处理' },
  '处理中': { bg: '#fef3c7', color: '#d97706', label: '处理中' },
  '已处理': { bg: '#d1fae5', color: '#059669', label: '已处理' },
  '超时': { bg: '#fecaca', color: '#991b1b', label: '超时' },
}

/** 中文 status → criticalStore 英文 status */
export const CN_STATUS_TO_STORE: Record<string, string> = {
  '待处理': 'pending',
  '处理中': 'resolving',
  '已处理': 'resolved',
  '超时': 'overdue',
}

export function toStoreStatus(raw: string): string {
  if (!raw) return raw
  if (raw in CN_STATUS_TO_STORE) return CN_STATUS_TO_STORE[raw] ?? raw
  return raw
}

export const SEVERITY_CONFIG: Record<string, { bg: string; color: string; borderColor: string; slaMinutes: number; label: string }> = {
  '危及生命': { bg: '#fef2f2', color: '#dc2626', borderColor: '#dc2626', slaMinutes: 5, label: '危及生命' },
  '危急': { bg: '#fee2e2', color: '#ef4444', borderColor: '#ef4444', slaMinutes: 10, label: '危急' },
  '高危': { bg: '#fffbeb', color: '#f97316', borderColor: '#f97316', slaMinutes: 30, label: '高危' },
  '紧急': { bg: '#eff6ff', color: '#eab308', borderColor: '#eab308', slaMinutes: 120, label: '紧急' },
  '警告': { bg: '#f0f9ff', color: '#3b82f6', borderColor: '#3b82f6', slaMinutes: 1440, label: '警告' },
}
