import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'
import type { ReportQueryParams } from './types'
import type { ReportDto } from '../../types/dto'
import { getCurrentUser } from '../../utils/auth'

export type { ReportDto }

type ReportState =
  | 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'WRITING' | 'SUBMITTED'
  | 'INITIAL_REVIEW' | 'FINAL_REVIEW' | 'CO_SIGN_REVIEW' | 'REVIEWED'
  | 'SIGNING' | 'SIGNED' | 'PUBLISHED' | 'AMENDING' | 'AMENDED'
  | 'WITHDRAWN' | 'REJECTED' | 'ESCALATED' | 'ARCHIVED'
  | 'RECTIFYING' | 'SUPPLEMENTING' | 'SUPPLEMENTED' | 'REDISTRIBUTING'

async function transition(id: string, to: ReportState, reason?: string) {
  const user = getCurrentUser()
  const actorId = user?.id ?? 'unknown'
  const body: Record<string, unknown> = { to, actorId }
  if (reason) body.reason = reason
  const res = await api.post<ReportDto>(`/reports/${id}/transition`, body)
  await invalidateApiCache(`/reports/${id}`)
  await invalidateApiCacheByPrefix('/reports')
  return res
}

/**
 * [W6] 幂等流转: 目标态与当前态一致时直接返回成功, 不再调用 PATCH/POST,
 * 避免后端拒绝自环 (如 REVIEWED → REVIEWED / INITIAL_REVIEW → INITIAL_REVIEW 400)。
 */
const REPORT_STATUS_TO_STATE: Record<string, string> = {
  draft: 'WRITING', pending: 'PENDING_ASSIGNMENT', submitted: 'SUBMITTED', inreview: 'INITIAL_REVIEW',
  in_review: 'INITIAL_REVIEW', review: 'INITIAL_REVIEW', reviewed: 'REVIEWED', cosigned: 'CO_SIGN_REVIEW',
  signed: 'SIGNED', published: 'PUBLISHED', final: 'PUBLISHED', amended: 'AMENDED', rejected: 'REJECTED',
  withdrawn: 'WITHDRAWN', cancelled: 'WITHDRAWN', archived: 'ARCHIVED',
}
function reportStateOf(dto?: ReportDto): string | undefined {
  const state = String(dto?.state ?? '').toUpperCase()
  if (state) return state
  const byStatus = REPORT_STATUS_TO_STATE[String(dto?.status ?? '').toLowerCase()]
  return byStatus
}
async function transitionIfChanged(id: string, to: ReportState, reason?: string) {
  try {
    const cur = await api.get<ReportDto>(`/reports/${id}`)
    if (reportStateOf(cur.data) === to) {
      return { success: true, data: cur.data } as Awaited<ReturnType<typeof transition>>
    }
  } catch {
    // 读取失败时照常尝试流转, 由后端返回准确错误
  }
  return transition(id, to, reason)
}

// [G005 P1] 列表双形状: MSW 裸数组 / 后端 { items, total }
export type ListPayload<T> = T[] | { items: T[]; total: number }

// [v3.0.6.11-100 Wave 2B (报告-影像标注双向同步)] 标注项 (与后端 SaveImageAnnotationsSchema 对齐)
export type ReportImageAnnotationType = 'arrow' | 'circle' | 'ruler' | 'box'

export interface ReportImageAnnotationItem {
  id: string
  type: ReportImageAnnotationType
  x1: number
  y1: number
  x2: number
  y2: number
  label: string
  color: string
}

export interface SaveReportImageAnnotationsPayload {
  studyUid?: string
  seriesUid?: string
  instanceUid?: string
  annotations: ReportImageAnnotationItem[]
  imageBase64?: string
}

export interface ReportImageAnnotationsDto {
  reportId: string
  studyUid: string
  seriesUid: string
  instanceUid: string
  annotations: ReportImageAnnotationItem[]
  imageBase64: string
  createdAt?: string
  updatedAt: string | null
  createdBy?: string
}

// [v3.0.6.11-100 Wave 6B (D-5)] 同患者既往报告摘要 (历史报告→本次报告字段复用)
export interface ReportPriorSummaryDto {
  reportId: string
  patientId: string
  count: number
  lastReportDate: string | null
  lastFindings: string
  lastImpression: string
  commonDiagnoses: Array<{ keyword: string; count: number }>
  source: 'db' | 'seed'
}

// [G005 W4A] 结构化字段预签校验 (POST /reports/:id/validate-fields)
export interface ReportFieldValidationIssue {
  field: string
  label: string
  severity: 'error' | 'warning'
  message: string
}

export interface ReportFieldValidationResult {
  reportId: string
  valid: boolean
  errors: ReportFieldValidationIssue[]
  warnings: ReportFieldValidationIssue[]
}

export const reportApi = {
  list: (params?: ReportQueryParams) =>
    api.get<ListPayload<ReportDto>>(`/reports?${new URLSearchParams(params as Record<string, string>).toString()}`),

  getById: (id: string) =>
    api.get<ReportDto>(`/reports/${id}`),

  // [v3.0.6.11-70] P0: 允许 conclusion/radiologistId 等后端字段 (backend CreateReportSchema/UpdateReportSchema)
  create: async (data: Partial<ReportDto> & { conclusion?: string; radiologistId?: string; state?: string }) => {
    const res = await api.post<ReportDto>('/reports', data)
    await invalidateApiCache('/reports')
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  update: async (id: string, data: Partial<ReportDto> & { conclusion?: string; radiologistId?: string; state?: string }) => {
    const res = await api.patch<ReportDto>(`/reports/${id}`, data)
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  submit: async (id: string) => transition(id, 'SUBMITTED'),

  // [v3.0.6.11-73] P0 21 态对齐: 提交审核 (WRITING/SUBMITTED → INITIAL_REVIEW)
  // [v3.0.6.11-103 Wave 13] 流程质量门禁: WRITING 必须先 SUBMITTED 才能进审 (防跳转),
  //   两步提交: WRITING → SUBMITTED → INITIAL_REVIEW; 已在 SUBMITTED 直接进审
  submitForReview: async (id: string) => {
    const cur = await api.get<ReportDto>(`/reports/${id}`)
    const state = cur.data?.state as ReportState | undefined
    if (state === 'WRITING') {
      const submitted = await transition(id, 'SUBMITTED')
      if (!submitted.success) return submitted
    }
    // [W6] 已在 INITIAL_REVIEW 时跳过自环
    return transitionIfChanged(id, 'INITIAL_REVIEW')
  },

  // [v3.0.6.11-95 Wave2A P0] 报告退回重写闭环: ASSIGNED/PENDING_ASSIGNMENT → WRITING (进入书写态)
  startWriting: (id: string, reason?: string) => transition(id, 'WRITING', reason),

  // [v3.0.6.11-95 Wave2A P0] REJECTED → WRITING (驳回后退回重写, 对齐 backend REPORT_TRANSITIONS.REJECTED)
  rework: (id: string, reason?: string) => transition(id, 'WRITING', reason),

  // [v3.0.6.11-92 Wave1B P0] 审核分级 transition (修复跳中间态断链):
  //   初核通过 → FINAL_REVIEW, 终核通过 → CO_SIGN_REVIEW(需双签)/REVIEWED;
  //   无 type 时 (ReviewCheckPage/ReportReviewPage 通用调用) 按报告当前状态推导下一步
  review: async (id: string, data?: { type?: 'initial' | 'final'; doctorId?: string; doctorName?: string; suggestion?: string; score?: number; needsCosign?: boolean }) => {
    if (data?.type === 'initial') return transitionIfChanged(id, 'FINAL_REVIEW')
    if (data?.type === 'final') return transitionIfChanged(id, data.needsCosign ? 'CO_SIGN_REVIEW' : 'REVIEWED')
    try {
      const cur = await api.get<ReportDto>(`/reports/${id}`)
      const state = cur.data?.state as ReportState | undefined
      if (state === 'INITIAL_REVIEW') return transition(id, 'FINAL_REVIEW')
      if (state === 'FINAL_REVIEW') return transition(id, 'CO_SIGN_REVIEW')
      if (state === 'CO_SIGN_REVIEW') return transition(id, 'REVIEWED')
      // [W6] 已在 REVIEWED (或未知态) 时跳过自环
      return transitionIfChanged(id, 'REVIEWED')
    } catch {
      return transitionIfChanged(id, 'REVIEWED')
    }
  },

  // [v3.0.6.11-92 Wave1B P0] 双签通过 → REVIEWED (分步链 CO_SIGN_REVIEW → REVIEWED)
  completeCosignReview: (id: string) => transitionIfChanged(id, 'REVIEWED'),

  // [v3.0.6.11-92 Wave1B P0] 报告特殊态入口: 补充/整改/跨院区重分配/升级
  supplement: (id: string, note?: string) => transition(id, 'SUPPLEMENTING', note),
  rectify: (id: string, reason?: string) => transition(id, 'RECTIFYING', reason),
  redistribute: (id: string, reason?: string) => transition(id, 'REDISTRIBUTING', reason),
  escalate: (id: string, reason?: string) => transition(id, 'ESCALATED', reason),

  // [v3.0.6.11-95 Wave3B P1] 批量状态流转: POST /reports/batch-transition
  //   逐条校验过渡, 单条失败不阻断其余 → { succeeded: [{id,state}], failed: [{id,message}] }
  batchTransition: async (ids: string[], to: ReportState, reason?: string) => {
    const user = getCurrentUser()
    const res = await api.post<{ succeeded: Array<{ id: string; state: string }>; failed: Array<{ id: string; message: string }> }>(
      '/reports/batch-transition',
      { ids, to, actorId: user?.id ?? 'unknown', reason },
    )
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  sign: async (id: string) => transitionIfChanged(id, 'SIGNED'),

  // [G005 W1-Controls P0] 报告电子签名记录 (report-signing 流程):
  //   后端 report-sign-v2 签名端点 + MSW /reports/:id/signature 确定性兜底
  recordSignature: async (id: string, data: { signerName?: string; signedById?: string; algorithm?: 'SHA-256' | 'SM3'; reason?: string }) => {
    const res = await api.post<{
      reportId: string
      signed: boolean
      signature: ReportSignatureDto
      history: ReportSignatureDto[]
    }>(`/reports/${encodeURIComponent(id)}/signature`, data)
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  reject: async (id: string, reason: string) => transition(id, 'REJECTED', reason),

  // [G005 W4A] 预签结构化字段校验 (POST /reports/:id/validate-fields)
  validateFields: (id: string, values?: Record<string, unknown>) =>
    api.post<ReportFieldValidationResult>(
      `/reports/${encodeURIComponent(id)}/validate-fields`,
      values && Object.keys(values).length > 0 ? { values } : {},
    ),

  // [G005 contract] 发布携带 qualityScore (后端 transition 接收并落库 Report.qualityScore)
  publish: async (id: string, qualityScore?: number) => {
    // [W6] 已发布时跳过 (避免 PUBLISHED → PUBLISHED 无意义重复调用)
    try {
      const cur = await api.get<ReportDto>(`/reports/${id}`)
      if (reportStateOf(cur.data) === 'PUBLISHED') {
        return { success: true, data: cur.data } as Awaited<ReturnType<typeof transition>>
      }
    } catch {
      // 读取失败照常发布
    }
    const user = getCurrentUser()
    const body: Record<string, unknown> = { to: 'PUBLISHED', actorId: user?.id ?? 'unknown' }
    if (qualityScore !== undefined) body.qualityScore = qualityScore
    const res = await api.post<ReportDto>(`/reports/${id}/transition`, body)
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  revise: async (id: string) => transition(id, 'AMENDING'),

  // [G005 W2-C] 行删除: 后端 DELETE /reports/:id 需 body { reason } (状态置 WITHDRAWN)
  remove: async (id: string, reason: string = '手动删除') => {
    const res = await api.delete<ReportDto>(`/reports/${id}`, { reason })
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  // [v3.0.6.8-45] PR1: 双签 + 版本对比 + 审计轨迹
  cosign: async (id: string, _cosignerId: string) => {
    const res = await transitionIfChanged(id, 'CO_SIGN_REVIEW')
    return res
  },

  diff: (id: string) =>
    api.get<{ oldVersion: Partial<ReportDto>; newVersion: Partial<ReportDto>; changes: string[] }>(`/reports/${id}/diff`),

  auditTrail: (id: string) =>
    api.get<{
      events: Array<{ id: string; timestamp: string; actor: string; action: string; fromState: string; toState: string; reason?: string }>;
    }>(`/reports/${id}/audit-trail`),

  // [v3.0.6.11-70] P0 报告导出真实化: POST /reports/:id/export (后端入队, 返回下载地址)
  exportReport: (id: string, format: string = 'pdf') =>
    api.post<{ queued: boolean; downloadUrl?: string; format?: string }>(`/reports/${id}/export`, { format }),

  // [W2-3] 导出真实化: 轮询导出任务状态
  // [v3.0.6.11-88 P0] 对齐后端派生形状 { status, exportedAt?, fileUrl? } (MSW 兼容 downloadUrl 旧字段)
  exportStatus: (id: string) =>
    api.get<{ status: string; format?: string; downloadUrl?: string; fileUrl?: string; exportedAt?: string; queuedAt?: string }>(`/reports/${id}/export-status`),

  // [v3.0.6.11-88 P0] 导出文件下载: 走 api.getBlob (带 Authorization 头, 后端 GET /reports/export-files/:fileName)
  downloadExportFile: (fileName: string) =>
    api.getBlob<Blob>(`/reports/export-files/${encodeURIComponent(fileName)}`),

  // [W4-B] 批量报告导出: 创建任务 + 轮询状态
  batchExport: (ids: string[], format: string = 'pdf') =>
    api.post<{ taskId: string; status: string; total: number; format: string }>('/reports/batch-export', { ids, format }),

  batchExportStatus: (taskId: string) =>
    // [W4-B] 轮询端点: 追加时间戳绕过 client 内存缓存, 保证每次轮询拿到最新状态
    api.get<{
      taskId: string
      status: 'pending' | 'running' | 'completed' | 'failed'
      progress: number
      total: number
      done: number
      failedCount: number
      format: string
      error?: string
      downloads: Array<{ reportId: string; fileName: string; filePath: string; sizeBytes: number; format: string; downloadUrl: string }>
      createdAt: string
      updatedAt: string
    }>(`/reports/batch-export/${taskId}?t=${Date.now()}`),

  // [v3.0.6.11-100 Wave 2B (报告-影像标注双向同步)]
  //   阅片器标注 → POST /reports/:id/image-annotations (覆盖保存, 报告侧可查看)
  saveImageAnnotations: async (id: string, payload: SaveReportImageAnnotationsPayload) => {
    const res = await api.post<ReportImageAnnotationsDto>(`/reports/${id}/image-annotations`, payload)
    await invalidateApiCache(`/reports/${id}/image-annotations`)
    return res
  },

  // 报告关联影像标注列表: GET /reports/:id/image-annotations
  getImageAnnotations: (id: string) =>
    api.get<ReportImageAnnotationsDto>(`/reports/${id}/image-annotations`),

  // [v3.0.6.11-100 Wave 6B (D-5)] 同患者既往报告摘要: GET /reports/:id/prior-summary
  getPriorSummary: (id: string) =>
    api.get<ReportPriorSummaryDto>(`/reports/${id}/prior-summary`),

  // [G005 Wave 8] 报告冷归档策略: GET/PUT /reports/archive-policy + POST /reports/:id/archive
  getArchivePolicy: () =>
    api.get<{
      enabled: boolean
      archiveAfterDays: number
      targetTier: 'archive' | 'cold'
      deleteSourceAfterDays: number | null
      updatedAt: string
      archivedCount: number
      pendingCount: number
    }>('/reports/archive-policy'),

  updateArchivePolicy: async (data: { enabled?: boolean; archiveAfterDays?: number; targetTier?: 'archive' | 'cold'; deleteSourceAfterDays?: number | null }) => {
    const res = await api.put<{
      enabled: boolean
      archiveAfterDays: number
      targetTier: 'archive' | 'cold'
      deleteSourceAfterDays: number | null
      updatedAt: string
      archivedCount: number
      pendingCount: number
    }>('/reports/archive-policy', data)
    await invalidateApiCache('/reports/archive-policy')
    return res
  },

  archiveReport: async (id: string) => {
    const res = await api.post<{ id: string; state: string; archivedAt: string; alreadyArchived?: boolean; task: { id: string; reportId: string; status: string; targetTier: string; archivedAt: string } }>(`/reports/${id}/archive`, {})
    await invalidateApiCache(`/reports/${id}`)
    await invalidateApiCacheByPrefix('/reports')
    return res
  },

  // [W6] 已归档报告列表 (只读): GET /reports?state=ARCHIVED
  //   复用后端 GET /reports 的 state 过滤 (ReportStateEnum 含 ARCHIVED), 免新增后端路由。
  listArchived: (params?: { keyword?: string }) => {
    const sp = new URLSearchParams({ state: 'ARCHIVED', take: '200' })
    if (params?.keyword) sp.set('keyword', params.keyword)
    return api.get<ListPayload<ReportDto>>(`/reports?${sp.toString()}`)
  },

  // [v3.0.6.11-103 Wave 2A] 报告总览: GET /reports/overview (各状态/今日完成/平均时效)
  getOverview: () =>
    api.get<{
      total: number
      todayCreated: number
      todayCompleted: number
      todaySigned: number
      todayPublished: number
      criticalCount: number
      pendingCount: number
      overdueCount: number
      avgTurnaroundHours: number
      byStatus: Record<string, number>
    }>('/reports/overview'),

  // [v3.0.6.11-103 Wave 2A] 医生维度报告统计: GET /reports/by-doctor
  getByDoctor: () =>
    api.get<{
      items: Array<{ id: string; name: string; total: number; published: number; pending: number; avgTurnaroundHours: number }>
      total: number
    }>('/reports/by-doctor'),

  // [v3.0.6.11-103 Wave 2A] 近 N 日报告趋势: GET /reports/daily-trend?days=
  getDailyTrend: (days = 30) =>
    api.get<{
      items: Array<{ date: string; created: number; published: number; signed: number }>
      total: number
    }>(`/reports/daily-trend?days=${days}`),

  // [v3.0.6.11-103 Wave 2A] 报告关联病灶列表: GET /reports/:id/lesions
  getReportLesions: (id: string) =>
    api.get<{ reportId: string; items: Array<Record<string, unknown>> }>(`/reports/${id}/lesions`),

  // [v3.0.6.11-103 Wave 2A] 报告关联信息 (检查/患者/既往报告/随访/危急值): GET /reports/:id/related
  getRelated: (id: string) =>
    api.get<{
      reportId: string
      patient: { id: string; name: string; gender?: string; birthDate?: string; phone?: string } | null
      exam: { id: string; accessionNumber?: string; modality?: string; bodyPart?: string; state?: string; scheduledAt?: string; completedAt?: string } | null
      previousReports: Array<{ id: string; state?: string; findings?: string; conclusion?: string; createdAt?: string; isCritical?: boolean }>
      followUpPlans: Array<{ id: string; planDate?: string; nextDate?: string; status?: string; note?: string }>
      criticalValues: Array<{ id: string; description?: string; severity?: string; state?: string; createdAt?: string; linkedByReport?: boolean }>
    }>(`/reports/${id}/related`),

  // [v3.0.6.11-103 Wave 2A] 应用模板到报告 (后端合并): POST /reports/:id/templates-apply
  applyTemplate: async (id: string, templateId: string, mode: 'append' | 'overwrite' = 'append') => {
    const res = await api.post<ReportDto & { templateApplied?: { templateId: string; name: string; mode: string } }>(
      `/reports/${id}/templates-apply`,
      { templateId, mode },
    )
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  // ══════════════════════════════════════════════════════════════════════
  // [G005 W8-Report] 内容版本 / 数据签名 / 分级审核 / 字段规范 / 召回
  // ══════════════════════════════════════════════════════════════════════

  // 内容版本快照列表
  getRevisions: (id: string) =>
    api.get<{ reportId: string; total: number; data: ReportRevisionContentDto[] }>(`/reports/${id}/revisions`),

  // 指定版本相对前一版本的内容差异
  getRevisionDiff: (id: string, versionId: string) =>
    api.get<ReportRevisionDiffDto>(`/reports/${id}/revisions/${encodeURIComponent(versionId)}/diff`),

  // 最新数据签名 + 历史
  getSignature: (id: string) =>
    api.get<{ reportId: string; signed: boolean; signature: ReportSignatureDto | null; history: ReportSignatureDto[] }>(`/reports/${id}/signature`),

  // 验签 (证书/CRL/摘要/签名/TSA)
  verifySignature: async (id: string, body?: { signatureId?: string; content?: Partial<ReportSignatureContent> }) => {
    const res = await api.post<ReportSignatureVerificationDto>(`/reports/${id}/verify-signature`, body ?? {})
    return res
  },

  // 分级审核链判定
  resolveReviewTier: (id: string, body: ReviewTierQuery) =>
    api.post<ReviewTierResolutionDto>(`/reports/${id}/resolve-review-tier`, body),

  // 结构化字段规范 + 参考范围
  getFieldSpecs: () =>
    api.get<{ source: string; generatedAt: string; total: number; data: ReportFieldSpecDto[] }>('/reports/field-specs'),

  // 报告召回: HL7 ORU(C) + 通知
  recall: async (id: string, reason: string, actorId?: string) => {
    const user = getCurrentUser()
    const res = await api.post<ReportRecallDto>(`/reports/${id}/recall`, { reason, actorId: actorId ?? user?.id ?? 'unknown' })
    await invalidateApiCache(`/reports/${id}`)
    return res
  },

  // 召回回执状态
  getRecallAck: (id: string) =>
    api.get<ReportRecallAckDto>(`/reports/${id}/recall-ack`),

  // 临床回执确认
  acknowledgeRecall: async (id: string, ackBy: string, note?: string, source: 'HIS' | 'CLINICIAN' = 'CLINICIAN') => {
    const res = await api.post<ReportRecallDto>(`/reports/${id}/recall-ack`, { ackBy, note, source })
    return res
  },
}

// ── [G005 W8-Report] DTO ──
export interface ReportRevisionContentDto {
  id: string
  reportId: string
  versionNumber: number
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
  qualityScore: number | null
  actorId: string
  fromState: string
  toState: string
  reason?: string
  createdAt: string
}

export interface ReportRevisionDiffDto {
  reportId: string
  fromVersionId: string | null
  toVersionId: string
  fromVersionNumber: number | null
  toVersionNumber: number
  changedFields: string[]
  fields: Array<{ field: string; label: string; before: string; after: string; changed: boolean }>
  before: ReportRevisionContentDto | null
  after: ReportRevisionContentDto
}

export type SignatureAlgorithm = 'SHA-256' | 'SM3'

export interface ReportSignatureContent {
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
  qualityScore: number | null
  version: number
}

export interface ReportSignatureDto {
  reportId: string
  signatureId: string
  algorithm: SignatureAlgorithm
  digest: string
  signature: string
  signedById: string
  signedAt: string
  tsaToken: string
  certificateSerial: string
  status: 'valid' | 'superseded' | 'revoked'
  content: ReportSignatureContent
  supersededBy?: string
  supersededAt?: string
}

export interface ReportCertificateDto {
  serial: string
  subject: string
  issuer: string
  algorithm: SignatureAlgorithm
  usage: string
  notBefore: string
  notAfter: string
  status: 'valid' | 'revoked'
  keyId: string
  revocationReason?: string
  revokedAt?: string
}

export interface ReportSignatureVerificationDto {
  valid: boolean
  reportId: string
  signatureId: string | null
  algorithm: SignatureAlgorithm | null
  reasons: string[]
  digestMatch: boolean
  signatureMatch: boolean
  certificateValid: boolean
  notRevoked: boolean
  tsaValid: boolean
  certificate: ReportCertificateDto | null
  signedAt: string | null
  signedById: string | null
  computedDigest: string | null
  verifiedAt: string
}

export interface ReviewTierQuery {
  modality?: string
  radsCategory?: number
  severity?: 'low' | 'normal' | 'high' | 'critical'
  isCritical?: boolean
  authorSeniority?: 'resident' | 'attending' | 'senior' | 'chief'
  authorId?: string
}

export interface ReviewTierResolutionDto {
  source: string
  generatedAt: string
  reportId?: string
  input: ReviewTierQuery
  requiredTier: 'none' | 'initial' | 'final' | 'dual-sign' | 'dual-read'
  tierLabel: string
  steps: Array<{ order: number; step: string; role: string; label: string; reason: string }>
  matchedRules: Array<{ ruleId: string; code: string; name: string; tier: string; reason: string }>
  critical: boolean
}

export interface ReportFieldSpecDto {
  field: string
  label: string
  labelEn: string
  type: 'text' | 'number' | 'enum'
  required: boolean
  unit?: string
  minLength?: number
  maxLength?: number
  min?: number
  max?: number
  normalRange?: { min?: number; max?: number; unit: string; reference: string }
  allowedValues?: string[]
  description: string
}

export interface ReportRecallDto {
  id?: string
  reportId: string
  reason?: string
  actorId?: string
  recalledAt?: string
  hl7?: { messageType: string; controlId: string; resultStatus: string; target: string; message: string; sentAt: string; bytes: number }
  notify?: { channel: string; event: string; delivered: boolean }
  acknowledgement?: { ackBy: string; ackAt: string; note: string; source: 'HIS' | 'CLINICIAN' }
}

export interface ReportRecallAckDto {
  reportId: string
  recalled: boolean
  notifiedAt: string | null
  acknowledged: boolean
  acknowledgement: { ackBy: string; ackAt: string; note: string; source: 'HIS' | 'CLINICIAN' } | null
  controlId: string | null
}
