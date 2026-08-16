/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 5 (tech-overview) - 技师工作站 V2 收尾:
 * 患者预约分布 + 技师值班大屏
 *
 * 孤儿模块 (无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动):
 *   1. 患者预约分布: 预约记录派生 → 按 检查类型/时段/星期/设备 分桶 (确定性)
 *      + 预约波峰分析 (高峰时段识别) + 预约 vs 实到对比 (爽约率)
 *   2. 技师值班大屏: 今日值班概览 (在岗技师/房间状态/进行中检查/待处理紧急)
 *      + 房间实时状态流
 * 所有伪随机均为确定性 (FNV-1a 哈希派生, 同 seedInput 恒同输出), 便于测试复现。
 */
import { BadRequestException, Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ================= 类型定义 =================

export type RoomState = 'IN_USE' | 'IDLE' | 'MAINTENANCE' | 'OFFLINE'

export interface OverviewRoom {
  id: string
  name: string
  modality: string
  technician: string
}

export interface OverviewTechnician {
  id: string
  name: string
  group: string
}

export interface DistributionBucket {
  key: string
  label: string
  count: number
  pct: number
}

export interface DeviceBucket extends DistributionBucket {
  modality: string
}

export interface HeatmapCell {
  period: string
  weekday: string
  count: number
}

export interface AppointmentDistribution {
  startDate: string
  days: number
  total: number
  seeded: boolean
  byModality: DistributionBucket[]
  byPeriod: DistributionBucket[]
  byWeekday: DistributionBucket[]
  byDevice: DeviceBucket[]
  heatmap: HeatmapCell[]
}

export interface PeakDay {
  date: string
  weekday: string
  count: number
}

export interface AppointmentPeak {
  period: string
  hourRange: string
  avgCount: number
  maxCount: number
  maxDay: string
  level: 'HIGH' | 'MEDIUM' | 'LOW'
  peakDays: PeakDay[]
}

export interface PeakAnalysis {
  startDate: string
  days: number
  seeded: boolean
  overallAverage: number
  peaks: AppointmentPeak[]
  busiestPeriod: string
  busiestWeekday: string
  recommendation: string
}

export interface AttendanceItem {
  key: string
  label: string
  total: number
  attended: number
  noShow: number
  cancelled: number
  upcoming: number
  noShowRate: number
}

export interface AppointmentAttendance {
  startDate: string
  days: number
  seeded: boolean
  total: number
  attended: number
  noShow: number
  cancelled: number
  upcoming: number
  noShowRate: number
  attendanceRate: number
  byModality: AttendanceItem[]
  byWeekday: AttendanceItem[]
}

export interface DutyItem {
  technicianId: string
  name: string
  group: string
  shift: string
  shiftLabel: string
}

export interface RoomExam {
  patientName: string
  examItem: string
  startedAt: string
  progressPct: number
}

export interface RoomStatus {
  roomId: string
  roomName: string
  modality: string
  technician: string
  state: RoomState
  currentExam: RoomExam | null
  queueCount: number
  todayExams: number
}

export interface DashboardOverview {
  date: string
  generatedAt: string
  seeded: boolean
  onDutyCount: number
  offDutyCount: number
  technicianTotal: number
  roomCount: number
  inUseRooms: number
  idleRooms: number
  inProgressCount: number
  waitingCount: number
  pendingEmergencyCount: number
  duty: DutyItem[]
  rooms: RoomStatus[]
}

export type RoomEventType =
  | 'EXAM_START'
  | 'EXAM_END'
  | 'PATIENT_IN'
  | 'PATIENT_OUT'
  | 'EMERGENCY'
  | 'STATE_CHANGE'
  | 'MAINTENANCE'

export interface RoomStatusEvent {
  id: string
  roomId: string
  roomName: string
  modality: string
  type: RoomEventType
  patientName: string | null
  examItem: string | null
  technician: string
  timestamp: string
  note: string
}

export interface RoomStatusStream {
  generatedAt: string
  seeded: boolean
  rooms: RoomStatus[]
  events: RoomStatusEvent[]
}

/** 内部预约记录 (DB 派生或种子) */
interface ApptRecord {
  id: string
  patientName: string
  modality: string
  deviceId: string
  date: string
  hour: number
  state: string
}

// ================= 常量与种子 =================

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const TECH_ROSTER: OverviewTechnician[] = [
  { id: 'T-001', name: '刘洋', group: 'CT 组' },
  { id: 'T-002', name: '赵志刚', group: 'CT 组' },
  { id: 'T-003', name: '孙伟', group: 'MR 组' },
  { id: 'T-004', name: '王磊', group: 'DR 组' },
  { id: 'T-005', name: '陈静', group: 'DSA 组' },
  { id: 'T-006', name: '周婷', group: 'MG 组' },
  { id: 'T-007', name: '吴强', group: 'CT 组' },
  { id: 'T-008', name: '郑爽', group: 'MR 组' },
]

const ROOMS: OverviewRoom[] = [
  { id: 'R-CT1', name: 'CT-1 检查室', modality: 'CT', technician: '刘洋' },
  { id: 'R-CT2', name: 'CT-2 检查室', modality: 'CT', technician: '赵志刚' },
  { id: 'R-MR1', name: 'MR-1 检查室', modality: 'MR', technician: '孙伟' },
  { id: 'R-DR1', name: 'DR-1 检查室', modality: 'DR', technician: '王磊' },
  { id: 'R-DSA1', name: 'DSA-1 检查室', modality: 'DSA', technician: '陈静' },
  { id: 'R-MG1', name: 'MG-1 检查室', modality: 'MG', technician: '周婷' },
]

const MODALITIES = ['CT', 'MR', 'DR', 'DSA', 'MG']

const PATIENT_POOL = ['张伟', '王芳', '李明', '刘洋', '赵敏', '陈杰', '孙丽', '周强', '吴敏', '郑华', '钱进', '冯雪', '朱明', '许峰', '何静', '吕娜', '马建军', '杜文娟', '蒋鹏飞', '沈艳']

const EXAM_POOL: Record<string, string[]> = {
  CT: ['胸部CT平扫', '头颅CT平扫', '腹部CT增强', '腰椎CT平扫', '冠脉CTA'],
  MR: ['腰椎MR平扫', '头颅MR平扫', '膝关节MR平扫', '腹部MR增强', '颈椎MR平扫'],
  DR: ['胸部DR正位', '腰椎正侧位', '膝关节DR正位', '踝关节DR', '腹部立位平片'],
  DSA: ['冠脉造影', '脑血管造影', '下肢动脉造影', '肝动脉介入'],
  MG: ['乳腺钼靶', '乳腺钼靶增强', '乳腺断层合成'],
}

/** 8 时段 (与 tech-v2 对齐), 覆盖全天 24h */
const PERIODS: Array<{ period: string; hours: number[] }> = [
  { period: '00-03', hours: [0, 1, 2] },
  { period: '03-06', hours: [3, 4, 5] },
  { period: '06-09', hours: [6, 7, 8] },
  { period: '09-12', hours: [9, 10, 11] },
  { period: '12-15', hours: [12, 13, 14] },
  { period: '15-18', hours: [15, 16, 17] },
  { period: '18-21', hours: [18, 19, 20] },
  { period: '21-24', hours: [21, 22, 23] },
]

/** 预约到达小时曲线: 上午 9-12 高峰, 午后回落, 夜间低谷 */
const HOUR_WEIGHTS = [0, 0, 0, 0, 0, 0, 1, 2, 6, 14, 20, 22, 18, 15, 13, 12, 10, 8, 6, 4, 3, 2, 1, 0]

/** 周季节性 (周日→周六): 周三/周四最高, 周末偏低 */
const WEEKDAY_FACTOR = [0.72, 0.95, 1.05, 1.12, 1.15, 1.18, 0.8]

const SHIFT_LABELS: Record<string, string> = {
  DAY: '白班',
  NIGHT: '夜班',
  WEEKEND: '周末班',
  BACKUP: '备班',
  OFF: '休班',
}

/** 8 人值班班次模板 (确定性轮转) */
const SHIFT_PATTERN = ['DAY', 'DAY', 'DAY', 'DAY', 'NIGHT', 'NIGHT', 'BACKUP', 'OFF']

// ================= 确定性工具 (FNV-1a, 无 Math.random) =================

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function seededRand(min: number, max: number, seedInput: string): number {
  let a = hashString(seedInput) >>> 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return r * (max - min) + min
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function todayStr(): string {
  return dateStr(new Date())
}

function addDays(date: string, offset: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay()
}

function isWeekend(date: string): boolean {
  const wd = weekdayOf(date)
  return wd === 0 || wd === 6
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function pctOf(count: number, total: number): number {
  return total > 0 ? round1((count / total) * 100) : 0
}

function periodIndexOf(hour: number): number {
  for (let i = 0; i < PERIODS.length; i++) {
    if ((PERIODS[i]!.hours as number[]).includes(hour)) return i
  }
  return 3
}

// ================= 服务 =================

@Injectable()
export class TechOverviewService {
  constructor(private readonly prisma: PrismaService) {}

  // ================= 基础元数据 =================

  getRooms(): OverviewRoom[] {
    return ROOMS.map((r) => ({ ...r }))
  }

  getTechnicians(): OverviewTechnician[] {
    return TECH_ROSTER.map((t) => ({ ...t }))
  }

  getMeta(): { rooms: OverviewRoom[]; technicians: OverviewTechnician[]; modalities: string[]; date: string; periods: Array<{ period: string; hourRange: string }> } {
    return {
      rooms: this.getRooms(),
      technicians: this.getTechnicians(),
      modalities: [...MODALITIES],
      date: todayStr(),
      periods: PERIODS.map((p) => ({ period: p.period, hourRange: `${p.hours[0]}-${p.hours[p.hours.length - 1]! + 1}` })),
    }
  }

  // ================= 预约记录解析 (DB 派生 → seed 回退) =================

  /** DB 可用: 从 appointment 表派生真实预约记录; 失败/空库 → null */
  private async fetchDbAppointments(startDate: Date): Promise<ApptRecord[] | null> {
    try {
      const rows: any = await this.prisma.appointment.findMany({
        where: { scheduledAt: { gte: startDate } } as any,
        select: { scheduledAt: true, modality: true, deviceId: true, state: true, patientName: true } as any,
        take: 100000,
      })
      if (!Array.isArray(rows) || rows.length === 0) return null
      return (rows as Array<{ scheduledAt: Date; modality: string; deviceId: string | null; state: string; patientName: string }>).map((r, i) => {
        const d = new Date(r.scheduledAt)
        const date = dateStr(d)
        return {
          id: `DB-APP-${i}`,
          patientName: String(r.patientName ?? '').trim() || PATIENT_POOL[i % PATIENT_POOL.length] as string,
          modality: r.modality || 'CT',
          deviceId: r.deviceId ?? 'UNKNOWN',
          date,
          hour: d.getHours(),
          state: r.state ?? 'SCHEDULED',
        }
      })
    } catch {
      return null
    }
  }

  /** 确定性种子: 每房间每日 8-14 条预约, 小时曲线加权, 状态含爽约/取消 */
  private seedAppointments(startDate: string, days: number): ApptRecord[] {
    const out: ApptRecord[] = []
    const today = todayStr()
    for (let d = 0; d < days; d++) {
      const date = addDays(startDate, d)
      const isToday = date === today
      const weekend = isWeekend(date)
      const dayFactor = WEEKDAY_FACTOR[weekdayOf(date)] ?? 1
      for (const room of ROOMS) {
        const count = Math.max(5, Math.round((8 + (hashString(`appt-count:${date}:${room.id}`) % 7)) * dayFactor))
        for (let i = 0; i < count; i++) {
          const seed = `appt:${date}:${room.id}:${i}`
          const wSum = HOUR_WEIGHTS.reduce((a, b) => a + b, 0)
          let r = hashString(seed) % wSum
          let hour = 8
          for (let h = 0; h < 24; h++) {
            const w = HOUR_WEIGHTS[h] ?? 0
            if (r < w) {
              hour = h
              break
            }
            r -= w
          }
          // 周末: 上午半天, 午后预约并入上午 (保持确定性)
          if (weekend && hour >= 12) hour = 7 + (hashString(`${seed}:wk`) % 5)
          const patientName = PATIENT_POOL[hashString(`${seed}:pt`) % PATIENT_POOL.length] as string
          const state = this.stateFor(date, `${seed}:state`, isToday)
          out.push({
            id: `APP-${date}-${room.id}-${i}`,
            patientName,
            modality: room.modality,
            deviceId: room.id,
            date,
            hour,
            state,
          })
        }
      }
    }
    return out
  }

  private stateFor(date: string, seed: string, isToday: boolean): string {
    const h = hashString(seed) % 100
    if (isToday) {
      if (h < 12) return 'SCHEDULED'
      if (h < 30) return 'CONFIRMED'
      if (h < 52) return 'CHECKED_IN'
      if (h < 78) return 'IN_PROGRESS'
      return 'COMPLETED'
    }
    if (h < 11) return 'NO_SHOW'
    if (h < 17) return 'CANCELLED'
    return 'COMPLETED'
  }

  /** 解析窗口内预约记录; DB 可用且非空 → 真实派生 (seeded=false), 否则确定性种子 */
  private async resolveAppointments(startDate: string, days: number): Promise<{ records: ApptRecord[]; seeded: boolean }> {
    const endDate = addDays(startDate, days)
    const db = await this.fetchDbAppointments(new Date(`${startDate}T00:00:00`))
    if (db && db.length > 0) {
      const inRange = db.filter((r) => r.date >= startDate && r.date < endDate)
      if (inRange.length > 0) return { records: inRange, seeded: false }
    }
    return { records: this.seedAppointments(startDate, days), seeded: true }
  }

  private parseRange(startDate?: string, days?: string | number): { startDate: string; days: number } {
    const start = /^\d{4}-\d{2}-\d{2}$/.test(startDate ?? '') ? (startDate as string) : todayStr()
    let n = typeof days === 'number' ? days : days !== undefined && days !== '' ? Number(days) : 30
    if (!Number.isFinite(n)) n = 30
    if (n < 1 || n > 90) throw new BadRequestException('days 应为 1-90')
    return { startDate: start, days: Math.round(n) }
  }

  // ================= 1. 患者预约分布 =================

  /** 按 检查类型/时段/星期/设备 分桶 (确定性, 分桶总和 = 总数) */
  async getAppointmentDistribution(params: { startDate?: string; days?: string | number } = {}): Promise<AppointmentDistribution> {
    const { startDate, days } = this.parseRange(params.startDate, params.days)
    const { records, seeded } = await this.resolveAppointments(startDate, days)
    const total = records.length

    const byModality = new Map<string, number>()
    const byPeriod = new Map<string, number>()
    const byWeekday = new Map<number, number>()
    const byDevice = new Map<string, number>()
    const heatmap = new Map<string, number>()
    for (const rec of records) {
      byModality.set(rec.modality, (byModality.get(rec.modality) ?? 0) + 1)
      const period = PERIODS[periodIndexOf(rec.hour)]!.period
      byPeriod.set(period, (byPeriod.get(period) ?? 0) + 1)
      const wd = weekdayOf(rec.date)
      byWeekday.set(wd, (byWeekday.get(wd) ?? 0) + 1)
      byDevice.set(rec.deviceId, (byDevice.get(rec.deviceId) ?? 0) + 1)
      const cell = `${period}|${wd}`
      heatmap.set(cell, (heatmap.get(cell) ?? 0) + 1)
    }

    const modalityBuckets: DistributionBucket[] = [...byModality.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({ key, label: key, count, pct: pctOf(count, total) }))
    const periodBuckets: DistributionBucket[] = PERIODS.map((p) => ({
      key: p.period,
      label: p.period,
      count: byPeriod.get(p.period) ?? 0,
      pct: pctOf(byPeriod.get(p.period) ?? 0, total),
    }))
    const weekdayBuckets: DistributionBucket[] = WEEKDAYS.map((label, wd) => ({
      key: String(wd),
      label,
      count: byWeekday.get(wd) ?? 0,
      pct: pctOf(byWeekday.get(wd) ?? 0, total),
    }))
    const deviceBuckets: DeviceBucket[] = [...byDevice.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([key, count]) => ({
        key,
        label: key === 'UNKNOWN' ? '未分配设备' : ROOMS.find((r) => r.id === key)?.name ?? key,
        modality: ROOMS.find((r) => r.id === key)?.modality ?? 'UNKNOWN',
        count,
        pct: pctOf(count, total),
      }))
    const heatmapCells: HeatmapCell[] = []
    PERIODS.forEach((p, pi) => {
      WEEKDAYS.forEach((label, wd) => {
        const count = heatmap.get(`${p.period}|${wd}`) ?? 0
        if (count > 0 || pi === 0) {
          heatmapCells.push({ period: p.period, weekday: label, count })
        }
      })
    })

    return {
      startDate,
      days,
      total,
      seeded,
      byModality: modalityBuckets,
      byPeriod: periodBuckets,
      byWeekday: weekdayBuckets,
      byDevice: deviceBuckets,
      heatmap: heatmapCells,
    }
  }

  // ================= 2. 预约波峰分析 =================

  /** 高峰时段识别: 每时段日均 vs 全局日均 → HIGH/MEDIUM/LOW + 峰值日 + 建议 */
  async getAppointmentPeaks(params: { startDate?: string; days?: string | number } = {}): Promise<PeakAnalysis> {
    const { startDate, days } = this.parseRange(params.startDate, params.days)
    const { records, seeded } = await this.resolveAppointments(startDate, days)
    const total = records.length

    const perPeriodDay = new Map<string, Map<string, number>>()
    const perWeekday = new Map<number, number>()
    for (const rec of records) {
      const period = PERIODS[periodIndexOf(rec.hour)]!.period
      const inner = perPeriodDay.get(period) ?? new Map<string, number>()
      inner.set(rec.date, (inner.get(rec.date) ?? 0) + 1)
      perPeriodDay.set(period, inner)
      perWeekday.set(weekdayOf(rec.date), (perWeekday.get(weekdayOf(rec.date)) ?? 0) + 1)
    }

    const overallAverage = days > 0 ? total / days / PERIODS.length : 0
    const peaks: AppointmentPeak[] = PERIODS.map((p) => {
      const inner = perPeriodDay.get(p.period) ?? new Map<string, number>()
      const values = [...inner.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      const sum = values.reduce((a, [, c]) => a + c, 0)
      const avg = days > 0 ? sum / days : 0
      const maxCount = values[0]?.[1] ?? 0
      const level: AppointmentPeak['level'] = avg >= overallAverage * 1.25 ? 'HIGH' : avg >= overallAverage * 0.75 ? 'MEDIUM' : 'LOW'
      return {
        period: p.period,
        hourRange: `${p.hours[0]}-${p.hours[p.hours.length - 1]! + 1}`,
        avgCount: round1(avg),
        maxCount,
        maxDay: values[0]?.[0] ?? '',
        level,
        peakDays: values.slice(0, 3).map(([date, count]) => ({ date, weekday: WEEKDAYS[weekdayOf(date)] ?? '', count })),
      }
    }).sort((a, b) => b.avgCount - a.avgCount)

    const busiestPeriod = peaks[0]?.period ?? '09-12'
    let busiestWeekday = '周一'
    let maxWd = -1
    perWeekday.forEach((count, wd) => {
      if (count > maxWd) {
        maxWd = count
        busiestWeekday = WEEKDAYS[wd] ?? '周一'
      }
    })
    const highCount = peaks.filter((p) => p.level === 'HIGH').length
    const recommendation =
      highCount > 0
        ? `高峰时段集中在 ${peaks.filter((p) => p.level === 'HIGH').map((p) => p.period).join('、')} (日均 ${peaks.filter((p) => p.level === 'HIGH').map((p) => p.avgCount).join('/')} 例), 建议增派技师并预留缓冲时间; ${busiestWeekday} 为周内峰值日, 可提前调配设备`
        : `预约分布整体均衡, ${busiestPeriod} 相对偏多, 可维持现有排班节奏`

    return {
      startDate,
      days,
      seeded,
      overallAverage: round1(overallAverage),
      peaks,
      busiestPeriod,
      busiestWeekday,
      recommendation,
    }
  }

  // ================= 3. 预约 vs 实到 (爽约率) =================

  /** 爽约率 = NO_SHOW / (实到 + 爽约); 实到 = COMPLETED|CHECKED_IN|IN_PROGRESS */
  async getAppointmentAttendance(params: { startDate?: string; days?: string | number } = {}): Promise<AppointmentAttendance> {
    const { startDate, days } = this.parseRange(params.startDate, params.days)
    const { records, seeded } = await this.resolveAppointments(startDate, days)

    const classify = (state: string): 'attended' | 'noShow' | 'cancelled' | 'upcoming' => {
      if (state === 'NO_SHOW') return 'noShow'
      if (state === 'CANCELLED') return 'cancelled'
      if (state === 'COMPLETED' || state === 'CHECKED_IN' || state === 'IN_PROGRESS') return 'attended'
      return 'upcoming'
    }
    const rate = (attended: number, noShow: number): number => {
      const base = attended + noShow
      return base > 0 ? round1((noShow / base) * 100) : 0
    }

    const byModality = new Map<string, AttendanceItem>()
    const byWeekday = new Map<number, AttendanceItem>()
    let attended = 0
    let noShow = 0
    let cancelled = 0
    let upcoming = 0

    for (const rec of records) {
      const cls = classify(rec.state)
      if (cls === 'attended') attended++
      else if (cls === 'noShow') noShow++
      else if (cls === 'cancelled') cancelled++
      else upcoming++
      const mod = byModality.get(rec.modality) ?? { key: rec.modality, label: rec.modality, total: 0, attended: 0, noShow: 0, cancelled: 0, upcoming: 0, noShowRate: 0 }
      const wd = byWeekday.get(weekdayOf(rec.date)) ?? { key: String(weekdayOf(rec.date)), label: WEEKDAYS[weekdayOf(rec.date)] ?? '', total: 0, attended: 0, noShow: 0, cancelled: 0, upcoming: 0, noShowRate: 0 }
      mod.total++
      wd.total++
      if (cls === 'attended') { mod.attended++; wd.attended++ }
      else if (cls === 'noShow') { mod.noShow++; wd.noShow++ }
      else if (cls === 'cancelled') { mod.cancelled++; wd.cancelled++ }
      else { mod.upcoming++; wd.upcoming++ }
      byModality.set(rec.modality, mod)
      byWeekday.set(weekdayOf(rec.date), wd)
    }

    const total = records.length
    const modalityItems: AttendanceItem[] = [...byModality.values()]
      .sort((a, b) => b.total - a.total)
      .map((m) => ({ ...m, noShowRate: rate(m.attended, m.noShow) }))
    const weekdayItems: AttendanceItem[] = WEEKDAYS.map((label, wd) => {
      const item = byWeekday.get(wd)
      return item ? { ...item, label, noShowRate: rate(item.attended, item.noShow) } : { key: String(wd), label, total: 0, attended: 0, noShow: 0, cancelled: 0, upcoming: 0, noShowRate: 0 }
    })

    return {
      startDate,
      days,
      seeded,
      total,
      attended,
      noShow,
      cancelled,
      upcoming,
      noShowRate: rate(attended, noShow),
      attendanceRate: total > 0 ? round1((attended / total) * 100) : 0,
      byModality: modalityItems,
      byWeekday: weekdayItems,
    }
  }

  // ================= 4. 值班大屏: 今日概览 =================

  /** 今日值班 (确定性轮转: 班次模板按日期哈希平移) */
  private dutyRoster(dateKey: string): DutyItem[] {
    const start = hashString(`duty:${dateKey}`) % TECH_ROSTER.length
    return TECH_ROSTER.map((t, i) => {
      const shift = SHIFT_PATTERN[(i + start) % SHIFT_PATTERN.length] as string
      return { technicianId: t.id, name: t.name, group: t.group, shift, shiftLabel: SHIFT_LABELS[shift] ?? shift }
    })
  }

  /** 房间实时状态 (确定性: 日期哈希 → 状态/队列/当日检查量) */
  private roomStatus(room: OverviewRoom, dateKey: string, now: Date): RoomStatus {
    const h = hashString(`${dateKey}:${room.id}:state`) % 100
    let state: RoomState
    if (h < 8) state = 'MAINTENANCE'
    else if (h < 12) state = 'OFFLINE'
    else if (h < 58) state = 'IN_USE'
    else state = 'IDLE'
    // 工作日 CT-1 恒有进行中检查 (大屏演示确定性保证 ≥1 台在检)
    if (room.id === 'R-CT1' && !isWeekend(dateKey) && state === 'IDLE') state = 'IN_USE'

    let currentExam: RoomExam | null = null
    if (state === 'IN_USE') {
      const startedMinAgo = 4 + (hashString(`${dateKey}:${room.id}:since`) % 22)
      const patientName = PATIENT_POOL[hashString(`${dateKey}:${room.id}:pt`) % PATIENT_POOL.length] as string
      const itemPool = EXAM_POOL[room.modality] ?? ['影像检查']
      const examItem = itemPool[hashString(`${dateKey}:${room.id}:item`) % itemPool.length] as string
      currentExam = {
        patientName,
        examItem,
        startedAt: new Date(now.getTime() - startedMinAgo * 60000).toISOString(),
        progressPct: Math.min(95, 28 + (hashString(`${dateKey}:${room.id}:prog`) % 60)),
      }
    }
    const queueCount = (hashString(`${dateKey}:${room.id}:q`) % 4) + (state === 'IDLE' ? 0 : 1)
    const todayExams = 6 + (hashString(`${dateKey}:${room.id}:exams`) % 12)
    return {
      roomId: room.id,
      roomName: room.name,
      modality: room.modality,
      technician: room.technician,
      state,
      currentExam,
      queueCount,
      todayExams,
    }
  }

  getDashboardOverview(now?: Date): DashboardOverview {
    const resolved = now ?? new Date()
    const generatedAt = resolved.toISOString()
    const date = todayStr()
    const duty = this.dutyRoster(date)
    const onDutyCount = duty.filter((d) => d.shift !== 'OFF').length
    const rooms = ROOMS.map((r) => this.roomStatus(r, date, resolved))
    const inUseRooms = rooms.filter((r) => r.state === 'IN_USE').length
    const idleRooms = rooms.filter((r) => r.state === 'IDLE').length
    const waitingCount = rooms.reduce((a, r) => a + r.queueCount, 0)
    const pendingEmergencyCount = 1 + (hashString(`emg:${date}`) % 3)
    return {
      date,
      generatedAt,
      seeded: true,
      onDutyCount,
      offDutyCount: TECH_ROSTER.length - onDutyCount,
      technicianTotal: TECH_ROSTER.length,
      roomCount: ROOMS.length,
      inUseRooms,
      idleRooms,
      inProgressCount: inUseRooms,
      waitingCount,
      pendingEmergencyCount,
      duty,
      rooms,
    }
  }

  // ================= 5. 值班大屏: 房间实时状态流 =================

  /** 房间实时事件流 (近 120 分钟, 确定性; 进行中房间含 EXAM_START 事件) */
  getRoomStatusStream(now?: Date): RoomStatusStream {
    const generatedAt = (now ?? new Date()).toISOString()
    const overview = this.getDashboardOverview(now ?? new Date())
    const base = new Date(overview.generatedAt)
    const events: RoomStatusEvent[] = []
    let seq = 0
    const typePool: RoomEventType[] = ['PATIENT_IN', 'PATIENT_OUT', 'EXAM_START', 'EXAM_END', 'STATE_CHANGE']
    for (const room of overview.rooms) {
      const n = 2 + (hashString(`${room.roomId}:evt`) % 2)
      for (let i = 0; i < n; i++) {
        const h = hashString(`${room.roomId}:evt:${i}`)
        const minutesAgo = 5 + (h % 115)
        const ts = new Date(base.getTime() - minutesAgo * 60000).toISOString()
        let type: RoomEventType = typePool[h % typePool.length] as RoomEventType
        let patientName: string | null = null
        let examItem: string | null = null
        let note = ''
        if (room.state === 'IN_USE' && i === 0) {
          type = 'EXAM_START'
          patientName = room.currentExam?.patientName ?? null
          examItem = room.currentExam?.examItem ?? null
          note = '检查开始, 采集进行中'
        } else if (type === 'EXAM_START' || type === 'EXAM_END' || type === 'PATIENT_IN' || type === 'PATIENT_OUT') {
          const idx = (h >> 8) % PATIENT_POOL.length
          patientName = PATIENT_POOL[idx] as string
          examItem = (EXAM_POOL[room.modality] ?? ['影像检查'])[idx % (EXAM_POOL[room.modality] ?? ['影像检查']).length] as string
          note = type === 'EXAM_START' ? '检查开始' : type === 'EXAM_END' ? '检查结束, 等待出片' : type === 'PATIENT_IN' ? '患者进入检查室' : '患者离开检查室'
        } else if (type === 'STATE_CHANGE') {
          note = room.state === 'IDLE' ? '设备转空闲, 可接下一单' : room.state === 'MAINTENANCE' ? '设备维护中, 暂停接单' : room.state === 'OFFLINE' ? '设备离线, 已通知运维' : '设备运行中'
        }
        events.push({
          id: `EVT-${String(seq++).padStart(3, '0')}`,
          roomId: room.roomId,
          roomName: room.roomName,
          modality: room.modality,
          type,
          patientName,
          examItem,
          technician: room.technician,
          timestamp: ts,
          note,
        })
      }
    }
    // 待处理紧急事件 (1 条, 最近 5 分钟)
    if (overview.pendingEmergencyCount > 0) {
      const ts = new Date(base.getTime() - 2 * 60000).toISOString()
      const room = overview.rooms[hashString(`emg-ev:${overview.date}`) % overview.rooms.length]!
      events.push({
        id: `EVT-${String(seq++).padStart(3, '0')}`,
        roomId: room.roomId,
        roomName: room.roomName,
        modality: room.modality,
        type: 'EMERGENCY',
        patientName: PATIENT_POOL[hashString(`emg-pt:${overview.date}`) % PATIENT_POOL.length] as string,
        examItem: '急诊加急检查',
        technician: room.technician,
        timestamp: ts,
        note: '急诊插入, 已加急排程',
      })
    }
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    return { generatedAt, seeded: true, rooms: overview.rooms, events: events.slice(0, 40) }
  }
}
