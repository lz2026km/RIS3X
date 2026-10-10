// [G005 v3.0.6.11-100 Wave 1A] 技师 KPI/绩效看板 (运营组 /tech/kpi)
// 功能: 日期范围 + 技师 KPI 卡网格 + 排行 Top10 三榜 + 近 7/30 日完成量趋势 (recharts) + 数据源徽标
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Select, Spin, Tag } from 'antd'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'
import { BarChart3, Wifi, TrendingUp, CalendarRange } from 'lucide-react'
import { worklistApi, type TechnicianDashboardDto } from '../../services/api/worklistApi'
import TechnicianKpiCards, { type KpiTotals } from '../../components/worklist/TechnicianKpiCards'
import TechnicianRankingTable from '../../components/worklist/TechnicianRankingTable'
import { ChartContainer } from '../../components/charts'
import { PageHeader } from '../../components/common/PageHeader'
import { AppText } from '../../components/common/AppText'
import { ActionButton, DataTable, ExportButton } from '../../components/common'
import { THEME_TOKENS } from '../../components/common/ThemeTokens'
import { t } from '../../i18n/appI18n'

const todayStr = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const shiftDate = (days: number) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const RANGE_PRESETS = [
  { label: '近 7 天', from: () => shiftDate(-6), to: todayStr },
  { label: '近 30 天', from: () => shiftDate(-29), to: todayStr },
  { label: '本月', from: () => `${todayStr().slice(0, 7)}-01`, to: todayStr },
  { label: '全部', from: () => '', to: todayStr },
]

// 确定性 demo 回退 (与后端 seedTechnicianDashboard 对齐)
const DEMO: TechnicianDashboardDto = {
  technicians: [
    { id: 'tech-seed-1', name: '王技师', completedCount: 12, avgDurationMin: 24, retakeCount: 1, retakeRate: 8.3, avgWaitTime: 12, deviceUtilization: 92, onTimeRate: 87.5 },
    { id: 'tech-seed-2', name: '李技师', completedCount: 8, avgDurationMin: 21, retakeCount: 0, retakeRate: 0, avgWaitTime: 15, deviceUtilization: 88, onTimeRate: 75 },
    { id: 'tech-seed-3', name: '张技师', completedCount: 6, avgDurationMin: 30, retakeCount: 2, retakeRate: 33.3, avgWaitTime: 20, deviceUtilization: 80, onTimeRate: 66.7 },
  ],
  totals: { completedCount: 26, avgDurationMin: 24, retakeRate: 11.5, avgWaitTime: 15, deviceUtilization: 88, onTimeRate: 79 },
  trend: Array.from({ length: 7 }, (_, i) => ({ date: shiftDate(-6 + i), completed: 3 + ((i * 5) % 9) })),
}

export default function TechnicianKpiDashboardPage() {
  const [preset, setPreset] = useState('近 7 天')
  const [from, setFrom] = useState(() => RANGE_PRESETS[0]!.from())
  const [to, setTo] = useState(() => RANGE_PRESETS[0]!.to())
  const [technicianId, setTechnicianId] = useState<string | undefined>(undefined)
  const [data, setData] = useState<TechnicianDashboardDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async (fromD: string, toD: string, techId?: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await worklistApi.getTechnicianDashboard({ from: fromD || undefined, to: toD || undefined, technicianId: techId })
      if (res.success && res.data && Array.isArray(res.data.technicians)) {
        setData(res.data)
        setDataSource('api')
      } else {
        setData(DEMO)
        setDataSource('demo')
      }
    } catch {
      setData(DEMO)
      setDataSource('demo')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void load(from, to, technicianId)
  }, [load, from, to, technicianId])

  const applyPreset = (label: string) => {
    const p = RANGE_PRESETS.find((r) => r.label === label)
    if (!p) return
    setPreset(label)
    setFrom(p.from())
    setTo(p.to())
  }

  const trendView = useMemo(() => {
    const items = data?.trend ?? []
    if (items.length <= 10) return items
    return items.filter((_, i) => i % 2 === 0 || i === items.length - 1)
  }, [data])

  const totals: KpiTotals | null = data?.totals ?? null
  const techOptions = useMemo(
    () => (data?.technicians ?? []).map((t) => ({ value: t.id, label: t.name })),
    [data],
  )

  return (
    <div style={{ padding: 'var(--space-5, 20px)', maxWidth: 1240, margin: '0 auto' }}>
      {/* 头部 */}
      <PageHeader
        icon={<BarChart3 size={18} color="var(--color-primary-800)" />}
        title="技师 KPI 看板"
        subtitle={<Tag color="blue" style={{ fontSize: 11 }}>Wave 1A</Tag>}
        actions={
          <>
            <CalendarRange size={14} color="var(--text-secondary)" />
            <Select
              size="small"
              value={preset}
              style={{ width: 110 }}
              onChange={applyPreset}
              options={RANGE_PRESETS.map((r) => ({ value: r.label, label: r.label }))}
              data-testid="tech-kpi-range-preset"
            />
            <input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPreset('自定义') }}
              style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '3px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              data-testid="tech-kpi-from"
            />
            <AppText size="xs" color="secondary">至</AppText>
            <input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPreset('自定义') }}
              style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '3px 8px', fontSize: 12, background: 'var(--bg-card)', color: 'var(--text-primary)' }}
              data-testid="tech-kpi-to"
            />
            <Select
              size="small"
              style={{ width: 120 }}
              placeholder="全部技师"
              allowClear
              value={technicianId}
              onChange={setTechnicianId}
              options={techOptions}
              data-testid="tech-kpi-technician"
            />
            <ActionButton action="refresh" loading={loading} onClick={() => void load(from, to, technicianId)}>{t('w45.actions.refresh')}</ActionButton>
            <ExportButton
              data={() => data?.technicians ?? []}
              filename="technician-kpi"
              label={t('w45.actions.export')}
              size="small"
              formats={["csv", "json"]}
            />
          </>
        }
      />

      {/* 数据源徽标 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-4, 16px)', fontSize: 12,
        padding: '6px 12px', borderRadius: 8,
        background: dataSource === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        color: dataSource === 'api' ? '#059669' : 'var(--color-warning-600)',
        border: `1px solid ${dataSource === 'api' ? '#bbf7d0' : '#fde68a'}`,
      }} data-testid="tech-kpi-data-source-badge">
        <Wifi size={12} />
        {dataSource === 'api'
          ? `数据源: 真实接口 /worklist/technician-dashboard · 区间 ${from || '全部'} ~ ${to || '今天'}${technicianId ? ' · 单技师' : ''}`
          : '数据源: 本地 demo 回退 (后端不可用)'}
      </div>

      {error && <AppText size="xs" color="error" style={{ marginBottom: 'var(--space-3, 12px)', display: 'block' }}>{error}</AppText>}

      {loading && !data ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--space-20, 80px)' }}><Spin /></div>
      ) : (
        <>
          {/* KPI 卡网格 */}
          <TechnicianKpiCards totals={totals} loading={loading} />

          {/* 趋势图 + 排行 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-4, 16px)', alignItems: 'start' }} data-testid="tech-kpi-trend">
            <div style={{
              background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
              padding: '14px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <TrendingUp size={13} color="var(--color-primary-600)" />
                <AppText size="sm" weight={700} color="primary" style={{ color: THEME_TOKENS.textPrimary }}>完成量趋势</AppText>
                <AppText size="xs" color="secondary" style={{ marginLeft: 'auto' }}>
                  区间 {from || '全部'} ~ {to || '今天'} · 近 7/30 日完成量
                </AppText>
              </div>
              <ChartContainer type="line" height={260} state={loading ? 'loading' : trendView.length > 0 ? 'ready' : 'empty'}>
                <LineChart data={trendView} margin={{ top: 6, right: 12, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} minTickGap={24} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                  <Tooltip
                    formatter={(v) => [`${v} 项`, '完成量']}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Line
                    type="monotone" dataKey="completed" name="完成量" stroke="var(--color-primary-600)" strokeWidth={2}
                    dot={{ r: 2.5 }} activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ChartContainer>
            </div>

            <TechnicianRankingTable technicians={data?.technicians ?? []} loading={loading} />
          </div>

          {/* 技师明细表 */}
          <div style={{
            marginTop: 'var(--space-4, 16px)', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
            padding: '14px 18px', overflow: 'auto',
          }} data-testid="tech-kpi-detail-table">
            <AppText size="sm" weight={700} style={{ color: THEME_TOKENS.textPrimary, display: 'block', marginBottom: 10 }}>技师明细 ({data?.technicians.length ?? 0})</AppText>
            <DataTable
              rowKey="id"
              dataSource={data?.technicians ?? []}
              columns={[
                { title: '技师', dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 700 }}>{v}</span> },
                { title: '完成数', dataIndex: 'completedCount', key: 'completedCount', render: (v: number) => <span style={{ fontWeight: 600, color: '#059669' }}>{v}</span> },
                { title: '平均时长', dataIndex: 'avgDurationMin', key: 'avgDurationMin', render: (v: number) => `${v} min` },
                { title: '重拍数', dataIndex: 'retakeCount', key: 'retakeCount' },
                { title: '重拍率', dataIndex: 'retakeRate', key: 'retakeRate', render: (v: number) => <span style={{ color: v > 20 ? 'var(--color-error-600)' : 'var(--text-primary)' }}>{v}%</span> },
                { title: '平均等待', dataIndex: 'avgWaitTime', key: 'avgWaitTime', render: (v: number) => `${v} min` },
                { title: '设备占用率', dataIndex: 'deviceUtilization', key: 'deviceUtilization', render: (v: number) => `${v}%` },
                { title: '按时签到率', dataIndex: 'onTimeRate', key: 'onTimeRate', render: (v: number) => <span style={{ color: v >= 80 ? '#059669' : v >= 60 ? 'var(--color-warning-600)' : 'var(--color-error-600)' }}>{v}%</span> },
              ]}
            />
          </div>
        </>
      )}
    </div>
  )
}
