// [W1-B] dicom-compress 任务端点 spec: GET /tasks/:id (getTask) / cancel / delete
import { Test } from '@nestjs/testing'
import { DicomCompressController } from './dicom-compress.controller'
import { DicomCompressService } from './dicom-compress.service'
import { PrismaService } from '../../prisma/prisma.service'

describe('DicomCompressController (W1-B: getTask / tasks/:id)', () => {
  let controller: DicomCompressController

  const mockTask = {
    id: 'task-1',
    fileId: 'CT_CHEST/CT_CHEST_001.dcm',
    transferSyntax: '1.2.840.10008.1.2.4.90',
    status: 'done',
    progress: 100,
    originalSize: 1024000,
    compressedSize: 256000,
    ratio: 4,
    algorithmName: 'JPEG2000 Lossless',
    lossless: true,
    simulated: false,
    elapsedMs: 120,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  const serviceMock = {
    getStatus: jest.fn().mockResolvedValue(mockTask),
    cancelTask: jest.fn().mockResolvedValue({ ...mockTask, status: 'cancelled' }),
    deleteTask: jest.fn().mockResolvedValue({ success: true }),
    listInstances: jest.fn().mockResolvedValue([]),
    getSupportedSyntaxes: jest.fn().mockResolvedValue([]),
    listTasks: jest.fn().mockResolvedValue([]),
    getRatios: jest.fn().mockResolvedValue({ byAlgorithm: [], byModality: [], totalSavedBytes: 0, avgRatio: 0 }),
    getStats: jest.fn().mockResolvedValue({ totalTasks: 1, completedTasks: 1, failedTasks: 0, totalSavedBytes: 0, avgRatio: 0, algorithmDistribution: [] }),
  }

  beforeEach(async () => {
    jest.clearAllMocks()
    const moduleRef = await Test.createTestingModule({
      controllers: [DicomCompressController],
      providers: [
        { provide: DicomCompressService, useValue: serviceMock },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile()
    controller = moduleRef.get(DicomCompressController)
  })

  it('GET tasks/:id returns task detail (delegates to getStatus)', async () => {
    const res = await controller.getTask('task-1')
    expect(serviceMock.getStatus).toHaveBeenCalledWith('task-1')
    expect(res?.id).toBe('task-1')
  })

  it('GET tasks lists tasks', async () => {
    await controller.listTasks({})
    expect(serviceMock.listTasks).toHaveBeenCalled()
  })

  it('POST tasks/:id/cancel cancels a task', async () => {
    const res = await controller.cancelTask('task-1')
    expect(serviceMock.cancelTask).toHaveBeenCalledWith('task-1')
    expect(res?.status).toBe('cancelled')
  })

  it('DELETE tasks/:id deletes a task', async () => {
    const res = await controller.deleteTask('task-1')
    expect(serviceMock.deleteTask).toHaveBeenCalledWith('task-1')
    expect(res.success).toBe(true)
  })

  it('GET stats returns compression statistics', async () => {
    const res = await controller.getStats()
    expect(res.totalTasks).toBe(1)
    expect(serviceMock.getStats).toHaveBeenCalled()
  })
})
