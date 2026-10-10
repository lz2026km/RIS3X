// [v3.0.6.11-103 Wave 9] 路由规则引擎: KPI 统计 + 刷新/导出 JSON + i18n (保持 RoutingRuleBuilder 集成)
import { useMemo, useState, useEffect } from 'react';
import { GitBranch, Play, Eye } from 'lucide-react';
import { Space, Tag, message } from 'antd';
import RoutingRuleBuilder from '../components/workflow/RoutingRuleBuilder';
import type { RoutingRule } from '../types/workflow';
import { RoutingEngine } from '../services/workflow/rules/RoutingEngine';
import { workflowApi } from '../services/api/workflowApi';
import type { RoutingRuleDto } from '../services/api/workflowApi';
import { t } from '../i18n/appI18n';
import { StatCard, StatCardGrid } from '../components/common/StatCard';
import { ActionButton } from '../components/common/ActionButton';
import { ErrorBanner } from '../components/feedback';
import { PageContainer } from "../components/common";

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
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const engine = useMemo(() => {
    const e = new RoutingEngine();
    rules.forEach((r) => e.addRule(r));
    return e;
  }, [rules]);
  const [results, setResults] = useState<Array<{ studyId: string; matched: string[]; target?: string }>>([]);

  useEffect(() => {
    void loadRules();
  }, []);

  const loadRules = async () => {
    setLoading(true);
    try {
      const res = await workflowApi.listRoutingRules();
      if (res.success && Array.isArray(res.data)) {
        setRules((res.data as RoutingRuleDto[]).map(toRoutingRule));
        setLoadError(null);
      } else {
        setLoadError(t('w9.states.error'));
      }
    } catch {
      setLoadError(t('w9.states.error'));
    } finally {
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
        message.error(`${t('w9.routing.save')} "${rule.name}" 失败: ${res.error?.message ?? ''}`);
        return;
      }
    }
    message.success(t('w9.routing.saved'));
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

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `routing-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success(t('w9.routing.exported'));
  };

  const activeCount = rules.filter((r) => r.active).length;
  const inactiveCount = rules.length - activeCount;
  const simMatched = results.reduce((s, r) => s + r.matched.length, 0);

  return (
    <PageContainer background="none" maxWidth="fluid" padding={0} minHeight="auto" style={{ height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
      <header style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#ec4899 100%)', color: '#fff', padding: '14px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <GitBranch size={20} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{t('w9.routing.title')}</div>
            <div style={{ fontSize: 12, opacity: 0.85 }}>{t('w9.routing.subtitle')}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <ActionButton action="refresh" size="compact" loading={loading} onClick={() => void loadRules()}>
              {t('w9.common.refresh')}
            </ActionButton>
            <ActionButton action="export" size="compact" disabled={rules.length === 0} onClick={handleExport}>
              {t('w9.routing.exportJson')}
            </ActionButton>
            <ActionButton action="submit" size="compact" onClick={() => void runSimulation()} icon={<Play size={12} />}>
              {t('w9.routing.simulate')}
            </ActionButton>
            <ActionButton action="save" size="compact" onClick={() => void handleSave()}>
              {t('w9.routing.save')}
            </ActionButton>
          </div>
        </div>
      </header>
      {loadError && !loading && (
        <div style={{ padding: '12px 24px 0' }}>
          <ErrorBanner message={loadError} />
        </div>
      )}
      <div style={{ padding: '12px 24px 0' }}>
        <StatCardGrid minWidth={180} style={{ marginBottom: 'var(--space-3, 12px)' }}>
          <StatCard title={t('w9.routing.statsTotal')} value={rules.length} color="primary" size="sm" />
          <StatCard title={t('w9.routing.statsActive')} value={activeCount} color="success" size="sm" />
          <StatCard title={t('w9.routing.statsInactive')} value={inactiveCount} color="warning" size="sm" />
          <StatCard title={t('w9.routing.statsSimMatched')} value={simMatched} color="error" size="sm" />
        </StatCardGrid>
      </div>
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 320px', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid var(--border-color)' }}>
          <RoutingRuleBuilder rules={rules} onChange={handleRulesChange} />
        </div>
        <aside style={{ background: 'var(--bg-card)', padding: 'var(--space-3, 12px)', overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2, 8px)' }}>
            <Eye size={14} color="var(--color-primary-800)" />
            <span style={{ fontWeight: 700, color: 'var(--color-primary-800)' }}>{t('w9.routing.simResult')}</span>
          </div>
          {results.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('w9.routing.simHint')}</div>
          ) : (
            results.map((r) => (
              <div key={r.studyId} style={{ background: 'var(--bg-primary)', padding: 'var(--space-2, 8px)', borderRadius: 6, marginBottom: 6, border: '1px solid var(--border-color)' }}>
                <div style={{ fontWeight: 700, color: 'var(--color-primary-800)', fontSize: 12 }}>{r.studyId}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                  {t('w9.routing.hit')}: {r.matched.length === 0 ? t('w9.routing.noHit') : r.matched.join(', ')}
                </div>
                {r.target && <div style={{ fontSize: 12, color: '#059669' }}>→ {r.target}</div>}
              </div>
            ))
          )}
          <div style={{ marginTop: 'var(--space-3, 12px)' }}>
            <Space wrap>
              <Tag color="purple">{t('w9.routing.statsTotal')}: {rules.length}</Tag>
              <Tag color="green">{t('w9.routing.statsActive')}: {activeCount}</Tag>
            </Space>
          </div>
        </aside>
      </div>
    </PageContainer>
  );
}
