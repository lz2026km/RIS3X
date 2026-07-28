import { api, invalidateApiCache } from './client'

// Fracture CAD (骨折 AI 检测) API
// Backend: /ai-diagnosis/fracture-cad/*

export interface FractureFinding {
  id: string
  studyId: string
  bone: string
  fractureType: 'simple' | 'comminuted' | 'open' | 'stress' | 'pathological' | 'avulsion'
  location: string
  displacement: 'minimal' | 'moderate' | 'significant'
  comminution: boolean
  jointInvolvement: boolean
  confidence: number
  boundingBox: { x: number; y: number; width: number; height: number }
}

export interface FractureCadResult {
  id: string
  studyId: string
  patientName: string
  modality: string
  bodyPart: string
  fractureCount: number
  fractures: FractureFinding[]
  severity: 'mild' | 'moderate' | 'severe'
  recommendation: string
  modelVersion: string
  status: 'auto' | 'reviewed' | 'confirmed'
  createdAt: string
}

export interface FractureCadReviewDto {
  findingId: string
  status: 'confirmed' | 'rejected' | 'amended'
  amendedDiagnosis?: string
  comment?: string
}

export interface FractureCadStats {
  totalStudies: number
  totalFractures: number
  boneDistribution: { bone: string; count: number }[]
  typeDistribution: { type: string; count: number }[]
}

export const fractureCadApi = {
  listResults: (params?: { studyId?: string; bodyPart?: string; status?: string; page?: number; pageSize?: number }) =>
    api.get<FractureCadResult[]>(`/ai-diagnosis/fracture-cad/results?${new URLSearchParams(params ?? {}).toString()}`),

  getResult: (id: string) =>
    api.get<FractureCadResult>(`/ai-diagnosis/fracture-cad/results/${id}`),

  analyzeStudy: (studyId: string) =>
    api.post<FractureCadResult>(`/ai-diagnosis/fracture-cad/analyze/${studyId}`, {}),

  reviewFinding: async (resultId: string, data: FractureCadReviewDto) => {
    const res = await api.post<FractureCadResult>(`/ai-diagnosis/fracture-cad/results/${resultId}/review`, data)
    await invalidateApiCache('/ai-diagnosis/fracture-cad/results')
    return res
  },

  getStats: () =>
    api.get<FractureCadStats>('/ai-diagnosis/fracture-cad/stats'),
}
