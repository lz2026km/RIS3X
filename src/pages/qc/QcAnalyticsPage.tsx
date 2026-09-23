/**
 * G005 RIS v3.0.6.11-101 Wave 8B - 报告质控闭环与趋势分析 (/qc/analytics)
 * 跨模块深化 (报告 V2 桥接):
 *   - 闭环面板: 缺陷池 → 整改任务 (派生) → 提交整改 → 复查验证 → 关闭 (PDCA 数字化闭环)
 *   - 趋势面板: 月度/周度缺陷率折线 + 缺陷类型帕累托 + 科室排名表 + KPI 卡
 * 数据源: qcAnalyticsApi (后端 /qc-analytics 或 MSW 演示回退, 响应带 source 徽标)
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  RefreshCw,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  Clock,
  CheckCircle2,
  Target,
  Bug,
  ListChecks,
  Database,
  HardDrive,
  PlayCircle,
  Send,
  SearchCheck,
  XCircle,
  Lock,
  Activity,
} from 'lucide-react'
import { Button, Tag, Space, Modal, Form, Input, Drawer, Popconfirm, message, Timeline, Empty, Table, Tabs, Radio, Progress, Tooltip as ATooltip } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend, Cell, ReferenceLine } from 'recharts'
import { PageContainer } from "../../components/common/PageContainer"
import { PageHeader } from "../../components/common/PageHeader"
import { ErrorBanner } from "../../components/feedback"
import { StatCard, StatCardGrid } from "../../components/common/StatCard"
import {
  qcAnalyticsApi,
  type DashboardData,
  type AnalyticsTrends,
  type ParetoItem,
  type DepartmentRankItem,
  type LoopDefect,
  type LoopStats,
  type RectificationItem,
  type LoopStatus,
} from '../../services/api/qcAnalyticsApi'
import { t } from '../../i18n/appI18n'

const LOOP_STATUS_META: Record<LoopStatus, { label: string; color: string }> = {
  open: { label: t('qcAnalytics.loopStatus.open'), color: 'orange' },
  rectifying: { label: t('qcAnalytics.loopStatus.rectifying'), color: 'blue' },
  rechecking: { label: t('qcAnalytics.loopStatus.rechecking'), color: 'purple' },
  closed: { label: t('qcAnalytics.loopStatus.closed'), color: 'green' },
}

const loopStatusLabel = (s: LoopStatus) => t(`qcAnalytics.loopStatus.${s}`)

const SEVERITY_COLORS: Record<string, string> = { high: 'red', medium: 'orange', low: 'default' }

const severityLabel = (s: string) => t(`qcAnalytics.severity.${s}`)
const sourceLabel = (s: string) => t(`qcAnalytics.source.${s}`)

const fmtDate = (s?: string) => (s ? s.slice(0, 10) : '-')

const TrendTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: number | string; color?: string }>; label?: string }) => {
  if (!active || !payload || payload.length === 0) return null
  return (
    <div style={{ background: 'rgba(15,23,42,0.92)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#e2e8f0' }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{p.value}{typeof p.value === 'number' ? '%' : ''}</span>
        </div>
      ))}
    </div>
  )
}

export default function QcAnalyticsPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const [trends, setTrends] = useState<AnalyticsTrends | null>(null)
  const [pareto, setPareto] = useState<ParetoItem[]>([])
  const [departments, setDepartments] = useState<DepartmentRankItem[]>([])
  const [defects, setDefects] = useState<LoopDefect[]>([])
  const [items, setItems] = useState<RectificationItem[]>([])
  const [loopStats, setLoopStats] = useState<LoopStats | null>(null)
  const [source, setSource] = useState<'database' | 'demo' | 'offline'>('demo')
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [period, setPeriod] = useState<'week' | 'month'>('month')

  // 闭环操作
  const [createDefect, setCreateDefect] = useState<LoopDefect | null>(null)
  const [createForm] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [fixing, setFixing] = useState<RectificationItem | null>(null)
  const [fixForm] = Form.useForm()
  const [rechecking, setRechecking] = useState<RectificationItem | null>(null)
  const [recheckForm] = Form.useForm()
  const [closing, setClosing] = useState<RectificationItem | null>(null)
  const [closeForm] = Form.useForm()
  const [detail, setDetail] = useState<RectificationItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [dashRes, trendRes, paretoRes, deptRes, defectRes, itemRes, statsRes] = await Promise.all([
      qcAnalyticsApi.getDashboard().catch(() => ({ success: false as const })),
      qcAnalyticsApi.getTrends(period).catch(() => ({ success: false as const })),
      qcAnalyticsApi.getPareto().catch(() => ({ success: false as const })),
      qcAnalyticsApi.getDepartments().catch(() => ({ success: false as const })),
      qcAnalyticsApi.listLoopDefects().catch(() => ({ success: false as const })),
      qcAnalyticsApi.listLoopItems().catch(() => ({ success: false as const })),
      qcAnalyticsApi.getLoopStats().catch(() => ({ success: false as const })),
    ])
    if (!dashRes.success && !trendRes.success && !itemRes.success) {
      setSource('offline')
      setLoadError(t('w9.states.error'))
      message.warning(t('qcAnalytics.serviceDown'))
      const demo = demoFallback()
      setDashboard(demo.dashboard)
      setTrends(demo.trends)
      setPareto(demo.pareto)
      setDepartments(demo.departments)
      setDefects(demo.defects)
      setItems(demo.items)
      setLoopStats(demo.loopStats)
      setLoading(false)
      return
    }
    if (dashRes.success && dashRes.data) {
      setDashboard(dashRes.data)
      setSource(dashRes.data.source)
    }
    if (trendRes.success && trendRes.data) setTrends(trendRes.data)
    if (paretoRes.success && paretoRes.data) setPareto(paretoRes.data.items)
    if (deptRes.success && deptRes.data) setDepartments(deptRes.data.data)
    if (defectRes.success && defectRes.data?.data) setDefects(defectRes.data.data)
    if (itemRes.success && itemRes.data?.data) setItems(itemRes.data.data)
    if (statsRes.success && statsRes.data?.data) setLoopStats(statsRes.data.data)
    setLoading(false)
  }, [period])

  useEffect(() => { void load() }, [load])

  // ── 闭环操作 ────────────────────────────────────────────────
  const openCreate = (d: LoopDefect) => {
    setCreateDefect(d)
    createForm.resetFields()
  }

  const handleCreate = async () => {
    if (!createDefect) return
    const values = await createForm.validateFields()
    setSaving(true)
    try {
      const res = await qcAnalyticsApi.createLoopItem({
        defectId: createDefect.id,
        title: values.title,
        assigneeName: values.assigneeName,
      })
      if (!res.success) throw new Error(res.error?.message ?? t('qcAnalytics.createFailed'))
      message.success(t('qcAnalytics.itemCreated'))
      setCreateDefect(null)
      void load()
    } catch (e) {
      message.error(e instanceof Error ? e.message : t('qcAnalytics.createFailed'))
    } finally {
      setSaving(false)
    }
  }

  const runItemAction = async (fn: () => Promise<{ success: boolean; error?: { message?: string } }>, okMsg: string) => {
    const res = await fn()
    if (!res.success) {
      message.error(res.error?.message ?? t('qcAnalytics.opFailed'))
      return false
    }
    message.success(okMsg)
    void load()
    return true
  }

  const openFix = (it: RectificationItem) => {
    setFixing(it)
    fixForm.resetFields()
  }

  const handleFix = async () => {
    if (!fixing) return
    const values = await fixForm.validateFields()
    await runItemAction(
      () => qcAnalyticsApi.submitFix(fixing.id, { note: values.note ?? '' }),
      t('qcAnalytics.fixSubmitted'),
    )
    setFixing(null)
  }

  const openRecheck = (it: RectificationItem) => {
    setRechecking(it)
    recheckForm.resetFields()
  }

  const handleRecheck = async () => {
    if (!rechecking) return
    const values = await recheckForm.validateFields()
    const ok = await runItemAction(
      () => qcAnalyticsApi.recheckItem(rechecking.id, { result: values.result, reviewer: values.reviewer, note: values.note ?? '' }),
      values.result === 'pass' ? t('qcAnalytics.recheckPassed') : t('qcAnalytics.recheckRejected'),
    )
    if (ok) setRechecking(null)
  }

  const openClose = (it: RectificationItem) => {
    setClosing(it)
    closeForm.resetFields()
  }

  const handleClose = async () => {
    if (!closing) return
    const values = await closeForm.validateFields()
    const ok = await runItemAction(
      () => qcAnalyticsApi.closeLoopItem(closing.id, { note: values.note ?? '' }),
      t('qcAnalytics.itemClosed'),
    )
    if (ok) setClosing(null)
  }

  const openDetail = async (it: RectificationItem) => {
    setDetailOpen(true)
    setDetail(it)
    const res = await qcAnalyticsApi.getLoopItem(it.id).catch(() => ({ success: false as const }))
    if (res.success && res.data) setDetail(res.data)
  }

  // ── 表格 ───────────────────────────────────────────────────
  const defectColumns: ColumnsType<LoopDefect> = [
    { title: t('qcAnalytics.thDefect'), dataIndex: 'message', key: 'message', ellipsis: true, render: (v: string, r) => (
      <Space direction="vertical" size={2}>
        <span style={{ fontWeight: 500 }}>{v}</span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.reportId} · {r.id}</span>
      </Space>
    ) },
    { title: t('qcAnalytics.thType'), dataIndex: 'typeLabel', key: 'typeLabel', width: 110, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
    { title: t('qcAnalytics.thDept'), dataIndex: 'department', key: 'department', width: 100 },
    { title: t('qcAnalytics.thSource'), dataIndex: 'source', key: 'source', width: 90, render: (v: string) => <Tag color={v === 'qc-v2' ? 'cyan' : v === 'manual' ? 'gold' : 'blue'}>{sourceLabel(v)}</Tag> },
    { title: t('qcAnalytics.thSeverity'), dataIndex: 'severity', key: 'severity', width: 80, render: (v: string) => <Tag color={SEVERITY_COLORS[v] ?? 'default'}>{severityLabel(v)}</Tag> },
    { title: t('qcAnalytics.thFoundAt'), dataIndex: 'discoveredAt', key: 'discoveredAt', width: 110, render: (v: string) => fmtDate(v) },
    { title: t('qcAnalytics.thStatus'), dataIndex: 'status', key: 'status', width: 90, render: (v: LoopStatus) => <Tag color={LOOP_STATUS_META[v]?.color}>{loopStatusLabel(v)}</Tag> },
    { title: t('qcAnalytics.thActions'), key: 'actions', width: 120, render: (_, r) => (
      <Button size="small" type="primary" ghost icon={<Target size={12} />} disabled={!!r.itemId} onClick={() => openCreate(r)}>
        {r.itemId ? t('qcAnalytics.createdTask') : t('qcAnalytics.createFix')}
      </Button>
    ) },
  ]

  const itemColumns: ColumnsType<RectificationItem> = [
    { title: t('qcAnalytics.thItem'), dataIndex: 'title', key: 'title', ellipsis: true, render: (v: string, r) => (
      <Space direction="vertical" size={2}>
        <span style={{ fontWeight: 500 }}>{v}</span>
        <span style={{ color: '#94a3b8', fontSize: 12 }}>{r.reportId} · {r.id}</span>
      </Space>
    ) },
    { title: t('qcAnalytics.thType'), dataIndex: 'typeLabel', key: 'typeLabel', width: 100, render: (v: string) => <Tag color="geekblue">{v}</Tag> },
    { title: t('qcAnalytics.thDept'), dataIndex: 'department', key: 'department', width: 90 },
    { title: t('qcAnalytics.thOwner'), dataIndex: 'assigneeName', key: 'assigneeName', width: 90 },
    { title: t('qcAnalytics.thStatus'), dataIndex: 'status', key: 'status', width: 90, render: (v: LoopStatus) => <Tag color={LOOP_STATUS_META[v]?.color}>{loopStatusLabel(v)}</Tag> },
    { title: t('qcAnalytics.thRounds'), dataIndex: 'recheckRounds', key: 'recheckRounds', width: 90, render: (v: number, r) => (
      <Space size={4}>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
        {r.recheckResult === 'fail' && <ATooltip title={r.recheckNote ?? t('qcAnalytics.lastRejectNote')}><Tag color="red">{t('qcAnalytics.rejected')}</Tag></ATooltip>}
      </Space>
    ) },
    { title: t('qcAnalytics.thUpdated'), dataIndex: 'updatedAt', key: 'updatedAt', width: 100, render: (v: string) => fmtDate(v) },
    { title: t('qcAnalytics.thActions'), key: 'actions', width: 320, render: (_, r) => (
      <Space size={4} wrap>
        {r.status === 'open' && (
          <Button size="small" icon={<PlayCircle size={12} />} onClick={() => void runItemAction(() => qcAnalyticsApi.startFix(r.id), t('qcAnalytics.startFix'))}>{t('qcAnalytics.start')}</Button>
        )}
        {r.status === 'rectifying' && (
          <Button size="small" type="primary" ghost icon={<Send size={12} />} onClick={() => openFix(r)}>{t('qcAnalytics.submitFix')}</Button>
        )}
        {r.status === 'rechecking' && (
          <Button size="small" icon={<SearchCheck size={12} />} onClick={() => openRecheck(r)}>{t('qcAnalytics.recheck')}</Button>
        )}
        {r.status !== 'closed' && (
          <Popconfirm title={t('qcAnalytics.closeConfirmTitle')} description={t('qcAnalytics.closeConfirmDesc')} onConfirm={() => void runItemAction(() => qcAnalyticsApi.closeLoopItem(r.id), t('qcAnalytics.itemClosed'))} okText={t('qcAnalytics.close')} cancelText={t('qcAnalytics.cancel')}>
            <Button size="small" icon={<Lock size={12} />}>{t('qcAnalytics.close')}</Button>
          </Popconfirm>
        )}
        <Button size="small" icon={<ListChecks size={12} />} onClick={() => void openDetail(r)}>{t('qcAnalytics.detail')}</Button>
      </Space>
    ) },
  ]

  const deptColumns: ColumnsType<DepartmentRankItem> = [
    { title: t('qcAnalytics.thRank'), key: 'rank', width: 60, render: (_, __, i) => {
      const color = i === 0 ? '#10b981' : i === 1 ? '#3b82f6' : i === 2 ? '#f59e0b' : '#94a3b8'
      return <span style={{ color, fontWeight: 700 }}>{i + 1}</span>
    } },
    { title: t('qcAnalytics.thDept'), dataIndex: 'department', key: 'department', render: (v: string, r) => (
      <Space>
        <span style={{ fontWeight: 500 }}>{v}</span>
        {r.defectRate < 100 && <Tag color="green">{t('qcAnalytics.excellent')}</Tag>}
      </Space>
    ) },
    { title: t('qcAnalytics.thReports'), dataIndex: 'reports', key: 'reports', width: 90, align: 'right' as const },
    { title: t('qcAnalytics.thDefects'), dataIndex: 'defects', key: 'defects', width: 90, align: 'right' as const },
    { title: t('qcAnalytics.thDefectRate'), dataIndex: 'defectRate', key: 'defectRate', width: 110, align: 'right' as const, render: (v: number, r) => (
      <Space size={8}>
        <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: v >= 130 ? '#dc2626' : v >= 100 ? '#d97706' : '#059669' }}>{v}%</span>
        <Progress percent={Math.min(100, Math.round(v))} showInfo={false} size="small" strokeColor={v >= 130 ? '#dc2626' : v >= 100 ? '#d97706' : '#10b981'} style={{ width: 60, margin: 0 }} />
      </Space>
    ) },
    { title: t('qcAnalytics.thTimelyRate'), dataIndex: 'timelyRate', key: 'timelyRate', width: 90, align: 'right' as const, render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}%</span> },
    { title: t('qcAnalytics.thQcRate'), dataIndex: 'qcRate', key: 'qcRate', width: 90, align: 'right' as const, render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}%</span> },
    { title: t('qcAnalytics.thAvgResponse'), dataIndex: 'avgResponseMinutes', key: 'avgResponseMinutes', width: 90, align: 'right' as const, render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{t('qcAnalytics.minUnit', { count: v })}</span> },
    { title: t('qcAnalytics.thAvgScore'), dataIndex: 'avgScore', key: 'avgScore', width: 80, align: 'right' as const, render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span> },
  ]

  // ── 图表数据 ────────────────────────────────────────────────
  const trendData = useMemo(() => trends?.points ?? [], [trends])
  const paretoData = useMemo(() => pareto.map((p) => ({ ...p })), [pareto])

  const statCards = useMemo(() => {
    const d = dashboard
    const last = trendData[trendData.length - 1]
    return [
      { label: t('qcAnalytics.kpiTotalReports'), value: d?.totalReports ?? 0, icon: <Activity size={20} />, color: '#3b82f6', sub: t('qcAnalytics.kpiQcCoverage', { count: d?.qcReports ?? 0 }) },
      { label: t('qcAnalytics.kpiQcRate'), value: d?.qcRate ?? 0, suffix: '%', icon: <ShieldCheck size={20} />, color: '#8b5cf6', sub: t('qcAnalytics.kpiQcCoverageDesc') },
      { label: t('qcAnalytics.kpiDefectRate'), value: d?.defectRate ?? 0, suffix: '%', icon: <AlertTriangle size={20} />, color: '#ef4444', sub: last && last.improvement !== null ? t('qcAnalytics.kpiImprove', { pct: Math.abs(last.improvement) }) + (last.improvement >= 0 ? ` (${t('qcAnalytics.improved')})` : ` (${t('qcAnalytics.worsened')})`) : t('qcAnalytics.kpiDefectSub') },
      { label: t('qcAnalytics.kpiTimelyRate'), value: d?.timelyRate ?? 0, suffix: '%', icon: <Clock size={20} />, color: '#10b981', sub: t('qcAnalytics.kpiTimelySub', { count: d?.avgResponseMinutes ?? 0 }) },
      { label: t('qcAnalytics.kpiAvgResponse'), value: d?.avgResponseMinutes ?? 0, suffix: t('qcAnalytics.minSuffix'), icon: <TrendingUp size={20} />, color: '#f59e0b', sub: t('qcAnalytics.kpiAvgScoreSub', { score: d?.avgScore ?? 0 }) },
      { label: t('qcAnalytics.kpiClosureRate'), value: d?.closureRate ?? 0, suffix: '%', icon: <CheckCircle2 size={20} />, color: '#06b6d4', sub: t('qcAnalytics.kpiClosedSub', { closed: d?.loopClosed ?? 0, total: (d?.loopOpen ?? 0) + (d?.loopClosed ?? 0) }) },
    ]
  }, [dashboard, trendData])

  const sourceBadge = source === 'database'
    ? <Tag icon={<Database size={12} />} color="green">{t('common.api.real')}</Tag>
    : source === 'demo'
      ? <Tag icon={<HardDrive size={12} />} color="orange">{t('common.api.demo')}</Tag>
      : <Tag color="red">{t('common.api.offline')}</Tag>

  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<ShieldCheck size={20} color="#3b82f6" />}
        title={t('qcAnalytics.title')}
        subtitle={t('qcAnalytics.subtitle')}
        actions={
          <Space>
            {sourceBadge}
            <Button size="small" icon={<RefreshCw size={12} />} loading={loading} onClick={() => void load()}>{t('qcAnalytics.refresh')}</Button>
          </Space>
        }
      />

      {loadError && <ErrorBanner message={loadError} onRetry={() => void load()} retryLabel={t('w9.states.retry')} />}

      <div style={{ padding: 24 }}>
        <StatCardGrid gap={12}>
          {statCards.map((s, i) => (
            <StatCard key={i} title={s.label} value={s.value} suffix={s.suffix} icon={s.icon} color={s.color} sub={s.sub} />
          ))}
        </StatCardGrid>

        {/* 趋势面板 */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Space size={8}>
              <TrendingUp size={16} color="#3b82f6" />
              <b>{t('qcAnalytics.trendTitle')}</b>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('qcAnalytics.trendSub')}</span>
            </Space>
            <Segmented period={period} onChange={setPeriod} />
          </div>
          <div style={{ height: 300 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trendData} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="rate" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" domain={[0, 100]} hide />
                <RTooltip content={<TrendTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line yAxisId="rate" type="monotone" dataKey="defectRate" name={t('qcAnalytics.defectRate')} stroke="#ef4444" strokeWidth={2.5} dot={{ r: 3 }} />
                <Line yAxisId="rate" type="monotone" dataKey="timelyRate" name={t('qcAnalytics.timelyRate')} stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                <Line yAxisId="rate" type="monotone" dataKey="qcRate" name={t('qcAnalytics.qcRate')} stroke="#8b5cf6" strokeWidth={2} strokeDasharray="6 3" dot={{ r: 3 }} />
                <ReferenceLine yAxisId="rate" y={100} stroke="#e2e8f0" strokeDasharray="4 4" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 帕累托 + 科室排名 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
            <Space size={8} style={{ marginBottom: 12 }}>
              <Bug size={16} color="#ef4444" />
              <b>{t('qcAnalytics.paretoTitle')}</b>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('qcAnalytics.paretoSub')}</span>
            </Space>
            <div style={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={paretoData} margin={{ top: 8, right: 0, bottom: 0, left: -16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis yAxisId="bar" tick={{ fontSize: 12 }} />
                  <YAxis yAxisId="line" orientation="right" domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                  <RTooltip content={<TrendTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="bar" dataKey="count" name={t('qcAnalytics.defectCount')} radius={[4, 4, 0, 0]}>
                    {paretoData.map((p) => <Cell key={p.code} fill={p.isMain ? '#ef4444' : '#93c5fd'} />)}
                  </Bar>
                  <Line yAxisId="line" type="monotone" dataKey="cumulativePercent" name={t('qcAnalytics.cumulativePct')} stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16 }}>
            <Space size={8} style={{ marginBottom: 12 }}>
              <Target size={16} color="#3b82f6" />
              <b>{t('qcAnalytics.deptRankTitle')}</b>
              <span style={{ color: '#94a3b8', fontSize: 12 }}>{t('qcAnalytics.deptRankSub')}</span>
            </Space>
            <Table<DepartmentRankItem>
              rowKey="department"
              size="small"
              columns={deptColumns}
              dataSource={departments}
              pagination={false}
              scroll={{ x: 760 }}
            />
          </div>
        </div>

        {/* 闭环面板 */}
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 16, marginTop: 16 }}>
          <Space size={8} style={{ marginBottom: 12 }}>
            <CheckCircle2 size={16} color="#10b981" />
            <b>{t('qcAnalytics.loopTitle')}</b>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>
              {t('qcAnalytics.loopSub', { open: loopStats?.openDefects ?? 0, days: loopStats?.avgDaysToClose ?? 0, rounds: loopStats?.avgRecheckRounds ?? 0 })}
            </span>
          </Space>
          <Tabs
            defaultActiveKey="defects"
            items={[
              {
                key: 'defects',
                label: t('qcAnalytics.tabDefects', { count: defects.length }),
                children: (
                  <Table<LoopDefect>
                    rowKey="id"
                    loading={loading}
                    columns={defectColumns}
                    dataSource={defects}
                    pagination={{ pageSize: 6, showTotal: (total: number) => t('qcAnalytics.totalDefects', { count: total }) }}
                    scroll={{ x: 960 }}
                    locale={{ emptyText: <Empty description={t('qcAnalytics.emptyDefects')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    size="middle"
                  />
                ),
              },
              {
                key: 'items',
                label: t('qcAnalytics.tabItems', { count: items.length }),
                children: (
                  <Table<RectificationItem>
                    rowKey="id"
                    loading={loading}
                    columns={itemColumns}
                    dataSource={items}
                    pagination={{ pageSize: 6, showTotal: (total: number) => t('qcAnalytics.totalItems', { count: total }) }}
                    scroll={{ x: 1080 }}
                    locale={{ emptyText: <Empty description={t('qcAnalytics.emptyItems')} image={Empty.PRESENTED_IMAGE_SIMPLE} /> }}
                    size="middle"
                  />
                ),
              },
            ]}
          />
        </div>
      </div>

      {/* 创建整改任务 */}
      <Modal
        title={t('qcAnalytics.createTitle')}
        open={!!createDefect}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateDefect(null)}
        confirmLoading={saving}
        okText={t('qcAnalytics.createOk')}
        cancelText={t('qcAnalytics.cancel')}
        destroyOnClose
      >
        {createDefect && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '10px 12px', fontSize: 13, marginBottom: 12, color: '#7f1d1d' }}>
            <Space size={6}><Bug size={13} /> {createDefect.message}</Space>
            <div style={{ color: '#94a3b8', fontSize: 12, marginTop: 4 }}>{createDefect.reportId} · {createDefect.department} · {sourceLabel(createDefect.source)}</div>
          </div>
        )}
        <Form form={createForm} layout="vertical" preserve={false} initialValues={{ assigneeName: '王质控员' }}>
          <Form.Item name="title" label={t('qcAnalytics.fldTitle')} rules={[{ required: true, message: t('qcAnalytics.fldTitleRequired') }]}>
            <Input placeholder={t('qcAnalytics.fldTitlePlaceholder')} maxLength={60} />
          </Form.Item>
          <Form.Item name="assigneeName" label={t('qcAnalytics.fldAssignee')}>
            <Input placeholder={t('qcAnalytics.fldAssigneePlaceholder')} maxLength={20} />
          </Form.Item>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>{t('qcAnalytics.createHint')}</div>
        </Form>
      </Modal>

      {/* 提交整改 */}
      <Modal
        title={t('qcAnalytics.fixTitle')}
        open={!!fixing}
        onOk={() => void handleFix()}
        onCancel={() => setFixing(null)}
        okText={t('qcAnalytics.submit')}
        cancelText={t('qcAnalytics.cancel')}
        destroyOnClose
      >
        <Form form={fixForm} layout="vertical" preserve={false}>
          <Form.Item name="note" label={t('qcAnalytics.fldFixNote')} rules={[{ required: true, message: t('qcAnalytics.fldFixNoteRequired') }]}>
            <Input.TextArea rows={4} placeholder={t('qcAnalytics.fldFixNotePlaceholder')} maxLength={300} />
          </Form.Item>
          <div style={{ color: '#94a3b8', fontSize: 12 }}>{t('qcAnalytics.fixHint')}</div>
        </Form>
      </Modal>

      {/* 复查验证 */}
      <Modal
        title={t('qcAnalytics.recheckTitle')}
        open={!!rechecking}
        onOk={() => void handleRecheck()}
        onCancel={() => setRechecking(null)}
        okText={t('qcAnalytics.recheckOk')}
        cancelText={t('qcAnalytics.cancel')}
        destroyOnClose
      >
        {rechecking?.recheckResult === 'fail' && (
          <div style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#7f1d1d', marginBottom: 12 }}>
            {t('qcAnalytics.lastRejected', { note: rechecking.recheckNote })}
          </div>
        )}
        <Form form={recheckForm} layout="vertical" preserve={false} initialValues={{ result: 'pass', reviewer: '张质控' }}>
          <Form.Item name="result" label={t('qcAnalytics.fldResult')} rules={[{ required: true }]}>
            <Radio.Group>
              <Radio.Button value="pass"><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> {t('qcAnalytics.passClose')}</Radio.Button>
              <Radio.Button value="fail"><XCircle size={13} style={{ verticalAlign: -2 }} /> {t('qcAnalytics.failRetry')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="reviewer" label={t('qcAnalytics.fldReviewer')} rules={[{ required: true, message: t('qcAnalytics.fldReviewerRequired') }]}>
            <Input maxLength={20} />
          </Form.Item>
          <Form.Item name="note" label={t('qcAnalytics.fldReviewNote')}>
            <Input.TextArea rows={3} placeholder={t('qcAnalytics.fldReviewNotePlaceholder')} maxLength={300} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 直接关闭 */}
      <Modal
        title={t('qcAnalytics.closeTitle')}
        open={!!closing}
        onOk={() => void handleClose()}
        onCancel={() => setClosing(null)}
        okText={t('qcAnalytics.closeOk')}
        cancelText={t('qcAnalytics.cancel')}
        destroyOnClose
      >
        <Form form={closeForm} layout="vertical" preserve={false}>
          <Form.Item name="note" label={t('qcAnalytics.fldCloseNote')}>
            <Input.TextArea rows={3} placeholder={t('qcAnalytics.fldCloseNotePlaceholder')} maxLength={200} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 任务详情 */}
      <Drawer
        title={detail ? `${detail.title} — ${loopStatusLabel(detail.status)}` : t('qcAnalytics.detailTitle')}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={560}
        extra={sourceBadge}
      >
        {detail && (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
              <Space size={6} wrap>
                <Tag color="geekblue">{detail.typeLabel}</Tag>
                <Tag color={SEVERITY_COLORS[detail.severity] ?? 'default'}>{t('qcAnalytics.severityLabel', { level: severityLabel(detail.severity) })}</Tag>
                <Tag color={detail.source === 'qc-v2' ? 'cyan' : 'blue'}>{sourceLabel(detail.source)}</Tag>
                <Tag color={LOOP_STATUS_META[detail.status]?.color}>{loopStatusLabel(detail.status)}</Tag>
              </Space>
              <div style={{ marginTop: 10, color: '#475569', fontSize: 13, lineHeight: 1.8 }}>
                <div><b>{t('qcAnalytics.fldReport')}</b> {detail.reportId} · <b>{t('qcAnalytics.fldDept')}</b> {detail.department}</div>
                <div><b>{t('qcAnalytics.fldOwner')}</b> {detail.assigneeName} · <b>{t('qcAnalytics.fldCreated')}</b> {fmtDate(detail.createdAt)}{detail.closedAt ? t('qcAnalytics.closedAt', { date: fmtDate(detail.closedAt) }) : ''}</div>
                {detail.fixNote && <div><b>{t('qcAnalytics.fldFixNote2')}</b> {detail.fixNote}</div>}
                {detail.recheckNote && <div style={{ color: detail.recheckResult === 'fail' ? '#dc2626' : '#059669' }}><b>{t('qcAnalytics.fldRecheckNote')}</b> {detail.recheckNote}{t('qcAnalytics.rounds', { count: detail.recheckRounds })}</div>}
              </div>
            </div>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 14 }}>
              <b style={{ display: 'block', marginBottom: 12 }}>{t('qcAnalytics.historyTitle')}</b>
              {detail.history.length === 0 ? (
                <Empty description={t('qcAnalytics.noHistory')} image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <Timeline
                  items={detail.history.map((h) => ({
                    color: h.action === 'closed' || h.action === 'rechecked' ? (detail.recheckResult === 'fail' && h.action === 'rechecked' ? 'red' : 'green') : 'blue',
                    children: (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: 13 }}>{h.note}</div>
                          <div style={{ color: '#94a3b8', fontSize: 11, marginTop: 2 }}>{h.actor}</div>
                        </div>
                        <span style={{ color: '#94a3b8', fontSize: 11, flexShrink: 0 }}>{fmtDate(h.at)}</span>
                      </div>
                    ),
                  }))}
                />
              )}
            </div>
          </Space>
        )}
      </Drawer>
    </PageContainer>
  )
}

// ── 离线回退: 确定性演示数据 (后端与 MSW 均不可达时兜底) ──────────────────
const Segmented = ({ period, onChange }: { period: 'week' | 'month'; onChange: (p: 'week' | 'month') => void }) => (
  <Space size={4}>
    {(['month', 'week'] as const).map((p) => (
      <Button
        key={p}
        size="small"
        type={period === p ? 'primary' : 'default'}
        onClick={() => onChange(p)}
        style={{ padding: '0 12px' }}
      >
        {p === 'month' ? t('qcAnalytics.periodMonth') : t('qcAnalytics.periodWeek')}
      </Button>
    ))}
  </Space>
)

const demoFallback = () => {
  const mkTrend = (bucket: string, reports: number, defects: number, timely: number, prevRate?: number | null): NonNullable<AnalyticsTrends>['points'][number] => {
    const defectRate = Math.round((defects / reports) * 1000) / 10
    const timelyRate = Math.round((timely / reports) * 1000) / 10
    const improvement = prevRate === undefined ? null : prevRate !== null && prevRate > 0 ? Math.round(((prevRate - defectRate) / prevRate) * 1000) / 10 : null
    return { bucket, label: bucket, reports, qcReports: Math.round(reports * 0.75), qcRate: 75, defects, defectRate, timely, timelyRate, avgResponseMinutes: 52, improvement }
  }
  const points = [
    mkTrend('2026-04', 44, 58, 35),
    mkTrend('2026-05', 46, 63, 36, 131.8),
    mkTrend('2026-06', 45, 58, 35, 137),
    mkTrend('2026-07', 46, 55, 37, 128.9),
    mkTrend('2026-08', 21, 24, 17, 119.6),
  ]
  return {
    dashboard: {
      source: 'demo', generatedAt: new Date().toISOString(),
      totalReports: 202, qcReports: 152, qcRate: 75.2, totalDefects: 258, defectRate: 127.7,
      timelyReports: 160, timelyRate: 79.2, avgResponseMinutes: 52.4, avgScore: 81.3,
      loopOpen: 4, loopClosed: 2, closureRate: 33.3,
    } as DashboardData,
    trends: { source: 'demo', generatedAt: new Date().toISOString(), period: 'month', points } as AnalyticsTrends,
    pareto: [
      { code: 'terminology', label: '术语不规范', count: 62, cumulativeCount: 62, cumulativePercent: 24, isMain: true },
      { code: 'missing_field', label: '必填字段缺失', count: 51, cumulativeCount: 113, cumulativePercent: 43.8, isMain: true },
      { code: 'duplicate', label: '重复表述', count: 43, cumulativeCount: 156, cumulativePercent: 60.5, isMain: true },
      { code: 'structure', label: '结构不完整', count: 38, cumulativeCount: 194, cumulativePercent: 75.2, isMain: true },
      { code: 'numeric_reasonability', label: '数值不合理', count: 25, cumulativeCount: 219, cumulativePercent: 84.9, isMain: false },
      { code: 'unit', label: '单位缺失', count: 17, cumulativeCount: 236, cumulativePercent: 91.5, isMain: false },
      { code: 'length_range', label: '长度异常', count: 14, cumulativeCount: 250, cumulativePercent: 96.9, isMain: false },
      { code: 'critical', label: '危急提示缺失', count: 8, cumulativeCount: 258, cumulativePercent: 100, isMain: false },
    ] as ParetoItem[],
    departments: [
      { department: '乳腺影像', reports: 26, defects: 18, defectRate: 69.2, timelyRate: 84.6, avgResponseMinutes: 47, qcRate: 76.9, avgScore: 85 },
      { department: '超声科', reports: 25, defects: 21, defectRate: 84, timelyRate: 80, avgResponseMinutes: 49, qcRate: 72, avgScore: 83 },
      { department: '放射科二区', reports: 26, defects: 26, defectRate: 100, timelyRate: 80.8, avgResponseMinutes: 51, qcRate: 73.1, avgScore: 82 },
      { department: '核医学科', reports: 25, defects: 30, defectRate: 120, timelyRate: 76, avgResponseMinutes: 53, qcRate: 76, avgScore: 80 },
      { department: '神经影像', reports: 25, defects: 32, defectRate: 128, timelyRate: 76, avgResponseMinutes: 54, qcRate: 76, avgScore: 80 },
      { department: '介入科', reports: 25, defects: 35, defectRate: 140, timelyRate: 80, avgResponseMinutes: 55, qcRate: 76, avgScore: 79 },
      { department: '放射科一区', reports: 25, defects: 39, defectRate: 156, timelyRate: 76, avgResponseMinutes: 56, qcRate: 76, avgScore: 79 },
      { department: '急诊影像', reports: 25, defects: 57, defectRate: 228, timelyRate: 80, avgResponseMinutes: 52, qcRate: 72, avgScore: 76 },
    ] as DepartmentRankItem[],
    defects: [
      { id: 'qcd-d1', code: 'terminology', typeLabel: '术语不规范', reportId: 'RPT-D-001', department: '放射科一区', severity: 'medium', source: 'rules-engine', message: '诊断结论存在模糊表述 3 处', discoveredAt: '2026-08-11T02:00:00.000Z', status: 'open' },
      { id: 'qcd-d2', code: 'structure', typeLabel: '结构不完整', reportId: 'RPT-D-002', department: '超声科', severity: 'medium', source: 'qc-v2', message: '影像所见与结论结构不完整', discoveredAt: '2026-08-12T03:00:00.000Z', status: 'open' },
      { id: 'qcd-d3', code: 'missing_field', typeLabel: '必填字段缺失', reportId: 'RPT-D-003', department: '介入科', severity: 'high', source: 'rules-engine', message: 'CTA 报告缺少对比剂剂量字段', discoveredAt: '2026-08-13T01:00:00.000Z', status: 'open' },
    ] as LoopDefect[],
    items: [
      { id: 'it-d1', defectId: 'qcd-d1', defectCode: 'terminology', typeLabel: '术语不规范', reportId: 'RPT-D-001', department: '放射科一区', severity: 'medium', source: 'rules-engine', title: '术语规范整改', assignee: 'u-102', assigneeName: '王质控员', status: 'rectifying', createdAt: '2026-08-12T02:00:00.000Z', updatedAt: '2026-08-14T02:00:00.000Z', recheckRounds: 0, history: [{ at: '2026-08-12T02:00:00.000Z', action: 'created', actor: '系统', note: '由缺陷派生整改任务' }] },
      { id: 'it-d2', defectId: 'qcd-d2', defectCode: 'structure', typeLabel: '结构不完整', reportId: 'RPT-D-002', department: '超声科', severity: 'medium', source: 'qc-v2', title: '报告结构整改', assignee: 'u-103', assigneeName: '李质控员', status: 'open', createdAt: '2026-08-13T03:00:00.000Z', updatedAt: '2026-08-13T03:00:00.000Z', recheckRounds: 0, history: [{ at: '2026-08-13T03:00:00.000Z', action: 'created', actor: '系统', note: '由缺陷派生整改任务' }] },
    ] as RectificationItem[],
    loopStats: { total: 2, byStatus: { open: 1, rectifying: 1, rechecking: 0, closed: 0 }, closureRate: 0, avgDaysToClose: 0, avgRecheckRounds: 0, openDefects: 2 } as LoopStats,
  }
}
