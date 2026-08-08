import { api } from './client'

export interface CrossModalSearchDto { query: string; modalities?: string[]; dateFrom?: string; dateTo?: string; limit?: number; offset?: number }
export interface CrossModalSearchResult { id: string; score: number; modality: string; studyUid: string; patientName: string; patientId: string; studyDescription: string; studyDate: string; thumbnail?: string; matchedField: string }
export interface CrossModalIndexStatus { totalDocuments: number; lastIndexedAt?: string; status: string; byModality: Record<string, number> }
export interface CrossModalSimilarResult { id: string; patientName: string; patientId: string; modality: string; studyDate: string; description: string; similarity: number; thumbnail?: string; simulated?: boolean }

export const crossModalApi = {
  search: (dto: CrossModalSearchDto) => api.post<CrossModalSearchResult[]>('/cross-modal/search', dto),
  getIndexStatus: () => api.get<CrossModalIndexStatus>('/cross-modal/index-status'),
  reindex: (modality?: string) => api.post('/cross-modal/reindex', { modality }),
  getSuggestions: (query: string) => api.get<string[]>(`/cross-modal/suggestions?q=${encodeURIComponent(query)}`),
  similar: (imageId: string) => api.post<CrossModalSimilarResult[]>('/cross-modal/similar', { imageId }),
}
