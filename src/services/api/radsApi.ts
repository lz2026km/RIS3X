import { api } from './client'

export interface RadsScore {
  category: string
  score: string
  description: string
  confidence: number
  findings: string[]
  recommendations: string
}

export interface RadsHistoryEntry {
  date: string
  score: string
  category: string
  confidence: number
}

export const radsApi = {
  scoreLung: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/lung', dto),
  scoreBreast: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/breast', dto),
  scoreProstate: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/prostate', dto),
  getHistory: (patientId: string) => api.get<RadsHistoryEntry[]>(`/ai/cad/rads/history/${patientId}`),
}
