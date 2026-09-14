import { api, invalidateApiCacheByPrefix } from './client'
import type { ListData } from './client'

// [v3.0.6.11-99 Wave3B] 状态机扩展: 计划/已提醒/进行中/已完成/已失访/已取消 (OVERDUE 派生态)
export type FollowUpStatus =
  | 'PENDING'
  | 'REMINDED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'MISSED'
  | 'CANCELLED'
  | 'OVERDUE'

export interface FollowUpPlan {
  id: string
  patientId: string
  patientName: string
  // [v3.0.6.11-92 Wave1B P0] 报告→随访关联 (报告详情"创建随访"入口带入)
  reportId?: string
  examId?: string
  // [v3.0.6.11-99 Wave3B] 来源模板
  templateId?: string
  planDate: string
  intervalDays: number
  nextDate: string
  status: FollowUpStatus
  note: string
  reminderEnabled: boolean
  // [v3.0.6.11-99 Wave3B] 闭环时间戳/原因
  remindedAt?: string | null
  missedAt?: string | null
  cancelledAt?: string | null
  reason?: string
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateFollowUpPlanDto {
  patientId: string
  patientName: string
  reportId?: string
  examId?: string
  templateId?: string
  planDate: string
  intervalDays?: number
  status?: FollowUpStatus
  note?: string
  reminderEnabled?: boolean
}

export interface UpdateFollowUpPlanDto extends Partial<CreateFollowUpPlanDto> {}

// [v3.0.6.11-99 Wave3B] 统计 DTO (完成率/失访率/异常率/按类别/按时段)
export interface FollowUpStats {
  total: number
  completed: number
  missed: number
  cancelled: number
  overdue: number
  inProgress: number
  reminded: number
  pending: number
  completionRate: number
  missRate: number
  abnormalRate: number
  byCategory: Array<{ category: string; count: number }>
  byMonth: Array<{ month: string; total: number; completed: number; missed: number }>
}

// [v3.0.6.11-104 Wave 2C] 催办队列返回结构 (GET /followups/reminder-queue)
export interface FollowUpReminderQueue {
  items: FollowUpPlan[]
  total: number
  days: number
  overdue: number
  dueToday: number
  upcoming: number
  queueType: 'OVERDUE' | 'DUE_TODAY' | 'UPCOMING'
}

// [v3.0.6.11-104 Wave 2C] 报告→随访返回结构 (POST /followups/from-report)
export interface FollowUpFromReportResult {
  created: number
  items: FollowUpPlan[]
  matched: string[]
  skipped: string[]
  reason: string | null
}

const LIST_PREFIX = '/followups'

// [W4-B] 随访计划: 列表/创建/更新/删除/完成/到期提醒
// [v3.0.6.11-99 Wave3B] + 状态机 (remind/miss/cancel/in-progress) + 统计 + 检查联动 (from-exam)
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

  // [v3.0.6.11-99 Wave3B] 状态机流转
  remind: async (id: string) => {
    const res = await api.post<FollowUpPlan>(`${LIST_PREFIX}/${id}/remind`)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  miss: async (id: string, reason: string) => {
    const res = await api.post<FollowUpPlan>(`${LIST_PREFIX}/${id}/miss`, { reason })
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  cancel: async (id: string, reason: string) => {
    const res = await api.post<FollowUpPlan>(`${LIST_PREFIX}/${id}/cancel`, { reason })
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  markInProgress: async (id: string) => {
    const res = await api.post<FollowUpPlan>(`${LIST_PREFIX}/${id}/in-progress`)
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  // [v3.0.6.11-99 Wave3B] 统计 (完成率/失访率/异常率/按类别/按时段)
  getStats: () => api.get<FollowUpStats>(`${LIST_PREFIX}/stats`),

  // [v3.0.6.11-99 Wave3B] 检查联动: 检查完成 → 自动创建随访计划
  fromExam: async (examId: string, templateId?: string) => {
    const res = await api.post<{ items: FollowUpPlan[]; total: number }>(`${LIST_PREFIX}/from-exam`, {
      examId,
      templateId,
    })
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  // [v3.0.6.11-104 Wave 2C] 随访催办队列: 逾期/今日到期/未来 N 天分组
  reminderQueue: (days: number = 7) =>
    api.get<FollowUpReminderQueue>(`${LIST_PREFIX}/reminder-queue?days=${days}`),

  // [v3.0.6.11-104 Wave 2C] 报告→随访: 按报告内容关键词手动补建随访计划 (不受 auto/hint 模式限制)
  fromReport: async (reportId: string, reason?: string) => {
    const res = await api.post<FollowUpFromReportResult>(`${LIST_PREFIX}/from-report`, { reportId, reason })
    await invalidateApiCacheByPrefix(LIST_PREFIX)
    return res
  },

  // [v3.0.6.11-100 Wave2C P3] 报告→随访触发规则: GET /followup-trigger-rules (规则列表 + 触发模式)
  listTriggerRules: () =>
    api.get<{ items: FollowUpTriggerRuleDto[]; mode: 'auto' | 'hint' }>('/followup-trigger-rules'),

  // [v3.0.6.11-103 Wave 1B] 触发模式配置: GET /followup-trigger-rules/mode (auto=自动创建 / hint=仅提示)
  getTriggerMode: () => api.get<{ mode: 'auto' | 'hint' }>('/followup-trigger-rules/mode'),
}

export type FollowUpListResult = ListData<FollowUpPlan>

// [v3.0.6.11-100 Wave2C P3] 报告→随访触发规则 DTO (对齐后端 followup-trigger-rules)
export interface FollowUpTriggerRuleDto {
  id: string
  keyword: string
  label: string
  description?: string
  templateId: string
  templateName: string
  intervals: number[]
  hint?: string
  active: boolean
}
