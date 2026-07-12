import { api } from './client'

export interface ComplianceReportDto {
  summary: { totalAudits: number; passed: number; failed: number; complianceRate: number }
  details: Array<{
    id: string
    module: string
    checkItem: string
    status: 'PASS' | 'FAIL' | 'WARN'
    severity: 'CRITICAL' | 'MAJOR' | 'MINOR'
    description: string
    checkedAt: string
  }>
  generatedAt: string
}

export interface ComplianceDocDto {
  id: string
  title: string
  category: string
  status: 'CURRENT' | 'DRAFT' | 'ARCHIVED'
  version: string
  updatedAt: string
  content?: string
}

export const complianceApi = {
  getReport: () => api.get<ComplianceReportDto>('/compliance/report'),
  listDocs: () => api.get<ComplianceDocDto[]>('/compliance-docs'),
}
