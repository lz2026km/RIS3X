/**
 * G005 放射RIS系统 v3.0.6.11-104 Wave 3C (临床反馈闭环) - 控制器
 * 端点 (孤儿模块可无 DB 启动, seed 回退):
 *   - POST /clinical-feedback                    临床医生提交报告异议/补充/更正
 *   - GET  /clinical-feedback                    列表 (状态/报告/科室/类型筛选 + 分页)
 *   - GET  /clinical-feedback/meta               类型/状态/流转元数据
 *   - GET  /clinical-feedback/:id                反馈详情
 *   - POST /clinical-feedback/:id/respond        放射科回应 (SUBMITTED → RESPONDED)
 *   - POST /clinical-feedback/:id/resolve        关闭 (RESPONDED → RESOLVED, 可关联 amendId)
 *   - POST /clinical-feedback/:id/reject         驳回 (SUBMITTED/RESPONDED → REJECTED)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import {
  ClinicalFeedbackService,
  FEEDBACK_TYPES,
  FEEDBACK_STATUSES,
  type CreateFeedbackInput,
  type RespondFeedbackInput,
  type ResolveFeedbackInput,
  type RejectFeedbackInput,
} from './clinical-feedback.service'

const CreateFeedbackSchema = z.object({
  reportId: z.string().min(1).max(64),
  patientId: z.string().max(64).optional(),
  patientName: z.string().max(64).optional(),
  examId: z.string().max(64).optional(),
  type: z.enum(FEEDBACK_TYPES as [string, ...string[]]),
  content: z.string().min(1).max(5000),
  submittedBy: z.string().min(1).max(64),
  department: z.string().min(1).max(64),
})

const RespondSchema = z.object({
  content: z.string().min(1).max(5000),
  responder: z.string().min(1).max(64),
  department: z.string().max(64).optional(),
})

const ResolveSchema = z.object({
  content: z.string().max(5000).optional(),
  resolver: z.string().min(1).max(64),
  amendId: z.string().max(64).optional(),
})

const RejectSchema = z.object({
  reason: z.string().min(1).max(5000),
  resolver: z.string().min(1).max(64),
})

const ListQuerySchema = z.object({
  status: z.enum(FEEDBACK_STATUSES as [string, ...string[]]).optional(),
  reportId: z.string().max(64).optional(),
  department: z.string().max(64).optional(),
  type: z.enum(FEEDBACK_TYPES as [string, ...string[]]).optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
})

@ApiTags('clinical-feedback')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('clinical-feedback')
export class ClinicalFeedbackController {
  constructor(private readonly service: ClinicalFeedbackService) {}

  @Post()
  @HttpCode(200)
  create(@Body(new ZodValidationPipe(CreateFeedbackSchema)) body: CreateFeedbackInput) {
    return { success: true, data: this.service.create(body) }
  }

  @Get()
  list(@Query(new ZodValidationPipe(ListQuerySchema)) query: z.infer<typeof ListQuerySchema>) {
    return { success: true, data: this.service.list(query) }
  }

  @Get('meta')
  meta() {
    return { success: true, data: this.service.getMeta() }
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return { success: true, data: this.service.get(id) }
  }

  @Post(':id/respond')
  @HttpCode(200)
  respond(@Param('id') id: string, @Body(new ZodValidationPipe(RespondSchema)) body: RespondFeedbackInput) {
    return { success: true, data: this.service.respond(id, body) }
  }

  @Post(':id/resolve')
  @HttpCode(200)
  resolve(@Param('id') id: string, @Body(new ZodValidationPipe(ResolveSchema)) body: ResolveFeedbackInput) {
    return { success: true, data: this.service.resolve(id, body) }
  }

  @Post(':id/reject')
  @HttpCode(200)
  reject(@Param('id') id: string, @Body(new ZodValidationPipe(RejectSchema)) body: RejectFeedbackInput) {
    return { success: true, data: this.service.reject(id, body) }
  }
}
