import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'

export interface ArtifactScores {
  motion: number
  metal: number
  ring: number
}

export interface PositioningScores {
  setup: number
  rotation: number
  offset: number
}

export interface ExposureScore {
  value: string
  score: number
}

export interface AiScoreDtoV2 {
  instanceId: string
  modality: string
  artifactScores: ArtifactScores
  positioningScores: PositioningScores
  exposure: ExposureScore
  overall: number
  operatorId?: string
}

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

export interface AiScoreResultV2 {
  id: string
  instanceId: string
  modality: string
  artifactScores: ArtifactScores
  positioningScores: PositioningScores
  exposure: ExposureScore
  overall: number
  operatorId?: string
  createdAt: string
}

export interface AiStatsResponseV2 {
  totalScores: number
  avgArtifactMotion: number
  avgArtifactMetal: number
  avgArtifactRing: number
  avgArtifactOverall: number
  avgPositioningSetup: number
  avgPositioningRotation: number
  avgPositioningOffset: number
  avgPositioningOverall: number
  avgExposureScore: number
  avgOverall: number
  byModality: Record<string, number>
  byDate: Record<string, number>
  byOperator: Record<string, number>
}

@Injectable()
export class ImageAiService {
  private store: Map<string, AiScoreResult> = new Map()
  private storeV2: Map<string, AiScoreResultV2> = new Map()

  async scoreV2(dto: AiScoreDtoV2): Promise<AiScoreResultV2> {
    const id = uuid()
    const result: AiScoreResultV2 = { id, ...dto, createdAt: new Date().toISOString() }
    this.storeV2.set(id, result)
    return result
  }

  async getResultV2(instanceId: string): Promise<AiScoreResultV2> {
    const all = Array.from(this.storeV2.values())
    const found = all.find(x => x.instanceId === instanceId)
    if (!found) throw new NotFoundException(`AI score V2 for instance ${instanceId} not found`)
    return found
  }

  async statsV2(query: AiStatsQuery): Promise<AiStatsResponseV2> {
    let items = Array.from(this.storeV2.values())
    if (query.modality) items = items.filter(x => x.modality === query.modality)
    if (query.operatorId) items = items.filter(x => x.operatorId === query.operatorId)
    if (query.dateFrom) items = items.filter(x => new Date(x.createdAt) >= new Date(query.dateFrom!))
    if (query.dateTo) items = items.filter(x => new Date(x.createdAt) <= new Date(query.dateTo!))

    const total = items.length
    if (total === 0) {
      return { totalScores: 0, avgArtifactMotion: 0, avgArtifactMetal: 0, avgArtifactRing: 0, avgArtifactOverall: 0, avgPositioningSetup: 0, avgPositioningRotation: 0, avgPositioningOffset: 0, avgPositioningOverall: 0, avgExposureScore: 0, avgOverall: 0, byModality: {}, byDate: {}, byOperator: {} }
    }

    const avgArtifactMotion = items.reduce((s, x) => s + x.artifactScores.motion, 0) / total
    const avgArtifactMetal = items.reduce((s, x) => s + x.artifactScores.metal, 0) / total
    const avgArtifactRing = items.reduce((s, x) => s + x.artifactScores.ring, 0) / total
    const avgArtifactOverall = (avgArtifactMotion + avgArtifactMetal + avgArtifactRing) / 3
    const avgPositioningSetup = items.reduce((s, x) => s + x.positioningScores.setup, 0) / total
    const avgPositioningRotation = items.reduce((s, x) => s + x.positioningScores.rotation, 0) / total
    const avgPositioningOffset = items.reduce((s, x) => s + x.positioningScores.offset, 0) / total
    const avgPositioningOverall = (avgPositioningSetup + avgPositioningRotation + avgPositioningOffset) / 3
    const avgExposureScore = items.reduce((s, x) => s + x.exposure.score, 0) / total
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

    return { totalScores: total, avgArtifactMotion, avgArtifactMetal, avgArtifactRing, avgArtifactOverall, avgPositioningSetup, avgPositioningRotation, avgPositioningOffset, avgPositioningOverall, avgExposureScore, avgOverall, byModality, byDate, byOperator }
  }

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
