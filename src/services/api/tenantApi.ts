import { api } from './client'

export interface ComplianceReport {
  status: string
  compliant: boolean
  score: number
  checks: Array<{ id: string; name: string; passed: boolean; detail?: string }>
  generatedAt: string
}

export const tenantApi = {
  getComplianceReport: () =>
    api.get<ComplianceReport>('/compliance/report'),
}
