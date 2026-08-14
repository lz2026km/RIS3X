// [v3.0.6.11-99 Wave3B] /api/v1/followup-templates MSW handlers — 随访模板库
// (列表/创建/更新/删除 + apply 应用到患者批量生成计划)
import { http, HttpResponse, delay } from 'msw'
import { pushFollowUpPlans, type MockFollowUpPlan } from './followupHandlers'

// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1')

const API = `${API_BASE}/followup-templates`

export interface MockFollowUpTemplate {
  id: string
  name: string
  category: string
  intervals: number[]
  items: string[]
  active: boolean
  createdAt?: string
  updatedAt?: string
}

let TEMPLATES: MockFollowUpTemplate[] = [
  { id: 'tpl-onc-ct', name: '肿瘤术后复查(CT)', category: '病种', intervals: [30, 90, 180], items: ['影像学复查', '肿瘤标志物'], active: true, createdAt: '2026-07-01T08:00:00.000Z', updatedAt: '2026-07-01T08:00:00.000Z' },
  { id: 'tpl-contrast', name: '对比剂反应随访', category: '检查类型', intervals: [7, 30], items: ['对比剂反应评估'], active: true, createdAt: '2026-07-02T08:00:00.000Z', updatedAt: '2026-07-02T08:00:00.000Z' },
  { id: 'tpl-nodule', name: '肺结节随访', category: '病种', intervals: [90, 180, 360], items: ['薄层CT复查', '结节大小对比'], active: true, createdAt: '2026-07-03T08:00:00.000Z', updatedAt: '2026-07-03T08:00:00.000Z' },
  { id: 'tpl-liver-tace', name: '肝癌TACE术后', category: '术式', intervals: [30, 60, 90, 180], items: ['肝脏增强MRI', 'AFP'], active: false, createdAt: '2026-07-04T08:00:00.000Z', updatedAt: '2026-07-04T08:00:00.000Z' },
]

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min)

const notFound = (id: string) =>
  HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `FollowUpTemplate ${id} not found` } }, { status: 404 })

const normalize = (t: MockFollowUpTemplate): MockFollowUpTemplate => ({
  ...t,
  intervals: (t.intervals ?? []).slice().sort((a, b) => a - b),
  items: t.items ?? [],
})

export const followupTemplateHandlers = [
  http.get(`${API}`, async () => {
    await delay(delayMs())
    const items = TEMPLATES.map(normalize)
    return HttpResponse.json({ success: true, data: { items, total: items.length } })
  }),

  http.post(`${API}`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Partial<MockFollowUpTemplate>
    if (!body.name?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '模板名称必填' } }, { status: 400 })
    }
    const intervals = (body.intervals ?? []).filter((n) => Number.isFinite(n) && n > 0)
    if (intervals.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '模板至少需要一个间隔天数' } }, { status: 400 })
    }
    const tpl: MockFollowUpTemplate = {
      id: `tpl-${Date.now()}`,
      name: body.name.trim(),
      category: body.category ?? '',
      intervals,
      items: body.items ?? [],
      active: body.active ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    TEMPLATES = [tpl, ...TEMPLATES]
    return HttpResponse.json({ success: true, data: normalize(tpl) }, { status: 201 })
  }),

  http.patch(`${API}/:id`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = TEMPLATES.findIndex((t) => t.id === params.id)
    if (idx < 0) return notFound(String(params.id))
    const body = (await request.json()) as Partial<MockFollowUpTemplate>
    const merged: MockFollowUpTemplate = {
      ...TEMPLATES[idx]!,
      ...body,
      id: TEMPLATES[idx]!.id,
      updatedAt: new Date().toISOString(),
    }
    if (body.intervals) merged.intervals = body.intervals.filter((n) => Number.isFinite(n) && n > 0)
    TEMPLATES[idx] = merged
    return HttpResponse.json({ success: true, data: normalize(merged) })
  }),

  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(delayMs())
    const existed = TEMPLATES.some((t) => t.id === params.id)
    TEMPLATES = TEMPLATES.filter((t) => t.id !== params.id)
    return new HttpResponse(null, { status: existed ? 204 : 404 })
  }),

  // [v3.0.6.11-99 Wave3B] apply: 按模板间隔批量生成随访计划
  http.post(`${API}/:id/apply`, async ({ params, request }) => {
    await delay(delayMs())
    const tpl = TEMPLATES.find((t) => t.id === params.id)
    if (!tpl) return notFound(String(params.id))
    const body = (await request.json()) as { patientId?: string; patientName?: string; planDate?: string; reportId?: string; examId?: string; note?: string }
    if (!body.patientId || !body.patientName || !body.planDate) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '患者ID/姓名/随访日期必填' } }, { status: 400 })
    }
    const base = new Date(body.planDate)
    const created = tpl.intervals.map((days, i) => {
      const next = new Date(base.getTime() + days * 86400000)
      return {
        id: `FU-${tpl.id}-${Date.now()}-${i}`,
        patientId: body.patientId!,
        patientName: body.patientName!,
        reportId: body.reportId || undefined,
        examId: body.examId || undefined,
        templateId: tpl.id,
        planDate: base.toISOString(),
        intervalDays: days,
        nextDate: next.toISOString(),
        status: 'PENDING',
        note: body.note ?? `模板「${tpl.name}」第${i + 1}期 · ${tpl.items.join('/')}`,
        reminderEnabled: true,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    })
    // 同步写入 followupHandlers 内存列表 (follow-up 页刷新即可见)
    pushFollowUpPlans(created as unknown as MockFollowUpPlan[])
    return HttpResponse.json({ success: true, data: { items: created, total: created.length, templateId: tpl.id } }, { status: 201 })
  }),
]
