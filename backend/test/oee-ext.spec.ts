import { OeeService } from '../src/modules/oee/oee.service'

// [v3.0.6.11-99 Wave 10E-3] oee 扩展端点: overview / by-modality / daily-trend / downtime-analysis
describe('OeeService Wave10E-3 (overview/by-modality/daily-trend/downtime-analysis)', () => {
  let svc: OeeService
  let mockPrisma: any

  const record = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    deviceId: 'CT-01',
    date: '2026-08-15',
    modality: 'CT',
    availability: 90,
    performance: 95,
    quality: 100,
    oee: 85.5,
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      oeeRecord: {
        findMany: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn().mockResolvedValue({}),
      },
      exam: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new OeeService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates averages + best/worst device + byModality from actual records', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([
        record({ deviceId: 'CT-01', modality: 'CT', oee: 90, availability: 92, performance: 96, quality: 100 }),
        record({ deviceId: 'CT-02', modality: 'CT', oee: 70, availability: 80, performance: 85, quality: 95 }),
        record({ deviceId: 'MR-01', modality: 'MR', oee: 50, availability: 60, performance: 70, quality: 90 }),
      ])
      const r = await svc.getOverview()
      expect(r.seeded).toBe(false)
      expect(r.totalDevices).toBe(3)
      expect(r.totalModalities).toBe(2)
      expect(r.avgOee).toBe(70)
      expect(r.avgAvailability).toBe(77.3)
      expect(r.bestDevice).toMatchObject({ id: 'CT-01', oee: 90 })
      expect(r.worstDevice).toMatchObject({ id: 'MR-01', oee: 50 })
      expect(r.byModality.find((m) => m.modality === 'CT')).toMatchObject({ devices: 2, oee: 80 })
    })

    it('falls back to derived seed with all 7 devices', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.seeded).toBe(true)
      expect(r.totalDevices).toBe(7)
      expect(r.avgOee).toBeGreaterThan(0)
      expect(r.avgOee).toBeLessThanOrEqual(100)
      expect(r.byModality.length).toBeGreaterThanOrEqual(4)
    })

    it('still returns overview when DB throws', async () => {
      mockPrisma.oeeRecord.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getOverview()
      expect(r.totalDevices).toBe(7)
      expect(r.bestDevice).not.toBeNull()
    })
  })

  describe('getByModality', () => {
    it('groups devices by modality with averages and extremes', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([
        record({ deviceId: 'CT-01', modality: 'CT', oee: 90, availability: 92, performance: 96, quality: 100 }),
        record({ deviceId: 'CT-02', modality: 'CT', oee: 60, availability: 70, performance: 80, quality: 90 }),
        record({ deviceId: 'MR-01', modality: 'MR', oee: 80, availability: 85, performance: 90, quality: 95 }),
      ])
      const r = await svc.getByModality()
      expect(r).toHaveLength(2)
      const ct = r.find((m) => m.modality === 'CT')!
      expect(ct.deviceCount).toBe(2)
      expect(ct.avgOee).toBe(75)
      expect(ct.bestDevice).toBe('GE Revolution CT')
      expect(ct.worstDevice).toBe('Canon Aquilion')
      const mr = r.find((m) => m.modality === 'MR')!
      expect(mr.bestDevice).toBe('Siemens Skyra')
    })

    it('sorts modalities by avgOee descending', async () => {
      const r = await svc.getByModality()
      expect(r.length).toBeGreaterThan(0)
      for (let i = 1; i < r.length; i++) expect(r[i - 1]!.avgOee).toBeGreaterThanOrEqual(r[i]!.avgOee)
    })
  })

  describe('getDailyTrend', () => {
    it('returns 30 deterministic seed points (clamped 1-60)', async () => {
      mockPrisma.oeeRecord.findMany.mockResolvedValue([])
      const r = await svc.getDailyTrend()
      expect(r).toHaveLength(30)
      expect(r.every((p) => p.seeded)).toBe(true)
      expect(r[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r[0].oee).toBeGreaterThan(0)
      const again = await svc.getDailyTrend()
      expect(again).toEqual(r)
      expect(await svc.getDailyTrend(99)).toHaveLength(60)
    })

    it('buckets persisted records by date when available', async () => {
      const d1 = new Date(Date.now() - 3 * 86400000).toISOString().slice(0, 10)
      mockPrisma.oeeRecord.findMany.mockResolvedValue([
        record({ deviceId: 'CT-01', date: d1, oee: 80, availability: 85, performance: 90, quality: 95 }),
        record({ deviceId: 'MR-01', date: d1, oee: 60, availability: 70, performance: 80, quality: 90 }),
      ])
      const r = await svc.getDailyTrend(7)
      const hit = r.find((p) => p.date === d1)!
      expect(hit).toBeDefined()
      expect(hit.seeded).toBe(false)
      expect(hit.oee).toBe(70)
      expect(hit.devices).toBe(2)
    })
  })

  describe('getDowntimeAnalysis', () => {
    it('splits downtime into 4 reasons with weighted durations', async () => {
      const r = await svc.getDowntimeAnalysis('CT-01')
      expect(r).not.toBeNull()
      expect(r!.deviceName).toBe('GE Revolution CT')
      expect(r!.reasons).toHaveLength(4)
      expect(r!.reasons.map((x) => x.reasonZh)).toEqual(['设备故障停机', '摆位与换床准备', '扫描速度损失', '图像质量缺陷重拍'])
      const sum = r!.reasons.reduce((a, b) => a + b.durationMinutes, 0)
      expect(sum).toBe(r!.totalDowntimeMinutes)
      expect(r!.reasons.reduce((a, b) => a + b.percent, 0)).toBe(100)
      expect(r!.plannedMinutes + r!.unplannedMinutes).toBe(r!.totalDowntimeMinutes)
    })

    it('returns null for unknown device', async () => {
      await expect(svc.getDowntimeAnalysis('NOPE')).resolves.toBeNull()
    })

    it('is deterministic for same device/date', async () => {
      const a = await svc.getDowntimeAnalysis('MR-01')
      const b = await svc.getDowntimeAnalysis('MR-01')
      expect(a).toEqual(b)
    })
  })
})
