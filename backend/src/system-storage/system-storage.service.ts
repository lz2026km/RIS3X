/**
 * G005 RIS v3.0.6.11-60 - 云存储配置 API
 * GET/PUT /system/storage-config  读取/保存存储配置 (SystemConfig 表)
 * POST /system/storage-config/test 连通性测试 (可用请求体里的配置或已保存配置)
 */
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as path from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { LocalStorageDriver } from '../common/storage/local-storage.driver'
import { S3StorageDriver } from '../common/storage/s3-storage.driver'
import {
  StorageConfigService,
  type StorageConfigDto,
  buildS3DriverOptions,
} from '../common/storage/storage.module'
import { isMaskedSecret, maskSecret } from '../common/storage/storage-crypto'

export interface StorageStatsDto {
  driver: string
  status: 'active' | 'inactive'
  detail?: string
  objectCount?: number
  usedBytes?: number
  truncated?: boolean
  latencyMs?: number
}

const STATS_MAX_KEYS = 5000

@Injectable()
export class SystemStorageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly configService: StorageConfigService,
  ) {}

  async getConfig(): Promise<{
    config: StorageConfigDto
    active: StorageStatsDto
    envDriver: string | null
    applied: boolean
  }> {
    const saved = await this.configService.getSaved().catch(() => null)
    const envDriver = (this.config.get<string>('STORAGE_DRIVER') ?? '').trim().toLowerCase() || null
    let config: StorageConfigDto = saved ?? { driver: 'local' }
    if (config.driver === 's3' && config.secretKey) {
      config = { ...config, secretKey: maskSecret(config.secretKey) }
    }
    const active = await this.getStats()
    return {
      config,
      active,
      envDriver,
      applied: envDriver !== 's3' && envDriver !== 'local' ? false : true,
    }
  }

  async saveConfig(cfg: StorageConfigDto): Promise<{ config: StorageConfigDto; applied: boolean }> {
    const saved = await this.configService.save(cfg)
    const envDriver = (this.config.get<string>('STORAGE_DRIVER') ?? '').trim().toLowerCase()
    const applied = envDriver !== 's3' && envDriver !== 'local'
    let config = saved
    if (config.driver === 's3' && config.secretKey) {
      config = { ...config, secretKey: maskSecret(config.secretKey) }
    }
    return { config, applied }
  }

  async testConnection(cfg?: StorageConfigDto): Promise<StorageStatsDto> {
    let target: StorageConfigDto = cfg && cfg.driver ? cfg : (await this.resolveEffective() ?? { driver: 'local' })
    if (target.driver === 's3' && target.secretKey && isMaskedSecret(target.secretKey)) {
      // 前端回传掩码: 用已保存的真实 secretKey 测试
      const saved = await this.configService.getSaved().catch(() => null)
      target = { ...target, secretKey: saved?.secretKey ?? '' }
    }
    if (target.driver === 's3') {
      const driver = new S3StorageDriver(buildS3DriverOptions(target, 10_000))
      const result = await driver.testConnection()
      return {
        driver: 's3',
        status: result.ok ? 'active' : 'inactive',
        detail: result.detail,
        latencyMs: result.latencyMs,
      }
    }
    const driver = new LocalStorageDriver({ root: this.resolveLocalRoot() })
    const result = await driver.testConnection()
    return {
      driver: 'local',
      status: result.ok ? 'active' : 'inactive',
      detail: result.detail,
      latencyMs: result.latencyMs,
    }
  }

  /** 存储统计: 对象数 / 已用容量 / 驱动状态 (S3 最多统计 STATS_MAX_KEYS 个对象) */
  async getStats(): Promise<StorageStatsDto> {
    const effective = await this.resolveEffective()
    if (effective?.driver === 's3') {
      try {
        const driver = new S3StorageDriver(buildS3DriverOptions(effective, 10_000))
        const test = await driver.testConnection()
        if (!test.ok) {
          return { driver: 's3', status: 'inactive', detail: test.detail }
        }
        let objectCount = 0
        let usedBytes = 0
        let truncated = false
        let token: string | undefined
        do {
          const page = await driver.list({
            maxKeys: STATS_MAX_KEYS,
            continuationToken: token,
          })
          objectCount += page.keys.length
          usedBytes += page.keys.reduce((s, k) => s + k.size, 0)
          truncated = page.isTruncated
          token = page.nextContinuationToken
          if (objectCount >= STATS_MAX_KEYS) break
        } while (truncated && token)
        return {
          driver: 's3',
          status: 'active',
          detail: `S3 对象存储统计 (${effective.endpoint}/${effective.bucket})`,
          objectCount,
          usedBytes,
          truncated,
          latencyMs: test.latencyMs,
        }
      } catch (err) {
        return { driver: 's3', status: 'inactive', detail: (err as Error).message }
      }
    }
    // local: 聚合 DICOM / VNA / Uploads 三个目录
    const roots = [
      this.config.get<string>('DICOM_STORAGE_DIR', 'dicom'),
      process.env['VNA_STORAGE_DIR']?.trim() || this.resolveLocalRoot(),
      this.config.get<string>('FILES_STORAGE_DIR', 'uploads'),
    ]
    let objectCount = 0
    let usedBytes = 0
    let truncated = false
    const seen = new Set<string>()
    for (const root of roots) {
      try {
        const driver = new LocalStorageDriver({ root })
        const page = await driver.list({ maxKeys: STATS_MAX_KEYS })
        for (const k of page.keys) {
          const key = path.resolve(root, k.key)
          if (seen.has(key)) continue
          seen.add(key)
          objectCount += 1
          usedBytes += k.size
        }
        if (page.isTruncated) truncated = true
      } catch {
        /* 目录不存在则跳过 */
      }
    }
    return {
      driver: 'local',
      status: 'active',
      detail: `本地存储统计 (${roots.length} 个目录)`,
      objectCount,
      usedBytes,
      truncated,
    }
  }

  private async resolveEffective(): Promise<StorageConfigDto | null> {
    try {
      return await this.configService.effectiveDriver()
    } catch {
      return null
    }
  }

  private resolveLocalRoot(): string {
    const cwd = process.cwd()
    const root = cwd.includes(`${path.sep}backend`) ? cwd : path.join(cwd, 'backend')
    return process.env['VNA_STORAGE_DIR']?.trim() || path.join(root, 'vna-storage')
  }
}
