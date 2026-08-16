/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (ai-second-read) - AI 二次检出 V2 控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - POST /ai-second-read/analyze                             二次检出任务 (漏诊/缺项/不一致)
 *   - GET  /ai-second-read/results                             检出结果列表
 *   - GET  /ai-second-read/results/:id                         检出结果详情
 *   - POST /ai-second-read/results/:id/risk-items/:itemId/ignore   医生忽略风险项
 *   - POST /ai-second-read/results/:id/risk-items/:itemId/adopt    医生采纳风险项
 *   - POST /ai-second-read/results/:id/append                  建议加入报告
 *   - GET  /ai-second-read/stats                               复查统计
 */
import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { AiSecondReadService } from './ai-second-read.service'

const AnalyzeSchema = z.object({
  reportId: z.string().min(1),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  findings: z.string().optional(),
  diagnosis: z.string().optional(),
  conclusion: z.string().optional(),
  recommendations: z.string().optional(),
})

const HandleItemSchema = z.object({
  reviewer: z.string().min(1),
})

const AppendSchema = z.object({
  reviewer: z.string().min(1),
  appendedText: z.string().min(1),
})

@ApiTags('ai-second-read')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('ai-second-read')
export class AiSecondReadController {
  constructor(private readonly service: AiSecondReadService) {}

  @Post('analyze')
  @HttpCode(200)
  @Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
  analyze(@Body(new ZodValidationPipe(AnalyzeSchema)) body: z.infer<typeof AnalyzeSchema>) {
    return { success: true, data: this.service.analyze(body) }
  }

  @Get('results')
  listResults() {
    return { success: true, data: this.service.listResults() }
  }

  @Get('results/:id')
  getResult(@Param('id') id: string) {
    return { success: true, data: this.service.getResult(id) }
  }

  @Post('results/:id/risk-items/:itemId/ignore')
  @HttpCode(200)
  ignoreRiskItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(HandleItemSchema)) body: z.infer<typeof HandleItemSchema>,
  ) {
    return { success: true, data: this.service.ignoreRiskItem(id, itemId, body.reviewer) }
  }

  @Post('results/:id/risk-items/:itemId/adopt')
  @HttpCode(200)
  adoptRiskItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body(new ZodValidationPipe(HandleItemSchema)) body: z.infer<typeof HandleItemSchema>,
  ) {
    return { success: true, data: this.service.adoptRiskItem(id, itemId, body.reviewer) }
  }

  @Post('results/:id/append')
  @HttpCode(200)
  appendToReport(@Param('id') id: string, @Body(new ZodValidationPipe(AppendSchema)) body: z.infer<typeof AppendSchema>) {
    return { success: true, data: this.service.appendToReport(id, body) }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }
}
