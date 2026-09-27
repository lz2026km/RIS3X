/**
 * [G005 W12-PatientService] 支付服务 (orphan module, DB-less-safe)
 *
 * 覆盖真实感支付流程 (确定性桩, 无真实网关):
 *   - POST /payment/orders                 创建订单 (登记/预约/检查费用; 未传金额时确定性派生)
 *   - POST /payment/orders/from-registration 由登记缴费单 (W6) 生成订单
 *   - POST /payment/orders/from-appointment  由预约费用生成订单
 *   - GET  /payment/orders                 订单列表 (状态/渠道/患者筛选)
 *   - GET  /payment/orders/:id             订单状态查询
 *   - POST /payment/orders/:id/pay         主动支付 (模拟收银)
 *   - POST /payment/orders/:id/refund      退款 (支持部分退款)
 *   - POST /payment/orders/:id/close       关闭订单
 *   - POST /payment/notify                 支付网关异步回调 (模拟 微信/支付宝/医保)
 *   - GET  /payment/reconciliation         对账清单
 *   - GET  /payment/stats                  支付统计
 *
 * 支持渠道: WECHAT (微信支付) / ALIPAY (支付宝) / INSURANCE (医保) / CASH / MIXED
 */
import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'

export type PaymentMethod = 'WECHAT' | 'ALIPAY' | 'INSURANCE' | 'CASH' | 'MIXED'
export type PaymentItemType = 'REGISTRATION' | 'APPOINTMENT' | 'EXAM' | 'REPORT'
export type PaymentStatus = 'CREATED' | 'PAID' | 'REFUNDED' | 'PARTIAL_REFUND' | 'CLOSED' | 'FAILED'

export interface PaymentOrderDto {
  id: string
  orderNo: string
  patientId: string
  patientName: string
  itemType: PaymentItemType
  refId?: string
  subject: string
  amount: number
  currency: 'CNY'
  method: PaymentMethod
  status: PaymentStatus
  paidAmount: number
  refundedAmount: number
  transactionId?: string
  paidAt?: string
  refundedAt?: string
  closedAt?: string
  failureReason?: string
  channelPayload?: Record<string, unknown>
  createdAt: string
  updatedAt: string
}

export interface RefundRecordDto {
  id: string
  orderId: string
  orderNo: string
  amount: number
  reason: string
  operator?: string
  createdAt: string
}

export interface PaymentNotifyDto {
  orderNo: string
  method: PaymentMethod
  result: 'SUCCESS' | 'FAIL'
  transactionId?: string
  failureReason?: string
  raw?: Record<string, unknown>
}

export interface ReconciliationRowDto {
  orderNo: string
  patientId: string
  method: PaymentMethod
  amount: number
  paidAmount: number
  refundedAmount: number
  netAmount: number
  status: PaymentStatus
  settleDate: string
  reconciled: boolean
}

interface PaymentPatientSeed {
  patientId: string
  name: string
}

const PATIENT_SEED: PaymentPatientSeed[] = [
  { patientId: 'P100001', name: '张伟' },
  { patientId: 'P100002', name: '李娜' },
  { patientId: 'P100003', name: '王芳' },
  { patientId: 'P100004', name: '陈杰' },
]

const MODALITY_FEE: Record<string, number> = { CT: 380, MR: 620, DR: 120, US: 180, MG: 260, DSA: 980 }
const REGISTRATION_CATALOG: Array<{ code: string; name: string; price: number }> = [
  { code: 'EXAM-BASE', name: '影像检查基础费', price: 120 },
  { code: 'CONTRAST', name: '对比剂费用', price: 260 },
  { code: 'FILM', name: '激光胶片', price: 45 },
  { code: 'SERVICE', name: '影像诊断服务费', price: 80 },
]

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name)
  private readonly orders = new Map<string, PaymentOrderDto>()
  private readonly orderNoIndex = new Map<string, string>()
  private readonly refunds: RefundRecordDto[] = []
  private seq = 0
  private refundSeq = 0

  constructor(@Optional() private readonly prisma?: PrismaService) {
    if (!prisma) this.logger.log('PaymentService: no Prisma injected (orphan mode, memory overlay + deterministic stub)')
    this.seed()
  }

  private seed(): void {
    const now = Date.now()
    const seeds: Array<Partial<PaymentOrderDto> & { itemType: PaymentItemType; method: PaymentMethod; status: PaymentStatus }> = [
      { patientId: 'P100001', patientName: '张伟', itemType: 'REGISTRATION', refId: 'V20260001', subject: 'CT 平扫登记缴费', amount: 425, method: 'WECHAT', status: 'PAID' },
      { patientId: 'P100002', patientName: '李娜', itemType: 'APPOINTMENT', refId: 'AP-P100002-001', subject: 'MR 颅脑预约', amount: 620, method: 'ALIPAY', status: 'PAID' },
      { patientId: 'P100003', patientName: '王芳', itemType: 'EXAM', refId: 'EX-2026-0031', subject: 'DR 腰椎检查', amount: 120, method: 'INSURANCE', status: 'PAID' },
      { patientId: 'P100004', patientName: '陈杰', itemType: 'REGISTRATION', refId: 'V20260004', subject: 'CT 增强登记缴费', amount: 680, method: 'WECHAT', status: 'CREATED' },
      { patientId: 'P100001', patientName: '张伟', itemType: 'EXAM', refId: 'EX-2026-0033', subject: 'MR 增强检查', amount: 880, method: 'MIXED', status: 'PARTIAL_REFUND' },
    ]
    seeds.forEach((s, i) => {
      const createdAt = new Date(now - (seeds.length - i) * 3600_000).toISOString()
      const order: PaymentOrderDto = {
        id: `PAY-${String(++this.seq).padStart(6, '0')}`,
        orderNo: `PAY202606${String(i + 1).padStart(4, '0')}`,
        patientId: s.patientId ?? 'P100001',
        patientName: s.patientName ?? '患者',
        itemType: s.itemType,
        refId: s.refId,
        subject: s.subject ?? '影像检查费用',
        amount: s.amount ?? 0,
        currency: 'CNY',
        method: s.method,
        status: s.status,
        paidAmount: s.status === 'CREATED' ? 0 : (s.amount ?? 0),
        refundedAmount: s.status === 'PARTIAL_REFUND' ? 200 : 0,
        transactionId: s.status === 'CREATED' ? undefined : `TXN-${hashNum(s.itemType + i).toString(16)}`,
        paidAt: s.status === 'CREATED' ? undefined : createdAt,
        refundedAt: s.status === 'PARTIAL_REFUND' ? createdAt : undefined,
        createdAt,
        updatedAt: createdAt,
      }
      this.orders.set(order.id, order)
      this.orderNoIndex.set(order.orderNo, order.id)
    })
  }

  private resolvePatient(patientId?: string, patientName?: string): PaymentPatientSeed {
    if (patientId) {
      const hit = PATIENT_SEED.find((p) => p.patientId === patientId)
      if (hit) return patientName ? { ...hit, name: patientName } : hit
    }
    const idx = hashNum(patientId ?? patientName ?? 'ANON') % PATIENT_SEED.length
    const seed = PATIENT_SEED[idx]!
    return patientName ? { ...seed, name: patientName } : seed
  }

  /** 确定性费用派生: 同一 (itemType, refId) 恒返回同一金额 */
  private deriveAmount(itemType: PaymentItemType, refId?: string): number {
    const h = hashNum(`${itemType}:${refId ?? ''}`)
    if (itemType === 'REGISTRATION') {
      const count = 2 + (h % 3)
      return REGISTRATION_CATALOG.slice(0, count).reduce((a, c) => a + c.price, 0)
    }
    if (itemType === 'APPOINTMENT') {
      return 100 + (h % 400)
    }
    if (itemType === 'EXAM') {
      const mods = Object.values(MODALITY_FEE)
      return mods[h % mods.length]!
    }
    return 20 + (h % 60)
  }

  private nextOrderNo(): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    return `PAY${date}${String(this.seq + 1).padStart(5, '0')}`
  }

  /** POST /payment/orders */
  createOrder(body: {
    patientId: string
    patientName?: string
    itemType?: PaymentItemType
    refId?: string
    amount?: number
    method?: PaymentMethod
    subject?: string
  }): PaymentOrderDto {
    if (!body.patientId?.trim()) throw new BadRequestException('patientId 不能为空')
    const itemType: PaymentItemType = body.itemType ?? 'EXAM'
    const amount = body.amount ?? this.deriveAmount(itemType, body.refId)
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('订单金额必须大于 0')
    const patient = this.resolvePatient(body.patientId, body.patientName)
    const now = new Date().toISOString()
    const order: PaymentOrderDto = {
      id: `PAY-${String(++this.seq).padStart(6, '0')}`,
      orderNo: this.nextOrderNo(),
      patientId: patient.patientId,
      patientName: patient.name,
      itemType,
      refId: body.refId,
      subject: body.subject ?? `${itemType} 费用`,
      amount,
      currency: 'CNY',
      method: body.method ?? 'WECHAT',
      status: 'CREATED',
      paidAmount: 0,
      refundedAmount: 0,
      createdAt: now,
      updatedAt: now,
    }
    order.channelPayload = { stub: true, prepayId: `prepay_${hashNum(order.orderNo).toString(16)}`, gateway: order.method.toLowerCase() }
    this.orders.set(order.id, order)
    this.orderNoIndex.set(order.orderNo, order.id)
    return order
  }

  /** POST /payment/orders/from-registration — 登记缴费单 (W6) → 支付订单 */
  createFromRegistration(body: { visitId: string; patientId?: string; patientName?: string; amount?: number; method?: PaymentMethod }): PaymentOrderDto {
    if (!body.visitId?.trim()) throw new BadRequestException('visitId 不能为空')
    const amount = body.amount ?? this.deriveAmount('REGISTRATION', body.visitId)
    return this.createOrder({
      patientId: body.patientId ?? this.resolvePatient(undefined, undefined).patientId,
      patientName: body.patientName,
      itemType: 'REGISTRATION',
      refId: body.visitId,
      amount,
      method: body.method ?? 'WECHAT',
      subject: `登记缴费单 ${body.visitId}`,
    })
  }

  /** POST /payment/orders/from-appointment — 预约费用 → 支付订单 */
  createFromAppointment(body: { appointmentId: string; patientId?: string; patientName?: string; amount?: number; method?: PaymentMethod; modality?: string }): PaymentOrderDto {
    if (!body.appointmentId?.trim()) throw new BadRequestException('appointmentId 不能为空')
    const amount = body.amount ?? (body.modality ? MODALITY_FEE[body.modality.toUpperCase()] ?? this.deriveAmount('APPOINTMENT', body.appointmentId) : this.deriveAmount('APPOINTMENT', body.appointmentId))
    return this.createOrder({
      patientId: body.patientId ?? this.resolvePatient(undefined, undefined).patientId,
      patientName: body.patientName,
      itemType: 'APPOINTMENT',
      refId: body.appointmentId,
      amount,
      method: body.method ?? 'ALIPAY',
      subject: `预约费用 ${body.appointmentId}`,
    })
  }

  /** GET /payment/orders */
  listOrders(filter?: { status?: PaymentStatus; method?: PaymentMethod; patientId?: string; itemType?: PaymentItemType }): { items: PaymentOrderDto[]; total: number; totalAmount: number } {
    let items = [...this.orders.values()]
    if (filter?.status) items = items.filter((o) => o.status === filter.status)
    if (filter?.method) items = items.filter((o) => o.method === filter.method)
    if (filter?.patientId) items = items.filter((o) => o.patientId === filter.patientId)
    if (filter?.itemType) items = items.filter((o) => o.itemType === filter.itemType)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    const totalAmount = items.reduce((sum, o) => sum + o.amount, 0)
    return { items, total: items.length, totalAmount }
  }

  /** GET /payment/orders/:id (支持 id 或 orderNo) */
  getOrder(idOrNo: string): PaymentOrderDto {
    const order = this.orders.get(idOrNo) ?? this.orders.get(this.orderNoIndex.get(idOrNo) ?? '')
    if (!order) throw new NotFoundException(`支付订单 ${idOrNo} 不存在`)
    return order
  }

  private applyPayment(order: PaymentOrderDto, method: PaymentMethod, transactionId?: string): PaymentOrderDto {
    if (order.status === 'PAID' || order.status === 'PARTIAL_REFUND' || order.status === 'REFUNDED') return order
    if (order.status === 'CLOSED') throw new BadRequestException('订单已关闭, 无法支付')
    const now = new Date().toISOString()
    order.method = method
    order.status = 'PAID'
    order.paidAmount = order.amount
    order.transactionId = transactionId ?? `TXN-${hashNum(order.orderNo + method).toString(16)}`
    order.paidAt = now
    order.updatedAt = now
    return order
  }

  /** POST /payment/orders/:id/pay — 主动支付 (模拟) */
  pay(idOrNo: string, body: { method?: PaymentMethod; transactionId?: string }): PaymentOrderDto {
    const order = this.getOrder(idOrNo)
    return this.applyPayment(order, body.method ?? order.method, body.transactionId)
  }

  /** POST /payment/notify — 支付网关异步回调 (模拟) */
  notify(body: PaymentNotifyDto): { received: boolean; order: PaymentOrderDto } {
    if (!body.orderNo?.trim()) throw new BadRequestException('orderNo 不能为空')
    const order = this.getOrder(body.orderNo)
    if (body.result === 'FAIL') {
      if (order.status === 'CREATED') {
        order.status = 'FAILED'
        order.failureReason = body.failureReason ?? 'GATEWAY_FAIL'
        order.updatedAt = new Date().toISOString()
      }
      return { received: true, order }
    }
    if (order.status !== 'CREATED') {
      return { received: true, order }
    }
    this.applyPayment(order, body.method, body.transactionId)
    order.channelPayload = { ...(order.channelPayload ?? {}), notifyRaw: body.raw ?? {}, notifiedAt: new Date().toISOString() }
    return { received: true, order }
  }

  /** POST /payment/orders/:id/refund */
  refund(idOrNo: string, body: { amount?: number; reason?: string; operator?: string }): { order: PaymentOrderDto; refund: RefundRecordDto } {
    const order = this.getOrder(idOrNo)
    if (order.status !== 'PAID' && order.status !== 'PARTIAL_REFUND') {
      throw new BadRequestException(`订单状态 ${order.status} 不支持退款`)
    }
    const refundable = order.paidAmount - order.refundedAmount
    const amount = body.amount ?? refundable
    if (!Number.isFinite(amount) || amount <= 0) throw new BadRequestException('退款金额必须大于 0')
    if (amount > refundable) throw new BadRequestException(`退款金额不能超过可退金额 ${refundable}`)
    const now = new Date().toISOString()
    order.refundedAmount += amount
    order.status = order.refundedAmount >= order.paidAmount ? 'REFUNDED' : 'PARTIAL_REFUND'
    order.refundedAt = now
    order.updatedAt = now
    const refund: RefundRecordDto = {
      id: `REF-${String(++this.refundSeq).padStart(6, '0')}`,
      orderId: order.id,
      orderNo: order.orderNo,
      amount,
      reason: body.reason ?? '患者申请退款',
      operator: body.operator,
      createdAt: now,
    }
    this.refunds.unshift(refund)
    return { order, refund }
  }

  listRefunds(orderId?: string): RefundRecordDto[] {
    return orderId ? this.refunds.filter((r) => r.orderId === orderId) : this.refunds
  }

  /** POST /payment/orders/:id/close */
  close(idOrNo: string, body?: { reason?: string }): PaymentOrderDto {
    const order = this.getOrder(idOrNo)
    if (order.status === 'PAID' || order.status === 'PARTIAL_REFUND' || order.status === 'REFUNDED') {
      throw new BadRequestException('已支付订单不可关闭, 请走退款流程')
    }
    if (order.status === 'CLOSED') {
      throw new BadRequestException('订单已关闭')
    }
    order.status = 'CLOSED'
    order.failureReason = body?.reason ?? 'CLOSED_BY_OPERATOR'
    order.closedAt = new Date().toISOString()
    order.updatedAt = order.closedAt
    return order
  }

  /** GET /payment/reconciliation — 对账清单 */
  reconciliation(filter?: { date?: string; method?: PaymentMethod }): { rows: ReconciliationRowDto[]; total: number; netAmount: number } {
    let orders = [...this.orders.values()].filter((o) => ['PAID', 'PARTIAL_REFUND', 'REFUNDED'].includes(o.status))
    if (filter?.method) orders = orders.filter((o) => o.method === filter.method)
    let rows: ReconciliationRowDto[] = orders.map((o) => {
      const netAmount = o.paidAmount - o.refundedAmount
      return {
        orderNo: o.orderNo,
        patientId: o.patientId,
        method: o.method,
        amount: o.amount,
        paidAmount: o.paidAmount,
        refundedAmount: o.refundedAmount,
        netAmount,
        status: o.status,
        settleDate: (o.paidAt ?? o.createdAt).slice(0, 10),
        reconciled: netAmount >= 0,
      }
    })
    if (filter?.date) rows = rows.filter((r) => r.settleDate === filter.date)
    const netAmount = rows.reduce((sum, r) => sum + r.netAmount, 0)
    return { rows, total: rows.length, netAmount }
  }

  /** GET /payment/stats */
  stats(): {
    totalOrders: number
    byStatus: Record<string, number>
    byMethod: Record<string, number>
    totalAmount: number
    paidAmount: number
    refundedAmount: number
    netAmount: number
    refundRate: number
  } {
    const items = [...this.orders.values()]
    const byStatus: Record<string, number> = {}
    const byMethod: Record<string, number> = {}
    let totalAmount = 0
    let paidAmount = 0
    let refundedAmount = 0
    for (const o of items) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
      byMethod[o.method] = (byMethod[o.method] ?? 0) + 1
      totalAmount += o.amount
      paidAmount += o.paidAmount
      refundedAmount += o.refundedAmount
    }
    const netAmount = paidAmount - refundedAmount
    return {
      totalOrders: items.length,
      byStatus,
      byMethod,
      totalAmount,
      paidAmount,
      refundedAmount,
      netAmount,
      refundRate: paidAmount > 0 ? Number(((refundedAmount / paidAmount) * 100).toFixed(2)) : 0,
    }
  }
}
