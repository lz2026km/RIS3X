// [G005 Wave 7B v3.0.6.11-101] /api/v1/template-library-v2 MSW handlers
// 对齐后端 template-library-v2.module + templateLibraryV2Api (分类树 + 检索/推荐 + 使用/收藏 + 导入导出)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/template-library-v2`

type TemplatePurposeV2 = 'STRUCTURED_REPORT' | 'FOLLOWUP' | 'URGENT' | 'CONTRAST' | 'PROCEDURE' | 'TECHNIQUE'
type TemplateNodeTypeV2 = 'modality' | 'dept' | 'purpose'

interface CategoryNode { key: string; name: string; nodeType: TemplateNodeTypeV2; children?: CategoryNode[] }

interface TemplateItem {
  id: string
  name: string
  modality: string
  dept: string
  purpose: TemplatePurposeV2
  bodyPart: string
  tags: string[]
  content: string
  isSystem: boolean
  sourceTemplateId?: string
  favoriteCount: number
  usageCount: number
  displayCount: number
  lastUsedAt?: string
  createdAt: string
  updatedAt: string
}

const CATEGORIES: CategoryNode[] = [
  {
    key: 'modality', name: '按检查方式', nodeType: 'modality',
    children: [
      { key: 'CT', name: 'CT', nodeType: 'modality', children: [{ key: 'CT-胸', name: '胸部', nodeType: 'purpose' }, { key: 'CT-头', name: '头颅', nodeType: 'purpose' }, { key: 'CT-腹', name: '腹部', nodeType: 'purpose' }] },
      { key: 'MR', name: 'MR', nodeType: 'modality', children: [{ key: 'MR-头', name: '头颅', nodeType: 'purpose' }, { key: 'MR-脊', name: '脊柱', nodeType: 'purpose' }] },
      { key: 'DR', name: 'DR', nodeType: 'modality', children: [{ key: 'DR-胸', name: '胸部', nodeType: 'purpose' }] },
    ],
  },
  {
    key: 'dept', name: '按科室', nodeType: 'dept',
    children: [
      { key: '放射科', name: '放射科', nodeType: 'dept' },
      { key: '超声科', name: '超声科', nodeType: 'dept' },
      { key: '核医学科', name: '核医学科', nodeType: 'dept' },
    ],
  },
  {
    key: 'purpose', name: '按用途', nodeType: 'purpose',
    children: [
      { key: 'STRUCTURED_REPORT', name: '常规报告', nodeType: 'purpose' },
      { key: 'FOLLOWUP', name: '随访', nodeType: 'purpose' },
      { key: 'URGENT', name: '危急', nodeType: 'purpose' },
      { key: 'CONTRAST', name: '增强', nodeType: 'purpose' },
    ],
  },
]

const TEMPLATES: TemplateItem[] = [
  {
    id: 'tpl-001', name: '胸部 CT 平扫常规模板', modality: 'CT', dept: '放射科', purpose: 'STRUCTURED_REPORT', bodyPart: '胸部',
    tags: ['平扫', '常规'],
    content: '【影像所见】双肺纹理清晰，肺野未见异常密度影。纵隔位置居中，未见肿大淋巴结。\n【诊断结论】胸部 CT 平扫未见明显异常。',
    isSystem: true, favoriteCount: 12, usageCount: 86, displayCount: 124,
    lastUsedAt: '2026-08-15T09:00:00.000Z', createdAt: '2026-05-01T08:00:00.000Z', updatedAt: '2026-07-21T09:05:00.000Z',
  },
  {
    id: 'tpl-002', name: '头颅 MRI 平扫模板', modality: 'MR', dept: '放射科', purpose: 'STRUCTURED_REPORT', bodyPart: '头颅',
    tags: ['平扫', '常规'],
    content: '【影像所见】脑实质信号未见明显异常，脑室系统形态大小正常。\n【诊断结论】头颅 MRI 平扫未见明显异常。',
    isSystem: true, favoriteCount: 8, usageCount: 54, displayCount: 88,
    lastUsedAt: '2026-08-14T15:20:00.000Z', createdAt: '2026-05-01T08:00:00.000Z', updatedAt: '2026-07-01T09:00:00.000Z',
  },
  {
    id: 'tpl-003', name: '肺结节随访模板', modality: 'CT', dept: '放射科', purpose: 'FOLLOWUP', bodyPart: '胸部',
    tags: ['随访', '结节'],
    content: '【影像所见】右肺上叶磨玻璃结节, 与 2026-03-15 前次检查对比无明显变化。\n【诊断结论】右肺上叶磨玻璃结节, 建议 6 个月随访复查。',
    isSystem: true, favoriteCount: 15, usageCount: 41, displayCount: 60,
    lastUsedAt: '2026-08-13T10:10:00.000Z', createdAt: '2026-05-10T08:00:00.000Z', updatedAt: '2026-06-10T09:00:00.000Z',
  },
  {
    id: 'tpl-004', name: '危急值报告模板', modality: 'CT', dept: '急诊影像', purpose: 'URGENT', bodyPart: '头颅',
    tags: ['危急', '出血'],
    content: '【影像所见】左侧基底节区见高密度影, 范围约 20ml。\n【诊断结论】脑出血, 病情危急, 已电话通知临床。',
    isSystem: true, favoriteCount: 20, usageCount: 23, displayCount: 31,
    lastUsedAt: '2026-08-12T16:40:00.000Z', createdAt: '2026-05-05T08:00:00.000Z', updatedAt: '2026-06-01T09:00:00.000Z',
  },
  {
    id: 'tpl-005', name: '腹部增强 CT 三期模板', modality: 'CT', dept: '放射科', purpose: 'CONTRAST', bodyPart: '腹部',
    tags: ['增强', '三期'],
    content: '【影像所见】肝实质平扫密度均匀, 动脉期、门静脉期、延迟期三期增强扫描显示肝右叶见类圆形低密度灶约 12mm, 增强后无明显强化。\n【诊断结论】肝右叶囊肿可能性大。',
    isSystem: false, sourceTemplateId: 'tpl-001', favoriteCount: 6, usageCount: 18, displayCount: 26,
    createdAt: '2026-07-15T09:00:00.000Z', updatedAt: '2026-07-15T09:00:00.000Z',
  },
]

let templates = [...TEMPLATES]
let tplSeq = 100
const favorites = new Set<string>(['tpl-001', 'tpl-004'])
const usageHistory: string[] = ['tpl-001', 'tpl-002', 'tpl-003']

function filterTemplates(params: URLSearchParams): TemplateItem[] {
  let items = templates
  const modality = params.get('modality')
  const dept = params.get('dept')
  const purpose = params.get('purpose')
  const keyword = params.get('keyword')
  const bodyPart = params.get('bodyPart')
  const tags = (params.get('tags') ?? '').split(',').filter(Boolean)
  if (modality) items = items.filter((t) => t.modality === modality)
  if (dept) items = items.filter((t) => t.dept === dept)
  if (purpose) items = items.filter((t) => t.purpose === purpose)
  if (bodyPart) items = items.filter((t) => t.bodyPart.includes(bodyPart))
  if (keyword) items = items.filter((t) => t.name.includes(keyword) || t.content.includes(keyword) || t.tags.some((tag) => tag.includes(keyword)))
  if (tags.length > 0) items = items.filter((t) => tags.every((tag) => t.tags.includes(tag)))
  return items
}

export const templateLibraryV2Handlers = [
  http.get(`${API}/categories`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: CATEGORIES })
  }),

  http.get(`${API}/templates`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    return HttpResponse.json({ success: true, data: filterTemplates(url.searchParams) })
  }),

  http.get(`${API}/search`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const items = filterTemplates(url.searchParams)
    const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1)
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize') ?? 20) || 20)
    return HttpResponse.json({ success: true, data: { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length } })
  }),

  http.get(`${API}/recommend`, async ({ request }) => {
    await delay(50)
    const url = new URL(request.url)
    const items = filterTemplates(url.searchParams)
    const limit = Math.max(1, Number(url.searchParams.get('limit') ?? 5) || 5)
    return HttpResponse.json({
      success: true,
      data: items.slice(0, limit).map((t, i) => ({
        templateId: t.id,
        score: Math.round((0.9 - i * 0.08) * 100) / 100,
        reason: i === 0 ? `基于 ${t.modality} ${t.bodyPart} 高频使用` : `匹配检查部位 ${t.bodyPart}`,
        template: t,
      })),
    })
  }),

  http.get(`${API}/templates/:id`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: t })
  }),

  http.get(`${API}/templates/:id/stats`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({
      success: true,
      data: {
        templateId: t.id,
        usageCount: t.usageCount,
        displayCount: t.displayCount,
        adoptionRate: Math.round(t.usageCount / Math.max(1, t.displayCount) * 1000) / 10,
        favoriteCount: t.favoriteCount,
        lastUsedAt: t.lastUsedAt,
        recentUsedDays: t.lastUsedAt ? 30 : 0,
      },
    })
  }),

  http.post(`${API}/templates/:id/use`, async ({ params }) => {
    await delay(40)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    t.usageCount += 1
    t.lastUsedAt = now
    usageHistory.unshift(t.id)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/templates/:id/favorite`, async ({ params }) => {
    await delay(40)
    const id = String(params.id)
    const fav = favorites.has(id)
    if (fav) favorites.delete(id)
    else favorites.add(id)
    const t = templates.find((x) => x.id === id)
    if (t) t.favoriteCount = Math.max(0, t.favoriteCount + (fav ? -1 : 1))
    return HttpResponse.json({ success: true, data: { favorite: !fav, favoriteIds: [...favorites] } })
  }),

  http.get(`${API}/favorites`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: templates.filter((t) => favorites.has(t.id)) })
  }),

  http.get(`${API}/usage-history`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: usageHistory.map((id) => templates.find((t) => t.id === id)).filter((t): t is TemplateItem => !!t) })
  }),

  http.post(`${API}/templates/:id/copy`, async ({ params }) => {
    await delay(50)
    const src = templates.find((x) => x.id === params.id)
    if (!src) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    const now = new Date().toISOString()
    const copy: TemplateItem = {
      ...src,
      id: `tpl-${tplSeq++}`,
      name: `${src.name}(副本)`,
      isSystem: false,
      sourceTemplateId: src.id,
      favoriteCount: 0,
      usageCount: 0,
      displayCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    templates.unshift(copy)
    return HttpResponse.json({ success: true, data: copy })
  }),

  http.post(`${API}/templates`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { name?: string; modality?: string; dept?: string; purpose?: string; bodyPart?: string; tags?: string[]; content?: string; createdBy?: string }
    const now = new Date().toISOString()
    const t: TemplateItem = {
      id: `tpl-${tplSeq++}`,
      name: String(body?.name ?? '未命名模板'),
      modality: String(body?.modality ?? 'CT'),
      dept: String(body?.dept ?? '放射科'),
      purpose: (body?.purpose ?? 'STRUCTURED_REPORT') as TemplatePurposeV2,
      bodyPart: String(body?.bodyPart ?? '胸部'),
      tags: body?.tags ?? [],
      content: String(body?.content ?? ''),
      isSystem: false,
      favoriteCount: 0,
      usageCount: 0,
      displayCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    templates.unshift(t)
    return HttpResponse.json({ success: true, data: t })
  }),

  http.post(`${API}/export`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { ids?: string[] }
    const ids = body?.ids ?? templates.map((t) => t.id)
    const items = templates.filter((t) => ids.includes(t.id))
    return HttpResponse.json({ success: true, data: { schemaVersion: 1, exportedAt: new Date().toISOString(), templates: items } })
  }),

  http.get(`${API}/templates/:id/export`, async ({ params }) => {
    await delay(50)
    const t = templates.find((x) => x.id === params.id)
    if (!t) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `template ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: { schemaVersion: 1, exportedAt: new Date().toISOString(), templates: [t] } })
  }),

  http.post(`${API}/import`, async ({ request }) => {
    await delay(60)
    const body = (await request.json()) as { json?: string }
    let imported = 0
    try {
      const parsed = JSON.parse(String(body?.json ?? '{}')) as { templates?: TemplateItem[] }
      for (const t of parsed.templates ?? []) {
        templates.unshift({ ...t, id: `tpl-${tplSeq++}`, isSystem: false, favoriteCount: 0 })
        imported += 1
      }
    } catch {
      imported = 0
    }
    return HttpResponse.json({ success: true, data: { imported, ids: templates.slice(0, imported).map((t) => t.id) } })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const byModality: Record<string, number> = {}
    const byDept: Record<string, number> = {}
    const byPurpose: Record<string, number> = {}
    for (const t of templates) {
      byModality[t.modality] = (byModality[t.modality] ?? 0) + 1
      byDept[t.dept] = (byDept[t.dept] ?? 0) + 1
      byPurpose[t.purpose] = (byPurpose[t.purpose] ?? 0) + 1
    }
    const system = templates.filter((t) => t.isSystem).length
    const totalUsage = templates.reduce((s, t) => s + t.usageCount, 0)
    return HttpResponse.json({
      success: true,
      data: {
        total: templates.length,
        systemCount: system,
        userCount: templates.length - system,
        totalUsage,
        totalFavorites: templates.reduce((s, t) => s + t.favoriteCount, 0),
        avgAdoptionRate: Math.round(totalUsage / Math.max(1, templates.reduce((s, t) => s + t.displayCount, 0)) * 1000) / 10,
        byModality,
        byDept,
        byPurpose,
      },
    })
  }),
]
