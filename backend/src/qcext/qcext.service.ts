import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class QcExtService {
  constructor(private readonly prisma: PrismaService) {}

  async getQcDashboard() {
    const totalScored = await this.prisma.reportQualityScore.count()
    const recent = await this.prisma.reportQualityScore.findMany({ orderBy: { evaluatedAt: 'desc' }, take: 20 })
    return { data: { totalScored, recent } }
  }

  async getQcDashboardItem(id: string) {
    const data = await this.prisma.reportQualityScore.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listQcImages() {
    const data = await this.prisma.dicomInstance.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getQcImage(id: string) {
    const data = await this.prisma.dicomInstance.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async rateQcImage(body: Record<string, unknown>) {
    const { id, ...rest } = body
    const data = await this.prisma.dicomInstance.update({ where: { id }, data: rest })
    return { data: [data] }
  }

  async listRadiologistAnnual() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'radiologist-annual' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getRadiologistAnnual(id: string) {
    const data = await this.prisma.auditLog.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listQcDefects() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'qc-defect' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async reportQcDefect(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'REPORT', resource: 'qc-defect', detail: body, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async getQcStats() {
    const total = await this.prisma.reportQualityScore.count()
    const byGrade = await this.prisma.reportQualityScore.groupBy({ by: ['grade'], _count: { id: true } })
    return { data: { total, byGrade } }
  }

  async listQcScores() {
    const data = await this.prisma.reportQualityScore.findMany({ orderBy: { evaluatedAt: 'desc' } })
    return { data }
  }
}
