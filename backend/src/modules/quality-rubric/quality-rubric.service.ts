/**
 * [G005 W9-QC] 统一可配置质控评分量表服务 (quality-rubric)
 *
 * 单一加权模型: dimensions(权重) → subItems(权重) → rules(权重)
 *   - 配置 CRUD (内存持久化, 孤儿模块可无 DB 启动)
 *   - POST /quality/rubric/evaluate: 给定报告/评分输入 → 加权总分 + 逐维度/子项/规则得分 + 等级
 *   - 报告回退: 传 reportId 且注入 Prisma 时读取真实报告; 否则使用确定性 seed 提交
 * 所有计算为纯函数, 同输入恒同输出。
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { hashString } from '../../common/utils/deterministic-hash'
import { buildDefaultRubric } from './quality-rubric.data'
import type {
  DimensionScoreResult,
  GradeBand,
  QualityRubric,
  RubricEvaluationResult,
  RubricRule,
  RubricSubmission,
  RubricUpdateInput,
  RuleScore,
  SubItemScore,
} from './quality-rubric.types'

export interface RuleContext extends RubricSubmission {
  _text: string
}

function round(n: number, digits = 1): number {
  const f = Math.pow(10, digits)
  return Math.round(n * f) / f
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined
}

function bool(v: unknown): boolean | undefined {
  return typeof v === 'boolean' ? v : undefined
}

function safeRegex(pattern: string): RegExp | null {
  try {
    return new RegExp(pattern)
  } catch {
    return null
  }
}

function intervalMinutes(from?: string, to?: string): number {
  if (!from || !to) return Number.POSITIVE_INFINITY
  const a = Date.parse(from)
  const b = Date.parse(to)
  if (!Number.isFinite(a) || !Number.isFinite(b)) return Number.POSITIVE_INFINITY
  return Math.round((b - a) / 60000)
}

/** 单规则评分: 返回 0-100 */
export function scoreRule(rule: RubricRule, ctx: RuleContext): { score: number; passed: boolean; explanation: string } {
  const fieldText = str(ctx[rule.field as keyof RuleContext])
  switch (rule.kind) {
    case 'presence': {
      const re = rule.pattern ? safeRegex(rule.pattern) : null
      const passed = Boolean(re && re.test(fieldText))
      return { score: passed ? 100 : 0, passed, explanation: `${rule.explanation ?? rule.name}: ${passed ? '满足' : '未满足'}` }
    }
    case 'absence': {
      const re = rule.pattern ? safeRegex(rule.pattern) : null
      const passed = !(re && re.test(fieldText))
      return { score: passed ? 100 : 0, passed, explanation: `${rule.explanation ?? rule.name}: ${passed ? '无异常' : '命中风险'}` }
    }
    case 'minLength': {
      const len = fieldText.length
      const min = rule.min ?? 0
      const ratio = min > 0 ? Math.min(1, len / min) : 1
      return { score: round(ratio * 100), passed: len >= min, explanation: `${rule.explanation ?? rule.name}: ${len}/${min}` }
    }
    case 'minRatio': {
      const value = num(ctx[rule.field as keyof RuleContext])
      const min = rule.min ?? 0
      if (value === undefined) return { score: 0, passed: false, explanation: `${rule.explanation ?? rule.name}: 缺失` }
      const ratio = min > 0 ? Math.min(1, value / min) : value >= min ? 1 : 0
      return { score: round(ratio * 100), passed: value >= min, explanation: `${rule.explanation ?? rule.name}: ${value}` }
    }
    case 'booleanTrue': {
      const value = bool(ctx[rule.field as keyof RuleContext])
      return { score: value ? 100 : 0, passed: value === true, explanation: `${rule.explanation ?? rule.name}: ${value ? '是' : '否'}` }
    }
    case 'intervalMinutes': {
      const minutes = intervalMinutes(str(ctx[rule.from as keyof RuleContext]), str(ctx[rule.to as keyof RuleContext]))
      const max = rule.max ?? 0
      const passed = minutes <= max
      return { score: passed ? 100 : 0, passed, explanation: `${rule.explanation ?? rule.name}: ${Number.isFinite(minutes) ? `${minutes}min` : '缺时间'}/${max}min` }
    }
    case 'priorityStat': {
      const passed = str(ctx.priority) === 'stat'
      return { score: passed ? 100 : 85, passed, explanation: `${rule.explanation ?? rule.name}: ${str(ctx.priority) || 'routine'}` }
    }
    case 'leftRightOk': {
      const value = bool(ctx.leftRightOk)
      // 未显式提供时, 若所见含方位词则视为通过, 否则中性 80
      const inferred = value ?? /左|右|双侧/.test(str(ctx.findings))
      return { score: inferred ? 100 : 70, passed: inferred, explanation: `${rule.explanation ?? rule.name}: ${inferred ? '一致' : '疑似不一致'}` }
    }
    default:
      return { score: 90, passed: true, explanation: rule.explanation ?? rule.name }
  }
}

/** 生成确定性 seed 提交 (当仅给定 reportId 时) */
export function buildSeedSubmission(reportId: string): RubricSubmission {
  const h = hashString(reportId)
  const modalities = ['CT', 'MR', 'DR', 'MG']
  const modality = modalities[h % modalities.length]!
  const signed = h % 11 !== 0
  const criticalMarked = h % 5 !== 0
  return {
    reportId,
    patientName: `患者${(h % 90) + 10}`,
    modality,
    findings: '双肺纹理清晰，右肺上叶见一结节影，大小约 12mm×10mm，密度均匀，边界清楚，可见轻度强化。既往有吸烟史。',
    impression: '1. 右肺上叶结节，考虑良性可能性大。 2. 纵隔未见肿大淋巴结。',
    diagnosis: '右肺上叶结节',
    recommendation: '建议 3 个月后复查胸部 CT，随诊观察。',
    structuredFieldsComplete: 0.8 + ((h % 20) / 100),
    signed,
    criticalMarked,
    priority: h % 7 === 0 ? 'stat' : h % 3 === 0 ? 'urgent' : 'routine',
    leftRightOk: h % 13 !== 0,
    onTimeRate: 85 + (h % 14),
    submitAt: '2026-08-10T08:00:00.000Z',
    reviewStartedAt: '2026-08-10T08:10:00.000Z',
    signedAt: '2026-08-10T08:35:00.000Z',
    hasReviewerSignature: signed,
    criticalNotified: criticalMarked,
    criticalAcked: criticalMarked && h % 9 !== 0,
    priorityQueue: true,
  }
}

@Injectable()
export class QualityRubricService {
  private readonly logger = new Logger(QualityRubricService.name)
  private rubric: QualityRubric = buildDefaultRubric()
  private evaluations = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('QualityRubricService: no Prisma injected (orphan mode, seed submission)')
  }

  // ================= 配置 CRUD =================

  getRubric(): QualityRubric {
    return this.clone(this.rubric)
  }

  updateRubric(input: RubricUpdateInput): QualityRubric {
    if (input.name !== undefined && !input.name.trim()) throw new BadRequestException('name 不能为空')
    if (input.passThreshold !== undefined && (input.passThreshold < 0 || input.passThreshold > 100)) {
      throw new BadRequestException('passThreshold 必须为 0-100')
    }
    if (input.dimensions !== undefined) {
      if (!Array.isArray(input.dimensions) || input.dimensions.length === 0) throw new BadRequestException('dimensions 不能为空')
      const weight = input.dimensions.reduce((a, d) => a + (d.weight ?? 0), 0)
      if (weight <= 0) throw new BadRequestException('dimensions 权重之和必须 > 0')
    }
    const next: QualityRubric = this.clone(this.rubric)
    if (input.name !== undefined) next.name = input.name.trim()
    if (input.passThreshold !== undefined) next.passThreshold = input.passThreshold
    if (input.bonusThreshold !== undefined) next.bonusThreshold = input.bonusThreshold
    if (input.dimensions !== undefined) next.dimensions = input.dimensions.map((d) => ({ ...d, subItems: d.subItems.map((s) => ({ ...s, rules: s.rules.map((r) => ({ ...r })) })) }))
    if (input.gradeBands !== undefined) next.gradeBands = input.gradeBands.map((b) => ({ ...b }))
    if (input.hardFailPatterns !== undefined) next.hardFailPatterns = [...input.hardFailPatterns]
    next.version += 1
    next.updatedAt = new Date().toISOString()
    next.updatedBy = input.updatedBy?.trim() || 'system'
    this.rubric = next
    return this.clone(this.rubric)
  }

  resetRubric(): QualityRubric {
    this.rubric = buildDefaultRubric()
    return this.clone(this.rubric)
  }

  getGradeBands(): GradeBand[] {
    return this.rubric.gradeBands.map((b) => ({ ...b }))
  }

  getStats(): { rubricId: string; version: number; dimensionCount: number; subItemCount: number; ruleCount: number; evaluations: number; standard: string } {
    const subItemCount = this.rubric.dimensions.reduce((a, d) => a + d.subItems.length, 0)
    const ruleCount = this.rubric.dimensions.reduce((a, d) => a + d.subItems.reduce((s, i) => s + i.rules.length, 0), 0)
    return {
      rubricId: this.rubric.id,
      version: this.rubric.version,
      dimensionCount: this.rubric.dimensions.length,
      subItemCount,
      ruleCount,
      evaluations: this.evaluations,
      standard: this.rubric.standard,
    }
  }

  // ================= 评分 =================

  /** 解析提交: 优先入参 submission, 其次 reportId 读库, 最后确定性 seed */
  async resolveSubmission(body: { reportId?: string; submission?: RubricSubmission }): Promise<RubricSubmission> {
    if (body.submission && typeof body.submission === 'object') {
      return { ...body.submission, reportId: body.reportId ?? body.submission.reportId }
    }
    const reportId = (body.reportId ?? '').trim()
    if (reportId && this.prisma) {
      try {
        const report = await this.prisma.report.findUnique({ where: { id: reportId }, include: { exam: true } })
        if (report) {
          return {
            reportId,
            modality: report.exam?.modality,
            findings: report.findings,
            impression: report.impression ?? report.conclusion ?? '',
            diagnosis: report.diagnosis ?? '',
            recommendation: report.recommendations ?? '',
            structuredFieldsComplete: 0.9,
            signed: Boolean(report.signedById || report.signedAt),
            criticalMarked: Boolean(report.isCritical),
            priority: report.exam?.priority,
            leftRightOk: true,
            onTimeRate: 95,
            hasReviewerSignature: Boolean(report.signedById),
            criticalNotified: Boolean(report.isCritical),
            criticalAcked: Boolean(report.isCritical),
            priorityQueue: true,
          }
        }
      } catch (err) {
        this.logger.debug(`[QualityRubric] report load failed, seed fallback: ${(err as Error).message}`)
      }
    }
    if (!reportId) throw new BadRequestException('请提供 submission 或 reportId')
    return buildSeedSubmission(reportId)
  }

  async evaluate(body: { reportId?: string; submission?: RubricSubmission }): Promise<RubricEvaluationResult> {
    const submission = await this.resolveSubmission(body)
    return this.evaluateSubmission(submission)
  }

  evaluateSubmission(submission: RubricSubmission): RubricEvaluationResult {
    const rubric = this.rubric
    const totalDimWeight = rubric.dimensions.reduce((a, d) => a + Math.max(0, d.weight), 0) || 1

    const dimensions: DimensionScoreResult[] = rubric.dimensions.map((dim) => {
      const subItems: SubItemScore[] = dim.subItems.map((sub) => {
        const ctx: RuleContext = { ...submission, _text: [submission.findings, submission.impression, submission.diagnosis, submission.recommendation].join(' ') }
        const totalRuleWeight = sub.rules.reduce((a, r) => a + Math.max(0, r.weight), 0) || 1
        const rules: RuleScore[] = sub.rules.map((r) => {
          const { score, passed, explanation } = scoreRule(r, ctx)
          return { key: r.key, name: r.name, score, weight: r.weight, passed, explanation }
        })
        const score = round(rules.reduce((a, r) => a + r.score * Math.max(0, r.weight), 0) / totalRuleWeight)
        const passed = rules.every((r) => r.passed)
        return { key: sub.key, name: sub.name, weight: sub.weight, score, passed, rules }
      })
      const totalSubWeight = dim.subItems.reduce((a, s) => a + Math.max(0, s.weight), 0) || 1
      const score = round(subItems.reduce((a, s) => a + s.score * Math.max(0, s.weight), 0) / totalSubWeight)

      const dimWeight = Math.max(0, dim.weight)
      return { key: dim.key, name: dim.name, weight: dim.weight, score, weightedScore: round((score * dimWeight) / totalDimWeight), subItems }
    })

    const totalScore = round(dimensions.reduce((a, d) => a + d.weightedScore, 0))
    const band = rubric.gradeBands.find((b) => totalScore >= b.min && totalScore <= b.max) ?? rubric.gradeBands[rubric.gradeBands.length - 1]!
    const text = [submission.findings, submission.impression, submission.diagnosis].join(' ')
    const hardFailTriggered = rubric.hardFailPatterns.filter((p) => {
      const re = safeRegex(p)
      return re ? re.test(text) : text.includes(p)
    })

    const passed = totalScore >= rubric.passThreshold && hardFailTriggered.length === 0
    const publishable = passed && band.publishable
    const bonusEligible = totalScore >= rubric.bonusThreshold && hardFailTriggered.length === 0
    this.evaluations += 1

    return {
      evaluationId: `QE-${hashString(`${submission.reportId ?? ''}:${totalScore}:${this.evaluations}`).toString(16)}`,
      rubricId: rubric.id,
      rubricVersion: rubric.version,
      reportId: submission.reportId,
      modality: submission.modality,
      totalScore,
      grade: band.grade,
      gradeLabel: band.label,
      passed,
      publishable,
      bonusEligible,
      hardFailTriggered,
      dimensions,
      evaluatedAt: new Date().toISOString(),
      standard: rubric.standard,
    }
  }

  getEvaluation(evaluationId: string): RubricEvaluationResult {
    throw new NotFoundException(`评分记录 ${evaluationId} 不在内存中 (评分结果不落库, 请重新评估)`)
  }

  private clone(r: QualityRubric): QualityRubric {
    return {
      ...r,
      dimensions: r.dimensions.map((d) => ({ ...d, subItems: d.subItems.map((s) => ({ ...s, rules: s.rules.map((x) => ({ ...x })) })) })),
      gradeBands: r.gradeBands.map((b) => ({ ...b })),
      hardFailPatterns: [...r.hardFailPatterns],
    }
  }
}
