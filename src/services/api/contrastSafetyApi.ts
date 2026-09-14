/**
 * [v3.0.6.11-104 Wave 3B] 对比剂安全闭环 API
 * 后端: backend/src/modules/contrast-safety/contrast-safety.controller.ts (@Controller('contrast'))
 *   POST /contrast/allergy-test                    记录过敏试验
 *   GET  /contrast/allergy-test/:patientId         患者过敏试验历史
 *   POST /contrast/pre-injection-check             注射前核查 → { passed, blockers }
 *   POST /contrast/injection                       增强注射 (前置核查门禁, 未通过 400 PRE_INJECTION_CHECK_FAILED)
 *   POST /contrast/observation/start               开始留观 (默认 30 分钟)
 *   GET  /contrast/observation                     留观列表
 *   GET  /contrast/observation/:id                 留观状态
 *   POST /contrast/observation/:id/record          追加观察记录
 *   POST /contrast/observation/:id/discharge       离院确认 (需满时长或医生放行)
 */
import { api, invalidateApiCacheByPrefix } from './client'

export type ContrastAllergyResult = 'negative' | 'positive' | 'unknown'

export interface ContrastAllergyTestRecord {
  id: string
  patientId: string
  contrastType: string
  result: ContrastAllergyResult
  testedAt: string
  testedBy: string
  notes?: string
  createdAt: string
}

export interface RecordAllergyTestDto {
  patientId: string
  contrastType: string
  result: ContrastAllergyResult
  testedAt?: string
  testedBy: string
  notes?: string
}

export interface ContrastAllergyTestList {
  items: ContrastAllergyTestRecord[]
  total: number
  source: 'memory' | 'seed'
  latest: ContrastAllergyTestRecord | null
}

export interface PreInjectionCheckDto {
  patientId: string
  contrastType?: string
  consentSigned?: boolean
  allergyResult?: ContrastAllergyResult
  egfr?: number
  eGFR?: number
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
  allergyResult: ContrastAllergyResult
  evaluatedAt: string
}

export interface ContrastInjectionDto {
  examId?: string
  patientId: string
  patientName?: string
  protocolId?: string
  protocolName?: string
  contrastType?: string
  totalVolumeMl?: number
  flowRateMls?: number
  operator?: string
  weightKg?: number
  egfr?: number
  eGFR?: number
  adjustedVolumeMl?: number
  consentSigned?: boolean
  allergyResult?: ContrastAllergyResult
  pregnant?: boolean
  threshold?: number
}

export interface ContrastInjectionResult {
  id: string
  action: string
  resource: string
  passed: boolean
  blockers: string[]
  preCheck: PreInjectionCheckResult
}

export interface ObservationRecordEntry {
  at: string
  symptoms: string
  action: string
  recordedBy: string
  reactionId?: string
}

export interface ContrastObservation {
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
  elapsedSeconds: number
  elapsedMinutes: number
  remainingSeconds: number
  progressPercent: number
  canDischarge: boolean
  createdAt: string
  updatedAt: string
}

export interface StartObservationDto {
  patientId: string
  examId?: string
  contrastType?: string
  injectionId?: string
  durationMinutes?: number
  startedAt?: string
  operator?: string
}

export interface AddObservationRecordDto {
  symptoms: string
  action?: string
  at?: string
  recordedBy?: string
  reactionId?: string
}

export interface DischargeObservationDto {
  doctorRelease?: boolean
  dischargedBy?: string
  notes?: string
}

export const contrastSafetyApi = {
  recordAllergyTest: async (dto: RecordAllergyTestDto) => {
    const res = await api.post<ContrastAllergyTestRecord>('/contrast/allergy-test', dto)
    await invalidateApiCacheByPrefix('/contrast/allergy-test')
    return res
  },

  listAllergyTests: (patientId: string) =>
    api.get<ContrastAllergyTestList>(`/contrast/allergy-test/${encodeURIComponent(patientId)}`),

  preInjectionCheck: (dto: PreInjectionCheckDto) =>
    api.post<PreInjectionCheckResult>('/contrast/pre-injection-check', dto),

  inject: async (dto: ContrastInjectionDto) => {
    const res = await api.post<ContrastInjectionResult>('/contrast/injection', dto)
    await invalidateApiCacheByPrefix('/contrast/injection')
    return res
  },

  startObservation: async (dto: StartObservationDto) => {
    const res = await api.post<ContrastObservation>('/contrast/observation/start', dto)
    await invalidateApiCacheByPrefix('/contrast/observation')
    return res
  },

  listObservations: (patientId?: string) =>
    api.get<{ items: ContrastObservation[]; total: number }>(
      patientId ? `/contrast/observation?patientId=${encodeURIComponent(patientId)}` : '/contrast/observation',
    ),

  getObservation: (id: string) =>
    api.get<ContrastObservation>(`/contrast/observation/${encodeURIComponent(id)}`),

  addObservationRecord: async (id: string, dto: AddObservationRecordDto) => {
    const res = await api.post<ContrastObservation>(`/contrast/observation/${encodeURIComponent(id)}/record`, dto)
    await invalidateApiCacheByPrefix('/contrast/observation')
    return res
  },

  dischargeObservation: async (id: string, dto: DischargeObservationDto = {}) => {
    const res = await api.post<ContrastObservation>(`/contrast/observation/${encodeURIComponent(id)}/discharge`, dto)
    await invalidateApiCacheByPrefix('/contrast/observation')
    return res
  },
}
