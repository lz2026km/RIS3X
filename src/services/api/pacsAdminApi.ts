import { api, invalidateApiCache } from './client'

// PACS Admin (PACS 管理) API
// [G005 Wave1B P1] 后端已实现 pacs-admin.controller 全部端点
// (servers/storage-groups/associations/stats = Wave1B 新增; nodes/storage/logs/configs/routes = Wave1A),
// 数据源 Device/Exam/AuditLog 派生 + seed 回退 + 内存 CRUD。MSW 标注已更新。
// [G005 v3.0.6.11-91 W1-B P1 第12轮] 4 方法核对:
//   · getServer           → 保留 (后端真实 GET /pacs-admin/servers/:id; PacsAdminPage 无详情视图, 行数据已足)
//   · updateServer        → 已接入 (PacsAdminPage AE 服务器 Tab 编辑按钮, 复用添加 Modal)
//   · deleteStorageGroup  → 已接入 (PacsAdminPage 存储空间 Tab 删除按钮)
//   · listStorage         → 废弃保留 (Wave1A 旧端点, 已被 listStorageGroups 取代, 页面用后者)

export interface PacsServer {
  id: string
  name: string
  hostname: string
  port: number
  aeTitle: string
  status: 'online' | 'offline' | 'error'
  lastHeartbeat: string
  storageBytes: number
  studyCount: number
  seriesCount: number
}

export interface PacsStorageGroup {
  id: string
  name: string
  path: string
  totalBytes: number
  usedBytes: number
  studyCount: number
  status: 'active' | 'readonly' | 'offline'
}

export interface PacsAssociation {
  id: string
  localAe: string
  remoteAe: string
  remoteHost: string
  remotePort: number
  status: 'connected' | 'disconnected' | 'failed'
  lastActivity: string
  requestCount: number
  errorCount: number
}

export interface PacsQueryParams {
  status?: string
  page?: number
  pageSize?: number
}

export interface PacsAdminStats {
  totalServers: number
  onlineServers: number
  totalStorageBytes: number
  usedStorageBytes: number
  totalStudies: number
  totalAssociations: number
  activeAssociations: number
  dailyTransferBytes: number
}

// ===== [Wave1A] nodes / storage / worklist / archives / logs / configs / routes =====

export interface PacsNode {
  id: string
  name: string
  aeTitle: string
  hostname: string
  port: number
  status: 'online' | 'offline' | 'error'
  lastHeartbeat: string
  modality: string
  location: string
  studyCount: number
}

export interface PacsWorklistEntry {
  id: string
  accessionNumber: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
  state: string
  scheduledAt?: string
}

export interface PacsArchive {
  id: string
  studyId: string
  patientName: string
  modality: string
  archivedAt: string
  sizeBytes: number
  status: 'archived' | 'restoring' | 'restored'
}

export interface PacsLogEntry {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR'
  source: string
  message: string
}

export interface PacsConfig {
  key: string
  value: string
  description: string
  category: string
}

export interface PacsRoute {
  id: string
  name: string
  sourceAe: string
  targetAe: string
  targetHost: string
  targetPort: number
  protocol: string
  enabled: boolean
}

export const pacsAdminApi = {
  // [Wave1B] 真实端点 (pacs-admin.controller)
  listServers: (params?: PacsQueryParams) =>
    api.get<PacsServer[]>(`/pacs-admin/servers?${new URLSearchParams(params ?? {}).toString()}`),

  // [Wave1B] 真实端点 (pacs-admin.controller); 页面无详情视图, 行数据已足够 — 保留备用
  getServer: (id: string) =>
    api.get<PacsServer>(`/pacs-admin/servers/${id}`),

  // [Wave1B] 真实端点 (pacs-admin.controller)
  addServer: async (data: Omit<PacsServer, 'id' | 'status' | 'lastHeartbeat' | 'storageBytes' | 'studyCount' | 'seriesCount'>) => {
    const res = await api.post<PacsServer>('/pacs-admin/servers', data)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  // [Wave1B] 真实端点 (pacs-admin.controller)
  updateServer: async (id: string, data: Partial<PacsServer>) => {
    const res = await api.put<PacsServer>(`/pacs-admin/servers/${id}`, data)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  // [Wave1B] 真实端点 (pacs-admin.controller)
  deleteServer: async (id: string) => {
    const res = await api.delete(`/pacs-admin/servers/${id}`)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  // [Wave1B] 真实端点 (pacs-admin.controller)
  testConnection: (id: string) =>
    api.post<{ success: boolean; latencyMs: number }>(`/pacs-admin/servers/${id}/test`, {}),

  // [Wave1B] 真实端点 (pacs-admin.controller)
  listStorageGroups: () =>
    api.get<PacsStorageGroup[]>('/pacs-admin/storage-groups'),

  // [Wave1B] 真实端点 (pacs-admin.controller)
  createStorageGroup: async (data: Omit<PacsStorageGroup, 'id' | 'usedBytes' | 'studyCount' | 'status'>) => {
    const res = await api.post<PacsStorageGroup>('/pacs-admin/storage-groups', data)
    await invalidateApiCache('/pacs-admin/storage-groups')
    return res
  },

  // [Wave1B] 真实端点 (pacs-admin.controller)
  deleteStorageGroup: async (id: string) => {
    const res = await api.delete(`/pacs-admin/storage-groups/${id}`)
    await invalidateApiCache('/pacs-admin/storage-groups')
    return res
  },

  // [Wave1B] 真实端点 (pacs-admin.controller)
  listAssociations: (params?: PacsQueryParams) =>
    api.get<PacsAssociation[]>(`/pacs-admin/associations?${new URLSearchParams(params ?? {}).toString()}`),

  // [Wave1B] 真实端点 (pacs-admin.controller)
  getStats: () =>
    api.get<PacsAdminStats>('/pacs-admin/stats'),

  // ===== [Wave1A] 11 端点 (pacs-admin.controller) =====

  // GET /pacs-admin/nodes — DICOM 节点列表 (Device 表派生)
  listNodes: () =>
    api.get<PacsNode[]>('/pacs-admin/nodes'),

  // POST /pacs-admin/nodes/:id/test — 节点连通性测试
  testNode: (id: string) =>
    api.post<{ success: boolean; latencyMs: number; serverId: string }>(`/pacs-admin/nodes/${id}/test`, {}),

  // POST /pacs-admin/nodes/:id/sync — 节点数据同步
  syncNode: (id: string) =>
    api.post<{ ok: boolean; syncedStudies: number; durationMs: number }>(`/pacs-admin/nodes/${id}/sync`, {}),

  // GET /pacs-admin/storage — 废弃保留 (Wave1A 旧端点, 已被 listStorageGroups 取代)
  listStorage: () =>
    api.get<PacsStorageGroup[]>('/pacs-admin/storage'),

  // POST /pacs-admin/storage/cleanup — 存储空间清理
  cleanupStorage: async () => {
    const res = await api.post<{ ok: boolean; freedBytes: number; deletedCount: number; durationMs: number }>('/pacs-admin/storage/cleanup', {})
    await invalidateApiCache('/pacs-admin/storage')
    return res
  },

  // GET /pacs-admin/worklist-entries — Worklist 条目 (Exam 表派生)
  listWorklistEntries: () =>
    api.get<PacsWorklistEntry[]>('/pacs-admin/worklist-entries'),

  // GET /pacs-admin/archives — 归档记录
  listArchives: () =>
    api.get<PacsArchive[]>('/pacs-admin/archives'),

  // GET /pacs-admin/logs — PACS 操作日志 (AuditLog 派生)
  listLogs: (limit = 50) =>
    api.get<PacsLogEntry[]>(`/pacs-admin/logs?limit=${limit}`),

  // GET /pacs-admin/configs — 配置项
  listConfigs: () =>
    api.get<PacsConfig[]>('/pacs-admin/configs'),

  // POST /pacs-admin/configs/:key — 更新配置项
  updateConfig: async (key: string, data: { value: string; description?: string }) => {
    const res = await api.post<PacsConfig>(`/pacs-admin/configs/${key}`, data)
    await invalidateApiCache('/pacs-admin/configs')
    return res
  },

  // GET /pacs-admin/routes — 转发路由列表
  listRoutes: () =>
    api.get<PacsRoute[]>('/pacs-admin/routes'),
}
