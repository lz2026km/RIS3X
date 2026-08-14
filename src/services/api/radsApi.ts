import { api } from './client'

export interface RadsScore {
  category: string
  score: string
  level?: string
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

export interface RadsRule {
  level: string
  category: string
  description: string
  criteria: string
  recommendations: string
}

export interface RadsRules {
  type: string
  name: string
  levels: RadsRule[]
}

export const radsApi = {
  scoreLung: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/lung', dto),
  scoreBreast: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/breast', dto),
  scoreProstate: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/prostate', dto),
  // v3.0.6.11-60: 多 RADS 扩展
  scorePiRads: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/pi-rads', dto),
  scoreLiRads: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/li-rads', dto),
  scoreTiRads: (dto: Record<string, any>) => api.post<RadsScore>('/ai/cad/rads/ti-rads', dto),
  // v3.0.6.11-99 G-20: 统一确定性评分 {type, findings} → level + description
  score: (dto: { type: string; findings: Record<string, any> }) => api.post<RadsScore>('/ai/cad/rads/score', dto),
  // v3.0.6.11-99 G-20: 评分规则表 (criteria/level 映射)
  getRules: () => api.get<RadsRules[]>('/ai/cad/rads/rules'),
  // v3.0.6.11-99 G-20: 评分统计
  getStats: () => api.get<{ total: number; byType: Record<string, number> }>('/ai/cad/rads/stats'),
  getHistory: (patientId: string) => api.get<RadsHistoryEntry[]>(`/ai/cad/rads/history/${patientId}`),
}
