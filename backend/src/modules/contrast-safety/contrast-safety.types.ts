/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3B - 对比剂安全闭环类型定义
 * 孤儿模块 (无新增 DB 表): 记录存于内存 overlay, 可无 DB 启动; auditLog 可用时旁路落库追溯。
 */

export type AllergyResult = 'negative' | 'positive' | 'unknown'

/** 阻断码 (稳定标识, 前端负责 i18n 文案) */
export type PreInjectionBlocker =
  | 'NO_CONSENT'
  | 'ALLERGY_POSITIVE'
  | 'EGFR_BELOW_THRESHOLD'
  | 'PREGNANCY'

export interface AllergyTestRecord {
  id: string
  patientId: string
  contrastType: string
  result: AllergyResult
  testedAt: string
  testedBy: string
  notes?: string
  createdAt: string
}

export interface PreInjectionCheckInput {
  patientId: string
  contrastType?: string
  consentSigned?: boolean
  allergyResult?: AllergyResult
  egfr?: number
  pregnant?: boolean
  threshold?: number
}

export interface PreInjectionCheckItem {
  key: 'consent' | 'allergy' | 'egfr' | 'pregnancy'
  passed: boolean
  detail: string
}

export interface PreInjectionCheckResult {
  passed: boolean
  blockers: string[]
  checks: PreInjectionCheckItem[]
  threshold: number
  allergyResult: AllergyResult
  evaluatedAt: string
}

export interface ObservationRecordEntry {
  at: string
  symptoms: string
  action: string
  recordedBy: string
  reactionId?: string
}

export interface ObservationRecord {
  id: string
  patientId: string
  examId?: string
  contrastType?: string
  injectionId?: string
  startedAt: string
  durationMinutes: number
  endsAt: string
  status: 'observing' | 'discharged'
  operator?: string
  records: ObservationRecordEntry[]
  doctorRelease: boolean
  dischargedAt?: string
  dischargedBy?: string
  dischargeNotes?: string
  createdAt: string
  updatedAt: string
}

export interface ObservationDto extends ObservationRecord {
  elapsedSeconds: number
  elapsedMinutes: number
  remainingSeconds: number
  progressPercent: number
  canDischarge: boolean
}

export interface AllergyTestListResult {
  items: AllergyTestRecord[]
  total: number
  source: 'memory' | 'seed'
  latest: AllergyTestRecord | null
}

export const DEFAULT_EGFR_THRESHOLD = 30
export const DEFAULT_OBSERVATION_MINUTES = 30
