/**
 * G005 放射RIS系统 v3.0.6.11-99 Wave 6B (tech-schedule) - 技师排班管理服务
 * 现有表派生(技师/检查室) + 内存 CRUD + 种子:
 *   - 排班:   GET/POST /tech-schedules, PATCH/DELETE /:id
 *   - 操作:   POST /:id/confirm | /:id/swap | /:id/leave
 *   - 视图:   GET /calendar (月历矩阵) / GET /stats (统计) / GET /meta (技师+检查室)
 *   - 批量:   POST /batch-create (起止日期 + 班次模式)
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'

export type TechShift = 'DAY' | 'NIGHT' | 'WEEKEND' | 'BACKUP'
export type TechScheduleStatus = 'SCHEDULED' | 'CONFIRMED' | 'SWAPPED' | 'ON_LEAVE'

export interface TechSchedule {
  id: string
  date: string
  shift: TechShift
  technicianId: string
  technicianName: string
  roomId: string | null
  roomName: string | null
  status: TechScheduleStatus
  notes: string | null
  swapReason: string | null
  leaveReason: string | null
  createdAt: string
  updatedAt: string
}

export interface TechScheduleDto {
  date: string
  shift: TechShift
  technicianId: string
  roomId?: string | null
  notes?: string | null
}

export interface TechCalendarDay {
  date: string
  weekday: string
  isToday: boolean
  schedules: TechSchedule[]
}

export interface TechCalendar {
  month: string
  year: number
  days: TechCalendarDay[]
  technicians: TechTechnician[]
}

export interface TechTechnician {
  id: string
  name: string
  group: string
}

export interface TechRoom {
  id: string
  name: string
}

export interface TechStats {
  month: string
  totalShifts: number
  technicianCount: number
  leaveCount: number
  nightShiftCount: number
  weekendShiftCount: number
  backupShiftCount: number
  confirmedCount: number
  swappedCount: number
  byTechnician: Array<{ technicianId: string; technicianName: string; count: number; nights: number; leaves: number }>
  byShift: Array<{ shift: TechShift; label: string; count: number }>
}

export const SHIFT_LABELS: Record<TechShift, string> = {
  DAY: '白班',
  NIGHT: '夜班',
  WEEKEND: '周末班',
  BACKUP: '备班',
}

export const STATUS_LABELS: Record<TechScheduleStatus, string> = {
  SCHEDULED: '排定',
  CONFIRMED: '已确认',
  SWAPPED: '已换班',
  ON_LEAVE: '已请假',
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const dayStr = (offsetDay: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDay)
  return d.toISOString().slice(0, 10)
}

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()

// 技师名册 (派生自 users 表 TECHNICIAN 角色, 内存展开)
const TECH_ROSTER: TechTechnician[] = [
  { id: 'T-001', name: '刘洋', group: 'CT 室' },
  { id: 'T-002', name: '赵志刚', group: 'CT 组' },
  { id: 'T-003', name: '孙伟', group: 'MR 组' },
  { id: 'T-004', name: '王磊', group: 'DR 组' },
  { id: 'T-005', name: '陈静', group: 'DSA 组' },
  { id: 'T-006', name: '周婷', group: 'MG 组' },
  { id: 'T-007', name: '吴强', group: 'CT 组' },
  { id: 'T-008', name: '郑爽', group: 'MR 组' },
]

const ROOMS: TechRoom[] = [
  { id: 'R-CT1', name: 'CT-1 检查室' },
  { id: 'R-CT2', name: 'CT-2 检查室' },
  { id: 'R-MR1', name: 'MR-1 检查室' },
  { id: 'R-DR1', name: 'DR-1 检查室' },
  { id: 'R-DSA1', name: 'DSA-1 检查室' },
  { id: 'R-MG1', name: 'MG-1 检查室' },
]

const SEED_SCHEDULES: TechSchedule[] = [
  { id: 'TS-001', date: dayStr(0), shift: 'DAY', technicianId: 'T-001', technicianName: '刘洋', roomId: 'R-CT1', roomName: 'CT-1 检查室', status: 'CONFIRMED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-002', date: dayStr(0), shift: 'NIGHT', technicianId: 'T-004', technicianName: '王磊', roomId: 'R-MR1', roomName: 'MR-1 检查室', status: 'SCHEDULED', notes: '急诊通道备勤', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-003', date: dayStr(0), shift: 'BACKUP', technicianId: 'T-007', technicianName: '吴强', roomId: null, roomName: null, status: 'SCHEDULED', notes: '机动补位', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-004', date: dayStr(1), shift: 'DAY', technicianId: 'T-002', technicianName: '赵志刚', roomId: 'R-CT2', roomName: 'CT-2 检查室', status: 'CONFIRMED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-005', date: dayStr(1), shift: 'NIGHT', technicianId: 'T-005', technicianName: '陈静', roomId: 'R-DSA1', roomName: 'DSA-1 检查室', status: 'SCHEDULED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-006', date: dayStr(2), shift: 'DAY', technicianId: 'T-006', technicianName: '周婷', roomId: 'R-MG1', roomName: 'MG-1 检查室', status: 'CONFIRMED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-007', date: dayStr(2), shift: 'NIGHT', technicianId: 'T-003', technicianName: '孙伟', roomId: 'R-MR1', roomName: 'MR-1 检查室', status: 'SCHEDULED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-008', date: dayStr(3), shift: 'DAY', technicianId: 'T-008', technicianName: '郑爽', roomId: 'R-DR1', roomName: 'DR-1 检查室', status: 'SCHEDULED', notes: '带教见习', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-009', date: dayStr(3), shift: 'WEEKEND', technicianId: 'T-001', technicianName: '刘洋', roomId: 'R-CT1', roomName: 'CT-1 检查室', status: 'SWAPPED', notes: null, swapReason: '与 T-002 对调周末班', leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-010', date: dayStr(4), shift: 'NIGHT', technicianId: 'T-002', technicianName: '赵志刚', roomId: 'R-CT2', roomName: 'CT-2 检查室', status: 'ON_LEAVE', notes: null, swapReason: null, leaveReason: '家中有事，需补位', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-011', date: dayStr(4), shift: 'DAY', technicianId: 'T-007', technicianName: '吴强', roomId: 'R-CT1', roomName: 'CT-1 检查室', status: 'SCHEDULED', notes: null, swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'TS-012', date: dayStr(5), shift: 'WEEKEND', technicianId: 'T-006', technicianName: '周婷', roomId: 'R-MG1', roomName: 'MG-1 检查室', status: 'SCHEDULED', notes: '周末上午半天', swapReason: null, leaveReason: null, createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
]

// [G005 Wave 10A] 月排班 seed 扩充: 4 周 × 8 技师 (28 天完整排班, 确定性轮转)
// 轮转模式: 每组 (CT 3 人 / MR 2 人 / DR 1 人 / DSA 1 人 / MG 1 人) 按 4 天周期轮换白/夜班
const SEED_MONTH_SCHEDULES: TechSchedule[] = (() => {
  const out: TechSchedule[] = []
  const groups: Array<{ techId: string; name: string; roomId: string }[]> = [
    [{ techId: 'T-001', name: '刘洋', roomId: 'R-CT1' }, { techId: 'T-002', name: '赵志刚', roomId: 'R-CT2' }, { techId: 'T-007', name: '吴强', roomId: 'R-CT1' }],
    [{ techId: 'T-003', name: '孙伟', roomId: 'R-MR1' }, { techId: 'T-008', name: '郑爽', roomId: 'R-MR1' }],
    [{ techId: 'T-004', name: '王磊', roomId: 'R-DR1' }],
    [{ techId: 'T-005', name: '陈静', roomId: 'R-DSA1' }],
    [{ techId: 'T-006', name: '周婷', roomId: 'R-MG1' }],
  ]
  const shifts: TechShift[] = ['DAY', 'DAY', 'NIGHT', 'WEEKEND']
  let seq = 1000
  for (let d = 6; d <= 33; d += 1) {
    const date = dayStr(d)
    const weekday = WEEKDAYS[new Date(date + 'T00:00:00Z').getUTCDay()]!
    groups.forEach((group, gi) => {
      const shift = weekday === '周六' || weekday === '周日' ? 'WEEKEND' : shifts[(d + gi) % shifts.length]!
      const member = group[d % group.length]!
      seq += 1
      out.push({
        id: `TS-${seq}`,
        date,
        shift,
        technicianId: member.techId,
        technicianName: member.name,
        roomId: member.roomId,
        roomName: member.roomId === 'R-CT1' ? 'CT-1 检查室' : member.roomId === 'R-CT2' ? 'CT-2 检查室' : member.roomId === 'R-MR1' ? 'MR-1 检查室' : member.roomId === 'R-DR1' ? 'DR-1 检查室' : member.roomId === 'R-DSA1' ? 'DSA-1 检查室' : 'MG-1 检查室',
        status: d % 11 === 0 ? 'ON_LEAVE' : d % 7 === 4 ? 'SWAPPED' : d % 3 === 0 ? 'CONFIRMED' : 'SCHEDULED',
        notes: weekday === '周六' || weekday === '周日' ? '周末轮值' : null,
        swapReason: d % 7 === 4 ? '组内对调夜班' : null,
        leaveReason: d % 11 === 0 ? '调休' : null,
        createdAt: iso(24 * 60),
        updatedAt: iso(24 * 60),
      })
    })
  }
  return out
})()

const ALL_SEED_SCHEDULES = [...SEED_SCHEDULES, ...SEED_MONTH_SCHEDULES]

@Injectable()
export class TechScheduleService {
  private schedules: TechSchedule[] = ALL_SEED_SCHEDULES.map((s) => ({ ...s }))

  getTechnicians(): TechTechnician[] {
    return TECH_ROSTER.map((t) => ({ ...t }))
  }

  getRooms(): TechRoom[] {
    return ROOMS.map((r) => ({ ...r }))
  }

  private techName(technicianId: string): string {
    return TECH_ROSTER.find((t) => t.id === technicianId)?.name ?? technicianId
  }

  private roomName(roomId: string | null | undefined): { roomId: string | null; roomName: string | null } {
    if (!roomId) return { roomId: null, roomName: null }
    const hit = ROOMS.find((r) => r.id === roomId)
    return { roomId, roomName: hit?.name ?? roomId }
  }

  // ================= 列表 =================

  list(query: { date?: string; month?: string; technicianId?: string; status?: string }): TechSchedule[] {
    let items = this.schedules
    if (query.date) items = items.filter((s) => s.date === query.date)
    if (query.month) items = items.filter((s) => s.date.startsWith(query.month!))
    if (query.technicianId) items = items.filter((s) => s.technicianId === query.technicianId)
    if (query.status) items = items.filter((s) => s.status === query.status)
    return [...items].sort((a, b) => a.date.localeCompare(b.date) || a.shift.localeCompare(b.shift))
  }

  // ================= 创建 =================

  create(dto: TechScheduleDto): TechSchedule {
    const date = String(dto.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date 格式应为 YYYY-MM-DD')
    if (!dto.technicianId || !String(dto.technicianId).trim()) throw new BadRequestException('technicianId 必填')
    if (!TECH_ROSTER.some((t) => t.id === dto.technicianId)) throw new BadRequestException(`技师 ${dto.technicianId} 不存在`)
    if (!SHIFT_LABELS[dto.shift]) throw new BadRequestException('shift 应为 DAY/NIGHT/WEEKEND/BACKUP')
    const same = this.schedules.find((s) => s.date === date && s.technicianId === dto.technicianId)
    if (same) throw new BadRequestException(`技师 ${same.technicianName} 在 ${date} 已有排班`)
    const room = this.roomName(dto.roomId)
    const now = new Date().toISOString()
    const item: TechSchedule = {
      id: `TS-${Date.now()}`,
      date,
      shift: dto.shift,
      technicianId: dto.technicianId,
      technicianName: this.techName(dto.technicianId),
      roomId: room.roomId,
      roomName: room.roomName,
      status: 'SCHEDULED',
      notes: dto.notes || null,
      swapReason: null,
      leaveReason: null,
      createdAt: now,
      updatedAt: now,
    }
    this.schedules.unshift(item)
    return { ...item }
  }

  // ================= 编辑 =================

  update(id: string, dto: Partial<TechScheduleDto>): TechSchedule {
    const hit = this.findOrThrow(id)
    if (dto.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dto.date))) throw new BadRequestException('date 格式错误')
      hit.date = dto.date
    }
    if (dto.shift !== undefined) {
      if (!SHIFT_LABELS[dto.shift]) throw new BadRequestException('shift 非法')
      hit.shift = dto.shift
    }
    if (dto.technicianId !== undefined) {
      if (!TECH_ROSTER.some((t) => t.id === dto.technicianId)) throw new BadRequestException('技师不存在')
      hit.technicianId = dto.technicianId
      hit.technicianName = this.techName(dto.technicianId)
    }
    if (dto.roomId !== undefined) {
      const room = this.roomName(dto.roomId)
      hit.roomId = room.roomId
      hit.roomName = room.roomName
    }
    if (dto.notes !== undefined) hit.notes = dto.notes
    hit.updatedAt = new Date().toISOString()
    return { ...hit }
  }

  remove(id: string): void {
    const idx = this.schedules.findIndex((s) => s.id === id)
    if (idx < 0) throw new NotFoundException(`排班 ${id} 不存在`)
    this.schedules.splice(idx, 1)
  }

  // ================= 确认 =================

  confirm(id: string): TechSchedule {
    const hit = this.findOrThrow(id)
    if (hit.status === 'ON_LEAVE') throw new BadRequestException('已请假班次不可确认')
    hit.status = 'CONFIRMED'
    hit.updatedAt = new Date().toISOString()
    return { ...hit }
  }

  // ================= 换班 (双方交换) =================

  swap(id: string, dto: { targetId?: string; targetTechId?: string; reason?: string }): { source: TechSchedule; target: TechSchedule } {
    const source = this.findOrThrow(id)
    let target: TechSchedule | undefined
    if (dto.targetId) {
      target = this.schedules.find((s) => s.id === dto.targetId)
      if (!target) throw new NotFoundException(`目标排班 ${dto.targetId} 不存在`)
    } else if (dto.targetTechId) {
      target = this.schedules.find((s) => s.technicianId === dto.targetTechId && s.date === source.date)
      if (!target) throw new NotFoundException(`技师 ${dto.targetTechId} 在 ${source.date} 无排班可换`)
    } else {
      throw new BadRequestException('targetId 或 targetTechId 必填')
    }
    if (target.id === source.id) throw new BadRequestException('不能与自己换班')
    const reason = dto.reason || '双方协商换班'
    const sourceTechId = source.technicianId
    const sourceTechName = source.technicianName
    source.technicianId = target.technicianId
    source.technicianName = target.technicianName
    target.technicianId = sourceTechId
    target.technicianName = sourceTechName
    source.status = 'SWAPPED'
    target.status = 'SWAPPED'
    source.swapReason = reason
    target.swapReason = reason
    source.updatedAt = new Date().toISOString()
    target.updatedAt = new Date().toISOString()
    return { source: { ...source }, target: { ...target } }
  }

  // ================= 请假 =================

  leave(id: string, dto: { reason?: string }): TechSchedule {
    const hit = this.findOrThrow(id)
    if (hit.status === 'ON_LEAVE') throw new BadRequestException('该班次已在请假状态')
    hit.status = 'ON_LEAVE'
    hit.leaveReason = dto.reason || '请假'
    hit.updatedAt = new Date().toISOString()
    return { ...hit }
  }

  // ================= 月历 =================

  getCalendar(params: { month?: string; year?: string }): TechCalendar {
    const now = new Date()
    const year = params.year ? Number(params.year) : now.getFullYear()
    const month = params.month ?? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const m = /^(\d{4})-(\d{2})$/.exec(month)
    if (!m) throw new BadRequestException('month 格式应为 YYYY-MM')
    const calYear = Number(m[1])
    const monthNum = Number(m[2])
    if (calYear !== year) throw new BadRequestException('year 与 month 不一致')
    if (monthNum < 1 || monthNum > 12) throw new BadRequestException('month 应为 01-12')
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    const today = new Date().toISOString().slice(0, 10)
    const days: TechCalendarDay[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${m[1]}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      days.push({
        date,
        weekday: WEEKDAYS[new Date(year, monthNum - 1, d).getDay()] ?? '',
        isToday: date === today,
        schedules: this.schedules.filter((s) => s.date === date),
      })
    }
    return { month: `${m[1]}-${m[2]}`, year, days, technicians: this.getTechnicians() }
  }

  // ================= 统计 =================

  getStats(params: { month?: string; year?: string }): TechStats {
    const now = new Date()
    const year = params.year ? Number(params.year) : now.getFullYear()
    const month = params.month ?? `${year}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const m = /^(\d{4})-(\d{2})$/.exec(month)
    if (!m) throw new BadRequestException('month 格式应为 YYYY-MM')
    const monthNum = Number(m[2])
    if (monthNum < 1 || monthNum > 12) throw new BadRequestException('month 应为 01-12')
    const items = this.schedules.filter((s) => s.date.startsWith(month))
    const byTechnician = TECH_ROSTER.map((t) => {
      const list = items.filter((s) => s.technicianId === t.id)
      return {
        technicianId: t.id,
        technicianName: t.name,
        count: list.length,
        nights: list.filter((s) => s.shift === 'NIGHT').length,
        leaves: list.filter((s) => s.status === 'ON_LEAVE').length,
      }
    }).filter((x) => x.count > 0)
    const byShift: TechStats['byShift'] = (['DAY', 'NIGHT', 'WEEKEND', 'BACKUP'] as TechShift[]).map((shift) => ({
      shift,
      label: SHIFT_LABELS[shift],
      count: items.filter((s) => s.shift === shift).length,
    }))
    return {
      month: `${m[1]}-${m[2]}`,
      totalShifts: items.length,
      technicianCount: new Set(items.map((s) => s.technicianId)).size,
      leaveCount: items.filter((s) => s.status === 'ON_LEAVE').length,
      nightShiftCount: items.filter((s) => s.shift === 'NIGHT').length,
      weekendShiftCount: items.filter((s) => s.shift === 'WEEKEND').length,
      backupShiftCount: items.filter((s) => s.shift === 'BACKUP').length,
      confirmedCount: items.filter((s) => s.status === 'CONFIRMED').length,
      swappedCount: items.filter((s) => s.status === 'SWAPPED').length,
      byTechnician,
      byShift,
    }
  }

  // ================= 批量生成 =================

  batchCreate(dto: { startDate: string; endDate: string; shiftPattern: TechShift[] }): TechSchedule[] {
    const { startDate, endDate, shiftPattern } = dto
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate || '')) throw new BadRequestException('startDate 格式应为 YYYY-MM-DD')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(endDate || '')) throw new BadRequestException('endDate 格式应为 YYYY-MM-DD')
    if (!Array.isArray(shiftPattern) || shiftPattern.length === 0) throw new BadRequestException('shiftPattern 至少一个班次')
    if (!shiftPattern.every((s) => SHIFT_LABELS[s])) throw new BadRequestException('shiftPattern 含非法班次')
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    if (start.getTime() > end.getTime()) throw new BadRequestException('startDate 不能晚于 endDate')
    const created: TechSchedule[] = []
    const now = new Date().toISOString()
    let dateCursor = new Date(start)
    let idx = 0
    while (dateCursor.getTime() <= end.getTime()) {
      const date = dateCursor.toISOString().slice(0, 10)
      shiftPattern.forEach((shift, p) => {
        const tech = TECH_ROSTER[(idx + p * 2) % TECH_ROSTER.length]!
        const conflict = this.schedules.some((s) => s.date === date && s.technicianId === tech.id)
        if (conflict) return
        const room = ROOMS[(idx + p) % ROOMS.length]!
        const item: TechSchedule = {
          id: `TS-${Date.now()}-${idx}-${p}`,
          date,
          shift,
          technicianId: tech.id,
          technicianName: tech.name,
          roomId: room.id,
          roomName: room.name,
          status: 'SCHEDULED',
          notes: null,
          swapReason: null,
          leaveReason: null,
          createdAt: now,
          updatedAt: now,
        }
        this.schedules.push(item)
        created.push(item)
      })
      dateCursor.setDate(dateCursor.getDate() + 1)
      idx++
    }
    return created
  }

  private findOrThrow(id: string): TechSchedule {
    const hit = this.schedules.find((s) => s.id === id)
    if (!hit) throw new NotFoundException(`排班 ${id} 不存在`)
    return hit
  }
}
