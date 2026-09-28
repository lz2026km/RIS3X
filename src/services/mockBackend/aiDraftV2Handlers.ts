// [G005 Wave 7A v3.0.6.11-101] /api/v1/ai-draft-v2 MSW handlers
// 对齐后端 ai-draft-v2.module + aiDraftV2Api (extract-fields / generate / suggest / drafts)
// 后端直接返回业务对象 (非 {success,data} 包裹), 客户端自动归一化 → 此处同样返回业务对象
import { http, HttpResponse, delay } from 'msw'
// 动态 API_BASE (与 handlers.ts 一致): vitest 用 localhost:5173, 浏览器用当前 origin
const API_BASE = typeof process !== 'undefined' && process.env.VITEST
  ? 'http://localhost:5173/api/v1'
  : (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin + '/api/v1'
    : 'http://localhost:5173/api/v1')


const API = `${API_BASE}/ai-draft-v2`

type FieldCategory = 'bodyPart' | 'finding' | 'measurement' | 'comparison' | 'conclusion'

interface DraftSegment {
  id: string
  paragraphType: 'technique' | 'findings' | 'conclusion' | 'recommendation' | 'clinicalHistory'
  heading: string
  content: string
  confidence: number
  sources: Array<{ kind: 'template' | 'rule' | 'field' | 'clinicalHistory' | 'seed'; refId: string; description: string; confidence: number }>
}

const MODEL_VERSION = 'ai-draft-v2-1.2.0'

let drafts: Array<{ id: string; reportId?: string; segments: DraftSegment[]; overallConfidence: number; modelVersion: string; generatedAt: string; simulated?: boolean }> = []
let draftSeq = 100

function extractFields(findings: string, _modality?: string, bodyPart?: string) {
  const fields: Array<{ id: string; category: FieldCategory; label: string; value: string; confidence: number; source: 'dictionary' | 'rule'; ruleId: string; evidence: string; start: number; end: number }> = []
  const findIn = (kw: string) => {
    const idx = findings.indexOf(kw)
    return idx >= 0 ? { start: idx, end: idx + kw.length } : null
  }
  const mSize = findings.match(/(\d+(?:\.\d+)?)\s*mm/)
  if (mSize && mSize.index !== undefined) {
    fields.push({ id: 'fld-001', category: 'measurement', label: '病灶尺寸', value: `${mSize[1]} mm`, confidence: 0.95, source: 'rule', ruleId: 'RULE-SIZE-MM', evidence: '尺寸数值+单位', start: mSize.index, end: mSize.index + mSize[0].length })
  }
  for (const kw of ['磨玻璃结节', '实性结节', '占位', '囊肿', '缺血灶', '出血']) {
    const pos = findIn(kw)
    if (pos) {
      fields.push({ id: `fld-${fields.length + 1}`, category: 'finding', label: '主要征象', value: kw, confidence: 0.9, source: 'dictionary', ruleId: 'DICT-FINDING', evidence: '术语库匹配', start: pos.start, end: pos.end })
      break
    }
  }
  if (bodyPart) {
    fields.push({ id: 'fld-bp', category: 'bodyPart', label: '检查部位', value: bodyPart, confidence: 0.98, source: 'dictionary', ruleId: 'DICT-BODYPART', evidence: '检查单字段', start: 0, end: 0 })
  }
  if (findings.includes('对比') || findings.includes('较前')) {
    fields.push({ id: 'fld-cmp', category: 'comparison', label: '对比描述', value: '与前次检查对比', confidence: 0.85, source: 'rule', ruleId: 'RULE-COMPARE', evidence: '对比关键词', start: 0, end: 0 })
  }
  const categoriesFound: FieldCategory[] = [...new Set(fields.map((f) => f.category))]
  return {
    reportId: undefined as string | undefined,
    fields,
    categoriesFound,
    overallConfidence: Math.round(fields.reduce((s, f) => s + f.confidence, 0) / Math.max(1, fields.length) * 100) / 100,
    modelVersion: MODEL_VERSION,
    generatedAt: new Date().toISOString(),
    simulated: true,
  }
}

function generateDraft(modality: string, bodyPart: string, findings?: string, clinicalHistory?: string) {
  const now = new Date().toISOString()
  const segments: DraftSegment[] = [
    {
      id: `seg-${draftSeq}`, paragraphType: 'technique', heading: '检查技术',
      content: `${modality} ${bodyPart}平扫。扫描层厚 ${modality === 'MR' ? '5' : '1'}mm。`,
      confidence: 0.95,
      sources: [{ kind: 'template', refId: 'tpl-001', description: `匹配 ${modality} ${bodyPart} 模板`, confidence: 0.95 }],
    },
    {
      id: `seg-${draftSeq + 1}`, paragraphType: 'findings', heading: '影像所见',
      content: findings && findings.trim().length > 0 ? findings.trim() : `${bodyPart}结构形态、密度/信号未见明显异常。`,
      confidence: findings ? 0.88 : 0.92,
      sources: [
        { kind: 'field', refId: 'fld-001', description: '继承医生录入的所见', confidence: 0.88 },
        { kind: 'seed', refId: 'seed-findings', description: '默认所见兜底', confidence: 0.92 },
      ],
    },
    {
      id: `seg-${draftSeq + 2}`, paragraphType: 'conclusion', heading: '诊断结论',
      content: clinicalHistory && clinicalHistory.includes('随访') ? `${bodyPart}检查未见明显异常, 建议定期随访复查。` : `${bodyPart}检查未见明显异常。`,
      confidence: 0.86,
      sources: [{ kind: 'rule', refId: 'RULE-NORMAL', description: '未见异常结论规则', confidence: 0.86 }],
    },
    {
      id: `seg-${draftSeq + 3}`, paragraphType: 'recommendation', heading: '随访建议',
      content: clinicalHistory && clinicalHistory.includes('随访') ? '建议 6-12 个月后复查。' : '无特殊随访建议。',
      confidence: 0.8,
      sources: [{ kind: 'seed', refId: 'seed-followup', description: '默认随访建议', confidence: 0.8 }],
    },
  ]
  const result = {
    id: `ai2d-${draftSeq}`,
    reportId: undefined as string | undefined,
    segments,
    overallConfidence: Math.round(segments.reduce((s, x) => s + x.confidence, 0) / segments.length * 100) / 100,
    modelVersion: MODEL_VERSION,
    generatedAt: now,
    simulated: true,
  }
  draftSeq += 10
  drafts.unshift(result)
  return result
}

// [demo seed] AI 草稿历史 (幂等), 使草稿列表首次加载非空
;(function seedDrafts() {
  if (drafts.length > 0) return
  generateDraft('CT', '胸部', '右肺上叶见 8 mm 磨玻璃结节, 边缘尚清, 建议随访复查。', '咳嗽 2 周, 吸烟史 30 年')
  generateDraft('MR', '颅脑', '双侧基底节区见多发点状缺血灶, 脑沟增宽。', '头晕 1 月')
  generateDraft('DR', '腰椎', '', '腰背部疼痛')
})()

export const aiDraftV2Handlers = [
  http.post(`${API}/extract-fields`, async ({ request }) => {
    await delay(80)
    const body = (await request.json()) as { findings?: string; modality?: string; bodyPart?: string; reportId?: string }
    const result = extractFields(String(body?.findings ?? ''), body?.modality, body?.bodyPart) as { fields: unknown; categoriesFound: FieldCategory[]; overallConfidence: number; modelVersion: string; generatedAt: string; simulated?: boolean; reportId?: string }
    result.reportId = body?.reportId
    return HttpResponse.json(result)
  }),

  http.post(`${API}/generate`, async ({ request }) => {
    await delay(120)
    const body = (await request.json()) as { patientId?: string; examId?: string; modality?: string; bodyPart?: string; findings?: string; clinicalHistory?: string; keywords?: string[] }
    const result = generateDraft(String(body?.modality ?? 'CT'), String(body?.bodyPart ?? '胸部'), body?.findings, body?.clinicalHistory)
    return HttpResponse.json({ ...result, reportId: undefined, patientId: body?.patientId, examId: body?.examId })
  }),

  http.post(`${API}/suggest`, async ({ request }) => {
    await delay(100)
    const body = (await request.json()) as { paragraphs?: Array<{ heading: string; content: string }>; modality?: string; bodyPart?: string }
    const paragraphs = body?.paragraphs ?? []
    const suggestions: Array<{ id: string; paragraphIndex: number; paragraphHeading: string; severity: 'info' | 'warning' | 'critical'; title: string; description: string; suggestedText?: string; ruleId: string; confidence: number }> = []
    paragraphs.forEach((p, i) => {
      if (p.content.includes('cm')) {
        suggestions.push({ id: `sg-${i}-1`, paragraphIndex: i, paragraphHeading: p.heading, severity: 'warning', title: '单位不规范', description: '"cm" 应替换为 "mm"', suggestedText: p.content.replace(/(\d+(?:\.\d+)?)cm/g, '$1mm'), ruleId: 'RULE-UNIT-MM', confidence: 0.9 })
      }
      if (p.heading.includes('结论') && p.content.includes('考虑')) {
        suggestions.push({ id: `sg-${i}-2`, paragraphIndex: i, paragraphHeading: p.heading, severity: 'warning', title: '模糊表述', description: '结论应使用确定性措辞', suggestedText: p.content.replace(/考虑/g, ''), ruleId: 'RULE-CONCLUSION', confidence: 0.85 })
      }
      if (p.content.length < 10 && p.content.trim().length > 0) {
        suggestions.push({ id: `sg-${i}-3`, paragraphIndex: i, paragraphHeading: p.heading, severity: 'info', title: '内容过短', description: '段落内容过短, 可补充细节', ruleId: 'RULE-LENGTH', confidence: 0.7 })
      }
    })
    return HttpResponse.json({
      suggestions,
      overallScore: Math.max(0, Math.min(100, 92 - suggestions.length * 6)),
      modelVersion: MODEL_VERSION,
      generatedAt: new Date().toISOString(),
    })
  }),

  http.get(`${API}/drafts`, async () => {
    await delay(40)
    return HttpResponse.json(drafts)
  }),
]
