// [G005 W4A] 报告/审计域 孤儿端点 MSW 兜底 (前置注册)
// 覆盖后端已有、前端此前无调用的端点:
//   GET  /audit/verify-chain           审计链端到端校验 (支持 ?tamper=1 演示断链)
//   GET  /audit/retention-policy       审计留存策略 (≥6 个月 + 冷归档)
//   POST /audit/cold-archive           审计冷归档
//   GET/POST/PUT/DELETE /report-rules/review-tiers[/:id] + POST .../resolve  分级审核规则 CRUD + 判定
//   GET/POST /report-peer-review/tasks/:id/defects   互评任务关联缺陷
//   GET/PATCH/DELETE /defect-library/items/:id       缺陷项 详情/更新/删除
//   POST /amend/supplement  +  GET /amend/supplements/:parentReportId  报告补发
//   POST /reports/:id/validate-fields  预签结构化字段校验
// 数据全部确定性 (无 Math.random), 形状与后端 service 对齐。
import { http, HttpResponse, delay } from 'msw'

const API_BASE =
  typeof process !== 'undefined' && process.env.VITEST
    ? 'http://localhost:5173/api/v1'
    : typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin + '/api/v1'
      : 'http://localhost:5173/api/v1'

const nowIso = () => new Date().toISOString()

/** 确定性 64 位十六进制摘要 (无外部依赖, 仅用于 MSW 演示) */
function fakeHash(seed: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x1000193
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0
    h2 = Math.imul(h2 ^ (c + i), 2246822519) >>> 0
  }
  let out = ''
  let x = h1
  let y = h2
  for (let i = 0; i < 8; i++) {
    x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0
    y = Math.imul(y ^ (y >>> 13), 3266489917) >>> 0
    out += x.toString(16).padStart(8, '0') + y.toString(16).padStart(8, '0')
  }
  return out.slice(0, 64)
}

// ───────────────────────────────────────────────────────────────
// 1) 审计链 / 留存 / 冷归档
// ───────────────────────────────────────────────────────────────

const AUDIT_SEED_RECORDS = [
  { id: 'seed-0001', action: 'LOGIN', resource: 'auth', userId: 'u-001', createdAt: '2026-09-01T08:00:00.000Z' },
  { id: 'seed-0002', action: 'CREATE_REPORT', resource: 'report', userId: 'u-002', createdAt: '2026-09-01T08:05:00.000Z' },
  { id: 'seed-0003', action: 'SIGN_REPORT', resource: 'report-signature', userId: 'u-002', createdAt: '2026-09-01T08:06:00.000Z' },
  { id: 'seed-0004', action: 'VIEW_REPORT', resource: 'report', userId: 'u-003', createdAt: '2026-09-01T08:30:00.000Z' },
  { id: 'seed-0005', action: 'EXPORT_CSV', resource: 'audit', userId: 'u-001', createdAt: '2026-09-01T09:00:00.000Z' },
  { id: 'seed-0006', action: 'UPDATE_CONFIG', resource: 'system-config', userId: 'u-004', createdAt: '2026-09-01T09:15:00.000Z' },
  { id: 'seed-0007', action: 'DELETE_REPORT', resource: 'report', userId: 'u-002', createdAt: '2026-09-01T09:40:00.000Z' },
  { id: 'seed-0008', action: 'LOGIN_FAILED', resource: 'auth', userId: 'u-009', createdAt: '2026-09-01T10:00:00.000Z' },
]
const GENESIS = '0'.repeat(64)

interface ChainBlock { index: number; id: string; action: string; resource: string; userId: string | null; createdAt: string; prevHash: string; hash: string }

function buildChain(): ChainBlock[] {
  const chain: ChainBlock[] = []
  let prevHash = GENESIS
  AUDIT_SEED_RECORDS.forEach((r, i) => {
    const base = { index: i, id: r.id, action: r.action, resource: r.resource, userId: r.userId, createdAt: r.createdAt }
    const hash = fakeHash(`${prevHash}|${i}|${r.id}|${r.action}|${r.resource}|${r.userId ?? ''}|${r.createdAt}`)
    chain.push({ ...base, prevHash, hash })
    prevHash = hash
  })
  return chain
}

let archiveSeq = 0

// ───────────────────────────────────────────────────────────────
// 2) 分级审核规则
// ───────────────────────────────────────────────────────────────

type ReviewTier = 'none' | 'initial' | 'final' | 'dual-sign' | 'dual-read'
interface ReviewTierRule {
  id: string; code: string; name: string; description: string; tier: ReviewTier
  enabled: boolean; priority: number
  when: { modalities?: string[]; radsCategoryGte?: number; severities?: string[]; isCritical?: boolean; authorSeniorityIn?: string[] }
  reason: string
}

const TIER_RANK: Record<ReviewTier, number> = { none: 0, initial: 1, final: 2, 'dual-sign': 3, 'dual-read': 4 }
const TIER_LABELS: Record<ReviewTier, string> = { none: '免审', initial: '初核', final: '终核', 'dual-sign': '双签', 'dual-read': '双阅' }
const maxTier = (a: ReviewTier, b: ReviewTier): ReviewTier => (TIER_RANK[a] >= TIER_RANK[b] ? a : b)

let tierSeq = 0
let tierRules: ReviewTierRule[] = [
  { id: 'rtier-b-01', code: 'RT-CRIT-01', name: '危急征象双阅', description: '危急征象报告须双人阅片', tier: 'dual-read', enabled: true, priority: 99, when: { isCritical: true }, reason: '危急征象须双阅' },
  { id: 'rtier-b-02', code: 'RT-SEV-CRIT', name: '危重病例双签', description: '严重程度 critical 须双签', tier: 'dual-sign', enabled: true, priority: 98, when: { severities: ['critical'] }, reason: '危重病例须双签' },
  { id: 'rtier-b-03', code: 'RT-RADS-01', name: 'RADS≥4 双阅', description: 'RADS 分类 ≥4 高风险须双阅', tier: 'dual-read', enabled: true, priority: 95, when: { radsCategoryGte: 4 }, reason: '高风险分级须双阅' },
  { id: 'rtier-b-04', code: 'RT-MOD-01', name: '高端模态终核', description: 'MRI/MR 报告须终核', tier: 'final', enabled: true, priority: 90, when: { modalities: ['MRI', 'MR'] }, reason: '高值模态须终核' },
  { id: 'rtier-b-05', code: 'RT-JR-01', name: '住院医师报告终核', description: '低资历作者报告须终核', tier: 'final', enabled: true, priority: 60, when: { authorSeniorityIn: ['resident'] }, reason: '低资历报告须上级终核' },
]

interface ResolveInput {
  reportId?: string; modality?: string; radsCategory?: number; severity?: string; isCritical?: boolean; authorSeniority?: string; authorId?: string
}

function ruleMatches(rule: ReviewTierRule, input: ResolveInput): boolean {
  const w = rule.when
  const modality = input.modality?.trim().toUpperCase()
  if (w.modalities?.length) {
    if (!modality || !w.modalities.map((m) => m.toUpperCase()).includes(modality)) return false
  }
  if (w.radsCategoryGte !== undefined) {
    if (typeof input.radsCategory !== 'number' || input.radsCategory < w.radsCategoryGte) return false
  }
  if (w.severities?.length) {
    if (!input.severity || !w.severities.includes(input.severity)) return false
  }
  if (w.isCritical !== undefined) {
    if (Boolean(input.isCritical) !== w.isCritical) return false
  }
  if (w.authorSeniorityIn?.length) {
    if (!input.authorSeniority || !w.authorSeniorityIn.includes(input.authorSeniority)) return false
  }
  return true
}

function buildTierSteps(tier: ReviewTier, topReason: string) {
  switch (tier) {
    case 'none': return []
    case 'initial': return [{ order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: topReason || '常规初核' }]
    case 'final': return [
      { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
      { order: 2, step: 'final', role: 'senior-reviewer', label: '终核', reason: topReason || '须终核' },
    ]
    case 'dual-sign': return [
      { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
      { order: 2, step: 'final', role: 'senior-reviewer', label: '终核', reason: '终核通过' },
      { order: 3, step: 'co-sign', role: 'co-signer', label: '双签', reason: topReason || '须双人签名' },
    ]
    case 'dual-read': return [
      { order: 1, step: 'initial', role: 'reviewer', label: '初核', reason: '初审通过' },
      { order: 2, step: 'peer-read', role: 'peer-reader', label: '双阅', reason: topReason || '须双人阅片' },
      { order: 3, step: 'final', role: 'senior-reviewer', label: '终核', reason: '终核通过' },
    ]
    default: return []
  }
}

// ───────────────────────────────────────────────────────────────
// 3) 互评任务关联缺陷 (规范缺陷库目录)
// ───────────────────────────────────────────────────────────────

interface DefectItem {
  id: string; code: string; categoryCode: string; name: string; nameEn?: string
  severity: 'low' | 'medium' | 'high' | 'critical'; description: string
  standard?: string; checkMethod?: string
}

const DEFECT_CATALOG: DefectItem[] = [
  { id: 'di-01', code: 'ST-01', categoryCode: 'STRUCT', name: '报告五要素缺失', severity: 'high', description: '患者信息/检查项目/技术参数/影像所见/诊断印象不全', standard: '报告书写规范 4.1', checkMethod: '字段完整性校验' },
  { id: 'di-02', code: 'ST-02', categoryCode: 'STRUCT', name: '诊断印象未分层', severity: 'medium', description: '未按主要诊断/次要发现/随访建议分层', standard: '报告书写规范 4.2', checkMethod: '结构模板校验' },
  { id: 'di-03', code: 'ST-03', categoryCode: 'STRUCT', name: '未对比既往', severity: 'medium', description: '有既往影像但未说明变化', standard: '报告书写规范 4.3', checkMethod: '既往对比校验' },
  { id: 'di-06', code: 'TM-01', categoryCode: 'TERM', name: '模糊表述', severity: 'medium', description: '使用非规范表述', standard: '术语规范 3.1', checkMethod: '模糊词表匹配' },
  { id: 'di-07', code: 'TM-02', categoryCode: 'TERM', name: '左右方位错误', severity: 'critical', description: '左右/前后方位与图像不一致', standard: '术语规范 3.2', checkMethod: '左右一致性校验' },
  { id: 'di-08', code: 'TM-03', categoryCode: 'TERM', name: '测量不规范', severity: 'medium', description: '病灶未测量或未标注单位', standard: '术语规范 3.3', checkMethod: '测量单位校验' },
  { id: 'di-10', code: 'AC-01', categoryCode: 'ACCUR', name: '所见与印象矛盾', severity: 'critical', description: '印象段结论无征象支持或前后矛盾', standard: '准确性要求 5.1', checkMethod: '所见-印象一致性' },
  { id: 'di-11', code: 'AC-02', categoryCode: 'ACCUR', name: '阴性结果漏报', severity: 'medium', description: '常规结构阴性描述缺失', standard: '准确性要求 5.2', checkMethod: '阴性描述校验' },
  { id: 'di-13', code: 'AC-04', categoryCode: 'ACCUR', name: '漏诊', severity: 'critical', description: '复核发现阳性病灶未报告', standard: '准确性要求 5.4', checkMethod: '复核复核' },
  { id: 'di-15', code: 'TI-01', categoryCode: 'TIMELY', name: '急诊报告超时', severity: 'high', description: '急诊报告未在 2 小时内出具', standard: '时效要求 6.1', checkMethod: 'TAT 计算' },
]

const PEER_TASK_DEFECTS = new Map<string, string[]>([
  ['pr-001', ['ST-01', 'TM-01']],
  ['pr-002', ['AC-01']],
  ['pr-003', []],
])

function defectByCode(code: string): DefectItem | undefined {
  return DEFECT_CATALOG.find((d) => d.code === code.toUpperCase())
}

// ───────────────────────────────────────────────────────────────
// 4) 缺陷库单项 详情/更新/删除 (确定性兜底: 任意 id 均可解析)
// ───────────────────────────────────────────────────────────────

function defectItemForId(id: string): DefectItem {
  const known = DEFECT_CATALOG.find((d) => d.id === id || d.code === id.toUpperCase())
  if (known) return { ...known }
  const upper = id.toUpperCase()
  const severity: DefectItem['severity'] = upper.includes('CRIT') ? 'critical' : upper.includes('HIGH') ? 'high' : upper.includes('LOW') ? 'low' : 'medium'
  return {
    id,
    code: upper.startsWith('DEF-') || upper.startsWith('DL') ? upper : `DEF-${upper}`,
    categoryCode: 'STRUCT',
    name: `缺陷项 ${id}`,
    severity,
    description: '缺陷库条目 (MSW 确定性演示数据)',
    standard: '报告书写规范',
    checkMethod: '人工/规则复核',
  }
}

// ───────────────────────────────────────────────────────────────
// 5) 报告补发
// ───────────────────────────────────────────────────────────────

let supplementSeq = 100
const SUPPLEMENTS: Array<Record<string, unknown>> = [
  { id: 'supp-005', documentId: 'DOC-SUP-005', kind: 'supplement', reportId: 'DOC-SUP-005', parentReportId: 'RP20260601001', version: 1, status: 'completed', reason: '补发: 增加复查建议', changes: '建议 6 个月后复查胸部 CT', authorId: 'D001', authorName: '张明远', startTime: '2026-06-07T10:00:00.000Z', completedTime: '2026-06-07T10:30:00.000Z' },
]

export const w4aOrphansHandlers = [
  // ── 审计链 / 留存 / 冷归档 ──
  http.get(`${API_BASE}/audit/verify-chain`, async ({ request }) => {
    await delay(80)
    const url = new URL(request.url)
    const chain = buildChain()
    const tamper = url.searchParams.get('tamper') === '1'
    const brokenAt = tamper ? 3 : null
    return HttpResponse.json({
      verified: !tamper,
      source: 'seed',
      totalBlocks: chain.length,
      checkedBlocks: tamper ? 4 : chain.length,
      headHash: chain.length > 0 ? chain[chain.length - 1]!.hash : GENESIS,
      brokenAt,
      reason: tamper ? `hash 不匹配 @ index 3 (疑似篡改)` : null,
      generatedAt: nowIso(),
      sample: chain.slice(-5).map((b) => ({ ...b })),
    })
  }),

  http.get(`${API_BASE}/audit/retention-policy`, async () => {
    await delay(60)
    return HttpResponse.json({
      retentionMonths: 6,
      retentionDays: 180,
      coldArchiveEnabled: true,
      archiveLocation: 's3://g005-audit-archive/cold',
      lastArchiveAt: null,
      encrypted: true,
      immutable: true,
      note: '依据《网络安全法》与等保2.0要求, 审计日志留存不少于 6 个月; 超期数据加密冷归档。',
    })
  }),

  http.post(`${API_BASE}/audit/cold-archive`, async () => {
    await delay(120)
    archiveSeq += 1
    const archiveId = `arc-${String(archiveSeq).padStart(4, '0')}`
    const archivedAt = nowIso()
    const archivedCount = AUDIT_SEED_RECORDS.filter((r) => new Date(r.createdAt).getTime() < Date.now() - 90 * 86400000).length || 6
    return HttpResponse.json({
      archiveId,
      archivedCount,
      location: `s3://g005-audit-archive/cold/${archiveId}`,
      checksum: fakeHash(`${archiveId}:${archivedCount}:${archivedAt}`),
      archivedAt,
      retentionMonths: 6,
    })
  }),

  // ── 分级审核规则 (resolve 先于 /:id) ──
  http.get(`${API_BASE}/report-rules/review-tiers`, async () => {
    await delay(80)
    const data = tierRules
      .slice()
      .sort((a, b) => b.priority - a.priority || a.code.localeCompare(b.code))
      .map((r) => ({ ...r, when: { ...r.when } }))
    return HttpResponse.json({ source: 'demo', generatedAt: nowIso(), total: data.length, data })
  }),

  http.post(`${API_BASE}/report-rules/review-tiers/resolve`, async ({ request }) => {
    await delay(90)
    const input = ((await request.json().catch(() => ({}))) as ResolveInput) ?? {}
    const matched: Array<{ ruleId: string; code: string; name: string; tier: ReviewTier; reason: string }> = []
    let requiredTier: ReviewTier = 'none'
    for (const rule of tierRules.filter((r) => r.enabled).sort((a, b) => b.priority - a.priority)) {
      if (!ruleMatches(rule, input)) continue
      matched.push({ ruleId: rule.id, code: rule.code, name: rule.name, tier: rule.tier, reason: rule.reason })
      requiredTier = maxTier(requiredTier, rule.tier)
    }
    if (matched.length === 0) requiredTier = 'initial'
    const critical = Boolean(input.isCritical) || input.severity === 'critical' || matched.some((m) => m.code === 'RT-CRIT-01' || m.code === 'RT-SEV-CRIT')
    return HttpResponse.json({
      source: 'demo',
      generatedAt: nowIso(),
      reportId: input.reportId,
      input: { ...input },
      requiredTier,
      tierLabel: TIER_LABELS[requiredTier],
      steps: buildTierSteps(requiredTier, matched[0]?.reason ?? ''),
      matchedRules: matched.sort((a, b) => TIER_RANK[b.tier] - TIER_RANK[a.tier] || a.code.localeCompare(b.code)),
      critical,
    })
  }),

  http.post(`${API_BASE}/report-rules/review-tiers`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as Partial<ReviewTierRule> & { name?: string; tier?: ReviewTier }
    if (!body?.name || !body?.tier) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'name 与 tier 不能为空' } }, { status: 400 })
    }
    tierSeq += 1
    const rule: ReviewTierRule = {
      id: `rtier-c-${String(tierSeq).padStart(3, '0')}`,
      code: (body.code ?? '').trim() || `RT-CUSTOM-${tierSeq}`,
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      tier: body.tier,
      enabled: body.enabled ?? true,
      priority: Number.isFinite(body.priority) ? Number(body.priority) : 30,
      when: { ...(body.when ?? {}) },
      reason: body.reason?.trim() || '自定义分级审核规则',
    }
    tierRules = [rule, ...tierRules]
    return HttpResponse.json(rule, { status: 201 })
  }),

  http.put(`${API_BASE}/report-rules/review-tiers/:id`, async ({ params, request }) => {
    await delay(90)
    const body = (await request.json().catch(() => ({}))) as Partial<ReviewTierRule>
    const rule = tierRules.find((r) => r.id === params.id)
    if (!rule) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `分级审核规则 ${params.id} 不存在` } }, { status: 404 })
    if (body.name !== undefined && body.name.trim()) rule.name = body.name.trim()
    if (body.code !== undefined && body.code.trim()) rule.code = body.code.trim()
    if (body.description !== undefined) rule.description = body.description
    if (body.tier !== undefined) rule.tier = body.tier
    if (body.enabled !== undefined) rule.enabled = body.enabled
    if (body.priority !== undefined && Number.isFinite(body.priority)) rule.priority = Number(body.priority)
    if (body.reason !== undefined && body.reason.trim()) rule.reason = body.reason.trim()
    if (body.when !== undefined) rule.when = { ...body.when }
    return HttpResponse.json({ ...rule, when: { ...rule.when } })
  }),

  http.delete(`${API_BASE}/report-rules/review-tiers/:id`, async ({ params }) => {
    await delay(80)
    const rule = tierRules.find((r) => r.id === params.id)
    if (!rule) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `分级审核规则 ${params.id} 不存在` } }, { status: 404 })
    if (rule.id.startsWith('rtier-b-')) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '内置规则不可删除, 可停用' } }, { status: 400 })
    }
    tierRules = tierRules.filter((r) => r.id !== params.id)
    return HttpResponse.json({ id: params.id, deleted: true })
  }),

  // ── 互评任务关联缺陷 ──
  http.get(`${API_BASE}/report-peer-review/tasks/:id/defects`, async ({ params }) => {
    await delay(60)
    const codes = PEER_TASK_DEFECTS.get(String(params.id)) ?? []
    const data = codes.map((c) => defectByCode(c)).filter((x): x is DefectItem => Boolean(x))
    return HttpResponse.json({ success: true, data })
  }),

  http.post(`${API_BASE}/report-peer-review/tasks/:id/defects`, async ({ params, request }) => {
    await delay(80)
    const body = (await request.json().catch(() => ({}))) as { defectCodes?: string[] }
    const codes = Array.isArray(body?.defectCodes) ? body.defectCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean) : []
    if (codes.length === 0) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'defectCodes 不能为空' } }, { status: 400 })
    }
    const invalid = codes.find((c) => !defectByCode(c))
    if (invalid) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: `缺陷编码 ${invalid} 不在缺陷库中` } }, { status: 400 })
    }
    const key = String(params.id)
    const merged = Array.from(new Set([...(PEER_TASK_DEFECTS.get(key) ?? []), ...codes]))
    PEER_TASK_DEFECTS.set(key, merged)
    return HttpResponse.json({ success: true, data: { id: key, defectCodes: merged } })
  }),

  // ── 缺陷库单项 详情/更新/删除 ──
  http.get(`${API_BASE}/defect-library/items/:id`, async ({ params }) => {
    await delay(50)
    return HttpResponse.json({ success: true, data: defectItemForId(String(params.id)) })
  }),

  http.patch(`${API_BASE}/defect-library/items/:id`, async ({ params, request }) => {
    await delay(70)
    const patch = (await request.json().catch(() => ({}))) as Partial<DefectItem>
    const item = { ...defectItemForId(String(params.id)), ...patch, id: String(params.id) }
    return HttpResponse.json({ success: true, data: item })
  }),

  http.delete(`${API_BASE}/defect-library/items/:id`, async ({ params }) => {
    await delay(60)
    return HttpResponse.json({ success: true, data: { id: String(params.id), deleted: true } })
  }),

  // ── 报告补发 ──
  http.post(`${API_BASE}/amend/supplement`, async ({ request }) => {
    await delay(100)
    const body = (await request.json().catch(() => ({}))) as { parentReportId?: string; reportId?: string; reason?: string; changes?: string }
    if (!body?.parentReportId?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: 'parentReportId 不能为空' } }, { status: 400 })
    }
    if (!body?.reason?.trim()) {
      return HttpResponse.json({ success: false, error: { code: 'BAD_REQUEST', message: '补发原因不能为空' } }, { status: 400 })
    }
    supplementSeq += 1
    const documentId = body.reportId?.trim() || `DOC-SUP-${supplementSeq}`
    const at = nowIso()
    const item = {
      id: `supp-${supplementSeq}`,
      documentId,
      kind: 'supplement',
      reportId: documentId,
      parentReportId: body.parentReportId.trim(),
      version: 1,
      status: 'completed',
      reason: body.reason.trim(),
      changes: body.changes?.trim() || body.reason.trim(),
      authorId: 'D001',
      authorName: '张明远',
      startTime: at,
      completedTime: at,
    }
    SUPPLEMENTS.unshift(item)
    return HttpResponse.json({ success: true, data: item, linkedTo: body.parentReportId.trim() })
  }),

  http.get(`${API_BASE}/amend/supplements/:parentReportId`, async ({ params }) => {
    await delay(60)
    const parent = String(params.parentReportId)
    const data = SUPPLEMENTS.filter((s) => s.parentReportId === parent)
    return HttpResponse.json({ success: true, data })
  }),

  // ── 预签结构化字段校验 ──
  http.post(`${API_BASE}/reports/:id/validate-fields`, async ({ params, request }) => {
    await delay(70)
    const body = (await request.json().catch(() => ({}))) as { values?: Record<string, unknown> }
    const values = body?.values ?? {}
    const errors: Array<{ field: string; label: string; severity: 'error' | 'warning'; message: string }> = []
    const warnings: Array<{ field: string; label: string; severity: 'error' | 'warning'; message: string }> = []
    const present = (k: string) => values[k] !== undefined && values[k] !== null && String(values[k]).trim() !== ''

    if (!present('findings')) errors.push({ field: 'findings', label: '影像所见', severity: 'error', message: '影像所见 为必填项' })
    else if (String(values.findings).trim().length < 10) warnings.push({ field: 'findings', label: '影像所见', severity: 'warning', message: '影像所见 过短 (<10)' })
    if (!present('conclusion')) errors.push({ field: 'conclusion', label: '报告结论', severity: 'error', message: '报告结论 为必填项' })
    else if (String(values.conclusion).trim().length < 5) warnings.push({ field: 'conclusion', label: '报告结论', severity: 'warning', message: '报告结论 过短 (<5)' })
    if (present('noduleSizeMm')) {
      const n = Number(values.noduleSizeMm)
      if (!Number.isFinite(n)) errors.push({ field: 'noduleSizeMm', label: '结节大小', severity: 'error', message: '结节大小 必须为数值' })
      else if (n < 0 || n > 200) warnings.push({ field: 'noduleSizeMm', label: '结节大小', severity: 'warning', message: `结节大小=${n}mm 超出参考范围` })
    }

    return HttpResponse.json({ reportId: String(params.id), valid: errors.length === 0, errors, warnings })
  }),
]
