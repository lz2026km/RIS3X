/**
 * G005 放射RIS系统 v3.0.6.11-101 - 报告导出中心 V2 控制器 (Wave 7B, F15, 孤儿模块)
 *
 * 端点 (POST 统一 200):
 * - GET    /report-export-center-v2/reports                 可导出报告注册表 (examType/keyword)
 * - POST   /report-export-center-v2/tasks                   创建导出任务 (PENDING)
 * - GET    /report-export-center-v2/tasks                   任务列表 (state + 分页)
 * - GET    /report-export-center-v2/tasks/:id               任务详情
 * - POST   /report-export-center-v2/tasks/:id/process       处理任务 (PENDING→PROCESSING→COMPLETED)
 * - POST   /report-export-center-v2/tasks/:id/cancel        取消任务
 * - POST   /report-export-center-v2/tasks/:id/download      下载 (确定性内容)
 * - POST   /report-export-center-v2/batch                   批量导出 (创建+处理, 权限校验)
 * - GET    /report-export-center-v2/history                 导出历史
 * - GET    /report-export-center-v2/stats                   导出统计
 */
import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common'
import { Roles } from '../../common/decorators/roles.decorator'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { z } from 'zod'
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe'
import { ReportExportCenterV2Service } from './report-export-center-v2.service'

const FormatEnum = z.enum(['PDF', 'DOCX', 'HTML', 'CSV', 'DICOM_SR'])
const StateEnum = z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELED'])

const CreateTaskSchema = z.object({
  format: FormatEnum,
  reportIds: z.array(z.string()).min(1),
  requestedBy: z.string().default('当前用户'),
  requestedByRole: z.string().default('DOCTOR'),
})

const BatchExportSchema = z.object({
  format: FormatEnum,
  reportIds: z.array(z.string()).min(1),
  requestedBy: z.string().default('当前用户'),
  requestedByRole: z.string().default('ADMIN'),
})

@ApiTags('report-export-center-v2')
@ApiBearerAuth()
@Roles('ADMIN', 'DIRECTOR', 'DOCTOR', 'CHIEF')
@Controller('report-export-center-v2')
export class ReportExportCenterV2Controller {
  constructor(private readonly service: ReportExportCenterV2Service) {}

  @Get('reports')
  @ApiOperation({ summary: '可导出报告列表' })
  listReports(@Query() query: Record<string, unknown>) {
    const parsed = z.object({ examType: z.string().optional(), keyword: z.string().optional() }).safeParse(query)
    return this.service.listReports(parsed.success ? parsed.data : {})
  }

  @Post('tasks')
  @HttpCode(200)
  @ApiOperation({ summary: '创建导出任务 (PENDING)' })
  createTask(@Body(new ZodValidationPipe(CreateTaskSchema)) body: z.infer<typeof CreateTaskSchema>) {
    return this.service.createTask(body)
  }

  @Get('tasks')
  @ApiOperation({ summary: '导出任务列表' })
  listTasks(@Query() query: Record<string, unknown>) {
    const parsed = z.object({ state: StateEnum.optional(), page: z.coerce.number().int().positive().optional(), pageSize: z.coerce.number().int().positive().max(100).optional() }).safeParse(query)
    return this.service.listTasks(parsed.success ? parsed.data : {})
  }

  @Get('tasks/:id')
  @ApiOperation({ summary: '导出任务详情' })
  getTask(@Param('id') id: string) {
    return this.service.getTask(id)
  }

  @Post('tasks/:id/process')
  @HttpCode(200)
  @ApiOperation({ summary: '处理导出任务 (流转至 COMPLETED)' })
  processTask(@Param('id') id: string) {
    return this.service.processTask(id)
  }

  @Post('tasks/:id/cancel')
  @HttpCode(200)
  @ApiOperation({ summary: '取消导出任务' })
  cancelTask(@Param('id') id: string) {
    return this.service.cancelTask(id)
  }

  @Post('tasks/:id/download')
  @HttpCode(200)
  @ApiOperation({ summary: '下载 (确定性内容)' })
  download(@Param('id') id: string) {
    return this.service.download(id)
  }

  @Post('batch')
  @HttpCode(200)
  @ApiOperation({ summary: '批量导出 (创建+处理, 权限校验)' })
  batchExport(@Body(new ZodValidationPipe(BatchExportSchema)) body: z.infer<typeof BatchExportSchema>) {
    return this.service.createAndProcess(body)
  }

  @Get('history')
  @ApiOperation({ summary: '导出历史' })
  history() {
    return this.service.history()
  }

  @Get('stats')
  @ApiOperation({ summary: '导出统计' })
  stats() {
    return this.service.stats()
  }
}
