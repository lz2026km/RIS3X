import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'

@Injectable()
export class CaService {
  constructor(private readonly prisma: PrismaService) {}

  async listCertificates() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ca-certificate' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async uploadCertificate(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'UPLOAD', resource: 'ca-certificate', detail: body ?? {} } })
    return { data: [data] }
  }

  async revokeCertificate(id: string) {
    const data = await this.prisma.auditLog.create({ data: { action: 'REVOKE', resource: 'ca-certificate', resourceId: id } })
    return { data: [data] }
  }

  async signDocument(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'SIGN', resource: 'ca-document', detail: body ?? {} } })
    return { data: [data] }
  }

  async listSignatures() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ca-signature' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async verifySignature(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'VERIFY', resource: 'ca-signature', detail: body ?? {} } })
    return { data: [data] }
  }

  async getCaConfig() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'ca_' } } })
    return { data }
  }

  async updateCaConfig(body: any) {
    const results = []
    for (const [key, value] of Object.entries(body)) {
      const item = await this.prisma.systemConfig.upsert({
        where: { key },
        create: { key, value: value as Prisma.InputJsonValue },
        update: { value: value as Prisma.InputJsonValue },
      })
      results.push(item)
    }
    return { data: results }
  }

  async getCaHistory() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: { startsWith: 'ca-' } }, orderBy: { createdAt: 'desc' } })
    return { data }
  }
}
