/**
 * [G005 W12-PatientService] 支付 订单/退款/回调/对账 规格
 */
import { BadRequestException, NotFoundException } from '@nestjs/common'
import { PaymentService } from './payment.service'

describe('[W12] 支付订单与退款', () => {
  let svc: PaymentService
  beforeEach(() => {
    svc = new PaymentService()
  })

  it('创建订单: 未传金额时按 (itemType, refId) 确定性派生', () => {
    const a = svc.createOrder({ patientId: 'P100001', itemType: 'REGISTRATION', refId: 'V-X', method: 'WECHAT' })
    const b = svc.createOrder({ patientId: 'P100002', itemType: 'REGISTRATION', refId: 'V-X', method: 'ALIPAY' })
    expect(a.amount).toBe(b.amount)
    expect(a.status).toBe('CREATED')
    expect(a.orderNo).toMatch(/^PAY\d{8}\d{5}$/)
    expect(a.channelPayload?.prepayId).toContain('prepay_')
  })

  it('创建订单: 非法参数抛 BadRequestException', () => {
    expect(() => svc.createOrder({ patientId: '' })).toThrow(BadRequestException)
    expect(() => svc.createOrder({ patientId: 'P100001', amount: -1 })).toThrow(BadRequestException)
  })

  it('由登记缴费单 (W6) 生成订单', () => {
    const order = svc.createFromRegistration({ visitId: 'V20260009', patientId: 'P100003', patientName: '王芳', method: 'INSURANCE' })
    expect(order.itemType).toBe('REGISTRATION')
    expect(order.refId).toBe('V20260009')
    expect(order.amount).toBeGreaterThan(0)
    expect(order.method).toBe('INSURANCE')
  })

  it('由预约生成订单 (按模态费用)', () => {
    const order = svc.createFromAppointment({ appointmentId: 'AP-1', patientId: 'P100002', modality: 'MR', method: 'ALIPAY' })
    expect(order.amount).toBe(620)
    expect(order.itemType).toBe('APPOINTMENT')
  })

  it('支付回调: SUCCESS 置为 PAID 且重复回调幂等', () => {
    const order = svc.createOrder({ patientId: 'P100004', itemType: 'EXAM', amount: 300, method: 'WECHAT' })
    const first = svc.notify({ orderNo: order.orderNo, method: 'WECHAT', result: 'SUCCESS', transactionId: 'TXN-1' })
    expect(first.order.status).toBe('PAID')
    expect(first.order.transactionId).toBe('TXN-1')
    const paidAt = first.order.paidAt
    const second = svc.notify({ orderNo: order.orderNo, method: 'WECHAT', result: 'SUCCESS', transactionId: 'TXN-2' })
    expect(second.order.transactionId).toBe('TXN-1')
    expect(second.order.paidAt).toBe(paidAt)
  })

  it('支付回调: FAIL 置为 FAILED', () => {
    const order = svc.createOrder({ patientId: 'P100001', amount: 200 })
    const res = svc.notify({ orderNo: order.orderNo, method: 'ALIPAY', result: 'FAIL', failureReason: 'BALANCE' })
    expect(res.order.status).toBe('FAILED')
    expect(res.order.failureReason).toBe('BALANCE')
  })

  it('退款: 部分退款 → PARTIAL_REFUND, 超额抛异常', () => {
    const order = svc.createOrder({ patientId: 'P100001', amount: 500, method: 'WECHAT' })
    svc.pay(order.id, {})
    const partial = svc.refund(order.id, { amount: 200, reason: '部分退' })
    expect(partial.order.status).toBe('PARTIAL_REFUND')
    expect(partial.order.refundedAmount).toBe(200)
    expect(() => svc.refund(order.id, { amount: 9999 })).toThrow(BadRequestException)
    const full = svc.refund(order.id, { amount: 300 })
    expect(full.order.status).toBe('REFUNDED')
  })

  it('退款: 未支付订单抛异常', () => {
    const order = svc.createOrder({ patientId: 'P100001', amount: 100 })
    expect(() => svc.refund(order.id, {})).toThrow(BadRequestException)
  })

  it('关闭订单: 已支付不可关闭', () => {
    const order = svc.createOrder({ patientId: 'P100001', amount: 100 })
    const closed = svc.close(order.id, { reason: '患者取消' })
    expect(closed.status).toBe('CLOSED')
    expect(() => svc.close(closed.id, {})).toThrow(BadRequestException)
  })

  it('查询: 未知订单抛 NotFoundException, 支持 orderNo', () => {
    const order = svc.createOrder({ patientId: 'P100001', amount: 88 })
    expect(svc.getOrder(order.orderNo).id).toBe(order.id)
    expect(() => svc.getOrder('PAY-NONE')).toThrow(NotFoundException)
  })

  it('对账清单与统计口径正确', () => {
    const rec = svc.reconciliation()
    expect(rec.rows.length).toBeGreaterThan(0)
    expect(rec.rows.every((r) => r.netAmount === r.paidAmount - r.refundedAmount)).toBe(true)
    const stats = svc.stats()
    expect(stats.totalOrders).toBeGreaterThanOrEqual(5)
    expect(stats.byStatus).toHaveProperty('PAID')
    expect(stats.refundRate).toBeGreaterThanOrEqual(0)
  })
})
