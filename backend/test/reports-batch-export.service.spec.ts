import { Test } from '@nestjs/testing'
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { ReportsService } from '../src/reports/reports.service'
import { PrismaService } from '../src/prisma/prisma.service'
import { QueueService } from '../src/queue/queue.service'
import { createNoopGateway, NotificationsGateway } from '../src/notifications/notifications.gateway'
import { SystemConfigService } from '../src/system-storage/system-config.service'
import { FollowUpService } from '../src/modules/followup/followup.service'
import { batchExportStore } from '../src/queue/batch-export.store'

const mockSystemConfig = {
  getNumber: jest.fn().mockResolvedValue(20),
  getString: jest.fn().mockResolvedValue(undefined),
  get: jest.fn(),
  invalidate: jest.fn(),
}

describe('ReportsService (batch export)', () => {
  let svc: ReportsService
  let queue: any

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
    $transaction: jest.fn((fn: any) => fn({ report: { update: jest.fn() }, reportRevision: { create: jest.fn() } })),
  }

  const mockQueue = { addReportExport: jest.fn(), addBatchExport: jest.fn() }

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
    queue = module.get(QueueService)
    batchExportStore.clear()
  })

  beforeEach(() => jest.clearAllMocks())

  it('creates a batch export task and enqueues a BullMQ job', async () => {
    const result = await svc.createBatchExport({ ids: ['r1', 'r2'], format: 'pdf' }, 'u1')
    expect(result.taskId).toMatch(/^batch-/)
    expect(result.status).toBe('pending')
    expect(result.total).toBe(2)
    expect(result.format).toBe('pdf')
    expect(queue.addBatchExport).toHaveBeenCalledWith(
      expect.objectContaining({ taskId: result.taskId, ids: ['r1', 'r2'], format: 'pdf', userId: 'u1' }),
    )
  })

  it('rejects empty ids', async () => {
    await expect(svc.createBatchExport({ ids: [] }, 'u1')).rejects.toBeInstanceOf(BadRequestException)
  })

  it('reports task status including progress and downloads', async () => {
    const created = await svc.createBatchExport({ ids: ['r1'], format: 'html' }, 'u1')
    batchExportStore.update(created.taskId, { status: 'running', progress: 50, done: 0 })
    batchExportStore.addDownload(created.taskId, {
      reportId: 'r1',
      fileName: 'report-r1.html',
      filePath: '/exports/report-r1.html',
      sizeBytes: 1024,
      format: 'html',
      downloadUrl: '/reports/export-files/report-r1.html',
    })
    const status = await svc.getBatchExport(created.taskId)
    expect(status.status).toBe('running')
    expect(status.progress).toBe(50)
    expect(status.downloads).toHaveLength(1)
    expect(status.downloads[0].downloadUrl).toContain('/reports/export-files/')
  })

  it('throws NotFoundException for unknown task', async () => {
    await expect(svc.getBatchExport('batch-nope')).rejects.toBeInstanceOf(NotFoundException)
  })
})
