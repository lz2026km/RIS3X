/**
 * [G005 v3.0.6.11-101 Wave 1B (G-10)] 降噪管线数值正确性 spec
 * - 各核 (median/gaussian/bilateral/nlmeans/dl) 均显著降低噪声水平 (Laplacian-σ)
 * - 预处理/后处理 roundtrip 保真
 * - 3 档预设强度单调
 * - 确定性: 同输入同输出
 */
import {
  applyKernel,
  bilateralFilter,
  gaussianFilter,
  nlmeansFilter,
  postprocess,
  preprocess,
  presetForStrength,
  runDenoisePipeline,
  STRENGTH_PRESETS,
  varianceOf,
  type DenoiseKernel,
} from './denoise-pipeline'
import { syntheticFrame } from './denoise-processor'
import { mockBackend } from './model-loader'
import { estimateGaussianSigma, estimateNoise } from './noise-estimator'

/** 确定性噪声图 (256x256, syntheticFrame(seed=99, noise=40)) */
function makeNoisy(): Uint8Array {
  return syntheticFrame(99, 40).noisy
}

describe('denoise-pipeline 预处理/后处理', () => {
  it('preprocess 归一化到 [0,1], postprocess 反归一化恢复 0-255', () => {
    const w = 16
    const h = 16
    const raw = new Uint8Array(w * h)
    for (let i = 0; i < raw.length; i++) raw[i] = (i * 17) % 256
    const norm = preprocess(raw, w, h, 1)
    expect(norm.length).toBe(w * h)
    for (const v of norm) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    const back = postprocess(norm, w, h, 1)
    expect([...back]).toEqual([...raw])
  })

  it('preprocess 多通道取均值后反归一化保持灰度', () => {
    const w = 8
    const h = 8
    const rgb = new Uint8Array(w * h * 3).fill(100)
    const norm = preprocess(rgb, w, h, 3)
    expect(norm[0]).toBeCloseTo(100 / 255, 5)
    const out = postprocess(norm, w, h, 3)
    expect(out[0]).toBe(100)
    expect(out[1]).toBe(100)
    expect(out[2]).toBe(100)
  })
})

describe('denoise-pipeline 各核数值正确性 (噪声方差下降)', () => {
  const noisy = makeNoisy()
  const sigmaBefore = estimateGaussianSigma(noisy, 256, 256, 1)

  it('输入确实含噪声 (σ 估计 > 5)', () => {
    expect(sigmaBefore).toBeGreaterThan(5)
  })

  const kernels: DenoiseKernel[] = ['median', 'gaussian', 'bilateral', 'nlmeans']
  for (const kernel of kernels) {
    it(`${kernel} 核: 去噪后噪声 σ 显著下降且尺寸不变`, () => {
      const res = applyKernel(kernel, noisy, 256, 256, 1, 50, 1)
      const sigmaAfter = estimateGaussianSigma(res.denoised, 256, 256, 1)
      expect(sigmaAfter).toBeLessThan(sigmaBefore * 0.8)
      expect(res.denoised.length).toBe(noisy.length)
    })
  }

  it('DL 模型接口 (mock 后端): 管线完整且噪声方差下降', async () => {
    const out = await runDenoisePipeline({
      data: noisy,
      width: 256,
      height: 256,
      channels: 1,
      kernel: 'dl',
      strength: 50,
      modelId: 'unet',
      backend: mockBackend('unet'),
    })
    expect(out.kernel).toBe('dl')
    expect(out.backendProvider).toContain('deterministic-mock')
    expect(out.denoised.length).toBe(noisy.length)
    expect(out.noiseReduction).toBeGreaterThan(0)
    expect(out.varianceAfter).toBeLessThan(out.varianceBefore)
    expect(out.passes).toBeGreaterThanOrEqual(1)
  })

  it('管线确定性: 同输入两次结果逐字节一致', async () => {
    const input = { data: noisy, width: 256, height: 256, channels: 1, kernel: 'gaussian' as DenoiseKernel, strength: 60 }
    const a = await runDenoisePipeline(input)
    const b = await runDenoisePipeline(input)
    expect([...a.denoised]).toEqual([...b.denoised])
  })

  it('3 档预设: strong 的降噪 >= standard >= light', async () => {
    const [light, standard, strong] = await Promise.all(
      (['light', 'standard', 'strong'] as const).map((preset) =>
        runDenoisePipeline({
          data: noisy,
          width: 256,
          height: 256,
          channels: 1,
          kernel: 'gaussian',
          strength: STRENGTH_PRESETS[preset]!.strength,
          passes: STRENGTH_PRESETS[preset]!.passes,
        }),
      ),
    )
    expect(strong!.noiseReduction).toBeGreaterThanOrEqual(standard!.noiseReduction)
    expect(standard!.noiseReduction).toBeGreaterThanOrEqual(light!.noiseReduction)
    expect(light!.noiseReduction).toBeGreaterThan(0)
  })

  it('presetForStrength 映射与预设档位定义正确', () => {
    expect(presetForStrength(10)).toBe('light')
    expect(presetForStrength(50)).toBe('standard')
    expect(presetForStrength(90)).toBe('strong')
    expect(STRENGTH_PRESETS.light.strength).toBe(30)
    expect(STRENGTH_PRESETS.strong.strength).toBe(75)
    expect(STRENGTH_PRESETS.light.passes).toBe(1)
    expect(STRENGTH_PRESETS.strong.passes).toBe(2)
  })
})

describe('denoise-pipeline 独立核函数', () => {
  it('gaussianFilter: 噪声 σ 大幅下降', () => {
    const { noisy } = syntheticFrame(3, 50)
    const before = estimateGaussianSigma(noisy, 256, 256, 1)
    const out = gaussianFilter(noisy, 256, 256, 1, 3, 1.8)
    expect(estimateGaussianSigma(out, 256, 256, 1)).toBeLessThan(before * 0.5)
  })

  it('bilateralFilter: 降噪且输出在有效灰度范围', () => {
    const { noisy } = syntheticFrame(3, 50)
    const before = estimateGaussianSigma(noisy, 256, 256, 1)
    const out = bilateralFilter(noisy, 256, 256, 1, 2, 2.5, 40)
    expect(estimateGaussianSigma(out, 256, 256, 1)).toBeLessThan(before * 0.8)
    for (let i = 0; i < out.length; i += 4096) {
      expect(out[i]!).toBeGreaterThanOrEqual(0)
      expect(out[i]!).toBeLessThanOrEqual(255)
    }
  })

  it('nlmeansFilter: 确定性 + 噪声 σ 下降', () => {
    const { noisy } = syntheticFrame(3, 50)
    const before = estimateGaussianSigma(noisy, 256, 256, 1)
    const a = nlmeansFilter(noisy, 256, 256, 1, 3, 1, 18)
    const b = nlmeansFilter(noisy, 256, 256, 1, 3, 1, 18)
    expect([...a]).toEqual([...b])
    expect(estimateGaussianSigma(a, 256, 256, 1)).toBeLessThan(before * 0.6)
  })

  it('varianceOf 基础指标: 噪声图方差为正', () => {
    const { noisy } = syntheticFrame(3, 50)
    expect(varianceOf(noisy)).toBeGreaterThan(0)
    expect(estimateNoise(noisy, 256, 256, 1).variance).toBeGreaterThan(0)
  })
})
