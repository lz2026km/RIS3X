// [v3.0.6.11-106] 缺失端点 MSW handlers (教学病例库 / 科研导出 / 随访催办队列)
// 数据确定性 (无 Math.random)。
import { http, HttpResponse, delay } from 'msw'

const API = '/api/v1'

// ── 教学病例库 (teaching-case) ───────────────────────────
const CATEGORIES = [
  { key: 'disease', label: '病种', children: [{ key: 'tumor', label: '肿瘤' }, { key: 'inflammation', label: '炎症' }, { key: 'trauma', label: '外伤' }] },
  { key: 'bodyPart', label: '部位', children: [{ key: 'head', label: '头部' }, { key: 'chest', label: '胸部' }, { key: 'abdomen', label: '腹部' }] },
  { key: 'difficulty', label: '难度', children: [{ key: 'basic', label: '基础' }, { key: 'intermediate', label: '进阶' }, { key: 'advanced', label: '高级' }] },
  { key: 'tag', label: '标签', children: [{ key: 'typical', label: '典型' }, { key: 'rare', label: '罕见' }] },
]

const DISEASES = ['肺结节', '肺炎', '肺癌']

function buildCase(i: number) {
  const disease = DISEASES[i % 3]!
  return {
    id: `TCL-${String(i + 1).padStart(4, '0')}`,
    title: `教学病例 ${i + 1} · 胸部CT`,
    patientId: `P${String(i + 1).padStart(4, '0')}`,
    patientName: `患者${i + 1}`,
    age: 40 + (i % 30),
    gender: i % 2 === 0 ? '男' : '女',
    modality: 'CT',
    bodyPart: '胸部',
    disease,
    diseaseType: i % 3 === 1 ? '炎症' : '肿瘤',
    difficulty: ['基础', '进阶', '高级'][i % 3],
    category: '病种',
    tags: ['典型', 'CT'],
    keyPoints: ['注意病灶边缘与强化特征', '结合病史判断性质', '建议规范随访'],
    findings: '右肺上叶见结节影，边界清晰',
    impression: '右肺上叶结节，建议随访',
    diagnosis: disease,
    teaching: true,
    shared: i % 4 === 0,
    favorites: 5 + (i % 10),
    views: 50 + i * 3,
    comments: i % 5,
    createdAt: `2026-0${(i % 9) + 1}-1${i % 9}`,
    createdBy: '张医师',
    status: 'published',
  }
}
const CASES = Array.from({ length: 24 }, (_, i) => buildCase(i))

let wrongBook = Array.from({ length: 5 }, (_, i) => ({
  id: `WB-${i + 1}`,
  caseId: `TCL-${String(i + 1).padStart(4, '0')}`,
  title: `教学病例 ${i + 1} · 胸部CT`,
  wrongAnswer: '肺炎',
  correctAnswer: '肺结节',
  times: i + 1,
  lastWrongAt: '2026-09-10',
}))

const exams: Record<string, { id: string; caseIds: string[] }> = {}

export const miscMissingHandlers = [
  // ── teach ───────────────────────────────────────────────
  http.get(`${API}/teach/cases`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const page = Number(url.searchParams.get('page') ?? 1)
    const pageSize = Number(url.searchParams.get('pageSize') ?? 20)
    const start = (page - 1) * pageSize
    return HttpResponse.json({ items: CASES.slice(start, start + pageSize), total: CASES.length, page, pageSize })
  }),
  http.post(`${API}/teach/case`, async ({ request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const item = { ...buildCase(CASES.length), ...body, id: `TCL-${Date.now().toString(36).toUpperCase()}` }
    CASES.unshift(item)
    return HttpResponse.json(item)
  }),
  http.get(`${API}/teach/case/:id`, async ({ params }) => {
    await delay(100)
    const found = CASES.find((x) => x.id === String(params.id))
    return found ? HttpResponse.json(found) : HttpResponse.json({ message: 'not found' }, { status: 404 })
  }),
  http.patch(`${API}/teach/case/:id`, async ({ params, request }) => {
    await delay(120)
    const found = CASES.find((x) => x.id === String(params.id))
    if (!found) return HttpResponse.json({ message: 'not found' }, { status: 404 })
    Object.assign(found, await request.json().catch(() => ({})))
    return HttpResponse.json(found)
  }),
  http.delete(`${API}/teach/case/:id`, async ({ params }) => {
    await delay(100)
    const idx = CASES.findIndex((x) => x.id === String(params.id))
    if (idx >= 0) CASES.splice(idx, 1)
    return HttpResponse.json({ deleted: String(params.id) })
  }),
  http.get(`${API}/teach/categories`, async () => {
    await delay(80)
    return HttpResponse.json(CATEGORIES)
  }),
  http.get(`${API}/teach/stats`, async () => {
    await delay(100)
    return HttpResponse.json({
      total: CASES.length,
      teachingCases: CASES.filter((c) => c.teaching).length,
      pendingReview: 3,
      totalViews: CASES.reduce((s, c) => s + c.views, 0),
      totalFavorites: CASES.reduce((s, c) => s + c.favorites, 0),
      totalShared: CASES.filter((c) => c.shared).length,
      totalComments: CASES.reduce((s, c) => s + c.comments, 0),
    })
  }),
  http.get(`${API}/teach/wrong-book`, async () => {
    await delay(80)
    return HttpResponse.json(wrongBook)
  }),
  http.delete(`${API}/teach/wrong-book`, async () => {
    await delay(60)
    const cleared = wrongBook.length
    wrongBook = []
    return HttpResponse.json({ cleared })
  }),
  http.post(`${API}/teach/exam/generate`, async ({ request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as { count?: number }
    const count = Math.min(10, Math.max(1, Number(body?.count ?? 5)))
    const id = `EXAM-${Date.now().toString(36).toUpperCase()}`
    const picked = CASES.slice(0, count)
    exams[id] = { id, caseIds: picked.map((c) => c.id) }
    return HttpResponse.json({
      id,
      questions: picked.map((c, i) => ({
        index: i + 1,
        caseId: c.id,
        title: c.title,
        prompt: c.findings,
        options: [
          { key: 'A', text: c.diagnosis },
          { key: 'B', text: '肺炎' },
          { key: 'C', text: '肺气肿' },
          { key: 'D', text: '胸膜炎' },
        ],
        answer: 'A',
      })),
    })
  }),
  http.post(`${API}/teach/exam/submit`, async ({ request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as { examId?: string; answers?: Record<string, string> }
    const exam = exams[body?.examId ?? '']
    const total = exam ? exam.caseIds.length : Object.keys(body?.answers ?? {}).length || 1
    const correct = Math.max(0, total - 1)
    const score = Math.round((correct / total) * 100)
    return HttpResponse.json({ examId: body?.examId ?? '', total, correct, wrong: total - correct, score, passed: score >= 60, details: [] })
  }),
  http.get(`${API}/teach/case/:id/comments`, async ({ params }) => {
    await delay(80)
    return HttpResponse.json([{ id: 'TC-001', caseId: String(params.id), author: '李医师', content: '典型病例，学习了', createdAt: '2026-09-10 10:00' }])
  }),
  http.post(`${API}/teach/case/:id/comments`, async ({ params, request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as { content?: string }
    return HttpResponse.json({ id: `TC-${Date.now()}`, caseId: String(params.id), author: '当前用户', content: body?.content ?? '', createdAt: new Date().toISOString().slice(0, 16).replace('T', ' ') })
  }),
  http.post(`${API}/teach/case/:id/share`, async ({ params }) => {
    await delay(100)
    const token = `share-${String(params.id).toLowerCase()}`
    return HttpResponse.json({ id: String(params.id), shareToken: token, shareUrl: `https://ris.example.com/teach/share/${token}`, qrData: token })
  }),
  http.get(`${API}/teach/share/:token`, async () => {
    await delay(100)
    const found = CASES[0]
    return found ? HttpResponse.json(found) : HttpResponse.json({ message: 'not found' }, { status: 404 })
  }),

  // ── research export ─────────────────────────────────────
  http.get(`${API}/research/datasets`, async () => {
    await delay(100)
    return HttpResponse.json([
      { id: 'DS-001', name: '肺结节数据集', criteria: { modality: 'CT', disease: '肺结节' }, recordCount: 128, createdAt: '2026-09-01' },
      { id: 'DS-002', name: '脑卒中数据集', criteria: { modality: 'CT', disease: '脑梗死' }, recordCount: 86, createdAt: '2026-09-08' },
    ])
  }),
  http.post(`${API}/research/datasets/build`, async ({ request }) => {
    await delay(180)
    const body = (await request.json().catch(() => ({}))) as { name?: string; criteria?: Record<string, unknown> }
    return HttpResponse.json({ id: `DS-${Date.now().toString(36).toUpperCase()}`, name: body?.name ?? '新数据集', criteria: body?.criteria ?? {}, recordCount: 96, createdAt: new Date().toISOString().slice(0, 10) })
  }),
  http.get(`${API}/research/export-fields`, async () => {
    await delay(80)
    return HttpResponse.json([
      { group: '患者信息', fields: [{ key: 'patientId', label: '患者ID' }, { key: 'gender', label: '性别' }, { key: 'age', label: '年龄' }] },
      { group: '检查信息', fields: [{ key: 'examItem', label: '检查项目' }, { key: 'modality', label: '模态' }, { key: 'examDate', label: '检查日期' }] },
      { group: '报告信息', fields: [{ key: 'findings', label: '所见' }, { key: 'impression', label: '结论' }, { key: 'diagnosis', label: '诊断' }] },
    ])
  }),
  http.get(`${API}/research/export/tasks`, async () => {
    await delay(100)
    return HttpResponse.json([
      { id: 'ET-001', name: '肺结节导出', format: 'csv', status: 'COMPLETED', recordCount: 128, createdAt: '2026-09-10 09:30', createdBy: '张医师' },
      { id: 'ET-002', name: '脑卒中导出', format: 'json', status: 'RUNNING', recordCount: 0, createdAt: '2026-09-14 10:00', createdBy: '李医师' },
    ])
  }),
  http.post(`${API}/research/export/tasks`, async ({ request }) => {
    await delay(160)
    const body = (await request.json().catch(() => ({}))) as { name?: string; format?: string }
    return HttpResponse.json({ id: `ET-${Date.now().toString(36).toUpperCase()}`, name: body?.name ?? '导出任务', format: body?.format ?? 'csv', status: 'PENDING', recordCount: 0, createdAt: new Date().toISOString().slice(0, 16).replace('T', ' '), createdBy: '当前用户' })
  }),
  http.get(`${API}/research/export/tasks/:id`, async ({ params }) => {
    await delay(80)
    return HttpResponse.json({ id: String(params.id), name: '导出任务', format: 'csv', status: 'COMPLETED', recordCount: 128, createdAt: '2026-09-10 09:30', createdBy: '张医师' })
  }),
  http.get(`${API}/research/export/tasks/:id/content`, async ({ params }) => {
    await delay(120)
    return HttpResponse.json({ id: String(params.id), format: 'csv', filename: `export-${String(params.id)}.csv`, content: '患者ID,性别,年龄,检查项目\nP0001,男,56,胸部CT' })
  }),
  http.get(`${API}/research/export/stats`, async () => {
    await delay(100)
    return HttpResponse.json({
      total: 2,
      completed: 1,
      running: 1,
      failed: 0,
      byFormat: { CSV: 1, JSON: 1, EXCEL: 0 },
      formatDistribution: [{ format: 'csv', count: 1 }, { format: 'json', count: 1 }],
      last7Days: [{ date: '2026-09-10', count: 1 }, { date: '2026-09-14', count: 1 }],
    })
  }),

  // ── 随访催办队列 ─────────────────────────────────────────
  http.get(`${API}/followups/reminder-queue`, async () => {
    await delay(100)
    const mk = (id: string, queueType: string, name: string, dueDate: string, state: string) => ({ id: `FU-${id}`, patientId: `P${id}`, patientName: name, followupType: '复查', dueDate, state, queueType })
    const overdue = [mk('001', 'overdue', '张伟', '2026-09-01', 'PENDING'), mk('002', 'overdue', '李娜', '2026-09-05', 'REMINDED')]
    const dueToday = [mk('003', 'dueToday', '王芳', '2026-09-15', 'PENDING')]
    const upcoming = [mk('004', 'upcoming', '赵刚', '2026-09-18', 'PENDING'), mk('005', 'upcoming', '孙丽', '2026-09-20', 'PENDING')]
    return HttpResponse.json({ items: [...overdue, ...dueToday, ...upcoming], total: 5, days: 7, overdue: overdue.length, dueToday: dueToday.length, upcoming: upcoming.length, queueType: 'overdue' })
  }),
]
