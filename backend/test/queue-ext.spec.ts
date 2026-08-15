import { BadRequestException, NotFoundException } from '@nestjs/common'
import { QueueService } from '../src/modules/queue/queue.service'

// [v3.0.6.11-99 Wave 10E-3] queue 扩展端点: overview / room-status / daily-trend / priority / waiting-stats
describe('QueueService Wave10E-3 (overview/room-status/daily-trend/priority/waiting-stats)', () => {
  const makePrisma = (overrides: Record<string, unknown> = {}) => {
    const reject = jest.fn().mockRejectedValue(new Error('no db'))
    return {
      device: { findMany: reject },
      exam: { findMany: reject, count: reject },
      queueState: {
        count: reject,
        findMany: reject,
        upsert: reject,
      },
      ...overrides,
    } as never
  }

  let svc: QueueService

  beforeEach(() => {
    svc = new QueueService(makePrisma())
  })

  describe('getOverview', () => {
    it('returns queue overview from seed with all counters', async () => {
      const r = await svc.getOverview()
      expect(r.seeded).toBe(true)
      expect(r.totalRooms).toBeGreaterThan(0)
      expect(r.waitingCount).toBeGreaterThan(0)
      expect(r.todayCalled).toBeGreaterThanOrEqual(0)
      expect(r.avgWaitMinutes).toBeGreaterThanOrEqual(0)
      expect(r.maxWaitMinutes).toBeGreaterThanOrEqual(r.avgWaitMinutes)
      expect(r.timeoutCount).toBeGreaterThanOrEqual(0)
      expect(r.busyRooms + r.idleRooms).toBeLessThanOrEqual(r.totalRooms)
    })

    it('reflects call() side effects (todayCalled/checking counts)', async () => {
      const before = await svc.getOverview()
      const all = await svc.list()
      const target = all.find((i) => i.status === '等待中')!
      await svc.call(target.id)
      const after = await svc.getOverview()
      expect(after.todayCalled).toBeGreaterThanOrEqual(before.todayCalled + 1)
      expect(after.calledCount).toBeGreaterThan(before.calledCount)
    })
  })

  describe('getRoomStatusSummary', () => {
    it('aggregates rooms by status/modality with busyRate', async () => {
      const r = await svc.getRoomStatusSummary()
      expect(r.seeded).toBe(true)
      expect(r.totalRooms).toBe(6)
      expect(r.byStatus['使用中']).toBe(2)
      expect(r.byStatus['空闲']).toBeGreaterThanOrEqual(3)
      expect(r.waitingTotal).toBeGreaterThan(0)
      expect(r.busyRate).toBe(Math.round((r.byStatus['使用中'] / r.totalRooms) * 100))
      expect(r.byModality.length).toBeGreaterThan(0)
      const ct = r.byModality.find((m) => m.modality === 'CT')
      expect(ct?.total).toBe(2)
    })

    it('uses real devices when DB available', async () => {
      const dbSvc = new QueueService(
        makePrisma({
          device: {
            findMany: jest.fn().mockResolvedValue([
              { id: 'dev1', name: 'CT 1号机', code: 'CT-01', modality: 'CT', state: 'IDLE' },
              { id: 'dev2', name: 'MR 1号机', code: 'MR-01', modality: 'MR', state: 'IN_USE' },
            ]),
          },
        }),
      )
      const r = await dbSvc.getRoomStatusSummary()
      expect(r.seeded).toBe(false)
      expect(r.totalRooms).toBe(2)
      expect(r.byModality.find((m) => m.modality === 'CT')?.total).toBe(1)
    })
  })

  describe('getDailyTrend', () => {
    it('returns 7 deterministic seed points by default', async () => {
      const r = await svc.getDailyTrend()
      expect(r).toHaveLength(7)
      expect(r.every((p) => p.seeded)).toBe(true)
      expect(r[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(r[0].called).toBeGreaterThan(0)
      const again = await svc.getDailyTrend()
      expect(again).toEqual(r)
    })

    it('respects days param (clamped 1-30)', async () => {
      const r = await svc.getDailyTrend(30)
      expect(r).toHaveLength(30)
      const r2 = await svc.getDailyTrend(99)
      expect(r2).toHaveLength(30)
      const r3 = await svc.getDailyTrend(0)
      expect(r3).toHaveLength(7)
    })

    it('buckets queueState completedAt/lastCallAt rows when DB has data', async () => {
      const yesterday = new Date(Date.now() - 86400000)
      const dbSvc = new QueueService(
        makePrisma({
          queueState: {
            count: jest.fn().mockResolvedValue(1),
            findMany: jest.fn().mockResolvedValue([
              { entryId: 'e1', completedAt: yesterday, lastCallAt: yesterday },
              { entryId: 'e2', completedAt: yesterday, lastCallAt: yesterday },
            ]),
            upsert: jest.fn().mockResolvedValue({}),
          },
        }),
      )
      const r = await dbSvc.getDailyTrend(7)
      expect(r[5].called).toBe(2)
      expect(r[5].completed).toBe(2)
      expect(r[5].seeded).toBe(false)
    })
  })

  describe('setPriority', () => {
    it('updates priority of a queue entry', async () => {
      const all = await svc.list()
      const target = all.find((i) => i.priority === '普通')!
      const updated = await svc.setPriority(target.id, '紧急')
      expect(updated.priority).toBe('紧急')
      const after = await svc.list()
      expect(after.find((i) => i.id === target.id)?.priority).toBe('紧急')
    })

    it('rejects invalid priority with BadRequestException', async () => {
      const all = await svc.list()
      await expect(svc.setPriority(all[0].id, '加急')).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException for unknown entry', async () => {
      await expect(svc.setPriority('q-NOPE-1', '紧急')).rejects.toThrow(NotFoundException)
    })
  })

  describe('getWaitingStats', () => {
    it('returns waiting distribution + modality/priority groups', async () => {
      const r = await svc.getWaitingStats()
      expect(r.seeded).toBe(true)
      expect(r.total).toBeGreaterThan(0)
      expect(r.waitingCount + r.calledCount).toBeLessThanOrEqual(r.total)
      expect(r.distribution).toHaveLength(4)
      expect(r.distribution.reduce((a, b) => a + b.count, 0)).toBe(r.waitingCount + r.calledCount)
      expect(r.byModality.length).toBeGreaterThan(0)
      expect(r.byPriority.some((p) => p.priority === '危重')).toBe(true)
      expect(r.byPatientType.length).toBeGreaterThan(0)
      expect(r.maxWaitMinutes).toBeGreaterThanOrEqual(r.avgWaitMinutes)
    })

    it('counts long waits as timeout', async () => {
      const r = await svc.getWaitingStats()
      const timeoutBucket = r.distribution.find((d) => d.range === '>60分钟')
      expect(timeoutBucket).toBeDefined()
    })
  })
})
