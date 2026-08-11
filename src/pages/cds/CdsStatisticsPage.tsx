import { useState, useMemo, useEffect } from 'react'
import { BarChart3, TrendingUp, Download, AlertTriangle, CheckCircle, Activity, ArrowUp, ArrowDown } from 'lucide-react'
import type { CdsStatsOverview } from '../../services/cds'
import { cdsApi } from '../../services/api/cdsApi'

type Period = '7d' | '30d' | '90d'

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: '7d', label: '近7天' },
  { value: '30d', label: '近30天' },
  { value: '90d', label: '近90天' },
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: trend === 'up' ? '#22c55e' : '#ef4444' }}>
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

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    cdsApi.getCdsStatistics().then((res) => {
      if (cancelled) return
      if (res.success) setOverview(res.data)
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const chartData = useMemo(() => {
    if (!overview) return []
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90
    return (overview.dailyUsage ?? []).slice(-days)
  }, [period, overview])

  const maxVal = Math.max(...chartData.map(d => d.suggestions), 1)
  const barWidth = Math.max(8, Math.min(24, Math.floor(600 / chartData.length)))

  const acceptanceRate = overview ? (overview.suggestionAcceptanceRate * 100).toFixed(0) : '0'
  const overrideRatePct = overview ? (overview.overrideRate * 100).toFixed(1) : '0'

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
        加载统计数据...
      </div>
    )
  }

  if (!overview) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', color: '#8b949e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>
        无法加载统计数据
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>CDS 统计与分析</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setPeriod(opt.value)} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: period === opt.value ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              {opt.label}
            </button>
          ))}
          <button onClick={() => { const csv = 'CDS统计报表\n总规则数,采纳率,覆盖次数,路径完成率\n' + overview.totalRules + ',' + (overview.suggestionAcceptanceRate * 100).toFixed(0) + '%,' + overview.totalOverrides + ',' + (overview.pathwayCompletionRate * 100).toFixed(0) + '%'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'CDS统计报表.csv'; a.click(); URL.revokeObjectURL(url); }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} />导出
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          <StatCard title="活跃规则" value={overview.activeRules} unit={`/ ${overview.totalRules}`} icon={CheckCircle} trend="up" trendValue="较上月 +2" color="#22c55e" />
          <StatCard title="规则覆盖率" value={overrideRatePct} unit="%" icon={Activity} trend="down" trendValue="较上月 -1.2%" color="#3b82f6" />
          <StatCard title="建议采纳率" value={acceptanceRate} unit="%" icon={TrendingUp} trend="up" trendValue="较上月 +5.3%" color="#22c55e" />
          <StatCard title="路径完成率" value={(overview.pathwayCompletionRate * 100).toFixed(0)} unit="%" icon={TrendingUp} trend="up" trendValue="较上月 +3.1%" color="#f59e0b" />
          <StatCard title="造影剂警报" value={overview.contrastAlertsThisMonth} unit="本月" icon={AlertTriangle} trend="down" trendValue="较上月 -2" color="#ef4444" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>建议与覆盖趋势</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 160, position: 'relative' }}>
              {chartData.map((d, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: barWidth, position: 'relative', height: 160, justifyContent: 'flex-end' }}>
                  <div style={{ width: barWidth - 2, height: `${(d.suggestions / maxVal) * 120}px`, background: 'linear-gradient(to top, #3b82f6, #60a5fa)', borderRadius: '2px 2px 0 0', opacity: 0.8, transition: 'height 0.3s' }} title={`${d.date}: ${d.suggestions}条建议`} />
                  <div style={{ width: barWidth - 2, height: `${(d.overrides / maxVal) * 80}px`, background: '#ef4444', borderRadius: '2px 2px 0 0', opacity: 0.7, marginTop: 1 }} title={`${d.date}: ${d.overrides}次覆盖`} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#6e7681' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#3b82f6', display: 'inline-block' }}></span>建议数</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#ef4444', display: 'inline-block' }}></span>覆盖数</span>
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>常被覆盖规则 TOP 3</div>
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
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>热门临床路径</div>
            {overview.topPathways?.map((p, i) => (
              <div key={p.pathwayId} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: i < 1 ? '1px solid #21262d' : 'none' }}>
                <RouteIcon color="#22c55e" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: '#f0f6fc' }}>{p.pathwayName}</div>
                  <div style={{ fontSize: 12, color: '#6e7681' }}>{p.pathwayId}</div>
                </div>
                <span style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{p.activationCount}</span>
                <span style={{ fontSize: 12, color: '#6e7681' }}>次激活</span>
              </div>
            ))}
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>汇总指标</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { label: '总规则数', value: overview.totalRules, color: '#3b82f6' },
                { label: '总覆盖次数', value: overview.totalOverrides, color: '#ef4444' },
                { label: '覆盖率', value: `${overrideRatePct}%`, color: '#f59e0b' },
                { label: '路径完成率', value: `${(overview.pathwayCompletionRate * 100).toFixed(0)}%`, color: '#22c55e' },
              ].map(item => (
                <div key={item.label} style={{ padding: '12px', background: '#0d1117', borderRadius: 6, textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: item.color }}>{item.value}</div>
                  <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function RouteIcon({ color }: { color: string }) {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/><path d="M12 8v8"/></svg>
}
