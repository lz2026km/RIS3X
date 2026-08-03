/**
 * G005 放射RIS系统 v3.0.6.11-61 — 环境式 AI 报告模板库
 * 对标 Philips Ambient Reporting / Siemens 结构化报告
 *
 * 按模态+部位的真实结构化模板 (10+),每模板:
 *   technique    检查技术
 *   findings     影像所见 3-5 段 (句号分隔, 便于 style 裁剪)
 *   conclusions  影像诊断 2-3 条
 *   recommendation 建议
 *
 * style: concise(仅保留每段首句+首条结论) / standard(完整模板) / detailed(完整+补充描述)
 */
import { z } from 'zod'

export const ReportStyleSchema = z.enum(['concise', 'standard', 'detailed']).default('standard')
export type ReportStyle = z.infer<typeof ReportStyleSchema>

export interface ReportTemplate {
  key: string
  modality: string
  bodyPart: string
  technique: string
  /** 影像所见段落 (每段含完整句, 句号/分号分隔) */
  findings: string[]
  /** 影像诊断条目 */
  conclusions: string[]
  recommendation: string
}

export const REPORT_TEMPLATES: ReportTemplate[] = [
  // ==================== CT ====================
  {
    key: 'ct-head',
    modality: 'CT',
    bodyPart: '头颅',
    technique: '头颅CT平扫',
    findings: [
      '双侧大脑半球对称，脑实质内未见明显异常密度影，灰白质分界清晰。',
      '脑室、脑池及脑沟形态、大小正常，未见明显占位效应。',
      '中线结构居中，颅骨骨质未见明显异常。',
    ],
    conclusions: ['头颅CT平扫未见明显异常。', '建议结合临床随访观察。'],
    recommendation: '如症状持续或加重，建议复查头颅CT或进一步行头颅MRI检查。',
  },
  {
    key: 'ct-chest',
    modality: 'CT',
    bodyPart: '胸部',
    technique: '胸部CT平扫',
    findings: [
      '双肺纹理清晰，走行自然，肺野透亮度正常，未见明显异常密度影。',
      '气管及双侧主支气管通畅，管壁未见明显增厚，未见狭窄或阻塞征象。',
      '双侧肺门及纵隔未见明显肿大淋巴结影。',
      '心脏及大血管形态未见明显异常，双侧胸膜未见增厚，胸腔未见积液。',
    ],
    conclusions: ['胸部CT平扫未见明显异常。', '所见符合正常胸部CT表现。'],
    recommendation: '建议每 1-2 年常规体检复查胸部CT。',
  },
  {
    key: 'ct-abdomen',
    modality: 'CT',
    bodyPart: '腹部',
    technique: '腹部CT平扫',
    findings: [
      '肝脏大小、形态正常，实质密度均匀，未见明显占位性病变。',
      '胆囊不大，壁不厚，囊内未见明显异常密度影；胰腺大小形态正常，未见异常密度灶。',
      '脾脏、双肾大小形态正常，实质密度均匀，未见明显结石及占位。',
      '腹腔及腹膜后未见明显肿大淋巴结，腹腔未见积液。',
    ],
    conclusions: ['腹部CT平扫未见明显异常。', '所见符合正常腹部CT表现。'],
    recommendation: '建议结合临床症状及实验室检查综合评估。',
  },
  {
    key: 'ct-spine',
    modality: 'CT',
    bodyPart: '脊柱',
    technique: '脊柱CT平扫',
    findings: [
      '椎体序列整齐，生理曲度存在，各椎体骨质结构完整，未见明显骨质破坏及骨折征象。',
      '椎间盘未见明显突出及膨出，硬膜囊受压不明显。',
      '椎管形态正常，未见明显狭窄，椎旁软组织未见明显异常。',
    ],
    conclusions: ['脊柱CT平扫未见明显异常。', '所见符合正常脊柱CT表现。'],
    recommendation: '如有持续腰背痛症状，建议进一步行脊柱MRI检查。',
  },
  // ==================== MR ====================
  {
    key: 'mr-head',
    modality: 'MR',
    bodyPart: '头颅',
    technique: '头颅MRI平扫 (T1WI/T2WI/FLAIR/DWI)',
    findings: [
      '双侧大脑半球对称，脑灰白质信号正常，未见明显异常信号影。',
      '脑室、脑池、脑沟形态及信号未见明显异常，中线结构居中。',
      'DWI未见明显弥散受限，MRA未见明显血管异常。',
      '颅底结构及小脑扁桃体位置正常，脑干信号未见明显异常。',
    ],
    conclusions: ['头颅MRI平扫未见明显异常。', '所见符合正常头颅MRI表现。'],
    recommendation: '如有新发神经症状，建议复查并咨询神经内科。',
  },
  {
    key: 'mr-spine',
    modality: 'MR',
    bodyPart: '脊柱',
    technique: '脊柱MRI平扫 (矢状位T1WI/T2WI)',
    findings: [
      '各椎体形态、信号未见明显异常，椎间隙无明显变窄。',
      '脊髓走行连续，信号均匀，未见明显占位及受压改变。',
      '椎间盘信号正常，未见明显突出，硬膜囊及神经根未见明显受压。',
    ],
    conclusions: ['脊柱MRI平扫未见明显异常。', '所见符合正常脊柱MRI表现。'],
    recommendation: '建议结合临床体征随访观察。',
  },
  {
    key: 'mr-joint',
    modality: 'MR',
    bodyPart: '关节',
    technique: '关节MRI平扫 (矢状位/冠状位/轴位)',
    findings: [
      '关节间隙未见明显变窄，关节面软骨形态信号正常。',
      '关节腔及滑囊未见明显积液，周围软组织未见明显肿胀及异常信号。',
      '韧带及肌腱结构完整，信号未见明显异常。',
    ],
    conclusions: ['关节MRI平扫未见明显异常。', '所见符合正常关节MRI表现。'],
    recommendation: '建议减少负重活动，定期随访。',
  },
  // ==================== DR ====================
  {
    key: 'dr-chest',
    modality: 'DR',
    bodyPart: '胸部',
    technique: '胸部正位片',
    findings: [
      '双肺野透亮度正常，肺纹理清晰，未见明显实变、结节及肿块影。',
      '心影大小、形态正常，主动脉未见明显增宽。',
      '双侧肋膈角锐利，膈面光滑，胸廓骨质结构完整。',
    ],
    conclusions: ['胸部X线片未见明显异常。', '所见符合正常胸部X线表现。'],
    recommendation: '建议定期健康体检。',
  },
  {
    key: 'dr-limb',
    modality: 'DR',
    bodyPart: '四肢',
    technique: '四肢正侧位片',
    findings: [
      '骨皮质连续完整，骨小梁结构清晰，未见明显骨折线及骨质破坏。',
      '关节面光滑，关节间隙未见明显变窄，未见脱位及半脱位征象。',
      '周围软组织未见明显肿胀及异常钙化影。',
    ],
    conclusions: ['四肢X线片未见明显骨折及脱位。', '所见符合正常X线表现。'],
    recommendation: '如局部持续疼痛，建议休息并复查。',
  },
  {
    key: 'dr-spine',
    modality: 'DR',
    bodyPart: '脊柱',
    technique: '脊柱正侧位片',
    findings: [
      '脊柱生理曲度存在，各椎体骨质结构完整，未见明显压缩性骨折。',
      '椎间隙未见明显变窄，椎旁软组织未见明显异常。',
    ],
    conclusions: ['脊柱X线片未见明显异常。', '所见符合正常脊柱X线表现。'],
    recommendation: '如有不适建议结合MRI进一步检查。',
  },
  // ==================== US ====================
  {
    key: 'us-abdomen',
    modality: 'US',
    bodyPart: '腹部',
    technique: '腹部超声 (肝胆胰脾)',
    findings: [
      '肝脏大小、形态正常，实质回声均匀，肝内血管走行清晰，未见明显占位。',
      '胆囊大小正常，壁不厚，囊内透声好，未见明显结石及息肉。',
      '胰腺大小、形态及回声未见明显异常。',
      '脾脏大小正常，实质回声均匀；双肾大小形态正常，实质回声未见明显异常。',
    ],
    conclusions: ['腹部超声未见明显异常。', '所见符合正常腹部超声表现。'],
    recommendation: '建议定期复查，注意饮食与生活规律。',
  },
  {
    key: 'us-breast',
    modality: 'US',
    bodyPart: '乳腺',
    technique: '乳腺超声检查 (双乳+腋窝)',
    findings: [
      '双侧乳腺腺体结构清晰，未见明显占位性病变。',
      '双侧乳腺导管未见明显扩张，未见异常血流信号。',
      '双侧腋窝未见明显肿大淋巴结。',
    ],
    conclusions: ['双侧乳腺超声未见明显异常 (BI-RADS 1类)。', '所见符合正常乳腺超声表现。'],
    recommendation: '建议定期乳腺超声筛查，结合临床触诊。',
  },
  {
    key: 'us-thyroid',
    modality: 'US',
    bodyPart: '甲状腺',
    technique: '甲状腺超声检查',
    findings: [
      '甲状腺大小、形态正常，包膜完整，实质回声均匀。',
      '双侧叶内未见明显结节及囊性占位，未见明显异常血流信号。',
      '颈部未见明显肿大淋巴结。',
    ],
    conclusions: ['甲状腺超声未见明显异常 (TI-RADS 1类)。', '所见符合正常甲状腺超声表现。'],
    recommendation: '建议定期复查，并检查甲状腺功能。',
  },
  {
    key: 'us-kidney',
    modality: 'US',
    bodyPart: '泌尿系',
    technique: '泌尿系超声检查 (双肾/输尿管/膀胱)',
    findings: [
      '双肾大小、形态正常，皮质回声未见明显异常，肾盂肾盏未见明显分离。',
      '双侧输尿管未见明显扩张，膀胱充盈良好，壁光滑，腔内未见明显异常回声。',
      '前列腺/子宫形态未见明显异常。',
    ],
    conclusions: ['泌尿系超声未见明显异常。', '所见符合正常泌尿系超声表现。'],
    recommendation: '建议多饮水，定期复查。',
  },
]

/** 按模态+部位模糊匹配模板 (支持 部位包含匹配, 如 '胸部正位' → '胸部') */
export function findReportTemplate(modality: string, bodyPart: string): ReportTemplate {
  const mod = (modality || '').toUpperCase()
  const part = (bodyPart || '').trim()
  const exact =
    REPORT_TEMPLATES.find((t) => t.modality === mod && part && (t.bodyPart === part || part.includes(t.bodyPart) || t.bodyPart.includes(part))) ??
    REPORT_TEMPLATES.find((t) => t.modality === mod)
  if (exact) return exact
  return REPORT_TEMPLATES[0] ?? {
    key: 'generic',
    modality: mod,
    bodyPart: part,
    technique: `${mod} ${part}检查`,
    findings: [`${part} 未见明显异常。`],
    conclusions: ['未见明确异常。'],
    recommendation: '定期随访。',
  }
}

/** 按句号/分号切句 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[。；;])/)
    .map((s) => s.trim())
    .filter(Boolean)
}

/** style 裁剪: concise 每段仅首句, detailed 追加补充描述 */
function trimParagraph(text: string, style: ReportStyle): string {
  if (style === 'concise') {
    const first = splitSentences(text)[0] ?? text
    return first.endsWith('。') ? first : `${first}。`
  }
  return text
}

const DETAILED_ADDON =
  '本次检查各序列图像质量良好，可满足诊断要求，所见以上述描述为准，建议结合临床病史综合评估。'

export interface DraftSection {
  heading: string
  content: string
}

export interface BuildDraftInput {
  modality: string
  bodyPart: string
  clinicalInfo?: string
  /** 发现关键词, 如 '右肺上叶结节影' */
  findings?: string
  keywords?: string[]
  style?: ReportStyle
}

export interface BuiltDraft {
  sections: DraftSection[]
  findingsText: string
  conclusionText: string
  recommendation: string
}

/**
 * NLG 骨架: 以模板为骨架, 用 临床信息/发现关键词 填充
 * 返回段落式草稿文本 (与 reports 表字段映射: findings/impression/recommendations/conclusion)
 */
export function buildReportDraft(input: BuildDraftInput): BuiltDraft {
  const style: ReportStyle = input.style ?? 'standard'
  const tpl = findReportTemplate(input.modality, input.bodyPart)
  const findingsKeywords = (input.findings ?? '').trim()
  const keywords = (input.keywords ?? []).filter(Boolean)

  const sections: DraftSection[] = []
  sections.push({ heading: '检查技术', content: tpl.technique })

  if (input.clinicalInfo?.trim()) {
    sections.push({ heading: '临床信息', content: input.clinicalInfo.trim() })
  }

  // 影像所见: 关键词驱动段落 + 模板段落
  const findings: string[] = []
  if (findingsKeywords || keywords.length) {
    const kwText = findingsKeywords || keywords.join('、')
    findings.push(`${tpl.bodyPart}检查显示${kwText}${findingsKeywords.endsWith('。') ? '' : '。'}`)
  }
  for (const para of tpl.findings) findings.push(trimParagraph(para, style))
  if (style === 'detailed') findings.push(DETAILED_ADDON)
  sections.push({ heading: '影像所见', content: findings.join('\n') })

  // 影像诊断: 结论条目 (编号)
  const conclusions: string[] = []
  const conclusionPool = style === 'concise' ? tpl.conclusions.slice(0, 1) : tpl.conclusions
  if (findingsKeywords && conclusions.length === 0) {
    conclusions.push(`${findingsKeywords}，请结合临床进一步评估。`)
  }
  conclusions.push(...conclusionPool)
  sections.push({ heading: '影像诊断', content: conclusions.map((c, i) => `${i + 1}. ${c}`).join('\n') })

  // 建议
  sections.push({ heading: '建议', content: style === 'concise' ? '定期随访。' : tpl.recommendation })

  return {
    sections,
    findingsText: findings.join('\n'),
    conclusionText: conclusions.map((c, i) => `${i + 1}. ${c}`).join('\n'),
    recommendation: style === 'concise' ? '定期随访。' : tpl.recommendation,
  }
}

/** 将 BuiltDraft 序列化为可解析的草稿文本 (接受/修改后落 reports 表时按段解析) */
export function serializeDraft(sections: DraftSection[]): string {
  return sections.map((s) => `【${s.heading}】\n${s.content}`).join('\n\n')
}

const KNOWN_HEADINGS = ['检查技术', '临床信息', '影像所见', '影像诊断', '建议']

/** 解析草稿文本为段落 */
export function parseDraftText(draftText: string): DraftSection[] {
  const sections: DraftSection[] = []
  let current: DraftSection | null = null
  for (const rawLine of draftText.split(/\n+/)) {
    const line = rawLine.trim()
    if (!line) continue
    const match = /^【(.+?)】\s*$/.exec(line)
    if (match) {
      const heading = KNOWN_HEADINGS.includes(match[1]!) ? match[1]! : '其他'
      current = { heading, content: '' }
      sections.push(current)
    } else if (current) {
      current.content = current.content ? `${current.content}\n${line}` : line
    }
  }
  return sections
}

/** 从段落中提取 reports 表字段 */
export function extractReportFields(sections: DraftSection[]): {
  findings: string
  impression: string
  recommendations: string
  conclusion: string
} {
  const get = (heading: string) => sections.find((s) => s.heading === heading)?.content ?? ''
  const findings = get('影像所见')
  const impression = get('影像诊断')
  return {
    findings,
    impression,
    recommendations: get('建议'),
    conclusion: impression,
  }
}
