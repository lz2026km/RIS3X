/**
 * G005 鏀惧皠RIS绯荤粺 v3.0.2.2 - 鎶ュ憡璐ㄩ噺鎺у埗鍣?
 * 5 绔偣:GET rules / POST evaluate / GET history / GET trend / POST re-evaluate
 */
import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common'
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
  reEvaluate(@Param('reportId') reportId: string, @Body(new ZodValidationPipe(EvaluateSchema)) body: EvaluateDto) {
    return this.service.reEvaluate(reportId, body)
  }
}
