import React from 'react'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'
import { formatPercent } from './index'

export function CostCard({ title, value, subtitle, icon: Icon, trend, trendValue, color }: {
  title: string
  value: string
  subtitle?: string
  icon: React.ComponentType<any>
  trend?: 'up' | 'down'
  trendValue?: string
  color?: string
}) {
  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card, #161b22)',
    border: '1px solid var(--border-default, #30363d)',
    borderRadius: 8,
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  }

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }

  const iconContainerStyle: React.CSSProperties = {
    width: 36,
    height: 36,
    borderRadius: 8,
    background: color ? `${color}20` : '#1e40af20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const valueStyle: React.CSSProperties = {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--text-primary, #f0f6fc)',
  }

  const trendStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    color: trend === 'up' ? 'var(--color-success-500)' : 'var(--color-error-500)',
  }

  return (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{title}</span>
        <div style={iconContainerStyle}>
          <Icon size={18} color={color || 'var(--color-primary-500)'} />
        </div>
      </div>
      <div style={valueStyle}>{value}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {subtitle && <span style={{ fontSize: 12, color: '#6e7681' }}>{subtitle}</span>}
        {trend && trendValue && (
          <div style={trendStyle}>
            {trend === 'up' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            <span>{trendValue}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export function SimpleBarChart({ data, height = 200 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-end',
      gap: 8,
      height,
      padding: '16px 8px',
    }}>
      {data.map((item, idx) => {
        const barHeight = maxValue > 0 ? (item.value / maxValue) * (height - 40) : 0
        return (
          <div key={idx} style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
          }}>
            <div style={{
              width: '100%',
              height: barHeight,
              background: item.color || 'var(--color-primary-500)',
              borderRadius: '4px 4px 0 0',
              transition: 'height 0.3s ease',
              opacity: 0.85,
            }} />
            <span style={{ fontSize: 12, color: '#6e7681' }}>{item.label}</span>
          </div>
        )
      })}
    </div>
  )
}

export function SimpleHorizontalBarChart({ data, height = 200 }: { data: { label: string; value: number; color?: string }[]; height?: number }) {
  const maxValue = Math.max(...data.map(d => d.value))

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      height,
      padding: '16px 8px',
      overflowY: 'auto',
    }}>
      {data.map((item, idx) => {
        const barWidth = maxValue > 0 ? (item.value / maxValue) * 100 : 0
        return (
          <div key={idx} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            height: 24,
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)', width: 60, flexShrink: 0 }}>{item.label}</span>
            <div style={{
              flex: 1,
              height: 16,
              background: 'var(--bg-secondary, #21262d)',
              borderRadius: 4,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${barWidth}%`,
                height: '100%',
                background: item.color || 'var(--color-primary-500)',
                borderRadius: 4,
                transition: 'width 0.3s ease',
              }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-primary, #f0f6fc)', width: 50, textAlign: 'right' }}>
              {item.value.toFixed(0)}万
            </span>
          </div>
        )
      })}
    </div>
  )
}

export function SimplePieChart({ data, size = 160 }: { data: { label: string; value: number; color: string }[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  let accumulatedPercent = 0

  const getArcPath = (startPercent: number, endPercent: number, radius: number) => {
    const startAngle = startPercent * 2 * Math.PI - Math.PI / 2
    const endAngle = endPercent * 2 * Math.PI - Math.PI / 2
    const x1 = radius + radius * Math.cos(startAngle)
    const y1 = radius + radius * Math.sin(startAngle)
    const x2 = radius + radius * Math.cos(endAngle)
    const y2 = radius + radius * Math.sin(endAngle)
    const largeArc = endPercent - startPercent > 0.5 ? 1 : 0
    return `M ${radius} ${radius} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size * 2} ${size * 2}`}>
        {data.map((item, idx) => {
          const percent = total > 0 ? item.value / total : 0
          const path = getArcPath(accumulatedPercent, accumulatedPercent + percent, size)
          accumulatedPercent += percent
          return (
            <path
              key={idx}
              d={path}
              fill={item.color}
              style={{ transition: 'all 0.3s ease', cursor: 'pointer' }}
            >
              <title>{item.label}: {formatPercent(percent * 100)}</title>
            </path>
          )
        })}
        <circle cx={size} cy={size} r={size * 0.5} fill="#161b22" />
        <text x={size} y={size - 8} textAnchor="middle" fill="#f0f6fc" fontSize="14" fontWeight="600">
          {total.toLocaleString()}万
        </text>
        <text x={size} y={size + 12} textAnchor="middle" fill="#6e7681" fontSize="10">
          年度成本
        </text>
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((item, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 2, background: item.color }} />
            <span style={{ fontSize: 12, color: 'var(--text-muted, #8b949e)' }}>{item.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-primary, #f0f6fc)', marginLeft: 'auto' }}>{total > 0 ? formatPercent((item.value / total) * 100) : '0%'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
