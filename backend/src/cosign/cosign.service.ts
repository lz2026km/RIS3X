import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class CosignService {
  constructor(private readonly prisma: PrismaService) {}

  async listPendingCosigns() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'cosign', success: false }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getPendingCosign(id: string) {
    const data = await this.prisma.auditLog.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async approveCosign(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'APPROVE', resource: 'cosign', detail: body, success: true, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async rejectCosign(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'REJECT', resource: 'cosign', detail: body, success: false, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listCosignHistory() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'cosign' }, orderBy: { createdAt: 'desc' }, take: 100 })
    return { data }
  }

  async listCosignRules() {
    const data = await this.prisma.systemConfig.findMany({ where: { key: { startsWith: 'cosign_rule_' } } })
    return { data }
  }

  async createCosignRule(body: any) {
    const data = await this.prisma.systemConfig.create({ data: { key: `cosign_rule_${Date.now()}`, value: body } })
    return { data: [data] }
  }

  async getCosignStats() {
    const data = await this.prisma.auditLog.groupBy({
      by: ['action'],
      where: { resource: 'cosign' },
      _count: { id: true },
    })
    return { data }
  }
}
