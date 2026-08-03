import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'
import type { ReportState, Report } from '@prisma/client'

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
    rejectReason: r.rejectReason,
  }
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queue: QueueService,
  ) {}

  async list(params: { skip?: number; take?: number; state?: ReportState }) {
    const { skip = 0, take = 20, state } = params
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        skip, take,
        where: state ? { state } : undefined,
        include: { patient: { select: { id: true, name: true, gender: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.report.count({ where: state ? { state } : undefined }),
    ])
    return { items: items.map(toReportDto), total, skip, take }
  }

  async get(id: string) {
    const r = await this.prisma.report.findUnique({
      where: { id },
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
        tenantId: getCurrentTenantId(),
      },
      include: { patient: { select: { id: true, name: true, gender: true } } },
    })
    return toReportDto(r)
  }

  async update(id: string, dto: { findings?: string; conclusion?: string; state?: ReportState }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.report.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Report ${id} not found`)
      try {
        const r = await tx.report.update({
          where: { id, version: current.version },
          data: { ...dto, version: { increment: 1 } },
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
          tenantId: getCurrentTenantId(),
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

  async transition(id: string, to: ReportState, actorId: string, reason?: string) {
    const report = await this.prisma.report.findUnique({ where: { id } })
    if (!report) throw new NotFoundException(`Report ${id} not found`)
    return this.prisma.$transaction(async (tx) => {
      const r = await tx.report.update({
        where: { id },
        data: { state: to },
        include: { patient: { select: { id: true, name: true, gender: true } } },
      })
      await tx.reportRevision.create({
        data: { reportId: id, actorId, fromState: report.state, toState: to, reason: reason ?? null, tenantId: getCurrentTenantId() },
      })
      return toReportDto(r)
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
