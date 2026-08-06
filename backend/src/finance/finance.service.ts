import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  async listChargeItems() {
    const data = await this.prisma.chargeItem.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createChargeItem(body: Record<string, unknown>) {
    const data = await this.prisma.chargeItem.create({ data: body as any })
    return { data: [data] }
  }

  async updateChargeItem(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.chargeItem.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async deleteChargeItem(id: string) {
    const data = await this.prisma.chargeItem.delete({ where: { id } })
    return { data: [data] }
  }

  async listInvoices() {
    const data = await this.prisma.invoice.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createInvoice(body: Record<string, unknown>) {
    const data = await this.prisma.invoice.create({ data: body as any })
    return { data: [data] }
  }

  async getInvoice(id: string) {
    const data = await this.prisma.invoice.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async payInvoice(body: Record<string, unknown>) {
    const { id, ...rest } = body
    const data = await this.prisma.invoice.update({ where: { id: id as string }, data: { status: 'PAID', ...rest } as any })
    return { data: [data] }
  }

  async getRevenueAnalysis() {
    const data = await this.prisma.invoice.groupBy({
      by: ['status'],
      _sum: { totalAmount: true, paidAmount: true },
      _count: { id: true },
    })
    return { data }
  }

  async getCostAccounting() {
    const data = await this.prisma.chargeItem.findMany({ where: { active: true } })
    return { data }
  }

  async getFinancialReports() {
    const data = await this.prisma.invoice.findMany({ orderBy: { issuedAt: 'desc' }, take: 100 })
    return { data }
  }
}
