import { Test } from '@nestjs/testing'
import { CdsController } from '../src/cds/cds.controller'
import { CdsService } from '../src/cds/cds.service'

describe('CdsController', () => {
  let ctrl: CdsController
  let svc: jest.Mocked<CdsService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CdsController],
      providers: [
        {
          provide: CdsService,
          useValue: {
            listGuidelines: jest.fn(),
            getGuideline: jest.fn(),
            createGuideline: jest.fn(),
            listAlerts: jest.fn(),
            acknowledgeAlert: jest.fn(),
            getDoseMonitoring: jest.fn(),
            getCdsStatistics: jest.fn(),
            listCdsRules: jest.fn(),
            createCdsRule: jest.fn(),
            getCdsManagement: jest.fn(),
            evaluateRule: jest.fn(),
            updateRulePriority: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(CdsController)
    svc = module.get(CdsService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('listGuidelines delegates to service', async () => {
    svc.listGuidelines.mockResolvedValue({ data: [] })
    const r = await ctrl.listGuidelines()
    expect(svc.listGuidelines).toHaveBeenCalled()
  })

  it('getGuideline delegates to service', async () => {
    svc.getGuideline.mockResolvedValue({ data: [{ key: 'g1' }] } as any)
    const r = await ctrl.getGuideline('g1')
    expect(svc.getGuideline).toHaveBeenCalledWith('g1')
  })

  it('createGuideline delegates to service', async () => {
    svc.createGuideline.mockResolvedValue({ data: [{ key: 'g-new' }] } as any)
    const body = { title: '新指南', content: '内容', modality: 'CT' }
    const r = await ctrl.createGuideline(body)
    expect(svc.createGuideline).toHaveBeenCalledWith(body)
  })

  it('listAlerts delegates to service', async () => {
    svc.listAlerts.mockResolvedValue({ data: [] })
    const r = await ctrl.listAlerts()
    expect(svc.listAlerts).toHaveBeenCalled()
  })

  it('acknowledgeAlert delegates to service', async () => {
    svc.acknowledgeAlert.mockResolvedValue({ data: [{ id: 'a1' }] } as any)
    const body = { ackedBy: 'u1' }
    const r = await ctrl.acknowledgeAlert(body)
    expect(svc.acknowledgeAlert).toHaveBeenCalledWith(body)
  })

  it('getDoseMonitoring delegates to service', async () => {
    svc.getDoseMonitoring.mockResolvedValue({ data: [] })
    const r = await ctrl.getDoseMonitoring()
    expect(svc.getDoseMonitoring).toHaveBeenCalled()
  })

  it('getCdsStatistics delegates to service', async () => {
    svc.getCdsStatistics.mockResolvedValue({ data: [] })
    const r = await ctrl.getCdsStatistics()
    expect(svc.getCdsStatistics).toHaveBeenCalled()
  })

  it('listCdsRules delegates to service', async () => {
    svc.listCdsRules.mockResolvedValue({ data: [] })
    const r = await ctrl.listCdsRules()
    expect(svc.listCdsRules).toHaveBeenCalled()
  })

  it('createCdsRule delegates to service', async () => {
    svc.createCdsRule.mockResolvedValue({ data: [{ key: 'r-new' }] } as any)
    const body = { name: '对比剂规则', condition: '增强检查', action: 'alert', priority: 50, enabled: true }
    const r = await ctrl.createCdsRule(body)
    expect(svc.createCdsRule).toHaveBeenCalledWith(body)
  })

  it('getCdsManagement delegates to service', async () => {
    svc.getCdsManagement.mockResolvedValue({ data: [] })
    const r = await ctrl.getCdsManagement()
    expect(svc.getCdsManagement).toHaveBeenCalled()
  })

  it('evaluateRule delegates to service', async () => {
    svc.evaluateRule.mockResolvedValue({ cards: [], systemActions: [] })
    const body = { ruleId: 'r1', patientId: 'p1', context: {} }
    const r = await ctrl.evaluateRule(body)
    expect(svc.evaluateRule).toHaveBeenCalledWith(body)
  })

  it('updateRulePriority delegates to service', async () => {
    svc.updateRulePriority.mockResolvedValue({ success: true })
    const body = { ruleId: 'r1', priority: 80 }
    const r = await ctrl.updateRulePriority(body)
    expect(svc.updateRulePriority).toHaveBeenCalledWith(body)
  })
})
