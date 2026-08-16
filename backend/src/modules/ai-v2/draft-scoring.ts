/**
 * G005 RIS v3.0.6.11-101 Wave 3C - AI 增强 (报告草稿评分)
 * 确定性评分规则: 长度充分性 / 结构化字段完整度 / 术语规范 / 数值单位完整
 * 0-100 分, 附带逐维度得分与改进建议。全部为纯函数, 无随机。
 */

export interface ScoreDimensionResult {
  key: string
  label: string
  weight: number
  /** 0-100 */
  score: number
}

export interface ScoreSuggestion {
  code: string
  level: 'error' | 'warning' | 'info'
  message: string
}

export interface DraftInputStats {
  charCount: number
  sectionCount: number
  numericCount: number
  unitCoverage: number
  informalTerms: string[]
  missingSections: string[]
  missingStandardTerms: string[]
  unnumberedValues: number
}

/** 报告必需结构化字段 (命中任一别名即视为存在) */
export const SECTION_GROUPS: { key: string; label: string; aliases: string[] }[] = [
  { key: 'technique', label: '检查技术', aliases: ['检查技术', '扫描技术', '检查方法'] },
  { key: 'findings', label: '影像所见', aliases: ['影像所见', '影像表现', '所见', '表现'] },
  { key: 'impression', label: '诊断意见', aliases: ['诊断意见', '诊断结论', '印象', '意见'] },
]

/** 术语规范: 口语化/非规范词 (命中即扣分) */
export const INFORMAL_TERMS = [
  '还可以', '差不多', '好像', '大概', '挺正常', '有点', '不太像', '说不清', '怪怪的', '好像没事',
  '可能可能', '正常正常', '未见未见',
]

/** 数值单位白名单: 数字后 4 字符内命中即视为带单位 */
export const UNIT_PATTERNS = [
  'mm', 'cm', 'mL', 'ml', 'L', 'HU', 'hU', 'hu', '%', 'g', 'mg', 's', '分', '秒', '月', '周',
  '年', '倍', '级', '期', '度', '×', 'x', '层',
]

/** 各模态标准术语 (缺全省略, 命中越多越好; 全缺扣分) */
export const MODALITY_STANDARD_TERMS: Record<string, string[]> = {
  CT: ['密度影', '未见异常', '增强扫描', '平扫', '窗宽'],
  MR: ['信号影', '未见异常', 'T1', 'T2', 'FLAIR', '增强'],
  DR: ['骨质', '未见异常', '正侧位', '骨折'],
  US: ['回声', '未见异常', '实质', '血流'],
  MG: ['乳腺', 'BI-RADS', '钙化', '结构'],
}

export const DEFAULT_STANDARD_TERMS = ['未见异常', '影像所见', '诊断意见']

const UNIT_RE = /^(?:mm|cm|mL|ml|L|HU|hU|hu|%|g|mg|s|分|秒|月|周|年|倍|级|期|度|×|x|层)/i

const NUM_RE = /\d+(?:\.\d+)?/g

export interface DraftScoreRules {
  /** 长度目标 (字符) */
  lengthTarget: number
  weights: { length: number; structure: number; terminology: number; units: number }
}

export const DRAFT_SCORE_RULES: DraftScoreRules = {
  lengthTarget: 120,
  weights: { length: 0.15, structure: 0.25, terminology: 0.3, units: 0.3 },
}

export function analyzeDraftText(draftText: string, modality?: string): DraftInputStats {
  const text = draftText ?? ''
  const charCount = text.trim().length
  const foundSections = SECTION_GROUPS.filter((g) =>
    g.aliases.some((a) => text.includes(a)),
  )
  const missingSections = SECTION_GROUPS.filter(
    (g) => !g.aliases.some((a) => text.includes(a)),
  ).map((g) => g.label)
  const informalTerms = INFORMAL_TERMS.filter((t) => text.includes(t))

  const standardTerms = MODALITY_STANDARD_TERMS[modality?.toUpperCase() ?? ''] ?? DEFAULT_STANDARD_TERMS
  const missingStandardTerms = standardTerms.filter((t) => !text.includes(t))

  const numbers = Array.from(text.matchAll(NUM_RE)).map((m) => m.index ?? 0)
  let withUnit = 0
  for (const idx of numbers) {
    const tail = text.slice(idx, idx + 6).replace(/^\d+(?:\.\d+)?/, '')
    const stripped = tail.replace(/^\s*[个±]?\s*/, '')
    if (UNIT_RE.test(stripped)) withUnit += 1
  }
  const unitCoverage = numbers.length > 0 ? withUnit / numbers.length : 1
  const sectionCount = foundSections.length
  return {
    charCount,
    sectionCount,
    numericCount: numbers.length,
    unitCoverage: Math.round(unitCoverage * 100) / 100,
    informalTerms,
    missingSections,
    missingStandardTerms,
    unnumberedValues: numbers.length - withUnit,
  }
}

function clampScore(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)))
}

/**
 * 四维评分 (确定性):
 * - length:      charCount/lengthTarget 线性, 超出即满分
 * - structure:   3 个必需字段各 1/3
 * - terminology: 100 - 口语化词×15 - 缺标准术语×8 (下限 0)
 * - units:       numericCount==0 → 50 (提示补充量化), 否则 = unitCoverage×100
 */
export function scoreDraftText(draftText: string, modality?: string): {
  dimensions: ScoreDimensionResult[]
  total: number
  grade: '优' | '良' | '中' | '差'
  stats: DraftInputStats
  suggestions: ScoreSuggestion[]
} {
  const w = DRAFT_SCORE_RULES.weights
  const text = draftText ?? ''
  const stats = analyzeDraftText(text, modality)
  const suggestions: ScoreSuggestion[] = []

  if (stats.charCount === 0) {
    suggestions.push({
      code: 'EMPTY_DRAFT',
      level: 'error',
      message: '报告为空: 请填写报告正文后再评分',
    })
    return {
      dimensions: [
        { key: 'length', label: '长度充分性', weight: w.length, score: 0 },
        { key: 'structure', label: '结构化完整度', weight: w.structure, score: 0 },
        { key: 'terminology', label: '术语规范', weight: w.terminology, score: 0 },
        { key: 'units', label: '数值单位完整', weight: w.units, score: 0 },
      ],
      total: 0,
      grade: '差',
      stats,
      suggestions,
    }
  }

  // ── 1. 长度 ──
  const lengthScore = clampScore((stats.charCount / DRAFT_SCORE_RULES.lengthTarget) * 100)
  if (stats.charCount < 80) {
    suggestions.push({
      code: 'LENGTH_TOO_SHORT',
      level: stats.charCount < 40 ? 'error' : 'warning',
      message: `正文仅 ${stats.charCount} 字, 建议补充至 ${DRAFT_SCORE_RULES.lengthTarget} 字以上 (技术/所见/意见各成段)`,
    })
  } else if (stats.charCount < DRAFT_SCORE_RULES.lengthTarget) {
    suggestions.push({
      code: 'LENGTH_NEAR_TARGET',
      level: 'info',
      message: `正文 ${stats.charCount} 字, 已达基本要求, 可进一步补充细节`,
    })
  }

  // ── 2. 结构 ──
  const structureScore = clampScore((stats.sectionCount / SECTION_GROUPS.length) * 100)
  for (const label of stats.missingSections) {
    suggestions.push({
      code: 'MISSING_SECTION',
      level: 'error',
      message: `缺少结构化字段「${label}」: 建议按 检查技术/影像所见/诊断意见 分段书写`,
    })
  }

  // ── 3. 术语 ──
  let terminologyScore = 100
  for (const t of stats.informalTerms) {
    terminologyScore -= 15
    suggestions.push({
      code: 'INFORMAL_TERM',
      level: 'error',
      message: `术语不规范: 出现口语化表述「${t}」, 建议改用规范放射术语`,
    })
  }
  for (const t of stats.missingStandardTerms) {
    terminologyScore -= 8
  }
  if (stats.missingStandardTerms.length > 0) {
    suggestions.push({
      code: 'STANDARD_TERMS_PARTIAL',
      level: 'warning',
      message: `建议补充标准术语: ${stats.missingStandardTerms.join('、')}`,
    })
  }
  terminologyScore = clampScore(terminologyScore)

  // ── 4. 数值单位 ──
  let unitsScore: number
  if (stats.numericCount === 0) {
    unitsScore = 50
    suggestions.push({
      code: 'NO_NUMERIC_VALUE',
      level: 'info',
      message: '未检出任何测量数值, 建议补充病灶大小/器官容积等量化描述 (如 5mm、12.3mL、HU 值)',
    })
  } else {
    unitsScore = clampScore(stats.unitCoverage * 100)
    if (stats.unnumberedValues > 0) {
      suggestions.push({
        code: 'UNIT_MISSING',
        level: 'warning',
        message: `${stats.unnumberedValues} 处数值缺少单位: 每个测量值必须附带单位 (mm/cm/mL/HU/% 等)`,
      })
    }
  }

  const dimensions: ScoreDimensionResult[] = [
    { key: 'length', label: '长度充分性', weight: w.length, score: lengthScore },
    { key: 'structure', label: '结构化完整度', weight: w.structure, score: structureScore },
    { key: 'terminology', label: '术语规范', weight: w.terminology, score: terminologyScore },
    { key: 'units', label: '数值单位完整', weight: w.units, score: unitsScore },
  ]
  const total = clampScore(
    dimensions.reduce((s, d) => s + d.score * d.weight, 0),
  )
  const grade: '优' | '良' | '中' | '差' = total >= 90 ? '优' : total >= 75 ? '良' : total >= 60 ? '中' : '差'
  return { dimensions, total, grade, stats, suggestions }
}
