import { api, invalidateApiCacheByPrefix } from './client'

export interface WorklistItemDto {
  id: string; accessionNo: string; patientName: string; patientId: string; patientSex?: string; patientAge?: string;
  modality: string; examCode: string; examName: string; bodyPart?: string; status: string; priority?: string;
  referringPhysician?: string; scheduledAt: string; createdAt: string; isUrgent?: boolean
  // [v3.0.6.11-95 Wave1B] 后端 worklist 返回关联患者/设备/时间字段 (技师工作站数据质量)
  state?: string
  startedAt?: string | null
  completedAt?: string | null
  accessionNumber?: string
  gender?: string
  age?: number | null
  deviceName?: string
  deviceModel?: string
  patient?: { id: string; name: string; gender?: string; birthDate?: string | null } | null
  device?: { id: string; name: string; location?: string | null; modality?: string } | null
}
export interface WorklistQueryParams { page?: number; pageSize?: number; status?: string; modality?: string; patientId?: string; dateFrom?: string; dateTo?: string; search?: string }
export interface WorklistStatsDto {
  total: number; byStatus: Record<string, number>
  // [v3.0.6.11-95 Wave1B] 检查耗时统计扩展: 当日完成数 / 平均时长 / 技师维度
  completedToday?: number
  avgDurationMin?: number
  byTechnician?: Array<{ id: string; name: string; completedCount: number; avgDurationMin: number }>
}
export interface AssignWorklistDto { doctorId?: string; deviceId?: string; roomId?: string }
export interface BatchTransitionResult { succeeded: Array<{ id: string; state: string }>; failed: Array<{ id: string; message: string }> }

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

  // [v3.0.6.11-95 Wave1B] 批量状态流转: POST /worklist/batch-checkin|start|complete { ids[] }
  batchCheckIn: async (ids: string[]) => {
    const res = await api.post<BatchTransitionResult>('/worklist/batch-checkin', { ids })
    await invalidateWorklist()
    return res
  },
  batchStart: async (ids: string[]) => {
    const res = await api.post<BatchTransitionResult>('/worklist/batch-start', { ids })
    await invalidateWorklist()
    return res
  },
  batchComplete: async (ids: string[]) => {
    const res = await api.post<BatchTransitionResult>('/worklist/batch-complete', { ids })
    await invalidateWorklist()
    return res
  },

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

  // [v3.0.6.11-92 Wave1B P0] 影像质控回写 exam 状态: PATCH /worklist/:id/state (IMAGE_READY|QC_REJECT|QC_PASS)
  // [v3.0.6.11-95 Wave 1A] IN_PROGRESS = 重拍登记 (QC_REJECT → IN_PROGRESS); extras: rating/techNote/qcNote 落库
  updateState: async (
    id: string,
    state: 'IMAGE_READY' | 'QC_REJECT' | 'QC_PASS' | 'IN_PROGRESS',
    note?: string,
    extras?: { rating?: string; techNote?: string; qcNote?: string },
  ) => {
    const body: Record<string, unknown> = { state }
    if (note) body.note = note
    if (extras?.rating) body.rating = extras.rating
    if (extras?.techNote) body.techNote = extras.techNote
    if (extras?.qcNote) body.qcNote = extras.qcNote
    const res = await api.patch(`/worklist/${id}/state`, body)
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-95 Wave 1A P1] 暂停/继续: POST /worklist/:id/pause|resume (IN_PROGRESS → PAUSED → IN_PROGRESS)
  pauseExam: async (id: string, reason?: string) => {
    const res = await api.post(`/worklist/${id}/pause`, reason ? { reason } : {})
    await invalidateWorklist()
    return res
  },
  resumeExam: async (id: string) => {
    const res = await api.post(`/worklist/${id}/resume`, {})
    await invalidateWorklist()
    return res
  },
}
