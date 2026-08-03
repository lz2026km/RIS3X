import { NotFoundException } from '@nestjs/common'
import { RadiomicsService } from '../src/modules/radiomics/radiomics.service'

describe('RadiomicsService', () => {
  let svc: RadiomicsService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      radiomicsFeature: {
        createMany: jest.fn().mockResolvedValue({ count: 20 }),
        findMany: jest.fn(),
      },
    }
    svc = new RadiomicsService(mockPrisma)
  })

  describe('extract', () => {
    it('persists generated features via prisma', async () => {
      const result = await svc.extract({ instanceId: 'I1', roi: { instanceId: 'I1', type: 'rectangle', coordinates: [1, 2, 3, 4] } })
      expect(result.instanceId).toBe('I1')
      expect(result.features.length).toBeGreaterThan(10)
      expect(mockPrisma.radiomicsFeature.createMany).toHaveBeenCalled()
      const first = result.features[0]
      expect(first).toMatchObject({ category: 'Shape', name: 'Volume', unit: 'mm³' })
    })

    it('stores features in memory when DB fails', async () => {
      mockPrisma.radiomicsFeature.createMany.mockRejectedValue(new Error('db down'))
      await svc.extract({ instanceId: 'I2', roi: { instanceId: 'I2', type: 'ellipse', coordinates: [0, 0, 5] } })
      const result = await svc.getFeatures('I2')
      expect(result.features.length).toBeGreaterThan(0)
    })

    it('handles missing roi (default roi id)', async () => {
      const result = await svc.extract({ instanceId: 'I3', roi: undefined as any })
      expect(result.instanceId).toBe('I3')
    })
  })

  describe('getFeatures', () => {
    it('returns mapped rows from DB', async () => {
      mockPrisma.radiomicsFeature.findMany.mockResolvedValue([
        { instanceUid: 'I1', category: 'FirstOrder', featureName: 'Mean', value: 85.3, unit: 'HU' },
      ])
      const result = await svc.getFeatures('I1')
      expect(result.features[0]).toEqual({ category: 'FirstOrder', name: 'Mean', value: 85.3, unit: 'HU' })
    })

    it('throws NotFoundException when no rows', async () => {
      mockPrisma.radiomicsFeature.findMany.mockResolvedValue([])
      await expect(svc.getFeatures('I9')).rejects.toThrow(NotFoundException)
    })

    it('throws NotFoundException when DB down and nothing stored', async () => {
      mockPrisma.radiomicsFeature.findMany.mockRejectedValue(new Error('db down'))
      await expect(svc.getFeatures('I9')).rejects.toThrow(NotFoundException)
    })
  })

  describe('compare', () => {
    it('extracts features for each instance id', async () => {
      const results = await svc.compare({
        instanceIds: ['I-A', 'I-B'],
        rois: [
          { instanceId: 'I-A', type: 'polygon', coordinates: [0, 0, 4, 0, 4, 4] },
          { instanceId: 'I-B', type: 'rectangle', coordinates: [1, 1, 2, 2] },
        ],
      })
      expect(results).toHaveLength(2)
      expect(results[0].instanceId).toBe('I-A')
      expect(results[0].features.length).toBeGreaterThan(10)
      expect(mockPrisma.radiomicsFeature.createMany).toHaveBeenCalledTimes(2)
    })

    it('falls back to memory when DB fails', async () => {
      mockPrisma.radiomicsFeature.createMany.mockRejectedValue(new Error('db down'))
      await svc.compare({ instanceIds: ['I-C'], rois: [{ instanceId: 'I-C', type: 'ellipse', coordinates: [2, 2, 3] }] })
      const result = await svc.getFeatures('I-C')
      expect(result.features.length).toBeGreaterThan(0)
    })
  })
})
