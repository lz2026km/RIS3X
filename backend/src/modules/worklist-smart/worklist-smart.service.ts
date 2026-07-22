import { Injectable } from '@nestjs/common'

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

export interface SmartScoreResult {
  studyId: string
  score: number
  reasons: string[]
  level: 'low' | 'normal' | 'urgent' | 'critical'
}

export interface SmartWeightConfig {
  urgencyWeight: number
  waitWeight: number
  ageWeight: number
  examTypeWeight: number
}

const DEFAULT_WEIGHTS: SmartWeightConfig = {
  urgencyWeight: 0.35,
  waitWeight: 0.30,
  ageWeight: 0.15,
  examTypeWeight: 0.20,
}

const HIGH_AGE_THRESHOLD = 65
const CHILD_AGE_THRESHOLD = 12

const HIGH_PRIORITY_BODY_PARTS = new Set(['头颅', '头部', '脑血管', '主动脉', '冠状动脉', '肺动脉'])
const HIGH_PRIORITY_EXAM_KEYWORDS = ['CT头', 'CTA', 'CTP', '头颈CTA', '冠状动脉CTA', '主动脉CTA']

@Injectable()
export class WorklistSmartService {
  private weights: SmartWeightConfig = { ...DEFAULT_WEIGHTS }

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

  score(input: SmartScoreInput): SmartScoreResult {
    const urgencyScore = this.normalizeUrgency(input.urgency)
    const waitScore = this.calcWaitScore(input.waitingMinutes)
    const ageScore = this.calcAgeScore(input.age)
    const examTypeScore = this.calcExamTypeScore(input.modality, input.bodyPart)

    const total =
      urgencyScore * this.weights.urgencyWeight +
      waitScore * this.weights.waitWeight +
      ageScore * this.weights.ageWeight +
      examTypeScore * this.weights.examTypeWeight

    const raw = Math.round(total * 1000) / 10

    const reasons: string[] = []
    if (input.urgency > 0) reasons.push(`紧急度+${input.urgency}`)
    if (input.urgency < 0) reasons.push(`紧急度${input.urgency}`)
    if (input.waitingMinutes > 30) reasons.push(`等待${input.waitingMinutes}min`)
    if ((input.age ?? 0) >= HIGH_AGE_THRESHOLD) reasons.push('高龄患者')
    if ((input.age ?? 0) <= CHILD_AGE_THRESHOLD) reasons.push('儿童患者')
    if (examTypeScore > 0) reasons.push(`${input.bodyPart || input.modality || ''}优先`.trim() || '检查类型优先')
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
    }
  }

  reorder(
    inputs: SmartScoreInput[],
  ): Array<SmartScoreInput & { score: number; reasons: string[]; level: string; rank: number; beforeRank: number }> {
    const scored = inputs.map((input, idx) => {
      const result = this.score(input)
      return { ...input, ...result, beforeRank: idx + 1, rank: 0 }
    })
    scored.sort((a, b) => b.score - a.score)
    scored.forEach((item, idx) => { item.rank = idx + 1 })
    return scored
  }
}
