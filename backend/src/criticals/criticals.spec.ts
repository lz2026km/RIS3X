import { CriticalsService } from './criticals.service'
import { BadRequestException, NotFoundException } from '@nestjs/common'

const makePrisma = (overrides: Record<string, unknown> = {}) => {
  const prisma: Record<string, unknown> = {
    criticalValue: {
      findUnique: jest.fn().mockRejectedValue(new Error('no db')),
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
      create: jest.fn().mockRejectedValue(new Error('no db')),
      update: jest.fn().mockRejectedValue(new Error('no db')),
      delete: jest.fn().mockRejectedValue(new Error('no db')),
    },
    criticalValueNotification: {
      findMany: jest.fn().mockRejectedValue(new Error('no db')),
      count: jest.fn().mockRejectedValue(new Error('no db')),
      groupBy: jest.fn().mockRejectedValue(new Error('no db')),
      createMany: jest.fn().mockRejectedValue(new Error('no db')),
    },
    exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')), findUnique: jest.fn().mockRejectedValue(new Error('no db')) },
    patient: { findMany: jest.fn().mockRejectedValue(new Error('no db')) },
    systemConfig: { findUnique: jest.fn().mockRejectedValue(new Error('no db')) },
    ...overrides,
  }
  return prisma as never
}

describe('CriticalsService', () => {
  describe('create', () => {
    it('writes patientId carried from linked exam', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'cv-new', patientId: 'P1' })
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue({ id: 'EX-1', patientId: 'P1' }) },
        criticalValue: { create },
      })
      const service = new CriticalsService(prisma)
      const res = await service.create({ examId: 'EX-1', description: '低钠血症', severity: 'HIGH', method: 'SYSTEM' })
      expect(res.patientId).toBe('P1')
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ examId: 'EX-1', patientId: 'P1', state: 'FOUND' }),
      }))
    })

    it('keeps patientId undefined when no examId provided', async () => {
      const create = jest.fn().mockResolvedValue({ id: 'cv-new' })
      const findUnique = jest.fn().mockRejectedValue(new Error('no db'))
      const prisma = makePrisma({
        exam: { findMany: jest.fn().mockRejectedValue(new Error('no db')), findUnique },
        criticalValue: { create },
      })
      const service = new CriticalsService(prisma)
      await service.create({ description: '孤立危急值', severity: 'LOW', method: 'SYSTEM' })
      expect(create).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ examId: undefined, patientId: undefined }),
      }))
      expect(findUnique).not.toHaveBeenCalled()
    })

    it('throws 400 when linked exam does not exist', async () => {
      const prisma = makePrisma({
        exam: { findUnique: jest.fn().mockResolvedValue(null) },
        criticalValue: { create: jest.fn() },
      })
      const service = new CriticalsService(prisma)
      await expect(service.create({ examId: 'nope', description: 'x', severity: 'HIGH', method: 'SYSTEM' }))
        .rejects.toBeInstanceOf(BadRequestException)
    })
  })

  describe('getStats', () => {
    it('aggregates CriticalValue states into dashboard shape', async () => {
      const prisma = makePrisma({
        criticalValue: {
          groupBy: jest.fn().mockResolvedValue([
            { state: 'FOUND', _count: { _all: 3 } },
            { state: 'NOTIFIED', _count: { _all: 2 } },
            { state: 'ACKNOWLEDGED', _count: { _all: 1 } },
            { state: 'RECEIPTED', _count: { _all: 1 } },
            { state: 'RESOLVED', _count: { _all: 4 } },
            { state: 'CLOSED_LOOP', _count: { _all: 2 } },
            { state: 'ESCALATED', _count: { _all: 1 } },
          ]),
          count: jest.fn().mockResolvedValueOnce(14).mockResolvedValueOnce(5),
        },
      })
      const service = new CriticalsService(prisma)
      const stats = await service.getStats()
      expect(stats).toEqual({
        pending: 3,
        notified: 2,
        acknowledged: 1,
        receipted: 1,
        resolved: 6,
        escalated: 1,
        total: 14,
        todayCount: 5,
      })
    })

    it('returns zeros when no records exist', async () => {
      const prisma = makePrisma({
        criticalValue: {
          groupBy: jest.fn().mockResolvedValue([]),
          count: jest.fn().mockResolvedValueOnce(0).mockResolvedValueOnce(0),
        },
      })
      const service = new CriticalsService(prisma)
      const stats = await service.getStats()
      expect(stats.total).toBe(0)
      expect(stats.pending).toBe(0)
      expect(stats.resolved).toBe(0)
    })
  })

  describe('notify', () => {
    it('persists delivery attempts deterministically and flips state to NOTIFIED', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 2 })
      const update = jest.fn().mockResolvedValue({})
      const prisma = makePrisma({
        criticalValue: {
          findUnique: jest.fn().mockResolvedValue({ id: 'cv-1', description: '主动脉夹层', severity: 'CRITICAL' }),
          update,
        },
        criticalValueNotification: { createMany },
      })
      const service = new CriticalsService(prisma)
      const res = await service.notify({ criticalId: 'cv-1', channels: ['PHONE', 'SMS'] })

      expect(res.count).toBe(2)
      expect(res.status).toBe('NOTIFIED')
      expect(createMany).toHaveBeenCalled()
      const data = createMany.mock.calls[0][0].data as any[]
      expect(data).toHaveLength(2)
      expect(data[0]).toMatchObject({
        criticalId: 'cv-1',
        finding: '主动脉夹层',
        category: 'LIFE_THREATENING',
        patientName: '未知患者',
        channel: 'PHONE',
        status: 'SUCCESS',
      })
      // 确定性:同通道两次调用结果一致,无随机
      expect(data[1].status).toBe('SUCCESS')
      expect(update).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ state: 'NOTIFIED' }),
      }))
    })

    it('uses frontend-supplied fields when provided', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 1 })
      const prisma = makePrisma({
        criticalValue: {
          findUnique: jest.fn().mockResolvedValue({ id: 'cv-2', description: 'x', severity: 'HIGH' }),
          update: jest.fn().mockResolvedValue({}),
        },
        criticalValueNotification: { createMany },
      })
      const service = new CriticalsService(prisma)
      await service.notify({
        criticalId: 'cv-2',
        patientName: '张明远',
        patientId: 'P1',
        category: 'URGENT',
        finding: '颅内出血',
        channels: ['WECHAT'],
        recipientName: '王医生',
        recipientDept: '神经外科',
        recipientPhone: '13800000000',
      })
      const data = createMany.mock.calls[0][0].data as any[]
      expect(data[0]).toMatchObject({
        patientName: '张明远',
        patientId: 'P1',
        category: 'URGENT',
        finding: '颅内出血',
        recipientName: '王医生',
        recipientDept: '神经外科',
        recipientPhone: '13800000000',
      })
    })

    it('marks delivery FAILED when channel is explicitly disabled in config', async () => {
      const createMany = jest.fn().mockResolvedValue({ count: 1 })
      const prisma = makePrisma({
        criticalValue: {
          findUnique: jest.fn().mockResolvedValue({ id: 'cv-3', description: 'x', severity: 'HIGH' }),
          update: jest.fn().mockResolvedValue({}),
        },
        criticalValueNotification: { createMany },
        systemConfig: {
          findUnique: jest.fn().mockResolvedValue({ key: 'critical_channel_PHONE', value: { enabled: false } }),
        },
      })
      const service = new CriticalsService(prisma)
      await service.notify({ criticalId: 'cv-3', channels: ['PHONE'] })
      const data = createMany.mock.calls[0][0].data as any[]
      expect(data[0].status).toBe('FAILED')
    })

    it('throws 404 when critical value does not exist', async () => {
      const prisma = makePrisma({
        criticalValue: {
          findUnique: jest.fn().mockResolvedValue(null),
          update: jest.fn(),
        },
      })
      const service = new CriticalsService(prisma)
      await expect(service.notify({ criticalId: 'nope', channels: ['SMS'] })).rejects.toBeInstanceOf(NotFoundException)
    })
  })

  describe('getValue5StepList', () => {
    it('aggregates 5-step records from critical values, notifications, exam and patient', async () => {
      const prisma = makePrisma({
        criticalValue: {
          findMany: jest.fn().mockResolvedValue([
            {
              id: 'cv-1',
              description: '颅内出血',
              severity: 'CRITICAL',
              state: 'ACKNOWLEDGED',
              examId: 'EX-1',
              createdAt: new Date('2026-08-01T08:00:00Z'),
              voiceCalledAt: new Date('2026-08-01T08:05:00Z'),
              voiceCalledBy: '值班医生',
              ackedAt: new Date('2026-08-01T08:10:00Z'),
              ackedBy: '王医生',
              confirmedAt: null,
              confirmedBy: null,
              confirmedComment: null,
              resolvedAt: null,
              resolvedBy: null,
            },
            {
              id: 'cv-2',
              description: '急性心肌梗死',
              severity: 'URGENT',
              state: 'RESOLVED',
              examId: null,
              createdAt: new Date('2026-08-02T08:00:00Z'),
              voiceCalledAt: null,
              voiceCalledBy: null,
              ackedAt: null,
              ackedBy: null,
              confirmedAt: new Date('2026-08-02T08:20:00Z'),
              confirmedBy: '心内科陈医生',
              confirmedComment: '已收治',
              resolvedAt: new Date('2026-08-02T09:00:00Z'),
              resolvedBy: '医务处',
            },
          ]),
        },
        criticalValueNotification: {
          findMany: jest.fn().mockResolvedValue([
            { criticalId: 'cv-1', channel: 'PHONE', status: 'SUCCESS', triggeredAt: new Date('2026-08-01T08:05:00Z'), recipientPhone: '13800000001' },
          ]),
        },
        exam: { findMany: jest.fn().mockResolvedValue([{ id: 'EX-1', patientId: 'P1' }]) },
        patient: { findMany: jest.fn().mockResolvedValue([{ id: 'P1', name: '张明远' }]) },
      })
      const service = new CriticalsService(prisma)
      const { items, total } = await service.getValue5StepList()

      expect(total).toBe(2)
      expect(items[0]).toMatchObject({
        id: 'cv-1',
        patientName: '张明远',
        finding: '颅内出血',
        severity: '危及生命',
        currentStep: 3,
      })
      expect(items[0].steps.discovered.done).toBe(true)
      expect(items[0].steps.voiceCall.done).toBe(true)
      expect(items[0].steps.voiceCall.phone).toBe('13800000001')
      expect(items[0].steps.acknowledged.done).toBe(true)
      expect(items[0].steps.receipted.done).toBe(false)
      expect(items[1].currentStep).toBe(5)
      expect(items[1].steps.closed.done).toBe(true)
      expect(items[1].steps.closed.time).toBeDefined()
    })
  })

  describe('getMissedStats / getNotificationStats', () => {
    it('getMissedStats returns frontend-aligned shape', async () => {
      const prisma = makePrisma({
        criticalValue: {
          count: jest.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(30),
        },
      })
      const service = new CriticalsService(prisma)
      const stats = await service.getMissedStats()
      expect(stats).toEqual({
        missed: 2,
        total: 30,
        totalExams: 30,
        missedCount: 2,
        missedRate: '6.7%',
        topMissedReasons: [],
      })
    })

    it('getNotificationStats returns completion metrics', async () => {
      const prisma = makePrisma({
        criticalValueNotification: {
          groupBy: jest.fn().mockResolvedValue([
            { status: 'SUCCESS', _count: { id: 9 } },
            { status: 'FAILED', _count: { id: 1 } },
          ]),
          count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(3).mockResolvedValueOnce(2),
        },
      })
      const service = new CriticalsService(prisma)
      const stats = await service.getNotificationStats()
      expect(stats.total).toBe(10)
      expect(stats.totalCount).toBe(10)
      expect(stats.completedWithin10Min).toBe(9)
      expect(stats.completionRate).toBe(90)
      expect(stats.todayCount).toBe(3)
      expect(stats.todayCompleted).toBe(2)
      expect(stats.todayRate).toBe('67%')
    })
  })
})
