/**
 * [G005 W11-DeviceOps] 设备运维中心领域类型 + 纯逻辑 (可直接单测).
 * 覆盖:
 *   1) 设备工单状态机 (maintenance/fault) + SLA
 *   2) 校准/认证到期判定
 *   3) 资产折旧 (直线法/双倍余额递减法)
 *   4) OEE = 可用率 × 性能 × 质量 (由真实停机事件 + 检查计数推导) + 损失分解
 *   5) 成本核算 (直接/间接) + DRG 分组桩 + 毛利分析
 */

// ============================== 1. 工单状态机 ==============================

export type WorkOrderKind = 'maintenance' | 'fault'
export type WorkOrderStatus =
  | 'new'
  | 'open'
  | 'assigned'
  | 'in_progress'
  | 'waiting_parts'
  | 'completed'
  | 'closed'
export type WorkOrderPriority = 'critical' | 'high' | 'medium' | 'low'

export const WORK_ORDER_KINDS: readonly WorkOrderKind[] = ['maintenance', 'fault']

export const WORK_ORDER_STATUSES: readonly WorkOrderStatus[] = [
  'new',
  'open',
  'assigned',
  'in_progress',
  'waiting_parts',
  'completed',
  'closed',
]

/** 状态机允许的转移 (单向为主, 支持合理的回退/重开) */
export const WORK_ORDER_TRANSITIONS: Record<WorkOrderStatus, readonly WorkOrderStatus[]> = {
  new: ['open', 'assigned', 'closed'],
  open: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'waiting_parts', 'open', 'closed'],
  in_progress: ['waiting_parts', 'completed', 'assigned', 'closed'],
  waiting_parts: ['in_progress', 'completed', 'closed'],
  completed: ['closed', 'in_progress'],
  closed: ['open'],
}

export function canTransitionWorkOrder(from: WorkOrderStatus, to: WorkOrderStatus): boolean {
  if (from === to) return false
  return (WORK_ORDER_TRANSITIONS[from] ?? []).includes(to)
}

export function nextWorkOrderStatuses(from: WorkOrderStatus): WorkOrderStatus[] {
  return [...(WORK_ORDER_TRANSITIONS[from] ?? [])]
}

export function isWorkOrderTerminal(status: WorkOrderStatus): boolean {
  return status === 'closed'
}

export function isWorkOrderActive(status: WorkOrderStatus): boolean {
  return status !== 'completed' && status !== 'closed'
}

/** SLA 目标响应时长 (小时), 按优先级 + 工单类型 */
const SLA_HOURS: Record<WorkOrderPriority, number> = { critical: 4, high: 8, medium: 24, low: 72 }

export function workOrderSlaHours(priority: WorkOrderPriority, kind: WorkOrderKind): number {
  const base = SLA_HOURS[priority] ?? 24
  // 故障工单比计划保养更紧急, 折半
  return kind === 'fault' ? Math.max(1, Math.round(base / 2)) : base
}

export function computeWorkOrderSla(
  priority: WorkOrderPriority,
  kind: WorkOrderKind,
  createdAtIso: string,
): { slaHours: number; dueAt: string } {
  const created = new Date(createdAtIso)
  const hours = workOrderSlaHours(priority, kind)
  const due = new Date(created.getTime() + hours * 3600000)
  return { slaHours: hours, dueAt: due.toISOString() }
}

export type WorkOrderSlaState = 'on_track' | 'at_risk' | 'breached' | 'met'

export function workOrderSlaState(
  dueAtIso: string,
  nowIso: string,
  completedAtIso?: string | null,
): WorkOrderSlaState {
  const due = new Date(dueAtIso).getTime()
  if (completedAtIso) {
    return new Date(completedAtIso).getTime() <= due ? 'met' : 'breached'
  }
  const now = new Date(nowIso).getTime()
  if (now > due) return 'breached'
  // 剩余不足 1 小时视为风险
  const remaining = due - now
  return remaining <= 3600000 ? 'at_risk' : 'on_track'
}

// ============================== 2. 校准 / 认证 ==============================

export type CalibrationKind = 'calibration' | 'certification'
export type CalibrationResult = 'pass' | 'fail' | 'pending'

export function calibrationDueState(
  nextDueIso: string | null | undefined,
  nowIso: string,
  warnDays = 30,
): 'overdue' | 'due_soon' | 'valid' | 'none' {
  if (!nextDueIso) return 'none'
  const next = new Date(nextDueIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(next)) return 'none'
  if (next < now) return 'overdue'
  if (next - now <= warnDays * 86400000) return 'due_soon'
  return 'valid'
}

export function daysUntil(targetIso: string, nowIso: string): number {
  const target = new Date(targetIso).getTime()
  const now = new Date(nowIso).getTime()
  if (!Number.isFinite(target)) return 0
  return Math.ceil((target - now) / 86400000)
}

// ============================== 3. 资产折旧 ==============================

export type DepreciationMethod = 'straight-line' | 'declining'

export interface DepreciationInput {
  cost: number
  /** 残值率 0..1 (默认 0.05) */
  salvageRate?: number
  /** 使用年限 (月) */
  usefulLifeMonths: number
  method: DepreciationMethod
  /** 启用月份 YYYY-MM 或 ISO 日期 */
  startDate: string
  /** 截止月份 YYYY-MM 或 ISO 日期 (默认当月) */
  asOf?: string
}

export interface DepreciationPoint {
  month: string
  openingValue: number
  depreciation: number
  accumulated: number
  closingValue: number
}

export interface DepreciationResult {
  method: DepreciationMethod
  cost: number
  residualValue: number
  usefulLifeMonths: number
  /** 直线法月折旧额; 递减法为第 1 月折旧额 */
  firstMonthDepreciation: number
  accumulatedDepreciation: number
  currentBookValue: number
  monthlyRatePct: number
  schedule: DepreciationPoint[]
}

function monthKey(value: string): string {
  return value.slice(0, 7)
}

function addMonths(key: string, months: number): string {
  const [y, m] = key.split('-').map(Number)
  const year = y ?? 1970
  const month = m ?? 1
  const total = year * 12 + (month - 1) + months
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  return `${ny}-${String(nm).padStart(2, '0')}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * 生成折旧计划。直线法按 (成本-残值)/年限 等额; 双倍余额递减法按月 2/年限 计提,
 * 且账面价值不低于残值 (最后自动切换为剩余可折旧额)。
 */
export function computeDepreciation(input: DepreciationInput): DepreciationResult {
  const cost = Math.max(0, input.cost)
  const salvageRate = input.salvageRate ?? 0.05
  const residual = round2(cost * salvageRate)
  const life = Math.max(1, Math.floor(input.usefulLifeMonths))
  const start = monthKey(input.startDate)
  const asOf = monthKey(input.asOf ?? new Date().toISOString())
  const depreciable = Math.max(0, cost - residual)
  const schedule: DepreciationPoint[] = []

  let opening = cost
  let accumulated = 0
  let firstMonthDepreciation = 0
  for (let i = 0; i < life; i++) {
    const month = addMonths(start, i)
    if (month > asOf) break
    let dep: number
    if (input.method === 'straight-line') {
      dep = round2(depreciable / life)
    } else {
      dep = round2((opening * 2) / life)
    }
    // 不超过剩余可折旧额 (不低于残值)
    const remaining = round2(cost - residual - accumulated)
    if (dep > remaining) dep = round2(remaining)
    if (dep < 0) dep = 0
    if (i === 0) firstMonthDepreciation = dep
    accumulated = round2(accumulated + dep)
    const closing = round2(opening - dep)
    schedule.push({ month, openingValue: round2(opening), depreciation: dep, accumulated, closingValue: closing })
    opening = closing
  }

  return {
    method: input.method,
    cost: round2(cost),
    residualValue: residual,
    usefulLifeMonths: life,
    firstMonthDepreciation,
    accumulatedDepreciation: round2(accumulated),
    currentBookValue: round2(cost - accumulated),
    monthlyRatePct: round2((100 / life)),
    schedule,
  }
}

/** 当前净值 (不生成完整计划, 轻量) */
export function currentBookValue(input: DepreciationInput): number {
  return computeDepreciation(input).currentBookValue
}

// ============================== 4. OEE + 停机损失 ==============================

export type DowntimeCategory = 'planned' | 'unplanned' | 'changeover' | 'idle' | 'small-stop'

export interface DowntimeEventInput {
  reason: DowntimeCategory
  minutes: number
  workOrderId?: string
  note?: string
}

export interface OeeInput {
  /** 计划生产时间 (分钟) */
  plannedProductionMinutes: number
  downtimeEvents: DowntimeEventInput[]
  /** 理论单件节拍 (分钟/件) */
  idealCycleMinutes: number
  totalCount: number
  goodCount: number
}

export interface OeeLossBreakdown {
  planned: number
  unplanned: number
  changeover: number
  idle: number
  smallStop: number
  total: number
}

export interface OeeResult {
  availability: number
  performance: number
  quality: number
  oee: number
  plannedProductionMinutes: number
  downtimeMinutes: number
  runtimeMinutes: number
  totalCount: number
  goodCount: number
  scrapCount: number
  loss: OeeLossBreakdown
  /** 各损失类别占总损失比例 (%) */
  lossPercent: Record<DowntimeCategory, number>
  source: 'actual' | 'derived'
}

function clampPct(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, round2(n)))
}

/**
 * OEE = 可用率 × 性能 × 质量。
 *  - 可用率 = 运行时间 / 计划生产时间, 运行时间 = 计划 - 实际停机 (planned+unplanned+changeover+idle)
 *  - 性能   = (理论节拍 × 产量) / 运行时间
 *  - 质量   = 合格数 / 总产量
 * small-stop 计入性能损失 (不扣可用率), 但仍列入损失分解。
 */
export function computeOee(input: OeeInput): OeeResult {
  const planned = Math.max(1, input.plannedProductionMinutes)
  const loss: OeeLossBreakdown = { planned: 0, unplanned: 0, changeover: 0, idle: 0, smallStop: 0, total: 0 }
  for (const ev of input.downtimeEvents) {
    const minutes = Math.max(0, ev.minutes)
    if (ev.reason === 'small-stop') loss.smallStop += minutes
    else loss[ev.reason] += minutes
    loss.total += minutes
  }
  const availabilityDowntime = loss.planned + loss.unplanned + loss.changeover + loss.idle
  const runtime = Math.max(0, planned - availabilityDowntime)
  const availability = clampPct((runtime / planned) * 100)
  const totalCount = Math.max(0, Math.floor(input.totalCount))
  const goodCount = Math.max(0, Math.min(totalCount, Math.floor(input.goodCount)))
  const scrapCount = totalCount - goodCount
  const performance = runtime > 0
    ? clampPct(((input.idealCycleMinutes * totalCount) / runtime) * 100)
    : 0
  const quality = totalCount > 0 ? clampPct((goodCount / totalCount) * 100) : 100
  const oee = round2((availability * performance * quality) / 10000)

  const totalLoss = Math.max(1, loss.total)
  const lossPercent: Record<DowntimeCategory, number> = {
    planned: round2((loss.planned / totalLoss) * 100),
    unplanned: round2((loss.unplanned / totalLoss) * 100),
    changeover: round2((loss.changeover / totalLoss) * 100),
    idle: round2((loss.idle / totalLoss) * 100),
    'small-stop': round2((loss.smallStop / totalLoss) * 100),
  }

  return {
    availability,
    performance,
    quality,
    oee,
    plannedProductionMinutes: planned,
    downtimeMinutes: round2(loss.total),
    runtimeMinutes: round2(runtime),
    totalCount,
    goodCount,
    scrapCount,
    loss: {
      planned: round2(loss.planned),
      unplanned: round2(loss.unplanned),
      changeover: round2(loss.changeover),
      idle: round2(loss.idle),
      smallStop: round2(loss.smallStop),
      total: round2(loss.total),
    },
    lossPercent,
    source: 'actual',
  }
}

/** 由维度事件聚合为 OEE 输入 (单设备) */
export function summarizeDowntime(events: DowntimeEventInput[]): OeeLossBreakdown {
  const loss: OeeLossBreakdown = { planned: 0, unplanned: 0, changeover: 0, idle: 0, smallStop: 0, total: 0 }
  for (const ev of events) {
    const minutes = Math.max(0, ev.minutes)
    if (ev.reason === 'small-stop') loss.smallStop += minutes
    else loss[ev.reason] += minutes
    loss.total += minutes
  }
  return {
    planned: round2(loss.planned),
    unplanned: round2(loss.unplanned),
    changeover: round2(loss.changeover),
    idle: round2(loss.idle),
    smallStop: round2(loss.smallStop),
    total: round2(loss.total),
  }
}

// ============================== 5. 成本核算 + DRG ==============================

export interface ExamCostBreakdown {
  consumables: number
  contrast: number
  labor: number
  depreciation: number
  overhead: number
}

export const COST_CATEGORIES: readonly (keyof ExamCostBreakdown)[] = [
  'consumables',
  'contrast',
  'labor',
  'depreciation',
  'overhead',
]

export function sumCost(b: Partial<ExamCostBreakdown>): number {
  return round2(COST_CATEGORIES.reduce((s, k) => s + (b[k] ?? 0), 0))
}

export interface MarginResult {
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

export function computeMargin(revenue: number, cost: number): MarginResult {
  const margin = round2(revenue - cost)
  return {
    revenue: round2(revenue),
    cost: round2(cost),
    margin,
    marginPct: revenue > 0 ? round2((margin / revenue) * 100) : 0,
  }
}

/** DRG 分组桩: 按主诊断编码前缀映射到 MDC + 权重 */
export interface DrgGroup {
  code: string
  name: string
  mdc: string
  weight: number
}

export const DRG_CATALOG: ReadonlyArray<DrgGroup> = [
  { code: 'FM19', name: '经皮冠脉支架植入', mdc: 'MDC-F', weight: 3.42 },
  { code: 'BR23', name: '脑缺血性疾患', mdc: 'MDC-B', weight: 1.28 },
  { code: 'ES31', name: '呼吸系统感染/炎症', mdc: 'MDC-E', weight: 0.92 },
  { code: 'GK29', name: '消化系统恶性肿瘤', mdc: 'MDC-G', weight: 2.15 },
  { code: 'IR15', name: '骨骼肌肉系统手术', mdc: 'MDC-I', weight: 1.76 },
  { code: 'NR20', name: '神经系统其他疾患', mdc: 'MDC-N', weight: 1.05 },
]

/** 极简 DRG 分组桩: 主诊断 ICD 首字母 → 目录; 未知回退通用组 */
export function groupDrg(principalDiagnosisCode: string): DrgGroup {
  const prefix = (principalDiagnosisCode ?? '').toUpperCase().charAt(0)
  const byPrefix: Record<string, string> = { I: 'FM19', G: 'BR23', J: 'ES31', C: 'GK29', M: 'IR15', N: 'NR20' }
  const code = byPrefix[prefix]
  const found = code ? DRG_CATALOG.find((g) => g.code === code) : undefined
  return found ?? { code: 'ZZ01', name: '未入组 (通用)', mdc: 'MDC-Z', weight: 0.75 }
}

export function drgPayment(weight: number, baseRate: number): number {
  return round2(weight * baseRate)
}

// ============================== 6. 定时报表 ==============================

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual'

/** 依据频率/时间计算下一次运行时刻 (确定性, 不依赖真实 cron 解析器) */
export function nextRunAt(frequency: ScheduleFrequency, timeOfDay: string, fromIso: string): string | null {
  if (frequency === 'manual') return null
  const from = new Date(fromIso)
  if (!Number.isFinite(from.getTime())) return null
  const [hh, mm] = timeOfDay.split(':').map(Number)
  const hour = Number.isFinite(hh) ? hh ?? 0 : 0
  const minute = Number.isFinite(mm) ? mm ?? 0 : 0
  const next = new Date(from)
  next.setHours(hour, minute, 0, 0)
  if (next.getTime() <= from.getTime()) {
    if (frequency === 'daily') next.setDate(next.getDate() + 1)
    else if (frequency === 'weekly') next.setDate(next.getDate() + 7)
    else next.setMonth(next.getMonth() + 1)
  } else if (frequency === 'weekly' && next.getTime() - from.getTime() > 7 * 86400000) {
    next.setDate(next.getDate() - 7)
  }
  return next.toISOString()
}
