import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class RegionalService {
  constructor(private readonly prisma: PrismaService) {}

  async listRegionalImaging() {
    const data = await this.prisma.exam.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { data }
  }

  async getRegionalImaging(id: string) {
    const data = await this.prisma.exam.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listRegionalReports() {
    const data = await this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 })
    return { data }
  }

  async getRegionalReport(id: string) {
    const data = await this.prisma.report.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async getDepartmentSchedule() {
    const data = await this.prisma.appointment.findMany({ orderBy: { scheduledAt: 'asc' }, take: 50 })
    return { data }
  }

  async updateSchedule(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.appointment.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listDepartments() {
    const data = await this.prisma.user.findMany({ select: { department: true }, distinct: ['department'] })
    return { data: data.filter(d => d.department) }
  }

  async listMedicalAlliance() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'medical_alliance_' } } })
    return { data }
  }

  async getFhirStatus() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'fhir_' } } })
    return { data }
  }

  async getIheStatus() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'ihe_' } } })
    return { data }
  }

  async getMllpStatus() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'mllp_' } } })
    return { data }
  }
}
