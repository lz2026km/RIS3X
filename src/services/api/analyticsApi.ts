import { api, invalidateApiCacheByPrefix } from './client'

export interface ExportApprovalDto {
  id: string
  resource: string
  resourceId?: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requesterId: string
  requesterName?: string
  approverId?: string
  rejectReason?: string
  createdAt: string
  updatedAt?: string
}

export interface ExportApprovalListParams {
  page?: number
  pageSize?: number
  status?: string
  requesterId?: string
}

export interface OlapQueryDto {
  measures: string[]
  dimensions: string[]
  filters?: Array<{ dimension: string; operator: string; value: unknown }>
  orderBy?: string
  limit?: number
  offset?: number
}

export interface OlapMetadataDto {
  measures: Array<{ code: string; name: string; unit?: string }>
  dimensions: Array<{ code: string; name: string; members?: string[] }>
}

export interface StatsDashboardDto {
  examCount: number
  reportCount: number
  criticalCount: number
  avgTAT: number
  defectRate: number
  qcAvgScore: number
  byModality: Record<string, { examCount: number; reportCount: number }>
  dailyTrend: Array<{ date: string; examCount: number; reportCount: number }>
}

export const exportApprovalApi = {
  request: async (data: { resource: string; resourceId?: string; reason: string }) => {
    const res = await api.post<ExportApprovalDto>('/export-approval', data)
    await invalidateApiCacheByPrefix('/export-approval')
    return res
  },

  approve: async (id: string) => {
    const res = await api.post<ExportApprovalDto>(`/export-approval/${id}/approve`, {})
    await invalidateApiCacheByPrefix('/export-approval')
    return res
  },

  reject: async (id: string, reason: string) => {
    const res = await api.post<ExportApprovalDto>(`/export-approval/${id}/reject`, { reason })
    await invalidateApiCacheByPrefix('/export-approval')
    return res
  },

  list: (params?: ExportApprovalListParams) => {
    const q = new URLSearchParams()
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
      }
    }
    return api.get<ExportApprovalDto[]>(`/export-approval?${q.toString()}`)
  },
}

// v3.0.6.11-21 P0: 移除冗余 `/api/v1` 前缀(由 client.ts API_BASE 在 mock 模式提供)
//   修复前: client BASE=/api/v1 + path=/api/v1/olap/... => /api/v1/api/v1/olap/... 不匹配 MSW
//   修复后: client BASE=/api/v1 + path=/olap/...        => /api/v1/olap/... 匹配 MSW (olapHandlers.ts)
// [G005 Wave1B P1] olapApi.query/metadata 后端真实 (olap.controller)
export const olapApi = {
  query: (dto: OlapQueryDto) =>
    api.post<any>('/olap/query', dto),

  getMetadata: () =>
    api.get<OlapMetadataDto>('/olap/metadata'),
}

// [G005 Wave1B P1] analyticsStatsApi — forecast/utilization/accuracy 后端已补 (stats.controller, Wave1B)
export const analyticsStatsApi = {
  getDashboard: () =>
    api.get<StatsDashboardDto>('/stats/dashboard'),

  getForecast: (params: { department: string; startDate: string; endDate: string }) =>
    api.get<ForecastPointDto[]>(`/stats/forecast?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getUtilization: () =>
    api.get<UtilizationDto>('/stats/utilization'),

  getAccuracy: () =>
    api.get<AccuracyDto>('/stats/accuracy'),
}

export interface ForecastPointDto {
  date: string
  actual: number | null
  forecast: number | null
  upper: number | null
  lower: number | null
}

export interface UtilizationDto {
  current: number
  target: number
  max: number
}

export interface AccuracyDto {
  value: number
  previous: number
}
