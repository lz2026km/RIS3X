import { api } from './client'

// [G005 Wave1B P1] 典型病例库 API — 后端已实现 /typical-cases controller
// (Report 派生 + seed 回退 + 内存 CRUD, typical-cases.module), MSW 标注已更新。
// 页面在 API 失败时回退内置演示数据并标注。

export interface TypicalCaseStats {
  total: number
  teaching: number
  pending: number
  views: number
  likes: number
  source: string
}

interface Envelope<T> {
  source: string
  generatedAt: string
  data: T
}

function unwrapEnvelope<T>(res: { success: boolean; data: Envelope<T> | T; error?: unknown }): { success: boolean; data: T; error?: unknown } {
  if (!res.success) return res as { success: boolean; data: T; error?: unknown }
  const payload = res.data as unknown
  if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>
    if (typeof rec.source === 'string' && 'data' in rec) {
      return { ...res, data: rec.data as T }
    }
  }
  return res as { success: boolean; data: T; error?: unknown }
}

export const typicalCaseApi = {
  list: async () => {
    const res = await api.get<Envelope<unknown[]> | unknown[]>('/typical-cases')
    return unwrapEnvelope<unknown[]>(res as { success: boolean; data: Envelope<unknown[]> | unknown[]; error?: unknown })
  },

  getStats: async () => {
    const res = await api.get<Envelope<TypicalCaseStats> | TypicalCaseStats>('/typical-cases/stats')
    return unwrapEnvelope<TypicalCaseStats>(res)
  },

  // [v3.0.6.11-88] 后端 typical-cases.controller 已实现: GET /typical-cases/:id
  getCase: async (id: string) => {
    const res = await api.get<Envelope<unknown> | unknown>(`/typical-cases/${id}`)
    return unwrapEnvelope<unknown>(res as { success: boolean; data: Envelope<unknown> | unknown; error?: unknown })
  },

  // [v3.0.6.11-88] 后端已实现: POST /typical-cases (内存 CRUD + seed 回退)
  createCase: async (data: Record<string, unknown>) => {
    const res = await api.post<Envelope<unknown> | unknown>('/typical-cases', data)
    return unwrapEnvelope<unknown>(res as { success: boolean; data: Envelope<unknown> | unknown; error?: unknown })
  },

  // [v3.0.6.11-88] 后端已实现: PATCH /typical-cases/:id
  updateCase: async (id: string, data: Record<string, unknown>) => {
    const res = await api.patch<Envelope<unknown> | unknown>(`/typical-cases/${id}`, data)
    return unwrapEnvelope<unknown>(res as { success: boolean; data: Envelope<unknown> | unknown; error?: unknown })
  },

  // [v3.0.6.11-88] 后端已实现: DELETE /typical-cases/:id
  deleteCase: async (id: string) => {
    const res = await api.delete<Envelope<unknown> | unknown>(`/typical-cases/${id}`)
    return unwrapEnvelope<unknown>(res as { success: boolean; data: Envelope<unknown> | unknown; error?: unknown })
  },

  // [v3.0.6.11-88] 后端已实现: GET /typical-cases/categories ({ name, count }[] 按检查项目/类型聚合)
  getCategories: async () => {
    const res = await api.get<Envelope<Array<{ name: string; count: number }>> | Array<{ name: string; count: number }>>('/typical-cases/categories')
    return unwrapEnvelope<Array<{ name: string; count: number }>>(res as { success: boolean; data: Envelope<Array<{ name: string; count: number }>> | Array<{ name: string; count: number }>; error?: unknown })
  },
}
