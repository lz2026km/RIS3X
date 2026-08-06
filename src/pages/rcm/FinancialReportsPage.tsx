import { useState } from 'react'
import { FileSpreadsheet, Download, Printer, BarChart3, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface PLRow { item: string; amount: number; type: 'revenue' | 'cost' | 'expense' }

const PL_DATA: PLRow[] = [
  { item: '检查收入', amount: 620000, type: 'revenue' },
  { item: '药品加成', amount: 72000, type: 'revenue' },
  { item: '其他收入', amount: 37000, type: 'revenue' },
  { item: '耗材成本', amount: -182000, type: 'cost' },
  { item: '人力成本', amount: -140000, type: 'cost' },
  { item: '设备折旧', amount: -63000, type: 'cost' },
  { item: '管理费用', amount: -85000, type: 'expense' },
  { item: '运营费用', amount: -62000, type: 'expense' },
  { item: '营销费用', amount: -38000, type: 'expense' },
]

const MONTHLY_PL = [
  { month: '2026-01', revenue: 680000, cost: 365000, grossProfit: 315000, operatingExpenses: 178000, netIncome: 137000 },
  { month: '2026-02', revenue: 652000, cost: 352000, grossProfit: 300000, operatingExpenses: 175000, netIncome: 125000 },
  { month: '2026-03', revenue: 698000, cost: 378000, grossProfit: 320000, operatingExpenses: 182000, netIncome: 138000 },
  { month: '2026-04', revenue: 729000, cost: 385000, grossProfit: 344000, operatingExpenses: 185000, netIncome: 159000 },
]

const KPI_DATA = [
  { label: '次均收入', value: '¥162.3', change: 5.2, trend: 'up' as const },
  { label: '成本收入比', value: '55.2%', change: -2.3, trend: 'down' as const },
  { label: '利润率', value: '21.8%', change: 3.5, trend: 'up' as const },
  { label: '人均创收', value: '¥143,500', change: 8.1, trend: 'up' as const },
  { label: '单设备产值', value: '¥287,000', change: -1.2, trend: 'down' as const },
  { label: '应收账款周转', value: '38天', change: -5, trend: 'up' as const },
]

export default function FinancialReportsPage() {
  const [tab, setTab] = useState<'pl' | 'kpi'>('pl')

  const totalRevenue = PL_DATA.filter(r => r.type === 'revenue').reduce((s, r) => s + r.amount, 0)
  const totalCost = PL_DATA.filter(r => r.type === 'cost').reduce((s, r) => s + r.amount, 0)
  const totalExpense = PL_DATA.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0)
  const netIncome = totalRevenue + totalCost + totalExpense
  const profitRate = totalRevenue ? (netIncome / totalRevenue * 100) : 0

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
        <p>期间: 2026年4月 | 生成时间: ${new Date().toLocaleString()}</p>
        <table>
          <tr><th>项目</th><th>金额(元)</th></tr>
          ${PL_DATA.map(r => `<tr style="color: ${r.amount >= 0 ? '#333' : '#dc2626'}"><td>${r.item}</td><td style="text-align:right">¥${Math.abs(r.amount).toLocaleString()}</td></tr>`).join('')}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><FileSpreadsheet size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>财务报表</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handlePrint} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Printer size={14} />打印</button>
          <button onClick={() => { const csv = '科目,本月,本年累计\n总收入,1234567,12345678\n总支出,654321,7654321\n净利润,580246,4691357\n'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '财务报表.csv'; a.click(); URL.revokeObjectURL(url); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} />导出CSV</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, padding: '20px 24px 0' }}>
        {(['pl', 'kpi'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: tab === t ? '#1e40af' : '#21262d', color: tab === t ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
            {t === 'pl' ? <BarChart3 size={14} /> : <Activity size={14} />}
            {t === 'pl' ? '损益表' : 'KPI指标'}
          </button>
        ))}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {tab === 'pl' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>损益表 — 2026年4月</div>
              <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 16 }}>单位: 元</div>
              {PL_DATA.map((r, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #21262d', fontSize: 13 }}>
                  <span style={{ color: r.type === 'revenue' ? '#22c55e' : r.type === 'cost' ? '#ef4444' : '#f59e0b' }}>
                    {r.type === 'revenue' ? '📈' : r.type === 'cost' ? '📉' : '📊'} {r.item}
                  </span>
                  <span style={{ fontWeight: 600, color: r.amount >= 0 ? '#f0f6fc' : '#ef4444' }}>
                    {r.amount >= 0 ? '+' : ''}¥{r.amount.toLocaleString()}
                  </span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', fontSize: 15, fontWeight: 700, borderTop: '2px solid #30363d', marginTop: 8 }}>
                <span>净利润</span>
                <span style={{ color: netIncome >= 0 ? '#22c55e' : '#ef4444' }}>¥{netIncome.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#8b949e', marginTop: 4 }}>
                <span>毛利率: {((totalRevenue + totalCost) / totalRevenue * 100).toFixed(1)}%</span>
                <span>净利率: {profitRate.toFixed(1)}%</span>
              </div>
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>月度净利润趋势(元)</div>
              {MONTHLY_PL.map(m => {
                const maxNI = Math.max(...MONTHLY_PL.map(x => x.netIncome))
                const barPct = (m.netIncome / maxNI) * 100
                return (
                  <div key={m.month} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <span style={{ width: 60, fontSize: 12, color: '#8b949e' }}>{m.month.slice(5)}</span>
                    <div style={{ flex: 1, height: 20, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ width: `${barPct}%`, height: '100%', background: m.netIncome >= 0 ? '#22c55e' : '#ef4444', borderRadius: 4, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ width: 80, textAlign: 'right', fontSize: 12, fontWeight: 600 }}>¥{(m.netIncome / 10000).toFixed(1)}万</span>
                  </div>
                )
              })}
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>月度汇总</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '8px 0', borderBottom: '1px solid #21262d', fontSize: 12, color: '#8b949e', fontWeight: 600 }}>
                  <span>月份</span><span style={{ textAlign: 'right' }}>收入</span><span style={{ textAlign: 'right' }}>成本</span><span style={{ textAlign: 'right' }}>毛利</span><span style={{ textAlign: 'right' }}>净利</span>
                </div>
                {MONTHLY_PL.map(m => (
                  <div key={m.month} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, padding: '8px 0', borderBottom: '1px solid #21262d', fontSize: 12 }}>
                    <span>{m.month}</span>
                    <span style={{ textAlign: 'right', color: '#22c55e' }}>¥{(m.revenue / 10000).toFixed(1)}万</span>
                    <span style={{ textAlign: 'right', color: '#ef4444' }}>¥{(m.cost / 10000).toFixed(1)}万</span>
                    <span style={{ textAlign: 'right' }}>¥{(m.grossProfit / 10000).toFixed(1)}万</span>
                    <span style={{ textAlign: 'right', fontWeight: 600, color: m.netIncome >= 0 ? '#22c55e' : '#ef4444' }}>¥{(m.netIncome / 10000).toFixed(1)}万</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
              {KPI_DATA.map(kpi => (
                <div key={kpi.label} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: '#8b949e' }}>{kpi.label}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: kpi.trend === 'up' ? '#22c55e' : '#ef4444' }}>
                      {kpi.trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      {kpi.change >= 0 ? '+' : ''}{kpi.change.toFixed(1)}%
                    </span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700 }}>{kpi.value}</div>
                  <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>{kpi.trend === 'up' ? '较上月提升' : '较上月下降'}</div>
                </div>
              ))}
            </div>
            <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>财务指标说明</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {[
                  { title: '次均收入', desc: '每项检查平均收入金额，反映定价水平和服务结构' },
                  { title: '成本收入比', desc: '总成本/总收入，越低说明成本控制越好' },
                  { title: '利润率', desc: '净利润/总收入，反映整体盈利水平' },
                  { title: '人均创收', desc: '总收入/在职人数，衡量人力资源产出效率' },
                  { title: '单设备产值', desc: '总收入/在用设备数，评估设备利用效率' },
                  { title: '应收账款周转', desc: '平均回款天数，反映资金回收效率' },
                ].map(m => (
                  <div key={m.title} style={{ padding: 12, background: '#0d1117', borderRadius: 6 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{m.title}</div>
                    <div style={{ fontSize: 12, color: '#8b949e' }}>{m.desc}</div>
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
