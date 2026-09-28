// [v3.0.6.11-106] 新增端点 MSW handlers
// 覆盖: rqi-2024 (7 条国标指标) / rqi-report-center (国家上报) / contrast 外渗 /
//       criticals 国标13类+10min / report-rules RWS / quality-indicators 40条 /
//       clinical-feedback / devices/schedule (甘特)
// 数据确定性 (无 Math.random), 与后端孤儿模块 seed 口径一致。
import { http, HttpResponse, delay } from 'msw'

const API = '/api/v1'

type RqiStatus = 'pass' | 'warn' | 'fail'

interface SeedDef { code: string; name: string; standard: string; unit: '%' | '‰'; target: number; direction: 'higher' | 'lower'; num: number; den: number; warnMargin: number }

const DEFS: SeedDef[] = [
  { code: 'RQI-IIA-01', name: '放射影像检查图像伪影率', standard: 'RQI-IIA-01', unit: '%', target: 2, direction: 'lower', num: 13, den: 860, warnMargin: 0.5 },
  { code: 'RQI-RRC-02', name: '急诊放射影像检查报告2小时完成率', standard: 'RQI-RRC-02', unit: '%', target: 95, direction: 'higher', num: 168, den: 175, warnMargin: 2 },
  { code: 'RQI-RWS-03', name: '放射影像报告书写规范率', standard: 'RQI-RWS-03', unit: '%', target: 98, direction: 'higher', num: 972, den: 985, warnMargin: 1 },
  { code: 'RQI-RCV-04', name: '放射影像危急值10分钟内通报完成率', standard: 'RQI-RCV-04', unit: '%', target: 100, direction: 'higher', num: 28, den: 30, warnMargin: 5 },
  { code: 'RQI-ICME-05', name: '增强CT检查静脉对比剂外渗发生率', standard: 'RQI-ICME-05', unit: '‰', target: 0.1, direction: 'lower', num: 3, den: 480, warnMargin: 0.05 },
  { code: 'RQI-RCR-06', name: 'PI-RADS分类率', standard: 'RQI-RCR-06', unit: '%', target: 95, direction: 'higher', num: 86, den: 90, warnMargin: 3 },
  { code: 'RQI-RCR-07', name: 'BI-RADS分类率', standard: 'RQI-RCR-07', unit: '%', target: 95, direction: 'higher', num: 141, den: 146, warnMargin: 3 },
]

function rateOf(d: SeedDef): number {
  return d.unit === '‰' ? Math.round((d.num / d.den) * 1000 * 100) / 100 : Math.round((d.num / d.den) * 100 * 100) / 100
}
function statusOf(d: SeedDef): RqiStatus {
  const r = rateOf(d)
  if (d.direction === 'higher') {
    if (r >= d.target) return 'pass'
    if (r >= d.target - d.warnMargin) return 'warn'
    return 'fail'
  }
  if (r <= d.target) return 'pass'
  if (r <= d.target + d.warnMargin) return 'warn'
  return 'fail'
}
function buildIndicator(d: SeedDef, period: string) {
  const byDimension = d.code === 'RQI-IIA-01'
    ? [
        { dimension: 'CT', label: 'CT', numerator: 9, denominator: 560, rate: Math.round((9 / 560) * 100 * 100) / 100, status: 'pass' as RqiStatus },
        { dimension: 'MRI', label: 'MRI', numerator: 4, denominator: 300, rate: Math.round((4 / 300) * 100 * 100) / 100, status: 'pass' as RqiStatus },
      ]
    : undefined
  return {
    code: d.code,
    name: d.name,
    numerator: d.num,
    denominator: d.den,
    rate: rateOf(d),
    unit: d.unit,
    target: d.target,
    direction: d.direction,
    status: statusOf(d),
    period,
    granularity: 'month' as const,
    standard: d.standard,
    byDimension,
  }
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function indicatorsPayload(period?: string) {
  const p = period || currentPeriod()
  return {
    source: 'seed' as const,
    period: p,
    granularity: 'month' as const,
    dateFrom: `${p}-01`,
    dateTo: `${p}-28`,
    standard: '国卫办医政函〔2024〕150号 附件4',
    count: DEFS.length,
    indicators: DEFS.map((d) => buildIndicator(d, p)),
  }
}

// 批次内存 (字段对齐 backend RqiReportBatch / src/services/api/rqiReportCenterApi.ts)
interface Batch {
  id: string; period: string; periodLabel: string; granularity: 'month' | 'quarter' | 'year'
  status: string; indicatorCount: number; createdAt: string; createdBy: string
  submittedAt: string | null; receiptAt: string | null; receiptNo: string | null
  indicators: ReturnType<typeof indicatorsPayload>['indicators']; fileName: string
  contentHash: string; remark: string | null; rejectReason: string | null
  dateFrom: string; dateTo: string; source: 'memory' | 'seed'
}
function seedBatch(d: { id: string; period: string; periodLabel: string; status: string; createdAt: string; createdBy: string; submittedAt?: string | null; receiptAt?: string | null; receiptNo?: string | null; remark?: string | null; rejectReason?: string | null }): Batch {
  const inds = indicatorsPayload(d.period).indicators
  return {
    id: d.id, period: d.period, periodLabel: d.periodLabel, granularity: 'month',
    status: d.status, indicatorCount: inds.length, createdAt: d.createdAt, createdBy: d.createdBy,
    submittedAt: d.submittedAt ?? null, receiptAt: d.receiptAt ?? null, receiptNo: d.receiptNo ?? null,
    indicators: inds, fileName: `rqi-report-center-${d.period}.csv`, contentHash: `seed-${d.period}`,
    remark: d.remark ?? null, rejectReason: d.rejectReason ?? null,
    dateFrom: `${d.period}-01`, dateTo: `${d.period}-28`, source: 'seed',
  }
}
const batches: Batch[] = [
  seedBatch({ id: 'RPT-2026-08', period: '2026-08', periodLabel: '2026年8月', status: 'ACCEPTED', createdAt: '2026-09-01T09:00:00Z', createdBy: '管理员', submittedAt: '2026-09-01T10:00:00Z', receiptNo: 'NHC-202608-0918', receiptAt: '2026-09-03T14:00:00Z', remark: '数据已受理' }),
  seedBatch({ id: 'RPT-2026-07', period: '2026-07', periodLabel: '2026年7月', status: 'REJECTED', createdAt: '2026-08-01T09:00:00Z', createdBy: '管理员', submittedAt: '2026-08-02T09:00:00Z', remark: '分母口径需复核', rejectReason: '分母口径需复核' }),
  seedBatch({ id: 'RPT-2026-09', period: '2026-09', periodLabel: '2026年9月', status: 'DRAFT', createdAt: '2026-09-14T09:00:00Z', createdBy: '管理员' }),
]
let batchSeq = 0

const TRANS: Record<string, string[]> = { DRAFT: ['SUBMITTED'], SUBMITTED: ['ACCEPTED', 'REJECTED'], REJECTED: ['DRAFT'], ACCEPTED: [] }

export const rqi105Handlers = [
  // ── rqi-2024 ─────────────────────────────────────────────
  http.get(`${API}/rqi-2024/indicators`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    return HttpResponse.json(indicatorsPayload(url.searchParams.get('period') ?? undefined))
  }),
  http.get(`${API}/rqi-2024/dashboard`, async () => {
    await delay(140)
    const payload = indicatorsPayload()
    const inds = payload.indicators
    const passCount = inds.filter((i) => i.status === 'pass').length
    const warnCount = inds.filter((i) => i.status === 'warn').length
    const failCount = inds.filter((i) => i.status === 'fail').length
    return HttpResponse.json({
      source: 'seed',
      generatedAt: new Date().toISOString(),
      period: payload.period,
      granularity: 'month',
      standard: payload.standard,
      total: inds.length,
      passCount,
      warnCount,
      failCount,
      passRate: Math.round((passCount / inds.length) * 100 * 100) / 100,
      indicators: inds,
      mom: inds.map((i, idx) => {
        const prev = Math.round((i.rate * (1 + (idx % 2 === 0 ? 0.03 : -0.02))) * 100) / 100
        const delta = Math.round((i.rate - prev) * 100) / 100
        return { code: i.code, name: i.name, current: i.rate, previous: prev, delta, trend: delta > 0.01 ? 'up' : delta < -0.01 ? 'down' : 'flat', unit: i.unit }
      }),
    })
  }),
  http.get(`${API}/rqi-2024/detail/:code`, async ({ params }) => {
    await delay(140)
    const code = String(params.code)
    const d = DEFS.find((x) => x.code === code) ?? DEFS[0]!
    const items = Array.from({ length: Math.min(20, d.den) }, (_, i) => ({
      id: `${code}-${String(i + 1).padStart(3, '0')}`,
      kind: code === 'RQI-ICME-05' ? 'contrast' : code === 'RQI-RCV-04' ? 'critical' : code === 'RQI-RWS-03' ? 'report' : 'exam',
      label: `${code === 'RQI-RRC-02' ? '急诊检查' : '检查'} ${String(i + 1).padStart(3, '0')}`,
      inNumerator: i < d.num,
      inDenominator: true,
      dimension: 'CT',
      detail: { 患者: `患者${i + 1}`, 检查号: `ACC-${1000 + i}`, 结论: i < d.num ? '计入分子' : '未计入分子' },
    }))
    return HttpResponse.json({
      source: 'seed',
      indicator: buildIndicator(d, currentPeriod()),
      numeratorIds: items.filter((x) => x.inNumerator).map((x) => x.id),
      denominatorIds: items.map((x) => x.id),
      items,
    })
  }),
  http.get(`${API}/rqi-2024/trend`, async ({ request }) => {
    await delay(140)
    const url = new URL(request.url)
    const code = url.searchParams.get('code') ?? 'RQI-IIA-01'
    const months = Number(url.searchParams.get('months') ?? 12)
    const d = DEFS.find((x) => x.code === code) ?? DEFS[0]!
    const points = []
    const base = new Date()
    for (let i = months - 1; i >= 0; i--) {
      const dt = new Date(base.getFullYear(), base.getMonth() - i, 1)
      const month = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`
      const factor = 1 + ((i % 3) - 1) * 0.04
      const num = Math.max(1, Math.round(d.num * factor))
      const den = d.den
      const rate = d.unit === '‰' ? Math.round((num / den) * 1000 * 100) / 100 : Math.round((num / den) * 100 * 100) / 100
      const st: RqiStatus = d.direction === 'higher' ? (rate >= d.target ? 'pass' : rate >= d.target - d.warnMargin ? 'warn' : 'fail') : rate <= d.target ? 'pass' : rate <= d.target + d.warnMargin ? 'warn' : 'fail'
      points.push({ month, numerator: num, denominator: den, rate, unit: d.unit, target: d.target, status: st })
    }
    return HttpResponse.json({ source: 'seed', code: d.code, name: d.name, months, points })
  }),
  http.get(`${API}/rqi-2024/config`, async () => {
    await delay(80)
    return HttpResponse.json({
      source: 'default',
      updatedAt: null,
      standard: '国卫办医政函〔2024〕150号 附件4',
      items: DEFS.map((d) => ({ code: d.code, name: d.name, target: d.target, warnMargin: d.warnMargin, direction: d.direction, unit: d.unit })),
    })
  }),
  http.put(`${API}/rqi-2024/config`, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as { items?: Array<{ code: string; target: number; warnMargin?: number; direction?: 'higher' | 'lower' }> }
    for (const it of body?.items ?? []) {
      const d = DEFS.find((x) => x.code === it.code)
      if (d) {
        d.target = it.target
        if (it.warnMargin !== undefined) d.warnMargin = it.warnMargin
        if (it.direction) d.direction = it.direction
      }
    }
    return HttpResponse.json({
      source: 'override',
      updatedAt: new Date().toISOString(),
      standard: '国卫办医政函〔2024〕150号 附件4',
      items: DEFS.map((d) => ({ code: d.code, name: d.name, target: d.target, warnMargin: d.warnMargin, direction: d.direction, unit: d.unit })),
    })
  }),
  http.post(`${API}/rqi-2024/export`, async ({ request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as { format?: 'csv' | 'json' }
    const format = body?.format === 'json' ? 'json' : 'csv'
    const payload = indicatorsPayload()
    if (format === 'json') {
      return HttpResponse.json({ format, filename: `RQI-2024-${payload.period}.json`, content: JSON.stringify(payload, null, 2) })
    }
    const header = '指标编码,指标名称,分子,分母,比率,单位,目标,达标'
    const rows = payload.indicators.map((i) => `${i.code},${i.name},${i.numerator},${i.denominator},${i.rate},${i.unit},${i.target},${i.status}`)
    return HttpResponse.json({ format, filename: `RQI-2024-${payload.period}.csv`, content: '\uFEFF' + [header, ...rows].join('\n') })
  }),

  // ── quality-indicators (40 条扩展) ───────────────────────
  http.get(`${API}/quality-indicators/extended`, async ({ request }) => {
    await delay(100)
    const url = new URL(request.url)
    const category = url.searchParams.get('category')
    const keyword = (url.searchParams.get('keyword') ?? '').toLowerCase()
    const all = Array.from({ length: 40 }, (_, i) => {
      const cat = i < 10 ? 'structure' : i < 28 ? 'process' : 'outcome'
      return {
        code: `QI-${cat === 'structure' ? 'S' : cat === 'process' ? 'P' : 'R'}${String((i % 18) + 1).padStart(2, '0')}`,
        name: `${cat === 'structure' ? '结构' : cat === 'process' ? '过程' : '结果'}质控指标 ${i + 1}`,
        category: cat,
        formula: '分子/分母×100%',
        target: 95,
        targetOperator: '>=',
        frequency: 'monthly',
        owner: '质控办',
        alertThreshold: 90,
      }
    })
    let list = all
    if (category) list = list.filter((x) => x.category === category)
    if (keyword) list = list.filter((x) => x.code.toLowerCase().includes(keyword) || x.name.toLowerCase().includes(keyword))
    return HttpResponse.json({ total: list.length, items: list, byCategory: { structure: 10, process: 18, outcome: 12 } })
  }),
  http.get(`${API}/quality-indicators/extended/:code`, async ({ params }) => {
    await delay(60)
    const code = String(params.code)
    return HttpResponse.json({ code, name: `质控指标 ${code}`, category: 'process', formula: '分子/分母×100%', target: 95, targetOperator: '>=', frequency: 'monthly', owner: '质控办', alertThreshold: 90 })
  }),
  http.get(`${API}/quality-indicators/evaluate`, async ({ request }) => {
    await delay(60)
    const url = new URL(request.url)
    const value = Number(url.searchParams.get('value') ?? 0)
    const target = 95
    return HttpResponse.json({ code: url.searchParams.get('code') ?? '', value, target, operator: '>=', pass: value >= target })
  }),
  http.get(`${API}/quality-indicators/standards`, async () => {
    await delay(80)
    return HttpResponse.json({
      imageQuality: { dimensions: ['解剖覆盖', '对比度', '噪声', '伪影', '体位'] },
      reportQuality: Array.from({ length: 14 }, (_, i) => ({ code: `RQ-${String(i + 1).padStart(2, '0')}`, name: `报告质量标准 ${i + 1}` })),
      processPoints: ['登记', '执行', '影像', '报告', '归档'].map((s) => ({ stage: s, checks: [`${s}核对`] })),
    })
  }),

  // ── report-rules RWS (国标书写规范) ──────────────────────
  http.get(`${API}/report-rules/national-rws`, async () => {
    await delay(100)
    return HttpResponse.json({
      target: 98,
      rateFormula: '书写规范报告份数 / 同期报告总份数 × 100%',
      rules: [
        { code: 'RWS-SIGN-MISSING', name: '报告无放射科医生签名', severity: 'error', suggestion: '补充放射科医生签名' },
        { code: 'RWS-CONCLUSION-MISMATCH', name: '结论与影像描述不符', severity: 'error', suggestion: '核对结论与描述一致性' },
        { code: 'RWS-ORGAN-ABSENT', name: '所查脏器缺如却报告正常', severity: 'error', suggestion: '结合病史修正描述' },
        { code: 'RWS-POSITION-ERROR', name: '检查部位/方位错误', severity: 'error', suggestion: '更正部位与方位' },
        { code: 'RWS-UNIT-DATA-ERROR', name: '单位/数据错误', severity: 'error', suggestion: '核对数值与单位' },
        { code: 'RWS-TEMPLATE-RESIDUE', name: '残留模板文字', severity: 'error', suggestion: '删除模板占位内容' },
        { code: 'RWS-PATIENT-MISMATCH', name: '患者信息不符或缺失', severity: 'error', suggestion: '核对患者信息' },
      ],
    })
  }),
  http.post(`${API}/report-rules/evaluate-rws`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as { text?: string; signedBy?: string }
    const text = body?.text ?? ''
    const failures: Array<{ code: string; name: string; severity: string; suggestion: string }> = []
    if (!body?.signedBy) failures.push({ code: 'RWS-SIGN-MISSING', name: '报告无放射科医生签名', severity: 'error', suggestion: '补充放射科医生签名' })
    if (/\{\{|待补充|TODO|xx/.test(text)) failures.push({ code: 'RWS-TEMPLATE-RESIDUE', name: '残留模板文字', severity: 'error', suggestion: '删除模板占位内容' })
    return HttpResponse.json({ compliant: failures.length === 0, failures, numerator: failures.length === 0 ? 1 : 0, denominator: 1, rate: failures.length === 0 ? 100 : 0, rateExplanation: '书写规范报告份数/总份数×100%' })
  }),
  http.post(`${API}/report-rules/rws-rate`, async ({ request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as { reports?: Array<{ id: string; text?: string; signedBy?: string }> }
    const reports = body?.reports ?? [{ id: 'R1', signedBy: '张三' }, { id: 'R2' }]
    const results = reports.map((r) => {
      const failures: string[] = []
      if (!r.signedBy) failures.push('RWS-SIGN-MISSING')
      if (/\{\{|待补充|TODO/.test(r.text ?? '')) failures.push('RWS-TEMPLATE-RESIDUE')
      return { id: r.id, compliant: failures.length === 0, failures }
    })
    const numerator = results.filter((r) => r.compliant).length
    return HttpResponse.json({ numerator, denominator: results.length, totalReports: results.length, rate: Math.round((numerator / results.length) * 100 * 100) / 100, rateExplanation: '书写规范报告份数/总报告份数×100%', results })
  }),

  // ── contrast 外渗 + 注射前核查 + 过敏 + 留观 ─────────────
  http.get(`${API}/contrast/extravasation`, async () => {
    await delay(100)
    return HttpResponse.json({ items: [
      { id: 'EX-001', patientId: 'P001', severity: 'mild', site: '右前臂', estimatedVolumeMl: 5, status: 'resolved', occurredAt: '2026-09-02T10:20:00Z' },
      { id: 'EX-002', patientId: 'P002', severity: 'moderate', site: '左手背', estimatedVolumeMl: 15, status: 'resolved', occurredAt: '2026-09-08T15:40:00Z' },
    ], total: 2 })
  }),
  http.post(`${API}/contrast/extravasation`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    return HttpResponse.json({ id: `EX-${Date.now()}`, status: 'open', ...body })
  }),
  http.get(`${API}/contrast/extravasation/stats`, async () => {
    await delay(100)
    return HttpResponse.json({ total: 3, bySeverity: { mild: 2, moderate: 1, severe: 0 }, bySite: { 右前臂: 1, 左手背: 1, 左肘部: 1 }, byMonth: [{ month: '2026-08', count: 1 }, { month: '2026-09', count: 2 }], injectionTotal: 480, ratePerThousand: 6.25 })
  }),
  http.post(`${API}/contrast/extravasation/:id/handle`, async ({ params }) => {
    await delay(100)
    return HttpResponse.json({ id: String(params.id), status: 'resolved' })
  }),
  http.post(`${API}/contrast/pre-injection-check`, async ({ request }) => {
    await delay(120)
    const body = (await request.json().catch(() => ({}))) as { consentSigned?: boolean; allergyResult?: string; egfr?: number; pregnant?: boolean }
    const blockers: string[] = []
    if (body?.consentSigned !== true) blockers.push('NO_CONSENT')
    if (body?.allergyResult === 'positive') blockers.push('ALLERGY_POSITIVE')
    if (typeof body?.egfr === 'number' && body.egfr < 30) blockers.push('EGFR_BELOW_THRESHOLD')
    if (body?.pregnant === true) blockers.push('PREGNANCY')
    return HttpResponse.json({ passed: blockers.length === 0, blockers, threshold: 30 })
  }),
  http.get(`${API}/contrast/allergy-test/:patientId`, async ({ params }) => {
    await delay(80)
    return HttpResponse.json({ items: [{ id: 'AT-001', patientId: String(params.patientId), result: 'negative', contrastAgent: '碘海醇', testedAt: '2026-08-20T09:00:00Z', testedBy: '李技师' }], total: 1, source: 'seed' })
  }),

  // ── criticals 国标 13 类 + 10min ─────────────────────────
  http.get(`${API}/criticals/national-diagnoses`, async () => {
    await delay(80)
    // 字段对齐 backend NationalDiagnosisResponse + src/services/api/criticalApi.ts NationalDiagnosesResult
    const defs: Array<[string, string]> = [
      ['急性肺栓塞', '胸部'],
      ['急性主动脉夹层 (DeBakey I·II 型)/急性主动脉瘤破裂', '心血管'],
      ['心包填塞', '心血管'],
      ['大量液·血·气胸', '胸部'],
      ['气管·支气管异物', '呼吸'],
      ['急性脑梗死', '神经'],
      ['急性脑出血', '神经'],
      ['急性硬膜外·硬膜下出血', '神经'],
      ['急性蛛网膜下腔出血', '神经'],
      ['脑疝', '神经'],
      ['消化道穿孔', '腹部'],
      ['腹腔内脏器破裂出血', '腹部'],
      ['绞窄性肠梗阻', '腹部'],
    ]
    const items = defs.map(([name, category], i) => ({ code: `GW-${String(i + 1).padStart(2, '0')}`, name, category, isNational: true }))
    return HttpResponse.json({
      items,
      total: items.length,
      nationalCount: items.length,
      standard: '国卫办医政函〔2024〕150号 附件4',
      generatedAt: new Date().toISOString(),
    })
  }),
  http.get(`${API}/criticals/rqi-stats`, async ({ request }) => {
    await delay(120)
    // 字段对齐 backend CriticalRqiStats + src/services/api/criticalApi.ts CriticalRqiStatsDto
    const url = new URL(request.url)
    const months = Math.max(1, Number(url.searchParams.get('months') ?? 1))
    const details = Array.from({ length: 30 }, (_, i) => ({
      criticalId: `CV-${String(i + 1).padStart(3, '0')}`,
      patientId: `P${String(i + 1).padStart(4, '0')}`,
      patientName: `患者${i + 1}`,
      diagnosisCode: 'GW-07',
      diagnosisName: '急性脑出血',
      foundAt: '2026-09-10T08:00:00Z',
      notifiedAt: '2026-09-10T08:06:00Z',
      notifiedBy: '张医师',
      receivedBy: '急诊科 王医生',
      receiveNote: '已接收并处理',
      notifyMinutes: 6,
      within10Min: true,
      signatureComplete: true,
    }))
    const within10MinCount = details.filter((x) => x.within10Min).length
    return HttpResponse.json({
      months,
      windowStart: '2026-09-01T00:00:00.000Z',
      standard: '国卫办医政函〔2024〕150号 附件4',
      deadlineMin: 10,
      source: 'seed',
      nationalTotal: details.length,
      within10MinCount,
      overdueCount: details.length - within10MinCount,
      completionRate: Math.round((within10MinCount / details.length) * 100 * 100) / 100,
      details,
      signatureIntegrity: {
        total: details.length,
        notifiedAtCount: details.length,
        notifiedByCount: details.length,
        receivedByCount: details.length,
        receiveNoteCount: details.length,
        completeCount: details.length,
        completenessRate: 100,
      },
    })
  }),

  // ── clinical-feedback ────────────────────────────────────
  http.get(`${API}/clinical-feedback`, async () => {
    await delay(100)
    return HttpResponse.json({ items: [
      { id: 'CF-001', reportId: 'RPT-0001', patientId: 'P001', type: 'objection', content: '结论与临床不符，请复核', submittedBy: '王医生', department: '急诊科', status: 'SUBMITTED', createdAt: '2026-09-11T09:00:00Z', updatedAt: '2026-09-11T09:00:00Z' },
      { id: 'CF-002', reportId: 'RPT-0002', patientId: 'P002', type: 'supplement', content: '补充既往手术史', submittedBy: '李医生', department: '外科', status: 'RESPONDED', createdAt: '2026-09-12T10:00:00Z', updatedAt: '2026-09-12T10:00:00Z', response: { content: '已补充', responder: '张医师', department: '放射科', respondedAt: '2026-09-12T10:30:00Z' } },
    ], total: 2 })
  }),
  http.get(`${API}/clinical-feedback/meta`, async () => {
    await delay(60)
    return HttpResponse.json({ types: [{ key: 'objection', label: '异议' }, { key: 'supplement', label: '补充' }, { key: 'correction', label: '更正' }], statuses: [{ key: 'SUBMITTED', label: '已提交' }, { key: 'RESPONDED', label: '已回应' }, { key: 'RESOLVED', label: '已关闭' }, { key: 'REJECTED', label: '已驳回' }], transitions: { SUBMITTED: ['RESPONDED', 'REJECTED'], RESPONDED: ['RESOLVED', 'REJECTED'], RESOLVED: [], REJECTED: [] } })
  }),

  // ── rqi-report-center (国家上报中心) ──────────────────────
  http.get(`${API}/rqi-report-center/batches`, async ({ request }) => {
    await delay(120)
    const url = new URL(request.url)
    const status = url.searchParams.get('status')
    const list = status ? batches.filter((b) => b.status === status) : batches
    return HttpResponse.json({ items: list, total: list.length, page: 1, pageSize: 20, source: 'memory' })
  }),
  http.post(`${API}/rqi-report-center/batches`, async ({ request }) => {
    await delay(160)
    const body = (await request.json().catch(() => ({}))) as { period?: string; createdBy?: string }
    const period = body?.period ?? currentPeriod()
    const inds = indicatorsPayload(period).indicators
    const b: Batch = {
      id: `RPT-${period}`,
      period,
      periodLabel: period,
      granularity: 'month',
      status: 'DRAFT',
      indicatorCount: inds.length,
      createdAt: new Date().toISOString(),
      createdBy: body?.createdBy ?? '管理员',
      submittedAt: null,
      receiptAt: null,
      receiptNo: null,
      indicators: inds,
      fileName: `rqi-report-center-${period}.csv`,
      contentHash: `seed-${period}`,
      remark: null,
      rejectReason: null,
      dateFrom: `${period}-01`,
      dateTo: `${period}-28`,
      source: 'memory',
    }
    batches.unshift(b)
    batchSeq++
    return HttpResponse.json(b)
  }),
  http.get(`${API}/rqi-report-center/batches/:id`, async ({ params }) => {
    await delay(100)
    const b = batches.find((x) => x.id === String(params.id))
    if (!b) return HttpResponse.json({ message: 'batch not found' }, { status: 404 })
    return HttpResponse.json({ ...b, indicators: indicatorsPayload(b.period).indicators })
  }),
  http.post(`${API}/rqi-report-center/batches/:id/submit`, async ({ params }) => {
    await delay(140)
    const b = batches.find((x) => x.id === String(params.id))
    if (!b) return HttpResponse.json({ message: 'batch not found' }, { status: 404 })
    if (!(TRANS[b.status] ?? []).includes('SUBMITTED')) return HttpResponse.json({ message: `INVALID_TRANSITION: ${b.status} → SUBMITTED` }, { status: 400 })
    b.status = 'SUBMITTED'
    b.submittedAt = new Date().toISOString()
    b.receiptAt = null
    b.receiptNo = null
    return HttpResponse.json(b)
  }),
  http.post(`${API}/rqi-report-center/batches/:id/accept`, async ({ params, request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as { receiptNo?: string; remark?: string }
    const b = batches.find((x) => x.id === String(params.id))
    if (!b) return HttpResponse.json({ message: 'batch not found' }, { status: 404 })
    if (!(TRANS[b.status] ?? []).includes('ACCEPTED')) return HttpResponse.json({ message: `INVALID_TRANSITION: ${b.status} → ACCEPTED` }, { status: 400 })
    b.status = 'ACCEPTED'
    b.receiptNo = body?.receiptNo ?? `NHC-${Date.now()}`
    b.receiptAt = new Date().toISOString()
    if (body?.remark) b.remark = body.remark
    b.rejectReason = null
    return HttpResponse.json(b)
  }),
  http.post(`${API}/rqi-report-center/batches/:id/reject`, async ({ params, request }) => {
    await delay(140)
    const body = (await request.json().catch(() => ({}))) as { reason?: string }
    const b = batches.find((x) => x.id === String(params.id))
    if (!b) return HttpResponse.json({ message: 'batch not found' }, { status: 404 })
    if (!(TRANS[b.status] ?? []).includes('REJECTED')) return HttpResponse.json({ message: `INVALID_TRANSITION: ${b.status} → REJECTED` }, { status: 400 })
    b.status = 'REJECTED'
    b.rejectReason = body?.reason ?? '驳回'
    b.remark = body?.reason ?? b.remark ?? '驳回'
    return HttpResponse.json(b)
  }),
  http.post(`${API}/rqi-report-center/batches/:id/reopen`, async ({ params }) => {
    await delay(120)
    const b = batches.find((x) => x.id === String(params.id))
    if (!b) return HttpResponse.json({ message: 'batch not found' }, { status: 404 })
    if (!(TRANS[b.status] ?? []).includes('DRAFT')) return HttpResponse.json({ message: `INVALID_TRANSITION: ${b.status} → DRAFT` }, { status: 400 })
    b.status = 'DRAFT'
    b.submittedAt = null
    b.receiptAt = null
    b.receiptNo = null
    b.rejectReason = null
    return HttpResponse.json(b)
  }),
  http.get(`${API}/rqi-report-center/batches/:id/export`, async ({ params, request }) => {
    await delay(140)
    const url = new URL(request.url)
    const format = url.searchParams.get('format') === 'json' ? 'json' : 'csv'
    const b = batches.find((x) => x.id === String(params.id))
    const period = b?.period ?? currentPeriod()
    const payload = indicatorsPayload(period)
    const contentHash = b?.contentHash ?? `seed-${period}`
    if (format === 'json') {
      return HttpResponse.json({ format, filename: `RPT-${period}.json`, contentHash, content: JSON.stringify(payload, null, 2) })
    }
    const header = '指标编码,指标名称,分子,分母,比率,单位,目标,达标'
    const rows = payload.indicators.map((i) => `${i.code},${i.name},${i.numerator},${i.denominator},${i.rate},${i.unit},${i.target},${i.status}`)
    return HttpResponse.json({ format, filename: `RPT-${period}.csv`, contentHash, content: '\uFEFF' + [header, ...rows].join('\n') })
  }),
  http.get(`${API}/rqi-report-center/history`, async () => {
    await delay(120)
    return HttpResponse.json({
      items: batches.map((b) => ({ id: b.id, period: b.period, periodLabel: b.periodLabel, granularity: b.granularity, status: b.status, createdAt: b.createdAt, createdBy: b.createdBy, submittedAt: b.submittedAt, receiptAt: b.receiptAt, receiptNo: b.receiptNo, remark: b.remark, rejectReason: b.rejectReason })),
      total: batches.length, page: 1, pageSize: 20, source: 'memory',
    })
  }),
  http.get(`${API}/rqi-report-center/stats`, async () => {
    await delay(100)
    const byStatus: Record<string, number> = { DRAFT: 0, SUBMITTED: 0, ACCEPTED: 0, REJECTED: 0 }
    for (const b of batches) byStatus[b.status] = (byStatus[b.status] ?? 0) + 1
    const submitted = batches.filter((b) => b.submittedAt).sort((a, b) => String(b.submittedAt).localeCompare(String(a.submittedAt)))
    const latest = submitted[0]
    return HttpResponse.json({
      total: batches.length,
      draftCount: byStatus.DRAFT,
      submittedCount: byStatus.SUBMITTED,
      acceptedCount: byStatus.ACCEPTED,
      rejectedCount: byStatus.REJECTED,
      byStatus,
      reportableCount: submitted.length,
      onTimeCount: submitted.length,
      onTimeRate: submitted.length > 0 ? 66.7 : 0,
      latest: latest
        ? { id: latest.id, period: latest.period, periodLabel: latest.periodLabel, granularity: latest.granularity, status: latest.status, createdAt: latest.createdAt, createdBy: latest.createdBy, submittedAt: latest.submittedAt, receiptAt: latest.receiptAt, receiptNo: latest.receiptNo, remark: latest.remark, rejectReason: latest.rejectReason }
        : null,
      source: 'memory',
    })
  }),

  // ── devices/schedule (甘特) ──────────────────────────────
  http.get(`${API}/devices/schedule`, async () => {
    await delay(120)
    // 字段对齐 backend DeviceWeekView + src/services/api/deviceScheduleApi.ts DeviceWeekViewDto
    const meta: Record<string, { code: string; name: string; modality: string }> = {
      'dev-ct-01': { code: 'CT-01', name: 'CT-1 号机房', modality: 'CT' },
      'dev-mr-01': { code: 'MR-01', name: 'MR-1 号机房', modality: 'MR' },
      'dev-dr-01': { code: 'DR-01', name: 'DR-1 号机房', modality: 'DR' },
    }
    const devices = ['dev-ct-01', 'dev-mr-01', 'dev-dr-01'].map((id, di) => {
      const m = meta[id]!
      const blocks = Array.from({ length: 4 }, (_, k) => {
        const type = k % 3 === 0 ? 'EXAM' : k % 3 === 1 ? 'MAINTENANCE' : 'IDLE'
        const day = `2026-09-${String(14 + Math.floor(k / 2)).padStart(2, '0')}`
        const start = `${day}T${String(9 + (k % 3) * 2).padStart(2, '0')}:00:00`
        const end = `${day}T${String(10 + (k % 3) * 2).padStart(2, '0')}:00:00`
        return {
          id: `BLK-${di}-${k}`,
          deviceId: id,
          deviceName: m.name,
          type,
          title: type === 'EXAM' ? `患者${k + 1} · 常规` : type === 'MAINTENANCE' ? '预防性维护' : '空闲',
          start,
          end,
          ...(type === 'EXAM' ? { examNo: `ACC-${1000 + di * 10 + k}`, patientName: `患者${k + 1}`, priority: 'ROUTINE' } : {}),
        }
      })
      return { deviceId: id, code: m.code, name: m.name, modality: m.modality, blocks, conflicts: [], utilization: 62 + di * 8 }
    })
    const days = Array.from({ length: 7 }, (_, i) => ({ date: `2026-09-${String(14 + i).padStart(2, '0')}`, label: `周${'日一二三四五六'[i % 7]}` }))
    return HttpResponse.json({ weekStart: '2026-09-14', days, devices })
  }),
  http.get(`${API}/devices/schedule/stats`, async () => {
    await delay(100)
    return HttpResponse.json({
      weekStart: '2026-09-14',
      totalBlocks: 12,
      examBlocks: 4,
      maintenanceBlocks: 4,
      conflicts: 0,
      idleHours: 12,
      utilizationByDevice: [
        { deviceId: 'dev-ct-01', name: 'CT-1 号机房', utilization: 62, examCount: 2, maintenanceMinutes: 0 },
        { deviceId: 'dev-mr-01', name: 'MR-1 号机房', utilization: 70, examCount: 1, maintenanceMinutes: 60 },
        { deviceId: 'dev-dr-01', name: 'DR-1 号机房', utilization: 78, examCount: 1, maintenanceMinutes: 0 },
      ],
    })
  }),
  http.get(`${API}/devices/schedule/conflicts`, async () => {
    await delay(80)
    // [demo seed] 确定性排程冲突 (与 /devices/schedule 的 BLK-* 区块对应), 使冲突表非空
    return HttpResponse.json([
      {
        blockId: 'BLK-0-0',
        deviceId: 'dev-ct-01',
        deviceName: 'CT-1 号机房',
        title: '患者1 · 常规',
        start: '2026-09-14T09:00:00',
        end: '2026-09-14T10:00:00',
        overlapWith: ['BLK-0-1', 'BLK-1-0'],
        suggestion: { start: '2026-09-14T13:00:00', end: '2026-09-14T14:00:00', reason: '移至同日 13:00 空闲时段, 避开预防性维护窗口' },
      },
      {
        blockId: 'BLK-1-2',
        deviceId: 'dev-mr-01',
        deviceName: 'MR-1 号机房',
        title: '患者3 · 常规',
        start: '2026-09-15T09:00:00',
        end: '2026-09-15T10:00:00',
        overlapWith: ['BLK-2-0'],
        suggestion: { start: '2026-09-15T15:00:00', end: '2026-09-15T16:00:00', reason: '顺延至当日下午, 与 DR 机房排程不再重叠' },
      },
      {
        blockId: 'BLK-2-3',
        deviceId: 'dev-dr-01',
        deviceName: 'DR-1 号机房',
        title: '患者4 · 常规',
        start: '2026-09-15T11:00:00',
        end: '2026-09-15T12:00:00',
        overlapWith: ['BLK-0-3'],
        suggestion: { start: '2026-09-16T09:00:00', end: '2026-09-16T10:00:00', reason: '改约至次日 09:00, 技师与机房均空闲' },
      },
    ])
  }),
]
