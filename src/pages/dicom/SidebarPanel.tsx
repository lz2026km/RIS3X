import { t } from '../../i18n/appI18n'
import { examApi, criticalExtApi } from '../../services/api'
import { useNavigate } from 'react-router-dom'
import type { Dispatch, SetStateAction } from 'react'
import { User, Image as ImageIcon, Ruler as RulerIcon, FileSearch, History, GitCompare, FileText, AlertCircle, Activity, Info, Layers3, Box, RefreshCw, Calendar, CheckCircle, Clock, PenTool, Eye, X, Upload, Camera, Download, AlertTriangle, ScrollText, ArrowLeftRight } from 'lucide-react'
import MeasurementPanel from './MeasurementPanel'
import { Card } from 'antd'
import type { Series, DicomImage, MeasureSubMenu, Measurement, RightTab, Tool, CompareLayout } from './DicomViewerTypes'
import { PRIMARY } from './DicomViewerTypes'

const s = {
  rightPanel: { width: 280, background: 'var(--content-bg)', borderLeft: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', flexShrink: 0 },
  rightTabs: { display: 'flex', borderBottom: '1px solid var(--border-color)', flexShrink: 0 },
  rightTab: { flex: 1, padding: '6px 4px', border: 'none', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', gap: 2, transition: 'all 0.15s', borderBottom: '2px solid transparent' } as React.CSSProperties,
  rightTabActive: { color: PRIMARY, borderBottomColor: PRIMARY, background: 'rgba(30,58,95,0.05)' },
  rightPanelContent: { flex: 1, overflow: 'auto', padding: 10 },
  infoSection: { marginBottom: 'var(--space-3, 12px)' },
  infoSectionTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' },
  infoGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-1, 4px)' },
  infoItem: { display: 'flex', flexDirection: 'column' as const, gap: 1 },
  infoLabel: { fontSize: 12, color: 'var(--text-muted)' },
  infoValue: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },
  infoValueFull: { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 },
  reportStatusCard: { padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 'var(--space-2, 8px)' },
  reportStatusBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 8px', borderRadius: 10, fontSize: 12, fontWeight: 700 },
  reportBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', justifyContent: 'center' } as React.CSSProperties,
  select: { padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, color: PRIMARY, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' } as React.CSSProperties,
  mprTabs: { display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-1, 4px)' },
  mprTab: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const, transition: 'all 0.15s' } as React.CSSProperties,
  mprTabActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  mipControlPanel: { background: 'var(--content-bg)', borderRadius: 8, padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)' },
  mipControlTitle: { fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-1, 4px)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' },
  mipDirRow: { display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 'var(--space-2, 8px)' },
  mipDirBtn: { flex: 1, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', textAlign: 'center' as const },
  mipDirBtnActive: { background: PRIMARY, borderColor: PRIMARY, color: '#fff' },
  mipFrameRow: { display: 'flex', alignItems: 'center', gap: 6 },
  mipFrameLabel: { fontSize: 12, color: 'var(--text-muted)', flexShrink: 0 },
  mipFrameVal: { fontSize: 12, color: PRIMARY, fontWeight: 600, minWidth: 50 },
  vrControlPanel: { background: 'var(--content-bg)', borderRadius: 8, padding: 'var(--space-2, 8px)', border: '1px solid var(--border-color)' },
  vrSliderRow: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 },
  vrSliderLabel: { fontSize: 12, color: 'var(--text-muted)', flexShrink: 0, minWidth: 24 },
  vrSlider: { flex: 1, accentColor: PRIMARY } as React.CSSProperties,
  vrSliderVal: { fontSize: 12, color: PRIMARY, fontWeight: 600, minWidth: 30, textAlign: 'right' as const },
  vrResetBtn: { width: '100%', padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: 12, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)', justifyContent: 'center' } as React.CSSProperties,
  historySearchRow: { display: 'flex', gap: 6, marginBottom: 10 },
  historySearchInput: { flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, fontFamily: 'inherit' },
  historySearchBtn: { padding: '6px 10px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  historyListItem: { display: 'flex', alignItems: 'flex-start', gap: 'var(--space-2, 8px)', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)', marginBottom: 6, cursor: 'pointer', transition: 'all 0.15s' },
  historyListItemSelected: { border: '2px solid var(--color-primary-500)', background: 'var(--color-info-bg)' },
  historyListItemChecked: { border: '2px solid var(--color-success-500)', background: 'var(--color-success-bg)' },
  historyCheckbox: { width: 16, height: 16, borderRadius: 4, border: '2px solid #cbd5e1', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2, cursor: 'pointer' },
  historyCheckboxChecked: { background: 'var(--color-success-500)', borderColor: 'var(--color-success-500)' },
  historyListItemContent: { flex: 1, minWidth: 0 },
  historyListItemHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-1, 4px)' },
  historyListItemTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  historyListItemDate: { fontSize: 12, color: 'var(--text-muted)' },
  historyListItemMeta: { fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.4 },
  historyListItemStatus: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700, marginTop: 'var(--space-1, 4px)' },
  historyListEmpty: { textAlign: 'center' as const, padding: '24px 12px', color: 'var(--text-muted)', fontSize: 12 },
  historyListEmptyIcon: { marginBottom: 'var(--space-2, 8px)', opacity: 0.5 },
  historyActionBar: { display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const },
  historyActionBtn: { flex: 1, minWidth: 60, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-card)', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, transition: 'all 0.15s' } as React.CSSProperties,
  historyActionBtnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  syncScrollBadge: { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 8px', borderRadius: 12, fontSize: 12, fontWeight: 700 } as React.CSSProperties,
  syncScrollBadgeOn: { background: 'var(--color-success-bg)', color: 'var(--color-success-600)' },
  syncScrollBadgeOff: { background: 'var(--content-bg)', color: 'var(--text-muted)' },
  compareInfoCard: { background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-color)', padding: 10, marginBottom: 'var(--space-2, 8px)' },
  compareInfoCardTitle: { fontSize: 12, fontWeight: 700, color: PRIMARY, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' },
  compareInfoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0', borderBottom: '1px solid var(--border-color)' },
  compareInfoLabel: { fontSize: 12, color: 'var(--text-muted)' },
  compareInfoValue: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },
  compareControlBadge: { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)', padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', border: 'none' } as React.CSSProperties,
  compareControlBadgeOn: { background: PRIMARY, color: '#fff' },
  compareControlBadgeOff: { background: 'var(--border-color)', color: 'var(--text-muted)' },
  diffSummaryCard: { background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)', borderRadius: 8, padding: 10, marginBottom: 'var(--space-2, 8px)' },
  diffSummaryTitle: { fontSize: 12, fontWeight: 700, color: 'var(--color-warning)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' },
  diffSummaryItem: { display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', fontSize: 12, color: 'var(--color-warning)' },
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
  const { exam, rightTab, setRightTab, activeSeries, currentImage, ww, wl, zoom,
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

  // [Wave2A] 导出PNG: canvas 按当前窗宽窗位绘制模拟影像 + 患者信息覆盖层 → Blob 下载
  const exportPng = () => {
    try {
      const size = 512
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('no-canvas')
      ctx.fillStyle = '#0f172a'
      ctx.fillRect(0, 0, size, size)
      // 模拟 DICOM 影像: 窗宽/窗中心映射为灰度渐变 + 噪声纹理
      const center = Math.max(0, Math.min(1, (wl + 2048) / 4096))
      const range = Math.max(1, ww / 4096)
      const image = ctx.createImageData(size, size)
      const data = image.data
      const base = Math.round(center * 255)
      const amp = Math.round(range * 120)
      let seed = 7
      const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
      for (let i = 0; i < size * size; i++) {
        const x = i % size
        const y = Math.floor(i / size)
        const blob = Math.sin(x / 37) * 0.5 + Math.cos(y / 29) * 0.5 + rand() * 0.6
        const v = Math.max(0, Math.min(255, base + blob * amp))
        data[i * 4] = v
        data[i * 4 + 1] = v
        data[i * 4 + 2] = v
        data[i * 4 + 3] = 255
      }
      ctx.putImageData(image, 0, 0)
      // 患者信息覆盖层 (与阅片器状态栏一致)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, size, 26)
      ctx.fillStyle = '#e2e8f0'
      ctx.font = '13px sans-serif'
      ctx.fillText(`${exam.patientName} ${exam.gender}/${exam.age}${t('w9d.common.ageSuffix')}  ${exam.examItemName}`, 8, 17)
      ctx.fillText(`${ww}/WW  ${wl}/WL  ${zoom ? t('w9d.sidebar.zoomPrefix') + zoom + 'x' : ''}`, size - 180, 17)
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, size - 24, size, 24)
      ctx.fillStyle = '#94a3b8'
      ctx.font = '12px sans-serif'
      ctx.fillText(`${exam.accessionNumber} · ${t('w9d.sidebar.seriesLabel')} ${activeSeries.seriesNumber} · ${t('w9d.sidebar.sliceLabel')} ${currentImage?.imageNumber ?? 1}/${activeSeries.imageCount}`, 8, size - 8)
      canvas.toBlob((blob) => {
        if (!blob) { showToast(t('w9d.sidebar.pngExportUnsupported')); return }
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `dicom-snapshot-${exam.accessionNumber || exam.id}-${Date.now()}.png`
        document.body.appendChild(a)
        a.click()
        a.remove()
        setTimeout(() => URL.revokeObjectURL(url), 1000)
        showToast(t('w9d.sidebar.pngExported'))
      }, 'image/png')
    } catch {
      showToast(t('w9d.sidebar.pngExportFailed'))
    }
  }

  // [Wave2A] 导出DICOM: 跳转 DIMSE 上传页 (携带检查参数)
  const exportDicom = () => {
    const params = new URLSearchParams()
    if (exam.id) params.set('examId', exam.id)
    if (exam.accessionNumber) params.set('accessionNumber', exam.accessionNumber)
    if (exam.patientId) params.set('patientId', exam.patientId)
    params.set('modality', exam.modality || '')
    navigate(`/integration/dimse/upload?${params.toString()}`)
    showToast(t('w9d.sidebar.dicomUploadJump'))
  }

  // [Wave2A] 危急值通知: 接 criticalExtApi.autoDetect 真实创建, 失败回退危急值页
  const sendCritical = async () => {
    showToast(t('w9d.sidebar.creatingCritical'))
    try {
      const res = await criticalExtApi.autoDetect({
        examId: String(exam.id ?? exam.accessionNumber ?? ''),
        reportContent: String(exam.clinicalDiagnosis || exam.examIndications || exam.clinicalHistory || '危急值待确认'),
      })
      if (res.success) {
        showToast(t('w9d.sidebar.criticalSent'))
      } else {
        showToast(t('w9d.sidebar.criticalCreateFailed', { msg: res.error?.message ?? t('w9d.sidebar.unknownError') }))
        navigate(`/critical-value?examId=${encodeURIComponent(exam.id || '')}`)
      }
    } catch {
      showToast(t('w9d.sidebar.criticalUnavailable'))
      navigate(`/critical-value?examId=${encodeURIComponent(exam.id || '')}`)
    }
  }

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
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.examStatus')}</span><span style={{ ...s.infoValue, color: exam.status === '已完成' ? 'var(--color-success-500)' : exam.status === '检查中' ? 'var(--color-warning-500)' : '#64748b' }}>{exam.status}</span></div>
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><AlertCircle size={12} />{t('dcm.clinicalInfo')}</div>
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}><span style={s.infoLabel}>{t('dcm.clinicalDiagnosis')}</span><div style={{ ...s.infoValueFull, color: 'var(--color-error-600)' }}>{exam.clinicalDiagnosis}</div></div>
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}><span style={s.infoLabel}>{t('w9d.sidebar.historyLabel')}</span><div style={s.infoValueFull}>{exam.clinicalHistory}</div></div>
              <div style={{ marginBottom: 'var(--space-2, 8px)' }}><span style={s.infoLabel}>{t('dcm.examIndications')}</span><div style={s.infoValueFull}>{exam.examIndications}</div></div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Layers3 size={12} />{t('dcm.mpr')}</div>
              <div style={s.mprTabs}>{[t('w9d.sidebar.mprAxial'), t('w9d.sidebar.mprCoronal'), t('w9d.sidebar.mprSagittal')].map((tab, i) => (<button key={tab} style={{ ...s.mprTab, ...(i === activeMprIdx ? s.mprTabActive : {}) }} onClick={() => setActiveMprIdx(i)}>{tab}</button>))}</div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Activity size={12} />{t('dcm.mip')}</div>
              <Card bordered={false} style={s.mipControlPanel} styles={{ body: { padding: 0 } }}>
                <div style={s.mipControlTitle}><span>{t('dcm.projDir')}</span></div>
                <div style={s.mipDirRow}>{(['axial', 'sagittal', 'coronal'] as const).map(dir => (<button key={dir} style={{ ...s.mipDirBtn, ...(mipDirection === dir ? s.mipDirBtnActive : {}) }} onClick={() => setMipDirection(dir)}>{dir === 'axial' ? t('w9d.sidebar.planeAxial') : dir === 'sagittal' ? t('w9d.sidebar.planeSagittal') : t('w9d.sidebar.planeCoronal')}</button>))}</div>
                <div style={s.mipControlTitle}><span>{t('dcm.frameSelect')}</span></div>
                <div style={s.mipFrameRow}><span style={s.mipFrameLabel}>{t('w9d.sidebar.frameLabel')}</span><input type="range" min={0} max={Math.max(0, images.length - 1)} value={mipFrame} onChange={e => setMipFrame(parseInt(e.target.value))} style={{ flex: 1, accentColor: PRIMARY }} /><span style={s.mipFrameVal}>{mipFrame + 1}/{images.length}</span></div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 'var(--space-2, 8px)' }}>
              <button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={exportPng}><Camera size={14} />{t('dcmexp.exportPng')}</button>
                  <button style={{ ...s.reportBtn, background: 'var(--bg-card)', color: PRIMARY }} onClick={exportDicom}><Download size={14} />{t('dcmexp.exportDicom')}</button>
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
                <div style={s.infoItem}><span style={s.infoLabel}>{t('w9d.sidebar.device')}</span><span style={s.infoValue}>{activeSeries.modality}</span></div>
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Info size={12} />{t('dcm.imageParams')}</div>
              <div style={s.infoGrid}>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('dcm.sliceThickness')}</span><span style={s.infoValue}>{currentImage?.sliceThickness || 2.5}mm</span></div>
                <div style={s.infoItem}><span style={s.infoLabel}>{t('w9d.sidebar.sliceGap')}</span><span style={s.infoValue}>2.5mm</span></div>
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2, 8px)' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{exam.examItemName}</span>
                  <span style={{ ...s.reportStatusBadge, background: reportStatus === '已报告' ? 'var(--color-success-bg)' : reportStatus === '待书写' ? 'var(--color-warning-bg)' : 'var(--border-light)', color: reportStatus === '已报告' ? 'var(--color-success-600)' : reportStatus === '待书写' ? 'var(--color-warning-600)' : '#64748b' }}>
                    {reportStatus === '已报告' && <CheckCircle size={10} />}{reportStatus === '待书写' && <Clock size={10} />}{reportStatus}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('w9d.sidebar.patientLabel')} {exam.patientName} | {exam.age}{t('w9d.common.ageSuffix')}{exam.gender}<br />{t('w9d.sidebar.examDateLabel')} {exam.examDate} {exam.examTime}</div>
              </Card>
              {reportStatus === '已报告' && (
                <><div style={{ marginBottom: 'var(--space-2, 8px)', padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-1, 4px)' }}>{t('dcm.reportDoctor')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>李明辉</div></div>
                <div style={{ marginBottom: 'var(--space-2, 8px)', padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, border: '1px solid var(--border-color)' }}><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-1, 4px)' }}>{t('w9d.sidebar.reportTime')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>2026-05-01 14:30</div></div></>
              )}
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><FileText size={12} />{t('dcm.reportActions')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {exam.status !== '待报告' && exam.status !== '已报告' && (
                   <button style={{ ...s.reportBtn, background: '#059669', color: '#fff' }} onClick={async () => { await examApi.complete(exam.id); showToast(t('w9d.sidebar.acquisitionComplete')) }}><CheckCircle size={14} />{t('dcm.completeAcquisition')}</button>
                )}
                {reportStatus === '已报告' ? (
                  <><button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => goWriteReport()}><Eye size={14} />{t('dcm.viewReport')}</button>
                  <button style={{ ...s.reportBtn, background: 'var(--bg-card)', color: PRIMARY }} onClick={() => goWriteReport('edit')}><PenTool size={14} />{t('dcm.modifyReport')}</button></>
                ) : reportStatus === '待书写' ? (
                  <><button style={{ ...s.reportBtn, background: PRIMARY, color: '#fff' }} onClick={() => goWriteReport()}><PenTool size={14} />{t('dcm.writeReport')}</button>
                  <button style={{ ...s.reportBtn, background: 'var(--bg-card)', color: 'var(--text-secondary)' }} onClick={() => goWriteReport('template')}><FileText size={14} />{t('dcm.useTemplate')}</button>
                  <button style={{ ...s.reportBtn, background: 'var(--color-warning-bg)', color: 'var(--color-warning-600)' }} onClick={() => void sendCritical()}><AlertCircle size={14} />{t('dcm.sendCritical')}</button></>
                ) : (
                  <button style={{ ...s.reportBtn, background: 'var(--content-bg)', color: 'var(--text-muted)', cursor: 'not-allowed' }} disabled><Clock size={14} />{t('dcm.waitForExam')}</button>
                )}
              </div>
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><Calendar size={12} />{t('dcm.reportTimelinessSection')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dcm.examCompleteTime')}</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>2026-05-01 10:00</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dcm.waitingTime')}</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-warning-600)' }}>{t('w9d.sidebar.waitingTimeValue')}</span></div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('dcm.avgReportTime')}</span><span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{t('w9d.sidebar.avgReportTimeValue')}</span></div>
              </div>
            </div>
            {(exam.priority === '紧急' || exam.priority === '危重') && (
              <div style={{ padding: 10, background: 'var(--color-error-bg)', borderRadius: 8, border: '1px solid var(--color-error-border)', marginTop: 'var(--space-2, 8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 'var(--space-1, 4px)' }}><AlertCircle size={14} color="var(--color-error-600)" /><span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-error-600)' }}>{exam.priority === '危重' ? t('w9d.sidebar.priorityCritical') : t('w9d.sidebar.priorityUrgent')}{t('w9d.sidebar.examWord')}</span></div>
                <div style={{ fontSize: 12, color: 'var(--color-error)', lineHeight: 1.5 }}>{exam.clinicalDiagnosis}</div>
              </div>
            )}
          </>
        )}

        {rightTab === 'history' && (
          <>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}><History size={12} />{t('dcm.historyList')}</div>
              <div style={s.historySearchRow}>
                <input type="text" placeholder={t('w9d.sidebar.searchPlaceholder')} style={s.historySearchInput} value={historySearchText} onChange={e => setHistorySearchText(e.target.value)} />
              </div>
              <div style={s.historyActionBar}>
                <button style={{ ...s.historyActionBtn, ...(selectedHistoryExams.length === 0 ? s.historyActionBtnDisabled : {}) }} disabled={selectedHistoryExams.length === 0} onClick={enterCompareMode}><GitCompare size={12} />{t('dcm.compare')}</button>
                <button style={{ ...s.historyActionBtn, ...(selectedHistoryExams.length === 0 ? s.historyActionBtnDisabled : {}) }} disabled={selectedHistoryExams.length === 0} onClick={() => setSelectedHistoryExams([])}><X size={12} />{t('dcm.clear')}</button>
              </div>
              {selectedHistoryExams.length > 0 && <div style={{ fontSize: 12, color: 'var(--color-primary-500)', marginBottom: 'var(--space-2, 8px)', fontWeight: 600 }}>{t('w9d.sidebar.selectedCount', { count: selectedHistoryExams.length })}</div>}
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
                        <div style={{ ...s.historyListItemStatus, background: historyExam.status === '已完成' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: historyExam.status === '已完成' ? 'var(--color-success-600)' : 'var(--color-warning-600)' }}>{historyExam.status === '已完成' && <CheckCircle size={9} />}{historyExam.status}</div>
                        {historyExam.conclusion && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 'var(--space-1, 4px)', lineHeight: 1.4 }}>{historyExam.conclusion.length > 60 ? historyExam.conclusion.substring(0, 60) + '...' : historyExam.conclusion}</div>}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2, 8px)' }}><span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dcm.syncScroll')}</span>
                    <button style={{ ...s.syncScrollBadge, ...(syncScroll ? s.syncScrollBadgeOn : s.syncScrollBadgeOff) }} onClick={() => setSyncScroll(!syncScroll)}>{syncScroll ? <CheckCircle size={10} /> : <X size={10} />}{syncScroll ? t('w9d.sidebar.on') : t('w9d.sidebar.off')}</button></div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-2, 8px)' }}><span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 600 }}>{t('dcm.diffHighlight')}</span>
                    <button style={{ ...s.syncScrollBadge, ...(showDiffHighlight ? s.syncScrollBadgeOn : s.syncScrollBadgeOff) }} onClick={() => setShowDiffHighlight(!showDiffHighlight)}>{showDiffHighlight ? <CheckCircle size={10} /> : <X size={10} />}{showDiffHighlight ? t('w9d.sidebar.on') : t('w9d.sidebar.off')}</button></div>
                  <button style={{ ...s.reportBtn, background: 'var(--color-error-500)', color: '#fff' }} onClick={exitCompareMode}><X size={14} />{t('dcm.exitCompareMode')}</button>
                </div>
                <Card bordered={false} style={s.compareInfoCard} styles={{ body: { padding: 0 } }}>
                  <div style={s.compareInfoCardTitle}><ArrowLeftRight size={12} />{t('dcm.compareInfo')}</div>
                  <div style={s.compareInfoRow}><span style={s.compareInfoLabel}>{t('dcm.currentExam')}</span><span style={s.compareInfoValue}>{exam.examDate}</span></div>
                  <div style={s.compareInfoRow}><span style={s.compareInfoLabel}>{t('dcm.historyExam')}</span><span style={s.compareInfoValue}>{compareExam.examDate}</span></div>
                  <div style={s.compareInfoRow}><span style={s.compareInfoLabel}>{t('dcm.timeInterval')}</span><span style={s.compareInfoValue}>{t('w9d.sidebar.approx45Days')}</span></div>
                </Card>
                {getCompareDiffInfo() && (
                  <Card bordered={false} style={s.diffSummaryCard} styles={{ body: { padding: 0 } }}>
                    <div style={s.diffSummaryTitle}><AlertTriangle size={12} />{t('dcm.diffSummary')}</div>
                    {getCompareDiffInfo()?.map((diff: any, idx: number) => (
                      <div key={idx} style={s.diffSummaryItem}>
                        <div style={{ ...s.diffSummaryDot, background: diff.type === 'increase' ? 'var(--color-error-500)' : diff.type === 'decrease' ? 'var(--color-primary-500)' : diff.type === 'new' ? 'var(--color-success-500)' : '#94a3b8' }} />
                        <span style={{ flex: 1 }}>{diff.label}:</span>
                        <span style={{ color: diff.type === 'increase' ? 'var(--color-error-500)' : diff.type === 'decrease' ? 'var(--color-primary-500)' : diff.type === 'new' ? 'var(--color-success-500)' : '#94a3b8', fontWeight: 600 }}>{diff.oldVal} → {diff.newVal}</span>
                      </div>
                    ))}
                  </Card>
                )}
                <Card bordered={false} style={s.compareInfoCard} styles={{ body: { padding: 0 } }}>
                  <div style={s.compareInfoCardTitle}><ScrollText size={12} />{t('dcm.historyReport')}</div>
                  <div style={{ marginBottom: 6 }}><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{t('dcm.reportDoctor')}</div><div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{compareExam.reportDoctor || t('w9d.sidebar.noReport')}</div></div>
                  {compareExam.finding && <div style={{ marginBottom: 6 }}><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{t('dcm.finding')}</div><div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5 }}>{compareExam.finding}</div></div>}
                  {compareExam.conclusion && <div><div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>{t('dcm.conclusion')}</div><div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.5 }}>{compareExam.conclusion}</div></div>}
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
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 'var(--space-1, 4px)', textTransform: 'uppercase' }}>{t('dcm.selectInst')}</div>
                <select value={externalInstitution} onChange={e => { setExternalInstitution(e.target.value); setSelectedExternalExam(null) }} style={{ ...s.select, width: '100%', minWidth: 'unset' }}>
                  <option value="">-- {t('dcm.selectInst')} --</option>
                  {EXTERNAL_INSTITUTIONS.filter((inst: any) => inst.status === 'online').map((inst: any) => (
                    <option key={inst.id} value={inst.id}>{inst.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 10 }}>
                <button style={{ ...s.mprTab, flex: 1, ...(externalSearchType === 'patientId' ? s.mprTabActive : {}) }} onClick={() => setExternalSearchType('patientId')}>{t('dcm.patientId')}</button>
                <button style={{ ...s.mprTab, flex: 1, ...(externalSearchType === 'patientName' ? s.mprTabActive : {}) }} onClick={() => setExternalSearchType('patientName')}>{t('dc.patientName')}</button>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input type="text" placeholder={externalSearchType === 'patientId' ? t('w9d.sidebar.inputPatientId') : t('w9d.sidebar.inputPatientName')} value={externalSearchText} onChange={e => setExternalSearchText(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleExternalSearch()} style={{ flex: 1, padding: '6px 10px', borderRadius: 6, border: '1px solid var(--border-color)', fontSize: 12, fontFamily: 'inherit' }} />
                <button style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: PRIMARY, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }} onClick={handleExternalSearch}>{t('dcm.search')}</button>
              </div>
            </div>
            {externalSearchResults.length > 0 && (
              <div style={s.infoSection}>
                <div style={s.infoSectionTitle}><FileSearch size={12} />{t('w9d.sidebar.searchResults')} ({externalSearchResults.length})</div>
                {externalSearchResults.map((extExam: any) => (
                  <div key={extExam.id} style={{ ...s.historyListItem, ...(selectedExternalExam?.id === extExam.id ? s.historyListItemSelected : {}) }} onClick={() => setSelectedExternalExam(extExam)}>
                    <div style={s.historyListItemContent}>
                      <div style={s.historyListItemHeader}><span style={s.historyListItemTitle}>{extExam.examItemName}</span><span style={s.historyListItemDate}>{extExam.examDate}</span></div>
                      <div style={s.historyListItemMeta}>{extExam.patientName} · {extExam.gender}/{extExam.age}{t('w9d.common.ageSuffix')} · {extExam.modality} · {extExam.bodyPart}</div>
                      <div style={{ ...s.historyListItemStatus, background: extExam.status === 'available' ? 'var(--color-success-bg)' : extExam.status === 'pending' ? 'var(--color-warning-bg)' : 'var(--border-light)',                         color: extExam.status === 'available' ? 'var(--color-success-600)' : extExam.status === 'pending' ? 'var(--color-warning-600)' : 'var(--text-muted)' }}>
                        {extExam.status === 'available' && <CheckCircle size={9} />}{extExam.status === 'available' ? t('w9d.sidebar.statusAvailable') : extExam.status === 'pending' ? t('w9d.sidebar.statusPending') : t('w9d.sidebar.statusArchived')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {selectedExternalExam && (
              <>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><FileText size={12} />{t('w9d.sidebar.externalExamDetail')}</div>
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
                    <div style={s.infoSectionTitle}><ScrollText size={12} />{t('w9d.sidebar.externalReportSummary')}</div>
                    <Card bordered={false} style={s.reportStatusCard} styles={{ body: { padding: 0 } }}>
                      <div style={{ marginBottom: 6 }}><span style={s.infoLabel}>{t('dcm.reportDoctor')}</span><div style={s.infoValue}>{selectedExternalExam.reportDoctor || t('w9d.sidebar.notFilled')}</div></div>
                      {selectedExternalExam.finding && <div style={{ marginBottom: 6 }}><span style={s.infoLabel}>{t('dcm.finding')}</span><div style={{ ...s.infoValueFull, fontSize: 12, lineHeight: 1.5 }}>{selectedExternalExam.finding}</div></div>}
                      {selectedExternalExam.conclusion && <div style={{ marginBottom: 6 }}><span style={s.infoLabel}>{t('dcm.conclusion')}</span><div style={{ ...s.infoValueFull, fontSize: 12, fontWeight: 600, color: 'var(--color-error-600)', lineHeight: 1.5 }}>{selectedExternalExam.conclusion}</div></div>}
                    </Card>
                  </div>
                )}
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><GitCompare size={12} />{t('w9d.sidebar.imageCompare')}</div>
                  <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', marginBottom: 10 }}>
                    <button style={{ ...s.mprTab, flex: 1, ...(externalCompareLayout === 'leftRight' ? s.mprTabActive : {}) }} onClick={() => setExternalCompareLayout('leftRight')}>{t('w9d.sidebar.layoutLeftRight')}</button>
                    <button style={{ ...s.mprTab, flex: 1, ...(externalCompareLayout === 'topBottom' ? s.mprTabActive : {}) }} onClick={() => setExternalCompareLayout('topBottom')}>{t('w9d.sidebar.layoutTopBottom')}</button>
                  </div>
                  <button style={{ ...s.reportBtn, background: isExternalCompareMode ? 'var(--color-error-500)' : PRIMARY, color: '#fff' }} onClick={() => setIsExternalCompareMode(!isExternalCompareMode)}><GitCompare size={14} />{isExternalCompareMode ? t('w9d.sidebar.exitCompare') : t('w9d.sidebar.startCompare')}</button>
                </div>
                <div style={s.infoSection}>
                  <div style={s.infoSectionTitle}><Upload size={12} />{t('w9d.sidebar.archiveRequest')}</div>
                  <div style={{ padding: '8px 10px', background: 'var(--content-bg)', borderRadius: 8, marginBottom: 'var(--space-2, 8px)', border: '1px solid var(--border-color)' }}><div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>{t('w9d.sidebar.archiveRequestDesc')}</div></div>
                  {archiveRequestStatus && (
                    <div style={{ padding: '6px 10px', borderRadius: 6, marginBottom: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 600, background: archiveRequestStatus === 'success' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)', color: archiveRequestStatus === 'success' ? 'var(--color-success-600)' : 'var(--color-warning-600)' }}>
                      {archiveRequestStatus === 'success' ? <><CheckCircle size={12} /> {t('w9d.sidebar.archiveSubmitted')}</> : <><Clock size={12} /> {t('w9d.sidebar.archiveProcessing')}</>}
                    </div>
                  )}
                  <button style={{ ...s.reportBtn, background: selectedExternalExam.status === 'archived' ? '#94a3b8' : PRIMARY, color: '#fff', cursor: selectedExternalExam.status === 'archived' ? 'not-allowed' : 'pointer' }}
                    disabled={selectedExternalExam.status === 'archived' || !!archiveRequestStatus} onClick={handleArchiveRequest}>
                    <Upload size={14} />{selectedExternalExam.status === 'archived' ? t('w9d.sidebar.statusArchived') : archiveRequestStatus ? t('w9d.sidebar.requested') : t('w9d.sidebar.requestAccess')}
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
