import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateCriticalRuleSchema, UpdateCriticalRuleSchema, AutoDetectCriticalSchema, CloseCriticalLoopSchema } from './criticalext.schema'
import { z } from 'zod'

type CreateCriticalRuleDto = z.infer<typeof CreateCriticalRuleSchema>
type UpdateCriticalRuleDto = z.infer<typeof UpdateCriticalRuleSchema>
type AutoDetectCriticalDto = z.infer<typeof AutoDetectCriticalSchema>
type CloseCriticalLoopDto = z.infer<typeof CloseCriticalLoopSchema>

@Injectable()
export class CriticalExtService {
  constructor(private readonly prisma: PrismaService) {}

  async listCriticalRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'critical_rule_' } } })
    return { data }
  }

  async createCriticalRule(body: CreateCriticalRuleDto) {
    const data = await this.prisma.systemConfig.create({ data: { key: `critical_rule_${Date.now()}`, value: body as any } })
    return { data: [data] }
  }

  async updateCriticalRule(id: string, body: UpdateCriticalRuleDto) {
    const data = await this.prisma.systemConfig.update({ where: { key: id }, data: { value: body as any } })
    return { data: [data] }
  }

  async deleteCriticalRule(id: string) {
    await this.prisma.systemConfig.delete({ where: { key: id } })
    return { data: [] }
  }

  async getCriticalStats() {
    const total = await this.prisma.criticalValue.count()
    const byState = await this.prisma.criticalValue.groupBy({ by: ['state'], _count: { id: true } })
    const bySeverity = await this.prisma.criticalValue.groupBy({ by: ['severity'], _count: { id: true } })
    return { data: { total, byState, bySeverity } }
  }

  async getCriticalSummary() {
    const data = await this.prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    return { data }
  }

  async getCriticalTimeline() {
    const data = await this.prisma.criticalValueNotification.findMany({ orderBy: { triggeredAt: 'desc' }, take: 100 })
    return { data }
  }

  async listCriticalCenter() {
    const data = await this.prisma.criticalValue.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getCriticalCenterItem(id: string) {
    const data = await this.prisma.criticalValue.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async autoDetectCritical(body: AutoDetectCriticalDto) {
    const data = await this.prisma.criticalValue.create({ data: body as any })
    return { data: [data] }
  }

  // [G005-P0] 闭环统一终态: CLOSED_LOOP + closedAt/closedBy (与 PATCH /criticals/:id 一致)
  async closeCriticalLoop(body: CloseCriticalLoopDto) {
    const { criticalId, resolvedBy, resolvedAt } = body
    const now = resolvedAt ? new Date(resolvedAt) : new Date()
    const data = await this.prisma.criticalValue.update({
      where: { id: criticalId },
      data: {
        state: 'CLOSED_LOOP',
        closedBy: resolvedBy,
        closedAt: now,
        resolvedBy,
        resolvedAt: now,
      } as any,
    })
    return { data: [data] }
  }

  async getReceiverPortal() {
    const data = await this.prisma.criticalValueNotification.findMany({ where: { status: 'PENDING' }, orderBy: { triggeredAt: 'desc' } })
    return { data }
  }

  // [G005-P0] 危急值随访记录 (与 MSW criticalExtHandlers /follow-up-records 对齐)
  async getFollowUpRecords() {
    const data = await this.prisma.criticalValueNotification.findMany({ orderBy: { triggeredAt: 'desc' }, take: 100 })
    return { data }
  }
}
