// [v3.0.6.8-47] PR3: 通知 + 模板 + 词典综合管理
import { api } from './client';

// ============= 通知 =============
export interface NotificationDto {
  id: string;
  title: string;
  content: string;
  type: 'REPORT' | 'CRITICAL' | 'SYSTEM' | 'APPOINTMENT' | 'TASK';
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  isRead: boolean;
  createdAt: string;
  userId: string;
  link?: string;
  targetId?: string;
}

export interface CreateNotificationData {
  userId: string;
  type: 'CRITICAL' | 'REPORT' | 'TASK' | 'SYSTEM' | 'APPOINTMENT';
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  title: string;
  content: string;
  link?: string;
  targetId?: string;
}

export interface BroadcastNotificationData {
  userIds: string[];
  type: 'CRITICAL' | 'REPORT' | 'TASK' | 'SYSTEM' | 'APPOINTMENT';
  severity?: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';
  title: string;
  content: string;
  link?: string;
  targetId?: string;
}

export const notificationApi = {
  getUnreadCount: (userId: string) =>
    api.get<{ unread: number }>(`/notifications/unread/${userId}`),

  getHistory: (userId: string, limit?: number) =>
    api.get<NotificationDto[]>(`/notifications/history/${userId}${limit ? `?limit=${limit}` : ''}`),

  markRead: (id: string) =>
    api.post<{ id: string; isRead: boolean; readAt: string }>(`/notifications/read/${id}`),

  create: (data: CreateNotificationData) =>
    api.post<NotificationDto>('/notifications', data),

  broadcast: (data: BroadcastNotificationData) =>
    api.post<{ broadcasted: number }>('/notifications/broadcast', data),

  pushSubscribe: (data: { userId: string; endpoint: string; keys: { p256dh: string; auth: string } }) =>
    api.post<{ subscribed: boolean }>('/notifications/push-subscribe', data),
};

// ============= 模板 =============
export interface ReportTemplateDto {
  id: string;
  templateId?: string;
  name: string;
  modality: string;
  bodyPart?: string;
  category: 'CT' | 'MR' | 'DR' | 'US' | 'MG' | '通用';
  sections: Array<{ title: string; type: 'text' | 'select' | 'measure'; required: boolean; options?: string[] }>;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

export const templateApi = {
  list: (params?: { modality?: string; category?: string; pageSize?: number }) =>
    api.get<ReportTemplateDto[]>(`/templates?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getById: (id: string) =>
    api.get<ReportTemplateDto>(`/templates/${id}`),

  create: (data: Partial<ReportTemplateDto>) =>
    api.post<ReportTemplateDto>('/templates', data),

  update: (id: string, data: Partial<ReportTemplateDto>) =>
    api.put<ReportTemplateDto>(`/templates/${id}`, data),

  delete: (id: string) =>
    api.delete(`/templates/${id}`),
};

// ============= 词典 =============
export interface DictionaryItemDto {
  id: string;
  category: string;
  code: string;
  name: string;
  enName?: string;
  description?: string;
  parentId?: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
}

export const dictionaryApi = {
  list: (params?: { category?: string; keyword?: string; pageSize?: number }) =>
    api.get<DictionaryItemDto[]>(`/dictionary?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  create: (data: Partial<DictionaryItemDto>) =>
    api.post<DictionaryItemDto>('/dictionary', data),

  update: (id: string, data: Partial<DictionaryItemDto>) =>
    api.put<DictionaryItemDto>(`/dictionary/${id}`, data),

  delete: (id: string) =>
    api.delete(`/dictionary/${id}`),
};
