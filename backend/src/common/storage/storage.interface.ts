/**
 * G005 RIS v3.0.6.11-60 - 存储抽象层 (Storage Abstraction)
 * 对标 GE True PACS Cloud / Sectra One Cloud / Fujifilm 云原生存储
 * StorageDriver 统一本地文件系统 / S3 / MinIO 的 put/get/delete/list/stat 语义。
 * key 约定:
 *   - local 驱动: 相对 storage root 的相对路径(兼容已存在的绝对路径行)
 *   - s3 驱动:    对象键 (object key), 如 study/series/sop.dcm
 */
export interface StorageObjectMeta {
  key: string
  size: number
  lastModified?: Date
  etag?: string
}

export interface StoragePutOptions {
  contentType?: string
  metadata?: Record<string, string>
}

export interface StorageListOptions {
  prefix?: string
  maxKeys?: number
  continuationToken?: string
}

export interface StorageListResult {
  keys: StorageObjectMeta[]
  isTruncated: boolean
  nextContinuationToken?: string
}

export interface StorageTestResult {
  ok: boolean
  driver: string
  detail?: string
  latencyMs?: number
}

export interface StorageDriver {
  readonly name: string
  put(key: string, data: Buffer, options?: StoragePutOptions): Promise<void>
  get(key: string): Promise<Buffer>
  delete(key: string): Promise<void>
  list(options?: StorageListOptions): Promise<StorageListResult>
  stat(key: string): Promise<StorageObjectMeta>
  testConnection(): Promise<StorageTestResult>
}
