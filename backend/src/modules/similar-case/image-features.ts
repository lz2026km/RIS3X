/**
 * G005 RIS v3.0.6.11-62 - 影像级相似检索特征提取 (确定性、纯 Node)
 *
 * 对标 Siemens 影像检索 / Infinitt Enterprise Search 影像维度。
 *
 * 特征定义 (全部确定性, 无外部向量库):
 *  a. 强度直方图: 32-bin (CT 为 HU 域 [-1024,1024); 非 CT 信号域 [0,2048) = raw/4095*2048)
 *  b. 统计特征: mean/std/skew/kurtosis/min/max/percentiles(5/25/50/75/95) — 由直方图矩计算
 *  c. 纹理简化特征: 相邻像素差分均值 (梯度能量近似)
 *  d. 形态: 高密度体素占比 (CT > 300HU / 非CT > 1000 信号) 与低密度占比 (CT < -500HU / 非CT < 100)
 *
 * 特征向量 = 直方图(32) + [mean,std,skew,kurt,p05,p25,p50,p75,p95,texture,high,low] (44 维, L2 归一)
 * 相似度 = 0.6 × 特征向量余弦 + 0.4 × 模态/部位匹配
 */
import * as fs from 'node:fs'

export const HIST_BINS = 32
export const CT_MIN = -1024
export const CT_MAX = 1024
export const SIGNAL_MAX = 2048
const BIN_WIDTH = 64 // (1024 - (-1024)) / 32

export interface ImageFeatures {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  instanceCount: number
  rows: number
  columns: number
  mean: number
  std: number
  skew: number
  kurtosis: number
  min: number
  max: number
  percentiles: [number, number, number, number, number] // p5/p25/p50/p75/p95
  textureEnergy: number // 相邻像素差分均值 (域内)
  highDensityRatio: number // 高密度占比
  lowDensityRatio: number // 低密度占比
  histogram: number[] // 32 bin 计数
  vector: number[] // 44 维 L2 归一化特征向量
  source: 'real' | 'demo'
}

export interface ParsedSlice {
  rows: number
  columns: number
  bitsAllocated: number
  pixelRepresentation: number
  rescaleIntercept: number
  rescaleSlope: number
  seriesDescription: string
  studyDescription: string
  pixelData: Buffer
}

const LONG_VR = new Set(['OB', 'OD', 'OF', 'OL', 'OW', 'SQ', 'UC', 'UN', 'UR', 'UT'])

/** DICOM Part 10 解析 (Explicit VR LE; 兼容 Implicit VR) — 纯 Node 无依赖 */
export function parseDicomPart10(buf: Buffer): ParsedSlice {
  if (buf.length < 132 || buf.toString('ascii', 128, 132) !== 'DICM') {
    throw new Error('Not a DICOM Part 10 file')
  }
  const out: ParsedSlice = {
    rows: 0,
    columns: 0,
    bitsAllocated: 16,
    pixelRepresentation: 0,
    rescaleIntercept: 0,
    rescaleSlope: 1,
    seriesDescription: '',
    studyDescription: '',
    pixelData: Buffer.alloc(0),
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
      else if (elem === 0x1052) out.rescaleIntercept = readDs(value)
      else if (elem === 0x1053) out.rescaleSlope = readDs(value)
    } else if (group === 0x0008 && elem === 0x103e) {
      out.seriesDescription = value.toString('ascii').replace(/\0/g, '').trim()
    } else if (group === 0x0008 && elem === 0x1030) {
      out.studyDescription = value.toString('ascii').replace(/\0/g, '').trim()
    } else if (group === 0x7fe0 && elem === 0x0010) {
      out.pixelData = Buffer.from(value)
    }
    offset = dataStart + length
    if (length % 2 !== 0) offset++
  }
  if (out.rows === 0 || out.columns === 0) throw new Error('Missing Rows/Columns')
  return out
}

/** CT 系模态 (HU 域) vs 非 CT (信号域) */
export function isCtFamily(modality: string): boolean {
  return /^(CT|PET-CT|NM)$/i.test(modality ?? '')
}

/** 域范围: CT 为 HU [-1024,1024); 非 CT 为信号 [0,2048) */
export function domainBounds(modality: string): { min: number; max: number; span: number } {
  const ct = isCtFamily(modality)
  return { min: ct ? CT_MIN : 0, max: ct ? CT_MAX : SIGNAL_MAX, span: ct ? 2048 : 2048 }
}

/** 体素值 → 检索域值 (确定性): CT 直接用 HU; 非 CT 信号归一至 [0,2048) */
export function toDomainValue(modality: string, rescaled: number): number {
  if (isCtFamily(modality)) return rescaled
  return (rescaled / 4095) * SIGNAL_MAX
}

/** 部位推断: 优先 DICOM 描述, 回退 UID 模式 */
export function inferBodyPart(modality: string, description: string, uid: string): string {
  const d = `${description ?? ''} ${uid ?? ''}`.toLowerCase()
  if (/head|颅|brain|脑/.test(d)) return '颅脑'
  if (/chest|胸|lung|肺/.test(d)) return '胸部'
  if (/abdomen|abdo|腹/.test(d)) return '腹部'
  if (/pelvis|盆腔|前列腺|prostate/.test(d)) return '盆腔'
  if (/spine|脊柱|椎/.test(d)) return '脊柱'
  if (/knee|膝/.test(d)) return '膝关节'
  if (/breast|乳腺|乳/.test(d)) return '乳腺'
  if (/thyroid|甲状腺/.test(d)) return '甲状腺'
  if (/upper|上肢|手|wrist|hand|elbow|arm/.test(d)) return '上肢'
  if (/lower|下肢|foot|ankle|leg/.test(d)) return '下肢'
  return '未知'
}

/** 从已解析切片读取采样体素 (确定性下采样: 目标 ≤ ~1M 体素/切片, 最多 16 层) */
export function readSampledValues(parsed: ParsedSlice[], modality: string): Float64Array {
  const maxSlices = Math.min(parsed.length, 16)
  const perSlice = Math.min(parsed[0]?.rows ?? 1, parsed[0]?.columns ?? 1)
  const slicePixels = (parsed[0]?.rows ?? 1) * (parsed[0]?.columns ?? 1)
  const stride = Math.max(1, Math.floor(Math.sqrt(slicePixels / 900000)))
  const out: number[] = []
  for (let z = 0; z < maxSlices; z++) {
    const p = parsed[z]!
    const bytes = Math.max(2, Math.round(p.bitsAllocated / 8))
    const pixel = p.pixelData
    const slope = p.rescaleSlope || 1
    const intercept = p.rescaleIntercept || 0
    const signed = p.pixelRepresentation === 1
    const total = Math.floor(pixel.length / bytes)
    for (let i = 0; i < total; i += stride) {
      const raw = bytes >= 4 ? pixel.readUInt32LE(i * bytes) : signed ? pixel.readInt16LE(i * bytes) : pixel.readUInt16LE(i * bytes)
      const rescaled = raw * slope + intercept
      out.push(toDomainValue(modality, rescaled))
    }
  }
  return Float64Array.from(out)
}

/** 由直方图计算统计特征 (确定性) */
function statsFromHistogram(hist: number[], total: number, min: number, span: number): {
  mean: number
  std: number
  skew: number
  kurtosis: number
  minV: number
  maxV: number
  percentiles: [number, number, number, number, number]
} {
  const width = span / HIST_BINS
  const center = (i: number) => min + width * i + width / 2
  let mean = 0
  for (let i = 0; i < HIST_BINS; i++) mean += hist[i]! * center(i)
  mean /= total
  let m2 = 0
  let m3 = 0
  let m4 = 0
  for (let i = 0; i < HIST_BINS; i++) {
    const d = center(i) - mean
    const c = hist[i]! / total
    m2 += c * d * d
    m3 += c * d * d * d
    m4 += c * d * d * d * d
  }
  const std = Math.sqrt(m2)
  const skew = std > 1e-9 ? m3 / (std ** 3) : 0
  const kurtosis = m2 > 1e-12 ? m4 / (m2 * m2) : 3
  let minV = min + span
  let maxV = min
  let first = -1
  for (let i = 0; i < HIST_BINS; i++) {
    if (hist[i]! > 0) {
      if (first < 0) first = i
      minV = min + width * i
      maxV = min + width * i + width
    }
  }
  const percentile = (p: number): number => {
    const target = total * p
    let cum = 0
    for (let i = 0; i < HIST_BINS; i++) {
      cum += hist[i]!
      if (cum >= target) return center(i)
    }
    return min + span
  }
  return {
    mean,
    std,
    skew,
    kurtosis,
    minV: first >= 0 ? minV : min,
    maxV: first >= 0 ? maxV : min + span,
    percentiles: [percentile(0.05), percentile(0.25), percentile(0.5), percentile(0.75), percentile(0.95)],
  }
}

/** 相邻像素差分均值 (梯度能量近似, 确定性扫描顺序) */
export function textureEnergy(values: Float64Array): number {
  if (values.length < 2) return 0
  let sum = 0
  for (let i = 1; i < values.length; i++) sum += Math.abs(values[i]! - values[i - 1]!)
  return sum / (values.length - 1)
}

/** 特征向量: 32 直方图 + 12 统计 (44 维, L2 归一化) */
function buildVector(hist: number[], total: number, min: number, span: number, s: ReturnType<typeof statsFromHistogram>, tex: number, high: number, low: number): number[] {
  const norm = (v: number, lo: number, hi: number) => Math.max(-1, Math.min(1, (v - lo) / (hi - lo)))
  const v: number[] = []
  for (let i = 0; i < HIST_BINS; i++) v.push(hist[i]! / total)
  v.push(norm(s.mean, min, min + span))
  v.push(s.std / span)
  v.push(Math.max(-1, Math.min(1, s.skew / 5)))
  v.push(Math.max(-1, Math.min(1, (s.kurtosis - 3) / 10)))
  for (const p of s.percentiles) v.push(norm(p, min, min + span))
  v.push(tex / span)
  v.push(high)
  v.push(low)
  let len = 0
  for (const x of v) len += x * x
  len = Math.sqrt(len) || 1
  for (let i = 0; i < v.length; i++) v[i] = v[i]! / len
  return v
}

/** 从真实切片集合提取影像特征 (确定性) */
export function extractFeatures(opts: {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  slices: ParsedSlice[]
  instanceCount: number
  source: 'real'
}): ImageFeatures {
  const { modality } = opts
  const values = readSampledValues(opts.slices, modality)
  const { min, span } = domainBounds(modality)
  const hist = new Array<number>(HIST_BINS).fill(0)
  const width = span / HIST_BINS
  let high = 0
  let low = 0
  for (const v of values) {
    const idx = Math.min(HIST_BINS - 1, Math.max(0, Math.floor((v - min) / width)))
    hist[idx] = hist[idx]! + 1
    const ct = isCtFamily(modality)
    if (v > (ct ? 300 : 1000)) high++
    else if (v < (ct ? -500 : 100)) low++
  }
  const total = Math.max(1, values.length)
  const s = statsFromHistogram(hist, total, min, span)
  const tex = textureEnergy(values)
  const first = opts.slices[0]
  return {
    seriesUid: opts.seriesUid,
    studyUid: opts.studyUid,
    modality,
    bodyPart: opts.bodyPart,
    instanceCount: opts.instanceCount,
    rows: first?.rows ?? 0,
    columns: first?.columns ?? 0,
    mean: Math.round(s.mean * 10) / 10,
    std: Math.round(s.std * 10) / 10,
    skew: Math.round(s.skew * 100) / 100,
    kurtosis: Math.round(s.kurtosis * 100) / 100,
    min: Math.round(s.minV),
    max: Math.round(s.maxV),
    percentiles: s.percentiles.map((p) => Math.round(p)) as [number, number, number, number, number],
    textureEnergy: Math.round(tex * 10) / 10,
    highDensityRatio: Math.round((high / total) * 10000) / 10000,
    lowDensityRatio: Math.round((low / total) * 10000) / 10000,
    histogram: hist,
    vector: buildVector(hist, total, min, span, s, tex, high / total, low / total),
    source: opts.source,
  }
}

/** FNV-1a 确定性哈希 (用于 demo 特征抖动) */
export function hashString(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

/** 高斯直方图 (确定性, 无 RNG): 在 32 bin 中心采样解析高斯 + 底噪 */
function gaussianHistogram(mean: number, std: number, min: number, span: number, seed: number): number[] {
  const width = span / HIST_BINS
  const hist: number[] = []
  let total = 0
  for (let i = 0; i < HIST_BINS; i++) {
    const c = min + width * i + width / 2
    const d = (c - mean) / Math.max(1e-6, std)
    const g = Math.exp(-0.5 * d * d)
    const jitter = 0.85 + ((hashString(`bin${i}:${seed}`) % 300) / 1000) // 0.85..1.15
    const count = Math.round(1000 * g * jitter + 4) // +4 底噪
    hist.push(count)
    total += count
  }
  return hist
}

export interface DemoFeatureSeed {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
}

/** 确定性 demo 特征模板 (key = modality|bodyPart, 域与真实提取一致) */
const DEMO_TEMPLATES: Record<string, { mean: number; std: number; texture: number; high: number; low: number }> = {
  'CT|颅脑': { mean: 30, std: 150, texture: 60, high: 0.04, low: 0.02 },
  'CT|胸部': { mean: -700, std: 170, texture: 40, high: 0.005, low: 0.06 },
  'CT|腹部': { mean: 40, std: 120, texture: 45, high: 0.02, low: 0.02 },
  'CT|脊柱': { mean: 120, std: 170, texture: 55, high: 0.09, low: 0.01 },
  'CT|default': { mean: 0, std: 150, texture: 50, high: 0.03, low: 0.03 },
  'MR|颅脑': { mean: 850, std: 400, texture: 250, high: 0.01, low: 0.03 },
  'MR|膝关节': { mean: 700, std: 450, texture: 300, high: 0.005, low: 0.02 },
  'MR|盆腔': { mean: 650, std: 420, texture: 220, high: 0.005, low: 0.01 },
  'MR|default': { mean: 800, std: 420, texture: 250, high: 0.008, low: 0.02 },
  'DX|胸部': { mean: 500, std: 350, texture: 180, high: 0.002, low: 0.02 },
  'DX|腹部': { mean: 480, std: 360, texture: 190, high: 0.002, low: 0.015 },
  'DX|脊柱': { mean: 560, std: 380, texture: 200, high: 0.01, low: 0.015 },
  'DX|上肢': { mean: 520, std: 360, texture: 190, high: 0.005, low: 0.02 },
  'DX|default': { mean: 520, std: 360, texture: 190, high: 0.005, low: 0.02 },
  'MG|乳腺': { mean: 600, std: 400, texture: 230, high: 0.01, low: 0.01 },
  'MG|default': { mean: 600, std: 400, texture: 230, high: 0.01, low: 0.01 },
  'US|腹部': { mean: 700, std: 450, texture: 280, high: 0.002, low: 0.002 },
  'US|甲状腺': { mean: 720, std: 440, texture: 270, high: 0.001, low: 0.001 },
  'US|default': { mean: 710, std: 450, texture: 275, high: 0.002, low: 0.002 },
}

/** 构建确定性 demo 影像特征 (标注 source: 'demo', 与真实提取同域同向量) */
export function buildDemoFeatures(seed: DemoFeatureSeed): ImageFeatures {
  const { modality, bodyPart } = seed
  const template = DEMO_TEMPLATES[`${modality}|${bodyPart}`] ?? DEMO_TEMPLATES[`${modality}|default`] ?? { mean: 0, std: 200, texture: 100, high: 0.02, low: 0.02 }
  const h = hashString(`${seed.seriesUid}`)
  const jitter = (v: number, amp: number) => v + (((h % 251) / 250) - 0.5) * 2 * amp
  const mean = jitter(template.mean, Math.min(30, Math.max(18, template.std * 0.18)))
  const std = Math.max(20, jitter(template.std, template.std * 0.1))
  const texture = Math.max(5, jitter(template.texture, template.texture * 0.1))
  const high = Math.max(0, Math.min(0.3, jitter(template.high, 0.003)))
  const low = Math.max(0, Math.min(0.3, jitter(template.low, 0.003)))
  const { min, span } = domainBounds(modality)
  const hist = gaussianHistogram(mean, std, min, span, h)
  const total = hist.reduce((a, b) => a + b, 0)
  const s = statsFromHistogram(hist, total, min, span)
  const vector = buildVector(hist, total, min, span, s, texture, high, low)
  return {
    seriesUid: seed.seriesUid,
    studyUid: seed.studyUid,
    modality,
    bodyPart,
    instanceCount: 1,
    rows: 512,
    columns: 512,
    mean: Math.round(s.mean * 10) / 10,
    std: Math.round(s.std * 10) / 10,
    skew: Math.round(s.skew * 100) / 100,
    kurtosis: Math.round(s.kurtosis * 100) / 100,
    min: Math.round(s.minV),
    max: Math.round(s.maxV),
    percentiles: s.percentiles.map((p) => Math.round(p)) as [number, number, number, number, number],
    textureEnergy: Math.round(texture * 10) / 10,
    highDensityRatio: Math.round(high * 10000) / 10000,
    lowDensityRatio: Math.round(low * 10000) / 10000,
    histogram: hist,
    vector,
    source: 'demo',
  }
}

/** 余弦相似度 (L2 归一化向量) */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  let dot = 0
  for (let i = 0; i < n; i++) dot += a[i]! * b[i]!
  return Math.max(-1, Math.min(1, dot))
}

/** 模态/部位匹配分: 模态 0.55 + 部位 0.45 */
export function modalityMatch(q: { modality: string; bodyPart: string }, c: { modality: string; bodyPart: string }): number {
  let score = 0
  if (q.modality && q.modality === c.modality) score += 0.55
  if (q.bodyPart && q.bodyPart === c.bodyPart) score += 0.45
  return score
}

/** 影像相似度 = 0.6 × 余弦 + 0.4 × 模态/部位匹配
 *  跨模态家族 (CT 族 vs 非 CT 族) 特征域不同 (HU vs 信号), 特征余弦记 0 — 与
 *  Siemens/Infinitt 影像检索的模态门控策略一致, 保证同模态相似度 > 不同模态 */
export function imageSimilarity(q: { modality: string; bodyPart: string; vector: number[] }, c: { modality: string; bodyPart: string; vector: number[] }): { cos: number; match: number; score: number } {
  const cos = isCtFamily(q.modality) === isCtFamily(c.modality) ? cosine(q.vector, c.vector) : 0
  const match = modalityMatch(q, c)
  return { cos, match, score: 0.6 * cos + 0.4 * match }
}

/** 从磁盘真实 DICOM 文件提取特征 (供 spec 直接验证真实样本) */
export function extractFeaturesFromFiles(opts: {
  seriesUid: string
  studyUid: string
  modality: string
  bodyPart: string
  files: string[]
}): ImageFeatures {
  const slices = opts.files.map((f) => parseDicomPart10(fs.readFileSync(f)))
  return extractFeatures({
    seriesUid: opts.seriesUid,
    studyUid: opts.studyUid,
    modality: opts.modality,
    bodyPart: opts.bodyPart,
    slices,
    instanceCount: opts.files.length,
    source: 'real',
  })
}
