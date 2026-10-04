import { useState, useMemo, useEffect } from 'react'
import { BarChart3, TrendingUp, Download, AlertTriangle, CheckCircle, Activity, ArrowUp, ArrowDown, Route } from 'lucide-react'
import type { CdsStatsOverview } from '../../services/cds'
import { cdsApi } from '../../services/api/cdsApi'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common/DataTable'
import { ActionButton } from '../../components/common/ActionButton'
import { t } from '../../i18n/appI18n'

type Period = '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: 'cdsStats.period.7d' },
  { value: '30d', label: 'cdsStats.period.30d' },
  { value: '90d', label: 'cdsStats.period.90d' },
]

function StatCard({ title, value, unit, icon: Icon, trend, trendValue, color }: {
  title: string; value: string | number; unit?: string; icon: typeof Activity; trend?: 'up' | 'down'; trendValue?: string; color: string
}) {
  return (
    <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 200 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: '#8b949e' }}>{title}</span>
        <Icon size={20} style={{ color }} />
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc', marginBottom: 4 }}>
        {value}{unit && <span style={{ fontSize: 14, fontWeight: 400, color: '#6e7681', marginLeft: 4 }}>{unit}</span>}
      </div>
      {trend && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trend === 'up' ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)' }}>
          {trend === 'up' ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  )
}

export default function CdsStatisticsPage() {
  const [period, setPeriod] = useState<Period>('30d')
  const [overview, setOverview] = useState<CdsStatsOverview | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    cdsApi.getCdsStatistics().then((res) => {
      if (cancelled) return
      if (res.success) setOverview(res.data)
      else setLoadError(res.error?.message ?? t('cdsStats.loadFailed'))
      setLoading(false)
    }).catch((e) => {
      if (cancelled) return
      setLoadError(e instanceof Error ? e.message : t('cdsStats.loadFailed'))
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [reloadTick])

  const chartData = useMemo(() => {
    if (!overview) return []
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    return (overview.dailyUsage ?? []).slice(-days)
  }, [period, overview])

  const maxVal = Math.max(...chartData.map(d => d.suggestions), 1)
  const barWidth = Math.max(8, Math.min(24, Math.floor(600 / chartData.length)))

  const acceptanceRate = overview ? (overview.suggestionAcceptanceRate * 100).toFixed(0) : '0'
  const overrideRatePct = overview ? (overview.overrideRate * 100).toFixed(1) : '0'

  const detailColumns = [
    { title: t('w1tables.cds.date'), dataIndex: 'date', key: 'date' },
    { title: t('w1tables.cds.suggestions'), dataIndex: 'suggestions', key: 'suggestions', align: 'right' as const },
    { title: t('w1tables.cds.overrides'), dataIndex: 'overrides', key: 'overrides', align: 'right' as const },
  ]

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
        {t('cdsStats.loading')}
      </div>
    )
  }

  if (!overview) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <StateView error={loadError ?? t('cdsStats.loadFailed')} onRetry={() => setReloadTick(n => n + 1)} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('cdsStats.title')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: period === opt.value ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              {t(opt.label)}
            </button>
          ))}
          <ActionButton action="refresh" onClick={() => setReloadTick(n => n + 1)}>{t('w1tables.refresh')}</ActionButton>
          <button onClick={() => { const csv = 'CDS统计报表\n总规则数,采纳率,覆盖次数,路径完成率\n' + overview.totalRules + ',' + (overview.suggestionAcceptanceRate * 100).toFixed(0) + '%,' + overview.totalOverrides + ',' + (overview.pathwayCompletionRate * 100).toFixed(0) + '%'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'CDS统计报表.csv'; a.click(); URL.revokeObjectURL(url); }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} />{t('cdsStats.export')}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard title={t('cdsStats.activeRules')} value={overview.activeRules} unit={`/ ${overview.totalRules}`} icon={CheckCircle} trend="up" trendValue={t('cdsStats.trendActive')} color="var(--color-success-500, #22c55e)" />
          <StatCard title={t('cdsStats.ruleCoverage')} value={overrideRatePct} unit="%" icon={Activity} trend="down" trendValue={t('cdsStats.trendCoverage')} color="var(--color-primary-500, #3b82f6)" />
          <StatCard title={t('cdsStats.suggestionAcceptance')} value={acceptanceRate} unit="%" icon={TrendingUp} trend="up" trendValue={t('cdsStats.trendAcceptance')} color="var(--color-success-500, #22c55e)" />
          <StatCard title={t('cdsStats.pathwayCompletion')} value={(overview.pathwayCompletionRate * 100).toFixed(0)} unit="%" icon={TrendingUp} trend="up" trendValue={t('cdsStats.trendPathway')} color="var(--color-warning-500, #f59e0b)" />
          <StatCard title={t('cdsStats.contrastAlerts')} value={overview.contrastAlertsThisMonth} unit={t('cdsStats.thisMonth')} icon={AlertTriangle} trend="down" trendValue={t('cdsStats.trendContrast')} color="var(--color-error-500, #ef4444)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('cdsStats.suggestionCoverageTrend')}</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, position: 'relative' }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: barWidth, position: 'relative', height: 160, justifyContent: 'flex-end' }}>
                  <div style={{ width: barWidth - 2, height: `${(d.suggestions / maxVal) * 120}px`, background: 'linear-gradient(to top, #3b82f6, #60a5fa)', borderRadius: '2px 2px 0 0', opacity: 0.8, transition: 'height 0.3s' }} title={`${d.date}: ${d.suggestions}条建议`} />
                  <div style={{ width: barWidth - 2, height: `${(d.overrides / maxVal) * 80}px`, background: '#ef4444', borderRadius: '2px 2px 0 0', opacity: 0.7, marginTop: 1 }} title={`${d.date}: ${d.overrides}次覆盖`} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6e7681' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }}></span>{t('cdsStats.suggestionCount')}</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }}></span>{t('cdsStats.overrideCount')}</span>
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('cdsStats.topOverriddenRules')}</div>
            {overview.topOverriddenRules?.map((r, i) => (
              <div key={r.ruleId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 2 ? '1px solid #21262d' : 'none' }}>
                <span style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? '#ef4444' : i === 1 ? '#f59e0b' : '#3b82f6', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600 }}>{i + 1}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#f0f6fc' }}>{r.ruleName}</div>
                  <div style={{ fontSize: 12, color: '#6e7681' }}>{r.ruleId}</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#f0f6fc' }}>{r.count}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('cdsStats.topPathways')}</div>
            {overview.topPathways?.map((p, i) => (
              <div key={p.pathwayId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 1 ? '1px solid #21262d' : 'none' }}>
                <RouteIcon color="var(--color-success-500, #22c55e)" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#f0f6fc' }}>{p.pathwayName}</div>
                  <div style={{ fontSize: 12, color: '#6e7681' }}>{p.pathwayId}</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{p.activationCount}</span>
                <span style={{ fontSize: 12, color: '#6e7681' }}>{t('cdsStats.activations')}</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('cdsStats.summaryMetrics')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: 'cdsStats.totalRules', value: overview.totalRules, color: '#3b82f6' },
                { label: 'cdsStats.totalOverrides', value: overview.totalOverrides, color: '#ef4444' },
                { label: 'cdsStats.coverageRate', value: `${overrideRatePct}%`, color: '#f59e0b' },
                { label: 'cdsStats.pathwayCompletionRate', value: `${(overview.pathwayCompletionRate * 100).toFixed(0)}%`, color: '#22c55e' },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px', background: '#0d1117', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{t(item.label)}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginTop: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('w1tables.cds.title')}</div>
            <DataTable dataSource={chartData} rowKey="date" columns={detailColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('w1tables.noData')} />
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteIcon({ color }: { color: string }) {
  return <Route size={18} color={color} />
}
