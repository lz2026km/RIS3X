import { api, invalidateApiCache } from './client'

// Lung CAD (肺结节 AI 检测) API
// Backend: /ai-diagnosis/lung-cad/*

export interface LungNodule {
  id: string
  studyId: string
  patientName: string
  modality: string
  sliceLocation: number
  x: number
  y: number
  z: number
  diameter: number
  volume: number
  density: 'solid' | 'partSolid' | 'groundGlass' | 'calcified'
  malignancyRisk: number
  characteristics: string[]
  lidcId?: string
}

export interface LungCadResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  noduleCount: number
  nodules: LungNodule[]
  overallRisk: 'low' | 'moderate' | 'high' | 'very_high'
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface LungCadReviewDto {
  noduleId: string
  status: 'confirmed' | 'rejected' | 'amended'
  amendedDiagnosis?: string
  comment?: string
}

export interface LungCadStats {
  totalStudies: number
  totalNodules: number
  avgNodulesPerStudy: number
  riskDistribution: { risk: string; count: number }[]
  sizeDistribution: { range: string; count: number }[]
}

export const lungCadApi = {
  listResults: (params?: { studyId?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<LungCadResult[]>(`/ai-diagnosis/lung-cad/results?${new URLSearchParams(params ?? {}).toString()}`),

  getResult: (id: string) =>
    api.get<LungCadResult>(`/ai-diagnosis/lung-cad/results/${id}`),

  analyzeStudy: (studyId: string) =>
    api.post<LungCadResult>(`/ai-diagnosis/lung-cad/analyze/${studyId}`, {}),

  reviewNodule: async (resultId: string, data: LungCadReviewDto) => {
    const res = await api.post<LungCadResult>(`/ai-diagnosis/lung-cad/results/${resultId}/review`, data)
    await invalidateApiCache('/ai-diagnosis/lung-cad/results')
    return res
  },

  getStats: () =>
    api.get<LungCadStats>('/ai-diagnosis/lung-cad/stats'),
}
