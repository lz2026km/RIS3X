import { api, invalidateApiCache } from './client'

// Critical Alert (危急值告警) API
// Backend: /critical-alert/*

export interface CriticalAlert {
  id: string
  patientId: string
  patientName: string
  studyId: string
  modality: string
  alertType: 'critical_value' | 'unexpected_finding' | 'technical_issue' | 'protocol_deviation'
  severity: 'info' | 'warning' | 'critical' | 'emergency'
  title: string
  description: string
  acknowledgedBy?: string
  acknowledgedAt?: string
  status: 'active' | 'acknowledged' | 'resolved' | 'escalated'
  assignee?: string
  createdAt: string
  resolvedAt?: string
}

export interface CriticalAlertQueryParams {
  status?: string
  severity?: string
  alertType?: string
  page?: number
  pageSize?: number
}

export interface CreateCriticalAlertDto {
  level?: string
  patientId?: string
  patientName?: string
  studyId?: string
  modality?: string
  title?: string
  description?: string
}

export interface AcknowledgeAlertDto {
  comment?: string
}

export interface ResolveAlertDto {
  resolution: string
  comment?: string
}

export interface CriticalAlertStats {
  totalAlerts: number
  activeCount: number
  acknowledgedCount: number
  resolvedCount: number
  avgResponseTimeMinutes: number
  severityDistribution: { severity: string; count: number }[]
}

export const criticalAlertApi = {
  create: async (dto: CreateCriticalAlertDto) => {
    const res = await api.post<CriticalAlert>('/critical-alert', dto)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  listAlerts: (params?: CriticalAlertQueryParams) =>
    api.get<CriticalAlert[]>(`/critical-alert/alerts?${new URLSearchParams(params ?? {}).toString()}`),

  getAlert: (id: string) =>
    api.get<CriticalAlert>(`/critical-alert/alerts/${id}`),

  acknowledge: async (id: string, data: AcknowledgeAlertDto) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/acknowledge`, data)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  resolve: async (id: string, data: ResolveAlertDto) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/resolve`, data)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  escalate: async (id: string, assignee: string) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/escalate`, { assignee })
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  getStats: () =>
    api.get<CriticalAlertStats>('/critical-alert/stats'),
}
