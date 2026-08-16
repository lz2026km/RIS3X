import { Test } from '@nestjs/testing'
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { ReportsService } from '../src/reports/reports.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'
import { createNoopGateway, NotificationsGateway } from '../src/notifications/notifications.gateway'
import { SystemConfigService } from '../src/system-storage/system-config.service'
import { FollowUpService } from '../src/modules/followup/followup.service'

const mockSystemConfig = {
  getNumber: jest.fn().mockResolvedValue(20),
  getString: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  invalidate: jest.fn(),
}

describe('ReportsService', () => {
  let svc: ReportsService
  let prisma: any

  const mockReport = {
    id: 'r1',
    patientId: 'p1',
    examId: null,
    radiologistId: 'd1',
    findings: '正常',
    conclusion: '未见异常',
    state: 'PENDING_ASSIGNMENT',
    version: 1,
    tenantId: 't1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  const txMock = {
    report: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    reportRevision: { create: jest.fn() },
  }

  const mockPrisma = {
    report: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    reportRevision: { create: jest.fn() },
    $transaction: jest.fn((fn: any) => fn(txMock)),
  }

  const mockQueue = { addReportExport: jest.fn() }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: QueueService, useValue: mockQueue },
        { provide: NotificationsGateway, useValue: createNoopGateway() },
        { provide: SystemConfigService, useValue: mockSystemConfig },
        { provide: FollowUpService, useValue: {} },
      ],
    }).compile()
    svc = module.get(ReportsService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('list', () => {
    it('returns paginated reports with total', async () => {
      mockPrisma.report.findMany.mockResolvedValue([mockReport])
      mockPrisma.report.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 20 })
      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters by state', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)
      await svc.list({ states: ['PUBLISHED'] as any })
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ state: 'PUBLISHED', tenantId: 'default' }) })
      )
    })

    // [v3.0.6.11-95 Wave3B P1] list 筛选: 状态数组 / 患者 / 医生 / exam 派生 modality/priority / keyword
    it('filters by states array (in)', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)
      await svc.list({ states: ['SIGNED', 'PUBLISHED'] as any })
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ state: { in: ['SIGNED', 'PUBLISHED'] } }) })
      )
    })

    it('filters by patientId / doctorId (radiologistId)', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)
      await svc.list({ patientId: 'p1', doctorId: 'd1' })
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ patientId: 'p1', radiologistId: 'd1' }) })
      )
    })

    it('filters modality/priority via exam relation', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)
      await svc.list({ modality: 'CT', priority: 'URGENT' })
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ exam: { is: { modality: 'CT', priority: 'URGENT' } } }) })
      )
    })

    it('filters keyword via patient name OR exam accessionNumber', async () => {
      mockPrisma.report.findMany.mockResolvedValue([])
      mockPrisma.report.count.mockResolvedValue(0)
      await svc.list({ keyword: '张三' })
      const callWhere = mockPrisma.report.findMany.mock.calls[0][0].where
      expect(callWhere.AND[0].OR).toContainEqual({ patient: { name: { contains: '张三' } } })
      expect(callWhere.AND[0].OR).toContainEqual({ exam: { is: { accessionNumber: { contains: '张三' } } } })
    })

    it('derives modality/bodyPart/priority from exam in DTO', async () => {
      mockPrisma.report.findMany.mockResolvedValue([{
        ...mockReport,
        exam: { id: 'e1', modality: 'CT', bodyPart: '胸部', priority: 'URGENT', accessionNumber: 'ACC-001' },
      }])
      mockPrisma.report.count.mockResolvedValue(1)
      const result = await svc.list({ skip: 0, take: 20 })
      expect(result.items[0]?.modality).toBe('CT')
      expect(result.items[0]?.bodyPart).toBe('胸部')
      expect(result.items[0]?.priority).toBe('URGENT')
      expect(result.items[0]?.accessionNumber).toBe('ACC-001')
    })
  })

  describe('get', () => {
    it('returns report with relations', async () => {
      mockPrisma.report.findFirst.mockResolvedValue({ ...mockReport, patient: {}, radiologist: {}, revisions: [] })
      const result = await svc.get('r1')
      expect(result.id).toBe('r1')
      expect(mockPrisma.report.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'r1', tenantId: 'default' } })
      )
    })

    it('throws NotFoundException', async () => {
      mockPrisma.report.findFirst.mockResolvedValue(null)
      await expect(svc.get('x')).rejects.toThrow(NotFoundException)
    })
  })

  describe('create', () => {
    it('creates report with PENDING_ASSIGNMENT state', async () => {
      mockPrisma.report.create.mockResolvedValue(mockReport)
      const result = await svc.create({
        patientId: 'p1', findings: '正常', conclusion: '未见异常',
      })
      expect(result.state).toBe('PENDING_ASSIGNMENT')
    })
  })

  describe('update', () => {
    it('updates report with optimistic concurrency', async () => {
      txMock.report.findUnique.mockResolvedValue(mockReport)
      txMock.report.update.mockResolvedValue({ ...mockReport, findings: 'updated' })
      const result = await svc.update('r1', { findings: 'updated' })
      expect(result.findings).toBe('updated')
    })

    it('strips state from dto (PATCH cannot bypass transition)', async () => {
      txMock.report.findUnique.mockResolvedValue(mockReport)
      txMock.report.update.mockResolvedValue({ ...mockReport, findings: 'f' })
      await svc.update('r1', { findings: 'f', state: 'PUBLISHED' } as any)
      const updateCall = txMock.report.update.mock.calls[0][0]
      expect(updateCall.data).not.toHaveProperty('state')
      expect(updateCall.data).toHaveProperty('findings', 'f')
      expect(updateCall.data).toHaveProperty('version')
    })

    it('throws ConflictException on version conflict', async () => {
      txMock.report.findUnique.mockResolvedValue(mockReport)
      txMock.report.update.mockRejectedValue({ code: 'P2025' })
      await expect(svc.update('r1', { findings: 'x' })).rejects.toThrow(ConflictException)
    })
  })

  describe('delete', () => {
    it('withdraws report with reason and actorId', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'WITHDRAWN' })
      const result = await svc.delete('r1', 'error', 'u1')
      expect(result.state).toBe('WITHDRAWN')
    })

    it('throws BadRequestException without reason', async () => {
      await expect(svc.delete('r1', '', 'u1')).rejects.toThrow(BadRequestException)
    })

    it('throws BadRequestException without actorId', async () => {
      await expect(svc.delete('r1', 'reason', '')).rejects.toThrow(BadRequestException)
    })

    it('throws NotFoundException when report missing', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.delete('x', 'reason', 'u1')).rejects.toThrow(NotFoundException)
    })
  })

  describe('exportReport', () => {
    it('queues export job', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      const result = await svc.exportReport('r1', 'PDF', 'u1')
      expect(result.queued).toBe(true)
      expect(mockQueue.addReportExport).toHaveBeenCalledWith({ reportId: 'r1', format: 'PDF', userId: 'u1' })
    })
  })

  describe('transition', () => {
    it('transitions report state and creates revision', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'WRITING' })
      const result = await svc.transition('r1', 'WRITING' as any, 'd1')
      expect(result.state).toBe('WRITING')
      expect(txMock.reportRevision.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ reportId: 'r1', actorId: 'd1', fromState: 'PENDING_ASSIGNMENT', toState: 'WRITING' }),
      })
    })

    it('SIGNED writes signedAt and signedById', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'REVIEWED' })
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'SIGNED', signedAt: new Date(), signedById: 'd1' })
      const result = await svc.transition('r1', 'SIGNED' as any, 'd1')
      expect(txMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ signedAt: expect.any(Date), signedById: 'd1' }) }),
      )
      expect(result.signedAt).not.toBeNull()
      expect(result.signedById).toBe('d1')
    })

    it('REVIEWED writes reviewedAt and reviewerId', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'FINAL_REVIEW' })
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'REVIEWED', reviewedAt: new Date(), reviewerId: 'r1' })
      const result = await svc.transition('r1', 'REVIEWED' as any, 'r1')
      expect(txMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ reviewedAt: expect.any(Date), reviewerId: 'r1' }) }),
      )
      expect(result.reviewerId).toBe('r1')
    })

    it('PUBLISHED writes publishedAt', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'SIGNED' })
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'PUBLISHED', publishedAt: new Date() })
      const result = await svc.transition('r1', 'PUBLISHED' as any, 'd1')
      expect(txMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ publishedAt: expect.any(Date) }) }),
      )
      expect(result.publishedAt).not.toBeNull()
    })

    it('AMENDED increments rectificationCount and stores amendmentReason', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'SIGNED' })
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'AMENDED' })
      await svc.transition('r1', 'AMENDED' as any, 'd1', '补充影像细节')
      expect(txMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rectificationCount: { increment: 1 }, amendmentReason: '补充影像细节' }) }),
      )
    })

    it('SUPPLEMENTING increments supplementCount', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'SIGNED' })
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'SUPPLEMENTING' })
      await svc.transition('r1', 'SUPPLEMENTING' as any, 'd1')
      expect(txMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ supplementCount: { increment: 1 } }) }),
      )
    })

    it('REJECTED persists rejectReason', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'WRITING' })
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'REJECTED', rejectReason: '影像不清晰' })
      const result = await svc.transition('r1', 'REJECTED' as any, 'r1', '影像不清晰')
      expect(txMock.report.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ rejectReason: '影像不清晰' }) }),
      )
      expect(result.rejectReason).toBe('影像不清晰')
    })

    it('REJECTED without reason throws BadRequestException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'WRITING' })
      await expect(svc.transition('r1', 'REJECTED' as any, 'r1')).rejects.toThrow(BadRequestException)
    })

    it('rejects illegal transition WRITING → PUBLISHED with 400', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, state: 'WRITING' })
      await expect(svc.transition('r1', 'PUBLISHED' as any, 'd1')).rejects.toThrow(BadRequestException)
      expect(txMock.report.update).not.toHaveBeenCalled()
    })

    it('rejects illegal transition PENDING_ASSIGNMENT → SUBMITTED with 400', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(mockReport)
      await expect(svc.transition('r1', 'SUBMITTED' as any, 'd1')).rejects.toThrow(BadRequestException)
      expect(txMock.reportRevision.create).not.toHaveBeenCalled()
    })

    it('throws when report not found', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.transition('x', 'SUBMITTED' as any, 'd1')).rejects.toThrow(NotFoundException)
    })
  })

  // [v3.0.6.11-95 Wave3B P1] 批量状态流转 (POST /reports/batch-transition)
  // [v3.0.6.11-103 Wave 13] 流程质量门禁: WRITING 必须先 SUBMITTED 才能进审, 批量提交仅 SUBMITTED → INITIAL_REVIEW
  describe('batchTransition', () => {
    beforeEach(() => {
      mockPrisma.report.findMany.mockResolvedValue([
        { id: 'r1', state: 'SUBMITTED' },
        { id: 'r2', state: 'SUBMITTED' },
      ])
      // transition() 内部按 id 二次查报告, mock 需返回与批次行一致的状态
      mockPrisma.report.findUnique.mockImplementation(({ where }: any) =>
        Promise.resolve({ ...mockReport, id: where?.id ?? 'r1', state: 'SUBMITTED' }))
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'INITIAL_REVIEW' })
    })

    it('transitions all valid ids → INITIAL_REVIEW', async () => {
      const res = await svc.batchTransition(['r1', 'r2'], 'INITIAL_REVIEW' as any, 'd1')
      expect(res.succeeded).toEqual([
        { id: 'r1', state: 'INITIAL_REVIEW' },
        { id: 'r2', state: 'INITIAL_REVIEW' },
      ])
      expect(res.failed).toHaveLength(0)
      expect(txMock.reportRevision.create).toHaveBeenCalled()
    })

    it('collects per-id failures without blocking others (illegal transition)', async () => {
      mockPrisma.report.findMany.mockResolvedValue([
        { id: 'r1', state: 'SUBMITTED' },
        { id: 'r2', state: 'PUBLISHED' },
      ])
      const res = await svc.batchTransition(['r1', 'r2'], 'INITIAL_REVIEW' as any, 'd1')
      expect(res.succeeded).toEqual([{ id: 'r1', state: 'INITIAL_REVIEW' }])
      expect(res.failed).toHaveLength(1)
      expect(res.failed[0]?.id).toBe('r2')
      expect(res.failed[0]?.message).toContain('INVALID_TRANSITION')
    })

    it('rejects REJECTED without reason', async () => {
      const res = await svc.batchTransition(['r1'], 'REJECTED' as any, 'd1')
      expect(res.succeeded).toHaveLength(0)
      expect(res.failed[0]?.message).toContain('REJECTED 必须提供 reason')
      expect(txMock.reportRevision.create).not.toHaveBeenCalled()
    })

    it('reports missing ids as failed', async () => {
      mockPrisma.report.findMany.mockResolvedValue([{ id: 'r1', state: 'SUBMITTED' }])
      const res = await svc.batchTransition(['r1', 'gone'], 'INITIAL_REVIEW' as any, 'd1')
      expect(res.succeeded).toHaveLength(1)
      expect(res.failed).toEqual([{ id: 'gone', message: '报告不存在' }])
    })
  })
})
