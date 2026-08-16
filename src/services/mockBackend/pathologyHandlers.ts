// [G005 Wave 2B v3.0.6.11-101] /api/v1/pathology MSW handlers
// 对齐后端 pathology.module + pathology.controller/service (cases / slides / tile PNG / 标注 CRUD)
// 页面 WsiViewerPage 有本地回退, 此为基础 handler 补齐, 结构完全与后端 seed 一致
// 响应形状: { success: true, data: <T> }; tile → image/png 二进制
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/pathology`

interface CaseSummary {
  id: string
  patientId: string
  patientName: string
  specimen: string
  diagnosis: string
  status: 'pending' | 'reviewed' | 'reported'
  reportedAt?: string
  slideCount: number
  accessionNumber: string
}

interface SlideSummary {
  id: string
  caseId: string
  patientId: string
  patientName: string
  stain: string
  stainLabel: string
  magnification: number
  institution: string
  levels: number
  width: number
  height: number
  tileSize: number
  scannedAt: string
  caseStatus: string
}

interface SlideDetail extends SlideSummary {
  levelsMeta: Array<{ level: number; width: number; height: number; tilesX: number; tilesY: number; tileSize: number }>
  case: CaseSummary
}

interface Annotation {
  id: string
  slideId: string
  kind: 'rect' | 'circle' | 'polygon'
  points: number[]
  label: string
  category: string
  color: string
  confidence?: number
  level: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

interface Seed {
  id: string
  patientId: string
  patientName: string
  stain: string
  stainLabel: string
  magnification: number
  institution: string
  levels: number
  width: number
  height: number
  specimen: string
  diagnosis: string
  status: 'pending' | 'reviewed' | 'reported'
  accessionNumber: string
}

const TILE_SIZE = 256

// 与后端 pathology.service SEED_SLIDES 完全同口径
const SEED_SLIDES: Seed[] = [
  { id: 'SL-2026-001', patientId: 'P00001', patientName: '张伟', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 40, institution: '汉东省人民医院 · 病理科', levels: 5, width: 8192, height: 6144, specimen: '胃窦活检', diagnosis: '低分化腺癌', status: 'reported', accessionNumber: 'ACC-20260701-001' },
  { id: 'SL-2026-002', patientId: 'P00002', patientName: '李娜', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 4096, height: 3000, specimen: '乳腺穿刺', diagnosis: '浸润性导管癌', status: 'reported', accessionNumber: 'ACC-20260702-018' },
  { id: 'SL-2026-003', patientId: 'P00003', patientName: '王芳', stain: 'IHC', stainLabel: '免疫组化 CK', magnification: 40, institution: '汉东省肿瘤医院 · 病理科', levels: 6, width: 16384, height: 12288, specimen: '结肠切除', diagnosis: '腺癌 CK 阳性', status: 'reviewed', accessionNumber: 'ACC-20260703-033' },
  { id: 'SL-2026-004', patientId: 'P00004', patientName: '赵敏', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 40, institution: '汉东省人民医院 · 病理科', levels: 5, width: 8192, height: 6144, specimen: '肺楔形切除', diagnosis: '鳞状细胞癌', status: 'pending', accessionNumber: 'ACC-20260704-052' },
  { id: 'SL-2026-005', patientId: 'P00005', patientName: '陈杰', stain: 'SS', stainLabel: '特殊染色 阿辛蓝-PAS', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 5120, height: 4096, specimen: '胃窦黏膜', diagnosis: '肠上皮化生', status: 'reported', accessionNumber: 'ACC-20260705-007' },
  { id: 'SL-2026-006', patientId: 'P00006', patientName: '刘洋', stain: 'FISH', stainLabel: 'FISH HER2', magnification: 40, institution: '汉东省肿瘤医院 · 病理科', levels: 5, width: 10240, height: 8192, specimen: '乳腺肿块', diagnosis: 'HER2 基因扩增', status: 'reviewed', accessionNumber: 'ACC-20260706-021' },
  { id: 'SL-2026-007', patientId: 'P00007', patientName: '孙丽', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 20, institution: '汉东省人民医院 · 病理科', levels: 4, width: 4096, height: 3072, specimen: '淋巴结活检', diagnosis: '反应性增生', status: 'pending', accessionNumber: 'ACC-20260707-044' },
  { id: 'SL-2026-008', patientId: 'P00008', patientName: '周强', stain: 'HE', stainLabel: '苏木精-伊红', magnification: 10, institution: '汉东省人民医院 · 病理科', levels: 3, width: 2048, height: 2048, specimen: '皮肤肿物', diagnosis: '基底细胞癌', status: 'reported', accessionNumber: 'ACC-20260708-012' },
]

const toSummary = (s: Seed): SlideSummary => ({
  id: s.id,
  caseId: `PC-${s.id.replace('SL-', '')}`,
  patientId: s.patientId,
  patientName: s.patientName,
  stain: s.stain,
  stainLabel: s.stainLabel,
  magnification: s.magnification,
  institution: s.institution,
  levels: s.levels,
  width: s.width,
  height: s.height,
  tileSize: TILE_SIZE,
  scannedAt: `2026-07-${String(1 + SEED_SLIDES.indexOf(s)).padStart(2, '0')}T09:30:00.000Z`,
  caseStatus: s.status,
})

const buildCases = (): CaseSummary[] =>
  SEED_SLIDES.map((s) => ({
    id: `PC-${s.id.replace('SL-', '')}`,
    patientId: s.patientId,
    patientName: s.patientName,
    specimen: s.specimen,
    diagnosis: s.diagnosis,
    status: s.status,
    reportedAt: s.status === 'reported' ? `2026-07-${String(1 + SEED_SLIDES.indexOf(s)).padStart(2, '0')}T14:00:00.000Z` : undefined,
    slideCount: 1,
    accessionNumber: s.accessionNumber,
  }))

const buildLevelsMeta = (width: number, height: number, levels: number): SlideDetail['levelsMeta'] => {
  const out: SlideDetail['levelsMeta'] = []
  for (let level = 0; level < levels; level++) {
    const w = Math.max(1, Math.ceil(width / Math.pow(2, level)))
    const h = Math.max(1, Math.ceil(height / Math.pow(2, level)))
    out.push({ level, width: w, height: h, tilesX: Math.ceil(w / TILE_SIZE), tilesY: Math.ceil(h / TILE_SIZE), tileSize: TILE_SIZE })
  }
  return out
}

// 1x1 透明 PNG (确定性瓦片占位; 页面本地回退可正常渲染)
const TILE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function pngBytes(): Uint8Array {
  const bin = atob(TILE_PNG_BASE64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const ANNOTATIONS: Annotation[] = [
  {
    id: 'ant-001', slideId: 'SL-2026-001', kind: 'rect', points: [3200, 2400, 4200, 3300],
    label: '肿瘤区域', category: 'tumor', color: '#ff4d4f', confidence: 0.92, level: 0,
    createdBy: 'wsi-user', createdAt: '2026-07-02T10:00:00.000Z', updatedAt: '2026-07-02T10:00:00.000Z',
  },
  {
    id: 'ant-002', slideId: 'SL-2026-001', kind: 'circle', points: [4000, 2800, 350],
    label: '浸润灶', category: 'tumor', color: '#fa8c16', confidence: 0.85, level: 0,
    createdBy: 'wsi-user', createdAt: '2026-07-02T10:05:00.000Z', updatedAt: '2026-07-02T10:05:00.000Z',
  },
]

const annotationMap = new Map<string, Annotation[]>()
for (const a of ANNOTATIONS) {
  const list = annotationMap.get(a.slideId) ?? []
  list.push(a)
  annotationMap.set(a.slideId, list)
}

let annotationSeq = 100

export const pathologyHandlers = [
  http.get(`${API}/cases`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: buildCases() })
  }),

  http.get(`${API}/slides`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId')
    const stain = url.searchParams.get('stain')
    let items = SEED_SLIDES.map(toSummary)
    if (patientId) items = items.filter((s) => s.patientId === patientId)
    if (stain) items = items.filter((s) => s.stain === stain)
    return HttpResponse.json({ success: true, data: items })
  }),

  http.get(`${API}/slides/:slideId`, async ({ params }) => {
    await delay(40)
    const seed = SEED_SLIDES.find((s) => s.id === params.slideId)
    if (!seed) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `病理切片不存在: ${params.slideId}` } }, { status: 404 })
    const detail: SlideDetail = {
      ...toSummary(seed),
      levelsMeta: buildLevelsMeta(seed.width, seed.height, seed.levels),
      case: buildCases().find((c) => c.id === `PC-${seed.id.replace('SL-', '')}`) ?? buildCases()[0]!,
    }
    return HttpResponse.json({ success: true, data: detail })
  }),

  http.get(`${API}/slides/:slideId/tile/:level/:x/:y`, async ({ params }) => {
    await delay(20)
    const level = Number(params.level)
    const x = Number(params.x)
    const y = Number(params.y)
    const seed = SEED_SLIDES.find((s) => s.id === params.slideId)
    if (!seed) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `病理切片不存在: ${params.slideId}` } }, { status: 404 })
    const meta = buildLevelsMeta(seed.width, seed.height, seed.levels)[level]
    if (!meta || x < 0 || y < 0 || x >= meta.tilesX || y >= meta.tilesY) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `瓦片越界: ${params.slideId}@${level} (${x},${y})` } }, { status: 404 })
    }
    return new HttpResponse(pngBytes(), {
      status: 200,
      headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
    })
  }),

  http.get(`${API}/slides/:slideId/annotations`, async ({ params }) => {
    await delay(40)
    return HttpResponse.json({ success: true, data: annotationMap.get(String(params.slideId)) ?? [] })
  }),

  http.post(`${API}/slides/:slideId/annotations`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as Record<string, unknown>
    const now = new Date().toISOString()
    const annotation: Annotation = {
      id: `ant-${annotationSeq++}`,
      slideId: String(params.slideId),
      kind: (body.kind ?? 'rect') as Annotation['kind'],
      points: Array.isArray(body.points) ? (body.points as number[]).map(Number) : [],
      label: String(body.label ?? '标注'),
      category: String(body.category ?? 'uncategorized'),
      color: String(body.color ?? '#ff4d4f'),
      confidence: body.confidence !== undefined ? Number(body.confidence) : undefined,
      level: Number(body.level ?? 0),
      createdBy: 'wsi-user',
      createdAt: now,
      updatedAt: now,
    }
    const list = annotationMap.get(annotation.slideId) ?? []
    list.push(annotation)
    annotationMap.set(annotation.slideId, list)
    return HttpResponse.json({ success: true, data: annotation })
  }),

  http.put(`${API}/annotations/:id`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as Record<string, unknown>
    for (const list of annotationMap.values()) {
      const idx = list.findIndex((a) => a.id === params.id)
      if (idx >= 0) {
        const prev = list[idx]!
        const next: Annotation = {
          ...prev,
          kind: (body.kind as Annotation['kind']) ?? prev.kind,
          points: Array.isArray(body.points) ? (body.points as number[]).map(Number) : prev.points,
          label: body.label !== undefined ? String(body.label) : prev.label,
          category: body.category !== undefined ? String(body.category) : prev.category,
          color: body.color !== undefined ? String(body.color) : prev.color,
          confidence: body.confidence !== undefined ? Number(body.confidence) : prev.confidence,
          level: body.level !== undefined ? Number(body.level) : prev.level,
          updatedAt: new Date().toISOString(),
        }
        list[idx] = next
        return HttpResponse.json({ success: true, data: next })
      }
    }
    return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `标注不存在: ${params.id}` } }, { status: 404 })
  }),

  http.delete(`${API}/annotations/:id`, async ({ params }) => {
    await delay(40)
    for (const [slideId, list] of annotationMap.entries()) {
      const idx = list.findIndex((a) => a.id === params.id)
      if (idx >= 0) {
        list.splice(idx, 1)
        if (list.length === 0) annotationMap.delete(slideId)
        return HttpResponse.json({ success: true, data: { deleted: true, id: params.id } })
      }
    }
    return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `标注不存在: ${params.id}` } }, { status: 404 })
  }),
]
