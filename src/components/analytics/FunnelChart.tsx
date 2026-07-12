;
import type { ChartPayload } from '../../types/analytics';

export interface FunnelChartProps {
  data: ChartPayload;
  title?: string;
}

const FUNNEL_COLORS = ['#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#dbeafe'];
function getColor(i: number): string {
  return FUNNEL_COLORS[i % FUNNEL_COLORS.length] ?? '#e2e8f0';
}

export default function FunnelChart({ data, title }: FunnelChartProps) {
  const stages = data.series[0]?.data ?? [];
  const maxVal = Math.max(...stages.map(s => s.y), 1);

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>{title ?? data.title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        {stages.map((s, i) => {
          const pct = (s.y / maxVal) * 100;
          const prev = i > 0 ? stages[i - 1]!.y : s.y;
          const conversion = i > 0 ? ((s.y / prev) * 100).toFixed(1) : '100';
          return (
            <div key={String(s.x)} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{ width: `${pct}%`, minWidth: 40, background: getColor(i), borderRadius: '4px 4px 0 0', padding: '6px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{s.y}</div>
              </div>
              <div style={{ fontSize: 12, color: '#475569', fontWeight: 500 }}>{String(s.x)}</div>
              {i < stages.length - 1 && (
                <div style={{ fontSize: 12, color: '#94a3b8' }}>转化率 {conversion}%</div>
              )}
              {i < stages.length - 1 && (
                <div style={{ width: 1, height: 8, background: '#e2e8f0' }} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
