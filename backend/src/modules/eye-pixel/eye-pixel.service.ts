/**
 * [G005 Wave 10A] 眼科像素级图像处理服务 (/eye/pixel/*)
 *
 * 对齐前端 eyeApi.pixel 方法与 MSW eyePixelRenderModule 形状:
 *   GET /eye/pixel/instance/:instanceId     → 实例元数据 (确定性派生)
 *   GET /eye/pixel/histogram/:instanceId    → 256-bin 直方图 (从 instanceId 确定性派生)
 *   GET /eye/pixel/colormap/:modality       → 伪彩映射表 (8 种 colormap + LUT)
 *   POST /eye/pixel/sharpness               → 锐度评估 (确定性派生)
 *   POST /eye/pixel/mpr                     → MPR 重建元数据
 *   POST /eye/pixel/detect-artifact         → 伪影检测 (确定性派生)
 *
 * 直方图生成: 以 instanceId FNV 哈希为种子, 取混合高斯分布 (双峰: 组织+高亮结构),
 * 均值/方差/峰度随 modality 与帧号漂移, 保证同 instanceId 结果恒定 (确定性)。
 */
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common'

export interface HistogramBin {
  intensity: number
  count: number
}

export interface PixelHistogram {
  instanceId: string
  bins: HistogramBin[]
  mean: number
  stdDev: number
  min: number
  max: number
  mode: number
  median: number
  p25: number
  p75: number
  skewness: number
  kurtosis: number
  totalPixels: number
  modality: string
  generatedAt: string
}

export interface ColormapDef {
  id: string
  name: string
  type: 'GRAY' | 'GRAY_INVERT' | 'HOT' | 'JET' | 'RAINBOW' | 'SPECTRUM' | 'PET' | 'BONE'
  channels: number
  range: [number, number]
  description: string
  /** 256 色 LUT: [r,g,b] 三元组数组 (确定性生成) */
  lut: Array<[number, number, number]>
}

export interface PixelInstanceInfo {
  instanceId: string
  rows: number
  columns: number
  bitsAllocated: number
  bitsStored: number
  highBit: number
  pixelRepresentation: number
  samplesPerPixel: number
  photometricInterpretation: string
  transferSyntaxUID: string
  windowCenter: number
  windowWidth: number
  rescaleIntercept: number
  rescaleSlope: number
  pixelDataRef: string
  size: number
  sopInstanceUID: string
  modality: string
}

// ── 8 种伪彩映射定义 (基准, LUT 由生成器展开) ──────────────────────────────────
interface ColormapSpec {
  id: string
  name: string
  type: ColormapDef['type']
  channels: number
  range: [number, number]
  description: string
  mode: 'linear' | 'hot' | 'jet' | 'rainbow' | 'pet' | 'bone'
}

const COLORMAP_SPECS: Record<string, ColormapSpec> = {
  fundus: { id: 'fundus', name: '眼底彩照', type: 'GRAY', channels: 3, range: [0, 255], description: '眼底彩照原色映射 (RGB 3 通道)', mode: 'linear' },
  oct: { id: 'oct', name: 'OCT 灰度', type: 'GRAY', channels: 1, range: [0, 255], description: 'OCT B-scan 灰度线性映射', mode: 'linear' },
  octa: { id: 'octa', name: 'OCT-A 血管', type: 'JET', channels: 3, range: [0, 255], description: 'OCT-A 血流信号 JET 伪彩', mode: 'jet' },
  ffa: { id: 'ffa', name: 'FFA 荧光', type: 'GRAY_INVERT', channels: 1, range: [0, 255], description: '荧光素眼底血管造影负片映射', mode: 'linear' },
  visualfield: { id: 'visualfield', name: '视野', type: 'RAINBOW', channels: 3, range: [0, 255], description: '视野敏感度 RAINBOW 伪彩', mode: 'rainbow' },
  topography: { id: 'topography', name: '角膜地形', type: 'SPECTRUM', channels: 3, range: [30, 80], description: '角膜地形图 SPECTRUM 光谱映射', mode: 'rainbow' },
  icg: { id: 'icg', name: 'ICG 荧光', type: 'PET', channels: 3, range: [0, 255], description: '吲哚菁绿造影 PET 热伪彩', mode: 'pet' },
  biometry: { id: 'biometry', name: '生物测量', type: 'BONE', channels: 3, range: [0, 255], description: '眼生物测量 BONE 骨密度伪彩', mode: 'bone' },
}

// ── modality → 直方图特征 (均值/方差/权重, 业务真实) ───────────────────────────
const MODALITY_HISTOGRAM: Record<string, { mean: number; std: number; peak2: number; weight2: number; min: number; max: number }> = {
  fundus: { mean: 128, std: 50, peak2: 210, weight2: 0.12, min: 8, max: 250 },
  oct: { mean: 90, std: 45, peak2: 200, weight2: 0.2, min: 4, max: 248 },
  octa: { mean: 60, std: 38, peak2: 220, weight2: 0.08, min: 2, max: 246 },
  ffa: { mean: 110, std: 55, peak2: 225, weight2: 0.18, min: 6, max: 252 },
  icg: { mean: 100, std: 52, peak2: 215, weight2: 0.15, min: 5, max: 251 },
  visualfield: { mean: 145, std: 40, peak2: 235, weight2: 0.1, min: 10, max: 254 },
  topography: { mean: 55, std: 18, peak2: 78, weight2: 0.25, min: 30, max: 82 },
  biometry: { mean: 120, std: 48, peak2: 200, weight2: 0.12, min: 8, max: 249 },
  default: { mean: 128, std: 50, peak2: 205, weight2: 0.15, min: 8, max: 250 },
}

function hashStr(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h)
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 生成确定性直方图 bin (256 bins, 混合高斯 + 噪声), 同 instanceId 恒定 */
function buildHistogram(instanceId: string, modality: string, frameSeed = 0): PixelHistogram {
  const feat = MODALITY_HISTOGRAM[modality] ?? MODALITY_HISTOGRAM.default
  const rnd = mulberry32(hashStr(instanceId) + frameSeed * 7919)
  const mean = feat.mean + (rnd() - 0.5) * 6
  const std = feat.std * (0.9 + rnd() * 0.2)
  const peak2 = feat.peak2 + (rnd() - 0.5) * 10
  const weight2 = feat.weight2 * (0.8 + rnd() * 0.4)
  const bins: HistogramBin[] = []
  const total = 512 * 512
  for (let i = 0; i < 256; i += 1) {
    const g1 = Math.exp(-((i - mean) ** 2) / (2 * std * std))
    const g2 = Math.exp(-((i - peak2) ** 2) / (2 * std * std * 0.6))
    const noise = 0.05 + rnd() * 0.08
    const y = Math.round(total * (g1 * (1 - weight2) + g2 * weight2 + noise) / 100)
    bins.push({ intensity: i, count: y })
  }
  const counts = bins.map((b) => b.count)
  const sorted = [...counts].sort((a, b) => a - b)
  const totalPixels = counts.reduce((s, c) => s + c, 0)
  const meanV = counts.reduce((s, c, i) => s + c * i, 0) / totalPixels
  const variance = counts.reduce((s, c, i) => s + c * (i - meanV) ** 2, 0) / totalPixels
  const stdDev = Math.sqrt(variance)
  const skewness = counts.reduce((s, c, i) => s + c * ((i - meanV) / stdDev) ** 3, 0) / totalPixels
  const kurtosis = counts.reduce((s, c, i) => s + c * ((i - meanV) / stdDev) ** 4, 0) / totalPixels
  const percentile = (p: number): number => {
    const target = totalPixels * p
    let acc = 0
    for (const b of bins) {
      acc += b.count
      if (acc >= target) return b.intensity
    }
    return bins[bins.length - 1]?.intensity ?? 0
  }
  const modeIdx = counts.indexOf(Math.max(...counts))
  return {
    instanceId,
    bins,
    mean: Math.round(meanV * 100) / 100,
    stdDev: Math.round(stdDev * 100) / 100,
    min: percentile(0.002),
    max: percentile(0.998),
    mode: modeIdx,
    median: percentile(0.5),
    p25: percentile(0.25),
    p75: percentile(0.75),
    skewness: Math.round(skewness * 100) / 100,
    kurtosis: Math.round(kurtosis * 100) / 100,
    totalPixels,
    modality,
    generatedAt: new Date().toISOString(),
  }
}

/** 展开 colormap LUT (256 色), 确定性 */
function buildLut(spec: ColormapSpec): Array<[number, number, number]> {
  const lut: Array<[number, number, number]> = []
  const [lo, hi] = spec.range
  const span = Math.max(1, hi - lo)
  for (let i = 0; i < 256; i += 1) {
    const t = (i - lo) / span
    const c = Math.max(0, Math.min(1, t))
    let r = 0
    let g = 0
    let b = 0
    switch (spec.mode) {
      case 'linear':
        r = c * 255
        g = c * 255
        b = c * 255
        break
      case 'hot': {
        r = Math.min(1, c * 1.5) * 255
        g = Math.min(1, Math.max(0, (c - 0.333) * 1.5)) * 255
        b = Math.min(1, Math.max(0, (c - 0.667) * 3)) * 255
        break
      }
      case 'jet': {
        r = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 3))) * 255
        g = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 2))) * 255
        b = Math.max(0, Math.min(1, 1.5 - Math.abs(4 * c - 1))) * 255
        break
      }
      case 'rainbow': {
        const hue = (1 - c) * 270
        const k = (hue / 60) % 6
        const x = 1 - Math.abs((k % 2) - 1)
        const rgb = k < 1 ? [1, x, 0] : k < 2 ? [x, 1, 0] : k < 3 ? [0, 1, x] : k < 4 ? [0, x, 1] : k < 5 ? [x, 0, 1] : [1, 0, x]
        r = rgb[0] * 255
        g = rgb[1] * 255
        b = rgb[2] * 255
        break
      }
      case 'pet': {
        r = Math.min(1, c * 1.4) * 255
        g = Math.max(0, Math.min(1, (c - 0.25) * 1.6)) * 255
        b = Math.max(0, Math.min(1, (c - 0.6) * 2.5)) * 255
        break
      }
      case 'bone': {
        r = Math.min(1, c * 0.9 + 0.1) * 255
        g = Math.min(1, c * 1.05) * 255
        b = Math.max(0, Math.min(1, c * 1.2 - 0.2)) * 255
        break
      }
    }
    lut.push([Math.round(r), Math.round(g), Math.round(b)])
  }
  return lut
}

const LUT_CACHE = new Map<string, Array<[number, number, number]>>()

function colormapOf(id: string): ColormapDef {
  const spec = COLORMAP_SPECS[id]
  if (!spec) throw new NotFoundException(`未知 colormap: ${id}`)
  let lut = LUT_CACHE.get(spec.id)
  if (!lut) {
    lut = buildLut(spec)
    LUT_CACHE.set(spec.id, lut)
  }
  return { ...spec, lut }
}

const ALL_COLORMAP_IDS = Object.keys(COLORMAP_SPECS)

@Injectable()
export class EyePixelService {
  /** GET /eye/pixel/instance/:instanceId — 实例元数据 (确定性派生) */
  getInstance(instanceId: string): PixelInstanceInfo {
    if (!instanceId) throw new BadRequestException('instanceId 不能为空')
    const hash = hashStr(instanceId)
    const modality = ALL_COLORMAP_IDS[hash % ALL_COLORMAP_IDS.length]
    const cols = 512
    const rows = 512
    const bytesPerPixel = 2
    return {
      instanceId,
      rows,
      columns: cols,
      bitsAllocated: 16,
      bitsStored: 12,
      highBit: 11,
      pixelRepresentation: 0,
      samplesPerPixel: 1,
      photometricInterpretation: 'MONOCHROME2',
      transferSyntaxUID: '1.2.840.10008.1.2.1',
      windowCenter: 40,
      windowWidth: 400,
      rescaleIntercept: -1024,
      rescaleSlope: 1,
      pixelDataRef: `/eye/pixel/instance/${instanceId}/raw`,
      size: rows * cols * bytesPerPixel,
      sopInstanceUID: `1.2.826.0.1.3680043.8.498.${instanceId}`,
      modality,
    }
  }

  /** GET /eye/pixel/histogram/:instanceId — 256-bin 直方图 (确定性) */
  getHistogram(instanceId: string, frame = 0): PixelHistogram {
    if (!instanceId) throw new BadRequestException('instanceId 不能为空')
    const modality = COLORMAP_SPECS[instanceId] ? instanceId : this.getInstance(instanceId).modality
    const frameSeed = Math.max(0, Math.floor(Number(frame) || 0))
    return buildHistogram(instanceId, modality, frameSeed)
  }

  /** GET /eye/pixel/colormap/:modality — 伪彩映射表 (8 种) */
  getColormap(modality: string): ColormapDef {
    return colormapOf(modality)
  }

  /** GET /eye/pixel/colormaps — 全部 colormap 目录 */
  listColormaps(): ColormapDef[] {
    return ALL_COLORMAP_IDS.map((id) => colormapOf(id))
  }

  /** POST /eye/pixel/sharpness — 锐度评估 (确定性派生) */
  analyzeSharpness(input: { instanceId: string }): Record<string, unknown> {
    if (!input?.instanceId) throw new BadRequestException('instanceId 不能为空')
    const hash = hashStr(input.instanceId)
    const laplacian = Math.round(18 + (hash % 100) / 6.6) / 10
    const tenengrad = Math.round(30 + ((hash >> 3) % 100) / 5.2) / 10
    const variance = Math.round(1200 + (hash % 1800))
    const overall = Math.round(Math.min(99.5, 72 + (hash % 250) / 10) * 10) / 10
    return {
      instanceId: input.instanceId,
      sharpness: { laplacian, tenengrad, variance, overall },
      grade: overall >= 90 ? 'A (优)' : overall >= 75 ? 'B (良)' : 'C (合格)',
      passed: overall >= 75,
      measuredAt: new Date().toISOString(),
    }
  }

  /** POST /eye/pixel/mpr — MPR 重建元数据 */
  createMpr(input: { studyId: string; axis?: 'axial' | 'sagittal' | 'coronal'; seriesIds?: string[] }): Record<string, unknown> {
    if (!input?.studyId) throw new BadRequestException('studyId 不能为空')
    const seriesIds = Array.isArray(input.seriesIds) && input.seriesIds.length > 0 ? input.seriesIds : []
    return {
      mprId: `MPR-${Date.now()}`,
      studyId: input.studyId,
      axis: input.axis ?? 'axial',
      sliceCount: seriesIds.length || 30,
      resolution: '512x512',
      format: 'WebGL Texture Array',
      renderedAt: new Date().toISOString(),
    }
  }

  /** POST /eye/pixel/detect-artifact — 伪影检测 (确定性派生) */
  detectArtifact(input: { instanceId: string }): Record<string, unknown> {
    if (!input?.instanceId) throw new BadRequestException('instanceId 不能为空')
    const hash = hashStr(input.instanceId)
    const motionSeverity = Math.round((hash % 100) * 0.0012 * 100) / 100
    const eyelidSeverity = Math.round((hash % 60) * 0.001 * 100) / 100
    const qualityScore = Math.round(Math.min(99, 82 + (hash % 140) / 10) * 10) / 10
    return {
      instanceId: input.instanceId,
      artifacts: [
        { type: 'motion', severity: motionSeverity, location: { x: 256, y: 200, w: 80, h: 60 } },
        { type: 'eyelid', severity: eyelidSeverity, location: { x: 0, y: 400, w: 150, h: 112 } },
      ],
      qualityScore,
      passed: qualityScore >= 85,
      recommendations: qualityScore >= 85 ? ['图像质量良好, 可进入阅片流程'] : ['轻微运动伪影, 建议重扫'],
      detectedAt: new Date().toISOString(),
    }
  }
}
