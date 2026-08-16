/**
 * G005 RIS - ASR 语音识别 Mock 端点 (Phase 1.4)
 *  - POST /asr/transcribe        : JSON (base64/duration) 转写
 *  - POST /asr/transcribe/audio  : multipart 音频上传转写
 *  - POST /asr/feedback          : 转写纠错反馈
 *  - [v3.0.6.11-103 Wave 17] /asr/dictation/* : 听写会话 V2 (start/append/end + 术语库)
 */
import { http, HttpResponse, delay } from 'msw'
import { API_BASE } from '../api/client'

const MOCK_RESPONSES = [
  '双肺纹理清晰，肺野透亮度正常，未见明确实变影及结节影。心影大小正常，纵隔无增宽，膈面光滑，肋膈角锐利。',
  '肝脏形态大小正常，包膜光滑，实质回声均匀，血管纹理清晰，门静脉主干内径约1.0cm。胆囊大小正常，壁薄光滑，腔内透亮。',
  '双侧侧脑室对称，中线结构居中。各叶脑沟回显示清晰，脑实质内未见异常信号灶。蝶鞍形态正常，垂体显示清晰。',
  '左肺上叶尖后段见一约2.3cm×1.8cm结节影，边缘呈分叶状，可见毛刺征及胸膜牵拉征象。右肺中叶及双肺下叶散在斑片状高密度影。',
]

function mockResult(duration: number) {
  const d = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 30
  const text = MOCK_RESPONSES[d % MOCK_RESPONSES.length] ?? MOCK_RESPONSES[0]!
  const confidence = +(0.85 + (d % 10) / 100).toFixed(2)
  const sentences = text.split(/(?<=[。；;])/).map((s) => s.trim()).filter(Boolean)
  const step = d / sentences.length
  return {
    success: true,
    data: {
      id: `asr-${Date.now()}`,
      text,
      confidence,
      segments: sentences.map((sentence: string, i: number) => ({
        start: Math.round(i * step * 10) / 10,
        end: Math.round((i + 1) * step * 10) / 10,
        text: sentence,
        confidence: +(confidence - (i % 3) * 0.02).toFixed(2),
      })),
      engine: 'mock',
      duration: d,
    },
  }
}

export const asrHandlers = [
  http.post(`${API_BASE}/asr/transcribe/audio`, async ({ request }) => {
    await delay(900)
    let duration = 30
    try {
      const form = await request.formData()
      const raw = form.get('duration')
      if (typeof raw === 'string' && raw) duration = Number(raw)
    } catch {
      /* ignore */
    }
    return HttpResponse.json(mockResult(duration))
  }),

  http.post(`${API_BASE}/asr/transcribe`, async ({ request }) => {
    await delay(700)
    let duration = 30
    try {
      const body = (await request.json()) as { duration?: number }
      if (typeof body?.duration === 'number' && Number.isFinite(body.duration)) duration = body.duration
    } catch {
      /* ignore */
    }
    return HttpResponse.json(mockResult(duration))
  }),

  http.post(`${API_BASE}/asr/feedback`, async () => {
    await delay(150)
    return HttpResponse.json({ success: true })
  }),
]

// ── [v3.0.6.11-103 Wave 17] 听写工作台 V2 (确定性 mock, 无真实 ASR 依赖) ─────

const DICTATION_COMMANDS: Array<{ phrase: string; action: string }> = [
  { phrase: '下一段', action: 'next_section' },
  { phrase: '保存', action: 'save' },
  { phrase: '提交', action: 'submit' },
  { phrase: '暂停', action: 'pause' },
  { phrase: '继续', action: 'resume' },
]

const SECTION_LABELS: Record<string, string> = {
  findings: '所见',
  impression: '印象',
  recommendation: '建议',
  conclusion: '结论',
}

const BUILTIN_HOTWORDS = [
  '磨玻璃结节', '磨玻璃影', '结节影', '右肺上叶', '左肺上叶', '右肺下叶', '毛刺征', '分叶征',
  '胸膜牵拉', '胸腔积液', '肺不张', '肺气肿', '条索影', '斑片状影', '肋膈角', '双肺纹理',
  '纵隔', '心影', '主动脉弓', '门静脉', '胆总管', '肝囊肿', '肝硬化', '脂肪肝', '胆囊结石',
  '脑梗死', '脑出血', '椎间盘突出', '骨质疏松', '骨折', '造影剂', '穿刺活检', '毫米', '厘米',
]

function hotwordSeed() {
  return BUILTIN_HOTWORDS.map((term, i) => ({
    id: `hw-builtin-${i}`,
    term,
    category: i % 4 === 0 ? '解剖' : i % 3 === 0 ? '疾病' : '影像',
    priority: term.length >= 4 ? 3 : 2,
    builtin: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }))
}

const dictationStore = new Map<string, { hotwords: any[]; sessions: Map<string, any> }>()

function getStore() {
  if (!dictationStore.has('default')) {
    dictationStore.set('default', { hotwords: hotwordSeed(), sessions: new Map() })
  }
  return dictationStore.get('default')!
}

function ok(data: unknown) {
  return { success: true, data }
}

export const dictationHandlers = [
  http.post(`${API_BASE}/asr/dictation/session`, async ({ request }) => {
    await delay(120)
    let body: any = {}
    try { body = await request.json() } catch { /* ignore */ }
    const store = getStore()
    const id = `dict-${Date.now()}`
    const session = {
      id,
      reportId: body?.reportId || '未关联报告',
      doctorId: body?.doctorId || 'D1001',
      lang: body?.lang || 'zh-CN',
      status: 'dictating',
      startedAt: new Date().toISOString(),
      endedAt: null,
      text: '',
      sections: Object.keys(SECTION_LABELS).map((key) => ({ key, text: '' })),
      commands: [],
      durationSec: 0,
    }
    store.sessions.set(id, session)
    return HttpResponse.json(ok(session))
  }),

  http.get(`${API_BASE}/asr/dictation/session/:id`, async ({ params }) => {
    await delay(80)
    const store = getStore()
    const session = store.sessions.get(params.id as string)
    if (!session) return HttpResponse.json({ success: false, error: { message: '会话不存在' } }, { status: 404 })
    return HttpResponse.json(ok(session))
  }),

  http.post(`${API_BASE}/asr/dictation/session/:id/append`, async ({ params, request }) => {
    await delay(150)
    const store = getStore()
    const session = store.sessions.get(params.id as string)
    if (!session) return HttpResponse.json({ success: false, error: { message: '会话不存在' } }, { status: 404 })
    if (session.status === 'completed') return HttpResponse.json({ success: false, error: { message: '会话已结束' } }, { status: 400 })
    let body: any = {}
    try { body = await request.json() } catch { /* ignore */ }
    const input = String(body?.text ?? '').trim()

    // 命令词剥离
    const commands: any[] = []
    let clean = input
    for (const cmd of DICTATION_COMMANDS) {
      if (clean.includes(cmd.phrase)) {
        commands.push({ phrase: cmd.phrase, action: cmd.action, at: clean.indexOf(cmd.phrase) })
        clean = clean.split(cmd.phrase).join('')
      }
    }
    commands.sort((a, b) => a.at - b.at)

    // 自动标点
    let punct = clean.trim()
    if (punct && !/[。！？；;，,]$/.test(punct)) punct = punct.length >= 8 ? `${punct}。` : `${punct}，`

    // 分段: 标记开头则切换
    let sectionKey = session.sections.filter((s: any) => s.text.length > 0).at(-1)?.key ?? 'findings'
    let content = punct
    for (const [key, label] of Object.entries(SECTION_LABELS)) {
      const re = new RegExp(`^【${label}】|^${label}[：:]`)
      if (re.test(content)) {
        sectionKey = key
        content = content.replace(re, '')
      }
    }
    const target = session.sections.find((s: any) => s.key === sectionKey)
    if (target && content) target.text = target.text ? `${target.text}${content}` : content
    session.text = session.sections.map((s: any) => s.text).filter(Boolean).join('')

    // 热词命中
    const hotwordHits = getStore().hotwords
      .filter((hw: any) => clean.includes(hw.term))
      .map((hw: any) => ({ term: hw.term, count: clean.split(hw.term).length - 1 }))
      .slice(0, 20)
    const confidence = Math.min(0.99, 0.88 + hotwordHits.length * 0.04 + commands.length * 0.02)

    return HttpResponse.json(ok({
      sessionId: session.id,
      text: content,
      sections: session.sections,
      commands,
      hotwordHits,
      confidence,
      engine: 'mock-dictation',
    }))
  }),

  http.post(`${API_BASE}/asr/dictation/session/:id/end`, async ({ params }) => {
    await delay(120)
    const store = getStore()
    const session = store.sessions.get(params.id as string)
    if (!session) return HttpResponse.json({ success: false, error: { message: '会话不存在' } }, { status: 404 })
    if (session.status !== 'completed') {
      session.status = 'completed'
      session.endedAt = new Date().toISOString()
      session.durationSec = Math.max(1, Math.round((Date.now() - new Date(session.startedAt).getTime()) / 1000))
    }
    return HttpResponse.json(ok(session))
  }),

  http.get(`${API_BASE}/asr/dictation/hotwords`, async () => {
    await delay(80)
    return HttpResponse.json(ok(getStore().hotwords))
  }),

  http.post(`${API_BASE}/asr/dictation/hotwords`, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as any
    const store = getStore()
    const term = String(body?.term ?? '').trim()
    if (!term) return HttpResponse.json({ success: false, error: { message: '热词不能为空' } }, { status: 400 })
    if (store.hotwords.some((h: any) => h.term === term)) {
      return HttpResponse.json({ success: false, error: { message: `热词已存在: ${term}` } }, { status: 400 })
    }
    const entry = {
      id: `hw-custom-${Date.now()}`,
      term,
      category: body?.category || '影像',
      priority: body?.priority ?? 1,
      builtin: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.hotwords.push(entry)
    return HttpResponse.json(ok(entry))
  }),

  http.patch(`${API_BASE}/asr/dictation/hotwords/:id`, async ({ params, request }) => {
    await delay(100)
    const store = getStore()
    const entry = store.hotwords.find((h: any) => h.id === params.id)
    if (!entry) return HttpResponse.json({ success: false, error: { message: '热词不存在' } }, { status: 404 })
    const body = (await request.json()) as any
    if (body?.term !== undefined) entry.term = String(body.term).trim()
    if (body?.category !== undefined) entry.category = body.category
    if (body?.priority !== undefined) entry.priority = body.priority
    entry.updatedAt = new Date().toISOString()
    return HttpResponse.json(ok({ ...entry }))
  }),

  http.delete(`${API_BASE}/asr/dictation/hotwords/:id`, async ({ params }) => {
    await delay(100)
    const store = getStore()
    const idx = store.hotwords.findIndex((h: any) => h.id === params.id)
    if (idx === -1) return HttpResponse.json({ success: false, error: { message: '热词不存在' } }, { status: 404 })
    const [removed] = store.hotwords.splice(idx, 1)
    return HttpResponse.json(ok({ success: true, deletedId: removed?.id ?? params.id }))
  }),
]
