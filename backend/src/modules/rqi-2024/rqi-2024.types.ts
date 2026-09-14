/**
 * G005 放射RIS系统 v3.0.6.11-105 Wave 1A - 放射影像专业医疗质量控制指标 (2024 年版)
 *
 * 依据: 国卫办医政函〔2024〕150 号 附件4 《放射影像专业医疗质量控制指标 (2024 年版)》
 * 7 条国标指标的采集与计算:
 *   RQI-IIA-01 放射影像检查图像伪影率 (CT / MRI 分别统计)
 *   RQI-RRC-02 急诊放射影像检查报告 2 小时完成率
 *   RQI-RWS-03 放射影像报告书写规范率
 *   RQI-RCV-04 放射影像危急值 10 分钟内通报完成率
 *   RQI-ICME-05 增强 CT 检查静脉对比剂外渗发生率 (‰)
 *   RQI-RCR-06 PI-RADS 分类率
 *   RQI-RCR-07 BI-RADS 分类率
 *
 * 孤儿模块模式: 不新增 DB 表, 数据从同源表派生 (report / exam / critical_value / dicom_instance /
 * audit_log 等), DB 不可用时回退确定性 seed, 可无 DB 启动。所有计算为纯函数, 同输入恒同输出。
 */

// ================= 指标编码 =================

export const INDICATOR_CODES = [
  'RQI-IIA-01',
  'RQI-RRC-02',
  'RQI-RWS-03',
  'RQI-RCV-04',
  'RQI-ICME-05',
  'RQI-RCR-06',
  'RQI-RCR-07',
] as const

export type IndicatorCode = (typeof INDICATOR_CODES)[number]

export type IndicatorStatus = 'pass' | 'warn' | 'fail'
export type IndicatorUnit = '%' | '‰'
export type IndicatorDirection = 'higher' | 'lower'
export type RqiGranularity = 'month' | 'quarter' | 'year'

export const RQI_STANDARD = '国卫办医政函〔2024〕150号 附件4'

// ================= 指标元数据 =================

export interface IndicatorMeta {
  code: IndicatorCode
  name: string
  shortName: string
  unit: IndicatorUnit
  direction: IndicatorDirection
  /** 默认目标值: lower 类为上限 (≤), higher 类为下限 (≥) */
  defaultTarget: number
  /** 预警容差: 未达标但处于容差带内判定为 warn */
  defaultWarnMargin: number
  standard: string
}

export const INDICATOR_META: IndicatorMeta[] = [
  {
    code: 'RQI-IIA-01',
    name: '放射影像检查图像伪影率',
    shortName: '图像伪影率',
    unit: '%',
    direction: 'lower',
    defaultTarget: 2,
    defaultWarnMargin: 1,
    standard: RQI_STANDARD,
  },
  {
    code: 'RQI-RRC-02',
    name: '急诊放射影像检查报告2小时完成率',
    shortName: '急诊2小时完成率',
    unit: '%',
    direction: 'higher',
    defaultTarget: 95,
    defaultWarnMargin: 5,
    standard: RQI_STANDARD,
  },
  {
    code: 'RQI-RWS-03',
    name: '放射影像报告书写规范率',
    shortName: '报告书写规范率',
    unit: '%',
    direction: 'higher',
    defaultTarget: 98,
    defaultWarnMargin: 3,
    standard: RQI_STANDARD,
  },
  {
    code: 'RQI-RCV-04',
    name: '放射影像危急值10分钟内通报完成率',
    shortName: '危急值10min通报率',
    unit: '%',
    direction: 'higher',
    defaultTarget: 100,
    defaultWarnMargin: 5,
    standard: RQI_STANDARD,
  },
  {
    code: 'RQI-ICME-05',
    name: '增强CT检查静脉对比剂外渗发生率',
    shortName: '对比剂外渗率',
    unit: '‰',
    direction: 'lower',
    defaultTarget: 0.1,
    defaultWarnMargin: 0.1,
    standard: RQI_STANDARD,
  },
  {
    code: 'RQI-RCR-06',
    name: 'PI-RADS分类率',
    shortName: 'PI-RADS分类率',
    unit: '%',
    direction: 'higher',
    defaultTarget: 95,
    defaultWarnMargin: 5,
    standard: RQI_STANDARD,
  },
  {
    code: 'RQI-RCR-07',
    name: 'BI-RADS分类率',
    shortName: 'BI-RADS分类率',
    unit: '%',
    direction: 'higher',
    defaultTarget: 95,
    defaultWarnMargin: 5,
    standard: RQI_STANDARD,
  },
]

export const INDICATOR_META_MAP: Record<IndicatorCode, IndicatorMeta> = INDICATOR_META.reduce(
  (acc, m) => {
    acc[m.code] = m
    return acc
  },
  {} as Record<IndicatorCode, IndicatorMeta>,
)

// ================= 统计窗口 =================

export interface IndicatorWindow {
  granularity: RqiGranularity
  /** 展示标签: 2026-08 / 2026-Q3 / 2026 / 2026-08-01~2026-08-14 */
  label: string
  /** 起止日期 (含), 'YYYY-MM-DD' */
  dateFrom: string
  dateTo: string
}

// ================= 指标结果 =================

export interface IndicatorDimensionResult {
  dimension: string
  label: string
  numerator: number
  denominator: number
  rate: number
  status: IndicatorStatus
}

export interface IndicatorResult {
  code: IndicatorCode
  name: string
  numerator: number
  denominator: number
  rate: number
  unit: IndicatorUnit
  target: number
  direction: IndicatorDirection
  status: IndicatorStatus
  period: string
  granularity: RqiGranularity
  standard: string
  /** CT / MRI 分列等维度拆分 */
  byDimension?: IndicatorDimensionResult[]
}

// ================= 明细分项 =================

export type IndicatorItemKind = 'exam' | 'report' | 'critical' | 'contrast'

export interface IndicatorDetailItem {
  id: string
  kind: IndicatorItemKind
  label: string
  inNumerator: boolean
  inDenominator: boolean
  dimension?: string
  detail: Record<string, string | number | boolean | undefined>
}

export interface IndicatorDetailResult {
  indicator: IndicatorResult
  numeratorIds: string[]
  denominatorIds: string[]
  items: IndicatorDetailItem[]
}

// ================= 趋势 =================

export interface IndicatorTrendPoint {
  month: string
  numerator: number
  denominator: number
  rate: number
  unit: IndicatorUnit
  target: number
  status: IndicatorStatus
}

// ================= 总览 =================

export interface IndicatorMomItem {
  code: IndicatorCode
  name: string
  current: number
  previous: number
  delta: number
  trend: 'up' | 'down' | 'flat'
  unit: IndicatorUnit
}

export interface RqiDashboardResult {
  source: 'database' | 'seed'
  generatedAt: string
  period: string
  granularity: RqiGranularity
  standard: string
  total: number
  passCount: number
  warnCount: number
  failCount: number
  passRate: number
  indicators: IndicatorResult[]
  mom: IndicatorMomItem[]
}

// ================= 目标值配置 =================

export interface IndicatorConfig {
  code: IndicatorCode
  name: string
  target: number
  warnMargin: number
  direction: IndicatorDirection
  unit: IndicatorUnit
}

export interface UpdateIndicatorConfigInput {
  code: IndicatorCode
  target: number
  warnMargin?: number
  direction?: IndicatorDirection
}

export interface RqiConfigResult {
  source: 'default' | 'override'
  updatedAt: string | null
  standard: string
  items: IndicatorConfig[]
}

// ================= 导出 =================

export type RqiExportFormat = 'csv' | 'json'

export interface RqiExportInput {
  format: RqiExportFormat
  period?: string
  dateFrom?: string
  dateTo?: string
}

export interface RqiExportResult {
  format: RqiExportFormat
  content: string
  filename: string
}

// ================= 同源派生数据 =================

/** 检查 (Exam 派生): 每份检查报告 = 1 个例次 */
export interface RqiExam {
  examId: string
  accessionNumber: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
  startedAt: string
  isEmergency: boolean
  isEnhancedCt: boolean
  hasArtifact: boolean
  artifactNote?: string
  contrastExtravasation: boolean
  reportId?: string
}

/** 报告 (Report 派生) */
export interface RqiReport {
  reportId: string
  examId: string
  patientId: string
  patientName: string
  modality: string
  bodyPart: string
  isEmergency: boolean
  examStartedAt: string
  reportIssuedAt: string
  hasRadiologistSignature: boolean
  conclusionMatchesFindings: boolean
  hasObviousError: boolean
  errorNote?: string
  radsCategory?: string
  isProstateMr?: boolean
  isMammoTarget?: boolean
}

/** 危急值事件 (CriticalValue 派生) */
export interface RqiCriticalEvent {
  id: string
  criticalId: string
  examId?: string
  patientId: string
  patientName: string
  diagnosis: string
  foundAt: string
  notifiedAt?: string
  hasTimeRecord: boolean
  hasContentRecord: boolean
  hasSignerRecord: boolean
}

export interface RqiSourceDataset {
  exams: RqiExam[]
  reports: RqiReport[]
  criticalEvents: RqiCriticalEvent[]
  generatedAt: string
  source: 'database' | 'seed'
}

// ================= 国标常量 =================

/** 急诊报告完成时限 (分钟): 检查开始 → 报告正式出具 ≤ 120 */
export const EMERGENCY_REPORT_MINUTES = 120

/** 危急值通报时限 (分钟) */
export const CRITICAL_NOTIFY_MINUTES = 10

export const CT_MODALITIES = ['CT']
export const MR_MODALITIES = ['MR', 'MRI', 'MRT']
export const XRAY_MODALITIES = ['DR', 'CR', 'DX', 'RF', 'XRAY', 'X线']
export const MAMMO_MODALITIES = ['MG', 'MAMMO', 'MAMM', 'MAMMOGRAPHY', '钼靶']
export const EMERGENCY_MODALITIES = [...XRAY_MODALITIES, ...CT_MODALITIES]

/**
 * 国标危急值诊断类别 (13 类)。急性主动脉夹层 (DeBakey I/II) 与急性主动脉瘤破裂同属
 * 急性主动脉综合征, 合并为一个类别以对齐国标 13 类口径; 其余类别键含别名用于文本匹配。
 */
export const CRITICAL_DIAGNOSES: string[] = [
  '急性肺栓塞',
  '急性主动脉夹层/主动脉瘤破裂',
  '心包填塞',
  '大量液气血胸',
  '气管支气管异物',
  '急性脑梗死',
  '急性脑出血',
  '急性硬膜外硬膜下出血',
  '急性蛛网膜下腔出血',
  '脑疝',
  '消化道穿孔',
  '腹腔内脏器破裂出血',
  '绞窄性肠梗阻',
]

export const CRITICAL_DIAGNOSIS_ALIASES: Record<string, string[]> = {
  '急性肺栓塞': ['肺栓塞', '肺动脉栓塞', 'PE'],
  '急性主动脉夹层/主动脉瘤破裂': ['急性主动脉夹层', '主动脉夹层', 'DeBakey', '主动脉内膜片', '真假双腔', '急性主动脉瘤破裂', '主动脉瘤破裂', '主动脉瘤破'],
  '心包填塞': ['心包积液伴填塞', '心包压塞', '心脏压塞'],
  '大量液气血胸': ['液气胸', '血胸', '气血胸', '大量胸腔积液'],
  '气管支气管异物': ['气管异物', '支气管异物', '气道异物'],
  '急性脑梗死': ['脑梗死', '脑梗塞', '缺血性卒中'],
  '急性脑出血': ['脑出血', '脑内血肿', '出血性卒中'],
  '急性硬膜外硬膜下出血': ['硬膜外出血', '硬膜下出血', '硬膜外血肿', '硬膜下血肿'],
  '急性蛛网膜下腔出血': ['蛛网膜下腔出血', 'SAH'],
  '脑疝': ['小脑幕切迹疝', '枕骨大孔疝', '脑组织疝'],
  '消化道穿孔': ['胃肠穿孔', '肠穿孔', '胃穿孔'],
  '腹腔内脏器破裂出血': ['肝破裂', '脾破裂', '肾破裂', '脏器破裂'],
  '绞窄性肠梗阻': ['肠绞窄', '绞窄性肠梗', '绞窄性梗阻'],
}

/** 危急值诊断类别数 (国标 13 类) */
export const CRITICAL_DIAGNOSIS_COUNT = CRITICAL_DIAGNOSES.length

export const PI_RADS_PATTERN = /PI[\s-]?RADS/i
export const BI_RADS_PATTERN = /BI[\s-]?RADS/i

/** 报告明显错误: 残留模板文字 / 患者信息不符 / 脏器缺如报正常 / 部位方位单位数据错误等 */
export const REPORT_ERROR_PATTERNS = [
  /XXX/i,
  /待补充/,
  /模板/,
  /示例/,
  /占位符/,
  /患者姓名不符/,
  /信息缺失/,
  /脏器缺如/,
  /方位错误/,
  /单位错误/,
]

export function isCriticalDiagnosis(diagnosis: string): boolean {
  const text = (diagnosis ?? '').trim()
  if (!text) return false
  for (const category of CRITICAL_DIAGNOSES) {
    if (text.includes(category)) return true
    const aliases = CRITICAL_DIAGNOSIS_ALIASES[category] ?? []
    if (aliases.some((a) => a && text.includes(a))) return true
  }
  return false
}

export function classifyCriticalDiagnosis(diagnosis: string): string | null {
  const text = (diagnosis ?? '').trim()
  if (!text) return null
  for (const category of CRITICAL_DIAGNOSES) {
    if (text.includes(category)) return category
    const aliases = CRITICAL_DIAGNOSIS_ALIASES[category] ?? []
    if (aliases.some((a) => a && text.includes(a))) return category
  }
  return null
}

export function hasReportError(text: string): boolean {
  const value = text ?? ''
  return REPORT_ERROR_PATTERNS.some((p) => p.test(value))
}

export const DEFAULT_INDICATOR_CONFIG: IndicatorConfig[] = INDICATOR_META.map((m) => ({
  code: m.code,
  name: m.name,
  target: m.defaultTarget,
  warnMargin: m.defaultWarnMargin,
  direction: m.direction,
  unit: m.unit,
}))
