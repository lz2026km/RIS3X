import React, { useState, useRef, useEffect } from 'react'
import { Card, Slider, Tag, Row, Col, Statistic } from 'antd'
import { Layers, Play, Pause, SkipBack, SkipForward } from 'lucide-react'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'

function generateDbtSlice(angle: number, size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  let i = 0
  const angleRad = (angle * Math.PI) / 180
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x - size / 2, cy = y - size / 2
    const d = Math.sqrt(cx * cx + cy * cy)
    const a = Math.atan2(cy, cx)
    let v = 180 + 160 * Math.sin(d * 0.03 + angleRad * 0.5) + 50 * Math.cos(a * 2 + angleRad * 0.3)
    v += 30 * Math.sin(cx * 0.02 + cy * 0.02 + angle * 0.01)
    v = Math.max(0, Math.min(255, Math.round(v)))
    imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = 255
  }
  return imgData
}

const DbtPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [currentAngle, setCurrentAngle] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [ww, setWw] = useState(400)
  const [wl, setWl] = useState(40)
  const animRef = useRef<number>(0)

  const totalAngles = 15

  useEffect(() => {
    if (!playing) { cancelAnimationFrame(animRef.current); return }
    let last = performance.now()
    function tick(now: number) {
      const interval = 200 / speed
      if (now - last >= interval) {
        last = now
        setCurrentAngle(prev => (prev + 1) % totalAngles)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, speed])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const angle = (currentAngle / totalAngles) * 15 - 7.5
    const imgData = generateDbtSlice(angle, 256)
    const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 256
    tmp.getContext('2d')!.putImageData(imgData, 0, 0)
    const scale = Math.min(w / 256, h / 256)
    const ox = (w - 256 * scale) / 2, oy = (h - 256 * scale) / 2
    ctx.drawImage(tmp, ox, oy, 256 * scale, 256 * scale)
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(4, 4, 200, 20)
    ctx.fillStyle = '#facc15'
    ctx.fillText(`DBT | Angle: ${angle.toFixed(1)}° | Frame: ${currentAngle + 1}/${totalAngles}`, 8, 18)
  })

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 4,
  }
  const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>DBT 断层合成</span>
        <Tag color="cyan">Digital Breast Tomosynthesis</Tag>
      </div>
      <Row gutter={12}>
        <Col span={18}>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 140px)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, background: PANEL_BG, borderRadius: 6, padding: '8px 12px' }}>
            <button style={currentAngle === 0 ? { ...btnStyle, opacity: 0.4 } : btnStyle}
              disabled={currentAngle === 0} onClick={() => { setCurrentAngle(0); setPlaying(false) }}>
              <SkipBack size={14} />
            </button>
            <button style={playing ? activeBtnStyle : btnStyle} onClick={() => setPlaying(v => !v)}>
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button style={currentAngle >= totalAngles - 1 ? { ...btnStyle, opacity: 0.4 } : btnStyle}
              disabled={currentAngle >= totalAngles - 1} onClick={() => { setCurrentAngle(f => Math.min(totalAngles - 1, f + 1)); setPlaying(false) }}>
              <SkipForward size={14} />
            </button>
            <div style={{ width: 1, height: 20, background: '#334155' }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>速度:</span>
            {[0.5, 1, 2, 4].map(v => (
              <button key={v} style={speed === v ? activeBtnStyle : btnStyle} onClick={() => setSpeed(v)}>{v}x</button>
            ))}
            <div style={{ width: 1, height: 20, background: '#334155' }} />
            <Slider min={0} max={totalAngles - 1} value={currentAngle}
              onChange={v => { setCurrentAngle(v); setPlaying(false) }} style={{ flex: 1 }} />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{currentAngle + 1}/{totalAngles}</span>
          </div>
        </Col>
        <Col span={6}>
          <Card size="small" title="DBT 参数" style={{ background: PANEL_BG, border: '1px solid #334155' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>WW</span><span style={{ color: '#facc15' }}>{ww}</span>
              </div>
              <Slider min={1} max={4000} value={ww} onChange={setWw} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>WL</span><span style={{ color: '#facc15' }}>{wl}</span>
              </div>
              <Slider min={-1000} max={3000} value={wl} onChange={setWl} />
            </div>
            <div style={{ borderTop: '1px solid #334155', paddingTop: 8, marginTop: 8 }}>
              <Row gutter={[8, 8]}>
                <Col span={12}><Statistic title="投照角度" value={`${(currentAngle / totalAngles * 15 - 7.5).toFixed(1)}°`} valueStyle={{ fontSize: 14 }} /></Col>
                <Col span={12}><Statistic title="总帧数" value={totalAngles} valueStyle={{ fontSize: 14 }} /></Col>
                <Col span={12}><Statistic title="合成模式" value="DBT" valueStyle={{ fontSize: 14 }} /></Col>
                <Col span={12}><Statistic title="分辨率" value="256×256" valueStyle={{ fontSize: 14 }} /></Col>
              </Row>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default DbtPage
