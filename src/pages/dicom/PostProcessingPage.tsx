import React, { useState, useRef, useEffect } from 'react'
import { Card, Row, Col, Slider, Tag, Button } from 'antd'
import { Layers, Save, Download } from 'lucide-react'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'

type ProcessingType = 'sharpen' | 'smooth' | 'edge' | 'denoise' | 'enhance'

const PROCESSING_OPTIONS: Record<ProcessingType, { label: string; description: string }> = {
  sharpen: { label: '锐化', description: '增强边缘对比度' },
  smooth: { label: '平滑', description: '降低噪声平滑图像' },
  edge: { label: '边缘检测', description: '提取结构边缘' },
  denoise: { label: '降噪', description: '去除随机噪声' },
  enhance: { label: '增强', description: '增强组织对比度' },
}

function generateProcessedSlice(type: ProcessingType, size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  let i = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x - size / 2, cy = y - size / 2
    const d = Math.sqrt(cx * cx + cy * cy)
    const a = Math.atan2(cy, cx)
    let v = 200 + 150 * Math.sin(d * 0.03) + 50 * Math.cos(a * 3)
    switch (type) {
      case 'sharpen': v += 80 * Math.cos(d * 0.1); break
      case 'smooth': v = 200 + 150 * Math.sin(d * 0.02); break
      case 'edge': v = Math.abs(Math.cos(d * 0.05)) * 255; break
      case 'denoise': v = 200 + 150 * Math.sin(d * 0.03) + (Math.random() - 0.5) * 20; break
      case 'enhance': v = 100 + 200 * Math.abs(Math.sin(d * 0.03 + a)); break
    }
    v = Math.max(0, Math.min(255, Math.round(v)))
    imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = 255
  }
  return imgData
}

const PostProcessingPage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [processingType, setProcessingType] = useState<ProcessingType>('sharpen')
  const [intensity, setIntensity] = useState(50)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const imgData = generateProcessedSlice(processingType, 256)
    const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 256
    tmp.getContext('2d')!.putImageData(imgData, 0, 0)
    const scale = Math.min(w / 256, h / 256)
    const ox = (w - 256 * scale) / 2, oy = (h - 256 * scale) / 2
    ctx.drawImage(tmp, ox, oy, 256 * scale, 256 * scale)
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(4, 4, 200, 20)
    ctx.fillStyle = '#facc15'
    ctx.fillText(`Post-Processing | ${PROCESSING_OPTIONS[processingType].label} | ${intensity}%`, 8, 18)
  })

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
        <span style={{ fontSize: 15, fontWeight: 700 }}>3D 后处理</span>
        <Tag color="cyan">Post-Processing</Tag>
      </div>
      <Row gutter={12}>
        <Col span={18}>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 140px)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
          </div>
        </Col>
        <Col span={6}>
          <Card size="small" title="处理参数" style={{ background: PANEL_BG, border: '1px solid #334155' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>处理类型</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(Object.keys(PROCESSING_OPTIONS) as ProcessingType[]).map(p => (
                  <button key={p} style={processingType === p ? activeBtnStyle : { ...btnStyle, width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => setProcessingType(p)}>
                    {PROCESSING_OPTIONS[p].label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>强度</span><span style={{ color: '#facc15' }}>{intensity}%</span>
              </div>
              <Slider min={0} max={100} value={intensity} onChange={setIntensity} />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              {PROCESSING_OPTIONS[processingType].description}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" size="small" icon={<Save size={12} />} style={{ flex: 1 }}>应用</Button>
              <Button size="small" icon={<Download size={12} />} style={{ flex: 1 }}>导出</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default PostProcessingPage
