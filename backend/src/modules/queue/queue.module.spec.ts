import { Test } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import { CallQueueModule } from './queue.module'
import { QueueController } from './queue.controller'
import { QueueService } from './queue.service'

describe('CallQueueModule DI wiring', () => {
  it('boots with mocked PrismaService (controller+service resolve)', async () => {
    const mod = await Test.createTestingModule({
      imports: [CallQueueModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        device: { findMany: jest.fn() },
        exam: { findMany: jest.fn(), count: jest.fn() },
      })
      .compile()
    const app = mod.createNestApplication()
    await app.init()
    expect(app.get(QueueController)).toBeDefined()
    expect(app.get(QueueService)).toBeDefined()
    await app.close()
  })
})
