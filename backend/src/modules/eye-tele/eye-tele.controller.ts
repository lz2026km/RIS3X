/**
 * [G005 Wave 10A] 眼科远程会诊桥接控制器 (@Controller('eye/tele'))
 * 对齐前端 eyeApi.tele 方法与 MSW eyeTeleconsultModule 形状。
 */
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { EyeTeleService } from './eye-tele.service'

const CreateSessionSchema = z.object({
  patientId: z.string().min(1),
  studyId: z.string().optional(),
  participants: z.array(z.string()).optional(),
  mode: z.enum(['video', 'screen', 'data']).optional(),
})

const CreateStreamSchema = z.object({
  studyId: z.string().min(1),
  targetHospital: z.string().optional(),
  protocol: z.enum(['wado', 'dicom-tls']).optional(),
})

const CreateConsultSchema = z.object({
  sessionId: z.string().optional(),
  specialistId: z.string().min(1),
  question: z.string().min(1),
  patientId: z.string().optional(),
  studyId: z.string().optional(),
  priority: z.enum(['normal', 'urgent']).optional(),
})

const AnswerConsultSchema = z.object({
  answer: z.string().min(1),
  reviewedBy: z.string().optional(),
})

@ApiTags('eye-tele')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('eye/tele')
export class EyeTeleController {
  constructor(private readonly service: EyeTeleService) {}

  // ── 网络 / 状态 ──

  /** GET /eye/tele/turn — 5G + TURN 网络配置 */
  @Get('turn')
  getTurn() {
    return { success: true, data: this.service.getTurn() }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }

  // ── 会诊会话 ──

  /** POST /eye/tele/session — 创建会诊 (复用 tele 模块 WebRTC 信令) */
  @Post('session')
  @HttpCode(HttpStatus.CREATED)
  createSession(@Body(new ZodValidationPipe(CreateSessionSchema)) body: z.infer<typeof CreateSessionSchema>) {
    return { success: true, data: this.service.createSession(body) }
  }

  /** GET /eye/tele/sessions — 会话列表 */
  @Get('sessions')
  listSessions(@Query('status') status?: string) {
    return { success: true, data: this.service.listSessions(status) }
  }

  /** GET /eye/tele/session/:sessionId — 会话详情 */
  @Get('session/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return { success: true, data: this.service.getSession(sessionId) }
  }

  /** DELETE /eye/tele/session/:sessionId — 结束会话 */
  @Delete('session/:sessionId')
  endSession(@Param('sessionId') sessionId: string) {
    return { success: true, data: this.service.endSession(sessionId) }
  }

  // ── 远程流 ──

  /** POST /eye/tele/stream — 跨院 DICOM 远程流 */
  @Post('stream')
  @HttpCode(HttpStatus.CREATED)
  createStream(@Body(new ZodValidationPipe(CreateStreamSchema)) body: z.infer<typeof CreateStreamSchema>) {
    return { success: true, data: this.service.createStream(body) }
  }

  /** GET /eye/tele/streams — 流状态列表 */
  @Get('streams')
  listStreams(@Query('status') status?: string) {
    return { success: true, data: this.service.listStreams(status) }
  }

  // ── 会诊意见 ──

  /** POST /eye/tele/consult — 会诊意见征集 */
  @Post('consult')
  @HttpCode(HttpStatus.CREATED)
  createConsult(@Body(new ZodValidationPipe(CreateConsultSchema)) body: z.infer<typeof CreateConsultSchema>) {
    return { success: true, data: this.service.createConsult(body) }
  }

  /** GET /eye/tele/consults — 会诊记录列表 */
  @Get('consults')
  listConsults(@Query('status') status?: string, @Query('specialistId') specialistId?: string) {
    return { success: true, data: this.service.listConsults({ status, specialistId }) }
  }

  /** GET /eye/tele/consult/:id — 会诊记录详情 */
  @Get('consult/:id')
  getConsult(@Param('id') id: string) {
    return { success: true, data: this.service.getConsult(id) }
  }

  /** POST /eye/tele/consult/:id/answer — 会诊意见答复 */
  @Post('consult/:id/answer')
  answerConsult(@Param('id') id: string, @Body(new ZodValidationPipe(AnswerConsultSchema)) body: z.infer<typeof AnswerConsultSchema>) {
    return { success: true, data: this.service.answerConsult(id, body) }
  }
}
