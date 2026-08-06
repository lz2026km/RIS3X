import { api } from './client'

export interface WorklistItemDto {
  id: string; accessionNo: string; patientName: string; patientId: string; patientSex?: string; patientAge?: string;
  modality: string; examCode: string; examName: string; bodyPart?: string; status: string; priority?: string;
  referringPhysician?: string; scheduledAt: string; createdAt: string; isUrgent?: boolean
}
export interface WorklistQueryParams { page?: number; pageSize?: number; status?: string; modality?: string; patientId?: string; dateFrom?: string; dateTo?: string; search?: string }
export interface WorklistStatsDto { total: number; byStatus: Record<string, number> }
export interface AssignWorklistDto { doctorId?: string; deviceId?: string }

export const worklistApi = {
  list: (params?: WorklistQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<{ items: WorklistItemDto[]; total: number }>(`/worklist?${sp.toString()}`)
  },
  getById: (id: string) => api.get<WorklistItemDto>(`/worklist/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/worklist/${id}`, { status }),
  assign: (id: string, dto: AssignWorklistDto) => api.post(`/worklist/${id}/assign`, dto),
  getStats: () => api.get<WorklistStatsDto>('/worklist/stats'),
  batchAssign: (ids: string[], dto: AssignWorklistDto) => api.post('/worklist/batch-assign', { ids, ...dto }),
}
