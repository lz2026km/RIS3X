/**
 * G005 RIS v3.0.6.11-60 - System Storage Config Controller
 * GET/PUT /system/storage-config, POST /system/storage-config/test
 */
import { Body, Controller, Get, Post, Put } from '@nestjs/common'
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
}
