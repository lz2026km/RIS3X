import { useState, useMemo } from 'react'
import { Card, Segmented, Select, Space, Row, Col, Statistic } from 'antd'
import { TrendingUp, TrendingDown, BarChart3, LineChart, Activity } from 'lucide-react'

export type CompareMode = 'yoy' | 'qoq'
export type MetricCode = 'exam_count' | 'positive_rate' | 'grade_a_rate' | 'report_ontime_rate' | 'critical_closed_rate'
export type Dimension = 'dept' | 'site' | 'time'
export type ChartType = 'bar' | 'line' | 'radar'

interface CompareItem {
  label: string
  current: number
  previous: number
}

export interface BenchmarkCompareData {
  metricName: string
  current: number
  previous: number
  delta: number
  deltaPercent: number
  breakdown?: CompareItem[]
}

interface BenchmarkV2Props {
  data?: BenchmarkCompareData
  compareMode: CompareMode
  metricCode: MetricCode
  dimension: Dimension
  chartType: ChartType
  onCompareModeChange: (v: CompareMode) => void
  onMetricChange: (v: MetricCode) => void
  onDimensionChange: (v: Dimension) => void
  onChartTypeChange: (v: ChartType) => void
}

const METRICS_OPTIONS = [
  { label: '检查量', value: 'exam_count' },
  { label: '阳性率', value: 'positive_rate' },
  { label: '甲级片率', value: 'grade_a_rate' },
  { label: '报告及时率', value: 'report_ontime_rate' },
  { label: '危急值闭环率', value: 'critical_closed_rate' },
]

const CHART_ICONS: Record<ChartType, React.ReactNode> = {
  bar: <BarChart3 size={14} />,
  line: <LineChart size={14} />,
  radar: <Activity size={14} />,
}

function DualBarChart({ items }: { items: CompareItem[] }) {
  const maxVal = Math.max(...items.flatMap((i) => [i.current, i.previous]), 1)
  const barMaxH = 120
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: barMaxH + 40, padding: '0 4px', position: 'relative' }}>
      {items.map((item, idx) => {
        const hCurr = (item.current / maxVal) * barMaxH
        const hPrev = (item.previous / maxVal) * barMaxH
        return (
          <div key={idx} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: barMaxH }}>
              <div style={{ width: 14, height: hPrev, background: '#94a3b8', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} title={`去年: ${item.previous}`} />
              <div style={{ width: 14, height: hCurr, background: '#3b82f6', borderRadius: '3px 3px 0 0', transition: 'height 0.3s' }} title={`今年: ${item.current}`} />
            </div>
            <span style={{ fontSize: 9, color: '#64748b', writingMode: 'vertical-lr', textOrientation: 'mixed', height: 36 }}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function TrendLine({ items }: { items: CompareItem[] }) {
  const w = 500
  const h = 150
  const pad = { top: 10, right: 10, bottom: 25, left: 35 }
  const iw = w - pad.left - pad.right
  const ih = h - pad.top - pad.bottom
  const allVals = items.flatMap((i) => [i.current, i.previous])
  const minV = Math.min(...allVals) - 5
  const maxV = Math.max(...allVals) + 5
  const range = maxV - minV || 1
  const xStep = items.length > 1 ? iw / (items.length - 1) : iw

  const linePath = (values: number[], color: string) =>
    items
      .map((item, i) => `${i === 0 ? 'M' : 'L'}${pad.left + i * xStep},${pad.top + ih - ((item.current - minV) / range) * ih}`.replace('item.current', String(values[i])))
      .join(' ')

  const currPath = items.map((item, i) => `${i === 0 ? 'M' : 'L'}${pad.left + i * xStep},${pad.top + ih - ((item.current - minV) / range) * ih}`).join(' ')
  const prevPath = items.map((item, i) => `${i === 0 ? 'M' : 'L'}${pad.left + i * xStep},${pad.top + ih - ((item.previous - minV) / range) * ih}`).join(' ')

  return (
    <svg width={w} height={h} style={{ display: 'block', margin: '0 auto' }}>
      <line x1={pad.left} y1={pad.top} x2={pad.left} y2={pad.top + ih} stroke="#e2e8f0" />
      <line x1={pad.left} y1={pad.top + ih} x2={pad.left + iw} y2={pad.top + ih} stroke="#e2e8f0" />
      <path d={prevPath} fill="none" stroke="#94a3b8" strokeWidth={2} strokeDasharray="4 2" />
      <path d={currPath} fill="none" stroke="#3b82f6" strokeWidth={2} />
      {items.map((item, i) => (
        <g key={i}>
          <circle cx={pad.left + i * xStep} cy={pad.top + ih - ((item.current - minV) / range) * ih} r={3} fill="#3b82f6" />
          <text x={pad.left + i * xStep} y={pad.top + ih + 14} fontSize={8} textAnchor="middle" fill="#94a3b8">
            {item.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

function RadarChart({ items }: { items: CompareItem[] }) {
  const size = 200
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.38
  const maxVal = Math.max(...items.flatMap((i) => [i.current, i.previous]), 1)
  const numAxes = items.length
  const angleStep = (2 * Math.PI) / numAxes || 1

  const getPoint = (value: number, i: number) => {
    const angle = angleStep * i - Math.PI / 2
    const r = (value / maxVal) * radius
    return { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) }
  }

  return (
    <svg width={size} height={size} style={{ display: 'block', margin: '0 auto' }}>
      {[0.25, 0.5, 0.75, 1].map((l) => {
        const pts = items.map((_, i) => getPoint(maxVal * l, i))
        return <polygon key={l} points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#e2e8f0" strokeWidth={1} />
      })}
      {numAxes > 0 && (
        <>
          <polygon points={items.map((item, i) => { const p = getPoint(item.previous, i); return `${p.x},${p.y}` }).join(' ')} fill="#94a3b8" fillOpacity={0.12} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" />
          <polygon points={items.map((item, i) => { const p = getPoint(item.current, i); return `${p.x},${p.y}` }).join(' ')} fill="#3b82f6" fillOpacity={0.15} stroke="#3b82f6" strokeWidth={2} />
          {items.map((item, i) => {
            const p = getPoint(item.current, i)
            return (
              <g key={i}>
                <line x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#e2e8f0" strokeWidth={1} />
                <circle cx={p.x} cy={p.y} r={3} fill="#3b82f6" />
                <text x={p.x + 6} y={p.y + 4} fontSize={8} fill="#475569">{item.label}</text>
              </g>
            )
          })}
        </>
      )}
    </svg>
  )
}

export default function BenchmarkV2({
  data, compareMode, metricCode, dimension, chartType,
  onCompareModeChange, onMetricChange, onDimensionChange, onChartTypeChange,
}: BenchmarkV2Props) {
  const items = data?.breakdown ?? []

  const chartContent = useMemo(() => {
    if (!items.length) {
      return (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 13 }}>
          请选择维度以查看对比图表
        </div>
      )
    }
    switch (chartType) {
      case 'bar':
        return <DualBarChart items={items} />
      case 'line':
        return <TrendLine items={items} />
      case 'radar':
        return <RadarChart items={items} />
    }
  }, [items, chartType])

  return (
    <Card
      title={
        <Space>
          <BarChart3 size={16} />
          <span>同比/环比对比</span>
        </Space>
      }
      bordered={false}
      style={{ borderRadius: 12 }}
      extra={
        <Space wrap>
          <Segmented
            size="small"
            value={compareMode}
            onChange={(v) => onCompareModeChange(v as CompareMode)}
            options={[
              { label: '同比', value: 'yoy' },
              { label: '环比', value: 'qoq' },
            ]}
          />
          <Select size="small" value={metricCode} onChange={(v) => onMetricChange(v)} style={{ width: 120 }} options={METRICS_OPTIONS} />
          <Select size="small" value={dimension} onChange={(v) => onDimensionChange(v)} style={{ width: 100 }} options={[
            { label: '科室', value: 'dept' },
            { label: '院区', value: 'site' },
            { label: '时间', value: 'time' },
          ]} />
          <Segmented
            size="small"
            value={chartType}
            onChange={(v) => onChartTypeChange(v as ChartType)}
            options={[
              { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><BarChart3 size={14} />柱</span>, value: 'bar' },
              { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><LineChart size={14} />折线</span>, value: 'line' },
              { label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Activity size={14} />雷达</span>, value: 'radar' },
            ]}
          />
        </Space>
      }
    >
      {data && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col span={6}>
            <Statistic title="当前值" value={data.current} suffix={metricCode === 'exam_count' ? '例' : '%'} valueStyle={{ color: '#3b82f6' }} />
          </Col>
          <Col span={6}>
            <Statistic title="前期值" value={data.previous} suffix={metricCode === 'exam_count' ? '例' : '%'} valueStyle={{ color: '#94a3b8' }} />
          </Col>
          <Col span={6}>
            <Statistic title="差值" value={data.delta} prefix={data.delta >= 0 ? '+' : ''} valueStyle={{ color: data.delta >= 0 ? '#10b981' : '#ef4444' }} />
          </Col>
          <Col span={6}>
            <Statistic
              title="变化率"
              value={data.deltaPercent}
              suffix="%"
              prefix={data.deltaPercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              valueStyle={{ color: data.deltaPercent >= 0 ? '#10b981' : '#ef4444' }}
            />
          </Col>
        </Row>
      )}
      <div style={{ overflowX: 'auto' }}>{chartContent}</div>
    </Card>
  )
}
