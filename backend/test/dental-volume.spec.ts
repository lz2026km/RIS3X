/**
 * [G005 Wave 10A] 牙科 CBCT 体绘制 (dental volume) 服务 spec
 * /dental/volume/*: studies / presets / apply / curve-path
 */
import { DentalService } from '../src/dental/dental.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('DentalService — CBCT volume (/dental/volume/*)', () => {
  let svc: DentalService

  beforeEach(() => {
    svc = new DentalService({} as unknown as PrismaService)
  })

  describe('volume studies', () => {
    it('lists deterministic CBCT studies with device/FOV/slices', async () => {
      const res = await svc.listVolumeStudies()
      expect(res.success).toBe(true)
      const studies = res.data as any[]
      expect(studies.length).toBeGreaterThanOrEqual(6)
      const s = studies[0]
      expect(s.id).toMatch(/^CBCT-/)
      expect(s.patientId).toBeTruthy()
      expect(s.patientName).toBeTruthy()
      expect(s.device).toBeTruthy()
      expect(s.fov).toMatch(/cm$/)
      expect(s.slices).toBeGreaterThan(100)
      expect(['processed', 'processing', 'archived']).toContain(s.status)
    })

    it('returns 404 for unknown study and detail for known study', async () => {
      const missing = await svc.getVolumeStudy('CBCT-NOPE')
      expect(missing.success).toBe(false)
      const ok = await svc.getVolumeStudy('CBCT-001')
      expect(ok.success).toBe(true)
      const d = ok.data as any
      expect(d.region).toBeTruthy()
      expect(d.indication).toBeTruthy()
      expect(d.dose.kvp).toBeGreaterThan(0)
      expect(d.operator).toBeTruthy()
    })
  })

  describe('volume presets', () => {
    it('provides 8 dental rendering presets with WW/WC', async () => {
      const res = await svc.listVolumePresets()
      expect(res.success).toBe(true)
      const presets = res.data as any[]
      expect(presets).toHaveLength(8)
      const ids = presets.map((p: any) => p.id)
      for (const expectId of ['bone', 'soft', 'airway', 'nerve', 'implant', 'enamel', 'sinus', 'mpr']) {
        expect(ids).toContain(expectId)
      }
      const bone = presets.find((p: any) => p.id === 'bone')
      expect(bone.ww).toBeGreaterThan(bone.wc)
      expect(bone.transfer).toBeTruthy()
      expect(bone.description).toBeTruthy()
    })

    it('applies a preset via POST and returns applied flag', async () => {
      const res = await svc.applyVolumePreset('nerve')
      expect(res.success).toBe(true)
      const data = res.data as any
      expect(data.applied).toBe(true)
      expect(data.preset.id).toBe('nerve')
      expect(data.appliedAt).toBeTruthy()
    })

    it('rejects unknown preset id', async () => {
      const res = await svc.applyVolumePreset('nope')
      expect(res.success).toBe(false)
    })
  })

  describe('curve MPR path', () => {
    it('returns 23-point dental arch path for known study', async () => {
      const res = await svc.getVolumeCurvePath('CBCT-001')
      expect(res.success).toBe(true)
      const data = res.data as any
      expect(data.points.length).toBeGreaterThanOrEqual(20)
      expect(data.expandedLengthMm).toBe(152)
      expect(data.spacingMm).toBe(0.5)
      expect(data.points[0]).toHaveProperty('x')
      expect(data.points[0]).toHaveProperty('y')
      expect(data.points[0]).toHaveProperty('z')
    })

    it('returns 404 for unknown study', async () => {
      const res = await svc.getVolumeCurvePath('CBCT-NOPE')
      expect(res.success).toBe(false)
    })
  })
})
