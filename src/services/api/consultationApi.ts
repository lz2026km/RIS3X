import { api } from './client'

// [G005 Wave1B] 后端已实现 consultations.controller (list/create/pending/stats/by-patient/by-doctor/
// comments/invite/start/complete/cancel + 详情), 数据来自 Prisma 派生 + seed 回退。
// 页面在用: ConsultationPage / QCPage 调用 list(); 其余方法已与后端端点对齐。

export interface ConsultationDto {
  id: string
  consultationId?: string
  examId: string
  patientId?: string
  patientName: string
  modality: string
  bodyPart: string
  status: string
  type: string
  consultationType?: string
  isRemote?: boolean
  requestingDepartment?: string
  consultedDepartment?: string
  consultedDoctorName?: string
  scheduledAt: string
  requestTime?: string
  requestedBy?: string
  consultant?: string
  consultants?: string[]
  notes?: string
  requestReason?: string
  priority?: string
  urgency?: string
  duration?: string
  participants?: string[]
}

export interface ConsultationCommentDto {
  id: string
  consultationId: string
  author: string
  content: string
  createdAt: string
  parentId?: string
}

export const consultationApi = {
  // [Wave1B] 后端已实现 (consultations.controller) — 页面在用 (ConsultationPage/QCPage)
  list: (params?: { status?: string; priority?: string }) =>
    api.get<ConsultationDto[]>(`/consultations?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  getById: (id: string) =>
    api.get<ConsultationDto>(`/consultations/${id}`),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  getPending: () =>
    api.get<ConsultationDto[]>('/consultations/pending'),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  getByPatient: (patientId: string) =>
    api.get<ConsultationDto[]>(`/consultations/by-patient/${patientId}`),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  getByDoctor: (doctorId: string) =>
    api.get<ConsultationDto[]>(`/consultations/by-doctor/${doctorId}`),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  create: (data: Partial<ConsultationDto>) =>
    api.post<ConsultationDto>('/consultations', data),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  update: (id: string, data: Partial<ConsultationDto>) =>
    api.put<ConsultationDto>(`/consultations/${id}`, data),

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  cancel: (id: string) =>
    api.post<ConsultationDto>(`/consultations/${id}/cancel`),

  // [G005 Wave2A] 会诊评论 (后端 Wave1A 已实现 /consultations/:id/comments)
  listComments: (id: string) =>
    api.get<ConsultationCommentDto[]>(`/consultations/${id}/comments`),

  addComment: async (id: string, author: string, content: string) => {
    const res = await api.post<ConsultationCommentDto>(`/consultations/${id}/comments`, { author, content })
    return res
  },

  replyComment: async (id: string, commentId: string, author: string, content: string) => {
    const res = await api.post<ConsultationCommentDto>(`/consultations/${id}/comments/${commentId}/reply`, { author, content })
    return res
  },

  // [Wave1B] 后端已实现 (consultations.controller) — 当前无页面引用
  complete: (id: string, notes?: string) =>
    api.post<ConsultationDto>(`/consultations/${id}/complete`, { notes }),
}
