import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'

export interface RegionalImagingDto {
  id: string
  institutionId: string
  institutionName: string
  modality: string
  examCount: number
  positiveCount: number
  positiveRate: number
  avgReportTime: number
  qualifiedRate: number
  period: string
}

export interface RegionalReportDto {
  id: string
  reportId: string
  institution: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItem: string
  reportTime: string
  reportDoctor: string
  status: string
  qualityScore: number
  qualityIssues: string[]
  reviewOpinion?: string
  reviewDoctor?: string
  reviewTime?: string
}

export interface DepartmentScheduleDto {
  id: string
  departmentId: string
  departmentName: string
  date: string
  shift: string
  doctorId: string
  doctorName: string
  status: string
}

export interface DepartmentDto {
  id: string
  name: string
  level: string
  type: string
  reportCount: number
  pendingCount: number
}

export interface MedicalAllianceDto {
  id: string
  name: string
  level: string
  type: string
  memberCount: number
  status: string
}

export interface IntegrationStatusDto {
  status: string
  lastSync: string
  error?: string
}

export const regionalApi = {
  // Imaging
  listRegionalImaging: () =>
    api.get<RegionalImagingDto[]>('/regional/imaging'),

  getRegionalImaging: (id: string) =>
    api.get<RegionalImagingDto>(`/regional/imaging/${id}`),

  // Reports
  listRegionalReports: () =>
    api.get<RegionalReportDto[]>('/regional/reports'),

  getRegionalReport: (id: string) =>
    api.get<RegionalReportDto>(`/regional/reports/${id}`),

  // Schedule
  getDepartmentSchedule: () =>
    api.get<DepartmentScheduleDto[]>('/regional/schedule'),

  updateSchedule: async (id: string, data: Partial<DepartmentScheduleDto>) => {
    const res = await api.put<DepartmentScheduleDto>(`/regional/schedule/${id}`, data)
    await invalidateApiCache(`/regional/schedule/${id}`)
    await invalidateApiCacheByPrefix('/regional/schedule')
    return res
  },

  // Departments
  listDepartments: () =>
    api.get<DepartmentDto[]>('/regional/departments'),

  // Medical alliance
  listMedicalAlliance: () =>
    api.get<MedicalAllianceDto[]>('/regional/medical-alliance'),

  // Integration status
  getFhirStatus: () =>
    api.get<IntegrationStatusDto>('/regional/integration/fhir'),

  getIheStatus: () =>
    api.get<IntegrationStatusDto>('/regional/integration/ihe'),

  getMllpStatus: () =>
    api.get<IntegrationStatusDto>('/regional/integration/mllp'),
}
