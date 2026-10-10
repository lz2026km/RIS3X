import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, Slider, Tag, Button, message, List } from 'antd'
import { Sparkles, Zap, Save, RefreshCw, PlayCircle, Contrast, History, Trash2 } from 'lucide-react'
import {
  aiPlatformApi,
  type AiPlatformDenoiseResult,
  type DenoiseKernel,
  type DenoisePreset,
  type AiPlatformDenoiseHistoryItem,
  type AiPlatformNoiseEstimate,
} from '../../services/api/aiPlatformApi'
import { t } from '../../i18n/appI18n'
import { StatCard, StatCardGrid } from '../../components/common'

const BLUE = '#3b82f6'
const CARD_BG = '#0f172a'

// [G005 v3.0.6.11-101 Wave 1B (G-10)] 可配置核: 经典算法 + DL 模型接口
const KERNEL_LABELS: Record<DenoiseKernel, string> = {
  median: t('dlDenoisePage.kernelMedian'),
  gaussian: t('dlDenoisePage.kernelGaussian'),
  bilateral: t('dlDenoisePage.kernelBilateral'),
  nlmeans: t('dlDenoisePage.kernelNlmeans'),
  dl: t('dlDenoisePage.kernelDl'),
}

const PRESET_LABELS: Record<DenoisePreset, string> = {
  light: t('dlDenoisePage.presetLight'),
  standard: t('dlDenoisePage.presetStandard'),
  strong: t('dlDenoisePage.presetStrong'),
}

type ModelType = 'cnn' | 'unet' | 'gan' | 'transformer'
// [G005 v3.0.6.11-90 Wave 4B (G-10)] 数据源: preview=本地预览 real=真实后端 fallback=演示回退
type DataSource = 'preview' | 'real' | 'fallback'

const MODELS: Record<ModelType, { label: string; psnr: number; ssim: number; speed: string }> = {
  cnn: { label: 'CNN', psnr: 32.5, ssim: 0.89, speed: t('dlDenoisePage.speedFast') },
  unet: { label: 'U-Net', psnr: 35.2, ssim: 0.92, speed: t('dlDenoisePage.speedMedium') },
  gan: { label: 'GAN', psnr: 36.8, ssim: 0.94, speed: t('dlDenoisePage.speedSlow') },
  transformer: { label: 'Transformer', psnr: 38.1, ssim: 0.96, speed: t('dlDenoisePage.speedSlow') },
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

/** [G-10] 本地噪声等级估计 (Laplacian-MAD, 与后端同构): 返回 {sigma, level, type} */
function estimateLocalNoise(imgData: ImageData): AiPlatformNoiseEstimate {
  const { width, height, data } = imgData
  const samples: number[] = []
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4
      const center = data[idx]!
      const lap =
        data[((y - 1) * width + x) * 4]! +
        data[((y + 1) * width + x) * 4]! +
        data[(y * width + x - 1) * 4]! +
        data[(y * width + x + 1) * 4]! -
        4 * center
      samples.push(Math.abs(lap))
    }
  }
  samples.sort((a, b) => a - b)
  const median = samples[Math.floor(samples.length / 2)] ?? 0
  const sigma = Math.sqrt(Math.PI / 2) * (median / Math.sqrt(20))
  const level = Math.max(0, Math.min(100, Math.round((sigma / 25) * 100)))
  let s = 0
  for (let i = 0; i < data.length; i += 4) s += data[i]!
  const mean = s / (width * height)
  let v = 0
  for (let i = 0; i < data.length; i += 4) {
    const d = data[i]! - mean
    v += d * d
  }
  v /= width * height
  return {
    type: 'gaussian',
    sigma: Math.round(sigma * 100) / 100,
    variance: Math.round(v * 100) / 100,
    poissonSigma: Math.round(Math.sqrt(Math.max(0, mean)) * 60) / 100,
    snrDb: Math.round(10 * Math.log10((mean * mean) / Math.max(1e-6, v)) * 10) / 10,
    level,
    method: 'laplacian-mad (local)',
  }
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
  // [G005 v3.0.6.11-101 Wave 1B (G-10)] 可配置核 / 3 档预设 / 噪声自动估计 / 处理历史
  const [kernel, setKernel] = useState<DenoiseKernel>('median')
  const [preset, setPreset] = useState<DenoisePreset>('standard')
  const [localEstimate, setLocalEstimate] = useState<AiPlatformNoiseEstimate | null>(null)
  const [history, setHistory] = useState<AiPlatformDenoiseHistoryItem[]>([])
  // [G-10] 原图/降噪对比滑块 (0-100, 100=完全显示降噪结果)
  const [comparePos, setComparePos] = useState(50)
  const compareRef = useRef<HTMLDivElement>(null)

  const refreshHistory = useCallback(() => {
    aiPlatformApi.denoiseHistory().then(res => {
      if (res.success && Array.isArray(res.data)) setHistory(res.data)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    setDataSource('preview')
    setServerResult(null)
    setLocalEstimate(null)
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

  // [G-10] 噪声等级自动估计: 本地先估, 执行时后端 (noiseEstimate:true) 校准
  const handleEstimateNoise = () => {
    if (!noisyRef.current) return
    const imgData = noisyRef.current.getContext('2d')!.getImageData(0, 0, 256, 256)
    const est = estimateLocalNoise(imgData)
    setLocalEstimate(est)
    setNoiseLevel(est.level)
    message.info(t('w9d.dlDenoise.noiseEstimated', { type: est.type, sigma: est.sigma, level: est.level }))
  }

  // [G005 v3.0.6.11-90 Wave 4B (G-10)] 执行降噪: 上传当前噪声图 → 真实后端端点
  const handleExecute = async () => {
    if (!noisyRef.current) return
    setExecuting(true)
    try {
      const dataUrl = noisyRef.current.toDataURL('image/png')
      const res = await aiPlatformApi.denoise({
        imageBase64: dataUrl,
        modelId: model,
        strength: noiseLevel,
        kernel,
        preset,
        noiseEstimate: true,
      })
      if (res.success && res.data) {
        const r = res.data
        setServerResult(r)
        if (r.noiseEstimate) setLocalEstimate(r.noiseEstimate)
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
        refreshHistory()
      } else {
        setServerResult(null)
        if (noisyRef.current && denoisedRef.current) {
          const noisy = generateNoisySlice(noiseLevel, 256)
          drawToCanvas(denoisedRef.current, medianFilterImageData(noisy))
        }
        setDataSource('fallback')
        message.warning(t('dlDenoisePage.fallbackUnavailable'))
      }
    } catch {
      setServerResult(null)
      if (noisyRef.current && denoisedRef.current) {
        const noisy = generateNoisySlice(noiseLevel, 256)
        drawToCanvas(denoisedRef.current, medianFilterImageData(noisy))
      }
      setDataSource('fallback')
      message.warning(t('dlDenoisePage.fallbackError'))
    } finally {
      setExecuting(false)
    }
  }

  const handleSaveResult = () => {
    if (!denoisedRef.current) return
    const url = denoisedRef.current.toDataURL('image/png')
    const a = document.createElement('a')
    a.href = url
    a.download = `denoised_${kernel}_${model}_noise${noiseLevel}.png`
    document.body.appendChild(a)
    a.click()
    a.remove()
  }

  const handleClearHistory = () => {
    aiPlatformApi.clearDenoiseHistory().then(res => {
      if (res.success) {
        setHistory([])
        message.success(t('dlDenoisePage.historyCleared'))
      }
    }).catch(() => undefined)
  }

  // [G-10] 原图/降噪对比: 叠加层裁剪 (clip-path) 实现拖拽分界线
  const onCompareMove = (clientX: number) => {
    const el = compareRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / Math.max(1, rect.width)) * 100))
    setComparePos(pct)
  }

  const displayPsnr = serverResult?.psnr ?? currentModel.psnr
  const displaySsim = serverResult?.ssim ?? currentModel.ssim
  const displaySpeed = serverResult ? `${serverResult.elapsedMs} ms` : currentModel.speed
  const activeKernelLabel = KERNEL_LABELS[kernel]

  return (
    <div style={{ background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Sparkles size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('dlDenoisePage.title')}</span>
        <Tag color="cyan">{t('dlDenoisePage.title')} · {activeKernelLabel}</Tag>
        {dataSource === 'real' && <Tag color="green">{t('dlDenoisePage.realBackend')} · {serverResult?.algorithm ?? t('dlDenoisePage.kernelMedian')}{serverResult?.backend ? ` · ${serverResult.backend}` : ''}</Tag>}
        {dataSource === 'fallback' && <Tag color="orange">{t('dlDenoisePage.fallbackRender')}</Tag>}
        {dataSource === 'preview' && <Tag color="gold">{t('dlDenoisePage.localPreview')}</Tag>}
        <span style={{ marginLeft: 'auto', fontSize: 11, color: '#64748b' }}>
          {t('dlDenoisePage.dataNote')} {noiseLevel}% · {KERNEL_LABELS[kernel]} · {PRESET_LABELS[preset]}
          {localEstimate ? t('w9d.dlDenoise.localNoise', { type: localEstimate.type, sigma: localEstimate.sigma }) : ''}
          {serverResult ? t('w9d.dlDenoise.serverMetrics', { psnr: serverResult.psnr, ssim: serverResult.ssim }) : t('w9d.dlDenoise.modelMetrics', { psnr: currentModel.psnr, ssim: currentModel.ssim })}
        </span>
        <Button size="small" type="primary" icon={<PlayCircle size={12} />} loading={executing} onClick={() => void handleExecute()}>{t('dlDenoisePage.execute')}</Button>
        <button onClick={handleSaveResult} style={btnStyle}><Save size={12} /> {t('dlDenoisePage.saveResult')}</button>
      </div>
      <StatCardGrid minWidth={200} gap={16} style={{ marginBottom: 12 }}>
        <StatCard title="PSNR (dB)" value={displayPsnr} icon={<Zap size={18} />} color="primary" />
        <StatCard title="SSIM" value={displaySsim} icon={<Sparkles size={18} />} color="info" />
        <StatCard title={t('dlDenoisePage.processSpeed')} value={displaySpeed} icon={<RefreshCw size={18} />} color="primary" />
        <StatCard title={t('dlDenoisePage.denoiseRate')} value={`${serverResult ? Math.round((serverResult.noiseReduction ?? 0) * 100) : Math.round((1 - noiseLevel / 100) * 100)}%`} icon={<Save size={18} />} color="success" />
      </StatCardGrid>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('dlDenoisePage.model')}</span>
        {(Object.keys(MODELS) as ModelType[]).map(m => (
          <button key={m} style={model === m ? activeBtnStyle : btnStyle} onClick={() => setModel(m)}>
            {MODELS[m].label}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        {/* [G-10] 可配置核 */}
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('dlDenoisePage.kernel')}</span>
        {(Object.keys(KERNEL_LABELS) as DenoiseKernel[]).map(k => (
          <button key={k} style={kernel === k ? activeBtnStyle : btnStyle} onClick={() => setKernel(k)}>
            {KERNEL_LABELS[k]}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        {/* [G-10] 3 档强度预设 */}
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('dlDenoisePage.preset')}</span>
        {(Object.keys(PRESET_LABELS) as DenoisePreset[]).map(p => (
          <button key={p} style={preset === p ? activeBtnStyle : btnStyle} onClick={() => setPreset(p)}>
            {PRESET_LABELS[p]}
          </button>
        ))}
        <div style={{ width: 1, height: 20, background: '#334155' }} />
        {/* [G-10] 噪声等级自动估计 */}
        <button onClick={handleEstimateNoise} style={btnStyle} title={t('dlDenoisePage.estimateHint')}>
          <Contrast size={12} /> {t('dlDenoisePage.estimateNoise')}
        </button>
        <span style={{ fontSize: 12, color: '#94a3b8' }}>{t('dlDenoisePage.noiseLevel')}</span>
        <Slider min={0} max={100} value={noiseLevel} onChange={setNoiseLevel} style={{ width: 160 }} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{noiseLevel}%</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, height: 'calc(100vh - 260px)' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 1, fontSize: 12, color: '#facc15', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4 }}>
            {t('dlDenoisePage.originalNoisy')} {localEstimate ? `· σ=${localEstimate.sigma}` : ''}
          </div>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: '100%' }}>
            <canvas ref={noisyRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
          </div>
        </div>
        {/* [G-10] 原图/降噪对比滑块: 拖拽分界线 */}
        <div
          ref={compareRef}
          style={{ position: 'relative', cursor: 'ew-resize', touchAction: 'none' }}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); onCompareMove(e.clientX) }}
          onPointerMove={(e) => { if (e.buttons === 1) onCompareMove(e.clientX) }}
        >
          <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 2, fontSize: 12, color: '#52c41a', background: 'rgba(0,0,0,0.7)', padding: '2px 8px', borderRadius: 4 }}>
            {t('dlDenoisePage.denoisedResult')} ({activeKernelLabel}) — {t('dlDenoisePage.dragCompare')}
          </div>
          <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: '100%' }}>
            <canvas ref={denoisedRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
            {/* 原图叠加层 (仅在分界线左侧可见) */}
            <div
              style={{
                position: 'absolute', inset: 0,
                clipPath: `inset(0 ${100 - comparePos}% 0 0)`,
                background: CARD_BG,
                overflow: 'hidden',
                pointerEvents: 'none',
              }}
            >
              <canvas ref={noisyRef} style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} />
            </div>
            {/* 分界线 */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${comparePos}%`, width: 2, background: '#facc15', pointerEvents: 'none', boxShadow: '0 0 6px rgba(250,204,21,0.8)' }}>
              <div style={{ position: 'absolute', top: '50%', left: -7, width: 16, height: 16, borderRadius: '50%', background: '#facc15', color: '#020617', fontSize: 10, lineHeight: '16px', textAlign: 'center' }}>⇔</div>
            </div>
          </div>
        </div>
      </div>
      {/* [G-10] 处理历史 */}
      <Card
        size="small"
        title={
          <span style={{ fontSize: 12, color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6 }}>
            <History size={12} /> {t('dlDenoisePage.history')} ({history.length})
          </span>
        }
        extra={
          <button onClick={handleClearHistory} style={btnStyle} disabled={history.length === 0}>
            <Trash2 size={12} /> {t('dlDenoisePage.clear')}
          </button>
        }
        style={{ background: '#0f172a', border: '1px solid #1e293b', marginTop: 10 }}
        headStyle={{ borderBottom: '1px solid #1e293b', padding: '6px 10px', minHeight: 0 }}
        bodyStyle={{ padding: '8px 10px', maxHeight: 140, overflowY: 'auto' }}
      >
        {history.length === 0 ? (
          <div style={{ fontSize: 11, color: '#475569' }}>{t('dlDenoisePage.historyEmpty')}</div>
        ) : (
          <List
            size="small"
            dataSource={history}
            renderItem={(item, idx) => (
              <List.Item style={{ padding: '4px 0', border: 'none' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', display: 'flex', gap: 10, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
                  <span style={{ color: '#64748b', minWidth: 20 }}>{idx + 1}</span>
                  <Tag style={{ marginRight: 0 }}>{item.kernel ?? 'median'}</Tag>
                  <span>{item.source === 'msw' ? 'MSW' : item.source}</span>
                  <span>{t('dlDenoisePage.strength')} {item.strength ?? '-'}</span>
                  <span>PSNR {item.psnr}dB</span>
                  <span>SSIM {item.ssim}</span>
                  {item.noiseEstimate && <span style={{ color: '#facc15' }}>σ={item.noiseEstimate.sigma}</span>}
                  {item.backend && <span style={{ color: '#22c55e' }}>{item.backend}</span>}
                  <span style={{ marginLeft: 'auto', color: '#475569', fontSize: 10 }}>
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              </List.Item>
            )}
          />
        )}
      </Card>
    </div>
  )
}

export default DlDenoisePage
