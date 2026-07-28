import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Layers, Minus, Monitor, Move, Plus, RotateCw, Sun, ZoomIn, ZoomOut } from 'lucide-react'
import { t } from '../../i18n/appI18n'
import { FUSION_CT_WW, FUSION_CT_WL, FUSION_PET_WW, FUSION_PET_WL } from '../../utils/modalityPresets'
import { fusionApi, type FusionSeriesItem } from '../../services/api/dicomApi'

type ViewPlane = 'axial' | 'coronal' | 'sagittal'
type FusionMode = 'pet-ct' | 'mr-dwi'
interface WWWL { ww: number; wl: number }
interface ViewState { zoom: number; panX: number; panY: number }

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'

function generateFallbackSlice(plane: ViewPlane, slice: number, modality: 'ct' | 'pet' | 'mr' | 'dwi'): number[][] {
  const size = 256
  const data: number[][] = []
  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2
      const cy = y - size / 2
      const d = Math.sqrt(cx * cx + cy * cy)
      const a = Math.atan2(cy, cx)
      const zOff = (slice - 64) / 64
      let v = 0
      if (modality === 'ct') {
        v = 200 + 180 * Math.sin(d * 0.035 + zOff * 0.5) + 60 * Math.cos(a * 3 + zOff * 0.3)
        v += 40 * Math.sin((cx * 0.02 + cy * 0.025 + zOff * 0.4) * 2)
      } else if (modality === 'pet') {
        const hotR = 40 + 20 * Math.sin(zOff * 2.5)
        const hotD = Math.sqrt(cx * cx + cy * cy)
        v = 80 + 200 * Math.exp(-(hotD * hotD) / (2 * hotR * hotR))
        v += 60 * Math.sin(d * 0.06 + a * 4 + zOff * 0.8) * Math.exp(-d * 0.008)
      } else if (modality === 'mr') {
        v = 180 + 170 * Math.sin(d * 0.04 + zOff * 1.2) * (0.5 + 0.5 * Math.cos(a * 2))
        v += 50 * Math.sin(cx * 0.03 + cy * 0.03 + zOff * 0.5)
      } else {
        v = 120 + 200 * (1 - Math.exp(-(Math.abs(cx * 0.04) + Math.abs(cy * 0.04))))
        v *= (0.6 + 0.4 * Math.sin(zOff * 3))
      }
      row.push(Math.max(0, Math.min(4095, Math.round(v))))
    }
    data.push(row)
  }
  return data
}

function decodeBase64PixelData(b64: string, width: number, height: number): ImageData | null {
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(bin.length)
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const img = new ImageData(new Uint8ClampedArray(bytes.buffer), width, height)
    return img
  } catch {
    return null
  }
}

function applyWWL(data: number[][], ww: number, wl: number): ImageData {
  const size = data.length
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2
  const min = wl - half
  const max = wl + half
  const range = max - min || 1
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = ((data[y][x] - min) / range) * 255
      v = Math.max(0, Math.min(255, Math.round(v)))
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = 255
    }
  }
  return imgData
}

function applyPETColor(petData: number[][], ctData: number[][], alpha: number, ww: number, wl: number): ImageData {
  const size = petData.length
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2
  const min = wl - half
  const max = wl + half
  const range = max - min || 1
  const petMax = petData.reduce((mx, row) => Math.max(mx, ...row), 0) || 1
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const ctVal = ((ctData[y][x] - min) / range) * 255
      const ctClamped = Math.max(0, Math.min(255, Math.round(ctVal)))
      const petNorm = petData[y][x] / petMax
      const r = Math.round(255 * petNorm)
      const g = Math.round(255 * Math.max(0, petNorm * 1.5 - 0.5))
      const b = Math.round(255 * Math.max(0, petNorm * 0.5 + 0.2))
      imgData.data[i++] = Math.round(ctClamped * (1 - alpha) + r * alpha)
      imgData.data[i++] = Math.round(ctClamped * (1 - alpha) + g * alpha)
      imgData.data[i++] = Math.round(ctClamped * (1 - alpha) + b * alpha)
      imgData.data[i++] = 255
    }
  }
  return imgData
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  imgData: ImageData,
  viewState: ViewState,
  width: number,
  height: number,
) {
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(width / 2 + viewState.panX, height / 2 + viewState.panY)
  ctx.scale(viewState.zoom, viewState.zoom)
  ctx.translate(-imgData.width / 2, -imgData.height / 2)
  ctx.putImageData(imgData, 0, 0)
  ctx.restore()
}

function drawCrosshair(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color: string,
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(width / 2, 0)
  ctx.lineTo(width / 2, height)
  ctx.moveTo(0, height / 2)
  ctx.lineTo(width, height / 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawOverlayLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
) {
  ctx.save()
  ctx.font = '13px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(x - 2, y - 12, ctx.measureText(text).width + 4, 16)
  ctx.fillStyle = '#facc15'
  ctx.fillText(text, x, y)
  ctx.restore()
}

interface ViewportCanvasProps {
  plane: ViewPlane
  primaryModality: 'ct' | 'mr'
  fusionModality: 'pet' | 'dwi'
  fusionAlpha: number
  sliceIndex: number
  wwl: WWWL
  fusionWWL: WWWL
  viewState: ViewState
  showCrosshair: boolean
  onWheel: (e: React.WheelEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  label: string
  fusionLabel: string
  apiFrame?: ImageData | null
}

const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  plane,
  primaryModality,
  fusionModality,
  fusionAlpha,
  sliceIndex,
  wwl,
  fusionWWL,
  viewState,
  showCrosshair,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  label,
  fusionLabel,
  apiFrame,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = 256

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    let imgData: ImageData
    if (apiFrame) {
      imgData = apiFrame
    } else {
      const primaryData = generateFallbackSlice(plane, sliceIndex, primaryModality)
      const fusionData = generateFallbackSlice(plane, sliceIndex, fusionModality)

      if (fusionAlpha > 0) {
        imgData = applyPETColor(fusionData, primaryData, fusionAlpha, fusionWWL.ww, fusionWWL.wl)
      } else {
        imgData = applyWWL(primaryData, wwl.ww, wwl.wl)
      }
    }

    drawCanvas(ctx, imgData, viewState, w, h)
    if (showCrosshair) {
      drawCrosshair(ctx, w, h, '#facc15')
    }
    drawOverlayLabel(ctx, `${label} | S:${sliceIndex}`, 6, 14)
    if (fusionAlpha > 0) {
      drawOverlayLabel(ctx, `${fusionLabel} ${Math.round(fusionAlpha * 100)}%`, 6, 32)
    }
  })

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: 'crosshair', imageRendering: 'pixelated' }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  )
}

export default function FusionPage() {
  const [fusionMode, setFusionMode] = useState<FusionMode>('pet-ct')
  const [fusionAlpha, setFusionAlpha] = useState(0.5)
  const [plane, setPlane] = useState<ViewPlane>('axial')
  const [sliceIndex, setSliceIndex] = useState(64)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [wwl, setWWL] = useState<WWWL>({ ww: FUSION_CT_WW, wl: FUSION_CT_WL })
  const [fusionWWL, setFusionWWL] = useState<WWWL>({ ww: FUSION_PET_WW, wl: FUSION_PET_WL })
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const [backendSeries, setBackendSeries] = useState<FusionSeriesItem[]>([])
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [apiFrameCache, setApiFrameCache] = useState<Map<string, ImageData>>(new Map())

  const primaryModality = fusionMode === 'pet-ct' ? 'ct' : 'mr'
  const fusionModality = fusionMode === 'pet-ct' ? 'pet' : 'dwi'
  const primaryLabel = fusionMode === 'pet-ct' ? 'CT' : 'MR'
  const fusionLabel = fusionMode === 'pet-ct' ? 'PET' : 'DWI'

  useEffect(() => {
    const patientId = new URLSearchParams(window.location.search).get('patientId')
    if (!patientId) return
    fusionApi.getSeries(patientId).then(res => {
      if (res.success && res.data.series) {
        setBackendSeries(res.data.series)
      }
    })
  }, [])

  useEffect(() => {
    if (backendSeries.length < 2) return
    const ctSeries = backendSeries.find(s => s.modality === 'CT' || s.modality === 'MR')
    const petSeries = backendSeries.find(s => s.modality === 'PT' || s.modality === 'DWI')
    if (ctSeries && petSeries && !registrationId) {
      fusionApi.register(
        `series-${ctSeries.seriesDescription}`,
        `series-${petSeries.seriesDescription}`,
        'rigid',
      ).then(res => {
        if (res.success) {
          setRegistrationId(res.data.registrationId)
        }
      })
    }
  }, [backendSeries, registrationId])

  const fetchBackendFrame = useCallback(async (
    currentPlane: ViewPlane,
    currentSlice: number,
    currentAlpha: number,
    currentWWL: WWWL,
    currentFusionWWL: WWWL,
  ): Promise<ImageData | null> => {
    if (backendSeries.length < 2) return null
    const ctSeries = backendSeries.find(s => s.modality === 'CT' || s.modality === 'MR')
    const petSeries = backendSeries.find(s => s.modality === 'PT' || s.modality === 'DWI')
    if (!ctSeries || !petSeries) return null

    const cacheKey = `${currentPlane}-${currentSlice}-${currentAlpha}-${currentWWL.ww}-${currentWWL.wl}`
    const cached = apiFrameCache.get(cacheKey)
    if (cached) return cached

    const res = await fusionApi.render({
      fixedSeriesUid: `series-${ctSeries.seriesDescription}`,
      movingSeriesUid: `series-${petSeries.seriesDescription}`,
      plane: currentPlane,
      sliceIndex: currentSlice,
      alpha: currentAlpha,
      windowWidth: currentWWL.ww,
      windowLevel: currentWWL.wl,
      fusionWindowWidth: currentFusionWWL.ww,
      fusionWindowLevel: currentFusionWWL.wl,
    })
    if (res.success && res.data.pixelDataBase64) {
      const imgData = decodeBase64PixelData(res.data.pixelDataBase64, res.data.width, res.data.height)
      if (imgData) {
        setApiFrameCache(prev => {
          const next = new Map(prev)
          if (next.size > 60) {
            const firstKey = next.keys().next().value
            if (firstKey) next.delete(firstKey)
          }
          next.set(cacheKey, imgData)
          return next
        })
        return imgData
      }
    }
    return null
  }, [backendSeries, apiFrameCache])

  const [currentApiFrame, setCurrentApiFrame] = useState<ImageData | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchBackendFrame(plane, sliceIndex, fusionAlpha, wwl, fusionWWL).then(frame => {
      if (!cancelled) setCurrentApiFrame(frame)
    })
    return () => { cancelled = true }
  }, [plane, sliceIndex, fusionAlpha, wwl, fusionWWL, fetchBackendFrame])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -1 : 1
    setSliceIndex(prev => Math.max(0, Math.min(127, prev + delta)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      setDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    } else {
      setDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (e.shiftKey) {
      setViewState(prev => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }))
    } else {
      setWWL(prev => ({ ww: Math.max(100, prev.ww + dx), wl: Math.max(-1000, prev.wl + dy) }))
    }
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setDragging(false)
  }, [])

  const handleZoomIn = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) }))
  }, [])

  const handleZoomOut = useCallback(() => {
    setViewState(prev => ({ ...prev, zoom: Math.max(0.2, prev.zoom / 1.2) }))
  }, [])

  const handleReset = useCallback(() => {
    setViewState({ zoom: 1, panX: 0, panY: 0 })
    setWWL({ ww: FUSION_CT_WW, wl: FUSION_CT_WL })
    setFusionWWL({ ww: FUSION_PET_WW, wl: FUSION_PET_WL })
  }, [])

  const btnStyle: React.CSSProperties = {
    background: 'transparent',
    border: '1px solid #334155',
    color: '#94a3b8',
    borderRadius: 4,
    padding: '4px 8px',
    fontSize: 11,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
  }

  const activeBtnStyle: React.CSSProperties = {
    ...btnStyle,
    background: BLUE,
    borderColor: BLUE,
    color: '#fff',
  }

  return (
    <div data-testid="fusion-page" style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('nav.dicomFusion')}</span>

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 4 }}>
          {(['pet-ct', 'mr-dwi'] as const).map(m => (
            <button key={m} style={fusionMode === m ? activeBtnStyle : btnStyle} onClick={() => setFusionMode(m)}>
              {m === 'pet-ct' ? 'PET/CT' : 'MR/DWI'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#334155' }} />

        <div style={{ display: 'flex', gap: 4 }}>
          {(['axial', 'coronal', 'sagittal'] as const).map(p => (
            <button key={p} style={plane === p ? activeBtnStyle : btnStyle} onClick={() => setPlane(p)}>
              <Monitor size={12} /> {p === 'axial' ? t('fusion.axial') : p === 'coronal' ? t('fusion.coronal') : t('fusion.sagittal')}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#334155' }} />

        <button style={showCrosshair ? activeBtnStyle : btnStyle} onClick={() => setShowCrosshair(v => !v)}>
          <Move size={12} /> {t('fusion.crosshair')}
        </button>

        <button style={btnStyle} onClick={handleZoomIn} aria-label="放大"><ZoomIn size={12} /></button>
        <button style={btnStyle} onClick={handleZoomOut} aria-label="缩小"><ZoomOut size={12} /></button>
        <button style={btnStyle} onClick={handleReset} aria-label="重置视图"><RotateCw size={12} /></button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', background: PANEL_BG, borderRadius: 6, padding: '6px 12px' }}>
        <Layers size={14} color={BLUE} />
        <label htmlFor="fusion-alpha" style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' }}>{t('fusion.opacity')}</label>
        <input
          id="fusion-alpha"
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={fusionAlpha}
          onChange={e => setFusionAlpha(parseFloat(e.target.value))}
          aria-label="融合透明度"
          style={{ flex: 1, accentColor: BLUE, height: 4 }}
        />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#facc15', minWidth: 44, textAlign: 'right' }}>
          {Math.round(fusionAlpha * 100)}%
        </span>
        <span style={{ fontSize: 11, color: '#64748b' }}>
          {primaryLabel} 0% <Layers size={10} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fusionLabel} 100%
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, height: 'calc(100vh - 160px)', minHeight: 400 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ flex: 1, background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', position: 'relative' }}>
            <ViewportCanvas
              plane={plane}
              primaryModality={primaryModality}
              fusionModality={fusionModality}
              fusionAlpha={fusionAlpha}
              sliceIndex={sliceIndex}
              wwl={wwl}
              fusionWWL={fusionWWL}
              viewState={viewState}
              showCrosshair={showCrosshair}
              onWheel={handleWheel}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              label={primaryLabel}
              fusionLabel={fusionLabel}
              apiFrame={currentApiFrame}
            />
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: PANEL_BG, borderRadius: 4, padding: '4px 8px' }}>
            <Sun size={10} color={BLUE} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{primaryLabel}</span>
            <Minus size={8} />
            <input
              type="range" min={100} max={4000} value={wwl.ww}
              onChange={e => setWWL(p => ({ ...p, ww: parseInt(e.target.value) }))}
              aria-label={`${primaryLabel}-窗宽`}
              style={{ flex: 1, height: 3, accentColor: BLUE }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 60, textAlign: 'right' }}>WW:{wwl.ww} WL:{wwl.wl}</span>
            <Plus size={8} />
          </div>
          {fusionAlpha > 0 && (
            <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: PANEL_BG, borderRadius: 4, padding: '4px 8px' }}>
              <Sun size={10} color="#facc15" />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{fusionLabel}</span>
              <Minus size={8} />
              <input
                type="range" min={100} max={4000} value={fusionWWL.ww}
                onChange={e => setFusionWWL(p => ({ ...p, ww: parseInt(e.target.value) }))}
                aria-label={`${fusionLabel}-融合窗宽`}
                style={{ flex: 1, height: 3, accentColor: '#facc15' }}
              />
              <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 60, textAlign: 'right' }}>WW:{fusionWWL.ww} WL:{fusionWWL.wl}</span>
              <Plus size={8} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 4, alignItems: 'center', background: PANEL_BG, borderRadius: 4, padding: '4px 8px' }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>{t('fusion.slice')}</span>
            <Minus size={8} />
            <input
              type="range" min={0} max={127} value={sliceIndex}
              onChange={e => setSliceIndex(parseInt(e.target.value))}
              aria-label="切片索引"
              style={{ flex: 1, height: 3, accentColor: BLUE }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 30, textAlign: 'right' }}>{sliceIndex}</span>
            <Plus size={8} />
          </div>
        </div>
      </div>

      <div style={{ marginTop: 6, fontSize: 10, color: '#475569', textAlign: 'center' }}>
        {t('fusion.hint')}
      </div>
    </div>
  )
}
