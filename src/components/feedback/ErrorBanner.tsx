import type { CSSProperties } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from 'antd'

const containerStyle: CSSProperties = {
  position: 'sticky',
  top: 'var(--header-h, 52px)',
  zIndex: 10,
  padding: 8,
  marginBottom: 12,
  background: 'var(--state-warning-bg, #fef3c7)',
  color: 'var(--state-warning-fg, #92400e)',
  border: '1px solid var(--state-warning-border, #fde68a)',
  borderRadius: 6,
  fontSize: 13,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

export interface ErrorBannerProps {
  message?: string
  onRetry?: () => void
  retryLabel?: string
}

export function ErrorBanner({ message = 'API 不可用,使用本地数据', onRetry, retryLabel = '重试' }: ErrorBannerProps) {
  return (
    <div style={containerStyle} data-testid="api-error-banner" role="alert" aria-live="assertive">
      <AlertTriangle size={14} aria-hidden="true" /> {message}
      {onRetry && (
        <Button size="small" type="link" onClick={onRetry} style={{ marginLeft: 'auto', padding: 0 }}>
          {retryLabel}
        </Button>
      )}
    </div>
  )
}
