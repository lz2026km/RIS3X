import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Layers, Minus, Move, Plus, RotateCw, Sun, ZoomIn, ZoomOut, Crosshair, Square, Circle, Pen, Grid3X3, Database, Loader2 } from 'lucide-react'
import { message } from 'antd'
import { t } from '../../i18n/appI18n'
import { FUSION_CT_WW, FUSION_CT_WL, FUSION_PET_WW, FUSION_PET_WL } from '../../utils/modalityPresets'
import { fusionApi, type FusionStudyDto, type FusionRegistrationResult, type FusionRenderResult } from '../../services/api/fusionApi'

type ViewPlane = 'axial' | 'coronal' | 'sagittal'
type FusionMode = 'pet-ct' | 'mr-dwi' | 'mr-mr'
type TransformType = 'rigid' | 'affine' | 'deformable' | 'nonlinear'
type Layout = '1x1' | '1x3' | '2x2' | '3x3'
type RoiTool = 'rectangle' | 'ellipse' | 'freehand'

interface WWWL { ww: number; wl: number }
interface ViewState { zoom: number; panX: number; panY: number }
interface RoiPoint { x: number; y: number }
interface RoiAnnotation { id: string; tool: RoiTool; points: RoiPoint[]; color: string }

const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const CARD_BG = '#0f172a'
const PANEL_BG = '#1e293b'

const ROI_COLORS = ['#facc15', '#ef4444', '#22c55e', '#3b82f6', '#a855f7']

function generateFallbackSlice(_plane: ViewPlane, slice: number, modality: 'ct' | 'pet' | 'mr' | 'dwi'): number[][] {
  const size = 256
  const data: number[][] = []
  for (let y = 0; y < size; y++) {
    const row: number[] = []
    for (let x = 0; x < size; x++) {
      const cx = x - size / 2
      const cy = y - size / 2
      const d = Math.sqrt(cx * cx + cy * cy)
      const a = Math.atan2(cy, cx)
      const zOff = (slice - 64) / 64
      let v = 0
      if (modality === 'ct') {
        v = 200 + 180 * Math.sin(d * 0.035 + zOff * 0.5) + 60 * Math.cos(a * 3 + zOff * 0.3)
        v += 40 * Math.sin((cx * 0.02 + cy * 0.025 + zOff * 0.4) * 2)
      } else if (modality === 'pet') {
        const hotR = 40 + 20 * Math.sin(zOff * 2.5)
        const hotD = Math.sqrt(cx * cx + cy * cy)
        v = 80 + 200 * Math.exp(-(hotD * hotD) / (2 * hotR * hotR))
        v += 60 * Math.sin(d * 0.06 + a * 4 + zOff * 0.8) * Math.exp(-d * 0.008)
      } else if (modality === 'mr') {
        v = 180 + 170 * Math.sin(d * 0.04 + zOff * 1.2) * (0.5 + 0.5 * Math.cos(a * 2))
        v += 50 * Math.sin(cx * 0.03 + cy * 0.03 + zOff * 0.5)
      } else {
        v = 120 + 200 * (1 - Math.exp(-(Math.abs(cx * 0.04) + Math.abs(cy * 0.04))))
        v *= (0.6 + 0.4 * Math.sin(zOff * 3))
      }
      row.push(Math.max(0, Math.min(4095, Math.round(v))))
    }
    data.push(row)
  }
  return data
}

function applyWWL(data: number[][], ww: number, wl: number): ImageData {
  const size = data.length
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2
  const min = wl - half
  const max = wl + half
  const range = max - min || 1
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let v = ((data[y]![x]! - min) / range) * 255
      v = Math.max(0, Math.min(255, Math.round(v)))
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = v
      imgData.data[i++] = 255
    }
  }
  return imgData
}

function applyFusionColor(fusionData: number[][], primaryData: number[][], alpha: number, ww: number, wl: number, fusionColor: 'hot' | 'cool' | 'green' = 'hot'): ImageData {
  const size = fusionData.length
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const imgData = ctx.createImageData(size, size)
  const half = ww / 2
  const min = wl - half
  const max = wl + half
  const range = max - min || 1
  const fusionMax = fusionData.reduce((mx, row) => Math.max(mx, ...row), 0) || 1
  let i = 0
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const primaryVal = ((primaryData[y]![x]! - min) / range) * 255
      const primaryClamped = Math.max(0, Math.min(255, Math.round(primaryVal)))
      const norm = fusionData[y]![x]! / fusionMax
      let r: number, g: number, b: number
      if (fusionColor === 'hot') {
        r = Math.round(255 * norm)
        g = Math.round(255 * Math.max(0, norm * 1.5 - 0.5))
        b = Math.round(255 * Math.max(0, norm * 0.5 + 0.2))
      } else if (fusionColor === 'cool') {
        r = Math.round(255 * Math.max(0, norm * 0.2))
        g = Math.round(255 * Math.max(0, norm * 0.5 + 0.3))
        b = Math.round(255 * Math.min(1, norm * 1.2 + 0.3))
      } else {
        r = Math.round(255 * Math.max(0, norm * 0.3))
        g = Math.round(255 * Math.min(1, norm * 1.2 + 0.2))
        b = Math.round(255 * Math.max(0, norm * 0.2))
      }
      imgData.data[i++] = Math.round(primaryClamped * (1 - alpha) + r * alpha)
      imgData.data[i++] = Math.round(primaryClamped * (1 - alpha) + g * alpha)
      imgData.data[i++] = Math.round(primaryClamped * (1 - alpha) + b * alpha)
      imgData.data[i++] = 255
    }
  }
  return imgData
}

function drawCanvas(ctx: CanvasRenderingContext2D, imgData: ImageData, viewState: ViewState, width: number, height: number) {
  ctx.clearRect(0, 0, width, height)
  ctx.save()
  ctx.translate(width / 2 + viewState.panX, height / 2 + viewState.panY)
  ctx.scale(viewState.zoom, viewState.zoom)
  ctx.translate(-imgData.width / 2, -imgData.height / 2)
  ctx.putImageData(imgData, 0, 0)
  ctx.restore()
}

function drawCrosshair(ctx: CanvasRenderingContext2D, width: number, height: number, color: string) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.lineWidth = 1
  ctx.setLineDash([4, 4])
  ctx.beginPath()
  ctx.moveTo(width / 2, 0); ctx.lineTo(width / 2, height)
  ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2)
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

function drawRoiOverlay(ctx: CanvasRenderingContext2D, annotations: RoiAnnotation[], viewState: ViewState, canvasW: number, canvasH: number, imgSize: number) {
  ctx.save()
  const scale = viewState.zoom
  const offsetX = canvasW / 2 + viewState.panX - (imgSize * scale) / 2
  const offsetY = canvasH / 2 + viewState.panY - (imgSize * scale) / 2
  for (const ann of annotations) {
    ctx.strokeStyle = ann.color
    ctx.lineWidth = 2 / scale
    ctx.setLineDash([])
    if (ann.tool === 'rectangle' && ann.points.length >= 2) {
      const x1 = offsetX + ann.points[0]!.x * scale
      const y1 = offsetY + ann.points[0]!.y * scale
      const x2 = offsetX + ann.points[1]!.x * scale
      const y2 = offsetY + ann.points[1]!.y * scale
      ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1))
    } else if (ann.tool === 'ellipse' && ann.points.length >= 2) {
      const cx = offsetX + ((ann.points[0]!.x + ann.points[1]!.x) / 2) * scale
      const cy = offsetY + ((ann.points[0]!.y + ann.points[1]!.y) / 2) * scale
      const rx = Math.abs(ann.points[1]!.x - ann.points[0]!.x) * scale / 2
      const ry = Math.abs(ann.points[1]!.y - ann.points[0]!.y) * scale / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
      ctx.stroke()
    } else if (ann.tool === 'freehand' && ann.points.length > 2) {
      ctx.beginPath()
      ctx.moveTo(offsetX + ann.points[0]!.x * scale, offsetY + ann.points[0]!.y * scale)
      for (let i = 1; i < ann.points.length; i++) {
        ctx.lineTo(offsetX + ann.points[i]!.x * scale, offsetY + ann.points[i]!.y * scale)
      }
      ctx.closePath()
      ctx.stroke()
    }
  }
  ctx.restore()
}

function drawOverlayLabel(ctx: CanvasRenderingContext2D, text: string, x: number, y: number) {
  ctx.save()
  ctx.font = '13px ui-monospace, monospace'
  ctx.fillStyle = 'rgba(0,0,0,0.7)'
  ctx.fillRect(x - 2, y - 12, ctx.measureText(text).width + 4, 16)
  ctx.fillStyle = '#facc15'
  ctx.fillText(text, x, y)
  ctx.restore()
}

interface ViewportCanvasProps {
  plane: ViewPlane
  primaryModality: string
  fusionModality: string
  fusionAlpha: number
  sliceIndex: number
  wwl: WWWL
  fusionWWL: WWWL
  viewState: ViewState
  showCrosshair: boolean
  onWheel: (e: React.WheelEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
  onMouseMove: (e: React.MouseEvent) => void
  onMouseUp: () => void
  label: string
  fusionLabel: string
  roiAnnotations: RoiAnnotation[]
  roiTool: RoiTool | null
  onRoiDraw: (ann: RoiAnnotation) => void
}

const ViewportCanvas: React.FC<ViewportCanvasProps> = ({
  plane, primaryModality, fusionModality, fusionAlpha, sliceIndex, wwl, fusionWWL,
  viewState, showCrosshair, onWheel, onMouseDown, onMouseMove, onMouseUp,
  label, fusionLabel, roiAnnotations, roiTool, onRoiDraw,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const size = 256
  const drawingRef = useRef(false)
  const drawPointsRef = useRef<RoiPoint[]>([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const rect = canvas.getBoundingClientRect()
    const w = rect.width
    const h = rect.height

    const primaryData = generateFallbackSlice(plane, sliceIndex, primaryModality as any)
    const fusionData = generateFallbackSlice(plane, sliceIndex, fusionModality as any)

    let imgData: ImageData
    if (fusionAlpha > 0) {
      imgData = applyFusionColor(fusionData, primaryData, fusionAlpha, fusionWWL.ww, fusionWWL.wl)
    } else {
      imgData = applyWWL(primaryData, wwl.ww, wwl.wl)
    }

    drawCanvas(ctx, imgData, viewState, w, h)
    if (showCrosshair) drawCrosshair(ctx, w, h, '#facc15')
    drawRoiOverlay(ctx, roiAnnotations, viewState, w, h, size)
    drawOverlayLabel(ctx, `${label} | ${plane} S:${sliceIndex}`, 6, 14)
    if (fusionAlpha > 0) drawOverlayLabel(ctx, `${fusionLabel} ${Math.round(fusionAlpha * 100)}%`, 6, 32)
  })

  const getImageCoords = (e: React.MouseEvent): RoiPoint => {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const imgDrawSize = size * viewState.zoom
    const offsetX = rect.width / 2 + viewState.panX - imgDrawSize / 2
    const offsetY = rect.height / 2 + viewState.panY - imgDrawSize / 2
    return { x: (mx - offsetX) / viewState.zoom, y: (my - offsetY) / viewState.zoom }
  }

  const handleRoiMouseDown = (e: React.MouseEvent) => {
    if (!roiTool) return
    drawingRef.current = true
    const pt = getImageCoords(e)
    drawPointsRef.current = [pt]
  }

  const handleRoiMouseMove = (e: React.MouseEvent) => {
    if (!drawingRef.current || !roiTool) return
    if (roiTool === 'freehand') {
      drawPointsRef.current.push(getImageCoords(e))
    }
  }

  const handleRoiMouseUp = () => {
    if (!drawingRef.current || !roiTool) return
    drawingRef.current = false
    if (drawPointsRef.current.length > 0) {
      onRoiDraw({
        id: `roi-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tool: roiTool,
        points: [...drawPointsRef.current],
        color: ROI_COLORS[roiAnnotations.length % ROI_COLORS.length]!,
      })
    }
    drawPointsRef.current = []
  }

  const handleWheelInner = (e: React.WheelEvent) => {
    if (roiTool) return
    onWheel(e)
  }

  if (roiTool) {
    return (
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', cursor: 'crosshair', imageRendering: 'pixelated' }}
        onWheel={handleWheelInner}
        onMouseDown={handleRoiMouseDown}
        onMouseMove={handleRoiMouseMove}
        onMouseUp={handleRoiMouseUp}
        onMouseLeave={handleRoiMouseUp}
      />
    )
  }

  return (
    <canvas
      ref={canvasRef}
      style={{ width: '100%', height: '100%', cursor: 'crosshair', imageRendering: 'pixelated' }}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    />
  )
}

const LayoutGrid: React.FC<{
  layout: Layout
  planes: ViewPlane[]
  renderViewport: (plane: ViewPlane, idx: number) => React.ReactNode
}> = ({ layout, planes, renderViewport }) => {
  if (layout === '1x1') {
    return <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>{renderViewport(planes[0]!, 0)}</div>
  }
  if (layout === '1x3') {
    return (
      <div style={{ flex: 1, display: 'flex', gap: 6 }}>
        {planes.map((p, i) => (
          <div key={p} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>{renderViewport(p, i)}</div>
        ))}
      </div>
    )
  }
  if (layout === '2x2') {
    const cells: ViewPlane[] = ['axial', 'coronal', 'sagittal', 'axial']
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[0, 2].map(row => (
          <div key={row} style={{ flex: 1, display: 'flex', gap: 6 }}>
            {cells.slice(row, row + 2).map((p, i) => (
              <div key={`${p}-${i}`} style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>{renderViewport(p, row + i)}</div>
            ))}
          </div>
        ))}
      </div>
    )
  }
  return null
}

export default function FusionV2Page() {
  const [fusionMode, setFusionMode] = useState<FusionMode>('pet-ct')
  const [fusionAlpha, setFusionAlpha] = useState(0.5)
  const [plane, _setPlane] = useState<ViewPlane>('axial')
  const [sliceIndex, setSliceIndex] = useState(64)
  const [showCrosshair, setShowCrosshair] = useState(true)
  const [linkedScroll, setLinkedScroll] = useState(true)
  const [wwl, setWWL] = useState<WWWL>({ ww: FUSION_CT_WW, wl: FUSION_CT_WL })
  const [fusionWWL, setFusionWWL] = useState<WWWL>({ ww: FUSION_PET_WW, wl: FUSION_PET_WL })
  const [viewState, setViewState] = useState<ViewState>({ zoom: 1, panX: 0, panY: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [layout, setLayout] = useState<Layout>('1x1')
  const [transformType, setTransformType] = useState<TransformType>('rigid')
  const [registering, setRegistering] = useState(false)
  const [registerDone, setRegisterDone] = useState(false)
  const [roiTool, setRoiTool] = useState<RoiTool | null>(null)
  const [roiAnnotations, setRoiAnnotations] = useState<RoiAnnotation[]>([])
  const [showRoiStats, setShowRoiStats] = useState(false)

  // [Phase 2] 真实数据接入
  const [patientId, setPatientId] = useState('P000001')
  const [patientInput, setPatientInput] = useState('P000001')
  const [studies, setStudies] = useState<FusionStudyDto[]>([])
  const [studyLoading, setStudyLoading] = useState(false)
  const [selectedStudy, setSelectedStudy] = useState<FusionStudyDto | null>(null)
  const [registration, setRegistration] = useState<FusionRegistrationResult | null>(null)
  const [renderedFrame, setRenderedFrame] = useState<FusionRenderResult | null>(null)
  const [renderLoading, setRenderLoading] = useState(false)
  const [panelOpen, setPanelOpen] = useState(true)

  const loadStudies = useCallback(async (pid: string) => {
    if (!pid.trim()) return
    setStudyLoading(true)
    try {
      const res = await fusionApi.list({ patientId: pid.trim() })
      if (res.success && Array.isArray(res.data)) {
        setStudies(res.data)
        setSelectedStudy(res.data[0] || null)
        if (res.data.length > 0) {
          message.success(`已载入患者 ${pid} 的 ${res.data.length} 组融合检查`)
        } else {
          message.warning('该患者暂无可用融合检查')
        }
      } else {
        message.error('融合检查列表加载失败')
      }
    } catch {
      message.error('融合服务暂不可用')
    } finally {
      setStudyLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadStudies(patientId)
  }, [patientId, loadStudies])

  const runRender = useCallback(async () => {
    if (!registration) return
    setRenderLoading(true)
    try {
      const res = await fusionApi.render({
        registrationId: registration.registrationId,
        plane,
        sliceIndex,
        alpha: fusionAlpha,
        windowWidth: wwl.ww,
        windowLevel: wwl.wl,
      })
      if (res.success && res.data) {
        setRenderedFrame(res.data)
      }
    } catch {
      message.error('融合渲染失败')
    } finally {
      setRenderLoading(false)
    }
  }, [registration, plane, sliceIndex, fusionAlpha, wwl])

  const planes: ViewPlane[] = ['axial', 'coronal', 'sagittal']

  const primaryModality = fusionMode === 'pet-ct' ? 'ct' : fusionMode === 'mr-dwi' ? 'mr' : 'mr'
  const fusionModality = fusionMode === 'pet-ct' ? 'pet' : fusionMode === 'mr-dwi' ? 'dwi' : 'mr'
  const primaryLabel = fusionMode === 'pet-ct' ? 'CT' : fusionMode === 'mr-dwi' ? 'MR' : 'MR T1'
  const fusionLabel = fusionMode === 'pet-ct' ? 'PET' : fusionMode === 'mr-dwi' ? 'DWI' : 'MR T2'

  const handleWheel = useCallback((e: React.WheelEvent) => {
    const delta = e.deltaY > 0 ? -1 : 1
    setSliceIndex(prev => Math.max(0, Math.min(127, prev + delta)))
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.shiftKey) {
      setDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    } else {
      setDragging(true)
      setDragStart({ x: e.clientX, y: e.clientY })
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    if (e.shiftKey) {
      setViewState(prev => ({ ...prev, panX: prev.panX + dx, panY: prev.panY + dy }))
    } else {
      setWWL(prev => ({ ww: Math.max(100, prev.ww + dx), wl: Math.max(-1000, prev.wl + dy) }))
    }
    setDragStart({ x: e.clientX, y: e.clientY })
  }, [dragging, dragStart])

  const handleMouseUp = useCallback(() => setDragging(false), [])

  const handleZoomIn = useCallback(() => setViewState(prev => ({ ...prev, zoom: Math.min(5, prev.zoom * 1.2) })), [])
  const handleZoomOut = useCallback(() => setViewState(prev => ({ ...prev, zoom: Math.max(0.2, prev.zoom / 1.2) })), [])
  const handleReset = useCallback(() => {
    setViewState({ zoom: 1, panX: 0, panY: 0 })
    setWWL({ ww: FUSION_CT_WW, wl: FUSION_CT_WL })
    setFusionWWL({ ww: FUSION_PET_WW, wl: FUSION_PET_WL })
  }, [])

  const handleRegister = useCallback(async () => {
    if (!selectedStudy) {
      message.warning('请先选择融合检查')
      return
    }
    setRegistering(true)
    setRegisterDone(false)
    try {
      const res = await fusionApi.register({
        fixedSeriesUid: selectedStudy.studyUid,
        movingSeriesUid: selectedStudy.studyUid,
        fixedModality: selectedStudy.fixedModality,
        movingModality: selectedStudy.movingModality,
        transformType,
      })
      if (res.success && res.data) {
        setRegistration(res.data)
        setRegisterDone(true)
        message.success(`配准完成（${transformType}）：Dice ${res.data.metrics.dice} · HD95 ${res.data.metrics.hd95}mm`)
        setTimeout(() => setRegisterDone(false), 2000)
        void runRender()
      } else {
        message.error(res.error?.message || '配准失败')
      }
    } catch {
      message.error('配准服务暂不可用')
    } finally {
      setRegistering(false)
    }
  }, [selectedStudy, transformType, runRender])

  const handleRoiDraw = useCallback((ann: RoiAnnotation) => {
    setRoiAnnotations(prev => [...prev, ann])
    setShowRoiStats(true)
  }, [])

  const clearRoi = useCallback(() => {
    setRoiAnnotations([])
    setRoiTool(null)
    setShowRoiStats(false)
  }, [])

  const btnStyle: React.CSSProperties = {
    background: 'transparent', border: '1px solid #334155', color: '#94a3b8',
    borderRadius: 4, padding: '4px 8px', fontSize: 11, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', gap: 3,
  }
  const activeBtnStyle: React.CSSProperties = { ...btnStyle, background: BLUE, borderColor: BLUE, color: '#fff' }
  const greenBtnStyle: React.CSSProperties = { ...btnStyle, background: GREEN, borderColor: GREEN, color: '#fff' }

  const renderViewport = (p: ViewPlane, _idx: number) => (
    <div key={p} style={{ flex: 1, background: CARD_BG, borderRadius: 6, border: '1px solid #1e293b', overflow: 'hidden', position: 'relative' }}>
      <ViewportCanvas
        plane={p}
        primaryModality={primaryModality}
        fusionModality={fusionModality}
        fusionAlpha={fusionAlpha}
        sliceIndex={sliceIndex}
        wwl={wwl}
        fusionWWL={fusionWWL}
        viewState={viewState}
        showCrosshair={showCrosshair}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        label={primaryLabel}
        fusionLabel={fusionLabel}
        roiAnnotations={roiAnnotations}
        roiTool={roiTool}
        onRoiDraw={handleRoiDraw}
      />
    </div>
  )

  return (
    <div data-testid="fusion-v2-page" style={{ minHeight: '100vh', background: '#020617', color: '#cbd5e1', padding: 12 }}>
      {/* Top toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Layers size={18} color={BLUE} />
        <span style={{ fontSize: 15, fontWeight: 700 }}>{t('nav.fusionV2')}</span>
        <div style={{ flex: 1 }} />

        {/* Modal selection */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>{t('fusion.modeSelect')}:</span>
          {(['pet-ct', 'mr-dwi', 'mr-mr'] as const).map(m => (
            <button key={m} style={fusionMode === m ? activeBtnStyle : btnStyle} onClick={() => setFusionMode(m)}>
              {m === 'pet-ct' ? 'PET/CT' : m === 'mr-dwi' ? 'MR/DWI' : 'MR/MR'}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#334155' }} />

        {/* Transform type */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {(['rigid', 'affine', 'deformable', 'nonlinear'] as const).map(tt => (
            <button key={tt} style={transformType === tt ? activeBtnStyle : btnStyle} onClick={() => setTransformType(tt)}>
              {tt === 'rigid' ? t('fusion.rigid') : tt === 'affine' ? t('fusion.affine') : tt === 'deformable' ? t('fusion.deformable') : t('fusion.nonlinear')}
            </button>
          ))}
        </div>

        <button style={registering ? greenBtnStyle : registerDone ? { ...btnStyle, background: '#22c55e', borderColor: '#22c55e', color: '#fff' } : btnStyle} onClick={handleRegister} disabled={registering}>
          {registering ? t('fusion.registerRunning') : registerDone ? t('fusion.registerDone') : t('fusion.register')}
        </button>

        <div style={{ width: 1, height: 20, background: '#334155' }} />

        {/* Layout */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          <Grid3X3 size={12} color="#94a3b8" />
          {(['1x1', '1x3', '2x2'] as const).map(l => (
            <button key={l} style={layout === l ? activeBtnStyle : btnStyle} onClick={() => setLayout(l)}>
              {l === '1x1' ? t('fusion.layout1x1') : l === '1x3' ? t('fusion.layout1x3') : t('fusion.layout2x2')}
            </button>
          ))}
        </div>

        <div style={{ width: 1, height: 20, background: '#334155' }} />

        {/* ROI tools */}
        <div style={{ display: 'flex', gap: 3 }}>
          <button style={roiTool === 'rectangle' ? activeBtnStyle : btnStyle} onClick={() => setRoiTool(roiTool === 'rectangle' ? null : 'rectangle')} title={t('fusion.roiType.rectangle')}>
            <Square size={12} />
          </button>
          <button style={roiTool === 'ellipse' ? activeBtnStyle : btnStyle} onClick={() => setRoiTool(roiTool === 'ellipse' ? null : 'ellipse')} title={t('fusion.roiType.ellipse')}>
            <Circle size={12} />
          </button>
          <button style={roiTool === 'freehand' ? activeBtnStyle : btnStyle} onClick={() => setRoiTool(roiTool === 'freehand' ? null : 'freehand')} title={t('fusion.roiType.freehand')}>
            <Pen size={12} />
          </button>
          {roiAnnotations.length > 0 && (
            <button style={btnStyle} onClick={clearRoi}>{t('dcm.clear')}</button>
          )}
        </div>

        <div style={{ width: 1, height: 20, background: '#334155' }} />

        {/* View controls */}
        <button style={showCrosshair ? activeBtnStyle : btnStyle} onClick={() => setShowCrosshair(v => !v)}>
          <Crosshair size={12} /> {t('fusion.crosshair')}
        </button>
        <button style={linkedScroll ? activeBtnStyle : btnStyle} onClick={() => setLinkedScroll(v => !v)}>
          <Move size={12} /> {t('fusion.linkedScroll')}
        </button>
        <button style={btnStyle} onClick={handleZoomIn}><ZoomIn size={12} /></button>
        <button style={btnStyle} onClick={handleZoomOut}><ZoomOut size={12} /></button>
        <button style={btnStyle} onClick={handleReset}><RotateCw size={12} /></button>
      </div>

      {/* Fusion slider */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center', background: PANEL_BG, borderRadius: 6, padding: '4px 10px' }}>
        <Layers size={14} color={BLUE} />
        <label htmlFor="fusion-v2-alpha" style={{ fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>{t('fusion.opacity')}</label>
        <input
          id="fusion-v2-alpha" type="range" min={0} max={1} step={0.01} value={fusionAlpha}
          onChange={e => setFusionAlpha(parseFloat(e.target.value))}
          style={{ flex: 1, accentColor: BLUE, height: 3 }}
        />
        <span style={{ fontSize: 11, fontWeight: 600, color: '#facc15', minWidth: 40, textAlign: 'right' }}>{Math.round(fusionAlpha * 100)}%</span>
        <span style={{ fontSize: 10, color: '#64748b' }}>{primaryLabel} 0% <Layers size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /> {fusionLabel} 100%</span>
      </div>

      {/* Viewport area */}
      <div style={{ display: 'flex', gap: 8, height: 'calc(100vh - 180px)', minHeight: 400 }}>
        {/* [Phase 2] 检查选择 + 融合结果面板 */}
        <div style={{ width: 280, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
          <div style={{ background: PANEL_BG, borderRadius: 6, padding: 10, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <Database size={13} color={BLUE} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0' }}>检查选择</span>
              <button style={{ marginLeft: 'auto', ...btnStyle, padding: '2px 6px' }} onClick={() => setPanelOpen(v => !v)}>
                {panelOpen ? '收起' : '展开'}
              </button>
            </div>
            {panelOpen && (
              <>
                <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                  <input
                    value={patientInput}
                    onChange={e => setPatientInput(e.target.value)}
                    placeholder="患者ID (如 P000001)"
                    style={{ flex: 1, padding: '6px 8px', background: '#0f172a', border: '1px solid #334155', borderRadius: 4, fontSize: 12, color: '#f8fafc', outline: 'none' }}
                  />
                  <button
                    style={{ ...btnStyle, color: studyLoading ? '#64748b' : BLUE, borderColor: BLUE, whiteSpace: 'nowrap' }}
                    disabled={studyLoading}
                    onClick={() => setPatientId(patientInput.trim() || 'P000001')}
                  >
                    {studyLoading ? <Loader2 size={12} className="spin" /> : '载入'}
                  </button>
                </div>
                {studies.length === 0 ? (
                  <div style={{ fontSize: 11, color: '#64748b', padding: '8px 0', textAlign: 'center' }}>暂无检查，请输入患者ID载入</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {studies.map(s => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedStudy(s)}
                        style={{
                          ...btnStyle, width: '100%', justifyContent: 'flex-start', textAlign: 'left',
                          background: selectedStudy?.id === s.id ? BLUE : 'transparent',
                          borderColor: selectedStudy?.id === s.id ? BLUE : '#334155',
                          color: selectedStudy?.id === s.id ? '#fff' : '#cbd5e1',
                        }}
                      >
                        <span style={{ fontSize: 11 }}>{s.patientName}</span>
                        <span style={{ fontSize: 10, opacity: 0.8, marginLeft: 'auto' }}>{s.fixedModality}+{s.movingModality}</span>
                      </button>
                    ))}
                  </div>
                )}
                {selectedStudy && (
                  <div style={{ marginTop: 8, fontSize: 10, color: '#64748b', lineHeight: 1.7 }}>
                    Study: {selectedStudy.studyUid}<br />
                    序列: {selectedStudy.fixedModality} + {selectedStudy.movingModality}<br />
                    日期: {selectedStudy.studyDate}
                  </div>
                )}
              </>
            )}
          </div>

          {/* 配准结果 */}
          <div style={{ background: PANEL_BG, borderRadius: 6, padding: 10, border: '1px solid #334155' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>
              {t('fusion.registerResult')}
            </div>
            {!registration ? (
              <div style={{ fontSize: 11, color: '#64748b' }}>尚未配准，点击工具栏"配准"按钮执行融合配准</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 8 }}>
                  {[
                    { label: 'Dice', value: registration.metrics.dice, color: '#22c55e' },
                    { label: 'HD95(mm)', value: registration.metrics.hd95, color: '#3b82f6' },
                    { label: 'RMSE', value: registration.metrics.rmse, color: '#facc15' },
                  ].map(m => (
                    <div key={m.label} style={{ background: '#0f172a', borderRadius: 4, padding: '6px 4px', textAlign: 'center' }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: m.color }}>{m.value}</div>
                      <div style={{ fontSize: 10, color: '#64748b' }}>{m.label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>
                  变换类型: {transformType} · 耗时 {registration.processingTimeMs || '-'}ms
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button style={{ ...btnStyle, flex: 1, color: BLUE, borderColor: BLUE }} disabled={renderLoading} onClick={() => void runRender()}>
                    {renderLoading ? <Loader2 size={11} className="spin" /> : <Layers size={11} />} 渲染融合帧
                  </button>
                </div>
                {renderedFrame && renderedFrame.pixelDataBase64 && (
                  <div style={{ marginTop: 8, background: '#0f172a', borderRadius: 4, overflow: 'hidden' }}>
                    <img
                      src={`data:image/png;base64,${renderedFrame.pixelDataBase64}`}
                      alt="融合帧"
                      style={{ width: '100%', display: 'block' }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden' }}>
          <LayoutGrid layout={layout} planes={planes} renderViewport={renderViewport} />

          {/* Sidebar controls */}

          {/* WWL sliders */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: PANEL_BG, borderRadius: 4, padding: '3px 8px' }}>
            <Sun size={10} color={BLUE} />
            <span style={{ fontSize: 10, color: '#94a3b8' }}>{primaryLabel}</span>
            <Minus size={8} />
            <input type="range" min={100} max={4000} value={wwl.ww} onChange={e => setWWL(p => ({ ...p, ww: parseInt(e.target.value) }))} style={{ flex: 1, height: 3, accentColor: BLUE }} />
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 58, textAlign: 'right' }}>WW:{wwl.ww} WL:{wwl.wl}</span>
            <Plus size={8} />
          </div>
          {fusionAlpha > 0 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: PANEL_BG, borderRadius: 4, padding: '3px 8px' }}>
              <Sun size={10} color="#facc15" />
              <span style={{ fontSize: 10, color: '#94a3b8' }}>{fusionLabel}</span>
              <Minus size={8} />
              <input type="range" min={100} max={4000} value={fusionWWL.ww} onChange={e => setFusionWWL(p => ({ ...p, ww: parseInt(e.target.value) }))} style={{ flex: 1, height: 3, accentColor: '#facc15' }} />
              <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 58, textAlign: 'right' }}>WW:{fusionWWL.ww} WL:{fusionWWL.wl}</span>
              <Plus size={8} />
            </div>
          )}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', background: PANEL_BG, borderRadius: 4, padding: '3px 8px' }}>
            <span style={{ fontSize: 10, color: '#64748b' }}>{t('fusion.slice')}</span>
            <Minus size={8} />
            <input type="range" min={0} max={127} value={sliceIndex} onChange={e => setSliceIndex(parseInt(e.target.value))} style={{ flex: 1, height: 3, accentColor: BLUE }} />
            <span style={{ fontSize: 10, color: '#94a3b8', minWidth: 28, textAlign: 'right' }}>{sliceIndex}</span>
            <Plus size={8} />
          </div>

          {/* ROI stats */}
          {showRoiStats && roiAnnotations.length > 0 && (
            <div style={{ background: PANEL_BG, borderRadius: 4, padding: '4px 8px', display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10 }}>
              <span style={{ color: '#94a3b8' }}>{t('fusion.roiOverlay')}: {roiAnnotations.length}</span>
              {roiAnnotations.map((ann, i) => (
                <span key={ann.id} style={{ color: ann.color }}>
                  #{i + 1}: {ann.tool === 'rectangle' ? '□' : ann.tool === 'ellipse' ? '○' : '✎'} ({ann.points.length} pts)
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 4, fontSize: 10, color: '#475569', textAlign: 'center' }}>
        {t('fusion.hint')}
      </div>
    </div>
  )
}
