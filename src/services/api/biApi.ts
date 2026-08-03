import { api } from './client'

// G005 BI 仪表板 API (对标 Sectra / Agfa / Fujifilm Analytics)
// Backend: /bi/* (NestJS), mock: /api/v1/bi/* (MSW)

export interface BiEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
}

export interface KpiDto {
  examCount: number
  reportCount: number
  completionRate: number
  avgReportMinutes: number
  overtimeRate: number
  pendingReports: number
  criticalSlaRate: number
}

export interface TimelinessBucketDto {
  bucket: string
  count: number
  percent: number
}

export interface TimelinessDto {
  total: number
  buckets: TimelinessBucketDto[]
  medianMinutes: number
  p90Minutes: number
}

export interface PhysicianRvuDto {
  doctorName: string
  reportCount: number
  rvu: number
  avgMinutes: number
}

export interface PhysicianRvuEnvelopeDto {
  totalRvu: number
  physicians: PhysicianRvuDto[]
}

export interface OeeDayDto {
  date: string
  oee: number
  availability: number
  performance: number
  quality: number
}

export interface DeviceOeeDto {
  deviceId: string
  deviceName: string
  modality: string
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  trend: OeeDayDto[]
}

export interface DeviceOeeEnvelopeDto {
  devices: DeviceOeeDto[]
  dailyTrend: OeeDayDto[]
}

export interface CriticalSlaBucketDto {
  bucket: string
  count: number
}

export interface CriticalOverdueDto {
  id: string
  severity: string
  state: string
  createdAt: string
  ackedAt: string | null
  responseMinutes: number
}

export interface CriticalSlaDto {
  total: number
  slaMinutes: number
  complianceRate: number
  avgResponseMinutes: number
  distribution: CriticalSlaBucketDto[]
  overdue: CriticalOverdueDto[]
}

export interface TrendPointDto {
  date: string
  examCount: number
  reportCount: number
  completionRate: number
  avgReportMinutes: number
  overtimeCount: number
  criticalCount: number
}

export const biApi = {
  getKpi: () => api.get<BiEnvelope<KpiDto>>('/bi/kpi'),

  getReportTimeliness: () => api.get<BiEnvelope<TimelinessDto>>('/bi/report-timeliness'),

  getPhysicianRvu: () => api.get<BiEnvelope<PhysicianRvuEnvelopeDto>>('/bi/physician-rvu'),

  getDeviceOee: (days = 14) =>
    api.get<BiEnvelope<DeviceOeeEnvelopeDto>>(`/bi/device-oee?days=${days}`),

  getCriticalSla: () => api.get<BiEnvelope<CriticalSlaDto>>('/bi/critical-sla'),

  getTrend: (days = 30) =>
    api.get<BiEnvelope<TrendPointDto[]>>(`/bi/trend?days=${days}`),
}
