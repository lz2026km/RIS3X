import { api } from './client'

export interface AuditEventDto {
  id: string; userId: string; username?: string; userRole?: string; action: string; resource: string; resourceId?: string;
  details?: string; ip?: string; userAgent?: string; status: 'SUCCESS' | 'FAILURE' | 'DENIED'; createdAt: string
}
export interface AuditQueryParams { page?: number; pageSize?: number; userId?: string; action?: string; resource?: string; status?: string; startDate?: string; endDate?: string; search?: string }
export interface AuditAggregationDto { total: number; last24h: number; byAction: Record<string, number>; byResource: Record<string, number>; byUser: Array<{ userId: string; count: number }> }

export const auditApi = {
  list: (params?: AuditQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<{ items: AuditEventDto[]; total: number; page: number; pageSize: number }>(`/audit${sp.toString() ? '?' + sp.toString() : ''}`)
  },
  getById: (id: string) => api.get<AuditEventDto>(`/audit/${id}`),
  getAggregation: () => api.get<AuditAggregationDto>('/audit/aggregation'),
  export: (params?: AuditQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<Blob>(`/audit/export?${sp.toString()}`, { responseType: 'blob' })
  },
}
