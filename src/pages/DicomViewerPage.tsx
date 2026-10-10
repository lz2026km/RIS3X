import ViewerSelector from '../components/common/ViewerSelector'
import { t } from '../i18n/appI18n'
import AppModal from '../components/common/AppModal'
import { THEME_TOKENS } from '../components/common/ThemeTokens'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ZoomIn, Move, Sun, RotateCw, FlipHorizontal, FlipVertical,
  RefreshCw, Ruler, Play, Pause, Printer, PenTool,
  EyeOff, CheckCircle, Activity, Type, ArrowUpRight, Square as RectIcon,
  Circle as CircleIcon, Flame, Droplets, Wind,
} from 'lucide-react'
import { initialRadiologyExams } from '../data/initialData'
import { examApi, printApi } from '../services/api'
import { similarCaseApi } from '../services/api/similarCaseApi'
import type { SimilarCaseResult } from '../services/api/similarCaseApi'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import type { Series, DicomImage, HistoryExam, Measurement, Annotation, Tool, MeasureSubMenu, LayoutMode, RightTab, AnnotationType, PseudoColorMode, CompareLayout, ViewMode, MipDirection, WindowPreset } from './dicom/DicomViewerTypes'
import { ANNOTATION_COLORS, PRIMARY } from './dicom/DicomViewerTypes'
import { getPresetsForModality, CT_DEFAULT_WW, CT_DEFAULT_WL } from '../utils/modalityPresets'
import type { GsofMode } from '../utils/gsdf'
import ToolbarSection from './dicom/ToolbarSection'
import ViewportArea from './dicom/ViewportArea'
import SidebarPanel from './dicom/SidebarPanel'
import { HangingProtocolPanel } from '../components/dicom/HangingProtocolPanel'

const s = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100vh', background: '#0f172a', color: '#e2e8f0', overflow: 'hidden', fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif" },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  statusBar: { display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: '4px 12px', background: '#1e293b', borderTop: '1px solid #334155', fontSize: 12, color: 'var(--text-muted, #94a3b8)', flexShrink: 0 },
  layoutBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-color)', background: THEME_TOKENS.bgCard, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' } as React.CSSProperties,
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', justifyContent: 'center' } as React.CSSProperties,
}

export default function DicomViewerPage() {
  const [selectedExamIdx, setSelectedExamIdx] = useState(0)
  const [exams, setExams] = useState(initialRadiologyExams)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await examApi.list({})
      if (cancelled) return
      // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
      if (res.success && Array.isArray(list) && list.length > 0) {
        setExams(list as unknown as typeof initialRadiologyExams)
        setLoadError(null)
      } else {
        setExams(initialRadiologyExams)
        setLoadError(t('dicomViewer.apiUnavailable'))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const exam = exams[selectedExamIdx]
  // [W3-C] 历史检查: 接 examApi.list({patientId}) 真实历史, 不再空数组
  const [historyExams, setHistoryExams] = useState<HistoryExam[]>([])

  useEffect(() => {
    if (!exam?.patientId) return
    let cancelled = false
    void (async () => {
      try {
        const res = await examApi.list({ patientId: exam.patientId, pageSize: 50 } as never)
        if (cancelled) return
        const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        const mapped: HistoryExam[] = (list as Array<Record<string, any>>)
          .filter((e) => String(e.id ?? e.examId ?? '') !== String(exam.id))
          .map((e) => ({
            id: String(e.id ?? e.examId ?? ''),
            examId: String(e.examId ?? e.id ?? ''),
            examDate: e.examDate ?? e.scheduledAt ?? '',
            examTime: e.examTime ?? '',
            examItemName: e.examItemName ?? e.examItem ?? t('dicomViewer.unknownExam'),
            modality: e.modality ?? '',
            bodyPart: e.bodyPart ?? '',
            deviceName: e.deviceName ?? '',
            status: e.status ?? t('dicomViewer.statusCompleted'),
            reportDate: e.reportDate,
            reportDoctor: e.reportDoctor,
            finding: e.finding ?? e.examFindings,
            conclusion: e.conclusion ?? e.diagnosis,
          }))
        setHistoryExams(mapped)
      } catch {
        if (!cancelled) setHistoryExams([])
      }
    })()
    return () => { cancelled = true }
  }, [exam?.patientId, exam?.id])
  const [seriesList] = useState<Series[]>(() => {
    if (exam.modality === 'CT') return [{ id: 's1', seriesNumber: 1, seriesDescription: '横断面-肺窗', modality: 'CT', imageCount: 120, thumbnail: '#4a90d9' }, { id: 's2', seriesNumber: 2, seriesDescription: '横断面-纵隔窗', modality: 'CT', imageCount: 120, thumbnail: '#50b784' }, { id: 's3', seriesNumber: 3, seriesDescription: '冠状面', modality: 'CT', imageCount: 80, thumbnail: '#e5a832' }, { id: 's4', seriesNumber: 4, seriesDescription: '矢状面', modality: 'CT', imageCount: 80, thumbnail: '#d94a4a' }]
    if (exam.modality === 'MR') return [{ id: 's1', seriesNumber: 1, seriesDescription: 'T1WI横断', modality: 'MR', imageCount: 200, thumbnail: '#4a90d9' }, { id: 's2', seriesNumber: 2, seriesDescription: 'T2WI横断', modality: 'MR', imageCount: 200, thumbnail: '#50b784' }, { id: 's3', seriesNumber: 3, seriesDescription: 'FLAIR', modality: 'MR', imageCount: 200, thumbnail: '#e5a832' }, { id: 's4', seriesNumber: 4, seriesDescription: 'DWI', modality: 'MR', imageCount: 50, thumbnail: '#d94a4a' }]
    if (exam.modality === 'DR') return [{ id: 's1', seriesNumber: 1, seriesDescription: '后前位', modality: 'DR', imageCount: 1, thumbnail: '#4a90d9' }, { id: 's2', seriesNumber: 2, seriesDescription: '侧位', modality: 'DR', imageCount: 1, thumbnail: '#50b784' }]
    return [{ id: 's1', seriesNumber: 1, seriesDescription: '序列1', modality: exam.modality, imageCount: 1, thumbnail: '#4a90d9' }]
  })
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0)
  const activeSeries = seriesList[activeSeriesIdx]!

  const [images] = useState<DicomImage[]>(() => {
    const imgs: DicomImage[] = []
    for (let i = 1; i <= activeSeries.imageCount; i++) {
      imgs.push({ id: `${activeSeries.id}-i${i}`, seriesId: activeSeries.id, imageNumber: i, sliceLocation: (i - activeSeries.imageCount / 2) * 2.5, windowWidth: 400, windowCenter: 40, pixelSpacing: 0.68, sliceThickness: 2.5, tr: activeSeries.modality === 'MR' ? 2500 : undefined, te: activeSeries.modality === 'MR' ? 30 : undefined, matrix: '512×512', fov: 35 })
    }
    return imgs
  })
  const [imageIndex, setImageIndex] = useState(Math.floor(images.length / 2))

  const [activeTool, setActiveTool] = useState<Tool>('zoom')
  const [measureSubMenu, setMeasureSubMenu] = useState<MeasureSubMenu>(null)
  const [showWlPopup, setShowWlPopup] = useState(false)
  const [showGrid, setShowGrid] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const playRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (playRef.current) {
        clearInterval(playRef.current)
        playRef.current = null
      }
    }
  }, [])

  const [zoom, setZoom] = useState(100)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [rotation, setRotation] = useState(0)
  const [flipH, setFlipH] = useState(false)
  const [flipV, setFlipV] = useState(false)
  const [brightness, setBrightness] = useState(100)
  const [contrast, setContrast] = useState(100)
  const [invert, setInvert] = useState(false)
  const [ww, setWw] = useState(CT_DEFAULT_WW)
  const [wl, setWl] = useState(CT_DEFAULT_WL)
  const [activePresetIdx, setActivePresetIdx] = useState<number | null>(null)
  const [activeMprIdx, setActiveMprIdx] = useState(0)

  useEffect(() => {
    const raw = (() => { try { return localStorage.getItem('g005_dicom_viewer_v1') } catch { return null } })()
    if (!raw) return
    try {
      const saved = JSON.parse(raw)
      if (typeof saved.zoom === 'number') setZoom(saved.zoom)
      if (typeof saved.rotation === 'number') setRotation(saved.rotation)
      if (typeof saved.flipH === 'boolean') setFlipH(saved.flipH)
      if (typeof saved.flipV === 'boolean') setFlipV(saved.flipV)
      if (typeof saved.brightness === 'number') setBrightness(saved.brightness)
      if (typeof saved.contrast === 'number') setContrast(saved.contrast)
      if (typeof saved.invert === 'boolean') setInvert(saved.invert)
      if (typeof saved.ww === 'number') setWw(saved.ww)
      if (typeof saved.wl === 'number') setWl(saved.wl)
      if (saved.activePresetIdx === null || typeof saved.activePresetIdx === 'number') {
        setActivePresetIdx(saved.activePresetIdx)
      }
    } catch {
      /* ignore corrupted storage */
    }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('g005_dicom_viewer_v1', JSON.stringify({
        zoom, rotation, flipH, flipV, brightness, contrast, invert, ww, wl, activePresetIdx,
      }))
    } catch {
      /* quota exceeded; ignore */
    }
  }, [zoom, rotation, flipH, flipV, brightness, contrast, invert, ww, wl, activePresetIdx])

  const [viewMode, setViewMode] = useState<ViewMode>('MPR')
  const [mipDirection, setMipDirection] = useState<MipDirection>('axial')
  const [mipFrame, setMipFrame] = useState(30)
  const [vrRotX, setVrRotX] = useState(30)
  const [vrRotY, setVrRotY] = useState(45)
  const [vrRotZ, setVrRotZ] = useState(0)
  const [vrOpacity, setVrOpacity] = useState(0.8)

  const [layout, setLayout] = useState<LayoutMode>('1x1')
  const [rightTab, setRightTab] = useState<RightTab>('patient')
  const [pseudoColorMode, setPseudoColorMode] = useState<PseudoColorMode>('none')
  const [showPseudoColorPanel, setShowPseudoColorPanel] = useState(false)

  // [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 灰阶校准 (DICOM PS3.14, localStorage 持久化)
  const [gsofEnabled, setGsofEnabled] = useState(false)
  const [gsofMode, setGsofMode] = useState<GsofMode>('standard')
  const [showGsofPanel, setShowGsofPanel] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem('g005_dicom_gsdf_v1')
      if (!raw) return
      const saved = JSON.parse(raw) as { enabled?: boolean; mode?: GsofMode }
      if (typeof saved.enabled === 'boolean') setGsofEnabled(saved.enabled)
      if (saved.mode === 'standard' || saved.mode === 'enhanced' || saved.mode === 'soft') setGsofMode(saved.mode)
    } catch { /* ignore corrupted storage */ }
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('g005_dicom_gsdf_v1', JSON.stringify({ enabled: gsofEnabled, mode: gsofMode }))
    } catch { /* quota exceeded; ignore */ }
  }, [gsofEnabled, gsofMode])

  const [activeAnnotationType, setActiveAnnotationType] = useState<AnnotationType>('text')
  const [activeAnnotationColor, setActiveAnnotationColor] = useState<string>(ANNOTATION_COLORS[0] ?? '#ff0000')
  const [activeAnnotationFontSize, setActiveAnnotationFontSize] = useState(16)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [showAnnotationsOverlay] = useState(true)
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null)
  const [showAnnotationPanel, setShowAnnotationPanel] = useState(false)

  const [interactiveMeasures, setInteractiveMeasures] = useState<Measurement[]>([])
  const [isDrawingMeasure, setIsDrawingMeasure] = useState(false)
  const [drawingPoints, setDrawingPoints] = useState<{ x: number; y: number }[]>([])
  const [showMeasurementsOverlay, setShowMeasurementsOverlay] = useState(true)

  const [measurements] = useState({ length: [] as any[], angle: [] as any[], ct: [] as any[], area: [] as any[] })

  const [reportStatus] = useState<string>('待书写')

  const [selectedHistoryExams, setSelectedHistoryExams] = useState<string[]>([])
  const [historySearchText, setHistorySearchText] = useState('')
  const [compareImageIndex] = useState(0)
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [compareExam, setCompareExam] = useState<any>(null)
  const [syncScroll, setSyncScroll] = useState(true)
  const [showDiffHighlight, setShowDiffHighlight] = useState(false)

  const [externalInstitution, setExternalInstitution] = useState('')
  const [externalSearchType, setExternalSearchType] = useState<'patientId' | 'patientName'>('patientId')
  const [externalSearchText, setExternalSearchText] = useState('')
  const [externalSearchResults, setExternalSearchResults] = useState<any[]>([])
  const [selectedExternalExam, setSelectedExternalExam] = useState<any>(null)
  const [isExternalCompareMode, setIsExternalCompareMode] = useState(false)
  const [externalCompareLayout, setExternalCompareLayout] = useState<CompareLayout>('leftRight')
  const [archiveRequestStatus, setArchiveRequestStatus] = useState<string | null>(null)

  const [showPrintPreview, setShowPrintPreview] = useState(false)
  // [Wave2A] 胶片打印参数 (确认打印 → printApi.createJob)
  const [printFilmSpec, setPrintFilmSpec] = useState<'14x17' | '10x12' | '8x10'>('14x17')
  const [printCopies, setPrintCopies] = useState(1)
  const [printSubmitting, setPrintSubmitting] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  // 相似病例检索
  const [similarOpen, setSimilarOpen] = useState(false)
  const [similarLoading, setSimilarLoading] = useState(false)
  const [similarResults, setSimilarResults] = useState<SimilarCaseResult[]>([])

  const EXTERNAL_INSTITUTIONS = [
    { id: 'hubei-provincial', name: '汉东省人民医院', address: '武汉市武昌区解放路238号', phone: '027-88871234', pacsType: 'GE Centricity PACS', status: 'online' },
    { id: 'wuhan-center', name: '武汉市中心医院', address: '武汉市江岸区中山路1260号', phone: '027-82218999', pacsType: '锐柯PACS/RIS', status: 'online' },
    { id: 'shanghai-first', name: '上海市第一人民医院', address: '上海市虹口区武进路85号', phone: '021-63240090', pacsType: 'HISILON PACS', status: 'online' },
    { id: 'peking-union', name: '北京协和医院', address: '北京市东城区帅府园1号', phone: '010-69156114', pacsType: '飞利浦PACS', status: 'online' },
    { id: 'sun-yat-sen', name: '中山大学附属第一医院', address: '广州市越秀区中山二路58号', phone: '020-87755777', pacsType: '西门子PACS/Syngo', status: 'offline' },
  ]

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg); setToastVisible(true)
    setTimeout(() => setToastVisible(false), 2500)
  }, [])

  const mockAppendAnnotation = (ann: Annotation) => { setAnnotations(prev => [...prev, ann]) }
  const deleteAnnotation = (id: string) => { setAnnotations(prev => prev.filter(a => a.id !== id)) }
  const toggleAnnotationVisibility = (id: string) => { setAnnotations(prev => prev.map(a => a.id === id ? { ...a, visible: !a.visible } : a)) }
  const toggleAnnotationLock = (id: string) => { setAnnotations(prev => prev.map(a => a.id === id ? { ...a, locked: !a.locked } : a)) }
  const clearAllAnnotations = () => { setAnnotations([]); setSelectedAnnotationId(null) }

  const getMeasureTypeLabel = (type: string) => {
    const labels: Record<string, string> = { line: t('dicomViewer.measure.line'), angle: t('dicomViewer.measure.angle'), ellipse: t('dicomViewer.measure.ellipse'), rectangle: t('dicomViewer.measure.rectangle'), circle: t('dicomViewer.measure.circle'), ctvalue: t('dicomViewer.measure.ctvalue'), area: t('dicomViewer.measure.area'), cobb: t('dicomViewer.measure.cobb'), polygon: t('dicomViewer.measure.polygon') }
    return labels[type] || type
  }

  const clearAllMeasures = () => { setInteractiveMeasures([]); setDrawingPoints([]); setIsDrawingMeasure(false) }
  const deleteMeasure = (id: string) => { setInteractiveMeasures(prev => prev.filter(m => m.id !== id)) }

  // [G005 v3.0.6.11-99 Wave 4B] 测量族增强: 画布取点 → 计算测量结果
  //   length: 两点距离 (pixelSpacing 换算 mm); angle: 三点夹角 (atan2);
  //   ellipse/rectangle/circle: 面积; ctvalue: 单点 CT 值; cobb: 两条线段夹角 (atan2, 补角取小);
  //   polygon: 自由多边形顶点 → 鞋带公式面积
  const buildMeasure = useCallback((type: MeasureSubMenu, pts: { x: number; y: number }[]): Measurement | null => {
    if (!type || pts.length === 0) return null
    const sp = (images[imageIndex] || images[0])?.pixelSpacing || 0.68
    const id = `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const loc = exam.bodyPart || ''
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y)
    const lineAngle = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x)
    if (type === 'length' && pts.length >= 2) {
      const mm = dist(pts[0]!, pts[1]!) * sp
      return { id, type: 'line', points: pts, value: Math.round(mm * 10) / 10, unit: 'mm', label: `长度 ${Math.round(mm * 10) / 10} mm`, location: loc }
    }
    if (type === 'angle' && pts.length >= 3) {
      const [p1, vertex, p2] = pts
      const a1 = lineAngle(vertex!, p1!); const a2 = lineAngle(vertex!, p2!)
      const deg = Math.abs((a2 - a1) * 180 / Math.PI)
      const v = Math.round(Math.min(deg, 360 - deg) * 10) / 10
      return { id, type: 'angle', points: pts, value: v, unit: '°', label: `角度 ${v}°`, location: loc }
    }
    if (type === 'cobb' && pts.length >= 4) {
      // Cobb 角: 上终板线(端点1-2) 与 下终板线(端点3-4) 的夹角, 取锐角(补角取小)
      const a1 = lineAngle(pts[0]!, pts[1]!); const a2 = lineAngle(pts[2]!, pts[3]!)
      let diff = Math.abs((a2 - a1) * 180 / Math.PI) % 180
      if (diff > 90) diff = 180 - diff
      const v = Math.round(diff * 10) / 10
      return { id, type: 'cobb', points: pts, value: v, unit: '°', label: `Cobb角 ${v}°`, location: loc }
    }
    if (type === 'ctvalue' && pts.length >= 1) {
      // 合成 CT 值: 模拟软组织/病灶区间, 单点采样
      const p = pts[0]!
      const v = Math.round(35 + ((p.x * 7 + p.y * 13) % 60) - 15)
      return { id, type: 'ctvalue', points: pts, value: v, unit: 'HU', label: `CT值 ${v} HU`, location: loc }
    }
    if (pts.length >= 2) {
      const p1 = pts[0]!; const p2 = pts[1]!
      if (type === 'ellipse') {
        const rx = Math.abs(p2.x - p1.x) / 2 * sp; const ry = Math.abs(p2.y - p1.y) / 2 * sp
        const v = Math.round(Math.PI * rx * ry * 10) / 10
        return { id, type: 'ellipse', points: pts, value: v, unit: 'mm²', label: `椭圆面积 ${v} mm²`, location: loc }
      }
      if (type === 'rectangle') {
        const v = Math.round(Math.abs(p2.x - p1.x) * Math.abs(p2.y - p1.y) * sp * sp * 10) / 10
        return { id, type: 'rectangle', points: pts, value: v, unit: 'mm²', label: `矩形面积 ${v} mm²`, location: loc }
      }
      if (type === 'circle') {
        const r = dist(p1, p2) * sp
        const v = Math.round(Math.PI * r * r * 10) / 10
        return { id, type: 'circle', points: pts, value: v, unit: 'mm²', label: `圆面积 ${v} mm²`, location: loc }
      }
    }
    return null
  }, [images, imageIndex, exam.bodyPart])

  const handleMeasurePoint = useCallback((x: number, y: number) => {
    if (activeTool !== 'measure' || !measureSubMenu) return
    if (measureSubMenu === 'polygon') {
      setDrawingPoints(prev => [...prev, { x, y }])
      setIsDrawingMeasure(true)
      return
    }
    const needed: Partial<Record<NonNullable<MeasureSubMenu>, number>> = { length: 2, angle: 3, cobb: 4, ellipse: 2, rectangle: 2, circle: 2, ctvalue: 1 }
    const need = needed[measureSubMenu]
    if (!need) return
    const next = [...drawingPoints, { x, y }]
    if (next.length >= need) {
      const m = buildMeasure(measureSubMenu, next)
      if (m) setInteractiveMeasures(prev => [...prev, m])
      setDrawingPoints([])
      setIsDrawingMeasure(false)
    } else {
      setDrawingPoints(next)
      setIsDrawingMeasure(true)
    }
  }, [activeTool, measureSubMenu, drawingPoints, buildMeasure])

  // 多边形: 逐点累积, 「完成」按钮 → 鞋带公式面积
  const finishPolygonMeasure = useCallback(() => {
    if (drawingPoints.length < 3) return
    const sp = (images[imageIndex] || images[0])?.pixelSpacing || 0.68
    const pts = drawingPoints
    let sum = 0
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i]!; const nxt = pts[(i + 1) % pts.length]!
      sum += cur.x * nxt.y - nxt.x * cur.y
    }
    const area = Math.abs(sum) / 2 * sp * sp
    const v = Math.round(area * 10) / 10
    const m: Measurement = { id: `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, type: 'polygon', points: pts, value: v, unit: 'mm²', label: `多边形面积 ${v} mm²`, location: exam.bodyPart || '' }
    setInteractiveMeasures(prev => [...prev, m])
    setDrawingPoints([])
    setIsDrawingMeasure(false)
  }, [drawingPoints, images, imageIndex, exam.bodyPart])

  // [G005 v3.0.6.11-99 Wave 4B] 测量入报告: 测量结果写入 sessionStorage, 报告书写页读取生成 SR 段落
  useEffect(() => {
    try {
      const rows = interactiveMeasures.map(m => ({
        type: m.type, typeLabel: getMeasureTypeLabel(m.type), label: m.label,
        value: m.value, unit: m.unit, location: m.location ?? exam.bodyPart ?? '',
        examId: exam.id ?? '', patientId: exam.patientId ?? '',
      }))
      sessionStorage.setItem('g005_measurements_v1', JSON.stringify(rows))
    } catch { /* storage unavailable; ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interactiveMeasures])

  // ---- 伪彩工具按钮 ----
  const pseudoColorTools = [
    { mode: 'none' as PseudoColorMode, icon: <EyeOff size={16} />, label: t('dicomViewer.pseudo.original') },
    { mode: 'hotIron' as PseudoColorMode, icon: <Flame size={16} />, label: t('dicomViewer.pseudo.hotIron') },
    { mode: 'coolBlue' as PseudoColorMode, icon: <Droplets size={16} />, label: t('dicomViewer.pseudo.coolBlue') },
    { mode: 'pet' as PseudoColorMode, icon: <Activity size={16} />, label: t('dicomViewer.pseudo.pet') },
    { mode: 'softTissue' as PseudoColorMode, icon: <Wind size={16} />, label: t('dicomViewer.pseudo.softTissue') },
  ]

  // ---- 标注工具按钮类型 ----
  const annotationTypes = [
    { type: 'text' as AnnotationType, icon: <Type size={16} />, label: t('dicomViewer.ann.text') },
    { type: 'arrow' as AnnotationType, icon: <ArrowUpRight size={16} />, label: t('dicomViewer.ann.arrow') },
    { type: 'rect' as AnnotationType, icon: <RectIcon size={16} />, label: t('dicomViewer.ann.rect') },
    { type: 'ellipse' as AnnotationType, icon: <CircleIcon size={16} />, label: t('dicomViewer.ann.ellipse') },
  ]

  // ---- 工具按钮列表 ----
  const tools: { tool: Tool; icon: React.ReactNode; label: string; divider?: boolean }[] = [
    { tool: 'zoom', icon: <ZoomIn size={20} />, label: t('dicomViewer.tool.zoom') },
    { tool: 'pan', icon: <Move size={20} />, label: t('dicomViewer.tool.pan') },
    { tool: 'wl', icon: <Sun size={20} />, label: t('dicomViewer.tool.wl') },
    { tool: 'rotate', icon: <RotateCw size={20} />, label: t('dicomViewer.tool.rotate') },
    { tool: 'flipH', icon: <FlipHorizontal size={20} />, label: t('dicomViewer.tool.flipH'), divider: true },
    { tool: 'flipV', icon: <FlipVertical size={20} />, label: t('dicomViewer.tool.flipV') },
    { tool: 'reset', icon: <RefreshCw size={20} />, label: t('dicomViewer.tool.reset'), divider: true },
    { tool: 'measure', icon: <Ruler size={20} />, label: t('dicomViewer.tool.measure') },
    { tool: 'annotate', icon: <PenTool size={20} />, label: t('dicomViewer.tool.annotate') },
    { tool: 'play', icon: isPlaying ? <Pause size={20} /> : <Play size={20} />, label: isPlaying ? t('dicomViewer.tool.pause') : t('dicomViewer.tool.play'), divider: true },
    { tool: 'print', icon: <Printer size={20} />, label: t('dicomViewer.tool.print') },
  ]

  const gridConfig = { '1x1': { cols: 1, rows: 1 }, '2x2': { cols: 2, rows: 2 }, '1x2': { cols: 1, rows: 2 }, '2x1': { cols: 2, rows: 1 } }[layout]
  const currentImage = (images[imageIndex] || images[0])!

  const handleToolClick = (tool: Tool) => {
    if (tool === 'measure') { setActiveTool('measure'); setMeasureSubMenu(measureSubMenu === null ? 'length' : null); setShowWlPopup(false) }
    else if (tool === 'wl') { setActiveTool('wl'); setShowWlPopup(!showWlPopup); setMeasureSubMenu(null) }
    else if (tool === 'zoom') { setActiveTool('zoom'); setShowWlPopup(false); setMeasureSubMenu(null) }
    else if (tool === 'pan') { setActiveTool('pan'); setShowWlPopup(false); setMeasureSubMenu(null) }
    else if (tool === 'rotate') setRotation(r => (r + 90) % 360)
    else if (tool === 'flipH') setFlipH(f => !f)
    else if (tool === 'flipV') setFlipV(f => !f)
    else if (tool === 'reset') { setZoom(100); setPanX(0); setPanY(0); setRotation(0); setFlipH(false); setFlipV(false); setBrightness(100); setContrast(100); setInvert(false); setWw(CT_DEFAULT_WW); setWl(CT_DEFAULT_WL) }
    else if (tool === 'play') setIsPlaying(p => !p)
    else if (tool === 'print') setShowPrintPreview(true)
    else { setActiveTool(tool); setShowWlPopup(false); setMeasureSubMenu(null) }
  }

  const handlePresetClick = (preset: WindowPreset, idx: number) => { setWw(preset.ww); setWl(preset.wc); setActivePresetIdx(activePresetIdx === idx ? null : idx) }

  const getCurrentPresets = () => getPresetsForModality(exam.modality)

  const handleLayoutChange = (newLayout: LayoutMode) => setLayout(newLayout)
  const handleSeriesSelect = (idx: number) => { setActiveSeriesIdx(idx); setImageIndex(0) }
  const handleExamChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedExamIdx(parseInt(e.target.value))

  const handleExternalSearch = () => {
    if (!externalInstitution) { showToast(t('dicomViewer.selectInstitution')); return }
    if (!externalSearchText.trim()) { showToast(t('dicomViewer.enterSearchCriteria')); return }
    const results = EXTERNAL_INSTITUTIONS.filter(i => i.status === 'online').map(() => ({
      id: `ext-${Date.now()}`, institutionId: externalInstitution, patientId: 'P001', patientName: '模拟患者',
      gender: '男', age: 45, examDate: '2026-04-15', examItemName: '胸部CT平扫', modality: 'CT', bodyPart: 'CHEST',
      deviceName: 'GE Revolution', accessionNumber: 'EXT001', status: 'available',
    }))
    setExternalSearchResults(results)
    if (results.length === 0) showToast(t('dicomViewer.noMatchingExam'))
  }

  const handleArchiveRequest = () => {
    setArchiveRequestStatus('pending'); showToast(t('dicomViewer.requesting'))
    setTimeout(() => { setArchiveRequestStatus('success'); showToast(t('dicomViewer.requestSubmitted')) }, 1500)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true) }
    else { document.exitFullscreen(); setIsFullscreen(false) }
  }

  const enterCompareMode = () => {
    if (selectedHistoryExams.length > 0) {
      // [W3-C] 对比目标使用真实历史检查, 不再写死 mockExam
      const history = historyExams.find((h) => selectedHistoryExams.includes(h.id))
      if (!history) { showToast(t('dicomViewer.historyNotFound')); return }
      setCompareExam({
        id: history.id,
        examDate: history.examDate,
        examTime: history.examTime,
        reportDoctor: history.reportDoctor,
        finding: history.finding,
        conclusion: history.conclusion,
        examItemName: history.examItemName,
        modality: history.modality,
      })
      setIsCompareMode(true); showToast(t('dicomViewer.enterCompare'))
    }
  }
  const exitCompareMode = () => { setIsCompareMode(false); setCompareExam(null); showToast(t('dicomViewer.exitCompare')) }

  const toggleHistoryExam = (id: string) => {
    setSelectedHistoryExams(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const getCompareDiffInfo = () => {
    if (!compareExam) return null
    return [
      { label: t('dicomViewer.noduleSize'), oldVal: '6mm', newVal: '8mm', type: 'increase' as const },
      { label: t('dicomViewer.density'), oldVal: '磨玻璃', newVal: '磨玻璃', type: 'nochange' as const },
      { label: t('dicomViewer.newLesion'), oldVal: '无', newVal: '无', type: 'nochange' as const },
    ]
  }

  const exportMeasurements = (_format: string) => {
    const report = interactiveMeasures.map(m => `${m.label || m.type}: ${m.value}${m.unit}`).join('\n')
    navigator.clipboard.writeText(report || t('dicomViewer.noMeasureData')); showToast(t('dicomViewer.measureCopied'))
  }

  // [Wave2A] 确认打印 → printApi.createJob 真实创建打印任务
  const handleConfirmPrint = async () => {
    setPrintSubmitting(true)
    try {
      const res = await printApi.createJob({
        patientId: exam.patientId,
        patientName: exam.patientName,
        modality: exam.modality,
        studyType: exam.examItemName,
        filmSpec: printFilmSpec,
        copies: printCopies,
        status: 'queued',
        submitTime: new Date().toISOString(),
      })
      if (res.success) {
        showToast(`打印任务已创建: ${res.data?.id ?? ''} (${printFilmSpec} × ${printCopies} 份)`)
        setShowPrintPreview(false)
      } else {
        showToast(res.error?.message ?? t('dicomViewer.printCreateFailed'))
      }
    } catch {
      showToast(t('dicomViewer.printUnavailable'))
    } finally {
      setPrintSubmitting(false)
    }
  }

  const lookSimilarExams = async () => {
    setSimilarLoading(true)
    setSimilarOpen(true)
    try {
      const res = await similarCaseApi.search({
        modality: exam.modality,
        bodyPart: exam.bodyPart,
        limit: 6,
      })
      if (res.success && Array.isArray(res.data)) {
        setSimilarResults(res.data)
        if (res.data.length === 0) showToast(t('dicomViewer.noSimilar'))
      } else {
        setSimilarResults([])
        showToast(res.error?.message || t('dicomViewer.similarFailed'))
      }
    } catch {
      setSimilarResults([])
      showToast(t('dicomViewer.similarFailed'))
    } finally {
      setSimilarLoading(false)
    }
  }

  // [W3-C] 历史检查来自 examApi.list({patientId}) 真实数据, 支持搜索过滤
  const filteredHistoryExams = historyExams.filter(e => historySearchText ? e.examItemName.includes(historySearchText) || e.modality.includes(historySearchText) : true)
  const diffRegions: any[] = [];

  (window as any).mockAppendAnnotation = mockAppendAnnotation

  return (
    <>
      <ViewerSelector current="classic" />
      <div data-testid="dicom-viewer-page" style={s.root}>
        {loading && <LoadingBanner message={t('dicomViewer.loadingImages')} />}
        {loadError && !loading && <ErrorBanner message={loadError} />}
        <div style={{ position: 'absolute', top: 48, right: 296, zIndex: 40, width: 260 }}>
          <HangingProtocolPanel
            onApply={(p) => {
              if (p.views?.[0]?.initialWw) setWw(p.views[0].initialWw!)
              if (p.views?.[0]?.initialWl) setWl(p.views[0].initialWl!)
              if (p.views?.[0]?.layout) setLayout(p.views[0].layout as any)
            }}
            modality={exam.modality}
            bodyPart={exam.bodyPart}
          />
        </div>
        <div style={s.body}>
          <ToolbarSection
            tools={tools}
            activeTool={activeTool}
            handleToolClick={handleToolClick}
            zoom={zoom} setZoom={setZoom}
            rotation={rotation} setRotation={setRotation}
            pseudoColorMode={pseudoColorMode}
            showPseudoColorPanel={showPseudoColorPanel} setShowPseudoColorPanel={setShowPseudoColorPanel}
            invert={invert} setInvert={setInvert}
            showAnnotationPanel={showAnnotationPanel} setShowAnnotationPanel={setShowAnnotationPanel}
          />
          <ViewportArea
            exam={exam}
            seriesList={seriesList} activeSeriesIdx={activeSeriesIdx} activeSeries={activeSeries}
            images={images} imageIndex={imageIndex} currentImage={currentImage}
            showGrid={showGrid} isFullscreen={isFullscreen}
            zoom={zoom} panX={panX} panY={panY} rotation={rotation} flipH={flipH} flipV={flipV}
            brightness={brightness} contrast={contrast} invert={invert} ww={ww} wl={wl}
            activePresetIdx={activePresetIdx} viewMode={viewMode}
            mipDirection={mipDirection} mipFrame={mipFrame}
            vrRotX={vrRotX} vrRotY={vrRotY} vrRotZ={vrRotZ} vrOpacity={vrOpacity}
            layout={layout} isCompareMode={isCompareMode} compareExam={compareExam}
            compareImageIndex={compareImageIndex} syncScroll={syncScroll}
            showDiffHighlight={showDiffHighlight} diffRegions={diffRegions}
            selectedHistoryExams={selectedHistoryExams} activeTool={activeTool}
            showWlPopup={showWlPopup} showPseudoColorPanel={showPseudoColorPanel}
            showMeasurementsOverlay={showMeasurementsOverlay} measureSubMenu={measureSubMenu}
            isDrawingMeasure={isDrawingMeasure} interactiveMeasures={interactiveMeasures}
            drawingPoints={drawingPoints} annotations={annotations}
            handleMeasurePoint={handleMeasurePoint} finishPolygonMeasure={finishPolygonMeasure}
            showAnnotationsOverlay={showAnnotationsOverlay}
            selectedAnnotationId={selectedAnnotationId}
            activeAnnotationType={activeAnnotationType}
            activeAnnotationColor={activeAnnotationColor}
            activeAnnotationFontSize={activeAnnotationFontSize}
            pseudoColorMode={pseudoColorMode} pseudoColorTools={pseudoColorTools}
            annotationTypes={annotationTypes} gridConfig={gridConfig}
            gsofEnabled={gsofEnabled} gsofMode={gsofMode} showGsofPanel={showGsofPanel}
            setGsofEnabled={setGsofEnabled} setGsofMode={setGsofMode} setShowGsofPanel={setShowGsofPanel}
            setImageIndex={setImageIndex}
            setWw={setWw} setWl={setWl} setActivePresetIdx={setActivePresetIdx}
            setViewMode={setViewMode}
            setShowGrid={setShowGrid}
            setActiveTool={setActiveTool} setShowWlPopup={setShowWlPopup}
            setShowPseudoColorPanel={setShowPseudoColorPanel} setShowAnnotationPanel={setShowAnnotationPanel}
            setMeasureSubMenu={setMeasureSubMenu}
            setSelectedAnnotationId={setSelectedAnnotationId} setActiveAnnotationType={setActiveAnnotationType}
            setActiveAnnotationColor={setActiveAnnotationColor} setActiveAnnotationFontSize={setActiveAnnotationFontSize}
            setPseudoColorMode={setPseudoColorMode}
            handlePresetClick={handlePresetClick}
            handleLayoutChange={handleLayoutChange}
            handleSeriesSelect={handleSeriesSelect} handleExamChange={handleExamChange}
            toggleFullscreen={toggleFullscreen} clearAllMeasures={clearAllMeasures}
            clearAllAnnotations={clearAllAnnotations}
            deleteAnnotation={deleteAnnotation} toggleAnnotationVisibility={toggleAnnotationVisibility}
            toggleAnnotationLock={toggleAnnotationLock} enterCompareMode={enterCompareMode}
            exportMeasurements={exportMeasurements}
            getCurrentPresets={getCurrentPresets}
          />
          <SidebarPanel
            exam={exam} rightTab={rightTab} setRightTab={setRightTab}
            activeSeries={activeSeries} currentImage={currentImage}
            ww={ww} wl={wl} zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV}
            brightness={brightness} contrast={contrast} invert={invert} viewMode={viewMode}
            mipDirection={mipDirection} setMipDirection={setMipDirection}
            mipFrame={mipFrame} setMipFrame={setMipFrame} images={images}
            vrRotX={vrRotX} setVrRotX={setVrRotX} vrRotY={vrRotY} setVrRotY={setVrRotY}
            vrRotZ={vrRotZ} setVrRotZ={setVrRotZ} vrOpacity={vrOpacity} setVrOpacity={setVrOpacity}
            showToast={showToast}
            measureSubMenu={measureSubMenu} setMeasureSubMenu={setMeasureSubMenu}
            setActiveTool={setActiveTool}
            interactiveMeasures={interactiveMeasures}
            showMeasurementsOverlay={showMeasurementsOverlay}
            setShowMeasurementsOverlay={setShowMeasurementsOverlay}
            deleteMeasure={deleteMeasure} clearAllMeasures={clearAllMeasures}
            getMeasureTypeLabel={getMeasureTypeLabel} measurements={measurements}
            reportStatus={reportStatus}
            selectedHistoryExams={selectedHistoryExams}
            setSelectedHistoryExams={setSelectedHistoryExams}
            filteredHistoryExams={filteredHistoryExams}
            historySearchText={historySearchText} setHistorySearchText={setHistorySearchText}
            toggleHistoryExam={toggleHistoryExam} enterCompareMode={enterCompareMode}
            isCompareMode={isCompareMode} compareExam={compareExam}
            syncScroll={syncScroll} setSyncScroll={setSyncScroll}
            showDiffHighlight={showDiffHighlight} setShowDiffHighlight={setShowDiffHighlight}
            exitCompareMode={exitCompareMode} getCompareDiffInfo={getCompareDiffInfo}
            externalInstitution={externalInstitution} setExternalInstitution={setExternalInstitution}
            externalSearchType={externalSearchType} setExternalSearchType={setExternalSearchType}
            externalSearchText={externalSearchText} setExternalSearchText={setExternalSearchText}
            externalSearchResults={externalSearchResults}
            selectedExternalExam={selectedExternalExam} setSelectedExternalExam={setSelectedExternalExam}
            handleExternalSearch={handleExternalSearch} handleArchiveRequest={handleArchiveRequest}
            isExternalCompareMode={isExternalCompareMode}
            setIsExternalCompareMode={setIsExternalCompareMode}
            archiveRequestStatus={archiveRequestStatus}
            externalCompareLayout={externalCompareLayout}
            setExternalCompareLayout={setExternalCompareLayout}
            activeMprIdx={activeMprIdx} setActiveMprIdx={setActiveMprIdx}
            EXTERNAL_INSTITUTIONS={EXTERNAL_INSTITUTIONS}
          />
        </div>

        {/* 打印预览Modal */}
        <AppModal
          open={showPrintPreview}
          onClose={() => setShowPrintPreview(false)}
          title={t('dicomViewer.printPreview')}
          icon={<Printer size={18} color="#fff" />}
          iconBg={PRIMARY}
          width={640}
          footer={
            <>
              <button style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }} onClick={() => setShowPrintPreview(false)}>{t('dicomViewer.cancel')}</button>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff', opacity: printSubmitting ? 0.6 : 1 }} disabled={printSubmitting} onClick={() => void handleConfirmPrint()}><Printer size={14} />{printSubmitting ? t('dicomViewer.submitting') : t('dicomViewer.confirmPrint')}</button>
            </>
          }
        >
          <div style={{ background: '#111', padding: 'var(--space-4, 16px)', borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
              {['序列1-层面1', '序列1-层面2', '序列2-层面1', '序列2-层面2'].map((label, i) => (
                <div key={i} style={{ background: '#222', borderRadius: 4, padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                  <div style={{ fontSize: 36, marginBottom: 'var(--space-2, 8px)', opacity: 0.3 }}>▣</div>{label}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 12 }}>
              <span>Patient: {exam.patientName} | {exam.patientId}</span>
              <span>{exam.examItemName} | {exam.deviceName?.split('（')[0]}</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', padding: '12px 0 0', fontSize: 12 }}>
            <label style={{ color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('dicomViewer.filmSize')}
              <select value={printFilmSpec} onChange={e => setPrintFilmSpec(e.target.value as typeof printFilmSpec)} style={{ padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: 12 }}>
                <option value="14x17">{t('dicomViewer.film14x17')}</option>
                <option value="10x12">{t('dicomViewer.film10x12')}</option>
                <option value="8x10">{t('dicomViewer.film8x10')}</option>
              </select>
            </label>
            <label style={{ color: 'var(--text-muted, #94a3b8)', display: 'flex', alignItems: 'center', gap: 6 }}>
              {t('dicomViewer.copies')}
              <input type="number" min={1} max={5} value={printCopies} onChange={e => setPrintCopies(Math.max(1, Math.min(5, Number(e.target.value) || 1)))} style={{ width: 60, padding: '4px 8px', borderRadius: 4, border: '1px solid #334155', background: '#1e293b', color: '#e2e8f0', fontSize: 12 }} />
            </label>
          </div>
        </AppModal>

        {/* 相似病例检索 Modal */}
        <AppModal
          open={similarOpen}
          onClose={() => setSimilarOpen(false)}
          title={t('dicomViewer.similarSearch')}
          icon={<Activity size={18} color="#fff" />}
          iconBg={PRIMARY}
          width={720}
          footer={
            <>
              <button style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }} onClick={() => setSimilarOpen(false)}>{t('dicomViewer.close')}</button>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => void lookSimilarExams()}><RefreshCw size={14} />{t('dicomViewer.research')}</button>
            </>
          }
        >
          <div style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', marginBottom: 'var(--space-3, 12px)' }}>
            {t('dicomViewer.basedOnCurrent')} {exam.patientName} · {exam.modality} · {exam.bodyPart}
          </div>
          {similarLoading ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8, 32px)' }}><div style={{ display: 'inline-block', width: 28, height: 28, border: '3px solid #334155', borderTopColor: 'var(--color-primary-500)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />                <div style={{ marginTop: 'var(--space-3, 12px)', color: 'var(--text-muted, #64748b)', fontSize: 12 }}>{t('dicomViewer.searchingSimilar')}</div></div>
          ) : similarResults.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 'var(--space-8, 32px)', color: 'var(--text-muted, #94a3b8)', fontSize: 12 }}>{t('dicomViewer.noSimilarRetry')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 420, overflow: 'auto' }}>
              {similarResults.map((r) => (
                <div key={r.id} style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 'var(--space-3, 12px)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary, #1e293b)' }}>
                      {r.modality} · {r.bodyPart}
                      <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-muted, #94a3b8)' }}>{r.gender} {r.age}{t('dicomViewer.yearsOld')} · {r.studyDate}</span>
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: r.similarity >= 70 ? '#dcfce7' : r.similarity >= 40 ? '#fef3c7' : '#f1f5f9', color: r.similarity >= 70 ? 'var(--color-success-600)' : r.similarity >= 40 ? 'var(--color-warning-600)' : '#64748b' }}>
                      {t('dicomViewer.similarity')} {r.similarity}%
                    </span>
                  </div>
                  {r.findings && <div style={{ fontSize: 12, color: 'var(--text-secondary, #475569)', lineHeight: 1.5, marginBottom: 'var(--space-1, 4px)' }}>{t('dicomViewer.findings')} {r.findings}</div>}
                  {r.impression && <div style={{ fontSize: 12, color: '#059669', lineHeight: 1.5 }}>{t('dicomViewer.impression')} {r.impression}</div>}
                  {r.keywords?.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
                      {r.keywords.slice(0, 5).map((k) => <span key={k} style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: '#dbeafe', color: 'var(--color-primary-800)' }}>{k}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </AppModal>

        {/* Toast 提示 */}
        {toastVisible && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: 'var(--color-success-500)', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(34,197,94,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
            <CheckCircle size={16} />{toastMsg}
          </div>
        )}

        {/* 底部状态栏 */}
        <div style={s.statusBar}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            {exam.patientName} · {exam.examItemName}
          </span>
          <span>{t('dicomViewer.accessionNo')} {exam.accessionNumber}</span>
          <span>{t('dicomViewer.device')} {exam.deviceName?.split('（')[0]}</span>
          <span style={{ color: 'var(--color-primary-500)' }}>{t('dicomViewer.window')} {ww}/{wl}</span>
          <span style={{ color: 'var(--color-success-500)' }}>{t('dicomViewer.zoomLabel')} {zoom}%</span>
          <span style={{ color: 'var(--color-warning-500)' }}>{t('dicomViewer.rotationLabel')} {rotation}°</span>
          <span style={{ color: '#a855f7' }}>{activeSeries.seriesDescription}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
            <Activity size={12} />DICOM Viewer v0.4.0 | {exam.modality}-{exam.bodyPart}
          </span>
        </div>
      </div>
    </>
  )
}
