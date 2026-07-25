import { Controller, Get, Post, Body, Logger, Query } from '@nestjs/common'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiTags, ApiOperation } from '@nestjs/swagger'
import { AiDiagnosisService, AccuracyRequest } from './ai-diagnosis.service'

const AccuracySchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  siteId: z.string().optional(),
  modality: z.string().optional(),
})

@ApiTags('ai-diagnosis')
@Roles('ADMIN', 'DIRECTOR')
@Controller('api/v1/ai-diagnosis')
export class AiDiagnosisController {
  private readonly logger = new Logger(AiDiagnosisController.name)
  constructor(private readonly service: AiDiagnosisService) {}

  @Post('accuracy')
  @ApiOperation({ summary: 'AI diagnosis accuracy metrics' })
  accuracy(@Body(new ZodValidationPipe(AccuracySchema)) body: AccuracyRequest) {
    return this.service.accuracy(body)
  }

  @Get('trend')
  @ApiOperation({ summary: 'AI accuracy trend' })
  trend(@Query(new ZodValidationPipe(AccuracySchema)) body: AccuracyRequest) {
    return this.service.trend(body)
  }
}
