import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
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
    report: {
      findUnique: jest.fn(),
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

  // [v3.0.6.11-92 Wave1B P0] 报告→随访关联: create 携带 reportId/examId 并回显
  it('persists reportId/examId association from report detail entry', async () => {
    mockPrisma.followUpPlan.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...row, ...data }),
    )
    const created = await svc.create({
      patientId: 'p1',
      patientName: '张三',
      planDate: '2026-08-10',
      intervalDays: 30,
      reminderEnabled: true,
      reportId: 'RPT-100',
      examId: 'E-88',
      note: '来源报告: RPT-100 创建随访',
    })
    expect(created.reportId).toBe('RPT-100')
    expect(created.examId).toBe('E-88')
    expect(mockPrisma.followUpPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ reportId: 'RPT-100', examId: 'E-88' }) }),
    )
  })

  it('lists plans without reportId/examId (legacy rows) without crashing', async () => {
    mockPrisma.followUpPlan.findMany.mockResolvedValue([row])
    mockPrisma.followUpPlan.count.mockResolvedValue(1)
    const result = await svc.list({})
    expect(result.items[0].reportId).toBeUndefined()
    expect(result.items[0].examId).toBeUndefined()
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

  // [v3.0.6.11-103 Wave 13] 随访自动触发强化: 报告手动补建 + 到期提醒队列
  describe('随访自动触发强化 (Wave 13)', () => {
    beforeEach(() => jest.clearAllMocks())

    it('from-report: 报告命中关键词规则 → 创建随访计划 (手动补建不受模式限制)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'RPT-1',
        patientId: 'p1',
        examId: 'E-1',
        impression: '右肺上叶磨玻璃影, 建议随访复查',
        conclusion: '肺结节随访',
        findings: '',
        patient: { id: 'p1', name: '张三' },
      })
      mockPrisma.followUpPlan.findMany.mockResolvedValue([])
      mockPrisma.followUpPlan.create.mockImplementation(({ data }: any) => Promise.resolve({ ...row, ...data }))
      const result = await svc.fromReport({ reportId: 'RPT-1', reason: '报告发布后手动补建' })
      expect(result.created).toBeGreaterThan(0)
      expect(result.matched).toContain('磨玻璃')
      expect(mockPrisma.followUpPlan.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reportId: 'RPT-1', patientId: 'p1', reminderEnabled: true }) }),
      )
    })

    it('from-report: 无关键词命中 → created 0 不创建', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({
        id: 'RPT-2',
        patientId: 'p1',
        examId: null,
        impression: '未见明显异常',
        conclusion: '',
        findings: '',
        patient: { id: 'p1', name: '李四' },
      })
      const result = await svc.fromReport({ reportId: 'RPT-2' })
      expect(result.created).toBe(0)
      expect(result.matched).toHaveLength(0)
      expect(mockPrisma.followUpPlan.create).not.toHaveBeenCalled()
    })

    it('from-report: 报告不存在 → NotFoundException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.fromReport({ reportId: 'nope' })).rejects.toBeInstanceOf(NotFoundException)
    })

    it('createFollowUpFromReport: 同报告同模板已有计划 → 去重跳过 (防重发重复创建)', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      mockPrisma.followUpPlan.findMany.mockResolvedValue([{ id: 'f-exist', templateId: 'tpl-nodule' }])
      mockPrisma.followUpPlan.create.mockResolvedValue({ ...row })
      const res = await svc.createFollowUpFromReport({
        reportId: 'RPT-3',
        patientId: 'p1',
        patientName: '王五',
        planDate: '2026-08-16',
        matches: [
          { rule: { id: 'FTR-001', keyword: '肺结节', label: '肺结节', description: '', templateId: 'tpl-nodule', templateName: '', intervals: [90, 180, 360], hint: '', active: true }, matchedText: '肺结节' },
        ],
      })
      expect(res.created).toBe(0)
      expect(res.skipped).toContain('肺结节')
      expect(mockPrisma.followUpPlan.create).not.toHaveBeenCalled()
    })

    it('reminder-queue: 分组 逾期/今日到期/未来 并仅含启用提醒的计划', async () => {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const overdueRow = { ...row, id: 'f-over', nextDate: new Date(today.getTime() - 86400000) }
      const todayRow = { ...row, id: 'f-today', nextDate: new Date(today.getTime() + 3600000) }
      const soonRow = { ...row, id: 'f-soon', nextDate: new Date(today.getTime() + 3 * 86400000) }
      const farRow = { ...row, id: 'f-far', nextDate: new Date(today.getTime() + 30 * 86400000) }
      mockPrisma.followUpPlan.findMany.mockResolvedValue([overdueRow, todayRow, soonRow, farRow])
      const result = await svc.reminderQueue(7)
      expect(result.total).toBe(4)
      expect(result.overdue).toBe(1)
      expect(result.dueToday).toBe(1)
      expect(result.upcoming).toBe(2)
      expect(result.queueType).toBe('OVERDUE')
      expect(mockPrisma.followUpPlan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            reminderEnabled: true,
            status: { notIn: ['COMPLETED', 'MISSED', 'CANCELLED'] },
          }),
        }),
      )
    })
  })

  // [v3.0.6.11-104 Wave 1B] 随访状态机门禁: 非法流转 400 / 合法流转 200 / 终态不可变
  describe('状态机门禁 (FOLLOWUP_TRANSITIONS)', () => {
    beforeEach(() => jest.clearAllMocks())

    it('合法流转: PENDING → REMINDED 通过 (update)', async () => {
      const future = { ...row, planDate: new Date(), nextDate: new Date(Date.now() + 30 * 86400000) }
      mockPrisma.followUpPlan.findUnique.mockResolvedValue(future)
      mockPrisma.followUpPlan.update.mockImplementation(({ data }: any) => Promise.resolve({ ...future, ...data }))
      const res = await svc.update('f1', { status: 'REMINDED' })
      expect(res.status).toBe('REMINDED')
      expect(mockPrisma.followUpPlan.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'REMINDED' }) }),
      )
    })

    it('非法跳转: MISSED(终态) → PENDING 抛 400 INVALID_TRANSITION', async () => {
      mockPrisma.followUpPlan.findUnique.mockResolvedValue({ ...row, status: 'MISSED' })
      mockPrisma.followUpPlan.update.mockResolvedValue(row)
      await expect(svc.update('f1', { status: 'PENDING' })).rejects.toBeInstanceOf(BadRequestException)
      await expect(svc.update('f1', { status: 'PENDING' })).rejects.toThrow('INVALID_TRANSITION')
    })

    it('终态不可变: complete 对 COMPLETED 计划抛 400', async () => {
      mockPrisma.followUpPlan.findUnique.mockResolvedValue({ ...row, status: 'COMPLETED' })
      await expect(svc.complete('f1')).rejects.toBeInstanceOf(BadRequestException)
    })

    it('合法流转: PENDING → COMPLETED 通过 (complete)', async () => {
      mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
      mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'COMPLETED', completedAt: new Date() })
      const res = await svc.complete('f1')
      expect(res.status).toBe('COMPLETED')
    })
  })
})
