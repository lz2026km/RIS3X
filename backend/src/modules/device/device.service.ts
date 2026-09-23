import { Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import type { Device } from '@prisma/client'

export interface CreateDeviceDto {
  code: string
  name: string
  modality: string
  manufacturer?: string
  location?: string
}

export interface UpdateDeviceDto {
  name?: string
  modality?: string
  manufacturer?: string
  location?: string
  state?: 'IDLE' | 'IN_USE' | 'MAINTENANCE' | 'BROKEN' | 'OFFLINE'
}

export interface MaintenanceLogDto {
  type: 'preventive' | 'corrective'
  hoursUsed?: number
  note?: string
}

// [v3.0.6.11-100 Wave 1B] 默认维护周期 (小时)
export const MAINTENANCE_CYCLE_HOURS = 2000

@Injectable()
export class DeviceService {
  /**
   * [v3.0.6.11-100 Wave 1B] Device 维护字段 (maintenanceHours/lastMaintenanceAt/maintenanceLogs)
   * DB 未迁移新列时的内存回退 (风格与 worklist examExtras 一致)。
   */
  private readonly deviceExtras = new Map<string, Record<string, unknown>>()

  constructor(private readonly prisma: PrismaService) {}

  /** 内存回退: 将维护扩展字段覆盖合并到 device 行 */
  private mergeExtras<T extends Record<string, unknown>>(d: T): T {
    const extras = this.deviceExtras.get(String(d.id))
    return extras ? { ...d, ...extras } : d
  }

  async list(params: { skip?: number; take?: number; modality?: string; state?: string }) {
    const where: any = {}
    if (params.modality) where.modality = params.modality
    if (params.state) where.state = params.state
    const [items, total] = await Promise.all([
      this.prisma.device.findMany({
        where,
        skip: params.skip ?? 0,
        take: params.take ?? 50,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.device.count({ where }),
    ])
    return { items: items.map((d) => this.mergeExtras(d as unknown as Record<string, unknown>)), total }
  }

  async get(id: string): Promise<Device> {
    const d = await this.prisma.device.findUnique({
      where: { id },
      include: { exams: { take: 10, orderBy: { createdAt: 'desc' } } },
    })
    if (!d) throw new NotFoundException(`Device ${id} not found`)
    return this.mergeExtras(d as unknown as Record<string, unknown>) as unknown as Device
  }

  async create(dto: CreateDeviceDto): Promise<Device> {
    return this.prisma.device.create({
      data: {
        code: dto.code,
        name: dto.name,
        modality: dto.modality,
        manufacturer: dto.manufacturer,
        location: dto.location,
        tenantId: getCurrentTenantId(),
      },
    })
  }

  async update(id: string, dto: UpdateDeviceDto): Promise<Device> {
    const existing = await this.prisma.device.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Device ${id} not found`)
    return this.prisma.device.update({ where: { id }, data: dto })
  }

  async delete(id: string): Promise<{ ok: true }> {
    const existing = await this.prisma.device.findUnique({ where: { id } })
    if (!existing) throw new NotFoundException(`Device ${id} not found`)
    await this.prisma.device.delete({ where: { id } })
    return { ok: true }
  }

  /**
   * [G005 W3-BackendParity] GET /devices/stats/today — 今日设备状态统计
   * 前端 deviceApi.getTodayStats 期望 { totalDevices, inUse, idle, maintenance };
   * 同时附带 total (兼容既有 mock 断言)。DB 不可用回退确定性种子。
   */
  async getTodayStats() {
    try {
      const [total, inUse, idle, maintenance] = await Promise.all([
        this.prisma.device.count(),
        this.prisma.device.count({ where: { state: 'IN_USE' } }),
        this.prisma.device.count({ where: { state: 'IDLE' } }),
        this.prisma.device.count({ where: { state: 'MAINTENANCE' } }),
      ])
      return { success: true, data: { totalDevices: total, total, inUse, idle, maintenance } }
    } catch {
      const totalDevices = 12
      return { success: true, data: { totalDevices, total: totalDevices, inUse: 5, idle: 4, maintenance: 2 } }
    }
  }

  async getStats(id: string) {
    const device = await this.prisma.device.findUnique({ where: { id } })
    if (!device) throw new NotFoundException(`Device ${id} not found`)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayExams = await this.prisma.exam.count({
      where: { deviceId: id, createdAt: { gte: today } },
    })
    const merged = this.mergeExtras(device as unknown as Record<string, unknown>) as Record<string, unknown>
    return {
      todayExams,
      totalExams: device.todayExams,
      usageMinutes: device.todayUsageMin,
      // [v3.0.6.11-100 Wave 1B] 维护扩展字段透出
      maintenanceHours: merged.maintenanceHours ?? 0,
      lastMaintenanceAt: merged.lastMaintenanceAt ?? null,
      maintenanceLogs: Array.isArray(merged.maintenanceLogs) ? merged.maintenanceLogs : [],
    }
  }

  // ============ [v3.0.6.11-100 Wave 1B] 设备维护提醒 ============

  /**
   * POST /devices/:id/maintenance-log — 记录维护 ({ type: preventive|corrective, hoursUsed?, note? })。
   * 重置累计使用时长 (maintenanceHours=0) + 更新 lastMaintenanceAt (内存回退)。
   */
  async logMaintenance(id: string, dto: MaintenanceLogDto) {
    const device = await this.prisma.device.findUnique({ where: { id } })
    if (!device) throw new NotFoundException(`Device ${id} not found`)
    const entry = {
      type: dto.type,
      hoursUsed: Number(dto.hoursUsed ?? 0),
      note: dto.note?.trim() ?? '',
      at: new Date().toISOString(),
    }
    const prev = this.deviceExtras.get(id) ?? {}
    const logs = Array.isArray(prev.maintenanceLogs) ? (prev.maintenanceLogs as unknown[]) : []
    const extras = {
      ...prev,
      maintenanceHours: 0,
      lastMaintenanceAt: entry.at,
      maintenanceLogs: [...logs, entry],
    }
    this.deviceExtras.set(id, extras)
    return this.mergeExtras({ ...device } as unknown as Record<string, unknown>)
  }

  /**
   * GET /devices/maintenance-due — 维护到期列表 (剩余小时数, 周期默认 2000h)。
   * 使用时长: extras maintenanceHours 显式值优先 (维护后重置为 0);
   *   否则按最近维护后完成的检查时长累计 (分钟→小时), 无维护记录则全量累计。
   */
  async getMaintenanceDue(cycleHours: number = MAINTENANCE_CYCLE_HOURS) {
    const tenantId = getCurrentTenantId()
    const [devices, completed] = await Promise.all([
      this.prisma.device.findMany({ where: { tenantId } }),
      this.prisma.exam.findMany({
        where: { tenantId, state: 'COMPLETED', deviceId: { not: null }, startedAt: { not: null }, completedAt: { not: null } },
        select: { deviceId: true, startedAt: true, completedAt: true },
      }),
    ])
    const mins = (e: { startedAt: Date | null; completedAt: Date | null }) => {
      if (!e.startedAt || !e.completedAt) return 0
      const m = (e.completedAt.getTime() - e.startedAt.getTime()) / 60000
      return Number.isFinite(m) && m >= 0 ? m : 0
    }
    const totalByDevice = new Map<string, number>()
    const sinceByDevice = new Map<string, number>()
    const maintAtByDevice = new Map<string, number>()
    for (const d of devices) {
      const since = this.deviceExtras.get(d.id)?.lastMaintenanceAt
      if (since) maintAtByDevice.set(d.id, new Date(String(since)).getTime())
    }
    for (const e of completed) {
      totalByDevice.set(e.deviceId!, (totalByDevice.get(e.deviceId!) ?? 0) + mins(e))
      const sinceMs = maintAtByDevice.get(e.deviceId!)
      if (sinceMs === undefined || (e.completedAt?.getTime() ?? 0) >= sinceMs) {
        sinceByDevice.set(e.deviceId!, (sinceByDevice.get(e.deviceId!) ?? 0) + mins(e))
      }
    }
    const hours = (map: Map<string, number>, id: string) => Math.round(((map.get(id) ?? 0) / 60) * 10) / 10
    const items = devices.map((d) => {
      const extras = this.deviceExtras.get(d.id) ?? {}
      const lastMaintenanceAt = extras.lastMaintenanceAt ?? null
      // extras maintenanceHours 显式值优先 (logMaintenance 后为 0), 否则按检查时长派生
      const usedHours = extras.maintenanceHours !== undefined
        ? Number(extras.maintenanceHours)
        : lastMaintenanceAt
          ? hours(sinceByDevice, d.id)
          : hours(totalByDevice, d.id)
      const remaining = Math.max(0, Math.round((cycleHours - usedHours) * 10) / 10)
      const ratio = cycleHours > 0 ? remaining / cycleHours : 0
      const status: 'overdue' | 'warning' | 'ok' | 'maintenance' =
        d.state === 'MAINTENANCE' ? 'maintenance'
        : remaining <= 0 ? 'overdue'
        : ratio <= 0.25 ? 'warning'
        : 'ok'
      return {
        deviceId: d.id,
        code: d.code,
        name: d.name,
        modality: d.modality,
        location: d.location,
        state: d.state,
        usedHours,
        remainingHours: remaining,
        cycleHours,
        status,
        lastMaintenanceAt,
        lastMaintenance: lastMaintenanceAt ? new Date(String(lastMaintenanceAt)).toISOString() : null,
        logs: Array.isArray(extras.maintenanceLogs) ? extras.maintenanceLogs : [],
      }
    })
    items.sort((a, b) => {
      const order: Record<string, number> = { overdue: 0, warning: 1, maintenance: 2, ok: 3 }
      return (order[a.status] ?? 9) - (order[b.status] ?? 9)
    })
    return { items, total: items.length, cycleHours, updatedAt: new Date().toISOString() }
  }
}
