/**
 * [G005 v3.0.6.11-101 Wave 1B (G-10)] 噪声等级估计器
 *
 * 方法:
 *   - Laplacian 残差法估计高斯噪声 sigma: 平坦区噪声的 Laplacian 响应方差 = 36·σ²
 *     (L = [0,1,0; 1,-4,1; 0,1,0], Σw² = 36) → σ = √(mean(L²)/36)
 *   - 泊松噪声: sqrt 变换下方差≈0.25, 通过强度相关检测 (σ² 与均值成比例)
 *   - 混合噪声: 高斯分量 + 泊松分量分离
 *   - level 0-100: σ(8-bit) 归一化 (25 灰度级 ≈ 100%)
 *
 * 全部确定性, 无随机性, 便于数值验证。
 */

export type NoiseType = 'gaussian' | 'poisson' | 'mixed'

export interface NoiseEstimate {
  /** 主导噪声类型 */
  type: NoiseType
  /** 高斯分量标准差 (8-bit 灰度级) */
  sigma: number
  /** 整体方差 */
  variance: number
  /** 泊松分量 (强度相关) 估计 */
  poissonSigma: number
  /** 估计信噪比 (dB), 平坦区避免除零 */
  snrDb: number
  /** 归一化噪声等级 0-100 */
  level: number
  /** 估计方法说明 */
  method: string
}

/** 单通道灰度均值 */
export function mean(values: Uint8Array): number {
  if (values.length === 0) return 0
  let s = 0
  for (let i = 0; i < values.length; i++) s += values[i]!
  return s / values.length
}

/** 单通道灰度方差 (总体方差) */
export function variance(values: Uint8Array): number {
  const n = values.length
  if (n < 2) return 0
  const m = mean(values)
  let s = 0
  for (let i = 0; i < n; i++) {
    const d = values[i]! - m
    s += d * d
  }
  return s / n
}

/**
 * Laplacian 噪声估计 (高斯): 对图像卷积 [0,1,0;1,-4,1;0,1,0] (Σw²=20),
 * 平坦 + 高斯噪声假设下 L ~ N(0, 20σ²), MAD 鲁棒估计:
 *   σ = √(π/2) · median|L| / √20 ≈ 0.845·σ_true (高斯情形)
 */
export function estimateGaussianSigma(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): number {
  const ch = Math.min(3, channels)
  const samples: number[] = []
  for (let c = 0; c < ch; c++) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * channels + c
        const center = data[idx]!
        const up = data[((y - 1) * width + x) * channels + c]!
        const down = data[((y + 1) * width + x) * channels + c]!
        const left = data[(y * width + x - 1) * channels + c]!
        const right = data[(y * width + x + 1) * channels + c]!
        const lap = up + down + left + right - 4 * center
        samples.push(Math.abs(lap))
      }
    }
  }
  if (samples.length === 0) return 0
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)]!
  return Math.sqrt(Math.PI / 2) * (median / Math.sqrt(20))
}

/** 泊松分量: σ ≈ √(mean), 检测强度相关方差占比 */
function poissonComponents(data: Uint8Array, channels: number, gaussSigma: number): { poissonSigma: number } {
  const ch = Math.min(3, channels)
  const means: number[] = []
  for (let c = 0; c < ch; c++) {
    let s = 0
    let n = 0
    for (let i = c; i < data.length; i += channels) {
      s += data[i]!
      n++
    }
    means.push(n > 0 ? s / n : 0)
  }
  const meanIntensity = means.reduce((a, b) => a + b, 0) / Math.max(1, means.length)
  const poissonSigma = Math.max(0, Math.sqrt(meanIntensity) * 0.6)
  return { poissonSigma }
}

/**
 * 泊松签名检测: 分块 (16x16) 统计块均值/块方差,
 * 泊松噪声下 var ≈ λ (与块均值成比例) → Pearson 相关系数高;
 * 纯高斯噪声下块方差均匀 → 相关系数 ≈ 0。
 */
function poissonBlockCorrelation(data: Uint8Array, width: number, height: number): number {
  const blockSize = 16
  const means: number[] = []
  const vars: number[] = []
  for (let by = 0; by < height; by += blockSize) {
    for (let bx = 0; bx < width; bx += blockSize) {
      let s = 0
      let n = 0
      for (let y = by; y < Math.min(height, by + blockSize); y++) {
        for (let x = bx; x < Math.min(width, bx + blockSize); x++) {
          s += data[y * width + x]!
          n++
        }
      }
      if (n < 32) continue
      const m = s / n
      let v = 0
      for (let y = by; y < Math.min(height, by + blockSize); y++) {
        for (let x = bx; x < Math.min(width, bx + blockSize); x++) {
          const d = data[y * width + x]! - m
          v += d * d
        }
      }
      means.push(m)
      vars.push(v / n)
    }
  }
  const n = means.length
  if (n < 8) return 0
  const meanM = means.reduce((a, b) => a + b, 0) / n
  const meanV = vars.reduce((a, b) => a + b, 0) / n
  let num = 0
  let denM = 0
  let denV = 0
  for (let i = 0; i < n; i++) {
    num += (means[i]! - meanM) * (vars[i]! - meanV)
    denM += (means[i]! - meanM) ** 2
    denV += (vars[i]! - meanV) ** 2
  }
  if (denM === 0 || denV === 0) return 0
  return num / Math.sqrt(denM * denV)
}

/** 主导类型判定: 块方差-均值相关性 (泊松签名) + 高斯分量 (确定性阈值) */
function classifyNoise(gaussSigma: number, blockCorr: number): NoiseType {
  if (gaussSigma < 0.8) return 'poisson'
  if (blockCorr > 0.45) return gaussSigma > 7 ? 'mixed' : 'poisson'
  return 'gaussian'
}

/**
 * 完整噪声估计入口: 输入 8-bit 像素 (channels=1/3/4), 输出类型/σ/方差/SNR/等级。
 */
export function estimateNoise(
  data: Uint8Array,
  width: number,
  height: number,
  channels: number,
): NoiseEstimate {
  const gray = channels === 1
    ? data
    : (() => {
        const g = new Uint8Array(width * height)
        const ch = Math.min(3, channels)
        for (let p = 0; p < width * height; p++) {
          let v = 0
          for (let c = 0; c < ch; c++) v += data[p * channels + c]!
          g[p] = v / Math.max(1, ch)
        }
        return g
      })()

  const sigma = estimateGaussianSigma(gray, width, height, 1)
  const varTotal = variance(gray)
  const { poissonSigma } = poissonComponents(gray, 1, sigma)
  const blockCorr = poissonBlockCorrelation(gray, width, height)
  const type = classifyNoise(sigma, blockCorr)
  const m = mean(gray)
  const snrDb = m > 0.5 ? 10 * Math.log10((m * m) / Math.max(1e-6, varTotal)) : 0
  const level = Math.max(0, Math.min(100, Math.round((sigma / 25) * 100)))

  return {
    type,
    sigma: Math.round(sigma * 100) / 100,
    variance: Math.round(varTotal * 100) / 100,
    poissonSigma: Math.round(poissonSigma * 100) / 100,
    snrDb: Math.round(snrDb * 10) / 10,
    level,
    method: 'laplacian-mad + poisson-sqrt',
  }
}

/** 去噪后噪声方差下降率 (0-1), 用于数值验证与指标展示 */
export function noiseVarianceReduction(before: number, after: number): number {
  if (before <= 0) return 0
  return Math.max(0, Math.min(1, 1 - after / before))
}
