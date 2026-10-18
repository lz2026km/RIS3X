// [v3.0.6.8-47] PR3: 通知 + 模板 + 词典综合管理
// [W1-C 去重] 本模块原自带一套 /notifications、/templates、/dictionary 请求实现,
//   与 notificationsApi / templatesApi / dictionaryApi 完全重复。现改为薄适配层:
//   方法名与返回形状保持不变 (供 NotificationTemplateDictPage 使用), 请求全部委托
//   到上述三个权威模块, 避免双实现漂移。
import { notificationsApi } from "./notificationsApi";
import { templatesApi } from "./templatesApi";
import { dictionaryApi as canonicalDictionaryApi } from "./dictionaryApi";
import type { DictEntryDto, DictEntryInput } from "./dictionaryApi";

// ============= 通知 =============
export interface NotificationDto {
  id: string;
  title: string;
  content: string;
  type: "REPORT" | "CRITICAL" | "SYSTEM" | "APPOINTMENT" | "TASK";
  severity?: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  isRead: boolean;
  createdAt: string;
  userId: string;
  link?: string;
  targetId?: string;
}

export interface CreateNotificationData {
  userId: string;
  type: "CRITICAL" | "REPORT" | "TASK" | "SYSTEM" | "APPOINTMENT";
  severity?: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  title: string;
  content: string;
  link?: string;
  targetId?: string;
}

export interface BroadcastNotificationData {
  userIds: string[];
  type: "CRITICAL" | "REPORT" | "TASK" | "SYSTEM" | "APPOINTMENT";
  severity?: "INFO" | "WARN" | "ERROR" | "CRITICAL";
  title: string;
  content: string;
  link?: string;
  targetId?: string;
}

export const notificationApi = {
  list: async () => {
    const res = await notificationsApi.list();
    return { ...res, data: res.data as unknown as NotificationDto[] };
  },

  unread: (userId = "current") => notificationsApi.getUnread(userId),

  markAllRead: (userId = "current") => notificationsApi.markAllRead(userId),

  getUnreadCount: (userId: string) => notificationsApi.getUnread(userId),

  getHistory: (userId: string, limit?: number) =>
    notificationsApi.getHistory(userId, limit),

  markRead: (id: string) => notificationsApi.markRead(id),

  create: (data: CreateNotificationData) => notificationsApi.create(data),

  broadcast: (data: BroadcastNotificationData) =>
    notificationsApi.broadcast(data),

  pushSubscribe: (data: {
    userId: string;
    endpoint: string;
    keys: { p256dh: string; auth: string };
  }) => notificationsApi.pushSubscribe(data),
};

// ============= 模板 =============
export interface ReportTemplateDto {
  id: string;
  templateId?: string;
  name: string;
  modality: string;
  bodyPart?: string;
  category: "CT" | "MR" | "DR" | "US" | "MG" | "通用";
  sections: Array<{
    title: string;
    type: "text" | "select" | "measure";
    required: boolean;
    options?: string[];
  }>;
  description?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
}

type TemplateCreateInput = Parameters<typeof templatesApi.create>[0];
type TemplateUpdateInput = Parameters<typeof templatesApi.update>[1];

export const templateApi = {
  list: (params?: {
    modality?: string;
    category?: string;
    pageSize?: number;
  }) =>
    templatesApi.list(
      params?.category ? { category: params.category } : undefined,
    ),

  getById: (id: string) => templatesApi.getById(id),

  create: (data: Partial<ReportTemplateDto>) =>
    templatesApi.create(data as unknown as TemplateCreateInput),

  update: (id: string, data: Partial<ReportTemplateDto>) =>
    templatesApi.update(id, data as unknown as TemplateUpdateInput),

  delete: (id: string) => templatesApi.delete(id),
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

function mapEntry(e: DictEntryDto): DictionaryItemDto {
  const extra = (e.extra ?? {}) as Record<string, unknown>;
  return {
    id: e.id,
    category: e.category,
    code: e.key,
    name: e.value,
    enName: typeof extra.enName === "string" ? extra.enName : undefined,
    description:
      typeof extra.description === "string" ? extra.description : undefined,
    sortOrder: e.sort,
    isActive: e.active,
    createdAt: e.createdAt ?? "",
  };
}

function toEntryInput(data: Partial<DictionaryItemDto>): DictEntryInput {
  const extra: Record<string, unknown> = {};
  if (data.enName !== undefined) extra.enName = data.enName;
  if (data.description !== undefined) extra.description = data.description;
  return {
    key: data.code ?? "",
    value: data.name ?? "",
    sort: data.sortOrder,
    active: data.isActive,
    extra,
  };
}

export const dictionaryApi = {
  // 无 category 时聚合全部分类条目 (权威 dictionaryApi.listCategories + listEntries)
  list: async (params?: {
    category?: string;
    keyword?: string;
    pageSize?: number;
  }) => {
    if (params?.category) {
      const res = await canonicalDictionaryApi.listEntries(params.category);
      const items = (res.data ?? []).map(mapEntry);
      return { success: res.success, data: items, error: res.error };
    }
    const catsRes = await canonicalDictionaryApi.listCategories();
    const categories = catsRes.data?.categories ?? [];
    const lists = await Promise.all(
      categories.map((c) => canonicalDictionaryApi.listEntries(c.category)),
    );
    const items = lists.flatMap((r) => (r.data ?? []).map(mapEntry));
    const keyword = params?.keyword;
    const data = keyword
      ? items.filter(
          (d) => d.name.includes(keyword) || d.code.includes(keyword),
        )
      : items;
    return { success: true, data };
  },

  create: (data: Partial<DictionaryItemDto>) =>
    canonicalDictionaryApi.createEntry(data.category ?? "", toEntryInput(data)),

  update: (_id: string, data: Partial<DictionaryItemDto>) =>
    canonicalDictionaryApi.updateEntry(
      data.category ?? "",
      data.code ?? "",
      toEntryInput(data),
    ),

  delete: (_id: string, data?: Partial<DictionaryItemDto>) =>
    canonicalDictionaryApi.deleteEntry(data?.category ?? "", data?.code ?? ""),
};
