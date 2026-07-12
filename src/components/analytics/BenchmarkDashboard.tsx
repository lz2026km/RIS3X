import type { BenchmarkGap } from '../../types/analytics';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

export interface BenchmarkDashboardProps {
  gaps: BenchmarkGap[];
  standardName?: string;
  title?: string;
}

const STATUS_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  exceeds: { icon: CheckCircle2, color: '#10b981', label: '超出' },
  meets: { icon: CheckCircle2, color: '#3b82f6', label: '达标' },
  lags: { icon: AlertTriangle, color: '#f59e0b', label: '落后' },
  critical: { icon: XCircle, color: '#dc2626', label: '严重落后' },
};

export default function BenchmarkDashboard({ gaps, standardName, title }: BenchmarkDashboardProps) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', padding: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{title ?? '基准对标'}</span>
        {standardName && <span style={{ fontSize: 12, color: '#94a3b8' }}>{standardName}</span>}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              <th style={thStyle}>指标</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>我方</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>基准</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>差距</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {gaps.map(g => {
              const meta = STATUS_META[g.status] ?? STATUS_META.critical!;
              const Icon = meta.icon;
              return (
                <tr key={g.metricCode}>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{g.metricName}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>{g.ours}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#94a3b8' }}>{g.benchmark}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: g.delta > 0 ? '#10b981' : '#dc2626' }}>
                    {g.delta > 0 ? '+' : ''}{g.deltaPercent}%
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: meta.color, fontSize: 12, fontWeight: 600 }}>
                      <Icon size={12} /> {meta.label}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: '5px 8px', borderBottom: '2px solid #e2e8f0',
  color: '#64748b', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', borderBottom: '1px solid #f1f5f9', color: '#1e293b',
};
