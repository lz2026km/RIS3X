import { CadRadsService } from '../src/modules/cad/cad-rads.service'

describe('CadRadsService', () => {
  let svc: CadRadsService

  beforeEach(() => {
    svc = new CadRadsService()
  })

  it('scoreLung maps nodule size to Lung-RADS score', () => {
    expect(svc.scoreLung({ noduleSizeMm: 3 }).score).toBe('2')
    expect(svc.scoreLung({ noduleSizeMm: 7 }).score).toBe('3')
    expect(svc.scoreLung({ noduleSizeMm: 10 }).score).toBe('4A')
    expect(svc.scoreLung({ noduleSizeMm: 20 }).score).toBe('4B')
  })

  it('scoreLung escalates to 4X for spiculated margins >= 8mm', () => {
    const r = svc.scoreLung({ noduleSizeMm: 9, spiculatedMargin: true })
    expect(r.score).toBe('4X')
    expect(r.category).toBe('Lung-RADS 4X')
  })

  it('scoreLung randomizes size when missing', () => {
    const r = svc.scoreLung({})
    expect(r.score).toMatch(/^[1-4][AB]?$|^[2-4]$/)
  })

  it('scoreBreast returns provided BI-RADS category', () => {
    const r = svc.scoreBreast({ biradsCategory: '4C' })
    expect(r.score).toBe('4C')
    expect(r.category).toBe('BI-RADS 4C')
    expect(r.recommendations).toContain('活检')
  })

  it('scoreBreast randomizes category when missing', () => {
    const r = svc.scoreBreast({})
    expect(r.score).toMatch(/^[0-6]([ABC])?$/)
  })

  describe('PI-RADS (deterministic)', () => {
    it('PZ lesion with high DWI and small size is 4', () => {
      const r = svc.scoreProstate({ lesionZone: 'PZ', dwiSignal: 'high', lesionSizeMm: 8 })
      expect(r.score).toBe('4')
      expect(r.category).toContain('PI-RADS')
    })

    it('PZ lesion with high DWI + size >= 15 is 5', () => {
      const r = svc.scoreProstate({ lesionZone: 'PZ', dwiSignal: 'high', lesionSizeMm: 16 })
      expect(r.score).toBe('5')
    })

    it('PZ lesion with high DWI + low ADC is 5', () => {
      const r = svc.scoreProstate({ lesionZone: 'PZ', dwiSignal: 'high', adcValue: 600 })
      expect(r.score).toBe('5')
    })

    it('PZ lesion with mild DWI is 3', () => {
      const r = svc.scoreProstate({ lesionZone: 'PZ', dwiSignal: 'mild' })
      expect(r.score).toBe('3')
    })

    it('TZ lesion with low T2 and size >= 15 is 5', () => {
      const r = svc.scoreProstate({ lesionZone: 'TZ', t2Signal: 'low', lesionSizeMm: 20 })
      expect(r.score).toBe('5')
    })

    it('TZ lesion with mild T2 is 3', () => {
      const r = svc.scoreProstate({ lesionZone: 'TZ', t2Signal: 'mild' })
      expect(r.score).toBe('3')
    })

    it('AFS lesion is never below 3', () => {
      const r = svc.scoreProstate({ lesionZone: 'AFS' })
      expect(['3', '4', '5']).toContain(r.score)
    })

    it('returns score in 1-5 for empty input', () => {
      const r = svc.scoreProstate({})
      expect(r.score).toMatch(/^[1-5]$/)
      expect(r.category).toContain('PI-RADS')
    })
  })

  describe('LI-RADS (deterministic)', () => {
    it('classic HCC: >=20mm nonrim + washout + capsule -> LR-5', () => {
      const r = svc.scoreLiver({ sizeMm: 25, arterialPhaseEnhancement: 'nonrim', washout: 'yes', enhancingCapsule: 'yes' })
      expect(r.score).toBe('LR-5')
      expect(r.category).toBe('LI-RADS LR-5')
    })

    it('10-19mm nonrim + washout (no capsule) -> LR-4', () => {
      const r = svc.scoreLiver({ sizeMm: 12, arterialPhaseEnhancement: 'nonrim', washout: 'yes' })
      expect(r.score).toBe('LR-4')
    })

    it('10-19mm nonrim + washout + capsule -> LR-5', () => {
      const r = svc.scoreLiver({ sizeMm: 12, arterialPhaseEnhancement: 'nonrim', washout: 'yes', enhancingCapsule: 'yes' })
      expect(r.score).toBe('LR-5')
    })

    it('single high-risk feature -> LR-3', () => {
      const r = svc.scoreLiver({ sizeMm: 15, arterialPhaseEnhancement: 'nonrim' })
      expect(r.score).toBe('LR-3')
    })

    it('rim enhancement >= 10mm -> LR-M', () => {
      const r = svc.scoreLiver({ sizeMm: 30, arterialPhaseEnhancement: 'rim' })
      expect(r.score).toBe('LR-M')
    })

    it('tumor in vein -> LR-TIV', () => {
      const r = svc.scoreLiver({ sizeMm: 20, tumorInVein: 'yes' })
      expect(r.score).toBe('LR-TIV')
    })

    it('cystic non-enhancing -> LR-1', () => {
      const r = svc.scoreLiver({ observationType: 'cystic', arterialPhaseEnhancement: 'none' })
      expect(r.score).toBe('LR-1')
    })
  })

  describe('TI-RADS (deterministic)', () => {
    it('pure cystic is TR1', () => {
      const r = svc.scoreThyroid({ composition: 'cystic' })
      expect(r.score).toBe('TR1')
      expect(r.category).toBe('TI-RADS TR1')
    })

    it('solid hypoechoic taller-than-wide with punctate foci is TR5', () => {
      const r = svc.scoreThyroid({ composition: 'solid', echogenicity: 'hypo', shape: 'taller-than-wide', margins: 'irregular', echogenicFoci: 'punctate' })
      expect(r.score).toBe('TR5')
      expect(r.findings.some((f) => f.includes('计分'))).toBe(true)
    })

    it('mixed isoechoic smooth is TR2', () => {
      const r = svc.scoreThyroid({ composition: 'mixed', echogenicity: 'iso', shape: 'wider-than-tall', margins: 'smooth', echogenicFoci: 'none' })
      expect(r.score).toBe('TR2')
    })

    it('lobulated margins push to TR4', () => {
      const r = svc.scoreThyroid({ composition: 'solid', echogenicity: 'iso', margins: 'lobulated' })
      expect(r.score).toBe('TR4')
    })

    it('spongiform is TR1 regardless of other fields', () => {
      const r = svc.scoreThyroid({ composition: 'spongiform', echogenicFoci: 'punctate' })
      expect(r.score).toBe('TR1')
    })
  })

  it('getHistory generates and reuses history per patient', () => {
    const first = svc.getHistory('P1')
    expect(first).toHaveLength(6)
    expect(svc.getHistory('P1')).toBe(first)
    const other = svc.getHistory('P2')
    expect(other).not.toBe(first)
  })
})
