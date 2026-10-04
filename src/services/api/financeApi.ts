import { api, invalidateApiCache, invalidateApiCacheByPrefix } from './client'

export interface ChargeItemDto {
  id: string
  name: string
  category: string
  unitPrice: number
  insuranceEligible: boolean
  description?: string
  active: boolean
}

export interface InvoiceDto {
  id: string
  patientId: string
  patientName: string
  examItem: string
  examDate: string
  totalAmount: number
  paidAmount: number
  balance: number
  status: string
  insuranceCovered: number
  selfPayAmount: number
  createdAt: string
  paidAt?: string
}

export interface RevenueMonthlyPoint {
  month: string
  revenue: number
  cost: number
  profit: number
  amount?: number
  count?: number
}

export interface RevenueAnalysisDto {
  period: string
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  byModality: { modality: string; revenue: number; cost: number; profit: number }[]
  // 兼容字段: 月度/日度流水 (旧 MSW 形状)
  monthly?: RevenueMonthlyPoint[]
  daily?: { date: string; amount: number }[]
  insuranceTotal?: number
  selfPayTotal?: number
}

export interface CostAccountingDto {
  period: string
  laborCost: number
  equipmentDepreciation: number
  materialCost: number
  maintenanceCost: number
  otherCost: number
  total: number
  // 兼容字段
  byDept?: { dept: string; cost: number; revenue: number }[]
  byModality?: { modality: string; cost: number; revenue: number }[]
  totalCost?: number
  totalRevenue?: number
}

export interface FinancialReportDto {
  id: string
  reportType: string
  period: string
  generatedAt: string
  status: string
  url?: string
}

// ===== [v3.0.6.11-104 Wave 2D] 财务看板扩展端点 (总览/趋势/模态构成/应收) =====

export interface FinanceOverviewDto {
  period: string
  income: number
  receivable: number
  cost: number
  profit: number
  invoiceCount: number
  paidCount: number
  unpaidCount: number
  lastMonthIncome: number
  incomeChangePercent: number
  byStatus: Record<string, number>
  categoryBreakdown: Array<{ category: string; amount: number; count: number }>
}

export interface FinanceDailyTrendItem {
  date: string
  income: number
  receivable: number
  count: number
  cumulativeIncome: number
}

export interface FinanceDailyTrendDto {
  items: FinanceDailyTrendItem[]
  total: number
}

export interface FinanceModalityItem {
  modality: string
  amount: number
  count: number
  percent: number
}

export interface FinanceModalityDto {
  items: FinanceModalityItem[]
  totalAmount: number
}

export interface ArAgingBucket {
  label: string
  amount: number
  count: number
}

export interface ArTopReceivable {
  id: string
  invoiceNumber: string
  patientId: string
  amount: number
  status: string
  issuedAt: string
}

export interface AccountsReceivableDto {
  totalReceivable: number
  totalCount: number
  aging: ArAgingBucket[]
  topReceivables: ArTopReceivable[]
}

export const financeApi = {
  // Charge items
  listChargeItems: () =>
    api.get<ChargeItemDto[]>('/finance/charge-items'),

  createChargeItem: async (data: Partial<ChargeItemDto>) => {
    const res = await api.post<ChargeItemDto>('/finance/charge-items', data)
    await invalidateApiCache('/finance/charge-items')
    return res
  },

  updateChargeItem: async (id: string, data: Partial<ChargeItemDto>) => {
    const res = await api.put<ChargeItemDto>(`/finance/charge-items/${id}`, data)
    await invalidateApiCache(`/finance/charge-items/${id}`)
    return res
  },

  deleteChargeItem: async (id: string) => {
    const res = await api.delete<{ id: string }>(`/finance/charge-items/${id}`)
    await invalidateApiCacheByPrefix('/finance/charge-items')
    return res
  },

  // Invoices
  listInvoices: () =>
    api.get<InvoiceDto[]>('/finance/invoices'),

  // [W1-B] 后端 POST /finance/invoices 实际接收 { patientId, chargeItemIds[], discount? }
  createInvoice: async (data: Partial<InvoiceDto> & { chargeItemIds?: string[]; discount?: number }) => {
    const res = await api.post<InvoiceDto>('/finance/invoices', data)
    await invalidateApiCache('/finance/invoices')
    return res
  },

  getInvoice: (id: string) =>
    api.get<InvoiceDto>(`/finance/invoices/${id}`),

  payInvoice: async (data: { invoiceId: string; amount: number; method: string }) => {
    const res = await api.post<InvoiceDto>(`/finance/invoices/${data.invoiceId}/pay`, data)
    await invalidateApiCache(`/finance/invoices/${data.invoiceId}`)
    await invalidateApiCacheByPrefix('/finance/invoices')
    return res
  },

  // Revenue analysis
  getRevenueAnalysis: () =>
    api.get<RevenueAnalysisDto>('/finance/revenue-analysis'),

  // Cost accounting
  getCostAccounting: () =>
    api.get<CostAccountingDto>('/finance/cost-accounting'),

  // Financial reports
  getFinancialReports: () =>
    api.get<FinancialReportDto[]>('/finance/financial-reports'),

  // [v3.0.6.11-104 Wave 2D]
  getOverview: () =>
    api.get<FinanceOverviewDto>('/finance/overview'),

  getDailyTrend: (days = 30) =>
    api.get<FinanceDailyTrendDto>(`/finance/daily-trend?days=${days}`),

  getByModality: () =>
    api.get<FinanceModalityDto>('/finance/by-modality'),

  getAccountsReceivable: () =>
    api.get<AccountsReceivableDto>('/finance/accounts-receivable'),
}
