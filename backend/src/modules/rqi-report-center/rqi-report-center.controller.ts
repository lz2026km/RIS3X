/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 2A - 放射影像质控指标国家上报中心控制器
 * 端点 (孤儿模块, 无 DB 可启动, 内存 overlay + seed 回退):
 *   - POST /rqi-report-center/batches                    生成上报批次 (period/createdBy) → DRAFT
 *   - GET  /rqi-report-center/batches?status=&period=&page=&pageSize=  批次列表 (周期倒序 + 分页)
 *   - GET  /rqi-report-center/batches/:id                批次详情 (含 7 指标明细)
 *   - POST /rqi-report-center/batches/:id/submit         提交 (DRAFT → SUBMITTED)
 *   - POST /rqi-report-center/batches/:id/accept         回执接收 (SUBMITTED → ACCEPTED, 回执号)
 *   - POST /rqi-report-center/batches/:id/reject         回执驳回 (SUBMITTED → REJECTED, 原因)
 *   - POST /rqi-report-center/batches/:id/reopen         驳回重报 (REJECTED → DRAFT)
 *   - GET  /rqi-report-center/batches/:id/export?format=csv|json  导出上报内容 (CSV 含 BOM / JSON)
 *   - GET  /rqi-report-center/history                    上报历史 (批次 + 状态 + 回执)
 *   - GET  /rqi-report-center/stats                      上报统计 (批次数/各状态数/最近上报/按时上报率)
 *
 * 状态机: DRAFT→SUBMITTED→ACCEPTED|REJECTED; REJECTED→DRAFT; 非法流转 400; 批次不存在 404。
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { Roles } from '../../common/decorators/roles.decorator'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { RqiReportCenterService } from './rqi-report-center.service'
import { REPORT_BATCH_STATUSES, type ReportBatchStatus } from './rqi-report-center.types'

const CreateBatchSchema = z.object({
  period: z.string().min(1),
  createdBy: z.string().min(1),
})

const ListBatchSchema = z.object({
  status: z.enum([...REPORT_BATCH_STATUSES] as [ReportBatchStatus, ...ReportBatchStatus[]]).optional(),
  period: z.string().optional(),
  page: z.coerce.number().int().min(1).optional(),
  pageSize: z.coerce.number().int().min(1).max(200).optional(),
})

const AcceptBatchSchema = z.object({
  receiptNo: z.string().min(1),
  remark: z.string().optional(),
  receiptAt: z.string().optional(),
})

const RejectBatchSchema = z.object({
  reason: z.string().min(1),
  remark: z.string().optional(),
  receiptAt: z.string().optional(),
})

const ExportQuerySchema = z.object({
  format: z.enum(['csv', 'json']).default('csv'),
})

@ApiTags('rqi-report-center')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR')
@Controller('rqi-report-center')
export class RqiReportCenterController {
  constructor(private readonly service: RqiReportCenterService) {}

  @Post('batches')
  @HttpCode(200)
  async createBatch(@Body(new ZodValidationPipe(CreateBatchSchema)) body: z.infer<typeof CreateBatchSchema>) {
    return { success: true, data: await this.service.createBatch(body) }
  }

  @Get('batches')
  async listBatches(@Query(new ZodValidationPipe(ListBatchSchema)) query: z.infer<typeof ListBatchSchema>) {
    return { success: true, data: await this.service.listBatches(query) }
  }

  @Get('batches/:id/export')
  async exportBatch(
    @Param('id') id: string,
    @Query(new ZodValidationPipe(ExportQuerySchema)) query: z.infer<typeof ExportQuerySchema>,
  ) {
    return { success: true, data: await this.service.exportBatch(id, query.format) }
  }

  @Get('batches/:id')
  async getBatch(@Param('id') id: string) {
    return { success: true, data: await this.service.getBatch(id) }
  }

  @Post('batches/:id/submit')
  @HttpCode(200)
  async submitBatch(@Param('id') id: string) {
    return { success: true, data: await this.service.submitBatch(id) }
  }

  @Post('batches/:id/accept')
  @HttpCode(200)
  async acceptBatch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(AcceptBatchSchema)) body: z.infer<typeof AcceptBatchSchema>,
  ) {
    return { success: true, data: await this.service.acceptBatch(id, body) }
  }

  @Post('batches/:id/reject')
  @HttpCode(200)
  async rejectBatch(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RejectBatchSchema)) body: z.infer<typeof RejectBatchSchema>,
  ) {
    return { success: true, data: await this.service.rejectBatch(id, body) }
  }

  @Post('batches/:id/reopen')
  @HttpCode(200)
  async reopenBatch(@Param('id') id: string) {
    return { success: true, data: await this.service.reopenBatch(id) }
  }

  @Get('history')
  async getHistory(@Query(new ZodValidationPipe(ListBatchSchema)) query: z.infer<typeof ListBatchSchema>) {
    return { success: true, data: await this.service.getHistory(query) }
  }

  @Get('stats')
  async getStats() {
    return { success: true, data: await this.service.getStats() }
  }
}
