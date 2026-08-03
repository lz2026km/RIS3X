import { NotFoundException } from '@nestjs/common'
import * as path from 'node:path'
import { DbtService } from '../src/modules/dbt/dbt.service'

const REAL_SAMPLES = path.resolve(__dirname, '..', 'dicom-samples')
const MISSING_SAMPLES = path.resolve(__dirname, '..', 'dicom-samples-does-not-exist')

describe('DbtService', () => {
  let svc: DbtService
  let mockPrisma: any

  function createService(sampleRoot: string | null) {
    return new DbtService(mockPrisma, sampleRoot ?? undefined)
  }

  beforeEach(() => {
    mockPrisma = {
      dicomInstance: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    svc = createService(MISSING_SAMPLES)
  })

  describe('listStudies', () => {
    it('returns current + prior built-in studies with L/R series', async () => {
      const list = await svc.listStudies()
      expect(list).toHaveLength(2)
      const current = list.find((s) => s.isCurrent)!
      const prior = list.find((s) => !s.isCurrent)!
      expect(current.id).toBe('DBT-STUDY-CURRENT')
      expect(current.series).toHaveLength(2)
      expect(current.series.map((s) => s.laterality)).toEqual(['L', 'R'])
      expect(current.series.map((s) => s.viewPosition)).toEqual(['LCC', 'RCC'])
      expect(current.priorStudyId).toBe(prior.id)
      expect(prior.studyDate).toBe('20251102')
    })

    it('merges extra studies coming from dicomInstance (modality DBT)', async () => {
      mockPrisma.dicomInstance.findMany.mockResolvedValue([
        { studyInstanceUid: 'EXTRA-STUDY-UID', seriesInstanceUid: 'EXTRA-SERIES-UID', patientName: 'WANG^DBT02', patientId: 'P999', modality: 'DBT' },
        { studyInstanceUid: 'EXTRA-STUDY-UID', seriesInstanceUid: 'EXTRA-SERIES-UID', patientName: 'WANG^DBT02', patientId: 'P999', modality: 'DBT' },
      ])
      const list = await svc.listStudies()
      expect(list).toHaveLength(3)
      const extra = list.find((s) => s.id === 'DBT-DB-EXTRA-STUDY-UID')!
      expect(extra.series[0].sliceCount).toBe(2)
      expect(extra.series[0].source).toBe('db')
    })

    it('falls back to built-in catalog when DB is unavailable', async () => {
      mockPrisma.dicomInstance.findMany.mockRejectedValue(new Error('db down'))
      const list = await svc.listStudies()
      expect(list).toHaveLength(2)
    })
  })

  describe('getSlices', () => {
    it('returns 15 slices with -15..+15 tomo angles and real pixel payloads', async () => {
      svc = createService(REAL_SAMPLES)
      const { study, slices } = await svc.getSlices('DBT-STUDY-CURRENT', undefined)
      expect(study.id).toBe('DBT-STUDY-CURRENT')
      expect(slices).toHaveLength(30)
      const left = slices.slice(0, 15)
      expect(left[0].tomoAngle).toBe(-15)
      expect(left[14].tomoAngle).toBe(15)
      expect(left.map((s) => s.instanceNumber)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
      expect(left[0].pixelData?.width).toBe(512)
      expect(left[0].pixelData?.height).toBe(512)
      expect(left[0].pixelData?.dataBase64.length).toBeGreaterThan(1000)
    })

    it('falls back to synthetic pixels when sample files are missing', async () => {
      const { slices } = await svc.getSlices('DBT-STUDY-CURRENT', undefined)
      expect(slices).toHaveLength(30)
      expect(slices[0].pixelData?.width).toBe(512)
      expect(slices[0].tomoAngle).toBe(-15)
      const angles = slices.slice(0, 15).map((s) => s.tomoAngle)
      expect(angles[0]).toBeLessThan(angles[14])
    })

    it('filters by series when seriesInstanceUid provided', async () => {
      const { slices } = await svc.getSlices('DBT-STUDY-CURRENT', undefined)
      const firstSeriesUid = slices[0].sopInstanceUid
      void firstSeriesUid
      const list = await svc.listStudies()
      const seriesUid = list.find((s) => s.isCurrent)!.series[0].seriesInstanceUid
      const { slices: filtered } = await svc.getSlices('DBT-STUDY-CURRENT', seriesUid)
      expect(filtered).toHaveLength(15)
    })

    it('throws NotFoundException for unknown study', async () => {
      await expect(svc.getSlices('UNKNOWN', undefined)).rejects.toThrow(NotFoundException)
    })
  })

  describe('reconstruct', () => {
    it('builds real MIP projection from sample files', async () => {
      svc = createService(REAL_SAMPLES)
      const list = await svc.listStudies()
      const seriesUid = list.find((s) => s.isCurrent)!.series[0].seriesInstanceUid
      const result = await svc.reconstruct('DBT-STUDY-CURRENT', seriesUid, 'mip', 15)
      expect(result.source).toBe('real')
      expect(result.projection).toBe('mip')
      expect(result.width).toBe(512)
      expect(result.height).toBe(512)
      expect(result.pixelData.dataBase64.length).toBe(Math.floor((512 * 512 * 2) / 3) * 4 + 4)
    })

    it('builds synthetic mean projection when files are missing', async () => {
      const list = await svc.listStudies()
      const seriesUid = list.find((s) => s.isCurrent)!.series[0].seriesInstanceUid
      const result = await svc.reconstruct('DBT-STUDY-CURRENT', seriesUid, 'mean', 15)
      expect(result.source).toBe('synthetic')
      expect(result.projection).toBe('mean')
      expect(result.width).toBe(512)
      expect(result.pixelData.dataBase64.length).toBeGreaterThan(0)
    })

    it('honours thickness window', async () => {
      const list = await svc.listStudies()
      const seriesUid = list.find((s) => s.isCurrent)!.series[0].seriesInstanceUid
      const result = await svc.reconstruct('DBT-STUDY-CURRENT', seriesUid, 'mip', 5)
      expect(result.thickness).toBe(5)
    })

    it('throws NotFoundException for unknown series', async () => {
      await expect(svc.reconstruct('DBT-STUDY-CURRENT', 'NOPE', 'mip', 15)).rejects.toThrow(NotFoundException)
    })
  })

  describe('compare', () => {
    it('returns current vs prior metadata with laterality mapping', async () => {
      const r = await svc.compare({ currentStudyId: 'DBT-STUDY-CURRENT', priorStudyId: 'DBT-STUDY-PRIOR' })
      expect(r.current.isCurrent).toBe(true)
      expect(r.prior.isCurrent).toBe(false)
      expect(r.lateralityMap).toHaveLength(2)
      expect(r.lateralityMap[0].laterality).toBe('L')
      expect(r.lateralityMap[0].currentSeries).toBeTruthy()
      expect(r.lateralityMap[0].priorSeries).toBeTruthy()
      expect(r.current.priorStudyId).toBe('DBT-STUDY-PRIOR')
    })

    it('rejects when currentStudyId is not current', async () => {
      await expect(svc.compare({ currentStudyId: 'DBT-STUDY-PRIOR', priorStudyId: 'DBT-STUDY-CURRENT' }))
        .rejects.toThrow(NotFoundException)
    })

    it('rejects unknown studies', async () => {
      await expect(svc.compare({ currentStudyId: 'NOPE', priorStudyId: 'DBT-STUDY-PRIOR' }))
        .rejects.toThrow(NotFoundException)
    })
  })
})
