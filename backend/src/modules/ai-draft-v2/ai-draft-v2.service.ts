/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 (F1) 服务
 * 能力:
 *  1. 结构化字段自动提取 (规则+字典, 确定性, 字段置信度)
 *  2. 多模态报告生成 (检查类型模板 + 结构化字段 → 描述段落 + 结论)
 *  3. 信心溯源 (每条生成内容附 来源(字段/规则/模板) + 置信分 + 可追溯 ID)
 *  4. 修改建议 (确定性规则)
 * 孤儿模块模式: 无 DB 可启动; DB 不可用时自动回退内存 seed, 结果标注 simulated。
 */
import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { hashString } from '../../common/utils/deterministic-hash'
import {
  extractStructuredFields,
  type ExtractedField,
  type ExtractFieldsRequest,
  type ExtractFieldsResult,
  type FieldCategory,
  MODEL_VERSION,
} from './field-extractor'
import {
  resolveTemplate,
  renderTemplate,
  type DraftTemplate,
} from './templates'
import {
  buildSuggestions,
  type DraftSuggestion,
  type ReportParagraphInput,
  type SuggestRequest,
  type SuggestResult,
} from './suggestions'
import { SEED_DRAFTS } from './seed-drafts'

export { MODEL_VERSION }

// ────────────────────────────────────────────────────────────────────────────
// 请求/结果类型
// ────────────────────────────────────────────────────────────────────────────

export interface GenerateDraftV2Request {
  patientId: string
  examId: string
  modality: string
  bodyPart: string
  /** 医师录入的"影像所见"文本 (可空 → 走模板生成) */
  findings?: string
  clinicalHistory?: string
  keywords?: string[]
}

export type TraceSourceKind = 'template' | 'rule' | 'field' | 'clinicalHistory' | 'seed'

export interface TraceSource {
  kind: TraceSourceKind
  /** 可追溯 ID: 模板 key / 规则 ID / 字段 ID */
  refId: string
  description: string
  confidence: number
}

export type SegmentType = 'technique' | 'findings' | 'conclusion' | 'recommendation' | 'clinicalHistory'

export interface DraftSegment {
  id: string
  paragraphType: SegmentType
  heading: string
  content: string
  confidence: number
  /** 信心溯源: 该段内容对应的全部来源 */
  sources: TraceSource[]
}

export interface GenerateDraftV2Result {
  id: string
  reportId?: string
  segments: DraftSegment[]
  overallConfidence: number
  modelVersion: string
  generatedAt: Date
  /** true = 未落库 (DB 不可用/找不到关联报告), 已回退内存 seed 路径 */
  simulated?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// 确定性辅助
// ────────────────────────────────────────────────────────────────────────────

function segmentIdOf(seed: string, idx: number): string {
  return `seg-${hashString(`${seed}:${idx}`).toString(16).slice(0, 10)}`
}

function draftIdOf(seed: string): string {
  return `draft-v2-${hashString(seed).toString(16).slice(0, 12)}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** 字段 → 所见补充句 (确定性拼接, 与字段同序) */
function buildFieldSentences(fields: ExtractedField[]): string[] {
  const sentences: string[] = []
  const size = fields.find((f) => f.category === 'measurement' && f.ruleId === 'measurement:size-axb')
  const single = fields.filter((f) => f.category === 'measurement' && f.ruleId !== 'measurement:size-axb').map((f) => f.value)
  const comparisons = fields.filter((f) => f.category === 'comparison')
  if (size) sentences.push(`病灶大小约${size.value}。`)
  if (single.length > 0) sentences.push(`测量值: ${single.join('、')}。`)
  for (const c of comparisons) sentences.push(`${c.value}。`)
  return sentences
}

// ────────────────────────────────────────────────────────────────────────────
// 服务
// ────────────────────────────────────────────────────────────────────────────

@Injectable()
export class AiDraftV2Service {
  /** 内存草稿历史 (seed 回退: DB 不可用时仍可列出草稿) */
  private readonly memoryDrafts: GenerateDraftV2Result[] = [...SEED_DRAFTS]

  constructor(private readonly prisma: PrismaService) {}

  // ── 1. 结构化字段自动提取 ────────────────────────────────────────────────

  async extractFields(req: ExtractFieldsRequest): Promise<ExtractFieldsResult> {
    const result: ExtractFieldsResult = {
      ...extractStructuredFields(req),
      generatedAt: new Date(),
    }
    return result
  }

  // ── 2. 多模态报告生成 (模板 + 结构化字段, 确定性) ─────────────────────────

  async generateDraft(request: GenerateDraftV2Request): Promise<GenerateDraftV2Result> {
    const modality = (request.modality ?? 'CT').toUpperCase()
    const bodyPart = request.bodyPart ?? ''
    const seed = `${request.patientId}:${request.examId}:${modality}:${bodyPart}:${request.findings ?? ''}`

    const { template, key: templateKey, matched } = resolveTemplate(modality, bodyPart)
    const rendered = renderTemplate(template, modality, bodyPart)

    // 结构化字段: 优先取请求文本, 否则用模板句子补全
    const extraction = extractStructuredFields({ findings: request.findings ?? '', modality, bodyPart })
    const fields = extraction.fields
    const fieldSentences = buildFieldSentences(fields)

    const segments: DraftSegment[] = []

    // ── 检查技术 (来源: 模板) ──
    segments.push({
      id: segmentIdOf(seed, 0),
      paragraphType: 'technique',
      heading: '检查技术',
      content: rendered.technique,
      confidence: 0.96,
      sources: [{ kind: 'template', refId: templateKey, description: `模板: ${templateKey} (${matched === 'exact' ? '精确匹配' : '通用回退'})`, confidence: 0.96 }],
    })

    // ── 临床病史 (来源: 临床输入) ──
    if (request.clinicalHistory?.trim()) {
      segments.push({
        id: segmentIdOf(seed, 1),
        paragraphType: 'clinicalHistory',
        heading: '临床病史',
        content: request.clinicalHistory.trim(),
        confidence: 0.95,
        sources: [{ kind: 'clinicalHistory', refId: 'clinical-history:input', description: '临床病史原始输入', confidence: 0.95 }],
      })
    }

    // ── 影像所见 (模板句子 + 字段补充句, 逐句溯源) ──
    const baseFindings = request.findings?.trim() ? [request.findings.trim()] : rendered.findings
    const findingSources: TraceSource[] = [
      { kind: 'template', refId: templateKey, description: `所见模板: ${templateKey}`, confidence: matched === 'exact' ? 0.92 : 0.85 },
      ...fields.filter((f) => f.category === 'finding' || f.category === 'bodyPart' || f.category === 'measurement')
        .map((f) => ({ kind: 'field' as const, refId: f.id, description: `字段[${f.label}]: ${f.value}`, confidence: f.confidence })),
    ]
    const findingsContent = [...baseFindings, ...fieldSentences].filter(Boolean).join('')
    segments.push({
      id: segmentIdOf(seed, 2),
      paragraphType: 'findings',
      heading: '影像所见',
      content: findingsContent,
      confidence: round2(findingSources.reduce((s, src) => s + src.confidence, 0) / findingSources.length),
      sources: findingSources,
    })

    // ── 诊断意见 (字段结论优先, 规则兜底, 最后模板) ──
    const conclusionFields = fields.filter((f) => f.category === 'conclusion')
    const conclusionSources: TraceSource[] = []
    let conclusionContent: string | null = null
    if (conclusionFields.length > 0) {
      conclusionContent = conclusionFields.map((f) => f.value).join('；')
      for (const f of conclusionFields) {
        conclusionSources.push({ kind: 'field', refId: f.id, description: `结论字段: ${f.value}`, confidence: f.confidence })
      }
    } else if (fields.some((f) => f.category === 'finding')) {
      // 无结论字段: 见中仅阴性征象 → 规则生成阴性结论
      const negative = fields.filter((f) => f.category === 'finding').every((f) => /未见/.test(f.value))
      if (negative) {
        conclusionContent = `${bodyPart || '检查部位'}未见明显异常。`
        conclusionSources.push({ kind: 'rule', refId: 'rule:negative-conclusion', description: '规则: 阴性征象 → 阴性结论', confidence: 0.9 })
      }
    }
    if (conclusionContent === null) {
      conclusionContent = rendered.conclusions.join('')
      conclusionSources.push({ kind: 'template', refId: templateKey, description: `结论模板: ${templateKey}`, confidence: 0.9 })
    }
    segments.push({
      id: segmentIdOf(seed, 3),
      paragraphType: 'conclusion',
      heading: '诊断意见',
      content: conclusionContent,
      confidence: round2(conclusionSources.reduce((s, src) => s + src.confidence, 0) / conclusionSources.length),
      sources: conclusionSources,
    })

    // ── 建议 (来源: 模板; 阳性征象时追加随访提示) ──
    const recommendationSources: TraceSource[] = [
      { kind: 'template', refId: templateKey, description: `建议模板: ${templateKey}`, confidence: 0.9 },
    ]
    let recommendationContent = rendered.recommendation
    const hasPositive = fields.some((f) => f.category === 'finding' && f.label !== '未见明显异常')
    if (hasPositive && !/随访|复查/.test(recommendationContent)) {
      recommendationContent = `${recommendationContent}建议定期随访复查。`
      recommendationSources.push({ kind: 'rule', refId: 'rule:positive-followup', description: '规则: 阳性征象 → 追加随访建议', confidence: 0.92 })
    }
    segments.push({
      id: segmentIdOf(seed, 4),
      paragraphType: 'recommendation',
      heading: '建议',
      content: recommendationContent,
      confidence: round2(recommendationSources.reduce((s, src) => s + src.confidence, 0) / recommendationSources.length),
      sources: recommendationSources,
    })

    // ── 关键词标注 (来源: 输入) ──
    if (request.keywords?.length) {
      segments.push({
        id: segmentIdOf(seed, 5),
        paragraphType: 'findings',
        heading: '关键词标注',
        content: request.keywords.join('、'),
        confidence: 0.9,
        sources: [{ kind: 'clinicalHistory', refId: 'keywords:input', description: '关键词原始输入', confidence: 0.9 }],
      })
    }

    const overallConfidence = round2(segments.reduce((s, seg) => s + seg.confidence, 0) / segments.length)
    const result: GenerateDraftV2Result = {
      id: draftIdOf(seed),
      segments,
      overallConfidence,
      modelVersion: MODEL_VERSION,
      generatedAt: new Date(),
    }

    const persisted = await this.persistDraft(request, result)
    if (!persisted) {
      result.simulated = true
      this.memoryDrafts.unshift(result)
    }
    return result
  }

  // ── 3. 修改建议 ──────────────────────────────────────────────────────────

  async suggest(req: SuggestRequest): Promise<SuggestResult> {
    return {
      ...buildSuggestions(req),
      generatedAt: new Date(),
    }
  }

  // ── 内存草稿历史 (seed 回退: 无 DB 也可用) ────────────────────────────────

  async listMemoryDrafts(): Promise<GenerateDraftV2Result[]> {
    return [...this.memoryDrafts]
  }

  // ── 持久化 (best-effort, 孤儿路径不抛错) ─────────────────────────────────

  private async persistDraft(request: GenerateDraftV2Request, result: GenerateDraftV2Result): Promise<boolean> {
    try {
      const report = await this.prisma.report.findFirst({
        where: {
          OR: [
            { examId: request.examId },
            { patientId: request.patientId },
          ],
        },
        orderBy: { updatedAt: 'desc' },
        select: { id: true },
      })
      if (!report) return false
      const created = await this.prisma.aiReportDraft.create({
        data: {
          reportId: report.id,
          draftText: result.segments.map((s) => `【${s.heading}】${s.content}`).join('\n'),
          style: 'v2-structured',
          status: 'PENDING',
          createdBy: request.patientId,
        },
      })
      result.reportId = report.id
      return created != null
    } catch {
      return false
    }
  }
}

// 供 spec 引用: 字段类别标签
export type { FieldCategory, ExtractedField, DraftSuggestion, ReportParagraphInput, SuggestRequest }
export type { DraftTemplate }
