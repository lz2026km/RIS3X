// [v3.0.6.8-50] PR6: v3 报告全栈 (40 client 方法)
import { api } from './client';

// ============= v3 写作 (12 方法) =============
export const v3WritingApi = {
  listTemplates: () => api.get<any[]>('/writing/templates'),
  getTemplate: (id: string) => api.get<any>(`/writing/templates/${id}`),
  createTemplate: (data: any) => api.post<any>('/writing/templates', data),
  updateTemplate: (id: string, data: any) => api.put<any>(`/writing/templates/${id}`, data),
  deleteTemplate: (id: string) => api.delete(`/writing/templates/${id}`),
  listDrafts: (params?: any) => api.get<any[]>(`/writing/drafts?${new URLSearchParams(params ?? {}).toString()}`),
  getDraft: (id: string) => api.get<any>(`/writing/drafts/${id}`),
  saveDraft: (id: string, data: any) => api.put<any>(`/writing/drafts/${id}`, data),
  aiDraft: (data: { templateId: string; patientId: string; findings: string }) => api.post<any>('/writing/ai-draft', data),
  listPhrases: (params?: any) => api.get<any[]>(`/writing/phrases?${new URLSearchParams(params ?? {}).toString()}`),
  listRadLex: (params?: any) => api.get<any[]>(`/writing/radlex?${new URLSearchParams(params ?? {}).toString()}`),
  preScore: (id: string) => api.post<any>(`/writing/drafts/${id}/pre-score`, {}),
};

// ============= v3 分发 (8 方法) =============
export const v3DistApi = {
  listChannels: () => api.get<any[]>('/dist/channels'),
  getChannel: (id: string) => api.get<any>(`/dist/channels/${id}`),
  listTasks: (params?: any) => api.get<any[]>(`/dist/tasks?${new URLSearchParams(params ?? {}).toString()}`),
  getTask: (id: string) => api.get<any>(`/dist/tasks/${id}`),
  retryTask: (id: string) => api.post<any>(`/dist/tasks/${id}/retry`, {}),
  listQueues: () => api.get<any[]>('/dist/queues'),
  listHL7Messages: (params?: any) => api.get<any[]>(`/dist/hl7?${new URLSearchParams(params ?? {}).toString()}`),
  listDeliveryReceipts: (params?: any) => api.get<any[]>(`/dist/receipts?${new URLSearchParams(params ?? {}).toString()}`),
};

// ============= v3 集成 (10 方法) =============
export const v3IntegrationApi = {
  listCDA: (params?: any) => api.get<any[]>(`/integration/cda?${new URLSearchParams(params ?? {}).toString()}`),
  parseCDA: (id: string) => api.post<any>(`/integration/cda/${id}/parse`, {}),
  downloadCDA: (id: string) => api.get<any>(`/integration/cda/${id}/download`),
  listFHIR: (params?: any) => api.get<any[]>(`/integration/fhir?${new URLSearchParams(params ?? {}).toString()}`),
  listXDSRegistrries: () => api.get<any[]>('/integration/xds/registries'),
  registerXDS: (data: any) => api.post<any>('/integration/xds/register', data),
  listHISOrders: (params?: any) => api.get<any[]>(`/integration/his/orders?${new URLSearchParams(params ?? {}).toString()}`),
  getFHIRDiagnosticReport: (id: string) => api.get<any>(`/integration/fhir/diagnostic-report/${id}`),
  listWebhooks: () => api.get<any[]>('/integration/webhooks'),
  createWebhook: (data: any) => api.post<any>('/integration/webhooks', data),
};

// ============= v3 v3 报告 AI 协助 (6 方法) =============
export const v3AiAssistApi = {
  listDrafts: (params?: any) => api.get<any[]>(`/ai-assist/drafts?${new URLSearchParams(params ?? {}).toString()}`),
  getDraft: (id: string) => api.get<any>(`/ai-assist/drafts/${id}`),
  preReview: (id: string) => api.post<any>(`/ai-assist/drafts/${id}/pre-review`, {}),
  riskScore: (id: string) => api.post<any>(`/ai-assist/drafts/${id}/risk-score`, {}),
  getDifferential: (id: string) => api.get<any>(`/ai-assist/drafts/${id}/differential`),
  getConsent: (patientId: string) => api.get<any>(`/ai-assist/consent/${patientId}`),
};

// ============= v3 质控 (5 方法) =============
export const v3QualityReportApi = {
  listReports: (params?: any) => api.get<any[]>(`/quality/reports?${new URLSearchParams(params ?? {}).toString()}`),
  getReport: (id: string) => api.get<any>(`/quality/reports/${id}`),
  getReportSections: (id: string) => api.get<any[]>(`/quality/reports/${id}/sections`),
  exportReport: (id: string, format: 'pdf' | 'xlsx' | 'docx') => api.get<{ url: string }>(`/quality/reports/${id}/export.${format}`),
  getReportConfigs: () => api.get<any[]>('/quality/reports/configs'),
};

// ============= v3 PACS (3 方法) =============
export const v3PacsApi = {
  listStudies: (params?: any) => api.get<any[]>(`/pacs/studies?${new URLSearchParams(params ?? {}).toString()}`),
  getStudy: (uid: string) => api.get<any>(`/pacs/studies/${uid}`),
  verifyWado: (studyUid: string) => api.get<{ ok: boolean; wadoUrl: string }>(`/pacs/studies/${studyUid}/verify`),
};

// ============= v3 Analytics (3 方法) =============
export const v3AnalyticsApi = {
  getDashboard: (params?: { period?: string }) =>
    api.get<any>(`/analytics/dashboard?${new URLSearchParams(params ?? {}).toString()}`),
  getABTestResults: (params?: any) => api.get<any[]>(`/analytics/ab-test?${new URLSearchParams(params ?? {}).toString()}`),
  getErrorLog: (params?: any) => api.get<any[]>(`/analytics/error-log?${new URLSearchParams(params ?? {}).toString()}`),
};

// ============= v3 AI Platform (4 方法) =============
export interface AiGenerateDto {
  templateId: string
  patientId: string
  findings: string
  clinicalHistory?: string
}

export interface AiReviewDto {
  reportId: string
  content: string
}

export interface AiScoreDto {
  reportId: string
  criteria?: string[]
}

export const v3AiPlatformApi = {
  generate: (dto: AiGenerateDto) =>
    api.post<any>('/ai/generate', dto),

  review: (dto: AiReviewDto) =>
    api.post<any>('/ai/review', dto),

  score: (dto: AiScoreDto) =>
    api.post<any>('/ai/score', dto),

  getProviders: () =>
    api.get<{ providers: string[]; active: string }>('/ai/providers'),
};

export interface AiDraftMeta {
  patientId: string
  patientName?: string
  studyInstanceUid?: string
  modality: string
  bodyPart?: string
  clinicalHistory?: string
  findings?: string
  impression?: string
}

export interface AiDraftParagraph {
  id: string
  heading: string
  content: string
  confidence: number
  editable: boolean
}

export interface AiDraftResult {
  paragraphs: AiDraftParagraph[]
  overallConfidence: number
  modelVersion: string
  tokensUsed: number
}

export interface DraftTemplate {
  id: string
  name: string
  modality: string
  bodyPart: string
  description: string
  sections: string[]
}

export const v3AiDraftApi = {
  draft: (meta: AiDraftMeta) =>
    api.post<AiDraftResult>('/ai/draft', meta),

  continueDraft: (meta: AiDraftMeta, existingContent: string) =>
    api.post<AiDraftResult>('/ai/draft/continue', { meta, existingContent }),

  rewriteDraft: (meta: AiDraftMeta, targetParagraph: string, instruction: string) =>
    api.post<AiDraftResult>('/ai/draft/rewrite', { meta, targetParagraph, instruction }),

  getTemplates: (modality?: string) =>
    api.get<{ templates: DraftTemplate[] }>(`/ai/draft/templates${modality ? `?modality=${modality}` : ''}`),
};
