import { Tooltip } from './DicomViewerSubComponents'
import { RotateCw, RotateCcw, PenTool, Plus, Minus, EyeOff, Eye, Flame, Droplets, Activity, Wind } from 'lucide-react'
import type { Tool, PseudoColorMode } from './DicomViewerTypes'
import { t } from '../../i18n/appI18n'

const PRIMARY = '#1e40af'

const s = {
  leftToolbar: { width: 60, background: `linear-gradient(180deg, ${PRIMARY} 0%, #2563eb 100%)`, display: 'flex', flexDirection: 'column' as const, alignItems: 'center', paddingTop: 12, paddingBottom: 12, gap: 4, borderRight: `1px solid ${PRIMARY}`, flexShrink: 0, boxShadow: '2px 0 8px rgba(30,58,95,0.3)' },
  toolBtn: { width: 44, height: 44, borderRadius: 10, border: 'none', background: 'transparent', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s', marginBottom: 2, fontSize: 11 } as React.CSSProperties,
  toolBtnActive: { background: 'rgba(255,255,255,0.2)', color: '#fff', boxShadow: '0 0 12px rgba(255,255,255,0.15)' },
  toolDivider: { width: 36, height: 1, background: 'rgba(255,255,255,0.15)', margin: '4px auto' },
}

interface Props {
  tools: { tool: Tool; icon: React.ReactNode; label: string; divider?: boolean }[]
  activeTool: Tool
  handleToolClick: (tool: Tool) => void
  zoom: number
  setZoom: (z: number | ((prev: number) => number)) => void
  rotation: number
  setRotation: (r: number | ((prev: number) => number)) => void
  pseudoColorMode: PseudoColorMode
  showPseudoColorPanel: boolean
  setShowPseudoColorPanel: (v: boolean) => void
  invert: boolean
  setInvert: (v: boolean) => void
  showAnnotationPanel: boolean
  setShowAnnotationPanel: (v: boolean) => void
}

export default function ToolbarSection(props: Props) {
  const { tools, activeTool, handleToolClick, zoom, setZoom, rotation, setRotation, pseudoColorMode, showPseudoColorPanel, setShowPseudoColorPanel, invert, setInvert, showAnnotationPanel, setShowAnnotationPanel } = props

  return (
    <div style={s.leftToolbar}>
      {tools.map(({ tool, icon, label, divider }) => (
        <div key={tool}>
          {divider && <div style={s.toolDivider} />}
          <Tooltip title={label}>
            <button style={{ ...s.toolBtn, ...(activeTool === tool ? s.toolBtnActive : {}) }} onClick={() => handleToolClick(tool)}>
              {icon}
            </button>
          </Tooltip>
        </div>
      ))}
      {activeTool === 'zoom' && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }} onClick={() => setZoom(z => Math.min(500, z + 20))}><Plus size={14} color="#fff" /></button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{zoom}%</span>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }} onClick={() => setZoom(z => Math.max(10, z - 20))}><Minus size={14} color="#fff" /></button>
        </div>
      )}
      {activeTool === 'rotate' && (
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }} onClick={() => setRotation(r => (r + 90) % 360)}><RotateCw size={14} color="#fff" /></button>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>{rotation}°</span>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0 }} onClick={() => setRotation(r => (r - 90 + 360) % 360)}><RotateCcw size={14} color="#fff" /></button>
        </div>
      )}
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Tooltip title={t('w9d.toolbar.pseudoColor')}>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0, ...(pseudoColorMode !== 'none' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}) }} onClick={() => setShowPseudoColorPanel(!showPseudoColorPanel)}>
            {pseudoColorMode === 'none' ? <EyeOff size={14} /> : pseudoColorMode === 'hotIron' ? <Flame size={14} /> : pseudoColorMode === 'coolBlue' ? <Droplets size={14} /> : pseudoColorMode === 'pet' ? <Activity size={14} /> : <Wind size={14} />}
          </button>
        </Tooltip>
        {pseudoColorMode !== 'none' && (
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: pseudoColorMode === 'hotIron' ? '#ff4400' : pseudoColorMode === 'coolBlue' ? '#0088ff' : pseudoColorMode === 'pet' ? '#ff00ff' : '#00cc88' }} />
        )}
      </div>
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Tooltip title={invert ? t('w9d.toolbar.cancelInvert') : t('w9d.toolbar.invertDisplay')}>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0, ...(invert ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}) }} onClick={() => setInvert(!invert)}>
            {invert ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </Tooltip>
        {invert && <span style={{ fontSize: 10, color: '#fbbf24' }}>{t('w9d.toolbar.inverted')}</span>}
      </div>
      <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
        <Tooltip title={t('w9d.annotation.panelTitle')}>
          <button style={{ ...s.toolBtn, width: 36, height: 28, padding: 0, ...(activeTool === 'annotate' ? { background: 'rgba(255,255,255,0.25)', color: '#fff' } : {}) }} onClick={() => { handleToolClick('annotate'); setShowAnnotationPanel(!showAnnotationPanel) }}>
            <PenTool size={14} />
          </button>
        </Tooltip>
      </div>
    </div>
  )
}
