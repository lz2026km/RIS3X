import { t } from '../i18n/appI18n'
import ViewerSelector from '../components/common/ViewerSelector'
import AppModal from '../components/common/AppModal'
import { useState, useRef, useEffect, useCallback } from 'react'
import {
  ZoomIn, ZoomOut, Move, Sun, RotateCw, RotateCcw, FlipHorizontal, FlipVertical,
  RefreshCw, Ruler, Calendar, MessageSquare, Play, Pause, Printer, Grid3x3, Maximize2,
  Minimize2, Download, Layers, Film, ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  SplitSquareHorizontal, Square, Eye, MousePointer, Circle, PenTool, Minus, Plus,
  AlertCircle, CheckCircle, Clock, FileText, Activity, X, Info, Triangle, Maximize,
  Camera, Layers3, Crosshair, Box, User, Image as ImageIcon, Ruler as RulerIcon,
  FileSearch, History, GitCompare, ArrowLeftRight, CheckSquare, Square as SquareIcon,
  AlertTriangle, Diff, ScrollText, EyeOff, Focus, Type, ArrowUpRight, Square as RectIcon,
  Circle as CircleIcon, Palette, Trash2, Edit3, Lock, Unlock, Eye as EyeIcon, Volume2,
  Flame, Droplets, Wind, Thermometer, Upload, File,
} from 'lucide-react'
import { initialRadiologyExams } from '../data/initialData'
import { examApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import {
  loadDicomFile, getPatientInfo, getWindowCenterWidth, getModality, getBodyPart,
  DicomDataset, PatientInfo,
} from '../utils/DicomManager'
import { getRecommendedPresets, WindowPreset as DicomWindowPreset } from '../utils/WindowPresets'
import type { Series, DicomImage, ExamItem, HistoryExam, Measurement, Annotation, MeasureType, Tool, MeasureSubMenu, LayoutMode, RightTab, AnnotationType, PseudoColorMode, CompareLayout, ViewMode, MipDirection, VrAxis, WindowPreset, InteractiveMeasure } from './dicom/DicomViewerTypes'
import { SERIES_COLORS, PSEUDO_COLOR_PRESETS, ANNOTATION_COLORS, ANNOTATION_COLOR_NAMES, PRIMARY, PRIMARY_LIGHT, CARD_BG, PANEL_BG } from './dicom/DicomViewerTypes'
import { useWindowingState } from '../utils/windowingStorage'
import { getPresetsForModality, CT_DEFAULT_WW, CT_DEFAULT_WL } from '../utils/modalityPresets'
import { DicomCanvas, MIPCanvas, VRCanvas } from './dicom/DicomViewerSubComponents'
import ToolbarSection from './dicom/ToolbarSection'
import ViewportArea from './dicom/ViewportArea'
import SidebarPanel from './dicom/SidebarPanel'
import { HangingProtocolPanel } from '../components/dicom/HangingProtocolPanel'

const s = {
  root: { display: 'flex', flexDirection: 'column' as const, height: '100vh', background: '#0f172a', color: '#e2e8f0', overflow: 'hidden', fontFamily: "'PingFang SC','Microsoft YaHei',sans-serif" },
  body: { flex: 1, display: 'flex', overflow: 'hidden' },
  statusBar: { display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px', background: '#1e293b', borderTop: '1px solid #334155', fontSize: 12, color: '#94a3b8', flexShrink: 0 },
  layoutBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' } as React.CSSProperties,
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' } as React.CSSProperties,
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
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setExams(res.data as unknown as typeof initialRadiologyExams)
        setLoadError(null)
      } else {
        setExams(initialRadiologyExams)
        setLoadError('API 不可用,使用本地数据')
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const exam = exams[selectedExamIdx]
  const [seriesList] = useState<Series[]>(() => {
    if (exam.modality === 'CT') return [{ id: 's1', seriesNumber: 1, seriesDescription: '横断面-肺窗', modality: 'CT', imageCount: 120, thumbnail: '#4a90d9' }, { id: 's2', seriesNumber: 2, seriesDescription: '横断面-纵隔窗', modality: 'CT', imageCount: 120, thumbnail: '#50b784' }, { id: 's3', seriesNumber: 3, seriesDescription: '冠状面', modality: 'CT', imageCount: 80, thumbnail: '#e5a832' }, { id: 's4', seriesNumber: 4, seriesDescription: '矢状面', modality: 'CT', imageCount: 80, thumbnail: '#d94a4a' }]
    if (exam.modality === 'MR') return [{ id: 's1', seriesNumber: 1, seriesDescription: 'T1WI横断', modality: 'MR', imageCount: 200, thumbnail: '#4a90d9' }, { id: 's2', seriesNumber: 2, seriesDescription: 'T2WI横断', modality: 'MR', imageCount: 200, thumbnail: '#50b784' }, { id: 's3', seriesNumber: 3, seriesDescription: 'FLAIR', modality: 'MR', imageCount: 200, thumbnail: '#e5a832' }, { id: 's4', seriesNumber: 4, seriesDescription: 'DWI', modality: 'MR', imageCount: 50, thumbnail: '#d94a4a' }]
    if (exam.modality === 'DR') return [{ id: 's1', seriesNumber: 1, seriesDescription: '后前位', modality: 'DR', imageCount: 1, thumbnail: '#4a90d9' }, { id: 's2', seriesNumber: 2, seriesDescription: '侧位', modality: 'DR', imageCount: 1, thumbnail: '#50b784' }]
    return [{ id: 's1', seriesNumber: 1, seriesDescription: '序列1', modality: exam.modality, imageCount: 1, thumbnail: '#4a90d9' }]
  })
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(0)
  const activeSeries = seriesList[activeSeriesIdx]

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

  const [loadedDicomDataset, setLoadedDicomDataset] = useState<DicomDataset | null>(null)
  const [loadedPatientInfo, setLoadedPatientInfo] = useState<PatientInfo | null>(null)
  const [dicomFileName, setDicomFileName] = useState('')
  const [dicomError, setDicomError] = useState('')
  const [dicomPresets, setDicomPresets] = useState<WindowPreset[]>([])
  const [isDragging, setIsDragging] = useState(false)

  const [layout, setLayout] = useState<LayoutMode>('1x1')
  const [rightTab, setRightTab] = useState<RightTab>('patient')
  const [pseudoColorMode, setPseudoColorMode] = useState<PseudoColorMode>('none')
  const [showPseudoColorPanel, setShowPseudoColorPanel] = useState(false)

  const [activeAnnotationType, setActiveAnnotationType] = useState<AnnotationType>('text')
  const [activeAnnotationColor, setActiveAnnotationColor] = useState(ANNOTATION_COLORS[0])
  const [activeAnnotationFontSize, setActiveAnnotationFontSize] = useState(16)
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [showAnnotationsOverlay, setShowAnnotationsOverlay] = useState(true)
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
  const [compareImageIndex, setCompareImageIndex] = useState(0)
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
  const [toastVisible, setToastVisible] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

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
    const labels: Record<string, string> = { line: '长度', angle: '角度', ellipse: '椭圆ROI', rectangle: '矩形ROI', circle: '圆ROI', ctvalue: 'CT值', area: '面积' }
    return labels[type] || type
  }

  const clearAllMeasures = () => { setInteractiveMeasures([]); setDrawingPoints([]); setIsDrawingMeasure(false) }
  const deleteMeasure = (id: string) => { setInteractiveMeasures(prev => prev.filter(m => m.id !== id)) }

  const randomChoice = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

  const currentAnnotations: Annotation[] = []
  const activeAnnotation = activeAnnotationType
  const annotationColor = activeAnnotationColor
  const annotationFontSize = activeAnnotationFontSize

  // ---- 伪彩工具按钮 ----
  const pseudoColorTools = [
    { mode: 'none' as PseudoColorMode, icon: <EyeOff size={16} />, label: '原始' },
    { mode: 'hotIron' as PseudoColorMode, icon: <Flame size={16} />, label: '热铁' },
    { mode: 'coolBlue' as PseudoColorMode, icon: <Droplets size={16} />, label: '冷蓝' },
    { mode: 'pet' as PseudoColorMode, icon: <Activity size={16} />, label: 'PET' },
    { mode: 'softTissue' as PseudoColorMode, icon: <Wind size={16} />, label: '软组织' },
  ]

  // ---- 标注工具按钮类型 ----
  const annotationTypes = [
    { type: 'text' as AnnotationType, icon: <Type size={16} />, label: '文字' },
    { type: 'arrow' as AnnotationType, icon: <ArrowUpRight size={16} />, label: '箭头' },
    { type: 'rect' as AnnotationType, icon: <RectIcon size={16} />, label: '矩形' },
    { type: 'ellipse' as AnnotationType, icon: <CircleIcon size={16} />, label: '椭圆' },
  ]

  // ---- 工具按钮列表 ----
  const tools: { tool: Tool; icon: React.ReactNode; label: string; divider?: boolean }[] = [
    { tool: 'zoom', icon: <ZoomIn size={20} />, label: '缩放' },
    { tool: 'pan', icon: <Move size={20} />, label: '平移' },
    { tool: 'wl', icon: <Sun size={20} />, label: '窗口/级别' },
    { tool: 'rotate', icon: <RotateCw size={20} />, label: '旋转90°' },
    { tool: 'flipH', icon: <FlipHorizontal size={20} />, label: '水平翻转', divider: true },
    { tool: 'flipV', icon: <FlipVertical size={20} />, label: '垂直翻转' },
    { tool: 'reset', icon: <RefreshCw size={20} />, label: '重置', divider: true },
    { tool: 'measure', icon: <Ruler size={20} />, label: '测量' },
    { tool: 'annotate', icon: <PenTool size={20} />, label: '标注' },
    { tool: 'play', icon: isPlaying ? <Pause size={20} /> : <Play size={20} />, label: isPlaying ? '暂停' : '播放', divider: true },
    { tool: 'print', icon: <Printer size={20} />, label: '胶片打印' },
  ]

  const gridConfig = { '1x1': { cols: 1, rows: 1 }, '2x2': { cols: 2, rows: 2 }, '1x2': { cols: 1, rows: 2 }, '2x1': { cols: 2, rows: 1 } }[layout]
  const currentImage = images[imageIndex] || images[0]

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

  const handlePresetClick = (preset: WindowPreset, idx: number) => { setWw(preset.ww); setWl(preset.wl); setActivePresetIdx(activePresetIdx === idx ? null : idx) }

  const handleImageWheel = (deltaY: number, deltaX: number) => {
    if (Math.abs(deltaY) > Math.abs(deltaX)) { setWw(prev => Math.max(50, Math.min(4000, prev - deltaY * 0.5))) }
    if (Math.abs(deltaX) > Math.abs(deltaY)) { setWl(prev => Math.max(-1000, Math.min(1000, prev + deltaX * 0.5))) }
    if (deltaY !== 0 || deltaX !== 0) setActivePresetIdx(null)
  }

  const getCurrentPresets = () => getPresetsForModality(exam.modality)

  const handleLayoutChange = (newLayout: LayoutMode) => setLayout(newLayout)
  const handleSeriesSelect = (idx: number) => { setActiveSeriesIdx(idx); setImageIndex(0) }
  const handleExamChange = (e: React.ChangeEvent<HTMLSelectElement>) => setSelectedExamIdx(parseInt(e.target.value))

  const handleExternalSearch = () => {
    if (!externalInstitution) { showToast('请先选择外部机构'); return }
    if (!externalSearchText.trim()) { showToast('请输入检索条件'); return }
    const results = EXTERNAL_INSTITUTIONS.filter(i => i.status === 'online').map(() => ({
      id: `ext-${Date.now()}`, institutionId: externalInstitution, patientId: 'P001', patientName: '模拟患者',
      gender: '男', age: 45, examDate: '2026-04-15', examItemName: '胸部CT平扫', modality: 'CT', bodyPart: 'CHEST',
      deviceName: 'GE Revolution', accessionNumber: 'EXT001', status: 'available',
    }))
    setExternalSearchResults(results)
    if (results.length === 0) showToast('未找到匹配的检查记录')
  }

  const handleArchiveRequest = () => {
    setArchiveRequestStatus('pending'); showToast('正在申请调阅...')
    setTimeout(() => { setArchiveRequestStatus('success'); showToast('调阅申请已提交') }, 1500)
  }

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) { document.documentElement.requestFullscreen(); setIsFullscreen(true) }
    else { document.exitFullscreen(); setIsFullscreen(false) }
  }

  const enterCompareMode = () => {
    if (selectedHistoryExams.length > 0) {
      const mockExam = { examDate: '2026-04-15', examTime: '09:30', reportDoctor: '张伟明', finding: '左肺上叶见一枚直径约8mm磨玻璃结节', conclusion: '左肺上叶磨玻璃结节' }
      setCompareExam(mockExam); setIsCompareMode(true); showToast('进入对比模式')
    }
  }
  const exitCompareMode = () => { setIsCompareMode(false); setCompareExam(null); showToast('退出对比模式') }

  const toggleHistoryExam = (id: string) => {
    setSelectedHistoryExams(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const getCompareDiffInfo = () => {
    if (!compareExam) return null
    return [
      { label: '结节大小', oldVal: '6mm', newVal: '8mm', type: 'increase' as const },
      { label: '密度', oldVal: '磨玻璃', newVal: '磨玻璃', type: 'nochange' as const },
      { label: '新发病灶', oldVal: '无', newVal: '无', type: 'nochange' as const },
    ]
  }

  const exportMeasurements = (format: string) => {
    const report = interactiveMeasures.map(m => `${m.label || m.type}: ${m.value}${m.unit}`).join('\n')
    navigator.clipboard.writeText(report || '暂无测量数据'); showToast('测量报告已复制到剪贴板')
  }

  const handleDicomFile = async (file: File) => { setDicomError(''); setDicomFileName(file.name) }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = async (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) await handleDicomFile(e.dataTransfer.files[0]) }

  const lookSimilarExams = () => { showToast('相似病例检索功能待实现') }

  const mockHistoryExams: HistoryExam[] = []
  const filteredHistoryExams = mockHistoryExams.filter(e => historySearchText ? e.examItemName.includes(historySearchText) || e.modality.includes(historySearchText) : true)
  const diffRegions: any[] = [];

  (window as any).mockAppendAnnotation = mockAppendAnnotation

  return (
    <>
      <ViewerSelector current="classic" />
      <div data-testid="dicom-viewer-page" style={s.root}>
        {loading && <LoadingBanner message="正在从 API 加载影像数据..." />}
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
            pseudoColorMode={pseudoColorMode} setPseudoColorMode={setPseudoColorMode}
            showPseudoColorPanel={showPseudoColorPanel} setShowPseudoColorPanel={setShowPseudoColorPanel}
            invert={invert} setInvert={setInvert}
            showAnnotationPanel={showAnnotationPanel} setShowAnnotationPanel={setShowAnnotationPanel}
          />
          <ViewportArea
            exam={exam} loading={loading} loadError={loadError}
            seriesList={seriesList} activeSeriesIdx={activeSeriesIdx} activeSeries={activeSeries}
            images={images} imageIndex={imageIndex} currentImage={currentImage}
            showGrid={showGrid} isFullscreen={isFullscreen} isPlaying={isPlaying}
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
            showAnnotationPanel={showAnnotationPanel}
            showMeasurementsOverlay={showMeasurementsOverlay} measureSubMenu={measureSubMenu}
            isDrawingMeasure={isDrawingMeasure} interactiveMeasures={interactiveMeasures}
            drawingPoints={drawingPoints} annotations={annotations}
            showAnnotationsOverlay={showAnnotationsOverlay}
            selectedAnnotationId={selectedAnnotationId}
            activeAnnotationType={activeAnnotationType}
            activeAnnotationColor={activeAnnotationColor}
            activeAnnotationFontSize={activeAnnotationFontSize}
            pseudoColorMode={pseudoColorMode} pseudoColorTools={pseudoColorTools}
            annotationTypes={annotationTypes} gridConfig={gridConfig}
            setActiveSeriesIdx={setActiveSeriesIdx} setImageIndex={setImageIndex}
            setZoom={setZoom} setPanX={setPanX} setPanY={setPanY}
            setRotation={setRotation} setFlipH={setFlipH} setFlipV={setFlipV}
            setBrightness={setBrightness} setContrast={setContrast} setInvert={setInvert}
            setWw={setWw} setWl={setWl} setActivePresetIdx={setActivePresetIdx}
            setViewMode={setViewMode} setMipDirection={setMipDirection} setMipFrame={setMipFrame}
            setVrRotX={setVrRotX} setVrRotY={setVrRotY} setVrRotZ={setVrRotZ} setVrOpacity={setVrOpacity}
            setShowGrid={setShowGrid} setIsFullscreen={setIsFullscreen} setIsPlaying={setIsPlaying}
            setActiveTool={setActiveTool} setShowWlPopup={setShowWlPopup}
            setShowPseudoColorPanel={setShowPseudoColorPanel} setShowAnnotationPanel={setShowAnnotationPanel}
            setShowMeasurementsOverlay={setShowMeasurementsOverlay} setMeasureSubMenu={setMeasureSubMenu}
            setIsDrawingMeasure={setIsDrawingMeasure} setDrawingPoints={setDrawingPoints}
            setSelectedAnnotationId={setSelectedAnnotationId} setActiveAnnotationType={setActiveAnnotationType}
            setActiveAnnotationColor={setActiveAnnotationColor} setActiveAnnotationFontSize={setActiveAnnotationFontSize}
            setPseudoColorMode={setPseudoColorMode} setRightTab={setRightTab}
            handleToolClick={handleToolClick} handlePresetClick={handlePresetClick}
            handleImageWheel={handleImageWheel} handleLayoutChange={handleLayoutChange}
            handleSeriesSelect={handleSeriesSelect} handleExamChange={handleExamChange}
            toggleFullscreen={toggleFullscreen} clearAllMeasures={clearAllMeasures}
            clearAllAnnotations={clearAllAnnotations} deleteMeasure={deleteMeasure}
            deleteAnnotation={deleteAnnotation} toggleAnnotationVisibility={toggleAnnotationVisibility}
            toggleAnnotationLock={toggleAnnotationLock} enterCompareMode={enterCompareMode}
            exitCompareMode={exitCompareMode} exportMeasurements={exportMeasurements}
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
          title="胶片打印预览"
          icon={<Printer size={18} color="#fff" />}
          iconBg={PRIMARY}
          width={640}
          footer={
            <>
              <button style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }} onClick={() => setShowPrintPreview(false)}>取消</button>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => { showToast('正在发送打印任务...'); setShowPrintPreview(false) }}><Printer size={14} />确认打印</button>
            </>
          }
        >
          <div style={{ background: '#111', padding: 16, borderRadius: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 12 }}>
              {['序列1-层面1', '序列1-层面2', '序列2-层面1', '序列2-层面2'].map((label, i) => (
                <div key={i} style={{ background: '#222', borderRadius: 4, padding: '40px 20px', textAlign: 'center', color: '#666', fontSize: 12 }}>
                  <div style={{ fontSize: 40, marginBottom: 8, opacity: 0.3 }}>▣</div>{label}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#888', fontSize: 12 }}>
              <span>Patient: {exam.patientName} | {exam.patientId}</span>
              <span>{exam.examItemName} | {exam.deviceName?.split('（')[0]}</span>
            </div>
          </div>
        </AppModal>

        {/* Toast 提示 */}
        {toastVisible && (
          <div style={{ position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)', background: '#22c55e', color: '#fff', padding: '10px 20px', borderRadius: 8, fontSize: 13, fontWeight: 600, boxShadow: '0 4px 16px rgba(34,197,94,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
            <CheckCircle size={16} />{toastMsg}
          </div>
        )}

        {/* 底部状态栏 */}
        <div style={s.statusBar}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {exam.patientName} · {exam.examItemName}
          </span>
          <span>Accession: {exam.accessionNumber}</span>
          <span>设备: {exam.deviceName?.split('（')[0]}</span>
          <span style={{ color: '#3b82f6' }}>窗口: {ww}/{wl}</span>
          <span style={{ color: '#22c55e' }}>缩放: {zoom}%</span>
          <span style={{ color: '#f59e0b' }}>旋转: {rotation}°</span>
          <span style={{ color: '#a855f7' }}>{activeSeries.seriesDescription}</span>
          <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
            <Activity size={12} />DICOM Viewer v0.4.0 | {exam.modality}-{exam.bodyPart}
          </span>
        </div>
      </div>
    </>
  )
}
