// [G005 Wave 8A v3.0.6.11-101] /api/v1/report-compare-v2 MSW handlers
// 对齐后端 report-compare-v2.module + reportCompareV2Api (逐段 diff + 关键字段 + 相似度, 确定性)
// 响应形状: { success: true, data: <T> }
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/report-compare-v2`

type CompareType = 'patient-history' | 'dual-read' | 'doctor-ai'
type DiffType = 'same' | 'modified' | 'added' | 'removed'

interface ReportSummary {
  id: string
  patientName: string
  examDate: string
  modality: string
  bodyPart: string
  doctorName: string
  source: 'doctor' | 'ai' | 'prior'
  organization: string
  isAiGenerated: boolean
}

interface ComparePreset {
  id: string
  type: CompareType
  label: string
  description: string
  reportAId: string
  reportBId: string
}

const REPORTS: ReportSummary[] = [
  { id: 'RPT-1001', patientName: '张建国', examDate: '2026-07-20', modality: 'CT', bodyPart: '胸部', doctorName: '王医生', source: 'doctor', organization: '东华医院', isAiGenerated: false },
  { id: 'RPT-1002', patientName: '张建国', examDate: '2026-03-15', modality: 'CT', bodyPart: '胸部', doctorName: '王医生', source: 'prior', organization: '东华医院', isAiGenerated: false },
  { id: 'RPT-1003', patientName: '李秀英', examDate: '2026-07-28', modality: 'MR', bodyPart: '头颅', doctorName: '李医生', source: 'doctor', organization: '仁济影像中心', isAiGenerated: false },
  { id: 'RPT-1004', patientName: '李秀英', examDate: '2026-07-28', modality: 'MR', bodyPart: '头颅', doctorName: 'AI 助理', source: 'ai', organization: '仁济影像中心', isAiGenerated: true },
  { id: 'RPT-1005', patientName: '王德发', examDate: '2026-08-02', modality: 'CT', bodyPart: '腹部', doctorName: '刘医生', source: 'doctor', organization: '东华医院', isAiGenerated: false },
  { id: 'RPT-1006', patientName: '王德发', examDate: '2026-08-02', modality: 'CT', bodyPart: '腹部', doctorName: '陈医生', source: 'doctor', organization: '东华医院', isAiGenerated: false },
]

const PRESETS: ComparePreset[] = [
  { id: 'cp-001', type: 'patient-history', label: '同患者不同时点', description: '张建国 2026-03 vs 2026-07 胸部 CT', reportAId: 'RPT-1002', reportBId: 'RPT-1001' },
  { id: 'cp-002', type: 'doctor-ai', label: '医生与 AI 报告', description: '李秀英 头颅 MRI 医生报告 vs AI 草稿', reportAId: 'RPT-1003', reportBId: 'RPT-1004' },
  { id: 'cp-003', type: 'dual-read', label: '双阅双报告', description: '王德发 腹部 CT 双医生报告', reportAId: 'RPT-1005', reportBId: 'RPT-1006' },
]

function textOf(reportId: string): string {
  switch (reportId) {
    case 'RPT-1001':
      return '【影像所见】双肺纹理清晰，右肺上叶见 8mm 磨玻璃结节，边界清晰。纵隔未见肿大淋巴结。\n【诊断结论】右肺上叶磨玻璃结节，建议 6 个月随访复查。'
    case 'RPT-1002':
      return '【影像所见】双肺纹理清晰，右肺上叶见 6mm 磨玻璃结节。纵隔未见肿大淋巴结。\n【诊断结论】右肺上叶磨玻璃结节，建议随访复查。'
    case 'RPT-1003':
      return '【影像所见】脑实质信号未见明显异常，右侧基底节区见点状缺血灶。脑室系统形态大小正常。\n【诊断结论】右侧基底节区腔隙性缺血灶。'
    case 'RPT-1004':
      return '【影像所见】脑实质信号未见明显异常，右侧基底节区见点状缺血灶。脑室系统形态大小正常。\n【诊断结论】右侧基底节区腔隙性缺血灶，建议结合临床。'
    case 'RPT-1005':
      return '【影像所见】肝脏形态大小正常，肝右叶见类圆形低密度灶约 12mm，增强后未见强化。胆囊未见异常。\n【诊断结论】肝右叶囊肿可能性大。'
    case 'RPT-1006':
      return '【影像所见】肝脏形态大小正常，肝右叶见类圆形低密度灶约 13mm，增强扫描无强化。胆囊未见异常。\n【诊断结论】肝右叶囊性病变，考虑囊肿。'
    default:
      return '【影像所见】未见异常。\n【诊断结论】未见明显异常。'
  }
}

function diffSections(a: string, b: string): Array<{
  section: string
  label: string
  type: DiffType
  original: string
  updated: string
  originalLineCount: number
  updatedLineCount: number
  ops: Array<{ section: string; sectionLabel: string; type: DiffType; line: string; original?: string; lineNoOld?: number; lineNoNew?: number }>
}> {
  const split = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean)
  const linesA = split(a)
  const linesB = split(b)
  const sections: string[] = ['影像所见', '诊断结论']
  return sections.map((section, si) => {
    const aLines = linesA.filter((l) => !l.startsWith('【') && si === 0 ? true : !l.startsWith('【'))
    const bLines = linesB.filter((l) => !l.startsWith('【') && si === 0 ? true : !l.startsWith('【'))
    const same = aLines.join('') === bLines.join('')
    const type: DiffType = same ? 'same' : si === 0 ? 'modified' : 'modified'
    const ops = same
      ? [{ section, sectionLabel: section, type: 'same' as DiffType, line: aLines[0] ?? '', lineNoOld: 1, lineNoNew: 1 }]
      : [...bLines.slice(0, Math.max(1, bLines.length)).map((line, i) => ({ section, sectionLabel: section, type: 'modified' as DiffType, line, original: aLines[i], lineNoOld: i + 1, lineNoNew: i + 1 }))]
    return {
      section, label: section, type,
      original: aLines.join('\n'), updated: bLines.join('\n'),
      originalLineCount: aLines.length, updatedLineCount: bLines.length,
      ops,
    }
  })
}

function keyFields(a: string, b: string): Array<{ field: string; label: string; original: string; updated: string; equal: boolean; change: DiffType }> {
  const extract = (text: string) => {
    const size = text.match(/(\d+(?:\.\d+)?)mm/)
    const nodule = text.includes('磨玻璃结节')
    const lesion = text.includes('缺血灶') || text.includes('囊肿')
    return { size: size?.[1] ?? '', nodule, lesion }
  }
  const fa = extract(a)
  const fb = extract(b)
  return [
    { field: 'size', label: '病灶大小', original: fa.size ? `${fa.size} mm` : '-', updated: fb.size ? `${fb.size} mm` : '-', equal: fa.size === fb.size, change: fa.size === fb.size ? 'same' : 'modified' as DiffType },
    { field: 'conclusion', label: '结论要点', original: a.includes('结论') ? (a.split('\n').pop() ?? '') : '', updated: b.includes('结论') ? (b.split('\n').pop() ?? '') : '', equal: false, change: 'modified' as DiffType },
  ]
}

function similarityOf(a: string, b: string): number {
  const ca = a.split('')
  const cb = b.split('')
  let common = 0
  for (const ch of ca) {
    const idx = cb.indexOf(ch)
    if (idx >= 0) { common += 1; cb.splice(idx, 1) }
  }
  return Math.round((2 * common / Math.max(1, ca.length + a.length)) * 1000) / 10
}

function compareOf(type: CompareType, reportA: ReportSummary, reportB: ReportSummary, textA: string, textB: string) {
  const sections = diffSections(textA, textB)
  const fields = keyFields(textA, textB)
  const lineDiffs = sections.flatMap((s) => s.ops)
  const totalLines = sections.reduce((s, x) => s + x.originalLineCount + x.updatedLineCount, 0)
  const same = sections.filter((s) => s.type === 'same').reduce((s, x) => s + x.originalLineCount, 0)
  const modified = lineDiffs.filter((l) => l.type === 'modified').length
  const added = lineDiffs.filter((l) => l.type === 'added').length
  const removed = lineDiffs.filter((l) => l.type === 'removed').length
  const changeRate = Math.round((modified / Math.max(1, lineDiffs.length)) * 1000) / 10
  const similarity = similarityOf(textA, textB)
  return {
    id: `cmp-${type}-${Date.now().toString(36)}`,
    type,
    reportA,
    reportB,
    sectionDiffs: sections,
    keyFields: fields,
    lineDiffs,
    statistics: {
      totalLines,
      same,
      modified,
      added,
      removed,
      changeRate,
      similarity,
      keyFieldChanges: fields.filter((f) => !f.equal).length,
      sectionsCompared: sections.length,
    },
    deterministic: true as const,
    generatedAt: new Date().toISOString(),
  }
}

export const reportCompareV2Handlers = [
  http.get(`${API}/reports`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: REPORTS })
  }),

  http.get(`${API}/presets`, async () => {
    await delay(40)
    return HttpResponse.json({ success: true, data: PRESETS })
  }),

  http.post(`${API}/compare`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { reportAId?: string; reportBId?: string; type?: CompareType; textA?: string; textB?: string }
    const type: CompareType = body?.type ?? 'patient-history'
    const reportA = REPORTS.find((r) => r.id === body?.reportAId) ?? REPORTS[0]!
    const reportB = REPORTS.find((r) => r.id === body?.reportBId) ?? REPORTS[1]!
    const textA = body?.textA ?? textOf(reportA.id)
    const textB = body?.textB ?? textOf(reportB.id)
    return HttpResponse.json({ success: true, data: compareOf(type, reportA, reportB, textA, textB) })
  }),

  http.get(`${API}/stats`, async () => {
    await delay(40)
    const byType: Record<CompareType, number> = { 'patient-history': 24, 'dual-read': 18, 'doctor-ai': 42 }
    return HttpResponse.json({
      success: true,
      data: {
        totalReports: REPORTS.length,
        presetCount: PRESETS.length,
        byType,
        avgSimilarity: 86.4,
        organizationCount: 2,
      },
    })
  }),
]
