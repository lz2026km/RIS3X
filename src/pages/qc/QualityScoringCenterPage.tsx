/**
 * [G005 W9-QC] 统一质控评分台 (/qc/scoring-center)
 *
 * 单一加权模型 + 40 指标计算引擎 + PDCA 闭环 + 抽查双盲 + 互评缺陷 + 设备质控 一站式。
 * 数据源: qualityScoringCenterApi (真实后端 /quality/rubric 等 或 MSW w9QcHandlers 确定性回退)。
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  RefreshCw,
  Gauge,
  SlidersHorizontal,
  ListChecks,
  GitBranch,
  EyeOff,
  UsersRound,
  Stethoscope,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Play,
  Database,
  HardDrive,
  Search,
} from 'lucide-react'
import {
  Button,
  Tag,
  Space,
  Tabs,
  Select,
  Input,
  InputNumber,
  Modal,
  Form,
  Drawer,
  Progress,
  Tooltip,
  Popconfirm,
  message,
  Radio,
  Spin,
} from "antd";
import type { ColumnsType } from 'antd/es/table'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { StateView } from '../../components/common/StateView'
import {
  qualityScoringCenterApi as api,
  type QualityRubric,
  type RubricEvaluationResult,
  type ComputedSnapshot,
  type ComputedIndicator,
  type PdcaAction,
  type PdcaMetrics,
  type SamplingBatchView,
  type SamplingStats,
  type DefectCategory,
  type DefectItem,
  type DefectAggregation,
  type PhantomTestItem,
  type EquipmentQcRecord,
  type EquipmentQcStats,
  type EquipmentModality,
  type QcFrequency,
} from '../../services/api/qualityScoringCenterApi'
import { reportQcV2Api, type QcTask, type QcTaskStatus } from '../../services/api/reportQcV2Api'
import { t } from '../../i18n/appI18n'
import { severityColor, severityToAntd, toneToAntd } from '../../theme/statusTokens'

const QC_STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  pass: { label: t('w9Qc.status.pass'), color: toneToAntd('passed'), icon: CheckCircle2 },
  warn: { label: t('w9Qc.status.warn'), color: toneToAntd('warning'), icon: AlertTriangle },
  fail: { label: t('w9Qc.status.fail'), color: toneToAntd('failed'), icon: XCircle },
  nodata: { label: t('w9Qc.status.nodata'), color: toneToAntd('unknown'), icon: AlertTriangle },
}

const GRADE_COLORS: Record<string, string> = { A: severityColor('success'), B: severityColor('info'), C: severityColor('warning'), D: severityColor('critical') }

const ACTION_STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: t('w9Qc.action.pending'), color: toneToAntd('pending') },
  in_progress: { label: t('w9Qc.action.inProgress'), color: toneToAntd('in_progress') },
  done: { label: t('w9Qc.action.done'), color: toneToAntd('done') },
  overdue: { label: t('w9Qc.action.overdue'), color: toneToAntd('overdue') },
}

const SEVERITY_COLORS: Record<string, string> = { low: severityToAntd('low'), medium: severityToAntd('warning'), high: severityToAntd('high'), critical: severityToAntd('critical') }

const METHOD_LABELS: Record<string, string> = {
  random: t('w9Qc.sampling.method.random'),
  low_yield: t('w9Qc.sampling.method.lowYield'),
  stratified: t('w9Qc.sampling.method.stratified'),
}

const FREQ_LABELS: Record<string, string> = { daily: t('w9Qc.equipment.daily'), weekly: t('w9Qc.equipment.weekly'), monthly: t('w9Qc.equipment.monthly') }

function fmtDate(s?: string) { return s ? s.slice(0, 10) : '-' }

// ================= 主页面 =================

export default function QualityScoringCenterPage() {
  const [params, setParams] = useSearchParams()
  const activeTab = params.get('tab') ?? 'rubric'

  const [source, setSource] = useState<'database' | 'seed' | 'demo' | 'offline'>('demo')
  const setTab = (key: string) => setParams((prev) => { const next = new URLSearchParams(prev); next.set('tab', key); return next }, { replace: true })

  return (
    <PageContainer>
      <PageHeader
        title={t('w9Qc.title')}
        subtitle={t('w9Qc.subtitle')}
        actions={
          <Space>
            <Tag color={source === 'database' ? 'green' : source === 'seed' ? 'blue' : 'default'} icon={source === 'database' ? <Database size={12} /> : <HardDrive size={12} />}>
              {source === 'database' ? t('w9Qc.source.database') : t('w9Qc.source.seed')}
            </Tag>
          </Space>
        }
      />
      <Tabs
        activeKey={activeTab}
        onChange={setTab}
        items={[
          { key: 'rubric', label: <span><SlidersHorizontal size={14} /> {t('w9Qc.tab.rubric')}</span>, children: <RubricTab onSource={setSource} /> },
          { key: 'indicators', label: <span><ListChecks size={14} /> {t('w9Qc.tab.indicators')}</span>, children: <IndicatorsTab onSource={setSource} /> },
          { key: 'pdca', label: <span><GitBranch size={14} /> {t('w9Qc.tab.pdca')}</span>, children: <PdcaTab /> },
          { key: 'sampling', label: <span><EyeOff size={14} /> {t('w9Qc.tab.sampling')}</span>, children: <SamplingTab /> },
          { key: 'peerReview', label: <span><UsersRound size={14} /> {t('w9Qc.tab.peerReview')}</span>, children: <PeerReviewTab /> },
          { key: 'reportQcTasks', label: <span><ListChecks size={14} /> {t('w4a.qcTask.tab')}</span>, children: <ReportQcTasksTab /> },
          { key: 'equipment', label: <span><Stethoscope size={14} /> {t('w9Qc.tab.equipment')}</span>, children: <EquipmentTab /> },
        ]}
      />
    </PageContainer>
  )
}

// ================= Tab 1: 统一量表 + 评分 =================

function RubricTab({ onSource }: { onSource: (s: 'database' | 'seed' | 'demo' | 'offline') => void }) {
  const [rubric, setRubric] = useState<QualityRubric | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [form] = Form.useForm()
  const [result, setResult] = useState<RubricEvaluationResult | null>(null)
  const [evaluating, setEvaluating] = useState(false)
  const [configOpen, setConfigOpen] = useState(false)
  const [passThreshold, setPassThreshold] = useState(60)
  const [bonusThreshold, setBonusThreshold] = useState(85)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await api.getRubric().catch(() => null)
    if (res?.success && res.data) {
      setRubric(res.data)
      setPassThreshold(res.data.passThreshold)
      setBonusThreshold(res.data.bonusThreshold)
      onSource('database')
    } else {
      setRubric(null); setError(t('w9Qc.rubric.loadFailed')); onSource('offline')
    }
    setLoading(false)
  }, [onSource])

  useEffect(() => { void load() }, [load])

  const runEvaluate = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    setEvaluating(true)
    const res = await api.evaluate({ submission: values }).catch(() => null)
    if (res?.success && res.data) setResult(res.data)
    else message.error(t('w9Qc.rubric.evaluateFailed'))
    setEvaluating(false)
  }

  const fillDemo = () => {
    form.setFieldsValue({
      reportId: 'RPT-QC-DEMO',
      modality: 'CT',
      findings: '双肺纹理清晰，右肺上叶见一结节影，大小约 12mm×10mm，密度均匀，边界清楚，可见轻度强化。既往吸烟史，临床化验无异常。',
      impression: '1. 右肺上叶结节，考虑良性可能性大。 2. 纵隔未见肿大淋巴结。',
      diagnosis: '右肺上叶结节',
      recommendation: '建议 3 个月后复查胸部 CT，随诊观察。',
      structuredFieldsComplete: 0.95,
      signed: true,
      criticalMarked: false,
      priority: 'stat',
      leftRightOk: true,
      onTimeRate: 96,
      submitAt: '2026-08-10T08:00:00.000Z',
      reviewStartedAt: '2026-08-10T07:50:00.000Z',
      signedAt: '2026-08-10T08:20:00.000Z',
      hasReviewerSignature: true,
      criticalNotified: false,
      criticalAcked: false,
      priorityQueue: true,
    })
  }

  const saveConfig = async () => {
    setSaving(true)
    const res = await api.updateRubric({ passThreshold, bonusThreshold }).catch(() => null)
    if (res?.success && res.data) { setRubric(res.data); message.success(t('w9Qc.rubric.saved')) }
    else message.error(t('w9Qc.rubric.saveFailed'))
    setSaving(false); setConfigOpen(false)
  }

  const dimColumns: ColumnsType<QualityRubric['dimensions'][number]> = [
    { title: t('w9Qc.rubric.dimension'), dataIndex: 'name', key: 'name' },
    { title: t('w9Qc.rubric.weight'), dataIndex: 'weight', key: 'weight', render: (v: number) => `${Math.round(v * 100)}%` },
    { title: t('w9Qc.rubric.subItemCount'), key: 'sub', render: (_, r) => r.subItems.length },
    { title: t('w9Qc.rubric.ruleCount'), key: 'rule', render: (_, r) => r.subItems.reduce((a, s) => a + s.rules.length, 0) },
    { title: t('w9Qc.rubric.desc'), dataIndex: 'description', key: 'description', render: (v?: string) => v ?? '-' },
  ]

  if (loading || error) {
    return <StateView loading={loading} error={error} onRetry={load} minHeight={280} />
  }

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <StatCardGrid columns={4}>
        <StatCard title={t('w9Qc.rubric.name')} value={rubric?.name ?? '-'} icon={<SlidersHorizontal size={18} />} color="primary" />
        <StatCard title={t('w9Qc.rubric.version')} value={`v${rubric?.version ?? 0}`} icon={<RefreshCw size={18} />} color="info" />
        <StatCard title={t('w9Qc.rubric.passThreshold')} value={rubric?.passThreshold ?? 0} suffix={t('w9Qc.unit.score')} icon={<CheckCircle2 size={18} />} color="success" />
        <StatCard title={t('w9Qc.rubric.bonusThreshold')} value={rubric?.bonusThreshold ?? 0} suffix={t('w9Qc.unit.score')} icon={<Gauge size={18} />} color="warning" />
      </StatCardGrid>

      <Space>
        <Button icon={<SlidersHorizontal size={14} />} onClick={() => setConfigOpen(true)}>{t('w9Qc.rubric.config')}</Button>
        <Tag color="geekblue">{rubric?.standard}</Tag>
      </Space>

      <DataTable rowKey="key" columns={dimColumns} dataSource={rubric?.dimensions ?? []} pagination={false} />

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
        <Space style={{ marginBottom: 12 }}>
          <strong>{t('w9Qc.rubric.evaluate')}</strong>
          <Button size="small" onClick={fillDemo}>{t('w9Qc.rubric.fillDemo')}</Button>
          <Button type="primary" icon={<Play size={14} />} loading={evaluating} onClick={runEvaluate}>{t('w9Qc.rubric.runEvaluate')}</Button>
        </Space>
        <Form form={form} layout="vertical" size="small">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <Form.Item name="reportId" label={t('w9Qc.rubric.reportId')}><Input placeholder="RPT-QC-DEMO" /></Form.Item>
            <Form.Item name="modality" label={t('w9Qc.rubric.modality')}><Input placeholder="CT" /></Form.Item>
            <Form.Item name="structuredFieldsComplete" label={t('w9Qc.rubric.structured')}><InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="onTimeRate" label={t('w9Qc.rubric.onTimeRate')}><InputNumber min={0} max={100} style={{ width: '100%' }} /></Form.Item>
            <Form.Item name="findings" label={t('w9Qc.rubric.findings')} style={{ gridColumn: 'span 4' }}><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="impression" label={t('w9Qc.rubric.impression')} style={{ gridColumn: 'span 4' }}><Input.TextArea rows={2} /></Form.Item>
            <Form.Item name="diagnosis" label={t('w9Qc.rubric.diagnosis')} style={{ gridColumn: 'span 2' }}><Input /></Form.Item>
            <Form.Item name="recommendation" label={t('w9Qc.rubric.recommendation')} style={{ gridColumn: 'span 2' }}><Input /></Form.Item>
            <Form.Item name="priority" label={t('w9Qc.rubric.priority')}><Select options={[{ value: 'stat' }, { value: 'urgent' }, { value: 'routine' }]} /></Form.Item>
            <Form.Item name="signed" label={t('w9Qc.rubric.signed')}><Select options={[{ value: true, label: t('w9Qc.yes') }, { value: false, label: t('w9Qc.no') }]} /></Form.Item>
            <Form.Item name="hasReviewerSignature" label={t('w9Qc.rubric.reviewerSig')}><Select options={[{ value: true, label: t('w9Qc.yes') }, { value: false, label: t('w9Qc.no') }]} /></Form.Item>
            <Form.Item name="leftRightOk" label={t('w9Qc.rubric.leftRight')}><Select options={[{ value: true, label: t('w9Qc.yes') }, { value: false, label: t('w9Qc.no') }]} /></Form.Item>
          </div>
        </Form>
      </div>

      {result && <EvaluationResultView result={result} />}

      <Modal title={t('w9Qc.rubric.config')} open={configOpen} onOk={saveConfig} confirmLoading={saving} onCancel={() => setConfigOpen(false)} okText={t('w9Qc.save')}>
        <Form layout="vertical">
          <Form.Item label={t('w9Qc.rubric.passThreshold')}><InputNumber min={0} max={100} value={passThreshold} onChange={(v) => setPassThreshold(v ?? 0)} style={{ width: '100%' }} /></Form.Item>
          <Form.Item label={t('w9Qc.rubric.bonusThreshold')}><InputNumber min={0} max={100} value={bonusThreshold} onChange={(v) => setBonusThreshold(v ?? 0)} style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

function EvaluationResultView({ result }: { result: RubricEvaluationResult }) {
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, display: 'grid', gap: 16 }}>
      <Space size="large" wrap>
        <div>
          <Progress type="circle" size={96} percent={result.totalScore} strokeColor={GRADE_COLORS[result.grade] ?? '#1e40af'} format={(p) => <span style={{ fontSize: 20, fontWeight: 700 }}>{p}</span>} />
        </div>
        <div style={{ display: 'grid', gap: 6 }}>
          <Space><strong style={{ fontSize: 18 }}>{t('w9Qc.rubric.totalScore')}</strong><Tag color={GRADE_COLORS[result.grade]}>{result.gradeLabel}</Tag></Space>
          <Space>
            <Tag color={result.passed ? 'green' : 'red'}>{result.passed ? t('w9Qc.rubric.passed') : t('w9Qc.rubric.notPassed')}</Tag>
            <Tag color={result.publishable ? 'green' : 'default'}>{t('w9Qc.rubric.publishable')}: {result.publishable ? t('w9Qc.yes') : t('w9Qc.no')}</Tag>
            <Tag color={result.bonusEligible ? 'gold' : 'default'}>{t('w9Qc.rubric.bonus')}: {result.bonusEligible ? t('w9Qc.yes') : t('w9Qc.no')}</Tag>
          </Space>
          {result.hardFailTriggered.length > 0 && (
            <Space wrap>{result.hardFailTriggered.map((h) => <Tag key={h} color="red">{t('w9Qc.rubric.hardFail')}: {h}</Tag>)}</Space>
          )}
          <span style={{ color: '#94a3b8', fontSize: 12 }}>{result.standard} · v{result.rubricVersion}</span>
        </div>
      </Space>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(result.dimensions.length, 3)}, 1fr)`, gap: 12 }}>
        {result.dimensions.map((d) => (
          <div key={d.key} style={{ border: '1px solid var(--border-color)', borderRadius: 10, padding: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }} size={6}>
              <Space><strong>{d.name}</strong><Tag>{Math.round(d.weight * 100)}%</Tag><Tag color="blue">{d.score}</Tag></Space>
              {d.subItems.map((s) => (
                <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                  <Tooltip title={s.rules.map((r) => `${r.name}: ${r.explanation}`).join(' | ')}>
                    <span style={{ color: s.passed ? '#047857' : '#b45309' }}>{s.name}</span>
                  </Tooltip>
                  <span style={{ fontWeight: 600 }}>{s.score}</span>
                </div>
              ))}
            </Space>
          </div>
        ))}
      </div>
    </div>
  )
}

// ================= Tab 2: 40 指标计算引擎 =================

function IndicatorsTab({ onSource }: { onSource: (s: 'database' | 'seed' | 'demo' | 'offline') => void }) {
  const [period, setPeriod] = useState('2026-08')
  const [snapshot, setSnapshot] = useState<ComputedSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState<string>('all')
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await api.computeIndicators(period).catch(() => null)
    if (res?.success && res.data) { setSnapshot(res.data); onSource('seed') }
    else { setSnapshot(null); setError(t('w9Qc.indicators.loadFailed')) }
    setLoading(false)
  }, [period, onSource])

  useEffect(() => { void load() }, [load])

  const indicators = useMemo(() => {
    let rows = snapshot?.indicators ?? []
    if (category !== 'all') rows = rows.filter((i) => i.categoryKey === category)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      rows = rows.filter((i) => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw))
    }
    return rows
  }, [snapshot, category, keyword])

  const summary = useMemo(() => {
    const rows = snapshot?.indicators ?? []
    return {
      total: rows.length,
      computable: rows.filter((i) => i.computable).length,
      pass: rows.filter((i) => i.status === 'pass').length,
      warn: rows.filter((i) => i.status === 'warn').length,
      fail: rows.filter((i) => i.status === 'fail').length,
    }
  }, [snapshot])

  const columns: ColumnsType<ComputedIndicator> = [
    { title: t('w9Qc.indicators.code'), dataIndex: 'code', key: 'code', width: 100 },
    { title: t('w9Qc.indicators.name'), dataIndex: 'name', key: 'name' },
    { title: t('w9Qc.indicators.category'), dataIndex: 'category', key: 'category', width: 70 },
    { title: t('w9Qc.indicators.numerator'), dataIndex: 'numerator', key: 'numerator', width: 80 },
    { title: t('w9Qc.indicators.denominator'), dataIndex: 'denominator', key: 'denominator', width: 80 },
    { title: t('w9Qc.indicators.rate'), key: 'rate', width: 100, render: (_, r) => `${r.rate}${r.unit}` },
    { title: t('w9Qc.indicators.target'), dataIndex: 'target', key: 'target', width: 100 },
    {
      title: t('w9Qc.indicators.status'), key: 'status', width: 90,
      render: (_, r) => { const m = QC_STATUS_META[r.status]!; return <Tag color={m.color} icon={<m.icon size={12} />}>{m.label}</Tag> },
    },
    {
      title: t('w9Qc.indicators.source'), key: 'source', width: 90,
      render: (_, r) => <Tag color={r.computable ? 'green' : 'default'}>{r.computable ? t('w9Qc.indicators.derived') : t('w9Qc.indicators.seed')}</Tag>,
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <StatCardGrid columns={5}>
        <StatCard title={t('w9Qc.indicators.total')} value={summary.total} icon={<ListChecks size={18} />} color="primary" />
        <StatCard title={t('w9Qc.indicators.computable')} value={summary.computable} icon={<Database size={18} />} color="info" />
        <StatCard title={t('w9Qc.status.pass')} value={summary.pass} icon={<CheckCircle2 size={18} />} color="success" />
        <StatCard title={t('w9Qc.status.warn')} value={summary.warn} icon={<AlertTriangle size={18} />} color="warning" />
        <StatCard title={t('w9Qc.status.fail')} value={summary.fail} icon={<XCircle size={18} />} color="error" />
      </StatCardGrid>

      <Space wrap>
        <Select value={period} onChange={setPeriod} style={{ width: 140 }} options={Array.from({ length: 12 }, (_, i) => { const d = new Date(2026, 7 - i, 1); const v = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; return { value: v, label: v } })} />
        <Select value={category} onChange={setCategory} style={{ width: 140 }} options={[{ value: 'all', label: t('w9Qc.indicators.allCategory') }, { value: 'structure', label: t('w9Qc.indicators.structure') }, { value: 'process', label: t('w9Qc.indicators.process') }, { value: 'outcome', label: t('w9Qc.indicators.outcome') }]} />
        <Input prefix={<Search size={14} />} placeholder={t('w9Qc.indicators.search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
        <Button icon={<RefreshCw size={14} />} onClick={load}>{t('w9Qc.refresh')}</Button>
      </Space>

      <StateView loading={loading} error={error} empty={!loading && !error && indicators.length === 0} onRetry={load} minHeight={280}>
        <DataTable<ComputedIndicator> rowKey="code" columns={columns} dataSource={indicators} pagination={{ pageSize: 20, showSizeChanger: false }} scroll={{ x: 900 }} />
      </StateView>
    </div>
  )
}

// ================= Tab 3: PDCA 闭环 =================

const DEMO_CYCLE_IDS = ['pdca-001', 'pdca-002', 'pdca-003', 'pdca-004']

function PdcaTab() {
  const [cycleId, setCycleId] = useState('pdca-001')
  const [actions, setActions] = useState<PdcaAction[]>([])
  const [metrics, setMetrics] = useState<PdcaMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [a, m] = await Promise.all([api.listActions(cycleId).catch(() => null), api.getPdcaMetrics().catch(() => null)])
    if (a?.success && a.data) setActions(a.data)
    else { setActions([]); setError(t('w9Qc.pdca.loadFailed')) }
    if (m?.success && m.data) setMetrics(m.data)
    setLoading(false)
  }, [cycleId])

  useEffect(() => { void load() }, [load])

  const createAction = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const res = await api.addAction(cycleId, values).catch(() => null)
    if (res?.success) { message.success(t('w9Qc.pdca.created')); setCreateOpen(false); form.resetFields(); void load() }
    else message.error(t('w9Qc.pdca.createFailed'))
  }

  const advance = async (id: string) => {
    const res = await api.completeAction(id).catch(() => null)
    if (res?.success) { message.success(t('w9Qc.pdca.advanced')); void load() }
    else message.error(t('w9Qc.pdca.advanceFailed'))
  }

  const columns: ColumnsType<PdcaAction> = [
    { title: t('w9Qc.pdca.phase'), dataIndex: 'phase', key: 'phase', width: 80 },
    { title: t('w9Qc.pdca.description'), dataIndex: 'description', key: 'description' },
    { title: t('w9Qc.pdca.owner'), dataIndex: 'ownerName', key: 'ownerName', width: 100 },
    { title: t('w9Qc.pdca.deadline'), dataIndex: 'deadline', key: 'deadline', width: 110, render: (v: string) => fmtDate(v) },
    {
      title: t('w9Qc.pdca.status'), key: 'status', width: 100,
      render: (_, r) => { const m = ACTION_STATUS_META[r.status]!; return <Tag color={m.color}>{m.label}</Tag> },
    },
    {
      title: t('w9Qc.actions'), key: 'actions', width: 120,
      render: (_, r) => r.status !== 'done' ? (
        <Popconfirm title={t('w9Qc.pdca.confirmDone')} onConfirm={() => advance(r.id)}>
          <Button size="small" type="link">{t('w9Qc.pdca.markDone')}</Button>
        </Popconfirm>
      ) : <Tag color="success">{t('w9Qc.action.done')}</Tag>,
    },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {metrics && (
        <StatCardGrid columns={4}>
          <StatCard title={t('w9Qc.pdca.cycleCount')} value={metrics.cycleCount} icon={<GitBranch size={18} />} color="primary" />
          <StatCard title={t('w9Qc.pdca.actionCount')} value={metrics.actionCount} icon={<ListChecks size={18} />} color="info" />
          <StatCard title={t('w9Qc.pdca.completionRate')} value={metrics.actionCompletionRate} suffix="%" icon={<CheckCircle2 size={18} />} color="success" />
          <StatCard title={t('w9Qc.pdca.overdue')} value={metrics.actionOverdue} icon={<AlertTriangle size={18} />} color="error" />
        </StatCardGrid>
      )}

      <Space wrap>
        <Select value={cycleId} onChange={setCycleId} style={{ width: 200 }} options={DEMO_CYCLE_IDS.map((id) => ({ value: id, label: id }))} />
        <Button type="primary" icon={<Play size={14} />} onClick={() => setCreateOpen(true)}>{t('w9Qc.pdca.createAction')}</Button>
        <Button icon={<RefreshCw size={14} />} onClick={load}>{t('w9Qc.refresh')}</Button>
      </Space>

      <StateView loading={loading} error={error} empty={!loading && !error && actions.length === 0} onRetry={load} minHeight={240}>
        <DataTable<PdcaAction> rowKey="id" columns={columns} dataSource={actions} pagination={false} />
      </StateView>

      <Modal title={t('w9Qc.pdca.createAction')} open={createOpen} onOk={createAction} onCancel={() => setCreateOpen(false)} okText={t('w9Qc.save')}>
        <Form form={form} layout="vertical">
          <Form.Item name="description" label={t('w9Qc.pdca.description')} rules={[{ required: true }]}><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="phase" label={t('w9Qc.pdca.phase')} initialValue="plan"><Select options={['plan', 'do', 'check', 'act'].map((v) => ({ value: v, label: v }))} /></Form.Item>
          <Form.Item name="ownerId" label={t('w9Qc.pdca.owner')} initialValue="u-001"><Select options={[{ value: 'u-001', label: '张主任' }, { value: 'u-002', label: '李医生' }, { value: 'u-003', label: '王技师' }]} /></Form.Item>
          <Form.Item name="deadline" label={t('w9Qc.pdca.deadline')}><Input placeholder="2026-09-30" /></Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ================= Tab 4: 抽查双盲 =================

function SamplingTab() {
  const [batches, setBatches] = useState<SamplingBatchView[]>([])
  const [stats, setStats] = useState<SamplingStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [form] = Form.useForm()
  const [detail, setDetail] = useState<SamplingBatchView | null>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [b, s] = await Promise.all([api.listSamplingBatches().catch(() => null), api.getSamplingStats().catch(() => null)])
    if (b?.success && b.data) setBatches(b.data)
    else { setBatches([]); setError(t('w9Qc.sampling.loadFailed')) }
    if (s?.success && s.data) setStats(s.data)
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const createBatch = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const res = await api.createSamplingBatch(values).catch(() => null)
    if (res?.success) { message.success(t('w9Qc.sampling.created')); setCreateOpen(false); form.resetFields(); void load() }
    else message.error(t('w9Qc.sampling.createFailed'))
  }

  const openDetail = async (batch: SamplingBatchView) => {
    const res = await api.getSamplingBatch(batch.id).catch(() => null)
    if (res?.success && res.data) { setDetail(res.data); setDrawerOpen(true) }
  }

  const record = async (itemId: string, readerSlot: 1 | 2, result: 'positive' | 'negative' | 'indeterminate') => {
    if (!detail) return
    const res = await api.recordSamplingReading(detail.id, itemId, { readerSlot, readerId: `dr-00${readerSlot}`, readerName: readerSlot === 1 ? '张医生' : '李医生', result }).catch(() => null)
    if (res?.success && res.data) { setDetail(res.data); void load() }
    else message.error(t('w9Qc.sampling.recordFailed'))
  }

  const columns: ColumnsType<SamplingBatchView> = [
    { title: t('w9Qc.sampling.batch'), dataIndex: 'name', key: 'name' },
    { title: t('w9Qc.sampling.method'), key: 'method', width: 110, render: (_, r) => <Tag>{METHOD_LABELS[r.method]}</Tag> },
    { title: t('w9Qc.sampling.blind'), key: 'blind', width: 90, render: (_, r) => <Tag color={r.blind ? 'purple' : 'default'}>{r.blind ? t('w9Qc.sampling.blindOn') : t('w9Qc.sampling.blindOff')}</Tag> },
    { title: t('w9Qc.sampling.itemCount'), dataIndex: 'itemCount', key: 'itemCount', width: 80 },
    { title: t('w9Qc.sampling.status'), key: 'status', width: 90, render: (_, r) => <Tag color={r.status === 'open' ? 'processing' : 'default'}>{r.status === 'open' ? t('w9Qc.sampling.open') : t('w9Qc.sampling.closed')}</Tag> },
    { title: t('w9Qc.actions'), key: 'actions', width: 100, render: (_, r) => <Button size="small" type="link" onClick={() => openDetail(r)}>{t('w9Qc.sampling.record')}</Button> },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {stats && (
        <StatCardGrid columns={4}>
          <StatCard title={t('w9Qc.sampling.batchCount')} value={stats.batchCount} icon={<EyeOff size={18} />} color="primary" />
          <StatCard title={t('w9Qc.sampling.recordedPairs')} value={stats.recordedPairs} icon={<ListChecks size={18} />} color="info" />
          <StatCard title={t('w9Qc.sampling.kappa')} value={stats.agreement.kappa} icon={<Gauge size={18} />} color="success" />
          <StatCard title={t('w9Qc.sampling.agreement')} value={stats.agreement.agreementRate} suffix="%" icon={<CheckCircle2 size={18} />} color="warning" />
        </StatCardGrid>
      )}

      <Space wrap>
        <Button type="primary" icon={<Play size={14} />} onClick={() => setCreateOpen(true)}>{t('w9Qc.sampling.createBatch')}</Button>
        <Button icon={<RefreshCw size={14} />} onClick={load}>{t('w9Qc.refresh')}</Button>
        {stats && <Tag color="geekblue">{t('w9Qc.sampling.interpretation')}: {stats.agreement.interpretation}</Tag>}
      </Space>

      <StateView loading={loading} error={error} empty={!loading && !error && batches.length === 0} onRetry={load} minHeight={240}>
        <DataTable<SamplingBatchView> rowKey="id" columns={columns} dataSource={batches} pagination={{ pageSize: 10 }} />
      </StateView>

      <Modal title={t('w9Qc.sampling.createBatch')} open={createOpen} onOk={createBatch} onCancel={() => setCreateOpen(false)} okText={t('w9Qc.save')}>
        <Form form={form} layout="vertical">
          <Form.Item name="name" label={t('w9Qc.sampling.batch')}><Input placeholder="2026-08 QC 抽查" /></Form.Item>
          <Form.Item name="method" label={t('w9Qc.sampling.method')} initialValue="random"><Select options={[{ value: 'random', label: METHOD_LABELS.random }, { value: 'low_yield', label: METHOD_LABELS.low_yield }, { value: 'stratified', label: METHOD_LABELS.stratified }]} /></Form.Item>
          <Form.Item name="size" label={t('w9Qc.sampling.size')} initialValue={20}><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="modality" label={t('w9Qc.sampling.modality')}><Select allowClear options={['CT', 'MR', 'DR', 'MG'].map((v) => ({ value: v }))} /></Form.Item>
          <Form.Item name="blind" label={t('w9Qc.sampling.blind')} initialValue={true}><Radio.Group options={[{ value: true, label: t('w9Qc.sampling.blindOn') }, { value: false, label: t('w9Qc.sampling.blindOff') }]} /></Form.Item>
        </Form>
      </Modal>

      <Drawer title={detail?.name ?? t('w9Qc.sampling.detail')} open={drawerOpen} onClose={() => setDrawerOpen(false)} width={720}>
        {detail && (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Tag color={detail.blind ? 'purple' : 'default'}>{detail.blind ? t('w9Qc.sampling.blindOn') : t('w9Qc.sampling.blindOff')}</Tag>
              <Tag>{METHOD_LABELS[detail.method]}</Tag>
              <Tag>{detail.items.length} {t('w9Qc.sampling.items')}</Tag>
            </Space>
            <DataTable
              rowKey="itemId"
              pagination={{ pageSize: 10 }}
              dataSource={detail.items}
              columns={[
                { title: t('w9Qc.sampling.reportId'), dataIndex: 'reportId', key: 'reportId' },
                { title: t('w9Qc.sampling.patient'), dataIndex: 'patientName', key: 'patientName', width: 90 },
                { title: t('w9Qc.sampling.modality'), dataIndex: 'modality', key: 'modality', width: 70 },
                {
                  title: t('w9Qc.sampling.readings'), key: 'readings', width: 240,
                  render: (_, r) => (
                    <Space direction="vertical" size={2}>
                      {r.readings.map((rd) => (
                        <Space key={rd.readerSlot} size={4}>
                          <Tag>{rd.readerLabel}</Tag>
                          <Tag color={rd.result === 'positive' ? 'red' : rd.result === 'negative' ? 'green' : 'default'}>{rd.result ?? t('w9Qc.sampling.pending')}</Tag>
                        </Space>
                      ))}
                    </Space>
                  ),
                },
                {
                  title: t('w9Qc.sampling.record'), key: 'record', width: 180,
                  render: (_, r) => (
                    <Space size={4}>
                      <Button size="small" onClick={() => record(r.itemId, 1, 'positive')}>R1 +</Button>
                      <Button size="small" onClick={() => record(r.itemId, 1, 'negative')}>R1 -</Button>
                      <Button size="small" onClick={() => record(r.itemId, 2, 'positive')}>R2 +</Button>
                      <Button size="small" onClick={() => record(r.itemId, 2, 'negative')}>R2 -</Button>
                    </Space>
                  ),
                },
              ]}
            />
          </>
        )}
      </Drawer>
    </div>
  )
}

// ================= Tab 5: 互评 + 缺陷库 =================

function PeerReviewTab() {
  const [categories, setCategories] = useState<DefectCategory[]>([])
  const [items, setItems] = useState<DefectItem[]>([])
  const [aggregation, setAggregation] = useState<DefectAggregation | null>(null)
  const [defectStats, setDefectStats] = useState<{ totalLinks: number; byCode: Array<{ code: string; count: number }>; byCategory: Array<{ categoryCode: string; count: number }>; bySeverity: Array<{ severity: string; count: number }> } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [categoryCode, setCategoryCode] = useState<string>('all')
  const [keyword, setKeyword] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [c, i, a, s] = await Promise.all([
      api.listDefectCategories().catch(() => null),
      api.listDefectItems().catch(() => null),
      api.getDefectAggregation().catch(() => null),
      api.getPeerReviewDefectStats().catch(() => null),
    ])
    if (c?.success && c.data) setCategories(c.data)
    if (i?.success && i.data) setItems(i.data)
    if (a?.success && a.data) setAggregation(a.data)
    if (s?.success && s.data) setDefectStats(s.data)
    if (!i?.success) setError(t('w9Qc.peerReview.loadFailed'))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const filtered = useMemo(() => {
    let rows = items
    if (categoryCode !== 'all') rows = rows.filter((i) => i.categoryCode === categoryCode)
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase()
      rows = rows.filter((i) => i.code.toLowerCase().includes(kw) || i.name.toLowerCase().includes(kw))
    }
    return rows
  }, [items, categoryCode, keyword])

  const columns: ColumnsType<DefectItem> = [
    { title: t('w9Qc.peerReview.code'), dataIndex: 'code', key: 'code', width: 90 },
    { title: t('w9Qc.peerReview.category'), dataIndex: 'categoryCode', key: 'categoryCode', width: 110 },
    { title: t('w9Qc.peerReview.name'), dataIndex: 'name', key: 'name' },
    { title: t('w9Qc.peerReview.severity'), key: 'severity', width: 100, render: (_, r) => <Tag color={SEVERITY_COLORS[r.severity]}>{r.severity}</Tag> },
    { title: t('w9Qc.peerReview.description'), dataIndex: 'description', key: 'description' },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {aggregation && (
        <StatCardGrid columns={4}>
          <StatCard title={t('w9Qc.peerReview.totalItems')} value={aggregation.total} icon={<ListChecks size={18} />} color="primary" />
          <StatCard title={t('w9Qc.peerReview.categoryCount')} value={categories.length} icon={<GitBranch size={18} />} color="info" />
          <StatCard title={t('w9Qc.peerReview.peerLinks')} value={defectStats?.totalLinks ?? 0} icon={<UsersRound size={18} />} color="success" />
          <StatCard title={t('w9Qc.peerReview.criticalCount')} value={aggregation.bySeverity.find((s) => s.severity === 'critical')?.count ?? 0} icon={<AlertTriangle size={18} />} color="error" />
        </StatCardGrid>
      )}

      <Space wrap>
        <Select value={categoryCode} onChange={setCategoryCode} style={{ width: 160 }} options={[{ value: 'all', label: t('w9Qc.peerReview.allCategory') }, ...categories.map((c) => ({ value: c.code, label: c.name }))]} />
        <Input prefix={<Search size={14} />} placeholder={t('w9Qc.peerReview.search')} value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ width: 220 }} allowClear />
        <Button icon={<RefreshCw size={14} />} onClick={load}>{t('w9Qc.refresh')}</Button>
      </Space>

      <StateView loading={loading} error={error} empty={!loading && !error && filtered.length === 0} onRetry={load} minHeight={240}>
        <DataTable<DefectItem> rowKey="id" columns={columns} dataSource={filtered} pagination={{ pageSize: 15, showSizeChanger: false }} />
      </StateView>
    </div>
  )
}

// ================= Tab: 报告质控任务 (report-qc-v2) =================

const QC_TASK_STATUS_META: Record<QcTaskStatus, { labelKey: string; color: string }> = {
  pending: { labelKey: 'w4a.qcTask.status.pending', color: toneToAntd('pending') },
  in_progress: { labelKey: 'w4a.qcTask.status.inProgress', color: toneToAntd('in_progress') },
  reviewing: { labelKey: 'w4a.qcTask.status.reviewing', color: toneToAntd('in_progress') },
  closed: { labelKey: 'w4a.qcTask.status.closed', color: toneToAntd('closed') },
}

const QC_GRADE_COLORS: Record<string, string> = { A: severityToAntd('success'), B: severityToAntd('info'), C: severityToAntd('warning'), D: severityToAntd('critical') }

function ReportQcTasksTab() {
  const [tasks, setTasks] = useState<QcTask[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const res = await reportQcV2Api.listTasks().catch(() => null)
    if (res?.success && res.data) setTasks(res.data)
    else { setTasks([]); setError(t('w4a.qcTask.loadFailed')) }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const summary = useMemo(() => {
    const withScore = tasks.filter((x) => x.totalScore !== undefined)
    const avg = withScore.length > 0 ? Math.round((withScore.reduce((a, x) => a + (x.totalScore ?? 0), 0) / withScore.length) * 10) / 10 : 0
    return {
      total: tasks.length,
      closed: tasks.filter((x) => x.status === 'closed').length,
      avg,
      defects: tasks.reduce((a, x) => a + (x.defects?.length ?? 0), 0),
    }
  }, [tasks])

  const columns: ColumnsType<QcTask> = [
    { title: t('w4a.qcTask.thId'), dataIndex: 'id', key: 'id', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: t('w4a.qcTask.thReport'), dataIndex: 'reportId', key: 'reportId', width: 150 },
    { title: t('w4a.qcTask.thPatient'), dataIndex: 'patientName', key: 'patientName', width: 90 },
    { title: t('w4a.qcTask.thModality'), dataIndex: 'modality', key: 'modality', width: 80 },
    { title: t('w4a.qcTask.thScore'), dataIndex: 'totalScore', key: 'totalScore', width: 80, sorter: (a, b) => (a.totalScore ?? 0) - (b.totalScore ?? 0), render: (v?: number) => (v === undefined ? '-' : v) },
    { title: t('w4a.qcTask.thGrade'), dataIndex: 'grade', key: 'grade', width: 70, render: (g?: string) => (g ? <Tag color={QC_GRADE_COLORS[g]}>{g}</Tag> : '-') },
    {
      title: t('w4a.qcTask.thStatus'), dataIndex: 'status', key: 'status', width: 100,
      render: (s: QcTaskStatus) => { const m = QC_TASK_STATUS_META[s]; return <Tag color={m.color}>{t(m.labelKey)}</Tag> },
    },
    { title: t('w4a.qcTask.thAssignee'), dataIndex: 'assigneeName', key: 'assigneeName', width: 100, render: (v?: string) => v ?? '-' },
    { title: t('w4a.qcTask.thDefects'), key: 'defects', width: 80, render: (_, r) => <Tag color={(r.defects?.length ?? 0) > 0 ? 'red' : 'default'}>{r.defects?.length ?? 0}</Tag> },
    { title: t('w4a.qcTask.thCreatedAt'), dataIndex: 'createdAt', key: 'createdAt', width: 110, render: (v: string) => fmtDate(v) },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <StatCardGrid columns={4}>
        <StatCard title={t('w4a.qcTask.thId')} value={summary.total} icon={<ListChecks size={18} />} color="primary" />
        <StatCard title={t('w4a.qcTask.status.closed')} value={summary.closed} icon={<CheckCircle2 size={18} />} color="success" />
        <StatCard title={t('w4a.qcTask.thScore')} value={summary.avg} icon={<Gauge size={18} />} color="info" />
        <StatCard title={t('w4a.qcTask.thDefects')} value={summary.defects} icon={<AlertTriangle size={18} />} color="warning" />
      </StatCardGrid>

      <Space wrap>
        <Button icon={<RefreshCw size={14} />} onClick={load}>{t('w4a.qcTask.refresh')}</Button>
      </Space>

      <StateView loading={loading} error={error} empty={!loading && !error && tasks.length === 0} onRetry={load} minHeight={240}>
        <DataTable<QcTask> rowKey="id" columns={columns} dataSource={tasks} pagination={{ pageSize: 15, showSizeChanger: false }} scroll={{ x: 1000 }} />
      </StateView>
    </div>
  )
}

// ================= Tab 6: 设备质控 =================

function EquipmentTab() {
  const [items, setItems] = useState<PhantomTestItem[]>([])
  const [records, setRecords] = useState<EquipmentQcRecord[]>([])
  const [stats, setStats] = useState<EquipmentQcStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modality, setModality] = useState<EquipmentModality | 'all'>('all')
  const [recordOpen, setRecordOpen] = useState(false)
  const [form] = Form.useForm()
  // [G005 W4B] 设备质控项详情 (GET /equipment-qc/items/:id)
  const [itemDetail, setItemDetail] = useState<PhantomTestItem | null>(null)
  const [itemDetailOpen, setItemDetailOpen] = useState(false)
  const [itemDetailLoading, setItemDetailLoading] = useState(false)

  const openItemDetail = async (id: string) => {
    setItemDetailOpen(true)
    setItemDetail(null)
    setItemDetailLoading(true)
    try {
      const res = await api.getEquipmentItem(id).catch(() => null)
      if (res?.success && res.data) setItemDetail(res.data)
      else message.error(t('w4b.eqc.loadFailed'))
    } finally {
      setItemDetailLoading(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    const [i, r, s] = await Promise.all([api.listEquipmentItems().catch(() => null), api.listEquipmentRecords().catch(() => null), api.getEquipmentStats().catch(() => null)])
    if (i?.success && i.data) setItems(i.data)
    if (r?.success && r.data) setRecords(r.data)
    if (s?.success && s.data) setStats(s.data)
    if (!s?.success) setError(t('w9Qc.equipment.loadFailed'))
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const createRecord = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const res = await api.createEquipmentRecord(values).catch(() => null)
    if (res?.success) { message.success(t('w9Qc.equipment.created')); setRecordOpen(false); form.resetFields(); void load() }
    else message.error(t('w9Qc.equipment.createFailed'))
  }

  const filtered = useMemo(() => modality === 'all' ? items : items.filter((i) => i.modality === modality), [items, modality])

  const itemColumns: ColumnsType<PhantomTestItem> = [
    { title: t('w9Qc.equipment.item'), dataIndex: 'name', key: 'name' },
    { title: t('w9Qc.equipment.modality'), dataIndex: 'modality', key: 'modality', width: 80 },
    { title: t('w9Qc.equipment.frequency'), dataIndex: 'frequency', key: 'frequency', width: 90, render: (v: QcFrequency) => FREQ_LABELS[v] },
    { title: t('w9Qc.equipment.standard'), dataIndex: 'standard', key: 'standard' },
    { title: t('w9Qc.equipment.threshold'), key: 'threshold', width: 120, render: (_, r) => `${r.threshold.op === 'lte' ? '≤' : r.threshold.op === 'gte' ? '≥' : '~'} ${r.threshold.limit}${r.threshold.limit2 ? `~${r.threshold.limit2}` : ''} ${r.threshold.unit}` },
    // [G005 W4B] 质控项详情 (GET /equipment-qc/items/:id)
    { title: t('w9Qc.actions'), key: 'detail', width: 90, render: (_, r) => <Button size="small" type="link" onClick={() => void openItemDetail(r.id)}>{t('w4b.eqc.view')}</Button> },
  ]

  const recordColumns: ColumnsType<EquipmentQcRecord> = [
    { title: t('w9Qc.equipment.device'), dataIndex: 'deviceName', key: 'deviceName' },
    { title: t('w9Qc.equipment.item'), dataIndex: 'testItemName', key: 'testItemName' },
    { title: t('w9Qc.equipment.value'), key: 'value', width: 100, render: (_, r) => `${r.value}${r.unit}` },
    { title: t('w9Qc.equipment.result'), key: 'passed', width: 90, render: (_, r) => <Tag color={r.passed ? 'green' : 'red'}>{r.passed ? t('w9Qc.equipment.pass') : t('w9Qc.equipment.fail')}</Tag> },
    { title: t('w9Qc.equipment.testedAt'), dataIndex: 'testedAt', key: 'testedAt', width: 110, render: (v: string) => fmtDate(v) },
    { title: t('w9Qc.equipment.tester'), dataIndex: 'testerName', key: 'testerName', width: 100 },
  ]

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      {stats && (
        <StatCardGrid columns={4}>
          <StatCard title={t('w9Qc.equipment.total')} value={stats.total} icon={<Stethoscope size={18} />} color="primary" />
          <StatCard title={t('w9Qc.equipment.passCount')} value={stats.passed} icon={<CheckCircle2 size={18} />} color="success" />
          <StatCard title={t('w9Qc.equipment.failCount')} value={stats.failed} icon={<XCircle size={18} />} color="error" />
          <StatCard title={t('w9Qc.equipment.passRate')} value={stats.passRate} suffix="%" icon={<Gauge size={18} />} color="warning" />
        </StatCardGrid>
      )}

      <Space wrap>
        <Select value={modality} onChange={(v) => setModality(v)} style={{ width: 140 }} options={[{ value: 'all', label: t('w9Qc.indicators.allCategory') }, ...(['CT', 'DR', 'MRI', 'MG'] as EquipmentModality[]).map((v) => ({ value: v, label: v }))]} />
        <Button type="primary" icon={<Play size={14} />} onClick={() => setRecordOpen(true)}>{t('w9Qc.equipment.record')}</Button>
        <Button icon={<RefreshCw size={14} />} onClick={load}>{t('w9Qc.refresh')}</Button>
      </Space>

      <StateView loading={loading} error={error} empty={!loading && !error && filtered.length === 0} onRetry={load} minHeight={240}>
        <Tabs
          items={[
            { key: 'items', label: t('w9Qc.equipment.tabItems'), children: <DataTable<PhantomTestItem> rowKey="id" columns={itemColumns} dataSource={filtered} pagination={{ pageSize: 20, showSizeChanger: false }} /> },
            { key: 'records', label: t('w9Qc.equipment.tabRecords'), children: <DataTable<EquipmentQcRecord> rowKey="id" columns={recordColumns} dataSource={records} pagination={{ pageSize: 15, showSizeChanger: false }} /> },
          ]}
        />
      </StateView>

      <Modal title={t('w9Qc.equipment.record')} open={recordOpen} onOk={createRecord} onCancel={() => setRecordOpen(false)} okText={t('w9Qc.save')}>
        <Form form={form} layout="vertical">
          <Form.Item name="modality" label={t('w9Qc.equipment.modality')} initialValue="CT" rules={[{ required: true }]}><Select options={(['CT', 'DR', 'MRI', 'MG'] as EquipmentModality[]).map((v) => ({ value: v }))} /></Form.Item>
          <Form.Item name="deviceId" label={t('w9Qc.equipment.device')} rules={[{ required: true }]}><Input placeholder="DEV-CT-01" /></Form.Item>
          <Form.Item name="testItemId" label={t('w9Qc.equipment.item')} rules={[{ required: true }]}><Select options={items.map((i) => ({ value: i.id, label: `${i.id} ${i.name}` }))} showSearch optionFilterProp="label" /></Form.Item>
          <Form.Item name="value" label={t('w9Qc.equipment.value')} rules={[{ required: true }]}><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="testerName" label={t('w9Qc.equipment.tester')} initialValue="王技师"><Input /></Form.Item>
        </Form>
      </Modal>

      {/* [G005 W4B] 质控项详情抽屉 (GET /equipment-qc/items/:id) */}
      <Drawer title={itemDetail ? `${t('w4b.eqc.detailTitle')} · ${itemDetail.id}` : t('w4b.eqc.detailTitle')} open={itemDetailOpen} onClose={() => setItemDetailOpen(false)} width={520}>
        {itemDetailLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : itemDetail ? (
          <DataTable
            rowKey="k"
            pagination={false}
            showHeader={false}
            columns={[
              { dataIndex: 'k', width: 140, render: (v: string) => <span style={{ color: '#64748b' }}>{v}</span> },
              { dataIndex: 'v' },
            ]}
            dataSource={[
              { k: t('w4b.eqc.thId'), v: itemDetail.id },
              { k: t('w4b.eqc.thName'), v: itemDetail.name },
              { k: t('w4b.eqc.thModality'), v: itemDetail.modality },
              { k: t('w4b.eqc.thFrequency'), v: FREQ_LABELS[itemDetail.frequency] },
              { k: t('w4b.eqc.thStandard'), v: itemDetail.standard },
              { k: t('w4b.eqc.thThreshold'), v: `${itemDetail.threshold.op === 'lte' ? '≤' : itemDetail.threshold.op === 'gte' ? '≥' : '~'} ${itemDetail.threshold.limit}${itemDetail.threshold.limit2 ? `~${itemDetail.threshold.limit2}` : ''} ${itemDetail.threshold.unit}` },
            ]}
          />
        ) : (
          <span style={{ color: '#94a3b8' }}>{t('w4b.eqc.loadFailed')}</span>
        )}
      </Drawer>
    </div>
  )
}

import { DataTable } from "../../components/common";