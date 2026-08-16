// [G005 v3.0.6.11-101 Wave 6A F11] 报告质控规则引擎 — 确定性执行器
// 报告文本 → 逐规则匹配 → 违规列表 (规则名/级别/位置/建议), 输出顺序确定 (级别 error>warning>info, 再按 code)
import type {
  EvaluateInput,
  EvaluateResult,
  QualityRule,
  RuleCondition,
  RuleField,
  RuleOperator,
  RuleViolation,
} from './report-rules.types'

const SEVERITY_RANK: Record<string, number> = { error: 0, warning: 1, info: 2 }

function fieldText(input: EvaluateInput, field: RuleField): string {
  if (field === 'fullText') {
    return [
      input.findings ?? '',
      input.diagnosis ?? '',
      input.impression ?? '',
      input.conclusion ?? '',
      input.recommendations ?? '',
    ].join('\n')
  }
  return input[field] ?? ''
}

const matchIndex = (text: string, needle: string): number => text.indexOf(needle)

function alternatives(value: string | number): string[] {
  return String(value)
    .split('|')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// 单条件求值: 命中返回 { ok: true, position, snippet } 否则 ok:false
export function evaluateCondition(text: string, cond: RuleCondition): { ok: boolean; position: number; snippet: string } {
  const op: RuleOperator = cond.operator
  const val = cond.value
  switch (op) {
    case 'empty':
      return text.trim().length === 0
        ? { ok: true, position: 0, snippet: '(空)' }
        : { ok: false, position: -1, snippet: '' }
    case 'not_empty':
      return text.trim().length > 0
        ? { ok: true, position: 0, snippet: text.slice(0, 20) }
        : { ok: false, position: -1, snippet: '' }
    case 'contains': {
      for (const alt of alternatives(val)) {
        const pos = matchIndex(text, alt)
        if (pos >= 0) return { ok: true, position: pos, snippet: text.slice(pos, pos + alt.length) }
      }
      return { ok: false, position: -1, snippet: '' }
    }
    case 'not_contains': {
      for (const alt of alternatives(val)) {
        if (matchIndex(text, alt) >= 0) return { ok: false, position: -1, snippet: '' }
      }
      return { ok: true, position: 0, snippet: text.slice(0, 20) }
    }
    case 'regex': {
      try {
        const re = new RegExp(String(val))
        const m = re.exec(text)
        if (m) return { ok: true, position: m.index, snippet: m[0] ?? text.slice(m.index, m.index + 20) }
      } catch {
        return { ok: false, position: -1, snippet: '' }
      }
      return { ok: false, position: -1, snippet: '' }
    }
    case 'length_lt':
      return text.trim().length < Number(val)
        ? { ok: true, position: 0, snippet: text.slice(0, 20) }
        : { ok: false, position: -1, snippet: '' }
    case 'length_gte':
      return text.trim().length >= Number(val)
        ? { ok: true, position: 0, snippet: text.slice(0, 20) }
        : { ok: false, position: -1, snippet: '' }
    case 'numeric_over': {
      const spec = String(val)
      const mSpec = /^(\d+(?:\.\d+)?)\s*([A-Za-z%μ°²³]+)$/.exec(spec)
      if (!mSpec) return { ok: false, position: -1, snippet: '' }
      const threshold = Number(mSpec[1])
      const unit = mSpec[2].replace(/\s/g, '')
      const numRe = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${unit}`, 'g')
      let mNum: RegExpExecArray | null
      while ((mNum = numRe.exec(text)) !== null) {
        if (Number(mNum[1]) > threshold) {
          return { ok: true, position: mNum.index, snippet: mNum[0] }
        }
      }
      return { ok: false, position: -1, snippet: '' }
    }
    case 'dup_count': {
      const minCount = Math.max(2, Number(val) || 2)
      const chars = text.trim()
      // 4-8 字窗口滑动, 统计重复出现次数 (确定性的首个命中)
      for (let windowSize = 8; windowSize >= 4; windowSize--) {
        for (let i = 0; i + windowSize <= chars.length; i++) {
          const token = chars.slice(i, i + windowSize)
          if (token.includes('。') || token.includes(',') || token.includes('，')) continue
          let count = 0
          let from = 0
          while (from >= 0) {
            const hit = text.indexOf(token, from)
            if (hit < 0) break
            count += 1
            from = hit + 1
          }
          if (count >= minCount) {
            return { ok: true, position: text.indexOf(token), snippet: token }
          }
        }
      }
      return { ok: false, position: -1, snippet: '' }
    }
    default:
      return { ok: false, position: -1, snippet: '' }
  }
}

// 执行单条规则: 前置条件 when 满足时求值主条件
export function evaluateRule(input: EvaluateInput, rule: QualityRule): RuleViolation | null {
  if (!rule.enabled) return null
  const cond = rule.condition
  const main = evaluateCondition(fieldText(input, cond.field), cond)
  if (!main.ok) return null
  if (cond.when) {
    const when = evaluateCondition(fieldText(input, cond.when.field), cond.when)
    if (!when.ok) return null
  }
  return {
    ruleId: rule.id,
    ruleCode: rule.code,
    ruleName: rule.name,
    type: rule.type,
    severity: rule.severity,
    field: cond.field,
    position: main.position,
    snippet: main.snippet,
    suggestion: rule.suggestion,
  }
}

// 执行全部规则 → 违规列表 (确定性排序)
export function executeRules(input: EvaluateInput, rules: QualityRule[]): EvaluateResult {
  const enabled = rules.filter((r) => r.enabled)
  const violations: RuleViolation[] = []
  for (const rule of enabled) {
    const hit = evaluateRule(input, rule)
    if (hit) violations.push(hit)
  }
  violations.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity]! - SEVERITY_RANK[b.severity]!
    if (rankDiff !== 0) return rankDiff
    return a.ruleCode.localeCompare(b.ruleCode)
  })
  const errorCount = violations.filter((v) => v.severity === 'error').length
  const warningCount = violations.filter((v) => v.severity === 'warning').length
  const infoCount = violations.filter((v) => v.severity === 'info').length
  const score = Math.max(0, Math.min(100, 100 - errorCount * 20 - warningCount * 10 - infoCount * 3))
  return {
    source: 'demo',
    generatedAt: new Date().toISOString(),
    reportId: input.reportId,
    ruleCount: rules.length,
    enabledRuleCount: enabled.length,
    violations,
    score,
  }
}

export function severityRank(severity: string): number {
  return SEVERITY_RANK[severity] ?? 9
}
