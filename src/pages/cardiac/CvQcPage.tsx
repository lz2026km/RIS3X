// [v3.0.6.11-82] W3-C: 接入 qcextApi.getQcDashboard/getQcStats (真实后端) + loading/error + 数据源标注
import { useEffect, useState } from 'react'

import { Shield, CheckCircle2, AlertTriangle, XCircle, BarChart3, ClipboardCheck } from 'lucide-react'
import { qcextApi } from '../../services/api/qcextApi'

type QcMetric = {
  label: string
  current: number
  target: number
  status: 'pass' | 'warning' | 'fail'
}

type ModalityQc = {
  modality: string
  metrics: QcMetric[]
}

const MODALITY_QC: ModalityQc[] = [
  {
    modality: 'CCTA',
    metrics: [
      { label: '图像质量评分', current: 4.2, target: 4.0, status: 'pass' },
      { label: '运动评分', current: 1.8, target: 2.0, status: 'pass' },
      { label: '对比噪声比', current: 8.5, target: 6.0, status: 'pass' },
      { label: '诊断置信度%', current: 92, target: 90, status: 'pass' },
      { label: 'ACR 合规率%', current: 95, target: 95, status: 'pass' },
      { label: 'CAD-RADS 记录率%', current: 88, target: 95, status: 'warning' },
      { label: '周转时间(分钟)', current: 45, target: 60, status: 'pass' },
    ],
  },
  {
    modality: 'CMR',
    metrics: [
      { label: '图像质量评分', current: 4.0, target: 4.0, status: 'pass' },
      { label: 'LGE 记录率%', current: 85, target: 95, status: 'warning' },
      { label: 'T1/T2 定量完成率', current: 78, target: 90, status: 'warning' },
      { label: '应变分析%', current: 65, target: 80, status: 'fail' },
      { label: 'LVEF 准确度', current: 90, target: 95, status: 'warning' },
      { label: '周转时间(分钟)', current: 90, target: 90, status: 'pass' },
    ],
  },
  {
    modality: 'Echocardiography',
    metrics: [
      { label: '图像质量评分', current: 3.8, target: 4.0, status: 'warning' },
      { label: 'LVEF 记录率%', current: 96, target: 95, status: 'pass' },
      { label: '舒张功能分级%', current: 82, target: 95, status: 'fail' },
      { label: '瓣膜病变完整率%', current: 90, target: 90, status: 'pass' },
      { label: 'GLS 应变性能%', current: 55, target: 80, status: 'fail' },
      { label: '报告时效(小时)', current: 4, target: 6, status: 'pass' },
    ],
  },
  {
    modality: 'Cath Lab',
    metrics: [
      { label: '对比剂用量<100mL 率%', current: 72, target: 80, status: 'warning' },
      { label: '辐射剂量跟踪率%', current: 98, target: 100, status: 'pass' },
      { label: 'FFR/IVUS 使用率%', current: 65, target: 70, status: 'warning' },
      { label: '并发症率%', current: 2.1, target: 3.0, status: 'pass' },
      { label: '门球时间(分钟)', current: 68, target: 90, status: 'pass' },
      { label: '血流动力学数据完整率%', current: 85, target: 95, status: 'warning' },
    ],
  },
  {
    modality: 'Vascular',
    metrics: [
      { label: '颈动脉狭窄分级%', current: 94, target: 95, status: 'pass' },
      { label: 'ABI 测量记录率%', current: 80, target: 90, status: 'warning' },
      { label: '主动脉直径测量准确度', current: 4.1, target: 4.0, status: 'pass' },
      { label: '内漏分类率%', current: 88, target: 95, status: 'warning' },
      { label: '报告生成时间(小时)', current: 12, target: 24, status: 'pass' },
    ],
  },
]

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: '#16a34a', bg: '#dcfce7' },
  warning: { icon: AlertTriangle, color: '#d97706', bg: '#fef3c7' },
  fail: { icon: XCircle, color: '#dc2626', bg: '#fee2e2' },
}

export default function CvQcPage() {
  const [activeModality, setActiveModality] = useState(0)
  const [generating, setGenerating] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dashboard, setDashboard] = useState<{ totalInspected: number; passedRate: number; avgScore: number; period: string } | null>(null)
  const [source, setSource] = useState<'api' | 'demo'>('demo')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      try {
        const [dashRes, statsRes] = await Promise.all([qcextApi.getQcDashboard(), qcextApi.getQcStats()])
        if (cancelled) return
        if (dashRes.success && dashRes.data) {
          setDashboard(dashRes.data)
          setSource('api')
          setError(null)
        } else if (statsRes.success && statsRes.data) {
          const s = statsRes.data
          setDashboard({ totalInspected: s.totalReports, passedRate: 100 - (s.defectDistribution?.reduce((a, d) => a + (d.count ?? 0), 0) ?? 0), avgScore: s.avgScore, period: '近期' })
          setSource('api')
          setError(null)
        } else {
          setError(dashRes.error?.message ?? statsRes.error?.message ?? '质控接口不可用')
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : '质控接口不可用')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const overallPass = MODALITY_QC.reduce((a, m) => a + m.metrics.filter(x => x.status === 'pass').length, 0)
  const overallTotal = MODALITY_QC.reduce((a, m) => a + m.metrics.length, 0)

  const handleGenerateReport = () => {
    setGenerating(true)
    setTimeout(() => {
      setGenerating(false)
      const rows = MODALITY_QC.map(m => m.metrics.map(metric => `
        <tr>
          <td>${m.modality}</td>
          <td>${metric.label}</td>
          <td style="text-align:center">${metric.current}</td>
          <td style="text-align:center">${metric.target}</td>
          <td style="text-align:center"><span style="color:${STATUS_CONFIG[metric.status].color};font-weight:600">${metric.status === 'pass' ? '通过' : metric.status === 'warning' ? '警告' : '失败'}</span></td>
        </tr>`).join('')).join('')
      const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8"><title>心血管质控报告</title>
        <style>body{font-family:SimSun,serif;padding:32px;color:#111}h1{font-size:20px}h2{font-size:15px;margin-top:20px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #555;padding:6px 10px;font-size:13px}th{background:#eee}.summary{display:flex;gap:16px;margin:12px 0}.box{flex:1;border:1px solid #ccc;border-radius:6px;padding:12px;text-align:center}.num{font-size:22px;font-weight:700}@media print{body{margin:0}}</style></head><body>
        <h1>心血管影像质量控制报告</h1>
        <div>报告日期: ${new Date().toLocaleDateString('zh-CN')} · 生成系统: G005 RIS 心脏质控模块</div>
        <div class="summary">
          <div class="box"><div class="num">${Math.round(overallPass / overallTotal * 100)}%</div><div>整体通过率</div></div>
          <div class="box"><div class="num">${overallPass}/${overallTotal}</div><div>通过指标</div></div>
          <div class="box"><div class="num">${MODALITY_QC.reduce((a, m) => a + m.metrics.filter(x => x.status === 'fail').length, 0)}</div><div>失败指标</div></div>
        </div>
        <h2>各模态指标明细</h2>
        <table><thead><tr><th>模态</th><th>指标</th><th>当前</th><th>目标</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="margin-top:24px;color:#666;font-size:12px">本报告由系统自动生成，仅供质控管理参考。</p>
        </body></html>`
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `CV质控报告_${new Date().toISOString().split('T')[0]}.html`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    }, 700)
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 0 16px' }}>
        <Shield size={24} /> CV 质量控制仪表盘
        <span style={{ fontSize: 12, fontWeight: 400, background: source === 'api' ? '#dcfce7' : '#fef3c7', color: source === 'api' ? '#16a34a' : '#d97706', padding: '2px 8px', borderRadius: 10 }}>
          {source === 'api' ? '数据源: /qc-ext/dashboard' : '演示数据(接口不可用)'}
        </span>
      </h1>

      {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: '#fef2f2', color: '#dc2626', borderRadius: 6, fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24, opacity: loading ? 0.6 : 1 }}>
        <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
          <div style={{ fontSize: 12, color: '#16a34a', fontWeight: 600, textTransform: 'uppercase' }}>整体质控通过率</div>
          <div style={{ fontSize: 28, fontWeight: 'bold', marginTop: 4 }}>{dashboard ? `${Math.round(dashboard.passedRate)}%` : `${Math.round(overallPass / overallTotal * 100)}%`}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{dashboard ? `检查 ${dashboard.totalInspected} 例 · 平均 ${dashboard.avgScore} 分` : `${overallPass}/${overallTotal} 项指标通过`}</div>
        </div>
        {MODALITY_QC.map((m, i) => (
          <div key={m.modality} onClick={() => setActiveModality(i)} style={{ padding: 16, background: activeModality === i ? '#eff6ff' : '#fff', borderRadius: 8, border: activeModality === i ? '2px solid #1e40af' : '1px solid #e2e8f0', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{m.modality}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{Math.round(m.metrics.filter(x => x.status !== 'fail').length / m.metrics.length * 100)}%</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{m.metrics.filter(x => x.status === 'pass').length} 通过, {m.metrics.filter(x => x.status === 'fail').length} 失败</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', fontWeight: 600, fontSize: 14 }}>
          {MODALITY_QC[activeModality]?.modality ?? ''} — 详细指标
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>演示数据</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #e2e8f0' }}>
              <th style={{ padding: '10px 16px', textAlign: 'left' }}>指标</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>当前</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>目标</th>
              <th style={{ padding: '10px 16px', textAlign: 'center' }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {(MODALITY_QC[activeModality]?.metrics ?? []).map(m => {
              const s = STATUS_CONFIG[m.status]
              const Icon = s.icon
              return (
                <tr key={m.label} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardCheck size={16} color="#64748b" /> {m.label}
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', fontWeight: 600 }}>{m.current}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center', color: '#64748b' }}>{m.target}</td>
                  <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                      <Icon size={14} /> {m.status === 'pass' ? '通过' : m.status === 'warning' ? '警告' : '失败'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={handleGenerateReport} disabled={generating} style={{ padding: '8px 16px', background: generating ? '#94a3b8' : '#1e40af', color: '#fff', border: 'none', borderRadius: 6, cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={16} /> {generating ? '生成中...' : '生成质控报告'}
        </button>
      </div>
    </div>
  )
}
