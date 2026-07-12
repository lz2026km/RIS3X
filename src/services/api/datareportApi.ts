import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'

export interface NationalReportDto {
  id: string
  reportMonth: string
  modality: string
  totalExams: number
  totalDLP: number
  avgDLP: number
  totalCTDI: number
  avgCTDI: number
  alertCount: number
  highDoseCount: number
  status: string
  submitTime?: string
  confirmTime?: string
  confirmOrg?: string
}

export interface DataReportDto {
  id: string
  reportType: string
  reportMonth: string
  totalReports: number
  qualifiedReports: number
  excellentReports: number
  qualifiedRate: number
  excellentRate: number
  avgScore: number
  status: string
  commonIssues?: string[]
  improvementMeasures?: string[]
}

export interface InsuranceAuditDto {
  id: string
  patientName: string
  patientId: string
  examType: string
  drugName: string
  drugCategory: string
  status: string
  submitTime: string
  result?: string
  auditor?: string
  auditTime?: string
  reason?: string
}

export interface EnterpriseSearchResult {
  id: string
  title: string
  description: string
  type: string
  score: number
}

export const datareportApi = {
  // National reports
  listNationalReports: () =>
    api.get<NationalReportDto[]>('/api/data-report/national-reports'),

  getNationalReport: (id: string) =>
    api.get<NationalReportDto>(`/api/data-report/national-reports/${id}`),

  createNationalReport: async (data: Partial<NationalReportDto>) => {
    const res = await api.post<NationalReportDto>('/api/data-report/national-reports', data)
    await invalidateApiCache('/api/data-report/national-reports')
    return res
  },

  // Data reports
  listDataReports: () =>
    api.get<DataReportDto[]>('/api/data-report/data-reports'),

  getDataReport: (id: string) =>
    api.get<DataReportDto>(`/api/data-report/data-reports/${id}`),

  createDataReport: async (data: Partial<DataReportDto>) => {
    const res = await api.post<DataReportDto>('/api/data-report/data-reports', data)
    await invalidateApiCache('/api/data-report/data-reports')
    return res
  },

  // Insurance audits
  listInsuranceAudits: () =>
    api.get<InsuranceAuditDto[]>('/api/data-report/insurance-audits'),

  getInsuranceAudit: (id: string) =>
    api.get<InsuranceAuditDto>(`/api/data-report/insurance-audits/${id}`),

  // Enterprise search
  enterpriseSearch: (q: string) =>
    api.get<EnterpriseSearchResult[]>(`/api/data-report/enterprise-search?q=${encodeURIComponent(q)}`),
}
