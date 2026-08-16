// [G005 v3.0.6.11-101 Wave 3B] 影像测量 V2 (多工具测量族完整化) + 标注 V2 (双向同步深化)
//  - 完整 8 工具工具栏: 直线/角度/椭圆面积/矩形面积/多边形面积/折线长度/Cobb角/钙化评分
//  - 属性面板: 数值/单位/标签 (可编辑) / 公式 / 确定性
//  - 标注双向同步: 前端 canvas 绘制 ↔ 后端标注对象 (measurement-v2 模块)
//  - 历史版本: 每次更新快照, 支持回滚
import { useState, useEffect, useCallback, useRef } from 'react'
import { Ruler, Triangle, Circle as CircleIcon, Square, Activity, Trash2, Eye as EyeIcon, EyeOff, FileText, Bone, ScanLine, Route, History, RotateCcw, Link2, PenTool, RefreshCw, HeartPulse } from 'lucide-react'
const RectIcon = Square
import type { Dispatch, SetStateAction } from 'react'
import type { MeasureSubMenu, Measurement, RightTab, Tool, MeasureV2Type, Point2D, MeasureV2Record, MeasureV2Version, AnnotationV2Type, AnnotationV2Record, AnnotationV2Version } from './DicomViewerTypes'
import { MEASURE_V2_META, MEASURE_V2_TOOL_ORDER, computeMeasureV2 } from './DicomViewerTypes'
import { measurementV2Api } from '../../services/api/measurementV2Api'

const PRIMARY = '#1e40af'

// 默认同步目标检查 (后端 seed 检查 / 无真实检查时的演示值)
const DEFAULT_STUDY_UID = '1.2.826.0.1.3680043.10.155.3.0.6.11.CT.1'
const DEFAULT_SPACING: [number, number] = [0.68, 0.68]
const CANVAS_SIZE = 512

const V2_TOOL_ICONS: Record<MeasureV2Type, React.ReactNode> = {
  line: <Ruler size={14} />,
  angle: <Triangle size={14} />,
  ellipseArea: <CircleIcon size={14} />,
  rectangleArea: <RectIcon size={14} />,
  polygonArea: <ScanLine size={14} />,
  polyline: <Route size={14} />,
  cobb: <Bone size={14} />,
  calciumScore: <HeartPulse size={14} />,
}

const V2_TOOL_HINT: Record<MeasureV2Type, string> = {
  line: '直线长度 (2点)',
  angle: '角度 (顶点+2点)',
  ellipseArea: '椭圆面积 (2点对角)',
  rectangleArea: '矩形面积 (2点对角)',
  polygonArea: '多边形面积 (≥3点+完成)',
  polyline: '折线长度 (≥2点+完成)',
  cobb: 'Cobb角 (两条线/4点)',
  calciumScore: '钙化评分 (逐点 HU+完成)',
}

const ANN_TYPE_LABEL: Record<AnnotationV2Type, string> = {
  text: '文字',
  arrow: '箭头',
  rect: '矩形',
  ellipse: '椭圆',
  freehand: '自由线',
}

interface V2SceneOptions {
  v2Tool: MeasureV2Type | null
  v2Draft: Point2D[]
  v2Records: MeasureV2Record[]
  selectedV2Id: string | null
  annType: AnnotationV2Type | null
  annDraft: Point2D[]
  annRecords: AnnotationV2Record[]
  annText: string
}

/** V2 画布渲染: 已完成测量 + 草稿 + 后端标注对象 (双向同步展示) */
function drawV2Scene(ctx: CanvasRenderingContext2D, o: V2SceneOptions) {
  ctx.fillStyle = '#0f172a'
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
  ctx.strokeStyle = '#1e293b'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= CANVAS_SIZE; i += 64) {
    ctx.moveTo(i, 0)
    ctx.lineTo(i, CANVAS_SIZE)
    ctx.moveTo(0, i)
    ctx.lineTo(CANVAS_SIZE, i)
  }
  ctx.stroke()

  const dot = (p: Point2D, color: string, r = 4) => {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  const text = (x: number, y: number, label: string, color: string, size = 11) => {
    ctx.fillStyle = color
    ctx.font = `${size}px monospace`
    ctx.fillText(label, x, y)
  }

  // 已完成 V2 测量
  for (const m of o.v2Records) {
    const color = m.color
    const pts = m.points
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    const isSel = m.id === o.selectedV2Id
    ctx.setLineDash(isSel ? [] : [])
    if (m.type === 'line' && pts.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      ctx.lineTo(pts[1]!.x, pts[1]!.y)
      ctx.stroke()
      dot(pts[0]!, color)
      dot(pts[1]!, color)
      text((pts[0]!.x + pts[1]!.x) / 2 - 30, (pts[0]!.y + pts[1]!.y) / 2 - 6, `${m.value}${m.unit}`, color)
    } else if (m.type === 'angle' && pts.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(pts[1]!.x, pts[1]!.y)
      ctx.lineTo(pts[0]!.x, pts[0]!.y)
      ctx.moveTo(pts[1]!.x, pts[1]!.y)
      ctx.lineTo(pts[2]!.x, pts[2]!.y)
      ctx.stroke()
      pts.forEach((p) => dot(p, color))
      text(pts[1]!.x + 12, pts[1]!.y - 8, `${m.value}${m.unit}`, color)
    } else if (m.type === 'ellipseArea' && pts.length >= 2) {
      const cx = (pts[0]!.x + pts[1]!.x) / 2
      const cy = (pts[0]!.y + pts[1]!.y) / 2
      ctx.beginPath()
      ctx.ellipse(cx, cy, Math.abs(pts[1]!.x - pts[0]!.x) / 2, Math.abs(pts[1]!.y - pts[0]!.y) / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      dot(pts[0]!, color)
      dot(pts[1]!, color)
      text(cx - 40, cy - 8, `${m.label}`, color)
    } else if (m.type === 'rectangleArea' && pts.length >= 2) {
      const x = Math.min(pts[0]!.x, pts[1]!.x)
      const y = Math.min(pts[0]!.y, pts[1]!.y)
      ctx.strokeRect(x, y, Math.abs(pts[1]!.x - pts[0]!.x), Math.abs(pts[1]!.y - pts[0]!.y))
      dot(pts[0]!, color)
      dot(pts[1]!, color)
      text(x + 4, y - 6, `${m.value}${m.unit}`, color)
    } else if (m.type === 'polygonArea' && pts.length >= 3) {
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
      ctx.closePath()
      ctx.stroke()
      pts.forEach((p) => dot(p, color, 3))
      text(pts[0]!.x + 6, pts[0]!.y + 4, `${m.value}${m.unit}`, color)
    } else if (m.type === 'polyline' && pts.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
      ctx.stroke()
      pts.forEach((p) => dot(p, color, 3))
      text(pts[0]!.x + 6, pts[0]!.y - 6, `${m.value}${m.unit}`, color)
    } else if (m.type === 'cobb' && pts.length >= 4) {
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      ctx.lineTo(pts[1]!.x, pts[1]!.y)
      ctx.moveTo(pts[2]!.x, pts[2]!.y)
      ctx.lineTo(pts[3]!.x, pts[3]!.y)
      ctx.stroke()
      pts.forEach((p) => dot(p, color))
      text(pts[1]!.x + 8, pts[1]!.y - 8, `Cobb ${m.value}${m.unit}`, color, 12)
    } else if (m.type === 'calciumScore' && pts.length >= 1) {
      pts.forEach((p) => {
        ctx.fillStyle = 'rgba(139,92,246,0.35)'
        ctx.beginPath()
        ctx.arc(p.x, p.y, 12, 0, Math.PI * 2)
        ctx.fill()
      })
      pts.forEach((p) => dot(p, color))
      text(pts[0]!.x - 40, Math.max(14, pts[0]!.y - 16), `Agatston ${m.value}${m.unit}`, color)
    }
    if (isSel) {
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = '#fbbf24'
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.rect(2, 2, CANVAS_SIZE - 4, CANVAS_SIZE - 4)
      ctx.stroke()
      ctx.setLineDash([])
    }
  }

  // 草稿点 (V2 测量绘制中)
  if (o.v2Draft.length > 0) {
    o.v2Draft.forEach((p, i) => {
      dot(p, '#22c55e', 5)
      if (i > 0) {
        ctx.strokeStyle = '#22c55e'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(o.v2Draft[i - 1]!.x, o.v2Draft[i - 1]!.y)
        ctx.lineTo(p.x, p.y)
        ctx.stroke()
      }
    })
    text(6, 20, o.v2Tool ? `${V2_TOOL_HINT[o.v2Tool]} · 已取 ${o.v2Draft.length} 点` : '', '#86efac')
  }

  // 后端标注对象 (双向同步渲染)
  for (const a of o.annRecords) {
    const color = a.color
    const pts = a.pixelPoints
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.setLineDash([4, 3])
    if (a.type === 'text' && pts.length >= 1) {
      text(pts[0]!.x + 6, pts[0]!.y - 4, a.text || '标注', color, a.fontSize / 1.4)
    } else if (a.type === 'arrow' && pts.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      ctx.lineTo(pts[1]!.x, pts[1]!.y)
      ctx.stroke()
      dot(pts[0]!, color, 3)
      const ang = Math.atan2(pts[1]!.y - pts[0]!.y, pts[1]!.x - pts[0]!.x)
      const hl = 10
      ctx.beginPath()
      ctx.moveTo(pts[1]!.x, pts[1]!.y)
      ctx.lineTo(pts[1]!.x - hl * Math.cos(ang - 0.5), pts[1]!.y - hl * Math.sin(ang - 0.5))
      ctx.moveTo(pts[1]!.x, pts[1]!.y)
      ctx.lineTo(pts[1]!.x - hl * Math.cos(ang + 0.5), pts[1]!.y - hl * Math.sin(ang + 0.5))
      ctx.stroke()
      if (a.text) text((pts[0]!.x + pts[1]!.x) / 2 + 6, (pts[0]!.y + pts[1]!.y) / 2 - 6, a.text, color)
    } else if (a.type === 'rect' && pts.length >= 2) {
      const x = Math.min(pts[0]!.x, pts[1]!.x)
      const y = Math.min(pts[0]!.y, pts[1]!.y)
      ctx.strokeRect(x, y, Math.abs(pts[1]!.x - pts[0]!.x), Math.abs(pts[1]!.y - pts[0]!.y))
      if (a.text) text(x + 4, y - 6, a.text, color)
    } else if (a.type === 'ellipse' && pts.length >= 2) {
      ctx.beginPath()
      ctx.ellipse((pts[0]!.x + pts[1]!.x) / 2, (pts[0]!.y + pts[1]!.y) / 2, Math.abs(pts[1]!.x - pts[0]!.x) / 2, Math.abs(pts[1]!.y - pts[0]!.y) / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      if (a.text) text((pts[0]!.x + pts[1]!.x) / 2 - 20, Math.min(pts[0]!.y, pts[1]!.y) - 6, a.text, color)
    } else if (a.type === 'freehand' && pts.length >= 2) {
      ctx.beginPath()
      ctx.moveTo(pts[0]!.x, pts[0]!.y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i]!.x, pts[i]!.y)
      ctx.stroke()
    }
    ctx.setLineDash([])
  }

  // 标注草稿
  if (o.annDraft.length > 0) {
    ctx.strokeStyle = '#fbbf24'
    ctx.lineWidth = 1.5
    ctx.setLineDash([2, 2])
    ctx.beginPath()
    ctx.moveTo(o.annDraft[0]!.x, o.annDraft[0]!.y)
    for (let i = 1; i < o.annDraft.length; i++) ctx.lineTo(o.annDraft[i]!.x, o.annDraft[i]!.y)
    ctx.stroke()
    o.annDraft.forEach((p) => dot(p, '#fbbf24', 4))
    ctx.setLineDash([])
    if (o.annType === 'text' && o.annText) {
      text(o.annDraft[0]!.x + 8, o.annDraft[0]!.y + 4, o.annText, '#fbbf24', 12)
    }
    text(6, CANVAS_SIZE - 8, `标注绘制中 (${o.annType ?? ''}) · ${o.annDraft.length} 点`, '#fbbf24')
  }

  if (!o.v2Tool && !o.annType && o.v2Draft.length === 0 && o.annDraft.length === 0) {
    text(12, 24, '选择 V2 工具后点击画布取点', '#64748b')
  }
}

const s = {
  infoSection: { marginBottom: 12 } as React.CSSProperties,
  infoSectionTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 } as React.CSSProperties,
  measureItem: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 8, marginBottom: 6, border: '1px solid var(--border-color)' } as React.CSSProperties,
  measureItemColor: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 } as React.CSSProperties,
  measureItemInfo: { flex: 1, minWidth: 0 } as React.CSSProperties,
  measureItemValue: { fontSize: 13, fontWeight: 700, color: '#1e293b' } as React.CSSProperties,
  measureItemType: { fontSize: 12, color: '#94a3b8', textTransform: 'capitalize' as const } as React.CSSProperties,
  measureListItem: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #f1f5f9' } as React.CSSProperties,
  measureListItemLeft: { display: 'flex', alignItems: 'center', gap: 8 } as React.CSSProperties,
  measureListItemDot: { width: 8, height: 8, borderRadius: '50%' } as React.CSSProperties,
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' } as React.CSSProperties,
  v2ToolBtn: { flex: 1, minWidth: 56, padding: '6px 2px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2 } as React.CSSProperties,
  v2ToolBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' } as React.CSSProperties,
  canvas: { width: '100%', borderRadius: 8, border: '1px solid var(--border-color)', cursor: 'crosshair', display: 'block' } as React.CSSProperties,
  propRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f1f5f9', fontSize: 12 } as React.CSSProperties,
  propLabel: { color: '#94a3b8' } as React.CSSProperties,
  propValue: { fontWeight: 700, color: '#1e40af' } as React.CSSProperties,
  badge: { fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, whiteSpace: 'nowrap' } as React.CSSProperties,
  smallBtn: { padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 11, fontWeight: 600, cursor: 'pointer', color: '#475569', display: 'flex', alignItems: 'center', gap: 3 } as React.CSSProperties,
  smallBtnPrimary: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' } as React.CSSProperties,
  smallBtnDanger: { background: '#fee2e2', borderColor: '#fecaca', color: '#dc2626' } as React.CSSProperties,
  input: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  versionItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 4, fontSize: 11 } as React.CSSProperties,
  annItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 4, border: '1px solid var(--border-color)', fontSize: 11 } as React.CSSProperties,
}

interface Props {
  rightTab: RightTab
  measureSubMenu: MeasureSubMenu
  setMeasureSubMenu: (m: MeasureSubMenu) => void
  setActiveTool: Dispatch<SetStateAction<Tool>>
  interactiveMeasures: Measurement[]
  showMeasurementsOverlay: boolean
  setShowMeasurementsOverlay: (v: boolean) => void
  deleteMeasure: (id: string) => void
  clearAllMeasures: () => void
  getMeasureTypeLabel: (type: string) => string
  measurements: { length: any[]; angle: any[]; ct: any[]; area: any[]; lines?: any[]; angles?: any[]; ellipses?: any[]; rectangles?: any[]; circles?: any[] }
  showToast: (msg: string) => void
  // [G005 v3.0.6.11-101 Wave 3B] 可选: 双向同步目标检查 (缺省使用 seed 检查)
  studyUid?: string
}

export default function MeasurementPanel(props: Props) {
  const { rightTab, measureSubMenu, setMeasureSubMenu, setActiveTool, interactiveMeasures, showMeasurementsOverlay, setShowMeasurementsOverlay, deleteMeasure, clearAllMeasures, getMeasureTypeLabel, measurements, showToast, studyUid } = props

  // ── V2 测量状态 ──
  const [v2Tool, setV2Tool] = useState<MeasureV2Type | null>(null)
  const [v2Draft, setV2Draft] = useState<Point2D[]>([])
  const [v2Records, setV2Records] = useState<MeasureV2Record[]>([])
  const [selectedV2Id, setSelectedV2Id] = useState<string | null>(null)
  const [v2LabelDraft, setV2LabelDraft] = useState('')
  const [v2Versions, setV2Versions] = useState<MeasureV2Version[]>([])
  const [v2VersionsFor, setV2VersionsFor] = useState<string | null>(null)
  const [v2Synced, setV2Synced] = useState(false)
  const [v2Busy, setV2Busy] = useState(false)

  // ── 标注 V2 (双向同步) 状态 ──
  const [annType, setAnnType] = useState<AnnotationV2Type | null>(null)
  const [annDraft, setAnnDraft] = useState<Point2D[]>([])
  const [annText, setAnnText] = useState('')
  const [annRecords, setAnnRecords] = useState<AnnotationV2Record[]>([])
  const [annVersions, setAnnVersions] = useState<AnnotationV2Version[]>([])
  const [annVersionsFor, setAnnVersionsFor] = useState<string | null>(null)
  const [annSynced, setAnnSynced] = useState(false)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const currentStudyUid = studyUid?.trim() || DEFAULT_STUDY_UID

  // ── 双向同步: 加载后端测量/标注 ──
  const refreshV2Measurements = useCallback(async () => {
    try {
      const list = await measurementV2Api.listMeasurements(currentStudyUid)
      setV2Records(list)
      setV2Synced(true)
    } catch {
      /* 后端不可达: 保持本地状态 */
    }
  }, [currentStudyUid])

  const refreshV2Annotations = useCallback(async () => {
    try {
      const list = await measurementV2Api.listAnnotations(currentStudyUid)
      setAnnRecords(list)
      setAnnSynced(true)
    } catch {
      /* 后端不可达: 保持本地状态 */
    }
  }, [currentStudyUid])

  useEffect(() => {
    void refreshV2Measurements()
    void refreshV2Annotations()
  }, [refreshV2Measurements, refreshV2Annotations])

  // 选中测量 → 属性面板同步标签
  useEffect(() => {
    const sel = v2Records.find((r) => r.id === selectedV2Id)
    setV2LabelDraft(sel?.label ?? '')
    setV2Versions([])
    setV2VersionsFor(null)
  }, [selectedV2Id, v2Records])

  // 画布重绘
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawV2Scene(ctx, {
      v2Tool,
      v2Draft,
      v2Records,
      selectedV2Id,
      annType,
      annDraft,
      annRecords,
      annText,
    })
  }, [v2Tool, v2Draft, v2Records, selectedV2Id, annType, annDraft, annRecords, annText])

  const selectedV2 = v2Records.find((r) => r.id === selectedV2Id) ?? null

  // ── V2 测量取点 (canvas 点击) ──
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const p: Point2D = {
      x: Math.round(((e.clientX - rect.left) * CANVAS_SIZE) / rect.width),
      y: Math.round(((e.clientY - rect.top) * CANVAS_SIZE) / rect.height),
    }
    if (annType) {
      setAnnDraft((prev) => [...prev, p])
      return
    }
    if (!v2Tool) return
    const fixed = MEASURE_V2_META[v2Tool].fixedPoints
    const next = [...v2Draft, p]
    if (fixed > 0 && next.length >= fixed) {
      void finishV2Measurement(v2Tool, next)
    } else {
      setV2Draft(next)
    }
  }, [v2Tool, v2Draft, annType])

  // ── V2 测量完成: 本地计算 + 后端同步 ──
  const finishV2Measurement = useCallback(async (type: MeasureV2Type, points: Point2D[]) => {
    const result = computeMeasureV2(type, points, DEFAULT_SPACING)
    setV2Tool(null)
    setV2Draft([])
    const local: MeasureV2Record = {
      id: `mv2-local-${Date.now().toString(36)}`,
      studyUid: currentStudyUid,
      seriesUid: '',
      type,
      points: points.map((p) => ({ ...p })),
      worldPoints: points.map((p) => ({ x: Math.round(p.x * DEFAULT_SPACING[0] * 100) / 100, y: Math.round(p.y * DEFAULT_SPACING[1] * 100) / 100 })),
      value: result.value,
      unit: result.unit,
      label: `${MEASURE_V2_META[type].label} ${result.value} ${result.unit}`,
      color: '#22c55e',
      visible: true,
      formula: result.formula,
      deterministic: result.deterministic,
      createdBy: 'viewer-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      versions: [],
      annotationId: null,
    }
    setV2Records((prev) => [...prev, local])
    setSelectedV2Id(local.id)
    try {
      const server = await measurementV2Api.createMeasurement({
        studyUid: currentStudyUid,
        type,
        points,
        pixelSpacing: DEFAULT_SPACING,
        label: local.label,
        color: local.color,
      })
      setV2Records((prev) => prev.map((r) => (r.id === local.id ? server : r)))
      setV2Synced(true)
      showToast(`测量已同步: ${MEASURE_V2_META[type].label} ${result.value} ${result.unit}`)
    } catch {
      showToast(`测量已保存 (离线): ${MEASURE_V2_META[type].label} ${result.value} ${result.unit}`)
    }
  }, [currentStudyUid, showToast])

  const cancelV2Draft = useCallback(() => {
    setV2Tool(null)
    setV2Draft([])
  }, [])

  // ── 属性面板: 标签编辑 / 删除 ──
  const saveV2Label = useCallback(async () => {
    const sel = selectedV2
    if (!sel) return
    setV2Busy(true)
    try {
      const updated = await measurementV2Api.updateMeasurement(sel.id, { label: v2LabelDraft })
      setV2Records((prev) => prev.map((r) => (r.id === sel.id ? updated : r)))
      showToast('标签已更新')
    } catch {
      setV2Records((prev) => prev.map((r) => (r.id === sel.id ? { ...r, label: v2LabelDraft } : r)))
      showToast('标签已更新 (离线)')
    } finally {
      setV2Busy(false)
    }
  }, [selectedV2, v2LabelDraft, showToast])

  const removeV2Measurement = useCallback(async (id: string) => {
    setV2Records((prev) => prev.filter((r) => r.id !== id))
    if (selectedV2Id === id) setSelectedV2Id(null)
    try {
      await measurementV2Api.removeMeasurement(id)
      showToast('测量已删除')
    } catch {
      showToast('测量已删除 (离线)')
    }
  }, [selectedV2Id, showToast])

  // ── 历史版本: 查看 / 回滚 ──
  const openV2Versions = useCallback(async (id: string) => {
    setV2VersionsFor(id)
    setV2Versions([])
    try {
      setV2Versions(await measurementV2Api.getMeasurementVersions(id))
    } catch {
      setV2Versions([])
    }
  }, [])

  const rollbackV2 = useCallback(async (id: string, version: number) => {
    try {
      const rec = await measurementV2Api.rollbackMeasurement(id, version)
      setV2Records((prev) => prev.map((r) => (r.id === id ? rec : r)))
      setV2Versions(await measurementV2Api.getMeasurementVersions(id))
      showToast(`已回滚到 v${version}`)
    } catch {
      showToast('回滚失败: 后端不可达')
    }
  }, [showToast])

  // ── 标注 V2: 完成绘制 → 后端同步 ──
  const finishAnnotation = useCallback(async () => {
    if (!annType || annDraft.length === 0) return
    const points = annDraft
    const local: AnnotationV2Record = {
      id: `av2-local-${Date.now().toString(36)}`,
      studyUid: currentStudyUid,
      seriesUid: '',
      type: annType,
      pixelPoints: points.map((p) => ({ ...p })),
      worldPoints: points.map((p) => ({ x: Math.round(p.x * DEFAULT_SPACING[0] * 100) / 100, y: Math.round(p.y * DEFAULT_SPACING[1] * 100) / 100 })),
      text: annText.trim(),
      color: '#ff4d4f',
      fontSize: 16,
      visible: true,
      locked: false,
      measurementId: null,
      createdBy: 'viewer-user',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      versions: [],
    }
    setAnnType(null)
    setAnnDraft([])
    setAnnText('')
    try {
      const server = await measurementV2Api.createAnnotation({
        studyUid: currentStudyUid,
        type: annType,
        pixelPoints: points,
        pixelSpacing: DEFAULT_SPACING,
        text: annText.trim(),
        color: '#ff4d4f',
        fontSize: 16,
      })
      setAnnRecords((prev) => [...prev, server])
      setAnnSynced(true)
      showToast('标注已同步到后端')
    } catch {
      setAnnRecords((prev) => [...prev, local])
      showToast('标注已保存 (离线)')
    }
  }, [annType, annDraft, annText, currentStudyUid, showToast])

  const cancelAnnotation = useCallback(() => {
    setAnnType(null)
    setAnnDraft([])
    setAnnText('')
  }, [])

  const removeAnnotation = useCallback(async (id: string) => {
    setAnnRecords((prev) => prev.filter((a) => a.id !== id))
    if (annVersionsFor === id) {
      setAnnVersionsFor(null)
      setAnnVersions([])
    }
    try {
      await measurementV2Api.removeAnnotation(id)
      showToast('标注已删除')
    } catch {
      showToast('标注已删除 (离线)')
    }
  }, [annVersionsFor, showToast])

  const openAnnVersions = useCallback(async (id: string) => {
    setAnnVersionsFor(id)
    setAnnVersions([])
    try {
      setAnnVersions(await measurementV2Api.getAnnotationVersions(id))
    } catch {
      setAnnVersions([])
    }
  }, [])

  const rollbackAnnotation = useCallback(async (id: string, version: number) => {
    try {
      const rec = await measurementV2Api.rollbackAnnotation(id, version)
      setAnnRecords((prev) => prev.map((a) => (a.id === id ? rec : a)))
      setAnnVersions(await measurementV2Api.getAnnotationVersions(id))
      showToast(`标注已回滚到 v${version}`)
    } catch {
      showToast('回滚失败: 后端不可达')
    }
  }, [showToast])

  // ── 标注 ↔ 测量 关联 ──
  const linkAnnToMeasurement = useCallback(async (annId: string) => {
    const sel = selectedV2
    if (!sel) {
      showToast('请先选中一个 V2 测量')
      return
    }
    try {
      const result = await measurementV2Api.linkAnnotation(sel.id, annId)
      setAnnRecords((prev) => prev.map((a) => (a.id === annId ? result.annotation : a)))
      setV2Records((prev) => prev.map((r) => (r.id === sel.id ? result.measurement : r)))
      showToast('标注已关联到测量')
    } catch {
      showToast('关联失败: 后端不可达')
    }
  }, [selectedV2, showToast])

  const v2VariableTool = v2Tool !== null && MEASURE_V2_META[v2Tool].fixedPoints === 0

  if (rightTab !== 'measure') return null

  return (
    <>
      {/* ── 传统 ROI 测量 (兼容) ── */}
      <div style={s.infoSection}>
        <div style={s.infoSectionTitle}>ROI测量工具</div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {(['length', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue', 'cobb', 'polygon'] as MeasureSubMenu[]).map(type => (
            <button key={type} style={{
              flex: 1, minWidth: 60, padding: '6px 4px', borderRadius: 6, border: `1px solid ${measureSubMenu === type ? PRIMARY : '#e2e8f0'}`,
              background: measureSubMenu === type ? PRIMARY : '#fff', color: measureSubMenu === type ? '#fff' : '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2
            }} onClick={() => { setMeasureSubMenu(type); setActiveTool('measure') }}>
              {type === 'length' && <Ruler size={14} />}{type === 'angle' && <Triangle size={14} />}{type === 'ellipse' && <CircleIcon size={14} />}{type === 'rectangle' && <RectIcon size={14} />}{type === 'circle' && <CircleIcon size={14} />}{type === 'ctvalue' && <Activity size={14} />}{type === 'cobb' && <Bone size={14} />}{type === 'polygon' && <ScanLine size={14} />}
              {type === 'length' ? '长度' : type === 'angle' ? '角度' : type === 'ellipse' ? '椭圆' : type === 'rectangle' ? '矩形' : type === 'circle' ? '圆形' : type === 'ctvalue' ? 'CT值' : type === 'cobb' ? 'Cobb角' : '多边形'}
            </button>
          ))}
        </div>
      </div>

      {/* ── 测量 V2: 完整 8 工具 ── */}
      <div style={{ ...s.infoSection, border: '1px solid #bfdbfe', borderRadius: 10, padding: 10, background: '#f8fbff' }}>
        <div style={{ ...s.infoSectionTitle, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><PenTool size={12} />影像测量 V2</span>
          <span style={{ ...s.badge, background: v2Synced ? '#dcfce7' : '#fef3c7', color: v2Synced ? '#16a34a' : '#d97706' }}>
            {v2Synced ? '后端已同步' : '本地模式'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
          {MEASURE_V2_TOOL_ORDER.map(type => (
            <button key={type} style={{ ...s.v2ToolBtn, ...(v2Tool === type ? s.v2ToolBtnActive : {}) }}
              onClick={() => { setV2Tool(v2Tool === type ? null : type); setV2Draft([]) }}
              title={`${MEASURE_V2_META[type].label} · ${V2_TOOL_HINT[type]}`}>
              {V2_TOOL_ICONS[type]}
              {MEASURE_V2_META[type].label}
            </button>
          ))}
        </div>
        <canvas
          ref={canvasRef}
          width={CANVAS_SIZE}
          height={CANVAS_SIZE}
          style={s.canvas}
          onClick={handleCanvasClick}
          data-testid="mv2-canvas"
        />
        <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#64748b', flex: 1 }}>
            {v2Tool ? `${V2_TOOL_HINT[v2Tool]} · 单位 ${MEASURE_V2_META[v2Tool].unit} · 确定性 ✓` : annType ? `标注绘制: ${ANN_TYPE_LABEL[annType]} (点击画布取点)` : '选择工具后点击画布测量'}
          </span>
          {v2Draft.length > 0 && (
            <>
              {v2VariableTool && (
                <button style={{ ...s.smallBtn, ...s.smallBtnPrimary }} onClick={() => { if (v2Tool) void finishV2Measurement(v2Tool, v2Draft) }}>完成</button>
              )}
              <button style={s.smallBtn} onClick={cancelV2Draft}>取消</button>
            </>
          )}
        </div>

        {/* ── 属性面板 (数值/单位/标签) ── */}
        {selectedV2 && (
          <div style={{ marginTop: 8, border: '1px solid #dbeafe', borderRadius: 8, padding: 8, background: '#fff' }}>
            <div style={{ ...s.infoSectionTitle, marginBottom: 4 }}>
              <CircleIcon size={11} />属性面板
              <span style={{ ...s.badge, background: '#dbeafe', color: PRIMARY, marginLeft: 'auto' }}>{MEASURE_V2_META[selectedV2.type].label}</span>
            </div>
            <div style={s.propRow}><span style={s.propLabel}>数值</span><span style={s.propValue}>{selectedV2.value} {selectedV2.unit}</span></div>
            <div style={s.propRow}><span style={s.propLabel}>公式</span><span style={{ fontSize: 11, color: '#64748b' }}>{selectedV2.formula}</span></div>
            <div style={s.propRow}><span style={s.propLabel}>确定性</span><span style={{ color: selectedV2.deterministic ? '#16a34a' : '#d97706', fontWeight: 700 }}>{selectedV2.deterministic ? '确定性计算 ✓' : '近似'}</span></div>
            <div style={s.propRow}><span style={s.propLabel}>版本</span><span style={{ color: '#64748b', fontWeight: 700 }}>v{selectedV2.version}</span></div>
            <div style={s.propRow}>
              <span style={s.propLabel}>世界坐标</span>
              <span style={{ fontSize: 10, color: '#64748b' }}>{selectedV2.worldPoints.slice(0, 2).map(p => `(${p.x},${p.y})`).join(' ') || '-'}</span>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              <input style={s.input} value={v2LabelDraft} onChange={e => setV2LabelDraft(e.target.value)} placeholder="测量标签..." />
              <button style={{ ...s.smallBtn, ...s.smallBtnPrimary }} onClick={() => void saveV2Label()} disabled={v2Busy}>保存</button>
            </div>
            <div style={{ display: 'flex', gap: 4, marginTop: 6, flexWrap: 'wrap' }}>
              <button style={s.smallBtn} onClick={() => void openV2Versions(selectedV2.id)}><History size={11} />版本历史</button>
              <button style={{ ...s.smallBtn, ...s.smallBtnDanger }} onClick={() => void removeV2Measurement(selectedV2.id)}><Trash2 size={11} />删除</button>
            </div>
            {v2VersionsFor === selectedV2.id && (
              <div style={{ marginTop: 6, maxHeight: 120, overflowY: 'auto' }}>
                <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>历史版本 ({v2Versions.length})</div>
                {v2Versions.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>暂无版本记录</div>}
                {v2Versions.map(v => (
                  <div key={v.version} style={s.versionItem}>
                    <span style={{ fontWeight: 700, color: PRIMARY, width: 26 }}>v{v.version}</span>
                    <span style={{ flex: 1, color: '#475569' }}>{v.label || `${v.value}${v.unit}`}</span>
                    <span style={{ color: '#94a3b8' }}>{v.note}</span>
                    <button style={{ ...s.smallBtn, padding: '1px 6px' }} onClick={() => void rollbackV2(selectedV2.id, v.version)}><RotateCcw size={10} />回滚</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── V2 测量列表 ── */}
        <div style={{ marginTop: 8 }}>
          <div style={{ ...s.infoSectionTitle, justifyContent: 'space-between' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>V2 测量 ({v2Records.length})</span>
            <button style={{ ...s.smallBtn, padding: '1px 6px' }} onClick={() => void refreshV2Measurements()}><RefreshCw size={10} />同步</button>
          </div>
          {v2Records.length === 0 ? (
            <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>暂无 V2 测量</div>
          ) : (
            v2Records.map(m => (
              <div key={m.id} style={{ ...s.measureItem, padding: '6px 8px', cursor: 'pointer', borderColor: selectedV2Id === m.id ? PRIMARY : 'var(--border-color)' }}
                onClick={() => setSelectedV2Id(m.id)}>
                <div style={{ ...s.measureItemColor, background: m.color }} />
                <div style={s.measureItemInfo}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 110 }}>{m.label}</span>
                    <span style={{ ...s.badge, background: '#dbeafe', color: PRIMARY }}>{MEASURE_V2_META[m.type].label}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>{m.value} {m.unit} · v{m.version}{m.annotationId ? ' · 🔗' : ''}</div>
                </div>
                <button style={{ width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={e => { e.stopPropagation(); void removeV2Measurement(m.id) }}><Trash2 size={12} color="#ef4444" /></button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 标注 V2 双向同步 ── */}
      <div style={{ ...s.infoSection, border: '1px solid #ddd6fe', borderRadius: 10, padding: 10, background: '#fdfaff' }}>
        <div style={{ ...s.infoSectionTitle, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Link2 size={12} />标注双向同步</span>
          <span style={{ ...s.badge, background: annSynced ? '#dcfce7' : '#fef3c7', color: annSynced ? '#16a34a' : '#d97706' }}>
            {annSynced ? '后端已同步' : '本地模式'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 4, marginBottom: 6, flexWrap: 'wrap' }}>
          {(Object.keys(ANN_TYPE_LABEL) as AnnotationV2Type[]).map(t => (
            <button key={t} style={{ ...s.v2ToolBtn, minWidth: 48, padding: '4px 2px', ...(annType === t ? s.v2ToolBtnActive : {}) }}
              onClick={() => { setAnnType(annType === t ? null : t); setAnnDraft([]) }}>
              {t === 'text' ? 'T' : t === 'arrow' ? '↗' : t === 'rect' ? '▭' : t === 'ellipse' ? '◯' : '✎'}
              {ANN_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        {annType === 'text' && (
          <input style={{ ...s.input, marginBottom: 6 }} value={annText} onChange={e => setAnnText(e.target.value)} placeholder="标注文字..." />
        )}
        <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
          {annDraft.length > 0 && (
            <>
              <button style={{ ...s.smallBtn, ...s.smallBtnPrimary }} onClick={() => void finishAnnotation()}>完成标注</button>
              <button style={s.smallBtn} onClick={cancelAnnotation}>取消</button>
            </>
          )}
        </div>
        <div style={{ ...s.infoSectionTitle, marginTop: 4, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>标注对象 ({annRecords.length})</span>
          <button style={{ ...s.smallBtn, padding: '1px 6px' }} onClick={() => void refreshV2Annotations()}><RefreshCw size={10} />同步</button>
        </div>
        {annRecords.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8', textAlign: 'center', padding: '8px 0' }}>暂无标注对象 (在画布上选择标注类型后点击绘制)</div>
        ) : (
          annRecords.map(a => (
            <div key={a.id} style={s.annItem}>
              <div style={{ ...s.measureItemColor, background: a.color, borderRadius: 2 }} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontWeight: 700, color: '#1e293b' }}>{a.text || ANN_TYPE_LABEL[a.type]}</span>
                <span style={{ color: '#94a3b8', marginLeft: 4 }}>{ANN_TYPE_LABEL[a.type]} · {a.pixelPoints.length}点{a.measurementId ? ' · 🔗' : ''}</span>
              </span>
              <button style={{ ...s.smallBtn, padding: '1px 6px' }} title="关联到选中测量" onClick={() => void linkAnnToMeasurement(a.id)}><Link2 size={10} /></button>
              <button style={{ ...s.smallBtn, padding: '1px 6px' }} onClick={() => void openAnnVersions(a.id)}><History size={10} /></button>
              <button style={{ ...s.smallBtn, padding: '1px 6px', ...s.smallBtnDanger }} onClick={() => void removeAnnotation(a.id)}><Trash2 size={10} /></button>
            </div>
          ))
        )}
        {annVersionsFor && (
          <div style={{ marginTop: 6, maxHeight: 100, overflowY: 'auto', border: '1px solid #ede9fe', borderRadius: 6, padding: 6 }}>
            <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>标注版本 ({annVersions.length})</div>
            {annVersions.length === 0 && <div style={{ fontSize: 11, color: '#94a3b8' }}>暂无版本记录</div>}
            {annVersions.map(v => (
              <div key={v.version} style={s.versionItem}>
                <span style={{ fontWeight: 700, color: PRIMARY, width: 26 }}>v{v.version}</span>
                <span style={{ flex: 1, color: '#475569' }}>{v.text || ANN_TYPE_LABEL[v.type]}</span>
                <span style={{ color: '#94a3b8' }}>{v.note}</span>
                <button style={{ ...s.smallBtn, padding: '1px 6px' }} onClick={() => void rollbackAnnotation(annVersionsFor, v.version)}><RotateCcw size={10} />回滚</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 测量结果 (传统) ── */}
      <div style={s.infoSection}>
        <div style={{ ...s.infoSectionTitle, justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>测量结果 ({interactiveMeasures.length})</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button style={{ padding: '2px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none', background: showMeasurementsOverlay ? PRIMARY : '#e2e8f0', color: showMeasurementsOverlay ? '#fff' : '#64748b', display: 'flex', alignItems: 'center', gap: 3 }} onClick={() => setShowMeasurementsOverlay(!showMeasurementsOverlay)}>
              {showMeasurementsOverlay ? <EyeIcon size={10} /> : <EyeOff size={10} />}{showMeasurementsOverlay ? '显示' : '隐藏'}
            </button>
          </div>
        </div>
        {interactiveMeasures.length === 0 ? (
          <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 0', textAlign: 'center' }}>
            <Ruler size={24} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>暂无测量数据</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>选择ROI工具后点击图像开始测量</div>
          </div>
        ) : (
          interactiveMeasures.map(measure => (
            <div key={measure.id} style={s.measureItem}>
              <div style={{ ...s.measureItemColor, background: (measure as any).color || '#22c55e' }} />
              <div style={s.measureItemInfo}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={s.measureItemValue}>{measure.label || `${measure.value} ${measure.unit}`}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 8, background: '#dbeafe', color: '#1e40af', whiteSpace: 'nowrap' }}>{getMeasureTypeLabel(measure.type)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#1e40af' }}>{measure.value} {measure.unit}</span>
                  {measure.location && <span style={{ fontSize: 11, color: '#94a3b8' }}>· {measure.location}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                <button style={{ width: 24, height: 24, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => deleteMeasure(measure.id)}><Trash2 size={12} color="#ef4444" /></button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── 历史测量数据 (传统) ── */}
      <div style={s.infoSection}>
        <div style={s.infoSectionTitle}>历史测量数据</div>
        <div style={s.infoSection}>
          <div style={s.infoSectionTitle}>长度测量</div>
          {measurements.length.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>暂无长度测量数据</div>
          ) : (
            measurements.length.map((m: any) => (
              <div key={m.id} style={s.measureListItem}>
                <div style={s.measureListItemLeft}>
                  <div style={{ ...s.measureListItemDot, background: '#22c55e' }} />
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{m.value} {m.unit}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{m.location}</div></div>
                </div>
              </div>
            ))
          )}
        </div>
        <div style={s.infoSection}>
          <div style={s.infoSectionTitle}>CT值(HU)</div>
          {measurements.ct.length === 0 ? (
            <div style={{ fontSize: 12, color: '#94a3b8', padding: '8px 0', textAlign: 'center' }}>暂无CT值测量数据</div>
          ) : (
            measurements.ct.map((m: any) => (
              <div key={m.id} style={s.measureListItem}>
                <div style={s.measureListItemLeft}>
                  <div style={{ ...s.measureListItemDot, background: '#3b82f6' }} />
                  <div><div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b' }}>{m.value} {m.unit}</div><div style={{ fontSize: 12, color: '#94a3b8' }}>{m.location}</div></div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button style={{ ...s.reportBtn, background: '#f0f4f8', color: '#475569', flex: 1 }} onClick={clearAllMeasures}><Trash2 size={14} />清除全部</button>
        <button style={{ ...s.reportBtn, background: '#22c55e', color: '#fff', flex: 1 }} onClick={() => {
          const allMeasures = [...interactiveMeasures]
          const reportText = allMeasures.length > 0 ? allMeasures.map(m => `${m.label}: ${m.value}${m.unit}`).join('\n') : '暂无测量数据'
          navigator.clipboard.writeText(reportText); showToast('测量报告已复制到剪贴板')
        }}><FileText size={14} />导出报告</button>
      </div>
    </>
  )
}
