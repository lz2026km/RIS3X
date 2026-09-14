// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎服务 — 孤儿模块模式
// 内存 CRUD + 内置规则库 seed; 自定义规则/违规记录异步落 auditLog (失败静默回退, 无 DB 可启动)
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@prisma/client'
import { PrismaService } from '../../prisma/prisma.service'
import { executeRules } from './report-rules.engine'
import { BUILTIN_RULES, BUILTIN_RULESET_SEEDS } from './report-rules.rules'
import { detectRws, listRwsRuleMeta, RWS_RATE_FORMULA, RWS_STANDARD, RWS_TARGET } from './report-rules.rws'
import type {
  EvaluateInput,
  EvaluateResult,
  QualityRule,
  RuleCondition,
  RuleField,
  RuleOperator,
  RuleSet,
  RuleSeverity,
  RuleStats,
  RuleType,
  RwsEvaluation,
  RwsRateResult,
  RwsReportInput,
  RwsRuleList,
} from './report-rules.types'
import { RULE_FIELDS, RULE_OPERATORS, RULE_SEVERITIES, RULE_TYPES } from './report-rules.types'

export interface ViolationRecord {
  id: string
  reportId: string
  ruleCode: string
  ruleName: string
  severity: RuleSeverity
  field: string
  evaluatedAt: string
}

const FIELDS = RULE_FIELDS
const OPERATORS = RULE_OPERATORS
const SEVERITIES = RULE_SEVERITIES
const TYPES = RULE_TYPES

@Injectable()
export class ReportRulesService {
  private readonly logger = new Logger(ReportRulesService.name)
  private rules: QualityRule[] = []
  private rulesets: RuleSet[] = []
  private history: ViolationRecord[] = []
  private customCounter = 0
  private rulesetCounter = 0

  constructor(private readonly prisma?: PrismaService) {
    this.seed()
  }

  private seed(): void {
    this.rules = BUILTIN_RULES.map((r) => ({ ...r, condition: { ...r.condition, when: r.condition.when ? { ...r.condition.when } : undefined }, examTypes: [...r.examTypes] }))
    this.rulesets = BUILTIN_RULESET_SEEDS.map((rs) => ({
      ...rs,
      ruleIds: [...rs.ruleIds],
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-01T00:00:00.000Z',
    }))
    this.customCounter = 0
    this.rulesetCounter = this.rulesets.length
  }

  private cloneRule(r: QualityRule): QualityRule {
    return { ...r, condition: { ...r.condition, when: r.condition.when ? { ...r.condition.when } : undefined }, examTypes: [...r.examTypes] }
  }

  private cloneRuleset(rs: RuleSet): RuleSet {
    return { ...rs, ruleIds: [...rs.ruleIds], examTypes: [...rs.examTypes] }
  }

  private nextCustomId(): string {
    this.customCounter += 1
    return `rule-c-${String(this.customCounter).padStart(3, '0')}`
  }

  private findRule(id: string): QualityRule {
    const rule = this.rules.find((r) => r.id === id)
    if (!rule) throw new NotFoundException(`规则 ${id} 不存在`)
    return rule
  }

  // 参数校验 (确定性, 与 controller zod 同规则)
  private validateRuleInput(body: {
    type?: RuleType
    severity?: RuleSeverity
    field?: RuleField
    operator?: RuleOperator
    condition?: RuleCondition
  }): void {
    if (body.type !== undefined && !TYPES.includes(body.type)) throw new BadRequestException(`规则类型必须为 ${TYPES.join('|')}`)
    if (body.severity !== undefined && !SEVERITIES.includes(body.severity)) throw new BadRequestException(`严重级别必须为 ${SEVERITIES.join('|')}`)
    const cond = body.condition
    if (cond) {
      if (!FIELDS.includes(cond.field)) throw new BadRequestException(`字段必须为 ${FIELDS.join('|')}`)
      if (!OPERATORS.includes(cond.operator)) throw new BadRequestException(`运算符必须为 ${OPERATORS.join('|')}`)
      if (cond.when && !FIELDS.includes(cond.when.field)) throw new BadRequestException('when 字段不合法')
    }
  }

  private async persistAudit(resource: string, detail: Record<string, unknown>): Promise<void> {
    try {
      await this.prisma?.auditLog.create({ data: { action: 'RULE', resource, detail: detail as Prisma.InputJsonValue, tenantId: 'tenant-demo' } })
    } catch (err) {
      this.logger.warn(`[ReportRules] persist ${resource} failed (seed 回退): ${(err as Error).message}`)
    }
  }

  listRules(examType?: string): { source: 'database' | 'demo'; generatedAt: string; data: QualityRule[] } {
    let data = this.rules.map((r) => this.cloneRule(r))
    if (examType) {
      data = data.filter((r) => r.examTypes.length === 0 || r.examTypes.includes(examType))
    }
    data.sort((a, b) => (a.builtIn === b.builtIn ? a.code.localeCompare(b.code) : a.builtIn ? -1 : 1))
    return { source: 'demo', generatedAt: new Date().toISOString(), data }
  }

  async createRule(body: {
    code?: string
    name: string
    type: RuleType
    severity: RuleSeverity
    description?: string
    condition: RuleCondition
    suggestion?: string
    examTypes?: string[]
  }): Promise<QualityRule> {
    if (!body.name?.trim()) throw new BadRequestException('规则名称不能为空')
    this.validateRuleInput(body)
    const rule: QualityRule = {
      id: this.nextCustomId(),
      code: body.code?.trim() || `RR-CUSTOM-${this.customCounter}`,
      name: body.name.trim(),
      type: body.type,
      severity: body.severity,
      description: body.description?.trim() || '',
      condition: body.condition,
      suggestion: body.suggestion?.trim() || '请按规则提示修正表述。',
      builtIn: false,
      enabled: true,
      examTypes: body.examTypes?.length ? [...body.examTypes] : [],
      createdAt: new Date().toISOString(),
    }
    this.rules.push(rule)
    void this.persistAudit('report-rule', { action: 'create', ruleId: rule.id, code: rule.code, name: rule.name })
    return this.cloneRule(rule)
  }

  async updateRule(id: string, body: Partial<Omit<QualityRule, 'id' | 'builtIn'>>): Promise<QualityRule> {
    const rule = this.findRule(id)
    this.validateRuleInput(body as { type?: RuleType; severity?: RuleSeverity; condition?: RuleCondition })
    if (rule.builtIn) {
      // 内置规则仅允许 启停/级别/建议 微调
      if (body.enabled !== undefined) rule.enabled = body.enabled
      if (body.severity !== undefined) rule.severity = body.severity
      if (body.suggestion !== undefined && body.suggestion.trim()) rule.suggestion = body.suggestion.trim()
      return this.cloneRule(rule)
    }
    if (body.name !== undefined && body.name.trim()) rule.name = body.name.trim()
    if (body.type !== undefined) rule.type = body.type
    if (body.severity !== undefined) rule.severity = body.severity
    if (body.description !== undefined) rule.description = body.description
    if (body.condition !== undefined) rule.condition = body.condition
    if (body.suggestion !== undefined && body.suggestion.trim()) rule.suggestion = body.suggestion.trim()
    if (body.enabled !== undefined) rule.enabled = body.enabled
    if (body.examTypes !== undefined) rule.examTypes = [...body.examTypes]
    if (body.code !== undefined && body.code.trim()) rule.code = body.code.trim()
    void this.persistAudit('report-rule', { action: 'update', ruleId: rule.id })
    return this.cloneRule(rule)
  }

  async deleteRule(id: string): Promise<{ id: string; deleted: boolean }> {
    const rule = this.findRule(id)
    if (rule.builtIn) throw new BadRequestException('内置规则不可删除, 可停用')
    this.rules = this.rules.filter((r) => r.id !== id)
    for (const rs of this.rulesets) rs.ruleIds = rs.ruleIds.filter((rid) => rid !== id)
    void this.persistAudit('report-rule', { action: 'delete', ruleId: id })
    return { id, deleted: true }
  }

  // 评估: 报告文本 → 违规列表; 按 rulesetId 或 examType 选取规则; 结果入 history
  async evaluate(input: EvaluateInput): Promise<EvaluateResult> {
    let pool: QualityRule[]
    if (input.rulesetId) {
      const rs = this.rulesets.find((s) => s.id === input.rulesetId)
      if (!rs) throw new NotFoundException(`规则集 ${input.rulesetId} 不存在`)
      pool = this.rules.filter((r) => rs.ruleIds.includes(r.id))
    } else if (input.examType) {
      const examType = input.examType
      pool = this.rules.filter((r) => r.examTypes.length === 0 || r.examTypes.includes(examType))
    } else {
      pool = this.rules
    }
    const result = executeRules(input, pool)
    if (input.reportId) {
      for (const v of result.violations) {
        this.history.unshift({
          id: `vio-${this.history.length + 1}`,
          reportId: input.reportId,
          ruleCode: v.ruleCode,
          ruleName: v.ruleName,
          severity: v.severity,
          field: v.field,
          evaluatedAt: result.generatedAt,
        })
      }
      this.history = this.history.slice(0, 200)
      if (result.violations.length > 0) {
        void this.persistAudit('report-rule-violation', {
          reportId: input.reportId,
          count: result.violations.length,
          severities: result.violations.map((v) => v.severity),
          score: result.score,
        })
      }
    }
    return result
  }

  listHistory(reportId?: string): { source: 'database' | 'demo'; generatedAt: string; data: ViolationRecord[] } {
    const data = reportId ? this.history.filter((h) => h.reportId === reportId) : this.history
    return { source: 'demo', generatedAt: new Date().toISOString(), data: data.slice(0, 50) }
  }

  listRulesets(): { source: 'database' | 'demo'; generatedAt: string; data: RuleSet[] } {
    const data = this.rulesets.map((rs) => this.cloneRuleset(rs)).sort((a, b) => a.id.localeCompare(b.id))
    return { source: 'demo', generatedAt: new Date().toISOString(), data }
  }

  async createRuleset(body: { name: string; description?: string; examTypes?: string[]; ruleIds?: string[] }): Promise<RuleSet> {
    if (!body.name?.trim()) throw new BadRequestException('规则集名称不能为空')
    this.rulesetCounter += 1
    const now = new Date().toISOString()
    const rs: RuleSet = {
      id: `rs-${this.rulesetCounter}`,
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      examTypes: body.examTypes?.length ? [...body.examTypes] : [],
      ruleIds: body.ruleIds?.length ? [...body.ruleIds] : [],
      createdAt: now,
      updatedAt: now,
    }
    this.rulesets.push(rs)
    void this.persistAudit('report-ruleset', { action: 'create', rulesetId: rs.id, name: rs.name })
    return this.cloneRuleset(rs)
  }

  async updateRuleset(id: string, body: Partial<{ name: string; description: string; examTypes: string[]; ruleIds: string[] }>): Promise<RuleSet> {
    const rs = this.rulesets.find((s) => s.id === id)
    if (!rs) throw new NotFoundException(`规则集 ${id} 不存在`)
    if (body.name !== undefined && body.name.trim()) rs.name = body.name.trim()
    if (body.description !== undefined) rs.description = body.description
    if (body.examTypes !== undefined) rs.examTypes = [...body.examTypes]
    if (body.ruleIds !== undefined) rs.ruleIds = [...body.ruleIds]
    rs.updatedAt = new Date().toISOString()
    void this.persistAudit('report-ruleset', { action: 'update', rulesetId: id })
    return this.cloneRuleset(rs)
  }

  async deleteRuleset(id: string): Promise<{ id: string; deleted: boolean }> {
    const rs = this.rulesets.find((s) => s.id === id)
    if (!rs) throw new NotFoundException(`规则集 ${id} 不存在`)
    this.rulesets = this.rulesets.filter((s) => s.id !== id)
    return { id, deleted: true }
  }

  getStats(): { source: 'database' | 'demo'; generatedAt: string; data: RuleStats } {
    const byType: Record<string, number> = {}
    const bySeverity: Record<string, number> = {}
    for (const r of this.rules) {
      byType[r.type] = (byType[r.type] ?? 0) + 1
      bySeverity[r.severity] = (bySeverity[r.severity] ?? 0) + 1
    }
    const topCounts = new Map<string, number>()
    for (const h of this.history) topCounts.set(h.ruleCode, (topCounts.get(h.ruleCode) ?? 0) + 1)
    const topRules = [...topCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([code, count]) => {
        const rule = this.rules.find((r) => r.code === code)
        return { code, name: rule?.name ?? code, count }
      })
    return {
      source: 'demo',
      generatedAt: new Date().toISOString(),
      data: {
        totalRules: this.rules.length,
        builtInRules: this.rules.filter((r) => r.builtIn).length,
        customRules: this.rules.filter((r) => !r.builtIn).length,
        byType,
        bySeverity,
        totalEvaluations: this.history.length > 0 ? Math.max(1, Math.round(this.history.length / 3)) : 0,
        totalViolations: this.history.length,
        violationRate: this.history.length > 0 ? Math.min(100, Math.round((this.history.length / Math.max(1, Math.round(this.history.length / 3))) * 10) / 10) : 0,
        topRules,
      },
    }
  }

  // ==========================================================================
  // [G005 v3.0.6.11-105 Wave 1C] 国标报告书写规范 (RQI-RWS-03)
  // ==========================================================================

  /** 国标书写规范规则集 (可序列化) */
  getNationalRwsRules(): RwsRuleList {
    const data = listRwsRuleMeta()
    return {
      source: 'national',
      generatedAt: new Date().toISOString(),
      standard: RWS_STANDARD,
      target: RWS_TARGET,
      rateFormula: RWS_RATE_FORMULA,
      ruleCount: data.length,
      data,
    }
  }

  /** 按国标口径评估单份报告 */
  evaluateRws(input: RwsReportInput): RwsEvaluation {
    const failures = detectRws(input)
    const compliant = failures.length === 0
    return {
      source: 'national',
      generatedAt: new Date().toISOString(),
      reportId: input.reportId,
      compliant,
      failures,
      numerator: compliant ? 1 : 0,
      denominator: 1,
      rate: compliant ? 100 : 0,
      standard: RWS_STANDARD,
      target: RWS_TARGET,
      rateExplanation: RWS_RATE_FORMULA,
    }
  }

  /** 批量评估 → 书写规范率 */
  computeRwsRate(reports: RwsReportInput[]): RwsRateResult {
    const results = reports.map((report) => {
      const evaluation = this.evaluateRws(report)
      return {
        reportId: report.reportId,
        compliant: evaluation.compliant,
        failureCodes: evaluation.failures.map((f) => f.code),
      }
    })
    const denominator = results.length
    const numerator = results.filter((r) => r.compliant).length
    const rate = denominator === 0 ? 0 : Math.round((numerator / denominator) * 10000) / 100
    return {
      source: 'national',
      generatedAt: new Date().toISOString(),
      standard: RWS_STANDARD,
      target: RWS_TARGET,
      numerator,
      denominator,
      totalReports: denominator,
      rate,
      rateExplanation: RWS_RATE_FORMULA,
      results,
    }
  }
}
