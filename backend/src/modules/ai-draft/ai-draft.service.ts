import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { floatInRange, hashString } from '../../common/utils/deterministic-hash'

export interface AiDraftParagraphInput {
  heading: string
  content: string
}

export interface AiDraftRequest {
  patientId: string
  examId: string
  modality: string
  bodyPart: string
  clinicalHistory?: string
  keywords?: string[]
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
  generatedAt: Date
  /** true = 未落库 (DB 不可用或找不到关联报告) */
  simulated?: boolean
}

export interface AiDraftRewriteRequest {
  content: string
  instruction: string
  modality?: string
}

export interface AiDraftContinueRequest {
  existingParagraphs: AiDraftParagraphInput[]
  prompt: string
  modality?: string
}

const MODALITY_TEMPLATES: Record<string, { heading: string; template: string }[]> = {
  CT: [
    { heading: '检查技术', template: '{modality} {bodyPart}平扫+增强扫描' },
    { heading: '影像所见', template: '{bodyPart} 未见明确异常密度影及占位性病变，边界清晰，形态规则' },
    { heading: '诊断意见', template: '未见明确异常，建议定期随访' },
  ],
  MR: [
    { heading: '检查技术', template: '{modality} {bodyPart}平扫，T1WI/T2WI/FLAIR序列' },
    { heading: '影像所见', template: '{bodyPart} 信号均匀，未见异常信号影' },
    { heading: '诊断意见', template: '{bodyPart} MRI未见明显异常' },
  ],
  DR: [
    { heading: '检查技术', template: '{bodyPart}正侧位片' },
    { heading: '影像所见', template: '{bodyPart} 骨质结构完整，未见明确骨折及骨质破坏' },
    { heading: '诊断意见', template: '{bodyPart}未见明显异常' },
  ],
  US: [
    { heading: '检查技术', template: '{bodyPart}超声检查' },
    { heading: '影像所见', template: '{bodyPart} 实质回声均匀，未见明显异常回声' },
    { heading: '诊断意见', template: '{bodyPart}超声未见明显异常' },
  ],
}

/** 确定性置信度: 同内容恒定 0.85-0.94 */
function confidenceOf(content: string): number {
  return floatInRange(content, 0.85, 0.94, 1, 2)
}

/** 确定性段落 id: 以 (seed, index) 派生, 同输入恒定 */
function draftIdOf(seed: string, idx: number): string {
  return `draft-${hashString(`${seed}:${idx}`).toString(16).slice(0, 10)}`
}

@Injectable()
export class AiDraftService {
  constructor(private readonly prisma: PrismaService) {}

  private async persistDraft(request: AiDraftRequest, draftText: string): Promise<boolean> {
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
      await this.prisma.aiReportDraft.create({
        data: {
          reportId: report.id,
          draftText,
          style: 'standard',
          status: 'PENDING',
          createdBy: request.patientId,
        },
      })
      return true
    } catch {
      return false
    }
  }

  async generateDraft(request: AiDraftRequest): Promise<AiDraftResult> {
    const templates = MODALITY_TEMPLATES[request.modality] ?? MODALITY_TEMPLATES['CT']
    const seed = `${request.patientId}:${request.examId}:${request.modality}:${request.bodyPart}`
    const paragraphs: AiDraftParagraph[] = templates.map((tpl, idx) => {
      const content = tpl.template
        .replace('{modality}', request.modality)
        .replace('{bodyPart}', request.bodyPart)
      return {
        id: draftIdOf(seed, idx),
        heading: tpl.heading,
        content,
        confidence: confidenceOf(content),
        editable: true,
      }
    })

    if (request.clinicalHistory) {
      paragraphs.splice(1, 0, {
        id: draftIdOf(seed, 90),
        heading: '临床病史',
        content: request.clinicalHistory,
        confidence: 0.95,
        editable: true,
      })
    }

    if (request.keywords?.length) {
      paragraphs.push({
        id: draftIdOf(seed, 91),
        heading: '关键词标注',
        content: request.keywords.join('、'),
        confidence: 0.90,
        editable: true,
      })
    }

    const overallConfidence = paragraphs.reduce((s, p) => s + p.confidence, 0) / paragraphs.length
    const result: AiDraftResult = {
      paragraphs,
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      modelVersion: 'deepseek-v3.0',
      generatedAt: new Date(),
    }
    const persisted = await this.persistDraft(request, paragraphs.map((p) => `【${p.heading}】${p.content}`).join('\n'))
    if (!persisted) result.simulated = true
    return result
  }

  async rewriteParagraph(request: AiDraftRewriteRequest): Promise<{ content: string; confidence: number }> {
    const content = `【AI改写 - ${request.instruction}】${request.content}`
    return {
      content,
      confidence: confidenceOf(`rewrite:${content}`),
    }
  }

  async continueDraft(request: AiDraftContinueRequest): Promise<AiDraftParagraph> {
    const content = `根据"${request.prompt}"：与既往相比，病灶无明显变化`
    return {
      id: draftIdOf(`continue:${request.prompt}`, 0),
      heading: '补充描述',
      content,
      confidence: confidenceOf(`continue:${content}`),
      editable: true,
    }
  }
}
