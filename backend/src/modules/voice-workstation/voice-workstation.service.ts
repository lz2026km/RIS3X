// [Wave 6A v3.0.6.11-99] 语音工作站服务: 医学词库(内存+seed) / 听写流词库校正 / 纠正反馈积累 / 会话派生
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { AsrService } from '../asr/asr.service'

export type LexiconCategory = '解剖' | '影像' | '疾病' | '药物' | '单位' | '操作'
export const LEXICON_CATEGORIES: LexiconCategory[] = ['解剖', '影像', '疾病', '药物', '单位', '操作']

export interface LexiconEntry {
  id: string
  term: string
  category: LexiconCategory
  priority: number
  aliases: string[]
  createdAt: string
  updatedAt: string
}

export interface CreateLexiconDto {
  term: string
  category: LexiconCategory
  priority?: number
  aliases?: string[]
}

export interface UpdateLexiconDto extends Partial<CreateLexiconDto> {}

export interface CorrectionItem {
  original: string
  corrected: string
  term: string
  category: LexiconCategory
}

export interface TranscribeWorkstationRequest {
  audioBase64?: string
  text?: string
  reportId?: string
  duration?: number
  doctorId?: string
  lang?: string
  mimeType?: string
}

export interface TranscribeWorkstationResponse {
  id: string
  text: string
  correctedText: string
  corrections: CorrectionItem[]
  segments: { start: number; end: number; text: string; confidence: number }[]
  confidence: number
  engine: string
  duration: number
}

export interface SessionRecord {
  id: string
  reportId: string
  doctorId: string
  duration: number
  status: 'completed' | 'processing' | 'error'
  correctionCount: number
  createdAt: string
}

export interface CorrectionFeedback {
  id: string
  original: string
  corrected: string
  source: 'feedback' | 'auto'
  createdAt: string
}

export interface WorkstationStats {
  sessions: { total: number; today: number; avgDurationSec: number }
  lexiconSize: number
  corrections: { total: number }
  categoryCounts: { category: LexiconCategory; count: number }[]
}

export interface CorrectionFeedbackDto {
  original: string
  corrected: string
}

// 确定性演示转写 (含同音词错误, 用于词库校正链路验证)
const DEMO_TRANSCRIPT =
  '右肺上叶尖后段见一不规则形软组织密度结皆，边缘呈分叶状，可见毛刺症及胸膜牵啦征象，余双肺纹理清晰，肋膈角锐利。'

type SeedRow = [term: string, category: LexiconCategory, priority: number, aliases: string[]]

// 医学词库 seed (100+ 条): 解剖 / 影像 / 疾病 / 药物 / 单位 / 操作
const SEED_LEXICON: SeedRow[] = [
  // 解剖 (50)
  ['左肺上叶', '解剖', 3, ['左上肺叶', '左肺上页']],
  ['左肺下叶', '解剖', 3, ['左下肺叶', '左肺下页']],
  ['右肺上叶', '解剖', 3, ['右上肺叶', '右肺上页']],
  ['右肺中叶', '解剖', 3, ['右中肺叶']],
  ['右肺下叶', '解剖', 3, ['右下肺叶', '右肺下页']],
  ['双肺纹理', '解剖', 2, ['双侧肺纹理']],
  ['肺野', '解剖', 2, ['肺叶']],
  ['肺门', '解剖', 2, ['肺们']],
  ['纵隔', '解剖', 2, ['纵格']],
  ['膈面', '解剖', 2, ['隔面']],
  ['肋膈角', '解剖', 3, ['肋隔角']],
  ['心影', '解剖', 2, ['心颖']],
  ['主动脉弓', '解剖', 2, ['主动卖弓']],
  ['肺动脉', '解剖', 2, ['肺动卖']],
  ['气管隆突', '解剖', 2, ['气关隆突', '隆突']],
  ['支气管', '解剖', 2, ['支气官']],
  ['肺泡', '解剖', 1, ['肺包']],
  ['胸膜', '解剖', 2, ['胸摸']],
  ['胸壁', '解剖', 1, []],
  ['肝脏', '解剖', 2, ['干脏', '肝藏']],
  ['胆囊', '解剖', 2, ['胆曩']],
  ['胰腺', '解剖', 2, ['夷腺']],
  ['脾脏', '解剖', 2, ['皮脏']],
  ['双肾', '解剖', 2, ['双深']],
  ['肾上腺', '解剖', 2, []],
  ['门静脉', '解剖', 2, ['闷静脉']],
  ['胆总管', '解剖', 2, ['胆总官']],
  ['肝内胆管', '解剖', 2, ['干内胆管']],
  ['腹腔干', '解剖', 2, []],
  ['椎体', '解剖', 2, ['追体']],
  ['椎间盘', '解剖', 2, ['追间盘']],
  ['硬膜囊', '解剖', 2, []],
  ['侧脑室', '解剖', 2, ['侧脑事']],
  ['第三脑室', '解剖', 2, []],
  ['第四脑室', '解剖', 2, []],
  ['蛛网膜下腔', '解剖', 2, []],
  ['基底节', '解剖', 2, []],
  ['丘脑', '解剖', 2, []],
  ['脑干', '解剖', 2, []],
  ['小脑扁桃体', '解剖', 2, []],
  ['鞍区', '解剖', 2, ['按区']],
  ['蝶鞍', '解剖', 2, ['蝶安']],
  ['视交叉', '解剖', 2, []],
  ['甲状腺', '解剖', 2, ['假状腺']],
  ['食管', '解剖', 2, ['食观']],
  ['胃窦', '解剖', 1, []],
  ['结肠脾曲', '解剖', 1, []],
  ['前列腺', '解剖', 1, []],
  ['子宫附件', '解剖', 1, []],
  ['骶髂关节', '解剖', 1, []],
  // 影像 (52)
  ['磨玻璃影', '影像', 3, ['磨玻璃密度影', '毛玻璃影', '磨玻璃状影']],
  ['实变影', '影像', 3, ['实变应']],
  ['结节影', '影像', 3, ['结皆影', '节结影']],
  ['结节', '影像', 3, ['结皆']],
  ['钙化灶', '影像', 3, ['钙化照', '钙化造']],
  ['条索影', '影像', 2, ['条锁影']],
  ['斑片状影', '影像', 2, ['斑片壮影']],
  ['网格状影', '影像', 2, ['网个状影']],
  ['蜂窝状影', '影像', 2, []],
  ['胸腔积液', '影像', 3, ['胸强积液']],
  ['肺不张', '影像', 3, ['肺不胀']],
  ['肺气肿', '影像', 3, ['肺气种']],
  ['毛刺征', '影像', 3, ['毛刺症']],
  ['分叶征', '影像', 3, ['分页征']],
  ['胸膜牵拉', '影像', 3, ['胸膜牵啦', '胸膜签拉']],
  ['空泡征', '影像', 2, ['空抛征']],
  ['支气管充气征', '影像', 2, []],
  ['靶征', '影像', 2, ['把征']],
  ['环状强化', '影像', 2, ['环状强画']],
  ['不均匀强化', '影像', 2, []],
  ['渐进性强化', '影像', 2, []],
  ['低回声', '影像', 2, ['底回声']],
  ['无回声', '影像', 2, ['无回声区']],
  ['混合回声', '影像', 2, []],
  ['强回声', '影像', 2, ['强回深']],
  ['声影', '影像', 2, ['身影']],
  ['后壁增强', '影像', 2, []],
  ['高信号', '影像', 2, ['高性号']],
  ['低信号', '影像', 2, []],
  ['等信号', '影像', 2, []],
  ['弥散受限', '影像', 2, ['弥散受陷']],
  ['明显强化', '影像', 2, ['明星强化']],
  ['流空信号', '影像', 2, []],
  ['平扫', '影像', 2, []],
  ['增强扫描', '影像', 2, ['增墙扫描']],
  ['T1WI', '影像', 3, ['T1加权像', 'T1 加权像']],
  ['T2WI', '影像', 3, ['T2加权像', 'T2 加权像']],
  ['DWI', '影像', 3, ['弥散加权成像']],
  ['ADC', '影像', 2, ['ADC值']],
  ['FLAIR', '影像', 2, ['水抑制像']],
  ['MRA', '影像', 2, ['磁共振血管成像']],
  ['MRV', '影像', 2, []],
  ['CTA', '影像', 2, ['CT血管成像']],
  ['冠脉CTA', '影像', 2, []],
  ['增强CT', '影像', 2, ['增强CT检查']],
  ['低剂量CT', '影像', 2, []],
  ['骨窗', '影像', 1, []],
  ['肺窗', '影像', 1, []],
  ['软组织窗', '影像', 1, []],
  ['三维重建', '影像', 2, ['3D重建']],
  ['曲面重建', '影像', 2, ['区面重建']],
  ['最大密度投影', '影像', 2, ['MIP']],
  ['容积再现', '影像', 2, []],
  // 疾病 (36)
  ['肺结节', '疾病', 3, ['肺结皆']],
  ['肺占位', '疾病', 3, ['肺站位']],
  ['中央型肺癌', '疾病', 3, []],
  ['周围型肺癌', '疾病', 3, []],
  ['肺炎', '疾病', 2, ['肺言']],
  ['肺结核', '疾病', 2, ['肺结何']],
  ['肺栓塞', '疾病', 3, ['肺拴塞']],
  ['间质性肺病', '疾病', 2, []],
  ['气胸', '疾病', 3, ['气凶']],
  ['肝血管瘤', '疾病', 2, []],
  ['肝囊肿', '疾病', 2, []],
  ['肝硬化', '疾病', 2, []],
  ['脂肪肝', '疾病', 2, []],
  ['肝癌', '疾病', 2, []],
  ['胆囊结石', '疾病', 2, ['胆曩结石']],
  ['胆管结石', '疾病', 2, []],
  ['急性胰腺炎', '疾病', 2, ['急性夷腺炎']],
  ['慢性胰腺炎', '疾病', 2, []],
  ['肾囊肿', '疾病', 2, []],
  ['肾结石', '疾病', 2, []],
  ['输尿管结石', '疾病', 2, []],
  ['脑梗死', '疾病', 3, ['脑更死', '脑梗塞']],
  ['脑出血', '疾病', 3, ['脑初血']],
  ['脑膜瘤', '疾病', 2, []],
  ['胶质瘤', '疾病', 2, []],
  ['垂体瘤', '疾病', 2, ['垂提瘤']],
  ['动脉瘤', '疾病', 3, ['动卖瘤']],
  ['椎间盘突出', '疾病', 2, ['追间盘突出']],
  ['椎管狭窄', '疾病', 2, []],
  ['骨折', '疾病', 2, ['骨折']],
  ['骨质疏松', '疾病', 2, ['骨质书松']],
  ['骨转移', '疾病', 2, []],
  ['乳腺结节', '疾病', 2, []],
  ['甲状腺结节', '疾病', 2, ['假状腺结节']],
  ['主动脉夹层', '疾病', 3, ['主动卖夹层']],
  ['阑尾炎', '疾病', 1, []],
  // 药物 (16)
  ['造影剂', '药物', 3, ['灶影剂']],
  ['碘海醇', '药物', 2, ['碘海纯']],
  ['碘克沙醇', '药物', 2, []],
  ['钆喷酸葡胺', '药物', 2, []],
  ['钆特醇', '药物', 2, []],
  ['硫酸钡', '药物', 2, []],
  ['地塞米松', '药物', 1, []],
  ['阿托品', '药物', 1, []],
  ['利多卡因', '药物', 1, []],
  ['葡萄糖酸钙', '药物', 1, []],
  ['生理盐水', '药物', 1, ['生理盐税']],
  ['呋塞米', '药物', 1, []],
  ['泮托拉唑', '药物', 1, []],
  ['奥美拉唑', '药物', 1, []],
  ['肝素钠', '药物', 1, []],
  ['阿司匹林', '药物', 1, []],
  // 单位 (12)
  ['毫米', '单位', 2, ['豪米', 'mm']],
  ['厘米', '单位', 2, ['cm']],
  ['HU', '单位', 2, ['亨氏单位']],
  ['毫克', '单位', 2, ['豪克']],
  ['毫升', '单位', 2, ['豪升']],
  ['克', '单位', 1, []],
  ['升', '单位', 1, []],
  ['秒', '单位', 1, []],
  ['分钟', '单位', 1, ['分中']],
  ['小时', '单位', 1, []],
  ['千帕', '单位', 1, []],
  ['毫米汞柱', '单位', 1, []],
  // 操作 (10)
  ['动态增强', '操作', 2, []],
  ['延迟扫描', '操作', 2, ['沿迟扫描']],
  ['冠状位重建', '操作', 2, ['关状位重建']],
  ['矢状位重建', '操作', 2, []],
  ['定位像', '操作', 2, []],
  ['层厚', '操作', 1, []],
  ['层间距', '操作', 1, []],
  ['视野', '操作', 1, []],
  ['穿刺活检', '操作', 2, ['穿刺活捡']],
  ['引流', '操作', 1, []],
]

// 会话派生 seed (从 asr 记录派生示意)
const SEED_SESSIONS: Array<Omit<SessionRecord, 'id' | 'createdAt'> & { createdAt: number }> = [
  { reportId: 'rpt-038', doctorId: 'D1001', duration: 42, status: 'completed', correctionCount: 2, createdAt: 0 },
  { reportId: 'rpt-127', doctorId: 'D1001', duration: 18, status: 'completed', correctionCount: 0, createdAt: 1 },
  { reportId: 'rpt-221', doctorId: 'D1002', duration: 67, status: 'completed', correctionCount: 3, createdAt: 2 },
  { reportId: 'rpt-305', doctorId: 'D1003', duration: 25, status: 'error', correctionCount: 0, createdAt: 3 },
  { reportId: 'rpt-098', doctorId: 'D1001', duration: 51, status: 'completed', correctionCount: 1, createdAt: 4 },
  { reportId: 'rpt-176', doctorId: 'D1002', duration: 33, status: 'completed', correctionCount: 0, createdAt: 5 },
]

@Injectable()
export class VoiceWorkstationService {
  private lexicon: LexiconEntry[] = []
  private sessions: SessionRecord[] = []
  private feedback: CorrectionFeedback[] = []

  constructor(private readonly asr?: AsrService) {
    this.lexicon = SEED_LEXICON.map(([term, category, priority, aliases]) => ({
      id: uuid(),
      term,
      category,
      priority,
      aliases: [...aliases],
      createdAt: new Date(Date.now() - Math.floor(Math.random() * 86_400_000)).toISOString(),
      updatedAt: new Date().toISOString(),
    }))
    const now = Date.now()
    this.sessions = SEED_SESSIONS.map((row) => ({
      ...row,
      id: uuid(),
      createdAt: new Date(now - row.createdAt * 3_600_000 - 15 * 60_000).toISOString(),
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  // ── 词库 ──────────────────────────────────────────────────────────────────

  listLexicon(): LexiconEntry[] {
    return [...this.lexicon].sort(
      (a, b) => b.priority - a.priority || a.term.localeCompare(b.term, 'zh-CN'),
    )
  }

  searchLexicon(q: string): LexiconEntry[] {
    const keyword = (q ?? '').trim().toLowerCase()
    if (!keyword) return this.listLexicon()
    return this.listLexicon().filter(
      (e) =>
        e.term.toLowerCase().includes(keyword) ||
        e.aliases.some((a) => a.toLowerCase().includes(keyword)) ||
        e.category.includes(keyword),
    )
  }

  createLexicon(dto: CreateLexiconDto): LexiconEntry {
    const term = (dto.term ?? '').trim()
    const category = this.normalizeCategory(dto.category)
    if (!term) throw new BadRequestException('术语不能为空')
    if (term.length > 64) throw new BadRequestException('术语长度不能超过 64')
    if (this.lexicon.some((e) => e.term === term)) throw new BadRequestException(`词条已存在: ${term}`)
    const entry: LexiconEntry = {
      id: uuid(),
      term,
      category,
      priority: dto.priority ?? 1,
      aliases: (dto.aliases ?? []).map((a) => a.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.lexicon.unshift(entry)
    return entry
  }

  updateLexicon(id: string, dto: UpdateLexiconDto): LexiconEntry {
    const entry = this.lexicon.find((e) => e.id === id)
    if (!entry) throw new NotFoundException(`词条不存在: ${id}`)
    if (dto.term !== undefined) {
      const term = dto.term.trim()
      if (!term) throw new BadRequestException('术语不能为空')
      if (term.length > 64) throw new BadRequestException('术语长度不能超过 64')
      if (this.lexicon.some((e) => e.id !== id && e.term === term)) {
        throw new BadRequestException(`词条已存在: ${term}`)
      }
      entry.term = term
    }
    if (dto.category !== undefined) entry.category = this.normalizeCategory(dto.category)
    if (dto.priority !== undefined) {
      if (!Number.isInteger(dto.priority) || dto.priority < 0 || dto.priority > 10) {
        throw new BadRequestException('priority 需为 0-10 整数')
      }
      entry.priority = dto.priority
    }
    if (dto.aliases !== undefined) {
      entry.aliases = dto.aliases.map((a) => a.trim()).filter(Boolean)
    }
    entry.updatedAt = new Date().toISOString()
    return { ...entry }
  }

  deleteLexicon(id: string): { success: boolean; deletedId: string } {
    const index = this.lexicon.findIndex((e) => e.id === id)
    if (index === -1) throw new NotFoundException(`词条不存在: ${id}`)
    const [removed] = this.lexicon.splice(index, 1)
    return { success: true, deletedId: removed?.id ?? id }
  }

  // ── 听写流 (转写 + 词库校正) ─────────────────────────────────────────────

  async transcribe(req: TranscribeWorkstationRequest): Promise<TranscribeWorkstationResponse> {
    let rawText = (req.text ?? '').trim()
    let duration = req.duration
    let engine = 'lexicon'
    let confidence = 0.9

    if (!rawText) {
      if (req.audioBase64) {
        const audio = Buffer.from(req.audioBase64, 'base64')
        const asr = this.asr
        if (!asr) throw new BadRequestException('音频转写需 ASR 服务支持')
        const res = await asr.transcribe({
          audioBuffer: audio,
          duration: duration ?? undefined,
          lang: req.lang,
          mimeType: req.mimeType,
        })
        rawText = res.text
        duration = res.duration
        engine = res.engine
        confidence = res.confidence
      } else {
        rawText = DEMO_TRANSCRIPT
        duration = duration ?? 30
        engine = 'mock'
      }
    }
    if (!rawText) throw new BadRequestException('转写内容为空')
    if (duration === undefined || !Number.isFinite(duration)) duration = 30

    const { correctedText, corrections } = this.applyLexiconCorrections(rawText)

    const id = uuid()
    this.sessions.unshift({
      id,
      reportId: (req.reportId ?? '').trim() || '未关联报告',
      doctorId: (req.doctorId ?? '').trim() || 'D1001',
      duration: Math.round(duration),
      status: 'completed',
      correctionCount: corrections.length,
      createdAt: new Date().toISOString(),
    })
    if (this.sessions.length > 200) this.sessions.pop()

    return {
      id,
      text: rawText,
      correctedText,
      corrections,
      confidence: +(confidence - corrections.length * 0.01).toFixed(2),
      engine,
      duration: Math.round(duration),
      segments: this.splitSegments(correctedText, duration),
    }
  }

  // ── 纠正反馈 (积累词库) ───────────────────────────────────────────────────

  submitCorrection(dto: CorrectionFeedbackDto): CorrectionFeedback {
    const original = (dto.original ?? '').trim()
    const corrected = (dto.corrected ?? '').trim()
    if (!original || !corrected) throw new BadRequestException('original/corrected 不能为空')
    if (original === corrected) throw new BadRequestException('纠正前后文本相同')

    const record: CorrectionFeedback = {
      id: uuid(),
      original,
      corrected,
      source: 'feedback',
      createdAt: new Date().toISOString(),
    }
    this.feedback.unshift(record)
    if (this.feedback.length > 500) this.feedback.pop()

    // 积累词库: 命中已有词条 → 追加 alias; 否则以 corrected 新建词条 (priority 1)
    const matched = this.lexicon.find((e) => e.term === corrected)
    if (matched) {
      if (!matched.aliases.includes(original) && matched.term !== original) {
        matched.aliases.push(original)
        matched.updatedAt = new Date().toISOString()
      }
    } else if (!this.lexicon.some((e) => e.term === corrected)) {
      this.lexicon.unshift({
        id: uuid(),
        term: corrected,
        category: '影像',
        priority: 1,
        aliases: [original],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    return record
  }

  listCorrections(): CorrectionFeedback[] {
    return [...this.feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }

  // ── 会话 / 统计 ───────────────────────────────────────────────────────────

  listSessions(): SessionRecord[] {
    return [...this.sessions]
  }

  getStats(): WorkstationStats {
    const completed = this.sessions.filter((s) => s.status === 'completed')
    const avg = completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + s.duration, 0) / completed.length)
      : 0
    const today = this.sessions.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString()).length
    const categoryCounts = LEXICON_CATEGORIES.map((category) => ({
      category,
      count: this.lexicon.filter((e) => e.category === category).length,
    }))
    return {
      sessions: { total: this.sessions.length, today, avgDurationSec: avg },
      lexiconSize: this.lexicon.length,
      corrections: { total: this.feedback.length },
      categoryCounts,
    }
  }

  // ── 内部工具 ──────────────────────────────────────────────────────────────

  private applyLexiconCorrections(text: string): {
    correctedText: string
    corrections: CorrectionItem[]
  } {
    let correctedText = text
    const corrections: CorrectionItem[] = []
    const ordered = [...this.lexicon].sort((a, b) => b.priority - a.priority)
    for (const entry of ordered) {
      for (const alias of entry.aliases) {
        if (!alias) continue
        if (correctedText.includes(alias) && alias !== entry.term) {
          correctedText = correctedText.split(alias).join(entry.term)
          corrections.push({
            original: alias,
            corrected: entry.term,
            term: entry.term,
            category: entry.category,
          })
        }
      }
    }
    return { correctedText, corrections }
  }

  private splitSegments(text: string, duration: number): { start: number; end: number; text: string; confidence: number }[] {
    const sentences = text.split(/(?<=[。；;])/).map((s) => s.trim()).filter(Boolean)
    if (sentences.length === 0) return [{ start: 0, end: duration, text, confidence: 0.9 }]
    const step = duration / sentences.length
    return sentences.map((sentence, i) => ({
      start: Math.round(i * step * 10) / 10,
      end: Math.round((i + 1) * step * 10) / 10,
      text: sentence,
      confidence: +(0.9 - (i % 3) * 0.02).toFixed(2),
    }))
  }

  private normalizeCategory(category: string): LexiconCategory {
    const value = (category ?? '').trim() as LexiconCategory
    if (!LEXICON_CATEGORIES.includes(value)) {
      throw new BadRequestException(`无效分类: ${category} (可选: ${LEXICON_CATEGORIES.join('/')})`)
    }
    return value
  }
}
