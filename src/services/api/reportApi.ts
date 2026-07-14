import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ReportQueryParams } from './types'
import type { ReportDto } from '../../types/dto'

export type { ReportDto }

export const reportApi = {
  list: (params?: ReportQueryParams) =>
    api.get<ReportDto[]>(`/reports?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getById: (id: string) =>
    api.get<ReportDto>(`/reports/${id}`),

  create: async (data: Partial<ReportDto>) => {
    const res = await api.post<ReportDto>('/reports', data)
    await invalidateApiCache('/reports')
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  update: async (id: string, data: Partial<ReportDto>) => {
    const res = await api.put<ReportDto>(`/reports/${id}`, data)
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  submit: async (id: string) => {
    const res = await api.post<ReportDto>(`/reports/${id}/submit`)
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  review: async (id: string, data?: { type: 'initial' | 'final'; doctorId: string; doctorName: string; suggestion: string; score: number }) => {
    const res = await api.post<ReportDto>(`/reports/${id}/review`, data)
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  sign: async (id: string) => {
    const res = await api.post<ReportDto>(`/reports/${id}/sign`)
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  reject: async (id: string, reason: string) => {
    const res = await api.post<ReportDto>(`/reports/${id}/reject`, { reason })
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  publish: async (id: string, qualityScore?: number) => {
    const res = await api.post<ReportDto>(`/reports/${id}/publish`, { qualityScore })
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  revise: async (id: string) => {
    const res = await api.post<ReportDto>(`/reports/${id}/revise`)
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  // [v3.0.6.8-45] PR1: 双签 + 版本对比 + 审计轨迹
  cosign: async (id: string, cosignerId: string) => {
    const res = await api.post<ReportDto>(`/reports/${id}/cosign`, { cosignerId })
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  diff: (id: string) =>
    api.get<{ oldVersion: Partial<ReportDto>; newVersion: Partial<ReportDto>; changes: string[] }>(`/reports/${id}/diff`),

  auditTrail: (id: string) =>
    api.get<{
      events: Array<{ id: string; timestamp: string; actor: string; action: string; fromState: string; toState: string; reason?: string }>;
    }>(`/reports/${id}/audit-trail`),
}
