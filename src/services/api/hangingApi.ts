import { api, invalidateApiCache } from './client'

export interface HangingLayout {
  rows: number
  cols: number
  seriesOrder: string[]
}

export interface HangingProtocol {
  id: string
  name: string
  modality: string
  bodyPart: string
  layout: HangingLayout
  priority: number
  description: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface HangingProtocolInput {
  name: string
  modality: string
  bodyPart: string
  layout: HangingLayout
  priority?: number
  description?: string
  enabled?: boolean
}

export interface MatchSeriesInput {
  description?: string
  modality?: string
  seriesNumber?: number
  images?: number
}

export interface HangingMatchInput {
  modality: string
  bodyPart?: string
  seriesCount?: number
  series?: MatchSeriesInput[]
}

export interface HangingMatchCell {
  index: number
  series?: string
  empty: boolean
}

export interface HangingMatchResult {
  protocol: HangingProtocol | null
  layout: HangingLayout
  score: number
  reasons: string[]
  cells: HangingMatchCell[]
  candidates: { id: string; name: string; score: number }[]
}

export const hangingApi = {
  list: (params?: { modality?: string; bodyPart?: string }) => {
    const qs = new URLSearchParams()
    if (params?.modality) qs.set('modality', params.modality)
    if (params?.bodyPart) qs.set('bodyPart', params.bodyPart)
    const query = qs.toString()
    return api.get<HangingProtocol[]>(`/hanging/protocols${query ? `?${query}` : ''}`)
  },
  get: (id: string) => api.get<HangingProtocol>(`/hanging/protocols/${id}`),
  create: async (data: HangingProtocolInput) => {
    const res = await api.post<HangingProtocol>('/hanging/protocols', data)
    await invalidateApiCache('/hanging/protocols')
    return res
  },
  update: async (id: string, data: Partial<HangingProtocolInput>) => {
    const res = await api.put<HangingProtocol>(`/hanging/protocols/${id}`, data)
    await invalidateApiCache('/hanging/protocols')
    return res
  },
  remove: async (id: string) => {
    const res = await api.delete<{ success: boolean }>(`/hanging/protocols/${id}`)
    await invalidateApiCache('/hanging/protocols')
    return res
  },
  match: (input: HangingMatchInput) => api.post<HangingMatchResult>('/hanging/match', input),
}
