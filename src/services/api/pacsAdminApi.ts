import { api, invalidateApiCache } from './client'

// PACS Admin (PACS 管理) API
// Backend: /pacs-admin/*

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
  listServers: (params?: PacsQueryParams) =>
    api.get<PacsServer[]>(`/pacs-admin/servers?${new URLSearchParams(params ?? {}).toString()}`),

  getServer: (id: string) =>
    api.get<PacsServer>(`/pacs-admin/servers/${id}`),

  addServer: async (data: Omit<PacsServer, 'id' | 'status' | 'lastHeartbeat' | 'storageBytes' | 'studyCount' | 'seriesCount'>) => {
    const res = await api.post<PacsServer>('/pacs-admin/servers', data)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  updateServer: async (id: string, data: Partial<PacsServer>) => {
    const res = await api.put<PacsServer>(`/pacs-admin/servers/${id}`, data)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  deleteServer: async (id: string) => {
    const res = await api.delete(`/pacs-admin/servers/${id}`)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  testConnection: (id: string) =>
    api.post<{ success: boolean; latencyMs: number }>(`/pacs-admin/servers/${id}/test`, {}),

  listStorageGroups: () =>
    api.get<PacsStorageGroup[]>('/pacs-admin/storage-groups'),

  createStorageGroup: async (data: Omit<PacsStorageGroup, 'id' | 'usedBytes' | 'studyCount' | 'status'>) => {
    const res = await api.post<PacsStorageGroup>('/pacs-admin/storage-groups', data)
    await invalidateApiCache('/pacs-admin/storage-groups')
    return res
  },

  deleteStorageGroup: async (id: string) => {
    const res = await api.delete(`/pacs-admin/storage-groups/${id}`)
    await invalidateApiCache('/pacs-admin/storage-groups')
    return res
  },

  listAssociations: (params?: PacsQueryParams) =>
    api.get<PacsAssociation[]>(`/pacs-admin/associations?${new URLSearchParams(params ?? {}).toString()}`),

  getStats: () =>
    api.get<PacsAdminStats>('/pacs-admin/stats'),
}
