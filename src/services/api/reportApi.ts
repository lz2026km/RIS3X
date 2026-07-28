import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ReportQueryParams } from './types'
import type { ReportDto } from '../../types/dto'
import { getCurrentUser } from '../../utils/auth'

export type { ReportDto }

type ReportState =
  | 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'WRITING' | 'SUBMITTED'
  | 'INITIAL_REVIEW' | 'FINAL_REVIEW' | 'CO_SIGN_REVIEW' | 'REVIEWED'
  | 'SIGNING' | 'SIGNED' | 'PUBLISHED' | 'AMENDING' | 'AMENDED'
  | 'WITHDRAWN' | 'REJECTED' | 'ESCALATED' | 'ARCHIVED'
  | 'RECTIFYING' | 'SUPPLEMENTING' | 'SUPPLEMENTED' | 'REDISTRIBUTING'

async function transition(id: string, to: ReportState, reason?: string) {
  const user = getCurrentUser()
  const actorId = user?.id ?? 'unknown'
  const body: Record<string, unknown> = { to, actorId }
  if (reason) body.reason = reason
  const res = await api.post<ReportDto>(`/reports/${id}/transition`, body)
  await invalidateApiCache(`/reports/${id}`)
  await invalidateApiCacheByPrefix('/reports')
  return res
}

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
    const res = await api.patch<ReportDto>(`/reports/${id}`, data)
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  submit: async (id: string) => transition(id, 'SUBMITTED'),

  review: async (id: string, _data?: { type: 'initial' | 'final'; doctorId: string; doctorName: string; suggestion: string; score: number }) => {
    const res = await transition(id, 'REVIEWED')
    return res
  },

  sign: async (id: string) => transition(id, 'SIGNED'),

  reject: async (id: string, reason: string) => transition(id, 'REJECTED', reason),

  publish: async (id: string, _qualityScore?: number) => transition(id, 'PUBLISHED'),

  revise: async (id: string) => transition(id, 'AMENDING'),

  // [v3.0.6.8-45] PR1: 双签 + 版本对比 + 审计轨迹
  cosign: async (id: string, _cosignerId: string) => {
    const res = await transition(id, 'CO_SIGN_REVIEW')
    return res
  },

  diff: (id: string) =>
    api.get<{ oldVersion: Partial<ReportDto>; newVersion: Partial<ReportDto>; changes: string[] }>(`/reports/${id}/diff`),

  auditTrail: (id: string) =>
    api.get<{
      events: Array<{ id: string; timestamp: string; actor: string; action: string; fromState: string; toState: string; reason?: string }>;
    }>(`/reports/${id}/audit-trail`),
}
