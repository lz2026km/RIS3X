import { api, invalidateApiCache } from './client'

// Breast CAD (乳腺 AI 检测) API
// Backend: /ai-diagnosis/breast-cad/*

export interface BreastLesion {
  id: string
  studyId: string
  view: string
  x: number
  y: number
  width: number
  height: number
  type: 'mass' | 'calcification' | 'architectural_distortion' | 'asymmetry'
  shape: 'round' | 'oval' | 'irregular'
  margin: 'circumscribed' | 'obscured' | 'spiculated' | 'microlobulated'
  density: 'high' | 'equal' | 'low'
  biRads: '2' | '3' | '4a' | '4b' | '4c' | '5'
  malignancyRisk: number
}

export interface BreastCadResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  lesionCount: number
  lesions: BreastLesion[]
  overallBiRads: string
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface BreastCadReviewDto {
  lesionId: string
  status: 'confirmed' | 'rejected' | 'amended'
  amendedBiRads?: string
  comment?: string
}

export interface BreastCadStats {
  totalStudies: number
  totalLesions: number
  biRadsDistribution: { biRads: string; count: number }[]
  typeDistribution: { type: string; count: number }[]
}

export const breastCadApi = {
  listResults: (params?: { studyId?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<BreastCadResult[]>(`/ai-diagnosis/breast-cad/results?${new URLSearchParams(params ?? {}).toString()}`),

  getResult: (id: string) =>
    api.get<BreastCadResult>(`/ai-diagnosis/breast-cad/results/${id}`),

  analyzeStudy: (studyId: string) =>
    api.post<BreastCadResult>(`/ai-diagnosis/breast-cad/analyze/${studyId}`, {}),

  reviewLesion: async (resultId: string, data: BreastCadReviewDto) => {
    const res = await api.post<BreastCadResult>(`/ai-diagnosis/breast-cad/results/${resultId}/review`, data)
    await invalidateApiCache('/ai-diagnosis/breast-cad/results')
    return res
  },

  getStats: () =>
    api.get<BreastCadStats>('/ai-diagnosis/breast-cad/stats'),
}
