import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class DeviceMgmtService {
  constructor(private readonly prisma: PrismaService) {}

  async listEquipmentLifecycle() {
    const data = await this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getEquipmentLifecycle(id: string) {
    const data = await this.prisma.device.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async updateEquipmentLifecycle(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.device.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listDevices() {
    const data = await this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getDevice(id: string) {
    const data = await this.prisma.device.findUnique({ where: { id } })
    return { data: data ? [data] : [] }
  }

  async updateDevice(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.device.update({ where: { id }, data: body })
    return { data: [data] }
  }

  async listDeviceFaults() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'device-fault' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async reportDeviceFault(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'REPORT', resource: 'device-fault', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listMaterials() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'device-material' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async addMaterial(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'ADD', resource: 'device-material', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async getDoseTracking() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'dose-tracking' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async recordDose(body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.create({ data: { action: 'RECORD', resource: 'dose-tracking', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
    return { data: [data] }
  }

  async listAdverseReactions() {
    const data = await this.prisma.adverseEvent.findMany({ orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async reportAdverseReaction(body: Record<string, unknown>) {
    const data = await this.prisma.adverseEvent.create({ data: { tenantId: getCurrentTenantId(), eventType: (body['eventType'] as any) ?? 'OTHER', severity: (body['severity'] as any) ?? 'MINOR', description: (body['description'] as string) ?? '', department: (body['department'] as string) ?? '', reportedBy: (body['reportedBy'] as string) ?? 'unknown', ...body as any } })
    return { data: [data] }
  }

  async getInjectionWorkstation() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'injection-workstation' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async getContrastInventory() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'contrast-inventory' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }

  async updateContrastInventory(id: string, body: Record<string, unknown>) {
    const data = await this.prisma.auditLog.update({ where: { id }, data: { detail: body as Prisma.InputJsonValue } })
    return { data: [data] }
  }

  async getContrastQuality() {
    const data = await this.prisma.auditLog.findMany({ where: { resource: 'contrast-quality' }, orderBy: { createdAt: 'desc' } })
    return { data }
  }
}
