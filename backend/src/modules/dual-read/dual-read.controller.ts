import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
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

@ApiTags('dual-read')
@ApiBearerAuth()
@Controller('dual-read')
export class DualReadController {
  constructor(private readonly service: DualReadService) {}

  @Post('assign')
  assign(@Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return this.service.assign(body.studyId, body.patientName, body.patientId, body.modality)
  }

  @Post('arbitrate')
  arbitrate(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(ArbitrateSchema)) body: z.infer<typeof ArbitrateSchema>,
  ) {
    return this.service.arbitrate(id, body.arbitratorId, body.arbitratorName, body.report)
  }

  @Get('arbitrate/:id')
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

  @Get('list')
  list() {
    return this.service.list()
  }
}
