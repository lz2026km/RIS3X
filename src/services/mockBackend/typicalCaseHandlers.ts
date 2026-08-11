// [W3-B] 典型病例库 MSW handlers: /api/v1/typical-cases, /api/v1/typical-cases/stats
// [G005 Wave1B P1] 标注更新: 后端已实现 /typical-cases controller (typical-cases.module),
// 本 handler 仅作为 mock 模式兜底 (dev 无后端时演示数据)。
// [v3.0.6.11-88] 补齐 categories/get/create/update/delete 兜底 (与后端端点对齐)
import { http, HttpResponse, delay } from 'msw'
import { TYPICAL_CASES_SEED } from './typicalCasesSeed'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const API = `${API_BASE}/typical-cases`

function envelope(data: unknown) {
  return { source: 'demo' as const, generatedAt: new Date().toISOString(), data }
}

// 进程内 CRUD 存储 (dev mock 兜底, 与后端内存 CRUD 语义一致)
let caseStore: any[] = []

export const typicalCaseHandlers = [
  http.get(API, async () => {
    await delay(120)
    return HttpResponse.json({ success: true, data: envelope([...caseStore, ...TYPICAL_CASES_SEED]) })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(80)
    const all = [...caseStore, ...TYPICAL_CASES_SEED]
    const stats = {
      total: all.length,
      teaching: all.filter((c) => c.teaching).length,
      pending: all.filter((c) => c.status === '待审核').length,
      views: all.reduce((s, c) => s + c.viewCount, 0),
      likes: all.reduce((s, c) => s + c.likeCount, 0),
    }
    return HttpResponse.json({ success: true, data: envelope(stats) })
  }),

  // [v3.0.6.11-88] 分类 (与后端 categories(): 按 examName||examType 聚合)
  http.get(`${API}/categories`, async () => {
    await delay(60)
    const all = [...caseStore, ...TYPICAL_CASES_SEED]
    const byExam = new Map<string, number>()
    for (const c of all) byExam.set(c.examName || c.examType, (byExam.get(c.examName || c.examType) ?? 0) + 1)
    return HttpResponse.json({ success: true, data: envelope(Array.from(byExam.entries()).map(([name, count]) => ({ name, count }))) })
  }),

  http.get(`${API}/:id`, async ({ params }) => {
    await delay(60)
    const found = [...caseStore, ...TYPICAL_CASES_SEED].find((c) => c.id === params.id)
    return found
      ? HttpResponse.json({ success: true, data: envelope(found) })
      : HttpResponse.json({ success: false, error: { message: `Typical case ${params.id} not found` } }, { status: 404 })
  }),

  http.post(API, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as any
    const record = {
      id: `TC-${Date.now().toString(36)}`,
      patientName: body.patientName ?? '新病例',
      age: body.age ?? 0,
      gender: body.gender ?? '男',
      examType: body.examType ?? 'CT',
      examName: body.examName ?? '',
      bodyPart: body.bodyPart ?? '头颅',
      disease: body.disease ?? '',
      diagnosis: body.diagnosis ?? '',
      findings: body.findings ?? '',
      impression: body.impression ?? '',
      findingsList: body.findingsList ?? [],
      tags: body.tags ?? [],
      teaching: body.teaching ?? false,
      images: body.images ?? [],
      annotations: body.annotations ?? [],
      discussions: body.discussions ?? [],
      likeCount: body.likeCount ?? 0,
      viewCount: body.viewCount ?? 0,
      createdAt: body.createdAt ?? new Date().toISOString().slice(0, 10),
      createdBy: body.createdBy ?? '当前用户',
      status: body.status ?? '待审核',
      verified: body.verified ?? false,
    }
    caseStore.unshift(record)
    return HttpResponse.json({ success: true, data: envelope(record) }, { status: 201 })
  }),

  http.patch(`${API}/:id`, async ({ params, request }) => {
    await delay(80)
    const body = (await request.json()) as any
    const found = caseStore.find((c) => c.id === params.id)
    if (!found) {
      const seed = TYPICAL_CASES_SEED.find((c) => c.id === params.id)
      if (!seed) return HttpResponse.json({ success: false, error: { message: `Typical case ${params.id} not found` } }, { status: 404 })
      caseStore.unshift({ ...seed, ...body, id: seed.id })
      return HttpResponse.json({ success: true, data: envelope(caseStore[0]) })
    }
    Object.assign(found, body)
    return HttpResponse.json({ success: true, data: envelope(found) })
  }),

  http.delete(`${API}/:id`, async ({ params }) => {
    await delay(60)
    const idx = caseStore.findIndex((c) => c.id === params.id)
    if (idx !== -1) caseStore.splice(idx, 1)
    return HttpResponse.json({ success: true, data: envelope({ deleted: String(params.id) }) })
  }),
]
