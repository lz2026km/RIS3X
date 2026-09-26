import { useEffect, useState } from 'react'
import { TrendingUp, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, Monitor, Users, Building2, Download, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart as RePie, Pie, Cell, Legend } from 'recharts'
import { financeApi } from '../../services/api/financeApi'
import { ChartContainer } from '../../components/charts'
import { DataTable } from '../../components/common/DataTable'
import { ActionButton } from '../../components/common/ActionButton'
import { t } from '../../i18n/appI18n'

const DEMO_MONTHLY_DATA = [
  { month: '2025-07', revenue: 680, cost: 420, profit: 260, exams: 4200 },
  { month: '2025-08', revenue: 720, cost: 435, profit: 285, exams: 4450 },
  { month: '2025-09', revenue: 695, cost: 428, profit: 267, exams: 4300 },
  { month: '2025-10', revenue: 780, cost: 445, profit: 335, exams: 4800 },
  { month: '2025-11', revenue: 820, cost: 460, profit: 360, exams: 5100 },
  { month: '2025-12', revenue: 890, cost: 485, profit: 405, exams: 5500 },
  { month: '2026-01', revenue: 750, cost: 440, profit: 310, exams: 4600 },
  { month: '2026-02', revenue: 680, cost: 420, profit: 260, exams: 4100 },
  { month: '2026-03', revenue: 820, cost: 465, profit: 355, exams: 5100 },
  { month: '2026-04', revenue: 860, cost: 475, profit: 385, exams: 5300 },
]

const DEMO_MODALITY_DATA = [
  { name: 'CT', revenue: 385, exams: 2500, color: '#3b82f6' },
  { name: 'MRI', revenue: 235, exams: 850, color: '#8b5cf6' },
  { name: 'DSA', revenue: 195, exams: 150, color: '#f59e0b' },
  { name: 'DR', revenue: 45, exams: 1800, color: '#22c55e' },
]

const DEMO_PAYER_DATA = [
  { name: '医保(城镇职工)', value: 516, color: '#3b82f6' },
  { name: '医保(城乡居民)', value: 172, color: '#8b5cf6' },
  { name: '商业保险', value: 98, color: '#059669' },
  { name: '自费', value: 48, color: '#d97706' },
  { name: '公费/其他', value: 26, color: '#6b7280' },
]

const DEMO_DOCTOR_DATA = [
  { name: '张伟', revenue: 185, exams: 1120 },
  { name: '李娜', revenue: 168, exams: 980 },
  { name: '王建国', revenue: 152, exams: 890 },
  { name: '刘芳', revenue: 128, exams: 760 },
  { name: '陈明', revenue: 115, exams: 680 },
]

const MODALITY_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e', '#059669', '#d97706']

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// 从发票收费项目名推断设备类型
function guessModality(examItem: string): string | null {
  const s = String(examItem ?? '').toUpperCase()
  if (s.includes('MR') || s.includes('磁共振')) return 'MRI'
  if (s.includes('CT')) return 'CT'
  if (s.includes('DSA') || s.includes('造影')) return 'DSA'
  if (s.includes('MG') || s.includes('钼靶')) return 'MG'
  if (s.includes('DR') || s.includes('X线') || s.includes('拍片')) return 'DR'
  if (s.includes('US') || s.includes('超声')) return 'US'
  return null
}

export default function RevenueAnalysisPage() {
  const [view, setView] = useState<'trend' | 'modality' | 'payer' | 'doctor'>('trend')
  // [W2-A] financeApi 实时数据 (失败回退演示数据)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'demo'>('demo')
  const [monthlyData, setMonthlyData] = useState(DEMO_MONTHLY_DATA)
  const [modalityData, setModalityData] = useState(DEMO_MODALITY_DATA)
  const [payerData, setPayerData] = useState(DEMO_PAYER_DATA)
  const [doctorData] = useState(DEMO_DOCTOR_DATA)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [revRes, invRes, costRes] = await Promise.allSettled([
          financeApi.getRevenueAnalysis(),
          financeApi.listInvoices(),
          financeApi.getCostAccounting(),
        ])
        const revData = revRes.status === 'fulfilled' ? revRes.value.data : null
        const invoices = Array.isArray(invRes.status === 'fulfilled' ? invRes.value.data : null)
          ? (invRes as PromiseFulfilledResult<{ data: unknown[] }>).value.data
          : []
        const costObj = (costRes.status === 'fulfilled' ? costRes.value.data ?? {} : {}) as Record<string, unknown>

        // 成本收入比 (用于成本列派生)
        let costRatio = 0.6
        const costRevenue = toNumber(costObj.totalRevenue)
        const costTotal = toNumber(costObj.totalCost)
        if (costRevenue > 0 && costTotal > 0) costRatio = costTotal / costRevenue

        // 按月聚合发票 (真实收入)
        const monthMap = new Map<string, { revenue: number; exams: number }>()
        const modalityMap = new Map<string, { revenue: number; exams: number }>()
        let insTotal = 0
        let selfPayTotal = 0
        let hasPayerData = false
        for (const inv of invoices) {
          const rec = (inv ?? {}) as Record<string, unknown>
          const date = String(rec.examDate ?? rec.createdAt ?? '')
          const month = date.slice(0, 7)
          const amount = toNumber(rec.totalAmount)
          if (month.length === 7) {
            const cur = monthMap.get(month) ?? { revenue: 0, exams: 0 }
            cur.revenue += amount
            cur.exams += 1
            monthMap.set(month, cur)
          }
          const mod = guessModality(String(rec.examItem ?? rec.examItemName ?? '')) ?? guessModality(String(rec.bodyPart ?? ''))
          if (mod) {
            const cur = modalityMap.get(mod) ?? { revenue: 0, exams: 0 }
            cur.revenue += amount
            cur.exams += 1
            modalityMap.set(mod, cur)
          }
          if (rec.insuranceCovered != null) {
            insTotal += toNumber(rec.insuranceCovered)
            selfPayTotal += toNumber(rec.selfPayAmount ?? 0)
            hasPayerData = true
          }
        }

        // revenue-analysis 备用 (MSW 提供 daily/monthly)
        const revObj = (revData ?? {}) as Record<string, unknown>
        if (Array.isArray(revObj.monthly) && monthMap.size === 0) {
          for (const m of revObj.monthly) {
            const rec = (m ?? {}) as Record<string, unknown>
            const month = String(rec.month ?? rec.date ?? '')
            const amount = toNumber(rec.amount ?? rec.revenue)
            if (month.length === 7) monthMap.set(month, { revenue: amount, exams: 0 })
          }
        }

        if (monthMap.size > 0) {
          const months = Array.from(monthMap.keys()).sort().slice(-10)
          setMonthlyData(months.map(m => {
            const revenue = Math.round((monthMap.get(m)?.revenue ?? 0) / 10000 * 10) / 10
            const cost = Math.round(revenue * costRatio * 10) / 10
            return { month: m, revenue, cost, profit: Math.round((revenue - cost) * 10) / 10, exams: monthMap.get(m)?.exams ?? 0 }
          }))
          setModalityData(Array.from(modalityMap.entries())
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .slice(0, 6)
            .map(([name, v], i) => ({
              name,
              revenue: Math.round(v.revenue / 10000 * 10) / 10,
              exams: v.exams,
              color: MODALITY_COLORS[i % MODALITY_COLORS.length] ?? '#3b82f6',
            })))
          if (hasPayerData && insTotal + selfPayTotal > 0) {
            const totalPayer = insTotal + selfPayTotal
            setPayerData([
              { name: '医保统筹', value: Math.round(insTotal / 10000 * 10) / 10, color: '#3b82f6' },
              { name: '个人自费', value: Math.round(selfPayTotal / 10000 * 10) / 10, color: '#d97706' },
              { name: '其他', value: Math.max(Math.round((totalPayer * 0.05) / 10000 * 10) / 10, 0), color: '#6b7280' },
            ])
          }
          if (!cancelled) setSource('api')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : t('w9e.revenueAnalysis.loadFailed'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [reloadTick])

  const latest = monthlyData[monthlyData.length - 1] ?? { month: '', revenue: 0, cost: 0, profit: 0, exams: 0 }
  const previous = monthlyData[monthlyData.length - 3] ?? latest
  const momRevenue = previous.revenue ? ((latest.revenue - previous.revenue) / previous.revenue * 100) : 0
  const momProfit = previous.profit ? ((latest.profit - previous.profit) / previous.profit * 100) : 0
  const momExams = previous.exams ? ((latest.exams - previous.exams) / previous.exams * 100) : 0

  const handleExport = () => {
    const rows = [
      [t('w9e.revenueAnalysis.csvMonth'), t('w9e.revenueAnalysis.revenueWan'), t('w9e.revenueAnalysis.costWan'), t('w9e.revenueAnalysis.profitWan'), t('w9e.revenueAnalysis.csvExamVolume')],
      ...monthlyData.map(m => [m.month, String(m.revenue), String(m.cost), String(m.profit), String(m.exams)]),
      [],
      [t('w9e.revenueAnalysis.csvDevice'), t('w9e.revenueAnalysis.revenueWan'), t('w9e.revenueAnalysis.csvExamVolume')],
      ...modalityData.map(m => [m.name, String(m.revenue), String(m.exams)]),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${t('w9e.revenueAnalysis.exportFileName')}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const revenueColumns = [
    { title: t('w1tables.revenue.month'), dataIndex: 'month', key: 'month' },
    { title: t('w1tables.revenue.revenue'), dataIndex: 'revenue', key: 'revenue', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: t('w1tables.revenue.cost'), dataIndex: 'cost', key: 'cost', align: 'right' as const, render: (v: number) => v.toLocaleString() },
    { title: t('w1tables.revenue.profit'), dataIndex: 'profit', key: 'profit', align: 'right' as const, render: (v: number) => <span style={{ color: v >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)' }}>{v.toLocaleString()}</span> },
    { title: t('w1tables.revenue.exams'), dataIndex: 'exams', key: 'exams', align: 'right' as const, render: (v: number) => v.toLocaleString() },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChart3 size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('w9e.revenueAnalysis.title')}</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: source === 'api' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)',
            color: source === 'api' ? 'var(--color-success-400, #4ade80)' : 'var(--color-warning-400, #fbbf24)',
            border: `1px solid ${source === 'api' ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)'}`,
            fontWeight: 500,
          }}>
            {source === 'api' ? t('w9e.revenueAnalysis.sourceApi') : t('w9e.revenueAnalysis.sourceDemo')}
          </span>
          {loading && <span style={{ fontSize: 12, color: '#93c5fd' }}>{t('w9e.revenueAnalysis.loading')}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton action="refresh" onClick={() => setReloadTick(n => n + 1)}>{t('w1tables.refresh')}</ActionButton>
          <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} />{t('w9e.revenueAnalysis.exportReport')}</button>
        </div>
      </div>
      {error && (
        <div style={{ padding: '8px 24px', background: 'rgba(220,38,38,0.15)', color: '#fca5a5', fontSize: 12, borderBottom: '1px solid rgba(220,38,38,0.3)' }}>
          {error}{t('w9e.revenueAnalysis.fallbackSuffix')}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 24px' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>{t('w9e.revenueAnalysis.monthlyRevenue')}</span>
            <DollarSign size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-success-500, #22c55e)', marginTop: 4 }}>{latest.revenue.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: momRevenue >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)', marginTop: 4 }}>
            {momRevenue >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{momRevenue >= 0 ? '+' : ''}{momRevenue.toFixed(1)}% {t('w9e.revenueAnalysis.momSuffix')}
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>{t('w9e.revenueAnalysis.monthlyProfit')}</span>
            <Activity size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-warning-500, #f59e0b)', marginTop: 4 }}>{latest.profit.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: momProfit >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)', marginTop: 4 }}>
            {momProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{momProfit >= 0 ? '+' : ''}{momProfit.toFixed(1)}% {t('w9e.revenueAnalysis.momSuffix')}
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>{t('w9e.revenueAnalysis.monthlyExams')}</span>
            <Users size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary-500, #3b82f6)', marginTop: 4 }}>{latest.exams.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: momExams >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)', marginTop: 4 }}>
            {momExams >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{momExams >= 0 ? '+' : ''}{momExams.toFixed(1)}% {t('w9e.revenueAnalysis.momSuffix')}
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>{t('w9e.revenueAnalysis.avgRevenue')}</span>
            <TrendingUp size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-modality-mr, #8b5cf6)', marginTop: 4 }}>{(latest.revenue * 10000 / Math.max(latest.exams, 1)).toFixed(0)}</div>
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{t('w9e.revenueAnalysis.revenueCapacity')}</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['trend', 'modality', 'payer', 'doctor'] as const).map(tab => (
            <button key={tab} onClick={() => setView(tab)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: view === tab ? '#1e40af' : '#21262d', color: view === tab ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
              {tab === 'trend' ? <BarChart3 size={14} /> : tab === 'modality' ? <Monitor size={14} /> : tab === 'payer' ? <Building2 size={14} /> : <Users size={14} />}
              {tab === 'trend' ? t('w9e.revenueAnalysis.tabTrend') : tab === 'modality' ? t('w9e.revenueAnalysis.tabModality') : tab === 'payer' ? t('w9e.revenueAnalysis.tabPayer') : t('w9e.revenueAnalysis.tabDoctor')}
            </button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          {view === 'trend' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                {t('w9e.revenueAnalysis.trendTitle')}
                <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 400, marginLeft: 8 }}>{source === 'api' ? t('w9e.revenueAnalysis.trendApiNote') : t('w9e.revenueAnalysis.demoData')}</span>
              </div>
<ChartContainer height={320} state={monthlyData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('w9e.revenueAnalysis.noMonthlyData')}>
  <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4 }} />
                  <Legend />
                  <Bar dataKey="revenue" name={t('w9e.revenueAnalysis.revenueWan')} fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name={t('w9e.revenueAnalysis.costWan')} fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name={t('w9e.revenueAnalysis.profitWan')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
          {view === 'modality' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('w9e.revenueAnalysis.modalityShareTitle')} <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 400 }}>{source === 'api' ? t('w9e.revenueAnalysis.derivedFromInvoices') : t('w9e.revenueAnalysis.demoData')}</span></div>
                <ChartContainer height={300} state={modalityData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('w9e.revenueAnalysis.noModalityData')}>
                  <RePie>
                    <Pie data={modalityData} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                      {modalityData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                  </RePie>
                </ChartContainer>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('w9e.revenueAnalysis.modalityRevenueTitle')}</div>
                <ChartContainer height={300} state={modalityData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('w9e.revenueAnalysis.noModalityData')}>
                  <BarChart data={modalityData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {modalityData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </div>
            </div>
          )}
          {view === 'payer' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('w9e.revenueAnalysis.payerTitle')} <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 400 }}>{source === 'api' ? t('w9e.revenueAnalysis.payerApiNote') : t('w9e.revenueAnalysis.demoData')}</span></div>
                <ChartContainer height={300} state={payerData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('w9e.revenueAnalysis.noPayerData')}>
                  <RePie>
                    <Pie data={payerData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                      {payerData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                  </RePie>
                </ChartContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {payerData.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #21262d' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: d.color }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{d.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>¥{d.value}万</span>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{((d.value / payerData.reduce((s, x) => s + x.value, 0)) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === 'doctor' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                {t('w9e.revenueAnalysis.doctorTitle')}
                <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 400, marginLeft: 8 }}>{t('w9e.revenueAnalysis.doctorNote')}</span>
              </div>
              <ChartContainer height={300} state={doctorData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('w9e.revenueAnalysis.noDoctorData')}>
                <BarChart data={doctorData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                  <Bar dataKey="revenue" name={t('w9e.revenueAnalysis.revenueWan')} fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('w1tables.revenue.title')}</div>
          <DataTable dataSource={monthlyData} rowKey="month" columns={revenueColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('w1tables.noData')} />
        </div>
      </div>
    </div>
  )
}
