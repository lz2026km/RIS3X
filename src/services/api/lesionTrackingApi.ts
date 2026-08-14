import { api, invalidateApiCacheByPrefix } from './client'
import type { ListData } from './client'

// [v3.0.6.11-99 Wave 4A] 病灶追踪 (lesion-tracking) — 登记/测量/趋势/跨期对比/统计/随访联动

export type LesionStatus = '稳定' | '增大' | '缩小' | '消失' | '新发'
export type LesionType = '肺结节' | '肝占位' | '淋巴结' | '其他'
export type ResponseClass = 'CR' | 'PR' | 'SD' | 'PD' | 'NE'

export interface LesionMeasurement {
  id: string
  studyId: string
  date: string
  sizeMm: number
  response?: ResponseClass
  notes?: string
}

export interface TrackedLesion {
  id: string
  lesionId: string
  patientId: string
  name: string
  site: string
  type: LesionType
  modality: string
  createdAt: string
  currentStatus: LesionStatus
  followupId?: string
  measurements: LesionMeasurement[]
}

export interface LesionListPayload {
  source: 'database' | 'demo'
  items: TrackedLesion[]
}

export interface CreateLesionDto {
  patientId: string
  name: string
  site: string
  type?: LesionType
  initialSizeMm?: number
  modality?: string
  studyId?: string
}

export interface CreateMeasurementDto {
  studyId: string
  sizeMm: number
  date: string
  response?: ResponseClass
  notes?: string
}

export interface LesionCompareResult {
  lesionId: string
  studyA: string
  studyB: string
  sizeA: number
  sizeB: number
  changeMm: number
  changePercent: number
  direction: '增大' | '缩小' | '无变化' | '消失'
  response: ResponseClass
  responseLabel: string
  deterministic: boolean
}

export interface LesionTrendResult {
  lesionId: string
  baselineDate: string
  baselineSize: number
  latestDate: string
  latestSize: number
  changePercent: number
  overallResponse: ResponseClass
  overallResponseLabel: string
  timeline: Array<{ date: string; studyId: string; sizeMm: number; response?: ResponseClass }>
}

export interface LesionStats {
  patientId: string
  total: number
  new: number
  progressed: number
  stable: number
  disappeared: number
  shrunk: number
  byType: Array<{ type: string; count: number }>
}

const LIST_PREFIX = '/lesion-tracking'

export const lesionTrackingApi = {
  list: (patientId: string) =>
    api.get<LesionListPayload>(`${LIST_PREFIX}/lesions?patientId=${encodeURIComponent(patientId)}`),

  get: (id: string) => api.get<TrackedLesion>(`${LIST_PREFIX}/lesions/${id}`),

  create: async (dto: CreateLesionDto) => {
    const res = await api.post<TrackedLesion>(`${LIST_PREFIX}/lesions`, dto)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  update: async (id: string, dto: Partial<Pick<TrackedLesion, 'name' | 'site' | 'type' | 'modality'>>) => {
    const res = await api.patch<TrackedLesion>(`${LIST_PREFIX}/lesions/${id}`, dto)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  remove: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`${LIST_PREFIX}/lesions/${id}`)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  addMeasurement: async (id: string, dto: CreateMeasurementDto) => {
    const res = await api.post<TrackedLesion>(`${LIST_PREFIX}/lesions/${id}/measurements`, dto)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  listMeasurements: (id: string) =>
    api.get<LesionMeasurement[]>(`${LIST_PREFIX}/lesions/${id}/measurements`),

  trend: (id: string) =>
    api.get<LesionTrendResult>(`${LIST_PREFIX}/lesions/${id}/trend`),

  compare: async (id: string, dto: { studyIdA: string; studyIdB: string }) => {
    const res = await api.post<LesionCompareResult>(`${LIST_PREFIX}/lesions/${id}/compare`, dto)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  stats: (patientId: string) =>
    api.get<LesionStats>(`${LIST_PREFIX}/stats?patientId=${encodeURIComponent(patientId)}`),

  linkFollowup: async (id: string, followupId: string) => {
    const res = await api.post<TrackedLesion>(`${LIST_PREFIX}/lesions/${id}/followup`, { followupId })
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },
}

export type LesionListResult = ListData<TrackedLesion>
