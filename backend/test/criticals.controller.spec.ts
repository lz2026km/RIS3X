import { Test } from '@nestjs/testing'
import { CriticalsController } from '../src/criticals/criticals.controller'
import { CriticalsService } from '../src/criticals/criticals.service'

const mockCritical = (overrides: Record<string, any> = {}) => ({
  id: 'c1', examId: null, description: '危急值', severity: 'HIGH',
  method: 'SYSTEM', state: 'FOUND', tenantId: 't1',
  createdAt: new Date(), updatedAt: new Date(),
  ...overrides,
})

describe('CriticalsController', () => {
  let ctrl: CriticalsController
  let svc: jest.Mocked<CriticalsService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CriticalsController],
      providers: [
        {
          provide: CriticalsService,
          useValue: {
            list: jest.fn(),
            get: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            notify: jest.fn(),
            escalate: jest.fn(),
            voiceCall: jest.fn(),
            clinicalReceipt: jest.fn(),
            listHistory: jest.fn(),
            getStats: jest.fn(),
            getMissedStats: jest.fn(),
            getNotificationStats: jest.fn(),
            getValue5StepList: jest.fn(),
            runEscalationChain: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(CriticalsController)
    svc = module.get(CriticalsService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('list delegates to service', async () => {
    svc.list.mockResolvedValue({ items: [], total: 0 })
    await ctrl.list('0', '20', undefined, undefined, undefined, undefined)
    expect(svc.list).toHaveBeenCalledWith({ skip: 0, take: 20, state: undefined, severity: undefined, dateFrom: undefined, dateTo: undefined })
  })

  it('list with filters', async () => {
    svc.list.mockResolvedValue({ items: [mockCritical() as any], total: 1 })
    await ctrl.list('0', '20', 'NOTIFIED', 'URGENT', '2026-01-01', '2026-12-31')
    expect(svc.list).toHaveBeenCalledWith({ skip: 0, take: 20, state: 'NOTIFIED', severity: 'URGENT', dateFrom: '2026-01-01', dateTo: '2026-12-31' })
  })

  it('get delegates to service', async () => {
    svc.get.mockResolvedValue(mockCritical() as any)
    const r = await ctrl.get('c1')
    expect(svc.get).toHaveBeenCalledWith('c1')
    expect(r.id).toBe('c1')
  })

  it('create delegates to service', async () => {
    svc.create.mockResolvedValue(mockCritical() as any)
    const dto = { description: '危急值', severity: 'HIGH' as const, method: 'SYSTEM' as const }
    const r = await ctrl.create(dto)
    expect(svc.create).toHaveBeenCalled()
  })

  it('update delegates to service', async () => {
    svc.update.mockResolvedValue(mockCritical({ description: 'updated' }) as any)
    const r = await ctrl.update('c1', { description: 'updated' })
    expect(svc.update).toHaveBeenCalledWith('c1', { description: 'updated' })
  })

  it('delete delegates to service', async () => {
    svc.delete.mockResolvedValue({ ok: true })
    const r = await ctrl.delete('c1')
    expect(svc.delete).toHaveBeenCalledWith('c1')
    expect(r.ok).toBe(true)
  })

  it('notify delegates to service', async () => {
    svc.notify.mockResolvedValue({ count: 2, status: 'NOTIFIED' })
    const dto = {
      criticalId: 'c1', patientName: '张三', patientId: 'p1',
      category: 'URGENT' as const, finding: '危急值', channels: ['SMS' as const, 'PHONE' as const],
      recipientName: '医生', recipientDept: '急诊', recipientPhone: '13800138000',
    }
    const r = await ctrl.notify(dto)
    expect(svc.notify).toHaveBeenCalled()
    expect(r.count).toBe(2)
  })

  it('escalate delegates to service', async () => {
    svc.escalate.mockResolvedValue({ count: 3 })
    const dto = { criticalId: 'c1', reason: '未响应', newRecipients: [{ name: '主任', dept: 'ICU', phone: '13900139000' }] }
    const r = await ctrl.escalate(dto)
    expect(svc.escalate).toHaveBeenCalled()
    expect(r.count).toBe(3)
  })

  it('voiceCall delegates to service', async () => {
    svc.voiceCall.mockResolvedValue(mockCritical({ state: 'VOICE_CALLED' }) as any)
    const r = await ctrl.voiceCall('c1', { calledBy: 'd1', phoneNumber: '13800138000' })
    expect(svc.voiceCall).toHaveBeenCalledWith('c1', { calledBy: 'd1', phoneNumber: '13800138000' })
  })

  it('clinicalReceipt delegates to service', async () => {
    svc.clinicalReceipt.mockResolvedValue(mockCritical({ state: 'RECEIPTED' }) as any)
    const r = await ctrl.clinicalReceipt('c1', { confirmedBy: 'd1', comment: '已确认' })
    expect(svc.clinicalReceipt).toHaveBeenCalledWith('c1', { confirmedBy: 'd1', comment: '已确认' })
  })

  it('listHistory delegates to service', async () => {
    svc.listHistory.mockResolvedValue([{ id: 'n1' }] as any)
    const r = await ctrl.listHistory('c1')
    expect(svc.listHistory).toHaveBeenCalledWith('c1')
  })
})
