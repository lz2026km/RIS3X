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

export const oeeApi = {
  list: () => api.get<OeeDeviceMetric[]>('/oee/list'),

  getDetail: (deviceId: string) => api.get<OeeDeviceDetail>(`/oee/detail/${deviceId}`),

  getTrend: (deviceId: string) => api.get<OeePoint[]>(`/oee/trend/${deviceId}`),

  getStats: () => api.get<OeeStats>('/oee/stats'),
}
