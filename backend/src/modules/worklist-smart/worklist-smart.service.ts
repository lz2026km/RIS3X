import { Injectable } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export interface SmartScoreInput {
  id: string
  urgency: number
  waitingMinutes: number
  age?: number
  modality?: string
  bodyPart?: string
  patientType?: string
  priority?: string
  criticalFinding?: boolean
}

export interface SmartFactorDetail {
  key: 'urgency' | 'wait' | 'age' | 'examType' | 'patientType' | 'aiTriage'
  label: string
  score: number
  weight: number
  contribution: number
}

export interface SmartScoreResult {
  studyId: string
  score: number
  reasons: string[]
  level: 'low' | 'normal' | 'urgent' | 'critical'
  factors: SmartFactorDetail[]
}

export interface SmartWeightConfig {
  urgencyWeight: number
  waitWeight: number
  ageWeight: number
  examTypeWeight: number
}

export interface SmartPriorityCounts {
  critical: number
  high: number
  medium: number
  low: number
}

const DEFAULT_WEIGHTS: SmartWeightConfig = {
  urgencyWeight: 0.35,
  waitWeight: 0.3,
  ageWeight: 0.15,
  examTypeWeight: 0.2,
}

// 患者状态 / AI 分检分固定权重 (Infinitt 式 AI 分检接入)
const PATIENT_TYPE_WEIGHT = 0.15
const AI_TRIAGE_WEIGHT = 0.1

const HIGH_AGE_THRESHOLD = 65
const CHILD_AGE_THRESHOLD = 12

const HIGH_PRIORITY_BODY_PARTS = new Set(['头颅', '头部', '脑血管', '主动脉', '冠状动脉', '肺动脉'])
const HIGH_PRIORITY_EXAM_KEYWORDS = ['CT头', 'CTA', 'CTP', '头颈CTA', '冠状动脉CTA', '主动脉CTA']

const CRITICAL_PRIORITY_KEYWORDS = ['危急', '危重', '紧急', '急诊', '加急', 'urgent', 'critical', 'high', 'stat', 'emergent']
const MID_PRIORITY_KEYWORDS = ['中', '中等', 'medium', 'normal']

const DEMO_PRIORITIES: SmartPriorityCounts = { critical: 3, high: 5, medium: 12, low: 10 }

@Injectable()
export class WorklistSmartService {
  private weights: SmartWeightConfig = { ...DEFAULT_WEIGHTS }

  constructor(private readonly prisma: PrismaService) {}

  getWeights(): SmartWeightConfig {
    return { ...this.weights }
  }

  setWeights(w: Partial<SmartWeightConfig>): SmartWeightConfig {
    if (w.urgencyWeight !== undefined) this.weights.urgencyWeight = w.urgencyWeight
    if (w.waitWeight !== undefined) this.weights.waitWeight = w.waitWeight
    if (w.ageWeight !== undefined) this.weights.ageWeight = w.ageWeight
    if (w.examTypeWeight !== undefined) this.weights.examTypeWeight = w.examTypeWeight
    return { ...this.weights }
  }

  private normalizeUrgency(u: number): number {
    return Math.max(0, Math.min(1, (u + 3) / 6))
  }

  private calcWaitScore(minutes: number): number {
    if (minutes <= 0) return 0
    return Math.min(1, Math.log2(1 + minutes) / 12)
  }

  private calcAgeScore(age?: number): number {
    if (age === undefined || age === null) return 0
    if (age >= HIGH_AGE_THRESHOLD) return 0.8
    if (age <= CHILD_AGE_THRESHOLD) return 0.6
    return 0
  }

  private calcExamTypeScore(modality?: string, bodyPart?: string, examItem?: string): number {
    const text = [modality, bodyPart, examItem].filter(Boolean).join('').toLowerCase()
    if (HIGH_PRIORITY_BODY_PARTS.has(bodyPart ?? '')) return 1.0
    if (HIGH_PRIORITY_EXAM_KEYWORDS.some(kw => text.includes(kw.toLowerCase().replace(/\s/g, '')))) return 1.0
    return 0
  }

  private calcPatientTypeScore(patientType?: string): number {
    const t = (patientType ?? '').toLowerCase()
    if (t.includes('急诊') || t.includes('住院') || t.includes('危重') || t.includes('emergency') || t.includes('inpatient') || t.includes('critical')) return 1.0
    if (t.includes('体检') || t.includes('门诊') || t.includes('outpatient') || t.includes('physical')) return 0.2
    return 0
  }

  private calcAiTriageScore(priority?: string, criticalFinding?: boolean): number {
    if (criticalFinding) return 1.0
    const p = (priority ?? '').toLowerCase()
    if (CRITICAL_PRIORITY_KEYWORDS.some(kw => p.includes(kw))) return 1.0
    if (MID_PRIORITY_KEYWORDS.some(kw => p.includes(kw))) return 0.5
    return 0
  }

  private computeScore(input: SmartScoreInput): SmartScoreResult {
    const urgencyScore = this.normalizeUrgency(input.urgency)
    const waitScore = this.calcWaitScore(input.waitingMinutes)
    const ageScore = this.calcAgeScore(input.age)
    const examTypeScore = this.calcExamTypeScore(input.modality, input.bodyPart)
    const patientTypeScore = this.calcPatientTypeScore(input.patientType)
    const aiTriageScore = this.calcAiTriageScore(input.priority, input.criticalFinding)

    const total =
      urgencyScore * this.weights.urgencyWeight +
      waitScore * this.weights.waitWeight +
      ageScore * this.weights.ageWeight +
      examTypeScore * this.weights.examTypeWeight +
      patientTypeScore * PATIENT_TYPE_WEIGHT +
      aiTriageScore * AI_TRIAGE_WEIGHT

    const raw = Math.round(total * 1000) / 10

    const factors: SmartFactorDetail[] = [
      { key: 'urgency', label: '紧急度', score: urgencyScore, weight: this.weights.urgencyWeight, contribution: urgencyScore * this.weights.urgencyWeight },
      { key: 'wait', label: '等待时长', score: waitScore, weight: this.weights.waitWeight, contribution: waitScore * this.weights.waitWeight },
      { key: 'age', label: '年龄', score: ageScore, weight: this.weights.ageWeight, contribution: ageScore * this.weights.ageWeight },
      { key: 'examType', label: '检查类型', score: examTypeScore, weight: this.weights.examTypeWeight, contribution: examTypeScore * this.weights.examTypeWeight },
      { key: 'patientType', label: '患者状态', score: patientTypeScore, weight: PATIENT_TYPE_WEIGHT, contribution: patientTypeScore * PATIENT_TYPE_WEIGHT },
      { key: 'aiTriage', label: 'AI 分检', score: aiTriageScore, weight: AI_TRIAGE_WEIGHT, contribution: aiTriageScore * AI_TRIAGE_WEIGHT },
    ]

    const reasons: string[] = []
    if (input.urgency > 0) reasons.push(`紧急度+${input.urgency}`)
    if (input.urgency < 0) reasons.push(`紧急度${input.urgency}`)
    if (input.waitingMinutes > 30) reasons.push(`等待${input.waitingMinutes}min`)
    if ((input.age ?? 0) >= HIGH_AGE_THRESHOLD) reasons.push('高龄患者')
    if ((input.age ?? 0) <= CHILD_AGE_THRESHOLD) reasons.push('儿童患者')
    if (examTypeScore > 0) reasons.push(`${input.bodyPart || input.modality || ''}优先`.trim() || '检查类型优先')
    if (patientTypeScore >= 1) reasons.push(`患者状态${input.patientType}`)
    if (aiTriageScore > 0) reasons.push('AI 分检高风险')
    if (reasons.length === 0) reasons.push('常规排序')

    let level: SmartScoreResult['level'] = 'low'
    if (raw >= 70) level = 'critical'
    else if (raw >= 45) level = 'urgent'
    else if (raw >= 20) level = 'normal'

    return {
      studyId: input.id,
      score: raw,
      reasons,
      level,
      factors,
    }
  }

  private async persistScore(input: SmartScoreInput, result: SmartScoreResult): Promise<void> {
    await this.prisma.worklistSmartScore.create({
      data: {
        examId: input.id,
        score: result.score,
        weights: { ...this.weights },
        scoredAt: new Date(),
      },
    })
  }

  async score(input: SmartScoreInput): Promise<SmartScoreResult> {
    const result = this.computeScore(input)
    try {
      await this.persistScore(input, result)
    } catch {
      // DB unavailable -> keep pure scoring result
    }
    return result
  }

  /**
   * 按优先级分组计数 (critical/high/medium/low)。
   * 基于最近 24h 已评分记录;无数据或 DB 不可用时返回演示计数。
   */
  async getPriorities(): Promise<SmartPriorityCounts> {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const rows = await this.prisma.worklistSmartScore.findMany({
        where: { scoredAt: { gte: since } },
        select: { score: true },
      })
      if (rows.length === 0) return { ...DEMO_PRIORITIES }
      const counts: SmartPriorityCounts = { critical: 0, high: 0, medium: 0, low: 0 }
      for (const r of rows) {
        if (r.score >= 70) counts.critical++
        else if (r.score >= 45) counts.high++
        else if (r.score >= 20) counts.medium++
        else counts.low++
      }
      return counts
    } catch {
      return { ...DEMO_PRIORITIES }
    }
  }

  reorder(
    inputs: SmartScoreInput[],
  ): Array<SmartScoreInput & { score: number; reasons: string[]; level: string; factors: SmartFactorDetail[]; rank: number; beforeRank: number }> {
    const scored = inputs.map((input, idx) => {
      const result = this.computeScore(input)
      return { ...input, ...result, beforeRank: idx + 1, rank: 0 }
    })
    scored.sort((a, b) => b.score - a.score)
    scored.forEach((item, idx) => { item.rank = idx + 1 })
    return scored
  }
}
