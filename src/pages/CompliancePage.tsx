import { Card } from 'antd'
import { useState, useEffect } from 'react'
import { Shield, FileText, CheckCircle, XCircle, AlertTriangle, Download } from 'lucide-react'
import { complianceApi } from '../services/api/complianceApi'
import type { ComplianceReportDto, ComplianceDocDto } from '../services/api/complianceApi'

const COLORS = {
  primary: '#1e40af',
  accent: '#3b82f6',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  border: 'var(--border-color)',
  textDark: '#1e293b',
  textMid: '#475569',
  textLight: '#94a3b8',
  white: '#fff',
}

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<'report' | 'docs'>('report')
  const [report, setReport] = useState<ComplianceReportDto | null>(null)
  const [docs, setDocs] = useState<ComplianceDocDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const [repRes, docRes] = await Promise.all([
        complianceApi.getReport(),
        complianceApi.listDocs(),
      ])
      if (cancelled) return
      if (repRes.success && repRes.data) setReport(repRes.data)
      if (docRes.success && docRes.data) setDocs(docRes.data)
      if (!repRes.success && !docRes.success) setLoadError('API 不可用')
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const reportStats = report?.summary
  const passedRate = reportStats ? ((reportStats.passed / reportStats.totalAudits) * 100).toFixed(1) : '--'

  const handleExport = () => {
    if (!report) return
    const csv = '模块,检查项,状态,严重级别,描述,检查时间\n' +
      report.details.map(d => `${d.module},${d.checkItem},${d.status},${d.severity},${d.description},${d.checkedAt}`).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `合规报告_${report.generatedAt.slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: COLORS.textLight }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 14 }}>加载中...</div>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ padding: 40, textAlign: 'center', color: COLORS.textLight }}>
          <AlertTriangle size={32} style={{ marginBottom: 8 }} />
          <div>无法加载合规数据，请稍后重试</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #1e40af, #3b82f6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.textDark }}>合规管理</h2>
            <span style={{ color: COLORS.textLight, fontSize: 13 }}>合规检查与文档管理</span>
          </div>
        </div>
        {activeTab === 'report' && report && (
          <button onClick={handleExport} style={{ padding: '8px 16px', borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.white, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: COLORS.textMid }}>
            <Download size={14} /> 导出报告
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: `1px solid ${COLORS.border}` }}>
        {[
          { key: 'report' as const, label: '合规报告', icon: <Shield size={14} /> },
          { key: 'docs' as const, label: '合规文档', icon: <FileText size={14} /> },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px',
            border: 'none', borderBottom: `2px solid ${activeTab === tab.key ? COLORS.primary : 'transparent'}`,
            background: 'none', cursor: 'pointer', fontSize: 13,
            fontWeight: activeTab === tab.key ? 700 : 500, color: activeTab === tab.key ? COLORS.primary : COLORS.textLight,
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'report' && report && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 20 }}>
            {[
              { label: '审计总数', value: reportStats?.totalAudits ?? '--', color: COLORS.primary, bg: '#3b82f622' },
              { label: '通过', value: reportStats?.passed ?? '--', color: COLORS.success, bg: '#22c55e22' },
              { label: '未通过', value: reportStats?.failed ?? '--', color: COLORS.danger, bg: '#ef444422' },
              { label: '合规率', value: `${passedRate}%`, color: COLORS.warning, bg: '#f59e0b22' },
            ].map(stat => (
              <Card bordered={false} key={stat.label} style={{ background: COLORS.white, borderRadius: 12, padding: '16px 20px', border: `1px solid ${COLORS.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
                <div style={{ fontSize: 26, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{stat.label}</div>
              </Card>
            ))}
          </div>

          <Card bordered={false} style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${COLORS.border}`, fontSize: 13, fontWeight: 700, color: COLORS.primary }}>
              审计明细 ({report.details.length})
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-card)' }}>
                    {['模块', '检查项', '状态', '严重级别', '描述', '检查时间'].map(h => (
                      <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, color: COLORS.textDark, borderBottom: `2px solid ${COLORS.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.details.map((d, i) => (
                    <tr key={d.id} style={{ borderBottom: `1px solid ${COLORS.border}`, background: i % 2 === 0 ? COLORS.white : '#fafbfc' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 600 }}>{d.module}</td>
                      <td style={{ padding: '10px 14px' }}>{d.checkItem}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: d.status === 'PASS' ? '#ecfdf5' : d.status === 'FAIL' ? '#fef2f2' : '#fffbeb', color: d.status === 'PASS' ? COLORS.success : d.status === 'FAIL' ? COLORS.danger : COLORS.warning }}>
                          {d.status === 'PASS' ? <CheckCircle size={10} /> : d.status === 'FAIL' ? <XCircle size={10} /> : <AlertTriangle size={10} />}
                          {d.status === 'PASS' ? '通过' : d.status === 'FAIL' ? '未通过' : '警告'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, background: d.severity === 'CRITICAL' ? '#fef2f2' : d.severity === 'MAJOR' ? '#fffbeb' : '#f1f5f9', color: d.severity === 'CRITICAL' ? COLORS.danger : d.severity === 'MAJOR' ? COLORS.warning : COLORS.textMid }}>
                          {d.severity === 'CRITICAL' ? '严重' : d.severity === 'MAJOR' ? '主要' : '轻微'}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', color: COLORS.textMid }}>{d.description}</td>
                      <td style={{ padding: '10px 14px', color: COLORS.textLight }}>{new Date(d.checkedAt).toLocaleDateString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeTab === 'docs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 16 }}>
          {docs.map(doc => (
            <Card bordered={false} key={doc.id} style={{ background: COLORS.white, borderRadius: 12, border: `1px solid ${COLORS.border}`, padding: 20, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }} styles={{ body: { padding: 0 } }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: doc.status === 'CURRENT' ? '#ecfdf5' : doc.status === 'DRAFT' ? '#fffbeb' : '#f1f5f9', color: doc.status === 'CURRENT' ? COLORS.success : doc.status === 'DRAFT' ? COLORS.warning : COLORS.textLight }}>
                  {doc.status === 'CURRENT' ? '当前版本' : doc.status === 'DRAFT' ? '草稿' : '已归档'}
                </span>
                <span style={{ fontSize: 12, color: COLORS.textLight }}>v{doc.version}</span>
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.textDark, marginBottom: 6 }}>{doc.title}</div>
              <div style={{ fontSize: 12, color: COLORS.textMid, marginBottom: 12 }}>{doc.category}</div>
              <div style={{ fontSize: 12, color: COLORS.textLight }}>更新于 {new Date(doc.updatedAt).toLocaleDateString('zh-CN')}</div>
            </Card>
          ))}
          {docs.length === 0 && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: 40, color: COLORS.textLight }}>暂无合规文档</div>
          )}
        </div>
      )}
    </div>
  )
}
