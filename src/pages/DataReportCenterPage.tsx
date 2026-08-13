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
import { generateReportInsight } from '../services/reportAiInsight'
import {
  Layout, Typography, Input, Select, DatePicker, Button, Card,
  Tag, message, Tooltip, Space, Switch,
  Menu, Collapse, Empty, Spin, Checkbox, Alert,
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

  const chartRows = useMemo(() => {
    if (!rows.length) return []
    return rows.map((r) => ({ ...r, name: r.period }))
  }, [rows])
  const chartYKeys = selectedFields.map((f) => f.label)

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
            </Space>
          </div>
          {savedDefs.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text strong style={{ fontSize: 12 }}>已保存定义:</Text>
              {savedDefs.map((d) => (
                <Tag key={d.id} color="blue" style={{ cursor: 'pointer' }} onClick={() => handleLoadDef(d)}>
                  {d.name}
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
              dataSource={chartRows}
              rowKey={(r) => String(r.period ?? '')}
              loading={loading}
              showToolbar={false}
              pagination={{ pageSize: 10, showSizeChanger: false }}
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
            <CustomReportBuilder />
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
