import { api } from './client'

// [G005 Wave1B P1] 术语管理 API — 后端已实现 /terminology controller
// (terminology.module, DictEntry 派生 + seed 回退 + 内存 CRUD), MSW 标注已更新。
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
