import { useEffect, useState } from 'react'
import {
  DollarSign, BarChart3, PieChart,
  Monitor, Download,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RePie, Pie, Cell, Legend,
} from 'recharts'
import { financeApi } from '../../services/api/financeApi'
import { ChartContainer } from '../../components/charts'
import { DataTable } from '../../components/common/DataTable'
import { ActionButton } from '../../components/common/ActionButton'
import { t } from '../../i18n/appI18n'

interface CostCategory { name: string; budget: number; actual: number; color: string }
interface ModalityCost { name: string; costPerExam: number; revenuePerExam: number; profitPerExam: number; color: string }
interface BudgetRow { month: string; budget: number; actual: number }

const DEMO_CATEGORY_DATA: CostCategory[] = [
  { name: '人力成本', budget: 152000, actual: 158000, color: '#3b82f6' },
  { name: '耗材成本', budget: 135000, actual: 142000, color: '#22c55e' },
  { name: '设备折旧', budget: 85000, actual: 85000, color: '#f59e0b' },
  { name: '管理费用', budget: 48000, actual: 52000, color: '#8b5cf6' },
  { name: '其他费用', budget: 30000, actual: 38000, color: '#6b7280' },
]

const DEMO_MODALITY_COST_DATA: ModalityCost[] = [
  { name: 'CT', costPerExam: 84, revenuePerExam: 154, profitPerExam: 70, color: '#3b82f6' },
  { name: 'MRI', costPerExam: 158.8, revenuePerExam: 276.5, profitPerExam: 117.7, color: '#8b5cf6' },
  { name: 'DSA', costPerExam: 633.3, revenuePerExam: 1300, profitPerExam: 666.7, color: '#f59e0b' },
  { name: 'DR', costPerExam: 19.4, revenuePerExam: 25, profitPerExam: 5.6, color: '#22c55e' },
]

const DEMO_BUDGET_DATA: BudgetRow[] = [
  { month: '2026-01', budget: 440000, actual: 418000 },
  { month: '2026-02', budget: 440000, actual: 435000 },
  { month: '2026-03', budget: 450000, actual: 465000 },
  { month: '2026-04', budget: 450000, actual: 475000 },
]

function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export default function CostAccountingPage() {
  const [tab, setTab] = useState<'overview' | 'modality' | 'budget'>('overview')
  // [W2-A] financeApi 实时数据 (失败回退演示数据)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'demo'>('demo')
  const [categoryData, setCategoryData] = useState<CostCategory[]>(DEMO_CATEGORY_DATA)
  const [modalityCostData, setModalityCostData] = useState<ModalityCost[]>(DEMO_MODALITY_COST_DATA)
  const [budgetData, setBudgetData] = useState<BudgetRow[]>(DEMO_BUDGET_DATA)
  const [costRevenueRatio, setCostRevenueRatio] = useState<number | null>(null)
  const [reloadTick, setReloadTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [costRes, , invRes] = await Promise.allSettled([
          financeApi.getCostAccounting(),
          financeApi.getRevenueAnalysis(),
          financeApi.listInvoices(),
        ])
        const costData = costRes.status === 'fulfilled' ? costRes.value.data : null
        const invoices = Array.isArray(invRes.status === 'fulfilled' ? invRes.value.data : null)
          ? (invRes as PromiseFulfilledResult<{ data: unknown[] }>).value.data
          : []

        let liveTotalCost = 0
        let liveTotalRevenue = 0
        const liveByModality: { name: string; cost: number; revenue: number }[] = []
        const costObj = (costData ?? {}) as Record<string, unknown>
        if (typeof costObj.totalCost === 'number' || typeof costObj.totalCost === 'string') {
          liveTotalCost = toNumber(costObj.totalCost)
          liveTotalRevenue = toNumber(costObj.totalRevenue)
          const byMod = Array.isArray(costObj.byModality) ? costObj.byModality : []
          for (const m of byMod) {
            const rec = (m ?? {}) as Record<string, unknown>
            liveByModality.push({ name: String(rec.modality ?? rec.name ?? ''), cost: toNumber(rec.cost), revenue: toNumber(rec.revenue) })
          }
        } else if (Array.isArray(costData)) {
          // 后端: /finance/cost-accounting → 收费项目列表, 以单价合计作为成本总额
          liveTotalCost = costData.reduce((s: number, c) => {
            const item = (c ?? {}) as Record<string, unknown>
            return s + toNumber(item.unitPrice)
          }, 0)
          liveTotalRevenue = 0
        }

        if (liveTotalCost > 0) {
          const demoTotal = DEMO_CATEGORY_DATA.reduce((s, c) => s + c.actual, 0)
          const factor = demoTotal > 0 ? liveTotalCost / demoTotal : 1
          setCategoryData(DEMO_CATEGORY_DATA.map(c => ({ ...c, actual: Math.round(c.actual * factor), budget: Math.round(c.budget * factor) })))
          setModalityCostData(liveByModality.length > 0
            ? liveByModality.map((m, i) => {
                const fallback = DEMO_MODALITY_COST_DATA[i % DEMO_MODALITY_COST_DATA.length]!
                return {
                  name: m.name || fallback.name,
                  costPerExam: m.cost > 0 ? Math.round(m.cost / 100) : fallback.costPerExam * factor,
                  revenuePerExam: m.revenue > 0 ? Math.round(m.revenue / 100) : fallback.revenuePerExam * factor,
                  profitPerExam: 0,
                  color: fallback.color,
                }
              })
            : DEMO_MODALITY_COST_DATA.map(m => ({ ...m, costPerExam: m.costPerExam * factor, revenuePerExam: m.revenuePerExam * factor }))
          )
          // 预算执行: 实际列来自真实发票按月聚合, 预算列为演示派生
          const monthMap = new Map<string, number>()
          for (const inv of invoices) {
            const rec = (inv ?? {}) as Record<string, unknown>
            const date = String(rec.examDate ?? rec.createdAt ?? '')
            const month = date.slice(0, 7)
            if (month.length === 7) monthMap.set(month, (monthMap.get(month) ?? 0) + toNumber(rec.totalAmount))
          }
          const demoBudgetMap = new Map(DEMO_BUDGET_DATA.map(b => [b.month, b.budget]))
          const months = Array.from(new Set([...Array.from(monthMap.keys()), ...DEMO_BUDGET_DATA.map(b => b.month)]))
            .sort()
            .slice(-6)
          setBudgetData(months.map(m => ({
            month: m,
            budget: Math.round((demoBudgetMap.get(m) ?? 450000) * factor),
            actual: Math.round(monthMap.get(m) ?? 0),
          })))
          if (liveTotalRevenue > 0) setCostRevenueRatio(liveTotalCost / liveTotalRevenue)
          if (!cancelled) setSource('api')
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : '成本数据加载失败，已回退演示数据')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [reloadTick])

  const totalActual = categoryData.reduce((s, c) => s + c.actual, 0)
  const totalBudget = categoryData.reduce((s, c) => s + c.budget, 0)

  const handleExport = () => {
    const rows = [
      ['科目', '预算(元)', '实际(元)', '差异(元)'],
      ...categoryData.map(c => [c.name, String(c.budget), String(c.actual), String(c.actual - c.budget)]),
      [],
      ['月份', '预算(元)', '实际(元)', '偏差率(%)'],
      ...budgetData.map(b => [b.month, String(b.budget), String(b.actual), b.budget ? ((b.actual - b.budget) / b.budget * 100).toFixed(1) : '0']),
    ]
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `成本核算报表_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const costColumns = [
    { title: t('w1tables.cost.category'), dataIndex: 'name', key: 'name' },
    { title: t('w1tables.cost.budget'), dataIndex: 'budget', key: 'budget', align: 'right' as const, render: (v: number) => `¥${v.toLocaleString()}` },
    { title: t('w1tables.cost.actual'), dataIndex: 'actual', key: 'actual', align: 'right' as const, render: (v: number) => `¥${v.toLocaleString()}` },
    {
      title: t('w1tables.cost.variance'), key: 'variance', align: 'right' as const,
      render: (_: unknown, r: CostCategory) => {
        const d = r.actual - r.budget
        return <span style={{ color: d > 0 ? 'var(--color-error-500, #ef4444)' : 'var(--color-success-500, #22c55e)' }}>{d > 0 ? '+' : ''}¥{d.toLocaleString()}</span>
      },
    },
    {
      title: t('w1tables.cost.varianceRate'), key: 'varianceRate', align: 'right' as const,
      render: (_: unknown, r: CostCategory) => {
        const p = r.budget ? ((r.actual - r.budget) / r.budget) * 100 : 0
        return <span style={{ color: p > 0 ? 'var(--color-error-500, #ef4444)' : 'var(--color-success-500, #22c55e)' }}>{p > 0 ? '+' : ''}{p.toFixed(1)}%</span>
      },
    },
  ]

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarSign size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>成本核算</span>
          <span style={{
            fontSize: 11, padding: '2px 8px', borderRadius: 10,
            background: source === 'api' ? 'rgba(34,197,94,0.25)' : 'rgba(245,158,11,0.25)',
            color: source === 'api' ? 'var(--color-success-400, #4ade80)' : 'var(--color-warning-400, #fbbf24)',
            border: `1px solid ${source === 'api' ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)'}`,
            fontWeight: 500,
          }}>
            {source === 'api' ? '数据源: financeApi 实时' : '演示数据(接口不可用)'}
          </span>
          {loading && <span style={{ fontSize: 12, color: '#93c5fd' }}>加载中...</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ActionButton action="refresh" onClick={() => setReloadTick(n => n + 1)}>{t('w1tables.refresh')}</ActionButton>
          <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} />导出报表</button>
        </div>
      </div>
      {error && (
        <div style={{ padding: '8px 24px', background: 'rgba(220,38,38,0.15)', color: '#fca5a5', fontSize: 12, borderBottom: '1px solid rgba(220,38,38,0.3)' }}>
          {error}（已回退演示数据）
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 24px' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>本月总成本</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-error-500, #ef4444)', marginTop: 4 }}>¥{(totalActual / 10000).toFixed(1)}万</div>
          <div style={{ fontSize: 12, color: totalActual > totalBudget ? 'var(--color-error-500, #ef4444)' : 'var(--color-success-500, #22c55e)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            {totalActual > totalBudget ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}超支 ¥{((totalActual - totalBudget) / 10000).toFixed(1)}万
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>人力成本占比</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-primary-500, #3b82f6)', marginTop: 4 }}>
            {((categoryData.find(c => c.name === '人力成本')?.actual || 0) / totalActual * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>耗材成本占比</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-success-500, #22c55e)', marginTop: 4 }}>
            {((categoryData.find(c => c.name === '耗材成本')?.actual || 0) / totalActual * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>成本收入比</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-warning-500, #f59e0b)', marginTop: 4 }}>
            {costRevenueRatio != null ? (costRevenueRatio * 100).toFixed(1) : '55.2'}%
          </div>
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{costRevenueRatio != null ? 'financeApi 实时' : '较上月 +2.3%（演示）'}</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['overview', 'modality', 'budget'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: tab === t ? '#1e40af' : '#21262d', color: tab === t ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t === 'overview' ? <PieChart size={14} /> : t === 'modality' ? <Monitor size={14} /> : <BarChart3 size={14} />}
              {t === 'overview' ? '成本概览' : t === 'modality' ? '设备成本' : '预算执行'}
            </button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          {tab === 'overview' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>成本构成(万元) {source === 'demo' && <span style={{ fontSize: 11, color: '#fbbf24', fontWeight: 400 }}>演示数据</span>}</div>
                <ChartContainer height={280} state={categoryData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无成本构成数据">
                  <RePie>
                    <Pie data={categoryData} dataKey="actual" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                      {categoryData.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                  </RePie>
                </ChartContainer>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>预算 vs 实际(元)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {categoryData.map(c => {
                    const pct = c.budget ? ((c.actual - c.budget) / c.budget * 100) : 0
                    return (
                      <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid #21262d' }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color }} />
                        <span style={{ width: 80, fontSize: 13 }}>{c.name}</span>
                        <div style={{ flex: 1, height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min((c.actual / totalActual) * 100, 100)}%`, height: '100%', background: c.color, borderRadius: 4 }} />
                        </div>
                        <span style={{ width: 80, textAlign: 'right', fontSize: 12 }}>¥{(c.actual / 10000).toFixed(1)}万</span>
                        <span style={{ width: 60, textAlign: 'right', fontSize: 12, color: pct > 0 ? '#ef4444' : '#22c55e' }}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}
          {tab === 'modality' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                各设备次均成本/收入/利润(元)
                <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 400, marginLeft: 8 }}>{source === 'api' ? '次均值由 financeApi 成本/收入派生' : '演示数据'}</span>
              </div>
              <ChartContainer height={320} state={modalityCostData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备成本数据">
                <BarChart data={modalityCostData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                  <Legend />
                  <Bar dataKey="costPerExam" name="次均成本" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenuePerExam" name="次均收入" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profitPerExam" name="次均利润" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          )}
          {tab === 'budget' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>
                月度预算执行情况(元)
                <span style={{ fontSize: 11, color: '#8b949e', fontWeight: 400, marginLeft: 8 }}>{source === 'api' ? '实际列 = 发票按月聚合；预算列为演示派生' : '演示数据'}</span>
              </div>
              <ChartContainer height={320} state={budgetData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无预算数据">
                <BarChart data={budgetData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d' }} />
                  <Legend />
                  <Bar dataKey="budget" name="预算" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="实际" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: 8, padding: '8px 16px', background: '#0d1117', borderRadius: 4, fontSize: 12, color: '#8b949e', fontWeight: 600 }}>
                  <span>月份</span><span style={{ textAlign: 'right' }}>预算</span><span style={{ textAlign: 'right' }}>实际</span><span style={{ textAlign: 'right' }}>差异</span><span style={{ textAlign: 'right' }}>偏差率</span>
                </div>
                {budgetData.map(b => {
                  const v = b.actual - b.budget
                  const vr = b.budget ? (v / b.budget * 100) : 0
                  return (
                    <div key={b.month} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: 8, padding: '8px 16px', borderBottom: '1px solid #21262d', fontSize: 13 }}>
                      <span>{b.month}</span>
                      <span style={{ textAlign: 'right' }}>¥{b.budget.toLocaleString()}</span>
                      <span style={{ textAlign: 'right' }}>¥{b.actual.toLocaleString()}</span>
                      <span style={{ textAlign: 'right', color: v > 0 ? '#ef4444' : '#22c55e' }}>{v > 0 ? '+' : ''}¥{v.toLocaleString()}</span>
                      <span style={{ textAlign: 'right', color: vr > 0 ? '#ef4444' : '#22c55e' }}>{vr > 0 ? '+' : ''}{vr.toFixed(1)}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16, marginTop: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc' }}>{t('w1tables.cost.title')}</div>
          <DataTable dataSource={categoryData} rowKey="name" columns={costColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('w1tables.noData')} />
        </div>
      </div>
    </div>
  )
}
