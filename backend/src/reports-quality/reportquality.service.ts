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

  // [G005 P1] 响应形状统一: 列表端点返回 { items, total }, 单实体端点返回实体,
  // getReportQualityStats 返回直接对象 { total, avgScore, passRate }。
  async listScoreRules() {
    const items = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'score_rule_' } } })
    return { items, total: items.length }
  }

  async createScoreRule(body: CreateScoreRuleDto) {
    return this.prisma.systemConfig.create({ data: { key: `score_rule_${Date.now()}`, value: body as any } })
  }

  async updateScoreRule(id: string, body: UpdateScoreRuleDto) {
    return this.prisma.systemConfig.update({ where: { key: id }, data: { value: body as any } })
  }

  async listDefectLibrary() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'defect-library' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async createDefectEntry(body: CreateDefectEntryDto) {
    return this.prisma.auditLog.create({ data: { action: 'CREATE', resource: 'defect-library', detail: body as any, tenantId: getCurrentTenantId() } })
  }

  async updateDefectEntry(id: string, body: UpdateDefectEntryDto) {
    return this.prisma.auditLog.update({ where: { id }, data: { detail: body as any } })
  }

  async listAiReportDrafts() {
    const items = await this.prisma.report.findMany({ where: { state: 'WRITING' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async createAiReportDraft(body: CreateAiReportDraftDto) {
    return this.prisma.report.create({ data: body as any })
  }

  async getReportQualityStats() {
    const total = await this.prisma.reportQualityScore.count()
    const avgScore = await this.prisma.reportQualityScore.aggregate({ _avg: { totalScore: true } })
    const passed = await this.prisma.reportQualityScore.count({ where: { totalScore: { gte: 60 } } })
    return {
      total,
      avgScore: avgScore._avg.totalScore ?? 0,
      passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
    }
  }
}
