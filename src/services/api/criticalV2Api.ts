/**
 * [G005 v3.0.6.11-101 Wave 6C] 危急值管理 V2 API (F5)
 * 后端: backend/src/modules/critical-v2 (孤儿模块 + seed 回退)
 */
import { api } from './client'

export type CriticalLevelV2 = 'critical' | 'urgent' | 'warning'
export type CompareOpV2 = '>' | '>=' | '<' | '<=' | 'contains' | 'notContains'
export type TriggerStatusV2 = 'triggered' | 'notified' | 'confirmed' | 'rejected' | 'resolved'
export type NotifyChannelV2 = 'phone' | 'sms' | 'message'

export interface CriticalRuleV2 {
  id: string
  code: string
  name: string
  category: string
  modality: string
  examType: string
  itemKey: string
  item: string
  operator: CompareOpV2
  threshold?: number
  thresholdText?: string
  unit?: string
  level: CriticalLevelV2
  description: string
  suggestion: string
  responseDeadlineMin: number
  enabled: boolean
  createdAt: string
}

export interface EvaluateItemV2 {
  key: string
  name?: string
  value: number | string
  unit?: string
}

export interface EvaluateInputV2 {
  patientId?: string
  patientName?: string
  examType?: string
  modality?: string
  items?: EvaluateItemV2[]
  description?: string
}

export interface CriticalTriggerV2 {
  id: string
  ruleId: string
  ruleCode: string
  ruleName: string
  level: CriticalLevelV2
  patientId?: string
  patientName: string
  examType?: string
  modality?: string
  matchedItem?: string
  matchedValue?: string
  matchedText: string
  description: string
  suggestion: string
  status: TriggerStatusV2
  notifiedAt?: string
  confirmedBy?: string
  confirmedAt?: string
  confirmDecision?: 'accepted' | 'rejected'
  confirmComment?: string
  responseMinutes?: number
  createdAt: string
}

export interface CriticalNotificationV2 {
  id: string
  triggerId: string
  channel: NotifyChannelV2
  recipientName: string
  recipientDept?: string
  recipientPhone?: string
  content: string
  status: 'sent' | 'failed' | 'accepted' | 'rejected'
  sentAt?: string
  confirmedAt?: string
  createdAt: string
}

export interface CriticalStatsV2 {
  totalEvaluations: number
  totalTriggers: number
  triggerRate: number
  confirmedCount: number
  rejectedCount: number
  onTimeConfirmRate: number
  timeoutCount: number
  timeoutRate: number
  avgResponseMinutes: number
  byLevel: { level: CriticalLevelV2; count: number }[]
  topRules: { ruleId: string; ruleCode: string; ruleName: string; count: number }[]
}

export interface CriticalRecipientV2 {
  name: string
  dept?: string
  phone?: string
  channels?: NotifyChannelV2[]
}

export const criticalV2Api = {
  listRules: (params?: { category?: string; modality?: string; enabled?: boolean; keyword?: string }) =>
    api.get<CriticalRuleV2[]>('/critical-v2/rules' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null),
      ) as Record<string, string>,
    ).toString() : '')),

  createRule: (data: Partial<CriticalRuleV2> & { name: string; itemKey: string; item: string; operator: CompareOpV2 }) =>
    api.post<CriticalRuleV2>('/critical-v2/rules', data),

  updateRule: (id: string, patch: Partial<Pick<CriticalRuleV2, 'enabled' | 'threshold' | 'thresholdText' | 'suggestion' | 'level'>>) =>
    api.patch<CriticalRuleV2>(`/critical-v2/rules/${id}`, patch),

  evaluate: (input: EvaluateInputV2) =>
    api.post<{ evaluatedAt: string; triggers: CriticalTriggerV2[] }>('/critical-v2/evaluate', input),

  judge: (input: EvaluateInputV2 & { recipients?: CriticalRecipientV2[] }) =>
    api.post<CriticalTriggerV2[]>('/critical-v2/judge', input),

  listTriggers: (params?: { status?: string; level?: CriticalLevelV2; patientName?: string }) =>
    api.get<CriticalTriggerV2[]>('/critical-v2/triggers' + (params ? '?' + new URLSearchParams(
      Object.fromEntries(
        Object.entries(params).filter(([_, v]) => v !== undefined && v !== null),
      ) as Record<string, string>,
    ).toString() : '')),

  getTrigger: (id: string) =>
    api.get<CriticalTriggerV2>(`/critical-v2/triggers/${id}`),

  notifyTrigger: (id: string, data: { recipients?: CriticalRecipientV2[] }) =>
    api.post<CriticalNotificationV2[]>(`/critical-v2/triggers/${id}/notify`, data),

  resolveTrigger: (id: string, comment?: string) =>
    api.post<CriticalTriggerV2>(`/critical-v2/triggers/${id}/resolve`, { comment }),

  listNotifications: (triggerId?: string) =>
    api.get<CriticalNotificationV2[]>('/critical-v2/notifications' + (triggerId ? `?triggerId=${encodeURIComponent(triggerId)}` : '')),

  confirmNotification: (id: string, data: { decision: 'accepted' | 'rejected'; comment?: string; confirmedBy?: string }) =>
    api.post<{ notification: CriticalNotificationV2; trigger: CriticalTriggerV2 }>(`/critical-v2/notifications/${id}/confirm`, data),

  stats: () =>
    api.get<CriticalStatsV2>('/critical-v2/stats'),
}
