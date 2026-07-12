;
import type { ChartPayload } from '../../types/analytics';

export interface SankeyProps {
  data: ChartPayload;
  title?: string;
}

const SANKEY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#dc2626', '#7c3aed', '#ec4899', '#0891b2'];

export default function Sankey({ data, title }: SankeyProps) {
  const links = data.series[0]?.data ?? [];
  const nodes: string[] = (data.meta?.nodes as string[]) ?? [];
  const maxVal = Math.max(...links.map(l => l.y), 1);

  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b', marginBottom: 12 }}>{title ?? data.title}</div>
      <div style={{ display: 'flex', gap: 40, alignItems: 'flex-start', justifyContent: 'center', minHeight: 180, position: 'relative' }}>
        {nodes.map((node, ni) => {
          const outLinks = links.filter(l => l.x === node);
          const inLinks = links.filter(l => (l.meta as Record<string, unknown> ?? {}).target === node);
          const totalOut = outLinks.reduce((s, l) => s + l.y, 0);
          const totalIn = inLinks.reduce((s, l) => s + l.y, 0);
          const total = Math.max(totalOut, totalIn || 1);
          const color = SANKEY_COLORS[ni % SANKEY_COLORS.length] ?? '#94a3b8';
          return (
            <div key={node} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, minWidth: 60 }}>
              <div style={{ width: 12, height: `${Math.max(20, (total / maxVal) * 120)}px`, background: color, borderRadius: '4px 4px 0 0', opacity: 0.8 }} />
              <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', textAlign: 'center' }}>{node}</div>
              <div style={{ fontSize: 12, color: '#94a3b8' }}>{totalOut || totalIn}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
