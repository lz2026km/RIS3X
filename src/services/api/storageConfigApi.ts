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

// [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 存储容量阈值预警配置
export type NotifyChannel = 'email' | 'sms' | 'wechat' | 'dingtalk' | 'app'

export interface StorageAlertsConfig {
  warnPercent: number
  criticalPercent: number
  notifyChannels: NotifyChannel[]
}

export const storageConfigApi = {
  get: () => api.get<StorageConfigResponse>('/system/storage-config'),

  save: (config: StorageConfigDto) =>
    api.put<StorageConfigResponse>('/system/storage-config', config),

  test: (config?: StorageConfigDto) =>
    api.post<StorageTestResponse>('/system/storage-config/test', config ?? {}),

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 容量阈值预警
  getAlertsConfig: () => api.get<StorageAlertsConfig>('/system/storage/alerts-config'),

  saveAlertsConfig: (config: StorageAlertsConfig) =>
    api.put<StorageAlertsConfig>('/system/storage/alerts-config', config),
}

export default storageConfigApi
