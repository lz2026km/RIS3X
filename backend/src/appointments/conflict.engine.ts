/**
 * G005 放射RIS系统 - 预约冲突引擎 (专业 RIS 深度)
 * 跨资源冲突检测: 设备 + 机房 + 技师 + 患者 + 时段容量 + 工作时间/班次 + 设备维护
 * 纯函数实现 (不依赖 Prisma), 便于单元测试与 DB-less 安全回退。
 */

export type ConflictType =
  | 'DEVICE'
  | 'ROOM'
  | 'TECHNICIAN'
  | 'PATIENT'
  | 'SLOT_CAPACITY'
  | 'WORKING_HOURS'
  | 'MAINTENANCE'
  | 'SHIFT'

export type ConflictSeverity = 'ERROR' | 'WARN'

export interface AppointmentConflict {
  type: ConflictType
  severity: ConflictSeverity
  resource: string
  message: string
  conflictingId?: string
}

export interface ConflictCandidate {
  id?: string
  deviceId?: string | null
  roomId?: string | null
  technicianId?: string | null
  patientId?: string
  modality?: string
  startAt: Date
  endAt: Date
}

export interface ExistingAppointment {
  id: string
  deviceId?: string | null
  roomId?: string | null
  technicianId?: string | null
  patientId?: string
  state: string
  scheduledAt: Date
  endAt?: Date | null
}

export interface RoomResource {
  id: string
  name: string
  modality: string
  status: string
  maxPerSlot: number
  openTime: string
  closeTime: string
}

export interface TechnicianResource {
  id: string
  name: string
  modality: string
  status: string
  shiftStart: string
  shiftEnd: string
}

export interface DeviceResource {
  id: string
  name: string
  modality: string
  state: string
  maintenanceFrom?: string | Date | null
  maintenanceTo?: string | Date | null
}

export interface SlotRule {
  maxPerSlot: number
  openTime: string
  closeTime: string
}

export interface ConflictContext {
  candidate: ConflictCandidate
  existing: ExistingAppointment[]
  rooms?: RoomResource[]
  technicians?: TechnicianResource[]
  devices?: DeviceResource[]
  deviceRule?: SlotRule | null
  roomRule?: SlotRule | null
  excludeId?: string
}

const ACTIVE_STATES = ['SCHEDULED', 'CONFIRMED', 'REGISTERED', 'CHECKED_IN', 'IN_PROGRESS']

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map((v) => Number(v))
  if (Number.isNaN(h)) return 0
  return (h ?? 0) * 60 + (m ?? 0)
}

const minutesOfDay = (d: Date): number => d.getHours() * 60 + d.getMinutes()

const overlaps = (aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean =>
  aStart.getTime() < bEnd.getTime() && aEnd.getTime() > bStart.getTime()

export class ConflictEngine {
  /**
   * 检测预约候选时段与现有预约在 6 类资源上的冲突。
   * 返回结构化冲突数组 (空数组 = 无冲突)。ERROR 表示硬冲突需拒绝, WARN 表示软冲突可提示。
   */
  detect(ctx: ConflictContext): AppointmentConflict[] {
    const conflicts: AppointmentConflict[] = []
    const { candidate } = ctx
    const start = candidate.startAt
    const end = candidate.endAt

    if (!(start instanceof Date) || Number.isNaN(start.getTime())) {
      conflicts.push({ type: 'WORKING_HOURS', severity: 'ERROR', resource: 'schedule', message: '预约开始时间无效' })
      return conflicts
    }
    const safeEnd = end instanceof Date && !Number.isNaN(end.getTime()) && end > start
      ? end
      : new Date(start.getTime() + 30 * 60 * 1000)

    const activeExisting = ctx.existing.filter(
      (e) => e.id !== candidate.id && e.id !== ctx.excludeId && ACTIVE_STATES.includes(e.state),
    )

    // 1) 设备冲突
    if (candidate.deviceId) {
      for (const other of activeExisting) {
        if (!other.deviceId || other.deviceId !== candidate.deviceId) continue
        const otherEnd = other.endAt ?? new Date(other.scheduledAt.getTime() + 30 * 60 * 1000)
        if (overlaps(start, safeEnd, other.scheduledAt, otherEnd)) {
          conflicts.push({
            type: 'DEVICE',
            severity: 'ERROR',
            resource: candidate.deviceId,
            message: `设备时段冲突: 与预约 ${other.id} 重叠`,
            conflictingId: other.id,
          })
        }
      }
      const device = ctx.devices?.find((d) => d.id === candidate.deviceId)
      if (device && ['MAINTENANCE', 'BROKEN', 'OFFLINE'].includes(device.state)) {
        conflicts.push({
          type: 'MAINTENANCE',
          severity: 'ERROR',
          resource: candidate.deviceId,
          message: `设备 ${device.name} 处于 ${device.state} 状态, 不可预约`,
        })
      }
      const maintFrom = device?.maintenanceFrom ? new Date(device.maintenanceFrom) : null
      const maintTo = device?.maintenanceTo ? new Date(device.maintenanceTo) : null
      if (device && maintFrom && maintTo && overlaps(start, safeEnd, maintFrom, maintTo)) {
        conflicts.push({
          type: 'MAINTENANCE',
          severity: 'ERROR',
          resource: candidate.deviceId,
          message: `设备 ${device.name} 在 ${maintFrom.toISOString()} ~ ${maintTo.toISOString()} 维护, 不可预约`,
        })
      }
      if (ctx.deviceRule) {
        this.checkWorkingHours(start, safeEnd, ctx.deviceRule, candidate.deviceId, conflicts)
        this.checkSlotCapacity(activeExisting, start, safeEnd, 'deviceId', candidate.deviceId, ctx.deviceRule.maxPerSlot, conflicts)
      }
    }

    // 2) 机房冲突
    if (candidate.roomId) {
      for (const other of activeExisting) {
        if (!other.roomId || other.roomId !== candidate.roomId) continue
        const otherEnd = other.endAt ?? new Date(other.scheduledAt.getTime() + 30 * 60 * 1000)
        if (overlaps(start, safeEnd, other.scheduledAt, otherEnd)) {
          conflicts.push({
            type: 'ROOM',
            severity: 'ERROR',
            resource: candidate.roomId,
            message: `机房时段冲突: 与预约 ${other.id} 重叠`,
            conflictingId: other.id,
          })
        }
      }
      const room = ctx.rooms?.find((r) => r.id === candidate.roomId)
      if (room && room.status !== 'ACTIVE') {
        conflicts.push({
          type: 'ROOM',
          severity: 'ERROR',
          resource: candidate.roomId,
          message: `机房 ${room.name} 当前状态为 ${room.status}, 不可预约`,
        })
      }
      if (room && ctx.roomRule) {
        this.checkWorkingHours(start, safeEnd, ctx.roomRule, candidate.roomId, conflicts)
        this.checkSlotCapacity(activeExisting, start, safeEnd, 'roomId', candidate.roomId, ctx.roomRule.maxPerSlot, conflicts)
      }
    }

    // 3) 技师冲突
    if (candidate.technicianId) {
      for (const other of activeExisting) {
        if (!other.technicianId || other.technicianId !== candidate.technicianId) continue
        const otherEnd = other.endAt ?? new Date(other.scheduledAt.getTime() + 30 * 60 * 1000)
        if (overlaps(start, safeEnd, other.scheduledAt, otherEnd)) {
          conflicts.push({
            type: 'TECHNICIAN',
            severity: 'ERROR',
            resource: candidate.technicianId,
            message: `技师时段冲突: 与预约 ${other.id} 重叠`,
            conflictingId: other.id,
          })
        }
      }
      const tech = ctx.technicians?.find((t) => t.id === candidate.technicianId)
      if (tech) {
        if (tech.status !== 'ACTIVE') {
          conflicts.push({
            type: 'TECHNICIAN',
            severity: 'ERROR',
            resource: candidate.technicianId,
            message: `技师 ${tech.name} 当前状态为 ${tech.status}, 不可排班`,
          })
        }
        const sMin = minutesOfDay(start)
        const eMin = minutesOfDay(safeEnd)
        const shiftStart = toMinutes(tech.shiftStart)
        const shiftEnd = toMinutes(tech.shiftEnd)
        if (sMin < shiftStart || eMin > shiftEnd) {
          conflicts.push({
            type: 'SHIFT',
            severity: 'WARN',
            resource: candidate.technicianId,
            message: `超出技师 ${tech.name} 班次 (${tech.shiftStart}-${tech.shiftEnd})`,
          })
        }
      }
    }

    // 4) 患者冲突 (同一患者同一时段不可重复预约)
    if (candidate.patientId) {
      for (const other of activeExisting) {
        if (other.patientId !== candidate.patientId) continue
        const otherEnd = other.endAt ?? new Date(other.scheduledAt.getTime() + 30 * 60 * 1000)
        if (overlaps(start, safeEnd, other.scheduledAt, otherEnd)) {
          conflicts.push({
            type: 'PATIENT',
            severity: 'ERROR',
            resource: candidate.patientId,
            message: `患者时段冲突: 与预约 ${other.id} 重叠`,
            conflictingId: other.id,
          })
        }
      }
    }

    return conflicts
  }

  hasBlockingConflict(conflicts: AppointmentConflict[]): boolean {
    return conflicts.some((c) => c.severity === 'ERROR')
  }

  private checkWorkingHours(
    start: Date,
    end: Date,
    rule: SlotRule,
    resource: string,
    conflicts: AppointmentConflict[],
  ): void {
    const sMin = minutesOfDay(start)
    const eMin = end.getHours() * 60 + end.getMinutes()
    const open = toMinutes(rule.openTime)
    const close = toMinutes(rule.closeTime)
    if (sMin < open || eMin > close) {
      conflicts.push({
        type: 'WORKING_HOURS',
        severity: 'WARN',
        resource,
        message: `超出工作时间 (${rule.openTime}-${rule.closeTime})`,
      })
    }
  }

  private checkSlotCapacity(
    existing: ExistingAppointment[],
    start: Date,
    end: Date,
    field: 'deviceId' | 'roomId',
    resourceId: string,
    maxPerSlot: number,
    conflicts: AppointmentConflict[],
  ): void {
    const overlapping = existing.filter((e) => {
      if (e[field] !== resourceId) return false
      const otherEnd = e.endAt ?? new Date(e.scheduledAt.getTime() + 30 * 60 * 1000)
      return overlaps(start, end, e.scheduledAt, otherEnd)
    })
    if (overlapping.length >= maxPerSlot) {
      conflicts.push({
        type: 'SLOT_CAPACITY',
        severity: 'ERROR',
        resource: resourceId,
        message: `时段容量已满 (${overlapping.length}/${maxPerSlot})`,
      })
    }
  }
}

export const conflictEngine = new ConflictEngine()
