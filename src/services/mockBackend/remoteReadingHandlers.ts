/**
 * G005 v3.0.6.11-75 W3-1 - 远程阅片 MSW handlers
 * 对齐 backend 远程阅片模块 (remoteReadingApi: /remote-reading/*)
 */
import { http, HttpResponse, delay } from 'msw'

const API_BASE = '/api/v1'

interface Session {
  id: string
  studyId: string
  patientName: string
  patientId: string
  modality: string
  referringDoctor: string
  readingDoctor: string
  readingDoctorDept: string
  status: 'pending' | 'in_progress' | 'completed' | 'returned'
  priority: 'routine' | 'urgent' | 'stat'
  requestedAt: string
  startedAt?: string
  completedAt?: string
  report?: string
  comment?: string
}

const delayMs = (min = 60, max = 180) => Math.floor(Math.random() * (max - min) + min)

let sessions: Session[] = [
  { id: 'rr-001', studyId: 'STU20260728-050', patientName: '张三', patientId: 'P000001', modality: 'CT', referringDoctor: '陈医生', readingDoctor: '王医生', readingDoctorDept: '东院区', status: 'completed', priority: 'urgent', requestedAt: '2026-07-28T08:00:00Z', startedAt: '2026-07-28T08:12:00Z', completedAt: '2026-07-28T09:30:00Z', report: '右肺上叶磨玻璃结节,建议随访复查。' },
  { id: 'rr-002', studyId: 'STU20260728-051', patientName: '李四', patientId: 'P000002', modality: 'MR', referringDoctor: '刘医生', readingDoctor: '李医生', readingDoctorDept: '西院区', status: 'in_progress', priority: 'routine', requestedAt: '2026-07-28T10:00:00Z', startedAt: '2026-07-28T10:20:00Z' },
  { id: 'rr-003', studyId: 'STU20260728-052', patientName: '王五', patientId: 'P000003', modality: 'DX', referringDoctor: '陈医生', readingDoctor: '张医生', readingDoctorDept: '总院', status: 'pending', priority: 'stat', requestedAt: '2026-07-28T11:00:00Z' },
  { id: 'rr-004', studyId: 'STU20260729-011', patientName: '赵六', patientId: 'P000004', modality: 'CT', referringDoctor: '孙医生', readingDoctor: '王医生', readingDoctorDept: '东院区', status: 'returned', priority: 'urgent', requestedAt: '2026-07-29T09:30:00Z', comment: '图像不全,请补充扫描序列' },
  { id: 'rr-005', studyId: 'STU20260729-012', patientName: '钱七', patientId: 'P000005', modality: 'US', referringDoctor: '周医生', readingDoctor: '李医生', readingDoctorDept: '西院区', status: 'completed', priority: 'routine', requestedAt: '2026-07-29T14:00:00Z', startedAt: '2026-07-29T14:10:00Z', completedAt: '2026-07-29T15:05:00Z', report: '胆囊壁增厚,建议结合临床。' },
]

function filterSessions(list: Session[], params: URLSearchParams): Session[] {
  let out = [...list]
  const status = params.get('status')
  const priority = params.get('priority')
  const readingDoctorId = params.get('readingDoctorId')
  if (status) out = out.filter((s) => s.status === status)
  if (priority) out = out.filter((s) => s.priority === priority)
  if (readingDoctorId) out = out.filter((s) => s.readingDoctor === readingDoctorId || s.readingDoctorDept === readingDoctorId)
  return out
}

function buildStats(list: Session[]) {
  const completed = list.filter((s) => s.status === 'completed')
  const avgHours = completed.length > 0
    ? completed.reduce((sum, s) => {
        const start = s.startedAt ? Date.parse(s.startedAt) : Date.parse(s.requestedAt)
        const end = s.completedAt ? Date.parse(s.completedAt) : Date.now()
        return sum + (end - start) / 3600000
      }, 0) / completed.length
    : 0
  const priorityDist: Record<string, number> = {}
  for (const s of list) priorityDist[s.priority] = (priorityDist[s.priority] ?? 0) + 1
  const doctorWorkload: Record<string, number> = {}
  for (const s of list) if (s.readingDoctor) doctorWorkload[s.readingDoctor] = (doctorWorkload[s.readingDoctor] ?? 0) + 1
  return {
    totalSessions: list.length,
    pendingCount: list.filter((s) => s.status === 'pending').length,
    completedCount: completed.length,
    avgCompletionHours: Number(avgHours.toFixed(1)),
    priorityDistribution: Object.entries(priorityDist).map(([priority, count]) => ({ priority, count })),
    doctorWorkload: Object.entries(doctorWorkload).map(([doctorName, count]) => ({ doctorName, count })),
  }
}

export const remoteReadingHandlers = [
  http.get(`${API_BASE}/remote-reading/sessions`, async ({ request }) => {
    await delay(delayMs())
    const url = new URL(request.url)
    const filtered = filterSessions(sessions, url.searchParams)
    return HttpResponse.json({ success: true, data: filtered, meta: { total: filtered.length } })
  }),

  http.get(`${API_BASE}/remote-reading/sessions/:id`, async ({ params }) => {
    await delay(delayMs(30, 80))
    const found = sessions.find((s) => s.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 })
    return HttpResponse.json({ success: true, data: found })
  }),

  http.post(`${API_BASE}/remote-reading/sessions`, async ({ request }) => {
    await delay(delayMs())
    const body = (await request.json()) as { studyId: string; readingDoctorId: string; priority: 'routine' | 'urgent' | 'stat'; comment?: string }
    const record: Session = {
      id: `rr-${String(Date.now()).slice(-6)}`,
      studyId: body.studyId ?? 'UNKNOWN',
      patientName: '待分配',
      patientId: '',
      modality: 'CT',
      referringDoctor: '申请医生',
      readingDoctor: body.readingDoctorId ?? '',
      readingDoctorDept: '总院',
      status: 'pending',
      priority: body.priority ?? 'routine',
      requestedAt: new Date().toISOString(),
      comment: body.comment,
    }
    sessions = [record, ...sessions]
    return HttpResponse.json({ success: true, data: record }, { status: 201 })
  }),

  http.post(`${API_BASE}/remote-reading/sessions/:id/start`, async ({ params }) => {
    await delay(delayMs())
    const found = sessions.find((s) => s.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 })
    found.status = 'in_progress'
    found.startedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: found })
  }),

  http.post(`${API_BASE}/remote-reading/sessions/:id/complete`, async ({ request, params }) => {
    await delay(delayMs())
    const body = (await request.json()) as { report?: string }
    const found = sessions.find((s) => s.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 })
    found.status = 'completed'
    found.completedAt = new Date().toISOString()
    if (body.report) found.report = body.report
    return HttpResponse.json({ success: true, data: found })
  }),

  http.post(`${API_BASE}/remote-reading/sessions/:id/return`, async ({ request, params }) => {
    await delay(delayMs())
    const body = (await request.json()) as { reason?: string }
    const found = sessions.find((s) => s.id === params.id)
    if (!found) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Session not found' } }, { status: 404 })
    found.status = 'returned'
    found.comment = body.reason ?? found.comment
    return HttpResponse.json({ success: true, data: found })
  }),

  http.get(`${API_BASE}/remote-reading/stats`, async () => {
    await delay(delayMs(30, 80))
    return HttpResponse.json({ success: true, data: buildStats(sessions) })
  }),
]

export const __remoteReadingTestReset = () => {
  sessions = sessions.slice(0, 5)
}
