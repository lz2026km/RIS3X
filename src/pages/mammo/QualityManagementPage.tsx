// 6.7 Quality Management (20 pts)
// 数据源: mammoQcApi (/mammo-qc/overview + /mammo-qc/records, [Wave1B] 后端已实现, MSW 仅 mock 兜底)
// [G005 Wave1A W9] 新增: /mammo-qc/tests|standards|stats 区块
// [G-21 Wave3C] 新增: 乳腺质控评估区块 (breast-evaluate) + 乳腺质控规则列表 (breast-rules)
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Shield, CheckCircle, XCircle, Download, RefreshCw, Target, BarChart3, Activity, Users, FileText, ClipboardList, BookOpen, PieChart, AlertTriangle, Scale } from 'lucide-react'
import { mammoQcApi, type MammoQcOverview, type MammoQcRecord, type MammoQcTest, type MammoQcStandard, type MammoQcStats, type BreastQcRule, type BreastQcImageInput, type BreastQcEvaluateResult } from '../../services/api/mammoQcApi'
import { Card, Tabs, Typography, message } from 'antd'
import type { TableColumnsType } from 'antd'
import { DataTable } from '../../components/common/DataTable'
import { t } from '../../i18n/appI18n'
// [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-RCR-07 BI-RADS 分类率
import { RqiIndicatorLink } from '../../components/qc/RqiIndicatorLink'

const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0 },
  subtitle: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: { background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden' },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 24, fontWeight: 700, color: 'var(--color-primary-800)', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  statSub: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 },
  section: { background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  grid3: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 },
  btn: { padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--color-primary-600)', color: '#fff', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-primary)' },
  bad: { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, display: 'inline-block' },
  scrollBox: { maxHeight: 300, overflowY: 'auto' },
  progressBar: { width: '100%', height: 8, background: 'var(--bg-card)', borderRadius: 4, overflow: 'hidden' },
}

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    '合格': { bg: '#22c55e22', text: 'var(--color-success-600)' },
    '不合格': { bg: '#ef444422', text: 'var(--color-error-600)' },
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
      if (!ovRes.success) throw new Error((ovRes.error as { message?: string })?.message || t('mammoQc.errOverview'))
      if (!recRes.success) throw new Error((recRes.error as { message?: string })?.message || t('mammoQc.errRecords'))
      setOverview(ovRes.data?.data ?? null)
      setRecords(recRes.data?.data ?? [])
      setSource(ovRes.data?.source ?? 'demo')
    } catch (e) {
      setError((e as Error)?.message || t('mammoQc.errLoad'))
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
        message.error(res.error?.message ?? t('mammoQc.errEvaluate'))
      }
    } catch {
      message.error(t('mammoQc.errEvaluate'))
    } finally {
      setEvaluating(false)
    }
  }

  const patchImage = (index: number, patch: Partial<BreastQcImageInput>) => {
    setEvaluateImages(prev => prev.map((img, i) => i === index ? { ...img, ...patch } : img))
  }

  const evalStatusStyle: Record<string, { bg: string; text: string }> = {
    '通过': { bg: '#22c55e22', text: 'var(--color-success-600)' },
    '告警': { bg: '#f59e0b22', text: '#ca8a04' },
    '不合格': { bg: '#ef444422', text: 'var(--color-error-600)' },
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
    { label: t('mammoQc.statOverallScore'), value: overview?.overallScore?.toFixed(1) ?? '-', unit: '分', icon: Shield, color: 'var(--color-primary-600)', bg: '#3b82f622' },
    { label: t('mammoQc.statAcrCompliance'), value: overview?.acrComplianceRate?.toFixed(1) ?? '-', unit: '%', icon: CheckCircle, color: 'var(--color-success-600)', bg: '#22c55e22' },
    { label: t('mammoQc.statRecallRate'), value: overview?.recallRate?.toFixed(1) ?? '-', unit: '%', sub: t('mammoQc.statRecallTarget'), icon: Target, color: '#ca8a04', bg: '#f59e0b22' },
    { label: t('mammoQc.statAvgDose'), value: overview?.avgDoseMgy?.toFixed(1) ?? '-', unit: 'mGy', icon: Activity, color: '#ea580c', bg: '#f9731622' },
    { label: t('mammoQc.statImageFailRate'), value: overview?.imageFailRate?.toFixed(1) ?? '-', unit: '%', icon: XCircle, color: 'var(--color-error-600)', bg: '#ef444422' },
    { label: t('mammoQc.statTechConsistency'), value: overview?.technologistConsistency?.toFixed(1) ?? '-', unit: '%', icon: Users, color: '#7c3aed', bg: '#8b5cf622' },
  ], [overview])

  const acrChecks = overview?.acrChecks ?? []

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return records.filter(r => r.patient.toLowerCase().includes(q) || r.technologist.toLowerCase().includes(q))
  }, [records, search])

  // [UI-4] 迁移原始 <table> → DataTable (统一列头/密度/分页/空态)
  const recordColumns = useMemo<TableColumnsType<MammoQcRecord>>(() => [
    { title: t('mammoQc.colDate'), dataIndex: 'date', key: 'date' },
    { title: t('mammoQc.colPatient'), dataIndex: 'patient', key: 'patient' },
    { title: t('mammoQc.colDevice'), dataIndex: 'modality', key: 'modality' },
    { title: t('mammoQc.colScore'), dataIndex: 'score', key: 'score', align: 'right', render: (v: number) => <span style={{ fontWeight: 700, color: v >= 80 ? 'var(--color-success-600)' : v >= 60 ? '#ca8a04' : 'var(--color-error-600)' }}>{v}</span> },
    { title: t('mammoQc.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
    { title: t('mammoQc.colTechnologist'), dataIndex: 'technologist', key: 'technologist' },
    { title: t('mammoQc.colIssue'), dataIndex: 'issue', key: 'issue', render: (v: string) => v || '-' },
  ], [])

  const testColumns = useMemo<TableColumnsType<MammoQcTest>>(() => [
    { title: t('mammoQc.colTestItem'), dataIndex: 'name', key: 'name' },
    { title: t('mammoQc.colCategory'), dataIndex: 'category', key: 'category' },
    { title: t('mammoQc.colFrequency'), dataIndex: 'frequency', key: 'frequency' },
    { title: t('mammoQc.colTarget'), dataIndex: 'target', key: 'target' },
    { title: t('mammoQc.colLastResult'), dataIndex: 'lastResult', key: 'lastResult', align: 'right', render: (v: number) => <span style={{ fontWeight: 700 }}>{v}</span> },
    { title: t('mammoQc.colStatus'), dataIndex: 'status', key: 'status', render: (v: string) => <StatusBadge status={v} /> },
    { title: t('mammoQc.colNextDue'), dataIndex: 'nextDue', key: 'nextDue' },
  ], [])

  const standardColumns = useMemo<TableColumnsType<MammoQcStandard>>(() => [
    { title: t('mammoQc.colStandard'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('mammoQc.colRequirement'), dataIndex: 'requirement', key: 'requirement' },
    { title: t('mammoQc.colSource'), dataIndex: 'source', key: 'source' },
    { title: t('mammoQc.colScope'), dataIndex: 'scope', key: 'scope' },
  ], [])

  const ruleColumns = useMemo<TableColumnsType<BreastQcRule>>(() => [
    { title: t('mammoQc.colRule'), key: 'rule', render: (_v, r) => <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{r.id} {r.name}</span> },
    { title: t('mammoQc.colCategory'), dataIndex: 'category', key: 'category', render: (v: string) => <span style={{ padding: '2px 8px', borderRadius: 10, background: v === '剂量' ? '#fef3c7' : v === '投照质量' ? '#dbeafe' : '#dcfce7', color: v === '剂量' ? '#b45309' : v === '投照质量' ? 'var(--color-primary-700)' : '#15803d', fontSize: 11, fontWeight: 600 }}>{v}</span> },
    { title: t('mammoQc.colLevel'), dataIndex: 'level', key: 'level', render: (v: string) => v === 'required' ? <span style={{ color: 'var(--color-error-600)', fontWeight: 600 }}>{t('mammoQc.required')}</span> : <span style={{ color: '#64748b' }}>{t('mammoQc.suggested')}</span> },
    { title: t('mammoQc.colRequirement'), dataIndex: 'description', key: 'description' },
  ], [])

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div>
          <Typography.Title level={4} style={{ margin: 0 }}>{t('mammoQc.title')}</Typography.Title>
          <p style={s.subtitle}>{t('mammoQc.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, background: source === 'demo' ? '#fffbeb' : '#ecfdf5', border: `1px solid ${source === 'demo' ? 'var(--color-warning-500)' : '#10b981'}`, color: source === 'demo' ? '#b45309' : '#047857' }}>
            {source === 'demo' ? t('mammoQc.sourceDemo') : t('mammoQc.sourceReal')}
          </span>
          <button style={s.btn} onClick={fetchAll}><RefreshCw size={14} /> {t('mammoQc.sync')}</button>
          <button style={s.btnPrimary} onClick={handleExportReport}><Download size={14} /> {t('mammoQc.exportReport')}</button>
        </div>
      </div>

      {/* [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-RCR-07 BI-RADS 分类率 */}
      <RqiIndicatorLink code="RQI-RCR-07" />

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 14px', background: 'var(--color-error-bg)', border: '1px solid #fecaca', borderRadius: 8, fontSize: 12, color: '#b91c1c', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span>{t('mammoQc.loadFailedPrefix')}{error}</span>
          <button onClick={fetchAll} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid #fca5a5', background: 'var(--bg-card)', color: '#b91c1c', cursor: 'pointer', fontSize: 12 }}>{t('mammoQc.retry')}</button>
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
        <div style={s.sectionTitle}><BarChart3 size={16} color='var(--color-primary-600)' />{t('mammoQc.acrCheck')}</div>
        <div style={s.grid3}>
          {acrChecks.map((item, i) => (
            <div key={i} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 12 }}>{item.name}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: item.score >= 90 ? 'var(--color-success-600)' : item.score >= 80 ? '#ca8a04' : 'var(--color-error-600)' }}>{item.score}</span>
              </div>
              <div style={s.progressBar}><div style={{ width: `${item.score}%`, height: '100%', background: item.score >= 90 ? 'var(--color-success-600)' : item.score >= 80 ? '#ca8a04' : 'var(--color-error-600)', borderRadius: 4 }} /></div>
              <ul style={{ margin: '8px 0 0', paddingLeft: 14, fontSize: 12, color: 'var(--text-secondary)' }}>
                {item.items.map((it, j) => <li key={j} style={{ marginBottom: 2 }}>{it}</li>)}
              </ul>
            </div>
          ))}
          {!loading && acrChecks.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: 12 }}>{t('mammoQc.noAcrData')}</div>}
        </div>
      </Card>

      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><FileText size={16} color='#7c3aed' />{t('mammoQc.qcRecords')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12,}} placeholder={t('mammoQc.searchPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} />
          <button style={s.btn} onClick={fetchAll}><RefreshCw size={14} /> {t('mammoQc.refresh')}</button>
        </div>
        <DataTable<MammoQcRecord>
          rowKey="id"
          columns={recordColumns}
          dataSource={filtered}
          loading={loading}
          emptyText={t('mammoQc.noMatch')}
          pageSize={12}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* [G-21 Wave3C] 乳腺质控评估: 影像质量参数表单 → 规则命中评估 */}
      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><Scale size={16} color='#be185d' />{t('mammoQc.breastEval')}</div>
        <div style={{ overflowX: 'auto' }}>
          <table style={s.table}>
            <thead><tr>
              <th style={s.th}>{t('mammoQc.colView')}</th>
              <th style={s.th}>{t('mammoQc.colCoverage')}</th>
              <th style={s.th}>{t('mammoQc.colNippleTangential')}</th>
              <th style={s.th}>{t('mammoQc.colCompression')}</th>
              <th style={s.th}>AGD (mGy)</th>
            </tr></thead>
            <tbody>
              {evaluateImages.map((img, i) => (
                <tr key={img.view}>
                  <td style={{ ...s.td, fontWeight: 600 }}>{img.view}</td>
                  <td style={s.td}><input type="number" min={0} max={100} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }} value={img.coverage ?? ''} onChange={e => patchImage(i, { coverage: Number(e.target.value) })} /></td>
                  <td style={s.td}><input type="checkbox" checked={img.nippleTangential ?? false} onChange={e => patchImage(i, { nippleTangential: e.target.checked })} /></td>
                  <td style={s.td}><input type="number" min={0} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }} value={img.compression ?? ''} onChange={e => patchImage(i, { compression: Number(e.target.value) })} /></td>
                  <td style={s.td}><input type="number" min={0} step={0.1} style={{ width: 90, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12 }} value={img.agd ?? ''} onChange={e => patchImage(i, { agd: Number(e.target.value) })} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <button style={s.btnPrimary} onClick={handleEvaluate} disabled={evaluating}><AlertTriangle size={14} /> {evaluating ? t('mammoQc.evaluating') : t('mammoQc.startEval')}</button>
          {evaluateResult && (
            <span style={{ ...s.bad, background: evalStatusStyle[evaluateResult.overall]?.bg, color: evalStatusStyle[evaluateResult.overall]?.text, fontSize: 14, padding: '6px 14px' }}>
              {t('mammoQc.evalOverall')} {evaluateResult.overall} · {t('mammoQc.evalPassed')} {evaluateResult.passed} / {t('mammoQc.evalWarned')} {evaluateResult.warned} / {t('mammoQc.evalFailed')} {evaluateResult.failed} · {t('mammoQc.evalScore')} {evaluateResult.score}
            </span>
          )}
        </div>
        {evaluateResult && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('mammoQc.ruleHits')} ({evaluateResult.hits.length})</div>
            <div style={s.scrollBox}>
              <table style={s.table}>
                <thead><tr>
                  <th style={s.th}>{t('mammoQc.colImage')}</th><th style={s.th}>{t('mammoQc.colRule')}</th><th style={s.th}>{t('mammoQc.colCategory')}</th><th style={s.th}>{t('mammoQc.colLevel')}</th><th style={s.th}>{t('mammoQc.colResult')}</th><th style={s.th}>{t('mammoQc.colBasis')}</th>
                </tr></thead>
                <tbody>
                  {evaluateResult.images.map(img => img.hits.map(h => (
                    <tr key={`${img.view}-${h.ruleId}`}>
                      <td style={{ ...s.td, fontWeight: 600 }}>{img.view}</td>
                      <td style={s.td}>{h.ruleId} {h.name}</td>
                      <td style={s.td}>{h.category}</td>
                      <td style={s.td}>{h.level === 'required' ? t('mammoQc.required') : t('mammoQc.suggested')}</td>
                      <td style={s.td}><StatusBadge status={h.status} /></td>
                      <td style={{ ...s.td, color: 'var(--text-secondary)' }}>{h.basis}</td>
                    </tr>
                  ))).flat()}
                  {evaluateResult.hits.length === 0 && <tr><td colSpan={6} style={{ ...s.td, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('mammoQc.noRuleHit')}</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      {/* [G-21 Wave3C] 乳腺质控规则库 (15 条 seed) */}
      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><BookOpen size={16} color='#0d9488' />{t('mammoQc.ruleLibrary')} ({breastRules.length})</div>
        <DataTable<BreastQcRule>
          rowKey="id"
          columns={ruleColumns}
          dataSource={breastRules}
          loading={ruleLoading}
          emptyText={t('mammoQc.noRules')}
          pageSize={15}
          scroll={{ x: 'max-content' }}
        />
      </Card>

      {/* [G005 Wave1A W9] 测试计划 / 标准 / 统计 (后端 GET /mammo-qc/tests|standards|stats) */}
      <Card bordered={false} style={s.section} styles={{ body: { padding: 0 } }}>
        <div style={s.sectionTitle}><PieChart size={16} color='var(--color-info-600)' />{t('mammoQc.testPlanTitle')}</div>
        <Tabs
          size="small"
          items={[
            {
              key: 'tests',
              label: <span><ClipboardList size={12} /> {t('mammoQc.testPlan')} ({tests.length})</span>,
              children: (
                <DataTable<MammoQcTest>
                  rowKey="id"
                  columns={testColumns}
                  dataSource={tests}
                  loading={extLoading}
                  emptyText={t('mammoQc.noTests')}
                  scroll={{ x: 'max-content' }}
                />
              ),
            },
            {
              key: 'standards',
              label: <span><BookOpen size={12} /> {t('mammoQc.qcStandards')} ({standards.length})</span>,
              children: (
                <DataTable<MammoQcStandard>
                  rowKey="id"
                  columns={standardColumns}
                  dataSource={standards}
                  loading={extLoading}
                  emptyText={t('mammoQc.noStandards')}
                  scroll={{ x: 'max-content' }}
                />
              ),
            },
            {
              key: 'stats',
              label: <span><BarChart3 size={12} /> {t('mammoQc.stats')}</span>,
              children: (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
                  {[
                    { label: t('mammoQc.statTotalRecords'), value: qcStats?.totalRecords ?? 0, unit: '条', color: 'var(--color-primary-600)' },
                    { label: t('mammoQc.statPassRate'), value: qcStats?.passRate ?? 0, unit: '%', color: 'var(--color-success-600)' },
                    { label: t('mammoQc.statReviewRate'), value: qcStats?.reviewRate ?? 0, unit: '%', color: '#ca8a04' },
                    { label: t('mammoQc.statFailRate'), value: qcStats?.failRate ?? 0, unit: '%', color: 'var(--color-error-600)' },
                  ].map((item, i) => (
                    <div key={i} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 10 }}>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{item.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: item.color }}>{item.value}<span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{item.unit}</span></div>
                    </div>
                  ))}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 8 }}>{t('mammoQc.techDim')}</div>
                    <DataTable<{ technologist: string; count: number; avgScore: number }>
                      rowKey={(r) => r.technologist}
                      columns={[
                        { title: t('mammoQc.colTechnologist'), dataIndex: 'technologist', key: 'technologist' },
                        { title: t('mammoQc.colRecordCount'), dataIndex: 'count', key: 'count', align: 'right' },
                        { title: t('mammoQc.colAvgScore'), dataIndex: 'avgScore', key: 'avgScore', align: 'right', render: (v: number) => <span style={{ fontWeight: 700, color: v >= 80 ? 'var(--color-success-600)' : '#ca8a04' }}>{v}</span> },
                      ]}
                      dataSource={qcStats?.byTechnologist ?? []}
                      emptyText={t('mammoQc.noStats')}
                      showPagination={false}
                    />
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
