import { useState } from 'react'
import {
  ZoomIn, Move, Sun, RotateCw, RotateCcw,
  FlipHorizontal, FlipVertical, RefreshCw, Ruler,
  PenTool, Play, Pause, Printer, Plus, Minus,
  EyeOff, Flame, Droplets, Activity, Wind,
} from 'lucide-react'

type Tool = 'zoom' | 'pan' | 'wl' | 'rotate' | 'flipH' | 'flipV' | 'measure' | 'annotate' | 'play' | 'print' | 'reset'
type PseudoColorMode = 'none' | 'hotIron' | 'coolBlue' | 'grayscale' | 'pet' | 'softTissue'

interface DicomToolbarProps {
  activeTool: Tool
  onToolClick: (tool: Tool) => void
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  rotation: number
  onRotateCw: () => void
  onRotateCcw: () => void
  pseudoColorMode: PseudoColorMode
  showPseudoColorPanel: boolean
  onTogglePseudoColorPanel: () => void
  showAnnotationPanel: boolean
  onToggleAnnotationPanel: () => void
  isPlaying: boolean
}

const PRIMARY = '#1e3a5f'
const PRIMARY_LIGHT = '#2d4a6f'

const s = {
  toolbar: {
    width: 60,
    background: `linear-gradient(180deg, ${PRIMARY} 0%, ${PRIMARY_LIGHT} 100%)`,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 12,
    gap: 4,
    borderRight: `1px solid ${PRIMARY}`,
    flexShrink: 0,
    boxShadow: '2px 0 8px rgba(30,58,95,0.3)',
  },
  btn: {
    width: 44, height: 44, borderRadius: 10, border: 'none',
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', transition: 'all 0.2s',
    position: 'relative' as const, flexShrink: 0,
  },
  btnActive: {
    background: 'rgba(255,255,255,0.2)', color: '#fff',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  },
  divider: {
    width: 32, height: 1, background: 'rgba(255,255,255,0.2)', margin: '4px 0',
  },
}

function Tooltip({ children, title }: { children: React.ReactNode; title: string }) {
  const [show, setShow] = useState(false)
  return (
    <div style={{ position: 'relative' }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={{
          position: 'absolute', left: '100%', top: '50%',
          transform: 'translateY(-50%)', marginLeft: 8,
          background: 'rgba(0,0,0,0.85)', color: '#fff',
          padding: '4px 8px', borderRadius: 4, fontSize: 12,
          whiteSpace: 'nowrap', zIndex: 1000, pointerEvents: 'none',
        }}>
          {title}
        </div>
      )}
    </div>
  )
}

export default function DicomToolbar({
  activeTool, onToolClick, zoom, onZoomIn, onZoomOut,
  rotation, onRotateCw, onRotateCcw,
  pseudoColorMode, onTogglePseudoColorPanel,
  showAnnotationPanel, onToggleAnnotationPanel,
  isPlaying,
}: DicomToolbarProps) {
  const tools: { tool: Tool; icon: React.ReactNode; label: string; divider?: boolean }[] = [
    { tool: 'zoom', icon: <ZoomIn size={20} />, label: '缩放' },
    { tool: 'pan', icon: <Move size={20} />, label: '平移' },
    { tool: 'wl', icon: <Sun size={20} />, label: '窗口/级别' },
    { tool: 'rotate', icon: <RotateCw size={20} />, label: '旋转90°' },
    { tool: 'flipH', icon: <FlipHorizontal size={20} />, label: '水平翻转', divider: true },
    { tool: 'flipV', icon: <FlipVertical size={20} />, label: '垂直翻转' },
    { tool: 'reset', icon: <RefreshCw size={20} />, label: '重置', divider: true },
    { tool: 'measure', icon: <Ruler size={20} />, label: '测量' },
    { tool: 'annotate', icon: <PenTool size={20} />, label: '标注' },
    { tool: 'play', icon: isPlaying ? <Pause size={20} /> : <Play size={20} />, label: isPlaying ? '暂停' : '播放', divider: true },
    { tool: 'print', icon: <Printer size={20} />, label: '胶片打印' },
  ]

  return (
    <div style={s.toolbar}>
      {tools.map(({ tool, icon, label, divider }) => (
        <div key={tool}>
          {divider && <div style={s.divider} />}
          <Tooltip title={label}>
            <button
              style={{
                ...s.btn,
                ...(activeTool === tool ? s.btnActive : {}),
              }}
              onClick={() => onToolClick(tool)}
            >
              {icon}
            </button>
          </Tooltip>
        </div>
      ))}

      {activeTool === 'zoom' && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button style={{ ...s.btn, width: 36, height: 28, padding: 0 }} onClick={onZoomIn}>
            <Plus size={14} color="#fff" />
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{zoom}%</span>
          <button style={{ ...s.btn, width: 36, height: 28, padding: 0 }} onClick={onZoomOut}>
            <Minus size={14} color="#fff" />
          </button>
        </div>
      )}

      {activeTool === 'rotate' && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button style={{ ...s.btn, width: 36, height: 28, padding: 0 }} onClick={onRotateCw}>
            <RotateCw size={14} color="#fff" />
          </button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{rotation}°</span>
          <button style={{ ...s.btn, width: 36, height: 28, padding: 0 }} onClick={onRotateCcw}>
            <RotateCcw size={14} color="#fff" />
          </button>
        </div>
      )}

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Tooltip title="伪彩显示">
          <button
            style={{
              ...s.btn, width: 36, height: 28, padding: 0,
              ...(pseudoColorMode !== 'none' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}),
            }}
            onClick={onTogglePseudoColorPanel}
          >
            {pseudoColorMode === 'none' ? <EyeOff size={14} /> :
              pseudoColorMode === 'hotIron' ? <Flame size={14} /> :
              pseudoColorMode === 'coolBlue' ? <Droplets size={14} /> :
              pseudoColorMode === 'pet' ? <Activity size={14} /> :
              <Wind size={14} />}
          </button>
        </Tooltip>
      </div>

      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Tooltip title="标注工具">
          <button
            style={{
              ...s.btn, width: 36, height: 28, padding: 0,
              ...(activeTool === 'annotate' || showAnnotationPanel ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}),
            }}
            onClick={onToggleAnnotationPanel}
          >
            <PenTool size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
