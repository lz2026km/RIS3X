/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8B (qc-analytics) - 报告质控闭环与趋势分析控制器
 * 端点 (全部 200, 孤儿模块可无 DB 启动, seed 回退):
 *   - GET  /qc-analytics/dashboard                   质控驾驶舱聚合指标
 *   - GET  /qc-analytics/trends?period=month|week    缺陷率周/月趋势 + 环比改善率
 *   - GET  /qc-analytics/pareto                      缺陷类型帕累托 (累计占比/主要问题)
 *   - GET  /qc-analytics/departments                 科室排名 (缺陷率/及时率/质控率)
 *   - GET  /qc-analytics/loop/defects?status=        缺陷池列表 (闭环入口)
 *   - GET  /qc-analytics/loop/items?status=          整改任务列表
 *   - POST /qc-analytics/loop/items                  由缺陷派生整改任务
 *   - GET  /qc-analytics/loop/items/:id              整改任务详情 (含历史)
 *   - POST /qc-analytics/loop/items/:id/start        开始整改 (open → rectifying)
 *   - POST /qc-analytics/loop/items/:id/fix          提交整改 (rectifying → rechecking)
 *   - POST /qc-analytics/loop/items/:id/recheck      复查验证 (通过关闭/退回整改)
 *   - POST /qc-analytics/loop/items/:id/close        关闭整改任务
 *   - GET  /qc-analytics/loop/stats                  闭环统计 (关闭率/平均闭环天数)
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { QcAnalyticsService } from './qc-analytics.service'

const CreateLoopItemSchema = z.object({
  defectId: z.string().min(1),
  assignee: z.string().optional(),
  assigneeName: z.string().optional(),
  title: z.string().optional(),
})

const NoteSchema = z
  .object({
    actor: z.string().optional(),
    note: z.string().optional(),
  })
  .optional()

const RecheckSchema = z.object({
  result: z.enum(['pass', 'fail']),
  reviewer: z.string().min(1),
  note: z.string().optional(),
})

const CloseSchema = z
  .object({
    note: z.string().optional(),
  })
  .optional()

@ApiTags('qc-analytics')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('qc-analytics')
export class QcAnalyticsController {
  constructor(private readonly service: QcAnalyticsService) {}

  @Get('dashboard')
  async getDashboard() {
    return { success: true, data: await this.service.getDashboard() }
  }

  @Get('trends')
  async getTrends(@Query('period') period?: string) {
    return { success: true, data: await this.service.getTrends(period === 'week' ? 'week' : 'month') }
  }

  @Get('pareto')
  async getPareto() {
    return { success: true, data: await this.service.getPareto() }
  }

  @Get('departments')
  async getDepartments() {
    return { success: true, data: await this.service.getDepartments() }
  }

  @Get('loop/defects')
  async listLoopDefects(@Query('status') status?: string) {
    return { success: true, data: await this.service.listLoopDefects(status) }
  }

  @Post('loop/items')
  @HttpCode(200)
  async createLoopItem(@Body(new ZodValidationPipe(CreateLoopItemSchema)) body: z.infer<typeof CreateLoopItemSchema>) {
    return { success: true, data: await this.service.createLoopItem(body) }
  }

  @Get('loop/items')
  async listLoopItems(@Query('status') status?: string) {
    return { success: true, data: await this.service.listLoopItems(status) }
  }

  @Get('loop/items/:id')
  async getLoopItem(@Param('id') id: string) {
    return { success: true, data: await this.service.getLoopItem(id) }
  }

  @Post('loop/items/:id/start')
  @HttpCode(200)
  async startFix(@Param('id') id: string, @Body(new ZodValidationPipe(NoteSchema)) body?: z.infer<typeof NoteSchema>) {
    return { success: true, data: await this.service.startFix(id, body ?? {}) }
  }

  @Post('loop/items/:id/fix')
  @HttpCode(200)
  async submitFix(@Param('id') id: string, @Body(new ZodValidationPipe(NoteSchema)) body?: z.infer<typeof NoteSchema>) {
    return { success: true, data: await this.service.submitFix(id, body ?? {}) }
  }

  @Post('loop/items/:id/recheck')
  @HttpCode(200)
  async recheckItem(@Param('id') id: string, @Body(new ZodValidationPipe(RecheckSchema)) body: z.infer<typeof RecheckSchema>) {
    return { success: true, data: await this.service.recheckItem(id, body as { result: 'pass' | 'fail'; reviewer: string; note?: string }) }
  }

  @Post('loop/items/:id/close')
  @HttpCode(200)
  async closeLoopItem(@Param('id') id: string, @Body(new ZodValidationPipe(CloseSchema)) body?: z.infer<typeof CloseSchema>) {
    return { success: true, data: await this.service.closeLoopItem(id, body ?? {}) }
  }

  @Get('loop/stats')
  getLoopStats() {
    return { success: true, data: this.service.getLoopStats() }
  }
}
