import { useEffect, useState } from 'react'
import { Wifi, WifiOff, RefreshCw } from 'lucide-react'
import { useMobileStore } from '../store/mobileStore'

type Connectivity = 'online' | 'offline' | 'weak'

const LABEL: Record<Connectivity, string> = {
  online: '在线',
  offline: '离线',
  weak: '信号弱',
}

const COLOR: Record<Connectivity, string> = {
  online: '#16a34a',
  offline: '#dc2626',
  weak: '#d97706',
}

interface OfflineIndicatorProps {
  queueCount?: number
  onSyncClick?: () => void
  compact?: boolean
}

export default function OfflineIndicator({ queueCount = 0, onSyncClick, compact }: OfflineIndicatorProps) {
  const [connectivity, setConnectivity] = useState<Connectivity>('online')
  const isOnline = useMobileStore(s => s.isOnline)

  useEffect(() => {
    const goOnline = () => setConnectivity('online')
    const goOffline = () => setConnectivity('offline')
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  useEffect(() => {
    setConnectivity(isOnline ? 'online' : 'offline')
  }, [isOnline])

  if (compact) {
    return (
      <div onClick={onSyncClick} style={{ cursor: onSyncClick ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 4 }}>
        {connectivity === 'online' ? <Wifi size={14} color={COLOR[connectivity]} /> : <WifiOff size={14} color={COLOR[connectivity]} />}
        {queueCount > 0 && (
          <span style={{ fontSize: 10, color: '#d97706', fontWeight: 700 }}>{queueCount}</span>
        )}
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 12 }}>
      {connectivity === 'online' ? <Wifi size={14} color={COLOR[connectivity]} /> : <WifiOff size={14} color={COLOR[connectivity]} />}
      <span style={{ color: COLOR[connectivity], fontWeight: 600 }}>{LABEL[connectivity]}</span>
      {connectivity !== 'online' && queueCount > 0 && (
        <span onClick={onSyncClick} style={{ cursor: 'pointer', color: '#d97706', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 2 }}>
          <RefreshCw size={12} /> {queueCount}待同步
        </span>
      )}
    </div>
  )
}
