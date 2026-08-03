/**
 * G005 放射RIS系统 v3.0.6.11-60 - 文件服务
 * 简化: 预签名 token 上传 → StorageDriver 存储 (本地 / S3/MinIO 双驱动) + 下载
 */
import { Injectable, BadRequestException, NotFoundException, Optional, Inject } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'node:crypto'
import * as path from 'node:path'
import { STORAGE_DRIVER } from '../common/storage/storage.module'
import { LocalStorageDriver } from '../common/storage/local-storage.driver'
import type { StorageDriver } from '../common/storage/storage.interface'

interface PendingUpload {
  id: string
  token: string
  key: string
  name: string
  contentType: string
  createdAt: number
}

@Injectable()
export class FilesService {
  /**
   * 生成预签名上传 URL(简化版:用 token + 过期时间)
   */
  private readonly ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/dicom',
    'application/pdf', 'application/octet-stream',
  ])
  private readonly MAX_FILE_SIZE = 100 * 1024 * 1024
  private readonly storage: StorageDriver
  private readonly pending = new Map<string, PendingUpload>()

  constructor(
    private readonly config: ConfigService,
    @Optional() @Inject(STORAGE_DRIVER) storageDriver?: StorageDriver,
  ) {
    const root = this.config.get<string>('FILES_STORAGE_DIR', 'uploads')
    this.storage = storageDriver ?? new LocalStorageDriver({ root })
  }

  getUploadUrl(filename: string, contentType: string): { uploadUrl: string; token: string; expiresAt: string } {
    if (!filename) throw new BadRequestException('filename required')
    if (!this.ALLOWED_MIME_TYPES.has(contentType) && contentType !== 'application/octet-stream') {
      throw new BadRequestException('不支持的文件类型')
    }
    const token = crypto.randomBytes(16).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const safeName = path.basename(filename)
    const ext = path.extname(safeName).toLowerCase()
    const allowedExts = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.dcm', '.pdf', '.zip'])
    if (ext && !allowedExts.has(ext)) {
      throw new BadRequestException('不支持的文件扩展名')
    }
    return {
      uploadUrl: `/api/files/upload/${token}?name=${encodeURIComponent(safeName)}&ct=${encodeURIComponent(contentType)}`,
      token,
      expiresAt,
    }
  }

  /**
   * 上传: 原始 body 写入 StorageDriver, 返回 token → 文件元信息
   */
  async upload(token: string, filename: string, contentType: string, buffer: Buffer): Promise<{ id: string; url: string; size: number; checksum: string; uploadedAt: string }> {
    if (!token || token.length < 8) throw new BadRequestException('invalid token')
    if (!filename) throw new BadRequestException('filename required')
    if (!buffer || buffer.length === 0) throw new BadRequestException('empty body')
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new BadRequestException('文件大小超过限制 (100MB)')
    }
    const safeName = path.basename(filename)
    const id = crypto.randomBytes(12).toString('hex')
    const key = `uploads/${id}_${safeName}`
    await this.storage.put(key, buffer, { contentType })
    const entry: PendingUpload = {
      id,
      token,
      key,
      name: safeName,
      contentType,
      createdAt: Date.now(),
    }
    this.pending.set(token, entry)
    // 清理 30 分钟前的过期 token
    for (const [t, e] of this.pending) {
      if (Date.now() - e.createdAt > 30 * 60 * 1000) this.pending.delete(t)
    }
    return {
      id,
      url: `/api/files/download/${id}/${encodeURIComponent(safeName)}`,
      size: buffer.length,
      checksum: crypto.createHash('sha256').update(buffer).digest('hex'),
      uploadedAt: new Date().toISOString(),
    }
  }

  /**
   * 下载: 从 StorageDriver 读取
   */
  async download(id: string, name?: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const safeName = path.basename(name ?? '')
    let entry: PendingUpload | undefined
    for (const e of this.pending.values()) {
      if (e.id === id && (!safeName || e.name === safeName)) {
        entry = e
        break
      }
    }
    if (!entry) throw new NotFoundException(`File ${id} not found or upload session expired`)
    const buffer = await this.storage.get(entry.key)
    return { buffer, contentType: entry.contentType, filename: entry.name }
  }

  confirmUpload(token: string, metadata: { size: number; checksum: string; filename: string }): { id: string; url: string; size: number; checksum: string; uploadedAt: string } {
    if (!token || !metadata?.filename) throw new BadRequestException('invalid')
    if (metadata.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('文件大小超过限制')
    }
    const entry = this.pending.get(token)
    const safeName = path.basename(metadata.filename)
    const id = entry?.id ?? crypto.randomBytes(12).toString('hex')
    return {
      id,
      url: `/api/files/download/${id}/${encodeURIComponent(safeName)}`,
      size: metadata.size,
      checksum: metadata.checksum,
      uploadedAt: new Date().toISOString(),
    }
  }
}
