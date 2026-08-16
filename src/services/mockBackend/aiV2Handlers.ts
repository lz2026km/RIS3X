// [G005 Wave 5B v3.0.6.11-101] /api/v1/ai-v2 MSW handlers
// 对齐后端 ai-v2.module + aiV2Api:
//   organ-detection (analyze/results/:id/report-paragraph) + draft-score + smart-hanging + overview
// 响应形状: { success: true, data: <T> } (确定性, 与后端 seed 同口径)
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/ai-v2`

interface OrganItem {
  code: string
  label: string
  confidence: number
  bbox: { x: number; y: number; width: number; height: number }
  mask: { type: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
  volumeMl: number
  slices: number
  status: 'detected' | 'low-confidence'
  featureNote: string
}

interface OrganResult {
  id: string
  studyId: string
  modality: string
  bodyPart: string
  pixelStats: { mean: number; stddev: number; min: number; max: number; slices: number; width: number; height: number }
  organs: OrganItem[]
  organsDetected: number
  avgConfidence: number
  primaryOrgan: string | null
  modelVersion: string
  createdAt: string
}

interface DraftScoreResult {
  id: string
  modality: string | null
  score: number
  grade: '优' | '良' | '中' | '差'
  dimensions: Array<{ key: string; label: string; weight: number; score: number }>
  suggestions: Array<{ code: string; level: 'error' | 'warning' | 'info'; message: string }>
  stats: {
    charCount: number
    sectionCount: number
    numericCount: number
    unitCoverage: number
    informalTerms: string[]
    missingSections: string[]
    missingStandardTerms: string[]
    unnumberedValues: number
  }
  scoredAt: string
}

interface HangingCell { index: number; label: string; seriesKey: string; windowWidth?: number; windowCenter?: number }

interface HangingRecommendation {
  layoutId: string
  name: string
  rows: number
  cols: number
  cells: HangingCell[]
  score: number
  source: 'rule' | 'history'
  reasons: string[]
  matchedSeries: string[]
  alternatives: Array<{ layoutId: string; name: string; score: number }>
  recommendedAt: string
}

interface HangingApplication {
  id: string
  examId: string
  layoutId: string
  layoutName: string
  rows: number
  cols: number
  appliedBy: string
  appliedAt: string
}

const ORGAN_LIB: Array<{ code: string; label: string; featureNote: string }> = [
  { code: 'lung-right', label: '右肺', featureNote: '右侧肺野清晰, 未见实变' },
  { code: 'lung-left', label: '左肺', featureNote: '左侧肺野清晰, 未见实变' },
  { code: 'liver', label: '肝脏', featureNote: '肝实质密度均匀' },
  { code: 'spleen', label: '脾脏', featureNote: '脾脏大小形态未见异常' },
  { code: 'kidney-right', label: '右肾', featureNote: '右肾轮廓光滑' },
  { code: 'kidney-left', label: '左肾', featureNote: '左肾轮廓光滑' },
  { code: 'heart', label: '心脏', featureNote: '心影不大' },
  { code: 'aorta', label: '主动脉', featureNote: '主动脉未见增宽' },
]

const SEED_ORGAN_RESULTS: OrganResult[] = [
  {
    id: 'ai2-org-001', studyId: 'ST-20260718-001', modality: 'CT', bodyPart: '胸部',
    pixelStats: { mean: 42.5, stddev: 88.3, min: -1024, max: 1023, slices: 120, width: 512, height: 512 },
    organs: [
      { code: 'lung-right', label: '右肺', confidence: 0.97, bbox: { x: 320, y: 140, width: 160, height: 260 }, mask: { type: 'ellipse', cx: 400, cy: 270, rx: 78, ry: 128 }, volumeMl: 1310.5, slices: 90, status: 'detected', featureNote: '右肺野清晰, 上叶见 8mm 结节' },
      { code: 'lung-left', label: '左肺', confidence: 0.96, bbox: { x: 30, y: 140, width: 160, height: 260 }, mask: { type: 'ellipse', cx: 110, cy: 270, rx: 78, ry: 128 }, volumeMl: 1254.2, slices: 88, status: 'detected', featureNote: '左肺野清晰' },
      { code: 'heart', label: '心脏', confidence: 0.93, bbox: { x: 190, y: 210, width: 130, height: 150 }, mask: { type: 'ellipse', cx: 255, cy: 285, rx: 62, ry: 72 }, volumeMl: 812.4, slices: 60, status: 'detected', featureNote: '心影不大' },
      { code: 'aorta', label: '主动脉', confidence: 0.91, bbox: { x: 255, y: 90, width: 55, height: 120 }, mask: { type: 'ellipse', cx: 282, cy: 150, rx: 26, ry: 58 }, volumeMl: 96.8, slices: 40, status: 'detected', featureNote: '主动脉未见增宽' },
    ],
    organsDetected: 4,
    avgConfidence: Math.round((0.97 + 0.96 + 0.93 + 0.91) / 4 * 100) / 100,
    primaryOrgan: 'lung-right',
    modelVersion: 'ai-v2-organ-1.4.0',
    createdAt: '2026-07-18T09:30:00.000Z',
  },
  {
    id: 'ai2-org-002', studyId: 'ST-20260802-003', modality: 'CT', bodyPart: '腹部',
    pixelStats: { mean: 46.8, stddev: 82.1, min: -1024, max: 1023, slices: 132, width: 512, height: 512 },
    organs: [
      { code: 'liver', label: '肝脏', confidence: 0.98, bbox: { x: 220, y: 180, width: 160, height: 130 }, mask: { type: 'ellipse', cx: 300, cy: 245, rx: 78, ry: 62 }, volumeMl: 1420.8, slices: 70, status: 'detected', featureNote: '肝实质密度均匀' },
      { code: 'spleen', label: '脾脏', confidence: 0.95, bbox: { x: 420, y: 220, width: 70, height: 90 }, mask: { type: 'ellipse', cx: 455, cy: 265, rx: 34, ry: 44 }, volumeMl: 186.3, slices: 30, status: 'detected', featureNote: '脾脏大小形态未见异常' },
      { code: 'kidney-right', label: '右肾', confidence: 0.94, bbox: { x: 300, y: 300, width: 60, height: 90 }, mask: { type: 'ellipse', cx: 330, cy: 345, rx: 29, ry: 44 }, volumeMl: 142.6, slices: 26, status: 'detected', featureNote: '右肾轮廓光滑' },
      { code: 'kidney-left', label: '左肾', confidence: 0.93, bbox: { x: 150, y: 300, width: 60, height: 90 }, mask: { type: 'ellipse', cx: 180, cy: 345, rx: 29, ry: 44 }, volumeMl: 138.9, slices: 26, status: 'detected', featureNote: '左肾轮廓光滑' },
    ],
    organsDetected: 4,
    avgConfidence: 0.95,
    primaryOrgan: 'liver',
    modelVersion: 'ai-v2-organ-1.4.0',
    createdAt: '2026-08-02T11:10:00.000Z',
  },
]

const SEED_DRAFT_SCORES: DraftScoreResult[] = [
  {
    id: 'ai2-score-001', modality: 'CT', score: 82,
    grade: '良',
    dimensions: [
      { key: 'structure', label: '结构完整性', weight: 0.3, score: 88 },
      { key: 'terminology', label: '术语规范性', weight: 0.3, score: 80 },
      { key: 'numeric', label: '数值与单位', weight: 0.2, score: 76 },
      { key: 'conclusion', label: '结论一致性', weight: 0.2, score: 84 },
    ],
    suggestions: [
      { code: 'missing-unit', level: 'warning', message: '病灶尺寸缺少单位 mm' },
      { code: 'informal-term', level: 'warning', message: '存在非规范缩写: "cm"' },
    ],
    stats: { charCount: 486, sectionCount: 4, numericCount: 6, unitCoverage: 0.83, informalTerms: ['cm'], missingSections: ['随访建议'], missingStandardTerms: ['肺结节'], unnumberedValues: 1 },
    scoredAt: '2026-08-05T14:20:00.000Z',
  },
  {
    id: 'ai2-score-002', modality: 'MR', score: 91,
    grade: '优',
    dimensions: [
      { key: 'structure', label: '结构完整性', weight: 0.3, score: 94 },
      { key: 'terminology', label: '术语规范性', weight: 0.3, score: 92 },
      { key: 'numeric', label: '数值与单位', weight: 0.2, score: 90 },
      { key: 'conclusion', label: '结论一致性', weight: 0.2, score: 88 },
    ],
    suggestions: [],
    stats: { charCount: 610, sectionCount: 5, numericCount: 8, unitCoverage: 1, informalTerms: [], missingSections: [], missingStandardTerms: [], unnumberedValues: 0 },
    scoredAt: '2026-08-06T09:40:00.000Z',
  },
]

const SEED_APPLICATIONS: HangingApplication[] = [
  { id: 'ai2-hang-001', examId: 'EX-20260810-004', layoutId: 'L2x2', layoutName: '2×2 四格', rows: 2, cols: 2, appliedBy: 'u-001', appliedAt: '2026-08-10T10:05:00.000Z' },
]

let organResults: OrganResult[] = [...SEED_ORGAN_RESULTS]
let draftScores: DraftScoreResult[] = [...SEED_DRAFT_SCORES]
let applications: HangingApplication[] = [...SEED_APPLICATIONS]
let seq = 100

function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

const gradeOf = (score: number): '优' | '良' | '中' | '差' => (score >= 90 ? '优' : score >= 80 ? '良' : score >= 60 ? '中' : '差')

function analyzeBody(studyId: string, modality: string, bodyPart?: string): OrganResult {
  const seed = hash01(`${studyId}|${modality}|${bodyPart ?? ''}`)
  const count = 3 + Math.floor(seed * 3)
  const organs: OrganItem[] = []
  for (let i = 0; i < count; i++) {
    const lib = ORGAN_LIB[(i * 2 + Math.floor(seed * 3)) % ORGAN_LIB.length]!
    const cx = 80 + Math.floor(hash01(`${studyId}|o${i}|x`) * 350)
    const cy = 80 + Math.floor(hash01(`${studyId}|o${i}|y`) * 350)
    const rx = 25 + Math.floor(hash01(`${studyId}|o${i}|rx`) * 60)
    const ry = 25 + Math.floor(hash01(`${studyId}|o${i}|ry`) * 60)
    const confidence = Math.round((0.88 + hash01(`${studyId}|o${i}|c`) * 0.11) * 100) / 100
    organs.push({
      code: lib.code, label: lib.label, confidence,
      bbox: { x: cx - rx, y: cy - ry, width: rx * 2, height: ry * 2 },
      mask: { type: 'ellipse', cx, cy, rx, ry },
      volumeMl: Math.round(rx * ry * 0.02 * 100) / 100,
      slices: 20 + Math.floor(hash01(`${studyId}|o${i}|s`) * 60),
      status: confidence >= 0.92 ? 'detected' : 'low-confidence',
      featureNote: lib.featureNote,
    })
  }
  const avgConfidence = Math.round(organs.reduce((s, o) => s + o.confidence, 0) / Math.max(1, organs.length) * 100) / 100
  return {
    id: `ai2-org-${seq++}`,
    studyId,
    modality,
    bodyPart: bodyPart ?? '胸部',
    pixelStats: { mean: Math.round((30 + seed * 40) * 10) / 10, stddev: Math.round((70 + seed * 40) * 10) / 10, min: -1024, max: 1023, slices: 100 + Math.floor(seed * 60), width: 512, height: 512 },
    organs,
    organsDetected: organs.filter((o) => o.status === 'detected').length,
    avgConfidence,
    primaryOrgan: organs[0]?.code ?? null,
    modelVersion: 'ai-v2-organ-1.4.0',
    createdAt: new Date().toISOString(),
  }
}

function scoreDraft(text: string, modality?: string | null, expectedSections?: string[]): DraftScoreResult {
  const charCount = text.length
  const sectionCount = Math.max(1, Math.min(6, Math.floor(charCount / 90) + 1))
  const numericCount = (text.match(/\d+(\.\d+)?/g) ?? []).length
  const unitCoverage = Math.round((numericCount > 0 ? 0.6 + Math.min(0.4, numericCount * 0.05) : 1) * 100) / 100
  const hasFollowup = text.includes('随访')
  const missingSections = expectedSections ? expectedSections.filter((s) => !text.includes(s)) : []
  if (!hasFollowup) missingSections.push('随访建议')
  const score = Math.round(Math.max(40, Math.min(96, 88 - missingSections.length * 6 - (unitCoverage < 0.9 ? 4 : 0) - (charCount < 300 ? 6 : 0))))
  return {
    id: `ai2-score-${seq++}`,
    modality: modality ?? null,
    score,
    grade: gradeOf(score),
    dimensions: [
      { key: 'structure', label: '结构完整性', weight: 0.3, score: Math.min(100, score + 4) },
      { key: 'terminology', label: '术语规范性', weight: 0.3, score: score },
      { key: 'numeric', label: '数值与单位', weight: 0.2, score: Math.max(0, score - 6) },
      { key: 'conclusion', label: '结论一致性', weight: 0.2, score: Math.min(100, score + 2) },
    ],
    suggestions: [
      ...(unitCoverage < 0.9 ? [{ code: 'missing-unit', level: 'warning' as const, message: '存在数值缺少单位' }] : []),
      ...(missingSections.length > 0 ? [{ code: 'missing-section', level: 'warning' as const, message: `缺少段落: ${missingSections.join(', ')}` }] : []),
    ],
    stats: { charCount, sectionCount, numericCount, unitCoverage, informalTerms: [], missingSections, missingStandardTerms: [], unnumberedValues: 0 },
    scoredAt: new Date().toISOString(),
  }
}

function recommendHanging(modality: string, bodyPart: string, series: Array<{ description?: string; seriesNumber?: number; images?: number }>): HangingRecommendation {
  const n = Math.max(1, series.length)
  const rows = n >= 4 ? 2 : 1
  const cols = n >= 4 ? 2 : n
  const layoutId = `${rows}x${cols}`
  const layoutName = `${rows}×${cols} ${rows === 2 ? '四格' : '单行'}`
  const cells: HangingCell[] = series.map((s, i) => ({
    index: i + 1,
    label: s.description ?? `序列 ${s.seriesNumber ?? i + 1}`,
    seriesKey: `series-${i + 1}`,
    windowWidth: modality === 'CT' ? 400 : modality === 'MR' ? 800 : undefined,
    windowCenter: modality === 'CT' ? 60 : modality === 'MR' ? 400 : undefined,
  }))
  return {
    layoutId,
    name: layoutName,
    rows,
    cols,
    cells,
    score: Math.round((0.85 + hash01(`${modality}|${bodyPart}`) * 0.14) * 100) / 100,
    source: 'rule',
    reasons: [`${modality} ${bodyPart} 检查 ${n} 个序列`, '按部位/序列自动布局'],
    matchedSeries: series.map((_, i) => `series-${i + 1}`),
    alternatives: [
      { layoutId: '1x1', name: '1×1 单图', score: 0.6 },
      { layoutId: '2x2', name: '2×2 四格', score: 0.8 },
    ],
    recommendedAt: new Date().toISOString(),
  }
}

export const aiV2Handlers = [
  // ── 多器官自动检出 ──
  http.post(`${API}/organ-detection/analyze`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { studyId?: string; modality?: string; bodyPart?: string }
    const result = analyzeBody(body?.studyId ?? 'ST-UNKNOWN', body?.modality ?? 'CT', body?.bodyPart)
    organResults.unshift(result)
    return HttpResponse.json({ success: true, data: result })
  }),

  http.get(`${API}/organ-detection/results`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: organResults })
  }),

  http.get(`${API}/organ-detection/results/:id`, async ({ params }) => {
    await delay(40)
    const result = organResults.find((r) => r.id === params.id)
    if (!result) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `organ result ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: result })
  }),

  http.post(`${API}/organ-detection/:id/report-paragraph`, async ({ params }) => {
    await delay(80)
    const result = organResults.find((r) => r.id === params.id)
    const organs = result?.organs ?? []
    const paragraph = organs.length
      ? `影像所见: 自动检出 ${organs.length} 个器官结构。${organs.map((o) => `${o.label}${o.status === 'detected' ? '' : '(低置信度)'}${o.featureNote ? `, ${o.featureNote}` : ''}`).join('; ')}。`
      : '影像所见: 未检出可描述的器官结构。'
    return HttpResponse.json({ success: true, data: { id: `ai2-para-${seq++}`, studyId: result?.studyId ?? '', paragraph, organCount: organs.length, generatedAt: new Date().toISOString() } })
  }),

  // ── 报告草稿评分 ──
  http.post(`${API}/draft-score`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { draftText?: string; modality?: string; expectedSections?: string[] }
    const result = scoreDraft(body?.draftText ?? '', body?.modality ?? null, body?.expectedSections)
    draftScores.unshift(result)
    return HttpResponse.json({ success: true, data: result })
  }),

  http.get(`${API}/draft-score/results`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: draftScores })
  }),

  http.get(`${API}/draft-score/results/:id`, async ({ params }) => {
    await delay(40)
    const result = draftScores.find((r) => r.id === params.id)
    if (!result) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `draft score ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: result })
  }),

  // ── 智能挂片 ──
  http.post(`${API}/smart-hanging/recommend`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { modality?: string; bodyPart?: string; series?: Array<{ description?: string; seriesNumber?: number; images?: number }> }
    const rec = recommendHanging(body?.modality ?? 'CT', body?.bodyPart ?? '胸部', body?.series ?? [{ description: '默认序列' }])
    return HttpResponse.json({ success: true, data: rec })
  }),

  http.post(`${API}/smart-hanging/apply`, async ({ request }) => {
    await delay(40)
    const body = (await request.json()) as { examId?: string; layoutId?: string; appliedBy?: string }
    const app: HangingApplication = {
      id: `ai2-hang-${seq++}`,
      examId: body?.examId ?? 'EX-UNKNOWN',
      layoutId: body?.layoutId ?? '1x1',
      layoutName: body?.layoutId === '2x2' ? '2×2 四格' : '1×1 单图',
      rows: body?.layoutId === '2x2' ? 2 : 1,
      cols: body?.layoutId === '2x2' ? 2 : 1,
      appliedBy: body?.appliedBy ?? 'u-001',
      appliedAt: new Date().toISOString(),
    }
    applications.unshift(app)
    return HttpResponse.json({ success: true, data: app })
  }),

  http.get(`${API}/smart-hanging/applications`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: applications })
  }),

  http.get(`${API}/smart-hanging/rules`, async () => {
    await delay(40)
    return HttpResponse.json({
      success: true,
      data: [
        { id: 'rule-01', name: '胸部 CT 平扫 2×2', match: { modality: 'CT', bodyPart: '胸部' }, layout: '2x2' },
        { id: 'rule-02', name: '头颅 MR 4 序列 2×2', match: { modality: 'MR', bodyPart: '头颅' }, layout: '2x2' },
        { id: 'rule-03', name: '单序列 1×1', match: {}, layout: '1x1' },
      ],
    })
  }),

  // ── 总览 ──
  http.get(`${API}/overview`, async () => {
    await delay(40)
    return HttpResponse.json({
      success: true,
      data: {
        organDetection: { total: organResults.length, avgConfidence: Math.round(organResults.reduce((s, r) => s + r.avgConfidence, 0) / Math.max(1, organResults.length) * 100) / 100 },
        draftScore: { total: draftScores.length, avgScore: Math.round(draftScores.reduce((s, r) => s + r.score, 0) / Math.max(1, draftScores.length) * 10) / 10 },
        hanging: { applications: applications.length },
        modelVersion: 'ai-v2-1.4.0',
      },
    })
  }),
]
