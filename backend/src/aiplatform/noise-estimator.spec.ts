/**
 * [G005 v3.0.6.11-101 Wave 1B (G-10)] 噪声等级估计器 spec
 * - 纯高斯噪声: 类型= gaussian, σ 估计接近注入值 (±40%)
 * - 泊松噪声 (梯度底图): 类型= poisson (块方差∝均值签名)
 * - 混合: 类型= mixed
 * - level 归一化 0-100, 确定性
 */
import {
  estimateGaussianSigma,
  estimateNoise,
  noiseVarianceReduction,
  variance,
} from './noise-estimator'
import { mulberry32 } from './denoise-processor'

/** 注入高斯噪声 (σ), 确定性种子 */
function addGaussianNoise(clean: Uint8Array, sigma: number, seed: number): Uint8Array {
  const rand = mulberry32(seed)
  const out = new Uint8Array(clean.length)
  for (let i = 0; i < clean.length; i++) {
    const u1 = Math.max(1e-9, rand())
    const u2 = rand()
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
    out[i] = Math.max(0, Math.min(255, Math.round(clean[i]! + z * sigma)))
  }
  return out
}

/** 线性梯度底图 (20..220): 泊松噪声需要强度变化才能检测 var∝mean 签名 */
function gradientBase(width: number, height: number, lo = 20, hi = 220): Uint8Array {
  const out = new Uint8Array(width * height)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      out[y * width + x] = Math.round(lo + ((x + y) / (width + height - 2)) * (hi - lo))
    }
  }
  return out
}

/** 泊松噪声: σ≈√λ 的确定性采样 */
function addPoissonNoise(base: Uint8Array, seed: number): Uint8Array {
  const rand = mulberry32(seed)
  const out = new Uint8Array(base.length)
  for (let i = 0; i < base.length; i++) {
    const u = rand()
    const n = Math.max(0, Math.round(base[i]! + Math.sqrt(base[i]!) * (u - 0.5) * 2))
    out[i] = Math.max(0, Math.min(255, n))
  }
  return out
}

const flat = new Uint8Array(128 * 128).fill(128)
const gradient = gradientBase(128, 128)

describe('noise-estimator', () => {
  it('纯高斯噪声: 类型 gaussian, σ 估计接近注入值 (±40%)', () => {
    const sigmaIn = 12
    const noisy = addGaussianNoise(flat, sigmaIn, 42)
    const est = estimateNoise(noisy, 128, 128, 1)
    expect(est.type).toBe('gaussian')
    expect(est.sigma).toBeGreaterThan(sigmaIn * 0.6)
    expect(est.sigma).toBeLessThan(sigmaIn * 1.4)
    expect(est.sigma).toBeGreaterThan(5)
  })

  it('高噪声 (σ=25): level 高但 ≤ 100', () => {
    const noisy = addGaussianNoise(flat, 25, 7)
    const est = estimateNoise(noisy, 128, 128, 1)
    expect(est.type).toBe('gaussian')
    expect(est.level).toBeGreaterThan(50)
    expect(est.level).toBeLessThanOrEqual(100)
  })

  it('低噪声平坦图: σ 小, level 低', () => {
    const noisy = addGaussianNoise(flat, 1.5, 3)
    const est = estimateNoise(noisy, 128, 128, 1)
    expect(est.sigma).toBeLessThan(4)
    expect(est.level).toBeLessThan(20)
  })

  it('泊松噪声 (梯度底图): 类型 poisson, poissonSigma > 0', () => {
    const noisy = addPoissonNoise(gradient, 5)
    const est = estimateNoise(noisy, 128, 128, 1)
    expect(est.type).toBe('poisson')
    expect(est.poissonSigma).toBeGreaterThan(0)
    expect(est.sigma).toBeGreaterThan(0)
  })

  it('混合噪声 (泊松 + 高斯): 类型 mixed', () => {
    const poisson = addPoissonNoise(gradient, 9)
    const mixed = addGaussianNoise(poisson, 8, 11)
    const est = estimateNoise(mixed, 128, 128, 1)
    expect(est.type).toBe('mixed')
    expect(est.sigma).toBeGreaterThan(4)
    expect(est.variance).toBeGreaterThan(0)
    expect(Number.isFinite(est.snrDb)).toBe(true)
  })

  it('确定性: 同输入两次结果一致', () => {
    const noisy = addGaussianNoise(flat, 10, 1)
    const a = estimateNoise(noisy, 128, 128, 1)
    const b = estimateNoise(noisy, 128, 128, 1)
    expect(a).toEqual(b)
  })

  it('estimateGaussianSigma 与真实 σ 一致 (平坦 + 高斯, ±40%)', () => {
    const noisy = addGaussianNoise(flat, 8, 2)
    const s1 = estimateGaussianSigma(noisy, 128, 128, 1)
    expect(s1).toBeGreaterThan(8 * 0.6)
    expect(s1).toBeLessThan(8 * 1.4)
    const varEst = variance(noisy)
    expect(s1).toBeLessThan(Math.sqrt(varEst) * 1.5)
  })

  it('noiseVarianceReduction: 方差减半 → 0.5, 无噪声 → 0', () => {
    expect(noiseVarianceReduction(100, 50)).toBeCloseTo(0.5, 5)
    expect(noiseVarianceReduction(0, 0)).toBe(0)
    expect(noiseVarianceReduction(100, 120)).toBe(0)
    expect(noiseVarianceReduction(100, 0)).toBe(1)
  })
})
