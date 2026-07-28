import { api, invalidateApiCache } from './client'

// Auto Collection (自动采集) API
// Backend: /auto-collection/*

export interface AutoCollectionRule {
  id: string
  name: string
  description: string
  triggerType: 'event' | 'schedule' | 'threshold'
  triggerConfig: Record<string, unknown>
  action: 'notify' | 'report' | 'archive' | 'transfer'
  actionConfig: Record<string, unknown>
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface AutoCollectionTask {
  id: string
  ruleId: string
  ruleName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  triggeredAt: string
  completedAt?: string
  result?: Record<string, unknown>
  error?: string
}

export interface AutoCollectionConfig {
  id: string
  key: string
  value: string
  description: string
  category: string
}

export interface AutoCollectionStats {
  totalRules: number
  activeRules: number
  totalTasks: number
  completedTasks: number
  failedTasks: number
  dailyExecutions: { date: string; count: number; successCount: number }[]
}

export const autoCollectionApi = {
  listRules: () =>
    api.get<AutoCollectionRule[]>('/auto-collection/rules'),

  getRule: (id: string) =>
    api.get<AutoCollectionRule>(`/auto-collection/rules/${id}`),

  createRule: async (data: Omit<AutoCollectionRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await api.post<AutoCollectionRule>('/auto-collection/rules', data)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  updateRule: async (id: string, data: Partial<AutoCollectionRule>) => {
    const res = await api.put<AutoCollectionRule>(`/auto-collection/rules/${id}`, data)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  deleteRule: async (id: string) => {
    const res = await api.delete(`/auto-collection/rules/${id}`)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  toggleRule: async (id: string, enabled: boolean) => {
    const res = await api.put<AutoCollectionRule>(`/auto-collection/rules/${id}`, { enabled })
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  listTasks: (params?: { ruleId?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<AutoCollectionTask[]>(`/auto-collection/tasks?${new URLSearchParams(params ?? {}).toString()}`),

  getTask: (id: string) =>
    api.get<AutoCollectionTask>(`/auto-collection/tasks/${id}`),

  rerunTask: async (id: string) => {
    const res = await api.post<AutoCollectionTask>(`/auto-collection/tasks/${id}/rerun`, {})
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  getConfig: () =>
    api.get<AutoCollectionConfig[]>('/auto-collection/config'),

  updateConfig: async (key: string, value: string) => {
    const res = await api.put<AutoCollectionConfig>(`/auto-collection/config/${key}`, { value })
    await invalidateApiCache('/auto-collection/config')
    return res
  },

  getStats: () =>
    api.get<AutoCollectionStats>('/auto-collection/stats'),
}
