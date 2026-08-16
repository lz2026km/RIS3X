/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 6B (report-qc-v2) - 报告质控 V2: 多维智能评分 (F4)
 *
 * 孤儿模块 (无新增 DB 表, DB 不可用自动回退确定性种子, 可无 DB 启动):
 *   1. 多维评分: 5 维度 (完整性/规范性/准确性/可读性/及时性), 每维 3-4 个子项打分
 *      → 总分 0-100 + 等级 A/B/C/D + 缺陷自动识别 (与 W6A 规则引擎同风格的关键字规则, 独立实现)
 *   2. 质控任务流: 任务创建 / 分配 / 一级复核 / 二次复核 / 关闭 + 历史记录
 *   3. 二次复核: 双人复核记录 (复核人/意见/通过/退回)
 *   4. 质控统计: 缺陷分布 (维度 × 严重度) + 月度趋势 + 等级分布
 *
 * 所有评分与种子均为确定性 (同输入恒同输出), 便于测试复现。
 */
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { currentTenantId } from '../../common/tenant/tenant-utils'

// ================= 类型定义 =================

export type QcDimensionKey = 'completeness' | 'normativity' | 'accuracy' | 'readability' | 'timeliness'
export type QcGrade = 'A' | 'B' | 'C' | 'D'
export type DefectSeverity = 'high' | 'medium' | 'low'
export type QcTaskStatus = 'pending' | 'in_progress' | 'reviewing' | 'closed'
export type ReviewOpinion = 'pass' | 'return'

export interface QcSubItemMeta {
  key: string
  name: string
  max: number
}

export interface QcDimensionMeta {
  key: QcDimensionKey
  label: string
  labelEn: string
  max: number
  color: string
  subItems: QcSubItemMeta[]
}

export interface QcDefect {
  code: string
  dimension: QcDimensionKey
  dimensionLabel: string
  name: string
  severity: DefectSeverity
  message: string
  evidence: string
}

export interface QcSubItemScore {
  key: string
  name: string
  score: number
  max: number
  deducted: boolean
}

export interface QcDimensionScore {
  key: QcDimensionKey
  label: string
  score: number
  max: number
  subItems: QcSubItemScore[]
  issues: string[]
}

export interface QcScoreResult {
  id: string
  reportId: string
  modality: string
  totalScore: number
  grade: QcGrade
  modelVersion: string
  evaluatedAt: string
  dimensions: QcDimensionScore[]
  defects: QcDefect[]
  suggestions: string[]
}

export interface ScoreReportInput {
  reportId: string
  findings?: string
  diagnosis?: string
  conclusion?: string
  impression?: string
  recommendations?: string
  modality?: string
  radsCategory?: string
  isCritical?: boolean
  structuredCompletion?: number
  reportTimeMinutes?: number
  techParams?: string
}

export interface QcReview {
  id: string
  round: 1 | 2
  reviewer: string
  opinion: ReviewOpinion
  comment: string
  at: string
}

export interface QcTaskHistoryEntry {
  at: string
  action: string
  actor: string
  note: string
}

export interface QcTask {
  id: string
  reportId: string
  patientName: string
  modality: string
  scoreId?: string
  totalScore?: number
  grade?: QcGrade
  status: QcTaskStatus
  assignee?: string
  assigneeName?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  reviews: QcReview[]
  history: QcTaskHistoryEntry[]
  defects: QcDefect[]
}

export interface QcRecord {
  id: string
  reportId: string
  patientName: string
  modality: string
  totalScore?: number
  grade?: QcGrade
  status: QcTaskStatus
  assigneeName?: string
  defectCount: number
  reviewedRounds: number
  createdAt: string
  closedAt?: string
}

export interface DefectBucket {
  key: string
  label: string
  count: number
  high: number
  medium: number
  low: number
}

export interface MonthlyTrendItem {
  month: string
  count: number
  avgScore: number
}

export interface QcStatsData {
  totalTasks: number
  avgScore: number
  passRate: number
  gradeDistribution: Array<{ grade: QcGrade; count: number }>
  taskByStatus: Record<QcTaskStatus, number>
  defectDistribution: DefectBucket[]
  severityDistribution: Array<{ severity: DefectSeverity; count: number }>
  monthlyTrend: MonthlyTrendItem[]
}

// ================= 维度与规则定义 (确定性规则引擎, 与 W6A 风格对齐) =================

export const GRADE_THRESHOLDS: Array<{ grade: QcGrade; min: number }> = [
  { grade: 'A', min: 90 },
  { grade: 'B', min: 75 },
  { grade: 'C', min: 60 },
  { grade: 'D', min: 0 },
]

const DIMENSION_META: QcDimensionMeta[] = [
  {
    key: 'completeness',
    label: '完整性',
    labelEn: 'Completeness',
    max: 20,
    color: '#3b82f6',
    subItems: [
      { key: 'structure', name: '结构字段齐全', max: 8 },
      { key: 'technical', name: '技术参数/对比剂', max: 4 },
      { key: 'conclusion', name: '诊断结论', max: 4 },
      { key: 'followup', name: '随访建议', max: 4 },
    ],
  },
  {
    key: 'normativity',
    label: '规范性',
    labelEn: 'Normativity',
    max: 20,
    color: '#8b5cf6',
    subItems: [
      { key: 'template', name: '模板段落规范', max: 6 },
      { key: 'terminology', name: '术语严谨', max: 6 },
      { key: 'format', name: '标点排版', max: 4 },
      { key: 'spelling', name: '错别字', max: 4 },
    ],
  },
  {
    key: 'accuracy',
    label: '准确性',
    labelEn: 'Accuracy',
    max: 20,
    color: '#10b981',
    subItems: [
      { key: 'modalityMatch', name: '模态部位匹配', max: 5 },
      { key: 'rads', name: '规范分级', max: 5 },
      { key: 'critical', name: '危急提示', max: 5 },
      { key: 'consistency', name: '所见结论一致', max: 5 },
    ],
  },
  {
    key: 'readability',
    label: '可读性',
    labelEn: 'Readability',
    max: 20,
    color: '#f59e0b',
    subItems: [
      { key: 'sentenceLength', name: '语句长度', max: 7 },
      { key: 'paragraph', name: '段落结构', max: 5 },
      { key: 'redundancy', name: '冗余表达', max: 4 },
      { key: 'punctuation', name: '标点密度', max: 4 },
    ],
  },
  {
    key: 'timeliness',
    label: '及时性',
    labelEn: 'Timeliness',
    max: 20,
    color: '#ef4444',
    subItems: [{ key: 'tat', name: '报告耗时', max: 20 }],
  },
]

const FUZZY_TERMS = ['大概', '好像', '也许', '或许', '差不多']
const TYPO_TERMS = ['右测', '左测', '影象', '正状', '急疹', '肿癌', '脏层', '滲出']
const TECHNICAL_TERMS = ['造影剂', '对比剂', '增强', '剂量', '流速', 'kV', 'mAs', '层厚', '序列', '反转角']
const FOLLOWUP_TERMS = ['建议', '随访', '复查', '进一步']
const HEADINGS = ['影像所见', '诊断意见', '诊断', '结论', '描述']
const RADS_TERMS = ['BI-RADS', 'PI-RADS', 'LI-RADS', 'TI-RADS', '分类', '分级']
const CRITICAL_TERMS = ['危急', '立即', '急诊', '紧急', '马上', '尽快']

const MODALITY_TERMS: Record<string, string[]> = {
  CT: ['CT', '平扫', '增强', '冠脉', '腰椎', '腹部', '胸部', '头颅'],
  MR: ['MR', 'MRI', 'T1', 'T2', 'DWI', '压脂', '矢状位', '冠状位'],
  DR: ['X线', 'DR', '正位', '侧位', '平片', '卧位'],
  MG: ['钼靶', 'MG', '乳腺'],
  US: ['超声', 'US', '彩超'],
}

const SEVERITY_OF_RATE = (lossRate: number): DefectSeverity =>
  lossRate >= 0.75 ? 'high' : lossRate >= 0.4 ? 'medium' : 'low'

function hasAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t))
}

function countOccurrences(text: string, terms: string[]): number {
  return terms.reduce((acc, t) => acc + text.split(t).length - 1, 0)
}

function avgSentenceLength(text: string): number {
  if (!text.trim()) return 0
  const parts = text.split(/[。；!?！？\n]/).filter((p) => p.trim().length > 0)
  if (parts.length === 0) return text.length
  return parts.reduce((a, p) => a + p.length, 0) / parts.length
}

function punctuationRatio(text: string): number {
  if (!text) return 0
  const puncts = text.match(/[。，、；：！？%]/g)?.length ?? 0
  return puncts / text.length
}

function repeatedPhrasePenalty(text: string): number {
  if (text.length < 12) return 0
  const seen = new Map<string, number>()
  for (let i = 0; i + 4 <= text.length; i++) {
    const gram = text.slice(i, i + 4)
    if (/[，。、；]/.test(gram)) continue
    seen.set(gram, (seen.get(gram) ?? 0) + 1)
  }
  let penalty = 0
  for (const count of seen.values()) {
    if (count >= 5) return 4
    if (count >= 3) penalty = Math.max(penalty, 2)
  }
  return penalty
}

function gradeOf(total: number): QcGrade {
  for (const t of GRADE_THRESHOLDS) {
    if (total >= t.min) return t.grade
  }
  return 'D'
}

// ================= 种子数据 =================

const SEED_REPORTS: Array<{ reportId: string; patientName: string; modality: string; input: ScoreReportInput }> = [
  {
    reportId: 'RPT-20260801001',
    patientName: '李明',
    modality: 'CT',
    input: {
      reportId: 'RPT-20260801001',
      modality: 'CT',
      findings: '胸部CT平扫: 双肺纹理清晰, 未见实变影。主动脉未见增宽, 纵隔居中, 心影不大。双侧胸膜未见增厚, 未见胸腔积液。',
      diagnosis: '双肺及纵隔未见明确异常。',
      conclusion: '双肺及纵隔未见明确异常, 建议定期随访复查。',
      recommendations: '建议 1 年后随访复查胸部 CT。',
      radsCategory: '',
      isCritical: false,
      structuredCompletion: 95,
      reportTimeMinutes: 42,
      techParams: 'CT 平扫, 层厚 5mm',
    },
  },
  {
    reportId: 'RPT-20260801002',
    patientName: '张伟',
    modality: 'MR',
    input: {
      reportId: 'RPT-20260801002',
      modality: 'MR',
      findings: '头颅MR平扫: 左侧基底节区见斑片状长T1长T2信号灶, DWI 未见明显弥散受限。脑室系统无扩张, 中线结构居中。',
      diagnosis: '左侧基底节区缺血灶可能性大, 建议结合临床。',
      conclusion: '左侧基底节区缺血灶, 建议随访复查。',
      recommendations: '建议 3 个月后复查头颅 MR, 随访观察变化。',
      radsCategory: '',
      isCritical: false,
      structuredCompletion: 88,
      reportTimeMinutes: 65,
      techParams: 'MR 平扫 T1/T2/DWI 序列',
    },
  },
  {
    reportId: 'RPT-20260801003',
    patientName: '赵敏',
    modality: 'CT',
    input: {
      reportId: 'RPT-20260801003',
      modality: 'CT',
      findings: '胸部CTA: 升主动脉增宽约 4.8cm, 可见内膜片影, 真假双腔形成。',
      diagnosis: '主动脉夹层可能, 需紧急处理。',
      conclusion: '升主动脉夹层可能, 建议立即心胸外科会诊, 急诊处理。',
      recommendations: '立即通知临床, 急诊处理, 严格控制血压。',
      radsCategory: '',
      isCritical: true,
      structuredCompletion: 82,
      reportTimeMinutes: 25,
      techParams: 'CTA 增强, 对比剂 60ml',
    },
  },
  {
    reportId: 'RPT-20260801004',
    patientName: '王芳',
    modality: 'MG',
    input: {
      reportId: 'RPT-20260801004',
      modality: 'MG',
      findings: '左乳外上象限见不规则肿块, 边缘毛刺, 大小约 2.3cm。',
      diagnosis: '左乳占位, BI-RADS 5 类。',
      conclusion: '左乳占位, BI-RADS 5 类, 高度怀疑恶性。',
      recommendations: '建议穿刺活检明确病理, 尽早手术治疗。',
      radsCategory: 'BI-RADS 5',
      isCritical: false,
      structuredCompletion: 90,
      reportTimeMinutes: 35,
      techParams: '',
    },
  },
  {
    reportId: 'RPT-20260801005',
    patientName: '陈杰',
    modality: 'CT',
    input: {
      reportId: 'RPT-20260801005',
      modality: 'CT',
      findings: '腹部CT: 肝右叶见低密度灶, 大小约 3.5cm, 增强扫描动脉期明显强化, 静脉期减退。',
      diagnosis: '肝右叶占位, 考虑血管瘤可能, 建议结合增强检查。',
      conclusion: '肝右叶占位性病变。',
      recommendations: '建议进一步 MRI 增强检查明确性质。',
      radsCategory: 'LI-RADS 4',
      isCritical: false,
      structuredCompletion: 70,
      reportTimeMinutes: 130,
      techParams: '增强 CT, 对比剂 80ml',
    },
  },
  {
    reportId: 'RPT-20260801006',
    patientName: '孙丽',
    modality: 'DR',
    input: {
      reportId: 'RPT-20260801006',
      modality: 'DR',
      findings: '胸部正位片: 右肺中野见片状密度增高影, 边缘模糊。',
      diagnosis: '',
      conclusion: '',
      recommendations: '',
      radsCategory: '',
      isCritical: false,
      structuredCompletion: 55,
      reportTimeMinutes: 200,
      techParams: '',
    },
  },
]

const SEED_TASK_DATES = [
  { day: '2026-05-12', offset: 0 },
  { day: '2026-05-28', offset: 1 },
  { day: '2026-06-10', offset: 2 },
  { day: '2026-06-24', offset: 3 },
  { day: '2026-07-08', offset: 4 },
  { day: '2026-07-22', offset: 5 },
  { day: '2026-08-05', offset: 0 },
  { day: '2026-08-14', offset: 1 },
]

const SEED_QC_REVIEWERS = [
  { id: 'u-qc1', name: '张质控' },
  { id: 'u-qc2', name: '李质控' },
  { id: 'u-qc3', name: '王主任' },
]

// ================= 服务 =================

@Injectable()
export class ReportQcV2Service {
  private readonly logger = new Logger(ReportQcV2Service.name)
  private tasks: QcTask[] = []
  private scores: QcScoreResult[] = []
  private scoreSeq = 0
  private taskSeq = 0
  private reviewSeq = 0

  constructor(private readonly prisma: PrismaService) {
    this.seed()
  }

  private nextScoreId(reportId: string): string {
    this.scoreSeq += 1
    return `QS-${reportId}-${this.scoreSeq}`
  }

  private nextTaskId(): string {
    this.taskSeq += 1
    return `TQ-${this.taskSeq}`
  }

  private nextReviewId(): string {
    this.reviewSeq += 1
    return `RV-${this.reviewSeq}`
  }

  private iso(day: string, hour = 10): string {
    return new Date(`${day}T${String(hour).padStart(2, '0')}:00:00Z`).toISOString()
  }

  private seed(): void {
    SEED_REPORTS.forEach((rep, i) => {
      const score = this.scoreReportInternal(rep.input, this.nextScoreId(rep.reportId))
      this.scores.push(score)
      const date = SEED_TASK_DATES[i]!
      const status: QcTaskStatus = i < 2 ? 'closed' : i < 4 ? 'reviewing' : i < 6 ? 'in_progress' : 'pending'
      const closed = status === 'closed' ? date.day : undefined
      const task: QcTask = {
        id: this.nextTaskId(),
        reportId: rep.reportId,
        patientName: rep.patientName,
        modality: rep.modality,
        scoreId: score.id,
        totalScore: score.totalScore,
        grade: score.grade,
        status,
        assignee: 'u-102',
        assigneeName: '王质控员',
        createdAt: this.iso(date.day, 9 + date.offset),
        updatedAt: this.iso(date.day, 14),
        closedAt: closed ? this.iso(closed, 16) : undefined,
        reviews: [],
        history: [
          { at: this.iso(date.day, 9 + date.offset), action: 'created', actor: '系统', note: `质控任务创建 (${score.id})` },
          { at: this.iso(date.day, 10), action: 'assigned', actor: '质控组长', note: '指派给 王质控员' },
        ],
        defects: score.defects,
      }
      if (status === 'reviewing') {
        task.reviews.push({
          id: this.nextReviewId(),
          round: 1,
          reviewer: SEED_QC_REVIEWERS[0]!.name,
          opinion: 'pass',
          comment: '报告结构完整, 结论规范, 一级复核通过。',
          at: this.iso(date.day, 13),
        })
        task.history.push({ at: this.iso(date.day, 13), action: 'reviewed', actor: SEED_QC_REVIEWERS[0]!.name, note: '一级复核通过, 待二次复核' })
      }
      if (status === 'closed') {
        task.reviews.push({
          id: this.nextReviewId(),
          round: 1,
          reviewer: SEED_QC_REVIEWERS[0]!.name,
          opinion: 'pass',
          comment: '一级复核通过。',
          at: this.iso(date.day, 13),
        })
        task.reviews.push({
          id: this.nextReviewId(),
          round: 2,
          reviewer: SEED_QC_REVIEWERS[2]!.name,
          opinion: 'pass',
          comment: '双人复核一致通过, 质控闭环。',
          at: this.iso(date.day, 15),
        })
        task.history.push(
          { at: this.iso(date.day, 13), action: 'reviewed', actor: SEED_QC_REVIEWERS[0]!.name, note: '一级复核通过' },
          { at: this.iso(date.day, 15), action: 'second_reviewed', actor: SEED_QC_REVIEWERS[2]!.name, note: '二次复核通过, 任务关闭' },
          { at: this.iso(date.day, 16), action: 'closed', actor: SEED_QC_REVIEWERS[2]!.name, note: '质控任务关闭' },
        )
      }
      this.tasks.push(task)
    })
  }

  // ================= 多维评分 =================

  getDimensions(): QcDimensionMeta[] {
    return DIMENSION_META.map((d) => ({ ...d, subItems: d.subItems.map((s) => ({ ...s })) }))
  }

  /** 子项检查 → { score, issue? } */
  private checkSubItem(key: string, text: string, input: ScoreReportInput): { score: number; issue?: string } {
    const findings = input.findings ?? ''
    const diagnosis = input.diagnosis ?? ''
    const conclusion = input.conclusion ?? ''
    const recommendations = input.recommendations ?? ''
    const allText = [findings, diagnosis, conclusion, recommendations].join(' ')
    switch (key) {
      case 'structure': {
        let score = 0
        if (findings.trim().length >= 20) score += 2
        if (diagnosis.trim().length >= 10) score += 2
        if (conclusion.trim().length >= 5) score += 2
        if ((input.impression ?? '').trim().length >= 5 || recommendations.trim().length >= 5) score += 2
        return score === 8 ? { score } : { score, issue: '影像所见/诊断/结论等结构字段不完整' }
      }
      case 'technical': {
        const source = `${findings} ${input.techParams ?? ''}`
        const hits = countOccurrences(source, TECHNICAL_TERMS)
        if (hits >= 1) return { score: 4 }
        return { score: 0, issue: '缺少技术参数或对比剂描述' }
      }
      case 'conclusion': {
        if (conclusion.trim().length >= 10) return { score: 4 }
        if (conclusion.trim().length > 0) return { score: 2, issue: '诊断结论过于简短' }
        return { score: 0, issue: '缺少诊断结论' }
      }
      case 'followup': {
        if (recommendations.trim().length >= 8 || hasAny(recommendations, FOLLOWUP_TERMS)) return { score: 4 }
        if (recommendations.trim().length > 0) return { score: 2, issue: '随访建议不明确' }
        return { score: 0, issue: '缺少随访建议' }
      }
      case 'template': {
        let score = 0
        for (const h of HEADINGS) {
          if (allText.includes(h)) score += 2
        }
        if (allText.includes('建议') || allText.includes('随访')) score += 2
        return score >= 6 ? { score: 6 } : { score, issue: '报告未按标准模板段落书写' }
      }
      case 'terminology': {
        const hits = countOccurrences(allText, FUZZY_TERMS)
        const score = Math.max(0, 6 - hits * 2)
        return score === 6 ? { score } : { score, issue: `存在模糊表述 ${hits} 处 (${FUZZY_TERMS.slice(0, 3).join('/')}等)` }
      }
      case 'format': {
        const dupPunct = (allText.match(/。。|，，|、、|；；/g) ?? []).length
        const score = Math.max(0, 4 - dupPunct * 2)
        return score === 4 ? { score } : { score, issue: '存在重复标点或排版问题' }
      }
      case 'spelling': {
        const hits = countOccurrences(allText, TYPO_TERMS)
        const score = Math.max(0, 4 - hits * 2)
        return score === 4 ? { score } : { score, issue: `检出疑似错别字 ${hits} 处` }
      }
      case 'modalityMatch': {
        const modality = (input.modality ?? '').toUpperCase() || 'CT'
        const terms = MODALITY_TERMS[modality] ?? MODALITY_TERMS['CT']!
        if (hasAny(text, terms)) return { score: 5 }
        return { score: 0, issue: `报告内容与检查模态 ${modality} 不匹配` }
      }
      case 'rads': {
        if ((input.radsCategory ?? '').trim().length > 0) return { score: 5 }
        if (hasAny(allText, RADS_TERMS)) return { score: 3, issue: '建议补充规范分级字段' }
        return { score: 0, issue: '缺少规范分级 (RADS) 表述' }
      }
      case 'critical': {
        if (input.isCritical) {
          if (hasAny(allText, CRITICAL_TERMS)) return { score: 5 }
          return { score: 0, issue: '危急值报告缺少紧急提示措辞, 属高危缺陷' }
        }
        return { score: 5 }
      }
      case 'consistency': {
        const hasF = findings.trim().length > 0
        const hasC = conclusion.trim().length > 0
        if (hasF && hasC) return { score: 5 }
        if (!hasF && hasC) return { score: 2, issue: '影像所见为空, 结论缺少依据' }
        return { score: 0, issue: '影像所见与诊断结论不完整' }
      }
      case 'sentenceLength': {
        const avg = avgSentenceLength(allText)
        if (avg === 0) return { score: 1, issue: '报告内容为空' }
        if (avg <= 80) return { score: 7 }
        if (avg <= 120) return { score: 5, issue: '部分语句过长' }
        if (avg <= 180) return { score: 3, issue: '语句平均过长, 影响阅读' }
        return { score: 1, issue: '语句冗长, 可读性差' }
      }
      case 'paragraph': {
        const sentenceCount = (allText.match(/[。；!?！？]/g) ?? []).length
        if (sentenceCount >= 3) return { score: 5 }
        if (sentenceCount >= 2) return { score: 3, issue: '段落结构简单' }
        return { score: 1, issue: '缺少段落结构' }
      }
      case 'redundancy': {
        const penalty = repeatedPhrasePenalty(allText)
        const score = Math.max(0, 4 - penalty)
        return score === 4 ? { score } : { score, issue: '存在重复表达片段' }
      }
      case 'punctuation': {
        const ratio = punctuationRatio(allText)
        if (ratio === 0) return { score: 0, issue: '缺少标点符号' }
        if (ratio >= 0.01 && ratio <= 0.16) return { score: 4 }
        return { score: 2, issue: '标点密度异常' }
      }
      case 'tat': {
        const minutes = input.reportTimeMinutes
        if (minutes === undefined) return { score: 13, issue: '未填报报告耗时, 按中等时长计' }
        if (minutes <= 30) return { score: 20 }
        if (minutes <= 60) return { score: 17, issue: '报告耗时偏长' }
        if (minutes <= 120) return { score: 13, issue: '报告耗时较长' }
        if (minutes <= 240) return { score: 9, issue: '报告耗时超标' }
        return { score: 4, issue: '报告耗时严重超标' }
      }
      default:
        return { score: 0, issue: '未知检查项' }
    }
  }

  private scoreReportInternal(input: ScoreReportInput, id: string): QcScoreResult {
    const allText = [input.findings ?? '', input.diagnosis ?? '', input.conclusion ?? '', input.impression ?? '', input.recommendations ?? ''].join(' ')
    const dimensions: QcDimensionScore[] = []
    const defects: QcDefect[] = []
    let totalScore = 0

    for (const dim of DIMENSION_META) {
      const subScores: QcSubItemScore[] = []
      const issues: string[] = []
      for (const sub of dim.subItems) {
        const check = this.checkSubItem(sub.key, allText, input)
        const score = Math.max(0, Math.min(sub.max, check.score))
        subScores.push({ key: sub.key, name: sub.name, score, max: sub.max, deducted: score < sub.max })
        if (check.issue && score < sub.max) {
          issues.push(check.issue)
          const lossRate = (sub.max - score) / sub.max
          defects.push({
            code: `QC-${dim.key.toUpperCase()}-${sub.key.toUpperCase()}`,
            dimension: dim.key,
            dimensionLabel: dim.label,
            name: sub.name,
            severity: SEVERITY_OF_RATE(lossRate),
            message: check.issue,
            evidence: input.reportId,
          })
        }
      }
      const dimScore = subScores.reduce((a, s) => a + s.score, 0)
      totalScore += dimScore
      dimensions.push({
        key: dim.key,
        label: dim.label,
        score: Math.min(dim.max, dimScore),
        max: dim.max,
        subItems: subScores,
        issues,
      })
    }

    const grade = gradeOf(totalScore)
    const suggestions: string[] = defects.slice(0, 4).map((d) => `[${d.dimensionLabel}] ${d.message}`)
    if (grade === 'A') suggestions.push('整体质量优秀, 保持当前书写规范。')
    else if (grade === 'B') suggestions.push('总体良好, 关注缺陷项改进。')
    else if (grade === 'C') suggestions.push('存在明显缺陷, 建议对照标准模板修改后复评。')
    else suggestions.push('质量不达标, 建议退回重写后重新评分。')

    return {
      id,
      reportId: input.reportId,
      modality: input.modality ?? '',
      totalScore,
      grade,
      modelVersion: 'qc-v2.1',
      evaluatedAt: new Date().toISOString(),
      dimensions,
      defects,
      suggestions,
    }
  }

  /** POST /report-qc-v2/score — 报告多维评分 */
  async scoreReport(input: ScoreReportInput): Promise<QcScoreResult> {
    if (!input.reportId?.trim()) throw new BadRequestException('reportId 不能为空')
    const result = this.scoreReportInternal(input, this.nextScoreId(input.reportId.trim()))
    this.scores.unshift(result)
    await this.recordAudit('QC_SCORE', result.id, {
      reportId: input.reportId,
      totalScore: result.totalScore,
      grade: result.grade,
      defects: result.defects.length,
    })
    return result
  }

  /** GET /report-qc-v2/scores — 最近评分记录 (DB 派生 auditLog 或 seed 回退) */
  async listScores(): Promise<QcScoreResult[]> {
    const derived = await this.deriveScoresFromAudit()
    return derived.length > 0 ? derived : this.scores.map((s) => ({ ...s, dimensions: s.dimensions.map((d) => ({ ...d, subItems: [...d.subItems] })), defects: [...s.defects] }))
  }

  /** GET /report-qc-v2/scores/:id */
  async getScore(id: string): Promise<QcScoreResult> {
    const hit = this.scores.find((s) => s.id === id)
    if (hit) return hit
    const derived = await this.deriveScoresFromAudit()
    const found = derived.find((s) => s.id === id)
    if (found) return found
    throw new NotFoundException(`评分记录 ${id} 不存在`)
  }

  // ================= 质控任务流 =================

  /** POST /report-qc-v2/tasks — 创建质控任务 (可携带报告内容直接评分) */
  async createTask(body: {
    reportId: string
    patientName?: string
    modality?: string
    assignee?: string
    assigneeName?: string
    scoreInput?: ScoreReportInput
  }): Promise<QcTask> {
    if (!body.reportId?.trim()) throw new BadRequestException('reportId 不能为空')
    const now = new Date().toISOString()
    let score: QcScoreResult | null = null
    if (body.scoreInput) {
      score = this.scoreReportInternal({ ...body.scoreInput, reportId: body.reportId }, this.nextScoreId(body.reportId))
      this.scores.unshift(score)
    }
    const task: QcTask = {
      id: this.nextTaskId(),
      reportId: body.reportId.trim(),
      patientName: body.patientName ?? '未知患者',
      modality: body.modality ?? (score?.modality ?? 'CT'),
      scoreId: score?.id,
      totalScore: score?.totalScore,
      grade: score?.grade,
      status: 'pending',
      assignee: body.assignee,
      assigneeName: body.assigneeName,
      createdAt: now,
      updatedAt: now,
      reviews: [],
      history: [{ at: now, action: 'created', actor: '系统', note: score ? `质控任务创建, 自动评分 ${score.totalScore} 分 (${score.grade})` : '质控任务创建' }],
      defects: score?.defects ?? [],
    }
    this.tasks.unshift(task)
    await this.recordAudit('QC_TASK_CREATE', task.id, { reportId: task.reportId })
    return this.cloneTask(task)
  }

  /** GET /report-qc-v2/tasks — 任务列表 (status 过滤) */
  async listTasks(params: { status?: string } = {}): Promise<QcTask[]> {
    let tasks = this.tasks.map((t) => this.cloneTask(t))
    if (params.status) tasks = tasks.filter((t) => t.status === params.status)
    return tasks
  }

  /** GET /report-qc-v2/tasks/:id */
  async getTask(id: string): Promise<QcTask> {
    return this.cloneTask(this.findTask(id))
  }

  /** POST /report-qc-v2/tasks/:id/assign — 分配 */
  async assignTask(id: string, body: { assignee: string; assigneeName?: string }): Promise<QcTask> {
    const task = this.findTask(id)
    if (task.status === 'closed') throw new BadRequestException('已关闭任务不能分配')
    task.assignee = body.assignee.trim()
    task.assigneeName = body.assigneeName?.trim() || body.assignee.trim()
    task.status = 'in_progress'
    task.updatedAt = new Date().toISOString()
    task.history.push({ at: task.updatedAt, action: 'assigned', actor: '当前用户', note: `指派给 ${task.assigneeName}` })
    await this.recordAudit('QC_TASK_ASSIGN', task.id, { assignee: task.assigneeName })
    return this.cloneTask(task)
  }

  /** POST /report-qc-v2/tasks/:id/review — 一级复核 (通过 → 待二次复核; 退回 → 返回质控) */
  async reviewTask(id: string, body: { reviewer: string; opinion: ReviewOpinion; comment?: string }): Promise<QcTask> {
    const task = this.findTask(id)
    if (task.status !== 'in_progress') throw new BadRequestException(`当前状态 ${task.status} 不可一级复核`)
    const now = new Date().toISOString()
    task.reviews.push({ id: this.nextReviewId(), round: 1, reviewer: body.reviewer.trim(), opinion: body.opinion, comment: body.comment?.trim() ?? '', at: now })
    if (body.opinion === 'pass') {
      task.status = 'reviewing'
      task.history.push({ at: now, action: 'reviewed', actor: body.reviewer.trim(), note: '一级复核通过, 进入二次复核' })
    } else {
      task.status = 'in_progress'
      task.history.push({ at: now, action: 'reviewed', actor: body.reviewer.trim(), note: `一级复核退回: ${body.comment ?? '需修改'}` })
    }
    task.updatedAt = now
    await this.recordAudit('QC_TASK_REVIEW', task.id, { reviewer: body.reviewer, opinion: body.opinion })
    return this.cloneTask(task)
  }

  /** POST /report-qc-v2/tasks/:id/second-review — 二次复核 (双人复核; 通过 → 关闭; 退回 → 返回质控) */
  async secondReviewTask(id: string, body: { reviewer: string; opinion: ReviewOpinion; comment?: string }): Promise<QcTask> {
    const task = this.findTask(id)
    if (task.status !== 'reviewing') throw new BadRequestException(`当前状态 ${task.status} 不可二次复核`)
    const now = new Date().toISOString()
    task.reviews.push({ id: this.nextReviewId(), round: 2, reviewer: body.reviewer.trim(), opinion: body.opinion, comment: body.comment?.trim() ?? '', at: now })
    if (body.opinion === 'pass') {
      task.status = 'closed'
      task.closedAt = now
      task.history.push({ at: now, action: 'second_reviewed', actor: body.reviewer.trim(), note: '二次复核通过, 质控闭环' })
      task.history.push({ at: now, action: 'closed', actor: body.reviewer.trim(), note: '质控任务关闭' })
    } else {
      task.status = 'in_progress'
      task.history.push({ at: now, action: 'second_reviewed', actor: body.reviewer.trim(), note: `二次复核退回: ${body.comment ?? '需修改'}` })
    }
    task.updatedAt = now
    await this.recordAudit('QC_TASK_SECOND_REVIEW', task.id, { reviewer: body.reviewer, opinion: body.opinion })
    return this.cloneTask(task)
  }

  /** POST /report-qc-v2/tasks/:id/close — 关闭任务 */
  async closeTask(id: string, body: { comment?: string } = {}): Promise<QcTask> {
    const task = this.findTask(id)
    if (task.status === 'closed') throw new BadRequestException('任务已关闭')
    const now = new Date().toISOString()
    task.status = 'closed'
    task.closedAt = now
    task.updatedAt = now
    task.history.push({ at: now, action: 'closed', actor: '当前用户', note: body.comment?.trim() || '质控任务关闭' })
    await this.recordAudit('QC_TASK_CLOSE', task.id, { comment: body.comment })
    return this.cloneTask(task)
  }

  /** GET /report-qc-v2/tasks/:id/reviews — 复核记录 (双人复核历史) */
  async listReviews(id: string): Promise<QcReview[]> {
    return this.findTask(id).reviews.map((r) => ({ ...r }))
  }

  // ================= 质控记录历史 =================

  /** GET /report-qc-v2/records — 质控记录历史 */
  async listRecords(): Promise<QcRecord[]> {
    return this.tasks.map((t) => ({
      id: t.id,
      reportId: t.reportId,
      patientName: t.patientName,
      modality: t.modality,
      totalScore: t.totalScore,
      grade: t.grade,
      status: t.status,
      assigneeName: t.assigneeName,
      defectCount: t.defects.length,
      reviewedRounds: t.reviews.length,
      createdAt: t.createdAt,
      closedAt: t.closedAt,
    }))
  }

  // ================= 质控统计 =================

  /** GET /report-qc-v2/stats — 缺陷分布 / 月度趋势 / 等级分布 */
  async getStats(): Promise<QcStatsData> {
    const tasks = this.tasks
    const withScore = tasks.filter((t) => t.totalScore !== undefined)
    const avgScore = withScore.length > 0 ? Math.round((withScore.reduce((a, t) => a + (t.totalScore ?? 0), 0) / withScore.length) * 10) / 10 : 0
    const passCount = withScore.filter((t) => (t.grade ?? 'D') === 'A' || (t.grade ?? 'D') === 'B').length

    const gradeMap = new Map<QcGrade, number>()
    const statusMap: Record<QcTaskStatus, number> = { pending: 0, in_progress: 0, reviewing: 0, closed: 0 }
    const defectByDim = new Map<QcDimensionKey, { high: number; medium: number; low: number; count: number }>()
    const severityMap: Record<DefectSeverity, number> = { high: 0, medium: 0, low: 0 }
    const monthMap = new Map<string, { count: number; sum: number }>()

    for (const t of tasks) {
      statusMap[t.status] = (statusMap[t.status] ?? 0) + 1
      if (t.grade) gradeMap.set(t.grade, (gradeMap.get(t.grade) ?? 0) + 1)
      const month = t.createdAt.slice(0, 7)
      const entry = monthMap.get(month) ?? { count: 0, sum: 0 }
      entry.count += 1
      entry.sum += t.totalScore ?? 0
      monthMap.set(month, entry)
      for (const d of t.defects) {
        const dim = defectByDim.get(d.dimension) ?? { high: 0, medium: 0, low: 0, count: 0 }
        dim.count += 1
        dim[d.severity] += 1
        defectByDim.set(d.dimension, dim)
        severityMap[d.severity] += 1
      }
    }

    const defectDistribution: DefectBucket[] = DIMENSION_META.map((d) => {
      const dim = defectByDim.get(d.key) ?? { high: 0, medium: 0, low: 0, count: 0 }
      return { key: d.key, label: d.label, count: dim.count, high: dim.high, medium: dim.medium, low: dim.low }
    }).sort((a, b) => b.count - a.count)

    const monthlyTrend: MonthlyTrendItem[] = [...monthMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([month, e]) => ({ month, count: e.count, avgScore: e.count > 0 ? Math.round((e.sum / e.count) * 10) / 10 : 0 }))

    return {
      totalTasks: tasks.length,
      avgScore,
      passRate: withScore.length > 0 ? Math.round((passCount / withScore.length) * 1000) / 10 : 0,
      gradeDistribution: (['A', 'B', 'C', 'D'] as QcGrade[]).map((g) => ({ grade: g, count: gradeMap.get(g) ?? 0 })),
      taskByStatus: statusMap,
      defectDistribution,
      severityDistribution: (['high', 'medium', 'low'] as DefectSeverity[]).map((s) => ({ severity: s, count: severityMap[s] })),
      monthlyTrend,
    }
  }

  // ================= 内部工具 =================

  private findTask(id: string): QcTask {
    const task = this.tasks.find((t) => t.id === id)
    if (!task) throw new NotFoundException(`质控任务 ${id} 不存在`)
    return task
  }

  private cloneTask(t: QcTask): QcTask {
    return {
      ...t,
      reviews: t.reviews.map((r) => ({ ...r })),
      history: t.history.map((h) => ({ ...h })),
      defects: t.defects.map((d) => ({ ...d })),
    }
  }

  /** auditLog 记录 (DB 不可用时静默跳过) */
  private async recordAudit(action: string, resourceId: string, detail: unknown): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: { action, resource: 'report-qc-v2', resourceId, detail: detail as any, tenantId: currentTenantId() },
      })
    } catch (err) {
      this.logger.debug(`[ReportQcV2] audit skipped: ${(err as Error).message}`)
    }
  }

  /** 评分记录 DB 派生: auditLog('report-qc-v2' + QC_SCORE) → 汇总评分; 失败/空 → 内存 */
  private async deriveScoresFromAudit(): Promise<QcScoreResult[]> {
    try {
      const rows = await this.prisma.auditLog.findMany({
        where: { resource: 'report-qc-v2', action: 'QC_SCORE' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
      if (rows.length === 0) return []
      return rows.map((r) => {
        const detail = (r.detail ?? {}) as Record<string, unknown>
        const total = Number(detail.totalScore ?? 0)
        return {
          id: r.resourceId ?? r.id,
          reportId: String(detail.reportId ?? r.resourceId ?? r.id),
          modality: '',
          totalScore: total,
          grade: gradeOf(total),
          modelVersion: 'qc-v2.1',
          evaluatedAt: r.createdAt.toISOString(),
          dimensions: this.getDimensions().map((d) => ({ ...d, score: 0, subItems: [], issues: [] })),
          defects: [],
          suggestions: [],
        }
      })
    } catch {
      return []
    }
  }
}
