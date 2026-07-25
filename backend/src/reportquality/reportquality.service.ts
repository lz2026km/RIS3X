import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'
import { CreateScoreRuleSchema, UpdateScoreRuleSchema, CreateDefectEntrySchema, UpdateDefectEntrySchema, CreateAiReportDraftSchema } from './reportquality.schema'
import { z } from 'zod'

type CreateScoreRuleDto = z.infer<typeof CreateScoreRuleSchema>
type UpdateScoreRuleDto = z.infer<typeof UpdateScoreRuleSchema>
type CreateDefectEntryDto = z.infer<typeof CreateDefectEntrySchema>
type UpdateDefectEntryDto = z.infer<typeof UpdateDefectEntrySchema>
type CreateAiReportDraftDto = z.infer<typeof CreateAiReportDraftSchema>

@Injectable()
export class ReportQualityService {
  constructor(private readonly prisma: PrismaService) {}

  async listScoreRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'score_rule_' } } })
    return { data }
  }

  async createScoreRule(body: CreateScoreRuleDto) {
    const data = await this.prisma.systemConfig.create({ data: { key: `score_rule_${Date.now()}`, value: body as any } })
    return { data: [data] }
  }

  async updateScoreRule(id: string, body: UpdateScoreRuleDto) {
    const data = await this.prisma.systemConfig.update({ where: { key: id }, data: { value: body as any } })
    return { data: [data] }
  }

  async listDefectLibrary() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'defect-library' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createDefectEntry(body: CreateDefectEntryDto) {
    const data = await this.prisma.auditLog.create({ data: { action: 'CREATE', resource: 'defect-library', detail: body as any, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async updateDefectEntry(id: string, body: UpdateDefectEntryDto) {
    const data = await this.prisma.auditLog.update({ where: { id }, data: { detail: body as any } })
    return { data: [data] }
  }

  async listAiReportDrafts() {
    const data = await this.prisma.report.findMany({ where: { state: 'WRITING' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createAiReportDraft(body: CreateAiReportDraftDto) {
    const data = await this.prisma.report.create({ data: body as any })
    return { data: [data] }
  }

  async getReportQualityStats() {
    const total = await this.prisma.reportQualityScore.count()
    const avgScore = await this.prisma.reportQualityScore.aggregate({ _avg: { totalScore: true } })
    return { data: { total, avgScore: avgScore._avg.totalScore ?? 0 } }
  }
}
