import { api, API_BASE } from './client'
import { getToken } from '../../utils/auth'
import type { AuditChainVerificationDto, RetentionPolicyDto, ColdArchiveResultDto } from './w13SecurityApi'

export interface AuditEventDto {
  id: string; userId: string; username?: string; userRole?: string; action: string; resource: string; resourceId?: string;
  details?: string; ip?: string; userAgent?: string; status: 'SUCCESS' | 'FAILURE' | 'DENIED'; createdAt: string
}
export interface AuditQueryParams { page?: number; pageSize?: number; userId?: string; action?: string; resource?: string; status?: string; startDate?: string; endDate?: string; search?: string }
export interface AuditAggregationDto { total: number; last24h: number; denied?: number; byAction: Record<string, number>; byResource: Record<string, number>; byUser: Array<{ userId: string; count: number }> }
export interface AuditStatsDto { total: number; last24h: number }

// [Wave 4B] 扩展端点 DTO (与 backend audit.service 对齐): overview / user-activity / action-trend / high-risk
export interface AuditOverviewDto {
  date: string
  todayOperations: number
  activeUsers: number
  highRiskCount: number
  successCount: number
  failedCount: number
  successRate: number
  totalOperations: number
  topActions: Array<{ action: string; count: number }>
  seeded: boolean
}

export interface AuditUserActivityDto {
  userId: string
  userName: string
  count: number
  lastActive: string
  successRate: number
}

export interface AuditTrendPoint {
  date: string
  label: string
  total: number
  highRisk: number
  failed: number
  seeded: boolean
}

export interface AuditHighRiskActionDto {
  action: string
  pattern: 'delete' | 'export' | 'batch' | 'other'
  patternZh: string
  count: number
  lastAt: string
  recentUsers: string[]
}

export interface AuditHighRiskDto {
  total: number
  byPattern: Array<{ pattern: string; patternZh: string; count: number }>
  actions: AuditHighRiskActionDto[]
  seeded: boolean
}

export const auditApi = {
  list: (params?: AuditQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<{ items: AuditEventDto[]; total: number; page: number; pageSize: number }>(`/audit${sp.toString() ? '?' + sp.toString() : ''}`)
  },
  getById: (id: string) => api.get<AuditEventDto>(`/audit/${encodeURIComponent(id)}`),
  // [G005 Wave1A P0] 审计统计 (后端 GET /audit/stats → { total, last24h })
  getStats: () => api.get<AuditStatsDto>('/audit/stats'),
  getAggregation: () => api.get<AuditAggregationDto>('/audit/aggregation'),
  // [Wave 4B] 审计总览 (后端 GET /audit/overview → 今日操作/活跃用户/高危操作/成功率)
  getOverview: () => api.get<AuditOverviewDto>('/audit/overview'),
  // [Wave 4B] 用户活跃排行 (后端 GET /audit/user-activity?limit=)
  getUserActivity: (limit?: number) =>
    api.get<AuditUserActivityDto[]>(`/audit/user-activity${limit ? `?limit=${limit}` : ''}`),
  // [Wave 4B] 近 N 日操作趋势 (后端 GET /audit/action-trend?days=)
  getActionTrend: (days?: number) =>
    api.get<AuditTrendPoint[]>(`/audit/action-trend${days ? `?days=${days}` : ''}`),
  // [Wave 4B] 高危操作清单 (后端 GET /audit/high-risk)
  getHighRisk: () => api.get<AuditHighRiskDto>('/audit/high-risk'),
  // [G005 W4A] 审计链端到端校验 (后端 GET /audit/verify-chain; ?tamper=1 仅用于 MSW 演示断链)
  verifyChain: (demoTamper?: boolean) =>
    api.get<AuditChainVerificationDto>(`/audit/verify-chain${demoTamper ? '?tamper=1' : ''}`),
  // [G005 W4A] 审计留存策略 (后端 GET /audit/retention-policy)
  getRetentionPolicy: () => api.get<RetentionPolicyDto>('/audit/retention-policy'),
  // [G005 W4A] 审计冷归档 (后端 POST /audit/cold-archive)
  coldArchive: (body?: { before?: string; executedBy?: string }) =>
    api.post<ColdArchiveResultDto>('/audit/cold-archive', body ?? {}),
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
