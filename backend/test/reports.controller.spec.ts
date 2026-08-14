import { Test } from '@nestjs/testing'
import { ReportsController, UpdateReportSchema } from '../src/reports/reports.controller'
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
            batchTransition: jest.fn(),
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
    const r = await ctrl.list('0', '20', undefined, undefined, undefined, undefined, undefined, undefined, undefined)
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 20, states: undefined }))
  })

  it('list with valid state filter', async () => {
    svc.list.mockResolvedValue({ items: [], total: 0, skip: 0, take: 20 })
    await ctrl.list('0', '20', 'PUBLISHED')
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ states: ['PUBLISHED'] }))
  })

  // [v3.0.6.11-95 Wave3B P1] list 筛选参数透传
  it('list supports status array / modality / priority / patientId / doctorId / keyword', async () => {
    svc.list.mockResolvedValue({ items: [], total: 0, skip: 0, take: 20 })
    await ctrl.list('0', '20', undefined, 'SIGNED,PUBLISHED', 'CT', 'URGENT', 'p1', 'd1', '张三')
    expect(svc.list).toHaveBeenCalledWith({
      skip: 0, take: 20,
      states: ['SIGNED', 'PUBLISHED'],
      modality: 'CT', priority: 'URGENT', patientId: 'p1', doctorId: 'd1', keyword: '张三',
    })
  })

  it('list ignores invalid state values', async () => {
    svc.list.mockResolvedValue({ items: [], total: 0, skip: 0, take: 20 })
    await ctrl.list('0', '20', 'NOT_A_STATE,已签发')
    expect(svc.list).toHaveBeenCalledWith(expect.objectContaining({ states: undefined }))
  })

  it('batchTransition delegates to service with user from request', async () => {
    svc.batchTransition.mockResolvedValue({ succeeded: [], failed: [] })
    const r = await ctrl.batchTransition(
      { ids: ['r1', 'r2'], to: 'INITIAL_REVIEW' as any, reason: '批量提交审核' },
      { user: { id: 'd1' } } as any,
    )
    expect(svc.batchTransition).toHaveBeenCalledWith(['r1', 'r2'], 'INITIAL_REVIEW', 'd1', '批量提交审核')
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

  it('transition delegates to service with user from request', async () => {
    svc.transition.mockResolvedValue(mockReport({ state: 'WRITING', version: 2 }) as any)
    const r = await ctrl.transition('r1', { to: 'WRITING' as any, reason: 'start' }, { user: { id: 'd1' } } as any)
    expect(svc.transition).toHaveBeenCalledWith('r1', 'WRITING', 'd1', 'start')
  })

  it('transition falls back to body actorId when request has no user', async () => {
    svc.transition.mockResolvedValue(mockReport({ state: 'WRITING', version: 2 }) as any)
    await ctrl.transition('r1', { to: 'WRITING' as any, actorId: 'd2' }, {} as any)
    expect(svc.transition).toHaveBeenCalledWith('r1', 'WRITING', 'd2', undefined)
  })

  it('PATCH body with state is stripped by schema (cannot bypass transition)', async () => {
    svc.update.mockResolvedValue(mockReport() as any)
    const parsed = UpdateReportSchema.parse({ findings: 'new', conclusion: 'c', state: 'PUBLISHED' })
    expect(parsed).not.toHaveProperty('state')
    await ctrl.update('r1', parsed)
    expect(svc.update).toHaveBeenCalledWith('r1', { findings: 'new', conclusion: 'c' })
  })
})
