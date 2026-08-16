// [G005 Wave 7C v3.0.6.11-101] /api/v1/report-peer-review MSW handlers
// 对齐后端 report-peer-review.module + reportPeerReviewApi (按科室确定性分配 + 三维度 5 分制 + 统计)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-peer-review`

type PeerReviewStatus = 'pending' | 'reviewed' | 'overdue'

interface Task {
  id: string
  reportId: string
  patientName: string
  modality: string
  department: string
  reviewerId: string
  reviewerName: string
  assignedAt: string
  dueAt: string
  status: PeerReviewStatus
  scores?: { accuracy: number; completeness: number; normativity: number }
  comment?: string
  reviewedAt?: string
  autoAssigned: boolean
}

const DIMENSIONS = [
  { key: 'accuracy', label: '诊断准确性', min: 1, max: 5 },
  { key: 'completeness', label: '报告完整性', min: 1, max: 5 },
  { key: 'normativity', label: '书写规范性', min: 1, max: 5 },
]

const REVIEWERS = ['李医生', '王医生', '刘医生', '陈医生', '周医生']

const TASKS: Task[] = [
  {
    id: 'pr-001', reportId: 'RPT-A-0001', patientName: '张建国', modality: 'CT', department: '放射科',
    reviewerId: 'u-002', reviewerName: '李医生',
    assignedAt: '2026-08-10T09:00:00.000Z', dueAt: '2026-08-17T09:00:00.000Z',
    status: 'pending', autoAssigned: true,
  },
  {
    id: 'pr-002', reportId: 'RPT-A-0012', patientName: '李秀英', modality: 'MR', department: '放射科',
    reviewerId: 'u-003', reviewerName: '王医生',
    assignedAt: '2026-08-05T10:00:00.000Z', dueAt: '2026-08-12T10:00:00.000Z',
    status: 'reviewed',
    scores: { accuracy: 5, completeness: 4, normativity: 4 },
    comment: '结论准确, 建议补充随访建议。',
    reviewedAt: '2026-08-11T14:00:00.000Z', autoAssigned: true,
  },
  {
    id: 'pr-003', reportId: 'RPT-A-0021', patientName: '王德发', modality: 'CT', department: '放射科',
    reviewerId: 'u-004', reviewerName: '刘医生',
    assignedAt: '2026-08-01T09:00:00.000Z', dueAt: '2026-08-08T09:00:00.000Z',
    status: 'overdue', autoAssigned: true,
  },
]

let tasks: Task[] = [...TASKS]
let taskSeq = 100

function hash01(key: string): number {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

export const reportPeerReviewHandlers = [
  http.post(`${API}/assign`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { reportId?: string; patientName?: string; modality?: string; department?: string; reviewerId?: string; dueDays?: number }
    const now = new Date().toISOString()
    const due = new Date(Date.now() + (body?.dueDays ?? 7) * 86400000).toISOString()
    const reviewerIdx = Math.floor(hash01(`${body?.reportId ?? 'rpt'}|${body?.department ?? ''}`) * REVIEWERS.length)
    const task: Task = {
      id: `pr-${taskSeq++}`,
      reportId: String(body?.reportId ?? 'RPT-UNKNOWN'),
      patientName: String(body?.patientName ?? '演示患者'),
      modality: String(body?.modality ?? 'CT'),
      department: String(body?.department ?? '放射科'),
      reviewerId: String(body?.reviewerId ?? `u-${2 + reviewerIdx}`),
      reviewerName: body?.reviewerId ? (body.reviewerId === 'u-003' ? '王医生' : '李医生') : REVIEWERS[reviewerIdx]!,
      assignedAt: now,
      dueAt: due,
      status: 'pending',
      autoAssigned: !body?.reviewerId,
    }
    tasks.unshift(task)
    return HttpResponse.json({ success: true, data: task })
  }),

  http.get(`${API}/tasks`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const items = status ? tasks.filter((t) => t.status === status) : tasks
    return HttpResponse.json({ success: true, data: items })
  }),

  http.get(`${API}/tasks/:id`, async ({ params }) => {
    await delay(40)
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/tasks/:id/score`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { scores?: { accuracy: number; completeness: number; normativity: number }; comment?: string; reviewerId?: string }
    const item = tasks.find((t) => t.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `task ${params.id} not found` } }, { status: 404 })
    const scores = body?.scores ?? { accuracy: 4, completeness: 4, normativity: 4 }
    item.scores = {
      accuracy: Math.max(1, Math.min(5, Math.round(scores.accuracy))),
      completeness: Math.max(1, Math.min(5, Math.round(scores.completeness))),
      normativity: Math.max(1, Math.min(5, Math.round(scores.normativity))),
    }
    item.comment = String(body?.comment ?? '')
    item.reviewedAt = new Date().toISOString()
    item.status = 'reviewed'
    return HttpResponse.json({ success: true, data: item })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const reviewed = tasks.filter((t) => t.status === 'reviewed')
    const pending = tasks.filter((t) => t.status === 'pending')
    const overdue = tasks.filter((t) => t.status === 'overdue')
    const avg = (k: 'accuracy' | 'completeness' | 'normativity') => Math.round(reviewed.reduce((s, t) => s + (t.scores?.[k] ?? 0), 0) / Math.max(1, reviewed.length) * 10) / 10
    const overall = Math.round((avg('accuracy') + avg('completeness') + avg('normativity')) / 3 * 10) / 10
    const distributionMap = new Map<number, number>()
    for (const t of reviewed) {
      if (!t.scores) continue
      const o = Math.round((t.scores.accuracy + t.scores.completeness + t.scores.normativity) / 3)
      distributionMap.set(o, (distributionMap.get(o) ?? 0) + 1)
    }
    const byDepartmentMap = new Map<string, { total: number; reviewed: number; sum: number }>()
    for (const t of tasks) {
      const entry = byDepartmentMap.get(t.department) ?? { total: 0, reviewed: 0, sum: 0 }
      entry.total += 1
      if (t.status === 'reviewed' && t.scores) {
        entry.reviewed += 1
        entry.sum += (t.scores.accuracy + t.scores.completeness + t.scores.normativity) / 3
      }
      byDepartmentMap.set(t.department, entry)
    }
    return HttpResponse.json({
      success: true,
      data: {
        total: tasks.length,
        reviewedCount: reviewed.length,
        pendingCount: pending.length,
        overdueCount: overdue.length,
        completionRate: Math.round(reviewed.length / Math.max(1, tasks.length) * 1000) / 10,
        avgScores: { accuracy: avg('accuracy'), completeness: avg('completeness'), normativity: avg('normativity'), overall },
        scoreDistribution: [...distributionMap.entries()].sort((a, b) => a[0] - b[0]).map(([score, count]) => ({ score, count })),
        byDepartment: [...byDepartmentMap.entries()].map(([department, e]) => ({ department, total: e.total, reviewed: e.reviewed, avgOverall: Math.round(e.sum / Math.max(1, e.reviewed) * 10) / 10 })),
      },
    })
  }),

  http.get(`${API}/dimensions`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: DIMENSIONS })
  }),
]
