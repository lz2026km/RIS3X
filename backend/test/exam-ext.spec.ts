import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ExamService } from '../src/modules/exam/exam.service'

// [v3.0.6.11-99 Wave 10D] exam 扩展端点: overview / by-modality / daily-trend / timeline / notes
describe('ExamService Wave10D (overview/by-modality/daily-trend/timeline/notes)', () => {
  let svc: ExamService
  let mockPrisma: any

  const mockSystemConfig = { getNumber: jest.fn().mockResolvedValue(20) }

  beforeEach(() => {
    mockPrisma = {
      exam: {
        groupBy: jest.fn(),
        count: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      worklistOp: { findMany: jest.fn().mockResolvedValue([]) },
      auditLog: { findMany: jest.fn().mockResolvedValue([]) },
    }
    svc = new ExamService(mockPrisma, mockSystemConfig as never)
  })

  describe('getOverview', () => {
    it('aggregates byState/byModality/today counts', async () => {
      const now = Date.now()
      mockPrisma.exam.groupBy
        .mockResolvedValueOnce([
          { state: 'COMPLETED', _count: { _all: 2 } },
          { state: 'SCHEDULED', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ modality: 'CT', _count: { _all: 2 } }, { modality: 'MR', _count: { _all: 1 } }])
      mockPrisma.exam.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1)
      mockPrisma.exam.findMany
        .mockResolvedValueOnce([
          { startedAt: new Date(now - 40 * 60000), completedAt: new Date(now - 20 * 60000) },
          { startedAt: new Date(now - 20 * 60000), completedAt: new Date(now) },
        ])
        .mockResolvedValueOnce([{ retakeCount: 2 }])
      const r = await svc.getOverview()
      expect(r.total).toBe(3)
      expect(r.byState).toMatchObject({ COMPLETED: 2, SCHEDULED: 1 })
      expect(r.todayScheduled).toBe(2)
      expect(r.todayCompleted).toBe(1)
      expect(r.avgDurationMin).toBe(20)
      expect(r.totalRetake).toBe(2)
      expect(r.retakeRate).toBe(66.7)
      expect(r.byModality[0]).toEqual({ modality: 'CT', count: 2 })
    })

    it('falls back to seed when DB empty', async () => {
      mockPrisma.exam.groupBy.mockResolvedValue([])
      mockPrisma.exam.count.mockResolvedValue(0)
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.total).toBe(86)
      expect(r.byState.COMPLETED).toBe(46)
      expect(r.byModality[0].modality).toBe('CT')
      expect(r.avgDurationMin).toBe(26)
      expect(r.totalRetake).toBe(3)
    })
  })

  describe('getByModality', () => {
    it('computes totals/inProgress/completed/avg per modality', async () => {
      const now = Date.now()
      mockPrisma.exam.groupBy.mockResolvedValue([
        { modality: 'CT', state: 'COMPLETED', _count: { _all: 2 } },
        { modality: 'CT', state: 'IN_PROGRESS', _count: { _all: 1 } },
      ])
      mockPrisma.exam.findMany.mockResolvedValue([
        { modality: 'CT', startedAt: new Date(now - 40 * 60000), completedAt: new Date(now - 20 * 60000) },
        { modality: 'CT', startedAt: new Date(now - 20 * 60000), completedAt: new Date(now) },
      ])
      const r = await svc.getByModality()
      expect(r.total).toBe(1)
      expect(r.items[0]).toMatchObject({ modality: 'CT', total: 3, inProgress: 1, completed: 2 })
      expect(r.items[0].avgDurationMin).toBe(20)
    })

    it('falls back to seed when no data', async () => {
      mockPrisma.exam.groupBy.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getByModality()
      expect(r.items[0]).toMatchObject({ modality: 'CT', total: 20 })
      expect(r.total).toBe(3)
    })
  })

  describe('getDailyTrend', () => {
    it('buckets created/completed per day (local dates)', async () => {
      const today = new Date()
      mockPrisma.exam.findMany
        .mockResolvedValueOnce([{ createdAt: new Date(today.setHours(9, 0, 0, 0)) }])
        .mockResolvedValueOnce([{ completedAt: new Date(today.setHours(15, 0, 0, 0)) }])
      const r = await svc.getDailyTrend(5)
      expect(r.items).toHaveLength(5)
      expect(r.items[4].created).toBe(1)
      expect(r.items[4].completed).toBe(1)
    })

    it('falls back to seed when no data', async () => {
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getDailyTrend(30)
      expect(r.items).toHaveLength(30)
      expect(r.items[0].created).toBeGreaterThan(0)
    })
  })

  describe('getTimeline', () => {
    it('builds ordered events from exam fields + ops + notes', async () => {
      const now = Date.now()
      mockPrisma.exam.findFirst.mockResolvedValue({
        id: 'e1',
        accessionNumber: 'ACC1',
        modality: 'CT',
        bodyPart: '头部',
        state: 'COMPLETED',
        createdAt: new Date(now - 300 * 60000),
        scheduledAt: new Date(now - 200 * 60000),
        startedAt: new Date(now - 100 * 60000),
        pausedAt: new Date(now - 80 * 60000),
        completedAt: new Date(now),
        retakeCount: 1,
        qualityRating: 'B',
        patient: { name: '王五' },
        device: null,
        reports: [{ id: 'r1', state: 'PUBLISHED', createdAt: new Date(now) }],
      })
      mockPrisma.worklistOp.findMany.mockResolvedValue([
        { op: 'COMPLETE', createdAt: new Date(now), actor: { fullName: '李技师' } },
      ])
      const r = await svc.getTimeline('e1')
      expect(r.patientName).toBe('王五')
      const types = r.events.map((e: any) => e.type)
      expect(types).toContain('register')
      expect(types).toContain('checkin')
      expect(types).toContain('pause')
      expect(types).toContain('complete')
      expect(types).toContain('retake')
      expect(types).toContain('report')
      expect(types).toContain('op')
      const stamps = r.events.map((e: any) => e.timestamp)
      expect(stamps).toEqual([...stamps].sort())
    })

    it('throws NotFoundException for missing exam', async () => {
      mockPrisma.exam.findFirst.mockResolvedValue(null)
      await expect(svc.getTimeline('ghost')).rejects.toThrow(NotFoundException)
    })
  })

  describe('saveNotes', () => {
    it('appends timestamped note and persists techNotes', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', techNotes: '旧备注', state: 'IN_PROGRESS' })
      mockPrisma.exam.update.mockImplementation(async ({ data }: any) => ({ id: 'e1', ...data }))
      const r = await svc.saveNotes('e1', '患者沟通完成')
      expect(r.ok).toBe(true)
      expect(r.techNotes).toContain('旧备注')
      expect(r.techNotes).toContain('患者沟通完成')
      expect(mockPrisma.exam.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ techNotes: expect.stringContaining('患者沟通完成') }) }))
    })

    it('falls back to memory when techNotes column missing', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', state: 'IN_PROGRESS' })
      mockPrisma.exam.update
        .mockRejectedValueOnce(new Error('column does not exist'))
        .mockResolvedValueOnce({ id: 'e1', state: 'IN_PROGRESS' })
      const r = await svc.saveNotes('e1', '内存备注')
      expect(r.ok).toBe(true)
      expect(r.techNotes).toContain('内存备注')
      expect(mockPrisma.exam.update).toHaveBeenCalledTimes(2)
    })

    it('rejects empty note and missing exam', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1' })
      await expect(svc.saveNotes('e1', '  ')).rejects.toThrow(BadRequestException)
      mockPrisma.exam.findUnique.mockResolvedValue(null)
      await expect(svc.saveNotes('ghost', 'x')).rejects.toThrow(NotFoundException)
    })
  })
})
