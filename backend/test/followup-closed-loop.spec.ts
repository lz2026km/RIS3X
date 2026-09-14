/**
 * [G005 v3.0.6.11-99 Wave3B] 随访闭环 spec
 * 状态机 (remind/miss/cancel/in-progress/complete) + 模板库 (CRUD/apply) + 统计 + 检查联动 (from-exam)
 */
import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { FollowUpService } from '../src/modules/followup/followup.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('FollowUpClosedLoop (Wave3B)', () => {
  let svc: FollowUpService
  let prisma: any

  const row = {
    id: 'f1',
    tenantId: 'default',
    patientId: 'p1',
    patientName: '张三',
    reportId: null,
    examId: null,
    templateId: null,
    planDate: new Date('2026-08-10T00:00:00Z'),
    intervalDays: 30,
    // [v3.0.6.11-104 Wave 1B] 动态未来日期: 避免固定日期过期后 deriveStatus 误判 OVERDUE (时间炸弹)
    nextDate: new Date(Date.now() + 30 * 86400000),
    status: 'PENDING',
    note: '',
    reminderEnabled: true,
    remindedAt: null,
    missedAt: null,
    cancelledAt: null,
    reason: null,
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
    followUpTemplate: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    exam: {
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

  // ============ 状态机 ============

  it('remind: 标记 REMINDED + remindedAt + 创建 notification', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'REMINDED', remindedAt: new Date() })
    mockPrisma.notification.create.mockResolvedValue({ id: 'n1' })
    const result = await svc.remind('f1', 'u-007')
    expect(result.status).toBe('REMINDED')
    expect(mockPrisma.followUpPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'f1' }, data: expect.objectContaining({ status: 'REMINDED', remindedAt: expect.any(Date) }) }),
    )
    expect(mockPrisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ type: 'TASK', title: '随访提醒', targetId: 'f1' }) }),
    )
  })

  it('remind: 通知落库失败不阻塞状态流转', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'REMINDED', remindedAt: new Date() })
    mockPrisma.notification.create.mockRejectedValue(new Error('db down'))
    const result = await svc.remind('f1', 'u-007')
    expect(result.status).toBe('REMINDED')
  })

  it('miss: 标记 MISSED + missedAt + reason', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'MISSED', missedAt: new Date(), reason: '电话无法接通' })
    const result = await svc.miss('f1', '电话无法接通')
    expect(result.status).toBe('MISSED')
    expect(result.reason).toBe('电话无法接通')
    expect(mockPrisma.followUpPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'MISSED', missedAt: expect.any(Date), reason: '电话无法接通' }) }),
    )
  })

  it('cancel: 标记 CANCELLED + cancelledAt + reason', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'CANCELLED', cancelledAt: new Date(), reason: '患者拒绝随访' })
    const result = await svc.cancel('f1', '患者拒绝随访')
    expect(result.status).toBe('CANCELLED')
    expect(result.reason).toBe('患者拒绝随访')
  })

  it('in-progress: PENDING → IN_PROGRESS', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(row)
    mockPrisma.followUpPlan.update.mockResolvedValue({ ...row, status: 'IN_PROGRESS' })
    const result = await svc.inProgress('f1')
    expect(result.status).toBe('IN_PROGRESS')
  })

  it('终态不可再流转: miss 后 complete/remind/cancel 抛 BadRequest', async () => {
    const missed = { ...row, status: 'MISSED' }
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(missed)
    await expect(svc.complete('f1')).rejects.toBeInstanceOf(BadRequestException)
    await expect(svc.remind('f1', 'u-1')).rejects.toBeInstanceOf(BadRequestException)
    await expect(svc.cancel('f1', 'x')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('不存在的计划流转抛 NotFound', async () => {
    mockPrisma.followUpPlan.findUnique.mockResolvedValue(null)
    await expect(svc.miss('nope', 'r')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.cancel('nope', 'r')).rejects.toBeInstanceOf(NotFoundException)
    await expect(svc.remind('nope', 'u-1')).rejects.toBeInstanceOf(NotFoundException)
  })

  // ============ 统计 ============

  it('stats: 完成率/失访率/异常率(逾期)/按类别/按时段派生正确', async () => {
    const base = new Date('2026-07-01T00:00:00Z')
    const now = new Date()
    mockPrisma.followUpPlan.findMany.mockResolvedValue([
      { ...row, id: 'a', status: 'COMPLETED', completedAt: now, planDate: base, templateId: 't1' },
      { ...row, id: 'b', status: 'COMPLETED', completedAt: now, planDate: base, templateId: 't1' },
      { ...row, id: 'c', status: 'MISSED', missedAt: now, planDate: base },
      { ...row, id: 'd', status: 'CANCELLED', cancelledAt: now, planDate: base },
      { ...row, id: 'e', status: 'PENDING', nextDate: new Date(Date.now() - 86400000), planDate: base, templateId: 't2' },
    ])
    mockPrisma.followUpTemplate.findMany.mockResolvedValue([
      { id: 't1', category: '病种', intervals: [30], items: [] },
      { id: 't2', category: '检查类型', intervals: [30], items: [] },
    ])
    const stats = await svc.stats()
    expect(stats.total).toBe(5)
    expect(stats.completed).toBe(2)
    expect(stats.missed).toBe(1)
    expect(stats.cancelled).toBe(1)
    expect(stats.overdue).toBe(1)
    // 完成率 = completed / (total - cancelled) = 2/4 = 50%
    expect(stats.completionRate).toBe(50)
    // 失访率 = 1/5 = 20%
    expect(stats.missRate).toBe(20)
    // 异常率(逾期) = 1/5 = 20%
    expect(stats.abnormalRate).toBe(20)
    expect(stats.byCategory).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: '病种', count: 2 }),
      expect.objectContaining({ category: '检查类型', count: 1 }),
      expect.objectContaining({ category: '未分类', count: 2 }),
    ]))
    expect(stats.byMonth[0]).toEqual(expect.objectContaining({ month: '2026-07', total: 5, completed: 2, missed: 1 }))
  })

  it('stats: 空表返回全零速率', async () => {
    mockPrisma.followUpPlan.findMany.mockResolvedValue([])
    mockPrisma.followUpTemplate.findMany.mockResolvedValue([])
    const stats = await svc.stats()
    expect(stats.total).toBe(0)
    expect(stats.completionRate).toBe(0)
    expect(stats.missRate).toBe(0)
    expect(stats.byCategory).toEqual([])
  })

  // ============ 模板库 ============

  it('template list: DB 不可用时回退内置演示模板', async () => {
    mockPrisma.followUpTemplate.findMany = undefined as any
    const result = await svc.listTemplates()
    expect(result.total).toBeGreaterThan(0)
    expect(result.items[0].intervals.length).toBeGreaterThan(0)
  })

  it('template create: 校验名称与间隔, 持久化 intervals/items 数组', async () => {
    mockPrisma.followUpTemplate.create.mockImplementation(({ data }: any) => Promise.resolve({ id: 'tpl-1', ...data }))
    const created = await svc.createTemplate({ name: '肝癌TACE术后', category: '病种', intervals: [30, 90], items: ['影像学复查'] })
    expect(created.id).toBe('tpl-1')
    expect(created.intervals).toEqual([30, 90])
    expect(mockPrisma.followUpTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ name: '肝癌TACE术后', intervals: [30, 90] }) }),
    )
  })

  it('template create: 无间隔天数抛 BadRequest', async () => {
    await expect(svc.createTemplate({ name: 'x', intervals: [] })).rejects.toBeInstanceOf(BadRequestException)
  })

  it('template update: PATCH 只更新传入字段', async () => {
    mockPrisma.followUpTemplate.findUnique.mockResolvedValue({ id: 't1', name: '旧', intervals: [30] })
    mockPrisma.followUpTemplate.update.mockImplementation(({ data }: any) => Promise.resolve({ id: 't1', name: '旧', ...data }))
    const updated = await svc.updateTemplate('t1', { active: false })
    expect(updated.active).toBe(false)
    expect(mockPrisma.followUpTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ active: false }) }),
    )
  })

  it('template delete: 返回 ok + id', async () => {
    mockPrisma.followUpTemplate.findUnique.mockResolvedValue({ id: 't1' })
    mockPrisma.followUpTemplate.delete.mockResolvedValue({ id: 't1' })
    const result = await svc.removeTemplate('t1')
    expect(result).toEqual({ ok: true, id: 't1' })
    expect(mockPrisma.followUpTemplate.delete).toHaveBeenCalledWith({ where: { id: 't1' } })
  })

  // ============ 模板应用 (apply) ============

  it('apply: 按模板间隔 [30,90,180] 批量生成 3 条计划 (nextDate 逐个递增 + templateId 关联)', async () => {
    mockPrisma.followUpTemplate.findUnique.mockResolvedValue({
      id: 'tpl-onc', name: '肿瘤术后复查(CT)', category: '病种', intervals: [30, 90, 180], items: ['影像学复查'],
    })
    mockPrisma.followUpPlan.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...row, id: 'gen-' + data.intervalDays, ...data, createdAt: new Date(), updatedAt: new Date() }),
    )
    const result = await svc.applyTemplate('tpl-onc', {
      patientId: 'p9', patientName: '王五', planDate: '2026-08-10',
    })
    expect(result.total).toBe(3)
    expect(mockPrisma.followUpPlan.create).toHaveBeenCalledTimes(3)
    const intervals = mockPrisma.followUpPlan.create.mock.calls.map(([c]: any[]) => c.data.intervalDays)
    expect(intervals).toEqual([30, 90, 180])
    const nextDates = mockPrisma.followUpPlan.create.mock.calls.map(([c]: any[]) => c.data.nextDate)
    expect(nextDates[0].toISOString().slice(0, 10)).toBe('2026-09-09')
    expect(nextDates[1].toISOString().slice(0, 10)).toBe('2026-11-08')
    expect(nextDates[2].toISOString().slice(0, 10)).toBe('2027-02-06')
    expect(result.items[0].templateId).toBe('tpl-onc')
    expect(result.items[0].note).toContain('影像学复查')
  })

  it('apply: 模板不存在抛 NotFound', async () => {
    mockPrisma.followUpTemplate.findUnique.mockResolvedValue(null)
    await expect(svc.applyTemplate('nope', { patientId: 'p1', patientName: 'x', planDate: '2026-08-10' }))
      .rejects.toBeInstanceOf(NotFoundException)
  })

  // ============ 检查联动 (from-exam) ============

  it('from-exam: 检查 → 自动创建计划 (examId/patient 派生)', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue({
      id: 'E-99', patientId: 'p9', accessionNumber: 'ACC-99', scheduledAt: new Date('2026-08-11T08:00:00Z'),
      patient: { id: 'p9', name: '赵六' },
    })
    mockPrisma.followUpPlan.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...row, id: 'from-exam-1', ...data, createdAt: new Date(), updatedAt: new Date() }),
    )
    const result = await svc.fromExam({ examId: 'E-99' })
    expect(result.total).toBe(1)
    expect(result.items[0].examId).toBe('E-99')
    expect(result.items[0].patientName).toBe('赵六')
    expect(result.items[0].planDate.slice(0, 10)).toBe('2026-08-11')
    expect(mockPrisma.followUpPlan.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ examId: 'E-99', patientId: 'p9', patientName: '赵六' }) }),
    )
  })

  it('from-exam: 带 templateId 时按模板批量生成', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue({
      id: 'E-99', patientId: 'p9', accessionNumber: 'ACC-99', scheduledAt: new Date('2026-08-11T08:00:00Z'),
      patient: { id: 'p9', name: '赵六' },
    })
    mockPrisma.followUpTemplate.findUnique.mockResolvedValue({
      id: 'tpl-x', name: '肺结节随访', category: '病种', intervals: [90, 180], items: ['薄层CT复查'],
    })
    mockPrisma.followUpPlan.create.mockImplementation(({ data }: any) =>
      Promise.resolve({ ...row, id: 'fx-' + data.intervalDays, ...data, createdAt: new Date(), updatedAt: new Date() }),
    )
    const result = await svc.fromExam({ examId: 'E-99', templateId: 'tpl-x' })
    expect(result.total).toBe(2)
    expect(mockPrisma.followUpPlan.create.mock.calls.map(([c]: any[]) => c.data.examId)).toEqual(['E-99', 'E-99'])
  })

  it('from-exam: 检查不存在抛 NotFound', async () => {
    mockPrisma.exam.findUnique.mockResolvedValue(null)
    await expect(svc.fromExam({ examId: 'nope' })).rejects.toBeInstanceOf(NotFoundException)
  })
})
