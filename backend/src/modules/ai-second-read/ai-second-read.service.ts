/**
 * G005 放射RIS系统 v3.0.6.11-101 Wave 7C (ai-second-read) - AI 二次检出 V2 (F14)
 *
 * 孤儿模块 (纯内存 + seed 回退, 无 DB 依赖, 无 Prisma, 可无 DB 启动):
 *   1. 二次检出任务: 报告定稿前 AI 复查 — 漏诊风险 / 描述缺项 / 结论不一致
 *      → 确定性规则引擎 (关键字/结构特征统计, 同输入恒同输出, 无 Math.random)
 *   2. 检出结果: 风险项列表 (类别/严重度/建议) + 风险评分 (0-100) + 复查记录
 *   3. 与医生交互: 忽略 / 采纳 / 加入报告 (追加文本)
 *   4. 统计: 平均分 / 类别分布 / 严重度分布 / 已处理比例
 */
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'

// ================= 类型定义 =================

export type RiskCategory = 'missed_finding' | 'description_gap' | 'conclusion_inconsistency'
export type RiskSeverity = 'high' | 'medium' | 'low'
export type RiskItemStatus = 'open' | 'ignored' | 'adopted' | 'appended'
export type RiskLevel = 'low' | 'medium' | 'high'

export interface SecondReadRiskItem {
  id: string
  category: RiskCategory
  categoryLabel: string
  severity: RiskSeverity
  title: string
  description: string
  suggestion: string
  evidence: string
  status: RiskItemStatus
  handledBy?: string
  handledAt?: string
}

export interface SecondReadFeatureStats {
  textLength: number
  sectionCount: number
  sentenceCount: number
  findingTermCount: number
  technicalTermCount: number
  fuzzyTermCount: number
  criticalTermCount: number
}

export interface SecondReadResult {
  id: string
  reportId: string
  patientName: string
  modality: string
  riskScore: number
  riskLevel: RiskLevel
  riskItems: SecondReadRiskItem[]
  featureStats: SecondReadFeatureStats
  modelVersion: string
  status: 'completed'
  reviewedBy?: string
  reviewedAt?: string
  appendedText?: string
  appendedAt?: string
  createdAt: string
}

export interface SecondReadInput {
  reportId: string
  patientName?: string
  modality?: string
  findings?: string
  diagnosis?: string
  conclusion?: string
  recommendations?: string
}

export interface SecondReadStatsData {
  total: number
  avgRiskScore: number
  highRiskCount: number
  mediumRiskCount: number
  lowRiskCount: number
  openRiskItems: number
  handledRiskItems: number
  byCategory: Array<{ category: RiskCategory; label: string; count: number; open: number }>
  bySeverity: Array<{ severity: RiskSeverity; count: number }>
  appendedCount: number
}

// ================= 确定性规则定义 =================

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  missed_finding: '漏诊风险',
  description_gap: '描述缺项',
  conclusion_inconsistency: '结论不一致',
}

export const RISK_SEVERITY: Record<RiskCategory, RiskSeverity> = {
  missed_finding: 'high',
  description_gap: 'medium',
  conclusion_inconsistency: 'medium',
}

const SEVERITY_SCORE: Record<RiskSeverity, number> = { high: 25, medium: 10, low: 5 }

const CRITICAL_TERMS = ['夹层', '主动脉', '出血', '气胸', '骨折', '梗死', '栓塞', '占位', '肿瘤', '结节', '肿块', '积液']
const FINDING_VERBS = ['可见', '见', '显示', '发现', '检出', '呈', '位于', '内见']
const TECHNICAL_TERMS = ['平扫', '增强', '层厚', '序列', '对比剂', '造影剂', 'kV', 'mAs', 'T1', 'T2', 'DWI']
const FUZZY_TERMS = ['可能', '考虑', '疑似', '可疑', '待定', '待查', '不除外']
const SIZE_PATTERN = /\d+(\.\d+)?\s*(mm|cm|毫米|厘米)/
const LATERALITY_TERMS = ['左', '右', '双侧', '两侧']
const LESION_TERMS = ['结节', '肿块', '占位', '肿瘤', '病灶']
const FOLLOWUP_TERMS = ['建议', '随访', '复查', '进一步']
const SECTION_HEADINGS = ['影像所见', '所见', '诊断意见', '诊断', '结论', '意见']

function containsAny(text: string, terms: string[]): boolean {
  return terms.some((t) => text.includes(t))
}

function countOf(text: string, terms: string[]): number {
  return terms.reduce((acc, t) => acc + text.split(t).length - 1, 0)
}

function sentenceCountOf(text: string): number {
  const parts = text.split(/[。；!?！？\n]/).filter((p) => p.trim().length > 0)
  return parts.length
}

export function analyzeSecondReadText(input: SecondReadInput): {
  riskItems: Omit<SecondReadRiskItem, 'id' | 'status'>[]
  featureStats: SecondReadFeatureStats
} {
  const findings = (input.findings ?? '').trim()
  const diagnosis = (input.diagnosis ?? '').trim()
  const conclusion = (input.conclusion ?? '').trim()
  const recommendations = (input.recommendations ?? '').trim()
  const allText = [findings, diagnosis, conclusion, recommendations].join(' ')
  const findingsText = [findings, diagnosis].join(' ')

  const riskItems: Omit<SecondReadRiskItem, 'id' | 'status'>[] = []
  let seq = 0
  const push = (item: Omit<SecondReadRiskItem, 'id' | 'status'>): void => {
    riskItems.push(item)
    seq += 1
  }

  // ── 类别 1: 漏诊风险 (missed_finding) ─────────────────────────────────────
  const criticalInFindings = countOf(findingsText, CRITICAL_TERMS)
  const criticalInConclusion = countOf(conclusion, CRITICAL_TERMS)
  if (criticalInFindings > 0 && criticalInConclusion === 0) {
    push({
      category: 'missed_finding',
      categoryLabel: CATEGORY_LABEL.missed_finding,
      severity: 'high',
      title: '结论未提及关键阳性征象',
      description: `影像所见/诊断意见含 ${criticalInFindings} 处关键征象术语, 但结论中未复述, 存在漏报风险。`,
      suggestion: '核对影像所见中的关键阳性征象并在结论中逐一体现, 确认无遗漏。',
      evidence: input.reportId,
    })
  }
  if (criticalInConclusion > 0 && criticalInFindings === 0) {
    push({
      category: 'missed_finding',
      categoryLabel: CATEGORY_LABEL.missed_finding,
      severity: 'high',
      title: '结论征象缺少所见支撑',
      description: '结论提及关键阳性征象, 但影像所见/诊断意见中无对应描述, 依据缺失。',
      suggestion: '补充影像所见中的对应征象描述, 使结论有据可依。',
      evidence: input.reportId,
    })
  }
  if (findingsText.includes('未见异常') && criticalInConclusion > 0) {
    push({
      category: 'missed_finding',
      categoryLabel: CATEGORY_LABEL.missed_finding,
      severity: 'high',
      title: '所见与结论矛盾',
      description: '影像所见表述为未见异常, 但结论描述了阳性征象, 自相矛盾。',
      suggestion: '核实影像所见与结论的一致性, 修正其中错误表述。',
      evidence: input.reportId,
    })
  }

  // ── 类别 2: 描述缺项 (description_gap) ────────────────────────────────────
  if (findings.length < 20) {
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'high',
      title: '影像所见缺失或过短',
      description: '影像所见内容过短 (不足 20 字), 无法完整描述检查征象。',
      suggestion: '按标准模板补全影像所见段落, 描述检查范围与关键征象。',
      evidence: input.reportId,
    })
  }
  if (conclusion.length === 0) {
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'high',
      title: '诊断结论缺失',
      description: '报告缺少诊断结论段落, 定稿前必须补全。',
      suggestion: '撰写明确的诊断结论, 包含主要诊断及鉴别意见。',
      evidence: input.reportId,
    })
  } else if (conclusion.length < 10) {
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'medium',
      title: '诊断结论过于简短',
      description: '诊断结论不足 10 字, 信息量不足, 可能造成临床误读。',
      suggestion: '扩充结论表述, 明确诊断意见与依据。',
      evidence: input.reportId,
    })
  }
  if (recommendations.length === 0 && !containsAny(allText, FOLLOWUP_TERMS)) {
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'low',
      title: '缺少随访建议',
      description: '报告未提供随访/复查建议, 建议补充。',
      suggestion: '按病情补充随访周期或进一步检查建议。',
      evidence: input.reportId,
    })
  }
  if (conclusion.length > 0 && containsAny(conclusion, FUZZY_TERMS)) {
    const fuzzyCount = countOf(conclusion, FUZZY_TERMS)
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'medium',
      title: '结论含模糊表述',
      description: `诊断结论含 ${fuzzyCount} 处模糊用语 (可能/考虑/待定等), 影响临床决策。`,
      suggestion: '尽量给出明确倾向性意见, 模糊表述注明鉴别诊断理由。',
      evidence: input.reportId,
    })
  }
  if (findings.length > 0 && containsAny(findings, LESION_TERMS) && !SIZE_PATTERN.test(findingsText)) {
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'medium',
      title: '病灶缺少大小描述',
      description: '影像所见提及病灶/结节/肿块, 但未描述大小 (mm/cm)。',
      suggestion: '补充病灶三维径线描述, 便于随访对比。',
      evidence: input.reportId,
    })
  }
  if (findings.length > 0 && containsAny(findings, LESION_TERMS) && !containsAny(findings, LATERALITY_TERMS)) {
    push({
      category: 'description_gap',
      categoryLabel: CATEGORY_LABEL.description_gap,
      severity: 'low',
      title: '病灶缺少左右侧描述',
      description: '影像所见提及病灶但未指明左右侧/双侧, 定位信息不完整。',
      suggestion: '补充病灶定位 (左/右/双侧/具体叶段)。',
      evidence: input.reportId,
    })
  }

  // ── 类别 3: 结论不一致 (conclusion_inconsistency) ─────────────────────────
  if (conclusion.length > 0 && !containsAny(conclusion, FINDING_VERBS) && !containsAny(conclusion, CRITICAL_TERMS)) {
    const verbsInFindings = countOf(findingsText, FINDING_VERBS)
    if (verbsInFindings > 0) {
      push({
        category: 'conclusion_inconsistency',
        categoryLabel: CATEGORY_LABEL.conclusion_inconsistency,
        severity: 'low',
        title: '结论表述未采用影像术语',
        description: '结论缺少影像描述性动词或征象术语, 与所见风格不一致。',
        suggestion: '结论采用与所见一致的影像专业表述。',
        evidence: input.reportId,
      })
    }
  }
  if (conclusion.length > 0 && findings.length > 0) {
    const findingKeywords = ['未见', ...CRITICAL_TERMS, ...LESION_TERMS]
    const inFindings = findingKeywords.filter((k) => findings.includes(k))
    const missingInConclusion = inFindings.filter((k) => !conclusion.includes(k) && k !== '未见')
    if (missingInConclusion.length > 0) {
      push({
        category: 'conclusion_inconsistency',
        categoryLabel: CATEGORY_LABEL.conclusion_inconsistency,
        severity: 'medium',
        title: '所见征象未在结论体现',
        description: `影像所见含征象 (${missingInConclusion.slice(0, 3).join('/')}) 但结论未提及, 一致性不足。`,
        suggestion: '复核所见与结论一致性, 结论中覆盖全部重要征象。',
        evidence: input.reportId,
      })
    }
  }
  if (findings.includes('未见异常') && conclusion.length > 0 && criticalInConclusion > 0) {
    push({
      category: 'conclusion_inconsistency',
      categoryLabel: CATEGORY_LABEL.conclusion_inconsistency,
      severity: 'high',
      title: '结论与所见矛盾 (阳性征象)',
      description: '所见为未见异常而结论存在阳性征象, 前后矛盾。',
      suggestion: '立即修正所见或结论, 定稿前人工复核。',
      evidence: input.reportId,
    })
  }

  // ── 特征统计 ──────────────────────────────────────────────────────────────
  const sectionCount = SECTION_HEADINGS.filter((h) => allText.includes(h)).length
  const featureStats: SecondReadFeatureStats = {
    textLength: allText.length,
    sectionCount,
    sentenceCount: sentenceCountOf(allText),
    findingTermCount: countOf(allText, FINDING_VERBS),
    technicalTermCount: countOf(allText, TECHNICAL_TERMS),
    fuzzyTermCount: countOf(allText, FUZZY_TERMS),
    criticalTermCount: criticalInFindings + criticalInConclusion,
  }
  return { riskItems, featureStats }
}

export function riskScoreOf(riskItems: Array<{ severity: RiskSeverity }>): number {
  const deduction = riskItems.reduce((acc, r) => acc + SEVERITY_SCORE[r.severity], 0)
  return Math.max(0, 100 - deduction)
}

export function riskLevelOf(score: number): RiskLevel {
  if (score >= 85) return 'low'
  if (score >= 60) return 'medium'
  return 'high'
}

// ================= 种子数据 (seed 回退) =================

const SEED_INPUTS: Array<{ input: SecondReadInput; reviewedBy?: string }> = [
  {
    input: {
      reportId: 'RPT-SR-SEED-001',
      patientName: '李明',
      modality: 'CT',
      findings: '胸部CT平扫: 双肺纹理清晰, 未见实变影。主动脉未见增宽, 纵隔居中, 心影不大。双侧胸膜未见增厚, 未见胸腔积液。',
      diagnosis: '双肺及纵隔未见明确异常。',
      conclusion: '双肺及纵隔未见明确异常, 建议定期随访复查。',
      recommendations: '建议 1 年后随访复查胸部 CT。',
    },
    reviewedBy: '王审核',
  },
  {
    input: {
      reportId: 'RPT-SR-SEED-002',
      patientName: '张伟',
      modality: 'MR',
      findings: '头颅MR平扫: 左侧基底节区见斑片状长T1长T2信号灶, DWI 未见明显弥散受限。脑室系统无扩张, 中线结构居中。',
      diagnosis: '左侧基底节区缺血灶可能性大, 建议结合临床。',
      conclusion: '左侧基底节区缺血灶。',
      recommendations: '',
    },
    reviewedBy: '王审核',
  },
  {
    input: {
      reportId: 'RPT-SR-SEED-003',
      patientName: '赵敏',
      modality: 'CT',
      findings: '胸部CTA: 升主动脉增宽约 4.8cm, 可见内膜片影, 真假双腔形成。',
      diagnosis: '主动脉夹层可能。',
      conclusion: '升主动脉夹层可能, 建议立即心胸外科会诊, 急诊处理。',
      recommendations: '立即通知临床, 急诊处理, 严格控制血压。',
    },
  },
  {
    input: {
      reportId: 'RPT-SR-SEED-004',
      patientName: '陈杰',
      modality: 'CT',
      findings: '腹部CT: 肝右叶见低密度灶, 增强扫描动脉期明显强化, 静脉期减退。',
      diagnosis: '肝右叶占位, 考虑血管瘤可能。',
      conclusion: '',
      recommendations: '',
    },
  },
]

const now = () => new Date().toISOString()

@Injectable()
export class AiSecondReadService {
  private results: SecondReadResult[] = []
  private seq = 0

  constructor() {
    this.seed()
  }

  private nextRiskItemId(resultId: string): string {
    this.seq += 1
    return `SR-${resultId}-R${this.seq}`
  }

  private seed(): void {
    for (const { input, reviewedBy } of SEED_INPUTS) {
      const result = this.buildResult(input, `SR-SEED-${input.reportId.slice(-3)}`)
      if (reviewedBy) {
        result.reviewedBy = reviewedBy
        result.reviewedAt = now()
        result.riskItems = result.riskItems.map((item, i) =>
          i === 0 ? { ...item, status: 'ignored' as const, handledBy: reviewedBy, handledAt: now() } : item,
        )
      }
      this.results.push(result)
    }
  }

  private buildResult(input: SecondReadInput, id: string): SecondReadResult {
    const { riskItems, featureStats } = analyzeSecondReadText(input)
    const score = riskScoreOf(riskItems)
    return {
      id,
      reportId: input.reportId,
      patientName: input.patientName ?? '未知患者',
      modality: input.modality ?? 'CT',
      riskScore: score,
      riskLevel: riskLevelOf(score),
      riskItems: riskItems.map((r) => ({ ...r, id: this.nextRiskItemId(id), status: 'open' as const })),
      featureStats,
      modelVersion: 'second-read-v2.3',
      status: 'completed',
      createdAt: now(),
    }
  }

  /** POST /ai-second-read/analyze — 二次检出任务 (定稿前 AI 复查) */
  async analyze(input: SecondReadInput): Promise<SecondReadResult> {
    const reportId = (input.reportId ?? '').trim()
    if (!reportId) throw new BadRequestException('reportId 不能为空')
    const existing = this.results.find((r) => r.reportId === reportId)
    if (existing) return this.cloneResult(existing)
    const result = this.buildResult({ ...input, reportId }, `SR-${this.results.length + 1}-${reportId.slice(-6)}`)
    this.results.unshift(result)
    return this.cloneResult(result)
  }

  /** GET /ai-second-read/results — 检出结果列表 */
  listResults(): SecondReadResult[] {
    return this.results.map((r) => this.cloneResult(r))
  }

  /** GET /ai-second-read/results/:id — 检出结果详情 */
  getResult(id: string): SecondReadResult {
    return this.cloneResult(this.findResult(id))
  }

  /** POST /ai-second-read/results/:id/risk-items/:itemId/ignore — 医生忽略风险项 */
  ignoreRiskItem(resultId: string, itemId: string, reviewer: string): SecondReadResult {
    const result = this.findResult(resultId)
    const item = result.riskItems.find((r) => r.id === itemId)
    if (!item) throw new NotFoundException(`风险项 ${itemId} 不存在`)
    if (!reviewer?.trim()) throw new BadRequestException('reviewer 不能为空')
    item.status = 'ignored'
    item.handledBy = reviewer.trim()
    item.handledAt = now()
    result.reviewedBy = reviewer.trim()
    result.reviewedAt = now()
    return this.cloneResult(result)
  }

  /** POST /ai-second-read/results/:id/risk-items/:itemId/adopt — 医生采纳风险项 */
  adoptRiskItem(resultId: string, itemId: string, reviewer: string): SecondReadResult {
    const result = this.findResult(resultId)
    const item = result.riskItems.find((r) => r.id === itemId)
    if (!item) throw new NotFoundException(`风险项 ${itemId} 不存在`)
    if (!reviewer?.trim()) throw new BadRequestException('reviewer 不能为空')
    item.status = 'adopted'
    item.handledBy = reviewer.trim()
    item.handledAt = now()
    result.reviewedBy = reviewer.trim()
    result.reviewedAt = now()
    return this.cloneResult(result)
  }

  /** POST /ai-second-read/results/:id/append — 将建议加入报告 */
  appendToReport(resultId: string, body: { reviewer: string; appendedText: string }): SecondReadResult {
    const result = this.findResult(resultId)
    if (!body.reviewer?.trim()) throw new BadRequestException('reviewer 不能为空')
    if (!body.appendedText?.trim()) throw new BadRequestException('appendedText 不能为空')
    result.appendedText = body.appendedText.trim()
    result.appendedAt = now()
    result.reviewedBy = body.reviewer.trim()
    result.reviewedAt = now()
    for (const item of result.riskItems) {
      if (item.status === 'open') {
        item.status = 'appended'
        item.handledBy = body.reviewer.trim()
        item.handledAt = now()
      }
    }
    return this.cloneResult(result)
  }

  /** GET /ai-second-read/stats — 复查统计 */
  getStats(): SecondReadStatsData {
    const results = this.results
    const allItems = results.flatMap((r) => r.riskItems)
    const openItems = allItems.filter((i) => i.status === 'open')
    const categoryCounts = new Map<RiskCategory, { count: number; open: number }>()
    const severityCounts = new Map<RiskSeverity, number>()
    for (const item of allItems) {
      const cat = categoryCounts.get(item.category) ?? { count: 0, open: 0 }
      cat.count += 1
      if (item.status === 'open') cat.open += 1
      categoryCounts.set(item.category, cat)
      severityCounts.set(item.severity, (severityCounts.get(item.severity) ?? 0) + 1)
    }
    const scores = results.map((r) => r.riskScore)
    return {
      total: results.length,
      avgRiskScore: scores.length ? Math.round((scores.reduce((a, s) => a + s, 0) / scores.length) * 10) / 10 : 0,
      highRiskCount: results.filter((r) => r.riskLevel === 'high').length,
      mediumRiskCount: results.filter((r) => r.riskLevel === 'medium').length,
      lowRiskCount: results.filter((r) => r.riskLevel === 'low').length,
      openRiskItems: openItems.length,
      handledRiskItems: allItems.length - openItems.length,
      byCategory: (Object.keys(CATEGORY_LABEL) as RiskCategory[]).map((c) => ({
        category: c,
        label: CATEGORY_LABEL[c],
        count: categoryCounts.get(c)?.count ?? 0,
        open: categoryCounts.get(c)?.open ?? 0,
      })),
      bySeverity: (['high', 'medium', 'low'] as RiskSeverity[]).map((s) => ({
        severity: s,
        count: severityCounts.get(s) ?? 0,
      })),
      appendedCount: results.filter((r) => r.appendedText).length,
    }
  }

  private findResult(id: string): SecondReadResult {
    const result = this.results.find((r) => r.id === id)
    if (!result) throw new NotFoundException(`二次检出结果 ${id} 不存在`)
    return result
  }

  private cloneResult(r: SecondReadResult): SecondReadResult {
    return {
      ...r,
      riskItems: r.riskItems.map((i) => ({ ...i })),
      featureStats: { ...r.featureStats },
    }
  }
}
