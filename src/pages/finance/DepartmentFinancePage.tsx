import { useState, useEffect } from 'react'
import { message } from 'antd'
import { financeApi, type RevenueAnalysisDto, type CostAccountingDto } from '../../services/api/financeApi'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import {
  DollarSign, TrendingUp, TrendingDown, PieChart as PieIcon,
  BarChart3, Download, Calendar, ArrowUp, ArrowDown,
} from 'lucide-react'

type Period = 'monthly' | 'quarterly' | 'yearly'

const MONTHLY_REVENUE = [
  { month: '1月', revenue: 328000, cost: 195000, profit: 133000 },
  { month: '2月', revenue: 298000, cost: 182000, profit: 116000 },
  { month: '3月', revenue: 356000, cost: 210000, profit: 146000 },
  { month: '4月', revenue: 342000, cost: 205000, profit: 137000 },
  { month: '5月', revenue: 385000, cost: 220000, profit: 165000 },
  { month: '6月', revenue: 372000, cost: 218000, profit: 154000 },
]

const REVENUE_BY_MODALITY = [
  { name: 'CT', value: 425000, color: '#3b82f6' },
  { name: 'MRI', value: 512000, color: '#22c55e' },
  { name: 'X-Ray', value: 258000, color: '#f59e0b' },
  { name: 'Mammo', value: 185000, color: '#ef4444' },
  { name: 'Ultrasound', value: 156000, color: '#8b5cf6' },
  { name: '其他', value: 89000, color: '#6e7681' },
]

const COST_BREAKDOWN = [
  { category: '人力成本', amount: 420000, percent: 38 },
  { category: '设备折旧', amount: 280000, percent: 25 },
  { category: '耗材', amount: 185000, percent: 17 },
  { category: '维护保养', amount: 120000, percent: 11 },
  { category: '其他', amount: 98000, percent: 9 },
]

const INSURANCE_MIX = [
  { type: '城镇职工医保', amount: 685000, percent: 48 },
  { type: '城镇居民医保', amount: 312000, percent: 22 },
  { type: '自费', amount: 256000, percent: 18 },
  { type: '商业保险', amount: 172000, percent: 12 },
]

export default function DepartmentFinancePage() {
  const [period, setPeriod] = useState<Period>('monthly')
  const [revenueData, setRevenueData] = useState<RevenueAnalysisDto | null>(null)
  const [costData, setCostData] = useState<CostAccountingDto | null>(null)
  useEffect(() => {
    financeApi.getRevenueAnalysis().then(res => { if (res.success) setRevenueData(res.data); }).catch(() => {})
    financeApi.getCostAccounting().then(res => { if (res.success) setCostData(res.data); }).catch(() => {})
  }, [period])

  const totalRev = MONTHLY_REVENUE.reduce((s, m) => s + m.revenue, 0)
  const totalCost = MONTHLY_REVENUE.reduce((s, m) => s + m.cost, 0)
  const totalProfit = MONTHLY_REVENUE.reduce((s, m) => s + m.profit, 0)
  const margin = ((totalProfit / totalRev) * 100).toFixed(1)

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DollarSign size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>科室财务管理</span></div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['monthly', 'quarterly', 'yearly'] as const).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: period === p ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)', color: '#fff' }}>
              {p === 'monthly' ? '月度' : p === 'quarterly' ? '季度' : '年度'}
            </button>
          ))}
          <button onClick={() => { const csv = '科室,收入,支出,利润\n' + ['CT','MR','DR','DSA','MG'].join('\n') + '\n'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `科室财务_${period}.csv`; a.click(); URL.revokeObjectURL(url); message.success('已导出 ' + a.download); }} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: 'rgba(255,255,255,0.15)', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Download size={14} />导出
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: '总收入', value: totalRev.toLocaleString(), unit: '¥', icon: TrendingUp, trend: 'up', color: '#22c55e' },
            { title: '总成本', value: totalCost.toLocaleString(), unit: '¥', icon: TrendingDown, trend: 'up', color: '#ef4444' },
            { title: '净利润', value: totalProfit.toLocaleString(), unit: '¥', icon: DollarSign, trend: 'up', color: '#3b82f6' },
            { title: '利润率', value: margin, unit: '%', icon: PieIcon, trend: 'up', color: '#8b5cf6' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 180 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc' }}>
                {k.unit}{k.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#6e7681', marginLeft: 4 }}>{k.unit === '¥' ? '' : ''}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="#3b82f6" />月度收支趋势
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={MONTHLY_REVENUE}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, undefined]} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} name="收入" />
                <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} name="成本" />
                <Line type="monotone" dataKey="profit" stroke="#3b82f6" strokeWidth={2} dot={false} name="利润" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#f59e0b" />各检查类型收入分布
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={REVENUE_BY_MODALITY}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, '收入']} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {REVENUE_BY_MODALITY.map((e, i) => (
                    <Cell key={i} fill={e.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieIcon size={16} color="#8b5cf6" />成本构成
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={COST_BREAKDOWN} cx="50%" cy="50%" outerRadius={80} dataKey="amount" nameKey="category" label={({ percent }) => `${(percent).toFixed(0)}%`}>
                    {COST_BREAKDOWN.map((e, i) => {
                      const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6']
                      return <Cell key={i} fill={colors[i]} />
                    })}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} formatter={(v: number) => [`¥${v.toLocaleString()}`, '金额']} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {COST_BREAKDOWN.map((c, i) => {
                  const colors = ['#ef4444', '#f59e0b', '#3b82f6', '#22c55e', '#8b5cf6']
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 2, background: colors[i], display: 'inline-block' }} />
                      <span style={{ color: '#8b949e', flex: 1 }}>{c.category}</span>
                      <span style={{ color: '#f0f6fc', fontWeight: 600 }}>{c.percent}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />支付类型构成
            </div>
            {INSURANCE_MIX.map((im, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span style={{ color: '#8b949e' }}>{im.type}</span>
                  <span style={{ color: '#f0f6fc' }}>{im.percent}%</span>
                </div>
                <div style={{ height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${im.percent}%`, background: i === 0 ? '#3b82f6' : i === 1 ? '#22c55e' : i === 2 ? '#f59e0b' : '#8b5cf6', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: '#6e7681', marginTop: 2 }}>¥{im.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
