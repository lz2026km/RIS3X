import { BiService } from './bi.service'

const makeCache = () => ({
  get: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue(undefined),
})

// [v3.0.6.11-79] admin config 读取桩: 可注入 critical_sla_minutes 等键值
const makeSystemConfig = (values: Record<string, unknown> = {}) => {
  const fallbacks: Record<string, number> = { critical_sla_minutes: 30 }
  return {
    getNumber: jest.fn(async (key: string, fb: number) => {
      const v = values[key] ?? fallbacks[key]
      return typeof v === 'number' ? v : fb
    }),
    getString: jest.fn(async (key: string, fb: string) => (typeof values[key] === 'string' ? values[key] : fb)),
    get: jest.fn(),
    invalidate: jest.fn(),
  } as never
}

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    exam: { count: jest.fn().mockRejectedValue(new Error('no db')), findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    report: {
      count: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    criticalValue: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    oeeRecord: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    device: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000)

describe('BiService', () => {
  describe('demo fallback (DB unavailable)', () => {
    let service: BiService

    beforeEach(() => {
      service = new BiService(makePrisma(), makeCache() as never, makeSystemConfig())
    })

    it('getKpi returns demo payload marked source=demo', async () => {
      const res = await service.getKpi()
      expect(res.source).toBe('demo')
      expect(res.data.examCount).toBeGreaterThan(0)
      expect(res.data.reportCount).toBeGreaterThan(0)
      expect(res.data.completionRate).toBeGreaterThanOrEqual(0)
      expect(res.data.completionRate).toBeLessThanOrEqual(100)
      expect(res.data.overtimeRate).toBeGreaterThanOrEqual(0)
    })

    it('getReportTimeliness returns 5 buckets with 100% total', async () => {
      const res = await service.getReportTimeliness()
      expect(res.source).toBe('demo')
      expect(res.data.buckets).toHaveLength(5)
      const totalPercent = res.data.buckets.reduce((s, b) => s + b.percent, 0)
      expect(totalPercent).toBeCloseTo(100, 0)
      expect(res.data.medianMinutes).toBeGreaterThan(0)
      expect(res.data.p90Minutes).toBeGreaterThanOrEqual(res.data.medianMinutes)
    })

    it('getPhysicianRvu returns sorted physicians with rvu > 0', async () => {
      const res = await service.getPhysicianRvu()
      expect(res.source).toBe('demo')
      expect(res.data.physicians.length).toBeGreaterThan(0)
      const rvus = res.data.physicians.map((p) => p.rvu)
      expect([...rvus].sort((a, b) => b - a)).toEqual(rvus)
    })

    it('getDeviceOee returns devices and daily trend of requested length', async () => {
      const res = await service.getDeviceOee(14)
      expect(res.source).toBe('demo')
      expect(res.data.devices.length).toBeGreaterThan(0)
      expect(res.data.dailyTrend.length).toBe(14)
      expect(res.data.devices[0]?.avgOee).toBeGreaterThan(0)
    })

    it('getCriticalSla returns compliance rate and overdue list', async () => {
      const res = await service.getCriticalSla()
      expect(res.source).toBe('demo')
      expect(res.data.complianceRate).toBeGreaterThanOrEqual(0)
      expect(res.data.complianceRate).toBeLessThanOrEqual(100)
      expect(res.data.distribution).toHaveLength(5)
      expect(Array.isArray(res.data.overdue)).toBe(true)
    })

    it('getTrend returns days points', async () => {
      const res = await service.getTrend(30)
      expect(res.source).toBe('demo')
      expect(res.data).toHaveLength(30)
      expect(res.data[0]?.date).toBeDefined()
    })
  })

  describe('database aggregation (Prisma returns data)', () => {
    let service: BiService

    beforeEach(() => {
      const prisma = makePrisma({
        exam: {
          count: jest.fn().mockResolvedValue(10),
          findMany: jest
            .fn()
            .mockResolvedValue([
              { createdAt: hoursAgo(1) },
              { createdAt: hoursAgo(2) },
              { createdAt: hoursAgo(3) },
            ]),
        },
        report: {
          count: jest.fn().mockResolvedValue(8),
          findMany: jest.fn().mockResolvedValue([]),
        },
        criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
        oeeRecord: {
          findMany: jest.fn().mockResolvedValue([
            { deviceId: 'CT-01', date: '2026-07-01', modality: 'CT', availability: 90, performance: 92, quality: 98, oee: 81.1 },
            { deviceId: 'CT-01', date: '2026-07-02', modality: 'CT', availability: 95, performance: 90, quality: 99, oee: 84.6 },
            { deviceId: 'DR-01', date: '2026-07-01', modality: 'DR', availability: 88, performance: 95, quality: 97, oee: 81.1 },
          ]),
        },
        device: { findMany: jest.fn().mockResolvedValue([{ id: 'CT-01', name: 'GE CT' }, { id: 'DR-01', name: 'Philips DR' }]) },
      })
      service = new BiService(prisma, makeCache() as never, makeSystemConfig())
    })

    it('getKpi computes completion/avg/overtime from report rows', async () => {
      // 8 reports: 6 signed within SLA(<30min), 1 signed after 24h, 1 unsigned created 2 days ago
      const signedOnTime = Array.from({ length: 6 }, () => ({
        createdAt: hoursAgo(2),
        signedAt: new Date(hoursAgo(2).getTime() + 20 * 60000),
        state: 'SIGNED',
      }))
      const signedLate = [{ createdAt: hoursAgo(30), signedAt: hoursAgo(2), state: 'SIGNED' }]
      const unsignedOld = [{ createdAt: new Date(Date.now() - 3 * 86400000), signedAt: null, state: 'WRITING' }]
      const prisma = makePrisma({
        exam: { count: jest.fn().mockResolvedValue(10) },
        report: {
          count: jest.fn().mockResolvedValue(8),
          findMany: jest.fn().mockResolvedValue([...signedOnTime, ...signedLate, ...unsignedOld]),
        },
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: hoursAgo(1), ackedAt: new Date(hoursAgo(1).getTime() + 10 * 60000) },
            { createdAt: hoursAgo(1), ackedAt: new Date(hoursAgo(1).getTime() + 45 * 60000) },
          ]),
        },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig())
      const res = await svc.getKpi()
      expect(res.source).toBe('database')
      expect(res.data.examCount).toBe(10)
      expect(res.data.reportCount).toBe(8)
      // 7 signed / 8 total
      expect(res.data.completionRate).toBe(87.5)
      // overtime = 1 signed late + 1 unsigned old = 2 → 25%
      expect(res.data.overtimeRate).toBe(25)
      // median of [20,20,20,20,20,20,1440] = 20
      expect(res.data.avgReportMinutes).toBe(20)
      // critical SLA: 1 of 2 within 30min → 50%
      expect(res.data.criticalSlaRate).toBe(50)
    })

    it('getReportTimeliness buckets durations correctly', async () => {
      const mk = (minutes: number) => ({
        createdAt: hoursAgo(5),
        signedAt: new Date(hoursAgo(5).getTime() + minutes * 60000),
      })
      const prisma = makePrisma({
        report: {
          findMany: jest.fn().mockResolvedValue([mk(20), mk(40), mk(90), mk(180), mk(300), mk(10)]),
        },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig())
      const res = await svc.getReportTimeliness()
      expect(res.source).toBe('database')
      expect(res.data.total).toBe(6)
      expect(res.data.buckets.map((b) => b.count)).toEqual([2, 1, 1, 1, 1])
      expect(res.data.medianMinutes).toBe(65)
      expect(res.data.p90Minutes).toBe(300)
    })

    it('getPhysicianRvu groups by doctor and computes rvu by modality', async () => {
      const prisma = makePrisma({
        report: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: hoursAgo(1), signedAt: hoursAgo(1), radiologist: { fullName: '张医生' }, exam: { modality: 'CT' } },
            { createdAt: hoursAgo(1), signedAt: hoursAgo(1), radiologist: { fullName: '张医生' }, exam: { modality: 'DR' } },
            { createdAt: hoursAgo(1), signedAt: hoursAgo(1), radiologist: { fullName: '李医生' }, exam: { modality: 'MR' } },
          ]),
        },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig())
      const res = await svc.getPhysicianRvu()
      expect(res.source).toBe('database')
      expect(res.data.physicians).toHaveLength(2)
      const zhang = res.data.physicians.find((p) => p.doctorName === '张医生')
      expect(zhang?.reportCount).toBe(2)
      expect(zhang?.rvu).toBe(4.5) // CT 3.5 + DR 1.0
      expect(res.data.totalRvu).toBe(9.5) // + MR 5.0
    })

    it('getDeviceOee aggregates OeeRecord rows per device', async () => {
      const svc = service as BiService
      const res = await svc.getDeviceOee(14)
      expect(res.source).toBe('database')
      expect(res.data.devices).toHaveLength(2)
      const ct = res.data.devices.find((d) => d.deviceId === 'CT-01')
      expect(ct?.deviceName).toBe('GE CT')
      expect(ct?.trend).toHaveLength(2)
      expect(ct?.avgOee).toBe(82.9)
      expect(res.data.dailyTrend).toHaveLength(2)
      const d1 = res.data.dailyTrend.find((d) => d.date === '2026-07-01')
      expect(d1?.oee).toBeCloseTo(81.1, 1)
    })

    it('getCriticalSla computes compliance and overdue list', async () => {
      const prisma = makePrisma({
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'c1', severity: 'HIGH', state: 'ACKNOWLEDGED', createdAt: hoursAgo(2), ackedAt: new Date(hoursAgo(2).getTime() + 10 * 60000) },
            { id: 'c2', severity: 'URGENT', state: 'NOTIFIED', createdAt: hoursAgo(2), ackedAt: new Date(hoursAgo(2).getTime() + 50 * 60000) },
            { id: 'c3', severity: 'CRITICAL', state: 'FOUND', createdAt: hoursAgo(2), ackedAt: null },
          ]),
        },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig())
      const res = await svc.getCriticalSla()
      expect(res.source).toBe('database')
      expect(res.data.total).toBe(3)
      expect(res.data.complianceRate).toBeCloseTo(33.3, 0)
      expect(res.data.overdue).toHaveLength(2)
      // 排序按响应时长降序: c3 未确认(2h) > c2 (50min)
      expect(res.data.overdue[0]?.id).toBe('c3')
    })

    // [v3.0.6.11-79] 消费者: critical_sla_minutes admin config 影响 SLA 达标判断
    it('getCriticalSla honors admin config critical_sla_minutes', async () => {
      const prisma = makePrisma({
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'c1', severity: 'HIGH', state: 'ACKNOWLEDGED', createdAt: hoursAgo(2), ackedAt: new Date(hoursAgo(2).getTime() + 10 * 60000) },
            { id: 'c2', severity: 'URGENT', state: 'NOTIFIED', createdAt: hoursAgo(2), ackedAt: new Date(hoursAgo(2).getTime() + 50 * 60000) },
            { id: 'c3', severity: 'CRITICAL', state: 'FOUND', createdAt: hoursAgo(2), ackedAt: null },
          ]),
        },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig({ critical_sla_minutes: 60 }))
      const res = await svc.getCriticalSla()
      expect(res.source).toBe('database')
      // SLA=60min: c1(10min)/c2(50min) 达标, 仅 c3(未确认) 超时 → 66.7%
      expect(res.data.slaMinutes).toBe(60)
      expect(res.data.complianceRate).toBeCloseTo(66.7, 0)
      expect(res.data.overdue).toHaveLength(1)
      expect(res.data.overdue[0]?.id).toBe('c3')
    })

    it('getTrend builds per-day points', async () => {
      const prisma = makePrisma({
        exam: { findMany: jest.fn().mockResolvedValue([{ createdAt: hoursAgo(1) }, { createdAt: hoursAgo(26) }]) },
        report: {
          findMany: jest.fn().mockResolvedValue([
            { createdAt: hoursAgo(1), signedAt: hoursAgo(1), state: 'SIGNED' },
            { createdAt: hoursAgo(26), signedAt: hoursAgo(26), state: 'SIGNED' },
          ]),
        },
        criticalValue: { findMany: jest.fn().mockResolvedValue([{ createdAt: hoursAgo(1) }]) },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig())
      const res = await svc.getTrend(7)
      expect(res.source).toBe('database')
      expect(res.data).toHaveLength(7)
      const last = res.data[res.data.length - 1]!
      const today = new Date().toISOString().slice(0, 10)
      expect(last.date).toBe(today)
      expect(last.examCount).toBe(1)
      expect(last.reportCount).toBe(1)
      expect(last.criticalCount).toBe(1)
      expect(last.completionRate).toBe(100)
    })

    it('getKpi falls back to demo when DB is empty', async () => {
      const prisma = makePrisma({
        exam: { count: jest.fn().mockResolvedValue(0) },
        report: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
        criticalValue: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const svc = new BiService(prisma, makeCache() as never, makeSystemConfig())
      const res = await svc.getKpi()
      expect(res.source).toBe('demo')
    })
  })
})
