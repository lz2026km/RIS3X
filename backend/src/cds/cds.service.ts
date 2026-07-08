import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CdsService {
  constructor(private readonly prisma: PrismaService) {}

  async listGuidelines() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_guideline_' } } })
    return { data }
  }

  async getGuideline(id: string) {
    const data = await this.prisma.systemConfig.findUnique({ where: { key: id } })
    return { data: data ? [data] : [] }
  }

  async createGuideline(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cds_guideline_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async listAlerts() {
    const data = await this.prisma.notification.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async acknowledgeAlert(body: any) {
    const { id, ...rest } = body
    const data = await this.prisma.notification.update({ where: { id }, data: { read: true, ...rest } })
    return { data: [data] }
  }

  async getDoseMonitoring() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'cds-dose' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getCdsStatistics() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: { startsWith: 'cds-' } }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async listCdsRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_rule_' } } })
    return { data }
  }

  async createCdsRule(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cds_rule_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async getCdsManagement() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cds_' } } })
    return { data }
  }
}
