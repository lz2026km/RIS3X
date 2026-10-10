import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Slider, Tag, Select, Spin, Alert, Segmented, Button, message, Modal, InputNumber, Checkbox, Divider } from 'antd'
import { Layers, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Maximize, Crosshair, ScanLine, GitCompareArrows, Sparkles, FileText } from 'lucide-react'
import { dbtApi, type DbtStudyDto, type DbtSliceDto, type DbtCompareResultDto, type DbtReconstructResultDto, type DbtBiradsScoreResultDto, type DbtBiradsScoreDto, type DbtBiradsCalcificationDto, type DbtBiradsMassDto } from '../../services/api/dbtApi'
import { t } from '../../i18n/appI18n'

const BLUE = 'var(--color-primary-500)'
const GREEN = 'var(--color-success-500)'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'
const SIZE = 512

interface Marker {
  id: string
  x: number
  y: number
  w: number
  h: number
  auto: boolean
}

const btnStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid #334155', color: 'var(--text-muted, #94a3b8)',
  borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
}
const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }

// ────────────────────────────────────────────────────────────────────────────
// 像素工具
// ────────────────────────────────────────────────────────────────────────────

function decodeRaw16(base64: string, signed: boolean): Int16Array {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  const data = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 2)
  if (signed) return data
  const out = new Int16Array(data.length)
  for (let i = 0; i < data.length; i++) out[i] = (data[i]! & 0xffff) > 32767 ? (data[i]! & 0xffff) - 65536 : (data[i]! & 0xffff)
  return out
}

function detectMicrocalcifications(data: Int16Array, w: number, h: number, ww: number, wl: number): Marker[] {
  const threshold = wl + ww * 0.55
  const visited = new Uint8Array(w * h)
  const boxes: Marker[] = []
  const stack: number[] = []
  let markerSeq = 0
  for (let i = 0; i < w * h; i++) {
    if (visited[i] || data[i]! < threshold) continue
    let minX = i % w, maxX = minX
    let minY = (i / w) | 0, maxY = minY
    let count = 0
    stack.length = 0
    stack.push(i)
    visited[i] = 1
    while (stack.length > 0) {
      const p = stack.pop()!
      const px = p % w
      const py = (p / w) | 0
      count++
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
      if (px > 0 && !visited[p - 1] && data[p - 1]! >= threshold) { visited[p - 1] = 1; stack.push(p - 1) }
      if (px < w - 1 && !visited[p + 1] && data[p + 1]! >= threshold) { visited[p + 1] = 1; stack.push(p + 1) }
      if (py > 0 && !visited[p - w] && data[p - w]! >= threshold) { visited[p - w] = 1; stack.push(p - w) }
      if (py < h - 1 && !visited[p + w] && data[p + w]! >= threshold) { visited[p + w] = 1; stack.push(p + w) }
    }
    const bw = maxX - minX + 1
    const bh = maxY - minY + 1
    if (count >= 2 && count <= 120 && bw <= 24 && bh <= 24) {
      boxes.push({ id: `mc-auto-${markerSeq++}`, x: minX, y: minY, w: bw, h: bh, auto: true })
    }
  }
  return boxes
}

function applyWindow(data: Int16Array, w: number, h: number, ww: number, wl: number): ImageData {
  const img = new ImageData(w, h)
  const min = wl - ww / 2
  const max = wl + ww / 2
  const range = Math.max(1, max - min)
  for (let i = 0; i < w * h; i++) {
    let v = ((data[i]! - min) / range) * 255
    v = v < 0 ? 0 : v > 255 ? 255 : v
    const o = i * 4
    img.data[o] = v
    img.data[o + 1] = v
    img.data[o + 2] = v
    img.data[o + 3] = 255
  }
  return img
}

function formatDate(d: string): string {
  if (!d || d.length !== 8) return d
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

// ────────────────────────────────────────────────────────────────────────────
// 可复用断层 Canvas
// ────────────────────────────────────────────────────────────────────────────

interface SliceCanvasProps {
  pixels: Int16Array | null
  ww: number
  wl: number
  zoom: number
  pan: { x: number; y: number }
  markers: Marker[]
  label: string
  subLabel?: string
  markerMode: boolean
  onWheel: (deltaY: number) => void
  onPan: (dx: number, dy: number) => void
  onResetView: () => void
  onImageClick?: (ix: number, iy: number) => void
}

function SliceCanvas({ pixels, ww, wl, zoom, pan, markers, label, subLabel, markerMode, onWheel, onPan, onResetView, onImageClick }: SliceCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draggingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height
    canvas.width = w * devicePixelRatio
    canvas.height = h * devicePixelRatio
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0)
    ctx.fillStyle = '#020617'
    ctx.fillRect(0, 0, w, h)

    if (pixels) {
      const imgData = applyWindow(pixels, SIZE, SIZE, ww, wl)
      const tmp = document.createElement('canvas')
      tmp.width = SIZE
      tmp.height = SIZE
      const tctx = tmp.getContext('2d')!
      tctx.putImageData(imgData, 0, 0)
      const scale = Math.min(w / SIZE, h / SIZE) * zoom
      const ox = (w - SIZE * scale) / 2 + pan.x
      const oy = (h - SIZE * scale) / 2 + pan.y
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(tmp, ox, oy, SIZE * scale, SIZE * scale)

      for (const m of markers) {
        const mx = ox + m.x * scale
        const my = oy + m.y * scale
        const mw = m.w * scale
        const mh = m.h * scale
        ctx.strokeStyle = m.auto ? '#facc15' : '#f97316'
        ctx.lineWidth = Math.max(1, scale * 0.4)
        ctx.strokeRect(mx, my, mw, mh)
      }
    }

    // 信息标注
    ctx.font = '12px ui-monospace, monospace'
    const info = `${label}${subLabel ? ` | ${subLabel}` : ''}`
    const tw = ctx.measureText(info).width + 12
    ctx.fillStyle = 'rgba(2,6,23,0.75)'
    ctx.fillRect(4, 4, tw, 20)
    ctx.fillStyle = '#facc15'
    ctx.fillText(info, 10, 18)
    if (pixels) {
      ctx.fillStyle = 'rgba(2,6,23,0.75)'
      ctx.fillRect(4, h - 24, 210, 20)
      ctx.fillStyle = '#94a3b8'
      ctx.fillText(`WW ${ww} | WL ${wl} | ${SIZE}×${SIZE}`, 10, h - 10)
    }
  }, [pixels, ww, wl, zoom, pan, markers, label, subLabel])

  const onWheelEvt = (e: React.WheelEvent) => {
    e.preventDefault()
    onWheel(e.deltaY)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    draggingRef.current = true
    lastPosRef.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!draggingRef.current || !lastPosRef.current) return
    const dx = e.clientX - lastPosRef.current.x
    const dy = e.clientY - lastPosRef.current.y
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    onPan(dx, dy)
  }
  const onMouseUp = (e: React.MouseEvent) => {
    const wasDragging = draggingRef.current
    const start = lastPosRef.current
    draggingRef.current = false
    lastPosRef.current = null
    if (!wasDragging || !start) return
    const moved = Math.abs(e.clientX - start.x) + Math.abs(e.clientY - start.y)
    if (moved > 6) return
    if (onImageClick) {
      const canvas = canvasRef.current
      if (!canvas) return
      const rect = canvas.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      const scale = Math.min(w / SIZE, h / SIZE) * zoom
      const ox = (w - SIZE * scale) / 2 + pan.x
      const oy = (h - SIZE * scale) / 2 + pan.y
      const ix = Math.round((e.clientX - rect.left - ox) / scale)
      const iy = Math.round((e.clientY - rect.top - oy) / scale)
      if (ix >= 0 && ix < SIZE && iy >= 0 && iy < SIZE) onImageClick(ix, iy)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: markerMode ? 'crosshair' : 'grab', touchAction: 'none' }}
        onWheel={onWheelEvt}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={() => { draggingRef.current = false }}
        onDoubleClick={onResetView}
      />
      {markerMode && (
        <div style={{ position: 'absolute', top: 30, left: 4, background: 'rgba(249,115,22,0.85)', color: '#fff', fontSize: 11, padding: '2px 6px', borderRadius: 3 }}>
          {t('dbtPage.markerModeHint')}
        </div>
      )}
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────
// DBT 阅片页面
// ────────────────────────────────────────────────────────────────────────────

type ViewMode = 'single' | 'reconstruct' | 'compare'

const DbtPage: React.FC = () => {
  // [v3.0.6.11-96 Wave3B G-21 P2] 支持 ?studyId 直达 (乳腺专科"断层阅片"入口带入)
  const [searchParams] = useSearchParams()
  const [studies, setStudies] = useState<DbtStudyDto[]>([])
  const [studiesLoading, setStudiesLoading] = useState(true)
  const [studiesError, setStudiesError] = useState<string | null>(null)

  const [selectedStudyId, setSelectedStudyId] = useState('')
  const [selectedSeriesUid, setSelectedSeriesUid] = useState('')
  const [slices, setSlices] = useState<DbtSliceDto[]>([])
  const [slicesLoading, setSlicesLoading] = useState(false)
  const [slicesError, setSlicesError] = useState<string | null>(null)

  const [currentSlice, setCurrentSlice] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(2)
  const [ww, setWw] = useState(2400)
  const [wl, setWl] = useState(1600)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [markerMode, setMarkerMode] = useState(false)
  const [markersBySlice, setMarkersBySlice] = useState<Record<number, Marker[]>>({})

  const [mode, setMode] = useState<ViewMode>('single')
  const [reconstructing, setReconstructing] = useState(false)
  const [reconstructResult, setReconstructResult] = useState<DbtReconstructResultDto | null>(null)
  const [reconstructPixels, setReconstructPixels] = useState<Int16Array | null>(null)

  const [compareResult, setCompareResult] = useState<DbtCompareResultDto | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareError, setCompareError] = useState<string | null>(null)
  const [compareSlice, setCompareSlice] = useState(0)
  const [comparePixels, setComparePixels] = useState<{ current: Int16Array | null; prior: Int16Array | null }>({ current: null, prior: null })
  const animRef = useRef<number>(0)

  // [G-21 Wave3C] BI-RADS 自动评分 (微钙化检测结果 → 特征确认 → 评分)
  const [biradsOpen, setBiradsOpen] = useState(false)
  const [biradsLoading, setBiradsLoading] = useState(false)
  const [biradsResult, setBiradsResult] = useState<DbtBiradsScoreResultDto | null>(null)
  const [biradsCalcCount, setBiradsCalcCount] = useState(0)
  const [biradsDistribution, setBiradsDistribution] = useState('clustered')
  const [biradsMorphology, setBiradsMorphology] = useState<string>('punctate')
  const [biradsHasMass, setBiradsHasMass] = useState(false)
  const [biradsMassSize, setBiradsMassSize] = useState<number>(15)
  const [biradsMassShape, setBiradsMassShape] = useState('oval')
  const [biradsMassMargin, setBiradsMassMargin] = useState('circumscribed')

  const selectedStudy = studies.find((s) => s.id === selectedStudyId)
  const selectedSeries = selectedStudy?.series.find((s) => s.seriesInstanceUid === selectedSeriesUid)
  const currentPixelForSlice = slices[currentSlice]?.pixelData
    ? decodeRaw16(slices[currentSlice]!.pixelData!.dataBase64, slices[currentSlice]!.pixelData!.signed)
    : null

  // ── 检查列表 ──
  useEffect(() => {
    let cancelled = false
    dbtApi.studies().then((res) => {
      if (cancelled) return
      if (res.success && Array.isArray(res.data)) {
        setStudies(res.data)
        setStudiesError(null)
        // [v3.0.6.11-96 Wave3B G-21 P2] 优先选中 URL ?studyId 指定检查, 否则当前/首个
        const paramId = searchParams.get('studyId')
        const current = res.data.find((s) => String(s.id) === String(paramId))
          ?? res.data.find((s) => s.isCurrent)
          ?? res.data[0]
        if (current) {
          setSelectedStudyId(current.id)
          setSelectedSeriesUid(current.series[0]?.seriesInstanceUid ?? '')
        }
      } else {
        setStudiesError(res.error?.message ?? t('dbtPage.studiesLoadFailed'))
      }
      setStudiesLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  // ── 断层切片 ──
  const loadSlices = useCallback(async (studyId: string, seriesUid: string) => {
    if (!studyId || !seriesUid) return
    setSlicesLoading(true)
    setSlicesError(null)
    try {
      const res = await dbtApi.slices(studyId, seriesUid)
      if (res.success && res.data) {
        setSlices(res.data.slices)
        setCurrentSlice(0)
        setCompareSlice(0)
        setMarkersBySlice({})
        setReconstructResult(null)
        setReconstructPixels(null)
      } else {
        setSlicesError(res.error?.message ?? t('dbtPage.slicesLoadFailed'))
      }
    } catch {
      setSlicesError(t('dbtPage.slicesLoadFailed'))
    } finally {
      setSlicesLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSlices(selectedStudyId, selectedSeriesUid)
  }, [selectedStudyId, selectedSeriesUid, loadSlices])

  // ── 微钙化自动检测 ──
  useEffect(() => {
    if (mode !== 'single' || !currentPixelForSlice) return
    setMarkersBySlice((prev) => {
      if (prev[currentSlice]) return prev
      const detected = detectMicrocalcifications(currentPixelForSlice, SIZE, SIZE, ww, wl)
      return { ...prev, [currentSlice]: detected }
    })
  }, [currentSlice, currentPixelForSlice, ww, wl, mode])

  // ── 连续播放 ──
  const sliceCount = slices.length
  useEffect(() => {
    if (!playing || sliceCount === 0 || mode !== 'single') { cancelAnimationFrame(animRef.current); return }
    let last = performance.now()
    function tick(now: number) {
      const interval = 240 / speed
      if (now - last >= interval) {
        last = now
        setCurrentSlice((prev) => (prev + 1) % sliceCount)
      }
      animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [playing, sliceCount, speed, mode])

  // ── 重建 ──
  const runReconstruct = useCallback(async (projection: 'mip' | 'mean') => {
    if (!selectedStudyId || !selectedSeriesUid) return
    setReconstructing(true)
    try {
      const res = await dbtApi.reconstruct(selectedStudyId, { seriesInstanceUid: selectedSeriesUid, projection, thickness: 15 })
      if (res.success && res.data) {
        setReconstructResult(res.data)
        setReconstructPixels(decodeRaw16(res.data.pixelData.dataBase64, res.data.pixelData.signed))
        setMode('reconstruct')
      } else {
        message.error(res.error?.message ?? t('dbtPage.reconstructFailed'))
      }
    } catch {
      message.error(t('dbtPage.reconstructFailed'))
    } finally {
      setReconstructing(false)
    }
  }, [selectedStudyId, selectedSeriesUid])

  // ── 对比 ──
  const runCompare = useCallback(async () => {
    const current = studies.find((s) => s.isCurrent)
    const prior = studies.find((s) => !s.isCurrent)
    if (!current || !prior) {
      message.warning(t('dbtPage.missingCompareData'))
      return
    }
    setCompareLoading(true)
    setCompareError(null)
    setMode('compare')
    try {
      const res = await dbtApi.compare({ currentStudyId: current.id, priorStudyId: prior.id })
      if (res.success && res.data) {
        setCompareResult(res.data)
        const cs = res.data.lateralityMap[0]
        const [cur, pri] = await Promise.all([
          cs?.currentSeries ? dbtApi.slices(current.id, cs.currentSeries) : null,
          cs?.priorSeries ? dbtApi.slices(prior.id, cs.priorSeries) : null,
        ])
        const curPix = cur?.success && cur.data.slices[0]?.pixelData
        const priPix = pri?.success && pri.data.slices[0]?.pixelData
        setComparePixels({
          current: curPix ? decodeRaw16(curPix.dataBase64, curPix.signed) : null,
          prior: priPix ? decodeRaw16(priPix.dataBase64, priPix.signed) : null,
        })
      } else {
        setCompareError(res.error?.message ?? t('dbtPage.compareLoadFailed'))
      }
    } catch {
      setCompareError(t('dbtPage.compareLoadFailed'))
    } finally {
      setCompareLoading(false)
    }
  }, [studies])

  const onSeriesChange = (studyId: string) => {
    const study = studies.find((s) => s.id === studyId)
    setSelectedStudyId(studyId)
    if (study) setSelectedSeriesUid(study.series[0]?.seriesInstanceUid ?? '')
  }

  const toggleMarker = useCallback((ix: number, iy: number) => {
    if (!markerMode) return
    setMarkersBySlice((prev) => {
      const list = [...(prev[currentSlice] ?? [])]
      const existing = list.findIndex((m) => Math.abs(m.x - ix) <= 6 && Math.abs(m.y - iy) <= 6)
      if (existing >= 0) {
        list.splice(existing, 1)
      } else {
        list.push({ id: `mc-manual-${Date.now()}`, x: ix - 4, y: iy - 4, w: 9, h: 9, auto: false })
      }
      return { ...prev, [currentSlice]: list }
    })
  }, [markerMode, currentSlice])

  const currentMarkers = markersBySlice[currentSlice] ?? []

  // [G-21 Wave3C] 打开评分弹窗: 自动带入当前层自动检出微钙化数量
  const openBirads = () => {
    if (!selectedStudyId) {
      message.warning(t('dbtPage.selectDbtStudy'))
      return
    }
    const auto = currentMarkers.filter((m) => m.auto).length
    setBiradsCalcCount(auto || 5)
    setBiradsResult(null)
    setBiradsOpen(true)
  }

  const runBiradsScore = async () => {
    if (!selectedStudyId) return
    setBiradsLoading(true)
    try {
      const dto: DbtBiradsScoreDto = {
        calcifications: biradsCalcCount > 0
          ? [{ count: biradsCalcCount, distribution: biradsDistribution as DbtBiradsCalcificationDto['distribution'], morphology: (biradsMorphology || undefined) as DbtBiradsCalcificationDto['morphology'] }]
          : [],
        ...(biradsHasMass ? { mass: { size: biradsMassSize, shape: biradsMassShape as DbtBiradsMassDto['shape'], margin: biradsMassMargin as DbtBiradsMassDto['margin'] } } : {}),
      }
      const res = await dbtApi.scoreBirads(selectedStudyId, dto)
      if (res.success && res.data) {
        setBiradsResult(res.data)
      } else {
        message.error(res.error?.message ?? t('dbtPage.biradsScoreFailed'))
      }
    } catch {
      message.error(t('dbtPage.biradsScoreFailed'))
    } finally {
      setBiradsLoading(false)
    }
  }

  // [G-21 Wave3C] 评分结果 → 报告段落 (复用 insertHtml 通道: report-insert-html 事件)
  const insertBiradsToReport = () => {
    if (!biradsResult) return
    const esc = (v: unknown): string =>
      String(v ?? '').replace(/[<>&"']/g, (ch) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' })[ch] ?? ch)
    const basisHtml = (biradsResult.basis ?? [])
      .map((b) => `<li>${esc(b)}</li>`)
      .join('')
    const html = [
      `<h3>${t('w9d.dbt.biradsTitle')}</h3>`,
      `<p><strong>${esc(biradsResult.categoryLabel)}</strong> (${t('w9d.dbt.autoJudged')})</p>`,
      `<p>${t('w9d.dbt.malignancyRisk')}: ${esc(biradsResult.malignancyRisk)} · ${t('w9d.aiRads.recommendLabel')}: ${esc(biradsResult.recommendation)}</p>`,
      basisHtml ? `<ul>${basisHtml}</ul>` : '',
    ].join('\n')
    window.dispatchEvent(new CustomEvent('report-insert-html', { detail: { html } }))
    try { window.localStorage.setItem('ris_rads_pending_insert', html) } catch { /* 忽略 */ }
    message.success(t('dbtPage.biradsInserted'))
  }

  const viewportCanvas = (view: 'single' | 'reconstruct') => {
    const isRecon = view === 'reconstruct'
    const px = isRecon ? reconstructPixels : currentPixelForSlice
    const label = isRecon
      ? t('dbtPage.reconLabel', { proj: reconstructResult?.projection === 'mip' ? 'MIP' : 'Mean', thickness: reconstructResult?.thickness ?? 15 })
      : t('dbtPage.singleLabel', { view: selectedSeries?.viewPosition ?? '', angle: slices[currentSlice]?.tomoAngle.toFixed(1), current: currentSlice + 1, total: sliceCount })
    return (
      <SliceCanvas
        pixels={px}
        ww={ww}
        wl={wl}
        zoom={zoom}
        pan={pan}
        markers={isRecon ? [] : currentMarkers}
        label={label}
        subLabel={isRecon ? t('dbtPage.reconSource', { source: reconstructResult?.source === 'real' ? t('dbtPage.sourceReal') : t('dbtPage.sourceSimulated') }) : `${selectedStudy?.patientName ?? ''} ${selectedStudy ? formatDate(selectedStudy.studyDate) : ''}`}
        markerMode={!isRecon && markerMode}
        onWheel={(dy) => setZoom((z) => Math.max(1, Math.min(10, z * (dy > 0 ? 0.88 : 1.12))))}
        onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
        onResetView={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
        onImageClick={isRecon ? undefined : toggleMarker}
      />
    )
  }

  return (
    <div style={{ background: '#020617', color: '#cbd5e1', padding: 'var(--space-3, 12px)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 14, fontWeight: 700 }}>{t('dbtPage.title')}</span>
        <Tag color="cyan">{t('dbtPage.subtitle')}</Tag>
        {selectedStudy && (
          <>
            <Tag color={selectedStudy.isCurrent ? 'green' : 'default'}>{selectedStudy.isCurrent ? t('dbtPage.current') : t('dbtPage.prior')}</Tag>
            <Tag>{formatDate(selectedStudy.studyDate)}</Tag>
            <Tag>{selectedStudy.patientName} ({selectedStudy.patientId})</Tag>
          </>
        )}
      </div>

      {studiesError && <Alert type="error" showIcon message={studiesError} style={{ marginBottom: 'var(--space-3, 12px)' }} />}
      {studiesLoading && <Spin tip={t('dbtPage.loadingStudies')} style={{ display: 'block', margin: '40px 0' }} />}

      {!studiesLoading && studies.length === 0 && !studiesError && (
        <Alert type="warning" showIcon message={t('dbtPage.noDbtData')} description={t('dbtPage.noDbtDataDesc')} style={{ marginBottom: 'var(--space-3, 12px)' }} />
      )}

      {studies.length > 0 && (
        <>
          <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 'var(--space-3, 12px)' }}>
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>{t('dbtPage.studyList')}</span>
              <Select
                value={selectedStudyId || undefined}
                onChange={onSeriesChange}
                style={{ width: 420 }}
                options={studies.map((s) => ({
                  value: s.id,
                  label: t('dbtPage.studyOption', { status: s.isCurrent ? t('dbtPage.currentBracket') : t('dbtPage.priorBracket'), date: formatDate(s.studyDate), desc: s.studyDescription, count: s.series.length }),
                }))}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>{t('dbtPage.seriesLabel')}</span>
              <Select
                value={selectedSeriesUid || undefined}
                onChange={(v) => setSelectedSeriesUid(v)}
                style={{ width: 220 }}
                options={(selectedStudy?.series ?? []).map((s) => ({
                  value: s.seriesInstanceUid,
                  label: t('dbtPage.seriesOption', { view: s.viewPosition, side: s.laterality === 'L' ? t('dbtPage.left') : t('dbtPage.right'), count: s.sliceCount }),
                }))}
              />
              <div style={{ flex: 1 }} />
              <Button size="small" icon={<GitCompareArrows size={14} />} loading={compareLoading} onClick={runCompare}>{t('dbtPage.compareBtn')}</Button>
              <Button size="small" icon={<ScanLine size={14} />} loading={reconstructing} onClick={() => runReconstruct('mip')}>{t('dbtPage.reconstructBtn')}</Button>
              {/* [G-21 Wave3C] 微钙化检测 → BI-RADS 自动评分 */}
              <Button size="small" type="primary" icon={<Sparkles size={14} />} onClick={openBirads}>{t('dbtPage.biradsBtn')}</Button>
            </div>
          </Card>

          <Segmented
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
            options={[
              { label: t('dbtPage.viewSingle'), value: 'single' },
              { label: t('dbtPage.viewReconstruct'), value: 'reconstruct' },
              { label: t('dbtPage.viewCompare'), value: 'compare' },
            ]}
            style={{ marginBottom: 'var(--space-3, 12px)' }}
          />

          {mode !== 'compare' && (
            <div style={{ display: 'flex', gap: 'var(--space-3, 12px)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 300px)' }}>
                  {slicesLoading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin tip={t('dbtPage.loadingSlices')} /></div>}
                  {!slicesLoading && slicesError && <div style={{ padding: 'var(--space-6, 24px)' }}><Alert type="error" showIcon message={slicesError} /></div>}
                  {!slicesLoading && !slicesError && viewportCanvas(mode)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginTop: 'var(--space-2, 8px)', background: PANEL_BG, borderRadius: 6, padding: '8px 12px' }}>
                  <button aria-label="上一个" style={currentSlice === 0 ? { ...btnStyle, opacity: 0.4 } : btnStyle} disabled={currentSlice === 0} onClick={() => { setCurrentSlice(0); setPlaying(false) }}>
                    <SkipBack size={14} />
                  </button>
                  <button style={playing ? activeBtnStyle : btnStyle} onClick={() => setPlaying((v) => !v)} disabled={mode !== 'single' || sliceCount === 0}>
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button aria-label="下一个" style={currentSlice >= sliceCount - 1 ? { ...btnStyle, opacity: 0.4 } : btnStyle} disabled={currentSlice >= sliceCount - 1 || sliceCount === 0} onClick={() => { setCurrentSlice((f) => Math.min(sliceCount - 1, f + 1)); setPlaying(false) }}>
                    <SkipForward size={14} />
                  </button>
                  <div style={{ width: 1, height: 20, background: '#334155' }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{t('dbtPage.speedLabel')}</span>
                  {[0.5, 1, 2, 4].map((v) => (
                    <button key={v} style={speed === v ? activeBtnStyle : btnStyle} onClick={() => setSpeed(v)}>{v}x</button>
                  ))}
                  <div style={{ width: 1, height: 20, background: '#334155' }} />
                  <button style={markerMode ? activeBtnStyle : btnStyle} onClick={() => setMarkerMode((v) => !v)} title={t('dbtPage.markerBtn')}>
                    <Crosshair size={14} /> {t('dbtPage.markerBtn')}
                  </button>
                  <button style={btnStyle} onClick={() => setZoom((z) => Math.min(10, z * 1.3))} title={t('dbtPage.zoomInTitle')}><ZoomIn size={14} /></button>
                  <button style={btnStyle} onClick={() => setZoom((z) => Math.max(1, z / 1.3))} title={t('dbtPage.zoomOutTitle')}><ZoomOut size={14} /></button>
                  <button style={btnStyle} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title={t('dbtPage.fitTitle')}><Maximize size={14} /></button>
                  <Slider min={0} max={Math.max(0, sliceCount - 1)} value={currentSlice} onChange={(v) => { setCurrentSlice(v); setPlaying(false) }} style={{ flex: 1, margin: 0 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{sliceCount > 0 ? `${currentSlice + 1}/${sliceCount}` : '-'}</span>
                </div>
              </div>

              <div style={{ width: 240, flexShrink: 0 }}>
                <Card size="small" title={t('dbtPage.windowCard')} style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 'var(--space-3, 12px)' }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 2 }}>
                      <span>WW</span><span style={{ color: '#facc15' }}>{ww}</span>
                    </div>
                    <Slider min={200} max={5000} value={ww} onChange={setWw} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted, #94a3b8)', marginBottom: 2 }}>
                      <span>WL</span><span style={{ color: '#facc15' }}>{wl}</span>
                    </div>
                    <Slider min={0} max={4000} value={wl} onChange={setWl} />
                  </div>
                  <Button size="small" block onClick={() => { setWw(2400); setWl(1600) }}>{t('dbtPage.resetWindow')}</Button>
                </Card>
                <Card size="small" title={t('dbtPage.markerCard')} style={{ background: PANEL_BG, border: '1px solid #334155' }}>
                  {currentMarkers.length === 0 && <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', padding: '6px 0' }}>{t('dbtPage.noMarkers')}</div>}
                  {currentMarkers.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12, padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                      <span style={{ width: 10, height: 10, background: m.auto ? '#facc15' : '#f97316', borderRadius: 2, display: 'inline-block' }} />
                      <span style={{ color: '#cbd5e1' }}>{m.auto ? t('dbtPage.auto') : t('dbtPage.manual')}</span>
                      <span style={{ color: 'var(--text-muted, #64748b)' }}>x:{m.x} y:{m.y} {m.w}×{m.h}px</span>
                      <span style={{ flex: 1 }} />
                      <button style={{ ...btnStyle, padding: '2px 6px', fontSize: 11 }} onClick={() => setMarkersBySlice((prev) => ({ ...prev, [currentSlice]: (prev[currentSlice] ?? []).filter((mm) => mm.id !== m.id) }))}>{t('dbtPage.delete')}</button>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)', marginTop: 'var(--space-2, 8px)' }}>
                    {t('dbtPage.threshold', { value: Math.round(wl + ww * 0.55), count: currentMarkers.filter((m) => m.auto).length })}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {mode === 'compare' && (
            <div>
              {compareLoading && <Spin tip={t('dbtPage.loadingCompare')} style={{ display: 'block', margin: '40px 0' }} />}
              {compareError && <Alert type="error" showIcon message={compareError} style={{ marginBottom: 'var(--space-3, 12px)' }} />}
              {!compareLoading && compareResult && (
                <>
                  <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 'var(--space-3, 12px)' }}>
                    <div style={{ display: 'flex', gap: 'var(--space-6, 24px)', flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={{ color: GREEN }}>
                        {t('dbtPage.compareCurrent', { date: formatDate(compareResult.current.studyDate), name: compareResult.current.patientName, accession: compareResult.current.accessionNumber })}
                      </span>
                      <span style={{ color: BLUE }}>
                        {t('dbtPage.comparePrior', { date: formatDate(compareResult.prior.studyDate), name: compareResult.prior.patientName, accession: compareResult.prior.accessionNumber })}
                      </span>
                      <span style={{ color: 'var(--text-muted, #94a3b8)' }}>{t('dbtPage.syncScrollOn')}</span>
                    </div>
                  </Card>
                  <div style={{ display: 'flex', gap: 'var(--space-3, 12px)' }}>
                    <div style={{ flex: 1, background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 380px)' }}>
                      <SliceCanvas
                        pixels={comparePixels.current}
                        ww={ww} wl={wl} zoom={zoom} pan={pan} markers={[]}
                        label={t('dbtPage.compareCanvasCurrent', { view: compareResult.current.series[0]?.viewPosition ?? '', current: compareSlice + 1 })}
                        subLabel={`${formatDate(compareResult.current.studyDate)} (2026)`}
                        markerMode={false}
                        onWheel={(dy) => setZoom((z) => Math.max(1, Math.min(10, z * (dy > 0 ? 0.88 : 1.12))))}
                        onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
                        onResetView={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                      />
                    </div>
                    <div style={{ flex: 1, background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 380px)' }}>
                      <SliceCanvas
                        pixels={comparePixels.prior}
                        ww={ww} wl={wl} zoom={zoom} pan={pan} markers={[]}
                        label={t('dbtPage.compareCanvasPrior', { view: compareResult.prior.series[0]?.viewPosition ?? '', current: compareSlice + 1 })}
                        subLabel={`${formatDate(compareResult.prior.studyDate)} (2025)`}
                        markerMode={false}
                        onWheel={(dy) => setZoom((z) => Math.max(1, Math.min(10, z * (dy > 0 ? 0.88 : 1.12))))}
                        onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
                        onResetView={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', marginTop: 10, background: PANEL_BG, borderRadius: 6, padding: '8px 12px' }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)', whiteSpace: 'nowrap' }}>{t('dbtPage.syncSliceLabel')}</span>
                    <Slider min={0} max={14} value={compareSlice} onChange={setCompareSlice} style={{ flex: 1, margin: 0 }} />
                    <span style={{ fontSize: 11, color: 'var(--text-muted, #94a3b8)' }}>{compareSlice + 1}/15</span>
                    <button aria-label="下一个" style={btnStyle} onClick={() => setCompareSlice((c) => Math.min(14, c + 1))}><SkipForward size={14} /></button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}

      {/* [G-21 Wave3C] BI-RADS 自动评分弹窗: 特征确认 → 评分结果卡 → 可插入报告 */}
      <Modal
        title={<span><Sparkles size={14} style={{ marginRight: 6, verticalAlign: -2 }} />{t('dbtPage.biradsModalTitle')}{selectedStudy ? ` · ${selectedStudy.patientName} (${selectedStudy.studyDescription})` : ''}</span>}
        open={biradsOpen}
        onCancel={() => setBiradsOpen(false)}
        footer={null}
        width={720}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          <Card size="small" title={t('dbtPage.featureConfirm')}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('dbtPage.calcCount', { count: currentMarkers.filter(m => m.auto).length })}</div>
                <InputNumber min={0} max={500} value={biradsCalcCount} onChange={(v) => setBiradsCalcCount(v ?? 0)} style={{ width: '100%' }} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('dbtPage.distribution')}</div>
                <Select value={biradsDistribution} onChange={setBiradsDistribution} style={{ width: '100%' }} options={[
                  { value: 'clustered', label: t('dbtPage.distClustered') }, { value: 'linear', label: t('dbtPage.distLinear') }, { value: 'segmental', label: t('dbtPage.distSegmental') },
                  { value: 'regional', label: t('dbtPage.distRegional') }, { value: 'diffuse', label: t('dbtPage.distDiffuse') },
                ]} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('dbtPage.morphology')}</div>
                <Select value={biradsMorphology} onChange={setBiradsMorphology} style={{ width: '100%' }} options={[
                  { value: 'punctate', label: t('dbtPage.morphPunctate') }, { value: 'round', label: t('dbtPage.morphRound') },
                  { value: 'coarse', label: t('dbtPage.morphCoarse') }, { value: 'popcorn', label: t('dbtPage.morphPopcorn') },
                  { value: 'amorphous', label: t('dbtPage.morphAmorphous') }, { value: 'coarse_heterogeneous', label: t('dbtPage.morphCoarseHeterogeneous') },
                  { value: 'fine_pleomorphic', label: t('dbtPage.morphFinePleomorphic') }, { value: 'fine_linear', label: t('dbtPage.morphFineLinear') },
                ]} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                <Checkbox checked={biradsHasMass} onChange={(e) => setBiradsHasMass(e.target.checked)}>{t('dbtPage.hasMass')}</Checkbox>
              </div>
              {biradsHasMass && (
                <>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('dbtPage.massSize')}</div>
                    <InputNumber min={1} max={200} value={biradsMassSize} onChange={(v) => setBiradsMassSize(v ?? 15)} style={{ width: '100%' }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('dbtPage.massShape')}</div>
                    <Select value={biradsMassShape} onChange={setBiradsMassShape} style={{ width: '100%' }} options={[
                      { value: 'round', label: t('dbtPage.shapeRound') }, { value: 'oval', label: t('dbtPage.shapeOval') }, { value: 'irregular', label: t('dbtPage.shapeIrregular') },
                    ]} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-1, 4px)' }}>{t('dbtPage.margin')}</div>
                    <Select value={biradsMassMargin} onChange={setBiradsMassMargin} style={{ width: '100%' }} options={[
                      { value: 'circumscribed', label: t('dbtPage.marginCircumscribed') }, { value: 'microlobulated', label: t('dbtPage.marginMicrolobulated') },
                      { value: 'indistinct', label: t('dbtPage.marginIndistinct') }, { value: 'spiculated', label: t('dbtPage.marginSpiculated') },
                    ]} />
                  </div>
                </>
              )}
            </div>
            <div style={{ marginTop: 10 }}>
              <Button type="primary" icon={<Sparkles size={14} />} loading={biradsLoading} onClick={runBiradsScore}>{t('dbtPage.startScore')}</Button>
            </div>
          </Card>

          {biradsResult && (
            <Card
              size="small"
              title={<span>{t('dbtPage.scoreResult')} · <Tag color={biradsResult.category === '5' ? 'red' : biradsResult.category.startsWith('4') ? 'volcano' : biradsResult.category === '3' ? 'gold' : biradsResult.category === '0' ? 'default' : 'green'}>{biradsResult.categoryLabel}</Tag></span>}
              extra={<Button size="small" icon={<FileText size={12} />} onClick={insertBiradsToReport}>{t('dbtPage.insertReport')}</Button>}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                <div style={{ padding: 10, background: 'var(--color-success-bg, #f0fdf4)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{t('dbtPage.category')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: biradsResult.category === '5' ? 'var(--color-error-600)' : biradsResult.category.startsWith('4') ? '#ea580c' : biradsResult.category === '3' ? '#ca8a04' : 'var(--color-success-600)' }}>{biradsResult.categoryLabel}</div>
                </div>
                <div style={{ padding: 10, background: 'var(--color-warning-bg, #fffbeb)', borderRadius: 8 }}>
                  <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)' }}>{t('dbtPage.malignancyRisk')}</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: '#b45309' }}>{biradsResult.malignancyRisk}</div>
                </div>
              </div>
              <Alert type={biradsResult.category === '5' || biradsResult.category.startsWith('4') ? 'warning' : biradsResult.category === '3' ? 'info' : 'success'} showIcon message={<b>{t('dbtPage.recommendation')}</b>} description={biradsResult.recommendation} style={{ marginBottom: 10 }} />
              <Divider style={{ margin: '8px 0' }} />
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t('dbtPage.basis', { count: biradsResult.basis.length })}</div>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--text-primary, #334155)' }}>
                {biradsResult.basis.map((b, i) => <li key={i} style={{ marginBottom: 3 }}>{b}</li>)}
              </ul>
            </Card>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default DbtPage
