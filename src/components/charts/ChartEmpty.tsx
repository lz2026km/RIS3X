/**
 * G005 Radiology RIS - ChartEmpty
 * Standard empty-state placeholder for all charts.
 * Replaces ad-hoc Empty components inside Card with a uniform 240px height.
 */
import React from 'react'
import { Inbox } from 'lucide-react'

export interface ChartEmptyProps {
  description?: string
  height?: number
  icon?: React.ReactNode
  testId?: string
}

export default function ChartEmpty({
  description = '暂无数据',
  height = 240,
  icon,
  testId = 'chart-empty',
}: ChartEmptyProps) {
  return (
    <div
      data-testid={testId}
      role="status"
      aria-live="polite"
      style={{
        width: '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2, 8px)',
        color: 'var(--color-text-muted, #94a3b8)',
        background: 'var(--color-bg-subtle, #f8fafc)',
        borderRadius: 8,
        border: '1px dashed var(--color-border, #e2e8f0)',
      }}
    >
      {icon ?? <Inbox size={32} aria-hidden="true" />}
      <span style={{ fontSize: 12 }}>{description}</span>
    </div>
  )
}
