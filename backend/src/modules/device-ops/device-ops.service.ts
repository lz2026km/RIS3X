/**
 * [G005 W11-DeviceOps] 设备运维中心服务 (内存 + @Optional Prisma, 无 DB 可启动).
 *   工单状态机 / 校准认证 / 资产折旧 / OEE(真实停机事件) / 成本核算 + DRG / 定时 BI 报表
 */
import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import {
  canTransitionWorkOrder,
  computeDepreciation,
  computeMargin,
  computeOee,
  computeWorkOrderSla,
  calibrationDueState,
  daysUntil,
  drgPayment,
  groupDrg,
  nextRunAt,
  nextWorkOrderStatuses,
  summarizeDowntime,
  sumCost,
  workOrderSlaState,
  type CalibrationKind,
  type CalibrationResult,
  type DepreciationInput,
  type DepreciationMethod,
  type DepreciationResult,
  type DowntimeCategory,
  type ExamCostBreakdown,
  type MarginResult,
  type OeeResult,
  type ScheduleFrequency,
  type WorkOrderKind,
  type WorkOrderPriority,
  type WorkOrderSlaState,
  type WorkOrderStatus,
} from './device-ops.types'
import {
  DEVICES,
  SEED_ASSETS,
  SEED_CALIBRATIONS,
  SEED_COST_ROWS,
  SEED_DOWNTIME,
  SEED_DRG_ROWS,
  SEED_PRODUCTION,
  SEED_REPORT_DEFINITIONS,
  SEED_REPORT_INSTANCES,
  SEED_WORK_ORDERS,
  anchorOffset,
  type SeedAsset,
  type SeedCalibration,
  type SeedDowntime,
  type SeedPart,
  type SeedReportDefinition,
  type SeedReportInstance,
  type SeedWorkOrder,
} from './device-ops.data'

export interface WorkOrderTimelineEvent {
  at: string
  status: WorkOrderStatus | 'created'
  operator: string
  note?: string
}

export interface WorkOrderDto extends SeedWorkOrder {
  slaHours: number
  dueAt: string
  slaState: WorkOrderSlaState
  isActive: boolean
  totalPartsCost: number
  nextStatuses: WorkOrderStatus[]
  timeline: WorkOrderTimelineEvent[]
}

export interface WorkOrderStats {
  total: number
  active: number
  byStatus: Record<string, number>
  byKind: Record<string, number>
  byPriority: Record<string, number>
  overdue: number
  breached: number
  avgResolutionHours: number
  partsCost: number
  slaCompliancePct: number
}

export interface CalibrationDto extends SeedCalibration {
  dueState: 'overdue' | 'due_soon' | 'valid' | 'none'
  daysRemaining: number
}

export interface CalibrationStats {
  total: number
  byKind: Record<string, number>
  byResult: Record<string, number>
  overdue: number
  dueSoon: number
  failureRatePct: number
}

export interface AssetDto extends SeedAsset {
  bookValue: number
  accumulatedDepreciation: number
  residualValue: number
  warrantyDaysRemaining: number
  depreciationMethod: DepreciationMethod
  retirementStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'scrapped'
}

export interface RetirementApproval {
  id: string
  assetId: string
  deviceName: string
  type: 'retire' | 'scrap'
  reason: string
  requestedBy: string
  requestedAt: string
  status: 'pending' | 'approved' | 'rejected'
  approvedBy?: string
  approvedAt?: string
  approvedByRole?: string
  scrapValue?: number
}

export interface AssetStats {
  totalAssets: number
  totalProcurementCost: number
  totalBookValue: number
  totalAccumulated: number
  byStatus: Record<string, number>
  byMethod: Record<string, number>
  warrantyExpiring: number
  pendingRetirements: number
}

export interface OeeLossDto {
  deviceId: string
  deviceName: string
  modality: string
  date: string
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
  loss: OeeResult['loss']
  lossPercent: Record<DowntimeCategory, number>
  workOrderIds: string[]
  source: 'actual' | 'derived'
}

export interface CostByModalityRow {
  modality: string
  volume: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
  unitCost: number
  breakdown: ExamCostBreakdown
}

export interface DrgRowMargin {
  drgCode: string
  name: string
  mdc: string
  weight: number
  cases: number
  totalWeight: number
  payment: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
}

export interface ReportDeliveryLogEntry {
  recipient: string
  channel: string
  status: 'sent' | 'failed'
  at: string
}

export interface ReportInstanceDto extends SeedReportInstance {
  createdAt: string
}

const DEFAULT_BASE_RATE = 12000
const WORK_ORDER_SEQ_START = 1100
const CALIBRATION_SEQ_START = 2100
const ASSET_SEQ_START = 3100
const REPORT_SEQ_START = 4100
const INSTANCE_SEQ_START = 5100

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function hoursBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime()
  const b = new Date(bIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0
  return round2((b - a) / 3600000)
}

@Injectable()
export class DeviceOpsService {
  // 内存数据 (确定性种子)
  private workOrders: SeedWorkOrder[] = []
  private timelines = new Map<string, WorkOrderTimelineEvent[]>()
  private calibrations: SeedCalibration[] = []
  private assets: SeedAsset[] = []
  private retirements: RetirementApproval[] = []
  private downtime: SeedDowntime[] = []
  private reportDefs: SeedReportDefinition[] = []
  private reportInstances: SeedReportInstance[] = []
  private woSeq = WORK_ORDER_SEQ_START
  private calSeq = CALIBRATION_SEQ_START
  private assetSeq = ASSET_SEQ_START
  private reportSeq = REPORT_SEQ_START
  private instanceSeq = INSTANCE_SEQ_START

  constructor(@Optional() private readonly prisma?: PrismaService) {
    void this.prisma
    this.reset()
  }

  /** 重新载入确定性种子 (供测试隔离) */
  reset(): void {
    this.workOrders = deepCopy(SEED_WORK_ORDERS)
    this.calibrations = deepCopy(SEED_CALIBRATIONS)
    this.assets = deepCopy(SEED_ASSETS)
    this.downtime = deepCopy(SEED_DOWNTIME)
    this.reportDefs = deepCopy(SEED_REPORT_DEFINITIONS)
    this.reportInstances = deepCopy(SEED_REPORT_INSTANCES)
    this.retirements = []
    this.woSeq = WORK_ORDER_SEQ_START
    this.calSeq = CALIBRATION_SEQ_START
    this.assetSeq = ASSET_SEQ_START
    this.reportSeq = REPORT_SEQ_START
    this.instanceSeq = INSTANCE_SEQ_START
    this.timelines.clear()
    for (const wo of this.workOrders) this.timelines.set(wo.id, this.buildSeedTimeline(wo))
  }

  private buildSeedTimeline(wo: SeedWorkOrder): WorkOrderTimelineEvent[] {
    const events: WorkOrderTimelineEvent[] = [
      { at: wo.createdAt, status: 'created', operator: '系统', note: wo.source === 'fault-report' ? '故障上报' : '计划创建' },
    ]
    if (wo.status === 'new') return events
    if (wo.assignee) events.push({ at: wo.updatedAt, status: 'assigned', operator: '调度', note: `指派 ${wo.assignee}` })
    if (wo.startedAt) events.push({ at: wo.startedAt, status: 'in_progress', operator: wo.assignee || '工程师' })
    if (wo.status === 'waiting_parts') events.push({ at: wo.updatedAt, status: 'waiting_parts', operator: wo.assignee || '工程师', note: '等待备件' })
    if (wo.completedAt) events.push({ at: wo.completedAt, status: 'completed', operator: wo.assignee || '工程师' })
    if (wo.closedAt) events.push({ at: wo.closedAt, status: 'closed', operator: '调度' })
    if (wo.status === 'open') {
      events.push({ at: wo.updatedAt, status: 'open', operator: '调度' })
    }
    return events.sort((a, b) => a.at.localeCompare(b.at))
  }

  // ============================== 工单 ==============================

  private toWorkOrderDto(wo: SeedWorkOrder, nowIso: string): WorkOrderDto {
    const { slaHours, dueAt } = computeWorkOrderSla(wo.priority, wo.kind, wo.createdAt)
    const slaState = workOrderSlaState(dueAt, nowIso, wo.completedAt ?? null)
    return {
      ...wo,
      slaHours,
      dueAt,
      slaState,
      isActive: wo.status !== 'completed' && wo.status !== 'closed',
      totalPartsCost: round2(wo.parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)),
      nextStatuses: nextWorkOrderStatuses(wo.status),
      timeline: deepCopy(this.timelines.get(wo.id) ?? []),
    }
  }

  listWorkOrders(filter: {
    status?: string
    kind?: string
    priority?: string
    deviceId?: string
    assignee?: string
    now?: string
  } = {}): { items: WorkOrderDto[]; total: number } {
    const now = filter.now ?? new Date().toISOString()
    let rows = this.workOrders
    if (filter.status) rows = rows.filter((w) => w.status === filter.status)
    if (filter.kind) rows = rows.filter((w) => w.kind === filter.kind)
    if (filter.priority) rows = rows.filter((w) => w.priority === filter.priority)
    if (filter.deviceId) rows = rows.filter((w) => w.deviceId === filter.deviceId)
    if (filter.assignee) rows = rows.filter((w) => w.assignee === filter.assignee)
    const items = rows
      .map((w) => this.toWorkOrderDto(w, now))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return { items, total: items.length }
  }

  getWorkOrder(id: string, now = new Date().toISOString()): WorkOrderDto {
    const wo = this.workOrders.find((w) => w.id === id)
    if (!wo) throw new NotFoundException(`工单 ${id} 不存在`)
    return this.toWorkOrderDto(wo, now)
  }

  createWorkOrder(input: Partial<SeedWorkOrder> & { kind: WorkOrderKind; title: string; deviceId: string }): WorkOrderDto {
    if (!input.title?.trim()) throw new BadRequestException('title 不能为空')
    if (!input.deviceId?.trim()) throw new BadRequestException('deviceId 不能为空')
    const device = DEVICES.find((d) => d.id === input.deviceId)
    this.woSeq += 1
    const now = new Date().toISOString()
    const wo: SeedWorkOrder = {
      id: `WO-${this.woSeq}`,
      kind: input.kind ?? 'maintenance',
      title: input.title.trim(),
      deviceId: input.deviceId,
      deviceName: input.deviceName?.trim() || device?.name || input.deviceId,
      priority: input.priority ?? 'medium',
      status: input.status ?? 'new',
      assignee: input.assignee?.trim() || '',
      parts: input.parts ? deepCopy(input.parts) : [],
      createdAt: now,
      updatedAt: now,
      description: input.description?.trim() || '',
      source: input.source ?? 'manual',
    }
    this.workOrders.unshift(wo)
    this.timelines.set(wo.id, [{ at: now, status: 'created', operator: '当前用户', note: '工单已创建' }])
    return this.toWorkOrderDto(wo, now)
  }

  updateWorkOrder(id: string, body: Partial<SeedWorkOrder>): WorkOrderDto {
    const wo = this.workOrders.find((w) => w.id === id)
    if (!wo) throw new NotFoundException(`工单 ${id} 不存在`)
    if (body.title !== undefined) wo.title = body.title
    if (body.description !== undefined) wo.description = body.description
    if (body.priority !== undefined) wo.priority = body.priority as WorkOrderPriority
    if (body.assignee !== undefined) wo.assignee = body.assignee
    if (body.parts !== undefined) wo.parts = deepCopy(body.parts)
    wo.updatedAt = new Date().toISOString()
    return this.toWorkOrderDto(wo, wo.updatedAt)
  }

  advanceWorkOrder(
    id: string,
    input: { to: WorkOrderStatus; assignee?: string; parts?: SeedPart[]; note?: string; operator?: string },
    now = new Date().toISOString(),
  ): WorkOrderDto {
    const wo = this.workOrders.find((w) => w.id === id)
    if (!wo) throw new NotFoundException(`工单 ${id} 不存在`)
    if (!canTransitionWorkOrder(wo.status, input.to)) {
      throw new BadRequestException(`工单 ${id} 不允许从 ${wo.status} 转移到 ${input.to}`)
    }
    const operator = input.operator?.trim() || input.assignee?.trim() || wo.assignee || '当前用户'
    if (input.assignee !== undefined) wo.assignee = input.assignee.trim()
    if (input.parts && input.parts.length > 0) wo.parts = [...wo.parts, ...deepCopy(input.parts)]
    wo.status = input.to
    wo.updatedAt = now
    if (input.to === 'in_progress' && !wo.startedAt) wo.startedAt = now
    if (input.to === 'completed') wo.completedAt = now
    if (input.to === 'closed') wo.closedAt = now
    const timeline = this.timelines.get(wo.id) ?? []
    timeline.push({ at: now, status: input.to, operator, note: input.note })
    this.timelines.set(wo.id, timeline)
    return this.toWorkOrderDto(wo, now)
  }

  getWorkOrderStats(now = new Date().toISOString()): WorkOrderStats {
    const items = this.workOrders.map((w) => this.toWorkOrderDto(w, now))
    const byStatus: Record<string, number> = {}
    const byKind: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    let overdue = 0
    let breached = 0
    let met = 0
    let completed = 0
    let resolutionSum = 0
    let partsCost = 0
    for (const w of items) {
      byStatus[w.status] = (byStatus[w.status] ?? 0) + 1
      byKind[w.kind] = (byKind[w.kind] ?? 0) + 1
      byPriority[w.priority] = (byPriority[w.priority] ?? 0) + 1
      partsCost += w.totalPartsCost
      if (w.slaState === 'breached') breached += 1
      if (w.isActive && new Date(w.dueAt).getTime() < new Date(now).getTime()) overdue += 1
      if (w.completedAt) {
        completed += 1
        resolutionSum += hoursBetween(w.createdAt, w.completedAt)
        if (w.slaState === 'met') met += 1
      }
    }
    const judged = items.filter((w) => w.slaState === 'met' || w.slaState === 'breached').length
    return {
      total: items.length,
      active: items.filter((w) => w.isActive).length,
      byStatus,
      byKind,
      byPriority,
      overdue,
      breached,
      avgResolutionHours: completed > 0 ? round2(resolutionSum / completed) : 0,
      partsCost: round2(partsCost),
      slaCompliancePct: judged > 0 ? round2((met / judged) * 100) : 100,
    }
  }

  // ============================== 校准 / 认证 ==============================

  private toCalibrationDto(c: SeedCalibration, nowIso: string): CalibrationDto {
    return {
      ...c,
      dueState: calibrationDueState(c.nextDue, nowIso),
      daysRemaining: daysUntil(c.nextDue, nowIso),
    }
  }

  listCalibrations(filter: { deviceId?: string; kind?: string; result?: string; now?: string } = {}): {
    items: CalibrationDto[]
    total: number
  } {
    const now = filter.now ?? new Date().toISOString()
    let rows = this.calibrations
    if (filter.deviceId) rows = rows.filter((c) => c.deviceId === filter.deviceId)
    if (filter.kind) rows = rows.filter((c) => c.kind === filter.kind)
    if (filter.result) rows = rows.filter((c) => c.result === filter.result)
    const items = rows
      .map((c) => this.toCalibrationDto(c, now))
      .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
    return { items, total: items.length }
  }

  createCalibration(input: Partial<SeedCalibration> & { deviceId: string; kind: CalibrationKind; standard: string }): CalibrationDto {
    if (!input.deviceId?.trim()) throw new BadRequestException('deviceId 不能为空')
    if (!input.standard?.trim()) throw new BadRequestException('standard 不能为空')
    const device = DEVICES.find((d) => d.id === input.deviceId)
    this.calSeq += 1
    const now = new Date().toISOString()
    const lastDate = input.lastDate ?? now
    const nextDue = input.nextDue ?? anchorOffsetLocal(lastDate, 365)
    const record: SeedCalibration = {
      id: `CAL-${this.calSeq}`,
      deviceId: input.deviceId,
      deviceName: input.deviceName?.trim() || device?.name || input.deviceId,
      kind: input.kind,
      standard: input.standard.trim(),
      lastDate,
      nextDue,
      result: (input.result as CalibrationResult) ?? 'pending',
      certNo: input.certNo?.trim() || `CERT-${this.calSeq}`,
      lab: input.lab?.trim() || '院内计量室',
      operator: input.operator?.trim() || '当前用户',
      notes: input.notes,
    }
    this.calibrations.push(record)
    return this.toCalibrationDto(record, now)
  }

  calibrationDue(days = 30, now = new Date().toISOString()): { items: CalibrationDto[]; total: number; days: number } {
    const horizon = new Date(now).getTime() + Math.max(1, days) * 86400000
    const items = this.calibrations
      .map((c) => this.toCalibrationDto(c, now))
      .filter((c) => new Date(c.nextDue).getTime() <= horizon)
      .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
    return { items, total: items.length, days }
  }

  calibrationFailures(): { items: CalibrationDto[]; total: number } {
    const now = new Date().toISOString()
    const items = this.calibrations
      .filter((c) => c.result === 'fail' || calibrationDueState(c.nextDue, now) === 'overdue')
      .map((c) => this.toCalibrationDto(c, now))
    return { items, total: items.length }
  }

  getCalibrationStats(now = new Date().toISOString()): CalibrationStats {
    const dtos = this.calibrations.map((c) => this.toCalibrationDto(c, now))
    const byKind: Record<string, number> = {}
    const byResult: Record<string, number> = {}
    for (const c of dtos) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1
      byResult[c.result] = (byResult[c.result] ?? 0) + 1
    }
    const fail = dtos.filter((c) => c.result === 'fail').length
    return {
      total: dtos.length,
      byKind,
      byResult,
      overdue: dtos.filter((c) => c.dueState === 'overdue').length,
      dueSoon: dtos.filter((c) => c.dueState === 'due_soon').length,
      failureRatePct: dtos.length > 0 ? round2((fail / dtos.length) * 100) : 0,
    }
  }

  // ============================== 资产折旧 ==============================

  private depreciationInput(asset: SeedAsset, asOf?: string): DepreciationInput {
    return {
      cost: asset.procurementCost,
      salvageRate: asset.salvageRate,
      usefulLifeMonths: asset.usefulLifeMonths,
      method: asset.method,
      startDate: asset.installDate,
      asOf,
    }
  }

  private toAssetDto(asset: SeedAsset, nowIso: string): AssetDto {
    const dep = computeDepreciation(this.depreciationInput(asset, nowIso.slice(0, 10)))
    const retirement = this.retirements
      .filter((r) => r.assetId === asset.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))[0]
    return {
      ...asset,
      bookValue: dep.currentBookValue,
      accumulatedDepreciation: dep.accumulatedDepreciation,
      residualValue: dep.residualValue,
      warrantyDaysRemaining: daysUntil(asset.warrantyEnd, nowIso),
      depreciationMethod: asset.method,
      retirementStatus: retirement ? retirement.status : asset.status === 'scrapped' ? 'scrapped' : 'none',
    }
  }

  listAssets(filter: { deviceId?: string; status?: string; now?: string } = {}): { items: AssetDto[]; total: number } {
    const now = filter.now ?? new Date().toISOString()
    let rows = this.assets
    if (filter.deviceId) rows = rows.filter((a) => a.deviceId === filter.deviceId)
    if (filter.status) rows = rows.filter((a) => a.status === filter.status)
    const items = rows.map((a) => this.toAssetDto(a, now))
    return { items, total: items.length }
  }

  getAsset(id: string, now = new Date().toISOString()): AssetDto {
    const asset = this.assets.find((a) => a.id === id)
    if (!asset) throw new NotFoundException(`资产 ${id} 不存在`)
    return this.toAssetDto(asset, now)
  }

  createAsset(input: Partial<SeedAsset> & { deviceId: string; deviceName?: string; procurementCost: number }): AssetDto {
    if (!input.deviceId?.trim()) throw new BadRequestException('deviceId 不能为空')
    if (!Number.isFinite(input.procurementCost) || input.procurementCost <= 0) throw new BadRequestException('procurementCost 必须为正数')
    const device = DEVICES.find((d) => d.id === input.deviceId)
    this.assetSeq += 1
    const now = new Date().toISOString()
    const asset: SeedAsset = {
      id: `AST-${this.assetSeq}`,
      deviceId: input.deviceId,
      deviceName: input.deviceName?.trim() || device?.name || input.deviceId,
      category: input.category?.trim() || '放射影像设备',
      vendor: input.vendor?.trim() || '未知厂商',
      procurementCost: input.procurementCost,
      procurementDate: input.procurementDate ?? now.slice(0, 10),
      installDate: input.installDate ?? now.slice(0, 10),
      warrantyEnd: input.warrantyEnd ?? anchorOffsetLocal(now, 365),
      method: input.method ?? 'straight-line',
      salvageRate: input.salvageRate ?? 0.05,
      usefulLifeMonths: input.usefulLifeMonths ?? 120,
      status: input.status ?? 'in_use',
    }
    this.assets.push(asset)
    return this.toAssetDto(asset, now)
  }

  updateAsset(id: string, body: Partial<SeedAsset>): AssetDto {
    const asset = this.assets.find((a) => a.id === id)
    if (!asset) throw new NotFoundException(`资产 ${id} 不存在`)
    if (body.deviceName !== undefined) asset.deviceName = body.deviceName
    if (body.category !== undefined) asset.category = body.category
    if (body.vendor !== undefined) asset.vendor = body.vendor
    if (body.procurementCost !== undefined) asset.procurementCost = body.procurementCost
    if (body.installDate !== undefined) asset.installDate = body.installDate
    if (body.warrantyEnd !== undefined) asset.warrantyEnd = body.warrantyEnd
    if (body.method !== undefined) asset.method = body.method
    if (body.salvageRate !== undefined) asset.salvageRate = body.salvageRate
    if (body.usefulLifeMonths !== undefined) asset.usefulLifeMonths = body.usefulLifeMonths
    if (body.status !== undefined) asset.status = body.status
    return this.toAssetDto(asset, new Date().toISOString())
  }

  getDepreciationSchedule(
    id: string,
    query: { method?: DepreciationMethod; asOf?: string } = {},
  ): DepreciationResult {
    const asset = this.assets.find((a) => a.id === id)
    if (!asset) throw new NotFoundException(`资产 ${id} 不存在`)
    const input = this.depreciationInput(asset, query.asOf ?? new Date().toISOString().slice(0, 10))
    if (query.method) input.method = query.method
    return computeDepreciation(input)
  }

  requestRetirement(
    id: string,
    input: { type: 'retire' | 'scrap'; reason: string; requestedBy?: string },
  ): RetirementApproval {
    const asset = this.assets.find((a) => a.id === id)
    if (!asset) throw new NotFoundException(`资产 ${id} 不存在`)
    if (!input.reason?.trim()) throw new BadRequestException('reason 不能为空')
    const now = new Date().toISOString()
    const approval: RetirementApproval = {
      id: `RET-${Date.now()}`,
      assetId: asset.id,
      deviceName: asset.deviceName,
      type: input.type,
      reason: input.reason.trim(),
      requestedBy: input.requestedBy?.trim() || '当前用户',
      requestedAt: now,
      status: 'pending',
    }
    this.retirements.unshift(approval)
    return approval
  }

  approveRetirement(
    approvalId: string,
    input: { approved: boolean; approvedBy?: string; approvedByRole?: string; scrapValue?: number },
  ): RetirementApproval {
    const approval = this.retirements.find((r) => r.id === approvalId)
    if (!approval) throw new NotFoundException(`报废审批 ${approvalId} 不存在`)
    approval.status = input.approved ? 'approved' : 'rejected'
    approval.approvedBy = input.approvedBy?.trim() || '当前用户'
    approval.approvedByRole = input.approvedByRole?.trim() || 'ADMIN'
    approval.approvedAt = new Date().toISOString()
    if (input.scrapValue !== undefined) approval.scrapValue = input.scrapValue
    if (input.approved) {
      const asset = this.assets.find((a) => a.id === approval.assetId)
      if (asset) asset.status = approval.type === 'scrap' ? 'scrapped' : 'retired'
    }
    return approval
  }

  listRetirements(): { items: RetirementApproval[]; total: number } {
    const items = deepCopy(this.retirements)
    return { items, total: items.length }
  }

  getAssetStats(now = new Date().toISOString()): AssetStats {
    const dtos = this.assets.map((a) => this.toAssetDto(a, now))
    const byStatus: Record<string, number> = {}
    const byMethod: Record<string, number> = {}
    for (const a of dtos) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
      byMethod[a.method] = (byMethod[a.method] ?? 0) + 1
    }
    return {
      totalAssets: dtos.length,
      totalProcurementCost: round2(dtos.reduce((s, a) => s + a.procurementCost, 0)),
      totalBookValue: round2(dtos.reduce((s, a) => s + a.bookValue, 0)),
      totalAccumulated: round2(dtos.reduce((s, a) => s + a.accumulatedDepreciation, 0)),
      byStatus,
      byMethod,
      warrantyExpiring: dtos.filter((a) => a.warrantyDaysRemaining >= 0 && a.warrantyDaysRemaining <= 90).length,
      pendingRetirements: this.retirements.filter((r) => r.status === 'pending').length,
    }
  }

  // ============================== OEE (真实停机事件) ==============================

  private computeDeviceOee(deviceId: string, dateOverride?: string): OeeLossDto {
    const device = DEVICES.find((d) => d.id === deviceId)
    if (!device) throw new NotFoundException(`设备 ${deviceId} 不存在`)
    const production = SEED_PRODUCTION[deviceId] ?? { plannedMinutes: 720, idealCycleMinutes: 10, totalCount: 40, goodCount: 38 }
    const events = this.downtime.filter((d) => d.deviceId === deviceId)
    const oee = computeOee({
      plannedProductionMinutes: production.plannedMinutes,
      downtimeEvents: events,
      idealCycleMinutes: production.idealCycleMinutes,
      totalCount: production.totalCount,
      goodCount: production.goodCount,
    })
    return {
      deviceId,
      deviceName: device.name,
      modality: device.modality,
      date: (dateOverride ?? anchorOffset(0)).slice(0, 10),
      availability: oee.availability,
      performance: oee.performance,
      quality: oee.quality,
      oee: oee.oee,
      plannedProductionMinutes: oee.plannedProductionMinutes,
      downtimeMinutes: oee.downtimeMinutes,
      runtimeMinutes: oee.runtimeMinutes,
      totalCount: oee.totalCount,
      goodCount: oee.goodCount,
      scrapCount: oee.scrapCount,
      loss: oee.loss,
      lossPercent: oee.lossPercent,
      workOrderIds: events.map((e) => e.workOrderId).filter((v): v is string => Boolean(v)),
      source: 'actual',
    }
  }

  listOee(): { items: OeeLossDto[]; total: number } {
    const items = DEVICES.map((d) => this.computeDeviceOee(d.id))
    return { items, total: items.length }
  }

  getOeeOverview(): {
    date: string
    avgOee: number
    avgAvailability: number
    avgPerformance: number
    avgQuality: number
    totalDevices: number
    bestDevice: { id: string; name: string; oee: number } | null
    worstDevice: { id: string; name: string; oee: number } | null
    totalDowntimeHours: number
    byModality: Array<{ modality: string; devices: number; oee: number }>
  } {
    const list = this.listOee().items
    const avg = (key: 'oee' | 'availability' | 'performance' | 'quality') =>
      list.length > 0 ? round2(list.reduce((s, d) => s + d[key], 0) / list.length) : 0
    const sorted = [...list].sort((a, b) => b.oee - a.oee)
    const modalityMap = new Map<string, { modality: string; devices: number; sum: number }>()
    for (const d of list) {
      const entry = modalityMap.get(d.modality) ?? { modality: d.modality, devices: 0, sum: 0 }
      entry.devices += 1
      entry.sum += d.oee
      modalityMap.set(d.modality, entry)
    }
    return {
      date: anchorOffset(0).slice(0, 10),
      avgOee: avg('oee'),
      avgAvailability: avg('availability'),
      avgPerformance: avg('performance'),
      avgQuality: avg('quality'),
      totalDevices: list.length,
      bestDevice: sorted[0] ? { id: sorted[0].deviceId, name: sorted[0].deviceName, oee: sorted[0].oee } : null,
      worstDevice: sorted.length > 0
        ? { id: sorted[sorted.length - 1].deviceId, name: sorted[sorted.length - 1].deviceName, oee: sorted[sorted.length - 1].oee }
        : null,
      totalDowntimeHours: round2(list.reduce((s, d) => s + d.downtimeMinutes, 0) / 60),
      byModality: [...modalityMap.values()].map((m) => ({ modality: m.modality, devices: m.devices, oee: round2(m.sum / m.devices) })),
    }
  }

  getOeeDevice(deviceId: string): OeeLossDto {
    return this.computeDeviceOee(deviceId)
  }

  /** 近 N 日 OEE 趋势 — 当日为真实计算, 历史为确定性派生 (待接入历史停机/产量后转真实) */
  getOeeTrend(days = 7): {
    items: Array<{ date: string; oee: number; availability: number; performance: number; quality: number; source: 'actual' | 'derived' }>
  } {
    const count = Math.max(1, Math.min(Math.round(days) || 7, 30))
    const list = this.listOee().items
    const avg = (key: 'oee' | 'availability' | 'performance' | 'quality') =>
      round2(list.reduce((s, d) => s + d[key], 0) / Math.max(1, list.length))
    const items: Array<{ date: string; oee: number; availability: number; performance: number; quality: number; source: 'actual' | 'derived' }> = []
    for (let i = count - 1; i >= 0; i--) {
      const date = anchorOffset(-i).slice(0, 10)
      const actual = i === 0
      const factor = 1 + ((i % 3) - 1) * 0.02
      const availability = actual ? avg('availability') : round2(avg('availability') * factor)
      const performance = actual ? avg('performance') : round2(avg('performance') * factor)
      const quality = actual ? avg('quality') : round2(Math.min(100, avg('quality') * factor))
      items.push({
        date,
        availability,
        performance,
        quality,
        oee: round2((availability * performance * quality) / 10000),
        source: actual ? 'actual' : 'derived',
      })
    }
    return { items }
  }

  getDowntimeLoss(deviceId?: string): {
    items: Array<{ deviceId: string; deviceName: string; modality: string; loss: ReturnType<typeof summarizeDowntime>; lossPercent: Record<DowntimeCategory, number>; workOrderIds: string[] }>
    total: number
  } {
    const devices = deviceId ? DEVICES.filter((d) => d.id === deviceId) : DEVICES
    const items = devices.map((d) => {
      const detail = this.computeDeviceOee(d.id)
      return {
        deviceId: d.id,
        deviceName: d.name,
        modality: d.modality,
        loss: detail.loss,
        lossPercent: detail.lossPercent,
        workOrderIds: detail.workOrderIds,
      }
    })
    return { items, total: items.length }
  }

  // ============================== 成本核算 + DRG ==============================

  private costRowRevenue(row: (typeof SEED_COST_ROWS)[number]): number {
    return round2(row.volume * row.unitPrice)
  }

  private costRowCost(row: (typeof SEED_COST_ROWS)[number]): number {
    return round2(row.volume * sumCost(row))
  }

  getCostSummary(): {
    totalVolume: number
    totalRevenue: number
    totalCost: number
    margin: MarginResult
    breakdownTotals: ExamCostBreakdown
    byModality: CostByModalityRow[]
  } {
    let totalVolume = 0
    let totalRevenue = 0
    let totalCost = 0
    const breakdownTotals: ExamCostBreakdown = { consumables: 0, contrast: 0, labor: 0, depreciation: 0, overhead: 0 }
    const modalityMap = new Map<string, { modality: string; volume: number; revenue: number; cost: number; breakdown: ExamCostBreakdown }>()
    for (const row of SEED_COST_ROWS) {
      totalVolume += row.volume
      const revenue = this.costRowRevenue(row)
      const cost = this.costRowCost(row)
      totalRevenue += revenue
      totalCost += cost
      breakdownTotals.consumables += row.consumables * row.volume
      breakdownTotals.contrast += row.contrast * row.volume
      breakdownTotals.labor += row.labor * row.volume
      breakdownTotals.depreciation += row.depreciation * row.volume
      breakdownTotals.overhead += row.overhead * row.volume
      const entry = modalityMap.get(row.modality) ?? {
        modality: row.modality,
        volume: 0,
        revenue: 0,
        cost: 0,
        breakdown: { consumables: 0, contrast: 0, labor: 0, depreciation: 0, overhead: 0 },
      }
      entry.volume += row.volume
      entry.revenue += revenue
      entry.cost += cost
      for (const key of Object.keys(entry.breakdown) as (keyof ExamCostBreakdown)[]) {
        entry.breakdown[key] += row[key] * row.volume
      }
      modalityMap.set(row.modality, entry)
    }
    const byModality: CostByModalityRow[] = [...modalityMap.values()]
      .map((m) => {
        const margin = computeMargin(m.revenue, m.cost)
        const breakdown: ExamCostBreakdown = {
          consumables: round2(m.breakdown.consumables),
          contrast: round2(m.breakdown.contrast),
          labor: round2(m.breakdown.labor),
          depreciation: round2(m.breakdown.depreciation),
          overhead: round2(m.breakdown.overhead),
        }
        return {
          modality: m.modality,
          volume: m.volume,
          revenue: round2(m.revenue),
          cost: round2(m.cost),
          margin: margin.margin,
          marginPct: margin.marginPct,
          unitCost: m.volume > 0 ? round2(m.cost / m.volume) : 0,
          breakdown,
        }
      })
      .sort((a, b) => b.revenue - a.revenue)
    return {
      totalVolume,
      totalRevenue: round2(totalRevenue),
      totalCost: round2(totalCost),
      margin: computeMargin(totalRevenue, totalCost),
      breakdownTotals: {
        consumables: round2(breakdownTotals.consumables),
        contrast: round2(breakdownTotals.contrast),
        labor: round2(breakdownTotals.labor),
        depreciation: round2(breakdownTotals.depreciation),
        overhead: round2(breakdownTotals.overhead),
      },
      byModality,
    }
  }

  getCostByExam(): {
    items: Array<{
      examItem: string
      modality: string
      volume: number
      unitPrice: number
      unitCost: number
      totalRevenue: number
      totalCost: number
      margin: number
      marginPct: number
      breakdown: ExamCostBreakdown
    }>
    total: number
  } {
    const items = SEED_COST_ROWS.map((row) => {
      const unitCost = sumCost(row)
      const totalRevenue = this.costRowRevenue(row)
      const totalCost = this.costRowCost(row)
      const margin = computeMargin(totalRevenue, totalCost)
      return {
        examItem: row.examItem,
        modality: row.modality,
        volume: row.volume,
        unitPrice: row.unitPrice,
        unitCost,
        totalRevenue,
        totalCost,
        margin: margin.margin,
        marginPct: margin.marginPct,
        breakdown: {
          consumables: row.consumables,
          contrast: row.contrast,
          labor: row.labor,
          depreciation: row.depreciation,
          overhead: row.overhead,
        },
      }
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
    return { items, total: items.length }
  }

  listDrg(baseRate = DEFAULT_BASE_RATE): {
    baseRate: number
    items: DrgRowMargin[]
    total: number
    totals: { cases: number; totalWeight: number; revenue: number; cost: number; margin: MarginResult }
  } {
    const rate = Number.isFinite(baseRate) && baseRate > 0 ? baseRate : DEFAULT_BASE_RATE
    const items: DrgRowMargin[] = SEED_DRG_ROWS.map((row) => {
      const totalWeight = round2(row.weight * row.cases)
      const revenue = round2(row.revenuePerCase * row.cases)
      const cost = round2(row.costPerCase * row.cases)
      const margin = computeMargin(revenue, cost)
      return {
        drgCode: row.drgCode,
        name: row.name,
        mdc: row.mdc,
        weight: row.weight,
        cases: row.cases,
        totalWeight,
        payment: drgPayment(totalWeight, rate),
        revenue,
        cost,
        margin: margin.margin,
        marginPct: margin.marginPct,
      }
    }).sort((a, b) => b.revenue - a.revenue)
    const revenue = round2(items.reduce((s, i) => s + i.revenue, 0))
    const cost = round2(items.reduce((s, i) => s + i.cost, 0))
    return {
      baseRate: rate,
      items,
      total: items.length,
      totals: {
        cases: items.reduce((s, i) => s + i.cases, 0),
        totalWeight: round2(items.reduce((s, i) => s + i.totalWeight, 0)),
        revenue,
        cost,
        margin: computeMargin(revenue, cost),
      },
    }
  }

  /** DRG 分组桩: 输入主诊断编码返回分组 + 支付 */
  groupDiagnosis(principalDiagnosisCode: string, baseRate = DEFAULT_BASE_RATE): ReturnType<typeof groupDrg> & { payment: number } {
    const group = groupDrg(principalDiagnosisCode)
    return { ...group, payment: drgPayment(group.weight, baseRate) }
  }

  // ============================== 定时 BI 报表 ==============================

  listReportDefinitions(now = new Date().toISOString()): {
    items: Array<SeedReportDefinition & { nextRunAt: string | null }>
    total: number
  } {
    const items = this.reportDefs.map((d) => ({ ...d, nextRunAt: nextRunAt(d.frequency, d.timeOfDay, now) }))
    return { items, total: items.length }
  }

  createReportDefinition(input: Partial<SeedReportDefinition> & { name: string; frequency: ScheduleFrequency }): SeedReportDefinition & { nextRunAt: string | null } {
    if (!input.name?.trim()) throw new BadRequestException('name 不能为空')
    this.reportSeq += 1
    const now = new Date().toISOString()
    const def: SeedReportDefinition = {
      id: `RPT-${this.reportSeq}`,
      name: input.name.trim(),
      reportType: input.reportType?.trim() || 'custom',
      frequency: input.frequency,
      timeOfDay: input.timeOfDay ?? '08:00',
      recipients: input.recipients ? [...input.recipients] : [],
      format: input.format ?? 'xlsx',
      enabled: input.enabled ?? true,
      createdAt: now,
    }
    this.reportDefs.push(def)
    return { ...def, nextRunAt: nextRunAt(def.frequency, def.timeOfDay, now) }
  }

  updateReportDefinition(id: string, body: Partial<SeedReportDefinition>): SeedReportDefinition & { nextRunAt: string | null } {
    const def = this.reportDefs.find((d) => d.id === id)
    if (!def) throw new NotFoundException(`报表定义 ${id} 不存在`)
    if (body.name !== undefined) def.name = body.name
    if (body.reportType !== undefined) def.reportType = body.reportType
    if (body.frequency !== undefined) def.frequency = body.frequency
    if (body.timeOfDay !== undefined) def.timeOfDay = body.timeOfDay
    if (body.recipients !== undefined) def.recipients = [...body.recipients]
    if (body.format !== undefined) def.format = body.format
    if (body.enabled !== undefined) def.enabled = body.enabled
    return { ...def, nextRunAt: nextRunAt(def.frequency, def.timeOfDay, new Date().toISOString()) }
  }

  runReportDefinition(id: string, input: { trigger?: 'manual' | 'cron' } = {}): ReportInstanceDto {
    const def = this.reportDefs.find((d) => d.id === id)
    if (!def) throw new NotFoundException(`报表定义 ${id} 不存在`)
    this.instanceSeq += 1
    const now = new Date().toISOString()
    const rowCount = this.reportRowCount(def.reportType)
    const deliveryLog: ReportDeliveryLogEntry[] = def.recipients.map((recipient, idx) => ({
      recipient,
      channel: 'email',
      status: idx === def.recipients.length - 1 && def.recipients.length > 2 ? 'failed' : 'sent',
      at: now,
    }))
    const instance: SeedReportInstance = {
      id: `INST-${this.instanceSeq}`,
      definitionId: def.id,
      definitionName: def.name,
      generatedAt: now,
      status: deliveryLog.some((l) => l.status === 'failed') ? 'failed' : 'success',
      rowCount,
      sizeKb: 30 + rowCount * 4,
      format: def.format,
      deliveryLog,
    }
    this.reportInstances.unshift(instance)
    def.lastRunAt = now
    return { ...instance, createdAt: now }
  }

  private reportRowCount(reportType: string): number {
    if (reportType.startsWith('oee')) return DEVICES.length
    if (reportType.startsWith('downtime')) return this.downtime.length
    if (reportType.startsWith('cost')) return SEED_COST_ROWS.length
    if (reportType.startsWith('drg')) return SEED_DRG_ROWS.length
    return 10
  }

  listReportInstances(filter: { definitionId?: string } = {}): { items: ReportInstanceDto[]; total: number } {
    let rows = this.reportInstances
    if (filter.definitionId) rows = rows.filter((i) => i.definitionId === filter.definitionId)
    const items = rows
      .map((i) => ({ ...i, createdAt: i.generatedAt }))
      .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    return { items, total: items.length }
  }
}

/** 在给定 ISO 日期基础上加 N 天, 返回 YYYY-MM-DD */
function anchorOffsetLocal(baseIso: string, days: number): string {
  const d = new Date(baseIso)
  if (!Number.isFinite(d.getTime())) return baseIso.slice(0, 10)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
