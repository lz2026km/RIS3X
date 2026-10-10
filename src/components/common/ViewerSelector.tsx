import { useNavigate } from 'react-router-dom'

const bannerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 'var(--space-3, 12px)',
  padding: '8px 16px',
  background: 'linear-gradient(90deg, var(--color-primary-800), var(--color-primary-600))',
  color: '#fff',
  fontSize: 12,
  fontWeight: 500,
}

const btnStyle: React.CSSProperties = {
  padding: '4px 14px',
  borderRadius: 6,
  border: '1px solid rgba(255,255,255,0.4)',
  background: 'rgba(255,255,255,0.15)',
  color: '#fff',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'all 0.2s',
}

interface ViewerSelectorProps {
  current: 'classic' | 'pro'
}

export default function ViewerSelector({ current }: ViewerSelectorProps) {
  const navigate = useNavigate()

  if (current === 'pro') {
    return (
      <div style={bannerStyle}>
        <span>DICOM Viewer Pro (Cornerstone3D 引擎)</span>
        <button
          style={btnStyle}
          onClick={() => navigate('/dicom-viewer')}
          onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.3)' }}
          onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)' }}
        >
          返回经典版
        </button>
      </div>
    )
  }

  return (
    <div style={bannerStyle}>
      <span>DICOM 影像浏览器 v0.4.0</span>
      <button
        style={btnStyle}
        onClick={() => navigate('/dicom-viewer-pro')}
        onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.3)' }}
        onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)' }}
      >
        试用新版 DICOM 查看器 Pro
      </button>
    </div>
  )
}
