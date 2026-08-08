import { Test } from '@nestjs/testing'
import { PrismaService } from '../../prisma/prisma.service'
import { CriticalAlertModule } from './critical-alert.module'
import { CriticalAlertController } from './critical-alert.controller'
import { CriticalAlertService } from './critical-alert.service'

describe('CriticalAlertModule DI wiring', () => {
  it('boots with mocked PrismaService (controller+service resolve)', async () => {
    const mod = await Test.createTestingModule({
      imports: [CriticalAlertModule],
    })
      .overrideProvider(PrismaService)
      .useValue({
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        criticalValue: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      })
      .compile()
    const app = mod.createNestApplication()
    await app.init()
    expect(app.get(CriticalAlertController)).toBeDefined()
    expect(app.get(CriticalAlertService)).toBeDefined()
    await app.close()
  })
})
