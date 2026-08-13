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

// [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理
export type BucketProvider = 'local' | 's3' | 'minio'

export interface StorageBucketDto {
  name: string
  provider: BucketProvider
  region: string
  objectCount: number
  usedBytes: number
  createdAt: string
}

export interface StorageObjectDto {
  key: string
  size: number
  modified: string
}

export interface StorageDownloadDto {
  key: string
  size: number
  contentType: string
  filename: string
  contentBase64: string
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

  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 桶管理
  listBuckets: () => api.get<StorageBucketDto[]>('/system/storage/buckets'),

  createBucket: (body: { name: string; provider: BucketProvider; region: string }) =>
    api.post<StorageBucketDto>('/system/storage/buckets', body),

  deleteBucket: (name: string) =>
    api.delete<{ deleted: string }>(`/system/storage/buckets/${encodeURIComponent(name)}`),

  listBucketObjects: (name: string) =>
    api.get<StorageObjectDto[]>(`/system/storage/buckets/${encodeURIComponent(name)}/objects`),

  uploadObject: (name: string, body: { key: string; size: number }) =>
    api.post<StorageObjectDto>(`/system/storage/buckets/${encodeURIComponent(name)}/upload`, body),

  downloadObject: (name: string, key: string) =>
    api.get<StorageDownloadDto>(`/system/storage/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(key)}/download`),
}

export default storageConfigApi
