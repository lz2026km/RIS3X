import { Injectable } from '@nestjs/common'

export interface DicomMetadata {
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

@Injectable()
export class AiDraftService {
  private readonly templates: DraftTemplate[] = [
    { id: 'tpl-chest-ct', name: '胸部CT平扫', modality: 'CT', bodyPart: '胸部', description: '胸部CT平扫报告模板', sections: ['检查技术', '影像所见', '诊断意见', '建议'] },
    { id: 'tpl-chest-mr', name: '胸部MR增强', modality: 'MR', bodyPart: '胸部', description: '胸部MR增强报告模板', sections: ['检查技术', '影像所见', '诊断意见', '建议'] },
    { id: 'tpl-head-ct', name: '头颅CT平扫', modality: 'CT', bodyPart: '头颅', description: '头颅CT平扫报告模板', sections: ['检查技术', '影像所见', '诊断意见', '建议'] },
    { id: 'tpl-head-mr', name: '头颅MR平扫+增强', modality: 'MR', bodyPart: '头颅', description: '头颅MR平扫+增强报告模板', sections: ['检查技术', '影像所见', '诊断意见', '建议'] },
    { id: 'tpl-liver-ct', name: '上腹部CT增强', modality: 'CT', bodyPart: '肝脏', description: '上腹部CT增强报告模板', sections: ['检查技术', '影像所见', '诊断意见', '建议'] },
    { id: 'tpl-spine-mr', name: '腰椎MR平扫', modality: 'MR', bodyPart: '腰椎', description: '腰椎MR平扫报告模板', sections: ['检查技术', '影像所见', '诊断意见', '建议'] },
  ]

  async draft(meta: DicomMetadata): Promise<AiDraftResult> {
    const paragraphs: AiDraftParagraph[] = [
      { id: 'p1', heading: '检查技术', content: `${meta.modality} ${meta.bodyPart ?? ''}平扫${meta.modality === 'MR' ? '+增强扫描' : ''}`, confidence: 0.95, editable: true },
      { id: 'p2', heading: '影像所见', content: meta.findings || `${meta.bodyPart ?? '检查部位'} 未见明确异常密度影及占位性病变`, confidence: 0.92, editable: true },
      { id: 'p3', heading: '诊断意见', content: meta.impression || '未见明确异常，建议定期随访', confidence: 0.88, editable: true },
      { id: 'p4', heading: '建议', content: '定期随访，必要时进一步检查', confidence: 0.85, editable: true },
    ]
    return { paragraphs, overallConfidence: 0.90, modelVersion: 'deepseek-v3.0', tokensUsed: 256 }
  }

  async continueDraft(meta: DicomMetadata, existingContent: string): Promise<AiDraftResult> {
    const paragraphs: AiDraftParagraph[] = [
      { id: 'p5', heading: '补充描述', content: '与既往（' + (meta.clinicalHistory || '未见') + '）相比，病灶无明显变化', confidence: 0.80, editable: true },
      { id: 'p6', heading: '鉴别诊断', content: '需与以下疾病鉴别：1. 炎性病变 2. 良性肿瘤', confidence: 0.75, editable: true },
    ]
    return { paragraphs, overallConfidence: 0.78, modelVersion: 'deepseek-v3.0', tokensUsed: 128 }
  }

  async rewriteDraft(meta: DicomMetadata, targetParagraph: string, instruction: string): Promise<AiDraftResult> {
    const paragraphs: AiDraftParagraph[] = [
      { id: 'p-rw', heading: targetParagraph, content: `【根据指令重写】${instruction}：${meta.bodyPart ?? '检查部位'} 未见明显异常`, confidence: 0.82, editable: true },
    ]
    return { paragraphs, overallConfidence: 0.82, modelVersion: 'deepseek-v3.0', tokensUsed: 64 }
  }

  async getTemplates(modality?: string): Promise<{ templates: DraftTemplate[] }> {
    const filtered = modality ? this.templates.filter(t => t.modality === modality) : this.templates
    return { templates: filtered }
  }
}
