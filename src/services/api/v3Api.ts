// [v3.0.6.11-81] W1-B P0: v3 API 清理与映射
//
// 背景: /writing /dist /ai-assist /quality /analytics /integration/cda /pacs/studies
//       后端全无 (仅存在于 MSW mock 层); 62 方法中仅 ~20 在用。
// [v3.0.6.11-92] W2-B P2: 删除 31 个 0 引用 MOCK_ONLY 死方法 (v3DistApi 6 / v3AiAssistApi 5 /
//       v3IntegrationApi 8 / v3WritingApi.listRadLex|preScore / v3QualityReportApi 4 /
//       v3AnalyticsApi 2 / v3PacsApi 2 / v3AiPlatformApi.generate|score)。
// 处理:
//   - 在用方法 → 改调真实后端 API (templatesApi / reportApi / aiDraftApi / fhirApi /
//     analyticsStatsApi / aiPlatformApi / dicomWebApi), 复用现有方法而非新路径。
//   - 无后端方法 → 标注 MOCK_ONLY: 返回本地演示数据, 不发网络请求 (避免 404)。
//   - v3AiPlatformApi / v3AiDraftApi 对应真实后端 modules/ai (ai.controller.ts: /ai/*),
//     v3.0.6.11-73 已对齐, 保留不动。
import type { ApiResponse } from './types'
import { api } from './client'
import { templatesApi } from './templatesApi'
import { reportApi } from './reportApi'
import { aiDraftApi } from './aiDraftApi'
import { fhirApi } from './fhirApi'
import { analyticsStatsApi } from './analyticsApi'
import { aiPlatformApi } from './aiPlatformApi'
import { dicomWebApi } from './dicomApi'

function mockOk<T>(data: T): Promise<ApiResponse<T>> {
  return Promise.resolve({
    success: true,
    data,
    meta: Array.isArray(data)
      ? { total: data.length, page: 1, pageSize: data.length, totalPages: 1 }
      : undefined,
  })
}

// ============= v3 写作 (12 方法) =============
export const v3WritingApi = {
  // ── REAL: 后端 /templates (templates.controller) ──
  listTemplates: (params?: { category?: string; bodyPart?: string; keyword?: string }) =>
    templatesApi.list(params),
  getTemplate: (id: string) => templatesApi.getById(id),
  createTemplate: (data: any) => templatesApi.create(data),
  updateTemplate: (id: string, data: any) => templatesApi.update(id, data),
  deleteTemplate: (id: string) => templatesApi.delete(id),

  // ── REAL: 草稿 = WRITING 状态报告 (reports.controller: GET /reports?state=WRITING) ──
  listDrafts: (params?: any) => reportApi.list({ state: 'WRITING', ...(params ?? {}) }),
  getDraft: (id: string) => reportApi.getById(id),
  saveDraft: (id: string, data: any) =>
    reportApi.update(id, { findings: data?.findings, conclusion: data?.impression ?? data?.conclusion }),

  // ── REAL: 环境式 AI 报告草稿 (report-draft.controller: POST /ai/report-draft) ──
  aiDraft: async (data: {
    templateId: string
    patientId: string
    findings: string
    modality?: string
    bodyPart?: string
    clinicalHistory?: string
  }) => {
    const res = await aiDraftApi.generateReportDraft({
      reportId: data.patientId,
      modality: data.modality ?? 'CT',
      bodyPart: data.bodyPart ?? '胸部',
      findings: data.findings,
      clinicalInfo: data.clinicalHistory ?? data.findings,
    })
    if (!res.success) return res as ApiResponse<any>
    const d = res.data as any
    const sections = Array.isArray(d?.sections) ? d.sections : []
    const pick = (key: string) => sections.find((s: any) => (s?.heading ?? '').includes(key))?.content ?? ''
    return {
      ...res,
      data: {
        id: d?.id ?? `draft-${Date.now()}`,
        findings: d?.draftText ?? pick('所见'),
        diagnosis: pick('诊断'),
        impression: pick('意见') || pick('建议'),
        confidence: d?.confidence ?? 0.9,
        sources: [d?.modelVersion ? `AI Model ${d.modelVersion}` : 'AI Model'],
      },
    }
  },

  // ── MOCK_ONLY: 后端无短语库 / RadLex / 预评分端点 (listPhrases 仍被 ReportWritePage 使用)
  listPhrases: () =>
    mockOk([
      { id: 'p-1', text: '双肺透光度增加，肺纹理增多', category: 'finding' },
      { id: 'p-2', text: '未见明显异常', category: 'conclusion' },
      { id: 'p-3', text: '建议定期随访', category: 'recommendation' },
    ]),
}

// ============= v3 分发 (2 方法) =============
export const v3DistApi = {
  // MOCK_ONLY: 后端无 /dist/* 端点
  listChannels: () =>
    mockOk([
      { id: 'ch-1', name: '院内打印', type: 'print', status: 'active' },
      { id: 'ch-2', name: '短信推送', type: 'sms', status: 'active' },
    ]),
  listTasks: () =>
    mockOk([
      { id: 't-1', reportId: 'RPT-DEMO-1', channel: 'print', status: 'delivered', recipient: '住院部' },
      { id: 't-2', reportId: 'RPT-DEMO-2', channel: 'sms', status: 'queued', recipient: '门诊' },
    ]),
}

// ============= v3 集成 (2 方法) =============
export const v3IntegrationApi = {
  // REAL: 后端 FHIR R4 (fhir.controller: GET /fhir/r4/Patient)
  listFHIR: async () => {
    const res = await fhirApi.searchPatient()
    if (!res.success) return res as unknown as ApiResponse<any[]>
    const bundle = res.data as any
    const entries = Array.isArray(bundle?.entry) ? bundle.entry : []
    return {
      ...res,
      data: entries.map((e: any) => ({
        id: e?.resource?.id ?? e?.resource?.resourceType,
        resourceType: e?.resource?.resourceType ?? 'Patient',
        status: 'final',
      })),
    }
  },

  // MOCK_ONLY: 后端无 webhook 端点
  listWebhooks: () => mockOk([]),
}

// ============= v3 AI 协助 (1 方法) =============
export const v3AiAssistApi = {
  // REAL: 后端 AI 辅助建议 (ai-platform.controller: GET /ai-platform/assist)
  listDrafts: () => aiPlatformApi.listAssist(),
}

// ============= v3 质控 (1 方法) =============
export const v3QualityReportApi = {
  // MOCK_ONLY: 后端无 /quality/reports 列表端点 (真实质控为 /reports/quality/evaluate)
  listReports: () =>
    mockOk([
      { id: 'qc-1', period: 'month', score: 92, publishedAt: '2026-07-01' },
      { id: 'qc-2', period: 'quarter', score: 88, publishedAt: '2026-07-15' },
    ]),
}

// ============= v3 PACS (1 方法) =============
export const v3PacsApi = {
  // REAL: 后端 DICOMWeb (dicom-web.controller: GET /dicom-web/studies)
  listStudies: (params?: any) => dicomWebApi.searchStudies(params),
}

// ============= v3 Analytics (1 方法) =============
export const v3AnalyticsApi = {
  // REAL: 后端 /stats/dashboard (stats.controller)
  getDashboard: async (_params?: { period?: string }) => {
    const res = await analyticsStatsApi.getDashboard()
    if (!res.success) return res as ApiResponse<any>
    const d = res.data as any
    return {
      ...res,
      data: {
        totalReports: d.reportCount ?? 0,
        reviewed: 0,
        avgTAT: d.avgTAT ?? 0,
        signedRate: 0,
        aiAdoption: 0,
        distSuccess: 0,
      },
    }
  },
}

// ============= v3 AI Platform (2 方法) =============
// REAL: 后端 modules/ai (ai.controller.ts: POST /ai/review, GET /ai/providers)

export interface AiReviewDto {
  reportText: string
  findings: string
  conclusion: string
}

export const v3AiPlatformApi = {
  review: (dto: AiReviewDto) =>
    api.post<any>('/ai/review', dto),

  getProviders: () =>
    api.get<{ providers: string[]; active: string }>('/ai/providers'),
}

// ============= v3 AI 草稿 (4 方法) =============
// REAL: 后端 modules/ai (ai.controller.ts: POST /ai/draft|/ai/draft/continue|/ai/draft/rewrite, GET /ai/draft/templates)
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
}
