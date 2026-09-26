/**
 * G005 RIS v3.0.6.6 - 路由规则引擎
 * 60 点升级 - 基于 json-rules-engine 的工作流路由
 */

import { Engine } from 'json-rules-engine';
import type {
  RoutingRule,
  RoutingDecision,
  RuleAllCondition,
  RuleAnyCondition,
  RuleCondition,
  RuleConditionGroup,
} from '../../../types/workflow';
import type { TopLevelCondition } from 'json-rules-engine';

export interface EvaluationFacts {
  [key: string]: unknown;
}

export interface RoutingEvaluationContext {
  studyId: string;
  modality?: string;
  priority?: string;
  patientType?: string;
  age?: number;
  waitingMinutes?: number;
  siteId?: string;
  criticalFinding?: boolean;
  doctorId?: string;
  [key: string]: unknown;
}

export interface ExplainResult {
  ruleId: string;
  ruleName: string;
  matched: boolean;
  reason: string;
  conditions: Array<{ fact: string; operator: string; value: unknown; evaluated: boolean }>;
  triggeredEvent?: { type: string; params?: Record<string, unknown> };
  target?: RoutingRule['target'];
}

function isAll(group: RuleConditionGroup): group is RuleAllCondition {
  const candidate = group as { all?: unknown };
  return Array.isArray(candidate.all);
}

function isAny(group: RuleConditionGroup): group is RuleAnyCondition {
  const candidate = group as { any?: unknown };
  return Array.isArray(candidate.any);
}

function isLeaf(group: RuleConditionGroup): group is RuleCondition {
  const candidate = group as { fact?: unknown };
  return typeof candidate.fact === 'string';
}

function flattenConditions(group: RuleConditionGroup): RuleCondition[] {
  if (isLeaf(group)) return [group];
  if (isAll(group)) {
    return (group.all as RuleConditionGroup[]).flatMap((c) => flattenConditions(c));
  }
  if (isAny(group)) {
    return (group.any as RuleConditionGroup[]).flatMap((c) => flattenConditions(c));
  }
  return [];
}

export class RoutingEngine {
  private engine: Engine;
  private rules: RoutingRule[] = [];

  constructor(initialRules: RoutingRule[] = []) {
    this.engine = new Engine();
    this.rules = [...initialRules];
    for (const rule of this.rules) {
      this.engine.addRule({
        name: rule.id,
        priority: rule.priority,
        conditions: rule.active ? (rule.conditions as TopLevelCondition) : { all: [] },
        event: rule.event,
      });
    }
  }

  addRule(rule: RoutingRule): void {
    this.rules.push(rule);
    if (rule.active) {
      this.engine.addRule({
        name: rule.id,
        priority: rule.priority,
        conditions: rule.conditions as TopLevelCondition,
        event: rule.event,
      });
    }
  }

  removeRule(ruleId: string): boolean {
    const idx = this.rules.findIndex((r) => r.id === ruleId);
    if (idx === -1) return false;
    this.rules.splice(idx, 1);
    this.engine.removeRule(ruleId);
    return true;
  }

  toggle(ruleId: string, enabled: boolean): void {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) return;
    rule.active = enabled;
    if (enabled) {
      this.engine.addRule({
        name: rule.id,
        priority: rule.priority,
        conditions: rule.conditions as TopLevelCondition,
        event: rule.event,
      });
    } else {
      this.engine.removeRule(ruleId);
    }
  }

  list(): RoutingRule[] {
    return [...this.rules];
  }

  async evaluate(facts: RoutingEvaluationContext): Promise<RoutingDecision> {
    const enriched: EvaluationFacts = { ...facts };
    const result = await this.engine.run(enriched);
    const matchedRules: RoutingDecision['matchedRules'] = [];
    const triggeredEvents: RoutingDecision['triggeredEvents'] = [];
    let finalTarget: RoutingRule['target'] | undefined;

    for (const r of result.results) {
      const rule = this.rules.find((rr) => rr.id === r.name);
      if (!rule) continue;
      matchedRules.push({ rule, ruleResult: r.toJSON(false) as Record<string, unknown> });
      triggeredEvents.push(r.event ?? rule.event);
      finalTarget = finalTarget ?? rule.target;
    }

    return {
      matchedRules,
      finalTarget,
      triggeredEvents,
    };
  }

  explain(ruleId: string, facts: RoutingEvaluationContext): ExplainResult {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (!rule) {
      return {
        ruleId,
        ruleName: '(unknown)',
        matched: false,
        reason: '规则未找到',
        conditions: [],
      };
    }
    const conditions = flattenConditions(rule.conditions);
    const evaluated = conditions.map((c) => ({
      fact: c.fact,
      operator: c.operator,
      value: c.value,
      evaluated: this.testCondition(c, facts),
    }));
    const matched = evaluated.every((e) => e.evaluated);
    return {
      ruleId,
      ruleName: rule.name,
      matched,
      reason: matched
        ? rule.explanation ?? '所有条件满足,触发路由'
        : '存在不满足的条件',
      conditions: evaluated,
      triggeredEvent: rule.event,
      target: rule.target,
    };
  }

  private testCondition(c: RuleCondition, facts: RoutingEvaluationContext): boolean {
    const lhs = (facts as unknown as Record<string, unknown>)[c.fact];
    const rhs = c.value;
    switch (c.operator) {
      case 'equal':
        return lhs === rhs;
      case 'notEqual':
        return lhs !== rhs;
      case 'lessThan':
        return typeof lhs === 'number' && typeof rhs === 'number' && lhs < rhs;
      case 'lessThanInclusive':
        return typeof lhs === 'number' && typeof rhs === 'number' && lhs <= rhs;
      case 'greaterThan':
        return typeof lhs === 'number' && typeof rhs === 'number' && lhs > rhs;
      case 'greaterThanInclusive':
        return typeof lhs === 'number' && typeof rhs === 'number' && lhs >= rhs;
      case 'in':
        return Array.isArray(rhs) && (rhs as unknown[]).includes(lhs);
      case 'notIn':
        return Array.isArray(rhs) && !(rhs as unknown[]).includes(lhs);
      case 'contains':
        return typeof lhs === 'string' && typeof rhs === 'string' && lhs.includes(rhs);
      case 'doesNotContain':
        return typeof lhs === 'string' && typeof rhs === 'string' && !lhs.includes(rhs);
      default:
        return false;
    }
  }
}

export const routingEngine = new RoutingEngine();