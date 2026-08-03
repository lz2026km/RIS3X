import { NotFoundException } from '@nestjs/common'
import { Dicom4dService } from '../src/modules/dicom-4d/dicom-4d.service'

describe('Dicom4dService', () => {
  let svc: Dicom4dService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      dicom4dJob: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn().mockResolvedValue({}),
      },
    }
    svc = new Dicom4dService(mockPrisma)
  })

  describe('list', () => {
    it('returns mock catalog plus extra jobs from DB', async () => {
      mockPrisma.dicom4dJob.findMany.mockResolvedValue([
        { seriesUid: 'EXTRA-1', frameCount: 40, status: 'completed' },
        { seriesUid: '1.2.840.113619.2.55.3.6047.1.2.1.1', frameCount: 80, status: 'completed' },
      ])
      const list = await svc.list()
      expect(list).toHaveLength(4)
      expect(list.find((s) => s.seriesUid === 'EXTRA-1')?.seriesDescription).toBe('4D Series (completed)')
      expect(list.find((s) => s.seriesUid === 'EXTRA-1')?.frameRate).toBe(10)
    })

    it('returns mock catalog only when DB fails', async () => {
      mockPrisma.dicom4dJob.findMany.mockRejectedValue(new Error('db down'))
      const list = await svc.list()
      expect(list).toHaveLength(3)
    })
  })

  describe('getFrames', () => {
    it('generates frames for mock series and persists job', async () => {
      const frames = await svc.getFrames('1.2.840.113619.2.55.3.6047.1.2.1.1')
      expect(frames).toHaveLength(80)
      expect(frames[0].frameIndex).toBe(0)
      expect(frames[0].phase).toBe(0)
      expect(frames[0].dataUrl).toContain('/frame/0')
      expect(frames[79].phase).toBe(99)
      expect(mockPrisma.dicom4dJob.upsert).toHaveBeenCalled()
    })

    it('creates series from DB job when not in mock catalog', async () => {
      mockPrisma.dicom4dJob.findUnique.mockResolvedValue({ seriesUid: 'JOB-1', frameCount: 20, status: 'completed' })
      const frames = await svc.getFrames('JOB-1')
      expect(frames).toHaveLength(20)
    })

    it('throws NotFoundException for unknown series even when DB fails', async () => {
      mockPrisma.dicom4dJob.findUnique.mockRejectedValue(new Error('db down'))
      await expect(svc.getFrames('UNKNOWN')).rejects.toThrow(NotFoundException)
    })

    it('still generates frames when persist fails', async () => {
      mockPrisma.dicom4dJob.upsert.mockRejectedValue(new Error('db down'))
      const frames = await svc.getFrames('1.2.840.113619.2.55.3.6047.1.2.1.3')
      expect(frames).toHaveLength(120)
    })
  })

  describe('getPhase', () => {
    it('returns cardiac phase info for cardiac series', async () => {
      const p = await svc.getPhase('1.2.840.113619.2.55.3.6047.1.2.1.1')
      expect(p.gatingType).toBe('cardiac')
      expect(p.cardiacPhase).toBeGreaterThanOrEqual(0)
      expect(p.cardiacPhase).toBeLessThanOrEqual(100)
      expect(p.respiratoryPhase).toBe(0)
      expect(p.cardiacCycleMs).toBe(800)
    })

    it('returns respiratory phase for respiratory series', async () => {
      const p = await svc.getPhase('1.2.840.113619.2.55.3.6047.1.2.1.2')
      expect(p.gatingType).toBe('respiratory')
      expect(p.cardiacPhase).toBe(0)
      expect(p.respiratoryPhase).toBeGreaterThanOrEqual(0)
      expect(p.respiratoryCycleMs).toBe(4000)
    })

    it('throws NotFoundException for unknown series', async () => {
      await expect(svc.getPhase('UNKNOWN')).rejects.toThrow(NotFoundException)
    })
  })
})
