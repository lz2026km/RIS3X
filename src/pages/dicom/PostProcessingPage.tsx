import React, { useState, useRef, useEffect } from 'react'
import { Card, Row, Col, Slider, Tag, Button } from 'antd'
import { Layers, Save, Download } from 'lucide-react'
import { seededUnit } from '../../utils/seededRandom'
import { t } from '../../i18n/appI18n'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'

type ProcessingType = 'sharpen' | 'smooth' | 'edge' | 'denoise' | 'enhance'

const PROCESSING_OPTIONS: Record<ProcessingType, { labelKey: string; descKey: string }> = {
  sharpen: { labelKey: 'w9d.postproc.sharpen', descKey: 'w9d.postproc.sharpenDesc' },
  smooth: { labelKey: 'w9d.postproc.smooth', descKey: 'w9d.postproc.smoothDesc' },
  edge: { labelKey: 'w9d.postproc.edge', descKey: 'w9d.postproc.edgeDesc' },
  denoise: { labelKey: 'w9d.postproc.denoise', descKey: 'w9d.postproc.denoiseDesc' },
  enhance: { labelKey: 'w9d.postproc.enhance', descKey: 'w9d.postproc.enhanceDesc' },
}
const procLabel = (p: ProcessingType) => t(PROCESSING_OPTIONS[p].labelKey)
const procDesc = (p: ProcessingType) => t(PROCESSING_OPTIONS[p].descKey)

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
      case 'denoise': v = 200 + 150 * Math.sin(d * 0.03) + (seededUnit(`dicom-noise-${x}-${y}`) - 0.5) * 20; break
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
  const [appliedAt, setAppliedAt] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const [history, setHistory] = useState<string[]>([])
  const [sliceStats, setSliceStats] = useState<{ mean: number; sigma: number } | null>(null)

  const renderFrame = (type: ProcessingType, intensityVal: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width, h = rect.height
    canvas.width = w * devicePixelRatio; canvas.height = h * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const imgData = generateProcessedSlice(type, 256)
    // [W2-C] 数据标注: 统计当前帧像素均值/标准差
    let sum = 0, sumSq = 0, n = 0
    for (let i = 0; i < imgData.data.length; i += 4) { const v = imgData.data[i] ?? 0; sum += v; sumSq += v * v; n++ }
    const mean = sum / n
    setSliceStats({ mean: Math.round(mean * 10) / 10, sigma: Math.round(Math.sqrt(sumSq / n - mean * mean) * 10) / 10 })
    const tmp = document.createElement('canvas'); tmp.width = 256; tmp.height = 256
    tmp.getContext('2d')!.putImageData(imgData, 0, 0)
    const scale = Math.min(w / 256, h / 256)
    const ox = (w - 256 * scale) / 2, oy = (h - 256 * scale) / 2
    ctx.drawImage(tmp, ox, oy, 256 * scale, 256 * scale)
    ctx.font = '13px ui-monospace, monospace'
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(4, 4, 300, 20)
    ctx.fillStyle = '#facc15'
    ctx.fillText(t('w9d.postproc.canvasOverlay', { label: procLabel(type), intensity: intensityVal, applied: appliedAt ? t('w9d.postproc.appliedSuffix') : '' }), 8, 18)
  }

  useEffect(() => {
    renderFrame(processingType, intensity)
  })

  const handleApply = () => {
    setProcessing(true)
    setTimeout(() => {
      const at = new Date().toLocaleTimeString('zh-CN', { hour12: false })
      setAppliedAt(at)
      setHistory(prev => [`${procLabel(processingType)} ${intensity}% @ ${at}`, ...prev].slice(0, 5))
      renderFrame(processingType, intensity)
      setProcessing(false)
    }, 600)
  }

  const handleExport = () => {
    const canvas = canvasRef.current
    if (!canvas) { return }
    const url = canvas.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `postprocessed_${processingType}_${intensity}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  }
  const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

  return (
    <div style={{ background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('w9d.postproc.title')}</span>
        <Tag color="cyan">{t('w9d.postproc.tag')}</Tag>
        <Tag color="gold">{t('w9d.postproc.demoTag')}</Tag>
        {/* [G005 W7] 明确的「演示模拟」徽标 (合成影像 + 确定性噪声) */}
        <Tag color="volcano">{t('w7demo.simulatedBadge')}</Tag>
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          {t('w9d.postproc.dataNote', { mean: sliceStats?.mean ?? '-', sigma: sliceStats?.sigma ?? '-', count: history.length })}
        </span>
      </div>
      <Row gutter={12}>
        <Col span={18}>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 140px)' }}>
            <canvas ref={canvasRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
          </div>
        </Col>
        <Col span={6}>
          <Card size="small" title={t('w9d.postproc.params')} style={{ background: PANEL_BG, border: '1px solid #334155' }}>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 6 }}>{t('w9d.postproc.type')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {(Object.keys(PROCESSING_OPTIONS) as ProcessingType[]).map(p => (
                  <button key={p} style={processingType === p ? activeBtnStyle : { ...btnStyle, width: '100%', justifyContent: 'flex-start' }}
                    onClick={() => setProcessingType(p)}>
                    {procLabel(p)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>
                <span>{t('w9d.postproc.intensity')}</span><span style={{ color: '#facc15' }}>{intensity}%</span>
              </div>
              <Slider min={0} max={100} value={intensity} onChange={setIntensity} />
            </div>
            <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
              {procDesc(processingType)}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <Button type="primary" size="small" icon={<Save size={12} />} style={{ flex: 1 }} loading={processing} onClick={handleApply}>{processing ? t('w9d.postproc.processing') : t('w9d.postproc.apply')}</Button>
              <Button size="small" icon={<Download size={12} />} style={{ flex: 1 }} onClick={handleExport}>{t('w9d.postproc.export')}</Button>
            </div>
            {appliedAt && <div style={{ marginTop: 8, fontSize: 11, color: '#4ade80' }}>{t('w9d.postproc.appliedAt', { at: appliedAt, label: procLabel(processingType), intensity })}</div>}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default PostProcessingPage
