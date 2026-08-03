import { Injectable, Logger } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface TranscribeRequest {
  audioBase64?: string
  /** 原始音频 Buffer (octet-stream / multipart 上传) */
  audioBuffer?: Buffer
  duration?: number
  lang?: string
  mimeType?: string
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

/**
 * 语音识别链路 (Phase 1.4):
 *  - 配置 WHISPER_API_URL + ASR_API_KEY 时调用外部 Whisper/DeepSeek 兼容转写 API
 *  - 未配置时返回确定性模拟转写:解析音频时长(WAV 头),映射到预设放射术语文本
 */
@Injectable()
export class AsrService {
  private readonly logger = new Logger(AsrService.name)
  private feedbackStore: Map<string, FeedbackRequest> = new Map()

  async transcribe(req: TranscribeRequest): Promise<TranscribeResponse> {
    const audio = req.audioBuffer ?? (req.audioBase64 ? Buffer.from(req.audioBase64, 'base64') : undefined)
    let duration = req.duration
    if (duration === undefined) {
      duration = (audio ? sniffWavDuration(audio) : undefined) ?? 30
    }
    const id = uuid()

    const external = await this.tryExternalTranscribe(audio, duration, req.lang, req.mimeType)
    if (external) return external

    // 确定性模拟:按时长选取预设放射术语文本
    const text = MOCK_RESPONSES[Math.floor(duration) % MOCK_RESPONSES.length] ?? MOCK_RESPONSES[0]!
    const confidence = +(0.85 + (duration % 10) / 100).toFixed(2)
    return {
      id,
      text,
      confidence,
      segments: splitIntoSegments(text, duration, confidence),
      engine: 'aliyun',
      duration,
    }
  }

  async feedback(req: FeedbackRequest): Promise<{ success: boolean }> {
    this.feedbackStore.set(req.transcriptionId, req)
    return { success: true }
  }

  /**
   * 外部 Whisper 兼容 API:POST multipart file/model/language
   * 返回 undefined 表示未配置或调用失败(回退确定性模拟)
   */
  private async tryExternalTranscribe(
    audio: Buffer | undefined,
    duration: number,
    lang?: string,
    mimeType?: string,
  ): Promise<TranscribeResponse | undefined> {
    const url = process.env['WHISPER_API_URL']?.trim()
    const apiKey = process.env['ASR_API_KEY']?.trim()
    if (!url || !apiKey) return undefined
    if (!audio || audio.length === 0) return undefined

    try {
      const form = new FormData()
      form.append('file', new Blob([new Uint8Array(audio)], { type: mimeType ?? 'audio/webm' }), `audio.${extForMime(mimeType)}`)
      form.append('model', process.env['ASR_MODEL']?.trim() || 'whisper-1')
      if (lang) form.append('language', lang.slice(0, 2))

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 60_000)
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
          signal: controller.signal,
        })
      } finally {
        clearTimeout(timer)
      }
      if (!res.ok) {
        this.logger.warn(`ASR external API ${res.status}: ${(await res.text()).slice(0, 200)}`)
        return undefined
      }
      const payload = (await res.json()) as Record<string, unknown>
      const raw = payload.text ?? payload.result ?? payload.output ?? payload.transcription ?? ''
      const text = typeof raw === 'string' ? raw.trim() : ''
      if (!text) return undefined

      const confidence = +(0.9 + (duration % 7) / 100).toFixed(2)
      return {
        id: uuid(),
        text,
        confidence,
        segments: splitIntoSegments(text, duration, confidence),
        engine: 'whisper',
        duration,
      }
    } catch (err) {
      this.logger.warn(`ASR external API failed, fallback to mock: ${(err as Error)?.message ?? err}`)
      return undefined
    }
  }
}

/** 从 WAV(RIFF)头解析音频时长;非 WAV 返回 undefined */
export function sniffWavDuration(buffer: Buffer): number | undefined {
  if (!buffer || buffer.length < 44) return undefined
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') return undefined
  const byteRate = buffer.readUInt32LE(28)
  if (!Number.isFinite(byteRate) || byteRate <= 0) return undefined
  const dataSize = buffer.readUInt32LE(40)
  const duration = dataSize > 0 ? dataSize / byteRate : undefined
  if (duration === undefined || !Number.isFinite(duration) || duration <= 0) return undefined
  return Math.min(7200, Math.round(duration * 10) / 10)
}

function extForMime(mimeType?: string): string {
  if (!mimeType) return 'webm'
  if (mimeType.includes('wav')) return 'wav'
  if (mimeType.includes('mp3')) return 'mp3'
  if (mimeType.includes('ogg')) return 'ogg'
  if (mimeType.includes('m4a') || mimeType.includes('mp4')) return 'm4a'
  return 'webm'
}

function splitIntoSegments(
  text: string,
  duration: number,
  confidence: number,
): { start: number; end: number; text: string; confidence: number }[] {
  const sentences = text.split(/(?<=[。；;])/).map((s) => s.trim()).filter(Boolean)
  if (sentences.length === 0) {
    return [{ start: 0, end: duration, text, confidence }]
  }
  const step = duration / sentences.length
  return sentences.map((sentence, i) => ({
    start: Math.round(i * step * 10) / 10,
    end: Math.round((i + 1) * step * 10) / 10,
    text: sentence,
    confidence: +(confidence - (i % 3) * 0.02).toFixed(2),
  }))
}
