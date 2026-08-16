import { api, invalidateApiCache } from './client'

// Critical Alert (危急值告警) API
// Backend: /critical-alert/*

// [v3.0.6.11-103 Wave 13] 危急值 5 步流程: 触发→通知→确认→处置→记录 (闭环)
export type CriticalFlowStep = 'triggered' | 'notified' | 'confirmed' | 'treating' | 'closed'
export type CriticalFlowStatus = CriticalFlowStep | 'escalated'

export interface CriticalFlowSteps {
  triggered?: string
  notified?: string
  confirmed?: string
  treating?: string
  closed?: string
}

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
  // [v3.0.6.11-103 Wave 13] 5 步流程: 当前步骤索引 (0-4, -1=已升级) + 各步时间戳
  step?: number
  flowStatus?: CriticalFlowStatus
  flowSteps?: CriticalFlowSteps
}

export interface CriticalAlertQueryParams {
  status?: string
  severity?: string
  alertType?: string
  page?: number
  pageSize?: number
}

export interface CreateCriticalAlertDto {
  // [G005 Wave 1A] 后端 CreateAlertSchema: criticalValueId | level 二选一 + reportId 反向引用
  criticalValueId?: string
  level?: string
  patientId?: string
  patientName?: string
  studyId?: string
  modality?: string
  title?: string
  description?: string
  reportId?: string
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

// [G005 Wave 2A] 电话/短信网关
export interface CallLog {
  id: string
  alertId: string
  phone: string
  status: 'initiated' | 'connected' | 'failed'
  startedAt: string
  durationSec: number
  recordingUrl?: string
}

export interface SmsLog {
  id: string
  alertId: string
  phone: string
  status: 'sent' | 'failed'
  content: string
  sentAt: string
}

export interface CommunicationEntry {
  id: string
  alertId: string
  channel: 'phone' | 'sms'
  phone: string
  status: string
  at: string
  durationSec?: number
  recordingUrl?: string
  content?: string
}

export interface AutoCallDto {
  phone?: string
}

export interface AutoSmsDto {
  phone?: string
  content?: string
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

  // [G005 Wave 1A] 按报告查询关联危急值告警 (GET /critical-alert/for-report/:reportId 反向引用)
  forReport: (reportId: string) =>
    api.get<CriticalAlert[]>(`/critical-alert/for-report/${encodeURIComponent(reportId)}`),

  // [G005 Wave 2A] 电话/短信网关 (后端 critical-alert.controller 已实现)
  autoCall: (id: string, dto?: AutoCallDto) =>
    api.post<CallLog>(`/critical-alert/alerts/${id}/auto-call`, dto ?? {}),

  autoSms: (id: string, dto?: AutoSmsDto) =>
    api.post<SmsLog>(`/critical-alert/alerts/${id}/auto-sms`, dto ?? {}),

  getCommunicationLog: (id: string) =>
    api.get<CommunicationEntry[]>(`/critical-alert/alerts/${id}/communication-log`),

  // [v3.0.6.11-103 Wave 13] 危急值 5 步流程 (触发→通知→确认→处置→记录)
  notify: async (id: string, dto: { method?: 'phone' | 'sms'; phone?: string; recipient?: string } = {}) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/notify`, dto)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  confirm: async (id: string, dto: { receiver?: string; comment?: string } = {}) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/confirm`, dto)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  treat: async (id: string, dto: { treatment?: string; orders?: string } = {}) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/treat`, dto)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },

  close: async (id: string, dto: { summary?: string; closedBy?: string } = {}) => {
    const res = await api.post<CriticalAlert>(`/critical-alert/alerts/${id}/close`, dto)
    await invalidateApiCache('/critical-alert/alerts')
    return res
  },
}
