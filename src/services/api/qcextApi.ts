import { api, invalidateApiCache } from './client'

export interface QcDashboardDto {
  id: string
  totalInspected: number
  passedRate: number
  excellentRate: number
  defectRate: number
  avgScore: number
  period: string
}

export interface QcImageDto {
  id: string
  patientName: string
  device: string
  score: number
  issues: string[]
  status: string
  examDate: string
  modality: string
}

export interface RadiologistAnnualDto {
  id: string
  doctorId: string
  doctorName: string
  year: number
  totalScore: number
  formatScore: number
  accuracyScore: number
  timelinessScore: number
  reportCount: number
  defectCount: number
  grade: string
}

export interface QcDefectDto {
  id: string
  reportId: string
  defectType: string
  description: string
  severity: string
  status: string
  createdAt: string
  reportedBy: string
}

export interface QcStatsDto {
  totalReports: number
  avgScore: number
  gradeDistribution: { grade: string; count: number; percentage: number }[]
  defectDistribution: { defectType: string; count: number; percentage: number }[]
}

export interface QcScoreDto {
  doctorId: string
  doctorName: string
  totalScore: number
  formatScore: number
  accuracyScore: number
  timelinessScore: number
  reportCount: number
  rank: number
  grade: string
}

export const qcextApi = {
  // Dashboard
  getQcDashboard: () =>
    api.get<QcDashboardDto>('/qc-ext/dashboard'),

  // [G005 W2] 单个质控仪表盘记录 (后端 GET /qc-ext/dashboard/:id)
  getQcDashboardItem: (id: string) =>
    api.get<QcDashboardDto>(`/qc-ext/dashboard/${encodeURIComponent(id)}`),

  // Image QC
  listQcImages: () =>
    api.get<QcImageDto[]>('/qc-ext/image'),

  // [G005 W2] 单张影像质控详情 (后端 GET /qc-ext/image/:id)
  getQcImage: (id: string) =>
    api.get<QcImageDto>(`/qc-ext/image/${encodeURIComponent(id)}`),

  rateQcImage: async (id: string, data: { score: number; issues?: string[] }) => {
    const res = await api.post<QcImageDto>(`/qc-ext/image/${id}/rate`, data)
    await invalidateApiCache('/qc-ext/image')
    return res
  },

  // Radiologist annual
  listRadiologistAnnual: () =>
    api.get<RadiologistAnnualDto[]>('/qc-ext/radiologist-annual'),

  getRadiologistAnnual: (id: string) =>
    api.get<RadiologistAnnualDto>(`/qc-ext/radiologist-annual/${id}`),

  // Defects
  listQcDefects: () =>
    api.get<QcDefectDto[]>('/qc-ext/defect'),

  reportQcDefect: async (data: Partial<QcDefectDto>) => {
    const res = await api.post<QcDefectDto>('/qc-ext/defect', data)
    await invalidateApiCache('/qc-ext/defect')
    return res
  },

  // Stats
  getQcStats: () =>
    api.get<QcStatsDto>('/qc-ext/stats'),

  // Scores
  listQcScores: () =>
    api.get<QcScoreDto[]>('/qc-ext/scores'),
}
