/**
 * G005 放射RIS系统 v3.0.2 - 文件服务
 * 简化:本地 /uploads + 预签名 URL
 */
import { Injectable, BadRequestException } from '@nestjs/common'
import * as crypto from 'node:crypto'
import * as path from 'node:path'

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

  confirmUpload(token: string, metadata: { size: number; checksum: string; filename: string }): { id: string; url: string; size: number; checksum: string; uploadedAt: string } {
    if (!token || !metadata?.filename) throw new BadRequestException('invalid')
    if (metadata.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('文件大小超过限制')
    }
    const safeName = path.basename(metadata.filename)
    const id = crypto.randomBytes(12).toString('hex')
    return {
      id,
      url: `/api/files/download/${id}/${encodeURIComponent(safeName)}`,
      size: metadata.size,
      checksum: metadata.checksum,
      uploadedAt: new Date().toISOString(),
    }
  }


}
