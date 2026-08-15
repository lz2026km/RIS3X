// 6.7 Quality Management (20 pts)
// 数据源: mammoQcApi (/mammo-qc/overview + /mammo-qc/records, [Wave1B] 后端已实现, MSW 仅 mock 兜底)
// [G005 Wave1A W9] 新增: /mammo-qc/tests|standards|stats 区块
// [G-21 Wave3C] 新增: 乳腺质控评估区块 (breast-evaluate) + 乳腺质控规则列表 (breast-rules)
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Shield, CheckCircle, XCircle, Download, RefreshCw, Target, BarChart3, Activity, Users, FileText, ClipboardList, BookOpen, PieChart, AlertTriangle, Scale } from 'lucide-react'
import { mammoQcApi, type MammoQcOverview, type MammoQcRecord, type MammoQcTest, type MammoQcStandard, type MammoQcStats, type BreastQcRule, type BreastQcImageInput, type BreastQcEvaluateResult } from '../../services/api/mammoQcApi'
import { Card, Tabs, message } from 'antd'

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0 },
  subtitle: { fontSize: 13, color: 'var(--text-secondary)', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: 700, color: 'var(--color-primary-800)', lineHeight: 1.1 },
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
  // [G005 Wave1A W9] 测试计划 / 标准 / 统计
  const [tests, setTests] = useState<MammoQcTest[]>([])
  const [standards, setStandards] = useState<MammoQcStandard[]>([])
  const [qcStats, setQcStats] = useState<MammoQcStats | null>(null)
  const [extLoading, setExtLoading] = useState(true)
  // [G-21 Wave3C] 乳腺质控规则 + 影像质量评估
  const [breastRules, setBreastRules] = useState<BreastQcRule[]>([])
  const [ruleLoading, setRuleLoading] = useState(true)
  const [evaluateImages, setEvaluateImages] = useState<BreastQcImageInput[]>([
    { view: 'LCC', coverage: 92, nippleTangential: true, compression: 52, agd: 2.2 },
    { view: 'RCC', coverage: 91, nippleTangential: true, compression: 54, agd: 2.3 },
    { view: 'LMLO', coverage: 96, nippleTangential: true, compression: 62, agd: 2.4 },
    { view: 'RMLO', coverage: 95, nippleTangential: true, compression: 64, agd: 2.5 },
  ])
  const [evaluateResult, setEvaluateResult] = useState<BreastQcEvaluateResult | null>(null)
  const [evaluating, setEvaluating] = useState(false)

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

  // [G005 Wave1A W9] 测试计划 / 标准 / 统计 (后端 GET /mammo-qc/tests|standards|stats)
  const fetchExt = useCallback(async () => {
    setExtLoading(true)
    try {
      const [tRes, sRes, stRes] = await Promise.all([mammoQcApi.getTests(), mammoQcApi.getStandards(), mammoQcApi.getStats()])
      if (tRes.success && Array.isArray(tRes.data)) setTests(tRes.data)
      if (sRes.success && Array.isArray(sRes.data)) setStandards(sRes.data)
      if (stRes.success && stRes.data) setQcStats(stRes.data.data ?? null)
    } catch { /* 扩展接口不可用时保持空 */ }
    setExtLoading(false)
  }, [])

  // [G-21 Wave3C] 乳腺质控规则列表 (后端 GET /mammo-qc/breast-rules)
  const fetchBreastRules = useCallback(async () => {
    setRuleLoading(true)
    try {
      const res = await mammoQcApi.getBreastRules()
      if (res.success && Array.isArray(res.data)) setBreastRules(res.data)
    } catch { /* 保持空 */ }
    setRuleLoading(false)
  }, [])

  // [G-21 Wave3C] 影像质量参数 → 规则命中评估
  const handleEvaluate = async () => {
    setEvaluating(true)
    try {
      const res = await mammoQcApi.evaluateBreast(evaluateImages)
      if (res.success && res.data) {
        setEvaluateResult(res.data)
      } else {
        message.error(res.error?.message ?? '质控评估失败')
      }
    } catch {
      message.error('质控评估失败')
    } finally {
      setEvaluating(false)
    }
  }

  const patchImage = (index: number, patch: Partial<BreastQcImageInput>) => {
    setEvaluateImages(prev => prev.map((img, i) => i === index ? { ...img, ...patch } : img))
  }

  const evalStatusStyle: Record<string, { bg: string; text: string }> = {
    '通过': { bg: '#22c55e22', text: '#16a34a' },
    '告警': { bg: '#f59e0b22', text: '#ca8a04' },
    '不合格': { bg: '#ef444422', text: '#dc2626' },
  }

  useEffect(() => { fetchAll() }, [fetchAll])
  useEffect(() => { fetchExt() }, [fetchExt])
  useEffect(() => { fetchBreastRules() }, [fetchBreastRules])

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

      {/* [G-21 Wave3C] 乳腺质控评估: 影像质量参数表单 → 规则命中评估 */}
      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><Scale size={16} color='#be185d' />乳腺质控评估 (投照质量 / 剂量)</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>体位</th>
              <th style={s.th}>覆盖 (%)</th>
              <th style={s.th}>乳头切线位</th>
              <th style={s.th}>压迫厚度 (mm)</th>
              <th style={s.th}>AGD (mGy)</th>
            </tr></thead>
            <tbody>
              {evaluateImages.map((img, i) => (
                <tr key={img.view}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{img.view}</td>
                  <td style={s.td}><input type="number" min={0} max={100} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }} value={img.coverage ?? ''} onChange={e => patchImage(i, { coverage: Number(e.target.value) })} /></td>
                  <td style={s.td}><input type="checkbox" checked={img.nippleTangential ?? false} onChange={e => patchImage(i, { nippleTangential: e.target.checked })} /></td>
                  <td style={s.td}><input type="number" min={0} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }} value={img.compression ?? ''} onChange={e => patchImage(i, { compression: Number(e.target.value) })} /></td>
                  <td style={s.td}><input type="number" min={0} step={0.1} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 13 }} value={img.agd ?? ''} onChange={e => patchImage(i, { agd: Number(e.target.value) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={s.btnPrimary} onClick={handleEvaluate} disabled={evaluating}><AlertTriangle size={14} /> {evaluating ? '评估中...' : '开始质控评估'}</button>
          {evaluateResult && (
            <span style={{ ...s.bad, background: evalStatusStyle[evaluateResult.overall]?.bg, color: evalStatusStyle[evaluateResult.overall]?.text, fontSize: 14, padding: '6px 14px' }}>
              整体结果: {evaluateResult.overall} · 通过 {evaluateResult.passed} / 告警 {evaluateResult.warned} / 不合格 {evaluateResult.failed} · 评分 {evaluateResult.score}
            </span>
          )}
        </div>
        {evaluateResult && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>规则命中明细 ({evaluateResult.hits.length})</div>
            <div style={s.scrollBox}>
              <table style={s.table}>
                <thead><tr>
                  <th style={s.th}>影像</th><th style={s.th}>规则</th><th style={s.th}>类别</th><th style={s.th}>级别</th><th style={s.th}>结果</th><th style={s.th}>依据</th>
                </tr></thead>
                <tbody>
                  {evaluateResult.images.map(img => img.hits.map(h => (
                    <tr key={`${img.view}-${h.ruleId}`}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{img.view}</td>
                      <td style={s.td}>{h.ruleId} {h.name}</td>
                      <td style={s.td}>{h.category}</td>
                      <td style={s.td}>{h.level === 'required' ? '必查' : '建议'}</td>
                      <td style={s.td}><StatusBadge status={h.status} /></td>
                      <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{h.basis}</td>
                    </tr>
                  ))).flat()}
                  {evaluateResult.hits.length === 0 && <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>未命中规则</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* [G-21 Wave3C] 乳腺质控规则库 (15 条 seed) */}
      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><BookOpen size={16} color='#0d9488' />乳腺质控规则库 ({breastRules.length})</div>
        <div style={s.scrollBox}>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>规则</th><th style={s.th}>类别</th><th style={s.th}>级别</th><th style={s.th}>要求/说明</th>
            </tr></thead>
            <tbody>
              {ruleLoading && <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</td></tr>}
              {!ruleLoading && breastRules.map(r => (
                <tr key={r.id}>
                  <td style={{ ...s.td, fontWeight: 600, whiteSpace: 'nowrap' }}>{r.id} {r.name}</td>
                  <td style={s.td}><span style={{ padding: '2px 8px', borderRadius: 10, background: r.category === '剂量' ? '#fef3c7' : r.category === '投照质量' ? '#dbeafe' : '#dcfce7', color: r.category === '剂量' ? '#b45309' : r.category === '投照质量' ? '#1d4ed8' : '#15803d', fontSize: 11, fontWeight: 600 }}>{r.category}</span></td>
                  <td style={s.td}>{r.level === 'required' ? <span style={{ color: '#dc2626', fontWeight: 600 }}>必查</span> : <span style={{ color: '#64748b' }}>建议</span>}</td>
                  <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{r.description}</td>
                </tr>
              ))}
              {!ruleLoading && breastRules.length === 0 && <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无规则 (后端 /mammo-qc/breast-rules 不可用)</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>

      {/* [G005 Wave1A W9] 测试计划 / 标准 / 统计 (后端 GET /mammo-qc/tests|standards|stats) */}
      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><PieChart size={16} color='#0891b2' />质控测试计划 / 标准 / 统计</div>
        <Tabs
          size="small"
          items={[
            {
              key: 'tests',
              label: <span><ClipboardList size={12} /> 测试计划 ({tests.length})</span>,
              children: (
                <div style={s.scrollBox}>
                  <table style={s.table}>
                    <thead><tr>
                      <th style={s.th}>测试项</th><th style={s.th}>类别</th><th style={s.th}>频次</th>
                      <th style={s.th}>目标</th><th style={s.th}>最近结果</th><th style={s.th}>状态</th><th style={s.th}>下次日期</th>
                    </tr></thead>
                    <tbody>
                      {extLoading && <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</td></tr>}
                      {!extLoading && tests.map(t => (
                        <tr key={t.id}>
                          <td style={s.td}>{t.name}</td>
                          <td style={s.td}>{t.category}</td>
                          <td style={s.td}>{t.frequency}</td>
                          <td style={s.td}>{t.target}</td>
                          <td style={s.td}><span style={{ fontWeight: 700 }}>{t.lastResult}</span></td>
                          <td style={s.td}><StatusBadge status={t.status} /></td>
                          <td style={s.td}>{t.nextDue}</td>
                        </tr>
                      ))}
                      {!extLoading && tests.length === 0 && <tr><td colSpan={7} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无测试计划</td></tr>}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              key: 'standards',
              label: <span><BookOpen size={12} /> 质控标准 ({standards.length})</span>,
              children: (
                <div style={s.scrollBox}>
                  <table style={s.table}>
                    <thead><tr>
                      <th style={s.th}>标准</th><th style={s.th}>要求</th><th style={s.th}>来源</th><th style={s.th}>适用范围</th>
                    </tr></thead>
                    <tbody>
                      {extLoading && <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>加载中...</td></tr>}
                      {!extLoading && standards.map(st => (
                        <tr key={st.id}>
                          <td style={{ ...s.td, fontWeight: 600 }}>{st.name}</td>
                          <td style={s.td}>{st.requirement}</td>
                          <td style={s.td}><span style={{ padding: '2px 8px', borderRadius: 10, background: 'var(--color-info-bg)', color: '#1e40af', fontSize: 11, fontWeight: 600 }}>{st.source}</span></td>
                          <td style={s.td}>{st.scope}</td>
                        </tr>
                      ))}
                      {!extLoading && standards.length === 0 && <tr><td colSpan={4} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无质控标准</td></tr>}
                    </tbody>
                  </table>
                </div>
              ),
            },
            {
              key: 'stats',
              label: <span><BarChart3 size={12} /> 统计</span>,
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: '记录总数', value: qcStats?.totalRecords ?? 0, unit: '条', color: '#2563eb' },
                    { label: '合格率', value: qcStats?.passRate ?? 0, unit: '%', color: '#16a34a' },
                    { label: '待复评率', value: qcStats?.reviewRate ?? 0, unit: '%', color: '#ca8a04' },
                    { label: '不合格率', value: qcStats?.failRate ?? 0, unit: '%', color: '#dc2626' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.value}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{item.unit}</span></div>
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>技师维度 (平均分)</div>
                    <table style={s.table}>
                      <thead><tr><th style={s.th}>技师</th><th style={s.th}>记录数</th><th style={s.th}>平均分</th></tr></thead>
                      <tbody>
                        {(qcStats?.byTechnologist ?? []).map((t, i) => (
                          <tr key={i}>
                            <td style={s.td}>{t.technologist}</td>
                            <td style={s.td}>{t.count}</td>
                            <td style={s.td}><span style={{ fontWeight: 700, color: t.avgScore >= 80 ? '#16a34a' : '#ca8a04' }}>{t.avgScore}</span></td>
                          </tr>
                        ))}
                        {(qcStats?.byTechnologist ?? []).length === 0 && <tr><td colSpan={3} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>暂无统计</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Card>
    </div>
  )
}

export default QualityManagementPage
