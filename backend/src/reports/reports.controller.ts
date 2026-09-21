import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Put, Query, Req, Res } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Roles } from '../common/decorators/roles.decorator'
import type { Request, Response } from 'express'
import { z } from 'zod'
import * as path from 'node:path'
import { existsSync } from 'node:fs'
import { createReadStream } from 'node:fs'
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe'
import { ReportsService } from './reports.service'

const ReportStateEnum = z.enum([
  'PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING', 'SUBMITTED',
  'INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW',
  'REVIEWED', 'SIGNING', 'SIGNED', 'PUBLISHED',
  'AMENDING', 'AMENDED', 'WITHDRAWN', 'REJECTED', 'ESCALATED', 'ARCHIVED',
  'RECTIFYING', 'SUPPLEMENTING', 'SUPPLEMENTED', 'REDISTRIBUTING',
])

const CreateReportSchema = z.object({
  patientId: z.string().min(1),
  examId: z.string().optional(),
  radiologistId: z.string().optional(),
  findings: z.string().default(''),
  conclusion: z.string().default(''),
  // [v3.0.6.11-98 Wave 1A P0] 富文本 HTML 持久化
  htmlContent: z.string().default(''),
})

export const UpdateReportSchema = z.object({
  findings: z.string().optional(),
  conclusion: z.string().optional(),
  htmlContent: z.string().optional(),
})

// [v3.0.6.11-100 Wave 2B (报告-影像标注双向同步)] POST /reports/:id/image-annotations 请求体
export const SaveImageAnnotationsSchema = z.object({
  studyUid: z.string().max(512).optional(),
  seriesUid: z.string().max(512).optional(),
  instanceUid: z.string().max(512).optional(),
  annotations: z.array(z.object({
    id: z.string().min(1).max(128),
    type: z.enum(['arrow', 'circle', 'ruler', 'box']),
    x1: z.number(), y1: z.number(), x2: z.number(), y2: z.number(),
    label: z.string().max(128).optional().default(''),
    color: z.string().max(32).optional().default('#fbbf24'),
  })).min(1).max(200),
  imageBase64: z.string().max(8_000_000).optional(),
})

@ApiTags('reports')
@ApiBearerAuth()
@Roles('DOCTOR', 'DIRECTOR', 'ADMIN', 'TECHNICIAN')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  list(
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('state') state?: string,
    @Query('status') status?: string,
    @Query('modality') modality?: string,
    @Query('priority') priority?: string,
    @Query('patientId') patientId?: string,
    @Query('doctorId') doctorId?: string,
    @Query('keyword') keyword?: string,
  ) {
    // [v3.0.6.11-95 Wave3B P1] list 筛选: state/status 兼容 (英文枚举, 逗号分隔多值),
    //   非合法枚举忽略; modality/priority 走 exam 关联, patientId/doctorId 直连字段, keyword 模糊匹配患者名/检查号
    const rawStates = (status || state || '').split(',').map((s) => s.trim()).filter(Boolean)
    const states = rawStates
      .filter((s) => ReportStateEnum.safeParse(s).success)
      .map((s) => s as z.infer<typeof ReportStateEnum>)
    return this.reports.list({
      skip: Number(skip ?? 0),
      take: take === undefined || take === '' ? undefined : Number(take),
      states: states.length > 0 ? states : undefined,
      modality: modality?.trim() || undefined,
      priority: priority?.trim() || undefined,
      patientId: patientId?.trim() || undefined,
      doctorId: doctorId?.trim() || undefined,
      keyword: keyword?.trim() || undefined,
    })
  }

  // [W4-B] 批量导出: 静态子路由必须先于 :id / :id/export 注册
  @Post('batch-export')
  batchExport(
    @Body(new ZodValidationPipe(z.object({ ids: z.array(z.string().min(1)).min(1), format: z.string().default('pdf') }))) body: { ids: string[]; format: string },
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.createBatchExport(body, actorId)
  }

  // [v3.0.6.11-95 Wave3B P1] 批量状态流转 (参考 worklist batchTransition):
  //   逐条校验过渡 (REPORT_TRANSITIONS), 单条失败不阻断其余 → { succeeded[], failed[] }
  @Post('batch-transition')
  batchTransition(
    @Body(new ZodValidationPipe(z.object({
      ids: z.array(z.string().min(1)).min(1),
      to: ReportStateEnum,
      reason: z.string().optional(),
    }))) body: { ids: string[]; to: z.infer<typeof ReportStateEnum>; reason?: string },
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.batchTransition(body.ids, body.to as any, actorId, body.reason)
  }

  @Get('batch-export/:taskId')
  batchExportStatus(@Param('taskId') taskId: string) {
    return this.reports.getBatchExport(taskId)
  }

  // [W4-B] 导出文件下载 (reportExport consumer 生成的 HTML/PDF 文件)
  @Get('export-files/:fileName')
  downloadExportFile(@Param('fileName') fileName: string, @Res() res: Response) {
    const exportDir = process.env['REPORT_EXPORT_DIR'] || path.resolve(process.cwd(), 'exports', 'reports')
    const safeName = path.basename(fileName)
    const filePath = path.join(exportDir, safeName)
    if (!filePath.startsWith(exportDir) || !existsSync(filePath)) {
      throw new NotFoundException('Export file not found')
    }
    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`)
    createReadStream(filePath).pipe(res)
  }

  // [v3.0.6.11-88 P0] 单报告导出状态轮询 (ReportPage runRealExport 用)
  @Get(':id/export-status')
  exportStatus(@Param('id') id: string) {
    return this.reports.exportStatus(id)
  }

  // [v3.0.6.11-99 Wave 10D] 报告总览 (各状态/今日完成/平均时效) — 静态子路由先于 :id 注册
  @Get('overview')
  overview() {
    return this.reports.getOverview()
  }

  // [v3.0.6.11-99 Wave 10D] 医生维度报告统计
  @Get('by-doctor')
  byDoctor() {
    return this.reports.getByDoctor()
  }

  // [v3.0.6.11-99 Wave 10D] 近 30 日报告趋势
  @Get('daily-trend')
  dailyTrend(@Query('days') days?: string) {
    return this.reports.getDailyTrend(Number(days ?? 30))
  }

  // [G005 Wave 8] 报告冷归档策略 (静态子路由先于 :id 注册)
  @Get('archive-policy')
  getArchivePolicy() {
    return this.reports.getArchivePolicy()
  }

  @Put('archive-policy')
  updateArchivePolicy(
    @Body(new ZodValidationPipe(z.object({
      enabled: z.boolean().optional(),
      archiveAfterDays: z.number().int().min(1).max(36500).optional(),
      targetTier: z.enum(['archive', 'cold']).optional(),
      deleteSourceAfterDays: z.number().int().min(1).max(36500).nullable().optional(),
    }))) body: { enabled?: boolean; archiveAfterDays?: number; targetTier?: 'archive' | 'cold'; deleteSourceAfterDays?: number | null },
  ) {
    return this.reports.updateArchivePolicy(body)
  }

  // [G005 Wave 8] 报告冷归档: POST /reports/:id/archive
  @Post(':id/archive')
  archive(@Param('id') id: string, @Req() req: Request) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.archive(id, actorId)
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.reports.get(id)
  }

  // [v3.0.6.11-100 Wave 6A (D-4)] 报告关联病灶列表 (from-report 自动创建 → lesion-tracking)
  @Get(':id/lesions')
  reportLesions(@Param('id') id: string) {
    return this.reports.getReportLesions(id)
  }

  @Post()
  create(@Body(new ZodValidationPipe(CreateReportSchema)) body: z.infer<typeof CreateReportSchema>) {
    return this.reports.create(body)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body(new ZodValidationPipe(UpdateReportSchema)) body: z.infer<typeof UpdateReportSchema>) {
    return this.reports.update(id, body as { findings?: string; conclusion?: string; htmlContent?: string })
  }

  @Delete(':id')
  delete(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ reason: z.string().min(1) }))) body: { reason: string },
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.delete(id, body.reason, actorId)
  }

  @Post(':id/transition')
  transition(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ to: ReportStateEnum, actorId: z.string().min(1).optional(), reason: z.string().optional(), qualityScore: z.number().int().min(0).max(100).optional() })))
    body: { to: z.infer<typeof ReportStateEnum>; actorId?: string; reason?: string; qualityScore?: number },
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? body.actorId ?? 'unknown'
    return this.reports.transition(id, body.to as any, actorId, body.reason, body.qualityScore)
  }

  @Post(':id/export')
  exportReport(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ format: z.string().default('pdf') }))) body: { format: string },
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.exportReport(id, body.format, actorId)
  }

  @Get(':id/diff')
  diff(@Param('id') id: string) {
    return this.reports.diff(id)
  }

  @Get(':id/audit-trail')
  auditTrail(@Param('id') id: string) {
    return this.reports.auditTrail(id)
  }

  // [v3.0.6.11-100 Wave 2B] 报告关联影像标注 (阅片标注 → 报告双向同步)
  @Get(':id/image-annotations')
  imageAnnotations(@Param('id') id: string) {
    return this.reports.getImageAnnotations(id)
  }

  // [v3.0.6.11-100 Wave 2B] 保存 (覆盖) 报告关联影像标注
  @Post(':id/image-annotations')
  saveImageAnnotations(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(SaveImageAnnotationsSchema)) body: z.infer<typeof SaveImageAnnotationsSchema>,
    @Req() req: Request,
  ) {
    const actorId = (req.user as { id?: string } | undefined)?.id ?? 'unknown'
    return this.reports.saveImageAnnotations(id, body as any, actorId)
  }

  // [v3.0.6.11-99 Wave 10D] 报告关联: 检查/患者/既往报告/随访/危急值
  @Get(':id/related')
  related(@Param('id') id: string) {
    return this.reports.getRelated(id)
  }

  // [v3.0.6.11-100 Wave 6B (D-5)] 同患者既往报告摘要 (历史报告→本次报告字段复用)
  @Get(':id/prior-summary')
  priorSummary(@Param('id') id: string) {
    return this.reports.getPriorSummary(id)
  }

  // [v3.0.6.11-99 Wave 10D] 应用模板到报告 (合并 ReportTemplate 内容)
  @Post(':id/templates-apply')
  templatesApply(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(z.object({ templateId: z.string().min(1), mode: z.enum(['append', 'overwrite']).default('append') })))
    body: { templateId: string; mode?: 'append' | 'overwrite' },
  ) {
    return this.reports.applyTemplate(id, body.templateId, body.mode ?? 'append')
  }
}
