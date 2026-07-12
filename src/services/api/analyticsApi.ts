import { api } from './client'

export interface ExportApprovalDto {
  id: string
  resource: string
  resourceId?: string
  reason: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  requesterId: string
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
  filters?: Record<string, unknown>
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
  request: (data: { resource: string; resourceId?: string; reason: string }) =>
    api.post<ExportApprovalDto>('/export-approval', data),

  approve: (id: string) =>
    api.post<ExportApprovalDto>(`/export-approval/${id}/approve`, {}),

  reject: (id: string, reason: string) =>
    api.post<ExportApprovalDto>(`/export-approval/${id}/reject`, { reason }),

  list: (params?: ExportApprovalListParams) =>
    api.get<ExportApprovalDto[]>(`/export-approval?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),
}

export const olapApi = {
  query: (dto: OlapQueryDto) =>
    api.post<any>('/api/v1/olap/query', dto),

  getMetadata: () =>
    api.get<OlapMetadataDto>('/api/v1/olap/metadata'),
}

export const analyticsStatsApi = {
  getDashboard: () =>
    api.get<StatsDashboardDto>('/stats/dashboard'),
}
