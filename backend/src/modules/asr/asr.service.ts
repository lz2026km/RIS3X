import { Injectable } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface TranscribeRequest {
  audioBase64?: string
  duration?: number
}

export interface TranscribeResponse {
  id: string
  text: string
  confidence: number
  segments: { start: number; end: number; text: string; confidence: number }[]
  engine: string
  duration: number
}

export interface FeedbackRequest {
  transcriptionId: string
  correctedText: string
  originalText: string
}

const MOCK_RESPONSES = [
  '双肺纹理清晰，肺野透亮度正常，未见明确实变影及结节影。心影大小正常，纵隔无增宽，膈面光滑，肋膈角锐利。',
  '肝脏形态大小正常，包膜光滑，实质回声均匀，血管纹理清晰，门静脉主干内径约1.0cm。胆囊大小正常，壁薄光滑，腔内透亮。',
  '双侧侧脑室对称，中线结构居中。各叶脑沟回显示清晰，脑实质内未见异常信号灶。蝶鞍形态正常，垂体显示清晰。',
  '左肺上叶尖后段见一约2.3cm×1.8cm结节影，边缘呈分叶状，可见毛刺征及胸膜牵拉征象。右肺中叶及双肺下叶散在斑片状高密度影。',
]

@Injectable()
export class AsrService {
  private feedbackStore: Map<string, FeedbackRequest> = new Map()

  async transcribe(req: TranscribeRequest): Promise<TranscribeResponse> {
    const id = uuid()
    const text = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)]
    const duration = req.duration ?? 30
    return {
      id,
      text,
      confidence: +(0.85 + Math.random() * 0.15).toFixed(2),
      segments: [
        { start: 0, end: duration, text, confidence: +(0.85 + Math.random() * 0.15).toFixed(2) },
      ],
      engine: 'aliyun',
      duration,
    }
  }

  async feedback(req: FeedbackRequest): Promise<{ success: boolean }> {
    this.feedbackStore.set(req.transcriptionId, req)
    return { success: true }
  }
}
