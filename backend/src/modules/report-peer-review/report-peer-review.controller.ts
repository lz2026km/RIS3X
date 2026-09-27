/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (report-peer-review) - 报告互评控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - POST /report-peer-review/assign             分配互评任务 (按科室确定性 / 指定)
 *   - GET  /report-peer-review/tasks              任务列表 (待评/已评/超时过滤)
 *   - GET  /report-peer-review/tasks/:id          任务详情
 *   - POST /report-peer-review/tasks/:id/score    提交评分 (准确性/完整性/规范性 5 分制 + 评语)
 *   - GET  /report-peer-review/stats              互评统计 (平均分/分布/完成率)
 *   - GET  /report-peer-review/dimensions         评分维度元数据
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportPeerReviewService } from './report-peer-review.service'

const AssignSchema = z.object({
  reportId: z.string().min(1),
  patientName: z.string().optional(),
  modality: z.string().optional(),
  department: z.string().min(1),
  reviewerId: z.string().optional(),
  dueDays: z.number().int().min(1).max(30).optional(),
})

const ScoreSchema = z.object({
  scores: z.object({
    accuracy: z.number().int().min(1).max(5),
    completeness: z.number().int().min(1).max(5),
    normativity: z.number().int().min(1).max(5),
  }),
  comment: z.string().optional(),
  reviewerId: z.string().optional(),
})

const LinkDefectsSchema = z.object({
  defectCodes: z.array(z.string().min(1)).min(1),
})

@ApiTags('report-peer-review')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('report-peer-review')
export class ReportPeerReviewController {
  constructor(private readonly service: ReportPeerReviewService) {}

  @Post('assign')
  @HttpCode(200)
  assign(@Body(new ZodValidationPipe(AssignSchema)) body: z.infer<typeof AssignSchema>) {
    return { success: true, data: this.service.assign(body) }
  }

  @Get('tasks')
  listTasks(@Query('status') status?: string) {
    return { success: true, data: this.service.listTasks({ status }) }
  }

  @Get('tasks/:id')
  getTask(@Param('id') id: string) {
    return { success: true, data: this.service.getTask(id) }
  }

  @Post('tasks/:id/score')
  @HttpCode(200)
  score(@Param('id') id: string, @Body(new ZodValidationPipe(ScoreSchema)) body: z.infer<typeof ScoreSchema>) {
    return { success: true, data: this.service.score(id, body) }
  }

  @Get('stats')
  getStats() {
    return { success: true, data: this.service.getStats() }
  }

  @Get('dimensions')
  getDimensions() {
    return { success: true, data: this.service.getDimensions() }
  }

  @Post('tasks/:id/defects')
  @HttpCode(200)
  linkDefects(@Param('id') id: string, @Body(new ZodValidationPipe(LinkDefectsSchema)) body: z.infer<typeof LinkDefectsSchema>) {
    return { success: true, data: this.service.linkDefects(id, body) }
  }

  @Get('tasks/:id/defects')
  listTaskDefects(@Param('id') id: string) {
    return { success: true, data: this.service.listTaskDefects(id) }
  }

  @Get('defect-stats')
  defectStats() {
    return { success: true, data: this.service.defectStats() }
  }
}
