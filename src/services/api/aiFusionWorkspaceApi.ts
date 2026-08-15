import { api } from './client'

export interface FusionStudy {
  id: string
  patient: string
  modalities: string
  fusionScore: number
  findings: number
  aiAlerts: number
  status: 'complete' | 'pending'
  date: string
}

export interface AiInsight {
  id: string
  type: 'lesion' | 'vessel' | 'measurement' | 'classification'
  finding: string
  confidence: number
  modality: string
  source: string
  actionable: boolean
}

export interface FusionWorkspaceData {
  studies: FusionStudy[]
  aiInsights: AiInsight[]
}

export const aiFusionWorkspaceApi = {
  /** @deprecated v3.0.6.11-100 unused — 无页面引用，仅供 API 兼容保留 */
  getWorkspaceData: (modality?: string) =>
    api.get<FusionWorkspaceData>(`/ai/fusion-workspace${modality ? `?modality=${modality}` : ''}`),

  getStudies: () => api.get<FusionStudy[]>('/ai/fusion-workspace/studies'),

  getInsights: () => api.get<AiInsight[]>('/ai/fusion-workspace/insights'),

  runFusion: (studyId?: string) =>
    api.post<FusionStudy>('/ai/fusion-workspace/run', { studyId }),
}
