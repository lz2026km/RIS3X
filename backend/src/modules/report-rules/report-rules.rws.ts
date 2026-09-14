// [G005 v3.0.6.11-105 Wave 1C] 国标报告书写规范规则 (RQI-RWS-03) — 确定性规则库
// 依据: 国卫办医政函〔2024〕150 号 附件4《放射影像专业医疗质量控制指标(2024年版)》
// 条件①签名 / ②结论与描述相符 / ③无明显错误 (5 类); 每条规则含检测函数, 同输入恒同输出
import type { RwsDetection, RwsReportInput, RwsRule, RwsRuleMeta } from './report-rules.types'

export const RWS_STANDARD =
  '国卫办医政函〔2024〕150号 附件4《放射影像专业医疗质量控制指标(2024年版)》指标3 RQI-RWS-03 放射影像报告书写规范率'

/** 国标目标值: 书写规范率 ≥ 98% */
export const RWS_TARGET = 98

/** 国标书写规范率计算公式 (口径说明) */
export const RWS_RATE_FORMULA =
  '放射影像报告书写规范率 = 书写规范报告份数 / 同期报告总份数 × 100% (国标 RQI-RWS-03, 目标值 ≥98%)'

// ---------------------------------------------------------------------------
// 文本/字段工具 (确定性)
// ---------------------------------------------------------------------------

function firstNonEmpty(values: Array<string | undefined>): string {
  for (const v of values) {
    if (v && v.trim().length > 0) return v
  }
  return ''
}

function fullText(report: RwsReportInput): string {
  return [report.findings, report.diagnosis, report.impression, report.conclusion, report.recommendations]
    .filter((v): v is string => typeof v === 'string' && v.length > 0)
    .join('\n')
}

function normalize(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, '').trim().toLowerCase()
}

// ---------------------------------------------------------------------------
// ① 签名
// ---------------------------------------------------------------------------

function detectSignatureMissing(report: RwsReportInput): RwsDetection {
  const signedBy = normalize(report.signedBy)
  const signature = normalize(report.radiologistSignature)
  const signed = report.hasRadiologistSignature === true || signedBy.length > 0 || signature.length > 0
  if (report.hasRadiologistSignature === false) {
    return { matched: true, evidence: '报告未包含放射科医生签名 (hasRadiologistSignature=false)' }
  }
  return signed ? { matched: false } : { matched: true, evidence: '报告无放射科医生签名' }
}

// ---------------------------------------------------------------------------
// ② 结论与描述相符
// ---------------------------------------------------------------------------

/** 阳性征象词表 */
const POSITIVE_ENTITIES: string[] = [
  '结节',
  '占位',
  '肿块',
  '病灶',
  '囊肿',
  '钙化',
  '积液',
  '气胸',
  '骨折',
  '出血',
  '结石',
  '狭窄',
  '血栓',
  '梗死',
  '肿瘤',
  '坏死',
  '水肿',
  '增厚',
  '淋巴结',
  '龛影',
  '充盈缺损',
  '扩张',
  '渗出',
]

/** 阴性/正常结论短语 */
const NORMAL_PHRASES: string[] = [
  '未见明显异常',
  '未见异常',
  '未见明显病变',
  '未见明显器质性病变',
  '未见明确异常',
  '无异常',
  '正常',
  '阴性',
]

function detectConclusionMismatch(report: RwsReportInput): RwsDetection {
  const findings = (report.findings ?? '').trim()
  const conclusion = firstNonEmpty([report.impression, report.conclusion, report.diagnosis])
  if (!findings) return { matched: false }
  if (!conclusion.trim()) return { matched: true, evidence: '影像所见存在但结论(印象)缺失' }

  const findingsEntities = POSITIVE_ENTITIES.filter((e) => findings.includes(e))
  const conclusionEntities = POSITIVE_ENTITIES.filter((e) => conclusion.includes(e))
  const conclusionNormal = NORMAL_PHRASES.some((p) => conclusion.includes(p))

  if (findingsEntities.length > 0 && conclusionNormal) {
    const shared = conclusionEntities.some((e) => findingsEntities.includes(e))
    if (!shared) {
      return { matched: true, evidence: `所见含"${findingsEntities[0]}"但结论为阴性/正常表述` }
    }
  }

  const unsupported = conclusionEntities.find((e) => !findings.includes(e))
  if (unsupported) {
    return { matched: true, evidence: `结论提及"${unsupported}"但影像所见未描述该征象` }
  }
  return { matched: false }
}

// ---------------------------------------------------------------------------
// ③-1 脏器缺如报正常
// ---------------------------------------------------------------------------

const ORGANS: string[] = [
  '胆囊',
  '脾脏',
  '脾',
  '肾脏',
  '肾',
  '阑尾',
  '子宫',
  '前列腺',
  '甲状腺',
  '乳腺',
  '膀胱',
  '卵巢',
  '睾丸',
  '胰腺',
  '胰',
  '肝脏',
  '胃',
  '眼',
  '喉',
]

function removalPattern(organ: string): RegExp {
  return new RegExp(`${organ}[^。;；\\n]{0,8}(切除|摘除|缺如|术后|已无|未及)`)
}

function normalPattern(organ: string): RegExp {
  return new RegExp(`${organ}(形态大小正常|大小形态正常|形态正常|未见明显异常|未见异常|未见明确异常|正常|无异常)`)
}

function detectOrganAbsent(report: RwsReportInput): RwsDetection {
  const history = report.clinicalHistory ?? ''
  if (!history.trim()) return { matched: false }
  const text = fullText(report)
  for (const organ of ORGANS) {
    if (removalPattern(organ).test(history) && normalPattern(organ).test(text)) {
      return { matched: true, evidence: `病史提示"${organ}"缺如/术后, 报告仍描述"${organ}"正常` }
    }
  }
  return { matched: false }
}

// ---------------------------------------------------------------------------
// ③-2 部位/方位错误
// ---------------------------------------------------------------------------

const REGION_KEYWORDS: Record<string, string[]> = {
  颅脑: ['颅脑', '头颅', '脑'],
  胸部: ['胸部', '胸廓', '胸', '肺', '纵隔', '乳腺'],
  腹部: ['腹部', '腹', '肝', '胆', '胰', '脾', '肾', '胃', '肠'],
  盆腔: ['盆腔', '膀胱', '子宫', '前列腺', '卵巢', '直肠'],
  脊柱: ['脊柱', '腰椎', '颈椎', '胸椎', '椎体', '椎间盘'],
  四肢: ['四肢', '上肢', '下肢', '肩关节', '膝关节', '髋关节', '踝', '腕', '肘', '手足'],
  颈部: ['颈部', '甲状腺', '喉', '咽'],
}

function regionOf(value: string): string | null {
  const v = value.trim()
  if (!v) return null
  for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
    if (keywords.some((k) => v.includes(k))) return region
  }
  return null
}

function detectPositionError(report: RwsReportInput): RwsDetection {
  // 结构化核对: 报告声明部位 vs 申请单部位
  if (report.bodyPart && report.reportedBodyPart && normalize(report.bodyPart) !== normalize(report.reportedBodyPart)) {
    return { matched: true, evidence: `申请单部位"${report.bodyPart}"与报告部位"${report.reportedBodyPart}"不符` }
  }
  // 结构化核对: 侧别
  if (report.examSide && report.reportedSide && normalize(report.examSide) !== normalize(report.reportedSide)) {
    return { matched: true, evidence: `申请单侧别"${report.examSide}"与报告侧别"${report.reportedSide}"不符` }
  }
  // 文本核对: 检查部位对应区域未出现, 却出现其他区域
  const examRegion = regionOf(report.bodyPart ?? '')
  if (examRegion) {
    const text = fullText(report)
    const examKeywords = REGION_KEYWORDS[examRegion] ?? []
    const examPresent = examKeywords.some((k) => text.includes(k))
    if (!examPresent) {
      for (const [region, keywords] of Object.entries(REGION_KEYWORDS)) {
        if (region === examRegion) continue
        const other = keywords.find((k) => text.includes(k))
        if (other) {
          return { matched: true, evidence: `申请检查"${examRegion}"但报告描述"${region}"(出现"${other}")` }
        }
      }
    }
  }
  return { matched: false }
}

// ---------------------------------------------------------------------------
// ③-3 单位/数据错误
// ---------------------------------------------------------------------------

/** 测量数值缺单位 (大小/直径/长宽厚约 + 数字, 后无单位) */
const MEASURE_NO_UNIT = /(?:大小约|直径约|长约|宽约|厚约|高约|约为|约)\s*\d+(?:\.\d+)?(?!\s*(?:mm|cm|mm²|cm²|mm³|cm³|HU|ml|mL|mg|g|μg|ug|IU|L|kPa|mmHg|℃|°|%|sec|min|次|个|岁|天|月|年))/

function detectUnitDataError(report: RwsReportInput): RwsDetection {
  const text = fullText(report)
  if (!text.trim()) return { matched: false }

  if (MEASURE_NO_UNIT.test(text)) {
    const m = MEASURE_NO_UNIT.exec(text)
    return { matched: true, evidence: `测量数值缺少单位: "${m?.[0] ?? ''}"` }
  }

  // 尺寸超合理范围 (>1000mm 或 >100cm)
  const mmMatch = /(\d+(?:\.\d+)?)\s*mm/g
  let mm: RegExpExecArray | null
  while ((mm = mmMatch.exec(text)) !== null) {
    if (Number(mm[1]) > 1000) return { matched: true, evidence: `尺寸数值异常: "${mm[0]}"` }
  }
  const cmMatch = /(\d+(?:\.\d+)?)\s*cm/g
  let cm: RegExpExecArray | null
  while ((cm = cmMatch.exec(text)) !== null) {
    if (Number(cm[1]) > 100) return { matched: true, evidence: `尺寸数值异常: "${cm[0]}"` }
  }

  // CT 值 (HU) 超合理范围
  const huMatch = /(-?\d+(?:\.\d+)?)\s*HU/gi
  let hu: RegExpExecArray | null
  while ((hu = huMatch.exec(text)) !== null) {
    const value = Number(hu[1])
    if (value > 5000 || value < -5000) return { matched: true, evidence: `CT 值超出合理范围: "${hu[0]}"` }
  }

  // 年龄超合理范围
  const ageMatch = /(\d+)\s*岁/g
  let age: RegExpExecArray | null
  while ((age = ageMatch.exec(text)) !== null) {
    if (Number(age[1]) > 120) return { matched: true, evidence: `年龄数值异常: "${age[0]}"` }
  }

  return { matched: false }
}

// ---------------------------------------------------------------------------
// ③-4 模板文字残留
// ---------------------------------------------------------------------------

const TEMPLATE_RESIDUE_PATTERNS: RegExp[] = [
  /\{\{|\}\}/,
  /(?:^|[^A-Za-z])x{2,}(?:[^A-Za-z]|$)/i,
  /待补充|待填|待填寫|待完善|模板|示例|占位符|占位|请选择|请填写|请輸入/i,
  /\bTODO\b|\bTBD\b|\bXXX\b/i,
  /\[\s*[A-Za-z_]+\s*\]/,
]

function detectTemplateResidue(report: RwsReportInput): RwsDetection {
  const text = fullText(report)
  for (const pattern of TEMPLATE_RESIDUE_PATTERNS) {
    const m = pattern.exec(text)
    if (m) return { matched: true, evidence: `残留模板文字: "${m[0]}"` }
  }
  return { matched: false }
}

// ---------------------------------------------------------------------------
// ③-5 患者信息不符或缺失
// ---------------------------------------------------------------------------

function detectPatientMismatch(report: RwsReportInput): RwsDetection {
  if (!normalize(report.patientName)) {
    return { matched: true, evidence: '报告未包含患者姓名' }
  }
  if (!normalize(report.patientId)) {
    return { matched: true, evidence: '报告未包含患者 ID' }
  }
  if (report.orderPatientName && normalize(report.orderPatientName) !== normalize(report.patientName)) {
    return { matched: true, evidence: `申请单患者"${report.orderPatientName}"与报告患者"${report.patientName}"不符` }
  }
  if (report.orderPatientId && normalize(report.orderPatientId) !== normalize(report.patientId)) {
    return { matched: true, evidence: `申请单患者 ID"${report.orderPatientId}"与报告"${report.patientId}"不符` }
  }
  return { matched: false }
}

// ---------------------------------------------------------------------------
// 国标规则库 (7 条: ①1 + ②1 + ③5)
// ---------------------------------------------------------------------------

export const NATIONAL_RWS_RULES: RwsRule[] = [
  {
    code: 'RWS-SIGN-MISSING',
    name: '报告无放射科医生签名',
    nameEn: 'Report missing radiologist signature',
    condition: 'signature',
    conditionLabel: '①签名',
    conditionLabelEn: 'Signature',
    type: 'signature',
    severity: 'error',
    description: '报告须由具备资质的放射科医生签名, 无签名视为书写不规范',
    descriptionEn: 'The report must be signed by a qualified radiologist.',
    suggestion: '请由报告医生完成电子/手写签名后再发布。',
    detect: detectSignatureMissing,
  },
  {
    code: 'RWS-CONCLUSION-MISMATCH',
    name: '结论(印象)与影像描述不符',
    nameEn: 'Conclusion mismatches imaging findings',
    condition: 'consistency',
    conditionLabel: '②结论与描述相符',
    conditionLabelEn: 'Conclusion consistent with findings',
    type: 'conclusion_mismatch',
    severity: 'error',
    description: '结论(印象)须由影像所见支持, 不得出现前后矛盾',
    descriptionEn: 'The conclusion/impression must be supported by the findings.',
    suggestion: '请核对结论与所见, 确保结论由所见征象支持。',
    detect: detectConclusionMismatch,
  },
  {
    code: 'RWS-ORGAN-ABSENT',
    name: '脏器缺如却报告正常',
    nameEn: 'Absent organ reported as normal',
    condition: 'obvious_error',
    conditionLabel: '③无明显错误',
    conditionLabelEn: 'No obvious error',
    type: 'organ_absent',
    severity: 'error',
    description: '临床病史提示脏器已切除/缺如, 报告仍描述该脏器正常',
    descriptionEn: 'Organ reported as normal despite being absent/removed per history.',
    suggestion: '请结合病史修正: 已切除/缺如脏器不应报告为正常。',
    detect: detectOrganAbsent,
  },
  {
    code: 'RWS-POSITION-ERROR',
    name: '检查器官/部位/方位错误',
    nameEn: 'Wrong organ / body part / laterality',
    condition: 'obvious_error',
    conditionLabel: '③无明显错误',
    conditionLabelEn: 'No obvious error',
    type: 'position_error',
    severity: 'error',
    description: '报告检查器官、部位或左右方位与申请单不一致',
    descriptionEn: 'Examined organ, body part or laterality inconsistent with the order.',
    suggestion: '请核对检查部位与左右方位, 确保与申请单一致。',
    detect: detectPositionError,
  },
  {
    code: 'RWS-UNIT-DATA-ERROR',
    name: '单位/数据错误',
    nameEn: 'Wrong unit or data error',
    condition: 'obvious_error',
    conditionLabel: '③无明显错误',
    conditionLabelEn: 'No obvious error',
    type: 'unit_data_error',
    severity: 'error',
    description: '测量数值缺单位或数值超临床合理范围',
    descriptionEn: 'Measurement missing a unit or value outside the plausible range.',
    suggestion: '请补充法定计量单位并复核数值, 如: 大小约 5mm。',
    detect: detectUnitDataError,
  },
  {
    code: 'RWS-TEMPLATE-RESIDUE',
    name: '残留模板文字',
    nameEn: 'Template placeholder residue',
    condition: 'obvious_error',
    conditionLabel: '③无明显错误',
    conditionLabelEn: 'No obvious error',
    type: 'template_residue',
    severity: 'error',
    description: '报告残留模板占位符 (如 {{、xx、待补充) 等与报告有歧义的文字',
    descriptionEn: 'Template placeholders left in the report (e.g. {{, xx, TBD).',
    suggestion: '请删除模板占位文字, 完成个性化描述后再发布。',
    detect: detectTemplateResidue,
  },
  {
    code: 'RWS-PATIENT-MISMATCH',
    name: '患者信息不符或缺失',
    nameEn: 'Patient information mismatch or missing',
    condition: 'obvious_error',
    conditionLabel: '③无明显错误',
    conditionLabelEn: 'No obvious error',
    type: 'patient_mismatch',
    severity: 'error',
    description: '报告患者姓名/ID 与实际不符或缺失',
    descriptionEn: 'Patient name/ID missing or inconsistent with the order.',
    suggestion: '请核对患者身份信息, 确保姓名与 ID 与申请单一致。',
    detect: detectPatientMismatch,
  },
]

/** 返回可序列化规则元数据 (剔除检测函数) */
export function listRwsRuleMeta(): RwsRuleMeta[] {
  return NATIONAL_RWS_RULES.map(({ detect: _detect, ...meta }) => meta)
}

/** 对单份报告执行国标书写规范规则 */
export function detectRws(report: RwsReportInput): import('./report-rules.types').RwsFailure[] {
  const failures: import('./report-rules.types').RwsFailure[] = []
  for (const rule of NATIONAL_RWS_RULES) {
    const result = rule.detect(report)
    if (result.matched) {
      failures.push({
        code: rule.code,
        name: rule.name,
        nameEn: rule.nameEn,
        severity: rule.severity,
        type: rule.type,
        condition: rule.condition,
        suggestion: rule.suggestion,
        evidence: result.evidence ?? '',
      })
    }
  }
  failures.sort((a, b) => a.code.localeCompare(b.code))
  return failures
}
