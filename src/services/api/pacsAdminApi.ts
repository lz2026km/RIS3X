import { api, invalidateApiCache } from './client'

// PACS Admin (PACS 管理) API
// [G005 Wave1B P1] 后端已实现 pacs-admin.controller 全部端点
// (servers/storage-groups/associations/stats = Wave1B 新增; nodes/storage/logs/configs/routes = Wave1A),
// 数据源 Device/Exam/AuditLog 派生 + seed 回退 + 内存 CRUD。MSW 标注已更新。

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

export const pacsAdminApi = {
  // [Wave1B] 真实端点 (pacs-admin.controller)
  listServers: (params?: PacsQueryParams) =>
    api.get<PacsServer[]>(`/pacs-admin/servers?${new URLSearchParams(params ?? {}).toString()}`),

  // [Wave1B] 真实端点 (pacs-admin.controller)
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
}
