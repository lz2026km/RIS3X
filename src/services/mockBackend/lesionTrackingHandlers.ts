// [v3.0.6.11-99 Wave 4A] /api/v1/lesion-tracking MSW handlers — 病灶追踪:
// 登记/测量序列/趋势/跨期对比 (RECIST-like)/统计/随访联动 (与 backend lesion-tracking.controller 对齐)
import { http, HttpResponse, delay } from 'msw'

// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5191/api/v1')

const API = `${API_BASE}/lesion-tracking`

export type MockLesionStatus = '稳定' | '增大' | '缩小' | '消失' | '新发'
export type MockLesionType = '肺结节' | '肝占位' | '淋巴结' | '其他'
export type MockResponseClass = 'CR' | 'PR' | 'SD' | 'PD' | 'NE'

export interface MockLesionMeasurement {
  id: string
  studyId: string
  date: string
  sizeMm: number
  response?: MockResponseClass
  notes?: string
}

export interface MockTrackedLesion {
  id: string
  lesionId: string
  patientId: string
  name: string
  site: string
  type: MockLesionType
  modality: string
  createdAt: string
  currentStatus: MockLesionStatus
  followupId?: string
  measurements: MockLesionMeasurement[]
}

const ISO_DAY = (offsetDays: number): string => {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const newId = (prefix: string): string => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const m = (studyId: string, date: string, sizeMm: number, response?: MockResponseClass): MockLesionMeasurement => ({
  id: newId('m'), studyId, date, sizeMm, response,
})

let LESIONS: MockTrackedLesion[] = [
  {
    id: 'LT001', lesionId: 'LT001', patientId: 'P000001', name: '肺结节 #1', site: '右肺上叶尖段',
    type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-270), currentStatus: '稳定',
    measurements: [m('STU-001-A', ISO_DAY(-270), 6.2, 'SD'), m('STU-001-B', ISO_DAY(-90), 6.5, 'SD'), m('STU-001-C', ISO_DAY(-7), 6.3, 'SD')],
  },
  {
    id: 'LT002', lesionId: 'LT002', patientId: 'P000001', name: '肝占位 #1', site: '肝右叶 S7',
    type: '肝占位', modality: 'CT', createdAt: ISO_DAY(-240), currentStatus: '缩小',
    measurements: [m('STU-002-A', ISO_DAY(-240), 42.0, 'SD'), m('STU-002-B', ISO_DAY(-120), 35.5, 'PR'), m('STU-002-C', ISO_DAY(-10), 26.8, 'PR')],
  },
  {
    id: 'LT003', lesionId: 'LT003', patientId: 'P000001', name: '纵隔淋巴结', site: '4R 组淋巴结',
    type: '淋巴结', modality: 'CT', createdAt: ISO_DAY(-180), currentStatus: '增大',
    measurements: [m('STU-003-A', ISO_DAY(-180), 12.0, 'SD'), m('STU-003-B', ISO_DAY(-60), 15.4, 'PD'), m('STU-003-C', ISO_DAY(-5), 19.8, 'PD')],
  },
  {
    id: 'LT004', lesionId: 'LT004', patientId: 'P000002', name: '肺结节 #1', site: '左肺下叶背段',
    type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-30), currentStatus: '新发',
    measurements: [m('STU-004-A', ISO_DAY(-30), 5.1)],
  },
  {
    id: 'LT005', lesionId: 'LT005', patientId: 'P000002', name: '肝转移灶 #2', site: '肝左叶 S2',
    type: '肝占位', modality: 'MR', createdAt: ISO_DAY(-365), currentStatus: '消失',
    measurements: [m('STU-005-A', ISO_DAY(-365), 18.0, 'SD'), m('STU-005-B', ISO_DAY(-180), 0, 'CR')],
  },
  {
    id: 'LT006', lesionId: 'LT006', patientId: 'P000003', name: '肺结节 #2', site: '右肺中叶外侧段',
    type: '肺结节', modality: 'CT', createdAt: ISO_DAY(-150), currentStatus: '稳定',
    measurements: [m('STU-006-A', ISO_DAY(-150), 8.0, 'SD'), m('STU-006-B', ISO_DAY(-20), 8.2, 'SD')],
  },
]

const RESPONSE_LABEL: Record<MockResponseClass, string> = {
  CR: '完全缓解 (Complete Response)',
  PR: '部分缓解 (Partial Response)',
  SD: '疾病稳定 (Stable Disease)',
  PD: '疾病进展 (Progressive Disease)',
  NE: '不可评估 (Not Evaluable)',
}

const recistResponse = (changePercent: number): MockResponseClass => {
  if (changePercent <= -100) return 'CR'
  if (changePercent <= -30) return 'PR'
  if (changePercent >= 20) return 'PD'
  return 'SD'
}

const deriveStatus = (lesion: MockTrackedLesion): MockLesionStatus => {
  const sorted = [...lesion.measurements].sort((a, b) => a.date.localeCompare(b.date))
  if (sorted.length === 0) return '新发'
  const last = sorted[sorted.length - 1]!
  if (last.response === 'CR') return '消失'
  if (last.response === 'PR') return '缩小'
  if (last.response === 'PD') return '增大'
  if (last.response === 'SD') return '稳定'
  if (sorted.length === 1) return '新发'
  const prev = sorted[sorted.length - 2]!
  if (last.sizeMm <= 0) return '消失'
  const change = (last.sizeMm - prev.sizeMm) / prev.sizeMm
  if (change >= 0.2) return '增大'
  if (change <= -0.2) return '缩小'
  return '稳定'
}

const withStatus = (l: MockTrackedLesion): MockTrackedLesion => ({
  ...l,
  measurements: [...l.measurements].sort((a, b) => a.date.localeCompare(b.date)),
  currentStatus: deriveStatus(l),
})

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min)

const notFound = (id: string) =>
  HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `病灶 ${id} 不存在` } }, { status: 404 })

const findIdx = (id: unknown): number => LESIONS.findIndex((l) => l.id === id)

export const lesionTrackingHandlers = [
  // ⚠️ stats 必须先于 lesions/:id
  http.get(`${API}/stats`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId') ?? ''
    const items = LESIONS.filter((l) => l.patientId === patientId).map(withStatus)
    const count = (s: MockLesionStatus) => items.filter((l) => l.currentStatus === s).length
    const byTypeMap = new Map<string, number>()
    for (const l of items) byTypeMap.set(l.type, (byTypeMap.get(l.type) ?? 0) + 1)
    return HttpResponse.json({
      success: true,
      data: {
        patientId,
        total: items.length,
        new: count('新发'),
        progressed: count('增大'),
        stable: count('稳定'),
        disappeared: count('消失'),
        shrunk: count('缩小'),
        byType: Array.from(byTypeMap.entries()).map(([type, c]) => ({ type, count: c })),
      },
    })
  }),

  http.get(`${API}/lesions`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId') ?? ''
    const items = LESIONS.filter((l) => l.patientId === patientId).map(withStatus)
    return HttpResponse.json({ success: true, data: { source: 'demo', items } })
  }),

  http.post(`${API}/lesions`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as Partial<MockTrackedLesion> & { initialSizeMm?: number; studyId?: string }
    const id = newId('LT')
    const now = ISO_DAY(0)
    const lesion: MockTrackedLesion = {
      id,
      lesionId: id,
      patientId: body.patientId ?? '',
      name: body.name ?? '未命名病灶',
      site: body.site ?? '',
      type: body.type ?? '其他',
      modality: body.modality ?? 'CT',
      createdAt: now,
      currentStatus: '新发',
      measurements: [
        { id: newId('m'), studyId: body.studyId ?? '', date: now, sizeMm: Math.max(0, body.initialSizeMm ?? 0) },
      ],
    }
    LESIONS = [lesion, ...LESIONS]
    return HttpResponse.json({ success: true, data: withStatus(lesion) }, { status: 201 })
  }),

  http.get(`${API}/lesions/:id`, async ({ params }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    return HttpResponse.json({ success: true, data: withStatus(LESIONS[idx]!) })
  }),

  http.patch(`${API}/lesions/:id`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const body = (await request.json()) as Partial<MockTrackedLesion>
    LESIONS[idx] = withStatus({ ...LESIONS[idx]!, ...body, id: LESIONS[idx]!.id })
    return HttpResponse.json({ success: true, data: LESIONS[idx] })
  }),

  http.delete(`${API}/lesions/:id`, async ({ params }) => {
    await delay(delayMs())
    const existed = LESIONS.some((l) => l.id === params.id)
    LESIONS = LESIONS.filter((l) => l.id !== params.id)
    return new HttpResponse(null, { status: existed ? 204 : 404 })
  }),

  http.post(`${API}/lesions/:id/measurements`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const body = (await request.json()) as Partial<MockLesionMeasurement>
    const measurement: MockLesionMeasurement = {
      id: newId('m'),
      studyId: body.studyId ?? '',
      date: body.date ?? ISO_DAY(0),
      sizeMm: Math.max(0, body.sizeMm ?? 0),
      response: body.response ?? undefined,
      notes: body.notes ?? undefined,
    }
    LESIONS[idx] = { ...LESIONS[idx]!, measurements: [...LESIONS[idx]!.measurements, measurement] }
    return HttpResponse.json({ success: true, data: withStatus(LESIONS[idx]!) }, { status: 201 })
  }),

  http.get(`${API}/lesions/:id/measurements`, async ({ params }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const sorted = [...LESIONS[idx]!.measurements].sort((a, b) => a.date.localeCompare(b.date))
    return HttpResponse.json({ success: true, data: sorted })
  }),

  http.get(`${API}/lesions/:id/trend`, async ({ params }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const sorted = [...LESIONS[idx]!.measurements].sort((a, b) => a.date.localeCompare(b.date))
    if (sorted.length === 0) {
      return HttpResponse.json({
        success: true,
        data: { lesionId: params.id, baselineDate: '', baselineSize: 0, latestDate: '', latestSize: 0, changePercent: 0, overallResponse: 'NE', overallResponseLabel: RESPONSE_LABEL.NE, timeline: [] },
      })
    }
    const first = sorted[0]!
    const last = sorted[sorted.length - 1]!
    const changePercent = first.sizeMm > 0 ? +(((last.sizeMm - first.sizeMm) / first.sizeMm) * 100).toFixed(1) : 0
    const overallResponse = recistResponse(changePercent)
    return HttpResponse.json({
      success: true,
      data: {
        lesionId: params.id,
        baselineDate: first.date,
        baselineSize: first.sizeMm,
        latestDate: last.date,
        latestSize: last.sizeMm,
        changePercent,
        overallResponse,
        overallResponseLabel: RESPONSE_LABEL[overallResponse],
        timeline: sorted.map((x) => ({ date: x.date, studyId: x.studyId, sizeMm: x.sizeMm, response: x.response })),
      },
    })
  }),

  http.post(`${API}/lesions/:id/compare`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const body = (await request.json()) as { studyIdA?: string; studyIdB?: string }
    const sorted = [...LESIONS[idx]!.measurements].sort((a, b) => a.date.localeCompare(b.date))
    const find = (studyId?: string) => sorted.find((x) => x.studyId === studyId) ?? sorted.find((x) => x.id === studyId)
    const a = find(body.studyIdA)
    const b = find(body.studyIdB)
    if (!a || !b) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '对比测量不存在, 请选择两次有效测量' } }, { status: 400 })
    }
    if (a.id === b.id) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '两次测量为同一记录' } }, { status: 400 })
    }
    const changeMm = +(b.sizeMm - a.sizeMm).toFixed(1)
    const changePercent = a.sizeMm > 0 ? +((changeMm / a.sizeMm) * 100).toFixed(1) : 0
    const response = recistResponse(changePercent)
    let direction: string
    if (b.sizeMm <= 0) direction = '消失'
    else if (changePercent >= 20) direction = '增大'
    else if (changePercent <= -30) direction = '缩小'
    else direction = '无变化'
    return HttpResponse.json({
      success: true,
      data: {
        lesionId: params.id,
        studyA: body.studyIdA,
        studyB: body.studyIdB,
        sizeA: a.sizeMm,
        sizeB: b.sizeMm,
        changeMm,
        changePercent,
        direction,
        response,
        responseLabel: RESPONSE_LABEL[response],
        deterministic: true,
      },
    })
  }),

  http.post(`${API}/lesions/:id/followup`, async ({ params, request }) => {
    await delay(delayMs())
    const idx = findIdx(params.id)
    if (idx < 0) return notFound(String(params.id))
    const body = (await request.json()) as { followupId?: string }
    if (!body.followupId?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'followupId 必填' } }, { status: 400 })
    }
    LESIONS[idx] = { ...LESIONS[idx]!, followupId: body.followupId.trim() }
    return HttpResponse.json({ success: true, data: withStatus(LESIONS[idx]!) })
  }),
]
