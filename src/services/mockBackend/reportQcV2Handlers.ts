// [G005 Wave 6B v3.0.6.11-101] /api/v1/report-qc-v2 MSW handlers
// 对齐后端 report-qc-v2.module + reportQcV2Api (多维评分 + 质控任务流 + 二次复核 + 统计, 孤儿模块 → seeded=true)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-qc-v2`

type QcDimensionKey = 'completeness' | 'normativity' | 'accuracy' | 'readability' | 'timeliness'
type QcGrade = 'A' | 'B' | 'C' | 'D'
type DefectSeverity = 'high' | 'medium' | 'low'
type QcTaskStatus = 'pending' | 'in_progress' | 'reviewing' | 'closed'
type ReviewOpinion = 'pass' | 'return'

interface DimensionMeta {
  key: QcDimensionKey
  label: string
  labelEn: string
  max: number
  color: string
  subItems: Array<{ key: string; name: string; max: number }>
}

interface QcDefect {
  code: string
  dimension: QcDimensionKey
  dimensionLabel: string
  name: string
  severity: DefectSeverity
  message: string
  evidence: string
}

interface ScoreResult {
  id: string
  reportId: string
  modality: string
  totalScore: number
  grade: QcGrade
  modelVersion: string
  evaluatedAt: string
  dimensions: Array<{
    key: QcDimensionKey
    label: string
    score: number
    max: number
    subItems: Array<{ key: string; name: string; score: number; max: number; deducted: boolean }>
    issues: string[]
  }>
  defects: QcDefect[]
  suggestions: string[]
}

interface QcReview { id: string; round: 1 | 2; reviewer: string; opinion: ReviewOpinion; comment: string; at: string }

interface QcTask {
  id: string
  reportId: string
  patientName: string
  modality: string
  scoreId?: string
  totalScore?: number
  grade?: QcGrade
  status: QcTaskStatus
  assignee?: string
  assigneeName?: string
  createdAt: string
  updatedAt: string
  closedAt?: string
  reviews: QcReview[]
  history: Array<{ at: string; action: string; actor: string; note: string }>
  defects: QcDefect[]
}

const DIMENSIONS: DimensionMeta[] = [
  {
    key: 'completeness', label: '完整性', labelEn: 'Completeness', max: 25, color: '#1677ff',
    subItems: [
      { key: 'has-findings', name: '影像所见', max: 6 },
      { key: 'has-diagnosis', name: '诊断结论', max: 6 },
      { key: 'has-impression', name: '影像印象', max: 5 },
      { key: 'has-recommendation', name: '随访建议', max: 4 },
      { key: 'structured-fields', name: '结构化字段', max: 4 },
    ],
  },
  {
    key: 'normativity', label: '规范性', labelEn: 'Normativity', max: 25, color: '#52c41a',
    subItems: [
      { key: 'terminology', name: '术语规范', max: 8 },
      { key: 'unit', name: '单位完整', max: 6 },
      { key: 'abbreviation', name: '缩写规范', max: 6 },
      { key: 'punctuation', name: '标点正确', max: 5 },
    ],
  },
  {
    key: 'accuracy', label: '准确性', labelEn: 'Accuracy', max: 25, color: '#fa8c16',
    subItems: [
      { key: 'anatomy-correct', name: '解剖部位正确', max: 8 },
      { key: 'numeric-reasonable', name: '数值合理', max: 8 },
      { key: 'no-contradiction', name: '前后一致', max: 9 },
    ],
  },
  {
    key: 'readability', label: '可读性', labelEn: 'Readability', max: 15, color: '#722ed1',
    subItems: [
      { key: 'sentence-length', name: '句长适中', max: 5 },
      { key: 'paragraph-structure', name: '段落结构', max: 5 },
      { key: 'no-duplication', name: '无重复表述', max: 5 },
    ],
  },
  {
    key: 'timeliness', label: '时效性', labelEn: 'Timeliness', max: 10, color: '#eb2f96',
    subItems: [
      { key: 'report-time', name: '报告时限', max: 6 },
      { key: 'critical-mark', name: '危急标识', max: 4 },
    ],
  },
]

const DEFECT_LIB: Array<{ code: string; dimension: QcDimensionKey; dimensionLabel: string; name: string; severity: DefectSeverity; message: string; evidence: string }> = [
  { code: 'DF-001', dimension: 'completeness', dimensionLabel: '完整性', name: '必填字段缺失', severity: 'high', message: '缺少随访建议字段', evidence: '结构化字段抽查' },
  { code: 'DF-002', dimension: 'normativity', dimensionLabel: '规范性', name: '术语不规范', severity: 'medium', message: '使用非规范缩写 "cm"', evidence: '术语库比对' },
  { code: 'DF-003', dimension: 'accuracy', dimensionLabel: '准确性', name: '数值不合理', severity: 'medium', message: '病灶尺寸超出模态合理范围', evidence: '数值规则校验' },
  { code: 'DF-004', dimension: 'readability', dimensionLabel: '可读性', name: '重复表述', severity: 'low', message: '结论段重复描述所见 2 处', evidence: '相似度检测' },
  { code: 'DF-005', dimension: 'timeliness', dimensionLabel: '时效性', name: '报告超时', severity: 'high', message: '报告时限超出 30 分钟', evidence: 'TAT 统计' },
]

const SEED_SCORES: ScoreResult[] = [
  {
    id: 'qc2-s-001', reportId: 'RPT-A-0001', modality: 'CT', totalScore: 82, grade: 'B',
    modelVersion: 'qc-v2-1.3.0', evaluatedAt: '2026-08-05T09:30:00.000Z',
    dimensions: [
      { key: 'completeness', label: '完整性', score: 21, max: 25, subItems: [{ key: 'has-findings', name: '影像所见', score: 6, max: 6, deducted: false }, { key: 'has-diagnosis', name: '诊断结论', score: 6, max: 6, deducted: false }, { key: 'has-impression', name: '影像印象', score: 5, max: 5, deducted: false }, { key: 'has-recommendation', name: '随访建议', score: 0, max: 4, deducted: true }, { key: 'structured-fields', name: '结构化字段', score: 4, max: 4, deducted: false }], issues: ['缺少随访建议'] },
      { key: 'normativity', label: '规范性', score: 20, max: 25, subItems: [{ key: 'terminology', name: '术语规范', score: 6, max: 8, deducted: true }, { key: 'unit', name: '单位完整', score: 6, max: 6, deducted: false }, { key: 'abbreviation', name: '缩写规范', score: 4, max: 6, deducted: true }, { key: 'punctuation', name: '标点正确', score: 4, max: 5, deducted: true }], issues: ['缩写 "cm" 非规范'] },
      { key: 'accuracy', label: '准确性', score: 22, max: 25, subItems: [{ key: 'anatomy-correct', name: '解剖部位正确', score: 8, max: 8, deducted: false }, { key: 'numeric-reasonable', name: '数值合理', score: 6, max: 8, deducted: true }, { key: 'no-contradiction', name: '前后一致', score: 8, max: 9, deducted: true }], issues: [] },
      { key: 'readability', label: '可读性', score: 11, max: 15, subItems: [{ key: 'sentence-length', name: '句长适中', score: 4, max: 5, deducted: true }, { key: 'paragraph-structure', name: '段落结构', score: 4, max: 5, deducted: true }, { key: 'no-duplication', name: '无重复表述', score: 3, max: 5, deducted: true }], issues: ['重复表述 2 处'] },
      { key: 'timeliness', label: '时效性', score: 8, max: 10, subItems: [{ key: 'report-time', name: '报告时限', score: 4, max: 6, deducted: true }, { key: 'critical-mark', name: '危急标识', score: 4, max: 4, deducted: false }], issues: ['报告超时'] },
    ],
    defects: [DEFECT_LIB[0]!, DEFECT_LIB[1]!, DEFECT_LIB[4]!],
    suggestions: ['补充随访建议字段', '使用规范术语替换缩写', '关注报告时效'],
  },
  {
    id: 'qc2-s-002', reportId: 'RPT-A-0012', modality: 'MR', totalScore: 93, grade: 'A',
    modelVersion: 'qc-v2-1.3.0', evaluatedAt: '2026-08-08T14:10:00.000Z',
    dimensions: [
      { key: 'completeness', label: '完整性', score: 25, max: 25, subItems: [{ key: 'has-findings', name: '影像所见', score: 6, max: 6, deducted: false }, { key: 'has-diagnosis', name: '诊断结论', score: 6, max: 6, deducted: false }, { key: 'has-impression', name: '影像印象', score: 5, max: 5, deducted: false }, { key: 'has-recommendation', name: '随访建议', score: 4, max: 4, deducted: false }, { key: 'structured-fields', name: '结构化字段', score: 4, max: 4, deducted: false }], issues: [] },
      { key: 'normativity', label: '规范性', score: 23, max: 25, subItems: [{ key: 'terminology', name: '术语规范', score: 8, max: 8, deducted: false }, { key: 'unit', name: '单位完整', score: 6, max: 6, deducted: false }, { key: 'abbreviation', name: '缩写规范', score: 5, max: 6, deducted: true }, { key: 'punctuation', name: '标点正确', score: 4, max: 5, deducted: true }], issues: [] },
      { key: 'accuracy', label: '准确性', score: 24, max: 25, subItems: [{ key: 'anatomy-correct', name: '解剖部位正确', score: 8, max: 8, deducted: false }, { key: 'numeric-reasonable', name: '数值合理', score: 8, max: 8, deducted: false }, { key: 'no-contradiction', name: '前后一致', score: 8, max: 9, deducted: true }], issues: [] },
      { key: 'readability', label: '可读性', score: 13, max: 15, subItems: [{ key: 'sentence-length', name: '句长适中', score: 4, max: 5, deducted: true }, { key: 'paragraph-structure', name: '段落结构', score: 5, max: 5, deducted: false }, { key: 'no-duplication', name: '无重复表述', score: 4, max: 5, deducted: true }], issues: [] },
      { key: 'timeliness', label: '时效性', score: 8, max: 10, subItems: [{ key: 'report-time', name: '报告时限', score: 4, max: 6, deducted: true }, { key: 'critical-mark', name: '危急标识', score: 4, max: 4, deducted: false }], issues: [] },
    ],
    defects: [],
    suggestions: ['整体质量良好'],
  },
]

const SEED_TASKS: QcTask[] = [
  {
    id: 'qc2-t-001', reportId: 'RPT-A-0001', patientName: '张建国', modality: 'CT',
    scoreId: 'qc2-s-001', totalScore: 82, grade: 'B', status: 'in_progress',
    assignee: 'u-101', assigneeName: '王质控员',
    createdAt: '2026-08-05T09:35:00.000Z', updatedAt: '2026-08-12T10:00:00.000Z',
    reviews: [{ id: 'qc2-r-001', round: 1, reviewer: '张质控', opinion: 'return', comment: '补充随访建议后提交复核', at: '2026-08-12T10:00:00.000Z' }],
    history: [
      { at: '2026-08-05T09:35:00.000Z', action: 'created', actor: '系统', note: '评分触发质控任务' },
      { at: '2026-08-06T08:00:00.000Z', action: 'assigned', actor: '质控组长', note: '指派王质控员' },
      { at: '2026-08-12T10:00:00.000Z', action: 'reviewed', actor: '张质控', note: '初审退回' },
    ],
    defects: [DEFECT_LIB[0]!, DEFECT_LIB[1]!],
  },
  {
    id: 'qc2-t-002', reportId: 'RPT-A-0012', patientName: '李秀英', modality: 'MR',
    scoreId: 'qc2-s-002', totalScore: 93, grade: 'A', status: 'closed',
    assignee: 'u-102', assigneeName: '李质控员',
    createdAt: '2026-08-08T14:15:00.000Z', updatedAt: '2026-08-10T09:00:00.000Z', closedAt: '2026-08-10T09:00:00.000Z',
    reviews: [{ id: 'qc2-r-002', round: 1, reviewer: '张质控', opinion: 'pass', comment: '质量良好, 通过', at: '2026-08-10T09:00:00.000Z' }],
    history: [
      { at: '2026-08-08T14:15:00.000Z', action: 'created', actor: '系统', note: '评分触发质控任务' },
      { at: '2026-08-09T08:00:00.000Z', action: 'assigned', actor: '质控组长', note: '指派李质控员' },
      { at: '2026-08-10T09:00:00.000Z', action: 'closed', actor: '张质控', note: '通过并关闭' },
    ],
    defects: [],
  },
]

let scores: ScoreResult[] = [...SEED_SCORES]
let tasks: QcTask[] = [...SEED_TASKS]
let scoreSeq = 100
let taskSeq = 100
let reviewSeq = 100

const gradeOf = (score: number): QcGrade => (score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 60 ? 'C' : 'D')

function scoreReport(input: Record<string, unknown>): ScoreResult {
  const reportId = String(input.reportId ?? 'RPT-UNKNOWN')
  const modality = String(input.modality ?? 'CT')
  const findings = String(input.findings ?? '')
  const conclusion = String(input.conclusion ?? '')
  const structuredCompletion = Number(input.structuredCompletion ?? 0.9)
  let total = Math.round((72 + (findings.length > 100 ? 6 : 0) + (conclusion.length > 30 ? 4 : 0) + structuredCompletion * 10) * 10) / 10
  total = Math.max(40, Math.min(98, total))
  const grade = gradeOf(total)
  const defects: QcDefect[] = []
  if (findings.length < 50) defects.push({ ...DEFECT_LIB[0]!, code: 'DF-001', evidence: '所见段落过短' })
  if (!conclusion) defects.push({ ...DEFECT_LIB[0]!, code: 'DF-001', evidence: '结论为空' })
  const hasInformal = /cm\b|mM\b/.test(findings)
  if (hasInformal) defects.push({ ...DEFECT_LIB[1]!, code: 'DF-002', evidence: '发现非规范缩写' })
  return {
    id: `qc2-s-${scoreSeq++}`,
    reportId,
    modality,
    totalScore: total,
    grade,
    modelVersion: 'qc-v2-1.3.0',
    evaluatedAt: new Date().toISOString(),
    dimensions: DIMENSIONS.map((d) => {
      const deducted = defects.some((df) => df.dimension === d.key)
      const subItems = d.subItems.map((s) => {
        const isDeducted = deducted && (s.key === 'has-recommendation' || s.key === 'terminology')
        return { key: s.key, name: s.name, score: isDeducted ? Math.max(0, s.max - 2) : s.max, max: s.max, deducted: isDeducted }
      })
      const dimScore = subItems.reduce((s, x) => s + x.score, 0)
      return { key: d.key, label: d.label, score: dimScore, max: d.max, subItems, issues: deducted ? ['存在相关缺陷'] : [] }
    }),
    defects,
    suggestions: defects.length ? ['修复上述缺陷后重新评分', '补充完整结构字段'] : ['整体质量良好'],
  }
}

function taskFromScore(result: ScoreResult): QcTask {
  const now = new Date().toISOString()
  return {
    id: `qc2-t-${taskSeq++}`,
    reportId: result.reportId,
    patientName: '演示患者',
    modality: result.modality,
    scoreId: result.id,
    totalScore: result.totalScore,
    grade: result.grade,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
    reviews: [],
    history: [{ at: now, action: 'created', actor: '系统', note: '评分触发质控任务' }],
    defects: result.defects,
  }
}

export const reportQcV2Handlers = [
  http.get(`${API}/dimensions`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: DIMENSIONS })
  }),

  http.post(`${API}/score`, async ({ request }) => {
    await delay(80)
    const input = (await request.json()) as Record<string, unknown>
    const result = scoreReport(input)
    scores.unshift(result)
    return HttpResponse.json({ success: true, data: result })
  }),

  http.get(`${API}/scores`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: scores })
  }),

  http.get(`${API}/scores/:id`, async ({ params }) => {
    await delay(40)
    const item = scores.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `score ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.get(`${API}/tasks`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const items = status ? tasks.filter((t) => t.status === status) : tasks
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/tasks`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as Record<string, unknown>
    let task: QcTask
    if (body?.scoreInput) {
      const result = scoreReport(body.scoreInput as Record<string, unknown>)
      scores.unshift(result)
      task = taskFromScore(result)
    } else {
      task = taskFromScore({ id: `qc2-s-${scoreSeq++}`, reportId: String(body.reportId ?? 'RPT-UNKNOWN'), modality: String(body.modality ?? 'CT'), totalScore: 80, grade: 'B', modelVersion: 'qc-v2-1.3.0', evaluatedAt: new Date().toISOString(), dimensions: [], defects: [], suggestions: [] })
    }
    task.patientName = String(body.patientName ?? task.patientName)
    if (body.assignee) { task.assignee = String(body.assignee); task.status = 'in_progress' }
    if (body.assigneeName) task.assigneeName = String(body.assigneeName)
    tasks.unshift(task)
    return HttpResponse.json({ success: true, data: task })
  }),

  http.get(`${API}/tasks/:id`, async ({ params }) => {
    await delay(40)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/assign`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { assignee?: string; assigneeName?: string }
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    item.assignee = String(body?.assignee ?? '')
    item.assigneeName = String(body?.assigneeName ?? '')
    item.status = 'in_progress'
    item.updatedAt = new Date().toISOString()
    item.history.push({ at: item.updatedAt, action: 'assigned', actor: '质控组长', note: `指派 ${item.assigneeName}` })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/review`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reviewer?: string; opinion?: ReviewOpinion; comment?: string }
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    const at = new Date().toISOString()
    item.reviews.push({ id: `qc2-r-${reviewSeq++}`, round: 1, reviewer: String(body?.reviewer ?? '张质控'), opinion: body?.opinion ?? 'pass', comment: String(body?.comment ?? ''), at })
    item.status = body?.opinion === 'return' ? 'in_progress' : 'reviewing'
    item.updatedAt = at
    item.history.push({ at, action: body?.opinion === 'return' ? 'reviewed' : 'reviewed', actor: String(body?.reviewer ?? '张质控'), note: body?.opinion === 'return' ? '初审退回' : '初审通过' })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/second-review`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reviewer?: string; opinion?: ReviewOpinion; comment?: string }
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    const at = new Date().toISOString()
    item.reviews.push({ id: `qc2-r-${reviewSeq++}`, round: 2, reviewer: String(body?.reviewer ?? '张质控'), opinion: body?.opinion ?? 'pass', comment: String(body?.comment ?? ''), at })
    item.status = body?.opinion === 'return' ? 'in_progress' : 'reviewing'
    item.updatedAt = at
    item.history.push({ at, action: 'second-review', actor: String(body?.reviewer ?? '张质控'), note: body?.opinion === 'return' ? '二次复核退回' : '二次复核通过' })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/close`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { comment?: string } | undefined
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    const at = new Date().toISOString()
    item.status = 'closed'
    item.closedAt = at
    item.updatedAt = at
    item.history.push({ at, action: 'closed', actor: '张质控', note: String(body?.comment ?? '整改闭环') })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.get(`${API}/tasks/:id/reviews`, async ({ params }) => {
    await delay(40)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item.reviews })
  }),

  http.get(`${API}/records`, async () => {
    await delay(40)
    return HttpResponse.json({
      success: true,
      data: tasks.map((t) => ({
        id: t.id,
        reportId: t.reportId,
        patientName: t.patientName,
        modality: t.modality,
        totalScore: t.totalScore,
        grade: t.grade,
        status: t.status,
        assigneeName: t.assigneeName,
        defectCount: t.defects.length,
        reviewedRounds: t.reviews.length,
        createdAt: t.createdAt,
        closedAt: t.closedAt,
      })),
    })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const totalTasks = tasks.length
    const avgScore = Math.round(tasks.reduce((s, t) => s + (t.totalScore ?? 0), 0) / Math.max(1, totalTasks) * 10) / 10
    const closed = tasks.filter((t) => t.status === 'closed').length
    const byStatus: Record<string, number> = { pending: 0, in_progress: 0, reviewing: 0, closed: 0 }
    for (const t of tasks) byStatus[t.status] = (byStatus[t.status] ?? 0) + 1
    const gradeDistribution = (['A', 'B', 'C', 'D'] as const).map((g) => ({ grade: g, count: tasks.filter((t) => t.grade === g).length }))
    const defectCounts = new Map<string, { label: string; count: number; high: number; medium: number; low: number }>()
    for (const t of tasks) {
      for (const d of t.defects) {
        const bucket = defectCounts.get(d.dimension) ?? { label: DIMENSIONS.find((x) => x.key === d.dimension)?.label ?? d.dimension, count: 0, high: 0, medium: 0, low: 0 }
        bucket.count += 1
        if (d.severity === 'high') bucket.high += 1
        if (d.severity === 'medium') bucket.medium += 1
        if (d.severity === 'low') bucket.low += 1
        defectCounts.set(d.dimension, bucket)
      }
    }
    const severityDistribution = (['high', 'medium', 'low'] as const).map((sev) => ({ severity: sev, count: tasks.reduce((s, t) => s + t.defects.filter((d) => d.severity === sev).length, 0) }))
    return HttpResponse.json({
      success: true,
      data: {
        totalTasks,
        avgScore,
        passRate: Math.round(closed / Math.max(1, totalTasks) * 1000) / 10,
        gradeDistribution,
        taskByStatus: byStatus,
        defectDistribution: [...defectCounts.values()],
        severityDistribution,
        monthlyTrend: [
          { month: '2026-05', count: 18, avgScore: 79 },
          { month: '2026-06', count: 24, avgScore: 81 },
          { month: '2026-07', count: 31, avgScore: 82 },
          { month: '2026-08', count: 22, avgScore: 84 },
        ],
      },
    })
  }),
]
