/**
 * [v3.0.6.11-101 Wave 2C] 影像分割深化 — 分割算法库 (纯函数, 确定性, 无随机)
 *
 * 算法 (全部确定性输出 mask):
 * - region_grow     : 区域生长 (种子点 + 强度范围 + 26 邻域连通域); 无有效种子时
 *                     回退阈值最大内部连通域 (usedFallback=true, seed 回退)
 * - threshold       : 阈值分割 (mode=otsu 自动 Otsu 阈值 / mode=manual 手动双阈值)
 * - edge_canny      : 边缘检测 (简化 Canny: 高斯平滑 + Sobel 梯度 + 非极大抑制 +
 *                     双阈值滞回, 逐轴向切片 2D)
 * - kmeans          : 聚类分割 (强度 1D K-means, k=4, 分位数确定性初始化)
 * - active_contour  : 活动轮廓简化版 (阈值外力 + 形态学闭运算蛇形平滑 + 孔洞填充)
 */
import type { RealVolume } from '../volume/volume.service'

export type SegmentationAlgorithm = 'region_grow' | 'threshold' | 'edge_canny' | 'kmeans' | 'active_contour'
export type ThresholdMode = 'otsu' | 'manual'
export type OrganClass = '结节' | '骨骼' | '肝脏' | '肺' | '血管' | '软组织' | '其他'

export interface SeedPoint {
  x: number
  y: number
  z: number
}

export interface AlgorithmParams {
  thresholdLo?: number
  thresholdHi?: number
  thresholdMode?: ThresholdMode
  seed?: SeedPoint | null
  /** Canny 高斯平滑迭代次数 */
  sigma?: number
  edgeLow?: number
  edgeHigh?: number
  /** K-means / 活动轮廓迭代次数 */
  iterations?: number
  minVoxels?: number
}

export interface RleRun {
  start: number
  length: number
}

export interface RunExtra {
  otsuThreshold?: number
  k?: number
  classCentroids?: number[]
  smoothingIterations?: number
  sigma?: number
  edgeHighAuto?: number
  edgeLowAuto?: number
  /** 是否回退到无种子阈值模式 */
  seedFallback?: boolean
}

export interface RunOutcome {
  mask: Uint8Array
  usedFallback: boolean
  extra: RunExtra
}

export const ALGORITHM_LABEL: Record<SegmentationAlgorithm, string> = {
  region_grow: '区域生长',
  threshold: '阈值分割',
  edge_canny: 'Canny 边缘',
  kmeans: 'K-means 聚类',
  active_contour: '活动轮廓',
}

// ────────────────────────────────────────────────────────────────────────────
// RLE 编解码 (flat 3D 布尔掩码 → 游程对)
// ────────────────────────────────────────────────────────────────────────────

export function encodeRle(mask: Uint8Array): RleRun[] {
  const runs: RleRun[] = []
  let i = 0
  const n = mask.length
  while (i < n) {
    if (mask[i] === 0) {
      i++
      continue
    }
    const start = i
    while (i < n && mask[i] === 1) i++
    runs.push({ start, length: i - start })
  }
  return runs
}

export function decodeRle(runs: RleRun[], length: number): Uint8Array {
  const out = new Uint8Array(length)
  for (const run of runs) {
    for (let i = 0; i < run.length; i++) out[run.start + i] = 1
  }
  return out
}

// ────────────────────────────────────────────────────────────────────────────
// 通用掩码操作
// ────────────────────────────────────────────────────────────────────────────

/** 原始强度阈值掩码 (v ∈ [lo, hi], 无连通域过滤) */
export function thresholdMaskRaw(vol: RealVolume, lo: number, hi: number): Uint8Array {
  const total = vol.width * vol.height * vol.depth
  const mask = new Uint8Array(total)
  const data = vol.data
  for (let i = 0; i < total; i++) {
    const v = data[i]!
    mask[i] = v >= lo && v <= hi ? 1 : 0
  }
  return mask
}

/** 26 邻域连通域标记 → 各分量计数/贴边标记 */
function labelComponents(mask: Uint8Array, W: number, H: number, D: number): { labels: Int32Array; counts: number[]; touchesBorder: boolean[]; count: number } {
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
  return { labels, counts, touchesBorder, count: nextLabel }
}

/** 内部 (不贴 x/y 边界=体外背景) 最大连通域 */
export function largestInteriorComponent(mask: Uint8Array, W: number, H: number, D: number): Uint8Array {
  const total = W * H * D
  const { labels, counts, touchesBorder, count } = labelComponents(mask, W, H, D)
  let best = -1
  let bestCount = 0
  for (let l = 0; l < count; l++) {
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

/** 阈值掩码 → 内部最大连通域 */
export function thresholdInterior(vol: RealVolume, lo: number, hi: number): Uint8Array {
  return largestInteriorComponent(thresholdMaskRaw(vol, lo, hi), vol.width, vol.height, vol.depth)
}

/** 3D 膨胀 (6 邻域) */
export function dilate3d(mask: Uint8Array, W: number, H: number, D: number): Uint8Array {
  const next = new Uint8Array(W * H * D)
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (!mask[z * (W * H) + y * W + x]) continue
        for (let dz = -1; dz <= 1; dz++) {
          const nz = z + dz
          if (nz < 0 || nz >= D) continue
          for (let dy = -1; dy <= 1; dy++) {
            const ny = y + dy
            if (ny < 0 || ny >= H) continue
            for (let dx = -1; dx <= 1; dx++) {
              const nx = x + dx
              if (nx < 0 || nx >= W) continue
              if (dz === 0 && dy === 0 && dx === 0) continue
              next[nz * (W * H) + ny * W + nx] = 1
            }
          }
        }
      }
    }
  }
  return next
}

/** 3D 腐蚀 (6 邻域, 核心必须全为 1) */
export function erode3d(mask: Uint8Array, W: number, H: number, D: number): Uint8Array {
  const next = new Uint8Array(W * H * D)
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = z * (W * H) + y * W + x
        if (!mask[idx]) continue
        let all = true
        for (let dz = -1; dz <= 1 && all; dz++) {
          const nz = z + dz
          if (nz < 0 || nz >= D) { all = false; break }
          for (let dy = -1; dy <= 1 && all; dy++) {
            const ny = y + dy
            if (ny < 0 || ny >= H) { all = false; break }
            for (let dx = -1; dx <= 1 && all; dx++) {
              const nx = x + dx
              if (nx < 0 || nx >= W) { all = false; break }
              if (!mask[nz * (W * H) + ny * W + nx]) { all = false; break }
            }
          }
        }
        if (all) next[idx] = 1
      }
    }
  }
  return next
}

/** 3D 形态学闭运算 (膨胀后腐蚀) */
export function close3d(mask: Uint8Array, W: number, H: number, D: number): Uint8Array {
  return erode3d(dilate3d(mask, W, H, D), W, H, D)
}

/** 逐轴向切片 2D 孔洞填充 (从边界背景洪水填充, 未触及区域为孔洞) */
export function fillSliceHoles(mask: Uint8Array, W: number, H: number): Uint8Array {
  const bg = new Uint8Array(W * H)
  const stack: number[] = []
  for (let x = 0; x < W; x++) {
    if (mask[x] === 0 && !bg[x]) { bg[x] = 1; stack.push(x) }
    const bot = (H - 1) * W + x
    if (mask[bot] === 0 && !bg[bot]) { bg[bot] = 1; stack.push(bot) }
  }
  for (let y = 0; y < H; y++) {
    const left = y * W
    if (mask[left] === 0 && !bg[left]) { bg[left] = 1; stack.push(left) }
    const right = y * W + W - 1
    if (mask[right] === 0 && !bg[right]) { bg[right] = 1; stack.push(right) }
  }
  while (stack.length > 0) {
    const idx = stack.pop()!
    const y = Math.floor(idx / W)
    const x = idx % W
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= H) continue
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= W) continue
        const nIdx = ny * W + nx
        if (mask[nIdx] === 0 && !bg[nIdx]) {
          bg[nIdx] = 1
          stack.push(nIdx)
        }
      }
    }
  }
  const out = new Uint8Array(W * H)
  // mask=1 的体素必然 bg=0 (洪泛只穿越背景); 背景不可达区 (孔洞) 一并填充
  for (let i = 0; i < W * H; i++) out[i] = bg[i] === 0 ? 1 : 0
  return out
}

/** 3D 孔洞填充 (逐轴切片) */
export function fillHoles3d(mask: Uint8Array, W: number, H: number, D: number): Uint8Array {
  const out = new Uint8Array(mask)
  for (let z = 0; z < D; z++) {
    const slice = new Uint8Array(W * H)
    slice.set(mask.subarray(z * (W * H), (z + 1) * (W * H)))
    out.set(fillSliceHoles(slice, W, H), z * (W * H))
  }
  return out
}

/** 掩码边界点数: 至少一个 6 邻域在掩码外 (含体积边界) 的体素数 */
export function countBoundaryPoints(mask: Uint8Array, W: number, H: number, D: number): number {
  let count = 0
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = z * (W * H) + y * W + x
        if (!mask[idx]) continue
        if (x === 0 || x === W - 1 || y === 0 || y === H - 1 || z === 0 || z === D - 1) {
          count++
          continue
        }
        if (!mask[idx - 1] || !mask[idx + 1] || !mask[idx - W] || !mask[idx + W] || !mask[idx - W * H] || !mask[idx + W * H]) {
          count++
        }
      }
    }
  }
  return count
}

// ────────────────────────────────────────────────────────────────────────────
// 区域生长 (种子点 + 强度阈值 + 26 邻域连通域)
// ────────────────────────────────────────────────────────────────────────────

export function runRegionGrow(vol: RealVolume, params: AlgorithmParams): RunOutcome {
  const { width: W, height: H, depth: D } = vol
  const lo = params.thresholdLo ?? -100
  const hi = params.thresholdHi ?? 100
  let mask: Uint8Array = new Uint8Array(W * H * D)
  let usedFallback = false
  let seedFallback = false
  if (params.seed) {
    const sx = Math.max(0, Math.min(W - 1, Math.round(params.seed.x)))
    const sy = Math.max(0, Math.min(H - 1, Math.round(params.seed.y)))
    const sz = Math.max(0, Math.min(D - 1, Math.round(params.seed.z)))
    const seedValue = vol.data[sz * (W * H) + sy * W + sx]!
    if (seedValue >= lo && seedValue <= hi) {
      mask = regionGrowBfs(vol, sx, sy, sz, lo, hi)
    } else {
      usedFallback = true
      seedFallback = true
    }
  } else {
    usedFallback = true
    seedFallback = true
  }
  if (usedFallback) {
    mask = thresholdInterior(vol, lo, hi)
  }
  return { mask, usedFallback, extra: { seedFallback } }
}

/** 26 邻域 BFS 区域生长 */
export function regionGrowBfs(vol: RealVolume, sx: number, sy: number, sz: number, lo: number, hi: number): Uint8Array {
  const { width: W, height: H, depth: D } = vol
  const mask = new Uint8Array(W * H * D)
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

// ────────────────────────────────────────────────────────────────────────────
// 阈值分割 (Otsu 自动 / 手动双阈值)
// ────────────────────────────────────────────────────────────────────────────

/**
 * 全局 Otsu 自动阈值: 最大化类间方差 σ²b = ω0·ω1·(μ0-μ1)²
 * 直方图按 1 强度单位分桶 (Int16 值域 ≤ 65536 桶), 确定性无随机
 */
export function otsuThreshold(data: Int16Array, min: number, max: number): number {
  const span = Math.max(1, max - min + 1)
  const hist = new Float64Array(span)
  const total = data.length
  for (let i = 0; i < total; i++) hist[data[i]! - min]!++
  const sum = total
  let bestT = 0
  let bestVar = -1
  let sumAll = 0
  for (let i = 0; i < span; i++) sumAll += hist[i]! * i
  let sum0 = 0
  let count0 = 0
  for (let t = 0; t < span - 1; t++) {
    count0 += hist[t]!
    if (count0 === 0) continue
    const count1 = sum - count0
    if (count1 === 0) break
    sum0 += hist[t]! * t
    const mu0 = sum0 / count0
    const mu1 = (sumAll - sum0) / count1
    const between = count0 * count1 * (mu0 - mu1) * (mu0 - mu1)
    if (between > bestVar) {
      bestVar = between
      bestT = t
    }
  }
  return min + bestT + 0.5
}

export function otsuOfVolume(vol: RealVolume): number {
  return otsuThreshold(vol.data, vol.min, vol.max)
}

export function runThreshold(vol: RealVolume, params: AlgorithmParams): RunOutcome {
  const mode = params.thresholdMode ?? 'manual'
  const hi = params.thresholdHi ?? 3071
  const extra: RunExtra = {}
  let mask: Uint8Array
  if (mode === 'otsu') {
    const t = otsuOfVolume(vol)
    extra.otsuThreshold = +t.toFixed(2)
    mask = thresholdInterior(vol, Math.ceil(t), hi)
  } else {
    const lo = params.thresholdLo ?? 40
    mask = thresholdInterior(vol, lo, hi)
  }
  if (params.minVoxels && countVoxels(mask) < params.minVoxels) {
    mask = new Uint8Array(mask.length)
  }
  return { mask, usedFallback: false, extra }
}

// ────────────────────────────────────────────────────────────────────────────
// 边缘检测 (简化 Canny, 逐轴向切片 2D)
// ────────────────────────────────────────────────────────────────────────────

function gaussianBlurSlice(src: Float32Array, W: number, H: number, iterations: number): Float32Array {
  let cur = new Float32Array(src)
  const tmp = new Float32Array(W * H)
  for (let it = 0; it < iterations; it++) {
    // 水平 [1,2,1]/4
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const l = x > 0 ? cur[y * W + x - 1]! : cur[y * W + x]!
        const r = x < W - 1 ? cur[y * W + x + 1]! : cur[y * W + x]!
        tmp[y * W + x] = (l + 2 * cur[y * W + x]! + r) / 4
      }
    }
    // 垂直 [1,2,1]/4
    for (let y = 0; y < H; y++) {
      const u = y > 0 ? y - 1 : 0
      const d = y < H - 1 ? y + 1 : H - 1
      for (let x = 0; x < W; x++) {
        cur[y * W + x] = (tmp[u * W + x]! + 2 * tmp[y * W + x]! + tmp[d * W + x]!) / 4
      }
    }
  }
  return cur
}

function cannySlice(src: Float32Array, W: number, H: number, low: number, high: number): Uint8Array {
  const mag = new Float32Array(W * H)
  const dir = new Int8Array(W * H)
  for (let y = 0; y < H; y++) {
    const y0 = y > 0 ? y - 1 : 0
    const y2 = y < H - 1 ? y + 1 : H - 1
    for (let x = 0; x < W; x++) {
      const x0 = x > 0 ? x - 1 : 0
      const x2 = x < W - 1 ? x + 1 : W - 1
      const gx = -src[y0 * W + x0]! - 2 * src[y * W + x0]! - src[y2 * W + x0]! + src[y0 * W + x2]! + 2 * src[y * W + x2]! + src[y2 * W + x2]!
      const gy = -src[y0 * W + x0]! - 2 * src[y0 * W + x]! - src[y0 * W + x2]! + src[y2 * W + x0]! + 2 * src[y2 * W + x]! + src[y2 * W + x2]!
      const idx = y * W + x
      mag[idx] = Math.sqrt(gx * gx + gy * gy)
      const angle = Math.atan2(gy, gx)
      const deg = ((angle * 180) / Math.PI + 360) % 180
      dir[idx] = deg < 22.5 || deg >= 157.5 ? 0 : deg < 67.5 ? 1 : deg < 112.5 ? 2 : 3
    }
  }
  // 非极大抑制
  const nms = new Float32Array(W * H)
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const idx = y * W + x
      const d = dir[idx]!
      const m = mag[idx]!
      let n1 = 0
      let n2 = 0
      if (d === 0) { n1 = mag[y * W + x - 1]!; n2 = mag[y * W + x + 1]! }
      else if (d === 1) { n1 = mag[(y - 1) * W + x + 1]!; n2 = mag[(y + 1) * W + x - 1]! }
      else if (d === 2) { n1 = mag[(y - 1) * W + x]!; n2 = mag[(y + 1) * W + x]! }
      else { n1 = mag[(y - 1) * W + x - 1]!; n2 = mag[(y + 1) * W + x + 1]! }
      if (m >= n1 && m >= n2) nms[idx] = m
    }
  }
  // 双阈值滞回: 强边缘 + 与其 8 邻域连通的弱边缘
  const out = new Uint8Array(W * H)
  const stack: number[] = []
  for (let i = 0; i < W * H; i++) {
    if (nms[i]! >= high) {
      out[i] = 1
      stack.push(i)
    }
  }
  while (stack.length > 0) {
    const idx = stack.pop()!
    const y = Math.floor(idx / W)
    const x = idx % W
    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy
      if (ny < 0 || ny >= H) continue
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx
        if (nx < 0 || nx >= W) continue
        const nIdx = ny * W + nx
        if (!out[nIdx] && nms[nIdx]! >= low) {
          out[nIdx] = 1
          stack.push(nIdx)
        }
      }
    }
  }
  return out
}

/** 梯度幅值非零分位阈值 (确定性自适应) */
function percentileThresholds(magList: number[], pLow: number, pHigh: number): [number, number] {
  const vals = magList.slice().sort((a, b) => a - b)
  if (vals.length === 0) return [0, 0]
  const low = vals[Math.min(vals.length - 1, Math.floor(vals.length * pLow))]!
  const high = vals[Math.min(vals.length - 1, Math.floor(vals.length * pHigh))]!
  return [Math.max(0.01, low), Math.max(low + 0.01, high)]
}

export function runEdgeCanny(vol: RealVolume, params: AlgorithmParams): RunOutcome {
  const { width: W, height: H, depth: D } = vol
  const iterations = Math.max(1, Math.round(params.sigma ?? 1))
  const magSamples: number[] = []
  for (let z = 0; z < D; z++) {
    const src = new Float32Array(W * H)
    const base = z * (W * H)
    for (let i = 0; i < W * H; i++) src[i] = vol.data[base + i]!
    const blurred = gaussianBlurSlice(src, W, H, iterations)
    // 采样梯度幅值 (步长 4, 确定性) 用于自适应阈值
    for (let y = 0; y < H; y += 4) {
      for (let x = 0; x < W; x += 4) {
        const x0 = x > 0 ? x - 1 : 0
        const x2 = x < W - 1 ? x + 1 : W - 1
        const y0 = y > 0 ? y - 1 : 0
        const y2 = y < H - 1 ? y + 1 : H - 1
        const gx = -blurred[y0 * W + x0]! - 2 * blurred[y * W + x0]! - blurred[y2 * W + x0]! + blurred[y0 * W + x2]! + 2 * blurred[y * W + x2]! + blurred[y2 * W + x2]!
        const gy = -blurred[y0 * W + x0]! - 2 * blurred[y0 * W + x]! - blurred[y0 * W + x2]! + blurred[y2 * W + x0]! + 2 * blurred[y2 * W + x]! + blurred[y2 * W + x2]!
        magSamples.push(Math.sqrt(gx * gx + gy * gy))
      }
    }
  }
  const [low, high] = params.edgeLow !== undefined && params.edgeHigh !== undefined
    ? [params.edgeLow, params.edgeHigh]
    : percentileThresholds(magSamples, 0.6, 0.92)
  const mask = new Uint8Array(W * H * D)
  for (let z = 0; z < D; z++) {
    const src = new Float32Array(W * H)
    const base = z * (W * H)
    for (let i = 0; i < W * H; i++) src[i] = vol.data[base + i]!
    const blurred = gaussianBlurSlice(src, W, H, iterations)
    const edges = cannySlice(blurred, W, H, low, high)
    mask.set(edges, base)
  }
  return { mask, usedFallback: false, extra: { sigma: iterations, edgeLowAuto: +low.toFixed(2), edgeHighAuto: +high.toFixed(2) } }
}

// ────────────────────────────────────────────────────────────────────────────
// K-means 聚类 (强度 1D, k=4, 分位数确定性初始化)
// ────────────────────────────────────────────────────────────────────────────

export function kmeansClasses(data: Int16Array, min: number, max: number, k: number, iterations: number): { centroids: number[]; assignment: (v: number) => number } {
  const span = Math.max(1, max - min)
  const step = span / (k + 1)
  let centroids: number[] = []
  for (let i = 1; i <= k; i++) centroids.push(min + step * i)
  const samples: number[] = []
  const stride = Math.max(1, Math.floor(data.length / 100000))
  for (let i = 0; i < data.length; i += stride) samples.push(data[i]!)
  for (let it = 0; it < iterations; it++) {
    const sums = new Array<number>(k).fill(0)
    const counts = new Array<number>(k).fill(0)
    for (const v of samples) {
      let best = 0
      let bestDist = Infinity
      for (let c = 0; c < k; c++) {
        const d = Math.abs(v - centroids[c]!)
        if (d < bestDist) { bestDist = d; best = c }
      }
      sums[best]! += v
      counts[best]!++
    }
    let moved = false
    for (let c = 0; c < k; c++) {
      if (counts[c]! > 0) {
        const nc = sums[c]! / counts[c]!
        if (Math.abs(nc - centroids[c]!) > 1e-6) moved = true
        centroids[c] = nc
      }
    }
    if (!moved) break
  }
  const assign = (v: number): number => {
    let best = 0
    let bestDist = Infinity
    for (let c = 0; c < k; c++) {
      const d = Math.abs(v - centroids[c]!)
      if (d < bestDist) { bestDist = d; best = c }
    }
    return best
  }
  return { centroids, assignment: assign }
}

export function runKmeans(vol: RealVolume, params: AlgorithmParams): RunOutcome {
  const { width: W, height: H, depth: D } = vol
  const k = 4
  const iterations = Math.max(2, params.iterations ?? 8)
  const { centroids, assignment } = kmeansClasses(vol.data, vol.min, vol.max, k, iterations)
  // 强度 → 类别查找表 (O(range) 建表, O(1)/体素 查询, 避免逐体素闭包调用)
  const span = Math.max(1, vol.max - vol.min + 1)
  const lut = new Int8Array(span)
  for (let v = 0; v < span; v++) lut[v] = assignment(vol.min + v)
  const lo = params.thresholdLo
  const hi = params.thresholdHi
  const total = W * H * D
  const classMasks: Uint8Array[] = []
  const classCounts: number[] = []
  for (let c = 0; c < k; c++) {
    const m = new Uint8Array(total)
    let cnt = 0
    for (let i = 0; i < total; i++) {
      if (lut[vol.data[i]! - vol.min] === c) { m[i] = 1; cnt++ }
    }
    classMasks.push(m)
    classCounts.push(cnt)
  }
  let chosen = -1
  if (lo !== undefined && hi !== undefined) {
    const mid = (lo + hi) / 2
    let bestDist = Infinity
    for (let c = 0; c < k; c++) {
      const d = Math.abs(centroids[c]! - mid)
      if (d < bestDist && classCounts[c]! > 0) { bestDist = d; chosen = c }
    }
  }
  if (chosen === -1) {
    // 无强度提示: 取内部连通域最大的类 (天然排除贴边界背景类)
    let bestInterior = -1
    for (let c = 0; c < k; c++) {
      if (classCounts[c]! === 0) continue
      const n = countVoxels(largestInteriorComponent(classMasks[c]!, W, H, D))
      if (n > bestInterior) {
        bestInterior = n
        chosen = c
      }
    }
    if (chosen === -1) {
      let best = 0
      for (let c = 1; c < k; c++) if (classCounts[c]! > classCounts[best]!) best = c
      chosen = best
    }
  }
  const interior = largestInteriorComponent(classMasks[chosen]!, W, H, D)
  const mask = params.minVoxels && countVoxels(interior) < params.minVoxels ? new Uint8Array(total) : interior
  return {
    mask,
    usedFallback: false,
    extra: { k, classCentroids: centroids.map((c) => +c.toFixed(2)), smoothingIterations: iterations },
  }
}

// ────────────────────────────────────────────────────────────────────────────
// 活动轮廓简化版 (阈值外力 + 形态学闭运算蛇形平滑 + 孔洞填充)
// ────────────────────────────────────────────────────────────────────────────

export function runActiveContour(vol: RealVolume, params: AlgorithmParams): RunOutcome {
  const { width: W, height: H, depth: D } = vol
  const lo = params.thresholdLo ?? -100
  const hi = params.thresholdHi ?? 100
  const iterations = Math.max(0, params.iterations ?? 2)
  let mask = thresholdMaskRaw(vol, lo, hi)
  for (let i = 0; i < iterations; i++) {
    mask = close3d(mask, W, H, D)
    // 外力约束: 平滑后重新裁剪到强度范围
    for (let idx = 0; idx < mask.length; idx++) {
      if (mask[idx]) {
        const v = vol.data[idx]!
        if (v < lo || v > hi) mask[idx] = 0
      }
    }
  }
  mask = fillHoles3d(largestInteriorComponent(mask, W, H, D), W, H, D)
  return { mask, usedFallback: false, extra: { smoothingIterations: iterations } }
}

// ────────────────────────────────────────────────────────────────────────────
// 工具
// ────────────────────────────────────────────────────────────────────────────

export function countVoxels(mask: Uint8Array): number {
  let n = 0
  for (let i = 0; i < mask.length; i++) if (mask[i]) n++
  return n
}
