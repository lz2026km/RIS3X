// [G005 v3.0.6.11-103 Wave 18] 设备调度甘特图 V2 (Device Schedule Gantt V2) — PACS 设备深功能
// 数据源: Device/Exam 派生 + 内存维护块 + 确定性冲突检测
// 功能: 设备×时间周视图 / 排程块 CRUD / 拖拽更新 / 冲突检测 + 建议调整
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'

export type ScheduleBlockType = 'EXAM' | 'MAINTENANCE' | 'IDLE'

export interface ScheduleBlock {
  id: string
  deviceId: string
  deviceName: string
  type: ScheduleBlockType
  title: string
  start: string
  end: string
  examId?: string
  examNo?: string
  patientName?: string
  priority?: string
}

export interface ConflictInfo {
  blockId: string
  deviceId: string
  deviceName: string
  title: string
  start: string
  end: string
  overlapWith: string[]
  suggestion: { start: string; end: string; reason: string }
}

export interface DeviceWeekView {
  weekStart: string
  days: Array<{ date: string; label: string }>
  devices: Array<{
    deviceId: string
    code: string
    name: string
    modality: string
    blocks: ScheduleBlock[]
    conflicts: ConflictInfo[]
    utilization: number
  }>
}

export interface DeviceScheduleStats {
  weekStart: string
  totalBlocks: number
  examBlocks: number
  maintenanceBlocks: number
  conflicts: number
  utilizationByDevice: Array<{ deviceId: string; name: string; utilization: number; examCount: number; maintenanceMinutes: number }>
  idleHours: number
}

export interface DeviceSummary {
  id: string
  code: string
  name: string
  modality: string
  state: string
}

// 工作时段 08:00 - 18:00 (10 小时)
export const WORK_START_HOUR = 8
export const WORK_END_HOUR = 18

function deterministicHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function toMin(date: Date): number {
  return date.getHours() * 60 + date.getMinutes()
}

/** 本地时间字符串 YYYY-MM-DDTHH:mm:00 (与 seed/测试一致, 不受时区影响) */
function toLocalIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`
}

@Injectable()
export class DeviceScheduleService {
  private readonly logger = new Logger(DeviceScheduleService.name)

  // 内存维护块 (DB 未迁移新列时的回退, 风格与 deviceExtras 一致)
  private readonly maintBlocks = new Map<string, ScheduleBlock[]>()
  // 块 ID 自增计数器 (避免同一毫秒创建相同 ID)
  private blockSeq = 0

  constructor(private readonly prisma: PrismaService) {}

  private maintBlocksOf(deviceId: string): ScheduleBlock[] {
    return this.maintBlocks.get(deviceId) ?? []
  }

  // ── 周视图 ──
  async getWeekView(weekStart?: string): Promise<DeviceWeekView> {
    const start = this.parseWeekStart(weekStart)
    const devices = await this.listDevices()
    const examBlocks = await this.listExamBlocks(start)
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start.getTime() + i * 86400000)
      return { date: toLocalIso(d).slice(0, 10), label: `周${['日', '一', '二', '三', '四', '五', '六'][d.getDay()]}` }
    })
    const rows: DeviceWeekView['devices'] = devices.map((d) => {
      const blocks = [...examBlocks.filter((b) => b.deviceId === d.id), ...this.maintBlocksOf(d.id)]
      const perDay = days.map((day) => {
        const dayBlocks = blocks
          .filter((b) => b.start.slice(0, 10) === day.date)
          .sort((a, b) => a.start.localeCompare(b.start))
        const idleBlocks = this.computeIdleBlocks(day.date, dayBlocks)
        return [...dayBlocks, ...idleBlocks].sort((a, b) => a.start.localeCompare(b.start))
      })
      const flat = perDay.flat()
      const conflicts = this.detectConflicts(flat, d)
      const utilization = this.computeUtilization(flat)
      return { deviceId: d.id, code: d.code, name: d.name, modality: d.modality, blocks: flat, conflicts, utilization }
    })
    return { weekStart: toLocalIso(start).slice(0, 10), days, devices: rows }
  }

  async getStats(weekStart?: string): Promise<DeviceScheduleStats> {
    const view = await this.getWeekView(weekStart)
    const totalBlocks = view.devices.reduce((s, d) => s + d.blocks.length, 0)
    const examBlocks = view.devices.reduce((s, d) => s + d.blocks.filter((b) => b.type === 'EXAM').length, 0)
    const maintenanceBlocks = view.devices.reduce((s, d) => s + d.blocks.filter((b) => b.type === 'MAINTENANCE').length, 0)
    const conflicts = view.devices.reduce((s, d) => s + d.conflicts.length, 0)
    const utilByDevice = view.devices.map((d) => {
      const examCount = d.blocks.filter((b) => b.type === 'EXAM').length
      const maintenanceMinutes = d.blocks.filter((b) => b.type === 'MAINTENANCE').reduce((s, b) => s + this.durationMin(b), 0)
      return { deviceId: d.deviceId, name: d.name, utilization: d.utilization, examCount, maintenanceMinutes }
    })
    const idleHours = Math.round(view.devices.reduce((s, d) => s + d.blocks.filter((b) => b.type === 'IDLE').reduce((ss, b) => ss + this.durationMin(b), 0), 0) / 60)
    return { weekStart: view.weekStart, totalBlocks, examBlocks, maintenanceBlocks, conflicts, utilizationByDevice: utilByDevice, idleHours }
  }

  // ── 排程块 CRUD ──
  private async resolveDevice(deviceId: string): Promise<DeviceSummary> {
    try {
      const device = await this.prisma.device.findUnique({ where: { id: deviceId } })
      if (device) return { id: device.id, code: device.code, name: device.name, modality: device.modality, state: device.state }
    } catch (err) {
      this.logger.warn(`[DeviceSchedule] resolveDevice DB failed: ${(err as Error).message}`)
    }
    const seed = SEED_DEVICES.find((d) => d.id === deviceId)
    if (!seed) throw new NotFoundException(`Device ${deviceId} not found`)
    return seed
  }

  async createBlock(dto: { deviceId: string; type: Exclude<ScheduleBlockType, 'IDLE'>; title: string; start: string; end: string; examId?: string; priority?: string; patientName?: string; examNo?: string }): Promise<{ block: ScheduleBlock; conflicts: ConflictInfo[] }> {
    const device = await this.resolveDevice(dto.deviceId)
    const start = new Date(dto.start)
    const end = new Date(dto.end)
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime()) {
      throw new BadRequestException('无效的时间范围')
    }
    if (toMin(start) < WORK_START_HOUR * 60 || toMin(end) > WORK_END_HOUR * 60) {
      throw new BadRequestException('排程必须在工作时段 08:00-18:00 内')
    }
    const block: ScheduleBlock = {
      id: `SB-${Date.now().toString(36).toUpperCase()}-${++this.blockSeq}`,
      deviceId: dto.deviceId,
      deviceName: device.name,
      type: dto.type,
      title: dto.title,
      start: toLocalIso(start),
      end: toLocalIso(end),
      examId: dto.examId,
      examNo: dto.examNo,
      patientName: dto.patientName,
      priority: dto.priority,
    }
    const existing = this.maintBlocksOf(dto.deviceId)
    this.maintBlocks.set(dto.deviceId, [...existing, block])
    const all = await this.dayBlocksWith(dto.deviceId, start)
    const conflicts = this.detectConflicts(all, device)
    return { block, conflicts }
  }

  async updateBlock(id: string, dto: { start?: string; end?: string; title?: string; type?: Exclude<ScheduleBlockType, 'IDLE'> }): Promise<{ block: ScheduleBlock; conflicts: ConflictInfo[] }> {
    let entry = this.findBlock(id)
    // 拖拽 DB 派生检查块: 不存在于内存存储时, 以"覆盖快照"方式落入内存 (保留类型/标题)
    if (!entry) {
      const examBlock = (await this.listExamBlocks(new Date())).find((b) => b.id === id)
      if (!examBlock) throw new NotFoundException(`Schedule block ${id} not found`)
      entry = {
        block: { ...examBlock },
        device: SEED_DEVICES.find((d) => d.id === examBlock.deviceId) ?? {
          id: examBlock.deviceId, code: 'DEV', name: examBlock.deviceName || examBlock.deviceId, modality: 'CT', state: 'IDLE',
        },
      }
      this.maintBlocks.set(entry.device.id, [...this.maintBlocksOf(entry.device.id), entry.block])
    }
    const { block, device } = entry
    if (dto.start) block.start = toLocalIso(new Date(dto.start))
    if (dto.end) block.end = toLocalIso(new Date(dto.end))
    if (dto.title) block.title = dto.title
    if (dto.type) block.type = dto.type
    if (new Date(block.end).getTime() <= new Date(block.start).getTime()) {
      throw new BadRequestException('结束时间必须晚于开始时间')
    }
    if (toMin(new Date(block.start)) < WORK_START_HOUR * 60 || toMin(new Date(block.end)) > WORK_END_HOUR * 60) {
      throw new BadRequestException('排程必须在工作时段 08:00-18:00 内')
    }
    const all = await this.dayBlocksWith(device.id, new Date(block.start))
    const conflicts = this.detectConflicts(all, device)
    return { block, conflicts }
  }

  async deleteBlock(id: string): Promise<{ deleted: string }> {
    const entry = this.findBlock(id)
    if (!entry) throw new NotFoundException(`Schedule block ${id} not found`)
    const list = this.maintBlocksOf(entry.device.id).filter((b) => b.id !== id)
    this.maintBlocks.set(entry.device.id, list)
    return { deleted: id }
  }

  // ── 冲突检测 (确定性) ──
  async getConflicts(weekStart?: string): Promise<ConflictInfo[]> {
    const view = await this.getWeekView(weekStart)
    return view.devices.flatMap((d) => d.conflicts)
  }

  // ── 建议调整: 把块移动到同设备最近的空闲时段 ──
  async suggestMove(id: string): Promise<{ blockId: string; suggestion: ConflictInfo['suggestion'] }> {
    const entry = this.findBlock(id)
    if (!entry) throw new NotFoundException(`Schedule block ${id} not found`)
    const { block, device } = entry
    const day = block.start.slice(0, 10)
    const all = await this.dayBlocksWith(device.id, new Date(block.start))
    // 演示 seed 块与 IDLE 空闲占位不参与真实排期空闲计算
    const otherBlocks = all.filter((b) => b.id !== id && !b.id.includes('EX-SEED') && b.type !== 'IDLE')
    const duration = this.durationMin(block)
    let suggestion: ConflictInfo['suggestion'] | null = null
    for (let h = WORK_START_HOUR; h + Math.ceil(duration / 60) <= WORK_END_HOUR; h++) {
      const candStart = new Date(`${day}T${String(h).padStart(2, '0')}:00:00`)
      const candEnd = new Date(candStart.getTime() + duration * 60000)
      const overlaps = otherBlocks.some((b) => this.overlaps(candStart, candEnd, new Date(b.start), new Date(b.end)))
      if (!overlaps) {
        suggestion = { start: toLocalIso(candStart), end: toLocalIso(candEnd), reason: `已建议移至空闲时段 ${h}:00` }
        break
      }
    }
    if (!suggestion) throw new BadRequestException('本周内未找到空闲时段, 请选择其他设备')
    return { blockId: id, suggestion }
  }

  // ── 内部: 数据获取 ──
  private async listDevices(): Promise<DeviceSummary[]> {
    try {
      const rows = await this.prisma.device.findMany({
        where: { tenantId: getCurrentTenantId() },
        orderBy: { createdAt: 'asc' },
        take: 30,
      })
      if (rows.length === 0) return SEED_DEVICES
      return rows.map((d) => ({ id: d.id, code: d.code, name: d.name, modality: d.modality, state: d.state }))
    } catch (err) {
      this.logger.warn(`[DeviceSchedule] listDevices DB failed, fallback: ${(err as Error).message}`)
      return SEED_DEVICES
    }
  }

  private async listExamBlocks(weekStart: Date): Promise<ScheduleBlock[]> {
    try {
      const rows = await this.prisma.exam.findMany({
        where: {
          deviceId: { not: null },
          scheduledAt: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 86400000) },
        },
        select: {
          id: true,
          deviceId: true,
          accessionNumber: true,
          scheduledAt: true,
          startedAt: true,
          completedAt: true,
          state: true,
          priority: true,
          patient: { select: { name: true } },
          device: { select: { name: true, code: true } },
        },
      })
      if (rows.length === 0) return SEED_EXAM_BLOCKS(weekStart)
      return rows
        .filter((e) => e.scheduledAt)
        .map((e) => {
          const start = e.scheduledAt!
          const durationMin = 15 + (deterministicHash(e.id) % 45)
          const end = new Date(start.getTime() + durationMin * 60000)
          return {
            id: `EX-BLK-${e.id.slice(-8)}`,
            deviceId: e.deviceId!,
            deviceName: e.device?.name ?? e.deviceId!,
            type: 'EXAM' as const,
            title: `${e.patient?.name ?? '患者'} · ${e.priority ?? 'ROUTINE'}`,
            start: toLocalIso(start),
            end: toLocalIso(end),
            examId: e.id,
            examNo: e.accessionNumber,
            patientName: e.patient?.name,
            priority: e.priority,
          }
        })
    } catch (err) {
      this.logger.warn(`[DeviceSchedule] listExamBlocks DB failed, fallback: ${(err as Error).message}`)
      return SEED_EXAM_BLOCKS(weekStart)
    }
  }

  private async dayBlocksWith(deviceId: string, ref: Date): Promise<ScheduleBlock[]> {
    const dayStart = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate())
    const all = [...(await this.listExamBlocks(dayStart)), ...this.maintBlocksOf(deviceId)]
    const refDay = toLocalIso(ref).slice(0, 10)
    const dayBlocks = all
      .filter((b) => b.deviceId === deviceId && b.start.slice(0, 10) === refDay)
      .sort((a, b) => a.start.localeCompare(b.start))
    const idle = this.computeIdleBlocks(refDay, dayBlocks)
    return [...dayBlocks, ...idle].sort((a, b) => a.start.localeCompare(b.start))
  }

  private findBlock(id: string): { block: ScheduleBlock; device: DeviceSummary } | undefined {
    for (const [deviceId, blocks] of this.maintBlocks) {
      const block = blocks.find((b) => b.id === id)
      if (block) {
        const device = SEED_DEVICES.find((d) => d.id === deviceId) ?? {
          id: deviceId, code: 'DEV', name: block.deviceName || deviceId, modality: 'CT', state: 'IDLE',
        }
        return { block, device }
      }
    }
    return undefined
  }

  // ── 空闲块计算 (工作时段内未占用区间) ──
  private computeIdleBlocks(day: string, blocks: ScheduleBlock[]): ScheduleBlock[] {
    const workStart = new Date(`${day}T${String(WORK_START_HOUR).padStart(2, '0')}:00:00`)
    const workEnd = new Date(`${day}T${String(WORK_END_HOUR).padStart(2, '0')}:00:00`)
    const occupied: Array<{ start: Date; end: Date }> = blocks
      .filter((b) => b.type !== 'IDLE')
      .map((b) => ({ start: new Date(b.start), end: new Date(b.end) }))
      .sort((a, b) => a.start.getTime() - b.start.getTime())
    const gaps: ScheduleBlock[] = []
    let cursor = workStart.getTime()
    for (const o of occupied) {
      const oStart = Math.max(o.start.getTime(), workStart.getTime())
      const oEnd = Math.min(o.end.getTime(), workEnd.getTime())
      if (oStart > cursor + 15 * 60000) {
        gaps.push({
          id: `IDLE-${day}-${gaps.length}`,
          deviceId: blocks[0]?.deviceId ?? '',
          deviceName: blocks[0]?.deviceName ?? '',
          type: 'IDLE',
          title: '空闲',
          start: toLocalIso(new Date(cursor)),
          end: toLocalIso(new Date(oStart)),
        })
      }
      cursor = Math.max(cursor, oEnd)
    }
    if (workEnd.getTime() - cursor > 15 * 60000) {
      gaps.push({
        id: `IDLE-${day}-${gaps.length}`,
        deviceId: blocks[0]?.deviceId ?? '',
        deviceName: blocks[0]?.deviceName ?? '',
        type: 'IDLE',
        title: '空闲',
        start: toLocalIso(new Date(cursor)),
        end: toLocalIso(workEnd),
      })
    }
    return gaps
  }

  private detectConflicts(blocks: ScheduleBlock[], device: DeviceSummary): ConflictInfo[] {
    const real = blocks
      .filter((b) => b.type !== 'IDLE' && !b.id.includes('EX-SEED'))
      .sort((a, b) => a.start.localeCompare(b.start))
    const conflicts: ConflictInfo[] = []
    for (let i = 0; i < real.length; i++) {
      for (let j = i + 1; j < real.length; j++) {
        const a = real[i]!
        const b = real[j]!
        if (this.overlaps(new Date(a.start), new Date(a.end), new Date(b.start), new Date(b.end))) {
          if (!conflicts.some((c) => c.blockId === a.id)) {
            conflicts.push(this.buildConflict(a, real, device))
          }
          if (!conflicts.some((c) => c.blockId === b.id)) {
            conflicts.push(this.buildConflict(b, real, device))
          }
        }
      }
    }
    return conflicts
  }

  private buildConflict(block: ScheduleBlock, all: ScheduleBlock[], device: DeviceSummary): ConflictInfo {
    const overlapWith = all
      .filter((b) => b.id !== block.id && b.type !== 'IDLE' && this.overlaps(new Date(block.start), new Date(block.end), new Date(b.start), new Date(b.end)))
      .map((b) => b.title)
    const duration = this.durationMin(block)
    const day = block.start.slice(0, 10)
    let suggestion: ConflictInfo['suggestion'] = { start: block.start, end: block.end, reason: '无可用调整时段' }
    for (let h = WORK_START_HOUR; h + Math.ceil(duration / 60) <= WORK_END_HOUR; h++) {
      const candStart = new Date(`${day}T${String(h).padStart(2, '0')}:00:00`)
      const candEnd = new Date(candStart.getTime() + duration * 60000)
      const occupied = all.some((b) => b.id !== block.id && b.type !== 'IDLE' && this.overlaps(candStart, candEnd, new Date(b.start), new Date(b.end)))
      if (!occupied) {
        suggestion = { start: toLocalIso(candStart), end: toLocalIso(candEnd), reason: `建议移至 ${h}:00-${h + Math.ceil(duration / 60)}:00 空闲时段` }
        break
      }
    }
    return { blockId: block.id, deviceId: device.id, deviceName: device.name, title: block.title, start: block.start, end: block.end, overlapWith, suggestion }
  }

  private overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
    return aStart.getTime() < bEnd.getTime() && bStart.getTime() < aEnd.getTime()
  }

  private durationMin(b: ScheduleBlock): number {
    return Math.max(15, Math.round((new Date(b.end).getTime() - new Date(b.start).getTime()) / 60000))
  }

  private computeUtilization(blocks: ScheduleBlock[]): number {
    const dayMs = (WORK_END_HOUR - WORK_START_HOUR) * 60 * 60000
    if (dayMs <= 0) return 0
    const used = blocks
      .filter((b) => b.type !== 'IDLE')
      .reduce((s, b) => s + this.durationMin(b) * 60000, 0)
    return Math.min(100, Math.round((used / dayMs) * 100))
  }

  private parseWeekStart(weekStart?: string): Date {
    if (weekStart) {
      const d = new Date(`${weekStart}T00:00:00`)
      if (Number.isFinite(d.getTime())) return d
    }
    const now = new Date()
    const day = now.getDay()
    const diff = day === 0 ? -6 : 1 - day
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diff)
    monday.setHours(0, 0, 0, 0)
    return monday
  }
}

// ── 确定性 seed 设备 (无 DB 时回退) ──
const SEED_DEVICES: DeviceSummary[] = [
  { id: 'dev-ct-01', code: 'CT-01', name: 'CT-1 号机房', modality: 'CT', state: 'IN_USE' },
  { id: 'dev-ct-02', code: 'CT-02', name: 'CT-2 号机房', modality: 'CT', state: 'IDLE' },
  { id: 'dev-mr-01', code: 'MR-01', name: 'MR-1 号机房', modality: 'MR', state: 'IN_USE' },
  { id: 'dev-mr-02', code: 'MR-02', name: 'MR-2 号机房', modality: 'MR', state: 'MAINTENANCE' },
  { id: 'dev-dr-01', code: 'DR-01', name: 'DR-1 号机房', modality: 'DR', state: 'IDLE' },
  { id: 'dev-dsa-01', code: 'DSA-01', name: 'DSA 导管室', modality: 'DSA', state: 'IDLE' },
]

function SEED_EXAM_BLOCKS(weekStart: Date): ScheduleBlock[] {
  const out: ScheduleBlock[] = []
  const patients = ['张伟', '李娜', '王芳', '赵刚', '孙丽', '周强', '吴敏', '郑涛', '冯雪', '陈静']
  SEED_DEVICES.forEach((dev, di) => {
    // 每台设备: 每周一~周五 1-2 个检查块 (确定性), 起点 = weekStart 当天 (day=0)
    for (let day = 0; day < 5; day++) {
      const count = 1 + (deterministicHash(dev.id + day) % 2)
      for (let k = 0; k < count; k++) {
        const hour = 9 + ((deterministicHash(dev.id + day + k) % 7))
        const start = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + day)
        start.setHours(hour, 0, 0, 0)
        const duration = 20 + (deterministicHash(dev.id + day + k + 7) % 40)
        const end = new Date(start.getTime() + duration * 60000)
        const p = patients[(deterministicHash(dev.id + day + k) + di) % patients.length]!
        out.push({
          id: `EX-SEED-${di}-${day}-${k}`,
          deviceId: dev.id,
          deviceName: dev.name,
          type: 'EXAM',
          title: `${p} · 常规`,
          start: toLocalIso(start),
          end: toLocalIso(end),
          examNo: `ACC-${String(1000 + deterministicHash(dev.id + day + k) % 9000)}`,
          patientName: p,
          priority: 'ROUTINE',
        })
      }
    }
  })
  // 维护块示例 (确定性): 周二 14:00-15:30 MR-1 预防性维护
  const maintStart = new Date(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + 1)
  maintStart.setHours(14, 0, 0, 0)
  const maintEnd = new Date(maintStart.getTime() + 90 * 60000)
  out.push({
    id: 'EX-SEED-MAINT',
    deviceId: 'dev-mr-01',
    deviceName: 'MR-1 号机房',
    type: 'MAINTENANCE',
    title: '预防性维护 · 线圈检测',
    start: toLocalIso(maintStart),
    end: toLocalIso(maintEnd),
  })
  return out
}
