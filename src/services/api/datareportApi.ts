// v3.0.6.11-21 P0: 移除冗余 `/api` 前缀(由 client.ts API_BASE 在 mock 模式自动提供 `/api/v1`)
//   修复前: client BASE=/api/v1 + path=/api/data-report/... => /api/v1/api/data-report/... 不匹配 MSW
//   修复后: client BASE=/api/v1 + path=/data-report/...    => /api/v1/data-report/... 匹配 MSW (dataReportHandlers.ts)
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
    api.get<NationalReportDto[]>('/data-report/national-reports'),

  getNationalReport: (id: string) =>
    api.get<NationalReportDto>(`/data-report/national-reports/${id}`),

  createNationalReport: async (data: Partial<NationalReportDto>) => {
    const res = await api.post<NationalReportDto>('/data-report/national-reports', data)
    await invalidateApiCache('/data-report/national-reports')
    return res
  },

  // Data reports
  listDataReports: () =>
    api.get<DataReportDto[]>('/data-report/data-reports'),

  getDataReport: (id: string) =>
    api.get<DataReportDto>(`/data-report/data-reports/${id}`),

  createDataReport: async (data: Partial<DataReportDto>) => {
    const res = await api.post<DataReportDto>('/data-report/data-reports', data)
    await invalidateApiCache('/data-report/data-reports')
    return res
  },

  // Insurance audits
  listInsuranceAudits: () =>
    api.get<InsuranceAuditDto[]>('/data-report/insurance-audits'),

  getInsuranceAudit: (id: string) =>
    api.get<InsuranceAuditDto>(`/data-report/insurance-audits/${id}`),

  // Enterprise search
  enterpriseSearch: (q: string) =>
    api.get<EnterpriseSearchResult[]>(`/data-report/enterprise-search?q=${encodeURIComponent(q)}`),

  // Exam statistics
  listExamStatistics: () =>
    api.get<ExamStatisticsDto[]>('/data-report/exam-statistics'),

  // Report logs
  listReportLogs: () =>
    api.get<ReportLogDto[]>('/data-report/report-logs'),

  // Monthly trends
  getMonthlyTrends: () =>
    api.get<MonthlyTrendDto[]>('/data-report/monthly-trends'),
}

export interface ExamStatisticsDto {
  id: string
  modality: string
  examType: string
  examCount: number
  positiveCount: number
  positiveRate: number
  avgReportTime: number
  qualifiedRate: number
}

export interface ReportLogDto {
  id: string
  reportType: string
  reportMonth: string
  submitTime: string
  status: string
  operator: string
  note?: string
}

export interface MonthlyTrendDto {
  month: string
  CT: number
  MRI: number
  DR: number
  MG: number
  DSA: number
}
