import { useState, useCallback, useRef } from 'react'
import { Plus, Minus, RotateCw, Maximize2, Grid3x3, Sun, Layers, Heart, Activity } from 'lucide-react'

export interface ImageInstance {
  id: string
  seriesId: string
  instanceNumber: number
  url: string
  width: number
  height: number
}

export type ViewportLayout = '1x1' | '1x2' | '2x2'

export type PresetType = 'soft-tissue' | 'lung' | 'bone' | 'abdomen'

const PRESET_CONFIG: Record<PresetType, { windowCenter: number; windowWidth: number; label: string }> = {
  'soft-tissue': { windowCenter: 40, windowWidth: 400, label: '软组织' },
  lung: { windowCenter: -600, windowWidth: 1500, label: '肺窗' },
  bone: { windowCenter: 300, windowWidth: 2000, label: '骨窗' },
  abdomen: { windowCenter: 50, windowWidth: 350, label: '腹部' },
}

const MOCK_IMAGES: ImageInstance[] = Array.from({ length: 30 }, (_, i) => ({
  id: `img-${i + 1}`,
  seriesId: 'series-1',
  instanceNumber: i + 1,
  url: `/mock/dicom/slice-${i + 1}.dcm`,
  width: 512,
  height: 512,
}))

interface ViewportProps {
  image?: ImageInstance
  preset: PresetType
  onPresetChange: (preset: PresetType) => void
}

function Viewport({ image, preset, onPresetChange }: ViewportProps) {
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [ww, setWw] = useState(PRESET_CONFIG[preset].windowWidth)
  const [wl, setWl] = useState(PRESET_CONFIG[preset].windowCenter)
  const touchStart = useRef<{ x: number; y: number; dist?: number } | null>(null)

  const handlePresetSelect = useCallback((p: PresetType) => {
    onPresetChange(p)
    setWw(PRESET_CONFIG[p].windowWidth)
    setWl(PRESET_CONFIG[p].windowCenter)
  }, [onPresetChange])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dist: Math.sqrt(dx * dx + dy * dy) }
    } else {
      const touch = e.touches[0]
      touchStart.current = touch ? { x: touch.clientX, y: touch.clientY } : null
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return
    if (e.touches.length === 2 && touchStart.current.dist) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scale = dist / touchStart.current.dist
      setZoom(prev => Math.max(0.5, Math.min(5, prev * scale)))
      touchStart.current.dist = dist
    }
  }, [])

  return (
    <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#000', borderRadius: 8, overflow: 'hidden' }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${zoom}) rotate(${rotation}deg)`, transition: 'transform 0.1s' }}>
        {image ? (
          <div style={{ width: '90%', height: '90%', background: 'linear-gradient(135deg, #1a1a2e, #16213e)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14 }}>
            <span>DICOM #{image.instanceNumber}</span>
          </div>
        ) : (
          <div style={{ color: '#666', fontSize: 12 }}>无图像</div>
        )}
      </div>

      <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', gap: 4 }}>
        {Object.entries(PRESET_CONFIG).map(([key, config]) => (
          <button key={key} onClick={() => handlePresetSelect(key as PresetType)}
            style={{ padding: '4px 8px', borderRadius: 4, border: 'none', fontSize: 10, fontWeight: 600, cursor: 'pointer', background: preset === key ? '#3b82f6' : 'rgba(255,255,255,0.2)', color: '#fff' }}>
            {config.label}
          </button>
        ))}
      </div>

      <div style={{ position: 'absolute', bottom: 8, left: 8, color: 'rgba(255,255,255,0.7)', fontSize: 10 }}>
        WL: {wl} WW: {ww} | Zoom: {zoom.toFixed(1)}x
      </div>

      <div style={{ position: 'absolute', right: 8, bottom: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => setZoom(prev => Math.min(5, prev + 0.2))} style={ctrlBtnStyle}><Plus size={14} /></button>
        <button onClick={() => setZoom(prev => Math.max(0.5, prev - 0.2))} style={ctrlBtnStyle}><Minus size={14} /></button>
        <button onClick={() => setRotation(prev => (prev + 90) % 360)} style={ctrlBtnStyle}><RotateCw size={14} /></button>
      </div>
    </div>
  )
}

const ctrlBtnStyle: React.CSSProperties = {
  width: 32, height: 32, borderRadius: 6, border: 'none', background: 'rgba(255,255,255,0.2)', color: '#fff',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export default function MobileImageViewer() {
  const [layout, setLayout] = useState<ViewportLayout>('1x1')
  const [currentImage, setCurrentImage] = useState(0)
  const [preset, setPreset] = useState<PresetType>('soft-tissue')
  const [showSeries, setShowSeries] = useState(false)

  const gridCols = layout === '1x1' ? 1 : layout === '1x2' ? 2 : 2
  const gridRows = layout === '2x2' ? 2 : 1
  const viewportCount = gridCols * gridRows

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', background: '#0a0a0a', minHeight: '100vh', fontFamily: '-apple-system, sans-serif' }}>
      <div style={{ padding: '12px 16px', background: '#1a1a2e', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ color: '#fff', fontSize: 14, fontWeight: 600 }}>影像浏览</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowSeries(!showSeries)} style={ctrlBtnStyle}><Layers size={14} /></button>
          {([['1x1', Grid3x3], ['1x2', Maximize2], ['2x2', Grid3x3]] as const).map(([l, Icon]) => (
            <button key={l} onClick={() => setLayout(l)}
              style={{ ...ctrlBtnStyle, background: layout === l ? '#3b82f6' : 'rgba(255,255,255,0.15)' }}>
              <Icon size={14} />
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${gridCols}, 1fr)`, gap: 2, padding: 2 }}>
        {Array.from({ length: viewportCount }).map((_, idx) => (
          <Viewport key={idx} image={MOCK_IMAGES[currentImage + idx]} preset={preset} onPresetChange={setPreset} />
        ))}
      </div>

      {showSeries && (
        <div style={{ background: '#1a1a2e', padding: 8, maxHeight: 120, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          {MOCK_IMAGES.map((img, idx) => (
            <div key={img.id} onClick={() => setCurrentImage(idx)}
              style={{ display: 'inline-block', width: 64, height: 64, margin: 4, borderRadius: 6, cursor: 'pointer', background: idx === currentImage ? '#3b82f6' : '#2a2a3e', overflow: 'hidden', verticalAlign: 'top', padding: 4 }}>
              <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #16213e, #1a1a2e)', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 8 }}>
                #{img.instanceNumber}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 2, padding: '8px 16px', background: '#1a1a2e', justifyContent: 'center' }}>
        <button style={ctrlBtnStyle}><Heart size={14} /></button>
        <button style={ctrlBtnStyle}><Activity size={14} /></button>
        <button style={ctrlBtnStyle}><Sun size={14} /></button>
      </div>
    </div>
  )
}
