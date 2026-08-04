import { OeeService } from '../src/modules/oee/oee.service'

describe('OeeService', () => {
  let svc: OeeService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      oeeRecord: {
        findMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
    }
    svc = new OeeService(mockPrisma)
  })

  describe('getList', () => {
    it('returns persisted records when DB has data', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([
        { deviceId: 'CT-01', modality: 'CT', oee: 85.5, availability: 90, performance: 95, quality: 100 },
        { deviceId: 'UNKNOWN-01', modality: 'MR', oee: 70, availability: 80, performance: 85, quality: 90 },
      ] as any)
      const list = await svc.getList()
      expect(list).toHaveLength(2)
      expect((list[0] as any).name).toBe('GE Revolution CT')
      expect((list[0] as any).trend).toMatch(/^(up|down|stable)$/)
      expect((list[1] as any).name).toBe('UNKNOWN-01')
      expect((list[1] as any).model).toBe('')
    })

    it('falls back to in-memory device list when DB throws and persists', async () => {
      mockPrisma.oeeRecord.findMany.mockRejectedValue(new Error('db down'))
      const list = await svc.getList()
      expect(list).toHaveLength(7)
      expect(list[0].oee).toBeGreaterThan(0)
      expect(list[0].oee).toBeLessThanOrEqual(100)
      expect(mockPrisma.oeeRecord.createMany).toHaveBeenCalled()
    })

    it('falls back when DB returns empty records', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([])
      const list = await svc.getList()
      expect(list).toHaveLength(7)
    })
  })

  describe('getDetail', () => {
    it('returns detail with loss breakdown for known device', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([
        { deviceId: 'CT-01', modality: 'CT', oee: 85, availability: 90, performance: 95, quality: 100 },
      ] as any)
      const detail = (await svc.getDetail('CT-01')) as any
      expect(detail).not.toBeNull()
      expect(detail.breakdownLoss).toBeGreaterThan(0)
      expect(detail.setupLoss).toBeGreaterThan(0)
      expect(detail.speedLoss).toBeGreaterThan(0)
      expect(detail.defectLoss).toBeGreaterThan(0)
    })

    it('returns null for unknown device', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([])
      await expect(svc.getDetail('NOPE')).resolves.toBeNull()
    })
  })

  describe('getTrend', () => {
    it('returns 12-day deterministic history without writing to DB', async () => {
      const trend = await svc.getTrend('CT-01')
      expect(trend).toHaveLength(12)
      expect(trend[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(trend[0].oee).toBeGreaterThan(0)
      expect(mockPrisma.oeeRecord.upsert).not.toHaveBeenCalled()
      const again = await svc.getTrend('CT-01')
      expect(again).toEqual(trend)
    })

    it('still returns trend when DB throws', async () => {
      mockPrisma.oeeRecord.upsert.mockRejectedValue(new Error('db down'))
      const trend = await svc.getTrend('UNKNOWN')
      expect(trend).toHaveLength(12)
    })
  })

  describe('getStats', () => {
    it('computes highest/lowest/average from device list', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([
        { deviceId: 'CT-01', modality: 'CT', oee: 90, availability: 90, performance: 95, quality: 100 },
        { deviceId: 'MR-01', modality: 'MR', oee: 50, availability: 80, performance: 85, quality: 90 },
        { deviceId: 'DR-01', modality: 'DR', oee: 70, availability: 85, performance: 90, quality: 95 },
      ])
      const stats = await svc.getStats()
      expect(stats.highest).toBe(90)
      expect(stats.lowest).toBe(50)
      expect(stats.average).toBe(70)
      expect(stats.totalDevices).toBe(3)
    })
  })
})
