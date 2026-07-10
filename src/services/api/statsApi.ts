import { api } from './client'

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

export const statsApi = {
  getDaily: () =>
    api.get<DailyStatsDto>('/stats/daily'),

  getWeekly: () =>
    api.get<WeeklyStatsDto>('/stats/weekly'),

  getWorkload: () =>
    api.get<WorkloadDto[]>('/stats/workload'),

  getQuality: () =>
    api.get<QualityDto>('/stats/quality'),

  getDashboard: () =>
    api.get<any>('/stats/dashboard'),

  getByModality: () =>
    api.get<any[]>('/stats/by-modality'),

  getTrend: (days = 30) =>
    api.get<any[]>(`/stats/trend?days=${days}`),

  getTopModalities: (limit = 10) =>
    api.get<any[]>(`/stats/top-modalities?limit=${limit}`),

  getTopDevices: (limit = 10) =>
    api.get<any[]>(`/stats/top-devices?limit=${limit}`),

  exportCsv: () =>
    api.get<{ url: string }>('/stats/export.csv'),
}
