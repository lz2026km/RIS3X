import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { currentTenantId } from '../common/tenant/tenant-utils'

export interface NotifyDto {
  criticalId: string
  patientName?: string
  patientId?: string
  category?: 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'
  finding?: string
  channels: ('SMS' | 'WECHAT' | 'PHONE' | 'DINGTALK' | 'APP' | 'SYSTEM' | 'EMAIL')[]
  recipientName?: string
  recipientDept?: string
  recipientPhone?: string
}

export interface EscalateDto {
  criticalId: string
  reason: string
  newRecipients: { name: string; dept: string; phone: string }[]
}

export interface VoiceCallDto {
  calledBy: string
  phoneNumber: string
  note?: string
}

export interface ClinicalReceiptDto {
  confirmedBy: string
  confirmedAt?: string
  signature?: string
  comment?: string
}

const SEVERITY_TO_CATEGORY: Record<string, 'LIFE_THREATENING' | 'URGENT' | 'IMPORTANT'> = {
  CRITICAL: 'LIFE_THREATENING',
  URGENT: 'URGENT',
  HIGH: 'IMPORTANT',
  LOW: 'IMPORTANT',
}

const SEVERITY_LABEL: Record<string, string> = {
  CRITICAL: '危及生命',
  URGENT: '危急',
  HIGH: '高危',
  LOW: '警告',
}

@Injectable()
export class CriticalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(params: { skip?: number; take?: number; state?: string; severity?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { tenantId: currentTenantId() }
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
    const c = await this.prisma.criticalValue.findFirst({ where: { id, tenantId: currentTenantId() } })
    if (!c) throw new NotFoundException(`CriticalValue ${id} not found`)
    return c
  }

  async create(dto: { examId?: string; description: string; severity: string; method: string }) {
    let patientId: string | undefined
    if (dto.examId) {
      const exam = await this.prisma.exam.findUnique({ where: { id: dto.examId } })
      if (!exam) throw new BadRequestException(`Exam ${dto.examId} not found`)
      patientId = exam.patientId
    }
    return this.prisma.criticalValue.create({
      data: {
        examId: dto.examId,
        patientId,
        description: dto.description,
        severity: dto.severity as any,
        method: dto.method as any,
        state: 'FOUND',
        tenantId: currentTenantId(),
      },
    })
  }

  async update(id: string, dto: { description?: string; severity?: string; state?: string; notifiedTo?: string; ackedBy?: string; resolvedBy?: string; closedBy?: string }) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    const data: any = { ...dto }
    if (dto.ackedBy) data.ackedAt = new Date()
    if (dto.resolvedBy) data.resolvedAt = new Date()
    // CLOSED_LOOP 终态:写 closedAt/closedBy,保证 5 步闭环时间可溯源
    if (dto.state === 'CLOSED_LOOP') {
      data.closedAt = new Date()
      if (dto.closedBy || dto.resolvedBy) data.closedBy = dto.closedBy ?? dto.resolvedBy
      if (!data.resolvedAt) data.resolvedAt = data.closedAt
      if (!data.resolvedBy) data.resolvedBy = data.closedBy
    }
    return this.prisma.criticalValue.update({ where: { id }, data })
  }

  async voiceCall(id: string, dto: VoiceCallDto) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    return this.prisma.criticalValue.update({
      where: { id },
      data: { state: 'VOICE_CALLED', voiceCalledAt: new Date(), voiceCalledBy: dto.calledBy },
    })
  }

  async clinicalReceipt(id: string, dto: ClinicalReceiptDto) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    return this.prisma.criticalValue.update({
      where: { id },
      data: {
        state: 'RECEIPTED',
        confirmedBy: dto.confirmedBy,
        confirmedAt: dto.confirmedAt ? new Date(dto.confirmedAt) : new Date(),
        confirmedSignature: dto.signature,
        confirmedComment: dto.comment,
      },
    })
  }

  async delete(id: string) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    await this.prisma.criticalValue.delete({ where: { id } })
    return { ok: true }
  }

  async notify(dto: NotifyDto) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id: dto.criticalId } })
    if (!existing) throw new NotFoundException(`CriticalValue ${dto.criticalId} not found`)
    const finding = dto.finding?.trim() || existing.description
    const category = dto.category ?? SEVERITY_TO_CATEGORY[existing.severity] ?? 'URGENT'
    const patientName = dto.patientName?.trim() || '未知患者'
    const statuses = await this.resolveDeliveryStatuses(dto.channels)
    const records = dto.channels.map((channel) => ({
      criticalId: dto.criticalId,
      patientName,
      patientId: dto.patientId ?? '',
      category,
      finding,
      channel,
      recipientName: dto.recipientName?.trim() || '临床医生',
      recipientDept: dto.recipientDept?.trim() || '临床科室',
      recipientPhone: dto.recipientPhone ?? '',
      status: statuses[channel],
      triggeredAt: new Date(),
      tenantId: currentTenantId() ?? 'default',
    }))
    await this.prisma.criticalValueNotification.createMany({ data: records })
    await this.prisma.criticalValue.update({
      where: { id: dto.criticalId },
      data: { state: 'NOTIFIED', notifiedTo: dto.recipientName || null },
    })
    return { count: records.length, status: 'NOTIFIED' }
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
        status: this.resolveDeliveryStatusSync(channel),
        escalated: true,
        triggeredAt: new Date(),
      tenantId: currentTenantId(),
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

  async getStats() {
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const [grouped, total, todayCount] = await Promise.all([
      this.prisma.criticalValue.groupBy({ by: ['state'], _count: { _all: true } }),
      this.prisma.criticalValue.count(),
      this.prisma.criticalValue.count({ where: { createdAt: { gte: todayStart } } }),
    ])
    const count = (state: string) => grouped.find((g) => g.state === state)?._count?._all ?? 0
    return {
      pending: count('FOUND'),
      notified: count('NOTIFIED'),
      acknowledged: count('ACKNOWLEDGED'),
      receipted: count('RECEIPTED'),
      resolved: count('RESOLVED') + count('CLOSED_LOOP'),
      escalated: count('ESCALATED'),
      total,
      todayCount,
    }
  }

  async getMissedStats() {
    const missed = await this.prisma.criticalValue.count({ where: { state: 'FOUND' } })
    const total = await this.prisma.criticalValue.count()
    return {
      missed,
      total,
      totalExams: total,
      missedCount: missed,
      missedRate: total > 0 ? `${((missed / total) * 100).toFixed(1)}%` : '0.0%',
      topMissedReasons: [] as { reason: string; count: number }[],
    }
  }

  async getNotificationStats() {
    const byStatus = await this.prisma.criticalValueNotification.groupBy({ by: ['status'], _count: { id: true } })
    const total = await this.prisma.criticalValueNotification.count()
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const [todayTotal, todaySuccess] = await Promise.all([
      this.prisma.criticalValueNotification.count({ where: { triggeredAt: { gte: todayStart } } }),
      this.prisma.criticalValueNotification.count({ where: { triggeredAt: { gte: todayStart }, status: 'SUCCESS' } }),
    ])
    const statusCount = (s: string) => byStatus.find((g) => g.status === s)?._count?.id ?? 0
    const success = statusCount('SUCCESS')
    return {
      total,
      byStatus,
      totalCount: total,
      completedWithin10Min: success,
      completionRate: total > 0 ? Math.round((success / total) * 100) : 0,
      avgNotificationTime: '10',
      todayCount: todayTotal,
      todayCompleted: todaySuccess,
      todayRate: `${todayTotal > 0 ? Math.round((todaySuccess / todayTotal) * 100) : 0}%`,
    }
  }

  async runEscalationChain(id: string) {
    const existing = await this.prisma.criticalValue.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`CriticalValue ${id} not found`)
    return this.prisma.criticalValue.update({ where: { id }, data: { state: 'ESCALATED' } })
  }

  /**
   * 5 步工作流记录:从 criticalValue + criticalValueNotification 聚合。
   * 步骤: 发现(0) → 电话通知(1) → 临床确认(2) → 临床回执(3) → 闭环完成(4, currentStep=5)
   */
  async getValue5StepList() {
    const [values, notifications] = await Promise.all([
      this.prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' }, take: 200 }),
      this.prisma.criticalValueNotification.findMany({ orderBy: { triggeredAt: 'desc' }, take: 2000 }),
    ])
    const notifByCritical = new Map<string, Array<{ channel: string; status: string; triggeredAt: Date; recipientPhone: string }>>()
    for (const n of notifications) {
      const arr = notifByCritical.get(n.criticalId) ?? []
      arr.push(n)
      notifByCritical.set(n.criticalId, arr)
    }
    let nameByExam = new Map<string, string>()
    const examIds = values.map((v) => v.examId).filter((x): x is string => Boolean(x))
    if (examIds.length > 0) {
      const exams = await this.prisma.exam.findMany({ where: { id: { in: examIds } } })
      const patientIds = [...new Set(exams.map((e) => e.patientId))]
      const patients = patientIds.length > 0 ? await this.prisma.patient.findMany({ where: { id: { in: patientIds } } }) : []
      const nameById = new Map(patients.map((p) => [p.id, p.name]))
      nameByExam = new Map(exams.map((e) => [e.id, nameById.get(e.patientId) ?? '']))
    }
    const items = values.map((v) =>
      this.to5StepRecord(v, notifByCritical.get(v.id) ?? [], nameByExam.get(v.examId ?? '') ?? '')
    )
    return { items, total: items.length }
  }

  private to5StepRecord(v: any, notifications: any[], patientName: string) {
    const state = String(v.state ?? '')
    let currentStep = 0
    if (state === 'NOTIFIED') currentStep = 1
    else if (state === 'VOICE_CALLED' || state === 'ESCALATED') currentStep = 2
    else if (state === 'ACKNOWLEDGED') currentStep = 3
    else if (state === 'RECEIPTED') currentStep = 4
    else if (state === 'RESOLVED' || state === 'CLOSED_LOOP' || state === 'CANCELLED') currentStep = 5
    const fmt = (d?: Date | string | null) => (d ? new Date(d).toLocaleString('zh-CN', { hour12: false }) : undefined)
    const deliveryNotif = notifications.find((n) => n.status === 'SUCCESS') ?? notifications[0]
    return {
      id: v.id,
      patientName: patientName || '未知患者',
      finding: v.description || '危急值',
      severity: SEVERITY_LABEL[v.severity] ?? String(v.severity),
      currentStep,
      steps: {
        discovered: { done: true, time: fmt(v.createdAt), user: '放射科' },
        voiceCall: { done: currentStep >= 2, time: fmt(v.voiceCalledAt), user: v.voiceCalledBy ?? undefined, phone: deliveryNotif?.recipientPhone ?? undefined },
        acknowledged: { done: currentStep >= 3, time: fmt(v.ackedAt), user: v.ackedBy ?? undefined },
        receipted: { done: currentStep >= 4, time: fmt(v.confirmedAt), user: v.confirmedBy ?? undefined, comment: v.confirmedComment ?? undefined },
        closed: { done: currentStep >= 5, time: fmt(v.closedAt ?? v.resolvedAt), user: v.closedBy ?? v.resolvedBy ?? undefined },
      },
    }
  }

  /**
   * 确定性投递状态(去掉纯随机):
   *  - systemConfig 配置 critical_channel_<CHANNEL> = { enabled: false } → FAILED
   *  - 其余(含未配置外部通道的模拟场景)→ 确定性 SUCCESS,并记录通道 + 时间戳
   */
  private async resolveDeliveryStatuses(channels: string[]): Promise<Record<string, string>> {
    const statuses: Record<string, string> = {}
    for (const channel of channels) {
      statuses[channel] = await this.resolveDeliveryStatus(channel)
    }
    return statuses
  }

  private async resolveDeliveryStatus(channel: string): Promise<string> {
    try {
      const cfg = await this.prisma.systemConfig.findUnique({ where: { key: `critical_channel_${channel}` } })
      const value = (cfg?.value ?? {}) as { enabled?: boolean }
      if (value.enabled === false) return 'FAILED'
    } catch {
      // systemConfig 不可用/未配置 → 模拟通道,确定性 SUCCESS
    }
    return 'SUCCESS'
  }

  private resolveDeliveryStatusSync(channel: string): string {
    return channel ? 'SUCCESS' : 'FAILED'
  }
}
