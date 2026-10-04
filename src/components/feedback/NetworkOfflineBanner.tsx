import type { CSSProperties } from 'react'
import { WifiOff } from 'lucide-react'

const bannerStyle: CSSProperties = {
  position: 'sticky',
  top: 52,
  zIndex: 'var(--z-fixed)' as unknown as number,
  padding: '6px 16px',
  background: '#dc2626',
  color: '#ffffff',
  fontSize: 12,
  fontWeight: 600,
  textAlign: 'center',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
}

export function NetworkOfflineBanner() {
  return (
    <div style={bannerStyle} role="alert" aria-live="assertive" data-testid="network-offline-banner">
      <WifiOff size={14} aria-hidden="true" />
      网络已断开，部分功能不可用
    </div>
  )
}