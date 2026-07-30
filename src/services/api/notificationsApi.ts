import { api } from './client'

export interface NotificationDto {
  id: string; userId: string; title: string; body: string; type: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  category: string; read: boolean; createdAt: string; readAt?: string; actionLink?: string; senderId?: string
}
export interface NotificationQueryParams { page?: number; pageSize?: number; type?: string; read?: boolean; category?: string }
export interface NotificationStatsDto { total: number; unread: number; critical: number; byCategory: Record<string, number> }
export interface PushSubscriptionDto { endpoint: string; keys: { p256dh: string; auth: string }; deviceType: string }

export const notificationsApi = {
  list: (params?: NotificationQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<{ items: NotificationDto[]; total: number }>(`/notifications?${sp.toString()}`)
  },
  markRead: (id: string) => api.patch(`/notifications/${id}`, { read: true }),
  markAllRead: () => api.post('/notifications/mark-all-read', {}),
  delete: (id: string) => api.delete(`/notifications/${id}`),
  getStats: () => api.get<NotificationStatsDto>('/notifications/stats'),
  subscribe: (dto: PushSubscriptionDto) => api.post('/notifications/subscribe', dto),
  unsubscribe: (endpoint: string) => api.delete(`/notifications/subscribe?endpoint=${encodeURIComponent(endpoint)}`),
  send: (data: { title: string; body: string; type?: string; userIds?: string[] }) => api.post('/notifications/send', data),
  broadcast: (data: { title: string; body: string; type?: string }) => api.post('/notifications/broadcast', data),
}
