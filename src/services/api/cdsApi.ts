import { api } from './client'
import type { CdsRuleSummary, CdsAuditEntry, CdsStatsOverview } from '../cds/types'
import type { ApiResponse } from './types'

export interface CdsGuidelineDto {
  id: string
  name: string
  category: string
  version: string
  status: string
  updatedAt: string
  description: string
  source: string
}

export interface CdsAlertDto {
  id: string
  severity: string
  patientName: string
  type: string
  message: string
  time: string
  status: string
}

export interface CdsDoseMonitoringDto {
  records: any[]
  thresholds: any[]
}

export interface CdsManagementDto {
  rules: CdsRuleSummary[]
  audit: CdsAuditEntry[]
}

export interface RuleEvaluateRequest {
  patientId?: string
  examType?: string
  modality?: string
  age?: number
  gender?: string
  clinicalInfo?: string
  priorFindings?: string
}

export interface RuleEvaluateResult {
  ruleId: string
  ruleName: string
  priority: number
  triggered: boolean
  severity: 'info' | 'warning' | 'critical'
  message: string
  suggestions: string[]
  source: string
}

export const cdsApi = {
  listGuidelines: () =>
    api.get<CdsGuidelineDto[]>('/cds/guidelines'),

  getGuideline: (id: string) =>
    api.get<CdsGuidelineDto>(`/cds/guidelines/${id}`),

  createGuideline: (body: Partial<CdsGuidelineDto>) =>
    api.post<CdsGuidelineDto>('/cds/guidelines', body),

  listAlerts: () =>
    api.get<CdsAlertDto[]>('/cds/alerts'),

  acknowledgeAlert: (id: string, body?: any) =>
    api.post<ApiResponse<void>>(`/cds/alerts/${id}/acknowledge`, body),

  getDoseMonitoring: () =>
    api.get<CdsDoseMonitoringDto>('/cds/dose-monitoring'),

  getCdsStatistics: () =>
    api.get<CdsStatsOverview>('/cds/statistics'),

  listCdsRules: () =>
    api.get<CdsRuleSummary[]>('/cds/rules'),

  createCdsRule: (body: Partial<CdsRuleSummary>) =>
    api.post<CdsRuleSummary>('/cds/rules', body),

  getCdsManagement: () =>
    api.get<CdsManagementDto>('/cds/management'),

  evaluateRule: (body: RuleEvaluateRequest) =>
    api.post<{ results: RuleEvaluateResult[] }>('/cds/rule/evaluate', body),

  updateRulePriority: (ruleId: string, priority: number) =>
    api.put<{ success: boolean }>('/cds/rule/priority', { ruleId, priority }),
}
