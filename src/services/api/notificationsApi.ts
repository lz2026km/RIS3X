import { api } from './client'

// Notifications API
// Backend: /notifications/*
//   GET    /unread/:userId, /history/:userId, /stats/:userId, /vapid-public-key
//   POST   /read/:id, /read-all/:userId, /, /broadcast, /push-subscribe, /push-unsubscribe, /push-send
//   DELETE /:id

export type NotificationType = 'CRITICAL' | 'REPORT' | 'TASK' | 'SYSTEM' | 'APPOINTMENT'
export type NotificationSeverity = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL'

export interface NotificationDto {
  id: string
  userId: string
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  content: string
  link?: string
  read: boolean
  readAt?: string
  targetId?: string
  createdAt: string
}

export interface NotificationStatsDto {
  userId: string
  total: number
  unread: number
  today: number
  critical: number
}

export interface PushSubscriptionDto {
  userId: string
  endpoint: string
  keys: { p256dh: string; auth: string }
  topics?: string[]
}

export interface CreateNotificationData {
  userId: string
  type: NotificationType
  severity?: NotificationSeverity
  title: string
  content: string
  link?: string
  targetId?: string
}

export const notificationsApi = {
  getUnread: (userId: string) =>
    api.get<{ userId: string; unread: number }>(`/notifications/unread/${userId}`),

  getHistory: (userId: string, limit?: number) =>
    api.get<NotificationDto[]>(`/notifications/history/${userId}${limit ? `?limit=${limit}` : ''}`),

  getStats: (userId: string) =>
    api.get<NotificationStatsDto>(`/notifications/stats/${userId}`),

  markRead: (id: string) =>
    api.post<NotificationDto>(`/notifications/read/${id}`),

  markAllRead: (userId: string) =>
    api.post<{ userId: string; count: number }>(`/notifications/read-all/${userId}`),

  delete: (id: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/notifications/${id}`),

  create: (data: CreateNotificationData) =>
    api.post<NotificationDto>('/notifications', data),

  broadcast: (data: { userIds: string[] } & Omit<CreateNotificationData, 'userId'>) =>
    api.post<{ count: number; items: NotificationDto[] }>('/notifications/broadcast', data),

  pushSubscribe: (dto: PushSubscriptionDto) =>
    api.post<{ success: boolean; userId: string; endpoint: string; total: number }>('/notifications/push-subscribe', dto),

  pushUnsubscribe: (endpoint: string) =>
    api.post<{ success: boolean; userId?: string; endpoint: string; total?: number; reason?: string }>('/notifications/push-unsubscribe', { endpoint }),

  getVapidPublicKey: () =>
    api.get<{ publicKey: string | null }>('/notifications/vapid-public-key'),

  sendPush: (data: { userId: string; title: string; content: string; url?: string; tag?: string; requireInteraction?: boolean }) =>
    api.post<{ success: boolean; userId: string; delivered: number; total?: number; reason?: string }>('/notifications/push-send', data),

  // [v3.0.6.11-99] Wave 5B-C: 报表生成完成推送 (内部端点, 定时报表执行器/报表模块调用)
  reportGenerated: (data: { reportId: string; reportName: string; recipients: string[]; summary?: string; link?: string }) =>
    api.post<{ count: number; items: NotificationDto[] }>('/notifications/report-generated', data),

  // [v3.0.6.11-99 Wave7B] 站内信/推送订阅管理:
  //   GET /notifications/subscriptions/:userId · PUT /notifications/subscriptions/:userId
  getSubscriptions: (userId: string) =>
    api.get<{ userId: string; types: NotificationSubscriptionType[]; defaulted?: boolean }>(`/notifications/subscriptions/${userId}`),

  updateSubscriptions: (userId: string, types: NotificationSubscriptionType[]) =>
    api.put<{ userId: string; types: NotificationSubscriptionType[] }>(`/notifications/subscriptions/${userId}`, { types }),
}

export type NotificationSubscriptionType = 'CRITICAL' | 'REPORT' | 'FOLLOWUP' | 'QUALITY' | 'SYSTEM'
