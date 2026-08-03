import { api } from './client'

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
  findings?: string
  diagnosis?: string
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

export const patientPortalApi = {
  listPatients: () =>
    api.get<{ data: PortalPatientDto[] }>('/patient-portal/patients'),

  getPatient: (id: string) =>
    api.get<{ data: PortalPatientDto[] }>(`/patient-portal/patients/${id}`),

  listClinicalData: () =>
    api.get<{ data: PortalClinicalDataDto[] }>('/patient-portal/clinical-data'),

  getClinicalData: (id: string) =>
    api.get<{ data: PortalClinicalDataDto[] }>(`/patient-portal/clinical-data/${id}`),

  listEducation: () =>
    api.get<{ data: PortalEducationDto[] }>('/patient-portal/education'),

  getEducation: (id: string) =>
    api.get<{ data: PortalEducationDto[] }>(`/patient-portal/education/${id}`),

  getPatientMobile: () =>
    api.get<{ data: PortalPatientDto[] }>('/patient-portal/mobile/patients'),

  getDoctorMobile: () =>
    api.get<{ data: PortalMobileUserDto[] }>('/patient-portal/mobile/doctors'),

  getNurseMobile: () =>
    api.get<{ data: PortalMobileUserDto[] }>('/patient-portal/mobile/nurses'),

  getTechMobile: () =>
    api.get<{ data: PortalMobileUserDto[] }>('/patient-portal/mobile/techs'),

  getPortalUser: (id: string) =>
    api.get<PortalPatientDto>(`/patient-portal/user/${id}`),

  listExamHistory: (patientId: string) =>
    api.get<ExamHistoryItemDto[]>(`/patient-portal/exam-history?patientId=${patientId}`),

  getExamReport: (examId: string) =>
    api.get<ExamHistoryItemDto>(`/patient-portal/exam-history/${examId}/report`),

  listExamImages: (examId: string) =>
    api.get<ImagePreviewDto[]>(`/patient-portal/exam-history/${examId}/images`),

  generateVoucher: (patientId: string) =>
    api.post<{ code: string; expiresAt: string }>('/patient-portal/voucher', { patientId }),

  // ===== v3.1 患者门户: 自助预约 / 报告 / 影像 / 反馈 =====

  listAppointments: (patientId?: string) =>
    api.get<PortalAppointmentDto[]>(
      `/patient-portal/appointments${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`,
    ),

  createAppointment: (input: CreatePortalAppointmentInput) =>
    api.post<PortalAppointmentDto>('/patient-portal/appointments', input),

  listReports: (patientId?: string) =>
    api.get<PortalReportDto[]>(
      `/patient-portal/reports${patientId ? `?patientId=${encodeURIComponent(patientId)}` : ''}`,
    ),

  getReport: (id: string) =>
    api.get<PortalReportDto | null>(`/patient-portal/reports/${id}`),

  listImages: (studyUid: string) =>
    api.get<PortalImageStudyDto | null>(`/patient-portal/images/${encodeURIComponent(studyUid)}`),

  submitFeedback: (input: CreatePortalFeedbackInput) =>
    api.post<PortalFeedbackDto>('/patient-portal/feedback', input),
}
