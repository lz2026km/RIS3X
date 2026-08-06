import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { WorklistService, WORKLIST_STATES, type AssignDto, type WorklistListParams } from './worklist.service'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { z } from 'zod'

const CancelBodySchema = z.object({
  reason: z.string().max(500).optional(),
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
      deviceId: body.deviceId,
      bodyPart: body.bodyPart,
      modality: body.modality,
      scheduledAt: body.scheduledAt,
    })
  }

  @Post('batch-assign')
  batchAssign(@Body(new ZodValidationPipe(BatchAssignBodySchema)) body: { ids: string[]; doctorId?: string; deviceId?: string }) {
    return this.service.batchAssign(body.ids, { doctorId: body.doctorId, deviceId: body.deviceId })
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

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body(new ZodValidationPipe(CancelBodySchema)) body: { reason?: string }) {
    return this.service.cancel(id, body.reason)
  }
}
