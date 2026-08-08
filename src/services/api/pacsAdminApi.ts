import { api, invalidateApiCache } from './client'

// PACS Admin (PACS 管理) API
// [G005 W1-C] MOCK_ONLY: 后端无 pacs-admin controller,
// 全部 11 方法由 MSW (src/services/mockBackend/shellBatch3Handlers.ts) 支撑演示数据, 后端待实现。

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
  // MOCK_ONLY (后端无 controller, MSW 支撑)
  listServers: (params?: PacsQueryParams) =>
    api.get<PacsServer[]>(`/pacs-admin/servers?${new URLSearchParams(params ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getServer: (id: string) =>
    api.get<PacsServer>(`/pacs-admin/servers/${id}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  addServer: async (data: Omit<PacsServer, 'id' | 'status' | 'lastHeartbeat' | 'storageBytes' | 'studyCount' | 'seriesCount'>) => {
    const res = await api.post<PacsServer>('/pacs-admin/servers', data)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  updateServer: async (id: string, data: Partial<PacsServer>) => {
    const res = await api.put<PacsServer>(`/pacs-admin/servers/${id}`, data)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  deleteServer: async (id: string) => {
    const res = await api.delete(`/pacs-admin/servers/${id}`)
    await invalidateApiCache('/pacs-admin/servers')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  testConnection: (id: string) =>
    api.post<{ success: boolean; latencyMs: number }>(`/pacs-admin/servers/${id}/test`, {}),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  listStorageGroups: () =>
    api.get<PacsStorageGroup[]>('/pacs-admin/storage-groups'),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  createStorageGroup: async (data: Omit<PacsStorageGroup, 'id' | 'usedBytes' | 'studyCount' | 'status'>) => {
    const res = await api.post<PacsStorageGroup>('/pacs-admin/storage-groups', data)
    await invalidateApiCache('/pacs-admin/storage-groups')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  deleteStorageGroup: async (id: string) => {
    const res = await api.delete(`/pacs-admin/storage-groups/${id}`)
    await invalidateApiCache('/pacs-admin/storage-groups')
    return res
  },

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  listAssociations: (params?: PacsQueryParams) =>
    api.get<PacsAssociation[]>(`/pacs-admin/associations?${new URLSearchParams(params ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑)
  getStats: () =>
    api.get<PacsAdminStats>('/pacs-admin/stats'),
}
