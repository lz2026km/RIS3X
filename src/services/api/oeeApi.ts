import { api } from './client'

// OEE (设备综合效率) API
// Backend: /oee/*

export interface OeeRecord {
  id: string
  deviceId: string
  deviceName: string
  department: string
  date: string
  availability: number
  performance: number
  quality: number
  oee: number
  uptimeMinutes: number
  downtimeMinutes: number
  totalScans: number
  goodScans: number
}

export interface OeeSummary {
  period: string
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgQuality: number
  totalUptime: number
  totalDowntime: number
  deviceCount: number
}

export interface OeeQueryParams {
  deviceId?: string
  department?: string
  startDate?: string
  endDate?: string
  page?: number
  pageSize?: number
}

export interface OeeTrend {
  date: string
  oee: number
  availability: number
  performance: number
  quality: number
}

export interface OeeDowntimeReason {
  reason: string
  count: number
  totalMinutes: number
  percentage: number
}

export const oeeApi = {
  listRecords: (params?: OeeQueryParams) =>
    api.get<OeeRecord[]>(`/oee/records?${new URLSearchParams(params ?? {}).toString()}`),

  getRecord: (id: string) =>
    api.get<OeeRecord>(`/oee/records/${id}`),

  getSummary: (params?: { startDate?: string; endDate?: string }) =>
    api.get<OeeSummary>(`/oee/summary?${new URLSearchParams(params ?? {}).toString()}`),

  getTrend: (params?: { deviceId?: string; days?: number }) =>
    api.get<OeeTrend[]>(`/oee/trend?${new URLSearchParams(params ?? {}).toString()}`),

  getDowntimeReasons: (params?: { deviceId?: string; startDate?: string; endDate?: string }) =>
    api.get<OeeDowntimeReason[]>(`/oee/downtime-reasons?${new URLSearchParams(params ?? {}).toString()}`),

  getDeviceRanking: (params?: { startDate?: string; endDate?: string }) =>
    api.get<OeeRecord[]>(`/oee/ranking?${new URLSearchParams(params ?? {}).toString()}`),
}
