import { Injectable } from '@nestjs/common'

export interface SnomedCode {
  conceptId: string
  fsn: string
  pt: string
  semanticTag: string
  matchType: 'exact' | 'partial' | 'suggested'
  confidence: number
}

// ── [v3.0.6.11-103 Wave 17] 自动编码 (报告文本 → 诊断词 → SNOMED + ICD-10) ──

export interface Icd10Code {
  code: string
  title: string
  matchType: 'exact' | 'partial'
  confidence: number
}

export type AutoCodeSection = 'findings' | 'impression' | 'conclusion' | 'unknown'

export interface AutoEncodedTerm {
  keyword: string
  matched: boolean
  sourcePhrase: string
  start: number
  end: number
  section: AutoCodeSection
  snomed: SnomedCode[]
  icd10: Icd10Code[]
  confidence: number
}

export interface AutoEncodeResult {
  text: string
  terms: AutoEncodedTerm[]
  total: number
  confirmed: number
}

interface Icd10Mapping {
  code: string
  title: string
  exact: boolean
  confidence: number
}

// 诊断词 → ICD-10 确定性字典 (演示级, 常见放射诊断)
const ICD10_DICT: Record<string, Icd10Mapping[]> = {
  '肺结节': [{ code: 'R91.1', title: '肺部结节影像学发现', exact: true, confidence: 0.95 }],
  '结节': [{ code: 'R91.1', title: '肺部结节影像学发现', exact: false, confidence: 0.78 }],
  '磨玻璃': [{ code: 'R91.1', title: '肺部结节影像学发现', exact: false, confidence: 0.85 }],
  '毛刺征': [{ code: 'R91.8', title: '肺其他影像学异常发现', exact: true, confidence: 0.88 }],
  '钙化': [{ code: 'R91.8', title: '肺其他影像学异常发现', exact: false, confidence: 0.72 }],
  '胸腔积液': [{ code: 'J90', title: '胸腔积液,不可归类在他处者', exact: true, confidence: 0.97 }],
  '肺不张': [{ code: 'J98.1', title: '肺萎陷不全', exact: true, confidence: 0.93 }],
  '肺气肿': [{ code: 'J43.9', title: '肺气肿,未特指', exact: true, confidence: 0.95 }],
  '肺炎': [{ code: 'J18.9', title: '肺炎,病原体未特指', exact: true, confidence: 0.97 }],
  '肺结核': [{ code: 'A15.9', title: '呼吸道结核,未特指', exact: true, confidence: 0.96 }],
  '肺栓塞': [{ code: 'I26.9', title: '肺栓塞,未特指', exact: true, confidence: 0.94 }],
  '气胸': [{ code: 'J93.9', title: '气胸,未特指', exact: true, confidence: 0.96 }],
  '肝囊肿': [{ code: 'K76.89', title: '其他特指的肝脏疾病', exact: true, confidence: 0.92 }],
  '肝硬化': [{ code: 'K74.6', title: '其他及未特指的肝硬化', exact: true, confidence: 0.97 }],
  '脂肪肝': [{ code: 'K76.0', title: '脂肪肝', exact: true, confidence: 0.96 }],
  '肝血管瘤': [{ code: 'D18.0', title: '血管瘤,任何部位', exact: true, confidence: 0.93 }],
  '肝癌': [{ code: 'C22.9', title: '肝恶性肿瘤,未特指', exact: true, confidence: 0.94 }],
  '胆囊结石': [{ code: 'K80.20', title: '胆囊结石,无胆囊炎', exact: true, confidence: 0.95 }],
  '肾囊肿': [{ code: 'N28.1', title: '肾囊肿', exact: true, confidence: 0.94 }],
  '肾结石': [{ code: 'N20.0', title: '肾结石', exact: true, confidence: 0.95 }],
  '脑梗死': [{ code: 'I63.9', title: '脑梗死,未特指', exact: true, confidence: 0.96 }],
  '脑出血': [{ code: 'I61.9', title: '脑内出血,未特指', exact: true, confidence: 0.96 }],
  '脑膜瘤': [{ code: 'D32.9', title: '脑膜良性肿瘤,未特指', exact: true, confidence: 0.92 }],
  '胶质瘤': [{ code: 'C71.9', title: '脑恶性肿瘤,未特指', exact: true, confidence: 0.92 }],
  '垂体瘤': [{ code: 'D35.2', title: '垂体良性肿瘤', exact: true, confidence: 0.93 }],
  '动脉瘤': [{ code: 'I72.9', title: '动脉瘤,未特指', exact: true, confidence: 0.90 }],
  '主动脉夹层': [{ code: 'I71.0', title: '主动脉夹层', exact: true, confidence: 0.98 }],
  '椎间盘突出': [{ code: 'M51.2', title: '其他特指的椎间盘移位', exact: true, confidence: 0.93 }],
  '椎管狭窄': [{ code: 'M48.0', title: '椎管狭窄', exact: true, confidence: 0.93 }],
  '骨折': [{ code: 'T14.2', title: '身体未特指部位的骨折', exact: false, confidence: 0.85 }],
  '骨质疏松': [{ code: 'M81.9', title: '骨质疏松,未特指', exact: true, confidence: 0.94 }],
  '水肿': [{ code: 'R60.9', title: '水肿,未特指', exact: true, confidence: 0.90 }],
  '肿瘤': [
    { code: 'C80.1', title: '恶性肿瘤,未特指部位', exact: false, confidence: 0.80 },
    { code: 'D48.9', title: '未特指部位的肿瘤,性质或行为未特指', exact: false, confidence: 0.74 },
  ],
  '乳腺结节': [{ code: 'N63', title: '乳房未特指的肿块', exact: true, confidence: 0.90 }],
  '甲状腺结节': [{ code: 'E04.1', title: '非毒性单个甲状腺结节', exact: true, confidence: 0.92 }],
  '阑尾炎': [{ code: 'K37', title: '阑尾炎,未特指', exact: true, confidence: 0.90 }],
  '间质性肺病': [{ code: 'J84.9', title: '间质性肺病,未特指', exact: true, confidence: 0.90 }],
}

// 诊断词 → SNOMED 补充映射 (覆盖原字典未含的疾病)
const EXTRA_SNOMED: Record<string, SnomedCode[]> = {
  '气胸': [{ conceptId: '36177008', fsn: 'Pneumothorax (disorder)', pt: 'Pneumothorax', semanticTag: 'disorder', matchType: 'exact', confidence: 0.98 }],
  '毛刺征': [{ conceptId: '45321009', fsn: 'Spiculated lesion (morphologic abnormality)', pt: 'Spiculated lesion', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.92 }],
  '脑梗死': [{ conceptId: '432504006', fsn: 'Infarction of brain (disorder)', pt: 'Cerebral infarction', semanticTag: 'disorder', matchType: 'exact', confidence: 0.97 }],
  '脑出血': [{ conceptId: '274100004', fsn: 'Hemorrhage of cerebrum (disorder)', pt: 'Cerebral hemorrhage', semanticTag: 'disorder', matchType: 'exact', confidence: 0.97 }],
  '脂肪肝': [{ conceptId: '197321007', fsn: 'Fatty liver (disorder)', pt: 'Fatty liver', semanticTag: 'disorder', matchType: 'exact', confidence: 0.96 }],
  '肺不张': [{ conceptId: '46775001', fsn: 'Atelectasis (disorder)', pt: 'Atelectasis', semanticTag: 'disorder', matchType: 'exact', confidence: 0.95 }],
  '肺栓塞': [{ conceptId: '59282003', fsn: 'Pulmonary embolism (disorder)', pt: 'Pulmonary embolism', semanticTag: 'disorder', matchType: 'exact', confidence: 0.97 }],
  '椎间盘突出': [{ conceptId: '230830008', fsn: 'Prolapsed intervertebral disc (disorder)', pt: 'Prolapsed disc', semanticTag: 'disorder', matchType: 'exact', confidence: 0.94 }],
  '动脉瘤': [{ conceptId: '386833004', fsn: 'Aneurysm (disorder)', pt: 'Aneurysm', semanticTag: 'disorder', matchType: 'exact', confidence: 0.95 }],
  '乳腺结节': [{ conceptId: '27657008', fsn: 'Nodule of breast (disorder)', pt: 'Breast nodule', semanticTag: 'disorder', matchType: 'exact', confidence: 0.93 }],
  '甲状腺结节': [{ conceptId: '237476006', fsn: 'Nodule of thyroid gland (disorder)', pt: 'Thyroid nodule', semanticTag: 'disorder', matchType: 'exact', confidence: 0.93 }],
  '脑膜瘤': [{ conceptId: '53495002', fsn: 'Meningioma (disorder)', pt: 'Meningioma', semanticTag: 'disorder', matchType: 'exact', confidence: 0.94 }],
  '胶质瘤': [{ conceptId: '42548006', fsn: 'Glioma (disorder)', pt: 'Glioma', semanticTag: 'disorder', matchType: 'exact', confidence: 0.94 }],
  '垂体瘤': [{ conceptId: '30186007', fsn: 'Pituitary adenoma (disorder)', pt: 'Pituitary adenoma', semanticTag: 'disorder', matchType: 'exact', confidence: 0.93 }],
  '骨质疏松': [{ conceptId: '64859006', fsn: 'Osteoporosis (disorder)', pt: 'Osteoporosis', semanticTag: 'disorder', matchType: 'exact', confidence: 0.96 }],
  '间质性肺病': [{ conceptId: '196658000', fsn: 'Interstitial lung disease (disorder)', pt: 'Interstitial lung disease', semanticTag: 'disorder', matchType: 'exact', confidence: 0.94 }],
}

const SECTION_MARKERS: Array<{ key: AutoCodeSection; labels: string[] }> = [
  { key: 'findings', labels: ['所见', '征象', '描述'] },
  { key: 'impression', labels: ['印象', '诊断', '意见'] },
  { key: 'conclusion', labels: ['结论', '诊断结论'] },
]

function snomedFor(keyword: string): SnomedCode[] {
  return (RADIOLOGY_SNOMED_MAP[keyword] ?? EXTRA_SNOMED[keyword] ?? []).map((c) => ({ ...c }))
}

function icd10For(keyword: string): Icd10Code[] {
  return (ICD10_DICT[keyword] ?? []).map((m) => ({ code: m.code, title: m.title, matchType: m.exact ? 'exact' : 'partial', confidence: m.confidence }))
}

/** 报告文本 → 提取诊断词 (最长匹配优先, 区间去重) → 每词 SNOMED + ICD-10 建议 */
export function extractDiagnosisTerms(text: string, section: AutoCodeSection = 'unknown'): AutoEncodedTerm[] {
  const source = (text ?? '').trim()
  const allKeys = Array.from(new Set([...Object.keys(RADIOLOGY_SNOMED_MAP), ...Object.keys(ICD10_DICT), ...Object.keys(EXTRA_SNOMED)]))
  const spans: Array<{ keyword: string; start: number; end: number }> = []
  for (const keyword of allKeys) {
    let from = 0
    while (true) {
      const idx = source.indexOf(keyword, from)
      if (idx === -1) break
      spans.push({ keyword, start: idx, end: idx + keyword.length })
      from = idx + keyword.length
    }
  }
  spans.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: typeof spans = []
  for (const span of spans) {
    const overlap = kept.some((k) => span.start < k.end && span.end > k.start)
    if (!overlap) kept.push(span)
  }
  return kept.map((span) => {
    const snomed = snomedFor(span.keyword)
    const icd10 = icd10For(span.keyword)
    const base = Math.max(
      ...snomed.map((c) => c.confidence),
      ...icd10.map((c) => c.confidence),
      0.6,
    )
    return {
      keyword: span.keyword,
      matched: snomed.length > 0 || icd10.length > 0,
      sourcePhrase: source.slice(span.start, span.end),
      start: span.start,
      end: span.end,
      section,
      snomed,
      icd10,
      confidence: Math.min(0.99, +(base - (span.keyword.length > 3 ? 0 : 0.05)).toFixed(2)),
    }
  })
}

/** 文本分节: 【所见】/【印象】/【结论】 块内单独提取 */
export function splitSections(text: string): Array<{ key: AutoCodeSection; text: string }> {
  const result: Array<{ key: AutoCodeSection; text: string }> = []
  let current: AutoCodeSection = 'findings'
  let buffer = ''
  const lines = (text ?? '').split(/\n|(?=【)/)
  for (const line of lines) {
    const trimmed = line.trim()
    const matched = SECTION_MARKERS.find((m) => m.labels.some((l) => trimmed.startsWith(`【${l}】`) || trimmed.startsWith(l + ':')))
    if (matched) {
      if (buffer.trim()) result.push({ key: current, text: buffer.trim() })
      current = matched.key
      buffer = trimmed.replace(/^【[^】]+】|^[^:：]{1,4}[:：]/, '').trim()
      continue
    }
    buffer += trimmed
  }
  if (buffer.trim()) result.push({ key: current, text: buffer.trim() })
  return result
}

const RADIOLOGY_SNOMED_MAP: Record<string, SnomedCode[]> = {
  '结节': [
    { conceptId: '30092000', fsn: 'Nodule (morphologic abnormality)', pt: 'Nodule', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.98 },
    { conceptId: '406122000', fsn: 'Nodular lesion (morphologic abnormality)', pt: 'Nodular lesion', semanticTag: 'morphologic abnormality', matchType: 'partial', confidence: 0.85 },
  ],
  '钙化': [
    { conceptId: '473840003', fsn: 'Calcification (morphologic abnormality)', pt: 'Calcification', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.97 },
  ],
  '磨玻璃': [
    { conceptId: '427283000', fsn: 'Ground glass opacity (morphologic abnormality)', pt: 'Ground glass opacity', semanticTag: 'morphologic abnormality', matchType: 'exact', confidence: 0.95 },
  ],
  '胸腔积液': [
    { conceptId: '79619009', fsn: 'Pleural effusion (disorder)', pt: 'Pleural effusion', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
  ],
  '肺气肿': [
    { conceptId: '87433001', fsn: 'Pulmonary emphysema (disorder)', pt: 'Pulmonary emphysema', semanticTag: 'disorder', matchType: 'exact', confidence: 0.98 },
  ],
  '肝囊肿': [
    { conceptId: '40845000', fsn: 'Cyst of liver (disorder)', pt: 'Cyst of liver', semanticTag: 'disorder', matchType: 'exact', confidence: 0.98 },
  ],
  '肝硬化': [
    { conceptId: '19943007', fsn: 'Cirrhosis of liver (disorder)', pt: 'Cirrhosis of liver', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
  ],
  '骨折': [
    { conceptId: '125605004', fsn: 'Fracture of bone (disorder)', pt: 'Fracture of bone', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
    { conceptId: '71638005', fsn: 'Closed fracture (disorder)', pt: 'Closed fracture', semanticTag: 'disorder', matchType: 'partial', confidence: 0.82 },
  ],
  '水肿': [
    { conceptId: '79654002', fsn: 'Edema (finding)', pt: 'Edema', semanticTag: 'finding', matchType: 'exact', confidence: 0.97 },
  ],
  '肿瘤': [
    { conceptId: '363346000', fsn: 'Malignant neoplastic disease (disorder)', pt: 'Malignant neoplasm', semanticTag: 'disorder', matchType: 'partial', confidence: 0.80 },
    { conceptId: '126952004', fsn: 'Benign neoplasm of lung (disorder)', pt: 'Benign neoplasm', semanticTag: 'disorder', matchType: 'partial', confidence: 0.75 },
  ],
  '肺炎': [
    { conceptId: '233604007', fsn: 'Pneumonia (disorder)', pt: 'Pneumonia', semanticTag: 'disorder', matchType: 'exact', confidence: 0.99 },
  ],
}

@Injectable()
export class SnomedService {
  async encode(text: string, modality?: string): Promise<{ text: string; codes: SnomedCode[] }> {
    const codes: SnomedCode[] = []
    for (const [keyword, mappings] of Object.entries(RADIOLOGY_SNOMED_MAP)) {
      if (text.includes(keyword)) {
        for (const m of mappings) {
          if (!codes.some(c => c.conceptId === m.conceptId)) {
            codes.push(m)
          }
        }
      }
    }
    return { text, codes }
  }

  async search(q: string): Promise<SnomedCode[]> {
    if (!q) return []
    const results: SnomedCode[] = []
    for (const [, mappings] of Object.entries(RADIOLOGY_SNOMED_MAP)) {
      for (const m of mappings) {
        if (m.pt.toLowerCase().includes(q.toLowerCase()) || m.fsn.toLowerCase().includes(q.toLowerCase())) {
          if (!results.some(c => c.conceptId === m.conceptId)) {
            results.push(m)
          }
        }
      }
    }
    return results
  }

  // ── [v3.0.6.11-103 Wave 17] 自动编码: 文本 → 诊断词 → SNOMED + ICD-10 ──────

  /** 确定性规则: 分节 → 提取诊断词(最长匹配/区间去重) → 双编码建议 */
  async autoEncode(text: string): Promise<AutoEncodeResult> {
    const source = (text ?? '').trim()
    if (!source) return { text: source, terms: [], total: 0, confirmed: 0 }
    const sections = splitSections(source)
    const terms: AutoEncodedTerm[] = []
    const seen = new Set<string>()
    for (const section of sections) {
      for (const term of extractDiagnosisTerms(section.text, section.key)) {
        const dedupeKey = `${term.keyword}@${term.start}`
        if (seen.has(dedupeKey)) continue
        seen.add(dedupeKey)
        terms.push(term)
      }
    }
    terms.sort((a, b) => a.start - b.start)
    const high = terms.filter((t) => t.confidence >= 0.9).length
    return { text: source, terms, total: terms.length, confirmed: high }
  }
}
