import { api } from './client'

export interface AiModel {
  id: string
  name: string
  version: string
  modality: string
  description: string
  status: 'running' | 'stopped' | 'error'
  deployedAt: string
  accuracy?: number
}

export interface ModelHealth {
  cpu: number
  memory: number
  gpu?: number
  uptime: string
  requestCount: number
  errorRate: number
}

export interface ModelUsage {
  totalRequests: number
  successRate: number
  avgLatency: number
  dailyStats: { date: string; count: number }[]
}

export interface DeployModelDto {
  name: string
  version: string
  modality: string
  description?: string
}

export const aiMarketplaceApi = {
  listModels: () => api.get<AiModel[]>('/ai/marketplace/models'),

  getModel: (id: string) => api.get<AiModel>(`/ai/marketplace/models/${id}`),

  deployModel: (dto: DeployModelDto) => api.post<AiModel>('/ai/marketplace/models', dto),

  removeModel: (id: string) => api.delete(`/ai/marketplace/models/${id}`),

  getModelHealth: (id: string) => api.get<ModelHealth>(`/ai/marketplace/models/${id}/health`),

  getModelUsage: (id: string) => api.get<ModelUsage>(`/ai/marketplace/models/${id}/usage`),
}
