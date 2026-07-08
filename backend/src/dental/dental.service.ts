import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class DentalService {
  constructor(private readonly prisma: PrismaService) {}

  async listStudies() {
    const data = await this.prisma.dentalStudy.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getStudy(id: string) {
    const data = await this.prisma.dentalStudy.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async createStudy(body: any) {
    const data = await this.prisma.dentalStudy.create({ data: body })
    return { data: [data] }
  }

  async updateStudy(id: string, body: any) {
    const data = await this.prisma.dentalStudy.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async deleteStudy(id: string) {
    await this.prisma.dentalStudy.delete({ where: { id } })
    return { data: [] }
  }

  async listAiFindings() {
    const data = await this.prisma.dentalAiFinding.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createAiFinding(body: any) {
    const data = await this.prisma.dentalAiFinding.create({ data: body })
    return { data: [data] }
  }

  async listImplants() {
    const data = await this.prisma.dentalImplant.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createImplant(body: any) {
    const data = await this.prisma.dentalImplant.create({ data: body })
    return { data: [data] }
  }

  async updateImplant(id: string, body: any) {
    const data = await this.prisma.dentalImplant.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listAppointments() {
    const data = await this.prisma.dentalAppointment.findMany({ orderBy: { scheduledAt: 'desc' } })
    return { data }
  }

  async createAppointment(body: any) {
    const data = await this.prisma.dentalAppointment.create({ data: body })
    return { data: [data] }
  }

  async updateAppointment(id: string, body: any) {
    const data = await this.prisma.dentalAppointment.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listInvoices() {
    const data = await this.prisma.dentalInvoice.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createInvoice(body: any) {
    const data = await this.prisma.dentalInvoice.create({ data: body })
    return { data: [data] }
  }

  async listInventory() {
    const data = await this.prisma.dentalInventoryItem.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async addInventoryItem(body: any) {
    const data = await this.prisma.dentalInventoryItem.create({ data: body })
    return { data: [data] }
  }

  async updateInventoryItem(id: string, body: any) {
    const data = await this.prisma.dentalInventoryItem.update({ where: { id }, data: body })
    return { data: [data] }
  }
}
