/**
 * G005 RIS v3.0.6.11-60 - 云存储配置 API
 * GET/PUT /system/storage-config  读取/保存存储配置 (SystemConfig 表)
 * POST /system/storage-config/test 连通性测试 (可用请求体里的配置或已保存配置)
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import * as crypto from 'node:crypto'
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
import { currentTenantId } from '../common/tenant/tenant-utils'
import { SystemConfigService } from './system-config.service'

/** [G005 v3.0.6.11-99 Wave 7A (G-28)] 数据源标注 */
export type StorageSource = 'local-fs' | 'aws-sigv4-native' | 'simulated'

export interface StorageStatsDto {
  driver: string
  status: 'active' | 'inactive'
  /** [G005 v3.0.6.11-99 Wave 7A (G-28)] 驱动来源: local-fs / aws-sigv4-native / simulated */
  source?: StorageSource
  detail?: string
  objectCount?: number
  usedBytes?: number
  truncated?: boolean
  latencyMs?: number
}

/** [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 存储容量阈值预警配置 */
export interface StorageAlertsConfig {
  warnPercent: number
  criticalPercent: number
  notifyChannels: string[]
}

// ═══════════ [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理 ═══════════

// [G005 v3.0.6.11-99 Wave 7A (G-28)] 多租户桶隔离: 桶记录携带 tenantId,
// 列表/访问均按当前租户过滤, 非 default 租户新建桶自动加 `${tenantId}-` 前缀。
export interface StorageBucketDto {
  name: string
  provider: 'local' | 's3' | 'minio'
  region: string
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
  /** Base64 模拟内容 (前端解码为 Blob 下载) */
  contentBase64: string
}

// ═══════════ [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略 ═══════════

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

export interface BatchDeleteResultDto {
  bucket: string
  deleted: string[]
  missing: string[]
  source: StorageSource
}

export interface CopyObjectResultDto {
  key: string
  targetBucket: string
  size: number
  modified: string
  copied: true
  source: StorageSource
}

// ═══════════ [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL + 跨区复制 + 监控 ═══════════

export interface SignedUrlDto {
  bucket: string
  key: string
  url: string
  expiresInSec: number
  expiresAt: string
  /** 数据源标注: aws-sigv4-native (真实 SigV4 预签名) / simulated (本地模拟 URL) */
  source: 'aws-sigv4-native' | 'simulated'
}

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

export interface BucketUsageMetricDto {
  name: string
  provider: 'local' | 's3' | 'minio'
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
  /** true = 从桶/对象统计派生, false = seed 示例值 */
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
  /** 30 天容量趋势 (seed 派生, 末位替换为当前真实值) */
  history: Array<{ date: string; usedBytes: number; capacityBytes: number }>
  /** 数据源标注: derived (从 buckets/对象派生) / seed (seed 回退) */
  source: 'derived' | 'seed'
}

interface LifecyclePolicyRecord extends LifecyclePolicyDto {}

interface BucketRecord extends StorageBucketDto {
  objects: StorageObjectDto[]
}

// 内存 seed: 桶列表 (与 S3/MinIO/本地 三种 provider 对齐), 归属 default 租户
const BUCKET_SEED: Array<Pick<StorageBucketDto, 'name' | 'provider' | 'region' | 'tenantId'> & { objects: Array<[string, number]> }> = [
  {
    name: 'g005-dicom',
    provider: 's3',
    region: 'us-east-1',
    tenantId: 'default',
    objects: [
      ['ct-frame-0001.dcm', 512_000],
      ['ct-frame-0002.dcm', 512_000],
      ['mr-cardiac-4d-0001.dcm', 1_048_576],
      ['xr-chest-0001.dcm', 256_000],
    ],
  },
  {
    name: 'g005-vna',
    provider: 'minio',
    region: 'cn-north-1',
    tenantId: 'default',
    objects: [
      ['report-0001.pdf', 128_000],
      ['report-0002.pdf', 96_000],
      ['archive-manifest.json', 4_096],
    ],
  },
  {
    name: 'g005-files',
    provider: 'local',
    region: 'us-east-1',
    tenantId: 'default',
    objects: [
      ['teaching-case-001.png', 2_048_000],
      ['dicom-export-20260813.zip', 8_388_608],
    ],
  },
]

// 内存 seed: 对象生命周期策略 (default 租户, 与桶 seed 对齐)
const LIFECYCLE_SEED: Array<Omit<LifecyclePolicyDto, 'id' | 'createdAt' | 'updatedAt'>> = [
  {
    bucket: 'g005-dicom',
    prefix: 'ct-',
    transitionTo: 'tier2',
    afterDays: 90,
    deleteAfterDays: 365,
    enabled: true,
    tenantId: 'default',
  },
  {
    bucket: 'g005-dicom',
    prefix: '',
    transitionTo: 'archive',
    afterDays: 365,
    enabled: true,
    tenantId: 'default',
  },
  {
    bucket: 'g005-vna',
    prefix: 'report-',
    transitionTo: 'backup',
    afterDays: 30,
    deleteAfterDays: 730,
    enabled: false,
    tenantId: 'default',
  },
]

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
  private readonly logger = new Logger(SystemStorageService.name)
  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 容量阈值预警配置 (内存 + 环境 seed 回退)
  private alertsConfig: StorageAlertsConfig
  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理 (内存 + seed)
  private readonly buckets: Map<string, BucketRecord>
  // [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略 (内存 + seed)
  private readonly lifecyclePolicies: Map<string, LifecyclePolicyRecord>
  private lifecycleSeq = 0
  // [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制任务内存队列
  private readonly replicationTasks: Map<string, ReplicationTaskDto>
  private replicationSeq = 0

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly configService: StorageConfigService,
    private readonly systemConfig: SystemConfigService,
  ) {
    const warn = Number(this.config.get<string>('STORAGE_ALERT_WARN_PERCENT', '80'))
    const critical = Number(this.config.get<string>('STORAGE_ALERT_CRITICAL_PERCENT', '90'))
    const channels = (this.config.get<string>('STORAGE_ALERT_CHANNELS', 'email,sms') ?? 'email,sms')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
    this.alertsConfig = {
      warnPercent: Number.isFinite(warn) ? Math.min(100, Math.max(1, warn)) : 80,
      criticalPercent: Number.isFinite(critical) ? Math.min(100, Math.max(1, critical)) : 90,
      notifyChannels: channels.length ? channels : ['email'],
    }
    this.buckets = new Map(
      BUCKET_SEED.map((seed) => [
        seed.name,
        {
          name: seed.name,
          provider: seed.provider,
          region: seed.region,
          tenantId: seed.tenantId,
          objectCount: seed.objects.length,
          usedBytes: seed.objects.reduce((s, [, size]) => s + size, 0),
          createdAt: '2026-06-01T08:00:00.000Z',
          objects: seed.objects.map(([key, size]) => ({
            key,
            size,
            modified: '2026-08-10T03:24:00.000Z',
          })),
        },
      ]),
    )
    this.lifecyclePolicies = new Map(
      LIFECYCLE_SEED.map((seed) => {
        const id = this.nextLifecycleId()
        return [
          id,
          {
            ...seed,
            id,
            createdAt: '2026-07-01T08:00:00.000Z',
            updatedAt: '2026-07-01T08:00:00.000Z',
          },
        ]
      }),
    )
    this.replicationTasks = new Map()
  }

  private nextLifecycleId(): string {
    this.lifecycleSeq += 1
    return `lp-${String(this.lifecycleSeq).padStart(3, '0')}`
  }

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
  // [v3.0.6.11-79] 保存后 invalidate 缓存 → 消费者(报告导出/HL7/SLA/分页)立即生效
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
      this.systemConfig.invalidate(key)
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
    this.systemConfig.invalidate(key)
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
        source: 'aws-sigv4-native',
        detail: result.detail,
        latencyMs: result.latencyMs,
      }
    }
    const driver = new LocalStorageDriver({ root: this.resolveLocalRoot() })
    const result = await driver.testConnection()
    return {
      driver: 'local',
      status: result.ok ? 'active' : 'inactive',
      source: 'local-fs',
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
          return { driver: 's3', status: 'inactive', source: 'aws-sigv4-native', detail: test.detail }
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
          source: 'aws-sigv4-native',
          detail: `S3 对象存储统计 (${effective.endpoint}/${effective.bucket})`,
          objectCount,
          usedBytes,
          truncated,
          latencyMs: test.latencyMs,
        }
      } catch (err) {
        return { driver: 's3', status: 'inactive', source: 'aws-sigv4-native', detail: (err as Error).message }
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
      source: 'local-fs',
      detail: `本地存储统计 (${roots.length} 个目录)`,
      objectCount,
      usedBytes,
      truncated,
    }
  }

  // ═══════════ [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理 ═══════════
  // ═══════════ [G005 v3.0.6.11-99 Wave 7A (G-28)] 多租户桶隔离 + 对象批量操作 ═══════════

  private toBucketDto(rec: BucketRecord): StorageBucketDto {
    return {
      name: rec.name,
      provider: rec.provider,
      region: rec.region,
      tenantId: rec.tenantId,
      objectCount: rec.objects.length,
      usedBytes: rec.objects.reduce((s, o) => s + o.size, 0),
      createdAt: rec.createdAt,
    }
  }

  /** 当前请求租户 (AsyncLocalStorage, 无上下文回退 default) */
  private currentTenant(): string {
    return currentTenantId()
  }

  /** [G005 v3.0.6.11-99 Wave 7A (G-28)] 租户桶前缀: default 无前缀, 其余租户 `${tenantId}-` (sanitize) */
  private tenantBucketPrefix(tenantId: string): string {
    if (tenantId === 'default') return ''
    const safe = tenantId.toLowerCase().replace(/[^a-z0-9.-]/g, '-').replace(/^-+|-+$/g, '')
    return safe ? `${safe}-` : ''
  }

  /** 跨租户命名防护: 拒绝以其他租户前缀开头的桶名 (防止租户 A 抢占租户 B 的桶) */
  private assertNoForeignTenantPrefix(name: string, tenantId: string): void {
    const ownPrefix = this.tenantBucketPrefix(tenantId)
    for (const rec of this.buckets.values()) {
      if (rec.tenantId === tenantId) continue
      const foreign = this.tenantBucketPrefix(rec.tenantId)
      if (foreign && name.startsWith(foreign)) {
        throw new BadRequestException(`Bucket name ${name} conflicts with tenant ${rec.tenantId}`)
      }
    }
    if (ownPrefix && name.startsWith(ownPrefix)) {
      throw new BadRequestException(`Bucket name ${name} already carries tenant prefix, 请直接使用不带前缀的名称`)
    }
  }

  private getBucketOrThrow(name: string): BucketRecord {
    const rec = this.buckets.get(name)
    if (!rec) throw new NotFoundException(`Bucket ${name} not found`)
    // [G005 v3.0.6.11-99 Wave 7A (G-28)] 租户隔离: 非本租户桶视为不存在
    if (rec.tenantId !== this.currentTenant()) {
      throw new NotFoundException(`Bucket ${name} not found`)
    }
    return rec
  }

  /** GET /system/storage/buckets — 桶列表 (内存 + seed, 按当前租户过滤) */
  listBuckets(): StorageBucketDto[] {
    const tenantId = this.currentTenant()
    return [...this.buckets.values()]
      .filter((rec) => rec.tenantId === tenantId)
      .map((rec) => this.toBucketDto(rec))
  }

  /** POST /system/storage/buckets — 创建桶 (非 default 租户自动加前缀, 校验租户归属) */
  createBucket(dto: { name: string; provider: 'local' | 's3' | 'minio'; region: string }): StorageBucketDto {
    const tenantId = this.currentTenant()
    const rawName = dto.name.trim()
    this.assertNoForeignTenantPrefix(rawName, tenantId)
    const name = (this.tenantBucketPrefix(tenantId) + rawName).slice(0, 63)
    if (this.buckets.has(name)) {
      throw new BadRequestException(`Bucket ${name} already exists`)
    }
    const now = new Date()
    const rec: BucketRecord = {
      name,
      provider: dto.provider,
      region: dto.region.trim() || 'us-east-1',
      tenantId,
      objectCount: 0,
      usedBytes: 0,
      createdAt: now.toISOString(),
      objects: [],
    }
    this.buckets.set(name, rec)
    this.logger.log(`Bucket created: ${name} (${rec.provider}/${rec.region}, tenant=${tenantId})`)
    return this.toBucketDto(rec)
  }

  /** DELETE /system/storage/buckets/:name — 删除桶 */
  deleteBucket(name: string): { deleted: string } {
    const rec = this.getBucketOrThrow(name)
    this.buckets.delete(rec.name)
    this.logger.log(`Bucket deleted: ${rec.name} (tenant=${rec.tenantId})`)
    return { deleted: rec.name }
  }

  /** GET /system/storage/buckets/:name/objects — 对象列表 */
  listBucketObjects(name: string): StorageObjectDto[] {
    return this.getBucketOrThrow(name).objects.map((o) => ({ ...o }))
  }

  /** POST /system/storage/buckets/:name/upload — 模拟上传 (仅注册元数据) */
  uploadObject(name: string, dto: { key: string; size: number }): StorageObjectDto {
    const rec = this.getBucketOrThrow(name)
    // 模拟上传: 键名单段化 (兼容 URL 参数), 同名覆盖
    const key = dto.key.trim().replace(/[/\\]/g, '-').replace(/^\.+/, '')
    if (!key) throw new BadRequestException('Object key 必填')
    const existing = rec.objects.find((o) => o.key === key)
    if (existing) {
      existing.size = dto.size
      existing.modified = new Date().toISOString()
      return { ...existing }
    }
    const obj: StorageObjectDto = {
      key,
      size: dto.size,
      modified: new Date().toISOString(),
    }
    rec.objects.push(obj)
    return { ...obj }
  }

  /**
   * [G005 v3.0.6.11-99 Wave 7A (G-28)] POST /system/storage/buckets/:name/batch-delete
   * 批量删除对象 (等价 S3 POST ?delete / AWS SDK DeleteObjectsCommand),
   * 内存模拟执行, source=simulated 标注。
   */
  batchDeleteObjects(name: string, keys: string[]): BatchDeleteResultDto {
    const rec = this.getBucketOrThrow(name)
    const wanted = new Set(keys)
    const deleted: string[] = []
    const missing: string[] = []
    rec.objects = rec.objects.filter((o) => {
      if (wanted.has(o.key)) {
        deleted.push(o.key)
        return false
      }
      return true
    })
    for (const k of keys) {
      if (!deleted.includes(k)) missing.push(k)
    }
    this.logger.log(`Objects batch-deleted from ${name}: ${deleted.length} deleted, ${missing.length} missing`)
    return { bucket: name, deleted, missing, source: 'simulated' }
  }

  /**
   * [G005 v3.0.6.11-99 Wave 7A (G-28)] POST /system/storage/buckets/:name/copy
   * 对象跨桶复制 (等价 S3 PUT + x-amz-copy-source / AWS SDK CopyObjectCommand),
   * 内存模拟执行, 同名覆盖, source=simulated 标注。
   */
  copyObject(name: string, dto: { key: string; targetBucket: string }): CopyObjectResultDto {
    const src = this.getBucketOrThrow(name)
    const obj = src.objects.find((o) => o.key === dto.key)
    if (!obj) throw new NotFoundException(`Object ${name}/${dto.key} not found`)
    const dst = this.getBucketOrThrow(dto.targetBucket)
    if (dst.name === src.name) {
      throw new BadRequestException('目标桶不能与源桶相同')
    }
    const copy: StorageObjectDto = { key: dto.key, size: obj.size, modified: new Date().toISOString() }
    const existing = dst.objects.find((o) => o.key === dto.key)
    if (existing) {
      existing.size = copy.size
      existing.modified = copy.modified
    } else {
      dst.objects.push(copy)
    }
    this.logger.log(`Object copied: ${src.name}/${dto.key} → ${dst.name}/${dto.key}`)
    return {
      key: copy.key,
      targetBucket: dst.name,
      size: copy.size,
      modified: copy.modified,
      copied: true,
      source: 'simulated',
    }
  }

  // ═══════════ [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL ═══════════

  /**
   * GET /system/storage/buckets/:name/objects/:key/signed-url
   * 生成带过期时间的下载签名 URL。
   * - 有效 S3 配置 (STORAGE_DRIVER=s3 + 保存配置): 真实 SigV4 预签名 (source=aws-sigv4-native)
   * - 其余场景: 本地模拟生成同构 URL 字符串 (source=simulated), 不发起网络请求
   */
  async generateSignedUrl(name: string, key: string, expiresInSec = 3600): Promise<SignedUrlDto> {
    const rec = this.getBucketOrThrow(name)
    const obj = rec.objects.find((o) => o.key === key)
    if (!obj) throw new NotFoundException(`Object ${name}/${key} not found`)
    const expires = Number.isFinite(expiresInSec) && expiresInSec > 0 ? Math.min(604_800, Math.floor(expiresInSec)) : 3600
    const expiresAt = new Date(Date.now() + expires * 1000)
    const effective = await this.resolveEffective()
    if (effective?.driver === 's3' && effective.endpoint && effective.accessKey && effective.secretKey) {
      const driver = new S3StorageDriver(buildS3DriverOptions(effective, 10_000))
      const url = driver.presign(key, expires)
      return { bucket: name, key, url, expiresInSec: expires, expiresAt: expiresAt.toISOString(), source: 'aws-sigv4-native' }
    }
    // 本地模拟: AWS 预签名 URL 同构字符串 (accessKey 缺省用固定模拟凭证)
    const simKey = effective?.accessKey ?? 'G005SIMACCESS'
    const simRegion = effective?.region ?? rec.region ?? 'us-east-1'
    const simEndpoint = effective?.endpoint ?? `https://s3.${simRegion}.amazonaws.com`
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')
    const dateStamp = amzDate.slice(0, 8)
    const scope = `${dateStamp}/${simRegion}/s3/aws4_request`
    const signature = crypto
      .createHmac('sha256', `G005-SIM-SECRET-${rec.tenantId}`)
      .update(`${name}/${key}|${expires}|${amzDate}`)
      .digest('hex')
      .slice(0, 64)
    const qs = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(`${simKey}/${scope}`)}`,
      `X-Amz-Date=${amzDate}`,
      `X-Amz-Expires=${expires}`,
      `X-Amz-SignedHeaders=host`,
      `X-Amz-Signature=${signature}`,
    ].join('&')
    const url = `${simEndpoint.replace(/\/+$/, '')}/${name}/${encodeURIComponent(key)}?${qs}`
    return { bucket: name, key, url, expiresInSec: expires, expiresAt: expiresAt.toISOString(), source: 'simulated' }
  }

  // ═══════════ [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制 (内存队列 + 状态) ═══════════

  private nextReplicationId(): string {
    this.replicationSeq += 1
    return `rep-${String(this.replicationSeq).padStart(3, '0')}`
  }

  /**
   * POST /system/storage/buckets/:name/replicate
   * 将桶内全部对象复制到目标桶并标注目标区域 (跨区复制任务)。
   * 内存队列: 入队后立即排空 (模拟快速处理), 任务记录保留 queued→running→completed 状态轨迹。
   */
  replicateBucket(name: string, dto: { targetBucket: string; region: string }): ReplicationTaskDto {
    const target = dto.targetBucket?.trim()
    const region = dto.region?.trim()
    if (!target) throw new BadRequestException('targetBucket 必填')
    if (!region) throw new BadRequestException('region 必填')
    const src = this.getBucketOrThrow(name)
    if (target === src.name) {
      throw new BadRequestException('目标桶不能与源桶相同')
    }
    const dst = this.getBucketOrThrow(target)
    const snapshot = src.objects.map((o) => ({ ...o }))
    const bytesTotal = snapshot.reduce((s, o) => s + o.size, 0)
    const now = new Date().toISOString()
    const task: ReplicationTaskDto = {
      id: this.nextReplicationId(),
      sourceBucket: src.name,
      targetBucket: dst.name,
      region,
      status: 'queued',
      progress: 0,
      objectsTotal: snapshot.length,
      objectsCopied: 0,
      bytesTotal,
      bytesCopied: 0,
      createdAt: now,
      source: 'simulated',
    }
    this.replicationTasks.set(task.id, task)
    this.logger.log(`Replication queued: ${task.id} (${src.name} → ${dst.name} @ ${region})`)
    // 排空队列 (模拟跨区复制完成)
    task.status = 'running'
    task.progress = 50
    task.startedAt = new Date().toISOString()
    for (const obj of snapshot) {
      const existing = dst.objects.find((o) => o.key === obj.key)
      if (existing) {
        existing.size = obj.size
        existing.modified = obj.modified
      } else {
        dst.objects.push({ ...obj })
      }
    }
    task.objectsCopied = snapshot.length
    task.bytesCopied = bytesTotal
    task.status = 'completed'
    task.progress = 100
    task.finishedAt = new Date().toISOString()
    this.logger.log(`Replication completed: ${task.id} (${snapshot.length} 对象, ${bytesTotal} bytes)`)
    return { ...task }
  }

  /** GET /system/storage/replication-status — 复制任务队列状态 */
  getReplicationStatus(): ReplicationStatusDto {
    const tasks = [...this.replicationTasks.values()]
      .sort((a, b) => b.id.localeCompare(a.id))
      .map((t) => ({ ...t }))
    const count = (s: ReplicationStatus) => tasks.filter((t) => t.status === s).length
    return {
      tasks,
      pending: count('queued'),
      running: count('running'),
      completed: count('completed'),
      failed: count('failed'),
      queueDepth: tasks.filter((t) => t.status === 'queued' || t.status === 'running').length,
      lastUpdatedAt: new Date().toISOString(),
    }
  }

  // ═══════════ [G005 v3.0.6.11-100 Wave 3B (G-28)] 存储监控指标 ═══════════

  /**
   * GET /system/storage/monitoring — 存储监控大屏数据
   * 从 buckets/对象派生 (source=derived), 容量/增长率为 seed 回退 (source=seed)。
   */
  getMonitoring(): StorageMonitoringDto {
    const tenantId = this.currentTenant()
    const tenantBuckets = [...this.buckets.values()].filter((rec) => rec.tenantId === tenantId)
    const totalUsedBytes = tenantBuckets.reduce((s, b) => s + this.toBucketDto(b).usedBytes, 0)
    const objectsTotal = tenantBuckets.reduce((s, b) => s + b.objects.length, 0)
    const capacitySeed = Number(this.config.get<string>('STORAGE_CAPACITY_BYTES', '0'))
    const growthSeed = Number(this.config.get<string>('STORAGE_GROWTH_PCT_30D', '4.2'))
    const derived = totalUsedBytes > 0
    const totalCapacityBytes = capacitySeed > 0 ? capacitySeed : derived ? Math.ceil(totalUsedBytes / 0.72) : 6_500_000_000
    const usedPercent = totalCapacityBytes > 0 ? Number(((totalUsedBytes / totalCapacityBytes) * 100).toFixed(1)) : 0
    const buckets: BucketUsageMetricDto[] = tenantBuckets
      .map((rec) => {
        const dto = this.toBucketDto(rec)
        return {
          name: dto.name,
          provider: dto.provider,
          region: dto.region,
          objectCount: dto.objectCount,
          usedBytes: dto.usedBytes,
          percentOfTotal: totalUsedBytes > 0 ? Number(((dto.usedBytes / totalUsedBytes) * 100).toFixed(1)) : 0,
        }
      })
      .sort((a, b) => b.usedBytes - a.usedBytes)
    // 30 天趋势: 按 30 天均增率从当前已用反推 (末位为当前真实值)
    const history: Array<{ date: string; usedBytes: number; capacityBytes: number }> = []
    const growthRatePct30d = Number.isFinite(growthSeed) && growthSeed > 0 ? growthSeed : 4.2
    const perDayFactor = Math.pow(1 + growthRatePct30d / 100, 1 / 30)
    for (let i = 29; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86_400_000)
      const usedBytes = i === 0 ? totalUsedBytes : Math.round(totalUsedBytes / Math.pow(perDayFactor, i))
      history.push({ date: d.toISOString().slice(0, 10), usedBytes, capacityBytes: totalCapacityBytes })
    }
    const ioBase = derived ? objectsTotal / 24 : 42_800
    const ioCounts: IoCountsDto = {
      readPerMin: Math.round(ioBase * 0.18 * 100) / 100,
      writePerMin: Math.round(ioBase * 0.06 * 100) / 100,
      putPerMin: Math.round(Math.max(0.1, derived ? objectsTotal / 1440 : 12.4) * 100) / 100,
      deletePerMin: Math.round(Math.max(0.1, derived ? objectsTotal / 14400 : 3.1) * 100) / 100,
      derived,
    }
    const tasks = [...this.replicationTasks.values()]
    return {
      totalCapacityBytes,
      totalUsedBytes,
      usedPercent,
      growthRatePct30d: Number(growthRatePct30d.toFixed(1)),
      objectsTotal,
      buckets,
      ioCounts,
      replication: {
        pending: tasks.filter((t) => t.status === 'queued').length,
        running: tasks.filter((t) => t.status === 'running').length,
        completed: tasks.filter((t) => t.status === 'completed').length,
        failed: tasks.filter((t) => t.status === 'failed').length,
        pendingBytes: tasks.filter((t) => t.status === 'queued' || t.status === 'running').reduce((s, t) => s + t.bytesTotal, 0),
      },
      history,
      source: derived ? 'derived' : 'seed',
    }
  }

  // ═══════════ [G005 v3.0.6.11-99 Wave 7A (G-28)] 对象生命周期策略 ═══════════

  private toLifecycleDto(rec: LifecyclePolicyRecord): LifecyclePolicyDto {
    return { ...rec }
  }

  private getPolicyOrThrow(id: string): LifecyclePolicyRecord {
    const rec = this.lifecyclePolicies.get(id)
    if (!rec) throw new NotFoundException(`Lifecycle policy ${id} not found`)
    if (rec.tenantId !== this.currentTenant()) {
      throw new NotFoundException(`Lifecycle policy ${id} not found`)
    }
    return rec
  }

  /** GET /system/storage/lifecycle-policies — 策略列表 (按当前租户过滤) */
  listLifecyclePolicies(): LifecyclePolicyDto[] {
    const tenantId = this.currentTenant()
    return [...this.lifecyclePolicies.values()]
      .filter((rec) => rec.tenantId === tenantId)
      .sort((a, b) => a.bucket.localeCompare(b.bucket) || a.afterDays - b.afterDays)
      .map((rec) => this.toLifecycleDto(rec))
  }

  /** POST /system/storage/lifecycle-policies — 新建策略 */
  createLifecyclePolicy(dto: LifecyclePolicyInput): LifecyclePolicyDto {
    if (dto.deleteAfterDays !== undefined && dto.deleteAfterDays !== null && dto.deleteAfterDays < dto.afterDays) {
      throw new BadRequestException('deleteAfterDays 必须 ≥ afterDays')
    }
    this.getBucketOrThrow(dto.bucket)
    const now = new Date()
    const rec: LifecyclePolicyRecord = {
      id: this.nextLifecycleId(),
      bucket: dto.bucket,
      prefix: dto.prefix?.trim() ?? '',
      transitionTo: dto.transitionTo,
      afterDays: dto.afterDays,
      deleteAfterDays: dto.deleteAfterDays === null ? undefined : dto.deleteAfterDays,
      enabled: dto.enabled ?? true,
      tenantId: this.currentTenant(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    }
    this.lifecyclePolicies.set(rec.id, rec)
    this.logger.log(`Lifecycle policy created: ${rec.id} (${rec.bucket}/${rec.prefix || '*'})`)
    return this.toLifecycleDto(rec)
  }

  /** PATCH /system/storage/lifecycle-policies/:id — 更新策略 (含启用开关) */
  updateLifecyclePolicy(id: string, dto: Partial<LifecyclePolicyInput>): LifecyclePolicyDto {
    const rec = this.getPolicyOrThrow(id)
    const afterDays = dto.afterDays ?? rec.afterDays
    const deleteAfterDays = dto.deleteAfterDays !== undefined ? (dto.deleteAfterDays === null ? undefined : dto.deleteAfterDays) : rec.deleteAfterDays
    if (deleteAfterDays !== undefined && deleteAfterDays < afterDays) {
      throw new BadRequestException('deleteAfterDays 必须 ≥ afterDays')
    }
    if (dto.bucket !== undefined && dto.bucket !== rec.bucket) {
      this.getBucketOrThrow(dto.bucket)
    }
    rec.bucket = dto.bucket?.trim() ?? rec.bucket
    rec.prefix = dto.prefix?.trim() ?? rec.prefix
    rec.transitionTo = dto.transitionTo ?? rec.transitionTo
    rec.afterDays = afterDays
    rec.deleteAfterDays = deleteAfterDays
    rec.enabled = dto.enabled ?? rec.enabled
    rec.updatedAt = new Date().toISOString()
    return this.toLifecycleDto(rec)
  }

  /** DELETE /system/storage/lifecycle-policies/:id — 删除策略 */
  deleteLifecyclePolicy(id: string): { deleted: string } {
    const rec = this.getPolicyOrThrow(id)
    this.lifecyclePolicies.delete(rec.id)
    this.logger.log(`Lifecycle policy deleted: ${rec.id}`)
    return { deleted: rec.id }
  }

  /** GET /system/storage/buckets/:name/objects/:key/download — Blob 模拟下载 */
  downloadObject(name: string, key: string): StorageDownloadDto {
    const rec = this.getBucketOrThrow(name)
    const obj = rec.objects.find((o) => o.key === key)
    if (!obj) throw new NotFoundException(`Object ${name}/${key} not found`)
    const contentType = key.endsWith('.json')
      ? 'application/json'
      : key.endsWith('.pdf')
        ? 'application/pdf'
        : key.endsWith('.png')
          ? 'image/png'
          : key.endsWith('.zip')
            ? 'application/zip'
            : 'application/octet-stream'
    const content = JSON.stringify(
      {
        bucket: name,
        key: obj.key,
        size: obj.size,
        modified: obj.modified,
        simulated: true,
        message: 'G005 模拟下载对象 (云端存储 → 本地 Blob)',
      },
      null,
      2,
    )
    return {
      key: obj.key,
      size: obj.size,
      contentType,
      filename: obj.key,
      contentBase64: Buffer.from(content, 'utf8').toString('base64'),
    }
  }

  private async resolveEffective(): Promise<StorageConfigDto | null> {
    try {
      return await this.configService.effectiveDriver()
    } catch {
      return null
    }
  }

  // ═══════════ [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 存储容量阈值预警 ═══════════

  getAlertsConfig(): StorageAlertsConfig {
    return { ...this.alertsConfig }
  }

  updateAlertsConfig(dto: Partial<StorageAlertsConfig>): StorageAlertsConfig {
    this.alertsConfig = {
      warnPercent: dto.warnPercent ?? this.alertsConfig.warnPercent,
      criticalPercent: dto.criticalPercent ?? this.alertsConfig.criticalPercent,
      notifyChannels: dto.notifyChannels ?? this.alertsConfig.notifyChannels,
    }
    if (this.alertsConfig.warnPercent > this.alertsConfig.criticalPercent) {
      this.alertsConfig = {
        ...this.alertsConfig,
        warnPercent: this.alertsConfig.criticalPercent,
      }
    }
    this.logger.log(
      `Storage alerts config updated: warn=${this.alertsConfig.warnPercent}% critical=${this.alertsConfig.criticalPercent}% channels=${this.alertsConfig.notifyChannels.join(',')}`,
    )
    return { ...this.alertsConfig }
  }

  private resolveLocalRoot(): string {
    const cwd = process.cwd()
    const root = cwd.includes(`${path.sep}backend`) ? cwd : path.join(cwd, 'backend')
    return process.env['VNA_STORAGE_DIR']?.trim() || path.join(root, 'vna-storage')
  }
}
