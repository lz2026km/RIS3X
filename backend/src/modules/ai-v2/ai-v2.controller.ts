/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强控制器
 * 路由前缀 /ai-v2 (全局 /api 前缀 → /api/ai-v2/*)
 * 三个资源: organ-detection / draft-score / smart-hanging
 */
import { Body, Controller, Get, Param, Post } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { Roles } from '../../common/decorators/roles.decorator'
import { AiV2Service } from './ai-v2.service'

const PixelStatsSchema = z
  .object({
    mean: z.number().optional(),
    stddev: z.number().nonnegative().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    slices: z.number().int().min(1).max(2000).optional(),
    width: z.number().int().min(64).max(4096).optional(),
    height: z.number().int().min(64).max(4096).optional(),
  })
  .optional()

const OrganAnalyzeSchema = z.object({
  studyId: z.string().min(1).max(64),
  modality: z.string().min(1).max(10).default('CT'),
  bodyPart: z.string().max(50).optional(),
  pixelStats: PixelStatsSchema,
})

const DraftScoreSchema = z.object({
  draftText: z.string().max(20000),
  modality: z.string().max(10).optional(),
  expectedSections: z.array(z.string().max(50)).max(10).optional(),
})

const HangingSeriesSchema = z
  .object({
    description: z.string().max(100).optional(),
    seriesNumber: z.number().int().min(0).optional(),
    images: z.number().int().min(0).optional(),
  })
  .optional()

const HangingRecommendSchema = z.object({
  examId: z.string().max(64).optional(),
  modality: z.string().min(1).max(10),
  bodyPart: z.string().max(50).optional(),
  series: z.array(HangingSeriesSchema).max(30).optional(),
  doctorId: z.string().max(64).optional(),
})

const HangingApplySchema = z.object({
  examId: z.string().min(1).max(64),
  layoutId: z.string().min(1).max(64),
  appliedBy: z.string().min(1).max(64),
})

@ApiTags('ai-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'TECHNICIAN')
@Controller('ai-v2')
export class AiV2Controller {
  constructor(private readonly service: AiV2Service) {}

  // ── 多器官自动检出 ────────────────────────────────────────────────────────
  @Post('organ-detection/analyze')
  @ApiOperation({ summary: '多器官自动检出 (确定性灰度特征推理)' })
  analyzeOrgans(
    @Body(new ZodValidationPipe(OrganAnalyzeSchema))
    body: { studyId: string; modality: string; bodyPart?: string; pixelStats?: unknown },
  ) {
    return this.service.analyzeOrgans({
      studyId: body.studyId,
      modality: body.modality,
      bodyPart: body.bodyPart,
      pixelStats: body.pixelStats as never,
    })
  }

  @Get('organ-detection/results')
  @ApiOperation({ summary: '器官检出结果列表' })
  listOrganResults() {
    return this.service.listOrganResults()
  }

  @Get('organ-detection/results/:id')
  @ApiOperation({ summary: '器官检出结果详情' })
  getOrganResult(@Param('id') id: string) {
    return this.service.getOrganResult(id)
  }

  @Post('organ-detection/:id/report-paragraph')
  @ApiOperation({ summary: '一键生成报告段落 (基于检出结果)' })
  generateParagraph(@Param('id') id: string) {
    const result = this.service.getOrganResult(id)
    return this.service.generateReportParagraph(result)
  }

  // ── 报告草稿评分 ───────────────────────────────────────────────────────────
  @Post('draft-score')
  @ApiOperation({ summary: '报告草稿质量评分 (0-100 + 改进建议)' })
  scoreDraft(
    @Body(new ZodValidationPipe(DraftScoreSchema))
    body: { draftText: string; modality?: string; expectedSections?: string[] },
  ) {
    return this.service.scoreDraft({
      draftText: body.draftText,
      modality: body.modality,
      expectedSections: body.expectedSections,
    })
  }

  @Get('draft-score/results')
  @ApiOperation({ summary: '草稿评分记录列表' })
  listDraftScores() {
    return this.service.listDraftScores()
  }

  @Get('draft-score/results/:id')
  @ApiOperation({ summary: '草稿评分记录详情' })
  getDraftScore(@Param('id') id: string) {
    return this.service.getDraftScore(id)
  }

  // ── 智能挂片 ──────────────────────────────────────────────────────────────
  @Post('smart-hanging/recommend')
  @ApiOperation({ summary: '智能挂片推荐 (确定性规则表 + 历史偏好)' })
  recommendHanging(
    @Body(new ZodValidationPipe(HangingRecommendSchema))
    body: { examId?: string; modality: string; bodyPart?: string; series?: unknown; doctorId?: string },
  ) {
    return this.service.recommendHanging({
      examId: body.examId,
      modality: body.modality,
      bodyPart: body.bodyPart,
      series: body.series as never,
      doctorId: body.doctorId,
    })
  }

  @Post('smart-hanging/apply')
  @ApiOperation({ summary: '应用挂片布局并记录' })
  applyHanging(
    @Body(new ZodValidationPipe(HangingApplySchema))
    body: { examId: string; layoutId: string; appliedBy: string },
  ) {
    return this.service.applyHanging(body)
  }

  @Get('smart-hanging/applications')
  @ApiOperation({ summary: '挂片布局应用记录' })
  listHangingApplications() {
    return this.service.listHangingApplications()
  }

  @Get('smart-hanging/rules')
  @ApiOperation({ summary: '挂片规则表 (只读)' })
  listHangingRules() {
    return this.service.listHangingRules()
  }

  // ── 总览 ───────────────────────────────────────────────────────────────────
  @Get('overview')
  @ApiOperation({ summary: 'AI 增强总览统计' })
  overview() {
    return this.service.overview()
  }
}
