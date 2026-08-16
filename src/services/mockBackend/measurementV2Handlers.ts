// [G005 Wave 3B v3.0.6.11-101] /api/v1/measurement-v2 MSW handlers
// 对齐后端 measurement-v2.module + measurementV2Api:
//   GET  /measurement-v2/types | /seed-study-uids
//   POST /measurement-v2/compute | /coordinates/convert
//   GET/POST /measurement-v2/measurements (+ PUT/DELETE/:id, versions, rollback, link-annotation)
//   GET/POST /measurement-v2/annotations (+ PUT/DELETE/:id, versions, rollback)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/measurement-v2`

type MeasureV2Type = 'line' | 'angle' | 'ellipseArea' | 'rectangleArea' | 'polygonArea' | 'polyline' | 'cobb' | 'calciumScore'
type AnnotationV2Type = 'text' | 'arrow' | 'rect' | 'ellipse' | 'freehand'

interface Point2D { x: number; y: number }

interface Meta {
  type: MeasureV2Type
  label: string
  unit: string
  minPoints: number
  fixedPoints: number
  deterministic: boolean
  formula: string
  precision: number
}

const TYPE_META: Meta[] = [
  { type: 'line', label: '直线距离', unit: 'mm', minPoints: 2, fixedPoints: 2, deterministic: true, formula: 'sqrt((x2-x1)²+(y2-y1)²)×spacing', precision: 2 },
  { type: 'angle', label: '角度', unit: '°', minPoints: 3, fixedPoints: 3, deterministic: true, formula: 'atan2 三点夹角', precision: 1 },
  { type: 'ellipseArea', label: '椭圆面积', unit: 'mm²', minPoints: 4, fixedPoints: 4, deterministic: true, formula: 'π×a×b×spacing²', precision: 2 },
  { type: 'rectangleArea', label: '矩形面积', unit: 'mm²', minPoints: 2, fixedPoints: 2, deterministic: true, formula: 'w×h×spacing²', precision: 2 },
  { type: 'polygonArea', label: '多边形面积', unit: 'mm²', minPoints: 3, fixedPoints: 0, deterministic: true, formula: '鞋带公式×spacing²', precision: 2 },
  { type: 'polyline', label: '折线长度', unit: 'mm', minPoints: 2, fixedPoints: 0, deterministic: true, formula: '逐段欧氏距离和×spacing', precision: 2 },
  { type: 'cobb', label: 'Cobb 角', unit: '°', minPoints: 4, fixedPoints: 4, deterministic: true, formula: '上端椎/下端椎线夹角', precision: 1 },
  { type: 'calciumScore', label: '钙化积分', unit: 'Agatston', minPoints: 1, fixedPoints: 0, deterministic: true, formula: '面积×HU 权重', precision: 0 },
]

const SEED_STUDY_UIDS = [
  '1.2.826.0.1.3680043.8.498.20260718120000.001',
  '1.2.826.0.1.3680043.8.498.20260718130000.002',
  '1.2.826.0.1.3680043.8.498.20260802090000.003',
]

const dist = (a: Point2D, b: Point2D) => Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2)

/** 确定性测量计算 (与后端 measurement-v2 算法口径一致) */
function compute(type: MeasureV2Type, points: Point2D[], pixelSpacing: [number, number], huValues?: number[], huThreshold?: number): { value: number; unit: string; formula: string; precision: number; detail?: Record<string, number> } {
  const sp = pixelSpacing
  const px = (v: number) => Math.round(v * 100) / 100
  switch (type) {
    case 'line': {
      const value = px(dist(points[0]!, points[1] ?? points[0]!) * sp[0])
      return { value, unit: 'mm', formula: 'sqrt((x2-x1)²+(y2-y1)²)×spacing', precision: 2, detail: { spacingX: sp[0], spacingY: sp[1] } }
    }
    case 'angle': {
      const [a, b, c] = points
      const v1 = { x: (a?.x ?? 0) - (b?.x ?? 0), y: (a?.y ?? 0) - (b?.y ?? 0) }
      const v2 = { x: (c?.x ?? 0) - (b?.x ?? 0), y: (c?.y ?? 0) - (b?.y ?? 0) }
      const dot = v1.x * v2.x + v1.y * v2.y
      const m1 = Math.sqrt(v1.x ** 2 + v1.y ** 2)
      const m2 = Math.sqrt(v2.x ** 2 + v2.y ** 2)
      const value = Math.round((Math.acos(Math.max(-1, Math.min(1, dot / Math.max(1e-6, m1 * m2)))) * 180) / Math.PI * 10) / 10
      return { value, unit: '°', formula: 'atan2 三点夹角', precision: 1 }
    }
    case 'ellipseArea': {
      const [p1, p2] = points
      const rx = dist(p1!, p2!) * sp[0] / 2
      const ry = rx * 0.8
      const value = px(Math.PI * rx * ry)
      return { value, unit: 'mm²', formula: 'π×a×b×spacing²', precision: 2, detail: { rx: px(rx), ry: px(ry) } }
    }
    case 'rectangleArea': {
      const [p1, p2] = points
      const w = Math.abs((p2?.x ?? 0) - (p1?.x ?? 0)) * sp[0]
      const h = Math.abs((p2?.y ?? 0) - (p1?.y ?? 0)) * sp[1]
      const value = px(w * h)
      return { value, unit: 'mm²', formula: 'w×h×spacing²', precision: 2, detail: { widthMm: px(w), heightMm: px(h) } }
    }
    case 'polygonArea': {
      let sum = 0
      for (let i = 0; i < points.length; i++) {
        const p = points[i]!
        const q = points[(i + 1) % points.length]!
        sum += p.x * q.y - q.x * p.y
      }
      const value = px(Math.abs(sum) / 2 * sp[0] * sp[1])
      return { value, unit: 'mm²', formula: '鞋带公式×spacing²', precision: 2 }
    }
    case 'polyline': {
      let len = 0
      for (let i = 0; i + 1 < points.length; i++) len += dist(points[i]!, points[i + 1]!)
      const value = px(len * sp[0])
      return { value, unit: 'mm', formula: '逐段欧氏距离和×spacing', precision: 2, detail: { segments: points.length - 1 } }
    }
    case 'cobb': {
      const [t1, t2, b1, b2] = points
      const a1 = Math.atan2((t2?.y ?? 0) - (t1?.y ?? 0), (t2?.x ?? 0) - (t1?.x ?? 0)) * 180 / Math.PI
      const a2 = Math.atan2((b2?.y ?? 0) - (b1?.y ?? 0), (b2?.x ?? 0) - (b1?.x ?? 0)) * 180 / Math.PI
      const value = Math.round(Math.abs(a1 - a2) * 10) / 10
      return { value, unit: '°', formula: '上端椎/下端椎线夹角', precision: 1, detail: { line1Deg: Math.round(a1 * 10) / 10, line2Deg: Math.round(a2 * 10) / 10 } }
    }
    case 'calciumScore': {
      const hu = huValues ?? []
      const thr = huThreshold ?? 130
      const area = Math.max(1, Math.round(hu.length * Math.max(1, points.length)))
      const above = hu.filter((v) => v >= thr).length
      const maxHu = hu.length ? Math.max(...hu) : 130
      const weight = maxHu >= 400 ? 4 : maxHu >= 300 ? 3 : maxHu >= 200 ? 2 : 1
      const value = Math.round(area * weight * (above / Math.max(1, hu.length)) + (hu.length ? 0 : area * weight))
      return { value, unit: 'Agatston', formula: '面积×HU 权重', precision: 0, detail: { areaPx: area, weight, aboveThreshold: above } }
    }
    default:
      return { value: 0, unit: '', formula: '', precision: 2 }
  }
}

interface MeasurementV2Version {
  version: number
  value: number
  unit: string
  points: Point2D[]
  worldPoints: Point2D[]
  label: string
  color: string
  note: string
  createdAt: string
}

interface MeasurementV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: MeasureV2Type
  points: Point2D[]
  worldPoints: Point2D[]
  value: number
  unit: string
  label: string
  color: string
  visible: boolean
  formula: string
  deterministic: boolean
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: MeasurementV2Version[]
  annotationId: string | null
}

interface AnnotationV2Version {
  version: number
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  note: string
  createdAt: string
}

interface AnnotationV2Record {
  id: string
  studyUid: string
  seriesUid: string
  type: AnnotationV2Type
  pixelPoints: Point2D[]
  worldPoints: Point2D[]
  text: string
  color: string
  fontSize: number
  visible: boolean
  locked: boolean
  measurementId: string | null
  createdBy: string
  createdAt: string
  updatedAt: string
  version: number
  versions: AnnotationV2Version[]
}

const SEED_MEASUREMENTS: MeasurementV2Record[] = [
  {
    id: 'mv-001', studyUid: SEED_STUDY_UIDS[0]!, seriesUid: 'sr-1',
    type: 'line', points: [{ x: 200, y: 220 }, { x: 260, y: 220 }],
    worldPoints: [{ x: 100, y: 110 }, { x: 130, y: 110 }],
    value: 30, unit: 'mm', label: '结节长径', color: '#ff4d4f', visible: true,
    formula: 'sqrt((x2-x1)²+(y2-y1)²)×spacing', deterministic: true,
    createdBy: 'u-001', createdAt: '2026-08-10T09:00:00.000Z', updatedAt: '2026-08-10T09:00:00.000Z',
    version: 1,
    versions: [
      { version: 1, value: 30, unit: 'mm', points: [{ x: 200, y: 220 }, { x: 260, y: 220 }], worldPoints: [{ x: 100, y: 110 }, { x: 130, y: 110 }], label: '结节长径', color: '#ff4d4f', note: '初测', createdAt: '2026-08-10T09:00:00.000Z' },
    ],
    annotationId: null,
  },
  {
    id: 'mv-002', studyUid: SEED_STUDY_UIDS[1]!, seriesUid: 'sr-2',
    type: 'ellipseArea', points: [{ x: 240, y: 240 }, { x: 300, y: 240 }, { x: 240, y: 280 }, { x: 300, y: 280 }],
    worldPoints: [{ x: 120, y: 120 }, { x: 150, y: 120 }, { x: 120, y: 140 }, { x: 150, y: 140 }],
    value: 628.32, unit: 'mm²', label: '肝占位面积', color: '#ffa940', visible: true,
    formula: 'π×a×b×spacing²', deterministic: true,
    createdBy: 'u-002', createdAt: '2026-08-11T10:30:00.000Z', updatedAt: '2026-08-11T10:30:00.000Z',
    version: 1,
    versions: [
      { version: 1, value: 628.32, unit: 'mm²', points: [{ x: 240, y: 240 }, { x: 300, y: 240 }, { x: 240, y: 280 }, { x: 300, y: 280 }], worldPoints: [{ x: 120, y: 120 }, { x: 150, y: 120 }, { x: 120, y: 140 }, { x: 150, y: 140 }], label: '肝占位面积', color: '#ffa940', note: '初测', createdAt: '2026-08-11T10:30:00.000Z' },
    ],
    annotationId: null,
  },
]

const SEED_ANNOTATIONS: AnnotationV2Record[] = [
  {
    id: 'av-001', studyUid: SEED_STUDY_UIDS[0]!, seriesUid: 'sr-1',
    type: 'arrow', pixelPoints: [{ x: 230, y: 230 }, { x: 260, y: 230 }],
    worldPoints: [{ x: 115, y: 115 }, { x: 130, y: 115 }],
    text: '右肺上叶结节', color: '#36cfc9', fontSize: 14, visible: true, locked: false,
    measurementId: null, createdBy: 'u-001',
    createdAt: '2026-08-10T09:02:00.000Z', updatedAt: '2026-08-10T09:02:00.000Z', version: 1,
    versions: [
      { version: 1, type: 'arrow', pixelPoints: [{ x: 230, y: 230 }, { x: 260, y: 230 }], worldPoints: [{ x: 115, y: 115 }, { x: 130, y: 115 }], text: '右肺上叶结节', color: '#36cfc9', fontSize: 14, note: '', createdAt: '2026-08-10T09:02:00.000Z' },
    ],
  },
]

let measurements: MeasurementV2Record[] = [...SEED_MEASUREMENTS]
let annotations: AnnotationV2Record[] = [...SEED_ANNOTATIONS]
let mSeq = 100
let aSeq = 100

const makeMeasurement = (dto: Record<string, unknown>, id: string): MeasurementV2Record => {
  const type = (dto.type ?? 'line') as MeasureV2Type
  const points = (dto.points ?? []) as Point2D[]
  const spacing = (dto.pixelSpacing ?? [1, 1]) as [number, number]
  const huValues = (dto.huValues ?? undefined) as number[] | undefined
  const huThreshold = (dto.huThreshold ?? undefined) as number | undefined
  const result = compute(type, points, spacing, huValues, huThreshold)
  const now = new Date().toISOString()
  const meta = TYPE_META.find((t) => t.type === type)
  return {
    id,
    studyUid: String(dto.studyUid ?? ''),
    seriesUid: String(dto.seriesUid ?? ''),
    type,
    points,
    worldPoints: points.map((p) => ({ x: Math.round(p.x / (spacing[0] || 1) * 10) / 10, y: Math.round(p.y / (spacing[1] || 1) * 10) / 10 })),
    value: result.value,
    unit: result.unit,
    label: String(dto.label ?? meta?.label ?? type),
    color: String(dto.color ?? '#ff4d4f'),
    visible: dto.visible !== false,
    formula: result.formula,
    deterministic: true,
    createdBy: String(dto.createdBy ?? 'u-001'),
    createdAt: now,
    updatedAt: now,
    version: 1,
    versions: [
      { version: 1, value: result.value, unit: result.unit, points, worldPoints: points.map((p) => ({ x: Math.round(p.x / (spacing[0] || 1) * 10) / 10, y: Math.round(p.y / (spacing[1] || 1) * 10) / 10 })), label: String(dto.label ?? meta?.label ?? type), color: String(dto.color ?? '#ff4d4f'), note: '初测', createdAt: now },
    ],
    annotationId: null,
  }
}

const makeAnnotation = (dto: Record<string, unknown>, id: string): AnnotationV2Record => {
  const type = (dto.type ?? 'text') as AnnotationV2Type
  const pixelPoints = (dto.pixelPoints ?? []) as Point2D[]
  const spacing = (dto.pixelSpacing ?? [1, 1]) as [number, number]
  const now = new Date().toISOString()
  return {
    id,
    studyUid: String(dto.studyUid ?? ''),
    seriesUid: String(dto.seriesUid ?? ''),
    type,
    pixelPoints,
    worldPoints: pixelPoints.map((p) => ({ x: Math.round(p.x / (spacing[0] || 1) * 10) / 10, y: Math.round(p.y / (spacing[1] || 1) * 10) / 10 })),
    text: String(dto.text ?? ''),
    color: String(dto.color ?? '#36cfc9'),
    fontSize: Number(dto.fontSize ?? 14),
    visible: dto.visible !== false,
    locked: dto.locked === true,
    measurementId: dto.measurementId ? String(dto.measurementId) : null,
    createdBy: String(dto.createdBy ?? 'u-001'),
    createdAt: now,
    updatedAt: now,
    version: 1,
    versions: [
      { version: 1, type, pixelPoints, worldPoints: pixelPoints.map((p) => ({ x: Math.round(p.x / (spacing[0] || 1) * 10) / 10, y: Math.round(p.y / (spacing[1] || 1) * 10) / 10 })), text: String(dto.text ?? ''), color: String(dto.color ?? '#36cfc9'), fontSize: Number(dto.fontSize ?? 14), note: '', createdAt: now },
    ],
  }
}

export const measurementV2Handlers = [
  http.get(`${API}/types`, async () => {
    await delay(30)
    return HttpResponse.json({ success: true, data: TYPE_META })
  }),

  http.get(`${API}/seed-study-uids`, async () => {
    await delay(30)
    return HttpResponse.json({ success: true, data: SEED_STUDY_UIDS })
  }),

  http.post(`${API}/compute`, async ({ request }) => {
    await delay(30)
    const body = (await request.json()) as { type?: MeasureV2Type; points?: Point2D[]; pixelSpacing?: [number, number]; huValues?: number[]; huThreshold?: number }
    const type = (body?.type ?? 'line') as MeasureV2Type
    const result = compute(type, body?.points ?? [], body?.pixelSpacing ?? [1, 1], body?.huValues, body?.huThreshold)
    return HttpResponse.json({ success: true, data: { type, deterministic: true, ...result } })
  }),

  http.post(`${API}/coordinates/convert`, async ({ request }) => {
    await delay(30)
    const body = (await request.json()) as { points?: Point2D[]; pixelSpacing?: [number, number]; direction?: 'pixelToWorld' | 'worldToPixel' }
    const spacing = body?.pixelSpacing ?? [1, 1]
    const direction = body?.direction ?? 'pixelToWorld'
    const factor = direction === 'pixelToWorld' ? spacing : [1 / (spacing[0] || 1), 1 / (spacing[1] || 1)]
    const points = (body?.points ?? []).map((p) => ({ x: Math.round(p.x * factor[0]! * 100) / 100, y: Math.round(p.y * factor[1]! * 100) / 100 }))
    return HttpResponse.json({ success: true, data: { points, pixelSpacing: spacing, direction } })
  }),

  http.get(`${API}/measurements`, async ({ request }) => {
    await delay(30)
    const url = new URL(request.url)
    const studyUid = url.searchParams.get('studyUid') ?? ''
    const items = studyUid ? measurements.filter((m) => m.studyUid === studyUid) : measurements
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/measurements`, async ({ request }) => {
    await delay(30)
    const dto = (await request.json()) as Record<string, unknown>
    const record = makeMeasurement(dto, `mv-${mSeq++}`)
    measurements.unshift(record)
    return HttpResponse.json({ success: true, data: record })
  }),

  http.put(`${API}/measurements/:id`, async ({ params, request }) => {
    await delay(30)
    const patch = (await request.json()) as Record<string, unknown>
    const record = measurements.find((m) => m.id === params.id)
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `measurement ${params.id} not found` } }, { status: 404 })
    const prev = record
    const merged: MeasurementV2Record = { ...prev, ...patch } as unknown as MeasurementV2Record
    if (patch.points) {
      const result = compute(record.type, (patch.points as Point2D[]), (patch.pixelSpacing as [number, number]) ?? [1, 1])
      merged.points = patch.points as Point2D[]
      merged.value = result.value
      merged.unit = result.unit
      merged.formula = result.formula
    }
    merged.version = prev.version + 1
    merged.updatedAt = new Date().toISOString()
    merged.versions = [...prev.versions, {
      version: merged.version,
      value: merged.value,
      unit: merged.unit,
      points: merged.points,
      worldPoints: merged.worldPoints,
      label: merged.label,
      color: merged.color,
      note: String(patch.note ?? ''),
      createdAt: merged.updatedAt,
    }]
    const idx = measurements.findIndex((m) => m.id === params.id)
    measurements[idx] = merged
    return HttpResponse.json({ success: true, data: merged })
  }),

  http.delete(`${API}/measurements/:id`, async ({ params }) => {
    await delay(30)
    const idx = measurements.findIndex((m) => m.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `measurement ${params.id} not found` } }, { status: 404 })
    measurements.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { deleted: true, id: params.id } })
  }),

  http.get(`${API}/measurements/:id/versions`, async ({ params }) => {
    await delay(30)
    const record = measurements.find((m) => m.id === params.id)
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `measurement ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: record.versions })
  }),

  http.post(`${API}/measurements/:id/rollback`, async ({ params, request }) => {
    await delay(30)
    const body = (await request.json()) as { version?: number }
    const record = measurements.find((m) => m.id === params.id)
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `measurement ${params.id} not found` } }, { status: 404 })
    const target = record.versions.find((v) => v.version === body?.version) ?? record.versions[0]!
    record.value = target.value
    record.unit = target.unit
    record.points = target.points
    record.worldPoints = target.worldPoints
    record.label = target.label
    record.color = target.color
    record.updatedAt = new Date().toISOString()
    record.versions = [...record.versions, { ...target, version: record.versions.length + 1, note: '回滚', createdAt: record.updatedAt }]
    record.version = record.versions.length
    return HttpResponse.json({ success: true, data: record })
  }),

  http.post(`${API}/measurements/:id/link-annotation`, async ({ params, request }) => {
    await delay(30)
    const body = (await request.json()) as { annotationId?: string }
    const record = measurements.find((m) => m.id === params.id)
    const annotation = annotations.find((a) => a.id === body?.annotationId)
    if (!record || !annotation) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'measurement or annotation not found' } }, { status: 404 })
    record.annotationId = annotation.id
    annotation.measurementId = record.id
    return HttpResponse.json({ success: true, data: { measurement: record, annotation } })
  }),

  http.get(`${API}/annotations`, async ({ request }) => {
    await delay(30)
    const url = new URL(request.url)
    const studyUid = url.searchParams.get('studyUid') ?? ''
    const items = studyUid ? annotations.filter((a) => a.studyUid === studyUid) : annotations
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/annotations`, async ({ request }) => {
    await delay(30)
    const dto = (await request.json()) as Record<string, unknown>
    const record = makeAnnotation(dto, `av-${aSeq++}`)
    annotations.unshift(record)
    return HttpResponse.json({ success: true, data: record })
  }),

  http.put(`${API}/annotations/:id`, async ({ params, request }) => {
    await delay(30)
    const patch = (await request.json()) as Record<string, unknown>
    const record = annotations.find((a) => a.id === params.id)
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `annotation ${params.id} not found` } }, { status: 404 })
    const prev = record
    const merged: AnnotationV2Record = { ...prev, ...patch } as unknown as AnnotationV2Record
    if (patch.pixelPoints) merged.pixelPoints = patch.pixelPoints as Point2D[]
    merged.version = prev.version + 1
    merged.updatedAt = new Date().toISOString()
    merged.versions = [...prev.versions, {
      version: merged.version,
      type: merged.type,
      pixelPoints: merged.pixelPoints,
      worldPoints: merged.worldPoints,
      text: merged.text,
      color: merged.color,
      fontSize: merged.fontSize,
      note: String(patch.note ?? ''),
      createdAt: merged.updatedAt,
    }]
    const idx = annotations.findIndex((a) => a.id === params.id)
    annotations[idx] = merged
    return HttpResponse.json({ success: true, data: merged })
  }),

  http.delete(`${API}/annotations/:id`, async ({ params }) => {
    await delay(30)
    const idx = annotations.findIndex((a) => a.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `annotation ${params.id} not found` } }, { status: 404 })
    annotations.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { deleted: true, id: params.id } })
  }),

  http.get(`${API}/annotations/:id/versions`, async ({ params }) => {
    await delay(30)
    const record = annotations.find((a) => a.id === params.id)
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `annotation ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: record.versions })
  }),

  http.post(`${API}/annotations/:id/rollback`, async ({ params, request }) => {
    await delay(30)
    const body = (await request.json()) as { version?: number }
    const record = annotations.find((a) => a.id === params.id)
    if (!record) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `annotation ${params.id} not found` } }, { status: 404 })
    const target = record.versions.find((v) => v.version === body?.version) ?? record.versions[0]!
    record.pixelPoints = target.pixelPoints
    record.worldPoints = target.worldPoints
    record.text = target.text
    record.color = target.color
    record.fontSize = target.fontSize
    record.updatedAt = new Date().toISOString()
    record.versions = [...record.versions, { ...target, version: record.versions.length + 1, note: '回滚', createdAt: record.updatedAt }]
    record.version = record.versions.length
    return HttpResponse.json({ success: true, data: record })
  }),
]
