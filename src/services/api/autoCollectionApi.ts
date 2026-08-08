import { api, invalidateApiCache } from './client'

// Auto Collection (自动采集) API
// [G005 W1-C] MOCK_ONLY: 后端无 auto-collection controller,
// 全部 12 方法由 MSW (src/services/mockBackend/autoCollectionHandlers.ts) 支撑演示数据, 后端待实现。

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
  // MOCK_ONLY (后端无 controller, MSW 支撑)
  listRules: () =>
    api.get<AutoCollectionRule[]>('/auto-collection/rules'),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getRule: (id: string) =>
    api.get<AutoCollectionRule>(`/auto-collection/rules/${id}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  createRule: async (data: Omit<AutoCollectionRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await api.post<AutoCollectionRule>('/auto-collection/rules', data)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  updateRule: async (id: string, data: Partial<AutoCollectionRule>) => {
    const res = await api.put<AutoCollectionRule>(`/auto-collection/rules/${id}`, data)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  deleteRule: async (id: string) => {
    const res = await api.delete(`/auto-collection/rules/${id}`)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  toggleRule: async (id: string, enabled: boolean) => {
    const res = await api.put<AutoCollectionRule>(`/auto-collection/rules/${id}`, { enabled })
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  listTasks: (params?: { ruleId?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<AutoCollectionTask[]>(`/auto-collection/tasks?${new URLSearchParams(params ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getTask: (id: string) =>
    api.get<AutoCollectionTask>(`/auto-collection/tasks/${id}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  rerunTask: async (id: string) => {
    const res = await api.post<AutoCollectionTask>(`/auto-collection/tasks/${id}/rerun`, {})
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getConfig: () =>
    api.get<AutoCollectionConfig[]>('/auto-collection/config'),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  updateConfig: async (key: string, value: string) => {
    const res = await api.put<AutoCollectionConfig>(`/auto-collection/config/${key}`, { value })
    await invalidateApiCache('/auto-collection/config')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getStats: () =>
    api.get<AutoCollectionStats>('/auto-collection/stats'),
}
