import { useRef, useEffect, useMemo } from 'react'
import { DicomCanvas, type MeasureSubMenuInternal } from './DicomCanvas'
import type { Series, DicomImage, Tool, PseudoColorMode, ViewMode, CompareLayout, MipDirection } from './types'
import { getPresetsForModality } from '../../utils/modalityPresets'

const PRIMARY = '#1e3a5f'

const s = {
  imageMain: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    cursor: 'crosshair',
  },
  imageWrapper: {
    position: 'relative' as const,
    border: '2px solid #334155',
    background: '#000',
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayTL: {
    position: 'absolute' as const,
    top: 8, left: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  overlayTR: {
    position: 'absolute' as const,
    top: 8, right: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 3,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'right' as const,
  },
  overlayBL: {
    position: 'absolute' as const,
    bottom: 8, left: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
  },
  overlayBR: {
    position: 'absolute' as const,
    bottom: 8, right: 8,
    background: 'rgba(0,0,0,0.75)',
    borderRadius: 6,
    padding: '6px 10px',
    color: '#fff',
    fontSize: 12,
    zIndex: 10,
    border: '1px solid rgba(255,255,255,0.1)',
    textAlign: 'right' as const,
  },
  compareSplitContainer: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  compareSplitPane: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
    position: 'relative' as const,
  },
  compareDivider: {
    width: 4,
    background: PRIMARY,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compareDividerHandle: {
    width: 12,
    height: 40,
    background: PRIMARY,
    borderRadius: 6,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'col-resize',
    color: '#fff',
    fontSize: 12,
    fontWeight: 700,
  },
  compareLabel: {
    position: 'absolute' as const,
    top: 8, left: 8,
    background: 'rgba(30,58,95,0.9)',
    color: '#fff',
    padding: '3px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 700,
    zIndex: 10,
  },
  compareLabelRight: {
    left: 'auto',
    right: 8,
  },
  diffRegion: {
    position: 'absolute' as const,
    border: '2px dashed #ef4444',
    background: 'rgba(239,68,68,0.15)',
    borderRadius: 4,
  },
  diffRegionNew: {
    border: '2px dashed #22c55e',
    background: 'rgba(34,197,94,0.15)',
  },
  diffRegionImproved: {
    border: '2px dashed #3b82f6',
    background: 'rgba(59,130,246,0.15)',
  },
  vrmCanvasContainer: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#111',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  annotationSvg: {
    position: 'absolute' as const,
    top: 0, left: 0,
    width: '100%',
    height: '100%',
    pointerEvents: 'none' as const,
  },
}

interface MIPCanvasProps {
  mipDirection: MipDirection
  mipFrame: number
  totalFrames: number
  ww: number
  wl: number
}

function MIPCanvas({ mipDirection, mipFrame, ww, wl }: MIPCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const w = 512, h = 512
    canvas.width = w; canvas.height = h
    const imageData = ctx.createImageData(w, h)
    const data = imageData.data
    for (let py = 0; py < h; py++) {
      for (let px = 0; px < w; px++) {
        const idx = (py * w + px) * 4
        const dx = px - w / 2, dy = py - h / 2
        const dist = Math.sqrt(dx * dx + dy * dy)
        let maxVal = 0
        const steps = mipDirection === 'axial' ? 60 : 40
        for (let s = 0; s < steps; s++) {
          const offset = (s / steps - 0.5) * 120
          let v = 15
          if (dist < 200) {
            const nx = dx / 200, ny = (dy + offset) / 200
            const lungL = Math.sqrt((dx + 80) ** 2 + (dy + offset + 20) ** 2)
            const lungR = Math.sqrt((dx - 80) ** 2 + (dy + offset + 20) ** 2)
            if (lungL < 55 || lungR < 55) v = 15
            else {
              v = 45 + Math.sin(nx * 3 + ny * 2) * 8
              const heart = Math.sqrt((dx - 10) ** 2 + (dy + offset + 30) ** 2)
              if (heart < 60) v = 55 + Math.sin(nx * 5 + ny * 4) * 6
              if (Math.abs(dx) < 20 && dy + offset > 80 && dy + offset < 110) v = 70
            }
          }
          if (v > maxVal) maxVal = v
        }
        const minV = wl - ww / 2, maxV = wl + ww / 2
        const norm = Math.max(0, Math.min(1, (maxVal - minV) / (maxV - minV)))
        const gray = Math.round(norm * 255)
        data[idx] = gray; data[idx + 1] = gray; data[idx + 2] = gray; data[idx + 3] = 255
      }
    }
    ctx.putImageData(imageData, 0, 0)
  }, [mipDirection, mipFrame, ww, wl])
  return <canvas ref={canvasRef} style={{ width: 512, height: 512, imageRendering: 'pixelated' }} />
}

function VRCanvas({ rotX, rotY, rotZ, opacity }: { rotX: number; rotY: number; rotZ: number; opacity: number }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<any>(null)
  const rendererRef = useRef<any>(null)
  const animationRef = useRef<number>(0)

  useEffect(() => {
    if (!containerRef.current) return
    const THREE = require('three')
    const container = containerRef.current
    const w = container.clientWidth || 512
    const h = container.clientHeight || 512
    const scene = new THREE.Scene()
    sceneRef.current = scene
    const camera = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, 1000)
    camera.position.z = 500
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setSize(w, h)
    renderer.setClearColor(0x000000, 0)
    container.innerHTML = ''
    container.appendChild(renderer.domElement)
    rendererRef.current = renderer
    const geometry = new THREE.BoxGeometry(w * 0.6, h * 0.6, 100)
    const material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: { uOpacity: { value: opacity }, uTime: { value: 0 } },
      vertexShader: `varying vec3 vPosition; varying vec3 vNormal; void main() { vPosition = position; vNormal = normalMatrix * normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `uniform float uOpacity; uniform float uTime; varying vec3 vPosition; varying vec3 vNormal; void main() { float dist = length(vPosition.xy) / 200.0; float edge = 1.0 - smoothstep(0.5, 1.0, dist); vec3 color = mix(vec3(0.1, 0.3, 0.6), vec3(0.2, 0.7, 0.9), edge); float alpha = edge * uOpacity * 0.7; gl_FragColor = vec4(color, alpha); }`,
    })
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)
    const edges = new THREE.EdgesGeometry(geometry)
    const lineMat = new THREE.LineBasicMaterial({ color: 0x4a90d9, linewidth: 1 })
    const wireframe = new THREE.LineSegments(edges, lineMat)
    scene.add(wireframe)
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate)
      material.uniforms.uTime.value += 0.01
      renderer.render(scene, camera)
    }
    animate()
    return () => { cancelAnimationFrame(animationRef.current); renderer.dispose(); geometry.dispose(); material.dispose() }
  }, [])

  useEffect(() => {
    if (!sceneRef.current) return
    const scene = sceneRef.current
    scene.rotation.set((rotX * Math.PI) / 180, (rotY * Math.PI) / 180, (rotZ * Math.PI) / 180)
  }, [rotX, rotY, rotZ])

  useEffect(() => {
    if (!sceneRef.current) return
    sceneRef.current.traverse((obj: any) => {
      if (obj.material && obj.material.uniforms && obj.material.uniforms.uOpacity) obj.material.uniforms.uOpacity.value = opacity
    })
  }, [opacity])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}

interface WindowPreset { name: string; ww: number; wl: number }

interface DicomViewportGridProps {
  // DicomCanvas props
  zoom: number; rotation: number; flipH: boolean; flipV: boolean
  ww: number; wl: number; brightness: number; contrast: number
  activeTool: Tool; panX: number; panY: number
  activeSeries: Series; imageIndex: number; images: DicomImage[]
  pseudoColorMode?: PseudoColorMode
  onWheel: (deltaY: number, deltaX: number) => void

  // View mode
  viewMode: ViewMode
  mipDirection: MipDirection; mipFrame: number
  vrRotX: number; vrRotY: number; vrRotZ: number; vrOpacity: number

  // Exam info
  patientName: string; accessionNumber: string
  examItemName: string; deviceName: string; examDate: string

  // Layout
  gridConfig: { cols: number; rows: number }

  // Compare mode
  isCompareMode: boolean
  compareExamDate?: string
  showDiffHighlight: boolean
  syncScroll: boolean
  compareImageIndex: number
  diffRegions: { id: string; x: number; y: number; w: number; h: number; type: 'increase' | 'new' | 'improved' }[]

  // Overlays
  showMeasurementsOverlay: boolean
  measureSubMenu: string | null
  isDrawingMeasure: boolean
  drawingPoints: { x: number; y: number }[]
  interactiveMeasures: any[]
  showAnnotationsOverlay: boolean
  annotations: any[]
  ww: number; wl: number

  // Popups
  showWlPopup: boolean
  showPseudoColorPanel: boolean
  showAnnotationPanel: boolean
  activePresetIdx: number | null
  WINDOW_PRESETS: WindowPreset[]
  pseudoColorMode: PseudoColorMode
  pseudoColorTools: { mode: PseudoColorMode; icon: React.ReactNode; label: string }[]
  annotationTypes: { type: string; icon: React.ReactNode; label: string }[]
  activeAnnotationType: string
  activeAnnotationColor: string
  activeAnnotationFontSize: number
  annotations: any[]
  selectedAnnotationId: string | null
  ANNOTATION_COLORS: string[]
  ANNOTATION_COLOR_NAMES: Record<string, string>

  // Handlers
  onSetWw: (v: number) => void
  onSetWl: (v: number) => void
  onSetActivePresetIdx: (i: number | null) => void
  onSetMeasureSubMenu: (v: string | null) => void
  onSetPseudoColorMode: (v: PseudoColorMode) => void
  onSetActiveAnnotationType: (v: string) => void
  onSetActiveAnnotationColor: (v: string) => void
  onSetActiveAnnotationFontSize: (v: number) => void
  onSetSelectedAnnotationId: (v: string | null) => void
  onSetShowWlPopup: (v: boolean) => void
  onSetShowPseudoColorPanel: (v: boolean) => void
  onSetShowAnnotationPanel: (v: boolean) => void
  onClearAllMeasures: () => void
  onClearAllAnnotations: () => void
  onToggleAnnotationVisibility: (id: string) => void
  onToggleAnnotationLock: (id: string) => void
  onDeleteAnnotation: (id: string) => void
}

export default function DicomViewportGrid(props: DicomViewportGridProps) {
  const {
    zoom, rotation, flipH, flipV, ww, wl, brightness, contrast,
    activeTool, panX, panY, activeSeries, imageIndex, images,
    pseudoColorMode, onWheel,
    viewMode, mipDirection, mipFrame, vrRotX, vrRotY, vrRotZ, vrOpacity,
    patientName, accessionNumber, examItemName, deviceName, examDate,
    gridConfig,
    isCompareMode, compareExamDate, showDiffHighlight, syncScroll, compareImageIndex, diffRegions,
    showMeasurementsOverlay, measureSubMenu, isDrawingMeasure, drawingPoints, interactiveMeasures,
    showAnnotationsOverlay, annotations,
  } = props

  const currentImage = images[imageIndex] || images[0]

  // Get current presets based on modality (unified with dicomWeb.WINDOW_PRESETS_LIST)
  const currentPresets = useMemo(() => getPresetsForModality(activeSeries.modality), [activeSeries.modality])

  const renderCanvas = (overrideImageIndex?: number) => {
    const imgIdx = overrideImageIndex !== undefined ? overrideImageIndex : imageIndex
    if (viewMode === 'MIP') {
      return (
        <div style={s.vrmCanvasContainer}>
          <MIPCanvas mipDirection={mipDirection} mipFrame={mipFrame} totalFrames={images.length} ww={ww} wl={wl} />
        </div>
      )
    }
    if (viewMode === 'VR') {
      return (
        <div style={s.vrmCanvasContainer}>
          <VRCanvas rotX={vrRotX} rotY={vrRotY} rotZ={vrRotZ} opacity={vrOpacity} />
        </div>
      )
    }
    return (
      <DicomCanvas
        zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV}
        ww={ww} wl={wl} brightness={brightness} contrast={contrast}
        activeTool={activeTool} panX={panX} panY={panY}
        windowPreset="" measureType={measureSubMenu as MeasureSubMenuInternal}
        activeSeries={activeSeries} imageIndex={imgIdx} images={images}
        pseudoColorMode={pseudoColorMode} onWheel={onWheel}
      />
    )
  }

  return (
    <div
      id="image-main-area"
      style={isCompareMode ? { ...s.imageMain, display: 'flex' } : s.imageMain}
    >
      {isCompareMode ? (
        <div style={s.compareSplitContainer}>
          <div style={s.compareSplitPane}>
            <span style={s.compareLabel}>当前: {examDate}</span>
            <div style={{ ...s.imageWrapper, width: '100%', height: '100%' }}>
              {renderCanvas()}
              {showDiffHighlight && diffRegions.map(region => (
                <div key={region.id} style={{
                  ...s.diffRegion,
                  ...(region.type === 'increase' ? {} : region.type === 'new' ? s.diffRegionNew : s.diffRegionImproved),
                  left: region.x, top: region.y, width: region.w, height: region.h,
                }} />
              ))}
            </div>
            <div style={s.overlayBL}>
              <span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span>
              <span style={{ color: '#86efac' }}>Img:{imageIndex + 1}/{images.length}</span>
            </div>
            <div style={s.overlayBR}>
              <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
            </div>
          </div>
          <div style={s.compareDivider}>
            <div style={s.compareDividerHandle}>⋮</div>
          </div>
          <div style={s.compareSplitPane}>
            <span style={{ ...s.compareLabel, ...s.compareLabelRight }}>
              历史: {compareExamDate}
            </span>
            <div style={{ ...s.imageWrapper, width: '100%', height: '100%' }}>
              {renderCanvas(syncScroll ? imageIndex : compareImageIndex)}
              {showDiffHighlight && diffRegions.map(region => (
                <div key={`r-${region.id}`} style={{
                  ...s.diffRegion,
                  ...(region.type === 'increase' ? {} : region.type === 'new' ? s.diffRegionNew : s.diffRegionImproved),
                  left: region.x, top: region.y, width: region.w, height: region.h,
                }} />
              ))}
            </div>
            <div style={s.overlayBL}>
              <span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span>
              <span style={{ color: '#86efac' }}>
                Img:{syncScroll ? imageIndex + 1 : compareImageIndex + 1}/{images.length}
              </span>
            </div>
            <div style={s.overlayBR}>
              <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
              {!syncScroll && <span style={{ color: '#fbbf24' }}>独立滚动</span>}
            </div>
          </div>
        </div>
      ) : (
        <div style={{
          ...s.imageWrapper,
          width: gridConfig.cols === 2 ? 'calc(50% - 4px)' : '100%',
          height: gridConfig.rows === 2 ? 'calc(50% - 4px)' : '100%',
        }}>
          {renderCanvas()}

          <div style={s.overlayTL}>
            <span style={{ color: '#60a5fa', fontWeight: 700 }}>{patientName}</span>
            <span style={{ color: '#94a3b8' }}>#{accessionNumber}</span>
            <span style={{ color: '#86efac' }}>{examItemName}</span>
            {viewMode !== 'MPR' && <span style={{ color: '#fbbf24' }}>{viewMode}模式</span>}
          </div>

          <div style={s.overlayTR}>
            <span style={{ color: '#fbbf24' }}>{deviceName.split('（')[0]}</span>
            <span style={{ color: '#f87171' }}>Ser:{activeSeries.seriesNumber} Img:{currentImage?.imageNumber || 1}</span>
            <span style={{ color: '#a5f3fc' }}>{activeSeries.seriesDescription}</span>
          </div>

          <div style={{ ...s.overlayBL, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>WW:{Math.round(ww)}</span>
              <span style={{ color: '#f87171', fontWeight: 700 }}>WL:{Math.round(wl)}</span>
            </div>
            <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
              {currentPresets.map((p, i) => (
                <button
                  key={p.name}
                  onClick={() => { props.onSetWw(p.ww); props.onSetWl(p.wl); props.onSetActivePresetIdx(i) }}
                  style={{
                    padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)',
                    background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12,
                    fontWeight: 600, cursor: 'pointer',
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <span style={{ color: '#86efac', fontSize: 12 }}>滚轮调整WW/WL</span>
          </div>

          <div style={s.overlayBR}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#60a5fa', fontSize: 12 }}>WW</span>
              <input type="range" min={50} max={4000} value={ww}
                onChange={e => { props.onSetWw(Number(e.target.value)); props.onSetActivePresetIdx(null) }}
                style={{ width: 80, accentColor: '#60a5fa' }} />
              <input type="number" value={Math.round(ww)}
                onChange={e => { props.onSetWw(Number(e.target.value)); props.onSetActivePresetIdx(null) }}
                style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#60a5fa' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#f87171', fontSize: 12 }}>WL</span>
              <input type="range" min={-1000} max={1000} value={wl}
                onChange={e => { props.onSetWl(Number(e.target.value)); props.onSetActivePresetIdx(null) }}
                style={{ width: 80, accentColor: '#f87171' }} />
              <input type="number" value={Math.round(wl)}
                onChange={e => { props.onSetWl(Number(e.target.value)); props.onSetActivePresetIdx(null) }}
                style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#f87171' }} />
            </div>
            <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
            <span style={{ color: '#a5f3fc' }}>
              {flipH ? 'FH ' : ''}{flipV ? 'FV ' : ''}Bright:{brightness}% Contrast:{contrast}%
            </span>
            {measureSubMenu && (
              <span style={{ color: '#fbbf24' }}>
                测量模式:{measureSubMenu === 'length' ? '长度' : measureSubMenu === 'angle' ? '角度' : measureSubMenu === 'area' ? '面积' : 'CT值'}
              </span>
            )}
            {pseudoColorMode && pseudoColorMode !== 'none' && (
              <span style={{ color: '#f97316' }}>
                伪彩:{pseudoColorMode === 'hotIron' ? '热铁' : pseudoColorMode === 'coolBlue' ? '冷蓝' : pseudoColorMode === 'pet' ? 'PET' : '软组织'}
              </span>
            )}
          </div>

          {/* Measurement SVG overlay */}
          {showMeasurementsOverlay && (measureSubMenu || isDrawingMeasure || interactiveMeasures.length > 0) && (
            <svg style={s.annotationSvg}>
              {interactiveMeasures.map((measure: any) => {
                if (measure.points.length < 1) return null
                const pts = measure.points
                const color = measure.color || '#22c55e'

                if (measure.type === 'line' && pts.length >= 2) {
                  return (
                    <g key={measure.id}>
                      <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} stroke={color} strokeWidth={2} />
                      <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={color} />
                      <circle cx={pts[1].x} cy={pts[1].y} r={4} fill={color} />
                      <text x={(pts[0].x + pts[1].x) / 2} y={(pts[0].y + pts[1].y) / 2 - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">
                        {measure.value}{measure.unit}
                      </text>
                    </g>
                  )
                }
                if (measure.type === 'ellipse' && pts.length >= 2) {
                  const cx = (pts[0].x + pts[1].x) / 2; const cy = (pts[0].y + pts[1].y) / 2
                  const rx = Math.abs(pts[1].x - pts[0].x) / 2; const ry = Math.abs(pts[1].y - pts[0].y) / 2
                  return (
                    <g key={measure.id}>
                      <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
                      <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={color} />
                      <circle cx={pts[1].x} cy={pts[1].y} r={4} fill={color} />
                      <text x={cx} y={cy - ry - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.label}</text>
                    </g>
                  )
                }
                if (measure.type === 'rectangle' && pts.length >= 2) {
                  const x = Math.min(pts[0].x, pts[1].x); const y = Math.min(pts[0].y, pts[1].y)
                  const w = Math.abs(pts[1].x - pts[0].x); const h = Math.abs(pts[1].y - pts[0].y)
                  return (
                    <g key={measure.id}>
                      <rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
                      <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={color} />
                      <circle cx={pts[1].x} cy={pts[1].y} r={4} fill={color} />
                      <text x={x + w / 2} y={y - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.label}</text>
                    </g>
                  )
                }
                if (measure.type === 'circle' && pts.length >= 2) {
                  const r = Math.sqrt(Math.pow(pts[1].x - pts[0].x, 2) + Math.pow(pts[1].y - pts[0].y, 2))
                  return (
                    <g key={measure.id}>
                      <circle cx={pts[0].x} cy={pts[0].y} r={r} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
                      <circle cx={pts[0].x} cy={pts[0].y} r={4} fill={color} />
                      <circle cx={pts[1].x} cy={pts[1].y} r={4} fill={color} />
                      <text x={pts[0].x} y={pts[0].y - r - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.label}</text>
                    </g>
                  )
                }
                if (measure.type === 'ctvalue' && pts.length >= 1) {
                  return (
                    <g key={measure.id}>
                      <circle cx={pts[0].x} cy={pts[0].y} r={10} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
                      <text x={pts[0].x + 15} y={pts[0].y + 5} fill={color} fontSize={12} fontFamily="monospace">{measure.value}{measure.unit}</text>
                    </g>
                  )
                }
                if ((measure.type === 'angle' || measure.type === 'area') && pts.length >= 3) {
                  const pathData = pts.map((p: any, i: number) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + ' Z'
                  return (
                    <g key={measure.id}>
                      <path d={pathData} fill={color} fillOpacity={0.2} stroke={color} strokeWidth={2} />
                      {pts.map((p: any, i: number) => <circle key={i} cx={p.x} cy={p.y} r={4} fill={color} />)}
                      <text x={pts[0].x} y={pts[0].y - 10} fill={color} fontSize={12} fontFamily="monospace">{measure.label}</text>
                    </g>
                  )
                }
                return null
              })}
              {isDrawingMeasure && drawingPoints.map((point, idx) => (
                <circle key={`draw-${idx}`} cx={point.x} cy={point.y} r={5} fill="#22c55e" stroke="#fff" strokeWidth={2} />
              ))}
            </svg>
          )}

          {/* Annotation SVG overlay */}
          {showAnnotationsOverlay && annotations.length > 0 && (
            <svg style={s.annotationSvg}>
              {annotations.filter((a: any) => a.visible).map((ann: any) => {
                if (ann.type === 'text') {
                  return <text key={ann.id} x={ann.x} y={ann.y} fill={ann.color} fontSize={ann.fontSize} fontFamily="PingFang SC, Microsoft YaHei, sans-serif" fontWeight="bold">{ann.text}</text>
                }
                if (ann.type === 'arrow' && ann.x2 !== undefined && ann.y2 !== undefined) {
                  return (
                    <g key={ann.id}>
                      <line x1={ann.x} y1={ann.y} x2={ann.x2} y2={ann.y2} stroke={ann.color} strokeWidth={2} />
                      <circle cx={ann.x2} cy={ann.y2} r={3} fill={ann.color} />
                    </g>
                  )
                }
                if (ann.type === 'rect' && ann.x2 !== undefined && ann.y2 !== undefined) {
                  return <rect key={ann.id} x={Math.min(ann.x, ann.x2)} y={Math.min(ann.y, ann.y2)} width={Math.abs(ann.x2 - ann.x)} height={Math.abs(ann.y2 - ann.y)} fill="transparent" stroke={ann.color} strokeWidth={2} strokeDasharray="5,3" />
                }
                return null
              })}
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
