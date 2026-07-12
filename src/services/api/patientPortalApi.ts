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
}
