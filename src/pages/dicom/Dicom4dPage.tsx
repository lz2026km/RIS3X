import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Activity, Heart, Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, Zap, BarChart3, TrendingUp } from 'lucide-react'
import { Select, Card, Slider, Tag, message } from 'antd'
import { dicom4dApi, type Series4D, type PhaseInfoDetail4D, type MovieData4D } from '../../services/api/dicomApi'
import { t } from '../../i18n/appI18n'

interface PhaseState {
  cardiacPhase: number
  respiratoryPhase: number
  frames: Array<{ frameIndex: number; timestamp: string; phase: number; dataUrl: string; cardiacPhase?: number; respiratoryPhase?: number }>
  frameRate: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
}

type LoopMode = 'once' | 'loop' | 'pingpong'

const LOOP_LABEL_KEYS: Record<LoopMode, string> = {
  once: 'w9d.dicom4d.loopOnce',
  loop: 'w9d.dicom4d.loopLoop',
  pingpong: 'w9d.dicom4d.loopPingpong',
}

/** 仅加载可用的帧图 URL (/api/v1 或完整 http(s)), 否则走合成帧回退 (避免 500 资源错误) */
function isUsableFrameUrl(url: string): boolean {
  if (!url) return false
  return url.startsWith('/api/v1') || /^https?:\/\//i.test(url)
}

/** 心动周期门控分段: 收缩期占周期 ~40% */
function systoleRatio(phase: number): boolean {
  return phase < 0.4
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
  ctx.fillText('', w / 2, h / 2)
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

/** [G-07] 相位曲线图 (SVG polyline): cardiac/respiratory 相位随帧变化 */
function PhaseCurveChart(props: {
  frames: PhaseState['frames']
  frameRate: number
  currentFrame: number
  showCardiac: boolean
  showRespiratory: boolean
}) {
  const { frames, frameRate, currentFrame, showCardiac, showRespiratory } = props
  const n = Math.max(2, frames.length)
  const w = 560
  const h = 120
  const pad = 4

  const points = (pick: (f: PhaseState['frames'][number]) => number) => {
    return frames
      .map((f, i) => {
        const x = pad + (i / (n - 1)) * (w - pad * 2)
        const y = h - pad - (pick(f) / 100) * (h - pad * 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  }

  const cardiacPts = points((f) => ((f.cardiacPhase ?? 0) / 19) * 100)
  const respiratoryPts = points((f) => ((f.respiratoryPhase ?? 0) / 9) * 100)
  const cx = pad + (currentFrame / Math.max(1, n - 1)) * (w - pad * 2)

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }} preserveAspectRatio="none">
      <line x1={cx} y1={0} x2={cx} y2={h} stroke="#facc15" strokeWidth={1} strokeDasharray="3 2" />
      {showCardiac && <polyline points={cardiacPts} fill="none" stroke="#ef4444" strokeWidth={1.5} />}
      {showRespiratory && <polyline points={respiratoryPts} fill="none" stroke="#60a5fa" strokeWidth={1.5} />}
      <text x={w - 2} y={10} fontSize={8} fill="#ef4444" textAnchor="end">cardiac</text>
      {showRespiratory && <text x={w - 2} y={20} fontSize={8} fill="#60a5fa" textAnchor="end">respiratory</text>}
      <text x={pad} y={h - 2} fontSize={8} fill="#64748b">0</text>
      <text x={w - pad - 18} y={h - 2} fontSize={8} fill="#64748b">{Math.round(((n - 1) / frameRate) * 1000)}ms</text>
    </svg>
  )
}

/** [G-07] 相位分布条形图 (20/10 bin, 含空 bin) */
function PhaseDistributionBars(props: {
  bins: Array<{ phase: number; count: number }>
  maxCount: number
  color: string
  label: string
}) {
  const { bins, maxCount, color, label } = props
  if (bins.length === 0) return null
  return (
    <div style={{ marginTop: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}>
        <span style={{ fontSize: 10, color: '#64748b' }}>{label}</span>
        <span style={{ fontSize: 10, color: '#475569' }}>{t('w9d.dicom4d.phaseCount', { count: bins.length })}</span>
      </div>
      <div style={{ display: 'flex', gap: 1, alignItems: 'flex-end', height: 34 }}>
        {bins.map((b) => (
          <div
            key={b.phase}
            title={`${label} ${t('w9d.dicom4d.phase')} ${b.phase}: ${b.count} ${t('w9d.dicom4d.frames')}`}
            style={{
              flex: 1,
              height: maxCount > 0 ? `${Math.max(6, Math.round((b.count / maxCount) * 100))}%` : '8%',
              background: b.count > 0 ? color : '#334155',
              borderRadius: 1,
              opacity: b.count > 0 ? 1 : 0.4,
            }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Dicom4dPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)

  const [seriesList, setSeriesList] = useState<Series4D[]>([])
  const [selectedUid, setSelectedUid] = useState<string>('')
  const [phaseState, setPhaseState] = useState<PhaseState | null>(null)
  const [playing, setPlaying] = useState(false)
  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 播放速度 fps 滑杆 (1-8) + 循环模式 (单次/循环/往返)
  const [fps, setFps] = useState(5)
  const [loopMode, setLoopMode] = useState<LoopMode>('loop')
  const [currentFrame, setCurrentFrame] = useState(0)
  const [cardiacPhase, setCardiacPhase] = useState(0)
  const [respiratoryPhase, setRespiratoryPhase] = useState(0)
  const [loading, setLoading] = useState(false)
  const [seriesLoadError, setSeriesLoadError] = useState<string | null>(null)
  const [frameImages, setFrameImages] = useState<Record<number, HTMLImageElement>>({})
  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 合成帧回退标注 (帧数据缺失)
  const [syntheticFrames, setSyntheticFrames] = useState(false)
  // [G005 v3.0.6.11-101 Wave 1B (G-07)] 真实帧源: 时相分布 + 电影渲染数据 (真实数据驱动)
  const [phaseDetail, setPhaseDetail] = useState<PhaseInfoDetail4D | null>(null)
  const [movieData, setMovieData] = useState<MovieData4D | null>(null)

  const currentFrameDataUrl = phaseState?.frames[currentFrame]?.dataUrl || ''

  // 有效帧图才加载, 缺失/不可用 → 合成帧回退 (避免 500 资源错误 + 标注)
  useEffect(() => {
    if (!currentFrameDataUrl || frameImages[currentFrame]) return
    if (!isUsableFrameUrl(currentFrameDataUrl)) return
    const img = new Image()
    img.onload = () => setFrameImages(prev => ({ ...prev, [currentFrame]: img }))
    img.onerror = () => { /* 加载失败 → 合成帧回退 */ }
    img.src = currentFrameDataUrl
  }, [currentFrameDataUrl, currentFrame, frameImages])

  useEffect(() => {
    let cancelled = false
    dicom4dApi.list().then(res => {
      if (cancelled) return
      if (res.success && Array.isArray(res.data)) {
        setSeriesList(res.data)
        if (res.data.length > 0) setSelectedUid(res.data[0]?.seriesUid ?? '')
        setSeriesLoadError(null)
      } else {
        setSeriesLoadError(t('w9d.dicom4d.listLoadFailed'))
      }
    })
    return () => { cancelled = true }
  }, [])

  const loadSeries = useCallback(async (uid: string) => {
    if (!uid) return
    setLoading(true)
    try {
      const [framesRes, phaseRes, detailRes, movieRes] = await Promise.all([
        dicom4dApi.frames(uid),
        dicom4dApi.phase(uid),
        dicom4dApi.phaseInfo(uid),
        dicom4dApi.movie(uid),
      ])
      const s = seriesList.find(x => x.seriesUid === uid)
      const frameCount = s?.frameCount ?? 32
      const frameRate = s?.frameRate ?? 10
      const intervalMs = 1000 / frameRate
      const frames = framesRes.success ? (framesRes.data || []) : []
      // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 数据缺失 → 合成帧回退 (canvas 生成 + 标注)
      const usable = frames.length > 0 && frames.some(f => isUsableFrameUrl(f.dataUrl ?? ''))
      const synthFrames = usable
        ? frames
        : frames.length > 0
          ? frames.map(f => ({ ...f, dataUrl: '' }))
          : Array.from({ length: Math.max(1, frameCount) }, (_, i) => ({
              frameIndex: i,
              timestamp: new Date(Date.now() + i * intervalMs).toISOString(),
              phase: Math.round((i / Math.max(1, frameCount)) * 100),
              dataUrl: '',
              cardiacPhase: Math.round((i / Math.max(1, frameCount)) * 19),
              respiratoryPhase: Math.round((i / Math.max(1, frameCount)) * 9),
            }))
      const effectiveRate = synthFrames.length > 0 && synthFrames[0]?.timestamp && synthFrames[1]?.timestamp
        ? Math.max(1, Math.min(30, Math.round(1000 / Math.max(1, new Date(synthFrames[1].timestamp).getTime() - new Date(synthFrames[0].timestamp).getTime()))))
        : Math.max(1, Math.min(30, frameRate))
      const phaseMeta = phaseRes.success ? phaseRes.data : null
      // [G-07] 真实数据驱动: 帧级相位来自后端 phase 派生, 缺失时用周期推算
      const withPhases = synthFrames.map((f, i) => {
        const cp = f.cardiacPhase ?? Math.round((i / Math.max(1, synthFrames.length)) * 19)
        const rp = f.respiratoryPhase ?? Math.round((i / Math.max(1, synthFrames.length)) * 9)
        return { ...f, cardiacPhase: cp, respiratoryPhase: rp }
      })
      setPhaseState({
        frames: withPhases,
        frameRate: effectiveRate,
        cardiacPhase: phaseMeta?.cardiacPhase ?? 0,
        respiratoryPhase: phaseMeta?.respiratoryPhase ?? 0,
        cardiacCycleMs: phaseMeta?.cardiacCycleMs ?? 800,
        respiratoryCycleMs: phaseMeta?.respiratoryCycleMs ?? 4000,
      })
      setPhaseDetail(detailRes.success ? detailRes.data : null)
      setMovieData(movieRes.success ? movieRes.data : null)
      setCurrentFrame(0)
      setCardiacPhase(phaseMeta?.cardiacPhase ?? 0)
      setRespiratoryPhase(phaseMeta?.respiratoryPhase ?? 0)
      setFps(Math.min(8, effectiveRate))
      setPlaying(false)
      setSyntheticFrames(!usable)
    } catch {
      message.warning(t('dicom4d.loadError') + ' — ' + t('w9d.dicom4d.fallbackSynthetic'))
      // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 请求异常 → 合成帧 + 标注
      const s = seriesList.find(x => x.seriesUid === uid)
      const frameCount = s?.frameCount ?? 32
      const frameRate = Math.max(1, Math.min(8, s?.frameRate ?? 10))
      const intervalMs = 1000 / frameRate
      const synthFrames = Array.from({ length: Math.max(1, frameCount) }, (_, i) => ({
        frameIndex: i,
        timestamp: new Date(Date.now() + i * intervalMs).toISOString(),
        phase: Math.round((i / Math.max(1, frameCount)) * 100),
        dataUrl: '',
        cardiacPhase: Math.round((i / Math.max(1, frameCount)) * 19),
        respiratoryPhase: Math.round((i / Math.max(1, frameCount)) * 9),
      }))
      setPhaseState({
        frames: synthFrames,
        frameRate,
        cardiacPhase: 0,
        respiratoryPhase: 0,
        cardiacCycleMs: 800,
        respiratoryCycleMs: 4000,
      })
      setPhaseDetail(null)
      setMovieData(null)
      setCurrentFrame(0)
      setCardiacPhase(0)
      setRespiratoryPhase(0)
      setFps(frameRate)
      setPlaying(false)
      setSyntheticFrames(true)
    } finally {
      setLoading(false)
    }
  }, [t, seriesList])

  useEffect(() => {
    if (selectedUid) loadSeries(selectedUid)
  }, [selectedUid, loadSeries])

  const frameCount = phaseState?.frames.length ?? 0

  useEffect(() => {
    if (!playing || frameCount === 0) return
    const intervalMs = 1000 / fps
    let last = performance.now()
    let frame = currentFrame
    let dir = 1
    let stopped = false

    function tick(now: number) {
      const elapsed = now - last
      if (elapsed >= intervalMs) {
        const advance = Math.floor(elapsed / intervalMs)
        last = now - (elapsed % intervalMs)
        for (let a = 0; a < advance && !stopped; a++) {
          if (loopMode === 'pingpong') {
            frame += dir
            if (frame >= frameCount - 1) { frame = frameCount - 1; dir = -1 }
            else if (frame <= 0) { frame = 0; dir = 1 }
          } else {
            frame += 1
            if (frame >= frameCount) {
              if (loopMode === 'loop') frame = 0
              else { frame = frameCount - 1; stopped = true; setPlaying(false) }
            }
          }
        }
        setCurrentFrame(frame)
        const f = phaseState?.frames[frame]
        // [G-07] 真实数据驱动: 帧级相位直接取后端派生值
        const p = frame / Math.max(1, frameCount)
        setCardiacPhase(f?.cardiacPhase ?? Math.round(Math.sin(p * Math.PI * 2 * 3) * 0.5 + 0.5) * 100)
        setRespiratoryPhase(f?.respiratoryPhase ?? Math.round(Math.sin(p * Math.PI * 2 * 0.75) * 0.5 + 0.5) * 100)
      }
      if (!stopped) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, frameCount, fps, loopMode, phaseState, currentFrame])

  const selectedSeries = seriesList.find(s => s.seriesUid === selectedUid)
  const gatingType = selectedSeries?.gatingType ?? 'cardiac'
  const showCardiac = gatingType === 'cardiac' || gatingType === 'both'
  const showRespiratory = gatingType === 'respiratory' || gatingType === 'both'

  // [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 心动周期/呼吸周期门控分段 (按帧索引着色)
  const cardiacSegments = useMemo(() => {
    if (!phaseState || frameCount === 0 || !showCardiac) return []
    const cycleMs = phaseState.cardiacCycleMs > 0 ? phaseState.cardiacCycleMs : 800
    const intervalMs = 1000 / (phaseState.frameRate || 10)
    return Array.from({ length: frameCount }, (_, i) => {
      const p = ((i * intervalMs) % cycleMs) / cycleMs
      return { frame: i, systole: systoleRatio(p) }
    })
  }, [phaseState, frameCount, showCardiac])

  const respiratorySegments = useMemo(() => {
    if (!phaseState || frameCount === 0 || !showRespiratory) return []
    const cycleMs = phaseState.respiratoryCycleMs > 0 ? phaseState.respiratoryCycleMs : 4000
    const intervalMs = 1000 / (phaseState.frameRate || 10)
    return Array.from({ length: frameCount }, (_, i) => {
      const p = ((i * intervalMs) % cycleMs) / cycleMs
      return { frame: i, inspiration: p < 0.5 }
    })
  }, [phaseState, frameCount, showRespiratory])

  // [G-07] 相位分布 (来自 phase-info 端点, 真实数据)
  const distBins = useMemo(() => {
    const dist = phaseDetail?.distribution
    if (!dist) return null
    const cardiacMax = Math.max(1, ...dist.cardiac.map(b => b.count))
    const respiratoryMax = Math.max(1, ...dist.respiratory.map(b => b.count))
    return {
      cardiac: dist.cardiac,
      respiratory: dist.respiratory,
      cardiacMax,
      respiratoryMax,
    }
  }, [phaseDetail])

  const frameBlink = playing
    ? { animation: 'g005-frame-blink 0.6s steps(2, start) infinite' }
    : undefined

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

  const phaseCurveFrames = phaseState?.frames ?? []
  const currentFrameData = phaseState?.frames[currentFrame]

  return (
    <div style={{ background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <style>{`@keyframes g005-frame-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Activity size={18} color={BLUE} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{t('dicom4d.title')}</span>
        {syntheticFrames && (
          <Tag color="orange" style={{ marginLeft: 8 }}>{t('w9d.dicom4d.syntheticTag')}</Tag>
        )}
        {!syntheticFrames && phaseState && (
          <Tag color="green" style={{ marginLeft: 8 }}>{t('w9d.dicom4d.realFrameSource')}</Tag>
        )}
      </div>

      <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {t('dicom4d.series')}:
            </span>
            <Select
              value={selectedUid || undefined}
              onChange={setSelectedUid}
              placeholder={t('dicom4d.selectSeries')}
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
            <span style={{ fontSize: 11, color: '#f87171' }}>{seriesLoadError}</span>
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
              aria-label={t('w9d.dicom4d.firstFrame')}
            >
              <SkipBack size={14} />
            </button>
            <button
              style={playing ? activeBtnStyle : btnStyle}
              onClick={() => setPlaying(v => !v)}
              disabled={frameCount === 0}
              aria-label={playing ? t('w9d.dicom4d.pause') : t('w9d.dicom4d.play')}
            >
              {playing ? <Pause size={14} /> : <Play size={14} />}
            </button>
            <button
              style={currentFrame >= frameCount - 1 ? { ...btnStyle, opacity: 0.4 } : btnStyle}
              disabled={currentFrame >= frameCount - 1}
              onClick={() => { setCurrentFrame(f => Math.min(frameCount - 1, f + 1)); setPlaying(false) }}
              aria-label={t('w9d.dicom4d.nextFrame')}
            >
              <SkipForward size={14} />
            </button>

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            <Clock size={12} color="#64748b" />
            <span style={{ fontSize: 11, color: '#94a3b8', minWidth: 60 }}>
              {formatTime((currentFrame / (phaseState?.frameRate ?? 10)) * 1000)} / {formatTime((frameCount / (phaseState?.frameRate ?? 10)) * 1000)}
            </span>

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 播放速度 fps 滑杆 (1-8) */}
            <Zap size={12} color="#64748b" />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{fps} fps</span>
            <Slider
              min={1}
              max={Math.max(1, Math.min(30, phaseState?.frameRate ?? 8))}
              value={fps}
              onChange={(v) => setFps(v)}
              style={{ width: 120, margin: '0 4px' }}
              tooltip={{ formatter: (v: number | undefined) => `${v ?? 0} fps` }}
            />

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 循环模式: 单次/循环/往返 */}
            <RotateCcw size={12} color={loopMode === 'loop' ? BLUE : '#64748b'} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{t('dicom4d.loop')}:</span>
            {(['once', 'loop', 'pingpong'] as LoopMode[]).map(m => (
              <button
                key={m}
                style={loopMode === m ? activeBtnStyle : btnStyle}
                onClick={() => setLoopMode(m)}
                aria-label={t(LOOP_LABEL_KEYS[m])}
              >
                {t(LOOP_LABEL_KEYS[m])}
              </button>
            ))}
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, marginTop: 4,
            background: PANEL_BG, borderRadius: 4, padding: '4px 12px',
          }}>
            <span style={{ fontSize: 10, color: '#64748b', minWidth: 30 }}>{t('w9d.dicom4d.frame')}</span>
            <Slider
              min={0}
              max={Math.max(0, frameCount - 1)}
              value={currentFrame}
              onChange={(v) => { setCurrentFrame(v); setPlaying(false) }}
              style={{ flex: 1, margin: '0 4px' }}
              tooltip={{ formatter: (v: number | undefined) => `${v ?? 0} / ${frameCount - 1}` }}
            />
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 40, textAlign: 'right', ...frameBlink }}>
              {currentFrame + 1} / {frameCount}
            </span>
            {currentFrameData && (
              <span style={{ fontSize: 10, color: '#64748b', minWidth: 60, textAlign: 'right' }}>
                {(currentFrameData as { sopInstanceUid?: string }).sopInstanceUid
                  ? `sop:${(currentFrameData as { sopInstanceUid?: string }).sopInstanceUid?.slice(-8)}`
                  : ''}
              </span>
            )}
          </div>

          {/* [G-07] 相位曲线图 (真实帧相位驱动) */}
          {phaseCurveFrames.length > 1 && (
            <div style={{ marginTop: 4, background: PANEL_BG, borderRadius: 4, padding: '6px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <TrendingUp size={11} color="#facc15" />
                <span style={{ fontSize: 10, color: '#64748b' }}>{t('w9d.dicom4d.phaseCurve')}</span>
                {movieData && (
                  <span style={{ fontSize: 10, color: '#475569', marginLeft: 'auto' }}>
                    {movieData.interpolationMode === 'linear' ? t('w9d.dicom4d.interpLinear', { count: movieData.interpolatedFrames }) : t('w9d.dicom4d.interpBinned', { count: movieData.framesPerPhase })}
                  </span>
                )}
              </div>
              <div style={{ height: 110 }}>
                <PhaseCurveChart
                  frames={phaseCurveFrames}
                  frameRate={phaseState?.frameRate ?? 10}
                  currentFrame={currentFrame}
                  showCardiac={showCardiac}
                  showRespiratory={showRespiratory}
                />
              </div>
            </div>
          )}

          {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 心动周期门控标记: 时间轴分段着色 */}
          {showCardiac && cardiacSegments.length > 0 && (
            <div style={{ marginTop: 4, background: PANEL_BG, borderRadius: 4, padding: '6px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={10} color="#ef4444" />
                  {t('w9d.dicom4d.cardiacGating')}
                </span>
                <span style={{ display: 'flex', gap: 10, fontSize: 10, color: '#94a3b8' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />{t('dicom4d.systole')}</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#3b82f6', borderRadius: 2, marginRight: 4 }} />{t('dicom4d.diastole')}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 1 }}>
                {cardiacSegments.map(seg => (
                  <div
                    key={seg.frame}
                    title={t('w9d.dicom4d.frameStatus', { frame: seg.frame + 1, status: seg.systole ? t('dicom4d.systole') : t('dicom4d.diastole') })}
                    style={{
                      flex: 1, height: 8, borderRadius: 1,
                      background: seg.systole ? '#ef4444' : '#3b82f6',
                      outline: seg.frame === currentFrame ? '1px solid #facc15' : 'none',
                      outlineOffset: seg.frame === currentFrame ? 1 : 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 呼吸门控标记 */}
          {showRespiratory && respiratorySegments.length > 0 && (
            <div style={{ marginTop: 4, background: PANEL_BG, borderRadius: 4, padding: '6px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Activity size={10} color="#60a5fa" />
                  {t('w9d.dicom4d.respiratoryGating')}
                </span>
                <span style={{ display: 'flex', gap: 10, fontSize: 10, color: '#94a3b8' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#22c55e', borderRadius: 2, marginRight: 4 }} />{t('dicom4d.inspiration')}</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />{t('dicom4d.expiration')}</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 1 }}>
                {respiratorySegments.map(seg => (
                  <div
                    key={seg.frame}
                    title={t('w9d.dicom4d.frameStatus', { frame: seg.frame + 1, status: seg.inspiration ? t('dicom4d.inspiration') : t('dicom4d.expiration') })}
                    style={{
                      flex: 1, height: 8, borderRadius: 1,
                      background: seg.inspiration ? '#22c55e' : '#f59e0b',
                      outline: seg.frame === currentFrame ? '1px solid #facc15' : 'none',
                      outlineOffset: seg.frame === currentFrame ? 1 : 0,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ width: 280, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Card
            size="small"
            title={
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                <Heart size={12} style={{ marginRight: 4, color: '#ef4444' }} />
                {t('dicom4d.cardiacPhase')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <span>                {t('dicom4d.phase')}</span>
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
                <span>{t('dicom4d.systole')}</span>
                <span>{t('dicom4d.diastole')}</span>
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
                {t('dicom4d.respiratoryPhase')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <span>                {t('dicom4d.phase')}</span>
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
                <span>{t('dicom4d.inspiration')}</span>
                <span>{t('dicom4d.expiration')}</span>
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

          {/* [G-07] 时相分布 (phase-info 真实数据) */}
          <Card
            size="small"
            title={
              <span style={{ fontSize: 12, color: '#94a3b8' }}>
                <BarChart3 size={12} style={{ marginRight: 4, color: '#facc15' }} />
                {t('w9d.dicom4d.phaseDistribution')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            {distBins ? (
              <>
                {showCardiac && (
                  <PhaseDistributionBars bins={distBins.cardiac} maxCount={distBins.cardiacMax} color="#ef4444" label="cardiac 0-19" />
                )}
                {showRespiratory && (
                  <PhaseDistributionBars bins={distBins.respiratory} maxCount={distBins.respiratoryMax} color="#60a5fa" label="respiratory 0-9" />
                )}
                <div style={{ fontSize: 10, color: '#475569', marginTop: 6 }}>
                  {t('w9d.dicom4d.phaseSummary', { frames: distBins.cardiac.reduce((s, b) => s + b.count, 0), total: phaseDetail?.distribution?.totalFrames ?? 0 })}
                  {phaseDetail && t('w9d.dicom4d.cycleSummary', { cardiac: phaseDetail.cardiacCycleMs, respiratory: phaseDetail.respiratoryCycleMs })}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 10, color: '#475569' }}>{t('w9d.dicom4d.phaseDistributionUnavailable')}</div>
            )}
          </Card>

          {/* [G-07] 电影渲染数据: 心电/RR 间期 (movie 端点真实数据) */}
          {movieData && (
            <Card
              size="small"
              title={
                <span style={{ fontSize: 12, color: '#94a3b8' }}>
                  <TrendingUp size={12} style={{ marginRight: 4, color: '#22c55e' }} />
                  {t('w9d.dicom4d.ecgRrInterval')}
                </span>
              }
              style={{ background: PANEL_BG, border: '1px solid #334155' }}
              headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
              bodyStyle={{ padding: '10px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginBottom: 6 }}>
                <span>{t('w9d.dicom4d.heartRate')} <b style={{ color: '#22c55e' }}>{movieData.bpm}</b> bpm</span>
                <span>{t('w9d.dicom4d.cycle')} {Math.round(movieData.cycleMs)} ms</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 40, marginBottom: 4 }}>
                {movieData.rrIntervals.map((rr, i) => {
                  const min = Math.min(...movieData.rrIntervals)
                  const max = Math.max(...movieData.rrIntervals)
                  const hPx = max > min ? 8 + ((rr - min) / (max - min)) * 28 : 20
                  return (
                    <div
                      key={i}
                      title={`RR#${i + 1}: ${rr} ms`}
                      style={{ flex: 1, background: '#22c55e', borderRadius: 1, height: hPx, opacity: 0.85 }}
                    />
                  )
                })}
              </div>
              <div style={{ fontSize: 10, color: '#475569' }}>
                {movieData.interpolationMode} · {movieData.framesPerPhase} {t('w9d.dicom4d.framesPerPhase')} · {movieData.phaseSequence.length} {t('w9d.dicom4d.frameSequence')}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
