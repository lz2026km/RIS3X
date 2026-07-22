import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

interface NationalReportBody {
  title?: string
  reportType?: string
  period?: string
  payload?: unknown
}

interface InsuranceAuditBody {
  patientId?: string
  invoiceId?: string
  auditType?: string
  finding?: string
  amount?: number
  metadata?: unknown
}

@Injectable()
export class DataReportService {
  constructor(private readonly prisma: PrismaService) {}

  async listNationalReports() {
    const data = await this.prisma.nationalReport.findMany({ orderBy: { submittedAt: 'desc' } })
    return { data }
  }

  async getNationalReport(id: string) {
    const data = await this.prisma.nationalReport.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async createNationalReport(body: NationalReportBody) {
    const data = await this.prisma.nationalReport.create({
      data: {
        title: body?.title ?? '未命名上报',
        reportType: body?.reportType ?? 'GENERAL',
        period: body?.period ?? new Date().toISOString().slice(0, 7),
        payload: (body?.payload ?? {}) as any,
      } as any,
    })
    return { data: [data] }
  }

  async listDataReports() {
    const data = await this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { data }
  }

  async getDataReport(id: string) {
    const data = await this.prisma.report.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async createDataReport(body: Record<string, unknown>) {
    const data = await this.prisma.report.create({ data: body as any })
    return { data: [data] }
  }

  async listInsuranceAudits() {
    const data = await this.prisma.insuranceAudit.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getInsuranceAudit(id: string) {
    const data = await this.prisma.insuranceAudit.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async createInsuranceAudit(body: InsuranceAuditBody) {
    const data = await this.prisma.insuranceAudit.create({
      data: {
        patientId: body?.patientId,
        invoiceId: body?.invoiceId,
        auditType: body?.auditType ?? 'GENERAL',
        finding: body?.finding ?? '',
        amount: (body?.amount as any) ?? 0,
        metadata: (body?.metadata ?? {}) as any,
      } as any,
    })
    return { data: [data] }
  }

  async enterpriseSearch(q?: string) {
    const where = q ? { OR: [{ name: { contains: q } }, { idCard: { contains: q } }, { phone: { contains: q } }] } : {}
    const data = await this.prisma.patient.findMany({ where, take: 50, orderBy: { createdAt: 'desc' } })
    return { data }
  }
}
