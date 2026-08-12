import { api } from './client'
import type { ApiResponse } from './types'

export interface CoSignItem {
  id: string
  reportId: string
  patientName: string
  modality: string
  bodyPart: string
  priority: string
  submittedAt: string
  authorId: string
  authorName: string
  status: string
  waitingHours: number
}

export interface CoSignStats {
  total: number
  pending: number
  approved: number
  rejected: number
  avgResponseMinutes: number
  onTimeRate: number
}

// [Wave1B P2] 会签规则 (后端 cosign.controller: GET/POST /cosign/rules + DELETE /cosign/rules/:key,
// 存储于 systemConfig, value 为 JSON 规则体)
export interface CoSignRule {
  id: string
  key: string
  name: string
  modality: string
  threshold: 'CRITICAL' | 'URGENT' | 'ALL'
  cosignerIds: string[]
  minReviewers?: number
  requireCoSign?: boolean
}

export interface CreateCoSignRuleDto {
  name: string
  modality: string
  threshold: 'CRITICAL' | 'URGENT' | 'ALL'
  cosignerIds: string[]
  minReviewers?: number
  requireCoSign?: boolean
}

interface SystemConfigRow {
  id: string
  key: string
  value: string | Record<string, unknown> | null
}

function parseRuleRow(row: SystemConfigRow): CoSignRule | null {
  if (!row || !row.key) return null
  let value: Record<string, unknown> = {}
  if (typeof row.value === 'string') {
    try { value = JSON.parse(row.value) as Record<string, unknown> } catch { /* 非 JSON 忽略 */ }
  } else if (row.value && typeof row.value === 'object') {
    value = row.value as Record<string, unknown>
  }
  const cosignerIds = Array.isArray(value.cosignerIds)
    ? (value.cosignerIds as unknown[]).map(String)
    : []
  return {
    id: row.id,
    key: row.key,
    name: String(value.name ?? row.key),
    modality: String(value.modality ?? 'CT'),
    threshold: (value.threshold as CoSignRule['threshold']) ?? 'ALL',
    cosignerIds,
    minReviewers: Number(value.minReviewers) || 1,
    requireCoSign: value.requireCoSign !== false,
  }
}

export const coSignApi = {
  getPending: () =>
    api.get<CoSignItem[]>('/cosign/pending'),

  approve: (id: string, data: { note?: string }) =>
    api.post<{ success: boolean }>(`/cosign/pending/${id}/approve`, data),

  reject: (id: string, data: { reason: string }) =>
    api.post<{ success: boolean }>(`/cosign/pending/${id}/reject`, data),

  getHistory: () =>
    api.get<CoSignItem[]>('/cosign/history'),

  getStats: () =>
    api.get<CoSignStats>('/cosign/stats'),

  // [Wave1B P2] 规则列表: 解析 systemConfig 行 (value JSON → CoSignRule)
  getRules: async (): Promise<ApiResponse<CoSignRule[]>> => {
    const res = await api.get<{ data: SystemConfigRow[] } | SystemConfigRow[]>('/cosign/rules')
    if (!res.success) return res as unknown as ApiResponse<CoSignRule[]>
    const rows = Array.isArray(res.data)
      ? (res.data as unknown as SystemConfigRow[])
      : (((res.data as { data?: unknown })?.data as SystemConfigRow[]) ?? [])
    const rules = Array.isArray(rows)
      ? rows.map(parseRuleRow).filter((r): r is CoSignRule => r != null)
      : []
    return { ...res, data: rules } as unknown as ApiResponse<CoSignRule[]>
  },

  createRule: async (data: CreateCoSignRuleDto) => {
    const res = await api.post<{ data: SystemConfigRow[] }>('/cosign/rules', data)
    return res
  },

  deleteRule: async (key: string) => {
    const res = await api.delete<{ data: { deleted: number } }>(`/cosign/rules/${encodeURIComponent(key)}`)
    return res
  },
}
