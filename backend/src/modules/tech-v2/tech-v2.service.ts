/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 4A (tech-v2) - 技师工作站 V2: 双检间轮转 + 工作量预测
 *
 * 孤儿模块 (无 Prisma, 无外部依赖, 可无 DB 启动), 全部数据内存展开 + seed 回退:
 *
 * 1) 双检间轮转
 *    - 轮转规则: 按班次 (DAY/NIGHT/WEEKEND/BACKUP) × 技能矩阵 (roomId → 可操作技师) × 工作量均衡权重
 *    - 轮转计划生成: 确定性贪心 (当前累计工作量最小优先 + 技能匹配 + 房间约束 + 连续天数约束)
 *    - 轮转执行记录 / 轮转历史
 * 2) 工作量预测
 *    - 历史工作量 (小时粒度, 确定性派生) + 预约趋势 + 季节性 (周模式)
 *    - 加权移动平均 (WMA [0.4, 0.3, 0.2, 0.1] × 同周几近 4 周) + 置信区间 (±1.96σ)
 *    - 输出未来 7 天每日 / 每时段预测 + 置信区间; 技师级别预测 (确定性份额分配)
 * 3) 全部算法确定性: 不使用 Math.random, 唯一随机源为 FNV-1a 哈希派生
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'

// ==================== 基础类型 (与 tech-schedule 模块对齐) ====================

export type TechShift = 'DAY' | 'NIGHT' | 'WEEKEND' | 'BACKUP'

export const SHIFT_LABELS: Record<TechShift, string> = {
  DAY: '白班',
  NIGHT: '夜班',
  WEEKEND: '周末班',
  BACKUP: '备班',
}

export interface TechV2Technician {
  id: string
  name: string
  group: string
}

export interface TechV2Room {
  id: string
  name: string
}

// ==================== 轮转规则 ====================

export interface RotationRule {
  id: string
  name: string
  shift: TechShift
  roomIds: string[]
  /** 技能矩阵: roomId → 可操作技师 id 列表 (房间约束) */
  skillMatrix: Record<string, string[]>
  /** 无房间规则 (如备班) 的候选技师 */
  eligibleTechIds: string[]
  /** 最大连续天数 (轮转约束) */
  maxConsecutiveDays: number
  /** 工作量均衡权重 0-1 (1 = 纯最小累计工作量优先) */
  balanceWeight: number
  enabled: boolean
  description: string
}

export interface RotationGroupBalance {
  groupId: string
  groupName: string
  technicianIds: string[]
  loads: Array<{ technicianId: string; technicianName: string; load: number }>
  maxMinDiff: number
}

export interface WorkloadBalance {
  perTechnician: Array<{
    technicianId: string
    technicianName: string
    baseLoad: number
    planLoad: number
    cumulativeLoad: number
    assignmentCount: number
    nights: number
  }>
  groups: RotationGroupBalance[]
  maxMinDiff: number
  threshold: number
  balanced: boolean
  seeded: boolean
}

export interface RotationAssignment {
  id: string
  planId: string
  ruleId: string
  date: string
  shift: TechShift
  roomId: string | null
  roomName: string | null
  technicianId: string
  technicianName: string
  /** 排入前该技师累计工作量 (贪心依据) */
  accumulatedBefore: number
  /** 该日该时段预测工作量 (作为本次排班负载) */
  predictedLoad: number
  reason: string
}

export interface RotationPlan {
  id: string
  generatedAt: string
  startDate: string
  endDate: string
  days: number
  balanceWeight: number
  assignments: RotationAssignment[]
  skipped: Array<{ date: string; shift: TechShift; roomId: string | null; reason: string }>
  balance: WorkloadBalance
  seeded: boolean
}

export type RotationExecutionStatus = 'EXECUTED' | 'SKIPPED'

export interface RotationExecutionRecord {
  id: string
  planId: string
  assignmentId: string
  date: string
  shift: TechShift
  technicianId: string
  technicianName: string
  roomId: string | null
  status: RotationExecutionStatus
  executedAt: string
  note: string | null
}

export interface RotationHistory {
  plans: Array<{
    id: string
    generatedAt: string
    startDate: string
    endDate: string
    days: number
    assignmentsCount: number
    executedCount: number
    balance: WorkloadBalance
  }>
  executions: RotationExecutionRecord[]
}

// ==================== 工作量预测 ====================

export interface ForecastPeriod {
  period: string
  hourRange: string
  value: number
  lower: number
  upper: number
}

export interface ForecastDay {
  date: string
  weekday: string
  label: string
  value: number
  lower: number
  upper: number
  appointments: number
  trendFactor: number
  periods: ForecastPeriod[]
}

export interface TechForecastItem {
  technicianId: string
  technicianName: string
  date: string
  share: number
  value: number
}

export interface RoomForecastItem {
  roomId: string
  roomName: string
  date: string
  value: number
}

export interface WorkloadForecast {
  startDate: string
  days: number
  model: string
  seeded: boolean
  daily: ForecastDay[]
  totals: { value: number; lower: number; upper: number }
  perTechnician: TechForecastItem[]
  byRoom: RoomForecastItem[]
  /** 近 7 天实际工作量 (历史, 确定性派生), 供 实际 vs 预测 对照 */
  history: Array<{ date: string; weekday: string; value: number }>
}

export interface GenerateRotationDto {
  startDate: string
  days?: number
  balanceWeight?: number
}

// ==================== 常量与名册 (确定性种子) ====================

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

const TECH_ROSTER: TechV2Technician[] = [
  { id: 'T-001', name: '刘洋', group: 'CT 组' },
  { id: 'T-002', name: '赵志刚', group: 'CT 组' },
  { id: 'T-003', name: '孙伟', group: 'MR 组' },
  { id: 'T-004', name: '王磊', group: 'DR 组' },
  { id: 'T-005', name: '陈静', group: 'DSA 组' },
  { id: 'T-006', name: '周婷', group: 'MG 组' },
  { id: 'T-007', name: '吴强', group: 'CT 组' },
  { id: 'T-008', name: '郑爽', group: 'MR 组' },
]

const ROOMS: TechV2Room[] = [
  { id: 'R-CT1', name: 'CT-1 检查室' },
  { id: 'R-CT2', name: 'CT-2 检查室' },
  { id: 'R-MR1', name: 'MR-1 检查室' },
  { id: 'R-DR1', name: 'DR-1 检查室' },
  { id: 'R-DSA1', name: 'DSA-1 检查室' },
  { id: 'R-MG1', name: 'MG-1 检查室' },
]

const CT_TECHS = ['T-001', 'T-002', 'T-007']
const MR_TECHS = ['T-003', 'T-008']

/** 轮转规则 (确定性种子): 双检间 = CT-1/CT-2 双房间同技能池轮转 */
const ROTATION_RULES: RotationRule[] = [
  {
    id: 'RULE-CT-DAY',
    name: 'CT 双检间白班轮转',
    shift: 'DAY',
    roomIds: ['R-CT1', 'R-CT2'],
    skillMatrix: { 'R-CT1': CT_TECHS, 'R-CT2': CT_TECHS },
    eligibleTechIds: [],
    maxConsecutiveDays: 4,
    balanceWeight: 0.6,
    enabled: true,
    description: '双检间 (CT-1/CT-2) 白班由 CT 组轮转, 按累计工作量最小优先分配',
  },
  {
    id: 'RULE-CT-NIGHT',
    name: 'CT 夜班轮转',
    shift: 'NIGHT',
    roomIds: ['R-CT1'],
    skillMatrix: { 'R-CT1': CT_TECHS },
    eligibleTechIds: [],
    maxConsecutiveDays: 2,
    balanceWeight: 0.6,
    enabled: true,
    description: 'CT 夜班单间值守, CT 组轮转',
  },
  {
    id: 'RULE-MR-DAY',
    name: 'MR 白班轮转',
    shift: 'DAY',
    roomIds: ['R-MR1'],
    skillMatrix: { 'R-MR1': MR_TECHS },
    eligibleTechIds: [],
    maxConsecutiveDays: 4,
    balanceWeight: 0.6,
    enabled: true,
    description: 'MR-1 白班由 MR 组轮转',
  },
  {
    id: 'RULE-MR-NIGHT',
    name: 'MR 夜班轮转',
    shift: 'NIGHT',
    roomIds: ['R-MR1'],
    skillMatrix: { 'R-MR1': MR_TECHS },
    eligibleTechIds: [],
    maxConsecutiveDays: 2,
    balanceWeight: 0.6,
    enabled: true,
    description: 'MR-1 夜班由 MR 组轮转',
  },
  {
    id: 'RULE-DR-DAY',
    name: 'DR 白班',
    shift: 'DAY',
    roomIds: ['R-DR1'],
    skillMatrix: { 'R-DR1': ['T-004'] },
    eligibleTechIds: [],
    maxConsecutiveDays: 5,
    balanceWeight: 0.6,
    enabled: true,
    description: 'DR-1 白班 (单技能)',
  },
  {
    id: 'RULE-DSA-DAY',
    name: 'DSA 白班',
    shift: 'DAY',
    roomIds: ['R-DSA1'],
    skillMatrix: { 'R-DSA1': ['T-005'] },
    eligibleTechIds: [],
    maxConsecutiveDays: 5,
    balanceWeight: 0.6,
    enabled: true,
    description: 'DSA-1 白班 (单技能)',
  },
  {
    id: 'RULE-MG-DAY',
    name: 'MG 白班',
    shift: 'DAY',
    roomIds: ['R-MG1'],
    skillMatrix: { 'R-MG1': ['T-006'] },
    eligibleTechIds: [],
    maxConsecutiveDays: 5,
    balanceWeight: 0.6,
    enabled: true,
    description: 'MG-1 白班 (单技能)',
  },
  {
    id: 'RULE-WEEKEND',
    name: '周末班轮转',
    shift: 'WEEKEND',
    roomIds: ['R-CT1', 'R-DR1', 'R-MG1'],
    skillMatrix: { 'R-CT1': CT_TECHS, 'R-DR1': ['T-004'], 'R-MG1': ['T-006'] },
    eligibleTechIds: [],
    maxConsecutiveDays: 2,
    balanceWeight: 0.6,
    enabled: true,
    description: '周末上午半天: CT/DR/MG 各一间',
  },
  {
    id: 'RULE-BACKUP',
    name: '备班轮转',
    shift: 'BACKUP',
    roomIds: [],
    skillMatrix: {},
    eligibleTechIds: ['T-003', 'T-007', 'T-008'],
    maxConsecutiveDays: 3,
    balanceWeight: 0.6,
    enabled: true,
    description: '机动备班 (无固定房间), 跨组补位',
  },
]

/** 8 时段: 覆盖全天 24h (小时粒度聚合) */
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

/** 小时工作量曲线 (0-23 点): 白天高峰 09-17, 夜间低谷 */
const HOUR_CURVE = [0, 0, 0, 0, 0, 0, 1, 3, 7, 14, 19, 21, 19, 17, 15, 13, 11, 9, 7, 5, 4, 3, 1, 0]

/** 周季节性 (周日→周六): 周末略低, 周三/四最高 */
const WEEKDAY_FACTOR = [0.85, 0.95, 1.0, 1.05, 1.1, 1.15, 1.1]

/** 房间工作量系数 (双检间 CT-1 满负荷, CT-2 略低) */
const ROOM_FACTOR: Record<string, number> = {
  'R-CT1': 1.0,
  'R-CT2': 0.92,
  'R-MR1': 0.78,
  'R-DR1': 1.08,
  'R-DSA1': 0.48,
  'R-MG1': 0.44,
}

/** WMA 权重: 近 4 周同周几, 越近越重 */
const WMA_WEIGHTS = [0.4, 0.3, 0.2, 0.1]

// ==================== 确定性工具 (FNV-1a 哈希派生, 无 Math.random) ====================

function fnv1a(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性伪随机: 同 seedInput 恒同输出 */
function detRand(min: number, max: number, seedInput: string): number {
  let a = fnv1a(seedInput) >>> 0
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

function isoAgo(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() - offsetDays)
  return d.toISOString()
}

function round1(v: number): number {
  return Math.round(v)
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}

// ==================== 服务 ====================

@Injectable()
export class TechV2Service {
  private plans: RotationPlan[] = []
  private executions: RotationExecutionRecord[] = []

  constructor() {
    // 启动 seed: 本周确定性轮转计划 + 2 条执行记录 (孤儿模块回退, 无 DB 可用)
    const seedPlan = this.generatePlan({ startDate: todayStr(), days: 7 }, isoAgo(1))
    this.plans.push(seedPlan)
    const firstTwo = seedPlan.assignments.slice(0, 2)
    firstTwo.forEach((a, i) => {
      this.executions.push({
        id: `EX-SEED-${i + 1}`,
        planId: a.planId,
        assignmentId: a.id,
        date: a.date,
        shift: a.shift,
        technicianId: a.technicianId,
        technicianName: a.technicianName,
        roomId: a.roomId,
        status: 'EXECUTED',
        executedAt: isoAgo(i + 1),
        note: i === 0 ? '晨间双检间开机检查' : null,
      })
    })
  }

  // ==================== 名册 ====================

  getTechnicians(): TechV2Technician[] {
    return TECH_ROSTER.map((t) => ({ ...t }))
  }

  getRooms(): TechV2Room[] {
    return ROOMS.map((r) => ({ ...r }))
  }

  private techName(technicianId: string): string {
    return TECH_ROSTER.find((t) => t.id === technicianId)?.name ?? technicianId
  }

  // ==================== 轮转规则 ====================

  getRotationRules(): RotationRule[] {
    return ROTATION_RULES.map((r) => ({
      ...r,
      roomIds: [...r.roomIds],
      skillMatrix: Object.fromEntries(Object.entries(r.skillMatrix).map(([k, v]) => [k, [...v]])),
      eligibleTechIds: [...r.eligibleTechIds],
    }))
  }

  // ==================== 历史工作量 (小时粒度, 确定性派生) ====================

  /** 某房间某日某小时的历史工作量 (小时粒度种子) */
  private historicalHourValue(roomId: string, date: string, hour: number): number {
    const base = HOUR_CURVE[hour] ?? 0
    const roomFactor = ROOM_FACTOR[roomId] ?? 0.8
    const wdFactor = WEEKDAY_FACTOR[weekdayOf(date)] ?? 1
    const jitter = detRand(0.85, 1.15, `wv-hist:${roomId}:${date}:${hour}`)
    return round1(base * roomFactor * wdFactor * jitter)
  }

  /** 某房间某日某时段 (多小时聚合) 的历史工作量 */
  private historicalPeriodValue(roomId: string, date: string, hours: number[]): number {
    return hours.reduce((sum, h) => sum + this.historicalHourValue(roomId, date, h), 0)
  }

  // ==================== 预约趋势 + 季节性 ====================

  /** 预约量 (确定性: 周模式 + 月初波动) */
  private appointmentsOn(date: string): number {
    const wd = weekdayOf(date)
    const dayOfMonth = Number(date.slice(8, 10))
    return round1(110 + 4 * wd + 2 * (dayOfMonth % 4))
  }

  /** 趋势因子: 目标日预约量 / 同周几近 4 周平均 (限幅 0.85-1.3) */
  private trendFactor(date: string): number {
    const target = this.appointmentsOn(date)
    const history = [7, 14, 21, 28].map((off) => this.appointmentsOn(addDays(date, -off)))
    const avg = history.reduce((a, b) => a + b, 0) / history.length
    return clamp(avg > 0 ? target / avg : 1, 0.85, 1.3)
  }

  // ==================== 工作量预测 (WMA + 置信区间) ====================

  private forecastPeriodForRoom(roomId: string, date: string, periodIdx: number): ForecastPeriod {
    const period = PERIODS[periodIdx]!
    const history = [7, 14, 21, 28].map((off) => this.historicalPeriodValue(roomId, addDays(date, -off), period.hours))
    const wma = history.reduce((sum, v, i) => sum + v * (WMA_WEIGHTS[i] ?? 0), 0)
    const value = round1(wma * this.trendFactor(date))
    const mean = history.reduce((a, b) => a + b, 0) / history.length
    const variance = history.reduce((a, v) => a + (v - mean) * (v - mean), 0) / Math.max(1, history.length - 1)
    const ci = round1(Math.max(2, 1.96 * Math.sqrt(variance)))
    return {
      period: period.period,
      hourRange: `${period.hours[0]}-${period.hours[period.hours.length - 1]! + 1}`,
      value,
      lower: Math.max(0, value - ci),
      upper: value + ci,
    }
  }

  private roomPeriods(roomId: string, date: string): ForecastPeriod[] {
    return PERIODS.map((_, idx) => this.forecastPeriodForRoom(roomId, date, idx))
  }

  private roomDayValue(roomId: string, date: string): number {
    return round1(this.roomPeriods(roomId, date).reduce((s, p) => s + p.value, 0))
  }

  private roomCiSq(roomId: string, date: string): number {
    return this.roomPeriods(roomId, date).reduce((s, p) => s + (p.upper - p.value) * (p.upper - p.value), 0)
  }

  /** 未来 days 天每日 / 每时段预测 + 置信区间 (确定性) */
  forecast(params: { startDate?: string; days?: number; technicianId?: string } = {}): WorkloadForecast {
    const startDate = /^\d{4}-\d{2}-\d{2}$/.test(params.startDate ?? '') ? (params.startDate as string) : todayStr()
    const days = clamp(Math.round(params.days ?? 7) || 7, 1, 30)
    const daily: ForecastDay[] = []
    for (let d = 0; d < days; d++) {
      const date = addDays(startDate, d)
      const wd = weekdayOf(date)
      const periods: ForecastPeriod[] = PERIODS.map((_, idx) => {
        const values = ROOMS.map((room) => this.forecastPeriodForRoom(room.id, date, idx))
        const hours = PERIODS[idx]!.hours
        return {
          period: PERIODS[idx]!.period,
          hourRange: `${hours[0]}-${hours[hours.length - 1]! + 1}`,
          value: values.reduce((s, v) => s + v.value, 0),
          lower: values.reduce((s, v) => s + v.lower, 0),
          upper: values.reduce((s, v) => s + v.upper, 0),
        }
      })
      const value = periods.reduce((s, p) => s + p.value, 0)
      const ciSq = periods.reduce((s, p) => s + (p.upper - p.value) * (p.upper - p.value), 0)
      const ci = round1(Math.sqrt(ciSq))
      daily.push({
        date,
        weekday: WEEKDAYS[wd] ?? '',
        label: `${date.slice(5)} ${WEEKDAYS[wd] ?? ''}`,
        value,
        lower: Math.max(0, value - ci),
        upper: value + ci,
        appointments: this.appointmentsOn(date),
        trendFactor: round1(this.trendFactor(date) * 100) / 100,
        periods,
      })
    }
    const totals = daily.reduce(
      (acc, day) => ({
        value: acc.value + day.value,
        lower: acc.lower + day.lower,
        upper: acc.upper + day.upper,
      }),
      { value: 0, lower: 0, upper: 0 },
    )
    // 技师级别预测: 确定性份额 (每技师每日 share ∈ [0.5,1.5], 归一化至总和 1)
    const perTechnician: TechForecastItem[] = []
    for (let d = 0; d < days; d++) {
      const date = addDays(startDate, d)
      const dayTotal = daily[d]?.value ?? 0
      const weights = TECH_ROSTER.map((t) => ({ tech: t, w: detRand(0.5, 1.5, `wv-share:${t.id}:${date}`) }))
      const sumW = weights.reduce((s, x) => s + x.w, 0)
      weights.forEach((x) => {
        if (params.technicianId && x.tech.id !== params.technicianId) return
        const share = sumW > 0 ? x.w / sumW : 1 / TECH_ROSTER.length
        perTechnician.push({
          technicianId: x.tech.id,
          technicianName: x.tech.name,
          date,
          share: round1(share * 1000) / 1000,
          value: round1(dayTotal * share),
        })
      })
    }
    const byRoom: RoomForecastItem[] = []
    ROOMS.forEach((room) => {
      for (let d = 0; d < days; d++) {
        const date = addDays(startDate, d)
        byRoom.push({ roomId: room.id, roomName: room.name, date, value: this.roomDayValue(room.id, date) })
      }
    })
    // 近 7 天实际工作量 (历史, 确定性派生) — 供 实际 vs 预测 对照
    const history: Array<{ date: string; weekday: string; value: number }> = []
    for (let k = 7; k >= 1; k--) {
      const date = addDays(startDate, -k)
      history.push({ date, weekday: WEEKDAYS[weekdayOf(date)] ?? '', value: ROOMS.reduce((s, room) => s + this.roomDayValue(room.id, date), 0) })
    }
    return {
      startDate,
      days,
      model: 'wma-weekly:0.4/0.3/0.2/0.1 + appointment-trend + weekday-seasonality',
      seeded: true,
      daily,
      totals,
      perTechnician,
      byRoom,
      history,
    }
  }

  // ==================== 班次 → 时段映射 (轮转预测负载) ====================

  private shiftHours(shift: TechShift): number[] {
    switch (shift) {
      case 'DAY':
        return [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17]
      case 'NIGHT':
        return [18, 19, 20, 21, 22, 23, 0, 1, 2]
      case 'WEEKEND':
        return [6, 7, 8, 9, 10, 11]
      case 'BACKUP':
        return [0, 1, 2, 3, 4, 5, 6, 7]
    }
  }

  /** 该班次该房间的预测工作量 (作为分配负载) */
  private predictedLoadFor(shift: TechShift, roomId: string | null, date: string): number {
    if (!roomId) return 3
    const hours = this.shiftHours(shift)
    return hours.reduce((sum, h) => sum + this.historicalHourValue(roomId, date, h), 0)
  }

  // ==================== 轮转计划生成 (确定性贪心) ====================

  /**
   * 确定性贪心:
   * 1. 技能矩阵过滤 (候选必须能操作该房间)
   * 2. 房间约束 (单日单技师仅一个班次; 连续天数 ≤ maxConsecutiveDays; 请假跳过)
   * 3. 工作量均衡: score = 当前累计工作量 + 轮换公平罚分 (balanceWeight 控制权重)
   *    - balanceWeight = 1 → 纯最小累计工作量优先 (组内最大-最小差 ≤ 最大单次负载, 数学保证)
   *    - balanceWeight < 1 → 引入轻微轮换公平 (上次值班者略罚)
   * 4. 平手 → 名册顺序 (确定性)
   */
  generatePlan(dto: GenerateRotationDto, now?: string): RotationPlan {
    const startDate = String(dto.startDate ?? '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new BadRequestException('startDate 格式应为 YYYY-MM-DD')
    const days = Math.round(dto.days ?? 7) || 7
    if (days < 1 || days > 14) throw new BadRequestException('days 应为 1-14')
    const balanceWeight = dto.balanceWeight ?? 0.6
    if (balanceWeight < 0 || balanceWeight > 1) throw new BadRequestException('balanceWeight 应为 0-1')

    const planId = `ROT-${fnv1a(`${startDate}|${days}|${balanceWeight}`).toString(16).toUpperCase()}`
    const generatedAt = now ?? new Date().toISOString()
    const endDate = addDays(startDate, days - 1)

    // 累计工作量: 起始 = 确定性历史基础负载 (代表既往工作量)
    const accumulated = new Map<string, number>()
    TECH_ROSTER.forEach((t) => accumulated.set(t.id, round1(detRand(10, 26, `wv-base:${t.id}`))))
    const lastDate = new Map<string, string>()
    const consecutive = new Map<string, number>()
    const assignedToday = new Map<string, Set<string>>()

    const assignments: RotationAssignment[] = []
    const skipped: RotationPlan['skipped'] = []

    const isOnLeave = (techId: string, date: string): boolean => detRand(0, 1, `wv-leave:${techId}:${date}`) < 0.04

    for (let d = 0; d < days; d++) {
      const date = addDays(startDate, d)
      const wd = weekdayOf(date)
      const isWeekend = wd === 0 || wd === 6
      const shiftOrder: TechShift[] = isWeekend ? ['WEEKEND', 'NIGHT', 'BACKUP'] : ['DAY', 'NIGHT', 'BACKUP']
      assignedToday.set(date, new Set<string>())

      for (const shift of shiftOrder) {
        const rules = ROTATION_RULES.filter((r) => r.enabled && r.shift === shift)
        for (const rule of rules) {
          const roomIds = rule.roomIds.length > 0 ? rule.roomIds : ['']
          for (const roomId of roomIds) {
            const roomKey = roomId || 'backup'
            const candidates = TECH_ROSTER.filter((t) => {
              if (rule.roomIds.length > 0) {
                const skills = rule.skillMatrix[roomId] ?? []
                if (!skills.includes(t.id)) return false
              } else if (!rule.eligibleTechIds.includes(t.id)) {
                return false
              }
              if (assignedToday.get(date)?.has(t.id)) return false
              if (isOnLeave(t.id, date)) return false
              if ((consecutive.get(t.id) ?? 0) >= rule.maxConsecutiveDays) return false
              return true
            })
            if (candidates.length === 0) {
              skipped.push({ date, shift, roomId: roomKey === 'backup' ? null : roomId, reason: '无可用技师 (技能/请假/连续天数)' })
              continue
            }
            // score = 累计工作量 + 轮换公平罚分 (上次同班次值过班者小罚) + 平手名册序
            const recencyPenalty = round1(10 * (1 - balanceWeight))
            const scored = candidates.map((t) => {
              const acc = accumulated.get(t.id) ?? 0
              const last = lastDate.get(t.id) ?? ''
              const recency = last === addDays(date, -1) ? recencyPenalty : 0
              return { tech: t, score: acc + recency, acc }
            })
            scored.sort((a, b) => {
              if (a.score !== b.score) return a.score - b.score
              return TECH_ROSTER.findIndex((t) => t.id === a.tech.id) - TECH_ROSTER.findIndex((t) => t.id === b.tech.id)
            })
            const pick = scored[0]!
            const accBefore = pick.acc
            const predictedLoad = this.predictedLoadFor(shift, roomKey === 'backup' ? null : roomId, date)
            accumulated.set(pick.tech.id, accBefore + predictedLoad)
            lastDate.set(pick.tech.id, date)
            consecutive.set(pick.tech.id, (consecutive.get(pick.tech.id) ?? 0) + 1)
            assignedToday.get(date)?.add(pick.tech.id)
            const room = roomKey === 'backup' ? null : ROOMS.find((r) => r.id === roomId) ?? null
            assignments.push({
              id: `ASG-${fnv1a(`${planId}:${date}:${shift}:${roomKey}`).toString(16).toUpperCase()}`,
              planId,
              ruleId: rule.id,
              date,
              shift,
              roomId: room?.id ?? null,
              roomName: room?.name ?? null,
              technicianId: pick.tech.id,
              technicianName: pick.tech.name,
              accumulatedBefore: accBefore,
              predictedLoad,
              reason: `最小累计工作量优先 (${accBefore} → ${accBefore + predictedLoad})`,
            })
          }
        }
      }
      // 跨天: 非连续值班者重置连续计数
      TECH_ROSTER.forEach((t) => {
        const last = lastDate.get(t.id) ?? ''
        if (last && last !== date) consecutive.set(t.id, 0)
      })
    }

    const balance = this.computeBalance(accumulated, assignments)
    const plan: RotationPlan = { id: planId, generatedAt, startDate, endDate, days, balanceWeight, assignments, skipped, balance, seeded: true }
    const idx = this.plans.findIndex((p) => p.id === planId)
    if (idx >= 0) this.plans[idx] = plan
    else this.plans.push(plan)
    return plan
  }

  // ==================== 工作量均衡指标 ====================

  /**
   * 组内均衡: 同一技能池 (轮转组) 内 最大-最小工作量差 ≤ 阈值
   * (贪心最小累计优先 + 公平罚分保证组内差 ≤ 最大单次负载 + 罚分 + 请假余量;
   *   单技能组无调度自由度, 恒为 0, 恒达标)
   */
  computeBalance(accumulated: Map<string, number>, assignments: RotationAssignment[]): WorkloadBalance {
    const planLoad = new Map<string, number>()
    const nights = new Map<string, number>()
    const count = new Map<string, number>()
    assignments.forEach((a) => {
      planLoad.set(a.technicianId, (planLoad.get(a.technicianId) ?? 0) + a.predictedLoad)
      count.set(a.technicianId, (count.get(a.technicianId) ?? 0) + 1)
      if (a.shift === 'NIGHT') nights.set(a.technicianId, (nights.get(a.technicianId) ?? 0) + 1)
    })
    const perTechnician = TECH_ROSTER.map((t) => {
      const baseLoad = round1(detRand(10, 26, `wv-base:${t.id}`))
      const pl = planLoad.get(t.id) ?? 0
      return {
        technicianId: t.id,
        technicianName: t.name,
        baseLoad,
        planLoad: pl,
        cumulativeLoad: baseLoad + pl,
        assignmentCount: count.get(t.id) ?? 0,
        nights: nights.get(t.id) ?? 0,
      }
    })

    // 轮转组: 多技能池 (调度器有自由度, 均衡才有意义) + 单技能组 (自由度 0)
    const groupDefs: Array<{ groupId: string; groupName: string; technicianIds: string[] }> = [
      { groupId: 'GROUP-CT', groupName: 'CT 组', technicianIds: CT_TECHS },
      { groupId: 'GROUP-MR', groupName: 'MR 组', technicianIds: MR_TECHS },
      { groupId: 'GROUP-DR', groupName: 'DR', technicianIds: ['T-004'] },
      { groupId: 'GROUP-DSA', groupName: 'DSA', technicianIds: ['T-005'] },
      { groupId: 'GROUP-MG', groupName: 'MG', technicianIds: ['T-006'] },
    ]
    const maxSingleLoad = Math.max(...assignments.map((a) => a.predictedLoad), 0)
    const groups: RotationGroupBalance[] = groupDefs.map((g) => {
      const loads = g.technicianIds.map((id) => ({ technicianId: id, technicianName: this.techName(id), load: planLoad.get(id) ?? 0 }))
      const values = loads.map((l) => l.load)
      const maxLoad = values.length > 0 ? Math.max(...values) : 0
      const minLoad = values.length > 0 ? Math.min(...values) : 0
      return { groupId: g.groupId, groupName: g.groupName, technicianIds: [...g.technicianIds], loads, maxMinDiff: maxLoad - minLoad }
    })
    const maxMinDiff = Math.max(...groups.map((g) => g.maxMinDiff), 0)
    // 每组合阈值: 组均负载 × 0.5 + 最大单次负载 × 0.9 (含请假跳档余量)
    const groupThresholds = groups.map((g) => {
      const avg = g.loads.reduce((s, l) => s + l.load, 0) / Math.max(1, g.loads.length)
      return Math.max(8, Math.round(avg * 0.5 + maxSingleLoad * 0.9))
    })
    const threshold = Math.max(...groupThresholds, 8)
    return {
      perTechnician,
      groups,
      maxMinDiff,
      threshold,
      balanced: groups.every((g, i) => g.maxMinDiff <= (groupThresholds[i] ?? 8)),
      seeded: true,
    }
  }

  /** 供前端条形图使用的累计工作量均衡视图 */
  getWorkloadBalance(): WorkloadBalance {
    const latest = [...this.plans].sort((a, b) => b.startDate.localeCompare(a.startDate))[0]
    if (!latest) {
      const plan = this.generatePlan({ startDate: todayStr(), days: 7 }, isoAgo(1))
      return plan.balance
    }
    return this.computeBalance(
      new Map(latest.assignments.map((a) => [a.technicianId, a.accumulatedBefore])),
      latest.assignments,
    )
  }

  // ==================== 轮转计划查询 ====================

  getRotationPlan(params: { startDate?: string; days?: string }): RotationPlan {
    if (params.startDate) {
      const startDate = String(params.startDate ?? '').trim()
      if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) throw new BadRequestException('startDate 格式应为 YYYY-MM-DD')
      const days = Math.round(Number(params.days) || 7)
      const planId = `ROT-${fnv1a(`${startDate}|${days}|0.6`).toString(16).toUpperCase()}`
      const hit = this.plans.find((p) => p.id === planId)
      if (hit) return hit
      return this.generatePlan({ startDate, days })
    }
    const latest = [...this.plans].sort((a, b) => b.startDate.localeCompare(a.startDate) || b.generatedAt.localeCompare(a.generatedAt))[0]
    if (!latest) return this.generatePlan({ startDate: todayStr(), days: 7 }, isoAgo(1))
    return latest
  }

  getRotationHistory(): RotationHistory {
    return {
      plans: [...this.plans]
        .sort((a, b) => b.startDate.localeCompare(a.startDate) || b.generatedAt.localeCompare(a.generatedAt))
        .map((p) => ({
          id: p.id,
          generatedAt: p.generatedAt,
          startDate: p.startDate,
          endDate: p.endDate,
          days: p.days,
          assignmentsCount: p.assignments.length,
          executedCount: this.executions.filter((e) => e.planId === p.id).length,
          balance: p.balance,
        })),
      executions: [...this.executions].sort((a, b) => b.executedAt.localeCompare(a.executedAt)),
    }
  }

  // ==================== 轮转执行记录 ====================

  executeAssignment(assignmentId: string, dto: { note?: string } = {}): RotationExecutionRecord {
    const existing = this.executions.find((e) => e.assignmentId === assignmentId)
    if (existing) return existing
    // 跨所有计划查找该排班 (executeAssignment 不应只限定最新计划)
    let assignment: RotationAssignment | undefined
    let plan: RotationPlan | undefined
    for (const p of [...this.plans].sort((a, b) => b.startDate.localeCompare(a.startDate))) {
      const found = p.assignments.find((a) => a.id === assignmentId)
      if (found) {
        assignment = found
        plan = p
        break
      }
    }
    if (!assignment || !plan) throw new NotFoundException(`轮转排班 ${assignmentId} 不存在`)
    const record: RotationExecutionRecord = {
      id: `EX-${fnv1a(`${assignmentId}`).toString(16).toUpperCase()}`,
      planId: assignment.planId,
      assignmentId,
      date: assignment.date,
      shift: assignment.shift,
      technicianId: assignment.technicianId,
      technicianName: assignment.technicianName,
      roomId: assignment.roomId,
      status: 'EXECUTED',
      executedAt: new Date().toISOString(),
      note: dto.note ?? null,
    }
    this.executions.push(record)
    return record
  }
}
