import { api } from './client'

export interface CadModelDto { id: string; name: string; modality: string; bodyPart: string; version: string; status: string; accuracy?: number; createdAt: string }
export interface CadAnalysisDto { id: string; examId: string; modelId: string; findings: CadFindingDto[]; status: string; processingTime?: number; analyzedAt: string }
export interface CadFindingDto { id: string; type: string; location: string; size?: number; probability: number; description?: string; coordinates?: { x: number; y: number; z: number } }

export const cadApi = {
  listModels: () => api.get<CadModelDto[]>('/cad/models'),
  getModel: (id: string) => api.get<CadModelDto>(`/cad/models/${id}`),
  analyze: (data: { examId: string; modelId: string; seriesUid?: string }) => api.post<CadAnalysisDto>('/cad/analyze', data),
  getAnalysis: (id: string) => api.get<CadAnalysisDto>(`/cad/analysis/${id}`),
  listAnalyses: (params?: { examId?: string; status?: string }) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<CadAnalysisDto[]>(`/cad/analysis?${sp.toString()}`)
  },
  review: (id: string, data: { confirmed: boolean; notes?: string }) => api.post(`/cad/analysis/${id}/review`, data),
}
