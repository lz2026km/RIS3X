import { api, invalidateApiCache } from './client'

// [G005 Wave 6B v3.0.6.11-101] 危急值升级链 V2 (critical-escalation) API
// 后端: backend/src/modules/critical-escalation/ (孤儿模块: 升级链配置 + 执行状态机 + 统计)

export type EscalationLevel = 1 | 2 | 3
export type ChainStatus = 'NOTIFYING' | 'PENDING_CONFIRM' | 'CONFIRMED' | 'ESCALATED' | 'CLOSED'
export type StepStatus = 'NOTIFIED' | 'CONFIRMED' | 'TIMEOUT'

export interface EscalationLevelConfig {
  level: EscalationLevel
  name: string
  role: string
  timeoutMinutes: number
  channels: string[]
}

export interface EscalationRule {
  key: string
  name: string
  description: string
  enabled: boolean
}

export interface EscalationStep {
  level: EscalationLevel
  levelName: string
  role: string
  status: StepStatus
  timeoutMinutes: number
  startedAt: string
  deadline: string
  notifiedAt?: string
  confirmedAt?: string
  confirmedBy?: string
}

export interface EscalationChain {
  id: string
  criticalValueId: string
  patientName: string
  modality: string
  title: string
  severity: string
  status: ChainStatus
  currentLevel: EscalationLevel
  startedAt: string
  currentLevelStartedAt: string
  currentDeadline: string
  escalatedCount: number
  acknowledgedBy?: string
  acknowledgedAt?: string
  closedAt?: string
  closedBy?: string
  steps: EscalationStep[]
  history: Array<{ at: string; reason: string }>
}

export interface EscalationConfig {
  levels: EscalationLevelConfig[]
  rules: EscalationRule[]
  statusLabels: Record<ChainStatus, string>
  stepLabels: Record<StepStatus, string>
}

export interface LevelResponseStat {
  level: EscalationLevel
  levelName: string
  count: number
  confirmed: number
  escalated: number
  avgResponseMinutes: number
}

export interface EscalationStats {
  total: number
  byStatus: Record<ChainStatus, number>
  avgResponseMinutes: number
  avgEscalationCount: number
  escalationRate: number
  closedRate: number
  byLevel: LevelResponseStat[]
}

const PREFIX = '/critical-escalation'

export const criticalEscalationApi = {
  getConfig: () => api.get<EscalationConfig>(`${PREFIX}/config`),

  updateConfig: async (levels: Array<{ level: number; name?: string; role?: string; timeoutMinutes: number; channels?: string[] }>) => {
    const res = await api.put<{ levels: EscalationLevelConfig[] }>(`${PREFIX}/config`, { levels })
    await invalidateApiCache(`${PREFIX}/config`)
    return res
  },

  listChains: (status?: string) => api.get<EscalationChain[]>(`${PREFIX}/chains${status ? `?status=${status}` : ''}`),

  startChain: async (data: { criticalValueId: string; patientName?: string; modality?: string; title?: string; severity?: string }) => {
    const res = await api.post<EscalationChain>(`${PREFIX}/chains`, data)
    await invalidateApiCache(`${PREFIX}/chains`)
    return res
  },

  getChain: (id: string) => api.get<EscalationChain>(`${PREFIX}/chains/${id}`),

  tick: async (id: string) => {
    const res = await api.post<EscalationChain>(`${PREFIX}/chains/${id}/tick`)
    await invalidateApiCache(`${PREFIX}/chains`)
    return res
  },

  acknowledge: async (id: string, data: { confirmedBy: string; comment?: string }) => {
    const res = await api.post<EscalationChain>(`${PREFIX}/chains/${id}/acknowledge`, data)
    await invalidateApiCache(`${PREFIX}/chains`)
    return res
  },

  escalate: async (id: string, data?: { reason?: string; escalatedBy?: string }) => {
    const res = await api.post<EscalationChain>(`${PREFIX}/chains/${id}/escalate`, data ?? {})
    await invalidateApiCache(`${PREFIX}/chains`)
    return res
  },

  closeChain: async (id: string, data?: { closedBy?: string; comment?: string }) => {
    const res = await api.post<EscalationChain>(`${PREFIX}/chains/${id}/close`, data ?? {})
    await invalidateApiCache(`${PREFIX}/chains`)
    return res
  },

  stepsOf: (id: string) => api.get<EscalationStep[]>(`${PREFIX}/chains/${id}/steps`),

  getStats: () => api.get<EscalationStats>(`${PREFIX}/stats`),
}
