import { api, invalidateApiCache } from './client'

// [G005 Wave 8B v3.0.6.11-101] qc-analytics 报告质控闭环与趋势分析 API
// 后端: backend/src/modules/qc-analytics/ (孤儿模块, DB 不可用 seed 回退; 桥接报告 V2 规则引擎/质控 V2)
// 端点: /qc-analytics/{dashboard,trends,pareto,departments,loop/*} 全部 200

export type DefectTypeCode =
  | 'missing_field'
  | 'terminology'
  | 'unit'
  | 'length_range'
  | 'numeric_reasonability'
  | 'duplicate'
  | 'structure'
  | 'critical'

export type DefectSource = 'rules-engine' | 'qc-v2' | 'manual'
export type LoopStatus = 'open' | 'rectifying' | 'rechecking' | 'closed'

export interface QcAnalyticsEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
}

export interface DashboardData {
  source: 'database' | 'demo'
  generatedAt: string
  totalReports: number
  qcReports: number
  qcRate: number
  totalDefects: number
  defectRate: number
  timelyReports: number
  timelyRate: number
  avgResponseMinutes: number
  avgScore: number
  loopOpen: number
  loopClosed: number
  closureRate: number
}

export interface TrendPoint {
  bucket: string
  label: string
  reports: number
  qcReports: number
  qcRate: number
  defects: number
  defectRate: number
  timely: number
  timelyRate: number
  avgResponseMinutes: number
  improvement: number | null
}

export interface AnalyticsTrends {
  source: 'database' | 'demo'
  generatedAt: string
  period: 'week' | 'month'
  points: TrendPoint[]
}

export interface ParetoItem {
  code: DefectTypeCode
  label: string
  count: number
  cumulativeCount: number
  cumulativePercent: number
  isMain: boolean
}

export interface ParetoData {
  source: 'database' | 'demo'
  generatedAt: string
  totalDefects: number
  items: ParetoItem[]
}

export interface DepartmentRankItem {
  department: string
  reports: number
  defects: number
  defectRate: number
  timelyRate: number
  avgResponseMinutes: number
  qcRate: number
  avgScore: number
}

export interface DepartmentRanking {
  source: 'database' | 'demo'
  generatedAt: string
  data: DepartmentRankItem[]
}

export interface LoopDefect {
  id: string
  code: DefectTypeCode
  typeLabel: string
  reportId: string
  department: string
  severity: 'high' | 'medium' | 'low'
  source: DefectSource
  message: string
  discoveredAt: string
  status: LoopStatus
  itemId?: string
}

export interface LoopHistoryEntry {
  at: string
  action: string
  actor: string
  note: string
}

export interface RectificationItem {
  id: string
  defectId: string
  defectCode: DefectTypeCode
  typeLabel: string
  reportId: string
  department: string
  severity: string
  source: DefectSource
  title: string
  assignee: string
  assigneeName: string
  status: LoopStatus
  createdAt: string
  updatedAt: string
  closedAt?: string
  fixNote?: string
  recheckResult?: 'pass' | 'fail'
  recheckNote?: string
  recheckRounds: number
  history: LoopHistoryEntry[]
}

export interface LoopStats {
  total: number
  byStatus: Record<LoopStatus, number>
  closureRate: number
  avgDaysToClose: number
  avgRecheckRounds: number
  openDefects: number
}

export const qcAnalyticsApi = {
  getDashboard: () => api.get<DashboardData>('/qc-analytics/dashboard'),

  getTrends: (period: 'week' | 'month' = 'month') =>
    api.get<AnalyticsTrends>(`/qc-analytics/trends?period=${period}`),

  getPareto: () => api.get<ParetoData>('/qc-analytics/pareto'),

  getDepartments: () => api.get<DepartmentRanking>('/qc-analytics/departments'),

  listLoopDefects: (status?: string) =>
    api.get<QcAnalyticsEnvelope<LoopDefect[]>>(`/qc-analytics/loop/defects${status ? `?status=${status}` : ''}`),

  listLoopItems: (status?: string) =>
    api.get<QcAnalyticsEnvelope<RectificationItem[]>>(`/qc-analytics/loop/items${status ? `?status=${status}` : ''}`),

  getLoopItem: (id: string) => api.get<RectificationItem>(`/qc-analytics/loop/items/${id}`),

  createLoopItem: async (data: { defectId: string; assignee?: string; assigneeName?: string; title?: string }) => {
    const res = await api.post<RectificationItem>('/qc-analytics/loop/items', data)
    await invalidateApiCache('/qc-analytics/loop')
    return res
  },

  startFix: async (id: string, data?: { actor?: string; note?: string }) => {
    const res = await api.post<RectificationItem>(`/qc-analytics/loop/items/${id}/start`, data ?? {})
    await invalidateApiCache('/qc-analytics/loop')
    return res
  },

  submitFix: async (id: string, data?: { actor?: string; note?: string }) => {
    const res = await api.post<RectificationItem>(`/qc-analytics/loop/items/${id}/fix`, data ?? {})
    await invalidateApiCache('/qc-analytics/loop')
    return res
  },

  recheckItem: async (id: string, data: { result: 'pass' | 'fail'; reviewer: string; note?: string }) => {
    const res = await api.post<RectificationItem>(`/qc-analytics/loop/items/${id}/recheck`, data)
    await invalidateApiCache('/qc-analytics/loop')
    return res
  },

  closeLoopItem: async (id: string, data?: { note?: string }) => {
    const res = await api.post<RectificationItem>(`/qc-analytics/loop/items/${id}/close`, data ?? {})
    await invalidateApiCache('/qc-analytics/loop')
    return res
  },

  getLoopStats: () => api.get<QcAnalyticsEnvelope<LoopStats>>('/qc-analytics/loop/stats'),
}
