/**
 * [G005 W12-PatientService] 患者服务 MSW handlers (确定性, 无随机)
 *   微信服务号/小程序 · 支付订单/退款/回调/对账 · 通知渠道(短信/模板/语音)
 *   满意度分析 · 自助登记
 * 必须注册在 handlers 数组最前 (新增前缀, 避免与既有通配/参数路由冲突)。
 */
import { http, HttpResponse, delay } from 'msw'
import type {
  DeliveryLogDto,
  NotificationTemplateDto,
  PaymentMethod,
  PaymentOrderDto,
  PaymentRefundDto,
  SurveyResponseDto,
  SurveyDto,
  WechatMenuButtonDto,
  WechatSendLogDto,
  WechatUserDto,
} from '../api/w12PatientApi'

const API = '/api/v1'

function hashNum(input: string): number {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function hexFrom(input: string, len: number): string {
  let h = hashNum(input)
  let out = ''
  while (out.length < len) {
    out += (h >>> 0).toString(16).padStart(8, '0')
    h = Math.imul(h ^ (h >>> 13), 16777619) >>> 0
  }
  return out.slice(0, len)
}

const ok = <T>(data: T) => HttpResponse.json({ success: true, data })
const bad = (message: string, status = 400) =>
  HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message } }, { status })

// ─────────────────────────────────────────────────────────────────────────────
// 通用患者 seed
// ─────────────────────────────────────────────────────────────────────────────
const PATIENTS = [
  { patientId: 'P100001', name: '张伟', phone: '13800001001', idCard: '110101196803120011', empiId: 'EMPI-000001' },
  { patientId: 'P100002', name: '李娜', phone: '13800001002', idCard: '110101199211050028', empiId: 'EMPI-000002' },
  { patientId: 'P100003', name: '王芳', phone: '13800001003', idCard: 'E12345678', empiId: 'EMPI-000003' },
  { patientId: 'P100004', name: '陈杰', phone: '13800001004', idCard: '110101198601300037', empiId: 'EMPI-000004' },
]

// ─────────────────────────────────────────────────────────────────────────────
// 微信
// ─────────────────────────────────────────────────────────────────────────────
const wxUsers = new Map<string, WechatUserDto>()
const wxLogs: WechatSendLogDto[] = []
let wxSeq = 0
let wxMenuVersion = 1
const wxMenu = {
  menuId: 'MENU-0001',
  channel: 'SERVICE_ACCOUNT' as const,
  publishedAt: '2026-01-01T00:00:00.000Z',
  version: 1,
  buttons: [
    { name: '就诊服务', type: 'parent', sub_button: [{ name: '预约检查', type: 'click', key: 'APPOINTMENT' }, { name: '自助登记', type: 'click', key: 'SELF_CHECKIN' }] },
    { name: '报告查询', type: 'view', url: 'https://ris.g005.example.com/portal/reports' },
    { name: '我的', type: 'click', key: 'MINE' },
  ] as WechatMenuButtonDto[],
}
const SUBSCRIBE_CONFIG = {
  nickname: 'G005 智慧影像服务',
  serviceAccount: 'gh_g005_ris',
  miniProgramAppId: 'wx0000000000000001',
  subscribeTemplates: [
    { templateId: 'TPL-APPT-REMIND', title: '预约提醒', scene: 'appointment_reminder', enabled: true },
    { templateId: 'TPL-REPORT-READY', title: '报告出具通知', scene: 'report_ready', enabled: true },
    { templateId: 'TPL-CRITICAL-CALL', title: '危急值提醒', scene: 'critical_alert', enabled: true },
    { templateId: 'TPL-QUEUE-CALL', title: '排队叫号提醒', scene: 'queue_call', enabled: true },
    { templateId: 'TPL-PAY-RESULT', title: '缴费结果通知', scene: 'payment_result', enabled: true },
  ],
  subscribedEvents: [
    { event: 'appointment_reminder', label: '检查前提醒', enabled: true },
    { event: 'report_ready', label: '报告可查看', enabled: true },
    { event: 'critical_alert', label: '危急值通知', enabled: true },
    { event: 'queue_call', label: '叫号/入队', enabled: true },
    { event: 'satisfaction_survey', label: '满意度调查', enabled: false },
  ],
  welcomeMessage: '欢迎使用 G005 智慧影像服务。绑定就诊人后可查询报告、预约检查与自助登记。',
}

function wxRecord(input: Omit<WechatSendLogDto, 'id' | 'attempts' | 'createdAt'>): WechatSendLogDto {
  const log: WechatSendLogDto = { id: `WXLOG-${String(++wxSeq).padStart(6, '0')}`, attempts: 1, createdAt: new Date().toISOString(), ...input }
  wxLogs.unshift(log)
  return log
}

// 微信服务号/小程序 handlers — 单一来源, 经 wechatHandlers.ts 重新导出注册
const wxHandlers = [
  http.post(`${API}/wechat/oauth/callback`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as { code?: string; channel?: 'SERVICE_ACCOUNT' | 'MINI_PROGRAM' }
    if (!body.code) return bad('授权 code 不能为空')
    const channel = body.channel ?? 'MINI_PROGRAM'
    const openid = `o${hexFrom(`openid:${body.code}:${channel}`, 27)}`
    const unionid = `u${hexFrom(`unionid:${body.code}`, 27)}`
    let user = wxUsers.get(openid)
    const isNew = !user
    if (!user) {
      const seed = PATIENTS[hashNum(openid) % PATIENTS.length]!
      user = {
        openid, unionid, nickname: `微信用户${hexFrom(openid, 4)}`, avatarUrl: 'https://mmsns.qpic.cn/default/avatar.png',
        gender: 'UNKNOWN', channel, phone: seed.phone, subscribed: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }
      wxUsers.set(openid, user)
    }
    wxRecord({ type: 'OAUTH', channel, openid, title: '微信授权登录', content: `code=${body.code.slice(0, 8)}...`, status: 'SENT' })
    return ok({ openid, unionid, sessionKeyHint: hexFrom(`session:${body.code}`, 16), isNew, user })
  }),

  http.post(`${API}/wechat/bind`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as { openid?: string; patientId?: string; phone?: string; idCard?: string; empiId?: string; name?: string }
    if (!body.openid) return bad('openid 不能为空')
    const patient = PATIENTS.find((p) => (body.patientId && p.patientId === body.patientId) || (body.phone && p.phone === body.phone) || (body.idCard && p.idCard === body.idCard) || (body.empiId && p.empiId === body.empiId)) ?? null
    if (!patient) {
      wxRecord({ type: 'BIND', channel: 'MINI_PROGRAM', openid: body.openid, title: '绑定就诊人失败', content: '未匹配到患者', status: 'FAILED', error: 'PATIENT_NOT_FOUND' })
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '未匹配到患者档案' } }, { status: 404 })
    }
    const existing = wxUsers.get(body.openid)
    const now = new Date().toISOString()
    const user: WechatUserDto = {
      openid: body.openid, unionid: existing?.unionid ?? `u${hexFrom(`unionid:${body.openid}`, 27)}`,
      nickname: body.name ?? existing?.nickname ?? '微信用户', avatarUrl: existing?.avatarUrl ?? '', gender: existing?.gender ?? 'UNKNOWN',
      channel: existing?.channel ?? 'MINI_PROGRAM', phone: patient.phone, boundPatientId: patient.patientId, boundEmpiId: patient.empiId,
      boundPatientName: patient.name, boundAt: now, subscribed: existing?.subscribed ?? true, createdAt: existing?.createdAt ?? now, updatedAt: now,
    }
    wxUsers.set(body.openid, user)
    wxRecord({ type: 'BIND', channel: user.channel, openid: body.openid, title: '绑定就诊人成功', content: `${patient.name} (${patient.patientId})`, status: 'SENT' })
    return ok({ bound: true, openid: body.openid, patient, user })
  }),

  http.get(`${API}/wechat/subscribe/config`, async () => { await delay(60); return ok(SUBSCRIBE_CONFIG) }),

  http.get(`${API}/wechat/menu`, async () => { await delay(60); return ok(wxMenu) }),

  http.post(`${API}/wechat/menu`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { buttons?: WechatMenuButtonDto[]; channel?: 'SERVICE_ACCOUNT' | 'MINI_PROGRAM' }
    const buttons = body.buttons ?? wxMenu.buttons
    if (buttons.length === 0 || buttons.length > 3) return bad('自定义菜单一级按钮数量必须为 1-3 个')
    wxMenuVersion += 1
    wxMenu.buttons = buttons
    wxMenu.version = wxMenuVersion
    wxMenu.menuId = `MENU-${String(wxMenuVersion).padStart(4, '0')}`
    wxMenu.publishedAt = new Date().toISOString()
    return ok(wxMenu)
  }),

  http.get(`${API}/wechat/logs`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const openid = url.searchParams.get('openid')
    const type = url.searchParams.get('type')
    const status = url.searchParams.get('status')
    let items = wxLogs
    if (openid) items = items.filter((l) => l.openid === openid)
    if (type) items = items.filter((l) => l.type === type)
    if (status) items = items.filter((l) => l.status === status)
    return ok({ items, total: items.length })
  }),

  http.post(`${API}/wechat/logs/archive`, async () => {
    await delay(60)
    let archived = 0
    for (const log of wxLogs) {
      if (log.status === 'SENT') { log.status = 'ARCHIVED'; log.archivedAt = new Date().toISOString(); archived += 1 }
    }
    return ok({ archived, total: wxLogs.length })
  }),

  http.get(`${API}/wechat/users`, async () => { await delay(50); return ok({ items: [...wxUsers.values()], total: wxUsers.size }) }),

  http.get(`${API}/wechat/user/:openid`, async ({ params }) => {
    await delay(50)
    const user = wxUsers.get(String(params.openid))
    if (!user) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '微信用户不存在' } }, { status: 404 })
    return ok(user)
  }),

  http.post(`${API}/wechat/push`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { openid?: string; title?: string; content?: string; channel?: 'SERVICE_ACCOUNT' | 'MINI_PROGRAM' }
    if (!body.content) return bad('推送内容不能为空')
    const deliverable = /^(o|u)[0-9a-f]{8,}$/.test(body.openid ?? '')
    return ok(wxRecord({ type: 'PUSH', channel: body.channel ?? 'SERVICE_ACCOUNT', openid: body.openid ?? '-', title: body.title ?? '服务通知', content: body.content, status: deliverable ? 'SENT' : 'FAILED', error: deliverable ? undefined : 'INVALID_OPENID' }))
  }),

  http.post(`${API}/wechat/template/send`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { openid?: string; templateId?: string; data?: Record<string, string | number>; url?: string }
    if (!body.templateId) return bad('templateId 不能为空')
    const tpl = SUBSCRIBE_CONFIG.subscribeTemplates.find((t) => t.templateId === body.templateId)
    if (!tpl) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } }, { status: 404 })
    const rendered = Object.entries(body.data ?? {}).map(([k, v]) => `${k}: ${v}`).join(' / ')
    const deliverable = /^(o|u)[0-9a-f]{8,}$/.test(body.openid ?? '')
    return ok(wxRecord({ type: 'TEMPLATE', channel: 'SERVICE_ACCOUNT', openid: body.openid ?? '-', title: tpl.title, content: rendered || tpl.scene, status: deliverable ? 'SENT' : 'FAILED', error: deliverable ? undefined : 'INVALID_OPENID' }))
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// 支付
// ─────────────────────────────────────────────────────────────────────────────
const payOrders = new Map<string, PaymentOrderDto>()
const payOrderNoIndex = new Map<string, string>()
const payRefunds: PaymentRefundDto[] = []
let paySeq = 0
let payRefundSeq = 0
const MODALITY_FEE: Record<string, number> = { CT: 380, MR: 620, DR: 120, US: 180, MG: 260, DSA: 980 }

function payDeriveAmount(itemType: string, refId?: string): number {
  const h = hashNum(`${itemType}:${refId ?? ''}`)
  if (itemType === 'REGISTRATION') return 120 + 260 + 45 + (h % 2) * 80
  if (itemType === 'APPOINTMENT') return 100 + (h % 400)
  if (itemType === 'EXAM') { const mods = Object.values(MODALITY_FEE); return mods[h % mods.length]! }
  return 20 + (h % 60)
}

function seedPay(): void {
  const now = Date.now()
  const seeds: Array<{ patientId: string; patientName: string; itemType: PaymentOrderDto['itemType']; refId: string; subject: string; amount: number; method: PaymentMethod; status: PaymentOrderDto['status'] }> = [
    { patientId: 'P100001', patientName: '张伟', itemType: 'REGISTRATION', refId: 'V20260001', subject: 'CT 平扫登记缴费', amount: 425, method: 'WECHAT', status: 'PAID' },
    { patientId: 'P100002', patientName: '李娜', itemType: 'APPOINTMENT', refId: 'AP-P100002-001', subject: 'MR 颅脑预约', amount: 620, method: 'ALIPAY', status: 'PAID' },
    { patientId: 'P100003', patientName: '王芳', itemType: 'EXAM', refId: 'EX-2026-0031', subject: 'DR 腰椎检查', amount: 120, method: 'INSURANCE', status: 'PAID' },
    { patientId: 'P100004', patientName: '陈杰', itemType: 'REGISTRATION', refId: 'V20260004', subject: 'CT 增强登记缴费', amount: 680, method: 'WECHAT', status: 'CREATED' },
    { patientId: 'P100001', patientName: '张伟', itemType: 'EXAM', refId: 'EX-2026-0033', subject: 'MR 增强检查', amount: 880, method: 'MIXED', status: 'PARTIAL_REFUND' },
  ]
  seeds.forEach((s, i) => {
    const createdAt = new Date(now - (seeds.length - i) * 3600_000).toISOString()
    const id = `PAY-${String(++paySeq).padStart(6, '0')}`
    const orderNo = `PAY202606${String(i + 1).padStart(4, '0')}`
    const order: PaymentOrderDto = {
      id, orderNo, patientId: s.patientId, patientName: s.patientName, itemType: s.itemType, refId: s.refId, subject: s.subject,
      amount: s.amount, currency: 'CNY', method: s.method, status: s.status,
      paidAmount: s.status === 'CREATED' ? 0 : s.amount, refundedAmount: s.status === 'PARTIAL_REFUND' ? 200 : 0,
      transactionId: s.status === 'CREATED' ? undefined : `TXN-${hashNum(s.itemType + i).toString(16)}`,
      paidAt: s.status === 'CREATED' ? undefined : createdAt, refundedAt: s.status === 'PARTIAL_REFUND' ? createdAt : undefined,
      createdAt, updatedAt: createdAt,
    }
    payOrders.set(order.id, order)
    payOrderNoIndex.set(order.orderNo, order.id)
  })
}
seedPay()

function createPayOrder(body: { patientId?: string; patientName?: string; itemType?: PaymentOrderDto['itemType']; refId?: string; amount?: number; method?: PaymentMethod; subject?: string }): PaymentOrderDto | { error: string } {
  if (!body.patientId) return { error: 'patientId 不能为空' }
  const patient = PATIENTS.find((p) => p.patientId === body.patientId) ?? { patientId: body.patientId, name: body.patientName ?? '患者', phone: '', idCard: '', empiId: '' }
  const itemType = body.itemType ?? 'EXAM'
  const amount = body.amount ?? payDeriveAmount(itemType, body.refId)
  if (!Number.isFinite(amount) || amount <= 0) return { error: '订单金额必须大于 0' }
  const now = new Date().toISOString()
  const id = `PAY-${String(++paySeq).padStart(6, '0')}`
  const orderNo = `PAY${new Date().toISOString().slice(0, 10).replace(/-/g, '')}${String(paySeq).padStart(5, '0')}`
  const order: PaymentOrderDto = {
    id, orderNo, patientId: patient.patientId, patientName: body.patientName ?? patient.name, itemType, refId: body.refId,
    subject: body.subject ?? `${itemType} 费用`, amount, currency: 'CNY', method: body.method ?? 'WECHAT', status: 'CREATED',
    paidAmount: 0, refundedAmount: 0, createdAt: now, updatedAt: now,
  }
  payOrders.set(order.id, order)
  payOrderNoIndex.set(order.orderNo, order.id)
  return order
}

function getPayOrder(idOrNo: string): PaymentOrderDto | null {
  return payOrders.get(idOrNo) ?? payOrders.get(payOrderNoIndex.get(idOrNo) ?? '') ?? null
}

const payHandlers = [
  http.post(`${API}/payment/orders/from-registration`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as { visitId?: string; patientId?: string; patientName?: string; amount?: number; method?: PaymentMethod }
    if (!body.visitId) return bad('visitId 不能为空')
    const res = createPayOrder({ patientId: body.patientId ?? PATIENTS[0]!.patientId, patientName: body.patientName, itemType: 'REGISTRATION', refId: body.visitId, amount: body.amount ?? payDeriveAmount('REGISTRATION', body.visitId), method: body.method ?? 'WECHAT', subject: `登记缴费单 ${body.visitId}` })
    return 'error' in res ? bad(res.error) : HttpResponse.json({ success: true, data: res }, { status: 201 })
  }),

  http.post(`${API}/payment/orders/from-appointment`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as { appointmentId?: string; patientId?: string; patientName?: string; amount?: number; method?: PaymentMethod; modality?: string }
    if (!body.appointmentId) return bad('appointmentId 不能为空')
    const amount = body.amount ?? (body.modality ? MODALITY_FEE[body.modality.toUpperCase()] ?? payDeriveAmount('APPOINTMENT', body.appointmentId) : payDeriveAmount('APPOINTMENT', body.appointmentId))
    const res = createPayOrder({ patientId: body.patientId ?? PATIENTS[0]!.patientId, patientName: body.patientName, itemType: 'APPOINTMENT', refId: body.appointmentId, amount, method: body.method ?? 'ALIPAY', subject: `预约费用 ${body.appointmentId}` })
    return 'error' in res ? bad(res.error) : HttpResponse.json({ success: true, data: res }, { status: 201 })
  }),

  http.post(`${API}/payment/orders`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as Parameters<typeof createPayOrder>[0]
    const res = createPayOrder(body)
    return 'error' in res ? bad(res.error) : HttpResponse.json({ success: true, data: res }, { status: 201 })
  }),

  http.get(`${API}/payment/orders`, async ({ request }) => {
    await delay(80)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const method = url.searchParams.get('method')
    const patientId = url.searchParams.get('patientId')
    const itemType = url.searchParams.get('itemType')
    let items = [...payOrders.values()]
    if (status) items = items.filter((o) => o.status === status)
    if (method) items = items.filter((o) => o.method === method)
    if (patientId) items = items.filter((o) => o.patientId === patientId)
    if (itemType) items = items.filter((o) => o.itemType === itemType)
    items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return ok({ items, total: items.length, totalAmount: items.reduce((s, o) => s + o.amount, 0) })
  }),

  http.get(`${API}/payment/reconciliation`, async ({ request }) => {
    await delay(80)
    const url = new URL(request.url)
    const method = url.searchParams.get('method')
    const date = url.searchParams.get('date')
    let orders = [...payOrders.values()].filter((o) => ['PAID', 'PARTIAL_REFUND', 'REFUNDED'].includes(o.status))
    if (method) orders = orders.filter((o) => o.method === method)
    let rows = orders.map((o) => {
      const netAmount = o.paidAmount - o.refundedAmount
      return { orderNo: o.orderNo, patientId: o.patientId, method: o.method, amount: o.amount, paidAmount: o.paidAmount, refundedAmount: o.refundedAmount, netAmount, status: o.status, settleDate: (o.paidAt ?? o.createdAt).slice(0, 10), reconciled: netAmount >= 0 }
    })
    if (date) rows = rows.filter((r) => r.settleDate === date)
    return ok({ rows, total: rows.length, netAmount: rows.reduce((s, r) => s + r.netAmount, 0) })
  }),

  http.get(`${API}/payment/refunds`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const orderId = url.searchParams.get('orderId')
    const items = orderId ? payRefunds.filter((r) => r.orderId === orderId) : payRefunds
    return ok({ items, total: items.length })
  }),

  http.get(`${API}/payment/stats`, async () => {
    await delay(60)
    const items = [...payOrders.values()]
    const byStatus: Record<string, number> = {}
    const byMethod: Record<string, number> = {}
    let totalAmount = 0, paidAmount = 0, refundedAmount = 0
    for (const o of items) {
      byStatus[o.status] = (byStatus[o.status] ?? 0) + 1
      byMethod[o.method] = (byMethod[o.method] ?? 0) + 1
      totalAmount += o.amount; paidAmount += o.paidAmount; refundedAmount += o.refundedAmount
    }
    return ok({ totalOrders: items.length, byStatus, byMethod, totalAmount, paidAmount, refundedAmount, netAmount: paidAmount - refundedAmount, refundRate: paidAmount > 0 ? Number(((refundedAmount / paidAmount) * 100).toFixed(2)) : 0 })
  }),

  http.post(`${API}/payment/notify`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { orderNo?: string; method?: PaymentMethod; result?: 'SUCCESS' | 'FAIL'; transactionId?: string; failureReason?: string }
    if (!body.orderNo) return bad('orderNo 不能为空')
    const order = getPayOrder(body.orderNo)
    if (!order) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, { status: 404 })
    if (body.result === 'FAIL') {
      if (order.status === 'CREATED') { order.status = 'FAILED'; order.failureReason = body.failureReason ?? 'GATEWAY_FAIL'; order.updatedAt = new Date().toISOString() }
    } else if (order.status === 'CREATED') {
      order.method = body.method ?? order.method
      order.status = 'PAID'; order.paidAmount = order.amount
      order.transactionId = body.transactionId ?? `TXN-${hashNum(order.orderNo).toString(16)}`
      order.paidAt = new Date().toISOString(); order.updatedAt = order.paidAt
    }
    return ok({ received: true, order })
  }),

  http.get(`${API}/payment/orders/:id`, async ({ params }) => {
    await delay(60)
    const order = getPayOrder(String(params.id))
    if (!order) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, { status: 404 })
    return ok(order)
  }),

  http.post(`${API}/payment/orders/:id/pay`, async ({ params }) => {
    await delay(80)
    const order = getPayOrder(String(params.id))
    if (!order) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, { status: 404 })
    if (order.status === 'CREATED') {
      order.status = 'PAID'; order.paidAmount = order.amount; order.transactionId = `TXN-${hashNum(order.orderNo).toString(16)}`
      order.paidAt = new Date().toISOString(); order.updatedAt = order.paidAt
    }
    return ok(order)
  }),

  http.post(`${API}/payment/orders/:id/refund`, async ({ params, request }) => {
    await delay(80)
    const order = getPayOrder(String(params.id))
    if (!order) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, { status: 404 })
    if (order.status !== 'PAID' && order.status !== 'PARTIAL_REFUND') return bad(`订单状态 ${order.status} 不支持退款`)
    const body = (await request.json().catch(() => ({}))) as { amount?: number; reason?: string; operator?: string }
    const refundable = order.paidAmount - order.refundedAmount
    const amount = body.amount ?? refundable
    if (amount <= 0 || amount > refundable) return bad(`退款金额不合法 (可退 ${refundable})`)
    order.refundedAmount += amount
    order.status = order.refundedAmount >= order.paidAmount ? 'REFUNDED' : 'PARTIAL_REFUND'
    order.refundedAt = new Date().toISOString(); order.updatedAt = order.refundedAt
    const refund: PaymentRefundDto = { id: `REF-${String(++payRefundSeq).padStart(6, '0')}`, orderId: order.id, orderNo: order.orderNo, amount, reason: body.reason ?? '患者申请退款', operator: body.operator, createdAt: new Date().toISOString() }
    payRefunds.unshift(refund)
    return ok({ order, refund })
  }),

  http.post(`${API}/payment/orders/:id/close`, async ({ params, request }) => {
    await delay(80)
    const order = getPayOrder(String(params.id))
    if (!order) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '订单不存在' } }, { status: 404 })
    if (['PAID', 'PARTIAL_REFUND', 'REFUNDED'].includes(order.status)) return bad('已支付订单不可关闭')
    if (order.status === 'CLOSED') return bad('订单已关闭')
    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    order.status = 'CLOSED'; order.failureReason = body.reason ?? 'CLOSED_BY_OPERATOR'; order.closedAt = new Date().toISOString(); order.updatedAt = order.closedAt
    return ok(order)
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// 通知渠道
// ─────────────────────────────────────────────────────────────────────────────
const ncTemplates = new Map<string, NotificationTemplateDto>()
const ncLogs: DeliveryLogDto[] = []
let ncTplSeq = 0
let ncLogSeq = 0

function extractVars(content: string): string[] {
  const out = new Set<string>()
  const re = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) out.add(m[1]!)
  return [...out]
}
function renderTpl(content: string, vars: Record<string, string | number>): string {
  return content.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => String(vars[key] ?? `{{${key}}}`))
}
function validateRecipient(channel: string, recipient: string): string | null {
  if (!recipient) return 'RECIPIENT_REQUIRED'
  if (channel === 'SMS' || channel === 'VOICE') return /^1[3-9]\d{9}$/.test(recipient) ? null : 'INVALID_PHONE'
  if (channel === 'WECHAT_TEMPLATE') return /^(o|u)[0-9a-f]{8,}$/.test(recipient) ? null : 'INVALID_OPENID'
  return null
}
;(function seedNc() {
  const seeds: Array<Omit<NotificationTemplateDto, 'id' | 'createdAt' | 'updatedAt'>> = [
    { code: 'APPOINTMENT_REMINDER', name: '检查预约提醒', channel: 'SMS', title: '【G005影像】检查提醒', content: '{{patientName}}您好, 您预约的{{modality}}检查将于{{scheduledAt}}在{{deviceName}}进行。', variables: ['patientName', 'modality', 'scheduledAt', 'deviceName'], status: 'active' },
    { code: 'REPORT_READY', name: '报告出具通知', channel: 'WECHAT_TEMPLATE', title: '报告已出具', content: '{{patientName}}您好, 您{{examDate}}的{{modality}}{{bodyPart}}报告已出具。', variables: ['patientName', 'examDate', 'modality', 'bodyPart'], status: 'active' },
    { code: 'CRITICAL_ALERT', name: '危急值电话通知', channel: 'VOICE', title: '危急值提醒', content: '紧急: 患者{{patientName}}的{{modality}}发现危急值「{{criticalValue}}」, 请立即处置。', variables: ['patientName', 'modality', 'criticalValue'], status: 'active' },
    { code: 'SATISFACTION_SURVEY', name: '满意度调查邀请', channel: 'SMS', title: '【G005影像】满意度调查', content: '{{patientName}}您好, 诚邀您参与满意度评价。', variables: ['patientName'], status: 'active' },
  ]
  for (const t of seeds) {
    const now = new Date().toISOString()
    const tpl: NotificationTemplateDto = { id: `NT-${String(++ncTplSeq).padStart(4, '0')}`, ...t, createdAt: now, updatedAt: now }
    ncTemplates.set(tpl.id, tpl)
  }
})()

function ncFind(idOrCode: string): NotificationTemplateDto | null {
  return ncTemplates.get(idOrCode) ?? [...ncTemplates.values()].find((t) => t.code === idOrCode) ?? null
}

function ncSend(body: { templateId?: string; templateCode?: string; channel?: DeliveryLogDto['channel']; recipient?: string; variables?: Record<string, string | number>; patientId?: string }): DeliveryLogDto | string {
  const key = body.templateId ?? body.templateCode
  if (!key) return 'templateId 或 templateCode 必填'
  const tpl = ncFind(key)
  if (!tpl) return '模板不存在'
  if (tpl.status !== 'active') return `模板 ${tpl.code} 已停用`
  const channel = body.channel ?? tpl.channel
  const recipient = body.recipient ?? ''
  const error = validateRecipient(channel, recipient)
  const now = new Date().toISOString()
  const log: DeliveryLogDto = {
    id: `NLOG-${String(++ncLogSeq).padStart(6, '0')}`, templateId: tpl.id, templateCode: tpl.code, templateName: tpl.name,
    channel, recipient, patientId: body.patientId, title: tpl.title, content: renderTpl(tpl.content, body.variables ?? {}),
    variables: body.variables ?? {}, status: error ? 'FAILED' : 'SENT', attempts: 1, maxAttempts: 3, lastError: error ?? undefined,
    createdAt: now, sentAt: error ? undefined : now,
  }
  ncLogs.unshift(log)
  return log
}

const ncHandlers = [
  http.get(`${API}/notification-channel/templates`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const channel = url.searchParams.get('channel')
    const status = url.searchParams.get('status')
    let items = [...ncTemplates.values()]
    if (channel) items = items.filter((t) => t.channel === channel)
    if (status) items = items.filter((t) => t.status === status)
    return ok({ items, total: items.length })
  }),

  http.post(`${API}/notification-channel/templates`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { code?: string; name?: string; channel?: NotificationTemplateDto['channel']; title?: string; content?: string; variables?: string[]; status?: 'active' | 'inactive' }
    if (!body.code) return bad('模板编码 code 不能为空')
    if ([...ncTemplates.values()].some((t) => t.code === body.code)) return bad(`模板编码 ${body.code} 已存在`)
    if (!body.content) return bad('模板内容不能为空')
    const now = new Date().toISOString()
    const tpl: NotificationTemplateDto = { id: `NT-${String(++ncTplSeq).padStart(4, '0')}`, code: body.code, name: body.name ?? body.code, channel: body.channel ?? 'SMS', title: body.title ?? body.name ?? body.code, content: body.content, variables: body.variables ?? extractVars(body.content), status: body.status ?? 'active', createdAt: now, updatedAt: now }
    ncTemplates.set(tpl.id, tpl)
    return HttpResponse.json({ success: true, data: tpl }, { status: 201 })
  }),

  http.get(`${API}/notification-channel/logs`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const channel = url.searchParams.get('channel')
    const patientId = url.searchParams.get('patientId')
    const templateCode = url.searchParams.get('templateCode')
    let items = ncLogs
    if (status) items = items.filter((l) => l.status === status)
    if (channel) items = items.filter((l) => l.channel === channel)
    if (patientId) items = items.filter((l) => l.patientId === patientId)
    if (templateCode) items = items.filter((l) => l.templateCode === templateCode)
    return ok({ items, total: items.length })
  }),

  http.post(`${API}/notification-channel/logs/:id/retry`, async ({ params }) => {
    await delay(60)
    const log = ncLogs.find((l) => l.id === String(params.id))
    if (!log) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '投递日志不存在' } }, { status: 404 })
    if (log.status === 'SENT') return bad('该通知已发送成功, 无需重试')
    if (log.attempts >= log.maxAttempts) return bad('已达到最大重试次数')
    log.attempts += 1
    const error = validateRecipient(log.channel, log.recipient)
    if (error) { log.status = 'FAILED'; log.lastError = error } else { log.status = 'SENT'; log.sentAt = new Date().toISOString(); log.lastError = undefined }
    return ok(log)
  }),

  http.get(`${API}/notification-channel/stats`, async () => {
    await delay(60)
    const byStatus: Record<string, number> = {}
    const byChannel: Record<string, number> = {}
    for (const l of ncLogs) { byStatus[l.status] = (byStatus[l.status] ?? 0) + 1; byChannel[l.channel] = (byChannel[l.channel] ?? 0) + 1 }
    const sent = ncLogs.filter((l) => l.status === 'SENT').length
    return ok({ total: ncLogs.length, byStatus, byChannel, templateCount: ncTemplates.size, successRate: ncLogs.length > 0 ? Number(((sent / ncLogs.length) * 100).toFixed(2)) : 0 })
  }),

  http.post(`${API}/notification-channel/send`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as Parameters<typeof ncSend>[0]
    const res = ncSend(body)
    return typeof res === 'string' ? bad(res) : ok(res)
  }),

  http.post(`${API}/notification-channel/notify/appointment-reminder`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; patientName?: string; modality?: string; scheduledAt?: string; deviceName?: string; recipient?: string; channel?: DeliveryLogDto['channel'] }
    const res = ncSend({ templateCode: 'APPOINTMENT_REMINDER', channel: body.channel ?? 'SMS', recipient: body.recipient, patientId: body.patientId, variables: { patientName: body.patientName ?? '', modality: body.modality ?? '', scheduledAt: body.scheduledAt ?? '', deviceName: body.deviceName ?? '影像科' } })
    return typeof res === 'string' ? bad(res) : ok(res)
  }),

  http.post(`${API}/notification-channel/notify/report-ready`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; patientName?: string; examDate?: string; modality?: string; bodyPart?: string; recipient?: string; channel?: DeliveryLogDto['channel'] }
    const res = ncSend({ templateCode: 'REPORT_READY', channel: body.channel ?? 'WECHAT_TEMPLATE', recipient: body.recipient, patientId: body.patientId, variables: { patientName: body.patientName ?? '', examDate: body.examDate ?? '', modality: body.modality ?? '', bodyPart: body.bodyPart ?? '' } })
    return typeof res === 'string' ? bad(res) : ok(res)
  }),

  http.post(`${API}/notification-channel/notify/critical-alert`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; patientName?: string; modality?: string; criticalValue?: string; recipient?: string }
    const variables = { patientName: body.patientName ?? '', modality: body.modality ?? '', criticalValue: body.criticalValue ?? '' }
    const voice = ncSend({ templateCode: 'CRITICAL_ALERT', channel: 'VOICE', recipient: body.recipient, patientId: body.patientId, variables })
    const sms = ncSend({ templateCode: 'CRITICAL_ALERT', channel: 'SMS', recipient: body.recipient, patientId: body.patientId, variables })
    if (typeof voice === 'string') return bad(voice)
    if (typeof sms === 'string') return bad(sms)
    return ok({ voice, sms })
  }),

  http.get(`${API}/notification-channel/templates/:id`, async ({ params }) => {
    await delay(50)
    const tpl = ncTemplates.get(String(params.id))
    if (!tpl) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } }, { status: 404 })
    return ok(tpl)
  }),

  http.put(`${API}/notification-channel/templates/:id`, async ({ params, request }) => {
    await delay(80)
    const tpl = ncTemplates.get(String(params.id))
    if (!tpl) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } }, { status: 404 })
    const body = (await request.json().catch(() => ({}))) as Partial<NotificationTemplateDto>
    Object.assign(tpl, body, { id: tpl.id, updatedAt: new Date().toISOString() })
    if (body.content) tpl.variables = body.variables ?? extractVars(body.content)
    return ok(tpl)
  }),

  http.delete(`${API}/notification-channel/templates/:id`, async ({ params }) => {
    await delay(60)
    const tpl = ncTemplates.get(String(params.id))
    if (!tpl) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '模板不存在' } }, { status: 404 })
    tpl.status = 'inactive'; tpl.updatedAt = new Date().toISOString()
    return ok({ deleted: true, id: tpl.id })
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// 满意度
// ─────────────────────────────────────────────────────────────────────────────
const svSurveys = new Map<string, SurveyDto>()
const svResponses: SurveyResponseDto[] = []
let svSurveySeq = 0
let svRespSeq = 0
const POS = ['满意', '很好', '专业', '耐心', '周到', '高效', '清晰', '准时', '热情', '感谢', '不错', '快捷', '细致']
const NEG = ['不满意', '差', '慢', '等待', '拥挤', '冷漠', '态度', '敷衍', '嘈杂', '乱', '错误', '延误', '收费高', '投诉']

function classify(comment: string): 'positive' | 'neutral' | 'negative' {
  if (!comment) return 'neutral'
  const p = POS.filter((w) => comment.includes(w)).length
  const n = NEG.filter((w) => comment.includes(w)).length
  return p > n ? 'positive' : n > p ? 'negative' : 'neutral'
}
function extractTags(comment: string): string[] {
  const tags: string[] = []
  if (/等待|候诊|排队|叫号/.test(comment)) tags.push('等待时间')
  if (/态度|沟通|耐心|热情|冷漠|细致/.test(comment)) tags.push('服务态度')
  if (/报告|结论|出具/.test(comment)) tags.push('报告质量')
  if (/预约|提醒/.test(comment)) tags.push('预约流程')
  if (/环境|整洁|安静|嘈杂/.test(comment)) tags.push('就诊环境')
  if (/收费|价格|费用/.test(comment)) tags.push('收费')
  if (/专业|技师|医生|成像|设备/.test(comment)) tags.push('专业水平')
  return tags
}
const DEFAULT_QS = [
  { id: 'q1', text: '您对本次就诊服务整体满意吗?', type: 'rating' as const, max: 5 },
  { id: 'q2', text: '您有多大可能向亲友推荐本院影像检查服务?', type: 'nps' as const, max: 10 },
  { id: 'q3', text: '您的其他意见或建议', type: 'text' as const },
]
const SEED_COMMENTS = [
  '护士很耐心, 检查流程清晰, 非常满意。', '预约很方便, 报告出具很快, 感谢医生。', '候诊时间有点长, 希望改善叫号秩序。',
  '技师态度冷漠, 沟通不够细致。', '整体不错, 环境整洁安静。', '检查过程专业, 解释清楚, 值得推荐。',
  '等待太久, 体验一般。', '服务热情周到, 效率很高。', '报告结论清晰, 满意度高。', '收费偏高, 但服务尚可。',
  '预约提醒很及时, 减少了等待。', '设备先进, 成像清晰, 满意。',
]
const SEED_SCORES = [10, 9, 8, 7, 6, 10, 9, 5, 8, 9, 10, 7, 3, 9, 8, 10, 6, 9, 7, 8, 10, 4, 9, 8]
;(function seedSv() {
  const now = Date.now()
  const depts = ['放射科', 'CT室', 'MR室', '超声科']
  for (const dept of depts) {
    const tpl: SurveyDto = { id: `SV-${String(++svSurveySeq).padStart(4, '0')}`, title: `${dept}影像服务满意度调查`, type: 'EXAM', department: dept, questions: DEFAULT_QS.map((q) => ({ ...q })), status: 'OPEN', createdAt: new Date(now - 180 * 86400_000).toISOString(), updatedAt: new Date(now - 180 * 86400_000).toISOString() }
    svSurveys.set(tpl.id, tpl)
  }
  const list = [...svSurveys.values()]
  const mods = ['CT', 'MR', 'DR', 'US', 'MG']
  for (let i = 0; i < SEED_COMMENTS.length; i++) {
    const survey = list[i % list.length]!
    const score = SEED_SCORES[i % SEED_SCORES.length]!
    const rating = Math.max(1, Math.min(5, Math.round(score / 2)))
    const comment = SEED_COMMENTS[i]!
    svResponses.push({ id: `SR-${String(++svRespSeq).padStart(5, '0')}`, surveyId: survey.id, patientId: PATIENTS[i % 4]!.patientId, patientName: PATIENTS[i % 4]!.name, department: survey.department, modality: mods[i % mods.length], answers: [{ questionId: 'q1', value: rating }, { questionId: 'q2', value: score }, { questionId: 'q3', value: comment }], rating, npsScore: score, comment, sentiment: classify(comment), tags: extractTags(comment), submittedAt: new Date(now - i * 5 * 86400_000).toISOString() })
  }
})()

function nps(scores: number[]) {
  const promoters = scores.filter((s) => s >= 9).length
  const detractors = scores.filter((s) => s <= 6).length
  const passives = scores.length - promoters - detractors
  return { nps: scores.length ? Math.round(((promoters - detractors) / scores.length) * 100) : 0, promoters, passives, detractors }
}
const avgOf = (nums: number[]) => (nums.length ? Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)) : 0)

const svHandlers = [
  http.get(`${API}/satisfaction/surveys`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const department = url.searchParams.get('department')
    const status = url.searchParams.get('status')
    const type = url.searchParams.get('type')
    let items = [...svSurveys.values()]
    if (department) items = items.filter((s) => s.department === department)
    if (status) items = items.filter((s) => s.status === status)
    if (type) items = items.filter((s) => s.type === type)
    return ok({ items, total: items.length })
  }),

  http.post(`${API}/satisfaction/surveys`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { title?: string; type?: string; department?: string; modality?: string; questions?: SurveyDto['questions']; status?: 'OPEN' | 'CLOSED' }
    if (!body.title) return bad('问卷标题不能为空')
    const now = new Date().toISOString()
    const survey: SurveyDto = { id: `SV-${String(++svSurveySeq).padStart(4, '0')}`, title: body.title, type: body.type ?? 'GENERAL', department: body.department ?? '放射科', modality: body.modality, questions: body.questions && body.questions.length > 0 ? body.questions : DEFAULT_QS.map((q) => ({ ...q })), status: body.status ?? 'OPEN', createdAt: now, updatedAt: now }
    svSurveys.set(survey.id, survey)
    return HttpResponse.json({ success: true, data: survey }, { status: 201 })
  }),

  http.get(`${API}/satisfaction/responses`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const surveyId = url.searchParams.get('surveyId')
    const department = url.searchParams.get('department')
    const sentiment = url.searchParams.get('sentiment')
    let items = [...svResponses]
    if (surveyId) items = items.filter((r) => r.surveyId === surveyId)
    if (department) items = items.filter((r) => r.department === department)
    if (sentiment) items = items.filter((r) => r.sentiment === sentiment)
    items.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
    return ok({ items, total: items.length })
  }),

  http.get(`${API}/satisfaction/analytics`, async ({ request }) => {
    await delay(70)
    const url = new URL(request.url)
    const department = url.searchParams.get('department')
    const modality = url.searchParams.get('modality')
    let items = [...svResponses]
    if (department) items = items.filter((r) => r.department === department)
    if (modality) items = items.filter((r) => r.modality === modality)
    const scores = items.map((r) => r.npsScore)
    const npsInfo = nps(scores)
    const sentiment: Record<string, number> = { positive: 0, neutral: 0, negative: 0 }
    for (const r of items) sentiment[r.sentiment] = (sentiment[r.sentiment] ?? 0) + 1
    const group = (fn: (r: SurveyResponseDto) => string) => {
      const map = new Map<string, SurveyResponseDto[]>()
      for (const r of items) { const k = fn(r); if (!map.has(k)) map.set(k, []); map.get(k)!.push(r) }
      return map
    }
    const byDepartment = [...group((r) => r.department).entries()].map(([d, list]) => ({ department: d, responses: list.length, avgRating: avgOf(list.map((r) => r.rating)), nps: nps(list.map((r) => r.npsScore)).nps })).sort((a, b) => b.nps - a.nps)
    const byModality = [...group((r) => r.modality ?? '未知').entries()].map(([m, list]) => ({ modality: m, responses: list.length, avgRating: avgOf(list.map((r) => r.rating)), nps: nps(list.map((r) => r.npsScore)).nps })).sort((a, b) => b.responses - a.responses)
    const trend = [...group((r) => r.submittedAt.slice(0, 7)).entries()].map(([period, list]) => ({ period, responses: list.length, avgRating: avgOf(list.map((r) => r.rating)), nps: nps(list.map((r) => r.npsScore)).nps })).sort((a, b) => a.period.localeCompare(b.period))
    const comments = items.filter((r) => r.comment.trim()).map((r) => ({ responseId: r.id, department: r.department, modality: r.modality, comment: r.comment, sentiment: r.sentiment, tags: r.tags, submittedAt: r.submittedAt }))
    const open = [...svSurveys.values()].filter((s) => s.status === 'OPEN').length
    return ok({
      overall: { totalResponses: items.length, avgRating: avgOf(items.map((r) => r.rating)), avgNpsScore: avgOf(scores), nps: npsInfo.nps, promoters: npsInfo.promoters, passives: npsInfo.passives, detractors: npsInfo.detractors, sentiment, responseRate: open > 0 ? Math.min(100, Number(((items.length / (open * 10)) * 100).toFixed(2))) : 0 },
      byDepartment, byModality, trend, comments,
    })
  }),

  http.get(`${API}/satisfaction/surveys/:id`, async ({ params }) => {
    await delay(50)
    const survey = svSurveys.get(String(params.id))
    if (!survey) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '问卷不存在' } }, { status: 404 })
    return ok(survey)
  }),

  http.post(`${API}/satisfaction/surveys/:id/respond`, async ({ params, request }) => {
    await delay(80)
    const survey = svSurveys.get(String(params.id))
    if (!survey) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '问卷不存在' } }, { status: 404 })
    if (survey.status === 'CLOSED') return bad('问卷已关闭')
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; patientName?: string; answers?: Array<{ questionId: string; value: string | number }>; rating?: number; npsScore?: number; comment?: string }
    const answers = body.answers ?? []
    const rating = Number(body.rating ?? answers.find((a) => a.questionId === 'q1')?.value ?? 0)
    const score = Number(body.npsScore ?? answers.find((a) => a.questionId === 'q2')?.value ?? 0)
    if (!(rating >= 1 && rating <= 5)) return bad('整体评分 rating 必须为 1-5')
    if (!(score >= 0 && score <= 10)) return bad('NPS 评分必须为 0-10')
    const comment = String(body.comment ?? answers.find((a) => a.questionId === 'q3')?.value ?? '')
    const response: SurveyResponseDto = { id: `SR-${String(++svRespSeq).padStart(5, '0')}`, surveyId: survey.id, patientId: body.patientId, patientName: body.patientName, department: survey.department, modality: survey.modality, answers: answers.length ? answers : [{ questionId: 'q1', value: rating }, { questionId: 'q2', value: score }, { questionId: 'q3', value: comment }], rating, npsScore: score, comment, sentiment: classify(comment), tags: extractTags(comment), submittedAt: new Date().toISOString() }
    svResponses.push(response)
    return HttpResponse.json({ success: true, data: response }, { status: 201 })
  }),
]

// ─────────────────────────────────────────────────────────────────────────────
// 自助登记
// ─────────────────────────────────────────────────────────────────────────────
const srCheckIns = new Map<string, unknown>()
const srQuestionnaires = new Map<string, unknown>()
const srConsents = new Map<string, unknown[]>()
const srQueues = new Map<string, unknown[]>()
let srCheckInSeq = 0
let srConsentSeq = 0
let srTicketSeq = 0
const PREP_ITEMS = [
  { key: 'fasting', label: '禁食 4-6 小时 (增强/腹部检查)', required: true },
  { key: 'metal', label: '去除金属物品 / 磁卡 (MR)', required: true },
  { key: 'water', label: '检查前适量饮水充盈膀胱 (腹部/盆腔)', required: false },
  { key: 'bowel', label: '肠道准备 (结肠相关检查)', required: false },
  { key: 'renal', label: '提供近期肾功能报告 (增强)', required: true },
]

const srHandlers = [
  http.post(`${API}/self-registration/identify`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { idCard?: string; phone?: string; empiId?: string; name?: string }
    if (!body.idCard && !body.phone && !body.empiId && !body.name) return bad('请至少提供身份证号 / 手机号 / EMPI / 姓名之一')
    const matched = PATIENTS.find((p) => (body.idCard && p.idCard === body.idCard) || (body.phone && p.phone === body.phone) || (body.empiId && p.empiId === body.empiId) || (body.name && p.name === body.name)) ?? null
    const candidates = matched ? PATIENTS : PATIENTS.filter((p) => (body.name ? p.name.includes(body.name) : false))
    return ok({ query: body, matched, candidates: candidates.length ? candidates : PATIENTS, needQuestionnaire: true, prepRequired: true, source: 'seed', identifiedAt: new Date().toISOString() })
  }),

  http.post(`${API}/self-registration/check-in`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; visitId?: string; appointmentId?: string }
    if (!body.patientId) return bad('patientId 不能为空')
    const patient = PATIENTS.find((p) => p.patientId === body.patientId)
    if (!patient) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '患者不存在' } }, { status: 404 })
    const existing = srCheckIns.get(patient.patientId) as { status?: string } | undefined
    if (existing?.status === 'CHECKED_IN') return ok({ ...existing, status: 'ALREADY_CHECKED_IN' })
    const blockers: string[] = []
    if (!srQuestionnaires.has(patient.patientId)) blockers.push('未完成检查前问卷')
    if (!(srConsents.get(patient.patientId)?.length)) blockers.push('未签署知情同意')
    const visitId = body.visitId ?? `V${new Date().getFullYear()}${String(hashNum(patient.patientId) % 100000).padStart(5, '0')}`
    const record = { id: `CI-${String(++srCheckInSeq).padStart(6, '0')}`, patientId: patient.patientId, patientName: patient.name, visitId, appointmentId: body.appointmentId, status: blockers.length ? 'BLOCKED' : 'CHECKED_IN', blockers, booth: `自助机-${1 + (hashNum(patient.patientId) % 4)}`, checkedInAt: new Date().toISOString() }
    srCheckIns.set(patient.patientId, record)
    return ok(record)
  }),

  http.post(`${API}/self-registration/questionnaire`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; allergies?: string[]; pregnant?: boolean; fastingConfirmed?: boolean; implants?: string[]; claustrophobia?: boolean; answers?: Record<string, string | number | boolean> }
    if (!body.patientId) return bad('patientId 不能为空')
    const patient = PATIENTS.find((p) => p.patientId === body.patientId)
    if (!patient) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '患者不存在' } }, { status: 404 })
    const allergies = body.allergies ?? []
    const implants = body.implants ?? []
    const allergyFlag = allergies.length > 0
    const pregnancyFlag = Boolean(body.pregnant)
    const implantFlag = implants.length > 0
    const fastingConfirmed = body.fastingConfirmed !== false
    const riskNotes: string[] = []
    if (allergyFlag) riskNotes.push(`过敏史: ${allergies.join('、')}`)
    if (pregnancyFlag) riskNotes.push('妊娠状态, 慎用辐射/对比剂')
    if (implantFlag) riskNotes.push(`体内植入物: ${implants.join('、')}`)
    if (body.claustrophobia) riskNotes.push('幽闭恐惧, 需镇静评估')
    if (!fastingConfirmed) riskNotes.push('未确认禁食准备')
    const riskLevel = allergyFlag || pregnancyFlag || implantFlag ? 'HIGH' : riskNotes.length ? 'MEDIUM' : 'LOW'
    const record = { patientId: patient.patientId, answers: body.answers ?? {}, allergyFlag, pregnancyFlag, fastingConfirmed, implantFlag, riskLevel, riskNotes, prepItems: PREP_ITEMS.map((p) => ({ ...p })), submittedAt: new Date().toISOString() }
    srQuestionnaires.set(patient.patientId, record)
    return ok(record)
  }),

  http.get(`${API}/self-registration/questionnaire/:patientId`, async ({ params }) => {
    await delay(50)
    return ok(srQuestionnaires.get(String(params.patientId)) ?? null)
  }),

  http.post(`${API}/self-registration/consent`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; visitId?: string; consentType?: string; procedure?: string; agreed?: boolean; signedBy?: string; witnessName?: string; signature?: string }
    if (!body.patientId) return bad('patientId 不能为空')
    const patient = PATIENTS.find((p) => p.patientId === body.patientId)
    if (!patient) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '患者不存在' } }, { status: 404 })
    const agreed = body.agreed !== false
    if (agreed && !body.signature && !body.signedBy) return bad('同意时需提供签名或签署人')
    const record = { id: `SC-${String(++srConsentSeq).padStart(6, '0')}`, patientId: patient.patientId, visitId: body.visitId ?? `V${hashNum(patient.patientId) % 100000}`, consentType: body.consentType ?? 'contrast', procedure: body.procedure ?? '影像检查及对比剂使用', agreed, status: agreed ? 'signed' : 'refused', signedBy: body.signedBy, witnessName: body.witnessName, signedAt: new Date().toISOString(), signatureHash: hashNum(`${patient.patientId}:${body.signature ?? body.signedBy ?? ''}`).toString(16) }
    const list = (srConsents.get(patient.patientId) ?? []) as unknown[]
    list.push(record)
    srConsents.set(patient.patientId, list)
    return HttpResponse.json({ success: true, data: record }, { status: 201 })
  }),

  http.get(`${API}/self-registration/consent/:patientId`, async ({ params }) => {
    await delay(50)
    const items = (srConsents.get(String(params.patientId)) ?? []) as unknown[]
    return ok({ items, total: items.length })
  }),

  http.post(`${API}/self-registration/queue-number`, async ({ request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { patientId?: string; visitId?: string; modality?: string; priority?: 'NORMAL' | 'URGENT' | 'EMERGENCY' }
    if (!body.patientId) return bad('patientId 不能为空')
    const patient = PATIENTS.find((p) => p.patientId === body.patientId)
    if (!patient) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '患者不存在' } }, { status: 404 })
    const modality = (body.modality ?? 'CT').toUpperCase()
    const priority = body.priority ?? 'NORMAL'
    const seq = ++srTicketSeq
    const boost = priority === 'EMERGENCY' ? 0 : priority === 'URGENT' ? 1 : 2
    const position = Math.max(1, boost + (hashNum(patient.patientId + modality) % 4))
    const record = { ticket: `${modality.slice(0, 1)}${String(seq).padStart(3, '0')}`, patientId: patient.patientId, patientName: patient.name, visitId: body.visitId ?? `V${hashNum(patient.patientId) % 100000}`, modality, priority, position, estimatedWaitMinutes: position * 8, room: `${modality}-${1 + (hashNum(modality) % 3)}`, issuedAt: new Date().toISOString() }
    const list = (srQueues.get(modality) ?? []) as unknown[]
    list.push(record)
    srQueues.set(modality, list)
    return ok(record)
  }),

  http.get(`${API}/self-registration/queue/:modality`, async ({ params }) => {
    await delay(50)
    const items = (srQueues.get(String(params.modality).toUpperCase()) ?? []) as unknown[]
    return ok({ items, total: items.length })
  }),

  http.get(`${API}/self-registration/status/:patientId`, async ({ params }) => {
    await delay(50)
    const patientId = String(params.patientId)
    const checkIn = (srCheckIns.get(patientId) ?? null) as { status?: string } | null
    const consents = (srConsents.get(patientId) ?? []) as Array<{ status?: string }>
    let queue: unknown = null
    for (const list of srQueues.values()) { const found = (list as Array<{ patientId: string }>).find((q) => q.patientId === patientId); if (found) queue = found }
    return ok({ patientId, checkedIn: checkIn?.status === 'CHECKED_IN' || checkIn?.status === 'ALREADY_CHECKED_IN', checkIn, questionnaireDone: srQuestionnaires.has(patientId), consentSigned: consents.some((c) => c.status === 'signed'), queue })
  }),
]

// 微信服务号/小程序 handlers (由 wechatHandlers.ts 注册, 避免重复匹配)
export const wechatHandlers = wxHandlers

export const w12PatientHandlers = [
  ...payHandlers,
  ...ncHandlers,
  ...svHandlers,
  ...srHandlers,
]
