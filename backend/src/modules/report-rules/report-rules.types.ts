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
