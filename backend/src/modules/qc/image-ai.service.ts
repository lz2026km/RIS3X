import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface AiScoreDto {
  instanceId: string
  modality: string
  motionArtifact: number
  metalArtifact: number
  ringArtifact: number
  exposureLow: number
  exposureNormal: number
  exposureOver: number
  positioningCorrect: number
  positioningMildRotation: number
  positioningSevereOffset: number
  overall: number
  operatorId?: string
}

export interface AiScoreResult extends AiScoreDto {
  id: string
  createdAt: string
}

export interface AiStatsQuery {
  modality?: string
  dateFrom?: string
  dateTo?: string
  operatorId?: string
}

export interface AiStatsResponse {
  totalScores: number
  avgArtifact: number
  avgExposure: number
  avgPositioning: number
  avgOverall: number
  byModality: Record<string, number>
  byDate: Record<string, number>
  byOperator: Record<string, number>
}

const artifactLabel = (score: number): string => {
  if (score >= 4.5) return '优秀'
  if (score >= 3.5) return '良好'
  if (score >= 2.5) return '一般'
  return '较差'
}

@Injectable()
export class ImageAiService {
  private store: Map<string, AiScoreResult> = new Map()

  async score(dto: AiScoreDto): Promise<AiScoreResult> {
    const id = uuid()
    const result: AiScoreResult = { id, ...dto, createdAt: new Date().toISOString() }
    this.store.set(id, result)
    return result
  }

  async getResult(instanceId: string): Promise<AiScoreResult> {
    const r = this.store.get(instanceId)
    if (!r) {
      const all = Array.from(this.store.values())
      const found = all.find(x => x.instanceId === instanceId)
      if (!found) throw new NotFoundException(`AI score for instance ${instanceId} not found`)
      return found
    }
    return r
  }

  async stats(query: AiStatsQuery): Promise<AiStatsResponse> {
    let items = Array.from(this.store.values())
    if (query.modality) items = items.filter(x => x.modality === query.modality)
    if (query.operatorId) items = items.filter(x => x.operatorId === query.operatorId)
    if (query.dateFrom) items = items.filter(x => new Date(x.createdAt) >= new Date(query.dateFrom!))
    if (query.dateTo) items = items.filter(x => new Date(x.createdAt) <= new Date(query.dateTo!))

    const total = items.length
    if (total === 0) {
      return { totalScores: 0, avgArtifact: 0, avgExposure: 0, avgPositioning: 0, avgOverall: 0, byModality: {}, byDate: {}, byOperator: {} }
    }

    const avgArtifact = items.reduce((s, x) => s + (x.motionArtifact + x.metalArtifact + x.ringArtifact) / 3, 0) / total
    const avgExposure = items.reduce((s, x) => s + (x.exposureLow + x.exposureNormal + x.exposureOver) / 3, 0) / total
    const avgPositioning = items.reduce((s, x) => s + (x.positioningCorrect + x.positioningMildRotation + x.positioningSevereOffset) / 3, 0) / total
    const avgOverall = items.reduce((s, x) => s + x.overall, 0) / total

    const byModality: Record<string, number> = {}
    const byDate: Record<string, number> = {}
    const byOperator: Record<string, number> = {}

    for (const item of items) {
      byModality[item.modality] = (byModality[item.modality] ?? 0) + 1
      const d = item.createdAt.slice(0, 10)
      byDate[d] = (byDate[d] ?? 0) + 1
      if (item.operatorId) byOperator[item.operatorId] = (byOperator[item.operatorId] ?? 0) + 1
    }

    return { totalScores: total, avgArtifact, avgExposure, avgPositioning, avgOverall, byModality, byDate, byOperator }
  }
}
