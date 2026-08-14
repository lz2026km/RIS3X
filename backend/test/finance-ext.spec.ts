import { FinanceService } from '../src/finance/finance.service'

// [v3.0.6.11-99 Wave 10D] finance 扩展端点: overview / daily-trend / by-modality / accounts-receivable
describe('FinanceService Wave10D (overview/daily-trend/by-modality/accounts-receivable)', () => {
  let svc: FinanceService
  let mockPrisma: any

  const invoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'inv1',
    tenantId: 't1',
    patientId: 'p1',
    invoiceNumber: 'INV001',
    totalAmount: 1000,
    paidAmount: 1000,
    insuranceAmount: null,
    status: 'PAID',
    items: [],
    issuedAt: new Date(),
    paidAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const chargeItem = (overrides: Record<string, unknown> = {}) => ({
    id: 'c1',
    tenantId: 't1',
    code: 'CT001',
    name: 'CT平扫',
    category: 'CT',
    unitPrice: 500,
    insuranceCoverage: null,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  beforeEach(() => {
    mockPrisma = {
      invoice: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
      chargeItem: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
    }
    svc = new FinanceService(mockPrisma)
  })

  describe('getOverview', () => {
    it('computes income/cost/profit from month invoices + charge items', async () => {
      mockPrisma.invoice.findMany
        .mockResolvedValueOnce([
          invoice({ totalAmount: 1000, paidAmount: 1000, status: 'PAID' }),
          invoice({ id: 'inv2', totalAmount: 800, paidAmount: 0, status: 'UNPAID' }),
          invoice({ id: 'inv3', totalAmount: 500, paidAmount: 500, status: 'PARTIAL' }),
        ])
        .mockResolvedValueOnce([invoice({ id: 'inv0', totalAmount: 900, paidAmount: 900, status: 'PAID' })])
      mockPrisma.invoice.groupBy.mockResolvedValue([
        { status: 'PAID', _sum: { totalAmount: 1000, paidAmount: 1000 }, _count: { id: 1 } },
        { status: 'UNPAID', _sum: { totalAmount: 800, paidAmount: 0 }, _count: { id: 1 } },
        { status: 'PARTIAL', _sum: { totalAmount: 500, paidAmount: 500 }, _count: { id: 1 } },
      ])
      mockPrisma.chargeItem.findMany.mockResolvedValue([chargeItem(), chargeItem({ id: 'c2', unitPrice: 300 })])
      mockPrisma.chargeItem.groupBy.mockResolvedValue([
        { category: 'CT', _sum: { unitPrice: 500 }, _count: { id: 1 } },
        { category: 'MR', _sum: { unitPrice: 300 }, _count: { id: 1 } },
      ])
      const r = await svc.getOverview()
      expect(r.income).toBe(1500) // paidAmount 1000 + 500
      expect(r.receivable).toBe(800) // UNPAID 800
      expect(r.cost).toBe(800)
      expect(r.profit).toBe(700)
      expect(r.invoiceCount).toBe(3)
      expect(r.lastMonthIncome).toBe(900)
      expect(r.incomeChangePercent).toBe(66.7)
      expect(r.byStatus).toMatchObject({ PAID: 1, UNPAID: 1, PARTIAL: 1 })
      expect(r.categoryBreakdown[0]).toMatchObject({ category: 'CT', amount: 500 })
    })

    it('falls back to seed when DB empty', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      mockPrisma.invoice.groupBy.mockResolvedValue([])
      mockPrisma.chargeItem.findMany.mockResolvedValue([])
      mockPrisma.chargeItem.groupBy.mockResolvedValue([])
      const r = await svc.getOverview()
      expect(r.income).toBe(286500)
      expect(r.profit).toBe(157600)
      expect(r.byStatus.PAID).toBe(74)
    })
  })

  describe('getDailyTrend', () => {
    it('buckets income/receivable/count per day', async () => {
      const today = new Date()
      mockPrisma.invoice.findMany.mockResolvedValue([
        invoice({ issuedAt: new Date(today.setHours(8, 0, 0, 0)), paidAmount: 600, status: 'PAID' }),
        invoice({ id: 'inv2', issuedAt: new Date(today.setHours(9, 0, 0, 0)), paidAmount: 0, totalAmount: 900, status: 'UNPAID' }),
      ])
      const r = await svc.getDailyTrend(5)
      expect(r.items).toHaveLength(5)
      const last = r.items[4]
      expect(last.count).toBe(2)
      expect(last.income).toBe(600)
      expect(last.receivable).toBe(900)
      expect(last.cumulativeIncome).toBe(600)
    })

    it('falls back to seed when no invoices', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      const r = await svc.getDailyTrend(30)
      expect(r.items).toHaveLength(30)
      expect(r.total).toBe(30)
      expect(r.items[0].income).toBeGreaterThan(0)
    })
  })

  describe('getByModality', () => {
    it('computes modality composition with percent share', async () => {
      mockPrisma.chargeItem.groupBy.mockResolvedValue([
        { category: 'CT', _sum: { unitPrice: 300 }, _count: { id: 3 } },
        { category: 'MR', _sum: { unitPrice: 700 }, _count: { id: 2 } },
      ])
      const r = await svc.getByModality()
      expect(r.totalAmount).toBe(1000)
      expect(r.items[0]).toMatchObject({ modality: 'MR', amount: 700, count: 2, percent: 70 })
      expect(r.items[1]).toMatchObject({ modality: 'CT', amount: 300, count: 3, percent: 30 })
    })

    it('falls back to seed when no charge items', async () => {
      mockPrisma.chargeItem.groupBy.mockResolvedValue([])
      const r = await svc.getByModality()
      expect(r.items[0]).toMatchObject({ modality: 'MR', amount: 112400 })
      expect(r.totalAmount).toBe(286500)
    })
  })

  describe('getAccountsReceivable', () => {
    it('computes aging buckets and top receivables', async () => {
      const now = Date.now()
      const daysAgo = (n: number) => new Date(now - n * 86400000)
      mockPrisma.invoice.findMany.mockResolvedValue([
        invoice({ id: 'a', invoiceNumber: 'INV-A', totalAmount: 1000, paidAmount: 0, status: 'UNPAID', issuedAt: daysAgo(10) }),
        invoice({ id: 'b', invoiceNumber: 'INV-B', totalAmount: 2000, paidAmount: 500, status: 'PARTIAL', issuedAt: daysAgo(45) }),
        invoice({ id: 'c', invoiceNumber: 'INV-C', totalAmount: 500, paidAmount: 0, status: 'UNPAID', issuedAt: daysAgo(100) }),
      ])
      const r = await svc.getAccountsReceivable()
      expect(r.totalReceivable).toBe(3000)
      expect(r.totalCount).toBe(3)
      expect(r.aging[0]).toMatchObject({ label: '0-30天', amount: 1000, count: 1 })
      expect(r.aging[1]).toMatchObject({ label: '31-60天', amount: 1500, count: 1 })
      expect(r.aging[3]).toMatchObject({ label: '90天以上', amount: 500, count: 1 })
      expect(r.topReceivables[0]).toMatchObject({ invoiceNumber: 'INV-B', amount: 1500 })
      expect(r.topReceivables).toHaveLength(3)
    })

    it('falls back to seed when no receivables', async () => {
      mockPrisma.invoice.findMany.mockResolvedValue([])
      const r = await svc.getAccountsReceivable()
      expect(r.totalReceivable).toBe(42100)
      expect(r.aging).toHaveLength(4)
      expect(r.topReceivables).toHaveLength(3)
    })
  })
})
