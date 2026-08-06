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

export const criticalApi = {
  list: (params?: { skip?: number; take?: number; state?: string; severity?: string; dateFrom?: string; dateTo?: string; patientId?: string }) => {
    const searchParams = new URLSearchParams()
    if (params) {
      if (params.skip !== undefined) searchParams.set('skip', String(params.skip))
      if (params.take !== undefined) searchParams.set('take', String(params.take))
      if (params.state) searchParams.set('state', params.state)
      if (params.severity) searchParams.set('severity', params.severity)
      if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
      if (params.dateTo) searchParams.set('dateTo', params.dateTo)
      if (params.patientId) searchParams.set('patientId', params.patientId)
    }
    const qs = searchParams.toString()
    return api.get<CriticalValueDto[]>(`/criticals${qs ? `?${qs}` : ''}`)
  },

  getById: (id: string) =>
    api.get<CriticalValueDto>(`/criticals/${id}`),

  create: (data: { examId?: string; description: string; severity?: string; method?: string }) =>
    api.post<CriticalValueDto>('/criticals', data),

  update: (id: string, data: { description?: string; severity?: string; state?: string; notifiedTo?: string; ackedBy?: string; resolvedBy?: string; closedBy?: string }) =>
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

  // [G005-P0] 闭环统一走 PATCH /criticals/:id state=CLOSED_LOOP (原 POST /criticals/close-loop 后端无该端点)
  closeLoop: (id: string, closedBy?: string) =>
    api.patch<CriticalValueDto>(`/criticals/${id}`, { state: 'CLOSED_LOOP', closedBy }),

  notify: (id: string, method?: NotificationMethod, extra?: { patientName?: string; patientId?: string; category?: string; finding?: string; recipientName?: string; recipientDept?: string; recipientPhone?: string }) =>
    api.post<{ id: string; status?: string; count?: number }>('/criticals/notify', { criticalId: id, channels: method ? [method] : ['SYSTEM'], ...extra }),

  escalate: (id: string, to: string, reason: string) =>
    api.post<{ id: string }>('/criticals/escalate', { criticalId: id, reason, newRecipients: [{ name: to, dept: '', phone: '' }] }),

  listHistory: (criticalId: string) =>
    api.get<unknown[]>(`/criticals/${criticalId}/history`),

  // [G005-P0] 5 步工作流记录 (criticalValue + 通知记录聚合, 后端 /criticals/value5step/list)
  getValue5StepList: () =>
    api.get<{ items: unknown[]; total: number }>('/criticals/value5step/list'),

  runEscalationChain: (eventId: string) =>
    api.post<{ chain: unknown; nodesTriggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> }>(`/criticals/${eventId}/escalation-chain`),

  getStats: () =>
    api.get<CriticalStatsDto>('/criticals/stats'),
}
