import { api } from './client'

export type NotificationMethod = 'PHONE' | 'SMS' | 'SYSTEM' | 'EMAIL' | 'WECHAT' | 'DINGTALK'

export interface CriticalValueDto {
  id: string
  examId?: string
  patientName: string
  patientId?: string
  finding: string
  severity: string
  category?: string
  description?: string
  method?: string
  state?: string
  status: string
  triggeredAt: string
  notifiedAt?: string
  acknowledgedAt?: string
  resolvedAt?: string
  doctorId?: string
  notifiedTo?: string
  ackedBy?: string
  resolvedBy?: string
  notificationMethod?: NotificationMethod
  createdAt?: string
  updatedAt?: string
}

export interface CriticalRuleDto {
  id: string
  name: string
  condition: string
  action: string
  severity: string
  enabled: boolean
  createdAt?: string
  updatedAt?: string
}

export interface CriticalStatsDto {
  total: number
  pending: number
  notified: number
  acknowledged: number
  resolved: number
  escalated: number
}

export interface CriticalSummaryDto {
  todayCount: number
  weeklyCount: number
  monthlyCount: number
  avgResponseTime: number
}

export interface CriticalTimelineDto {
  date: string
  count: number
  resolved: number
  escalated: number
}

export interface CriticalCenterDto {
  id: string
  patientName: string
  finding: string
  severity: string
  status: string
  triggeredAt: string
  department: string
}

export const criticalApi = {
  list: (params?: { skip?: number; take?: number; state?: string; severity?: string; dateFrom?: string; dateTo?: string }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      if (params.skip !== undefined) searchParams.set('skip', String(params.skip))
      if (params.take !== undefined) searchParams.set('take', String(params.take))
      if (params.state) searchParams.set('state', params.state)
      if (params.severity) searchParams.set('severity', params.severity)
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
      if (params.dateTo) searchParams.set('dateTo', params.dateTo)
    }
    const qs = searchParams.toString()
    return api.get<CriticalValueDto[]>(`/criticals${qs ? `?${qs}` : ''}`)
  },

  getById: (id: string) =>
    api.get<CriticalValueDto>(`/criticals/${id}`),

  create: (data: { examId?: string; description: string; severity?: string; method?: string }) =>
    api.post<CriticalValueDto>('/criticals', data),

  update: (id: string, data: { description?: string; severity?: string; state?: string; notifiedTo?: string; ackedBy?: string; resolvedBy?: string }) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, data),

  delete: (id: string) =>
    api.delete(`/criticals/${id}`),

  acknowledge: (id: string) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, { state: 'ACKNOWLEDGED' }),

  resolve: (id: string) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, { state: 'RESOLVED' }),

  notify: (id: string, method?: NotificationMethod) =>
    api.post<{ id: string }>('/criticals/notify', { criticalId: id, channels: method ? [method] : ['SYSTEM'] }),

  escalate: (id: string, to: string, reason: string) =>
    api.post<{ id: string }>('/criticals/escalate', { criticalId: id, reason, newRecipients: [{ name: to, dept: '', phone: '' }] }),

  listHistory: (criticalId: string) =>
    api.get<unknown[]>(`/criticals/${criticalId}/history`),

  runEscalationChain: (eventId: string) =>
    api.post<{ chain: unknown; nodesTriggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> }>(`/criticals/${eventId}/escalation-chain`),

  listRules: () =>
    api.get<CriticalRuleDto[]>('/criticals/rules'),

  createRule: (data: Partial<CriticalRuleDto>) =>
    api.post<CriticalRuleDto>('/criticals/rules', data),

  updateRule: (id: string, data: Partial<CriticalRuleDto>) =>
    api.put<CriticalRuleDto>(`/criticals/rules/${id}`, data),

  deleteRule: (id: string) =>
    api.delete(`/criticals/rules/${id}`),

  getStats: () =>
    api.get<CriticalStatsDto>('/criticals/stats'),

  getSummary: () =>
    api.get<CriticalSummaryDto>('/criticals/stats/summary'),

  getTimeline: () =>
    api.get<CriticalTimelineDto[]>('/criticals/stats/timeline'),

  listCenter: () =>
    api.get<CriticalCenterDto[]>('/criticals/center'),

  getCenterItem: (id: string) =>
    api.get<CriticalCenterDto>(`/criticals/center/${id}`),

  autoDetect: (data: { examId: string; finding: string }) =>
    api.post<{ id: string }>('/criticals/auto-detect', data),

  closeLoop: (data: { criticalId: string; note: string }) =>
    api.post<{ id: string }>('/criticals/close-loop', data),

  getReceiverPortal: () =>
    api.get<unknown>('/criticals/receiver'),
}
