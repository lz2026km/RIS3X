import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import * as path from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { createNoopGateway, NotificationsGateway } from '../notifications/notifications.gateway'
import { currentTenantId } from '../common/tenant/tenant-utils'
import { SystemConfigService } from '../system-storage/system-config.service'
import { batchExportStore, createBatchExportTaskId } from '../queue/batch-export.store'
// [v3.0.6.11-100 Wave2C (报告工作站 P3)] 报告→随访自动触发: 规则匹配 + FollowUpService 创建计划
import { matchFollowUpTriggerRules } from '../modules/followup/followup-trigger-rules'
import { FollowUpService } from '../modules/followup/followup.service'
// [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪联动: GET /reports/:id/lesions 经 LesionTrackingService 查询
import { LesionTrackingService } from '../modules/lesion-tracking/lesion-tracking.service'
// [G005 Wave 8] 报告→危急值反向引用: 内存链接表 (criticals 模块导出, 与 batchExportStore 同风格直引)
import { criticalReportLinks } from '../criticals/criticals.service'
import type { Prisma, ReportState, Report } from '@prisma/client'

// [v3.0.6.11-100 Wave 2B (报告-MIP/3D + 影像标注)] 报告关联影像标注
export type ReportImageAnnotationType = 'arrow' | 'circle' | 'ruler' | 'box'

export interface ReportImageAnnotationItem {
  id: string
  type: ReportImageAnnotationType
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  color: string
}

export interface SaveReportImageAnnotationsDto {
  studyUid?: string
  seriesUid?: string
  instanceUid?: string
  annotations: ReportImageAnnotationItem[]
  imageBase64?: string
}

export interface ReportImageAnnotationsRecord {
  reportId: string
  studyUid: string
  seriesUid: string
  instanceUid: string
  annotations: ReportImageAnnotationItem[]
  imageBase64: string
  createdAt: string
  updatedAt: string
  createdBy: string
}

// [G005 Wave 8] 报告冷归档策略 (内存 + seed, 与 VNA lifecycle-policies 同风格)
export interface ReportArchivePolicy {
  enabled: boolean
  archiveAfterDays: number
  targetTier: 'archive' | 'cold'
  deleteSourceAfterDays: number | null
  updatedAt: string
}

export interface ReportArchivePolicyView extends ReportArchivePolicy {
  archivedCount: number
  pendingCount: number
}

export interface ReportArchiveTask {
  id: string
  reportId: string
  status: 'archived' | 'pending'
  targetTier: string
  archivedAt: string
  policyEnabled: boolean
}

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()

// [v3.0.6.11-100 Wave 6B (D-5)] 既往报告摘要: 常见诊断关键词库 (跨报告出现 ≥2 次聚合)
const PRIOR_SUMMARY_DIAG_KEYWORDS = [
  '结节', '磨玻璃影', '斑片影', '纤维化', '钙化', '占位', '囊肿', '气胸', '胸腔积液',
  '肺炎', '结核', '肿瘤', '淋巴结', '狭窄', '闭塞', '脑梗死', '出血', '水肿', '增生',
  '动脉瘤', '结石', '肝硬化', '骨质疏松', '骨折', '囊肿',
]

export const REPORT_TRANSITIONS: Record<ReportState, ReportState[]> = {
  PENDING_ASSIGNMENT: ['ASSIGNED', 'WRITING'],
  ASSIGNED: ['WRITING', 'REDISTRIBUTING'],
  WRITING: ['SUBMITTED', 'INITIAL_REVIEW', 'REJECTED'],
  SUBMITTED: ['INITIAL_REVIEW', 'REVIEWED', 'REJECTED', 'ESCALATED'],
  INITIAL_REVIEW: ['FINAL_REVIEW', 'REVIEWED', 'REJECTED', 'ESCALATED'],
  FINAL_REVIEW: ['CO_SIGN_REVIEW', 'REVIEWED', 'REJECTED', 'ESCALATED'],
  CO_SIGN_REVIEW: ['REVIEWED', 'REJECTED', 'ESCALATED'],
  REVIEWED: ['SIGNING', 'SIGNED', 'REJECTED', 'ESCALATED'],
  SIGNING: ['SIGNED', 'REJECTED'],
  SIGNED: ['PUBLISHED', 'AMENDING', 'AMENDED', 'RECTIFYING', 'SUPPLEMENTING'],
  // [v3.0.6.11-92 Wave2A P1] 补发自环: PUBLISHED → PUBLISHED (ReportPage 补发按钮, 记录 reportRevision 审计)
  PUBLISHED: ['AMENDING', 'AMENDED', 'SUPPLEMENTING', 'ARCHIVED', 'PUBLISHED'],
  AMENDING: ['AMENDED', 'REJECTED'],
  AMENDED: ['SIGNED', 'REJECTED'],
  REJECTED: ['WRITING'],
  WITHDRAWN: [],
  ESCALATED: ['REVIEWED', 'REJECTED'],
  ARCHIVED: [],
  RECTIFYING: ['REVIEWED', 'REJECTED'],
  SUPPLEMENTING: ['SUPPLEMENTED', 'REJECTED'],
  SUPPLEMENTED: ['PUBLISHED', 'REJECTED'],
  REDISTRIBUTING: ['ASSIGNED'],
}

// [v3.0.6.11-95 Wave3B P1] exam 关联派生字段: Report 表无 modality/bodyPart/priority,
//   list 查询 include exam 后在 DTO 透出 (PublishPage/书写页展示用)
type ReportWithExam = Report & {
  patient?: { id: string; name: string; gender: string } | null
  radiologist?: { id: string; fullName: string; role: string } | null
  exam?: { id: string; modality: string; bodyPart: string; priority: string; accessionNumber: string } | null
}

function toReportDto(r: ReportWithExam) {
  return {
    id: r.id,
    reportId: r.id,
    patientId: r.patientId,
    patientName: r.patient?.name ?? '',
    examId: r.examId ?? '',
    modality: r.exam?.modality ?? '',
    bodyPart: r.exam?.bodyPart ?? '',
    priority: r.exam?.priority ?? '',
    accessionNumber: r.exam?.accessionNumber ?? '',
    status: r.state,
    findings: r.findings,
    // [v3.0.6.11-98 Wave 1A P0] 富文本 HTML 持久化透出
    htmlContent: r.htmlContent ?? '',
    diagnosis: r.diagnosis,
    impression: r.impression,
    recommendations: r.recommendations,
    conclusion: r.conclusion,
    createdTime: r.createdAt?.toISOString() ?? '',
    updatedTime: r.updatedAt?.toISOString() ?? '',
    doctorId: r.radiologistId ?? '',
    radiologistId: r.radiologistId,
    state: r.state,
    isCritical: r.isCritical,
    hasCriticalValue: r.isCritical,
    qualityScore: r.qualityScore,
    reviewerId: r.reviewerId,
    coSignerId: r.coSignerId,
    signedAt: r.signedAt?.toISOString() ?? null,
    signedById: r.signedById ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    publishedAt: r.publishedAt?.toISOString() ?? null,
    rejectReason: r.rejectReason,
  }
}

@Injectable()
export class ReportsService {
  private readonly gateway: NotificationsGateway
  private readonly logger = new Logger(ReportsService.name)

  // [G005 Wave 8] 报告冷归档: 策略 (内存 + seed) + 归档任务记录
  private readonly archivePolicy: ReportArchivePolicy = {
    enabled: true,
    archiveAfterDays: 365,
    targetTier: 'archive',
    deleteSourceAfterDays: 90,
    updatedAt: new Date().toISOString(),
  }
  private readonly archiveTasks: ReportArchiveTask[] = [
    { id: 'RAT-000001', reportId: 'RPT-000001', status: 'archived', targetTier: 'archive', archivedAt: iso(60 * 24 * 30), policyEnabled: true },
    { id: 'RAT-000002', reportId: 'RPT-000024', status: 'archived', targetTier: 'archive', archivedAt: iso(60 * 24 * 90), policyEnabled: true },
    { id: 'RAT-000003', reportId: 'RPT-000085', status: 'pending', targetTier: 'archive', archivedAt: '', policyEnabled: true },
  ]
  private archiveTaskSeq = 100

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly systemConfig: SystemConfigService,
    gateway?: NotificationsGateway,
    // [v3.0.6.11-100 Wave2C P3] 报告→随访自动触发 (ReportsModule 导入 FollowUpModule), 可空 → 无依赖不阻塞
    private readonly followUp?: FollowUpService,
    // [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪 (ReportsModule 导入 LesionTrackingModule), 可空 → 返回空列表不阻塞
    @Optional() private readonly lesionTracking?: LesionTrackingService,
  ) {
    this.gateway = gateway ?? createNoopGateway()
  }

  // ══════════════════════════════════════════════════════════════════════
  // [v3.0.6.11-100 Wave2C (报告工作站 P3)] 报告→随访自动触发 (SUBMITTED 后置钩子)
  // 根据 impression/findings/conclusion 关键词匹配 followup-trigger-rules:
  //   mode=auto → 调 followup.service 自动创建随访计划 + auditLog 审计
  //   mode=hint (默认) → 不自动创建, 前端书写页「建议随访」卡片提示 (仅提示)
  // ══════════════════════════════════════════════════════════════════════
  private async maybeTriggerFollowUp(report: Report, actorId: string): Promise<void> {
    if (!this.followUp) return
    try {
      const mode = (await this.systemConfig.getString('followup_auto_trigger_mode', 'hint')).toLowerCase()
      if (mode !== 'auto') return // 仅提示模式: 不自动创建 (前端 FollowupAutoBookPanel 展示建议)
      const text = [report.impression ?? '', report.conclusion ?? '', report.findings ?? ''].join('\n')
      const matches = matchFollowUpTriggerRules(text)
      if (matches.length === 0) return
      const patientName = (report as unknown as { patient?: { name?: string } }).patient?.name ?? ''
      const res = await this.followUp.createFollowUpFromReport({
        reportId: report.id,
        patientId: report.patientId,
        patientName,
        examId: report.examId ?? undefined,
        planDate: new Date().toISOString().slice(0, 10),
        matches,
      })
      this.logger.log(`[FollowUpTrigger] report ${report.id} matched ${res.matched.join(',')}, created ${res.created} plans (mode=auto)`)
      try {
        await this.prisma.auditLog.create({
          data: {
            tenantId: currentTenantId(),
            userId: actorId,
            action: 'FOLLOWUP_TRIGGER',
            resource: 'report',
            resourceId: report.id,
            detail: { matched: res.matched, created: res.created, mode } as Prisma.InputJsonValue,
            success: true,
          },
        })
      } catch (err) {
        this.logger.warn(`[FollowUpTrigger] audit write failed: ${(err as Error).message}`)
      }
    } catch (err) {
      // 自动触发失败不阻塞状态流转 (仅告警)
      this.logger.warn(`[FollowUpTrigger] auto trigger failed for report ${report.id}: ${(err as Error).message}`)
    }
  }

  async list(params: { skip?: number; take?: number; states?: ReportState[]; modality?: string; priority?: string; patientId?: string; doctorId?: string; keyword?: string }) {
    const { skip = 0, states } = params
    // [v3.0.6.11-79] 默认分页大小读取 admin config default_page_size, 未配置回退 20
    const take = params.take ?? (await this.systemConfig.getNumber('default_page_size', 20))
    const where: any = { tenantId: currentTenantId() }
    // [v3.0.6.11-95 Wave3B P1] list 筛选: 状态数组 / 患者 / 报告医生 (直连字段)
    if (states?.length) where.state = states.length === 1 ? states[0] : { in: states }
    if (params.patientId) where.patientId = params.patientId
    if (params.doctorId) where.radiologistId = params.doctorId
    // modality/priority 不在 Report 表 → 经 exam 关联派生
    const examFilter: any = {}
    if (params.modality) examFilter.modality = params.modality
    if (params.priority) examFilter.priority = params.priority
    if (Object.keys(examFilter).length > 0) where.exam = { is: examFilter }
    // keyword: 模糊匹配患者姓名 / 检查号 (accessionNumber)
    if (params.keyword) {
      where.AND = [{
        OR: [
          { patient: { name: { contains: params.keyword } } },
          { exam: { is: { accessionNumber: { contains: params.keyword } } } },
        ],
      }]
    }
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        skip, take,
        where,
        include: {
          patient: { select: { id: true, name: true, gender: true } },
          exam: { select: { id: true, modality: true, bodyPart: true, priority: true, accessionNumber: true } },
        },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.report.count({ where }),
    ])
    return { items: items.map(toReportDto), total, skip, take }
  }

  async get(id: string) {
    const r = await this.prisma.report.findFirst({
      where: { id, tenantId: currentTenantId() },
      include: {
        patient: true,
        radiologist: { select: { id: true, fullName: true, role: true } },
        revisions: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!r) throw new NotFoundException(`Report ${id} not found`)
    return toReportDto(r as any)
  }

  // [v3.0.6.11-100 Wave 6A (D-4)] 报告关联病灶列表 (GET /reports/:id/lesions)
  // 按 reportId 查 from-report 自动创建的病灶记录
  async getReportLesions(id: string) {
    const r = await this.prisma.report.findUnique({ where: { id } })
    if (!r) throw new NotFoundException(`Report ${id} not found`)
    if (!this.lesionTracking) return { reportId: id, items: [] }
    return this.lesionTracking.listByReport(id)
  }

  async create(dto: { patientId: string; examId?: string; radiologistId?: string; findings: string; conclusion: string; htmlContent?: string }) {
    const r = await this.prisma.report.create({
      data: {
        patientId: dto.patientId,
        examId: dto.examId,
        radiologistId: dto.radiologistId,
        findings: dto.findings,
        htmlContent: dto.htmlContent ?? '',
        conclusion: dto.conclusion,
        state: 'PENDING_ASSIGNMENT',
        tenantId: currentTenantId(),
      },
      include: { patient: { select: { id: true, name: true, gender: true } } },
    })
    return toReportDto(r)
  }

  async update(id: string, dto: { findings?: string; conclusion?: string; htmlContent?: string }) {
    const { findings, conclusion, htmlContent } = dto
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.report.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Report ${id} not found`)
      try {
        const r = await tx.report.update({
          where: { id, version: current.version },
          data: {
            ...(findings !== undefined ? { findings } : {}),
            ...(conclusion !== undefined ? { conclusion } : {}),
            ...(htmlContent !== undefined ? { htmlContent } : {}),
            version: { increment: 1 },
          },
          include: { patient: { select: { id: true, name: true, gender: true } } },
        })
        return toReportDto(r)
      } catch (error: any) {
        if (error?.code === 'P2025') throw new ConflictException('版本冲突：该报告已被其他用户修改')
        throw error
      }
    })
  }

  async delete(id: string, reason: string, actorId: string) {
    if (!reason || !reason.trim()) {
      throw new BadRequestException('reason is required for report deletion')
    }
    if (!actorId || !actorId.trim()) {
      throw new BadRequestException('actorId is required for report deletion')
    }
    const existing = await this.prisma.report.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Report ${id} not found`)
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id },
        data: { state: 'WITHDRAWN' },
        include: { patient: { select: { id: true, name: true, gender: true } } },
      })
      await tx.reportRevision.create({
        data: {
          reportId: id,
          actorId,
          fromState: existing.state,
          toState: 'WITHDRAWN',
          reason,
          tenantId: currentTenantId(),
        },
      })
      return toReportDto(r)
    })
  }

  async exportReport(id: string, format: string, userId: string): Promise<{ queued: true }> {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException('Report not found')
    await this.queue.addReportExport({ reportId: id, format, userId })
    return { queued: true }
  }

  /**
   * [v3.0.6.11-88 P0] 单报告导出状态: 从 Report 派生
   * - 有 EXPORT_COMPLETED 审计记录 → completed + fileUrl (export-files 下载端点)
   * - 无导出记录 → processing (ReportPage 轮询直至 completed)
   */
  async exportStatus(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const latest = await this.prisma.auditLog.findFirst({
      where: { action: 'EXPORT_COMPLETED', resource: 'report-export', resourceId: id },
      orderBy: { createdAt: 'desc' },
    })
    if (latest) {
      const detail = (latest.detail ?? {}) as { filePath?: string }
      const fileName = detail.filePath ? path.basename(detail.filePath) : `report-${id}.html`
      return {
        status: 'completed',
        exportedAt: latest.createdAt?.toISOString() ?? null,
        fileUrl: `/reports/export-files/${encodeURIComponent(fileName)}`,
      }
    }
    return { status: 'processing' }
  }

  /** [W4-B] 批量报告导出: 创建任务 + 入队, 返回 taskId (前端轮询状态) */
  async createBatchExport(dto: { ids?: string[]; format?: string }, userId: string) {
    const ids = (dto.ids ?? []).filter((x) => typeof x === 'string' && x.trim().length > 0)
    if (ids.length === 0) throw new BadRequestException('ids is required')
    const format = (dto.format ?? 'pdf').toLowerCase()
    const taskId = createBatchExportTaskId()
    const task = batchExportStore.create(taskId, ids.length, format)
    await this.queue.addBatchExport({ taskId, ids, format, userId })
    return { taskId, status: task.status, total: task.total, format }
  }

  async getBatchExport(taskId: string) {
    const task = batchExportStore.get(taskId)
    if (!task) throw new NotFoundException(`Batch export task ${taskId} not found`)
    return task
  }

  async transition(id: string, to: ReportState, actorId: string, reason?: string) {
    // [v3.0.6.11-100 Wave2C P3] include patient → 随访触发取患者姓名
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { patient: { select: { name: true } } },
    })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const allowed = REPORT_TRANSITIONS[report.state] ?? []
    if (!allowed.includes(to)) {
      throw new BadRequestException(`INVALID_TRANSITION: ${report.state} → ${to} 不允许`)
    }
    if (to === 'REJECTED' && !reason?.trim()) {
      throw new BadRequestException('INVALID_TRANSITION: REJECTED 必须提供 reason')
    }
    const now = new Date()
    const data: Prisma.ReportUncheckedUpdateInput = { state: to }
    switch (to) {
      case 'SIGNED':
        data.signedAt = now
        data.signedById = actorId
        break
      case 'REVIEWED':
        data.reviewedAt = now
        data.reviewerId = actorId
        break
      case 'REJECTED':
        data.rejectReason = reason
        break
      case 'AMENDED':
        data.rectificationCount = { increment: 1 }
        if (reason?.trim()) data.amendmentReason = reason
        break
      case 'SUPPLEMENTING':
        data.supplementCount = { increment: 1 }
        break
      case 'PUBLISHED':
        data.publishedAt = now
        break
    }
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id },
        data,
        include: { patient: { select: { id: true, name: true, gender: true } } },
      })
      await tx.reportRevision.create({
        data: { reportId: id, actorId, fromState: report.state, toState: to, reason: reason ?? null, tenantId: currentTenantId() },
      })
      return toReportDto(r)
    }).then(async (dto) => {
      // W4-2: 报告状态变化 → 工作列表实时刷新; 签署/发布额外推送 notify
      this.gateway.emitWorklistRefresh()
      // [v3.0.6.11-100 Wave2C P3] 报告→随访自动触发: SUBMITTED 后置钩子 (auto 模式自动创建, 失败不阻塞)
      if (to === 'SUBMITTED') {
        await this.maybeTriggerFollowUp(report, actorId)
      }
      if (to === 'SIGNED' || to === 'PUBLISHED') {
        this.gateway.push('*', {
          event: 'notify',
          type: 'REPORT',
          action: to === 'SIGNED' ? 'signed' : 'published',
          title: to === 'SIGNED' ? '报告已签署' : '报告已发布',
          content: `报告 ${id} 状态: ${report.state} → ${to}`,
          notification: { reportId: id, fromState: report.state, toState: to },
          timestamp: Date.now(),
        })
      }
      return dto
    })
  }

  /**
   * [v3.0.6.11-95 Wave3B P1] 批量状态流转 (POST /reports/batch-transition):
   * 逐条校验过渡 (REPORT_TRANSITIONS), 单条失败不阻断其余;
   * 返回 { succeeded: [{ id, state }], failed: [{ id, message }] }
   */
  async batchTransition(ids: string[], to: ReportState, actorId: string, reason?: string) {
    const all = await this.prisma.report.findMany({
      where: { id: { in: ids }, tenantId: currentTenantId() },
      select: { id: true, state: true },
    })
    const stateById = new Map(all.map((r) => [r.id, r.state]))
    const succeeded: { id: string; state: string }[] = []
    const failed: { id: string; message: string }[] = []
    for (const id of ids) {
      const fromState = stateById.get(id)
      if (!fromState) {
        failed.push({ id, message: '报告不存在' })
        continue
      }
      const allowed = REPORT_TRANSITIONS[fromState] ?? []
      if (!allowed.includes(to)) {
        failed.push({ id, message: `INVALID_TRANSITION: ${fromState} → ${to} 不允许` })
        continue
      }
      if (to === 'REJECTED' && !reason?.trim()) {
        failed.push({ id, message: 'INVALID_TRANSITION: REJECTED 必须提供 reason' })
        continue
      }
      try {
        await this.transition(id, to, actorId, reason)
        succeeded.push({ id, state: to })
      } catch (e: any) {
        failed.push({ id, message: e?.message ?? '流转失败' })
      }
    }
    return { succeeded, failed }
  }

  // ══════════════════════════════════════════════════════════════════════
  // [G005 Wave 8] 报告冷归档策略 + 归档执行
  // ══════════════════════════════════════════════════════════════════════

  /** GET /reports/archive-policy — 归档策略视图 (内存 seed: 启用/归档天数/目标层级/删除源副本天数 + 任务统计) */
  getArchivePolicy(): ReportArchivePolicyView {
    return {
      ...this.archivePolicy,
      archivedCount: this.archiveTasks.filter((t) => t.status === 'archived').length,
      pendingCount: this.archiveTasks.filter((t) => t.status === 'pending').length,
    }
  }

  /** PUT /reports/archive-policy — 更新归档策略 (内存持久, 校验字段合法性) */
  updateArchivePolicy(dto: Partial<ReportArchivePolicy>): ReportArchivePolicyView {
    if (dto.enabled !== undefined && typeof dto.enabled !== 'boolean') {
      throw new BadRequestException('enabled 必须是布尔值')
    }
    if (dto.archiveAfterDays !== undefined) {
      const days = Number(dto.archiveAfterDays)
      if (!Number.isInteger(days) || days < 1 || days > 36500) {
        throw new BadRequestException('archiveAfterDays 必须是 1-36500 的整数')
      }
      this.archivePolicy.archiveAfterDays = days
    }
    if (dto.targetTier !== undefined) {
      if (!['archive', 'cold'].includes(dto.targetTier)) {
        throw new BadRequestException('targetTier 仅支持 archive|cold')
      }
      this.archivePolicy.targetTier = dto.targetTier
    }
    if (dto.deleteSourceAfterDays !== undefined) {
      if (dto.deleteSourceAfterDays !== null) {
        const days = Number(dto.deleteSourceAfterDays)
        if (!Number.isInteger(days) || days < 1 || days > 36500) {
          throw new BadRequestException('deleteSourceAfterDays 必须是 1-36500 的整数或 null')
        }
      }
      this.archivePolicy.deleteSourceAfterDays = dto.deleteSourceAfterDays as number | null
    }
    if (dto.enabled !== undefined) this.archivePolicy.enabled = dto.enabled
    this.archivePolicy.updatedAt = new Date().toISOString()
    this.logger.log(`[ReportArchive] policy updated: ${JSON.stringify(this.archivePolicy)}`)
    return this.getArchivePolicy()
  }

  /**
   * POST /reports/:id/archive — 冷归档单份报告。
   * 前置: 报告须为 PUBLISHED (REPORT_TRANSITIONS.PUBLISHED 含 ARCHIVED); 已归档幂等返回。
   * 落地: state→ARCHIVED + reportRevision + 归档任务记录 (内存) + auditLog。
   */
  async archive(id: string, actorId = 'unknown'): Promise<{ id: string; state: string; archivedAt: string; task: ReportArchiveTask; alreadyArchived?: boolean }> {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    if (report.state === 'ARCHIVED') {
      return { id, state: 'ARCHIVED', archivedAt: report.updatedAt?.toISOString() ?? new Date().toISOString(), alreadyArchived: true, task: this.archiveTasks.find((t) => t.reportId === id) ?? this.makeArchiveTask(id) }
    }
    const allowed = REPORT_TRANSITIONS[report.state] ?? []
    if (!allowed.includes('ARCHIVED')) {
      throw new BadRequestException(`INVALID_TRANSITION: ${report.state} → ARCHIVED 不允许 (仅已发布报告可归档)`)
    }
    const archivedAt = new Date()
    const task = this.makeArchiveTask(id, archivedAt.toISOString())
    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({ where: { id }, data: { state: 'ARCHIVED' } })
      await tx.reportRevision.create({
        data: { reportId: id, actorId, fromState: report.state, toState: 'ARCHIVED', reason: '冷归档', tenantId: currentTenantId() },
      })
    })
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId: currentTenantId(),
          userId: actorId,
          action: 'REPORT_ARCHIVED',
          resource: 'report',
          resourceId: id,
          detail: { targetTier: this.archivePolicy.targetTier, archiveAfterDays: this.archivePolicy.archiveAfterDays } as Prisma.InputJsonValue,
          success: true,
        },
      })
    } catch { /* DB 不可用时跳过审计 */ }
    this.gateway.emitWorklistRefresh()
    this.logger.log(`[ReportArchive] report ${id} archived (${this.archivePolicy.targetTier})`)
    return { id, state: 'ARCHIVED', archivedAt: archivedAt.toISOString(), task }
  }

  /** 批量归档 (逐条校验, 单条失败不阻断) — 供批量工具栏使用 */
  async archiveMany(ids: string[], actorId = 'unknown'): Promise<{ succeeded: Array<{ id: string }>; failed: Array<{ id: string; message: string }> }> {
    const succeeded: Array<{ id: string }> = []
    const failed: Array<{ id: string; message: string }> = []
    for (const id of ids) {
      try {
        await this.archive(id, actorId)
        succeeded.push({ id })
      } catch (e: any) {
        failed.push({ id, message: e?.message ?? '归档失败' })
      }
    }
    return { succeeded, failed }
  }

  private makeArchiveTask(reportId: string, archivedAt = ''): ReportArchiveTask {
    const task: ReportArchiveTask = {
      id: `RAT-${String(++this.archiveTaskSeq).padStart(6, '0')}`,
      reportId,
      status: 'archived',
      targetTier: this.archivePolicy.targetTier,
      archivedAt,
      policyEnabled: this.archivePolicy.enabled,
    }
    this.archiveTasks.unshift(task)
    return task
  }

  async diff(id: string) {
    const report = await this.prisma.report.findUnique({
      where: { id },
      include: { revisions: { orderBy: { createdAt: 'desc' }, take: 2 } },
    })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const revisions = (report as any).revisions ?? []
    const oldVersion = revisions.length >= 2 ? revisions[1] : null
    const newVersion = revisions.length >= 1 ? revisions[0] : null
    const changes: string[] = []
    if (oldVersion && newVersion) {
      if (oldVersion.fromState !== newVersion.fromState) changes.push(`State: ${oldVersion.fromState} → ${newVersion.fromState}`)
    }
    return {
      oldVersion: oldVersion ? { findings: oldVersion.findings ?? '', conclusion: oldVersion.conclusion ?? '', state: oldVersion.fromState } : null,
      newVersion: newVersion ? { findings: newVersion.findings ?? '', conclusion: newVersion.conclusion ?? '', state: newVersion.toState } : null,
      changes,
    }
  }

  async auditTrail(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const revisions = await this.prisma.reportRevision.findMany({
      where: { reportId: id },
      orderBy: { createdAt: 'desc' },
    })
    return {
      events: revisions.map((r) => ({
        id: r.id,
        timestamp: r.createdAt?.toISOString() ?? '',
        actor: r.actorId,
        action: `${r.fromState} → ${r.toState}`,
        fromState: r.fromState,
        toState: r.toState,
        reason: r.reason ?? undefined,
      })),
    }
  }

  // ============ [v3.0.6.11-99 Wave 10D] 总览 / 医生维度 / 30日趋势 / 关联 / 模板应用 ============

  /** 日期工具: 近 N 天日期数组 (升序, YYYY-MM-DD, 本地时区) */
  private lastNDays(days: number): string[] {
    const out: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      out.push(this.dateKey(d))
    }
    return out
  }

  /** 本地时区 YYYY-MM-DD (避免 toISOString UTC 跨日错位) */
  private dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  private seedOverview() {
    return {
      total: 124,
      todayCreated: 9,
      todayCompleted: 7,
      todaySigned: 5,
      todayPublished: 2,
      criticalCount: 3,
      pendingCount: 16,
      overdueCount: 4,
      avgTurnaroundHours: 4.6,
      byStatus: {
        PENDING_ASSIGNMENT: 6, ASSIGNED: 4, WRITING: 6, SUBMITTED: 3, INITIAL_REVIEW: 2,
        FINAL_REVIEW: 2, CO_SIGN_REVIEW: 1, REVIEWED: 3, SIGNING: 2, SIGNED: 18,
        PUBLISHED: 71, AMENDING: 1, AMENDED: 2, REJECTED: 1, ESCALATED: 1, ARCHIVED: 1,
      },
    }
  }

  /**
   * GET /reports/overview — 报告总览: 各状态计数 / 今日完成 / 平均时效 (h)。
   * 数据源: report groupBy(state) + signedAt/publishedAt 今日 + createdAt→signedAt 平均时效; 空数据 seed 回退。
   */
  async getOverview() {
    const where = { tenantId: currentTenantId() }
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    try {
      const [byStateRows, todayCreated, todaySigned, todayPublished, criticalCount, completedReports, overdueCount] = await Promise.all([
        this.prisma.report.groupBy({ by: ['state'], where, _count: { _all: true } }),
        this.prisma.report.count({ where: { ...where, createdAt: { gte: start } } }),
        this.prisma.report.count({ where: { ...where, signedAt: { gte: start } } }),
        this.prisma.report.count({ where: { ...where, publishedAt: { gte: start } } }),
        this.prisma.report.count({ where: { ...where, isCritical: true } }),
        this.prisma.report.findMany({
          where: { ...where, signedAt: { not: null } },
          select: { createdAt: true, signedAt: true },
          take: 500,
        }),
        this.prisma.report.count({
          where: {
            ...where,
            createdAt: { lte: new Date(Date.now() - 24 * 3600000) },
            state: { in: ['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING', 'SUBMITTED'] },
          },
        }),
      ])
      const byStatus: Record<string, number> = {}
      for (const g of byStateRows) byStatus[g.state] = g._count._all
      const total = Object.values(byStatus).reduce((a, b) => a + b, 0)
      const hours = completedReports
        .map((r) => (r.signedAt!.getTime() - r.createdAt.getTime()) / 3600000)
        .filter((h) => Number.isFinite(h) && h >= 0)
      const pendingCount = (byStatus['PENDING_ASSIGNMENT'] ?? 0) + (byStatus['ASSIGNED'] ?? 0) + (byStatus['WRITING'] ?? 0)
      if (total === 0 && todayCreated === 0) return this.seedOverview()
      return {
        total,
        todayCreated,
        todayCompleted: (todaySigned ?? 0) + (todayPublished ?? 0),
        todaySigned: todaySigned ?? 0,
        todayPublished: todayPublished ?? 0,
        criticalCount,
        pendingCount,
        overdueCount: overdueCount ?? 0,
        avgTurnaroundHours: hours.length > 0 ? Number((hours.reduce((a, b) => a + b, 0) / hours.length).toFixed(1)) : 0,
        byStatus,
      }
    } catch (err) {
      this.logger?.warn?.(`[Reports] getOverview failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedOverview()
    }
  }

  /**
   * GET /reports/by-doctor — 医生维度报告统计: 各医生 总数/已发布/待处理/平均时效。
   * 数据源: report groupBy(radiologistId) + user 姓名; 无记录 seed 回退。
   */
  async getByDoctor() {
    const where = { tenantId: currentTenantId() }
    try {
      const [rows, signed] = await Promise.all([
        this.prisma.report.groupBy({ by: ['radiologistId', 'state'], where, _count: { _all: true } }),
        this.prisma.report.findMany({
          where: { ...where, radiologistId: { not: null }, signedAt: { not: null } },
          select: { radiologistId: true, createdAt: true, signedAt: true },
          take: 1000,
        }),
      ])
      const userIds = [...new Set(rows.map((r) => r.radiologistId).filter((x): x is string => Boolean(x)))]
      const users = userIds.length > 0
        ? await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, fullName: true } })
        : []
      const nameById = new Map(users.map((u) => [u.id, u.fullName]))
      const totals = new Map<string, { total: number; published: number; pending: number; durations: number[] }>()
      for (const r of rows) {
        const key = r.radiologistId ?? 'unassigned'
        const entry = totals.get(key) ?? { total: 0, published: 0, pending: 0, durations: [] }
        entry.total += r._count._all
        if (r.state === 'PUBLISHED' || r.state === 'SIGNED') entry.published += r._count._all
        if (['PENDING_ASSIGNMENT', 'ASSIGNED', 'WRITING', 'SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW', 'REVIEWED'].includes(r.state)) {
          entry.pending += r._count._all
        }
        totals.set(key, entry)
      }
      for (const s of signed) {
        const key = s.radiologistId ?? 'unassigned'
        const entry = totals.get(key)
        if (entry) {
          const h = (s.signedAt!.getTime() - s.createdAt.getTime()) / 3600000
          if (Number.isFinite(h) && h >= 0) entry.durations.push(h)
        }
      }
      const doctors = [...totals.entries()].map(([id, t]) => ({
        id,
        name: nameById.get(id) ?? (id === 'unassigned' ? '未分配' : '未知医生'),
        total: t.total,
        published: t.published,
        pending: t.pending,
        avgTurnaroundHours: t.durations.length > 0 ? Number((t.durations.reduce((a, b) => a + b, 0) / t.durations.length).toFixed(1)) : 0,
      })).sort((a, b) => b.total - a.total)
      if (doctors.length === 0 || (doctors.length === 1 && doctors[0]?.id === 'unassigned')) {
        return {
          items: [
            { id: 'doc-seed-1', name: '王医生', total: 32, published: 28, pending: 4, avgTurnaroundHours: 3.2 },
            { id: 'doc-seed-2', name: '李医生', total: 27, published: 23, pending: 4, avgTurnaroundHours: 5.1 },
            { id: 'doc-seed-3', name: '张医生', total: 21, published: 18, pending: 3, avgTurnaroundHours: 6.4 },
            { id: 'doc-seed-4', name: '陈医生', total: 16, published: 13, pending: 3, avgTurnaroundHours: 4.8 },
          ],
          total: 4,
        }
      }
      return { items: doctors, total: doctors.length }
    } catch (err) {
      this.logger?.warn?.(`[Reports] getByDoctor failed, fallback seed: ${(err as Error)?.message}`)
      return {
        items: [
          { id: 'doc-seed-1', name: '王医生', total: 32, published: 28, pending: 4, avgTurnaroundHours: 3.2 },
          { id: 'doc-seed-2', name: '李医生', total: 27, published: 23, pending: 4, avgTurnaroundHours: 5.1 },
        ],
        total: 2,
      }
    }
  }

  /**
   * GET /reports/daily-trend — 近 30 日报告趋势: 每日 新建/完成 (发布) 数。
   * 数据源: report createdAt / publishedAt 分桶; 空数据 seed 回退 (确定性模式)。
   */
  async getDailyTrend(days = 30) {
    const n = Number.isFinite(days) && days > 0 && days <= 365 ? Math.floor(days) : 30
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (n - 1))
    try {
      const [created, published, signed] = await Promise.all([
        this.prisma.report.findMany({ where: { tenantId: currentTenantId(), createdAt: { gte: start } }, select: { createdAt: true } }),
        this.prisma.report.findMany({ where: { tenantId: currentTenantId(), publishedAt: { gte: start } }, select: { publishedAt: true } }),
        this.prisma.report.findMany({ where: { tenantId: currentTenantId(), signedAt: { gte: start } }, select: { signedAt: true } }),
      ])
      const dates = this.lastNDays(n)
      const createdMap = new Map<string, number>()
      const publishedMap = new Map<string, number>()
      const signedMap = new Map<string, number>()
      for (const r of created) {
        const key = this.dateKey(r.createdAt)
        createdMap.set(key, (createdMap.get(key) ?? 0) + 1)
      }
      for (const r of published) {
        const key = this.dateKey(r.publishedAt!)
        publishedMap.set(key, (publishedMap.get(key) ?? 0) + 1)
      }
      for (const r of signed) {
        const key = this.dateKey(r.signedAt!)
        signedMap.set(key, (signedMap.get(key) ?? 0) + 1)
      }
      const items = dates.map((date) => ({
        date,
        created: createdMap.get(date) ?? 0,
        published: publishedMap.get(date) ?? 0,
        signed: signedMap.get(date) ?? 0,
      }))
      const totalCreated = items.reduce((a, i) => a + i.created, 0)
      if (totalCreated === 0) {
        return {
          items: dates.map((date, idx) => ({
            date,
            created: 3 + ((idx * 7) % 9),
            published: 2 + ((idx * 5) % 8),
            signed: 1 + ((idx * 4) % 7),
          })),
          total: n,
        }
      }
      return { items, total: n }
    } catch (err) {
      this.logger?.warn?.(`[Reports] getDailyTrend failed, fallback seed: ${(err as Error)?.message}`)
      const dates = this.lastNDays(n)
      return {
        items: dates.map((date, idx) => ({
          date,
          created: 3 + ((idx * 7) % 9),
          published: 2 + ((idx * 5) % 8),
          signed: 1 + ((idx * 4) % 7),
        })),
        total: n,
      }
    }
  }

  /**
   * GET /reports/:id/prior-summary — 同患者既往报告摘要 (D-5 历史报告→本次报告字段复用)。
   * 数据源: 同患者其他报告 (排除自身, createdAt desc); 无既往记录 seed 回退 (source: 'seed')。
   * 返回: { count, lastReportDate, lastFindings, lastImpression, commonDiagnoses[], source }
   *   commonDiagnoses: 诊断关键词在 ≥2 份既往报告的结论/所见中出现 → 按频次降序。
   */
  async getPriorSummary(id: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, tenantId: currentTenantId() },
      select: { id: true, patientId: true },
    })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const prior = await this.prisma.report.findMany({
      where: { patientId: report.patientId, id: { not: id }, tenantId: currentTenantId() },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, findings: true, impression: true, conclusion: true, createdAt: true },
    })
    if (prior.length === 0) {
      return {
        reportId: report.id,
        patientId: report.patientId,
        count: 3,
        lastReportDate: iso(60 * 24 * 30),
        lastFindings: '双肺纹理稍增多,右肺下叶可见条索状高密度影。',
        lastImpression: '右肺下叶陈旧性病灶,建议定期随访。',
        commonDiagnoses: [
          { keyword: '结节', count: 2 },
          { keyword: '钙化', count: 2 },
        ],
        source: 'seed',
      }
    }
    const last = prior[0]!
    const freq = new Map<string, number>()
    for (const r of prior) {
      const text = `${r.conclusion ?? ''} ${r.impression ?? ''} ${r.findings ?? ''}`
      const found = new Set<string>()
      for (const kw of PRIOR_SUMMARY_DIAG_KEYWORDS) {
        if (text.includes(kw)) found.add(kw)
      }
      for (const kw of found) freq.set(kw, (freq.get(kw) ?? 0) + 1)
    }
    const commonDiagnoses = [...freq.entries()]
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([keyword, count]) => ({ keyword, count }))
    return {
      reportId: report.id,
      patientId: report.patientId,
      count: prior.length,
      lastReportDate: last.createdAt?.toISOString() ?? null,
      lastFindings: last.findings ?? '',
      lastImpression: last.conclusion || last.impression || '',
      commonDiagnoses,
      source: 'db',
    }
  }

  /**
   * GET /reports/:id/related — 报告关联信息: 检查 / 患者 / 既往报告 / 随访计划 / 危急值。
   * 数据源: report → exam/patient + 同患者其他报告 + followUpPlan (reportId/patientId) + criticalValue (patientId/examId)。
   */
  async getRelated(id: string) {
    const report = await this.prisma.report.findFirst({
      where: { id, tenantId: currentTenantId() },
      include: {
        patient: { select: { id: true, name: true, gender: true, birthDate: true, phone: true } },
        exam: { select: { id: true, accessionNumber: true, modality: true, bodyPart: true, state: true, scheduledAt: true, completedAt: true } },
      },
    })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const patientId = report.patientId
    const examId = report.examId ?? undefined
    const [previousReports, followUpPlans, criticalValues] = await Promise.all([
      this.prisma.report.findMany({
        where: { patientId, id: { not: id }, tenantId: currentTenantId() },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { id: true, state: true, findings: true, conclusion: true, createdAt: true, isCritical: true },
      }),
      (this.prisma as any).followUpPlan
        ? this.prisma.followUpPlan.findMany({
            where: { patientId, ...(examId ? { OR: [{ reportId: id }, { examId }] } : { reportId: id }) },
            orderBy: { nextDate: 'asc' },
            take: 10,
          }).catch(() => [])
        : Promise.resolve([]),
      this.prisma.criticalValue.findMany({
        where: { patientId, ...(examId ? { OR: [{ examId }] } : {}) },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ])
    // [G005 Wave 8] 报告→危急值反向引用: 合并内存链接 (报告→危急值转入时记录), 去重 + 标记 linkedByReport
    const dbCriticalIds = new Set(criticalValues.map((c) => c.id))
    const linkedCritical: Record<string, unknown>[] = []
    for (const rec of criticalReportLinks.get(id) ?? []) {
      if (dbCriticalIds.has(rec.id)) continue
      linkedCritical.push({
        id: rec.id,
        description: rec.description,
        severity: rec.severity,
        state: rec.state,
        createdAt: rec.createdAt,
        linkedByReport: true,
      })
    }
    return {
      reportId: report.id,
      patient: report.patient,
      exam: report.exam,
      previousReports,
      followUpPlans: followUpPlans.map((p: any) => ({
        id: p.id,
        planDate: p.planDate?.toISOString?.() ?? '',
        nextDate: p.nextDate?.toISOString?.() ?? '',
        status: p.status,
        note: p.note,
      })),
      criticalValues: [
        ...criticalValues.map((c) => ({
          id: c.id,
          description: c.description,
          severity: c.severity,
          state: c.state,
          createdAt: c.createdAt?.toISOString?.() ?? '',
          linkedByReport: false,
        })),
        ...linkedCritical,
      ],
    }
  }

  /**
   * POST /reports/:id/templates-apply — 应用模板到报告: 合并 ReportTemplate body/structure 到 findings/htmlContent。
   * mode: append (默认, 追加) | overwrite (覆盖)。
   */
  async applyTemplate(id: string, templateId: string, mode: 'append' | 'overwrite' = 'append') {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const template = await this.prisma.reportTemplate.findUnique({ where: { id: templateId } })
    if (!template) throw new NotFoundException(`ReportTemplate ${templateId} not found`)
    const body = template.body ?? ''
    const structure = (template.structure ?? []) as Array<{ type?: string; content?: string }>
    const content = body.trim() || structure.map((b) => b.content ?? '').filter(Boolean).join('\n')
    const r = await this.prisma.report.update({
      where: { id, version: report.version },
      data: {
        ...(mode === 'overwrite'
          ? { findings: content, htmlContent: content }
          : {
              findings: [report.findings, content].filter(Boolean).join('\n'),
              htmlContent: [report.htmlContent, content].filter(Boolean).join('\n'),
            }),
        version: { increment: 1 },
      },
      include: { patient: { select: { id: true, name: true, gender: true } } },
    })
    return {
      ...toReportDto(r),
      templateApplied: { templateId, name: template.name, mode },
    }
  }

  // ============ [v3.0.6.11-100 Wave 2B] 报告-影像标注双向同步 ============

  /**
   * 报告关联影像标注 (内存存储, 与 report-annotation 模块同风格):
   *  - POST /reports/:id/image-annotations 保存/覆盖该报告标注 JSON
   *  - GET  /reports/:id/image-annotations 读取 (无记录返回空列表形状)
   */
  private imageAnnotations = new Map<string, ReportImageAnnotationsRecord>([
    [
      'RPT-000001',
      {
        reportId: 'RPT-000001',
        studyUid: '1.2.840.10008.5.1.4.1.1.2.1.1',
        seriesUid: '1.2.840.10008.5.1.4.1.1.2.1.1.1',
        instanceUid: '1.2.840.10008.5.1.4.1.1.2.1.1.1.1',
        annotations: [
          { id: 'img-ann-001', type: 'arrow', x1: 120, y1: 140, x2: 165, y2: 120, label: '右肺上叶结节', color: '#ff4d4f' },
          { id: 'img-ann-002', type: 'ruler', x1: 210, y1: 230, x2: 280, y2: 230, label: '长径 12.5mm', color: '#fbbf24' },
          { id: 'img-ann-003', type: 'circle', x1: 300, y1: 180, x2: 360, y2: 240, label: '磨玻璃影 ROI', color: '#22c55e' },
        ],
        imageBase64: '',
        createdAt: iso(60 * 5),
        updatedAt: iso(60 * 5),
        createdBy: '张海涛',
      },
    ],
  ])

  /** 校验单个标注项 (类型 + 有限坐标), 非法抛 BadRequest */
  private validateImageAnnotationItem(item: unknown, index: number): ReportImageAnnotationItem {
    const raw = (item ?? {}) as Record<string, unknown>
    const id = String(raw.id ?? '').trim()
    const type = String(raw.type ?? '') as ReportImageAnnotationType
    const label = String(raw.label ?? '').trim().slice(0, 128)
    const color = String(raw.color ?? '#fbbf24').trim() || '#fbbf24'
    if (!id) throw new BadRequestException(`annotations[${index}].id 必填`)
    if (!['arrow', 'circle', 'ruler', 'box'].includes(type)) {
      throw new BadRequestException(`annotations[${index}].type 仅支持 arrow|circle|ruler|box`)
    }
    const nums = [Number(raw.x1), Number(raw.y1), Number(raw.x2), Number(raw.y2)]
    if (nums.some((n) => !Number.isFinite(n))) {
      throw new BadRequestException(`annotations[${index}] 坐标必须是数字`)
    }
    return { id, type, x1: nums[0]!, y1: nums[1]!, x2: nums[2]!, y2: nums[3]!, label, color }
  }

  /**
   * POST /reports/:id/image-annotations — 保存 (覆盖) 报告关联影像标注。
   * body: { studyUid?, seriesUid?, instanceUid?, annotations: [...], imageBase64? }
   */
  async saveImageAnnotations(id: string, dto: SaveReportImageAnnotationsDto, actorId = 'unknown') {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const rawList = Array.isArray(dto.annotations) ? dto.annotations : []
    if (rawList.length === 0) throw new BadRequestException('annotations 至少 1 条')
    if (rawList.length > 200) throw new BadRequestException('annotations 最多 200 条')
    const annotations = rawList.map((a, i) => this.validateImageAnnotationItem(a, i))
    const now = new Date().toISOString()
    const record: ReportImageAnnotationsRecord = {
      reportId: id,
      studyUid: String(dto.studyUid ?? '').trim(),
      seriesUid: String(dto.seriesUid ?? '').trim(),
      instanceUid: String(dto.instanceUid ?? '').trim(),
      annotations,
      imageBase64: String(dto.imageBase64 ?? '').trim().slice(0, 8_000_000),
      createdAt: this.imageAnnotations.get(id)?.createdAt ?? now,
      updatedAt: now,
      createdBy: actorId,
    }
    this.imageAnnotations.set(id, record)
    return { ...record }
  }

  /**
   * GET /reports/:id/image-annotations — 读取报告关联影像标注 (无记录返回空列表形状)。
   */
  async getImageAnnotations(id: string) {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    const record = this.imageAnnotations.get(id)
    if (!record) {
      return {
        reportId: id,
        studyUid: '',
        seriesUid: '',
        instanceUid: '',
        annotations: [] as ReportImageAnnotationItem[],
        imageBase64: '',
        updatedAt: null,
      }
    }
    return { ...record }
  }
}
