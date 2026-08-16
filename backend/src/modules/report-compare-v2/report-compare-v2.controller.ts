/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-compare-v2) - 报告对比 V2 控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - GET  /report-compare-v2/reports   报告目录 (选择对比对象)
 *   - GET  /report-compare-v2/presets   预设对比组合 (三类场景)
 *   - POST /report-compare-v2/compare   执行对比 (按 id 或原文 textA/textB)
 *   - GET  /report-compare-v2/stats     统计
 */
import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportCompareV2Service } from './report-compare-v2.service'

const CompareSchema = z
  .object({
    reportAId: z.string().min(1).optional(),
    reportBId: z.string().min(1).optional(),
    type: z.enum(['patient-history', 'dual-read', 'doctor-ai']).optional(),
    textA: z.string().optional(),
    textB: z.string().optional(),
    sectionLabel: z.string().optional(),
  })
  .refine(
    (v) => Boolean(v.reportAId && v.reportBId) !== (v.textA !== undefined && v.textB !== undefined),
    { message: '必须且只能提供 reportAId+reportBId 或 textA+textB' },
  )

@ApiTags('report-compare-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('report-compare-v2')
export class ReportCompareV2Controller {
  constructor(private readonly service: ReportCompareV2Service) {}

  @Get('reports')
  listReports() {
    return { success: true, data: this.service.listReports() }
  }

  @Get('presets')
  listPresets() {
    return { success: true, data: this.service.listPresets() }
  }

  @Post('compare')
  @HttpCode(200)
  compare(@Body(new ZodValidationPipe(CompareSchema)) body: z.infer<typeof CompareSchema>) {
    return { success: true, data: this.service.compare(body) }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }
}
