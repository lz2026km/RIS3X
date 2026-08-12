/**
 * G005 RIS v3.0.6.11-60 - System Storage Config Controller
 * GET/PUT /system/storage-config, POST /system/storage-config/test
 */
import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common'
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
