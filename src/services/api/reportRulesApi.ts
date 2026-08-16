import { api, invalidateApiCache } from './client'

// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎 API
// 后端: backend/src/modules/report-rules/ (18+ 内置规则 + 自定义规则 CRUD + 规则集绑定 + 评估)

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

export interface RuleEnvelope<T> {
  source: 'database' | 'demo'
  generatedAt: string
  data: T
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

export interface RuleViolationRecord {
  id: string
  reportId: string
  ruleCode: string
  ruleName: string
  severity: RuleSeverity
  field: string
  evaluatedAt: string
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  missing_field: '必填字段缺失',
  terminology: '术语规范',
  unit: '单位完整',
  length_range: '长度范围',
  numeric_reasonability: '数值合理性',
  duplicate: '重复表述',
}

export const RULE_SEVERITY_LABELS: Record<RuleSeverity, string> = {
  error: '错误',
  warning: '警告',
  info: '提示',
}

export const RULE_FIELD_LABELS: Record<RuleField, string> = {
  findings: '影像所见',
  diagnosis: '诊断结论',
  impression: '影像印象',
  conclusion: '报告结论',
  recommendations: '随访建议',
  fullText: '全文',
}

export const reportRulesApi = {
  listRules: (examType?: string) =>
    api.get<RuleEnvelope<QualityRule[]>>(`/report-rules/rules${examType ? `?examType=${encodeURIComponent(examType)}` : ''}`),

  createRule: async (data: Omit<QualityRule, 'id' | 'builtIn' | 'enabled' | 'createdAt'>) => {
    const res = await api.post<QualityRule>('/report-rules/rules', data)
    await invalidateApiCache('/report-rules/rules')
    return res
  },

  updateRule: async (id: string, data: Partial<Omit<QualityRule, 'id' | 'builtIn'>>) => {
    const res = await api.put<QualityRule>(`/report-rules/rules/${id}`, data)
    await invalidateApiCache('/report-rules/rules')
    return res
  },

  deleteRule: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`/report-rules/rules/${id}`)
    await invalidateApiCache('/report-rules/rules')
    return res
  },

  evaluate: async (data: EvaluateInput) => {
    const res = await api.post<EvaluateResult>('/report-rules/evaluate', data)
    return res
  },

  listRulesets: () => api.get<RuleEnvelope<RuleSet[]>>('/report-rules/rulesets'),

  createRuleset: async (data: { name: string; description?: string; examTypes?: string[]; ruleIds?: string[] }) => {
    const res = await api.post<RuleSet>('/report-rules/rulesets', data)
    await invalidateApiCache('/report-rules/rulesets')
    return res
  },

  updateRuleset: async (id: string, data: Partial<{ name: string; description: string; examTypes: string[]; ruleIds: string[] }>) => {
    const res = await api.put<RuleSet>(`/report-rules/rulesets/${id}`, data)
    await invalidateApiCache('/report-rules/rulesets')
    return res
  },

  deleteRuleset: async (id: string) => {
    const res = await api.delete<{ id: string; deleted: boolean }>(`/report-rules/rulesets/${id}`)
    await invalidateApiCache('/report-rules/rulesets')
    return res
  },

  listHistory: (reportId?: string) =>
    api.get<RuleEnvelope<RuleViolationRecord[]>>(`/report-rules/history${reportId ? `?reportId=${encodeURIComponent(reportId)}` : ''}`),

  getStats: () => api.get<RuleEnvelope<RuleStats>>('/report-rules/stats'),
}
