import { Test } from '@nestjs/testing'
import { NotFoundException } from '@nestjs/common'
import { FollowUpService } from './followup.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('FollowUpService', () => {
  let svc: FollowUpService
  let prisma: any

  const row = {
    id: 'f1',
    tenantId: 'default',
    patientId: 'p1',
    patientName: '张三',
    planDate: new Date('2026-08-10T00:00:00Z'),
    intervalDays: 30,
    nextDate: new Date('2026-09-09T00:00:00Z'),
    status: 'PENDING',
    note: '肿瘤复查',
    reminderEnabled: true,
    completedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const mockPrisma = {
    followUpPlan: {
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [FollowUpService, { provide: PrismaService, useValue: mockPrisma }],
    }).compile()
    svc = module.get(FollowUpService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('lists follow-up plans (status/date/search filter)', async () => {
    mockPrisma.followUpPlan.findMany.mockResolvedValue([row])
    mockPrisma.followUpPlan.count.mockResolvedValue(1)
    const result = await svc.list({ status: 'PENDING' })
    expect(result.items).toHaveLength(1)
    expect(result.total).toBe(1)
    expect(prisma.followUpPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'PENDING' }) }),
    )
  })

  it('marks past-due non-completed plans as OVERDUE', async () => {
    const overdue = { ...row, nextDate: new Date(Date.now() - 86400000) }
    mockPrisma.followUpPlan.findMany.mockResolvedValue([overdue])
    mockPrisma.followUpPlan.count.mockResolvedValue(1)
    const result = await svc.list({})
    expect(result.items[0].status).toBe('OVERDUE')
  })

  it('creates a follow-up plan and computes nextDate from planDate + intervalDays', async () => {
    mockPrisma.followUpPlan.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...row, ...data }),
    )
    const created = await svc.create({
      patientId: 'p2',
      patientName: '李四',
      planDate: '2026-08-10',
      intervalDays: 60,
      note: '复查',
      reminderEnabled: true,
    })
    expect(created.patientName).toBe('李四')
    expect(created.nextDate.startsWith('2026-10-09')).toBe(true)
  })

  it('throws NotFoundException when completing a missing plan', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(null)
    await expect(svc.complete('nope')).rejects.toBeInstanceOf(NotFoundException)
  })

  it('completes a plan', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'COMPLETED', completedAt: new Date() })
    const result = await svc.complete('f1')
    expect(result.status).toBe('COMPLETED')
    expect(mockPrisma.followUpPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1' }, data: expect.objectContaining({ status: 'COMPLETED' }) }),
    )
  })

  it('deletes a plan', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.delete.mockResolvedValue(row)
    const result = await svc.remove('f1')
    expect(result.ok).toBe(true)
    expect(mockPrisma.followUpPlan.delete).toHaveBeenCalledWith({ where: { id: 'f1' } })
  })

  it('returns due plans within horizon', async () => {
    mockPrisma.followUpPlan.findMany.mockResolvedValue([row])
    const result = await svc.due(7)
    expect(result.items).toHaveLength(1)
    expect(result.days).toBe(7)
    expect(prisma.followUpPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { not: 'COMPLETED' } }) }),
    )
  })
})
