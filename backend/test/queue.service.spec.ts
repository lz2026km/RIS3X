import { QueueService } from '../src/queue/queue.service'
import type { Queue } from 'bull'

describe('QueueService', () => {
  let svc: QueueService

  const mockQueue = {
    add: jest.fn(),
  } as any as Queue

  beforeAll(() => {
    svc = new QueueService(mockQueue, mockQueue, mockQueue)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('addReportExport', () => {
    it('adds export job with retry config', async () => {
      await svc.addReportExport({ reportId: 'r1', format: 'PDF', userId: 'u1' })
      expect(mockQueue.add).toHaveBeenCalledWith(
        'export',
        { reportId: 'r1', format: 'PDF', userId: 'u1' },
        expect.objectContaining({ attempts: 3 }),
      )
    })
  })

  describe('addHl7Send', () => {
    it('adds HL7 send job', async () => {
      await svc.addHl7Send({ reportId: 'r1', destination: '127.0.0.1:2575', payload: 'MSH|...' })
      expect(mockQueue.add).toHaveBeenCalledWith(
        'send',
        expect.objectContaining({ reportId: 'r1' }),
        expect.objectContaining({ attempts: 3 }),
      )
    })
  })

  describe('addAiInference', () => {
    it('adds AI inference job', async () => {
      await svc.addAiInference({ studyId: 's1', modality: 'CT', imageUrls: ['img1.dcm'] })
      expect(mockQueue.add).toHaveBeenCalledWith(
        'infer',
        { studyId: 's1', modality: 'CT', imageUrls: ['img1.dcm'] },
        expect.objectContaining({ attempts: 2 }),
      )
    })
  })
})
