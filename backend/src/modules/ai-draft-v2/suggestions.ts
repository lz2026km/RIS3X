/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 (F1): 修改建议引擎
 * 对已有报告逐段给出改进建议 (确定性规则, 无 LLM)。
 * 每条建议: 段落定位 + 严重级别 + 规则 ID + 置信度 + 可选建议文本。
 */
import { floatInRange } from '../../common/utils/deterministic-hash'

export interface ReportParagraphInput {
  heading: string
  content: string
}

export interface DraftSuggestion {
  /** 可追溯 ID */
  id: string
  paragraphIndex: number
  paragraphHeading: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  /** 可选: 建议替换文本 */
  suggestedText?: string
  ruleId: string
  confidence: number
}

export interface SuggestRequest {
  paragraphs: ReportParagraphInput[]
  modality?: string
  bodyPart?: string
}

export interface SuggestResult {
  suggestions: DraftSuggestion[]
  /** 报告完善度 0-100 */
  overallScore: number
  modelVersion: string
  generatedAt: Date
}

const POSITIVE_FINDING_TERMS = ['结节', '肿块', '磨玻璃', '实变', '占位', '积液', '骨折', '破坏', '钙化', '结石', '梗死', '出血', '狭窄', '囊肿', '肿大', '强化', '毛刺', '分叶', '牵拉']
const HEDGE_TERMS = ['不除外', '可能', '待排', '考虑', '倾向', '可疑']
const REQUIRED_SECTIONS: { heading: string; aliases: string[]; severity: DraftSuggestion['severity'] }[] = [
  { heading: '影像所见', aliases: ['所见', '影像表现'], severity: 'warning' },
  { heading: '诊断意见', aliases: ['诊断', '意见', '结论', '影像诊断'], severity: 'critical' },
]

export const SUGGEST_MODEL_VERSION = 'ai-assistant-v2.0.0'

function suggestionId(seed: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return `sug-${(h >>> 0).toString(16).slice(0, 10)}`
}

function confidenceOf(ruleId: string, seed: string): number {
  return floatInRange(`${ruleId}:${seed}`, 0.86, 0.95, 1, 2)
}

function findParagraphIndex(paragraphs: ReportParagraphInput[], aliases: string[]): number {
  return paragraphs.findIndex((p) => aliases.some((a) => (p.heading ?? '').includes(a)))
}

function joinedText(paragraphs: ReportParagraphInput[]): string {
  return paragraphs.map((p) => `${p.heading}${p.content}`).join('')
}

/** 纯确定性建议生成 (无 DB 依赖, 孤儿路径) */
export function buildSuggestions(req: SuggestRequest): Omit<SuggestResult, 'generatedAt'> {
  const paragraphs: ReportParagraphInput[] = Array.isArray(req.paragraphs) ? req.paragraphs : []
  const suggestions: DraftSuggestion[] = []
  const text = joinedText(paragraphs)
  const seed = `${req.modality ?? ''}:${req.bodyPart ?? ''}:${text.length}:${text.charCodeAt(0) ?? 0}`

  const push = (s: Omit<DraftSuggestion, 'id' | 'confidence'>) => {
    suggestions.push({
      ...s,
      id: suggestionId(`${s.ruleId}:${s.paragraphIndex}:${seed}`),
      confidence: confidenceOf(s.ruleId, `${s.paragraphIndex}:${seed}`),
    })
  }

  if (paragraphs.length === 0) {
    push({
      paragraphIndex: 0,
      paragraphHeading: '(整篇)',
      severity: 'critical',
      title: '报告内容为空',
      description: '未检测到任何段落内容，请先填写影像所见与诊断意见后再提交。',
      ruleId: 'suggest:empty-report',
    })
    return { suggestions, overallScore: 0, modelVersion: SUGGEST_MODEL_VERSION }
  }

  // 1) 必需段落缺失
  for (const section of REQUIRED_SECTIONS) {
    if (findParagraphIndex(paragraphs, section.aliases) < 0) {
      push({
        paragraphIndex: -1,
        paragraphHeading: '(缺失)',
        severity: section.severity,
        title: `缺少「${section.heading}」段落`,
        description: `报告应包含${section.heading}，请补充完整后再提交。`,
        ruleId: `suggest:missing-${section.heading}`,
      })
    }
  }

  const findingsIdx = findParagraphIndex(paragraphs, ['影像所见', '所见', '影像表现'])
  const conclusionIdx = findParagraphIndex(paragraphs, ['诊断意见', '诊断', '意见', '结论', '影像诊断'])
  const findingsText = findingsIdx >= 0 ? paragraphs[findingsIdx]!.content : ''
  const conclusionText = conclusionIdx >= 0 ? paragraphs[conclusionIdx]!.content : ''
  const hasPositive = POSITIVE_FINDING_TERMS.some((t) => text.includes(t))
  const hasNegativeStatement = /未见(明显)?(异常|肿大|骨折|钙化|破坏)/.test(text)
  const hasRecommendation = /(建议|随访|复查|随诊|密切观察)/.test(text)

  // 2) 所见阳性 vs 结论阴性 冲突
  if (findingsIdx >= 0 && conclusionIdx >= 0 && hasPositive && /未见明显异常/.test(conclusionText)) {
    push({
      paragraphIndex: conclusionIdx,
      paragraphHeading: paragraphs[conclusionIdx]!.heading,
      severity: 'critical',
      title: '影像所见与诊断意见不一致',
      description: '影像所见中描述阳性征象，但诊断意见写为"未见明显异常"，请核对并修正。',
      suggestedText: '请结合所见阳性征象重写诊断意见（如"所见符合…，建议…"）。',
      ruleId: 'suggest:impression-conflict',
    })
  }

  // 3) 全部阴性但结论含糊 (使用了不确定性措辞)
  if (findingsIdx >= 0 && conclusionIdx >= 0 && !hasPositive && HEDGE_TERMS.some((t) => conclusionText.includes(t))) {
    push({
      paragraphIndex: conclusionIdx,
      paragraphHeading: paragraphs[conclusionIdx]!.heading,
      severity: 'info',
      title: '阴性所见使用不确定措辞',
      description: '影像所见均为阴性描述，诊断意见中不建议使用"可能/待排"等不确定性措辞。',
      suggestedText: '未见明显异常，建议结合临床随访观察。',
      ruleId: 'suggest:negative-hedge',
    })
  }

  // 4) 阳性征象缺随访建议
  if (hasPositive && !hasRecommendation) {
    push({
      paragraphIndex: paragraphs.length - 1,
      paragraphHeading: paragraphs[paragraphs.length - 1]!.heading,
      severity: 'warning',
      title: '阳性征象缺少随访建议',
      description: '检测到阳性征象描述，建议在报告末尾补充随访或复查建议。',
      suggestedText: '建议定期随访复查，必要时进一步检查明确。',
      ruleId: 'suggest:no-recommendation',
    })
  }

  // 5) 结论不确定措辞过多
  if (conclusionIdx >= 0) {
    const hedgeCount = HEDGE_TERMS.filter((t) => conclusionText.includes(t)).length
    if (hedgeCount >= 2) {
      push({
        paragraphIndex: conclusionIdx,
        paragraphHeading: paragraphs[conclusionIdx]!.heading,
        severity: 'warning',
        title: '诊断意见存在多重不确定性措辞',
        description: `诊断意见中出现 ${hedgeCount} 处不确定性措辞（不除外/可能/待排等），请明确诊断倾向。`,
        suggestedText: '请优先给出明确诊断；无法明确时建议注明"建议随访观察"。',
        ruleId: 'suggest:hedge-overuse',
      })
    }
  }

  // 6) 测量值检查
  const measurementWithoutUnit = /[0-9]+(?:\.[0-9]+)?(?!\s*(?:mm|cm|HU|mL|ml|cm³|°|度|mm²))/.test(text)
  const measurementPresent = /[0-9]+(?:\.[0-9]+)?\s*(?:mm|cm|HU|mL|ml|cm³|mm²)/.test(text)
  if (measurementPresent && conclusionIdx >= 0 && !/[0-9]/.test(conclusionText)) {
    push({
      paragraphIndex: conclusionIdx,
      paragraphHeading: paragraphs[conclusionIdx]!.heading,
      severity: 'info',
      title: '测量值未在诊断意见中体现',
      description: '影像所见含测量数据，建议在诊断意见中注明关键测量值以支持结论。',
      suggestedText: '请在诊断意见中补充关键病灶测量值（尺寸/密度等）。',
      ruleId: 'suggest:measurement-not-in-impression',
    })
  }
  if (measurementWithoutUnit && findingsIdx >= 0) {
    push({
      paragraphIndex: findingsIdx,
      paragraphHeading: paragraphs[findingsIdx]!.heading,
      severity: 'warning',
      title: '存在无单位的数值',
      description: '检测到缺少单位（mm/cm/HU 等）的数值，请补充测量单位保证报告规范性。',
      ruleId: 'suggest:measurement-no-unit',
    })
  }

  // 7) 段落长度
  paragraphs.forEach((p, i) => {
    const len = (p.content ?? '').trim().length
    if (len === 0) {
      push({
        paragraphIndex: i,
        paragraphHeading: p.heading,
        severity: 'warning',
        title: '段落内容为空',
        description: `「${p.heading}」段落为空，请填写内容。`,
        ruleId: 'suggest:empty-paragraph',
      })
    } else if (len > 400) {
      push({
        paragraphIndex: i,
        paragraphHeading: p.heading,
        severity: 'info',
        title: '段落过长',
        description: `「${p.heading}」段落共 ${len} 字，建议拆分为多条短句以便阅读。`,
        ruleId: 'suggest:paragraph-too-long',
      })
    } else if (len < 10 && i === findingsIdx) {
      push({
        paragraphIndex: i,
        paragraphHeading: p.heading,
        severity: 'info',
        title: '影像所见描述过简',
        description: '影像所见过短，建议补充部位、形态、密度/信号及与邻近结构关系。',
        ruleId: 'suggest:findings-too-short',
      })
    }
  })

  // 8) 检查技术细节 (CT/MR 应注明扫描方式)
  const modality = (req.modality ?? '').toUpperCase()
  const techniqueIdx = findParagraphIndex(paragraphs, ['检查技术', '技术', '扫描方式'])
  if ((modality === 'CT' || modality === 'MR') && techniqueIdx >= 0) {
    const tech = paragraphs[techniqueIdx]!.content
    if (!/(平扫|增强|T1WI|T2WI|FLAIR)/.test(tech)) {
      push({
        paragraphIndex: techniqueIdx,
        paragraphHeading: paragraphs[techniqueIdx]!.heading,
        severity: 'info',
        title: '检查技术描述不完整',
        description: `${modality} 检查建议注明扫描方式（平扫/增强）或序列（T1WI/T2WI 等）。`,
        ruleId: 'suggest:technique-detail',
      })
    }
  }

  // 9) 阴性描述与结论冲突 (所见全阴性但结论阳性)
  if (findingsIdx >= 0 && conclusionIdx >= 0 && hasNegativeStatement && !hasPositive && /(考虑|提示|诊断|符合)/.test(conclusionText)) {
    push({
      paragraphIndex: conclusionIdx,
      paragraphHeading: paragraphs[conclusionIdx]!.heading,
      severity: 'warning',
      title: '阴性所见与阳性结论不一致',
      description: '影像所见均为阴性描述，但诊断意见使用阳性诊断措辞，请核对逻辑一致性。',
      ruleId: 'suggest:negative-findings-positive-conclusion',
    })
  }

  const score = Math.max(0, 100 - suggestions.reduce((s, su) => s + (su.severity === 'critical' ? 25 : su.severity === 'warning' ? 12 : 5), 0))
  return { suggestions, overallScore: score, modelVersion: SUGGEST_MODEL_VERSION }
}
