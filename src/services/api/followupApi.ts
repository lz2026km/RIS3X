import { api, invalidateApiCacheByPrefix } from './client'
import type { ListData } from './client'

export type FollowUpStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'

export interface FollowUpPlan {
  id: string
  patientId: string
  patientName: string
  planDate: string
  intervalDays: number
  nextDate: string
  status: FollowUpStatus
  note: string
  reminderEnabled: boolean
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateFollowUpPlanDto {
  patientId: string
  patientName: string
  planDate: string
  intervalDays?: number
  status?: FollowUpStatus
  note?: string
  reminderEnabled?: boolean
}

export interface UpdateFollowUpPlanDto extends Partial<CreateFollowUpPlanDto> {}

const LIST_PREFIX = '/followups'

// [W4-B] 随访计划: 列表/创建/更新/删除/完成/到期提醒
export const followupApi = {
  list: (params?: { status?: FollowUpStatus; date?: string; search?: string; patientId?: string }) => {
    const query = params ? '?' + new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== '') as [string, string][],
    ).toString() : ''
    return api.getList<FollowUpPlan>(`${LIST_PREFIX}${query}`)
  },

  create: async (dto: CreateFollowUpPlanDto) => {
    const res = await api.post<FollowUpPlan>(LIST_PREFIX, dto)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  update: async (id: string, dto: UpdateFollowUpPlanDto) => {
    const res = await api.put<FollowUpPlan>(`${LIST_PREFIX}/${id}`, dto)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  remove: async (id: string) => {
    const res = await api.delete<{ ok: boolean; id: string }>(`${LIST_PREFIX}/${id}`)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  complete: async (id: string) => {
    const res = await api.post<FollowUpPlan>(`${LIST_PREFIX}/${id}/complete`)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  due: (days: number = 7) =>
    api.get<{ items: FollowUpPlan[]; total: number; days: number }>(`${LIST_PREFIX}/due?days=${days}`),
}

export type FollowUpListResult = ListData<FollowUpPlan>
