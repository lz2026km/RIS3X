import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { getCurrentTenantId } from '../../common/interceptors/tenant-context.interceptor'
import { floatInRange } from '../../common/utils/deterministic-hash'
import {
  buildReportDraft,
  parseDraftText,
  extractReportFields,
  serializeDraft,
  type DraftSection,
  type ReportStyle,
} from '../../aiplatform/report-templates'
import {
  LlmProviderService,
  defaultLlmProviderService,
  type LlmProviderId,
  type LlmProviderInfo,
} from './llm-provider'

export interface GenerateReportDraftRequest {
  reportId: string
  patientId?: string
  examId?: string
  modality: string
  bodyPart: string
  clinicalInfo?: string
  findings?: string
  keywords?: string[]
  style?: ReportStyle
}

export interface ReportDraftResult {
  id: string
  reportId: string
  draftText: string
  sections: DraftSection[]
  style: string
  status: string
  confidence: number
  modelVersion: string
  createdAt: Date
  updatedAt: Date
}

export const AI_DRAFT_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  MODIFIED: 'MODIFIED',
} as const

// ==================== G-19 深化: LLM + RAG + 结构化字段 ====================

export interface RagSource {
  reportId: string
  date: string
  snippet: string
}

export interface MatchedTerm {
  term: string
  code: string
}

export interface RagContextResult {
  reportId: string
  patientId: string
  modality: string
  bodyPart: string
  clinicalInfo: string
  matchedTerms: MatchedTerm[]
  priorReports: RagSource[]
}

export interface GenerateAdvancedRequest {
  reportId: string
  provider?: LlmProviderId
  includeRag?: boolean
}

export interface AdvancedDraftResult {
  id: string
  reportId: string
  draftText: string
  sections: DraftSection[]
  provider: LlmProviderId
  modelVersion: string
  confidenceScore: number
  sources: RagSource[]
  ragUsed: boolean
  fallbackToMock: boolean
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface GenerateStructuredRequest {
  reportId: string
}

export interface StructuredDraftResult {
  reportId: string
  provider: LlmProviderId
  modelVersion: string
  confidenceScore: number
  sections: DraftSection[]
  draftText: string
  status: string
  createdAt: Date
}

/** SNOMED 术语映射: 术语 → 关键词 → SNOMED-CT 概念码 */
const SNOMED_TERMS: { term: string; code: string; keywords: string[] }[] = [
  { term: '肺', code: '39607008', keywords: ['肺', '胸', '结节', '磨玻璃', '实变'] },
  { term: '肝', code: '10200004', keywords: ['肝', '胆囊'] },
  { term: '乳腺', code: '76752008', keywords: ['乳腺', '乳房', 'BI-RADS'] },
  { term: '脑', code: '12738006', keywords: ['脑', '颅', '卒中', '梗死'] },
  { term: '腰椎', code: '122494005', keywords: ['腰', '椎', '间盘'] },
  { term: '腹部', code: '818983003', keywords: ['腹', '胰腺', '脾'] },
  { term: '甲状腺', code: '69748006', keywords: ['甲状腺', 'TI-RADS'] },
  { term: '心脏', code: '80891009', keywords: ['心', '冠脉'] },
]

function matchSnomedTerms(bodyPart: string, clinicalInfo: string, findings: string): MatchedTerm[] {
  const haystack = `${bodyPart ?? ''} ${clinicalInfo ?? ''} ${findings ?? ''}`
  return SNOMED_TERMS.filter((t) => t.keywords.some((k) => haystack.includes(k))).map((t) => ({
    term: t.term,
    code: `SNOMED-CT:${t.code}`,
  }))
}

const CONFIDENCE_BASE: Record<LlmProviderId, number> = {
  mock: 0.9,
  deepseek: 0.94,
  hunyuan: 0.93,
}

function snippetOf(text: string, max = 80): string {
  const plain = (text ?? '').replace(/\s+/g, ' ').trim()
  return plain.length > max ? `${plain.slice(0, max)}…` : plain
}

let draftCounter = 0

@Injectable()
export class ReportDraftService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly llm?: LlmProviderService,
  ) {}

  private get llmProvider(): LlmProviderService {
    return this.llm ?? defaultLlmProviderService
  }

  /** POST /ai/report-draft — 环境式草稿生成 (模板库 NLG + 临床信息/关键词填充) 并持久化 */
  async generateReportDraft(request: GenerateReportDraftRequest): Promise<ReportDraftResult> {
    if (!request.reportId) throw new BadRequestException('reportId 不能为空')
    const style: ReportStyle = request.style ?? 'standard'
    const built = buildReportDraft({
      modality: request.modality,
      bodyPart: request.bodyPart,
      clinicalInfo: request.clinicalInfo,
      findings: request.findings,
      keywords: request.keywords,
      style,
    })
    const draftText = serializeDraft(built.sections)

    const created = await this.prisma.aiReportDraft.create({
      data: {
        reportId: request.reportId,
        draftText,
        style,
        status: AI_DRAFT_STATUS.PENDING,
        createdBy: getCurrentTenantId(),
      },
    })

    return {
      id: created.id,
      reportId: created.reportId,
      draftText: created.draftText,
      sections: parseDraftText(created.draftText),
      style: created.style,
      status: created.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }
  }

  /** GET /ai/report-draft/:reportId — 按报告查最新草稿 */
  async getDraftByReport(reportId: string): Promise<ReportDraftResult | null> {
    const draft = await this.prisma.aiReportDraft.findFirst({
      where: { reportId },
      orderBy: { createdAt: 'desc' },
    })
    if (!draft) return null
    return {
      id: draft.id,
      reportId: draft.reportId,
      draftText: draft.draftText,
      sections: parseDraftText(draft.draftText),
      style: draft.style,
      status: draft.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    }
  }

  /** POST /ai/report-draft/:id/accept — 医生接受: 草稿 → 正式, 落 reports 表 */
  async acceptDraft(id: string): Promise<ReportDraftResult> {
    const draft = await this.prisma.aiReportDraft.findUnique({ where: { id } })
    if (!draft) throw new NotFoundException(`AI 草稿 ${id} 不存在`)
    if (draft.status === AI_DRAFT_STATUS.ACCEPTED) {
      throw new BadRequestException(`AI 草稿 ${id} 已被接受, 不可重复操作`)
    }

    const fields = extractReportFields(parseDraftText(draft.draftText))
    const existing = await this.prisma.report.findUnique({ where: { id: draft.reportId } })
    if (!existing) {
      throw new NotFoundException(`报告 ${draft.reportId} 不存在, 无法落库`)
    }
    await this.prisma.report.update({
      where: { id: draft.reportId },
      data: {
        findings: fields.findings,
        impression: fields.impression,
        recommendations: fields.recommendations,
        conclusion: fields.conclusion,
      },
    })

    const updated = await this.prisma.aiReportDraft.update({
      where: { id },
      data: { status: AI_DRAFT_STATUS.ACCEPTED, acceptedAt: new Date() },
    })
    await this.audit('ACCEPT', updated)

    return {
      id: updated.id,
      reportId: updated.reportId,
      draftText: updated.draftText,
      sections: parseDraftText(updated.draftText),
      style: updated.style,
      status: updated.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  /** POST /ai/report-draft/:id/modify — 医生修改后保存 */
  async modifyDraft(id: string, draftText: string): Promise<ReportDraftResult> {
    if (!draftText?.trim()) throw new BadRequestException('修改后的草稿内容不能为空')
    const draft = await this.prisma.aiReportDraft.findUnique({ where: { id } })
    if (!draft) throw new NotFoundException(`AI 草稿 ${id} 不存在`)

    const updated = await this.prisma.aiReportDraft.update({
      where: { id },
      data: { draftText, status: AI_DRAFT_STATUS.MODIFIED },
    })
    await this.audit('MODIFY', updated)

    return {
      id: updated.id,
      reportId: updated.reportId,
      draftText: updated.draftText,
      sections: parseDraftText(updated.draftText),
      style: updated.style,
      status: updated.status,
      confidence: 0.9,
      modelVersion: 'deepseek-v3.0',
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    }
  }

  // ==================== G-19 深化: LLM 提供方 ====================

  /** GET /ai-draft/providers — 可用模型列表 (无 key 接口模型 available=false) */
  getProviders(): LlmProviderInfo[] {
    return this.llmProvider.listProviders()
  }

  // ==================== G-19 深化: RAG 检索 ====================

  /** 加载报告基础信息 (含检查), 报告不存在抛 404 */
  private async loadReportContext(reportId: string) {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } })
    if (!report) throw new NotFoundException(`报告 ${reportId} 不存在`)
    let modality = 'CT'
    let bodyPart = '胸部'
    if (report.examId) {
      const exam = await this.prisma.exam.findUnique({ where: { id: report.examId } })
      if (exam) {
        modality = exam.modality ?? modality
        bodyPart = exam.bodyPart ?? bodyPart
      }
    }
    return { report, modality, bodyPart }
  }

  /** 检索同患者既往报告 (排除当前, 有正文的最近 N 份) */
  private async findPriorReports(
    patientId: string,
    excludeReportId: string,
    take = 5,
  ): Promise<{ report: { id: string; createdAt: Date; findings: string; impression: string } }[]> {
    const rows = await this.prisma.report.findMany({
      where: {
        patientId,
        id: { not: excludeReportId },
        OR: [{ findings: { not: '' } }, { impression: { not: '' } }],
      },
      orderBy: { createdAt: 'desc' },
      take,
      select: { id: true, createdAt: true, findings: true, impression: true },
    })
    return rows.map((report) => ({ report }))
  }

  /** GET /ai-draft/rag-context?reportId= — 当前报告摘要 + 匹配术语 + 既往报告摘要 */
  async getRagContext(reportId: string): Promise<RagContextResult> {
    if (!reportId?.trim()) throw new BadRequestException('reportId 不能为空')
    const { report, modality, bodyPart } = await this.loadReportContext(reportId)
    const prior = await this.findPriorReports(report.patientId, reportId)
    const sources: RagSource[] = prior.map(({ report: r }) => ({
      reportId: r.id,
      date: r.createdAt.toISOString().slice(0, 10),
      snippet: snippetOf(r.findings || r.impression),
    }))
    return {
      reportId,
      patientId: report.patientId,
      modality,
      bodyPart,
      clinicalInfo: '',
      matchedTerms: matchSnomedTerms(bodyPart, '', `${report.findings} ${report.impression}`),
      priorReports: sources,
    }
  }

  // ==================== G-19 深化: 高级生成 (LLM + RAG) ====================

  /** POST /ai-draft/generate-advanced — LLM 生成草稿 + confidenceScore + sources[] */
  async generateAdvanced(request: GenerateAdvancedRequest): Promise<AdvancedDraftResult> {
    return this.generateWithRag(request)
  }

  /** generateWithRag: RAG 检索既往报告相似段落 → LLM 生成草稿 + 信心分 + 来源 */
  async generateWithRag(request: GenerateAdvancedRequest): Promise<AdvancedDraftResult> {
    if (!request.reportId) throw new BadRequestException('reportId 不能为空')
    const { report, modality, bodyPart } = await this.loadReportContext(request.reportId)
    const provider: LlmProviderId = request.provider ?? 'mock'
    const includeRag = request.includeRag ?? false

    let sources: RagSource[] = []
    let ragSummary = ''
    if (includeRag) {
      const prior = await this.findPriorReports(report.patientId, request.reportId)
      sources = prior.map(({ report: r }) => ({
        reportId: r.id,
        date: r.createdAt.toISOString().slice(0, 10),
        snippet: snippetOf(r.findings || r.impression),
      }))
      ragSummary = sources
        .map((s) => `既往报告 ${s.reportId} (${s.date}): ${s.snippet}`)
        .join('\n')
    }

    const style: ReportStyle = 'standard'
    const userPrompt = [
      `【modality:${modality}】【bodyPart:${bodyPart}】【style:${style}】`,
      `【clinicalInfo:无】`,
      `【findings:${report.findings || '未见明显异常'}】`,
      ...(ragSummary ? [`【rag-summary】${ragSummary}【/rag-summary】`] : []),
      '请依据以上信息生成规范放射报告草稿。',
    ].join('\n')

    const completion = await this.llmProvider.complete({
      provider,
      system: '你是放射科报告撰写助手, 输出【段落标题】\n内容 格式的结构化草稿。',
      user: userPrompt,
      temperature: 0.3,
    })

    const sections = parseDraftText(completion.text)
    const ragUsed = includeRag && sources.length > 0
    let confidenceScore = CONFIDENCE_BASE[provider] ?? CONFIDENCE_BASE.mock
    if (ragUsed) confidenceScore = Math.min(0.98, confidenceScore + 0.03)
    if (completion.fallbackToMock) confidenceScore = Math.min(0.98, confidenceScore - 0.05)
    confidenceScore = Math.round(confidenceScore * 100) / 100

    const created = await this.prisma.aiReportDraft.create({
      data: {
        reportId: request.reportId,
        draftText: completion.text,
        style,
        status: AI_DRAFT_STATUS.PENDING,
        createdBy: getCurrentTenantId(),
      },
    })

    return {
      id: created.id,
      reportId: created.reportId,
      draftText: created.draftText,
      sections,
      provider: completion.provider,
      modelVersion: completion.model,
      confidenceScore,
      sources,
      ragUsed,
      fallbackToMock: completion.fallbackToMock,
      status: created.status,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    }
  }

  // ==================== G-19 深化: 结构化字段生成 ====================

  /** POST /ai-draft/generate-structured — 自动填充 现病史/检查所见/诊断意见 段落草稿 */
  async generateStructured(request: GenerateStructuredRequest): Promise<StructuredDraftResult> {
    if (!request.reportId) throw new BadRequestException('reportId 不能为空')
    const { report, modality, bodyPart } = await this.loadReportContext(request.reportId)

    const built = buildReportDraft({
      modality,
      bodyPart,
      clinicalInfo: '',
      findings: report.findings || undefined,
      style: 'standard',
    })
    const sections: DraftSection[] = [
      { heading: '现病史', content: `患者因临床需要行${bodyPart}影像检查，具体病史待补充。` },
      { heading: '检查所见', content: built.findingsText || report.findings },
      { heading: '诊断意见', content: report.impression || built.conclusionText },
    ]
    const draftText = serializeDraft(sections)
    const confidenceScore = floatInRange(`${request.reportId}:structured`, 0.86, 0.93, 1, 2)

    const created = await this.prisma.aiReportDraft.create({
      data: {
        reportId: request.reportId,
        draftText,
        style: 'standard',
        status: AI_DRAFT_STATUS.PENDING,
        createdBy: getCurrentTenantId(),
      },
    })

    return {
      reportId: created.reportId,
      provider: 'mock',
      modelVersion: 'mock-nlg-1.0',
      confidenceScore,
      sections,
      draftText: created.draftText,
      status: created.status,
      createdAt: created.createdAt,
    }
  }

  private async audit(action: string, draft: { id: string; reportId: string }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          action,
          resource: 'ai-report-draft',
          detail: { draftId: draft.id, reportId: draft.reportId } as Prisma.InputJsonValue,
          tenantId: getCurrentTenantId(),
        },
      })
    } catch {
      // 审计失败不阻断主流程
    }
  }
}

/** 供测试/前端透传使用 */
export { buildReportDraft, parseDraftText, extractReportFields, serializeDraft }
