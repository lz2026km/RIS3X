import { Test } from '@nestjs/testing'
import { ReportsController } from '../src/reports/reports.controller'
import { ReportsService } from '../src/reports/reports.service'

const mockReport = (overrides: Record<string, any> = {}) => ({
  id: 'r1', patientId: 'p1', examId: null, radiologistId: null,
  findings: '', conclusion: '', state: 'PENDING_ASSIGNMENT',
  version: 1, tenantId: 't', signedAt: null, isCritical: false,
  qualityScore: null, createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
})

const mockReportWithRelations = () => ({
  ...mockReport(),
  patient: { id: 'p1', name: '张三', gender: 'MALE' as const },
  radiologist: null,
  revisions: [],
})

describe('ReportsController', () => {
  let ctrl: ReportsController
  let svc: jest.Mocked<ReportsService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: {
            list: jest.fn(),
            get: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            transition: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(ReportsController)
    svc = module.get(ReportsService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('list delegates to service', async () => {
    svc.list.mockResolvedValue({ items: [], total: 0, skip: 0, take: 20 })
    const r = await ctrl.list('0', '20', undefined)
    expect(svc.list).toHaveBeenCalledWith({ skip: 0, take: 20, state: undefined })
  })

  it('list with valid state filter', async () => {
    svc.list.mockResolvedValue({ items: [], total: 0, skip: 0, take: 20 })
    await ctrl.list('0', '20', 'PUBLISHED')
    expect(svc.list).toHaveBeenCalledWith({ skip: 0, take: 20, state: 'PUBLISHED' })
  })

  it('get delegates to service', async () => {
    svc.get.mockResolvedValue(mockReportWithRelations() as any)
    const r = await ctrl.get('r1')
    expect(svc.get).toHaveBeenCalledWith('r1')
  })

  it('create delegates to service', async () => {
    svc.create.mockResolvedValue(mockReport() as any)
    const dto = { patientId: 'p1', findings: 'f', conclusion: 'c' }
    const r = await ctrl.create(dto)
    expect(svc.create).toHaveBeenCalled()
  })

  it('update delegates to service', async () => {
    svc.update.mockResolvedValue(mockReport({ findings: 'new', version: 2 }) as any)
    const r = await ctrl.update('r1', { findings: 'new' })
    expect(svc.update).toHaveBeenCalledWith('r1', { findings: 'new' })
  })

  it('delete delegates to service', async () => {
    svc.delete.mockResolvedValue(mockReport({ state: 'WITHDRAWN' }) as any)
    const r = await ctrl.delete('r1', { reason: 'mistake' }, { user: { id: 'u1' } } as any)
    expect(svc.delete).toHaveBeenCalledWith('r1', 'mistake', 'u1')
  })

  it('transition delegates to service', async () => {
    svc.transition.mockResolvedValue(mockReport({ state: 'SUBMITTED', version: 2 }) as any)
    const r = await ctrl.transition('r1', { to: 'SUBMITTED' as any, actorId: 'd1', reason: 'review' })
    expect(svc.transition).toHaveBeenCalledWith('r1', 'SUBMITTED', 'd1', 'review')
  })
})
