import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Slider, Tag, Spin } from 'antd'
import { Layers, RotateCcw } from 'lucide-react'
import { volumeApi } from '../../services/api/volumeApi'
import {
  setupRealVolume,
  decodeInt16Base64,
  applyWWL,
  drawImageDataCentered,
} from './volumeReal'

type ViewPlane = 'axial' | 'coronal' | 'sagittal'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'

function generateMprSlice(plane: ViewPlane, slice: number, size: number): number[][] {
  const data: number[][] = []
  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2
      const cy = y - size / 2
      const d = Math.sqrt(cx * cx + cy * cy)
      const a = Math.atan2(cy, cx)
      const zOff = (slice - 64) / 64
      let v = 200 + 150 * Math.sin(d * 0.03 + zOff * 0.5)
      v += 50 * Math.cos(a * 2 + zOff * 0.3)
      v += 30 * Math.sin(cx * 0.02 + cy * 0.02 + zOff * 0.4)
      if (plane === 'coronal') v += 40 * Math.cos(y * 0.03)
      if (plane === 'sagittal') v += 40 * Math.cos(x * 0.03)
      row.push(Math.max(0, Math.min(4095, Math.round(v))))
    }
    data.push(row)
  }
  return data
}

function applyWWLSynthetic(data: number[][], ww: number, wl: number): ImageData {
  const size = data.length
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2
  const min = wl - half
  const range = ww || 1
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const val = data[y]?.[x]
      if (val === undefined) continue
      let v = ((val - min) / range) * 255
      v = Math.max(0, Math.min(255, Math.round(v)))
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = 255
    }
  }
  return imgData
}

interface ViewportProps {
  plane: ViewPlane
  sliceIndex: number
  ww: number
  wl: number
  mode: 'real' | 'synthetic'
  jobId: string | null
  onTotalSlices?: (plane: ViewPlane, total: number) => void
}

const Viewport: React.FC<ViewportProps> = ({ plane, sliceIndex, ww, wl, mode, jobId, onTotalSlices }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tick, setTick] = useState(0)
  const cacheRef = useRef<Map<string, { data: Int16Array; w: number; h: number }>>(new Map())

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * devicePixelRatio
    canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)

    if (mode === 'real' && jobId) {
      const key = `${plane}:${sliceIndex}`
      const cached = cacheRef.current.get(key)
      if (cached) {
        const imgData = applyWWL(cached.data, cached.w, cached.h, ww, wl)
        drawImageDataCentered(ctx, imgData, w, h)
      } else {
        ctx.clearRect(0, 0, w, h)
        ctx.font = '13px ui-monospace, monospace'
        ctx.fillStyle = 'rgba(148,163,184,0.9)'
        ctx.fillText('加载切片...', 8, 18)
        volumeApi.mprSlice(jobId, plane, sliceIndex).then((res) => {
          if (!res.success) return
          const p = res.data.pixelData
          cacheRef.current.set(key, { data: decodeInt16Base64(p.dataBase64), w: p.width, h: p.height })
          onTotalSlices?.(plane, res.data.totalSlices)
          setTick((t) => t + 1)
        })
      }
      return
    }

    // synthetic fallback
    const data = generateMprSlice(plane, sliceIndex, 256)
    const imgData = applyWWLSynthetic(data, ww, wl)
    drawImageDataCentered(ctx, imgData, w, h)
  }, [sliceIndex, ww, wl, mode, jobId, tick, plane, onTotalSlices])

  return <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
}

const MprPage: React.FC = () => {
  const [mode, setMode] = useState<'loading' | 'real' | 'synthetic'>('loading')
  const [jobId, setJobId] = useState<string | null>(null)
  const [dims, setDims] = useState<{ x: number; y: number; z: number } | null>(null)
  const [seriesInfo, setSeriesInfo] = useState<string>('')
  const [sliceIndex, setSliceIndex] = useState(0)
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)
  const [showCrosshair, setShowCrosshair] = useState(true)

  useEffect(() => {
    let cancelled = false
    setupRealVolume({ modality: 'CT' }).then((setup) => {
      if (cancelled) return
      setMode(setup.mode)
      setJobId(setup.jobId)
      setDims(setup.dims)
      if (setup.series) {
        setSeriesInfo(`${setup.series.modality} #${setup.series.instanceCount} 层 ${setup.series.rows}x${setup.series.columns}`)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handleTotalSlices = useCallback((plane: ViewPlane, total: number) => {
    setDims((prev) => {
      if (!prev) return prev
      if (plane === 'axial') return { ...prev, z: total }
      if (plane === 'sagittal') return { ...prev, x: total }
      return { ...prev, y: total }
    })
  }, [])

  const maxSlice = Math.max(1, (dims?.z ?? 128) - 1)

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  }
  const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>MPR 多平面重建</span>
        <Tag color="cyan">Multi-Planar Reconstruction</Tag>
        {mode === 'real' && <Tag color="green">REAL DICOM</Tag>}
        {mode === 'synthetic' && <Tag>SYNTHETIC</Tag>}
        {seriesInfo && <span style={{ fontSize: 11, color: '#64748b' }}>{seriesInfo}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>切片:</span>
        <Slider min={0} max={maxSlice} value={sliceIndex} onChange={setSliceIndex} style={{ width: 200 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{sliceIndex}/{maxSlice}</span>
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>WW:</span>
        <Slider min={1} max={4000} value={ww} onChange={setWw} style={{ width: 120 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{ww}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>WL:</span>
        <Slider min={-1000} max={3000} value={wl} onChange={setWl} style={{ width: 120 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{wl}</span>
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <button style={showCrosshair ? activeBtnStyle : btnStyle} onClick={() => setShowCrosshair(v => !v)}>十字线</button>
        <button style={btnStyle} onClick={() => { setSliceIndex(0); setWw(400); setWl(40) }}><RotateCcw size={12} /> 重置</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, height: 'calc(100vh - 140px)' }}>
        <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mode === 'loading' ? <Spin size="large" /> : (
            <Viewport plane="axial" sliceIndex={sliceIndex} ww={ww} wl={wl} mode={mode} jobId={jobId} onTotalSlices={handleTotalSlices} />
          )}
        </div>
        <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mode === 'loading' ? <Spin size="large" /> : (
            <Viewport plane="coronal" sliceIndex={sliceIndex} ww={ww} wl={wl} mode={mode} jobId={jobId} onTotalSlices={handleTotalSlices} />
          )}
        </div>
        <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {mode === 'loading' ? <Spin size="large" /> : (
            <Viewport plane="sagittal" sliceIndex={sliceIndex} ww={ww} wl={wl} mode={mode} jobId={jobId} onTotalSlices={handleTotalSlices} />
          )}
        </div>
      </div>
    </div>
  )
}

export default MprPage
