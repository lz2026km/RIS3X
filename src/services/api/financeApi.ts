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

export interface RevenueAnalysisDto {
  period: string
  totalRevenue: number
  totalCost: number
  totalProfit: number
  profitMargin: number
  byModality: { modality: string; revenue: number; cost: number; profit: number }[]
}

export interface CostAccountingDto {
  period: string
  laborCost: number
  equipmentDepreciation: number
  materialCost: number
  maintenanceCost: number
  otherCost: number
  total: number
}

export interface FinancialReportDto {
  id: string
  reportType: string
  period: string
  generatedAt: string
  status: string
  url?: string
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

  // Invoices
  listInvoices: () =>
    api.get<InvoiceDto[]>('/finance/invoices'),

  createInvoice: async (data: Partial<InvoiceDto>) => {
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
}
