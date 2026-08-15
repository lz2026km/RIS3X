import { OccupancyService } from '../src/modules/occupancy/occupancy.service'

// [v3.0.6.11-99 Wave 10E-3] occupancy 扩展端点: overview / daily-trend / by-shift
describe('OccupancyService Wave10E-3 (overview/daily-trend/by-shift)', () => {
  let svc: OccupancyService
  let mockPrisma: any

  const room = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    roomNo: 'CT1',
    status: 'occupied',
    currentPatient: '张伟',
    examItem: '胸部CT',
    startTime: new Date(Date.now() - 20 * 60000),
    expectedEnd: new Date(Date.now() - 2 * 60000),
    overdue: true,
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      examRoom: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      exam: { findMany: jest.fn() },
    }
    svc = new OccupancyService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates room statuses + session stats from DB', async () => {
      mockPrisma.examRoom.findMany.mockResolvedValue([
        room(),
        room({ id: 'r2', roomNo: 'MR1', status: 'occupied', expectedEnd: new Date(Date.now() + 30 * 60000), overdue: false }),
        room({ id: 'r3', roomNo: 'DR1', status: 'idle' }),
        room({ id: 'r4', roomNo: 'MG1', status: 'disinfecting' }),
        room({ id: 'r5', roomNo: 'DSA1', status: 'fault' }),
      ])
      const startA = new Date(Date.now() - 30 * 60000)
      const endA = new Date(Date.now() - 10 * 60000)
      mockPrisma.exam.findMany.mockResolvedValue([
        { startedAt: startA, completedAt: endA },
        { startedAt: new Date(Date.now() - 40 * 60000), completedAt: new Date(Date.now() - 30 * 60000) },
      ])
      const r = await svc.getOverview()
      expect(r.seeded).toBe(false)
      expect(r.totalRooms).toBe(5)
      expect(r.occupiedRooms).toBe(2)
      expect(r.idleRooms).toBe(1)
      expect(r.disinfectingRooms).toBe(1)
      expect(r.faultRooms).toBe(1)
      expect(r.occupancyRate).toBe(40)
      expect(r.todayExams).toBe(2)
      expect(r.avgSessionMinutes).toBe(15)
      expect(r.overdueRooms).toBe(1)
    })

    it('falls back to seed rooms when DB unavailable', async () => {
      mockPrisma.examRoom.findMany.mockRejectedValue(new Error('no db'))
      mockPrisma.exam.findMany.mockRejectedValue(new Error('no db'))
      const r = await svc.getOverview()
      expect(r.seeded).toBe(true)
      expect(r.totalRooms).toBe(6)
      expect(r.occupiedRooms).toBe(2)
      expect(r.occupancyRate).toBe(33)
      expect(r.faultRooms).toBe(1)
      expect(r.overdueRooms).toBeGreaterThanOrEqual(1)
    })

    it('falls back when rooms table is empty', async () => {
      mockPrisma.examRoom.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.seeded).toBe(true)
      expect(r.totalRooms).toBe(6)
    })
  })

  describe('getDailyTrend', () => {
    it('returns 7 points with today rate from real rooms', async () => {
      mockPrisma.examRoom.findMany.mockResolvedValue([
        room(),
        room({ id: 'r2', roomNo: 'MR1', status: 'occupied' }),
        room({ id: 'r3', roomNo: 'DR1', status: 'idle' }),
        room({ id: 'r4', roomNo: 'MG1', status: 'idle' }),
      ])
      const today = new Date()
      const yesterday = new Date(today.getTime() - 86400000)
      mockPrisma.exam.findMany.mockResolvedValue([
        { completedAt: today },
        { completedAt: today },
        { completedAt: yesterday },
      ])
      const r = await svc.getDailyTrend(7)
      expect(r).toHaveLength(7)
      const last = r[r.length - 1]!
      expect(last.occupancyRate).toBe(50)
      expect(last.occupiedAvg).toBe(2)
      expect(last.totalRooms).toBe(4)
      expect(last.exams).toBe(2)
      expect(r[r.length - 2]!.exams).toBe(1)
      expect(r.every((p) => p.occupancyRate >= 0 && p.occupancyRate <= 100)).toBe(true)
    })

    it('returns deterministic seed trend when no data', async () => {
      mockPrisma.examRoom.findMany.mockRejectedValue(new Error('no db'))
      mockPrisma.exam.findMany.mockRejectedValue(new Error('no db'))
      const r = await svc.getDailyTrend()
      expect(r).toHaveLength(7)
      expect(r.every((p) => p.seeded)).toBe(true)
      expect(r[0].date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      const again = await svc.getDailyTrend()
      expect(again).toEqual(r)
      expect(await svc.getDailyTrend(30)).toHaveLength(30)
    })
  })

  describe('getByShift', () => {
    it('buckets today exams into 4 shifts with deterministic rates', async () => {
      const mk = (hour: number) => {
        const d = new Date()
        d.setHours(hour, 30, 0, 0)
        return {
          startedAt: d,
          completedAt: new Date(d.getTime() + 15 * 60000),
        }
      }
      mockPrisma.exam.findMany.mockResolvedValue([mk(9), mk(10), mk(14), mk(20), mk(23)])
      const r = await svc.getByShift()
      expect(r).toHaveLength(4)
      expect(r[0]).toMatchObject({ shift: 'morning', shiftZh: '上午班', timeRange: '08:00-12:00', exams: 2 })
      expect(r[1]).toMatchObject({ shift: 'afternoon', exams: 1 })
      expect(r[2]).toMatchObject({ shift: 'evening', exams: 1 })
      expect(r[3]).toMatchObject({ shift: 'night', exams: 1 })
      expect(r[0].avgSessionMinutes).toBe(15)
      expect(r[3].occupancyRate).toBeLessThan(r[0].occupancyRate)
      expect(r.every((s) => s.occupancyRate >= 0 && s.occupancyRate <= 100)).toBe(true)
    })

    it('returns seeded shift stats when no exams', async () => {
      mockPrisma.exam.findMany.mockRejectedValue(new Error('no db'))
      const r = await svc.getByShift()
      expect(r.every((s) => s.seeded)).toBe(true)
      expect(r[0].shift).toBe('morning')
      expect(r[0].exams).toBe(0)
      const again = await svc.getByShift()
      expect(again).toEqual(r)
    })
  })
})
