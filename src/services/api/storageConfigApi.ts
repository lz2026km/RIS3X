import { api, invalidateApiCache } from './client'

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
  /** [G005 v3.0.6.11-99 Wave 7A (G-28)] 驱动来源: local-fs / aws-sigv4-native / simulated */
  source?: 'local-fs' | 'aws-sigv4-native' | 'simulated'
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
  /** [G005 v3.0.6.11-99 Wave 7A (G-28)] 多租户桶隔离: 桶归属租户 */
  tenantId: string
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

// [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略
export type LifecycleTransitionTier = 'tier2' | 'archive' | 'backup'

export interface LifecyclePolicyDto {
  id: string
  bucket: string
  prefix: string
  transitionTo: LifecycleTransitionTier
  afterDays: number
  deleteAfterDays?: number
  enabled: boolean
  tenantId: string
  createdAt: string
  updatedAt: string
}

export interface LifecyclePolicyInput {
  bucket: string
  prefix?: string
  transitionTo: LifecycleTransitionTier
  afterDays: number
  deleteAfterDays?: number | null
  enabled?: boolean
}

export interface BatchDeleteResult {
  bucket: string
  deleted: string[]
  missing: string[]
  source: 'simulated' | 'aws-sigv4-native'
}

export interface CopyObjectResult {
  key: string
  targetBucket: string
  size: number
  modified: string
  copied: true
  source: 'simulated' | 'aws-sigv4-native'
}

// [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL
export interface SignedUrlDto {
  bucket: string
  key: string
  url: string
  expiresInSec: number
  expiresAt: string
  source: 'aws-sigv4-native' | 'simulated'
}

// [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制任务
export type ReplicationStatus = 'queued' | 'running' | 'completed' | 'failed'

export interface ReplicationTaskDto {
  id: string
  sourceBucket: string
  targetBucket: string
  region: string
  status: ReplicationStatus
  progress: number
  objectsTotal: number
  objectsCopied: number
  bytesTotal: number
  bytesCopied: number
  createdAt: string
  startedAt?: string
  finishedAt?: string
  error?: string
  source: 'simulated' | 'aws-sigv4-native'
}

export interface ReplicationStatusDto {
  tasks: ReplicationTaskDto[]
  pending: number
  running: number
  completed: number
  failed: number
  queueDepth: number
  lastUpdatedAt: string
}

// [G005 v3.0.6.11-100 Wave 3B (G-28)] 存储监控指标
export interface BucketUsageMetricDto {
  name: string
  provider: BucketProvider
  region: string
  objectCount: number
  usedBytes: number
  percentOfTotal: number
}

export interface IoCountsDto {
  readPerMin: number
  writePerMin: number
  putPerMin: number
  deletePerMin: number
  derived: boolean
}

export interface StorageMonitoringDto {
  totalCapacityBytes: number
  totalUsedBytes: number
  usedPercent: number
  growthRatePct30d: number
  objectsTotal: number
  buckets: BucketUsageMetricDto[]
  ioCounts: IoCountsDto
  replication: {
    pending: number
    running: number
    completed: number
    failed: number
    pendingBytes: number
  }
  history: Array<{ date: string; usedBytes: number; capacityBytes: number }>
  source: 'derived' | 'seed'
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

  createBucket: async (body: { name: string; provider: BucketProvider; region: string }) => {
    const res = await api.post<StorageBucketDto>('/system/storage/buckets', body);
    if (res.success) await invalidateApiCache('/system/storage/buckets');
    return res;
  },

  deleteBucket: async (name: string) => {
    const res = await api.delete<{ deleted: string }>(`/system/storage/buckets/${encodeURIComponent(name)}`);
    if (res.success) await invalidateApiCache('/system/storage/buckets');
    return res;
  },

  listBucketObjects: (name: string) =>
    api.get<StorageObjectDto[]>(`/system/storage/buckets/${encodeURIComponent(name)}/objects`),

  uploadObject: async (name: string, body: { key: string; size: number }) => {
    const res = await api.post<StorageObjectDto>(`/system/storage/buckets/${encodeURIComponent(name)}/upload`, body);
    if (res.success) await invalidateApiCache(`/system/storage/buckets/${encodeURIComponent(name)}/objects`);
    return res;
  },

  downloadObject: (name: string, key: string) =>
    api.get<StorageDownloadDto>(`/system/storage/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(key)}/download`),

  // [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略
  listLifecyclePolicies: () => api.get<LifecyclePolicyDto[]>('/system/storage/lifecycle-policies'),

  createLifecyclePolicy: async (body: LifecyclePolicyInput) => {
    const res = await api.post<LifecyclePolicyDto>('/system/storage/lifecycle-policies', body);
    if (res.success) await invalidateApiCache('/system/storage/lifecycle-policies');
    return res;
  },

  updateLifecyclePolicy: async (id: string, body: Partial<LifecyclePolicyInput>) => {
    const res = await api.patch<LifecyclePolicyDto>(`/system/storage/lifecycle-policies/${encodeURIComponent(id)}`, body);
    if (res.success) await invalidateApiCache('/system/storage/lifecycle-policies');
    return res;
  },

  deleteLifecyclePolicy: async (id: string) => {
    const res = await api.delete<{ deleted: string }>(`/system/storage/lifecycle-policies/${encodeURIComponent(id)}`);
    if (res.success) await invalidateApiCache('/system/storage/lifecycle-policies');
    return res;
  },

  // [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象批量操作
  batchDeleteObjects: async (name: string, keys: string[]) => {
    const res = await api.post<BatchDeleteResult>(`/system/storage/buckets/${encodeURIComponent(name)}/batch-delete`, { keys });
    if (res.success) await invalidateApiCache(`/system/storage/buckets/${encodeURIComponent(name)}/objects`);
    return res;
  },

  copyObject: async (name: string, body: { key: string; targetBucket: string }) => {
    const res = await api.post<CopyObjectResult>(`/system/storage/buckets/${encodeURIComponent(name)}/copy`, body);
    if (res.success) {
      await invalidateApiCache(`/system/storage/buckets/${encodeURIComponent(name)}/objects`);
      await invalidateApiCache(`/system/storage/buckets/${encodeURIComponent(body.targetBucket)}/objects`);
    }
    return res;
  },

  // [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL (带时间戳防 GET 缓存复用过期 URL)
  signedUrl: (name: string, key: string, expiresInSec?: number) =>
    api.get<SignedUrlDto>(
      `/system/storage/buckets/${encodeURIComponent(name)}/objects/${encodeURIComponent(key)}/signed-url${expiresInSec !== undefined ? `?expiresInSec=${expiresInSec}` : ''}&_t=${Date.now()}`,
    ),

  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制任务
  replicateBucket: async (name: string, body: { targetBucket: string; region: string }) => {
    const res = await api.post<ReplicationTaskDto>(`/system/storage/buckets/${encodeURIComponent(name)}/replicate`, body);
    if (res.success) {
      await invalidateApiCache(`/system/storage/buckets/${encodeURIComponent(name)}/objects`);
      await invalidateApiCache(`/system/storage/buckets/${encodeURIComponent(body.targetBucket)}/objects`);
    }
    return res;
  },

  // 带时间戳防 GET 缓存: 复制队列状态需实时
  replicationStatus: () => api.get<ReplicationStatusDto>(`/system/storage/replication-status?_t=${Date.now()}`),

  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 存储监控指标
  getMonitoring: () => api.get<StorageMonitoringDto>('/system/storage/monitoring'),
}

export default storageConfigApi
