import { api, invalidateApiCache } from './client'

// Dual Read (双阅片) API
// Backend: /dual-read/*

export interface DualReadAssignment {
  id: string
  studyId: string
  patientName: string
  patientId: string
  modality: string
  reader1Id: string
  reader1Name: string
  reader2Id: string
  reader2Name: string
  report1?: string
  report2?: string
  status: 'pending' | 'reader1_done' | 'reader2_done' | 'both_done' | 'arbitrated'
  discrepancyScore?: number
  arbitrationReport?: string
  arbitratorId?: string
  arbitratorName?: string
  createdAt: string
  updatedAt: string
}

export interface CreateDualReadDto {
  studyId: string
  patientId: string
  reader1Id: string
  reader2Id: string
}

export interface SubmitDualReadDto {
  report: string
  readerNumber: 1 | 2
}

export interface ArbitrateDto {
  arbitrationReport: string
}

export interface DualReadStats {
  totalAssignments: number
  pendingCount: number
  bothDoneCount: number
  arbitratedCount: number
  avgDiscrepancy: number
}

export const dualReadApi = {
  listAssignments: (params?: { status?: string; page?: number; pageSize?: number }) =>
    api.get<DualReadAssignment[]>(`/dual-read/assignments?${new URLSearchParams(params ?? {}).toString()}`),

  getAssignment: (id: string) =>
    api.get<DualReadAssignment>(`/dual-read/assignments/${id}`),

  createAssignment: async (data: CreateDualReadDto) => {
    const res = await api.post<DualReadAssignment>('/dual-read/assignments', data)
    await invalidateApiCache('/dual-read/assignments')
    return res
  },

  submitReport: async (assignmentId: string, data: SubmitDualReadDto) => {
    const res = await api.post<DualReadAssignment>(`/dual-read/assignments/${assignmentId}/submit`, data)
    await invalidateApiCache(`/dual-read/assignments/${assignmentId}`)
    return res
  },

  arbitrate: async (assignmentId: string, data: ArbitrateDto) => {
    const res = await api.post<DualReadAssignment>(`/dual-read/assignments/${assignmentId}/arbitrate`, data)
    await invalidateApiCache(`/dual-read/assignments/${assignmentId}`)
    return res
  },

  getStats: () =>
    api.get<DualReadStats>('/dual-read/stats'),

  deleteAssignment: async (id: string) => {
    const res = await api.delete(`/dual-read/assignments/${id}`)
    await invalidateApiCache('/dual-read/assignments')
    return res
  },
}
