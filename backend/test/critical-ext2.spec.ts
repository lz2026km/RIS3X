import { NotFoundException } from '@nestjs/common'
import { CriticalsService } from '../src/criticals/criticals.service'

// [v3.0.6.11-99 Wave 10D] criticals 扩展端点: overview / daily-trend / by-department / timeline
describe('CriticalsService Wave10D (overview/daily-trend/by-department/timeline)', () => {
  let svc: CriticalsService
  let mockPrisma: any

  const mockSystemConfig = { getNumber: jest.fn().mockResolvedValue(20) }

  beforeEach(() => {
    mockPrisma = {
      criticalValue: {
        count: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
      criticalValueNotification: { findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new CriticalsService(mockPrisma, mockSystemConfig as never)
  })

  describe('getOverview', () => {
    it('aggregates today/unhandled/timeout/severity/state', async () => {
      const now = Date.now()
      mockPrisma.criticalValue.count
        .mockResolvedValueOnce(2) // today
        .mockResolvedValueOnce(1) // unhandled
        .mockResolvedValueOnce(1) // timeout
      mockPrisma.criticalValue.groupBy
        .mockResolvedValueOnce([{ severity: 'HIGH', _count: { _all: 3 } }])
        .mockResolvedValueOnce([{ state: 'FOUND', _count: { _all: 2 } }, { state: 'RESOLVED', _count: { _all: 1 } }])
      mockPrisma.criticalValue.findMany
        .mockResolvedValueOnce([
          { createdAt: new Date(now - 20 * 60000), ackedAt: new Date(now - 5 * 60000) },
          { createdAt: new Date(now - 40 * 60000), ackedAt: new Date(now - 10 * 60000) },
        ])
        .mockResolvedValueOnce([
          { createdAt: new Date(now - 100 * 60000), closedAt: new Date(now - 10 * 60000) },
          { createdAt: new Date(now - 200 * 60000), closedAt: new Date(now - 80 * 60000) },
        ])
      const r = await svc.getOverview()
      expect(r.todayCount).toBe(2)
      expect(r.unhandled).toBe(1)
      expect(r.timeoutCount).toBe(1)
      expect(r.bySeverity).toEqual({ HIGH: 3 })
      expect(r.byState).toMatchObject({ FOUND: 2, RESOLVED: 1 })
      expect(r.total).toBe(3)
      expect(r.avgResponseMin).toBe(23)
      expect(r.avgCloseMin).toBe(105)
    })

    it('falls back to seed when DB empty', async () => {
      mockPrisma.criticalValue.count.mockResolvedValue(0)
      mockPrisma.criticalValue.groupBy.mockResolvedValue([])
      mockPrisma.criticalValue.findMany.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.total).toBe(18)
      expect(r.timeoutCount).toBe(2)
      expect(r.bySeverity.CRITICAL).toBe(4)
    })
  })

  describe('getDailyTrend', () => {
    it('buckets found/closed per day', async () => {
      const today = new Date()
      mockPrisma.criticalValue.findMany
        .mockResolvedValueOnce([{ createdAt: new Date(today.setHours(8, 0, 0, 0)) }])
        .mockResolvedValueOnce([{ closedAt: new Date(today.setHours(18, 0, 0, 0)) }])
      const r = await svc.getDailyTrend(7)
      expect(r.items).toHaveLength(7)
      expect(r.items[6].found).toBe(1)
      expect(r.items[6].closed).toBe(1)
    })

    it('falls back to seed when no data', async () => {
      mockPrisma.criticalValue.findMany.mockResolvedValue([])
      const r = await svc.getDailyTrend(30)
      expect(r.items).toHaveLength(30)
      expect(r.total).toBe(30)
    })
  })

  describe('getByDepartment', () => {
    it('groups notifications by recipientDept', async () => {
      mockPrisma.criticalValueNotification.findMany.mockResolvedValue([
        { recipientDept: '急诊科', status: 'SUCCESS', criticalId: 'c1', escalated: false },
        { recipientDept: '急诊科', status: 'FAILED', criticalId: 'c2', escalated: true },
        { recipientDept: '呼吸内科', status: 'SUCCESS', criticalId: 'c3', escalated: false },
        { recipientDept: '', status: 'SUCCESS', criticalId: 'c4', escalated: false },
      ])
      const r = await svc.getByDepartment()
      expect(r.total).toBe(3)
      expect(r.items[0]).toMatchObject({ department: '急诊科', total: 2, success: 1, pending: 1, escalated: 1, successRate: 50 })
      expect(r.items[1]).toMatchObject({ department: '呼吸内科', total: 1, success: 1, successRate: 100 })
      expect(r.items[2]).toMatchObject({ department: '未分配科室', total: 1 })
    })

    it('falls back to seed when no notifications', async () => {
      mockPrisma.criticalValueNotification.findMany.mockResolvedValue([])
      const r = await svc.getByDepartment()
      expect(r.items[0]).toMatchObject({ department: '急诊科', total: 12 })
    })
  })

  describe('getTimeline', () => {
    it('builds full flow timeline with steps', async () => {
      const now = Date.now()
      mockPrisma.criticalValue.findFirst.mockResolvedValue({
        id: 'c1',
        description: '张力性气胸',
        severity: 'CRITICAL',
        state: 'CLOSED_LOOP',
        createdAt: new Date(now - 120 * 60000),
        voiceCalledAt: new Date(now - 100 * 60000),
        voiceCalledBy: '放射科-王',
        ackedAt: new Date(now - 90 * 60000),
        ackedBy: '急诊科-李',
        confirmedAt: new Date(now - 60 * 60000),
        confirmedBy: '急诊科-李',
        confirmedComment: '已处理',
        resolvedAt: new Date(now - 30 * 60000),
        resolvedBy: '急诊科-李',
        closedAt: new Date(now),
        closedBy: '急诊科-李',
      })
      mockPrisma.criticalValueNotification.findMany.mockResolvedValue([
        { channel: 'SMS', status: 'SUCCESS', recipientName: '李医生', recipientDept: '急诊科', triggeredAt: new Date(now - 110 * 60000) },
      ])
      const r = await svc.getTimeline('c1')
      expect(r.state).toBe('CLOSED_LOOP')
      expect(r.steps).toMatchObject({ found: true, notified: true, voiceCalled: true, acknowledged: true, receipted: true, closed: true })
      const types = r.events.map((e: any) => e.type)
      expect(types[0]).toBe('found')
      expect(types).toContain('voice-call')
      expect(types).toContain('acknowledged')
      expect(types).toContain('receipted')
      expect(types).toContain('closed')
      expect(types).toContain('notification')
      const stamps = r.events.map((e: any) => e.timestamp)
      expect(stamps).toEqual([...stamps].sort())
    })

    it('throws NotFoundException for missing critical value', async () => {
      mockPrisma.criticalValue.findFirst.mockResolvedValue(null)
      await expect(svc.getTimeline('ghost')).rejects.toThrow(NotFoundException)
    })
  })
})
