import React, { useState, useRef, useEffect } from 'react'
import { Slider, Tag } from 'antd'
import { Layers, RotateCcw } from 'lucide-react'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'

function generateMipData(sliceRange: [number, number], size: number): number[][] {
  const data: number[][] = []
  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2
      const cy = y - size / 2
      const d = Math.sqrt(cx * cx + cy * cy)
      let maxVal = 0
      for (let z = sliceRange[0]; z <= sliceRange[1]; z++) {
        const zOff = (z - 64) / 64
        let v = 200 + 180 * Math.sin(d * 0.03 + zOff * 0.5) + 60 * Math.cos(Math.atan2(cy, cx) * 3 + zOff * 0.3)
        v += 40 * Math.sin((cx * 0.02 + cy * 0.025 + zOff * 0.4) * 2)
        maxVal = Math.max(maxVal, v)
      }
      row.push(Math.max(0, Math.min(4095, Math.round(maxVal))))
    }
    data.push(row)
  }
  return data
}

function applyWWL(data: number[][], ww: number, wl: number): ImageData {
  const size = data.length
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2, min = wl - half, max = wl + half, range = max - min || 1
  let i = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const row = data[y]
    if (!row) continue
    const val = row[x]
    if (val === undefined) continue
    let v = ((val - min) / range) * 255
    v = Math.max(0, Math.min(255, Math.round(v)))
    imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = 255
  }
  return imgData
}

const MipPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [thickness, setThickness] = useState(80)
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const start = Math.max(0, Math.min(127, 64 - thickness / 2))
    const end = Math.max(0, Math.min(127, start + thickness))
    const data = generateMipData([start, end], 256)
    const imgData = applyWWL(data, ww, wl)
    const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 256
    const tmpCtx = tmp.getContext('2d')
    if (tmpCtx) {
      tmpCtx.putImageData(imgData, 0, 0)
      const scale = Math.min(w / 256, h / 256)
      const ox = (w - 256 * scale) / 2, oy = (h - 256 * scale) / 2
      ctx.drawImage(tmp, ox, oy, 256 * scale, 256 * scale)
    }
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(4, 4, 180, 20)
    ctx.fillStyle = '#facc15'
    ctx.fillText(`MIP | Slice ${start}-${end} | T:${thickness}`, 8, 18)
  })

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>MIP 最大密度投影</span>
        <Tag color="cyan">Maximum Intensity Projection</Tag>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>层厚:</span>
        <Slider min={1} max={128} value={thickness} onChange={setThickness} style={{ width: 200 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{thickness}</span>
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>WW:</span>
        <Slider min={1} max={4000} value={ww} onChange={setWw} style={{ width: 120 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{ww}</span>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>WL:</span>
        <Slider min={-1000} max={3000} value={wl} onChange={setWl} style={{ width: 120 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{wl}</span>
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <button style={btnStyle} onClick={() => { setThickness(80); setWw(400); setWl(40) }}><RotateCcw size={12} /> 重置</button>
      </div>
      <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 140px)' }}>
        <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
      </div>
    </div>
  )
}

export default MipPage
