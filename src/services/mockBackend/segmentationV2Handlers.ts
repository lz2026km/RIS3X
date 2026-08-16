// [G005 Wave 2C v3.0.6.11-101] /api/v1/segmentation-v2 MSW handlers
// 对齐后端 segmentation-v2.module + segmentationV2Api (5 算法: region_grow/threshold/edge_canny/kmeans/active_contour)
// 响应形状: { success: true, data: <T> } (确定性, source: 'synthetic')
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/segmentation-v2`

type Algorithm = 'region_grow' | 'threshold' | 'edge_canny' | 'kmeans' | 'active_contour'
type OrganClass = '结节' | '骨骼' | '肝脏' | '肺' | '血管' | '软组织' | '其他'

interface Segment {
  id: string
  seriesUID: string
  algorithm: Algorithm
  algorithmLabel: string
  thresholdMode?: 'otsu' | 'manual'
  params: Record<string, unknown>
  label: string
  color: string
  organClass: OrganClass
  source: 'real' | 'synthetic'
  usedFallback: boolean
  stats: { voxelCount: number; volumeCm3: number; areaCm2: number; meanIntensity: number; minIntensity: number; maxIntensity: number; boundaryPointCount: number; bbox: { x: number; y: number; z: number; w: number; h: number; d: number } }
  dims: { width: number; height: number; depth: number }
  pixelSpacing: [number, number]
  sliceThickness: number
  rle3d: Array<{ start: number; length: number }>
  slices: Array<{ z: number; width: number; height: number; runs: Array<{ start: number; length: number }> }>
  linkedMeasurement: { measurementId: string; lesionId: string | null; diameterMm: number; studyId: string; date: string; notes?: string } | null
  createdAt: string
}

interface Summary {
  id: string
  seriesUID: string
  algorithm: Algorithm
  algorithmLabel: string
  label: string
  color: string
  organClass: OrganClass
  source: 'real' | 'synthetic'
  usedFallback: boolean
  stats: Segment['stats']
  linkedMeasurement: Segment['linkedMeasurement']
  createdAt: string
}

const ALGO_LABEL: Record<Algorithm, string> = {
  region_grow: '区域生长',
  threshold: '阈值分割',
  edge_canny: '边缘检测',
  kmeans: 'K-Means 聚类',
  active_contour: '活动轮廓',
}

const SERIES_SEED: Array<{ seriesUID: string; label: string; organClass: OrganClass }> = [
  { seriesUID: '1.2.826.0.1.3680043.8.498.20260718120000.001', label: '头颅骨窗', organClass: '骨骼' },
  { seriesUID: '1.2.826.0.1.3680043.8.498.20260718130000.002', label: '肺结节', organClass: '结节' },
  { seriesUID: '1.2.826.0.1.3680043.8.498.20260802090000.003', label: '肝脏占位', organClass: '肝脏' },
]

let segments: Segment[] = [
  {
    id: 'seg2-001', seriesUID: SERIES_SEED[0]!.seriesUID, algorithm: 'threshold', algorithmLabel: '阈值分割',
    thresholdMode: 'otsu', params: { thresholdLo: 300, thresholdHi: 3071, thresholdMode: 'otsu' },
    label: '头颅骨窗分割', color: '#1677ff', organClass: '骨骼',
    source: 'synthetic', usedFallback: true,
    stats: { voxelCount: 929120, volumeCm3: 116.14, areaCm2: 1462.8, meanIntensity: 828.4, minIntensity: 521, maxIntensity: 1130, boundaryPointCount: 48210, bbox: { x: 80, y: 51, z: 0, w: 352, h: 410, d: 20 } },
    dims: { width: 512, height: 512, depth: 20 },
    pixelSpacing: [0.49, 0.49], sliceThickness: 5,
    rle3d: [{ start: 0, length: 8192 }],
    slices: [0, 1, 2].map((z) => ({ z, width: 512, height: 512, runs: [{ start: 128 * 512 + 128, length: 256 }] })),
    linkedMeasurement: null,
    createdAt: '2026-08-10T09:00:00.000Z',
  },
  {
    id: 'seg2-002', seriesUID: SERIES_SEED[1]!.seriesUID, algorithm: 'region_grow', algorithmLabel: '区域生长',
    params: { seed: { x: 260, y: 220, z: 10 }, minVoxels: 500 },
    label: '肺结节区域生长', color: '#fa8c16', organClass: '结节',
    source: 'synthetic', usedFallback: true,
    stats: { voxelCount: 6842, volumeCm3: 2.84, areaCm2: 12.4, meanIntensity: 36.5, minIntensity: -18, maxIntensity: 96, boundaryPointCount: 1280, bbox: { x: 220, y: 210, z: 8, w: 72, h: 66, d: 6 } },
    dims: { width: 512, height: 512, depth: 15 },
    pixelSpacing: [0.62, 0.62], sliceThickness: 1.5,
    rle3d: [{ start: 0, length: 4096 }],
    slices: [0, 1].map((z) => ({ z, width: 512, height: 512, runs: [{ start: 256 * 512 + 256, length: 120 }] })),
    linkedMeasurement: { measurementId: 'mv-001', lesionId: null, diameterMm: 8.2, studyId: 'ST-20260718-001', date: '2026-07-18', notes: '肺结节随访测量' },
    createdAt: '2026-08-11T10:00:00.000Z',
  },
]

let segmentSeq = 100

function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

function runSegment(seriesUID: string, algorithm: Algorithm, params: Record<string, unknown>): Segment {
  const seedInfo = SERIES_SEED.find((s) => s.seriesUID === seriesUID)
  const rng = hash01(`${seriesUID}|${algorithm}`)
  const width = 512
  const height = 512
  const depth = 20
  const voxelCount = Math.round((4000 + rng * 6000) * (algorithm === 'threshold' ? 4 : 1))
  const volumeCm3 = Math.round(voxelCount * 0.0004 * 100) / 100
  const cx = Math.round(80 + rng * 300)
  const cy = Math.round(80 + hash01(`${seriesUID}|${algorithm}|y`) * 300)
  const segment: Segment = {
    id: `seg2-${segmentSeq++}`,
    seriesUID,
    algorithm,
    algorithmLabel: ALGO_LABEL[algorithm],
    thresholdMode: algorithm === 'threshold' ? (params.thresholdMode as 'otsu' | 'manual' | undefined) ?? 'otsu' : undefined,
    params,
    label: params.label ? String(params.label) : seedInfo?.label ?? `${ALGO_LABEL[algorithm]}结果`,
    color: String(params.color ?? '#1677ff'),
    organClass: (params.organClass as OrganClass | undefined) ?? seedInfo?.organClass ?? '其他',
    source: 'synthetic',
    usedFallback: true,
    stats: {
      voxelCount,
      volumeCm3,
      areaCm2: Math.round(volumeCm3 / 0.4 * 10) / 10,
      meanIntensity: Math.round((30 + rng * 60) * 10) / 10,
      minIntensity: -80,
      maxIntensity: Math.round(150 + rng * 300),
      boundaryPointCount: Math.round(voxelCount / 6),
      bbox: { x: cx, y: cy, z: Math.round(depth / 2), w: 80, h: 70, d: 6 },
    },
    dims: { width, height, depth },
    pixelSpacing: [0.62, 0.62],
    sliceThickness: 2.5,
    rle3d: [{ start: 0, length: Math.min(8192, Math.round(voxelCount / 8)) }],
    slices: [0, 1, 2].map((z) => ({ z, width, height, runs: [{ start: cy * width + cx, length: 40 }] })),
    linkedMeasurement: null,
    createdAt: new Date().toISOString(),
  }
  segments.unshift(segment)
  return segment
}

export const segmentationV2Handlers = [
  http.post(`${API}/run`, async ({ request }) => {
    await delay(120)
    const body = (await request.json()) as { seriesUID?: string; algorithm?: Algorithm; params?: Record<string, unknown> }
    const segment = runSegment(String(body?.seriesUID ?? SERIES_SEED[0]!.seriesUID), (body?.algorithm ?? 'region_grow') as Algorithm, body?.params ?? {})
    return HttpResponse.json({ success: true, data: segment })
  }),

  http.get(`${API}/segments`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const seriesUID = url.searchParams.get('seriesUID') ?? ''
    const items: Summary[] = (seriesUID ? segments.filter((s) => s.seriesUID === seriesUID) : segments).map((s) => ({
      id: s.id, seriesUID: s.seriesUID, algorithm: s.algorithm, algorithmLabel: s.algorithmLabel,
      label: s.label, color: s.color, organClass: s.organClass,
      source: s.source, usedFallback: s.usedFallback, stats: s.stats,
      linkedMeasurement: s.linkedMeasurement, createdAt: s.createdAt,
    }))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.get(`${API}/segments/:id`, async ({ params }) => {
    await delay(40)
    const item = segments.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `segment ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.patch(`${API}/segments/:id`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { label?: string; color?: string; organClass?: OrganClass }
    const item = segments.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `segment ${params.id} not found` } }, { status: 404 })
    if (body?.label) item.label = body.label
    if (body?.color) item.color = body.color
    if (body?.organClass) item.organClass = body.organClass
    return HttpResponse.json({ success: true, data: item })
  }),

  http.delete(`${API}/segments/:id`, async ({ params }) => {
    await delay(40)
    const idx = segments.findIndex((s) => s.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `segment ${params.id} not found` } }, { status: 404 })
    segments.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { id: params.id, deleted: true } })
  }),

  http.get(`${API}/history`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const seriesUID = url.searchParams.get('seriesUID') ?? ''
    const items = (seriesUID ? segments.filter((s) => s.seriesUID === seriesUID) : segments).map((s) => ({
      id: s.id, seriesUID: s.seriesUID, algorithm: s.algorithm, label: s.label, organClass: s.organClass,
      status: 'active' as const, voxelCount: s.stats.voxelCount, volumeCm3: s.stats.volumeCm3, createdAt: s.createdAt,
    }))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/segments/:id/measurement`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { patientId?: string; lesionId?: string; sizeMm?: number; date?: string; notes?: string }
    const item = segments.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `segment ${params.id} not found` } }, { status: 404 })
    item.linkedMeasurement = {
      measurementId: `mv-link-${segmentSeq}`,
      lesionId: body?.lesionId ?? null,
      diameterMm: body?.sizeMm ?? Math.round(item.stats.volumeCm3 / 0.4 * 100) / 100,
      studyId: body?.patientId ?? item.seriesUID,
      date: body?.date ?? new Date().toISOString().slice(0, 10),
      notes: body?.notes,
    }
    return HttpResponse.json({ success: true, data: item })
  }),
]
