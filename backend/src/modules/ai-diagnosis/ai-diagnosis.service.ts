import { Injectable } from '@nestjs/common'

export interface AccuracyRequest {
  startDate: string
  endDate: string
  siteId?: string
  modality?: string
}

export interface AccuracyResult {
  sensitivity: number
  specificity: number
  ppv: number
  npv: number
  accuracy: number
  totalCases: number
  aiPositive: number
  aiNegative: number
  physicianPositive: number
  physicianNegative: number
}

export interface TrendPoint {
  date: string
  sensitivity: number
  specificity: number
  accuracy: number
  totalCases: number
}

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

@Injectable()
export class AiDiagnosisService {
  async accuracy(req: AccuracyRequest): Promise<AccuracyResult> {
    const total = Math.round(Math.random() * 2000 + 500)
    const acc = rand(82, 96)
    const sens = rand(80, 97)
    const spec = rand(78, 95)
    const ppv = rand(75, 94)
    const npv = rand(80, 96)
    const aiPos = Math.round(total * rand(0.4, 0.6))
    const aiNeg = total - aiPos
    const physPos = Math.round(total * rand(0.35, 0.55))
    const physNeg = total - physPos
    return {
      sensitivity: sens,
      specificity: spec,
      ppv,
      npv,
      accuracy: acc,
      totalCases: total,
      aiPositive: aiPos,
      aiNegative: aiNeg,
      physicianPositive: physPos,
      physicianNegative: physNeg,
    }
  }

  async trend(req: AccuracyRequest): Promise<TrendPoint[]> {
    const start = new Date(req.startDate)
    const end = new Date(req.endDate)
    const days = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000))
    return Array.from({ length: Math.min(days, 90) }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() + i)
      return {
        date: d.toISOString().slice(0, 10),
        sensitivity: rand(78, 98),
        specificity: rand(76, 96),
        accuracy: rand(80, 97),
        totalCases: Math.round(Math.random() * 100 + 20),
      }
    })
  }
}
