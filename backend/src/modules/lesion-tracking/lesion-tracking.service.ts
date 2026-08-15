// [v3.0.6.11-99 Wave 4A] 病灶追踪 (Lesion Tracking) — 影像深化
// 数据源: Exam/Report 派生 (modality/bodyPart 提示) + 确定性 seed 回退 + 进程内存 CRUD
// 能力: 病灶登记 / 历次测量序列 / 跨期对比 (RECIST-like CR/PR/SD/PD 确定性判定) / 趋势 / 统计 / 随访联动
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type LesionType = '肺结节' | '肝占位' | '淋巴结' | '其他'
export type LesionStatus = '稳定' | '增大' | '缩小' | '消失' | '新发'
export type ResponseClass = 'CR' | 'PR' | 'SD' | 'PD' | 'NE'

export interface LesionMeasurement {
  id: string
  studyId: string
  date: string
  sizeMm: number
  response?: ResponseClass
  notes?: string
}

export type LesionSource = 'manual' | 'ai' | 'from-report'

export interface TrackedLesion {
  id: string
  lesionId: string
  patientId: string
  name: string
  site: string
  type: LesionType
  modality: string
  createdAt: string
  currentStatus: LesionStatus
  followupId?: string
  /** [v3.0.6.11-100 Wave 6A (D-4)] 病灶来源: manual 手动登记 / ai AI 检出 / from-report 报告提取 */
  source?: LesionSource
  /** [v3.0.6.11-100 Wave 6A (D-4)] 来源报告 ID (from-report 创建时写入, 供 GET /reports/:id/lesions 关联查询) */
  reportId?: string
  measurements: LesionMeasurement[]
}

export interface LesionCompareResult {
  lesionId: string
  studyA: string
  studyB: string
  sizeA: number
  sizeB: number
  changeMm: number
  changePercent: number
  direction: '增大' | '缩小' | '无变化' | '消失'
  response: ResponseClass
  responseLabel: string
  deterministic: boolean
}

export interface LesionTrendResult {
  lesionId: string
  baselineDate: string
  baselineSize: number
  latestDate: string
  latestSize: number
  changePercent: number
  overallResponse: ResponseClass
  overallResponseLabel: string
  timeline: Array<{ date: string; studyId: string; sizeMm: number; response?: ResponseClass }>
}

export interface LesionStats {
  patientId: string
  total: number
  new: number
  progressed: number
  stable: number
  disappeared: number
  shrunk: number
  byType: Array<{ type: string; count: number }>
}

const RESPONSE_LABEL: Record<ResponseClass, string> = {
  CR: '完全缓解 (Complete Response)',
  PR: '部分缓解 (Partial Response)',
  SD: '疾病稳定 (Stable Disease)',
  PD: '疾病进展 (Progressive Disease)',
  NE: '不可评估 (Not Evaluable)',
}

/** RECIST 1.1-like 单病灶响应判定 (确定性) */
export function recistResponse(changePercent: number): ResponseClass {
  if (changePercent <= -100) return 'CR'
  if (changePercent <= -30) return 'PR'
  if (changePercent >= 20) return 'PD'
  return 'SD'
}

/** 当前状态推导: 末次 vs 前次 (≥±20% 为变化; CR/PR/PD 显式响应优先) */
export function deriveLesionStatus(measurements: LesionMeasurement[]): LesionStatus {
  if (!measurements || measurements.length === 0) return '新发'
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]!
  if (last.response === 'CR') return '消失'
  if (last.response === 'PR') return '缩小'
  if (last.response === 'PD') return '增大'
  if (last.response === 'SD') return '稳定'
  if (sorted.length === 1) return '新发'
  const prev = sorted[sorted.length - 2]!
  if (last.sizeMm <= 0) return '消失'
  const change = (last.sizeMm - prev.sizeMm) / prev.sizeMm
  if (change >= 0.2) return '增大'
  if (change <= -0.2) return '缩小'
  return '稳定'
}

const ISO_DAY = (offsetDays: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

// ────────────────────────────────────────────────────────────────────────────
// [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪: 关键词提取规则
// 从报告 impression/findings/conclusion 文本提取可追踪病灶关键词 (肺结节/肝占位/淋巴结等)
// ────────────────────────────────────────────────────────────────────────────
export interface LesionKeywordMatch {
  /** 命中的关键词 (报告原文中出现的词) */
  keyword: string
  /** 病灶类型 (对齐 LesionType) */
  type: LesionType
  /** 病灶名称 (类型派生, 含序号) */
  name: string
  /** 部位 (从文本匹配解剖学短语, 未命中用类型默认值) */
  site: string
  /** 初始尺寸 mm (从文本 "直径 Xmm / 约 Xmm / Xmm" 提取) */
  sizeMm?: number
}

export const LESION_KEYWORD_RULES: Array<{ keyword: string; type: LesionType; name: string; defaultSite: string }> = [
  { keyword: '肺结节', type: '肺结节', name: '肺结节', defaultSite: '胸部' },
  { keyword: '磨玻璃', type: '肺结节', name: '磨玻璃影', defaultSite: '胸部' },
  { keyword: '肝占位', type: '肝占位', name: '肝占位', defaultSite: '肝脏' },
  { keyword: '肝脏占位', type: '肝占位', name: '肝占位', defaultSite: '肝脏' },
  { keyword: '肝转移', type: '肝占位', name: '肝转移灶', defaultSite: '肝脏' },
  { keyword: '肝癌', type: '肝占位', name: '肝占位', defaultSite: '肝脏' },
  { keyword: '淋巴结', type: '淋巴结', name: '淋巴结', defaultSite: '纵隔' },
  { keyword: '甲状腺结节', type: '其他', name: '甲状腺结节', defaultSite: '甲状腺' },
  { keyword: '乳腺结节', type: '其他', name: '乳腺结节', defaultSite: '乳腺' },
  { keyword: '囊肿', type: '其他', name: '囊肿', defaultSite: '—' },
  { keyword: '占位', type: '其他', name: '占位', defaultSite: '—' },
]

/** 解剖学部位短语 (按优先级匹配报告原文, 首中即用) */
const SITE_PHRASES = [
  '右肺上叶', '右肺中叶', '右肺下叶', '左肺上叶', '左肺舌叶', '左肺下叶',
  '肝右叶', '肝左叶', '肝门区', '肝尾状叶', '肝内',
  '右乳', '左乳', '甲状腺左叶', '甲状腺右叶', '甲状腺峡部',
  '纵隔', '颈部', '腋窝', '腹膜后', '盆腔', '腹股沟',
]

const SIZE_PATTERNS = [
  /直径\s*(\d+(?:\.\d+)?)\s*mm/i,
  /(?:约|大小约|大小)\s*(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*mm/i,
  /(\d+(?:\.\d+)?)\s*[×xX*]\s*(\d+(?:\.\d+)?)\s*mm/i,
  /约\s*(\d+(?:\.\d+)?)\s*mm/i,
  /(\d+(?:\.\d+)?)\s*mm/i,
]

export function extractSizeMm(text: string): number | undefined {
  for (const re of SIZE_PATTERNS) {
    const m = re.exec(text)
    if (m) {
      const v = Number(m[1])
      if (Number.isFinite(v) && v > 0) return v
    }
  }
  return undefined
}

/** 取距关键词最近的尺寸数值 (mm), 优先紧邻关键词的尺寸描述 */
function extractSizeMmNear(text: string, kwIdx: number): number | undefined {
  let best: { v: number; dist: number } | null = null
  for (const re of SIZE_PATTERNS) {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
    let m: RegExpExecArray | null
    while ((m = g.exec(text)) !== null) {
      const v = Number(m[1])
      if (Number.isFinite(v) && v > 0) {
        const dist = Math.abs(m.index - kwIdx)
        if (!best || dist < best.dist) best = { v, dist }
      }
      if (g.lastIndex === m.index) g.lastIndex += 1
    }
  }
  return best?.v
}

export function extractSite(text: string): string | undefined {
  return SITE_PHRASES.find((p) => text.includes(p))
}

/** 取距离关键词最近的部位短语 (优先关键词之前) */
function extractSiteNear(text: string, keyword: string): string | undefined {
  const kwIdx = text.indexOf(keyword)
  if (kwIdx < 0) return extractSite(text)
  let bestBefore: { phrase: string; idx: number } | null = null
  let bestAfter: { phrase: string; idx: number } | null = null
  for (const phrase of SITE_PHRASES) {
    let from = 0
    while (true) {
      const i = text.indexOf(phrase, from)
      if (i < 0) break
      if (i + phrase.length <= kwIdx) {
        if (!bestBefore || i > bestBefore.idx) bestBefore = { phrase, idx: i }
      } else if (!bestAfter || i < bestAfter.idx) {
        bestAfter = { phrase, idx: i }
      }
      from = i + phrase.length
    }
  }
  return bestBefore?.phrase ?? bestAfter?.phrase ?? extractSite(text)
}

/**
 * 从报告文本提取病灶关键词 → 去重 → 派生 (类型/部位/尺寸)
 * 部位/尺寸从关键词前后窗口文本提取 (避免跨句串扰); 同一关键词重复出现只保留一次
 */
export function extractLesionKeywords(text: string): LesionKeywordMatch[] {
  if (!text || text.trim().length === 0) return []
  const seen = new Set<string>()
  const matches: LesionKeywordMatch[] = []
  for (const rule of LESION_KEYWORD_RULES) {
    if (!text.includes(rule.keyword)) continue
    if (seen.has(rule.keyword)) continue
    seen.add(rule.keyword)
    const idx = text.indexOf(rule.keyword)
    const winStart = Math.max(0, idx - 60)
    const window = text.slice(winStart, Math.min(text.length, idx + rule.keyword.length + 120))
    const sizeMm = extractSizeMmNear(window, idx - winStart)
    const site = extractSiteNear(window, rule.keyword) ?? rule.defaultSite
    const order = matches.filter((m) => m.type === rule.type).length + 1
    matches.push({
      keyword: rule.keyword,
      type: rule.type,
      name: `${rule.name} #${order}`,
      site,
      sizeMm,
    })
  }
  return matches
}

// ────────────────────────────────────────────────────────────────────────────
// 确定性 seed (与 MSW lesionTrackingHandlers 对齐; 日期相对今天, 避免陈旧)
// ────────────────────────────────────────────────────────────────────────────
function seedLesions(): TrackedLesion[] {
  const m = (
    studyId: string, date: string, sizeMm: number, response?: ResponseClass,
  ): LesionMeasurement => ({ id: newId('m'), studyId, date, sizeMm, response })
  return [
    {
      id: 'LT001', lesionId: 'LT001', patientId: 'P000001', name: '肺结节 #1', site: '右肺上叶尖段',
      type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-270), currentStatus: '稳定',
      measurements: [
        m('STU-001-A', ISO_DAY(-270), 6.2, 'SD'),
        m('STU-001-B', ISO_DAY(-90), 6.5, 'SD'),
        m('STU-001-C', ISO_DAY(-7), 6.3, 'SD'),
      ],
    },
    {
      id: 'LT002', lesionId: 'LT002', patientId: 'P000001', name: '肝占位 #1', site: '肝右叶 S7',
      type: '肝占位', modality: 'CT', createdAt: ISO_DAY(-240), currentStatus: '缩小',
      measurements: [
        m('STU-002-A', ISO_DAY(-240), 42.0, 'SD'),
        m('STU-002-B', ISO_DAY(-120), 35.5, 'PR'),
        m('STU-002-C', ISO_DAY(-10), 26.8, 'PR'),
      ],
    },
    {
      id: 'LT003', lesionId: 'LT003', patientId: 'P000001', name: '纵隔淋巴结', site: '4R 组淋巴结',
      type: '淋巴结', modality: 'CT', createdAt: ISO_DAY(-180), currentStatus: '增大',
      measurements: [
        m('STU-003-A', ISO_DAY(-180), 12.0, 'SD'),
        m('STU-003-B', ISO_DAY(-60), 15.4, 'PD'),
        m('STU-003-C', ISO_DAY(-5), 19.8, 'PD'),
      ],
    },
    {
      id: 'LT004', lesionId: 'LT004', patientId: 'P000002', name: '肺结节 #1', site: '左肺下叶背段',
      type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-30), currentStatus: '新发',
      measurements: [m('STU-004-A', ISO_DAY(-30), 5.1)],
    },
    {
      id: 'LT005', lesionId: 'LT005', patientId: 'P000002', name: '肝转移灶 #2', site: '肝左叶 S2',
      type: '肝占位', modality: 'MR', createdAt: ISO_DAY(-365), currentStatus: '消失',
      measurements: [
        m('STU-005-A', ISO_DAY(-365), 18.0, 'SD'),
        m('STU-005-B', ISO_DAY(-180), 0, 'CR'),
      ],
    },
    {
      id: 'LT006', lesionId: 'LT006', patientId: 'P000003', name: '肺结节 #2', site: '右肺中叶外侧段',
      type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-150), currentStatus: '稳定',
      measurements: [
        m('STU-006-A', ISO_DAY(-150), 8.0, 'SD'),
        m('STU-006-B', ISO_DAY(-20), 8.2, 'SD'),
      ],
    },
    // [G005 Wave 10A] 扩充: 5 患者 12 病灶 (P000004/P000005 补充 6 病灶, 完整测量序列 3-4 期)
    {
      id: 'LT007', lesionId: 'LT007', patientId: 'P000004', name: '肝占位 #1', site: '肝右叶 S5',
      type: '肝占位', modality: 'CT', createdAt: ISO_DAY(-320), currentStatus: '缩小',
      measurements: [
        m('STU-007-A', ISO_DAY(-320), 58.0, 'SD'),
        m('STU-007-B', ISO_DAY(-180), 44.2, 'PR'),
        m('STU-007-C', ISO_DAY(-60), 30.5, 'PR'),
        m('STU-007-D', ISO_DAY(-3), 22.1, 'PR'),
      ],
    },
    {
      id: 'LT008', lesionId: 'LT008', patientId: 'P000004', name: '腹腔淋巴结', site: '肝门区淋巴结',
      type: '淋巴结', modality: 'CT', createdAt: ISO_DAY(-320), currentStatus: '稳定',
      measurements: [
        m('STU-008-A', ISO_DAY(-320), 9.8, 'SD'),
        m('STU-008-B', ISO_DAY(-180), 10.2, 'SD'),
        m('STU-008-C', ISO_DAY(-3), 9.5, 'SD'),
      ],
    },
    {
      id: 'LT009', lesionId: 'LT009', patientId: 'P000004', name: '肺结节 #1', site: '左肺上叶前段',
      type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-200), currentStatus: '增大',
      measurements: [
        m('STU-009-A', ISO_DAY(-200), 4.6, 'SD'),
        m('STU-009-B', ISO_DAY(-90), 6.1, 'PD'),
        m('STU-009-C', ISO_DAY(-3), 8.9, 'PD'),
      ],
    },
    {
      id: 'LT010', lesionId: 'LT010', patientId: 'P000005', name: '乳腺癌原发灶', site: '左乳外上象限',
      type: '其他', modality: 'MR', createdAt: ISO_DAY(-400), currentStatus: '消失',
      measurements: [
        m('STU-010-A', ISO_DAY(-400), 31.0, 'SD'),
        m('STU-010-B', ISO_DAY(-240), 18.5, 'PR'),
        m('STU-010-C', ISO_DAY(-120), 0, 'CR'),
      ],
    },
    {
      id: 'LT011', lesionId: 'LT011', patientId: 'P000005', name: '腋窝淋巴结', site: '左腋窝 I 站',
      type: '淋巴结', modality: 'MR', createdAt: ISO_DAY(-400), currentStatus: '缩小',
      measurements: [
        m('STU-011-A', ISO_DAY(-400), 14.0, 'SD'),
        m('STU-011-B', ISO_DAY(-120), 9.6, 'PR'),
        m('STU-011-C', ISO_DAY(-15), 7.8, 'PR'),
      ],
    },
    {
      id: 'LT012', lesionId: 'LT012', patientId: 'P000005', name: '肝转移灶', site: '肝右叶 S8',
      type: '肝占位', modality: 'MR', createdAt: ISO_DAY(-400), currentStatus: '新发',
      measurements: [m('STU-012-A', ISO_DAY(-400), 12.4, 'SD')],
    },
  ]
}

@Injectable()
export class LesionTrackingService {
  private readonly logger = new Logger(LesionTrackingService.name)
  private readonly lesions = new Map<string, TrackedLesion>()

  constructor(private readonly prisma: PrismaService) {
    for (const l of seedLesions()) this.lesions.set(l.id, l)
  }

  private sortedMeasurements(lesion: TrackedLesion): LesionMeasurement[] {
    return [...lesion.measurements].sort((a, b) => a.date.localeCompare(b.date))
  }

  private toDto(lesion: TrackedLesion): TrackedLesion {
    return {
      ...lesion,
      measurements: this.sortedMeasurements(lesion),
      currentStatus: deriveLesionStatus(lesion.measurements),
    }
  }

  private require(id: string): TrackedLesion {
    const found = this.lesions.get(id)
    if (!found) throw new NotFoundException(`病灶 ${id} 不存在`)
    return found
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 列表 (现有表派生: Exam 提供 modality/bodyPart 提示 + seed/内存 CRUD)
  // ────────────────────────────────────────────────────────────────────────────
  async list(patientId: string): Promise<{ source: 'database' | 'demo'; items: TrackedLesion[] }> {
    let source: 'database' | 'demo' = 'demo'
    try {
      const exams = await this.prisma.exam.findMany({
        where: { patientId },
        take: 5,
        select: { modality: true, bodyPart: true },
      })
      if (exams.length > 0) source = 'database'
    } catch (e) {
      this.logger.warn(`lesion-tracking derive from Exam failed: ${(e as Error).message}`)
    }
    const items = [...this.lesions.values()]
      .filter((l) => l.patientId === patientId)
      .map((l) => this.toDto(l))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return { source, items }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CRUD
  // ────────────────────────────────────────────────────────────────────────────
  async create(dto: {
    patientId: string
    name: string
    site: string
    type?: LesionType
    initialSizeMm?: number
    modality?: string
    studyId?: string
    // [v3.0.6.11-100 Wave 6A (D-4)] 来源标注 (manual/ai/from-report) + 来源报告
    source?: LesionSource
    reportId?: string
  }): Promise<TrackedLesion> {
    const id = newId('LT')
    const now = ISO_DAY(0)
    const lesion: TrackedLesion = {
      id,
      lesionId: id,
      patientId: dto.patientId,
      name: dto.name,
      site: dto.site,
      type: dto.type ?? '其他',
      modality: dto.modality ?? 'CT',
      createdAt: now,
      currentStatus: '新发',
      source: dto.source ?? 'manual',
      reportId: dto.reportId ?? undefined,
      measurements: [
        {
          id: newId('m'),
          studyId: dto.studyId ?? '',
          date: now,
          sizeMm: Math.max(0, dto.initialSizeMm ?? 0),
        },
      ],
    }
    this.lesions.set(id, lesion)
    this.logger.log(`lesion created: ${id} (${dto.name}, ${dto.patientId}, source=${lesion.source})`)
    return this.toDto(lesion)
  }

  async get(id: string): Promise<TrackedLesion> {
    return this.toDto(this.require(id))
  }

  async update(id: string, dto: Partial<Pick<TrackedLesion, 'name' | 'site' | 'type' | 'modality'>>): Promise<TrackedLesion> {
    const lesion = this.require(id)
    if (dto.name !== undefined) lesion.name = dto.name
    if (dto.site !== undefined) lesion.site = dto.site
    if (dto.type !== undefined) lesion.type = dto.type
    if (dto.modality !== undefined) lesion.modality = dto.modality
    this.lesions.set(id, lesion)
    return this.toDto(lesion)
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const existed = this.lesions.delete(id)
    if (!existed) throw new NotFoundException(`病灶 ${id} 不存在`)
    return { id, deleted: true }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // [v3.0.6.11-100 Wave 6A (D-4)] 报告→病灶追踪自动建
  // POST /lesion-tracking/from-report { reportId, keyword? }
  //   → 从报告 impression/findings/conclusion 提取病灶关键词 (肺结节/肝占位/淋巴结 等规则)
  //   → 自动创建病灶记录 (名称=关键词+部位派生 + 初始尺寸从文本提取或占位)
  // ────────────────────────────────────────────────────────────────────────────
  async createFromReport(dto: {
    reportId: string
    keyword?: string
  }): Promise<{
    reportId: string
    patientId: string
    matched: LesionKeywordMatch[]
    created: TrackedLesion[]
    skipped: number
  }> {
    if (!dto.reportId?.trim()) throw new BadRequestException('reportId 必填')
    let report: { id: string; patientId: string; findings?: string | null; impression?: string | null; conclusion?: string | null; examId?: string | null; exam?: { modality?: string | null } | null } | null = null
    try {
      report = await this.prisma.report.findUnique({
        where: { id: dto.reportId.trim() },
        include: { exam: { select: { modality: true } } },
      })
    } catch (e) {
      this.logger.warn(`createFromReport: report ${dto.reportId} lookup failed: ${(e as Error).message}`)
    }
    if (!report) throw new NotFoundException(`Report ${dto.reportId} not found`)

    const text = [report.impression ?? '', report.conclusion ?? '', report.findings ?? ''].join('\n')
    let matches = extractLesionKeywords(text)
    if (dto.keyword?.trim()) {
      const kw = dto.keyword.trim()
      matches = matches.filter((m) => m.keyword === kw || m.name === kw)
    }

    const created: TrackedLesion[] = []
    let skipped = 0
    for (const match of matches) {
      // 同一报告同一名称去重 (幂等: 重复调用不重复建档)
      const exists = [...this.lesions.values()].some(
        (l) => l.reportId === report!.id && l.name === match.name,
      )
      if (exists) {
        skipped += 1
        continue
      }
      const lesion = await this.create({
        patientId: report.patientId,
        name: match.name,
        site: match.site,
        type: match.type,
        initialSizeMm: match.sizeMm,
        modality: report.exam?.modality ?? 'CT',
        studyId: report.examId ?? report.id,
        source: 'from-report',
        reportId: report.id,
      })
      created.push(lesion)
    }
    this.logger.log(`from-report ${dto.reportId}: matched=${matches.length} created=${created.length} skipped=${skipped}`)
    return { reportId: report.id, patientId: report.patientId, matched: matches, created, skipped }
  }

  // [v3.0.6.11-100 Wave 6A (D-4)] 报告关联病灶列表 (GET /reports/:id/lesions)
  // 按 reportId 查 from-report 自动创建的病灶
  async listByReport(reportId: string): Promise<{ reportId: string; items: TrackedLesion[] }> {
    const items = [...this.lesions.values()]
      .filter((l) => l.reportId === reportId)
      .map((l) => this.toDto(l))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return { reportId, items }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 测量
  // ────────────────────────────────────────────────────────────────────────────
  async addMeasurement(
    id: string,
    dto: { studyId: string; sizeMm: number; date: string; response?: ResponseClass; notes?: string },
  ): Promise<TrackedLesion> {
    const lesion = this.require(id)
    const measurement: LesionMeasurement = {
      id: newId('m'),
      studyId: dto.studyId ?? '',
      date: dto.date ?? ISO_DAY(0),
      sizeMm: Math.max(0, dto.sizeMm ?? 0),
      response: dto.response ?? undefined,
      notes: dto.notes ?? undefined,
    }
    lesion.measurements.push(measurement)
    this.lesions.set(id, lesion)
    this.logger.log(`lesion ${id} measurement added: ${measurement.sizeMm}mm @ ${measurement.date}`)
    return this.toDto(lesion)
  }

  async listMeasurements(id: string): Promise<LesionMeasurement[]> {
    return this.sortedMeasurements(this.require(id))
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 趋势 (供前端折线图)
  // ────────────────────────────────────────────────────────────────────────────
  async trend(id: string): Promise<LesionTrendResult> {
    const lesion = this.require(id)
    const sorted = this.sortedMeasurements(lesion)
    if (sorted.length === 0) {
      return {
        lesionId: id,
        baselineDate: '', baselineSize: 0,
        latestDate: '', latestSize: 0,
        changePercent: 0,
        overallResponse: 'NE', overallResponseLabel: RESPONSE_LABEL.NE,
        timeline: [],
      }
    }
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    const changePercent = first.sizeMm > 0
      ? +(((last.sizeMm - first.sizeMm) / first.sizeMm) * 100).toFixed(1)
      : 0
    const overallResponse = recistResponse(changePercent)
    return {
      lesionId: id,
      baselineDate: first.date,
      baselineSize: first.sizeMm,
      latestDate: last.date,
      latestSize: last.sizeMm,
      changePercent,
      overallResponse,
      overallResponseLabel: RESPONSE_LABEL[overallResponse],
      timeline: sorted.map((m) => ({ date: m.date, studyId: m.studyId, sizeMm: m.sizeMm, response: m.response })),
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 跨期对比 (RECIST-like 确定性判定)
  // ────────────────────────────────────────────────────────────────────────────
  async compare(id: string, dto: { studyIdA: string; studyIdB: string }): Promise<LesionCompareResult> {
    const lesion = this.require(id)
    const sorted = this.sortedMeasurements(lesion)
    const find = (studyId: string): LesionMeasurement | undefined =>
      sorted.find((m) => m.studyId === studyId) ?? sorted.find((m) => m.id === studyId)
    const a = find(dto.studyIdA)
    const b = find(dto.studyIdB)
    if (!a || !b) {
      throw new BadRequestException(
        `对比测量不存在 (studyIdA=${dto.studyIdA}, studyIdB=${dto.studyIdB}); 可用: ${sorted.map((m) => `${m.studyId || m.id}@${m.date}`).join(', ') || '无'}`,
      )
    }
    if (a.id === b.id) throw new BadRequestException('两次测量为同一记录, 请选择不同测量点')
    const changeMm = +(b.sizeMm - a.sizeMm).toFixed(1)
    const changePercent = a.sizeMm > 0 ? +((changeMm / a.sizeMm) * 100).toFixed(1) : 0
    const response = recistResponse(changePercent)
    let direction: LesionCompareResult['direction']
    if (b.sizeMm <= 0) direction = '消失'
    else if (changePercent >= 20) direction = '增大'
    else if (changePercent <= -30) direction = '缩小'
    else if (changePercent === 0) direction = '无变化'
    else direction = '无变化'
    return {
      lesionId: id,
      studyA: dto.studyIdA,
      studyB: dto.studyIdB,
      sizeA: a.sizeMm,
      sizeB: b.sizeMm,
      changeMm,
      changePercent,
      direction,
      response,
      responseLabel: RESPONSE_LABEL[response],
      deterministic: true,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 统计
  // ────────────────────────────────────────────────────────────────────────────
  async stats(patientId: string): Promise<LesionStats> {
    const items = [...this.lesions.values()]
      .filter((l) => l.patientId === patientId)
      .map((l) => this.toDto(l))
    const count = (s: LesionStatus) => items.filter((l) => l.currentStatus === s).length
    const byTypeMap = new Map<string, number>()
    for (const l of items) byTypeMap.set(l.type, (byTypeMap.get(l.type) ?? 0) + 1)
    return {
      patientId,
      total: items.length,
      new: count('新发'),
      progressed: count('增大'),
      stable: count('稳定'),
      disappeared: count('消失'),
      shrunk: count('缩小'),
      byType: Array.from(byTypeMap.entries()).map(([type, c]) => ({ type, count: c })),
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 随访联动 (Wave 3B followup: FollowUpPlan 存在性校验 + 病灶挂接)
  // ────────────────────────────────────────────────────────────────────────────
  async linkFollowup(id: string, dto: { followupId: string }): Promise<TrackedLesion> {
    const lesion = this.require(id)
    if (!dto.followupId?.trim()) throw new BadRequestException('followupId 必填')
    try {
      const plan = await this.prisma.followUpPlan.findUnique({ where: { id: dto.followupId } })
      if (!plan) {
        throw new BadRequestException(`随访计划 ${dto.followupId} 不存在`)
      }
      if (plan.patientId !== lesion.patientId) {
        throw new BadRequestException(`随访计划 ${dto.followupId} 属于患者 ${plan.patientId}, 与病灶患者 ${lesion.patientId} 不一致`)
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e
      this.logger.warn(`followup ${dto.followupId} 校验跳过 (DB 不可用): ${(e as Error).message}`)
    }
    lesion.followupId = dto.followupId
    this.lesions.set(id, lesion)
    this.logger.log(`lesion ${id} linked to followup ${dto.followupId}`)
    return this.toDto(lesion)
  }
}
