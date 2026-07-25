import { api } from './client'
import type { ApiResponse } from './types'

// Co-sign API
// Auto-generated from NestJS @Controller('cosign')

export const cosignApi = {
  pending: () => api.get<unknown>('/cosign/pending'),
  pendingbyId: (id: string) => api.get<unknown>(`/cosign/pending/${id}`),
  pendingbyIdApprove: (id: string, data: Record<string, unknown>) => api.post<unknown>(`/cosign/pending/${id}/approve`, data),
  pendingbyIdReject: (id: string, data: Record<string, unknown>) => api.post<unknown>(`/cosign/pending/${id}/reject`, data),
  history: () => api.get<unknown>('/cosign/history'),
  rules: () => api.get<unknown>('/cosign/rules'),
  rules: (data: Record<string, unknown>) => api.post<unknown>('/cosign/rules', data),
  stats: () => api.get<unknown>('/cosign/stats'),
}

export default cosignApi
