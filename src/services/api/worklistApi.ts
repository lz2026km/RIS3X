import { api, invalidateApiCacheByPrefix } from './client'

export interface WorklistItemDto {
  id: string; accessionNo: string; patientName: string; patientId: string; patientSex?: string; patientAge?: string;
  modality: string; examCode: string; examName: string; bodyPart?: string; status: string; priority?: string;
  referringPhysician?: string; scheduledAt: string; createdAt: string; isUrgent?: boolean
}
export interface WorklistQueryParams { page?: number; pageSize?: number; status?: string; modality?: string; patientId?: string; dateFrom?: string; dateTo?: string; search?: string }
export interface WorklistStatsDto { total: number; byStatus: Record<string, number> }
export interface AssignWorklistDto { doctorId?: string; deviceId?: string; roomId?: string }

// [G005 Wave1A W9] 状态流转: checkin/start/complete/cancel 后失效 /worklist 前缀缓存
async function invalidateWorklist(): Promise<void> {
  await invalidateApiCacheByPrefix('/worklist')
}

export const worklistApi = {
  list: (params?: WorklistQueryParams) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<{ items: WorklistItemDto[]; total: number }>(`/worklist?${sp.toString()}`)
  },
  getById: (id: string) => api.get<WorklistItemDto>(`/worklist/${id}`),
  updateStatus: (id: string, status: string) => api.patch(`/worklist/${id}`, { status }),
  updatePriority: (id: string, priority: string) => api.patch(`/worklist/${id}`, { priority }),
  patch: (id: string, fields: Record<string, unknown>) => api.patch(`/worklist/${id}`, fields),
  assign: (id: string, dto: AssignWorklistDto) => api.post(`/worklist/${id}/assign`, dto),
  getStats: () => api.get<WorklistStatsDto>('/worklist/stats'),
  batchAssign: (ids: string[], dto: AssignWorklistDto) => api.post('/worklist/batch-assign', { ids, ...dto }),

  // [G005 Wave1A W9] 后端 POST /worklist/:id/checkin|start|complete|cancel 状态流转
  checkIn: async (id: string) => {
    const res = await api.post(`/worklist/${id}/checkin`, {})
    await invalidateWorklist()
    return res
  },
  start: async (id: string) => {
    const res = await api.post(`/worklist/${id}/start`, {})
    await invalidateWorklist()
    return res
  },
  complete: async (id: string) => {
    const res = await api.post(`/worklist/${id}/complete`, {})
    await invalidateWorklist()
    return res
  },
  cancel: async (id: string, reason?: string) => {
    const res = await api.post(`/worklist/${id}/cancel`, reason ? { reason } : {})
    await invalidateWorklist()
    return res
  },
}
