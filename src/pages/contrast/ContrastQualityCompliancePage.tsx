import { useState, useEffect, useCallback } from 'react'
import { BarChart3, CheckCircle, XCircle, AlertTriangle, TrendingUp, TrendingDown, Download, FileText, Shield } from 'lucide-react'
import { getQualityComplianceService } from '../../services/contrast'
import type { QualityMetric, RegulatoryCheck } from '../../services/contrast'
import { contrastSafetyApi } from '../../services/api/contrastSafetyApi'
import { AppEmpty, ErrorBanner } from '../../components/feedback'
import { t } from '../../i18n/appI18n'

const svc = getQualityComplianceService()

function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob(['\uFEFF' + content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const CATEGORY_LABELS: Record<string, string> = { usage: '使用情况', safety: '安全指标', adherence: '依从性', regulatory: '合规性' }
const CATEGORY_COLORS: Record<string, string> = { usage: 'var(--color-primary-500)', safety: 'var(--color-error-500)', adherence: 'var(--color-success-500)', regulatory: '#a855f7' }

export default function ContrastQualityCompliancePage() {
  const [metrics, setMetrics] = useState<QualityMetric[]>([])
  const [regulatoryChecks, setRegulatoryChecks] = useState<RegulatoryCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [source, setSource] = useState<'api' | 'fallback'>('fallback')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)

  const run = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const startDate = '2025-06-01'
    const endDate = '2025-06-30'
    try {
      // [G005 W7] 优先走真实 service 层 (MSW demo 数据), 失败回退本地 mock service
      const res = await contrastSafetyApi.getQualityCompliance(startDate, endDate)
      if (res.success && res.data?.metrics?.length) {
        setMetrics(res.data.metrics as QualityMetric[])
        setRegulatoryChecks((res.data.regulatoryChecks ?? []) as RegulatoryCheck[])
        setSource(res.data.source === 'demo' ? 'fallback' : 'api')
        return
      }
      throw new Error('NO_DATA')
    } catch {
      try {
        const [m, r] = await Promise.all([
          svc.getQualityMetrics(startDate, endDate),
          svc.getRegulatoryCompliance(),
        ])
        setMetrics(m)
        setRegulatoryChecks(r)
        setSource('fallback')
      } catch {
        setLoadError(t('w7demo.loadError'))
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  const filtered = activeCategory ? metrics.filter(m => m.category === activeCategory) : metrics
  const categories = [...new Set(metrics.map(m => m.category))]

  const handleExportReport = () => {
    const header = '分类,指标,当前值,目标值,单位,趋势,详情'
    const rows = metrics.map(m => [CATEGORY_LABELS[m.category] ?? m.category, m.name, m.currentValue, m.targetValue, m.unit, m.trend, m.details].join(','))
    downloadFile('对比剂质量与合规-导出报告.csv', [header, ...rows].join('\n'))
  }

  const handleGenerateCompliance = () => {
    const now = new Date().toLocaleString('zh-CN')
    const passed = regulatoryChecks.filter(c => c.status === 'pass').length
    const failed = regulatoryChecks.filter(c => c.status === 'fail').length
    const pending = regulatoryChecks.length - passed - failed
    const lines = [
      '对比剂质量与合规报告',
      `生成时间: ${now}`,
      '',
      '【合规检查汇总】',
      `总计: ${regulatoryChecks.length} 项 | 通过: ${passed} 项 | 未通过: ${failed} 项 | 待检查/不适用: ${pending} 项`,
      '',
      '【检查明细】',
      ...regulatoryChecks.map(c => `- [${c.status === 'pass' ? '通过' : c.status === 'fail' ? '未通过' : '待检查'}] ${c.name} (${c.regulation}) — ${c.details}`),
      '',
      '【质量指标】',
      ...metrics.map(m => `- ${m.name}: ${m.currentValue}${m.unit} (目标 ${m.targetValue}${m.unit})`),
      '',
      '本报告由 G005 RIS v3.0.6.11 系统自动生成',
    ]
    downloadFile('对比剂合规报告.txt', lines.join('\n'), 'text/plain;charset=utf-8')
  }

  if (loading) {
    return <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>{t('w7demo.loading')}</div>
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#7c3aed,#4c1d95)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
          <BarChart3 size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>对比剂质量与合规</span>
          {/* [G005 W7] 真实 service 层优先; 回退本地 mock 时展示演示数据徽标 */}
          {source === 'fallback' && (
            <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: 'rgba(255,255,255,0.12)', color: 'var(--color-warning-400)', border: '1px solid rgba(251,191,36,0.45)', fontWeight: 600 }}>{t('w7demo.contrastFallback')}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          <button onClick={handleExportReport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <Download size={14} />导出报告
          </button>
          <button onClick={handleGenerateCompliance} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <FileText size={14} />生成合规报告
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 20px)' }}>
        {loadError && (
          <ErrorBanner message={loadError} onRetry={() => void run()} retryLabel={t('w7demo.retry')} />
        )}
        <div style={{ display: 'flex', gap: 'var(--space-2, 8px)' }}>
          <button onClick={() => setActiveCategory(null)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: !activeCategory ? '#7c3aed' : 'transparent', color: !activeCategory ? '#fff' : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>全部</button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(activeCategory === cat ? null : cat)} style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid var(--border-default, #30363d)', background: activeCategory === cat ? CATEGORY_COLORS[cat] : 'transparent', color: activeCategory === cat ? '#fff' : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {filtered.length === 0 && <AppEmpty variant="no-data" minHeight={160} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 'var(--space-3, 12px)' }}>
          {filtered.map(m => (
            <div key={m.id} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3, 12px)' }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', marginBottom: 'var(--space-1, 4px)' }}>{CATEGORY_LABELS[m.category]}</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                </div>
                <span style={{ padding: '2px 6px', borderRadius: 3, fontSize: 12, color: m.trend === 'up' && m.category === 'usage' ? 'var(--color-error-500)' : m.trend === 'down' && m.category === 'safety' ? 'var(--color-success-500)' : m.trend === 'up' ? 'var(--color-success-500)' : m.trend === 'down' ? 'var(--color-error-500)' : 'var(--text-muted, #8b949e)', background: 'transparent' }}>
                  {m.trend === 'up' ? <TrendingUp size={14} /> : m.trend === 'down' ? <TrendingDown size={14} /> : null}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 30, fontWeight: 700 }}>{m.currentValue}</span>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{m.unit}</span>
                <span style={{ fontSize: 12, color: '#6e7681' }}>/ 目标 {m.targetValue}{m.unit}</span>
              </div>
              <div style={{ height: 4, background: 'var(--bg-primary, #0d1117)', borderRadius: 2, marginBottom: 'var(--space-2, 8px)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(100, (m.currentValue / m.targetValue) * 100)}%`, background: m.currentValue >= m.targetValue ? 'var(--color-success-500)' : 'var(--color-warning-500)', borderRadius: 2 }} />
              </div>
              <div style={{ fontSize: 12, color: '#6e7681' }}>{m.details}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)' }}>
            <Shield size={16} />合规检查项
          </div>
          {regulatoryChecks.length === 0 && <AppEmpty variant="no-data" minHeight={120} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
            {regulatoryChecks.map(check => (
              <div key={check.checkId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: '10px 12px', background: 'var(--bg-primary, #0d1117)', borderRadius: 6 }}>
                {check.status === 'pass' ? <CheckCircle size={16} style={{ color: 'var(--color-success-500)' }} /> : check.status === 'fail' ? <XCircle size={16} style={{ color: 'var(--color-error-500)' }} /> : <AlertTriangle size={16} style={{ color: 'var(--color-warning-500)' }} />}
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12 }}>{check.name}</div>
                  <div style={{ fontSize: 12, color: '#6e7681' }}>{check.regulation}</div>
                </div>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{check.details}</span>
                <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 3, background: check.status === 'pass' ? '#22c55e20' : check.status === 'fail' ? '#ef444420' : '#f59e0b20', color: check.status === 'pass' ? 'var(--color-success-500)' : check.status === 'fail' ? 'var(--color-error-500)' : 'var(--color-warning-500)' }}>
                  {check.status === 'pass' ? '通过' : check.status === 'fail' ? '未通过' : check.status === 'pending' ? '待检查' : '不适用'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
