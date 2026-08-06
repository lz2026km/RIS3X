// ===== Types =====
export interface PatientBill {
  id: string
  patientId: string
  patientName: string
  examItem: string
  examDate: string
  items: BillLineItem[]
  totalAmount: number
  paidAmount: number
  balance: number
  status: 'pending' | 'partial' | 'paid' | 'refunded' | 'waived'
  insuranceCovered: number
  selfPayAmount: number
  createdAt: string
  paidAt?: string
}

export interface BillLineItem {
  id: string
  name: string
  category: 'exam' | 'material' | 'medication' | 'service' | 'other'
  quantity: number
  unitPrice: number
  amount: number
  insuranceEligible: boolean
}

export interface PaymentRecord {
  id: string
  billId: string
  amount: number
  method: 'cash' | 'card' | 'wechat' | 'alipay' | 'insurance' | 'bank_transfer'
  paidAt: string
  transactionId: string
  status: 'success' | 'failed' | 'refunding' | 'refunded'
}

export interface InsuranceClaim {
  id: string
  billId: string
  patientId: string
  insuranceType: string
  claimAmount: number
  approvedAmount: number
  status: 'submitted' | 'approved' | 'rejected' | 'paid'
  submittedAt: string
  approvedAt?: string
  rejectReason?: string
}

export interface PriceEstimate {
  examItem: string
  modality: string
  basePrice: number
  materialCost: number
  serviceFee: number
  total: number
  insuranceCoverage: number
  estimatedSelfPay: number
}

export interface IFinanceService {
  getBills(patientId: string): Promise<PatientBill[]>
  getBill(billId: string): Promise<PatientBill | null>
  getPayments(billId: string): Promise<PaymentRecord[]>
  getInsuranceClaims(patientId: string): Promise<InsuranceClaim[]>
  getPriceEstimate(examItemId: string): Promise<PriceEstimate>
  makePayment(billId: string, amount: number, method: PaymentRecord['method']): Promise<PaymentRecord>
  requestRefund(billId: string, reason: string): Promise<boolean>
}

// ===== Mock Data =====
const MOCK_BILLS: PatientBill[] = [
  {
    id: 'B001', patientId: 'P001', patientName: '张三', examItem: '胸部CT平扫', examDate: '2025-05-01',
    items: [
      { id: 'L1', name: 'CT平扫（胸部）', category: 'exam', quantity: 1, unitPrice: 500, amount: 500, insuranceEligible: true },
      { id: 'L2', name: '碘造影剂', category: 'material', quantity: 1, unitPrice: 200, amount: 200, insuranceEligible: true },
      { id: 'L3', name: '影像胶片(14x17)', category: 'material', quantity: 2, unitPrice: 25, amount: 50, insuranceEligible: false },
    ],
    totalAmount: 750, paidAmount: 750, balance: 0, status: 'paid',
    insuranceCovered: 525, selfPayAmount: 225,
    createdAt: '2025-05-01', paidAt: '2025-05-01T15:00:00Z',
  },
  {
    id: 'B002', patientId: 'P001', patientName: '张三', examItem: '颅脑MRI平扫', examDate: '2025-04-15',
    items: [
      { id: 'L4', name: 'MRI平扫（颅脑）', category: 'exam', quantity: 1, unitPrice: 800, amount: 800, insuranceEligible: true },
    ],
    totalAmount: 800, paidAmount: 400, balance: 400, status: 'partial',
    insuranceCovered: 560, selfPayAmount: 240,
    createdAt: '2025-04-15',
  },
  {
    id: 'B003', patientId: 'P002', patientName: '李四', examItem: '腹部彩超', examDate: '2025-04-20',
    items: [
      { id: 'L5', name: '彩色多普勒超声（腹部）', category: 'exam', quantity: 1, unitPrice: 300, amount: 300, insuranceEligible: true },
    ],
    totalAmount: 300, paidAmount: 0, balance: 300, status: 'pending',
    insuranceCovered: 210, selfPayAmount: 90,
    createdAt: '2025-04-20',
  },
]

const MOCK_PAYMENTS: PaymentRecord[] = [
  { id: 'PAY001', billId: 'B001', amount: 750, method: 'wechat', paidAt: '2025-05-01T15:00:00Z', transactionId: 'wx_202505011500', status: 'success' },
  { id: 'PAY002', billId: 'B002', amount: 400, method: 'card', paidAt: '2025-04-15T10:30:00Z', transactionId: 'card_202504151030', status: 'success' },
]

const MOCK_CLAIMS: InsuranceClaim[] = [
  { id: 'IC001', billId: 'B001', patientId: 'P001', insuranceType: '城镇职工基本医疗保险', claimAmount: 525, approvedAmount: 500, status: 'paid', submittedAt: '2025-05-02', approvedAt: '2025-05-05' },
  { id: 'IC002', billId: 'B002', patientId: 'P001', insuranceType: '城镇职工基本医疗保险', claimAmount: 560, approvedAmount: 0, status: 'submitted', submittedAt: '2025-04-16' },
]

class MockFinanceService implements IFinanceService {
  async getBills(patientId: string): Promise<PatientBill[]> {
    return MOCK_BILLS.filter(b => b.patientId === patientId)
  }

  async getBill(billId: string): Promise<PatientBill | null> {
    return MOCK_BILLS.find(b => b.id === billId) ?? null
  }

  async getPayments(billId: string): Promise<PaymentRecord[]> {
    return MOCK_PAYMENTS.filter(p => p.billId === billId)
  }

  async getInsuranceClaims(patientId: string): Promise<InsuranceClaim[]> {
    return MOCK_CLAIMS.filter(c => c.patientId === patientId)
  }

  async getPriceEstimate(examItemId: string): Promise<PriceEstimate> {
    return { examItem: examItemId, modality: 'CT', basePrice: 500, materialCost: 200, serviceFee: 50, total: 750, insuranceCoverage: 525, estimatedSelfPay: 225 }
  }

  async makePayment(billId: string, amount: number, method: PaymentRecord['method']): Promise<PaymentRecord> {
    const payment: PaymentRecord = {
      id: `PAY${Date.now()}`, billId, amount, method,
      paidAt: new Date().toISOString(), transactionId: `tx_${Date.now()}`, status: 'success',
    }
    MOCK_PAYMENTS.push(payment)
    const bill = MOCK_BILLS.find(b => b.id === billId)
    if (bill) {
      bill.paidAmount += amount
      bill.balance = bill.totalAmount - bill.paidAmount
      bill.status = bill.balance <= 0 ? 'paid' : 'partial'
      bill.paidAt = new Date().toISOString()
    }
    return payment
  }

  async requestRefund(billId: string, _reason: string): Promise<boolean> {
    const bill = MOCK_BILLS.find(b => b.id === billId)
    if (bill) bill.status = 'refunded'
    return !!bill
  }
}

let _instance: IFinanceService | null = null

export function getFinanceService(): IFinanceService {
  if (!_instance) _instance = new MockFinanceService()
  return _instance
}
