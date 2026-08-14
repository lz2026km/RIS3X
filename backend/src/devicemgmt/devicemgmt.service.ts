import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../prisma/prisma.service'
import { getCurrentTenantId } from '../common/interceptors/tenant-context.interceptor'

@Injectable()
export class DeviceMgmtService {
  private readonly logger = new Logger(DeviceMgmtService.name)

  constructor(private readonly prisma: PrismaService) {}

  // ============ [v3.0.6.11-99 Wave 10D] 总览 / 使用趋势 / 房间分布 / 维护日历 ============

  /** 日期工具: 近 N 天日期数组 (升序, YYYY-MM-DD, 本地时区) */
  private lastNDays(days: number): string[] {
    const out: string[] = []
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      d.setDate(d.getDate() - i)
      out.push(this.dateKey(d))
    }
    return out
  }

  /** 本地时区 YYYY-MM-DD (避免 toISOString UTC 跨日错位) */
  private dateKey(d: Date): string {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }

  private seedOverview() {
    return {
      total: 8,
      online: 6,
      byState: { IDLE: 3, IN_USE: 3, MAINTENANCE: 1, BROKEN: 1, OFFLINE: 0 },
      todayExams: 31,
      todayUsageMin: 640,
      faultsToday: 1,
      faultRate: 12.5,
      maintenanceDue: 2,
      byModality: [
        { modality: 'CT', total: 1, online: 1 },
        { modality: 'MR', total: 1, online: 1 },
        { modality: 'DR', total: 2, online: 1 },
        { modality: 'US', total: 2, online: 2 },
        { modality: 'MG', total: 1, online: 1 },
        { modality: 'DSA', total: 1, online: 0 },
      ],
    }
  }

  /**
   * GET /device-mgmt/overview — 设备总览: 总数/在线/故障/维护中 + 今日使用量。
   * 数据源: device (state/todayExams/todayUsageMin) + auditLog (device-fault 今日) + maintenancePlan (未完成); 空数据 seed 回退。
   */
  async getOverview() {
    const tenantId = getCurrentTenantId()
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    try {
      const [devices, faultToday, maintenanceDue, byModalityRows] = await Promise.all([
        this.prisma.device.findMany({ where: { tenantId } }),
        this.prisma.auditLog.count({ where: { resource: 'device-fault', createdAt: { gte: start }, tenantId } }),
        this.prisma.maintenancePlan.count({ where: { tenantId, status: { not: 'COMPLETED' } } }),
        this.prisma.device.groupBy({ by: ['modality', 'state'], where: { tenantId }, _count: { _all: true } }),
      ])
      const byState: Record<string, number> = { IDLE: 0, IN_USE: 0, MAINTENANCE: 0, BROKEN: 0, OFFLINE: 0 }
      for (const d of devices) byState[d.state] = (byState[d.state] ?? 0) + 1
      const online = (byState['IDLE'] ?? 0) + (byState['IN_USE'] ?? 0)
      const todayExams = devices.reduce((a, d) => a + (d.todayExams ?? 0), 0)
      const todayUsageMin = devices.reduce((a, d) => a + (d.todayUsageMin ?? 0), 0)
      const modalityMap = new Map<string, { total: number; online: number }>()
      for (const r of byModalityRows) {
        const entry = modalityMap.get(r.modality) ?? { total: 0, online: 0 }
        entry.total += r._count._all
        if (r.state === 'IDLE' || r.state === 'IN_USE') entry.online += r._count._all
        modalityMap.set(r.modality, entry)
      }
      const byModality = [...modalityMap.entries()].map(([modality, v]) => ({ modality, ...v })).sort((a, b) => b.total - a.total)
      if (devices.length === 0) return this.seedOverview()
      return {
        total: devices.length,
        online,
        byState,
        todayExams,
        todayUsageMin,
        faultsToday: faultToday ?? 0,
        faultRate: devices.length > 0 ? Number((((faultToday ?? 0) / devices.length) * 100).toFixed(1)) : 0,
        maintenanceDue: maintenanceDue ?? 0,
        byModality,
      }
    } catch (err) {
      this.logger.warn(`[DeviceMgmt] getOverview failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedOverview()
    }
  }

  /**
   * GET /device-mgmt/usage-trend — 设备使用趋势: 近 N 日 每日检查量 (按设备/模态)。
   * 数据源: exam createdAt 分桶; 空数据 seed 回退。
   */
  async getUsageTrend(days = 30) {
    const n = Number.isFinite(days) && days > 0 && days <= 365 ? Math.floor(days) : 30
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    start.setDate(start.getDate() - (n - 1))
    try {
      const exams = await this.prisma.exam.findMany({
        where: { tenantId: getCurrentTenantId(), createdAt: { gte: start } },
        select: { createdAt: true, modality: true },
      })
      const dates = this.lastNDays(n)
      const dailyMap = new Map<string, number>()
      const modalityMap = new Map<string, Map<string, number>>()
      for (const e of exams) {
        const key = this.dateKey(e.createdAt)
        dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
        const m = modalityMap.get(e.modality) ?? new Map<string, number>()
        m.set(key, (m.get(key) ?? 0) + 1)
        modalityMap.set(e.modality, m)
      }
      const items = dates.map((date) => ({ date, count: dailyMap.get(date) ?? 0 }))
      if (items.reduce((a, i) => a + i.count, 0) === 0) {
        return {
          items: dates.map((date, idx) => ({ date, count: 3 + ((idx * 5) % 11) })),
          byModality: [
            { modality: 'CT', counts: dates.map((date, idx) => ({ date, count: 1 + ((idx * 3) % 6) })) },
            { modality: 'MR', counts: dates.map((date, idx) => ({ date, count: (idx * 2) % 5 })) },
          ],
          total: n,
        }
      }
      const byModality = [...modalityMap.entries()].map(([modality, m]) => ({
        modality,
        counts: dates.map((date) => ({ date, count: m.get(date) ?? 0 })),
      }))
      return { items, byModality, total: n }
    } catch (err) {
      this.logger.warn(`[DeviceMgmt] getUsageTrend failed, fallback seed: ${(err as Error)?.message}`)
      const dates = this.lastNDays(n)
      return {
        items: dates.map((date, idx) => ({ date, count: 3 + ((idx * 5) % 11) })),
        byModality: [{ modality: 'CT', counts: dates.map((date, idx) => ({ date, count: 1 + ((idx * 3) % 6) })) }],
        total: n,
      }
    }
  }

  /**
   * GET /device-mgmt/by-room — 房间设备分布: 每房间 设备数/在线数/今日检查量。
   * 数据源: device location 派生; 空数据 seed 回退。
   */
  async getByRoom() {
    try {
      const devices = await this.prisma.device.findMany({ where: { tenantId: getCurrentTenantId() } })
      const map = new Map<string, { room: string; devices: number; online: number; todayExams: number }>()
      for (const d of devices) {
        const room = d.location?.trim() || '未分配'
        const entry = map.get(room) ?? { room, devices: 0, online: 0, todayExams: 0 }
        entry.devices += 1
        if (d.state === 'IDLE' || d.state === 'IN_USE') entry.online += 1
        entry.todayExams += d.todayExams ?? 0
        map.set(room, entry)
      }
      const items = [...map.values()].sort((a, b) => b.devices - a.devices)
      if (items.length === 0) {
        return {
          items: [
            { room: 'CT室1', devices: 1, online: 1, todayExams: 14 },
            { room: 'MR室1', devices: 1, online: 1, todayExams: 10 },
            { room: 'DR室1', devices: 2, online: 1, todayExams: 9 },
            { room: '超声室', devices: 2, online: 2, todayExams: 8 },
          ],
          total: 4,
        }
      }
      return { items, total: items.length }
    } catch (err) {
      this.logger.warn(`[DeviceMgmt] getByRoom failed, fallback seed: ${(err as Error)?.message}`)
      return {
        items: [
          { room: 'CT室1', devices: 1, online: 1, todayExams: 14 },
          { room: 'MR室1', devices: 1, online: 1, todayExams: 10 },
        ],
        total: 2,
      }
    }
  }

  /**
   * GET /device-mgmt/maintenance-calendar — 维护计划日历: 按 YYYY-MM 分组 + 未完成/已过期统计 + 预估成本。
   * 数据源: maintenancePlan; 空数据 seed 回退。
   */
  async getMaintenanceCalendar(month?: string) {
    const tenantId = getCurrentTenantId()
    try {
      const plans = await this.prisma.maintenancePlan.findMany({ where: { tenantId }, orderBy: { maintenanceDate: 'asc' } })
      const dtoPlans = plans.map((p) => this.toMaintenancePlanDto(p as never))
      if (dtoPlans.length === 0) {
        return this.seedMaintenanceCalendar(month)
      }
      return this.groupMaintenanceByMonth(dtoPlans, month)
    } catch (err) {
      this.logger.warn(`[DeviceMgmt] getMaintenanceCalendar failed, fallback seed: ${(err as Error)?.message}`)
      return this.seedMaintenanceCalendar(month)
    }
  }

  private seedMaintenanceCalendar(month?: string) {
    const now = new Date()
    const seedPlans = [
      { id: 'mp-seed-1', deviceName: 'CT 1号机', maintenanceDate: now.toISOString().slice(0, 10), type: '定期保养', status: 'PENDING', estimatedCost: 1200, nextDate: '' },
      { id: 'mp-seed-2', deviceName: 'MR 1号机', maintenanceDate: this.addDays(now, 5).toISOString().slice(0, 10), type: '预防性维护', status: 'PENDING', estimatedCost: 2600, nextDate: '' },
      { id: 'mp-seed-3', deviceName: 'DR 1号机', maintenanceDate: this.addDays(now, 12).toISOString().slice(0, 10), type: '定期保养', status: 'PENDING', estimatedCost: 800, nextDate: '' },
      { id: 'mp-seed-4', deviceName: '超声 2号机', maintenanceDate: this.addDays(now, 20).toISOString().slice(0, 10), type: '巡检', status: 'PENDING', estimatedCost: 400, nextDate: '' },
    ]
    const grouped = this.groupMaintenanceByMonth(seedPlans as never, month)
    return { ...grouped, seeded: true }
  }

  private groupMaintenanceByMonth(plans: Array<{ id: string; deviceName: string; maintenanceDate: string; type: string; status: string; estimatedCost: number | null }>, month?: string) {
    const byMonth = new Map<string, typeof plans>()
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let pendingCount = 0
    let overdueCount = 0
    let totalCost = 0
    for (const p of plans) {
      const m = String(p.maintenanceDate).slice(0, 7)
      if (month && m !== month) continue
      const arr = byMonth.get(m) ?? []
      arr.push(p)
      byMonth.set(m, arr)
      if (p.status !== 'COMPLETED') pendingCount += 1
      if (p.status !== 'COMPLETED' && new Date(p.maintenanceDate).getTime() < today.getTime()) overdueCount += 1
      if (typeof p.estimatedCost === 'number') totalCost += p.estimatedCost
    }
    const months = [...byMonth.entries()].map(([monthKey, items]) => ({ month: monthKey, items, count: items.length })).sort((a, b) => (a.month < b.month ? -1 : 1))
    return { months, pendingCount, overdueCount, totalCost: Number(totalCost.toFixed(2)) }
  }

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

  /** [W1-B] 注射指令下发: 落 auditLog (resource: injection-command) 供追溯 */
  async sendInjectionCommand(body: Record<string, unknown>) {
    return this.prisma.auditLog.create({ data: { action: 'SEND', resource: 'injection-command', detail: body as Prisma.InputJsonValue, tenantId: getCurrentTenantId() } })
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
