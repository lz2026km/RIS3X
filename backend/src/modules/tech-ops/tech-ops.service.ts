/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 4B (tech-ops) - 技师工作站 V2 服务
 * 孤儿模块 (无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动):
 *   1. 设备利用率历史: 按设备聚合每日/每小时占用率 → 30 天时间序列 + 统计(均值/峰值/低谷时段) + 设备对比
 *   2. 紧急插入: 紧急检查插入排程 (当前进行中/最近空闲时段) + 冲突检测 → 建议调整方案 + 插入记录
 *   3. 跨机房排程优化: 检查队列 + 可用房间/设备矩阵 → 确定性贪心 (等待最小 + 设备匹配 + 技师可用)
 *      → 排程表 + 优化前后总等待对比
 * 所有伪随机均为确定性 (同 seedInput 同结果), 便于测试复现。
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

// ================= 类型定义 =================

export type UtilizationGranularity = 'day' | 'hour'

export interface UtilizationPoint {
  hour: number
  hourLabel: string
  rate: number
}

export interface UtilizationDay {
  date: string
  label: string
  weekday: string
  rate: number
  occupiedHours: number
  exams: number
  points: UtilizationPoint[]
}

export interface DeviceUtilization {
  deviceId: string
  name: string
  modality: string
  technician: string
  meanRate: number
  peakRate: number
  troughRate: number
  totalExams: number
  busyDays: number
  avgSessionMin: number
  trend: Array<{ date: string; rate: number }>
  hours: UtilizationPoint[]
}

export interface UtilizationStats {
  meanRate: number
  peakRate: number
  peakDate: string
  peakHour: number
  peakHourLabel: string
  troughRate: number
  troughDate: string
  troughHour: number
  troughHourLabel: string
  totalExams: number
  avgDailyExams: number
}

export interface UtilizationHistoryDto {
  days: number
  granularity: UtilizationGranularity
  seeded: boolean
  series: UtilizationDay[]
  stats: UtilizationStats
  devices: DeviceUtilization[]
}

export type EmergencyStrategy = 'INSERT_NOW' | 'NEXT_FREE' | 'SPARE_DEVICE'
export type ExamPriority = 'ROUTINE' | 'URGENT' | 'STAT'

export interface EmergencyConflict {
  examId: string
  patientName: string
  examItem: string
  type: 'ONGOING' | 'SCHEDULED'
  startMin: number
  endMin: number
  overlapMin: number
  action: 'DEFER' | 'PREEMPT'
}

export interface AdjustmentItem {
  examId: string
  patientName: string
  examItem: string
  originalStartMin: number
  suggestedStartMin: number
  suggestedDeviceId: string
  suggestedDeviceName: string
  action: 'DEFER' | 'MOVE_DEVICE' | 'KEEP'
}

export interface EmergencySuggestion {
  id: string
  strategy: EmergencyStrategy
  strategyLabel: string
  deviceId: string
  deviceName: string
  modality: string
  technician: string
  startMin: number
  startAt: string
  endMin: number
  endAt: string
  startInMin: number
  waitMin: number
  conflictCount: number
  conflicts: EmergencyConflict[]
  feasibility: 'OK' | 'CONFLICT'
  note: string
}

export interface EmergencyInsertDto {
  patientName?: string
  examItem?: string
  modality?: string
  deviceId?: string
  durationMin?: number
  startMin?: number
  priority?: ExamPriority
  force?: boolean
  reason?: string
}

export interface EmergencyRecord {
  id: string
  patientName: string
  examItem: string
  modality: string
  priority: ExamPriority
  deviceId: string
  deviceName: string
  technician: string
  startMin: number
  startAt: string
  endMin: number
  endAt: string
  status: 'INSERTED'
  conflictCount: number
  adjustments: AdjustmentItem[]
  reason: string | null
  createdAt: string
}

export interface EmergencyInsertResult {
  success: boolean
  record: EmergencyRecord | null
  conflicts: EmergencyConflict[]
  adjustments: AdjustmentItem[]
  message: string
}

export interface OptimizeExam {
  id: string
  patientName: string
  examItem: string
  modality: string
  durationMin: number
  priority: ExamPriority
  arrivalMin: number
}

export interface OptimizeDevice {
  id: string
  name: string
  modality: string
  availableFrom: number
  technician: string
}

export interface OptimizeAssignment {
  examId: string
  patientName: string
  examItem: string
  modality: string
  priority: ExamPriority
  durationMin: number
  arrivalMin: number
  deviceId: string
  deviceName: string
  technician: string
  startMin: number
  startAt: string
  endMin: number
  endAt: string
  waitMin: number
}

export interface OptimizeResult {
  generatedAt: string
  seeded: boolean
  exams: OptimizeExam[]
  devices: OptimizeDevice[]
  assignments: OptimizeAssignment[]
  unassigned: OptimizeExam[]
  totalWaitBefore: number
  totalWaitAfter: number
  improvementPct: number
  better: boolean
}

export interface OptimizeDemoDto {
  exams: OptimizeExam[]
  devices: OptimizeDevice[]
}

// ================= 常量与确定性工具 =================

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const STRATEGY_LABELS: Record<EmergencyStrategy, string> = {
  INSERT_NOW: '当前进行中(抢占/顺延)',
  NEXT_FREE: '最近空闲时段',
  SPARE_DEVICE: '启用备用设备',
}

export interface TechOpsDevice {
  id: string
  name: string
  modality: string
  technician: string
  spare: boolean
}

// 设备矩阵 (与 tech-schedule 检查室对应, 本模块独立维护)
export const DEVICES: TechOpsDevice[] = [
  { id: 'DEV-CT1', name: 'CT-1 检查室', modality: 'CT', technician: '刘洋', spare: false },
  { id: 'DEV-CT2', name: 'CT-2 检查室', modality: 'CT', technician: '赵志刚', spare: true },
  { id: 'DEV-MR1', name: 'MR-1 检查室', modality: 'MR', technician: '孙伟', spare: false },
  { id: 'DEV-DR1', name: 'DR-1 检查室', modality: 'DR', technician: '王磊', spare: false },
  { id: 'DEV-DSA1', name: 'DSA-1 检查室', modality: 'DSA', technician: '陈静', spare: false },
  { id: 'DEV-MG1', name: 'MG-1 检查室', modality: 'MG', technician: '周婷', spare: false },
]

const PATIENT_POOL = ['张伟', '王芳', '李明', '刘洋', '赵敏', '陈杰', '孙丽', '周强', '吴敏', '郑华', '钱进', '冯雪', '朱明', '许峰', '何静', '吕娜']

const EXAM_POOL: Record<string, string[]> = {
  CT: ['胸部CT平扫', '头颅CT平扫', '腹部CT增强', '腰椎CT平扫', '冠脉CTA'],
  MR: ['腰椎MR平扫', '头颅MR平扫', '膝关节MR平扫', '腹部MR增强', '颈椎MR平扫'],
  DR: ['胸部DR正位', '腰椎正侧位', '膝关节DR正位', '踝关节DR', '腹部立位平片'],
  DSA: ['冠脉造影', '脑血管造影', '下肢动脉造影', '肝动脉介入'],
  MG: ['乳腺钼靶', '乳腺钼靶增强', '乳腺断层合成'],
}

const MODALITIES = ['CT', 'MR', 'DR', 'DSA', 'MG']

function hashString(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性伪随机: 同一 seedInput 永远得到同一结果 */
function seededRand(min: number, max: number, seedInput: string): number {
  let a = hashString(seedInput) >>> 0
  a = (a + 0x6d2b79f5) | 0
  let t = Math.imul(a ^ (a >>> 15), 1 | a)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return Math.round((r * (max - min) + min) * 10) / 10
}

function clampInt(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(v)))
}

function dateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}

function fmtTime(minOfDay: number): string {
  const m = ((minOfDay % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

function isoFromNow(nowMin: number, dateKey: string): string {
  const [y, mo, d] = dateKey.split('-').map(Number)
  const base = new Date(y as number, (mo as number) - 1, d as number, 0, 0, 0)
  return new Date(base.getTime() + nowMin * 60000).toISOString()
}

const PRIORITY_RANK: Record<ExamPriority, number> = { STAT: 0, URGENT: 1, ROUTINE: 2 }

// ================= 今日检查排程 (确定性种子, 供冲突检测) =================

export interface ScheduledExam {
  examId: string
  patientName: string
  examItem: string
  modality: string
  startMin: number
  durationMin: number
  priority: ExamPriority
  type: 'ONGOING' | 'SCHEDULED'
  technician: string
}

export function buildTodaySchedule(dateKey: string, nowMin: number): Map<string, ScheduledExam[]> {
  const byDevice = new Map<string, ScheduledExam[]>()
  for (const dev of DEVICES) {
    const list: ScheduledExam[] = []
    const count = 8 + (hashString(`${dateKey}:${dev.id}:count`) % 6)
    let cursor = 8 * 60 + (hashString(`${dateKey}:${dev.id}:start`) % 15)
    for (let i = 0; i < count; i++) {
      const gap = 4 + (hashString(`${dateKey}:${dev.id}:gap:${i}`) % 18)
      const durationMin = 10 + (hashString(`${dateKey}:${dev.id}:dur:${i}`) % 16)
      const patientName = PATIENT_POOL[hashString(`${dateKey}:${dev.id}:pt:${i}`) % PATIENT_POOL.length] as string
      const itemPool = EXAM_POOL[dev.modality] ?? []
      const examItem = itemPool[hashString(`${dateKey}:${dev.id}:item:${i}`) % itemPool.length] as string
      cursor += gap
      const p = hashString(`${dateKey}:${dev.id}:pri:${i}`) % 10
      const priority: ExamPriority = p === 0 ? 'URGENT' : p === 1 ? 'STAT' : 'ROUTINE'
      list.push({
        examId: `E-${dateKey}-${dev.id}-${i}`,
        patientName,
        examItem,
        modality: dev.modality,
        startMin: cursor,
        durationMin,
        priority,
        type: 'SCHEDULED',
        technician: dev.technician,
      })
      cursor += durationMin
    }
    // 进行中检查 (模拟: CT-1 当前有患者正在检查, 预计 12 分钟后结束)
    if (dev.id === 'DEV-CT1') {
      list.push({
        examId: `E-${dateKey}-DEV-CT1-ONGOING`,
        patientName: '周建国',
        examItem: '胸部CT平扫',
        modality: 'CT',
        startMin: nowMin - 13,
        durationMin: 25,
        priority: 'URGENT',
        type: 'ONGOING',
        technician: dev.technician,
      })
    }
    byDevice.set(dev.id, list.sort((a, b) => a.startMin - b.startMin))
  }
  return byDevice
}

// ================= 服务 =================

@Injectable()
export class TechOpsService {
  private readonly emergencyRecords: EmergencyRecord[] = []
  private recordsSeq = 0
  private suggestionsSeq = 0

  constructor(private readonly prisma: PrismaService) {}

  // ================= 基础 =================

  getDevices(): TechOpsDevice[] {
    return DEVICES.map((d) => ({ ...d }))
  }

  getMeta(): { devices: TechOpsDevice[]; date: string; nowMin: number; modalities: string[] } {
    const now = new Date()
    return {
      devices: this.getDevices(),
      date: dateStr(now),
      nowMin: minutesSinceMidnight(now),
      modalities: MODALITIES,
    }
  }

  private todayContext(): { dateKey: string; nowMin: number; schedule: Map<string, ScheduledExam[]> } {
    const now = new Date()
    const dateKey = dateStr(now)
    return { dateKey, nowMin: minutesSinceMidnight(now), schedule: buildTodaySchedule(dateKey, minutesSinceMidnight(now)) }
  }

  // ================= 1. 设备利用率历史 =================

  /**
   * DB 可用: 从 exam 完成记录派生每日检查量 → 缩放确定性占用率, seeded=false
   * DB 不可用/空库: 纯确定性种子 (可复现), seeded=true
   */
  private async fetchDbExamCounts(startDate: Date): Promise<Map<string, Map<string, number>> | null> {
    try {
      const rows: any = await this.prisma.exam.findMany({
        where: { completedAt: { gte: startDate } } as any,
        select: { completedAt: true, deviceId: true } as any,
        take: 100000,
      })
      if (!Array.isArray(rows) || rows.length === 0) return null
      const byDevice = new Map<string, Map<string, number>>()
      for (const r of rows as Array<{ completedAt: Date | null; deviceId: string | null }>) {
        if (!r.completedAt) continue
        const day = dateStr(new Date(r.completedAt))
        const dev = r.deviceId ?? 'UNKNOWN'
        const inner = byDevice.get(dev) ?? new Map<string, number>()
        inner.set(day, (inner.get(day) ?? 0) + 1)
        byDevice.set(dev, inner)
      }
      return byDevice
    } catch {
      return null
    }
  }

  async getUtilizationHistory(params: { days?: number; granularity?: UtilizationGranularity } = {}): Promise<UtilizationHistoryDto> {
    const days = clampInt(params.days ?? 30, 1, 30)
    const granularity: UtilizationGranularity = params.granularity === 'hour' ? 'hour' : 'day'
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1))
    const dateKeys: string[] = []
    for (let i = 0; i < days; i++) {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      dateKeys.push(dateStr(d))
    }

    const dbCounts = await this.fetchDbExamCounts(start)
    const seeded = dbCounts === null

    // 每设备每日每小时占用率 (确定性)
    const deviceHourlyMean = DEVICES.map((dev) => {
      const hours: UtilizationPoint[] = Array.from({ length: 24 }, (_, h) => {
        const rates = dateKeys.map((key) => this.deviceHourRate(dev, key, h))
        const mean = Math.round(rates.reduce((a, b) => a + b, 0) / rates.length)
        return { hour: h, hourLabel: `${String(h).padStart(2, '0')}:00`, rate: mean }
      })
      return { dev, hours }
    })

    // 每设备每日占用率 + 检查量
    const deviceDaily = DEVICES.map((dev) => {
      const trend = dateKeys.map((key) => {
        let rate = Math.round(this.deviceDailyRate(dev, key))
        const dbDay = dbCounts?.get(dev.id)?.get(key)
        if (dbDay !== undefined) {
          const seedExams = this.seedDailyExams(dev, key)
          const scale = Math.max(0.3, Math.min(1.6, seedExams > 0 ? dbDay / seedExams : 0.6))
          rate = clampInt(rate * scale, 2, 98)
        }
        const occupiedHours = Math.round(rate * 0.24 * 10) / 10
        const exams = dbDay ?? this.seedDailyExams(dev, key)
        return { date: key, rate, occupiedHours, exams }
      })
      const rates = trend.map((t) => t.rate)
      const avgSessionMin = 15 + (hashString(`session:${dev.id}`) % 11)
      const totalExams = trend.reduce((a, t) => a + t.exams, 0)
      return {
        dev,
        avgSessionMin,
        totalExams,
        busyDays: trend.filter((t) => t.rate >= 60).length,
        meanRate: Math.round(rates.reduce((a, b) => a + b, 0) / rates.length),
        peakRate: Math.max(...rates),
        troughRate: Math.min(...rates),
        trend,
        hours: deviceHourlyMean.find((x) => x.dev.id === dev.id)?.hours ?? [],
      }
    })

    // 日序列 (全部设备均值)
    const series: UtilizationDay[] = dateKeys.map((key) => {
      const days = deviceDaily.map((dd) => dd.trend.find((t) => t.date === key)!)
      const rate = Math.round(days.reduce((a, t) => a + t.rate, 0) / days.length)
      const occupiedHours = Math.round((days.reduce((a, t) => a + t.occupiedHours, 0) / days.length) * 10) / 10
      const exams = days.reduce((a, t) => a + t.exams, 0)
      const d = new Date(`${key}T00:00:00`)
      return {
        date: key,
        label: key.slice(5),
        weekday: WEEKDAYS[d.getDay()] ?? '',
        rate,
        occupiedHours,
        exams,
        points: Array.from({ length: 24 }, (_, h) => {
          const all = DEVICES.map((dev) => this.deviceHourRate(dev, key, h))
          return { hour: h, hourLabel: `${String(h).padStart(2, '0')}:00`, rate: Math.round(all.reduce((a, b) => a + b, 0) / all.length) }
        }),
      }
    })

    // 统计: 均值/峰值/低谷 (含低谷时段)
    const dailyRates = series.map((s) => s.rate)
    const meanRate = Math.round(dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length)
    const peakIdx = dailyRates.indexOf(Math.max(...dailyRates))
    const troughIdx = dailyRates.indexOf(Math.min(...dailyRates))
    const crossHourMean = (hour: number) => {
      const all = deviceHourlyMean.map((x) => x.hours[hour]!.rate)
      return Math.round(all.reduce((a, b) => a + b, 0) / all.length)
    }
    let peakHour = 10
    let troughHour = 3
    for (let h = 0; h < 24; h++) {
      if (crossHourMean(h) > crossHourMean(peakHour)) peakHour = h
      if (crossHourMean(h) < crossHourMean(troughHour)) troughHour = h
    }
    const totalExams = deviceDaily.reduce((a, dd) => a + dd.totalExams, 0)
    const stats: UtilizationStats = {
      meanRate,
      peakRate: Math.max(...dailyRates),
      peakDate: series[peakIdx]?.date ?? '',
      peakHour,
      peakHourLabel: `${String(peakHour).padStart(2, '0')}:00`,
      troughRate: Math.min(...dailyRates),
      troughDate: series[troughIdx]?.date ?? '',
      troughHour,
      troughHourLabel: `${String(troughHour).padStart(2, '0')}:00`,
      totalExams,
      avgDailyExams: Math.round(totalExams / days),
    }

    const devices: DeviceUtilization[] = deviceDaily.map((dd) => ({
      deviceId: dd.dev.id,
      name: dd.dev.name,
      modality: dd.dev.modality,
      technician: dd.dev.technician,
      meanRate: dd.meanRate,
      peakRate: dd.peakRate,
      troughRate: dd.troughRate,
      totalExams: dd.totalExams,
      busyDays: dd.busyDays,
      avgSessionMin: dd.avgSessionMin,
      trend: dd.trend.map((t) => ({ date: t.date, rate: t.rate })),
      hours: dd.hours,
    }))

    return { days, granularity, seeded, series, stats, devices }
  }

  private deviceHourRate(dev: TechOpsDevice, dateKey: string, hour: number): number {
    // 基础时段曲线: 上午高峰 → 午后回落 → 晚间低谷 → 夜间最低
    let base: number
    if (hour >= 8 && hour < 11) base = 78 + seededRand(0, 16, `util:${dev.id}:${dateKey}:${hour}`)
    else if (hour >= 11 && hour < 12) base = 70 + seededRand(0, 14, `util:${dev.id}:${dateKey}:${hour}`)
    else if (hour >= 12 && hour < 14) base = 52 + seededRand(0, 14, `util:${dev.id}:${dateKey}:${hour}`)
    else if (hour >= 14 && hour < 18) base = 62 + seededRand(0, 16, `util:${dev.id}:${dateKey}:${hour}`)
    else if (hour >= 18 && hour < 21) base = 28 + seededRand(0, 14, `util:${dev.id}:${dateKey}:${hour}`)
    else if (hour >= 21 || hour < 6) base = 6 + seededRand(0, 10, `util:${dev.id}:${dateKey}:${hour}`)
    else base = 16 + seededRand(0, 12, `util:${dev.id}:${dateKey}:${hour}`)
    const dayFactor = 0.82 + (hashString(`${dateKey}:day`) % 37) / 100
    const weekendFactor = this.isWeekend(dateKey) ? 0.62 : 1
    const devFactor = 0.92 + (hashString(`dev:${dev.id}`) % 17) / 100
    return clampInt(base * dayFactor * weekendFactor * devFactor, 2, 98)
  }

  private deviceDailyRate(dev: TechOpsDevice, dateKey: string): number {
    let sum = 0
    for (let h = 0; h < 24; h++) sum += this.deviceHourRate(dev, dateKey, h)
    return Math.round(sum / 24)
  }

  private seedDailyExams(dev: TechOpsDevice, dateKey: string): number {
    const occupiedHours = (this.deviceDailyRate(dev, dateKey) / 100) * 24
    const avgSessionMin = 15 + (hashString(`session:${dev.id}`) % 11)
    return Math.max(1, Math.round((occupiedHours * 60) / avgSessionMin))
  }

  private isWeekend(dateKey: string): boolean {
    const d = new Date(`${dateKey}T00:00:00`)
    return d.getDay() === 0 || d.getDay() === 6
  }

  // ================= 2. 紧急插入 =================

  private occupiedIntervals(deviceId: string, ctx: { dateKey: string; nowMin: number; schedule: Map<string, ScheduledExam[]> }): ScheduledExam[] {
    const base = ctx.schedule.get(deviceId) ?? []
    const records = this.emergencyRecords.filter((r) => r.deviceId === deviceId)
    const asExam = (r: EmergencyRecord): ScheduledExam => ({
      examId: r.id,
      patientName: r.patientName,
      examItem: r.examItem,
      modality: r.modality,
      startMin: r.startMin,
      durationMin: r.endMin - r.startMin,
      priority: r.priority,
      type: 'SCHEDULED',
      technician: r.technician,
    })
    return [...base, ...records.map(asExam)].sort((a, b) => a.startMin - b.startMin)
  }

  private detectConflicts(intervals: ScheduledExam[], startMin: number, durationMin: number): EmergencyConflict[] {
    const endMin = startMin + durationMin
    const out: EmergencyConflict[] = []
    for (const it of intervals) {
      const itEnd = it.startMin + it.durationMin
      const overlap = Math.min(endMin, itEnd) - Math.max(startMin, it.startMin)
      if (overlap > 0) {
        out.push({
          examId: it.examId,
          patientName: it.patientName,
          examItem: it.examItem,
          type: it.type,
          startMin: it.startMin,
          endMin: itEnd,
          overlapMin: overlap,
          action: it.type === 'ONGOING' ? 'PREEMPT' : 'DEFER',
        })
      }
    }
    return out
  }

  private nextFreeSlot(intervals: ScheduledExam[], fromMin: number, durationMin: number): number {
    let cursor = Math.max(0, fromMin)
    const sorted = [...intervals].sort((a, b) => a.startMin - b.startMin)
    for (const it of sorted) {
      const itEnd = it.startMin + it.durationMin
      if (itEnd <= cursor) continue
      if (it.startMin >= cursor + durationMin) return cursor
      cursor = itEnd
    }
    return cursor
  }

  suggestSlots(dto: { modality?: string; deviceId?: string; durationMin?: number } = {}): EmergencySuggestion[] {
    const ctx = this.todayContext()
    const durationMin = clampInt(dto.durationMin ?? 15, 5, 90)
    const deviceId = dto.deviceId ?? ''
    const modality = dto.modality ?? DEVICES.find((d) => d.id === deviceId)?.modality ?? 'CT'
    if (!MODALITIES.includes(modality)) throw new BadRequestException(`模态 ${modality} 不支持 (CT/MR/DR/DSA/MG)`)
    const candidates = DEVICES.filter((d) => (deviceId ? d.id === deviceId : d.modality === modality))
    if (candidates.length === 0) throw new BadRequestException(`无 ${modality} 设备可用`)
    const suggestions: EmergencySuggestion[] = []
    const now = ctx.nowMin

    for (const dev of candidates) {
      const intervals = this.occupiedIntervals(dev.id, ctx)

      // 策略 1: 当前进行中 (立即插入, 冲突检测 → 建议顺延)
      const nowConflicts = this.detectConflicts(intervals, now, durationMin)
      const ongoing = intervals.find((it) => it.type === 'ONGOING' && it.startMin + it.durationMin > now)
      const ongoingEndsIn = ongoing ? ongoing.startMin + ongoing.durationMin - now : 0
      const nowFeasible = nowConflicts.length <= 2
      suggestions.push({
        id: `S-${++this.suggestionsSeq}`,
        strategy: 'INSERT_NOW',
        strategyLabel: STRATEGY_LABELS.INSERT_NOW,
        deviceId: dev.id,
        deviceName: dev.name,
        modality: dev.modality,
        technician: dev.technician,
        startMin: now,
        startAt: isoFromNow(now, ctx.dateKey),
        endMin: now + durationMin,
        endAt: isoFromNow(now + durationMin, ctx.dateKey),
        startInMin: 0,
        waitMin: 0,
        conflictCount: nowConflicts.length,
        conflicts: nowConflicts,
        feasibility: nowFeasible ? 'OK' : 'CONFLICT',
        note: nowConflicts.length > 0
          ? `当前有 ${nowConflicts.length} 项冲突${ongoing ? `, 进行中检查 ${ongoing.patientName}(${ongoing.examItem}) 约 ${ongoingEndsIn} 分钟后结束` : ''}`
          : '当前设备空闲, 可立即插入',
      })

      // 策略 2: 最近空闲时段
      const freeStart = this.nextFreeSlot(intervals, now, durationMin)
      const freeConflicts = this.detectConflicts(intervals, freeStart, durationMin)
      suggestions.push({
        id: `S-${++this.suggestionsSeq}`,
        strategy: 'NEXT_FREE',
        strategyLabel: STRATEGY_LABELS.NEXT_FREE,
        deviceId: dev.id,
        deviceName: dev.name,
        modality: dev.modality,
        technician: dev.technician,
        startMin: freeStart,
        startAt: isoFromNow(freeStart, ctx.dateKey),
        endMin: freeStart + durationMin,
        endAt: isoFromNow(freeStart + durationMin, ctx.dateKey),
        startInMin: Math.max(0, freeStart - now),
        waitMin: Math.max(0, freeStart - now),
        conflictCount: freeConflicts.length,
        conflicts: freeConflicts,
        feasibility: freeConflicts.length === 0 ? 'OK' : 'CONFLICT',
        note: freeConflicts.length === 0 ? `${fmtTime(freeStart)} 起空闲 ${durationMin} 分钟` : '存在重叠, 需先调整',
      })
    }

    // 策略 3: 备用设备 (同模态 spare 设备)
    for (const dev of candidates.filter((d) => d.spare)) {
      const intervals = this.occupiedIntervals(dev.id, ctx)
      const freeStart = this.nextFreeSlot(intervals, now, durationMin)
      suggestions.push({
        id: `S-${++this.suggestionsSeq}`,
        strategy: 'SPARE_DEVICE',
        strategyLabel: STRATEGY_LABELS.SPARE_DEVICE,
        deviceId: dev.id,
        deviceName: dev.name,
        modality: dev.modality,
        technician: dev.technician,
        startMin: freeStart,
        startAt: isoFromNow(freeStart, ctx.dateKey),
        endMin: freeStart + durationMin,
        endAt: isoFromNow(freeStart + durationMin, ctx.dateKey),
        startInMin: Math.max(0, freeStart - now),
        waitMin: Math.max(0, freeStart - now),
        conflictCount: this.detectConflicts(intervals, freeStart, durationMin).length,
        conflicts: [],
        feasibility: 'OK',
        note: '备用设备, 正常启用',
      })
    }

    return suggestions.sort((a, b) => a.startInMin - b.startInMin).slice(0, 8)
  }

  private buildAdjustments(deviceId: string, conflicts: EmergencyConflict[], ctx: { dateKey: string; nowMin: number; schedule: Map<string, ScheduledExam[]> }): AdjustmentItem[] {
    const adjustments: AdjustmentItem[] = []
    for (const c of conflicts) {
      const intervals = this.occupiedIntervals(deviceId, ctx).filter((it) => it.examId !== c.examId)
      const deferredStart = this.nextFreeSlot(intervals, c.endMin, c.endMin - c.startMin)
      let action: AdjustmentItem['action'] = 'KEEP'
      let targetDeviceId = deviceId
      let targetDeviceName = DEVICES.find((d) => d.id === deviceId)?.name ?? deviceId
      if (deferredStart === c.startMin) {
        action = 'KEEP'
      } else if (deferredStart - c.startMin > 90) {
        const spare = DEVICES.find((d) => d.spare && d.modality === (ctx.schedule.get(deviceId)?.[0]?.modality ?? DEVICES.find((x) => x.id === deviceId)?.modality ?? ''))
        if (spare) {
          action = 'MOVE_DEVICE'
          targetDeviceId = spare.id
          targetDeviceName = spare.name
        } else {
          action = 'DEFER'
        }
      } else {
        action = 'DEFER'
      }
      adjustments.push({
        examId: c.examId,
        patientName: c.patientName,
        examItem: c.examItem,
        originalStartMin: c.startMin,
        suggestedStartMin: action === 'MOVE_DEVICE' ? Math.max(c.startMin, ctx.nowMin) : deferredStart,
        suggestedDeviceId: targetDeviceId,
        suggestedDeviceName: targetDeviceName,
        action,
      })
    }
    return adjustments
  }

  insert(dto: EmergencyInsertDto = {}): EmergencyInsertResult {
    const ctx = this.todayContext()
    const patientName = String(dto.patientName ?? '').trim() || '紧急患者'
    const modality = dto.modality ?? 'CT'
    if (!MODALITIES.includes(modality)) throw new BadRequestException(`模态 ${modality} 不支持`)
    const deviceId = dto.deviceId ?? DEVICES.find((d) => d.modality === modality && d.spare)?.id ?? DEVICES.find((d) => d.modality === modality)?.id
    const dev = DEVICES.find((d) => d.id === deviceId)
    if (!dev) throw new NotFoundException(`设备 ${deviceId} 不存在`)
    const durationMin = clampInt(dto.durationMin ?? 15, 5, 90)
    const startMin = dto.startMin !== undefined ? clampInt(dto.startMin, 0, 1439) : ctx.nowMin
    const priority: ExamPriority = dto.priority === 'STAT' || dto.priority === 'URGENT' ? dto.priority : 'URGENT'
    const itemPool = EXAM_POOL[modality] ?? ['影像检查']
    const examItem = String(dto.examItem ?? '').trim() || (itemPool[hashString(`${ctx.dateKey}:${patientName}`) % itemPool.length] as string)
    const conflicts = this.detectConflicts(this.occupiedIntervals(dev.id, ctx), startMin, durationMin)

    if (conflicts.length > 0 && !dto.force) {
      const adjustments = this.buildAdjustments(dev.id, conflicts, ctx)
      return {
        success: false,
        record: null,
        conflicts,
        adjustments,
        message: `与 ${conflicts.length} 项检查冲突, 需先调整 (顺延/启用备用设备)`,
      }
    }

    const adjustments = this.buildAdjustments(dev.id, conflicts, ctx)
    const now = new Date()
    const record: EmergencyRecord = {
      id: `EMG-${Date.now()}-${++this.recordsSeq}`,
      patientName,
      examItem,
      modality,
      priority,
      deviceId: dev.id,
      deviceName: dev.name,
      technician: dev.technician,
      startMin,
      startAt: isoFromNow(startMin, ctx.dateKey),
      endMin: startMin + durationMin,
      endAt: isoFromNow(startMin + durationMin, ctx.dateKey),
      status: 'INSERTED',
      conflictCount: conflicts.length,
      adjustments,
      reason: dto.reason ?? null,
      createdAt: now.toISOString(),
    }
    this.emergencyRecords.push(record)
    return {
      success: true,
      record,
      conflicts,
      adjustments,
      message: conflicts.length > 0
        ? `已插入, 冲突 ${conflicts.length} 项已生成调整方案`
        : '已插入, 无冲突',
    }
  }

  listInserts(): EmergencyRecord[] {
    return [...this.emergencyRecords].sort((a, b) => b.startAt.localeCompare(a.startAt))
  }

  // ================= 3. 跨机房排程优化 =================

  demoQueue(): OptimizeDemoDto {
    const exams: OptimizeExam[] = [
      { id: 'DEMO-E1', patientName: '张伟', examItem: '胸部CT平扫', modality: 'CT', durationMin: 15, priority: 'ROUTINE', arrivalMin: 0 },
      { id: 'DEMO-E2', patientName: '王芳', examItem: '腰椎MR平扫', modality: 'MR', durationMin: 20, priority: 'ROUTINE', arrivalMin: 5 },
      { id: 'DEMO-E3', patientName: '李明', examItem: '头颅CT增强', modality: 'CT', durationMin: 25, priority: 'URGENT', arrivalMin: 2 },
      { id: 'DEMO-E4', patientName: '刘洋', examItem: '冠脉造影', modality: 'DSA', durationMin: 40, priority: 'STAT', arrivalMin: 10 },
      { id: 'DEMO-E5', patientName: '赵敏', examItem: '乳腺钼靶', modality: 'MG', durationMin: 12, priority: 'ROUTINE', arrivalMin: 15 },
      { id: 'DEMO-E6', patientName: '陈杰', examItem: '腹部CT平扫', modality: 'CT', durationMin: 15, priority: 'ROUTINE', arrivalMin: 20 },
      { id: 'DEMO-E7', patientName: '孙丽', examItem: '膝关节DR', modality: 'DR', durationMin: 8, priority: 'ROUTINE', arrivalMin: 18 },
      { id: 'DEMO-E8', patientName: '周强', examItem: '颈椎MR平扫', modality: 'MR', durationMin: 18, priority: 'ROUTINE', arrivalMin: 30 },
      { id: 'DEMO-E9', patientName: '吴敏', examItem: '胸部CT增强', modality: 'CT', durationMin: 25, priority: 'ROUTINE', arrivalMin: 35 },
      { id: 'DEMO-E10', patientName: '郑华', examItem: '腰椎MR增强', modality: 'MR', durationMin: 25, priority: 'URGENT', arrivalMin: 40 },
    ]
    const devices: OptimizeDevice[] = [
      { id: 'DEV-CT1', name: 'CT-1 检查室', modality: 'CT', availableFrom: 100, technician: '刘洋' },
      { id: 'DEV-CT2', name: 'CT-2 检查室', modality: 'CT', availableFrom: 0, technician: '赵志刚' },
      { id: 'DEV-MR1', name: 'MR-1 检查室', modality: 'MR', availableFrom: 0, technician: '孙伟' },
      { id: 'DEV-DR1', name: 'DR-1 检查室', modality: 'DR', availableFrom: 0, technician: '王磊' },
      { id: 'DEV-DSA1', name: 'DSA-1 检查室', modality: 'DSA', availableFrom: 15, technician: '陈静' },
      { id: 'DEV-MG1', name: 'MG-1 检查室', modality: 'MG', availableFrom: 0, technician: '周婷' },
    ]
    return { exams, devices }
  }

  optimize(dto: OptimizeDemoDto | null): OptimizeResult {
    const input = dto && Array.isArray(dto.exams) && Array.isArray(dto.devices) ? dto : this.demoQueue()
    const exams = input.exams
    const devices = input.devices
    if (exams.length === 0) throw new BadRequestException('检查队列不能为空')
    if (devices.length === 0) throw new BadRequestException('设备矩阵不能为空')
    for (const e of exams) {
      if (!e.modality || !(e.priority in PRIORITY_RANK) || !e.durationMin || e.durationMin < 1) {
        throw new BadRequestException(`检查 ${e.id} 优先级/模态/时长不合法`)
      }
    }

    const ordered = [...exams].sort((a, b) => {
      const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
      if (pr !== 0) return pr
      if (a.arrivalMin !== b.arrivalMin) return a.arrivalMin - b.arrivalMin
      return a.id.localeCompare(b.id)
    })
    const compatible = (e: OptimizeExam) => devices.filter((d) => d.modality === e.modality)

    // ---- 优化前 (naive): 队列顺序 → 首选同模态列表第一台设备 ----
    const naiveState = new Map<string, number>()
    for (const d of devices) naiveState.set(d.id, d.availableFrom)
    const beforeAssignments: OptimizeAssignment[] = []
    const beforeUnassigned: OptimizeExam[] = []
    for (const e of ordered) {
      const pool = compatible(e)
      if (pool.length === 0) {
        beforeUnassigned.push(e)
        continue
      }
      const dev = pool[0]!
      const start = Math.max(naiveState.get(dev.id) ?? dev.availableFrom, e.arrivalMin)
      const end = start + e.durationMin
      naiveState.set(dev.id, end)
      beforeAssignments.push(this.toAssignment(e, dev, start, end))
    }

    // ---- 优化后 (greedy): 每次选择最早可开始的兼容设备 ----
    const greedyState = new Map<string, number>()
    for (const d of devices) greedyState.set(d.id, d.availableFrom)
    const afterAssignments: OptimizeAssignment[] = []
    const afterUnassigned: OptimizeExam[] = []
    for (const e of ordered) {
      const pool = compatible(e)
      if (pool.length === 0) {
        afterUnassigned.push(e)
        continue
      }
      const best = [...pool].sort((a, b) => {
        const aStart = Math.max(greedyState.get(a.id) ?? a.availableFrom, e.arrivalMin)
        const bStart = Math.max(greedyState.get(b.id) ?? b.availableFrom, e.arrivalMin)
        if (aStart !== bStart) return aStart - bStart
        const aLoad = greedyState.get(a.id) ?? a.availableFrom
        const bLoad = greedyState.get(b.id) ?? b.availableFrom
        if (aLoad !== bLoad) return aLoad - bLoad
        return a.id.localeCompare(b.id)
      })[0]!
      const start = Math.max(greedyState.get(best.id) ?? best.availableFrom, e.arrivalMin)
      const end = start + e.durationMin
      greedyState.set(best.id, end)
      afterAssignments.push(this.toAssignment(e, best, start, end))
    }

    const totalWaitBefore = beforeAssignments.reduce((a, x) => a + x.waitMin, 0)
    const totalWaitAfter = afterAssignments.reduce((a, x) => a + x.waitMin, 0)
    const improvementPct = totalWaitBefore > 0 ? Math.round(((totalWaitBefore - totalWaitAfter) / totalWaitBefore) * 100) : 0

    return {
      generatedAt: new Date().toISOString(),
      seeded: true,
      exams,
      devices,
      assignments: afterAssignments,
      unassigned: afterUnassigned,
      totalWaitBefore,
      totalWaitAfter,
      improvementPct: Math.max(0, improvementPct),
      better: totalWaitAfter <= totalWaitBefore,
    }
  }

  private toAssignment(e: OptimizeExam, dev: OptimizeDevice, start: number, end: number): OptimizeAssignment {
    const dateKey = dateStr(new Date())
    return {
      examId: e.id,
      patientName: e.patientName,
      examItem: e.examItem,
      modality: e.modality,
      priority: e.priority,
      durationMin: e.durationMin,
      arrivalMin: e.arrivalMin,
      deviceId: dev.id,
      deviceName: dev.name,
      technician: dev.technician,
      startMin: start,
      startAt: isoFromNow(start, dateKey),
      endMin: end,
      endAt: isoFromNow(end, dateKey),
      waitMin: Math.max(0, start - e.arrivalMin),
    }
  }
}
