import { Test } from '@nestjs/testing'
import { FinanceController } from '../src/finance/finance.controller'
import { FinanceService } from '../src/finance/finance.service'

describe('FinanceController', () => {
  let ctrl: FinanceController
  let svc: jest.Mocked<FinanceService>

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [FinanceController],
      providers: [
        {
          provide: FinanceService,
          useValue: {
            listChargeItems: jest.fn(),
            createChargeItem: jest.fn(),
            updateChargeItem: jest.fn(),
            deleteChargeItem: jest.fn(),
            listInvoices: jest.fn(),
            createInvoice: jest.fn(),
            getInvoice: jest.fn(),
            payInvoice: jest.fn(),
            getRevenueAnalysis: jest.fn(),
            getCostAccounting: jest.fn(),
            getFinancialReports: jest.fn(),
          },
        },
      ],
    }).compile()
    ctrl = module.get(FinanceController)
    svc = module.get(FinanceService)
  })

  beforeEach(() => jest.clearAllMocks())

  it('listChargeItems delegates to service', async () => {
    svc.listChargeItems.mockResolvedValue({ data: [] })
    const r = await ctrl.listChargeItems()
    expect(svc.listChargeItems).toHaveBeenCalled()
  })

  it('createChargeItem delegates to service', async () => {
    svc.createChargeItem.mockResolvedValue({ data: [{ id: 'c1' }] } as any)
      const body = { code: 'CT001', name: 'CT平扫', category: 'CT', unitPrice: 500 }
    const r = await ctrl.createChargeItem(body)
    expect(svc.createChargeItem).toHaveBeenCalledWith(body)
  })

  it('updateChargeItem delegates to service', async () => {
    svc.updateChargeItem.mockResolvedValue({ data: [{ id: 'c1' }] } as any)
    const body = { amount: 600 }
    const r = await ctrl.updateChargeItem('c1', body)
    expect(svc.updateChargeItem).toHaveBeenCalledWith('c1', body)
  })

  it('deleteChargeItem delegates to service', async () => {
    svc.deleteChargeItem.mockResolvedValue({ data: [{ id: 'c1' }] } as any)
    const r = await ctrl.deleteChargeItem('c1')
    expect(svc.deleteChargeItem).toHaveBeenCalledWith('c1')
  })

  it('listInvoices delegates to service', async () => {
    svc.listInvoices.mockResolvedValue({ data: [] })
    const r = await ctrl.listInvoices()
    expect(svc.listInvoices).toHaveBeenCalled()
  })

  it('createInvoice delegates to service', async () => {
    svc.createInvoice.mockResolvedValue({ data: [{ id: 'inv1' }] } as any)
    const body = { patientId: 'p1', chargeItemIds: ['c1'], discount: 0 }
    const r = await ctrl.createInvoice(body)
    expect(svc.createInvoice).toHaveBeenCalledWith(body)
  })

  it('getInvoice delegates to service', async () => {
    svc.getInvoice.mockResolvedValue({ data: [{ id: 'inv1' }] } as any)
    const r = await ctrl.getInvoice('inv1')
    expect(svc.getInvoice).toHaveBeenCalledWith('inv1')
  })

  it('payInvoice delegates to service', async () => {
    svc.payInvoice.mockResolvedValue({ data: [{ id: 'inv1' }] } as any)
    const body = { paymentMethod: 'CASH' as const, amount: 500 }
    const r = await ctrl.payInvoice(body)
    expect(svc.payInvoice).toHaveBeenCalledWith(body)
  })

  it('getRevenueAnalysis delegates to service', async () => {
    svc.getRevenueAnalysis.mockResolvedValue({ data: [] })
    const r = await ctrl.getRevenueAnalysis()
    expect(svc.getRevenueAnalysis).toHaveBeenCalled()
  })

  it('getCostAccounting delegates to service', async () => {
    svc.getCostAccounting.mockResolvedValue({ data: [] })
    const r = await ctrl.getCostAccounting()
    expect(svc.getCostAccounting).toHaveBeenCalled()
  })

  it('getFinancialReports delegates to service', async () => {
    svc.getFinancialReports.mockResolvedValue({ data: [] })
    const r = await ctrl.getFinancialReports()
    expect(svc.getFinancialReports).toHaveBeenCalled()
  })
})
