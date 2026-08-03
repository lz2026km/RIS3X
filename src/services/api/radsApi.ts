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
  // v3.0.6.11-60: 多 RADS 扩展
  scorePiRads: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/pi-rads', dto),
  scoreLiRads: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/li-rads', dto),
  scoreTiRads: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/ti-rads', dto),
  getHistory: (patientId: string) => api.get<RadsHistoryEntry[]>(`/ai/cad/rads/history/${patientId}`),
}
