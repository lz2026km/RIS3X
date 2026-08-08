import { api } from './client'

// [G005 W1-C] MOCK_ONLY: 后端无 /consultations controller,
// 全部 9 方法由 MSW (src/services/mockBackend/handlers.ts Consultations 段) 支撑演示数据, 后端待实现。
// 页面在用: ConsultationPage / QCPage 仅调用 list(); 其余 8 方法保留供后续后端接入。

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

export const consultationApi = {
  // MOCK_ONLY (后端无 controller, MSW 支撑) — 页面在用 (ConsultationPage/QCPage)
  list: (params?: { status?: string; priority?: string }) =>
    api.get<ConsultationDto[]>(`/consultations?${new URLSearchParams(params as Record<string, string> ?? {}).toString()}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  getById: (id: string) =>
    api.get<ConsultationDto>(`/consultations/${id}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  getPending: () =>
    api.get<ConsultationDto[]>('/consultations/pending'),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  getByPatient: (patientId: string) =>
    api.get<ConsultationDto[]>(`/consultations/by-patient/${patientId}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  getByDoctor: (doctorId: string) =>
    api.get<ConsultationDto[]>(`/consultations/by-doctor/${doctorId}`),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  create: (data: Partial<ConsultationDto>) =>
    api.post<ConsultationDto>('/consultations', data),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  update: (id: string, data: Partial<ConsultationDto>) =>
    api.put<ConsultationDto>(`/consultations/${id}`, data),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  cancel: (id: string) =>
    api.post<ConsultationDto>(`/consultations/${id}/cancel`),

  // MOCK_ONLY (后端无 controller, MSW 支撑) — 当前无页面引用
  complete: (id: string, notes?: string) =>
    api.post<ConsultationDto>(`/consultations/${id}/complete`, { notes }),
}
