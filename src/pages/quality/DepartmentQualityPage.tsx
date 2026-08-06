import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, PieChart, Pie, Cell,
} from 'recharts'
import {
  CheckCircle, XCircle, AlertTriangle, TrendingUp, BarChart3,
  PieChart as PieIcon, Download, Activity,
} from 'lucide-react'
import { reportQualityApi } from '../../services/api'

const SCORE_TREND = [
  { month: '1月', score: 82, passRate: 88 },
  { month: '2月', score: 78, passRate: 84 },
  { month: '3月', score: 85, passRate: 90 },
  { month: '4月', score: 83, passRate: 87 },
  { month: '5月', score: 88, passRate: 92 },
  { month: '6月', score: 86, passRate: 91 },
]

const CHECK_RESULTS = [
  { category: 'ACR 合规性', passed: 42, failed: 3, total: 45 },
  { category: '图像质量', passed: 38, failed: 7, total: 45 },
  { category: '报告完整性', passed: 40, failed: 5, total: 45 },
  { category: '辐射剂量', passed: 44, failed: 1, total: 45 },
  { category: '患者标识', passed: 43, failed: 2, total: 45 },
  { category: '设备校准', passed: 39, failed: 6, total: 45 },
]

const SCORE_DIST = [
  { range: 'A (90-100)', count: 28, color: '#22c55e' },
  { range: 'B (80-89)', count: 35, color: '#3b82f6' },
  { range: 'C (70-79)', count: 18, color: '#f59e0b' },
  { range: 'D (60-69)', count: 8, color: '#ef4444' },
  { range: 'F (<60)', count: 3, color: '#dc2626' },
]

const RECENT_CHECKS = [
  { id: 'QC001', examId: 'CT20250601-01', modality: 'CT', score: 92, passed: true, checkedBy: '张伟', date: '2025-06-01', severity: 'info' },
  { id: 'QC002', examId: 'MR20250601-05', modality: 'MRI', score: 67, passed: false, checkedBy: '李静', date: '2025-06-01', severity: 'warning' },
  { id: 'QC003', examId: 'XR20250601-12', modality: 'X-Ray', score: 45, passed: false, checkedBy: '王强', date: '2025-06-01', severity: 'critical' },
  { id: 'QC004', examId: 'CT20260531-23', modality: 'CT', score: 88, passed: true, checkedBy: '刘洋', date: '2025-05-31', severity: 'info' },
  { id: 'QC005', examId: 'MR20260531-08', modality: 'MRI', score: 95, passed: true, checkedBy: '陈晓燕', date: '2025-05-31', severity: 'info' },
  { id: 'QC006', examId: 'US20260530-15', modality: 'Ultrasound', score: 72, passed: false, checkedBy: '张志明', date: '2025-05-30', severity: 'warning' },
]

export default function DepartmentQualityPage() {
  const [apiStats, setApiStats] = useState<{ total: number; avgScore: number } | null>(null)

  useEffect(() => {
    reportQualityApi.getStats().then(res => {
      if (res.success && res.data) setApiStats(res.data)
    })
  }, [])

  const avgScore = apiStats?.avgScore ?? SCORE_TREND[SCORE_TREND.length - 1].score
  const totalChecks = CHECK_RESULTS.reduce((s, c) => s + c.total, 0)
  const totalPassed = CHECK_RESULTS.reduce((s, c) => s + c.passed, 0)
  const totalFailed = CHECK_RESULTS.reduce((s, c) => s + c.failed, 0)
  const overallPassRate = ((totalPassed / totalChecks) * 100).toFixed(1)

  const barData = CHECK_RESULTS.map(c => ({ category: c.category, passed: c.passed, failed: c.failed }))

  return (
    <div style={{ minHeight: '100vh', background: '#0d1117', color: '#f0f6fc', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#1e40af,#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>科室质量管理</span>
        </div>
        <button style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
          <Download size={14} />导出质量报告
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: '当前评分', value: avgScore, unit: '分', icon: Activity, color: avgScore >= 80 ? '#22c55e' : '#f59e0b' },
            { title: '通过率', value: overallPassRate, unit: '%', icon: CheckCircle, color: '#22c55e' },
            { title: '未通过', value: totalFailed, icon: XCircle, color: '#ef4444' },
            { title: '总计检查', value: totalChecks, icon: BarChart3, color: '#3b82f6' },
          ].map((k, i) => (
            <div key={i} style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: '#8b949e' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f0f6fc' }}>
                {k.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#6e7681', marginLeft: 4 }}>{k.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="#3b82f6" />质量评分趋势
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={SCORE_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={2} dot={{ fill: '#3b82f6' }} name="评分" />
                <Line type="monotone" dataKey="passRate" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} name="通过率(%)" />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="#22c55e" />各检查项通过/未通过
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#30363d" />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: '#8b949e' }} />
                <YAxis tick={{ fontSize: 12, fill: '#8b949e' }} />
                <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="passed" fill="#22c55e" radius={[4, 4, 0, 0]} name="通过" stackId="a" />
                <Bar dataKey="failed" fill="#ef4444" radius={[4, 4, 0, 0]} name="未通过" stackId="a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieIcon size={16} color="#8b5cf6" />评分等级分布
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ResponsiveContainer width={180} height={180}>
                <PieChart>
                  <Pie data={SCORE_DIST} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="range" label={({ range }) => range}>
                    {SCORE_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 4, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {SCORE_DIST.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                    <span style={{ color: '#8b949e', flex: 1 }}>{d.range}</span>
                    <span style={{ color: '#f0f6fc', fontWeight: 600 }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: '#f0f6fc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="#ef4444" />提醒
            </div>
            <div style={{ fontSize: 13, color: '#8b949e', marginBottom: 12 }}>近期未通过检查 ({totalFailed}) 项需复查</div>
            {RECENT_CHECKS.filter(c => !c.passed).slice(0, 3).map(c => (
              <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid #21262d', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 13, color: '#f0f6fc' }}>{c.examId}</div>
                  <div style={{ fontSize: 12, color: '#6e7681' }}>{c.modality} · {c.date}</div>
                </div>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: c.severity === 'critical' ? '#ef444420' : '#f59e0b20', color: c.severity === 'critical' ? '#ef4444' : '#f59e0b' }}>
                  {c.score}分
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #21262d', fontSize: 14, fontWeight: 600, color: '#f0f6fc' }}>最近检查记录</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>编号</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>检查ID</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>设备</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>评分</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>结果</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>检查人</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', color: '#8b949e', borderBottom: '1px solid #30363d' }}>日期</th>
              </tr>
            </thead>
            <tbody>
              {RECENT_CHECKS.map(c => (
                <tr key={c.id}>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#6e7681', fontSize: 12 }}>{c.id}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>{c.examId}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{c.modality}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', fontWeight: 600, color: c.score >= 80 ? '#22c55e' : c.score >= 60 ? '#f59e0b' : '#ef4444' }}>{c.score}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: c.passed ? '#22c55e' : '#ef4444', fontSize: 12 }}>
                      {c.passed ? <CheckCircle size={12} /> : <XCircle size={12} />}{c.passed ? '通过' : '未通过'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{c.checkedBy}</td>
                  <td style={{ padding: '10px 12px', borderBottom: '1px solid #21262d', color: '#8b949e' }}>{c.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
