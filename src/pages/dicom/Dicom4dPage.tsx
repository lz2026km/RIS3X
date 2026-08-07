import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Heart, Play, Pause, SkipBack, SkipForward, RotateCcw, Clock } from 'lucide-react'
import { Select, Card, Slider, Switch, message } from 'antd'
import { dicom4dApi, type Series4D } from '../../services/api/dicomApi'

interface PhaseState {
  cardiacPhase: number
  respiratoryPhase: number
  frames: Array<{ frameIndex: number; timestamp: string; phase: number; dataUrl: string }>
  frameRate: number
}

function generateFallbackPixel(frameIndex: number, totalFrames: number, size: number): ImageData {
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const t = frameIndex / totalFrames
  const cx = size / 2
  const cy = size / 2
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.sqrt(dx * dx + dy * dy)
      const a = Math.atan2(dy, dx)
      const phaseVal = Math.sin(t * Math.PI * 2) * 0.3 + 0.7
      const ring = Math.sin(d * 0.05 + t * Math.PI * 4) * 0.5 + 0.5
      const motion = Math.sin(a * 3 + t * Math.PI * 2) * 0.2
      const intensity = Math.round(
        Math.max(0, Math.min(255, (ring * 200 + 55) * phaseVal + motion * 50)),
      )
      const idx = (y * size + x) * 4
      imgData.data[idx] = intensity
      imgData.data[idx + 1] = Math.round(intensity * 0.6 + 40 * ring)
      imgData.data[idx + 2] = Math.round(intensity * 0.3 + 80 * (1 - ring * phaseVal))
      imgData.data[idx + 3] = 255
    }
  }
  return imgData
}

function drawBeatingHeart(
  ctx: CanvasRenderingContext2D,
  phase: number,
  w: number,
  h: number,
) {
  const scale = 1 + 0.08 * Math.sin(phase * Math.PI * 2)
  ctx.save()
  ctx.translate(w / 2, h / 2)
  ctx.scale(scale, scale)
  ctx.translate(-w / 2, -h / 2)
  ctx.font = `${Math.round(80 * scale)}px serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#ef4444'
  ctx.fillText('♥', w / 2, h / 2)
  ctx.restore()
}

function drawLungMotion(
  ctx: CanvasRenderingContext2D,
  phase: number,
  w: number,
  h: number,
) {
  const inflate = 0.06 * Math.sin(phase * Math.PI * 2)
  ctx.save()
  ctx.strokeStyle = '#60a5fa'
  ctx.lineWidth = 2
  ctx.fillStyle = 'rgba(96, 165, 250, 0.15)'
  const cw = w * 0.35 * (1 + inflate)
  const ch = h * 0.5 * (1 + inflate * 0.7)
  const lx = w / 2 - cw - 10
  const rx = w / 2 + 10
  const centerY = h / 2
  ctx.beginPath()
  ctx.ellipse(lx, centerY, cw, ch, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.ellipse(rx, centerY, cw, ch, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
  ctx.restore()
}

const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'
const BLUE = '#3b82f6'
const btnStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid #334155',
  color: '#94a3b8',
  borderRadius: 4,
  padding: '6px 10px',
  fontSize: 12,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export default function Dicom4dPage() {
  const { t } = useTranslation('dicom')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const [seriesList, setSeriesList] = useState<Series4D[]>([])
  const [selectedUid, setSelectedUid] = useState<string>('')
  const [phaseState, setPhaseState] = useState<PhaseState | null>(null)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [loop, setLoop] = useState(true)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [cardiacPhase, setCardiacPhase] = useState(0)
  const [respiratoryPhase, setRespiratoryPhase] = useState(0)
  const [loading, setLoading] = useState(false)
  const [seriesLoadError, setSeriesLoadError] = useState<string | null>(null)
  const [frameImages, setFrameImages] = useState<Record<number, HTMLImageElement>>({})

  const currentFrameDataUrl = phaseState?.frames[currentFrame]?.dataUrl || ''

  useEffect(() => {
    if (!currentFrameDataUrl || frameImages[currentFrame]) return
    const img = new Image()
    img.onload = () => setFrameImages(prev => ({ ...prev, [currentFrame]: img }))
    img.src = currentFrameDataUrl
  }, [currentFrameDataUrl, currentFrame, frameImages])

  useEffect(() => {
    let cancelled = false
    dicom4dApi.list().then(res => {
      if (cancelled) return
      if (res.success && Array.isArray(res.data)) {
        setSeriesList(res.data)
        if (res.data.length > 0) setSelectedUid(res.data[0].seriesUid)
        setSeriesLoadError(null)
      } else {
        setSeriesLoadError('4D 序列列表加载失败')
      }
    })
    return () => { cancelled = true }
  }, [])

  const loadSeries = useCallback(async (uid: string) => {
    if (!uid) return
    setLoading(true)
    try {
      const [framesRes, phaseRes] = await Promise.all([
        dicom4dApi.frames(uid),
        dicom4dApi.phase(uid),
      ])
      if (framesRes.success && phaseRes.success) {
        const frames = framesRes.data || []
        const t0 = frames[0]?.timestamp ? new Date(frames[0].timestamp).getTime() : 0
        const t1 = frames[1]?.timestamp ? new Date(frames[1].timestamp).getTime() : 0
        const interval = t0 > 0 && t1 > t0 ? t1 - t0 : 100
        setPhaseState({
          frames,
          frameRate: frames.length > 0 ? Math.round(1000 / interval) : 10,
          cardiacPhase: phaseRes.data.cardiacPhase,
          respiratoryPhase: phaseRes.data.respiratoryPhase,
        })
        setCurrentFrame(0)
        setCardiacPhase(phaseRes.data.cardiacPhase)
        setRespiratoryPhase(phaseRes.data.respiratoryPhase)
        setPlaying(false)
      }
    } catch {
      message.error(t('dicom4d.loadError', '4D 序列加载失败'))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    if (selectedUid) loadSeries(selectedUid)
  }, [selectedUid, loadSeries])

  const frameCount = phaseState?.frames.length ?? 0

  useEffect(() => {
    if (!playing || frameCount === 0) return
    const intervalMs = 1000 / (phaseState?.frameRate ?? 10) / speed
    let last = performance.now()
    let frame = currentFrame

    function tick(now: number) {
      const elapsed = now - last
      if (elapsed >= intervalMs) {
        const advance = Math.floor(elapsed / intervalMs)
        last = now - (elapsed % intervalMs)
        frame += advance
        if (frame >= frameCount) {
          if (loop) frame = frame % frameCount
          else { frame = frameCount - 1; setPlaying(false); setCurrentFrame(frame); return }
        }
        setCurrentFrame(frame)
        const p = frame / frameCount
        setCardiacPhase(Math.round(Math.sin(p * Math.PI * 2 * 3) * 0.5 + 0.5) * 100)
        setRespiratoryPhase(Math.round(Math.sin(p * Math.PI * 2 * 0.75) * 0.5 + 0.5) * 100)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, frameCount, speed, loop, phaseState, currentFrame])

  const selectedSeries = seriesList.find(s => s.seriesUid === selectedUid)
  const gatingType = selectedSeries?.gatingType ?? 'cardiac'
  const showCardiac = gatingType === 'cardiac' || gatingType === 'both'
  const showRespiratory = gatingType === 'respiratory' || gatingType === 'both'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * devicePixelRatio
    canvas.height = rect.height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    const w = rect.width
    const h = rect.height
    ctx.clearRect(0, 0, w, h)

    if (frameCount > 0) {
      const realFrame = frameImages[currentFrame]
      if (realFrame) {
        const scale = Math.min(w / realFrame.width, h / realFrame.height)
        const dw = realFrame.width * scale
        const dh = realFrame.height * scale
        ctx.drawImage(realFrame, Math.round((w - dw) / 2), Math.round((h - dh) / 2), Math.round(dw), Math.round(dh))
      } else {
        const imgData = generateFallbackPixel(currentFrame, frameCount, 256)
        ctx.putImageData(imgData, Math.round((w - 256) / 2), Math.round((h - 256) / 2))
      }
    }

    if (showCardiac) drawBeatingHeart(ctx, cardiacPhase / 100, w, h)
    if (showRespiratory) drawLungMotion(ctx, respiratoryPhase / 100, w, h)
  }, [currentFrame, cardiacPhase, respiratoryPhase, frameCount, showCardiac, showRespiratory, frameImages])

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Activity size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('dicom4d.title', '4D Dynamic Imaging')}</span>
      </div>

      <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {t('dicom4d.series', '4D Series')}:
            </span>
            <Select
              value={selectedUid || undefined}
              onChange={setSelectedUid}
              placeholder={t('dicom4d.selectSeries', 'Select 4D series')}
              loading={loading}
              style={{ width: 320 }}
              options={seriesList.map(s => ({
                value: s.seriesUid,
                label: `${s.seriesDescription} (${s.modality}, ${s.frameCount}f, ${s.gatingType})`,
              }))}
            />
          </div>
          {selectedSeries && (
            <span style={{ fontSize: 11, color: '#64748b' }}>
              {selectedSeries.patientName} | {selectedSeries.modality} | {selectedSeries.frameCount}f
            </span>
          )}
          {seriesLoadError && (
            <span style={{ fontSize: 11, color: '#f87171' }}>⚠ {seriesLoadError}</span>
          )}
        </div>
      </Card>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 400 }}>
          <div style={{
            background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b',
            overflow: 'hidden', position: 'relative', aspectRatio: '1 / 1', maxHeight: '60vh',
          }}>
            <canvas
              ref={canvasRef}
              style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }}
            />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 8,
            background: PANEL_BG, borderRadius: 6, padding: '8px 12px', flexWrap: 'wrap',
          }}>
            <button
              style={currentFrame === 0 ? { ...btnStyle, opacity: 0.4 } : btnStyle}
              disabled={currentFrame === 0}
              onClick={() => { setCurrentFrame(0); setPlaying(false) }}
              aria-label="第一帧"
            >
              <SkipBack size={14} />
            </button>
            <button
              style={playing ? activeBtnStyle : btnStyle}
              onClick={() => setPlaying(v => !v)}
              disabled={frameCount === 0}
              aria-label={playing ? '暂停' : '播放'}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              style={currentFrame >= frameCount - 1 ? { ...btnStyle, opacity: 0.4 } : btnStyle}
              disabled={currentFrame >= frameCount - 1}
              onClick={() => { setCurrentFrame(f => Math.min(frameCount - 1, f + 1)); setPlaying(false) }}
              aria-label="下一帧"
            >
              <SkipForward size={14} />
            </button>

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            <Clock size={12} color="#64748b" />
            <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 60 }}>
              {formatTime((currentFrame / (phaseState?.frameRate ?? 10)) * 1000)} / {formatTime((frameCount / (phaseState?.frameRate ?? 10)) * 1000)}
            </span>

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            <span style={{ fontSize: 11, color: '#64748b' }}>{t('dicom4d.speed', 'Speed')}:</span>
            {[0.5, 1, 2, 4].map(v => (
              <button key={v} style={speed === v ? activeBtnStyle : btnStyle} onClick={() => setSpeed(v)}>
                {v}x
              </button>
            ))}

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            <RotateCcw size={12} color={loop ? BLUE : '#64748b'} />
            <Switch
              size="small"
              checked={loop}
              onChange={setLoop}
              checkedChildren={t('dicom4d.loop', 'Loop')}
              unCheckedChildren={t('dicom4d.loopOff', 'Off')}
            />
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
            background: PANEL_BG, borderRadius: 4, padding: '4px 12px',
          }}>
            <span style={{ fontSize: 10, color: '#64748b', minWidth: 30 }}>帧</span>
            <Slider
              min={0}
              max={Math.max(0, frameCount - 1)}
              value={currentFrame}
              onChange={(v) => { setCurrentFrame(v); setPlaying(false) }}
              style={{ flex: 1, margin: '0 4px' }}
              tooltip={{ formatter: (v: number | undefined) => `${v ?? 0} / ${frameCount - 1}` }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 40, textAlign: 'right' }}>
              {currentFrame + 1} / {frameCount}
            </span>
          </div>
        </div>

        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                <Heart size={12} style={{ marginRight: 4, color: '#ef4444' }} />
                {t('dicom4d.cardiacPhase', 'Cardiac Phase')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <span>{t('dicom4d.phase', 'Phase')}</span>
                <span style={{ color: '#facc15', fontWeight: 600 }}>{cardiacPhase}%</span>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 4, height: 12, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${cardiacPhase}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #ef4444)',
                  borderRadius: 4, transition: 'width 0.05s linear',
                }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('dicom4d.systole', 'Systole')}</span>
                <span>{t('dicom4d.diastole', 'Diastole')}</span>
              </div>
              <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i * 5 <= cardiacPhase ? '#ef4444' : '#1e293b',
                    transition: 'background 0.05s linear',
                  }} />
                ))}
              </div>
            </div>
          </Card>

          <Card
            size="small"
            title={
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                <Activity size={12} style={{ marginRight: 4, color: '#60a5fa' }} />
                {t('dicom4d.respiratoryPhase', 'Respiratory Phase')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <span>{t('dicom4d.phase', 'Phase')}</span>
                <span style={{ color: '#60a5fa', fontWeight: 600 }}>{respiratoryPhase}%</span>
              </div>
              <div style={{ background: '#1e293b', borderRadius: 4, height: 12, overflow: 'hidden', position: 'relative' }}>
                <div style={{
                  width: `${respiratoryPhase}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                  borderRadius: 4, transition: 'width 0.05s linear',
                }} />
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#475569' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{t('dicom4d.inspiration', 'Inspiration')}</span>
                <span>{t('dicom4d.expiration', 'Expiration')}</span>
              </div>
              <div style={{ display: 'flex', gap: 2, marginTop: 4 }}>
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} style={{
                    flex: 1, height: 4, borderRadius: 2,
                    background: i * 5 <= respiratoryPhase ? '#60a5fa' : '#1e293b',
                    transition: 'background 0.05s linear',
                  }} />
                ))}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
