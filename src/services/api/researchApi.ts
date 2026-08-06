import { api, invalidateApiCacheByPrefix } from './client'

export interface ResearchProjectDto {
  id: string; code: string; name: string; leader: string; startDate: string
  status: '进行中' | '已完成' | '已归档'; dataCount: number; description: string; members: string[]
}

export interface ExamRecordDto {
  id: string; patientId: string; patientName: string; age: number; gender: string
  examType: string; examDate: string; diagnosis: string; result: '阳性' | '阴性'
  idCard: string; phone: string; address: string; modality: string
}

export interface ResearchLabelDto {
  id: string; name: string; type: '诊断' | '部位' | '特征'; color: string; useCount: number
}

export interface ExportRecordDto {
  id: string; projectId: string; projectName: string; format: 'CSV' | 'JSON' | 'DICOM'
  exportTime: string; recordCount: number; downloadUrl: string; operator: string
}

export interface IRBSubmissionDto {
  id: string; projectName: string; pi: string; submittedDate: string
  status: 'draft' | 'submitted' | 'approved' | 'rejected'
  approvedDate: string; expiryDate: string; consentForm: string
}

export interface CohortDefinitionDto {
  id: string; name: string; criteria: string; estimatedSize: number
  createdBy: string; createdDate: string; lastRun: string
}

export interface ExportAuditDto {
  id: string; exportId: string; requester: string; approvedBy: string
  exportTime: string; records: number; purpose: string; status: string
}

export interface DataQualityScoreDto {
  field: string; completeness: number; consistency: number; freshness: string; suggestion: string
}

export const researchApi = {
  // ── Projects ──
  listProjects: () =>
    api.get<ResearchProjectDto[]>('/research/projects'),

  createProject: async (data: Partial<ResearchProjectDto>) => {
    const res = await api.post<ResearchProjectDto>('/research/projects', data)
    await invalidateApiCacheByPrefix('/research/projects')
    return res
  },

  // ── Exam Records ──
  listExamRecords: () =>
    api.get<ExamRecordDto[]>('/research/exam-records'),

  // ── Labels ──
  listLabels: () =>
    api.get<ResearchLabelDto[]>('/research/labels'),

  createLabel: async (data: Partial<ResearchLabelDto>) => {
    const res = await api.post<ResearchLabelDto>('/research/labels', data)
    await invalidateApiCacheByPrefix('/research/labels')
    return res
  },

  // ── Exports ──
  listExportRecords: () =>
    api.get<ExportRecordDto[]>('/research/exports'),

  // ── IRB ──
  listIRBSubmissions: () =>
    api.get<IRBSubmissionDto[]>('/research/irb'),

  createIRBSubmission: async (data: Partial<IRBSubmissionDto>) => {
    const res = await api.post<IRBSubmissionDto>('/research/irb', data)
    await invalidateApiCacheByPrefix('/research/irb')
    return res
  },

  // ── Cohorts ──
  listCohorts: () =>
    api.get<CohortDefinitionDto[]>('/research/cohorts'),

  createCohort: async (data: Partial<CohortDefinitionDto>) => {
    const res = await api.post<CohortDefinitionDto>('/research/cohorts', data)
    await invalidateApiCacheByPrefix('/research/cohorts')
    return res
  },

  // ── Export Audit ──
  listExportAudit: () =>
    api.get<ExportAuditDto[]>('/research/export-audit'),

  // ── Data Quality ──
  listQualityScores: () =>
    api.get<DataQualityScoreDto[]>('/research/quality-scores'),
}
