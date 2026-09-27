/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1C - 质量指标库镜像控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, 常量镜像):
 *   - GET  /quality-indicators/extended             40 条指标 (支持 ?category= & ?keyword=)
 *   - GET  /quality-indicators/extended/:code       按编码查询单条
 *   - GET  /quality-indicators/evaluate             达标判定 (?code= & ?value=)
 *   - GET  /quality-indicators/standards            图像/报告/流程质控标准
 */
import { Controller, Get, Param, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { QualityIndicatorsService } from './quality-indicators.service'
import { EvaluateTargetSchema, IndicatorCodeSchema, ListIndicatorsSchema } from './quality-indicators.schema'
import { z } from 'zod'

const ComputeSchema = z.object({
  period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  persist: z.coerce.boolean().optional(),
})

@ApiTags('quality-indicators')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('quality-indicators')
export class QualityIndicatorsController {
  constructor(private readonly svc: QualityIndicatorsService) {}

  @Get('extended')
  listIndicators(@Query(new ZodValidationPipe(ListIndicatorsSchema)) query: z.infer<typeof ListIndicatorsSchema>) {
    return this.svc.listIndicators(query.category, query.keyword)
  }

  @Get('extended/:code')
  getIndicator(@Param('code', new ZodValidationPipe(IndicatorCodeSchema)) code: string) {
    return this.svc.getIndicator(code)
  }

  @Get('evaluate')
  evaluate(@Query(new ZodValidationPipe(EvaluateTargetSchema)) query: z.infer<typeof EvaluateTargetSchema>) {
    return this.svc.evaluateTarget(query.code, query.value)
  }

  @Get('standards')
  getStandards() {
    return this.svc.getStandards()
  }

  // [W9-QC] 2024 国标 40 指标计算引擎
  @Get('compute')
  async compute(@Query(new ZodValidationPipe(ComputeSchema)) query: z.infer<typeof ComputeSchema>) {
    const { source, snapshot } = await this.svc.compute(query.period, query.persist !== false)
    return { source, ...snapshot }
  }

  @Get('dashboard')
  async dashboard(@Query('period') period?: string) {
    const parsed = period && /^\d{4}-\d{2}$/.test(period) ? period : undefined
    return { success: true, data: await this.svc.computeDashboard(parsed) }
  }

  @Get('snapshots')
  snapshots() {
    return { success: true, data: this.svc.listSnapshots() }
  }
}
