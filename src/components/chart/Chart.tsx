/**
 * @deprecated CH-1: prefer the canonical `ChartContainer` wrapper
 * (src/components/charts/ChartContainer.tsx + chartDefaults). All former
 * consumers (DataReportCenterPage) now render recharts directly through
 * ChartContainer. Kept for backward compatibility only.
 * Sankey width is now container-responsive (was fixed at 600).
 */
import { useState, useRef, useCallback, useEffect, type CSSProperties } from 'react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, AreaChart, Area,
  RadarChart, Radar, ScatterChart, Scatter, Treemap, Sankey,
  FunnelChart, Funnel, RadialBarChart, RadialBar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, TooltipProps,
} from 'recharts'
import { Download, Image as ImageIcon, FileJson, Maximize2, Minimize2 } from 'lucide-react'
import { Button, Space, Dropdown, Typography } from 'antd'

type ChartType =
  | 'line' | 'bar' | 'pie' | 'area' | 'radar' | 'scatter'
  | 'treemap' | 'sankey' | 'funnel' | 'heatmap' | 'radialBar'
  | 'composed' | 'stacked-bar' | 'stacked-area'

export interface ChartProps {
  type: ChartType
  data: Record<string, unknown>[]
  xKey?: string
  yKeys?: string[]
  height?: number
  title?: string
  colors?: string[]
}

const { Text } = Typography

const DEFAULT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#e11d48', '#a855f7', '#0ea5e9', '#d946ef',
]

const containerStyle: CSSProperties = {
  position: 'relative',
  borderRadius: 8,
  border: '1px solid var(--border-subtle, #e2e8f0)',
  background: 'var(--bg-card)',
  padding: 16,
}

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 12,
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string> & { onDrill?: (data: Record<string, unknown>) => void }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--bg-card)',
      border: '1px solid var(--border-color)',
      borderRadius: 6,
      padding: '8px 12px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: 12,
    }}>
      <div style={{ fontWeight: 600, marginBottom: 4, color: '#1e293b' }}>{label}</div>
      {payload.map((entry, i) => (
        <div key={i} style={{ color: entry.color, display: 'flex', gap: 8 }}>
          <span>{entry.name}:</span>
          <strong>{entry.value}</strong>
        </div>
      ))}
    </div>
  )
}

export function Chart({
  type,
  data,
  xKey = 'name',
  yKeys = ['value'],
  height = 400,
  title,
  colors = DEFAULT_COLORS,
}: ChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [expanded, setExpanded] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)

  const chartHeight = expanded ? Math.max(height, window.innerHeight - 100) : height

  useEffect(() => {
    const el = chartRef.current
    if (!el) return undefined
    const update = () => setContainerWidth(el.clientWidth)
    update()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const exportPng = useCallback(() => {
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
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
        a.download = `chart-${type}-${Date.now()}.png`
        a.click()
        URL.revokeObjectURL(url)
      })
    }
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgStr)))
  }, [type])

  const exportSvg = useCallback(() => {
    const svg = chartRef.current?.querySelector('svg')
    if (!svg) return
    const serializer = new XMLSerializer()
    const svgStr = serializer.serializeToString(svg)
    const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `chart-${type}-${Date.now()}.svg`
    a.click()
    URL.revokeObjectURL(url)
  }, [type])

  const exportItems = [
    { key: 'png', label: '导出 PNG', icon: <ImageIcon size={14} />, onClick: exportPng },
    { key: 'svg', label: '导出 SVG', icon: <FileJson size={14} />, onClick: exportSvg },
  ]

  const renderChart = () => {
    const commonProps = { data, margin: { top: 8, right: 16, bottom: 8, left: 8 } }

    switch (type) {
      case 'line':
        return (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => (
              <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} dot={{ r: 3 }} />
            ))}
          </LineChart>
        )
      case 'bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
            ))}
          </BarChart>
        )
      case 'pie':
        return (
          <PieChart>
            <Pie data={data} dataKey={yKeys[0] ?? 'value'} nameKey={xKey} cx="50%" cy="50%" outerRadius={Math.min(chartHeight / 2 - 40, 160)} label>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </PieChart>
        )
      case 'area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.2} strokeWidth={2} />
            ))}
          </AreaChart>
        )
      case 'radar':
        return (
          <RadarChart data={data} cx="50%" cy="50%" outerRadius="70%">
            <CartesianGrid stroke="#e2e8f0" />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => (
              <Radar key={key} name={key} dataKey={key} stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.2} />
            ))}
          </RadarChart>
        )
      case 'scatter':
        return (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis dataKey={yKeys[0] ?? 'value'} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Scatter data={data} fill={colors[0]} />
          </ScatterChart>
        )
      case 'treemap':
        return <Treemap data={data} dataKey={yKeys[0] ?? 'value'} aspectRatio={4 / 3} stroke="#fff" fill={colors[0]} />
      case 'sankey':
        return (
          <Sankey
            data={data as unknown as { nodes: { name: string }[]; links: { source: number; target: number; value: number }[] }}
            width={containerWidth || undefined} height={chartHeight - 60}
            node={{ stroke: '#e2e8f0', strokeWidth: 1 }}
            link={{ stroke: '#e2e8f0' }}
          />
        )
      case 'funnel':
        return (
          <FunnelChart>
            <Tooltip content={<CustomTooltip />} />
            <Funnel dataKey={yKeys[0] ?? 'value'} data={data} isAnimationActive>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Funnel>
          </FunnelChart>
        )
      case 'heatmap':
        return (
          <ComposedChart data={data}>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey={yKeys[0] ?? 'value'}>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </Bar>
          </ComposedChart>
        )
      case 'radialBar':
        return (
          <RadialBarChart data={data} cx="50%" cy="50%" innerRadius="20%" outerRadius="90%" barSize={12}>
            <RadialBar dataKey={yKeys[0] ?? 'value'} background>
              {data.map((_, i) => (
                <Cell key={i} fill={colors[i % colors.length]} />
              ))}
            </RadialBar>
            <Tooltip content={<CustomTooltip />} />
            <Legend />
          </RadialBarChart>
        )
      case 'composed':
        return (
          <ComposedChart {...commonProps}>
            <CartesianGrid stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => {
              if (i === 0) return <Bar key={key} dataKey={key} fill={colors[i % colors.length]} radius={[4, 4, 0, 0]} />
              return <Line key={key} type="monotone" dataKey={key} stroke={colors[i % colors.length]} strokeWidth={2} />
            })}
          </ComposedChart>
        )
      case 'stacked-bar':
        return (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => (
              <Bar key={key} dataKey={key} stackId="stack" fill={colors[i % colors.length]} />
            ))}
          </BarChart>
        )
      case 'stacked-area':
        return (
          <AreaChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            {yKeys.map((key, i) => (
              <Area key={key} type="monotone" dataKey={key} stackId="stack" stroke={colors[i % colors.length]} fill={colors[i % colors.length]} fillOpacity={0.6} />
            ))}
          </AreaChart>
        )
      default:
        return <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>不支持的图表类型: {type}</div>
    }
  }

  return (
    <div style={{ ...containerStyle, position: expanded ? 'fixed' : 'relative', inset: expanded ? 16 : undefined, zIndex: expanded ? 1000 : undefined }}>
      <div style={headerStyle}>
        {title && <Text strong style={{ fontSize: 14 }}>{title}</Text>}
        <Space size={4}>
          <Dropdown menu={{ items: exportItems.map((item) => ({ key: item.key, label: <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>{item.icon}{item.label}</span>, onClick: item.onClick })) }} trigger={['click']}>
            <Button size="small" icon={<Download size={14} />}>导出</Button>
          </Dropdown>
          <Button size="small" icon={expanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />} onClick={() => setExpanded((v) => !v)} />
        </Space>
      </div>
      <div ref={chartRef} onContextMenu={(e) => e.preventDefault()}>
        <ResponsiveContainer width="100%" height={chartHeight}>
          {renderChart()}
        </ResponsiveContainer>
      </div>
    </div>
  )
}

export default Chart
