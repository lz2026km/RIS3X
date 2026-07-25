import { api } from './client'
import type { ApiResponse } from './types'

// IHE integration API
// Auto-generated from NestJS @Controller('ihe')

export const iheApi = {
  status: () => api.get<unknown>('/ihe/status'),
  affinity_domain: () => api.get<unknown>('/ihe/affinity-domain'),
  affinity_domain: (data: Record<string, unknown>) => api.put<unknown>('/ihe/affinity-domain', data),
  affinity_domain: () => api.delete<unknown>('/ihe/affinity-domain'),
  pixFeed: (data: Record<string, unknown>) => api.post<unknown>('/ihe/pix/feed', data),
  pixQuery: (data: Record<string, unknown>) => api.post<unknown>('/ihe/pix/query', data),
  pixUpdate_notification: (data: Record<string, unknown>) => api.post<unknown>('/ihe/pix/update-notification', data),
  pdqQuery: (data: Record<string, unknown>) => api.post<unknown>('/ihe/pdq/query', data),
  pamMessage: (data: Record<string, unknown>) => api.post<unknown>('/ihe/pam/message', data),
  pamVisit: () => api.get<unknown>('/ihe/pam/visit'),
  pamVisit_detail: () => api.get<unknown>('/ihe/pam/visit-detail'),
  pamMessages: () => api.get<unknown>('/ihe/pam/messages'),
  mockRegister_document: () => api.get<unknown>('/ihe/mock/register-document'),
  mockDocuments: () => api.get<unknown>('/ihe/mock/documents'),
  mockPdq: () => api.get<unknown>('/ihe/mock/pdq'),
  mockCross_reference: (data: Record<string, unknown>) => api.post<unknown>('/ihe/mock/cross-reference', data),
}

export default iheApi
