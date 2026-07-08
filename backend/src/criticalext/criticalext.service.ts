import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CriticalExtService {
  constructor(private readonly prisma: PrismaService) {}

  async listCriticalRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'critical_rule_' } } })
    return { data }
  }

  async createCriticalRule(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `critical_rule_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async updateCriticalRule(id: string, body: any) {
    const data = await this.prisma.systemConfig.update({ where: { key: id }, data: { value: body } })
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

  async autoDetectCritical(body: any) {
    const data = await this.prisma.criticalValue.create({ data: body })
    return { data: [data] }
  }

  async closeCriticalLoop(body: any) {
    const { id, ...rest } = body
    const data = await this.prisma.criticalValue.update({ where: { id }, data: { state: 'RESOLVED', ...rest } })
    return { data: [data] }
  }

  async getReceiverPortal() {
    const data = await this.prisma.criticalValueNotification.findMany({ where: { status: 'PENDING' }, orderBy: { triggeredAt: 'desc' } })
    return { data }
  }
}
