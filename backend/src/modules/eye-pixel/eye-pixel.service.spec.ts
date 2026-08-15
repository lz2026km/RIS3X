import { BadRequestException, NotFoundException } from '@nestjs/common'
import { EyePixelService } from './eye-pixel.service'

/**
 * [G005 Wave 4B] 影像像素实验室 — EyePixelPage 依赖端点单测
 * 覆盖: instance / histogram (确定性) / colormap 8 种 / sharpness / mpr / detect-artifact
 */

describe('EyePixelService [G005 Wave 4B] 影像像素实验室', () => {
  const svc = new EyePixelService()

  it('getInstance: 返回 DICOM 实例元数据, 同 instanceId 确定性 modality', () => {
    const a = svc.getInstance('frame-1')
    expect(a.instanceId).toBe('frame-1')
    expect(a.rows).toBe(512)
    expect(a.columns).toBe(512)
    expect(a.bitsAllocated).toBe(16)
    expect(a.pixelDataRef).toContain('/eye/pixel/instance/frame-1/raw')
    const b = svc.getInstance('frame-1')
    expect(a.modality).toBe(b.modality)
  })

  it('getInstance: 空 instanceId 抛 BadRequest', () => {
    expect(() => svc.getInstance('')).toThrow(BadRequestException)
  })

  it('getHistogram: 256 bins + 统计量, 同 instanceId 两次结果一致 (确定性)', () => {
    const h1 = svc.getHistogram('frame-1')
    const h2 = svc.getHistogram('frame-1')
    expect(h1.bins.length).toBe(256)
    expect(h1.bins[0]).toHaveProperty('intensity')
    expect(h1.bins[0]).toHaveProperty('count')
    expect(h1.mean).toBeGreaterThan(0)
    expect(h1.stdDev).toBeGreaterThan(0)
    expect(h1.min).toBeLessThanOrEqual(h1.median)
    expect(h1.max).toBeGreaterThanOrEqual(h1.median)
    expect(h1.mean).toBe(h2.mean)
    expect(h1.bins[100].count).toBe(h2.bins[100].count)
  })

  it('getHistogram: frame 参数改变直方图 (确定性漂移)', () => {
    const h0 = svc.getHistogram('frame-1', 0)
    const h1 = svc.getHistogram('frame-1', 3)
    expect(h0.mean).not.toBe(h1.mean)
    const again = svc.getHistogram('frame-1', 3)
    expect(again.mean).toBe(h1.mean)
  })

  it('listColormaps: 8 种伪彩映射, 每种带 256 色 LUT', () => {
    const maps = svc.listColormaps()
    expect(maps.length).toBe(8)
    for (const m of maps) {
      expect(m.id).toBeTruthy()
      expect(m.name).toBeTruthy()
      expect(m.lut.length).toBe(256)
      expect(m.lut[0].length).toBe(3)
      for (const c of m.lut) {
        expect(c[0]).toBeGreaterThanOrEqual(0)
        expect(c[0]).toBeLessThanOrEqual(255)
        expect(c[1]).toBeGreaterThanOrEqual(0)
        expect(c[1]).toBeLessThanOrEqual(255)
        expect(c[2]).toBeGreaterThanOrEqual(0)
        expect(c[2]).toBeLessThanOrEqual(255)
      }
    }
  })

  it('getColormap: 未知 modality 抛 NotFound', () => {
    expect(() => svc.getColormap('unknown')).toThrow(NotFoundException)
  })

  it('analyzeSharpness: 评分/等级/通过标记, 同输入确定', () => {
    const s1 = svc.analyzeSharpness({ instanceId: 'frame-1' }) as any
    const s2 = svc.analyzeSharpness({ instanceId: 'frame-1' }) as any
    expect(s1.sharpness.overall).toBeGreaterThan(0)
    expect(s1.sharpness.overall).toBeLessThanOrEqual(99.5)
    expect(s1.grade).toMatch(/[ABC]/)
    expect(typeof s1.passed).toBe('boolean')
    expect(s1.measuredAt).toBeTruthy()
    expect(s1.sharpness.overall).toBe(s2.sharpness.overall)
  })

  it('analyzeSharpness: 空 instanceId 抛 BadRequest', () => {
    expect(() => svc.analyzeSharpness({ instanceId: '' })).toThrow(BadRequestException)
  })

  it('createMpr: 返回重建元数据 (轴/切片数/分辨率)', () => {
    const m = svc.createMpr({ studyId: 'STU-DEMO-001', axis: 'sagittal', seriesIds: ['frame-1', 'frame-2'] })
    expect(m.mprId).toMatch(/^MPR-/)
    expect(m.studyId).toBe('STU-DEMO-001')
    expect(m.axis).toBe('sagittal')
    expect(m.sliceCount).toBe(2)
    expect(m.resolution).toBe('512x512')
  })

  it('detectArtifact: 伪影列表/质量分/建议, 同输入确定', () => {
    const a1 = svc.detectArtifact({ instanceId: 'frame-1' }) as any
    const a2 = svc.detectArtifact({ instanceId: 'frame-1' }) as any
    expect(a1.artifacts.length).toBeGreaterThan(0)
    expect(a1.artifacts[0].type).toBeTruthy()
    expect(a1.artifacts[0].severity).toBeGreaterThanOrEqual(0)
    expect(a1.qualityScore).toBeGreaterThan(0)
    expect(Array.isArray(a1.recommendations)).toBe(true)
    expect(a1.detectedAt).toBeTruthy()
    expect(a1.qualityScore).toBe(a2.qualityScore)
  })
})
