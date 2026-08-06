import { useState } from 'react'
import { TrendingUp, DollarSign, BarChart3, ArrowUpRight, ArrowDownRight, Monitor, Users, Building2, Download, Activity } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePie, Pie, Cell, Legend } from 'recharts'

const MONTHLY_DATA = [
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

const MODALITY_DATA = [
  { name: 'CT', revenue: 385, exams: 2500, color: '#3b82f6' },
  { name: 'MRI', revenue: 235, exams: 850, color: '#8b5cf6' },
  { name: 'DSA', revenue: 195, exams: 150, color: '#f59e0b' },
  { name: 'DR', revenue: 45, exams: 1800, color: '#22c55e' },
]

const PAYER_DATA = [
  { name: '医保(城镇职工)', value: 516, color: '#3b82f6' },
  { name: '医保(城乡居民)', value: 172, color: '#8b5cf6' },
  { name: '商业保险', value: 98, color: '#059669' },
  { name: '自费', value: 48, color: '#d97706' },
  { name: '公费/其他', value: 26, color: '#6b7280' },
]

const DOCTOR_DATA = [
  { name: '张伟', revenue: 185, exams: 1120 },
  { name: '李娜', revenue: 168, exams: 980 },
  { name: '王建国', revenue: 152, exams: 890 },
  { name: '刘芳', revenue: 128, exams: 760 },
  { name: '陈明', revenue: 115, exams: 680 },
]

export default function RevenueAnalysisPage() {
  const [view, setView] = useState<'trend' | 'modality' | 'payer' | 'doctor'>('trend')

  const latest = MONTHLY_DATA[MONTHLY_DATA.length - 1]
  const previous = MONTHLY_DATA[MONTHLY_DATA.length - 3]
  const momRevenue = previous.revenue ? ((latest.revenue - previous.revenue) / previous.revenue * 100) : 0
  const momProfit = previous.profit ? ((latest.profit - previous.profit) / previous.profit * 100) : 0
  const momExams = previous.exams ? ((latest.exams - previous.exams) / previous.exams * 100) : 0

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}><BarChart3 size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>收入分析</span></div>
        <button onClick={() => { const csv = '项目,数量,金额\nCT增强,1234,2345678\nMR增强,856,1987654\nDR,2345,876543\nDSA,123,567890\nMG,234,234567\n'; const blob = new Blob([csv], { type: 'text/csv' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = '收入分析报告.csv'; a.click(); URL.revokeObjectURL(url); }} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}><Download size={14} />导出报告</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, padding: '20px 24px' }}>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>月收入(万元)</span>
            <DollarSign size={16} color="#22c55e" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#22c55e', marginTop: 4 }}>{latest.revenue.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: momRevenue >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>
            {momRevenue >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{momRevenue >= 0 ? '+' : ''}{momRevenue.toFixed(1)}% 环比
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>月利润(万元)</span>
            <Activity size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>{latest.profit.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: momProfit >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>
            {momProfit >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{momProfit >= 0 ? '+' : ''}{momProfit.toFixed(1)}% 环比
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>月检查量</span>
            <Users size={16} color="#3b82f6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#3b82f6', marginTop: 4 }}>{latest.exams.toLocaleString()}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: momExams >= 0 ? '#22c55e' : '#ef4444', marginTop: 4 }}>
            {momExams >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}{momExams >= 0 ? '+' : ''}{momExams.toFixed(1)}% 环比
          </div>
        </div>
        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#8b949e' }}>次均收入(元)</span>
            <TrendingUp size={16} color="#8b5cf6" />
          </div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#8b5cf6', marginTop: 4 }}>{(latest.revenue * 10000 / latest.exams).toFixed(0)}</div>
          <div style={{ fontSize: 12, color: '#6e7681', marginTop: 4 }}>人均创收能力</div>
        </div>
      </div>

      <div style={{ padding: '0 24px 24px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {(['trend', 'modality', 'payer', 'doctor'] as const).map(t => (
            <button key={t} onClick={() => setView(t)} style={{ padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 13, background: view === t ? '#1e40af' : '#21262d', color: view === t ? '#fff' : '#8b949e', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t === 'trend' ? <BarChart3 size={14} /> : t === 'modality' ? <Monitor size={14} /> : t === 'payer' ? <Building2 size={14} /> : <Users size={14} />}
              {t === 'trend' ? '收入趋势' : t === 'modality' ? '设备构成' : t === 'payer' ? '支付方' : '医生排行'}
            </button>
          ))}
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20 }}>
          {view === 'trend' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>月度收入/成本/利润趋势</div>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={MONTHLY_DATA}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis dataKey="month" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4 }} />
                  <Legend />
                  <Bar dataKey="revenue" name="收入(万元)" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="cost" name="成本(万元)" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="profit" name="利润(万元)" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {view === 'modality' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>各设备收入占比</div>
                <ResponsiveContainer width="100%" height={300}>
                  <RePie>
                    <Pie data={MODALITY_DATA} dataKey="revenue" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                      {MODALITY_DATA.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </RePie>
                </ResponsiveContainer>
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>各设备收入(万元)</div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={MODALITY_DATA} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                    <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="revenue" radius={[0, 4, 4, 0]}>
                      {MODALITY_DATA.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
          {view === 'payer' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>支付方收入分布</div>
                <ResponsiveContainer width="100%" height={300}>
                  <RePie>
                    <Pie data={PAYER_DATA} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(1)}%`}>
                      {PAYER_DATA.map(d => <Cell key={d.name} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                  </RePie>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {PAYER_DATA.map(d => (
                  <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid #21262d' }}>
                    <div style={{ width: 12, height: 12, borderRadius: 2, background: d.color }} />
                    <span style={{ flex: 1, fontSize: 13 }}>{d.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>¥{d.value}万</span>
                    <span style={{ fontSize: 12, color: '#8b949e' }}>{((d.value / PAYER_DATA.reduce((s, x) => s + x.value, 0)) * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {view === 'doctor' && (
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>医生收入排行(万元)</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={DOCTOR_DATA} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
                  <XAxis type="number" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#8b949e', fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="revenue" name="收入(万元)" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
