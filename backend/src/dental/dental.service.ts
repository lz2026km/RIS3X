import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { CreateDentalStudySchema, UpdateDentalStudySchema, CreateAiFindingSchema, CreateImplantSchema, UpdateImplantSchema, CreateDentalAppointmentSchema, UpdateDentalAppointmentSchema, CreateDentalInvoiceSchema, AddInventoryItemSchema, UpdateInventoryItemSchema } from './dental.schema'
import { z } from 'zod'

type CreateDentalStudyDto = z.infer<typeof CreateDentalStudySchema>
type UpdateDentalStudyDto = z.infer<typeof UpdateDentalStudySchema>
type CreateAiFindingDto = z.infer<typeof CreateAiFindingSchema>
type CreateImplantDto = z.infer<typeof CreateImplantSchema>
type UpdateImplantDto = z.infer<typeof UpdateImplantSchema>
type CreateDentalAppointmentDto = z.infer<typeof CreateDentalAppointmentSchema>
type UpdateDentalAppointmentDto = z.infer<typeof UpdateDentalAppointmentSchema>
type CreateDentalInvoiceDto = z.infer<typeof CreateDentalInvoiceSchema>
type AddInventoryItemDto = z.infer<typeof AddInventoryItemSchema>
type UpdateInventoryItemDto = z.infer<typeof UpdateInventoryItemSchema>

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

  async createStudy(body: CreateDentalStudyDto) {
    const data = await this.prisma.dentalStudy.create({ data: body as any })
    return { data: [data] }
  }

  async updateStudy(id: string, body: UpdateDentalStudyDto) {
    const data = await this.prisma.dentalStudy.update({ where: { id }, data: body as any })
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

  async createAiFinding(body: CreateAiFindingDto) {
    const data = await this.prisma.dentalAiFinding.create({ data: body as any })
    return { data: [data] }
  }

  async listImplants() {
    const data = await this.prisma.dentalImplant.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createImplant(body: CreateImplantDto) {
    const data = await this.prisma.dentalImplant.create({ data: body as any })
    return { data: [data] }
  }

  async updateImplant(id: string, body: UpdateImplantDto) {
    const data = await this.prisma.dentalImplant.update({ where: { id }, data: body as any })
    return { data: [data] }
  }

  async listAppointments() {
    const data = await this.prisma.dentalAppointment.findMany({ orderBy: { scheduledAt: 'desc' } })
    return { data }
  }

  async createAppointment(body: CreateDentalAppointmentDto) {
    const data = await this.prisma.dentalAppointment.create({ data: body as any })
    return { data: [data] }
  }

  async updateAppointment(id: string, body: UpdateDentalAppointmentDto) {
    const data = await this.prisma.dentalAppointment.update({ where: { id }, data: body as any })
    return { data: [data] }
  }

  async listInvoices() {
    const data = await this.prisma.dentalInvoice.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createInvoice(body: CreateDentalInvoiceDto) {
    const data = await this.prisma.dentalInvoice.create({ data: body as any })
    return { data: [data] }
  }

  async listInventory() {
    const data = await this.prisma.dentalInventoryItem.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async addInventoryItem(body: AddInventoryItemDto) {
    const data = await this.prisma.dentalInventoryItem.create({ data: body as any })
    return { data: [data] }
  }

  async updateInventoryItem(id: string, body: UpdateInventoryItemDto) {
    const data = await this.prisma.dentalInventoryItem.update({ where: { id }, data: body as any })
    return { data: [data] }
  }
}
