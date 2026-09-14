// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎 — 类型定义
// 规则类型: 必填字段缺失/术语规范/单位完整/长度范围/数值合理性/重复表述
// 严重级别: error / warning / info; 规则条件: 字段 + 运算符 + 阈值
export type RuleType =
  | 'missing_field'
  | 'terminology'
  | 'unit'
  | 'length_range'
  | 'numeric_reasonability'
  | 'duplicate'

export type RuleSeverity = 'error' | 'warning' | 'info'

export type RuleField =
  | 'findings'
  | 'diagnosis'
  | 'impression'
  | 'conclusion'
  | 'recommendations'
  | 'fullText'

export type RuleOperator =
  | 'empty'
  | 'not_empty'
  | 'contains'
  | 'not_contains'
  | 'regex'
  | 'length_lt'
  | 'length_gte'
  | 'numeric_over'
  | 'dup_count'

export const RULE_TYPES: RuleType[] = [
  'missing_field',
  'terminology',
  'unit',
  'length_range',
  'numeric_reasonability',
  'duplicate',
]

export const RULE_SEVERITIES: RuleSeverity[] = ['error', 'warning', 'info']

export const RULE_FIELDS: RuleField[] = [
  'findings',
  'diagnosis',
  'impression',
  'conclusion',
  'recommendations',
  'fullText',
]

export const RULE_OPERATORS: RuleOperator[] = [
  'empty',
  'not_empty',
  'contains',
  'not_contains',
  'regex',
  'length_lt',
  'length_gte',
  'numeric_over',
  'dup_count',
]

// 条件: 主条件 (field/operator/value) + 可选前置条件 when (满足时主条件才生效)
export interface RuleCondition {
  field: RuleField
  operator: RuleOperator
  value: string | number
  when?: {
    field: RuleField
    operator: RuleOperator
    value: string | number
  }
}

export interface QualityRule {
  id: string
  code: string
  name: string
  type: RuleType
  severity: RuleSeverity
  description: string
  condition: RuleCondition
  suggestion: string
  builtIn: boolean
  enabled: boolean
  /** 空数组 = 全部检查类型生效 */
  examTypes: string[]
  createdAt?: string
}

export interface RuleViolation {
  ruleId: string
  ruleCode: string
  ruleName: string
  type: RuleType
  severity: RuleSeverity
  field: string
  position: number
  snippet: string
  suggestion: string
}

export interface RuleSet {
  id: string
  name: string
  description: string
  examTypes: string[]
  ruleIds: string[]
  createdAt: string
  updatedAt: string
}

export interface EvaluateInput {
  findings?: string
  diagnosis?: string
  impression?: string
  conclusion?: string
  recommendations?: string
  examType?: string
  reportId?: string
  rulesetId?: string
}

export interface EvaluateResult {
  source: 'database' | 'demo'
  generatedAt: string
  reportId?: string
  ruleCount: number
  enabledRuleCount: number
  violations: RuleViolation[]
  score: number
}

export interface RuleStats {
  totalRules: number
  builtInRules: number
  customRules: number
  byType: Record<string, number>
  bySeverity: Record<string, number>
  totalEvaluations: number
  totalViolations: number
  violationRate: number
  topRules: Array<{ code: string; name: string; count: number }>
}

// ============================================================================
// [G005 v3.0.6.11-105 Wave 1C] 国标报告书写规范规则 (RQI-RWS-03)
// 依据: 国卫办医政函〔2024〕150 号 附件4《放射影像专业医疗质量控制指标(2024年版)》
// 书写规范 3 条件:
//   ① 签名: 报告须有放射科医生签名
//   ② 结论与描述相符: 结论(印象)与影像描述内容相符
//   ③ 无明显错误 (5 类): 脏器缺如报正常 / 部位方位错误 / 单位数据错误 /
//      模板文字残留 / 患者信息不符或缺失
// ============================================================================

/** 国标书写规范条件分组 */
export type RwsConditionGroup = 'signature' | 'consistency' | 'obvious_error'

/** 国标书写规范错误类型 (7 项: ①② + ③5 类) */
export type RwsErrorType =
  | 'signature'
  | 'conclusion_mismatch'
  | 'organ_absent'
  | 'position_error'
  | 'unit_data_error'
  | 'template_residue'
  | 'patient_mismatch'

/** 国标报告书写规范评估输入 (结构化真值 + 报告文本) */
export interface RwsReportInput {
  reportId?: string
  examType?: string
  /** 检查部位 (申请单真值) */
  bodyPart?: string
  /** 患者姓名 (报告内) */
  patientName?: string
  /** 患者 ID (报告内) */
  patientId?: string
  /** 申请单患者姓名 (真值, 用于一致性核对) */
  orderPatientName?: string
  /** 申请单患者 ID (真值, 用于一致性核对) */
  orderPatientId?: string
  /** 临床病史 (如 "胆囊切除术后") */
  clinicalHistory?: string
  findings?: string
  diagnosis?: string
  impression?: string
  conclusion?: string
  recommendations?: string
  /** 报告签署医生 */
  signedBy?: string
  /** 放射科医生签名 */
  radiologistSignature?: string
  /** 签名状态显式标记 */
  hasRadiologistSignature?: boolean
  /** 报告内声明的检查部位 (与 bodyPart 核对) */
  reportedBodyPart?: string
  /** 报告内声明的侧别 (左/右/双侧) */
  reportedSide?: string
  /** 申请单侧别 (真值) */
  examSide?: string
}

/** 单条国标规则命中结果 */
export interface RwsDetection {
  matched: boolean
  evidence?: string
}

/** 国标规则元数据 (可序列化, 不含检测函数) */
export interface RwsRuleMeta {
  code: string
  name: string
  nameEn: string
  condition: RwsConditionGroup
  conditionLabel: string
  conditionLabelEn: string
  type: RwsErrorType
  severity: RuleSeverity
  description: string
  descriptionEn: string
  suggestion: string
}

/** 国标规则 (含确定性检测函数) */
export interface RwsRule extends RwsRuleMeta {
  detect: (report: RwsReportInput) => RwsDetection
}

/** 国标规则库返回 */
export interface RwsRuleList {
  source: 'national'
  generatedAt: string
  standard: string
  target: number
  rateFormula: string
  ruleCount: number
  data: RwsRuleMeta[]
}

/** 规范率评估失败项 */
export interface RwsFailure {
  code: string
  name: string
  nameEn: string
  severity: RuleSeverity
  type: RwsErrorType
  condition: RwsConditionGroup
  suggestion: string
  evidence: string
}

/** 单份报告国标书写规范评估结果 */
export interface RwsEvaluation {
  source: 'national'
  generatedAt: string
  reportId?: string
  compliant: boolean
  failures: RwsFailure[]
  numerator: number
  denominator: number
  rate: number
  standard: string
  target: number
  rateExplanation: string
}

/** 批量书写规范率结果 */
export interface RwsRateResult {
  source: 'national'
  generatedAt: string
  standard: string
  target: number
  numerator: number
  denominator: number
  totalReports: number
  rate: number
  rateExplanation: string
  results: Array<{ reportId?: string; compliant: boolean; failureCodes: string[] }>
}
