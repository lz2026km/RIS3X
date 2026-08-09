import { t } from '../../i18n/appI18n'
import { examApi } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import type { Dispatch, SetStateAction } from 'react'
import { User, Image as ImageIcon, Ruler as RulerIcon, FileSearch, History, GitCompare, FileText, AlertCircle, Activity, Info, Layers3, Box, RefreshCw, Calendar, CheckCircle, Clock, PenTool, Eye, X, Upload, Camera, Download, AlertTriangle, ScrollText, ArrowLeftRight } from 'lucide-react'
import MeasurementPanel from './MeasurementPanel'
import { Card } from 'antd'
import type { Series, DicomImage, MeasureSubMenu, Measurement, RightTab, Tool, CompareLayout } from './DicomViewerTypes'
import { PRIMARY } from './DicomViewerTypes'

const s = {
  rightPanel: { width: 280, background: 'var(--content-bg)', borderLeft: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0 },
  rightTabs: { display: 'flex', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  rightTab: { flex: 1, padding: '6px 4px', border: 'none', background: 'transparent', color: '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, transition: 'all 0.15s', borderBottom: '2px solid transparent' } as React.CSSProperties,
  rightTabActive: { color: PRIMARY, borderBottomColor: PRIMARY, background: 'rgba(30,58,95,0.05)' },
  rightPanelContent: { flex: 1, overflow: 'auto', padding: 10 },
  infoSection: { marginBottom: 12 },
  infoSectionTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  infoItem: { display: 'flex', flexDirection: 'column' as const, gap: 1 },
  infoLabel: { fontSize: 12, color: '#94a3b8' },
  infoValue: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },
  infoValueFull: { fontSize: 12, color: '#475569', lineHeight: 1.5, marginTop: 2 },
  reportStatusCard: { padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 8 },
  reportStatusBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700 },
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' } as React.CSSProperties,
  select: { padding: '4px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, color: PRIMARY, fontWeight: 600, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' } as React.CSSProperties,
  mprTabs: { display: 'flex', gap: 4, marginBottom: 4 },
  mprTab: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'var(--bg-card)', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s' } as React.CSSProperties,
  mprTabActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  mipControlPanel: { background: 'var(--content-bg)', borderRadius: 8, padding: 8, border: '1px solid #e2e8f0' },
  mipControlTitle: { fontSize: 12, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 },
  mipDirRow: { display: 'flex', gap: 4, marginBottom: 8 },
  mipDirBtn: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'var(--bg-card)', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const },
  mipDirBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  mipFrameRow: { display: 'flex', alignItems: 'center', gap: 6 },
  mipFrameLabel: { fontSize: 12, color: '#64748b', flexShrink: 0 },
  mipFrameVal: { fontSize: 12, color: PRIMARY, fontWeight: 600, minWidth: 50 },
  vrControlPanel: { background: 'var(--content-bg)', borderRadius: 8, padding: 8, border: '1px solid #e2e8f0' },
  vrSliderRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  vrSliderLabel: { fontSize: 12, color: '#64748b', flexShrink: 0, minWidth: 24 },
  vrSlider: { flex: 1, accentColor: PRIMARY } as React.CSSProperties,
  vrSliderVal: { fontSize: 12, color: PRIMARY, fontWeight: 600, minWidth: 30, textAlign: 'right' as const },
  vrResetBtn: { width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'var(--bg-card)', color: '#475569', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' } as React.CSSProperties,
  historySearchRow: { display: 'flex', gap: 6, marginBottom: 10 },
  historySearchInput: { flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, outline: 'none', fontFamily: 'inherit' },
  historySearchBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  historyListItem: { display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', background: 'var(--bg-card)', marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s' },
  historyListItemSelected: { border: '2px solid #3b82f6', background: '#eff6ff' },
  historyListItemChecked: { border: '2px solid #22c55e', background: '#f0fdf4' },
  historyCheckbox: { width: 16, height: 16, borderRadius: 4, border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer' },
  historyCheckboxChecked: { background: '#22c55e', borderColor: '#22c55e' },
  historyListItemContent: { flex: 1, minWidth: 0 },
  historyListItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  historyListItemTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  historyListItemDate: { fontSize: 12, color: '#94a3b8' },
  historyListItemMeta: { fontSize: 12, color: '#64748b', lineHeight: 1.4 },
  historyListItemStatus: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, marginTop: 4 },
  historyListEmpty: { textAlign: 'center' as const, padding: '24px 12px', color: '#94a3b8', fontSize: 12 },
  historyListEmptyIcon: { marginBottom: 8, opacity: 0.5 },
  historyActionBar: { display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const },
  historyActionBtn: { flex: 1, minWidth: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'var(--bg-card)', fontSize: 12, fontWeight: 600, color: '#475569', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'all 0.15s' } as React.CSSProperties,
  historyActionBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  syncScrollBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 } as React.CSSProperties,
  syncScrollBadgeOn: { background: '#dcfce7', color: '#16a34a' },
  syncScrollBadgeOff: { background: 'var(--content-bg)', color: '#64748b' },
  compareInfoCard: { background: 'var(--bg-card)', borderRadius: 8, border: '1px solid #e2e8f0', padding: 10, marginBottom: 8 },
  compareInfoCardTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 },
  compareInfoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid #f1f5f9' },
  compareInfoLabel: { fontSize: 12, color: '#64748b' },
  compareInfoValue: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },
  compareControlBadge: { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: 'none' } as React.CSSProperties,
  compareControlBadgeOn: { background: PRIMARY, color: '#fff' },
  compareControlBadgeOff: { background: '#e2e8f0', color: '#64748b' },
  diffSummaryCard: { background: '#fefce8', border: '1px solid #fef08a', borderRadius: 8, padding: 10, marginBottom: 8 },
  diffSummaryTitle: { fontSize: 12, fontWeight: 700, color: '#a16207', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 4 },
  diffSummaryItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12, color: '#713f12' },
  diffSummaryDot: { width: 6, height: 6, borderRadius: '50%', flexShrink: 0 },
}

interface Props {
  exam: any
  rightTab: RightTab
  setRightTab: Dispatch<SetStateAction<RightTab>>
  activeSeries: Series
  currentImage: DicomImage
  ww: number
  wl: number
  zoom: number
  rotation: number
  flipH: boolean
  flipV: boolean
  brightness: number
  contrast: number
  invert: boolean
  viewMode: string
  mipDirection: string
  setMipDirection: (d: any) => void
  mipFrame: number
  setMipFrame: (v: number) => void
  images: DicomImage[]
  vrRotX: number
  setVrRotX: (v: number) => void
  vrRotY: number
  setVrRotY: (v: number) => void
  vrRotZ: number
  setVrRotZ: (v: number) => void
  vrOpacity: number
  setVrOpacity: (v: number) => void
  showToast: (msg: string) => void
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
  reportStatus: string
  selectedHistoryExams: string[]
  setSelectedHistoryExams: (ids: string[]) => void
  filteredHistoryExams: any[]
  historySearchText: string
  setHistorySearchText: (t: string) => void
  toggleHistoryExam: (id: string) => void
  enterCompareMode: () => void
  isCompareMode: boolean
  compareExam: any
  syncScroll: boolean
  setSyncScroll: (v: boolean) => void
  showDiffHighlight: boolean
  setShowDiffHighlight: (v: boolean) => void
  exitCompareMode: () => void
  getCompareDiffInfo: () => any[] | null
  externalInstitution: string
  setExternalInstitution: (v: string) => void
  externalSearchType: 'patientId' | 'patientName'
  setExternalSearchType: Dispatch<SetStateAction<'patientId' | 'patientName'>>
  externalSearchText: string
  setExternalSearchText: (v: string) => void
  externalSearchResults: any[]
  selectedExternalExam: any
  setSelectedExternalExam: (v: any) => void
  handleExternalSearch: () => void
  handleArchiveRequest: () => void
  isExternalCompareMode: boolean
  setIsExternalCompareMode: (v: boolean) => void
  archiveRequestStatus: string | null
  externalCompareLayout: CompareLayout
  setExternalCompareLayout: Dispatch<SetStateAction<CompareLayout>>
  activeMprIdx: number
  setActiveMprIdx: (v: number) => void
  EXTERNAL_INSTITUTIONS: any[]
}

export default function SidebarPanel(props: Props) {
  const { exam, rightTab, setRightTab, activeSeries, currentImage, ww, wl,
    mipDirection, setMipDirection, mipFrame, setMipFrame, images, vrRotX, setVrRotX, vrRotY, setVrRotY, vrRotZ, setVrRotZ,
    vrOpacity, setVrOpacity, showToast, measureSubMenu, setMeasureSubMenu, setActiveTool, interactiveMeasures, showMeasurementsOverlay,
    setShowMeasurementsOverlay, deleteMeasure, clearAllMeasures, getMeasureTypeLabel, measurements, reportStatus, selectedHistoryExams,
    setSelectedHistoryExams, filteredHistoryExams, historySearchText, setHistorySearchText, toggleHistoryExam, enterCompareMode,
    isCompareMode, compareExam, syncScroll, setSyncScroll, showDiffHighlight, setShowDiffHighlight, exitCompareMode, getCompareDiffInfo,
    externalInstitution, setExternalInstitution, externalSearchType, setExternalSearchType, externalSearchText, setExternalSearchText,
    externalSearchResults, selectedExternalExam, setSelectedExternalExam, handleExternalSearch, handleArchiveRequest,
    isExternalCompareMode, setIsExternalCompareMode, archiveRequestStatus, externalCompareLayout, setExternalCompareLayout,
    activeMprIdx, setActiveMprIdx, EXTERNAL_INSTITUTIONS } = props

  const navigate = useNavigate()

  // 跳转报告书写页（携带 examId）
  const goWriteReport = (mode?: string) => {
    const params = new URLSearchParams()
    if (exam.id) params.set('examId', exam.id)
    if (mode) params.set('mode', mode)
    navigate(`/write-report?${params.toString()}`)
  }

  return (
    <div style={s.rightPanel}>
      <div style={s.rightTabs}>
        {(['patient', 'image', 'measure', 'report', 'history', 'external'] as const).map(tab => (
          <button key={tab} style={{ ...s.rightTab, ...(rightTab === tab ? s.rightTabActive : {}) }} onClick={() => setRightTab(tab)}>
            {tab === 'patient' && <><User size={14} />{t('qcimage.patient')}</>}
            {tab === 'image' && <><ImageIcon size={14} />{t('dcm.imageTab')}</>}
            {tab === 'measure' && <><RulerIcon size={14} />{t('dcmtool.measure')}</>}
            {tab === 'report' && <><FileSearch size={14} />{t('dcm.reportTab')}</>}
            {tab === 'history' && <><History size={14} />{t('dcm.historyTab')}</>}
            {tab === 'external' && <><GitCompare size={14} />{t('dcm.externalTab')}</>}
          </button>
        ))}
      </div>

      <div style={s.rightPanelContent}>
        {rightTab === 'patient' && (
          <>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><User size={12} />{t('dcm.basicInfo')}</div>
              <div style={s.infoGrid}>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.name')}</span><span style={s.infoValue}>{exam.patientName}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.genderAge')}</span><span style={s.infoValue}>{exam.gender}/{exam.age}岁</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.patientType')}</span><span style={s.infoValue}>{exam.patientType}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('qcimage.examId')}</span><span style={s.infoValue}>{exam.accessionNumber}</span></div>
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><FileText size={12} />{t('dcm.examInfo')}</div>
              <div style={s.infoGrid}>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examItem')}</span><span style={s.infoValue}>{exam.examItemName}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examDate')}</span><span style={s.infoValue}>{exam.examDate}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examTime')}</span><span style={s.infoValue}>{exam.examTime}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examDevice')}</span><span style={s.infoValue}>{exam.deviceName?.split('（')[0]}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examRoom')}</span><span style={s.infoValue}>{exam.roomName}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examStatus')}</span><span style={{ ...s.infoValue, color: exam.status === '已完成' ? '#22c55e' : exam.status === '检查中' ? '#f59e0b' : '#64748b' }}>{exam.status}</span></div>
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><AlertCircle size={12} />{t('dcm.clinicalInfo')}</div>
              <div style={{ marginBottom: 8 }}><span style={s.infoLabel}>{t('dcm.clinicalDiagnosis')}</span><div style={{ ...s.infoValueFull, color: '#dc2626' }}>{exam.clinicalDiagnosis}</div></div>
              <div style={{ marginBottom: 8 }}><span style={s.infoLabel}>病史</span><div style={s.infoValueFull}>{exam.clinicalHistory}</div></div>
              <div style={{ marginBottom: 8 }}><span style={s.infoLabel}>{t('dcm.examIndications')}</span><div style={s.infoValueFull}>{exam.examIndications}</div></div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Layers3 size={12} />{t('dcm.mpr')}</div>
              <div style={s.mprTabs}>{['横断面', '冠状面', '矢状面'].map((tab, i) => (<button key={tab} style={{ ...s.mprTab, ...(i === activeMprIdx ? s.mprTabActive : {}) }} onClick={() => setActiveMprIdx(i)}>{tab}</button>))}</div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Activity size={12} />{t('dcm.mip')}</div>
              <Card bordered={false} style={s.mipControlPanel} styles={{ body: { padding: 0 } }}>
                <div style={s.mipControlTitle}><span>{t('dcm.projDir')}</span></div>
                <div style={s.mipDirRow}>{(['axial', 'sagittal', 'coronal'] as const).map(dir => (<button key={dir} style={{ ...s.mipDirBtn, ...(mipDirection === dir ? s.mipDirBtnActive : {}) }} onClick={() => setMipDirection(dir)}>{dir === 'axial' ? '轴位' : dir === 'sagittal' ? '矢状' : '冠状'}</button>))}</div>
                <div style={s.mipControlTitle}><span>{t('dcm.frameSelect')}</span></div>
                <div style={s.mipFrameRow}><span style={s.mipFrameLabel}>帧:</span><input type="range" min={0} max={Math.max(0, images.length - 1)} value={mipFrame} onChange={e => setMipFrame(parseInt(e.target.value))} style={{ flex: 1, accentColor: PRIMARY }} /><span style={s.mipFrameVal}>{mipFrame + 1}/{images.length}</span></div>
              </Card>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Box size={12} />{t('dcm.vr')}</div>
              <Card bordered={false} style={s.vrControlPanel} styles={{ body: { padding: 0 } }}>
                <div style={s.vrSliderRow}><span style={s.vrSliderLabel}>{t('dcm.rotateX')}</span><input type="range" min={0} max={360} value={vrRotX} onChange={e => setVrRotX(parseInt(e.target.value))} style={s.vrSlider} /><span style={s.vrSliderVal}>{vrRotX}°</span></div>
                <div style={s.vrSliderRow}><span style={s.vrSliderLabel}>{t('dcm.rotateY')}</span><input type="range" min={0} max={360} value={vrRotY} onChange={e => setVrRotY(parseInt(e.target.value))} style={s.vrSlider} /><span style={s.vrSliderVal}>{vrRotY}°</span></div>
                <div style={s.vrSliderRow}><span style={s.vrSliderLabel}>{t('dcm.rotateZ')}</span><input type="range" min={0} max={360} value={vrRotZ} onChange={e => setVrRotZ(parseInt(e.target.value))} style={s.vrSlider} /><span style={s.vrSliderVal}>{vrRotZ}°</span></div>
                <div style={s.vrSliderRow}><span style={s.vrSliderLabel}>{t('dcm.opacity')}</span><input type="range" min={0} max={100} value={Math.round(vrOpacity * 100)} onChange={e => setVrOpacity(parseInt(e.target.value) / 100)} style={s.vrSlider} /><span style={s.vrSliderVal}>{Math.round(vrOpacity * 100)}%</span></div>
                <button style={s.vrResetBtn} onClick={() => { setVrRotX(30); setVrRotY(45); setVrRotZ(0); setVrOpacity(0.8) }}><RefreshCw size={12} />{t('dcm.resetView')}</button>
              </Card>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => showToast('PNG已导出')}><Camera size={14} />{t('dcmexp.exportPng')}</button>
              <button style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }} onClick={() => showToast('DICOM导出功能待实现')}><Download size={14} />{t('dcmexp.exportDicom')}</button>
            </div>
          </>
        )}

        {rightTab === 'image' && (
          <>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><ImageIcon size={12} />{t('dcm.seriesInfo')}</div>
              <div style={s.infoGrid}>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.seriesNumber')}</span><span style={s.infoValue}>{activeSeries.seriesNumber}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.imageNumber')}</span><span style={s.infoValue}>{currentImage?.imageNumber || 1}</span></div>
                <div style={{ ...s.infoItem, gridColumn: '1 / -1' }}><span style={s.infoLabel}>{t('dcm.seriesDesc')}</span><span style={{ ...s.infoValue, gridColumn: '1 / -1' }}>{activeSeries.seriesDescription}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.imageCount')}</span><span style={s.infoValue}>{activeSeries.imageCount}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>设备</span><span style={s.infoValue}>{activeSeries.modality}</span></div>
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Info size={12} />{t('dcm.imageParams')}</div>
              <div style={s.infoGrid}>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.sliceThickness')}</span><span style={s.infoValue}>{currentImage?.sliceThickness || 2.5}mm</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>层间距</span><span style={s.infoValue}>2.5mm</span></div>
                {currentImage?.tr && <div style={s.infoItem}><span style={s.infoLabel}>TR</span><span style={s.infoValue}>{currentImage.tr}ms</span></div>}
                {currentImage?.te && <div style={s.infoItem}><span style={s.infoLabel}>TE</span><span style={s.infoValue}>{currentImage.te}ms</span></div>}
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.matrix')}</span><span style={s.infoValue}>{currentImage?.matrix || '512×512'}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>FOV</span><span style={s.infoValue}>{currentImage?.fov || 35}cm</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.pixelSpacing')}</span><span style={s.infoValue}>{currentImage?.pixelSpacing || 0.68}mm</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.acqMatrix')}</span><span style={s.infoValue}>512×512</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.dispMatrix')}</span><span style={s.infoValue}>512×512</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.ww')}</span><span style={s.infoValue}>{ww}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.wl')}</span><span style={s.infoValue}>{wl}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.sliceLoc')}</span><span style={s.infoValue}>{currentImage?.sliceLocation?.toFixed(1) || '0.0'}mm</span></div>
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Activity size={12} />{t('dcm.deviceInfo')}</div>
              <div style={s.infoGrid}>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.deviceModel')}</span><span style={s.infoValue}>{exam.deviceName?.split('（')[1]?.replace('）', '') || 'N/A'}</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.manufacturer')}</span><span style={s.infoValue}>{exam.deviceName?.includes('GE') ? 'GE' : exam.deviceName?.includes('Siemens') ? 'Siemens' : exam.deviceName?.includes('Philips') ? 'Philips' : 'N/A'}</span></div>
                <div style={{ ...s.infoItem, gridColumn: '1 / -1' }}><span style={s.infoLabel}>{t('dcm.acqStation')}</span><span style={s.infoValue}>CT-Acq-01</span></div>
              </div>
            </div>
          </>
        )}

        {rightTab === 'measure' && (
          <MeasurementPanel
            rightTab={rightTab}
            measureSubMenu={measureSubMenu} setMeasureSubMenu={setMeasureSubMenu}
            setActiveTool={setActiveTool}
            interactiveMeasures={interactiveMeasures}
            showMeasurementsOverlay={showMeasurementsOverlay}
            setShowMeasurementsOverlay={setShowMeasurementsOverlay}
            deleteMeasure={deleteMeasure}
            clearAllMeasures={clearAllMeasures}
            getMeasureTypeLabel={getMeasureTypeLabel}
            measurements={measurements}
            showToast={showToast}
          />
        )}

        {rightTab === 'report' && (
          <>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><FileSearch size={12} />{t('dcm.reportStatus')}</div>
              <Card bordered={false} style={s.reportStatusCard} styles={{ body: { padding: 0 } }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{exam.examItemName}</span>
                  <span style={{ ...s.reportStatusBadge, background: reportStatus === '已报告' ? '#dcfce7' : reportStatus === '待书写' ? '#fef3c7' : '#f1f5f9', color: reportStatus === '已报告' ? '#16a34a' : reportStatus === '待书写' ? '#d97706' : '#64748b' }}>
                    {reportStatus === '已报告' && <CheckCircle size={10} />}{reportStatus === '待书写' && <Clock size={10} />}{reportStatus}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>患者: {exam.patientName} | {exam.age}岁{exam.gender}<br />检查日期: {exam.examDate} {exam.examTime}</div>
              </Card>
              {reportStatus === '已报告' && (
                <><div style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid #e2e8f0' }}><div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{t('dcm.reportDoctor')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>李明辉</div></div>
                <div style={{ marginBottom: 8, padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid #e2e8f0' }}><div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>报告时间</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>2026-05-01 14:30</div></div></>
              )}
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><FileText size={12} />{t('dcm.reportActions')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {exam.status !== '待报告' && exam.status !== '已报告' && (
                  <button style={{ ...s.reportBtn, background: '#059669', color: '#fff' }} onClick={async () => { await examApi.complete(exam.id); showToast('影像采集完成') }}><CheckCircle size={14} />{t('dcm.completeAcquisition')}</button>
                )}
                {reportStatus === '已报告' ? (
                  <><button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => goWriteReport()}><Eye size={14} />{t('dcm.viewReport')}</button>
                  <button style={{ ...s.reportBtn, background: '#f0f4f8', color: PRIMARY }} onClick={() => goWriteReport('edit')}><PenTool size={14} />{t('dcm.modifyReport')}</button></>
                ) : reportStatus === '待书写' ? (
                  <><button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => goWriteReport()}><PenTool size={14} />{t('dcm.writeReport')}</button>
                  <button style={{ ...s.reportBtn, background: '#f0f4f8', color: '#475569' }} onClick={() => goWriteReport('template')}><FileText size={14} />{t('dcm.useTemplate')}</button>
                  <button style={{ ...s.reportBtn, background: '#fef3c7', color: '#d97706' }} onClick={() => showToast('危急值通知已发送')}><AlertCircle size={14} />{t('dcm.sendCritical')}</button></>
                ) : (
                  <button style={{ ...s.reportBtn, background: 'var(--content-bg)', color: '#94a3b8', cursor: 'not-allowed' }} disabled><Clock size={14} />{t('dcm.waitForExam')}</button>
                )}
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Calendar size={12} />{t('dcm.reportTimelinessSection')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: '#64748b' }}>{t('dcm.examCompleteTime')}</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>2026-05-01 10:00</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: '#64748b' }}>{t('dcm.waitingTime')}</span><span style={{ fontSize: 12, fontWeight: 600, color: '#d97706' }}>4小时30分</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: '#64748b' }}>{t('dcm.avgReportTime')}</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>28分钟</span></div>
              </div>
            </div>
            {(exam.priority === '紧急' || exam.priority === '危重') && (
              <div style={{ padding: 10, background: '#fef2f2', borderRadius: 8, border: '1px solid #fecaca', marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}><AlertCircle size={14} color="#dc2626" /><span style={{ fontSize: 12, fontWeight: 700, color: '#dc2626' }}>{exam.priority === '危重' ? '危重' : '紧急'}检查</span></div>
                <div style={{ fontSize: 12, color: '#7f1d1d', lineHeight: 1.5 }}>{exam.clinicalDiagnosis}</div>
              </div>
            )}
          </>
        )}

        {rightTab === 'history' && (
          <>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><History size={12} />{t('dcm.historyList')}</div>
              <div style={s.historySearchRow}>
                <input type="text" placeholder="搜索检查项目/日期/模态..." style={s.historySearchInput} value={historySearchText} onChange={e => setHistorySearchText(e.target.value)} />
              </div>
              <div style={s.historyActionBar}>
                <button style={{ ...s.historyActionBtn, ...(selectedHistoryExams.length === 0 ? s.historyActionBtnDisabled : {}) }} disabled={selectedHistoryExams.length === 0} onClick={enterCompareMode}><GitCompare size={12} />{t('dcm.compare')}</button>
                <button style={{ ...s.historyActionBtn, ...(selectedHistoryExams.length === 0 ? s.historyActionBtnDisabled : {}) }} disabled={selectedHistoryExams.length === 0} onClick={() => setSelectedHistoryExams([])}><X size={12} />{t('dcm.clear')}</button>
              </div>
              {selectedHistoryExams.length > 0 && <div style={{ fontSize: 12, color: '#3b82f6', marginBottom: 8, fontWeight: 600 }}>已选择 {selectedHistoryExams.length} 项检查</div>}
              {filteredHistoryExams.length === 0 ? (
                <div style={s.historyListEmpty}><div style={s.historyListEmptyIcon}><ScrollText size={32} /></div><div>{t('dcm.noHistory')}</div></div>
              ) : (
                filteredHistoryExams.map((historyExam: any) => {
                  const isSelected = selectedHistoryExams.includes(historyExam.id)
                  return (
                    <div key={historyExam.id} style={{ ...s.historyListItem, ...(isSelected ? s.historyListItemChecked : {}) }} onClick={() => toggleHistoryExam(historyExam.id)}>
                      <div style={{ ...s.historyCheckbox, ...(isSelected ? s.historyCheckboxChecked : {}) }}>{isSelected && <CheckCircle size={12} color="#fff" />}</div>
                      <div style={s.historyListItemContent}>
                        <div style={s.historyListItemHeader}><span style={s.historyListItemTitle}>{historyExam.examItemName}</span><span style={s.historyListItemDate}>{historyExam.examDate}</span></div>
                        <div style={s.historyListItemMeta}>{historyExam.modality} | {historyExam.deviceName?.split('（')[0]}</div>
                        <div style={{ ...s.historyListItemStatus, background: historyExam.status === '已完成' ? '#dcfce7' : '#fef3c7', color: historyExam.status === '已完成' ? '#16a34a' : '#d97706' }}>{historyExam.status === '已完成' && <CheckCircle size={9} />}{historyExam.status}</div>
                        {historyExam.conclusion && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4, lineHeight: 1.4 }}>{historyExam.conclusion.length > 60 ? historyExam.conclusion.substring(0, 60) + '...' : historyExam.conclusion}</div>}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            {isCompareMode && compareExam && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><GitCompare size={12} />{t('dcm.compareMode')}</div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{t('dcm.syncScroll')}</span>
                    <button style={{ ...s.syncScrollBadge, ...(syncScroll ? s.syncScrollBadgeOn : s.syncScrollBadgeOff) }} onClick={() => setSyncScroll(!syncScroll)}>{syncScroll ? <CheckCircle size={10} /> : <X size={10} />}{syncScroll ? '开' : '关'}</button></div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}><span style={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>{t('dcm.diffHighlight')}</span>
                    <button style={{ ...s.syncScrollBadge, ...(showDiffHighlight ? s.syncScrollBadgeOn : s.syncScrollBadgeOff) }} onClick={() => setShowDiffHighlight(!showDiffHighlight)}>{showDiffHighlight ? <CheckCircle size={10} /> : <X size={10} />}{showDiffHighlight ? '开' : '关'}</button></div>
                  <button style={{ ...s.reportBtn, background: '#ef4444', color: '#fff' }} onClick={exitCompareMode}><X size={14} />{t('dcm.exitCompareMode')}</button>
                </div>
                <Card bordered={false} style={s.compareInfoCard} styles={{ body: { padding: 0 } }}>
                  <div style={s.compareInfoCardTitle}><ArrowLeftRight size={12} />{t('dcm.compareInfo')}</div>
                  <div style={s.compareInfoRow}><span style={s.compareInfoLabel}>{t('dcm.currentExam')}</span><span style={s.compareInfoValue}>{exam.examDate}</span></div>
                  <div style={s.compareInfoRow}><span style={s.compareInfoLabel}>{t('dcm.historyExam')}</span><span style={s.compareInfoValue}>{compareExam.examDate}</span></div>
                  <div style={s.compareInfoRow}><span style={s.compareInfoLabel}>{t('dcm.timeInterval')}</span><span style={s.compareInfoValue}>约45天</span></div>
                </Card>
                {getCompareDiffInfo() && (
                  <Card bordered={false} style={s.diffSummaryCard} styles={{ body: { padding: 0 } }}>
                    <div style={s.diffSummaryTitle}><AlertTriangle size={12} />{t('dcm.diffSummary')}</div>
                    {getCompareDiffInfo()?.map((diff: any, idx: number) => (
                      <div key={idx} style={s.diffSummaryItem}>
                        <div style={{ ...s.diffSummaryDot, background: diff.type === 'increase' ? '#ef4444' : diff.type === 'decrease' ? '#3b82f6' : diff.type === 'new' ? '#22c55e' : '#94a3b8' }} />
                        <span style={{ flex: 1 }}>{diff.label}:</span>
                        <span style={{ color: diff.type === 'increase' ? '#ef4444' : diff.type === 'decrease' ? '#3b82f6' : diff.type === 'new' ? '#22c55e' : '#94a3b8', fontWeight: 600 }}>{diff.oldVal} → {diff.newVal}</span>
                      </div>
                    ))}
                  </Card>
                )}
                <Card bordered={false} style={s.compareInfoCard} styles={{ body: { padding: 0 } }}>
                  <div style={s.compareInfoCardTitle}><ScrollText size={12} />{t('dcm.historyReport')}</div>
                  <div style={{ marginBottom: 6 }}><div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{t('dcm.reportDoctor')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{compareExam.reportDoctor || '未报告'}</div></div>
                  {compareExam.finding && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{t('dcm.finding')}</div><div style={{ fontSize: 12, color: '#475569', lineHeight: 1.5 }}>{compareExam.finding}</div></div>}
                  {compareExam.conclusion && <div><div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 2 }}>{t('dcm.conclusion')}</div><div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>{compareExam.conclusion}</div></div>}
                </Card>
              </>
            )}
          </>
        )}

        {rightTab === 'external' && (
          <>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><GitCompare size={12} />{t('dcm.crossInst')}</div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4, textTransform: 'uppercase' }}>{t('dcm.selectInst')}</div>
                <select value={externalInstitution} onChange={e => { setExternalInstitution(e.target.value); setSelectedExternalExam(null) }} style={{ ...s.select, width: '100%', minWidth: 'unset' }}>
                  <option value="">-- {t('dcm.selectInst')} --</option>
                  {EXTERNAL_INSTITUTIONS.filter((inst: any) => inst.status === 'online').map((inst: any) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                <button style={{ ...s.mprTab, flex: 1, ...(externalSearchType === 'patientId' ? s.mprTabActive : {}) }} onClick={() => setExternalSearchType('patientId')}>{t('dcm.patientId')}</button>
                <button style={{ ...s.mprTab, flex: 1, ...(externalSearchType === 'patientName' ? s.mprTabActive : {}) }} onClick={() => setExternalSearchType('patientName')}>{t('dc.patientName')}</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder={externalSearchType === 'patientId' ? '输入患者ID' : '输入患者姓名'} value={externalSearchText} onChange={e => setExternalSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleExternalSearch()} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 12, outline: 'none', fontFamily: 'inherit' }} />
                <button style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={handleExternalSearch}>{t('dcm.search')}</button>
              </div>
            </div>
            {externalSearchResults.length > 0 && (
              <div style={s.infoSection}>
                <div style={s.infoSectionTitle}><FileSearch size={12} />检索结果 ({externalSearchResults.length})</div>
                {externalSearchResults.map((extExam: any) => (
                  <div key={extExam.id} style={{ ...s.historyListItem, ...(selectedExternalExam?.id === extExam.id ? s.historyListItemSelected : {}) }} onClick={() => setSelectedExternalExam(extExam)}>
                    <div style={s.historyListItemContent}>
                      <div style={s.historyListItemHeader}><span style={s.historyListItemTitle}>{extExam.examItemName}</span><span style={s.historyListItemDate}>{extExam.examDate}</span></div>
                      <div style={s.historyListItemMeta}>{extExam.patientName} · {extExam.gender}/{extExam.age}岁 · {extExam.modality} · {extExam.bodyPart}</div>
                      <div style={{ ...s.historyListItemStatus, background: extExam.status === 'available' ? '#dcfce7' : extExam.status === 'pending' ? '#fef3c7' : '#f3f4f6', color: extExam.status === 'available' ? '#16a34a' : extExam.status === 'pending' ? '#d97706' : '#6b7280' }}>
                        {extExam.status === 'available' && <CheckCircle size={9} />}{extExam.status === 'available' ? '可调阅' : extExam.status === 'pending' ? '申请中' : '已归档'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedExternalExam && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><FileText size={12} />外院检查详情</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoItem}><span style={s.infoLabel}>{t('dc.patientName')}</span><span style={s.infoValue}>{selectedExternalExam.patientName}</span></div>
                    <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.genderAge')}</span><span style={s.infoValue}>{selectedExternalExam.gender}/{selectedExternalExam.age}岁</span></div>
                    <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examItem')}</span><span style={s.infoValue}>{selectedExternalExam.examItemName}</span></div>
                    <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examDate')}</span><span style={s.infoValue}>{selectedExternalExam.examDate}</span></div>
                    <div style={s.infoItem}><span style={s.infoLabel}>{t('qcimage.device')}</span><span style={s.infoValue}>{selectedExternalExam.deviceName?.split('（')[0]}</span></div>
                    <div style={s.infoItem}><span style={s.infoLabel}>{t('qcimage.examId')}</span><span style={s.infoValue}>{selectedExternalExam.accessionNumber}</span></div>
                  </div>
                </div>
                {selectedExternalExam.finding && (
                  <div style={s.infoSection}>
                    <div style={s.infoSectionTitle}><ScrollText size={12} />外院报告摘要</div>
                    <Card bordered={false} style={s.reportStatusCard} styles={{ body: { padding: 0 } }}>
                      <div style={{ marginBottom: 6 }}><span style={s.infoLabel}>{t('dcm.reportDoctor')}</span><div style={s.infoValue}>{selectedExternalExam.reportDoctor || '未填写'}</div></div>
                      {selectedExternalExam.finding && <div style={{ marginBottom: 6 }}><span style={s.infoLabel}>{t('dcm.finding')}</span><div style={{ ...s.infoValueFull, fontSize: 12, lineHeight: 1.5 }}>{selectedExternalExam.finding}</div></div>}
                      {selectedExternalExam.conclusion && <div style={{ marginBottom: 6 }}><span style={s.infoLabel}>{t('dcm.conclusion')}</span><div style={{ ...s.infoValueFull, fontSize: 12, fontWeight: 600, color: '#dc2626', lineHeight: 1.5 }}>{selectedExternalExam.conclusion}</div></div>}
                    </Card>
                  </div>
                )}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><GitCompare size={12} />影像对比</div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 10 }}>
                    <button style={{ ...s.mprTab, flex: 1, ...(externalCompareLayout === 'leftRight' ? s.mprTabActive : {}) }} onClick={() => setExternalCompareLayout('leftRight')}>左右</button>
                    <button style={{ ...s.mprTab, flex: 1, ...(externalCompareLayout === 'topBottom' ? s.mprTabActive : {}) }} onClick={() => setExternalCompareLayout('topBottom')}>上下</button>
                  </div>
                  <button style={{ ...s.reportBtn, background: isExternalCompareMode ? '#ef4444' : PRIMARY, color: '#fff' }} onClick={() => setIsExternalCompareMode(!isExternalCompareMode)}><GitCompare size={14} />{isExternalCompareMode ? '退出对比' : '启动对比'}</button>
                </div>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><Upload size={12} />申请调阅归档</div>
                  <div style={{ padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, marginBottom: 8, border: '1px solid #e2e8f0' }}><div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>将外院影像归档至本院PACS系统，便于后续长期查阅和对比。</div></div>
                  {archiveRequestStatus && (
                    <div style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 8, fontSize: 12, fontWeight: 600, background: archiveRequestStatus === 'success' ? '#dcfce7' : '#fef3c7', color: archiveRequestStatus === 'success' ? '#16a34a' : '#d97706' }}>
                      {archiveRequestStatus === 'success' ? <><CheckCircle size={12} /> 申请已提交，请等待审核</> : <><Clock size={12} /> 申请处理中...</>}
                    </div>
                  )}
                  <button style={{ ...s.reportBtn, background: selectedExternalExam.status === 'archived' ? '#94a3b8' : PRIMARY, color: '#fff', cursor: selectedExternalExam.status === 'archived' ? 'not-allowed' : 'pointer' }}
                    disabled={selectedExternalExam.status === 'archived' || !!archiveRequestStatus} onClick={handleArchiveRequest}>
                    <Upload size={14} />{selectedExternalExam.status === 'archived' ? '已归档' : archiveRequestStatus ? '已申请' : '申请调阅'}
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
