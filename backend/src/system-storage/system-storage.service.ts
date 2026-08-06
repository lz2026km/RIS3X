/**
 * G005 RIS v3.0.6.11-60 - 云存储配置 API
 * GET/PUT /system/storage-config  读取/保存存储配置 (SystemConfig 表)
 * POST /system/storage-config/test 连通性测试 (可用请求体里的配置或已保存配置)
 */
import { Injectable, NotFoundException } from '@nestjs/common'
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

export interface AdminConfigItem {
  key: string
  value: string
  desc: string
}

// [W5] 系统管理后台可编辑配置项 (SystemConfig 表, 与前端 SystemAdminPage 表单对齐)
const ADMIN_CONFIG_DEFS: Array<{ key: string; desc: string; default: string | number }> = [
  { key: 'hospital_name', desc: '医院名称', default: 'G005 放射科信息管理系统' },
  { key: 'report_footer', desc: '报告页脚', default: '本报告仅供临床参考，请结合临床实际情况。' },
  { key: 'critical_sla_minutes', desc: '危急值 SLA 阈值（分钟）', default: 10 },
  { key: 'critical_timeout_minutes', desc: '危急值超时升级（分钟）', default: 60 },
  { key: 'default_page_size', desc: '默认分页大小', default: 20 },
  { key: 'pdf_watermark_text', desc: 'PDF 水印文本', default: 'G005 RIS 内部资料' },
]

const ADMIN_NUMERIC_KEYS = new Set(['critical_sla_minutes', 'critical_timeout_minutes', 'default_page_size'])

function coerceConfigValue(key: string, value: unknown): unknown {
  if (typeof value === 'string' && ADMIN_NUMERIC_KEYS.has(key)) {
    const trimmed = value.trim()
    if (/^-?\d+$/.test(trimmed)) return Number(trimmed)
  }
  return value
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

  // [W5] GET /system/admin/configs: 合并已保存值与默认值, 返回 { key, value, desc } 列表
  async listAdminConfigs(): Promise<AdminConfigItem[]> {
    const rows = await this.prisma.systemConfig.findMany()
    const byKey = new Map(rows.map((r) => [r.key, r.value]))
    return ADMIN_CONFIG_DEFS.map(({ key, desc, default: def }) => {
      const stored = byKey.get(key)
      let value: unknown = def
      if (stored !== undefined) {
        value = typeof stored === 'object' && stored !== null ? JSON.stringify(stored) : stored
      }
      return { key, value: String(value), desc }
    })
  }

  // [W5] PUT /system/admin/configs: 批量保存 (白名单 key), 返回更新后列表
  async saveAdminConfigs(items: Array<{ key: string; value: unknown }>): Promise<AdminConfigItem[]> {
    const allowed = new Set(ADMIN_CONFIG_DEFS.map((d) => d.key))
    for (const item of items) {
      const key = item.key?.trim()
      if (!key || !allowed.has(key)) continue
      await this.prisma.systemConfig.upsert({
        where: { key },
        update: { value: coerceConfigValue(key, item.value) as object },
        create: { key, value: coerceConfigValue(key, item.value) as object },
      })
    }
    return this.listAdminConfigs()
  }

  // [W5] PATCH /system/admin/configs/:key: 保存单项配置
  async updateAdminConfig(key: string, value: unknown): Promise<AdminConfigItem> {
    if (!ADMIN_CONFIG_DEFS.some((d) => d.key === key)) {
      throw new NotFoundException(`Unknown config key: ${key}`)
    }
    await this.prisma.systemConfig.upsert({
      where: { key },
      update: { value: coerceConfigValue(key, value) as object },
      create: { key, value: coerceConfigValue(key, value) as object },
    })
    const item = (await this.listAdminConfigs()).find((c) => c.key === key)
    if (!item) throw new NotFoundException(`Config ${key} not found`)
    return item
  }

  async testConnection(cfg?: StorageConfigDto): Promise<StorageStatsDto> {    let target: StorageConfigDto = cfg && cfg.driver ? cfg : (await this.resolveEffective() ?? { driver: 'local' })
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
