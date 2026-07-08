import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class PatientPortalService {
  constructor(private readonly prisma: PrismaService) {}

  async listPortalPatients() {
    const data = await this.prisma.patient.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getPortalPatient(id: string) {
    const data = await this.prisma.patient.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listClinicalData() {
    const data = await this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
    return { data }
  }

  async getClinicalData(id: string) {
    const data = await this.prisma.report.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listEducation() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'education_' } } })
    return { data }
  }

  async getEducation(id: string) {
    const data = await this.prisma.systemConfig.findUnique({ where: { key: id } })
    return { data: data ? [data] : [] }
  }

  async getPatientMobile() {
    const data = await this.prisma.patient.findMany({ take: 20, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getDoctorMobile() {
    const data = await this.prisma.user.findMany({ where: { role: 'DOCTOR' }, take: 20 })
    return { data }
  }

  async getNurseMobile() {
    const data = await this.prisma.user.findMany({ where: { role: 'NURSE' }, take: 20 })
    return { data }
  }

  async getTechMobile() {
    const data = await this.prisma.user.findMany({ where: { role: 'TECHNICIAN' }, take: 20 })
    return { data }
  }
}
