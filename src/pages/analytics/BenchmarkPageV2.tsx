import { useState, useEffect, useMemo, useCallback } from 'react'
import dayjs, { type Dayjs } from 'dayjs'
import {
  Card,
  Select,
  DatePicker,
  Button,
  Space,
  Tag,
  message,
  Spin,
  Typography,
} from "antd";
import { BarChart3, Download, Activity } from 'lucide-react'
import BenchmarkV2, { type CompareMode, type MetricCode, type Dimension, type ChartType, type BenchmarkCompareData } from '../../components/analytics/BenchmarkV2'
import type { ColumnsType } from 'antd/es/table'
import { benchmarkApi } from '../../services/api'
import { t } from '../../i18n/appI18n'
import { seededInt, seededUnit } from '../../utils/seededRandom'
import { DataTable, StatCard, StatCardGrid } from "../../components/common"

const { Title } = Typography

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

function rand(min: number, max: number, key: string): number {
  return Math.round((seededUnit(key) * (max - min) + min) * 100) / 100
}

function toIsoRange(range: [string, string]): { start: string; end: string } {
  return { start: `${range[0]}T00:00:00.000Z`, end: `${range[1]}T23:59:59.999Z` }
}

interface CompareApiResult {
  metricName?: string
  current?: number
  previous?: number
  delta?: number
  deltaPercent?: number
  breakdown?: { label: string; current: number; previous: number }[]
}

interface CrossSiteApiRow {
  siteId: string
  siteName: string
  values: Record<string, number>
}

interface StatsApiResult {
  totalExams?: number
  positiveRate?: number
  gradeARate?: number
  reportOnTimeRate?: number
  criticalClosedRate?: number
  totalCases?: number
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
  const [apiError, setApiError] = useState<string | null>(null)
  // [G005 W8-Dose] 接口不可用/返回空时图表回退本地合成为演示数据
  const [usingDemo, setUsingDemo] = useState(false)
  const [stats, setStats] = useState<Record<string, number>>({})
  const [metricNames, setMetricNames] = useState<Record<string, string>>(METRICS_LABEL)

  const allMetricCodes: MetricCode[] = ['exam_count', 'positive_rate', 'grade_a_rate', 'report_ontime_rate', 'critical_closed_rate']

  // [W2-C] 指标列表 (listMetrics): 动态补充指标名, 失败时回退静态表
  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await benchmarkApi.listMetrics()
      if (cancelled || !res.success || !Array.isArray(res.data)) return
      const labels: Record<string, string> = { ...METRICS_LABEL }
      for (const m of res.data as Array<{ code?: string; name?: string }>) {
        if (m?.code && m?.name) labels[m.code] = m.name
      }
      setMetricNames(labels)
    })()
    return () => { cancelled = true }
  }, [])

  const fetchCompare = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      let data: BenchmarkCompareData | undefined
      const res = await benchmarkApi.compare({
        metricCode,
        timeRange: toIsoRange(dateRange),
        compareMode,
        dimension,
        dimensionValues: dimension === 'site' ? selectedSites : undefined,
      })
      if (res.success && res.data && typeof res.data === 'object') {
        const d = res.data as CompareApiResult
        data = {
          metricName: d.metricName ?? metricNames[metricCode] ?? metricCode,
          current: d.current ?? 0,
          previous: d.previous ?? 0,
          delta: d.delta ?? 0,
          deltaPercent: d.deltaPercent ?? 0,
          breakdown: Array.isArray(d.breakdown) ? d.breakdown : undefined,
        }
        setCompareData(data)
      } else {
        setApiError(res.error?.message ?? '对比数据加载失败')
        setUsingDemo(true)
        // 回退本地模拟,保证页面可用
        data = {
          metricName: metricNames[metricCode] ?? metricCode,
          current: rand(60, 98, `cmp-cur-${metricCode}-${compareMode}-${dimension}`),
          previous: rand(50, 98, `cmp-prev-${metricCode}-${compareMode}-${dimension}`),
          delta: 0,
          deltaPercent: 0,
          breakdown: dimension === 'dept'
            ? ['放射科', 'CT室', 'MR室', '超声科', '核医学科'].map((l) => ({ label: l, current: rand(55, 99, `cmp-dept-${l}`), previous: rand(50, 95, `cmp-dept-p-${l}`) }))
            : dimension === 'site'
              ? SITES.map((s) => ({ label: s.name, current: rand(55, 99, `cmp-site-${s.id}`), previous: rand(50, 95, `cmp-site-p-${s.id}`) }))
              : Array.from({ length: 6 }, (_, i) => {
                  const d = new Date(dateRange[0])
                  d.setMonth(d.getMonth() + i)
                  const label = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
                  return { label, current: rand(55, 99, `cmp-mon-${label}`), previous: rand(50, 95, `cmp-mon-p-${label}`) }
                }),
        }
        if (!data.breakdown?.length) data.breakdown = undefined
        setCompareData(data)
      }
    } catch (e) {
      setApiError((e as Error)?.message ?? '对比数据加载失败')
      setUsingDemo(true)
      setCompareData(undefined)
    } finally {
      setLoading(false)
    }
  }, [metricCode, dateRange, compareMode, dimension, selectedSites, metricNames])

  const fetchCrossSite = useCallback(async () => {
    setLoading(true)
    setApiError(null)
    try {
      const res = await benchmarkApi.crossSite({
        metricCodes: allMetricCodes,
        siteIds: selectedSites,
        timeRange: toIsoRange(dateRange),
      })
      if (res.success && Array.isArray(res.data)) {
        const rows: SiteRow[] = (res.data as CrossSiteApiRow[]).map((r) => {
          const row: SiteRow = { key: r.siteId, siteName: r.siteName ?? r.siteId }
          for (const code of allMetricCodes) {
            const v = r.values?.[code]
            row[code] = typeof v === 'number' ? v : rand(50, 100, `xs-${r.siteId}-${code}`)
          }
          return row
        })
        if (rows.length === 0) setUsingDemo(true)
        setCrossSiteData(rows.length > 0 ? rows : SITES.filter(s => selectedSites.includes(s.id)).map((s) => {
          const row: SiteRow = { key: s.id, siteName: s.name }
          for (const code of allMetricCodes) row[code] = rand(50, 100, `xs-fb-${s.id}-${code}`)
          return row
        }))
      } else {
        setApiError(res.error?.message ?? '跨院对比加载失败')
        setUsingDemo(true)
        setCrossSiteData(SITES.filter(s => selectedSites.includes(s.id)).map((s) => {
          const row: SiteRow = { key: s.id, siteName: s.name }
          for (const code of allMetricCodes) row[code] = rand(50, 100, `xs-er-${s.id}-${code}`)
          return row
        }))
      }
    } catch (e) {
      setApiError((e as Error)?.message ?? '跨院对比加载失败')
      setUsingDemo(true)
      setCrossSiteData([])
    } finally {
      setLoading(false)
    }
  }, [selectedSites, dateRange, allMetricCodes])

  const fetchStats = useCallback(async () => {
    const res = await benchmarkApi.stats()
    if (res.success && res.data && typeof res.data === 'object') {
      const d = res.data as StatsApiResult
      if (
        d.totalExams === undefined ||
        d.positiveRate === undefined ||
        d.gradeARate === undefined ||
        d.reportOnTimeRate === undefined ||
        d.criticalClosedRate === undefined
      ) {
        setUsingDemo(true)
      }
      setStats({
        totalExams: d.totalExams ?? seededInt('bench-total', 3000, 7999),
        positiveRate: d.positiveRate ?? rand(30, 60, 'bench-pos'),
        gradeARate: d.gradeARate ?? rand(85, 98, 'bench-gradea'),
        reportOnTimeRate: d.reportOnTimeRate ?? rand(88, 99, 'bench-ontime'),
        criticalClosedRate: d.criticalClosedRate ?? rand(90, 100, 'bench-critical'),
      })
      return
    }
    setUsingDemo(true)
    setStats({
      totalExams: seededInt('bench-total-fb', 3000, 7999),
      positiveRate: rand(30, 60, 'bench-pos-fb'),
      gradeARate: rand(85, 98, 'bench-gradea-fb'),
      reportOnTimeRate: rand(88, 99, 'bench-ontime-fb'),
      criticalClosedRate: rand(90, 100, 'bench-critical-fb'),
    })
  }, [])

  useEffect(() => { fetchCompare() }, [fetchCompare])
  useEffect(() => { fetchCrossSite() }, [fetchCrossSite])
  useEffect(() => { fetchStats() }, [fetchStats])

  const bestPerMetric = useMemo(() => {
    const map: Record<string, number> = {}
    for (const code of allMetricCodes) {
      map[code] = Math.max(...crossSiteData.map((r) => Number(r[code]) || 0))
    }
    return map
  }, [crossSiteData, allMetricCodes])

  const worstPerMetric = useMemo(() => {
    const map: Record<string, number> = {}
    for (const code of allMetricCodes) {
      map[code] = Math.min(...crossSiteData.map((r) => Number(r[code]) || 0))
    }
    return map
  }, [crossSiteData, allMetricCodes])

  const columns: ColumnsType<SiteRow> = useMemo(() => [
    {
      title: '院区', dataIndex: 'siteName', key: 'siteName', width: 100,
      fixed: 'left',
      render: (v: string) => <span style={{ fontWeight: 600, color: '#1e293b' }}>{v}</span>,
    },
    ...allMetricCodes.map((code) => ({
      title: metricNames[code] ?? code,
      dataIndex: code,
      key: code,
      width: 120,
      sorter: (a: SiteRow, b: SiteRow) => (Number(a[code]) || 0) - (Number(b[code]) || 0),
      render: (val: number, _record: SiteRow) => {
        const isBest = val === bestPerMetric[code]
        const isWorst = val === worstPerMetric[code]
        return (
          <span style={{
            color: isBest ? '#10b981' : isWorst ? 'var(--color-error-500)' : '#1e293b',
            fontWeight: isBest || isWorst ? 700 : 400,
            backgroundColor: isBest ? '#ecfdf5' : isWorst ? '#fef2f2' : 'transparent',
            padding: '2px 6px',
            borderRadius: 4,
          }}>
            {val}{code === 'exam_count' ? '例' : '%'}
            {isBest && <Tag color="success" style={{ marginLeft: 'var(--space-1, 4px)', fontSize: 10, lineHeight: '16px' }}>最优</Tag>}
            {isWorst && <Tag color="error" style={{ marginLeft: 'var(--space-1, 4px)', fontSize: 10, lineHeight: '16px' }}>最差</Tag>}
          </span>
        )
      },
    })),
  ], [bestPerMetric, worstPerMetric, allMetricCodes, metricNames])

  const handleExport = () => {
    const header = ['院区', ...allMetricCodes.map((c) => metricNames[c] ?? c)]
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
    <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5, 20px)' }}>
        <Space>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, var(--color-primary-500), #6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={22} color="#fff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>报表同比环比分析</Title>
            <span style={{ color: '#94a3b8', fontSize: 12 }}>跨院区对比 · 指标矩阵 · 趋势分析</span>
          </div>
        </Space>
      </div>

      {apiError && (
        <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: 6, fontSize: 12 }}>
          {apiError}
        </div>
      )}

      {usingDemo && (
        <div style={{ marginBottom: 'var(--space-3, 12px)', padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', color: 'var(--color-warning-600)', borderRadius: 6, fontSize: 12 }}>
          {t('w8Dose.benchmarkDemo')}
        </div>
      )}

      <Spin spinning={loading}>
        <StatCardGrid>
          <StatCard title="总检查量" value={stats.totalExams ?? '--'} suffix="例" color="var(--color-primary-500)" />
          <StatCard title="阳性率" value={stats.positiveRate ?? '--'} suffix="%" color="var(--color-warning-500)" />
          <StatCard title="甲级片率" value={stats.gradeARate ?? '--'} suffix="%" color="#10b981" />
          <StatCard title="报告及时率" value={stats.reportOnTimeRate ?? '--'} suffix="%" color="#6366f1" />
          <StatCard title="危急值闭环率" value={stats.criticalClosedRate ?? '--'} suffix="%" color="#ec4899" />
        </StatCardGrid>

        <div style={{ marginTop: 'var(--space-4, 16px)', marginBottom: 'var(--space-4, 16px)', display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569' }}>院区选择:</span>
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
          style={{ borderRadius: 12, marginTop: 'var(--space-4, 16px)' }}
          extra={
            <Button size="small" icon={<Download size={14} />} onClick={handleExport}>
              导出 Excel
            </Button>
          }
        >
          <DataTable
            dataSource={crossSiteData}
            columns={columns}
            rowKey="key"
            pagination={false}
            bordered
            scroll={{ x: 'max-content' }}
          />
        </Card>
      </Spin>
    </div>
  )
}
