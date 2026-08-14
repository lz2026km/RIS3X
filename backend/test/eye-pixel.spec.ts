/**
 * [G005 Wave 10A] 眼科像素级图像处理服务 spec
 * /eye/pixel/*: histogram (确定性) / colormap (8 种) / instance / sharpness / mpr / artifact
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { EyePixelService } from '../src/modules/eye-pixel/eye-pixel.service'

describe('EyePixelService', () => {
  let svc: EyePixelService

  beforeEach(() => {
    svc = new EyePixelService()
  })

  describe('直方图 / histogram', () => {
    it('returns 256 bins with deterministic values for same instanceId', () => {
      const h1 = svc.getHistogram('frame-1')
      const h2 = svc.getHistogram('frame-1')
      expect(h1.bins).toHaveLength(256)
      expect(h1.bins[0]).toMatchObject({ intensity: 0 })
      expect(h1.bins[255].intensity).toBe(255)
      expect(h1.instanceId).toBe('frame-1')
      expect(h1.mean).toBe(h2.mean)
      expect(h1.stdDev).toBe(h2.stdDev)
      expect(JSON.stringify(h1.bins)).toBe(JSON.stringify(h2.bins))
      expect(h1.totalPixels).toBeGreaterThan(0)
    })

    it('derives different statistics for different instances', () => {
      const h1 = svc.getHistogram('frame-1')
      const h2 = svc.getHistogram('frame-2')
      expect(h1.mean).not.toBe(h2.mean)
      expect(h1.mode).not.toBe(h2.mode)
    })

    it('keeps percentile ordering and sane ranges', () => {
      const h = svc.getHistogram('frame-10')
      expect(h.p25).toBeLessThanOrEqual(h.median)
      expect(h.median).toBeLessThanOrEqual(h.p75)
      expect(h.min).toBeLessThanOrEqual(h.p25)
      expect(h.max).toBeGreaterThanOrEqual(h.p75)
      expect(h.skewness).toBeGreaterThan(-10)
      expect(h.kurtosis).toBeGreaterThan(0)
    })

    it('rejects empty instanceId', () => {
      expect(() => svc.getHistogram('')).toThrow(BadRequestException)
    })

    it('supports frame offset shifting distribution', () => {
      const base = svc.getHistogram('frame-5')
      const shifted = svc.getHistogram('frame-5', 3)
      expect(shifted.mean).not.toBe(base.mean)
      expect(shifted.bins).toHaveLength(256)
    })
  })

  describe('伪彩映射 / colormap (8 种)', () => {
    it('returns 8 colormap catalog entries with LUT', () => {
      const all = svc.listColormaps()
      expect(all).toHaveLength(8)
      for (const c of all) {
        expect(c.lut).toHaveLength(256)
        expect(c.lut[0]).toHaveLength(3)
        expect(c.lut[255]).toHaveLength(3)
        expect(c.range[0]).toBeLessThan(c.range[1])
      }
    })

    it('maps each modality to its own colormap definition', () => {
      const ids = ['fundus', 'oct', 'octa', 'ffa', 'visualfield', 'topography', 'icg', 'biometry']
      const names = new Set(svc.listColormaps().map((c) => c.id))
      for (const id of ids) expect(names.has(id)).toBe(true)
      expect(svc.getColormap('oct').type).toBe('GRAY')
      expect(svc.getColormap('octa').type).toBe('JET')
      expect(svc.getColormap('ffa').type).toBe('GRAY_INVERT')
      expect(svc.getColormap('topography').range).toEqual([30, 80])
    })

    it('throws NotFound for unknown modality', () => {
      expect(() => svc.getColormap('unknown-modality')).toThrow(NotFoundException)
    })
  })

  describe('实例元数据 / sharpness / mpr / artifact', () => {
    it('returns deterministic 512x512 instance metadata', () => {
      const info = svc.getInstance('frame-1')
      expect(info.rows).toBe(512)
      expect(info.columns).toBe(512)
      expect(info.bitsAllocated).toBe(16)
      expect(info.size).toBe(512 * 512 * 2)
      expect(info.sopInstanceUID).toContain('1.2.826')
      expect(info.modality).toBeTruthy()
      expect(svc.getInstance('frame-1').modality).toBe(info.modality)
    })

    it('scores sharpness deterministically with grade and pass flag', () => {
      const s = svc.analyzeSharpness({ instanceId: 'frame-1' }) as any
      expect(s.sharpness.laplacian).toBeGreaterThan(0)
      expect(s.sharpness.overall).toBeGreaterThan(0)
      expect(['A (优)', 'B (良)', 'C (合格)']).toContain(s.grade)
      expect(typeof s.passed).toBe('boolean')
      const s2 = svc.analyzeSharpness({ instanceId: 'frame-1' }) as any
      const { measuredAt: _m1, ...rest1 } = s
      const { measuredAt: _m2, ...rest2 } = s2
      expect(JSON.stringify(rest1)).toBe(JSON.stringify(rest2))
      expect(() => svc.analyzeSharpness({ instanceId: '' })).toThrow(BadRequestException)
    })

    it('creates MPR metadata with axis and slice count', () => {
      const m = svc.createMpr({ studyId: 'STU-1', axis: 'sagittal', seriesIds: ['a', 'b', 'c'] })
      expect(m.mprId).toContain('MPR-')
      expect(m.axis).toBe('sagittal')
      expect(m.sliceCount).toBe(3)
      expect(m.resolution).toBe('512x512')
    })

    it('detects artifacts deterministically with quality score', () => {
      const a = svc.detectArtifact({ instanceId: 'frame-1' }) as any
      expect(a.artifacts.length).toBeGreaterThanOrEqual(2)
      expect(a.qualityScore).toBeGreaterThan(0)
      expect(typeof a.passed).toBe('boolean')
      expect(a.recommendations.length).toBeGreaterThan(0)
      expect(() => svc.detectArtifact({ instanceId: '' })).toThrow(BadRequestException)
    })
  })
})
