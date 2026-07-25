import { Test } from '@nestjs/testing'
import { FinanceService } from '../src/finance/finance.service'
import { PrismaService } from '../src/prisma/prisma.service'

describe('FinanceService', () => {
  let svc: FinanceService
  let prisma: any

  const mockChargeItem = { id: 'c1', tenantId: 't1', code: 'CT001', name: 'CT平扫', category: 'CT', unitPrice: 500, active: true, createdAt: new Date(), updatedAt: new Date() }
  const mockInvoice = { id: 'inv1', tenantId: 't1', patientId: 'p1', invoiceNumber: 'INV001', totalAmount: 500, paidAmount: 0, status: 'PENDING', items: [], issuedAt: new Date(), createdAt: new Date(), updatedAt: new Date() }

  const mockPrisma = {
    chargeItem: {
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    invoice: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
  }

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FinanceService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile()
    svc = module.get(FinanceService)
    prisma = module.get(PrismaService)
  })

  beforeEach(() => jest.clearAllMocks())

  describe('listChargeItems', () => {
    it('returns charge items ordered by createdAt desc', async () => {
      mockPrisma.chargeItem.findMany.mockResolvedValue([mockChargeItem])
      const result = await svc.listChargeItems()
      expect(mockPrisma.chargeItem.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createChargeItem', () => {
    it('creates charge item', async () => {
      mockPrisma.chargeItem.create.mockResolvedValue(mockChargeItem)
      const result = await svc.createChargeItem({ code: 'CT001', name: 'CT平扫', category: 'CT', unitPrice: 500 })
      expect(result.data).toHaveLength(1)
      expect(result.data[0].id).toBe('c1')
    })
  })

  describe('updateChargeItem', () => {
    it('updates charge item', async () => {
      mockPrisma.chargeItem.update.mockResolvedValue({ ...mockChargeItem, unitPrice: 600 })
      const result = await svc.updateChargeItem('c1', { unitPrice: 600 })
      expect(mockPrisma.chargeItem.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { unitPrice: 600 } })
      expect(result.data[0].unitPrice).toBe(600)
    })
  })

  describe('listInvoices', () => {
    it('returns invoices ordered by createdAt desc', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([mockInvoice])
      const result = await svc.listInvoices()
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({ orderBy: { createdAt: 'desc' } })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('createInvoice', () => {
    it('creates invoice', async () => {
      mockPrisma.invoice.create.mockResolvedValue(mockInvoice)
      const result = await svc.createInvoice({ patientId: 'p1', chargeItemIds: ['c1'] })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getInvoice', () => {
    it('returns invoice when found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(mockInvoice)
      const result = await svc.getInvoice('inv1')
      expect(result.data).toHaveLength(1)
    })

    it('returns empty array when not found', async () => {
      mockPrisma.invoice.findUnique.mockResolvedValue(null)
      const result = await svc.getInvoice('x')
      expect(result.data).toEqual([])
    })
  })

  describe('payInvoice', () => {
    it('updates invoice status to PAID', async () => {
      mockPrisma.invoice.update.mockResolvedValue({ ...mockInvoice, status: 'PAID' })
      const result = await svc.payInvoice({ id: 'inv1', paymentMethod: 'CASH', amount: 500 })
      expect(mockPrisma.invoice.update).toHaveBeenCalledWith({
        where: { id: 'inv1' },
        data: { status: 'PAID', paymentMethod: 'CASH', amount: 500 },
      })
      expect(result.data[0].status).toBe('PAID')
    })
  })

  describe('getRevenueAnalysis', () => {
    it('returns grouped invoice data', async () => {
      mockPrisma.invoice.groupBy.mockResolvedValue([{ status: 'PAID', _sum: { totalAmount: 1000, paidAmount: 1000 }, _count: { id: 2 } }])
      const result = await svc.getRevenueAnalysis()
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getCostAccounting', () => {
    it('returns active charge items', async () => {
      mockPrisma.chargeItem.findMany.mockResolvedValue([mockChargeItem])
      const result = await svc.getCostAccounting()
      expect(mockPrisma.chargeItem.findMany).toHaveBeenCalledWith({ where: { active: true } })
      expect(result.data).toHaveLength(1)
    })
  })

  describe('getFinancialReports', () => {
    it('returns last 100 invoices', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([mockInvoice])
      const result = await svc.getFinancialReports()
      expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith({ orderBy: { issuedAt: 'desc' }, take: 100 })
      expect(result.data).toHaveLength(1)
    })
  })
})
