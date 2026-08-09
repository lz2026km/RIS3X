import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useFocusTrap } from '../a11y/SkipLink'
import {
  ClipboardList, Wifi, LayoutList, LayoutGrid, Kanban, RefreshCw,
  Printer, X, Monitor, CheckCircle, Play, UserCheck, Stethoscope,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
} from 'recharts'
import { DndContext, DragOverlay, type DragEndEvent } from '@dnd-kit/core'
import { initialRadiologyExams, initialModalityDevices, initialExamRooms, initialUsers } from '../data/initialData'
import { api, examApi, patientApi, reportApi, worklistApi, userApi } from '../services/api'
import { ChartContainer } from '../components/charts'
import { invalidateApiCacheByPrefix } from '../services/api/client'
import { realtime } from '../services/realtime'
import { t } from '../i18n/appI18n'
import { createActor } from 'xstate'
import { examMachine } from '../machines/examMachine'
import { POLL_INTERVAL_MS } from '../config/examStatusMapping'
import type { RadiologyExam, ExamStatus } from '../types'
import type { ExamDto, ReportDto, UserDto } from '../types/dto'
import { worklistSmartApi } from '../services/api/worklistSmartApi'
import {
  displayExamStatus,
  normalizeExamStatus,
  EXAM_STATUS_TO_CN,
} from '../utils/statusMaps'

import {
  FilterBar,
  BatchToolbar,
  QuickFilters,
  CheckInBar,
  ListView,
  CardView,
  KanbanView,
  DetailDrawer,
  RequisitionDrawer,
} from './worklist'
import type { FilterState, BatchState } from './worklist'
import { PageContainer } from '../components/common/PageContainer'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import BatchActionBar from '../components/batch/BatchActionBar'
import { AppButton } from '../components/common/AppButton'
import { useOperationLog } from '../hooks/useOperationLog'
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from '../hooks/useKeyboardShortcuts'
import { SmartSortPanel } from '../components/worklist/SmartSortPanel'
import { SortCompareModal } from '../components/worklist/SortCompareModal'

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
// 数据适配: 后端 Exam / mock 记录 → RadiologyExam
// 状态统一归一化为英文规范值 (SCHEDULED/ARRIVED/IN_PROGRESS/COMPLETED/CANCELLED)
// ============================================================
function toRadiologyExam(item: Record<string, unknown>): RadiologyExam {
  const patient = (item.patient ?? {}) as Record<string, unknown>
  const device = (item.device ?? {}) as Record<string, unknown>
  const rawStatus = String(item.state ?? item.status ?? 'SCHEDULED')
  const createdAt = String(item.createdAt ?? item.createdTime ?? item.examAt ?? new Date().toISOString())
  return {
    id: String(item.id ?? item.reportId ?? item.examId ?? ''),
    patientId: String(item.patientId ?? patient.id ?? ''),
    patientName: String(patient.name ?? patient.patientName ?? item.patientName ?? '未知患者'),
    gender: (patient.gender ?? item.gender ?? '其他') as RadiologyExam['gender'],
    age: Number(patient.age ?? item.patientAge ?? item.age ?? 0),
    patientType: (item.patientType ?? patient.patientType ?? '门诊') as RadiologyExam['patientType'],
    examItemId: String(item.examItemId ?? item.examItemCode ?? ''),
    examItemName: String(item.examItem ?? item.examItemName ?? item.examName ?? item.accessionNumber ?? '检查'),
    modality: (item.modality ?? 'CT') as RadiologyExam['modality'],
    bodyPart: (item.bodyPart ?? '胸部') as RadiologyExam['bodyPart'],
    examDate: String(item.scheduledAt ?? item.examAt ?? item.examDate ?? ''),
    examTime: item.examTime ? String(item.examTime) : undefined,
    scheduledTime: item.scheduledTime ? String(item.scheduledTime) : undefined,
    priority: (item.priority ?? '普通') as RadiologyExam['priority'],
    clinicalDiagnosis: item.clinicalDiagnosis ? String(item.clinicalDiagnosis) : undefined,
    technologistId: item.technicianId || item.technologistId ? String(item.technicianId ?? item.technologistId) : undefined,
    radiologistId: item.reportDoctorId || item.radiologistId ? String(item.reportDoctorId ?? item.radiologistId) : undefined,
    radiologistName: item.reportDoctorName || item.radiologistName ? String(item.reportDoctorName ?? item.radiologistName) : undefined,
    referringDoctorId: item.referringDoctorId ? String(item.referringDoctorId) : undefined,
    referringDoctorName: item.referringDoctorName ?? item.referringPhysician ? String(item.referringDoctorName ?? item.referringPhysician) : undefined,
    referringDoctorDept: item.referringDoctorDept ? String(item.referringDoctorDept) : undefined,
    thumbnailUrl: item.thumbnailUrl ?? item.thumbnail ?? item.thumbUrl ? String(item.thumbnailUrl ?? item.thumbnail ?? item.thumbUrl) : undefined,
    deviceId: item.deviceId ? String(item.deviceId) : undefined,
    deviceName: device.name ? String(device.name) : item.deviceName ? String(item.deviceName) : undefined,
    roomId: item.roomId ? String(item.roomId) : undefined,
    status: normalizeExamStatus(rawStatus) as ExamStatus,
    imagesAcquired: Number(item.imageCount ?? item.imagesAcquired ?? 0),
    accessionNumber: String(item.accessionNumber ?? ''),
    criticalFinding: Boolean(item.hasCriticalValue ?? item.criticalFinding ?? false),
    createdTime: createdAt,
    updatedTime: String(item.updatedAt ?? item.updatedTime ?? ''),
  }
}

function extractExamItems(raw: unknown): unknown[] | null {
  if (Array.isArray(raw)) return raw
  if (raw && typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (Array.isArray(obj.items)) return obj.items
    if (Array.isArray(obj.data)) return obj.data
    if (Array.isArray(obj.records)) return obj.records
  }
  return null
}

// ============================================================
// examMachine 集成辅助
// ============================================================
const EXAM_STATUS_TO_MACHINE: Record<string, string> = {
  'SCHEDULED': 'registered',
  'ARRIVED': 'arrived',
  'IN_PROGRESS': 'inProgress',
  'COMPLETED': 'completed',
  'CANCELLED': 'cancelled',
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
      <ChartContainer height={30} state={chartData.length === 0 ? 'empty' : 'ready'} emptyDescription="">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id={`sparkGrad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} fill={`url(#sparkGrad-${color.replace('#', '')})`} strokeWidth={1.5} dot={false} />
        </AreaChart>
      </ChartContainer>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================
export default function WorklistPage() {
  const { log } = useOperationLog('worklist')

  const [viewMode, setViewMode] = useState<ViewMode>('list')

  const [filters, setFilters] = useState<FilterState>(() => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
    return {
      search: '',
      dateStart: sevenDaysAgo.toISOString().split('T')[0] ?? '',
      dateEnd: today.toISOString().split('T')[0] ?? '',
      modalities: [],
      patientTypes: [],
      priorities: [],
      statuses: [],
      doctorId: '',
    };
  })

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const [exams, setExams] = useState<RadiologyExam[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [smartSortEnabled, setSmartSortEnabled] = useState(false)
  const [smartExplanations, setSmartExplanations] = useState<Array<{ id: string; text: string; score: number }>>([])
  const [showSortCompare, setShowSortCompare] = useState(false)
  const [sortCompareItems, setSortCompareItems] = useState<Array<{ exam: RadiologyExam; beforeRank: number; afterRank: number; score?: number; reasons?: string[] }>>([])

  // ============================================================
  // 数据加载: examApi.list(后端 /exams) 为主, mock /worklist 兜底,
  // 本地 initialData 最后兜底; 状态统一归一化为英文规范值
  // ============================================================
  const mountedRef = useRef(true)

  const fetchExams = useCallback(async (): Promise<RadiologyExam[]> => {
    const res = await examApi.list({})
    if (!mountedRef.current) return []
    const raw = res.data as unknown
    const items = extractExamItems(raw)
    if (res.success && items !== null) {
      return items.map(item => toRadiologyExam((item ?? {}) as Record<string, unknown>))
    }
    // mock 兜底: mock 后端无 /exams, 分页拉取 /worklist (MAX_PAGE_SIZE=200)
    const collected: unknown[] = []
    let total = Infinity
    for (let page = 1; page <= 6 && collected.length < total; page += 1) {
      if (!mountedRef.current) break
      const wl = await worklistApi.list({ page: page, pageSize: 200 })
      const wlRaw = wl.data as unknown
      const wlItems = extractExamItems(wlRaw)
      if (!wl.success || wlItems === null) break
      collected.push(...wlItems)
      if (wlRaw && typeof wlRaw === 'object') {
        const meta = (wlRaw as { meta?: { total?: number } }).meta
        if (typeof meta?.total === 'number') total = meta.total
      }
    }
    if (collected.length > 0) {
      return collected.map(item => toRadiologyExam((item ?? {}) as Record<string, unknown>))
    }
    return initialRadiologyExams.map(e => ({ ...e, status: normalizeExamStatus(e.status) as ExamStatus }))
  }, [])

  const fetchOnce = useCallback(async () => {
    if (!mountedRef.current) return
    try {
      const list = await fetchExams()
      if (!mountedRef.current) return
      setExams(list)
      setLoadError(null)
      setLoading(false)
    } catch (err: unknown) {
      if (!mountedRef.current) return
      setLoadError(err instanceof Error ? err.message : '轮询失败')
      setLoading(false)
    }
  }, [fetchExams])

  useEffect(() => {
    mountedRef.current = true
    let timer: ReturnType<typeof setInterval> | null = null
    let isHidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'

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
      mountedRef.current = false
      stopTimer()
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibilityChange)
      }
    }
  }, [fetchOnce])

  const [batch, setBatch] = useState<BatchState>({
    selectedIds: new Set(),
    operation: null,
    priorityValue: '普通',
    roomValue: '',
  })

  // [W2-1] 报告医生/技师候选列表: 优先 userApi.list(后端 /users), 失败回退本地 initialUsers
  useEffect(() => {
    let cancelled = false
    setDoctorOptionsLoading(true)
    const fallback = () => {
      if (cancelled) return
      setDoctorOptions(
        initialUsers
          .filter(u => u.role === 'radiologist' || u.role === '医生')
          .map(u => ({ id: u.id, name: u.name, title: u.title ?? '' }))
      )
    }
    userApi.list(0, 100).then(res => {
      if (cancelled) return
      const raw = res.data as unknown
      const items = Array.isArray(raw)
        ? raw
        : ((raw as { items?: unknown[] } | null)?.items ?? [])
      if (res.success && items.length > 0) {
        setDoctorOptions(
          (items as UserDto[]).map(u => ({
            id: u.id,
            name: u.fullName ?? u.id,
            title: String(u.role ?? ''),
          }))
        )
      } else {
        fallback()
      }
    }).catch(fallback).finally(() => {
      if (!cancelled) setDoctorOptionsLoading(false)
    })
    return () => { cancelled = true }
  }, [])

  const [selectedExam, setSelectedExam] = useState<RadiologyExam | null>(null)
  const [historyDrawerTab, setHistoryDrawerTab] = useState<'info' | 'images' | 'history' | 'log'>('info')

  const [patientInfoModalExam, setPatientInfoModalExam] = useState<RadiologyExam | null>(null)
  const [patientForm, setPatientForm] = useState<{ name: string; gender: string; age: string; patientType: string } | null>(null)
  const [deviceSelectModalExam, setDeviceSelectModalExam] = useState<RadiologyExam | null>(null)
  const [doctorSelectModalExam, setDoctorSelectModalExam] = useState<RadiologyExam | null>(null)
  const [doctorOptions, setDoctorOptions] = useState<Array<{ id: string; name: string; title: string }>>([])
  const [doctorOptionsLoading, setDoctorOptionsLoading] = useState(false)
  const [requisitionExam, setRequisitionExam] = useState<RadiologyExam | null>(null)
  const [reportModalExam, setReportModalExam] = useState<RadiologyExam | null>(null)
  const [reportForm, setReportForm] = useState<{ findings: string; conclusion: string } | null>(null)
  const [confirmModalConfig, setConfirmModalConfig] = useState<{ open: boolean; title: string; message: string; variant?: 'danger'; onConfirm: () => void } | null>(null)
  const [batchResultModalData, setBatchResultModalData] = useState<{ open: boolean; action: string; count: number; results: string[] } | null>(null)
  const [printPreviewModalData, setPrintPreviewModalData] = useState<{ open: boolean; examIds: string[] } | null>(null)

  const [checkIn, setCheckIn] = useState<CheckInState>(initialCheckIn)

  // [W1-B] 工作量/状态分布: GET /worklist/stats (worklistApi.getStats)
  const [serverStats, setServerStats] = useState<{ total: number; byStatus: Record<string, number> } | null>(null)
  const fetchServerStats = useCallback(async () => {
    try {
      const res = await worklistApi.getStats()
      if (res.success && res.data) {
        setServerStats({ total: Number(res.data.total ?? 0), byStatus: res.data.byStatus ?? {} })
      }
    } catch { /* 统计不可用不阻断 */ }
  }, [])
  useEffect(() => { void fetchServerStats() }, [fetchServerStats])

  const [filterPresets, setFilterPresets] = useState<Array<{ name: string; filters: FilterState }>>(() => {
    try { return JSON.parse(localStorage.getItem('worklist-filter-presets') || '[]') }
    catch { return [] }
  })
  const [showSavePreset, setShowSavePreset] = useState(false)
  const [savePresetName, setSavePresetName] = useState('')

  const patientInfoFocusRef = useFocusTrap(!!patientInfoModalExam);
  const deviceSelectFocusRef = useFocusTrap(!!deviceSelectModalExam);
  const doctorSelectFocusRef = useFocusTrap(!!doctorSelectModalExam);
  const reportFocusRef = useFocusTrap(!!reportModalExam);
  const confirmFocusRef = useFocusTrap(!!confirmModalConfig?.open);
  const batchResultFocusRef = useFocusTrap(!!batchResultModalData?.open);
  const printPreviewFocusRef = useFocusTrap(!!printPreviewModalData?.open);

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

  // ============================================================
  // 真实操作: 签到 / 开始 / 完成 / 取消 (后端 POST /worklist/:id/*)
  // ============================================================
  const refreshAfterMutation = useCallback(async () => {
    await invalidateApiCacheByPrefix('/worklist')
    await invalidateApiCacheByPrefix('/exams')
    void fetchOnce()
  }, [fetchOnce])

  // [W4-2] 实时推送: 其他端 (签到/开始/完成/危急值/报告状态) 变化时自动刷新; 轮询保留兜底
  useEffect(() => {
    realtime.connect()
    const offRefresh = realtime.subscribe('worklist-refresh', () => {
      void refreshAfterMutation()
    })
    return () => {
      offRefresh()
    }
  }, [refreshAfterMutation])

  const handleCheckIn = async (barcode: string) => {
    setCheckIn({ barcodeInput: barcode, lastScanned: barcode, isProcessing: true })
    try {
      const matchedExam = exams.find(e => e.accessionNumber === barcode || e.id === barcode || e.patientId === barcode)
      if (!matchedExam) {
        setCheckIn(prev => ({ ...prev, isProcessing: false }))
        return
      }
      if (!['SCHEDULED', 'ARRIVED'].includes(normalizeExamStatus(matchedExam.status))) {
        setCheckIn(prev => ({ ...prev, isProcessing: false }))
        setConfirmModalConfig({
          open: true,
          title: '签到失败',
          message: `检查 ${matchedExam.accessionNumber || matchedExam.id} 当前状态为「${displayExamStatus(matchedExam.status)}」，无法签到`,
          onConfirm: () => setConfirmModalConfig(null),
        })
        return
      }
      const res = await examApi.checkIn(matchedExam.id)
      if (res.success) {
        setExams(prev => prev.map(e => e.id === matchedExam.id ? { ...e, status: 'ARRIVED' as ExamStatus } : e))
        log('checkin', matchedExam.id)
        void refreshAfterMutation()
      } else {
        setConfirmModalConfig({
          open: true,
          title: '签到失败',
          message: res.error?.message ?? '签到失败，请稍后重试',
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: '签到失败',
        message: err instanceof Error ? err.message : '签到失败，请稍后重试',
        onConfirm: () => setConfirmModalConfig(null),
      })
    } finally {
      setCheckIn(prev => ({ ...prev, isProcessing: false }))
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
      if (filters.statuses.length > 0 && !filters.statuses.includes(normalizeExamStatus(exam.status))) return false
      if (filters.doctorId && exam.technologistId !== filters.doctorId) return false
      return true
    })
  }, [exams, filtersKey])

  const computeSmartScoreInput = useCallback((exam: RadiologyExam) => {
    const waitMs = exam.createdTime ? Date.now() - new Date(exam.createdTime).getTime() : 0
    const waitingMinutes = Math.max(0, Math.floor(waitMs / 60000))
    const urgencyMap: Record<string, number> = { '危重': 3, '紧急': 2, '会诊': 1, '普通': 0 }
    const urgency = urgencyMap[exam.priority] ?? 0
    const age = typeof exam.age === 'number' ? exam.age : (exam.age ? parseInt(String(exam.age), 10) || 0 : 0)
    return {
      id: exam.id,
      urgency,
      waitingMinutes,
      age,
      modality: exam.modality,
      bodyPart: exam.bodyPart,
      patientType: exam.patientType,
      priority: exam.priority,
      criticalFinding: exam.criticalFinding ?? false,
    }
  }, [])

  const [smartSortedIds, setSmartSortedIds] = useState<string[] | null>(null)

  useEffect(() => {
    if (!smartSortEnabled || filteredExams.length === 0) {
      setSmartSortedIds(null)
      return
    }
    let cancelled = false
    const inputs = filteredExams.map(computeSmartScoreInput)
    worklistSmartApi.reorder(inputs).then(res => {
      if (cancelled) return
      if (res.success && Array.isArray(res.data)) {
        setSmartSortedIds(res.data.map((r: { id: string }) => r.id))
        const explanations = res.data.slice(0, 20).map((r: { id: string; score: number; reasons: string[] }) => ({
          id: r.id,
          text: `${filteredExams.find(e => e.id === r.id)?.patientName ?? ''} ${filteredExams.find(e => e.id === r.id)?.examItemName ?? ''} → ${r.reasons.join('、') || ''}`,
          score: r.score,
        }))
        setSmartExplanations(explanations)
      } else {
        setSmartSortedIds(null)
      }
    }).catch(() => { if (!cancelled) setSmartSortedIds(null) })
    return () => { cancelled = true }
  }, [filteredExams, smartSortEnabled, computeSmartScoreInput])

  const smartOrderedExams = useMemo(() => {
    if (!smartSortEnabled || !smartSortedIds) return filteredExams
    const idOrder = new Map(smartSortedIds.map((id, idx) => [id, idx]))
    return [...filteredExams].sort((a, b) => (idOrder.get(a.id) ?? 9999) - (idOrder.get(b.id) ?? 9999))
  }, [filteredExams, smartSortEnabled, smartSortedIds])

  const handleToggleSmartSort = useCallback((enabled: boolean) => {
    setSmartSortEnabled(enabled)
    if (enabled && filteredExams.length > 0) {
      const inputs = filteredExams.map(computeSmartScoreInput)
      worklistSmartApi.reorder(inputs).then(res => {
        if (res.success && Array.isArray(res.data)) {
          const items = res.data.map((r: { id: string; score: number; rank: number; beforeRank: number }) => {
            const exam = filteredExams.find(e => e.id === r.id)!
            return { exam, beforeRank: r.beforeRank, afterRank: r.rank, score: r.score }
          })
          setSortCompareItems(items)
        }
      }).catch(() => { /* ignore */ })
    }
  }, [filteredExams, computeSmartScoreInput])

  const slaCriticalExams = useMemo(() => filteredExams.filter(e => getSLAInfo(e.createdTime).status === 'critical'), [filteredExams])

  const prevCriticalCount = useRef(0)
  useEffect(() => {
    if (slaCriticalExams.length > prevCriticalCount.current && prevCriticalCount.current > 0) {
      playSLASound()
    }
    prevCriticalCount.current = slaCriticalExams.length
  }, [slaCriticalExams.length])

  // 统计卡: 全量数据 + EXAM_STATUS_MAP 英文值统计
  const stats = useMemo(() => {
    const statusOf = (e: RadiologyExam) => normalizeExamStatus(e.status)
    return {
      total: exams.length,
      critical: exams.filter(e => e.priority === '危重' || e.priority === '紧急').length,
      waiting: exams.filter(e => statusOf(e) === 'SCHEDULED' || statusOf(e) === 'ARRIVED').length,
      inProgress: exams.filter(e => statusOf(e) === 'IN_PROGRESS').length,
      completed: exams.filter(e => statusOf(e) === 'COMPLETED').length,
      pending: exams.filter(e => ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'].includes(statusOf(e))).length,
    }
  }, [exams])

  const resetFilters = () => {
    const today = new Date();
    const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
    setFilters({
      search: '',
      dateStart: sevenDaysAgo.toISOString().split('T')[0] ?? '',
      dateEnd: today.toISOString().split('T')[0] ?? '',
      modalities: [],
      patientTypes: [],
      priorities: [],
      statuses: [],
      doctorId: '',
    })
  }


  const clearSelection = () => {
    setSelectedIds(new Set())
  }

  const resetBatchSelection = () => {
    clearSelection()
    setBatch({
      selectedIds: new Set(),
      operation: null,
      priorityValue: '普通',
      roomValue: '',
    })
  }

  // ============================================================
  // 批量操作 (改优先级/分配检查室) → 真实后端调用 + 列表刷新
  //   - priority: 逐条 PATCH /worklist/:id { priority }
  //   - room:     POST /worklist/batch-assign { ids, roomId }
  //   - print/export: 保留原前端行为 (打印预览 / 模拟导出)
  // ============================================================
  const executeBatchOperation = async () => {
    if (selectedIds.size === 0) return
    const action = batch.operation || 'print'
    const ids = Array.from(selectedIds)
    const actionLabels: Record<string, string> = {
      priority: `修改优先级为：${batch.priorityValue}`,
      room: `分配检查室：${initialExamRooms.find(r => r.id === batch.roomValue)?.name || '-'}`,
      print: '打印条码',
      export: '导出Excel',
    }

    if (action === 'print') {
      setPrintPreviewModalData({ open: true, examIds: ids })
      resetBatchSelection()
      return
    }
    if (action === 'export') {
      setBatchResultModalData({
        open: true,
        action: actionLabels[action] || action,
        count: ids.length,
        results: [`已对 ${ids.length} 项执行「${actionLabels[action] || action}」操作`],
      })
      resetBatchSelection()
      return
    }

    // 真实批量操作 (priority / room)
    const results: string[] = []
    let okCount = 0
    let failCount = 0
    try {
      if (action === 'room') {
        const res = await worklistApi.batchAssign(ids, { roomId: batch.roomValue })
        if (res.success) {
          okCount = Number((res.data as { updated?: number } | null)?.updated ?? ids.length)
          results.push(`检查室已批量分配`)
          ids.forEach(id => log('batch_assign_room', id, { roomId: batch.roomValue }))
        } else {
          failCount = ids.length
          results.push(res.error?.message ?? '批量分配检查室失败')
        }
      } else {
        for (const id of ids) {
          try {
            const res = await worklistApi.updatePriority(id, batch.priorityValue)
            if (res.success) {
              okCount += 1
              log('batch_update_priority', id, { priority: batch.priorityValue })
            } else {
              failCount += 1
              results.push(`${id}: ${res.error?.message ?? '失败'}`)
            }
          } catch (err) {
            failCount += 1
            results.push(`${id}: ${err instanceof Error ? err.message : '失败'}`)
          }
        }
      }
    } catch (err) {
      failCount = ids.length
      results.push(err instanceof Error ? err.message : '批量操作失败')
    }

    await refreshAfterMutation()
    setBatchResultModalData({
      open: true,
      action: actionLabels[action] || action,
      count: ids.length,
      results: [
        `成功 ${okCount} 项${failCount > 0 ? `，失败 ${failCount} 项` : ''}，已刷新列表`,
        ...results.slice(0, 20),
      ],
    })
    resetBatchSelection()
  }

  // ============================================================
  // 批量操作 (签到 / 开始 / 完成 / 取消) → 真实后端调用
  // ============================================================
  const runBatchApiAction = useCallback(async (action: string, ids: string[]) => {
    const results: string[] = []
    let okCount = 0
    let failCount = 0
    const labels: Record<string, string> = {
      assign: '批量签到',
      start: '批量开始',
      complete: '批量完成',
      cancel: '批量取消',
    }
    for (const id of ids) {
      let res: { success: boolean; error?: { message?: string } }
      try {
        if (action === 'start') {
          res = await examApi.start(id)
        } else if (action === 'complete') {
          res = await examApi.complete(id)
        } else if (action === 'cancel') {
          res = await examApi.cancel(id, '批量取消')
        } else {
          res = await examApi.checkIn(id)
        }
        if (res.success) {
          okCount += 1
          log(action, id)
        } else {
          failCount += 1
          results.push(`${id}: ${res.error?.message ?? '失败'}`)
        }
      } catch (err) {
        failCount += 1
        results.push(`${id}: ${err instanceof Error ? err.message : '失败'}`)
      }
    }
    await refreshAfterMutation()
    setBatchResultModalData({
      open: true,
      action: labels[action] ?? action,
      count: ids.length,
      results: [
        `成功 ${okCount} 项${failCount > 0 ? `，失败 ${failCount} 项` : ''}`,
        ...results.slice(0, 20),
      ],
    })
    clearSelection()
    setBatch({
      selectedIds: new Set(),
      operation: null,
      priorityValue: '普通',
      roomValue: '',
    })
  }, [log, refreshAfterMutation])

  const handleBatchAction = useCallback((action: string) => {
    if (selectedIds.size === 0) return
    const ids = Array.from(selectedIds)
    void runBatchApiAction(action, ids)
  }, [selectedIds, runBatchApiAction])

  // ============================================================
  // 修改患者信息 → patientApi.update (后端 PATCH /patients/:id)
  // ============================================================
  const genderToEn = (g: string): string => (g === '男' ? 'MALE' : g === '女' ? 'FEMALE' : 'OTHER')
  const typeToEn = (t: string): string =>
    t === '住院' ? 'INPATIENT' : t === '急诊' ? 'EMERGENCY' : t === '体检' ? 'PHYSICAL' : 'OUTPATIENT'

  const savePatientInfo = async () => {
    const exam = patientInfoModalExam
    if (!exam || !patientForm) return
    try {
      const payload: Record<string, string> = {
        name: patientForm.name,
        gender: genderToEn(patientForm.gender),
        type: typeToEn(patientForm.patientType),
      }
      let res = await patientApi.update(exam.patientId, payload)
      if (!res.success) {
        // mock 兜底: mock 后端仅提供 PUT /patients/:id
        res = await api.put(`/patients/${exam.patientId}`, payload)
      }
      if (res.success) {
        setExams(prev => prev.map(e => e.id === exam.id ? {
          ...e,
          patientName: patientForm.name,
          gender: patientForm.gender as RadiologyExam['gender'],
          age: Number(patientForm.age) || e.age,
          patientType: patientForm.patientType as RadiologyExam['patientType'],
        } : e))
        setPatientInfoModalExam(null)
        setPatientForm(null)
        log('edit_patient_info', exam.id)
        void refreshAfterMutation()
      } else {
        setConfirmModalConfig({
          open: true,
          title: '保存失败',
          message: res.error?.message ?? '修改患者信息失败',
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: '保存失败',
        message: err instanceof Error ? err.message : '修改患者信息失败',
        onConfirm: () => setConfirmModalConfig(null),
      })
    }
  }

  // ============================================================
  // 分配设备 → examApi.update(deviceId) (后端 PATCH /exams/:id)
  // ============================================================
  const assignDevice = async (exam: RadiologyExam, deviceId: string) => {
    try {
      let res = await examApi.update(exam.id, { deviceId })
      if (!res.success) {
        const fb = await api.put<ExamDto>(`/worklist/${exam.id}`, { deviceId })
        res = fb
      }
      if (res.success) {
        setExams(prev => prev.map(e => e.id === exam.id ? {
          ...e,
          deviceId,
          deviceName: initialModalityDevices.find(d => d.id === deviceId)?.name ?? e.deviceName,
        } : e))
        setDeviceSelectModalExam(null)
        log('assign_device', exam.id, { deviceId })
        void refreshAfterMutation()
      } else {
        setConfirmModalConfig({
          open: true,
          title: '分配失败',
          message: res.error?.message ?? '分配设备失败',
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: '分配失败',
        message: err instanceof Error ? err.message : '分配设备失败',
        onConfirm: () => setConfirmModalConfig(null),
      })
    }
  }

  // ============================================================
  // 分配报告医生/技师 → worklistApi.assign (后端 POST /worklist/:id/assign)
  // ============================================================
  const assignDoctor = async (exam: RadiologyExam, doctorId: string) => {
    try {
      const res = await worklistApi.assign(exam.id, { doctorId })
      if (res.success) {
        const doctor = doctorOptions.find(d => d.id === doctorId)
        setExams(prev => prev.map(e => e.id === exam.id ? {
          ...e,
          radiologistId: doctorId,
          radiologistName: doctor?.name ?? e.radiologistName,
        } : e))
        setDoctorSelectModalExam(null)
        log('assign_doctor', exam.id, { doctorId })
        void refreshAfterMutation()
      } else {
        setConfirmModalConfig({
          open: true,
          title: '分配失败',
          message: res.error?.message ?? '分配报告医生失败',
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: '分配失败',
        message: err instanceof Error ? err.message : '分配报告医生失败',
        onConfirm: () => setConfirmModalConfig(null),
      })
    }
  }

  // 危急值跳转 → /critical-value?search=患者名&patientId=&examId=
  const handleCriticalValueClick = useCallback((exam: RadiologyExam) => {
    const params = new URLSearchParams()
    if (exam.patientName) params.set('search', exam.patientName)
    if (exam.patientId) params.set('patientId', exam.patientId)
    if (exam.id) params.set('examId', exam.id)
    if (exam.accessionNumber) params.set('accessionNumber', exam.accessionNumber)
    log('critical_value_jump', exam.id)
    window.location.href = `/critical-value?${params.toString()}`
  }, [log])

  // ============================================================
  // 提交报告 → reportApi.create (后端 POST /reports)
  // ============================================================
  const submitReport = async () => {
    const exam = reportModalExam
    if (!exam || !reportForm) return
    try {
      const payload: Partial<ReportDto> & { conclusion?: string } = {
        patientId: exam.patientId,
        examId: exam.id,
        findings: reportForm.findings,
        conclusion: reportForm.conclusion,
      }
      const res = await reportApi.create(payload)
      if (res.success) {
        setReportModalExam(null)
        setReportForm(null)
        log('submit_report', exam.id)
        void refreshAfterMutation()
      } else {
        setConfirmModalConfig({
          open: true,
          title: '提交失败',
          message: res.error?.message ?? '提交报告失败',
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: '提交失败',
        message: err instanceof Error ? err.message : '提交报告失败',
        onConfirm: () => setConfirmModalConfig(null),
      })
    }
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
    setLoading(true)
    void fetchOnce()
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

  // ============================================================
  // 单条真实操作: 开始 / 取消 / 看板拖拽转移
  // ============================================================
  const transitionExamTo = useCallback(async (exam: RadiologyExam, target: string) => {
    const from = normalizeExamStatus(exam.status)
    if (from === target) return
    let res: { success: boolean; error?: { message?: string } }
    try {
      if (target === 'ARRIVED') {
        res = await examApi.checkIn(exam.id)
      } else if (target === 'IN_PROGRESS') {
        res = await examApi.start(exam.id)
      } else if (target === 'COMPLETED') {
        res = await examApi.complete(exam.id)
      } else if (target === 'CANCELLED') {
        res = await examApi.cancel(exam.id, '看板拖拽取消')
      } else {
        return
      }
      if (res.success) {
        log(`status_${target.toLowerCase()}`, exam.id, { from })
        void refreshAfterMutation()
      } else {
        setConfirmModalConfig({
          open: true,
          title: '操作失败',
          message: res.error?.message ?? `无法切换到「${EXAM_STATUS_TO_CN[target] ?? target}」`,
          onConfirm: () => setConfirmModalConfig(null),
        })
        void refreshAfterMutation()
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: '操作失败',
        message: err instanceof Error ? err.message : '状态切换失败',
        onConfirm: () => setConfirmModalConfig(null),
      })
      void refreshAfterMutation()
    }
  }, [log, refreshAfterMutation])

  const handleStartExam = useCallback((exam: RadiologyExam) => {
    setConfirmModalConfig({
      open: true,
      title: '开始检查',
      message: `确认开始检查 ${exam.patientName} 的 ${exam.examItemName}？`,
      onConfirm: () => {
        replayExamActorTo(exam, { type: 'START_EXAM', by: exam.technologistId ?? 'system', technologistId: exam.technologistId ?? 'system', imagesAcquired: 0 })
        setConfirmModalConfig(null)
        void transitionExamTo(exam, 'IN_PROGRESS')
      }
    })
  }, [transitionExamTo])

  const handleCancelExam = useCallback((exam: RadiologyExam) => {
    setConfirmModalConfig({
      open: true,
      title: '取消检查',
      message: `确认取消 ${exam.patientName} 的检查?该操作不可撤销。`,
      variant: 'danger',
      onConfirm: () => {
        replayExamActorTo(exam, { type: 'CANCEL', reason: '技师取消', by: exam.technologistId ?? 'system', imagesAcquired: 0 })
        setConfirmModalConfig(null)
        void transitionExamTo(exam, 'CANCELLED')
      }
    })
  }, [transitionExamTo])

  // 批量操作 (走真实 API)
  const logBatchAction = useCallback((action: string) => {
    handleBatchAction(action)
  }, [handleBatchAction])

  // Enhanced batch actions
  const enhancedBatchActions = [
    { key: 'assign', label: '批量签到', icon: <UserCheck size={14} />, confirm: '确认签到?' },
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
      setDoctorSelectModalExam(null)
      setRequisitionExam(null)
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
            color: '#1e40af',
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
            <span>DICOM 工作列表</span>
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
            background: 'var(--bg-card)',
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
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: [] }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af', lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>全部检查</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                等待中: {stats.waiting}
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
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
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
              <ChartContainer height={30}>
                <BarChart data={[{ v: stats.critical }, { v: Math.max(stats.critical - 2, 0) }, { v: stats.critical + 1 }]}>
                  <Bar dataKey="v" fill="#dc2626" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        </div>
        <div
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'] }))}
          style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'] }))}
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
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: ['COMPLETED'] }))}
          style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: ['COMPLETED'] }))}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', lineHeight: 1 }}>{stats.completed}</div>
              <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>已完成</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>
                检查中: {stats.inProgress}项
              </div>
            </div>
            <MiniSparkline color="#059669" />
          </div>
        </div>
      </div>

      {/* [W1-B] 服务器状态分布: GET /worklist/stats */}
      {serverStats && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'var(--bg-card)', border: '1px solid #e2e8f0', borderRadius: 12,
          padding: '10px 16px', marginBottom: 16, fontSize: 12,
        }}>
          <span style={{ fontWeight: 700, color: '#1e40af' }}>服务器统计 (GET /worklist/stats)</span>
          <span style={{ color: '#64748b' }}>总量: <b style={{ color: '#1e293b' }}>{serverStats.total}</b></span>
          {Object.entries(serverStats.byStatus ?? {}).map(([status, count]) => (
            <span key={status} style={{
              padding: '2px 10px', borderRadius: 999, background: '#f1f5f9', color: '#475569',
            }}>
              {status}: <b>{count}</b>
            </span>
          ))}
          {Object.keys(serverStats.byStatus ?? {}).length === 0 && (
            <span style={{ color: '#94a3b8' }}>暂无状态分布数据</span>
          )}
        </div>
      )}

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

      <SmartSortPanel
        enabled={smartSortEnabled}
        onToggle={handleToggleSmartSort}
        explanations={smartExplanations}
        onCompare={() => setShowSortCompare(true)}
      />

      {viewMode === 'list' && (
        <ListView
          exams={smartOrderedExams}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onRowClick={(exam) => { setHistoryDrawerTab('info'); setSelectedExam(exam) }}
          loading={loading}
          onAssignDoctor={setDoctorSelectModalExam}
          onViewRequisition={setRequisitionExam}
          onViewHistory={(exam) => { setHistoryDrawerTab('history'); setSelectedExam(exam) }}
          onCriticalValueClick={handleCriticalValueClick}
        />
      )}

      {viewMode === 'card' && (
        <CardView
          exams={smartOrderedExams}
          selectedIds={selectedIds}
          onSelect={setSelectedIds}
          onRowClick={(exam) => { setHistoryDrawerTab('info'); setSelectedExam(exam) }}
        />
      )}

      {viewMode === 'kanban' && (
        <DndContext onDragEnd={(event: DragEndEvent) => {
          const examId = String(event.active.id)
          const targetStatus = String(event.over?.id || '')
          const exam = exams.find(e => e.id === examId)
          if (targetStatus && exam) {
            log('drag_status_change', examId, { from: event.active.id, to: targetStatus })
            void transitionExamTo(exam, targetStatus)
          }
        }}>
          <KanbanView
            exams={smartOrderedExams}
            onRowClick={setSelectedExam}
          />
          <DragOverlay />
        </DndContext>
      )}

      <DetailDrawer
        exam={selectedExam}
        onClose={() => setSelectedExam(null)}
        initialTab={historyDrawerTab}
        onEditInfo={(exam) => {
          setPatientInfoModalExam(exam)
          setPatientForm({ name: exam.patientName, gender: exam.gender, age: String(exam.age), patientType: exam.patientType })
        }}
        onAssignDevice={(exam) => setDeviceSelectModalExam(exam)}
        onAssignDoctor={(exam) => setDoctorSelectModalExam(exam)}
        onViewRequisition={(exam) => setRequisitionExam(exam)}
        onWriteReport={(exam) => {
          setReportModalExam(exam)
          setReportForm({ findings: '', conclusion: '' })
        }}
        onStartExam={handleStartExam}
        onCancelExam={handleCancelExam}
      />

      <RequisitionDrawer
        exam={requisitionExam}
        onClose={() => setRequisitionExam(null)}
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
            width: 48, height: 48, borderRadius: 12, background: '#1e40af',
            border: 'none', boxShadow: '0 4px 12px rgba(30,58,95,0.3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: '#fff', transition: 'all 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#2563eb'; e.currentTarget.style.transform = 'scale(1.05)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#1e40af'; e.currentTarget.style.transform = 'scale(1)' }}
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
        <div
          ref={patientInfoFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label="修改患者信息"
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setPatientInfoModalExam(null); }}
          onClick={() => setPatientInfoModalExam(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>修改患者信息</h3>
              <button onClick={() => setPatientInfoModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><span style={{ color: '#64748b' }}>患者姓名：</span><input value={patientForm?.name ?? ''} onChange={e => setPatientForm(f => f ? { ...f, name: e.target.value } : f)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: '#64748b' }}>性别：</span><input value={patientForm?.gender ?? ''} onChange={e => setPatientForm(f => f ? { ...f, gender: e.target.value } : f)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: '#64748b' }}>年龄：</span><input value={patientForm?.age ?? ''} onChange={e => setPatientForm(f => f ? { ...f, age: e.target.value } : f)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: '#64748b' }}>患者类型：</span><input value={patientForm?.patientType ?? ''} onChange={e => setPatientForm(f => f ? { ...f, patientType: e.target.value } : f)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setPatientInfoModalExam(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer' }}>取消</button>
              <button onClick={() => void savePatientInfo()} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e40af', color: '#fff', cursor: 'pointer' }}>保存</button>
            </div>
          </div>
        </div>
      )}

      {deviceSelectModalExam && (
        <div
          ref={deviceSelectFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label="分配检查设备"
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setDeviceSelectModalExam(null); }}
          onClick={() => setDeviceSelectModalExam(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 400, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>分配检查设备</h3>
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
                  onKeyDown={(e) => e.key === 'Enter' && void assignDevice(deviceSelectModalExam, device.id)}
                  style={{
                  padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8
                }} onClick={() => void assignDevice(deviceSelectModalExam, device.id)}>
                  <Monitor size={16} style={{ color: '#1e40af' }} />
                  <span style={{ fontSize: 13 }}>{device.name}</span>
                  <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>{device.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {doctorSelectModalExam && (
        <div
          ref={doctorSelectFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label="分配报告医生"
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setDoctorSelectModalExam(null); }}
          onClick={() => setDoctorSelectModalExam(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 420, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>分配报告医生</h3>
              <button onClick={() => setDoctorSelectModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, color: '#64748b', fontSize: 13 }}>
              当前检查：{doctorSelectModalExam.examItemName}（{doctorSelectModalExam.patientName}）
              <span style={{ marginLeft: 8, color: '#94a3b8', fontSize: 12 }}>
                当前报告医生：{doctorSelectModalExam.radiologistName || (doctorSelectModalExam.radiologistId ? doctorSelectModalExam.radiologistId : '未分配')}
              </span>
            </div>
            {doctorOptionsLoading && (
              <div style={{ padding: 12, fontSize: 12, color: '#94a3b8', textAlign: 'center' }}>正在加载医生列表...</div>
            )}
            {!doctorOptionsLoading && doctorOptions.length === 0 && (
              <div style={{ padding: 12, fontSize: 12, color: '#b45309', textAlign: 'center' }}>
                未获取到医生列表，请检查后端 /users 接口
              </div>
            )}
            <div style={{ display: 'grid', gap: 8 }}>
              {doctorOptions.map(doctor => {
                const isAssigned = doctorSelectModalExam.radiologistId === doctor.id
                return (
                  <div
                    key={doctor.id}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && void assignDoctor(doctorSelectModalExam, doctor.id)}
                    style={{
                      padding: 12, border: '1px solid #e2e8f0', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: isAssigned ? '#f0f7ff' : '#fff',
                    }} onClick={() => void assignDoctor(doctorSelectModalExam, doctor.id)}>
                    <Stethoscope size={16} style={{ color: '#1e40af' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{doctor.name}</span>
                    <span style={{ fontSize: 12, color: '#64748b', marginLeft: 'auto' }}>
                      {doctor.title || '放射科医生'}
                      {isAssigned ? ' · 已分配' : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {reportModalExam && (
        <div
          ref={reportFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label={normalizeExamStatus(reportModalExam.status) === 'COMPLETED' ? '书写报告' : '查看报告'}
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setReportModalExam(null); }}
          onClick={() => setReportModalExam(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>
                {normalizeExamStatus(reportModalExam.status) === 'COMPLETED' ? '书写报告' : '查看报告'}
              </h3>
              <button onClick={() => setReportModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><span style={{ color: '#64748b' }}>患者：</span>{reportModalExam.patientName}（{reportModalExam.gender}，{reportModalExam.age}岁）</div>
              <div><span style={{ color: '#64748b' }}>检查项目：</span>{reportModalExam.examItemName}</div>
              <div><span style={{ color: '#64748b' }}>临床诊断：</span>{reportModalExam.clinicalDiagnosis}</div>
              <div><span style={{ color: '#64748b' }}>检查所见：</span><textarea value={reportForm?.findings ?? ''} onChange={e => setReportForm(f => f ? { ...f, findings: e.target.value } : f)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%', height: 80 }} placeholder="请输入检查所见..." /></div>
              <div><span style={{ color: '#64748b' }}>诊断意见：</span><textarea value={reportForm?.conclusion ?? ''} onChange={e => setReportForm(f => f ? { ...f, conclusion: e.target.value } : f)} style={{ border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', width: '100%', height: 60 }} placeholder="请输入诊断意见..." /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button onClick={() => setReportModalExam(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer' }}>取消</button>
              <button onClick={() => void submitReport()} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e40af', color: '#fff', cursor: 'pointer' }}>提交报告</button>
            </div>
          </div>
        </div>
      )}

      {confirmModalConfig?.open && (
        <div
          ref={confirmFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label={confirmModalConfig.title}
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setConfirmModalConfig(null); }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 400 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{confirmModalConfig.title}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>{confirmModalConfig.message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModalConfig(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer' }}>取消</button>
              <button onClick={confirmModalConfig.onConfirm} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: confirmModalConfig.variant === 'danger' ? '#dc2626' : '#1e40af', color: '#fff', cursor: 'pointer' }}>确认</button>
            </div>
          </div>
        </div>
      )}

      {batchResultModalData?.open && (
        <div
          ref={batchResultFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label="批量操作结果"
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setBatchResultModalData(null); }}
          onClick={() => setBatchResultModalData(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 480
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>批量操作结果</h3>
              <button onClick={() => setBatchResultModalData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, padding: 16, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <CheckCircle size={20} style={{ color: '#22c55e', marginBottom: 8 }} />
              <div style={{ fontSize: 14, color: '#166534' }}>操作完成</div>
              <div style={{ fontSize: 13, color: '#15803d', marginTop: 4 }}>{batchResultModalData.results[0]}</div>
              {batchResultModalData.results.length > 1 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#b45309', maxHeight: 120, overflow: 'auto' }}>
                  {batchResultModalData.results.slice(1).map((r, i) => <div key={i}>{r}</div>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setBatchResultModalData(null)} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e40af', color: '#fff', cursor: 'pointer' }}>确定</button>
            </div>
          </div>
        </div>
      )}

      {printPreviewModalData?.open && (
        <div
          ref={printPreviewFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label="打印预览"
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setPrintPreviewModalData(null); }}
          onClick={() => setPrintPreviewModalData(null)}>
          <div style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>打印预览</h3>
              <button onClick={() => setPrintPreviewModalData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: '#64748b' }}>
              即将打印 {printPreviewModalData.examIds.length} 份报告
            </div>
            <div style={{ background: 'var(--content-bg)', padding: 16, borderRadius: 8, border: '1px solid #e2e8f0', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>打印内容预览</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                报告列表：{printPreviewModalData.examIds.join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setPrintPreviewModalData(null)} style={{ padding: '8px 16px', border: '1px solid #e2e8f0', borderRadius: 6, background: 'var(--bg-card)', cursor: 'pointer' }}>取消</button>
              <button onClick={() => { window.print(); setPrintPreviewModalData(null) }} style={{ padding: '8px 16px', border: 'none', borderRadius: 6, background: '#1e40af', color: '#fff', cursor: 'pointer' }}>打印</button>
            </div>
          </div>
        </div>
      )}

      {showSortCompare && (
        <SortCompareModal
          items={sortCompareItems}
          onClose={() => setShowSortCompare(false)}
        />
      )}
    </PageContainer>
  )
}
