import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'
import type { z } from 'zod'
import type { CreateFollowUpPlanSchema, UpdateFollowUpPlanSchema } from './followup.schema'

type CreateDto = z.infer<typeof CreateFollowUpPlanSchema>
type UpdateDto = z.infer<typeof UpdateFollowUpPlanSchema>

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value)
}

function addDays(value: Date, days: number): Date {
  const d = new Date(value)
  d.setDate(d.getDate() + days)
  return d
}

@Injectable()
export class FollowUpService {
  constructor(private readonly prisma: PrismaService) {}

  /** [W4-B] 非完成状态且 nextDate 早于今天的计划自动归为 OVERDUE */
  private deriveStatus(plan: { status: string; nextDate: Date }): string {
    if (plan.status === 'COMPLETED') return 'COMPLETED'
    if (plan.status === 'OVERDUE') return 'OVERDUE'
    if (new Date(plan.nextDate).getTime() < Date.now()) return 'OVERDUE'
    return plan.status
  }

  private toDto(plan: {
    id: string
    patientId: string
    patientName: string
    reportId: string | null
    examId: string | null
    planDate: Date
    intervalDays: number
    nextDate: Date
    status: string
    note: string
    reminderEnabled: boolean
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }) {
    const status = this.deriveStatus(plan)
    return {
      id: plan.id,
      patientId: plan.patientId,
      patientName: plan.patientName,
      reportId: plan.reportId ?? undefined,
      examId: plan.examId ?? undefined,
      planDate: plan.planDate.toISOString(),
      intervalDays: plan.intervalDays,
      nextDate: plan.nextDate.toISOString(),
      status,
      note: plan.note,
      reminderEnabled: plan.reminderEnabled,
      completedAt: plan.completedAt ? plan.completedAt.toISOString() : null,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    }
  }

  async list(query: { status?: string; date?: string; patientId?: string; search?: string }) {
    const tenantId = currentTenantId()
    const where: Prisma.FollowUpPlanWhereInput = { tenantId }
    if (query.status) where.status = query.status
    if (query.patientId) where.patientId = query.patientId
    if (query.date) {
      const dayStart = new Date(`${query.date}T00:00:00`)
      const dayEnd = new Date(dayStart)
      dayEnd.setDate(dayEnd.getDate() + 1)
      where.planDate = { gte: dayStart, lt: dayEnd }
    }
    if (query.search) {
      where.OR = [
        { patientName: { contains: query.search, mode: 'insensitive' } },
        { patientId: { contains: query.search, mode: 'insensitive' } },
      ]
    }
    const [items, total] = await Promise.all([
      this.prisma.followUpPlan.findMany({ where, orderBy: [{ status: 'asc' }, { nextDate: 'asc' }] }),
      this.prisma.followUpPlan.count({ where }),
    ])
    return { items: items.map((p) => this.toDto(p as any)), total }
  }

  async create(dto: CreateDto) {
    const planDate = toDate(dto.planDate)
    const nextDate = addDays(planDate, dto.intervalDays ?? 30)
    const plan = await this.prisma.followUpPlan.create({
      data: {
        tenantId: currentTenantId(),
        patientId: dto.patientId,
        patientName: dto.patientName,
        // [v3.0.6.11-92 Wave1B P0] 报告/检查关联 (报告详情"创建随访"入口带入)
        reportId: dto.reportId ?? null,
        examId: dto.examId ?? null,
        planDate,
        intervalDays: dto.intervalDays ?? 30,
        nextDate,
        status: dto.status ?? 'PENDING',
        note: dto.note ?? '',
        reminderEnabled: dto.reminderEnabled ?? true,
      },
    })
    return this.toDto(plan as any)
  }

  async update(id: string, dto: UpdateDto) {
    const existing = await this.prisma.followUpPlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`FollowUpPlan ${id} not found`)
    const data: Prisma.FollowUpPlanUpdateInput = {}
    if (dto.patientId !== undefined) data.patientId = dto.patientId
    if (dto.patientName !== undefined) data.patientName = dto.patientName
    if (dto.reportId !== undefined) data.reportId = dto.reportId
    if (dto.examId !== undefined) data.examId = dto.examId
    if (dto.planDate !== undefined) data.planDate = toDate(dto.planDate)
    if (dto.intervalDays !== undefined) data.intervalDays = dto.intervalDays
    if (dto.status !== undefined) data.status = dto.status
    if (dto.note !== undefined) data.note = dto.note
    if (dto.reminderEnabled !== undefined) data.reminderEnabled = dto.reminderEnabled
    // 同步 nextDate = planDate + intervalDays
    const planDate = (data.planDate as Date | undefined) ?? existing.planDate
    const intervalDays = (data.intervalDays as number | undefined) ?? existing.intervalDays
    data.nextDate = addDays(planDate, intervalDays)
    const plan = await this.prisma.followUpPlan.update({ where: { id }, data })
    return this.toDto(plan as any)
  }

  async remove(id: string) {
    const existing = await this.prisma.followUpPlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`FollowUpPlan ${id} not found`)
    await this.prisma.followUpPlan.delete({ where: { id } })
    return { ok: true, id }
  }

  async complete(id: string) {
    const existing = await this.prisma.followUpPlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`FollowUpPlan ${id} not found`)
    const plan = await this.prisma.followUpPlan.update({
      where: { id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })
    return this.toDto(plan as any)
  }

  /** [W4-B] 即将到期提醒: 未完成且 nextDate 落在未来 days 天内(含已逾期) */
  async due(days: number) {
    const daysNum = Number.isFinite(days) && days > 0 ? days : 7
    const horizon = addDays(new Date(), daysNum)
    const items = await this.prisma.followUpPlan.findMany({
      where: {
        tenantId: currentTenantId(),
        status: { not: 'COMPLETED' },
        nextDate: { lte: horizon },
      },
      orderBy: { nextDate: 'asc' },
    })
    return { items: items.map((p) => this.toDto(p as any)), total: items.length, days: daysNum }
  }
}
