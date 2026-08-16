/**
 * [v3.0.6.11-101 Wave 2C] 影像分割深化 — 分割结果管理服务
 *
 * - 体数据: 复用 VolumeService.loadRealVolume (真实 DICOM); 无真实数据时确定性合成回退
 * - 结果: RLE 编码 3D 掩码 + 逐轴向切片 RLE + 统计 (面积/体积/平均强度/边界点数)
 * - 持久化: RadiomicsFeature 落库 (category=segv2, roiId=segId), DB 不可用回退内存;
 *   孤儿模块模式: 独立可用 (内存 CRUD + 确定性 seed 演示数据)
 * - 测量联动: 分割体积 → 等效球直径 (mm) → 病灶追踪测量 (创建/追加)
 */
import { Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { VolumeService, type RealVolume } from '../volume/volume.service'
import { LesionTrackingService } from '../lesion-tracking/lesion-tracking.service'
import {
  ALGORITHM_LABEL,
  countVoxels,
  decodeRle,
  encodeRle,
  runActiveContour,
  runEdgeCanny,
  runKmeans,
  runRegionGrow,
  runThreshold,
  countBoundaryPoints,
  type AlgorithmParams,
  type OrganClass,
  type RleRun,
  type RunOutcome,
  type SeedPoint,
  type SegmentationAlgorithm,
  type ThresholdMode,
} from './segmentation-v2.algorithms'

export interface SegmentBbox {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

export interface SegmentStats {
  voxelCount: number
  volumeCm3: number
  /** 轴向各切片 2D 面积之和 (cm²) */
  areaCm2: number
  meanIntensity: number
  minIntensity: number
  maxIntensity: number
  /** 3D 边界点数 (至少一个 6 邻域在掩码外) */
  boundaryPointCount: number
  bbox: SegmentBbox
}

export interface SliceRle {
  z: number
  width: number
  height: number
  runs: RleRun[]
}

export interface LinkedMeasurement {
  measurementId: string
  lesionId: string | null
  /** 等效球直径 (mm) */
  diameterMm: number
  studyId: string
  date: string
  notes?: string
}

export interface SegmentationV2Segment {
  id: string
  seriesUID: string
  algorithm: SegmentationAlgorithm
  algorithmLabel: string
  thresholdMode?: ThresholdMode
  params: AlgorithmParams
  label: string
  color: string
  organClass: OrganClass
  source: 'real' | 'synthetic'
  /** 是否回退 (无种子阈值模式 / 合成体积) */
  usedFallback: boolean
  stats: SegmentStats
  dims: { width: number; height: number; depth: number }
  pixelSpacing: [number, number]
  sliceThickness: number
  rle3d: RleRun[]
  slices: SliceRle[]
  linkedMeasurement: LinkedMeasurement | null
  createdAt: string
}

export interface SegmentSummary {
  id: string
  seriesUID: string
  algorithm: SegmentationAlgorithm
  algorithmLabel: string
  label: string
  color: string
  organClass: OrganClass
  source: 'real' | 'synthetic'
  usedFallback: boolean
  stats: SegmentStats
  linkedMeasurement: LinkedMeasurement | null
  createdAt: string
}

export interface HistoryItem {
  id: string
  seriesUID: string
  algorithm: SegmentationAlgorithm
  label: string
  organClass: OrganClass
  status: 'active' | 'deleted'
  voxelCount: number
  volumeCm3: number
  createdAt: string
}

export interface RunRequest {
  seriesUID: string
  algorithm: SegmentationAlgorithm
  params?: AlgorithmParams
}

interface PersistedFeature {
  id: string
  instanceUid: string
  roiId: string
  category: string | null
  featureName: string
  value: number
  unit: string | null
  createdAt: Date
}

const ALGORITHM_COLOR: Record<SegmentationAlgorithm, string> = {
  region_grow: '#ff4d4f',
  threshold: '#fa8c16',
  edge_canny: '#2563eb',
  kmeans: '#722ed1',
  active_contour: '#52c41a',
}

const DEFAULT_LABEL: Record<SegmentationAlgorithm, string> = {
  region_grow: '区域生长分割',
  threshold: '阈值分割',
  edge_canny: 'Canny 边缘',
  kmeans: 'K-means 聚类',
  active_contour: '活动轮廓',
}

const ORGAN_BY_INTENSITY: Array<{ organ: OrganClass; lo: number; hi: number }> = [
  { organ: '骨骼', lo: 300, hi: 3071 },
  { organ: '肺', lo: -1024, hi: -500 },
  { organ: '软组织', lo: -100, hi: 100 },
  { organ: '肝脏', lo: 40, hi: 160 },
  { organ: '血管', lo: 120, hi: 400 },
]

function organForStats(stats: SegmentStats): OrganClass {
  if (stats.voxelCount === 0) return '其他'
  const mean = stats.meanIntensity
  let best: OrganClass = '其他'
  let bestScore = -Infinity
  for (const rule of ORGAN_BY_INTENSITY) {
    const mid = (rule.lo + rule.hi) / 2
    const score = rule.lo <= mean && mean <= rule.hi ? 0 - Math.abs(mean - mid) : -Infinity
    if (score > bestScore) {
      bestScore = score
      best = rule.organ
    }
  }
  return best
}

function equivalentDiameterMm(volumeCm3: number): number {
  if (volumeCm3 <= 0) return 0
  // V = 4/3·π·r³ → d = 2·(3V/4π)^(1/3), cm³ → mm³ ×1000
  return +((2 * Math.cbrt((3 * volumeCm3 * 1000) / (4 * Math.PI)))).toFixed(2)
}

const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const ISO_DAY = (offsetDays = 0): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

@Injectable()
export class SegmentationV2Service {
  private readonly logger = new Logger(SegmentationV2Service.name)
  /** 进程内存结果存储 (孤儿模块: DB 不可用仍完整可用) */
  private readonly segments = new Map<string, SegmentationV2Segment>()
  /** 历史运行日志 (删除保留) */
  private readonly runLog: HistoryItem[] = []
  private readonly memoryFeatures: PersistedFeature[] = []

  constructor(
    private readonly prisma: PrismaService,
    private readonly volumeService: VolumeService,
    @Optional() private readonly lesionTracking?: LesionTrackingService,
  ) {
    this.seedDemoSegments()
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 分割执行
  // ────────────────────────────────────────────────────────────────────────────

  async run(req: RunRequest): Promise<SegmentationV2Segment> {
    const params: AlgorithmParams = {
      thresholdLo: req.params?.thresholdLo,
      thresholdHi: req.params?.thresholdHi,
      thresholdMode: req.params?.thresholdMode,
      seed: req.params?.seed,
      sigma: req.params?.sigma,
      edgeLow: req.params?.edgeLow,
      edgeHigh: req.params?.edgeHigh,
      iterations: req.params?.iterations,
      minVoxels: req.params?.minVoxels,
    }
    const loaded = await this.volumeService.loadRealVolume(req.seriesUID)
    let vol: RealVolume
    let source: 'real' | 'synthetic'
    if (loaded) {
      vol = loaded.real
      source = 'real'
    } else {
      vol = this.buildSyntheticVolume(req.seriesUID)
      source = 'synthetic'
    }

    let outcome: RunOutcome
    if (req.algorithm === 'region_grow') {
      outcome = runRegionGrow(vol, params)
    } else if (req.algorithm === 'threshold') {
      outcome = runThreshold(vol, params)
    } else if (req.algorithm === 'edge_canny') {
      outcome = runEdgeCanny(vol, params)
    } else if (req.algorithm === 'kmeans') {
      outcome = runKmeans(vol, params)
    } else {
      outcome = runActiveContour(vol, params)
    }

    const stats = this.computeStats(vol, outcome.mask)
    const usedFallback = source === 'synthetic' || outcome.usedFallback
    const seg: SegmentationV2Segment = {
      id: newId('segv2'),
      seriesUID: req.seriesUID,
      algorithm: req.algorithm,
      algorithmLabel: ALGORITHM_LABEL[req.algorithm],
      thresholdMode: params.thresholdMode,
      params: this.sanitizeParams(params),
      label: DEFAULT_LABEL[req.algorithm],
      color: ALGORITHM_COLOR[req.algorithm],
      organClass: organForStats(stats),
      source,
      usedFallback,
      stats,
      dims: { width: vol.width, height: vol.height, depth: vol.depth },
      pixelSpacing: [vol.pixelSpacing[0], vol.pixelSpacing[1]],
      sliceThickness: vol.sliceThickness,
      rle3d: encodeRle(outcome.mask),
      slices: this.buildSliceRles(outcome.mask, vol),
      linkedMeasurement: null,
      createdAt: new Date().toISOString(),
    }
    this.segments.set(seg.id, seg)
    this.runLog.push({
      id: seg.id,
      seriesUID: seg.seriesUID,
      algorithm: seg.algorithm,
      label: seg.label,
      organClass: seg.organClass,
      status: 'active',
      voxelCount: seg.stats.voxelCount,
      volumeCm3: seg.stats.volumeCm3,
      createdAt: seg.createdAt,
    })
    try {
      await this.persistFeatures(seg)
    } catch (e) {
      this.logger.warn(`persist segv2 ${seg.id} failed: ${(e as Error).message}`)
    }
    this.logger.log(
      `run ${req.seriesUID} algorithm=${req.algorithm}: ${seg.stats.voxelCount} voxels, ${seg.stats.volumeCm3.toFixed(2)} cm3 (${source}${outcome.usedFallback ? ', fallback' : ''})`,
    )
    return seg
  }

  private sanitizeParams(params: AlgorithmParams): AlgorithmParams {
    const out: AlgorithmParams = {}
    if (params.thresholdLo !== undefined) out.thresholdLo = params.thresholdLo
    if (params.thresholdHi !== undefined) out.thresholdHi = params.thresholdHi
    if (params.thresholdMode !== undefined) out.thresholdMode = params.thresholdMode
    if (params.seed) out.seed = { x: params.seed.x, y: params.seed.y, z: params.seed.z }
    if (params.sigma !== undefined) out.sigma = params.sigma
    if (params.edgeLow !== undefined) out.edgeLow = params.edgeLow
    if (params.edgeHigh !== undefined) out.edgeHigh = params.edgeHigh
    if (params.iterations !== undefined) out.iterations = params.iterations
    if (params.minVoxels !== undefined) out.minVoxels = params.minVoxels
    return out
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 结果管理 (列表 / 详情 / 删除 / 标注)
  // ────────────────────────────────────────────────────────────────────────────

  async list(seriesUID: string): Promise<SegmentSummary[]> {
    const items = [...this.segments.values()]
      .filter((s) => s.seriesUID === seriesUID)
      .map((s) => this.toSummary(s))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    if (items.length === 0) {
      const persisted = await this.readPersistedStats(seriesUID)
      for (const p of persisted) {
        if (!this.segments.has(p.roiId)) {
          items.push({
            id: p.roiId,
            seriesUID,
            algorithm: p.algorithm,
            algorithmLabel: ALGORITHM_LABEL[p.algorithm],
            label: p.label,
            color: p.color,
            organClass: p.organClass,
            source: p.source,
            usedFallback: p.usedFallback,
            stats: p.stats,
            linkedMeasurement: null,
            createdAt: p.createdAt,
          })
        }
      }
    }
    return items
  }

  async get(id: string): Promise<SegmentationV2Segment> {
    const found = this.segments.get(id)
    if (!found) throw new NotFoundException(`分割结果 ${id} 不存在`)
    return found
  }

  async remove(id: string): Promise<{ id: string; deleted: boolean }> {
    const existed = this.segments.delete(id)
    if (!existed) throw new NotFoundException(`分割结果 ${id} 不存在`)
    const entry = this.runLog.find((h) => h.id === id)
    if (entry) entry.status = 'deleted'
    try {
      await this.prisma.radiomicsFeature.deleteMany({ where: { roiId: id } })
    } catch (e) {
      this.logger.warn(`deleteMany unavailable, remove from memory: ${(e as Error).message}`)
      for (let i = this.memoryFeatures.length - 1; i >= 0; i--) {
        if (this.memoryFeatures[i]!.roiId === id) this.memoryFeatures.splice(i, 1)
      }
    }
    this.logger.log(`segv2 deleted: ${id}`)
    return { id, deleted: true }
  }

  async annotate(id: string, dto: { label?: string; color?: string; organClass?: OrganClass }): Promise<SegmentationV2Segment> {
    const seg = this.require(id)
    if (dto.label !== undefined && dto.label.trim().length > 0) seg.label = dto.label.trim()
    if (dto.color !== undefined && dto.color.trim().length > 0) seg.color = dto.color.trim()
    if (dto.organClass !== undefined) seg.organClass = dto.organClass
    this.segments.set(id, seg)
    const entry = this.runLog.find((h) => h.id === id)
    if (entry) {
      entry.label = seg.label
      entry.organClass = seg.organClass
    }
    return seg
  }

  async history(seriesUID: string): Promise<HistoryItem[]> {
    return this.runLog
      .filter((h) => h.seriesUID === seriesUID)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 测量联动 (分割体积 → 等效球直径 → 病灶追踪)
  // ────────────────────────────────────────────────────────────────────────────

  async linkMeasurement(
    id: string,
    dto: { patientId?: string; lesionId?: string; sizeMm?: number; date?: string; notes?: string },
  ): Promise<SegmentationV2Segment> {
    const seg = this.require(id)
    const diameterMm = dto.sizeMm !== undefined && dto.sizeMm > 0 ? dto.sizeMm : equivalentDiameterMm(seg.stats.volumeCm3)
    if (diameterMm <= 0) {
      throw new NotFoundException(`分割结果 ${id} 为空, 无法生成测量`)
    }
    const date = dto.date ?? ISO_DAY(0)
    let measurementId = newId('segm')
    let lesionId: string | null = null
    if (dto.lesionId && this.lesionTracking) {
      const lesion = await this.lesionTracking.addMeasurement(dto.lesionId, {
        studyId: seg.seriesUID,
        sizeMm: diameterMm,
        date,
        notes: dto.notes ?? `分割联动 (${seg.label}, ${seg.id})`,
      })
      lesionId = lesion.id
      const last = lesion.measurements[lesion.measurements.length - 1]
      if (last) measurementId = last.id
    } else if (dto.patientId && this.lesionTracking) {
      const lesion = await this.lesionTracking.create({
        patientId: dto.patientId,
        name: `分割检出-${seg.label}`,
        site: seg.organClass === '肺' ? '胸部' : seg.organClass === '骨骼' ? '骨骼系统' : '影像检区',
        type: seg.organClass === '肺' ? '肺结节' : seg.organClass === '骨骼' ? '其他' : '其他',
        initialSizeMm: diameterMm,
        modality: 'CT',
        studyId: seg.seriesUID,
        source: 'manual',
      })
      lesionId = lesion.id
      const first = lesion.measurements[0]
      if (first) measurementId = first.id
    }
    seg.linkedMeasurement = {
      measurementId,
      lesionId,
      diameterMm,
      studyId: seg.seriesUID,
      date,
      notes: dto.notes,
    }
    this.segments.set(id, seg)
    this.logger.log(`segv2 ${id} linked measurement: ${diameterMm}mm (lesion=${lesionId ?? 'local'})`)
    return seg
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 统计计算
  // ────────────────────────────────────────────────────────────────────────────

  private computeStats(vol: RealVolume, mask: Uint8Array): SegmentStats {
    const { width: W, height: H, depth: D } = vol
    const px = vol.pixelSpacing[0]
    const py = vol.pixelSpacing[1]
    const pz = Math.max(vol.sliceThickness, 0.1)
    const voxelVol = (px * py * pz) / 1000
    let count = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity
    let minX = W
    let minY = H
    let minZ = D
    let maxX = -1
    let maxY = -1
    let maxZ = -1
    for (let z = 0; z < D; z++) {
      const base = z * (W * H)
      for (let i = 0; i < W * H; i++) {
        if (mask[base + i]) {
          const v = vol.data[base + i]!
          count++
          sum += v
          if (v < min) min = v
          if (v > max) max = v
          const x = i % W
          const y = Math.floor(i / W)
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
          if (z < minZ) minZ = z
          if (z > maxZ) maxZ = z
        }
      }
    }
    if (count === 0) {
      return {
        voxelCount: 0,
        volumeCm3: 0,
        areaCm2: 0,
        meanIntensity: 0,
        minIntensity: 0,
        maxIntensity: 0,
        boundaryPointCount: 0,
        bbox: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
      }
    }
    // 2D 面积: 逐轴向切片像素数 × px×py (mm²) → cm²
    let areaCm2 = 0
    for (let z = 0; z < D; z++) {
      const base = z * (W * H)
      let s = 0
      for (let i = 0; i < W * H; i++) if (mask[base + i]) s++
      if (s > 0) areaCm2 += (s * px * py) / 100
    }
    return {
      voxelCount: count,
      volumeCm3: count * voxelVol,
      areaCm2: +areaCm2.toFixed(2),
      meanIntensity: +(sum / count).toFixed(2),
      minIntensity: min,
      maxIntensity: max,
      boundaryPointCount: countBoundaryPoints(mask, W, H, D),
      bbox: { x: minX, y: minY, z: minZ, w: maxX - minX + 1, h: maxY - minY + 1, d: maxZ - minZ + 1 },
    }
  }

  private buildSliceRles(mask: Uint8Array, vol: RealVolume): SliceRle[] {
    const { width: W, height: H, depth: D } = vol
    const out: SliceRle[] = []
    for (let z = 0; z < D; z++) {
      const base = z * (W * H)
      const slice = mask.subarray(base, base + W * H)
      const runs = encodeRle(slice)
      if (runs.length > 0) out.push({ z, width: W, height: H, runs })
    }
    return out
  }

  private toSummary(seg: SegmentationV2Segment): SegmentSummary {
    return {
      id: seg.id,
      seriesUID: seg.seriesUID,
      algorithm: seg.algorithm,
      algorithmLabel: seg.algorithmLabel,
      label: seg.label,
      color: seg.color,
      organClass: seg.organClass,
      source: seg.source,
      usedFallback: seg.usedFallback,
      stats: seg.stats,
      linkedMeasurement: seg.linkedMeasurement,
      createdAt: seg.createdAt,
    }
  }

  private require(id: string): SegmentationV2Segment {
    const seg = this.segments.get(id)
    if (!seg) throw new NotFoundException(`分割结果 ${id} 不存在`)
    return seg
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 持久化 (RadiomicsFeature, DB 不可用回退内存)
  // ────────────────────────────────────────────────────────────────────────────

  private async persistFeatures(seg: SegmentationV2Segment): Promise<void> {
    const features = [
      { featureName: 'volume', value: seg.stats.volumeCm3, unit: 'cm3' },
      { featureName: 'area', value: seg.stats.areaCm2, unit: 'cm2' },
      { featureName: 'voxelCount', value: seg.stats.voxelCount, unit: 'vox' },
      { featureName: 'meanIntensity', value: seg.stats.meanIntensity, unit: 'HU' },
      { featureName: 'minIntensity', value: seg.stats.minIntensity, unit: 'HU' },
      { featureName: 'maxIntensity', value: seg.stats.maxIntensity, unit: 'HU' },
      { featureName: 'boundaryPointCount', value: seg.stats.boundaryPointCount, unit: 'px' },
      { featureName: 'algorithm', value: 0, unit: ALGORITHM_LABEL[seg.algorithm] },
      { featureName: 'source', value: seg.source === 'real' ? 1 : 0, unit: '1' },
      { featureName: 'usedFallback', value: seg.usedFallback ? 1 : 0, unit: '1' },
    ]
    try {
      await this.prisma.radiomicsFeature.createMany({
        data: features.map((f) => ({
          instanceUid: seg.seriesUID,
          roiId: seg.id,
          category: 'segv2',
          featureName: f.featureName,
          value: f.value,
          unit: f.unit,
        })),
      })
    } catch (e) {
      this.logger.warn(`radiomicsFeature unavailable, fallback to memory: ${(e as Error).message}`)
      const now = new Date()
      for (const f of features) {
        this.memoryFeatures.push({
          id: `${seg.id}-${f.featureName}`,
          instanceUid: seg.seriesUID,
          roiId: seg.id,
          category: 'segv2',
          featureName: f.featureName,
          value: f.value,
          unit: f.unit,
          createdAt: now,
        })
      }
    }
  }

  private async readPersistedStats(seriesUID: string): Promise<Array<{
    roiId: string
    algorithm: SegmentationAlgorithm
    label: string
    color: string
    organClass: OrganClass
    source: 'real' | 'synthetic'
    usedFallback: boolean
    stats: SegmentStats
    createdAt: string
  }>> {
    let rows: PersistedFeature[] = []
    try {
      rows = (await this.prisma.radiomicsFeature.findMany({
        where: { instanceUid: seriesUID, category: 'segv2' },
      })) as unknown as PersistedFeature[]
    } catch (e) {
      this.logger.warn(`radiomicsFeature unavailable, read from memory: ${(e as Error).message}`)
      rows = this.memoryFeatures.filter((f) => f.instanceUid === seriesUID)
    }
    const bySeg = new Map<string, PersistedFeature[]>()
    for (const row of rows) {
      const list = bySeg.get(row.roiId) ?? []
      list.push(row)
      bySeg.set(row.roiId, list)
    }
    const out: Array<{
      roiId: string
      algorithm: SegmentationAlgorithm
      label: string
      color: string
      organClass: OrganClass
      source: 'real' | 'synthetic'
      usedFallback: boolean
      stats: SegmentStats
      createdAt: string
    }> = []
    for (const [roiId, list] of bySeg) {
      const get = (name: string): number => {
        const hit = list.find((f) => f.featureName === name)
        return hit ? hit.value : 0
      }
      const algoUnit = list.find((f) => f.featureName === 'algorithm')?.unit
      const algorithm: SegmentationAlgorithm = algoUnit === '区域生长' ? 'region_grow'
        : algoUnit === '阈值分割' ? 'threshold'
          : algoUnit === 'Canny 边缘' ? 'edge_canny'
            : algoUnit === 'K-means 聚类' ? 'kmeans'
              : 'active_contour'
      out.push({
        roiId,
        algorithm,
        label: ALGORITHM_LABEL[algorithm],
        color: ALGORITHM_COLOR[algorithm],
        organClass: '其他',
        source: get('source') === 1 ? 'real' : 'synthetic',
        usedFallback: get('usedFallback') === 1,
        stats: {
          voxelCount: get('voxelCount'),
          volumeCm3: get('volume'),
          areaCm2: get('area'),
          meanIntensity: get('meanIntensity'),
          minIntensity: get('minIntensity'),
          maxIntensity: get('maxIntensity'),
          boundaryPointCount: get('boundaryPointCount'),
          bbox: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
        },
        createdAt: list[0]!.createdAt.toISOString(),
      })
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 确定性 seed 回退 (孤儿模块: 无 DB/无真实数据仍可演示)
  // ────────────────────────────────────────────────────────────────────────────

  private seedDemoSegments(): void {
    const uid = 'demo-segv2'
    const vol = this.buildSyntheticVolume(uid)
    const demos: Array<{ algorithm: SegmentationAlgorithm; params: AlgorithmParams }> = [
      { algorithm: 'threshold', params: { thresholdMode: 'manual', thresholdLo: 300, thresholdHi: 3071 } },
      { algorithm: 'kmeans', params: { thresholdLo: 40, thresholdHi: 160 } },
    ]
    for (const demo of demos) {
      const outcome = demo.algorithm === 'threshold'
        ? runThreshold(vol, demo.params)
        : runKmeans(vol, demo.params)
      const stats = this.computeStats(vol, outcome.mask)
      const seg: SegmentationV2Segment = {
        id: newId('segv2'),
        seriesUID: uid,
        algorithm: demo.algorithm,
        algorithmLabel: ALGORITHM_LABEL[demo.algorithm],
        thresholdMode: demo.params.thresholdMode,
        params: demo.params,
        label: DEFAULT_LABEL[demo.algorithm],
        color: ALGORITHM_COLOR[demo.algorithm],
        organClass: organForStats(stats),
        source: 'synthetic',
        usedFallback: false,
        stats,
        dims: { width: vol.width, height: vol.height, depth: vol.depth },
        pixelSpacing: [vol.pixelSpacing[0], vol.pixelSpacing[1]],
        sliceThickness: vol.sliceThickness,
        rle3d: encodeRle(outcome.mask),
        slices: this.buildSliceRles(outcome.mask, vol),
        linkedMeasurement: null,
        createdAt: new Date().toISOString(),
      }
      this.segments.set(seg.id, seg)
    }
  }

  /** 确定性合成回退体数据 (多器官: 骨球 + 软组织环 + 肺环 + 双结节) */
  private buildSyntheticVolume(seriesUID: string): RealVolume {
    const W = 512
    const H = 512
    const D = 32
    const data = new Int16Array(W * H * D)
    const cx = W / 2
    const cy = H / 2
    let min = Infinity
    let max = -Infinity
    const NODULE_1 = { x: 172, y: 256, z: 16, r: 16, v: 45 }
    const NODULE_2 = { x: 340, y: 256, z: 16, r: 14, v: -640 }
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let v = -1000
          const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + ((z - D / 2) * 2) ** 2)
          if (d < 110) v = 900
          else if (d < 190) v = 30
          else if (d < 230) v = -800
          const n1 = Math.sqrt((x - NODULE_1.x) ** 2 + (y - NODULE_1.y) ** 2 + ((z - NODULE_1.z) * 2) ** 2)
          if (n1 < NODULE_1.r) v = NODULE_1.v
          const n2 = Math.sqrt((x - NODULE_2.x) ** 2 + (y - NODULE_2.y) ** 2 + ((z - NODULE_2.z) * 2) ** 2)
          if (n2 < NODULE_2.r) v = NODULE_2.v
          data[z * (W * H) + y * W + x] = v
          if (v < min) min = v
          if (v > max) max = v
        }
      }
    }
    void seriesUID
    return {
      width: W,
      height: H,
      depth: D,
      data,
      min,
      max,
      windowWidth: 400,
      windowLevel: 40,
      rescaleSlope: 1,
      rescaleIntercept: -1024,
      pixelSpacing: [0.7, 0.7],
      sliceThickness: 5,
      modality: 'CT',
    }
  }

  /** 供测试/调试: RLE 解码校验 */
  decodeMask(seg: SegmentationV2Segment): Uint8Array {
    const total = seg.dims.width * seg.dims.height * seg.dims.depth
    return decodeRle(seg.rle3d, total)
  }

  /** 供前端种子选点: 坐标合法性校验 */
  clampSeed(seed: SeedPoint, dims: { width: number; height: number; depth: number }): SeedPoint {
    return {
      x: Math.max(0, Math.min(dims.width - 1, Math.round(seed.x))),
      y: Math.max(0, Math.min(dims.height - 1, Math.round(seed.y))),
      z: Math.max(0, Math.min(dims.depth - 1, Math.round(seed.z))),
    }
  }
}
