// [G005 W5] 缺失端点 MSW handlers — demo/mock 模式兜底
// 覆盖审计确认"前端会调用但既有 mockBackend 未注册"的路径, 保证 demo 模式不再 404/500。
// 必须前置注册 (handlers.ts 数组最前), 避免被既有参数/通配路由 (如 /worklist/:id、/devices/:id) 错配。
// 静态路由在簇内先于参数路由注册。数据确定性 (无 Math.random), 与后端 seed 口径一致。
import { http, HttpResponse } from 'msw'
// [W6] 统一到 canonical store (handlers.ts 的工作列表/开始检查读同一个 'exams' 集合)
import { get as storeGet, update as storeUpdate } from './store'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const nowIso = () => new Date().toISOString()
const DAY = 86_400_000
const dateOnly = (offset = 0) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)
const range = (n: number, fn: (i: number) => Record<string, unknown>) => Array.from({ length: n }, (_, i) => fn(i))

/**
 * [W6] 危急/工作列表记录读写: 优先 canonical 'exams' 集合 (与 /worklist、/:id/start 同源),
 * 回退到本文件 worklistStore seed, 保证 Time-Out / 重拍审批状态前后一致。
 */
function readExamRecord(id: string): Record<string, unknown> | null {
  try {
    const rec = storeGet<Record<string, unknown>>('exams', id)
    if (rec) return rec
  } catch { /* 集合未就绪 */ }
  return worklistStore.find((x) => x.id === id) ?? null
}
function patchExamRecord(id: string, patch: Record<string, unknown>): Record<string, unknown> | null {
  try {
    const updated = storeUpdate<Record<string, unknown> & { id: string }>('exams', id, patch)
    if (updated) return updated
  } catch { /* 集合未就绪 */ }
  const w = worklistStore.find((x) => x.id === id)
  if (w) { Object.assign(w, patch); return w }
  return null
}
const clampDays = (raw: string | null, def = 30) => {
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 && n <= 365 ? Math.floor(n) : def
}

// ───────────────────────────────────────────────────────────────────────────
// 共享 seed
// ───────────────────────────────────────────────────────────────────────────
const PATIENTS: any[] = [
  { id: 'P001', name: '张伟', gender: '男', birthDate: '1985-06-15', phone: '13800138001', type: '门诊', patientType: '门诊', createdAt: '2026-08-01T08:00:00.000Z' },
  { id: 'P002', name: '李娜', gender: '女', birthDate: '1995-03-22', phone: '13800138002', type: '住院', patientType: '住院', createdAt: '2026-08-15T09:30:00.000Z' },
  { id: 'P003', name: '王强', gender: '男', birthDate: '1968-02-15', phone: '13800138003', type: '门诊', patientType: '门诊', createdAt: '2026-09-01T10:00:00.000Z' },
  { id: 'P004', name: '陈静', gender: '女', birthDate: '1979-11-08', phone: '13800138004', type: '门诊', patientType: '门诊', createdAt: '2026-09-10T14:00:00.000Z' },
]
const DOCTORS = [
  { id: 'D001', name: '李明', department: '放射科' },
  { id: 'D002', name: '赵敏', department: '放射科' },
  { id: 'D003', name: '孙杰', department: '超声科' },
]
const MODALITIES = ['CT', 'MR', 'DR', 'US', 'CR']

const patientStore: any[] = PATIENTS.map((p) => ({ ...p }))

const worklistStore: any[] = [
  { id: 'WL001', patientId: 'P001', patientName: '张伟', gender: '男', age: 41, modality: 'CT', accessionNumber: 'AC-20260921-001', accessionNo: 'AC-20260921-001', bodyPart: '胸部', state: 'SCHEDULED', status: 'SCHEDULED', priority: 'ROUTINE', scheduledAt: '2026-09-21T08:30:00.000Z', deviceId: 'DEV001', deviceName: 'CT-01', referringPhysician: '李明', isUrgent: false, timeoutVerified: false, retakeStatus: null },
  { id: 'WL002', patientId: 'P002', patientName: '李娜', gender: '女', age: 31, modality: 'MR', accessionNumber: 'AC-20260921-002', accessionNo: 'AC-20260921-002', bodyPart: '颅脑', state: 'IN_PROGRESS', status: 'IN_PROGRESS', priority: 'URGENT', scheduledAt: '2026-09-21T09:00:00.000Z', deviceId: 'DEV002', deviceName: 'MR-01', referringPhysician: '赵敏', isUrgent: true, timeoutVerified: true, timeoutVerifiedBy: '李明', timeoutVerifiedAt: '2026-09-21T08:55:00.000Z', retakeStatus: null },
  { id: 'WL003', patientId: 'P003', patientName: '王强', gender: '男', age: 58, modality: 'DR', accessionNumber: 'AC-20260921-003', accessionNo: 'AC-20260921-003', bodyPart: '胸部', state: 'COMPLETED', status: 'COMPLETED', priority: 'ROUTINE', scheduledAt: '2026-09-21T07:30:00.000Z', deviceId: 'DEV003', deviceName: 'DR-01', referringPhysician: '孙杰', isUrgent: false, timeoutVerified: true, retakeStatus: null },
  { id: 'WL004', patientId: 'P004', patientName: '陈静', gender: '女', age: 46, modality: 'CT', accessionNumber: 'AC-20260921-004', accessionNo: 'AC-20260921-004', bodyPart: '腹部', state: 'QC_REJECT', status: 'QC_REJECT', priority: 'ROUTINE', scheduledAt: '2026-09-21T10:00:00.000Z', deviceId: 'DEV001', deviceName: 'CT-01', referringPhysician: '李明', isUrgent: false, timeoutVerified: true, retakeStatus: 'pending', retakeRequestedBy: '李明', retakeRequestedAt: '2026-09-21T10:20:00.000Z', retakeReason: 'motion_artifact' },
]

const examStore: any[] = [
  { id: 'EX001', patientId: 'P001', patientName: '张伟', accessionNumber: 'AC-20260921-001', modality: 'CT', bodyPart: '胸部', state: 'COMPLETED', deviceId: 'DEV001', scheduledAt: '2026-09-21T08:30:00.000Z', createdAt: '2026-09-21T08:00:00.000Z', completedAt: '2026-09-21T08:45:00.000Z' },
  { id: 'EX002', patientId: 'P002', patientName: '李娜', accessionNumber: 'AC-20260921-002', modality: 'MR', bodyPart: '颅脑', state: 'IN_PROGRESS', deviceId: 'DEV002', scheduledAt: '2026-09-21T09:00:00.000Z', createdAt: '2026-09-21T08:50:00.000Z', completedAt: null },
  { id: 'EX003', patientId: 'P003', patientName: '王强', accessionNumber: 'AC-20260921-003', modality: 'DR', bodyPart: '胸部', state: 'SCHEDULED', deviceId: 'DEV003', scheduledAt: '2026-09-21T10:30:00.000Z', createdAt: '2026-09-21T09:00:00.000Z', completedAt: null },
  { id: 'EX004', patientId: 'P004', patientName: '陈静', accessionNumber: 'AC-20260921-004', modality: 'US', bodyPart: '腹部', state: 'SCHEDULED', deviceId: 'DEV004', scheduledAt: '2026-09-21T11:00:00.000Z', createdAt: '2026-09-21T09:30:00.000Z', completedAt: null },
]

const reportStore: any[] = [
  { id: 'RPT-0001', patientId: 'P001', patientName: '张伟', examId: 'EX001', state: 'PUBLISHED', modality: 'CT', bodyPart: '胸部', findings: '双肺纹理清晰，未见明显实质性病变。', conclusion: '胸部 CT 未见明显异常。', isCritical: false, createdAt: '2026-09-21T09:00:00.000Z' },
  { id: 'RPT-0002', patientId: 'P002', patientName: '李娜', examId: 'EX002', state: 'WRITING', modality: 'MR', bodyPart: '颅脑', findings: '脑实质未见异常信号。', conclusion: '颅脑 MR 未见明显异常。', isCritical: false, createdAt: '2026-09-21T09:30:00.000Z' },
  { id: 'RPT-0003', patientId: 'P003', patientName: '王强', examId: 'EX003', state: 'INITIAL_REVIEW', modality: 'DR', bodyPart: '胸部', findings: '右肺上叶见结节影。', conclusion: '右肺上叶结节，建议随访。', isCritical: false, createdAt: '2026-09-21T08:00:00.000Z' },
  { id: 'RPT-0004', patientId: 'P004', patientName: '陈静', examId: 'EX004', state: 'PUBLISHED', modality: 'US', bodyPart: '腹部', findings: '肝胆胰脾未见异常。', conclusion: '腹部超声未见明显异常。', isCritical: false, createdAt: '2026-09-20T15:00:00.000Z' },
]

const criticalStore: any[] = [
  { id: 'CV-001', patientId: 'P003', patientName: '王强', studyId: 'EX003', modality: 'DR', alertType: 'critical_value', severity: 'critical', title: '疑似肺栓塞', description: '右肺动脉充盈缺损，考虑肺栓塞。', status: 'active', step: 0, flowStatus: 'triggered', flowSteps: { triggered: '2026-09-21T08:10:00.000Z' }, createdAt: '2026-09-21T08:10:00.000Z' },
  { id: 'CV-002', patientId: 'P002', patientName: '李娜', studyId: 'EX002', modality: 'MR', alertType: 'unexpected_finding', severity: 'warning', title: '颅内占位', description: '左侧额叶异常信号，建议增强。', status: 'acknowledged', step: 2, flowStatus: 'confirmed', flowSteps: { triggered: '2026-09-21T09:40:00.000Z', notified: '2026-09-21T09:42:00.000Z', confirmed: '2026-09-21T09:50:00.000Z' }, createdAt: '2026-09-21T09:40:00.000Z' },
]

// ═══════════════════════════════════════════════════════════════════════════
// 1) Worklist (overview / by-modality / technician-stats / timeline / notes /
//    retake / timeout)
// ═══════════════════════════════════════════════════════════════════════════
const worklistHandlers = [
  http.get(`${API_BASE}/worklist/overview`, () => {
    const byStatus: Record<string, number> = {}
    for (const w of worklistStore) byStatus[w.state] = (byStatus[w.state] ?? 0) + 1
    const completed = worklistStore.filter((w) => w.state === 'COMPLETED').length
    return HttpResponse.json({
      date: dateOnly(0),
      total: worklistStore.length,
      todayTotal: worklistStore.length,
      completedToday: completed,
      completedRate: worklistStore.length ? Math.round((completed / worklistStore.length) * 1000) / 10 : 0,
      avgDurationMin: 18.5,
      byStatus,
      byModality: MODALITIES.map((m) => ({ modality: m, count: worklistStore.filter((w) => w.modality === m).length })),
      byRoom: [
        { room: 'CT-01', count: 2, completed: 1, inProgress: 0 },
        { room: 'MR-01', count: 1, completed: 0, inProgress: 1 },
      ],
      byHour: range(8, (i) => ({ hour: `${String(8 + i).padStart(2, '0')}:00`, count: (i % 3) + 1 })),
      peakHour: '09:00',
    })
  }),

  http.get(`${API_BASE}/worklist/by-modality`, () => {
    const items = MODALITIES.map((m) => {
      const rows = worklistStore.filter((w) => w.modality === m)
      const completed = rows.filter((w) => w.state === 'COMPLETED').length
      const inProgress = rows.filter((w) => w.state === 'IN_PROGRESS').length
      return { modality: m, total: rows.length, inProgress, completed, pending: rows.length - completed - inProgress, todayCompleted: completed, avgDurationMin: 18 }
    }).filter((x) => x.total > 0)
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(`${API_BASE}/worklist/technician-stats`, () => {
    const technicians = DOCTORS.slice(0, 2).map((d, i) => ({
      id: d.id,
      name: d.name,
      completedCount: 12 - i * 3,
      retakeCount: i,
      avgDurationMin: 17 + i * 2,
    }))
    const totalCompleted = technicians.reduce((s, t) => s + t.completedCount, 0)
    const totalRetake = technicians.reduce((s, t) => s + t.retakeCount, 0)
    return HttpResponse.json({
      summary: {
        totalCompleted,
        totalRetake,
        avgDurationMin: 18,
        retakeRate: totalCompleted ? Math.round((totalRetake / totalCompleted) * 1000) / 10 : 0,
        technicianCount: technicians.length,
      },
      technicians,
    })
  }),

  http.get(`${API_BASE}/worklist/timeline/:id`, ({ params }) => {
    const id = String(params.id)
    const w = worklistStore.find((x) => x.id === id) ?? worklistStore[0]
    const events = [
      { type: 'registered', label: '登记', timestamp: w.scheduledAt, actor: '系统' },
      { type: 'checked-in', label: '签到', timestamp: w.scheduledAt, actor: '前台' },
      { type: 'started', label: '开始检查', timestamp: w.scheduledAt, actor: w.deviceName },
      { type: 'completed', label: '检查完成', timestamp: w.completedAt ?? nowIso(), actor: w.deviceName },
    ]
    return HttpResponse.json({
      examId: id,
      accessionNumber: w.accessionNumber,
      patientId: w.patientId,
      patientName: w.patientName,
      modality: w.modality,
      bodyPart: w.bodyPart,
      state: w.state,
      totalEvents: events.length,
      events,
    })
  }),

  http.post(`${API_BASE}/worklist/:id/notes`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const note = String(body.note ?? '')
    const w = worklistStore.find((x) => x.id === id)
    if (w) w.techNotes = body.latest ? note : `${w.techNotes ? w.techNotes + '\n' : ''}${note}`
    return HttpResponse.json({ ok: true, examId: id, techNotes: w?.techNotes ?? note })
  }),

  http.post(`${API_BASE}/worklist/:id/retake-request`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const rec = readExamRecord(id)
    if (!rec) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 })
    // [W6] 仅 QC_REJECT 可提交重拍申请 (对齐后端)
    const state = String(rec.state ?? rec.status ?? '').toUpperCase()
    if (state !== 'QC_REJECT') {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `Exam ${id} 当前状态 ${state} 不允许提交重拍申请 (仅 QC_REJECT)` } }, { status: 400 })
    }
    if (rec.retakeStatus === 'pending') {
      return HttpResponse.json({ success: false, error: { code: 'RETAKE_DUPLICATE', message: `RETAKE_DUPLICATE: Exam ${id} 已有待审批的重拍申请` } }, { status: 400 })
    }
    patchExamRecord(id, {
      retakeStatus: 'pending',
      retakeRequestedBy: body.applicant ?? '当前技师',
      retakeRequestedAt: nowIso(),
      retakeReason: body.reason ?? 'other',
      retakeRequestNote: body.note ?? null,
      retakeApprover: null,
      retakeApprovedAt: null,
      retakeReviewNote: null,
    })
    return HttpResponse.json({ ok: true, examId: id, retakeStatus: 'pending' })
  }),

  http.post(`${API_BASE}/worklist/:id/retake-approve`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const approved = body.approved === true
    const rec = readExamRecord(id)
    if (!rec) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 })
    // [W6] 仅 pending 申请可审批; 审批不改变检查状态 (对齐后端, IN_PROGRESS 需另行流转)
    if (rec.retakeStatus !== 'pending') {
      return HttpResponse.json({ success: false, error: { code: 'RETAKE_NOT_PENDING', message: `RETAKE_NOT_PENDING: Exam ${id} 当前无待审批的重拍申请 (retakeStatus=${rec.retakeStatus ?? 'none'})` } }, { status: 400 })
    }
    patchExamRecord(id, {
      retakeStatus: approved ? 'approved' : 'rejected',
      retakeApprover: body.approver ?? '审核医师',
      retakeApprovedAt: nowIso(),
      retakeReviewNote: body.opinion ?? null,
    })
    return HttpResponse.json({ ok: true, examId: id, retakeStatus: approved ? 'approved' : 'rejected' })
  }),

  http.get(`${API_BASE}/worklist/:id/timeout-checklist`, ({ params }) => {
    const id = String(params.id)
    const w = readExamRecord(id) ?? worklistStore[0]
    const verified = w.timeoutVerified === true
    return HttpResponse.json({
      examId: id,
      verified,
      verifiedBy: w.timeoutVerifiedBy ?? null,
      verifiedAt: w.timeoutVerifiedAt ?? null,
      patient: {
        id: w.patientId,
        name: w.patientName,
        gender: w.gender,
        age: w.age,
        identityPrimary: w.patientId,
        identitySecondary: w.accessionNumber,
        identitySecondaryType: 'accession',
        allergyHistory: null,
        pregnancyStatus: 'unknown',
        isolationFlag: false,
      },
      exam: { id, accessionNumber: w.accessionNumber, modality: w.modality, bodyPart: w.bodyPart },
      consent: { required: true, status: verified ? 'signed' : 'pending' },
      items: [
        { key: 'identity', required: true, passed: verified, detail: null },
        { key: 'bodyPart', required: true, passed: verified, detail: null },
        { key: 'allergy', required: true, passed: verified, detail: null },
        { key: 'pregnancy', required: false, passed: true, detail: null },
        { key: 'isolation', required: false, passed: true, detail: null },
        { key: 'consent', required: true, passed: verified, detail: null },
      ],
      checklist: verified ? { identity: true, bodyPart: true, allergy: true } : null,
    })
  }),

  http.post(`${API_BASE}/worklist/:id/timeout-verify`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const by = String(body.verifiedBy ?? '当前技师')
    const rec = readExamRecord(id)
    if (!rec) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: 'Exam not found' } }, { status: 404 })
    patchExamRecord(id, {
      timeoutVerified: true,
      timeoutVerifiedBy: by,
      timeoutVerifiedAt: nowIso(),
      timeoutChecklist: body.checklist ?? {},
    })
    return HttpResponse.json({
      ok: true,
      examId: id,
      timeoutVerified: true,
      timeoutVerifiedBy: by,
      timeoutVerifiedAt: (rec.timeoutVerifiedAt as string) ?? nowIso(),
      checklist: body.checklist ?? {},
    })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 2) Exams (overview / by-modality / daily-trend / timeline / notes / create / delete)
// ═══════════════════════════════════════════════════════════════════════════
const examHandlers = [
  http.get(`${API_BASE}/exams/overview`, () => {
    const byState: Record<string, number> = {}
    for (const e of examStore) byState[e.state] = (byState[e.state] ?? 0) + 1
    return HttpResponse.json({
      total: examStore.length,
      todayScheduled: examStore.length,
      todayCompleted: examStore.filter((e) => e.state === 'COMPLETED').length,
      avgDurationMin: 18,
      totalRetake: 1,
      retakeRate: 5.2,
      byState,
      byModality: MODALITIES.map((m) => ({ modality: m, count: examStore.filter((e) => e.modality === m).length })).filter((x) => x.count > 0),
    })
  }),

  http.get(`${API_BASE}/exams/by-modality`, () => {
    const items = MODALITIES.map((m) => {
      const rows = examStore.filter((e) => e.modality === m)
      return { modality: m, total: rows.length, inProgress: rows.filter((e) => e.state === 'IN_PROGRESS').length, completed: rows.filter((e) => e.state === 'COMPLETED').length, avgDurationMin: 18 }
    }).filter((x) => x.total > 0)
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(`${API_BASE}/exams/daily-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    const items = range(days, (i) => ({ date: dateOnly(i - days + 1), created: (i * 3) % 11, completed: (i * 2) % 9 }))
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(`${API_BASE}/exams/timeline/:id`, ({ params }) => {
    const id = String(params.id)
    const e = examStore.find((x) => x.id === id) ?? examStore[0]
    const events = [
      { type: 'created', label: '登记', timestamp: e.createdAt, actor: '系统' },
      { type: 'scheduled', label: '预约', timestamp: e.scheduledAt, actor: '前台' },
      { type: 'started', label: '开始', timestamp: e.scheduledAt, actor: e.deviceId },
      { type: 'completed', label: '完成', timestamp: e.completedAt ?? nowIso(), actor: e.deviceId },
    ]
    return HttpResponse.json({ examId: id, accessionNumber: e.accessionNumber, patientName: e.patientName, modality: e.modality, bodyPart: e.bodyPart, state: e.state, totalEvents: events.length, events })
  }),

  http.post(`${API_BASE}/exams`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const id = `EX${String(examStore.length + 1).padStart(3, '0')}`
    const patient = patientStore.find((p) => p.id === body.patientId)
    const record = {
      id,
      patientId: String(body.patientId ?? ''),
      patientName: patient?.name ?? '未知患者',
      accessionNumber: String(body.accessionNumber ?? `AC-${dateOnly(0).replace(/-/g, '')}-${id}`),
      modality: String(body.modality ?? 'CT'),
      bodyPart: String(body.bodyPart ?? ''),
      state: 'SCHEDULED',
      deviceId: body.deviceId ? String(body.deviceId) : null,
      scheduledAt: body.scheduledAt ? String(body.scheduledAt) : nowIso(),
      createdAt: nowIso(),
      completedAt: null,
    }
    examStore.unshift(record)
    return HttpResponse.json(record)
  }),

  http.post(`${API_BASE}/exams/:id/notes`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const note = String(body.note ?? '')
    const e = examStore.find((x) => x.id === id)
    if (e) e.techNotes = note
    return HttpResponse.json({ ok: true, examId: id, techNotes: note })
  }),

  http.delete(`${API_BASE}/exams/:id`, ({ params }) => {
    const id = String(params.id)
    const idx = examStore.findIndex((x) => x.id === id)
    if (idx >= 0) examStore.splice(idx, 1)
    return HttpResponse.json({ success: true, data: null })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 3) Patients (overview / age-distribution / summary / visit-history / patch)
// ═══════════════════════════════════════════════════════════════════════════
const patientHandlers = [
  http.get(`${API_BASE}/patients/overview`, () => {
    const typeDistribution: Record<string, number> = {}
    const genderDistribution: Record<string, number> = {}
    for (const p of patientStore) {
      typeDistribution[p.type] = (typeDistribution[p.type] ?? 0) + 1
      genderDistribution[p.gender] = (genderDistribution[p.gender] ?? 0) + 1
    }
    return HttpResponse.json({
      total: patientStore.length,
      todayNew: 1,
      monthlyNew: 4,
      active: patientStore.length,
      activeRate: 100,
      typeDistribution,
      genderDistribution,
    })
  }),

  http.get(`${API_BASE}/patients/age-distribution`, () => {
    const buckets = [
      { bucket: '0-18', count: 0, male: 0, female: 0 },
      { bucket: '19-40', count: 0, male: 0, female: 0 },
      { bucket: '41-60', count: 0, male: 0, female: 0 },
      { bucket: '60+', count: 0, male: 0, female: 0 },
    ]
    const nowYear = new Date().getFullYear()
    for (const p of patientStore) {
      const age = p.birthDate ? nowYear - Number(String(p.birthDate).slice(0, 4)) : 0
      const b = age <= 18 ? buckets[0] : age <= 40 ? buckets[1] : age <= 60 ? buckets[2] : buckets[3]
      if (!b) continue
      b.count += 1
      if (p.gender === '男') b.male += 1
      else b.female += 1
    }
    return HttpResponse.json({ total: patientStore.length, items: buckets })
  }),

  http.get(`${API_BASE}/patients/:id/summary`, ({ params }) => {
    const id = String(params.id)
    const p = patientStore.find((x) => x.id === id) ?? patientStore[0]
    return HttpResponse.json({
      patient: { id: p.id, name: p.name, gender: p.gender, birthDate: p.birthDate, phone: p.phone, type: p.type, createdAt: p.createdAt },
      counts: { exams: 3, reports: 2, followUps: 1, criticalValues: 1, invoices: 2 },
      totalCharges: 1860.5,
      recentExams: examStore.slice(0, 3).map((e) => ({ id: e.id, modality: e.modality, bodyPart: e.bodyPart, state: e.state, createdAt: e.createdAt })),
      recentReports: reportStore.slice(0, 2).map((r) => ({ id: r.id, state: r.state, conclusion: r.conclusion, createdAt: r.createdAt })),
      followUps: [{ id: 'FU-001', nextDate: dateOnly(14), status: 'PENDING', note: '3 个月后复查' }],
      criticals: [{ id: 'CV-001', description: '疑似肺栓塞', severity: 'critical', state: 'active', createdAt: nowIso() }],
    })
  }),

  http.get(`${API_BASE}/patients/:id/visit-history`, ({ params }) => {
    const id = String(params.id)
    return HttpResponse.json({
      patientId: id,
      total: 4,
      events: [
        { type: 'registration', label: '建档', date: dateOnly(-120), detail: '门诊建档', status: 'done' },
        { type: 'exam', label: 'CT 检查', date: dateOnly(-30), detail: '胸部 CT', status: 'done' },
        { type: 'report', label: '报告发布', date: dateOnly(-29), detail: 'RPT-0001', status: 'done' },
        { type: 'followup', label: '随访计划', date: dateOnly(14), detail: '3 个月后复查', status: 'pending' },
      ],
    })
  }),

  http.patch(`${API_BASE}/patients/:id`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const p = patientStore.find((x) => x.id === id)
    if (p) Object.assign(p, body)
    return HttpResponse.json(p ?? { id, ...body })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 4) Reports (overview / by-doctor / daily-trend / related / templates-apply)
// ═══════════════════════════════════════════════════════════════════════════
const reportHandlers = [
  http.get(`${API_BASE}/reports/overview`, () => {
    const byStatus: Record<string, number> = {}
    for (const r of reportStore) byStatus[r.state] = (byStatus[r.state] ?? 0) + 1
    return HttpResponse.json({
      total: reportStore.length,
      todayCreated: reportStore.filter((r) => String(r.createdAt).startsWith(dateOnly(0))).length,
      todayCompleted: 1,
      todaySigned: 1,
      todayPublished: 2,
      criticalCount: 1,
      pendingCount: reportStore.filter((r) => !['PUBLISHED', 'SIGNED'].includes(r.state)).length,
      overdueCount: 0,
      avgTurnaroundHours: 3.5,
      byStatus,
    })
  }),

  http.get(`${API_BASE}/reports/by-doctor`, () => {
    const items = DOCTORS.map((d, i) => ({ id: d.id, name: d.name, total: 12 - i * 3, published: 9 - i * 2, pending: 3 - i, avgTurnaroundHours: 3 + i }))
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(`${API_BASE}/reports/daily-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    const items = range(days, (i) => ({ date: dateOnly(i - days + 1), created: (i * 2) % 8, published: (i * 2) % 6, signed: i % 5 }))
    return HttpResponse.json({ items, total: items.length })
  }),

  http.get(`${API_BASE}/reports/:id/related`, ({ params }) => {
    const id = String(params.id)
    const r = reportStore.find((x) => x.id === id) ?? reportStore[0]
    const p = patientStore.find((x) => x.id === r.patientId)
    const e = examStore.find((x) => x.id === r.examId)
    return HttpResponse.json({
      reportId: id,
      patient: p ? { id: p.id, name: p.name, gender: p.gender, birthDate: p.birthDate, phone: p.phone } : null,
      exam: e ? { id: e.id, accessionNumber: e.accessionNumber, modality: e.modality, bodyPart: e.bodyPart, state: e.state, scheduledAt: e.scheduledAt, completedAt: e.completedAt } : null,
      previousReports: reportStore.filter((x) => x.patientId === r.patientId && x.id !== id).map((x) => ({ id: x.id, state: x.state, findings: x.findings, conclusion: x.conclusion, createdAt: x.createdAt, isCritical: x.isCritical })),
      followUpPlans: [{ id: 'FU-001', planDate: dateOnly(-5), nextDate: dateOnly(14), status: 'PENDING', note: '复查' }],
      criticalValues: criticalStore.map((c) => ({ id: c.id, description: c.description, severity: c.severity, state: c.status, createdAt: c.createdAt, linkedByReport: c.patientId === r.patientId })),
    })
  }),

  http.post(`${API_BASE}/reports/:id/templates-apply`, async ({ params, request }) => {
    const id = String(params.id)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const r = reportStore.find((x) => x.id === id) ?? reportStore[0]
    const mode = String(body.mode ?? 'append')
    const appended = '【模板应用】双肺纹理清晰，未见明显实质性病变。'
    if (r) r.findings = mode === 'overwrite' ? appended : `${r.findings ? r.findings + '\n' : ''}${appended}`
    return HttpResponse.json({ ...r, templateApplied: { templateId: String(body.templateId ?? 'tpl-1'), name: '胸部 CT 常规模板', mode } })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 5) AI Diagnosis (results / cases)
// ═══════════════════════════════════════════════════════════════════════════
const aiResult = (id: string, model: string, patientName: string, modality: string, status: string): Record<string, unknown> => ({
  id,
  studyId: `EX00${id.slice(-1)}`,
  patientName,
  modality,
  status,
  modelVersion: `${model}-v1.2.0`,
  confidence: 0.92,
  createdAt: nowIso(),
})
const aiDiagnosisHandlers = [
  http.get(`${API_BASE}/ai-diagnosis/cases`, () =>
    HttpResponse.json({
      lungCad: { total: 12, byCategory: [{ key: 'nodule', count: 7 }, { key: 'mass', count: 5 }] },
      breastCad: { total: 9, byCategory: [{ key: 'mass', count: 5 }, { key: 'calcification', count: 4 }] },
      fractureCad: { total: 6, byCategory: [{ key: 'rib', count: 4 }, { key: 'limb', count: 2 }] },
      cardiacAi: { total: 5, byCategory: [{ key: 'stenosis', count: 3 }, { key: 'plaque', count: 2 }] },
      generatedAt: nowIso(),
    }),
  ),
  http.get(`${API_BASE}/ai-diagnosis/cases/:model/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), studyId: `EX00${String(params.id).slice(-1)}`, patientName: '张伟', status: 'confirmed', createdAt: nowIso(), model: String(params.model) })),
  http.get(`${API_BASE}/ai-diagnosis/:model/results`, ({ params }) => {
    const model = String(params.model)
    return HttpResponse.json([aiResult('1', model, '张伟', 'CT', 'auto'), aiResult('2', model, '李娜', 'MR', 'reviewed'), aiResult('3', model, '王强', 'CT', 'confirmed')])
  }),
  http.get(`${API_BASE}/ai-diagnosis/:model/results/:id`, ({ params }) => HttpResponse.json(aiResult(String(params.id), String(params.model), '张伟', 'CT', 'auto'))),
  http.post(`${API_BASE}/ai-diagnosis/:model/results/:id/review`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ...aiResult(String(params.id), String(params.model), '张伟', 'CT', String(body.status ?? 'confirmed')), comment: body.comment ?? null })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 7) AI Draft / AI Platform review / Fusion workspace
// ═══════════════════════════════════════════════════════════════════════════
const draftResult = (): Record<string, unknown> => ({
  paragraphs: [
    { id: 'p1', heading: '检查所见', content: '双肺纹理清晰，未见明显实质性病变。', confidence: 0.93, editable: true },
    { id: 'p2', heading: '诊断意见', content: '胸部 CT 未见明显异常。', confidence: 0.9, editable: true },
  ],
  overallConfidence: 0.91,
  modelVersion: 'g005-ai-v2',
  tokensUsed: 512,
})
const aiDraftHandlers = [
  http.post(`${API_BASE}/ai-draft/generate`, () => HttpResponse.json({ id: `draft-${Date.now()}`, draftText: '双肺纹理清晰，未见明显实质性病变。', findings: '双肺纹理清晰', impression: '未见明显异常', confidence: 0.92, modelVersion: 'g005-ai-v2' })),
  http.post(`${API_BASE}/ai-draft/continue`, () => HttpResponse.json({ id: `draft-${Date.now()}`, draftText: '双肺纹理清晰，未见明显实质性病变。建议定期随访。', confidence: 0.9, modelVersion: 'g005-ai-v2' })),
  http.post(`${API_BASE}/ai-draft/rewrite`, () => HttpResponse.json({ id: `draft-${Date.now()}`, draftText: '双肺透亮度正常，未见实质性病变。', confidence: 0.9, modelVersion: 'g005-ai-v2' })),
  http.get(`${API_BASE}/ai/fusion-workspace`, () => HttpResponse.json({ studies: [{ id: 'FS-001', patient: '张伟', modalities: 'CT+PET', fusionScore: 0.88, findings: 3, aiAlerts: 1, status: 'complete', date: dateOnly(0) }], aiInsights: [{ id: 'AI-001', type: 'lesion', finding: '右肺上叶结节', confidence: 0.91, modality: 'CT', source: 'lung-cad', actionable: true }] })),
  http.post(`${API_BASE}/ai/draft`, () => HttpResponse.json(draftResult())),
  http.post(`${API_BASE}/ai/draft/continue`, () => HttpResponse.json(draftResult())),
  http.post(`${API_BASE}/ai/draft/rewrite`, () => HttpResponse.json(draftResult())),
  http.post(`${API_BASE}/ai/review`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ reviewId: `rev-${Date.now()}`, score: 92, suggestions: ['建议补充既往史'], approved: true, reportText: body.reportText ?? '' })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 8) Audit (overview / high-risk / action-trend / user-activity)
// ═══════════════════════════════════════════════════════════════════════════
const auditHandlers = [
  http.get(`${API_BASE}/audit/overview`, () => HttpResponse.json({ total: 1280, today: 42, highRisk: 3, byAction: { create: 320, update: 540, delete: 60, login: 360 }, byActor: { D001: 120, D002: 98, D003: 76 } })),
  http.get(`${API_BASE}/audit/high-risk`, () => HttpResponse.json({ total: 3, items: [{ id: 'AU-H1', action: 'DELETE', entity: 'report', entityId: 'RPT-0004', actor: 'D003', riskLevel: 'high', createdAt: nowIso() }, { id: 'AU-H2', action: 'EXPORT', entity: 'patient', entityId: 'P001', actor: 'D001', riskLevel: 'medium', createdAt: nowIso() }] })),
  http.get(`${API_BASE}/audit/action-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    return HttpResponse.json(range(days, (i) => ({ date: dateOnly(i - days + 1), count: (i * 5) % 40 })))
  }),
  http.get(`${API_BASE}/audit/user-activity`, ({ request }) => {
    const limit = clampDays(new URL(request.url).searchParams.get('limit'), 20)
    return HttpResponse.json(range(limit, (i) => ({ userId: DOCTORS[i % DOCTORS.length]!.id, name: DOCTORS[i % DOCTORS.length]!.name, action: i % 2 ? 'update' : 'create', count: (i * 3) % 20, lastAt: nowIso() })))
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 9) MFA TOTP
// ═══════════════════════════════════════════════════════════════════════════
const mfaHandlers = [
  http.post(`${API_BASE}/auth/totp/setup`, () => HttpResponse.json({ secret: 'JBSWY3DPEHPK3PXP', otpauthUrl: 'otpauth://totp/G005:demo?secret=JBSWY3DPEHPK3PXP', qrCode: null })),
  http.post(`${API_BASE}/auth/totp/verify`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const code = String(body.code ?? '')
    return HttpResponse.json({ verified: code.length === 6, enabled: code.length === 6 })
  }),
  http.post(`${API_BASE}/auth/totp/disable`, () => HttpResponse.json({ disabled: true })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 10) Auto collection tasks (create / detail)
// ═══════════════════════════════════════════════════════════════════════════
const autoTasks: any[] = [
  { id: 'AC-T1', ruleId: 'AC-R1', name: '每日 CT 质控采集', status: 'completed', progress: 100, startedAt: nowIso(), finishedAt: nowIso() },
  { id: 'AC-T2', ruleId: 'AC-R2', name: 'MR 序列完整性采集', status: 'running', progress: 45, startedAt: nowIso(), finishedAt: null },
]
const autoCollectionHandlers = [
  http.get(`${API_BASE}/auto-collection/tasks/:id`, ({ params }) => HttpResponse.json(autoTasks.find((t) => t.id === String(params.id)) ?? autoTasks[0])),
  http.post(`${API_BASE}/auto-collection/tasks`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `AC-T${autoTasks.length + 1}`, ruleId: String(body.ruleId ?? 'AC-R1'), name: String(body.name ?? '自动采集任务'), status: 'queued', progress: 0, startedAt: nowIso(), finishedAt: null }
    autoTasks.unshift(record)
    return HttpResponse.json(record)
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 11) Clinical feedback detail
// ═══════════════════════════════════════════════════════════════════════════
const clinicalFeedbackHandlers = [
  http.get(`${API_BASE}/clinical-feedback/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), reportId: 'RPT-0001', patientId: 'P001', patientName: '张伟', type: 'objection', content: '结论与临床不符，请复核', submittedBy: '王医生', department: '急诊科', status: 'SUBMITTED', createdAt: nowIso(), updatedAt: nowIso() })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 12) Consent education verify
// ═══════════════════════════════════════════════════════════════════════════
const consentEducationHandlers = [
  http.get(`${API_BASE}/consent-education/verify`, () => HttpResponse.json({ verified: true, consentId: 'CE-001', patientId: 'P001', signedAt: nowIso(), status: 'signed' })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 13) Cosign rules (create / delete)
// ═══════════════════════════════════════════════════════════════════════════
const cosignRules: any[] = [
  { id: 'CR-001', name: '危急报告双签', condition: 'isCritical == true', requiredRoles: ['主任医师'], enabled: true },
  { id: 'CR-002', name: '科研报告双签', condition: 'purpose == "research"', requiredRoles: ['副主任医师'], enabled: true },
]
const cosignHandlers = [
  http.post(`${API_BASE}/cosign/rules`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `CR-${cosignRules.length + 1}`, name: String(body.name ?? '双签规则'), condition: String(body.condition ?? ''), requiredRoles: body.requiredRoles ?? [], enabled: body.enabled !== false }
    cosignRules.push(record)
    return HttpResponse.json(record)
  }),
  http.delete(`${API_BASE}/cosign/rules/:key`, ({ params }) => {
    const idx = cosignRules.findIndex((r) => r.id === String(params.key))
    if (idx >= 0) cosignRules.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 14) Critical alert flow (aggregate / notify / confirm / treat / close / for-report)
// ═══════════════════════════════════════════════════════════════════════════
const criticalAlertHandlers = [
  http.get(`${API_BASE}/critical-alert/for-report/:reportId`, ({ params }) => {
    const reportId = String(params.reportId)
    const r = reportStore.find((x) => x.id === reportId)
    return HttpResponse.json(criticalStore.filter((c) => c.patientId === r?.patientId))
  }),
  http.get(`${API_BASE}/critical-alert`, () => HttpResponse.json(criticalStore)),
  http.post(`${API_BASE}/critical-alert`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `CV-${criticalStore.length + 1}`, patientId: String(body.patientId ?? ''), patientName: String(body.patientName ?? ''), studyId: String(body.studyId ?? ''), modality: String(body.modality ?? ''), alertType: String(body.alertType ?? 'critical_value'), severity: String(body.severity ?? 'critical'), title: String(body.title ?? '危急值告警'), description: String(body.description ?? ''), status: 'active', step: 0, flowStatus: 'triggered', flowSteps: { triggered: nowIso() }, createdAt: nowIso() }
    criticalStore.unshift(record)
    return HttpResponse.json(record)
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/notify`, ({ params }) => {
    const c = criticalStore.find((x) => x.id === String(params.id))
    if (c) { c.flowStatus = 'notified'; c.step = 1; c.flowSteps = { ...c.flowSteps, notified: nowIso() } }
    return HttpResponse.json(c ?? { id: String(params.id) })
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/confirm`, ({ params }) => {
    const c = criticalStore.find((x) => x.id === String(params.id))
    if (c) { c.flowStatus = 'confirmed'; c.step = 2; c.status = 'acknowledged'; c.flowSteps = { ...c.flowSteps, confirmed: nowIso() } }
    return HttpResponse.json(c ?? { id: String(params.id) })
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/treat`, ({ params }) => {
    const c = criticalStore.find((x) => x.id === String(params.id))
    if (c) { c.flowStatus = 'treating'; c.step = 3; c.flowSteps = { ...c.flowSteps, treating: nowIso() } }
    return HttpResponse.json(c ?? { id: String(params.id) })
  }),
  http.post(`${API_BASE}/critical-alert/alerts/:id/close`, ({ params }) => {
    const c = criticalStore.find((x) => x.id === String(params.id))
    if (c) { c.flowStatus = 'closed'; c.step = 4; c.status = 'resolved'; c.resolvedAt = nowIso(); c.flowSteps = { ...c.flowSteps, closed: nowIso() } }
    return HttpResponse.json(c ?? { id: String(params.id) })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 15) Critical statistics (overview / daily-trend / by-department / timeline)
// ═══════════════════════════════════════════════════════════════════════════
const criticalStatsHandlers = [
  http.get(`${API_BASE}/criticals/overview`, () => {
    const bySeverity: Record<string, number> = {}
    const byState: Record<string, number> = {}
    for (const c of criticalStore) {
      bySeverity[c.severity] = (bySeverity[c.severity] ?? 0) + 1
      byState[c.status] = (byState[c.status] ?? 0) + 1
    }
    return HttpResponse.json({ total: criticalStore.length, todayCount: criticalStore.length, unhandled: criticalStore.filter((c) => c.status === 'active').length, timeoutCount: 0, avgResponseMin: 6.5, avgCloseMin: 42, bySeverity, byState })
  }),
  http.get(`${API_BASE}/criticals/by-department`, () => {
    const items = ['急诊科', '放射科', '呼吸科'].map((d, i) => ({ department: d, total: 8 - i * 2, success: 7 - i * 2, pending: 1, escalated: i, successRate: 87.5 - i * 5 }))
    return HttpResponse.json({ items, total: items.length })
  }),
  http.get(`${API_BASE}/criticals/daily-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    const items = range(days, (i) => ({ date: dateOnly(i - days + 1), found: (i * 2) % 6, closed: (i * 2) % 5 }))
    return HttpResponse.json({ items, total: items.length })
  }),
  http.get(`${API_BASE}/criticals/:id/timeline`, ({ params }) => {
    const id = String(params.id)
    const c = criticalStore.find((x) => x.id === id) ?? criticalStore[0]
    const events = [
      { type: 'triggered', label: '触发', timestamp: c.createdAt, actor: 'AI' },
      { type: 'notified', label: '通知', timestamp: c.flowSteps?.notified ?? c.createdAt, actor: '系统' },
      { type: 'confirmed', label: '确认', timestamp: c.flowSteps?.confirmed ?? c.createdAt, actor: '临床' },
    ]
    return HttpResponse.json({ criticalId: id, state: c.status, severity: c.severity, steps: { triggered: true, notified: Boolean(c.flowSteps?.notified), confirmed: Boolean(c.flowSteps?.confirmed), treating: Boolean(c.flowSteps?.treating), closed: Boolean(c.flowSteps?.closed) }, totalEvents: events.length, events })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 16) Dental
// ═══════════════════════════════════════════════════════════════════════════
const dentalHandlers = [
  // 注: GET /dental/ceph/landmarks 已由 dentalHandlers 提供, 此处仅补 :id 参数版
  http.get(`${API_BASE}/dental/ceph/:id/landmarks`, ({ params }) => HttpResponse.json({ studyId: String(params.id), landmarks: [{ key: 'S', x: 10, y: 20, label: '蝶鞍中心' }, { key: 'N', x: 12, y: 18, label: '鼻根点' }] })),
  http.get(`${API_BASE}/dental/studies/:id/dicom-paths`, ({ params }) => HttpResponse.json({ series: [{ path: `/pacs/dental/${String(params.id)}/series/1`, modality: 'CBCT', instanceCount: 320 }] })),
  http.get(`${API_BASE}/dental/ortho/plans/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), patientId: 'P001', alignerCount: 24, stageCount: 12, status: 'in_progress', createdAt: nowIso() })),
  http.get(`${API_BASE}/dental/volume/studies/:id/curve-path`, ({ params }) => HttpResponse.json({ studyId: String(params.id), points: [{ x: 0, y: 0, z: 0 }, { x: 1, y: 0.5, z: 0.2 }] })),
  http.get(`${API_BASE}/dental/schedule/appointments/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), patientId: 'P001', patientName: '张伟', startAt: nowIso(), status: 'confirmed', chair: '椅位 1' })),
  http.put(`${API_BASE}/dental/appointments/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: String(params.id), ...body, updatedAt: nowIso() })
  }),
  http.patch(`${API_BASE}/dental/ai-findings/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: String(params.id), ...body, updatedAt: nowIso() })
  }),
  http.post(`${API_BASE}/dental/ortho/aligner-plans/:id/stages`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ planId: String(params.id), stageCount: Number(body.stageCount ?? 12), generatedAt: nowIso(), stages: range(Number(body.stageCount ?? 12), (i) => ({ stage: i + 1, movements: [] })) })
  }),
  http.post(`${API_BASE}/dental/ortho/aligner-plans/:id/progress`, ({ params }) => HttpResponse.json({ planId: String(params.id), progress: 50, completedStages: 6, totalStages: 12, updatedAt: nowIso() })),
  http.post(`${API_BASE}/dental/volume/presets/:id/apply`, ({ params }) => HttpResponse.json({ presetId: String(params.id), applied: true, appliedAt: nowIso() })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 17) Devices (patch device + schedule blocks)
// ═══════════════════════════════════════════════════════════════════════════
const deviceBlocks: any[] = [
  { id: 'BLK-001', deviceId: 'DEV001', reason: 'maintenance', startAt: '2026-09-22T08:00:00.000Z', endAt: '2026-09-22T10:00:00.000Z', note: '定期保养' },
]
const deviceHandlers = [
  http.get(`${API_BASE}/devices/schedule/blocks/:id/suggest`, ({ params }) => HttpResponse.json({ blockId: String(params.id), suggestions: [{ startAt: '2026-09-23T08:00:00.000Z', endAt: '2026-09-23T10:00:00.000Z', score: 0.92 }] })),
  http.patch(`${API_BASE}/devices/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: String(params.id), ...body, updatedAt: nowIso() })
  }),
  http.post(`${API_BASE}/devices/schedule/blocks`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `BLK-${deviceBlocks.length + 1}`, deviceId: String(body.deviceId ?? 'DEV001'), reason: String(body.reason ?? 'maintenance'), startAt: String(body.startAt ?? nowIso()), endAt: String(body.endAt ?? nowIso()), note: body.note ? String(body.note) : null }
    deviceBlocks.push(record)
    return HttpResponse.json(record)
  }),
  http.patch(`${API_BASE}/devices/schedule/blocks/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const b = deviceBlocks.find((x) => x.id === String(params.id))
    if (b) Object.assign(b, body)
    return HttpResponse.json(b ?? { id: String(params.id), ...body })
  }),
  http.delete(`${API_BASE}/devices/schedule/blocks/:id`, ({ params }) => {
    const idx = deviceBlocks.findIndex((x) => x.id === String(params.id))
    if (idx >= 0) deviceBlocks.splice(idx, 1)
    return HttpResponse.json({ success: true })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 18) DICOM SR measurement templates
// ═══════════════════════════════════════════════════════════════════════════
const srTemplates: any[] = [
  { id: 'SRT-001', name: '冠脉狭窄测量', category: 'cardiac', modality: 'CT', unit: 'mm', code: 'SRT-001' },
  { id: 'SRT-002', name: '肺结节径线', category: 'chest', modality: 'CT', unit: 'mm', code: 'SRT-002' },
]
const srHandlers = [
  http.get(`${API_BASE}/dicom-sr/measurement-templates/categories`, () => HttpResponse.json([{ key: 'cardiac', name: '心血管' }, { key: 'chest', name: '胸部' }, { key: 'neuro', name: '神经' }])),
  http.get(`${API_BASE}/dicom-sr/measurement-templates`, () => HttpResponse.json(srTemplates)),
  http.get(`${API_BASE}/dicom-sr/measurement-templates/:id`, ({ params }) => HttpResponse.json(srTemplates.find((t) => t.id === String(params.id)) ?? srTemplates[0])),
]

// ═══════════════════════════════════════════════════════════════════════════
// 19) DICOMweb studies/series/instances (read)
// ═══════════════════════════════════════════════════════════════════════════
const dicomWebHandlers = [
  http.get(`${API_BASE}/dicom-web/studies/:study/series/:series/instances/:instance/metadata`, ({ params }) => HttpResponse.json({ '00080018': { vr: 'UI', Value: [String(params.instance)] }, '00080060': { vr: 'CS', Value: ['CT'] }, '00280010': { vr: 'US', Value: [512] }, '00280011': { vr: 'US', Value: [512] } })),
  http.get(`${API_BASE}/dicom-web/studies/:study/series/:series/instances/:instance`, () => HttpResponse.json({}, { status: 200 })),
  http.get(`${API_BASE}/dicom-web/studies/:study/series/:series`, ({ params }) => HttpResponse.json({ '0020000E': { vr: 'UI', Value: [String(params.series)] }, '00080060': { vr: 'CS', Value: ['CT'] }, '00201209': { vr: 'IS', Value: [1] } })),
  http.get(`${API_BASE}/dicom-web/studies/:study`, ({ params }) => HttpResponse.json({ '0020000D': { vr: 'UI', Value: [String(params.study)] }, '00100010': { vr: 'PN', Value: [{ Alphabetic: 'ZHANG^WEI' }] }, '00080061': { vr: 'CS', Value: ['CT'] } })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 20) Dual read arbitrate
// ═══════════════════════════════════════════════════════════════════════════
const dualReadHandlers = [
  http.post(`${API_BASE}/dual-read/arbitrate`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: `DR-${Date.now()}`, reportId: body.reportId ?? 'RPT-0001', finalReader: 'D001', decision: 'reader-a', reason: '一致性较高', createdAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 21) Export approval
// ═══════════════════════════════════════════════════════════════════════════
const exportApprovals: any[] = [
  { id: 'EA-001', reportId: 'RPT-0001', applicant: 'D001', reason: '科研使用', status: 'pending', createdAt: nowIso() },
]
const exportApprovalHandlers = [
  http.get(`${API_BASE}/export-approval`, () => HttpResponse.json(exportApprovals)),
  http.post(`${API_BASE}/export-approval`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `EA-${exportApprovals.length + 1}`, reportId: String(body.reportId ?? ''), applicant: String(body.applicant ?? '当前用户'), reason: String(body.reason ?? ''), status: 'pending', createdAt: nowIso() }
    exportApprovals.unshift(record)
    return HttpResponse.json(record)
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 22) Eye (optometry / low-vision / subspecialty / pacs export)
// ═══════════════════════════════════════════════════════════════════════════
const eyeHandlers = [
  http.get(`${API_BASE}/eye/low-vision/prescription`, () => HttpResponse.json({ id: 'LV-001', patientId: 'P001', odSphere: -2.5, osSphere: -2.25, odCylinder: -0.5, osCylinder: -0.75, add: 2.0, createdAt: nowIso() })),
  http.get(`${API_BASE}/eye/optometry/ok-lens`, () => HttpResponse.json([{ id: 'OKL-001', patientId: 'P001', design: 'ortho-k', baseCurve: 8.6, returnZone: 0.5, diameter: 10.6, status: 'active' }])),
  http.get(`${API_BASE}/eye/optometry/refraction`, () => HttpResponse.json([{ id: 'RF-001', patientId: 'P001', odSphere: -2.5, osSphere: -2.25, method: 'auto', createdAt: nowIso() }])),
  http.get(`${API_BASE}/eye/optometry/orders/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), patientId: 'P001', lensType: 'progressive', status: 'in_production', createdAt: nowIso() })),
  http.get(`${API_BASE}/eye/subspecialty/:sub/records`, ({ params }) => HttpResponse.json([{ id: `SR-${String(params.sub)}-001`, subspecialty: String(params.sub), patientId: 'P001', summary: '随访记录', createdAt: nowIso() }])),
  http.post(`${API_BASE}/eye/subspecialty/:sub/records`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: `SR-${String(params.sub)}-${Date.now()}`, subspecialty: String(params.sub), ...body, createdAt: nowIso() })
  }),
  http.post(`${API_BASE}/eye/pacs/measurements/export-sr`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ok: true, studyUid: body.studyUid ?? '1.2.3', objectUrl: '/api/v1/eye/pacs/measurements/export-sr/result.dcm', createdAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 23) Finance (overview / daily-trend / by-modality / AR / charge-items)
// ═══════════════════════════════════════════════════════════════════════════
const chargeItems: any[] = [
  { id: 'CI-001', name: '胸部 CT 平扫', category: '影像检查', unitPrice: 260, insuranceEligible: true, active: true },
  { id: 'CI-002', name: '颅脑 MR 平扫', category: '影像检查', unitPrice: 480, insuranceEligible: true, active: true },
]
const financeHandlers = [
  http.get(`${API_BASE}/finance/overview`, () => HttpResponse.json({ period: 'month', income: 286500, receivable: 42800, cost: 158000, profit: 128500, invoiceCount: 320, paidCount: 268, unpaidCount: 52, lastMonthIncome: 264000, incomeChangePercent: 8.5, byStatus: { PAID: 268, UNPAID: 52 }, categoryBreakdown: [{ category: '影像检查', amount: 210000, count: 240 }, { category: '材料', amount: 76500, count: 80 }] })),
  http.get(`${API_BASE}/finance/by-modality`, () => {
    const totalAmount = 286500
    const items = [{ modality: 'CT', amount: 128000, count: 180 }, { modality: 'MR', amount: 96000, count: 90 }, { modality: 'DR', amount: 62500, count: 210 }].map((x) => ({ ...x, percent: Math.round((x.amount / totalAmount) * 1000) / 10 }))
    return HttpResponse.json({ items, totalAmount })
  }),
  http.get(`${API_BASE}/finance/accounts-receivable`, () => HttpResponse.json({ totalReceivable: 42800, totalCount: 52, aging: [{ label: '0-30天', amount: 26000, count: 30 }, { label: '31-60天', amount: 12800, count: 15 }, { label: '60天+', amount: 4000, count: 7 }], topReceivables: [{ id: 'INV-001', invoiceNumber: 'INV-2026-001', patientId: 'P001', amount: 1860, status: 'UNPAID', issuedAt: dateOnly(-12) }] })),
  http.get(`${API_BASE}/finance/daily-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    let cumulative = 0
    const items = range(days, (i) => {
      const income = 6000 + (i % 7) * 800
      cumulative += income
      return { date: dateOnly(i - days + 1), income, receivable: 1200 + (i % 4) * 200, count: 8 + (i % 6), cumulativeIncome: cumulative }
    })
    return HttpResponse.json({ items, total: items.length })
  }),
  http.put(`${API_BASE}/finance/charge-items/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const item = chargeItems.find((x) => x.id === String(params.id))
    if (item) Object.assign(item, body)
    return HttpResponse.json(item ?? { id: String(params.id), ...body })
  }),
  http.delete(`${API_BASE}/finance/charge-items/:id`, ({ params }) => {
    const idx = chargeItems.findIndex((x) => x.id === String(params.id))
    if (idx >= 0) chargeItems.splice(idx, 1)
    return HttpResponse.json({ id: String(params.id) })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 24) Follow-ups (detail / result / from-report)
// ═══════════════════════════════════════════════════════════════════════════
const followups: any[] = [
  { id: 'FU-001', patientId: 'P001', patientName: '张伟', reportId: 'RPT-0001', status: 'PENDING', nextDate: dateOnly(14), note: '3 个月后复查', createdAt: nowIso() },
  { id: 'FU-002', patientId: 'P003', patientName: '王强', reportId: 'RPT-0003', status: 'COMPLETED', nextDate: dateOnly(-5), note: '结节随访', createdAt: nowIso() },
]
const followupHandlers = [
  http.post(`${API_BASE}/followups/from-report`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `FU-${followups.length + 1}`, patientId: String(body.patientId ?? 'P001'), patientName: '张伟', reportId: String(body.reportId ?? 'RPT-0001'), status: 'PENDING', nextDate: String(body.nextDate ?? dateOnly(30)), note: String(body.note ?? ''), createdAt: nowIso() }
    followups.unshift(record)
    return HttpResponse.json(record)
  }),
  http.get(`${API_BASE}/followups/:id`, ({ params }) => HttpResponse.json(followups.find((f) => f.id === String(params.id)) ?? followups[0])),
  http.post(`${API_BASE}/followups/:id/result`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const f = followups.find((x) => x.id === String(params.id))
    if (f) { f.status = 'COMPLETED'; f.result = body.result ?? 'normal' }
    return HttpResponse.json({ ok: true, id: String(params.id), status: 'COMPLETED', result: body.result ?? 'normal' })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 25) Fusion V2 / Fusion
// ═══════════════════════════════════════════════════════════════════════════
const fusionHandlers = [
  http.get(`${API_BASE}/fusion-v2/series/:patientId`, ({ params }) => HttpResponse.json({ patientId: String(params.patientId), series: [{ id: 'FS-001', modality: 'CT', count: 120 }, { id: 'FS-002', modality: 'PET', count: 90 }] })),
  http.post(`${API_BASE}/fusion-v2/register`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ registrationId: `FR-${Date.now()}`, fixedSeriesId: body.fixedSeriesId ?? 'FS-001', movingSeriesId: body.movingSeriesId ?? 'FS-002', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], status: 'registered' })
  }),
  http.post(`${API_BASE}/fusion-v2/render`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ renderId: `RD-${Date.now()}`, registrationId: body.registrationId ?? 'FR-1', imageUrl: '/mock-images/fusion-render.png', status: 'ready' })
  }),
  http.get(`${API_BASE}/fusion/registration/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), status: 'completed', matrix: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], createdAt: nowIso() })),
  http.delete(`${API_BASE}/fusion/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), deleted: true })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 26) Hanging protocols detail
// ═══════════════════════════════════════════════════════════════════════════
const hangingHandlers = [
  http.get(`${API_BASE}/hanging/protocols/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), name: '胸部 CT 默认布局', modality: 'CT', bodyPart: '胸部', layout: '2x2', createdAt: nowIso() })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 27) Health
// ═══════════════════════════════════════════════════════════════════════════
const healthHandlers = [
  http.get(`${API_BASE}/health`, () => HttpResponse.json({ status: 'ok', service: 'g005-ris', mode: 'mock', uptimeSec: 3600, timestamp: nowIso() })),
  http.get(`${API_BASE}/health/ready`, () => HttpResponse.json({ status: 'ready', checks: { database: 'ok', storage: 'ok', pacs: 'ok' } })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 28) HL7 integration stats
// ═══════════════════════════════════════════════════════════════════════════
const hl7Handlers = [
  http.get(`${API_BASE}/hl7/overview`, () => HttpResponse.json({ inbound: 1280, outbound: 960, failed: 12, pending: 4, successRate: 99.1, last24h: 86 })),
  http.get(`${API_BASE}/hl7/message-types`, () => HttpResponse.json([{ type: 'ORU^R01', count: 820, direction: 'OUTBOUND' }, { type: 'ORM^O01', count: 460, direction: 'INBOUND' }, { type: 'ADT^A01', count: 320, direction: 'INBOUND' }])),
  http.get(`${API_BASE}/hl7/error-analysis`, () => HttpResponse.json({ total: 12, byType: { parse_error: 5, timeout: 4, ack_failed: 3 }, topErrors: [{ code: 'PARSE', message: 'MSH 段缺失', count: 5 }] })),
  http.get(`${API_BASE}/hl7/throughput`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    return HttpResponse.json(range(days, (i) => ({ date: dateOnly(i - days + 1), inbound: 40 + (i % 9), outbound: 30 + (i % 7) })))
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 29) Kiosk check-in
// ═══════════════════════════════════════════════════════════════════════════
const kioskHandlers = [
  http.post(`${API_BASE}/kiosk/patients/:id/checkin`, ({ params }) => HttpResponse.json({ ok: true, patientId: String(params.id), checkedInAt: nowIso(), queueNumber: 'A012' })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 30) NLP
// ═══════════════════════════════════════════════════════════════════════════
const nlpHandlers = [
  http.post(`${API_BASE}/nlp/spellcheck`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const text = String(body.text ?? '')
    return HttpResponse.json({ text, corrected: text, issues: [] })
  }),
  http.post(`${API_BASE}/nlp/terminology`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const text = String(body.text ?? '')
    return HttpResponse.json({ text, terms: text ? [{ term: text.slice(0, 4), code: 'R90.0', system: 'ICD-10', score: 0.9 }] : [] })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 31) Notification preferences
// ═══════════════════════════════════════════════════════════════════════════
const notifPrefs: Record<string, any> = {}
const notificationHandlers = [
  http.get(`${API_BASE}/notifications/preferences/:userId`, ({ params }) => {
    const userId = String(params.userId)
    return HttpResponse.json(notifPrefs[userId] ?? { userId, channels: { inApp: true, email: true, sms: false, push: true }, severities: ['INFO', 'WARN', 'ERROR', 'CRITICAL'], quietHours: null })
  }),
  http.put(`${API_BASE}/notifications/preferences/:userId`, async ({ params, request }) => {
    const userId = String(params.userId)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    notifPrefs[userId] = { userId, ...body }
    return HttpResponse.json(notifPrefs[userId])
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 32) Occupancy
// ═══════════════════════════════════════════════════════════════════════════
const occupancyHandlers = [
  http.get(`${API_BASE}/occupancy/overview`, () => HttpResponse.json({ totalRooms: 12, occupied: 8, available: 3, maintenance: 1, occupancyRate: 66.7, currentPatients: 8 })),
  http.get(`${API_BASE}/occupancy/by-shift`, () => HttpResponse.json([{ shift: 'morning', occupied: 9, rate: 75 }, { shift: 'afternoon', occupied: 7, rate: 58.3 }, { shift: 'night', occupied: 3, rate: 25 }])),
  http.get(`${API_BASE}/occupancy/daily-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    return HttpResponse.json(range(days, (i) => ({ date: dateOnly(i - days + 1), occupied: 5 + (i % 6), rate: 45 + (i % 5) * 8 })))
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 33) OEE (equipment effectiveness)
// ═══════════════════════════════════════════════════════════════════════════
const oeeHandlers = [
  http.get(`${API_BASE}/oee/overview`, () => HttpResponse.json({ availability: 0.94, performance: 0.88, quality: 0.97, oee: 0.8, totalRuntimeMin: 1420, downtimeMin: 86 })),
  http.get(`${API_BASE}/oee/by-modality`, () => HttpResponse.json([{ modality: 'CT', oee: 0.82, availability: 0.95, performance: 0.9, quality: 0.96 }, { modality: 'MR', oee: 0.78, availability: 0.92, performance: 0.87, quality: 0.97 }])),
  http.get(`${API_BASE}/oee/daily-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    return HttpResponse.json(range(days, (i) => ({ date: dateOnly(i - days + 1), oee: 0.75 + (i % 5) * 0.02, availability: 0.9, performance: 0.88, quality: 0.96 })))
  }),
  http.get(`${API_BASE}/oee/:id/downtime-analysis`, ({ params }) => HttpResponse.json({ deviceId: String(params.id), totalDowntimeMin: 86, byReason: [{ reason: 'maintenance', minutes: 50 }, { reason: 'fault', minutes: 36 }], incidents: [{ id: 'DT-001', reason: 'maintenance', minutes: 50, at: nowIso() }] })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 34) Orchestrator SLA update
// ═══════════════════════════════════════════════════════════════════════════
const orchestratorHandlers = [
  http.put(`${API_BASE}/orchestrator/sla`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ok: true, sla: body, updatedAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 35) PACS admin server detail
// ═══════════════════════════════════════════════════════════════════════════
const pacsAdminHandlers = [
  http.get(`${API_BASE}/pacs-admin/servers/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), name: `PACS-${String(params.id)}`, host: '10.0.0.21', port: 104, aeTitle: 'G005_PACS', status: 'online', lastSyncAt: nowIso() })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 36) Patient portal education detail
// ═══════════════════════════════════════════════════════════════════════════
const patientPortalHandlers = [
  http.get(`${API_BASE}/patient-portal/education/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), title: '胸部 CT 检查注意事项', category: '检查须知', content: '检查前请去除金属物品，配合屏气。', readAt: null, createdAt: nowIso() })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 37) Queue priority
// ═══════════════════════════════════════════════════════════════════════════
const queueHandlers = [
  http.post(`${API_BASE}/queue/:id/priority`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ok: true, id: String(params.id), priority: body.priority ?? 'high', updatedAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 38) Regional integration & reports
// ═══════════════════════════════════════════════════════════════════════════
const regionalHandlers = [
  http.get(`${API_BASE}/regional/integration/fhir`, () => HttpResponse.json({ enabled: true, endpoint: 'https://fhir.regional.local/r4', status: 'connected', lastSyncAt: nowIso() })),
  http.get(`${API_BASE}/regional/integration/ihe`, () => HttpResponse.json({ enabled: true, endpoint: 'https://ihe.regional.local', status: 'connected', lastSyncAt: nowIso() })),
  http.get(`${API_BASE}/regional/integration/mllp`, () => HttpResponse.json({ enabled: true, host: 'mllp.regional.local', port: 2575, status: 'connected', lastSyncAt: nowIso() })),
  http.get(`${API_BASE}/regional/reports`, () => HttpResponse.json(reportStore.map((r) => ({ id: r.id, patientName: r.patientName, state: r.state, modality: r.modality, bodyPart: r.bodyPart, createdAt: r.createdAt })))),
  http.get(`${API_BASE}/regional/reports/:id`, ({ params }) => {
    const r = reportStore.find((x) => x.id === String(params.id)) ?? reportStore[0]
    return HttpResponse.json({ ...r, region: '区域医联体', sharedAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 39) Report quality extended
// ═══════════════════════════════════════════════════════════════════════════
const defectLibrary: any[] = [
  { id: 'DF-001', code: 'DF-MISS', name: '漏项', category: 'completeness', severity: 'major', description: '报告缺少必要字段', createdAt: nowIso() },
  { id: 'DF-002', code: 'DF-TYPO', name: '错别字', category: 'language', severity: 'minor', description: '文字拼写错误', createdAt: nowIso() },
]
const scoreRules: any[] = [
  { id: 'SR-001', name: '完整性', weight: 0.4, maxScore: 40, enabled: true },
  { id: 'SR-002', name: '规范性', weight: 0.3, maxScore: 30, enabled: true },
]
const reportQualityHandlers = [
  http.get(`${API_BASE}/report-quality-ext/stats`, () => HttpResponse.json({ totalEvaluated: 420, avgScore: 88.5, passRate: 92.1, byGrade: { A: 180, B: 160, C: 60, D: 20 }, trend: range(7, (i) => ({ date: dateOnly(i - 6), avgScore: 86 + i * 0.3 })) })),
  http.get(`${API_BASE}/report-quality-ext/defect-library`, () => HttpResponse.json(defectLibrary)),
  http.post(`${API_BASE}/report-quality-ext/defect-library`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `DF-${defectLibrary.length + 1}`, code: String(body.code ?? ''), name: String(body.name ?? '缺陷'), category: String(body.category ?? 'other'), severity: String(body.severity ?? 'minor'), description: String(body.description ?? ''), createdAt: nowIso() }
    defectLibrary.push(record)
    return HttpResponse.json(record)
  }),
  http.put(`${API_BASE}/report-quality-ext/defect-library/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const item = defectLibrary.find((x) => x.id === String(params.id))
    if (item) Object.assign(item, body)
    return HttpResponse.json(item ?? { id: String(params.id), ...body })
  }),
  http.get(`${API_BASE}/report-quality-ext/score-rules`, () => HttpResponse.json(scoreRules)),
  http.post(`${API_BASE}/report-quality-ext/score-rules`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `SR-${scoreRules.length + 1}`, name: String(body.name ?? '评分规则'), weight: Number(body.weight ?? 0.2), maxScore: Number(body.maxScore ?? 20), enabled: body.enabled !== false }
    scoreRules.push(record)
    return HttpResponse.json(record)
  }),
  http.put(`${API_BASE}/report-quality-ext/score-rules/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const item = scoreRules.find((x) => x.id === String(params.id))
    if (item) Object.assign(item, body)
    return HttpResponse.json(item ?? { id: String(params.id), ...body })
  }),
  http.get(`${API_BASE}/report-quality-ext/ai-report-drafts`, () => HttpResponse.json([])),
  http.post(`${API_BASE}/report-quality-ext/ai-report-drafts`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: `AID-${Date.now()}`, reportId: body.reportId ?? 'RPT-0001', draftText: '双肺纹理清晰，未见明显实质性病变。', confidence: 0.9, createdAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 40) Terminology
// ═══════════════════════════════════════════════════════════════════════════
const termHandlers = [
  http.get(`${API_BASE}/terms/category-tree`, () => HttpResponse.json([{ key: 'anatomy', name: '解剖部位', children: [{ key: 'chest', name: '胸部' }, { key: 'brain', name: '颅脑' }] }, { key: 'finding', name: '征象', children: [] }])),
  http.get(`${API_BASE}/terms/extracted`, () => HttpResponse.json([{ term: '肺结节', count: 42, code: 'R91.1', system: 'ICD-10' }, { term: '胸腔积液', count: 18, code: 'J90', system: 'ICD-10' }])),
  http.get(`${API_BASE}/terms/synonyms`, () => HttpResponse.json([{ term: '肺结节', synonyms: ['肺部结节', 'pulmonary nodule'] }, { term: '胸腔积液', synonyms: ['胸水', 'pleural effusion'] }])),
  http.get(`${API_BASE}/terms/translations`, () => HttpResponse.json([{ zh: '肺结节', en: 'pulmonary nodule' }, { zh: '胸腔积液', en: 'pleural effusion' }])),
  http.get(`${API_BASE}/terms/suggestions`, () => HttpResponse.json([{ term: '肺结节', score: 0.95, source: 'history' }, { term: '肺气肿', score: 0.82, source: 'dictionary' }])),
]

// ═══════════════════════════════════════════════════════════════════════════
// 41) Triage update
// ═══════════════════════════════════════════════════════════════════════════
const triageHandlers = [
  http.put(`${API_BASE}/triage/:id`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: String(params.id), ...body, updatedAt: nowIso() })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 42) Typical cases
// ═══════════════════════════════════════════════════════════════════════════
const typicalCases: any[] = [
  { id: 'TC-001', title: '典型肺腺癌', modality: 'CT', bodyPart: '胸部', difficulty: 'medium', tags: ['肿瘤', '胸部'], createdAt: nowIso() },
]
const typicalCaseHandlers = [
  http.get(`${API_BASE}/typical-cases`, () => HttpResponse.json(typicalCases)),
  http.post(`${API_BASE}/typical-cases`, async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const record = { id: `TC-${typicalCases.length + 1}`, title: String(body.title ?? '典型病例'), modality: String(body.modality ?? 'CT'), bodyPart: String(body.bodyPart ?? ''), difficulty: String(body.difficulty ?? 'medium'), tags: body.tags ?? [], createdAt: nowIso() }
    typicalCases.unshift(record)
    return HttpResponse.json(record)
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 43) Users (activity / reset-password)
// ═══════════════════════════════════════════════════════════════════════════
const userHandlers = [
  http.get(`${API_BASE}/users/:id/activity`, ({ params }) => HttpResponse.json({ userId: String(params.id), total: 128, lastLoginAt: nowIso(), actions: [{ action: 'login', count: 42 }, { action: 'report.create', count: 30 }, { action: 'report.sign', count: 18 }] })),
  http.post(`${API_BASE}/users/:id/reset-password`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ ok: true, userId: String(params.id), temporaryPassword: String(body.newPassword ?? 'Temp@1234'), mustChange: true })
  }),
]

// ═══════════════════════════════════════════════════════════════════════════
// 44) VNA extended
// ═══════════════════════════════════════════════════════════════════════════
const vnaHandlers = [
  http.get(`${API_BASE}/vna/overview`, () => HttpResponse.json({ totalObjects: 1860, totalSizeBytes: 4_286_000_000_000, dicomCount: 1520, nonDicomCount: 340, wormLockedCount: 210, studyCount: 420, byTier: [{ tier: 'hot', count: 900, sizeBytes: 2_100_000_000_000, percent: 48.4 }, { tier: 'warm', count: 700, sizeBytes: 1_600_000_000_000, percent: 37.6 }, { tier: 'cold', count: 260, sizeBytes: 586_000_000_000, percent: 14 }, ], last30dNewObjects: 126, growthRate: 6.8, storageSource: 'memory', seeded: true })),
  http.get(`${API_BASE}/vna/storage-trend`, ({ request }) => {
    const days = clampDays(new URL(request.url).searchParams.get('days'))
    let total = 4_000_000_000_000
    return HttpResponse.json(range(days, (i) => {
      total += 12_000_000_000
      return { date: dateOnly(i - days + 1), label: dateOnly(i - days + 1), newObjects: 4 + (i % 5), addedBytes: 12_000_000_000, totalSizeBytes: total, seeded: true }
    }))
  }),
  http.get(`${API_BASE}/vna/by-tier`, () => HttpResponse.json([{ tier: 'hot', tierZh: '热层 (SSD 在线)', count: 900, sizeBytes: 2_100_000_000_000, percent: 48.4, documents: 160, images: 740 }, { tier: 'warm', tierZh: '温层 (近线 HDD)', count: 700, sizeBytes: 1_600_000_000_000, percent: 37.6, documents: 120, images: 580 }, { tier: 'cold', tierZh: '冷层 (冷归档)', count: 260, sizeBytes: 586_000_000_000, percent: 14, documents: 60, images: 200 }])),
  http.get(`${API_BASE}/vna/duplicate-analysis`, () => HttpResponse.json({ totalDuplicates: 18, wastedBytes: 2_400_000_000, seeded: true, groups: [{ name: 'chest-ct-001.dcm', size: 240_000_000, count: 3, wastedBytes: 480_000_000, objectIds: ['OBJ-001', 'OBJ-002', 'OBJ-003'], createdAt: nowIso() }] })),
  http.post(`${API_BASE}/vna/objects/:id/verify`, ({ params }) => HttpResponse.json({ object: { id: String(params.id), patientId: 'P001', studyUid: '1.2.3', objectType: 'image', name: 'chest-ct-001.dcm', description: '胸部 CT', mimeType: 'application/dicom', size: 240_000_000, storagePath: null, wormLocked: true, createdAt: nowIso(), storageSource: 'memory', tier: 'hot' }, verifiedAt: nowIso(), checksum: 'sha256:9f2a...', sizeBytes: 240_000_000, expectedSizeBytes: 240_000_000, sizeMatch: true, status: 'integrity-ok' })),
]

// ═══════════════════════════════════════════════════════════════════════════
// 45) Workflow (definition steps / routing rule delete)
// ═══════════════════════════════════════════════════════════════════════════
const workflowHandlers = [
  http.post(`${API_BASE}/workflow/definitions/:definitionId/steps`, async ({ params, request }) => {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ definitionId: String(params.definitionId), stepId: `STEP-${Date.now()}`, name: String(body.name ?? '新步骤'), order: Number(body.order ?? 1), assigneeRole: String(body.assigneeRole ?? 'radiologist'), createdAt: nowIso() })
  }),
  http.delete(`${API_BASE}/workflow/routing-rules/:id`, ({ params }) => HttpResponse.json({ id: String(params.id), deleted: true })),
]

export const w5MissingHandlers = [
  ...worklistHandlers,
  ...examHandlers,
  ...patientHandlers,
  ...reportHandlers,
  ...aiDiagnosisHandlers,
  ...aiDraftHandlers,
  ...auditHandlers,
  ...mfaHandlers,
  ...autoCollectionHandlers,
  ...clinicalFeedbackHandlers,
  ...consentEducationHandlers,
  ...cosignHandlers,
  ...criticalAlertHandlers,
  ...criticalStatsHandlers,
  ...dentalHandlers,
  ...deviceHandlers,
  ...srHandlers,
  ...dicomWebHandlers,
  ...dualReadHandlers,
  ...exportApprovalHandlers,
  ...eyeHandlers,
  ...financeHandlers,
  ...followupHandlers,
  ...fusionHandlers,
  ...hangingHandlers,
  ...healthHandlers,
  ...hl7Handlers,
  ...kioskHandlers,
  ...nlpHandlers,
  ...notificationHandlers,
  ...occupancyHandlers,
  ...oeeHandlers,
  ...orchestratorHandlers,
  ...pacsAdminHandlers,
  ...patientPortalHandlers,
  ...queueHandlers,
  ...regionalHandlers,
  ...reportQualityHandlers,
  ...termHandlers,
  ...triageHandlers,
  ...typicalCaseHandlers,
  ...userHandlers,
  ...vnaHandlers,
  ...workflowHandlers,
]
