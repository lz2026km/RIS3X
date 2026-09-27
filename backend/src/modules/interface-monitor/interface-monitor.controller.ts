/**
 * G005 放射RIS系统 v3.0.6.13 - 接口监控台 REST 端点
 *   GET  /interface-monitor/messages        消息日志 (type/status 过滤)
 *   POST /interface-monitor/messages        记录消息
 *   GET  /interface-monitor/stats           每接口统计
 *   GET  /interface-monitor/queue           重试队列 (status/type 过滤)
 *   POST /interface-monitor/queue           入队
 *   POST /interface-monitor/queue/process   处理到期队列 (退避重试)
 *   POST /interface-monitor/queue/:id/retry         重试
 *   POST /interface-monitor/queue/:id/dead-letter   移入死信
 *   POST /interface-monitor/queue/:id/requeue       死信重入
 *   GET  /interface-monitor/dead-letter     死信列表
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  InterfaceMonitorService,
  type InterfaceType,
  type MessageStatus,
  type QueueStatus,
} from './interface-monitor.service'

const InterfaceTypeEnum = z.enum(['HL7', 'FHIR', 'DICOM', 'ORU', 'XDS'])
const MessageStatusEnum = z.enum(['success', 'fail', 'retry', 'pending'])
const QueueStatusEnum = z.enum(['pending', 'retrying', 'success', 'dead_letter'])

const EnqueueSchema = z.object({
  interfaceType: InterfaceTypeEnum,
  endpoint: z.string().min(1),
  payload: z.record(z.unknown()).optional(),
  maxAttempts: z.number().int().positive().max(20).optional(),
})

const RecordMessageSchema = z.object({
  interfaceType: InterfaceTypeEnum,
  direction: z.enum(['INBOUND', 'OUTBOUND']),
  messageType: z.string().min(1),
  status: MessageStatusEnum,
  ackStatus: z.string().optional(),
  retryCount: z.number().int().nonnegative().optional(),
  patientId: z.string().optional(),
  endpoint: z.string().optional(),
  summary: z.string().optional(),
})

@ApiTags('interface-monitor')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'TECHNICIAN')
@Controller('interface-monitor')
export class InterfaceMonitorController {
  constructor(private readonly service: InterfaceMonitorService) {}

  @Get('messages')
  messages(
    @Query('interfaceType') interfaceType?: string,
    @Query('status') status?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.getMessages({
      interfaceType: interfaceType as InterfaceType | undefined,
      status: status as MessageStatus | undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('messages')
  recordMessage(@Body(new ZodValidationPipe(RecordMessageSchema)) body: {
    interfaceType: InterfaceType
    direction: 'INBOUND' | 'OUTBOUND'
    messageType: string
    status: MessageStatus
    ackStatus?: string
    retryCount?: number
    patientId?: string
    endpoint?: string
    summary?: string
  }) {
    return this.service.recordMessage({
      ...body,
      retryCount: body.retryCount ?? 0,
      summary: body.summary ?? body.messageType,
    })
  }

  @Get('stats')
  stats() {
    return this.service.getStats()
  }

  @Get('queue')
  queue(
    @Query('status') status?: string,
    @Query('interfaceType') interfaceType?: string,
    @Query('limit') limit?: string,
  ) {
    return this.service.listQueue({
      status: status as QueueStatus | undefined,
      interfaceType: interfaceType as InterfaceType | undefined,
      limit: limit ? Number(limit) : undefined,
    })
  }

  @Post('queue')
  enqueue(@Body(new ZodValidationPipe(EnqueueSchema)) body: {
    interfaceType: InterfaceType
    endpoint: string
    payload?: Record<string, unknown>
    maxAttempts?: number
  }) {
    return this.service.enqueue(body)
  }

  @Post('queue/process')
  process(@Query('now') now?: string) {
    return this.service.processDue(now)
  }

  @Post('queue/:id/retry')
  retry(@Param('id') id: string) {
    return this.service.retry(id)
  }

  @Post('queue/:id/dead-letter')
  deadLetter(@Param('id') id: string) {
    return this.service.deadLetter(id)
  }

  @Post('queue/:id/requeue')
  requeue(@Param('id') id: string) {
    return this.service.requeue(id)
  }

  @Get('dead-letter')
  deadLetters() {
    return { total: this.service.listDeadLetters().length, entries: this.service.listDeadLetters() }
  }
}
