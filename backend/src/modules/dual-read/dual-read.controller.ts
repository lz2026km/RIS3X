import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { DualReadService } from './dual-read.service'

const AssignSchema = z.object({
  studyId: z.string().min(1),
  patientName: z.string().min(1),
  patientId: z.string().min(1),
  modality: z.string().min(1),
})

const ArbitrateSchema = z.object({
  arbitratorId: z.string().min(1),
  arbitratorName: z.string().min(1),
  report: z.string().min(1),
})

// [Wave1B P2] 无 id 变体 (POST /dual-read/arbitrate): id 由 body 携带
const ArbitrateByIdSchema = ArbitrateSchema.extend({
  id: z.string().min(1),
})

const ReaderSchema = z.object({
  readerId: z.string().optional(),
  readerNumber: z.union([z.literal(1), z.literal(2)]),
  report: z.string().min(1),
})

@ApiTags('dual-read')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('dual-read')
export class DualReadController {
  constructor(private readonly service: DualReadService) {}

  @Post('assign')
  assign(@Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return this.service.assign(body.studyId, body.patientName, body.patientId, body.modality)
  }

  @Post('arbitrate')
  arbitrate(
    @Body(new ZodValidationPipe(ArbitrateByIdSchema)) body: z.infer<typeof ArbitrateByIdSchema>,
  ) {
    return this.service.arbitrate(body.id, body.arbitratorId, body.arbitratorName, body.report)
  }

  @Post('arbitrate/:id')
  arbitrateGet(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ArbitrateSchema)) body: z.infer<typeof ArbitrateSchema>,
  ) {
    return this.service.arbitrate(id, body.arbitratorId, body.arbitratorName, body.report)
  }

  @Get('discrepancy')
  discrepancy() {
    return this.service.discrepancyStats()
  }

  @Post(':id/reader')
  submitReader(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ReaderSchema)) body: z.infer<typeof ReaderSchema>,
  ) {
    return this.service.submitReader(id, body.readerNumber, body.report)
  }

  @Get('list')
  list() {
    return this.service.list()
  }
}
