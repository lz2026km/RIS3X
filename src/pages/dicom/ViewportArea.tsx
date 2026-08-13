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
  roiToolbar: { display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap' as const },
  roiToolBtn: { padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' },
  roiToolBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  roiToolDivider: { width: 1, height: 24, background: '#e2e8f0', margin: '0 4px' },
  roiLabel: { fontSize: 12, color: '#64748b', fontWeight: 600, marginRight: 4, whiteSpace: 'nowrap' as const },
  exportBtn: { padding: '6px 12px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  topToolbar: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', flexShrink: 0, flexWrap: 'wrap' as const },
  topToolbarSection: { display: 'flex', alignItems: 'center', gap: 4, paddingRight: 8, borderRight: '1px solid #e2e8f0' },
  topToolbarSectionLast: { display: 'flex', alignItems: 'center', gap: 4 },
  label: { fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' as const },
  select: { padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', fontSize: 12, color: PRIMARY, fontWeight: 600, cursor: 'pointer', outline: 'none' },
  slider: { width: 80, accentColor: PRIMARY } as React.CSSProperties,
  sliderVal: { fontSize: 12, color: PRIMARY, fontWeight: 600 },
  imgCounter: { fontSize: 13, fontWeight: 700, color: '#1e293b' },
  toolBtn: { background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  layoutBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' } as React.CSSProperties,
  layoutBtnActive: { background: PRIMARY, borderColor: PRIMARY },
  presetBtn: { padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s' } as React.CSSProperties,
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
  compareToolbarBtn: { padding: '4px 10px', borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, transition: 'all 0.15s' },
  compareToolbarBtnActive: { background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' },
  fullscreenBtn: { width: 28, height: 28, borderRadius: 6, border: '1px solid #cbd5e1', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' } as React.CSSProperties,
  mipCanvasContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative' as const, overflow: 'hidden' },
  vrCanvasContainer: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#111', position: 'relative' as const, overflow: 'hidden' },
  diffRegion: { position: 'absolute' as const, border: '2px dashed #ef4444', background: 'rgba(239,68,68,0.15)', borderRadius: 4 },
  diffRegionNew: { border: '2px dashed #22c55e', background: 'rgba(34,197,94,0.15)' },
  diffRegionImproved: { border: '2px dashed #3b82f6', background: 'rgba(59,130,246,0.15)' },
  wlPopup: { position: 'absolute' as const, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', width: 240, background: CARD_BG, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.4)', zIndex: 100, padding: 14, border: '1px solid var(--border-color)' },
  wlPopupTitle: { fontSize: 13, fontWeight: 700, color: PRIMARY, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 },
  wlSliderRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  wlLabel: { fontSize: 12, color: '#64748b', flexShrink: 0, minWidth: 24 },
  wlSlider: { flex: 1, accentColor: PRIMARY } as React.CSSProperties,
  wlVal: { fontSize: 12, color: PRIMARY, fontWeight: 600, minWidth: 32, textAlign: 'right' as const },
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' } as React.CSSProperties,
  measureMenu: { position: 'absolute' as const, left: 60, top: 300, width: 160, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 6 },
  measureMenuItem: { width: '100%', padding: '6px 10px', borderRadius: 6, border: 'none', background: 'transparent', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' } as React.CSSProperties,
  pseudoColorPanel: { position: 'absolute' as const, left: 60, top: 320, width: 180, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 10 },
  pseudoColorPanelTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
  pseudoColorBtn: { width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#475569', transition: 'all 0.15s', marginBottom: 4 },
  pseudoColorBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  pseudoColorPreview: { width: 24, height: 24, borderRadius: 4, border: '1px solid rgba(0,0,0,0.1)', flexShrink: 0 },
  gsofPanel: { position: 'absolute' as const, left: 60, top: 260, width: 240, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 12 },
  gsofPanelTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 },
  gsofDoc: { fontSize: 11, color: '#64748b', lineHeight: 1.6, marginTop: 8, padding: '8px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' },
  annotationPanel: { position: 'absolute' as const, left: 60, top: 200, width: 200, background: CARD_BG, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', border: '1px solid var(--border-color)', zIndex: 100, padding: 10 },
  annotationPanelTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  annotationTypeRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, marginBottom: 8 },
  annotationTypeBtn: { height: 36, borderRadius: 6, border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 2, padding: 4 },
  annotationTypeBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  annotationTypeBtnLabel: { fontSize: 8, color: '#64748b', textAlign: 'center' as const },
  annotationColorPicker: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4, marginBottom: 8 },
  annotationColorBtn: { width: 24, height: 24, borderRadius: 4, border: '2px solid transparent', cursor: 'pointer', transition: 'all 0.15s' },
  annotationColorBtnActive: { border: '2px solid #1e40af', transform: 'scale(1.1)' },
  annotationFontSizeRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 },
  annotationFontSizeLabel: { fontSize: 12, color: '#64748b', flexShrink: 0 },
  annotationFontSizeInput: { flex: 1, padding: '4px 6px', borderRadius: 4, border: '1px solid #cbd5e1', fontSize: 12, outline: 'none', width: 50 },
  annotationListItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: '#f8fafc', borderRadius: 6, marginBottom: 4, border: '1px solid #e2e8f0', cursor: 'pointer', transition: 'all 0.15s' },
  annotationListItemSelected: { border: '2px solid #3b82f6', background: '#eff6ff' },
  annotationListItemLocked: { opacity: 0.7 },
  annotationListItemActions: { display: 'flex', gap: 4, marginLeft: 'auto' },
  annotationActionBtn: { width: 22, height: 22, borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, transition: 'all 0.15s' } as React.CSSProperties,
  seriesStrip: { display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: '#1e293b', borderTop: '1px solid #334155', flexShrink: 0, overflowX: 'auto' as const },
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
        <span style={s.roiLabel}>ROI工具:</span>
        {(['length', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue'] as const).map(type => (
          <button key={type} style={{ ...s.roiToolBtn, ...(measureSubMenu === type ? s.roiToolBtnActive : {}) }}
            onClick={() => { setMeasureSubMenu(type); setActiveTool('measure') }} title={type}>
            {type === 'length' ? '长度' : type === 'angle' ? '角度' : type === 'ellipse' ? '椭圆' : type === 'rectangle' ? '矩形' : type === 'circle' ? '圆形' : 'CT值'}
          </button>
        ))}
        <div style={s.roiToolDivider} />
        <button style={{ ...s.roiToolBtn, color: '#ef4444' }} onClick={clearAllMeasures}>清空</button>
        <button style={s.exportBtn} onClick={() => exportMeasurements('clipboard')}>导出报告</button>
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
          <button style={{ ...s.toolBtn, color: PRIMARY, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 6 }} onClick={() => setImageIndex(i => Math.max(0, i - 1))}><ChevronLeft size={14} /></button>
          <button style={{ ...s.toolBtn, color: PRIMARY, padding: '4px 6px', border: '1px solid #cbd5e1', borderRadius: 6 }} onClick={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}><ChevronRight size={14} /></button>
        </div>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.layoutLabel')}</span>
          {(['1x1', '2x2', '1x2', '2x1'] as LayoutMode[]).map(l => (
            <button key={l} style={{ ...s.layoutBtn, ...(layout === l ? s.layoutBtnActive : {}) }} onClick={() => handleLayoutChange(l)}><Grid3x3 size={14} color={layout === l ? '#fff' : '#64748b'} /></button>
          ))}
        </div>
        <div style={s.topToolbarSection}>
          <span style={s.label}>{t('dcm.modeLabel')}</span>
          {(['MPR', 'MIP', 'VR'] as ViewMode[]).map(vm => (
            <button key={vm} style={{ ...s.presetBtn, ...(viewMode === vm ? s.presetBtnActive : {}), padding: '4px 8px' }} onClick={() => setViewMode(vm)}>{vm}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8 }}>
          <button style={{ ...s.compareToolbarBtn, ...(selectedHistoryExams.length > 0 ? s.compareToolbarBtnActive : {}) }} onClick={enterCompareMode}><History size={14} />{t('dcm.historyTab')}</button>
        </div>
        <button style={{ ...s.layoutBtn, ...(showGrid ? s.layoutBtnActive : {}), marginLeft: 8 }} onClick={() => setShowGrid(g => !g)}><Grid3x3 size={14} color={showGrid ? '#fff' : '#64748b'} /></button>
        {/* [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 校准开关 */}
        <button
          style={{
            width: 28, height: 28, borderRadius: 6, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: gsofEnabled || showGsofPanel ? '1px solid #1e40af' : '1px solid #cbd5e1',
            background: gsofEnabled || showGsofPanel ? PRIMARY : '#fff',
            transition: 'all 0.15s',
          }}
          onClick={() => setShowGsofPanel(!showGsofPanel)}
          title={`GSOF 灰阶校准${gsofEnabled ? ' (已启用)' : ''}`}
          data-testid="gsof-toggle"
          aria-pressed={gsofEnabled}
        >
          <MonitorCheck size={14} color={gsofEnabled || showGsofPanel ? '#fff' : '#64748b'} />
        </button>
        <button style={s.fullscreenBtn} onClick={toggleFullscreen}>{isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}</button>
      </div>

      <div id="image-main-area" style={isCompareMode ? { ...s.imageMain, display: 'flex' } : s.imageMain}
        onClick={() => { if (activeTool === 'wl') setShowWlPopup(false); if (activeTool === 'measure') setMeasureSubMenu(null) }}>
        {isCompareMode ? (
          <div style={s.compareSplitContainer}>
            <div style={s.compareSplitPane}>
              <span style={s.compareLabel}>当前: {exam.examDate}</span>
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
              <span style={{ ...s.compareLabel, ...s.compareLabelRight }}>历史: {compareExam?.examDate}</span>
              <div style={{ ...s.imageWrapper, width: '100%', height: '100%' }}>
                <DicomCanvas zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV} ww={ww} wl={wl} brightness={brightness} contrast={contrast} invert={invert}
                  activeTool={activeTool} panX={panX} panY={panY}
                  activeSeries={activeSeries} pseudoColorMode={pseudoColorMode} gsofEnabled={gsofEnabled} gsofMode={gsofMode} />
                {showDiffHighlight && diffRegions.map(region => (
                  <div key={`r-${region.id}`} style={{ ...s.diffRegion, ...(region.type === 'increase' ? {} : region.type === 'new' ? s.diffRegionNew : s.diffRegionImproved), left: region.x, top: region.y, width: region.w, height: region.h }} />
                ))}
              </div>
              <div style={s.overlayBL}><span style={{ color: '#60a5fa' }}>WW:{ww} WL:{wl}</span><span style={{ color: '#86efac' }}>Img:{syncScroll ? imageIndex + 1 : compareImageIndex + 1}/{images.length}</span></div>
              <div style={s.overlayBR}><span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>{!syncScroll && <span style={{ color: '#fbbf24' }}>独立滚动</span>}</div>
            </div>
          </div>
        ) : (
          <div style={{ ...s.imageWrapper, width: gridConfig.cols === 2 ? 'calc(50% - 4px)' : '100%', height: gridConfig.rows === 2 ? 'calc(50% - 4px)' : '100%' }}>
            {viewMode === 'MPR' && <DicomCanvas zoom={zoom} rotation={rotation} flipH={flipH} flipV={flipV} ww={ww} wl={wl} brightness={brightness} contrast={contrast} invert={invert}
              activeTool={activeTool} panX={panX} panY={panY}
              activeSeries={activeSeries} pseudoColorMode={pseudoColorMode} gsofEnabled={gsofEnabled} gsofMode={gsofMode} />}
            {viewMode === 'MIP' && <div style={s.mipCanvasContainer}><MIPCanvas mipDirection={mipDirection} mipFrame={mipFrame} ww={ww} wl={wl} gsofEnabled={gsofEnabled} gsofMode={gsofMode} /></div>}
            {viewMode === 'VR' && <div style={s.vrCanvasContainer}><VRCanvas rotX={vrRotX} rotY={vrRotY} rotZ={vrRotZ} opacity={vrOpacity} /></div>}

            <div style={s.overlayTL}>
              <span style={{ color: '#60a5fa', fontWeight: 700 }}>{exam.patientName}</span>
              <span style={{ color: '#94a3b8' }}>#{exam.accessionNumber}</span>
              <span style={{ color: '#86efac' }}>{exam.examItemName}</span>
              {viewMode !== 'MPR' && <span style={{ color: '#fbbf24' }}>{viewMode}模式</span>}
            </div>
            <div style={s.overlayTR}>
              <span style={{ color: '#fbbf24' }}>{exam.deviceName?.split('（')[0]}</span>
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
                  <button key={p.name} onClick={() => handlePresetClick(p, i)}
                    style={{ padding: '2px 6px', borderRadius: 4, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{p.name}</button>
                ))}
              </div>
              <span style={{ color: '#86efac', fontSize: 12 }}>滚轮调整WW/WL</span>
            </div>
            <div style={s.overlayBR}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#60a5fa', fontSize: 12 }}>WW</span>
                <input type="range" min={50} max={4000} value={ww} onChange={e => { setWw(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 80, accentColor: '#60a5fa' }} />
                <input type="number" value={Math.round(ww)} onChange={e => { setWw(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#60a5fa' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                <span style={{ color: '#f87171', fontSize: 12 }}>WL</span>
                <input type="range" min={-1000} max={1000} value={wl} onChange={e => { setWl(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 80, accentColor: '#f87171' }} />
                <input type="number" value={Math.round(wl)} onChange={e => { setWl(Number(e.target.value)); setActivePresetIdx(null) }} style={{ width: 50, fontSize: 12, padding: '1px 3px', borderRadius: 3, border: '1px solid #444', background: '#222', color: '#f87171' }} />
              </div>
              <span style={{ color: '#f87171' }}>Zoom:{zoom}% Rot:{rotation}°</span>
              <span style={{ color: '#a5f3fc' }}>{flipH ? 'FH ' : ''}{flipV ? 'FV ' : ''}{invert ? 'Invert ' : ''}Bright:{brightness}% Contrast:{contrast}%</span>
              {measureSubMenu && <span style={{ color: '#fbbf24' }}>测量模式:{measureSubMenu === 'length' ? '长度' : measureSubMenu === 'angle' ? '角度' : 'CT值'}</span>}
              {pseudoColorMode !== 'none' && <span style={{ color: '#f97316' }}>伪彩:{pseudoColorMode === 'hotIron' ? '热铁' : pseudoColorMode === 'coolBlue' ? '冷蓝' : pseudoColorMode === 'pet' ? 'PET' : '软组织'}</span>}
              {gsofEnabled && <span style={{ color: '#22d3ee' }}>GSOF: {GSOF_MODE_LABELS[gsofMode] ?? '标准'} (PS3.14)</span>}
            </div>

            {showMeasurementsOverlay && (measureSubMenu || isDrawingMeasure || interactiveMeasures.length > 0) && (
              <svg style={s.annotationSvg}>
                {interactiveMeasures.map(measure => {
                  if (measure.points.length < 1) return null
                  const points = measure.points; const color = (measure as any).color || '#22c55e'
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
                  return null
                })}
                {isDrawingMeasure && drawingPoints.map((point, idx) => (<circle key={`draw-${idx}`} cx={point.x} cy={point.y} r={5} fill="#22c55e" stroke="#fff" strokeWidth={2} />))}
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
            <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }} role="group" aria-label="窗位预设">
              {currentPresets.map((p, i) => (
                <button key={p.name} style={{ ...s.presetBtn, fontSize: 12, padding: '3px 6px', ...(activePresetIdx === i ? s.presetBtnActive : {}) }} onClick={() => handlePresetClick(p, i)} title={`WW:${p.ww} WL:${p.wl}`}>{p.name}</button>
              ))}
            </div>
            <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff', flex: 1 }} onClick={() => { setWw(CT_DEFAULT_WW); setWl(CT_DEFAULT_WL); setActivePresetIdx(null) }}>重置</button>
              <button style={{ ...s.reportBtn, background: 'var(--border-color)', color: '#475569', flex: 1 }} onClick={closeWlPopup}>关闭 (Esc)</button>
            </div>
          </div>
        )}

        {activeTool === 'measure' && measureSubMenu !== null && (
          <div ref={measureMenuRef} role="dialog" aria-modal="true" aria-label="测量工具" style={s.measureMenu} onClick={e => e.stopPropagation()}>
            {(['length', 'angle', 'ellipse', 'rectangle', 'circle', 'ctvalue'] as MeasureSubMenu[]).map(type => (
              <button key={type} style={{ ...s.measureMenuItem, ...(measureSubMenu === type ? { background: `${PRIMARY}15`, color: PRIMARY } : {}) }} onClick={() => setMeasureSubMenu(type)}>
                {type === 'length' ? '长度测量' : type === 'angle' ? '角度测量' : type === 'ellipse' ? '椭圆ROI' : type === 'rectangle' ? '矩形ROI' : type === 'circle' ? '圆ROI' : 'CT值(HU)'}
              </button>
            ))}
            <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 4, paddingTop: 4 }}>
              <button style={{ ...s.measureMenuItem, color: '#ef4444' }} onClick={clearAllMeasures}>清除测量</button>
            </div>
            <button style={{ ...s.measureMenuItem, color: '#64748b', justifyContent: 'center' }} onClick={closeMeasureMenu}>关闭 (Esc)</button>
          </div>
        )}

        {showPseudoColorPanel && (
          <div ref={pseudoColorPanelRef} role="dialog" aria-modal="true" aria-label="伪彩显示" style={s.pseudoColorPanel} onClick={e => e.stopPropagation()}>
            <div style={s.pseudoColorPanelTitle}><Palette size={14} color={PRIMARY} />伪彩显示</div>
            {pseudoColorTools.map(({ mode, icon, label }) => (
              <button key={mode} style={{ ...s.pseudoColorBtn, ...(pseudoColorMode === mode ? s.pseudoColorBtnActive : {}) }}
                onClick={() => { setPseudoColorMode(mode); if (mode !== 'none') setActiveTool('wl') }}>
                <div style={{ ...s.pseudoColorPreview, background: mode === 'none' ? '#888' : mode === 'hotIron' ? 'linear-gradient(135deg,#000 0%,#00f 25%,#0f0 50%,#ff0 75%,#fff 100%)' : mode === 'coolBlue' ? 'linear-gradient(135deg,#000 0%,#0ff 50%,#fff 100%)' : mode === 'pet' ? 'linear-gradient(135deg,#00f 0%,#0ff 20%,#0f0 40%,#ff0 60%,#f00 80%,#f0f 100%)' : 'linear-gradient(135deg,#000 0%,#88cc88 100%)' }} />
                {icon}<span style={{ flex: 1, textAlign: 'left' }}>{label}</span>
                {pseudoColorMode === mode && <CheckCircle size={12} />}
              </button>
            ))}
            <button style={{ ...s.reportBtn, background: 'var(--bg-primary)', color: '#64748b', marginTop: 4 }} onClick={closePseudoColor}>关闭 (Esc)</button>
          </div>
        )}

        {/* [G005 v3.0.6.11-91 Wave 4A (PACS P0-3)] GSOF 灰阶校准设置面板 */}
        {showGsofPanel && (
          <div ref={gsofPanelRef} role="dialog" aria-modal="true" aria-label="GSOF 校准设置" style={s.gsofPanel} onClick={e => e.stopPropagation()} data-testid="gsof-panel">
            <div style={s.gsofPanelTitle}><Gauge size={14} color={PRIMARY} />GSOF 灰阶校准</div>
            <button
              style={{ ...s.reportBtn, width: '100%', background: gsofEnabled ? PRIMARY : 'var(--border-color)', color: gsofEnabled ? '#fff' : '#475569', marginBottom: 8 }}
              onClick={() => setGsofEnabled(!gsofEnabled)}
              aria-pressed={gsofEnabled}
              data-testid="gsof-enable-toggle"
            >
              <MonitorCheck size={14} />{gsofEnabled ? 'GSOF 校准已启用' : '启用 GSOF 校准'}
            </button>
            <div style={{ fontSize: 12, color: '#64748b', fontWeight: 600, marginBottom: 6 }}>对比度档位</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }} role="group" aria-label="GSOF 对比度档位">
              {(Object.keys(GSOF_MODE_LABELS) as GsofMode[]).map(mode => (
                <button
                  key={mode}
                  style={{
                    padding: '4px 6px', borderRadius: 6, fontSize: 12, fontWeight: 600, textAlign: 'center', cursor: 'pointer',
                    border: gsofMode === mode ? '1px solid #1e40af' : '1px solid #cbd5e1',
                    background: gsofMode === mode ? PRIMARY : 'var(--bg-card)',
                    color: gsofMode === mode ? '#fff' : '#475569',
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
            <button style={{ ...s.reportBtn, background: 'var(--bg-primary)', color: '#64748b', marginTop: 8, width: '100%' }} onClick={() => setShowGsofPanel(false)}>关闭 (Esc)</button>
          </div>
        )}
      </div>

      <div style={s.seriesStrip}>
        {seriesList.map((sItem, idx) => (
          <div key={sItem.id} style={{ ...s.seriesThumb, ...(activeSeriesIdx === idx ? s.seriesThumbActive : {}) }}
            onClick={() => handleSeriesSelect(idx)} title={`${sItem.seriesDescription} (${sItem.imageCount}幅)`}>
            <div style={{ ...s.seriesThumbInner, background: sItem.thumbnail, opacity: activeSeriesIdx === idx ? 1 : 0.7 }}><Layers size={16} /></div>
            <span style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{sItem.seriesNumber}</span>
            <span style={{ fontSize: 8, color: '#6b7280' }}>{sItem.imageCount}幅</span>
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: '#6b7280' }}>{exam.modality} · {exam.bodyPart}</span>
          <button style={{ ...s.layoutBtn, background: PRIMARY, borderColor: PRIMARY }} onClick={() => setImageIndex(i => Math.max(0, i - 1))}><ChevronLeft size={14} color="#fff" /></button>
          <button style={{ ...s.layoutBtn, background: PRIMARY, borderColor: PRIMARY }} onClick={() => setImageIndex(i => Math.min(images.length - 1, i + 1))}><ChevronRight size={14} color="#fff" /></button>
        </div>
      </div>
    </div>
  )
}
