/**
 * G005 RIS - Volume 服务 (Phase 1.2+1.3 真实化)
 *
 * - reconstruct: 从 dicomInstance 表读取 series 对应的真实 .dcm 文件,
 *   解析 PixelData 构建真实体数据 (HU rescale), 无真实数据时回退合成体数据。
 * - mpr / mip / vr: 基于真实体数据计算三平面重采样 / 最大密度投影 / 密度光线投射。
 */
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
import * as fs from 'node:fs'
import { PrismaService } from '../../prisma/prisma.service'

export interface VolumeDims {
  x: number
  y: number
  z: number
}

export interface RealVolume {
  width: number
  height: number
  depth: number
  /** 已 rescale 的体素值 (CT 为 HU; MR/DR 为信号) */
  data: Int16Array
  min: number
  max: number
  windowWidth: number
  windowLevel: number
  rescaleSlope: number
  rescaleIntercept: number
  pixelSpacing: [number, number]
  sliceThickness: number
  modality: string
}

interface VolumeJob {
  jobId: string
  seriesUID: string
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  source: 'real' | 'synthetic'
  volume: VolumeDims | null
  real?: RealVolume
  error?: string
  createdAt: Date
}

export interface SlicePixelPayload {
  dataBase64: string
  bitsAllocated: number
  signed: boolean
  width: number
  height: number
}

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'])

const VR_PRESETS: Record<string, { ww: number; wl: number; color: [number, number, number] }> = {
  default: { ww: 400, wl: 40, color: [1, 1, 1] },
  bone: { ww: 2500, wl: 480, color: [1, 0.96, 0.86] },
  softTissue: { ww: 400, wl: 40, color: [0.95, 0.9, 0.95] },
  vessel: { ww: 600, wl: 300, color: [1, 0.55, 0.5] },
  lung: { ww: 1500, wl: -600, color: [0.72, 0.85, 1] },
}

@Injectable()
export class VolumeService {
  private readonly logger = new Logger(VolumeService.name)
  private jobs = new Map<string, VolumeJob>()

  constructor(private readonly prisma: PrismaService) {}

  // ────────────────────────────────────────────────────────────────────────────
  // 序列发现 (供前端 3D 后处理页选择真实 series)
  // ────────────────────────────────────────────────────────────────────────────

  async listSeries(): Promise<Array<{ seriesInstanceUid: string; modality: string; instanceCount: number; rows: number; columns: number; slices: number }>> {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findMany) return []
    try {
      const instances = await model.findMany({
        where: { storagePath: { not: null } },
        orderBy: { createdAt: 'asc' },
      })
      const bySeries = new Map<string, any[]>()
      for (const inst of instances) {
        const list = bySeries.get(inst.seriesInstanceUid) ?? []
        list.push(inst)
        bySeries.set(inst.seriesInstanceUid, list)
      }
      const out: Array<{ seriesInstanceUid: string; modality: string; instanceCount: number; rows: number; columns: number; slices: number }> = []
      for (const [uid, list] of bySeries) {
        const first = list[0]
        let rows = 512
        let columns = 512
        if (first?.storagePath && fs.existsSync(first.storagePath)) {
          try {
            const parsed = this.parseDicomPart10(fs.readFileSync(first.storagePath))
            rows = parsed.rows
            columns = parsed.columns
          } catch (e) {
            this.logger.debug(`listSeries: cannot parse ${first.storagePath}: ${(e as Error).message}`)
          }
        }
        out.push({ seriesInstanceUid: uid, modality: first?.modality ?? 'OT', instanceCount: list.length, rows, columns, slices: list.length })
      }
      return out
    } catch (e) {
      this.logger.warn(`listSeries failed: ${(e as Error).message}`)
      return []
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 重建
  // ────────────────────────────────────────────────────────────────────────────

  async reconstruct(seriesUID: string): Promise<{ jobId: string; volume: VolumeDims; source: 'real' | 'synthetic'; instanceCount: number }> {
    const jobId = `vol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const job: VolumeJob = { jobId, seriesUID, status: 'processing', progress: 0, source: 'synthetic', volume: null, createdAt: new Date() }

    const model = (this.prisma as any).dicomInstance
    if (model?.findMany) {
      try {
        const instances = await model.findMany({ where: { seriesInstanceUid: seriesUID } })
        if (instances.length > 0) {
          const real = this.buildRealVolume(instances)
          if (real) {
            job.real = real
            job.source = 'real'
            job.volume = { x: real.width, y: real.height, z: real.depth }
            job.progress = 100
            job.status = 'completed'
            this.jobs.set(jobId, job)
            this.logger.log(`reconstruct ${seriesUID}: real volume ${real.width}x${real.height}x${real.depth} (${instances.length} slices)`)
            return { jobId, volume: job.volume, source: 'real', instanceCount: instances.length }
          }
        }
      } catch (e) {
        this.logger.warn(`reconstruct ${seriesUID}: ${(e as Error).message}, fallback to synthetic`)
      }
    }

    job.volume = { x: 512, y: 512, z: 256 }
    job.status = 'processing'
    this.jobs.set(jobId, job)
    this.simulateProgress(jobId)
    this.logger.log(`reconstruct ${seriesUID}: no real data, fallback to synthetic 512x512x256`)
    return { jobId, volume: job.volume, source: 'synthetic', instanceCount: 0 }
  }

  getStatus(jobId: string): { status: string; progress: number; source: string; volume: VolumeDims | null; slices?: number; modality?: string } {
    const job = this.jobs.get(jobId)
    if (!job) throw new NotFoundException(`Job ${jobId} not found`)
    return {
      status: job.status,
      progress: job.progress,
      source: job.source,
      volume: job.volume,
      slices: job.real ? job.real.depth : undefined,
      modality: job.real?.modality,
    }
  }

  /**
   * 分割专用: 直接读取 series 真实体数据 (复用 reconstruct 的 DICOM 解析),
   * 无真实数据或解析失败时返回 null (调用方回退合成体数据)。
   */
  async loadRealVolume(seriesUID: string): Promise<{ real: RealVolume; jobId: string } | null> {
    const model = (this.prisma as any).dicomInstance
    if (!model?.findMany) return null
    try {
      const instances = await model.findMany({ where: { seriesInstanceUid: seriesUID } })
      if (instances.length === 0) return null
      const real = this.buildRealVolume(instances)
      if (!real) return null
      const jobId = `vol-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      this.jobs.set(jobId, {
        jobId,
        seriesUID,
        status: 'completed',
        progress: 100,
        source: 'real',
        volume: { x: real.width, y: real.height, z: real.depth },
        real,
        createdAt: new Date(),
      })
      this.logger.log(`loadRealVolume ${seriesUID}: ${real.width}x${real.height}x${real.depth} (${instances.length} slices)`)
      return { real, jobId }
    } catch (e) {
      this.logger.warn(`loadRealVolume ${seriesUID}: ${(e as Error).message}`)
      return null
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MPR: 三平面重采样 (薄轴按物理间距等比插值)
  // ────────────────────────────────────────────────────────────────────────────

  generateMPR(data: { jobId: string; plane: 'axial' | 'sagittal' | 'coronal'; sliceIndex: number }) {
    const job = this.getJob(data.jobId)
    const v = job.volume ?? { x: 512, y: 512, z: 256 }
    const total = data.plane === 'axial' ? v.z : data.plane === 'sagittal' ? v.x : v.y
    const sliceIndex = Math.min(Math.max(0, data.sliceIndex), total - 1)

    if (job.source === 'real' && job.real) {
      return this.realMpr(job.real, data.plane, sliceIndex)
    }
    return this.syntheticMpr(data.plane, sliceIndex, total)
  }

  private realMpr(vol: RealVolume, plane: 'axial' | 'sagittal' | 'coronal', sliceIndex: number) {
    const { width: W, height: H, depth: D } = vol
    if (plane === 'axial') {
      const outW = W
      const outH = H
      const z = sliceIndex
      const slice = new Float32Array(outW * outH)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          slice[y * outW + x] = vol.data[z * (W * H) + y * W + x]
        }
      }
      return this.buildSliceResult(plane, sliceIndex, outW, outH, slice, vol, vol.depth)
    }
    if (plane === 'sagittal') {
      const x = sliceIndex
      const outW = H
      const outH = Math.max(1, Math.round((D * Math.max(vol.sliceThickness, 0.1)) / vol.pixelSpacing[1]))
      const raw = new Float32Array(H * D)
      for (let z = 0; z < D; z++) {
        for (let y = 0; y < H; y++) {
          raw[z * H + y] = vol.data[z * (W * H) + y * W + x]
        }
      }
      const grid2 = this.resampleGrid(raw, H, D, outW, outH)
      return this.buildSliceResult(plane, sliceIndex, outW, outH, grid2, vol, undefined)
    }
    // coronal
    const y = sliceIndex
    const outW = W
    const outH = Math.max(1, Math.round((D * Math.max(vol.sliceThickness, 0.1)) / vol.pixelSpacing[0]))
    const raw = new Float32Array(W * D)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        raw[z * W + x] = vol.data[z * (W * H) + y * W + x]
      }
    }
    const grid2 = this.resampleGrid(raw, W, D, outW, outH)
    return this.buildSliceResult(plane, sliceIndex, outW, outH, grid2, vol, undefined)
  }

  private buildSliceResult(
    plane: string,
    sliceIndex: number,
    outW: number,
    outH: number,
    grid: Float32Array,
    vol?: RealVolume,
    totalSlices?: number,
  ) {
    const pixel = this.floatGridToPayload(grid, outW, outH)
    return {
      plane,
      sliceIndex,
      totalSlices: totalSlices ?? (vol ? vol.depth : 0),
      source: vol ? 'real' : 'synthetic',
      dimensions: { width: outW, height: outH },
      windowWidth: vol?.windowWidth ?? 400,
      windowLevel: vol?.windowLevel ?? 40,
      pixelData: pixel,
    }
  }

  private syntheticMpr(plane: 'axial' | 'sagittal' | 'coronal', sliceIndex: number, total: number) {
    const size = 512
    const grid = new Float32Array(size * size)
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        grid[y * size + x] = this.syntheticValue(x, y, sliceIndex, plane)
      }
    }
    return this.buildSliceResult(plane, sliceIndex, size, size, grid, undefined, total)
  }

  // ────────────────────────────────────────────────────────────────────────────
  // MIP: 最大密度投影
  // ────────────────────────────────────────────────────────────────────────────

  generateMIP(data: { jobId: string; direction: 'axial' | 'sagittal' | 'coronal'; thickness?: number }) {
    const job = this.getJob(data.jobId)
    if (job.source === 'real' && job.real) {
      return this.realMip(job.real, data.direction, data.thickness)
    }
    return this.syntheticMip(data.direction)
  }

  private realMip(vol: RealVolume, direction: 'axial' | 'sagittal' | 'coronal', thickness?: number) {
    const { width: W, height: H, depth: D } = vol
    const range = Math.max(1, Math.min(D, thickness ?? D))
    const start = Math.max(0, Math.floor((D - range) / 2))
    const end = Math.min(D - 1, start + range - 1)

    if (direction === 'axial') {
      const grid = new Float32Array(W * H).fill(-Infinity)
      for (let z = start; z <= end; z++) {
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W; x++) {
            const vv = vol.data[z * (W * H) + y * W + x]
            if (vv > grid[y * W + x]) grid[y * W + x] = vv
          }
        }
      }
      const pixel = this.floatGridToPayload(grid, W, H)
      return {
        direction,
        source: 'real',
        dimensions: { width: W, height: H },
        windowWidth: vol.windowWidth,
        windowLevel: vol.windowLevel,
        pixelData: pixel,
      }
    }

    if (direction === 'sagittal') {
      const outW = H
      const outH = Math.max(1, Math.round((D * Math.max(vol.sliceThickness, 0.1)) / vol.pixelSpacing[1]))
      const raw = new Float32Array(H * D).fill(-Infinity)
      for (let z = 0; z < D; z++) {
        for (let y = 0; y < H; y++) {
          let max = -Infinity
          for (let x = 0; x < W; x++) {
            const vv = vol.data[z * (W * H) + y * W + x]
            if (vv > max) max = vv
          }
          raw[z * H + y] = max
        }
      }
      const grid = this.resampleGrid(raw, H, D, outW, outH)
      const pixel = this.floatGridToPayload(grid, outW, outH)
      return {
        direction,
        source: 'real',
        dimensions: { width: outW, height: outH },
        windowWidth: vol.windowWidth,
        windowLevel: vol.windowLevel,
        pixelData: pixel,
      }
    }

    // coronal
    const outW = W
    const outH = Math.max(1, Math.round((D * Math.max(vol.sliceThickness, 0.1)) / vol.pixelSpacing[0]))
    const raw = new Float32Array(W * D).fill(-Infinity)
    for (let z = 0; z < D; z++) {
      for (let x = 0; x < W; x++) {
        let max = -Infinity
        for (let y = 0; y < H; y++) {
          const vv = vol.data[z * (W * H) + y * W + x]
          if (vv > max) max = vv
        }
        raw[z * W + x] = max
      }
    }
    const grid = this.resampleGrid(raw, W, D, outW, outH)
    const pixel = this.floatGridToPayload(grid, outW, outH)
    return {
      direction,
      source: 'real',
      dimensions: { width: outW, height: outH },
      windowWidth: vol.windowWidth,
      windowLevel: vol.windowLevel,
      pixelData: pixel,
    }
  }

  private syntheticMip(direction: 'axial' | 'sagittal' | 'coronal') {
    const size = 512
    const grid = new Float32Array(size * size).fill(-Infinity)
    for (let z = 0; z < 256; z++) {
      for (let y = 0; y < size; y++) {
        for (let x = 0; x < size; x++) {
          const vv = this.syntheticValue(x, y, z, direction)
          if (vv > grid[y * size + x]) grid[y * size + x] = vv
        }
      }
    }
    const pixel = this.floatGridToPayload(grid, size, size)
    return {
      direction,
      source: 'synthetic',
      dimensions: { width: size, height: size },
      windowWidth: 400,
      windowLevel: 40,
      pixelData: pixel,
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // VR: 密度映射 + 简单光线投射 (正交投影 + 旋转)
  // ────────────────────────────────────────────────────────────────────────────

  generateVR(data: { jobId: string; preset?: string; opacity?: number; rotation?: { x?: number; y?: number; z?: number } }) {
    const job = this.getJob(data.jobId)
    const presetKey = data.preset && VR_PRESETS[data.preset] ? data.preset : 'default'
    const preset = VR_PRESETS[presetKey]!
    const opacity = data.opacity === undefined ? 0.8 : Math.max(0, Math.min(1, data.opacity))
    const rotX = ((data.rotation?.x ?? 0) * Math.PI) / 180
    const rotZ = ((data.rotation?.z ?? 0) * Math.PI) / 180

    if (job.source === 'real' && job.real) {
      return this.realVr(job.real, preset, opacity, rotX, rotZ)
    }
    return this.syntheticVr(preset, opacity, rotX, rotZ)
  }

  private realVr(vol: RealVolume, preset: { ww: number; wl: number; color: [number, number, number] }, opacity: number, rotX: number, rotZ: number) {
    const { width: W, height: H, depth: D } = vol
    const outSize = Math.min(640, Math.max(W, H))
    const rgba = this.raycast(
      outSize,
      outSize,
      W,
      H,
      D,
      (x, y, z) => vol.data[z * (W * H) + y * W + x],
      preset,
      opacity,
      rotX,
      rotZ,
    )
    return this.buildVrResult(outSize, outSize, rgba, 'real', preset.ww, preset.wl)
  }

  private syntheticVr(preset: { ww: number; wl: number; color: [number, number, number] }, opacity: number, rotX: number, rotZ: number) {
    const outSize = 256
    const rgba = this.raycast(
      outSize,
      outSize,
      512,
      512,
      256,
      (x, y, z) => this.syntheticValue(x, y, z, 'axial'),
      preset,
      opacity,
      rotX,
      rotZ,
    )
    return this.buildVrResult(outSize, outSize, rgba, 'synthetic', preset.ww, preset.wl)
  }

  private raycast(
    outW: number,
    outH: number,
    volW: number,
    volH: number,
    volD: number,
    sample: (x: number, y: number, z: number) => number,
    preset: { ww: number; wl: number; color: [number, number, number] },
    opacity: number,
    rotX: number,
    rotZ: number,
  ): Uint8Array {
    const cx = volW / 2
    const cy = volH / 2
    const cz = volD / 2
    const maxDist = Math.sqrt(cx * cx + cy * cy + cz * cz)
    const cosX = Math.cos(rotX)
    const sinX = Math.sin(rotX)
    const cosZ = Math.cos(rotZ)
    const sinZ = Math.sin(rotZ)
    // 视方向 (0,0,1) 先绕 X 再绕 Z
    const dirX = sinZ * cosX
    const dirY = -sinX
    const dirZ = cosZ * cosX
    const step = Math.max(0.6, maxDist / Math.max(volD, 1))
    const steps = Math.min(512, Math.ceil(maxDist / step))
    const min = preset.wl - preset.ww / 2
    const max = preset.wl + preset.ww / 2
    const range = max - min || 1
    const [cr, cg, cb] = preset.color
    const half = Math.min(outW, outH) / 2
    const scaleX = (cx * 1.05) / half
    const scaleY = (cy * 1.05) / half

    const rgba = new Uint8Array(outW * outH * 4)
    for (let oy = 0; oy < outH; oy++) {
      for (let ox = 0; ox < outW; ox++) {
        const sx = (ox - outW / 2) * scaleX + cx
        const sy = (oy - outH / 2) * scaleY + cy
        let px = sx
        let py = sy
        let pz = 0
        let ar = 0
        let ag = 0
        let ab = 0
        let aa = 0
        for (let s = 0; s < steps; s++) {
          const xi = Math.floor(px)
          const yi = Math.floor(py)
          const zi = Math.floor(pz)
          if (xi >= 0 && xi < volW && yi >= 0 && yi < volH && zi >= 0 && zi < volD) {
            const v = sample(xi, yi, zi)
            const density = Math.max(0, Math.min(1, (v - min) / range))
            if (density > 0.02) {
              const a = opacity * density
              const invA = 1 - aa
              ar += cr * density * a * invA
              ag += cg * density * a * invA
              ab += cb * density * a * invA
              aa += a * invA
              if (aa > 0.98) break
            }
          }
          px += dirX * step
          py += dirY * step
          pz += dirZ * step
          if (px < -2 || px > volW + 2 || py < -2 || py > volH + 2 || pz > volD + 2) break
        }
        const idx = (oy * outW + ox) * 4
        rgba[idx] = Math.min(255, Math.round(ar * 255))
        rgba[idx + 1] = Math.min(255, Math.round(ag * 255))
        rgba[idx + 2] = Math.min(255, Math.round(ab * 255))
        rgba[idx + 3] = 255
      }
    }
    return rgba
  }

  private buildVrResult(outW: number, outH: number, rgba: Uint8Array, source: string, ww: number, wl: number) {
    return {
      width: outW,
      height: outH,
      source,
      windowWidth: ww,
      windowLevel: wl,
      pixelData: {
        dataBase64: Buffer.from(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength).toString('base64'),
        channels: 4,
      },
    }
  }

  // ────────────────────────────────────────────────────────────────────────────
  // 内部工具
  // ────────────────────────────────────────────────────────────────────────────

  private getJob(jobId: string): VolumeJob {
    const job = this.jobs.get(jobId)
    if (!job) throw new NotFoundException(`Job ${jobId} not found`)
    if (job.status === 'processing') {
      job.progress = Math.min(100, job.progress + 5)
      if (job.progress >= 100) job.status = 'completed'
    }
    return job
  }

  private simulateProgress(jobId: string) {
    const interval = setInterval(() => {
      const job = this.jobs.get(jobId)
      if (!job) { clearInterval(interval); return }
      job.progress = Math.min(100, job.progress + 10)
      if (job.progress >= 100) {
        job.status = 'completed'
        clearInterval(interval)
      }
    }, 200)
  }

  /** 解析 DICOM Part 10 (Explicit VR LE; 兼容 Implicit VR), 提取像素与几何 tags */
  private parseDicomPart10(buf: Buffer): {
    rows: number
    columns: number
    bitsAllocated: number
    pixelRepresentation: number
    windowCenter: number
    windowWidth: number
    rescaleIntercept: number
    rescaleSlope: number
    instanceNumber: number
    pixelData: Buffer
    pixelSpacing: [number, number]
    sliceThickness: number
  } {
    if (buf.length < 132 || buf.toString('ascii', 128, 132) !== 'DICM') {
      throw new Error('Not a DICOM Part 10 file')
    }
    const out = {
      rows: 0,
      columns: 0,
      bitsAllocated: 16,
      pixelRepresentation: 0,
      windowCenter: 40,
      windowWidth: 400,
      rescaleIntercept: 0,
      rescaleSlope: 1,
      instanceNumber: 0,
      pixelData: Buffer.alloc(0),
      pixelSpacing: [1, 1] as [number, number],
      sliceThickness: 5,
    }
    let offset = 132
    const readDs = (value: Buffer): number => {
      const s = value.toString('ascii').replace(/\0/g, '').split('\\')[0]?.trim()
      const n = Number(s)
      return Number.isFinite(n) ? n : 0
    }
    while (offset + 8 <= buf.length) {
      const group = buf.readUInt16LE(offset)
      const elem = buf.readUInt16LE(offset + 2)
      if (group === 0xfffe) break
      let length = 0
      let dataStart = 0
      const c = buf[offset + 4]
      if (c >= 0x41 && c <= 0x7a) {
        const vr = buf.toString('ascii', offset + 4, offset + 6)
        if (LONG_VR.has(vr)) {
          length = buf.readUInt32LE(offset + 8)
          dataStart = offset + 12
        } else {
          length = buf.readUInt16LE(offset + 6)
          dataStart = offset + 8
        }
      } else {
        length = buf.readUInt32LE(offset + 4)
        dataStart = offset + 8
      }
      if (length === 0xffffffff) {
        offset += 8
        continue
      }
      if (dataStart + length > buf.length) break
      const value = buf.subarray(dataStart, dataStart + length)
      if (group === 0x0028) {
        if (elem === 0x0010) out.rows = value.readUInt16LE(0)
        else if (elem === 0x0011) out.columns = value.readUInt16LE(0)
        else if (elem === 0x0100) out.bitsAllocated = value.readUInt16LE(0)
        else if (elem === 0x0103) out.pixelRepresentation = value.readUInt16LE(0)
        else if (elem === 0x1050) out.windowCenter = readDs(value)
        else if (elem === 0x1051) out.windowWidth = readDs(value)
        else if (elem === 0x1052) out.rescaleIntercept = readDs(value)
        else if (elem === 0x1053) out.rescaleSlope = readDs(value)
        else if (elem === 0x0030) {
          const parts = value.toString('ascii').replace(/\0/g, '').split('\\')
          out.pixelSpacing = [Number(parts[0]) || 1, Number(parts[1]) || Number(parts[0]) || 1]
        } else if (elem === 0x0050) {
          out.sliceThickness = readDs(value)
        }
      } else if (group === 0x0020 && elem === 0x0013) {
        out.instanceNumber = Number(value.toString('ascii').replace(/\0/g, '').trim()) || 0
      } else if (group === 0x7fe0 && elem === 0x0010) {
        out.pixelData = Buffer.from(value)
      }
      offset = dataStart + length
      if (length % 2 !== 0) offset++
    }
    if (out.rows === 0 || out.columns === 0) throw new Error('Missing Rows/Columns')
    return out
  }

  private buildRealVolume(instances: any[]): RealVolume | null {
    const slices: Array<{ instanceNumber: number; parsed: ReturnType<VolumeService['parseDicomPart10']> }> = []
    for (const inst of instances) {
      if (!inst.storagePath || !fs.existsSync(inst.storagePath)) continue
      try {
        const parsed = this.parseDicomPart10(fs.readFileSync(inst.storagePath))
        slices.push({ instanceNumber: parsed.instanceNumber, parsed })
      } catch (e) {
        this.logger.debug(`skip unparseable instance ${inst.sopInstanceUid}: ${(e as Error).message}`)
      }
    }
    if (slices.length === 0) return null
    slices.sort((a, b) => a.instanceNumber - b.instanceNumber)

    const first = slices[0]!.parsed
    const width = first.columns
    const height = first.rows
    const depth = slices.length
    const data = new Int16Array(width * height * depth)
    let min = Infinity
    let max = -Infinity

    for (let z = 0; z < depth; z++) {
      const p = slices[z]!.parsed
      const pixel = p.pixelData
      const slope = p.rescaleSlope || 1
      const intercept = p.rescaleIntercept || 0
      const bytesPerVoxel = Math.max(2, Math.round(p.bitsAllocated / 8))
      const base = z * width * height
      for (let i = 0; i < width * height; i++) {
        const off = i * bytesPerVoxel
        const stored = bytesPerVoxel >= 4 ? pixel.readUInt32LE(off) : p.pixelRepresentation === 1 ? pixel.readInt16LE(off) : pixel.readUInt16LE(off)
        const v = Math.round(stored * slope + intercept)
        data[base + i] = v
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (min === Infinity) return null

    return {
      width,
      height,
      depth,
      data,
      min,
      max,
      windowWidth: first.windowWidth || 400,
      windowLevel: first.windowCenter || 40,
      rescaleSlope: first.rescaleSlope || 1,
      rescaleIntercept: first.rescaleIntercept || 0,
      pixelSpacing: first.pixelSpacing,
      sliceThickness: first.sliceThickness || 5,
      modality: instances[0]?.modality ?? 'OT',
    }
  }

  private resampleGrid(src: Float32Array, srcW: number, srcH: number, outW: number, outH: number): Float32Array {
    const out = new Float32Array(outW * outH)
    if (outW === srcW && outH === srcH) {
      out.set(src)
      return out
    }
    const sx = outW > 1 ? (srcW - 1) / (outW - 1) : 0
    const sy = outH > 1 ? (srcH - 1) / (outH - 1) : 0
    for (let oy = 0; oy < outH; oy++) {
      const fy = Math.min(srcH - 1, oy * sy)
      const y0 = Math.floor(fy)
      const y1 = Math.min(srcH - 1, y0 + 1)
      const ty = fy - y0
      for (let ox = 0; ox < outW; ox++) {
        const fx = Math.min(srcW - 1, ox * sx)
        const x0 = Math.floor(fx)
        const x1 = Math.min(srcW - 1, x0 + 1)
        const tx = fx - x0
        const v00 = src[y0 * srcW + x0]
        const v01 = src[y0 * srcW + x1]
        const v10 = src[y1 * srcW + x0]
        const v11 = src[y1 * srcW + x1]
        const top = v00 + (v01 - v00) * tx
        const bot = v10 + (v11 - v10) * tx
        out[oy * outW + ox] = top + (bot - top) * ty
      }
    }
    return out
  }

  private floatGridToPayload(grid: Float32Array, width: number, height: number): SlicePixelPayload {
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

  /** 合成回退体素函数 (原正弦 mock 的解析形式) */
  private syntheticValue(x: number, y: number, z: number, plane: 'axial' | 'sagittal' | 'coronal'): number {
    const cx = x - 256
    const cy = y - 256
    const d = Math.sqrt(cx * cx + cy * cy)
    const a = Math.atan2(cy, cx)
    const zOff = (z - 64) / 64
    let v = 200 + 150 * Math.sin(d * 0.03 + zOff * 0.5)
    v += 50 * Math.cos(a * 2 + zOff * 0.3)
    v += 30 * Math.sin(cx * 0.02 + cy * 0.02 + zOff * 0.4)
    if (plane === 'coronal') v += 40 * Math.cos(cy * 0.03)
    if (plane === 'sagittal') v += 40 * Math.cos(cx * 0.03)
    return Math.max(0, Math.min(4095, v))
  }
}
