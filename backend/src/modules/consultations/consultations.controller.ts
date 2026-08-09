import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ConsultationsService } from './consultations.service'

// [G005 Wave1A] 会诊模块 (前端 consultationApi 全部方法 + comments/replies/invite/start/stats)

const CreateConsultationSchema = z.object({
  examId: z.string().optional(),
  patientId: z.string().optional(),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  bodyPart: z.string().optional(),
  type: z.string().optional(),
  consultationType: z.string().optional(),
  isRemote: z.boolean().optional(),
  requestingDepartment: z.string().optional(),
  consultedDepartment: z.string().optional(),
  consultedDoctorName: z.string().optional(),
  requestReason: z.string().optional(),
  priority: z.string().optional(),
  urgency: z.string().optional(),
  requestedBy: z.string().optional(),
  consultant: z.string().optional(),
  consultants: z.array(z.string()).optional(),
  participants: z.array(z.string()).optional(),
  notes: z.string().optional(),
})

const UpdateConsultationSchema = CreateConsultationSchema.partial()

const CommentSchema = z.object({
  author: z.string().min(1),
  content: z.string().min(1),
})

const InviteSchema = z.object({
  doctorIds: z.array(z.string().min(1)).min(1),
})

const CompleteSchema = z.object({ notes: z.string().optional() })

@ApiTags('consultations')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN', 'NURSE')
@Controller('consultations')
export class ConsultationsController {
  constructor(private readonly service: ConsultationsService) {}

  @Get()
  @ApiOperation({ summary: '会诊列表 (Report 状态派生)' })
  list(@Query('status') status?: string, @Query('priority') priority?: string) {
    return this.service.list({ status, priority })
  }

  @Post()
  @ApiOperation({ summary: '创建会诊' })
  create(@Body(new ZodValidationPipe(CreateConsultationSchema)) body: z.infer<typeof CreateConsultationSchema>) {
    return this.service.create(body)
  }

  @Get('pending')
  @ApiOperation({ summary: '待会诊列表' })
  getPending() {
    return this.service.getPending()
  }

  @Get('stats')
  @ApiOperation({ summary: '会诊统计' })
  getStats() {
    return this.service.getStats()
  }

  @Get('by-patient/:patientId')
  @ApiOperation({ summary: '按患者查询会诊' })
  getByPatient(@Param('patientId') patientId: string) {
    return this.service.getByPatient(patientId)
  }

  @Get('by-doctor/:doctorId')
  @ApiOperation({ summary: '按医生查询会诊' })
  getByDoctor(@Param('doctorId') doctorId: string) {
    return this.service.getByDoctor(doctorId)
  }

  @Get(':id/comments')
  @ApiOperation({ summary: '会诊讨论评论列表' })
  listComments(@Param('id') id: string) {
    return this.service.listComments(id)
  }

  @Post(':id/comments')
  @ApiOperation({ summary: '发表会诊评论' })
  addComment(@Param('id') id: string, @Body(new ZodValidationPipe(CommentSchema)) body: z.infer<typeof CommentSchema>) {
    return this.service.addComment(id, body.author, body.content)
  }

  @Post(':id/comments/:commentId/reply')
  @ApiOperation({ summary: '回复评论' })
  replyComment(
    @Param('id') id: string,
    @Param('commentId') commentId: string,
    @Body(new ZodValidationPipe(CommentSchema)) body: z.infer<typeof CommentSchema>,
  ) {
    return this.service.replyComment(id, commentId, body.author, body.content)
  }

  @Post(':id/invite')
  @ApiOperation({ summary: '邀请会诊专家' })
  invite(@Param('id') id: string, @Body(new ZodValidationPipe(InviteSchema)) body: z.infer<typeof InviteSchema>) {
    return this.service.invite(id, body.doctorIds)
  }

  @Post(':id/start')
  @ApiOperation({ summary: '开始会诊' })
  start(@Param('id') id: string) {
    return this.service.start(id)
  }

  @Post(':id/complete')
  @ApiOperation({ summary: '完成会诊' })
  complete(@Param('id') id: string, @Body(new ZodValidationPipe(CompleteSchema)) body: z.infer<typeof CompleteSchema>) {
    return this.service.complete(id, body.notes)
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: '取消会诊' })
  cancel(@Param('id') id: string) {
    return this.service.cancel(id)
  }

  @Put(':id')
  @ApiOperation({ summary: '更新会诊' })
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateConsultationSchema)) body: z.infer<typeof UpdateConsultationSchema>) {
    return this.service.update(id, body)
  }

  @Get(':id')
  @ApiOperation({ summary: '会诊详情' })
  getById(@Param('id') id: string) {
    return this.service.getById(id)
  }
}
