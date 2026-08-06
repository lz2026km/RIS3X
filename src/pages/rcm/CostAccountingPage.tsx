import { useState } from 'react'
import {
  DollarSign, BarChart3, PieChart,
  Monitor, Download,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePie, Pie, Cell, Legend,
} from 'recharts'

interface CostCategory { name: string; budget: number; actual: number; color: string }
interface ModalityCost { name: string; costPerExam: number; revenuePerExam: number; profitPerExam: number; color: string }
interface BudgetRow { month: string; budget: number; actual: number }



const CATEGORY_DATA: CostCategory[] = [
  { name: '人力成本', budget: 152000, actual: 158000, color: '#3b82f6' },
  { name: '耗材成本', budget: 135000, actual: 142000, color: '#22c55e' },
  { name: '设备折旧', budget: 85000, actual: 85000, color: '#f59e0b' },
  { name: '管理费用', budget: 48000, actual: 52000, color: '#8b5cf6' },
  { name: '其他费用', budget: 30000, actual: 38000, color: '#6b7280' },
]

const MODALITY_COST_DATA: ModalityCost[] = [
  { name: 'CT', costPerExam: 84, revenuePerExam: 154, profitPerExam: 70, color: '#3b82f6' },
  { name: 'MRI', costPerExam: 158.8, revenuePerExam: 276.5, profitPerExam: 117.7, color: '#8b5cf6' },
  { name: 'DSA', costPerExam: 633.3, revenuePerExam: 1300, profitPerExam: 666.7, color: '#f59e0b' },
  { name: 'DR', costPerExam: 19.4, revenuePerExam: 25, profitPerExam: 5.6, color: '#22c55e' },
]

const BUDGET_DATA: BudgetRow[] = [
  { month: '2026-01', budget: 440000, actual: 418000 },
  { month: '2026-02', budget: 440000, actual: 435000 },
  { month: '2026-03', budget: 450000, actual: 465000 },
  { month: '2026-04', budget: 450000, actual: 475000 },
]

export default function CostAccountingPage() {
  const [tab, setTab] = useState<'overview' | 'modality' | 'budget'>('overview')

  const totalActual = CATEGORY_DATA.reduce((s, c) => s + c.actual, 0)
  const totalBudget = CATEGORY_DATA.reduce((s, c) => s + c.budget, 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><DollarSign size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>成本核算</span></div>
        <button onClick={() => { const csv = '科目,预算,实际,差异\n人员经费,150000,145000,-5000\n设备折旧,80000,82340,2340\n材料费,120000,128900,8900\n水电费,25000,23400,-1600\n其他,50000,51300,1300\n'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '成本核算报表.csv'; a.click(); URL.revokeObjectURL(url); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} />导出报表</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 24px' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>本月总成本</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>¥{(totalActual / 10000).toFixed(1)}万</div>
          <div style={{ fontSize: 12, color: totalActual > totalBudget ? '#ef4444' : '#22c55e', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
            {totalActual > totalBudget ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}超支 ¥{((totalActual - totalBudget) / 10000).toFixed(1)}万
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>人力成本占比</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>
            {((CATEGORY_DATA.find(c => c.name === '人力成本')?.actual || 0) / totalActual * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>耗材成本占比</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>
            {((CATEGORY_DATA.find(c => c.name === '耗材成本')?.actual || 0) / totalActual * 100).toFixed(1)}%
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 12, color: '#8b949e' }}>成本收入比</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>55.2%</div>
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>较上月 +2.3%</div>
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
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>成本构成(万元)</div>
                <ResponsiveContainer width="100%" height={280}>
                  <RePie>
                    <Pie data={CATEGORY_DATA} dataKey="actual" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                      {CATEGORY_DATA.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </RePie>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>预算 vs 实际(元)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {CATEGORY_DATA.map(c => {
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
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>各设备次均成本/收入/利润(元)</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={MODALITY_COST_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="costPerExam" name="次均成本" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="revenuePerExam" name="次均收入" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profitPerExam" name="次均利润" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {tab === 'budget' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>月度预算执行情况(元)</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={BUDGET_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="budget" name="预算" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" name="实际" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 100px 100px 80px', gap: 8, padding: '8px 16px', background: '#0d1117', borderRadius: 4, fontSize: 12, color: '#8b949e', fontWeight: 600 }}>
                  <span>月份</span><span style={{ textAlign: 'right' }}>预算</span><span style={{ textAlign: 'right' }}>实际</span><span style={{ textAlign: 'right' }}>差异</span><span style={{ textAlign: 'right' }}>偏差率</span>
                </div>
                {BUDGET_DATA.map(b => {
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
      </div>
    </div>
  )
}
