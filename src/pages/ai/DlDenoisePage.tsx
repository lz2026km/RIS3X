import React, { useState, useRef, useEffect } from 'react'
import { Card, Row, Col, Statistic, Slider, Tag, Button, message } from 'antd'
import { Sparkles, Zap, Save, RefreshCw, PlayCircle } from 'lucide-react'
import { aiPlatformApi, type AiPlatformDenoiseResult } from '../../services/api/aiPlatformApi'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'

const ALGORITHM_LABELS: Record<string, string> = { median: '中值滤波' }

type ModelType = 'cnn' | 'unet' | 'gan' | 'transformer'
// [G005 v3.0.6.11-90 Wave 4B (G-10)] 数据源: preview=本地预览 real=真实后端 fallback=演示回退
type DataSource = 'preview' | 'real' | 'fallback'

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

// [G005 v3.0.6.11-90 Wave 4B (G-10)] 本地确定性 3x3 中值滤波 (演示回退渲染)
function medianFilterImageData(imgData: ImageData): ImageData {
  const { width, height, data } = imgData
  const out = document.createElement('canvas').getContext('2d')!.createImageData(width, height)
  const src = data
  const dst = out.data
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      for (let c = 0; c < 4; c++) {
        if (c === 3) {
          dst[(y * width + x) * 4 + 3] = 255
          continue
        }
        const win: number[] = []
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = Math.min(width - 1, Math.max(0, x + dx))
            const ny = Math.min(height - 1, Math.max(0, y + dy))
            win.push(src[(ny * width + nx) * 4 + c]!)
          }
        }
        win.sort((a, b) => a - b)
        dst[(y * width + x) * 4 + c] = win[4]!
      }
    }
  }
  return out
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

// [G005 v3.0.6.11-90 Wave 4B (G-10)] 后端返回图 (dataURL) 绘制
function drawImageUrlToCanvas(canvas: HTMLCanvasElement, url: string) {
  const img = new Image()
  img.onload = () => {
    const ctx = canvas.getContext('2d')!
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.fillStyle = CARD_BG
    ctx.fillRect(0, 0, w, h)
    const scale = Math.min(w / img.width, h / img.height)
    const ox = (w - img.width * scale) / 2, oy = (h - img.height * scale) / 2
    ctx.drawImage(img, ox, oy, img.width * scale, img.height * scale)
  }
  img.src = url
}

const DlDenoisePage: React.FC = () => {
  const noisyRef = useRef<HTMLCanvasElement>(null)
  const denoisedRef = useRef<HTMLCanvasElement>(null)
  const [noiseLevel, setNoiseLevel] = useState(50)
  const [model, setModel] = useState<ModelType>('unet')
  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 真实后端对接状态
  const [dataSource, setDataSource] = useState<DataSource>('preview')
  const [serverResult, setServerResult] = useState<AiPlatformDenoiseResult | null>(null)
  const [executing, setExecuting] = useState(false)

  useEffect(() => {
    setDataSource('preview')
    setServerResult(null)
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

  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 执行降噪: 上传当前噪声图 → 真实后端端点
  const handleExecute = async () => {
    if (!noisyRef.current) return
    setExecuting(true)
    try {
      const dataUrl = noisyRef.current.toDataURL('image/png')
      const res = await aiPlatformApi.denoise({ imageBase64: dataUrl, modelId: model, strength: noiseLevel })
      if (res.success && res.data) {
        const r = res.data
        setServerResult(r)
        if (r.denoisedBase64 && denoisedRef.current) {
          drawImageUrlToCanvas(denoisedRef.current, `data:image/png;base64,${r.denoisedBase64}`)
          setDataSource('real')
        } else {
          // MSW 模拟: 服务端指标有效但无图像 → 本地确定性中值滤波渲染
          if (noisyRef.current && denoisedRef.current) {
            const noisy = generateNoisySlice(noiseLevel, 256)
            drawToCanvas(denoisedRef.current, medianFilterImageData(noisy))
          }
          setDataSource('fallback')
        }
      } else {
        setServerResult(null)
        if (noisyRef.current && denoisedRef.current) {
          const noisy = generateNoisySlice(noiseLevel, 256)
          drawToCanvas(denoisedRef.current, medianFilterImageData(noisy))
        }
        setDataSource('fallback')
        message.warning('降噪服务不可用，已回退本地演示')
      }
    } catch {
      setServerResult(null)
      if (noisyRef.current && denoisedRef.current) {
        const noisy = generateNoisySlice(noiseLevel, 256)
        drawToCanvas(denoisedRef.current, medianFilterImageData(noisy))
      }
      setDataSource('fallback')
      message.warning('降噪请求异常，已回退本地演示')
    } finally {
      setExecuting(false)
    }
  }

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

  const displayPsnr = serverResult?.psnr ?? currentModel.psnr
  const displaySsim = serverResult?.ssim ?? currentModel.ssim
  const displaySpeed = serverResult ? `${serverResult.elapsedMs} ms` : currentModel.speed

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Sparkles size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>深度学习降噪</span>
        <Tag color="cyan">深度学习降噪</Tag>
        {dataSource === 'real' && <Tag color="green">真实后端 · {ALGORITHM_LABELS[serverResult?.algorithm ?? 'median'] ?? serverResult?.algorithm ?? '中值滤波'}</Tag>}
        {dataSource === 'fallback' && <Tag color="orange">演示回退 · 本地渲染</Tag>}
        {dataSource === 'preview' && <Tag color="gold">本地预览 · 参数实时可调</Tag>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          数据标注: 单帧 256×256 合成切片 · 噪声 {noiseLevel}% · 模型 {currentModel.label}
          {serverResult ? ` · 服务端 PSNR ${serverResult.psnr}dB / SSIM ${serverResult.ssim}` : ` (PSNR ${currentModel.psnr}dB / SSIM ${currentModel.ssim})`}
        </span>
        <Button size="small" type="primary" icon={<PlayCircle size={12} />} loading={executing} onClick={() => void handleExecute()}>执行降噪</Button>
        <button onClick={handleSaveResult} style={btnStyle}><Save size={12} /> 保存结果</button>
      </div>
      <Row gutter={16} style={{ marginBottom: 12 }}>
        <Col span={6}><Card><Statistic title="PSNR (dB)" value={displayPsnr} prefix={<Zap size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="SSIM" value={displaySsim} prefix={<Sparkles size={16} />} /></Card></Col>
        <Col span={6}><Card><Statistic title="处理速度" value={displaySpeed} prefix={<RefreshCw size={16} />} /></Card></Col>
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
