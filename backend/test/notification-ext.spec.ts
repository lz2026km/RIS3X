import { NotificationsService } from '../src/notifications/notifications.service'

// [v3.0.6.11-99 Wave 10D] notifications 扩展端点: overview / daily-trend / preferences
describe('NotificationsService Wave10D (overview/daily-trend/preferences)', () => {
  let svc: NotificationsService
  let mockPrisma: any

  beforeEach(() => {
    mockPrisma = {
      notification: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
      },
    }
    svc = new NotificationsService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates byType/bySeverity/unread/today from notification table', async () => {
      mockPrisma.notification.groupBy
        .mockResolvedValueOnce([
          { type: 'REPORT', _count: { _all: 3 } },
          { type: 'CRITICAL', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ severity: 'INFO', _count: { _all: 3 } }, { severity: 'CRITICAL', _count: { _all: 1 } }])
      mockPrisma.notification.count
        .mockResolvedValueOnce(4) // total
        .mockResolvedValueOnce(1) // unread
        .mockResolvedValueOnce(2) // today
        .mockResolvedValueOnce(1) // critical unread
        .mockResolvedValueOnce(4) // lastWeek
        .mockResolvedValueOnce(5) // prevWeek
      const r = await svc.getOverview('u1')
      expect(r.userId).toBe('u1')
      expect(r.total).toBe(4)
      expect(r.unread).toBe(1)
      expect(r.today).toBe(2)
      expect(r.critical).toBe(1)
      expect(r.lastWeek).toBe(4)
      expect(r.lastWeekDeltaPercent).toBe(-20)
      expect(r.byType).toEqual({ REPORT: 3, CRITICAL: 1 })
      expect(r.bySeverity).toEqual({ INFO: 3, CRITICAL: 1 })
    })

    it('falls back to seed when DB returns no rows', async () => {
      mockPrisma.notification.groupBy.mockResolvedValue([])
      mockPrisma.notification.count.mockResolvedValue(0)
      const r = await svc.getOverview()
      expect(r.total).toBe(48)
      expect(r.byType).toMatchObject({ CRITICAL: 8, REPORT: 21 })
      expect(r.unread).toBe(6)
      expect(r.lastWeek).toBe(41)
    })

    it('falls back to seed when DB throws', async () => {
      mockPrisma.notification.groupBy.mockRejectedValue(new Error('no table'))
      const r = await svc.getOverview('u9')
      expect(r.userId).toBe('u9')
      expect(r.total).toBe(48)
    })
  })

  describe('getDailyTrend', () => {
    it('buckets total/unread/critical per day', async () => {
      const today = new Date()
      mockPrisma.notification.findMany.mockResolvedValue([
        { createdAt: new Date(today.setHours(9, 0, 0, 0)), read: false, severity: 'CRITICAL' },
        { createdAt: new Date(today.setHours(10, 0, 0, 0)), read: true, severity: 'INFO' },
        { createdAt: new Date(today.setHours(11, 0, 0, 0)), read: false, severity: 'INFO' },
      ])
      const r = await svc.getDailyTrend(7, 'u1')
      expect(r.items).toHaveLength(7)
      const last = r.items[6]
      expect(last.total).toBe(3)
      expect(last.unread).toBe(2)
      expect(last.critical).toBe(1)
    })

    it('falls back to seed when no data', async () => {
      mockPrisma.notification.findMany.mockResolvedValue([])
      const r = await svc.getDailyTrend(30)
      expect(r.items).toHaveLength(30)
      expect(r.total).toBe(30)
    })
  })

  describe('preferences', () => {
    it('returns defaults with defaulted flag when unset', () => {
      const r = svc.getPreferences('u1')
      expect(r.userId).toBe('u1')
      expect(r.defaulted).toBe(true)
      expect(r.types).toEqual(['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM'])
      expect(r.channels.APP).toBe(true)
      expect(r.quietHours).toEqual({ enabled: false, from: '22:00', to: '07:00' })
    })

    it('updatePreferences merges types/channels/quietHours and persists', () => {
      const updated = svc.updatePreferences('u1', {
        types: ['CRITICAL', 'SYSTEM'],
        channels: { EMAIL: true },
        quietHours: { enabled: true, from: '23:00', to: '06:00' },
      })
      expect(updated.defaulted).toBe(false)
      expect(updated.types).toEqual(['CRITICAL', 'SYSTEM'])
      expect(updated.channels.EMAIL).toBe(true)
      expect(updated.channels.SMS).toBe(true)
      expect(updated.quietHours).toMatchObject({ enabled: true, from: '23:00', to: '06:00' })
      const reread = svc.getPreferences('u1')
      expect(reread.defaulted).toBe(false)
      expect(reread.types).toEqual(['CRITICAL', 'SYSTEM'])
    })

    it('filters invalid types and falls back to defaults when all invalid', () => {
      const r = svc.updatePreferences('u2', { types: ['INVALID_A', 'INVALID_B'] })
      expect(r.types).toEqual(['CRITICAL', 'REPORT', 'FOLLOWUP', 'QUALITY', 'SYSTEM'])
    })
  })
})
