import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Slider, Tag, Spin } from 'antd'
import { Box, RotateCcw } from 'lucide-react'
import { volumeApi } from '../../services/api/volumeApi'
import { setupRealVolume, decodeRgbaBase64, drawImageDataCentered } from './volumeReal'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'

type PresetType = 'default' | 'bone' | 'softTissue' | 'vessel' | 'lung'

const PRESETS: Record<PresetType, { ww: number; wl: number; opacity: number; label: string }> = {
  default: { ww: 400, wl: 40, opacity: 0.8, label: '默认' },
  bone: { ww: 2500, wl: 480, opacity: 0.9, label: '骨窗' },
  softTissue: { ww: 400, wl: 40, opacity: 0.7, label: '软组织' },
  vessel: { ww: 600, wl: 300, opacity: 0.85, label: '血管' },
  lung: { ww: 1500, wl: -600, opacity: 0.6, label: '肺窗' },
}

function generateVolumeSlice(z: number, size: number, preset: PresetType): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const { ww, wl } = PRESETS[preset]
  const half = ww / 2, min = wl - half, max = wl + half, range = max - min || 1
  let i = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x - size / 2, cy = y - size / 2
    const d = Math.sqrt(cx * cx + cy * cy)
    const a = Math.atan2(cy, cx)
    const zOff = (z - 64) / 64
    let v = 200 + 160 * Math.sin(d * 0.03 + zOff * 0.5) + 50 * Math.cos(a * 3 + zOff * 0.3)
    v += 30 * Math.sin(cx * 0.02 + cy * 0.02 + zOff * 0.4)
    v = Math.max(0, Math.min(4095, Math.round(v)))
    let gray = ((v - min) / range) * 255
    gray = Math.max(0, Math.min(255, gray))
    const r = Math.round(gray * (preset === 'vessel' ? 1.2 : 1))
    const g = Math.round(gray * (preset === 'lung' ? 0.8 : 0.95))
    const b = Math.round(gray * (preset === 'bone' ? 1.1 : 0.9))
    imgData.data[i++] = Math.min(255, r)
    imgData.data[i++] = Math.min(255, g)
    imgData.data[i++] = Math.min(255, b)
    imgData.data[i++] = 255
  }
  return imgData
}

const VrPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [mode, setMode] = useState<'loading' | 'real' | 'synthetic'>('loading')
  const [jobId, setJobId] = useState<string | null>(null)
  const [seriesInfo, setSeriesInfo] = useState('')
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 })
  const [opacity, setOpacity] = useState(0.8)
  const [preset, setPreset] = useState<PresetType>('default')
  const [sliceZ, setSliceZ] = useState(64)
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [realError, setRealError] = useState(false)
  const renderTickRef = useRef(0)
  const pendingRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setupRealVolume({ modality: 'CT' }).then((setup) => {
      if (cancelled) return
      setMode(setup.mode)
      setJobId(setup.jobId)
      if (setup.series) {
        setSeriesInfo(`${setup.series.modality} #${setup.series.instanceCount} 层 ${setup.series.rows}x${setup.series.columns}`)
      }
    })
    return () => { cancelled = true }
  }, [])

  // 真实模式: 后端 VR 光线投射 (防抖)
  useEffect(() => {
    if (mode !== 'real' || !jobId) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.clearRect(0, 0, w, h)
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(148,163,184,0.9)'
    ctx.fillText('渲染 VR...', 8, 18)

    const myId = ++renderTickRef.current
    if (pendingRef.current !== null) window.clearTimeout(pendingRef.current)
    pendingRef.current = window.setTimeout(() => {
      volumeApi.vrImage(jobId, { preset, opacity, rotation }).then((res) => {
        if (myId !== renderTickRef.current) return
        if (!res.success) { setRealError(true); return }
        setRealError(false)
        const p = res.data.pixelData
        const rgba = decodeRgbaBase64(p.dataBase64)
        const imgData = new ImageData(new Uint8ClampedArray(rgba), res.data.width, res.data.height)
        drawImageDataCentered(ctx, imgData, w, h)
      })
    }, 120)
    return () => {
      if (pendingRef.current !== null) window.clearTimeout(pendingRef.current)
    }
  }, [mode, jobId, preset, opacity, rotation])

  // 合成回退: 客户端逐层合成
  useEffect(() => {
    if (mode !== 'synthetic') return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.clearRect(0, 0, w, h)
    for (let z = 0; z < 128; z += 2) {
      const alpha = opacity * Math.max(0, 1 - Math.abs(z - sliceZ) / 64)
      if (alpha < 0.05) continue
      const imgData = generateVolumeSlice(z, 128, preset)
      const tmp = document.createElement('canvas'); tmp.width = 128; tmp.height = 128
      const tmpCtx = tmp.getContext('2d')
      if (tmpCtx) {
        tmpCtx.putImageData(imgData, 0, 0)
        ctx.globalAlpha = alpha
        const scale = Math.min(w / 128, h / 128) * 0.8
        const ox = (w - 128 * scale) / 2, oy = (h - 128 * scale) / 2
        ctx.save()
        ctx.translate(w / 2, h / 2)
        ctx.rotate((rotation.z * Math.PI) / 180)
        ctx.translate(-w / 2, -h / 2)
        ctx.drawImage(tmp, ox, oy, 128 * scale, 128 * scale)
        ctx.restore()
      }
    }
    ctx.globalAlpha = 1
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(4, 4, 200, 20)
    ctx.fillStyle = '#facc15'
    ctx.fillText(`VR | ${PRESETS[preset].label} | Opacity:${Math.round(opacity * 100)}%`, 8, 18)
  }, [mode, preset, opacity, rotation, sliceZ])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    setRotation(prev => ({
      ...prev,
      y: prev.y + dx * 0.5,
      x: prev.x + dy * 0.5,
    }))
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  const handlePresetChange = useCallback((p: PresetType) => {
    setPreset(p)
  }, [])

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  }
  const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Box size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>VR 体绘制</span>
        <Tag color="cyan">Volume Rendering</Tag>
        {mode === 'real' && <Tag color="green">REAL DICOM</Tag>}
        {mode === 'synthetic' && <Tag>SYNTHETIC</Tag>}
        {realError && <Tag color="red">后端 VR 失败,已回退</Tag>}
        {seriesInfo && <span style={{ fontSize: 11, color: '#64748b' }}>{seriesInfo}</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>预设:</span>
        {(Object.keys(PRESETS) as PresetType[]).map(p => (
          <button key={p} style={preset === p ? activeBtnStyle : btnStyle} onClick={() => handlePresetChange(p)}>
            {PRESETS[p].label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>不透明度:</span>
        <Slider min={0} max={1} step={0.01} value={opacity} onChange={setOpacity} style={{ width: 120 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{Math.round(opacity * 100)}%</span>
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>层位:</span>
        <Slider min={0} max={127} value={sliceZ} onChange={setSliceZ} style={{ width: 120 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{sliceZ}</span>
        <button style={btnStyle} onClick={() => { setRotation({ x: 0, y: 0, z: 0 }); setOpacity(0.8); setPreset('default'); setSliceZ(64) }}>
          <RotateCcw size={12} /> 重置
        </button>
      </div>
      <div
        style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 140px)', cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {mode === 'loading' ? <Spin size="large" /> : <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />}
      </div>
    </div>
  )
}

export default VrPage
