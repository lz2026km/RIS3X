import { BadRequestException, NotFoundException } from '@nestjs/common'
import { WorklistService } from './worklist.service'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    exam: {
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      updateMany: jest.fn().mockRejectedValue(new Error('no db')),
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
    },
    report: {
      findFirst: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
    },
    user: { findUnique: jest.fn().mockRejectedValue(new Error('no db')) },
    device: { findUnique: jest.fn().mockRejectedValue(new Error('no db')) },
    worklistOp: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

const exam = { id: 'E1', tenantId: 'default', patientId: 'P1', accessionNumber: 'ACC-001', modality: 'CT', bodyPart: '头部', state: 'SCHEDULED', deviceId: null }

describe('WorklistService', () => {
  describe('list', () => {
    it('applies status/modality/patientId filters and pagination', async () => {
      const findMany = jest.fn().mockResolvedValue([exam])
      const count = jest.fn().mockResolvedValue(1)
      const prisma = makePrisma({ exam: { findMany, count } })
      const service = new WorklistService(prisma)
      const res = await service.list({ page: 2, pageSize: 25, status: 'ARRIVED', modality: 'CT', patientId: 'P1' })
      expect(res.total).toBe(1)
      expect(res.items).toHaveLength(1)
      expect(res.page).toBe(2)
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        skip: 25,
        take: 25,
        where: expect.objectContaining({ state: 'ARRIVED', modality: 'CT', patientId: 'P1', tenantId: 'default' }),
      }))
      expect(count).toHaveBeenCalledWith({ where: expect.objectContaining({ state: 'ARRIVED' }) })
    })

    it('builds OR search across accessionNumber/bodyPart/patient name', async () => {
      const findMany = jest.fn().mockResolvedValue([exam])
      const prisma = makePrisma({ exam: { findMany, count: jest.fn().mockResolvedValue(1) } })
      const service = new WorklistService(prisma)
      await service.list({ search: '张' })
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { accessionNumber: { contains: '张' } },
            { bodyPart: { contains: '张' } },
            { patient: { name: { contains: '张' } } },
          ],
        }),
      }))
    })

    it('filters by scheduledAt window when dateFrom/dateTo given', async () => {
      const findMany = jest.fn().mockResolvedValue([])
      const prisma = makePrisma({ exam: { findMany, count: jest.fn().mockResolvedValue(0) } })
      const service = new WorklistService(prisma)
      await service.list({ dateFrom: '2026-08-01T00:00:00.000Z', dateTo: '2026-08-07T23:59:59.000Z' })
      expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({
          scheduledAt: { gte: new Date('2026-08-01T00:00:00.000Z'), lte: new Date('2026-08-07T23:59:59.000Z') },
        }),
      }))
    })
  })

  describe('getById', () => {
    it('returns exam with patient/device/reports includes', async () => {
      const findFirst = jest.fn().mockResolvedValue({ ...exam, patient: { id: 'P1' }, device: null, reports: [] })
      const prisma = makePrisma({ exam: { findFirst } })
      const service = new WorklistService(prisma)
      const res = await service.getById('E1')
      expect(res.id).toBe('E1')
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'E1', tenantId: 'default' },
      }))
    })

    it('throws 404 for missing exam', async () => {
      const prisma = makePrisma({ exam: { findFirst: jest.fn().mockResolvedValue(null) } })
      const service = new WorklistService(prisma)
      await expect(service.getById('gone')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('update', () => {
    it('sets state/deviceId/bodyPart and converts scheduledAt', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'ARRIVED' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam), update },
      })
      const service = new WorklistService(prisma)
      await service.update('E1', { state: 'ARRIVED', deviceId: 'D1', bodyPart: '胸部', scheduledAt: '2026-08-08T02:00:00.000Z' })
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'E1' },
        data: expect.objectContaining({
          state: 'ARRIVED',
          deviceId: 'D1',
          bodyPart: '胸部',
          scheduledAt: new Date('2026-08-08T02:00:00.000Z'),
        }),
      }))
    })

    it('throws 404 when exam missing', async () => {
      const prisma = makePrisma({ exam: { findUnique: jest.fn().mockResolvedValue(null) } })
      const service = new WorklistService(prisma)
      await expect(service.update('gone', { state: 'ARRIVED' })).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('assign', () => {
    it('sets deviceId on exam (validating device exists)', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, deviceId: 'D1' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam), update },
        device: { findUnique: jest.fn().mockResolvedValue({ id: 'D1' }) },
      })
      const service = new WorklistService(prisma)
      const res = await service.assign('E1', { deviceId: 'D1' })
      expect(res.deviceId).toBe('D1')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { deviceId: 'D1' } }))
    })

    it('rejects unknown device', async () => {
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam) },
        device: { findUnique: jest.fn().mockResolvedValue(null) },
      })
      const service = new WorklistService(prisma)
      await expect(service.assign('E1', { deviceId: 'NOPE' })).rejects.toBeInstanceOf(BadRequestException)
    })

    it('updates existing report radiologistId when doctor assigned', async () => {
      const reportUpdate = jest.fn().mockResolvedValue({ id: 'R1', radiologistId: 'U1' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam), update: jest.fn().mockResolvedValue(exam) },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'U1', role: 'DOCTOR' }) },
        report: {
          findFirst: jest.fn().mockResolvedValue({ id: 'R1' }),
          update: reportUpdate,
        },
      })
      const service = new WorklistService(prisma)
      await service.assign('E1', { doctorId: 'U1' })
      expect(reportUpdate).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'R1' },
        data: { radiologistId: 'U1' },
      }))
    })

    it('creates a PENDING_ASSIGNMENT report when exam has none', async () => {
      const reportCreate = jest.fn().mockResolvedValue({ id: 'R2' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam), update: jest.fn().mockResolvedValue(exam) },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'U1' }) },
        report: { findFirst: jest.fn().mockResolvedValue(null), create: reportCreate },
      })
      const service = new WorklistService(prisma)
      await service.assign('E1', { doctorId: 'U1' })
      expect(reportCreate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({
          examId: 'E1',
          patientId: 'P1',
          radiologistId: 'U1',
          state: 'PENDING_ASSIGNMENT',
        }),
      }))
    })

    it('rejects empty assignment body', async () => {
      const prisma = makePrisma({})
      const service = new WorklistService(prisma)
      await expect(service.assign('E1', {})).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('getStats', () => {
    it('aggregates counts by status with zero-filled buckets', async () => {
      const groupBy = jest.fn().mockResolvedValue([
        { state: 'SCHEDULED', _count: { _all: 3 } },
        { state: 'IN_PROGRESS', _count: { _all: 2 } },
      ])
      const count = jest.fn().mockResolvedValue(5)
      const findMany = jest.fn().mockResolvedValue([])
      const ops = jest.fn().mockResolvedValue([])
      const prisma = makePrisma({ exam: { groupBy, count, findMany }, worklistOp: { findMany: ops } })
      const service = new WorklistService(prisma)
      const res = await service.getStats()
      expect(res.total).toBe(5)
      expect(res.byStatus).toEqual({
        SCHEDULED: 3,
        ARRIVED: 0,
        IN_PROGRESS: 2,
        PAUSED: 0,
        COMPLETED: 0,
        CANCELLED: 0,
      })
      expect(groupBy).toHaveBeenCalledWith(expect.objectContaining({ by: ['state'] }))
    })

    // [v3.0.6.11-95 Wave1B] stats 扩展: completedToday / avgDurationMin / byTechnician
    it('extends stats with completedToday, avgDurationMin and byTechnician (from ops)', async () => {
      const groupBy = jest.fn().mockResolvedValue([{ state: 'COMPLETED', _count: { _all: 2 } }])
      const count = jest.fn().mockResolvedValue(2)
      const findMany = jest.fn().mockResolvedValue([
        { id: 'E1', startedAt: new Date('2026-08-10T01:00:00.000Z'), completedAt: new Date('2026-08-10T01:30:00.000Z') },
        { id: 'E2', startedAt: new Date('2026-08-10T02:00:00.000Z'), completedAt: new Date('2026-08-10T02:40:00.000Z') },
      ])
      const ops = jest.fn().mockResolvedValue([
        { id: 'OP1', op: 'START', examId: 'E1', actorId: 'T1', actor: { id: 'T1', fullName: '王技师' } },
        { id: 'OP2', op: 'COMPLETE', examId: 'E1', actorId: 'T1', actor: { id: 'T1', fullName: '王技师' } },
        { id: 'OP3', op: 'COMPLETE', examId: 'E2', actorId: 'T2', actor: { id: 'T2', fullName: '李技师' } },
      ])
      const prisma = makePrisma({ exam: { groupBy, count, findMany }, worklistOp: { findMany: ops } })
      const service = new WorklistService(prisma)
      const res = await service.getStats()
      expect(res.completedToday).toBe(2)
      expect(res.avgDurationMin).toBe(35) // (30 + 40) / 2
      expect(res.byTechnician).toHaveLength(2)
      const t1 = res.byTechnician.find((t: { id: string }) => t.id === 'T1')!
      expect(t1.name).toBe('王技师')
      expect(t1.completedCount).toBe(1)
      expect(t1.avgDurationMin).toBe(30)
      expect(count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ completedAt: { gte: expect.any(Date) } }) }))
    })

    it('uses seed fallback for avgDurationMin/byTechnician when no durations/ops exist', async () => {
      const prisma = makePrisma({
        exam: {
          groupBy: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValue(0),
          findMany: jest.fn().mockResolvedValue([]),
        },
        worklistOp: { findMany: jest.fn().mockResolvedValue([]) },
      })
      const service = new WorklistService(prisma)
      const res = await service.getStats()
      expect(res.completedToday).toBe(0)
      expect(res.avgDurationMin).toBeGreaterThan(0)
      expect(res.byTechnician.length).toBeGreaterThan(0)
    })
  })

  describe('batchAssign', () => {
    it('updateMany sets device for all ids and returns count', async () => {
      const updateMany = jest.fn().mockResolvedValue({ count: 2 })
      const prisma = makePrisma({
        exam: { updateMany },
        device: { findUnique: jest.fn().mockResolvedValue({ id: 'D1' }) },
      })
      const service = new WorklistService(prisma)
      const res = await service.batchAssign(['E1', 'E2'], { deviceId: 'D1' })
      expect(res).toEqual({ ok: true, updated: 2 })
      expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: { in: ['E1', 'E2'] }, tenantId: 'default' },
        data: { deviceId: 'D1' },
      }))
    })

    it('assigns doctor to every exam report', async () => {
      const reportCreate = jest.fn().mockResolvedValue({ id: 'R' })
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'E1', patientId: 'P1', tenantId: 'default' },
            { id: 'E2', patientId: 'P2', tenantId: 'default' },
          ]),
        },
        user: { findUnique: jest.fn().mockResolvedValue({ id: 'U1' }) },
        report: { findFirst: jest.fn().mockResolvedValue(null), create: reportCreate },
      })
      const service = new WorklistService(prisma)
      const res = await service.batchAssign(['E1', 'E2'], { doctorId: 'U1' })
      expect(res.updated).toBe(2)
      expect(reportCreate).toHaveBeenCalledTimes(2)
    })

    it('rejects empty payload', async () => {
      const prisma = makePrisma({})
      const service = new WorklistService(prisma)
      await expect(service.batchAssign(['E1'], {})).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('state machine (existing endpoints)', () => {
    it('checkin transitions SCHEDULED → ARRIVED', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'ARRIVED' })
      const prisma = makePrisma({ exam: { findUnique: jest.fn().mockResolvedValue(exam), update } })
      const service = new WorklistService(prisma)
      const res = await service.checkIn('E1')
      expect(res.state).toBe('ARRIVED')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'ARRIVED', startedAt: expect.any(Date) }),
      }))
    })

    it('checkin rejects non-SCHEDULED exam', async () => {
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'COMPLETED' }) },
      })
      const service = new WorklistService(prisma)
      await expect(service.checkIn('E1')).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  // [v3.0.6.11-92 Wave1B P0] 影像质控回写 exam 状态机 (PATCH /worklist/:id/state)
  describe('updateQcState (影像质控回写)', () => {
    it('IMAGE_READY: COMPLETED → IMAGE_READY (图像可用)', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'IMAGE_READY' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'COMPLETED' }), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.updateQcState('E1', 'IMAGE_READY', '质控通过')
      expect(res.state).toBe('IMAGE_READY')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'IMAGE_READY' }),
      }))
    })

    it('QC_REJECT: IMAGE_READY → QC_REJECT (质控退回)', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'QC_REJECT' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'IMAGE_READY' }), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.updateQcState('E1', 'QC_REJECT', '伪影超标')
      expect(res.state).toBe('QC_REJECT')
    })

    it('QC_PASS: QC_REJECT → PENDING_REPORT (质控通过 → 待报告, 对齐 examMachine)', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'PENDING_REPORT' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'QC_REJECT' }), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.updateQcState('E1', 'QC_PASS')
      expect(res.state).toBe('PENDING_REPORT')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'PENDING_REPORT' }),
      }))
    })

    it('rejects qc-transition from non-image states (SCHEDULED/ARRIVED/CANCELLED)', async () => {
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'SCHEDULED' }) },
      })
      const service = new WorklistService(prisma)
      await expect(service.updateQcState('E1', 'IMAGE_READY')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('throws NotFoundException for unknown exam', async () => {
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(null) },
      })
      const service = new WorklistService(prisma)
      await expect(service.updateQcState('nope', 'IMAGE_READY')).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  // [v3.0.6.11-95 Wave1B] 批量状态流转 (POST /worklist/batch-checkin|start|complete)
  describe('batchTransition (批量状态流转)', () => {
    it('checkin transitions all SCHEDULED ids → ARRIVED with startedAt', async () => {
      const update = jest.fn().mockResolvedValue({ id: 'E1', state: 'ARRIVED' })
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'E1', state: 'SCHEDULED' },
            { id: 'E2', state: 'SCHEDULED' },
          ]),
          update,
        },
      })
      const service = new WorklistService(prisma)
      const res = await service.batchTransition(['E1', 'E2'], 'checkin')
      expect(res.succeeded).toHaveLength(2)
      expect(res.failed).toHaveLength(0)
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'E1' },
        data: expect.objectContaining({ state: 'ARRIVED', startedAt: expect.any(Date) }),
      }))
    })

    it('start requires ARRIVED; complete requires IN_PROGRESS and sets completedAt', async () => {
      const update = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([{ id: 'E1', state: 'ARRIVED' }]),
          update,
        },
      })
      const service = new WorklistService(prisma)
      await service.batchTransition(['E1'], 'start')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'IN_PROGRESS' }),
      }))
      const prisma2 = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([{ id: 'E1', state: 'IN_PROGRESS' }]),
          update,
        },
      })
      const service2 = new WorklistService(prisma2)
      await service2.batchTransition(['E1'], 'complete')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'COMPLETED', completedAt: expect.any(Date) }),
      }))
    })

    it('collects per-id failures without blocking others (invalid source state)', async () => {
      const update = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([
            { id: 'E1', state: 'SCHEDULED' },
            { id: 'E2', state: 'IN_PROGRESS' },
            { id: 'E3', state: 'COMPLETED' },
          ]),
          update,
        },
      })
      const service = new WorklistService(prisma)
      const res = await service.batchTransition(['E1', 'E2', 'E3'], 'checkin')
      expect(res.succeeded).toEqual([{ id: 'E1', state: 'ARRIVED' }])
      expect(res.failed).toHaveLength(2)
      expect(res.failed[0]?.message).toContain('不允许批量签到')
      expect(res.failed[1]?.message).toContain('不允许批量签到')
    })

    it('reports missing exams as failed', async () => {
      const prisma = makePrisma({
        exam: {
          findMany: jest.fn().mockResolvedValue([{ id: 'E1', state: 'SCHEDULED' }]),
          update: jest.fn().mockResolvedValue({}),
        },
      })
      const service = new WorklistService(prisma)
      const res = await service.batchTransition(['E1', 'gone'], 'checkin')
      expect(res.succeeded).toHaveLength(1)
      expect(res.failed).toEqual([{ id: 'gone', message: '检查不存在' }])
    })
  })

  // [v3.0.6.11-95 Wave 1A P0-3] 批量改优先级落库 (PATCH /worklist/:id { priority })
  describe('update priority', () => {
    it('persists priority and normalizes Chinese alias 普通 → ROUTINE', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'SCHEDULED', priority: 'ROUTINE' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.update('E1', { priority: '普通' })
      expect(res.priority).toBe('ROUTINE')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id: 'E1' },
        data: expect.objectContaining({ priority: 'ROUTINE' }),
      }))
    })

    it('persists techNote/qcNote/rating on update', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(exam), update },
      })
      const service = new WorklistService(prisma)
      await service.update('E1', { techNote: '技师备注', qcNote: '质控备注', rating: '优' })
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ techNotes: '技师备注', qcNotes: '质控备注', qualityRating: '优' }),
      }))
    })
  })

  // [v3.0.6.11-95 Wave 1A P1] 暂停/继续状态流转 (POST /worklist/:id/pause|resume)
  describe('pause/resume (暂停/继续)', () => {
    it('pause transitions IN_PROGRESS → PAUSED with pausedAt', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'PAUSED', pausedAt: new Date() })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'IN_PROGRESS' }), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.pause('E1', '患者不适')
      expect(res.state).toBe('PAUSED')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'PAUSED', pausedAt: expect.any(Date) }),
      }))
    })

    it('pause rejects non-IN_PROGRESS exam', async () => {
      const prisma = makePrisma({ exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'SCHEDULED' }) } })
      const service = new WorklistService(prisma)
      await expect(service.pause('E1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('resume transitions PAUSED → IN_PROGRESS', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'IN_PROGRESS', pausedAt: null })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'PAUSED' }), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.resume('E1')
      expect(res.state).toBe('IN_PROGRESS')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'IN_PROGRESS', pausedAt: null }),
      }))
    })

    it('resume rejects non-PAUSED exam', async () => {
      const prisma = makePrisma({ exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'COMPLETED' }) } })
      const service = new WorklistService(prisma)
      await expect(service.resume('E1')).rejects.toBeInstanceOf(BadRequestException)
    })
  })

  // [v3.0.6.11-95 Wave 1A P1] QC_REJECT → 重拍登记 (IN_PROGRESS + retakeCount + 备注)
  describe('updateQcState retake (重拍登记)', () => {
    it('QC_REJECT → IN_PROGRESS increments retakeCount and appends qcNotes', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'IN_PROGRESS', retakeCount: 2, qcNotes: '重拍登记 第 1 次\n重拍登记 第 2 次: 伪影' })
      const prisma = makePrisma({
        exam: {
          findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'QC_REJECT', qcNotes: '重拍登记 第 1 次', retakeCount: 1 }),
          update,
        },
      })
      const service = new WorklistService(prisma)
      const res = await service.updateQcState('E1', 'IN_PROGRESS', '伪影')
      expect(res.state).toBe('IN_PROGRESS')
      expect(res.retakeCount).toBe(2)
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'IN_PROGRESS', retakeCount: 2, qcNotes: expect.stringContaining('重拍登记 第 2 次') }),
      }))
    })

    it('rejects retake from non-QC_REJECT state', async () => {
      const prisma = makePrisma({ exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'COMPLETED' }) } })
      const service = new WorklistService(prisma)
      await expect(service.updateQcState('E1', 'IN_PROGRESS')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('persists rating/qcNote with QC_REJECT', async () => {
      const update = jest.fn().mockResolvedValue({ ...exam, state: 'QC_REJECT', qualityRating: '差', qcNotes: '伪影超标' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ ...exam, state: 'IMAGE_READY' }), update },
      })
      const service = new WorklistService(prisma)
      const res = await service.updateQcState('E1', 'QC_REJECT', '伪影超标', { rating: '差' })
      expect(res.state).toBe('QC_REJECT')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'QC_REJECT', qualityRating: '差', qcNotes: '伪影超标' }),
      }))
    })
  })
})
