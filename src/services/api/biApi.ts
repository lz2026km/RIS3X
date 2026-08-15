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

// ── [v3.0.6.11-99 Wave 5B-A] BI 大屏模板库 ──────────────────────────────
export type WallLayout = 'overview' | 'equipment' | 'quality' | 'finance' | 'mixed'

export interface WallTemplateDto {
  id: string
  name: string
  layout: WallLayout
  /** 区块组合: kpi | top10 | critical | occupancy | oee | quality | sla | revenue | bonus */
  config: { blocks?: string[]; autoRotateMs?: number } & Record<string, unknown>
  active: boolean
  createdAt: string
  updatedAt: string
}

// ── [v3.0.6.11-99 Wave 5B-B] 医生绩效 ───────────────────────────────────
export interface PhysicianPerformanceRowDto {
  doctorName: string
  reportCount: number
  rvu: number
  avgTurnaround: number
  qualityScore: number
  accuracyScore: number
  qualityCoefficient: number
  bonus: number
}

export interface PhysicianPerformanceDto {
  totalRvu: number
  bonus: number
  reportCount: number
  avgTurnaround: number
  qualityScore: number
  accuracyScore: number
  byPhysician: PhysicianPerformanceRowDto[]
  rules: { rvuUnitPrice: number; qualityCoefficients: Record<string, number> }
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

  getPhysicianPerformance: () =>
    api.get<BiEnvelope<PhysicianPerformanceDto>>('/bi/physician-performance'),

  // ── Wave 5B-A 大屏模板库 (后端返回 { source, data } 信封) ──
  getWallTemplates: () => api.get<BiEnvelope<WallTemplateDto[]>>('/bi/wall-templates'),

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getWallTemplate: (id: string) => api.get<WallTemplateDto>(`/bi/wall-templates/${id}`),

  createWallTemplate: (data: { name: string; layout: WallLayout; config?: Record<string, unknown>; active?: boolean }) =>
    api.post<WallTemplateDto>('/bi/wall-templates', data),

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  updateWallTemplate: (id: string, data: Partial<{ name: string; layout: WallLayout; config: Record<string, unknown>; active: boolean }>) =>
    api.patch<WallTemplateDto>(`/bi/wall-templates/${id}`, data),

  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  deleteWallTemplate: (id: string) =>
    api.delete<{ id: string; deleted: boolean }>(`/bi/wall-templates/${id}`),
}
