/**
 * [G005 Wave1A P0] Dental Billing 收费模块 spec — 静态字典 + 内存账单 CRUD/支付/医保验算
 */
import { DentalService } from '../src/dental/dental.service'

function failingPrisma(): any {
  return new Proxy(
    {},
    {
      get: () => () => {
        throw new Error('no db (verification stub)')
      },
    },
  )
}

describe('Wave1A Dental Billing', () => {
  it('getFeeCatalog: 静态收费字典 (项目/价格/医保类别)', () => {
    const svc = new DentalService(failingPrisma())
    const res = svc.getFeeCatalog()
    expect(res.success).toBe(true)
    expect(res.data.length).toBeGreaterThan(20)
    expect(res.data.every((c: any) => c.code && c.name && c.unitPrice > 0 && c.insuranceType)).toBe(true)
    const jia = res.data.filter((c: any) => c.insuranceType === '甲类')
    expect(jia.length).toBeGreaterThan(0)
  })

  it('getPaymentMethods: 支付方式字典含微信', () => {
    const svc = new DentalService(failingPrisma())
    const res = svc.getPaymentMethods()
    expect(res.success).toBe(true)
    expect(res.data.some((m: any) => m.id === 'wechat' && m.name === '微信支付')).toBe(true)
  })

  it('listBillingInvoices: seed 列表 + patientId 过滤', () => {
    const svc = new DentalService(failingPrisma())
    const all = svc.listBillingInvoices()
    expect(all.success).toBe(true)
    expect(all.data.length).toBeGreaterThan(0)
    const p1 = svc.listBillingInvoices('P100001')
    expect(p1.data.every((inv: any) => inv.patientId === 'P100001')).toBe(true)
  })

  it('createBillingInvoice + payBillingInvoice: 内存创建/支付', () => {
    const svc = new DentalService(failingPrisma())
    const created = svc.createBillingInvoice({
      patientId: 'P100002',
      items: [{ code: 'D2007', name: '全口洁牙', qty: 1, unitPrice: 400 }],
    })
    expect(created.success).toBe(true)
    expect(created.data.status).toBe('pending')
    expect(created.data.total).toBe(400)
    const paid = svc.payBillingInvoice(created.data.id, { paymentMethod: 'wechat' })
    expect(paid.success).toBe(true)
    expect(paid.data?.status).toBe('paid')
  })

  it('payBillingInvoice: 未知单号返回失败', () => {
    const svc = new DentalService(failingPrisma())
    const res = svc.payBillingInvoice('INV-NOPE', { paymentMethod: 'cash' })
    expect(res.success).toBe(false)
  })

  it('verifyInsurance: 确定性医保验算', () => {
    const svc = new DentalService(failingPrisma())
    const res = svc.verifyInsurance({ patientId: 'P100001', insuranceType: '城镇职工', feeTotal: 1000 })
    expect(res.success).toBe(true)
    expect(res.data.insuranceCover).toBe(400)
    expect(res.data.selfPay).toBe(600)
    expect(res.data.items.length).toBe(3)
  })
})
