/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 (F1): 结构化字段自动提取
 * 规则 + 字典驱动 (确定性): 从"影像所见"文本自动识别
 *   部位 / 征象 / 测量值 / 对比 / 结论 五类字段, 每字段附置信度 + 可追溯 ID。
 * 无 LLM 依赖, 同输入恒定输出。
 */
import { hashString, floatInRange } from '../../common/utils/deterministic-hash'

export type FieldCategory = 'bodyPart' | 'finding' | 'measurement' | 'comparison' | 'conclusion'

export interface ExtractedField {
  /** 可追溯 ID: fld-<hash(category:value:文本指纹)> */
  id: string
  category: FieldCategory
  /** 字段标签 (中文, 用于前端展示) */
  label: string
  /** 字段值 (命中的原文片段, 归一化后) */
  value: string
  /** 置信度 0-1 */
  confidence: number
  /** 来源: 字典命中 或 规则匹配 */
  source: 'dictionary' | 'rule'
  /** 规则/字典条目 ID, 可追溯 */
  ruleId: string
  /** 证据: 原文中的命中片段 */
  evidence: string
  /** 命中区间 (原文索引, 用于去重) */
  start: number
  end: number
}

export interface ExtractFieldsRequest {
  findings: string
  modality?: string
  bodyPart?: string
}

export interface ExtractFieldsResult {
  reportId?: string
  fields: ExtractedField[]
  /** 命中的字段类别集合 */
  categoriesFound: FieldCategory[]
  /** 整体置信度 (各字段均值) */
  overallConfidence: number
  modelVersion: string
  generatedAt: Date
  /** true = DB 不可用 / 报告关联失败, 纯内存计算 */
  simulated?: boolean
}

// ────────────────────────────────────────────────────────────────────────────
// 字典: 部位 (按词长降序匹配, 长词优先)
// ────────────────────────────────────────────────────────────────────────────
const BODY_PART_DICT: { term: string; label: string; ruleId: string }[] = [
  { term: '右肺上叶', label: '右肺上叶', ruleId: 'bodyPart:rl-upper' },
  { term: '右肺中叶', label: '右肺中叶', ruleId: 'bodyPart:rl-middle' },
  { term: '右肺下叶', label: '右肺下叶', ruleId: 'bodyPart:rl-lower' },
  { term: '左肺上叶', label: '左肺上叶', ruleId: 'bodyPart:ll-upper' },
  { term: '左肺下叶', label: '左肺下叶', ruleId: 'bodyPart:ll-lower' },
  { term: '双肺门', label: '肺门', ruleId: 'bodyPart:hilum' },
  { term: '纵隔', label: '纵隔', ruleId: 'bodyPart:mediastinum' },
  { term: '胸膜', label: '胸膜', ruleId: 'bodyPart:pleura' },
  { term: '心影', label: '心脏', ruleId: 'bodyPart:heart' },
  { term: '主动脉', label: '主动脉', ruleId: 'bodyPart:aorta' },
  { term: '肝脏', label: '肝脏', ruleId: 'bodyPart:liver' },
  { term: '胆囊', label: '胆囊', ruleId: 'bodyPart:gallbladder' },
  { term: '胰腺', label: '胰腺', ruleId: 'bodyPart:pancreas' },
  { term: '脾脏', label: '脾脏', ruleId: 'bodyPart:spleen' },
  { term: '双肾', label: '双肾', ruleId: 'bodyPart:kidneys' },
  { term: '肾脏', label: '肾脏', ruleId: 'bodyPart:kidney' },
  { term: '甲状腺', label: '甲状腺', ruleId: 'bodyPart:thyroid' },
  { term: '乳腺', label: '乳腺', ruleId: 'bodyPart:breast' },
  { term: '颅骨', label: '颅骨', ruleId: 'bodyPart:skull' },
  { term: '椎间盘', label: '椎间盘', ruleId: 'bodyPart:disc' },
  { term: '椎体', label: '椎体', ruleId: 'bodyPart:vertebra' },
  { term: '脊髓', label: '脊髓', ruleId: 'bodyPart:spinal-cord' },
  { term: '桡骨', label: '桡骨', ruleId: 'bodyPart:radius' },
  { term: '尺骨', label: '尺骨', ruleId: 'bodyPart:ulna' },
  { term: '胫骨', label: '胫骨', ruleId: 'bodyPart:tibia' },
  { term: '腓骨', label: '腓骨', ruleId: 'bodyPart:fibula' },
  { term: '股骨颈', label: '股骨颈', ruleId: 'bodyPart:femoral-neck' },
  { term: '腕舟骨', label: '腕舟骨', ruleId: 'bodyPart:scaphoid' },
  { term: '双肺', label: '双肺', ruleId: 'bodyPart:both-lungs' },
  { term: '肺', label: '肺', ruleId: 'bodyPart:lung' },
  { term: '肝', label: '肝', ruleId: 'bodyPart:liver-short' },
  { term: '脾', label: '脾', ruleId: 'bodyPart:spleen-short' },
  { term: '肾', label: '肾', ruleId: 'bodyPart:kidney-short' },
  { term: '脑', label: '脑', ruleId: 'bodyPart:brain' },
  { term: '脊柱', label: '脊柱', ruleId: 'bodyPart:spine' },
  { term: '关节', label: '关节', ruleId: 'bodyPart:joint' },
  { term: '脑室', label: '脑室', ruleId: 'bodyPart:ventricle' },
  { term: '颅脑', label: '颅脑', ruleId: 'bodyPart:cranium' },
]

// ────────────────────────────────────────────────────────────────────────────
// 字典: 征象 (阳性/阴性)
// ────────────────────────────────────────────────────────────────────────────
const FINDING_DICT: { term: string; label: string; polarity: 'positive' | 'negative'; ruleId: string }[] = [
  { term: '胸膜牵拉', label: '胸膜牵拉征', polarity: 'positive', ruleId: 'finding:pleural-tug' },
  { term: '分叶状', label: '分叶状', polarity: 'positive', ruleId: 'finding:lobulated' },
  { term: '磨玻璃影', label: '磨玻璃影', polarity: 'positive', ruleId: 'finding:ggo' },
  { term: '实变影', label: '实变影', polarity: 'positive', ruleId: 'finding:consolidation' },
  { term: '条索状影', label: '条索状影', polarity: 'positive', ruleId: 'finding:strand' },
  { term: '斑片状影', label: '斑片状影', polarity: 'positive', ruleId: 'finding:patch' },
  { term: '占位性病变', label: '占位性病变', polarity: 'positive', ruleId: 'finding:mass-lesion' },
  { term: '异常密度影', label: '异常密度影', polarity: 'positive', ruleId: 'finding:abnormal-density' },
  { term: '骨质破坏', label: '骨质破坏', polarity: 'positive', ruleId: 'finding:bone-destruction' },
  { term: '骨折线', label: '骨折线', polarity: 'positive', ruleId: 'finding:fracture-line' },
  { term: '胸腔积液', label: '胸腔积液', polarity: 'positive', ruleId: 'finding:pleural-effusion' },
  { term: '血管集束征', label: '血管集束征', polarity: 'positive', ruleId: 'finding:vessel-convergence' },
  { term: '钙化', label: '钙化', polarity: 'positive', ruleId: 'finding:calcification' },
  { term: '结石', label: '结石', polarity: 'positive', ruleId: 'finding:stone' },
  { term: '囊肿', label: '囊肿', polarity: 'positive', ruleId: 'finding:cyst' },
  { term: '脑梗死', label: '脑梗死', polarity: 'positive', ruleId: 'finding:infarction' },
  { term: '出血', label: '出血', polarity: 'positive', ruleId: 'finding:hemorrhage' },
  { term: '狭窄', label: '狭窄', polarity: 'positive', ruleId: 'finding:stenosis' },
  { term: '肿大淋巴结', label: '肿大淋巴结', polarity: 'positive', ruleId: 'finding:lymph-node' },
  { term: '结节', label: '结节', polarity: 'positive', ruleId: 'finding:nodule' },
  { term: '肿块', label: '肿块', polarity: 'positive', ruleId: 'finding:mass' },
  { term: '毛刺', label: '毛刺征', polarity: 'positive', ruleId: 'finding:spiculation' },
  { term: '强化', label: '强化', polarity: 'positive', ruleId: 'finding:enhancement' },
  { term: '骨质疏松', label: '骨质疏松', polarity: 'positive', ruleId: 'finding:osteoporosis' },
  { term: '椎间盘突出', label: '椎间盘突出', polarity: 'positive', ruleId: 'finding:disc-herniation' },
  { term: '未见明确骨折', label: '未见明确骨折', polarity: 'negative', ruleId: 'finding:no-fracture' },
  { term: '未见明显异常', label: '未见明显异常', polarity: 'negative', ruleId: 'finding:no-abnormality' },
  { term: '未见异常', label: '未见异常', polarity: 'negative', ruleId: 'finding:no-anomaly' },
  { term: '未见明显肿大', label: '未见明显肿大淋巴结', polarity: 'negative', ruleId: 'finding:no-adenopathy' },
  { term: '形态正常', label: '形态正常', polarity: 'negative', ruleId: 'finding:normal-shape' },
  { term: '密度均匀', label: '密度均匀', polarity: 'negative', ruleId: 'finding:homogeneous-density' },
  { term: '信号均匀', label: '信号均匀', polarity: 'negative', ruleId: 'finding:homogeneous-signal' },
  { term: '骨质结构完整', label: '骨质结构完整', polarity: 'negative', ruleId: 'finding:intact-bone' },
  { term: '边界清晰', label: '边界清晰', polarity: 'negative', ruleId: 'finding:clear-margin' },
]

// ────────────────────────────────────────────────────────────────────────────
// 规则: 测量值 / 对比 / 结论 (确定性正则)
// ────────────────────────────────────────────────────────────────────────────
interface FieldRule {
  ruleId: string
  category: FieldCategory
  label: string
  /** 捕获组 1 = 主值; value 由 group 组装 */
  pattern: RegExp
  valueOf: (match: RegExpExecArray, text: string) => string
  baseConfidence: number
}

const MEASURE_UNITS = '(?:mm|cm|cm³|cm3|mL|ml|HU|mm²)'

const FIELD_RULES: FieldRule[] = [
  // 尺寸测量: 18mm×15mm / 2.5cm × 1.8cm / 18×15mm
  {
    ruleId: 'measurement:size-axb',
    category: 'measurement',
    label: '病灶尺寸',
    pattern: new RegExp(`([0-9]+(?:\\.[0-9]+)?)\\s*(?:(${MEASURE_UNITS})\\s*)?[×xX]\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MEASURE_UNITS})`, 'g'),
    valueOf: (m) => `${m[1]}${m[2] ?? ''}×${m[3]}${m[4] ?? ''}`,
    baseConfidence: 0.96,
  },
  // 单值测量: 长径约 12mm / 直径约 8.5mm / CT值约 -30HU (排除尺寸对乘式)
  {
    ruleId: 'measurement:single',
    category: 'measurement',
    label: '测量值',
    pattern: new RegExp(`(?:约[为]?|为|\\s)\\s*([0-9]+(?:\\.[0-9]+)?)\\s*(${MEASURE_UNITS})(?!\\s*[×xX])`, 'g'),
    valueOf: (m) => `${m[1]}${m[2] ?? ''}`,
    baseConfidence: 0.93,
  },
  // 对比: 与(前片/既往/上次...)相比 + 较前... (捕获至逗号止, 避免吞并结论短语)
  {
    ruleId: 'comparison:with-prior',
    category: 'comparison',
    label: '前后对比',
    pattern: new RegExp('与(前片|前次|既往|上次)(?:CT|MRI|X线|X线片|检查)?相?比[，,]?([^。；，,\\n]{0,16})', 'g'),
    valueOf: (m) => `与既往相比${m[2] ?? ''}`.trim(),
    baseConfidence: 0.94,
  },
  {
    ruleId: 'comparison:progressive',
    category: 'comparison',
    label: '动态变化',
    pattern: new RegExp('较前(无明显变化|无变化|无明显增大|明显增大|缩小|减小|增大|好转|进展|新发|减少|增多|变化不大)', 'g'),
    valueOf: (m) => `较前${m[1] ?? ''}`,
    baseConfidence: 0.95,
  },
  {
    ruleId: 'comparison:contrast-prior',
    category: 'comparison',
    label: '对比前次检查',
    pattern: new RegExp('对比前次检查[，,]?([^。；，,\\n]{0,16})', 'g'),
    valueOf: (m) => `对比前次检查${m[1] ?? ''}`.trim(),
    baseConfidence: 0.92,
  },
  // 结论: 考虑/提示/符合/诊断/不除外 ...
  {
    ruleId: 'conclusion:diagnosis-cue',
    category: 'conclusion',
    label: '诊断意见',
    pattern: new RegExp('(考虑|提示|符合|支持|诊断|倾向)(为|:)?[：:]?([^。；\\n]{2,40})', 'g'),
    valueOf: (m) => `${m[1] ?? ''}${m[3] ?? ''}`.trim(),
    baseConfidence: 0.9,
  },
  {
    ruleId: 'conclusion:negative',
    category: 'conclusion',
    label: '阴性结论',
    pattern: new RegExp('(未见明显异常|未见异常|所见符合正常[^。；\\n]{0,20})', 'g'),
    valueOf: (m) => m[1] ?? '',
    baseConfidence: 0.91,
  },
]

export const FIELD_CATEGORY_LABEL: Record<FieldCategory, string> = {
  bodyPart: '部位',
  finding: '征象',
  measurement: '测量值',
  comparison: '对比',
  conclusion: '结论',
}

export const MODEL_VERSION = 'ai-assistant-v2.0.0'

function fieldIdOf(category: FieldCategory, value: string, text: string): string {
  return `fld-${hashString(`${category}:${value}:${text.length}:${text.charCodeAt(0) ?? 0}`).toString(16).slice(0, 10)}`
}

/** 置信度: 字典/规则基准值 + 确定性微调, 同输入恒定 */
function confidenceOf(base: number, salt: string): number {
  return floatInRange(salt, Math.max(0.8, base - 0.04), Math.min(0.98, base + 0.03), 3, 3)
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && b.start < a.end
}

/** 按区间去重: 区间重叠时保留更长的命中 */
function dedupeBySpan<T extends { start: number; end: number }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: T[] = []
  for (const item of sorted) {
    if (kept.some((k) => overlaps(k, item))) continue
    kept.push(item)
  }
  return kept
}

function matchAll(text: string, rule: FieldRule, category: FieldCategory): ExtractedField[] {
  const out: ExtractedField[] = []
  const re = new RegExp(rule.pattern.source, 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    if (m[0].length === 0) {
      re.lastIndex += 1
      continue
    }
    const start = m.index
    const end = start + m[0].length
    const value = rule.valueOf(m, text)
    out.push({
      id: fieldIdOf(category, value, text),
      category,
      label: rule.label,
      value,
      confidence: confidenceOf(rule.baseConfidence, `${rule.ruleId}:${value}:${start}`),
      source: 'rule',
      ruleId: rule.ruleId,
      evidence: m[0],
      start,
      end,
    })
  }
  return out
}

/** 纯确定性提取: 字典 + 规则, 无 DB 依赖 (孤儿路径) */
export function extractStructuredFields(req: ExtractFieldsRequest): Omit<ExtractFieldsResult, 'generatedAt'> {
  const text = (req.findings ?? '').trim()
  const fields: ExtractedField[] = []

  if (text.length === 0) {
    return { fields: [], categoriesFound: [], overallConfidence: 0, modelVersion: MODEL_VERSION }
  }

  // 1) 字典: 部位 (长词优先, 区间去重)
  const bodyParts = dedupeBySpan(
    [...BODY_PART_DICT]
      .sort((a, b) => b.term.length - a.term.length)
      .map((entry): ExtractedField | null => {
        const start = text.indexOf(entry.term)
        if (start < 0) return null
        const end = start + entry.term.length
        return {
          id: fieldIdOf('bodyPart', entry.label, text),
          category: 'bodyPart' as const,
          label: entry.label,
          value: entry.term,
          confidence: confidenceOf(0.92, `${entry.ruleId}:${entry.term}:${start}`),
          source: 'dictionary' as const,
          ruleId: entry.ruleId,
          evidence: entry.term,
          start,
          end,
        }
      })
      .filter((f): f is ExtractedField => f !== null),
  )
  fields.push(...bodyParts)

  // 2) 字典: 征象 (含极性; 阴性征象置信度略高)
  const findings = dedupeBySpan(
    FINDING_DICT.filter((entry) => text.includes(entry.term)).map((entry): ExtractedField => {
      const start = text.indexOf(entry.term)
      const end = start + entry.term.length
      return {
        id: fieldIdOf('finding', entry.label, text),
        category: 'finding' as const,
        label: entry.label,
        value: entry.label,
        confidence: confidenceOf(entry.polarity === 'negative' ? 0.94 : 0.9, `${entry.ruleId}:${entry.term}:${start}`),
        source: 'dictionary' as const,
        ruleId: entry.ruleId,
        evidence: entry.term,
        start,
        end,
      }
    }),
  )
  fields.push(...findings)

  // 3) 规则: 测量值 / 对比 / 结论
  for (const rule of FIELD_RULES) {
    fields.push(...matchAll(text, rule, rule.category))
  }

  // 4) 按出现位置排序 + 去重 (同类别同值仅保留置信度最高一条)
  const uniqueByCategoryValue = new Map<string, ExtractedField>()
  for (const f of dedupeBySpan(fields).sort((a, b) => a.start - b.start)) {
    const key = `${f.category}:${f.value}`
    const existing = uniqueByCategoryValue.get(key)
    if (!existing || f.confidence > existing.confidence) uniqueByCategoryValue.set(key, f)
  }
  const finalFields = [...uniqueByCategoryValue.values()].sort((a, b) => a.start - b.start)
  const categoriesFound: FieldCategory[] = []
  for (const f of finalFields) {
    if (!categoriesFound.includes(f.category)) categoriesFound.push(f.category)
  }
  const overallConfidence =
    finalFields.length === 0 ? 0 : Math.round((finalFields.reduce((s, f) => s + f.confidence, 0) / finalFields.length) * 1000) / 1000

  return {
    fields: finalFields,
    categoriesFound,
    overallConfidence,
    modelVersion: MODEL_VERSION,
  }
}
