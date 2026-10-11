// [G005 Wave 6B v3.0.6.11-101] /api/v1/report-qc-v2 MSW handlers
// 对齐后端 report-qc-v2.module + reportQcV2Api (多维评分 + 质控任务流 + 二次复核 + 统计, 孤儿模块 → seeded=true)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// [G005 demo-data] 任务看板种子交叉引用: store.list('exams') 取真实 reportId/examId/patientId,
//   医生取 DOCTOR_MASTER, store 为空时回落 PATIENT_MASTER / EXAM_REPORT_PRE
import { list } from './store'
import { PATIENT_MASTER, PATIENT_BY_ID, DOCTOR_MASTER } from '../../data/master'
import { EXAM_REPORT_PRE } from '../../data/_generators'
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
  patientId?: string
  patientName: string
  modality: string
  bodyPart?: string
  examId?: string
  scoreId?: string
  totalScore?: number
  grade?: QcGrade
  status: QcTaskStatus
  assignee?: string
  assigneeName?: string
  suggestedAssignee?: string
  suggestedAssigneeName?: string
  reviewerId?: string
  reviewerName?: string
  dueAt?: string
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

// ==================== [G005 demo-data] 质控任务看板种子 (30 条) ====================
// 交叉引用: reportId/examId/patientId ← store.list('exams'), 空则回落 EXAM_REPORT_PRE / PATIENT_MASTER
//           assignee/reviewer ← DOCTOR_MASTER; 每条任务都带 score + grade + dueAt
const SEED_TASK_COUNT = 30
// 状态配比: 待分配 12 / 复核中 9 / 已关闭 9
const STATUS_PATTERN: QcTaskStatus[] = [
  'pending', 'reviewing', 'closed', 'pending', 'reviewing', 'closed',
  'pending', 'closed', 'reviewing', 'pending',
]
// 每条任务的缺陷数 (0-5), 共 30 项
const DEFECT_COUNT_PATTERN = [2, 0, 1, 3, 2, 4, 1, 2, 5, 3, 0, 1, 2, 4, 3, 1, 2, 0, 3, 5, 2, 1, 4, 3, 2, 0, 1, 2, 4, 3]
const SEVERITY_PATTERN: DefectSeverity[] = ['high', 'medium', 'low']
const DEFECT_WEIGHT: Record<DefectSeverity, number> = { high: 14, medium: 11, low: 7 }
const DAY_MS = 86400000

interface SeedExamRef {
  examId: string
  reportId: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
}

// 确定性 LCG 种子 (模块内无 Math.random)
function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function normalizeSeedExam(row: unknown): SeedExamRef | null {
  if (!row || typeof row !== 'object') return null
  const r = row as Record<string, unknown>
  const reportId = String(r.reportId ?? r.id ?? '')
  const patientId = String(r.patientId ?? '')
  if (!reportId || !patientId) return null
  const patientName = String(r.patientName ?? PATIENT_BY_ID[patientId]?.name ?? '')
  if (!patientName) return null
  return {
    examId: String(r.id ?? reportId),
    reportId,
    patientId,
    patientName,
    modality: String(r.modality ?? 'CT'),
    bodyPart: String(r.bodyPart ?? '未知'),
  }
}

function pickSeedExams(count: number, allowed: string[]): SeedExamRef[] {
  const allow = new Set(allowed)
  const out: SeedExamRef[] = []
  const used = new Set<string>()
  const push = (row: unknown): void => {
    const normalized = normalizeSeedExam(row)
    if (!normalized || used.has(normalized.reportId)) return
    used.add(normalized.reportId)
    out.push(normalized)
  }
  let raw: unknown[] = []
  try { raw = list<unknown>('exams') } catch { raw = [] }
  const pool = raw.filter((row) => {
    if (!row || typeof row !== 'object') return false
    return allow.has(String((row as Record<string, unknown>).modality ?? ''))
  })
  if (pool.length > 0) {
    const strideCount = Math.min(count, pool.length)
    const step = pool.length / strideCount
    for (let i = 0; i < strideCount; i++) push(pool[Math.floor(i * step)])
  }
  if (out.length < count) for (const row of pool) { if (out.length >= count) break; push(row) }
  if (out.length < count) {
    const seen = new Set(used)
    for (const row of EXAM_REPORT_PRE) {
      if (out.length >= count) break
      if (allow.has(row.modality) && !seen.has(row.reportId)) push(row)
    }
  }
  if (out.length < count) {
    // store 与生成器同时不可用: PATIENT_MASTER 兜底, 保证看板非空
    PATIENT_MASTER.forEach((p, i) => {
      if (out.length >= count) return
      const seq = String(i + 1).padStart(5, '0')
      const reportId = `RPT-FALLBACK-${seq}`
      if (used.has(reportId)) return
      used.add(reportId)
      out.push({
        examId: `EXAM-FALLBACK-${seq}`,
        reportId,
        patientId: p.id,
        patientName: p.name,
        modality: allowed[i % allowed.length] ?? 'CT',
        bodyPart: p.bodyPart,
      })
    })
  }
  return out
}

function buildDimensions(defects: QcDefect[]): ScoreResult['dimensions'] {
  return DIMENSIONS.map((d) => {
    const dimDefects = defects.filter((x) => x.dimension === d.key)
    const penalty = Math.min(d.max, dimDefects.reduce((sum, x) => sum + DEFECT_WEIGHT[x.severity], 0))
    let assigned = 0
    const subItems = d.subItems.map((s, idx) => {
      const isLast = idx === d.subItems.length - 1
      const target = isLast
        ? Math.min(s.max, Math.max(0, penalty - assigned))
        : Math.min(s.max, Math.max(0, Math.round((s.max / d.max) * penalty)))
      assigned += target
      return { key: s.key, name: s.name, score: s.max - target, max: s.max, deducted: target > 0 }
    })
    const score = subItems.reduce((sum, s) => sum + s.score, 0)
    return {
      key: d.key,
      label: d.label,
      score,
      max: d.max,
      subItems,
      issues: dimDefects.map((x) => `${x.code} ${x.name}`),
    }
  })
}

function buildSeedData(): { scores: ScoreResult[]; tasks: QcTask[] } {
  const rng = makeRng(0x60c2026)
  const exams = pickSeedExams(SEED_TASK_COUNT, ['CT', 'MR', 'DR', 'US', 'MG', 'DSA', 'PET-CT'])
  const assigneePool = DOCTOR_MASTER.filter((d) => d.active !== false)
  const reviewerPool = DOCTOR_MASTER.filter(
    (d) => d.title === '主任医师' || d.title === '副主任医师' || d.title === '主治医师',
  )
  const now = Date.now()
  const clampToPast = (ms: number) => Math.min(ms, now - 3600000)
  const scores: ScoreResult[] = []
  const tasks: QcTask[] = []

  exams.forEach((exam, i) => {
    const seq = String(i + 1).padStart(3, '0')
    const defectCount = DEFECT_COUNT_PATTERN[i] ?? 2
    const startIdx = Math.floor(rng() * DEFECT_LIB.length)
    const defects: QcDefect[] = []
    for (let j = 0; j < defectCount; j++) {
      const lib = DEFECT_LIB[(startIdx + j * 2) % DEFECT_LIB.length]!
      defects.push({ ...lib, severity: SEVERITY_PATTERN[(i + j) % SEVERITY_PATTERN.length] ?? 'low' })
    }
    const dimensions = buildDimensions(defects)
    const totalScore = dimensions.reduce((sum, d) => sum + d.score, 0)
    const grade = gradeOf(totalScore)
    const status = STATUS_PATTERN[i % STATUS_PATTERN.length] ?? 'pending'

    const createdMs = now - ((i % 30) + 2) * DAY_MS
    const dueMs = createdMs + (3 + (i % 5)) * DAY_MS
    const reviewBaseMs = clampToPast(createdMs + (1 + (i % 3)) * DAY_MS)
    const closedMs = status === 'closed' ? clampToPast(createdMs + (1 + (i % 4)) * DAY_MS) : undefined
    const reviewMs = closedMs !== undefined
      ? Math.max(createdMs + 600000, Math.min(reviewBaseMs, closedMs - 600000))
      : reviewBaseMs
    const updatedMs = closedMs ?? reviewMs

    const assigneeDoc = assigneePool.length > 0 ? assigneePool[(i * 7 + 3) % assigneePool.length] : undefined
    const reviewerDoc = reviewerPool.length > 0 ? reviewerPool[(i * 5 + 2) % reviewerPool.length] : undefined
    const assigned = status !== 'pending'

    const scoreId = `qc2-s-${seq}`
    scores.push({
      id: scoreId,
      reportId: exam.reportId,
      modality: exam.modality,
      totalScore,
      grade,
      modelVersion: 'qc-v2-1.3.0',
      evaluatedAt: new Date(createdMs - 600000).toISOString(),
      dimensions,
      defects,
      suggestions: defects.length > 0
        ? Array.from(new Set(defects.map((x) => `修复${x.dimensionLabel}缺陷: ${x.name}`)))
        : ['整体质量良好, 保持'],
    })

    const task: QcTask = {
      id: `qc2-t-${seq}`,
      reportId: exam.reportId,
      patientId: exam.patientId,
      patientName: exam.patientName,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      examId: exam.examId,
      scoreId,
      totalScore,
      grade,
      status,
      dueAt: new Date(dueMs).toISOString(),
      createdAt: new Date(createdMs).toISOString(),
      updatedAt: new Date(updatedMs).toISOString(),
      closedAt: closedMs !== undefined ? new Date(closedMs).toISOString() : undefined,
      reviews: [],
      history: [{ at: new Date(createdMs).toISOString(), action: 'created', actor: '系统', note: '评分触发质控任务' }],
      defects,
    }

    if (assigned && assigneeDoc) {
      task.assignee = assigneeDoc.id
      task.assigneeName = assigneeDoc.name
      task.history.push({ at: new Date(createdMs + 600000).toISOString(), action: 'assigned', actor: '质控组长', note: `指派 ${assigneeDoc.name}` })
    } else if (assigneeDoc) {
      task.suggestedAssignee = assigneeDoc.id
      task.suggestedAssigneeName = assigneeDoc.name
      task.history.push({ at: new Date(createdMs + 600000).toISOString(), action: 'queued', actor: '质控组长', note: `待分配, 建议 ${assigneeDoc.name}` })
    }
    if (assigned && reviewerDoc) {
      task.reviewerId = reviewerDoc.id
      task.reviewerName = reviewerDoc.name
      task.reviews.push({
        id: `qc2-r-${seq}-1`,
        round: 1,
        reviewer: reviewerDoc.name,
        opinion: 'pass',
        comment: status === 'closed' ? '整改到位, 复核通过' : '初审通过, 转入复核',
        at: new Date(reviewMs).toISOString(),
      })
      task.history.push({ at: new Date(reviewMs).toISOString(), action: 'reviewed', actor: reviewerDoc.name, note: '初审通过' })
    }
    if (status === 'closed' && reviewerDoc) {
      task.history.push({ at: new Date(updatedMs).toISOString(), action: 'closed', actor: reviewerDoc.name, note: '整改闭环, 任务关闭' })
    }
    tasks.push(task)
  })

  return { scores, tasks }
}

let scores: ScoreResult[] = []
let tasks: QcTask[] = []
let scoreSeq = 100
let taskSeq = 100
let reviewSeq = 100
let seeded = false

// 幂等种子: 首次路由命中时构建 (store 为空则回落 PATIENT_MASTER / EXAM_REPORT_PRE)
function ensureSeeded(): void {
  if (seeded) return
  seeded = true
  const seed = buildSeedData()
  scores = seed.scores
  tasks = seed.tasks
}

// 路由入口统一入口: 先确保种子就绪, 再执行 msw delay
function routeDelay(ms: number): Promise<void> {
  ensureSeeded()
  return delay(ms)
}

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
    await routeDelay(40)
    return HttpResponse.json({ success: true, data: DIMENSIONS })
  }),

  http.post(`${API}/score`, async ({ request }) => {
    await routeDelay(80)
    const input = (await request.json()) as Record<string, unknown>
    const result = scoreReport(input)
    scores.unshift(result)
    return HttpResponse.json({ success: true, data: result })
  }),

  http.get(`${API}/scores`, async () => {
    await routeDelay(40)
    return HttpResponse.json({ success: true, data: scores })
  }),

  http.get(`${API}/scores/:id`, async ({ params }) => {
    await routeDelay(40)
    const item = scores.find((s) => s.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `score ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.get(`${API}/tasks`, async ({ request }) => {
    await routeDelay(40)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const items = status ? tasks.filter((t) => t.status === status) : tasks
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/tasks`, async ({ request }) => {
    await routeDelay(60)
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
    await routeDelay(40)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/assign`, async ({ params, request }) => {
    await routeDelay(50)
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
    await routeDelay(50)
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
    await routeDelay(50)
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
    await routeDelay(50)
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
    await routeDelay(40)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item.reviews })
  }),

  http.get(`${API}/records`, async () => {
    await routeDelay(40)
    return HttpResponse.json({
      success: true,
      data: tasks.map((t) => ({
        id: t.id,
        reportId: t.reportId,
        examId: t.examId,
        patientId: t.patientId,
        patientName: t.patientName,
        modality: t.modality,
        bodyPart: t.bodyPart,
        totalScore: t.totalScore,
        grade: t.grade,
        status: t.status,
        assigneeName: t.assigneeName ?? t.suggestedAssigneeName,
        reviewerName: t.reviewerName,
        dueAt: t.dueAt,
        defectCount: t.defects.length,
        reviewedRounds: t.reviews.length,
        createdAt: t.createdAt,
        closedAt: t.closedAt,
      })),
    })
  }),

  http.get(`${API}/stats`, async () => {
    await routeDelay(40)
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
