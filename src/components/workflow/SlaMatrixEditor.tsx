/**
 * G005 RIS v3.0.6.6 - SLA 矩阵编辑器
 * 70 点升级 - modality × priority × SLA minutes
 */

import React, { useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import type { SLAPolicyConfig } from '../../types/workflow';

interface SlaMatrixEditorProps {
  policies: SLAPolicyConfig[];
  onChange: (policies: SLAPolicyConfig[]) => void;
  onSave?: (policies: SLAPolicyConfig[]) => void | Promise<void>;
}

const MODALITIES = ['CT', 'MR', 'DR', 'DSA', 'MG', 'US', 'PET-CT', 'RF'];
const PRIORITIES: Array<SLAPolicyConfig['priority']> = ['critical', 'urgent', 'normal'];

function emptyPolicy(modality: string, priority: SLAPolicyConfig['priority']): SLAPolicyConfig {
  return {
    modality,
    priority,
    minutesToReport: 60,
    minutesToReview: 60,
    minutesToPublish: 120,
    escalationMinutes: 90,
  };
}

export const SlaMatrixEditor: React.FC<SlaMatrixEditorProps> = ({ policies, onChange, onSave }) => {
  const [draft, setDraft] = useState<SLAPolicyConfig[]>(policies);

  const matrix = React.useMemo(() => {
    const map = new Map<string, SLAPolicyConfig>();
    for (const p of draft) {
      map.set(`${p.modality}|${p.priority}`, p);
    }
    return map;
  }, [draft]);

  const updateCell = (modality: string, priority: SLAPolicyConfig['priority'], patch: Partial<SLAPolicyConfig>) => {
    const key = `${modality}|${priority}`;
    const existing = matrix.get(key);
    if (existing) {
      const next = draft.map((p) => (p.modality === modality && p.priority === priority ? { ...p, ...patch } : p));
      setDraft(next);
    } else {
      setDraft([...draft, { ...emptyPolicy(modality, priority), ...patch }]);
    }
  };

  const removeCell = (modality: string, priority: SLAPolicyConfig['priority']) => {
    setDraft(draft.filter((p) => !(p.modality === modality && p.priority === priority)));
  };

  const handleSave = () => {
    onChange(draft);
    if (onSave) {
      const res = onSave(draft);
      if (res instanceof Promise) {
        res.catch((err) => {
          console.error('[SLA] save failed:', err);
        });
      }
    }
  };

  const handleAddAllMissing = () => {
    const missing: SLAPolicyConfig[] = [];
    for (const m of MODALITIES) {
      for (const p of PRIORITIES) {
        if (!matrix.has(`${m}|${p}`)) {
          missing.push(emptyPolicy(m, p));
        }
      }
    }
    setDraft([...draft, ...missing]);
  };

  return (
    <div style={{ background: '#fff', padding: 16, borderRadius: 10, border: '1px solid #e2e8f0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>SLA 策略矩阵</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>配置不同 modality × priority 的 SLA 阈值</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={handleAddAllMissing} style={btnSecondary}><Plus size={12} /> 补全缺失</button>
          <button onClick={handleSave} style={btnPrimary}><Save size={12} /> 保存</button>
        </div>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>Modality</th>
              {PRIORITIES.map((p) => (
                <th key={p} style={{ ...thStyle, color: p === 'critical' ? '#dc2626' : p === 'urgent' ? '#d97706' : '#475569' }}>
                  {p}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODALITIES.map((modality) => (
              <tr key={modality}>
                <td style={{ ...tdStyle, fontWeight: 700, color: '#1e3a5f' }}>{modality}</td>
                {PRIORITIES.map((priority) => {
                  const cell = matrix.get(`${modality}|${priority}`);
                  return (
                    <td key={priority} style={tdStyle}>
                      {cell ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {(['minutesToReport', 'minutesToReview', 'minutesToPublish', 'escalationMinutes'] as const).map((field) => (
                            <label key={field} style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                              <span style={{ width: 70, color: '#64748b' }}>{labelFor(field)}</span>
                              <input
                                type="number"
                                value={cell[field] ?? 0}
                                onChange={(e) => updateCell(modality, priority, { [field]: Number(e.target.value) } as Partial<SLAPolicyConfig>)}
                                style={inputStyle}
                              />
                              <span style={{ color: '#94a3b8' }}>min</span>
                            </label>
                          ))}
                          <button onClick={() => removeCell(modality, priority)} style={{ alignSelf: 'flex-end', background: 'none', border: 'none', cursor: 'pointer' }}>
                            <Trash2 size={12} color="#dc2626" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => updateCell(modality, priority, {})}
                          style={{ ...btnSecondary, fontSize: 12 }}
                        >
                          <Plus size={10} /> 添加
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

function labelFor(field: keyof SLAPolicyConfig): string {
  switch (field) {
    case 'minutesToReport': return '报告';
    case 'minutesToReview': return '审核';
    case 'minutesToPublish': return '发布';
    case 'escalationMinutes': return '升级';
    default: return '';
  }
}

const thStyle: React.CSSProperties = { background: '#f1f5f9', padding: 8, borderBottom: '1px solid #e2e8f0', textAlign: 'left', fontWeight: 700, color: '#1e3a5f' };
const tdStyle: React.CSSProperties = { padding: 8, borderBottom: '1px solid #e2e8f0', verticalAlign: 'top', minWidth: 180 };
const inputStyle: React.CSSProperties = { width: 60, padding: '2px 6px', border: '1px solid #e2e8f0', borderRadius: 4, fontSize: 12 };
const btnPrimary: React.CSSProperties = { background: '#1e3a5f', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 };
const btnSecondary: React.CSSProperties = { background: '#fff', color: '#1e3a5f', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 };

export default SlaMatrixEditor;