import { Injectable, NotFoundException } from '@nestjs/common'
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

  // ============ [W4-B] 设备保养计划 (MaintenancePlan 模型) ============

  private toMaintenancePlanDto(p: {
    id: string
    deviceId: string
    deviceName: string
    maintenanceDate: Date
    intervalDays: number
    type: string
    content: string
    estimatedCost: Prisma.Decimal | null
    assignee: string | null
    status: string
    nextDate: Date | null
    completedAt: Date | null
    createdAt: Date
    updatedAt: Date
  }) {
    return {
      id: p.id,
      deviceId: p.deviceId,
      deviceName: p.deviceName,
      maintenanceDate: p.maintenanceDate.toISOString(),
      intervalDays: p.intervalDays,
      type: p.type,
      content: p.content,
      estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null,
      assignee: p.assignee ?? '',
      status: p.status,
      nextDate: p.nextDate ? p.nextDate.toISOString() : null,
      completedAt: p.completedAt ? p.completedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }
  }

  private addDays(value: Date, days: number): Date {
    const d = new Date(value)
    d.setDate(d.getDate() + days)
    return d
  }

  async listMaintenancePlans(query: { deviceId?: string; status?: string }) {
    const where: Prisma.MaintenancePlanWhereInput = { tenantId: getCurrentTenantId() }
    if (query.deviceId) where.deviceId = query.deviceId
    if (query.status) where.status = query.status
    const [items, total] = await Promise.all([
      this.prisma.maintenancePlan.findMany({ where, orderBy: { maintenanceDate: 'asc' } }),
      this.prisma.maintenancePlan.count({ where }),
    ])
    return { items: items.map((p) => this.toMaintenancePlanDto(p as any)), total }
  }

  async createMaintenancePlan(body: Record<string, unknown>) {
    const maintenanceDate = new Date(body['maintenanceDate'] as string)
    const intervalDays = Number(body['intervalDays'] ?? 90)
    const plan = await this.prisma.maintenancePlan.create({
      data: {
        tenantId: getCurrentTenantId(),
        deviceId: body['deviceId'] as string,
        deviceName: (body['deviceName'] as string) ?? '',
        maintenanceDate,
        intervalDays,
        type: (body['type'] as string) ?? '定期保养',
        content: (body['content'] as string) ?? '',
        estimatedCost: body['estimatedCost'] !== undefined && body['estimatedCost'] !== null ? Number(body['estimatedCost']) : undefined,
        assignee: (body['assignee'] as string) ?? '',
        status: 'PENDING',
        nextDate: this.addDays(maintenanceDate, intervalDays),
      },
    })
    return this.toMaintenancePlanDto(plan as any)
  }

  async updateMaintenancePlan(id: string, body: Record<string, unknown>) {
    const existing = await this.prisma.maintenancePlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`MaintenancePlan ${id} not found`)
    const data: Prisma.MaintenancePlanUpdateInput = {}
    if (body['deviceId'] !== undefined) data.deviceId = body['deviceId'] as string
    if (body['deviceName'] !== undefined) data.deviceName = body['deviceName'] as string
    if (body['maintenanceDate'] !== undefined) data.maintenanceDate = new Date(body['maintenanceDate'] as string)
    if (body['intervalDays'] !== undefined) data.intervalDays = Number(body['intervalDays'])
    if (body['type'] !== undefined) data.type = body['type'] as string
    if (body['content'] !== undefined) data.content = body['content'] as string
    if (body['estimatedCost'] !== undefined && body['estimatedCost'] !== null) data.estimatedCost = Number(body['estimatedCost'])
    if (body['assignee'] !== undefined) data.assignee = body['assignee'] as string
    if (body['status'] !== undefined) {
      data.status = body['status'] as string
      if (body['status'] === 'COMPLETED' && !existing.completedAt) data.completedAt = new Date()
    }
    const maintenanceDate = (data.maintenanceDate as Date | undefined) ?? existing.maintenanceDate
    const intervalDays = (data.intervalDays as number | undefined) ?? existing.intervalDays
    data.nextDate = this.addDays(maintenanceDate, intervalDays)
    const plan = await this.prisma.maintenancePlan.update({ where: { id }, data })
    return this.toMaintenancePlanDto(plan as any)
  }

  async deleteMaintenancePlan(id: string) {
    const existing = await this.prisma.maintenancePlan.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`MaintenancePlan ${id} not found`)
    await this.prisma.maintenancePlan.delete({ where: { id } })
    return { ok: true, id }
  }

  /** [W4-B] 到期提醒: 未完成且 maintenanceDate 落在未来 days 天内(含已过期) */
  async maintenanceDue(days: number) {
    const daysNum = Number.isFinite(days) && days > 0 ? days : 30
    const horizon = this.addDays(new Date(), daysNum)
    const items = await this.prisma.maintenancePlan.findMany({
      where: {
        tenantId: getCurrentTenantId(),
        status: { not: 'COMPLETED' },
        maintenanceDate: { lte: horizon },
      },
      orderBy: { maintenanceDate: 'asc' },
    })
    return { items: items.map((p) => this.toMaintenancePlanDto(p as any)), total: items.length, days: daysNum }
  }
}
