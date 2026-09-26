/**
 * [W5] 预约/排班深度增强 MSW handlers (确定性 seed)
 * 覆盖: 机房 CRUD / 技师 / 时段容量 / 冲突预检 / 等候队列 / 提醒计划 /
 *        失约管理 / 急诊绿色通道 / 检查号编号策略 / 预约审计
 * 注册位置: handlers.ts 数组最前 (避免被既有 /appointments/:id 抢占)
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')

const ok = <T>(data: T, status = 200) => HttpResponse.json({ success: true, data }, { status })

interface Room {
  id: string
  name: string
  modality: string
  location: string
  maxPerSlot: number
  openTime: string
  closeTime: string
  status: string
}

const seedRooms: Room[] = [
  { id: 'ROOM-CT-01', name: 'CT-1 机房', modality: 'CT', location: '门诊楼1F-放射科', maxPerSlot: 4, openTime: '07:30', closeTime: '20:00', status: 'ACTIVE' },
  { id: 'ROOM-CT-02', name: 'CT-2 机房', modality: 'CT', location: '门诊楼1F-放射科', maxPerSlot: 4, openTime: '07:30', closeTime: '20:00', status: 'ACTIVE' },
  { id: 'ROOM-MR-01', name: 'MR-1 机房', modality: 'MR', location: '门诊楼B1-放射科', maxPerSlot: 2, openTime: '08:00', closeTime: '18:00', status: 'ACTIVE' },
  { id: 'ROOM-MR-02', name: 'MR-2 机房', modality: 'MR', location: '门诊楼B1-放射科', maxPerSlot: 2, openTime: '08:00', closeTime: '18:00', status: 'MAINTENANCE' },
  { id: 'ROOM-DR-01', name: 'DR-1 机房', modality: 'DR', location: '门诊楼1F-放射科', maxPerSlot: 5, openTime: '07:00', closeTime: '21:00', status: 'ACTIVE' },
  { id: 'ROOM-US-01', name: '超声-1 诊室', modality: 'US', location: '门诊楼2F-超声科', maxPerSlot: 3, openTime: '08:00', closeTime: '17:30', status: 'ACTIVE' },
]

const seedTechnicians = [
  { id: 'TECH-CT-01', name: '王技师', modality: 'CT', status: 'ACTIVE', shiftStart: '08:00', shiftEnd: '16:00' },
  { id: 'TECH-CT-02', name: '赵技师', modality: 'CT', status: 'ACTIVE', shiftStart: '12:00', shiftEnd: '20:00' },
  { id: 'TECH-MR-01', name: '孙技师', modality: 'MR', status: 'ACTIVE', shiftStart: '08:00', shiftEnd: '16:00' },
  { id: 'TECH-MR-02', name: '周技师', modality: 'MR', status: 'LEAVE', shiftStart: '08:00', shiftEnd: '16:00' },
  { id: 'TECH-DR-01', name: '吴技师', modality: 'DR', status: 'ACTIVE', shiftStart: '07:00', shiftEnd: '15:00' },
  { id: 'TECH-US-01', name: '郑技师', modality: 'US', status: 'ACTIVE', shiftStart: '08:00', shiftEnd: '17:00' },
]

let rooms: Room[] = seedRooms.map((r) => ({ ...r }))
let roomSeq = 0

let waitlist: Array<Record<string, any>> = [
  { id: 'WL-001', patientName: '陈六', patientId: 'P-10086', phone: '13800138006', modality: 'MR', bodyPart: '膝关节', examItemName: 'MR 膝关节平扫', priority: 'urgent', preferredDate: '2026-08-05', preferredTime: '09:00', seq: 1, notified: false, status: 'WAITING', addedAt: '2026-08-04 09:00' },
  { id: 'WL-002', patientName: '冯七', patientId: 'P-10087', phone: '13800138007', modality: 'CT', bodyPart: '胸部', examItemName: 'CT 胸部增强', priority: 'critical', preferredDate: '2026-08-05', preferredTime: '08:00', seq: 2, notified: false, status: 'WAITING', addedAt: '2026-08-04 09:20' },
  { id: 'WL-003', patientName: '褚八', patientId: 'P-10088', phone: '13800138008', modality: 'CT', bodyPart: '头颅', examItemName: 'CT 头颅平扫', priority: 'normal', preferredDate: '2026-08-06', preferredTime: '10:00', seq: 3, notified: false, status: 'WAITING', addedAt: '2026-08-04 10:05' },
]
let waitlistSeq = 3

let reminderPlans: Array<Record<string, any>> = [
  { id: 'RP-001', appointmentId: 'APT-SEED-1', patientName: '张三', phone: '13800138001', channel: 'SMS', scheduledAt: '2026-08-04T12:00:00.000Z', status: 'PENDING', template: '【G005医院】{{patient}}您好，您预约的{{exam}}将于{{time}}进行，请提前准备。', message: '', sentAt: null },
  { id: 'RP-002', appointmentId: 'APT-SEED-2', patientName: '李四', phone: '13800138002', channel: 'WECHAT', scheduledAt: '2026-08-05T00:00:00.000Z', status: 'PENDING', template: '{{patient}}您好，预约提醒：{{exam}} · {{time}}。请点击确认。', message: '', sentAt: null },
]
let reminderSeq = 2

let noShowRecords: Array<Record<string, any>> = [
  { id: 'NS-001', appointmentId: 'APT-SEED-9', patientName: '钱九', modality: 'DR', scheduledAt: '2026-08-04T01:00:00.000Z', thresholdMin: 30, markedAt: '2026-08-04T02:00:00.000Z', status: 'NO_SHOW' },
]
let noShowSeq = 1

const greenChannelReservations: Array<Record<string, any>> = []

const REMINDER_TEMPLATES: Record<string, string> = {
  SMS: '【G005医院】{{patient}}您好，您预约的{{exam}}将于{{time}}在{{room}}进行，请携带身份证提前30分钟到达并完成准备：{{prep}}。回复TD退订。',
  WECHAT: '{{patient}}您好，预约提醒：{{exam}} · {{time}} · {{room}}。准备须知：{{prep}}。请点击确认。',
  PHONE: '电话提醒脚本：您好，请问是{{patient}}吗？提醒您{{time}}在{{room}}进行{{exam}}，请提前准备：{{prep}}。',
}

const generateAccession = (modality: string, year: number): string => {
  const mod = (modality || 'CT').toUpperCase().slice(0, 4)
  const key = `${mod}-${year}`
  const n = (accessionCounters[key] ?? 0) + 1
  accessionCounters[key] = n
  const body = `${mod}${year}${String(n).padStart(5, '0')}`
  let sum = 0
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]!
    sum += (/[0-9]/.test(c) ? Number(c) : c.charCodeAt(0) % 10) * ((i % 2) + 1)
  }
  return `${body}${sum % 10}`
}
const accessionCounters: Record<string, number> = {}
const CURRENT_YEAR = 2026

// 简易冲突检测 (与后端 ConflictEngine 语义一致)
const detectConflicts = (candidate: Record<string, any>, existing: Array<Record<string, any>>) => {
  const conflicts: Array<Record<string, any>> = []
  const start = new Date(candidate.startAt).getTime()
  const end = new Date(candidate.endAt).getTime()
  const active = ['SCHEDULED', 'CONFIRMED', 'REGISTERED', 'CHECKED_IN', 'IN_PROGRESS']
  const overlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && aEnd > bStart
  const room = rooms.find((r) => r.id === candidate.roomId)
  for (const o of existing) {
    if (!active.includes(o.state)) continue
    const oStart = new Date(o.startAt).getTime()
    const oEnd = o.endAt ? new Date(o.endAt).getTime() : oStart + 30 * 60 * 1000
    if (!overlap(start, end, oStart, oEnd)) continue
    if (candidate.deviceId && o.deviceId === candidate.deviceId) conflicts.push({ type: 'DEVICE', severity: 'ERROR', resource: candidate.deviceId, message: `设备时段冲突: 与预约 ${o.id} 重叠`, conflictingId: o.id })
    if (candidate.roomId && o.roomId === candidate.roomId) conflicts.push({ type: 'ROOM', severity: 'ERROR', resource: candidate.roomId, message: `机房时段冲突: 与预约 ${o.id} 重叠`, conflictingId: o.id })
    if (candidate.technicianId && o.technicianId === candidate.technicianId) conflicts.push({ type: 'TECHNICIAN', severity: 'ERROR', resource: candidate.technicianId, message: `技师时段冲突: 与预约 ${o.id} 重叠`, conflictingId: o.id })
    if (candidate.patientId && o.patientId === candidate.patientId) conflicts.push({ type: 'PATIENT', severity: 'ERROR', resource: candidate.patientId, message: `患者时段冲突: 与预约 ${o.id} 重叠`, conflictingId: o.id })
  }
  // 设备维护
  const dev = candidate.deviceId && String(candidate.deviceId).includes('MR-02')
  if (dev) conflicts.push({ type: 'MAINTENANCE', severity: 'ERROR', resource: candidate.deviceId, message: '设备处于维护状态, 不可预约' })
  // 机房状态
  if (room && room.status !== 'ACTIVE') conflicts.push({ type: 'ROOM', severity: 'ERROR', resource: room.id, message: `机房 ${room.name} 当前状态为 ${room.status}, 不可预约` })
  // 工作时间
  const hour = new Date(candidate.startAt).getHours()
  if (hour < 7 || hour >= 20) conflicts.push({ type: 'WORKING_HOURS', severity: 'WARN', resource: candidate.deviceId ?? 'schedule', message: '超出工作时间 (07:00-20:00)' })
  return conflicts
}

export const w5ApptHandlers = [
  // ===== 机房 CRUD =====
  http.get(`${API_BASE}/appointments/rooms`, async () => {
    await delay(60)
    return ok(rooms.map((r) => ({ ...r })))
  }),
  http.post(`${API_BASE}/appointments/rooms`, async ({ request }) => {
    const body = (await request.json()) as Partial<Room>
    const id = body.id ?? `ROOM-${String(++roomSeq).padStart(3, '0')}`
    const room: Room = {
      id,
      name: body.name ?? '未命名机房',
      modality: body.modality ?? 'CT',
      location: body.location ?? '',
      maxPerSlot: body.maxPerSlot ?? 4,
      openTime: body.openTime ?? '08:00',
      closeTime: body.closeTime ?? '18:00',
      status: body.status ?? 'ACTIVE',
    }
    rooms = [...rooms, room]
    return ok(room, 201)
  }),
  http.patch(`${API_BASE}/appointments/rooms/:id`, async ({ params, request }) => {
    const body = (await request.json()) as Partial<Room>
    rooms = rooms.map((r) => (r.id === params.id ? { ...r, ...body, id: r.id } : r))
    return ok(rooms.find((r) => r.id === params.id))
  }),
  http.delete(`${API_BASE}/appointments/rooms/:id`, async ({ params }) => {
    rooms = rooms.filter((r) => r.id !== params.id)
    return ok({ ok: true, id: params.id })
  }),

  // ===== 技师 =====
  http.get(`${API_BASE}/appointments/technicians`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const modality = url.searchParams.get('modality')
    const data = modality ? seedTechnicians.filter((t) => t.modality === modality) : seedTechnicians
    return ok(data.map((t) => ({ ...t })))
  }),

  // ===== 时段容量 =====
  http.get(`${API_BASE}/appointments/slots/capacity`, async () => {
    await delay(50)
    const max = 4
    const slots: Array<Record<string, unknown>> = []
    for (let m = 7 * 60; m < 21 * 60; m += 30) {
      slots.push({ slot: `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, count: 0, max, full: false })
    }
    return ok(slots)
  }),

  // ===== 冲突预检 (无既有预约源时返回空, 便于 demo) =====
  http.post(`${API_BASE}/appointments/check-conflicts`, async ({ request }) => {
    const body = (await request.json()) as Record<string, any>
    const conflicts = detectConflicts(body, [])
    return ok({ conflicts, blocked: conflicts.some((c) => c.severity === 'ERROR') })
  }),

  // ===== 等候队列 =====
  http.get(`${API_BASE}/appointments/waitlist/next`, async () => {
    const weight: Record<string, number> = { critical: 0, urgent: 1, normal: 2 }
    const waiting = waitlist.filter((w) => w.status === 'WAITING')
    waiting.sort((a, b) => (weight[a.priority] ?? 9) - (weight[b.priority] ?? 9) || a.seq - b.seq)
    return ok(waiting[0] ?? null)
  }),
  http.post(`${API_BASE}/appointments/waitlist`, async ({ request }) => {
    const body = (await request.json()) as Record<string, any>
    const seq = ++waitlistSeq
    const entry = {
      id: `WL-${String(seq).padStart(3, '0')}`,
      patientName: body.patientName ?? '',
      patientId: body.patientId ?? '',
      phone: body.phone ?? '',
      modality: body.modality ?? 'CT',
      bodyPart: body.bodyPart ?? '',
      examItemName: body.examItemName ?? `${body.modality ?? 'CT'} ${body.bodyPart ?? ''}`.trim(),
      priority: body.priority ?? 'normal',
      preferredDate: body.preferredDate ?? '',
      preferredTime: body.preferredTime ?? '',
      seq,
      notified: false,
      status: 'WAITING',
      addedAt: new Date().toISOString().slice(0, 16).replace('T', ' '),
    }
    waitlist = [...waitlist, entry]
    return ok(entry, 201)
  }),
  http.post(`${API_BASE}/appointments/waitlist/:id/assign`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, any>
    waitlist = waitlist.map((w) => (w.id === params.id ? { ...w, status: 'ASSIGNED', appointmentId: body?.appointmentId ?? null, deviceId: body?.deviceId ?? null } : w))
    return ok(waitlist.find((w) => w.id === params.id))
  }),

  // ===== 提醒计划 =====
  http.get(`${API_BASE}/appointments/reminder-templates`, async () =>
    ok(Object.entries(REMINDER_TEMPLATES).map(([channel, template]) => ({ channel, template }))),
  ),
  http.get(`${API_BASE}/appointments/reminder-plans`, async () => {
    await delay(50)
    return ok(reminderPlans.map((p) => ({ ...p })))
  }),
  http.post(`${API_BASE}/appointments/reminder-plans`, async ({ request }) => {
    const body = (await request.json()) as Record<string, any>
    const plan = {
      id: `RP-${String(++reminderSeq).padStart(3, '0')}`,
      appointmentId: body.appointmentId ?? null,
      patientName: body.patientName ?? '',
      phone: body.phone ?? '',
      channel: body.channel ?? 'SMS',
      scheduledAt: new Date(body.scheduledAt ?? Date.now()).toISOString(),
      status: 'PENDING',
      template: body.template ?? REMINDER_TEMPLATES[body.channel] ?? REMINDER_TEMPLATES.SMS,
      message: '',
      sentAt: null,
    }
    reminderPlans = [plan, ...reminderPlans]
    return ok(plan, 201)
  }),
  http.post(`${API_BASE}/appointments/reminder-plans/fire-due`, async () => {
    const now = Date.now()
    const due = reminderPlans.filter((p) => p.status === 'PENDING' && new Date(p.scheduledAt).getTime() <= now)
    const fired = due.map((p) => ({ ...p, status: 'SENT', message: p.template, sentAt: new Date().toISOString() }))
    reminderPlans = reminderPlans.map((p) => fired.find((f: Record<string, any>) => f.id === p.id) ?? p)
    return ok(fired)
  }),
  http.post(`${API_BASE}/appointments/reminder-plans/:id/fire`, async ({ params }) => {
    let fired: Record<string, any> | undefined
    reminderPlans = reminderPlans.map((p) => {
      if (p.id !== params.id) return p
      fired = { ...p, status: 'SENT', message: p.template, sentAt: new Date().toISOString() }
      return fired
    })
    return ok(fired)
  }),

  // ===== 失约管理 =====
  http.get(`${API_BASE}/appointments/no-show`, async () => {
    await delay(50)
    return ok(noShowRecords.map((r) => ({ ...r })))
  }),
  http.post(`${API_BASE}/appointments/no-show/scan`, async ({ request }) => {
    const url = new URL(request.url)
    const thresholdMin = Number(url.searchParams.get('thresholdMin') ?? 30)
    return ok({ scanned: 0, marked: [], thresholdMin })
  }),
  http.post(`${API_BASE}/appointments/no-show/:id/restore`, async ({ params }) => {
    noShowRecords = noShowRecords.filter((r) => r.appointmentId !== params.id)
    return ok({ appointmentId: params.id, status: 'RESTORED' })
  }),
  http.post(`${API_BASE}/appointments/no-show/:id`, async ({ params }) => {
    const record = {
      id: `NS-${String(++noShowSeq).padStart(3, '0')}`,
      appointmentId: params.id,
      thresholdMin: 0,
      markedAt: new Date().toISOString(),
      status: 'NO_SHOW',
    }
    noShowRecords = [record, ...noShowRecords]
    return ok(record, 201)
  }),

  // ===== 急诊绿色通道 =====
  http.get(`${API_BASE}/appointments/green-channel`, async () =>
    ok(greenChannelReservations.map((r) => ({ ...r }))),
  ),
  http.post(`${API_BASE}/appointments/green-channel`, async ({ request }) => {
    const body = (await request.json()) as Record<string, any>
    const base = body.startAt ? new Date(body.startAt) : new Date()
    const reservation = {
      id: `GC-${Date.now()}`,
      patientName: body.patientName ?? '',
      patientId: body.patientId ?? '',
      modality: body.modality ?? 'CT',
      bodyPart: body.bodyPart ?? '',
      deviceId: body.deviceId ?? '',
      deviceName: body.deviceName ?? '',
      roomId: body.roomId ?? null,
      technicianId: body.technicianId ?? null,
      reservedStartAt: base.toISOString(),
      reservedEndAt: new Date(base.getTime() + 30 * 60 * 1000).toISOString(),
      priority: 'STAT',
      greenChannel: true,
    }
    greenChannelReservations.push(reservation)
    return ok(reservation, 201)
  }),

  // ===== 编号策略 =====
  http.get(`${API_BASE}/appointments/accession/next`, async ({ request }) => {
    const url = new URL(request.url)
    const modality = url.searchParams.get('modality') ?? 'CT'
    const year = Number(url.searchParams.get('year') ?? CURRENT_YEAR)
    return ok({ accessionNumber: generateAccession(modality, year) })
  }),

  // ===== 预约审计 =====
  http.get(`${API_BASE}/appointments/audit`, async ({ request }) => {
    const url = new URL(request.url)
    const appointmentId = url.searchParams.get('appointmentId')
    const all = [
      { id: 'AA-0001', appointmentId: 'APT-SEED-1', action: 'CREATE', actorId: 'system', at: '2026-08-01T09:00:00.000Z' },
      { id: 'AA-0002', appointmentId: 'APT-SEED-1', action: 'STATE_CHANGE', actorId: 'system', at: '2026-08-01T09:05:00.000Z' },
    ]
    return ok(appointmentId ? all.filter((a) => a.appointmentId === appointmentId) : all)
  }),
]
