import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

function sanitizeCertificateDetail(detail: unknown): Prisma.InputJsonValue {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return {}
  const safe = { ...(detail as Record<string, unknown>) }
  delete safe['privateKey']
  delete safe['certificateData']
  return safe as Prisma.InputJsonObject
}

@Injectable()
export class CaService {
  constructor(private readonly prisma: PrismaService) {}

  async listCertificates() {
    const records = await this.prisma.auditLog.findMany({ where: { resource: 'ca-certificate' }, orderBy: { createdAt: 'desc' } })
    return { data: records.map((record) => ({ ...record, detail: sanitizeCertificateDetail(record.detail) })) }
  }

  async uploadCertificate(body: Record<string, unknown>) {
    const detail = sanitizeCertificateDetail(body)
    const data = await this.prisma.auditLog.create({ data: { action: 'UPLOAD', resource: 'ca-certificate', detail, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async revokeCertificate(id: string) {
    const data = await this.prisma.auditLog.create({ data: { action: 'REVOKE', resource: 'ca-certificate', resourceId: id, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async signDocument(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'SIGN', resource: 'ca-document', detail: (body ?? {}) as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listSignatures() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ca-signature' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async verifySignature(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'VERIFY', resource: 'ca-signature', detail: (body ?? {}) as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async getCaConfig() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'ca_' } } })
    return { data }
  }

  async updateCaConfig(body: Record<string, unknown>) {
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
