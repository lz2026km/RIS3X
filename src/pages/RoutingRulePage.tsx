import React, { useMemo, useState, useEffect } from 'react';
import { GitBranch, Play, Save, Eye } from 'lucide-react';
import { message } from 'antd';
import RoutingRuleBuilder from '../components/workflow/RoutingRuleBuilder';
import type { RoutingRule } from '../types/workflow';
import { RoutingEngine } from '../services/workflow/rules/RoutingEngine';
import { workflowApi } from '../services/api/workflowApi';
import type { RoutingRuleDto } from '../services/api/workflowApi';

const SAMPLE_FACTS = [
  { studyId: 'S-001', modality: 'CT', priority: 'critical', patientType: '急诊', age: 65, waitingMinutes: 5, criticalFinding: true },
  { studyId: 'S-002', modality: 'MR', priority: 'urgent', patientType: '门诊', age: 45, waitingMinutes: 75, criticalFinding: false },
  { studyId: 'S-003', modality: 'CT', priority: 'normal', patientType: '住院', age: 78, waitingMinutes: 30, criticalFinding: false },
];

function toRoutingRule(dto: RoutingRuleDto): RoutingRule {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    priority: dto.priority,
    active: dto.active,
    conditions: dto.conditions as unknown as RoutingRule['conditions'],
    event: dto.event as unknown as RoutingRule['event'],
    target: dto.target as unknown as RoutingRule['target'],
    explanation: dto.explanation,
  };
}

function toDto(rule: RoutingRule): Partial<RoutingRuleDto> {
  return {
    name: rule.name,
    description: rule.description,
    priority: rule.priority,
    active: rule.active,
    conditions: rule.conditions as unknown as Record<string, unknown>,
    event: rule.event as unknown as Record<string, unknown>,
    target: rule.target as unknown as Record<string, unknown> | undefined,
    explanation: rule.explanation,
  };
}

export default function RoutingRulePage() {
  const [rules, setRules] = useState<RoutingRule[]>([]);
  const [_loading, setLoading] = useState(false);
  const engine = useMemo(() => {
    const e = new RoutingEngine();
    rules.forEach((r) => e.addRule(r));
    return e;
  }, [rules]);
  const [results, setResults] = useState<Array<{ studyId: string; matched: string[]; target?: string }>>([]);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await workflowApi.listRoutingRules();
      if (res.success && Array.isArray(res.data)) {
        setRules((res.data as RoutingRuleDto[]).map(toRoutingRule));
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  };

  const handleRulesChange = async (next: RoutingRule[]) => {
    setRules(next);
  };

  const handleSave = async () => {
    for (const rule of rules) {
      const dto = toDto(rule);
      const res = await workflowApi.updateRoutingRule(rule.id, dto);
      if (!res.success) {
        message.error(`保存规则 "${rule.name}" 失败: ${res.error?.message ?? ''}`);
        return;
      }
    }
    message.success('全部规则已保存');
  };

  const runSimulation = async () => {
    const out: Array<{ studyId: string; matched: string[]; target?: string }> = [];
    for (const fact of SAMPLE_FACTS) {
      const decision = await engine.evaluate(fact);
      out.push({
        studyId: fact.studyId,
        matched: decision.matchedRules.map((m) => m.rule.name),
        target: decision.finalTarget?.doctorId ?? decision.finalTarget?.siteId,
      });
    }
    setResults(out);
  };

  return (
    <div style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: '#f8fafc' }}>
      <header style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#ec4899 100%)', color: '#fff', padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GitBranch size={20} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>路由规则引擎</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>基于 json-rules-engine 的可视化条件编排</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button onClick={runSimulation} style={btnPrimary}>
              <Play size={12} /> 模拟执行
            </button>
            <button onClick={handleSave} style={btnSecondary}><Save size={12} /> 保存</button>
          </div>
        </div>
      </header>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid #e2e8f0' }}>
          <RoutingRuleBuilder rules={rules} onChange={handleRulesChange} />
        </div>
        <aside style={{ background: '#fff', padding: 12, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <Eye size={14} color="#1e40af" />
            <span style={{ fontWeight: 700, color: '#1e40af' }}>模拟结果</span>
          </div>
          {results.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8' }}>点击「模拟执行」查看规则命中情况</div>
          ) : (
            results.map((r) => (
              <div key={r.studyId} style={{ background: '#f1f5f9', padding: 8, borderRadius: 6, marginBottom: 6 }}>
                <div style={{ fontWeight: 700, color: '#1e40af', fontSize: 12 }}>{r.studyId}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  命中: {r.matched.length === 0 ? '无' : r.matched.join(', ')}
                </div>
                {r.target && <div style={{ fontSize: 12, color: '#059669' }}>→ {r.target}</div>}
              </div>
            ))
          )}
        </aside>
      </div>
    </div>
  );
}

const btnPrimary: React.CSSProperties = { background: '#fff', color: '#7c3aed', border: 'none', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 };
const btnSecondary: React.CSSProperties = { background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1px solid rgba(255,255,255,0.4)', padding: '6px 14px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700 };