import { Injectable, NotFoundException } from '@nestjs/common'
import { v4 as uuid } from 'uuid'
import { PrismaService } from '../../prisma/prisma.service'

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

// [G005 Wave4A] G-24 AI 自动质控三维度评估 (伪影/曝光/体位)
export interface AiDimensionAssessment {
  score: number // 0-100
  label: string
  issues: string[]
}

export interface AiAssessDto {
  studyId: string
  instanceId?: string
  modality?: string
  bodyPart?: string
}

export interface AiAssessResult {
  studyId: string
  instanceId?: string
  modality: string
  bodyPart: string
  assessedAt: string
  artifact: AiDimensionAssessment
  exposure: AiDimensionAssessment
  positioning: AiDimensionAssessment
  overall: { score: number; label: string }
}

/** [G005 Wave3A P16] 历史评估记录 (列表端点返回项) */
export interface AiAssessRecord extends AiAssessResult {
  id: string
}

export interface AiAssessmentsQuery {
  studyId?: string
  page?: number
  pageSize?: number
}

@Injectable()
export class ImageAiService {
  private store: Map<string, AiScoreResult> = new Map()
  private storeV2: Map<string, AiScoreResultV2> = new Map()
  private assessStore = new Map<string, AiAssessRecord>()
  private assessSeq = 0

  constructor(private readonly prisma?: PrismaService) {
    this.seedAssessments()
  }

  // [G005 Wave3A P16] 确定性 seed: 近 14 天历史评估记录 (内存, 无 DB 可跑)
  private seedAssessments(): void {
    const seedIds = ['EX-5001', 'EX-5002', 'EX-5003', 'EX-5004', 'EX-5005', 'STU20260701', 'STU20260702', 'STU20260703', 'STU20260704', 'STU20260705', 'STU20260706', 'STU20260707']
    const seedMods = ['CT', 'MR', 'DR', 'CT', 'MG', 'DR', 'CT', 'MR', 'DR', 'CT', 'MR', 'DR']
    const seedParts = ['头颅', '胸部', '腹部', '腰椎', '胸部', '颈椎', '胸部', '头颅', '胸部', '盆腔', '腰椎', '胸部']
    for (let i = 0; i < seedIds.length; i++) {
      const at = new Date(Date.now() - (i + 1) * 86400000).toISOString()
      const result = this.computeAssess(
        { studyId: seedIds[i]!, modality: seedMods[i]!, bodyPart: seedParts[i]! },
        at,
      )
      this.assessStore.set(result.id, result)
    }
  }

  private computeAssess(dto: AiAssessDto, at = new Date().toISOString()): AiAssessRecord {
    const modality = dto.modality ?? 'CT'
    const bodyPart = dto.bodyPart ?? '常规'
    const seed = this.seedFrom(`${dto.studyId}:${dto.instanceId ?? ''}`)
    const m = modality.toUpperCase()
    const bp = bodyPart

    // 各维度基线(0-100): 模态/部位风险因子
    let artifactBase = 88
    if (m === 'MR') artifactBase = 80 // 运动伪影高发
    if (m === 'CT') artifactBase = 84
    if (m === 'DR' || m === 'CR') artifactBase = 86
    if (m === 'MG') artifactBase = 82
    if (['头', '头颅', '头部', 'BRAIN'].some((k) => bp.includes(k))) artifactBase += 2

    let exposureBase = 90
    if (m === 'DR' || m === 'CR') exposureBase = 82 // 曝光不当高发
    if (m === 'MG') exposureBase = 85
    if (m === 'MR') exposureBase = 92
    if (m === 'US') exposureBase = 95

    let positioningBase = 88
    if (m === 'DR' || m === 'CR') positioningBase = 80 // 摆位偏移高发
    if (m === 'MG') positioningBase = 78
    if (m === 'MR') positioningBase = 90
    if (['脊柱', '颈椎', '腰椎', 'SPINE'].some((k) => bp.includes(k))) positioningBase -= 3

    const artifactScore = this.clamp(Math.round(artifactBase - seed.d0 * 14))
    const exposureScore = this.clamp(Math.round(exposureBase - seed.d1 * 12))
    const positioningScore = this.clamp(Math.round(positioningBase - seed.d2 * 14))
    const overall = this.clamp(Math.round(artifactScore * 0.35 + exposureScore * 0.3 + positioningScore * 0.35))

    const issues = {
      artifact: this.artifactIssues(artifactScore, m),
      exposure: this.exposureIssues(exposureScore, m),
      positioning: this.positioningIssues(positioningScore, m),
    }

    const result: AiAssessResult = {
      studyId: dto.studyId,
      ...(dto.instanceId ? { instanceId: dto.instanceId } : {}),
      modality,
      bodyPart,
      assessedAt: at,
      artifact: { score: artifactScore, label: this.dimLabel(artifactScore), issues: issues.artifact },
      exposure: { score: exposureScore, label: this.dimLabel(exposureScore), issues: issues.exposure },
      positioning: { score: positioningScore, label: this.dimLabel(positioningScore), issues: issues.positioning },
      overall: { score: overall, label: this.dimLabel(overall) },
    }
    return { id: `assess-${++this.assessSeq}`, ...result }
  }

  // [G005 Wave4A] G-24 三维度自动质控: 伪影/曝光/体位 + 总分
  // 数据来源: Exam(模态/部位)派生基线 + studyId/instanceId 确定性 seed, 无 DB 或查不到检查时仍返回确定性结果
  async assess(dto: AiAssessDto): Promise<AiAssessRecord> {
    let modality = dto.modality ?? ''
    let bodyPart = dto.bodyPart ?? ''
    if (this.prisma) {
      try {
        const exam = await this.prisma.exam.findUnique({
          where: { id: dto.studyId },
          select: { modality: true, bodyPart: true },
        })
        if (exam) {
          modality = exam.modality
          bodyPart = exam.bodyPart
        }
      } catch {
        // DB unavailable - keep input fields
      }
    }
    const record = this.computeAssess({ ...dto, modality, bodyPart })
    // 同检查号复用历史记录 (确定性语义: 同一 studyId 结果恒定)
    const existing = Array.from(this.assessStore.values()).find((r) => r.studyId === dto.studyId)
    if (existing) return existing
    this.assessStore.set(record.id, record)
    return record
  }

  /** [G005 Wave3A P16] 历史评估列表 (内存 + seed, 按时间倒序) */
  listAssessments(query: AiAssessmentsQuery = {}): AiAssessRecord[] {
    let items = Array.from(this.assessStore.values())
    if (query.studyId) items = items.filter((x) => x.studyId === query.studyId)
    items.sort((a, b) => new Date(b.assessedAt).getTime() - new Date(a.assessedAt).getTime())
    const page = Math.max(1, query.page ?? 1)
    const pageSize = Math.min(200, Math.max(1, query.pageSize ?? 50))
    return items.slice((page - 1) * pageSize, page * pageSize)
  }

  private seedFrom(text: string): { d0: number; d1: number; d2: number } {
    let h = 0
    for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0
    const rnd = (salt: number) => ((h >>> (salt % 28)) % 1000) / 1000
    return { d0: rnd(3), d1: rnd(7), d2: rnd(11) }
  }

  private clamp(v: number): number {
    return Math.max(55, Math.min(99, v))
  }

  private dimLabel(score: number): string {
    if (score >= 90) return '优秀'
    if (score >= 80) return '良好'
    if (score >= 70) return '一般'
    return '较差'
  }

  private artifactIssues(score: number, modality: string): string[] {
    const out: string[] = []
    if (score < 85) out.push('检测到轻微运动伪影，建议检查时固定患者体位')
    if (score < 75) out.push('局部金属/高密度伪影影响诊断区域')
    if (score < 65) out.push('环状伪影明显，建议重建参数校验')
    if (modality === 'MR' && score < 90) out.push('MR 序列存在呼吸运动干扰，建议屏气序列重扫')
    if (out.length === 0) out.push('未见明显伪影')
    return out
  }

  private exposureIssues(score: number, modality: string): string[] {
    const out: string[] = []
    if (score < 85) out.push('曝光参数偏暗，软组织对比度不足')
    if (score < 75) out.push('曝光过度，存在过曝区域，建议降低 mAs')
    if (score < 65) out.push('曝光严重不当，建议重新采集')
    if ((modality === 'DR' || modality === 'CR') && score < 90) out.push('DR 平片对比度偏低，建议调整窗宽窗位后重采')
    if (out.length === 0) out.push('曝光参数正常')
    return out
  }

  private positioningIssues(score: number, modality: string): string[] {
    const out: string[] = []
    if (score < 85) out.push('体位轻度旋转，解剖对称性欠佳')
    if (score < 75) out.push('检查部位偏移，边缘组织未完全覆盖')
    if (score < 65) out.push('摆位严重偏移，建议重新摆位后检查')
    if (modality === 'MG' && score < 90) out.push('乳腺压迫与位置有待优化，影响成像范围')
    if (out.length === 0) out.push('体位摆位正确')
    return out
  }

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

  // [G005 Wave1A W9] 评分记录列表 (前端 qcImageAiApi.listResults V1 对齐 V2:
  //   GET /qc/image-ai/result-v2 返回全部 V2 评分, 按 modality/operatorId/日期过滤)
  listV2(query: AiStatsQuery = {}): AiScoreResultV2[] {
    let items = Array.from(this.storeV2.values())
    if (query.modality) items = items.filter(x => x.modality === query.modality)
    if (query.operatorId) items = items.filter(x => x.operatorId === query.operatorId)
    if (query.dateFrom) items = items.filter(x => new Date(x.createdAt) >= new Date(query.dateFrom!))
    if (query.dateTo) items = items.filter(x => new Date(x.createdAt) <= new Date(query.dateTo!))
    return items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
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
