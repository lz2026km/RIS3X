/**
 * [G005 v3.0.6.11-101 Wave 1B (G-10)] 降噪推理管线
 *
 * 管线: 预处理归一化 (0-255 → [0,1]) → 核算法/DL 模型推理 → 后处理反归一化
 *
 * 可配置核 (经典算法, 全部确定性):
 *   - median   : 3x3 中值 (既有, strength>=50 二次滤波)
 *   - gaussian : 可分离高斯 (radius 由 strength 决定, sigma=radius*0.6)
 *   - bilateral: 双边滤波 (空间域 + 值域联合权重, 保边)
 *   - nlmeans  : 非局部均值 (搜索窗/块窗, 确定性权重)
 *   - dl       : 通过 InferenceBackend (ONNX/WASM/Mock) 的模型接口
 *
 * 降噪强度 3 档预设: light / standard / strong
 */
import type { InferenceBackend } from './model-loader'
import { estimateGaussianSigma } from './noise-estimator'

export type DenoiseKernel = 'median' | 'gaussian' | 'bilateral' | 'nlmeans' | 'dl'

export type DenoisePreset = 'light' | 'standard' | 'strong'

export interface PresetProfile {
  /** 等效强度 0-100 */
  strength: number
  label: string
  /** 滤波通过次数 */
  passes: number
}

export const STRENGTH_PRESETS: Record<DenoisePreset, PresetProfile> = {
  light: { strength: 30, label: '轻', passes: 1 },
  standard: { strength: 50, label: '标准', passes: 1 },
  strong: { strength: 75, label: '强力', passes: 2 },
}

/** 强度 → 预设 (就近 3 档) */
export function presetForStrength(strength: number): DenoisePreset {
  if (strength < 40) return 'light'
  if (strength < 65) return 'standard'
  return 'strong'
}

export function clampStrength(strength: number): number {
  return Math.max(0, Math.min(100, Math.round(strength)))
}

export interface DenoisePipelineInput {
  data: Uint8Array
  width: number
  height: number
  channels: number
  kernel: DenoiseKernel
  strength: number
  modelId?: string
  backend?: InferenceBackend
  /** 滤波通过次数 (默认由 3 档预设派生) */
  passes?: number
}

export interface DenoisePipelineOutput {
  denoised: Uint8Array
  algorithm: string
  /** 预处理耗时/推理/后处理 (ms) */
  elapsedMs: number
  kernel: DenoiseKernel
  preset: DenoisePreset
  passes: number
  backendProvider?: string
  /** 噪声方差下降率 0-1 */
  noiseReduction: number
  varianceBefore: number
  varianceAfter: number
}

// ─────────────────────────── 预处理 / 后处理 ───────────────────────────

/** 归一化: 0-255 → [0,1] float32 (单通道, 通道取均值) */
export function preprocess(data: Uint8Array, width: number, height: number, channels: number): Float32Array {
  const n = width * height
  const out = new Float32Array(n)
  const ch = Math.min(3, channels)
  for (let p = 0; p < n; p++) {
    let v = 0
    for (let c = 0; c < ch; c++) v += data[p * channels + c]!
    out[p] = (v / Math.max(1, ch)) / 255
  }
  return out
}

/** 反归一化: [0,1] float32 → 0-255 uint8 (灰度展开到 channels) */
export function postprocess(input: Float32Array, width: number, height: number, channels: number): Uint8Array {
  const n = width * height
  const out = new Uint8Array(n * channels)
  for (let p = 0; p < n; p++) {
    const v = Math.max(0, Math.min(255, Math.round(input[p]! * 255)))
    for (let c = 0; c < channels; c++) out[p * channels + c] = v
  }
  return out
}

// ─────────────────────────── 经典核 (确定性) ───────────────────────────

/** 高斯核权重表 (radius → [w0..wR]) */
function gaussianKernel(radius: number, sigma: number): number[] {
  const ws: number[] = []
  let sum = 0
  for (let d = -radius; d <= radius; d++) {
    const w = Math.exp(-(d * d) / (2 * sigma * sigma))
    ws.push(w)
    sum += w
  }
  return ws.map((w) => w / sum)
}

/** 可分离高斯滤波 (两次一维卷积, O(n·radius)) */
export function gaussianFilter(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  radius = 2,
  sigma = 1.2,
): Uint8Array {
  const ker = gaussianKernel(radius, sigma)
  const out = new Uint8Array(data.length)
  const tmp = new Float64Array(data.length)
  // 水平
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let acc = 0
        for (let k = -radius; k <= radius; k++) {
          const nx = Math.min(width - 1, Math.max(0, x + k))
          acc += data[(y * width + nx) * channels + c]! * ker[k + radius]!
        }
        tmp[(y * width + x) * channels + c] = acc
      }
    }
  }
  // 垂直
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let acc = 0
        for (let k = -radius; k <= radius; k++) {
          const ny = Math.min(height - 1, Math.max(0, y + k))
          acc += tmp[(ny * width + x) * channels + c]! * ker[k + radius]!
        }
        out[(y * width + x) * channels + c] = Math.round(acc)
      }
    }
  }
  return out
}

/** 双边滤波: 空间高斯 × 值域高斯 (保边缘) */
export function bilateralFilter(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  radius = 2,
  sigmaSpatial = 2.5,
  sigmaRange = 30,
): Uint8Array {
  const out = new Uint8Array(data.length)
  const sKer = gaussianKernel(radius, sigmaSpatial)
  const rangeInv = 1 / (2 * sigmaRange * sigmaRange)
  const ch = Math.min(3, channels)
  const isGray = ch === 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = (y * width + x) * channels
      const center = isGray ? data[centerIdx]! : (data[centerIdx]! + data[centerIdx + 1]! + data[centerIdx + 2]!) / 3
      for (let c = 0; c < channels; c++) {
        let sum = 0
        let wSum = 0
        for (let dy = -radius; dy <= radius; dy++) {
          const ny = Math.min(height - 1, Math.max(0, y + dy))
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx))
            const idx = (ny * width + nx) * channels + c
            const v = data[idx]!
            const neighbor = isGray ? v : (data[idx]! + data[idx + 1]! + data[idx + 2]!) / 3
            const diff = neighbor - center
            const w = sKer[dy + radius]! * sKer[dx + radius]! * Math.exp(-diff * diff * rangeInv)
            sum += v * w
            wSum += w
          }
        }
        out[centerIdx + c] = wSum > 0 ? Math.round(sum / wSum) : data[centerIdx + c]!
      }
    }
  }
  return out
}

/** 非局部均值: 块内灰度均值相似度加权 (确定性) */
export function nlmeansFilter(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  searchRadius = 4,
  patchRadius = 1,
  h = 18,
): Uint8Array {
  const out = new Uint8Array(data.length)
  const patchSize = (patchRadius * 2 + 1) ** 2
  const ch = Math.min(3, channels)

  // 每个通道独立: 块均值/权重按通道灰度计算
  const patchMean = (cy: number, cx: number, c: number): number => {
    let s = 0
    for (let dy = -patchRadius; dy <= patchRadius; dy++) {
      const ny = Math.min(height - 1, Math.max(0, cy + dy))
      for (let dx = -patchRadius; dx <= patchRadius; dx++) {
        const nx = Math.min(width - 1, Math.max(0, cx + dx))
        s += data[(ny * width + nx) * channels + c]!
      }
    }
    return s / patchSize
  }

  const h2 = h * h
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const centerIdx = (y * width + x) * channels
      for (let c = 0; c < ch; c++) {
        const p0 = patchMean(y, x, c)
        let wSum = 0
        let vSum = 0
        for (let sy = Math.max(0, y - searchRadius); sy <= Math.min(height - 1, y + searchRadius); sy++) {
          for (let sx = Math.max(0, x - searchRadius); sx <= Math.min(width - 1, x + searchRadius); sx++) {
            const p1 = patchMean(sy, sx, c)
            const d = p1 - p0
            const w = Math.exp(-(d * d) / h2)
            wSum += w
            vSum += w * data[(sy * width + sx) * channels + c]!
          }
        }
        out[centerIdx + c] = wSum > 0 ? Math.round(vSum / wSum) : data[centerIdx + c]!
      }
    }
  }
  return out
}

/** 方差 (指标用) */
export function varianceOf(data: Uint8Array): number {
  if (data.length === 0) return 0
  let s = 0
  for (let i = 0; i < data.length; i++) s += data[i]!
  const m = s / data.length
  let v = 0
  for (let i = 0; i < data.length; i++) {
    const d = data[i]! - m
    v += d * d
  }
  return v / data.length
}

/** 核参数由强度派生 (确定性) */
export function kernelParams(kernel: DenoiseKernel, strength: number): Record<string, number> {
  switch (kernel) {
    case 'gaussian':
      return { radius: strength >= 65 ? 3 : 2, sigma: strength >= 65 ? 1.8 : 1.2 }
    case 'bilateral':
      return { radius: strength >= 65 ? 3 : 2, sigmaSpatial: 2.5, sigmaRange: 15 + strength * 0.3 }
    case 'nlmeans':
      return { searchRadius: 3, patchRadius: 1, h: 10 + strength * 0.25 }
    default:
      return {}
  }
}

// ─────────────────────────── 管线编排 ───────────────────────────

export function applyKernel(
  kernel: DenoiseKernel,
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
  strength: number,
  passes: number,
): { denoised: Uint8Array; algorithm: string } {
  const params = kernelParams(kernel, strength)
  let out: Uint8Array = data
  let algorithm = ''
  for (let p = 0; p < passes; p++) {
    switch (kernel) {
      case 'median': {
        out = median3x3(out, width, height, channels)
        algorithm = passes >= 2 ? 'median-3x3-x2' : 'median-3x3'
        break
      }
      case 'gaussian': {
        out = gaussianFilter(out, width, height, channels, params['radius']!, params['sigma']!)
        algorithm = passes >= 2 ? `gaussian-${params['radius']! * 2 + 1}x${params['radius']! * 2 + 1}-x2` : `gaussian-${params['radius']! * 2 + 1}x${params['radius']! * 2 + 1}`
        break
      }
      case 'bilateral': {
        out = bilateralFilter(out, width, height, channels, params['radius']!, params['sigmaSpatial']!, params['sigmaRange']!)
        algorithm = passes >= 2 ? `bilateral-${params['radius']! * 2 + 1}x${params['radius']! * 2 + 1}-x2` : `bilateral-${params['radius']! * 2 + 1}x${params['radius']! * 2 + 1}`
        break
      }
      case 'nlmeans': {
        out = nlmeansFilter(out, width, height, channels, params['searchRadius']!, params['patchRadius']!, params['h']!)
        algorithm = 'nlmeans'
        break
      }
      default: {
        algorithm = 'dl-model'
      }
    }
  }
  return { denoised: out, algorithm }
}

/** 3x3 中值 (与既有 denoise-processor.medianFilter 等价, 本地副本避免循环依赖) */
function median3x3(data: Uint8Array, width: number, height: number, channels: number): Uint8Array {
  const out = new Uint8Array(data.length)
  const window = new Array<number>(9)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < channels; c++) {
        let k = 0
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx))
            const ny = Math.min(height - 1, Math.max(0, y + dy))
            window[k++] = data[(ny * width + nx) * channels + c]!
          }
        }
        window.sort((a, b) => a - b)
        out[(y * width + x) * channels + c] = window[4]!
      }
    }
  }
  return out
}

/**
 * 完整降噪管线入口:
 *   预处理归一化 → 核算法或 DL 模型推理 → 后处理反归一化 → 方差指标
 */
export async function runDenoisePipeline(input: DenoisePipelineInput): Promise<DenoisePipelineOutput> {
  const started = Date.now()
  const { data, width, height, channels, kernel, strength, modelId, backend } = input
  const preset = presetForStrength(strength)
  const profile = STRENGTH_PRESETS[preset]!
  const passes = Math.max(1, Math.min(3, input.passes ?? profile.passes))
  // 噪声方差 (Laplacian-MAD 估计): 结构不变时反映真实噪声水平
  const noiseSigmaBefore = estimateGaussianSigma(data, width, height, channels)
  const varianceBefore = noiseSigmaBefore * noiseSigmaBefore

  let denoised: Uint8Array
  let algorithm: string
  let backendProvider: string | undefined
  let dlLatencyMs = 0

  if (kernel === 'dl') {
    // DL 模型接口: 归一化 → 推理 → 反归一化
    const normalized = preprocess(data, width, height, channels)
    const be = backend ?? (await import('./model-loader')).mockBackend(modelId ?? 'unet')
    const { output, latencyMs } = await be.run(normalized, [1, 1, height, width])
    dlLatencyMs = latencyMs
    backendProvider = be.provider
    denoised = postprocess(output, width, height, channels)
    algorithm = 'dl-model'
  } else {
    const res = applyKernel(kernel, data, width, height, channels, strength, passes)
    denoised = res.denoised
    algorithm = res.algorithm
  }

  const noiseSigmaAfter = estimateGaussianSigma(denoised, width, height, channels)
  const varianceAfter = noiseSigmaAfter * noiseSigmaAfter
  return {
    denoised,
    algorithm,
    elapsedMs: Date.now() - started + dlLatencyMs,
    kernel,
    preset,
    passes,
    backendProvider,
    noiseReduction: varianceBefore > 0 ? Math.max(0, Math.min(1, 1 - varianceAfter / varianceBefore)) : 0,
    varianceBefore: Math.round(varianceBefore * 100) / 100,
    varianceAfter: Math.round(varianceAfter * 100) / 100,
  }
}
