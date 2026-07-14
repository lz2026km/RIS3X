// RED11: Consolidated constants extracted from hardcoded values across the codebase

// ========== 状态枚举 ==========
export const EXAM_STATUS = {
  SCHEDULED: 'SCHEDULED',
  CONFIRMED: 'CONFIRMED',
  CHECKED_IN: 'CHECKED_IN',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
} as const

export const REPORT_STATUS = {
  DRAFT: 'DRAFT',
  PRELIMINARY: 'preliminary',
  PUBLISHED: 'published',
  REJECTED: 'REJECTED',
  REVISED: 'REVISED',
} as const

export const DEVICE_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  MAINTENANCE: 'MAINTENANCE',
  RETIRED: 'RETIRED',
} as const

export const PATIENT_STATUS = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  REMOVED: 'REMOVED',
  FAILED: 'FAILED',
} as const

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const

export const SEVERITY_LEVELS = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const

export const USER_ROLES = {
  DOCTOR: 'DOCTOR',
  TECHNICIAN: 'TECHNICIAN',
  NURSE: 'NURSE',
  ADMIN: 'ADMIN',
  DIRECTOR: 'DIRECTOR',
} as const

export const PRIORITY = {
  ROUTINE: 'ROUTINE',
  URGENT: 'URGENT',
  STAT: 'STAT',
} as const

export const PAYMENT_METHODS = {
  CASH: 'CASH',
  CARD: 'CARD',
  INSURANCE: 'INSURANCE',
  ALIPAY: 'ALIPAY',
  WECHAT: 'WECHAT',
} as const

export const NOTIFICATION_METHODS = {
  PHONE: 'PHONE',
  SMS: 'SMS',
  SYSTEM: 'SYSTEM',
  EMAIL: 'EMAIL',
  WECHAT: 'WECHAT',
  DINGTALK: 'DINGTALK',
} as const

export const QUALITY_GRADES = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
} as const

// ========== 映射字典 ==========
export const STATUS_COLOR_MAP: Record<string, string> = {
  [EXAM_STATUS.SCHEDULED]: 'blue',
  [EXAM_STATUS.CONFIRMED]: 'cyan',
  [EXAM_STATUS.IN_PROGRESS]: 'processing',
  [EXAM_STATUS.COMPLETED]: 'green',
  [EXAM_STATUS.CANCELLED]: 'red',
  [EXAM_STATUS.NO_SHOW]: 'default',
  [REPORT_STATUS.DRAFT]: 'default',
  [REPORT_STATUS.PRELIMINARY]: 'gold',
  [REPORT_STATUS.PUBLISHED]: 'green',
  [REPORT_STATUS.REJECTED]: 'red',
  [PAYMENT_STATUS.PENDING]: 'gold',
  [PAYMENT_STATUS.PAID]: 'green',
  [PAYMENT_STATUS.CANCELLED]: 'red',
  [PAYMENT_STATUS.REFUNDED]: 'default',
}
