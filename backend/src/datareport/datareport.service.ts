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

  // ===== [G005 W1-C] 检查量统计: 从 Exam/Report 表聚合 =====
  async listExamStatistics() {
    const [exams, reports] = await Promise.all([
      this.prisma.exam.findMany({ orderBy: { createdAt: 'desc' }, take: 20000 }),
      this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 20000 }),
    ])
    const reportsByExam = new Map<string, typeof reports>()
    for (const r of reports) {
      if (!r.examId) continue
      const bucket = reportsByExam.get(r.examId) ?? []
      bucket.push(r)
      reportsByExam.set(r.examId, bucket)
    }
    const groups = new Map<string, { exams: typeof exams; reports: typeof reports }>()
    for (const e of exams) {
      const bucket = groups.get(e.modality) ?? { exams: [], reports: [] }
      bucket.exams.push(e)
      const rs = reportsByExam.get(e.id) ?? []
      bucket.reports.push(...rs)
      groups.set(e.modality, bucket)
    }
    const rows: any[] = []
    for (const [modality, bucket] of groups) {
      const examCount = bucket.exams.length
      const positiveCount = bucket.reports.filter(r => r.isCritical || (r.diagnosis && r.diagnosis.trim().length > 0) || (r.findings && r.findings.includes('异常'))).length
      const scored = bucket.reports.filter(r => r.qualityScore !== null && r.qualityScore !== undefined)
      const reportTimes: number[] = []
      for (const e of bucket.exams) {
        for (const r of bucket.reports) {
          if (r.examId !== e.id) continue
          const start = e.startedAt ?? e.completedAt ?? e.createdAt
          if (start && r.signedAt) {
            const mins = (r.signedAt.getTime() - start.getTime()) / 60000
            if (mins >= 0 && mins < 10000) reportTimes.push(mins)
          }
        }
      }
      rows.push({
        id: `EX-${modality}`,
        modality,
        examType: bucket.exams[0]?.bodyPart ?? modality,
        examCount,
        positiveCount,
        positiveRate: examCount > 0 ? Number(((positiveCount / examCount) * 100).toFixed(1)) : 0,
        avgReportTime: reportTimes.length > 0 ? Math.round(reportTimes.reduce((s, v) => s + v, 0) / reportTimes.length) : 0,
        qualifiedRate: scored.length > 0 ? Number((scored.reduce((s, r) => s + (r.qualityScore as number), 0) / scored.length).toFixed(1)) : 0,
      })
    }
    rows.sort((a, b) => b.examCount - a.examCount)
    return rows
  }

  // ===== [G005 W1-C] 上报日志: national-reports 记录 =====
  async listReportLogs() {
    const rows = await this.prisma.nationalReport.findMany({ orderBy: { submittedAt: 'desc' }, take: 200 })
    return rows.map(r => ({
      id: r.id,
      reportType: r.reportType === 'GENERAL' || r.reportType === 'DOSE' ? 'dose' : r.reportType.toLowerCase(),
      reportMonth: r.period,
      submitTime: r.submittedAt ? new Date(r.submittedAt).toISOString().replace('T', ' ').slice(0, 16) : '',
      status: r.status === 'SUBMITTED' ? '已上报' : r.status === 'CONFIRMED' ? '已确认' : r.status,
      operator: r.submittedBy ?? '',
      note: r.title ?? '',
    }))
  }

  // ===== [G005 W1-C] 月度趋势: 检查/报告/上报数 (按月 × 模态聚合) =====
  async listMonthlyTrends() {
    const [exams, reports, nationalReports] = await Promise.all([
      this.prisma.exam.findMany({ orderBy: { createdAt: 'asc' }, take: 50000 }),
      this.prisma.report.findMany({ orderBy: { createdAt: 'asc' }, take: 50000 }),
      this.prisma.nationalReport.findMany({ orderBy: { submittedAt: 'asc' }, take: 50000 }),
    ])
    const row = (month: string) => ({ month, CT: 0, MRI: 0, DR: 0, MG: 0, DSA: 0, exams: 0, reports: 0, submitted: 0 })
    const map = new Map<string, ReturnType<typeof row>>()
    const getRow = (month: string) => {
      let r = map.get(month)
      if (!r) {
        r = row(month)
        map.set(month, r)
      }
      return r
    }
    for (const e of exams) {
      const m = e.createdAt.toISOString().slice(0, 7)
      const r = getRow(m)
      r.exams += 1
      const key = e.modality === 'MR' ? 'MRI' : e.modality
      const rec = r as unknown as Record<string, number>
      if (key in rec) rec[key] = (rec[key] ?? 0) + 1
    }
    for (const rep of reports) {
      const m = rep.createdAt.toISOString().slice(0, 7)
      getRow(m).reports += 1
    }
    for (const nr of nationalReports) {
      const m = nr.submittedAt.toISOString().slice(0, 7)
      getRow(m).submitted += 1
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, v]) => v)
  }
}
