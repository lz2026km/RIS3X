// @deprecated [v3.0.6.11-104 Wave 5A] 已内嵌为 QCPage 的「科室质量」Tab; 旧路由 /quality/department redirect → /qc?tab=deptQuality。
//   文件保留仅作参考/回退，请勿在路由中直接挂载，新功能请改 QCPage。
import { useState, useEffect } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, PieChart, Pie, Cell,
} from 'recharts'
import ChartContainer from '../../components/charts/ChartContainer'
import {
  CheckCircle, XCircle, AlertTriangle, TrendingUp, BarChart3,
  PieChart as PieIcon, Download, Activity,
} from 'lucide-react'
import { reportQualityApi } from '../../services/api'
import { ErrorBanner } from '../../components/feedback'
import { DataTable } from '../../components/common'
import { t } from '../../i18n/appI18n'

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
  { range: 'A (90-100)', count: 28, color: 'var(--color-success-500)' },
  { range: 'B (80-89)', count: 35, color: 'var(--color-primary-500)' },
  { range: 'C (70-79)', count: 18, color: 'var(--color-warning-500)' },
  { range: 'D (60-69)', count: 8, color: 'var(--color-error-500)' },
  { range: 'F (<60)', count: 3, color: 'var(--color-error-600)' },
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
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    reportQualityApi.getStats().then(res => {
      if (res.success && res.data) { setApiStats(res.data); setLoadError(null); }
    }).catch(() => { setLoadError(t('w9.states.error')); })
  }, [])

  const avgScore = apiStats?.avgScore ?? SCORE_TREND[SCORE_TREND.length - 1]?.score ?? 0
  const totalChecks = CHECK_RESULTS.reduce((s, c) => s + c.total, 0)
  const totalPassed = CHECK_RESULTS.reduce((s, c) => s + c.passed, 0)
  const totalFailed = CHECK_RESULTS.reduce((s, c) => s + c.failed, 0)
  const overallPassRate = ((totalPassed / totalChecks) * 100).toFixed(1)

  const barData = CHECK_RESULTS.map(c => ({ category: c.category, passed: c.passed, failed: c.failed }))

  const handleExportQualityReport = () => {
    const lines = [
      '科室质量管理报告',
      `生成时间: ${new Date().toLocaleString('zh-CN')}`,
      `平均评分: ${avgScore} 分 | 通过率: ${overallPassRate}% | 未通过: ${totalFailed} 项 | 总检查: ${totalChecks} 项`,
      '',
      '【各检查项】',
      ...CHECK_RESULTS.map(c => `${c.category},通过:${c.passed},未通过:${c.failed},合计:${c.total}`),
      '',
      '【最近检查】',
      ...RECENT_CHECKS.map(c => `${c.id},${c.examId},${c.modality},${c.score}分,${c.passed ? '通过' : '未通过'},${c.checkedBy},${c.date}`),
      '',
      '本报告由 G005 RIS v3.0.6.11 系统自动生成',
    ]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `科室质量报告-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,var(--color-primary-800),#1e3a8a)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <CheckCircle size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>科室质量管理</span>
        </div>
        <button onClick={handleExportQualityReport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Download size={14} />导出质量报告
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        {loadError && <ErrorBanner message={loadError} />}
        <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
          {[
            { title: '当前评分', value: avgScore, unit: '分', icon: Activity, color: avgScore >= 80 ? 'var(--color-success-500)' : 'var(--color-warning-500)' },
            { title: '通过率', value: overallPassRate, unit: '%', icon: CheckCircle, color: 'var(--color-success-500)' },
            { title: '未通过', value: totalFailed, icon: XCircle, color: 'var(--color-error-500)' },
            { title: '总计检查', value: totalChecks, icon: BarChart3, color: 'var(--color-primary-500)' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 160 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--text-primary, #f0f6fc)' }}>
                {k.value}<span style={{ fontSize: 14, fontWeight: 400, color: '#6e7681', marginLeft: 4 }}>{k.unit}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={16} color="var(--color-primary-500)" />质量评分趋势
            </div>
            <ChartContainer height={240} state={SCORE_TREND.length > 0 ? 'ready' : 'empty'} emptyDescription="暂无数据">
              <LineChart data={SCORE_TREND}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <YAxis domain={[60, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="score" stroke="var(--color-primary-500)" strokeWidth={2} dot={{ fill: 'var(--color-primary-500)' }} name="评分" />
                <Line type="monotone" dataKey="passRate" stroke="var(--color-success-500)" strokeWidth={2} dot={{ fill: 'var(--color-success-500)' }} name="通过率(%)" />
              </LineChart>
            </ChartContainer>
          </div>

          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <BarChart3 size={16} color="var(--color-success-500)" />各检查项通过/未通过
            </div>
            <ChartContainer height={240} state={barData.length > 0 ? 'ready' : 'empty'} emptyDescription="暂无数据">
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                <XAxis dataKey="category" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="passed" fill="var(--color-success-500)" radius={[4, 4, 0, 0]} name="通过" stackId="a" />
                <Bar dataKey="failed" fill="var(--color-error-500)" radius={[4, 4, 0, 0]} name="未通过" stackId="a" />
              </BarChart>
            </ChartContainer>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <PieIcon size={16} color="#8b5cf6" />评分等级分布
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
              <ChartContainer height={180} style={{ width: 220, flexShrink: 0 }} state={SCORE_DIST.length > 0 ? 'ready' : 'empty'} emptyDescription="暂无数据">
                <PieChart>
                  <Pie data={SCORE_DIST} cx="50%" cy="50%" outerRadius={80} dataKey="count" nameKey="range" labelLine={false}>
                    {SCORE_DIST.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                </PieChart>
              </ChartContainer>
              <div style={{ flex: 1 }}>
                {SCORE_DIST.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 12 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 2, background: d.color, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-muted, #8b949e)', flex: 1 }}>{d.range}</span>
                    <span style={{ color: 'var(--text-primary, #f0f6fc)', fontWeight: 600 }}>{d.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12, color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} color="var(--color-error-500)" />提醒
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 12 }}>近期未通过检查 ({totalFailed}) 项需复查</div>
            {RECENT_CHECKS.filter(c => !c.passed).slice(0, 3).map(c => (
              <div key={c.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--bg-secondary, #21262d)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-primary, #f0f6fc)' }}>{c.examId}</div>
                  <div style={{ fontSize: 12, color: '#6e7681' }}>{c.modality} · {c.date}</div>
                </div>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 4, background: c.severity === 'critical' ? '#ef444420' : '#f59e0b20', color: c.severity === 'critical' ? 'var(--color-error-500)' : 'var(--color-warning-500)' }}>
                  {c.score}分
                </span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--bg-secondary, #21262d)', fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #f0f6fc)' }}>最近检查记录</div>
          <DataTable
            rowKey="id"
            dataSource={RECENT_CHECKS}
            columns={[
              { title: '编号', dataIndex: 'id', key: 'id', render: (v: string) => <span style={{ color: '#6e7681', fontSize: 12 }}>{v}</span> },
              { title: '检查ID', dataIndex: 'examId', key: 'examId' },
              { title: '设备', dataIndex: 'modality', key: 'modality', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
              { title: '评分', dataIndex: 'score', key: 'score', render: (v: number) => <span style={{ fontWeight: 600, color: v >= 80 ? 'var(--color-success-500)' : v >= 60 ? 'var(--color-warning-500)' : 'var(--color-error-500)' }}>{v}</span> },
              {
                title: '结果',
                dataIndex: 'passed',
                key: 'passed',
                render: (v: boolean) => (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: v ? 'var(--color-success-500)' : 'var(--color-error-500)', fontSize: 12 }}>
                    {v ? <CheckCircle size={12} /> : <XCircle size={12} />}{v ? '通过' : '未通过'}
                  </span>
                ),
              },
              { title: '检查人', dataIndex: 'checkedBy', key: 'checkedBy', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
              { title: '日期', dataIndex: 'date', key: 'date', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
