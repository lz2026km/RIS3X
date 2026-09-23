// ════════════════════════════════════════════════════════════════════════════
// [G005 v3.0.6.11-100 Wave 4A] 自定义报表中心 (CustomReportPage) 独立完整版
//   - 报表定义列表: 名称/类别/周期/数据源徽标/字段/定时/状态 Tag + 最近运行时间 + 订阅推送状态
//   - 「新建报表」向导式 Modal: 基础信息 → 字段多选(fields-catalog 分组) → 周期+数据源 → 排序/分组
//   - 行操作: 运行(→结果) / 查看结果 Modal(列+行+导出 CSV) / 历史 Drawer(时间/行数/状态/推送记录)
//            / 设置定时(周期+订阅人→推送通知) / 编辑 / 删除
//   - 「定时报表」筛选 Tab + 搜索 + 状态统计卡
//   - API: customReportApi (/custom-reports/*)
// ════════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useMemo, useState } from 'react'
import dayjs from 'dayjs'
import { t } from '../../i18n/appI18n'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { ErrorBanner } from '../../components/feedback'
import { ProTable, ProColumn } from '../../components/data/ProTable'
import {
  FileSpreadsheet, Plus, Play, Table2, History, Clock, FileDown, Pencil, Trash2,
  Search, RefreshCw, LayoutGrid, ArrowUpDown, BellRing,
  CalendarRange, CheckCircle2, XCircle,
} from 'lucide-react'
import {
  Card, Tag, Button, Modal, Input, Select, Radio, Tabs, message, Space, Alert,
  Spin, Empty, Drawer, Typography, Steps, Tooltip,
} from 'antd'
import {
  customReportApi,
  CustomReportDef,
  CustomReportField,
  ReportRunResult,
  RunHistoryEntry,
} from '../../services/api/customReportApi'

const { Text } = Typography

const PERIOD_LABELS: Record<string, string> = { daily: t('customReport.periodDaily'), weekly: t('customReport.periodWeekly'), monthly: t('customReport.periodMonthly'), quarterly: t('customReport.periodQuarterly'), yearly: t('customReport.periodYearly') }

const DS_BADGES: Record<string, { color: string; label: string }> = {
  olap: { color: 'blue', label: 'OLAP' },
  stats: { color: 'green', label: 'STATS' },
  bi: { color: 'purple', label: 'BI' },
  mixed: { color: 'orange', label: t('customReport.dsMixed') },
}

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  idle: { color: 'default', label: t('customReport.statusIdle') },
  running: { color: 'processing', label: t('customReport.statusRunning') },
  ready: { color: 'success', label: t('customReport.statusReady') },
  failed: { color: 'error', label: t('customReport.statusFailed') },
}

const SCHEDULE_OPTIONS = [
  { label: t('customReport.schDaily8'), value: 'daily: 08:00' },
  { label: t('customReport.schDaily20'), value: 'daily: 20:00' },
  { label: t('customReport.schWeeklyMon8'), value: 'weekly: 周一 08:00' },
  { label: t('customReport.schWeeklySun18'), value: 'weekly: 周日 18:00' },
  { label: t('customReport.schMonthly1'), value: 'monthly: 每月1日 09:00' },
  { label: t('customReport.schQuarterly'), value: 'quarterly: 季度首日 09:00' },
  { label: t('customReport.schYearly'), value: 'yearly: 1月1日 09:00' },
]

const DATA_SOURCE_OPTIONS = [
  { label: t('customReport.dsOlap'), value: 'olap' },
  { label: t('customReport.dsStats'), value: 'stats' },
  { label: t('customReport.dsBi'), value: 'bi' },
  { label: t('customReport.dsMixed'), value: 'mixed' },
]

const RECIPIENT_OPTIONS = [
  { label: t('customReport.rcCurrent'), value: 'current' },
  { label: t('customReport.rcDirector'), value: 'D002' },
  { label: t('customReport.rcQcLead'), value: 'D003' },
  { label: t('customReport.rcWang'), value: 'D1002' },
  { label: t('customReport.rcLi'), value: 'D1001' },
  { label: t('customReport.rcZhao'), value: 'T1005' },
]

// ── 字段目录分组 (olap 指标/维度 / stats / bi) ─────────────────────────────
function groupCatalog(catalog: CustomReportField[]) {
  const groups: Array<{ label: string; options: Array<{ label: string; value: string }> }> = []
  for (const source of ['olap', 'stats', 'bi'] as const) {
    const kindLabel = source === 'olap' ? t('customReport.kindOlap') : source === 'stats' ? t('customReport.dsStats') : t('customReport.dsBi')
    const items = catalog.filter((f) => f.source === source)
    if (items.length === 0) continue
    const opts = items.map((f) => ({
      label: `${f.name}${f.unit ? ` (${f.unit})` : ''}${f.kind === 'dimension' ? ` ${t('customReport.dimensionSuffix')}` : ''}`,
      value: f.id,
    }))
    groups.push({ label: kindLabel, options: opts })
  }
  return groups
}

// ── 向导表单类型 ────────────────────────────────────────────────────────────
interface WizardForm {
  name: string
  category: string
  description: string
  fields: string[]
  period: string
  dataSource: string
  sortBy: string | null
  sortOrder: 'asc' | 'desc' | null
  groupBy: string | null
}

const EMPTY_FORM: WizardForm = {
  name: '',
  category: t('customReport.defaultCategory'),
  description: '',
  fields: ['exam_count', 'report_count'],
  period: 'monthly',
  dataSource: 'olap',
  sortBy: null,
  sortOrder: null,
  groupBy: null,
}

const WIZARD_STEPS = [t('customReport.stepBasic'), t('customReport.stepFields'), t('customReport.stepPeriod'), t('customReport.stepSort')]

export default function CustomReportPage() {
  const [defs, setDefs] = useState<CustomReportDef[]>([])
  const [catalog, setCatalog] = useState<CustomReportField[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filterTab, setFilterTab] = useState<'all' | 'scheduled'>('all')
  const [search, setSearch] = useState('')

  // 向导 Modal
  const [wizardOpen, setWizardOpen] = useState(false)
  const [editing, setEditing] = useState<CustomReportDef | null>(null)
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<WizardForm>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)

  // 结果 / 历史 / 定时
  const [resultDef, setResultDef] = useState<CustomReportDef | null>(null)
  const [result, setResult] = useState<ReportRunResult | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)
  const [historyDef, setHistoryDef] = useState<CustomReportDef | null>(null)
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scheduleDef, setScheduleDef] = useState<CustomReportDef | null>(null)
  const [scheduleText, setScheduleText] = useState('')
  const [recipients, setRecipients] = useState<string[]>(['current'])

  const loadAll = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    const [d, c] = await Promise.allSettled([
      customReportApi.list(),
      customReportApi.getFieldsCatalog(),
    ])
    if (d.status === 'fulfilled' && d.value.success && Array.isArray(d.value.data)) setDefs(d.value.data)
    if (c.status === 'fulfilled' && c.value.success && Array.isArray(c.value.data)) setCatalog(c.value.data)
    const ok = (r: PromiseSettledResult<{ success: boolean }>): boolean => r.status === 'fulfilled' && r.value.success
    if (!ok(d) && !ok(c)) setLoadError(t('w9.states.error'))
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const fieldGroups = useMemo(() => groupCatalog(catalog), [catalog])

  const filteredDefs = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return defs.filter((d) => {
      if (filterTab === 'scheduled' && !d.schedule) return false
      if (!kw) return true
      return (
        d.name.toLowerCase().includes(kw) ||
        d.category.toLowerCase().includes(kw) ||
        d.description.toLowerCase().includes(kw)
      )
    })
  }, [defs, filterTab, search])

  const stats = useMemo(() => {
    return {
      total: defs.length,
      scheduled: defs.filter((d) => d.schedule).length,
      ready: defs.filter((d) => d.status === 'ready').length,
      failed: defs.filter((d) => d.status === 'failed').length,
    }
  }, [defs])

  const catalogName = useCallback((id: string) => catalog.find((c) => c.id === id)?.name ?? id, [catalog])

  // ── 向导 ──────────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditing(null)
    setForm({ ...EMPTY_FORM })
    setStep(0)
    setWizardOpen(true)
  }

  const openEdit = (def: CustomReportDef) => {
    setEditing(def)
    setForm({
      name: def.name,
      category: def.category,
      description: def.description,
      fields: [...def.fields],
      period: def.period,
      dataSource: def.dataSource,
      sortBy: def.sortBy ?? null,
      sortOrder: def.sortOrder ?? null,
      groupBy: def.groupBy ?? null,
    })
    setStep(0)
    setWizardOpen(true)
  }

  const canNext = useMemo(() => {
    if (step === 0) return form.name.trim().length > 0
    if (step === 1) return form.fields.length > 0
    return true
  }, [step, form.name, form.fields])

  const handleWizardOk = async () => {
    if (!form.name.trim()) {
      message.warning(t('customReport.enterReportName'))
      setStep(0)
      return
    }
    if (form.fields.length === 0) {
      message.warning(t('customReport.selectAtLeastOneField'))
      setStep(1)
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description,
        fields: form.fields,
        period: form.period,
        dataSource: form.dataSource,
        sortBy: form.sortBy,
        sortOrder: form.sortOrder,
        groupBy: form.groupBy,
      }
      const res = editing
        ? await customReportApi.update(editing.id, payload)
        : await customReportApi.create(payload)
      if (!res.success) {
        message.warning(res.error?.message ?? t('customReport.saveFailed'))
        return
      }
      message.success(editing ? t('customReport.reportUpdated', { name: form.name }) : t('customReport.reportCreated', { name: form.name }))
      setWizardOpen(false)
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? t('customReport.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const fieldSortOptions = useMemo(
    () => form.fields.filter((f) => catalog.find((c) => c.id === f)?.kind === 'measure').map((f) => ({ label: catalogName(f), value: f })),
    [form.fields, catalog, catalogName],
  )

  // ── 行操作 ────────────────────────────────────────────────────────────────
  const handleRun = async (def: CustomReportDef) => {
    setRunningId(def.id)
    try {
      const res = await customReportApi.run(def.id)
      if (!res.success || !res.data) {
        message.warning(res.error?.message ?? t('customReport.runFailed'))
        return
      }
      setResult(res.data)
      setResultDef(def)
      if (def.schedule && def.recipients.length > 0) {
        message.success(t('customReport.runDonePushed', { name: def.name, count: def.recipients.length }))
      } else {
        message.success(t('customReport.runDoneRows', { name: def.name, count: res.data.rows.length }))
      }
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? t('customReport.runFailed'))
      void loadAll()
    } finally {
      setRunningId(null)
    }
  }

  const openResult = async (def: CustomReportDef) => {
    setResultDef(def)
    setResult(null)
    setResultLoading(true)
    const res = await customReportApi.getResult(def.id)
    if (res.success && res.data) {
      setResult(res.data)
    } else {
      message.warning(res.error?.message ?? t('customReport.noResultRunFirst'))
    }
    setResultLoading(false)
  }

  const openHistory = async (def: CustomReportDef) => {
    setHistoryDef(def)
    setHistory([])
    setHistoryLoading(true)
    const res = await customReportApi.getHistory(def.id)
    if (res.success && Array.isArray(res.data)) setHistory(res.data)
    setHistoryLoading(false)
  }

  const openSchedule = (def: CustomReportDef) => {
    setScheduleDef(def)
    setScheduleText(def.schedule ?? 'weekly: 周一 08:00')
    setRecipients(def.recipients.length > 0 ? [...def.recipients] : ['current'])
  }

  const handleSaveSchedule = async () => {
    if (!scheduleDef) return
    if (!scheduleText.trim()) {
      message.warning(t('customReport.selectScheduleRule'))
      return
    }
    if (recipients.length === 0) {
      message.warning(t('customReport.selectAtLeastOneRecipient'))
      return
    }
    setSaving(true)
    try {
      const res = await customReportApi.setSchedule(scheduleDef.id, { schedule: scheduleText, recipients })
      if (!res.success) {
        message.warning(res.error?.message ?? t('customReport.scheduleFailed'))
        return
      }
      message.success(t('customReport.scheduleSaved', { name: scheduleDef.name, count: res.data?.notified?.count ?? 1 }))
      setScheduleDef(null)
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? t('customReport.scheduleFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (def: CustomReportDef) => {
    try {
      const res = await customReportApi.exportCsv(def.id)
      if (!res.success || !res.data) {
        message.warning(res.error?.message ?? t('customReport.noResultExport'))
        return
      }
      const blob = res.data as unknown as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `custom-report-${def.id}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('customReport.csvExportSuccess'))
    } catch {
      message.error(t('customReport.exportFailed'))
    }
  }

  const handleDelete = (def: CustomReportDef) => {
    Modal.confirm({
      title: t('customReport.deleteConfirmTitle', { name: def.name }),
      content: t('customReport.deleteConfirmContent'),
      okText: t('customReport.delete'),
      okButtonProps: { danger: true },
      cancelText: t('customReport.cancel'),
      onOk: async () => {
        const res = await customReportApi.remove(def.id)
        if (res.success) {
          message.success(t('customReport.defDeleted'))
          void loadAll()
        } else {
          message.warning(res.error?.message ?? t('customReport.deleteFailed'))
        }
      },
    })
  }

  // ── 列定义 ────────────────────────────────────────────────────────────────
  const defColumns: ProColumn<CustomReportDef>[] = [
    {
      key: 'name',
      dataIndex: 'name',
      title: t('customReport.colName'),
      width: 220,
      searchable: true,
      render: (val: unknown, record: CustomReportDef) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{String(val)}</span>
          <Tag color={DS_BADGES[record.dataSource]?.color ?? 'default'} style={{ margin: 0, fontSize: 10 }}>
            {DS_BADGES[record.dataSource]?.label ?? record.dataSource}
          </Tag>
        </Space>
      ),
    },
    { key: 'category', dataIndex: 'category', title: t('customReport.colCategory'), width: 110 },
    {
      key: 'period',
      dataIndex: 'period',
      title: t('customReport.colPeriod'),
      width: 70,
      render: (val: unknown) => PERIOD_LABELS[String(val)] ?? String(val ?? '-'),
    },
    {
      key: 'fields',
      dataIndex: 'fields',
      title: t('customReport.colFields'),
      width: 240,
      render: (val: unknown) => {
        const list = val as string[]
        if (!Array.isArray(list) || list.length === 0) return '-'
        const names = list.slice(0, 3).map((f) => catalogName(f))
        const rest = list.length > 3 ? t('customReport.andMoreFields', { count: list.length }) : ''
        return (
          <Tooltip title={list.map((f) => catalogName(f)).join('、')}>
            <span style={{ fontSize: 12 }}>{names.join('、')}{rest}</span>
          </Tooltip>
        )
      },
    },
    {
      key: 'sort',
      dataIndex: 'sortBy',
      title: t('customReport.colSortGroup'),
      width: 130,
      render: (_val: unknown, record: CustomReportDef) => {
        if (!record.sortBy && !record.groupBy) return <Text type="secondary" style={{ fontSize: 12 }}>{t('customReport.defaultValue')}</Text>
        return (
          <Space size={4} wrap>
            {record.sortBy && (
              <Tag icon={<ArrowUpDown size={10} />} color="cyan" style={{ margin: 0, fontSize: 10 }}>
                {catalogName(record.sortBy)}{record.sortOrder === 'desc' ? ' ↓' : ' ↑'}
              </Tag>
            )}
            {record.groupBy && (
              <Tag icon={<LayoutGrid size={10} />} color="geekblue" style={{ margin: 0, fontSize: 10 }}>
                {catalogName(record.groupBy)}
              </Tag>
            )}
          </Space>
        )
      },
    },
    {
      key: 'schedule',
      dataIndex: 'schedule',
      title: t('customReport.colScheduleSub'),
      width: 170,
      render: (val: unknown, record: CustomReportDef) =>
        val ? (
          <Space size={4} direction="vertical" style={{ gap: 2 }}>
            <Tag color="gold" icon={<Clock size={10} />} style={{ margin: 0, fontSize: 11 }}>{String(val)}</Tag>
            {record.recipients.length > 0 ? (
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                <BellRing size={11} style={{ verticalAlign: -1 }} /> {t('customReport.subscribedPushed', { count: record.recipients.length })}
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{t('customReport.noRecipients')}</span>
            )}
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>{t('customReport.notSet')}</Text>
        ),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: t('customReport.colStatus'),
      width: 80,
      render: (val: unknown) => {
        const s = STATUS_TAGS[String(val)] ?? STATUS_TAGS.idle!
        return <Tag color={s.color} style={{ margin: 0 }}>{s.label}</Tag>
      },
    },
    {
      key: 'lastRunAt',
      dataIndex: 'lastRunAt',
      title: t('customReport.colLastRun'),
      width: 140,
      render: (val: unknown) =>
        val ? (
          <span style={{ fontSize: 12 }}>{dayjs(String(val)).format('MM-DD HH:mm')}</span>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>-</Text>
        ),
    },
    {
      key: 'actions',
      title: t('customReport.colActions'),
      width: 330,
      fixed: 'right',
      render: (_val: unknown, record: CustomReportDef) => (
        <Space size={2} wrap>
          <Button size="small" type="primary" icon={<Play size={12} />} loading={runningId === record.id} onClick={() => void handleRun(record)}>{t('customReport.run')}</Button>
          <Button size="small" icon={<Table2 size={12} />} onClick={() => void openResult(record)}>{t('customReport.result')}</Button>
          <Button size="small" icon={<History size={12} />} onClick={() => void openHistory(record)}>{t('customReport.history')}</Button>
          <Button size="small" icon={<Clock size={12} />} onClick={() => openSchedule(record)}>{t('customReport.schedule')}</Button>
          <Button size="small" icon={<FileDown size={12} />} onClick={() => void handleExport(record)}>{t('customReport.export')}</Button>
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(record)}>{t('customReport.edit')}</Button>
          <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => void handleDelete(record)}>{t('customReport.delete')}</Button>
        </Space>
      ),
    },
  ]

  const resultColumns: ProColumn<Record<string, unknown>>[] = useMemo(() => {
    if (!result) return []
    return result.columns.map((col) => ({
      key: col.key,
      dataIndex: col.key,
      title: col.name,
      width: col.key === '周期' ? 150 : 130,
      render: (val: unknown) => {
        if (typeof val === 'number') {
          if (Number.isInteger(val)) return val.toLocaleString()
          return val.toFixed(2)
        }
        return String(val ?? '-')
      },
    }))
  }, [result])

  const historyColumns: ProColumn<RunHistoryEntry>[] = [
    {
      key: 'ranAt',
      dataIndex: 'ranAt',
      title: t('customReport.colRanAt'),
      width: 170,
      render: (val: unknown) => dayjs(String(val)).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: t('customReport.colStatus'),
      width: 90,
      render: (val: unknown) => (
        <Tag color={String(val) === 'success' ? 'success' : 'error'} style={{ margin: 0 }}>
          {String(val) === 'success' ? t('customReport.success') : t('customReport.failed')}
        </Tag>
      ),
    },
    { key: 'rowCount', dataIndex: 'rowCount', title: t('customReport.colRowCount'), width: 70 },
    {
      key: 'message',
      dataIndex: 'message',
      title: t('customReport.colMessagePush'),
      width: 260,
      render: (val: unknown) => {
        const s = String(val ?? '')
        const isPush = s.includes('olap') || s.includes('snapshot') || s.includes('快照')
        return (
          <Space size={4}>
            <span style={{ fontSize: 12 }}>{s || '-'}</span>
            {isPush && <CheckCircle2 size={13} color="#10b981" />}
          </Space>
        )
      },
    },
  ]

  // ── 渲染 ──────────────────────────────────────────────────────────────────
  return (
    <PageContainer background="slate" maxWidth="wide">
      <PageHeader
        icon={<FileSpreadsheet size={20} color="#3b82f6" />}
        title={t('customReport.pageTitle')}
        subtitle={t('customReport.pageSubtitle')}
      />
      {loadError && <ErrorBanner message={loadError} onRetry={() => void loadAll()} retryLabel={t('w9.states.retry')} />}
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 统计卡 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { label: t('customReport.statDefs'), value: stats.total, color: '#3b82f6', bg: '#dbeafe', icon: <FileSpreadsheet size={18} /> },
            { label: t('customReport.statScheduled'), value: stats.scheduled, color: '#f59e0b', bg: '#fef3c7', icon: <Clock size={18} /> },
            { label: t('customReport.statReady'), value: stats.ready, color: '#10b981', bg: '#d1fae5', icon: <CheckCircle2 size={18} /> },
            { label: t('customReport.statFailed'), value: stats.failed, color: '#ef4444', bg: '#ffe4e6', icon: <XCircle size={18} /> },
          ].map((card) => (
            <div key={card.label} style={{ background: 'var(--bg-card)', borderRadius: 10, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 38, height: 38, borderRadius: 10, background: card.bg, color: card.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{card.icon}</div>
              <div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{card.label}</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* 列表主卡 */}
        <Card
          size="small"
          style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
          extra={
            <Space>
              <Tabs
                size="small"
                activeKey={filterTab}
                onChange={(k) => setFilterTab(k as 'all' | 'scheduled')}
                items={[
                  { key: 'all', label: t('customReport.tabAll', { count: stats.total }) },
                  { key: 'scheduled', label: t('customReport.tabScheduled', { count: stats.scheduled }) },
                ]}
                style={{ margin: 0 }}
              />
              <div style={{ position: 'relative' }}>
                <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                <Input
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('customReport.searchPlaceholder')}
                  style={{ paddingLeft: 26, width: 180 }}
                />
              </div>
              <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadAll()} loading={loading}>{t('customReport.refresh')}</Button>
              <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openCreate}>{t('customReport.newReport')}</Button>
            </Space>
          }
        >
          <ProTable<CustomReportDef>
            columns={defColumns}
            dataSource={filteredDefs}
            rowKey="id"
            loading={loading}
            showToolbar={false}
            pagination={{ pageSize: 10, showSizeChanger: false }}
            scroll={{ x: 'max-content', y: 420 }}
            size="small"
          />
        </Card>

        {/* 数据源徽标 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#64748b', padding: '0 4px', flexWrap: 'wrap' }}>
          <Tag color="blue" style={{ margin: 0 }}>{t('customReport.dataSource')}</Tag>
          <span>{t('customReport.dsLegend')}</span>
        </div>
      </div>

      {/* ── 向导式新建/编辑 Modal ─────────────────────────────────────────── */}
      <Modal
        title={editing ? t('customReport.editReportTitle', { name: editing.name }) : t('customReport.newReportTitle')}
        open={wizardOpen}
        onCancel={() => setWizardOpen(false)}
        footer={
          <Space>
            {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>{t('customReport.prevStep')}</Button>}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>{t('customReport.nextStep')}</Button>
            ) : (
              <Button type="primary" loading={saving} onClick={() => void handleWizardOk()}>{editing ? t('customReport.saveChanges') : t('customReport.createReport')}</Button>
            )}
          </Space>
        }
        width={760}
        destroyOnClose={false}
      >
        <Steps
          size="small"
          current={step}
          items={WIZARD_STEPS.map((title) => ({ title }))}
          style={{ marginBottom: 20, marginTop: 8 }}
        />
        <div style={{ minHeight: 300 }}>
          {step === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('customReport.reportName')} <span style={{ color: '#dc2626' }}>*</span></Text>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('customReport.reportNamePlaceholder')} maxLength={50} showCount />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('customReport.category')}</Text>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t('customReport.categoryPlaceholder')} maxLength={30} />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('customReport.description')}</Text>
                <Input.TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder={t('customReport.descriptionPlaceholder')} maxLength={200} showCount />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Alert
                type="info"
                showIcon
                style={{ padding: '6px 12px', fontSize: 12 }}
                message={t('customReport.fieldsCatalogHint')}
              />
              <Select
                mode="multiple"
                value={form.fields}
                onChange={(vals) => setForm({ ...form, fields: vals })}
                style={{ width: '100%' }}
                placeholder={t('customReport.selectFieldPlaceholder')}
                optionFilterProp="label"
                options={fieldGroups.map((g) => ({ label: g.label, options: g.options }))}
                maxTagCount={8}
              />
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                {t('customReport.selectedFields', { count: form.fields.length, names: form.fields.map((f) => catalogName(f)).join('、') || t('customReport.notSelected') })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('customReport.dataSource')}</Text>
                <Radio.Group
                  value={form.dataSource}
                  onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
                  options={DATA_SOURCE_OPTIONS}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>{t('customReport.dataSourceHint')}</div>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('customReport.statPeriod')}</Text>
                <Select
                  value={form.period}
                  onChange={(v) => setForm({ ...form, period: v })}
                  style={{ width: 160 }}
                  options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label: `${label} (${value})` }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  <CalendarRange size={11} style={{ verticalAlign: -1 }} /> {t('customReport.lookbackWindow')}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  <ArrowUpDown size={12} style={{ verticalAlign: -1 }} /> {t('customReport.sortField')}
                </Text>
                <Space>
                  <Select
                    value={form.sortBy ?? undefined}
                    onChange={(v) => setForm({ ...form, sortBy: v ?? null })}
                    style={{ width: 200 }}
                    placeholder={t('customReport.noSort')}
                    allowClear
                    options={fieldSortOptions}
                  />
                  <Select
                    value={form.sortOrder ?? undefined}
                    onChange={(v) => setForm({ ...form, sortOrder: v ?? null })}
                    style={{ width: 110 }}
                    placeholder={t('customReport.direction')}
                    disabled={!form.sortBy}
                    options={[{ label: t('customReport.asc'), value: 'asc' }, { label: t('customReport.desc'), value: 'desc' }]}
                  />
                </Space>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  <LayoutGrid size={12} style={{ verticalAlign: -1 }} /> {t('customReport.groupDimension')}
                </Text>
                <Select
                  value={form.groupBy ?? undefined}
                  onChange={(v) => setForm({ ...form, groupBy: v ?? null })}
                  style={{ width: 200 }}
                  placeholder={t('customReport.noGroup')}
                  allowClear
                  options={catalog.filter((c) => c.kind === 'dimension').map((c) => ({ label: c.name, value: c.id }))}
                />
              </div>
              <Alert
                type="success"
                showIcon
                style={{ padding: '6px 12px', fontSize: 12 }}
                message={t('customReport.execPreview', { period: PERIOD_LABELS[form.period] ?? form.period, ds: DS_BADGES[form.dataSource]?.label ?? form.dataSource, count: form.fields.length })}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* ── 结果 Modal ─────────────────────────────────────────────────────── */}
      <Modal
        title={resultDef ? t('customReport.resultTitleNamed', { name: resultDef.name }) : t('customReport.resultTitle')}
        open={!!resultDef}
        onCancel={() => setResultDef(null)}
        footer={<Button onClick={() => setResultDef(null)}>{t('customReport.close')}</Button>}
        width={860}
      >
        {resultLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Alert
              type="success"
              showIcon
              message={t('customReport.resultSource', { source: result.source, count: result.rows.length, time: dayjs(result.generatedAt).format('YYYY-MM-DD HH:mm:ss') })}
              description={t('customReport.resultMeta', { period: PERIOD_LABELS[result.summary.period as string] ?? result.summary.period ?? '-', dsType: result.summary.dataSource ?? '-', id: result.id })}
            />
            {result.summary && Object.keys(result.summary).filter((k) => k.includes('合计')).length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {Object.entries(result.summary).filter(([k]) => k.includes('合计')).map(([k, v]) => (
                  <Tag key={k} color="blue" style={{ margin: 0 }}>{k}: {String(v)}</Tag>
                ))}
              </div>
            )}
            <ProTable<Record<string, unknown>>
              columns={resultColumns}
              dataSource={result.rows}
              rowKey={(r) => String(r['周期'] ?? '')}
              showToolbar={false}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 'max-content', y: 320 }}
              size="small"
            />
            <Space>
              <Button type="primary" size="small" icon={<FileDown size={13} />} onClick={() => void handleExport(resultDef!)}>{t('customReport.exportCsv')}</Button>
              <Button size="small" icon={<Table2 size={13} />} onClick={() => void handleRun(resultDef!)}>{t('customReport.rerun')}</Button>
            </Space>
          </div>
        ) : (
          <Empty description={t('customReport.emptyResult')} style={{ padding: 32 }} />
        )}
      </Modal>

      {/* ── 历史 Drawer ────────────────────────────────────────────────────── */}
      <Drawer
        title={historyDef ? t('customReport.historyTitleNamed', { name: historyDef.name }) : t('customReport.historyTitle')}
        width={640}
        open={!!historyDef}
        onClose={() => setHistoryDef(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Alert
            type="info"
            showIcon
            style={{ padding: '6px 12px', fontSize: 12 }}
            message={t('customReport.historyHint')}
          />
          <ProTable<RunHistoryEntry>
            columns={historyColumns}
            dataSource={history}
            rowKey="id"
            loading={historyLoading}
            showToolbar={false}
            pagination={{ pageSize: 8, showSizeChanger: false }}
            scroll={{ y: 380 }}
            size="small"
          />
        </div>
      </Drawer>

      {/* ── 定时设置 Modal ─────────────────────────────────────────────────── */}
      <Modal
        title={scheduleDef ? t('customReport.scheduleTitleNamed', { name: scheduleDef.name }) : t('customReport.scheduleTitle')}
        open={!!scheduleDef}
        onOk={() => void handleSaveSchedule()}
        onCancel={() => setScheduleDef(null)}
        okText={t('customReport.saveAndPush')}
        cancelText={t('customReport.cancel')}
        confirmLoading={saving}
        width={540}
      >
        {scheduleDef && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                <Clock size={13} style={{ verticalAlign: -1 }} /> {t('customReport.scheduleRule')}
              </Text>
              <Select
                value={scheduleText}
                onChange={setScheduleText}
                style={{ width: '100%' }}
                options={SCHEDULE_OPTIONS}
                showSearch
                allowClear={false}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                {t('customReport.scheduleHint')}
              </Text>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                <BellRing size={13} style={{ verticalAlign: -1 }} /> {t('customReport.recipients')}
              </Text>
              <Select
                mode="tags"
                value={recipients}
                onChange={setRecipients}
                style={{ width: '100%' }}
                placeholder={t('customReport.recipientsPlaceholder')}
                options={RECIPIENT_OPTIONS}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                {t('customReport.currentSubscribers', { names: recipients.length > 0 ? recipients.join('、') : t('customReport.notSelected') })}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
