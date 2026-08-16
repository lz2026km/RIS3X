// [G005 Wave 8A v3.0.6.11-101] /api/v1/report-search-v2 MSW handlers
// 对齐后端 report-search-v2.module + reportSearchV2Api (自然语言解析 + 跨机构检索 + 高亮/聚合, 确定性)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-search-v2`

interface ReportDoc {
  reportId: string
  patientId: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorName: string
  organization: string
  conclusion: string
  isCritical: boolean
}

const DOCS: ReportDoc[] = [
  { reportId: 'RPT-1001', patientId: 'P1001', patientName: '张建国', examDate: '2026-07-20', modality: 'CT', bodyPart: '胸部', doctorName: '王医生', organization: '东华医院', conclusion: '右肺上叶磨玻璃结节，建议 6 个月随访复查。', isCritical: false },
  { reportId: 'RPT-1002', patientId: 'P1001', patientName: '张建国', examDate: '2026-03-15', modality: 'CT', bodyPart: '胸部', doctorName: '王医生', organization: '东华医院', conclusion: '右肺上叶磨玻璃结节，建议随访复查。', isCritical: false },
  { reportId: 'RPT-1003', patientId: 'P1002', patientName: '李秀英', examDate: '2026-07-28', modality: 'MR', bodyPart: '头颅', doctorName: '李医生', organization: '仁济影像中心', conclusion: '右侧基底节区腔隙性缺血灶。', isCritical: false },
  { reportId: 'RPT-1004', patientId: 'P1003', patientName: '王德发', examDate: '2026-08-02', modality: 'CT', bodyPart: '腹部', doctorName: '刘医生', organization: '东华医院', conclusion: '肝右叶囊肿可能性大。', isCritical: false },
  { reportId: 'RPT-1005', patientId: 'P1004', patientName: '赵丽华', examDate: '2026-08-05', modality: 'CT', bodyPart: '头颅', doctorName: '周医生', organization: '东华医院', conclusion: '脑出血（左侧基底节），量约 20ml，病情危急。', isCritical: true },
  { reportId: 'RPT-1006', patientId: 'P1005', patientName: '陈志强', examDate: '2026-08-09', modality: 'CT', bodyPart: '胸部', doctorName: '吴医生', organization: '仁济影像中心', conclusion: '肺动脉主干栓塞，范围广泛，病情危急。', isCritical: true },
  { reportId: 'RPT-1007', patientId: 'P1002', patientName: '李秀英', examDate: '2026-04-02', modality: 'CT', bodyPart: '头颅', doctorName: '李医生', organization: '仁济影像中心', conclusion: '右侧基底节区见点状低密度灶。', isCritical: false },
]

const KEYWORDS = ['磨玻璃结节', '囊肿', '缺血灶', '脑出血', '肺栓塞', '随访', '危急']

function rangesOf(text: string, keyword: string): Array<{ start: number; end: number }> {
  const out: Array<{ start: number; end: number }> = []
  let from = 0
  while (true) {
    const idx = text.indexOf(keyword, from)
    if (idx < 0) break
    out.push({ start: idx, end: idx + keyword.length })
    from = idx + keyword.length
  }
  return out
}

function matches(doc: ReportDoc, c: Record<string, string>): boolean {
  if (c.keyword) {
    const k = c.keyword
    const all = `${doc.patientName} ${doc.conclusion} ${doc.bodyPart}`
    if (!all.includes(k)) return false
  }
  if (c.modality && doc.modality !== c.modality) return false
  if (c.doctor && !doc.doctorName.includes(c.doctor)) return false
  if (c.organization && !doc.organization.includes(c.organization)) return false
  if (c.diagnosisKeyword && !doc.conclusion.includes(c.diagnosisKeyword)) return false
  if (c.dateFrom && doc.examDate < c.dateFrom) return false
  if (c.dateTo && doc.examDate > c.dateTo) return false
  return true
}

function aggregate(items: Array<{ reportId: string; modality: string; doctorName: string; organization: string; conclusion: string }>) {
  const count = (key: keyof Pick<ReportDoc, 'modality' | 'organization' | 'doctorName'>) => {
    const map = new Map<string, number>()
    for (const it of items) map.set(String(it[key]), (map.get(String(it[key])) ?? 0) + 1)
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([k, count2]) => ({ key: k, count: count2 }))
  }
  const diagMap = new Map<string, number>()
  for (const it of items) {
    for (const kw of KEYWORDS) {
      if (it.conclusion.includes(kw)) diagMap.set(kw, (diagMap.get(kw) ?? 0) + 1)
    }
  }
  return {
    total: items.length,
    byModality: count('modality'),
    byOrganization: count('organization'),
    byDoctor: count('doctorName'),
    byDiagnosis: [...diagMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([key, c]) => ({ key, count: c })),
    dateRange: { from: null, to: null },
  }
}

function search(conditions: Record<string, string>) {
  const matched = DOCS.filter((d) => matches(d, conditions))
  const items = matched.map((d) => {
    const keyword = conditions.keyword ?? conditions.diagnosisKeyword ?? ''
    const kws: string[] = []
    for (const kw of KEYWORDS) if (d.conclusion.includes(kw)) kws.push(kw)
    if (keyword && !kws.includes(keyword)) kws.push(keyword)
    const ranges = keyword ? rangesOf(d.conclusion, keyword) : []
    const relevance = Math.round((0.55 + kws.length * 0.12 + (d.isCritical ? 0.08 : 0) + (keyword && d.conclusion.includes(keyword) ? 0.1 : 0)) * 1000) / 1000
    return {
      reportId: d.reportId,
      patientId: d.patientId,
      patientName: d.patientName,
      examDate: d.examDate,
      modality: d.modality,
      bodyPart: d.bodyPart,
      doctorName: d.doctorName,
      organization: d.organization,
      conclusion: d.conclusion,
      isCritical: d.isCritical,
      relevance,
      matchedKeywords: kws,
      snippets: [
        { field: 'conclusion', label: '诊断结论', text: d.conclusion, ranges },
      ],
    }
  }).sort((a, b) => b.relevance - a.relevance)
  return { items, total: items.length, aggregations: aggregate(matched), source: 'seed' }
}

export const reportSearchV2Handlers = [
  http.post(`${API}/search`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as Record<string, string>
    return HttpResponse.json({ success: true, data: search(body ?? {}) })
  }),

  http.post(`${API}/natural-language`, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as { phrase?: string }
    const phrase = String(body?.phrase ?? '')
    const conditions: Record<string, string> = {}
    const parsed: Array<{ key: string; label: string; value: string }> = []
    const mMod = phrase.match(/(CT|MR|MRI|DR|US|MG|钼靶|超声)/)
    if (mMod) {
      const v = mMod[1]!
      const modality = v === 'MRI' ? 'MR' : v === '钼靶' ? 'MG' : v === '超声' ? 'US' : v
      conditions.modality = modality
      parsed.push({ key: 'modality', label: '检查方式', value: modality })
    }
    const mDoctor = phrase.match(/([王李张刘陈杨周吴郑][医生]?)/)
    if (mDoctor) {
      const v = mDoctor[1]!.replace('医生', '')
      conditions.doctor = v + '医生'
      parsed.push({ key: 'doctor', label: '诊断医生', value: v + '医生' })
    }
    const mDate = phrase.match(/(20\d{2})[年\-/.]([01]?\d)[月\-/.]([0-3]?\d)/)
    if (mDate) {
      const v = `${mDate[1]}-${String(Number(mDate[2])).padStart(2, '0')}-${String(Number(mDate[3])).padStart(2, '0')}`
      conditions.dateFrom = v
      parsed.push({ key: 'dateFrom', label: '检查日期(起)', value: v })
    }
    for (const kw of KEYWORDS) {
      if (phrase.includes(kw)) {
        conditions.diagnosisKeyword = kw
        parsed.push({ key: 'diagnosisKeyword', label: '诊断关键词', value: kw })
        break
      }
    }
    if (phrase.includes('危急')) {
      conditions.diagnosisKeyword = '危急'
      parsed.push({ key: 'critical', label: '危急', value: '是' })
    }
    if (Object.keys(conditions).length === 0 && phrase) {
      conditions.keyword = phrase
      parsed.push({ key: 'keyword', label: '关键词', value: phrase })
    }
    const result = search(conditions)
    return HttpResponse.json({ success: true, data: { ...result, phrase, conditions, parsed } })
  }),

  http.get(`${API}/meta`, async () => {
    await delay(40)
    return HttpResponse.json({
      success: true,
      data: {
        modalities: ['CT', 'MR', 'DR', 'US', 'MG'],
        organizations: [
          { name: '东华医院', count: DOCS.filter((d) => d.organization === '东华医院').length },
          { name: '仁济影像中心', count: DOCS.filter((d) => d.organization === '仁济影像中心').length },
        ],
        doctors: [...new Set(DOCS.map((d) => d.doctorName))].map((name) => ({ name, count: DOCS.filter((d) => d.doctorName === name).length })),
        keywords: KEYWORDS,
      },
    })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const byOrganization = new Map<string, number>()
    const byModality = new Map<string, number>()
    for (const d of DOCS) {
      byOrganization.set(d.organization, (byOrganization.get(d.organization) ?? 0) + 1)
      byModality.set(d.modality, (byModality.get(d.modality) ?? 0) + 1)
    }
    const dates = DOCS.map((d) => d.examDate).sort()
    return HttpResponse.json({
      success: true,
      data: {
        totalReports: DOCS.length,
        organizationCount: byOrganization.size,
        byOrganization: [...byOrganization.entries()].map(([key, count]) => ({ key, count })),
        byModality: [...byModality.entries()].map(([key, count]) => ({ key, count })),
        criticalCount: DOCS.filter((d) => d.isCritical).length,
        latestExamDate: dates[dates.length - 1] ?? null,
        earliestExamDate: dates[0] ?? null,
      },
    })
  }),
]
