import dayjs from 'dayjs'
import { Chart } from '../components/chart/Chart'
import { ProTable } from '../components/data/ProTable'
import { ProColumn } from '../components/data/ProTable'
import { generateMockReportData } from '../data/mockReportData'
import { reportDefinitions } from '../data/reportDefinitions'
import { ReportDefinition } from '../data/reportDefinitions'
import { invalidateApiCacheByPrefix } from '../services/api/client'
import { datareportApi } from '../services/api/datareportApi'
import { olapApi, analyticsStatsApi } from '../services/api/analyticsApi'
import { statsApi } from '../services/api/statsApi'
import { biApi } from '../services/api/biApi'
import { notificationsApi } from '../services/api/notificationsApi'
import { usePagination } from '../hooks/usePagination'
import {
  customReportApi,
  CustomReportDef as ApiReportDef,
  CustomReportField,
  ReportRunResult,
  RunHistoryEntry,
} from '../services/api/customReportApi'
import { generateReportInsight } from '../services/reportAiInsight'
import {
  Layout, Typography, Input, Select, DatePicker, Button, Card,
  Tag, message, Tooltip, Space, Switch,
  Menu, Collapse, Empty, Spin, Checkbox, Alert,
  Modal, Drawer, Tabs, Radio,
} from 'antd'
import {
  BarChart3,
  TrendingUp,
  FileText,
  AlertTriangle,
  ShieldCheck,
  Monitor,
  Users,
  Award,
  Search,
  RefreshCw,
  Table2,
  Maximize2,
  Minimize2,
  Download,
  FileSpreadsheet,
  Lightbulb,
  Star,
  StarOff,
  Database,
  SlidersHorizontal,
  Save,
  Trash2,
  Send,
  Plus,
  Play,
  Clock,
  History,
  Pencil,
  FileDown,
} from 'lucide-react'
import { Inbox } from 'lucide-react'
import { useState, useMemo, useCallback, useEffect } from 'react'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography
const { RangePicker } = DatePicker

const categoryIcons: Record<string, React.ReactNode> = {
  '日常统计': <BarChart3 size={16} />,
  '设备管理': <Monitor size={16} />,
  '报告质量': <FileText size={16} />,
  '危急值': <AlertTriangle size={16} />,
  '绩效分析': <TrendingUp size={16} />,
  'AI评估': <ShieldCheck size={16} />,
  '患者服务': <Users size={16} />,
  '综合质控': <Award size={16} />,
}

const granularityOptions = [
  { label: '日', value: 'daily' },
  { label: '周', value: 'weekly' },
  { label: '月', value: 'monthly' },
  { label: '季', value: 'quarterly' },
  { label: '年', value: 'yearly' },
]

function buildTreeData(defs: ReportDefinition[]) {
  const cats = [...new Set(defs.map((d) => d.category))]
  return cats.map((cat) => ({
    title: (
      <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {categoryIcons[cat]}
        {cat}
      </span>
    ),
    key: cat,
    children: defs
      .filter((d) => d.category === cat)
      .map((d) => ({ title: d.name, key: d.id, isLeaf: true })),
  }))
}

// ═══════════ [G005 v3.0.6.11-90 Wave 4A (PACS P0-4)] 自定义报表生成器 (简化版) ═══════════

const CUSTOM_FIELDS: Array<{ key: string; label: string; measure: string; olap: boolean }> = [
  { key: 'exam_count', label: '检查量', measure: 'exam_count', olap: true },
  { key: 'report_count', label: '报告量', measure: 'report_count', olap: true },
  { key: 'exam_revenue', label: '收入', measure: 'exam_revenue', olap: true },
  { key: 'workload', label: '工作量', measure: 'device_daily_exams', olap: true },
  { key: 'device_usage_rate', label: '设备利用率', measure: 'device_usage_rate', olap: true },
  { key: 'report_timely_rate', label: '及时率', measure: 'report_timely_rate', olap: true },
  { key: 'positive_rate', label: '准确率', measure: 'positive_rate', olap: true },
]

const CUSTOM_PERIODS = [
  { label: '日', value: 'daily' },
  { label: '周', value: 'weekly' },
  { label: '月', value: 'monthly' },
]

const PERIOD_LABELS: Record<string, string> = { daily: '日', weekly: '周', monthly: '月' }

const DEF_STORAGE_KEY = 'g005-custom-report-defs'

interface CustomReportDef {
  id: string
  name: string
  fields: string[]
  period: string
  start: string
  end: string
}

function loadSavedDefs(): CustomReportDef[] {
  try {
    const raw = localStorage.getItem(DEF_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

// 快照回退: 单个周期值 (statsApi / biApi / analyticsStatsApi)
async function fetchFieldSnapshot(fieldKey: string): Promise<{ value: number; source: string }> {
  try {
    switch (fieldKey) {
      case 'exam_count': {
        const r = await statsApi.getDaily()
        return { value: Number(r.data?.examCount ?? 0), source: 'statsApi.daily' }
      }
      case 'report_count': {
        const r = await statsApi.getDaily()
        return { value: Number(r.data?.reportCount ?? 0), source: 'statsApi.daily' }
      }
      case 'exam_revenue': {
        const r = await statsApi.getDaily()
        const count = Number(r.data?.examCount ?? 0)
        return { value: Math.round(count * 1250), source: 'statsApi.daily·估算' }
      }
      case 'workload': {
        const r = await statsApi.getWorkload()
        const total = Array.isArray(r.data) ? r.data.reduce((s, w) => s + Number(w.examCount ?? 0), 0) : 0
        return { value: total, source: 'statsApi.workload' }
      }
      case 'device_usage_rate': {
        const r = await analyticsStatsApi.getUtilization()
        const v = (r.data as { data?: unknown } | null)?.data ?? r.data
        return { value: Number((v as { current?: number } | null)?.current ?? 0), source: 'stats.utilization' }
      }
      case 'report_timely_rate': {
        const r = await biApi.getKpi()
        const kpi = (r.data as { data?: { completionRate?: number } } | null)?.data
        return { value: Number(kpi?.completionRate ?? 0), source: 'biApi.kpi' }
      }
      case 'positive_rate': {
        const r = await analyticsStatsApi.getAccuracy()
        const v = (r.data as { data?: unknown } | null)?.data ?? r.data
        return { value: Number((v as { value?: number } | null)?.value ?? 0), source: 'stats.accuracy' }
      }
      default:
        return { value: 0, source: 'unknown' }
    }
  } catch {
    return { value: 0, source: '回退失败' }
  }
}

function CustomReportBuilder() {
  const [fields, setFields] = useState<string[]>(['exam_count', 'report_count'])
  const [period, setPeriod] = useState('daily')
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().subtract(30, 'day'), dayjs()])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(false)
  const [usingFallback, setUsingFallback] = useState(false)
  const [sourceLabel, setSourceLabel] = useState<string | null>(null)
  const [defName, setDefName] = useState('')
  const [savedDefs, setSavedDefs] = useState<CustomReportDef[]>(loadSavedDefs)
  // [v3.0.6.11-99] Wave 5B-C: 报表订阅推送 — 已推送状态 (报表历史「已推送」徽标)
  const [pushedIds, setPushedIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem('g005-report-pushed')
      const arr = raw ? JSON.parse(raw) : []
      return Array.isArray(arr) ? new Set(arr) : new Set()
    } catch {
      return new Set()
    }
  })

  const selectedFields = useMemo(() => CUSTOM_FIELDS.filter((f) => fields.includes(f.key)), [fields])

  const loadData = useCallback(async () => {
    if (selectedFields.length === 0) {
      setRows([])
      return
    }
    setLoading(true)
    setUsingFallback(false)
    setSourceLabel(null)
    const startDate = dateRange[0]?.format('YYYY-MM-DD') || dayjs().subtract(30, 'day').format('YYYY-MM-DD')
    const endDate = dateRange[1]?.format('YYYY-MM-DD') || dayjs().format('YYYY-MM-DD')
    const measures = selectedFields.filter((f) => f.olap).map((f) => f.measure)
    try {
      const res = await olapApi.query({
        dimensions: ['date'],
        measures,
        filters: [{ dimension: 'date', operator: 'between', value: [startDate, endDate] }],
        granularity: period,
      })
      const olapRows = (res.data as { rows?: Array<Record<string, unknown>> } | null)?.rows
      if (res.success && Array.isArray(olapRows) && olapRows.length > 0) {
        const mapped = olapRows.map((r) => {
          const out: Record<string, unknown> = { period: String(r.date ?? r.period ?? '') }
          for (const f of selectedFields) {
            let v = r[f.measure]
            if (f.measure === 'exam_revenue') v = Number(v ?? 0)
            if (typeof v === 'number') v = Number.isInteger(v) && f.measure !== 'exam_revenue' ? v : Math.round(Number(v) * 100) / 100
            out[f.label] = v ?? 0
          }
          return out
        })
        setRows(mapped)
        setSourceLabel(`OLAP ${PERIOD_LABELS[period] ?? period}聚合`)
        return
      }
    } catch {
      /* 回退到快照 */
    }
    // 失败回退: 单行快照 (statsApi/biApi/analyticsStatsApi)
    const snapshots = await Promise.all(selectedFields.map((f) => fetchFieldSnapshot(f.key)))
    const row: Record<string, unknown> = { period: `${startDate} ~ ${endDate} (快照)` }
    selectedFields.forEach((f, i) => {
      row[f.label] = snapshots[i]!.value
    })
    setRows([row])
    setUsingFallback(true)
    setSourceLabel(`快照回退（估算数据）`)
    setLoading(false)
  }, [selectedFields, dateRange, period])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleExportCsv = useCallback(() => {
    if (!rows.length) { message.warning('暂无预览数据'); return }
    const keys = Object.keys(rows[0]!)
    const header = keys.join(',')
    const body = rows.map((row) => keys.map((k) => String(row[k] ?? '')).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `custom-report-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('CSV 导出成功')
  }, [rows])

  const handleSaveDef = useCallback(() => {
    if (!defName.trim()) { message.warning('请输入报表名称'); return }
    const def: CustomReportDef = {
      id: `cr-${Date.now()}`,
      name: defName.trim(),
      fields,
      period,
      start: dateRange[0]?.format('YYYY-MM-DD') || '',
      end: dateRange[1]?.format('YYYY-MM-DD') || '',
    }
    const next = [...savedDefs.filter((d) => d.name !== def.name), def]
    localStorage.setItem(DEF_STORAGE_KEY, JSON.stringify(next))
    setSavedDefs(next)
    setDefName('')
    message.success(`报表定义「${def.name}」已保存`)
  }, [defName, fields, period, dateRange, savedDefs])

  const handleLoadDef = useCallback((def: CustomReportDef) => {
    setFields(def.fields)
    setPeriod(def.period)
    if (def.start && def.end) setDateRange([dayjs(def.start), dayjs(def.end)])
    message.success(`已加载定义「${def.name}」`)
  }, [])

  const handleDeleteDef = useCallback((id: string) => {
    const next = savedDefs.filter((d) => d.id !== id)
    localStorage.setItem(DEF_STORAGE_KEY, JSON.stringify(next))
    setSavedDefs(next)
    message.success('报表定义已删除')
  }, [savedDefs])

  // [v3.0.6.11-99] Wave 5B-C: 订阅推送 — 报表生成后创建「报表已生成」通知 (按 recipients)
  const [pushing, setPushing] = useState(false)
  const handlePushReport = useCallback(async () => {
    const def = savedDefs[0] ?? null
    if (!def) { message.warning('请先保存一条报表定义'); return }
    setPushing(true)
    try {
      const summary = `指标: ${def.fields.join(', ')} · 周期: ${PERIOD_LABELS[def.period] ?? def.period} · 区间: ${def.start} ~ ${def.end}`
      const res = await notificationsApi.reportGenerated({
        reportId: def.id,
        reportName: def.name,
        recipients: ['current'],
        summary,
        link: '/data-report-center',
      })
      if (!res.success) {
        message.warning(res.error?.message ?? '推送接口不可用')
        return
      }
      setPushedIds((prev) => {
        const next = new Set(prev).add(def.id)
        try { localStorage.setItem('g005-report-pushed', JSON.stringify(Array.from(next))) } catch { /* ignore */ }
        return next
      })
      message.success(`报表「${def.name}」已推送订阅通知`)
    } catch {
      message.error('推送失败')
    } finally {
      setPushing(false)
    }
  }, [savedDefs])

  const chartRows = useMemo(() => {
    if (!rows.length) return []
    return rows.map((r) => ({ ...r, name: r.period }))
  }, [rows])
  const chartYKeys = selectedFields.map((f) => f.label)
  // [v3.0.6.11-99 Wave8A P1] 预览表分页受控化
  const { pageData: previewPageData, pagination: previewPagination } = usePagination(chartRows, 10)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card
        size="small"
        title={<Space><SlidersHorizontal size={14} />报表定义配置<Text type="secondary" style={{ fontSize: 12 }}>字段 · 周期 · 日期区间</Text></Space>}
        style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>指标字段 (多选)</Text>
            <Checkbox.Group
              value={fields}
              onChange={(vals) => setFields(vals as string[])}
              options={CUSTOM_FIELDS.map((f) => ({ label: f.label, value: f.key }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Space>
              <Text strong style={{ fontSize: 12 }}>周期</Text>
              <Select value={period} onChange={setPeriod} size="small" style={{ width: 80 }} options={CUSTOM_PERIODS} />
            </Space>
            <Space>
              <Text strong style={{ fontSize: 12 }}>日期区间</Text>
              <DatePicker.RangePicker value={dateRange} onChange={(d) => { if (d?.[0] && d?.[1]) setDateRange([d[0], d[1]]) }} size="small" />
            </Space>
            <Space>
              <Text strong style={{ fontSize: 12 }}>报表名称</Text>
              <Input size="small" value={defName} onChange={(e) => setDefName(e.target.value)} placeholder="如: 月度检查收入分析" style={{ width: 180 }} />
              <Button size="small" icon={<Save size={12} />} onClick={handleSaveDef}>保存定义</Button>
              {/* [v3.0.6.11-99] Wave 5B-C: 报表订阅推送 (POST /notifications/report-generated) */}
              <Button size="small" type="primary" icon={<Send size={12} />} loading={pushing} onClick={() => void handlePushReport()}>推送通知</Button>
            </Space>
          </div>
          {savedDefs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 12 }}>已保存定义:</Text>
              {savedDefs.map((d) => (
                <Tag key={d.id} color="blue" style={{ cursor: 'pointer' }} onClick={() => handleLoadDef(d)}>
                  {d.name}
                  {/* 报表历史「已推送」状态 */}
                  {pushedIds.has(d.id) && (
                    <span style={{ marginLeft: 6, color: '#059669', fontWeight: 700 }}>· 已推送</span>
                  )}
                  <Trash2 size={10} style={{ marginLeft: 4, verticalAlign: -1 }} onClick={(e) => { e.stopPropagation(); handleDeleteDef(d.id) }} />
                </Tag>
              ))}
            </div>
          )}
          <Alert
            type={usingFallback ? 'warning' : 'success'}
            showIcon
            message={sourceLabel ?? (selectedFields.length ? '加载中...' : '请至少选择一个指标字段')}
            description={usingFallback ? 'OLAP 接口不可用, 已回退到统计/BI 快照 (单行估算数据)' : '数据来源: OLAP 聚合接口'}
          />
        </div>
      </Card>

      <Card
        size="small"
        title={<Space><BarChart3 size={14} />预览 <Tag style={{ fontSize: 10 }}>{rows.length} 行</Tag></Space>}
        extra={
          <Space size={4}>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>刷新</Button>
            <Button size="small" type="primary" icon={<Download size={12} />} onClick={handleExportCsv} disabled={!rows.length}>导出 CSV</Button>
          </Space>
        }
        style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        {chartRows.length > 0 ? (
          <>
            <Chart type="bar" data={chartRows as Record<string, unknown>[]} xKey="name" yKeys={chartYKeys} height={280} />
            <ProTable<Record<string, unknown>>
              columns={Object.keys(chartRows[0] ?? {}).map((key) => ({
                key,
                dataIndex: key,
                title: key,
                width: key === 'period' ? 200 : 140,
                render: (val: unknown) => typeof val === 'number' ? (Number.isInteger(val) ? val.toLocaleString() : val.toFixed(2)) : String(val ?? '-'),
              }))}
              dataSource={previewPageData}
              rowKey={(r) => String(r.period ?? '')}
              loading={loading}
              showToolbar={false}
              pagination={previewPagination}
              scroll={{ x: 'max-content', y: 260 }}
              size="small"
            />
          </>
        ) : (
          <Empty image={<Inbox size={40} style={{ opacity: 0.4 }} />} description="选择字段后自动生成预览" />
        )}
      </Card>
    </div>
  )
}

const PAGE_SIZE = 20

// ═══════════ [G005 v3.0.6.11-99 Wave 5A] 自定义报表中心 (定义管理) ═══════════
// 列表: 名称/类别/周期/数据源/定时/状态 · 新建/编辑 Modal (字段目录多选) · 行操作
// 运行→结果表格 / 历史 Drawer / 定时设置 Modal (联动推送) / 导出 CSV / 「定时报表」筛选 Tab / 数据源徽标

const PERIOD_LABELS_FULL: Record<string, string> = { daily: '日', weekly: '周', monthly: '月', quarterly: '季', yearly: '年' }

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
  { label: '每周一 08:00', value: 'weekly: 周一 08:00' },
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

function groupCatalog(catalog: CustomReportField[]) {
  const groups: Array<{ label: string; source: string; options: Array<{ label: string; value: string }> }> = []
  for (const source of ['olap', 'stats', 'bi']) {
    const kindLabel = source === 'olap' ? 'OLAP 指标' : source === 'stats' ? '统计快照 (stats)' : 'BI 指标 (bi)'
    const items = catalog.filter((f) => f.source === source)
    if (items.length === 0) continue
    const measures = items.filter((f) => f.kind !== 'dimension').map((f) => ({ label: `${f.name}${f.unit ? ` (${f.unit})` : ''}`, value: f.id }))
    const dims = items.filter((f) => f.kind === 'dimension').map((f) => ({ label: `${f.name} (维度)`, value: f.id }))
    if (measures.length > 0) groups.push({ label: `${kindLabel} · 指标`, source, options: measures })
    if (dims.length > 0) groups.push({ label: `${kindLabel} · 维度`, source, options: dims })
  }
  return groups
}

function CustomReportCenter() {
  const [defs, setDefs] = useState<ApiReportDef[]>([])
  const [catalog, setCatalog] = useState<CustomReportField[]>([])
  const [loading, setLoading] = useState(false)
  const [filterTab, setFilterTab] = useState<'all' | 'scheduled'>('all')

  // 新建/编辑 Modal
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ApiReportDef | null>(null)
  const [form, setForm] = useState({
    name: '',
    category: '自定义报表',
    description: '',
    dataSource: 'olap',
    period: 'monthly',
    fields: ['exam_count', 'report_count'],
  })

  // 结果 / 历史 / 定时
  const [resultDef, setResultDef] = useState<ApiReportDef | null>(null)
  const [result, setResult] = useState<ReportRunResult | null>(null)
  const [resultLoading, setResultLoading] = useState(false)
  const [historyDef, setHistoryDef] = useState<ApiReportDef | null>(null)
  const [history, setHistory] = useState<RunHistoryEntry[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [scheduleDef, setScheduleDef] = useState<ApiReportDef | null>(null)
  const [scheduleText, setScheduleText] = useState('')
  const [recipients, setRecipients] = useState<string[]>(['current'])
  const [saving, setSaving] = useState(false)
  const [runningId, setRunningId] = useState<string | null>(null)

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

  const filteredDefs = useMemo(
    () => (filterTab === 'scheduled' ? defs.filter((d) => d.schedule) : defs),
    [defs, filterTab],
  )

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', category: '自定义报表', description: '', dataSource: 'olap', period: 'monthly', fields: ['exam_count', 'report_count'] })
    setModalOpen(true)
  }

  const openEdit = (def: ApiReportDef) => {
    setEditing(def)
    setForm({
      name: def.name,
      category: def.category,
      description: def.description,
      dataSource: def.dataSource,
      period: def.period,
      fields: [...def.fields],
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.name.trim()) { message.warning('请输入报表名称'); return }
    if (form.fields.length === 0) { message.warning('请至少选择一个字段'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description,
        fields: form.fields,
        period: form.period,
        dataSource: form.dataSource,
      }
      const res = editing
        ? await customReportApi.update(editing.id, payload)
        : await customReportApi.create(payload)
      if (!res.success) {
        message.warning(res.error?.message ?? '保存失败')
        return
      }
      message.success(editing ? `报表「${form.name}」已更新` : `报表「${form.name}」已创建`)
      setModalOpen(false)
      void loadAll()
    } catch {
      message.error('保存失败')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (def: ApiReportDef) => {
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

  const handleRun = async (def: ApiReportDef) => {
    setRunningId(def.id)
    try {
      const res = await customReportApi.run(def.id)
      if (!res.success || !res.data) {
        message.warning(res.error?.message ?? '执行失败')
        return
      }
      setResult(res.data)
      setResultDef(def)
      void loadAll()
    } catch {
      message.error('执行失败')
    } finally {
      setRunningId(null)
    }
  }

  const openResult = async (def: ApiReportDef) => {
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

  const openHistory = async (def: ApiReportDef) => {
    setHistoryDef(def)
    setHistory([])
    setHistoryLoading(true)
    const res = await customReportApi.getHistory(def.id)
    if (res.success && Array.isArray(res.data)) setHistory(res.data)
    setHistoryLoading(false)
  }

  const openSchedule = (def: ApiReportDef) => {
    setScheduleDef(def)
    setScheduleText(def.schedule ?? 'weekly: 周一 08:00')
    setRecipients(def.recipients.length > 0 ? [...def.recipients] : ['current'])
  }

  const handleSaveSchedule = async () => {
    if (!scheduleDef) return
    if (!scheduleText.trim()) { message.warning('请选择定时规则'); return }
    if (recipients.length === 0) { message.warning('请至少选择一位订阅人'); return }
    setSaving(true)
    try {
      const res = await customReportApi.setSchedule(scheduleDef.id, { schedule: scheduleText, recipients })
      if (!res.success) {
        message.warning(res.error?.message ?? '定时设置失败')
        return
      }
      message.success(`报表「${scheduleDef.name}」定时已保存, 订阅通知已推送`)
      setScheduleDef(null)
      void loadAll()
    } catch {
      message.error('定时设置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (def: ApiReportDef) => {
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

  const fieldGroups = useMemo(() => groupCatalog(catalog), [catalog])

  const defColumns: ProColumn<ApiReportDef>[] = [
    {
      key: 'name',
      dataIndex: 'name',
      title: '名称',
      width: 200,
      searchable: true,
      render: (val: unknown, record: ApiReportDef) => (
        <Space size={6}>
          <span style={{ fontWeight: 600 }}>{String(val)}</span>
          <Tag color={DS_BADGES[record.dataSource]?.color ?? 'default'} style={{ margin: 0, fontSize: 10 }}>
            {DS_BADGES[record.dataSource]?.label ?? record.dataSource}
          </Tag>
        </Space>
      ),
    },
    { key: 'category', dataIndex: 'category', title: '类别', width: 100 },
    {
      key: 'period',
      dataIndex: 'period',
      title: '周期',
      width: 70,
      render: (val: unknown) => PERIOD_LABELS_FULL[String(val)] ?? String(val ?? '-'),
    },
    {
      key: 'fields',
      dataIndex: 'fields',
      title: '字段',
      width: 220,
      render: (val: unknown) => {
        const list = val as string[]
        if (!Array.isArray(list) || list.length === 0) return '-'
        const names = list.slice(0, 3).map((f) => catalog.find((c) => c.id === f)?.name ?? f)
        const rest = list.length > 3 ? ` 等${list.length}个` : ''
        return <span style={{ fontSize: 12 }}>{names.join('、')}{rest}</span>
      },
    },
    {
      key: 'schedule',
      dataIndex: 'schedule',
      title: '定时',
      width: 140,
      render: (val: unknown) => (val ? <Tag color="gold" icon={<Clock size={10} />}>{String(val)}</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>未设置</Text>),
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
      width: 150,
      render: (val: unknown) => (val ? dayjs(String(val)).format('MM-DD HH:mm') : <Text type="secondary">-</Text>),
    },
    {
      key: 'actions',
      title: '操作',
      width: 300,
      fixed: 'right',
      render: (_val: unknown, record: ApiReportDef) => (
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
                { key: 'all', label: `全部 (${defs.length})` },
                { key: 'scheduled', label: `定时报表 (${defs.filter((d) => d.schedule).length})` },
              ]}
              style={{ margin: 0 }}
            />
            <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openCreate}>新建报表</Button>
          </Space>
        }
      >
        <ProTable<ApiReportDef>
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

      {/* 结果 Drawer */}
      <Drawer
        title={resultDef ? `运行结果: ${resultDef.name}` : '运行结果'}
        width={760}
        open={!!resultDef}
        onClose={() => setResultDef(null)}
      >
        {resultLoading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin /></div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Alert
              type="success"
              showIcon
              message={`数据源: ${result.source} · ${result.rows.length} 行 · ${dayjs(result.generatedAt).format('YYYY-MM-DD HH:mm:ss')}`}
              description={`周期: ${PERIOD_LABELS_FULL[result.summary.period as string] ?? result.summary.period ?? '-'} · 数据源类型: ${result.summary.dataSource ?? '-'} · 执行ID: ${result.id}`}
            />
            <ProTable<Record<string, unknown>>
              columns={resultColumns}
              dataSource={result.rows}
              rowKey={(r) => String(r['周期'] ?? '')}
              showToolbar={false}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              scroll={{ x: 'max-content', y: 320 }}
              size="small"
            />
          </div>
        ) : (
          <Empty description="暂无结果, 请先点击「运行」" />
        )}
      </Drawer>

      {/* 历史 Drawer */}
      <Drawer
        title={historyDef ? `执行历史: ${historyDef.name}` : '执行历史'}
        width={620}
        open={!!historyDef}
        onClose={() => setHistoryDef(null)}
      >
        <ProTable<RunHistoryEntry>
          columns={[
            {
              key: 'ranAt',
              dataIndex: 'ranAt',
              title: '执行时间',
              width: 160,
              render: (val: unknown) => dayjs(String(val)).format('YYYY-MM-DD HH:mm:ss'),
            },
            {
              key: 'status',
              dataIndex: 'status',
              title: '状态',
              width: 90,
              render: (val: unknown) => (
                <Tag color={String(val) === 'success' ? 'success' : 'error'}>{String(val) === 'success' ? '成功' : '失败'}</Tag>
              ),
            },
            { key: 'rowCount', dataIndex: 'rowCount', title: '行数', width: 70 },
            { key: 'message', dataIndex: 'message', title: '说明', width: 200 },
          ]}
          dataSource={history}
          rowKey="id"
          loading={historyLoading}
          showToolbar={false}
          pagination={{ pageSize: 8, showSizeChanger: false }}
          scroll={{ y: 360 }}
          size="small"
        />
      </Drawer>

      {/* 新建/编辑 Modal */}
      <Modal
        title={editing ? `编辑报表: ${editing.name}` : '新建自定义报表'}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editing ? '保存' : '创建'}
        cancelText="取消"
        confirmLoading={saving}
        width={680}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>报表名称</Text>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="如: 月度检查收入分析" style={{ width: 300 }} />
          </Space>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>类别</Text>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="如: 日常统计" style={{ width: 180 }} />
          </Space>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>数据源</Text>
            <Radio.Group
              value={form.dataSource}
              onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
              options={DATA_SOURCE_OPTIONS}
            />
          </Space>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>周期</Text>
            <Select
              value={form.period}
              onChange={(v) => setForm({ ...form, period: v })}
              style={{ width: 120 }}
              options={Object.entries(PERIOD_LABELS_FULL).map(([value, label]) => ({ value, label }))}
            />
          </Space>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>指标字段 (多选, 来自字段目录)</Text>
            <Select
              mode="multiple"
              value={form.fields}
              onChange={(vals) => setForm({ ...form, fields: vals })}
              style={{ width: '100%' }}
              placeholder="选择字段"
              maxTagCount={6}
              optionFilterProp="label"
              options={fieldGroups.map((g) => ({ label: g.label, options: g.options }))}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 4 }}>
              数据源将决定执行方式: OLAP 字段按周期聚合, stats/bi 字段为快照值
            </Text>
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>说明</Text>
            <Input.TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder="报表用途说明 (可选)" />
          </div>
        </div>
      </Modal>

      {/* 定时设置 Modal */}
      <Modal
        title={scheduleDef ? `定时设置: ${scheduleDef.name}` : '定时设置'}
        open={!!scheduleDef}
        onOk={() => void handleSaveSchedule()}
        onCancel={() => setScheduleDef(null)}
        okText="保存并推送通知"
        cancelText="取消"
        confirmLoading={saving}
        width={520}
      >
        {scheduleDef && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 8 }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>定时规则</Text>
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
              <Text strong style={{ display: 'block', marginBottom: 6 }}>订阅人 (推送通知对象)</Text>
              <Select
                mode="tags"
                value={recipients}
                onChange={setRecipients}
                style={{ width: '100%' }}
                placeholder="输入用户ID后回车, 默认 current"
                options={[{ label: '当前用户 (current)', value: 'current' }, { label: '科主任 (D002)', value: 'D002' }, { label: '质控组长 (D003)', value: 'D003' }]}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

// [v3.0.6.11-99 Wave 5A] 自定义报表中心入口: 定义管理 (新) + 简易生成器 (Wave 4A 简化版兼容)
function CustomReportCenterRoot() {
  return (
    <Tabs
      defaultActiveKey="defs"
      items={[
        { key: 'defs', label: '报表定义管理', children: <CustomReportCenter /> },
        { key: 'builder', label: '简易生成器', children: <CustomReportBuilder /> },
      ]}
    />
  )
}

export default function DataReportCenterPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>(reportDefinitions[0]!.id)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [granularity, setGranularity] = useState('monthly')
  const [searchText, setSearchText] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [activeCategory] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['exam-volume-monthly', 'device-utilization', 'qc-score-distribution']))
  const [showInsight, setShowInsight] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [loading, setLoading] = useState(false)
  // [G005 v3.0.6.11-90 Wave 4A (PACS P0-4)] 视图切换: 标准报表 / 自定义报表
  const [viewMode, setViewMode] = useState<'standard' | 'custom'>('standard')

  const currentReport = useMemo(
    () => reportDefinitions.find((r) => r.id === selectedReportId),
    [selectedReportId],
  )

  const filteredDefs = useMemo(() => {
    if (!searchText && !activeCategory) return reportDefinitions
    return reportDefinitions.filter((r) => {
      const matchSearch = !searchText || r.name.includes(searchText) || r.description.includes(searchText)
      const matchCat = !activeCategory || r.category === activeCategory
      return matchSearch && matchCat
    })
  }, [searchText, activeCategory])

  const treeData = useMemo(() => buildTreeData(filteredDefs), [filteredDefs])

  const [olapData, setOlapData] = useState<Record<string, unknown>[] | null>(null)
  const [olapLoading, setOlapLoading] = useState(false)
  // [G005 W2-B] 刷新真实化: datareportApi 快照 (dataReportApi 对应方法重拉)
  const [apiSnapshot, setApiSnapshot] = useState<{ reports: number; trends: number } | null>(null)
  // [G005 Wave2A P1] OLAP 失败回退 generateMockReportData → 显示「演示数据」徽标 (仅回退态)
  const [usingFallback, setUsingFallback] = useState(false)

  const loadOlap = useCallback(async () => {
    setOlapLoading(true)
    setOlapData(null)
    const startDate = dateRange[0]?.format('YYYY-MM-DD') || '2026-01-01'
    const endDate = dateRange[1]?.format('YYYY-MM-DD') || '2026-12-31'
    try {
      // [v3.0.6.11-88 Round10] raw fetch → olapApi.query (后端 olap.controller @Post('query') 真实存在)
      const r = await olapApi.query({
        dimensions: ['date', 'modality'],
        measures: ['exam_count', 'exam_revenue'],
        filters: [
          { dimension: 'date', operator: 'between', value: [startDate, endDate] },
        ],
        granularity: granularity,
      })
      const data = r.data as { rows?: Record<string, unknown>[] } | null
      if (r.success && data?.rows?.length) {
        setOlapData(data.rows)
      } else {
        setOlapData(null)
      }
    } catch {
      setOlapData(null)
    } finally {
      setOlapLoading(false)
    }
  }, [dateRange, granularity])

  // [G005 W2-B] 刷新真实化: datareportApi 快照 (listDataReports + getMonthlyTrends)
  const loadApiSnapshot = useCallback(async () => {
    const [reportsRes, trendsRes] = await Promise.allSettled([
      datareportApi.listDataReports(),
      datareportApi.getMonthlyTrends(),
    ])
    const reports = reportsRes.status === 'fulfilled' && reportsRes.value.success && Array.isArray(reportsRes.value.data)
      ? reportsRes.value.data.length
      : 0
    const trends = trendsRes.status === 'fulfilled' && trendsRes.value.success && Array.isArray(trendsRes.value.data)
      ? trendsRes.value.data.length
      : 0
    setApiSnapshot({ reports, trends })
  }, [])

  useEffect(() => {
    if (!currentReport) return
    void loadOlap()
  }, [currentReport, loadOlap])

  useEffect(() => {
    void loadApiSnapshot()
  }, [loadApiSnapshot])

  // [G005 W2-B] 刷新: 失效 datareportApi 内存缓存 → 重拉 OLAP + datareportApi 快照
  const handleRefresh = useCallback(async () => {
    setLoading(true)
    await invalidateApiCacheByPrefix('/data-report')
    await Promise.all([loadOlap(), loadApiSnapshot()])
    setLoading(false)
    message.success('数据已重新拉取')
  }, [loadOlap, loadApiSnapshot])

  const chartData = useMemo(() => {
    if (!currentReport) return []
    if (olapData && olapData.length > 0) {
      if (usingFallback) setUsingFallback(false)
      return olapData
    }
    setLoading(true)
    setUsingFallback(true)
    const result = generateMockReportData(currentReport.id, [dateRange[0]?.format('YYYY-MM-DD') || '2026-01-01', dateRange[1]?.format('YYYY-MM-DD') || '2026-12-31'])
    setLoading(false)
    return result
  }, [currentReport, dateRange, olapData])

  const insightText = useMemo(() => {
    if (!currentReport || chartData.length === 0) return ''
    return generateReportInsight(currentReport, chartData)
  }, [currentReport, chartData])

  const tableColumns: ProColumn<Record<string, unknown>>[] = useMemo(() => {
    if (!chartData.length) return []
    const keys = Object.keys(chartData[0]!)
    return keys.map((key) => ({
      key,
      dataIndex: key,
      title: key,
      width: key === 'name' ? 140 : 120,
      searchable: true,
      sorter: (a: Record<string, unknown>, b: Record<string, unknown>) => {
        const left = a[key]
        const right = b[key]
        if (typeof left === 'number' && typeof right === 'number') return left - right
        return String(left ?? '').localeCompare(String(right ?? ''), 'zh-CN')
      },
      render: (val: unknown) => {
        if (typeof val === 'number') {
          if (val > 10000) return `${(val / 10000).toFixed(1)}万`
          if (Number.isInteger(val)) return val.toLocaleString()
          return val.toFixed(1)
        }
        return String(val ?? '-')
      },
    }))
  }, [chartData])

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const favoriteDefs = useMemo(
    () => reportDefinitions.filter((r) => favorites.has(r.id)),
    [favorites],
  )

  const handleExportCsv = useCallback(() => {
    if (!chartData.length) return
    const keys = Object.keys(chartData[0]!)
    const header = keys.join(',')
    const rows = chartData.map((row) => keys.map((k) => String(row[k] ?? '')).join(','))
    const bom = '\uFEFF'
    const blob = new Blob([bom + header + '\n' + rows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${currentReport?.id || 'report'}-${dayjs().format('YYYYMMDD')}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('CSV导出成功')
  }, [chartData, currentReport])

  const handleExportPng = useCallback(() => {
    const svg = document.querySelector('.report-chart-area svg')
    if (!svg) { message.warning('未找到图表'); return }
    const clone = svg.cloneNode(true) as SVGSVGElement
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(clone)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    const img = new Image()
    img.onload = () => {
      canvas.width = img.width * 2
      canvas.height = img.height * 2
      ctx!.scale(2, 2)
      ctx!.fillStyle = '#ffffff'
      ctx!.fillRect(0, 0, canvas.width, canvas.height)
      ctx!.drawImage(img, 0, 0)
      canvas.toBlob((blob) => {
        if (!blob) return
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${currentReport?.id || 'chart'}-${dayjs().format('YYYYMMDD')}.png`
        a.click()
        URL.revokeObjectURL(url)
        message.success('PNG导出成功')
      })
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
  }, [currentReport])

  const chartType = currentReport?.chartType || 'bar'
  const yKeys = currentReport?.measures || ['value']

  useEffect(() => {
    const cats = [...new Set(reportDefinitions.map((d) => d.category))]
    setExpandedKeys(cats)
  }, [])

  return (
    <Layout
      style={{
        minHeight: '100vh',
        background: 'var(--bg-card)',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 1000 : undefined,
      }}
    >
      <Header
        style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
          padding: '0 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          flexShrink: 0,
        }}
      >
        <Space size={12}>
          <Database size={22} color="#fff" />
          <Title level={5} style={{ color: '#fff', margin: 0, fontSize: 16 }}>
            数据报表中心
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            {reportDefinitions.length}种报表 · 三甲医院RIS系统
          </Text>
          {apiSnapshot && (
            <Tag color="green" style={{ fontSize: 11, margin: 0 }}>
              数据上报接口: {apiSnapshot.reports} 条报表 · {apiSnapshot.trends} 条月度趋势
            </Tag>
          )}
          {usingFallback && (
            <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>
              演示数据（OLAP 接口回退）
            </Tag>
          )}
        </Space>
        <Space size={8}>
          <Select
            value={viewMode}
            onChange={setViewMode}
            size="small"
            options={[
              { label: '标准报表', value: 'standard' },
              { label: '自定义报表', value: 'custom' },
            ]}
            style={{ width: 120, background: 'rgba(255,255,255,0.15)', borderRadius: 6 }}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) setDateRange([dates[0], dates[1]])
            }}
            size="small"
            style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', color: '#fff' }}
          />
          <Select
            value={granularity}
            onChange={setGranularity}
            size="small"
            options={granularityOptions}
            style={{ width: 80 }}
          />
          <Tooltip title="刷新数据">
            <Button
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={() => void handleRefresh()}
              loading={loading || olapLoading}
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)' }}
            />
          </Tooltip>
          <Tooltip title={fullscreen ? '退出全屏' : '全屏模式'}>
            <Button
              size="small"
              icon={fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              onClick={() => setFullscreen((v) => !v)}
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)' }}
            />
          </Tooltip>
        </Space>
      </Header>
      <Layout style={{ flex: 1, background: 'var(--bg-card)' }}>
        <Sider
          width={280}
          style={{
            background: 'var(--bg-card)',
            borderRight: '1px solid var(--border-color)',
            overflow: 'auto',
            height: fullscreen ? 'calc(100vh - 56px)' : 'calc(100vh - 56px)',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)' }}>
            <Input
              prefix={<Search size={14} style={{ color: 'var(--text-secondary)' }} />}
              placeholder="搜索报表名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="small"
              allowClear
            />
          </div>
          {favoriteDefs.length > 0 && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <Text strong style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Star size={12} /> 收藏报表 ({favoriteDefs.length})
              </Text>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {favoriteDefs.slice(0, 5).map((r) => (
                  <Tag
                    key={r.id}
                    style={{ cursor: 'pointer', margin: 0 }}
                    color={r.id === selectedReportId ? 'blue' : 'default'}
                    onClick={() => setSelectedReportId(r.id)}
                  >
                    {r.name}
                  </Tag>
                ))}
              </div>
            </div>
          )}
          <div style={{ padding: '8px 0' }}>
            <Collapse
              ghost
              expandIconPlacement="end"
              activeKey={expandedKeys}
              onChange={(keys) => setExpandedKeys(keys as string[])}
              size="small"
              items={treeData.map((cat) => ({
                key: cat.key,
                label: (
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {cat.title}
                    <Tag style={{ marginLeft: 6, fontSize: 10 }}>{cat.children?.length || 0}</Tag>
                  </span>
                ),
                children: (
                  <Menu
                    mode="inline"
                    selectedKeys={[selectedReportId]}
                    style={{ border: 'none' }}
                    items={cat.children?.map((child) => ({
                      key: child.key,
                      label: (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: 13,
                          }}
                        >
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {child.title}
                          </span>
                          <Tooltip title={favorites.has(child.key as string) ? '取消收藏' : '收藏'}>
                            <span
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(child.key as string) }}
                              style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
                            >
                              {favorites.has(child.key as string) ? (
                                <Star size={12} fill="#f59e0b" color="#f59e0b" />
                              ) : (
                                <StarOff size={12} color="var(--text-secondary)" />
                              )}
                            </span>
                          </Tooltip>
                        </div>
                      ),
                    }))}
                    onClick={({ key }) => setSelectedReportId(key)}
                  />
                ),
              }))}
            />
          </div>
        </Sider>
        <Content style={{ padding: 16, overflow: 'auto', height: fullscreen ? 'calc(100vh - 56px)' : 'calc(100vh - 56px)' }}>
          {viewMode === 'custom' ? (
            <CustomReportCenterRoot />
          ) : currentReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Space size={8} align="center">
                    <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                      {currentReport.name}
                    </Title>
                    <Tag color="blue">{currentReport.category}</Tag>
                    <Tooltip title={favorites.has(currentReport.id) ? '取消收藏' : '收藏'}>
                      <span
                        onClick={() => toggleFavorite(currentReport.id)}
                        style={{ cursor: 'pointer', display: 'flex' }}
                      >
                        {favorites.has(currentReport.id) ? (
                          <Star size={16} fill="#f59e0b" color="#f59e0b" />
                        ) : (
                          <StarOff size={16} color="var(--text-secondary)" />
                        )}
                      </span>
                    </Tooltip>
                  </Space>
                  <Text style={{ color: 'var(--text-secondary)', fontSize: 12, display: 'block', marginTop: 2 }}>
                    {currentReport.description}
                  </Text>
                </div>
                <Space size={4}>
                  <Button size="small" icon={<Download size={14} />} onClick={handleExportCsv}>
                    CSV
                  </Button>
                  <Button size="small" icon={<FileSpreadsheet size={14} />} onClick={handleExportPng}>
                    PNG
                  </Button>
                </Space>
              </div>
              <Spin spinning={loading}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <Card
                    size="small"
                    className="report-chart-area"
                    style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    <Chart
                      type={chartType as Parameters<typeof Chart>[0]['type']}
                      data={chartData as Record<string, unknown>[]}
                      xKey="name"
                      yKeys={yKeys}
                      height={380}
                      title={currentReport.name}
                    />
                  </Card>
                  <Card
                    size="small"
                    extra={
                      <Switch
                        size="small"
                        checked={showInsight}
                        onChange={setShowInsight}
                        checkedChildren="开"
                        unCheckedChildren="关"
                      />
                    }
                    title={
                      <Space size={6}>
                        <Lightbulb size={14} color="#f59e0b" />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>AI 智能洞察</span>
                      </Space>
                    }
                    style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    {showInsight ? (
                      <div style={{ fontSize: 13, lineHeight: 1.8, color: 'var(--text-primary)', padding: '4px 0' }}>
                        {insightText || (
                          <Text type="secondary">暂无数据，无法生成洞察分析。</Text>
                        )}
                      </div>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        AI洞察已关闭，可点击开关开启。
                      </Text>
                    )}
                  </Card>
                  <Card
                    size="small"
                    title={
                      <Space size={6}>
                        <Table2 size={14} />
                        <span style={{ fontSize: 13, fontWeight: 600 }}>数据明细</span>
                        <Tag style={{ fontSize: 10 }}>{chartData.length} 行</Tag>
                      </Space>
                    }
                    style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    <ProTable<Record<string, unknown>>
                      columns={tableColumns}
                      dataSource={chartData as Record<string, unknown>[]}
                      rowKey="name"
                      loading={loading || olapLoading}
                      showToolbar={false}
                      pagination={{
                        current: tablePage,
                        pageSize: PAGE_SIZE,
                        onChange: setTablePage,
                      }}
                      scroll={{ x: 'max-content', y: 320 }}
                      size="small"
                    />
                  </Card>
                </div>
              </Spin>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="请从左侧选择报表" />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
