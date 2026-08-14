import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WorklistService } from '../src/modules/worklist/worklist.service'

// [v3.0.6.11-99 Wave 10D] worklist 扩展端点: overview / by-modality / timeline / notes / technician-stats
describe('WorklistService Wave10D (overview/by-modality/timeline/notes/technician-stats)', () => {
  let svc: WorklistService
  let mockPrisma: any

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
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    svc = new WorklistService(mockPrisma)
  })

  describe('getOverview', () => {
    it('aggregates byState/byModality/byRoom from exam data', async () => {
      mockPrisma.exam.groupBy
        .mockResolvedValueOnce([
          { state: 'COMPLETED', _count: { _all: 2 } },
          { state: 'SCHEDULED', _count: { _all: 1 } },
        ])
        .mockResolvedValueOnce([{ modality: 'CT', _count: { _all: 2 } }, { modality: 'MR', _count: { _all: 1 } }])
      mockPrisma.exam.count.mockResolvedValue(1)
      const now = Date.now()
      mockPrisma.exam.findMany
        .mockResolvedValueOnce([
          { id: 'e1', state: 'COMPLETED', modality: 'CT', device: { location: 'CT室1', name: 'CT-01' } },
          { id: 'e2', state: 'IN_PROGRESS', modality: 'CT', device: { location: 'CT室1', name: 'CT-01' } },
          { id: 'e3', state: 'SCHEDULED', modality: 'MR', device: null },
        ])
        .mockResolvedValueOnce([
          { startedAt: new Date(now - 40 * 60000), completedAt: new Date(now - 20 * 60000) },
          { startedAt: new Date(now - 30 * 60000), completedAt: new Date(now) },
        ])
      const r = await svc.getOverview()
      expect(r.total).toBe(3)
      expect(r.byStatus).toMatchObject({ COMPLETED: 2, SCHEDULED: 1 })
      expect(r.completedToday).toBe(1)
      expect(r.completedRate).toBe(33.3)
      expect(r.avgDurationMin).toBe(25)
      expect(r.todayTotal).toBe(3)
      expect(r.byModality[0]).toEqual({ modality: 'CT', count: 2 })
      expect(r.byRoom[0]).toMatchObject({ room: 'CT室1', count: 2, completed: 1, inProgress: 1 })
      expect(r.byRoom[1]).toMatchObject({ room: '未分配', count: 1 })
      expect(r.byHour).toHaveLength(24)
      expect(r.peakHour).toMatch(/^\d{2}:00$/)
      const localKey = (d: Date) => {
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const day = String(d.getDate()).padStart(2, '0')
        return `${d.getFullYear()}-${m}-${day}`
      }
      expect(r.date).toBe(localKey(new Date()))
    })

    it('falls back to deterministic seed when DB is empty', async () => {
      mockPrisma.exam.groupBy.mockResolvedValue([])
      mockPrisma.exam.count.mockResolvedValue(0)
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.total).toBe(86)
      expect(r.byStatus).toMatchObject({ SCHEDULED: 12, COMPLETED: 46 })
      expect(r.byRoom[0].room).toBe('CT室1')
      expect(r.completedToday).toBe(12)
      expect(r.byHour).toHaveLength(24)
      expect(r.peakHour).toBe('10:00')
    })

    it('falls back to deterministic seed when DB query throws', async () => {
      mockPrisma.exam.groupBy.mockRejectedValue(new Error('table not found'))
      const r = await svc.getOverview()
      expect(r.total).toBe(86)
      expect(r.byModality[0]).toMatchObject({ modality: 'CT', count: 20 })
    })
  })

  describe('getByModality', () => {
    it('computes totals/inProgress/completed/avgDurationMin per modality', async () => {
      const now = Date.now()
      mockPrisma.exam.groupBy.mockResolvedValue([
        { modality: 'CT', state: 'COMPLETED', _count: { _all: 3 } },
        { modality: 'CT', state: 'IN_PROGRESS', _count: { _all: 1 } },
        { modality: 'MR', state: 'SCHEDULED', _count: { _all: 2 } },
      ])
      mockPrisma.exam.findMany.mockResolvedValue([
        { modality: 'CT', startedAt: new Date(now - 30 * 60000), completedAt: new Date(now) },
        { modality: 'CT', startedAt: new Date(now - 10 * 60000), completedAt: new Date(now) },
      ])
      const r = await svc.getByModality()
      expect(r.total).toBe(2)
      const ct = r.items.find((i: any) => i.modality === 'CT')!
      expect(ct).toMatchObject({ total: 4, inProgress: 1, completed: 3, todayCompleted: 2 })
      expect(ct.avgDurationMin).toBe(20)
      const mr = r.items.find((i: any) => i.modality === 'MR')!
      expect(mr).toMatchObject({ total: 2, inProgress: 0, completed: 0 })
      expect(r.items[0].modality).toBe('CT')
    })

    it('falls back to seed when no modality data', async () => {
      mockPrisma.exam.groupBy.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getByModality()
      expect(r.items[0]).toMatchObject({ modality: 'CT', total: 20 })
    })
  })

  describe('getTimeline', () => {
    it('builds ordered event stream from exam fields + ops + audit', async () => {
      const now = Date.now()
      const exam = {
        id: 'e1',
        accessionNumber: 'ACC001',
        patientId: 'p1',
        modality: 'CT',
        bodyPart: '胸部',
        state: 'COMPLETED',
        createdAt: new Date(now - 3600 * 60000),
        scheduledAt: new Date(now - 200 * 60000),
        startedAt: new Date(now - 100 * 60000),
        pausedAt: new Date(now - 60 * 60000),
        completedAt: new Date(now),
        retakeCount: 1,
        qualityRating: 'A',
        qcNotes: '图像清晰',
        patient: { name: '张三', phone: '13800000000', gender: 'MALE' },
      }
      mockPrisma.exam.findUnique.mockResolvedValue(exam)
      mockPrisma.worklistOp.findMany.mockResolvedValue([
        { op: 'START', createdAt: new Date(now - 99 * 60000), actor: { fullName: '王技师' } },
        { op: 'COMPLETE', createdAt: new Date(now), actor: { fullName: '王技师' } },
      ])
      const r = await svc.getTimeline('e1')
      expect(r.examId).toBe('e1')
      expect(r.patientName).toBe('张三')
      expect(r.patientPhone).toBe('13800000000')
      expect(r.patientGender).toBe('MALE')
      expect(r.modality).toBe('CT')
      const types = r.events.map((e: any) => e.type)
      expect(types).toContain('register')
      expect(types).toContain('checkin')
      expect(types).toContain('pause')
      expect(types).toContain('complete')
      expect(types).toContain('retake')
      expect(types).toContain('qc-rating')
      expect(types).toContain('op')
      // 时间升序
      const stamps = r.events.map((e: any) => e.timestamp)
      expect(stamps).toEqual([...stamps].sort())
      const opEvent = r.events.find((e: any) => e.type === 'op')!
      expect(opEvent.actor).toBe('王技师')
    })

    it('throws NotFoundException for missing exam', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue(null)
      await expect(svc.getTimeline('ghost')).rejects.toThrow(NotFoundException)
    })

    it('keeps working when ops/audit tables are unavailable', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({
        id: 'e1',
        accessionNumber: 'A1',
        state: 'SCHEDULED',
        createdAt: new Date(),
        scheduledAt: null,
        startedAt: null,
        pausedAt: null,
        completedAt: null,
        patient: { name: '李四' },
      })
      mockPrisma.worklistOp.findMany.mockRejectedValue(new Error('no table'))
      mockPrisma.auditLog.findMany.mockRejectedValue(new Error('no table'))
      const r = await svc.getTimeline('e1')
      expect(r.events.length).toBeGreaterThanOrEqual(1)
      expect(r.events[0].type).toBe('register')
    })
  })

  describe('saveNotes', () => {
    it('appends timestamped note to existing techNotes', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', state: 'IN_PROGRESS', techNotes: '上一行', patient: {} })
      mockPrisma.exam.update.mockImplementation(async ({ data }: any) => ({ id: 'e1', ...data, patient: {} }))
      const r = await svc.saveNotes('e1', '体位纠正')
      expect(r.ok).toBe(true)
      expect(r.techNotes).toContain('上一行')
      expect(r.techNotes).toContain('体位纠正')
      expect(mockPrisma.exam.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ techNotes: expect.stringContaining('体位纠正') }) }))
    })

    it('latest mode overwrites previous notes', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', state: 'IN_PROGRESS', techNotes: '旧备注', patient: {} })
      mockPrisma.exam.update.mockImplementation(async ({ data }: any) => ({ id: 'e1', ...data, patient: {} }))
      const r = await svc.saveNotes('e1', '新备注', { latest: true })
      expect(r.techNotes).toBe('新备注')
    })

    it('rejects empty note', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', state: 'IN_PROGRESS', patient: {} })
      await expect(svc.saveNotes('e1', '   ')).rejects.toThrow(BadRequestException)
    })

    it('falls back to memory when techNotes column missing in DB', async () => {
      mockPrisma.exam.findUnique.mockResolvedValue({ id: 'e1', state: 'IN_PROGRESS', patient: {} })
      mockPrisma.exam.update
        .mockRejectedValueOnce(new Error('column tech_notes does not exist'))
        .mockResolvedValueOnce({ id: 'e1', state: 'IN_PROGRESS', patient: {} })
      const r = await svc.saveNotes('e1', '内存备注')
      expect(r.ok).toBe(true)
      expect(r.techNotes).toContain('内存备注')
      expect(mockPrisma.exam.update).toHaveBeenCalledTimes(2)
    })
  })

  describe('getTechnicianStats', () => {
    it('aggregates completed/retake/avg duration per technician', async () => {
      const now = Date.now()
      mockPrisma.worklistOp.findMany.mockResolvedValue([
        { id: 'o1', op: 'COMPLETE', examId: 'e1', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
        { id: 'o2', op: 'START', examId: 'e2', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
        { id: 'o3', op: 'COMPLETE', examId: 'e2', actorId: 't1', actor: { id: 't1', fullName: '王技师' } },
      ])
      mockPrisma.exam.findMany
        .mockResolvedValueOnce([
          { id: 'e1', startedAt: new Date(now - 40 * 60000), completedAt: new Date(now - 10 * 60000), retakeCount: 1 },
          { id: 'e2', startedAt: new Date(now - 30 * 60000), completedAt: new Date(now), retakeCount: 0 },
        ])
        .mockResolvedValueOnce([{ id: 'e1', retakeCount: 1 }])
      const r = await svc.getTechnicianStats()
      expect(r.summary.totalCompleted).toBe(2)
      expect(r.summary.totalRetake).toBe(1)
      const tech = r.technicians[0]
      expect(tech).toMatchObject({ id: 't1', name: '王技师', completedCount: 2, retakeCount: 1 })
      expect(tech.avgDurationMin).toBe(30)
    })

    it('falls back to seed when no ops', async () => {
      mockPrisma.worklistOp.findMany.mockResolvedValue([])
      mockPrisma.exam.findMany.mockResolvedValue([])
      const r = await svc.getTechnicianStats()
      expect(r.technicians).toHaveLength(3)
      expect(r.technicians[0]).toMatchObject({ name: '王技师', completedCount: 9 })
      expect(r.summary.totalCompleted).toBe(19)
    })
  })
})
