import { api, invalidateApiCache } from './client'

// Auto Collection (自动采集) API
// [G005 Wave1A W9] 后端已实现全部端点 (backend/src/modules/auto-collection/auto-collection.controller.ts):
//   rules CRUD + tasks (start/stop/run/rerun) + config + logs + stats

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

// [G005 Wave1A W9] 采集执行日志 (后端 GET /auto-collection/logs)
export interface AutoCollectionLog {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
}

export const autoCollectionApi = {
  listRules: () =>
    api.get<AutoCollectionRule[]>('/auto-collection/rules'),

  // [Wave1B] 后端已实现 (auto-collection.controller)
  getRule: (id: string) =>
    api.get<AutoCollectionRule>(`/auto-collection/rules/${id}`),

  // [Wave1B] 后端已实现 (auto-collection.controller)
  createRule: async (data: Omit<AutoCollectionRule, 'id' | 'createdAt' | 'updatedAt'>) => {
    const res = await api.post<AutoCollectionRule>('/auto-collection/rules', data)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // [Wave1B] 后端已实现 (auto-collection.controller)
  updateRule: async (id: string, data: Partial<AutoCollectionRule>) => {
    const res = await api.put<AutoCollectionRule>(`/auto-collection/rules/${id}`, data)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // [Wave1B] 后端已实现 (auto-collection.controller)
  deleteRule: async (id: string) => {
    const res = await api.delete(`/auto-collection/rules/${id}`)
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // [Wave1B] 后端已实现 (auto-collection.controller)
  toggleRule: async (id: string, enabled: boolean) => {
    const res = await api.put<AutoCollectionRule>(`/auto-collection/rules/${id}`, { enabled })
    await invalidateApiCache('/auto-collection/rules')
    return res
  },

  // [Wave1B] 后端已实现 (auto-collection.controller)
  listTasks: (params?: { ruleId?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<AutoCollectionTask[]>(`/auto-collection/tasks?${new URLSearchParams(params as Record<string, string> | undefined).toString()}`),

  // [Wave1B P2] 创建采集任务 (后端 POST /auto-collection/tasks, CreateTaskSchema: ruleId?/sourceType?)
  createTask: async (data: { name?: string; ruleId?: string; sourceType?: 'DICOM' | 'HL7' | 'FTP'; sourceConfig?: Record<string, unknown> }) => {
    const res = await api.post<AutoCollectionTask>('/auto-collection/tasks', data)
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  // [Wave1B] 后端已实现 (auto-collection.controller)
  getTask: (id: string) =>
    api.get<AutoCollectionTask>(`/auto-collection/tasks/${id}`),

  // [G005 Wave1A W9] 任务重跑 (后端 POST /auto-collection/tasks/:id/rerun)
  rerunTask: async (id: string) => {
    const res = await api.post<AutoCollectionTask>(`/auto-collection/tasks/${id}/rerun`, {})
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  // [G005 Wave1A W9] 启动任务 (后端 POST /auto-collection/tasks/:id/start)
  startTask: async (id: string) => {
    const res = await api.post<AutoCollectionTask>(`/auto-collection/tasks/${id}/start`, {})
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  // [G005 Wave1A W9] 停止任务 (后端 POST /auto-collection/tasks/:id/stop)
  stopTask: async (id: string) => {
    const res = await api.post<AutoCollectionTask>(`/auto-collection/tasks/${id}/stop`, {})
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  // [G005 Wave1A W9] 立即执行任务 (后端 POST /auto-collection/tasks/:id/run)
  runTask: async (id: string) => {
    const res = await api.post<AutoCollectionTask>(`/auto-collection/tasks/${id}/run`, {})
    await invalidateApiCache('/auto-collection/tasks')
    return res
  },

  // [G005 Wave1A W9] 采集执行日志 (后端 GET /auto-collection/logs)
  listLogs: (limit?: number) =>
    api.get<AutoCollectionLog[]>(`/auto-collection/logs${limit ? `?limit=${limit}` : ''}`),

  // [Wave1B] 后端已实现 (auto-collection.controller)
  getConfig: () =>
    api.get<AutoCollectionConfig[]>('/auto-collection/config'),

  // [Wave1B] 后端已实现 (auto-collection.controller)
  updateConfig: async (key: string, value: string) => {
    const res = await api.put<AutoCollectionConfig>(`/auto-collection/config/${key}`, { value })
    await invalidateApiCache('/auto-collection/config')
    return res
  },

  // [G005 Wave1A W9] 采集统计 (后端 GET /auto-collection/stats)
  getStats: () =>
    api.get<AutoCollectionStats>('/auto-collection/stats'),
}
