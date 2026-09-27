/**
 * [G005 W9-QC] 统一可配置质控评分量表控制器 (quality-rubric)
 * 端点:
 *   - GET  /quality/rubric                当前加权量表
 *   - PUT  /quality/rubric                更新量表 (维度/权重/等级带/阈值)
 *   - POST /quality/rubric/reset          恢复默认量表 (15 维度迁移版)
 *   - GET  /quality/rubric/grade-bands    等级带
 *   - GET  /quality/rubric/stats          量表元数据统计
 *   - POST /quality/rubric/evaluate       评分 (报告/评分输入 → 加权总分+分项+等级)
 */
import { Body, Controller, Get, HttpCode, Post, Put, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { QualityRubricService } from './quality-rubric.service'

const SubmissionSchema = z.object({
  reportId: z.string().optional(),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  findings: z.string().optional(),
  impression: z.string().optional(),
  diagnosis: z.string().optional(),
  recommendation: z.string().optional(),
  structuredFieldsComplete: z.number().min(0).max(1).optional(),
  signed: z.boolean().optional(),
  criticalMarked: z.boolean().optional(),
  priority: z.string().optional(),
  leftRightOk: z.boolean().optional(),
  onTimeRate: z.number().min(0).max(100).optional(),
  submitAt: z.string().optional(),
  reviewStartedAt: z.string().optional(),
  signedAt: z.string().optional(),
  hasReviewerSignature: z.boolean().optional(),
  criticalNotified: z.boolean().optional(),
  criticalAcked: z.boolean().optional(),
  priorityQueue: z.boolean().optional(),
})

const EvaluateSchema = z.object({
  reportId: z.string().optional(),
  submission: SubmissionSchema.optional(),
})

const RuleSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  weight: z.number(),
  kind: z.enum(['presence', 'absence', 'minLength', 'minRatio', 'booleanTrue', 'intervalMinutes', 'priorityStat', 'leftRightOk']),
  field: z.string().optional(),
  pattern: z.string().optional(),
  min: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  max: z.number().optional(),
  explanation: z.string().optional(),
})

const SubItemSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  weight: z.number(),
  description: z.string().optional(),
  rules: z.array(RuleSchema),
})

const DimensionSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().optional(),
  weight: z.number(),
  description: z.string().optional(),
  subItems: z.array(SubItemSchema),
})

const GradeBandSchema = z.object({
  grade: z.string().min(1),
  min: z.number().min(0).max(100),
  max: z.number().min(0).max(100),
  label: z.string().min(1),
  labelEn: z.string().optional(),
  publishable: z.boolean(),
  bonusEligible: z.boolean(),
  color: z.string(),
})

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  passThreshold: z.number().min(0).max(100).optional(),
  bonusThreshold: z.number().min(0).max(100).optional(),
  dimensions: z.array(DimensionSchema).optional(),
  gradeBands: z.array(GradeBandSchema).optional(),
  hardFailPatterns: z.array(z.string()).optional(),
  updatedBy: z.string().optional(),
})

@ApiTags('quality-rubric')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('quality/rubric')
export class QualityRubricController {
  constructor(private readonly service: QualityRubricService) {}

  @Get()
  getRubric() {
    return { success: true, data: this.service.getRubric() }
  }

  @Put()
  updateRubric(@Body(new ZodValidationPipe(UpdateSchema)) body: z.infer<typeof UpdateSchema>) {
    return { success: true, data: this.service.updateRubric(body as unknown as Parameters<QualityRubricService['updateRubric']>[0]) }
  }

  @Post('reset')
  @HttpCode(200)
  resetRubric() {
    return { success: true, data: this.service.resetRubric() }
  }

  @Get('grade-bands')
  getGradeBands() {
    return { success: true, data: this.service.getGradeBands() }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }

  @Post('evaluate')
  @HttpCode(200)
  async evaluate(@Body(new ZodValidationPipe(EvaluateSchema)) body: z.infer<typeof EvaluateSchema>) {
    return { success: true, data: await this.service.evaluate(body) }
  }

  @Get('evaluate')
  async evaluateGet(@Query('reportId') reportId?: string) {
    return { success: true, data: await this.service.evaluate({ reportId }) }
  }
}
