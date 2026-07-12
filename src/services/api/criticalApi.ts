import { api } from './client'

export type NotificationMethod = 'PHONE' | 'SMS' | 'SYSTEM' | 'EMAIL' | 'WECHAT' | 'DINGTALK'

export interface CriticalValueDto {
  id: string
  examId: string
  patientName: string
  finding: string
  severity: string
  status: string
  triggeredAt: string
  notifiedAt?: string
  acknowledgedAt?: string
  doctorId?: string
  notificationMethod?: NotificationMethod
}

export const criticalApi = {
  list: () =>
    api.get<CriticalValueDto[]>('/critical'),

  getById: (id: string) =>
    api.get<CriticalValueDto>(`/critical/${id}`),

  create: (data: Partial<CriticalValueDto>) =>
    api.post<CriticalValueDto>('/critical', data),

  acknowledge: (id: string) =>
    api.put<CriticalValueDto>(`/critical/${id}/acknowledge`),

  resolve: (id: string) =>
    api.put<CriticalValueDto>(`/critical/${id}/resolve`),

  notify: (id: string, method: NotificationMethod) =>
    api.put<CriticalValueDto>(`/critical/${id}/notify`, { method }),

  escalate: (id: string, to: string, reason: string) =>
    api.post<CriticalValueDto>(`/critical/${id}/escalate`, { to, reason }),

  runEscalationChain: (eventId: string) =>
    api.post<{ chain: unknown; nodesTriggered: Array<{ level: number; role: string; doctor: string; smsResults: number; voiceResults: number }> }>(`/critical/${eventId}/escalation-chain`),

  listEscalationChains: () =>
    api.get<unknown[]>('/critical/escalation-chains'),
}
