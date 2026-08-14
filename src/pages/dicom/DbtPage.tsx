import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Card, Slider, Tag, Select, Spin, Alert, Segmented, Button, message } from 'antd'
import { Layers, Play, Pause, SkipBack, SkipForward, ZoomIn, ZoomOut, Maximize, Crosshair, ScanLine, GitCompareArrows } from 'lucide-react'
import { dbtApi, type DbtStudyDto, type DbtSliceDto, type DbtCompareResultDto, type DbtReconstructResultDto } from '../../services/api/dbtApi'

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
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
  background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
  borderRadius: 4, padding: '6px 10px', fontSize: 12, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', gap: 4,
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
          微钙化标记模式: 点击图像添加/移除标记
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
        setStudiesError(res.error?.message ?? 'DBT 检查列表加载失败')
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
        setSlicesError(res.error?.message ?? '断层切片加载失败')
      }
    } catch {
      setSlicesError('断层切片加载失败')
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
        message.error(res.error?.message ?? '断层重建失败')
      }
    } catch {
      message.error('断层重建失败')
    } finally {
      setReconstructing(false)
    }
  }, [selectedStudyId, selectedSeriesUid])

  // ── 对比 ──
  const runCompare = useCallback(async () => {
    const current = studies.find((s) => s.isCurrent)
    const prior = studies.find((s) => !s.isCurrent)
    if (!current || !prior) {
      message.warning('缺少当前/既往 DBT 检查数据')
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
        setCompareError(res.error?.message ?? '对比数据加载失败')
      }
    } catch {
      setCompareError('对比数据加载失败')
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

  const viewportCanvas = (view: 'single' | 'reconstruct') => {
    const isRecon = view === 'reconstruct'
    const px = isRecon ? reconstructPixels : currentPixelForSlice
    const label = isRecon
      ? `DBT 重建 ${reconstructResult?.projection === 'mip' ? 'MIP' : 'Mean'} | ${reconstructResult?.thickness ?? 15}mm`
      : `DBT | ${selectedSeries?.viewPosition ?? ''} | ${slices[currentSlice]?.tomoAngle.toFixed(1)}° | 第 ${currentSlice + 1}/${sliceCount} 层`
    return (
      <SliceCanvas
        pixels={px}
        ww={ww}
        wl={wl}
        zoom={zoom}
        pan={pan}
        markers={isRecon ? [] : currentMarkers}
        label={label}
        subLabel={isRecon ? `来源: ${reconstructResult?.source === 'real' ? '真实像素' : '模拟'}` : `${selectedStudy?.patientName ?? ''} ${selectedStudy ? formatDate(selectedStudy.studyDate) : ''}`}
        markerMode={!isRecon && markerMode}
        onWheel={(dy) => setZoom((z) => Math.max(1, Math.min(10, z * (dy > 0 ? 0.88 : 1.12))))}
        onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
        onResetView={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
        onImageClick={isRecon ? undefined : toggleMarker}
      />
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>DBT 乳腺断层阅片</span>
        <Tag color="cyan">数字乳腺断层合成</Tag>
        {selectedStudy && (
          <>
            <Tag color={selectedStudy.isCurrent ? 'green' : 'default'}>{selectedStudy.isCurrent ? '当前' : '既往'}</Tag>
            <Tag>{formatDate(selectedStudy.studyDate)}</Tag>
            <Tag>{selectedStudy.patientName} ({selectedStudy.patientId})</Tag>
          </>
        )}
      </div>

      {studiesError && <Alert type="error" showIcon message={studiesError} style={{ marginBottom: 12 }} />}
      {studiesLoading && <Spin tip="加载 DBT 检查列表..." style={{ display: 'block', margin: '40px 0' }} />}

      {!studiesLoading && studies.length === 0 && !studiesError && (
        <Alert type="warning" showIcon message="暂无 DBT 检查数据" description="请确认后端 dicom-samples/DBT 样本已生成或存在 modality=DBT 的 DicomInstance 记录。" style={{ marginBottom: 12 }} />
      )}

      {studies.length > 0 && (
        <>
          <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>检查列表:</span>
              <Select
                value={selectedStudyId || undefined}
                onChange={onSeriesChange}
                style={{ width: 420 }}
                options={studies.map((s) => ({
                  value: s.id,
                  label: `${s.isCurrent ? '【当前】' : '【既往】'} ${formatDate(s.studyDate)} ${s.studyDescription} (${s.series.length} 系列)`,
                }))}
              />
              <span style={{ fontSize: 12, fontWeight: 600, color: '#94a3b8', whiteSpace: 'nowrap' }}>系列:</span>
              <Select
                value={selectedSeriesUid || undefined}
                onChange={(v) => setSelectedSeriesUid(v)}
                style={{ width: 220 }}
                options={(selectedStudy?.series ?? []).map((s) => ({
                  value: s.seriesInstanceUid,
                  label: `${s.viewPosition} (${s.laterality === 'L' ? '左' : '右'}乳, ${s.sliceCount} 层)`,
                }))}
              />
              <div style={{ flex: 1 }} />
              <Button size="small" icon={<GitCompareArrows size={14} />} loading={compareLoading} onClick={runCompare}>双图对比</Button>
              <Button size="small" icon={<ScanLine size={14} />} loading={reconstructing} onClick={() => runReconstruct('mip')}>断层重建 MIP</Button>
            </div>
          </Card>

          <Segmented
            value={mode}
            onChange={(v) => setMode(v as ViewMode)}
            options={[
              { label: '断层阅片', value: 'single' },
              { label: '厚度投影', value: 'reconstruct' },
              { label: '双图对比', value: 'compare' },
            ]}
            style={{ marginBottom: 12 }}
          />

          {mode !== 'compare' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 300px)' }}>
                  {slicesLoading && <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}><Spin tip="加载断层切片..." /></div>}
                  {!slicesLoading && slicesError && <div style={{ padding: 24 }}><Alert type="error" showIcon message={slicesError} /></div>}
                  {!slicesLoading && !slicesError && viewportCanvas(mode)}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, background: PANEL_BG, borderRadius: 6, padding: '8px 12px' }}>
                  <button style={currentSlice === 0 ? { ...btnStyle, opacity: 0.4 } : btnStyle} disabled={currentSlice === 0} onClick={() => { setCurrentSlice(0); setPlaying(false) }}>
                    <SkipBack size={14} />
                  </button>
                  <button style={playing ? activeBtnStyle : btnStyle} onClick={() => setPlaying((v) => !v)} disabled={mode !== 'single' || sliceCount === 0}>
                    {playing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                  <button style={currentSlice >= sliceCount - 1 ? { ...btnStyle, opacity: 0.4 } : btnStyle} disabled={currentSlice >= sliceCount - 1 || sliceCount === 0} onClick={() => { setCurrentSlice((f) => Math.min(sliceCount - 1, f + 1)); setPlaying(false) }}>
                    <SkipForward size={14} />
                  </button>
                  <div style={{ width: 1, height: 20, background: '#334155' }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>速度:</span>
                  {[0.5, 1, 2, 4].map((v) => (
                    <button key={v} style={speed === v ? activeBtnStyle : btnStyle} onClick={() => setSpeed(v)}>{v}x</button>
                  ))}
                  <div style={{ width: 1, height: 20, background: '#334155' }} />
                  <button style={markerMode ? activeBtnStyle : btnStyle} onClick={() => setMarkerMode((v) => !v)} title="微钙化标记">
                    <Crosshair size={14} /> 微钙化标记
                  </button>
                  <button style={btnStyle} onClick={() => setZoom((z) => Math.min(10, z * 1.3))} title="放大"><ZoomIn size={14} /></button>
                  <button style={btnStyle} onClick={() => setZoom((z) => Math.max(1, z / 1.3))} title="缩小"><ZoomOut size={14} /></button>
                  <button style={btnStyle} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="适应"><Maximize size={14} /></button>
                  <Slider min={0} max={Math.max(0, sliceCount - 1)} value={currentSlice} onChange={(v) => { setCurrentSlice(v); setPlaying(false) }} style={{ flex: 1, margin: 0 }} />
                  <span style={{ fontSize: 11, color: '#94a3b8' }}>{sliceCount > 0 ? `${currentSlice + 1}/${sliceCount}` : '-'}</span>
                </div>
              </div>

              <div style={{ width: 240, flexShrink: 0 }}>
                <Card size="small" title="窗宽窗位" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 12 }}>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>
                      <span>WW</span><span style={{ color: '#facc15' }}>{ww}</span>
                    </div>
                    <Slider min={200} max={5000} value={ww} onChange={setWw} />
                  </div>
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>
                      <span>WL</span><span style={{ color: '#facc15' }}>{wl}</span>
                    </div>
                    <Slider min={0} max={4000} value={wl} onChange={setWl} />
                  </div>
                  <Button size="small" block onClick={() => { setWw(2400); setWl(1600) }}>重置窗位</Button>
                </Card>
                <Card size="small" title="微钙化标记" style={{ background: PANEL_BG, border: '1px solid #334155' }}>
                  {currentMarkers.length === 0 && <div style={{ fontSize: 12, color: '#64748b', padding: '6px 0' }}>当前层无标记 (自动检测 ±)</div>}
                  {currentMarkers.map((m) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '3px 0', borderBottom: '1px solid #1e293b' }}>
                      <span style={{ width: 10, height: 10, background: m.auto ? '#facc15' : '#f97316', borderRadius: 2, display: 'inline-block' }} />
                      <span style={{ color: '#cbd5e1' }}>{m.auto ? '自动' : '手动'}</span>
                      <span style={{ color: '#64748b' }}>x:{m.x} y:{m.y} {m.w}×{m.h}px</span>
                      <span style={{ flex: 1 }} />
                      <button style={{ ...btnStyle, padding: '2px 6px', fontSize: 11 }} onClick={() => setMarkersBySlice((prev) => ({ ...prev, [currentSlice]: (prev[currentSlice] ?? []).filter((mm) => mm.id !== m.id) }))}>删</button>
                    </div>
                  ))}
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
                    检出阈值: {Math.round(wl + ww * 0.55)} ({currentMarkers.filter((m) => m.auto).length} 处自动检出)
                  </div>
                </Card>
              </div>
            </div>
          )}

          {mode === 'compare' && (
            <div>
              {compareLoading && <Spin tip="加载双图对比..." style={{ display: 'block', margin: '40px 0' }} />}
              {compareError && <Alert type="error" showIcon message={compareError} style={{ marginBottom: 12 }} />}
              {!compareLoading && compareResult && (
                <>
                  <Card size="small" style={{ background: PANEL_BG, border: '1px solid #334155', marginBottom: 12 }}>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12 }}>
                      <span style={{ color: GREEN }}>
                        当前: {formatDate(compareResult.current.studyDate)} {compareResult.current.patientName} ({compareResult.current.accessionNumber})
                      </span>
                      <span style={{ color: BLUE }}>
                        既往: {formatDate(compareResult.prior.studyDate)} {compareResult.prior.patientName} ({compareResult.prior.accessionNumber})
                      </span>
                      <span style={{ color: '#94a3b8' }}>同步滚动: 已开启</span>
                    </div>
                  </Card>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <div style={{ flex: 1, background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', height: 'calc(100vh - 380px)' }}>
                      <SliceCanvas
                        pixels={comparePixels.current}
                        ww={ww} wl={wl} zoom={zoom} pan={pan} markers={[]}
                        label={`当前 | ${compareResult.current.series[0]?.viewPosition ?? ''} | ${compareSlice + 1}/${15} 层`}
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
                        label={`既往 | ${compareResult.prior.series[0]?.viewPosition ?? ''} | ${compareSlice + 1}/${15} 层`}
                        subLabel={`${formatDate(compareResult.prior.studyDate)} (2025)`}
                        markerMode={false}
                        onWheel={(dy) => setZoom((z) => Math.max(1, Math.min(10, z * (dy > 0 ? 0.88 : 1.12))))}
                        onPan={(dx, dy) => setPan((p) => ({ x: p.x + dx, y: p.y + dy }))}
                        onResetView={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10, background: PANEL_BG, borderRadius: 6, padding: '8px 12px' }}>
                    <span style={{ fontSize: 11, color: '#94a3b8', whiteSpace: 'nowrap' }}>同步层位:</span>
                    <Slider min={0} max={14} value={compareSlice} onChange={setCompareSlice} style={{ flex: 1, margin: 0 }} />
                    <span style={{ fontSize: 11, color: '#94a3b8' }}>{compareSlice + 1}/15</span>
                    <button style={btnStyle} onClick={() => setCompareSlice((c) => Math.min(14, c + 1))}><SkipForward size={14} /></button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default DbtPage
