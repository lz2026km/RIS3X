/**
 * G005 放射RIS系统 v3.0.6.11-80 - 危急值告警控制器 (W1-A, P0)
 * 端点:
 * - GET  /critical-alert            告警列表 (别名 /alerts)
 * - GET  /critical-alert/alerts     告警列表 (status/severity/alertType/page/pageSize)
 * - GET  /critical-alert/alerts/:id 告警详情
 * - GET  /critical-alert/stats      统计
 * - POST /critical-alert            创建告警 (body: { criticalValueId | level, ... })
 * - POST /critical-alert/alerts/:id/acknowledge 确认
 * - POST /critical-alert/alerts/:id/resolve     解决
 * - POST /critical-alert/alerts/:id/escalate    升级 (body: { assignee })
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { CriticalAlertService } from './critical-alert.service'

const ListQuerySchema = z.object({
  status: z.string().optional(),
  severity: z.string().optional(),
  alertType: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
})

const AcknowledgeSchema = z
  .object({
    comment: z.string().optional(),
  })
  .optional()

const ResolveSchema = z
  .object({
    resolution: z.string().min(1),
    comment: z.string().optional(),
  })
  .optional()

const EscalateSchema = z
  .object({
    assignee: z.string().min(1).optional(),
  })
  .optional()

const CreateAlertSchema = z.object({
  criticalValueId: z.string().min(1).optional(),
  level: z.enum(['info', 'warning', 'critical', 'emergency']).default('critical'),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  studyId: z.string().optional(),
  modality: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
})

function parseListQuery(query: Record<string, unknown>): z.infer<typeof ListQuerySchema> {
  const parsed = ListQuerySchema.safeParse(query)
  return parsed.success ? parsed.data : {}
}

@ApiTags('critical-alert')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('critical-alert')
export class CriticalAlertController {
  constructor(private readonly service: CriticalAlertService) {}

  @Get()
  listRoot(@Query() query: Record<string, unknown>) {
    return this.service.listAlerts(parseListQuery(query))
  }

  @Get('stats')
  getStats() {
    return this.service.stats()
  }

  @Get('alerts')
  listAlerts(@Query() query: Record<string, unknown>) {
    return this.service.listAlerts(parseListQuery(query))
  }

  @Get('alerts/:id')
  getAlert(@Param('id') id: string) {
    return this.service.getAlert(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateAlertSchema)) body: z.infer<typeof CreateAlertSchema>) {
    return this.service.create(body)
  }

  @Post('alerts/:id/acknowledge')
  acknowledge(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AcknowledgeSchema)) body?: z.infer<typeof AcknowledgeSchema>,
  ) {
    return this.service.acknowledge(id, body ?? {})
  }

  @Post('alerts/:id/resolve')
  resolve(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ResolveSchema)) body?: z.infer<typeof ResolveSchema>,
  ) {
    return this.service.resolve(id, body ?? {})
  }

  @Post('alerts/:id/escalate')
  escalate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(EscalateSchema)) body?: z.infer<typeof EscalateSchema>,
  ) {
    return this.service.escalate(id, body?.assignee)
  }
}
