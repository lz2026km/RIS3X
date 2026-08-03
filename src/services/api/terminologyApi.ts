import { api } from './client'

export interface TerminologyMapping {
  id: string
  source: string
  sourceSystem: string
  target: string
  targetSystem: string
  mapType: 'equivalent' | 'broader' | 'narrower' | 'related'
  status: 'active' | 'draft' | 'retired'
  updatedAt: string
}

export interface TerminologySystemStatus {
  system: string
  version: string
  concepts: number
  status: 'online' | 'degraded' | 'offline'
  lastSync: string
}

export interface TerminologyStats {
  totalConcepts: number
  totalMappings: number
  systems: number
  activeMappings: number
  onlineSystems: number
}

export const terminologyApi = {
  listMappings: () => api.get<TerminologyMapping[]>('/terminology/mappings'),

  createMapping: (data: Partial<TerminologyMapping>) =>
    api.post<TerminologyMapping>('/terminology/mappings', data),

  deleteMapping: (id: string) => api.delete(`/terminology/mappings/${id}`),

  listSystems: () => api.get<TerminologySystemStatus[]>('/terminology/systems'),

  getStats: () => api.get<TerminologyStats>('/terminology/stats'),
}
