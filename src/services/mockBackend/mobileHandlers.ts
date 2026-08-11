/**
 * G005 RIS v3.0.6.11-75 - mobile 模块 MSW handlers
 * 与后端 /mobile (backend/src/mobile/mobile.controller.ts) 对齐:
 *   GET  /mobile/jscode2session /mobile/today-summary /mobile/worklist
 *   GET  /mobile/critical-values
 *   POST /mobile/critical-values/:id/ack
 *   GET  /mobile/reports/latest
 *   POST /mobile/device-token
 * 数据与 backend mobile.service seed 保持一致, 使 dev(mock) 与 real 行为一致。
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1');

interface MockCritical {
  id: string
  patientName: string
  gender: string | null
  age: number | null
  description: string
  severity: string
  state: string
  method: string | null
  notifiedTo: string | null
  accessionNumber: string | null
  modality: string | null
  createdAt: string
  ackedAt: string | null
  ackedBy?: string | null
}

const SEED_WORKLIST = [
  { id: 'W1', accessionNumber: 'ACC001', patientId: 'P001', patientName: '张志刚', gender: 'MALE', age: 62, modality: 'CT', bodyPart: '胸部', status: 'pending', state: 'SCHEDULED', urgency: 'critical', scheduledAt: new Date(Date.now() + 3600_000).toISOString() },
  { id: 'W2', accessionNumber: 'ACC002', patientId: 'P002', patientName: '李秀英', gender: 'FEMALE', age: 55, modality: 'MR', bodyPart: '头颅', status: 'pending', state: 'SCHEDULED', urgency: 'routine', scheduledAt: new Date(Date.now() + 1800_000).toISOString() },
  { id: 'W3', accessionNumber: 'ACC003', patientId: 'P003', patientName: '王建军', gender: 'MALE', age: 45, modality: 'CT', bodyPart: '腹部', status: 'reading', state: 'IN_PROGRESS', urgency: 'critical', scheduledAt: new Date().toISOString() },
  { id: 'W4', accessionNumber: 'ACC004', patientId: 'P004', patientName: '赵敏', gender: 'FEMALE', age: 34, modality: 'DR', bodyPart: '胸部', status: 'pending', state: 'SCHEDULED', urgency: 'routine', scheduledAt: new Date(Date.now() + 5400_000).toISOString() },
  { id: 'W5', accessionNumber: 'ACC005', patientId: 'P005', patientName: '陈国强', gender: 'MALE', age: 71, modality: 'CT', bodyPart: '心脏', status: 'reading', state: 'IN_PROGRESS', urgency: 'routine', scheduledAt: new Date().toISOString() },
  { id: 'W6', accessionNumber: 'ACC006', patientId: 'P006', patientName: '刘芳', gender: 'FEMALE', age: 28, modality: 'MR', bodyPart: '腰椎', status: 'reported', state: 'COMPLETED', urgency: 'routine', scheduledAt: new Date(Date.now() - 86_400_000).toISOString() },
]

const SEED_CRITICALS: MockCritical[] = [
  { id: 'CV1', patientName: '王建军', gender: 'MALE', age: 45, description: '腹部CT示肝右叶占位，考虑恶性可能', severity: 'CRITICAL', state: 'FOUND', method: 'SYSTEM', notifiedTo: '急诊科 张医生', accessionNumber: 'ACC003', modality: 'CT', createdAt: new Date().toISOString(), ackedAt: null },
  { id: 'CV2', patientName: '陈国强', gender: 'MALE', age: 71, description: '冠脉CTA示左前降支重度狭窄', severity: 'URGENT', state: 'NOTIFIED', method: 'PHONE', notifiedTo: '心内科 李主任', accessionNumber: 'ACC005', modality: 'CT', createdAt: new Date(Date.now() - 3600_000).toISOString(), ackedAt: null },
  { id: 'CV3', patientName: '张志刚', gender: 'MALE', age: 62, description: '胸部CT示主动脉夹层可疑', severity: 'URGENT', state: 'VOICE_CALLED', method: 'PHONE', notifiedTo: '急诊科', accessionNumber: 'ACC001', modality: 'CT', createdAt: new Date(Date.now() - 7200_000).toISOString(), ackedAt: null },
]

const SEED_REPORTS = [
  { id: 'R1', patientName: '刘芳', gender: 'FEMALE', modality: 'MR', bodyPart: '腰椎', accessionNumber: 'ACC006', state: 'SIGNED', isCritical: false, impression: '腰椎轻度退行性变', conclusion: '未见明显异常', findings: 'L4/5、L5/S1 椎间盘轻度膨出。', radiologistName: '周医生', signedAt: new Date().toISOString(), createdAt: new Date().toISOString() },
  { id: 'R2', patientName: '王建军', gender: 'MALE', modality: 'CT', bodyPart: '腹部', accessionNumber: 'ACC003', state: 'SUBMITTED', isCritical: true, impression: '肝右叶占位待查', conclusion: '建议增强MRI进一步检查', findings: '肝右叶见类圆形低密度灶，边界欠清。', radiologistName: null, signedAt: null, createdAt: new Date().toISOString() },
  { id: 'R3', patientName: '赵敏', gender: 'FEMALE', modality: 'DR', bodyPart: '胸部', accessionNumber: 'ACC004', state: 'SIGNED', isCritical: false, impression: '两肺未见明显活动性病变', conclusion: '正常胸片', findings: '', radiologistName: '吴医生', signedAt: new Date(Date.now() - 7200_000).toISOString(), createdAt: new Date(Date.now() - 7200_000).toISOString() },
]

let criticals: MockCritical[] = [...SEED_CRITICALS];

export const mobileHandlers = [
  http.get(`${API_BASE}/mobile/jscode2session`, async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const code = url.searchParams.get('code') ?? ''
    if (!code) return HttpResponse.json({ errcode: 40029, errmsg: 'invalid code' })
    return HttpResponse.json({ errcode: 0, openid: `mock-openid-${code}`, session_key: 'mock-session-key', unionid: 'mock-unionid' })
  }),

  http.get(`${API_BASE}/mobile/today-summary`, async () => {
    await delay(120)
    return HttpResponse.json({
      examsToday: 42,
      pendingExams: 12,
      inProgressExams: 5,
      criticalValues: criticals.length,
      reportsToday: 28,
      signedReportsToday: 21,
      date: new Date().toISOString().slice(0, 10),
    })
  }),

  http.get(`${API_BASE}/mobile/worklist`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')?.trim().toLowerCase()
    const all = status ? SEED_WORKLIST.filter((i) => i.status === status) : SEED_WORKLIST
    return HttpResponse.json(all)
  }),

  http.get(`${API_BASE}/mobile/critical-values`, async () => {
    await delay(120)
    return HttpResponse.json(criticals)
  }),

  http.post(`${API_BASE}/mobile/critical-values/:id/ack`, async ({ params, request }) => {
    await delay(120)
    const id = params.id as string
    const body = (await request.json().catch(() => ({}))) as { ackedBy?: string }
    const item = criticals.find((c) => c.id === id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `CriticalValue ${id} not found` } }, { status: 404 })
    const updated: MockCritical = { ...item, state: 'ACKNOWLEDGED', ackedAt: new Date().toISOString(), ackedBy: body.ackedBy ?? 'mobile-user' }
    criticals = criticals.map((c) => (c.id === id ? updated : c))
    return HttpResponse.json({ id, state: 'ACKNOWLEDGED', ackedAt: updated.ackedAt, ackedBy: updated.ackedBy })
  }),

  http.get(`${API_BASE}/mobile/reports/latest`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const limitRaw = Number(url.searchParams.get('limit') ?? 10)
    const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? Math.trunc(limitRaw) || 10 : 10, 1), 50)
    return HttpResponse.json(SEED_REPORTS.slice(0, limit))
  }),

  http.post(`${API_BASE}/mobile/device-token`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as { token?: string; platform?: string }
    if (!body.token || typeof body.token !== 'string' || body.token.trim() === '') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'token is required' } }, { status: 400 })
    }
    return HttpResponse.json({ success: true, token: body.token.trim(), platform: body.platform ?? 'android', total: 1 })
  }),

  // [W2-B-3] 推送通知列表 (MobilePushPage raw fetch, 返回 { success, data: [...] })
  http.get(`${API_BASE}/mobile/push-notifications`, async () => {
    await delay(120)
    const items = [
      { id: 'PN-001', title: '危急值提醒: 主动脉夹层可疑', body: 'CT-001 患者张志刚 胸部CT提示主动脉夹层可疑, 请立即处理', tag: 'cv-001', topic: 'critical', severity: 'critical', read: false, receivedAt: new Date(Date.now() - 30 * 60000).toISOString().replace('T', ' ').substring(0, 16) },
      { id: 'PN-002', title: '报告已完成: 腰椎MRI', body: '患者刘芳 报告已签发, 请查看', tag: 'rp-001', topic: 'report', severity: 'info', read: false, receivedAt: new Date(Date.now() - 90 * 60000).toISOString().replace('T', ' ').substring(0, 16) },
      { id: 'PN-003', title: '检查预约提醒', body: '患者赵敏 明日 09:30 胸部DR检查', tag: 'ap-001', topic: 'appointment', severity: 'info', read: true, receivedAt: new Date(Date.now() - 3600_000).toISOString().replace('T', ' ').substring(0, 16) },
      { id: 'PN-004', title: '系统维护通知', body: '本周六 02:00-04:00 系统升级维护', tag: 'sy-001', topic: 'system', severity: 'warning', read: true, receivedAt: new Date(Date.now() - 7200_000).toISOString().replace('T', ' ').substring(0, 16) },
    ]
    return HttpResponse.json({ success: true, data: items, meta: { total: items.length } })
  }),
]
