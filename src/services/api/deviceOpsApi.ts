import { api, invalidateApiCacheByPrefix } from './client'

/**
 * [G005 W11-DeviceOps] 设备运维中心 / 运营成本 + DRG 前端 API
 * 后端: backend/src/modules/device-ops (内存 + @Optional Prisma)
 * 前端 mock: src/services/mockBackend/w11DeviceHandlers.ts (确定性)
 */

const withQuery = (path: string, params?: Record<string, string | number | undefined>): string => {
  if (!params) return path
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${path}?${qs}` : path
}

// ── 工单 ──

export type WorkOrderStatus = 'new' | 'open' | 'assigned' | 'in_progress' | 'waiting_parts' | 'completed' | 'closed'
export type WorkOrderKind = 'maintenance' | 'fault'
export type WorkOrderPriority = 'critical' | 'high' | 'medium' | 'low'
export type WorkOrderSlaState = 'on_track' | 'at_risk' | 'breached' | 'met'

export interface WorkOrderPart {
  name: string
  quantity: number
  unitPrice: number
}

export interface WorkOrderTimelineEvent {
  at: string
  status: WorkOrderStatus | 'created'
  operator: string
  note?: string
}

export interface WorkOrder {
  id: string
  kind: WorkOrderKind
  title: string
  deviceId: string
  deviceName: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  assignee: string
  parts: WorkOrderPart[]
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  closedAt?: string
  description: string
  source: 'manual' | 'fault-report'
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

export interface CreateWorkOrderDto {
  kind: WorkOrderKind
  title: string
  deviceId: string
  deviceName?: string
  priority?: WorkOrderPriority
  assignee?: string
  parts?: WorkOrderPart[]
  description?: string
}

export interface AdvanceWorkOrderDto {
  to: WorkOrderStatus
  assignee?: string
  parts?: WorkOrderPart[]
  note?: string
}

// ── 校准 / 认证 ──

export type CalibrationKind = 'calibration' | 'certification'
export type CalibrationResult = 'pass' | 'fail' | 'pending'
export type CalibrationDueState = 'overdue' | 'due_soon' | 'valid' | 'none'

export interface CalibrationRecord {
  id: string
  deviceId: string
  deviceName: string
  kind: CalibrationKind
  standard: string
  lastDate: string
  nextDue: string
  result: CalibrationResult
  certNo: string
  lab: string
  operator: string
  notes?: string
  dueState: CalibrationDueState
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

export interface CreateCalibrationDto {
  deviceId: string
  deviceName?: string
  kind: CalibrationKind
  standard: string
  lastDate?: string
  nextDue?: string
  result?: CalibrationResult
  certNo?: string
  lab?: string
  operator?: string
  notes?: string
}

// ── 资产 / 折旧 ──

export type DepreciationMethod = 'straight-line' | 'declining'

export interface Asset {
  id: string
  deviceId: string
  deviceName: string
  category: string
  vendor: string
  procurementCost: number
  procurementDate: string
  installDate: string
  warrantyEnd: string
  method: DepreciationMethod
  salvageRate: number
  usefulLifeMonths: number
  status: 'in_use' | 'maintenance' | 'retired' | 'scrapped'
  bookValue: number
  accumulatedDepreciation: number
  residualValue: number
  warrantyDaysRemaining: number
  depreciationMethod: DepreciationMethod
  retirementStatus: 'none' | 'pending' | 'approved' | 'rejected' | 'scrapped'
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
  firstMonthDepreciation: number
  accumulatedDepreciation: number
  currentBookValue: number
  monthlyRatePct: number
  schedule: DepreciationPoint[]
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

export interface CreateAssetDto {
  deviceId: string
  deviceName?: string
  category?: string
  vendor?: string
  procurementCost: number
  procurementDate?: string
  installDate?: string
  warrantyEnd?: string
  method?: DepreciationMethod
  salvageRate?: number
  usefulLifeMonths?: number
  status?: string
}

// ── OEE ──

export interface OeeLossBreakdown {
  planned: number
  unplanned: number
  changeover: number
  idle: number
  smallStop: number
  total: number
}

export interface OeeDeviceLoss {
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
  loss: OeeLossBreakdown
  lossPercent: Record<string, number>
  workOrderIds: string[]
  source: 'actual' | 'derived'
}

export interface OeeOverview {
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
}

export interface OeeTrendPoint {
  date: string
  oee: number
  availability: number
  performance: number
  quality: number
  source: 'actual' | 'derived'
}

export interface DowntimeLossRow {
  deviceId: string
  deviceName: string
  modality: string
  loss: OeeLossBreakdown
  lossPercent: Record<string, number>
  workOrderIds: string[]
}

// ── 成本 + DRG ──

export interface CostBreakdown {
  consumables: number
  contrast: number
  labor: number
  depreciation: number
  overhead: number
}

export interface CostByModalityRow {
  modality: string
  volume: number
  revenue: number
  cost: number
  margin: number
  marginPct: number
  unitCost: number
  breakdown: CostBreakdown
}

export interface CostSummary {
  totalVolume: number
  totalRevenue: number
  totalCost: number
  margin: { revenue: number; cost: number; margin: number; marginPct: number }
  breakdownTotals: CostBreakdown
  byModality: CostByModalityRow[]
}

export interface CostByExamRow {
  examItem: string
  modality: string
  volume: number
  unitPrice: number
  unitCost: number
  totalRevenue: number
  totalCost: number
  margin: number
  marginPct: number
  breakdown: CostBreakdown
}

export interface DrgRow {
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

export interface DrgGroups {
  baseRate: number
  items: DrgRow[]
  total: number
  totals: { cases: number; totalWeight: number; revenue: number; cost: number; margin: { revenue: number; cost: number; margin: number; marginPct: number } }
}

// ── 定时报表 ──

export type ScheduleFrequency = 'daily' | 'weekly' | 'monthly' | 'manual'

export interface ReportDefinition {
  id: string
  name: string
  reportType: string
  frequency: ScheduleFrequency
  timeOfDay: string
  recipients: string[]
  format: 'xlsx' | 'pdf' | 'csv'
  enabled: boolean
  createdAt: string
  lastRunAt?: string
  nextRunAt: string | null
}

export interface ReportInstance {
  id: string
  definitionId: string
  definitionName: string
  generatedAt: string
  status: 'success' | 'failed' | 'running'
  rowCount: number
  sizeKb: number
  format: 'xlsx' | 'pdf' | 'csv'
  deliveryLog: Array<{ recipient: string; channel: string; status: 'sent' | 'failed'; at: string }>
  createdAt: string
}

export const deviceOpsApi = {
  // 工单
  listWorkOrders: (params?: { status?: string; kind?: string; priority?: string; deviceId?: string }) =>
    api.get<{ items: WorkOrder[]; total: number }>(withQuery('/device-ops/work-orders', params)),
  getWorkOrder: (id: string) => api.get<WorkOrder>(`/device-ops/work-orders/${encodeURIComponent(id)}`),
  createWorkOrder: async (dto: CreateWorkOrderDto) => {
    const res = await api.post<WorkOrder>('/device-ops/work-orders', dto)
    await invalidateApiCacheByPrefix('/device-ops/work-orders')
    return res
  },
  advanceWorkOrder: async (id: string, dto: AdvanceWorkOrderDto) => {
    const res = await api.post<WorkOrder>(`/device-ops/work-orders/${encodeURIComponent(id)}/advance`, dto)
    await invalidateApiCacheByPrefix('/device-ops/work-orders')
    return res
  },
  getWorkOrderStats: () => api.get<WorkOrderStats>('/device-ops/work-orders/stats'),

  // 校准
  listCalibrations: (params?: { deviceId?: string; kind?: string; result?: string }) =>
    api.get<{ items: CalibrationRecord[]; total: number }>(withQuery('/device-ops/calibrations', params)),
  calibrationDue: (days = 30) => api.get<{ items: CalibrationRecord[]; total: number; days: number }>(`/device-ops/calibrations/due?days=${days}`),
  calibrationFailures: () => api.get<{ items: CalibrationRecord[]; total: number }>('/device-ops/calibrations/failures'),
  getCalibrationStats: () => api.get<CalibrationStats>('/device-ops/calibrations/stats'),
  createCalibration: async (dto: CreateCalibrationDto) => {
    const res = await api.post<CalibrationRecord>('/device-ops/calibrations', dto)
    await invalidateApiCacheByPrefix('/device-ops/calibrations')
    return res
  },

  // 资产
  listAssets: (params?: { deviceId?: string; status?: string }) =>
    api.get<{ items: Asset[]; total: number }>(withQuery('/device-ops/assets', params)),
  getAsset: (id: string) => api.get<Asset>(`/device-ops/assets/${encodeURIComponent(id)}`),
  getDepreciation: (id: string, params?: { method?: DepreciationMethod; asOf?: string }) =>
    api.get<DepreciationResult>(withQuery(`/device-ops/assets/${encodeURIComponent(id)}/depreciation`, params)),
  createAsset: async (dto: CreateAssetDto) => {
    const res = await api.post<Asset>('/device-ops/assets', dto)
    await invalidateApiCacheByPrefix('/device-ops/assets')
    return res
  },
  getAssetStats: () => api.get<AssetStats>('/device-ops/assets/stats'),
  listRetirements: () => api.get<{ items: RetirementApproval[]; total: number }>('/device-ops/assets/retirements'),
  requestRetirement: async (id: string, dto: { type: 'retire' | 'scrap'; reason: string; requestedBy?: string }) => {
    const res = await api.post<RetirementApproval>(`/device-ops/assets/${encodeURIComponent(id)}/retire`, dto)
    await invalidateApiCacheByPrefix('/device-ops/assets')
    return res
  },
  approveRetirement: async (id: string, dto: { approved: boolean; approvedBy?: string; scrapValue?: number }) => {
    const res = await api.post<RetirementApproval>(`/device-ops/assets/retirements/${encodeURIComponent(id)}/approve`, dto)
    await invalidateApiCacheByPrefix('/device-ops/assets')
    return res
  },

  // OEE
  listOee: () => api.get<{ items: OeeDeviceLoss[]; total: number }>('/device-ops/oee'),
  getOeeOverview: () => api.get<OeeOverview>('/device-ops/oee/overview'),
  getOeeTrend: (days = 7) => api.get<{ items: OeeTrendPoint[] }>(`/device-ops/oee/trend?days=${days}`),
  getDowntimeLoss: (deviceId?: string) => api.get<{ items: DowntimeLossRow[]; total: number }>(withQuery('/device-ops/oee/downtime-loss', { deviceId })),
  getOeeDevice: (deviceId: string) => api.get<OeeDeviceLoss>(`/device-ops/oee/devices/${encodeURIComponent(deviceId)}`),

  // 成本 + DRG
  getCostSummary: () => api.get<CostSummary>('/device-ops/cost/summary'),
  getCostByExam: () => api.get<{ items: CostByExamRow[]; total: number }>('/device-ops/cost/by-exam'),
  listDrg: (baseRate?: number) => api.get<DrgGroups>(withQuery('/device-ops/drg/groups', { baseRate })),
  groupDiagnosis: (principalDiagnosisCode: string, baseRate?: number) =>
    api.post<{ code: string; name: string; mdc: string; weight: number; payment: number }>('/device-ops/drg/group', { principalDiagnosisCode, baseRate }),

  // 定时报表
  listReportDefinitions: () => api.get<{ items: ReportDefinition[]; total: number }>('/device-ops/scheduled-reports'),
  createReportDefinition: async (dto: Partial<ReportDefinition> & { name: string; frequency: ScheduleFrequency }) => {
    const res = await api.post<ReportDefinition>('/device-ops/scheduled-reports', dto)
    await invalidateApiCacheByPrefix('/device-ops/scheduled-reports')
    return res
  },
  runReportDefinition: async (id: string, trigger: 'manual' | 'cron' = 'manual') => {
    const res = await api.post<ReportInstance>(`/device-ops/scheduled-reports/${encodeURIComponent(id)}/run`, { trigger })
    await invalidateApiCacheByPrefix('/device-ops/report-instances')
    return res
  },
  listReportInstances: (definitionId?: string) =>
    api.get<{ items: ReportInstance[]; total: number }>(withQuery('/device-ops/report-instances', { definitionId })),
}
