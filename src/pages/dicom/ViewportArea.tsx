import { useCallback, useMemo } from 'react'
import { t } from '../../i18n/appI18n'
import { ChevronLeft, ChevronRight, Grid3x3, History, Minimize2, Maximize2, Sun, ArrowLeftRight, Layers, Palette, CheckCircle, MonitorCheck, Gauge } from 'lucide-react'
import { initialRadiologyExams } from '../../data/initialData'
import { DicomCanvas, MIPCanvas, VRCanvas } from './DicomViewerSubComponents'
import AnnotationOverlay from './AnnotationOverlay'
import type { Tool, PseudoColorMode, MeasureSubMenu, LayoutMode, ViewMode, MipDirection, AnnotationType, Series, DicomImage, Measurement, Annotation } from './DicomViewerTypes'
import { ANNOTATION_COLORS, ANNOTATION_COLOR_NAMES, PRIMARY, CARD_BG } from './DicomViewerTypes'
import { useFocusTrap } from '../../a11y/SkipLink'
import { useEscape } from '../../hooks/useEscape'
import { getPresetsForModality, CT_DEFAULT_WW, CT_DEFAULT_WL } from '../../utils/modalityPresets'
import { GSOF_MODE_LABELS, GSOF_DOC_TEXT, type GsofMode } from '../../utils/gsdf'

const s = {
  centerArea: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', background: '#0f172a', position: 'relative' as const },
  roiToolbar: { display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', padding: '6px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap' as const },
  roiToolBtn: { padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', transition: 'all 0.15s' },
  roiToolBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  roiToolDivider: { width: 1, height: 24, background: 'var(--border-color)', margin: '0 4px' },
  roiLabel: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginRight: 'var(--space-1, 4px)', whiteSpace: 'nowrap' as const },
  exportBtn: { padding: '6px 12px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', marginLeft: 'auto' },
  topToolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', flexShrink: 0, flexWrap: 'wrap' as const },
  topToolbarSection: { display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', paddingRight: 'var(--space-2, 8px)', borderRight: '1px solid var(--border-color)' },
  topToolbarSectionLast: { display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' },
  label: { fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' as const },
  select: { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 12, color: PRIMARY, fontWeight: 600, cursor: 'pointer',},
  slider: { width: 80, accentColor: PRIMARY } as React.CSSProperties,
  sliderVal: { fontSize: 12, color: PRIMARY, fontWeight: 600 },
  imgCounter: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' },
  toolBtn: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  layoutBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' } as React.CSSProperties,
  layoutBtnActive: { background: PRIMARY, borderColor: PRIMARY },
  presetBtn: { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' } as React.CSSProperties,
  presetBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  imageMain: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' as const, overflow: 'hidden', background: '#0a0a0a' },
  imageWrapper: { position: 'relative' as const, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  overlayTL: { position: 'absolute' as const, top: 8, left: 8, display: 'flex', flexDirection: 'column' as const, gap: 2, zIndex: 5 },
  overlayTR: { position: 'absolute' as const, top: 8, right: 8, display: 'flex', flexDirection: 'column' as const, gap: 2, zIndex: 5, textAlign: 'right' as const },
  overlayBL: { position: 'absolute' as const, bottom: 8, left: 8, display: 'flex', flexDirection: 'column' as const, gap: 2, zIndex: 5, fontSize: 12, fontFamily: 'monospace' },
  overlayBR: { position: 'absolute' as const, bottom: 8, right: 8, display: 'flex', flexDirection: 'column' as const, gap: 2, zIndex: 5, fontSize: 12, fontFamily: 'monospace', textAlign: 'right' as const },
  annotationSvg: { position: 'absolute' as const, top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' as const },
  compareSplitContainer: { display: 'flex', flex: 1, overflow: 'hidden' },
  compareSplitPane: { flex: 1, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', position: 'relative' as const },
  compareDivider: { width: 4, background: PRIMARY, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  compareDividerHandle: { width: 12, height: 40, background: PRIMARY, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'col-resize', color: '#fff' },
  compareLabel: { position: 'absolute' as const, top: 8, left: 8, background: 'rgba(30,58,95,0.9)', color: '#fff', padding: '3px 8px', borderRadius: 4, fontSize: 12, fontWeight: 700, zIndex: 10 },
  compareLabelRight: { left: 'auto', right: 8 },
  compareToolbarBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', transition: 'all 0.15s' },
  compareToolbarBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  fullscreenBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  mipCanvasContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative' as const, overflow: 'hidden' },
  vrCanvasContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative' as const, overflow: 'hidden' },
  diffRegion: { position: 'absolute' as const, border: '2px dashed var(--color-error-500)', background: 'rgba(239,68,68,0.15)', borderRadius: 4 },
  diffRegionNew: { border: '2px dashed var(--color-success-500)', background: 'rgba(34,197,94,0.15)' },
  diffRegionImproved: { border: '2px dashed var(--color-primary-500)', background: 'rgba(59,130,246,0.15)' },
  wlPopup: { position: 'absolute' as const, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 240, background: CARD_BG, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 100, padding: 14, border: '1px solid var(--border-color)' },
  wlPopupTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
  wlSliderRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  wlLabel: { fontSize: 12, color: '#64748b', flexShrink: 0, minWidth: 24 },
  wlSlider: { flex: 1, accentColor: PRIMARY } as React.CSSProperties,
  wlVal: { fontSize: 12, color: PRIMARY, fontWeight: 600, minWidth: 32, textAlign: 'right' as const },
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', justifyContent: 'center' } as React.CSSProperties,
  measureMenu: { position: 'absolute' as const, left: 60, top: 300, width: 160, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 6 },
  measureMenuItem: { width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' } as React.CSSProperties,
  pseudoColorPanel: { position: 'absolute' as const, left: 60, top: 320, width: 180, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 10 },
  pseudoColorPanelTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 },
  pseudoColorBtn: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-secondary)', transition: 'all 0.15s', marginBottom: 'var(--space-1, 4px)' },
  pseudoColorBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  pseudoColorPreview: { width: 24, height: 24, borderRadius: 4, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 },
  gsofPanel: { position: 'absolute' as const, left: 60, top: 260, width: 240, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 'var(--space-3, 12px)' },
  gsofPanelTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 },
  gsofDoc: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 'var(--space-2, 8px)', padding: '8px 10px', background: 'var(--bg-primary)', borderRadius: 6, border: '1px solid var(--border-color)' },
  annotationPanel: { position: 'absolute' as const, left: 60, top: 200, width: 200, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 10 },
  annotationPanelTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  annotationTypeRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-2, 8px)' },
  annotationTypeBtn: { height: 36, borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 'var(--space-1, 4px)' },
  annotationTypeBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  annotationTypeBtnLabel: { fontSize: 10, color: 'var(--text-muted)', textAlign: 'center' as const },
  annotationColorPicker: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-2, 8px)' },
  annotationColorBtn: { width: 24, height: 24, borderRadius: 4, border: '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' },
  annotationColorBtnActive: { border: '2px solid var(--color-primary-800)', transform: 'scale(1.1)' },
  annotationFontSizeRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-2, 8px)' },
  annotationFontSizeLabel: { fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 },
  annotationFontSizeInput: { flex: 1, padding: '4px 6px', borderRadius: 4, border: '1px solid var(--border-color)', fontSize: 12, width: 50 },
  annotationListItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: 'var(--bg-primary)', borderRadius: 6, marginBottom: 'var(--space-1, 4px)', border: '1px solid var(--border-color)', cursor: 'pointer', transition: 'all 0.15s' },
  annotationListItemSelected: { border: '2px solid var(--color-pending-border)', background: 'var(--color-pending-bg)' },
  annotationListItemLocked: { opacity: 0.7 },
  annotationListItemActions: { display: 'flex', gap: 'var(--space-1, 4px)', marginLeft: 'auto' },
  annotationActionBtn: { width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, transition: 'all 0.15s' } as React.CSSProperties,
  seriesStrip: { display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', padding: '6px 12px', background: '#1e293b', borderTop: '1px solid #334155', flexShrink: 0, overflowX: 'auto' as const },
  seriesThumb: { display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, cursor: 'pointer', padding: '4px 6px', borderRadius: 6, transition: 'all 0.15s', border: '2px solid transparent' },
  seriesThumbActive: { borderColor: PRIMARY, background: 'rgba(30,58,95,0.3)' },
  seriesThumbInner: { width: 40, height: 40, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 },
}

interface Props {
  exam: any
  seriesList: Series[]
  activeSeriesIdx: number
  activeSeries: Series
  images: DicomImage[]
  imageIndex: number
  currentImage: any
  showGrid: boolean
  isFullscreen: boolean
  zoom: number
  panX: number
  panY: number
  rotation: number
  flipH: boolean
  flipV: boolean
  brightness: number
  contrast: number
  invert: boolean
  ww: number
  wl: number
  activePresetIdx: number | null
  viewMode: ViewMode
  mipDirection: MipDirection
  mipFrame: number
  vrRotX: number
  vrRotY: number
  vrRotZ: number
  vrOpacity: number
  layout: LayoutMode
  isCompareMode: boolean
  compareExam: any
  compareImageIndex: number
  syncScroll: boolean
  showDiffHighlight: boolean
  diffRegions: any[]
  selectedHistoryExams: string[]
  activeTool: Tool
  showWlPopup: boolean
  showPseudoColorPanel: boolean
  showMeasurementsOverlay: boolean
  measureSubMenu: MeasureSubMenu
  isDrawingMeasure: boolean
  interactiveMeasures: Measurement[]
  drawingPoints: { x: number; y: number }[]
  // [G005 v3.0.6.11-99 Wave 4B] 测量族增强: 画布取点 + 多边形完成
  handleMeasurePoint: (x: number, y: number) => void
  finishPolygonMeasure: () => void
  annotations: Annotation[]
  showAnnotationsOverlay: boolean
  selectedAnnotationId: string | null
  activeAnnotationType: AnnotationType
  activeAnnotationColor: string
  activeAnnotationFontSize: number
  pseudoColorMode: PseudoColorMode
  pseudoColorTools: { mode: PseudoColorMode; icon: React.ReactNode; label: string }[]
  annotationTypes: { type: AnnotationType; icon: React.ReactNode; label: string }[]
  gridConfig: { cols: number; rows: number }
  // [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 灰阶标准显示函数 (DICOM PS3.14)
  gsofEnabled: boolean
  gsofMode: GsofMode
  showGsofPanel: boolean
  setGsofEnabled: (v: boolean) => void
  setGsofMode: (m: GsofMode) => void
  setShowGsofPanel: (v: boolean) => void
  setImageIndex: (fn: (prev: number) => number) => void
  setWw: (v: number | ((prev: number) => number)) => void
  setWl: (v: number | ((prev: number) => number)) => void
  setActivePresetIdx: (i: number | null) => void
  setViewMode: (v: ViewMode) => void
  setShowGrid: (fn: (prev: boolean) => boolean) => void
  setActiveTool: (t: Tool) => void
  setShowWlPopup: (v: boolean) => void
  setShowPseudoColorPanel: (v: boolean) => void
  setShowAnnotationPanel: (v: boolean) => void
  setMeasureSubMenu: (m: MeasureSubMenu) => void
  setSelectedAnnotationId: (id: string | null) => void
  setActiveAnnotationType: (t: AnnotationType) => void
  setActiveAnnotationColor: (c: string) => void
  setActiveAnnotationFontSize: (s: number) => void
  setPseudoColorMode: (m: PseudoColorMode) => void
  handlePresetClick: (p: any, idx: number) => void
  handleLayoutChange: (l: LayoutMode) => void
  handleSeriesSelect: (idx: number) => void
  handleExamChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  toggleFullscreen: () => void
  clearAllMeasures: () => void
  clearAllAnnotations: () => void
  deleteAnnotation: (id: string) => void
  toggleAnnotationVisibility: (id: string) => void
  toggleAnnotationLock: (id: string) => void
  enterCompareMode: () => void
  exportMeasurements: (format: string) => void
  getCurrentPresets: () => { name: string; ww: number; wl: number }[]
}

export default function ViewportArea(props: Props) {
  const { exam, seriesList, activeSeriesIdx, activeSeries, images, imageIndex, currentImage,
    showGrid, isFullscreen, zoom, panX, panY, rotation, flipH, flipV, brightness, contrast, invert,
    ww, wl, activePresetIdx, viewMode, mipDirection, mipFrame, vrRotX, vrRotY, vrRotZ, vrOpacity,
    layout, isCompareMode, compareExam, compareImageIndex, syncScroll, showDiffHighlight, diffRegions,
    selectedHistoryExams, activeTool, showWlPopup, showPseudoColorPanel,
    showMeasurementsOverlay, measureSubMenu, isDrawingMeasure, interactiveMeasures, drawingPoints,
    handleMeasurePoint, finishPolygonMeasure,
    annotations, showAnnotationsOverlay, selectedAnnotationId, activeAnnotationType, activeAnnotationColor,
    activeAnnotationFontSize, pseudoColorMode, pseudoColorTools, annotationTypes, gridConfig,
    gsofEnabled, gsofMode, showGsofPanel, setGsofEnabled, setGsofMode, setShowGsofPanel,
    setImageIndex, setWw, setWl, setActivePresetIdx, setViewMode, setShowGrid,
    setActiveTool, setShowWlPopup, setShowPseudoColorPanel,
    setMeasureSubMenu, setSelectedAnnotationId, setActiveAnnotationType,
    setActiveAnnotationColor, setActiveAnnotationFontSize, setPseudoColorMode, setShowAnnotationPanel,
    handlePresetClick, handleLayoutChange, handleSeriesSelect,
    handleExamChange, toggleFullscreen, clearAllMeasures, clearAllAnnotations,
    deleteAnnotation, toggleAnnotationVisibility, toggleAnnotationLock, enterCompareMode,
    exportMeasurements, getCurrentPresets } = props

  const wlPopupRef = useFocusTrap(showWlPopup)
  const measureMenuRef = useFocusTrap(activeTool === 'measure' && measureSubMenu !== null)
  const pseudoColorPanelRef = useFocusTrap(showPseudoColorPanel)
  const gsofPanelRef = useFocusTrap(showGsofPanel)

  useEscape(showWlPopup, () => setShowWlPopup(false), { stopPropagation: true })
  useEscape(activeTool === 'measure' && measureSubMenu !== null, () => setMeasureSubMenu(null), { stopPropagation: true })
  useEscape(showPseudoColorPanel, () => setShowPseudoColorPanel(false), { stopPropagation: true })
  useEscape(showGsofPanel, () => setShowGsofPanel(false), { stopPropagation: true })

  const closeWlPopup = useCallback(() => {
    setShowWlPopup(false)
  }, [setShowWlPopup])

  const closePseudoColor = useCallback(() => {
    setShowPseudoColorPanel(false)
  }, [setShowPseudoColorPanel])

  const closeMeasureMenu = useCallback(() => {
    setMeasureSubMenu(null)
  }, [setMeasureSubMenu])

  const modalityPresets = useMemo(() => getPresetsForModality(exam.modality), [exam.modality])
  const currentPresets = useMemo(() => {
    const fromProp = getCurrentPresets()
    return fromProp && fromProp.length > 0 ? fromProp : modalityPresets
  }, [getCurrentPresets, modalityPresets])

  return (
    <div style={s.centerArea}>
      <div style={s.roiToolbar}>
        <span style={s.roiLabel}>{t('dcmView.roiTools')}</span>
        {(['length', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue', 'cobb', 'polygon'] as const).map(type => (
          <button key={type} style={{ ...s.roiToolBtn, ...(measureSubMenu === type ? s.roiToolBtnActive : {}) }}
            onClick={() => { setMeasureSubMenu(type); setActiveTool('measure') }} title={type}>
            {type === 'length' ? t('dcmView.roi.length') : type === 'angle' ? t('dcmView.roi.angle') : type === 'ellipse' ? t('dcmView.roi.ellipse') : type === 'rectangle' ? t('dcmView.roi.rectangle') : type === 'circle' ? t('dcmView.roi.circle') : type === 'ctvalue' ? t('dcmView.roi.ctvalue') : type === 'cobb' ? t('dcmView.roi.cobb') : t('dcmView.roi.polygon')}
          </button>
        ))}
        {isDrawingMeasure && measureSubMenu === 'polygon' && (
          <button style={{ ...s.roiToolBtn, background: 'var(--color-success-500)', borderColor: 'var(--color-success-500)', color: '#fff' }} onClick={finishPolygonMeasure}>{t('dcmView.finishPolygon', { count: drawingPoints.length })}</button>
        )}
        <div style={s.roiToolDivider} />
        <button style={{ ...s.roiToolBtn, color: 'var(--color-error-500)' }} onClick={clearAllMeasures}>{t('dcmView.clear')}</button>
        <button style={s.exportBtn} onClick={() => exportMeasurements('clipboard')}>{t('dcmView.exportReport')}</button>
      </div>

      <div style={s.topToolbar}>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.examLabel')}</span>
          <select style={s.select} value={-1} onChange={handleExamChange}>
            {initialRadiologyExams.map((e, i) => (
              <option key={e.id} value={i}>{e.patientName} - {e.examItemName} ({e.modality})</option>
            ))}
          </select>
        </div>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.seriesLabel')}</span>
          <span style={{ ...s.sliderVal, minWidth: 24 }}>{activeSeriesIdx + 1}/{seriesList.length}</span>
          <input type="range" min={0} max={seriesList.length - 1} value={activeSeriesIdx} onChange={e => handleSeriesSelect(parseInt(e.target.value))} style={s.slider} />
        </div>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.imageLabel')}</span>
          <span style={s.imgCounter}>{imageIndex + 1} / {images.length}</span>
          <button style={{ ...s.toolBtn, color: PRIMARY, padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 6 }} onClick={() => setImageIndex(i => Math.max(0, i - 1))}><ChevronLeft size={14} /></button>
          <button style={{ ...s.toolBtn, color: PRIMARY, padding: '4px 6px', border: '1px solid var(--border-color)', borderRadius: 6 }} onClick={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}><ChevronRight size={14} /></button>
        </div>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.layoutLabel')}</span>
          {(['1x1', '2x2', '1x2', '2x1'] as LayoutMode[]).map(l => (
            <button key={l} style={{ ...s.layoutBtn, ...(layout === l ? s.layoutBtnActive : {}) }} onClick={() => handleLayoutChange(l)}><Grid3x3 size={14} color={layout === l ? '#fff' : 'var(--text-muted)'} /></button>
          ))}
        </div>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.modeLabel')}</span>
          {(['MPR', 'MIP', 'VR'] as ViewMode[]).map(vm => (
            <button key={vm} style={{ ...s.presetBtn, ...(viewMode === vm ? s.presetBtnActive : {}), padding: '4px 8px' }} onClick={() => setViewMode(vm)}>{vm}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', marginLeft: 'var(--space-2, 8px)' }}>
          <button style={{ ...s.compareToolbarBtn, ...(selectedHistoryExams.length > 0 ? s.compareToolbarBtnActive : {}) }} onClick={enterCompareMode}><History size={14} />{t('dcm.historyTab')}</button>
        </div>
        <button style={{ ...s.layoutBtn, ...(showGrid ? s.layoutBtnActive : {}), marginLeft: 'var(--space-2, 8px)' }} onClick={() => setShowGrid(g => !g)}><Grid3x3 size={14} color={showGrid ? '#fff' : 'var(--text-muted)'} /></button>
        {/* [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 校准开关 */}
        <button
          style={{
            width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: gsofEnabled || showGsofPanel ? '1px solid var(--color-primary-800)' : '1px solid var(--border-color)',
            background: gsofEnabled || showGsofPanel ? PRIMARY : 'var(--bg-card)',
            transition: 'all 0.15s',
          }}
          onClick={() => setShowGsofPanel(!showGsofPanel)}
          title={`${t('w9d.viewport.gsofCalibration')}${gsofEnabled ? ` (${t('w9d.viewport.enabled')})` : ''}`}
          data-testid="gsof-toggle"
          aria-pressed={gsofEnabled}
        >
          <MonitorCheck size={14} color={gsofEnabled || showGsofPanel ? '#fff' : 'var(--text-muted)'} />
        </button>
        <button style={s.fullscreenBtn} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
      </div>

      <div id="image-main-area" style={isCompareMode ? { ...s.imageMain, display: 'flex' } : s.imageMain}
        onClick={() => { if (activeTool === 'wl') setShowWlPopup(false); if (activeTool === 'measure' && !isDrawingMeasure) setMeasureSubMenu(null) }}>
        {isCompareMode ? (
          <div style={s.compareSplitContainer}>
            <div style={s.compareSplitPane}>
              <span style={s.compareLabel}>{t('dcmView.currentLabel', { date: exam.examDate })}</span>
              <div style={{ ...s.imageWrapper, width: '100%', height: '100%' }}>
                <DicomCanvas zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV} ww={ww} wl={wl} brightness={brightness} contrast={contrast} invert={invert}
                  activeTool={activeTool} panX={panX} panY={panY}
                  activeSeries={activeSeries} pseudoColorMode={pseudoColorMode} gsofEnabled={gsofEnabled} gsofMode={gsofMode} />
                {showDiffHighlight && diffRegions.map(region => (
                  <div key={region.id} style={{ ...s.diffRegion, ...(region.type === 'increase' ? {} : region.type === 'new' ? s.diffRegionNew : s.diffRegionImproved), left: region.x, top: region.y, width: region.w, height: region.h }} />
                ))}
              </div>
              <div style={s.overlayBL}><span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span><span style={{ color: '#86efac' }}>Img:{imageIndex + 1}/{images.length}</span></div>
              <div style={s.overlayBR}><span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span></div>
            </div>
            <div style={s.compareDivider}><div style={s.compareDividerHandle}><ArrowLeftRight size={8} /></div></div>
            <div style={s.compareSplitPane}>
              <span style={{ ...s.compareLabel, ...s.compareLabelRight }}>{t('dcmView.historyLabel', { date: compareExam?.examDate })}</span>
              <div style={{ ...s.imageWrapper, width: '100%', height: '100%' }}>
                <DicomCanvas zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV} ww={ww} wl={wl} brightness={brightness} contrast={contrast} invert={invert}
                  activeTool={activeTool} panX={panX} panY={panY}
                  activeSeries={activeSeries} pseudoColorMode={pseudoColorMode} gsofEnabled={gsofEnabled} gsofMode={gsofMode} />
                {showDiffHighlight && diffRegions.map(region => (
                  <div key={`r-${region.id}`} style={{ ...s.diffRegion, ...(region.type === 'increase' ? {} : region.type === 'new' ? s.diffRegionNew : s.diffRegionImproved), left: region.x, top: region.y, width: region.w, height: region.h }} />
                ))}
              </div>
              <div style={s.overlayBL}><span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span><span style={{ color: '#86efac' }}>Img:{syncScroll ? imageIndex + 1 : compareImageIndex + 1}/{images.length}</span></div>
              <div style={s.overlayBR}><span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>{!syncScroll && <span style={{ color: 'var(--color-warning-400)' }}>{t('dcmView.independentScroll')}</span>}</div>
            </div>
          </div>
        ) : (
          <div style={{ ...s.imageWrapper, width: gridConfig.cols === 2 ? 'calc(50% - 4px)' : '100%', height: gridConfig.rows === 2 ? 'calc(50% - 4px)' : '100%' }}
            onClick={(e) => {
              if (activeTool !== 'measure' || !measureSubMenu) return
              e.stopPropagation()
              const canvas = (e.currentTarget as HTMLElement).querySelector('canvas')
              const rect = canvas ? canvas.getBoundingClientRect() : (e.currentTarget as HTMLElement).getBoundingClientRect()
              const scaleX = canvas && rect.width > 0 ? rect.width / 512 : 1
              const scaleY = canvas && rect.height > 0 ? rect.height / 512 : 1
              handleMeasurePoint((e.clientX - rect.left) / scaleX, (e.clientY - rect.top) / scaleY)
            }}>
            {viewMode === 'MPR' && <DicomCanvas zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV} ww={ww} wl={wl} brightness={brightness} contrast={contrast} invert={invert}
              activeTool={activeTool} panX={panX} panY={panY}
              activeSeries={activeSeries} pseudoColorMode={pseudoColorMode} gsofEnabled={gsofEnabled} gsofMode={gsofMode} />}
            {viewMode === 'MIP' && <div style={s.mipCanvasContainer}><MIPCanvas mipDirection={mipDirection} mipFrame={mipFrame} ww={ww} wl={wl} gsofEnabled={gsofEnabled} gsofMode={gsofMode} /></div>}
            {viewMode === 'VR' && <div style={s.vrCanvasContainer}><VRCanvas rotX={vrRotX} rotY={vrRotY} rotZ={vrRotZ} opacity={vrOpacity} /></div>}

            <div style={s.overlayTL}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{exam.patientName}</span>
              <span style={{ color: '#94a3b8' }}>#{exam.accessionNumber}</span>
              <span style={{ color: '#86efac' }}>{exam.examItemName}</span>
              {viewMode !== 'MPR' && <span style={{ color: 'var(--color-warning-400)' }}>{t('dcmView.modeLabel', { mode: viewMode })}</span>}
            </div>
            <div style={s.overlayTR}>
              <span style={{ color: 'var(--color-warning-400)' }}>{exam.deviceName?.split('（')[0]}</span>
              <span style={{ color: '#f87171' }}>Ser:{activeSeries.seriesNumber} Img:{currentImage?.imageNumber || 1}</span>
              <span style={{ color: '#a5f3fc' }}>{activeSeries.seriesDescription}</span>
            </div>
            <div style={{ ...s.overlayBL, display: 'flex', flexDirection: 'column', gap: 'var(--space-1, 4px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <span style={{ color: '#60a5fa', fontWeight: 700 }}>WW:{Math.round(ww)}</span>
                <span style={{ color: '#f87171', fontWeight: 700 }}>WL:{Math.round(wl)}</span>
              </div>
              <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {currentPresets.map((p, i) => (
                  <button key={p.name} onClick={() => handlePresetClick(p, i)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{p.name}</button>
                ))}
              </div>
              <span style={{ color: '#86efac', fontSize: 12 }}>{t('dcmView.scrollHint')}</span>
            </div>
            <div style={s.overlayBR}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-1, 4px)' }}>
                <span style={{ color: '#60a5fa', fontSize: 12 }}>WW</span>
                <input type="range" min={50} max={4000} value={ww} onChange={e => { setWw(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 80, accentColor: '#60a5fa' }} />
                <input type="number" value={Math.round(ww)} onChange={e => { setWw(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#60a5fa' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-1, 4px)' }}>
                <span style={{ color: '#f87171', fontSize: 12 }}>WL</span>
                <input type="range" min={-1000} max={1000} value={wl} onChange={e => { setWl(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 80, accentColor: '#f87171' }} />
                <input type="number" value={Math.round(wl)} onChange={e => { setWl(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#f87171' }} />
              </div>
              <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
              <span style={{ color: '#a5f3fc' }}>{flipH ? 'FH ' : ''}{flipV ? 'FV ' : ''}{invert ? `${t('dcmView.invertShort')} ` : ''}{t('dcmView.brightnessContrast', { brightness, contrast })}</span>
              {measureSubMenu && <span style={{ color: 'var(--color-warning-400)' }}>{t('dcmView.measureMode')}{measureSubMenu === 'length' ? t('dcmView.measure.length') : measureSubMenu === 'angle' ? t('dcmView.measure.angle') : measureSubMenu === 'cobb' ? t('dcmView.measure.cobb') : measureSubMenu === 'polygon' ? t('dcmView.measure.polygon') : measureSubMenu === 'ellipse' || measureSubMenu === 'rectangle' || measureSubMenu === 'circle' ? t('dcmView.measure.area') : t('dcmView.measure.ctvalue')}</span>}
              {pseudoColorMode !== 'none' && <span style={{ color: '#f97316' }}>{t('dcmView.pseudoColor')}{pseudoColorMode === 'hotIron' ? t('dcmView.pseudo.hotIron') : pseudoColorMode === 'coolBlue' ? t('dcmView.pseudo.coolBlue') : pseudoColorMode === 'pet' ? 'PET' : t('dcmView.pseudo.softTissue')}</span>}
              {gsofEnabled && <span style={{ color: '#22d3ee' }}>GSOF: {GSOF_MODE_LABELS[gsofMode] ?? t('dcmView.standard')} (PS3.14)</span>}
            </div>

            {showMeasurementsOverlay && (measureSubMenu || isDrawingMeasure || interactiveMeasures.length > 0) && (
              <svg style={s.annotationSvg}>
                {interactiveMeasures.map(measure => {
                  if (measure.points.length < 1) return null
                  const points = measure.points; const color = (measure as any).color || 'var(--color-success-500)'
                  if (measure.type === 'line' && points.length >= 2) {
                    const p1 = points[0]!, p2 = points[1]!; const midX = (p1.x + p2.x) / 2; const midY = (p1.y + p2.y) / 2
                    return <g key={measure.id}><line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} /><circle cx={p1.x} cy={p1.y} r={4} fill={color} /><circle cx={p2.x} cy={p2.y} r={4} fill={color} /><text x={midX} y={midY - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.value}{measure.unit}</text></g>
                  }
                  if (measure.type === 'angle' && points.length >= 3) {
                    const p1 = points[0]!, vertex = points[1]!, p2 = points[2]!
                    return <g key={measure.id}><line x1={vertex.x} y1={vertex.y} x2={p1.x} y2={p1.y} stroke={color} strokeWidth={2} /><line x1={vertex.x} y1={vertex.y} x2={p2.x} y2={p2.y} stroke={color} strokeWidth={2} /><circle cx={p1.x} cy={p1.y} r={4} fill={color} /><circle cx={vertex.x} cy={vertex.y} r={4} fill={color} /><circle cx={p2.x} cy={p2.y} r={4} fill={color} /><text x={vertex.x + 20} y={vertex.y - 10} fill={color} fontSize={12} fontFamily="monospace">{measure.value}{measure.unit}</text></g>
                  }
                  if (measure.type === 'ellipse' && points.length >= 2) {
                    const p1 = points[0]!, p2 = points[1]!; const cx = (p1.x + p2.x) / 2; const cy = (p1.y + p2.y) / 2; const rx = Math.abs(p2.x - p1.x) / 2; const ry = Math.abs(p2.y - p1.y) / 2
                    return <g key={measure.id}><ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} /><circle cx={p1.x} cy={p1.y} r={4} fill={color} /><circle cx={p2.x} cy={p2.y} r={4} fill={color} /><text x={cx} y={cy - ry - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.label}</text></g>
                  }
                  if (measure.type === 'rectangle' && points.length >= 2) {
                    const p1 = points[0]!, p2 = points[1]!; const x = Math.min(p1.x, p2.x); const y = Math.min(p1.y, p2.y); const w = Math.abs(p2.x - p1.x); const h = Math.abs(p2.y - p1.y)
                    return <g key={measure.id}><rect x={x} y={y} width={w} height={h} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} /><circle cx={p1.x} cy={p1.y} r={4} fill={color} /><circle cx={p2.x} cy={p2.y} r={4} fill={color} /><text x={x + w / 2} y={y - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.label}</text></g>
                  }
                  if (measure.type === 'circle' && points.length >= 2) {
                    const center = points[0]!, edge = points[1]!; const r = Math.sqrt(Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2))
                    return <g key={measure.id}><circle cx={center.x} cy={center.y} r={r} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} /><circle cx={center.x} cy={center.y} r={4} fill={color} /><circle cx={edge.x} cy={edge.y} r={4} fill={color} /><text x={center.x} y={center.y - r - 8} fill={color} fontSize={12} fontFamily="monospace" textAnchor="middle">{measure.label}</text></g>
                  }
                  if (measure.type === 'ctvalue' && points.length >= 1) {
                    const p = points[0]!
                    return <g key={measure.id}><circle cx={p.x} cy={p.y} r={10} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} /><text x={p.x + 15} y={p.y + 5} fill={color} fontSize={12} fontFamily="monospace">{measure.value}{measure.unit}</text></g>
                  }
                  // [G005 v3.0.6.11-99 Wave 4B] Cobb 角: 两条线段 + 夹角弧 + 角度标注
                  if (measure.type === 'cobb' && points.length >= 4) {
                    const [a1, a2, b1, b2] = [points[0]!, points[1]!, points[2]!, points[3]!]
                    const midA = { x: (a1.x + a2.x) / 2, y: (a1.y + a2.y) / 2 }
                    const midB = { x: (b1.x + b2.x) / 2, y: (b1.y + b2.y) / 2 }
                    const arcCx = (midA.x + midB.x) / 2; const arcCy = (midA.y + midB.y) / 2
                    const r = Math.max(24, Math.hypot(midB.x - midA.x, midB.y - midA.y) / 2.2)
                    const angA = Math.atan2(a2.y - a1.y, a2.x - a1.x)
                    const angB = Math.atan2(b2.y - b1.y, b2.x - b1.x)
                    const start = Math.min(angA, angB); const end = Math.max(angA, angB)
                    const large = end - start > Math.PI ? 1 : 0
                    const arcX = arcCx + r * Math.cos((start + end) / 2); const arcY = arcCy + r * Math.sin((start + end) / 2)
                    return <g key={measure.id}>
                      <line x1={a1.x} y1={a1.y} x2={a2.x} y2={a2.y} stroke={color} strokeWidth={2} />
                      <line x1={b1.x} y1={b1.y} x2={b2.x} y2={b2.y} stroke={color} strokeWidth={2} />
                      <circle cx={a1.x} cy={a1.y} r={4} fill={color} /><circle cx={a2.x} cy={a2.y} r={4} fill={color} />
                      <circle cx={b1.x} cy={b1.y} r={4} fill={color} /><circle cx={b2.x} cy={b2.y} r={4} fill={color} />
                      <path d={`M ${arcCx + r * Math.cos(start)} ${arcCy + r * Math.sin(start)} A ${r} ${r} 0 ${large} 1 ${arcCx + r * Math.cos(end)} ${arcCy + r * Math.sin(end)}`} fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="4 3" />
                      <text x={arcX} y={arcY - 6} fill={color} fontSize={13} fontWeight={700} fontFamily="monospace" textAnchor="middle">Cobb {measure.value}{measure.unit}</text>
                    </g>
                  }
                  // [G005 v3.0.6.11-99 Wave 4B] 多边形面积: 鞋带公式结果 + 顶点
                  if (measure.type === 'polygon' && points.length >= 3) {
                    const poly = points.map(p => `${p.x},${p.y}`).join(' ')
                    const cx = points.reduce((s, p) => s + p.x, 0) / points.length
                    const cy = points.reduce((s, p) => s + p.y, 0) / points.length
                    return <g key={measure.id}>
                      <polygon points={poly} fill={color} fillOpacity={0.15} stroke={color} strokeWidth={2} />
                      {points.map((p, i) => <circle key={`p-${i}`} cx={p.x} cy={p.y} r={4} fill={color} />)}
                      <text x={cx} y={cy} fill={color} fontSize={13} fontWeight={700} fontFamily="monospace" textAnchor="middle">{measure.label}</text>
                    </g>
                  }
                  return null
                })}
                {isDrawingMeasure && drawingPoints.map((point, idx) => (<circle key={`draw-${idx}`} cx={point.x} cy={point.y} r={5} fill="var(--color-success-500)" stroke="#fff" strokeWidth={2} />))}
              </svg>
            )}

            <AnnotationOverlay
              annotations={annotations}
              showAnnotationsOverlay={showAnnotationsOverlay}
              selectedAnnotationId={selectedAnnotationId}
              setSelectedAnnotationId={setSelectedAnnotationId}
              toggleAnnotationVisibility={toggleAnnotationVisibility}
              toggleAnnotationLock={toggleAnnotationLock}
              deleteAnnotation={deleteAnnotation}
              activeAnnotationType={activeAnnotationType}
              activeAnnotationColor={activeAnnotationColor}
              activeAnnotationFontSize={activeAnnotationFontSize}
              setActiveAnnotationType={setActiveAnnotationType}
              setActiveAnnotationColor={setActiveAnnotationColor}
              setActiveAnnotationFontSize={setActiveAnnotationFontSize}
              clearAllAnnotations={clearAllAnnotations}
              annotationTypes={annotationTypes}
              ANNOTATION_COLORS={ANNOTATION_COLORS}
              ANNOTATION_COLOR_NAMES={ANNOTATION_COLOR_NAMES}
              showAnnotationPanel={false}
              setShowAnnotationPanel={setShowAnnotationPanel}
            />
          </div>
        )}

        {showWlPopup && (
          <div ref={wlPopupRef} role="dialog" aria-modal="true" aria-label={t('dcm.wlSettings')} style={s.wlPopup} onClick={e => e.stopPropagation()}>
            <div style={s.wlPopupTitle}><Sun size={14} color={PRIMARY} />{t('dcm.wlSettings')}</div>
            <div style={s.wlSliderRow}><span style={s.wlLabel}>{t('dcm.wwLabel')}</span>
              <input type="range" min={50} max={4000} value={ww} aria-label={t('dcm.wwLabel')} onChange={e => { setWw(+e.target.value); setActivePresetIdx(null) }} style={s.wlSlider} />
              <span style={s.wlVal}>{ww}</span>
            </div>
            <div style={s.wlSliderRow}><span style={s.wlLabel}>{t('dcm.wlLabel')}</span>
              <input type="range" min={-1000} max={1000} value={wl} aria-label={t('dcm.wlLabel')} onChange={e => { setWl(+e.target.value); setActivePresetIdx(null) }} style={s.wlSlider} />
              <span style={s.wlVal}>{wl}</span>
            </div>
            <div style={{ marginTop: 'var(--space-2, 8px)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-1, 4px)' }} role="group" aria-label={t('dcmView.windowPresetsAria')}>
              {currentPresets.map((p, i) => (
                <button key={p.name} style={{ ...s.presetBtn, fontSize: 12, padding: '3px 6px', ...(activePresetIdx === i ? s.presetBtnActive : {}) }} onClick={() => handlePresetClick(p, i)} title={`WW:${p.ww} WL:${p.wl}`}>{p.name}</button>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-2, 8px)', display: 'flex', gap: 6 }}>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff', flex: 1 }} onClick={() => { setWw(CT_DEFAULT_WW); setWl(CT_DEFAULT_WL); setActivePresetIdx(null) }}>{t('dcmView.reset')}</button>
              <button style={{ ...s.reportBtn, background: 'var(--border-color)', color: 'var(--text-secondary)', flex: 1 }} onClick={closeWlPopup}>{t('dcmView.closeEsc')}</button>
            </div>
          </div>
        )}

        {activeTool === 'measure' && measureSubMenu !== null && (
          <div ref={measureMenuRef} role="dialog" aria-modal="true" aria-label={t('dcmView.measureToolsAria')} style={s.measureMenu} onClick={e => e.stopPropagation()}>
            {(['length', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue', 'cobb', 'polygon'] as MeasureSubMenu[]).map(type => (
              <button key={type} style={{ ...s.measureMenuItem, ...(measureSubMenu === type ? { background: `${PRIMARY}15`, color: PRIMARY } : {}) }} onClick={() => setMeasureSubMenu(type)}>
                {type === 'length' ? t('dcmView.measureMenu.length') : type === 'angle' ? t('dcmView.measureMenu.angle') : type === 'ellipse' ? t('dcmView.measureMenu.ellipse') : type === 'rectangle' ? t('dcmView.measureMenu.rectangle') : type === 'circle' ? t('dcmView.measureMenu.circle') : type === 'cobb' ? t('dcmView.measureMenu.cobb') : type === 'polygon' ? t('dcmView.measureMenu.polygon') : t('dcmView.measureMenu.ctvalue')}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 'var(--space-1, 4px)', paddingTop: 'var(--space-1, 4px)' }}>
              <button style={{ ...s.measureMenuItem, color: 'var(--color-error-500)' }} onClick={clearAllMeasures}>{t('dcmView.clearMeasures')}</button>
            </div>
            <button style={{ ...s.measureMenuItem, color: 'var(--text-muted)', justifyContent: 'center' }} onClick={closeMeasureMenu}>{t('dcmView.closeEsc')}</button>
          </div>
        )}

        {showPseudoColorPanel && (
          <div ref={pseudoColorPanelRef} role="dialog" aria-modal="true" aria-label={t('dcmView.pseudoColorTitle')} style={s.pseudoColorPanel} onClick={e => e.stopPropagation()}>
            <div style={s.pseudoColorPanelTitle}><Palette size={14} color={PRIMARY} />{t('dcmView.pseudoColorTitle')}</div>
            {pseudoColorTools.map(({ mode, icon, label }) => (
              <button key={mode} style={{ ...s.pseudoColorBtn, ...(pseudoColorMode === mode ? s.pseudoColorBtnActive : {}) }}
                onClick={() => { setPseudoColorMode(mode); if (mode !== 'none') setActiveTool('wl') }}>
                <div style={{ ...s.pseudoColorPreview, background: mode === 'none' ? '#888' : mode === 'hotIron' ? 'linear-gradient(135deg,#000 0%,#00f 25%,#0f0 50%,#ff0 75%,#fff 100%)' : mode === 'coolBlue' ? 'linear-gradient(135deg,#000 0%,#0ff 50%,#fff 100%)' : mode === 'pet' ? 'linear-gradient(135deg,#00f 0%,#0ff 20%,#0f0 40%,#ff0 60%,#f00 80%,#f0f 100%)' : 'linear-gradient(135deg,#000 0%,#88cc88 100%)' }} />
                {icon}<span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                {pseudoColorMode === mode && <CheckCircle size={12} />}
              </button>
            ))}
            <button style={{ ...s.reportBtn, background: 'var(--bg-primary)', color: 'var(--text-muted)', marginTop: 'var(--space-1, 4px)' }} onClick={closePseudoColor}>{t('dcmView.closeEsc')}</button>
          </div>
        )}

        {/* [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 灰阶校准设置面板 */}
        {showGsofPanel && (
          <div ref={gsofPanelRef} role="dialog" aria-modal="true" aria-label={t('dcmView.gsofSettingsAria')} style={s.gsofPanel} onClick={e => e.stopPropagation()} data-testid="gsof-panel">
            <div style={s.gsofPanelTitle}><Gauge size={14} color={PRIMARY} />{t('dcmView.gsofTitle')}</div>
            <button
              style={{ ...s.reportBtn, width: '100%', background: gsofEnabled ? PRIMARY : 'var(--border-color)', color: gsofEnabled ? '#fff' : 'var(--text-secondary)', marginBottom: 'var(--space-2, 8px)' }}
              onClick={() => setGsofEnabled(!gsofEnabled)}
              aria-pressed={gsofEnabled}
              data-testid="gsof-enable-toggle"
            >
              <MonitorCheck size={14} />{gsofEnabled ? t('dcmView.gsofEnabled') : t('dcmView.gsofEnable')}
            </button>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{t('dcmView.contrastLevel')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-1, 4px)' }} role="group" aria-label={t('dcmView.contrastLevelAria')}>
              {(Object.keys(GSOF_MODE_LABELS) as GsofMode[]).map(mode => (
                <button
                  key={mode}
                  style={{
                    padding: '4px 6px', borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer',
                    border: gsofMode === mode ? '1px solid var(--color-primary-800)' : '1px solid var(--border-color)',
                    background: gsofMode === mode ? PRIMARY : 'var(--bg-card)',
                    color: gsofMode === mode ? '#fff' : 'var(--text-secondary)',
                    transition: 'all 0.15s',
                  }}
                  onClick={() => setGsofMode(mode)}
                  data-testid={`gsof-mode-${mode}`}
                >
                  {GSOF_MODE_LABELS[mode]}
                </button>
              ))}
            </div>
            <div style={s.gsofDoc}>{GSOF_DOC_TEXT}</div>
            <button style={{ ...s.reportBtn, background: 'var(--bg-primary)', color: 'var(--text-muted)', marginTop: 'var(--space-2, 8px)', width: '100%' }} onClick={() => setShowGsofPanel(false)}>{t('dcmView.closeEsc')}</button>
          </div>
        )}
      </div>

      <div style={s.seriesStrip}>
        {seriesList.map((sItem, idx) => (
          <div key={sItem.id} role="button" tabIndex={0}
            aria-label={`${sItem.seriesDescription} (${t('w9d.viewport.imageCountUnit', { count: sItem.imageCount })})`}
            style={{ ...s.seriesThumb, ...(activeSeriesIdx === idx ? s.seriesThumbActive : {}) }}
            onClick={() => handleSeriesSelect(idx)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSeriesSelect(idx) } }}
            title={`${sItem.seriesDescription} (${t('w9d.viewport.imageCountUnit', { count: sItem.imageCount })})`}>
            <div style={{ ...s.seriesThumbInner, background: sItem.thumbnail, opacity: activeSeriesIdx === idx ? 1 : 0.7 }}><Layers size={16} /></div>
            <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sItem.seriesNumber}</span>
            <span style={{ fontSize: 10, color: '#6b7280' }}>{t('dcmView.framesUnit', { count: sItem.imageCount })}</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{exam.modality} · {exam.bodyPart}</span>
          <button style={{ ...s.layoutBtn, background: PRIMARY, borderColor: PRIMARY }} onClick={() => setImageIndex(i => Math.max(0, i - 1))}><ChevronLeft size={14} color="#fff" /></button>
          <button style={{ ...s.layoutBtn, background: PRIMARY, borderColor: PRIMARY }} onClick={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}><ChevronRight size={14} color="#fff" /></button>
        </div>
      </div>
    </div>
  )
}
