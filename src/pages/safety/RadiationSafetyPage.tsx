import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'
import { ChartContainer } from '../../components/charts'
import { StateView } from '../../components/common/StateView'
import { DataTable } from '../../components/common'
import { Activity, CheckCircle, AlertTriangle, Shield, BarChart3, Download, Zap } from 'lucide-react'
import {
  getDoseRecords, checkAlaraCompliance, getProtocolOptimizationSuggestions,
  type DoseRecord, type AlaraComplianceStatus, type ProtocolOptimizationSuggestion,
} from '../../services/api/safetyApi'
import { t } from '../../i18n/appI18n'

const MODALITY_COLORS: Record<string, string> = { CT: 'var(--color-primary-500)', MR: '#8b5cf6', DR: 'var(--color-success-500)', DSA: 'var(--color-warning-500)', MG: 'var(--color-error-500)' }

export default function RadiationSafetyPage() {
  const [doseRecords, setDoseRecords] = useState<DoseRecord[]>([])
  const [compliance, setCompliance] = useState<AlaraComplianceStatus[]>([])
  const [optimizations, setOptimizations] = useState<ProtocolOptimizationSuggestion[]>([])
  const [activeTab, setActiveTab] = useState<'overview' | 'records' | 'alerts' | 'optimize'>('overview')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const [dose, alara, opts] = await Promise.all([
        getDoseRecords(),
        checkAlaraCompliance(),
        getProtocolOptimizationSuggestions(),
      ])
      setDoseRecords(dose)
      setCompliance(alara)
      setOptimizations(opts)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : t('w2d.loadFailed'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  const dlpData = doseRecords.filter(r => r.dlp).map(r => ({ name: r.patientName, dlp: r.dlp, ctDoseIndex: r.ctDoseIndex }))
  const complianceData = compliance.map(c => ({ name: c.modality, rate: c.complianceRate, avgDose: c.avgDose }))
  const doseByModality = doseRecords.reduce<Record<string, number>>((acc, r) => {
    acc[r.modality] = (acc[r.modality] ?? 0) + (r.dlp ?? r.kap ?? 0)
    return acc
  }, {})
  const modalityData = Object.entries(doseByModality).map(([k, v]) => ({ modality: k, dose: Math.round(v) }))

  const complianceRate = compliance.length > 0 ? Math.round(compliance.reduce((s, c) => s + c.complianceRate, 0) / compliance.length) : 0

  const handleExportReport = () => {
    const header = '患者,检查,模态,设备,日期,DLP(mGy·cm),CTDI(mGy)'
    const rows = doseRecords.map(r => [r.patientName, r.procedureName ?? '', r.modality, r.deviceName ?? '', r.examDate ?? '', r.dlp ?? '', r.ctDoseIndex ?? ''].join(','))
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `辐射安全报告-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ background: 'var(--bg-primary, #0d1117)', color: 'var(--text-primary, #f0f6fc)', fontSize: 14, fontFamily: '"Segoe UI",sans-serif' }}>
      <div style={{ background: 'linear-gradient(135deg,#059669,#065f46)', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)' }}>
          <Shield size={24} /><span style={{ fontSize: 20, fontWeight: 600 }}>辐射安全与防护</span>
        </div>
        <button onClick={handleExportReport} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
          <Download size={14} />导出报告
        </button>
      </div>

      <div style={{ padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-6, 24px)', flexWrap: 'wrap' }}>
          {[
            { title: 'ALARA合规率', value: `${complianceRate}%`, icon: CheckCircle, color: complianceRate >= 90 ? 'var(--color-success-500, var(--color-success-500))' : 'var(--color-warning-500, var(--color-warning-500))' },
            { title: '本月检查量', value: doseRecords.length, icon: Activity, color: 'var(--color-primary-500, var(--color-primary-500))' },
            { title: '设备数量', value: new Set(doseRecords.map(r => r.deviceId)).size, icon: BarChart3, color: 'var(--color-modality-mr, #8b5cf6)' },
            { title: '优化建议', value: optimizations.length, icon: Zap, color: 'var(--color-warning-500, var(--color-warning-500))' },
          ].map((k, i) => (
            <div key={i} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: '16px 20px', flex: 1, minWidth: 140 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-2, 8px)' }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{k.title}</span>
                <k.icon size={20} style={{ color: k.color }} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 700 }}>{k.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-4, 16px)' }}>
          {(['overview', 'records', 'alerts', 'optimize'] as const).map(t => (
            <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '6px 16px', borderRadius: 4, border: 'none', background: activeTab === t ? '#059669' : 'var(--bg-card, #161b22)', color: activeTab === t ? '#fff' : 'var(--text-muted, #8b949e)', cursor: 'pointer', fontSize: 12 }}>
              {{ overview: '总览', records: '剂量记录', alerts: '阈值告警', optimize: '优化建议' }[t]}
            </button>
          ))}
        </div>

        <StateView
          loading={loading}
          error={loadError}
          empty={!loading && !loadError && doseRecords.length === 0 && optimizations.length === 0 && compliance.length === 0}
          emptyDescription={t('w2d.empty')}
          onRetry={() => void load()}
          skeletonRows={6}
        >
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)' }}>
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <BarChart3 size={16} color="var(--color-primary-500)" />各设备剂量对比 (DLP)
              </div>
              <ChartContainer height={240} state={dlpData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无剂量对比数据">
                <BarChart data={dlpData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="dlp" fill="var(--color-primary-500)" radius={[4, 4, 0, 0]} name="DLP" />
                  <Bar dataKey="ctDoseIndex" fill="var(--color-success-500)" radius={[4, 4, 0, 0]} name="CTDI" />
                </BarChart>
              </ChartContainer>
            </div>
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Shield size={16} color="var(--color-success-500)" />ALARA合规率
              </div>
              <ChartContainer height={240} state={complianceData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无合规率数据">
                <BarChart data={complianceData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                  <Bar dataKey="rate" fill="var(--color-success-500)" radius={[4, 4, 0, 0]} name="合规率(%)" />
                </BarChart>
              </ChartContainer>
            </div>
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Activity size={16} color="var(--color-warning-500)" />各设备类型总剂量
              </div>
              <ChartContainer height={240} state={modalityData.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备剂量数据">
                <BarChart data={modalityData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default, #30363d)" />
                  <XAxis dataKey="modality" tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                  <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted, #8b949e)' }} />
                  <Tooltip contentStyle={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 4, fontSize: 12 }} />
                  <Bar dataKey="dose" fill="var(--color-warning-500)" radius={[4, 4, 0, 0]} name="总剂量" />
                </BarChart>
              </ChartContainer>
            </div>
            <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 'var(--space-3, 12px)', color: 'var(--text-primary, #f0f6fc)' }}>合规详情</div>
              {compliance.map(c => (
                <div key={c.modality} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--bg-secondary, #21262d)', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-primary, #f0f6fc)' }}>{c.modality}</div>
                    <div style={{ fontSize: 12, color: '#6e7681' }}>{c.totalExams}次检查 · {c.avgDose}平均剂量</div>
                  </div>
                  <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: c.status === 'compliant' ? '#22c55e20' : c.status === 'warning' ? '#f59e0b20' : '#ef444420', color: c.status === 'compliant' ? 'var(--color-success-500)' : c.status === 'warning' ? 'var(--color-warning-500)' : 'var(--color-error-500)' }}>
                    {c.complianceRate}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'records' && (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, overflow: 'hidden' }}>
            <DataTable
              rowKey="id"
              dataSource={doseRecords}
              columns={[
                { title: '检查ID', dataIndex: 'examId', key: 'examId', render: (v: string) => <span style={{ color: '#6e7681', fontSize: 12 }}>{v}</span> },
                { title: '患者', dataIndex: 'patientName', key: 'patientName' },
                { title: '设备', dataIndex: 'deviceName', key: 'deviceName', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)' }}>{v}</span> },
                { title: 'CTDI', dataIndex: 'ctDoseIndex', key: 'ctDoseIndex', render: (v: number) => v ?? '-' },
                { title: 'DLP', dataIndex: 'dlp', key: 'dlp', render: (v: number) => v ?? '-' },
                { title: 'KAP', dataIndex: 'kap', key: 'kap', render: (v: number) => v ?? '-' },
                { title: '日期', dataIndex: 'examDate', key: 'examDate', render: (v: string) => <span style={{ color: 'var(--text-muted, #8b949e)', fontSize: 12 }}>{v}</span> },
              ]}
            />
          </div>
        )}

        {activeTab === 'optimize' && (
          <div>
            {optimizations.map((opt, i) => (
              <div key={i} style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-4, 16px)', marginBottom: 'var(--space-3, 12px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2, 8px)' }}>
                  <div>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, background: `${MODALITY_COLORS[opt.modality]}20`, color: MODALITY_COLORS[opt.modality], marginRight: 'var(--space-2, 8px)' }}>{opt.modality}</span>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{opt.procedureName}</span>
                  </div>
                  <span style={{ color: 'var(--color-success-500)', fontSize: 12 }}>预计降低 {opt.estimatedReduction}%</span>
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginBottom: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>
                  <span>当前平均: <b style={{ color: 'var(--text-primary, #f0f6fc)' }}>{opt.currentAvgDose}</b></span>
                  <span>目标值: <b style={{ color: 'var(--color-success-500)' }}>{opt.recommendedTarget}</b></span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>
                  措施: {opt.actionItems.map((a, j) => (
                    <span key={j} style={{ display: 'inline-block', padding: '2px 8px', background: 'var(--bg-primary, #0d1117)', borderRadius: 4, margin: '2px 4px 2px 0', color: 'var(--text-primary, #f0f6fc)' }}>{a}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'alerts' && (
          <div style={{ background: 'var(--bg-card, #161b22)', border: '1px solid var(--border-default, #30363d)', borderRadius: 8, padding: 'var(--space-5, 20px)', textAlign: 'center', color: 'var(--text-muted, #8b949e)' }}>
            <AlertTriangle size={32} style={{ marginBottom: 'var(--space-2, 8px)' }} />
            <div>阈值告警配置功能 - 可配置各设备类型的剂量阈值和通知规则</div>
          </div>
        )}
        </StateView>
      </div>
    </div>
  )
}
