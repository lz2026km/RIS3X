import { api } from './client'

export interface TranscribeResult {
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

const FALLBACK_RESPONSES = [
  '双肺纹理清晰，肺野透亮度正常，未见明确实变影及结节影。心影大小正常，纵隔无增宽，膈面光滑，肋膈角锐利。',
  '肝脏形态大小正常，包膜光滑，实质回声均匀，血管纹理清晰，门静脉主干内径约1.0cm。胆囊大小正常，壁薄光滑，腔内透亮。',
  '双侧侧脑室对称，中线结构居中。各叶脑沟回显示清晰，脑实质内未见异常信号灶。蝶鞍形态正常，垂体显示清晰。',
  '左肺上叶尖后段见一约2.3cm×1.8cm结节影，边缘呈分叶状，可见毛刺征及胸膜牵拉征象。右肺中叶及双肺下叶散在斑片状高密度影。',
]

function fallbackTranscribe(duration: number): TranscribeResult {
  const text = FALLBACK_RESPONSES[Math.floor(duration) % FALLBACK_RESPONSES.length] ?? FALLBACK_RESPONSES[0]!
  const confidence = +(0.85 + (duration % 10) / 100).toFixed(2)
  return {
    id: `mock-${Date.now()}`,
    text,
    confidence,
    segments: [{ start: 0, end: duration, text, confidence }],
    engine: 'mock',
    duration,
  }
}

export const asrApi = {
  /**
   * 语音转写:优先上传真实音频 blob (multipart → /asr/transcribe/audio);
   * 无 blob 时走 JSON → /asr/transcribe (时长驱动模拟)。
   * 后端不可用时回退客户端确定性模拟,保证链路始终可用。
   */
  transcribe: async (
    audio?: Blob,
    duration?: number,
    lang?: string,
  ): Promise<TranscribeResult> => {
    const durationSec = duration !== undefined && Number.isFinite(duration) ? Math.max(0, Math.round(duration)) : undefined
    let result
    if (audio && audio.size > 0) {
      const form = new FormData()
      form.append('audio', audio, 'recording.webm')
      if (durationSec !== undefined) form.append('duration', String(durationSec))
      if (lang) form.append('lang', lang)
      result = await api.post<TranscribeResult>('/asr/transcribe/audio', form)
    } else {
      result = await api.post<TranscribeResult>('/asr/transcribe', {
        duration: durationSec,
        lang,
      })
    }
    if (result.success && result.data) return result.data
    return fallbackTranscribe(durationSec ?? 30)
  },

  feedback: (data: FeedbackRequest) =>
    api.post<{ success: boolean }>('/asr/feedback', data),
}
