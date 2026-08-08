import React, { useState, useRef, useEffect } from 'react'
import { Card, Row, Col, Statistic, Slider, Tag } from 'antd'
import { Sparkles, Zap, Save, RefreshCw } from 'lucide-react'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'

type ModelType = 'cnn' | 'unet' | 'gan' | 'transformer'

const MODELS: Record<ModelType, { label: string; psnr: number; ssim: number; speed: string }> = {
  cnn: { label: 'CNN', psnr: 32.5, ssim: 0.89, speed: '快' },
  unet: { label: 'U-Net', psnr: 35.2, ssim: 0.92, speed: '中' },
  gan: { label: 'GAN', psnr: 36.8, ssim: 0.94, speed: '慢' },
  transformer: { label: 'Transformer', psnr: 38.1, ssim: 0.96, speed: '慢' },
}

function generateNoisySlice(noiseLevel: number, size: number): ImageData {
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
    v += (Math.random() - 0.5) * noiseLevel * 2
    v = Math.max(0, Math.min(255, Math.round(v)))
    imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = 255
  }
  return imgData
}

function generateDenoisedSlice(noiseLevel: number, model: ModelType, size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const factor = MODELS[model].ssim
  let i = 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const cx = x - size / 2, cy = y - size / 2
    const d = Math.sqrt(cx * cx + cy * cy)
    const a = Math.atan2(cy, cx)
    let v = 200 + 150 * Math.sin(d * 0.03) + 50 * Math.cos(a * 3)
    v += (Math.random() - 0.5) * noiseLevel * 2 * (1 - factor)
    v = Math.max(0, Math.min(255, Math.round(v)))
    imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = v; imgData.data[i++] = 255
  }
  return imgData
}

function drawToCanvas(canvas: HTMLCanvasElement, imgData: ImageData) {
  const ctx = canvas.getContext('2d')!
  const rect = canvas.getBoundingClientRect()
  const w = rect.width, h = rect.height
  canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
  ctx.scale(devicePixelRatio, devicePixelRatio)
  const tmp = document.createElement('canvas'); tmp.width = imgData.width; tmp.height = imgData.height
  tmp.getContext('2d')!.putImageData(imgData, 0, 0)
  const scale = Math.min(w / imgData.width, h / imgData.height)
  const ox = (w - imgData.width * scale) / 2, oy = (h - imgData.height * scale) / 2
  ctx.drawImage(tmp, ox, oy, imgData.width * scale, imgData.height * scale)
}

const DlDenoisePage: React.FC = () => {
  const noisyRef = useRef<HTMLCanvasElement>(null)
  const denoisedRef = useRef<HTMLCanvasElement>(null)
  const [noiseLevel, setNoiseLevel] = useState(50)
  const [model, setModel] = useState<ModelType>('unet')

  useEffect(() => {
    if (noisyRef.current) {
      const imgData = generateNoisySlice(noiseLevel, 256)
      drawToCanvas(noisyRef.current, imgData)
    }
    if (denoisedRef.current) {
      const imgData = generateDenoisedSlice(noiseLevel, model, 256)
      drawToCanvas(denoisedRef.current, imgData)
    }
  }, [noiseLevel, model])

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  }
  const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

  const currentModel = MODELS[model]

  const handleSaveResult = () => {
    if (!denoisedRef.current) return
    const url = denoisedRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `denoised_${model}_noise${noiseLevel}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Sparkles size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>深度学习降噪</span>
        <Tag color="cyan">深度学习降噪</Tag>
        <Tag color="gold">本地演示 · 参数实时可调</Tag>
        <Tag color="red">演示功能（无后端模型）</Tag>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          数据标注: 单帧 256×256 合成切片 · 噪声 {noiseLevel}% · 模型 {currentModel.label} (PSNR {currentModel.psnr}dB / SSIM {currentModel.ssim})
        </span>
        <button onClick={handleSaveResult} style={btnStyle}><Save size={12} /> 保存结果</button>
      </div>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}><Card><Statistic title="PSNR (dB)" value={currentModel.psnr} prefix={<Zap size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="SSIM" value={currentModel.ssim} prefix={<Sparkles size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="处理速度" value={currentModel.speed} prefix={<RefreshCw size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="降噪率" value={`${Math.round((1 - noiseLevel / 100) * 100)}%`} prefix={<Save size={16} />} /></Card></Col>
      </Row>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>模型:</span>
        {(Object.keys(MODELS) as ModelType[]).map(m => (
          <button key={m} style={model === m ? activeBtnStyle : btnStyle} onClick={() => setModel(m)}>
            {MODELS[m].label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        <span style={{ fontSize: 12, color: '#94a3b8' }}>噪声水平:</span>
        <Slider min={0} max={100} value={noiseLevel} onChange={setNoiseLevel} style={{ width: 200 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{noiseLevel}%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: 'calc(100vh - 260px)' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontSize: 12, color: '#facc15', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4 }}>
            原始 (含噪声)
          </div>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: '100%' }}>
            <canvas ref={noisyRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
          </div>
        </div>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontSize: 12, color: '#52c41a', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4 }}>
            降噪后 ({MODELS[model].label})
          </div>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: '100%' }}>
            <canvas ref={denoisedRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
          </div>
        </div>
      </div>
    </div>
  )
}

export default DlDenoisePage
