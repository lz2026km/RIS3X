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
        gap: 8,
        color: 'var(--color-error, #ef4444)',
        background: 'var(--color-error-bg, #fef2f2)',
        borderRadius: 8,
        border: '1px dashed var(--color-error, #ef4444)',
      }}
    >
      <AlertTriangle size={28} aria-hidden="true" />
      <span style={{ fontSize: 13, color: 'var(--color-error, #ef4444)' }}>{description}</span>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          style={{
            marginTop: 4,
            padding: '4px 12px',
            borderRadius: 6,
            border: '1px solid var(--color-error, #ef4444)',
            background: 'transparent',
            color: 'var(--color-error, #ef4444)',
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
