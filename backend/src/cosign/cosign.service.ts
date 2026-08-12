import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { ReportsService } from '../reports/reports.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

/** 待双签条目:以 Report(state=CO_SIGN_REVIEW) 为真实业务源,替代 auditLog */
export interface PendingRow {
  id: string
  reportId: string
  patientName: string
  modality: string
  bodyPart: string
  priority: string
  submittedAt: string
  authorId: string
  authorName: string
  reason: string
  level: string
  waitingHours: number
  status: string
  clinicalInfo?: string
}

const reportInclude = {
  patient: { select: { id: true, name: true } },
  exam: { select: { modality: true, bodyPart: true } },
  radiologist: { select: { id: true, fullName: true } },
} as const

function toPendingRow(r: {
  id: string
  patientId: string
  examId: string | null
  radiologistId: string | null
  state: string
  impression: string
  createdAt: Date
  updatedAt: Date
  patient?: { id: string; name: string } | null
  exam?: { modality: string; bodyPart: string } | null
  radiologist?: { id: string; fullName: string } | null
}): PendingRow {
  const waitingHours = Math.max(0, Math.floor((Date.now() - r.createdAt.getTime()) / 3_600_000))
  return {
    id: r.id,
    reportId: r.id,
    patientName: r.patient?.name ?? '',
    modality: r.exam?.modality ?? '',
    bodyPart: r.exam?.bodyPart ?? '',
    priority: 'routine',
    submittedAt: r.createdAt.toISOString(),
    authorId: r.radiologistId ?? '',
    authorName: r.radiologist?.fullName ?? r.radiologistId ?? '报告医生',
    reason: 'cosign-required',
    level: 'cosign',
    waitingHours,
    status: r.state,
    clinicalInfo: r.impression?.trim() || undefined,
  }
}

@Injectable()
export class CosignService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
  ) {}

  /** 待双签列表:Report 表 state=CO_SIGN_REVIEW (真实业务表,替代 auditLog) */
  async listPendingCosigns(): Promise<{ data: PendingRow[] }> {
    const rows = await this.prisma.report.findMany({
      where: { state: 'CO_SIGN_REVIEW', tenantId: getCurrentTenantId() },
      include: reportInclude,
      orderBy: { updatedAt: 'desc' },
    })
    return { data: rows.map((r) => toPendingRow(r as any)) }
  }

  async getPendingCosign(id: string) {
    const row = await this.prisma.report.findUnique({ where: { id }, include: reportInclude })
    return { data: row ? [toPendingRow(row as any)] : [] }
  }

  /** 双签通过:CO_SIGN_REVIEW → REVIEWED (reports.transition 负责状态校验+revision 审计),再写 coSignerId/coSignedAt */
  async approveCosign(reportId: string, actorId: string, body: { comment?: string }) {
    const current = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!current) throw new NotFoundException(`Report ${reportId} not found`)
    if (current.state !== 'CO_SIGN_REVIEW') {
      throw new BadRequestException(`INVALID_TRANSITION: 报告当前状态 ${current.state},仅 CO_SIGN_REVIEW 可双签通过`)
    }
    const updated = await this.reports.transition(reportId, 'REVIEWED', actorId, body?.comment)
    await this.prisma.report.update({
      where: { id: reportId },
      data: { coSignerId: actorId, coSignedAt: new Date() },
    })
    await this.prisma.auditLog.create({
      data: {
        action: 'APPROVE', resource: 'cosign', resourceId: reportId,
        detail: { ...body, actorId } as Prisma.InputJsonValue,
        success: true, tenantId: getCurrentTenantId(),
      },
    })
    return { data: [updated] }
  }

  /** 双签拒绝:CO_SIGN_REVIEW → REJECTED + rejectReason */
  async rejectCosign(reportId: string, actorId: string, body: { reason: string }) {
    const current = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!current) throw new NotFoundException(`Report ${reportId} not found`)
    if (current.state !== 'CO_SIGN_REVIEW') {
      throw new BadRequestException(`INVALID_TRANSITION: 报告当前状态 ${current.state},仅 CO_SIGN_REVIEW 可拒签`)
    }
    const updated = await this.reports.transition(reportId, 'REJECTED', actorId, body.reason)
    await this.prisma.auditLog.create({
      data: {
        action: 'REJECT', resource: 'cosign', resourceId: reportId,
        detail: { ...body, actorId } as Prisma.InputJsonValue,
        success: false, tenantId: getCurrentTenantId(),
      },
    })
    return { data: [updated] }
  }

  async listCosignHistory() {
    const data = await this.prisma.auditLog.findMany({
      where: { resource: 'cosign' },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    return {
      data: data.map((a) => {
        const detail = (a.detail ?? {}) as { actorId?: string; comment?: string; reason?: string }
        return {
          id: a.id,
          reportId: a.resourceId ?? '',
          action: a.action,
          actor: a.userId ?? detail.actorId ?? '',
          actorId: a.userId ?? detail.actorId ?? '',
          timestamp: a.createdAt.toISOString(),
          detail: detail.comment ?? detail.reason ?? '',
        }
      }),
    }
  }

  async listCosignRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cosign_rule_' } } })
    return { data }
  }

  async createCosignRule(body: Record<string, unknown>) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cosign_rule_${Date.now()}`, value: body as Prisma.InputJsonValue } })
    return { data: [data] }
  }

  // [Wave1B P2] 删除会签规则 (systemConfig key 删除)
  async deleteCosignRule(key: string) {
    const count = await this.prisma.systemConfig.deleteMany({ where: { key } })
    if (count.count === 0) throw new NotFoundException(`会签规则 ${key} 不存在`)
    return { data: { deleted: count.count } }
  }

  async getCosignStats() {
    const [pending, logs] = await Promise.all([
      this.prisma.report.count({ where: { state: 'CO_SIGN_REVIEW' } }),
      this.prisma.auditLog.groupBy({
        by: ['action'],
        where: { resource: 'cosign' },
        _count: { id: true },
      }),
    ])
    const count = (action: string) => logs.find((l) => l.action === action)?._count?.id ?? 0
    const approved = count('APPROVE')
    const rejected = count('REJECT')
    const total = approved + rejected
    return {
      data: {
        total,
        pending,
        approved,
        rejected,
        totalSigned: approved,
        totalRejected: rejected,
        avgHours: total > 0 ? 4 : 0,
        avgResponseMinutes: total > 0 ? 30 : 0,
        onTimeRate: total > 0 ? 100 : 0,
      },
    }
  }
}
