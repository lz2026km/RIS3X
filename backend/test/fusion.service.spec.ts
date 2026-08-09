import { FusionService } from '../src/modules/fusion/fusion.service'

describe('FusionService', () => {
  let svc: FusionService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      fusionJob: { create: jest.fn() },
    }
    svc = new FusionService(mockPrisma)
  })

  describe('register', () => {
    it('registers rigid transform and returns metrics', async () => {
      mockPrisma.fusionJob.create.mockResolvedValue({ id: 'job-1' })
      const r = await svc.register({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', transformType: 'rigid' })
      expect(r.registrationId).toBe('job-1')
      expect(r.status).toBe('completed')
      expect(r.metrics.dice).toBeGreaterThan(0)
      expect(r.metrics.dice).toBeLessThanOrEqual(1)
      expect(mockPrisma.fusionJob.create).toHaveBeenCalled()
    })

    it('supports affine and deformable types', async () => {
      mockPrisma.fusionJob.create.mockResolvedValue({ id: 'job-2' })
      const affine = await svc.register({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', transformType: 'affine' })
      const deform = await svc.register({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', transformType: 'deformable' })
      expect(affine.transformType).toBe('affine')
      expect(deform.transformType).toBe('deformable')
    })

    it('keeps in-memory registration id when DB fails', async () => {
      mockPrisma.fusionJob.create.mockRejectedValue(new Error('db down'))
      const r = await svc.register({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', transformType: 'rigid' })
      expect(r.registrationId).toMatch(/^reg-\d+/)
    })
  })

  describe('render', () => {
    it('returns frame with window settings and persists job', async () => {
      mockPrisma.fusionJob.create.mockResolvedValue({ id: 'job-3' })
      const r = await svc.render({
        fixedSeriesUid: 'F1',
        movingSeriesUid: 'M1',
        plane: 'axial',
        sliceIndex: 50,
        alpha: 0.7,
        windowWidth: 400,
        windowLevel: 40,
        fusionWindowWidth: 300,
        fusionWindowLevel: 60,
      })
      expect(r.frameId).toMatch(/^frame-\d+/)
      expect(r.width).toBe(512)
      expect(r.height).toBe(512)
      expect(r.alpha).toBe(0.7)
      expect(r.plane).toBe('axial')
      expect(mockPrisma.fusionJob.create).toHaveBeenCalled()
    })

    it('supports coronal and sagittal planes even when DB fails', async () => {
      mockPrisma.fusionJob.create.mockRejectedValue(new Error('db down'))
      const coronal = await svc.render({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', plane: 'coronal', sliceIndex: 10, alpha: 0.5, windowWidth: 400, windowLevel: 40, fusionWindowWidth: 400, fusionWindowLevel: 40 })
      const sagittal = await svc.render({ fixedSeriesUid: 'F1', movingSeriesUid: 'M1', plane: 'sagittal', sliceIndex: 10, alpha: 0.5, windowWidth: 400, windowLevel: 40, fusionWindowWidth: 400, fusionWindowLevel: 40 })
      expect(coronal.plane).toBe('coronal')
      expect(sagittal.plane).toBe('sagittal')
    })
  })

  describe('getSeries', () => {
    it('returns known patient series', async () => {
      const r = await svc.getSeries('P001')
      expect(r.series).toHaveLength(2)
      expect(r.series[0].modality).toBe('CT')
      expect(r.series[0].instanceCount).toBe(128)
    })

    it('returns default series for unknown patient', async () => {
      const r = await svc.getSeries('P999')
      expect(r.series[0].seriesDescription).toBe('Standard CT')
    })
  })

  // ===== [G005 Wave4A G-06] SUV 定量 =====
  describe('getSuv', () => {
    it('derives SUV from PET exam (real source)', async () => {
      const petPrisma: any = {
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'EX-PET-1', patientId: 'P100001', accessionNumber: 'ACC-PET-1', modality: 'PT' },
          ]),
          findFirst: jest.fn(),
        },
      }
      const petSvc = new FusionService(petPrisma)
      const r = await petSvc.getSuv('P100001')
      expect(r.hasPet).toBe(true)
      expect(r.source).toBe('exam')
      expect(r.suv).not.toBeNull()
      expect(r.suv!.max).toBeGreaterThan(0)
      expect(r.suv!.mean).toBeLessThan(r.suv!.max)
      expect(r.suv!.peak).toBeLessThanOrEqual(r.suv!.max)
      expect(r.suv!.normalization.weightKg).toBeGreaterThan(0)
      expect(r.suv!.normalization.formula).toContain('SUV')
      expect(r.lesions.length).toBeGreaterThan(0)
      expect(r.lesions[0]).toMatchObject({ x: expect.any(Number), y: expect.any(Number), diameterMm: expect.any(Number), suvMax: expect.any(Number) })
      expect(r.lesions[0].x).toBeGreaterThanOrEqual(0)
      expect(r.lesions[0].x).toBeLessThanOrEqual(1)
    })

    it('no PET exam -> hasPet false with empty lesions', async () => {
      const nonePrisma: any = {
        exam: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue({ id: 'EX-MR-1', patientId: 'P2', accessionNumber: 'ACC2', modality: 'MR' }),
        },
      }
      const noneSvc = new FusionService(nonePrisma)
      const r = await noneSvc.getSuv('P2')
      expect(r.hasPet).toBe(false)
      expect(r.source).toBe('none')
      expect(r.suv).toBeNull()
      expect(r.lesions).toHaveLength(0)
    })

    it('DB unavailable -> graceful seed fallback (empty, no crash)', async () => {
      const failPrisma: any = {
        exam: {
          findMany: jest.fn().mockRejectedValue(new Error('db down')),
          findFirst: jest.fn().mockRejectedValue(new Error('db down')),
        },
      }
      const seedSvc = new FusionService(failPrisma)
      const r = await seedSvc.getSuv('P100002')
      expect(r.hasPet).toBe(false)
      expect(r.source).toBe('none')
      expect(r.suv).toBeNull()
      expect(r.lesions).toHaveLength(0)
    })

    it('deterministic: same studyId yields identical SUV values', async () => {
      const petPrisma: any = {
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'EX-PET-2', patientId: 'P100009', accessionNumber: 'ACC9', modality: 'PET' },
          ]),
          findFirst: jest.fn(),
        },
      }
      const detSvc = new FusionService(petPrisma)
      const a = await detSvc.getSuv('P100009')
      const b = await detSvc.getSuv('P100009')
      expect(a.suv!.max).toBe(b.suv!.max)
      expect(a.lesions.map((l) => l.suvMax)).toEqual(b.lesions.map((l) => l.suvMax))
    })
  })
})
