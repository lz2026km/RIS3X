/**
 * G005 Radiology RIS - ChartError
 * Error placeholder for failed chart loads. Provides retry hook.
 */

import { AlertTriangle } from 'lucide-react'

export interface ChartErrorProps {
  description?: string
  height?: number
  onRetry?: () => void
  testId?: string
}

export default function ChartError({
  description = '图表加载失败',
  height = 240,
  onRetry,
  testId = 'chart-error',
}: ChartErrorProps) {
  return (
    <div
      data-testid={testId}
      role="alert"
      style={{
        width: '100%',
        height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--space-2, 8px)',
        color: 'var(--color-error, var(--color-error-500))',
        background: 'var(--color-error-bg, #fef2f2)',
        borderRadius: 8,
        border: '1px dashed var(--color-error, var(--color-error-500))',
      }}
    >
      <AlertTriangle size={28} aria-hidden="true" />
      <span style={{ fontSize: 12, color: 'var(--color-error, var(--color-error-500))' }}>{description}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 'var(--space-1, 4px)',
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-error, var(--color-error-500))',
            background: 'transparent',
            color: 'var(--color-error, var(--color-error-500))',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          重试
        </button>
      )}
    </div>
  )
}
