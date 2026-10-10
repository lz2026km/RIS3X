import dayjs from 'dayjs'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ComposedChart, FunnelChart, Funnel, RadialBarChart, RadialBar,
  XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, Legend, Cell,
} from 'recharts'
import { ChartContainer, chartDefaults } from '../components/charts'
import { ProTable } from '../components/data/ProTable'
import { ProColumn } from '../components/data/ProTable'
import { generateMockReportData } from '../data/mockReportData'
import { reportDefinitions } from '../data/reportDefinitions'
import { ReportDefinition } from '../data/reportDefinitions'
import { t } from '../i18n/appI18n'
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

const REPORT_CHART_COLORS = [
  'var(--color-primary-500)', '#10b981', 'var(--color-warning-500)', 'var(--color-error-500)', '#8b5cf6',
  '#ec4899', 'var(--color-info-500)', '#84cc16', '#f97316', '#6366f1',
]

type ReportChartType = 'line' | 'bar' | 'pie' | 'area' | 'radar' | 'stacked-bar' | 'composed' | 'funnel' | 'heatmap' | 'radialBar'

interface ReportChartProps {
  type: ReportChartType
  data: Record<string, unknown>[]
  xKey: string
  yKeys: string[]
  height?: number
  title?: string
}

function ReportChart({ type, data, xKey, yKeys, height = 280, title }: ReportChartProps) {
  const colors = REPORT_CHART_COLORS
  const valueKey = yKeys[0] ?? 'value'
  const containerType: 'line' | 'bar' | 'area' | 'pie' | 'radar' | 'composed' | 'other' =
    type === 'stacked-bar' || type === 'heatmap' ? 'bar'
      : type === 'radialBar' || type === 'funnel' ? 'other'
        : type

  const chart = (() => {
    switch (type) {
      case 'line':
        return (
          <LineChart data={data} margin={chartDefaults.margin}>
            <CartesianGrid {...chartDefaults.grid} />
            <XAxis dataKey={xKey} {...chartDefaults.axis} />
            <YAxis {...chartDefaults.axis} />
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
            {yKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        )
      case 'bar':
        return (
          <BarChart data={data} margin={chartDefaults.margin}>
            <CartesianGrid {...chartDefaults.grid} />
            <XAxis dataKey={xKey} {...chartDefaults.axis} />
            <YAxis {...chartDefaults.axis} />
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
            {yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )
      case 'stacked-bar':
        return (
          <BarChart data={data} margin={chartDefaults.margin}>
            <CartesianGrid {...chartDefaults.grid} />
            <XAxis dataKey={xKey} {...chartDefaults.axis} />
            <YAxis {...chartDefaults.axis} />
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
            {yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="stack" fill={colors[i % colors.length]} />
            ))}
          </BarChart>
        )
      case 'area':
        return (
          <AreaChart data={data} margin={chartDefaults.margin}>
            <CartesianGrid {...chartDefaults.grid} />
            <XAxis dataKey={xKey} {...chartDefaults.axis} />
            <YAxis {...chartDefaults.axis} />
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
            {yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.2} strokeWidth={2} />
            ))}
          </AreaChart>
        )
      case 'pie':
        return (
          <PieChart>
            <Pie data={data} dataKey={valueKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={Math.min(height / 2 - 40, 140)} label>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
          </PieChart>
        )
      case 'radar':
        return (
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <PolarGrid stroke={chartDefaults.grid.stroke} />
            <PolarAngleAxis dataKey={xKey} tick={{ fontSize: 11, fill: 'var(--text-secondary, #475569)' }} />
            <PolarRadiusAxis />
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
            {yKeys.map((key, i) => (
              <Radar key={key} name={key} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.2} />
            ))}
          </RadarChart>
        )
      case 'composed':
        return (
          <ComposedChart data={data} margin={chartDefaults.margin}>
            <CartesianGrid {...chartDefaults.grid} />
            <XAxis dataKey={xKey} {...chartDefaults.axis} />
            <YAxis {...chartDefaults.axis} />
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
            {yKeys.map((key, i) => {
              if (i === 0) return <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              return <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} />
            })}
          </ComposedChart>
        )
      case 'funnel':
        return (
          <FunnelChart>
            <RTooltip {...chartDefaults.tooltip} />
            <Funnel dataKey={valueKey} data={data} isAnimationActive>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Funnel>
          </FunnelChart>
        )
      case 'heatmap':
        return (
          <ComposedChart data={data} margin={chartDefaults.margin}>
            <CartesianGrid stroke={chartDefaults.grid.stroke} />
            <XAxis dataKey={xKey} {...chartDefaults.axis} />
            <YAxis {...chartDefaults.axis} />
            <RTooltip {...chartDefaults.tooltip} />
            <Bar dataKey={valueKey}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </ComposedChart>
        )
      case 'radialBar':
        return (
          <RadialBarChart data={data} cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={12}>
            <RadialBar dataKey={valueKey} background>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </RadialBar>
            <RTooltip {...chartDefaults.tooltip} />
            <Legend />
          </RadialBarChart>
        )
      default:
        return <div style={{ padding: 'var(--space-10, 40px)', textAlign: 'center', color: '#94a3b8' }}>不支持的图表类型: {type}</div>
    }
  })()

  return (
    <ChartContainer type={containerType} height={height} title={title}>
      {chart}
    </ChartContainer>
  )
}

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
  { label: t('dataReportCenter.periodDay'), value: 'daily' },
  { label: t('dataReportCenter.periodWeek'), value: 'weekly' },
  { label: t('dataReportCenter.periodMonth'), value: 'monthly' },
  { label: t('dataReportCenter.periodQuarter'), value: 'quarterly' },
  { label: t('dataReportCenter.periodYear'), value: 'yearly' },
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
  { key: 'exam_count', label: t('dataReportCenter.fieldExamCount'), measure: 'exam_count', olap: true },
  { key: 'report_count', label: t('dataReportCenter.fieldReportCount'), measure: 'report_count', olap: true },
  { key: 'exam_revenue', label: t('dataReportCenter.fieldRevenue'), measure: 'exam_revenue', olap: true },
  { key: 'workload', label: t('dataReportCenter.fieldWorkload'), measure: 'device_daily_exams', olap: true },
  { key: 'device_usage_rate', label: t('dataReportCenter.fieldDeviceUsageRate'), measure: 'device_usage_rate', olap: true },
  { key: 'report_timely_rate', label: t('dataReportCenter.fieldTimelyRate'), measure: 'report_timely_rate', olap: true },
  { key: 'positive_rate', label: t('dataReportCenter.fieldAccuracy'), measure: 'positive_rate', olap: true },
]

const CUSTOM_PERIODS = [
  { label: t('dataReportCenter.periodDay'), value: 'daily' },
  { label: t('dataReportCenter.periodWeek'), value: 'weekly' },
  { label: t('dataReportCenter.periodMonth'), value: 'monthly' },
]

const PERIOD_LABELS: Record<string, string> = { daily: t('dataReportCenter.periodDay'), weekly: t('dataReportCenter.periodWeek'), monthly: t('dataReportCenter.periodMonth') }

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
        return { value: Math.round(count * 1250), source: t('dataReportCenter.srcEstimated') }
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
    return { value: 0, source: t('dataReportCenter.srcFallbackFailed') }
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
        setSourceLabel(t('dataReportCenter.srcOlapAgg', { period: PERIOD_LABELS[period] ?? period }))
        return
      }
    } catch {
      /* 回退到快照 */
    }
    // 失败回退: 单行快照 (statsApi/biApi/analyticsStatsApi)
    const snapshots = await Promise.all(selectedFields.map((f) => fetchFieldSnapshot(f.key)))
    const row: Record<string, unknown> = { period: t('dataReportCenter.snapshotRange', { start: startDate, end: endDate }) }
    selectedFields.forEach((f, i) => {
      row[f.label] = snapshots[i]!.value
    })
    setRows([row])
    setUsingFallback(true)
    setSourceLabel(t('dataReportCenter.srcFallbackSnapshot'))
    setLoading(false)
  }, [selectedFields, dateRange, period])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const handleExportCsv = useCallback(() => {
    if (!rows.length) { message.warning(t('dataReportCenter.noPreviewData')); return }
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
    message.success(t('dataReportCenter.csvExportSuccess'))
  }, [rows])

  const handleSaveDef = useCallback(() => {
    if (!defName.trim()) { message.warning(t('dataReportCenter.enterReportName')); return }
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
    message.success(t('dataReportCenter.defSaved', { name: def.name }))
  }, [defName, fields, period, dateRange, savedDefs])

  const handleLoadDef = useCallback((def: CustomReportDef) => {
    setFields(def.fields)
    setPeriod(def.period)
    if (def.start && def.end) setDateRange([dayjs(def.start), dayjs(def.end)])
    message.success(t('dataReportCenter.defLoaded', { name: def.name }))
  }, [])

  const handleDeleteDef = useCallback((id: string) => {
    const next = savedDefs.filter((d) => d.id !== id)
    localStorage.setItem(DEF_STORAGE_KEY, JSON.stringify(next))
    setSavedDefs(next)
    message.success(t('dataReportCenter.defDeleted'))
  }, [savedDefs])

  // [v3.0.6.11-99] Wave 5B-C: 订阅推送 — 报表生成后创建「报表已生成」通知 (按 recipients)
  const [pushing, setPushing] = useState(false)
  const handlePushReport = useCallback(async () => {
    const def = savedDefs[0] ?? null
    if (!def) { message.warning(t('dataReportCenter.saveOneDefFirst')); return }
    setPushing(true)
    try {
      const summary = t('dataReportCenter.pushSummary', { fields: def.fields.join(', '), period: PERIOD_LABELS[def.period] ?? def.period, start: def.start, end: def.end })
      const res = await notificationsApi.reportGenerated({
        reportId: def.id,
        reportName: def.name,
        recipients: ['current'],
        summary,
        link: '/data-report-center',
      })
      if (!res.success) {
        message.warning(res.error?.message ?? t('dataReportCenter.pushUnavailable'))
        return
      }
      setPushedIds((prev) => {
        const next = new Set(prev).add(def.id)
        try { localStorage.setItem('g005-report-pushed', JSON.stringify(Array.from(next))) } catch { /* ignore */ }
        return next
      })
      message.success(t('dataReportCenter.pushSuccess', { name: def.name }))
    } catch {
      message.error(t('dataReportCenter.pushFailed'))
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
      <Card
        size="small"
        title={<Space><SlidersHorizontal size={14} />{t('dataReportCenter.defConfig')}<Text type="secondary" style={{ fontSize: 12 }}>{t('dataReportCenter.defConfigHint')}</Text></Space>}
        style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          <div>
            <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>{t('dataReportCenter.metricFields')}</Text>
            <Checkbox.Group
              value={fields}
              onChange={(vals) => setFields(vals as string[])}
              options={CUSTOM_FIELDS.map((f) => ({ label: f.label, value: f.key }))}
            />
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap' }}>
            <Space>
              <Text strong style={{ fontSize: 12 }}>{t('dataReportCenter.period')}</Text>
              <Select value={period} onChange={setPeriod} size="small" style={{ width: 80 }} options={CUSTOM_PERIODS} />
            </Space>
            <Space>
              <Text strong style={{ fontSize: 12 }}>{t('dataReportCenter.dateRange')}</Text>
              <DatePicker.RangePicker value={dateRange} onChange={(d) => { if (d?.[0] && d?.[1]) setDateRange([d[0], d[1]]) }} size="small" />
            </Space>
            <Space>
              <Text strong style={{ fontSize: 12 }}>{t('dataReportCenter.reportName')}</Text>
              <Input size="small" value={defName} onChange={(e) => setDefName(e.target.value)} placeholder={t('dataReportCenter.reportNamePlaceholder')} style={{ width: 180 }} />
              <Button size="small" icon={<Save size={12} />} onClick={handleSaveDef}>{t('dataReportCenter.saveDef')}</Button>
              {/* [v3.0.6.11-99] Wave 5B-C: 报表订阅推送 (POST /notifications/report-generated) */}
              <Button size="small" type="primary" icon={<Send size={12} />} loading={pushing} onClick={() => void handlePushReport()}>{t('dataReportCenter.pushNotify')}</Button>
            </Space>
          </div>
          {savedDefs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 12 }}>{t('dataReportCenter.savedDefs')}</Text>
              {savedDefs.map((d) => (
                <Tag key={d.id} color="blue" style={{ cursor: 'pointer' }} onClick={() => handleLoadDef(d)}>
                  {d.name}
                  {/* 报表历史「已推送」状态 */}
                  {pushedIds.has(d.id) && (
                    <span style={{ marginLeft: 6, color: '#059669', fontWeight: 700 }}>{t('dataReportCenter.pushed')}</span>
                  )}
                  <Trash2 size={10} style={{ marginLeft: 'var(--space-1, 4px)', verticalAlign: -1 }} onClick={(e) => { e.stopPropagation(); handleDeleteDef(d.id) }} />
                </Tag>
              ))}
            </div>
          )}
          <Alert
            type={usingFallback ? 'warning' : 'success'}
            showIcon
            message={sourceLabel ?? (selectedFields.length ? t('dataReportCenter.loading') : t('dataReportCenter.selectAtLeastOneField'))}
            description={usingFallback ? t('dataReportCenter.olapUnavailableDesc') : t('dataReportCenter.dataSourceOlapDesc')}
          />
        </div>
      </Card>

      <Card
        size="small"
        title={<Space><BarChart3 size={14} />{t('dataReportCenter.preview')} <Tag style={{ fontSize: 10 }}>{t('dataReportCenter.rowsCount', { count: rows.length })}</Tag></Space>}
        extra={
          <Space size={4}>
            <Button size="small" icon={<RefreshCw size={12} />} onClick={() => void loadData()} loading={loading}>{t('dataReportCenter.refresh')}</Button>
            <Button size="small" type="primary" icon={<Download size={12} />} onClick={handleExportCsv} disabled={!rows.length}>{t('dataReportCenter.exportCsv')}</Button>
          </Space>
        }
        style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
      >
        {chartRows.length > 0 ? (
          <>
            <ReportChart type="bar" data={chartRows as Record<string, unknown>[]} xKey="name" yKeys={chartYKeys} height={280} />
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
          <Empty image={<Inbox size={40} style={{ opacity: 0.4 }} />} description={t('dataReportCenter.emptyPreview')} />
        )}
      </Card>
    </div>
  )
}

const PAGE_SIZE = 20

// ═══════════ [G005 v3.0.6.11-99 Wave 5A] 自定义报表中心 (定义管理) ═══════════
// 列表: 名称/类别/周期/数据源/定时/状态 · 新建/编辑 Modal (字段目录多选) · 行操作
// 运行→结果表格 / 历史 Drawer / 定时设置 Modal (联动推送) / 导出 CSV / 「定时报表」筛选 Tab / 数据源徽标

const PERIOD_LABELS_FULL: Record<string, string> = { daily: t('dataReportCenter.periodDay'), weekly: t('dataReportCenter.periodWeek'), monthly: t('dataReportCenter.periodMonth'), quarterly: t('dataReportCenter.periodQuarter'), yearly: t('dataReportCenter.periodYear') }

const DS_BADGES: Record<string, { color: string; label: string }> = {
  olap: { color: 'blue', label: 'OLAP' },
  stats: { color: 'green', label: 'STATS' },
  bi: { color: 'purple', label: 'BI' },
  mixed: { color: 'orange', label: t('dataReportCenter.mixed') },
}

const STATUS_TAGS: Record<string, { color: string; label: string }> = {
  idle: { color: 'default', label: t('dataReportCenter.statusIdle') },
  running: { color: 'processing', label: t('dataReportCenter.statusRunning') },
  ready: { color: 'success', label: t('dataReportCenter.statusReady') },
  failed: { color: 'error', label: t('dataReportCenter.statusFailed') },
}

const SCHEDULE_OPTIONS = [
  { label: t('dataReportCenter.scheduleDaily'), value: 'daily: 08:00' },
  { label: t('dataReportCenter.scheduleWeekly'), value: 'weekly: 周一 08:00' },
  { label: t('dataReportCenter.scheduleMonthly'), value: 'monthly: 每月1日 09:00' },
  { label: t('dataReportCenter.scheduleQuarterly'), value: 'quarterly: 季度首日 09:00' },
  { label: t('dataReportCenter.scheduleYearly'), value: 'yearly: 1月1日 09:00' },
]

const DATA_SOURCE_OPTIONS = [
  { label: t('dataReportCenter.dsOlap'), value: 'olap' },
  { label: t('dataReportCenter.dsStats'), value: 'stats' },
  { label: t('dataReportCenter.dsBi'), value: 'bi' },
  { label: t('dataReportCenter.mixed'), value: 'mixed' },
]

function groupCatalog(catalog: CustomReportField[]) {
  const groups: Array<{ label: string; source: string; options: Array<{ label: string; value: string }> }> = []
  for (const source of ['olap', 'stats', 'bi']) {
    const kindLabel = source === 'olap' ? t('dataReportCenter.kindOlap') : source === 'stats' ? t('dataReportCenter.dsStats') : t('dataReportCenter.dsBi')
    const items = catalog.filter((f) => f.source === source)
    if (items.length === 0) continue
    const measures = items.filter((f) => f.kind !== 'dimension').map((f) => ({ label: `${f.name}${f.unit ? ` (${f.unit})` : ''}`, value: f.id }))
    const dims = items.filter((f) => f.kind === 'dimension').map((f) => ({ label: `${f.name} (${t('dataReportCenter.dimension')})`, value: f.id }))
    if (measures.length > 0) groups.push({ label: `${kindLabel} · ${t('dataReportCenter.metrics')}`, source, options: measures })
    if (dims.length > 0) groups.push({ label: `${kindLabel} · ${t('dataReportCenter.dimension')}`, source, options: dims })
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
    if (!form.name.trim()) { message.warning(t('dataReportCenter.enterReportName')); return }
    if (form.fields.length === 0) { message.warning(t('dataReportCenter.selectAtLeastOneField')); return }
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
        message.warning(res.error?.message ?? t('dataReportCenter.saveFailed'))
        return
      }
      message.success(editing ? t('dataReportCenter.reportUpdated', { name: form.name }) : t('dataReportCenter.reportCreated', { name: form.name }))
      setModalOpen(false)
      void loadAll()
    } catch {
      message.error(t('dataReportCenter.saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (def: ApiReportDef) => {
    Modal.confirm({
      title: t('dataReportCenter.deleteConfirmTitle', { name: def.name }),
      content: t('dataReportCenter.deleteConfirmContent'),
      okText: t('dataReportCenter.delete'),
      okButtonProps: { danger: true },
      cancelText: t('dataReportCenter.cancel'),
      onOk: async () => {
        const res = await customReportApi.remove(def.id)
        if (res.success) {
          message.success(t('dataReportCenter.defDeleted'))
          void loadAll()
        } else {
          message.warning(res.error?.message ?? t('dataReportCenter.deleteFailed'))
        }
      },
    })
  }

  const handleRun = async (def: ApiReportDef) => {
    setRunningId(def.id)
    try {
      const res = await customReportApi.run(def.id)
      if (!res.success || !res.data) {
        message.warning(res.error?.message ?? t('dataReportCenter.runFailed'))
        return
      }
      setResult(res.data)
      setResultDef(def)
      void loadAll()
    } catch {
      message.error(t('dataReportCenter.runFailed'))
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
      message.warning(res.error?.message ?? t('dataReportCenter.noResultRunFirst'))
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
    if (!scheduleText.trim()) { message.warning(t('dataReportCenter.selectScheduleRule')); return }
    if (recipients.length === 0) { message.warning(t('dataReportCenter.selectAtLeastOneRecipient')); return }
    setSaving(true)
    try {
      const res = await customReportApi.setSchedule(scheduleDef.id, { schedule: scheduleText, recipients })
      if (!res.success) {
        message.warning(res.error?.message ?? t('dataReportCenter.scheduleFailed'))
        return
      }
      message.success(t('dataReportCenter.scheduleSaved', { name: scheduleDef.name }))
      setScheduleDef(null)
      void loadAll()
    } catch {
      message.error(t('dataReportCenter.scheduleFailed'))
    } finally {
      setSaving(false)
    }
  }

  const handleExport = async (def: ApiReportDef) => {
    try {
      const res = await customReportApi.exportCsv(def.id)
      if (!res.success || !res.data) {
        message.warning(res.error?.message ?? t('dataReportCenter.noResultExport'))
        return
      }
      const blob = res.data as unknown as Blob
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `custom-report-${def.id}-${dayjs().format('YYYYMMDD-HHmmss')}.csv`
      a.click()
      URL.revokeObjectURL(url)
      message.success(t('dataReportCenter.csvExportSuccess'))
    } catch {
      message.error(t('dataReportCenter.exportFailed'))
    }
  }

  const fieldGroups = useMemo(() => groupCatalog(catalog), [catalog])

  const defColumns: ProColumn<ApiReportDef>[] = [
    {
      key: 'name',
      dataIndex: 'name',
      title: t('dataReportCenter.colName'),
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
    { key: 'category', dataIndex: 'category', title: t('dataReportCenter.colCategory'), width: 100 },
    {
      key: 'period',
      dataIndex: 'period',
      title: t('dataReportCenter.colPeriod'),
      width: 70,
      render: (val: unknown) => PERIOD_LABELS_FULL[String(val)] ?? String(val ?? '-'),
    },
    {
      key: 'fields',
      dataIndex: 'fields',
      title: t('dataReportCenter.colFields'),
      width: 220,
      render: (val: unknown) => {
        const list = val as string[]
        if (!Array.isArray(list) || list.length === 0) return '-'
        const names = list.slice(0, 3).map((f) => catalog.find((c) => c.id === f)?.name ?? f)
        const rest = list.length > 3 ? t('dataReportCenter.andMoreFields', { count: list.length }) : ''
        return <span style={{ fontSize: 12 }}>{names.join('、')}{rest}</span>
      },
    },
    {
      key: 'schedule',
      dataIndex: 'schedule',
      title: t('dataReportCenter.colSchedule'),
      width: 140,
      render: (val: unknown) => (val ? <Tag color="gold" icon={<Clock size={10} />}>{String(val)}</Tag> : <Text type="secondary" style={{ fontSize: 12 }}>{t('dataReportCenter.notSet')}</Text>),
    },
    {
      key: 'status',
      dataIndex: 'status',
      title: t('dataReportCenter.colStatus'),
      width: 80,
      render: (val: unknown) => {
        const s = STATUS_TAGS[String(val)] ?? STATUS_TAGS.idle!
        return <Tag color={s.color} style={{ margin: 0 }}>{s.label}</Tag>
      },
    },
    {
      key: 'lastRunAt',
      dataIndex: 'lastRunAt',
      title: t('dataReportCenter.colLastRun'),
      width: 150,
      render: (val: unknown) => (val ? dayjs(String(val)).format('MM-DD HH:mm') : <Text type="secondary">-</Text>),
    },
    {
      key: 'actions',
      title: t('dataReportCenter.colActions'),
      width: 300,
      fixed: 'right',
      render: (_val: unknown, record: ApiReportDef) => (
        <Space size={2} wrap>
          <Button size="small" type="primary" icon={<Play size={12} />} loading={runningId === record.id} onClick={() => void handleRun(record)}>{t('dataReportCenter.run')}</Button>
          <Button size="small" icon={<Table2 size={12} />} onClick={() => void openResult(record)}>{t('dataReportCenter.result')}</Button>
          <Button size="small" icon={<History size={12} />} onClick={() => void openHistory(record)}>{t('dataReportCenter.history')}</Button>
          <Button size="small" icon={<Clock size={12} />} onClick={() => openSchedule(record)}>{t('dataReportCenter.schedule')}</Button>
          <Button size="small" icon={<FileDown size={12} />} onClick={() => void handleExport(record)}>{t('dataReportCenter.export')}</Button>
          <Button size="small" icon={<Pencil size={12} />} onClick={() => openEdit(record)}>{t('dataReportCenter.edit')}</Button>
          <Button size="small" danger icon={<Trash2 size={12} />} onClick={() => void handleDelete(record)}>{t('dataReportCenter.delete')}</Button>
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
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
                { key: 'all', label: t('dataReportCenter.tabAll', { count: defs.length }) },
                { key: 'scheduled', label: t('dataReportCenter.tabScheduled', { count: defs.filter((d) => d.schedule).length }) },
              ]}
              style={{ margin: 0 }}
            />
            <Button size="small" type="primary" icon={<Plus size={12} />} onClick={openCreate}>{t('dataReportCenter.newReport')}</Button>
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
        title={resultDef ? t('dataReportCenter.resultTitleNamed', { name: resultDef.name }) : t('dataReportCenter.resultTitle')}
        width={760}
        open={!!resultDef}
        onClose={() => setResultDef(null)}
      >
        {resultLoading ? (
          <div style={{ textAlign: 'center', padding: 'var(--space-12, 48px)' }}><Spin /></div>
        ) : result ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
            <Alert
              type="success"
              showIcon
              message={t('dataReportCenter.resultSource', { source: result.source, count: result.rows.length, time: dayjs(result.generatedAt).format('YYYY-MM-DD HH:mm:ss') })}
              description={t('dataReportCenter.resultMeta', { period: PERIOD_LABELS_FULL[result.summary.period as string] ?? result.summary.period ?? '-', dsType: result.summary.dataSource ?? '-', id: result.id })}
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
          <Empty description={t('dataReportCenter.emptyResult')} />
        )}
      </Drawer>

      {/* 历史 Drawer */}
      <Drawer
        title={historyDef ? t('dataReportCenter.historyTitleNamed', { name: historyDef.name }) : t('dataReportCenter.historyTitle')}
        width={620}
        open={!!historyDef}
        onClose={() => setHistoryDef(null)}
      >
        <ProTable<RunHistoryEntry>
          columns={[
            {
              key: 'ranAt',
              dataIndex: 'ranAt',
              title: t('dataReportCenter.colRanAt'),
              width: 160,
              render: (val: unknown) => dayjs(String(val)).format('YYYY-MM-DD HH:mm:ss'),
            },
            {
              key: 'status',
              dataIndex: 'status',
              title: t('dataReportCenter.colStatus'),
              width: 90,
              render: (val: unknown) => (
                <Tag color={String(val) === 'success' ? 'success' : 'error'}>{String(val) === 'success' ? t('dataReportCenter.success') : t('dataReportCenter.failed')}</Tag>
              ),
            },
            { key: 'rowCount', dataIndex: 'rowCount', title: t('dataReportCenter.colRowCount'), width: 70 },
            { key: 'message', dataIndex: 'message', title: t('dataReportCenter.colMessage'), width: 200 },
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
        title={editing ? t('dataReportCenter.editReportTitle', { name: editing.name }) : t('dataReportCenter.newReportTitle')}
        open={modalOpen}
        onOk={() => void handleSave()}
        onCancel={() => setModalOpen(false)}
        okText={editing ? t('dataReportCenter.save') : t('dataReportCenter.create')}
        cancelText={t('dataReportCenter.cancel')}
        confirmLoading={saving}
        width={680}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)', paddingTop: 'var(--space-2, 8px)' }}>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>{t('dataReportCenter.reportName')}</Text>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t('dataReportCenter.reportNamePlaceholder')} style={{ width: 300 }} />
          </Space>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>{t('dataReportCenter.colCategory')}</Text>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder={t('dataReportCenter.categoryPlaceholder')} style={{ width: 180 }} />
          </Space>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>{t('dataReportCenter.dataSource')}</Text>
            <Radio.Group
              value={form.dataSource}
              onChange={(e) => setForm({ ...form, dataSource: e.target.value })}
              options={DATA_SOURCE_OPTIONS}
            />
          </Space>
          <Space>
            <Text strong style={{ width: 70, display: 'inline-block' }}>{t('dataReportCenter.period')}</Text>
            <Select
              value={form.period}
              onChange={(v) => setForm({ ...form, period: v })}
              style={{ width: 120 }}
              options={Object.entries(PERIOD_LABELS_FULL).map(([value, label]) => ({ value, label }))}
            />
          </Space>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('dataReportCenter.metricFieldsCatalog')}</Text>
            <Select
              mode="multiple"
              value={form.fields}
              onChange={(vals) => setForm({ ...form, fields: vals })}
              style={{ width: '100%' }}
              placeholder={t('dataReportCenter.selectField')}
              maxTagCount={6}
              optionFilterProp="label"
              options={fieldGroups.map((g) => ({ label: g.label, options: g.options }))}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 'var(--space-1, 4px)' }}>
              {t('dataReportCenter.dataSourceHint')}
            </Text>
          </div>
          <div>
            <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('dataReportCenter.description')}</Text>
            <Input.TextArea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} placeholder={t('dataReportCenter.descriptionPlaceholder')} />
          </div>
        </div>
      </Modal>

      {/* 定时设置 Modal */}
      <Modal
        title={scheduleDef ? t('dataReportCenter.scheduleTitleNamed', { name: scheduleDef.name }) : t('dataReportCenter.scheduleTitle')}
        open={!!scheduleDef}
        onOk={() => void handleSaveSchedule()}
        onCancel={() => setScheduleDef(null)}
        okText={t('dataReportCenter.saveAndPush')}
        cancelText={t('dataReportCenter.cancel')}
        confirmLoading={saving}
        width={520}
      >
        {scheduleDef && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)', paddingTop: 'var(--space-2, 8px)' }}>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('dataReportCenter.scheduleRule')}</Text>
              <Select
                value={scheduleText}
                onChange={setScheduleText}
                style={{ width: '100%' }}
                options={SCHEDULE_OPTIONS}
                showSearch
                allowClear={false}
              />
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 'var(--space-1, 4px)' }}>
                {t('dataReportCenter.scheduleHint')}
              </Text>
            </div>
            <div>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>{t('dataReportCenter.recipients')}</Text>
              <Select
                mode="tags"
                value={recipients}
                onChange={setRecipients}
                style={{ width: '100%' }}
                placeholder={t('dataReportCenter.recipientsPlaceholder')}
                options={[{ label: t('dataReportCenter.recipientCurrent'), value: 'current' }, { label: t('dataReportCenter.recipientDirector'), value: 'D002' }, { label: t('dataReportCenter.recipientQcLead'), value: 'D003' }]}
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
        { key: 'defs', label: t('dataReportCenter.tabDefs'), children: <CustomReportCenter /> },
        { key: 'builder', label: t('dataReportCenter.tabBuilder'), children: <CustomReportBuilder /> },
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
    message.success(t('dataReportCenter.dataRefetched'))
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
    message.success(t('dataReportCenter.csvExportSuccess'))
  }, [chartData, currentReport])

  const handleExportPng = useCallback(() => {
    const svg = document.querySelector('.report-chart-area svg')
    if (!svg) { message.warning(t('dataReportCenter.chartNotFound')); return }
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
        message.success(t('dataReportCenter.pngExportSuccess'))
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
      style={{ background: 'var(--bg-card)',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 1000 : undefined,
      }}
    >
      <Header
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-800) 0%, #1e3a8a 100%)',
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
            {t('dataReportCenter.pageTitle')}
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12 }}>
            {t('dataReportCenter.pageSubtitle', { count: reportDefinitions.length })}
          </Text>
          {apiSnapshot && (
            <Tag color="green" style={{ fontSize: 11, margin: 0 }}>
              {t('dataReportCenter.apiSnapshot', { reports: apiSnapshot.reports, trends: apiSnapshot.trends })}
            </Tag>
          )}
          {usingFallback && (
            <Tag color="orange" style={{ fontSize: 11, margin: 0 }}>
              {t('dataReportCenter.demoFallback')}
            </Tag>
          )}
        </Space>
        <Space size={8}>
          <Select
            value={viewMode}
            onChange={setViewMode}
            size="small"
            options={[
              { label: t('dataReportCenter.viewStandard'), value: 'standard' },
              { label: t('dataReportCenter.viewCustom'), value: 'custom' },
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
          <Tooltip title={t('dataReportCenter.refreshData')}>
            <Button
              size="small"
              icon={<RefreshCw size={14} />}
              onClick={() => void handleRefresh()}
              loading={loading || olapLoading}
              style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.3)', background: 'rgba(255,255,255,0.15)' }}
            />
          </Tooltip>
          <Tooltip title={fullscreen ? t('dataReportCenter.exitFullscreen') : t('dataReportCenter.fullscreen')}>
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
              placeholder={t('dataReportCenter.searchReportPlaceholder')}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="small"
              allowClear
            />
          </div>
          {favoriteDefs.length > 0 && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid var(--border-color)' }}>
              <Text strong style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <Star size={12} /> {t('dataReportCenter.favoriteReports', { count: favoriteDefs.length })}
              </Text>
              <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 'var(--space-1, 4px)' }}>
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
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
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
                            fontSize: 12,
                          }}
                        >
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {child.title}
                          </span>
                          <Tooltip title={favorites.has(child.key as string) ? t('dataReportCenter.unfavorite') : t('dataReportCenter.favorite')}>
                            <span
                              onClick={(e) => { e.stopPropagation(); toggleFavorite(child.key as string) }}
                              style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}
                            >
                              {favorites.has(child.key as string) ? (
                                <Star size={12} fill="var(--color-warning-500)" color="var(--color-warning-500)" />
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
        <Content style={{ padding: 'var(--space-4, 16px)', overflow: 'auto', height: fullscreen ? 'calc(100vh - 56px)' : 'calc(100vh - 56px)' }}>
          {viewMode === 'custom' ? (
            <CustomReportCenterRoot />
          ) : currentReport ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Space size={8} align="center">
                    <Title level={5} style={{ margin: 0, fontSize: 16 }}>
                      {currentReport.name}
                    </Title>
                    <Tag color="blue">{currentReport.category}</Tag>
                    <Tooltip title={favorites.has(currentReport.id) ? t('dataReportCenter.unfavorite') : t('dataReportCenter.favorite')}>
                      <span
                        onClick={() => toggleFavorite(currentReport.id)}
                        style={{ cursor: 'pointer', display: 'flex' }}
                      >
                        {favorites.has(currentReport.id) ? (
                          <Star size={16} fill="var(--color-warning-500)" color="var(--color-warning-500)" />
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
                  <Card
                    size="small"
                    className="report-chart-area"
                    style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    <ReportChart
                      type={chartType as ReportChartType}
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
                        checkedChildren={t('dataReportCenter.on')}
                        unCheckedChildren={t('dataReportCenter.off')}
                      />
                    }
                    title={
                      <Space size={6}>
                        <Lightbulb size={14} color="var(--color-warning-500)" />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{t('dataReportCenter.aiInsight')}</span>
                      </Space>
                    }
                    style={{ borderRadius: 8, boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}
                  >
                    {showInsight ? (
                      <div style={{ fontSize: 12, lineHeight: 1.8, color: 'var(--text-primary)', padding: '4px 0' }}>
                        {insightText || (
                          <Text type="secondary">{t('dataReportCenter.noInsightData')}</Text>
                        )}
                      </div>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        {t('dataReportCenter.aiInsightOff')}
                      </Text>
                    )}
                  </Card>
                  <Card
                    size="small"
                    title={
                      <Space size={6}>
                        <Table2 size={14} />
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{t('dataReportCenter.dataDetail')}</span>
                        <Tag style={{ fontSize: 10 }}>{t('dataReportCenter.rowsCount', { count: chartData.length })}</Tag>
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
              <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t('dataReportCenter.selectReportFromLeft')} />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
