// [G005 Wave 6A v3.0.6.11-101] /api/v1/report-rules MSW handlers
// 对齐后端 report-rules.module + reportRulesApi (18+ 内置规则 + 自定义规则 CRUD + 规则集 + 评估)
// 响应形状: GET 列表/历史/统计 → { source, generatedAt, data } (RuleEnvelope); 写操作 → 业务对象
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-rules`

type RuleType = 'missing_field' | 'terminology' | 'unit' | 'length_range' | 'numeric_reasonability' | 'duplicate'
type RuleSeverity = 'error' | 'warning' | 'info'
type RuleField = 'findings' | 'diagnosis' | 'impression' | 'conclusion' | 'recommendations' | 'fullText'
type RuleOperator = 'empty' | 'not_empty' | 'contains' | 'not_contains' | 'regex' | 'length_lt' | 'length_gte' | 'numeric_over' | 'dup_count'

interface QualityRule {
  id: string
  code: string
  name: string
  type: RuleType
  severity: RuleSeverity
  description: string
  condition: { field: RuleField; operator: RuleOperator; value: string | number; when?: { field: RuleField; operator: RuleOperator; value: string | number } }
  suggestion: string
  builtIn: boolean
  enabled: boolean
  examTypes: string[]
  createdAt?: string
}

interface RuleSet {
  id: string
  name: string
  description: string
  examTypes: string[]
  ruleIds: string[]
  createdAt: string
  updatedAt: string
}

interface Violation {
  ruleId: string
  ruleCode: string
  ruleName: string
  type: RuleType
  severity: RuleSeverity
  field: string
  position: number
  snippet: string
  suggestion: string
}

const RULES: QualityRule[] = [
  { id: 'qr-001', code: 'RULE-MISS-01', name: '影像所见必填', type: 'missing_field', severity: 'error', description: '影像所见字段不能为空', condition: { field: 'findings', operator: 'empty', value: '' }, suggestion: '请填写影像所见', builtIn: true, enabled: true, examTypes: ['CT', 'MR', 'DR', 'US'], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-002', code: 'RULE-MISS-02', name: '诊断结论必填', type: 'missing_field', severity: 'error', description: '诊断结论字段不能为空', condition: { field: 'conclusion', operator: 'empty', value: '' }, suggestion: '请填写诊断结论', builtIn: true, enabled: true, examTypes: ['CT', 'MR', 'DR', 'US'], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-003', code: 'RULE-MISS-03', name: '随访建议必填(增强)', type: 'missing_field', severity: 'warning', description: '增强检查报告需要随访建议', condition: { field: 'recommendations', operator: 'empty', value: '', when: { field: 'fullText', operator: 'contains', value: '增强' } }, suggestion: '补充随访建议', builtIn: true, enabled: true, examTypes: ['CT'], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-004', code: 'RULE-TERM-01', name: '禁用非规范缩写', type: 'terminology', severity: 'warning', description: '禁止使用非规范缩写如 "cm"', condition: { field: 'fullText', operator: 'contains', value: 'cm' }, suggestion: '使用规范单位 "mm"', builtIn: true, enabled: true, examTypes: [], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-005', code: 'RULE-TERM-02', name: '禁用模糊表述', type: 'terminology', severity: 'warning', description: '避免"考虑/可能/大概"模糊措辞', condition: { field: 'conclusion', operator: 'contains', value: '考虑' }, suggestion: '使用确定性诊断措辞', builtIn: true, enabled: true, examTypes: [], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-006', code: 'RULE-UNIT-01', name: '尺寸必须带单位', type: 'unit', severity: 'error', description: '病灶尺寸数值需带单位 mm', condition: { field: 'fullText', operator: 'regex', value: '\\d{1,3}(?![a-zA-Z%°℃])' }, suggestion: '为数值补充单位', builtIn: true, enabled: true, examTypes: [], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-007', code: 'RULE-LEN-01', name: '结论长度下限', type: 'length_range', severity: 'info', description: '诊断结论至少 8 个字符', condition: { field: 'conclusion', operator: 'length_lt', value: 8 }, suggestion: '结论过于简短, 请补充', builtIn: true, enabled: true, examTypes: [], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-008', code: 'RULE-LEN-02', name: '所见段落长度上限', type: 'length_range', severity: 'info', description: '影像所见段落长度不超过 2000 字符', condition: { field: 'findings', operator: 'length_gte', value: 2000 }, suggestion: '段落过长, 请精简', builtIn: true, enabled: true, examTypes: [], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-009', code: 'RULE-NUM-01', name: '数值合理性(肝占位)', type: 'numeric_reasonability', severity: 'warning', description: '肝占位尺寸不应超过 30cm', condition: { field: 'findings', operator: 'numeric_over', value: 30, when: { field: 'fullText', operator: 'contains', value: '肝' } }, suggestion: '核对病灶尺寸数值', builtIn: true, enabled: true, examTypes: ['CT', 'MR'], createdAt: '2026-06-01T08:00:00.000Z' },
  { id: 'qr-010', code: 'RULE-DUP-01', name: '重复表述检测', type: 'duplicate', severity: 'info', description: '同一句子重复出现', condition: { field: 'fullText', operator: 'dup_count', value: 2 }, suggestion: '删除重复表述', builtIn: true, enabled: true, examTypes: [], createdAt: '2026-06-01T08:00:00.000Z' },
]

const RULESETS: RuleSet[] = [
  { id: 'rs-001', name: '胸部 CT 报告质控集', description: '胸部 CT 检查默认质控规则集', examTypes: ['CT'], ruleIds: ['qr-001', 'qr-002', 'qr-004', 'qr-006', 'qr-007'], createdAt: '2026-06-05T08:00:00.000Z', updatedAt: '2026-06-05T08:00:00.000Z' },
  { id: 'rs-002', name: '危急报告质控集', description: '危急值报告加强规则', examTypes: [], ruleIds: ['qr-002', 'qr-005', 'qr-009'], createdAt: '2026-06-10T08:00:00.000Z', updatedAt: '2026-06-10T08:00:00.000Z' },
]

const VIOLATION_HISTORY: Array<{ id: string; reportId: string; ruleCode: string; ruleName: string; severity: RuleSeverity; field: string; evaluatedAt: string }> = [
  { id: 'vh-001', reportId: 'RPT-A-0001', ruleCode: 'RULE-TERM-01', ruleName: '禁用非规范缩写', severity: 'warning', field: 'fullText', evaluatedAt: '2026-08-12T09:00:00.000Z' },
  { id: 'vh-002', reportId: 'RPT-A-0001', ruleCode: 'RULE-LEN-01', ruleName: '结论长度下限', severity: 'info', field: 'conclusion', evaluatedAt: '2026-08-12T09:00:00.000Z' },
  { id: 'vh-003', reportId: 'RPT-A-0012', ruleCode: 'RULE-MISS-03', ruleName: '随访建议必填(增强)', severity: 'warning', field: 'recommendations', evaluatedAt: '2026-08-13T10:30:00.000Z' },
]

let rules = [...RULES]
let rulesets = [...RULESETS]
let ruleSeq = 100
let rulesetSeq = 100

const envelope = (data: unknown) => ({ source: 'demo' as const, generatedAt: new Date().toISOString(), data })

function evaluateInput(input: Record<string, unknown>) {
  const findings = String(input.findings ?? '')
  const conclusion = String(input.conclusion ?? '')
  const fullText = `${findings} ${conclusion} ${String(input.recommendations ?? '')}`
  const violations: Violation[] = []
  const active = rules.filter((r) => r.enabled && (r.examTypes.length === 0 || r.examTypes.includes(String(input.examType ?? '')) || !input.examType))
  for (const rule of active) {
    const c = rule.condition
    const fieldText = c.field === 'fullText' ? fullText : String(input[c.field] ?? '')
    let hit = false
    switch (c.operator) {
      case 'empty': hit = fieldText.trim() === ''; break
      case 'not_empty': hit = fieldText.trim() !== ''; break
      case 'contains': hit = fieldText.includes(String(c.value)); break
      case 'not_contains': hit = !fieldText.includes(String(c.value)); break
      case 'regex': hit = new RegExp(String(c.value)).test(fieldText); break
      case 'length_lt': hit = fieldText.length < Number(c.value); break
      case 'length_gte': hit = fieldText.length >= Number(c.value); break
      case 'numeric_over': hit = (fieldText.match(/\d+(\.\d+)?/g) ?? []).some((n) => Number(n) > Number(c.value)); break
      case 'dup_count': {
        const lines = fieldText.split(/[。；\n]/).filter((l) => l.trim().length > 4)
        hit = new Set(lines).size < lines.length
        break
      }
      default: break
    }
    if (c.when) {
      const whenText = c.when.field === 'fullText' ? fullText : String(input[c.when.field] ?? '')
      const whenHit = c.when.operator === 'contains' ? whenText.includes(String(c.when.value)) : whenText === String(c.when.value)
      if (!whenHit) hit = false
    }
    if (hit) {
      violations.push({
        ruleId: rule.id, ruleCode: rule.code, ruleName: rule.name, type: rule.type, severity: rule.severity,
        field: c.field, position: fieldText.length > 0 ? 0 : -1,
        snippet: fieldText.slice(0, 60) || '(空)',
        suggestion: rule.suggestion,
      })
    }
  }
  const score = Math.max(0, Math.round((1 - violations.filter((v) => v.severity === 'error').length * 0.15 - violations.filter((v) => v.severity === 'warning').length * 0.08 - violations.filter((v) => v.severity === 'info').length * 0.03) * 100))
  return {
    source: 'demo' as const,
    generatedAt: new Date().toISOString(),
    reportId: input.reportId ? String(input.reportId) : undefined,
    ruleCount: rules.length,
    enabledRuleCount: active.length,
    violations,
    score,
  }
}

export const reportRulesHandlers = [
  http.get(`${API}/rules`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const examType = url.searchParams.get('examType')
    const items = examType ? rules.filter((r) => r.examTypes.length === 0 || r.examTypes.includes(examType)) : rules
    return HttpResponse.json({ success: true, data: envelope(items) })
  }),

  http.post(`${API}/rules`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as Record<string, unknown>
    const rule: QualityRule = {
      id: `qr-${ruleSeq++}`,
      code: String(body.code ?? `CUSTOM-${ruleSeq}`),
      name: String(body.name ?? ''),
      type: (body.type ?? 'terminology') as RuleType,
      severity: (body.severity ?? 'warning') as RuleSeverity,
      description: String(body.description ?? ''),
      condition: (body.condition ?? { field: 'fullText', operator: 'contains', value: '' }) as QualityRule['condition'],
      suggestion: String(body.suggestion ?? ''),
      builtIn: false,
      enabled: true,
      examTypes: Array.isArray(body.examTypes) ? body.examTypes.map(String) : [],
      createdAt: new Date().toISOString(),
    }
    rules.unshift(rule)
    return HttpResponse.json({ success: true, data: rule })
  }),

  http.put(`${API}/rules/:id`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as Record<string, unknown>
    const rule = rules.find((r) => r.id === params.id)
    if (!rule) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `rule ${params.id} not found` } }, { status: 404 })
    Object.assign(rule, body)
    return HttpResponse.json({ success: true, data: rule })
  }),

  http.delete(`${API}/rules/:id`, async ({ params }) => {
    await delay(40)
    const idx = rules.findIndex((r) => r.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `rule ${params.id} not found` } }, { status: 404 })
    rules.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { id: params.id, deleted: true } })
  }),

  http.post(`${API}/evaluate`, async ({ request }) => {
    await delay(80)
    const input = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ success: true, data: evaluateInput(input ?? {}) })
  }),

  http.get(`${API}/rulesets`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: envelope(rulesets) })
  }),

  http.post(`${API}/rulesets`, async ({ request }) => {
    await delay(50)
    const body = (await request.json()) as { name?: string; description?: string; examTypes?: string[]; ruleIds?: string[] }
    const now = new Date().toISOString()
    const rs: RuleSet = {
      id: `rs-${rulesetSeq++}`,
      name: String(body?.name ?? '未命名规则集'),
      description: String(body?.description ?? ''),
      examTypes: body?.examTypes ?? [],
      ruleIds: body?.ruleIds ?? [],
      createdAt: now,
      updatedAt: now,
    }
    rulesets.unshift(rs)
    return HttpResponse.json({ success: true, data: rs })
  }),

  http.put(`${API}/rulesets/:id`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as Record<string, unknown>
    const rs = rulesets.find((r) => r.id === params.id)
    if (!rs) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `ruleset ${params.id} not found` } }, { status: 404 })
    Object.assign(rs, body, { updatedAt: new Date().toISOString() })
    return HttpResponse.json({ success: true, data: rs })
  }),

  http.delete(`${API}/rulesets/:id`, async ({ params }) => {
    await delay(40)
    const idx = rulesets.findIndex((r) => r.id === params.id)
    if (idx < 0) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `ruleset ${params.id} not found` } }, { status: 404 })
    rulesets.splice(idx, 1)
    return HttpResponse.json({ success: true, data: { id: params.id, deleted: true } })
  }),

  http.get(`${API}/history`, async ({ request }) => {
    await delay(40)
    const url = new URL(request.url)
    const reportId = url.searchParams.get('reportId')
    const items = reportId ? VIOLATION_HISTORY.filter((v) => v.reportId === reportId) : VIOLATION_HISTORY
    return HttpResponse.json({ success: true, data: envelope(items) })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const custom = rules.filter((r) => !r.builtIn).length
    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    for (const r of rules) {
      byType[r.type] = (byType[r.type] ?? 0) + 1
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1
    }
    return HttpResponse.json({
      success: true,
      data: envelope({
        totalRules: rules.length,
        builtInRules: rules.length - custom,
        customRules: custom,
        byType,
        bySeverity,
        totalEvaluations: 148,
        totalViolations: VIOLATION_HISTORY.length + 21,
        violationRate: 16.2,
        topRules: [
          { code: 'RULE-TERM-01', name: '禁用非规范缩写', count: 46 },
          { code: 'RULE-LEN-01', name: '结论长度下限', count: 33 },
          { code: 'RULE-MISS-03', name: '随访建议必填(增强)', count: 27 },
        ],
      }),
    })
  }),
]
