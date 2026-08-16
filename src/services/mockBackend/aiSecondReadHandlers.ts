// [G005 Wave 7C v3.0.6.11-101] /api/v1/ai-second-read MSW handlers
// 对齐后端 ai-second-read.module + aiSecondReadApi (定稿前 AI 复查: 风险项/忽略/采纳/加入报告 + 统计)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/ai-second-read`

type RiskCategory = 'missed_finding' | 'description_gap' | 'conclusion_inconsistency'
type RiskSeverity = 'high' | 'medium' | 'low'
type RiskStatus = 'open' | 'ignored' | 'adopted' | 'appended'
type RiskLevel = 'low' | 'medium' | 'high'

interface RiskItem {
  id: string
  category: RiskCategory
  categoryLabel: string
  severity: RiskSeverity
  title: string
  description: string
  suggestion: string
  evidence: string
  status: RiskStatus
  handledBy?: string
  handledAt?: string
}

interface Result {
  id: string
  reportId: string
  patientName: string
  modality: string
  riskScore: number
  riskLevel: RiskLevel
  riskItems: RiskItem[]
  featureStats: { textLength: number; sectionCount: number; sentenceCount: number; findingTermCount: number; technicalTermCount: number; fuzzyTermCount: number; criticalTermCount: number }
  modelVersion: string
  status: 'completed'
  reviewedBy?: string
  reviewedAt?: string
  appendedText?: string
  appendedAt?: string
  createdAt: string
}

const CATEGORY_LABEL: Record<RiskCategory, string> = {
  missed_finding: '漏报征象',
  description_gap: '描述缺口',
  conclusion_inconsistency: '结论不一致',
}

let results: Result[] = [
  {
    id: 'ai2r-001', reportId: 'RPT-A-0030', patientName: '王德发', modality: 'CT',
    riskScore: 74, riskLevel: 'high',
    riskItems: [
      { id: 'ri-001', category: 'missed_finding', categoryLabel: '漏报征象', severity: 'high', title: '疑漏报肺气肿征象', description: '所见未描述双肺气肿改变', suggestion: '补充"双肺气肿"征象描述', evidence: '模型检出低密度区比例偏高', status: 'open' },
      { id: 'ri-002', category: 'conclusion_inconsistency', categoryLabel: '结论不一致', severity: 'medium', title: '结论与所见不完全一致', description: '所见描述结节但结论未提及', suggestion: '结论补充结节随访建议', evidence: '关键词对齐差异', status: 'open' },
    ],
    featureStats: { textLength: 486, sectionCount: 4, sentenceCount: 12, findingTermCount: 6, technicalTermCount: 3, fuzzyTermCount: 2, criticalTermCount: 1 },
    modelVersion: 'ai-second-read-1.3.0', status: 'completed',
    createdAt: '2026-08-14T10:00:00.000Z',
  },
  {
    id: 'ai2r-002', reportId: 'RPT-A-0035', patientName: '张建国', modality: 'CT',
    riskScore: 32, riskLevel: 'low',
    riskItems: [
      { id: 'ri-003', category: 'description_gap', categoryLabel: '描述缺口', severity: 'low', title: '随访建议可细化', description: '随访建议较笼统', suggestion: '明确随访周期与复查方式', evidence: '模板比对', status: 'ignored', handledBy: '王医生', handledAt: '2026-08-15T09:00:00.000Z' },
    ],
    featureStats: { textLength: 610, sectionCount: 5, sentenceCount: 15, findingTermCount: 7, technicalTermCount: 4, fuzzyTermCount: 0, criticalTermCount: 0 },
    modelVersion: 'ai-second-read-1.3.0', status: 'completed',
    reviewedBy: '王医生', reviewedAt: '2026-08-15T09:00:00.000Z',
    createdAt: '2026-08-15T08:50:00.000Z',
  },
]

let resultSeq = 100
let itemSeq = 100

function analyzeInput(input: Record<string, unknown>): Result {
  const findings = String(input.findings ?? '')
  const conclusion = String(input.conclusion ?? '')
  const items: RiskItem[] = []
  if (findings.includes('结节') && !conclusion.includes('结节')) {
    items.push({ id: `ri-${itemSeq++}`, category: 'conclusion_inconsistency', categoryLabel: '结论不一致', severity: 'high', title: '结论未提及所见结节', description: '所见描述了结节但结论未包含', suggestion: '结论补充结节描述与随访建议', evidence: '关键词对齐差异', status: 'open' })
  }
  if (findings.includes('气肿') === false && findings.length > 200) {
    items.push({ id: `ri-${itemSeq++}`, category: 'description_gap', categoryLabel: '描述缺口', severity: 'medium', title: '可能缺少气肿描述', description: '未见双肺气肿相关描述', suggestion: '如存在气肿请补充描述', evidence: '模型特征比对', status: 'open' })
  }
  if (findings.includes('考虑') || findings.includes('可能')) {
    items.push({ id: `ri-${itemSeq++}`, category: 'description_gap', categoryLabel: '描述缺口', severity: 'low', title: '模糊措辞建议替换', description: '存在"考虑/可能"类模糊表述', suggestion: '使用确定性措辞', evidence: '规则引擎', status: 'open' })
  }
  if (items.length === 0) {
    items.push({ id: `ri-${itemSeq++}`, category: 'description_gap', categoryLabel: '描述缺口', severity: 'low', title: '整体质量良好', description: '未发现明显风险项', suggestion: '可直接定稿', evidence: '综合评分', status: 'open' })
  }
  const sentenceCount = (findings.match(/[。；]/g) ?? []).length + 1
  const featureStats = { textLength: findings.length + conclusion.length, sectionCount: 4, sentenceCount, findingTermCount: (findings.match(/结节|占位|囊肿|出血|缺血/g) ?? []).length, technicalTermCount: 3, fuzzyTermCount: (findings.match(/考虑|可能|大概/g) ?? []).length, criticalTermCount: (findings.match(/危急|紧急/g) ?? []).length }
  const high = items.filter((i) => i.severity === 'high').length
  const medium = items.filter((i) => i.severity === 'medium').length
  const riskScore = Math.round(Math.max(0, Math.min(99, 18 + high * 22 + medium * 12)))
  const riskLevel: RiskLevel = riskScore >= 60 ? 'high' : riskScore >= 35 ? 'medium' : 'low'
  return {
    id: `ai2r-${resultSeq++}`,
    reportId: String(input.reportId ?? 'RPT-UNKNOWN'),
    patientName: String(input.patientName ?? '演示患者'),
    modality: String(input.modality ?? 'CT'),
    riskScore,
    riskLevel,
    riskItems: items,
    featureStats,
    modelVersion: 'ai-second-read-1.3.0',
    status: 'completed',
    createdAt: new Date().toISOString(),
  }
}

export const aiSecondReadHandlers = [
  http.post(`${API}/analyze`, async ({ request }) => {
    await delay(120)
    const input = (await request.json()) as Record<string, unknown>
    const result = analyzeInput(input ?? {})
    results.unshift(result)
    return HttpResponse.json({ success: true, data: result })
  }),

  http.get(`${API}/results`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: results })
  }),

  http.get(`${API}/results/:id`, async ({ params }) => {
    await delay(40)
    const item = results.find((r) => r.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `result ${params.id} not found` } }, { status: 404 })
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/results/:id/risk-items/:itemId/ignore`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reviewer?: string }
    const item = results.find((r) => r.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `result ${params.id} not found` } }, { status: 404 })
    const risk = item.riskItems.find((x) => x.id === params.itemId)
    if (risk) {
      risk.status = 'ignored'
      risk.handledBy = String(body?.reviewer ?? '')
      risk.handledAt = new Date().toISOString()
    }
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/results/:id/risk-items/:itemId/adopt`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reviewer?: string }
    const item = results.find((r) => r.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `result ${params.id} not found` } }, { status: 404 })
    const risk = item.riskItems.find((x) => x.id === params.itemId)
    if (risk) {
      risk.status = 'adopted'
      risk.handledBy = String(body?.reviewer ?? '')
      risk.handledAt = new Date().toISOString()
    }
    return HttpResponse.json({ success: true, data: item })
  }),

  http.post(`${API}/results/:id/append`, async ({ params, request }) => {
    await delay(50)
    const body = (await request.json()) as { reviewer?: string; appendedText?: string }
    const item = results.find((r) => r.id === params.id)
    if (!item) return HttpResponse.json({ success: false, error: { code: 'NOT_FOUND', message: `result ${params.id} not found` } }, { status: 404 })
    item.appendedText = String(body?.appendedText ?? '')
    item.appendedAt = new Date().toISOString()
    item.reviewedBy = String(body?.reviewer ?? '')
    item.reviewedAt = item.appendedAt
    for (const risk of item.riskItems) {
      if (risk.status === 'open') { risk.status = 'appended'; risk.handledBy = String(body?.reviewer ?? ''); risk.handledAt = item.appendedAt }
    }
    return HttpResponse.json({ success: true, data: item })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const total = results.length
    const openItems = results.reduce((s, r) => s + r.riskItems.filter((i) => i.status === 'open').length, 0)
    const handled = results.reduce((s, r) => s + r.riskItems.filter((i) => i.status !== 'open').length, 0)
    const byCategory = (['missed_finding', 'description_gap', 'conclusion_inconsistency'] as const).map((c) => ({
      category: c,
      label: CATEGORY_LABEL[c],
      count: results.reduce((s, r) => s + r.riskItems.filter((i) => i.category === c).length, 0),
      open: results.reduce((s, r) => s + r.riskItems.filter((i) => i.category === c && i.status === 'open').length, 0),
    }))
    return HttpResponse.json({
      success: true,
      data: {
        total,
        avgRiskScore: Math.round(results.reduce((s, r) => s + r.riskScore, 0) / Math.max(1, total)),
        highRiskCount: results.filter((r) => r.riskLevel === 'high').length,
        mediumRiskCount: results.filter((r) => r.riskLevel === 'medium').length,
        lowRiskCount: results.filter((r) => r.riskLevel === 'low').length,
        openRiskItems: openItems,
        handledRiskItems: handled,
        byCategory,
        bySeverity: (['high', 'medium', 'low'] as const).map((sev) => ({ severity: sev, count: results.reduce((s, r) => s + r.riskItems.filter((i) => i.severity === sev).length, 0) })),
        appendedCount: results.filter((r) => r.appendedText).length,
      },
    })
  }),
]
