/**
 * G005 RIS v3.0.6.11-62 - /api/v1/dbt/* MSW handlers
 * DBT 乳腺断层: 确定性像素算法生成 (与 backend dicom-samples/DBT 同源),
 * 15 层 512x512, 0°/+15°/-15° 角度, 纤维腺体密度 + 微钙化亮点
 */
import { http, HttpResponse, delay } from 'msw'

const API = '/api/v1/dbt'

const delayMs = (min = 40, max = 140) => Math.floor(Math.random() * (max - min) + min)

// ────────────────────────────────────────────────────────────────────────────
// 确定性像素生成 (与 backend scripts/generate-dicom-samples.ts makeDbtSlice 同源)
// ────────────────────────────────────────────────────────────────────────────

function noise2(x: number, y: number, seed: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return (s - Math.floor(s)) * 2 - 1
}

const CLUSTERS: Array<[number, number, number]> = [
  [-150, -40, 1.0], [90, 20, 0.85], [-60, 140, 1.2], [30, -180, 0.9],
  [170, -120, 1.1], [-200, 60, 1.0], [-10, -60, 1.3], [140, 180, 0.95],
]

function dbtValue(x: number, y: number, layer: number, side: 'L' | 'R', seed: number, aged: boolean): number {
  const n = noise2(x * 0.04, y * 0.04, seed)
  const n2 = noise2(x * 0.14, y * 0.14, seed + 17)
  const n3 = noise2(x * 0.5, y * 0.5, seed + 41)
  const lob = noise2(x * 0.06, y * 0.06, seed + 7)
  let sig = 320 + n * 40
  const dir = side === 'R' ? 1 : -1
  const cx = 256 + dir * 120
  const cy = 300
  const bx = (x - cx) * dir
  const by = y - cy
  const e = (bx / (256 * 1.45)) ** 2 + (by / (256 * 1.75)) ** 2
  if (e < 1) {
    const t = 1 - Math.sqrt(e)
    sig = 620 + 260 * t + n * 90
    const bxs = bx - (layer - 0.5) * 26 * dir
    const bxe = (bxs / (256 * 1.45)) ** 2 + (by / (256 * 1.75)) ** 2
    const te = Math.max(0, 1 - Math.sqrt(bxe))
    sig += 420 * Math.pow(te, 1.6) * (0.55 + 0.45 * n2)
    sig += 90 * Math.abs(Math.sin(bxs * 0.02 + by * 0.015 + 0.6 * Math.log(te + 1))) * (0.5 + 0.5 * n3)
    if (lob > 0.35) sig -= 220 * (lob - 0.35) / 0.65
    if (t < 0.045) sig += 380
    for (const [ox, oy, r] of CLUSTERS) {
      const ddx = bx - ox
      const ddy = by - oy
      const d = Math.sqrt(ddx * ddx + ddy * ddy)
      const size = 6 * r
      if (d < size) {
        const k = 1 - d / size
        sig += 3000 * k * k
      }
    }
  }
  sig += 60 * Math.sin(layer * Math.PI * 2 + (x + y) * 0.01)
  let v = Math.round(Math.max(0, Math.min(4095, sig)))
  if (aged) v = Math.round(v * 0.94 + 30)
  return v
}

const SIZE = 512

function int16ToBase64(arr: Int16Array): string {
  const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + CHUNK)) as number[])
  }
  return btoa(bin)
}

/** 生成某系列全部切片的 Int16 网格 (缓存) */
function seriesGrids(key: string, side: 'L' | 'R', seed: number, aged: boolean, count = 15): Int16Array[] {
  const cached = gridCache.get(key)
  if (cached) return cached
  const grids: Int16Array[] = []
  for (let i = 0; i < count; i++) {
    const layer = count > 1 ? i / (count - 1) : 0
    const g = new Int16Array(SIZE * SIZE)
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        g[y * SIZE + x] = dbtValue(x, y, layer, side, seed, aged)
      }
    }
    grids.push(g)
  }
  gridCache.set(key, grids)
  return grids
}

// ────────────────────────────────────────────────────────────────────────────
// 目录数据
// ────────────────────────────────────────────────────────────────────────────

interface SeriesDef {
  key: string
  seriesInstanceUid: string
  seriesNumber: number
  laterality: 'L' | 'R'
  viewPosition: string
  seed: number
  aged: boolean
}

interface StudyDef {
  id: string
  studyInstanceUid: string
  patientName: string
  patientId: string
  patientSex: string
  patientBirthDate: string
  studyDate: string
  studyTime: string
  studyDescription: string
  accessionNumber: string
  isCurrent: boolean
  priorStudyId?: string
  series: SeriesDef[]
}

const CURRENT_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.20260310.ACC-SAMPLE-0005'
const PRIOR_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.20251102.ACC-SAMPLE-0006'

const STUDIES: StudyDef[] = [
  {
    id: 'DBT-STUDY-CURRENT',
    studyInstanceUid: CURRENT_UID,
    patientName: 'CHEN^DBT01',
    patientId: 'P0000005',
    patientSex: 'F',
    patientBirthDate: '19780819',
    studyDate: '20260310',
    studyTime: '093020',
    studyDescription: 'BREAST TOMOSYNTHESIS',
    accessionNumber: 'ACC-SAMPLE-0005',
    isCurrent: true,
    priorStudyId: 'DBT-STUDY-PRIOR',
    series: [
      { key: 'DBT-STUDY-CURRENT:L', seriesInstanceUid: `${CURRENT_UID}.S.5`, seriesNumber: 5, laterality: 'L', viewPosition: 'LCC', seed: 91, aged: false },
      { key: 'DBT-STUDY-CURRENT:R', seriesInstanceUid: `${CURRENT_UID}.S.6`, seriesNumber: 6, laterality: 'R', viewPosition: 'RCC', seed: 92, aged: false },
    ],
  },
  {
    id: 'DBT-STUDY-PRIOR',
    studyInstanceUid: PRIOR_UID,
    patientName: 'CHEN^DBT01',
    patientId: 'P0000005',
    patientSex: 'F',
    patientBirthDate: '19780819',
    studyDate: '20251102',
    studyTime: '100415',
    studyDescription: 'BREAST TOMOSYNTHESIS',
    accessionNumber: 'ACC-SAMPLE-0006',
    isCurrent: false,
    series: [
      { key: 'DBT-STUDY-PRIOR:L', seriesInstanceUid: `${PRIOR_UID}.S.7`, seriesNumber: 7, laterality: 'L', viewPosition: 'LCC', seed: 93, aged: true },
      { key: 'DBT-STUDY-PRIOR:R', seriesInstanceUid: `${PRIOR_UID}.S.8`, seriesNumber: 8, laterality: 'R', viewPosition: 'RCC', seed: 94, aged: true },
    ],
  },
]

const gridCache = new Map<string, Int16Array[]>()

const SERIES_COUNT = 15
const ANGLES = Array.from({ length: SERIES_COUNT }, (_, i) => Number((((i - 7) / 7) * 15).toFixed(2)))

function studyToDto(study: StudyDef) {
  return {
    id: study.id,
    studyInstanceUid: study.studyInstanceUid,
    patientName: study.patientName,
    patientId: study.patientId,
    patientSex: study.patientSex,
    patientBirthDate: study.patientBirthDate,
    studyDate: study.studyDate,
    studyTime: study.studyTime,
    studyDescription: study.studyDescription,
    accessionNumber: study.accessionNumber,
    isCurrent: study.isCurrent,
    priorStudyId: study.priorStudyId,
    series: study.series.map((s) => ({
      seriesInstanceUid: s.seriesInstanceUid,
      seriesNumber: s.seriesNumber,
      laterality: s.laterality,
      viewPosition: s.viewPosition,
      sliceCount: SERIES_COUNT,
      rows: SIZE,
      columns: SIZE,
      sliceThickness: 1,
      pixelSpacing: '0.1\\0.1',
      windowCenter: 1600,
      windowWidth: 2400,
      source: 'sample' as const,
    })),
  }
}

function buildSlices(studyId: string, seriesUid?: string) {
  const study = STUDIES.find((s) => s.id === studyId)
  if (!study) return null
  const targets = seriesUid ? study.series.filter((s) => s.seriesInstanceUid === seriesUid) : study.series
  const slices: Array<Record<string, unknown>> = []
  for (const t of targets) {
    const grids = seriesGrids(t.key, t.laterality, t.seed, t.aged, SERIES_COUNT)
    for (let i = 0; i < SERIES_COUNT; i++) {
      slices.push({
        instanceNumber: i + 1,
        sopInstanceUid: `${t.seriesInstanceUid}.${String(i + 1).padStart(4, '0')}`,
        sliceLocation: Number(((i - (SERIES_COUNT - 1) / 2) * 1).toFixed(2)),
        tomoAngle: ANGLES[i],
        sliceThickness: 1,
        rows: SIZE,
        columns: SIZE,
        pixelData: {
          dataBase64: int16ToBase64(grids[i]!),
          bitsAllocated: 16,
          signed: true,
          width: SIZE,
          height: SIZE,
        },
      })
    }
  }
  return { study: studyToDto(study), slices }
}

function buildReconstruct(studyId: string, body: { seriesInstanceUid?: string; projection?: 'mip' | 'mean'; thickness?: number }) {
  const study = STUDIES.find((s) => s.id === studyId)
  if (!study) return null
  const target = body.seriesInstanceUid ? study.series.find((s) => s.seriesInstanceUid === body.seriesInstanceUid) : study.series[0]
  if (!target) return null
  const grids = seriesGrids(target.key, target.laterality, target.seed, target.aged, SERIES_COUNT)
  const projection = body.projection === 'mean' ? 'mean' : 'mip'
  const thickness = body.thickness && body.thickness > 0 ? Math.min(SERIES_COUNT, Math.round(body.thickness)) : SERIES_COUNT
  const start = Math.max(0, Math.floor((SERIES_COUNT - thickness) / 2))
  const end = Math.min(SERIES_COUNT - 1, start + thickness - 1)
  const out = new Int16Array(SIZE * SIZE)
  if (projection === 'mip') out.fill(-32768)
  for (let i = start; i <= end; i++) {
    const g = grids[i]!
    for (let p = 0; p < SIZE * SIZE; p++) {
      if (projection === 'mip') {
        if (g[p]! > out[p]!) out[p] = g[p]!
      } else {
        out[p] = Math.round((out[p]! * (i - start) + g[p]!) / (i - start + 1))
      }
    }
  }
  return {
    studyId,
    seriesInstanceUid: target.seriesInstanceUid,
    projection,
    thickness,
    source: 'synthetic' as const,
    width: SIZE,
    height: SIZE,
    windowWidth: 2400,
    windowLevel: 1600,
    pixelData: { dataBase64: int16ToBase64(out), bitsAllocated: 16, signed: true, width: SIZE, height: SIZE },
  }
}

// ────────────────────────────────────────────────────────────────────────────

export const dbtHandlers = [
  http.get(`${API}/studies`, async () => {
    await delay(delayMs())
    return HttpResponse.json({ success: true, data: STUDIES.map(studyToDto) })
  }),

  http.get(`${API}/studies/:id/slices`, async ({ params, request }) => {
    await delay(delayMs(60, 200))
    const id = String(params.id)
    const url = new URL(request.url)
    const series = url.searchParams.get('series') ?? undefined
    const result = buildSlices(id, series)
    if (!result) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `DBT study ${id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: result })
  }),

  http.post(`${API}/studies/:id/reconstruct`, async ({ params, request }) => {
    await delay(delayMs(80, 240))
    const id = String(params.id)
    const body = await request.json().catch(() => ({})) as { seriesInstanceUid?: string; projection?: 'mip' | 'mean'; thickness?: number }
    const result = buildReconstruct(id, body)
    if (!result) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `DBT study ${id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: result })
  }),

  http.post(`${API}/compare`, async ({ request }) => {
    await delay(delayMs(60, 180))
    const body = await request.json().catch(() => ({})) as { currentStudyId?: string; priorStudyId?: string }
    const current = STUDIES.find((s) => s.id === body.currentStudyId && s.isCurrent)
    const prior = STUDIES.find((s) => s.id === body.priorStudyId && !s.isCurrent)
    if (!current || !prior) {
      return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'current/prior DBT study not found' } }, { status: 404 })
    }
    const lateralityMap = current.series.map((cs) => ({
      laterality: cs.laterality,
      currentSeries: cs.seriesInstanceUid,
      priorSeries: prior.series.find((ps) => ps.laterality === cs.laterality)?.seriesInstanceUid,
    }))
    return HttpResponse.json({ success: true, data: { current: studyToDto(current), prior: studyToDto(prior), lateralityMap } })
  }),

  // [G-21 Wave3C] 微钙化特征 → BI-RADS 自动评分 (与后端 dbt.service scoreBirads 规则对齐)
  http.post(`${API}/:id/birads-score`, async ({ params, request }) => {
    await delay(delayMs(80, 220))
    const id = String(params.id)
    const study = STUDIES.find((s) => s.id === id)
    if (!study) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `DBT study ${id} not found` } }, { status: 404 })
    const body = await request.json().catch(() => ({})) as {
      calcifications?: Array<{ count: number; distribution: string; morphology?: string }>
      mass?: { size: number; shape: string; margin: string }
    }
    const calcifications = body.calcifications ?? []
    const mass = body.mass
    const basis: string[] = []
    let rank = 1
    let category = '1'
    const distLabels: Record<string, string> = { clustered: '簇状', linear: '线样', segmental: '段样', regional: '区域', diffuse: '弥漫' }
    const morphLabels: Record<string, string> = { punctate: '点状', round: '圆形', amorphous: '无定形', coarse_heterogeneous: '粗糙不均质', fine_pleomorphic: '细小多形性', fine_linear: '细小线样', popcorn: '爆米花样', coarse: '粗大' }
    for (const c of calcifications) {
      if (c.count <= 0) continue
      const dist = distLabels[c.distribution] ?? c.distribution
      const morph = c.morphology ? (morphLabels[c.morphology] ?? c.morphology) : ''
      const prefix = `${c.count} 枚${dist}微钙化${morph ? morph : ''}`
      if (c.morphology === 'fine_linear' || c.morphology === 'fine_pleomorphic') {
        rank = Math.max(rank, 6); category = rank >= 7 ? category : '4C'
        basis.push(`${prefix} → BI-RADS 4C 类 (细小线样/多形性, 高度可疑)`)
      } else if (c.morphology === 'amorphous' || c.morphology === 'coarse_heterogeneous') {
        rank = Math.max(rank, 5); category = rank >= 6 ? category : '4B'
        basis.push(`${prefix} → BI-RADS 4B 类 (可疑形态学特征)`)
      } else if (c.distribution === 'linear' || c.distribution === 'segmental') {
        rank = Math.max(rank, 4); category = rank >= 5 ? category : '4A'
        basis.push(`${prefix} → BI-RADS 4A 类 (可疑分布, 形态良性)`)
      } else {
        rank = Math.max(rank, 2); category = rank >= 3 ? category : '2'
        basis.push(`${prefix} → BI-RADS 2 类 (典型良性)`)
      }
    }
    if (mass) {
      const shape = mass.shape === 'round' ? '圆形' : mass.shape === 'oval' ? '卵圆形' : '不规则形'
      const margin = mass.margin === 'circumscribed' ? '清晰' : mass.margin === 'microlobulated' ? '微分叶' : mass.margin === 'indistinct' ? '模糊' : '毛刺'
      const desc = `${mass.size}mm ${shape}肿块, 边缘${margin}`
      if (mass.margin === 'spiculated') {
        rank = Math.max(rank, 7); category = '5'
        basis.push(`${desc} → BI-RADS 5 类 (毛刺状边缘, 高度怀疑恶性)`)
      } else if (mass.shape === 'irregular') {
        rank = Math.max(rank, 6); category = rank >= 7 ? category : '4C'
        basis.push(`${desc} → BI-RADS 4C 类 (不规则形态, 高度可疑)`)
      } else if (mass.margin === 'microlobulated' || mass.margin === 'indistinct') {
        rank = Math.max(rank, 5); category = rank >= 6 ? category : '4B'
        basis.push(`${desc} → BI-RADS 4B 类 (可疑边缘特征)`)
      } else if (mass.size >= 25) {
        rank = Math.max(rank, 3); category = rank >= 4 ? category : '3'
        basis.push(`${desc} → BI-RADS 3 类 (体积较大, 建议短期随访)`)
      } else {
        rank = Math.max(rank, 2); category = rank >= 3 ? category : '2'
        basis.push(`${desc} → BI-RADS 2 类 (典型良性)`)
      }
    }
    if (calcifications.every((c) => c.count <= 0) && !mass) {
      category = '0'
      basis.push('本次检查未提供微钙化/肿块特征, 需补充影像评估')
    }
    const catInfo: Record<string, { label: string; risk: string; recommendation: string }> = {
      '0': { label: 'BI-RADS 0 类', risk: '无法评估', recommendation: '需补充影像评估(如放大摄影、断层或超声)' },
      '1': { label: 'BI-RADS 1 类', risk: '阴性(恶性可能 0%)', recommendation: '常规筛查随访' },
      '2': { label: 'BI-RADS 2 类', risk: '良性发现(恶性可能 0%)', recommendation: '常规筛查随访' },
      '3': { label: 'BI-RADS 3 类', risk: '可能良性(恶性可能 0-2%)', recommendation: '建议 6 个月短期随访' },
      '4A': { label: 'BI-RADS 4A 类', risk: '低度可疑(恶性可能 2-10%)', recommendation: '建议穿刺活检' },
      '4B': { label: 'BI-RADS 4B 类', risk: '中度可疑(恶性可能 10-50%)', recommendation: '建议穿刺活检' },
      '4C': { label: 'BI-RADS 4C 类', risk: '高度可疑(恶性可能 50-95%)', recommendation: '建议穿刺活检或手术切除' },
      '5': { label: 'BI-RADS 5 类', risk: '高度怀疑恶性(恶性可能 >95%)', recommendation: '建议活检并临床干预' },
    }
    const info = catInfo[category] ?? { label: 'BI-RADS 0 类', risk: '无法评估', recommendation: '需补充影像评估(如放大摄影、断层或超声)' }
    return HttpResponse.json({
      success: true,
      data: {
        studyId: id,
        category,
        categoryLabel: info.label,
        malignancyRisk: info.risk,
        recommendation: info.recommendation,
        basis,
        features: {
          calcifications: calcifications.map((c) => ({ count: c.count, distribution: c.distribution, morphology: c.morphology })),
          ...(mass ? { mass: { size: mass.size, shape: mass.shape, margin: mass.margin } } : {}),
        },
        scoredAt: new Date().toISOString(),
      },
    })
  }),

  // [G-21 Wave3C] 已有 BI-RADS 评分查询 (mock 内存态: 最近一次评分)
  http.get(`${API}/:id/birads-score`, async () => {
    await delay(delayMs(40, 120))
    return HttpResponse.json({ success: true, data: { scored: false } })
  }),
]
