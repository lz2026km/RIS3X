// [G005 Wave 6C v3.0.6.11-101] /api/v1/template-approval MSW handlers
// 对齐后端 template-approval.module + templateApprovalApi (报告模板审批流: draft/pending/approved/rejected/published)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/template-approval`

type TemplateStateV2 = 'draft' | 'pending' | 'approved' | 'rejected' | 'published'
type ApprovalActionV2 = 'submit' | 'approve' | 'reject' | 'publish' | 'rework'

interface TemplateVersionV2 { version: number; name: string; content: string; category: string; bodyPart: string; changedBy: string; note: string; at: string }
interface TemplateApprovalRecordV2 { id: string; templateId: string; action: ApprovalActionV2; actorName: string; comment?: string; at: string }
interface ApproverAssignmentV2 { dept: string; role: string; approverName: string }
interface ReportTemplateV2 {
  id: string
  name: string
  category: string
  modality?: string
  bodyPart: string
  content: string
  state: TemplateStateV2
  version: number
  versions: TemplateVersionV2[]
  approvals: TemplateApprovalRecordV2[]
  assignee?: ApproverAssignmentV2
  favoriteCount: number
  usageCount: number
  createdBy: string
  createdAt: string
  updatedAt: string
}

const SEED_TEMPLATES: ReportTemplateV2[] = [
  {
    id: 'tpl-001', name: '胸部 CT 平扫常规报告', category: 'CT', modality: 'CT', bodyPart: '胸部',
    content: '【影像所见】双肺纹理清晰，肺野未见异常密度影。纵隔位置居中，未见肿大淋巴结。\n【诊断结论】胸部 CT 平扫未见明显异常。',
    state: 'published', version: 3,
    versions: [
      { version: 1, name: '胸部 CT 平扫常规报告', content: '【影像所见】双肺纹理清晰。\n【诊断结论】未见明显异常。', category: 'CT', bodyPart: '胸部', changedBy: '张主任', note: '初版', at: '2026-06-10T08:00:00.000Z' },
      { version: 2, name: '胸部 CT 平扫常规报告', content: '【影像所见】双肺纹理清晰，肺野未见异常密度影。\n【诊断结论】胸部 CT 平扫未见明显异常。', category: 'CT', bodyPart: '胸部', changedBy: '张主任', note: '补充所见描述', at: '2026-07-02T09:00:00.000Z' },
      { version: 3, name: '胸部 CT 平扫常规报告', content: '【影像所见】双肺纹理清晰，肺野未见异常密度影。纵隔位置居中，未见肿大淋巴结。\n【诊断结论】胸部 CT 平扫未见明显异常。', category: 'CT', bodyPart: '胸部', changedBy: '张主任', note: '增加纵隔描述', at: '2026-07-20T10:00:00.000Z' },
    ],
    approvals: [
      { id: 'ap-001', templateId: 'tpl-001', action: 'submit', actorName: '张主任', comment: '提交审批', at: '2026-07-20T10:05:00.000Z' },
      { id: 'ap-002', templateId: 'tpl-001', action: 'approve', actorName: '李副院长', comment: '同意', at: '2026-07-21T09:00:00.000Z' },
      { id: 'ap-003', templateId: 'tpl-001', action: 'publish', actorName: '李副院长', comment: '发布上线', at: '2026-07-21T09:05:00.000Z' },
    ],
    assignee: { dept: '放射科', role: '科主任', approverName: '李副院长' },
    favoriteCount: 12, usageCount: 86, createdBy: '张主任',
    createdAt: '2026-06-10T08:00:00.000Z', updatedAt: '2026-07-21T09:05:00.000Z',
  },
  {
    id: 'tpl-002', name: '头颅 MRI 平扫报告', category: 'MR', modality: 'MR', bodyPart: '头颅',
    content: '【影像所见】脑实质信号未见明显异常，脑室系统形态大小正常。\n【诊断结论】头颅 MRI 平扫未见明显异常。',
    state: 'pending', version: 2,
    versions: [
      { version: 1, name: '头颅 MRI 平扫报告', content: '【影像所见】脑实质信号未见明显异常。\n【诊断结论】未见明显异常。', category: 'MR', bodyPart: '头颅', changedBy: '王医生', note: '初版', at: '2026-08-01T09:00:00.000Z' },
      { version: 2, name: '头颅 MRI 平扫报告', content: '【影像所见】脑实质信号未见明显异常，脑室系统形态大小正常。\n【诊断结论】头颅 MRI 平扫未见明显异常。', category: 'MR', bodyPart: '头颅', changedBy: '王医生', note: '细化描述', at: '2026-08-05T11:00:00.000Z' },
    ],
    approvals: [
      { id: 'ap-004', templateId: 'tpl-002', action: 'submit', actorName: '王医生', comment: '申请审批发布', at: '2026-08-05T11:05:00.000Z' },
    ],
    assignee: { dept: '放射科', role: '审核岗', approverName: '张主任' },
    favoriteCount: 5, usageCount: 32, createdBy: '王医生',
    createdAt: '2026-08-01T09:00:00.000Z', updatedAt: '2026-08-05T11:05:00.000Z',
  },
  {
    id: 'tpl-003', name: '腹部超声常规报告', category: 'US', modality: 'US', bodyPart: '腹部',
    content: '【影像所见】肝脏大小形态正常，实质回声均匀。胆囊壁光滑，腔内未见异常回声。\n【诊断结论】腹部超声未见明显异常。',
    state: 'rejected', version: 1,
    versions: [
      { version: 1, name: '腹部超声常规报告', content: '【影像所见】肝脏大小形态正常，实质回声均匀。胆囊壁光滑，腔内未见异常回声。\n【诊断结论】腹部超声未见明显异常。', category: 'US', bodyPart: '腹部', changedBy: '赵医生', note: '初版', at: '2026-07-28T14:00:00.000Z' },
    ],
    approvals: [
      { id: 'ap-005', templateId: 'tpl-003', action: 'submit', actorName: '赵医生', comment: '提交审批', at: '2026-07-28T14:05:00.000Z' },
      { id: 'ap-006', templateId: 'tpl-003', action: 'reject', actorName: '张主任', comment: '缺少测量值模板结构, 请补充', at: '2026-07-29T10:00:00.000Z' },
    ],
    favoriteCount: 2, usageCount: 0, createdBy: '赵医生',
    createdAt: '2026-07-28T14:00:00.000Z', updatedAt: '2026-07-29T10:00:00.000Z',
  },
]

let templates: ReportTemplateV2[] = [...SEED_TEMPLATES]
let tplSeq = 100
let approvalSeq = 100
const favorites = new Set<string>(['tpl-001'])

function pushVersion(t: ReportTemplateV2, content: string, changedBy: string, note: string): void {
  const at = new Date().toISOString()
  t.versions = [...t.versions, { version: t.version + 1, name: t.name, content, category: t.category, bodyPart: t.bodyPart, changedBy, note, at }]
  t.version = t.version + 1
  t.content = content
  t.updatedAt = at
}

function pushApproval(t: ReportTemplateV2, action: ApprovalActionV2, actorName: string, comment?: string): void {
  t.approvals = [...t.approvals, { id: `ap-${approvalSeq++}`, templateId: t.id, action, actorName, comment, at: new Date().toISOString() }]
}

export const templateApprovalHandlers = [
  http.get(`${API}/templates`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const state = url.searchParams.get('state')
    const category = url.searchParams.get('category')
    const keyword = url.searchParams.get('keyword')
    let items = templates
    if (state) items = items.filter((t) => t.state === state)
    if (category) items = items.filter((t) => t.category === category)
    if (keyword) items = items.filter((t) => t.name.includes(keyword))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/templates`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { name?: string; category?: string; modality?: string; bodyPart?: string; content?: string; createdBy?: string }
    const now = new Date().toISOString()
    const tpl: ReportTemplateV2 = {
      id: `tpl-${tplSeq++}`,
      name: String(body?.name ?? '未命名模板'),
      category: String(body?.category ?? '通用'),
      modality: body?.modality,
      bodyPart: String(body?.bodyPart ?? '全身'),
      content: String(body?.content ?? ''),
      state: 'draft',
      version: 1,
      versions: [{ version: 1, name: String(body?.name ?? '未命名模板'), content: String(body?.content ?? ''), category: String(body?.category ?? '通用'), bodyPart: String(body?.bodyPart ?? '全身'), changedBy: String(body?.createdBy ?? 'u-001'), note: '初版', at: now }],
      approvals: [],
      favoriteCount: 0,
      usageCount: 0,
      createdBy: String(body?.createdBy ?? 'u-001'),
      createdAt: now,
      updatedAt: now,
    }
    templates.unshift(tpl)
    return HttpResponse.json({ success: true, data: tpl })
  }),

  http.get(`${API}/templates/:id`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: t })
  }),

  http.patch(`${API}/templates/:id/content`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { name?: string; content?: string; bodyPart?: string; changedBy?: string; note?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    if (body?.name) t.name = body.name
    const content = body?.content ?? t.content
    if (body?.bodyPart) t.bodyPart = body.bodyPart
    pushVersion(t, content, String(body?.changedBy ?? t.createdBy), String(body?.note ?? '内容更新'))
    return HttpResponse.json({ success: true, data: t })
  }),

  http.get(`${API}/templates/:id/versions`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: t.versions })
  }),

  http.get(`${API}/templates/:id/approvals`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: t.approvals })
  }),

  http.post(`${API}/templates/:id/submit`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { submittedBy?: string; comment?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.state = 'pending'
    t.updatedAt = new Date().toISOString()
    pushApproval(t, 'submit', String(body?.submittedBy ?? '提交人'), body?.comment)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/approve`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { approvedBy?: string; comment?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.state = 'approved'
    t.updatedAt = new Date().toISOString()
    pushApproval(t, 'approve', String(body?.approvedBy ?? '审批人'), body?.comment)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/reject`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { rejectedBy?: string; reason?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.state = 'rejected'
    t.updatedAt = new Date().toISOString()
    pushApproval(t, 'reject', String(body?.rejectedBy ?? '审批人'), body?.reason)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/publish`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { publishedBy?: string; comment?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.state = 'published'
    t.updatedAt = new Date().toISOString()
    pushApproval(t, 'publish', String(body?.publishedBy ?? '发布人'), body?.comment)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/rework`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { by?: string; comment?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.state = 'draft'
    t.updatedAt = new Date().toISOString()
    pushApproval(t, 'rework', String(body?.by ?? '发起人'), body?.comment)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/assign`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { dept?: string; role?: string; approverName?: string }
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.assignee = { dept: String(body?.dept ?? '放射科'), role: String(body?.role ?? '科主任'), approverName: String(body?.approverName ?? '') }
    t.updatedAt = new Date().toISOString()
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/favorite`, async ({ params, request }) => {
    await delay(40)
    const url = new URL(request.url)
    void url.searchParams.get('userId')
    const id = String(params.id)
    const fav = favorites.has(id)
    if (fav) favorites.delete(id)
    else favorites.add(id)
    const t = templates.find((x) => x.id === id)
    if (t) t.favoriteCount = Math.max(0, t.favoriteCount + (fav ? -1 : 1))
    return HttpResponse.json({ success: true, data: { favorite: !fav, favorites: [...favorites] } })
  }),

  http.get(`${API}/favorites`, async () => {
    await delay(40)
    const items = templates.filter((t) => favorites.has(t.id))
    return HttpResponse.json({ success: true, data: items })
  }),

  http.post(`${API}/templates/:id/use`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    t.usageCount += 1
    return HttpResponse.json({ success: true, data: t })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const byState: Record<TemplateStateV2, number> = { draft: 0, pending: 0, approved: 0, rejected: 0, published: 0 }
    for (const t of templates) byState[t.state] += 1
    return HttpResponse.json({
      success: true,
      data: {
        total: templates.length,
        byState,
        pendingCount: byState.pending,
        publishedCount: byState.published,
        totalVersions: templates.reduce((s, t) => s + t.versions.length, 0),
        avgApprovalHours: 26,
        totalFavorites: templates.reduce((s, t) => s + t.favoriteCount, 0),
        totalUsage: templates.reduce((s, t) => s + t.usageCount, 0),
      },
    })
  }),
]
