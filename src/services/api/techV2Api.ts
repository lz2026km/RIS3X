import { api } from './client'

// Tech-V2 (技师工作站 V2: 双检间轮转 + 工作量预测) API
// Backend: GET/POST /tech-v2/rotation/*, GET /tech-v2/forecast*, GET /tech-v2/workload/balance
// 孤儿模块 (无 DB 可启动), 全部算法确定性

export type TechShift = 'DAY' | 'NIGHT' | 'WEEKEND' | 'BACKUP'

export interface RotationRule {
  id: string
  name: string
  shift: TechShift
  roomIds: string[]
  skillMatrix: Record<string, string[]>
  eligibleTechIds: string[]
  maxConsecutiveDays: number
  balanceWeight: number
  enabled: boolean
  description: string
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
  accumulatedBefore: number
  predictedLoad: number
  reason: string
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

export interface RotationExecutionRecord {
  id: string
  planId: string
  assignmentId: string
  date: string
  shift: TechShift
  technicianId: string
  technicianName: string
  roomId: string | null
  status: 'EXECUTED' | 'SKIPPED'
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

export interface WorkloadForecast {
  startDate: string
  days: number
  model: string
  seeded: boolean
  daily: ForecastDay[]
  totals: { value: number; lower: number; upper: number }
  perTechnician: Array<{ technicianId: string; technicianName: string; date: string; share: number; value: number }>
  byRoom: Array<{ roomId: string; roomName: string; date: string; value: number }>
  history: Array<{ date: string; weekday: string; value: number }>
}

const qs = (params: Record<string, string | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export const techV2Api = {
  meta: () => api.get<{ technicians: Array<{ id: string; name: string; group: string }>; rooms: Array<{ id: string; name: string }> }>('/tech-v2/meta'),

  // ===== 轮转规则 =====
  rotationRules: () => api.get<RotationRule[]>('/tech-v2/rotation/rules'),

  // ===== 轮转计划 =====
  generatePlan: (data: { startDate: string; days?: number; balanceWeight?: number }) =>
    api.post<RotationPlan>('/tech-v2/rotation/generate', data),

  rotationPlan: (startDate?: string, days?: number) =>
    api.get<RotationPlan>(`/tech-v2/rotation/plan${qs({ startDate, days: days !== undefined ? String(days) : undefined })}`),

  rotationHistory: () => api.get<RotationHistory>('/tech-v2/rotation/history'),

  executeAssignment: (id: string, note?: string) =>
    api.post<RotationExecutionRecord>(`/tech-v2/rotation/assignments/${id}/execute`, note ? { note } : {}),

  // ===== 工作量预测 =====
  forecast: (params?: { startDate?: string; days?: number; technicianId?: string }) =>
    api.get<WorkloadForecast>(`/tech-v2/forecast${qs({
      startDate: params?.startDate,
      days: params?.days !== undefined ? String(params.days) : undefined,
      technicianId: params?.technicianId,
    })}`),

  technicianForecast: (technicianId: string, params?: { startDate?: string; days?: number }) =>
    api.get<{
      technicianId: string
      startDate: string
      days: number
      daily: Array<{ date: string; weekday: string; label: string; technicianValue: number }>
      byDate: Array<{ technicianId: string; technicianName: string; date: string; share: number; value: number }>
    }>(`/tech-v2/forecast/technician/${technicianId}${qs({
      startDate: params?.startDate,
      days: params?.days !== undefined ? String(params.days) : undefined,
    })}`),

  // ===== 工作量均衡 =====
  workloadBalance: () => api.get<WorkloadBalance>('/tech-v2/workload/balance'),
}
