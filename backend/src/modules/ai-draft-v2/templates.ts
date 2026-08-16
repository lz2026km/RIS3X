/**
 * G005 RIS v3.0.6.11-101 Wave 7A — AI 报告助理 V2 (F1): 多模态报告模板库
 * 按 检查类型(模态) + 部位 选择模板 → 结构化字段注入 → 完整报告草稿。
 * 模板为纯数据, 同输入恒定; 每条生成内容可溯源到模板条目 (key)。
 */

export interface DraftTemplate {
  key: string
  modality: string
  bodyPart: string
  technique: string
  /** 影像所见句子 (句号结尾) */
  findings: string[]
  /** 影像诊断句子 */
  conclusions: string[]
  recommendation: string
}

export const DRAFT_TEMPLATES_V2: DraftTemplate[] = [
  // ── CT ──────────────────────────────────────────────────────────────────
  {
    key: 'tpl-v2-ct-chest',
    modality: 'CT',
    bodyPart: '胸部',
    technique: '胸部CT平扫+增强扫描',
    findings: [
      '双肺纹理清晰，走行自然，肺野透亮度正常。',
      '气管及双侧主支气管通畅，管壁未见明显增厚。',
      '双侧肺门及纵隔未见明显肿大淋巴结影。',
    ],
    conclusions: ['胸部CT平扫未见明显异常。', '所见符合正常胸部CT表现。'],
    recommendation: '建议每 1-2 年常规体检复查胸部CT。',
  },
  {
    key: 'tpl-v2-ct-head',
    modality: 'CT',
    bodyPart: '头颅',
    technique: '头颅CT平扫',
    findings: [
      '双侧大脑半球对称，脑实质内未见明显异常密度影，灰白质分界清晰。',
      '脑室、脑池及脑沟形态、大小正常，未见明显占位效应。',
      '中线结构居中，颅骨骨质未见明显异常。',
    ],
    conclusions: ['头颅CT平扫未见明显异常。'],
    recommendation: '如症状持续或加重，建议复查头颅CT或进一步行头颅MRI检查。',
  },
  {
    key: 'tpl-v2-ct-abdomen',
    modality: 'CT',
    bodyPart: '腹部',
    technique: '腹部CT平扫+增强扫描',
    findings: [
      '肝脏大小、形态正常，实质密度均匀，未见明显占位性病变。',
      '胆囊不大，壁不厚；胰腺大小形态正常，未见异常密度灶。',
      '脾脏、双肾大小形态正常，腹腔及腹膜后未见明显肿大淋巴结。',
    ],
    conclusions: ['腹部CT平扫未见明显异常。'],
    recommendation: '建议结合临床症状及实验室检查综合评估。',
  },
  {
    key: 'tpl-v2-ct-spine',
    modality: 'CT',
    bodyPart: '脊柱',
    technique: '脊柱CT平扫',
    findings: [
      '椎体序列整齐，生理曲度存在，各椎体骨质结构完整。',
      '椎间盘未见明显突出及膨出，硬膜囊受压不明显。',
      '椎管形态正常，未见明显狭窄，椎旁软组织未见明显异常。',
    ],
    conclusions: ['脊柱CT平扫未见明显异常。'],
    recommendation: '如有持续腰背痛症状，建议进一步行脊柱MRI检查。',
  },
  // ── MR ──────────────────────────────────────────────────────────────────
  {
    key: 'tpl-v2-mr-head',
    modality: 'MR',
    bodyPart: '头颅',
    technique: '头颅MRI平扫 (T1WI/T2WI/FLAIR/DWI)',
    findings: [
      '双侧大脑半球对称，脑灰白质信号正常，未见明显异常信号影。',
      '脑室、脑池、脑沟形态及信号未见明显异常，中线结构居中。',
      'DWI未见明显弥散受限，MRA未见明显血管异常。',
    ],
    conclusions: ['头颅MRI平扫未见明显异常。'],
    recommendation: '如有新发神经症状，建议复查并咨询神经内科。',
  },
  {
    key: 'tpl-v2-mr-spine',
    modality: 'MR',
    bodyPart: '脊柱',
    technique: '脊柱MRI平扫 (矢状位T1WI/T2WI)',
    findings: [
      '各椎体形态、信号未见明显异常，椎间隙无明显变窄。',
      '脊髓走行连续，信号均匀，未见明显占位及受压改变。',
      '椎间盘信号正常，未见明显突出，硬膜囊及神经根未见明显受压。',
    ],
    conclusions: ['脊柱MRI平扫未见明显异常。'],
    recommendation: '建议结合临床体征随访观察。',
  },
  {
    key: 'tpl-v2-mr-joint',
    modality: 'MR',
    bodyPart: '关节',
    technique: '关节MRI平扫 (矢状位/冠状位/轴位)',
    findings: [
      '关节间隙未见明显变窄，关节面软骨形态信号正常。',
      '关节腔及滑囊未见明显积液，周围软组织未见明显肿胀及异常信号。',
      '韧带及肌腱结构完整，信号未见明显异常。',
    ],
    conclusions: ['关节MRI平扫未见明显异常。'],
    recommendation: '建议减少负重活动，定期随访。',
  },
  // ── DR ──────────────────────────────────────────────────────────────────
  {
    key: 'tpl-v2-dr-chest',
    modality: 'DR',
    bodyPart: '胸部',
    technique: '胸部正位片',
    findings: [
      '双肺野透亮度正常，肺纹理清晰，未见明显实变、结节及肿块影。',
      '心影大小、形态正常，主动脉未见明显增宽。',
      '双侧肋膈角锐利，膈面光滑，胸廓骨质结构完整。',
    ],
    conclusions: ['胸部X线片未见明显异常。'],
    recommendation: '建议定期健康体检。',
  },
  {
    key: 'tpl-v2-dr-limb',
    modality: 'DR',
    bodyPart: '四肢',
    technique: '四肢正侧位片',
    findings: [
      '骨皮质连续完整，骨小梁结构清晰，未见明显骨折线及骨质破坏。',
      '关节面光滑，关节间隙未见明显变窄，未见脱位及半脱位征象。',
      '周围软组织未见明显肿胀及异常钙化影。',
    ],
    conclusions: ['四肢X线片未见明显异常。'],
    recommendation: '如有外伤史，建议制动休息并随诊复查。',
  },
  // ── US ──────────────────────────────────────────────────────────────────
  {
    key: 'tpl-v2-us-abdomen',
    modality: 'US',
    bodyPart: '腹部',
    technique: '腹部超声检查',
    findings: [
      '肝脏大小、形态正常，包膜光整，实质回声均匀。',
      '胆囊大小正常，壁不厚，囊内未见明显异常回声；胰腺、脾脏未见明显异常。',
      '双肾大小形态正常，集合系统未见分离，输尿管未见扩张。',
    ],
    conclusions: ['腹部超声未见明显异常。'],
    recommendation: '建议结合临床定期复查。',
  },
  {
    key: 'tpl-v2-us-thyroid',
    modality: 'US',
    bodyPart: '甲状腺',
    technique: '甲状腺超声检查',
    findings: [
      '甲状腺大小、形态正常，包膜光整，实质回声均匀。',
      '甲状腺实质内未见明显结节及异常回声，血流信号未见明显异常。',
      '双侧颈部未见明显肿大淋巴结。',
    ],
    conclusions: ['甲状腺超声未见明显异常。'],
    recommendation: '建议定期复查甲状腺超声及甲状腺功能。',
  },
  {
    key: 'tpl-v2-us-breast',
    modality: 'US',
    bodyPart: '乳腺',
    technique: '双侧乳腺超声检查',
    findings: [
      '双侧乳腺腺体结构清晰，未见明显占位性病变。',
      '双侧乳腺导管未见明显扩张，Cooper韧带未见明显增厚。',
      '双侧腋窝未见明显肿大淋巴结。',
    ],
    conclusions: ['双侧乳腺超声未见明显异常。'],
    recommendation: '建议定期复查乳腺超声，如有异常及时就诊。',
  },
]

/** 通用兜底模板 (未知模态/部位时确定性选用) */
export const GENERIC_TEMPLATES: DraftTemplate[] = [
  {
    key: 'tpl-v2-generic',
    modality: 'GENERIC',
    bodyPart: 'GENERIC',
    technique: '{modality} {bodyPart}检查',
    findings: [
      '{bodyPart}形态、结构未见明显异常，未见明显占位性病变及异常密度/信号影。',
      '周围邻近结构未见明显受压及浸润征象。',
    ],
    conclusions: ['{bodyPart}检查未见明显异常。'],
    recommendation: '建议结合临床随访观察。',
  },
  {
    key: 'tpl-v2-ct-generic',
    modality: 'CT',
    bodyPart: 'GENERIC',
    technique: '{bodyPart}CT平扫+增强扫描',
    findings: [
      '{bodyPart}密度均匀，未见明显异常密度影及占位性病变。',
      '周围组织间隙清晰，未见明显渗出及肿大淋巴结。',
    ],
    conclusions: ['{bodyPart}CT未见明显异常。'],
    recommendation: '建议定期随访复查。',
  },
  {
    key: 'tpl-v2-mr-generic',
    modality: 'MR',
    bodyPart: 'GENERIC',
    technique: '{bodyPart}MRI平扫 (T1WI/T2WI)',
    findings: [
      '{bodyPart}信号均匀，未见明显异常信号影。',
      '邻近结构形态、信号未见明显异常。',
    ],
    conclusions: ['{bodyPart}MRI未见明显异常。'],
    recommendation: '建议结合临床随访观察。',
  },
  {
    key: 'tpl-v2-dr-generic',
    modality: 'DR',
    bodyPart: 'GENERIC',
    technique: '{bodyPart}正侧位片',
    findings: [
      '{bodyPart}骨质结构完整，未见明确骨折及骨质破坏。',
      '关节关系正常，周围软组织未见明显异常。',
    ],
    conclusions: ['{bodyPart}X线片未见明显异常。'],
    recommendation: '建议定期复查。',
  },
  {
    key: 'tpl-v2-us-generic',
    modality: 'US',
    bodyPart: 'GENERIC',
    technique: '{bodyPart}超声检查',
    findings: [
      '{bodyPart}实质回声均匀，未见明显异常回声及占位。',
      '血流信号未见明显异常。',
    ],
    conclusions: ['{bodyPart}超声未见明显异常。'],
    recommendation: '建议定期复查。',
  },
]

export interface TemplateRef {
  key: string
  template: DraftTemplate
  matched: 'exact' | 'generic'
}

/** 确定性模板选择: 先精确 (模态+部位), 再模态通用, 最后全局通用 */
export function resolveTemplate(modality: string, bodyPart: string): TemplateRef {
  const mod = (modality ?? '').trim().toUpperCase()
  const part = (bodyPart ?? '').trim()
  const exact = DRAFT_TEMPLATES_V2.find((t) => t.modality === mod && t.bodyPart === part)
  if (exact) return { key: exact.key, template: exact, matched: 'exact' }
  const byModality = GENERIC_TEMPLATES.find((t) => t.modality === mod)
  if (byModality) return { key: byModality.key, template: byModality, matched: 'generic' }
  const generic = GENERIC_TEMPLATES.find((t) => t.key === 'tpl-v2-generic')
  return { key: generic?.key ?? 'tpl-v2-generic', template: generic ?? GENERIC_TEMPLATES[0]!, matched: 'generic' }
}

/** 模板内容渲染 ({modality}/{bodyPart} 占位符) */
export function renderTemplate(template: DraftTemplate, modality: string, bodyPart: string): DraftTemplate {
  const fill = (s: string) => s.replace(/\{modality\}/g, modality).replace(/\{bodyPart\}/g, bodyPart)
  return {
    ...template,
    technique: fill(template.technique),
    findings: template.findings.map(fill),
    conclusions: template.conclusions.map(fill),
    recommendation: fill(template.recommendation),
  }
}
