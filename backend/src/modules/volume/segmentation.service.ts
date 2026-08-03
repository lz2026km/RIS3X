/**
 * G005 RIS - 3D 分割与定量服务 (对标 Siemens Lesion Quantification / Canon 3D 分割)
 *
 * - 体数据: 复用 VolumeService.loadRealVolume 读取真实 DICOM (CT 为 HU, 物理尺寸 PixelSpacing/SliceThickness);
 *   无真实数据时回退确定性合成体数据。
 * - 算法 (确定性, 纯 Node, 无随机):
 *   - bone  : HU > 300 阈值 → 内部最大连通域
 *   - lung  : HU < -500 阈值 → 排除贴边界(体外空气)连通域 → 最大连通域
 *   - liver : HU ∈ [40, 160] 阈值 → 内部最大连通域
 *   - nodule: 有种子 → 区域生长 (26 邻域, HU ∈ [thresholdMin, thresholdMax], 默认 -100~100) + 形态学膨胀;
 *             无种子 → HU 阈值区间候选连通域 (内部最大候选)
 * - 定量: 体积 cm³ / mean/max/min HU / 体素数 / bbox / 表面积 (面片法) / 密度 (mean HU)
 * - 掩码: 每 8 层一张 2D 二值图 (bit 打包 base64) + 中心三平面
 * - 落库: 写入 RadiomicsFeature (instanceUid=seriesUID, roiId=segId, category=target)
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { VolumeService, type RealVolume } from './volume.service'

export type SegmentationTarget = 'nodule' | 'bone' | 'liver' | 'lung'

export interface SeedPoint {
  x: number
  y: number
  z: number
}

export interface SegmentationRequest {
  seriesUID: string
  target: SegmentationTarget
  thresholdMin?: number
  thresholdMax?: number
  seed?: SeedPoint
  minVoxels?: number
  maxVoxels?: number
}

export interface Bbox3d {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

export interface SegmentationStats {
  segId: string
  seriesUID: string
  target: SegmentationTarget
  source: 'real' | 'synthetic'
  jobId: string | null
  volumeCm3: number
  meanHu: number
  maxHu: number
  minHu: number
  voxelCount: number
  bbox: Bbox3d
  surfaceAreaCm2: number
  density: number
  createdAt: string
}

export interface MaskSlicePayload {
  plane: 'axial' | 'sagittal' | 'coronal'
  index: number
  width: number
  height: number
  dataBase64: string
}

export interface SegmentationResult extends SegmentationStats {
  maskSlices: MaskSlicePayload[]
  centerSlices: MaskSlicePayload[]
}

export interface HistogramBin {
  rangeMin: number
  rangeMax: number
  count: number
}

export interface QuantifyResult {
  segId: string
  seriesUID: string
  target: SegmentationTarget
  binCount: number
  bins: HistogramBin[]
}

export interface SegmentationHistoryItem {
  id: string
  seriesUID: string
  target: string
  source: string
  approved: boolean
  createdAt: string
  volumeCm3: number
  meanHu: number
  maxHu: number
  minHu: number
  voxelCount: number
  surfaceAreaCm2: number
  features: Array<{ category: string; name: string; value: number; unit: string }>
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

interface CachedSegment {
  stats: SegmentationStats
  bins: HistogramBin[]
}

/** 各目标默认 HU 阈值范围 (CT) */
const TARGET_RANGE: Record<SegmentationTarget, [number, number]> = {
  bone: [300, 3071],
  lung: [-1024, -500],
  liver: [40, 160],
  nodule: [-100, 100],
}

const HISTOGRAM_BIN_COUNT = 24

@Injectable()
export class SegmentationService {
  private readonly logger = new Logger(SegmentationService.name)
  /** segId → 完整分割结果缓存 (quantify 复用) */
  private readonly cache = new Map<string, CachedSegment>()
  /** DB 不可用时的内存回退存储 */
  private readonly memoryFeatures: PersistedFeature[] = []
  private readonly approvedIds = new Set<string>()

  constructor(
    private readonly prisma: PrismaService,
    private readonly volumeService: VolumeService,
  ) {}

  // ────────────────────────────────────────────────────────────────────────────
  // 主入口: 分割
  // ────────────────────────────────────────────────────────────────────────────

  async segment(req: SegmentationRequest): Promise<SegmentationResult> {
    const target = req.target
    const range: [number, number] = TARGET_RANGE[target]
    const lo = req.thresholdMin ?? range[0]
    const hi = req.thresholdMax ?? range[1]

    const loaded = await this.volumeService.loadRealVolume(req.seriesUID)
    let vol: RealVolume
    let source: 'real' | 'synthetic'
    let jobId: string | null
    if (loaded) {
      vol = loaded.real
      source = 'real'
      jobId = loaded.jobId
    } else {
      vol = this.buildSyntheticVolume(req.seriesUID)
      source = 'synthetic'
      jobId = null
    }

    const mask = this.computeMask(vol, target, lo, hi, req)
    const stats = this.computeStats(vol, mask, target, req.seriesUID, source, jobId)
    if (stats.voxelCount === 0) {
      return {
        ...stats,
        maskSlices: [],
        centerSlices: [],
      }
    }

    const maskSlices = this.buildMaskSlices(mask, vol)
    const centerSlices = this.buildCenterSlices(mask, vol, stats.bbox)
    const bins = this.buildHistogram(vol, mask)
    this.cache.set(stats.segId, { stats, bins })
    try {
      await this.persistFeatures(stats, bins)
    } catch (e) {
      this.logger.warn(`persist segmentation ${stats.segId} failed: ${(e as Error).message}`)
    }

    this.logger.log(`segment ${req.seriesUID} target=${target}: ${stats.voxelCount} voxels, ${stats.volumeCm3.toFixed(2)} cm3 (${source})`)
    return { ...stats, maskSlices, centerSlices }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 定量: HU 直方图
  // ────────────────────────────────────────────────────────────────────────────

  async quantify(segId: string): Promise<QuantifyResult> {
    const cached = this.cache.get(segId)
    if (!cached) throw new NotFoundException(`Segmentation ${segId} not found`)
    return {
      segId,
      seriesUID: cached.stats.seriesUID,
      target: cached.stats.target,
      binCount: cached.bins.length,
      bins: cached.bins,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 历史 (RadiomicsFeature 表按 roiId=segId 分组)
  // ────────────────────────────────────────────────────────────────────────────

  async listSegmentations(seriesUID: string): Promise<SegmentationHistoryItem[]> {
    const rows = await this.readFeatures(seriesUID)
    const bySeg = new Map<string, PersistedFeature[]>()
    for (const row of rows) {
      const list = bySeg.get(row.roiId) ?? []
      list.push(row)
      bySeg.set(row.roiId, list)
    }
    const out: SegmentationHistoryItem[] = []
    for (const [, list] of bySeg) {
      const get = (name: string, unit: string): number => {
        const hit = list.find((f) => f.featureName === name)
        return hit ? hit.value : 0
      }
      out.push({
        id: list[0]!.roiId,
        seriesUID,
        target: list[0]!.category ?? 'nodule',
        source: get('source', '1') === 1 ? 'real' : 'synthetic',
        approved: this.approvedIds.has(list[0]!.roiId),
        createdAt: list[0]!.createdAt.toISOString(),
        volumeCm3: get('volume', 'cm3'),
        meanHu: get('meanHu', 'HU'),
        maxHu: get('maxHu', 'HU'),
        minHu: get('minHu', 'HU'),
        voxelCount: get('voxelCount', 'vox'),
        surfaceAreaCm2: get('surfaceArea', 'cm2'),
        features: list.map((f) => ({ category: f.category ?? '', name: f.featureName, value: f.value, unit: f.unit ?? '' })),
      })
    }
    return out.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  }

  async approve(segId: string): Promise<{ id: string; approved: boolean }> {
    this.approvedIds.add(segId)
    return { id: segId, approved: true }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 分割算法 (确定性)
  // ────────────────────────────────────────────────────────────────────────────

  private computeMask(vol: RealVolume, target: SegmentationTarget, lo: number, hi: number, req: SegmentationRequest): Uint8Array {
    const total = vol.width * vol.height * vol.depth
    if (target === 'nodule' && req.seed) {
      const mask = this.regionGrow(vol, req.seed, lo, hi)
      return this.dilate3d(mask, vol.width, vol.height, vol.depth, 1)
    }
    const mask = this.thresholdMask(vol, lo, hi)
    const largest = this.largestInteriorComponent(mask, vol.width, vol.height, vol.depth)
    return this.dilate3d(largest, vol.width, vol.height, vol.depth, target === 'nodule' ? 1 : 0)
  }

  /** HU ∈ [lo, hi] 阈值掩码 */
  private thresholdMask(vol: RealVolume, lo: number, hi: number): Uint8Array {
    const total = vol.width * vol.height * vol.depth
    const mask = new Uint8Array(total)
    for (let i = 0; i < total; i++) {
      const v = vol.data[i]!
      mask[i] = v >= lo && v <= hi ? 1 : 0
    }
    return mask
  }

  /** 区域生长: 从种子在 [lo, hi] 内 26 邻域迭代连通 */
  private regionGrow(vol: RealVolume, seed: SeedPoint, lo: number, hi: number): Uint8Array {
    const { width: W, height: H, depth: D } = vol
    const sx = Math.max(0, Math.min(W - 1, Math.round(seed.x)))
    const sy = Math.max(0, Math.min(H - 1, Math.round(seed.y)))
    const sz = Math.max(0, Math.min(D - 1, Math.round(seed.z)))
    const mask = new Uint8Array(W * H * D)
    const seedValue = vol.data[sz * (W * H) + sy * W + sx]!
    if (seedValue < lo || seedValue > hi) return mask
    const stack: number[] = [sz * (W * H) + sy * W + sx]
    mask[stack[0]!] = 1
    while (stack.length > 0) {
      const idx = stack.pop()!
      const z = Math.floor(idx / (W * H))
      const y = Math.floor((idx % (W * H)) / W)
      const x = idx % W
      for (let dz = -1; dz <= 1; dz++) {
        const nz = z + dz
        if (nz < 0 || nz >= D) continue
        for (let dy = -1; dy <= 1; dy++) {
          const ny = y + dy
          if (ny < 0 || ny >= H) continue
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            if (nx < 0 || nx >= W) continue
            const nIdx = nz * (W * H) + ny * W + nx
            if (mask[nIdx]) continue
            const v = vol.data[nIdx]!
            if (v >= lo && v <= hi) {
              mask[nIdx] = 1
              stack.push(nIdx)
            }
          }
        }
      }
    }
    return mask
  }

  /** 连通域标记并取内部(不贴 XY 边界=体外空气)最大分量; 仅排除贴 x/y 边界的体外背景 */
  private largestInteriorComponent(mask: Uint8Array, W: number, H: number, D: number): Uint8Array {
    const total = W * H * D
    const labels = new Int32Array(total).fill(-1)
    const counts: number[] = []
    const touchesBorder: boolean[] = []
    let nextLabel = 0
    const stack: number[] = []
    for (let i = 0; i < total; i++) {
      if (mask[i] === 0 || labels[i] !== -1) continue
      labels[i] = nextLabel
      counts.push(0)
      touchesBorder.push(false)
      stack.length = 0
      stack.push(i)
      while (stack.length > 0) {
        const idx = stack.pop()!
        counts[nextLabel]!++
        const z = Math.floor(idx / (W * H))
        const y = Math.floor((idx % (W * H)) / W)
        const x = idx % W
        if (x === 0 || x === W - 1 || y === 0 || y === H - 1) touchesBorder[nextLabel] = true
        for (let dz = -1; dz <= 1; dz++) {
          const nz = z + dz
          if (nz < 0 || nz >= D) continue
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy
            if (ny < 0 || ny >= H) continue
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx
              if (nx < 0 || nx >= W) continue
              const nIdx = nz * (W * H) + ny * W + nx
              if (mask[nIdx] === 0 || labels[nIdx] !== -1) continue
              labels[nIdx] = nextLabel
              stack.push(nIdx)
            }
          }
        }
      }
      nextLabel++
    }
    let best = -1
    let bestCount = 0
    for (let l = 0; l < nextLabel; l++) {
      if (touchesBorder[l]) continue
      if (counts[l]! > bestCount) {
        bestCount = counts[l]!
        best = l
      }
    }
    const out = new Uint8Array(total)
    if (best === -1) return out
    for (let i = 0; i < total; i++) out[i] = labels[i] === best ? 1 : 0
    return out
  }

  /** 3D 形态学膨胀 (6 邻域) */
  private dilate3d(mask: Uint8Array, W: number, H: number, D: number, iterations: number): Uint8Array {
    if (iterations <= 0) return mask
    let cur = mask
    for (let it = 0; it < iterations; it++) {
      const next = new Uint8Array(W * H * D)
      for (let z = 0; z < D; z++) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            if (cur[z * (W * H) + y * W + x]) {
              for (let dz = -1; dz <= 1; dz++) {
                const nz = z + dz
                if (nz < 0 || nz >= D) continue
                for (let dy = -1; dy <= 1; dy++) {
                  const ny = y + dy
                  if (ny < 0 || ny >= H) continue
                  for (let dx = -1; dx <= 1; dx++) {
                    const nx = x + dx
                    if (nx < 0 || nx >= W) continue
                    if (dx === 0 && dy === 0 && dz === 0) continue
                    next[nz * (W * H) + ny * W + nx] = 1
                  }
                }
              }
            }
          }
        }
      }
      cur = next
    }
    return cur
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 定量统计
  // ────────────────────────────────────────────────────────────────────────────

  private computeStats(vol: RealVolume, mask: Uint8Array, target: SegmentationTarget, seriesUID: string, source: 'real' | 'synthetic', jobId: string | null): SegmentationStats {
    const { width: W, height: H, depth: D } = vol
    const px = vol.pixelSpacing[0]
    const py = vol.pixelSpacing[1]
    const pz = Math.max(vol.sliceThickness, 0.1)
    const voxelVol = (px * py * pz) / 1000 // cm³
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
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (mask[z * (W * H) + y * W + x]) {
            const v = vol.data[z * (W * H) + y * W + x]!
            count++
            sum += v
            if (v < min) min = v
            if (v > max) max = v
            if (x < minX) minX = x
            if (x > maxX) maxX = x
            if (y < minY) minY = y
            if (y > maxY) maxY = y
            if (z < minZ) minZ = z
            if (z > maxZ) maxZ = z
          }
        }
      }
    }
    if (count === 0) {
      return {
        segId: this.newSegId(),
        seriesUID,
        target,
        source,
        jobId,
        volumeCm3: 0,
        meanHu: 0,
        maxHu: 0,
        minHu: 0,
        voxelCount: 0,
        bbox: { x: 0, y: 0, z: 0, w: 0, h: 0, d: 0 },
        surfaceAreaCm2: 0,
        density: 0,
        createdAt: new Date().toISOString(),
      }
    }
    // 表面积: 统计暴露面数 (每轴缺失邻域 +2 面)
    let facesX = 0
    let facesY = 0
    let facesZ = 0
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!mask[z * (W * H) + y * W + x]) continue
          const idx = z * (W * H) + y * W + x
          facesX += x === 0 || !mask[idx - 1] ? 2 : 0
          facesY += y === 0 || !mask[idx - W] ? 2 : 0
          facesZ += z === 0 || !mask[idx - W * H] ? 2 : 0
        }
      }
    }
    const surfaceAreaCm2 = facesX * (py * pz) + facesY * (px * pz) + facesZ * (px * py)
    const meanHu = sum / count
    const bbox: Bbox3d = { x: minX, y: minY, z: minZ, w: maxX - minX + 1, h: maxY - minY + 1, d: maxZ - minZ + 1 }
    return {
      segId: this.newSegId(),
      seriesUID,
      target,
      source,
      jobId,
      volumeCm3: count * voxelVol,
      meanHu: +meanHu.toFixed(2),
      maxHu: max,
      minHu: min,
      voxelCount: count,
      bbox,
      surfaceAreaCm2: +surfaceAreaCm2.toFixed(2),
      density: +meanHu.toFixed(2),
      createdAt: new Date().toISOString(),
    }
  }

  /** HU 直方图: 固定 24 桶 (覆盖体数据值域) */
  private buildHistogram(vol: RealVolume, mask: Uint8Array): HistogramBin[] {
    const { width: W, height: H, depth: D } = vol
    const bins = Array.from({ length: HISTOGRAM_BIN_COUNT }, () => 0)
    const span = vol.max - vol.min
    if (span <= 0) return bins.map((count, i) => ({ rangeMin: vol.min, rangeMax: vol.max, count }))
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (mask[z * (W * H) + y * W + x]) {
            const v = vol.data[z * (W * H) + y * W + x]!
            let b = Math.floor(((v - vol.min) / span) * HISTOGRAM_BIN_COUNT)
            if (b >= HISTOGRAM_BIN_COUNT) b = HISTOGRAM_BIN_COUNT - 1
            bins[b]!++
          }
        }
      }
    }
    return bins.map((count, i) => {
      const lo = vol.min + (span * i) / HISTOGRAM_BIN_COUNT
      const hi = vol.min + (span * (i + 1)) / HISTOGRAM_BIN_COUNT
      return { rangeMin: +lo.toFixed(1), rangeMax: +hi.toFixed(1), count }
    })
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 掩码输出 (每 8 层轴向 + 中心三平面)
  // ────────────────────────────────────────────────────────────────────────────

  private buildMaskSlices(mask: Uint8Array, vol: RealVolume): MaskSlicePayload[] {
    const { width: W, height: H, depth: D } = vol
    const out: MaskSlicePayload[] = []
    const step = 8
    for (let z = 0; z < D; z += step) {
      const slice = new Uint8Array(W * H)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) slice[y * W + x] = mask[z * (W * H) + y * W + x]
      }
      out.push({ plane: 'axial', index: z, width: W, height: H, dataBase64: packBits(slice) })
    }
    return out
  }

  private buildCenterSlices(mask: Uint8Array, vol: RealVolume, bbox: Bbox3d): MaskSlicePayload[] {
    const { width: W, height: H, depth: D } = vol
    const cx = Math.min(W - 1, Math.round(bbox.x + bbox.w / 2))
    const cy = Math.min(H - 1, Math.round(bbox.y + bbox.h / 2))
    const cz = Math.min(D - 1, Math.round(bbox.z + bbox.d / 2))
    const out: MaskSlicePayload[] = []
    // 轴向
    {
      const slice = new Uint8Array(W * H)
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) slice[y * W + x] = mask[cz * (W * H) + y * W + x]
      out.push({ plane: 'axial', index: cz, width: W, height: H, dataBase64: packBits(slice) })
    }
    // 矢状面: 与 MPR 同尺寸 H × round(D*th/py)
    {
      const outH = Math.max(1, Math.round((D * Math.max(vol.sliceThickness, 0.1)) / vol.pixelSpacing[1]))
      const raw = new Float32Array(H * D)
      for (let z = 0; z < D; z++) for (let y = 0; y < H; y++) raw[z * H + y] = mask[z * (W * H) + y * W + cx]
      const grid = this.resampleMask(raw, H, D, H, outH)
      out.push({ plane: 'sagittal', index: cx, width: H, height: outH, dataBase64: packBits(grid) })
    }
    // 冠状面: W × round(D*th/px)
    {
      const outH = Math.max(1, Math.round((D * Math.max(vol.sliceThickness, 0.1)) / vol.pixelSpacing[0]))
      const raw = new Float32Array(W * D)
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) raw[z * W + x] = mask[z * (W * H) + cy * W + x]
      const grid = this.resampleMask(raw, W, D, W, outH)
      out.push({ plane: 'coronal', index: cy, width: W, height: outH, dataBase64: packBits(grid) })
    }
    return out
  }

  /** 掩码重采样 (最近邻, 与 MPR 输出尺寸对齐) */
  private resampleMask(src: Float32Array, srcW: number, srcH: number, outW: number, outH: number): Uint8Array {
    const out = new Uint8Array(outW * outH)
    if (outW === srcW && outH === srcH) {
      for (let i = 0; i < src.length; i++) out[i] = src[i] ? 1 : 0
      return out
    }
    for (let oy = 0; oy < outH; oy++) {
      const sy = Math.min(srcH - 1, Math.floor(((oy + 0.5) * srcH) / outH))
      for (let ox = 0; ox < outW; ox++) {
        const sx = Math.min(srcW - 1, Math.floor(((ox + 0.5) * srcW) / outW))
        out[oy * outW + ox] = src[sy * srcW + sx] ? 1 : 0
      }
    }
    return out
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 落库 (RadiomicsFeature)
  // ────────────────────────────────────────────────────────────────────────────

  private async persistFeatures(stats: SegmentationStats, bins: HistogramBin[]): Promise<void> {
    const features = [
      { category: stats.target, featureName: 'volume', value: stats.volumeCm3, unit: 'cm3' },
      { category: stats.target, featureName: 'meanHu', value: stats.meanHu, unit: 'HU' },
      { category: stats.target, featureName: 'maxHu', value: stats.maxHu, unit: 'HU' },
      { category: stats.target, featureName: 'minHu', value: stats.minHu, unit: 'HU' },
      { category: stats.target, featureName: 'voxelCount', value: stats.voxelCount, unit: 'vox' },
      { category: stats.target, featureName: 'surfaceArea', value: stats.surfaceAreaCm2, unit: 'cm2' },
      { category: stats.target, featureName: 'density', value: stats.density, unit: 'HU' },
      { category: stats.target, featureName: 'source', value: stats.source === 'real' ? 1 : 0, unit: '1' },
      { category: 'histogram', featureName: 'bins', value: bins.length, unit: 'bin' },
    ]
    try {
      await this.prisma.radiomicsFeature.createMany({
        data: features.map((f) => ({
          instanceUid: stats.seriesUID,
          roiId: stats.segId,
          category: f.category,
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
          id: `${stats.segId}-${f.featureName}`,
          instanceUid: stats.seriesUID,
          roiId: stats.segId,
          category: f.category,
          featureName: f.featureName,
          value: f.value,
          unit: f.unit,
          createdAt: now,
        })
      }
    }
  }

  private async readFeatures(seriesUID: string): Promise<PersistedFeature[]> {
    try {
      return (await this.prisma.radiomicsFeature.findMany({ where: { instanceUid: seriesUID } })) as unknown as PersistedFeature[]
    } catch (e) {
      this.logger.warn(`radiomicsFeature unavailable, read from memory: ${(e as Error).message}`)
      return this.memoryFeatures.filter((f) => f.instanceUid === seriesUID)
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 合成回退体数据 (确定性, 无随机)
  // ────────────────────────────────────────────────────────────────────────────

  private buildSyntheticVolume(seriesUID: string): RealVolume {
    const W = 512
    const H = 512
    const D = 32
    const data = new Int16Array(W * H * D)
    const cx = W / 2
    const cy = H / 2
    let min = Infinity
    let max = -Infinity
    for (let z = 0; z < D; z++) {
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let v = -1000
          const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2 + ((z - D / 2) * 2) ** 2)
          if (d < 120) v = 900 // 骨球
          else if (d < 200) v = 30 // 软组织
          else if (d < 240) v = -800 // 肺样环
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

  private newSegId(): string {
    return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
}

/** bit 打包 (每像素 1 bit, MSB 在前) → base64 */
function packBits(mask: Uint8Array): string {
  const byteLen = Math.ceil(mask.length / 8)
  const buf = Buffer.alloc(byteLen)
  for (let i = 0; i < mask.length; i++) {
    if (mask[i]) buf[i >> 3] |= 0x80 >> (i & 7)
  }
  return buf.toString('base64')
}
