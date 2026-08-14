import { DeviceMgmtService } from '../src/devicemgmt/devicemgmt.service'

// [v3.0.6.11-99 Wave 10D] devicemgmt 扩展端点: overview / usage-trend / by-room / maintenance-calendar
describe('DeviceMgmtService Wave10D (overview/usage-trend/by-room/maintenance-calendar)', () => {
  let svc: DeviceMgmtService
  let mockPrisma: any

  const device = (overrides: Record<string, unknown> = {}) => ({
    id: 'dev1',
    tenantId: 't1',
    code: 'CT-01',
    name: 'CT 1号机',
    modality: 'CT',
    location: 'CT室1',
    state: 'IDLE',
    todayExams: 5,
    todayUsageMin: 120,
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      device: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      auditLog: { count: jest.fn().mockResolvedValue(0) },
      maintenancePlan: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn() },
      exam: { findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new DeviceMgmtService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates totals by state + usage + modality', async () => {
      mockPrisma.device.findMany.mockResolvedValue([
        device(),
        device({ id: 'dev2', state: 'IN_USE', todayExams: 8, todayUsageMin: 180 }),
        device({ id: 'dev3', state: 'BROKEN', modality: 'MR', location: 'MR室1', todayExams: 0, todayUsageMin: 0 }),
      ])
      mockPrisma.auditLog.count.mockResolvedValue(1)
      mockPrisma.maintenancePlan.count.mockResolvedValue(2)
      mockPrisma.device.groupBy.mockResolvedValue([
        { modality: 'CT', state: 'IDLE', _count: { _all: 1 } },
        { modality: 'CT', state: 'IN_USE', _count: { _all: 1 } },
        { modality: 'MR', state: 'BROKEN', _count: { _all: 1 } },
      ])
      const r = await svc.getOverview()
      expect(r.total).toBe(3)
      expect(r.online).toBe(2)
      expect(r.byState).toMatchObject({ IDLE: 1, IN_USE: 1, BROKEN: 1, MAINTENANCE: 0, OFFLINE: 0 })
      expect(r.todayExams).toBe(13)
      expect(r.todayUsageMin).toBe(300)
      expect(r.faultsToday).toBe(1)
      expect(r.faultRate).toBe(33.3)
      expect(r.maintenanceDue).toBe(2)
      expect(r.byModality[0]).toMatchObject({ modality: 'CT', total: 2, online: 2 })
    })

    it('falls back to seed when no devices', async () => {
      mockPrisma.device.findMany.mockResolvedValue([])
      mockPrisma.device.groupBy.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.total).toBe(8)
      expect(r.online).toBe(6)
      expect(r.byState).toMatchObject({ MAINTENANCE: 1, BROKEN: 1 })
      expect(r.todayExams).toBe(31)
      expect(r.faultRate).toBe(12.5)
    })
  })

  describe('getUsageTrend', () => {
    it('buckets exam counts per day + by modality', async () => {
      const today = new Date()
      mockPrisma.exam.findMany.mockResolvedValue([
        { createdAt: new Date(today.setHours(10, 0, 0, 0)), modality: 'CT' },
        { createdAt: new Date(today.setHours(11, 0, 0, 0)), modality: 'CT' },
        { createdAt: new Date(today.setHours(12, 0, 0, 0)), modality: 'MR' },
      ])
      const r = await svc.getUsageTrend(5)
      expect(r.items).toHaveLength(5)
      expect(r.items[4].count).toBe(3)
      const ct = r.byModality.find((m: any) => m.modality === 'CT')!
      expect(ct.counts[4].count).toBe(2)
    })

    it('falls back to seed when no exams', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getUsageTrend(30)
      expect(r.items).toHaveLength(30)
      expect(r.items[0].count).toBeGreaterThan(0)
      expect(r.byModality[0].modality).toBe('CT')
    })
  })

  describe('getByRoom', () => {
    it('groups devices by location', async () => {
      mockPrisma.device.findMany.mockResolvedValue([
        device({ id: 'd1', location: 'CT室1', state: 'IN_USE', todayExams: 6 }),
        device({ id: 'd2', location: 'CT室1', state: 'IDLE', todayExams: 8 }),
        device({ id: 'd3', location: null, state: 'BROKEN', todayExams: 0 }),
      ])
      const r = await svc.getByRoom()
      expect(r.total).toBe(2)
      expect(r.items[0]).toMatchObject({ room: 'CT室1', devices: 2, online: 2, todayExams: 14 })
      expect(r.items[1]).toMatchObject({ room: '未分配', devices: 1, online: 0 })
    })

    it('falls back to seed when no devices', async () => {
      mockPrisma.device.findMany.mockResolvedValue([])
      const r = await svc.getByRoom()
      expect(r.items[0]).toMatchObject({ room: 'CT室1', devices: 1 })
      expect(r.total).toBe(4)
    })
  })

  describe('getMaintenanceCalendar', () => {
    it('groups plans by month with pending/overdue/cost', async () => {
      const now = new Date()
      const mk = (daysFromNow: number, status: string, cost: number | null) => {
        const d = new Date(now)
        d.setDate(d.getDate() + daysFromNow)
        return {
          id: `mp-${daysFromNow}`,
          deviceId: 'd1',
          deviceName: 'CT 1号机',
          maintenanceDate: d,
          intervalDays: 90,
          type: '定期保养',
          content: '',
          estimatedCost: cost === null ? null : cost,
          assignee: '',
          status,
          nextDate: d,
          completedAt: null,
          createdAt: now,
          updatedAt: now,
        }
      }
      const plans = [
        mk(-5, 'PENDING', 1200), // overdue
        mk(10, 'PENDING', 800),
        mk(20, 'COMPLETED', 400),
      ]
      mockPrisma.maintenancePlan.findMany.mockResolvedValue(plans)
      const r = await svc.getMaintenanceCalendar()
      expect(r.months.length).toBeGreaterThanOrEqual(1)
      expect(r.pendingCount).toBe(2)
      expect(r.overdueCount).toBe(1)
      expect(r.totalCost).toBe(2400)
      const totalItems = r.months.reduce((a: number, m: any) => a + m.items.length, 0)
      expect(totalItems).toBe(3)
      expect(r.months[0].items[0].deviceName).toBe('CT 1号机')
    })

    it('falls back to deterministic seed when no plans', async () => {
      mockPrisma.maintenancePlan.findMany.mockResolvedValue([])
      const r: any = await svc.getMaintenanceCalendar()
      expect(r.seeded).toBe(true)
      expect(r.pendingCount).toBe(4)
      expect(r.months.length).toBeGreaterThanOrEqual(1)
    })
  })
})
