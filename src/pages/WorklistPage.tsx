import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  ClipboardList, Wifi, LayoutList, LayoutGrid, Kanban, RefreshCw,
  Printer, X, Monitor, CheckCircle, Play, CheckSquare, UserCheck,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar, ResponsiveContainer,
} from 'recharts'
import { DndContext, DragOverlay, useDraggable, useDroppable, type DragEndEvent } from '@dnd-kit/core'
import { initialRadiologyExams, initialModalityDevices } from '../data/initialData'
import { examApi } from '../services/api'
import { t } from '../i18n/appI18n'
import { createActor } from 'xstate'
import { examMachine } from '../machines/examMachine'
import { POLL_INTERVAL_MS } from '../config/examStatusMapping'
import type { RadiologyExam, ExamStatus } from '../types'

import {
  FilterBar,
  BatchToolbar,
  QuickFilters,
  CheckInBar,
  ListView,
  CardView,
  KanbanView,
  DetailDrawer,
} from './worklist'
import type { FilterState, BatchState } from './worklist'
import { PageContainer } from '../components/common/PageContainer'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import BatchActionBar from '../components/batch/BatchActionBar'
import { AppButton } from '../components/common/AppButton'
import { useOperationLog } from '../hooks/useOperationLog'
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from '../hooks/useKeyboardShortcuts'

// ============================================================
// 类型定义
// ============================================================
type ViewMode = 'list' | 'card' | 'kanban'

interface CheckInState {
  barcodeInput: string
  lastScanned: string | null
  isProcessing: boolean
}

interface SLAInfo {
  elapsedMinutes: number
  status: 'normal' | 'warning' | 'critical'
  color: string
  label: string
}

const initialCheckIn: CheckInState = { barcodeInput: '', lastScanned: null, isProcessing: false }

// ============================================================
// examMachine 集成辅助
// ============================================================
const EXAM_STATUS_TO_MACHINE: Record<string, string> = {
  '已登记': 'registered',
  '待检查': 'arrived',
  '检查中': 'inProgress',
  '已暂停': 'paused',
  '待报告': 'pendingReport',
  '已报告': 'reported',
  '已发布': 'published',
  '已取消': 'cancelled',
  '已归档': 'archived',
  '质控退回': 'qcReject',
}

function replayExamActorTo(exam: RadiologyExam, targetEvent: { type: string; reason?: string; by: string; imagesAcquired?: number; technologistId?: string }) {
  const initial = EXAM_STATUS_TO_MACHINE[exam.status] ?? 'ordered'
  const actor = createActor(examMachine, {
    input: {
      examId: exam.id,
      patientId: exam.patientId,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      orderedBy: exam.technologistId ?? 'system',
    },
  })
  actor.start()
  const pathToCurrent: Array<{ type: string; [k: string]: unknown }> = []
  if (['arrived', 'inProgress', 'paused', 'completed', 'imageAvailable', 'pendingReport', 'reported', 'published', 'archived', 'cancelled', 'qcReject'].includes(initial)) {
    pathToCurrent.push({ type: 'APPROVE_ORDER', by: 'system' })
  }
  if (['arrived', 'inProgress', 'paused', 'completed', 'imageAvailable', 'pendingReport', 'reported', 'published', 'archived', 'cancelled'].includes(initial)) {
    pathToCurrent.push({ type: 'REGISTER', roomId: exam.roomId ?? 'R-?', deviceId: exam.deviceId ?? 'D-?', by: 'system' })
  }
  if (['inProgress', 'paused', 'completed', 'imageAvailable', 'pendingReport', 'reported', 'published', 'archived', 'cancelled'].includes(initial)) {
    pathToCurrent.push({ type: 'ARRIVE', by: 'system' })
    pathToCurrent.push({ type: 'START_EXAM', by: 'system', technologistId: exam.technologistId ?? 'system' })
  }
  if (['completed', 'imageAvailable', 'pendingReport', 'reported', 'published', 'archived'].includes(initial)) {
    pathToCurrent.push({ type: 'COMPLETE_EXAM', imagesAcquired: exam.imagesAcquired ?? 0, by: 'system' })
  }
  if (['imageAvailable', 'pendingReport', 'reported', 'published', 'archived'].includes(initial)) {
    pathToCurrent.push({ type: 'IMAGES_READY', imageCount: exam.imagesAcquired ?? 0, by: 'system' })
  }
  if (['pendingReport', 'reported', 'published', 'archived'].includes(initial)) {
    pathToCurrent.push({ type: 'QC_PASS', by: 'system' })
  }
  if (['reported', 'published', 'archived'].includes(initial)) {
    pathToCurrent.push({ type: 'MARK_REPORTED', by: 'system' })
  }
  if (['published', 'archived'].includes(initial)) {
    pathToCurrent.push({ type: 'PUBLISH', by: 'system' })
  }
  if (['archived'].includes(initial)) {
    pathToCurrent.push({ type: 'ARCHIVE', by: 'system' })
  }
  if (initial === 'paused') {
    pathToCurrent.push({ type: 'PAUSE_EXAM', reason: 'replay', by: 'system' })
  }
  if (initial === 'cancelled') {
    pathToCurrent.push({ type: 'CANCEL', reason: 'replay', by: 'system' })
  }
  for (const ev of pathToCurrent) actor.send(ev as never)
  actor.send(targetEvent as never)
  actor.stop()
}

// ============================================================
// SLA 辅助
// ============================================================
const getSLAInfo = (createdTime: string): SLAInfo => {
  try {
    const created = new Date(createdTime).getTime()
    const now = Date.now()
    const elapsedMinutes = Math.floor((now - created) / 60000)
    if (elapsedMinutes > 60) return { elapsedMinutes, status: 'critical', color: '#dc2626', label: '>60min' }
    if (elapsedMinutes > 30) return { elapsedMinutes, status: 'warning', color: '#d97706', label: '30-60min' }
    return { elapsedMinutes, status: 'normal', color: '#059669', label: '<30min' }
  } catch {
    return { elapsedMinutes: 0, status: 'normal', color: '#059669', label: '<30min' }
  }
}

const playSLASound = () => {
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    osc.type = 'sine'
    gain.gain.setValueAtTime(0.3, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5)
    osc.start(ctx.currentTime)
    osc.stop(ctx.currentTime + 0.5)
  } catch { /* Web Audio not available */ }
}

// ============================================================
// MiniSparkline
// ============================================================
const sparklineData = [
  { value: 10 }, { value: 15 }, { value: 8 }, { value: 12 },
  { value: 20 }, { value: 18 }, { value: 25 }, { value: 22 },
]

function MiniSparkline({ data, color }: { data?: { value: number }[]; color: string }) {
  const chartData = data || sparklineData
  return (
    <div style={{ width: 80, height: 30 }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#sparkGrad-${color.replace('#', '')})`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================
export default function WorklistPage() {
  const { log } = useOperationLog('worklist')

  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const [filters, setFilters] = useState<FilterState>({
    search: '',
    dateStart: '2026-05-01',
    dateEnd: '2026-05-01',
    modalities: [],
    patientTypes: [],
    priorities: [],
    statuses: [],
    doctorId: '',
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [exams, setExams] = useState<RadiologyExam[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    let timer: ReturnType<typeof setInterval> | null = null
    let inFlight: AbortController | null = null
    let isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'

    const fetchOnce = async () => {
      if (!mounted || isHidden) return
      inFlight = new AbortController()
      try {
        const res = await examApi.list({})
        if (!mounted || isHidden) return
        if (res.success && Array.isArray(res.data)) {
          setExams(res.data as unknown as RadiologyExam[])
          setLoadError(null)
        } else if (!mounted) {
          return
        } else {
          setExams((prev) => (prev.length === 0 ? initialRadiologyExams : prev))
          setLoadError(res.error?.message ?? 'API 不可用,使用本地数据')
        }
      } catch (err: unknown) {
        if (!mounted) return
        setLoadError(err instanceof Error ? err.message : '轮询失败')
      } finally {
        if (!mounted) {
          inFlight?.abort()
        } else {
          setLoading(false)
        }
        inFlight = null
      }
    }

    const startTimer = () => {
      if (timer) return
      if (isHidden) return
      timer = setInterval(() => { void fetchOnce() }, POLL_INTERVAL_MS)
    }

    const stopTimer = () => {
      if (timer) { clearInterval(timer); timer = null }
    }

    const onVisibilityChange = () => {
      isHidden = document.visibilityState === 'hidden'
      if (isHidden) {
        stopTimer()
        inFlight?.abort()
      } else {
        setLoading(false)
        void fetchOnce()
        startTimer()
      }
    }

    setLoading(true)
    void fetchOnce()
    startTimer()
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibilityChange)
    }

    return () => {
      mounted = false
      stopTimer()
      inFlight?.abort()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
  }, [])

  const [batch, setBatch] = useState<BatchState>({
    selectedIds: new Set(),
    operation: null,
    priorityValue: '普通',
    roomValue: '',
  })

  const [selectedExam, setSelectedExam] = useState<RadiologyExam | null>(null)

  const [patientInfoModalExam, setPatientInfoModalExam] = useState<RadiologyExam | null>(null)
  const [deviceSelectModalExam, setDeviceSelectModalExam] = useState<RadiologyExam | null>(null)
  const [reportModalExam, setReportModalExam] = useState<RadiologyExam | null>(null)
  const [confirmModalConfig, setConfirmModalConfig] = useState<{ open: boolean; title: string; message: string; onConfirm: () => void } | null>(null)
  const [batchResultModalData, setBatchResultModalData] = useState<{ open: boolean; action: string; count: number; results: string[] } | null>(null)
  const [printPreviewModalData, setPrintPreviewModalData] = useState<{ open: boolean; examIds: string[] } | null>(null)

  const [checkIn, setCheckIn] = useState<CheckInState>(initialCheckIn)

  // SLA uses Date.now() at render time, no timer needed for display freshness

  const [filterPresets, setFilterPresets] = useState<Array<{ name: string; filters: FilterState }>>(() => {
    try { return JSON.parse(localStorage.getItem('worklist-filter-presets') || '[]') }
    catch { return [] }
  })
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [savePresetName, setSavePresetName] = useState('')

  const applyPreset = useCallback((preset: { name: string; filters: FilterState }) => {
    setFilters(preset.filters)
  }, [])

  const saveCurrentPreset = useCallback(() => {
    if (!savePresetName.trim()) return
    const newPresets = [...filterPresets, { name: savePresetName.trim(), filters: { ...filters } }]
    setFilterPresets(newPresets)
    localStorage.setItem('worklist-filter-presets', JSON.stringify(newPresets))
    setSavePresetName('')
    setShowSavePreset(false)
  }, [savePresetName, filters, filterPresets])

  const deletePreset = useCallback((index: number) => {
    const newPresets = filterPresets.filter((_, i) => i !== index)
    setFilterPresets(newPresets)
    localStorage.setItem('worklist-filter-presets', JSON.stringify(newPresets))
  }, [filterPresets])

  const handleCheckIn = (barcode: string) => {
    setCheckIn({ barcodeInput: barcode, lastScanned: barcode, isProcessing: true })
    const matchedExam = exams.find(e => e.accessionNumber === barcode || e.id === barcode || e.patientId === barcode)
    if (matchedExam && ['已登记', '待检查'].includes(matchedExam.status)) {
      setTimeout(() => {
        setExams(prev => prev.map(e => e.id === matchedExam.id ? { ...e, status: '已报到' as ExamStatus } : e))
        setCheckIn(prev => ({ ...prev, isProcessing: false }))
      }, 800)
    } else {
      setTimeout(() => setCheckIn(prev => ({ ...prev, isProcessing: false })), 500)
    }
  }

  const handlePrintLabel = () => {
    if (selectedIds.size === 0) {
      setConfirmModalConfig({ open: true, title: '提示', message: '请先选择要打印标签的检查项目', onConfirm: () => setConfirmModalConfig(null) })
      return
    }
    setPrintPreviewModalData({ open: true, examIds: Array.from(selectedIds) })
  }

  const filtersKey = `${filters.search}|${filters.dateStart}|${filters.dateEnd}|${filters.modalities?.join(',')}|${filters.patientTypes?.join(',')}|${filters.priorities?.join(',')}|${filters.statuses?.join(',')}|${filters.doctorId ?? ''}`
  const filteredExams = useMemo(() => {
    return exams.filter(exam => {
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        const matchSearch =
          exam.patientName.toLowerCase().includes(searchLower) ||
          exam.accessionNumber.toLowerCase().includes(searchLower) ||
          exam.examItemName.toLowerCase().includes(searchLower)
        if (!matchSearch) return false
      }
      if (filters.dateStart && exam.examDate < filters.dateStart) return false
      if (filters.dateEnd && exam.examDate > filters.dateEnd) return false
      if (filters.modalities.length > 0 && !filters.modalities.includes(exam.modality)) return false
      if (filters.patientTypes.length > 0 && !filters.patientTypes.includes(exam.patientType)) return false
      if (filters.priorities.length > 0 && !filters.priorities.includes(exam.priority)) return false
      if (filters.statuses.length > 0 && !filters.statuses.includes(exam.status)) return false
      if (filters.doctorId && exam.technologistId !== filters.doctorId) return false
      return true
    })
  }, [exams, filtersKey])

  const slaCriticalExams = useMemo(() => filteredExams.filter(e => getSLAInfo(e.createdTime).status === 'critical'), [filteredExams])

  const prevCriticalCount = useRef(0)
  useEffect(() => {
    if (slaCriticalExams.length > prevCriticalCount.current && prevCriticalCount.current > 0) {
      playSLASound()
    }
    prevCriticalCount.current = slaCriticalExams.length
  }, [slaCriticalExams.length])

  const stats = useMemo(() => {
    return {
      total: filteredExams.length,
      critical: filteredExams.filter(e => e.priority === '危重' || e.priority === '紧急').length,
      completed: filteredExams.filter(e => ['已报告', '已发布'].includes(e.status)).length,
      pending: filteredExams.filter(e => ['已登记', '待检查', '检查中', '待报告'].includes(e.status)).length,
    }
  }, [filteredExams])

  const resetFilters = () => {
    setFilters({
      search: '',
      dateStart: '2026-05-01',
      dateEnd: '2026-05-01',
      modalities: [],
      patientTypes: [],
      priorities: [],
      statuses: [],
      doctorId: '',
    })
  }

  const allSelected = filteredExams.length > 0 && selectedIds.size === filteredExams.length

  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const executeBatchOperation = () => {
    if (selectedIds.size === 0) return
    const action = batch.operation || 'print'
    const actionLabels: Record<string, string> = {
      priority: `修改优先级为：${batch.priorityValue}`,
      room: `分配检查室：${initialModalityDevices.find(r => r.id === batch.roomValue)?.name || '-'}`,
      print: '打印条码',
      export: '导出Excel',
    }
    setBatchResultModalData({
      open: true,
      action: actionLabels[action] || action,
      count: selectedIds.size,
      results: [`已成功对 ${selectedIds.size} 项执行「${actionLabels[action] || action}」操作`]
    })
    clearSelection()
    setBatch({
      selectedIds: new Set(),
      operation: null,
      priorityValue: '普通',
      roomValue: '',
    })
  }

  const handleRefresh = () => {
    const btn = document.activeElement as HTMLButtonElement | null
    if (btn) {
      btn.style.opacity = '0.7'
      btn.disabled = true
      setTimeout(() => {
        btn.style.opacity = '1'
        btn.disabled = false
      }, 1000)
    }
  }

  const handlePrintSelected = () => {
    if (selectedIds.size === 0) {
      setConfirmModalConfig({
        open: true,
        title: '提示',
        message: '请先选择要打印的报告',
        onConfirm: () => setConfirmModalConfig(null)
      })
      return
    }
    setPrintPreviewModalData({
      open: true,
      examIds: Array.from(selectedIds)
    })
  }

  const ViewModeButton = ({ mode, icon, label }: { mode: ViewMode; icon: React.ReactNode; label: React.ReactNode }) => (
    <AppButton
      variant={viewMode === mode ? "primary" : "default"}
      size="compact"
      onClick={() => setViewMode(mode)}
      style={viewMode === mode ? undefined : { color: '#64748b' }}
    >
      {icon}
      {label}
    </AppButton>
  )

  const handleStartExam = useCallback((exam: RadiologyExam) => {
    setConfirmModalConfig({
      open: true,
      title: '开始检查',
      message: `确认开始检查 ${exam.patientName} 的 ${exam.examItemName}？`,
      onConfirm: () => {
        replayExamActorTo(exam, { type: 'START_EXAM', by: exam.technologistId ?? 'system', technologistId: exam.technologistId ?? 'system', imagesAcquired: 0 })
        setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: '检查中' as ExamStatus } : e))
        setConfirmModalConfig(null)
      }
    })
  }, [])

  const handleCancelExam = useCallback((exam: RadiologyExam) => {
    setConfirmModalConfig({
      open: true,
      title: '取消检查',
      message: `确认取消 ${exam.patientName} 的检查?该操作不可撤销。`,
      variant: 'danger',
      onConfirm: () => {
        replayExamActorTo(exam, { type: 'CANCEL', reason: '技师取消', by: exam.technologistId ?? 'system', imagesAcquired: 0 })
        setExams(prev => prev.map(e => e.id === exam.id ? { ...e, status: '已取消' as ExamStatus } : e))
        setConfirmModalConfig(null)
      }
    })
  }, [])

  // Log operations
  const logBatchAction = useCallback((action: string) => {
    const ids = Array.from(selectedIds)
    ids.forEach(id => log(action, id))
    clearSelection()
    setBatch({
      selectedIds: new Set(),
      operation: null,
      priorityValue: '普通',
      roomValue: '',
    })
  }, [selectedIds, log])

  // Enhanced batch operations
  const enhancedBatchActions = [
    { key: 'assign', label: '批量分配', icon: <UserCheck size={14} />, confirm: '确认分配?' },
    { key: 'start', label: '批量开始', icon: <Play size={14} />, confirm: '确认开始?' },
    { key: 'complete', label: '批量完成', icon: <CheckCircle size={14} />, confirm: '确认完成?' },
    { key: 'cancel', label: '批量取消', icon: <X size={14} />, confirm: '确认取消?' },
  ]

  // Keyboard shortcuts
  useKeyboardShortcuts([
    SHORTCUTS.REFRESH(() => handleRefresh()),
    SHORTCUTS.SUBMIT(() => {
      if (confirmModalConfig?.open) {
        confirmModalConfig.onConfirm()
        setConfirmModalConfig(null)
      }
    }),
    SHORTCUTS.CANCEL(() => {
      setConfirmModalConfig(null)
      setBatchResultModalData(null)
      setPrintPreviewModalData(null)
      setSelectedExam(null)
    }),
  ])
  useNavigationShortcuts([
    { sequence: ['g', 'w'], action: () => { window.location.href = '/worklist' }, description: '导航到工作列表' },
    { sequence: ['g', 'e'], action: () => { window.location.href = '/exam' }, description: '导航到检查' },
    { sequence: ['g', 'r'], action: () => { window.location.href = '/reports' }, description: '导航到报告' },
  ])

  return (
    <PageContainer
      background="slate"
      maxWidth="full"
      fabPadding
      testId="worklist-page"
    >
      {loading && <LoadingBanner message={t('worklist.loadingApi')} />}
      {loadError && !loading && (
        <ErrorBanner message={`${loadError} (已 fallback 到本地 initialData)`} />
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
        <div>
          <h1 style={{
            fontSize: 22,
            fontWeight: 800,
            color: '#1e3a5f',
            margin: '0 0 6px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <ClipboardList size={24} />
            检查工作列表
          </h1>
          <p style={{
            fontSize: 13,
            color: '#64748b',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span>DICOM Worklist</span>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span>融合HIS/PAACS预约数据</span>
            <span style={{ color: '#cbd5e1' }}>·</span>
            <span>实时设备状态</span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: '#ecfdf5',
            borderRadius: 8,
            fontSize: 12,
            color: '#059669',
            fontWeight: 500,
            border: '1px solid #d1fae5',
          }}>
            <Wifi size={12} />
            DICOM WL 已连接
          </div>

          <div style={{
            display: 'flex',
            background: '#fff',
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}>
            <ViewModeButton mode="list" icon={<LayoutList size={14} />} label="列表" />
            <ViewModeButton mode="card" icon={<LayoutGrid size={14} />} label="卡片" />
            <ViewModeButton mode="kanban" icon={<Kanban size={14} />} label="看板" />
          </div>

          <AppButton
            variant="primary"
            size="compact"
            onClick={handleRefresh}
            icon={<RefreshCw size={12} />}
          >
            刷新列表
          </AppButton>
        </div>
      </div>

      <CheckInBar
        onCheckIn={handleCheckIn}
        onPrintLabel={handlePrintLabel}
        lastScanned={checkIn.lastScanned}
        isProcessing={checkIn.isProcessing}
      />

      <div style={{ marginBottom: 16 }}>
        <QuickFilters currentFilters={filters} onApply={(partial) => setFilters(f => ({ ...f, ...partial }))} />
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        marginBottom: 20,
      }}>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: [] }))}
          style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: [] }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1e3a5f', lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>全部检查</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                等待中: {exams.filter(e => e.status === '已登记' || e.status === '待检查').length}
              </div>
            </div>
            <MiniSparkline color="#3b82f6" />
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, priorities: ['危重', '紧急'] }))}
          style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, priorities: ['危重', '紧急'] }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{stats.critical}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>危重/紧急</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                SLA超期: {slaCriticalExams.length}
              </div>
            </div>
            <div style={{ width: 80, height: 30 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[{ v: stats.critical }, { v: Math.max(stats.critical - 2, 0) }, { v: stats.critical + 1 }]}>
                  <Bar dataKey="v" fill="#dc2626" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: ['已登记', '待检查', '检查中', '待报告'] }))}
          style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: ['已登记', '待检查', '检查中', '待报告'] }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{stats.pending}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>待完成</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                平均等待: {filteredExams.length > 0 ? Math.round(filteredExams.reduce((s, e) => {
                  const t = e.createdTime ? new Date(e.createdTime).getTime() : 0;
                  return t > 0 ? s + (Date.now() - t) / 60000 : s
                }, 0) / filteredExams.length) : 0}min
              </div>
            </div>
            <MiniSparkline color="#d97706" />
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: ['已报告', '已发布'] }))}
          style={{
          background: '#fff', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: ['已报告', '已发布'] }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', lineHeight: 1 }}>{stats.completed}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>已完成</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                设备使用中: {exams.filter(e => e.status === '检查中').length}台
              </div>
            </div>
            <MiniSparkline color="#059669" />
          </div>
        </div>
      </div>

      <BatchToolbar
        batch={batch}
        onChange={setBatch}
        onClear={clearSelection}
        onExecute={executeBatchOperation}
        totalSelected={selectedIds.size}
      />

      <BatchActionBar
        selectedCount={selectedIds.size}
        onAction={logBatchAction}
        onClear={clearSelection}
        actions={enhancedBatchActions}
      />

      <FilterBar
        filters={filters}
        onChange={setFilters}
        onReset={resetFilters}
        presets={filterPresets}
        onApplyPreset={applyPreset}
        onSavePreset={saveCurrentPreset}
        onDeletePreset={deletePreset}
        showSavePreset={showSavePreset}
        savePresetName={savePresetName}
        onSavePresetNameChange={setSavePresetName}
      />

      {viewMode === 'list' && (
        <ListView
          exams={filteredExams}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onRowClick={setSelectedExam}
          allSelected={allSelected}
        />
      )}

      {viewMode === 'card' && (
        <CardView
          exams={filteredExams}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onRowClick={setSelectedExam}
        />
      )}

      {viewMode === 'kanban' && (
        <DndContext onDragEnd={(event: DragEndEvent) => {
          const examId = String(event.active.id)
          const targetStatus = String(event.over?.id || '')
          if (targetStatus && examId) {
            setExams(prev => prev.map(e => e.id === examId ? { ...e, status: targetStatus as ExamStatus } : e))
            log('drag_status_change', examId, { from: event.active.id, to: targetStatus })
          }
        }}>
          <KanbanView
            exams={filteredExams}
            onRowClick={setSelectedExam}
          />
          <DragOverlay />
        </DndContext>
      )}

      <DetailDrawer
        exam={selectedExam}
        onClose={() => setSelectedExam(null)}
        onEditInfo={(exam) => setPatientInfoModalExam(exam)}
        onAssignDevice={(exam) => setDeviceSelectModalExam(exam)}
        onWriteReport={(exam) => setReportModalExam(exam)}
        onStartExam={handleStartExam}
        onCancelExam={handleCancelExam}
      />

      <div style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        zIndex: 50,
      }}>
        <AppButton
          variant="default"
          size="compact"
          onClick={handlePrintSelected}
          style={{ width: 48, height: 48, borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
          title="打印选中的报告"
        >
          <Printer size={20} />
        </AppButton>

        <button
          onClick={handleRefresh}
          style={{
            width: 48, height: 48, borderRadius: 12, background: '#1e3a5f',
            border: 'none', boxShadow: '0 4px 12px rgba(30,58,95,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2d4a6f'; e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1e3a5f'; e.currentTarget.style.transform = 'scale(1)' }}
          title="刷新数据"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      <div style={{
        marginTop: 20, padding: '12px 0', textAlign: 'center',
        fontSize: 12, color: '#94a3b8', borderTop: '1px solid #e2e8f0',
      }}>
        G005 放射科RIS系统 · 检查工作列表 · {new Date().toLocaleDateString('zh-CN')}
      </div>

      {patientInfoModalExam && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setPatientInfoModalExam(null)}
          onClick={() => setPatientInfoModalExam(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>修改患者信息</h3>
              <button onClick={() => setPatientInfoModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><span style={{ color: '#64748b' }}>患者姓名：</span><input defaultValue={patientInfoModalExam.patientName} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: '#64748b' }}>性别：</span><input defaultValue={patientInfoModalExam.gender} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: '#64748b' }}>年龄：</span><input defaultValue={patientInfoModalExam.age} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: '#64748b' }}>患者类型：</span><input defaultValue={patientInfoModalExam.patientType} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setPatientInfoModalExam(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>取消</button>
              <button onClick={() => setPatientInfoModalExam(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e3a5f', color: '#fff', cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {deviceSelectModalExam && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setDeviceSelectModalExam(null)}
          onClick={() => setDeviceSelectModalExam(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 400, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>分配检查设备</h3>
              <button onClick={() => setDeviceSelectModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, color: '#64748b', fontSize: 13 }}>当前检查：{deviceSelectModalExam.examItemName}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {initialModalityDevices.filter(d => d.modality === deviceSelectModalExam.modality).map(device => (
                <div
                  key={device.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setDeviceSelectModalExam(null)}
                  style={{
                  padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8
                }} onClick={() => setDeviceSelectModalExam(null)}>
                  <Monitor size={16} style={{ color: '#1e3a5f' }} />
                  <span style={{ fontSize: 13 }}>{device.name}</span>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{device.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportModalExam && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setReportModalExam(null)}
          onClick={() => setReportModalExam(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>
                {reportModalExam.status === '待报告' ? '书写报告' : '查看报告'}
              </h3>
              <button onClick={() => setReportModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><span style={{ color: '#64748b' }}>患者：</span>{reportModalExam.patientName}（{reportModalExam.gender}，{reportModalExam.age}岁）</div>
              <div><span style={{ color: '#64748b' }}>检查项目：</span>{reportModalExam.examItemName}</div>
              <div><span style={{ color: '#64748b' }}>临床诊断：</span>{reportModalExam.clinicalDiagnosis}</div>
              <div><span style={{ color: '#64748b' }}>检查所见：</span><textarea style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%', height: 80 }} placeholder="请输入检查所见..." /></div>
              <div><span style={{ color: '#64748b' }}>诊断意见：</span><textarea style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%', height: 60 }} placeholder="请输入诊断意见..." /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setReportModalExam(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>取消</button>
              <button onClick={() => setReportModalExam(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e3a5f', color: '#fff', cursor: 'pointer' }}>提交报告</button>
            </div>
          </div>
        </div>
      )}

      {confirmModalConfig?.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, width: 400 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>{confirmModalConfig.title}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#334155' }}>{confirmModalConfig.message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModalConfig(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>取消</button>
              <button onClick={confirmModalConfig.onConfirm} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#dc2626', color: '#fff', cursor: 'pointer' }}>确认</button>
            </div>
          </div>
        </div>
      )}

      {batchResultModalData?.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setBatchResultModalData(null)}
          onClick={() => setBatchResultModalData(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 480
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>批量操作结果</h3>
              <button onClick={() => setBatchResultModalData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <CheckCircle size={20} style={{ color: '#22c55e', marginBottom: 8 }} />
              <div style={{ fontSize: 14, color: '#166534' }}>操作成功</div>
              <div style={{ fontSize: 13, color: '#15803d', marginTop: 4 }}>{batchResultModalData.results[0]}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setBatchResultModalData(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e3a5f', color: '#fff', cursor: 'pointer' }}>确定</button>
            </div>
          </div>
        </div>
      )}

      {printPreviewModalData?.open && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setPrintPreviewModalData(null)}
          onClick={() => setPrintPreviewModalData(null)}>
          <div style={{
            background: '#fff', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e3a5f' }}>打印预览</h3>
              <button onClick={() => setPrintPreviewModalData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#64748b' }}>
              即将打印 {printPreviewModalData.examIds.length} 份报告
            </div>
            <div style={{ background: '#f8fafc', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>打印内容预览</div>
              <div style={{ fontSize: 13, color: '#334155' }}>
                报告列表：{printPreviewModalData.examIds.join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPrintPreviewModalData(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>取消</button>
              <button onClick={() => { window.print(); setPrintPreviewModalData(null) }} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e3a5f', color: '#fff', cursor: 'pointer' }}>打印</button>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  )
}
