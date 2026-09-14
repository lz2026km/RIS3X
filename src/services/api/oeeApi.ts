import { api } from './client'

// OEE (设备综合效率) API
// Backend: GET /oee/list, /oee/detail/:deviceId, /oee/trend/:deviceId, /oee/stats

export interface OeeDeviceMetric {
  id: string
  name: string
  model: string
  modality: string
  oee: number
  availability: number
  performance: number
  quality: number
  trend: 'up' | 'down' | 'stable'
  source: 'actual' | 'derived'
}

export interface OeePoint {
  date: string
  oee: number
  availability: number
  performance: number
  quality: number
  source: 'actual' | 'derived'
}

export interface OeeDeviceDetail extends OeeDeviceMetric {
  breakdownLoss: number
  setupLoss: number
  speedLoss: number
  defectLoss: number
}

export interface OeeStats {
  highest: number
  lowest: number
  average: number
  totalDevices: number
}

// ===== [v3.0.6.11-104 Wave 2D] OEE 运维看板扩展端点 (总览/模态对比/30日趋势/停机分析) =====

export interface OeeOverviewDto {
  date: string
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  totalDevices: number
  totalModalities: number
  bestDevice: { id: string; name: string; oee: number } | null
  worstDevice: { id: string; name: string; oee: number } | null
  byModality: Array<{ modality: string; devices: number; oee: number }>
  seeded: boolean
}

export interface OeeModalityDto {
  modality: string
  deviceCount: number
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  bestDevice: string
  worstDevice: string
}

export interface OeeDailyTrendPoint {
  date: string
  label: string
  oee: number
  availability: number
  performance: number
  quality: number
  devices: number
  seeded: boolean
}

export interface DowntimeReasonDto {
  reason: string
  reasonZh: string
  durationMinutes: number
  durationHours: number
  percent: number
}

export interface DowntimeAnalysisDto {
  deviceId: string
  deviceName: string
  modality: string
  date: string
  totalDowntimeMinutes: number
  plannedMinutes: number
  unplannedMinutes: number
  reasons: DowntimeReasonDto[]
  seeded: boolean
}

export const oeeApi = {
  list: () => api.get<OeeDeviceMetric[]>('/oee/list'),

  getDetail: (deviceId: string) => api.get<OeeDeviceDetail>(`/oee/detail/${deviceId}`),

  getTrend: (deviceId: string) => api.get<OeePoint[]>(`/oee/trend/${deviceId}`),

  getStats: () => api.get<OeeStats>('/oee/stats'),

  // [v3.0.6.11-104 Wave 2D]
  getOverview: () => api.get<OeeOverviewDto>('/oee/overview'),

  getByModality: () => api.get<OeeModalityDto[]>('/oee/by-modality'),

  getDailyTrend: (days = 30) => api.get<OeeDailyTrendPoint[]>(`/oee/daily-trend?days=${days}`),

  getDowntimeAnalysis: (id: string) =>
    api.get<DowntimeAnalysisDto>(`/oee/${encodeURIComponent(id)}/downtime-analysis`),
}
