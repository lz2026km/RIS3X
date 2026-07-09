import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { QueueService } from '../queue/queue.service'
import type { ReportState } from '@prisma/client'

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
    return { items, total, skip, take }
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
    return r
  }

  async create(dto: { patientId: string; examId?: string; radiologistId?: string; findings: string; conclusion: string }) {
    return this.prisma.report.create({
      data: {
        patientId: dto.patientId,
        examId: dto.examId,
        radiologistId: dto.radiologistId,
        findings: dto.findings,
        conclusion: dto.conclusion,
        state: 'PENDING_ASSIGNMENT',
      },
    })
  }

  async update(id: string, dto: { findings?: string; conclusion?: string; state?: ReportState }) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.report.findUnique({ where: { id } })
      if (!current) throw new NotFoundException(`Report ${id} not found`)
      try {
        return await tx.report.update({
          where: { id, version: current.version },
          data: { ...dto, version: { increment: 1 } },
        })
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
      const updated = await tx.report.update({
        where: { id },
        data: { state: 'WITHDRAWN' },
      })
      await tx.reportRevision.create({
        data: {
          reportId: id,
          actorId,
          fromState: existing.state,
          toState: 'WITHDRAWN',
          reason,
        },
      })
      return updated
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
    if (!report) throw new NotFoundException('Report not found')
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.report.update({ where: { id }, data: { state: to } })
      await tx.reportRevision.create({
        data: { reportId: id, actorId, fromState: report.state, toState: to, reason: reason ?? null },
      })
      return updated
    })
  }
}
