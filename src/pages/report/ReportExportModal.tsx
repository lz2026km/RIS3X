
import { CheckCircle } from 'lucide-react'

const WHITE = 'var(--bg-card)'
const PRIMARY = '#1e40af'
const GRAY = '#64748b'
const ACCENT = '#3182ce'
const SUCCESS = '#059669'

export interface ReportExportModalProps {
  show: boolean
  title: string
  message: string
  complete: boolean
  onClose?: () => void
}

export default function ReportExportModal({ show, title, message, complete, onClose }: ReportExportModalProps) {
  if (!show) return null
  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
      justifyContent: 'center', zIndex: 1000,
    }} onClick={onClose}>
      <div style={{
        background: WHITE, borderRadius: 16, padding: 32, width: 380,
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center',
      }} onClick={e => e.stopPropagation()}>
        {!complete ? (
          <>
            <div style={{
              width: 48, height: 48, border: '4px solid var(--border-color)',
              borderTopColor: ACCENT, borderRadius: '50%',
              animation: 'spin 0.8s linear infinite', margin: '0 auto 16px',
            }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: PRIMARY, marginBottom: 8 }}>{title}</div>
            <div style={{ fontSize: 12, color: GRAY }}>{message}</div>
          </>
        ) : (
          <>
            <CheckCircle size={48} color={SUCCESS} style={{ margin: '0 auto 16px' }} />
            <div style={{ fontSize: 16, fontWeight: 700, color: SUCCESS, marginBottom: 8 }}>{title}完成</div>
            <div style={{ fontSize: 12, color: GRAY }}>{message}</div>
          </>
        )}
      </div>
    </div>
  )
}
