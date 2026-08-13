import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Activity, Heart, Play, Pause, SkipBack, SkipForward, RotateCcw, Clock, Zap } from 'lucide-react'
import { Select, Card, Slider, Tag, message } from 'antd'
import { dicom4dApi, type Series4D } from '../../services/api/dicomApi'

interface PhaseState {
  cardiacPhase: number
  respiratoryPhase: number
  frames: Array<{ frameIndex: number; timestamp: string; phase: number; dataUrl: string }>
  frameRate: number
  cardiacCycleMs: number
  respiratoryCycleMs: number
}

type LoopMode = 'once' | 'loop' | 'pingpong'

const LOOP_LABELS: Record<LoopMode, string> = {
  once: '单次',
  loop: '循环',
  pingpong: '往返',
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
            }))
      const effectiveRate = synthFrames.length > 0 && synthFrames[0]?.timestamp && synthFrames[1]?.timestamp
        ? Math.max(1, Math.min(8, Math.round(1000 / Math.max(1, new Date(synthFrames[1].timestamp).getTime() - new Date(synthFrames[0].timestamp).getTime()))))
        : Math.max(1, Math.min(8, frameRate))
      const phaseMeta = phaseRes.success ? phaseRes.data : null
      setPhaseState({
        frames: synthFrames,
        frameRate: effectiveRate,
        cardiacPhase: phaseMeta?.cardiacPhase ?? 0,
        respiratoryPhase: phaseMeta?.respiratoryPhase ?? 0,
        cardiacCycleMs: phaseMeta?.cardiacCycleMs ?? 800,
        respiratoryCycleMs: phaseMeta?.respiratoryCycleMs ?? 4000,
      })
      setCurrentFrame(0)
      setCardiacPhase(phaseMeta?.cardiacPhase ?? 0)
      setRespiratoryPhase(phaseMeta?.respiratoryPhase ?? 0)
      setFps(effectiveRate)
      setPlaying(false)
      setSyntheticFrames(!usable)
    } catch {
      message.warning(t('dicom4d.loadError', '4D 序列加载失败') + ' — 已回退合成帧')
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
      }))
      setPhaseState({
        frames: synthFrames,
        frameRate,
        cardiacPhase: 0,
        respiratoryPhase: 0,
        cardiacCycleMs: 800,
        respiratoryCycleMs: 4000,
      })
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
        const p = frame / Math.max(1, frameCount)
        setCardiacPhase(Math.round(Math.sin(p * Math.PI * 2 * 3) * 0.5 + 0.5) * 100)
        setRespiratoryPhase(Math.round(Math.sin(p * Math.PI * 2 * 0.75) * 0.5 + 0.5) * 100)
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

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <style>{`@keyframes g005-frame-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.2; } }`}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <Activity size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('dicom4d.title', '4D 动态成像')}</span>
        {syntheticFrames && (
          <Tag color="orange" style={{ marginLeft: 8 }}>{t('dicom4d.synthetic', '合成帧 (数据缺失回退)')}</Tag>
        )}
      </div>

      <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>
              {t('dicom4d.series', '4D 序列')}:
            </span>
            <Select
              value={selectedUid || undefined}
              onChange={setSelectedUid}
              placeholder={t('dicom4d.selectSeries', '选择 4D 序列')}
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

            {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 播放速度 fps 滑杆 (1-8) */}
            <Zap size={12} color="#64748b" />
            <span style={{ fontSize: 11, color: '#94a3b8' }}>{fps} fps</span>
            <Slider
              min={1}
              max={8}
              value={fps}
              onChange={(v) => setFps(v)}
              style={{ width: 120, margin: '0 4px' }}
              tooltip={{ formatter: (v: number | undefined) => `${v ?? 0} fps` }}
            />

            <div style={{ width: 1, height: 20, background: '#334155' }} />

            {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 循环模式: 单次/循环/往返 */}
            <RotateCcw size={12} color={loopMode === 'loop' ? BLUE : '#64748b'} />
            <span style={{ fontSize: 11, color: '#64748b' }}>{t('dicom4d.loop', '循环')}:</span>
            {(['once', 'loop', 'pingpong'] as LoopMode[]).map(m => (
              <button
                key={m}
                style={loopMode === m ? activeBtnStyle : btnStyle}
                onClick={() => setLoopMode(m)}
                aria-label={LOOP_LABELS[m]}
              >
                {LOOP_LABELS[m]}
              </button>
            ))}
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
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 40, textAlign: 'right', ...frameBlink }}>
              {currentFrame + 1} / {frameCount}
            </span>
          </div>

          {/* [G005 v3.0.6.11-91 Wave 4B (PACS P1 G-07)] 心动周期门控标记: 时间轴分段着色 */}
          {showCardiac && cardiacSegments.length > 0 && (
            <div style={{ marginTop: 4, background: PANEL_BG, borderRadius: 4, padding: '6px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 10, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Heart size={10} color="#ef4444" />
                  心动周期门控
                </span>
                <span style={{ display: 'flex', gap: 10, fontSize: 10, color: '#94a3b8' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#ef4444', borderRadius: 2, marginRight: 4 }} />收缩期</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#3b82f6', borderRadius: 2, marginRight: 4 }} />舒张期</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 1 }}>
                {cardiacSegments.map(seg => (
                  <div
                    key={seg.frame}
                    title={`帧 ${seg.frame + 1}: ${seg.systole ? '收缩期' : '舒张期'}`}
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
                  呼吸门控
                </span>
                <span style={{ display: 'flex', gap: 10, fontSize: 10, color: '#94a3b8' }}>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#22c55e', borderRadius: 2, marginRight: 4 }} />吸气</span>
                  <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: 2, marginRight: 4 }} />呼气</span>
                </span>
              </div>
              <div style={{ display: 'flex', gap: 1 }}>
                {respiratorySegments.map(seg => (
                  <div
                    key={seg.frame}
                    title={`帧 ${seg.frame + 1}: ${seg.inspiration ? '吸气' : '呼气'}`}
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
                {t('dicom4d.cardiacPhase', '心脏相位')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <span>{t('dicom4d.phase', '相位')}</span>
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
                <span>{t('dicom4d.systole', '收缩期')}</span>
                <span>{t('dicom4d.diastole', '舒张期')}</span>
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
                {t('dicom4d.respiratoryPhase', '呼吸相位')}
              </span>
            }
            style={{ background: PANEL_BG, border: '1px solid #334155' }}
            headStyle={{ borderBottom: '1px solid #334155', padding: '6px 10px', minHeight: 0 }}
            bodyStyle={{ padding: '10px' }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginBottom: 2 }}>
                <span>{t('dicom4d.phase', '相位')}</span>
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
                <span>{t('dicom4d.inspiration', '吸气')}</span>
                <span>{t('dicom4d.expiration', '呼气')}</span>
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
