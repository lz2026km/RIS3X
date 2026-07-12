import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class ReportQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async listScoreRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'score_rule_' } } })
    return { data }
  }

  async createScoreRule(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `score_rule_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async updateScoreRule(id: string, body: any) {
    const data = await this.prisma.systemConfig.update({ where: { key: id }, data: { value: body } })
    return { data: [data] }
  }

  async listDefectLibrary() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'defect-library' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createDefectEntry(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'CREATE', resource: 'defect-library', detail: body, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async updateDefectEntry(id: string, body: any) {
    const data = await this.prisma.auditLog.update({ where: { id }, data: { detail: body } })
    return { data: [data] }
  }

  async listAiReportDrafts() {
    const data = await this.prisma.report.findMany({ where: { state: 'WRITING' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createAiReportDraft(body: any) {
    const data = await this.prisma.report.create({ data: body })
    return { data: [data] }
  }

  async getReportQualityStats() {
    const total = await this.prisma.reportQualityScore.count()
    const avgScore = await this.prisma.reportQualityScore.aggregate({ _avg: { totalScore: true } })
    return { data: { total, avgScore: avgScore._avg.totalScore ?? 0 } }
  }
}
