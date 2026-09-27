/**
 * [G005 W12-PatientService] 患者服务专业化 API
 *   微信服务号/小程序 · 支付订单/退款 · 通知渠道(短信/模板/语音) · 满意度分析 · 自助登记
 *   对齐后端模块: backend/src/modules/{wechat,payment,notification-channel,satisfaction,self-registration}
 */
import { api } from './client'
import type { ApiResponse } from './types'

// ─────────────────────────────────────────────────────────────────────────────
// 微信服务号 / 小程序
// ─────────────────────────────────────────────────────────────────────────────
export type WechatChannel = 'SERVICE_ACCOUNT' | 'MINI_PROGRAM'
export type WechatLogType = 'OAUTH' | 'BIND' | 'PUSH' | 'TEMPLATE' | 'MENU'
export type WechatLogStatus = 'SENT' | 'FAILED' | 'ARCHIVED'

export interface WechatUserDto {
  openid: string
  unionid: string
  nickname: string
  avatarUrl: string
  gender: string
  channel: WechatChannel
  phone?: string
  boundPatientId?: string
  boundEmpiId?: string
  boundPatientName?: string
  boundAt?: string
  subscribed: boolean
  createdAt: string
  updatedAt: string
}

export interface WechatSendLogDto {
  id: string
  type: WechatLogType
  channel: WechatChannel
  openid: string
  title: string
  content: string
  status: WechatLogStatus
  attempts: number
  error?: string
  createdAt: string
  archivedAt?: string
}

export interface WechatSubscribeConfigDto {
  nickname: string
  serviceAccount: string
  miniProgramAppId: string
  subscribeTemplates: Array<{ templateId: string; title: string; scene: string; enabled: boolean }>
  subscribedEvents: Array<{ event: string; label: string; enabled: boolean }>
  welcomeMessage: string
}

export interface WechatMenuButtonDto {
  name: string
  type: 'click' | 'view' | 'miniprogram' | 'parent'
  key?: string
  url?: string
  appId?: string
  pagePath?: string
  sub_button?: WechatMenuButtonDto[]
}

export interface WechatMenuDto {
  menuId: string
  channel: WechatChannel
  buttons: WechatMenuButtonDto[]
  publishedAt: string
  version: number
}

export const wechatApi = {
  oauthCallback: (body: { code: string; channel?: WechatChannel }) =>
    api.post<{ openid: string; unionid: string; sessionKeyHint: string; isNew: boolean; user: WechatUserDto }>('/wechat/oauth/callback', body),

  bind: (body: { openid: string; patientId?: string; phone?: string; idCard?: string; empiId?: string; name?: string }) =>
    api.post<{ bound: boolean; openid: string; patient?: { patientId: string; name: string; phone: string; empiId: string }; user: WechatUserDto }>('/wechat/bind', body),

  getSubscribeConfig: () =>
    api.get<WechatSubscribeConfigDto>('/wechat/subscribe/config'),

  getMenu: () => api.get<WechatMenuDto>('/wechat/menu'),

  saveMenu: (body: { buttons?: WechatMenuButtonDto[]; channel?: WechatChannel }) =>
    api.post<WechatMenuDto>('/wechat/menu', body),

  getUser: (openid: string) => api.get<WechatUserDto>(`/wechat/user/${encodeURIComponent(openid)}`),

  push: (body: { openid: string; title?: string; content: string; channel?: WechatChannel }) =>
    api.post<WechatSendLogDto>('/wechat/push', body),

  sendTemplate: (body: { openid: string; templateId: string; data?: Record<string, string | number>; url?: string }) =>
    api.post<WechatSendLogDto>('/wechat/template/send', body),

  listLogs: (filter?: { openid?: string; type?: WechatLogType; status?: WechatLogStatus }) => {
    const q = new URLSearchParams()
    if (filter?.openid) q.set('openid', filter.openid)
    if (filter?.type) q.set('type', filter.type)
    if (filter?.status) q.set('status', filter.status)
    const qs = q.toString()
    return api.get<{ items: WechatSendLogDto[]; total: number }>(`/wechat/logs${qs ? `?${qs}` : ''}`)
  },

  archiveLogs: (body?: { before?: string }) =>
    api.post<{ archived: number; total: number }>('/wechat/logs/archive', body ?? {}),
}

// ─────────────────────────────────────────────────────────────────────────────
// 支付
// ─────────────────────────────────────────────────────────────────────────────
export type PaymentMethod = 'WECHAT' | 'ALIPAY' | 'INSURANCE' | 'CASH' | 'MIXED'
export type PaymentItemType = 'REGISTRATION' | 'APPOINTMENT' | 'EXAM' | 'REPORT'
export type PaymentStatus = 'CREATED' | 'PAID' | 'REFUNDED' | 'PARTIAL_REFUND' | 'CLOSED' | 'FAILED'

export interface PaymentOrderDto {
  id: string
  orderNo: string
  patientId: string
  patientName: string
  itemType: PaymentItemType
  refId?: string
  subject: string
  amount: number
  currency: string
  method: PaymentMethod
  status: PaymentStatus
  paidAmount: number
  refundedAmount: number
  transactionId?: string
  paidAt?: string
  refundedAt?: string
  closedAt?: string
  failureReason?: string
  createdAt: string
  updatedAt: string
}

export interface PaymentRefundDto {
  id: string
  orderId: string
  orderNo: string
  amount: number
  reason: string
  operator?: string
  createdAt: string
}

export interface ReconciliationRowDto {
  orderNo: string
  patientId: string
  method: PaymentMethod
  amount: number
  paidAmount: number
  refundedAmount: number
  netAmount: number
  status: PaymentStatus
  settleDate: string
  reconciled: boolean
}

export interface PaymentStatsDto {
  totalOrders: number
  byStatus: Record<string, number>
  byMethod: Record<string, number>
  totalAmount: number
  paidAmount: number
  refundedAmount: number
  netAmount: number
  refundRate: number
}

export const paymentApi = {
  createOrder: (body: { patientId: string; patientName?: string; itemType?: PaymentItemType; refId?: string; amount?: number; method?: PaymentMethod; subject?: string }) =>
    api.post<PaymentOrderDto>('/payment/orders', body),

  createFromRegistration: (body: { visitId: string; patientId?: string; patientName?: string; amount?: number; method?: PaymentMethod }) =>
    api.post<PaymentOrderDto>('/payment/orders/from-registration', body),

  createFromAppointment: (body: { appointmentId: string; patientId?: string; patientName?: string; amount?: number; method?: PaymentMethod; modality?: string }) =>
    api.post<PaymentOrderDto>('/payment/orders/from-appointment', body),

  listOrders: (filter?: { status?: PaymentStatus; method?: PaymentMethod; patientId?: string; itemType?: PaymentItemType }) => {
    const q = new URLSearchParams()
    if (filter?.status) q.set('status', filter.status)
    if (filter?.method) q.set('method', filter.method)
    if (filter?.patientId) q.set('patientId', filter.patientId)
    if (filter?.itemType) q.set('itemType', filter.itemType)
    const qs = q.toString()
    return api.get<{ items: PaymentOrderDto[]; total: number; totalAmount: number }>(`/payment/orders${qs ? `?${qs}` : ''}`)
  },

  getOrder: (idOrNo: string) => api.get<PaymentOrderDto>(`/payment/orders/${encodeURIComponent(idOrNo)}`),

  pay: (idOrNo: string, body?: { method?: PaymentMethod; transactionId?: string }) =>
    api.post<PaymentOrderDto>(`/payment/orders/${encodeURIComponent(idOrNo)}/pay`, body ?? {}),

  refund: (idOrNo: string, body?: { amount?: number; reason?: string; operator?: string }) =>
    api.post<{ order: PaymentOrderDto; refund: PaymentRefundDto }>(`/payment/orders/${encodeURIComponent(idOrNo)}/refund`, body ?? {}),

  close: (idOrNo: string, body?: { reason?: string }) =>
    api.post<PaymentOrderDto>(`/payment/orders/${encodeURIComponent(idOrNo)}/close`, body ?? {}),

  notify: (body: { orderNo: string; method: PaymentMethod; result: 'SUCCESS' | 'FAIL'; transactionId?: string }) =>
    api.post<{ received: boolean; order: PaymentOrderDto }>('/payment/notify', body),

  listRefunds: (orderId?: string) =>
    api.get<{ items: PaymentRefundDto[]; total: number }>(`/payment/refunds${orderId ? `?orderId=${encodeURIComponent(orderId)}` : ''}`),

  reconciliation: (filter?: { date?: string; method?: PaymentMethod }) => {
    const q = new URLSearchParams()
    if (filter?.date) q.set('date', filter.date)
    if (filter?.method) q.set('method', filter.method)
    const qs = q.toString()
    return api.get<{ rows: ReconciliationRowDto[]; total: number; netAmount: number }>(`/payment/reconciliation${qs ? `?${qs}` : ''}`)
  },

  stats: () => api.get<PaymentStatsDto>('/payment/stats'),
}

// ─────────────────────────────────────────────────────────────────────────────
// 通知渠道
// ─────────────────────────────────────────────────────────────────────────────
export type NotificationChannel = 'SMS' | 'WECHAT_TEMPLATE' | 'VOICE'
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING'

export interface NotificationTemplateDto {
  id: string
  code: string
  name: string
  channel: NotificationChannel
  title: string
  content: string
  variables: string[]
  status: 'active' | 'inactive'
  createdAt: string
  updatedAt: string
}

export interface DeliveryLogDto {
  id: string
  templateId: string
  templateCode: string
  templateName: string
  channel: NotificationChannel
  recipient: string
  patientId?: string
  title: string
  content: string
  variables: Record<string, string | number>
  status: DeliveryStatus
  attempts: number
  maxAttempts: number
  lastError?: string
  createdAt: string
  sentAt?: string
}

export interface NotificationStatsDto {
  total: number
  byStatus: Record<string, number>
  byChannel: Record<string, number>
  templateCount: number
  successRate: number
}

export const notificationChannelApi = {
  listTemplates: (filter?: { channel?: NotificationChannel; status?: 'active' | 'inactive' }) => {
    const q = new URLSearchParams()
    if (filter?.channel) q.set('channel', filter.channel)
    if (filter?.status) q.set('status', filter.status)
    const qs = q.toString()
    return api.get<{ items: NotificationTemplateDto[]; total: number }>(`/notification-channel/templates${qs ? `?${qs}` : ''}`)
  },

  createTemplate: (body: { code: string; name: string; channel: NotificationChannel; title?: string; content: string; variables?: string[]; status?: 'active' | 'inactive' }) =>
    api.post<NotificationTemplateDto>('/notification-channel/templates', body),

  updateTemplate: (id: string, body: Partial<{ code: string; name: string; channel: NotificationChannel; title: string; content: string; variables: string[]; status: 'active' | 'inactive' }>) =>
    api.put<NotificationTemplateDto>(`/notification-channel/templates/${encodeURIComponent(id)}`, body),

  deleteTemplate: (id: string) =>
    api.delete<{ deleted: boolean; id: string }>(`/notification-channel/templates/${encodeURIComponent(id)}`),

  send: (body: { templateId?: string; templateCode?: string; channel?: NotificationChannel; recipient: string; variables?: Record<string, string | number>; patientId?: string }) =>
    api.post<DeliveryLogDto>('/notification-channel/send', body),

  listLogs: (filter?: { status?: DeliveryStatus; channel?: NotificationChannel; patientId?: string; templateCode?: string }) => {
    const q = new URLSearchParams()
    if (filter?.status) q.set('status', filter.status)
    if (filter?.channel) q.set('channel', filter.channel)
    if (filter?.patientId) q.set('patientId', filter.patientId)
    if (filter?.templateCode) q.set('templateCode', filter.templateCode)
    const qs = q.toString()
    return api.get<{ items: DeliveryLogDto[]; total: number }>(`/notification-channel/logs${qs ? `?${qs}` : ''}`)
  },

  retry: (id: string) => api.post<DeliveryLogDto>(`/notification-channel/logs/${encodeURIComponent(id)}/retry`),

  stats: () => api.get<NotificationStatsDto>('/notification-channel/stats'),

  notifyAppointmentReminder: (body: { patientId?: string; patientName: string; modality: string; scheduledAt: string; deviceName?: string; recipient: string; channel?: NotificationChannel }) =>
    api.post<DeliveryLogDto>('/notification-channel/notify/appointment-reminder', body),

  notifyReportReady: (body: { patientId?: string; patientName: string; examDate: string; modality: string; bodyPart?: string; recipient: string; channel?: NotificationChannel }) =>
    api.post<DeliveryLogDto>('/notification-channel/notify/report-ready', body),

  notifyCriticalAlert: (body: { patientId: string; patientName: string; modality: string; criticalValue: string; recipient: string }) =>
    api.post<{ voice: DeliveryLogDto; sms: DeliveryLogDto }>('/notification-channel/notify/critical-alert', body),
}

// ─────────────────────────────────────────────────────────────────────────────
// 满意度分析
// ─────────────────────────────────────────────────────────────────────────────
export type Sentiment = 'positive' | 'neutral' | 'negative'
export type SurveyStatus = 'OPEN' | 'CLOSED'

export interface SurveyQuestionDto {
  id: string
  text: string
  type: 'rating' | 'nps' | 'text'
  max?: number
}

export interface SurveyDto {
  id: string
  title: string
  type: string
  department: string
  modality?: string
  questions: SurveyQuestionDto[]
  status: SurveyStatus
  createdAt: string
  updatedAt: string
}

export interface SurveyResponseDto {
  id: string
  surveyId: string
  patientId?: string
  patientName?: string
  department: string
  modality?: string
  answers: Array<{ questionId: string; value: string | number }>
  rating: number
  npsScore: number
  comment: string
  sentiment: Sentiment
  tags: string[]
  submittedAt: string
}

export interface SatisfactionAnalyticsDto {
  overall: {
    totalResponses: number
    avgRating: number
    avgNpsScore: number
    nps: number
    promoters: number
    passives: number
    detractors: number
    sentiment: Record<Sentiment, number>
    responseRate: number
  }
  byDepartment: Array<{ department: string; responses: number; avgRating: number; nps: number }>
  byModality: Array<{ modality: string; responses: number; avgRating: number; nps: number }>
  trend: Array<{ period: string; responses: number; avgRating: number; nps: number }>
  comments: Array<{ responseId: string; department: string; modality?: string; comment: string; sentiment: Sentiment; tags: string[]; submittedAt: string }>
}

export const satisfactionApi = {
  listSurveys: (filter?: { department?: string; status?: SurveyStatus; type?: string }) => {
    const q = new URLSearchParams()
    if (filter?.department) q.set('department', filter.department)
    if (filter?.status) q.set('status', filter.status)
    if (filter?.type) q.set('type', filter.type)
    const qs = q.toString()
    return api.get<{ items: SurveyDto[]; total: number }>(`/satisfaction/surveys${qs ? `?${qs}` : ''}`)
  },

  createSurvey: (body: { title: string; type?: string; department?: string; modality?: string; questions?: SurveyQuestionDto[]; status?: SurveyStatus }) =>
    api.post<SurveyDto>('/satisfaction/surveys', body),

  getSurvey: (id: string) => api.get<SurveyDto>(`/satisfaction/surveys/${encodeURIComponent(id)}`),

  respond: (id: string, body: { patientId?: string; patientName?: string; answers?: Array<{ questionId: string; value: string | number }>; rating?: number; npsScore?: number; comment?: string }) =>
    api.post<SurveyResponseDto>(`/satisfaction/surveys/${encodeURIComponent(id)}/respond`, body),

  listResponses: (filter?: { surveyId?: string; department?: string; sentiment?: Sentiment }) => {
    const q = new URLSearchParams()
    if (filter?.surveyId) q.set('surveyId', filter.surveyId)
    if (filter?.department) q.set('department', filter.department)
    if (filter?.sentiment) q.set('sentiment', filter.sentiment)
    const qs = q.toString()
    return api.get<{ items: SurveyResponseDto[]; total: number }>(`/satisfaction/responses${qs ? `?${qs}` : ''}`)
  },

  analytics: (filter?: { department?: string; modality?: string }) => {
    const q = new URLSearchParams()
    if (filter?.department) q.set('department', filter.department)
    if (filter?.modality) q.set('modality', filter.modality)
    const qs = q.toString()
    return api.get<SatisfactionAnalyticsDto>(`/satisfaction/analytics${qs ? `?${qs}` : ''}`)
  },
}

// ─────────────────────────────────────────────────────────────────────────────
// 自助登记
// ─────────────────────────────────────────────────────────────────────────────
export interface SelfPatientDto {
  patientId: string
  name: string
  gender: string
  birthDate: string
  age: number
  idCard: string
  phone: string
  empiId: string
  insuranceNo?: string
}

export interface SelfIdentifyResultDto {
  query: { idCard?: string; phone?: string; empiId?: string; name?: string }
  matched: SelfPatientDto | null
  candidates: SelfPatientDto[]
  needQuestionnaire: boolean
  prepRequired: boolean
  source: 'db' | 'seed'
  identifiedAt: string
}

export interface SelfCheckInResultDto {
  id: string
  patientId: string
  patientName: string
  visitId: string
  appointmentId?: string
  status: 'CHECKED_IN' | 'ALREADY_CHECKED_IN' | 'BLOCKED'
  blockers: string[]
  booth: string
  checkedInAt: string
}

export interface SelfQuestionnaireDto {
  patientId: string
  answers: Record<string, string | number | boolean>
  allergyFlag: boolean
  pregnancyFlag: boolean
  fastingConfirmed: boolean
  implantFlag: boolean
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH'
  riskNotes: string[]
  prepItems: Array<{ key: string; label: string; required: boolean }>
  submittedAt: string
}

export interface SelfConsentDto {
  id: string
  patientId: string
  visitId: string
  consentType: string
  procedure: string
  agreed: boolean
  status: 'signed' | 'refused'
  signedBy?: string
  witnessName?: string
  signedAt: string
  signatureHash: string
}

export interface SelfQueueNumberDto {
  ticket: string
  patientId: string
  patientName: string
  visitId: string
  modality: string
  priority: 'NORMAL' | 'URGENT' | 'EMERGENCY'
  position: number
  estimatedWaitMinutes: number
  room: string
  issuedAt: string
}

export interface SelfStatusDto {
  patientId: string
  checkedIn: boolean
  checkIn: SelfCheckInResultDto | null
  questionnaireDone: boolean
  consentSigned: boolean
  queue: SelfQueueNumberDto | null
}

export const selfRegistrationApi = {
  identify: (body: { idCard?: string; phone?: string; empiId?: string; name?: string }) =>
    api.post<SelfIdentifyResultDto>('/self-registration/identify', body),

  checkIn: (body: { patientId: string; visitId?: string; appointmentId?: string }) =>
    api.post<SelfCheckInResultDto>('/self-registration/check-in', body),

  submitQuestionnaire: (body: { patientId: string; allergies?: string[]; pregnant?: boolean; fastingConfirmed?: boolean; implants?: string[]; contrastHistory?: boolean; claustrophobia?: boolean; answers?: Record<string, string | number | boolean> }) =>
    api.post<SelfQuestionnaireDto>('/self-registration/questionnaire', body),

  getQuestionnaire: (patientId: string) =>
    api.get<SelfQuestionnaireDto | null>(`/self-registration/questionnaire/${encodeURIComponent(patientId)}`),

  signConsent: (body: { patientId: string; visitId?: string; consentType?: string; procedure?: string; agreed?: boolean; signedBy?: string; witnessName?: string; signature?: string }) =>
    api.post<SelfConsentDto>('/self-registration/consent', body),

  listConsents: (patientId: string) =>
    api.get<{ items: SelfConsentDto[]; total: number }>(`/self-registration/consent/${encodeURIComponent(patientId)}`),

  issueQueueNumber: (body: { patientId: string; visitId?: string; modality?: string; priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY' }) =>
    api.post<SelfQueueNumberDto>('/self-registration/queue-number', body),

  listQueue: (modality: string) =>
    api.get<{ items: SelfQueueNumberDto[]; total: number }>(`/self-registration/queue/${encodeURIComponent(modality)}`),

  status: (patientId: string) =>
    api.get<SelfStatusDto>(`/self-registration/status/${encodeURIComponent(patientId)}`),
}

export type { ApiResponse }
