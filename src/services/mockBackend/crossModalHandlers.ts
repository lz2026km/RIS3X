/**
 * G005 v3.0.6.11-75 W3-1 - 跨模态检索 MSW handlers
 * 支持 crossModalSearchApi (GET /dicom/cross-modal-search) 与 crossModalApi (POST /cross-modal/search)
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = '/api/v1'

const delayMs = (min = 50, max = 150) => Math.floor(Math.random() * (max - min) + min)

interface SearchHit {
  id: string
  score: number
  modality: string
  studyUid: string
  patientName: string
  patientId: string
  studyDescription: string
  studyDate: string
  thumbnail?: string
  matchedField: string
}

const SEED_STUDIES: Array<Omit<SearchHit, 'score' | 'matchedField'>> = [
  { id: 'cm-001', modality: 'CT', studyUid: '1.2.826.0.1.3680043.8.498.202607100001', patientName: '张三', patientId: 'P000001', studyDescription: '胸部CT平扫 肺结节随访', studyDate: '2026-07-10' },
  { id: 'cm-002', modality: 'MR', studyUid: '1.2.826.0.1.3680043.8.498.202607100002', patientName: '李四', patientId: 'P000002', studyDescription: '头颅MRI 脑白质病变', studyDate: '2026-07-11' },
  { id: 'cm-003', modality: 'DX', studyUid: '1.2.826.0.1.3680043.8.498.202607120003', patientName: '王五', patientId: 'P000003', studyDescription: '胸部正位 肺炎复查', studyDate: '2026-07-12' },
  { id: 'cm-004', modality: 'CT', studyUid: '1.2.826.0.1.3680043.8.498.202607130004', patientName: '赵六', patientId: 'P000004', studyDescription: '腹部CT增强 肝占位', studyDate: '2026-07-13' },
  { id: 'cm-005', modality: 'US', studyUid: '1.2.826.0.1.3680043.8.498.202607140005', patientName: '钱七', patientId: 'P000005', studyDescription: '甲状腺超声 结节TI-RADS 3', studyDate: '2026-07-14' },
  { id: 'cm-006', modality: 'MR', studyUid: '1.2.826.0.1.3680043.8.498.202607150006', patientName: '张三', patientId: 'P000001', studyDescription: '颈椎MRI 椎间盘突出', studyDate: '2026-07-15' },
  { id: 'cm-007', modality: 'MG', studyUid: '1.2.826.0.1.3680043.8.498.202607160007', patientName: '孙八', patientId: 'P000006', studyDescription: '乳腺钼靶 双乳BI-RADS 2', studyDate: '2026-07-16' },
  { id: 'cm-008', modality: 'CT', studyUid: '1.2.826.0.1.3680043.8.498.202607170008', patientName: '周九', patientId: 'P000007', studyDescription: '冠状动脉CTA 冠脉钙化', studyDate: '2026-07-17' },
]

function seedScore(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return 0.62 + ((h >>> 0) % 3500) / 10000
}

function search(q: string, modality?: string | null): SearchHit[] {
  const query = (q ?? '').trim().toLowerCase()
  return SEED_STUDIES
    .filter((s) => (!query || `${s.patientName}${s.patientId}${s.studyDescription}${s.modality}`.toLowerCase().includes(query)))
    .filter((s) => !modality || s.modality === modality)
    .map((s) => ({
      ...s,
      score: seedScore(`${s.id}:${query || 'all'}`),
      matchedField: 'study',
    }))
}

export const crossModalHandlers = [
  // crossModalSearchApi (dicomApi.ts): GET /dicom/cross-modal-search
  http.get(`${API_BASE}/dicom/cross-modal-search`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const q = url.searchParams.get('query') ?? ''
    const modality = url.searchParams.get('modality')
    return HttpResponse.json({ success: true, data: search(q, modality) })
  }),

  http.get(`${API_BASE}/dicom/cross-modal-search/:id/similar`, async ({ params }) => {
    await delay(delayMs())
    const base: (typeof SEED_STUDIES)[number] | undefined = SEED_STUDIES.find((s) => s.id === params.id) ?? SEED_STUDIES[0]
    if (!base) return HttpResponse.json({ success: true, data: [] })
    const list = SEED_STUDIES
      .filter((s) => s.id !== base.id && s.modality === base.modality)
      .slice(0, 4)
      .map((s) => ({ ...s, score: seedScore(`sim:${s.id}`), matchedField: 'similar' }))
    return HttpResponse.json({ success: true, data: list })
  }),

  // crossModalApi (crossModalApi.ts): POST /cross-modal/search
  http.post(`${API_BASE}/cross-modal/search`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { query?: string; modalities?: string[]; dateFrom?: string; dateTo?: string; limit?: number }
    let list = search(body.query ?? '', body.modalities?.[0] ?? null)
    if (body.dateFrom) list = list.filter((s) => s.studyDate >= (body.dateFrom as string))
    if (body.dateTo) list = list.filter((s) => s.studyDate <= (body.dateTo as string))
    if (body.limit) list = list.slice(0, body.limit)
    return HttpResponse.json({ success: true, data: list })
  }),

  // crossModalApi.similar (crossModalApi.ts): POST /cross-modal/similar (对齐后端 cross-modal.controller)
  http.post(`${API_BASE}/cross-modal/similar`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { imageId?: string }
    const base = SEED_STUDIES.find((s) => s.id === body.imageId)
    const list = SEED_STUDIES
      .filter((s) => s.id !== base?.id && (!base || s.modality === base.modality))
      .slice(0, 6)
      .map((s) => ({
        id: s.id,
        patientName: s.patientName,
        patientId: s.patientId,
        modality: s.modality,
        studyDate: s.studyDate,
        description: s.studyDescription,
        similarity: seedScore(`sim:${s.id}`),
        thumbnail: s.thumbnail,
        simulated: false,
      }))
    return HttpResponse.json({ success: true, data: list })
  }),

  http.get(`${API_BASE}/cross-modal/index-status`, async () => {
    await delay(delayMs(30, 80))
    const byModality: Record<string, number> = {}
    for (const s of SEED_STUDIES) byModality[s.modality] = (byModality[s.modality] ?? 0) + 1
    return HttpResponse.json({
      success: true,
      data: { totalDocuments: SEED_STUDIES.length, lastIndexedAt: new Date().toISOString(), status: 'ready', byModality },
    })
  }),

  http.post(`${API_BASE}/cross-modal/reindex`, async ({ request }) => {
    await delay(delayMs(200, 400))
    const body = (await request.json()) as { modality?: string }
    return HttpResponse.json({ success: true, data: { status: 'reindexed', modality: body.modality ?? 'all' } })
  }),

  http.get(`${API_BASE}/cross-modal/suggestions`, async ({ request }) => {
    await delay(delayMs(30, 60))
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').toLowerCase()
    const all = ['肺结节', '脑白质', '肺炎', '肝占位', '甲状腺结节', '椎间盘突出', '乳腺钙化', '冠脉钙化']
    return HttpResponse.json({ success: true, data: q ? all.filter((s) => s.toLowerCase().includes(q)) : all })
  }),
]
