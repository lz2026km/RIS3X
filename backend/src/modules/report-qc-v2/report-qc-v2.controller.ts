/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (report-qc-v2) - 报告质控 V2 控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - GET  /report-qc-v2/dimensions                    5 维度元数据 (子项/满分)
 *   - POST /report-qc-v2/score                         报告多维评分 (总分 0-100 + 等级 + 缺陷)
 *   - GET  /report-qc-v2/scores                        最近评分记录
 *   - GET  /report-qc-v2/scores/:id                    评分明细
 *   - POST /report-qc-v2/tasks                         创建质控任务
 *   - GET  /report-qc-v2/tasks                         任务列表 (status 过滤)
 *   - GET  /report-qc-v2/tasks/:id                     任务详情 (含历史)
 *   - POST /report-qc-v2/tasks/:id/assign              分配
 *   - POST /report-qc-v2/tasks/:id/review              一级复核 (通过/退回)
 *   - POST /report-qc-v2/tasks/:id/second-review       二次复核 (双人复核)
 *   - POST /report-qc-v2/tasks/:id/close               关闭任务
 *   - GET  /report-qc-v2/tasks/:id/reviews             复核记录历史
 *   - GET  /report-qc-v2/records                       质控记录历史
 *   - GET  /report-qc-v2/stats                         统计 (缺陷分布/月度趋势/等级分布)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportQcV2Service, ReviewOpinion } from './report-qc-v2.service'

const ScoreSchema = z.object({
  reportId: z.string().min(1),
  findings: z.string().optional(),
  diagnosis: z.string().optional(),
  conclusion: z.string().optional(),
  impression: z.string().optional(),
  recommendations: z.string().optional(),
  modality: z.string().optional(),
  radsCategory: z.string().optional(),
  isCritical: z.boolean().optional(),
  structuredCompletion: z.number().min(0).max(100).optional(),
  reportTimeMinutes: z.number().int().min(0).optional(),
  techParams: z.string().optional(),
})

const CreateTaskSchema = z.object({
  reportId: z.string().min(1),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  assignee: z.string().min(1).optional(),
  assigneeName: z.string().optional(),
  scoreInput: ScoreSchema.optional(),
})

const AssignSchema = z.object({
  assignee: z.string().min(1),
  assigneeName: z.string().optional(),
})

const ReviewSchema = z.object({
  reviewer: z.string().min(1),
  opinion: z.enum(['pass', 'return']),
  comment: z.string().optional(),
})

const CloseSchema = z
  .object({
    comment: z.string().optional(),
  })
  .optional()

@ApiTags('report-qc-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('report-qc-v2')
export class ReportQcV2Controller {
  constructor(private readonly service: ReportQcV2Service) {}

  @Get('dimensions')
  getDimensions() {
    return { success: true, data: this.service.getDimensions() }
  }

  @Post('score')
  @HttpCode(200)
  async score(@Body(new ZodValidationPipe(ScoreSchema)) body: z.infer<typeof ScoreSchema>) {
    return { success: true, data: await this.service.scoreReport(body) }
  }

  @Get('scores')
  async listScores() {
    return { success: true, data: await this.service.listScores() }
  }

  @Get('scores/:id')
  async getScore(@Param('id') id: string) {
    return { success: true, data: await this.service.getScore(id) }
  }

  @Get('tasks')
  listTasks(@Query('status') status?: string) {
    return { success: true, data: this.service.listTasks({ status }) }
  }

  @Post('tasks')
  @HttpCode(200)
  async createTask(@Body(new ZodValidationPipe(CreateTaskSchema)) body: z.infer<typeof CreateTaskSchema>) {
    return { success: true, data: await this.service.createTask(body) }
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    return { success: true, data: this.service.getTask(id) }
  }

  @Post('tasks/:id/assign')
  @HttpCode(200)
  async assignTask(@Param('id') id: string, @Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return { success: true, data: await this.service.assignTask(id, body) }
  }

  @Post('tasks/:id/review')
  @HttpCode(200)
  async reviewTask(@Param('id') id: string, @Body(new ZodValidationPipe(ReviewSchema)) body: z.infer<typeof ReviewSchema>) {
    return { success: true, data: await this.service.reviewTask(id, body as { reviewer: string; opinion: ReviewOpinion; comment?: string }) }
  }

  @Post('tasks/:id/second-review')
  @HttpCode(200)
  async secondReviewTask(@Param('id') id: string, @Body(new ZodValidationPipe(ReviewSchema)) body: z.infer<typeof ReviewSchema>) {
    return { success: true, data: await this.service.secondReviewTask(id, body as { reviewer: string; opinion: ReviewOpinion; comment?: string }) }
  }

  @Post('tasks/:id/close')
  @HttpCode(200)
  async closeTask(@Param('id') id: string, @Body(new ZodValidationPipe(CloseSchema)) body?: z.infer<typeof CloseSchema>) {
    return { success: true, data: await this.service.closeTask(id, body ?? {}) }
  }

  @Get('tasks/:id/reviews')
  listReviews(@Param('id') id: string) {
    return { success: true, data: this.service.listReviews(id) }
  }

  @Get('records')
  listRecords() {
    return { success: true, data: this.service.listRecords() }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }
}
