import { api, invalidateApiCacheByPrefix } from './client'

// [G005 W1-C] MOCK_ONLY: 后端无 /research controller,
// 全部 12 方法为前端演示接口 (ResearchPage 在用), 数据源为本地 fallback, 后端待实现。

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
  // mock-only (后端无 /research)
  listProjects: () =>
    api.get<ResearchProjectDto[]>('/research/projects'),

  // mock-only (后端无 /research)
  createProject: async (data: Partial<ResearchProjectDto>) => {
    const res = await api.post<ResearchProjectDto>('/research/projects', data)
    await invalidateApiCacheByPrefix('/research/projects')
    return res
  },

  // ── Exam Records ──
  // mock-only (后端无 /research)
  listExamRecords: () =>
    api.get<ExamRecordDto[]>('/research/exam-records'),

  // ── Labels ──
  // mock-only (后端无 /research)
  listLabels: () =>
    api.get<ResearchLabelDto[]>('/research/labels'),

  // mock-only (后端无 /research)
  createLabel: async (data: Partial<ResearchLabelDto>) => {
    const res = await api.post<ResearchLabelDto>('/research/labels', data)
    await invalidateApiCacheByPrefix('/research/labels')
    return res
  },

  // ── Exports ──
  // mock-only (后端无 /research)
  listExportRecords: () =>
    api.get<ExportRecordDto[]>('/research/exports'),

  // ── IRB ──
  // mock-only (后端无 /research)
  listIRBSubmissions: () =>
    api.get<IRBSubmissionDto[]>('/research/irb'),

  // mock-only (后端无 /research)
  createIRBSubmission: async (data: Partial<IRBSubmissionDto>) => {
    const res = await api.post<IRBSubmissionDto>('/research/irb', data)
    await invalidateApiCacheByPrefix('/research/irb')
    return res
  },

  // ── Cohorts ──
  // mock-only (后端无 /research)
  listCohorts: () =>
    api.get<CohortDefinitionDto[]>('/research/cohorts'),

  // mock-only (后端无 /research)
  createCohort: async (data: Partial<CohortDefinitionDto>) => {
    const res = await api.post<CohortDefinitionDto>('/research/cohorts', data)
    await invalidateApiCacheByPrefix('/research/cohorts')
    return res
  },

  // ── Export Audit ──
  // mock-only (后端无 /research)
  listExportAudit: () =>
    api.get<ExportAuditDto[]>('/research/export-audit'),

  // ── Data Quality ──
  // mock-only (后端无 /research)
  listQualityScores: () =>
    api.get<DataQualityScoreDto[]>('/research/quality-scores'),
}
