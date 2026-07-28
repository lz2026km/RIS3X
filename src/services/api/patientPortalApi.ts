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
}
