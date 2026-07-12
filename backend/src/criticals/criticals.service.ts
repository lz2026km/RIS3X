import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

export interface NotifyDto {
  criticalId: string
  patientName: string
  patientId: string
  category: 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'
  finding: string
  channels: ('SMS' | 'WECHAT' | 'PHONE' | 'DINGTALK' | 'SYSTEM' | 'EMAIL')[]
  recipientName: string
  recipientDept: string
  recipientPhone: string
}

export interface EscalateDto {
  criticalId: string
  reason: string
  newRecipients: { name: string; dept: string; phone: string }[]
}

@Injectable()
export class CriticalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip?: number; take?: number; state?: string; severity?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = {}
    if (params.state) where.state = params.state
    if (params.severity) where.severity = params.severity
    if (params.dateFrom || params.dateTo) {
      where.createdAt = {}
      if (params.dateFrom) where.createdAt.gte = new Date(params.dateFrom)
      if (params.dateTo) where.createdAt.lte = new Date(params.dateTo)
    }
    const [items, total] = await Promise.all([
      this.prisma.criticalValue.findMany({
        where, skip: params.skip ?? 0, take: params.take ?? 50, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.criticalValue.count({ where }),
    ])
    return { items, total }
  }

  async get(id: string) {
    const c = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!c) throw new NotFoundException(`CriticalValue ${id} not found`)
    return c
  }

  async create(dto: { examId?: string; description: string; severity: string; method: string }) {
    return this.prisma.criticalValue.create({
      data: {
        examId: dto.examId,
        description: dto.description,
        severity: dto.severity as any,
        method: dto.method as any,
        state: 'FOUND',
        tenantId: getCurrentTenantId(),
      },
    })
  }

  async update(id: string, dto: { description?: string; severity?: string; state?: string; notifiedTo?: string; ackedBy?: string; resolvedBy?: string }) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    const data: any = { ...dto }
    if (dto.ackedBy) data.ackedAt = new Date()
    if (dto.resolvedBy) data.resolvedAt = new Date()
    return this.prisma.criticalValue.update({ where: { id }, data })
  }

  async delete(id: string) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    await this.prisma.criticalValue.delete({ where: { id } })
    return { ok: true }
  }

  async notify(dto: NotifyDto) {
    const records = dto.channels.map((channel) => ({
      criticalId: dto.criticalId,
      patientName: dto.patientName,
      patientId: dto.patientId,
      category: dto.category,
      finding: dto.finding,
      channel,
      recipientName: dto.recipientName,
      recipientDept: dto.recipientDept,
      recipientPhone: dto.recipientPhone,
      status: this.simulateDelivery(channel),
      triggeredAt: new Date(),
      tenantId: getCurrentTenantId() ?? 'default',
    }))
    return this.prisma.criticalValueNotification.createMany({ data: records })
  }

  async escalate(dto: EscalateDto) {
    const records = dto.newRecipients.flatMap((r) =>
      (['SMS', 'PHONE', 'APP'] as const).map((channel) => ({
        criticalId: dto.criticalId,
        patientName: 'Escalated',
        patientId: '',
        category: 'LIFE_THREATENING' as const,
        finding: dto.reason,
        channel,
        recipientName: r.name,
        recipientDept: r.dept,
        recipientPhone: r.phone,
        status: this.simulateDelivery(channel),
        escalated: true,
        triggeredAt: new Date(),
        tenantId: getCurrentTenantId() ?? 'default',
      }))
    )
    return this.prisma.criticalValueNotification.createMany({ data: records })
  }

  async listHistory(criticalId: string) {
    return this.prisma.criticalValueNotification.findMany({
      where: { criticalId },
      orderBy: { triggeredAt: 'desc' },
    })
  }

  private simulateDelivery(_channel: string): string {
    return Math.random() > 0.05 ? 'SUCCESS' : 'FAILED'
  }
}
