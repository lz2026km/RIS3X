/**
 * [G005 v3.0.6.11-90 Wave 4B (G-10)] DL 降噪确定性处理 spec
 * - PNG 编解码 roundtrip
 * - 中值滤波去噪效果 (PSNR 提升)
 * - 合成帧确定性 (同种子 → 同结果)
 * - AiPlatformService.denoiseImage: 真实图路径 / 合成回退路径 / 指标范围 / 审计不阻断
 */
import { AiPlatformService } from './aiplatform.service'
import {
  decodePng,
  encodePng,
  hashString,
  medianFilter,
  psnr,
  ssim,
  syntheticFrame,
} from './denoise-processor'

const makePrisma = () =>
  ({
    auditLog: { create: jest.fn() },
  }) as never

describe('denoise-processor PNG 编解码', () => {
  it('encode → decode 灰度 roundtrip 保真', () => {
    const w = 16
    const h = 12
    const gray = new Uint8Array(w * h)
    for (let i = 0; i < gray.length; i++) gray[i] = (i * 7) % 256
    const png = encodePng(w, h, gray, 1)
    expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
    const decoded = decodePng(png)!
    expect(decoded.width).toBe(w)
    expect(decoded.height).toBe(h)
    expect(decoded.channels).toBe(1)
    expect([...decoded.data]).toEqual([...gray])
  })

  it('encode → decode RGB roundtrip 保真', () => {
    const w = 8
    const h = 8
    const rgb = new Uint8Array(w * h * 3)
    for (let i = 0; i < rgb.length; i++) rgb[i] = (i * 11) % 256
    const decoded = decodePng(encodePng(w, h, rgb, 3))!
    expect(decoded.channels).toBe(3)
    expect([...decoded.data]).toEqual([...rgb])
  })

  it('非法输入返回 null (非 PNG / 截断)', () => {
    expect(decodePng(Buffer.from('not-a-png'))).toBeNull()
    expect(decodePng(Buffer.alloc(0))).toBeNull()
  })
})

describe('denoise-processor 滤波与指标', () => {
  it('中值滤波降低 MSE (PSNR 提升)', () => {
    const { noisy, clean } = syntheticFrame(42, 60)
    const filtered = medianFilter(noisy, 256, 256, 1)
    expect(psnr(filtered, clean)).toBeGreaterThan(psnr(noisy, clean))
    expect(ssim(filtered, clean)).toBeGreaterThan(ssim(noisy, clean))
  })

  it('完全相同图像 PSNR=100 / SSIM 接近 1', () => {
    const a = new Uint8Array(64).fill(128)
    expect(psnr(a, a)).toBe(100)
    expect(ssim(a, a)).toBeGreaterThan(0.99)
  })

  it('合成帧确定性: 同种子同强度 → 逐字节一致', () => {
    const f1 = syntheticFrame(7, 50)
    const f2 = syntheticFrame(7, 50)
    expect([...f1.noisy]).toEqual([...f2.noisy])
    expect([...f1.clean]).toEqual([...f2.clean])
    const f3 = syntheticFrame(8, 50)
    expect([...f3.noisy]).not.toEqual([...f1.noisy])
    expect(hashString('abc')).toBe(hashString('abc'))
  })
})

describe('AiPlatformService.denoiseImage (G-10)', () => {
  const svc = new AiPlatformService(makePrisma())

  it('无图 → 合成回退: 指标在合理范围且确定性', async () => {
    const r1 = await svc.denoiseImage({ strength: 50, modelId: 'unet' })
    const d1 = r1.data as any
    expect(d1.source).toBe('synthetic')
    expect(d1.algorithm).toBe('synthetic-phantom')
    expect(d1.width).toBe(256)
    expect(d1.height).toBe(256)
    expect(d1.psnr).toBeGreaterThan(10)
    expect(d1.psnr).toBeLessThan(80)
    expect(d1.ssim).toBeGreaterThan(0.3)
    expect(d1.ssim).toBeLessThan(1)
    expect(d1.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(d1.denoisedBase64).toContain('iVBORw0KGgo')
    const r2 = await svc.denoiseImage({ strength: 50, modelId: 'unet' })
    expect((r2.data as any).psnr).toBe(d1.psnr)
    expect((r2.data as any).ssim).toBe(d1.ssim)
  })

  it('studyId 种子化: 同 studyId 结果一致, 不同 studyId 结果不同', async () => {
    const a = await svc.denoiseImage({ studyId: 'EX-100', strength: 40 })
    const b = await svc.denoiseImage({ studyId: 'EX-100', strength: 40 })
    const c = await svc.denoiseImage({ studyId: 'EX-200', strength: 40 })
    expect((a.data as any).psnr).toBe((b.data as any).psnr)
    expect((a.data as any).denoisedBase64).toBe((b.data as any).denoisedBase64)
    expect((c.data as any).denoisedBase64).not.toBe((a.data as any).denoisedBase64)
  })

  it('真实 PNG 图 → median 路径: 输出可解码, 尺寸一致, source=backend', async () => {
    const { noisy } = syntheticFrame(1, 30)
    const png = encodePng(256, 256, noisy, 1).toString('base64')
    const r = await svc.denoiseImage({ imageBase64: png, strength: 30, modelId: 'cnn' })
    const d = r.data as any
    expect(d.source).toBe('backend')
    expect(d.algorithm).toBe('median-3x3')
    expect(d.width).toBe(256)
    expect(d.height).toBe(256)
    const decoded = decodePng(Buffer.from(d.denoisedBase64, 'base64'))!
    expect(decoded.width).toBe(256)
    expect(decoded.height).toBe(256)
    expect(d.psnr).toBeGreaterThan(15)
    expect(d.psnr).toBeLessThan(60)
    expect(d.ssim).toBeGreaterThan(0.5)
  })

  it('strength 边界钳制 (负数/超 100)', async () => {
    const lo = await svc.denoiseImage({ strength: -10 })
    const hi = await svc.denoiseImage({ strength: 999 })
    expect(Number.isFinite((lo.data as any).psnr)).toBe(true)
    expect(Number.isFinite((hi.data as any).psnr)).toBe(true)
    expect((hi.data as any).strength).toBe(100)
    expect((lo.data as any).strength).toBe(0)
  })
})
