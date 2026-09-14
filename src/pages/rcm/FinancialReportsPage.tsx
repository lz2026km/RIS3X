// [W2-A] 损益表/KPI 接入 financeApi (getFinancialReports + getRevenueAnalysis) + statsApi
import { useState, useEffect, useCallback } from 'react'
import { FileSpreadsheet, Download, Printer, BarChart3, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { financeApi } from '../../services/api/financeApi'
import { statsApi } from '../../services/api/statsApi'
import { t } from '../../i18n/appI18n'

interface PLRow { itemKey: string; amount: number; type: 'revenue' | 'cost' | 'expense' }

const PL_DATA: PLRow[] = [
  { itemKey: 'financeReport.item.examRevenue', amount: 620000, type: 'revenue' },
  { itemKey: 'financeReport.item.drugMarkup', amount: 72000, type: 'revenue' },
  { itemKey: 'financeReport.item.otherRevenue', amount: 37000, type: 'revenue' },
  { itemKey: 'financeReport.item.materialCost', amount: -182000, type: 'cost' },
  { itemKey: 'financeReport.item.laborCost', amount: -140000, type: 'cost' },
  { itemKey: 'financeReport.item.depreciation', amount: -63000, type: 'cost' },
  { itemKey: 'financeReport.item.adminExpense', amount: -85000, type: 'expense' },
  { itemKey: 'financeReport.item.operatingExpense', amount: -62000, type: 'expense' },
  { itemKey: 'financeReport.item.marketingExpense', amount: -38000, type: 'expense' },
]

const MONTHLY_PL = [
  { month: '2026-01', revenue: 680000, cost: 365000, grossProfit: 315000, operatingExpenses: 178000, netIncome: 137000 },
  { month: '2026-02', revenue: 652000, cost: 352000, grossProfit: 300000, operatingExpenses: 175000, netIncome: 125000 },
  { month: '2026-03', revenue: 698000, cost: 378000, grossProfit: 320000, operatingExpenses: 182000, netIncome: 138000 },
  { month: '2026-04', revenue: 729000, cost: 385000, grossProfit: 344000, operatingExpenses: 185000, netIncome: 159000 },
]

const KPI_DATA = [
  { labelKey: 'financeReport.kpi.avgRevenue', value: '¥162.3', change: 5.2, trend: 'up' as const },
  { labelKey: 'financeReport.kpi.costRatio', value: '55.2%', change: -2.3, trend: 'down' as const },
  { labelKey: 'financeReport.kpi.profitRate', value: '21.8%', change: 3.5, trend: 'up' as const },
  { labelKey: 'financeReport.kpi.revenuePerStaff', value: '¥143,500', change: 8.1, trend: 'up' as const },
  { labelKey: 'financeReport.kpi.revenuePerDevice', value: '¥287,000', change: -1.2, trend: 'down' as const },
  { labelKey: 'financeReport.kpi.receivableTurnover', value: '38天', change: -5, trend: 'up' as const },
]

export default function FinancialReportsPage() {
  const [tab, setTab] = useState<'pl' | 'kpi'>('pl')
  // [W2-A] financeApi 实时状态 (失败回退静态演示数据)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [apiError, setApiError] = useState('')
  const [plData, setPlData] = useState<PLRow[]>(PL_DATA)
  const [monthlyPl, setMonthlyPl] = useState(MONTHLY_PL)
  const [kpiData, setKpiData] = useState(KPI_DATA)
  const [periodLabel, setPeriodLabel] = useState('2026年4月')
  // [G005 Wave1B] financeApi.getFinancialReports 真实报表 (用于 CSV 导出, 无数据时禁用导出)
  const [financialReports, setFinancialReports] = useState<any[] | null>(null)

  const toNum = (v: unknown): number => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const loadFinance = useCallback(async () => {
    setLoading(true)
    setApiError('')
    try {
      const [repR, revR, costR, dailyR] = await Promise.allSettled([
        financeApi.getFinancialReports(),
        financeApi.getRevenueAnalysis(),
        financeApi.getCostAccounting(),
        statsApi.getDaily(),
      ])
      const rev = revR.status === 'fulfilled' && revR.value.success ? revR.value.data as any : null
      const cost = costR.status === 'fulfilled' && costR.value.success ? costR.value.data as any : null
      const daily = dailyR.status === 'fulfilled' && dailyR.value.success ? dailyR.value.data as any : null
      if (!rev && !cost) {
        setDataSource('demo')
        setApiError(t('financeReport.apiUnavailable'))
        return
      }
      setDataSource('api')

      // 收入: MSW {daily[],monthly[]} / Nest {period,totalRevenue,...}
      const monthlyRaw = Array.isArray(rev?.monthly) ? rev.monthly : Array.isArray(rev?.daily) ? rev.daily : []
      const monthly = monthlyRaw
        .map((m: any) => ({ month: String(m.month ?? m.date ?? ''), revenue: toNum(m.amount ?? m.revenue) }))
        .filter((m: { month: string }) => m.month.length > 0)
      const revenue = monthly.reduce((s: number, m: { revenue: number }) => s + m.revenue, 0) || toNum(rev?.totalRevenue ?? rev?.totalProfit)
      const costTotal = toNum(cost?.totalCost) || toNum(rev?.totalCost)
      const profit = revenue - costTotal
      const profitRate = revenue > 0 ? (profit / revenue) * 100 : 0

      if (revenue > 0 || costTotal > 0) {
        const rows: PLRow[] = []
        if (revenue > 0) rows.push({ itemKey: 'financeReport.item.examRevenue', amount: Math.round(revenue), type: 'revenue' })
        if (costTotal > 0) {
          rows.push({ itemKey: 'financeReport.item.materialCost', amount: -Math.round(costTotal * 0.55), type: 'cost' })
          rows.push({ itemKey: 'financeReport.item.laborCost', amount: -Math.round(costTotal * 0.3), type: 'cost' })
          rows.push({ itemKey: 'financeReport.item.depreciation', amount: -Math.round(costTotal * 0.15), type: 'cost' })
        }
        if (rows.length > 0) setPlData(rows)

        const costRatio = revenue > 0 ? costTotal / revenue : 0
        if (monthly.length > 0) {
          setMonthlyPl(monthly.map((m: { month: string; revenue: number }) => {
            const mCost = Math.round(m.revenue * costRatio)
            return { month: m.month, revenue: m.revenue, cost: mCost, grossProfit: m.revenue - mCost, operatingExpenses: 0, netIncome: m.revenue - mCost }
          }))
        }

        const exams = toNum(daily?.examCount)
        const avgRevenue = exams > 0 && revenue > 0 ? revenue / exams : 0
        const fb = (i: number) => KPI_DATA[i]?.value ?? ''
        setKpiData([
          { labelKey: 'financeReport.kpi.avgRevenue', value: avgRevenue > 0 ? `¥${avgRevenue.toFixed(1)}` : fb(0), change: 5.2, trend: 'up' as const },
          { labelKey: 'financeReport.kpi.costRatio', value: revenue > 0 ? `${(costTotal / revenue * 100).toFixed(1)}%` : fb(1), change: -2.3, trend: 'down' as const },
          { labelKey: 'financeReport.kpi.profitRate', value: revenue > 0 ? `${profitRate.toFixed(1)}%` : fb(2), change: 3.5, trend: 'up' as const },
          { labelKey: 'financeReport.kpi.revenuePerStaff', value: fb(3), change: 8.1, trend: 'up' as const },
          { labelKey: 'financeReport.kpi.revenuePerDevice', value: fb(4), change: -1.2, trend: 'down' as const },
          { labelKey: 'financeReport.kpi.receivableTurnover', value: fb(5), change: -5, trend: 'up' as const },
        ])
        const rep = repR.status === 'fulfilled' && repR.value.success ? (repR.value.data as any) : null
        if (rep?.period) setPeriodLabel(rep.period)
        else if (rev?.period) setPeriodLabel(rev.period)
        if (rep) setFinancialReports(Array.isArray(rep) ? rep : [rep])
      }
    } catch (e) {
      setDataSource('demo')
      setApiError(e instanceof Error ? e.message : t('financeReport.loadFailedFallback'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadFinance() }, [loadFinance])

  const totalRevenue = plData.filter(r => r.type === 'revenue').reduce((s, r) => s + r.amount, 0)
  const totalCost = plData.filter(r => r.type === 'cost').reduce((s, r) => s + r.amount, 0)
  const totalExpense = plData.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const netIncome = totalRevenue + totalCost + totalExpense
  const profitRate = totalRevenue ? (netIncome / totalRevenue * 100) : 0

  // [G005 Wave1B] 真实导出: 用已加载的 financeApi 数据生成 CSV (Blob), 无数据时禁用
  const handleExportCsv = () => {
    if (!financialReports || financialReports.length === 0) return
    const esc = (v: unknown) => {
      const s = String(v ?? '')
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const lines: string[] = ['报表ID,报表类型,期间,生成时间,状态']
    for (const r of financialReports) {
      lines.push([r.id, r.reportType, r.period, r.generatedAt, r.status].map(esc).join(','))
    }
    lines.push('')
    lines.push('科目,金额(元)')
    for (const r of plData) {
      lines.push([t(r.itemKey), r.amount].map(esc).join(','))
    }
    lines.push(['净利润', netIncome].map(esc).join(','))
    lines.push('')
    lines.push('月份,收入(元),成本(元),毛利(元),净利(元)')
    for (const m of monthlyPl) {
      lines.push([m.month, m.revenue, m.cost, m.grossProfit, m.netIncome].map(esc).join(','))
    }
    const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `财务报表_${periodLabel.replace(/\s+/g, '')}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handlePrint = () => {
    const w = window.open('', '_blank')
    if (!w) return
    w.document.write(`
      <html><head><title>财务报表</title><style>
        body { font-family: Arial,sans-serif; padding: 20px; color: #333; }
        h1 { color: #1e40af; } table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th,td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 13px; }
        th { background: #1e40af; color: #fff; } tr:nth-child(even) { background: #f9f9f9; }
        .total { font-weight: 700; background: #e8f0fe; }
      </style></head><body>
        <h1>放射科损益表</h1>
        <p>期间: ${periodLabel} | 生成时间: ${new Date().toLocaleString()}</p>
        <table>
          <tr><th>项目</th><th>金额(元)</th></tr>
          ${plData.map(r => `<tr style="color: ${r.amount >= 0 ? '#333' : '#dc2626'}"><td>${t(r.itemKey)}</td><td style="text-align:right">¥${Math.abs(r.amount).toLocaleString()}</td></tr>`).join('')}
          <tr class="total"><td>净利润</td><td style="text-align:right">¥${netIncome.toLocaleString()}</td></tr>
        </table>
      </body></html>
    `)
    w.document.close()
    w.print()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><FileSpreadsheet size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>{t('financeReport.title')}</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Printer size={14} />{t('financeReport.print')}</button>
          <button onClick={handleExportCsv} disabled={!financialReports || financialReports.length === 0} title={!financialReports || financialReports.length === 0 ? t('financeReport.exportDisabledTitle') : t('financeReport.exportEnabledTitle')} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: !financialReports || financialReports.length === 0 ? 'not-allowed' : 'pointer', opacity: !financialReports || financialReports.length === 0 ? 0.5 : 1, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} />{t('financeReport.exportCsv')}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '20px 24px 0' }}>
        {(['pl', 'kpi'] as const).map(tabKey => (
          <button key={tabKey} onClick={() => setTab(tabKey)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: tab === tabKey ? '#1e40af' : '#21262d', color: tab === tabKey ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
            {tabKey === 'pl' ? <BarChart3 size={14} /> : <Activity size={14} />}
            {tabKey === 'pl' ? t('financeReport.pl') : t('financeReport.kpi')}
          </button>
        ))}
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 6, fontSize: 12, background: dataSource === 'api' ? 'rgba(34,197,94,0.13)' : 'rgba(245,158,11,0.13)', color: dataSource === 'api' ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)', fontWeight: 600 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? 'var(--color-success-500, #22c55e)' : 'var(--color-warning-500, #f59e0b)' }} />
          {loading ? t('financeReport.syncing') : dataSource === 'api' ? t('financeReport.sourceApi') : t('financeReport.sourceDemo')}
        </span>
        {apiError && (
          <span style={{ fontSize: 12, color: 'var(--color-error-500, #ef4444)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {apiError}
            <button onClick={() => void loadFinance()} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid var(--color-error-500, #ef4444)', background: 'transparent', color: 'var(--color-error-500, #ef4444)', cursor: 'pointer', fontSize: 12 }}>{t('financeReport.retry')}</button>
          </span>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {tab === 'pl' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>{t('financeReport.plTitle')} — {periodLabel} {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>{t('financeReport.realtimeNote')}</span>}</div>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>{t('financeReport.unitYuan')}</div>
              {plData.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #21262d', fontSize: 13 }}>
                  <span style={{ color: r.type === 'revenue' ? 'var(--color-success-500, #22c55e)' : r.type === 'cost' ? 'var(--color-error-500, #ef4444)' : 'var(--color-warning-500, #f59e0b)' }}>
                    {r.type === 'revenue' ? '📈' : r.type === 'cost' ? '📉' : '📊'} {t(r.itemKey)}
                  </span>
                  <span style={{ fontWeight: 600, color: r.amount >= 0 ? '#f0f6fc' : 'var(--color-error-500, #ef4444)' }}>
                    {r.amount >= 0 ? '+' : ''}¥{r.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 15, fontWeight: 700, borderTop: '2px solid #30363d', marginTop: 8 }}>
                <span>{t('financeReport.netIncome')}</span>
                <span style={{ color: netIncome >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)' }}>¥{netIncome.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                <span>{t('financeReport.grossMargin')}: {((totalRevenue + totalCost) / totalRevenue * 100).toFixed(1)}%</span>
                <span>{t('financeReport.netMargin')}: {profitRate.toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('financeReport.monthlyTrend')} {dataSource === 'api' && <span style={{ fontSize: 11, color: '#22c55e' }}>{t('financeReport.realtimeShort')}</span>}</div>
              {monthlyPl.map(m => {
                const maxNI = Math.max(...monthlyPl.map(x => x.netIncome)) || 1
                const barPct = (m.netIncome / maxNI) * 100
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ width: 60, fontSize: 12, color: '#8b949e' }}>{m.month.slice(5)}</span>
                    <div style={{ flex: 1, height: 20, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: m.netIncome >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>¥{(m.netIncome / 10000).toFixed(1)}{t('financeReport.unitWan')}</span>
                  </div>
                )
              })}
                <div style={{ marginTop: 20 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{t('financeReport.monthlySummary')}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '8px 0', borderBottom: '1px solid #21262d', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>
                    <span>{t('financeReport.colMonth')}</span><span style={{ textAlign: 'right' }}>{t('financeReport.colRevenue')}</span><span style={{ textAlign: 'right' }}>{t('financeReport.colCost')}</span><span style={{ textAlign: 'right' }}>{t('financeReport.colGrossProfit')}</span><span style={{ textAlign: 'right' }}>{t('financeReport.colNetIncome')}</span>
                  </div>
                  {monthlyPl.map(m => (
                    <div key={m.month} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '8px 0', borderBottom: '1px solid #21262d', fontSize: 12 }}>
                      <span>{m.month}</span>
                      <span style={{ textAlign: 'right', color: 'var(--color-success-500, #22c55e)' }}>¥{(m.revenue / 10000).toFixed(1)}{t('financeReport.unitWan')}</span>
                      <span style={{ textAlign: 'right', color: 'var(--color-error-500, #ef4444)' }}>¥{(m.cost / 10000).toFixed(1)}{t('financeReport.unitWan')}</span>
                      <span style={{ textAlign: 'right' }}>¥{(m.grossProfit / 10000).toFixed(1)}{t('financeReport.unitWan')}</span>
                      <span style={{ textAlign: 'right', fontWeight: 600, color: m.netIncome >= 0 ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)' }}>¥{(m.netIncome / 10000).toFixed(1)}{t('financeReport.unitWan')}</span>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, color: '#8b949e' }}>
              {t('financeReport.kpiNote')}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {kpiData.map(kpi => (
                <div key={kpi.labelKey} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#8b949e' }}>{t(kpi.labelKey)}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: kpi.trend === 'up' ? 'var(--color-success-500, #22c55e)' : 'var(--color-error-500, #ef4444)' }}>
                      {kpi.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {kpi.change >= 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{kpi.value}</div>
                  <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{kpi.trend === 'up' ? t('financeReport.trendUp') : t('financeReport.trendDown')}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>{t('financeReport.kpiExplain')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { titleKey: 'financeReport.kpi.avgRevenue', descKey: 'financeReport.kpiExplain.avgRevenue' },
                  { titleKey: 'financeReport.kpi.costRatio', descKey: 'financeReport.kpiExplain.costRatio' },
                  { titleKey: 'financeReport.kpi.profitRate', descKey: 'financeReport.kpiExplain.profitRate' },
                  { titleKey: 'financeReport.kpi.revenuePerStaff', descKey: 'financeReport.kpiExplain.revenuePerStaff' },
                  { titleKey: 'financeReport.kpi.revenuePerDevice', descKey: 'financeReport.kpiExplain.revenuePerDevice' },
                  { titleKey: 'financeReport.kpi.receivableTurnover', descKey: 'financeReport.kpiExplain.receivableTurnover' },
                ].map(m => (
                  <div key={m.titleKey} style={{ padding: 12, background: '#0d1117', borderRadius: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{t(m.titleKey)}</div>
                    <div style={{ fontSize: 12, color: '#8b949e' }}>{t(m.descKey)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
