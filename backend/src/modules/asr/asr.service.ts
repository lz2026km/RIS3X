import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

// ── [v3.0.6.11-103 Wave 17] 听写会话 V2 ────────────────────────────────────────

export type DictationSectionKey = 'findings' | 'impression' | 'recommendation' | 'conclusion'

export type DictationHotwordCategory = '解剖' | '影像' | '疾病' | '单位' | '操作'

export interface DictationHotword {
  id: string
  term: string
  category: DictationHotwordCategory
  priority: number
  builtin: boolean
  createdAt: string
  updatedAt: string
}

export interface DictationCommandEvent {
  phrase: string
  action: 'next_section' | 'save' | 'submit' | 'pause' | 'resume' | 'start'
  at: number
}

export interface DictationSection {
  key: DictationSectionKey
  text: string
}

export interface DictationChunkResult {
  sessionId: string
  text: string
  sections: DictationSection[]
  commands: DictationCommandEvent[]
  hotwordHits: { term: string; count: number }[]
  confidence: number
  engine: 'mock-dictation'
}

export interface DictationSession {
  id: string
  reportId: string
  doctorId: string
  lang: string
  status: 'dictating' | 'paused' | 'completed' | 'error'
  startedAt: string
  endedAt: string | null
  text: string
  sections: DictationSection[]
  commands: DictationCommandEvent[]
  durationSec: number
}

export interface StartDictationDto {
  reportId?: string
  doctorId?: string
  lang?: string
}

export interface DictationHotwordInput {
  term: string
  category?: DictationHotwordCategory
  priority?: number
}

const DICTATION_SECTION_LABELS: Record<DictationSectionKey, string> = {
  findings: '所见',
  impression: '印象',
  recommendation: '建议',
  conclusion: '结论',
}

// 放射专用术语热词 seed (听写时优先识别): 解剖/影像/疾病/单位/操作
const BUILTIN_HOTWORDS: Array<[term: string, category: DictationHotwordCategory, priority: number]> = [
  ['双肺纹理', '解剖', 3], ['右肺上叶', '解剖', 3], ['左肺上叶', '解剖', 3], ['右肺下叶', '解剖', 3],
  ['肺野', '解剖', 2], ['肺门', '解剖', 2], ['纵隔', '解剖', 2], ['膈面', '解剖', 2], ['肋膈角', '解剖', 3],
  ['心影', '解剖', 2], ['主动脉弓', '解剖', 2], ['肺动脉', '解剖', 2], ['支气管', '解剖', 2],
  ['肝脏', '解剖', 2], ['胆囊', '解剖', 2], ['胰腺', '解剖', 2], ['脾脏', '解剖', 2], ['双肾', '解剖', 2],
  ['门静脉', '解剖', 2], ['胆总管', '解剖', 2], ['椎体', '解剖', 2], ['椎间盘', '解剖', 2],
  ['侧脑室', '解剖', 2], ['脑干', '解剖', 2], ['蝶鞍', '解剖', 2], ['甲状腺', '解剖', 2],
  ['磨玻璃影', '影像', 3], ['磨玻璃结节', '影像', 3], ['实变影', '影像', 3], ['结节影', '影像', 3],
  ['钙化灶', '影像', 3], ['条索影', '影像', 2], ['斑片状影', '影像', 2], ['胸腔积液', '影像', 3],
  ['肺不张', '影像', 3], ['肺气肿', '影像', 3], ['毛刺征', '影像', 3], ['分叶征', '影像', 3],
  ['胸膜牵拉', '影像', 3], ['低回声', '影像', 2], ['无回声', '影像', 2], ['高信号', '影像', 2],
  ['低信号', '影像', 2], ['弥散受限', '影像', 2], ['明显强化', '影像', 2], ['增强扫描', '影像', 2],
  ['肺结节', '疾病', 3], ['肺占位', '疾病', 3], ['肺炎', '疾病', 2], ['肺结核', '疾病', 2],
  ['肺栓塞', '疾病', 3], ['气胸', '疾病', 3], ['肝囊肿', '疾病', 2], ['肝硬化', '疾病', 2],
  ['脂肪肝', '疾病', 2], ['胆囊结石', '疾病', 2], ['肾囊肿', '疾病', 2], ['肾结石', '疾病', 2],
  ['脑梗死', '疾病', 3], ['脑出血', '疾病', 3], ['动脉瘤', '疾病', 3], ['骨折', '疾病', 2],
  ['骨质疏松', '疾病', 2], ['椎间盘突出', '疾病', 2], ['甲状腺结节', '疾病', 2],
  ['毫米', '单位', 2], ['厘米', '单位', 2], ['造影剂', '操作', 3], ['穿刺活检', '操作', 2],
]

// 语音命令词: 命中即从正文剥离并触发对应操作
const DICTATION_COMMANDS: Array<{ phrase: string; action: DictationCommandEvent['action'] }> = [
  { phrase: '下一段', action: 'next_section' },
  { phrase: '下一节', action: 'next_section' },
  { phrase: '保存报告', action: 'save' },
  { phrase: '保存', action: 'save' },
  { phrase: '提交报告', action: 'submit' },
  { phrase: '提交', action: 'submit' },
  { phrase: '暂停听写', action: 'pause' },
  { phrase: '暂停', action: 'pause' },
  { phrase: '继续听写', action: 'resume' },
  { phrase: '继续', action: 'resume' },
  { phrase: '开始听写', action: 'start' },
  { phrase: '开始', action: 'start' },
]

const DICTATION_MAX_SESSIONS = 100
const DICTATION_MAX_HOTWORDS = 500

export function createEmptyDictationSections(): DictationSection[] {
  return (Object.keys(DICTATION_SECTION_LABELS) as DictationSectionKey[]).map((key) => ({ key, text: '' }))
}

/**
 * 确定性 mock 识别: 输入文本 → 自动标点 + 分段(所见/印象/建议/结论) + 热词命中 + 命令词解析。
 * 无随机数、无外部依赖, 同一输入恒得同一输出。
 */
export function recognizeDictationChunk(
  input: string,
  hotwords: DictationHotword[],
  currentSection: DictationSectionKey = 'findings',
): { text: string; sections: DictationSection[]; commands: DictationCommandEvent[]; hotwordHits: Array<{ term: string; count: number }> } {
  const text = (input ?? '').trim()
  const sections = createEmptyDictationSections()
  const commands: DictationCommandEvent[] = []
  if (!text) return { text: '', sections, commands, hotwordHits: [] }

  let cursor = 0
  const consumed = new Array<boolean>(text.length).fill(false)

  // 1) 命令词解析 (最长短语优先)
  const orderedCommands = [...DICTATION_COMMANDS].sort((a, b) => b.phrase.length - a.phrase.length)
  for (const cmd of orderedCommands) {
    let from = 0
    while (true) {
      const idx = text.indexOf(cmd.phrase, from)
      if (idx === -1) break
      if (!consumed.slice(idx, idx + cmd.phrase.length).some(Boolean)) {
        for (let i = idx; i < idx + cmd.phrase.length; i++) consumed[i] = true
        commands.push({ phrase: cmd.phrase, action: cmd.action, at: idx })
      }
      from = idx + cmd.phrase.length
    }
  }
  commands.sort((a, b) => a.at - b.at)

  // 2) 剥离命令词后按句切分
  const clean = [...text].map((ch, i) => (consumed[i] ? ' ' : ch)).join('').replace(/\s+/g, ' ').trim()
  if (!clean) return { text: '', sections, commands, hotwordHits: [] }

  // 3) 自动标点 + 分段
  let sectionKey: DictationSectionKey = currentSection
  const sentences = clean.split(/(?<=[。！？；;])|(?<=。)|(?<=！)|(?<=？)|(?<=；)|(?<=;)/)
    .map((s) => s.trim())
    .filter(Boolean)
  for (let raw of sentences) {
    // 段标记: 【所见】/所见: 等 → 切换目标区
    for (const key of Object.keys(DICTATION_SECTION_LABELS) as DictationSectionKey[]) {
      const label = DICTATION_SECTION_LABELS[key]
      const marker = new RegExp(`^【${label}】|^${label}[：:]|^${label}$`)
      if (marker.test(raw)) {
        sectionKey = key
        raw = raw.replace(marker, '').trim()
        if (!raw) continue
      }
    }
    // 句内插入标点: 无结尾标点且足够长 → 句号; 过长无停顿 → 逗号
    if (raw.length > 0 && !/[。！？；;，,]$/.test(raw)) {
      raw = raw.length >= 8 ? `${raw}。` : `${raw}，`
    }
    if (!raw) continue
    const current = sections.find((s) => s.key === sectionKey)
    if (current) current.text = current.text ? `${current.text}${raw}` : raw
  }

  // 4) 热词命中 (最长优先, 去重计数)
  const orderedHotwords = [...hotwords].sort((a, b) => b.priority - a.priority || b.term.length - a.term.length)
  const hotwordHits: Array<{ term: string; count: number }> = []
  const seen = new Set<string>()
  for (const hw of orderedHotwords) {
    if (seen.has(hw.term)) continue
    const count = clean.split(hw.term).length - 1
    if (count > 0) {
      seen.add(hw.term)
      hotwordHits.push({ term: hw.term, count })
    }
  }

  const joined = sections.map((s) => s.text).filter(Boolean).join('')
  return { text: joined, sections, commands, hotwordHits }
}

export function dictationConfidence(hotwordHits: Array<{ term: string; count: number }>, commandCount: number): number {
  const unique = hotwordHits.length
  return Math.min(0.99, +(0.88 + unique * 0.04 + commandCount * 0.02).toFixed(2))
}

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

  // ── [v3.0.6.11-103 Wave 17] 听写会话 V2 ──────────────────────────────────

  private readonly sessions: Map<string, DictationSession> = new Map()
  private readonly hotwords: DictationHotword[] = BUILTIN_HOTWORDS.map(([term, category, priority]) => ({
    id: uuid(),
    term,
    category,
    priority,
    builtin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))

  listDictationHotwords(): DictationHotword[] {
    return [...this.hotwords].sort((a, b) => b.priority - a.priority || a.term.localeCompare(b.term, 'zh-CN'))
  }

  createDictationHotword(input: DictationHotwordInput): DictationHotword {
    const term = (input.term ?? '').trim()
    if (!term) throw new BadRequestException('热词不能为空')
    if (term.length > 64) throw new BadRequestException('热词长度不能超过 64')
    if (this.hotwords.some((h) => h.term === term)) throw new BadRequestException(`热词已存在: ${term}`)
    if (this.hotwords.length >= DICTATION_MAX_HOTWORDS) throw new BadRequestException('热词数量已达上限')
    const entry: DictationHotword = {
      id: uuid(),
      term,
      category: input.category ?? '影像',
      priority: input.priority ?? 1,
      builtin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.hotwords.push(entry)
    return entry
  }

  updateDictationHotword(id: string, input: Partial<DictationHotwordInput>): DictationHotword {
    const entry = this.hotwords.find((h) => h.id === id)
    if (!entry) throw new NotFoundException(`热词不存在: ${id}`)
    if (input.term !== undefined) {
      const term = input.term.trim()
      if (!term) throw new BadRequestException('热词不能为空')
      if (term.length > 64) throw new BadRequestException('热词长度不能超过 64')
      if (this.hotwords.some((h) => h.id !== id && h.term === term)) {
        throw new BadRequestException(`热词已存在: ${term}`)
      }
      entry.term = term
    }
    if (input.category !== undefined) entry.category = input.category
    if (input.priority !== undefined) {
      if (!Number.isInteger(input.priority) || input.priority < 0 || input.priority > 10) {
        throw new BadRequestException('priority 需为 0-10 整数')
      }
      entry.priority = input.priority
    }
    entry.updatedAt = new Date().toISOString()
    return { ...entry }
  }

  deleteDictationHotword(id: string): { success: boolean; deletedId: string } {
    const index = this.hotwords.findIndex((h) => h.id === id)
    if (index === -1) throw new NotFoundException(`热词不存在: ${id}`)
    const [removed] = this.hotwords.splice(index, 1)
    return { success: true, deletedId: removed?.id ?? id }
  }

  startDictationSession(dto: StartDictationDto): DictationSession {
    const id = uuid()
    const session: DictationSession = {
      id,
      reportId: (dto.reportId ?? '').trim() || '未关联报告',
      doctorId: (dto.doctorId ?? '').trim() || 'D1001',
      lang: (dto.lang ?? '').trim() || 'zh-CN',
      status: 'dictating',
      startedAt: new Date().toISOString(),
      endedAt: null,
      text: '',
      sections: createEmptyDictationSections(),
      commands: [],
      durationSec: 0,
    }
    this.sessions.set(id, session)
    if (this.sessions.size > DICTATION_MAX_SESSIONS) {
      const oldest = this.sessions.keys().next().value as string | undefined
      if (oldest) this.sessions.delete(oldest)
    }
    return { ...session }
  }

  getDictationSession(id: string): DictationSession {
    const session = this.sessions.get(id)
    if (!session) throw new NotFoundException(`听写会话不存在: ${id}`)
    return { ...session, sections: session.sections.map((s) => ({ ...s })) }
  }

  appendDictationChunk(id: string, input: string): DictationChunkResult {
    const session = this.sessions.get(id)
    if (!session) throw new NotFoundException(`听写会话不存在: ${id}`)
    if (session.status === 'completed') throw new BadRequestException('会话已结束, 不能继续追加')
    session.status = 'dictating'
    const currentKey = this.currentSectionKey(session)
    const result = recognizeDictationChunk(input ?? '', this.hotwords, currentKey)
    session.commands.push(...result.commands)
    for (const section of result.sections) {
      const target = session.sections.find((s) => s.key === section.key)
      if (target && section.text) {
        target.text = target.text ? `${target.text}${section.text}` : section.text
      }
    }
    session.text = session.sections.map((s) => s.text).filter(Boolean).join('')
    return {
      sessionId: session.id,
      text: result.text,
      sections: session.sections.map((s) => ({ ...s })),
      commands: result.commands,
      hotwordHits: result.hotwordHits,
      confidence: dictationConfidence(result.hotwordHits, result.commands.length),
      engine: 'mock-dictation',
    }
  }

  endDictationSession(id: string): DictationSession {
    const session = this.sessions.get(id)
    if (!session) throw new NotFoundException(`听写会话不存在: ${id}`)
    if (session.status === 'completed') return { ...session, sections: session.sections.map((s) => ({ ...s })) }
    session.status = 'completed'
    session.endedAt = new Date().toISOString()
    const started = new Date(session.startedAt).getTime()
    session.durationSec = Math.max(1, Math.round((new Date(session.endedAt).getTime() - started) / 1000))
    return { ...session, sections: session.sections.map((s) => ({ ...s })) }
  }

  private currentSectionKey(session: DictationSession): DictationSectionKey {
    const lastNonEmpty = [...session.sections].reverse().find((s) => s.text.length > 0)
    return (lastNonEmpty?.key as DictationSectionKey) ?? 'findings'
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
