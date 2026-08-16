/**
 * G005 RIS - [v3.0.6.11-101 Wave 3A] 多平面重建 V2 服务
 *
 * 孤儿模块模式 (orphan module pattern):
 *   - 不强制依赖 Prisma / VolumeService: 两者均为可选注入 (constructor 参数可省略),
 *     无 DB 时自动回退内置确定性合成体数据 (seedSynthetic), 模块可独立挂载使用。
 *   - 所有算法为纯函数 + 确定性 (无随机), 相同输入 → 完全一致输出 (VR 输出确定性 spec)。
 *
 * 能力:
 *   - mprLinked: 三平面 (axial/coronal/sagittal) 联动切片 + 相交线参数 (三平面两两正交)
 *   - cpr      : 曲面重建 — 沿控制点折线弧长重采样拉直图像 + 三平面路径投影
 *   - vr       : 光线投射简化版 — 固定采样步长 + 传输函数 (灰度→颜色/不透明度 LUT) + yaw/pitch
 *   - cut      : 任意切面 (法向量 + 偏移) 裁剪体数据 → 截面图像 + 裁剪统计
 */
import { Injectable, Logger, Optional } from '@nestjs/common'
import { VolumeService, type RealVolume } from './volume.service'

export interface VolumeV2Dims {
  x: number
  y: number
  z: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface V2SlicePayload {
  dataBase64: string
  bitsAllocated: number
  signed: boolean
  width: number
  height: number
}

export interface V2PlaneSlice {
  plane: 'axial' | 'coronal' | 'sagittal'
  sliceIndex: number
  totalSlices: number
  width: number
  height: number
  windowWidth: number
  windowLevel: number
  crosshair: { h: number; v: number }
  pixelData: V2SlicePayload
}

export interface MprLinkedResult {
  jobId: string
  source: 'real' | 'synthetic'
  dims: VolumeV2Dims
  position: Vec3
  /** 三平面相交线参数: h=水平线位置, v=垂直线位置 (图像像素坐标) */
  lines: {
    axial: { h: number; v: number }
    coronal: { h: number; v: number }
    sagittal: { h: number; v: number }
  }
  planes: V2PlaneSlice[]
}

export interface CprPoint {
  x: number
  y: number
  z: number
}

export interface CprProjection {
  axial: Array<{ x: number; y: number }>
  coronal: Array<{ x: number; z: number }>
  sagittal: Array<{ y: number; z: number }>
}

export interface CprResult {
  jobId: string
  source: 'real' | 'synthetic'
  points: CprPoint[]
  spacing: number
  crossWidth: number
  totalLengthVoxels: number
  totalLengthMm: number
  sampleCount: number
  straightened: {
    width: number
    height: number
    windowWidth: number
    windowLevel: number
    pixelData: V2SlicePayload
  }
  projections: CprProjection
  dims: VolumeV2Dims
}

export type VrPreset = 'bone' | 'softTissue' | 'vessel'

export interface TransferFunctionEntry {
  hu: number
  r: number
  g: number
  b: number
  a: number
}

export interface VrResult {
  jobId: string
  source: 'real' | 'synthetic'
  width: number
  height: number
  yaw: number
  pitch: number
  preset: VrPreset
  sampleStep: number
  stepCount: number
  transferFunction: { lutSize: number; entries: TransferFunctionEntry[] }
  pixelData: { dataBase64: string; channels: number }
}

export interface CutResult {
  jobId: string
  source: 'real' | 'synthetic'
  normal: Vec3
  offset: number
  width: number
  height: number
  sectionImage: V2SlicePayload
  stats: { voxelsKept: number; voxelsTotal: number; keptRatio: number; clippedRatio: number }
  planeInfo: { center: Vec3; basisU: Vec3; basisV: Vec3 }
}

interface CachedVolume {
  jobId: string
  seriesUID: string
  source: 'real' | 'synthetic'
  volume: RealVolume
}

/** 传输函数预设: HU 区间 → 颜色 + 不透明度控制点 */
const TF_PRESETS: Record<VrPreset, { label: string; min: number; max: number; color: [number, number, number]; points: Array<[number, number]> }> = {
  bone: {
    label: '骨骼',
    min: -200,
    max: 3071,
    color: [1, 0.96, 0.87],
    points: [
      [0.0, 0.0],
      [0.32, 0.02],
      [0.45, 0.1],
      [0.6, 0.55],
      [0.8, 0.9],
      [1.0, 0.95],
    ],
  },
  softTissue: {
    label: '软组织',
    min: -1024,
    max: 1200,
    color: [0.96, 0.88, 0.9],
    points: [
      [0.0, 0.0],
      [0.35, 0.03],
      [0.52, 0.4],
      [0.7, 0.5],
      [1.0, 0.6],
    ],
  },
  vessel: {
    label: '血管',
    min: -1024,
    max: 2048,
    color: [1, 0.45, 0.42],
    points: [
      [0.0, 0.0],
      [0.5, 0.04],
      [0.62, 0.5],
      [0.75, 0.85],
      [1.0, 0.9],
    ],
  },
}

@Injectable()
export class VolumeV2Service {
  private readonly logger = new Logger(VolumeV2Service.name)
  private readonly cache = new Map<string, CachedVolume>()

  constructor(
    @Optional() private readonly volumeService?: VolumeService,
    @Optional() private readonly prisma?: any,
  ) {
    // 孤儿模块模式: volumeService / prisma 均可缺省 (无 DB / 独立挂载), 回退合成体。
    if (!volumeService) this.logger.log('VolumeV2Service: no VolumeService injected (orphan mode)')
    if (!prisma) this.logger.log('VolumeV2Service: no Prisma injected (orphan mode)')
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 体数据解析: jobId 缓存 > seriesUID 真实体 > 内置合成体 (确定性 seed)
  // ────────────────────────────────────────────────────────────────────────────

  async resolveVolume(jobId?: string, seriesUID?: string): Promise<CachedVolume> {
    if (jobId) {
      const hit = this.cache.get(jobId)
      if (hit) return hit
    }
    if (seriesUID && seriesUID !== 'synthetic') {
      try {
        const loaded = await this.loadReal(seriesUID)
        if (loaded) return loaded
      } catch (e) {
        this.logger.warn(`resolveVolume ${seriesUID}: ${(e as Error).message}, fallback synthetic`)
      }
    }
    return this.seedSynthetic()
  }

  private async loadReal(seriesUID: string): Promise<CachedVolume> {
    if (this.volumeService) {
      const res = await this.volumeService.loadRealVolume(seriesUID)
      if (res) {
        const jobId = `v2-${seriesUID}-${Date.now()}`
        const cached: CachedVolume = { jobId, seriesUID, source: 'real', volume: res.real }
        this.cache.set(jobId, cached)
        return cached
      }
      return this.seedSynthetic()
    }
    if (!this.prisma?.dicomInstance?.findMany) return this.seedSynthetic()
    const instances = await this.prisma.dicomInstance.findMany({ where: { seriesInstanceUid: seriesUID } })
    if (!instances?.length) return this.seedSynthetic()
    return this.seedSynthetic()
  }

  /**
   * 内置确定性合成体 (无 DB / 无真实数据回退): 128³ 层状结构
   *   -1000 背景 / 软组织核心球 (≈50 HU) / 骨壳 (≈800 HU) / 3 条血管管 (≈300 HU) / 中间带 (≈120 HU)
   */
  seedSynthetic(jobId = `v2-synthetic-${Date.now()}`): CachedVolume {
    const cached = this.cache.get(jobId)
    if (cached) return cached
    const size = 128
    const data = new Int16Array(size * size * size)
    const slice = size * size
    for (let z = 0; z < size; z++) {
      const nz = (z - (size - 1) / 2) / ((size - 1) / 2)
      for (let y = 0; y < size; y++) {
        const ny = (y - (size - 1) / 2) / ((size - 1) / 2)
        const row = z * slice + y * size
        for (let x = 0; x < size; x++) {
          const nx = (x - (size - 1) / 2) / ((size - 1) / 2)
          data[row + x] = syntheticVoxel(nx, ny, nz)
        }
      }
    }
    const volume: RealVolume = {
      width: size,
      height: size,
      depth: size,
      data,
      min: -1024,
      max: 3071,
      windowWidth: 1200,
      windowLevel: 40,
      rescaleSlope: 1,
      rescaleIntercept: 0,
      pixelSpacing: [1, 1],
      sliceThickness: 1,
      modality: 'CT',
    }
    const cachedVol: CachedVolume = { jobId, seriesUID: 'synthetic', source: 'synthetic', volume }
    this.cache.set(jobId, cachedVol)
    return cachedVol
  }

  getDims(jobId: string): VolumeV2Dims | null {
    const c = this.cache.get(jobId)
    if (!c) return null
    return { x: c.volume.width, y: c.volume.height, z: c.volume.depth }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MPR 三平面联动 (axial/coronal/sagittal 两两正交) + 相交线参数
  // ────────────────────────────────────────────────────────────────────────────

  async mprLinked(data: { jobId?: string; seriesUID?: string; position: Vec3 }): Promise<MprLinkedResult> {
    const cached = await this.resolveVolume(data.jobId, data.seriesUID)
    const vol = cached.volume
    const { width: W, height: H, depth: D } = vol
    const x = clamp(Math.round(data.position.x), 0, W - 1)
    const y = clamp(Math.round(data.position.y), 0, H - 1)
    const z = clamp(Math.round(data.position.z), 0, D - 1)

    const zScale = Math.max(vol.sliceThickness, 0.1) / Math.max(vol.pixelSpacing[1], 0.1)
    const axialW = W
    const axialH = H
    const coronalH = Math.max(2, Math.round(D * zScale))
    const sagittalH = Math.max(2, Math.round(D * zScale))

    // axial: 切片 z, 水平线在 y, 垂直线在 x
    const axial = new Float32Array(axialW * axialH)
    for (let yy = 0; yy < H; yy++) {
      for (let xx = 0; xx < W; xx++) {
        axial[yy * axialW + xx] = vol.data[z * (W * H) + yy * W + xx]
      }
    }
    // coronal: 切片 y, 轴 x 水平 / 轴 z 垂直 (等比拉伸)
    const coronal = new Float32Array(W * coronalH)
    for (let yy = 0; yy < coronalH; yy++) {
      const zz = Math.min(D - 1, (yy / Math.max(1, coronalH - 1)) * (D - 1))
      for (let xx = 0; xx < W; xx++) {
        coronal[yy * W + xx] = vol.data[Math.round(zz) * (W * H) + y * W + xx]
      }
    }
    // sagittal: 切片 x, 轴 y 水平 / 轴 z 垂直
    const sagittal = new Float32Array(H * sagittalH)
    for (let yy = 0; yy < sagittalH; yy++) {
      const zz = Math.min(D - 1, (yy / Math.max(1, sagittalH - 1)) * (D - 1))
      for (let xx = 0; xx < H; xx++) {
        sagittal[yy * H + xx] = vol.data[Math.round(zz) * (W * H) + xx * W + x]
      }
    }

    const hz = Math.round((z / Math.max(1, D - 1)) * (coronalH - 1))
    const planes: V2PlaneSlice[] = [
      {
        plane: 'axial',
        sliceIndex: z,
        totalSlices: D,
        width: axialW,
        height: axialH,
        windowWidth: vol.windowWidth,
        windowLevel: vol.windowLevel,
        crosshair: { h: y, v: x },
        pixelData: this.toPayload(axial, axialW, axialH),
      },
      {
        plane: 'coronal',
        sliceIndex: y,
        totalSlices: H,
        width: W,
        height: coronalH,
        windowWidth: vol.windowWidth,
        windowLevel: vol.windowLevel,
        crosshair: { h: hz, v: x },
        pixelData: this.toPayload(coronal, W, coronalH),
      },
      {
        plane: 'sagittal',
        sliceIndex: x,
        totalSlices: W,
        width: H,
        height: sagittalH,
        windowWidth: vol.windowWidth,
        windowLevel: vol.windowLevel,
        crosshair: { h: hz, v: y },
        pixelData: this.toPayload(sagittal, H, sagittalH),
      },
    ]

    return {
      jobId: cached.jobId,
      source: cached.source,
      dims: { x: W, y: H, z: D },
      position: { x, y, z },
      lines: {
        axial: { h: y, v: x },
        coronal: { h: hz, v: x },
        sagittal: { h: hz, v: y },
      },
      planes,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // CPR 曲面重建: 沿折线弧长重采样拉直图像 + 三平面路径投影
  // ────────────────────────────────────────────────────────────────────────────

  async cpr(data: { jobId?: string; seriesUID?: string; points: CprPoint[]; spacing?: number; crossWidth?: number }): Promise<CprResult> {
    const cached = await this.resolveVolume(data.jobId, data.seriesUID)
    const vol = cached.volume
    const pts = data.points.length >= 2 ? data.points : [{ x: vol.width * 0.3, y: vol.height * 0.5, z: vol.depth * 0.5 }, { x: vol.width * 0.7, y: vol.height * 0.5, z: vol.depth * 0.5 }]
    const spacing = Math.max(0.5, data.spacing ?? 1)
    const crossWidth = Math.min(101, Math.max(3, Math.round(data.crossWidth ?? 21)))

    // 弧长参数化
    const segLens: number[] = []
    let total = 0
    for (let i = 1; i < pts.length; i++) {
      const d = Math.sqrt((pts[i]!.x - pts[i - 1]!.x) ** 2 + (pts[i]!.y - pts[i - 1]!.y) ** 2 + (pts[i]!.z - pts[i - 1]!.z) ** 2)
      segLens.push(d)
      total += d
    }
    const sampleCount = Math.max(2, Math.round(total / spacing) + 1)
    const cum: number[] = [0]
    for (const l of segLens) cum.push(cum[cum.length - 1]! + l)

    const sampleAt = (s: number): CprPoint => {
      if (s <= 0) return { ...pts[0]! }
      if (s >= total) return { ...pts[pts.length - 1]! }
      for (let i = 1; i < cum.length; i++) {
        if (s <= cum[i]!) {
          const seg = segLens[i - 1]! || 1
          const t = (s - cum[i - 1]!) / seg
          const a = pts[i - 1]!
          const b = pts[i]!
          return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t }
        }
      }
      return { ...pts[pts.length - 1]! }
    }

    // 逐样本点: 切线方向 + 参考轴构造垂直截面 (局部正交基), 三线性采样
    const projA: Array<{ x: number; y: number }> = []
    const projC: Array<{ x: number; z: number }> = []
    const projS: Array<{ y: number; z: number }> = []
    const straightened = new Float32Array(sampleCount * crossWidth)
    const half = (crossWidth - 1) / 2

    for (let i = 0; i < sampleCount; i++) {
      const s = (i / Math.max(1, sampleCount - 1)) * total
      const p = sampleAt(s)
      projA.push({ x: p.x, y: p.y })
      projC.push({ x: p.x, z: p.z })
      projS.push({ y: p.y, z: p.z })

      // 切线: 用邻近采样点差分
      const s2 = Math.min(total, s + spacing)
      const p2 = sampleAt(s2)
      let tx = p2.x - p.x
      let ty = p2.y - p.y
      let tz = p2.z - p.z
      const tl = Math.sqrt(tx * tx + ty * ty + tz * tz) || 1
      tx /= tl
      ty /= tl
      tz /= tl
      // 参考轴: 优先取与切线夹角最大的坐标轴
      const ref = Math.abs(tx) <= Math.abs(ty) && Math.abs(tx) <= Math.abs(tz) ? { x: 1, y: 0, z: 0 } : Math.abs(ty) <= Math.abs(tz) ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
      // u = normalize(T × ref), v = normalize(T × u)
      let ux = ty * ref.z - tz * ref.y
      let uy = tz * ref.x - tx * ref.z
      let uz = tx * ref.y - ty * ref.x
      const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1
      ux /= ul
      uy /= ul
      uz /= ul
      let vx = ty * uz - tz * uy
      let vy = tz * ux - tx * uz
      let vz = tx * uy - ty * ux
      const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1
      vx /= vl
      vy /= vl
      vz /= vl
      // 截面内采样: 沿 u 方向 (垂直切线), 半宽 ±crossWidth/2
      for (let j = 0; j < crossWidth; j++) {
        const off = j - half
        const sx = p.x + ux * off
        const sy = p.y + uy * off
        const sz = p.z + uz * off
        straightened[i * crossWidth + j] = this.sampleTrilinear(vol, sx, sy, sz)
      }
    }

    const zScale = Math.max(vol.sliceThickness, 0.1) / Math.max(vol.pixelSpacing[1], 0.1)
    const voxelMm = Math.max(vol.pixelSpacing[0], 0.1)

    return {
      jobId: cached.jobId,
      source: cached.source,
      points: pts,
      spacing,
      crossWidth,
      totalLengthVoxels: round1(total),
      totalLengthMm: round1(total * voxelMm),
      sampleCount,
      straightened: {
        width: sampleCount,
        height: crossWidth,
        windowWidth: vol.windowWidth,
        windowLevel: vol.windowLevel,
        pixelData: this.toPayload(straightened, sampleCount, crossWidth),
      },
      projections: { axial: projA, coronal: projC, sagittal: projS },
      dims: { x: vol.width, y: vol.height, z: vol.depth },
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VR 体绘制: 固定采样步长光线投射 + 传输函数 LUT + yaw(绕 Z) / pitch(绕 X)
  // ────────────────────────────────────────────────────────────────────────────

  async vr(data: { jobId?: string; seriesUID?: string; yaw?: number; pitch?: number; preset?: VrPreset; step?: number; size?: number }): Promise<VrResult> {
    const cached = await this.resolveVolume(data.jobId, data.seriesUID)
    const vol = cached.volume
    const preset = TF_PRESETS[data.preset ?? 'softTissue'] ? (data.preset ?? 'softTissue') : 'softTissue'
    const yaw = data.yaw ?? 0
    const pitch = data.pitch ?? 0
    const { width: W, height: H, depth: D } = vol
    const autoSize = cached.source === 'real' ? Math.min(384, Math.max(192, Math.max(W, H))) : 256
    const outSize = clamp(Math.round(data.size ?? autoSize), 64, 512)
    const cx = W / 2
    const cy = H / 2
    const cz = D / 2
    const maxDist = Math.sqrt(cx * cx + cy * cy + cz * cz)
    // 固定采样步长: 默认 maxDist / 192 (确定性, 不依赖随机)
    const step = Math.max(0.4, data.step ?? maxDist / 192)
    const steps = Math.min(640, Math.max(2, Math.ceil(maxDist / step)))

    const rotYaw = (yaw * Math.PI) / 180
    const rotPitch = (pitch * Math.PI) / 180
    const cosY = Math.cos(rotYaw)
    const sinY = Math.sin(rotYaw)
    const cosP = Math.cos(rotPitch)
    const sinP = Math.sin(rotPitch)
    // 视线方向 (0,0,1): 先 pitch(绕 X) 再 yaw(绕 Z)
    const dirX = sinY * cosP
    const dirY = -sinP
    const dirZ = cosY * cosP

    const tf = buildTransferFunction(preset, 32)
    // HU → LUT 索引预计算表 (Int16 全值域 [-32768, 32767] → 0..lutSize-1), 热循环零分支
    const huLut = new Int32Array(65536)
    for (let h = 0; h < 65536; h++) {
      const hu = h - 32768
      const t = clamp((hu - TF_MIN) / (TF_MAX - TF_MIN), 0, 1)
      huLut[h] = clamp(Math.round(t * 31), 0, 31) * 4
    }
    const half = outSize / 2
    const scaleX = (cx * 1.05) / half
    const scaleY = (cy * 1.05) / half

    const rgba = new Uint8Array(outSize * outSize * 4)
    for (let oy = 0; oy < outSize; oy++) {
      for (let ox = 0; ox < outSize; ox++) {
        let px = (ox - half) * scaleX + cx
        let py = (oy - half) * scaleY + cy
        let pz = 0
        let ar = 0
        let ag = 0
        let ab = 0
        let aa = 0
        for (let s = 0; s < steps; s++) {
          const xi = Math.floor(px)
          const yi = Math.floor(py)
          const zi = Math.floor(pz)
          if (xi >= 0 && xi < W && yi >= 0 && yi < H && zi >= 0 && zi < D) {
            const li = huLut[vol.data[zi * (W * H) + yi * W + xi] + 32768]
            const ta = tf[li + 3]
            if (ta > 0.01) {
              const invA = 1 - aa
              ar += tf[li] * ta * invA
              ag += tf[li + 1] * ta * invA
              ab += tf[li + 2] * ta * invA
              aa += ta * invA
              if (aa > 0.98) break
            }
          }
          px += dirX * step
          py += dirY * step
          pz += dirZ * step
          if (px < -2 || px > W + 2 || py < -2 || py > H + 2 || pz > D + 2) break
        }
        const idx = (oy * outSize + ox) * 4
        rgba[idx] = Math.min(255, Math.round(ar * 255))
        rgba[idx + 1] = Math.min(255, Math.round(ag * 255))
        rgba[idx + 2] = Math.min(255, Math.round(ab * 255))
        rgba[idx + 3] = 255
      }
    }

    return {
      jobId: cached.jobId,
      source: cached.source,
      width: outSize,
      height: outSize,
      yaw,
      pitch,
      preset,
      sampleStep: round3(step),
      stepCount: steps,
      transferFunction: {
        lutSize: 32,
        entries: describeTransferFunction(preset),
      },
      pixelData: {
        dataBase64: Buffer.from(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength).toString('base64'),
        channels: 4,
      },
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 切割: 任意切面 (法向量 + 偏移) → 截面图像 + 裁剪统计
  // ────────────────────────────────────────────────────────────────────────────

  async cut(data: { jobId?: string; seriesUID?: string; normal: Vec3; offset?: number }): Promise<CutResult> {
    const cached = await this.resolveVolume(data.jobId, data.seriesUID)
    const vol = cached.volume
    const { width: W, height: H, depth: D } = vol
    let nx = data.normal.x
    let ny = data.normal.y
    let nz = data.normal.z
    const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1
    nx /= nl
    ny /= nl
    nz /= nl
    const center = { x: (W - 1) / 2, y: (H - 1) / 2, z: (D - 1) / 2 }
    const offset = data.offset ?? 0

    // 平面基: u = normalize(n × ref), v = normalize(n × u)
    const ref = Math.abs(nx) <= Math.abs(ny) && Math.abs(nx) <= Math.abs(nz) ? { x: 1, y: 0, z: 0 } : Math.abs(ny) <= Math.abs(nz) ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 }
    let ux = ny * ref.z - nz * ref.y
    let uy = nz * ref.x - nx * ref.z
    let uz = nx * ref.y - ny * ref.x
    const ul = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1
    ux /= ul
    uy /= ul
    uz /= ul
    let vx = ny * uz - nz * uy
    let vy = nz * ux - nx * uz
    let vz = nx * uy - ny * ux
    const vl = Math.sqrt(vx * vx + vy * vy + vz * vz) || 1
    vx /= vl
    vy /= vl
    vz /= vl

    // 体 8 角点投影到 (u,v) 求包围盒
    const corners: Array<[number, number]> = []
    for (const ccx of [0, W - 1]) {
      for (const ccy of [0, H - 1]) {
        for (const ccz of [0, D - 1]) {
          const dx = ccx - center.x
          const dy = ccy - center.y
          const dz = ccz - center.z
          corners.push([dx * ux + dy * uy + dz * uz, dx * vx + dy * vy + dz * vz])
        }
      }
    }
    let uMin = Infinity
    let uMax = -Infinity
    let vMin = Infinity
    let vMax = -Infinity
    for (const [u, v] of corners) {
      if (u < uMin) uMin = u
      if (u > uMax) uMax = u
      if (v < vMin) vMin = v
      if (v > vMax) vMax = v
    }
    const gridW = Math.max(2, Math.min(512, Math.round(uMax - uMin)))
    const gridH = Math.max(2, Math.min(512, Math.round(vMax - vMin)))
    const su = (uMax - uMin) / Math.max(1, gridW - 1)
    const sv = (vMax - vMin) / Math.max(1, gridH - 1)

    const section = new Float32Array(gridW * gridH)
    for (let gy = 0; gy < gridH; gy++) {
      const cv = vMin + gy * sv
      for (let gx = 0; gx < gridW; gx++) {
        const cu = uMin + gx * su
        const px = center.x + ux * cu + vx * cv
        const py = center.y + uy * cu + vy * cv
        const pz = center.z + uz * cu + vz * cv
        section[gy * gridW + gx] = this.sampleTrilinear(vol, px, py, pz)
      }
    }

    // 裁剪统计: n·(p - center) > offset 侧为保留侧
    let voxelsKept = 0
    for (let i = 0; i < vol.data.length; i++) {
      // 反解体素坐标 (体积大时抽样统计, 保持确定性)
      if ((i & 3) === 0) {
        const zi = Math.floor(i / (W * H))
        const rest = i - zi * (W * H)
        const yi = Math.floor(rest / W)
        const xi = rest - yi * W
        const side = (xi - center.x) * nx + (yi - center.y) * ny + (zi - center.z) * nz
        if (side > offset) voxelsKept++
      }
    }
    const voxelsTotal = Math.ceil(vol.data.length / 4)
    const keptRatio = voxelsTotal > 0 ? voxelsKept / voxelsTotal : 0

    return {
      jobId: cached.jobId,
      source: cached.source,
      normal: { x: nx, y: ny, z: nz },
      offset,
      width: gridW,
      height: gridH,
      sectionImage: this.toPayload(section, gridW, gridH),
      stats: {
        voxelsKept,
        voxelsTotal,
        keptRatio: round3(keptRatio),
        clippedRatio: round3(1 - keptRatio),
      },
      planeInfo: { center, basisU: { x: ux, y: uy, z: uz }, basisV: { x: vx, y: vy, z: vz } },
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 内部工具
  // ────────────────────────────────────────────────────────────────────────────

  private sampleTrilinear(vol: RealVolume, px: number, py: number, pz: number): number {
    const { width: W, height: H, depth: D, data } = vol
    if (px < 0 || py < 0 || pz < 0 || px > W - 1 || py > H - 1 || pz > D - 1) return -1000
    const x0 = Math.min(W - 2, Math.floor(px))
    const y0 = Math.min(H - 2, Math.floor(py))
    const z0 = Math.min(D - 2, Math.floor(pz))
    const tx = px - x0
    const ty = py - y0
    const tz = pz - z0
    const idx = (z0 * H + y0) * W + x0
    const v000 = data[idx]
    const v100 = data[idx + 1]
    const v010 = data[idx + W]
    const v110 = data[idx + W + 1]
    const v001 = data[idx + W * H]
    const v101 = data[idx + W * H + 1]
    const v011 = data[idx + W * H + W]
    const v111 = data[idx + W * H + W + 1]
    const c00 = v000 + (v100 - v000) * tx
    const c10 = v010 + (v110 - v010) * tx
    const c01 = v001 + (v101 - v001) * tx
    const c11 = v011 + (v111 - v011) * tx
    const c0 = c00 + (c10 - c00) * ty
    const c1 = c01 + (c11 - c01) * ty
    return c0 + (c1 - c0) * tz
  }

  private toPayload(grid: Float32Array, width: number, height: number): V2SlicePayload {
    const data = new Int16Array(width * height)
    for (let i = 0; i < grid.length; i++) {
      const v = grid[i]
      data[i] = Number.isFinite(v) ? Math.round(Math.max(-32768, Math.min(32767, v))) : -1000
    }
    return {
      dataBase64: Buffer.from(data.buffer as ArrayBuffer, data.byteOffset, data.byteLength).toString('base64'),
      bitsAllocated: 16,
      signed: true,
      width,
      height,
    }
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 模块级纯函数 (确定性, 可独立测试)
// ────────────────────────────────────────────────────────────────────────────

function syntheticVoxel(nx: number, ny: number, nz: number): number {
  const r2 = Math.sqrt(nx * nx + ny * ny)
  const r3 = Math.sqrt(nx * nx + ny * ny + nz * nz)
  let v = -1000
  if (r2 < 0.55) {
    v = 50 + 15 * Math.sin(6 * nx) * Math.cos(6 * ny) + 8 * Math.sin(4 * nz)
  }
  if (r2 > 0.62 && r2 < 0.78) {
    v = 800 + 120 * Math.sin(9 * Math.atan2(ny, nx)) * Math.cos(5 * nz)
  }
  if (r3 > 0.62 && r3 < 0.78 && Math.abs(nz) > 0.55) {
    v = 800 + 120 * Math.sin(9 * Math.atan2(ny, nx))
  }
  for (let k = 0; k < 3; k++) {
    const ang = k * 2.1 + 0.5
    const tx = 0.28 * Math.cos(ang)
    const ty = 0.28 * Math.sin(ang)
    const dTube = Math.sqrt((nx - tx) * (nx - tx) + (ny - ty) * (ny - ty))
    if (dTube < 0.05) v = 300
  }
  if (Math.abs(nz) < 0.12 && r2 < 0.55) v = 120
  return Math.max(-1024, Math.min(3071, Math.round(v)))
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function round1(v: number): number {
  return Math.round(v * 10) / 10
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000
}

/** 传输函数 LUT: 32 条 [r,g,b,a] (0..1), 索引 = 归一化密度 */
function buildTransferFunction(preset: VrPreset, lutSize: number): Float32Array {
  const p = TF_PRESETS[preset]
  const lut = new Float32Array(lutSize * 4)
  const range = p.max - p.min || 1
  for (let i = 0; i < lutSize; i++) {
    const t = i / Math.max(1, lutSize - 1)
    const a = ramp(p.points, t)
    const idx = i * 4
    lut[idx] = p.color[0] * (0.55 + 0.45 * t)
    lut[idx + 1] = p.color[1] * (0.55 + 0.45 * t)
    lut[idx + 2] = p.color[2] * (0.55 + 0.45 * t)
    lut[idx + 3] = a
  }
  return lut
}

const TF_MIN = -1024
const TF_MAX = 3071

/** 分段线性不透明度映射 */
function ramp(points: Array<[number, number]>, t: number): number {
  if (t <= points[0]![0]) return points[0]![1]
  for (let i = 1; i < points.length; i++) {
    const [t1, a1] = points[i - 1]!
    const [t2, a2] = points[i]!
    if (t <= t2) {
      const k = t2 === t1 ? 0 : (t - t1) / (t2 - t1)
      return a1 + (a2 - a1) * k
    }
  }
  return points[points.length - 1]![1]
}

/** 传输函数描述 (供前端展示预设曲线) */
function describeTransferFunction(preset: VrPreset): TransferFunctionEntry[] {
  const p = TF_PRESETS[preset]
  const out: TransferFunctionEntry[] = []
  for (let i = 0; i < 8; i++) {
    const t = i / 7
    const hu = Math.round(p.min + (p.max - p.min) * t)
    out.push({
      hu,
      r: Math.round(p.color[0] * (0.55 + 0.45 * t) * 255),
      g: Math.round(p.color[1] * (0.55 + 0.45 * t) * 255),
      b: Math.round(p.color[2] * (0.55 + 0.45 * t) * 255),
      a: Math.round(ramp(p.points, t) * 255),
    })
  }
  return out
}
