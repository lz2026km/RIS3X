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

// ────────────────────────────────────────────────────────────────────────────
// [v3.0.6.11-105 Wave 1B] 对比剂外渗事件 (extravasation) — 孤儿模块内存 overlay
// ────────────────────────────────────────────────────────────────────────────

/** 外渗严重程度: 轻度 / 中度 / 重度 */
export type ExtravasationSeverity = 'mild' | 'moderate' | 'severe'

/** 外渗事件记录 (内存 overlay, 不新增 DB 表) */
export interface ExtravasationEvent {
  id: string
  patientId: string
  examId?: string
  severity: ExtravasationSeverity
  /** 发生部位 (如 左上肢前臂/手背) */
  site: string
  /** 估计外渗量 (ml) */
  estimatedVolumeMl: number
  /** 处置措施 (记录时初值, 处置闭环可更新) */
  management: string
  /** 记录人 */
  recordedBy: string
  /** 发生时间 (ISO) */
  occurredAt: string
  /** 处置状态: open 待处置 / resolved 已闭环 */
  status: 'open' | 'resolved'
  handledBy?: string
  handledAt?: string
  /** 随访记录 */
  followUp?: string
  handleNote?: string
  createdAt: string
  updatedAt: string
}

export interface ExtravasationListFilter {
  patientId?: string
  severity?: ExtravasationSeverity
  dateFrom?: string
  dateTo?: string
  page?: number
  pageSize?: number
}

export interface ExtravasationListResult {
  items: ExtravasationEvent[]
  total: number
  page: number
  pageSize: number
  source: 'memory' | 'seed'
}

export interface ExtravasationStats {
  total: number
  /** 同期增强 CT 总例数 (分母: POST /contrast/injection 累计 + 确定性 seed) */
  totalInjections: number
  /** 发生率 = 外渗例数 ÷ 同期增强 CT 总例数 ×1000‰ */
  incidenceRatePerThousand: number
  bySeverity: { severity: ExtravasationSeverity; count: number }[]
  bySite: { site: string; count: number }[]
  byMonth: { month: string; count: number }[]
  openCount: number
  resolvedCount: number
  source: 'memory' | 'seed'
}

export interface HandleExtravasationInput {
  management?: string
  followUp?: string
  handledBy?: string
  note?: string
}

/** 确定性 seed: 增强 CT 总例数基数 (无真实 injection 记录时作分母基数) */
export const SEED_INJECTION_TOTAL = 480

export const DEFAULT_EGFR_THRESHOLD = 30
export const DEFAULT_OBSERVATION_MINUTES = 30
export const DEFAULT_EXTRAVASATION_PAGE_SIZE = 20
