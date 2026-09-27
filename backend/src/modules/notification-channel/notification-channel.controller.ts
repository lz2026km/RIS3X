/**
 * [G005 W12-PatientService] 通知渠道控制器 (短信 / 微信模板消息 / 电话语音)
 */
import { Body, Controller, Delete, Get, Param, Post, Put, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  NotificationChannelService,
  type DeliveryStatus,
  type NotificationChannel,
  type TemplateStatus,
} from './notification-channel.service'

const ChannelEnum = z.enum(['SMS', 'WECHAT_TEMPLATE', 'VOICE'])

const CreateTemplateSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  channel: ChannelEnum,
  title: z.string().optional(),
  content: z.string().min(1),
  variables: z.array(z.string()).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

const UpdateTemplateSchema = CreateTemplateSchema.partial()

const SendSchema = z.object({
  templateId: z.string().optional(),
  templateCode: z.string().optional(),
  channel: ChannelEnum.optional(),
  recipient: z.string().min(1),
  variables: z.record(z.union([z.string(), z.number()])).optional(),
  patientId: z.string().optional(),
})

const AppointmentReminderSchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().min(1),
  modality: z.string().min(1),
  scheduledAt: z.string().min(1),
  deviceName: z.string().optional(),
  recipient: z.string().min(1),
  channel: ChannelEnum.optional(),
})

const ReportReadySchema = z.object({
  patientId: z.string().optional(),
  patientName: z.string().min(1),
  examDate: z.string().min(1),
  modality: z.string().min(1),
  bodyPart: z.string().optional(),
  recipient: z.string().min(1),
  channel: ChannelEnum.optional(),
})

const CriticalAlertSchema = z.object({
  patientId: z.string().min(1),
  patientName: z.string().min(1),
  modality: z.string().min(1),
  criticalValue: z.string().min(1),
  recipient: z.string().min(1),
})

@ApiTags('notification-channel')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('notification-channel')
export class NotificationChannelController {
  constructor(private readonly service: NotificationChannelService) {}

  @Get('templates')
  listTemplates(@Query('channel') channel?: NotificationChannel, @Query('status') status?: TemplateStatus) {
    return this.service.listTemplates({ channel, status })
  }

  @Post('templates')
  createTemplate(@Body(new ZodValidationPipe(CreateTemplateSchema)) body: z.infer<typeof CreateTemplateSchema>) {
    return this.service.createTemplate(body)
  }

  @Get('templates/:id')
  getTemplate(@Param('id') id: string) {
    return this.service.getTemplate(id)
  }

  @Put('templates/:id')
  updateTemplate(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateTemplateSchema)) body: z.infer<typeof UpdateTemplateSchema>) {
    return this.service.updateTemplate(id, body)
  }

  @Delete('templates/:id')
  deleteTemplate(@Param('id') id: string) {
    return this.service.deleteTemplate(id)
  }

  @Get('logs')
  listLogs(
    @Query('status') status?: DeliveryStatus,
    @Query('channel') channel?: NotificationChannel,
    @Query('patientId') patientId?: string,
    @Query('templateCode') templateCode?: string,
  ) {
    return this.service.listLogs({ status, channel, patientId, templateCode })
  }

  @Post('logs/:id/retry')
  retry(@Param('id') id: string) {
    return this.service.retry(id)
  }

  @Get('stats')
  stats() {
    return this.service.stats()
  }

  @Post('send')
  send(@Body(new ZodValidationPipe(SendSchema)) body: z.infer<typeof SendSchema>) {
    return this.service.send(body)
  }

  @Post('notify/appointment-reminder')
  notifyAppointmentReminder(@Body(new ZodValidationPipe(AppointmentReminderSchema)) body: z.infer<typeof AppointmentReminderSchema>) {
    return this.service.notifyAppointmentReminder(body)
  }

  @Post('notify/report-ready')
  notifyReportReady(@Body(new ZodValidationPipe(ReportReadySchema)) body: z.infer<typeof ReportReadySchema>) {
    return this.service.notifyReportReady(body)
  }

  @Post('notify/critical-alert')
  notifyCriticalAlert(@Body(new ZodValidationPipe(CriticalAlertSchema)) body: z.infer<typeof CriticalAlertSchema>) {
    return this.service.notifyCriticalAlert(body)
  }
}
