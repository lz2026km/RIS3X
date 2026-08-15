import { AuditService } from '../src/modules/audit/audit.service'

// [v3.0.6.11-99 Wave 10E-3] audit 扩展端点: overview / user-activity / action-trend / high-risk
describe('AuditService Wave10E-3 (overview/user-activity/action-trend/high-risk)', () => {
  let svc: AuditService
  let mockPrisma: any

  const logRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'al1',
    tenantId: 't1',
    userId: 'u1',
    action: 'VIEW_REPORT',
    resource: 'report',
    resourceId: null,
    detail: null,
    ip: '10.0.0.1',
    userAgent: null,
    success: true,
    createdAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    jest.clearAllMocks()
    mockPrisma = {
      auditLog: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
      },
    }
    svc = new AuditService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates today ops/active users/high-risk/success from DB', async () => {
      mockPrisma.auditLog.count
        .mockResolvedValueOnce(45) // today
        .mockResolvedValueOnce(12000) // total
        .mockResolvedValueOnce(11500) // success
      mockPrisma.auditLog.findMany.mockResolvedValue([
        logRow({ action: 'LOGIN', userId: 'u1' }),
        logRow({ id: 'al2', action: 'DELETE_REPORT', userId: 'u2' }),
        logRow({ id: 'al3', action: 'LOGIN', userId: 'u1', success: false }),
        logRow({ id: 'al4', action: 'VIEW_REPORT', userId: 'u3' }),
      ])
      const r = await svc.getOverview()
      expect(r.seeded).toBe(false)
      expect(r.todayOperations).toBe(45)
      expect(r.totalOperations).toBe(12000)
      expect(r.activeUsers).toBe(3)
      expect(r.highRiskCount).toBe(1)
      expect(r.successCount).toBe(11500)
      expect(r.failedCount).toBe(500)
      expect(r.successRate).toBe(96)
      expect(r.topActions[0]).toMatchObject({ action: 'LOGIN', count: 2 })
    })

    it('falls back to deterministic seed when DB unavailable', async () => {
      mockPrisma.auditLog.count.mockRejectedValue(new Error('db down'))
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getOverview()
      expect(r.seeded).toBe(true)
      expect(r.todayOperations).toBeGreaterThan(300)
      expect(r.totalOperations).toBeGreaterThan(40000)
      expect(r.activeUsers).toBeGreaterThan(10)
      expect(r.highRiskCount).toBeGreaterThan(0)
      expect(r.successRate).toBeGreaterThan(90)
      const again = await svc.getOverview()
      expect(again).toEqual(r)
    })
  })

  describe('getUserActivity', () => {
    it('ranks users by count with lastActive + successRate', async () => {
      const now = new Date()
      mockPrisma.auditLog.findMany.mockResolvedValue([
        logRow({ userId: 'u1', success: true, createdAt: new Date(now.getTime() - 60000) }),
        logRow({ id: 'al2', userId: 'u1', success: true, createdAt: now }),
        logRow({ id: 'al3', userId: 'u2', success: false, createdAt: new Date(now.getTime() - 120000) }),
      ])
      const r = await svc.getUserActivity()
      expect(r).toHaveLength(2)
      expect(r[0]).toMatchObject({ userId: 'u1', count: 2, successRate: 100 })
      expect(r[1]).toMatchObject({ userId: 'u2', count: 1, successRate: 0 })
      expect(new Date(r[0].lastActive).getTime()).toBe(now.getTime())
    })

    it('returns deterministic seed ranking when no logs', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getUserActivity(10)
      expect(r).toHaveLength(6)
      expect(r[0].count).toBeGreaterThanOrEqual(r[1]!.count)
      expect(r[0].userName).toBeTruthy()
      expect(r[0].successRate).toBeGreaterThan(90)
      const again = await svc.getUserActivity(10)
      expect(again).toEqual(r)
      expect(await svc.getUserActivity(3)).toHaveLength(3)
    })
  })

  describe('getActionTrend', () => {
    it('buckets actions per day with high-risk/failed counts', async () => {
      const today = new Date()
      const yesterday = new Date(today.getTime() - 86400000)
      mockPrisma.auditLog.findMany.mockResolvedValue([
        logRow({ action: 'LOGIN', success: true, createdAt: today }),
        logRow({ id: 'al2', action: 'DELETE_REPORT', success: true, createdAt: today }),
        logRow({ id: 'al3', action: 'LOGIN', success: false, createdAt: today }),
        logRow({ id: 'al4', action: 'EXPORT_CSV', success: true, createdAt: yesterday }),
      ])
      const r = await svc.getActionTrend(7)
      expect(r).toHaveLength(7)
      const last = r[r.length - 1]!
      expect(last.total).toBe(3)
      expect(last.highRisk).toBe(1)
      expect(last.failed).toBe(1)
      expect(last.seeded).toBe(false)
      expect(r[r.length - 2]!.total).toBe(1)
    })

    it('returns deterministic 30-day seed trend when no data', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getActionTrend()
      expect(r).toHaveLength(30)
      expect(r.every((p) => p.seeded)).toBe(true)
      expect(r[0].total).toBeGreaterThan(0)
      expect(r[0].highRisk).toBeLessThanOrEqual(r[0].total)
      const again = await svc.getActionTrend()
      expect(again).toEqual(r)
      expect(await svc.getActionTrend(99)).toHaveLength(60)
    })
  })

  describe('getHighRisk', () => {
    it('extracts delete/export/batch actions with patterns and users', async () => {
      const now = new Date()
      mockPrisma.auditLog.findMany.mockResolvedValue([
        logRow({ action: 'DELETE_REPORT', userId: 'u1', createdAt: now }),
        logRow({ id: 'al2', action: 'DELETE_REPORT', userId: 'u2', createdAt: now }),
        logRow({ id: 'al3', action: 'EXPORT_CSV', userId: 'u1', createdAt: now }),
        logRow({ id: 'al4', action: 'BATCH_DELETE', userId: 'u3', createdAt: now }),
        logRow({ id: 'al5', action: 'LOGIN', userId: 'u1', createdAt: now }),
      ])
      const r = await svc.getHighRisk()
      expect(r.seeded).toBe(false)
      expect(r.total).toBe(4)
      expect(r.actions).toHaveLength(3)
      const del = r.actions.find((a) => a.action === 'DELETE_REPORT')!
      expect(del).toMatchObject({ pattern: 'delete', patternZh: '删除操作', count: 2 })
      expect(del.recentUsers).toEqual(['u1', 'u2'])
      expect(r.actions.find((a) => a.action === 'BATCH_DELETE')!.pattern).toBe('batch')
      expect(r.byPattern.find((p) => p.pattern === 'delete')!.count).toBe(2)
    })

    it('returns deterministic seed high-risk list when DB throws', async () => {
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('db down'))
      const r = await svc.getHighRisk()
      expect(r.seeded).toBe(true)
      expect(r.total).toBeGreaterThan(0)
      expect(r.actions.length).toBe(6)
      expect(r.actions[0].count).toBeGreaterThanOrEqual(r.actions[1]!.count)
      expect(r.byPattern.reduce((a, b) => a + b.count, 0)).toBe(r.total)
      const again = await svc.getHighRisk()
      expect(again).toEqual(r)
    })
  })
})
