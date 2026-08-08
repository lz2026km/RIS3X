import { api } from './client'
import type { ApiResponse } from './types'

// [G005 W1-C] 前端对齐后端实际端点 (backend/src/patientportal/patientportal.controller.ts):
//   patients(:id) · clinical-data(:id) · education · appointments · reports(:id)
//   images/:studyUid · feedback · mobile/{patients,doctors,nurses,techs}
// 已移除无后端对应端点: /patient-portal/user/:id · /exam-history* · /voucher

export interface PortalPatientDto {
  id: string
  name: string
  gender?: string
  birthDate?: string
  phone?: string
  idNumber?: string
  age?: number
  createdAt?: string
}

export interface PortalClinicalDataDto {
  id: string
  patientId?: string
  patientName?: string
  examType?: string
  examDate?: string
  bodyPart?: string
  modality?: string
  findings?: string
  diagnosis?: string
  recommendations?: string
  reportStatus?: string
}

export interface PortalEducationDto {
  key: string
  value?: string
  label?: string
}

export interface PortalMobileUserDto {
  id: string
  name: string
  role?: string
  phone?: string
  department?: string
  title?: string
}

export interface ExamHistoryItemDto {
  id: string
  examItem: string
  examDate: string
  bodyPart: string
  modality: string
  deviceName: string
  reportStatus: string
  hasImages: boolean
  reportContent?: string
  diagnosis?: string
  recommendations?: string
}

export interface ImagePreviewDto {
  id: string
  label: string
  windowWidth: number
  windowCenter: number
  invert: boolean
}

export interface PortalAppointmentDto {
  id: string
  patientId: string
  patientName?: string
  modality: string
  bodyPart?: string
  scheduledAt: string
  state: string
  createdAt?: string
}

export interface CreatePortalAppointmentInput {
  patientId: string
  modality: string
  bodyPart?: string
  scheduledAt: string
  deviceId?: string
}

export interface PortalReportDto {
  id: string
  patientId: string
  examId?: string
  state: string
  modality?: string
  bodyPart?: string
  examDate?: string
  signedAt?: string
  findings?: string
  diagnosis?: string
  impression?: string
  recommendations?: string
  conclusion?: string
  isCritical?: boolean
}

export interface PortalImageSeriesDto {
  seriesInstanceUid: string
  modality: string
  seriesNumber?: number
  instanceCount: number
  wadoRs: { instances: string; frames?: string }
}

export interface PortalImageStudyDto {
  studyInstanceUid: string
  studyDate?: string
  modality?: string
  description?: string
  series: PortalImageSeriesDto[]
  wadoRs: { study: string }
}

export interface PortalFeedbackDto {
  id: string
  patientId?: string
  patientName?: string
  rating: number
  category?: string
  comment?: string
  createdAt: string
}

export interface CreatePortalFeedbackInput {
  patientId?: string
  patientName?: string
  rating: number
  category?: string
  comment?: string
}

// [W5] 宣教资料写入
export interface CreateEducationInput {
  title: string
  category?: 'pre_exam' | 'post_exam' | 'condition' | 'medication' | 'general'
  contentType?: 'text' | 'video' | 'audio' | 'pdf' | 'image'
  content: string
  summary?: string
  modality?: string
  bodyPart?: string
  duration?: number
  tags?: string[]
  language?: 'zh-CN' | 'en'
}

export interface PortalEducationItemDto {
  key: string
  id: string
  title: string
  category?: string
  contentType?: string
  content: string
  summary?: string
  tags?: string[]
  createdAt?: string
  updatedAt?: string
}

export const patientPortalApi = {
  listPatients: () =>
    api.get<{ data: PortalPatientDto[] }>('/patient-portal/patients'),

  getPatient: (id: string) =>
    api.get<{ data: PortalPatientDto[] }>(`/patient-portal/patients/${id}`),

  listClinicalData: async () => {
    const res = await api.get<{ data: PortalClinicalDataDto[] }>('/patient-portal/clinical-data')
    return unwrapList(res)
  },

  getClinicalData: async (id: string): Promise<ApiResponse<PortalClinicalDataDto | null>> => {
    const res = await api.get<PortalClinicalDataDto | { data: PortalClinicalDataDto | PortalClinicalDataDto[] }>(`/patient-portal/clinical-data/${id}`)
    if (!res.success) return { ...res, data: null }
    const raw = res.data
    if (raw && typeof raw === 'object' && 'data' in raw) {
      const inner = (raw as { data: PortalClinicalDataDto | PortalClinicalDataDto[] }).data
      return { ...res, data: Array.isArray(inner) ? (inner[0] ?? null) : inner }
    }
    return { ...res, data: raw as PortalClinicalDataDto }
  },

  listEducation: () =>
    api.get<{ data: PortalEducationDto[] }>('/patient-portal/education'),

  getEducation: (id: string) =>
    api.get<{ data: PortalEducationDto[] }>(`/patient-portal/education/${id}`),

  // [W5] 宣教资料写入端点 (ADMIN/医护角色)
  createEducation: (input: CreateEducationInput) =>
    api.post<PortalEducationItemDto>('/patient-portal/education', input),

  deleteEducation: (key: string) =>
    api.delete<{ deleted: boolean }>(`/patient-portal/education/${encodeURIComponent(key)}`),

  getPatientMobile: () =>
    api.get<{ data: PortalPatientDto[] }>('/patient-portal/mobile/patients'),

  getDoctorMobile: () =>
    api.get<{ data: PortalMobileUserDto[] }>('/patient-portal/mobile/doctors'),

  getNurseMobile: () =>
    api.get<{ data: PortalMobileUserDto[] }>('/patient-portal/mobile/nurses'),

  getTechMobile: () =>
    api.get<{ data: PortalMobileUserDto[] }>('/patient-portal/mobile/techs'),

  // [G005 W1-C] user/:id → patients/:id (后端返回 { data: [patient] }, 归一化为单对象)
  getPortalUser: async (id: string) => {
    const res = await api.get<PortalPatientDto | { data: PortalPatientDto | PortalPatientDto[] }>(`/patient-portal/patients/${id}`)
    if (!res.success) return { ...res, data: null as unknown as PortalPatientDto }
    const raw = res.data
    if (raw && typeof raw === 'object' && 'data' in raw) {
      const inner = (raw as { data: PortalPatientDto | PortalPatientDto[] }).data
      return { ...res, data: Array.isArray(inner) ? (inner[0] ?? null) : inner }
    }
    return { ...res, data: raw as PortalPatientDto }
  },

  // [G005 W1-C] exam-history → /patient-portal/clinical-data (后端无 exam-history 端点)
  listExamHistory: async (patientId: string) => {
    const res = await api.get<{ data: PortalClinicalDataDto[] }>(
      `/patient-portal/clinical-data${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`,
    )
    if (!res.success) return { ...res, data: [] as ExamHistoryItemDto[] }
    const items = unwrapArray(res)
    const mapped: ExamHistoryItemDto[] = items.map(d => ({
      id: d.id,
      examItem: d.examType ?? '影像检查',
      examDate: d.examDate ?? '',
      bodyPart: d.bodyPart ?? '',
      modality: d.modality ?? '',
      deviceName: '',
      reportStatus: d.reportStatus ?? '',
      hasImages: (d.modality === 'CT' || d.modality === 'MR') && !!d.reportStatus,
      reportContent: d.findings,
      diagnosis: d.diagnosis,
      recommendations: d.recommendations,
    }))
    return { ...res, data: mapped }
  },

  // [G005 W1-C] exam-history/:examId/report → /patient-portal/reports/:id
  getExamReport: async (examId: string): Promise<ApiResponse<PortalReportDto | null>> => {
    const res = await api.get<PortalReportDto | { data: PortalReportDto | null } | null>(`/patient-portal/reports/${examId}`)
    if (!res.success) return { ...res, data: null }
    const raw = res.data
    if (raw && typeof raw === 'object' && 'data' in raw) {
      return { ...res, data: (raw as { data: PortalReportDto | null }).data ?? null }
    }
    return { ...res, data: raw as PortalReportDto }
  },

  // ===== v3.1 患者门户: 自助预约 / 报告 / 影像 / 反馈 =====

  listAppointments: async (patientId?: string) => {
    const res = await api.get<PortalAppointmentDto[] | { data: PortalAppointmentDto[] }>(
      `/patient-portal/appointments${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`,
    )
    return unwrapList(res)
  },

  createAppointment: (input: CreatePortalAppointmentInput) =>
    api.post<PortalAppointmentDto>('/patient-portal/appointments', input),

  listReports: async (patientId?: string) => {
    const res = await api.get<PortalReportDto[] | { data: PortalReportDto[] }>(
      `/patient-portal/reports${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`,
    )
    return unwrapList(res)
  },

  getReport: (id: string) =>
    api.get<PortalReportDto | null>(`/patient-portal/reports/${id}`),

  listImages: (studyUid: string) =>
    api.get<PortalImageStudyDto | null>(`/patient-portal/images/${encodeURIComponent(studyUid)}`),

  submitFeedback: (input: CreatePortalFeedbackInput) =>
    api.post<PortalFeedbackDto>('/patient-portal/feedback', input),
}

// [G005 W1-C] 列表响应归一化: 兼容 MSW 裸数组 与 后端 { data: [...] } 包装
function unwrapArray<T>(res: ApiResponse<{ data: T[] } | T[]>): T[] {
  const raw = res.data
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object' && 'data' in raw) {
    const inner = (raw as { data: T[] }).data
    if (Array.isArray(inner)) return inner
  }
  return []
}

async function unwrapList<T>(res: ApiResponse<{ data: T[] } | T[]>): Promise<ApiResponse<T[]>> {
  if (!res.success) return { ...res, data: [] }
  return { ...res, data: unwrapArray(res) }
}
