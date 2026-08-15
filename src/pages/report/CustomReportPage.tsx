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
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
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

const PERIOD_LABELS: Record<string, string> = { daily: '日', weekly: '周', monthly: '月', quarterly: '季', yearly: '年' }

const DS_BADGES: Record<string, { color: string; label: string }> = {
  olap: { color: 'blue', label: 'OLAP' },
  stats: { color: 'green', label: 'STATS' },
  bi: { color: 'purple', label: 'BI' },
  mixed: { color: 'orange', label: '混合' },
}

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  idle: { color: 'default', label: '未执行' },
  running: { color: 'processing', label: '执行中' },
  ready: { color: 'success', label: '就绪' },
  failed: { color: 'error', label: '失败' },
}

const SCHEDULE_OPTIONS = [
  { label: '每日 08:00', value: 'daily: 08:00' },
  { label: '每日 20:00', value: 'daily: 20:00' },
  { label: '每周一 08:00', value: 'weekly: 周一 08:00' },
  { label: '每周日 18:00', value: 'weekly: 周日 18:00' },
  { label: '每月1日 09:00', value: 'monthly: 每月1日 09:00' },
  { label: '每季度首日 09:00', value: 'quarterly: 季度首日 09:00' },
  { label: '每年1月1日 09:00', value: 'yearly: 1月1日 09:00' },
]

const DATA_SOURCE_OPTIONS = [
  { label: 'OLAP 聚合', value: 'olap' },
  { label: '统计快照 (stats)', value: 'stats' },
  { label: 'BI 指标 (bi)', value: 'bi' },
  { label: '混合', value: 'mixed' },
]

const RECIPIENT_OPTIONS = [
  { label: '当前用户 (current)', value: 'current' },
  { label: '科主任 (D002)', value: 'D002' },
  { label: '质控组长 (D003)', value: 'D003' },
  { label: '王医生 (D1002)', value: 'D1002' },
  { label: '李医生 (D1001)', value: 'D1001' },
  { label: '技师 赵强 (T1005)', value: 'T1005' },
]

// ── 字段目录分组 (olap 指标/维度 / stats / bi) ─────────────────────────────
function groupCatalog(catalog: CustomReportField[]) {
  const groups: Array<{ label: string; options: Array<{ label: string; value: string }> }> = []
  for (const source of ['olap', 'stats', 'bi'] as const) {
    const kindLabel = source === 'olap' ? 'OLAP 指标/维度' : source === 'stats' ? '统计快照 (stats)' : 'BI 指标 (bi)'
    const items = catalog.filter((f) => f.source === source)
    if (items.length === 0) continue
    const opts = items.map((f) => ({
      label: `${f.name}${f.unit ? ` (${f.unit})` : ''}${f.kind === 'dimension' ? ' [维度]' : ''}`,
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
  category: '自定义报表',
  description: '',
  fields: ['exam_count', 'report_count'],
  period: 'monthly',
  dataSource: 'olap',
  sortBy: null,
  sortOrder: null,
  groupBy: null,
}

const WIZARD_STEPS = ['基础信息', '字段选择', '周期与数据源', '排序/分组']

export default function CustomReportPage() {
  const [defs, setDefs] = useState<CustomReportDef[]>([])
  const [catalog, setCatalog] = useState<CustomReportField[]>([])
  const [loading, setLoading] = useState(false)
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
    const [d, c] = await Promise.allSettled([
      customReportApi.list(),
      customReportApi.getFieldsCatalog(),
    ])
    if (d.status === 'fulfilled' && d.value.success && Array.isArray(d.value.data)) setDefs(d.value.data)
    if (c.status === 'fulfilled' && c.value.success && Array.isArray(c.value.data)) setCatalog(c.value.data)
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
      message.warning('请输入报表名称')
      setStep(0)
      return
    }
    if (form.fields.length === 0) {
      message.warning('请至少选择一个字段')
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
        message.warning(res.error?.message ?? '保存失败')
        return
      }
      message.success(editing ? `报表「${form.name}」已更新` : `报表「${form.name}」已创建`)
      setWizardOpen(false)
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? '保存失败')
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
        message.warning(res.error?.message ?? '执行失败')
        return
      }
      setResult(res.data)
      setResultDef(def)
      if (def.schedule && def.recipients.length > 0) {
        message.success(`「${def.name}」执行完成, 已推送订阅通知 (${def.recipients.length} 人)`)
      } else {
        message.success(`「${def.name}」执行完成, 生成 ${res.data.rows.length} 行`)
      }
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? '执行失败')
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
      message.warning(res.error?.message ?? '暂无结果, 请先运行')
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
      message.warning('请选择定时规则')
      return
    }
    if (recipients.length === 0) {
      message.warning('请至少选择一位订阅人')
      return
    }
    setSaving(true)
    try {
      const res = await customReportApi.setSchedule(scheduleDef.id, { schedule: scheduleText, recipients })
      if (!res.success) {
        message.warning(res.error?.message ?? '定时设置失败')
        return
      }
      message.success(`报表「${scheduleDef.name}」定时已保存, 已推送订阅通知 ${res.data?.notified?.count ?? 1} 条`)
      setScheduleDef(null)
      void loadAll()
    } catch (e) {
      message.error((e as Error).message ?? '定时设置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (def: CustomReportDef) => {
    try {
      const res = await customReportApi.exportCsv(def.id)
      if (!res.success || !res.data) {
        message.warning(res.error?.message ?? '暂无结果可导出, 请先运行')
        return
      }
      const blob = res.data as unknown as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `custom-report-${def.id}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success('CSV 导出成功')
    } catch {
      message.error('导出失败')
    }
  }

  const handleDelete = (def: CustomReportDef) => {
    Modal.confirm({
      title: `删除报表「${def.name}」?`,
      content: '删除后定义、结果快照与执行历史将一并清除, 该操作不可恢复。',
      okText: '删除',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: async () => {
        const res = await customReportApi.remove(def.id)
        if (res.success) {
          message.success('报表定义已删除')
          void loadAll()
        } else {
          message.warning(res.error?.message ?? '删除失败')
        }
      },
    })
  }

  // ── 列定义 ────────────────────────────────────────────────────────────────
  const defColumns: ProColumn<CustomReportDef>[] = [
    {
      key: 'name',
      dataIndex: 'name',
      title: '名称',
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
    { key: 'category', dataIndex: 'category', title: '类别', width: 110 },
    {
      key: 'period',
      dataIndex: 'period',
      title: '周期',
      width: 70,
      render: (val: unknown) => PERIOD_LABELS[String(val)] ?? String(val ?? '-'),
    },
    {
      key: 'fields',
      dataIndex: 'fields',
      title: '字段',
      width: 240,
      render: (val: unknown) => {
        const list = val as string[]
        if (!Array.isArray(list) || list.length === 0) return '-'
        const names = list.slice(0, 3).map((f) => catalogName(f))
        const rest = list.length > 3 ? ` 等${list.length}个` : ''
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
      title: '排序/分组',
      width: 130,
      render: (_val: unknown, record: CustomReportDef) => {
        if (!record.sortBy && !record.groupBy) return <Text type="secondary" style={{ fontSize: 12 }}>默认</Text>
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
      title: '定时 / 订阅',
      width: 170,
      render: (val: unknown, record: CustomReportDef) =>
        val ? (
          <Space size={4} direction="vertical" style={{ gap: 2 }}>
            <Tag color="gold" icon={<Clock size={10} />} style={{ margin: 0, fontSize: 11 }}>{String(val)}</Tag>
            {record.recipients.length > 0 ? (
              <span style={{ fontSize: 11, color: '#059669', fontWeight: 600 }}>
                <BellRing size={11} style={{ verticalAlign: -1 }} /> 订阅 {record.recipients.length} 人 · 已推送
              </span>
            ) : (
              <span style={{ fontSize: 11, color: '#94a3b8' }}>未设置订阅人</span>
            )}
          </Space>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>未设置</Text>
        ),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: '状态',
      width: 80,
      render: (val: unknown) => {
        const s = STATUS_TAGS[String(val)] ?? STATUS_TAGS.idle!
        return <Tag color={s.color} style={{ margin: 0 }}>{s.label}</Tag>
      },
    },
    {
      key: 'lastRunAt',
      dataIndex: 'lastRunAt',
      title: '最近运行',
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
      title: '操作',
      width: 330,
      fixed: 'right',
      render: (_val: unknown, record: CustomReportDef) => (
        <Space size={2} wrap>
          <Button size="small" type="primary" icon={<Play size={12} />} loading={runningId === record.id} onClick={() => void handleRun(record)}>运行</Button>
          <Button size="small" icon={<Table2 size={12} />} onClick={() => void openResult(record)}>结果</Button>
          <Button size="small" icon={<History size={12} />} onClick={() => void openHistory(record)}>历史</Button>
          <Button size="small" icon={<Clock size={12} />} onClick={() => openSchedule(record)}>定时</Button>
          <Button size="small" icon={<FileDown size={12} />} onClick={() => void handleExport(record)}>导出</Button>
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(record)}>编辑</Button>
          <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => void handleDelete(record)}>删除</Button>
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
      title: '执行时间',
      width: 170,
      render: (val: unknown) => dayjs(String(val)).format('YYYY-MM-DD HH:mm:ss'),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: '状态',
      width: 90,
      render: (val: unknown) => (
        <Tag color={String(val) === 'success' ? 'success' : 'error'} style={{ margin: 0 }}>
          {String(val) === 'success' ? '成功' : '失败'}
        </Tag>
      ),
    },
    { key: 'rowCount', dataIndex: 'rowCount', title: '行数', width: 70 },
    {
      key: 'message',
      dataIndex: 'message',
      title: '说明 / 推送记录',
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
        title="自定义报表"
        subtitle="报表定义 · 向导式新建 · 运行/结果/历史/定时推送 · CSV 导出"
      />
      <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 统计卡 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
          {[
            { label: '报表定义', value: stats.total, color: '#3b82f6', bg: '#dbeafe', icon: <FileSpreadsheet size={18} /> },
            { label: '定时报表', value: stats.scheduled, color: '#f59e0b', bg: '#fef3c7', icon: <Clock size={18} /> },
            { label: '就绪 (已执行)', value: stats.ready, color: '#10b981', bg: '#d1fae5', icon: <CheckCircle2 size={18} /> },
            { label: '执行失败', value: stats.failed, color: '#ef4444', bg: '#ffe4e6', icon: <XCircle size={18} /> },
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
                  { key: 'all', label: `全部 (${stats.total})` },
                  { key: 'scheduled', label: `定时报表 (${stats.scheduled})` },
                ]}
                style={{ margin: 0 }}
              />
              <div style={{ position: 'relative' }}>
                <Search size={13} color="#94a3b8" style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)' }} />
                <Input
                  size="small"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="检索名称/类别"
                  style={{ paddingLeft: 26, width: 180 }}
                />
              </div>
              <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadAll()} loading={loading}>刷新</Button>
              <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openCreate}>新建报表</Button>
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
          <Tag color="blue" style={{ margin: 0 }}>数据源</Tag>
          <span>OLAP 聚合(周期粒度) · stats 快照 · BI 指标 · mixed 混合 · 执行结果缓存 + 定时订阅推送 (notifications/report-generated)</span>
        </div>
      </div>

      {/* ── 向导式新建/编辑 Modal ─────────────────────────────────────────── */}
      <Modal
        title={editing ? `编辑报表: ${editing.name}` : '新建自定义报表'}
        open={wizardOpen}
        onCancel={() => setWizardOpen(false)}
        footer={
          <Space>
            {step > 0 && <Button onClick={() => setStep((s) => s - 1)}>上一步</Button>}
            {step < WIZARD_STEPS.length - 1 ? (
              <Button type="primary" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>下一步</Button>
            ) : (
              <Button type="primary" loading={saving} onClick={() => void handleWizardOk()}>{editing ? '保存修改' : '创建报表'}</Button>
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
                <Text strong style={{ display: 'block', marginBottom: 6 }}>报表名称 <span style={{ color: '#dc2626' }}>*</span></Text>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如: 月度检查收入分析" maxLength={50} showCount />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>类别</Text>
                <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="如: 日常统计 / 报告质量 / 设备管理" maxLength={30} />
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>说明</Text>
                <Input.TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="报表用途说明 (可选)" maxLength={200} showCount />
              </div>
            </div>
          )}

          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Alert
                type="info"
                showIcon
                style={{ padding: '6px 12px', fontSize: 12 }}
                message="字段目录按数据源分组加载 (fields-catalog): OLAP 指标/维度 按周期聚合, stats/bi 为快照值"
              />
              <Select
                mode="multiple"
                value={form.fields}
                onChange={(vals) => setForm({ ...form, fields: vals })}
                style={{ width: '100%' }}
                placeholder="选择字段 (至少 1 个)"
                optionFilterProp="label"
                options={fieldGroups.map((g) => ({ label: g.label, options: g.options }))}
                maxTagCount={8}
              />
              <div style={{ fontSize: 12, color: '#94a3b8' }}>
                已选 {form.fields.length} 个字段: {form.fields.map((f) => catalogName(f)).join('、') || '未选择'}
              </div>
            </div>
          )}

          {step === 2 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>数据源</Text>
                <Radio.Group
                  value={form.dataSource}
                  onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
                  options={DATA_SOURCE_OPTIONS}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>数据源决定执行方式: OLAP 字段按周期聚合, stats/bi 字段为快照值</div>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>统计周期</Text>
                <Select
                  value={form.period}
                  onChange={(v) => setForm({ ...form, period: v })}
                  style={{ width: 160 }}
                  options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label: `${label} (${value})` }))}
                />
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                  <CalendarRange size={11} style={{ verticalAlign: -1 }} /> 回看窗口: 日≈30天 / 周≈90天 / 月≈365天 / 季≈730天 / 年≈1825天
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  <ArrowUpDown size={12} style={{ verticalAlign: -1 }} /> 排序字段 (按结果行数值/字典序)
                </Text>
                <Space>
                  <Select
                    value={form.sortBy ?? undefined}
                    onChange={(v) => setForm({ ...form, sortBy: v ?? null })}
                    style={{ width: 200 }}
                    placeholder="不排序"
                    allowClear
                    options={fieldSortOptions}
                  />
                  <Select
                    value={form.sortOrder ?? undefined}
                    onChange={(v) => setForm({ ...form, sortOrder: v ?? null })}
                    style={{ width: 110 }}
                    placeholder="方向"
                    disabled={!form.sortBy}
                    options={[{ label: '升序 ↑', value: 'asc' }, { label: '降序 ↓', value: 'desc' }]}
                  />
                </Space>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 6 }}>
                  <LayoutGrid size={12} style={{ verticalAlign: -1 }} /> 分组维度 (仅记录设置, 结果按周期行展示)
                </Text>
                <Select
                  value={form.groupBy ?? undefined}
                  onChange={(v) => setForm({ ...form, groupBy: v ?? null })}
                  style={{ width: 200 }}
                  placeholder="不分组"
                  allowClear
                  options={catalog.filter((c) => c.kind === 'dimension').map((c) => ({ label: c.name, value: c.id }))}
                />
              </div>
              <Alert
                type="success"
                showIcon
                style={{ padding: '6px 12px', fontSize: 12 }}
                message={`执行预览: 周期 ${PERIOD_LABELS[form.period] ?? form.period} · 数据源 ${DS_BADGES[form.dataSource]?.label ?? form.dataSource} · ${form.fields.length} 个字段`}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* ── 结果 Modal ─────────────────────────────────────────────────────── */}
      <Modal
        title={resultDef ? `运行结果: ${resultDef.name}` : '运行结果'}
        open={!!resultDef}
        onCancel={() => setResultDef(null)}
        footer={<Button onClick={() => setResultDef(null)}>关闭</Button>}
        width={860}
      >
        {resultLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Alert
              type="success"
              showIcon
              message={`数据源: ${result.source} · ${result.rows.length} 行 · ${dayjs(result.generatedAt).format('YYYY-MM-DD HH:mm:ss')}`}
              description={`周期: ${PERIOD_LABELS[result.summary.period as string] ?? result.summary.period ?? '-'} · 数据源类型: ${result.summary.dataSource ?? '-'} · 执行ID: ${result.id}`}
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
              <Button type="primary" size="small" icon={<FileDown size={13} />} onClick={() => void handleExport(resultDef!)}>导出 CSV</Button>
              <Button size="small" icon={<Table2 size={13} />} onClick={() => void handleRun(resultDef!)}>重新运行</Button>
            </Space>
          </div>
        ) : (
          <Empty description="暂无结果, 请先点击「运行」" style={{ padding: 32 }} />
        )}
      </Modal>

      {/* ── 历史 Drawer ────────────────────────────────────────────────────── */}
      <Drawer
        title={historyDef ? `执行历史: ${historyDef.name}` : '执行历史'}
        width={640}
        open={!!historyDef}
        onClose={() => setHistoryDef(null)}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Alert
            type="info"
            showIcon
            style={{ padding: '6px 12px', fontSize: 12 }}
            message="执行历史包含 时间/行数/状态/数据源说明; 定时+订阅报表运行后自动生成推送记录"
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
        title={scheduleDef ? `定时设置: ${scheduleDef.name}` : '定时设置'}
        open={!!scheduleDef}
        onOk={() => void handleSaveSchedule()}
        onCancel={() => setScheduleDef(null)}
        okText="保存并推送通知"
        cancelText="取消"
        confirmLoading={saving}
        width={540}
      >
        {scheduleDef && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                <Clock size={13} style={{ verticalAlign: -1 }} /> 定时规则
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
                保存后将自动推送「报表已生成」通知给订阅人 (POST /notifications/report-generated)
              </Text>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                <BellRing size={13} style={{ verticalAlign: -1 }} /> 订阅人 (推送通知对象)
              </Text>
              <Select
                mode="tags"
                value={recipients}
                onChange={setRecipients}
                style={{ width: '100%' }}
                placeholder="输入用户ID后回车, 默认 current"
                options={RECIPIENT_OPTIONS}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
                当前订阅: {recipients.length > 0 ? recipients.join('、') : '未选择'}
              </Text>
            </div>
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
