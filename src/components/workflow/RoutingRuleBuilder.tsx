/**
 * G005 RIS v3.0.6.6 - RoutingRuleBuilder 可视化路由规则构建器
 * 80 点升级 - 条件组合 + 动作配置 + 优先级
 */

import React, { useState } from 'react';
import { Plus, Trash2, GripVertical, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import type {
  RoutingRule,
  RuleCondition,
  RuleOperator,
  RuleConditionGroup,
} from '../../types/workflow';

interface RoutingRuleBuilderProps {
  rules: RoutingRule[];
  onChange: (rules: RoutingRule[]) => void;
  readonly?: boolean;
}

const FIELD_OPTIONS = [
  { value: 'modality', label: '设备类型 (modality)' },
  { value: 'priority', label: '优先级 (priority)' },
  { value: 'patientType', label: '患者类型 (patientType)' },
  { value: 'age', label: '年龄 (age)' },
  { value: 'waitingMinutes', label: '等待分钟 (waitingMinutes)' },
  { value: 'criticalFinding', label: '危急值 (criticalFinding)' },
  { value: 'siteId', label: '院区 (siteId)' },
  { value: 'doctorId', label: '指派医生 (doctorId)' },
  { value: 'bodyPart', label: '检查部位 (bodyPart)' },
];

const OPERATOR_OPTIONS: Array<{ value: RuleOperator; label: string; types: ('string' | 'number' | 'boolean' | 'array')[] }> = [
  { value: 'equal', label: '等于 (==)', types: ['string', 'number', 'boolean'] },
  { value: 'notEqual', label: '不等于 (!=)', types: ['string', 'number', 'boolean'] },
  { value: 'lessThan', label: '小于 (<)', types: ['number'] },
  { value: 'lessThanInclusive', label: '小于等于 (≤)', types: ['number'] },
  { value: 'greaterThan', label: '大于 (>)', types: ['number'] },
  { value: 'greaterThanInclusive', label: '大于等于 (≥)', types: ['number'] },
  { value: 'in', label: '包含于 (in)', types: ['array'] },
  { value: 'notIn', label: '不包含于 (not in)', types: ['array'] },
  { value: 'contains', label: '字符串包含', types: ['string'] },
  { value: 'doesNotContain', label: '字符串不包含', types: ['string'] },
];

const EVENT_TYPES = [
  { value: 'assign_doctor', label: '分配医生' },
  { value: 'escalate', label: '升级' },
  { value: 'redirect_site', label: '转院区' },
  { value: 'flag_critical', label: '标记危急值' },
  { value: 'notify', label: '发送通知' },
];

function emptyCondition(): RuleCondition {
  return { fact: 'modality', operator: 'equal', value: 'CT' };
}

function newRule(): RoutingRule {
  return {
    id: `r_${Math.random().toString(36).slice(2, 8)}`,
    name: '新规则',
    priority: 1,
    enabled: true,
    conditions: { all: [emptyCondition()] },
    event: { type: 'assign_doctor' },
    target: {},
    explanation: '',
  };
}

// 容错: 后端 mock 或老数据可能缺少字段 (event/target/conditions)
function safeRule(rule: RoutingRule): RoutingRule {
  return {
    ...rule,
    event: rule.event ?? { type: 'assign_doctor' },
    target: rule.target ?? {},
    conditions: rule.conditions ?? { all: [] },
    explanation: rule.explanation ?? '',
  };
}

export const RoutingRuleBuilder: React.FC<RoutingRuleBuilderProps> = ({ rules, onChange, readonly = false }) => {
  const [selectedId, setSelectedId] = useState<string | null>(rules[0]?.id ?? null);

  const selectedRaw = rules.find((r) => r.id === selectedId) ?? null;
  const selected = selectedRaw ? safeRule(selectedRaw) : null;

  const update = (next: RoutingRule[]) => onChange(next);

  const handleAdd = () => {
    const rule = newRule();
    update([...rules, rule]);
    setSelectedId(rule.id);
  };

  const handleDelete = (id: string) => {
    update(rules.filter((r) => r.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleUpdateRule = (rule: RoutingRule) => {
    update(rules.map((r) => (r.id === rule.id ? rule : r)));
  };

  const handleAddCondition = () => {
    if (!selected) return;
    const conditions = selected.conditions;
    if ('all' in conditions) {
      handleUpdateRule({ ...selected, conditions: { all: [...conditions.all, emptyCondition()] } });
    } else if ('any' in conditions) {
      handleUpdateRule({ ...selected, conditions: { any: [...conditions.any, emptyCondition()] } });
    }
  };

  const handleUpdateCondition = (idx: number, next: RuleCondition) => {
    if (!selected) return;
    const conditions = selected.conditions;
    if ('all' in conditions) {
      const list = [...conditions.all];
      list[idx] = next;
      handleUpdateRule({ ...selected, conditions: { all: list } });
    } else if ('any' in conditions) {
      const list = [...conditions.any];
      list[idx] = next;
      handleUpdateRule({ ...selected, conditions: { any: list } });
    }
  };

  const handleRemoveCondition = (idx: number) => {
    if (!selected) return;
    const conditions = selected.conditions;
    if ('all' in conditions) {
      handleUpdateRule({ ...selected, conditions: { all: conditions.all.filter((_, i) => i !== idx) } });
    } else if ('any' in conditions) {
      handleUpdateRule({ ...selected, conditions: { any: conditions.any.filter((_, i) => i !== idx) } });
    }
  };

  const switchCombinator = (kind: 'all' | 'any') => {
    if (!selected) return;
    const list = flatten(selected.conditions);
    handleUpdateRule({ ...selected, conditions: kind === 'all' ? { all: list } : { any: list } });
  };

  return (
    <div style={{ display: 'flex', height: '100%', background: 'var(--bg-card)' }}>
      <aside style={{ width: 280, background: '#fff', borderRight: '1px solid #e2e8f0', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, color: '#1e40af' }}>规则列表 ({rules.length})</span>
          <button onClick={handleAdd} disabled={readonly} style={addBtnStyle}>
            <Plus size={12} /> 新建
          </button>
        </div>
        <div style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
          {rules.map((rawRule) => {
            const rule = safeRule(rawRule);
            return (
            <div
              key={rule.id}
              onClick={() => setSelectedId(rule.id)}
              style={{
                background: selectedId === rule.id ? '#dbeafe' : 'var(--bg-card)',
                border: `1px solid ${selectedId === rule.id ? '#3b82f6' : '#e2e8f0'}`,
                padding: 8,
                borderRadius: 6,
                marginBottom: 6,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <GripVertical size={12} color="#94a3b8" />
                <span style={{ fontWeight: 600, color: '#1e40af', fontSize: 13, flex: 1 }}>{rule.name}</span>
                <span style={{ fontSize: 12, color: rule.active ? '#059669' : '#94a3b8' }}>
                  {rule.active ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                </span>
                <button onClick={(e) => { e.stopPropagation(); handleDelete(rule.id); }} disabled={readonly} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                  <Trash2 size={12} color="#dc2626" />
                </button>
              </div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                优先级 {rule.priority} · 动作 {rule.event.type}
              </div>
            </div>
            );
          })}
        </div>
      </aside>
      <main style={{ flex: 1, padding: 16, overflowY: 'auto' }}>
        {selected ? (
          <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: '1px solid #e2e8f0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={labelStyle}>规则名称</label>
                <input
                  value={selected.name}
                  onChange={(e) => handleUpdateRule({ ...selected, name: e.target.value })}
                  disabled={readonly}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>优先级</label>
                <input
                  type="number"
                  value={selected.priority}
                  onChange={(e) => handleUpdateRule({ ...selected, priority: Number(e.target.value) })}
                  disabled={readonly}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>启用</label>
                <select
                  value={selected.active ? 'yes' : 'no'}
                  onChange={(e) => handleUpdateRule({ ...selected, active: e.target.value === 'yes' })}
                  disabled={readonly}
                  style={inputStyle}
                >
                  <option value="yes">启用</option>
                  <option value="no">停用</option>
                </select>
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={sectionTitleStyle}>条件</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => switchCombinator('all')} disabled={readonly} style={tabBtnStyle('all' in selected.conditions)}>全部满足</button>
                  <button onClick={() => switchCombinator('any')} disabled={readonly} style={tabBtnStyle('any' in selected.conditions)}>任一满足</button>
                  <button onClick={handleAddCondition} disabled={readonly} style={addBtnStyle}>
                    <Plus size={12} /> 条件
                  </button>
                </div>
              </div>
              {flatten(selected.conditions).map((c, idx) => (
                <div key={idx} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 8, alignItems: 'center', marginTop: 8 }}>
                  <select value={c.fact} onChange={(e) => handleUpdateCondition(idx, { ...c, fact: e.target.value })} disabled={readonly} style={inputStyle}>
                    {FIELD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <select value={c.operator} onChange={(e) => handleUpdateCondition(idx, { ...c, operator: e.target.value as RuleOperator })} disabled={readonly} style={inputStyle}>
                    {OPERATOR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    value={String(Array.isArray(c.value) ? c.value.join(',') : c.value)}
                    onChange={(e) => {
                      const raw = e.target.value;
                      const op = OPERATOR_OPTIONS.find((o) => o.value === c.operator);
                      const nextValue: RuleCondition['value'] = op?.types.includes('array')
                        ? raw.split(',').map((s) => s.trim()).filter(Boolean)
                        : op?.types.includes('number')
                          ? Number(raw)
                          : raw;
                      handleUpdateCondition(idx, { ...c, value: nextValue });
                    }}
                    disabled={readonly}
                    style={inputStyle}
                  />
                  <button onClick={() => handleRemoveCondition(idx)} disabled={readonly} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                    <Trash2 size={14} color="#dc2626" />
                  </button>
                </div>
              ))}
            </div>

            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>触发动作</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 8 }}>
                <select
                  value={selected.event.type}
                  onChange={(e) => handleUpdateRule({ ...selected, event: { ...selected.event, type: e.target.value } })}
                  disabled={readonly}
                  style={inputStyle}
                >
                  {EVENT_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input
                  placeholder="目标医生 ID"
                  value={selected.target?.doctorId ?? ''}
                  onChange={(e) => handleUpdateRule({ ...selected, target: { ...selected.target, doctorId: e.target.value } })}
                  disabled={readonly}
                  style={inputStyle}
                />
                <input
                  placeholder="目标院区"
                  value={selected.target?.siteId ?? ''}
                  onChange={(e) => handleUpdateRule({ ...selected, target: { ...selected.target, siteId: e.target.value } })}
                  disabled={readonly}
                  style={inputStyle}
                />
              </div>
            </div>

            <div style={sectionStyle}>
              <div style={sectionTitleStyle}>说明</div>
              <textarea
                value={selected.explanation ?? ''}
                onChange={(e) => handleUpdateRule({ ...selected, explanation: e.target.value })}
                disabled={readonly}
                rows={2}
                style={{ ...inputStyle, fontFamily: 'inherit', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, color: '#1e40af', fontSize: 12 }}>
              <ArrowRight size={12} color="#1e40af" />
              动作: {selected.event.type}
              {selected.target?.doctorId && <span> → 医生 {selected.target.doctorId}</span>}
              {selected.target?.siteId && <span> → 院区 {selected.target.siteId}</span>}
            </div>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>请选择左侧规则进行编辑</div>
        )}
      </main>
    </div>
  );
};

function flatten(group: RuleConditionGroup): RuleCondition[] {
  if ('fact' in group) return [group];
  if ('all' in group) return group.all.map((c) => flatten(c as RuleConditionGroup)).flat();
  if ('any' in group) return group.any.map((c) => flatten(c as RuleConditionGroup)).flat();
  return [];
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, color: '#475569', fontWeight: 600, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: '100%', padding: '6px 10px', border: '1px solid #e2e8f0', borderRadius: 6, fontSize: 12, color: '#1e40af', background: '#fff' };
const sectionStyle: React.CSSProperties = { marginTop: 16, padding: 12, background: 'var(--bg-card)', borderRadius: 8 };
const sectionTitleStyle: React.CSSProperties = { fontWeight: 700, color: '#1e40af', fontSize: 13 };
const addBtnStyle: React.CSSProperties = { background: '#fff', border: '1px solid #cbd5e1', color: '#1e40af', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };

const tabBtnStyle = (active: boolean): React.CSSProperties => ({
  background: active ? '#1e40af' : '#fff',
  color: active ? '#fff' : '#1e40af',
  border: '1px solid #cbd5e1',
  padding: '4px 10px',
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
});

export default RoutingRuleBuilder;