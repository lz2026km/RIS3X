/**
 * G005 放射RIS系统 v3.0.6.11-92 Wave3A (P2) - 急诊通道管理控制器 (PACS 急诊通道)
 * 端点:
 * - GET  /emergency-channel/config            通道配置
 * - PUT  /emergency-channel/config            保存通道配置 (body: { channels[], autoTrigger })
 * - GET  /emergency-channel/records           触发记录列表 (patientId/status 过滤)
 * - POST /emergency-channel/trigger           创建触发记录 + 模拟通知 (body: { patientId, type, reason })
 */
import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EmergencyChannelService } from './emergency-channel.service'

const ChannelItemSchema = z.object({
  type: z.enum(['sms', 'phone', 'in-app', 'wechat', 'email', 'pager']),
  enabled: z.boolean().default(true),
  priority: z.number().int().min(1).max(99).default(1),
  targetRole: z.string().min(1).max(40).optional(),
})

const UpdateConfigSchema = z.object({
  channels: z.array(ChannelItemSchema).min(1).optional(),
  autoTrigger: z
    .object({
      enabled: z.boolean().default(false),
      keywords: z.array(z.string().min(1).max(40)).max(50).default([]),
    })
    .optional(),
})

const TriggerSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().optional(),
  type: z.enum(['critical-finding', 'stat-imaging', 'icu-request', 'er-request', 'manual']).default('manual'),
  reason: z.string().min(5, 'reason 至少 5 个字符'),
  triggeredBy: z.string().optional(),
})

const ListRecordsQuerySchema = z.object({
  patientId: z.string().optional(),
  status: z.enum(['sent', 'acknowledged', 'completed']).optional(),
})

function parseListQuery(query: Record<string, unknown>): z.infer<typeof ListRecordsQuerySchema> {
  const parsed = ListRecordsQuerySchema.safeParse(query)
  return parsed.success ? parsed.data : {}
}

@ApiTags('emergency-channel')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('emergency-channel')
export class EmergencyChannelController {
  constructor(private readonly service: EmergencyChannelService) {}

  @Get('config')
  getConfig() {
    return this.service.getConfig()
  }

  @Put('config')
  updateConfig(@Body(new ZodValidationPipe(UpdateConfigSchema)) body: z.infer<typeof UpdateConfigSchema>) {
    return this.service.updateConfig(body)
  }

  @Get('records')
  listRecords(@Query() query: Record<string, unknown>) {
    return this.service.listRecords(parseListQuery(query))
  }

  @Post('trigger')
  trigger(@Body(new ZodValidationPipe(TriggerSchema)) body: z.infer<typeof TriggerSchema>) {
    return this.service.trigger(body)
  }

  @Post('records/:id/acknowledge')
  acknowledge(@Param('id') id: string) {
    return this.service.acknowledge(id)
  }
}
