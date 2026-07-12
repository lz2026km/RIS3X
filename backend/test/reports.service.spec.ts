import { Test } from '@nestjs/testing'
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common'
import { ReportsService } from '../src/reports/reports.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'

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
      await svc.list({ state: 'PUBLISHED' as any })
      expect(mockPrisma.report.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { state: 'PUBLISHED' } })
      )
    })
  })

  describe('get', () => {
    it('returns report with relations', async () => {
      mockPrisma.report.findUnique.mockResolvedValue({ ...mockReport, patient: {}, radiologist: {}, revisions: [] })
      const result = await svc.get('r1')
      expect(result.id).toBe('r1')
    })

    it('throws NotFoundException', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
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
      txMock.report.update.mockResolvedValue({ ...mockReport, state: 'SUBMITTED' })
      const result = await svc.transition('r1', 'SUBMITTED' as any, 'd1')
      expect(result.state).toBe('SUBMITTED')
    })

    it('throws when report not found', async () => {
      mockPrisma.report.findUnique.mockResolvedValue(null)
      await expect(svc.transition('x', 'SUBMITTED' as any, 'd1')).rejects.toThrow(NotFoundException)
    })
  })
})
