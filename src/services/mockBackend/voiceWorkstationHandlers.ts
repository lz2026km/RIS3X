/**
 * G005 RIS - 语音工作站 Mock 端点 (Wave 6A v3.0.6.11-99)
 *  - GET/POST /voice-workstation/lexicon, PATCH/DELETE /lexicon/:id, GET /lexicon/search
 *  - GET  /voice-workstation/sessions
 *  - POST /voice-workstation/transcribe (text 或 audioBase64 → 词库校正 + corrections[])
 *  - GET/POST /voice-workstation/corrections
 *  - GET  /voice-workstation/stats
 */
import { http, HttpResponse, delay } from 'msw'
import { API_BASE } from '../api/client'

type LexiconCategory = '解剖' | '影像' | '疾病' | '药物' | '单位' | '操作'

interface LexiconEntry {
  id: string
  term: string
  category: LexiconCategory
  priority: number
  aliases: string[]
  createdAt: string
  updatedAt: string
}

interface SessionRecord {
  id: string
  reportId: string
  doctorId: string
  duration: number
  status: 'completed' | 'processing' | 'error'
  correctionCount: number
  createdAt: string
}

interface CorrectionFeedback {
  id: string
  original: string
  corrected: string
  source: 'feedback' | 'auto'
  createdAt: string
}

type SeedRow = [term: string, category: LexiconCategory, priority: number, aliases: string[]]

const SEED: SeedRow[] = [
  ['左肺上叶', '解剖', 3, ['左上肺叶']], ['左肺下叶', '解剖', 3, []], ['右肺上叶', '解剖', 3, ['右上肺叶']],
  ['右肺中叶', '解剖', 3, []], ['右肺下叶', '解剖', 3, []], ['双肺纹理', '解剖', 2, ['双侧肺纹理']],
  ['肺门', '解剖', 2, ['肺们']], ['纵隔', '解剖', 2, ['纵格']], ['肋膈角', '解剖', 3, ['肋隔角']],
  ['心影', '解剖', 2, []], ['主动脉弓', '解剖', 2, []], ['支气管', '解剖', 2, ['支气官']],
  ['胸膜', '解剖', 2, ['胸摸']], ['肝脏', '解剖', 2, ['干脏']], ['胆囊', '解剖', 2, ['胆曩']],
  ['胰腺', '解剖', 2, []], ['脾脏', '解剖', 2, []], ['门静脉', '解剖', 2, []],
  ['椎间盘', '解剖', 2, []], ['侧脑室', '解剖', 2, []], ['甲状腺', '解剖', 2, []],
  ['食管', '解剖', 2, []], ['胃窦', '解剖', 1, []], ['前列腺', '解剖', 1, []],
  ['磨玻璃影', '影像', 3, ['磨玻璃密度影', '毛玻璃影', '磨玻璃状影']], ['实变影', '影像', 3, []],
  ['结节影', '影像', 3, ['结皆影']], ['结节', '影像', 3, ['结皆']], ['钙化灶', '影像', 3, ['钙化照']],
  ['条索影', '影像', 2, []], ['斑片状影', '影像', 2, []], ['胸腔积液', '影像', 3, []],
  ['毛刺征', '影像', 3, ['毛刺症']], ['分叶征', '影像', 3, []], ['胸膜牵拉', '影像', 3, ['胸膜牵啦']],
  ['环状强化', '影像', 2, []], ['低回声', '影像', 2, ['底回声']], ['无回声', '影像', 2, []],
  ['混合回声', '影像', 2, []], ['高信号', '影像', 2, []], ['平扫', '影像', 2, []],
  ['增强扫描', '影像', 2, ['增墙扫描']], ['T1WI', '影像', 3, ['T1加权像']], ['T2WI', '影像', 3, ['T2加权像']],
  ['DWI', '影像', 3, ['弥散加权成像']], ['FLAIR', '影像', 2, []], ['CTA', '影像', 2, []],
  ['三维重建', '影像', 2, ['3D重建']],
  ['肺结节', '疾病', 3, ['肺结皆']], ['肺占位', '疾病', 3, []], ['肺炎', '疾病', 2, []],
  ['肺结核', '疾病', 2, []], ['肺栓塞', '疾病', 3, []], ['气胸', '疾病', 3, []],
  ['肝血管瘤', '疾病', 2, []], ['肝硬化', '疾病', 2, []], ['脂肪肝', '疾病', 2, []],
  ['胆囊结石', '疾病', 2, ['胆曩结石']], ['急性胰腺炎', '疾病', 2, []], ['肾囊肿', '疾病', 2, []],
  ['肾结石', '疾病', 2, []], ['脑梗死', '疾病', 3, ['脑更死']], ['脑出血', '疾病', 3, []],
  ['动脉瘤', '疾病', 3, []], ['椎间盘突出', '疾病', 2, []], ['椎管狭窄', '疾病', 2, []],
  ['骨折', '疾病', 2, []], ['骨质疏松', '疾病', 2, []], ['乳腺结节', '疾病', 2, []],
  ['造影剂', '药物', 3, ['灶影剂']], ['碘海醇', '药物', 2, []], ['钆喷酸葡胺', '药物', 2, []],
  ['硫酸钡', '药物', 2, []], ['生理盐水', '药物', 1, []], ['地塞米松', '药物', 1, []],
  ['阿托品', '药物', 1, []], ['利多卡因', '药物', 1, []], ['肝素钠', '药物', 1, []],
  ['毫米', '单位', 2, ['豪米']], ['厘米', '单位', 2, []], ['HU', '单位', 2, []],
  ['毫克', '单位', 2, []], ['毫升', '单位', 2, []], ['千帕', '单位', 1, []],
  ['动态增强', '操作', 2, []], ['延迟扫描', '操作', 2, []], ['冠状位重建', '操作', 2, []],
  ['定位像', '操作', 2, []], ['层厚', '操作', 1, []], ['视野', '操作', 1, []],
  ['穿刺活检', '操作', 2, []],
]

const DEMO_TRANSCRIPT = '右肺上叶尖后段见一不规则形软组织密度结皆，边缘呈分叶状，可见毛刺症及胸膜牵啦征象，余双肺纹理清晰，肋膈角锐利。'

function nowIso(offsetMin = 0): string {
  return new Date(Date.now() - offsetMin * 60000).toISOString()
}

let lexicon: LexiconEntry[] = SEED.map(([term, category, priority, aliases], i) => ({
  id: `vwl-${String(i + 1).padStart(3, '0')}`,
  term,
  category,
  priority,
  aliases: [...aliases],
  createdAt: nowIso(60 * 24),
  updatedAt: nowIso(0),
}))

let sessions: SessionRecord[] = [
  { id: 'vws-seed-1', reportId: 'rpt-038', doctorId: 'D1001', duration: 42, status: 'completed', correctionCount: 2, createdAt: nowIso(300) },
  { id: 'vws-seed-2', reportId: 'rpt-127', doctorId: 'D1001', duration: 18, status: 'completed', correctionCount: 0, createdAt: nowIso(240) },
  { id: 'vws-seed-3', reportId: 'rpt-221', doctorId: 'D1002', duration: 67, status: 'completed', correctionCount: 3, createdAt: nowIso(180) },
  { id: 'vws-seed-4', reportId: 'rpt-305', doctorId: 'D1003', duration: 25, status: 'error', correctionCount: 0, createdAt: nowIso(120) },
  { id: 'vws-seed-5', reportId: 'rpt-098', doctorId: 'D1001', duration: 51, status: 'completed', correctionCount: 1, createdAt: nowIso(60) },
  { id: 'vws-seed-6', reportId: 'rpt-176', doctorId: 'D1002', duration: 33, status: 'completed', correctionCount: 0, createdAt: nowIso(15) },
]

let feedback: CorrectionFeedback[] = [
  { id: 'vwf-001', original: '磨玻璃壮影', corrected: '磨玻璃影', source: 'feedback', createdAt: nowIso(30) },
  { id: 'vwf-002', original: '肺门见小淋巴结', corrected: '肺门见小淋巴结影', source: 'feedback', createdAt: nowIso(45) },
]

function applyCorrections(text: string): { correctedText: string; corrections: Array<{ original: string; corrected: string; term: string; category: LexiconCategory }> } {
  let correctedText = text
  const corrections: Array<{ original: string; corrected: string; term: string; category: LexiconCategory }> = []
  const ordered = [...lexicon].sort((a, b) => b.priority - a.priority)
  for (const entry of ordered) {
    for (const alias of entry.aliases) {
      if (!alias || alias === entry.term) continue
      if (correctedText.includes(alias)) {
        correctedText = correctedText.split(alias).join(entry.term)
        corrections.push({ original: alias, corrected: entry.term, term: entry.term, category: entry.category })
      }
    }
  }
  return { correctedText, corrections }
}

function listPayload(items: unknown[], total?: number) {
  return { success: true, data: { items, total: total ?? items.length } }
}

export const voiceWorkstationHandlers = [
  // ── 词库 ─────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/voice-workstation/lexicon`, async () => {
    await delay(200)
    const sorted = [...lexicon].sort((a, b) => b.priority - a.priority || a.term.localeCompare(b.term, 'zh-CN'))
    return HttpResponse.json(listPayload(sorted))
  }),

  http.get(`${API_BASE}/voice-workstation/lexicon/search`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()
    const matched = q
      ? lexicon.filter((e) => e.term.toLowerCase().includes(q) || e.aliases.some((a) => a.toLowerCase().includes(q)) || e.category.includes(q))
      : lexicon
    return HttpResponse.json(listPayload(matched))
  }),

  http.post(`${API_BASE}/voice-workstation/lexicon`, async ({ request }) => {
    await delay(150)
    const body = (await request.json()) as { term?: string; category?: LexiconCategory; priority?: number; aliases?: string[] }
    const term = (body?.term ?? '').trim()
    if (!term) return HttpResponse.json({ success: false, error: { message: '术语不能为空' } }, { status: 400 })
    if (lexicon.some((e) => e.term === term)) return HttpResponse.json({ success: false, error: { message: `词条已存在: ${term}` } }, { status: 400 })
    const entry: LexiconEntry = {
      id: `vwl-${Date.now()}`,
      term,
      category: body?.category ?? '影像',
      priority: body?.priority ?? 1,
      aliases: (body?.aliases ?? []).map((a) => a.trim()).filter(Boolean),
      createdAt: nowIso(),
      updatedAt: nowIso(),
    }
    lexicon = [entry, ...lexicon]
    return HttpResponse.json({ success: true, data: entry })
  }),

  http.patch(`${API_BASE}/voice-workstation/lexicon/:id`, async ({ request, params }) => {
    await delay(150)
    const id = String(params.id)
    const body = (await request.json()) as { term?: string; category?: LexiconCategory; priority?: number; aliases?: string[] }
    const entry = lexicon.find((e) => e.id === id)
    if (!entry) return HttpResponse.json({ success: false, error: { message: `词条不存在: ${id}` } }, { status: 404 })
    if (body?.term !== undefined) {
      const term = body.term.trim()
      if (!term) return HttpResponse.json({ success: false, error: { message: '术语不能为空' } }, { status: 400 })
      if (lexicon.some((e) => e.id !== id && e.term === term)) return HttpResponse.json({ success: false, error: { message: `词条已存在: ${term}` } }, { status: 400 })
      entry.term = term
    }
    if (body?.category) entry.category = body.category
    if (body?.priority !== undefined) entry.priority = body.priority
    if (body?.aliases !== undefined) entry.aliases = body.aliases.map((a) => a.trim()).filter(Boolean)
    entry.updatedAt = nowIso()
    return HttpResponse.json({ success: true, data: entry })
  }),

  http.delete(`${API_BASE}/voice-workstation/lexicon/:id`, async ({ params }) => {
    await delay(120)
    const id = String(params.id)
    const before = lexicon.length
    lexicon = lexicon.filter((e) => e.id !== id)
    if (lexicon.length === before) return HttpResponse.json({ success: false, error: { message: `词条不存在: ${id}` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: { success: true, deletedId: id } })
  }),

  // ── 会话 ─────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/voice-workstation/sessions`, async () => {
    await delay(200)
    return HttpResponse.json(listPayload([...sessions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
  }),

  // ── 转写 + 词库校正 ──────────────────────────────────────────────────
  http.post(`${API_BASE}/voice-workstation/transcribe`, async ({ request }) => {
    await delay(800)
    const body = (await request.json()) as { text?: string; reportId?: string; duration?: number }
    const text = (body?.text ?? '').trim()
    const rawText = text || DEMO_TRANSCRIPT
    const duration = Number.isFinite(body?.duration) && (body?.duration ?? 0) > 0 ? Math.round(body!.duration!) : 30
    const { correctedText, corrections } = applyCorrections(rawText)
    const session: SessionRecord = {
      id: `vws-${Date.now()}`,
      reportId: (body?.reportId ?? '').trim() || '未关联报告',
      doctorId: 'D1001',
      duration,
      status: 'completed',
      correctionCount: corrections.length,
      createdAt: nowIso(),
    }
    sessions = [session, ...sessions].slice(0, 100)
    const sentences = correctedText.split(/(?<=[。；;])/).map((s) => s.trim()).filter(Boolean)
    const step = duration / Math.max(1, sentences.length)
    return HttpResponse.json({
      success: true,
      data: {
        id: session.id,
        text: rawText,
        correctedText,
        corrections,
        confidence: +(0.92 - corrections.length * 0.01).toFixed(2),
        engine: 'mock-lexicon',
        duration,
        segments: sentences.map((sentence: string, i: number) => ({
          start: Math.round(i * step * 10) / 10,
          end: Math.round((i + 1) * step * 10) / 10,
          text: sentence,
          confidence: +(0.9 - (i % 3) * 0.02).toFixed(2),
        })),
      },
    })
  }),

  // ── 纠正反馈 ─────────────────────────────────────────────────────────
  http.get(`${API_BASE}/voice-workstation/corrections`, async () => {
    await delay(150)
    return HttpResponse.json(listPayload([...feedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt))))
  }),

  http.post(`${API_BASE}/voice-workstation/corrections`, async ({ request }) => {
    await delay(200)
    const body = (await request.json()) as { original?: string; corrected?: string }
    const original = (body?.original ?? '').trim()
    const corrected = (body?.corrected ?? '').trim()
    if (!original || !corrected) return HttpResponse.json({ success: false, error: { message: 'original/corrected 不能为空' } }, { status: 400 })
    const record: CorrectionFeedback = { id: `vwf-${Date.now()}`, original, corrected, source: 'feedback', createdAt: nowIso() }
    feedback = [record, ...feedback].slice(0, 200)
    const matched = lexicon.find((e) => e.term === corrected)
    if (matched) {
      if (!matched.aliases.includes(original)) matched.aliases = [...matched.aliases, original]
    } else if (!lexicon.some((e) => e.term === corrected)) {
      lexicon = [{ id: `vwl-${Date.now()}`, term: corrected, category: '影像', priority: 1, aliases: [original], createdAt: nowIso(), updatedAt: nowIso() }, ...lexicon]
    }
    return HttpResponse.json({ success: true, data: record })
  }),

  // ── 统计 ─────────────────────────────────────────────────────────────
  http.get(`${API_BASE}/voice-workstation/stats`, async () => {
    await delay(150)
    const completed = sessions.filter((s) => s.status === 'completed')
    const avg = completed.length > 0 ? Math.round(completed.reduce((sum, s) => sum + s.duration, 0) / completed.length) : 0
    const today = sessions.filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString()).length
    const categories = ['解剖', '影像', '疾病', '药物', '单位', '操作'] as const
    return HttpResponse.json({
      success: true,
      data: {
        sessions: { total: sessions.length, today, avgDurationSec: avg },
        lexiconSize: lexicon.length,
        corrections: { total: feedback.length },
        categoryCounts: categories.map((category) => ({ category, count: lexicon.filter((e) => e.category === category).length })),
      },
    })
  }),
]
