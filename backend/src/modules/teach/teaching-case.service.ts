// [G005 v3.0.6.11-103 Wave 18] 教学病例库 (Teaching Case Library) — PACS 教学深功能
// 数据源: Exam/Report 派生 + 确定性 seed 回退 + 进程内存 CRUD
// 功能: 病例收藏 / 分类管理 / 分享(链接+QR 概念) / 评论 / 考试模式(抽题→评分→错题本)
import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type CaseDifficulty = '入门' | '进阶' | '高级'

export interface TeachingCase {
  id: string
  title: string
  patientId?: string
  patientName: string
  gender: string
  age: number
  examId?: string
  reportId?: string
  modality: string
  bodyPart: string
  disease: string
  difficulty: CaseDifficulty
  diagnosis: string
  findings: string
  keyPoints: string[]
  tags: string[]
  thumbnail: string
  favoriteCount: number
  viewCount: number
  shared: boolean
  shareToken: string
  createdAt: string
  createdBy: string
}

export interface TeachingComment {
  id: string
  caseId: string
  user: string
  content: string
  time: string
}

export interface CategoryNode {
  name: string
  count: number
  children?: CategoryNode[]
}

export interface ExamQuestion {
  caseId: string
  title: string
  findings: string
  options: string[]
  answerIndex: number
}

export interface ExamPaper {
  examId: string
  difficulty: CaseDifficulty | '全部'
  total: number
  questions: ExamQuestion[]
}

export interface ExamResult {
  examId: string
  total: number
  correct: number
  score: number
  passed: boolean
  wrongQuestions: { caseId: string; title: string; selected: string; answer: string }[]
}

export interface WrongBookItem {
  caseId: string
  title: string
  disease: string
  diagnosis: string
  wrongCount: number
  lastWrongAt: string
}

export interface TeachingCaseStats {
  total: number
  shared: number
  favorites: number
  comments: number
  byDifficulty: Record<CaseDifficulty, number>
  byBodyPart: Array<{ name: string; count: number }>
}

export interface CreateTeachingCaseDto {
  title?: string
  patientId?: string
  examId?: string
  reportId?: string
  disease?: string
  bodyPart?: string
  difficulty?: CaseDifficulty
  keyPoints?: string[]
  tags?: string[]
  diagnosis?: string
  findings?: string
}

const DIFFICULTIES: CaseDifficulty[] = ['入门', '进阶', '高级']

const SEED_CASES: TeachingCase[] = [
  { id: 'TCL-001', title: '右肺上叶磨玻璃结节（早期肺腺癌）', patientId: 'P100001', patientName: '张伟', gender: '男', age: 58, modality: 'CT', bodyPart: '胸部', disease: '肺结节', difficulty: '进阶', diagnosis: '右肺上叶尖段磨玻璃结节，考虑原位腺癌（AIS）', findings: '右肺上叶尖段见约12mm磨玻璃密度结节，边界清楚，内部可见支气管充气征，未见实性成分。', keyPoints: ['磨玻璃结节的分型与随访策略', '纯磨玻璃 vs 混合磨玻璃的恶性风险分层', '支气管充气征的鉴别意义'], tags: ['磨玻璃结节', '肺癌', '经典征象'], thumbnail: 'lung-ggn', favoriteCount: 86, viewCount: 1520, shared: true, shareToken: 'tcl-001', createdAt: '2026-05-10', createdBy: '李明辉' },
  { id: 'TCL-002', title: '急性脑梗死 DWI 高信号', patientId: 'P100002', patientName: '李娜', gender: '女', age: 62, modality: 'MR', bodyPart: '头颅', disease: '脑梗死', difficulty: '入门', diagnosis: '左侧基底节区急性脑梗死', findings: 'DWI 显示左侧基底节区见高信号，ADC 呈低信号，范围约1.5cm×1.2cm，符合急性期细胞毒性水肿。', keyPoints: ['DWI/ADC 双序列判定急性梗死', '梗死分水岭区域特点', '超急性期溶栓时间窗'], tags: ['脑梗死', 'DWI', '急诊'], thumbnail: 'brain-dwi', favoriteCount: 54, viewCount: 980, shared: true, shareToken: 'tcl-002', createdAt: '2026-05-11', createdBy: '刘芳' },
  { id: 'TCL-003', title: '主动脉夹层（Standford A 型）', patientId: 'P100003', patientName: '王芳', gender: '女', age: 55, modality: 'CT', bodyPart: '胸部', disease: '主动脉夹层', difficulty: '高级', diagnosis: '主动脉夹层 Stanford A 型，破口位于升主动脉', findings: 'CTA 显示升主动脉内膜片，真假腔分隔，假腔累及主动脉弓及降主动脉，可见内膜破口。', keyPoints: ['夹层真假腔识别要点', 'Stanford 分型与治疗策略', '急诊 CTA 检查流程'], tags: ['主动脉夹层', '危急值', 'CTA'], thumbnail: 'aorta-dissection', favoriteCount: 72, viewCount: 1450, shared: true, shareToken: 'tcl-003', createdAt: '2026-05-12', createdBy: '张海涛' },
  { id: 'TCL-004', title: '肝血管瘤"快进慢出"强化特征', patientId: 'P100004', patientName: '周玉芬', gender: '女', age: 52, modality: 'CT', bodyPart: '腹部', disease: '肝血管瘤', difficulty: '入门', diagnosis: '肝右叶血管瘤（典型"快进慢出"强化）', findings: '动脉期病灶边缘结节样强化，门脉期强化向中心填充，延迟期病灶完全填充呈等密度。', keyPoints: ['肝血管瘤增强三期强化模式', '与肝细胞癌的鉴别要点', '"快进慢出" vs "快进快出"'], tags: ['肝血管瘤', '良性肿瘤', '鉴别诊断'], thumbnail: 'liver-hemangioma', favoriteCount: 45, viewCount: 760, shared: false, shareToken: '', createdAt: '2026-05-13', createdBy: '李明辉' },
  { id: 'TCL-005', title: '股骨颈骨折（Garden IV 型）', patientId: 'P100005', patientName: '赵刚', gender: '男', age: 71, modality: 'DR', bodyPart: '髋关节', disease: '股骨颈骨折', difficulty: '入门', diagnosis: '左股骨颈完全性骨折（Garden IV 型）', findings: '左股骨颈可见完全性骨折线，断端错位明显，股骨头旋转，Shenton 线不连续。', keyPoints: ['Garden 分型', '髋部骨折隐匿性骨折的检查选择', '老年髋部骨折的并发症'], tags: ['骨折', '创伤', '骨科'], thumbnail: 'hip-fracture', favoriteCount: 38, viewCount: 690, shared: false, shareToken: '', createdAt: '2026-05-14', createdBy: '孙丽' },
  { id: 'TCL-006', title: '腰椎间盘突出（旁中央型）', patientId: 'P100006', patientName: '孙伟', gender: '男', age: 45, modality: 'MR', bodyPart: '脊柱', disease: '腰椎间盘突出', difficulty: '入门', diagnosis: 'L4/5 椎间盘左后突出，压迫左侧神经根', findings: 'L4/5 椎间盘向左后突出约0.6cm，硬膜囊及左侧神经根受压，椎管狭窄。', keyPoints: ['椎间盘突出分型', '神经根受压的 MR 征象', '与椎管狭窄的关系'], tags: ['椎间盘突出', '腰椎', '退行性变'], thumbnail: 'spine-herniation', favoriteCount: 29, viewCount: 540, shared: false, shareToken: '', createdAt: '2026-05-15', createdBy: '刘芳' },
  { id: 'TCL-007', title: '弥漫性轴索损伤（DAI）', patientId: 'P100007', patientName: '郑强', gender: '男', age: 34, modality: 'MR', bodyPart: '头颅', disease: '脑外伤', difficulty: '高级', diagnosis: '弥漫性轴索损伤（DAI II 级）', findings: '灰白质交界区、胼胝体及脑干背外侧可见多发点状出血灶，SWI 显示明显低信号。', keyPoints: ['DAI 的好发部位', 'SWI 在微出血检出中的价值', '外伤昏迷程度的影像评估'], tags: ['脑外伤', 'DAI', 'SWI'], thumbnail: 'brain-dai', favoriteCount: 41, viewCount: 830, shared: false, shareToken: '', createdAt: '2026-05-16', createdBy: '张海涛' },
  { id: 'TCL-008', title: '卵巢畸胎瘤（成熟性）', patientId: 'P100008', patientName: '吴敏', gender: '女', age: 29, modality: 'CT', bodyPart: '盆腔', disease: '卵巢畸胎瘤', difficulty: '进阶', diagnosis: '左附件区成熟性畸胎瘤（含脂肪及钙化）', findings: '左附件区可见囊实性肿块，内含脂肪密度及钙化灶（骨组织），边界清楚。', keyPoints: ['畸胎瘤脂肪+钙化征象', '与恶性肿瘤的鉴别', '良恶性畸胎瘤的影像区分'], tags: ['卵巢畸胎瘤', '盆腔', '肿瘤'], thumbnail: 'ovary-teratoma', favoriteCount: 33, viewCount: 610, shared: false, shareToken: '', createdAt: '2026-05-17', createdBy: '李明辉' },
]

const SEED_COMMENTS: TeachingComment[] = [
  { id: 'TCM-001', caseId: 'TCL-001', user: '王秀峰', content: '磨玻璃结节伴支气管充气征，需警惕浸润性腺癌，建议密切随访。', time: '2026-05-18 09:20' },
  { id: 'TCM-002', caseId: 'TCL-001', user: '刘芳', content: '补充：实性成分占比>25% 时建议活检。', time: '2026-05-18 10:05' },
  { id: 'TCM-003', caseId: 'TCL-003', user: '孙丽', content: '急诊 CTA 需快速定位内膜破口，本例破口位于升主动脉，必须外科处理。', time: '2026-05-19 14:30' },
]

// 进程内存: 前端收藏/编辑的病例 + 评论 + 错题本
const memCases: TeachingCase[] = []
const memComments: TeachingComment[] = []
const memWrongBook: WrongBookItem[] = []
const memExams: ExamPaper[] = []
let examSeq = 0
// [v3.0.6.11-104] 单调递增序号, 避免同一毫秒创建的病例/评论 ID 冲突
let caseSeq = 0

function deterministicHash(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** 确定性 PRNG (mulberry32) */
function seededRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

@Injectable()
export class TeachingCaseService {
  private readonly logger = new Logger(TeachingCaseService.name)

  constructor(private readonly prisma: PrismaService) {}

  private allCases(): TeachingCase[] {
    return [...memCases, ...SEED_CASES]
  }

  // ── 病例 CRUD ──
  async list(query: { page?: number; pageSize?: number; search?: string; disease?: string; bodyPart?: string; difficulty?: string; tag?: string; sharedOnly?: boolean }) {
    let items = this.allCases()
    const db = await this.listFromDb()
    if (db.length > 0) items = [...memCases, ...db]
    if (query.search) {
      const q = query.search.toLowerCase()
      items = items.filter((c) =>
        c.title.toLowerCase().includes(q) ||
        c.disease.toLowerCase().includes(q) ||
        c.diagnosis.toLowerCase().includes(q) ||
        c.patientName.toLowerCase().includes(q) ||
        c.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    if (query.disease) items = items.filter((c) => c.disease === query.disease)
    if (query.bodyPart) items = items.filter((c) => c.bodyPart === query.bodyPart)
    if (query.difficulty) items = items.filter((c) => c.difficulty === query.difficulty)
    if (query.tag) items = items.filter((c) => c.tags.includes(query.tag!))
    if (query.sharedOnly) items = items.filter((c) => c.shared)
    const total = items.length
    const page = query.page ?? 1
    const pageSize = query.pageSize ?? 20
    items.sort((a, b) => (b.favoriteCount + b.viewCount) - (a.favoriteCount + a.viewCount))
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, pageSize }
  }

  async findById(id: string): Promise<TeachingCase> {
    const found = this.allCases().find((c) => c.id === id)
    if (!found) throw new NotFoundException(`Teaching case ${id} not found`)
    return found
  }

  async create(dto: CreateTeachingCaseDto, userId?: string): Promise<TeachingCase> {
    const resolved = await this.resolveFromExam(dto)
    const id = `TCL-${Date.now().toString(36).toUpperCase()}-${++caseSeq}`
    const record: TeachingCase = {
      id,
      title: dto.title || `${resolved.modality} ${resolved.bodyPart} 教学病例`,
      patientId: resolved.patientId,
      patientName: resolved.patientName,
      gender: resolved.gender,
      age: resolved.age,
      examId: dto.examId,
      reportId: dto.reportId,
      modality: resolved.modality,
      bodyPart: resolved.bodyPart,
      disease: dto.disease ?? resolved.disease,
      difficulty: dto.difficulty ?? '入门',
      diagnosis: dto.diagnosis ?? resolved.diagnosis,
      findings: dto.findings ?? resolved.findings,
      keyPoints: dto.keyPoints ?? [],
      tags: dto.tags ?? [],
      thumbnail: resolved.thumbnail,
      favoriteCount: 0,
      viewCount: 0,
      shared: false,
      shareToken: '',
      createdAt: isoDate(new Date()),
      createdBy: userId ?? '当前用户',
    }
    memCases.unshift(record)
    return record
  }

  async update(id: string, dto: Partial<TeachingCase>): Promise<TeachingCase> {
    const existing = memCases.find((c) => c.id === id)
    if (!existing) throw new NotFoundException(`Teaching case ${id} not found`)
    Object.assign(existing, dto)
    return existing
  }

  async remove(id: string): Promise<{ deleted: string }> {
    const idx = memCases.findIndex((c) => c.id === id)
    if (idx === -1) throw new NotFoundException(`Teaching case ${id} not found`)
    memCases.splice(idx, 1)
    return { deleted: id }
  }

  // ── 分类树 ──
  async categories(): Promise<CategoryNode[]> {
    const items = this.allCases()
    const count = (key: (c: TeachingCase) => string) => {
      const map = new Map<string, number>()
      for (const c of items) map.set(key(c), (map.get(key(c)) ?? 0) + 1)
      return map
    }
    const byDisease = count((c) => c.disease)
    const byBodyPart = count((c) => c.bodyPart)
    const byDifficulty = count((c) => c.difficulty)
    const byTag = count((c) => c.tags.join('|'))
    const tagNodes: CategoryNode[] = []
    for (const [tag] of byTag) {
      const parts = tag.split('|')
      for (const p of parts) {
        const node = tagNodes.find((n) => n.name === p)
        if (node) node.count += 1
        else tagNodes.push({ name: p, count: 1 })
      }
    }
    tagNodes.sort((a, b) => b.count - a.count)
    const diffNodes: CategoryNode[] = DIFFICULTIES.map((d) => ({ name: d, count: byDifficulty.get(d) ?? 0 }))
    return [
      { name: '病种', count: items.length, children: Array.from(byDisease.entries()).map(([name, n]) => ({ name, count: n })) },
      { name: '部位', count: items.length, children: Array.from(byBodyPart.entries()).map(([name, n]) => ({ name, count: n })) },
      { name: '难度', count: items.length, children: diffNodes },
      { name: '标签', count: items.length, children: tagNodes.slice(0, 12) },
    ]
  }

  async stats(): Promise<TeachingCaseStats> {
    const items = this.allCases()
    const byDifficulty: Record<CaseDifficulty, number> = { 入门: 0, 进阶: 0, 高级: 0 }
    const byBodyPart = new Map<string, number>()
    for (const c of items) {
      byDifficulty[c.difficulty] += 1
      byBodyPart.set(c.bodyPart, (byBodyPart.get(c.bodyPart) ?? 0) + 1)
    }
    return {
      total: items.length,
      shared: items.filter((c) => c.shared).length,
      favorites: items.reduce((s, c) => s + c.favoriteCount, 0),
      comments: [...memComments, ...SEED_COMMENTS].length,
      byDifficulty,
      byBodyPart: Array.from(byBodyPart.entries()).map(([name, count]) => ({ name, count })),
    }
  }

  // ── 分享 ──
  async share(id: string): Promise<{ id: string; shareToken: string; shareUrl: string; qrData: string }> {
    const c = await this.findById(id)
    const token = c.shareToken || `share-${c.id.toLowerCase()}-${deterministicHash(c.id + isoDate(new Date())).toString(36)}`
    c.shareToken = token
    c.shared = true
    if (!memCases.includes(c)) memCases.unshift({ ...c })
    const shareUrl = `/teach/share/${token}`
    // QR 概念: 结构化字符串, 前端可渲染为二维码图案
    const qrData = `RIS:TEACH:CASE:${token}`
    return { id, shareToken: token, shareUrl, qrData }
  }

  async getSharedCase(token: string): Promise<TeachingCase | undefined> {
    return this.allCases().find((c) => c.shareToken === token && c.shared)
  }

  // ── 评论 ──
  listComments(caseId: string): TeachingComment[] {
    return [...memComments, ...SEED_COMMENTS]
      .filter((cm) => cm.caseId === caseId)
      .sort((a, b) => b.time.localeCompare(a.time))
  }

  addComment(caseId: string, content: string, user?: string): TeachingComment {
    const c = this.allCases().find((cc) => cc.id === caseId)
    if (!c) throw new NotFoundException(`Teaching case ${caseId} not found`)
    if (!content.trim()) throw new BadRequestException('评论内容不能为空')
    const record: TeachingComment = {
      id: `TCM-${Date.now().toString(36).toUpperCase()}-${++caseSeq}`,
      caseId,
      user: user ?? '当前用户',
      content: content.trim(),
      time: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
    memComments.unshift(record)
    return record
  }

  // ── 考试模式 ──
  generateExam(query: { count?: number; difficulty?: string; category?: string }): ExamPaper {
    let pool = this.allCases()
    if (query.difficulty && query.difficulty !== '全部') pool = pool.filter((c) => c.difficulty === query.difficulty)
    if (query.category) pool = pool.filter((c) => c.disease === query.category || c.bodyPart === query.category)
    if (pool.length < 2) throw new BadRequestException('可抽题的病例不足 (至少需要 2 例)')
    const count = Math.min(query.count ?? 5, pool.length)
    if (query.count && query.count > pool.length) {
      throw new BadRequestException(`题库不足: 当前仅 ${pool.length} 例符合条件, 无法抽出 ${query.count} 题`)
    }
    examSeq += 1
    const examId = `EXAM-${Date.now().toString(36).toUpperCase()}-${examSeq}`
    const rng = seededRandom(deterministicHash(examId))
    // 确定性洗牌
    const shuffled = [...pool]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
    }
    const picked = shuffled.slice(0, count)
    const optionsPool = this.allCases().filter((c) => !picked.some((p) => p.id === c.id))
    const questions: ExamQuestion[] = picked.map((c) => {
      const answerIndex = Math.floor(rng() * 4)
      const options: string[] = new Array(4).fill('')
      // 确定性填充干扰项: 从其他病例诊断中选取, 不足时补充通用干扰项
      const distractors = optionsPool.map((o) => o.diagnosis)
      for (let i = 0; i < 4; i++) {
        if (i === answerIndex) {
          options[i] = c.diagnosis
        } else {
          const base = distractors[(deterministicHash(c.id + i) % Math.max(distractors.length, 1))]
          options[i] = base || '以上均不是'
        }
      }
      return { caseId: c.id, title: c.title, findings: c.findings, options, answerIndex }
    })
    const paper: ExamPaper = { examId, difficulty: (query.difficulty as CaseDifficulty | '全部') ?? '全部', total: count, questions }
    memExams.unshift(paper)
    return paper
  }

  submitExam(examId: string, answers: Array<{ caseId: string; selectedIndex: number }>): ExamResult {
    const paper = memExams.find((e) => e.examId === examId)
    if (!paper) throw new NotFoundException(`Exam ${examId} not found (请先重新抽题)`)
    let correct = 0
    const wrongQuestions: ExamResult['wrongQuestions'] = []
    for (const q of paper.questions) {
      const answer = answers.find((a) => a.caseId === q.caseId)
      const selectedIndex = answer?.selectedIndex ?? -1
      const isCorrect = selectedIndex === q.answerIndex
      if (isCorrect) correct += 1
      else {
        wrongQuestions.push({
          caseId: q.caseId,
          title: q.title,
          selected: selectedIndex >= 0 ? q.options[selectedIndex] ?? '未作答' : '未作答',
          answer: q.options[q.answerIndex]!,
        })
        const wb = memWrongBook.find((w) => w.caseId === q.caseId)
        if (wb) {
          wb.wrongCount += 1
          wb.lastWrongAt = isoDate(new Date())
        } else {
          const c = this.allCases().find((cc) => cc.id === q.caseId)
          memWrongBook.unshift({
            caseId: q.caseId,
            title: q.title,
            disease: c?.disease ?? '未知',
            diagnosis: q.options[q.answerIndex]!,
            wrongCount: 1,
            lastWrongAt: isoDate(new Date()),
          })
        }
      }
    }
    const score = paper.total > 0 ? Math.round((correct / paper.total) * 100) : 0
    return { examId, total: paper.total, correct, score, passed: score >= 60, wrongQuestions }
  }

  wrongBook(): WrongBookItem[] {
    return [...memWrongBook]
  }

  clearWrongBook(): { cleared: number } {
    const cleared = memWrongBook.length
    memWrongBook.splice(0)
    return { cleared }
  }

  // ── Exam/Report 派生 (收藏时自动填充病例内容) ──
  private async resolveFromExam(dto: CreateTeachingCaseDto): Promise<{
    patientId?: string; patientName: string; gender: string; age: number
    modality: string; bodyPart: string; disease: string; diagnosis: string; findings: string; thumbnail: string
  }> {
    const fallback = {
      patientId: dto.patientId,
      patientName: '待补充患者',
      gender: '其他',
      age: 0,
      modality: 'CT',
      bodyPart: '胸部',
      disease: dto.disease ?? '待定诊断',
      diagnosis: dto.diagnosis ?? '',
      findings: dto.findings ?? '',
      thumbnail: `case-${deterministicHash(dto.examId ?? dto.reportId ?? 'x') % 6}`,
    }
    if (!dto.examId && !dto.reportId) return fallback
    try {
      const report = dto.reportId
        ? await this.prisma.report.findUnique({
            where: { id: dto.reportId },
            include: { exam: { select: { modality: true, bodyPart: true } }, patient: { select: { name: true, gender: true, birthDate: true } } },
          })
        : null
      const exam: {
        id: string
        patientId: string
        modality: string
        bodyPart: string
        patient?: { name: string; gender: string; birthDate: Date | null } | null
        reports?: Array<{ diagnosis: string; findings: string }>
      } | null = (report?.exam as unknown as {
        id: string
        patientId: string
        modality: string
        bodyPart: string
        patient?: { name: string; gender: string; birthDate: Date | null } | null
        reports?: Array<{ diagnosis: string; findings: string }>
      } | null) ?? (dto.examId ? await this.prisma.exam.findUnique({
        where: { id: dto.examId },
        include: { patient: { select: { name: true, gender: true, birthDate: true } }, reports: { select: { diagnosis: true, findings: true }, take: 1, orderBy: { updatedAt: 'desc' } } },
      }) : null)
      if (!exam) return fallback
      const birthDate = exam.patient?.birthDate
      let age = 0
      if (birthDate) {
        age = new Date().getFullYear() - birthDate.getFullYear()
        const m = new Date().getMonth() - birthDate.getMonth()
        if (m < 0 || (m === 0 && new Date().getDate() < birthDate.getDate())) age -= 1
      }
      return {
        patientId: exam.patientId,
        patientName: exam.patient?.name ?? '未知患者',
        gender: exam.patient?.gender === 'FEMALE' ? '女' : exam.patient?.gender === 'MALE' ? '男' : '其他',
        age: Math.max(0, age),
        modality: exam.modality,
        bodyPart: exam.bodyPart,
        disease: dto.disease ?? (exam.reports?.[0]?.diagnosis?.slice(0, 12) || '待定诊断'),
        diagnosis: dto.diagnosis ?? exam.reports?.[0]?.diagnosis ?? '',
        findings: dto.findings ?? exam.reports?.[0]?.findings ?? '',
        thumbnail: `case-${deterministicHash(exam.id) % 6}`,
      }
    } catch (err) {
      this.logger.warn(`[TeachingCase] resolveFromExam DB failed, fallback: ${(err as Error).message}`)
      return fallback
    }
  }

  private async listFromDb(): Promise<TeachingCase[]> {
    try {
      const rows = await this.prisma.report.findMany({
        where: { findings: { not: '' }, diagnosis: { not: '' } },
        orderBy: { updatedAt: 'desc' },
        take: 24,
        include: {
          exam: { select: { modality: true, bodyPart: true } },
          patient: { select: { name: true, gender: true, birthDate: true } },
        },
      })
      if (rows.length === 0) return []
      return rows.map((r, i) => {
        const hash = deterministicHash(r.id)
        const difficulty = DIFFICULTIES[hash % DIFFICULTIES.length]!
        const disease = r.diagnosis.slice(0, 12) || '待定诊断'
        return {
          id: `tcl-db-${r.id.slice(-8)}`,
          title: `${r.exam?.modality ?? '影像'} ${r.exam?.bodyPart ?? ''} 教学病例`,
          patientId: r.patientId,
          patientName: r.patient?.name ?? '未知患者',
          gender: r.patient?.gender === 'FEMALE' ? '女' : r.patient?.gender === 'MALE' ? '男' : '其他',
          age: 0,
          modality: r.exam?.modality ?? 'CT',
          bodyPart: r.exam?.bodyPart ?? '未指定',
          disease,
          difficulty,
          diagnosis: r.diagnosis,
          findings: r.findings,
          keyPoints: [r.impression || r.diagnosis],
          tags: [r.exam?.modality ?? 'CT', difficulty, hash % 2 === 0 ? '教学病例' : '疑难病例'],
          thumbnail: `case-${hash % 6}`,
          favoriteCount: hash % 40,
          viewCount: 100 + (hash % 500),
          shared: false,
          shareToken: '',
          createdAt: r.createdAt.toISOString().slice(0, 10),
          createdBy: '系统归档',
        }
      })
    } catch (err) {
      this.logger.warn(`[TeachingCase] DB query failed, fallback to seed: ${(err as Error).message}`)
      return []
    }
  }
}
