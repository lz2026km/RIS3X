import { api, invalidateApiCacheByPrefix } from './client'

export interface WorklistItemDto {
  id: string
  // 后端 Exam 原生字段 (GET /worklist, GET /worklist/:id)
  patientId: string
  modality: string
  accessionNumber?: string
  bodyPart?: string
  state?: string
  priority?: string
  scheduledAt?: string
  createdAt?: string
  startedAt?: string | null
  completedAt?: string | null
  deviceId?: string | null
  gender?: string
  age?: number | null
  deviceName?: string
  deviceModel?: string
  patient?: { id: string; name: string; gender?: string; birthDate?: string | null } | null
  device?: { id: string; name: string; location?: string | null; modality?: string } | null
  // 兼容 mock/派生字段 (旧 handler 形状; 后端不返回, 读取时以 state/patient 为准)
  accessionNo?: string
  patientName?: string
  patientSex?: string
  patientAge?: string
  examCode?: string
  examName?: string
  status?: string
  referringPhysician?: string
  isUrgent?: boolean
  // [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师 (GET /worklist/:id)
  primaryTechnicianId?: string | null
  backupTechnicianId?: string | null
  primaryTechnician?: { id: string; fullName: string } | null
  backupTechnician?: { id: string; fullName: string } | null
  // [v3.0.6.11-104 Wave 3A] 检查前核对 (Time-Out): 未核对时禁止开始检查
  timeoutVerified?: boolean
  timeoutVerifiedBy?: string | null
  timeoutVerifiedAt?: string | null
  // [v3.0.6.11-104 Wave 3D] 重拍审批流: 状态/审批人/审批时间/申请人/原因/备注
  retakeStatus?: 'pending' | 'approved' | 'rejected' | null
  retakeApprover?: string | null
  retakeApprovedAt?: string | null
  retakeRequestedBy?: string | null
  retakeRequestedAt?: string | null
  retakeReason?: string | null
  retakeRequestNote?: string | null
  retakeReviewNote?: string | null
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

// [v3.0.6.11-100 Wave 1B] 重拍原因枚举 (对齐后端 RETAKE_REASON_CODES)
export const RETAKE_REASON_OPTIONS: Array<{ label: string; value: string }> = [
  { label: '运动伪影', value: 'motion_artifact' },
  { label: '摆位不当', value: 'positioning' },
  { label: '扫描协议错误', value: 'wrong_protocol' },
  { label: '对比剂问题', value: 'contrast_issue' },
  { label: '设备故障', value: 'equipment' },
  { label: '其他', value: 'other' },
]

// [v3.0.6.11-100 Wave 1B] 房间级实时状态
export interface RoomStatusItemDto {
  roomId: string
  name: string
  modality: string
  currentExam: { id: string; patientName: string; state: string; startedAt: string | null } | null
  queueLength: number
  status: 'in_use' | 'paused' | 'overdue' | 'waiting' | 'idle'
  idleSince: string | null
}

// [v3.0.6.11-100 Wave 1B] 重拍统计
export type RetakeDimension = 'tech' | 'modality' | 'reason' | 'approver' | 'status'
export interface RetakeStatsDto {
  from: string
  to: string
  dimension: RetakeDimension
  summary: { totalCompleted: number; totalRetakes: number; retakeRate: number; examRetakeCount: number }
  trend: Array<{ date: string; completed: number; retakes: number; rate: number }>
  breakdown: Array<{ key: string; label: string; completed: number; retakes: number; rate: number }>
  // [v3.0.6.11-104 Wave 3D] 审批状态分布下钻
  approvalSummary?: { pending: number; approved: number; rejected: number }
}

// [v3.0.6.11-100 Wave 1A] 技师 KPI 看板 DTO
export interface TechnicianKpiDto {
  id: string
  name: string
  completedCount: number
  avgDurationMin: number
  retakeCount: number
  retakeRate: number
  avgWaitTime: number
  deviceUtilization: number
  onTimeRate: number
}
export interface TechnicianDashboardDto {
  from?: string
  to?: string
  technicians: TechnicianKpiDto[]
  totals: {
    completedCount: number
    avgDurationMin: number
    retakeRate: number
    avgWaitTime: number
    deviceUtilization: number
    onTimeRate: number
  }
  trend: Array<{ date: string; completed: number }>
}

// [v3.0.6.11-103 Wave 1B] 今日总览 DTO (GET /worklist/overview)
export interface WorklistOverviewDto {
  date: string
  total: number
  todayTotal: number
  completedToday: number
  completedRate: number
  avgDurationMin: number
  byStatus: Record<string, number>
  byModality: Array<{ modality: string; count: number }>
  byRoom: Array<{ room: string; count: number; completed: number; inProgress: number }>
  byHour: Array<{ hour: string; count: number }>
  peakHour: string
}

// [v3.0.6.11-103 Wave 1B] 模态分组 DTO (GET /worklist/by-modality)
export interface WorklistModalityItemDto {
  modality: string
  total: number
  inProgress: number
  completed: number
  pending: number
  todayCompleted: number
  avgDurationMin: number
}

// [v3.0.6.11-103 Wave 1B] 技师维度明细 DTO (GET /worklist/technician-stats)
export interface WorklistTechnicianStatDto {
  id: string
  name: string
  completedCount: number
  retakeCount: number
  avgDurationMin: number
}
export interface WorklistTechnicianStatsDto {
  summary: {
    totalCompleted: number
    totalRetake: number
    avgDurationMin: number
    retakeRate: number
    technicianCount: number
  }
  technicians: WorklistTechnicianStatDto[]
}

// [v3.0.6.11-103 Wave 1B] 检查时间线 DTO (GET /worklist/timeline/:id)
export interface WorklistTimelineEventDto {
  type: string
  label: string
  timestamp: string
  actor?: string
  note?: string
}
export interface WorklistTimelineDto {
  examId: string
  accessionNumber?: string
  patientId?: string
  patientName?: string
  modality: string
  bodyPart?: string
  state: string
  totalEvents: number
  events: WorklistTimelineEventDto[]
}

// [G005 Wave1A W9] 状态流转: checkin/start/complete/cancel 后失效 /worklist 前缀缓存
async function invalidateWorklist(): Promise<void> {
  await invalidateApiCacheByPrefix('/worklist')
}

// [v3.0.6.11-104 Wave 3A] 检查前核对 (Time-Out) DTO
export type TimeoutChecklistKey = 'identity' | 'bodyPart' | 'allergy' | 'pregnancy' | 'isolation' | 'consent'
export interface TimeoutCheckItemDto {
  key: TimeoutChecklistKey
  required: boolean
  passed: boolean
  detail: string | null
}
export interface TimeoutChecklistDto {
  examId: string
  verified: boolean
  verifiedBy: string | null
  verifiedAt: string | null
  patient: {
    id: string | null
    name: string
    gender: string
    age: number | null
    identityPrimary: string
    identitySecondary: string | null
    identitySecondaryType: 'idCard' | 'accession'
    allergyHistory: string | null
    pregnancyStatus: string
    isolationFlag: boolean
  }
  exam: { id: string; accessionNumber: string | null; modality: string; bodyPart: string | null }
  consent: { required: boolean; status: 'signed' | 'pending' | 'not_required' }
  items: TimeoutCheckItemDto[]
  checklist: Record<string, unknown> | null
}
export interface TimeoutVerifyDto {
  verifiedBy: string
  note?: string
  checklist: Partial<Record<TimeoutChecklistKey, boolean>>
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
  // [v3.0.6.11-100 Wave 1B] + retakeReason 重拍原因 (重拍率统计原因维度)
  updateState: async (
    id: string,
    state: 'IMAGE_READY' | 'QC_REJECT' | 'QC_PASS' | 'IN_PROGRESS',
    note?: string,
    extras?: { rating?: string; techNote?: string; qcNote?: string; retakeReason?: string },
  ) => {
    const body: Record<string, unknown> = { state }
    if (note) body.note = note
    if (extras?.rating) body.rating = extras.rating
    if (extras?.techNote) body.techNote = extras.techNote
    if (extras?.qcNote) body.qcNote = extras.qcNote
    if (extras?.retakeReason) body.retakeReason = extras.retakeReason
    const res = await api.patch(`/worklist/${id}/state`, body)
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-100 Wave 1B] 检查间实时状态看板 (房间级)
  getRoomStatus: () => api.get<{ rooms: RoomStatusItemDto[]; updatedAt: string }>('/worklist/room-status'),

  // [v3.0.6.11-100 Wave 1B] 重拍率统计 + 原因分类
  // [v3.0.6.11-104 Wave 3D] + approver|status 审批维度下钻
  getRetakeStats: (params?: { from?: string; to?: string; dimension?: RetakeDimension }) => {
    const sp = new URLSearchParams()
    if (params) { Object.entries(params).forEach(([k, v]) => { if (v !== undefined) sp.set(k, String(v)) }) }
    return api.get<RetakeStatsDto>(`/worklist/retake-stats?${sp.toString()}`)
  },

  // [v3.0.6.11-104 Wave 3D] 重拍申请: POST /worklist/:id/retake-request { reason?, applicant?, note? }
  requestRetake: async (id: string, dto?: { reason?: string; applicant?: string; note?: string }) => {
    const res = await api.post(`/worklist/${id}/retake-request`, dto ?? {})
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-104 Wave 3D] 重拍审批: POST /worklist/:id/retake-approve { approved, approver?, opinion? }
  approveRetake: async (id: string, dto: { approved: boolean; approver?: string; opinion?: string }) => {
    const res = await api.post(`/worklist/${id}/retake-approve`, dto)
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-104 Wave 3D] 重拍审批队列 (QC_REJECT 状态, 由 worklist 列表派生)
  listRetakeRequests: () =>
    api.get<{ items: WorklistItemDto[]; total: number }>(`/worklist?${new URLSearchParams({ status: 'QC_REJECT', pageSize: '200' }).toString()}`),

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

  // [v3.0.6.11-100 Wave 1A] 技师 KPI 看板: GET /worklist/technician-dashboard?from&to&technicianId
  getTechnicianDashboard: (params?: { from?: string; to?: string; technicianId?: string }) => {
    const sp = new URLSearchParams()
    if (params) {
      if (params.from) sp.set('from', params.from)
      if (params.to) sp.set('to', params.to)
      if (params.technicianId) sp.set('technicianId', params.technicianId)
    }
    return api.get<TechnicianDashboardDto>(`/worklist/technician-dashboard${sp.toString() ? `?${sp.toString()}` : ''}`)
  },

  // [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配 (POST /worklist/:id/assign-technicians)
  assignTechnicians: async (id: string, dto: { primaryId?: string; backupId?: string }) => {
    const res = await api.post(`/worklist/${id}/assign-technicians`, dto)
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-100 Wave 1A] 多技师协作: 交接班 (POST /worklist/:id/handover)
  handover: async (id: string, dto: { fromId: string; toId: string; note?: string }) => {
    const res = await api.post(`/worklist/${id}/handover`, dto)
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-103 Wave 1B] 今日总览 (按状态/模态/房间) — GET /worklist/overview
  getOverview: () => api.get<WorklistOverviewDto>('/worklist/overview'),

  // [v3.0.6.11-103 Wave 1B] 模态分组列表 — GET /worklist/by-modality
  getByModality: () => api.get<{ items: WorklistModalityItemDto[]; total: number }>('/worklist/by-modality'),

  // [v3.0.6.11-103 Wave 1B] 技师维度明细 (完成数/平均时长/重拍数) — GET /worklist/technician-stats
  getTechnicianStats: () => api.get<WorklistTechnicianStatsDto>('/worklist/technician-stats'),

  // [v3.0.6.11-103 Wave 1B] 检查时间线 (登记→签到→开始→暂停→完成→质控 事件流) — GET /worklist/timeline/:id
  getTimeline: (id: string) => api.get<WorklistTimelineDto>(`/worklist/timeline/${id}`),

  // [v3.0.6.11-103 Wave 1B] 技师备注保存 — POST /worklist/:id/notes (note 必填; latest=true 覆盖式写入)
  saveNotes: async (id: string, note: string, opts?: { latest?: boolean }) => {
    const res = await api.post<{ ok: boolean; examId: string; techNotes: string }>(
      `/worklist/${id}/notes`,
      { note, latest: opts?.latest ?? false },
    )
    await invalidateWorklist()
    return res
  },

  // [v3.0.6.11-104 Wave 3A] 检查前核对 (Time-Out) — GET /worklist/:id/timeout-checklist
  getTimeoutChecklist: (id: string) => api.get<TimeoutChecklistDto>(`/worklist/${id}/timeout-checklist`),

  // [v3.0.6.11-104 Wave 3A] 提交检查前核对 — POST /worklist/:id/timeout-verify (必填项全通过才放行开始)
  verifyTimeout: async (id: string, dto: TimeoutVerifyDto) => {
    const res = await api.post<{
      ok: boolean
      examId: string
      timeoutVerified: boolean
      timeoutVerifiedBy: string
      timeoutVerifiedAt: string
      checklist: Record<string, unknown>
    }>(`/worklist/${id}/timeout-verify`, dto)
    await invalidateWorklist()
    return res
  },
}
