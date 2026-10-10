// [v3.0.6.11-82] W3-C: 接入 qcextApi.getQcDashboard/getQcStats (真实后端) + loading/error + 数据源标注
import { useEffect, useState } from 'react'

import { Shield, CheckCircle2, AlertTriangle, XCircle, BarChart3, ClipboardCheck } from 'lucide-react'
import { DataTable } from '../../components/common'
import { qcextApi } from '../../services/api/qcextApi'
import { t } from '../../i18n/appI18n'

type QcMetric = {
  labelKey: string
  current: number
  target: number
  status: 'pass' | 'warning' | 'fail'
}

type ModalityQc = {
  modality: string
  modalityKey?: string
  metrics: QcMetric[]
}

const MODALITY_QC: ModalityQc[] = [
  {
    modality: 'CCTA',
    metrics: [
      { labelKey: 'cvQc.metric.imageQuality', current: 4.2, target: 4.0, status: 'pass' },
      { labelKey: 'cvQc.metric.motion', current: 1.8, target: 2.0, status: 'pass' },
      { labelKey: 'cvQc.metric.cnr', current: 8.5, target: 6.0, status: 'pass' },
      { labelKey: 'cvQc.metric.diagConfidence', current: 92, target: 90, status: 'pass' },
      { labelKey: 'cvQc.metric.acrCompliance', current: 95, target: 95, status: 'pass' },
      { labelKey: 'cvQc.metric.cadRadsRecord', current: 88, target: 95, status: 'warning' },
      { labelKey: 'cvQc.metric.turnaroundMin', current: 45, target: 60, status: 'pass' },
    ],
  },
  {
    modality: 'CMR',
    metrics: [
      { labelKey: 'cvQc.metric.imageQuality', current: 4.0, target: 4.0, status: 'pass' },
      { labelKey: 'cvQc.metric.lgeRecord', current: 85, target: 95, status: 'warning' },
      { labelKey: 'cvQc.metric.t1t2Rate', current: 78, target: 90, status: 'warning' },
      { labelKey: 'cvQc.metric.strainAnalysis', current: 65, target: 80, status: 'fail' },
      { labelKey: 'cvQc.metric.lvefAccuracy', current: 90, target: 95, status: 'warning' },
      { labelKey: 'cvQc.metric.turnaroundMin', current: 90, target: 90, status: 'pass' },
    ],
  },
  {
    modality: 'Echocardiography',
    metrics: [
      { labelKey: 'cvQc.metric.imageQuality', current: 3.8, target: 4.0, status: 'warning' },
      { labelKey: 'cvQc.metric.lvefRecord', current: 96, target: 95, status: 'pass' },
      { labelKey: 'cvQc.metric.diastolicGrade', current: 82, target: 95, status: 'fail' },
      { labelKey: 'cvQc.metric.valveCompleteness', current: 90, target: 90, status: 'pass' },
      { labelKey: 'cvQc.metric.glsStrain', current: 55, target: 80, status: 'fail' },
      { labelKey: 'cvQc.metric.reportTimeliness', current: 4, target: 6, status: 'pass' },
    ],
  },
  {
    modality: '导管室 (Cath Lab)',
    modalityKey: 'cvQc.modality.cathLab',
    metrics: [
      { labelKey: 'cvQc.metric.contrastUnder100', current: 72, target: 80, status: 'warning' },
      { labelKey: 'cvQc.metric.radiationTracking', current: 98, target: 100, status: 'pass' },
      { labelKey: 'cvQc.metric.ffrIvusUsage', current: 65, target: 70, status: 'warning' },
      { labelKey: 'cvQc.metric.complicationRate', current: 2.1, target: 3.0, status: 'pass' },
      { labelKey: 'cvQc.metric.doorBalloon', current: 68, target: 90, status: 'pass' },
      { labelKey: 'cvQc.metric.hemodynamicsCompleteness', current: 85, target: 95, status: 'warning' },
    ],
  },
  {
    modality: 'Vascular',
    metrics: [
      { labelKey: 'cvQc.metric.carotidStenosis', current: 94, target: 95, status: 'pass' },
      { labelKey: 'cvQc.metric.abiRecord', current: 80, target: 90, status: 'warning' },
      { labelKey: 'cvQc.metric.aorticDiameter', current: 4.1, target: 4.0, status: 'pass' },
      { labelKey: 'cvQc.metric.endoleak', current: 88, target: 95, status: 'warning' },
      { labelKey: 'cvQc.metric.reportGenTime', current: 12, target: 24, status: 'pass' },
    ],
  },
]

const STATUS_CONFIG = {
  pass: { icon: CheckCircle2, color: 'var(--color-success)', bg: 'var(--color-success-bg)' },
  warning: { icon: AlertTriangle, color: 'var(--color-warning)', bg: 'var(--color-warning-bg)' },
  fail: { icon: XCircle, color: 'var(--color-error)', bg: 'var(--color-error-bg)' },
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
          setDashboard({ totalInspected: s.totalReports, passedRate: 100 - (s.defectDistribution?.reduce((a, d) => a + (d.count ?? 0), 0) ?? 0), avgScore: s.avgScore, period: t('cvQc.recent') })
          setSource('api')
          setError(null)
        } else {
          setError(dashRes.error?.message ?? statsRes.error?.message ?? t('cvQc.apiUnavailable'))
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : t('cvQc.apiUnavailable'))
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
          <td>${t(metric.labelKey)}</td>
          <td style="text-align:center">${metric.current}</td>
          <td style="text-align:center">${metric.target}</td>
          <td style="text-align:center"><span style="color:${metric.status === 'pass' ? 'var(--color-success-600)' : metric.status === 'warning' ? 'var(--color-warning-600)' : 'var(--color-error-600)'};font-weight:600">${metric.status === 'pass' ? '通过' : metric.status === 'warning' ? '警告' : '失败'}</span></td>
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
        <Shield size={24} /> {t('cvQc.title')}
        <span style={{ fontSize: 12, fontWeight: 400, background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: source === 'api' ? 'var(--color-success)' : 'var(--color-warning)', padding: '2px 8px', borderRadius: 10 }}>
          {source === 'api' ? t('cvQc.dataSourceApi') : t('cvQc.demoData')}
        </span>
      </h1>

      {error && <div style={{ marginBottom: 12, padding: '8px 12px', background: 'var(--color-error-bg)', color: 'var(--color-error)', borderRadius: 6, fontSize: 12 }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24, opacity: loading ? 0.6 : 1 }}>
        <div style={{ padding: 16, background: 'var(--color-success-bg)', borderRadius: 8, border: '1px solid var(--color-success-border)' }}>
          <div style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 600, textTransform: 'uppercase' }}>{t('cvQc.overallPassRate')}</div>
          <div style={{ fontSize: 30, fontWeight: 'bold', marginTop: 4 }}>{dashboard ? `${Math.round(dashboard.passedRate)}%` : `${Math.round(overallPass / overallTotal * 100)}%`}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{dashboard ? `检查 ${dashboard.totalInspected} 例 · 平均 ${dashboard.avgScore} 分` : `${overallPass}/${overallTotal} 项指标通过`}</div>
        </div>
        {MODALITY_QC.map((m, i) => (
          <div key={m.modality} onClick={() => setActiveModality(i)} style={{ padding: 16, background: activeModality === i ? 'var(--color-info-bg)' : 'var(--bg-card)', borderRadius: 8, border: activeModality === i ? '2px solid var(--color-primary-800)' : '1px solid var(--border-color)', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{m.modalityKey ? t(m.modalityKey) : m.modality}</div>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 4 }}>{Math.round(m.metrics.filter(x => x.status !== 'fail').length / m.metrics.length * 100)}%</div>
            <div style={{ fontSize: 12, color: '#64748b' }}>{m.metrics.filter(x => x.status === 'pass').length} {t('cvQc.statusPass')}, {m.metrics.filter(x => x.status === 'fail').length} {t('cvQc.statusFail')}</div>
          </div>
        ))}
      </div>

      <div style={{ border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', fontWeight: 600, fontSize: 14 }}>
          {MODALITY_QC[activeModality]?.modalityKey ? t(MODALITY_QC[activeModality].modalityKey!) : (MODALITY_QC[activeModality]?.modality ?? '')} — {t('cvQc.detailMetrics')}
          <span style={{ fontSize: 12, color: '#94a3b8', fontWeight: 400, marginLeft: 8 }}>{t('cvQc.demoDataLabel')}</span>
        </div>
        <DataTable
          dataSource={MODALITY_QC[activeModality]?.metrics ?? []}
          rowKey="labelKey"
          pagination={false}
          columns={[
            {
              title: t('cvQc.colMetric'), dataIndex: 'labelKey',
              render: (v: string) => (
                <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ClipboardCheck size={16} color="#64748b" /> {t(v)}
                </span>
              ),
            },
            { title: t('cvQc.colCurrent'), dataIndex: 'current', align: 'center', render: (v: number) => <span style={{ fontWeight: 600 }}>{v}</span> },
            { title: t('cvQc.colTarget'), dataIndex: 'target', align: 'center', render: (v: number) => <span style={{ color: '#64748b' }}>{v}</span> },
            {
              title: t('cvQc.colStatus'), dataIndex: 'status', align: 'center',
              render: (v: QcMetric['status']) => {
                const s = STATUS_CONFIG[v]
                const Icon = s.icon
                return (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: s.bg, color: s.color, padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
                    <Icon size={14} /> {v === 'pass' ? t('cvQc.statusPass') : v === 'warning' ? t('cvQc.statusWarning') : t('cvQc.statusFail')}
                  </span>
                )
              },
            },
          ]}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button onClick={handleGenerateReport} disabled={generating} style={{ padding: '8px 16px', background: generating ? '#94a3b8' : 'var(--color-primary-800)', color: '#fff', border: 'none', borderRadius: 6, cursor: generating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
          <BarChart3 size={16} /> {generating ? t('cvQc.generating') : t('cvQc.generateReport')}
        </button>
      </div>
    </div>
  )
}
