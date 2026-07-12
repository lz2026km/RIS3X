import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'

export interface DeviceDto {
  id: string
  deviceId?: string
  code: string
  name: string
  modality: string
  status: string
  manufacturer?: string
  model?: string
  roomId?: string
  utilization?: number
  deviceType?: string
  room?: string
  building?: string
  grade?: string
  totalMonthlyScans?: number
  totalValue?: number
  totalDowntime?: number
  lastMaintenanceAt?: string
  nextMaintenanceAt?: string
  maintenanceCycle?: string
  responsibleEngineer?: string
}

export interface CreateDeviceDto {
  code: string
  name: string
  modality: string
  manufacturer?: string
  location?: string
}

export interface UpdateDeviceDto {
  name?: string
  modality?: string
  manufacturer?: string
  location?: string
  state?: 'IDLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN' | 'OFFLINE'
}

export const deviceApi = {
  list: (params?: { skip?: number; take?: number; modality?: string; state?: string }) =>
    api.get<DeviceDto[]>(`/devices?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  getById: (id: string) =>
    api.get<DeviceDto>(`/devices/${id}`),

  create: async (data: CreateDeviceDto) => {
    const res = await api.post<DeviceDto>('/devices', data)
    await invalidateApiCacheByPrefix('/devices')
    return res
  },

  update: async (id: string, data: UpdateDeviceDto) => {
    const res = await api.patch<DeviceDto>(`/devices/${id}`, data)
    await invalidateApiCache(`/devices/${id}`)
    await invalidateApiCacheByPrefix('/devices')
    return res
  },

  delete: async (id: string) => {
    const res = await api.delete<null>(`/devices/${id}`)
    await invalidateApiCacheByPrefix('/devices')
    return res
  },

  getStats: (id: string) =>
    api.get<any>(`/devices/${id}/stats`),

  updateStatus: (id: string, status: string) =>
    api.patch<DeviceDto>(`/devices/${id}`, { state: status }),
}
