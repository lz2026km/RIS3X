import { api } from './client'

// 云存储配置 API (G005 RIS v3.0.6.11-60)
// GET/PUT /system/storage-config + POST /system/storage-config/test

export type StorageDriverType = 'local' | 's3'

export interface StorageConfigDto {
  driver: StorageDriverType
  endpoint?: string
  bucket?: string
  region?: string
  accessKey?: string
  secretKey?: string
}

export interface StorageStatsDto {
  driver: string
  status: 'active' | 'inactive'
  detail?: string
  objectCount?: number
  usedBytes?: number
  truncated?: boolean
  latencyMs?: number
}

export interface StorageConfigResponse {
  config: StorageConfigDto
  active: StorageStatsDto
  envDriver: string | null
  applied: boolean
}

export interface StorageTestResponse {
  driver: string
  status: 'active' | 'inactive'
  detail?: string
  latencyMs?: number
}

export const storageConfigApi = {
  get: () => api.get<StorageConfigResponse>('/system/storage-config'),

  save: (config: StorageConfigDto) =>
    api.put<StorageConfigResponse>('/system/storage-config', config),

  test: (config?: StorageConfigDto) =>
    api.post<StorageTestResponse>('/system/storage-config/test', config ?? {}),
}

export default storageConfigApi
