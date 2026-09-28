/**
 * [G005 W11-DeviceOps] 设备运维中心 MSW handlers (确定性).
 * 覆盖: 工单状态机 / 校准认证 / 资产折旧 / OEE 停机损失 / 成本+DRG / 定时 BI 报表
 * 必须最前置注册 (静态子路径需先于既有通配路由)。
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1')

const API = `${API_BASE}/device-ops`

const delayMs = (min = 40, max = 120) => Math.floor((min + max) / 2)

const ANCHOR = Date.UTC(2026, 8, 1, 0, 0, 0)
const DAY = 86400000
const iso = (offsetDays: number, hour = 8) => new Date(ANCHOR + offsetDays * DAY + hour * 3600000).toISOString()
const round2 = (n: number) => Math.round(n * 100) / 100

interface WoPart { name: string; quantity: number; unitPrice: number }
interface Wo {
  id: string; kind: 'maintenance' | 'fault'; title: string; deviceId: string; deviceName: string
  priority: 'critical' | 'high' | 'medium' | 'low'; status: string; assignee: string; parts: WoPart[]
  createdAt: string; updatedAt: string; startedAt?: string; completedAt?: string; closedAt?: string
  description: string; source: 'manual' | 'fault-report'; timeline: Array<{ at: string; status: string; operator: string; note?: string }>
}

const TRANSITIONS: Record<string, string[]> = {
  new: ['open', 'assigned', 'closed'],
  open: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'waiting_parts', 'open', 'closed'],
  in_progress: ['waiting_parts', 'completed', 'assigned', 'closed'],
  waiting_parts: ['in_progress', 'completed', 'closed'],
  completed: ['closed', 'in_progress'],
  closed: ['open'],
}
const SLA_HOURS: Record<string, number> = { critical: 4, high: 8, medium: 24, low: 72 }
const DEVICES = [
  { id: 'CT-01', name: 'CT 1号机 (GE Revolution)', modality: 'CT' },
  { id: 'CT-02', name: 'CT 2号机 (联影 uCT 780)', modality: 'CT' },
  { id: 'MR-01', name: 'MR 1号机 (Siemens Skyra)', modality: 'MR' },
  { id: 'MR-02', name: 'MR 2号机 (Philips Ingenia)', modality: 'MR' },
  { id: 'DR-01', name: 'DR 1号机 (Philips DigitalDiagnost)', modality: 'DR' },
  { id: 'DR-02', name: 'DR 2号机 (Siemens Ysio)', modality: 'DR' },
  { id: 'MG-01', name: '钼靶 1号机 (Hologic Selenia)', modality: 'MG' },
  { id: 'DSA-01', name: 'DSA 1号机 (GE Innova)', modality: 'DSA' },
]

const seedWorkOrders = (): Wo[] => ([
  { id: 'WO-1001', kind: 'fault', title: 'CT-01 球管打火报警', deviceId: 'CT-01', deviceName: DEVICES[0]!.name, priority: 'critical', status: 'in_progress', assignee: '张工', parts: [{ name: '高压电缆', quantity: 1, unitPrice: 3200 }], createdAt: iso(-1, 9), updatedAt: iso(0, 10), startedAt: iso(-1, 11), description: '扫描中报 tube arcing，图像偶发环形伪影。', source: 'fault-report', timeline: [{ at: iso(-1, 9), status: 'created', operator: '系统' }, { at: iso(-1, 10), status: 'assigned', operator: '调度' }, { at: iso(-1, 11), status: 'in_progress', operator: '张工' }] },
  { id: 'WO-1002', kind: 'fault', title: 'MR-01 冷头压缩机异响', deviceId: 'MR-01', deviceName: DEVICES[2]!.name, priority: 'high', status: 'waiting_parts', assignee: '李工', parts: [{ name: '冷头压缩机', quantity: 1, unitPrice: 86000 }], createdAt: iso(-3), updatedAt: iso(-1, 16), startedAt: iso(-2, 9), description: '冷头压缩机噪音增大，液氦蒸发率上升。', source: 'fault-report', timeline: [{ at: iso(-3), status: 'created', operator: '系统' }, { at: iso(-2, 9), status: 'in_progress', operator: '李工' }, { at: iso(-1, 16), status: 'waiting_parts', operator: '李工' }] },
  { id: 'WO-1003', kind: 'maintenance', title: 'DR-01 季度预防性维护', deviceId: 'DR-01', deviceName: DEVICES[4]!.name, priority: 'medium', status: 'assigned', assignee: '王工', parts: [], createdAt: iso(-2), updatedAt: iso(-1, 9), description: '探测器增益校准、X线管训练。', source: 'manual', timeline: [{ at: iso(-2), status: 'created', operator: '系统' }, { at: iso(-1, 9), status: 'assigned', operator: '调度' }] },
  { id: 'WO-1004', kind: 'maintenance', title: 'MG-01 图像质量年检', deviceId: 'MG-01', deviceName: DEVICES[6]!.name, priority: 'medium', status: 'completed', assignee: '陈工', parts: [{ name: '压迫器', quantity: 1, unitPrice: 2800 }], createdAt: iso(-10), updatedAt: iso(-6, 15), startedAt: iso(-8, 9), completedAt: iso(-6, 15), description: '按 ACR 标准完成乳腺模体图像质量检测。', source: 'manual', timeline: [{ at: iso(-10), status: 'created', operator: '系统' }, { at: iso(-8, 9), status: 'in_progress', operator: '陈工' }, { at: iso(-6, 15), status: 'completed', operator: '陈工' }] },
  { id: 'WO-1005', kind: 'fault', title: 'DR-02 探头图像暗带', deviceId: 'DR-02', deviceName: DEVICES[5]!.name, priority: 'low', status: 'open', assignee: '', parts: [], createdAt: iso(-1, 14), updatedAt: iso(-1, 14), description: '腹部探头图像出现纵向暗带。', source: 'fault-report', timeline: [{ at: iso(-1, 14), status: 'created', operator: '系统' }] },
  { id: 'WO-1006', kind: 'maintenance', title: 'DSA-01 注射器联动巡检', deviceId: 'DSA-01', deviceName: DEVICES[7]!.name, priority: 'high', status: 'new', assignee: '', parts: [], createdAt: iso(0, 7), updatedAt: iso(0, 7), description: '注射器与 DSA 联动时序校验。', source: 'manual', timeline: [{ at: iso(0, 7), status: 'created', operator: '系统' }] },
  { id: 'WO-1007', kind: 'fault', title: 'CT-02 重建服务器磁盘告警', deviceId: 'CT-02', deviceName: DEVICES[1]!.name, priority: 'high', status: 'closed', assignee: '赵工', parts: [{ name: '企业级 SSD', quantity: 2, unitPrice: 4200 }], createdAt: iso(-14), updatedAt: iso(-12, 18), startedAt: iso(-14, 10), completedAt: iso(-13, 12), closedAt: iso(-12, 18), description: 'RAID 降级告警，更换故障磁盘。', source: 'fault-report', timeline: [{ at: iso(-14), status: 'created', operator: '系统' }, { at: iso(-13, 12), status: 'completed', operator: '赵工' }, { at: iso(-12, 18), status: 'closed', operator: '调度' }] },
  { id: 'WO-1008', kind: 'maintenance', title: 'MR-02 液氦液位补充', deviceId: 'MR-02', deviceName: DEVICES[3]!.name, priority: 'medium', status: 'in_progress', assignee: '李工', parts: [{ name: '液氦', quantity: 1, unitPrice: 15000 }], createdAt: iso(-1), updatedAt: iso(0, 9), startedAt: iso(0, 9), description: '液氦液位低于 55%，按计划补充。', source: 'manual', timeline: [{ at: iso(-1), status: 'created', operator: '系统' }, { at: iso(0, 9), status: 'in_progress', operator: '李工' }] },
  { id: 'WO-1009', kind: 'fault', title: 'DR-02 工作站软件崩溃', deviceId: 'DR-02', deviceName: DEVICES[5]!.name, priority: 'low', status: 'completed', assignee: '王工', parts: [], createdAt: iso(-5), updatedAt: iso(-4, 11), startedAt: iso(-4, 9), completedAt: iso(-4, 11), description: '检查采集软件异常退出。', source: 'fault-report', timeline: [{ at: iso(-5), status: 'created', operator: '系统' }, { at: iso(-4, 11), status: 'completed', operator: '王工' }] },
  { id: 'WO-1010', kind: 'maintenance', title: 'CT-01 半年度保养', deviceId: 'CT-01', deviceName: DEVICES[0]!.name, priority: 'medium', status: 'new', assignee: '', parts: [], createdAt: iso(0, 8), updatedAt: iso(0, 8), description: '球管老化测试、准直器校准。', source: 'manual', timeline: [{ at: iso(0, 8), status: 'created', operator: '系统' }] },
])

let workOrders: Wo[] = seedWorkOrders()
let woSeq = 1100

const slaOf = (wo: Wo) => {
  const base = SLA_HOURS[wo.priority] ?? 24
  const hours = wo.kind === 'fault' ? Math.max(1, Math.round(base / 2)) : base
  return { slaHours: hours, dueAt: new Date(new Date(wo.createdAt).getTime() + hours * 3600000).toISOString() }
}
const slaStateOf = (wo: Wo, dueAt: string, nowIso: string): string => {
  const due = new Date(dueAt).getTime()
  if (wo.completedAt) return new Date(wo.completedAt).getTime() <= due ? 'met' : 'breached'
  const now = new Date(nowIso).getTime()
  if (now > due) return 'breached'
  return due - now <= 3600000 ? 'at_risk' : 'on_track'
}
const toWoDto = (wo: Wo, nowIso: string) => {
  const { slaHours, dueAt } = slaOf(wo)
  return {
    ...wo,
    slaHours,
    dueAt,
    slaState: slaStateOf(wo, dueAt, nowIso),
    isActive: wo.status !== 'completed' && wo.status !== 'closed',
    totalPartsCost: round2(wo.parts.reduce((s, p) => s + p.quantity * p.unitPrice, 0)),
    nextStatuses: TRANSITIONS[wo.status] ?? [],
    timeline: [...wo.timeline],
  }
}
const NOW = iso(0, 12)

const wrap = <T>(data: T) => HttpResponse.json({ success: true, data })

export const w11DeviceHandlers = [
  // ── 工单 (stats 先于 :id) ──
  http.get(`${API}/work-orders/stats`, async () => {
    await delay(delayMs())
    const items = workOrders.map((w) => toWoDto(w, NOW))
    const byStatus: Record<string, number> = {}
    const byKind: Record<string, number> = {}
    const byPriority: Record<string, number> = {}
    let overdue = 0, breached = 0, met = 0, completed = 0, resolutionSum = 0, partsCost = 0
    for (const w of items) {
      byStatus[w.status] = (byStatus[w.status] ?? 0) + 1
      byKind[w.kind] = (byKind[w.kind] ?? 0) + 1
      byPriority[w.priority] = (byPriority[w.priority] ?? 0) + 1
      partsCost += w.totalPartsCost
      if (w.slaState === 'breached') breached += 1
      if (w.isActive && new Date(w.dueAt).getTime() < new Date(NOW).getTime()) overdue += 1
      if (w.completedAt) {
        completed += 1
        resolutionSum += (new Date(w.completedAt).getTime() - new Date(w.createdAt).getTime()) / 3600000
        if (w.slaState === 'met') met += 1
      }
    }
    const judged = items.filter((w) => w.slaState === 'met' || w.slaState === 'breached').length
    return wrap({
      total: items.length,
      active: items.filter((w) => w.isActive).length,
      byStatus, byKind, byPriority, overdue, breached,
      avgResolutionHours: completed > 0 ? round2(resolutionSum / completed) : 0,
      partsCost: round2(partsCost),
      slaCompliancePct: judged > 0 ? round2((met / judged) * 100) : 100,
    })
  }),
  http.get(`${API}/work-orders`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const kind = url.searchParams.get('kind')
    const priority = url.searchParams.get('priority')
    const deviceId = url.searchParams.get('deviceId')
    let rows = workOrders
    if (status) rows = rows.filter((w) => w.status === status)
    if (kind) rows = rows.filter((w) => w.kind === kind)
    if (priority) rows = rows.filter((w) => w.priority === priority)
    if (deviceId) rows = rows.filter((w) => w.deviceId === deviceId)
    const items = rows.map((w) => toWoDto(w, NOW)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    return wrap({ items, total: items.length })
  }),
  http.get(`${API}/work-orders/:id`, async ({ params }) => {
    await delay(delayMs())
    const wo = workOrders.find((w) => w.id === params.id)
    if (!wo) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '工单不存在' } }, { status: 404 })
    return wrap(toWoDto(wo, NOW))
  }),
  http.post(`${API}/work-orders`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Partial<Wo>
    woSeq += 1
    const id = `WO-${woSeq}`
    const device = DEVICES.find((d) => d.id === body.deviceId)
    const wo: Wo = {
      id, kind: body.kind ?? 'maintenance', title: body.title ?? '', deviceId: body.deviceId ?? '', deviceName: body.deviceName ?? device?.name ?? body.deviceId ?? '',
      priority: body.priority ?? 'medium', status: 'new', assignee: body.assignee ?? '', parts: body.parts ?? [],
      createdAt: NOW, updatedAt: NOW, description: body.description ?? '', source: 'manual',
      timeline: [{ at: NOW, status: 'created', operator: '当前用户', note: '工单已创建' }],
    }
    workOrders = [wo, ...workOrders]
    return wrap(toWoDto(wo, NOW))
  }),
  http.post(`${API}/work-orders/:id/advance`, async ({ params, request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { to?: string; assignee?: string; note?: string; operator?: string; parts?: WoPart[] }
    const wo = workOrders.find((w) => w.id === params.id)
    if (!wo) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '工单不存在' } }, { status: 404 })
    const to = body.to ?? ''
    if (!(TRANSITIONS[wo.status] ?? []).includes(to)) {
      return HttpResponse.json({ success: false, error: { code: 'INVALID_TRANSITION', message: `不允许从 ${wo.status} 转移到 ${to}` } }, { status: 400 })
    }
    if (body.assignee !== undefined) wo.assignee = body.assignee
    if (body.parts && body.parts.length > 0) wo.parts = [...wo.parts, ...body.parts]
    wo.status = to
    wo.updatedAt = NOW
    if (to === 'in_progress' && !wo.startedAt) wo.startedAt = NOW
    if (to === 'completed') wo.completedAt = NOW
    if (to === 'closed') wo.closedAt = NOW
    wo.timeline.push({ at: NOW, status: to, operator: body.operator ?? body.assignee ?? wo.assignee ?? '当前用户', note: body.note })
    return wrap(toWoDto(wo, NOW))
  }),

  // ── 校准 / 认证 ──
  http.get(`${API}/calibrations/due`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const days = Math.max(1, Number(url.searchParams.get('days') ?? 30))
    const items = CALIBRATIONS.map((c) => toCalDto(c)).filter((c) => c.dueState === 'overdue' || c.dueState === 'due_soon')
    return wrap({ items, total: items.length, days })
  }),
  http.get(`${API}/calibrations/failures`, async () => {
    await delay(delayMs())
    const items = CALIBRATIONS.map((c) => toCalDto(c)).filter((c) => c.result === 'fail' || c.dueState === 'overdue')
    return wrap({ items, total: items.length })
  }),
  http.get(`${API}/calibrations/stats`, async () => {
    await delay(delayMs())
    const ds = CALIBRATIONS.map((c) => toCalDto(c))
    const byKind: Record<string, number> = {}
    const byResult: Record<string, number> = {}
    for (const c of ds) {
      byKind[c.kind] = (byKind[c.kind] ?? 0) + 1
      byResult[c.result] = (byResult[c.result] ?? 0) + 1
    }
    const fail = ds.filter((c) => c.result === 'fail').length
    return wrap({
      total: ds.length, byKind, byResult,
      overdue: ds.filter((c) => c.dueState === 'overdue').length,
      dueSoon: ds.filter((c) => c.dueState === 'due_soon').length,
      failureRatePct: ds.length ? round2((fail / ds.length) * 100) : 0,
    })
  }),
  http.get(`${API}/calibrations`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const deviceId = url.searchParams.get('deviceId')
    const kind = url.searchParams.get('kind')
    let rows = CALIBRATIONS
    if (deviceId) rows = rows.filter((c) => c.deviceId === deviceId)
    if (kind) rows = rows.filter((c) => c.kind === kind)
    const items = rows.map((c) => toCalDto(c)).sort((a, b) => a.nextDue.localeCompare(b.nextDue))
    return wrap({ items, total: items.length })
  }),
  http.post(`${API}/calibrations`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Record<string, unknown>
    const device = DEVICES.find((d) => d.id === body.deviceId)
    const rec = {
      id: `CAL-${2000 + CALIBRATIONS.length + 1}`,
      deviceId: String(body.deviceId ?? ''), deviceName: String(body.deviceName ?? device?.name ?? body.deviceId ?? ''),
      kind: (body.kind as 'calibration' | 'certification') ?? 'calibration', standard: String(body.standard ?? ''),
      lastDate: String(body.lastDate ?? NOW), nextDue: String(body.nextDue ?? iso(365)),
      result: (body.result as 'pass' | 'fail' | 'pending') ?? 'pending',
      certNo: String(body.certNo ?? 'CERT-NEW'), lab: String(body.lab ?? '院内计量室'), operator: String(body.operator ?? '当前用户'),
      notes: body.notes ? String(body.notes) : undefined,
    }
    CALIBRATIONS.push(rec)
    return HttpResponse.json({ success: true, data: toCalDto(rec) }, { status: 201 })
  }),

  // ── 资产 / 折旧 (stats + retirements 先于 :id) ──
  http.get(`${API}/assets/stats`, async () => {
    await delay(delayMs())
    const ds = ASSETS.map((a) => toAssetDto(a))
    const byStatus: Record<string, number> = {}
    const byMethod: Record<string, number> = {}
    for (const a of ds) {
      byStatus[a.status] = (byStatus[a.status] ?? 0) + 1
      byMethod[a.method] = (byMethod[a.method] ?? 0) + 1
    }
    return wrap({
      totalAssets: ds.length,
      totalProcurementCost: round2(ds.reduce((s, a) => s + a.procurementCost, 0)),
      totalBookValue: round2(ds.reduce((s, a) => s + a.bookValue, 0)),
      totalAccumulated: round2(ds.reduce((s, a) => s + a.accumulatedDepreciation, 0)),
      byStatus, byMethod,
      warrantyExpiring: ds.filter((a) => a.warrantyDaysRemaining >= 0 && a.warrantyDaysRemaining <= 90).length,
      pendingRetirements: RETIREMENTS.filter((r) => r.status === 'pending').length,
    })
  }),
  http.get(`${API}/assets/retirements`, async () => wrap([...RETIREMENTS])),
  http.post(`${API}/assets/retirements/:id/approve`, async ({ params, request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { approved?: boolean; approvedBy?: string; scrapValue?: number }
    const approval = RETIREMENTS.find((r) => r.id === params.id)
    if (!approval) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '审批不存在' } }, { status: 404 })
    approval.status = body.approved ? 'approved' : 'rejected'
    approval.approvedBy = body.approvedBy ?? '当前用户'
    approval.approvedAt = NOW
    if (body.scrapValue !== undefined) approval.scrapValue = body.scrapValue
    if (body.approved) {
      const asset = ASSETS.find((a) => a.id === approval.assetId)
      if (asset) asset.status = approval.type === 'scrap' ? 'scrapped' : 'retired'
    }
    return wrap(approval)
  }),
  http.get(`${API}/assets`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    let rows = ASSETS
    if (status) rows = rows.filter((a) => a.status === status)
    const items = rows.map((a) => toAssetDto(a))
    return wrap({ items, total: items.length })
  }),
  http.get(`${API}/assets/:id/depreciation`, async ({ params, request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const asset = ASSETS.find((a) => a.id === params.id)
    if (!asset) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '资产不存在' } }, { status: 404 })
    const method = (url.searchParams.get('method') as 'straight-line' | 'declining' | null) ?? asset.method
    return wrap(computeDepreciation(asset, method, url.searchParams.get('asOf') ?? NOW.slice(0, 10)))
  }),
  http.get(`${API}/assets/:id`, async ({ params }) => {
    await delay(delayMs())
    const asset = ASSETS.find((a) => a.id === params.id)
    if (!asset) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '资产不存在' } }, { status: 404 })
    return wrap(toAssetDto(asset))
  }),
  http.post(`${API}/assets`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Record<string, unknown>
    const device = DEVICES.find((d) => d.id === body.deviceId)
    const asset = {
      id: `AST-${3000 + ASSETS.length + 1}`, deviceId: String(body.deviceId ?? ''), deviceName: String(body.deviceName ?? device?.name ?? body.deviceId ?? ''),
      category: String(body.category ?? '放射影像设备'), vendor: String(body.vendor ?? '未知厂商'), procurementCost: Number(body.procurementCost ?? 0),
      procurementDate: String(body.procurementDate ?? NOW.slice(0, 10)), installDate: String(body.installDate ?? NOW.slice(0, 10)),
      warrantyEnd: String(body.warrantyEnd ?? iso(365)), method: (body.method as 'straight-line' | 'declining') ?? 'straight-line',
      salvageRate: Number(body.salvageRate ?? 0.05), usefulLifeMonths: Number(body.usefulLifeMonths ?? 120),
      status: (body.status as 'in_use' | 'maintenance' | 'retired' | 'scrapped') ?? 'in_use',
    }
    ASSETS.push(asset)
    return HttpResponse.json({ success: true, data: toAssetDto(asset) }, { status: 201 })
  }),
  http.post(`${API}/assets/:id/retire`, async ({ params, request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { type?: 'retire' | 'scrap'; reason?: string; requestedBy?: string }
    const asset = ASSETS.find((a) => a.id === params.id)
    if (!asset) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '资产不存在' } }, { status: 404 })
    const approval = {
      id: `RET-${RETIREMENTS.length + 1}`, assetId: asset.id, deviceName: asset.deviceName,
      type: body.type ?? 'retire', reason: body.reason ?? '', requestedBy: body.requestedBy ?? '当前用户',
      requestedAt: NOW, status: 'pending' as const,
    }
    RETIREMENTS.unshift(approval)
    return wrap(approval)
  }),

  // ── OEE ──
  http.get(`${API}/oee/overview`, async () => {
    await delay(delayMs())
    const list = DEVICES.map(computeOee)
    const avg = (k: 'oee' | 'availability' | 'performance' | 'quality') => (list.length ? round2(list.reduce((s, d) => s + d[k], 0) / list.length) : 0)
    const sorted = [...list].sort((a, b) => b.oee - a.oee)
    const modalityMap = new Map<string, { modality: string; devices: number; sum: number }>()
    for (const d of list) {
      const e = modalityMap.get(d.modality) ?? { modality: d.modality, devices: 0, sum: 0 }
      e.devices += 1; e.sum += d.oee; modalityMap.set(d.modality, e)
    }
    return wrap({
      date: iso(0).slice(0, 10), avgOee: avg('oee'), avgAvailability: avg('availability'), avgPerformance: avg('performance'), avgQuality: avg('quality'),
      totalDevices: list.length,
      bestDevice: sorted[0] ? { id: sorted[0].deviceId, name: sorted[0].deviceName, oee: sorted[0].oee } : null,
      worstDevice: sorted.length ? { id: sorted[sorted.length - 1]!.deviceId, name: sorted[sorted.length - 1]!.deviceName, oee: sorted[sorted.length - 1]!.oee } : null,
      totalDowntimeHours: round2(list.reduce((s, d) => s + d.downtimeMinutes, 0) / 60),
      byModality: [...modalityMap.values()].map((m) => ({ modality: m.modality, devices: m.devices, oee: round2(m.sum / m.devices) })),
    })
  }),
  http.get(`${API}/oee/trend`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const count = Math.max(1, Math.min(Number(url.searchParams.get('days') ?? 7) || 7, 30))
    const list = DEVICES.map(computeOee)
    const avg = (k: 'oee' | 'availability' | 'performance' | 'quality') => round2(list.reduce((s, d) => s + d[k], 0) / Math.max(1, list.length))
    const items = []
    for (let i = count - 1; i >= 0; i--) {
      const actual = i === 0
      const f = 1 + ((i % 3) - 1) * 0.02
      const availability = actual ? avg('availability') : round2(avg('availability') * f)
      const performance = actual ? avg('performance') : round2(avg('performance') * f)
      const quality = actual ? avg('quality') : round2(Math.min(100, avg('quality') * f))
      items.push({ date: iso(-i).slice(0, 10), availability, performance, quality, oee: round2((availability * performance * quality) / 10000), source: actual ? 'actual' : 'derived' })
    }
    return wrap({ items })
  }),
  http.get(`${API}/oee/downtime-loss`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const deviceId = url.searchParams.get('deviceId')
    const devices = deviceId ? DEVICES.filter((d) => d.id === deviceId) : DEVICES
    const items = devices.map((d) => {
      const o = computeOee(d)
      return { deviceId: d.id, deviceName: d.name, modality: d.modality, loss: o.loss, lossPercent: o.lossPercent, workOrderIds: o.workOrderIds }
    })
    return wrap({ items, total: items.length })
  }),
  http.get(`${API}/oee/devices/:deviceId`, async ({ params }) => {
    await delay(delayMs())
    const device = DEVICES.find((d) => d.id === params.deviceId)
    if (!device) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '设备不存在' } }, { status: 404 })
    return wrap(computeOee(device))
  }),
  http.get(`${API}/oee`, async () => {
    await delay(delayMs())
    const items = DEVICES.map(computeOee)
    return wrap({ items, total: items.length })
  }),

  // ── 成本 + DRG ──
  http.get(`${API}/cost/summary`, async () => {
    await delay(delayMs())
    return wrap(computeCostSummary())
  }),
  http.get(`${API}/cost/by-exam`, async () => {
    await delay(delayMs())
    const items = COST_ROWS.map((row) => {
      const unitCost = round2(row.consumables + row.contrast + row.labor + row.depreciation + row.overhead)
      const totalRevenue = round2(row.volume * row.unitPrice)
      const totalCost = round2(row.volume * unitCost)
      return {
        examItem: row.examItem, modality: row.modality, volume: row.volume, unitPrice: row.unitPrice, unitCost,
        totalRevenue, totalCost, margin: round2(totalRevenue - totalCost),
        marginPct: totalRevenue ? round2(((totalRevenue - totalCost) / totalRevenue) * 100) : 0,
        breakdown: { consumables: row.consumables, contrast: row.contrast, labor: row.labor, depreciation: row.depreciation, overhead: row.overhead },
      }
    }).sort((a, b) => b.totalRevenue - a.totalRevenue)
    return wrap({ items, total: items.length })
  }),
  http.get(`${API}/drg/groups`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const baseRate = Number(url.searchParams.get('baseRate') ?? 12000) || 12000
    return wrap(computeDrg(baseRate))
  }),
  http.post(`${API}/drg/group`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { principalDiagnosisCode?: string; baseRate?: number }
    const g = groupDrg(String(body.principalDiagnosisCode ?? ''))
    const baseRate = Number(body.baseRate ?? 12000) || 12000
    return wrap({ ...g, payment: round2(g.weight * baseRate) })
  }),

  // ── 定时报表 ──
  http.get(`${API}/scheduled-reports`, async () => {
    await delay(delayMs())
    const items = REPORT_DEFS.map((d) => ({ ...d, nextRunAt: nextRunAt(d.frequency, d.timeOfDay) }))
    return wrap({ items, total: items.length })
  }),
  http.post(`${API}/scheduled-reports`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Record<string, unknown>
    const def = {
      id: `RPT-${4000 + REPORT_DEFS.length + 1}`, name: String(body.name ?? ''), reportType: String(body.reportType ?? 'custom'),
      frequency: (body.frequency as 'daily' | 'weekly' | 'monthly' | 'manual') ?? 'daily', timeOfDay: String(body.timeOfDay ?? '08:00'),
      recipients: Array.isArray(body.recipients) ? (body.recipients as string[]) : [], format: (body.format as 'xlsx' | 'pdf' | 'csv') ?? 'xlsx',
      enabled: body.enabled !== false, createdAt: NOW,
    }
    REPORT_DEFS.push(def)
    return HttpResponse.json({ success: true, data: { ...def, nextRunAt: nextRunAt(def.frequency, def.timeOfDay) } }, { status: 201 })
  }),
  http.post(`${API}/scheduled-reports/:id/run`, async ({ params }) => {
    await delay(delayMs())
    const def = REPORT_DEFS.find((d) => d.id === params.id)
    if (!def) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: '报表定义不存在' } }, { status: 404 })
    const rowCount = def.reportType.startsWith('oee') ? DEVICES.length : def.reportType.startsWith('cost') ? COST_ROWS.length : def.reportType.startsWith('drg') ? DRG_ROWS.length : 10
    const deliveryLog = def.recipients.map((recipient, idx) => ({ recipient, channel: 'email', status: (idx === def.recipients.length - 1 && def.recipients.length > 2 ? 'failed' : 'sent') as 'sent' | 'failed', at: NOW }))
    const instance = {
      id: `INST-${5000 + REPORT_INSTANCES.length + 1}`, definitionId: def.id, definitionName: def.name, generatedAt: NOW,
      status: (deliveryLog.some((l) => l.status === 'failed') ? 'failed' : 'success') as 'success' | 'failed', rowCount, sizeKb: 30 + rowCount * 4, format: def.format, deliveryLog, createdAt: NOW,
    }
    REPORT_INSTANCES.unshift(instance)
    def.lastRunAt = NOW
    return wrap(instance)
  }),
  http.get(`${API}/report-instances`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const definitionId = url.searchParams.get('definitionId')
    let rows = REPORT_INSTANCES
    if (definitionId) rows = rows.filter((i) => i.definitionId === definitionId)
    const items = rows.map((i) => ({ ...i, createdAt: i.generatedAt })).sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    return wrap({ items, total: items.length })
  }),
]

// ========================= 数据 + 计算 =========================

interface Calibration { id: string; deviceId: string; deviceName: string; kind: 'calibration' | 'certification'; standard: string; lastDate: string; nextDue: string; result: 'pass' | 'fail' | 'pending'; certNo: string; lab: string; operator: string; notes?: string }
interface Asset { id: string; deviceId: string; deviceName: string; category: string; vendor: string; procurementCost: number; procurementDate: string; installDate: string; warrantyEnd: string; method: 'straight-line' | 'declining'; salvageRate: number; usefulLifeMonths: number; status: 'in_use' | 'maintenance' | 'retired' | 'scrapped' }

const toCalDto = (c: Calibration) => {
  const next = new Date(c.nextDue).getTime()
  const now = new Date(NOW).getTime()
  const dueState = next < now ? 'overdue' : next - now <= 30 * DAY ? 'due_soon' : 'valid'
  return { ...c, dueState, daysRemaining: Math.ceil((next - now) / DAY) }
}

const CALIBRATIONS: Calibration[] = [
  { id: 'CAL-2001', deviceId: 'CT-01', deviceName: DEVICES[0]!.name, kind: 'calibration', standard: 'JJF 1257-2010 CT X射线剂量', lastDate: iso(-330), nextDue: iso(35), result: 'pass', certNo: 'CAL-CT01-2025', lab: '省计量院', operator: '张工' },
  { id: 'CAL-2002', deviceId: 'CT-02', deviceName: DEVICES[1]!.name, kind: 'calibration', standard: 'JJF 1257-2010 CT X射线剂量', lastDate: iso(-350), nextDue: iso(15), result: 'pass', certNo: 'CAL-CT02-2025', lab: '省计量院', operator: '王工' },
  { id: 'CAL-2003', deviceId: 'MR-01', deviceName: DEVICES[2]!.name, kind: 'calibration', standard: 'JJF 1337-2012 MR 成像质量', lastDate: iso(-360), nextDue: iso(-10), result: 'fail', certNo: 'CAL-MR01-2025', lab: '医学物理科', operator: '李工', notes: '信噪比低于标准，需整改后复测' },
  { id: 'CAL-2004', deviceId: 'MR-02', deviceName: DEVICES[3]!.name, kind: 'certification', standard: 'GBZ 130-2020 医用X射线防护', lastDate: iso(-300), nextDue: iso(65), result: 'pass', certNo: 'CERT-MR02-2025', lab: '市疾控中心', operator: '赵工' },
  { id: 'CAL-2005', deviceId: 'DR-01', deviceName: DEVICES[4]!.name, kind: 'calibration', standard: 'JJG 1078-2012 医用数字摄影', lastDate: iso(-320), nextDue: iso(45), result: 'pass', certNo: 'CAL-DR01-2025', lab: '省计量院', operator: '王工' },
  { id: 'CAL-2006', deviceId: 'DR-02', deviceName: DEVICES[5]!.name, kind: 'calibration', standard: 'JJG 1078-2012 医用数字摄影', lastDate: iso(-360), nextDue: iso(-5), result: 'fail', certNo: 'CAL-DR02-2025', lab: '省计量院', operator: '陈工', notes: '空间分辨力不达标' },
  { id: 'CAL-2007', deviceId: 'MG-01', deviceName: DEVICES[6]!.name, kind: 'calibration', standard: 'JJG 1078-2012 MG 摄影', lastDate: iso(-180), nextDue: iso(20), result: 'pass', certNo: 'CAL-MG01-2026', lab: '省计量院', operator: '陈工' },
  { id: 'CAL-2008', deviceId: 'DSA-01', deviceName: DEVICES[7]!.name, kind: 'certification', standard: 'GBZ 130-2020 介入防护', lastDate: iso(-200), nextDue: iso(160), result: 'pass', certNo: 'CERT-DSA01-2026', lab: '市疾控中心', operator: '赵工' },
  { id: 'CAL-2009', deviceId: 'DR-01', deviceName: DEVICES[4]!.name, kind: 'certification', standard: 'GBZ 130-2020 医用X射线防护', lastDate: iso(-150), nextDue: iso(28), result: 'pending', certNo: 'CERT-DR01-2026', lab: '市疾控中心', operator: '王工', notes: '现场检测完成，报告待出' },
  { id: 'CAL-2010', deviceId: 'CT-01', deviceName: DEVICES[0]!.name, kind: 'certification', standard: 'GBZ 130-2020 医用X射线防护', lastDate: iso(-290), nextDue: iso(75), result: 'pass', certNo: 'CERT-CT01-2025', lab: '市疾控中心', operator: '张工' },
]

const ASSETS: Asset[] = [
  { id: 'AST-3001', deviceId: 'CT-01', deviceName: DEVICES[0]!.name, category: '放射影像设备', vendor: 'GE Healthcare', procurementCost: 6800000, procurementDate: '2021-03-15', installDate: '2021-05-01', warrantyEnd: '2024-05-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 120, status: 'in_use' },
  { id: 'AST-3002', deviceId: 'CT-02', deviceName: DEVICES[1]!.name, category: '放射影像设备', vendor: '联影医疗', procurementCost: 4200000, procurementDate: '2022-06-01', installDate: '2022-08-01', warrantyEnd: '2025-08-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 120, status: 'in_use' },
  { id: 'AST-3003', deviceId: 'MR-01', deviceName: DEVICES[2]!.name, category: '放射影像设备', vendor: 'Siemens Healthineers', procurementCost: 12800000, procurementDate: '2020-09-01', installDate: '2021-01-01', warrantyEnd: '2024-01-01', method: 'declining', salvageRate: 0.08, usefulLifeMonths: 120, status: 'maintenance' },
  { id: 'AST-3004', deviceId: 'MR-02', deviceName: DEVICES[3]!.name, category: '放射影像设备', vendor: 'Philips', procurementCost: 9600000, procurementDate: '2023-02-01', installDate: '2023-05-01', warrantyEnd: '2026-05-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 120, status: 'in_use' },
  { id: 'AST-3005', deviceId: 'DR-01', deviceName: DEVICES[4]!.name, category: '放射影像设备', vendor: 'Philips', procurementCost: 850000, procurementDate: '2019-04-01', installDate: '2019-05-01', warrantyEnd: '2022-05-01', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 96, status: 'in_use' },
  { id: 'AST-3006', deviceId: 'DR-02', deviceName: DEVICES[5]!.name, category: '放射影像设备', vendor: 'Siemens Healthineers', procurementCost: 780000, procurementDate: '2018-08-01', installDate: '2018-09-01', warrantyEnd: '2021-09-01', method: 'declining', salvageRate: 0.05, usefulLifeMonths: 96, status: 'retired' },
  { id: 'AST-3007', deviceId: 'MG-01', deviceName: DEVICES[6]!.name, category: '放射影像设备', vendor: 'Hologic', procurementCost: 1560000, procurementDate: '2022-11-01', installDate: '2022-12-15', warrantyEnd: '2025-12-15', method: 'straight-line', salvageRate: 0.05, usefulLifeMonths: 96, status: 'in_use' },
  { id: 'AST-3008', deviceId: 'DSA-01', deviceName: DEVICES[7]!.name, category: '介入设备', vendor: 'GE Healthcare', procurementCost: 8900000, procurementDate: '2021-07-01', installDate: '2021-10-01', warrantyEnd: '2024-10-01', method: 'declining', salvageRate: 0.08, usefulLifeMonths: 108, status: 'in_use' },
]

interface Retirement { id: string; assetId: string; deviceName: string; type: 'retire' | 'scrap'; reason: string; requestedBy: string; requestedAt: string; status: 'pending' | 'approved' | 'rejected'; approvedBy?: string; approvedAt?: string; scrapValue?: number }
const RETIREMENTS: Retirement[] = []

// [demo seed] 资产退役/报废审批 (幂等), 使资产列表与 stats.pendingRetirements 非零
function seedRetirements(): void {
  if (RETIREMENTS.length > 0) return
  const seeds: Array<Omit<Retirement, 'id'>> = [
    { assetId: 'AST-3005', deviceName: DEVICES[4]!.name, type: 'retire', reason: '使用超过 7 年, 球管老化维护成本升高', requestedBy: '设备科-王工', requestedAt: iso(-12), status: 'pending' },
    { assetId: 'AST-3003', deviceName: DEVICES[2]!.name, type: 'retire', reason: '冷头故障频繁, 拟更新机型', requestedBy: '设备科-李工', requestedAt: iso(-5), status: 'pending' },
    { assetId: 'AST-3006', deviceName: DEVICES[5]!.name, type: 'scrap', reason: '已停用两年, 申请报废处置', requestedBy: '设备科-陈工', requestedAt: iso(-20), status: 'approved', approvedBy: '设备科主任', approvedAt: iso(-18), scrapValue: 12000 },
  ]
  seeds.forEach((s, i) => RETIREMENTS.push({ id: `RET-${i + 1}`, ...s }))
}
seedRetirements()

const monthKey = (v: string) => v.slice(0, 7)
const addMonths = (key: string, m: number) => {
  const [y, mo] = key.split('-').map(Number)
  const total = (y ?? 1970) * 12 + ((mo ?? 1) - 1) + m
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`
}

const computeDepreciation = (asset: Asset, method: 'straight-line' | 'declining', asOf: string) => {
  const cost = asset.procurementCost
  const residual = round2(cost * asset.salvageRate)
  const life = Math.max(1, asset.usefulLifeMonths)
  const start = monthKey(asset.installDate)
  const end = monthKey(asOf)
  const depreciable = Math.max(0, cost - residual)
  const schedule: Array<{ month: string; openingValue: number; depreciation: number; accumulated: number; closingValue: number }> = []
  let opening = cost
  let accumulated = 0
  let first = 0
  for (let i = 0; i < life; i++) {
    const month = addMonths(start, i)
    if (month > end) break
    let dep = method === 'straight-line' ? round2(depreciable / life) : round2((opening * 2) / life)
    const remaining = round2(cost - residual - accumulated)
    if (dep > remaining) dep = round2(remaining)
    if (dep < 0) dep = 0
    if (i === 0) first = dep
    accumulated = round2(accumulated + dep)
    const closing = round2(opening - dep)
    schedule.push({ month, openingValue: round2(opening), depreciation: dep, accumulated, closingValue: closing })
    opening = closing
  }
  return { method, cost: round2(cost), residualValue: residual, usefulLifeMonths: life, firstMonthDepreciation: first, accumulatedDepreciation: round2(accumulated), currentBookValue: round2(cost - accumulated), monthlyRatePct: round2(100 / life), schedule }
}

const toAssetDto = (a: Asset) => {
  const dep = computeDepreciation(a, a.method, NOW.slice(0, 10))
  const retirement = RETIREMENTS.filter((r) => r.assetId === a.id).sort((x, y) => y.requestedAt.localeCompare(x.requestedAt))[0]
  return {
    ...a, bookValue: dep.currentBookValue, accumulatedDepreciation: dep.accumulatedDepreciation, residualValue: dep.residualValue,
    warrantyDaysRemaining: Math.ceil((new Date(a.warrantyEnd).getTime() - new Date(NOW).getTime()) / DAY),
    depreciationMethod: a.method,
    retirementStatus: retirement ? retirement.status : a.status === 'scrapped' ? 'scrapped' : 'none',
  }
}

interface DowntimeEvent { reason: 'planned' | 'unplanned' | 'changeover' | 'idle' | 'small-stop'; minutes: number; workOrderId?: string }
const DOWNTIME: Record<string, DowntimeEvent[]> = {
  'CT-01': [{ reason: 'unplanned', minutes: 95, workOrderId: 'WO-1001' }, { reason: 'planned', minutes: 45 }, { reason: 'changeover', minutes: 25 }, { reason: 'small-stop', minutes: 18 }],
  'MR-01': [{ reason: 'unplanned', minutes: 210, workOrderId: 'WO-1002' }, { reason: 'planned', minutes: 60 }, { reason: 'idle', minutes: 40 }],
  'MR-02': [{ reason: 'planned', minutes: 180, workOrderId: 'WO-1008' }],
  'DR-01': [{ reason: 'changeover', minutes: 30 }, { reason: 'small-stop', minutes: 22 }],
  'DR-02': [{ reason: 'unplanned', minutes: 60, workOrderId: 'WO-1009' }],
  'MG-01': [{ reason: 'idle', minutes: 55 }],
  'DSA-01': [{ reason: 'changeover', minutes: 35 }, { reason: 'small-stop', minutes: 12 }],
  'CT-02': [],
}
const PRODUCTION: Record<string, { plannedMinutes: number; idealCycleMinutes: number; totalCount: number; goodCount: number }> = {
  'CT-01': { plannedMinutes: 720, idealCycleMinutes: 8, totalCount: 78, goodCount: 74 },
  'CT-02': { plannedMinutes: 720, idealCycleMinutes: 9, totalCount: 70, goodCount: 68 },
  'MR-01': { plannedMinutes: 660, idealCycleMinutes: 22, totalCount: 24, goodCount: 22 },
  'MR-02': { plannedMinutes: 660, idealCycleMinutes: 24, totalCount: 20, goodCount: 19 },
  'DR-01': { plannedMinutes: 720, idealCycleMinutes: 4, totalCount: 155, goodCount: 150 },
  'DR-02': { plannedMinutes: 720, idealCycleMinutes: 4, totalCount: 140, goodCount: 133 },
  'MG-01': { plannedMinutes: 600, idealCycleMinutes: 12, totalCount: 45, goodCount: 44 },
  'DSA-01': { plannedMinutes: 480, idealCycleMinutes: 35, totalCount: 12, goodCount: 12 },
}
const clamp = (n: number) => Math.max(0, Math.min(100, round2(n)))

const computeOee = (device: { id: string; name: string; modality: string }) => {
  const prod = PRODUCTION[device.id] ?? { plannedMinutes: 720, idealCycleMinutes: 10, totalCount: 40, goodCount: 38 }
  const events = DOWNTIME[device.id] ?? []
  const loss = { planned: 0, unplanned: 0, changeover: 0, idle: 0, smallStop: 0, total: 0 }
  for (const ev of events) {
    const m = Math.max(0, ev.minutes)
    if (ev.reason === 'small-stop') loss.smallStop += m
    else loss[ev.reason] += m
    loss.total += m
  }
  const availabilityDowntime = loss.planned + loss.unplanned + loss.changeover + loss.idle
  const runtime = Math.max(0, prod.plannedMinutes - availabilityDowntime)
  const availability = clamp((runtime / prod.plannedMinutes) * 100)
  const performance = runtime > 0 ? clamp(((prod.idealCycleMinutes * prod.totalCount) / runtime) * 100) : 0
  const quality = prod.totalCount > 0 ? clamp((prod.goodCount / prod.totalCount) * 100) : 100
  const totalLoss = Math.max(1, loss.total)
  return {
    deviceId: device.id, deviceName: device.name, modality: device.modality, date: iso(0).slice(0, 10),
    availability, performance, quality, oee: round2((availability * performance * quality) / 10000),
    plannedProductionMinutes: prod.plannedMinutes, downtimeMinutes: round2(loss.total), runtimeMinutes: round2(runtime),
    totalCount: prod.totalCount, goodCount: prod.goodCount, scrapCount: prod.totalCount - prod.goodCount,
    loss: { planned: round2(loss.planned), unplanned: round2(loss.unplanned), changeover: round2(loss.changeover), idle: round2(loss.idle), smallStop: round2(loss.smallStop), total: round2(loss.total) },
    lossPercent: {
      planned: round2((loss.planned / totalLoss) * 100), unplanned: round2((loss.unplanned / totalLoss) * 100),
      changeover: round2((loss.changeover / totalLoss) * 100), idle: round2((loss.idle / totalLoss) * 100), 'small-stop': round2((loss.smallStop / totalLoss) * 100),
    },
    workOrderIds: events.map((e) => e.workOrderId).filter((v): v is string => Boolean(v)),
    source: 'actual' as const,
  }
}

interface CostRow { examItem: string; modality: string; volume: number; unitPrice: number; consumables: number; contrast: number; labor: number; depreciation: number; overhead: number }
const COST_ROWS: CostRow[] = [
  { examItem: 'CT 胸部平扫', modality: 'CT', volume: 1280, unitPrice: 260, consumables: 18, contrast: 0, labor: 45, depreciation: 38, overhead: 22 },
  { examItem: 'CT 腹部增强', modality: 'CT', volume: 760, unitPrice: 520, consumables: 26, contrast: 185, labor: 62, depreciation: 42, overhead: 30 },
  { examItem: 'MR 头颅平扫', modality: 'MR', volume: 640, unitPrice: 420, consumables: 12, contrast: 0, labor: 68, depreciation: 96, overhead: 34 },
  { examItem: 'MR 腰椎增强', modality: 'MR', volume: 380, unitPrice: 680, consumables: 15, contrast: 210, labor: 78, depreciation: 104, overhead: 40 },
  { examItem: 'DR 胸部正位', modality: 'DR', volume: 2100, unitPrice: 90, consumables: 6, contrast: 0, labor: 14, depreciation: 8, overhead: 7 },
  { examItem: 'MG 乳腺钼靶', modality: 'MG', volume: 520, unitPrice: 180, consumables: 10, contrast: 0, labor: 26, depreciation: 24, overhead: 12 },
  { examItem: 'DSA 冠脉造影', modality: 'DSA', volume: 160, unitPrice: 3800, consumables: 420, contrast: 860, labor: 520, depreciation: 680, overhead: 260 },
]

const computeCostSummary = () => {
  let totalVolume = 0, totalRevenue = 0, totalCost = 0
  const breakdownTotals = { consumables: 0, contrast: 0, labor: 0, depreciation: 0, overhead: 0 }
  const map = new Map<string, { modality: string; volume: number; revenue: number; cost: number; breakdown: Record<string, number> }>()
  for (const row of COST_ROWS) {
    const unitCost = row.consumables + row.contrast + row.labor + row.depreciation + row.overhead
    const revenue = round2(row.volume * row.unitPrice)
    const cost = round2(row.volume * unitCost)
    totalVolume += row.volume; totalRevenue += revenue; totalCost += cost
    breakdownTotals.consumables += row.consumables * row.volume
    breakdownTotals.contrast += row.contrast * row.volume
    breakdownTotals.labor += row.labor * row.volume
    breakdownTotals.depreciation += row.depreciation * row.volume
    breakdownTotals.overhead += row.overhead * row.volume
    const e = map.get(row.modality) ?? { modality: row.modality, volume: 0, revenue: 0, cost: 0, breakdown: { consumables: 0, contrast: 0, labor: 0, depreciation: 0, overhead: 0 } }
    e.volume += row.volume; e.revenue += revenue; e.cost += cost
    for (const k of ['consumables', 'contrast', 'labor', 'depreciation', 'overhead'] as const) e.breakdown[k] = (e.breakdown[k] ?? 0) + row[k] * row.volume
    map.set(row.modality, e)
  }
  const byModality = [...map.values()].map((m) => ({
    modality: m.modality, volume: m.volume, revenue: round2(m.revenue), cost: round2(m.cost),
    margin: round2(m.revenue - m.cost), marginPct: m.revenue ? round2(((m.revenue - m.cost) / m.revenue) * 100) : 0,
    unitCost: m.volume ? round2(m.cost / m.volume) : 0,
    breakdown: { consumables: round2(m.breakdown.consumables!), contrast: round2(m.breakdown.contrast!), labor: round2(m.breakdown.labor!), depreciation: round2(m.breakdown.depreciation!), overhead: round2(m.breakdown.overhead!) },
  })).sort((a, b) => b.revenue - a.revenue)
  return {
    totalVolume, totalRevenue: round2(totalRevenue), totalCost: round2(totalCost),
    margin: { revenue: round2(totalRevenue), cost: round2(totalCost), margin: round2(totalRevenue - totalCost), marginPct: totalRevenue ? round2(((totalRevenue - totalCost) / totalRevenue) * 100) : 0 },
    breakdownTotals: { consumables: round2(breakdownTotals.consumables), contrast: round2(breakdownTotals.contrast), labor: round2(breakdownTotals.labor), depreciation: round2(breakdownTotals.depreciation), overhead: round2(breakdownTotals.overhead) },
    byModality,
  }
}

interface DrgSeed { drgCode: string; name: string; mdc: string; weight: number; cases: number; revenuePerCase: number; costPerCase: number }
const DRG_ROWS: DrgSeed[] = [
  { drgCode: 'FM19', name: '经皮冠脉支架植入', mdc: 'MDC-F', weight: 3.42, cases: 86, revenuePerCase: 42800, costPerCase: 36200 },
  { drgCode: 'BR23', name: '脑缺血性疾患', mdc: 'MDC-B', weight: 1.28, cases: 214, revenuePerCase: 16200, costPerCase: 13800 },
  { drgCode: 'ES31', name: '呼吸系统感染/炎症', mdc: 'MDC-E', weight: 0.92, cases: 356, revenuePerCase: 11800, costPerCase: 10500 },
  { drgCode: 'GK29', name: '消化系统恶性肿瘤', mdc: 'MDC-G', weight: 2.15, cases: 132, revenuePerCase: 27600, costPerCase: 25400 },
  { drgCode: 'IR15', name: '骨骼肌肉系统手术', mdc: 'MDC-I', weight: 1.76, cases: 178, revenuePerCase: 22400, costPerCase: 19600 },
  { drgCode: 'NR20', name: '神经系统其他疾患', mdc: 'MDC-N', weight: 1.05, cases: 240, revenuePerCase: 13400, costPerCase: 12200 },
]

const computeDrg = (baseRate: number) => {
  const items = DRG_ROWS.map((row) => {
    const totalWeight = round2(row.weight * row.cases)
    const revenue = round2(row.revenuePerCase * row.cases)
    const cost = round2(row.costPerCase * row.cases)
    return { drgCode: row.drgCode, name: row.name, mdc: row.mdc, weight: row.weight, cases: row.cases, totalWeight, payment: round2(totalWeight * baseRate), revenue, cost, margin: round2(revenue - cost), marginPct: revenue ? round2(((revenue - cost) / revenue) * 100) : 0 }
  }).sort((a, b) => b.revenue - a.revenue)
  const revenue = round2(items.reduce((s, i) => s + i.revenue, 0))
  const cost = round2(items.reduce((s, i) => s + i.cost, 0))
  return { baseRate, items, total: items.length, totals: { cases: items.reduce((s, i) => s + i.cases, 0), totalWeight: round2(items.reduce((s, i) => s + i.totalWeight, 0)), revenue, cost, margin: { revenue, cost, margin: round2(revenue - cost), marginPct: revenue ? round2(((revenue - cost) / revenue) * 100) : 0 } } }
}

const groupDrg = (code: string) => {
  const prefix = (code || '').toUpperCase().charAt(0)
  const byPrefix: Record<string, string> = { I: 'FM19', G: 'BR23', J: 'ES31', C: 'GK29', M: 'IR15', N: 'NR20' }
  const target = byPrefix[prefix]
  const found = target ? DRG_ROWS.find((r) => r.drgCode === target) : undefined
  return found ? { code: found.drgCode, name: found.name, mdc: found.mdc, weight: found.weight } : { code: 'ZZ01', name: '未入组 (通用)', mdc: 'MDC-Z', weight: 0.75 }
}

interface ReportDef { id: string; name: string; reportType: string; frequency: 'daily' | 'weekly' | 'monthly' | 'manual'; timeOfDay: string; recipients: string[]; format: 'xlsx' | 'pdf' | 'csv'; enabled: boolean; createdAt: string; lastRunAt?: string }
const REPORT_DEFS: ReportDef[] = [
  { id: 'RPT-4001', name: '设备 OEE 日报', reportType: 'oee-daily', frequency: 'daily', timeOfDay: '07:00', recipients: ['设备科', '院长办公室'], format: 'xlsx', enabled: true, createdAt: iso(-30), lastRunAt: iso(0, 7) },
  { id: 'RPT-4002', name: '停机损失周报', reportType: 'downtime-weekly', frequency: 'weekly', timeOfDay: '08:00', recipients: ['设备科'], format: 'pdf', enabled: true, createdAt: iso(-60), lastRunAt: iso(-4, 8) },
  { id: 'RPT-4003', name: '运营成本月报', reportType: 'cost-monthly', frequency: 'monthly', timeOfDay: '09:00', recipients: ['财务科', '运营办', '院长办公室'], format: 'xlsx', enabled: true, createdAt: iso(-90), lastRunAt: iso(-14, 9) },
  { id: 'RPT-4004', name: 'DRG 绩效月报', reportType: 'drg-monthly', frequency: 'monthly', timeOfDay: '09:30', recipients: ['医保办', '运营办'], format: 'pdf', enabled: false, createdAt: iso(-45) },
  { id: 'RPT-4005', name: '临时导出报表 (手动)', reportType: 'adhoc', frequency: 'manual', timeOfDay: '10:00', recipients: ['设备科'], format: 'csv', enabled: true, createdAt: iso(-10) },
]

interface ReportInstance { id: string; definitionId: string; definitionName: string; generatedAt: string; status: 'success' | 'failed' | 'running'; rowCount: number; sizeKb: number; format: 'xlsx' | 'pdf' | 'csv'; deliveryLog: Array<{ recipient: string; channel: string; status: 'sent' | 'failed'; at: string }> }
const REPORT_INSTANCES: ReportInstance[] = [
  { id: 'INST-5001', definitionId: 'RPT-4001', definitionName: '设备 OEE 日报', generatedAt: iso(0, 7), status: 'success', rowCount: 8, sizeKb: 42, format: 'xlsx', deliveryLog: [{ recipient: '设备科', channel: 'email', status: 'sent', at: iso(0, 7) }, { recipient: '院长办公室', channel: 'email', status: 'sent', at: iso(0, 7) }] },
  { id: 'INST-5002', definitionId: 'RPT-4002', definitionName: '停机损失周报', generatedAt: iso(-4, 8), status: 'success', rowCount: 14, sizeKb: 88, format: 'pdf', deliveryLog: [{ recipient: '设备科', channel: 'email', status: 'sent', at: iso(-4, 8) }] },
  { id: 'INST-5003', definitionId: 'RPT-4003', definitionName: '运营成本月报', generatedAt: iso(-14, 9), status: 'success', rowCount: 7, sizeKb: 65, format: 'xlsx', deliveryLog: [{ recipient: '财务科', channel: 'email', status: 'sent', at: iso(-14, 9) }, { recipient: '运营办', channel: 'email', status: 'sent', at: iso(-14, 9) }, { recipient: '院长办公室', channel: 'email', status: 'failed', at: iso(-14, 9) }] },
]

const nextRunAt = (frequency: 'daily' | 'weekly' | 'monthly' | 'manual', timeOfDay: string): string | null => {
  if (frequency === 'manual') return null
  const [hh, mm] = timeOfDay.split(':').map(Number)
  const next = new Date(ANCHOR)
  next.setUTCHours(hh ?? 0, mm ?? 0, 0, 0)
  next.setUTCDate(next.getUTCDate() + (frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : 30))
  return next.toISOString()
}
