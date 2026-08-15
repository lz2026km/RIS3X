import { BadRequestException } from '@nestjs/common'
import { WorklistService } from '../src/modules/worklist/worklist.service'

// [v3.0.6.11-100 Wave 1A] 技师 KPI 看板: GET /worklist/technician-dashboard
describe('WorklistService technician-dashboard (Wave 1A)', () => {
  let svc: WorklistService
  let mockPrisma: any

  const now = Date.now()

  beforeEach(() => {
    mockPrisma = {
      exam: {
        findUnique: jest.fn(),
        update: jest.fn(),
        groupBy: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      worklistOp: {
        findMany: jest.fn(),
      },
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    svc = new WorklistService(mockPrisma)
  })

  it('aggregates per-technician KPIs from ops + exam rows', async () => {
    mockPrisma.worklistOp.findMany.mockResolvedValue([
      { id: 'o1', op: 'COMPLETE', examId: 'e1', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
      { id: 'o2', op: 'COMPLETE', examId: 'e2', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
      { id: 'o3', op: 'START', examId: 'e3', actorId: 't2', actor: { id: 't2', fullName: '李技师' } },
    ])
    mockPrisma.exam.findMany.mockResolvedValue([
      {
        id: 'e1', startedAt: new Date(now - 40 * 60000), completedAt: new Date(now - 10 * 60000),
        scheduledAt: new Date(now - 70 * 60000), retakeCount: 1, deviceId: 'd1',
      },
      {
        id: 'e2', startedAt: new Date(now - 30 * 60000), completedAt: new Date(now),
        scheduledAt: new Date(now - 55 * 60000), retakeCount: 0, deviceId: 'd2',
      },
    ])
    const r = await svc.getTechnicianDashboard({})
    expect(r.technicians).toHaveLength(1)
    const t = r.technicians[0]
    expect(t).toMatchObject({
      id: 't1', name: '王技师', completedCount: 2, retakeCount: 1,
      avgDurationMin: 30, retakeRate: 50, avgWaitTime: 28,
      deviceUtilization: 100, onTimeRate: 100,
    })
    expect(r.totals.completedCount).toBe(2)
    expect(r.totals.retakeRate).toBe(50)
    expect(r.trend).toBeInstanceOf(Array)
    expect(r.trend.every((d: any) => typeof d.completed === 'number')).toBe(true)
  })

  it('computes wait-time / on-time rate with a late exam', async () => {
    mockPrisma.worklistOp.findMany.mockResolvedValue([
      { id: 'o1', op: 'COMPLETE', examId: 'e1', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
      { id: 'o2', op: 'COMPLETE', examId: 'e2', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
    ])
    mockPrisma.exam.findMany.mockResolvedValue([
      {
        id: 'e1', startedAt: new Date(now - 10 * 60000), completedAt: new Date(now),
        scheduledAt: new Date(now - 20 * 60000), retakeCount: 0, deviceId: 'd1',
      },
      {
        id: 'e2', startedAt: new Date(now - 10 * 60000), completedAt: new Date(now),
        scheduledAt: new Date(now - 90 * 60000), retakeCount: 0, deviceId: null,
      },
    ])
    const r = await svc.getTechnicianDashboard({})
    const t = r.technicians[0]
    expect(t.avgWaitTime).toBe(45) // (10 + 80) / 2
    expect(t.onTimeRate).toBe(50)  // 1/2 在 30min 内签到
    expect(t.deviceUtilization).toBe(50)
  })

  it('filters by technicianId', async () => {
    mockPrisma.worklistOp.findMany.mockResolvedValue([
      { id: 'o1', op: 'COMPLETE', examId: 'e1', actorId: 't2', actor: { id: 't2', fullName: '李技师' } },
    ])
    mockPrisma.exam.findMany.mockResolvedValue([
      {
        id: 'e1', startedAt: new Date(now - 30 * 60000), completedAt: new Date(now),
        scheduledAt: new Date(now - 50 * 60000), retakeCount: 2, deviceId: 'd1',
      },
    ])
    const r = await svc.getTechnicianDashboard({ technicianId: 't2' })
    expect(r.technicians).toHaveLength(1)
    expect(r.technicians[0].id).toBe('t2')
    expect(r.technicians[0].completedCount).toBe(1)
    expect(r.technicians[0].retakeRate).toBe(200)
    expect(mockPrisma.worklistOp.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ actorId: 't2' }) }),
    )
  })

  it('filters by date range (from/to)', async () => {
    mockPrisma.worklistOp.findMany.mockResolvedValue([])
    mockPrisma.exam.findMany.mockResolvedValue([])
    const r = await svc.getTechnicianDashboard({ from: '2026-08-01', to: '2026-08-10' })
    expect(r.technicians.length).toBeGreaterThan(0) // seed 回退
    const opCall = mockPrisma.worklistOp.findMany.mock.calls[0][0]
    expect(opCall.where.createdAt.gte).toEqual(new Date('2026-08-01T00:00:00'))
    expect(opCall.where.createdAt.lt).toBeDefined()
    const examCall = mockPrisma.exam.findMany.mock.calls[0][0]
    expect(examCall.where.completedAt.gte).toEqual(new Date('2026-08-01T00:00:00'))
    expect(r.from).toBe('2026-08-01')
    expect(r.to).toBe('2026-08-10')
    expect(r.trend[0].date).toBe('2026-08-01')
    expect(r.trend.length).toBeLessThanOrEqual(31)
  })

  it('rejects malformed from date', async () => {
    await expect(svc.getTechnicianDashboard({ from: '2026/08/01' })).rejects.toThrow(BadRequestException)
  })

  it('falls back to deterministic seed when DB is empty', async () => {
    mockPrisma.worklistOp.findMany.mockResolvedValue([])
    mockPrisma.exam.findMany.mockResolvedValue([])
    const r = await svc.getTechnicianDashboard({})
    expect(r.technicians).toHaveLength(3)
    expect(r.technicians[0]).toMatchObject({ name: '王技师', completedCount: 12, avgDurationMin: 24, retakeRate: 8.3 })
    expect(r.totals.completedCount).toBe(26)
    expect(r.totals.onTimeRate).toBe(79)
    expect(r.trend).toBeInstanceOf(Array)
    expect(r.trend.length).toBe(7) // 默认近 7 天
  })

  it('falls back to seed when DB query throws', async () => {
    mockPrisma.worklistOp.findMany.mockRejectedValue(new Error('table not found'))
    const r = await svc.getTechnicianDashboard({})
    expect(r.technicians).toHaveLength(3)
    expect(r.technicians[2]).toMatchObject({ name: '张技师', retakeCount: 2 })
    expect(r.totals.avgDurationMin).toBe(24)
  })

  it('seeds real technician roster with zero KPIs when users exist but no ops', async () => {
    mockPrisma.worklistOp.findMany.mockResolvedValue([])
    mockPrisma.exam.findMany.mockResolvedValue([])
    mockPrisma.user.findMany.mockResolvedValue([
      { id: 'u1', fullName: '陈技师' },
      { id: 'u2', fullName: '刘技师' },
    ])
    const r = await svc.getTechnicianDashboard({})
    expect(r.technicians.map((t: any) => t.name)).toEqual(['陈技师', '刘技师'])
    expect(r.technicians.every((t: any) => t.completedCount === 0)).toBe(true)
    expect(r.totals.completedCount).toBe(0)
  })
})
