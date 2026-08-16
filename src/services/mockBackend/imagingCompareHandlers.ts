// [G005 Wave 2A v3.0.6.11-101] /api/v1/imaging-compare MSW handlers
// 对齐后端 imaging-compare.module + imagingCompareApi:
//   GET  /imaging-compare/patients                       患者列表 (支持 keyword)
//   GET  /imaging-compare/patients/:patientId/studies    患者检查/序列
//   GET  /imaging-compare/sessions                       对比会话列表 (支持 patientId)
//   POST /imaging-compare/sessions                       新建会话
//   GET  /imaging-compare/sessions/:id                   会话详情
//   DELETE /imaging-compare/sessions/:id                 删除会话
//   GET  /imaging-compare/sessions/:id/sync              同步状态
//   PATCH /imaging-compare/sessions/:id/sync             更新同步状态
//   POST /imaging-compare/sessions/:id/difference        影像级差异指标 (确定性)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/imaging-compare`

interface SeriesInfo {
  seriesInstanceUid: string
  studyInstanceUid: string
  modality: string
  seriesDescription: string
  instanceCount: number
  studyDate: string
}

interface StudyDto {
  studyInstanceUid: string
  accessionNumber: string
  studyDate: string
  modality: string
  bodyPart: string
  series: SeriesInfo[]
}

interface PatientDto {
  patientId: string
  name: string
  gender: string
  studyCount: number
  lastStudyDate: string
}

interface SyncState { panZoom: boolean; wwwl: boolean; frame: boolean }

interface SessionDto {
  id: string
  patientId: string
  patientName: string
  name: string
  groupType: 'multi-timepoint' | 'multi-series' | 'multi-modality'
  seriesGroups: Array<{ seriesInstanceUid: string; label: string; modality: string }>
  sync: SyncState
  createdAt: string
  updatedAt: string
}

// ── 确定性种子 (与后端 seed 同口径) ─────────────────────────────
const PATIENTS: PatientDto[] = [
  { patientId: 'P1001', name: '张建国', gender: '男', studyCount: 3, lastStudyDate: '2026-07-20' },
  { patientId: 'P1002', name: '李秀英', gender: '女', studyCount: 2, lastStudyDate: '2026-07-28' },
  { patientId: 'P1003', name: '王德发', gender: '男', studyCount: 4, lastStudyDate: '2026-08-02' },
  { patientId: 'P1004', name: '赵丽华', gender: '女', studyCount: 2, lastStudyDate: '2026-08-05' },
  { patientId: 'P1005', name: '陈志强', gender: '男', studyCount: 3, lastStudyDate: '2026-08-09' },
]

const STUDIES: Record<string, StudyDto[]> = {
  'P1001': [
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260720001', accessionNumber: 'ACC0720-001',
      studyDate: '2026-07-20', modality: 'CT', bodyPart: '胸部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260720001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260720001', modality: 'CT', seriesDescription: '胸部平扫', instanceCount: 120, studyDate: '2026-07-20' },
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260720001.2', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260720001', modality: 'CT', seriesDescription: '胸部增强', instanceCount: 120, studyDate: '2026-07-20' },
      ],
    },
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260315001', accessionNumber: 'ACC0315-011',
      studyDate: '2026-03-15', modality: 'CT', bodyPart: '胸部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260315001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260315001', modality: 'CT', seriesDescription: '胸部平扫', instanceCount: 112, studyDate: '2026-03-15' },
      ],
    },
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20251110001', accessionNumber: 'ACC1110-021',
      studyDate: '2025-11-10', modality: 'DR', bodyPart: '胸部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20251110001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20251110001', modality: 'DR', seriesDescription: '胸部正位', instanceCount: 2, studyDate: '2025-11-10' },
      ],
    },
  ],
  'P1002': [
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260728001', accessionNumber: 'ACC0728-004',
      studyDate: '2026-07-28', modality: 'MR', bodyPart: '头颅',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260728001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260728001', modality: 'MR', seriesDescription: 'T1 轴位', instanceCount: 40, studyDate: '2026-07-28' },
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260728001.2', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260728001', modality: 'MR', seriesDescription: 'T2 FLAIR 轴位', instanceCount: 40, studyDate: '2026-07-28' },
      ],
    },
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260402001', accessionNumber: 'ACC0402-019',
      studyDate: '2026-04-02', modality: 'CT', bodyPart: '头颅',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260402001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260402001', modality: 'CT', seriesDescription: '头颅平扫', instanceCount: 96, studyDate: '2026-04-02' },
      ],
    },
  ],
  'P1003': [
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001', accessionNumber: 'ACC0802-002',
      studyDate: '2026-08-02', modality: 'CT', bodyPart: '腹部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001', modality: 'CT', seriesDescription: '腹部平扫', instanceCount: 132, studyDate: '2026-08-02' },
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001.2', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001', modality: 'CT', seriesDescription: '门静脉期', instanceCount: 132, studyDate: '2026-08-02' },
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001.3', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001', modality: 'CT', seriesDescription: '延迟期', instanceCount: 132, studyDate: '2026-08-02' },
      ],
    },
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260518001', accessionNumber: 'ACC0518-008',
      studyDate: '2026-05-18', modality: 'US', bodyPart: '腹部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260518001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260518001', modality: 'US', seriesDescription: '肝胆胰脾', instanceCount: 60, studyDate: '2026-05-18' },
      ],
    },
  ],
  'P1004': [
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260805001', accessionNumber: 'ACC0805-001',
      studyDate: '2026-08-05', modality: 'MG', bodyPart: '乳腺',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260805001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260805001', modality: 'MG', seriesDescription: 'CC 位', instanceCount: 4, studyDate: '2026-08-05' },
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260805001.2', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260805001', modality: 'MG', seriesDescription: 'MLO 位', instanceCount: 4, studyDate: '2026-08-05' },
      ],
    },
  ],
  'P1005': [
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260809001', accessionNumber: 'ACC0809-003',
      studyDate: '2026-08-09', modality: 'CT', bodyPart: '胸部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260809001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260809001', modality: 'CT', seriesDescription: '胸部平扫 1mm', instanceCount: 240, studyDate: '2026-08-09' },
      ],
    },
    {
      studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260530001', accessionNumber: 'ACC0530-012',
      studyDate: '2026-05-30', modality: 'CT', bodyPart: '胸部',
      series: [
        { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260530001.1', studyInstanceUid: '1.2.826.0.1.3680043.8.498.20260530001', modality: 'CT', seriesDescription: '胸部平扫 1mm', instanceCount: 236, studyDate: '2026-05-30' },
      ],
    },
  ],
}

const SESSIONS: SessionDto[] = [
  {
    id: 'ic-s-001', patientId: 'P1001', patientName: '张建国', name: '胸部结节随访对比',
    groupType: 'multi-timepoint',
    seriesGroups: [
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260720001.1', label: '2026-07 平扫', modality: 'CT' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260315001.1', label: '2026-03 平扫', modality: 'CT' },
    ],
    sync: { panZoom: true, wwwl: true, frame: true },
    createdAt: '2026-08-01T09:20:00.000Z', updatedAt: '2026-08-01T09:20:00.000Z',
  },
  {
    id: 'ic-s-002', patientId: 'P1003', patientName: '王德发', name: '肝脏三期动态对比',
    groupType: 'multi-series',
    seriesGroups: [
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001.2', label: '门静脉期', modality: 'CT' },
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260802001.3', label: '延迟期', modality: 'CT' },
    ],
    sync: { panZoom: true, wwwl: false, frame: true },
    createdAt: '2026-08-03T14:05:00.000Z', updatedAt: '2026-08-03T14:05:00.000Z',
  },
  {
    id: 'ic-s-003', patientId: 'P1004', patientName: '赵丽华', name: '乳腺 MG/MR 多模态',
    groupType: 'multi-modality',
    seriesGroups: [
      { seriesInstanceUid: '1.2.826.0.1.3680043.8.498.20260805001.1', label: 'MG CC 位', modality: 'MG' },
    ],
    sync: { panZoom: false, wwwl: false, frame: false },
    createdAt: '2026-08-06T10:40:00.000Z', updatedAt: '2026-08-06T10:40:00.000Z',
  },
]

let sessionSeq = 100

/** 确定性差异指标: 由 seriesA/B + sliceIndex 派生统计, 同输入恒同输出 */
function diffFor(seriesA: string, seriesB: string, sliceIndex: number, _threshold: number): {
  width: number; height: number; pixelCount: number
  meanA: number; meanB: number; meanDiff: number
  varianceA: number; varianceB: number; varianceDiff: number
  stdDevA: number; stdDevB: number
  histogramDiff: number; hotRegionRatio: number
  changedPixelCount: number
  histogram: Array<{ bin: number; value: number; countA: number; countB: number }>
} {
  let h = 2166136261
  const seedStr = `${seriesA}|${seriesB}|${sliceIndex}`
  for (let i = 0; i < seedStr.length; i++) {
    h ^= seedStr.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  const u = (n: number) => ((h >>> n) & 0x3ff) / 1023
  const width = 512
  const height = 512
  const pixelCount = width * height
  const meanA = 48 + Math.round(u(1) * 60)
  const meanB = 48 + Math.round(u(5) * 60)
  const meanDiff = meanB - meanA
  const varianceA = 220 + Math.round(u(9) * 500)
  const varianceB = 220 + Math.round(u(13) * 500)
  const varianceDiff = varianceB - varianceA
  const stdDevA = Math.round(Math.sqrt(varianceA) * 10) / 10
  const stdDevB = Math.round(Math.sqrt(varianceB) * 10) / 10
  const histogramDiff = Math.round(u(17) * 40)
  const hotRegionRatio = Math.round((0.02 + u(21) * 0.1) * 10000) / 10000
  const changedPixelCount = Math.round(pixelCount * (0.01 + u(25) * 0.06))
  const bins = 12
  const histogram: Array<{ bin: number; value: number; countA: number; countB: number }> = []
  let total = 0
  for (let i = 0; i < bins; i++) {
    const countA = Math.round(2000 - Math.abs(i - 5) * 350 + u(i + 29) * 500)
    const countB = Math.round(2000 - Math.abs(i - 5) * 350 + u(i + 41) * 500)
    total += Math.abs(countB - countA)
    histogram.push({ bin: i, value: countB - countA, countA, countB })
  }
  return {
    width, height, pixelCount, meanA, meanB, meanDiff,
    varianceA, varianceB, varianceDiff, stdDevA, stdDevB,
    histogramDiff, hotRegionRatio, changedPixelCount, histogram,
  }
}

export const imagingCompareHandlers = [
  http.get(`${API}/patients`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const keyword = url.searchParams.get('keyword') ?? ''
    const items = keyword
      ? PATIENTS.filter((p) => p.name.includes(keyword) || p.patientId.includes(keyword))
      : PATIENTS
    return HttpResponse.json({ success: true, data: items })
  }),

  http.get(`${API}/patients/:patientId/studies`, async ({ params }) => {
    await delay(40)
    const patientId = String(params.patientId)
    const studies = STUDIES[patientId] ?? []
    return HttpResponse.json({ success: true, data: { patientId, studies, source: 'seed' as const } })
  }),

  http.get(`${API}/sessions`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const patientId = url.searchParams.get('patientId')
    const items = patientId ? SESSIONS.filter((s) => s.patientId === patientId) : SESSIONS
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/sessions`, async ({ request }) => {
    await delay(40)
    const body = (await request.json()) as { patientId?: string; name?: string; seriesGroups?: Array<{ seriesInstanceUid: string; label?: string; modality?: string }> }
    const patient = PATIENTS.find((p) => p.patientId === body?.patientId) ?? PATIENTS[0]!
    const groups = (body?.seriesGroups ?? []).map((g, i) => ({
      seriesInstanceUid: g.seriesInstanceUid,
      label: g.label ?? `序列 ${i + 1}`,
      modality: g.modality ?? 'CT',
    }))
    const now = new Date().toISOString()
    const session: SessionDto = {
      id: `ic-s-${sessionSeq++}`,
      patientId: patient.patientId,
      patientName: patient.name,
      name: body?.name ?? `${patient.name} 对比`,
      groupType: groups.length > 2 ? 'multi-modality' : groups.length > 1 ? 'multi-series' : 'multi-timepoint',
      seriesGroups: groups,
      sync: { panZoom: true, wwwl: true, frame: true },
      createdAt: now,
      updatedAt: now,
    }
    SESSIONS.unshift(session)
    return HttpResponse.json({ success: true, data: session })
  }),

  http.get(`${API}/sessions/:id`, async ({ params }) => {
    await delay(40)
    const session = SESSIONS.find((s) => s.id === params.id)
    if (!session) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `session ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: session })
  }),

  http.delete(`${API}/sessions/:id`, async ({ params }) => {
    await delay(40)
    const idx = SESSIONS.findIndex((s) => s.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `session ${params.id} not found` } }, { status: 404 })
    SESSIONS.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { id: params.id, deleted: true } })
  }),

  http.get(`${API}/sessions/:id/sync`, async ({ params }) => {
    await delay(40)
    const session = SESSIONS.find((s) => s.id === params.id)
    if (!session) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `session ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: { sessionId: session.id, sync: session.sync } })
  }),

  http.patch(`${API}/sessions/:id/sync`, async ({ params, request }) => {
    await delay(40)
    const session = SESSIONS.find((s) => s.id === params.id)
    if (!session) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `session ${params.id} not found` } }, { status: 404 })
    const patch = (await request.json()) as Partial<SyncState>
    session.sync = { ...session.sync, ...patch }
    session.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: session })
  }),

  http.post(`${API}/sessions/:id/difference`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { seriesA?: string; seriesB?: string; sliceIndex?: number; threshold?: number }
    const seriesA = body?.seriesA ?? 'series-A'
    const seriesB = body?.seriesB ?? 'series-B'
    const sliceIndex = body?.sliceIndex ?? 0
    const threshold = body?.threshold ?? 0.02
    const m = diffFor(seriesA, seriesB, sliceIndex, threshold)
    return HttpResponse.json({
      success: true,
      data: {
        seriesA, seriesB, sliceIndex,
        threshold,
        source: 'seed' as const,
        ...m,
      },
    })
  }),
]
