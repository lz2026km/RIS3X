/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 8A (report-compare-v2) - 报告对比 V2 (F16)
 *
 * 孤儿模块 (纯内存 + seed 回退, 无 DB 依赖, 可无 DB 启动):
 *   1. 对比对象: 同患者不同时点报告 / 双阅双报告 / 同检查医生与 AI 报告
 *   2. 对比维度:
 *      - 逐段差异: 行级 diff (LCS 算法) → 相同/修改/新增/删除, 每个差异项含 段落/原文/新文/类型
 *      - 关键字段对比: 诊断结论 / 印象 / 随访建议 / 测量值 (正则提取, 确定性)
 *      - 相似度评分: 0-100 (字符二元组 + 行级 LCS 加权, 纯函数确定性)
 *   3. 统计摘要: 行数 / 相同 / 修改 / 新增 / 删除 / 变更率 / 相似度 / 关键字段变更数
 *
 * 端点:
 *   - GET  /report-compare-v2/reports   报告目录 (选择对比对象)
 *   - GET  /report-compare-v2/presets   预设对比组合 (三类场景)
 *   - POST /report-compare-v2/compare   执行对比 (按 id 或按原文 textA/textB)
 *   - GET  /report-compare-v2/stats     统计
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

// ================= 类型定义 =================

export type CompareType = 'patient-history' | 'dual-read' | 'doctor-ai'
export type DiffType = 'same' | 'modified' | 'added' | 'removed'

export interface ReportSections {
  findings: string
  impression: string
  conclusion: string
  diagnosis: string
  recommendations: string
}

export interface CompareReportRecord {
  id: string
  patientId: string
  patientName: string
  gender: string
  examDate: string
  modality: string
  bodyPart: string
  doctorId: string
  doctorName: string
  source: 'doctor' | 'ai' | 'prior'
  organization: string
  isAiGenerated: boolean
  sections: ReportSections
}

export interface ReportSummary {
  id: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorName: string
  source: 'doctor' | 'ai' | 'prior'
  organization: string
  isAiGenerated: boolean
}

export interface ComparePreset {
  id: string
  type: CompareType
  label: string
  description: string
  reportAId: string
  reportBId: string
}

export interface LineDiffOp {
  section: string
  sectionLabel: string
  type: DiffType
  line: string
  original?: string
  lineNoOld?: number
  lineNoNew?: number
}

export interface SectionDiffItem {
  section: string
  label: string
  type: DiffType
  original: string
  updated: string
  originalLineCount: number
  updatedLineCount: number
  ops: LineDiffOp[]
}

export interface KeyFieldComparison {
  field: string
  label: string
  original: string
  updated: string
  equal: boolean
  change: DiffType
}

export interface CompareStatistics {
  totalLines: number
  same: number
  modified: number
  added: number
  removed: number
  changeRate: number
  similarity: number
  keyFieldChanges: number
  sectionsCompared: number
}

export interface ReportCompareResult {
  id: string
  type: CompareType
  reportA: ReportSummary
  reportB: ReportSummary
  sectionDiffs: SectionDiffItem[]
  keyFields: KeyFieldComparison[]
  lineDiffs: LineDiffOp[]
  statistics: CompareStatistics
  deterministic: true
  generatedAt: string
}

export interface CompareInput {
  reportAId?: string
  reportBId?: string
  type?: CompareType
  textA?: string
  textB?: string
  sectionLabel?: string
}

export interface CompareV2Stats {
  totalReports: number
  presetCount: number
  byType: Record<CompareType, number>
  avgSimilarity: number
  organizationCount: number
}

// ================= 常量与工具 =================

const TYPE_LABEL: Record<CompareType, string> = {
  'patient-history': '同患者不同时点',
  'dual-read': '双阅双报告',
  'doctor-ai': '医生与 AI 报告',
}

const SECTION_META: Array<{ key: keyof ReportSections; label: string }> = [
  { key: 'findings', label: '所见' },
  { key: 'impression', label: '印象' },
  { key: 'conclusion', label: '诊断结论' },
  { key: 'diagnosis', label: '诊断' },
  { key: 'recommendations', label: '随访建议' },
]

const MEASURE_RE = /(\d+(?:\.\d+)?)\s*(mm|cm|毫米|厘米)/g

function toLines(text: string): string[] {
  const raw = (text ?? '').split(/\r?\n/)
  while (raw.length > 0 && raw[raw.length - 1]!.trim() === '') raw.pop()
  return raw
}

function normalizeText(text: string): string {
  return (text ?? '').replace(/\s+/g, '').toLowerCase()
}

/** 提取测量值 (确定性): "1.5cm" / "12.5 mm" / "8毫米" → 归一化小写 */
function extractMeasurements(text: string): string[] {
  const out: string[] = []
  const re = new RegExp(MEASURE_RE.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    out.push(`${m[1]}${m[2]!.toLowerCase()}`)
  }
  return out
}

/** 字符二元组 + 单词 token 集 (相似度确定性输入) */
function tokenize(text: string): Set<string> {
  const s = new Set<string>()
  const chars = text.replace(/\s+/g, '').toLowerCase()
  for (let i = 0; i + 1 < chars.length; i += 1) s.add(chars.slice(i, i + 2))
  for (const t of text.toLowerCase().split(/[^\w\u4e00-\u9fa5]+/)) {
    if (t.length > 0 && /^[a-z0-9]+$/.test(t)) s.add(`w:${t}`)
  }
  return s
}

/** 字符级相似度 0-100 (纯函数确定性) */
function tokenSimilarity(a: string, b: string): number {
  if (!a && !b) return 100
  const sa = tokenize(a)
  const sb = tokenize(b)
  if (sa.size === 0 && sb.size === 0) return 100
  let overlap = 0
  for (const t of sa) {
    if (sb.has(t)) overlap += 1
  }
  return Math.round((200 * overlap) / (sa.size + sb.size))
}

/** LCS 长度矩阵 */
function lcsLengths(a: string[], b: string[]): number[][] {
  const n = a.length
  const m = b.length
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
    }
  }
  return dp
}

interface RawOp {
  kind: 'same' | 'removed' | 'added'
  text: string
  oldIdx: number
  newIdx: number
}

/** LCS 回溯: 原始操作序列 (same/removed/added) */
function rawDiff(a: string[], b: string[]): RawOp[] {
  const dp = lcsLengths(a, b)
  const ops: RawOp[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      ops.push({ kind: 'same', text: a[i]!, oldIdx: i + 1, newIdx: j + 1 })
      i += 1
      j += 1
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      ops.push({ kind: 'removed', text: a[i]!, oldIdx: i + 1, newIdx: j + 1 })
      i += 1
    } else {
      ops.push({ kind: 'added', text: b[j]!, oldIdx: i + 1, newIdx: j + 1 })
      j += 1
    }
  }
  while (i < a.length) {
    ops.push({ kind: 'removed', text: a[i]!, oldIdx: i + 1, newIdx: j + 1 })
    i += 1
  }
  while (j < b.length) {
    ops.push({ kind: 'added', text: b[j]!, oldIdx: i + 1, newIdx: j + 1 })
    j += 1
  }
  return ops
}

/** 行级操作 (未绑定段落) */
interface PairOp {
  type: DiffType
  line: string
  original?: string
  lineNoOld?: number
  lineNoNew?: number
}

/**
 * 配对删除+新增等长块 → 'modified' (逐行配对), 剩余删除 → 'removed', 剩余新增 → 'added'
 * 保证: 行级增删改分类正确且确定性 (同输入恒同输出)
 */
function pairOps(raw: RawOp[]): PairOp[] {
  const out: PairOp[] = []
  const pendingRemoved: Array<{ text: string; oldIdx: number }> = []
  const pendingAdded: Array<{ text: string; newIdx: number }> = []
  const flush = () => {
    const pairs = Math.min(pendingRemoved.length, pendingAdded.length)
    for (let k = 0; k < pairs; k += 1) {
      const r = pendingRemoved[k]!
      const ad = pendingAdded[k]!
      out.push({ type: 'modified', line: ad.text, original: r.text, lineNoOld: r.oldIdx, lineNoNew: ad.newIdx })
    }
    for (let k = pairs; k < pendingRemoved.length; k += 1) {
      const r = pendingRemoved[k]!
      out.push({ type: 'removed', line: r.text, original: r.text, lineNoOld: r.oldIdx })
    }
    for (let k = pairs; k < pendingAdded.length; k += 1) {
      const ad = pendingAdded[k]!
      out.push({ type: 'added', line: ad.text, lineNoNew: ad.newIdx })
    }
    pendingRemoved.length = 0
    pendingAdded.length = 0
  }
  for (const op of raw) {
    if (op.kind === 'same') {
      flush()
      out.push({ type: 'same', line: op.text, lineNoOld: op.oldIdx, lineNoNew: op.newIdx })
    } else if (op.kind === 'removed') {
      pendingRemoved.push({ text: op.text, oldIdx: op.oldIdx })
    } else {
      pendingAdded.push({ text: op.text, newIdx: op.newIdx })
    }
  }
  flush()
  return out
}

/** 行级相似度 0-100: same=1, modified=0.5 */
function lineSimilarity(ops: LineDiffOp[]): number {
  if (ops.length === 0) return 100
  let score = 0
  for (const op of ops) {
    if (op.type === 'same') score += 1
    else if (op.type === 'modified') score += 0.5
  }
  return Math.round((100 * score) / ops.length)
}

/** 段落聚合类型: 全同→same; 仅新增→added; 仅删除→removed; 其余→modified */
function aggregateSectionType(ops: LineDiffOp[]): DiffType {
  if (ops.length === 0 || ops.every((o) => o.type === 'same')) return 'same'
  const hasAdded = ops.some((o) => o.type === 'added')
  const hasRemoved = ops.some((o) => o.type === 'removed' || o.type === 'modified')
  if (hasAdded && !hasRemoved) return 'added'
  if (hasRemoved && !hasAdded && !ops.some((o) => o.type === 'modified')) return 'removed'
  return 'modified'
}

// ================= 种子数据 (seed 回退) =================

const seedSections = (partial: Partial<ReportSections> & Pick<ReportSections, 'findings' | 'conclusion'>): ReportSections => ({
  findings: partial.findings,
  impression: partial.impression ?? '',
  conclusion: partial.conclusion,
  diagnosis: partial.diagnosis ?? '',
  recommendations: partial.recommendations ?? '',
})

const SEED_REPORTS: CompareReportRecord[] = [
  // ---- 场景 1: 同患者不同时点 (肺结节随访) ----
  {
    id: 'RPC-HIS-001',
    patientId: 'P-10001',
    patientName: '王秀兰',
    gender: '女',
    examDate: '2026-02-10',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    source: 'prior',
    organization: '中心医院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '双肺纹理清晰，右肺上叶见约 8mm 磨玻璃结节影，边界欠清。余肺野未见明显异常。',
      impression: '右肺上叶磨玻璃结节，建议随访。',
      conclusion: '右肺上叶磨玻璃结节（8mm），建议 6 个月后复查随访。',
      recommendations: '6 个月后复查胸部 CT。',
    }),
  },
  {
    id: 'RPC-HIS-002',
    patientId: 'P-10001',
    patientName: '王秀兰',
    gender: '女',
    examDate: '2026-05-22',
    modality: 'CT',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    source: 'doctor',
    organization: '中心医院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '双肺纹理清晰，右肺上叶见约 7mm 磨玻璃结节影，边界欠清，较前无明显变化。余肺野未见明显异常。',
      impression: '右肺上叶磨玻璃结节，较前无明显变化。',
      conclusion: '右肺上叶磨玻璃结节（7mm），较前无明显变化，建议继续 6 个月随访复查。',
      recommendations: '6 个月后复查胸部 CT；如结节增大或密度变化，建议增强检查。',
    }),
  },
  // ---- 场景 2: 双阅双报告 (左膝关节 MR) ----
  {
    id: 'RPC-DR-001',
    patientId: 'P-10002',
    patientName: '李明',
    gender: '男',
    examDate: '2026-06-15',
    modality: 'MR',
    bodyPart: '左膝关节',
    doctorId: 'D002',
    doctorName: '王秀峰',
    source: 'doctor',
    organization: '中心医院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '左膝关节内侧半月板后角见线状高信号，达关节面。前交叉韧带形态可，信号未见明显异常。',
      impression: '左膝内侧半月板后角撕裂可能。',
      conclusion: '左膝内侧半月板后角撕裂（III 级信号），建议骨科会诊。',
      recommendations: '建议骨科进一步评估，必要时关节镜治疗。',
    }),
  },
  {
    id: 'RPC-DR-002',
    patientId: 'P-10002',
    patientName: '李明',
    gender: '男',
    examDate: '2026-06-15',
    modality: 'MR',
    bodyPart: '左膝关节',
    doctorId: 'D003',
    doctorName: '李建国',
    source: 'doctor',
    organization: '中心医院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '左膝关节内侧半月板后角见线状高信号，达关节面缘。前交叉韧带、后交叉韧带形态可，信号未见明显异常。',
      impression: '左膝内侧半月板后角撕裂可能，与前阅片意见一致。',
      conclusion: '左膝内侧半月板后角撕裂（III 级信号），与前阅片意见一致，建议骨科会诊。',
      recommendations: '建议骨科进一步评估，必要时关节镜治疗；术后随访 3 个月。',
    }),
  },
  // ---- 场景 3: 同检查医生与 AI 报告 (头颅 MR) ----
  {
    id: 'RPC-DA-001',
    patientId: 'P-10003',
    patientName: '赵敏',
    gender: '女',
    examDate: '2026-07-08',
    modality: 'MR',
    bodyPart: '头颅',
    doctorId: 'D004',
    doctorName: '陈海涛',
    source: 'doctor',
    organization: '中心医院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '右侧基底节区见片状长 T1 长 T2 信号影，边界欠清，DWI 未见明显弥散受限。脑室系统未见扩大，中线结构居中。',
      impression: '右侧基底节区异常信号，考虑陈旧性病变可能。',
      conclusion: '右侧基底节区异常信号，DWI 未见弥散受限，考虑陈旧性病变可能，建议结合临床随访。',
      recommendations: '建议 3-6 个月随访复查；如有新发症状，及时复查 MRI。',
    }),
  },
  {
    id: 'RPC-DA-002',
    patientId: 'P-10003',
    patientName: '赵敏',
    gender: '女',
    examDate: '2026-07-08',
    modality: 'MR',
    bodyPart: '头颅',
    doctorId: 'AI',
    doctorName: 'AI 辅助诊断',
    source: 'ai',
    organization: '中心医院',
    isAiGenerated: true,
    sections: seedSections({
      findings: '右侧基底节区见片状长 T1 长 T2 信号影，边界欠清。脑室系统未见扩大，中线结构居中。',
      impression: '右侧基底节区异常信号，考虑缺血性改变可能。',
      conclusion: '右侧基底节区异常信号，考虑缺血性改变可能，建议随访。',
      recommendations: '建议 6 个月随访复查。',
    }),
  },
  // ---- 目录补充报告 (选择器用) ----
  {
    id: 'RPC-CAT-001',
    patientId: 'P-10004',
    patientName: '王芳',
    gender: '女',
    examDate: '2026-07-01',
    modality: 'DR',
    bodyPart: '胸部',
    doctorId: 'D001',
    doctorName: '张海涛',
    source: 'doctor',
    organization: '中心医院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '双肺野清晰，肺纹理走形自然，未见明确实变及占位。心影大小形态未见异常。',
      conclusion: '胸部正位片未见明显异常。',
    }),
  },
  {
    id: 'RPC-CAT-002',
    patientId: 'P-10005',
    patientName: '刘洋',
    gender: '男',
    examDate: '2026-06-18',
    modality: 'CT',
    bodyPart: '腹部',
    doctorId: 'D002',
    doctorName: '王秀峰',
    source: 'doctor',
    organization: '东城分院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '肝脏形态大小未见异常，肝内胆管未见扩张。胆囊壁略增厚。胰腺、脾脏、双肾未见明显异常。',
      conclusion: '胆囊壁增厚，考虑胆囊炎可能，建议结合临床。',
      recommendations: '建议消化内科会诊，必要时超声复查。',
    }),
  },
  {
    id: 'RPC-CAT-003',
    patientId: 'P-10006',
    patientName: '孙倩',
    gender: '女',
    examDate: '2026-07-12',
    modality: 'MG',
    bodyPart: '双乳',
    doctorId: 'D003',
    doctorName: '李建国',
    source: 'doctor',
    organization: '城西分院',
    isAiGenerated: false,
    sections: seedSections({
      findings: '双乳腺体呈散在纤维腺体类，双乳未见明确肿块及异常钙化。双侧腋窝未见明显肿大淋巴结。',
      impression: '双乳 BI-RADS 2 类。',
      conclusion: '双乳未见明确恶性征象，BI-RADS 2 类。',
    }),
  },
]

const SEED_PRESETS: ComparePreset[] = [
  {
    id: 'PRESET-HIS-01',
    type: 'patient-history',
    label: '肺结节随访: 2026-02 vs 2026-05 (同患者不同时点)',
    description: '王秀兰 右肺上叶磨玻璃结节, 两次 CT 对比: 测量值 8mm→7mm, 结论与随访建议变化',
    reportAId: 'RPC-HIS-001',
    reportBId: 'RPC-HIS-002',
  },
  {
    id: 'PRESET-DR-01',
    type: 'dual-read',
    label: '左膝关节 MR 双阅: 初阅 vs 复核',
    description: '李明 左膝半月板, 双阅双报告: 所见补充后交叉韧带, 结论新增与前阅片一致性说明',
    reportAId: 'RPC-DR-001',
    reportBId: 'RPC-DR-002',
  },
  {
    id: 'PRESET-DA-01',
    type: 'doctor-ai',
    label: '头颅 MR: 医生终稿 vs AI 初稿',
    description: '赵敏 右侧基底节区异常信号: 医生补充 DWI 描述, 结论由缺血性改为陈旧性病变可能',
    reportAId: 'RPC-DA-002',
    reportBId: 'RPC-DA-001',
  },
]

// ================= 服务 =================

@Injectable()
export class ReportCompareV2Service {
  private readonly reports: CompareReportRecord[] = SEED_REPORTS
  private readonly presets: ComparePreset[] = SEED_PRESETS
  private compareSeq = 0

  /** GET /report-compare-v2/reports — 报告目录 (供前端选择对比对象) */
  listReports(): ReportSummary[] {
    return this.reports.map((r) => this.toSummary(r))
  }

  /** GET /report-compare-v2/presets — 预设对比组合 (三类场景) */
  listPresets(): ComparePreset[] {
    return this.presets.map((p) => ({ ...p }))
  }

  /**
   * POST /report-compare-v2/compare — 执行对比。
   * 两种入参 (互斥):
   *   - reportAId + reportBId: 从目录取报告记录对比
   *   - textA + textB: 原文对比 (段落级, sectionLabel 可指定段落名)
   */
  compare(input: CompareInput): ReportCompareResult {
    const hasIds = Boolean(input.reportAId && input.reportBId)
    const hasTexts = input.textA !== undefined && input.textB !== undefined
    if (hasIds === hasTexts) {
      throw new BadRequestException('必须且只能提供 reportAId+reportBId 或 textA+textB')
    }
    if (hasIds) {
      return this.compareByIds(input.reportAId!, input.reportBId!, input.type)
    }
    return this.compareTexts(input.textA!, input.textB!, input.sectionLabel ?? '自定义段落', input.type)
  }

  /** 按报告 id 对比: 逐段 diff + 关键字段 + 相似度 */
  compareByIds(reportAId: string, reportBId: string, type?: CompareType): ReportCompareResult {
    const reportA = this.reports.find((r) => r.id === reportAId)
    if (!reportA) throw new NotFoundException(`Report ${reportAId} not found`)
    const reportB = this.reports.find((r) => r.id === reportBId)
    if (!reportB) throw new NotFoundException(`Report ${reportBId} not found`)
    const resolvedType = type ?? this.inferType(reportAId, reportBId)
    const sectionDiffs: SectionDiffItem[] = []
    const lineDiffs: LineDiffOp[] = []
    const keyFields: KeyFieldComparison[] = []
    for (const meta of SECTION_META) {
      const oldText = reportA.sections[meta.key]
      const newText = reportB.sections[meta.key]
      const ops = this.diffSection(meta.key, meta.label, oldText, newText)
      sectionDiffs.push(ops.item)
      lineDiffs.push(...ops.ops)
    }
    keyFields.push(...this.compareKeyFields(reportA.sections, reportB.sections))
    const similarity = this.scoreSimilarity(reportA.sections, reportB.sections, lineDiffs)
    return {
      id: this.nextId(),
      type: resolvedType,
      reportA: this.toSummary(reportA),
      reportB: this.toSummary(reportB),
      sectionDiffs,
      keyFields,
      lineDiffs,
      statistics: this.buildStatistics(sectionDiffs, keyFields, similarity),
      deterministic: true,
      generatedAt: new Date().toISOString(),
    }
  }

  /** 原文对比 (单段落) */
  compareTexts(textA: string, textB: string, sectionLabel: string, type?: CompareType): ReportCompareResult {
    const key = `text-${sectionLabel.replace(/\s+/g, '')}`
    const item = this.diffSection(key, sectionLabel, textA, textB)
    const keyFields: KeyFieldComparison[] = [
      {
        field: key,
        label: sectionLabel,
        original: textA,
        updated: textB,
        equal: normalizeText(textA) === normalizeText(textB),
        change: normalizeText(textA) === normalizeText(textB) ? 'same' : item.item.type,
      },
    ]
    const similarity = this.scoreSimilarity(
      this.sectionsFromText(textA),
      this.sectionsFromText(textB),
      item.ops,
    )
    return {
      id: this.nextId(),
      type: type ?? 'patient-history',
      reportA: this.textSummary('A', sectionLabel),
      reportB: this.textSummary('B', sectionLabel),
      sectionDiffs: [item.item],
      keyFields,
      lineDiffs: item.ops,
      statistics: this.buildStatistics([item.item], keyFields, similarity),
      deterministic: true,
      generatedAt: new Date().toISOString(),
    }
  }

  /** GET /report-compare-v2/stats — 统计 (预设组合平均相似度, 确定性) */
  getStats(): CompareV2Stats {
    let similaritySum = 0
    let compared = 0
    for (const p of this.presets) {
      try {
        const res = this.compareByIds(p.reportAId, p.reportBId, p.type)
        similaritySum += res.statistics.similarity
        compared += 1
      } catch {
        /* 预设记录缺失时跳过 */
      }
    }
    const byType: Record<CompareType, number> = {
      'patient-history': 0,
      'dual-read': 0,
      'doctor-ai': 0,
    }
    for (const p of this.presets) byType[p.type] += 1
    return {
      totalReports: this.reports.length,
      presetCount: this.presets.length,
      byType,
      avgSimilarity: compared > 0 ? Math.round(similaritySum / compared) : 0,
      organizationCount: new Set(this.reports.map((r) => r.organization)).size,
    }
  }

  // ================= 内部实现 =================

  private toSummary(r: CompareReportRecord): ReportSummary {
    return {
      id: r.id,
      patientName: r.patientName,
      examDate: r.examDate,
      modality: r.modality,
      bodyPart: r.bodyPart,
      doctorName: r.doctorName,
      source: r.source,
      organization: r.organization,
      isAiGenerated: r.isAiGenerated,
    }
  }

  private inferType(reportAId: string, reportBId: string): CompareType {
    const preset = this.presets.find(
      (p) => (p.reportAId === reportAId && p.reportBId === reportBId) || (p.reportAId === reportBId && p.reportBId === reportAId),
    )
    if (preset) return preset.type
    const a = this.reports.find((r) => r.id === reportAId)
    const b = this.reports.find((r) => r.id === reportBId)
    if (!a || !b) return 'patient-history'
    if (a.isAiGenerated !== b.isAiGenerated) return 'doctor-ai'
    if (a.patientId === b.patientId) return 'patient-history'
    return 'dual-read'
  }

  /** 单段落行级 diff → 段落差异项 + 行级操作序列 */
  private diffSection(
    section: string,
    label: string,
    oldText: string,
    newText: string,
  ): { item: SectionDiffItem; ops: LineDiffOp[] } {
    const oldLines = toLines(oldText)
    const newLines = toLines(newText)
    const ops = pairOps(rawDiff(oldLines, newLines)).map((op) => ({
      ...op,
      section,
      sectionLabel: label,
    }))
    const item: SectionDiffItem = {
      section,
      label,
      type: aggregateSectionType(ops),
      original: oldText,
      updated: newText,
      originalLineCount: oldLines.length,
      updatedLineCount: newLines.length,
      ops,
    }
    return { item, ops }
  }

  /** 关键字段对比: 诊断结论 / 印象 / 随访建议 / 测量值 */
  private compareKeyFields(a: ReportSections, b: ReportSections): KeyFieldComparison[] {
    const fields: Array<{ key: string; label: string; pick: (s: ReportSections) => string }> = [
      { key: 'diagnosis', label: '诊断结论', pick: (s) => s.conclusion || s.diagnosis },
      { key: 'impression', label: '印象', pick: (s) => s.impression },
      { key: 'recommendation', label: '随访建议', pick: (s) => s.recommendations },
      {
        key: 'measurement',
        label: '测量值',
        pick: (s) => extractMeasurements(`${s.findings} ${s.impression} ${s.conclusion}`).join(', '),
      },
    ]
    return fields.map((f) => {
      const original = f.pick(a)
      const updated = f.pick(b)
      const equal = normalizeText(original) === normalizeText(updated)
      let change: DiffType = 'same'
      if (!equal) {
        if (!normalizeText(original)) change = 'added'
        else if (!normalizeText(updated)) change = 'removed'
        else change = 'modified'
      }
      return { field: f.key, label: f.label, original, updated, equal, change }
    })
  }

  /** 相似度 0-100: 字符二元组相似度 75% + 行级 LCS 相似度 25% (纯函数确定性) */
  private scoreSimilarity(a: ReportSections, b: ReportSections, lineOps: LineDiffOp[]): number {
    const textA = [a.findings, a.impression, a.conclusion, a.diagnosis, a.recommendations].join('\n')
    const textB = [b.findings, b.impression, b.conclusion, b.diagnosis, b.recommendations].join('\n')
    const tokenSim = tokenSimilarity(textA, textB)
    const lineSim = lineSimilarity(lineOps)
    return Math.round(0.75 * tokenSim + 0.25 * lineSim)
  }

  private sectionsFromText(text: string): ReportSections {
    return {
      findings: text,
      impression: text,
      conclusion: text,
      diagnosis: '',
      recommendations: '',
    }
  }

  private textSummary(tag: string, _sectionLabel: string): ReportSummary {
    return {
      id: `TEXT-${tag}`,
      patientName: '原文对比',
      examDate: '',
      modality: '',
      bodyPart: '',
      doctorName: `文本 ${tag}`,
      source: 'doctor',
      organization: '自定义',
      isAiGenerated: false,
    }
  }

  private buildStatistics(
    sectionDiffs: SectionDiffItem[],
    keyFields: KeyFieldComparison[],
    similarity: number,
  ): CompareStatistics {
    let same = 0
    let modified = 0
    let added = 0
    let removed = 0
    let totalLines = 0
    for (const item of sectionDiffs) {
      for (const op of item.ops) {
        totalLines += 1
        if (op.type === 'same') same += 1
        else if (op.type === 'modified') modified += 1
        else if (op.type === 'added') added += 1
        else removed += 1
      }
    }
    const changed = modified + added + removed
    return {
      totalLines,
      same,
      modified,
      added,
      removed,
      changeRate: totalLines > 0 ? Math.round((100 * changed) / totalLines) : 0,
      similarity,
      keyFieldChanges: keyFields.filter((f) => !f.equal).length,
      sectionsCompared: sectionDiffs.length,
    }
  }

  private nextId(): string {
    this.compareSeq += 1
    return `RPC-${Date.now().toString(36)}-${this.compareSeq}`
  }

  /** 类型中文标签 (供前端展示) */
  typeLabel(type: CompareType): string {
    return TYPE_LABEL[type]
  }
}
