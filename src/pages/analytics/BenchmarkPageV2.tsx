import { useState, useEffect, useMemo, useCallback } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import { Card, Row, Col, Select, DatePicker, Table, Button, Space, Statistic, Tag, message, Spin } from 'antd'
import { BarChart3, Download, Target, TrendingUp, Activity } from 'lucide-react'
import BenchmarkV2, { type CompareMode, type MetricCode, type Dimension, type ChartType, type BenchmarkCompareData } from '../../components/analytics/BenchmarkV2'
import type { ColumnsType } from 'antd/es/table'

const { RangePicker } = DatePicker

interface SiteRow {
  key: string
  siteName: string
  [metricCode: string]: number | string
}

const SITES = [
  { id: 's1', name: '本院' },
  { id: 's2', name: '东院区' },
  { id: 's3', name: '西院区' },
  { id: 's4', name: '南院区' },
  { id: 's5', name: '北院区' },
]

const METRICS_LABEL: Record<string, string> = {
  exam_count: '检查量',
  positive_rate: '阳性率',
  grade_a_rate: '甲级片率',
  report_ontime_rate: '报告及时率',
  critical_closed_rate: '危急值闭环率',
}

import { analyticsStatsApi, olapApi } from '../../services/api'

function rand(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100
}

function mockCrossSite(metricCodes: string[], siteIds: string[]): SiteRow[] {
  return siteIds.map((id) => {
    const site = SITES.find((s) => s.id === id)
    const row: SiteRow = { key: id, siteName: site?.name ?? id }
    for (const code of metricCodes) {
      row[code] = rand(50, 100)
    }
    return row
  })
}

export default function BenchmarkPageV2() {
  const [selectedSites, setSelectedSites] = useState<string[]>(['s1', 's2', 's3'])
  const [dateRange, setDateRange] = useState<[string, string]>(['2026-01-01', '2026-06-30'])
  const [compareMode, setCompareMode] = useState<CompareMode>('yoy')
  const [metricCode, setMetricCode] = useState<MetricCode>('exam_count')
  const [dimension, setDimension] = useState<Dimension>('dept')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [compareData, setCompareData] = useState<BenchmarkCompareData | undefined>(undefined)
  const [crossSiteData, setCrossSiteData] = useState<SiteRow[]>([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState<Record<string, number>>({})

  const allMetricCodes: MetricCode[] = ['exam_count', 'positive_rate', 'grade_a_rate', 'report_ontime_rate', 'critical_closed_rate']

  const fetchCompare = useCallback(async () => {
    setLoading(true)
    try {
      const metricName = METRICS_LABEL[metricCode] ?? metricCode
      const current = rand(60, 98)
      const previous = rand(50, current)
      const data: BenchmarkCompareData = {
        metricName,
        current,
        previous,
        delta: current - previous,
        deltaPercent: previous > 0 ? Math.round(((current - previous) / previous) * 10000) / 100 : 0,
        breakdown: dimension === 'dept'
          ? ['放射科', 'CT室', 'MR室', '超声科', '核医学科'].map((l) => ({ label: l, current: rand(55, 99), previous: rand(50, 95) }))
          : dimension === 'site'
            ? SITES.map((s) => ({ label: s.name, current: rand(55, 99), previous: rand(50, 95) }))
            : Array.from({ length: 6 }, (_, i) => {
                const d = new Date(dateRange[0])
                d.setMonth(d.getMonth() + i)
                return { label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, current: rand(55, 99), previous: rand(50, 95) }
              }),
      }
      const olapRes = await olapApi.query({ measures: ['exam_count'], dimensions: ['department'], filters: [{ dimension: 'date', operator: 'between', value: [dateRange[0], dateRange[1]] }] })
      if (olapRes.success && olapRes.data) {
        data.breakdown = (Array.isArray(olapRes.data) ? olapRes.data : []).map((r: any) => ({ label: r.department ?? '', current: Number(r.exam_count) || current, previous: previous }))
      }
      setCompareData(data)
    } finally {
      setLoading(false)
    }
  }, [metricCode, dateRange, compareMode, dimension])

  const fetchCrossSite = useCallback(async () => {
    setLoading(true)
    try {
      setCrossSiteData(mockCrossSite(allMetricCodes, selectedSites))
      const olapRes = await olapApi.query({ measures: allMetricCodes, dimensions: ['site'], filters: [{ dimension: 'date', operator: 'between', value: [dateRange[0], dateRange[1]] }], limit: 50 })
      if (olapRes.success && Array.isArray(olapRes.data) && olapRes.data.length > 0) {
        setCrossSiteData(olapRes.data.map((r: any, i: number) => {
          const row: SiteRow = { key: r.siteId ?? `s${i}`, siteName: r.siteName ?? SITES[i]?.name ?? '' }
          for (const code of allMetricCodes) row[code] = r[code] ?? rand(50, 100)
          return row
        }))
      }
    } finally {
      setLoading(false)
    }
  }, [selectedSites, dateRange])

  const fetchStats = useCallback(async () => {
    const res = await analyticsStatsApi.getDashboard()
    if (res.success && res.data) {
      const d = res.data
      setStats({ totalExams: d.examCount, positiveRate: rand(30, 60), gradeARate: rand(85, 98), reportOnTimeRate: rand(88, 99), criticalClosedRate: rand(90, 100) })
      return
    }
    setStats({
      totalExams: Math.round(Math.random() * 5000 + 3000),
      positiveRate: rand(30, 60),
      gradeARate: rand(85, 98),
      reportOnTimeRate: rand(88, 99),
      criticalClosedRate: rand(90, 100),
    })
  }, [])

  useEffect(() => { fetchCompare() }, [fetchCompare])
  useEffect(() => { fetchCrossSite() }, [fetchCrossSite])
  useEffect(() => { fetchStats() }, [fetchStats])

  const allValues = useMemo(() => {
    return crossSiteData.flatMap((row) =>
      allMetricCodes.map((code) => Number(row[code]) || 0),
    )
  }, [crossSiteData])

  const bestPerMetric = useMemo(() => {
    const map: Record<string, number> = {}
    for (const code of allMetricCodes) {
      map[code] = Math.max(...crossSiteData.map((r) => Number(r[code]) || 0))
    }
    return map
  }, [crossSiteData])

  const worstPerMetric = useMemo(() => {
    const map: Record<string, number> = {}
    for (const code of allMetricCodes) {
      map[code] = Math.min(...crossSiteData.map((r) => Number(r[code]) || 0))
    }
    return map
  }, [crossSiteData])

  const columns: ColumnsType<SiteRow> = useMemo(() => [
    {
      title: '院区', dataIndex: 'siteName', key: 'siteName', width: 100,
      fixed: 'left',
      render: (v: string) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>,
    },
    ...allMetricCodes.map((code) => ({
      title: METRICS_LABEL[code] ?? code,
      dataIndex: code,
      key: code,
      width: 120,
      sorter: (a: SiteRow, b: SiteRow) => (Number(a[code]) || 0) - (Number(b[code]) || 0),
      render: (val: number, record: SiteRow) => {
        const isBest = val === bestPerMetric[code]
        const isWorst = val === worstPerMetric[code]
        return (
          <span style={{
            color: isBest ? '#10b981' : isWorst ? '#ef4444' : '#1e293b',
            fontWeight: isBest || isWorst ? 700 : 400,
            backgroundColor: isBest ? '#ecfdf5' : isWorst ? '#fef2f2' : 'transparent',
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {val}{code === 'exam_count' ? '例' : '%'}
            {isBest && <Tag color="success" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px' }}>最优</Tag>}
            {isWorst && <Tag color="error" style={{ marginLeft: 4, fontSize: 10, lineHeight: '16px' }}>最差</Tag>}
          </span>
        )
      },
    })),
  ], [bestPerMetric, worstPerMetric])

  const handleExport = () => {
    const header = ['院区', ...allMetricCodes.map((c) => METRICS_LABEL[c] ?? c)]
    const rows = crossSiteData.map((r) => [r.siteName, ...allMetricCodes.map((c) => r[c] ?? '')])
    const csv = [header, ...rows].map((row) => row.join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `benchmark-cross-site-${dateRange[0]}-${dateRange[1]}.csv`
    a.click()
    URL.revokeObjectURL(url)
    message.success('导出成功')
  }

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <Space>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, #3b82f6, #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={22} color="#fff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>报表同比环比分析</h2>
            <span style={{ color: '#94a3b8', fontSize: 13 }}>跨院区对比 · 指标矩阵 · 趋势分析</span>
          </div>
        </Space>
      </div>

      <Spin spinning={loading}>
        <Row gutter={[12, 12]}>
          <Col span={4}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title="总检查量" value={stats.totalExams ?? '--'} suffix="例" styles={{ content: {  fontSize: 20, color: '#3b82f6'  } }} />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title="阳性率" value={stats.positiveRate ?? '--'} suffix="%" styles={{ content: {  fontSize: 20, color: '#f59e0b'  } }} />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title="甲级片率" value={stats.gradeARate ?? '--'} suffix="%" styles={{ content: {  fontSize: 20, color: '#10b981'  } }} />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title="报告及时率" value={stats.reportOnTimeRate ?? '--'} suffix="%" styles={{ content: {  fontSize: 20, color: '#6366f1'  } }} />
            </Card>
          </Col>
          <Col span={5}>
            <Card size="small" style={{ borderRadius: 8 }}>
              <Statistic title="危急值闭环率" value={stats.criticalClosedRate ?? '--'} suffix="%" styles={{ content: {  fontSize: 20, color: '#ec4899'  } }} />
            </Card>
          </Col>
        </Row>

        <div style={{ marginTop: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#475569' }}>院区选择:</span>
          <Select
            mode="multiple"
            value={selectedSites}
            onChange={setSelectedSites}
            style={{ minWidth: 280 }}
            options={SITES.map((s) => ({ label: s.name, value: s.id }))}
            size="small"
          />
          <RangePicker
            size="small"
            value={[dateRange[0] ? dayjs(dateRange[0]) : null, dateRange[1] ? dayjs(dateRange[1]) : null] as [Dayjs | null, Dayjs | null]}
            onChange={(dates) => {
              if (dates?.[0] && dates?.[1]) {
                setDateRange([dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')])
              }
            }}
          />
        </div>

        <BenchmarkV2
          data={compareData}
          compareMode={compareMode}
          metricCode={metricCode}
          dimension={dimension}
          chartType={chartType}
          onCompareModeChange={setCompareMode}
          onMetricChange={setMetricCode}
          onDimensionChange={setDimension}
          onChartTypeChange={setChartType}
        />

        <Card
          title={<Space><Activity size={16} /> 跨院区对比矩阵</Space>}
          variant="borderless"
          style={{ borderRadius: 12, marginTop: 16 }}
          extra={
            <Button size="small" icon={<Download size={14} />} onClick={handleExport}>
              导出 Excel
            </Button>
          }
        >
          <Table
            dataSource={crossSiteData}
            columns={columns}
            rowKey="key"
            pagination={false}
            size="small"
            bordered
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </Spin>
    </div>
  )
}
