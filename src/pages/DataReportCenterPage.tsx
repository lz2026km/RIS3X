import { useState, useMemo, useCallback, useEffect } from 'react'
import {
  Layout, Typography, Tree, Input, Select, DatePicker, Button, Card,
  Tag, message, Tabs, Tooltip, Space, Checkbox, Badge, Switch, Dropdown,
  Menu, Collapse, Empty, Spin, Radio,
} from 'antd'
import type { TreeProps } from 'antd'
import dayjs from 'dayjs'
import {
  BarChart3, PieChart as PieChartIcon, TrendingUp, TrendingDown,
  FileText, AlertTriangle, Clock, ShieldCheck, Monitor, Scan,
  Gauge, Percent, Video, MessageSquare, Users, Calendar, Search,
  Filter, RefreshCw, ChevronRight, Plus, Eye, Settings,
  X, Check, ArrowRight, Table2, LayoutDashboard, Send, Repeat,
  Sigma, MousePointer, Copy, Save, Trash2, Maximize2, Minimize2,
  Download, Bookmark, BookmarkCheck, Lightbulb, FileSpreadsheet,
  FolderTree, Sliders, BarChart4, Star, StarOff, PanelRight,
  Activity, Award, Zap, Database, Network, Server, Globe,
} from 'lucide-react'
import { Chart } from '../components/chart/Chart'
import { ProTable } from '../components/data/ProTable'
import type { ProColumn } from '../components/data/ProTable'
import { reportDefinitions } from '../data/reportDefinitions'
import type { ReportDefinition } from '../data/reportDefinitions'
import { generateMockReportData } from '../data/mockReportData'
import { generateReportInsight } from '../services/reportAiInsight'

const { Header, Sider, Content } = Layout
const { Title, Text } = Typography
const { RangePicker } = DatePicker
const { Panel } = Collapse

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

const PAGE_SIZE = 20

export default function DataReportCenterPage() {
  const [selectedReportId, setSelectedReportId] = useState<string>(reportDefinitions[0].id)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ])
  const [granularity, setGranularity] = useState('monthly')
  const [searchText, setSearchText] = useState('')
  const [expandedKeys, setExpandedKeys] = useState<string[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [favorites, setFavorites] = useState<Set<string>>(new Set(['exam-volume-monthly', 'device-utilization', 'qc-score-distribution']))
  const [showInsight, setShowInsight] = useState(true)
  const [fullscreen, setFullscreen] = useState(false)
  const [tablePage, setTablePage] = useState(1)
  const [loading, setLoading] = useState(false)

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

  useEffect(() => {
    if (!currentReport) return
    setOlapLoading(true)
    setOlapData(null)
    const startDate = dateRange[0]?.format('YYYY-MM-DD') || '2026-01-01'
    const endDate = dateRange[1]?.format('YYYY-MM-DD') || '2026-12-31'
    fetch('/api/v1/olap/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dimensions: ['date', 'modality'],
        measures: ['exam_count', 'exam_revenue'],
        filters: [
          { dimension: 'date', operator: 'between', value: [startDate, endDate] },
        ],
        granularity: granularity,
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data?.rows?.length > 0) {
          setOlapData(data.rows)
        } else {
          setOlapData(null)
        }
      })
      .catch(() => setOlapData(null))
      .finally(() => setOlapLoading(false))
  }, [currentReport?.id, dateRange, granularity])

  const chartData = useMemo(() => {
    if (!currentReport) return []
    if (olapData && olapData.length > 0) return olapData
    setLoading(true)
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
    const keys = Object.keys(chartData[0])
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

  const handleTreeSelect: TreeProps['onSelect'] = useCallback((keys) => {
    if (keys.length && keys[0] && !treeData.some((t) => t.key === keys[0])) {
      setSelectedReportId(keys[0] as string)
      setTablePage(1)
    }
  }, [treeData])

  const handleExportCsv = useCallback(() => {
    if (!chartData.length) return
    const keys = Object.keys(chartData[0])
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
        background: '#f1f5f9',
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
        </Space>
        <Space size={8}>
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
              onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 500) }}
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
      <Layout style={{ flex: 1, background: '#f1f5f9' }}>
        <Sider
          width={280}
          style={{
            background: '#fff',
            borderRight: '1px solid #e2e8f0',
            overflow: 'auto',
            height: fullscreen ? 'calc(100vh - 56px)' : 'calc(100vh - 56px)',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e2e8f0' }}>
            <Input
              prefix={<Search size={14} style={{ color: '#94a3b8' }} />}
              placeholder="搜索报表名称..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              size="small"
              allowClear
            />
          </div>
          {favoriteDefs.length > 0 && (
            <div style={{ padding: '8px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <Text strong style={{ fontSize: 12, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
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
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>
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
                                <StarOff size={12} color="#94a3b8" />
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
          {currentReport ? (
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
                          <StarOff size={16} color="#94a3b8" />
                        )}
                      </span>
                    </Tooltip>
                  </Space>
                  <Text style={{ color: '#64748b', fontSize: 12, display: 'block', marginTop: 2 }}>
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
                      <div style={{ fontSize: 13, lineHeight: 1.8, color: '#334155', padding: '4px 0' }}>
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
              <Empty description="请从左侧选择报表" />
            </div>
          )}
        </Content>
      </Layout>
    </Layout>
  )
}
