import type { CSSProperties } from 'react'

const containerStyle: CSSProperties = {
  position: 'sticky',
  top: 'var(--header-h, 52px)',
  zIndex: 10,
  padding: 8,
  marginBottom: 12,
  background: 'var(--state-loading-bg, #dbeafe)',
  color: 'var(--state-loading-fg, var(--color-primary-800))',
  border: '1px solid var(--state-loading-border, #bfdbfe)',
  borderRadius: 6,
  fontSize: 12,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

const spinnerStyle: CSSProperties = {
  width: 14,
  height: 14,
  border: '2px solid var(--state-loading-border, #93c5fd)',
  borderTopColor: 'var(--state-loading-fg, var(--color-primary-800))',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
  display: 'inline-block',
}

export function LoadingBanner({ message = '正在从 API 加载数据...' }: { message?: string }) {
  return (
    <div style={containerStyle} data-testid="api-loading-banner" role="status" aria-live="polite" aria-busy="true">
      <span style={spinnerStyle} aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}
