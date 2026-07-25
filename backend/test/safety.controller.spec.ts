import { Test } from '@nestjs/testing'
import { SafetyController } from '../src/safety/safety.controller'
import { SafetyService } from '../src/safety/safety.service'

describe('SafetyController', () => {
  let ctrl: SafetyController
  let svc: jest.Mocked<SafetyService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [SafetyController],
      providers: [
        {
          provide: SafetyService,
          useValue: {
            createAdverseEvent: jest.fn(),
            getAdverseEvents: jest.fn(),
            getAdverseEvent: jest.fn(),
            updateAdverseEvent: jest.fn(),
            deleteAdverseEvent: jest.fn(),
            createRcaInvestigation: jest.fn(),
            getRcaInvestigations: jest.fn(),
            getRcaInvestigation: jest.fn(),
            updateRcaInvestigation: jest.fn(),
            deleteRcaInvestigation: jest.fn(),
            createRiskItem: jest.fn(),
            getRiskItems: jest.fn(),
            getRiskItem: jest.fn(),
            updateRiskItem: jest.fn(),
            deleteRiskItem: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(SafetyController)
    svc = module.get(SafetyService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('createAdverseEvent delegates to service', async () => {
    svc.createAdverseEvent.mockResolvedValue({ id: 'ae1' } as any)
    const dto = { eventType: 'FALL' as const, severity: 'MODERATE' as const, description: '摔倒', department: '放射科', reportedBy: 'u1' }
    const r = await ctrl.createAdverseEvent(dto)
    expect(svc.createAdverseEvent).toHaveBeenCalledWith(dto)
    expect(r.id).toBe('ae1')
  })

  it('getAdverseEvents delegates to service', async () => {
    svc.getAdverseEvents.mockResolvedValue([])
    await ctrl.getAdverseEvents('REPORTED', 'MODERATE', 'FALL')
    expect(svc.getAdverseEvents).toHaveBeenCalledWith({ status: 'REPORTED', severity: 'MODERATE', eventType: 'FALL' })
  })

  it('getAdverseEvent delegates to service', async () => {
    svc.getAdverseEvent.mockResolvedValue({ id: 'ae1' } as any)
    const r = await ctrl.getAdverseEvent('ae1')
    expect(svc.getAdverseEvent).toHaveBeenCalledWith('ae1')
    expect(r.id).toBe('ae1')
  })

  it('updateAdverseEvent delegates to service', async () => {
    svc.updateAdverseEvent.mockResolvedValue({ id: 'ae1' } as any)
    const r = await ctrl.updateAdverseEvent('ae1', { description: 'updated' })
    expect(svc.updateAdverseEvent).toHaveBeenCalledWith('ae1', { description: 'updated' })
  })

  it('deleteAdverseEvent delegates to service', async () => {
    svc.deleteAdverseEvent.mockResolvedValue({ id: 'ae1' } as any)
    const r = await ctrl.deleteAdverseEvent('ae1')
    expect(svc.deleteAdverseEvent).toHaveBeenCalledWith('ae1')
    expect(r.id).toBe('ae1')
  })

  it('createRcaInvestigation delegates to service', async () => {
    svc.createRcaInvestigation.mockResolvedValue({ id: 'rca1' } as any)
    const dto = { adverseEventId: 'ae1', eventTitle: 'RCA', dateOccurred: '2026-01-01T00:00:00Z' }
    const r = await ctrl.createRcaInvestigation(dto)
    expect(svc.createRcaInvestigation).toHaveBeenCalledWith(dto)
    expect(r.id).toBe('rca1')
  })

  it('getRcaInvestigations delegates to service', async () => {
    svc.getRcaInvestigations.mockResolvedValue([])
    await ctrl.getRcaInvestigations('open')
    expect(svc.getRcaInvestigations).toHaveBeenCalledWith({ capaStatus: 'open' })
  })

  it('getRcaInvestigation delegates to service', async () => {
    svc.getRcaInvestigation.mockResolvedValue({ id: 'rca1' } as any)
    const r = await ctrl.getRcaInvestigation('rca1')
    expect(svc.getRcaInvestigation).toHaveBeenCalledWith('rca1')
  })

  it('updateRcaInvestigation delegates to service', async () => {
    svc.updateRcaInvestigation.mockResolvedValue({ id: 'rca1' } as any)
    const r = await ctrl.updateRcaInvestigation('rca1', { conclusion: 'done' })
    expect(svc.updateRcaInvestigation).toHaveBeenCalledWith('rca1', { conclusion: 'done' })
  })

  it('deleteRcaInvestigation delegates to service', async () => {
    svc.deleteRcaInvestigation.mockResolvedValue({ id: 'rca1' } as any)
    const r = await ctrl.deleteRcaInvestigation('rca1')
    expect(svc.deleteRcaInvestigation).toHaveBeenCalledWith('rca1')
  })

  it('createRiskItem delegates to service', async () => {
    svc.createRiskItem.mockResolvedValue({ id: 'ri1' } as any)
    const dto = { riskType: 'CLINICAL', title: '辐射', category: 'clinical', description: '超标', likelihood: 3, severity: 4, identifiedBy: 'u1' }
    const r = await ctrl.createRiskItem(dto)
    expect(svc.createRiskItem).toHaveBeenCalledWith(dto)
    expect(r.id).toBe('ri1')
  })

  it('getRiskItems delegates to service', async () => {
    svc.getRiskItems.mockResolvedValue([])
    await ctrl.getRiskItems('high', 'open')
    expect(svc.getRiskItems).toHaveBeenCalledWith({ riskLevel: 'high', status: 'open' })
  })

  it('getRiskItem delegates to service', async () => {
    svc.getRiskItem.mockResolvedValue({ id: 'ri1' } as any)
    const r = await ctrl.getRiskItem('ri1')
    expect(svc.getRiskItem).toHaveBeenCalledWith('ri1')
  })

  it('updateRiskItem delegates to service', async () => {
    svc.updateRiskItem.mockResolvedValue({ id: 'ri1' } as any)
    const r = await ctrl.updateRiskItem('ri1', { status: 'closed' })
    expect(svc.updateRiskItem).toHaveBeenCalledWith('ri1', { status: 'closed' })
  })

  it('deleteRiskItem delegates to service', async () => {
    svc.deleteRiskItem.mockResolvedValue({ id: 'ri1' } as any)
    const r = await ctrl.deleteRiskItem('ri1')
    expect(svc.deleteRiskItem).toHaveBeenCalledWith('ri1')
  })
})
