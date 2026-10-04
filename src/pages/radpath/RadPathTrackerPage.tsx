import React, { useState, useEffect, useCallback } from 'react';
import { Search, Activity, CheckCircle2, XCircle, Clock, TrendingUp, PieChart, FileText, Microscope, AlertTriangle } from 'lucide-react';
import { radpathApi, type RadPathRecord, type RadPathStats } from '../../services/api/radpathApi';
import { StatCard } from '../../components/common';
import { t } from '../../i18n/appI18n';

const consistencyColor: Record<string, string> = {
  concordant: '#10b981', discordant: '#ef4444', pending: '#94a3b8',
};
const consistencyLabel: Record<string, string> = {
  concordant: 'radpath.consistency.concordant', discordant: 'radpath.consistency.discordant', pending: 'radpath.consistency.pending',
};

function Badge({ consistency }: { consistency: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 12, fontSize: 12, fontWeight: 600, background: `${consistencyColor[consistency]}20`, color: consistencyColor[consistency], border: `1px solid ${consistencyColor[consistency]}40` }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: consistencyColor[consistency] }} />
      {t(consistencyLabel[consistency] ?? consistency)}
    </span>
  );
}

export default function RadPathTrackerPage() {
  const [reportId, setReportId] = useState('');
  const [record, setRecord] = useState<RadPathRecord | null>(null);
  const [stats, setStats] = useState<RadPathStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    radpathApi.getStats().then(res => {
      if (res.success && res.data) setStats(res.data);
    }).catch((err) => { console.error('[F04]', err); });
  }, []);

  const handleSearch = useCallback(async () => {
    if (!reportId.trim()) return;
    setLoading(true); setError(''); setRecord(null);
    try {
      const res = await radpathApi.findByReport(reportId.trim());
      if (res.success && res.data) {
        setRecord(res.data);
      } else {
        throw new Error(res.error?.message || t('radpath.notFound'));
      }
    } catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [reportId]);

  const maxRate = stats?.trend.length ? Math.max(...stats.trend.map(tr => tr.rate), 10) : 100;
  const total = stats?.total ?? 0;

  return (
    <div style={{ padding: 20, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Activity size={20} color="#8b5cf6" />
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>{t('radpath.title')}</h1>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard icon={FileText} label={t('radpath.kpi.total')} value={stats?.total ?? '-'} color="#8b5cf6" />
        <KpiCard icon={CheckCircle2} label={t('radpath.kpi.concordant')} value={stats?.concordant ?? '-'} color="#10b981" />
        <KpiCard icon={XCircle} label={t('radpath.kpi.discordant')} value={stats?.discordant ?? '-'} color="#ef4444" />
        <KpiCard icon={Clock} label={t('radpath.kpi.pending')} value={stats?.pending ?? '-'} color="#94a3b8" />
        <KpiCard icon={TrendingUp} label={t('radpath.kpi.overallRate')} value={stats ? `${stats.positiveConsistency}%` : '-'} color="#8b5cf6" />
      </div>

      {/* 搜索 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input value={reportId} onChange={e => setReportId(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()}
          placeholder={t('radpath.searchPlaceholder')} style={{ flex: 1, padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14 }} />
        <button onClick={handleSearch} disabled={loading} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={14} /> {loading ? t('radpath.searching') : t('radpath.search')}
        </button>
      </div>
      {error && <div style={{ padding: 10, background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 6, marginBottom: 12, fontSize: 13 }}>{error}</div>}

      {/* 记录表格 */}
      {record && (
        <div style={{ background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', overflow: 'hidden', marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'var(--bg-card)', color: '#64748b', fontWeight: 600 }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colReportId')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colPathId')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colPatient')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colModalityPart')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colRadFinding')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colPathResult')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'center', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colConsistency')}</th>
              <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>{t('radpath.colNotes')}</th>
            </tr></thead>
            <tbody>
              <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{record.reportId}</td>
                <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 12 }}>{record.pathologyId}</td>
                <td style={{ padding: '10px 12px' }}>{record.report.patient.name}</td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{record.report.exam ? `${record.report.exam.modality}/${record.report.exam.bodyPart}` : '-'}</td>
                <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.radFinding}</td>
                <td style={{ padding: '10px 12px', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.pathResult}</td>
                <td style={{ padding: '10px 12px', textAlign: 'center' }}><Badge consistency={record.consistency} /></td>
                <td style={{ padding: '10px 12px', color: '#64748b' }}>{record.notes ?? '-'}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {!record && !error && <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
        <Microscope size={32} style={{ marginBottom: 8, opacity: 0.3 }} />
        <div>{t('radpath.emptyHint')}</div>
      </div>}

      {/* 统计仪表盘 */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={13} /> {t('radpath.trendTitle')}
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120, padding: '0 4px' }}>
              {stats.trend.map(tr => (
                <div key={tr.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '4px 4px 0 0', position: 'relative', height: 100 }}>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: `${(tr.rate / maxRate) * 100}%`, background: '#8b5cf6', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                  </div>
                  <span style={{ fontSize: 10, color: '#64748b', transform: 'rotate(-30deg)', whiteSpace: 'nowrap' }}>{tr.month.slice(5)}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#8b5cf6' }}>{tr.rate}%</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 8, padding: 16, border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              <PieChart size={13} /> {t('radpath.distributionTitle')}
            </div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 120, height: 120 }}>
                <svg viewBox="0 0 32 32" style={{ width: 120, height: 120 }}>
                  {total > 0 && (
                    <>
                      {(() => {
                        const c = stats.concordant / total * 360;
                        const d = stats.discordant / total * 360;
                        const p = stats.pending / total * 360;
                        const slices: Array<[number, number, string]> = [];
                        let start = 0;
                        if (c > 0) { slices.push([start, start + c, '#10b981']); start += c }
                        if (d > 0) { slices.push([start, start + d, '#ef4444']); start += d }
                        if (p > 0) { slices.push([start, start + p, '#94a3b8']); start += p }
                        const toRad = (deg: number) => (deg - 90) * Math.PI / 180;
                        return slices.map(([s, e, color], i) => {
                          const x1 = 16 + 14 * Math.cos(toRad(s));
                          const y1 = 16 + 14 * Math.sin(toRad(s));
                          const x2 = 16 + 14 * Math.cos(toRad(e));
                          const y2 = 16 + 14 * Math.sin(toRad(e));
                          const large = (e - s) > 180 ? 1 : 0;
                          return <path key={i} d={`M16 16 L${x1} ${y1} A14 14 0 ${large} 1 ${x2} ${y2} Z`} fill={color} />;
                        });
                      })()}
                    </>
                  )}
                  {total === 0 && <circle cx="16" cy="16" r="14" fill="#f1f5f9" />}
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                {[
                  { label: 'radpath.consistency.concordant', count: stats.concordant, color: '#10b981' },
                  { label: 'radpath.consistency.discordant', count: stats.discordant, color: '#ef4444' },
                  { label: 'radpath.consistency.pending', count: stats.pending, color: '#94a3b8' },
                ].map(s => (
                  <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, fontSize: 12 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
                    <span style={{ color: '#64748b', flex: 1 }}>{t(s.label)}</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{s.count}</strong>
                    <span style={{ color: '#94a3b8' }}>({total > 0 ? (s.count / total * 100).toFixed(1) : 0}%)</span>
                  </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                  <AlertTriangle size={12} color="#8b5cf6" />
                  <span style={{ color: '#64748b' }}>{t('radpath.kpi.overallRate')}</span>
                  <strong style={{ color: '#8b5cf6', fontSize: 16 }}>{stats.positiveConsistency}%</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const KpiCard: React.FC<{ icon: any; label: string; value: string | number; color: string }> = ({ icon: Icon, label, value, color }) => {
  const c = ({
    '#dc2626': 'error', '#ef4444': 'error', '#ff4d4f': 'error', '#cf1322': 'error',
    '#f59e0b': 'warning', '#faad14': 'warning', '#fa8c16': 'warning', '#ed8936': 'warning',
    '#16a34a': 'success', '#22c55e': 'success', '#52c41a': 'success', '#10b981': 'success',
    '#2563eb': 'primary', '#1890ff': 'primary', '#1d4ed8': 'primary',
  } as Record<string, string>)[color] ?? color;
  return <StatCard title={label} value={value} icon={<Icon size={18} />} color={c} />;
};
