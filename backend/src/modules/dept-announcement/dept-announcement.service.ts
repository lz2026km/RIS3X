/**
 * G005 放射RIS系统 v3.0.6.11-92 Wave3A (P2) - 科室公告/值班管理服务
 * 内存 + 种子数据:
 *   - 公告:   GET/POST /dept-announcements, PATCH/DELETE /:id, GET /active
 *   - 值班:   GET/POST /on-call-schedules, PUT/DELETE /:id, GET /calendar (月历视图)
 */
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'

export type AnnouncementCategory = 'notice' | 'meeting' | 'policy' | 'urgent' | 'other'

export interface DeptAnnouncement {
  id: string
  title: string
  content: string
  category: AnnouncementCategory
  pinned: boolean
  expiresAt: string
  author: string
  createdAt: string
  updatedAt: string
}

export type OnCallShiftType = 'DAY' | 'NIGHT' | 'WEEKEND'

export interface OnCallSchedule {
  id: string
  date: string
  doctorId: string
  doctorName: string
  shift: OnCallShiftType
  role: string
  createdAt: string
  updatedAt: string
}

export interface OnCallCalendarDay {
  date: string
  weekday: string
  isToday: boolean
  schedules: OnCallSchedule[]
}

export interface OnCallCalendar {
  month: string
  days: OnCallCalendarDay[]
}

export interface AnnouncementDto {
  title: string
  content: string
  category?: AnnouncementCategory
  pinned?: boolean
  expiresAt?: string
  author?: string
}

export interface OnCallScheduleDto {
  date: string
  doctorId: string
  doctorName: string
  shift: OnCallShiftType
  role?: string
}

const SHIFT_LABELS: Record<OnCallShiftType, string> = {
  DAY: '白班',
  NIGHT: '夜班',
  WEEKEND: '周末班',
}

const dayStr = (offsetDay: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDay)
  return d.toISOString().slice(0, 10)
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const iso = (offsetMin: number) => new Date(Date.now() - offsetMin * 60_000).toISOString()

const exp = (offsetDay: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDay)
  return d.toISOString().slice(0, 10)
}

const SEED_ANNOUNCEMENTS: DeptAnnouncement[] = [
  {
    id: 'DA-001',
    title: '本周五业务学习: 主动脉夹层影像诊断',
    content: '周五 15:00 在示教室举行, 请全体医师参加, 会后考核登记学分。',
    category: 'meeting',
    pinned: true,
    expiresAt: exp(7),
    author: '张伟明',
    createdAt: iso(24 * 60),
    updatedAt: iso(24 * 60),
  },
  {
    id: 'DA-002',
    title: '危急值报告流程更新(2026-08 版)',
    content: '接医务处通知: 危急值确认电话后须在 30 分钟内补充站内留言, 闭环记录留档。',
    category: 'policy',
    pinned: false,
    expiresAt: exp(30),
    author: '王建国',
    createdAt: iso(48 * 60),
    updatedAt: iso(48 * 60),
  },
  {
    id: 'DA-003',
    title: 'CT 设备停机维护通知',
    content: '周六 02:00-06:00 CT-1 例行维护, 期间急诊检查走 CT-2。',
    category: 'urgent',
    pinned: false,
    expiresAt: exp(3),
    author: '陈海涛',
    createdAt: iso(6 * 60),
    updatedAt: iso(6 * 60),
  },
  {
    id: 'DA-004',
    title: '新进住院医师轮转安排',
    content: '本月新进住院医师 3 人, 轮转计划见科室公告栏附件。',
    category: 'notice',
    pinned: false,
    expiresAt: exp(60),
    author: '刘芳',
    createdAt: iso(72 * 60),
    updatedAt: iso(72 * 60),
  },
]

const SEED_SCHEDULES: OnCallSchedule[] = [
  { id: 'OC-001', date: dayStr(0), doctorId: 'D-LI', doctorName: '李天宇', shift: 'DAY', role: '首诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-002', date: dayStr(0), doctorId: 'D-LIN', doctorName: '林华', shift: 'NIGHT', role: '首诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-003', date: dayStr(0), doctorId: 'D-WANG', doctorName: '王琴', shift: 'WEEKEND', role: '主诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-004', date: dayStr(1), doctorId: 'D-ZHOU', doctorName: '周怡', shift: 'DAY', role: '主诊医师', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-005', date: dayStr(1), doctorId: 'D-CHEN', doctorName: '陈伟', shift: 'NIGHT', role: '二线值班', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
  { id: 'OC-006', date: dayStr(2), doctorId: 'D-ZHANG', doctorName: '张明', shift: 'WEEKEND', role: '科主任', createdAt: iso(24 * 60), updatedAt: iso(24 * 60) },
]

@Injectable()
export class DeptAnnouncementService {
  private announcements: DeptAnnouncement[] = SEED_ANNOUNCEMENTS.map((a) => ({ ...a }))
  private schedules: OnCallSchedule[] = SEED_SCHEDULES.map((s) => ({ ...s }))

  // ================= 公告 =================

  listAnnouncements(): DeptAnnouncement[] {
    return [...this.announcements].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
      return b.createdAt.localeCompare(a.createdAt)
    })
  }

  listActiveAnnouncements(): DeptAnnouncement[] {
    const today = new Date().toISOString().slice(0, 10)
    return this.listAnnouncements().filter((a) => !a.expiresAt || a.expiresAt >= today)
  }

  createAnnouncement(dto: AnnouncementDto): DeptAnnouncement {
    const title = String(dto.title ?? '').trim()
    const content = String(dto.content ?? '').trim()
    if (!title) throw new BadRequestException('title 必填')
    if (content.length < 5) throw new BadRequestException('content 至少 5 个字符')
    const now = new Date().toISOString()
    const item: DeptAnnouncement = {
      id: `DA-${Date.now()}`,
      title,
      content,
      category: dto.category ?? 'notice',
      pinned: Boolean(dto.pinned),
      expiresAt: dto.expiresAt || exp(30),
      author: dto.author || '当前用户',
      createdAt: now,
      updatedAt: now,
    }
    this.announcements.unshift(item)
    return { ...item }
  }

  updateAnnouncement(id: string, dto: Partial<AnnouncementDto>): DeptAnnouncement {
    const hit = this.announcements.find((a) => a.id === id)
    if (!hit) throw new NotFoundException(`Announcement ${id} not found`)
    if (dto.title !== undefined && !String(dto.title).trim()) throw new BadRequestException('title 必填')
    if (dto.content !== undefined && String(dto.content).trim().length < 5) {
      throw new BadRequestException('content 至少 5 个字符')
    }
    if (dto.title !== undefined) hit.title = String(dto.title).trim()
    if (dto.content !== undefined) hit.content = String(dto.content).trim()
    if (dto.category !== undefined) hit.category = dto.category
    if (dto.pinned !== undefined) hit.pinned = Boolean(dto.pinned)
    if (dto.expiresAt !== undefined) hit.expiresAt = dto.expiresAt
    if (dto.author !== undefined) hit.author = dto.author
    hit.updatedAt = new Date().toISOString()
    return { ...hit }
  }

  deleteAnnouncement(id: string): void {
    const idx = this.announcements.findIndex((a) => a.id === id)
    if (idx < 0) throw new NotFoundException(`Announcement ${id} not found`)
    this.announcements.splice(idx, 1)
  }

  // ================= 值班 =================

  listSchedules(month?: string): OnCallSchedule[] {
    let items = this.schedules
    if (month) items = items.filter((s) => s.date.startsWith(month))
    return [...items].sort((a, b) => a.date.localeCompare(b.date))
  }

  createSchedule(dto: OnCallScheduleDto): OnCallSchedule {
    const date = String(dto.date ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new BadRequestException('date 格式应为 YYYY-MM-DD')
    if (!dto.doctorId || !String(dto.doctorId).trim()) throw new BadRequestException('doctorId 必填')
    if (!dto.doctorName || !String(dto.doctorName).trim()) throw new BadRequestException('doctorName 必填')
    if (!['DAY', 'NIGHT', 'WEEKEND'].includes(dto.shift)) throw new BadRequestException('shift 应为 DAY/NIGHT/WEEKEND')
    const now = new Date().toISOString()
    const item: OnCallSchedule = {
      id: `OC-${Date.now()}`,
      date,
      doctorId: dto.doctorId,
      doctorName: dto.doctorName,
      shift: dto.shift,
      role: dto.role || SHIFT_LABELS[dto.shift],
      createdAt: now,
      updatedAt: now,
    }
    this.schedules.unshift(item)
    return { ...item }
  }

  updateSchedule(id: string, dto: Partial<OnCallScheduleDto>): OnCallSchedule {
    const hit = this.schedules.find((s) => s.id === id)
    if (!hit) throw new NotFoundException(`OnCall schedule ${id} not found`)
    if (dto.date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dto.date))) throw new BadRequestException('date 格式错误')
      hit.date = dto.date
    }
    if (dto.doctorId !== undefined) {
      if (!String(dto.doctorId).trim()) throw new BadRequestException('doctorId 必填')
      hit.doctorId = dto.doctorId
    }
    if (dto.doctorName !== undefined) {
      if (!String(dto.doctorName).trim()) throw new BadRequestException('doctorName 必填')
      hit.doctorName = dto.doctorName
    }
    if (dto.shift !== undefined) {
      if (!['DAY', 'NIGHT', 'WEEKEND'].includes(dto.shift)) throw new BadRequestException('shift 非法')
      hit.shift = dto.shift
    }
    if (dto.role !== undefined) hit.role = dto.role
    hit.updatedAt = new Date().toISOString()
    return { ...hit }
  }

  deleteSchedule(id: string): void {
    const idx = this.schedules.findIndex((s) => s.id === id)
    if (idx < 0) throw new NotFoundException(`OnCall schedule ${id} not found`)
    this.schedules.splice(idx, 1)
  }

  getCalendar(month: string): OnCallCalendar {
    const m = /^(\d{4})-(\d{2})$/.exec(month)
    if (!m) throw new BadRequestException('month 格式应为 YYYY-MM')
    const year = Number(m[1])
    const monthNum = Number(m[2])
    if (monthNum < 1 || monthNum > 12) throw new BadRequestException('month 应为 01-12')
    const daysInMonth = new Date(year, monthNum, 0).getDate()
    const today = new Date().toISOString().slice(0, 10)
    const days: OnCallCalendarDay[] = []
    for (let d = 1; d <= daysInMonth; d++) {
      const date = `${m[1]}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const weekday = WEEKDAYS[new Date(year, monthNum - 1, d).getDay()] ?? ''
      days.push({
        date,
        weekday,
        isToday: date === today,
        schedules: this.schedules.filter((s) => s.date === date),
      })
    }
    return { month, days }
  }
}
