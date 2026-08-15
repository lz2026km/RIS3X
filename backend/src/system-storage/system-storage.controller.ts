/**
 * G005 RIS v3.0.6.11-60 - System Storage Config Controller
 * GET/PUT /system/storage-config, POST /system/storage-config/test
 */
import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { SystemStorageService } from './system-storage.service'

const StorageConfigSchema = z
  .object({
    driver: z.enum(['local', 's3']),
    endpoint: z.string().trim().url().optional(),
    bucket: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
    accessKey: z.string().trim().min(1).optional(),
    secretKey: z.string().trim().min(1).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.driver === 's3') {
      if (!v.endpoint) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'endpoint 必填' })
      if (!v.bucket) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'bucket 必填' })
      if (!v.accessKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'accessKey 必填' })
      if (!v.secretKey) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'secretKey 必填' })
    }
  })

const StorageTestSchema = z
  .object({
    driver: z.enum(['local', 's3']),
    endpoint: z.string().trim().url().optional(),
    bucket: z.string().trim().min(1).optional(),
    region: z.string().trim().min(1).optional(),
    accessKey: z.string().trim().min(1).optional(),
    secretKey: z.string().trim().min(1).optional(),
  })
  .optional()

// [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 存储容量阈值预警配置
const StorageAlertsConfigSchema = z
  .object({
    warnPercent: z.number().min(1).max(100),
    criticalPercent: z.number().min(1).max(100),
    notifyChannels: z.array(z.enum(['email', 'sms', 'wechat', 'dingtalk', 'app'])).min(1).max(5),
  })
  .superRefine((v, ctx) => {
    if (v.warnPercent >= v.criticalPercent) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['criticalPercent'], message: '严重阈值必须大于警告阈值' })
    }
  })

// [W5] 系统管理配置项: 数组 [ { key, value } ] 或 { configs: [...] } 两种形状均可
const AdminConfigItemSchema = z.object({ key: z.string().min(1), value: z.unknown() })
const AdminConfigsSaveSchema = z
  .union([
    z.array(AdminConfigItemSchema).min(1),
    z.object({ configs: z.array(AdminConfigItemSchema).min(1) }),
  ])
  .transform((v) => (Array.isArray(v) ? v : v.configs))

const AdminConfigValueSchema = z.object({ value: z.unknown() })

// [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理
const CreateBucketSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9.-]*[a-z0-9]$/i, '桶名仅允许字母/数字/点/中划线 (1-63 字符)'),
  provider: z.enum(['local', 's3', 'minio']).default('s3'),
  region: z.string().trim().min(1).default('us-east-1'),
})

const UploadObjectSchema = z.object({
  key: z.string().trim().min(1).max(255),
  size: z.number().int().nonnegative().max(10_737_418_240).default(1024),
})

// [G005 v3.0.6.11-99 Wave 7A (PACS P1 G-28)] 对象生命周期策略
const LifecycleTransitionTier = z.enum(['tier2', 'archive', 'backup'])

const LifecyclePolicyCreateSchema = z
  .object({
    bucket: z.string().trim().min(1).max(63),
    prefix: z.string().trim().max(255).optional().default(''),
    transitionTo: LifecycleTransitionTier,
    afterDays: z.number().int().min(1).max(3650),
    deleteAfterDays: z.number().int().min(1).max(36500).optional(),
    enabled: z.boolean().optional().default(true),
  })
  .superRefine((v, ctx) => {
    if (v.deleteAfterDays !== undefined && v.deleteAfterDays < v.afterDays) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deleteAfterDays'], message: '删除天数必须 ≥ 转存天数' })
    }
  })

const LifecyclePolicyPatchSchema = z
  .object({
    bucket: z.string().trim().min(1).max(63).optional(),
    prefix: z.string().trim().max(255).optional(),
    transitionTo: LifecycleTransitionTier.optional(),
    afterDays: z.number().int().min(1).max(3650).optional(),
    deleteAfterDays: z.number().int().min(1).max(36500).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.deleteAfterDays !== undefined && v.deleteAfterDays !== null && v.afterDays !== undefined && v.deleteAfterDays < v.afterDays) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['deleteAfterDays'], message: '删除天数必须 ≥ 转存天数' })
    }
  })

// [G005 v3.0.6.11-99 Wave 7A (PACS P1 G-28)] 对象批量操作
const BatchDeleteObjectsSchema = z.object({
  keys: z.array(z.string().trim().min(1).max(255)).min(1).max(1000),
})

const CopyObjectSchema = z.object({
  key: z.string().trim().min(1).max(255),
  targetBucket: z.string().trim().min(1).max(63),
})

// [G005 v3.0.6.11-100 Wave 3B (G-28)] 跨区复制任务
const ReplicateBucketSchema = z.object({
  targetBucket: z.string().trim().min(1).max(63),
  region: z.string().trim().min(1).max(63),
})

@ApiTags('system')
@ApiBearerAuth()
@Roles('ADMIN')
@Controller('system')
export class SystemStorageController {
  constructor(private readonly service: SystemStorageService) {}

  @Get('storage-config')
  get() {
    return this.service.getConfig()
  }

  @Put('storage-config')
  save(@Body(new ZodValidationPipe(StorageConfigSchema)) body: z.infer<typeof StorageConfigSchema>) {
    return this.service.saveConfig(body)
  }

  @Post('storage-config/test')
  test(@Body(new ZodValidationPipe(StorageTestSchema)) body?: z.infer<typeof StorageTestSchema>) {
    return this.service.testConnection(body)
  }

  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-2)] 存储容量阈值预警
  @Get('storage/alerts-config')
  getAlertsConfig() {
    return this.service.getAlertsConfig()
  }

  @Put('storage/alerts-config')
  saveAlertsConfig(@Body(new ZodValidationPipe(StorageAlertsConfigSchema)) body: z.infer<typeof StorageAlertsConfigSchema>) {
    return this.service.updateAlertsConfig(body)
  }

  // ═══════════ [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-28)] 云存储桶管理 ═══════════

  @Get('storage/buckets')
  listBuckets() {
    return this.service.listBuckets()
  }

  @Post('storage/buckets')
  createBucket(@Body(new ZodValidationPipe(CreateBucketSchema)) body: z.infer<typeof CreateBucketSchema>) {
    return this.service.createBucket(body)
  }

  @Delete('storage/buckets/:name')
  deleteBucket(@Param('name') name: string) {
    return this.service.deleteBucket(name)
  }

  @Get('storage/buckets/:name/objects')
  listBucketObjects(@Param('name') name: string) {
    return this.service.listBucketObjects(name)
  }

  @Post('storage/buckets/:name/upload')
  uploadObject(
    @Param('name') name: string,
    @Body(new ZodValidationPipe(UploadObjectSchema)) body: z.infer<typeof UploadObjectSchema>,
  ) {
    return this.service.uploadObject(name, body)
  }

  @Get('storage/buckets/:name/objects/:key/download')
  downloadObject(@Param('name') name: string, @Param('key') key: string) {
    return this.service.downloadObject(name, key)
  }

  // [G005 v3.0.6.11-99 Wave 7A (PACS P1 G-28)] 对象生命周期策略
  @Get('storage/lifecycle-policies')
  listLifecyclePolicies() {
    return this.service.listLifecyclePolicies()
  }

  @Post('storage/lifecycle-policies')
  createLifecyclePolicy(@Body(new ZodValidationPipe(LifecyclePolicyCreateSchema)) body: z.infer<typeof LifecyclePolicyCreateSchema>) {
    return this.service.createLifecyclePolicy(body)
  }

  @Patch('storage/lifecycle-policies/:id')
  updateLifecyclePolicy(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(LifecyclePolicyPatchSchema)) body: z.infer<typeof LifecyclePolicyPatchSchema>,
  ) {
    return this.service.updateLifecyclePolicy(id, body)
  }

  @Delete('storage/lifecycle-policies/:id')
  deleteLifecyclePolicy(@Param('id') id: string) {
    return this.service.deleteLifecyclePolicy(id)
  }

  // [G005 v3.0.6.11-99 Wave 7A (PACS P1 G-28)] 对象批量操作
  @Post('storage/buckets/:name/batch-delete')
  batchDeleteObjects(
    @Param('name') name: string,
    @Body(new ZodValidationPipe(BatchDeleteObjectsSchema)) body: z.infer<typeof BatchDeleteObjectsSchema>,
  ) {
    return this.service.batchDeleteObjects(name, body.keys)
  }

  @Post('storage/buckets/:name/copy')
  copyObject(
    @Param('name') name: string,
    @Body(new ZodValidationPipe(CopyObjectSchema)) body: z.infer<typeof CopyObjectSchema>,
  ) {
    return this.service.copyObject(name, body)
  }

  // ═══════════ [G005 v3.0.6.11-100 Wave 3B (G-28)] CDN 签名 URL + 跨区复制 + 监控 ═══════════

  /** GET /system/storage/buckets/:name/objects/:key/signed-url?expiresInSec=300 — CDN 签名下载 URL */
  @Get('storage/buckets/:name/objects/:key/signed-url')
  signedUrl(
    @Param('name') name: string,
    @Param('key') key: string,
    @Query('expiresInSec') expiresInSec?: string,
  ) {
    const expires = expiresInSec !== undefined ? Number(expiresInSec) : 3600
    return this.service.generateSignedUrl(name, key, Number.isFinite(expires) ? expires : 3600)
  }

  /** POST /system/storage/buckets/:name/replicate — 跨区复制任务 (内存队列 + 状态) */
  @Post('storage/buckets/:name/replicate')
  replicateBucket(
    @Param('name') name: string,
    @Body(new ZodValidationPipe(ReplicateBucketSchema)) body: z.infer<typeof ReplicateBucketSchema>,
  ) {
    return this.service.replicateBucket(name, body)
  }

  /** GET /system/storage/replication-status — 复制任务队列状态 */
  @Get('storage/replication-status')
  replicationStatus() {
    return this.service.getReplicationStatus()
  }

  /** GET /system/storage/monitoring — 存储监控指标 (容量/增长率/IO/复制队列, 桶派生 + seed 回退) */
  @Get('storage/monitoring')
  monitoring() {
    return this.service.getMonitoring()
  }

  @Get('admin/configs')
  listAdminConfigs() {
    return this.service.listAdminConfigs()
  }

  @Put('admin/configs')
  saveAdminConfigs(@Body(new ZodValidationPipe(AdminConfigsSaveSchema)) items: Array<{ key: string; value: unknown }>) {
    return this.service.saveAdminConfigs(items)
  }

  @Patch('admin/configs/:key')
  updateAdminConfig(
    @Param('key') key: string,
    @Body(new ZodValidationPipe(AdminConfigValueSchema)) body: { value: unknown },
  ) {
    return this.service.updateAdminConfig(key, body.value)
  }
}
