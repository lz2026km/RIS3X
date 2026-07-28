import { Injectable } from '@nestjs/common'

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

let idCounter = 0

@Injectable()
export class AiDraftService {
  async generateDraft(request: AiDraftRequest): Promise<AiDraftResult> {
    const templates = MODALITY_TEMPLATES[request.modality] ?? MODALITY_TEMPLATES['CT']
    const paragraphs: AiDraftParagraph[] = templates.map((tpl, idx) => {
      const content = tpl.template
        .replace('{modality}', request.modality)
        .replace('{bodyPart}', request.bodyPart)

      const confidence = 0.85 + Math.random() * 0.1
      return {
        id: `draft-${++idCounter}`,
        heading: tpl.heading,
        content,
        confidence: Math.round(confidence * 100) / 100,
        editable: true,
      }
    })

    if (request.clinicalHistory) {
      paragraphs.splice(1, 0, {
        id: `draft-${++idCounter}`,
        heading: '临床病史',
        content: request.clinicalHistory,
        confidence: 0.95,
        editable: true,
      })
    }

    if (request.keywords?.length) {
      paragraphs.push({
        id: `draft-${++idCounter}`,
        heading: '关键词标注',
        content: request.keywords.join('、'),
        confidence: 0.90,
        editable: true,
      })
    }

    const overallConfidence = paragraphs.reduce((s, p) => s + p.confidence, 0) / paragraphs.length

    return {
      paragraphs,
      overallConfidence: Math.round(overallConfidence * 100) / 100,
      modelVersion: 'deepseek-v3.0',
      generatedAt: new Date(),
    }
  }

  async rewriteParagraph(request: AiDraftRewriteRequest): Promise<{ content: string; confidence: number }> {
    const confidence = 0.78 + Math.random() * 0.12
    return {
      content: `【AI改写 - ${request.instruction}】${request.content}`,
      confidence: Math.round(confidence * 100) / 100,
    }
  }

  async continueDraft(request: AiDraftContinueRequest): Promise<AiDraftParagraph> {
    const confidence = 0.75 + Math.random() * 0.15
    return {
      id: `draft-${++idCounter}`,
      heading: '补充描述',
      content: `根据"${request.prompt}"：与既往相比，病灶无明显变化`,
      confidence: Math.round(confidence * 100) / 100,
      editable: true,
    }
  }
}
