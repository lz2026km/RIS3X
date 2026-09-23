import { api } from './client'

// Tech-Ops (技师工作站 V2) API
// Backend: GET /tech-ops/utilization | /tech-ops/meta | /tech-ops/emergency/suggest|records
//          POST /tech-ops/emergency/insert | /tech-ops/optimize, GET /tech-ops/optimize/demo
// 孤儿模块: DB 不可用自动回退确定性种子 (seeded=true)

export type UtilizationGranularity = 'day' | 'hour'
export type EmergencyStrategy = 'INSERT_NOW' | 'NEXT_FREE' | 'SPARE_DEVICE'
export type ExamPriority = 'ROUTINE' | 'URGENT' | 'STAT'

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

export interface UtilizationHistory {
  days: number
  granularity: UtilizationGranularity
  seeded: boolean
  series: UtilizationDay[]
  stats: UtilizationStats
  devices: DeviceUtilization[]
}

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

export interface TechOpsDevice {
  id: string
  name: string
  modality: string
  technician: string
  spare: boolean
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

export interface TechOpsMeta {
  devices: TechOpsDevice[]
  date: string
  nowMin: number
  modalities: string[]
}

const qs = (params: Record<string, string | undefined>) => {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`)
  return parts.length > 0 ? `?${parts.join('&')}` : ''
}

export const techOpsApi = {
  utilization: (days?: number, granularity?: UtilizationGranularity) =>
    api.get<UtilizationHistory>(`/tech-ops/utilization${qs({ days: days ? String(days) : undefined, granularity })}`),

  meta: () => api.get<TechOpsMeta>('/tech-ops/meta'),

  suggest: (params?: { modality?: string; deviceId?: string; durationMin?: number }) =>
    api.get<EmergencySuggestion[]>(`/tech-ops/emergency/suggest${qs({
      modality: params?.modality,
      deviceId: params?.deviceId,
      durationMin: params?.durationMin !== undefined ? String(params.durationMin) : undefined,
    })}`),

  insert: (data: {
    patientName?: string
    examItem?: string
    modality?: string
    deviceId?: string
    durationMin?: number
    startMin?: number
    priority?: ExamPriority
    force?: boolean
    reason?: string
  }) => api.post<EmergencyInsertResult>('/tech-ops/emergency/insert', data),

  records: () => api.get<EmergencyRecord[]>('/tech-ops/emergency/records'),

  // [G005 W2] 单条急诊插入记录 (后端 GET /tech-ops/emergency/records/:id)
  getRecord: (id: string) =>
    api.get<EmergencyRecord>(`/tech-ops/emergency/records/${encodeURIComponent(id)}`),

  optimize: (data: { exams: OptimizeExam[]; devices: OptimizeDevice[] }) =>
    api.post<OptimizeResult>('/tech-ops/optimize', data),

  demoQueue: () => api.get<{ exams: OptimizeExam[]; devices: OptimizeDevice[] }>('/tech-ops/optimize/demo'),
}
