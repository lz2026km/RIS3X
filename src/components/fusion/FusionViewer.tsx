import React, { useState, useCallback } from 'react'

export type FusionMode = 'side-by-side' | 'overlay' | 'checkerboard' | 'split-window'

export interface FusionLayer {
  id: string
  imageIds: string[]
  modality: string
  color?: string
  opacity: number
  visible: boolean
}

export interface FusionViewerProps {
  layers: FusionLayer[]
  activeMode?: FusionMode
  height?: number
  onModeChange?: (mode: FusionMode) => void
  onLayerChange?: (layers: FusionLayer[]) => void
}

export const FusionViewer: React.FC<FusionViewerProps> = ({
  layers,
  activeMode = 'side-by-side',
  height = 500,
  onModeChange,
  onLayerChange,
}) => {
  const [mode, setMode] = useState<FusionMode>(activeMode)
  const [checkerSize, setCheckerSize] = useState(16)
  const [blendFactor, setBlendFactor] = useState(0.5)

  const handleModeChange = useCallback((m: FusionMode) => {
    setMode(m)
    onModeChange?.(m)
  }, [onModeChange])

  const toggleLayer = useCallback((id: string) => {
    const updated = layers.map(l => l.id === id ? { ...l, visible: !l.visible } : l)
    onLayerChange?.(updated)
  }, [layers, onLayerChange])

  const setOpacity = useCallback((id: string, opacity: number) => {
    const updated = layers.map(l => l.id === id ? { ...l, opacity } : l)
    onLayerChange?.(updated)
  }, [layers, onLayerChange])

  const visibleLayers = layers.filter(l => l.visible)

  return (
    <div style={{ background: '#0a0a0a', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', background: '#1a1a1a', borderBottom: '1px solid #333', fontSize: 12, color: '#cbd5e1' }}>
        <span style={{ fontWeight: 600 }}>多模态融合</span>
        <div style={{ width: 1, height: 16, background: '#333' }} />
        {(['side-by-side', 'overlay', 'checkerboard', 'split-window'] as FusionMode[]).map(m => (
          <button
            key={m}
            onClick={() => handleModeChange(m)}
            style={{
              background: mode === m ? '#1e40af' : 'transparent',
              border: '1px solid', borderColor: mode === m ? '#3b82f6' : '#333',
              borderRadius: 4, padding: '2px 8px', color: '#cbd5e1', fontSize: 12, cursor: 'pointer',
            }}
          >
            {m === 'side-by-side' ? 'Side-by-Side' : m === 'overlay' ? 'Overlay' : m === 'checkerboard' ? 'Checkerboard' : 'Split'}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', height, flexDirection: mode === 'side-by-side' ? 'row' : 'column' }}>
        <div style={{ flex: 1, position: 'relative', background: '#000', margin: 4, borderRadius: 4, overflow: 'hidden' }}>
          {mode === 'side-by-side' && visibleLayers.map((layer, i) => (
            <div
              key={layer.id}
              style={{
                position: 'absolute', inset: 0,
                width: `${100 / Math.max(1, visibleLayers.length)}%`,
                left: `${(i / Math.max(1, visibleLayers.length)) * 100}%`,
                background: '#000', borderRight: i < visibleLayers.length - 1 ? '1px solid #333' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <div style={{ textAlign: 'center', color: layer.color ?? '#3b82f6' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>{layer.modality}</div>
                <div style={{ fontSize: 12, color: '#64748b' }}>{layer.imageIds.length} slices</div>
              </div>
            </div>
          ))}
          {mode === 'overlay' && (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                {visibleLayers.map(l => (
                  <div key={l.id} style={{ color: l.color ?? '#3b82f6', fontSize: 12, margin: 4 }}>
                    {l.modality} (opacity: {(l.opacity * 100).toFixed(0)}%)
                  </div>
                ))}
              </div>
            </div>
          )}
          {mode === 'checkerboard' && (
            <div style={{ width: '100%', height: '100%', display: 'grid', gridTemplateColumns: `repeat(${Math.ceil(512 / checkerSize)}, ${checkerSize}px)`, gridTemplateRows: `repeat(${Math.ceil(512 / checkerSize)}, ${checkerSize}px)` }}>
              {Array.from({ length: Math.ceil(512 / checkerSize) * Math.ceil(512 / checkerSize) }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    background: i % 2 === 0 ? '#1a3a5f' : '#3a1a5f',
                    border: '1px solid rgba(255,255,255,0.05)',
                  }}
                />
              ))}
            </div>
          )}
          {mode === 'split-window' && (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
              {visibleLayers.slice(0, 2).map((l, i) => (
                <div
                  key={l.id}
                  style={{
                    position: 'absolute', inset: 0,
                    clipPath: i === 0 ? undefined : `polygon(${blendFactor * 100}% 0, 100% 0, 100% 100%, ${blendFactor * 100}% 100%)`,
                    borderRight: i === 0 ? '2px solid #fbbf24' : 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: l.color ?? '#3b82f6', fontSize: 14,
                  }}
                >
                  {l.modality}
                </div>
              ))}
              <input
                type="range" min="0" max="1" step="0.01" value={blendFactor}
                onChange={e => setBlendFactor(parseFloat(e.target.value))}
                style={{ position: 'absolute', bottom: 8, left: '10%', width: '80%' }}
              />
            </div>
          )}
        </div>

        {mode !== 'side-by-side' && (
          <div style={{ width: '100%', padding: '4px 8px', background: '#1a1a1a', borderTop: '1px solid #333', display: 'flex', gap: 16, alignItems: 'center', fontSize: 12, color: '#cbd5e1' }}>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {layers.map(l => (
                <label key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                  <input type="checkbox" checked={l.visible} onChange={() => toggleLayer(l.id)} />
                  <span style={{ color: l.color }}>{l.modality}</span>
                  {l.visible && (
                    <input
                      type="range" min="0" max="1" step="0.1" value={l.opacity}
                      onChange={e => setOpacity(l.id, parseFloat(e.target.value))}
                      style={{ width: 60 }}
                    />
                  )}
                </label>
              ))}
            </div>
            {mode === 'checkerboard' && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                Size:
                <input type="range" min="4" max="64" value={checkerSize} onChange={e => setCheckerSize(parseInt(e.target.value))} style={{ width: 60 }} />
              </label>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FusionViewer
