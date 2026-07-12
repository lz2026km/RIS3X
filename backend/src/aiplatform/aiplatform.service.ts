import { Injectable } from '@nestjs/common'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class AiPlatformService {
  constructor(private readonly prisma: PrismaService) {}

  async listAiModels() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-model' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiModel(id: string) {
    const data = await this.prisma.auditLog.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async deployAiModel(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'DEPLOY', resource: 'ai-model', detail: body, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listAiQcResults() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-qc' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiQcResult(id: string) {
    const data = await this.prisma.auditLog.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async listAiStructuredReports() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-structured-report' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async generateStructuredReport(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'GENERATE', resource: 'ai-structured-report', detail: body, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listAiMedicalDevices() {
    const data = await this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiOrchestration() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-orchestration' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async createAiOrchestration(body: any) {
    const data = await this.prisma.auditLog.create({ data: { action: 'CREATE', resource: 'ai-orchestration', detail: body, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async getAiFusionWorkspace() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-fusion' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiAssist() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-assist' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getAiMarketplace() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'ai-marketplace' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }
}
