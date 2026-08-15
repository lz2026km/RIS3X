// [v3.0.6.11-100 Wave 4A] 移动审批 API
// Backend: /mobile-approval/* (backend/src/modules/mobile-approval)
//   GET  /pending /history /stats
//   POST /:id/approve | reject | delegate
import { api, invalidateApiCacheByPrefix } from './client'

export type MobileApprovalType = '报告签发' | '报告发布' | '危急值处置' | '费用审批' | '请假审批'
export type MobileApprovalStatus = 'pending' | 'approved' | 'rejected' | 'delegated'

export interface MobileApprovalItem {
  id: string
  type: MobileApprovalType
  title: string
  applicant: string
  submittedAt: string
  dueAt: string
  status: MobileApprovalStatus
  assignee: string
  detail: Record<string, unknown>
  comment?: string
  reason?: string
  delegatedTo?: string
  processedAt?: string | null
  processedBy?: string | null
}

export interface MobileApprovalStats {
  pending: number
  approved: number
  rejected: number
  delegated: number
  overdue: number
  byType: Array<{ type: MobileApprovalType; count: number }>
}

// 列表解包: 兼容 { items, total } 与裸数组
function unwrapList<T>(res: { success: boolean; data: { items?: T[]; total?: number } | T[] | null }): T[] {
  if (!res.success) return []
  const data = res.data
  if (Array.isArray(data)) return data
  return Array.isArray(data?.items) ? data.items : []
}

async function unwrap<T>(promise: Promise<{ success: boolean; data: T; error?: { message?: string } | null }>): Promise<T> {
  const res = await promise
  if (!res.success) throw new Error(res.error?.message ?? '请求失败')
  return res.data
}

async function invalidate() {
  await invalidateApiCacheByPrefix('/mobile-approval')
}

export const mobileApprovalApi = {
  listPending: async (): Promise<MobileApprovalItem[]> => {
    const res = await api.get<{ items: MobileApprovalItem[] } | MobileApprovalItem[]>('/mobile-approval/pending')
    return unwrapList(res)
  },

  listHistory: async (): Promise<MobileApprovalItem[]> => {
    const res = await api.get<{ items: MobileApprovalItem[] } | MobileApprovalItem[]>('/mobile-approval/history')
    return unwrapList(res)
  },

  getStats: async (): Promise<MobileApprovalStats> => {
    try {
      return await unwrap(api.get<MobileApprovalStats>('/mobile-approval/stats'))
    } catch {
      // 旧后端/降级: 由列表派生
      const [pending, history] = await Promise.all([mobileApprovalApi.listPending(), mobileApprovalApi.listHistory()])
      const byType = (['报告签发', '报告发布', '危急值处置', '费用审批', '请假审批'] as const).map((type) => ({
        type,
        count: pending.filter((i) => i.type === type).length,
      }))
      return {
        pending: pending.filter((i) => i.status === 'pending').length,
        approved: history.filter((i) => i.status === 'approved').length,
        rejected: history.filter((i) => i.status === 'rejected').length,
        delegated: pending.filter((i) => i.status === 'delegated').length,
        overdue: pending.filter((i) => new Date(i.dueAt) < new Date()).length,
        byType,
      }
    }
  },

  approve: async (id: string, comment?: string) => {
    const item = await unwrap(api.post<MobileApprovalItem>(`/mobile-approval/${id}/approve`, { comment }))
    await invalidate()
    return item
  },

  reject: async (id: string, reason: string) => {
    const item = await unwrap(api.post<MobileApprovalItem>(`/mobile-approval/${id}/reject`, { reason }))
    await invalidate()
    return item
  },

  delegate: async (id: string, toUserId: string) => {
    const item = await unwrap(api.post<MobileApprovalItem>(`/mobile-approval/${id}/delegate`, { toUserId }))
    await invalidate()
    return item
  },
}
