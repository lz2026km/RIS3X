import { Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class DeviceMgmtService {
  constructor(private readonly prisma: PrismaService) {}

  // [G005 P1] 响应形状统一: 列表端点返回 { items, total }, 单实体端点返回实体。
  async listEquipmentLifecycle() {
    const items = await this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async getEquipmentLifecycle(id: string) {
    return this.prisma.device.findUnique({ where: { id } })
  }

  async updateEquipmentLifecycle(id: string, body: Record<string, unknown>) {
    return this.prisma.device.update({ where: { id }, data: body })
  }

  async listDevices() {
    const items = await this.prisma.device.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async getDevice(id: string) {
    return this.prisma.device.findUnique({ where: { id } })
  }

  async updateDevice(id: string, body: Record<string, unknown>) {
    return this.prisma.device.update({ where: { id }, data: body })
  }

  async listDeviceFaults() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'device-fault' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async reportDeviceFault(body: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: { action: 'REPORT', resource: 'device-fault', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
  }

  async listMaterials() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'device-material' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async addMaterial(body: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: { action: 'ADD', resource: 'device-material', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
  }

  async getDoseTracking() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'dose-tracking' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async recordDose(body: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: { action: 'RECORD', resource: 'dose-tracking', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
  }

  async listAdverseReactions() {
    const items = await this.prisma.adverseEvent.findMany({ orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async reportAdverseReaction(body: Record<string, unknown>) {
    return this.prisma.adverseEvent.create({ data: { tenantId: getCurrentTenantId(), eventType: (body['eventType'] as any) ?? 'OTHER', severity: (body['severity'] as any) ?? 'MINOR', description: (body['description'] as string) ?? '', department: (body['department'] as string) ?? '', reportedBy: (body['reportedBy'] as string) ?? 'unknown', ...body as any } })
  }

  async getInjectionWorkstation() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'injection-workstation' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async getContrastInventory() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'contrast-inventory' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }

  async updateContrastInventory(id: string, body: Record<string, unknown>) {
    return this.prisma.auditLog.update({ where: { id }, data: { detail: body as Prisma.InputJsonValue } })
  }

  async getContrastQuality() {
    const items = await this.prisma.auditLog.findMany({ where: { resource: 'contrast-quality' }, orderBy: { createdAt: 'desc' } })
    return { items, total: items.length }
  }
}
