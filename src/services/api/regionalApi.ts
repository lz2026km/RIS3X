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

// ── Regional Imaging Page DTOs ──

export interface AccessApplicationDto {
  id: string; patientName: string; patientId: string; hospital: string; modality: string
  studyDate: string; reason: string; status: 'pending' | 'approved' | 'rejected'; applyDate: string
}

export interface ConsultationRequestDto {
  id: string; patientName: string; hospital: string; diagnosis: string
  priority: 'normal' | 'urgent' | 'critical'; status: 'open' | 'in-progress' | 'completed'
  createDate: string; expert?: string
}

export interface AccessRecordDto {
  id: string; patientName: string; patientId: string; studyType: string; hospital: string
  accessTime: string; accessor: string; purpose: string
}

export interface InstitutionDto {
  id: string; name: string; aeTitle: string; address: string; status: 'online' | 'offline' | 'busy'
}

export interface CrossInstitutionStudyDto {
  id: string; patientId: string; patientName: string; studyUid: string; studyDescription: string
  modality: string; institution: string; date: string; status: string
}

export interface DocumentRegistryEntryDto {
  id: string; patientId: string; patientName: string; studyUid: string; studyDescription: string
  modality: string; institution: string; date: string; status: string
}

export interface AuditTrailEntryDto {
  id: string; patientId: string; action: string; institution: string; user: string
  time: string; details: string
}

// ── Regional Report Page DTOs ──

export interface RegionalConsultationDto {
  id: string; caseId: string; patientName: string; gender: string; age: number
  institution: string; modality: string; examItem: string; applyReason: string
  status: '待接诊' | '会诊中' | '已完成' | '已取消'; applyTime: string
  acceptTime?: string; completeTime?: string; applyDoctor: string; acceptDoctor?: string
  consultationOpinion?: string; priority: '普通' | '紧急' | '立即'
}

export interface RegionalReportRecordDto {
  id: string; reportId: string; institution: string; patientName: string; gender: string
  age: number; modality: string; examItem: string; reportTime: string; reportDoctor: string
  status: '待审核' | '已通过' | '有问题' | '已驳回'; qualityScore: number
  qualityIssues: string[]; reviewOpinion?: string; reviewDoctor?: string; reviewTime?: string
}

export interface CriticalValueReportDto {
  id: string; patientName: string; gender: string; age: number; institution: string
  modality: string; examItem: string; criticalFinding: string
  severity: '危急' | '高危' | '紧急'; reportedTime: string; reportedDoctor: string
  status: '待确认' | '已接收' | '处理中' | '已闭环'
  receiveTime?: string; receiveDoctor?: string; handleTime?: string
  handleDoctor?: string; closeTime?: string
}

export interface RemoteDiagnosisDto {
  id: string; caseId: string; patientName: string; gender: string; age: number
  examType: string; applyInstitution: string; remoteExpert: string; expertInstitution: string
  status: '待书写' | '书写中' | '待审核' | '已完成'; applyTime: string
  startTime?: string; completeTime?: string; reportContent?: string
  isOtherTyping?: boolean; otherTypingName?: string
}

export interface CoSignRecordDto {
  id: string; reportId: string; examType: string; patientName: string; gender: string
  age: number; participatingInstitutions: string[]
  status: '待签发' | '签发中' | '已完成'; createTime: string; completeTime?: string
  signatures: Array<{ institution: string; doctorName: string; signTime: string; certificateStatus: string; order: number }>
  versions: Array<{ version: string; modifyTime: string; modifyInstitution: string; modifyReason: string; modifier: string }>
}

// ── Multi-Site Dashboard DTOs (多站点/多院区) ──
// 后端暂未实现 → MSW regionalHandlers 支撑, 响应带 source 信封标注数据来源

export interface RegionalSiteDto {
  id: string
  name: string
  code: string
  region: string
  city: string
  status: 'active' | 'offline' | 'syncing' | 'maintenance'
  studies: number
  patients: number
  users: number
  storage: number
  bandwidth: number
  lastSync: string
  latencyMs: number
  uptimePct: number
  version: string
  primary: boolean
}

export interface RegionalSiteSyncEventDto {
  id: string
  siteId: string
  type: 'study_pushed' | 'study_pulled' | 'user_sync' | 'config_sync'
  status: 'success' | 'failed' | 'pending'
  count: number
  bytes: number
  duration: number
  timestamp: string
  message?: string
}

export interface RegionalSiteRoutingRuleDto {
  id: string
  name: string
  sourceSite: string
  destSite: string
  modality: string
  condition: string
  active: boolean
  matchedCount: number
}

export interface RegionalSitesEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
}

export const regionalApi = {
  // ── Multi-Site Dashboard endpoints ──

  listSites: () =>
    api.get<RegionalSitesEnvelope<RegionalSiteDto[]>>('/regional/sites'),

  listSiteSyncEvents: () =>
    api.get<RegionalSitesEnvelope<RegionalSiteSyncEventDto[]>>('/regional/sites/sync-events'),

  listSiteRoutingRules: () =>
    api.get<RegionalSitesEnvelope<RegionalSiteRoutingRuleDto[]>>('/regional/sites/routing-rules'),

  // ── Original endpoints ──

  listRegionalImaging: () =>
    api.get<RegionalImagingDto[]>('/regional/imaging'),

  getRegionalImaging: (id: string) =>
    api.get<RegionalImagingDto>(`/regional/imaging/${id}`),

  listRegionalReports: () =>
    api.get<RegionalReportDto[]>('/regional/reports'),

  getRegionalReport: (id: string) =>
    api.get<RegionalReportDto>(`/regional/reports/${id}`),

  getDepartmentSchedule: () =>
    api.get<DepartmentScheduleDto[]>('/regional/schedule'),

  updateSchedule: async (id: string, data: Partial<DepartmentScheduleDto>) => {
    const res = await api.put<DepartmentScheduleDto>(`/regional/schedule/${id}`, data)
    await invalidateApiCache(`/regional/schedule/${id}`)
    await invalidateApiCacheByPrefix('/regional/schedule')
    return res
  },

  listDepartments: () =>
    api.get<DepartmentDto[]>('/regional/departments'),

  listMedicalAlliance: () =>
    api.get<MedicalAllianceDto[]>('/regional/medical-alliance'),

  getFhirStatus: () =>
    api.get<IntegrationStatusDto>('/regional/integration/fhir'),

  getIheStatus: () =>
    api.get<IntegrationStatusDto>('/regional/integration/ihe'),

  getMllpStatus: () =>
    api.get<IntegrationStatusDto>('/regional/integration/mllp'),

  // ── Regional Imaging Page endpoints ──

  listApplications: () =>
    api.get<AccessApplicationDto[]>('/regional/imaging/applications'),

  createApplication: (data: Partial<AccessApplicationDto>) =>
    api.post<AccessApplicationDto>('/regional/imaging/applications', data),

  approveApplication: (id: string) =>
    api.post<AccessApplicationDto>(`/regional/imaging/applications/${id}/approve`),

  rejectApplication: (id: string) =>
    api.post<AccessApplicationDto>(`/regional/imaging/applications/${id}/reject`),

  listConsultationRequests: () =>
    api.get<ConsultationRequestDto[]>('/regional/imaging/consultations'),

  createConsultationRequest: (data: Partial<ConsultationRequestDto>) =>
    api.post<ConsultationRequestDto>('/regional/imaging/consultations', data),

  listAccessRecords: () =>
    api.get<AccessRecordDto[]>('/regional/imaging/access-records'),

  listInstitutions: () =>
    api.get<InstitutionDto[]>('/regional/imaging/institutions'),

  crossInstitutionQuery: (params: { institutionId: string; queryType: string; queryValue: string }) =>
    api.get<CrossInstitutionStudyDto[]>(`/regional/imaging/cross-query?institutionId=${params.institutionId}&queryType=${params.queryType}&queryValue=${encodeURIComponent(params.queryValue)}`),

  listDocumentRegistry: () =>
    api.get<DocumentRegistryEntryDto[]>('/regional/imaging/document-registry'),

  pixQuery: (patientId: string) =>
    api.get<{ local: string; remote: string }>(`/regional/imaging/pix?patientId=${encodeURIComponent(patientId)}`),

  listAuditTrail: () =>
    api.get<AuditTrailEntryDto[]>('/regional/imaging/audit-trail'),

  // ── Regional Report Page endpoints ──

  listConsultations: () =>
    api.get<RegionalConsultationDto[]>('/regional/consultations'),

  listReportRecords: () =>
    api.get<RegionalReportRecordDto[]>('/regional/report-records'),

  listCriticalValues: () =>
    api.get<CriticalValueReportDto[]>('/regional/critical-values'),

  listRemoteDiagnoses: () =>
    api.get<RemoteDiagnosisDto[]>('/regional/remote-diagnoses'),

  listCoSignRecords: () =>
    api.get<CoSignRecordDto[]>('/regional/co-sign-records'),

  listRegionalInstitutions: () =>
    api.get<RegionalImagingDto[]>('/regional/institutions'),
}
