import { api, invalidateApiCache } from './client'

// [G005 Wave 3A v3.0.6.11-99] qc-pdca 质控闭环模块 API
// 后端: backend/src/modules/qc-pdca/ (内存 CRUD + seed; 关联缺陷从 auditLog 派生)

export type PdcaPhaseCode = 'plan' | 'do' | 'check' | 'act' | 'completed'
export type PdcaCategory = '报告质控' | '图像质控' | '流程质控' | '服务质控'

export interface PdcaPhaseEntry {
  id: string
  phase: Exclude<PdcaPhaseCode, 'completed'>
  content: string
  createdAt: string
  updatedAt: string
}

export interface PdcaCycle {
  id: string
  title: string
  category: PdcaCategory
  description: string
  target: string
  ownerId: string
  ownerName: string
  phase: PdcaPhaseCode
  status: '进行中' | '已完成'
  startDate: string
  dueDate: string
  completedAt?: string
  summary?: string
  defectIds: string[]
  createdAt: string
  updatedAt: string
}

export interface PdcaCycleDetail extends PdcaCycle {
  phases: PdcaPhaseEntry[]
}

export interface PdcaDefectRef {
  id: string
  defectType: string
  description: string
  severity: string
  status: string
  reportedBy: string
  reportedAt: string
}

export interface PdcaEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
}

export interface PdcaStats {
  total: number
  byPhase: Record<string, number>
  completionRate: number
  byCategory: Record<string, number>
  avgDurationDays: number
  inProgress: number
}

export const qcPdcaApi = {
  listCycles: () => api.get<PdcaEnvelope<PdcaCycle[]>>('/qc-pdca/cycles'),

  createCycle: async (data: { title: string; category: PdcaCategory; description?: string; target?: string; ownerId?: string }) => {
    const res = await api.post<PdcaCycle>('/qc-pdca/cycles', data)
    await invalidateApiCache('/qc-pdca/cycles')
    return res
  },

  getCycle: (id: string) => api.get<PdcaCycleDetail>(`/qc-pdca/cycles/${id}`),

  updateCycle: async (id: string, data: Partial<Omit<PdcaCycle, 'id' | 'phase' | 'status'>>) => {
    const res = await api.patch<PdcaCycle>(`/qc-pdca/cycles/${id}`, data)
    await invalidateApiCache('/qc-pdca/cycles')
    return res
  },

  deleteCycle: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`/qc-pdca/cycles/${id}`)
    await invalidateApiCache('/qc-pdca/cycles')
    return res
  },

  advanceCycle: async (id: string) => {
    const res = await api.post<PdcaCycle>(`/qc-pdca/cycles/${id}/advance`)
    await invalidateApiCache('/qc-pdca/cycles')
    return res
  },

  completeCycle: async (id: string, data: { summary?: string }) => {
    const res = await api.post<PdcaCycle>(`/qc-pdca/cycles/${id}/complete`, data)
    await invalidateApiCache('/qc-pdca/cycles')
    return res
  },

  listPhases: (id: string) => api.get<PdcaEnvelope<PdcaPhaseEntry[]>>(`/qc-pdca/cycles/${id}/phases`),

  addPhase: async (id: string, data: { phase: Exclude<PdcaPhaseCode, 'completed'>; content: string }) => {
    const res = await api.post<PdcaPhaseEntry>(`/qc-pdca/cycles/${id}/phases`, data)
    await invalidateApiCache(`/qc-pdca/cycles/${id}`)
    return res
  },

  updatePhase: async (phaseId: string, data: Partial<{ phase: Exclude<PdcaPhaseCode, 'completed'>; content: string }>) => {
    const res = await api.patch<PdcaPhaseEntry>(`/qc-pdca/phases/${phaseId}`, data)
    await invalidateApiCache(`/qc-pdca/phases/${phaseId}`)
    return res
  },

  listCycleDefects: (id: string) => api.get<PdcaEnvelope<PdcaDefectRef[]>>(`/qc-pdca/cycles/${id}/defects`),

  linkDefect: async (id: string, data: { defectId: string }) => {
    const res = await api.post<{ linked: boolean; defectIds: string[] }>(`/qc-pdca/cycles/${id}/defects`, data)
    await invalidateApiCache(`/qc-pdca/cycles/${id}`)
    return res
  },

  getStats: () => api.get<PdcaEnvelope<PdcaStats>>('/qc-pdca/stats'),

  listAllDefects: () => api.get<PdcaEnvelope<PdcaDefectRef[]>>('/qc-pdca/defects'),
}
