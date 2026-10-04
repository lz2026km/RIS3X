/**
 * G005 Radiology RIS - ChartContainer
 * Canonical chart wrapper: ResponsiveContainer + type-aware height + 3 states
 * (empty/skeleton/error) + optional title + actions + shared chartDefaults.
 *
 * Migrates ad-hoc <ResponsiveContainer width="100%" height={N}> patterns
 * into a single source of truth.
 */
import React, { type CSSProperties } from 'react'
import { ResponsiveContainer } from 'recharts'
import ChartEmpty from './ChartEmpty'
import ChartSkeleton from './ChartSkeleton'
import ChartError from './ChartError'

export type ChartState = 'idle' | 'loading' | 'empty' | 'error' | 'ready'

export type ChartKind =
  | 'line'
  | 'bar'
  | 'area'
  | 'pie'
  | 'radar'
  | 'composed'
  | 'sparkline'
  | 'other'

/**
 * Type-aware minimum / default heights (px).
 * Used as the default height when the caller does not pass `height`.
 * An explicitly passed `height` always wins.
 */
export const CHART_TYPE_HEIGHTS: Record<ChartKind, number> = {
  sparkline: 40,
  pie: 240,
  bar: 220,
  line: 220,
  area: 220,
  radar: 260,
  composed: 260,
  other: 240,
}

export const CHART_TYPE_MIN_HEIGHT: Record<ChartKind, number> = { ...CHART_TYPE_HEIGHTS }

export interface ChartDefaults {
  margin: { top: number; right: number; bottom: number; left: number }
  axis: { stroke: string; tick: { fontSize: number; fill: string } }
  grid: { strokeDasharray: string; stroke: string }
  legend: { wrapperStyle: CSSProperties; iconSize: number }
  tooltip: {
    contentStyle: CSSProperties
    labelStyle: CSSProperties
    itemStyle: CSSProperties
  }
}

/**
 * Shared recharts config (design tokens only, no light-only literals).
 * Spread onto <XAxis {...chartDefaults.axis} />, <CartesianGrid {...chartDefaults.grid} />,
 * <Tooltip {...chartDefaults.tooltip} /> and chart `margin`.
 */
export const chartDefaults: ChartDefaults = {
  margin: { top: 8, right: 16, bottom: 24, left: 48 },
  axis: {
    stroke: 'var(--border-color, #e2e8f0)',
    tick: { fontSize: 11, fill: 'var(--text-secondary, #475569)' },
  },
  grid: {
    strokeDasharray: '3 3',
    stroke: 'var(--border-color, #e2e8f0)',
  },
  legend: {
    wrapperStyle: { fontSize: 11 },
    iconSize: 10,
  },
  tooltip: {
    contentStyle: {
      background: 'var(--bg-card, #ffffff)',
      border: '1px solid var(--border-color, #e2e8f0)',
      borderRadius: 8,
      fontSize: 12,
      color: 'var(--text-primary, #1e293b)',
      boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
    },
    labelStyle: { color: 'var(--text-secondary, #475569)', fontSize: 12, fontWeight: 600 },
    itemStyle: { color: 'var(--text-primary, #1e293b)', fontSize: 12 },
  },
}

export interface ChartContainerProps {
  title?: React.ReactNode
  action?: React.ReactNode
  height?: number
  /** Chart kind; drives the default height when `height` is omitted. */
  type?: ChartKind
  state?: ChartState
  emptyDescription?: string
  errorDescription?: string
  onRetry?: () => void
  children: React.ReactElement
  style?: React.CSSProperties
  testId?: string
}

const ChartContainer: React.FC<ChartContainerProps> = ({
  title,
  action,
  height,
  type = 'other',
  state = 'ready',
  emptyDescription,
  errorDescription,
  onRetry,
  children,
  style,
  testId,
}) => {
  const resolvedHeight = height ?? CHART_TYPE_HEIGHTS[type]

  const containerStyle: React.CSSProperties = {
    width: '100%',
    overflow: 'hidden',
    ...style,
  }

  return (
    <div
      data-testid={testId}
      style={containerStyle}
    >
      {(title || action) && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 12,
            gap: 8,
          }}
        >
          {title && (
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text, #1e293b)' }}>
              {title}
            </div>
          )}
          {action && <div>{action}</div>}
        </div>
      )}
      {state === 'loading' && <ChartSkeleton height={resolvedHeight} showHeader={false} />}
      {state === 'empty' && <ChartEmpty description={emptyDescription} height={resolvedHeight} />}
      {state === 'error' && (
        <ChartError
          description={errorDescription}
          height={resolvedHeight}
          onRetry={onRetry}
        />
      )}
      {state === 'ready' && (
        <div style={{ width: '100%', height: resolvedHeight }}>
          <ResponsiveContainer width="100%" height="100%">
            {children}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export default ChartContainer
