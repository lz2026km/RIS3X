import { useState, useCallback } from 'react';
import { GripVertical, X, Layout } from 'lucide-react';
import KpiCard from './KpiCard';
import type { KpiDefinition, KpiValue, KpiSnapshot } from '../../types/analytics';

export interface DashboardWidget {
  id: string;
  type: 'kpi' | 'chart' | 'heatmap' | 'table';
  kpiId?: string;
  title: string;
  w?: number;
  h?: number;
}

export interface DashboardProps {
  widgets: DashboardWidget[];
  snapshot: KpiSnapshot;
  definitions: KpiDefinition[];
  onAddWidget?: (type: DashboardWidget['type']) => void;
  onRemoveWidget?: (id: string) => void;
  onReorder?: (widgets: DashboardWidget[]) => void;
}

export default function Dashboard({ widgets, snapshot, definitions, onAddWidget, onRemoveWidget }: DashboardProps) {
  const [editing, setEditing] = useState(false);

  const getKpiValue = useCallback((kpiId: string): KpiValue | undefined => {
    return snapshot.values.find(v => v.kpiId === kpiId);
  }, [snapshot]);

  const getKpiDef = useCallback((kpiId: string): KpiDefinition | undefined => {
    return definitions.find(d => d.id === kpiId);
  }, [definitions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Layout size={16} color="#1e40af" />
          <span style={{ fontSize: 14, fontWeight: 700, color: '#1e293b' }}>自定义大盘</span>
          <span style={{ fontSize: 12, color: '#94a3b8' }}>{widgets.length} 个组件</span>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {onAddWidget && (
            <>
              <button onClick={() => onAddWidget('kpi')} style={btnStyle}>+ KPI</button>
              <button onClick={() => onAddWidget('chart')} style={btnStyle}>+ 图表</button>
              <button onClick={() => onAddWidget('heatmap')} style={btnStyle}>+ 热力图</button>
            </>
          )}
          <button onClick={() => setEditing(!editing)} style={{ ...btnStyle, background: editing ? '#3b82f6' : '#f1f5f9', color: editing ? '#fff' : '#475569' }}>
            {editing ? '完成' : '编辑'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {widgets.map(w => (
          <div key={w.id} style={{ position: 'relative', background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 12 }}>
            {editing && (
              <div style={{ position: 'absolute', top: 4, right: 4, left: 4, display: 'flex', justifyContent: 'space-between', zIndex: 10 }}>
                <GripVertical size={14} color="#94a3b8" />
                {onRemoveWidget && (
                  <button onClick={() => onRemoveWidget(w.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}>
                    <X size={14} color="#dc2626" />
                  </button>
                )}
              </div>
            )}
            {w.type === 'kpi' && w.kpiId && (() => {
              const def = getKpiDef(w.kpiId);
              const val = getKpiValue(w.kpiId);
              return def && val ? <KpiCard definition={def} value={val} /> : <div style={{ color: '#94a3b8', fontSize: 12 }}>加载中...</div>;
            })()}
            {w.type === 'heatmap' && <div style={{ height: 80, background: 'linear-gradient(90deg, #f0fdf4, #fef9c3, #fecaca)', borderRadius: 4 }} />}
            {w.type === 'chart' && <div style={{ height: 80, background: '#f8fafc', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: 12 }}>{w.title}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '3px 8px', border: '1px solid #e2e8f0', borderRadius: 4,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', background: '#f1f5f9', color: '#475569',
};
