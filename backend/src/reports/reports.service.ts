import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as path from 'node:path'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { createNoopGateway, NotificationsGateway } from '../notifications/notifications.gateway'
import { currentTenantId } from '../common/tenant/tenant-utils'
import { SystemConfigService } from '../system-storage/system-config.service'
import { batchExportStore, createBatchExportTaskId } from '../queue/batch-export.store'
import type { Prisma, ReportState, Report } from '@prisma/client'

export const REPORT_TRANSITIONS: Record<ReportState, ReportState[]> = {
  PENDING_ASSIGNMENT: ['ASSIGNED', 'WRITING'],
  ASSIGNED: ['WRITING', 'REDISTRIBUTING'],
  WRITING: ['SUBMITTED', 'INITIAL_REVIEW', 'REJECTED'],
  SUBMITTED: ['INITIAL_REVIEW', 'REVIEWED', 'REJECTED'],
  INITIAL_REVIEW: ['FINAL_REVIEW', 'REVIEWED', 'REJECTED'],
  FINAL_REVIEW: ['CO_SIGN_REVIEW', 'REVIEWED', 'REJECTED'],
  CO_SIGN_REVIEW: ['REVIEWED', 'REJECTED'],
  REVIEWED: ['SIGNING', 'SIGNED', 'REJECTED'],
  SIGNING: ['SIGNED', 'REJECTED'],
  SIGNED: ['PUBLISHED', 'AMENDING', 'AMENDED', 'RECTIFYING', 'SUPPLEMENTING'],
  PUBLISHED: ['AMENDING', 'AMENDED', 'SUPPLEMENTING', 'ARCHIVED'],
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

function toReportDto(r: Report & { patient?: { id: string; name: string; gender: string } | null; radiologist?: { id: string; fullName: string; role: string } | null }) {
  return {
    id: r.id,
    reportId: r.id,
    patientId: r.patientId,
    patientName: r.patient?.name ?? '',
    examId: r.examId ?? '',
    modality: '',
    bodyPart: '',
    status: r.state,
    findings: r.findings,
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
    private readonly systemConfig: SystemConfigService,
    gateway?: NotificationsGateway,
  ) {
    this.gateway = gateway ?? createNoopGateway()
  }

  async list(params: { skip?: number; take?: number; state?: ReportState }) {
    const { skip = 0, state } = params
    // [v3.0.6.11-79] 默认分页大小读取 admin config default_page_size, 未配置回退 20
    const take = params.take ?? (await this.systemConfig.getNumber('default_page_size', 20))
    const where: any = { tenantId: currentTenantId() }
    if (state) where.state = state
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        skip, take,
        where,
        include: { patient: { select: { id: true, name: true, gender: true } } },
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

  async create(dto: { patientId: string; examId?: string; radiologistId?: string; findings: string; conclusion: string }) {
    const r = await this.prisma.report.create({
      data: {
        patientId: dto.patientId,
        examId: dto.examId,
        radiologistId: dto.radiologistId,
        findings: dto.findings,
        conclusion: dto.conclusion,
        state: 'PENDING_ASSIGNMENT',
        tenantId: currentTenantId(),
      },
      include: { patient: { select: { id: true, name: true, gender: true } } },
    })
    return toReportDto(r)
  }

  async update(id: string, dto: { findings?: string; conclusion?: string }) {
    const { findings, conclusion } = dto
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.report.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Report ${id} not found`)
      try {
        const r = await tx.report.update({
          where: { id, version: current.version },
          data: {
            ...(findings !== undefined ? { findings } : {}),
            ...(conclusion !== undefined ? { conclusion } : {}),
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
    const report = await this.prisma.report.findUnique({ where: { id } })
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
    }).then((dto) => {
      // W4-2: 报告状态变化 → 工作列表实时刷新; 签署/发布额外推送 notify
      this.gateway.emitWorklistRefresh()
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
}
