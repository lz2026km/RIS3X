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
  voiceCalledAt?: string
  voiceCalledBy?: string
  acknowledgedAt?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmedSignature?: string
  confirmedComment?: string
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
  receipted: number
  resolved: number
  escalated: number
  todayCount: number
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

  voiceCall: (id: string, data: { calledBy: string; phoneNumber: string; note?: string }) =>
    api.post<CriticalValueDto>(`/criticals/${id}/voice-call`, data),

  clinicalReceipt: (id: string, data: { confirmedBy: string; signature?: string; comment?: string }) =>
    api.post<CriticalValueDto>(`/criticals/${id}/clinical-receipt`, data),

  acknowledge: (id: string) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, { state: 'ACKNOWLEDGED' }),

  resolve: (id: string) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, { state: 'RESOLVED' }),

  notify: (id: string, method?: NotificationMethod, extra?: { patientName?: string; patientId?: string; category?: string; finding?: string; recipientName?: string; recipientDept?: string; recipientPhone?: string }) =>
    api.post<{ id: string; status?: string; count?: number }>('/criticals/notify', { criticalId: id, channels: method ? [method] : ['SYSTEM'], ...extra }),

  escalate: (id: string, to: string, reason: string) =>
    api.post<{ id: string }>('/criticals/escalate', { criticalId: id, reason, newRecipients: [{ name: to, dept: '', phone: '' }] }),

  listHistory: (criticalId: string) =>
    api.get<unknown[]>(`/criticals/${criticalId}/history`),

  // [v3.0.6.11-60] Batch 3: 随访记录 (供 CriticalValuePage 详情/随访使用)
  listFollowUpRecords: () =>
    api.get<unknown[]>('/criticals/follow-up-records'),

  // [G005-P0] 5 步工作流记录 (criticalValue + 通知记录聚合, 后端 /criticals/value5step/list)
  getValue5StepList: () =>
    api.get<{ items: unknown[]; total: number }>('/criticals/value5step/list'),

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

  // critical-ext endpoints
  listCriticalExtRules: () =>
    api.get<CriticalRuleDto[]>('/critical-ext/rules'),
  createCriticalExtRule: (data: Partial<CriticalRuleDto>) =>
    api.post<CriticalRuleDto>('/critical-ext/rules', data),
  updateCriticalExtRule: (id: string, data: Partial<CriticalRuleDto>) =>
    api.put<CriticalRuleDto>(`/critical-ext/rules/${id}`, data),
  deleteCriticalExtRule: (id: string) =>
    api.delete(`/critical-ext/rules/${id}`),
  getCriticalExtStats: () =>
    api.get<CriticalStatsDto>('/critical-ext/stats'),
  getCriticalExtSummary: () =>
    api.get<CriticalSummaryDto>('/critical-ext/stats/summary'),
  getCriticalExtTimeline: () =>
    api.get<CriticalTimelineDto[]>('/critical-ext/stats/timeline'),
  listCriticalExtCenter: () =>
    api.get<CriticalCenterDto[]>('/critical-ext/center'),
  getCriticalExtCenterItem: (id: string) =>
    api.get<CriticalCenterDto>(`/critical-ext/center/${id}`),
  criticalExtAutoDetect: (data: { examId: string; finding: string }) =>
    api.post<{ id: string }>('/critical-ext/auto-detect', data),
  criticalExtCloseLoop: (data: { criticalId: string; note: string }) =>
    api.post<{ id: string }>('/critical-ext/close-loop', data),
  getCriticalExtReceiverPortal: () =>
    api.get<unknown>('/critical-ext/receiver'),
}
