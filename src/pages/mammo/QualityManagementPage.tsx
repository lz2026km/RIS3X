// 6.7 Quality Management (20 pts)
// 数据源: mammoQcApi (/mammo-qc/overview + /mammo-qc/records, [Wave1B] 后端已实现, MSW 仅 mock 兜底)
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Shield, CheckCircle, XCircle, Download, RefreshCw, Target, BarChart3, Activity, Users, FileText } from 'lucide-react'
import { mammoQcApi, type MammoQcOverview, type MammoQcRecord } from '../../services/api/mammoQcApi'
import { Card } from 'antd'

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: 800, color: 'var(--color-primary-800)', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  statSub: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 },
  section: { background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' },
  bad: { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-block' },
  scrollBox: { maxHeight: 300, overflowY: 'auto' },
  progressBar: { width: '100%', height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    '合格': { bg: '#22c55e22', text: '#16a34a' },
    '不合格': { bg: '#ef444422', text: '#dc2626' },
    '待复评': { bg: '#f59e0b22', text: '#ca8a04' },
  }
  const c = colors[status] || { bg: 'var(--bg-deep)', text: '#64748b' }
  return <span style={{ ...s.bad, background: c.bg, color: c.text }}>{status}</span>
}

const QualityManagementPage = () => {
  const [search, setSearch] = useState('')
  const [overview, setOverview] = useState<MammoQcOverview | null>(null)
  const [records, setRecords] = useState<MammoQcRecord[]>([])
  const [source, setSource] = useState<'database' | 'demo'>('demo')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [ovRes, recRes] = await Promise.all([mammoQcApi.getOverview(), mammoQcApi.listRecords()])
      if (!ovRes.success) throw new Error((ovRes.error as { message?: string })?.message || '质量概览加载失败')
      if (!recRes.success) throw new Error((recRes.error as { message?: string })?.message || '审核记录加载失败')
      setOverview(ovRes.data?.data ?? null)
      setRecords(recRes.data?.data ?? [])
      setSource(ovRes.data?.source ?? 'demo')
    } catch (e) {
      setError((e as Error)?.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleExportReport = () => {
    const header = '患者,模态,技师,日期,评分,结果,问题'
    const rows = records.map(r => [r.patient, r.modality, r.technologist, r.date, r.score, r.status, r.issue].join(','))
    const blob = new Blob(['\uFEFF' + [header, ...rows].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `乳腺影像质量报告-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const statsData = useMemo(() => [
    { label: '整体质量评分', value: overview?.overallScore?.toFixed(1) ?? '-', unit: '分', icon: Shield, color: '#2563eb', bg: '#3b82f622' },
    { label: '符合ACR标准', value: overview?.acrComplianceRate?.toFixed(1) ?? '-', unit: '%', icon: CheckCircle, color: '#16a34a', bg: '#22c55e22' },
    { label: '召回率', value: overview?.recallRate?.toFixed(1) ?? '-', unit: '%', sub: '目标<10%', icon: Target, color: '#ca8a04', bg: '#f59e0b22' },
    { label: '平均剂量', value: overview?.avgDoseMgy?.toFixed(1) ?? '-', unit: 'mGy', icon: Activity, color: '#ea580c', bg: '#f9731622' },
    { label: '图像不合格率', value: overview?.imageFailRate?.toFixed(1) ?? '-', unit: '%', icon: XCircle, color: '#dc2626', bg: '#ef444422' },
    { label: '技师一致性', value: overview?.technologistConsistency?.toFixed(1) ?? '-', unit: '%', icon: Users, color: '#7c3aed', bg: '#8b5cf622' },
  ], [overview])

  const acrChecks = overview?.acrChecks ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => r.patient.toLowerCase().includes(q) || r.technologist.toLowerCase().includes(q))
  }, [records, search])

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>乳腺影像质量管理</h1>
          <p style={s.subtitle}>乳腺摄影质量管理 · ACR/FDA合规 · 图像质量控制 · 技师考核</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: source === 'demo' ? '#fffbeb' : '#ecfdf5', border: `1px solid ${source === 'demo' ? '#f59e0b' : '#10b981'}`, color: source === 'demo' ? '#b45309' : '#047857' }}>
            {source === 'demo' ? '演示数据（MSW，后端待实现）' : '真实数据（数据库聚合）'}
          </span>
          <button style={s.btn} onClick={fetchAll}><RefreshCw size={14} /> 同步</button>
          <button style={s.btnPrimary} onClick={handleExportReport}><Download size={14} /> 导出报告</button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--color-error-bg)', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>加载失败：{error}</span>
          <button onClick={fetchAll} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #fca5a5', background: 'var(--bg-card)', color: '#b91c1c', cursor: 'pointer', fontSize: 12 }}>重试</button>
        </div>
      )}

      <div style={s.statsRow}>
        {statsData.map((stat, i) => (
          <Card key={i} bordered={false} style={s.statCard} styles={{ body: { padding: 0 } }}>
            <div style={{ ...s.statIcon, background: stat.bg }}><stat.icon size={20} color={stat.color} /></div>
            <div style={s.statValue}>{stat.value}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-secondary)' }}>{stat.unit}</span></div>
            <div style={s.statLabel}>{stat.label}</div>
            {stat.sub && <div style={s.statSub}>{stat.sub}</div>}
          </Card>
        ))}
      </div>

      <Card bordered={false} style={{ ...s.section }} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><BarChart3 size={16} color='#2563eb' />ACR合规检查</div>
        <div style={s.grid3}>
          {acrChecks.map((item, i) => (
            <div key={i} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 13 }}>{item.name}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: item.score >= 90 ? '#16a34a' : item.score >= 80 ? '#ca8a04' : '#dc2626' }}>{item.score}</span>
              </div>
              <div style={s.progressBar}><div style={{ width: `${item.score}%`, height: '100%', background: item.score >= 90 ? '#16a34a' : item.score >= 80 ? '#ca8a04' : '#dc2626', borderRadius: 4 }} /></div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                {item.items.map((it, j) => <li key={j} style={{ marginBottom: 2 }}>{it}</li>)}
              </ul>
            </div>
          ))}
          {!loading && acrChecks.length === 0 && <div style={{ fontSize: 13, color: 'var(--text-secondary)', padding: 12 }}>暂无 ACR 合规检查数据</div>}
        </div>
      </Card>

      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><FileText size={16} color='#7c3aed' />质量审核记录</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 13, outline: 'none' }} placeholder='搜索患者或技师...' value={search} onChange={e => setSearch(e.target.value)} />
          <button style={s.btn} onClick={fetchAll}><RefreshCw size={14} /> 刷新</button>
        </div>
        <div style={s.scrollBox}>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>日期</th><th style={s.th}>患者</th><th style={s.th}>设备</th>
              <th style={s.th}>评分</th><th style={s.th}>状态</th><th style={s.th}>技师</th><th style={s.th}>问题</th>
            </tr></thead>
            <tbody>
              {loading && <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>数据加载中...</td></tr>}
              {!loading && filtered.slice(0, 12).map(r => (
                <tr key={r.id}>
                  <td style={s.td}>{r.date}</td>
                  <td style={s.td}>{r.patient}</td>
                  <td style={s.td}>{r.modality}</td>
                  <td style={s.td}><span style={{ fontWeight: 700, color: r.score >= 80 ? '#16a34a' : r.score >= 60 ? '#ca8a04' : '#dc2626' }}>{r.score}</span></td>
                  <td style={s.td}><StatusBadge status={r.status} /></td>
                  <td style={s.td}>{r.technologist}</td>
                  <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{r.issue || '-'}</td>
                </tr>
              ))}
              {!loading && filtered.length === 0 && <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无匹配记录</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}

export default QualityManagementPage
