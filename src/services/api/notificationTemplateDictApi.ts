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
  list: () =>
    api.get<NotificationDto[]>('/notifications'),

  unread: (userId = 'current') =>
    api.get<{ unread: number }>(`/notifications/unread/${userId}`),

  markAllRead: (userId = 'current') =>
    api.post<{ userId: string; count: number }>(`/notifications/read-all/${userId}`),

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

  // [v3.0.6.11-104 Wave 1A] 后端 templates.controller 为 @Patch(':id')，原 PUT 会 405/404，已改 PATCH
  update: (id: string, data: Partial<ReportTemplateDto>) =>
    api.patch<ReportTemplateDto>(`/templates/${id}`, data),

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

// [v3.0.6.11-104 Wave 1A] 词典路径对齐后端分类域:
//   backend/src/modules/dictionary/dictionary.controller.ts:
//     GET  /dictionary                  -> 分类列表 { categories, total }
//     GET  /dictionary/categories       -> 分类列表别名
//     GET  /dictionary/:category        -> 分类条目列表
//     POST /dictionary/:category        -> 新增条目 (body: key/value/sort/active/extra)
//     PUT  /dictionary/:category/:key   -> 更新条目
//     DELETE /dictionary/:category/:key -> 删除条目
//   原扁平协议 POST /dictionary、PUT|DELETE /dictionary/:id 后端不存在 (404), 已废弃。
//   字段映射: 后端 key/value/sort/active/extra ↔ 前端 code/name/sortOrder/isActive/enName/description。
interface RawDictEntry {
  category?: string;
  key?: string;
  value?: string;
  sort?: number;
  active?: boolean;
  extra?: Record<string, unknown>;
  createdAt?: string;
}

function fromDictEntry(e: RawDictEntry, fallbackCategory: string): DictionaryItemDto {
  const extra = (e.extra ?? {}) as Record<string, unknown>;
  return {
    id: `${e.category ?? fallbackCategory}:${e.key ?? ''}`,
    category: e.category ?? fallbackCategory,
    code: e.key ?? '',
    name: e.value ?? '',
    enName: typeof extra.enName === 'string' ? extra.enName : undefined,
    description: typeof extra.description === 'string' ? extra.description : undefined,
    sortOrder: e.sort ?? 0,
    isActive: e.active !== false,
    createdAt: e.createdAt ?? '',
  };
}

function toDictEntry(data: Partial<DictionaryItemDto>) {
  const extra: Record<string, unknown> = {};
  if (data.enName !== undefined) extra.enName = data.enName;
  if (data.description !== undefined) extra.description = data.description;
  return {
    key: data.code,
    value: data.name,
    sort: data.sortOrder,
    active: data.isActive,
    extra,
  };
}

export const dictionaryApi = {
  // 无 category 时聚合全部分类条目 (后端 GET /dictionary 仅返回分类列表)
  list: async (params?: { category?: string; keyword?: string; pageSize?: number }) => {
    if (params?.category) {
      const res = await api.get<RawDictEntry[]>(`/dictionary/${encodeURIComponent(params.category)}`);
      const items = (Array.isArray(res.data) ? res.data : []).map((e) => fromDictEntry(e, params.category as string));
      return { success: res.success, data: items, error: res.error };
    }
    const catsRes = await api.get<{ categories: Array<{ category: string }> }>('/dictionary/categories');
    const categories = catsRes.data?.categories ?? [];
    const lists = await Promise.all(
      categories.map((c) => api.get<RawDictEntry[]>(`/dictionary/${encodeURIComponent(c.category)}`)),
    );
    const items = lists.flatMap((r, i) =>
      (Array.isArray(r.data) ? r.data : []).map((e) => fromDictEntry(e, categories[i]?.category ?? '')),
    );
    const keyword = params?.keyword;
    const data = keyword ? items.filter((d) => d.name.includes(keyword) || d.code.includes(keyword)) : items;
    return { success: true, data };
  },

  create: (data: Partial<DictionaryItemDto>) =>
    api.post<RawDictEntry>(`/dictionary/${encodeURIComponent(data.category ?? '')}`, toDictEntry(data)),

  update: (_id: string, data: Partial<DictionaryItemDto>) =>
    api.put<RawDictEntry>(
      `/dictionary/${encodeURIComponent(data.category ?? '')}/${encodeURIComponent(data.code ?? '')}`,
      toDictEntry(data),
    ),

  delete: (_id: string, data?: Partial<DictionaryItemDto>) =>
    api.delete(
      `/dictionary/${encodeURIComponent(data?.category ?? '')}/${encodeURIComponent(data?.code ?? '')}`,
    ),
};
