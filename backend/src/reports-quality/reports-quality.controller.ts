/**
 * G005 RIS v3.0.6.11-33 - Reports Quality Controller
 */
import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { ReportsQualityService, EvaluateDto } from './reports-quality.service'

const EvaluateSchema = z.object({
  reportId: z.string().min(1),
  findings: z.string(),
  conclusion: z.string(),
  suggestion: z.string().optional(),
  radsCategory: z.string().optional(),
  hasCritical: z.boolean().optional(),
  verified: z.boolean().optional(),
  structuredCompletion: z.number().min(0).max(1).optional(),
})

@ApiTags('reports-quality')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR')
@Controller('reports/quality')
export class ReportsQualityController {
  constructor(private readonly service: ReportsQualityService) {}

  @Get('rules')
  rules() {
    return this.service.getRules()
  }

  @Post('evaluate')
  @HttpCode(HttpStatus.CREATED)
  evaluate(@Body(new ZodValidationPipe(EvaluateSchema)) body: EvaluateDto) {
    return this.service.evaluate(body)
  }

  @Get('history/:reportId')
  history(@Param('reportId') reportId: string) {
    return this.service.getHistory(reportId)
  }

  @Get('trend/:reportId')
  trend(@Param('reportId') reportId: string, @Query('days') days?: string) {
    return this.service.getTrend(reportId, Number(days ?? 30))
  }

  @Post('re-evaluate/:reportId')
  @HttpCode(HttpStatus.CREATED)
  reEvaluate(@Param('reportId') reportId: string, @Body(new ZodValidationPipe(EvaluateSchema)) body: EvaluateDto) {
    return this.service.reEvaluate(reportId, body)
  }
}
