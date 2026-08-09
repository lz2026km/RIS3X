import { api } from './client'
import type { ApiResponse } from './types'

export interface DailyStatsDto {
  examCount: number
  reportCount: number
  criticalCount: number
  cosignCount?: number
  avgTAT?: number
  defectCount?: number
  qcAvgScore?: number
  date?: string
  byModality?: Record<string, number>
}

export interface WeeklyStatsDto {
  totalExams: number
  daily: { date: string; count: number }[]
}

export interface WorkloadDto {
  doctorName: string
  examCount: number
  reportCount: number
  avgTime: number
  doctorId?: string
  department?: string
  score?: number
}

export interface QualityDto {
  averageScore: number
  byDoctor: { doctorName: string; score: number }[]
  byModality: { modality: string; score: number }[]
  totalReports?: number
  defectRate?: number
  gradeDistribution?: Record<string, number>
}

// v3.0.6.11-73: 后端 stats 端点统一返回 { source, generatedAt, data } 信封,
// source 标注数据来源 ('database' 真实聚合 / 'seed' 确定性回退)。
// MSW 仍返回 { success, data: {...} } 平铺结构 → 仅在命中信封时解包。
interface StatsEnvelope<T> {
  source: 'database' | 'seed'
  generatedAt: string
  data: T
}

function unwrapEnvelope<T>(res: ApiResponse<StatsEnvelope<T> | T>): ApiResponse<T> {
  if (!res.success) return res as ApiResponse<T>
  const payload = res.data as unknown
  if (payload && typeof payload === 'object') {
    const rec = payload as Record<string, unknown>
    if (typeof rec.source === 'string' && 'data' in rec) {
      return { ...res, data: rec.data as T }
    }
  }
  return res as ApiResponse<T>
}

export const statsApi = {
  getDaily: async () => {
    const res = await api.get<StatsEnvelope<DailyStatsDto> | DailyStatsDto>('/stats/daily')
    return unwrapEnvelope<DailyStatsDto>(res)
  },

  getWeekly: async () => {
    const res = await api.get<StatsEnvelope<WeeklyStatsDto> | WeeklyStatsDto>('/stats/weekly')
    return unwrapEnvelope<WeeklyStatsDto>(res)
  },

  getWorkload: async () => {
    const res = await api.get<StatsEnvelope<WorkloadDto[]> | WorkloadDto[]>('/stats/workload')
    return unwrapEnvelope<WorkloadDto[]>(res)
  },

  getQuality: async () => {
    const res = await api.get<StatsEnvelope<QualityDto> | QualityDto>('/stats/quality')
    return unwrapEnvelope<QualityDto>(res)
  },

  getDashboard: async () => {
    const res = await api.get<StatsEnvelope<any> | any>('/stats/dashboard')
    return unwrapEnvelope<any>(res)
  },

  getByModality: async () => {
    const res = await api.get<StatsEnvelope<any> | any>('/stats/by-modality')
    return unwrapEnvelope<any>(res)
  },

  getTrend: async (days = 30) => {
    const res = await api.get<StatsEnvelope<any[]> | any[]>(`/stats/trend?days=${days}`)
    return unwrapEnvelope<any[]>(res)
  },

  getTopModalities: (limit = 10) =>
    api.get<any[]>(`/stats/top-modalities?limit=${limit}`),

  getTopDevices: (limit = 10) =>
    api.get<any[]>(`/stats/top-devices?limit=${limit}`),

  // [G005 Wave1B] GET /stats/export.csv — 后端直接返回 text/csv 流 (含 BOM)
  exportCsv: () =>
    api.getBlob('/stats/export.csv'),
}
