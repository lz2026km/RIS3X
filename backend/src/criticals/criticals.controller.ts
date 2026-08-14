import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { CriticalsService, NotifyDto, EscalateDto, VoiceCallDto, ClinicalReceiptDto } from './criticals.service'

const ChannelEnum = z.enum(['SMS', 'WECHAT', 'PHONE', 'DINGTALK', 'APP', 'SYSTEM', 'EMAIL'])
const CategoryEnum = z.enum(['LIFE_THREATENING', 'URGENT', 'IMPORTANT'])

// 非必填字段由服务端从 criticalValue 记录带出(description→finding, severity→category),
// 前端仍建议补全 patientName/patientId/finding 等关键字段以提升通知质量。
const NotifySchema = z.object({
  criticalId: z.string().min(1),
  patientName: z.string().optional().default('未知患者'),
  patientId: z.string().optional().default(''),
  category: CategoryEnum.optional().default('URGENT'),
  finding: z.string().optional().default('危急值'),
  channels: z.array(ChannelEnum).min(1),
  recipientName: z.string().optional().default('临床医生'),
  recipientDept: z.string().optional().default('临床科室'),
  recipientPhone: z.string().optional().default(''),
})

const EscalateSchema = z.object({
  criticalId: z.string().min(1),
  reason: z.string().min(1),
  newRecipients: z.array(z.object({ name: z.string(), dept: z.string(), phone: z.string() })).min(1),
})

const VoiceCallSchema = z.object({
  calledBy: z.string().min(1),
  phoneNumber: z.string().min(1),
  note: z.string().optional(),
})

const ClinicalReceiptSchema = z.object({
  confirmedBy: z.string().min(1),
  confirmedAt: z.string().datetime().optional(),
  signature: z.string().optional(),
  comment: z.string().optional(),
})

const CreateCriticalSchema = z.object({
  examId: z.string().optional(),
  description: z.string().min(1),
  severity: z.enum(['LOW', 'HIGH', 'URGENT', 'CRITICAL']).default('HIGH'),
  method: z.enum(['PHONE', 'SMS', 'SYSTEM', 'EMAIL', 'WECHAT']).default('SYSTEM'),
})

const UpdateCriticalSchema = z.object({
  description: z.string().optional(),
  severity: z.enum(['LOW', 'HIGH', 'URGENT', 'CRITICAL']).optional(),
  state: z.enum(['FOUND', 'NOTIFIED', 'VOICE_CALLED', 'ACKNOWLEDGED', 'RECEIPTED', 'RESOLVING', 'RESOLVED', 'CLOSED_LOOP']).optional(),
  notifiedTo: z.string().optional(),
  ackedBy: z.string().optional(),
  resolvedBy: z.string().optional(),
  closedBy: z.string().optional(),
})

@ApiTags('criticals')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN')
@Controller('criticals')
export class CriticalsController {
  constructor(private readonly service: CriticalsService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('state') state?: string,
    @Query('severity') severity?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('patientId') patientId?: string,
  ) {
    return this.service.list({
      skip: Number(skip ?? 0),
      take: take === undefined || take === '' ? undefined : Number(take),
      state, severity, dateFrom, dateTo, patientId,
    })
  }

  @Get('stats')
  getStats() {
    return this.service.getStats()
  }

  @Get('stats/missed')
  getMissedStats() {
    return this.service.getMissedStats()
  }

  @Get('stats/notification')
  getNotificationStats() {
    return this.service.getNotificationStats()
  }

  @Get('value5step/list')
  getValue5StepList() {
    return this.service.getValue5StepList()
  }

  // [v3.0.6.11-99 Wave 10D] 危急值总览 (今日/未处置/超时) — 静态子路由先于 :id 注册
  @Get('overview')
  getOverview() {
    return this.service.getOverview()
  }

  // [v3.0.6.11-99 Wave 10D] 近 30 日危急值趋势
  @Get('daily-trend')
  getDailyTrend(@Query('days') days?: string) {
    return this.service.getDailyTrend(Number(days ?? 30))
  }

  // [v3.0.6.11-99 Wave 10D] 科室维度统计
  @Get('by-department')
  getByDepartment() {
    return this.service.getByDepartment()
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateCriticalSchema)) body: z.infer<typeof CreateCriticalSchema>) {
    return this.service.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateCriticalSchema)) body: z.infer<typeof UpdateCriticalSchema>) {
    return this.service.update(id, body)
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id)
  }

  @Post(':id/voice-call')
  voiceCall(@Param('id') id: string, @Body(new ZodValidationPipe(VoiceCallSchema)) body: VoiceCallDto) {
    return this.service.voiceCall(id, body)
  }

  @Post(':id/clinical-receipt')
  clinicalReceipt(@Param('id') id: string, @Body(new ZodValidationPipe(ClinicalReceiptSchema)) body: ClinicalReceiptDto) {
    return this.service.clinicalReceipt(id, body)
  }

  @Post('notify')
  notify(@Body(new ZodValidationPipe(NotifySchema)) body: NotifyDto) {
    return this.service.notify(body)
  }

  @Post('escalate')
  escalate(@Body(new ZodValidationPipe(EscalateSchema)) body: EscalateDto) {
    return this.service.escalate(body)
  }

  @Get(':criticalId/history')
  listHistory(@Param('criticalId') criticalId: string) {
    return this.service.listHistory(criticalId)
  }

  // [v3.0.6.11-99 Wave 10D] 危急值全流程时间线
  @Get(':id/timeline')
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id)
  }

  @Post(':id/escalation-chain')
  runEscalationChain(@Param('id') id: string) {
    return this.service.runEscalationChain(id)
  }
}
