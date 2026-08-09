import { api, API_BASE } from './client'
import { getToken } from '../../utils/auth'

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
  getById: (id: string) => api.get<AuditEventDto>(`/audit/${encodeURIComponent(id)}`),
  getAggregation: () => api.get<AuditAggregationDto>('/audit/aggregation'),
  // 导出 CSV: 后端 GET /audit/export 返回 text/csv, 以 blob 下载
  // [W1-B] 去重: 与 systemApi.auditApi.exportCsv 为同一后端端点(重复封装)。
  // 本方法为保留实现 (systemApi.exportCsv 已委托调用本方法), 页面 import 兼容不受影响。
  export: async (params?: AuditQueryParams): Promise<Blob> => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    const url = `${API_BASE}/audit/export${sp.toString() ? '?' + sp.toString() : ''}`
    const token = getToken()
    const res = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      credentials: 'include',
    })
    if (!res.ok) throw new Error(`导出失败 (${res.status})`)
    return res.blob()
  },
}
