import { NotFoundException } from '@nestjs/common'
import { DeviceService, MAINTENANCE_CYCLE_HOURS } from '../src/modules/device/device.service'

// [v3.0.6.11-100 Wave 1B] 设备维护提醒: POST /devices/:id/maintenance-log + GET /devices/maintenance-due
describe('DeviceService Wave1B (maintenance-due + maintenance-log)', () => {
  let svc: DeviceService
  let mockPrisma: any

  const device = (overrides: Record<string, unknown> = {}) => ({
    id: 'dev1',
    tenantId: 'default',
    code: 'CT-001',
    name: 'CT 1号机',
    modality: 'CT',
    location: 'CT 室 1',
    state: 'IDLE',
    todayExams: 5,
    todayUsageMin: 120,
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      device: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      exam: {
        findMany: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
    }
    svc = new DeviceService(mockPrisma)
  })

  describe('getMaintenanceDue', () => {
    it('computes remaining hours from completed exam durations (cycle default 2000h)', async () => {
      const now = Date.now()
      mockPrisma.device.findMany.mockResolvedValue([device()])
      mockPrisma.exam.findMany.mockResolvedValue([
        { deviceId: 'dev1', startedAt: new Date(now - 60 * 60000), completedAt: new Date(now - 20 * 60000) },
        { deviceId: 'dev1', startedAt: new Date(now - 3 * 60000), completedAt: new Date(now) },
      ])
      const r = await svc.getMaintenanceDue()
      expect(r.total).toBe(1)
      const item = r.items[0]!
      expect(item.usedHours).toBe(0.7) // (40min + 3min) / 60 ≈ 0.7h
      expect(item.cycleHours).toBe(MAINTENANCE_CYCLE_HOURS)
      expect(item.status).toBe('ok')
      expect(item.remainingHours).toBeGreaterThan(0)
    })

    it('marks warning when remaining <= 25% of cycle', async () => {
      mockPrisma.device.findMany.mockResolvedValue([device()])
      mockPrisma.exam.findMany.mockResolvedValue([
        { deviceId: 'dev1', startedAt: new Date(Date.now() - 1600 * 3600000), completedAt: new Date(Date.now() - 30 * 3600000) },
      ])
      const r = await svc.getMaintenanceDue(2000)
      expect(r.items[0]!.status).toBe('warning')
      expect(r.items[0]!.remainingHours).toBeLessThanOrEqual(500)
    })

    it('marks overdue when usage exceeds cycle', async () => {
      mockPrisma.device.findMany.mockResolvedValue([device()])
      mockPrisma.exam.findMany.mockResolvedValue([
        { deviceId: 'dev1', startedAt: new Date(Date.now() - 2200 * 3600000), completedAt: new Date(Date.now() - 50 * 3600000) },
      ])
      const r = await svc.getMaintenanceDue(2000)
      expect(r.items[0]!.status).toBe('overdue')
      expect(r.items[0]!.remainingHours).toBe(0)
    })

    it('marks maintenance state devices with status maintenance', async () => {
      mockPrisma.device.findMany.mockResolvedValue([device({ state: 'MAINTENANCE' })])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getMaintenanceDue()
      expect(r.items[0]!.status).toBe('maintenance')
    })

    it('respects extras maintenanceHours explicit value (after maintenance reset)', async () => {
      mockPrisma.device.findMany.mockResolvedValue([device()])
      mockPrisma.exam.findMany.mockResolvedValue([])
      // 先记录维护 → maintenanceHours=0 + lastMaintenanceAt
      mockPrisma.device.findUnique.mockResolvedValue(device())
      await svc.logMaintenance('dev1', { type: 'preventive', hoursUsed: 1200, note: '季度保养' })
      const r = await svc.getMaintenanceDue()
      const item = r.items[0]!
      expect(item.usedHours).toBe(0)
      expect(item.status).toBe('ok')
      expect(item.lastMaintenance).not.toBeNull()
      expect(item.logs).toHaveLength(1)
    })

    it('sorts overdue before warning before ok', async () => {
      mockPrisma.device.findMany.mockResolvedValue([
        device({ id: 'ok1', code: 'A' }),
        device({ id: 'warn1', code: 'B' }),
        device({ id: 'over1', code: 'C' }),
      ])
      mockPrisma.exam.findMany.mockResolvedValue([
        { deviceId: 'over1', startedAt: new Date(Date.now() - 2300 * 3600000), completedAt: new Date(Date.now() - 100 * 3600000) },
        { deviceId: 'warn1', startedAt: new Date(Date.now() - 1700 * 3600000), completedAt: new Date(Date.now() - 100 * 3600000) },
      ])
      const r = await svc.getMaintenanceDue()
      expect(r.items.map((i) => i.status)).toEqual(['overdue', 'warning', 'ok'])
    })
  })

  describe('logMaintenance', () => {
    it('records maintenance log with type/hoursUsed/note and resets lastMaintenanceAt', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(device())
      const res = await svc.logMaintenance('dev1', { type: 'corrective', hoursUsed: 25, note: '更换球管' })
      expect(res.lastMaintenanceAt).not.toBeNull()
      expect(Array.isArray((res as any).maintenanceLogs)).toBe(true)
      expect((res as any).maintenanceLogs[0]).toMatchObject({ type: 'corrective', hoursUsed: 25, note: '更换球管' })
      expect((res as any).maintenanceHours).toBe(0)
    })

    it('throws NotFoundException for missing device', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(null)
      await expect(svc.logMaintenance('nope', { type: 'preventive' })).rejects.toBeInstanceOf(NotFoundException)
    })

    it('getStats exposes maintenance fields', async () => {
      mockPrisma.device.findUnique.mockResolvedValue(device())
      await svc.logMaintenance('dev1', { type: 'preventive', hoursUsed: 10 })
      const stats = await svc.getStats('dev1')
      expect(stats).toMatchObject({ todayExams: 0, totalExams: 5, usageMinutes: 120 })
      expect(stats.maintenanceHours).toBe(0)
      expect(stats.lastMaintenanceAt).not.toBeNull()
      expect(stats.maintenanceLogs).toHaveLength(1)
    })
  })
})
