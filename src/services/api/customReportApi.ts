// [v3.0.6.11-99 Wave 5A] 自定义报表 API
// Backend: /custom-reports/* (backend/src/modules/custom-report)
//   GET    /, /fields-catalog, /:id, /:id/result, /:id/history, /:id/export
//   POST   /, /:id/run, /:id/schedule
//   PATCH  /:id   DELETE /:id
import { api, invalidateApiCache } from './client'

export type CustomReportStatus = 'idle' | 'running' | 'ready' | 'failed'

export interface CustomReportDef {
  id: string
  name: string
  category: string
  description: string
  fields: string[]
  period: string
  dataSource: string
  schedule: string | null
  recipients: string[]
  lastRunAt: string | null
  status: CustomReportStatus
  createdAt: string
  updatedAt: string
}

export interface CustomReportField {
  id: string
  name: string
  source: 'olap' | 'stats' | 'bi'
  kind: 'measure' | 'dimension' | 'snapshot'
  unit?: string
  description: string
}

export interface ReportRunResult {
  id: string
  reportId: string
  columns: Array<{ key: string; name: string }>
  rows: Record<string, unknown>[]
  generatedAt: string
  source: string
  summary: Record<string, unknown>
}

export interface RunHistoryEntry {
  id: string
  reportId: string
  ranAt: string
  status: 'success' | 'failed'
  rowCount: number
  message: string
}

export interface CustomReportCreateData {
  name: string
  category?: string
  description?: string
  fields: string[]
  period?: string
  dataSource?: string
  schedule?: string | null
  recipients?: string[]
}

export const customReportApi = {
  list: () => api.get<CustomReportDef[]>('/custom-reports'),

  get: (id: string) => api.get<CustomReportDef>(`/custom-reports/${id}`),

  getFieldsCatalog: () => api.get<CustomReportField[]>('/custom-reports/fields-catalog'),

  create: async (data: CustomReportCreateData) => {
    const res = await api.post<CustomReportDef>('/custom-reports', data)
    await invalidateApiCache('/custom-reports')
    return res
  },

  update: async (id: string, data: Partial<CustomReportCreateData>) => {
    const res = await api.patch<CustomReportDef>(`/custom-reports/${id}`, data)
    await invalidateApiCache('/custom-reports')
    return res
  },

  remove: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`/custom-reports/${id}`)
    await invalidateApiCache('/custom-reports')
    return res
  },

  run: async (id: string) => {
    const res = await api.post<ReportRunResult>(`/custom-reports/${id}/run`)
    await invalidateApiCache(`/custom-reports/${id}/result`)
    await invalidateApiCache(`/custom-reports/${id}/history`)
    return res
  },

  getResult: (id: string) => api.get<ReportRunResult>(`/custom-reports/${id}/result`),

  getHistory: (id: string) => api.get<RunHistoryEntry[]>(`/custom-reports/${id}/history`),

  setSchedule: async (id: string, data: { schedule: string; recipients: string[] }) => {
    const res = await api.post<{ def: CustomReportDef; notified: { count: number } }>(`/custom-reports/${id}/schedule`, data)
    await invalidateApiCache('/custom-reports')
    return res
  },

  exportCsv: (id: string) => api.getBlob<string>(`/custom-reports/${id}/export`),
}
