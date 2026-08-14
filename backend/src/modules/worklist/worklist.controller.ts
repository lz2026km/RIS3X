import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { WorklistService, WORKLIST_STATES, QC_STATES, type AssignDto, type WorklistListParams } from './worklist.service'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'

const CancelBodySchema = z.object({
  reason: z.string().max(500).optional(),
})

// [v3.0.6.11-92 Wave1B P0] 影像质控回写: PATCH /worklist/:id/state { state: IMAGE_READY|QC_REJECT|QC_PASS|IN_PROGRESS, note?, rating?, techNote?, qcNote? }
// [v3.0.6.11-95 Wave 1A] IN_PROGRESS = 重拍登记 (QC_REJECT → IN_PROGRESS); rating/备注随状态落库
const UpdateQcStateSchema = z.object({
  state: z.enum(QC_STATES),
  note: z.string().max(500).optional(),
  rating: z.string().max(16).optional(),
  techNote: z.string().max(500).optional(),
  qcNote: z.string().max(500).optional(),
})

const ListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
  status: z.enum(WORKLIST_STATES).optional(),
  modality: z.string().max(32).optional(),
  patientId: z.string().max(64).optional(),
  dateFrom: z.string().max(40).optional(),
  dateTo: z.string().max(40).optional(),
  search: z.string().max(128).optional(),
})

const UpdateWorklistSchema = z.object({
  status: z.enum(WORKLIST_STATES).optional(),
  state: z.enum(WORKLIST_STATES).optional(),
  // [v3.0.6.11-95 Wave 1A P0-3] 批量改优先级: ROUTINE/URGENT/STAT + 中文别名 (普通/紧急/危重)
  priority: z.enum(['ROUTINE', 'URGENT', 'STAT', '普通', '紧急', '危重']).optional(),
  // [v3.0.6.11-95 Wave 1A P1] 技师注释/质控备注/评级
  techNote: z.string().max(500).optional(),
  qcNote: z.string().max(500).optional(),
  rating: z.string().max(16).optional(),
  deviceId: z.string().max(64).nullable().optional(),
  bodyPart: z.string().max(128).optional(),
  modality: z.string().max(32).optional(),
  scheduledAt: z.string().max(40).nullable().optional(),
})

const AssignBodySchema = z.object({
  doctorId: z.string().max(64).optional(),
  deviceId: z.string().max(64).optional(),
})

const BatchAssignBodySchema = z.object({
  ids: z.array(z.string().max(64)).min(1).max(500),
  doctorId: z.string().max(64).optional(),
  deviceId: z.string().max(64).optional(),
})

// [v3.0.6.11-95 Wave1B] 批量状态流转 (签到/开始/完成): { ids[] } 逐条校验源态
const BatchTransitionBodySchema = z.object({
  ids: z.array(z.string().max(64)).min(1).max(500),
})

@ApiTags('worklist')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('worklist')
export class WorklistController {
  constructor(private readonly service: WorklistService) {}

  @Get()
  list(@Query(new ZodValidationPipe(ListQuerySchema)) query: WorklistListParams) {
    return this.service.list(query)
  }

  // ⚠️ 必须在 GET /worklist/:id 之前注册
  @Get('stats')
  stats() {
    return this.service.getStats()
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id)
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateWorklistSchema)) body: z.infer<typeof UpdateWorklistSchema>,
  ) {
    return this.service.update(id, {
      state: body.state ?? body.status,
      priority: body.priority,
      techNote: body.techNote,
      qcNote: body.qcNote,
      rating: body.rating,
      deviceId: body.deviceId,
      bodyPart: body.bodyPart,
      modality: body.modality,
      scheduledAt: body.scheduledAt,
    })
  }

  @Patch(':id/state')
  updateQcState(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateQcStateSchema)) body: z.infer<typeof UpdateQcStateSchema>,
  ) {
    return this.service.updateQcState(id, body.state, body.note, {
      rating: body.rating,
      techNote: body.techNote,
      qcNote: body.qcNote,
    })
  }

  @Post('batch-assign')
  batchAssign(@Body(new ZodValidationPipe(BatchAssignBodySchema)) body: { ids: string[]; doctorId?: string; deviceId?: string }) {
    return this.service.batchAssign(body.ids, { doctorId: body.doctorId, deviceId: body.deviceId })
  }

  // [v3.0.6.11-95 Wave1B] 批量签到: 仅 SCHEDULED → ARRIVED
  @Post('batch-checkin')
  batchCheckIn(@Body(new ZodValidationPipe(BatchTransitionBodySchema)) body: { ids: string[] }) {
    return this.service.batchTransition(body.ids, 'checkin')
  }

  // [v3.0.6.11-95 Wave1B] 批量开始: 仅 ARRIVED → IN_PROGRESS
  @Post('batch-start')
  batchStart(@Body(new ZodValidationPipe(BatchTransitionBodySchema)) body: { ids: string[] }) {
    return this.service.batchTransition(body.ids, 'start')
  }

  // [v3.0.6.11-95 Wave1B] 批量完成: 仅 IN_PROGRESS → COMPLETED
  @Post('batch-complete')
  batchComplete(@Body(new ZodValidationPipe(BatchTransitionBodySchema)) body: { ids: string[] }) {
    return this.service.batchTransition(body.ids, 'complete')
  }

  @Post(':id/assign')
  assign(@Param('id') id: string, @Body(new ZodValidationPipe(AssignBodySchema)) body: AssignDto) {
    return this.service.assign(id, body)
  }

  @Post(':id/checkin')
  checkIn(@Param('id') id: string) {
    return this.service.checkIn(id)
  }

  @Post(':id/start')
  start(@Param('id') id: string) {
    return this.service.start(id)
  }

  @Post(':id/complete')
  complete(@Param('id') id: string) {
    return this.service.complete(id)
  }

  // [v3.0.6.11-95 Wave 1A P1] 暂停/继续: IN_PROGRESS → PAUSED → IN_PROGRESS
  @Post(':id/pause')
  pause(@Param('id') id: string, @Body(new ZodValidationPipe(CancelBodySchema)) body: { reason?: string }) {
    return this.service.pause(id, body.reason)
  }

  @Post(':id/resume')
  resume(@Param('id') id: string) {
    return this.service.resume(id)
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(CancelBodySchema)) body: { reason?: string }) {
    return this.service.cancel(id, body.reason)
  }
}
