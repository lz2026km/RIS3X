import { Card } from 'antd'
import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useFocusTrap } from '../a11y/SkipLink'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Wifi, LayoutList, LayoutGrid, Kanban, RefreshCw,
  Printer, X, Monitor, CheckCircle, Play, UserCheck, Stethoscope,
  Download, CloudDownload, CheckCircle2, Clock, SlidersHorizontal, History,
  LayoutDashboard, Table2, Users,
} from 'lucide-react'
import {
  AreaChart, Area, BarChart, Bar,
} from 'recharts'
import { DndContext, DragOverlay, type DragEndEvent } from '@dnd-kit/core'
import { initialRadiologyExams, initialModalityDevices, initialExamRooms, initialUsers } from '../data/initialData'
import { api, examApi, patientApi, reportApi, worklistApi, userApi } from '../services/api'
import type {
  WorklistOverviewDto,
  WorklistModalityItemDto,
  WorklistTechnicianStatsDto,
} from '../services/api/worklistApi'
import { dicomDimseApi, dicomWebApi } from '../services/api/dicomApi'
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
import { ActionButton } from '../components/common/ActionButton'
import { PageHeader } from '../components/common/PageHeader'
import { EmptyState } from '../components/common/EmptyState'
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
  // [G005 放射流程P0] 详情抽屉"书写报告"→ 跳转完整书写页 (保留内联快速弹窗组件不动)
  const navigate = useNavigate()

  // [G005 v3.0.6.11-99 Wave 10E-1] 视图切换记忆: viewMode 持久化到 localStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem('worklist-view-mode')
      if (saved === 'list' || saved === 'card' || saved === 'kanban') return saved
    } catch { /* localStorage 不可用 */ }
    return 'list'
  })
  useEffect(() => {
    try { localStorage.setItem('worklist-view-mode', viewMode) } catch { /* ignore */ }
  }, [viewMode])

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

  // ---- B7. 批量操作动态 (本地活动流, localStorage 持久化最近 30 条) ----
  const [batchActivity, setBatchActivity] = useState<Array<{ time: string; action: string; count: number; source: 'api' | 'local' }>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('worklist-batch-activity') || '[]')
      return Array.isArray(saved) ? saved : []
    } catch { return [] }
  })
  const recordBatchActivity = useCallback((action: string, count: number, source: 'api' | 'local') => {
    setBatchActivity(prev => {
      const next = [{ time: new Date().toISOString(), action, count, source }, ...prev].slice(0, 30)
      try { localStorage.setItem('worklist-batch-activity', JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }, [])
  const clearBatchActivity = useCallback(() => {
    setBatchActivity([])
    try { localStorage.removeItem('worklist-batch-activity') } catch { /* ignore */ }
  }, [])

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

  // [v3.0.6.11-103 Wave 1B] 今日总览 / 模态分组 / 技师明细:
  //   GET /worklist/overview · GET /worklist/by-modality · GET /worklist/technician-stats
  const [overview, setOverview] = useState<WorklistOverviewDto | null>(null)
  const [byModality, setByModality] = useState<WorklistModalityItemDto[]>([])
  const [technicianStats, setTechnicianStats] = useState<WorklistTechnicianStatsDto | null>(null)
  useEffect(() => {
    let cancelled = false
    Promise.all([
      worklistApi.getOverview(),
      worklistApi.getByModality(),
      worklistApi.getTechnicianStats(),
    ]).then(([ov, bm, ts]) => {
      if (cancelled) return
      if (ov.success && ov.data) setOverview(ov.data)
      if (bm.success && Array.isArray(bm.data?.items)) setByModality(bm.data!.items)
      if (ts.success && ts.data) setTechnicianStats(ts.data)
    }).catch(() => { /* 总览/明细不可用不阻断 */ })
    return () => { cancelled = true }
  }, [])

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
          title: t('worklistPage.checkin.failTitle'),
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
          title: t('worklistPage.checkin.failTitle'),
          message: res.error?.message ?? t('worklistPage.checkin.failMsg'),
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: t('worklistPage.checkin.failTitle'),
        message: err instanceof Error ? err.message : t('worklistPage.checkin.failMsg'),
        onConfirm: () => setConfirmModalConfig(null),
      })
    } finally {
      setCheckIn(prev => ({ ...prev, isProcessing: false }))
    }
  }

  const handlePrintLabel = () => {
    if (selectedIds.size === 0) {
      setConfirmModalConfig({ open: true, title: '提示', message: t('worklistPage.msg.selectPrintItems'), onConfirm: () => setConfirmModalConfig(null) })
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
      // [v3.0.6.11-95 Wave2B P1] 医生筛选改比 radiologistId (分配报告医生写入 radiologistId, 见 assignDoctor)
      if (filters.doctorId && exam.radiologistId !== filters.doctorId) return false
      return true
    })
  }, [exams, filtersKey])

  // ============================================================
  // [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 影像预取 (工作列表 prefetch)
  //  - 顶部「预取」按钮: 勾选行或全部 → POST /dicom-web/prefetch → 状态提示
  //  - 「预取状态」指示条: cached/total 进度 + 完成后 Tag
  //  - 行内「预取」状态列: 按 GET /dicom-web/prefetch/status 结果渲染
  //  - studyUid 以检查记录 id 近似 (工作列表数据源无 studyInstanceUID)
  // ============================================================
  const [prefetchStatusMap, setPrefetchStatusMap] = useState<Record<string, 'cached' | 'queued' | 'none'>>({})
  const [prefetchStats, setPrefetchStats] = useState<{ total: number; cached: number; pending: number } | null>(null)
  const [prefetchBusy, setPrefetchBusy] = useState(false)
  const [prefetchMsg, setPrefetchMsg] = useState<string | null>(null)
  const prefetchMsgTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showPrefetchMsg = useCallback((msg: string) => {
    setPrefetchMsg(msg)
    if (prefetchMsgTimer.current) clearTimeout(prefetchMsgTimer.current)
    prefetchMsgTimer.current = setTimeout(() => setPrefetchMsg(null), 5000)
  }, [])

  useEffect(() => () => {
    if (prefetchMsgTimer.current) clearTimeout(prefetchMsgTimer.current)
  }, [])

  const refreshPrefetchStatus = useCallback(async () => {
    try {
      await invalidateApiCacheByPrefix('/dicom-web/prefetch')
      const res = await dicomWebApi.prefetchStatus()
      if (res.success && res.data) {
        const map: Record<string, 'cached' | 'queued' | 'none'> = {}
        for (const s of res.data.studies ?? []) map[s.studyUid] = s.status
        setPrefetchStatusMap(map)
        setPrefetchStats({ total: res.data.total, cached: res.data.cached, pending: res.data.pending })
      }
    } catch { /* 预取状态不可用不阻断 */ }
  }, [])

  useEffect(() => { void refreshPrefetchStatus() }, [refreshPrefetchStatus])

  // ============================================================
  // [G005 v3.0.6.11-96 Wave 2B (D)] C-STORE ↔ worklist 联动: 行内「传输」状态列
  // 从 dicomDimseApi.listTransfers 派生 examId/检查号 → 队列状态映射
  // ============================================================
  const [transferStatusMap, setTransferStatusMap] = useState<Record<string, string>>({})

  const refreshTransferStatus = useCallback(async () => {
    try {
      await invalidateApiCacheByPrefix('/dicom-dimse/transfers')
      const res = await dicomDimseApi.listTransfers()
      if (res.success && Array.isArray(res.data)) {
        const map: Record<string, string> = {}
        for (const t of res.data) {
          if (t.examId) map[t.examId] = t.status
          if (t.accessionNumber) map[t.accessionNumber] = t.status
        }
        setTransferStatusMap(map)
      }
    } catch { /* 传输队列不可用不阻断 */ }
  }, [])

  useEffect(() => { void refreshTransferStatus() }, [refreshTransferStatus])

  const handlePrefetch = useCallback(async (scope: 'selected' | 'all') => {
    if (prefetchBusy) return
    const source = scope === 'selected'
      ? exams.filter(e => selectedIds.has(e.id))
      : filteredExams.length > 0 ? filteredExams : exams
    const studyUids = source.map(e => e.id).filter(Boolean)
    if (studyUids.length === 0) {
      showPrefetchMsg(scope === 'selected' ? t('worklistPage.prefetch.selectFirst') : t('worklistPage.prefetch.emptyList'))
      return
    }
    setPrefetchBusy(true)
    try {
      const res = await dicomWebApi.prefetch(studyUids)
      if (res.success && res.data) {
        showPrefetchMsg(`影像预取已提交: 新入队 ${res.data.queued} 项, 已缓存 ${res.data.cached} 项`)
      } else {
        showPrefetchMsg(res.error?.message ?? t('worklistPage.prefetch.failed'))
      }
      await refreshPrefetchStatus()
    } catch (err) {
      showPrefetchMsg(err instanceof Error ? err.message : t('worklistPage.prefetch.serviceUnavailable'))
    } finally {
      setPrefetchBusy(false)
      setTimeout(() => { void refreshPrefetchStatus() }, 3000)
    }
  }, [prefetchBusy, exams, filteredExams, selectedIds, refreshPrefetchStatus, showPrefetchMsg])

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

  // ============================================================
  // [G005 v3.0.6.11-99 Wave 10E-1] 工作台深化区块
  //   B1. 列表列配置面板 (localStorage 持久化列显隐)
  //   B2. SLA 分析卡 (超时分布直方图)
  //   B3. 今日进度条 (完成/总数)
  //   B4. 批量操作扩展卡 (今日已签/已开始计数)
  // ============================================================
  const dataSourceIsReal = !loadError && !loading

  // ---- B1. 列配置面板 (localStorage) ----
  const WORKLIST_COLUMNS: Array<{ key: string; label: string; default: boolean }> = [
    { key: 'priority', label: t('worklistPage.col.priority'), default: true },
    { key: 'patientName', label: t('worklistPage.col.patientName'), default: true },
    { key: 'demographics', label: t('worklistPage.col.demographics'), default: true },
    { key: 'examItemName', label: t('worklistPage.col.examItemName'), default: true },
    { key: 'device', label: t('worklistPage.col.device'), default: true },
    { key: 'roomId', label: t('worklistPage.col.roomId'), default: false },
    { key: 'images', label: t('worklistPage.col.images'), default: true },
    { key: 'prefetch', label: t('worklistPage.col.prefetch'), default: false },
    { key: 'transfer', label: t('worklistPage.col.transfer'), default: false },
    { key: 'patientType', label: t('worklistPage.col.patientType'), default: true },
    { key: 'status', label: t('worklistPage.col.status'), default: true },
    { key: 'criticalFinding', label: t('worklistPage.col.criticalFinding'), default: true },
    { key: 'technologistName', label: t('worklistPage.col.technologistName'), default: false },
    { key: 'radiologistId', label: t('worklistPage.col.radiologistId'), default: true },
    { key: 'createdTime', label: t('worklistPage.col.createdTime'), default: true },
    { key: 'sla', label: 'SLA', default: true },
    { key: 'actions', label: t('worklistPage.col.actions'), default: true },
  ]
  const [showColumnConfig, setShowColumnConfig] = useState(false)
  const [columnConfig, setColumnConfig] = useState<Record<string, boolean>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('worklist-column-config') || 'null')
      if (saved && typeof saved === 'object') return { ...saved }
    } catch { /* ignore */ }
    return {}
  })
  useEffect(() => {
    try { localStorage.setItem('worklist-column-config', JSON.stringify(columnConfig)) } catch { /* ignore */ }
  }, [columnConfig])
  const visibleColumns = useMemo(() => {
    const map = columnConfig
    return WORKLIST_COLUMNS.filter(c => (c.key in map ? map[c.key] : c.default)).map(c => c.key)
  }, [columnConfig])
  const hiddenColumnKeys = useMemo(() => WORKLIST_COLUMNS.map(c => c.key).filter(k => !visibleColumns.includes(k)), [visibleColumns])
  const toggleColumn = (key: string) => setColumnConfig(prev => ({ ...prev, [key]: !(key in prev ? prev[key] : true) }))
  const resetColumnConfig = () => {
    setColumnConfig({})
    setShowColumnConfig(false)
  }
  const allColumnsShown = hiddenColumnKeys.length === 0

  // ---- B2. SLA 分析卡 (超时分布直方图) ----
  const slaBuckets = useMemo(() => {
    const buckets = { lt30: 0, m30to60: 0, gt60: 0 }
    filteredExams.forEach(e => {
      const info = getSLAInfo(e.createdTime)
      if (info.status === 'critical') buckets.gt60 += 1
      else if (info.status === 'warning') buckets.m30to60 += 1
      else buckets.lt30 += 1
    })
    const total = Math.max(1, filteredExams.length)
    return [
      { name: '<30min', value: buckets.lt30, pct: Math.round((buckets.lt30 / total) * 100), color: '#059669' },
      { name: '30-60min', value: buckets.m30to60, pct: Math.round((buckets.m30to60 / total) * 100), color: '#d97706' },
      { name: '>60min', value: buckets.gt60, pct: Math.round((buckets.gt60 / total) * 100), color: '#dc2626' },
    ]
  }, [filteredExams])
  const avgWaitMinutes = useMemo(() => {
    if (filteredExams.length === 0) return 0
    const sum = filteredExams.reduce((acc, e) => {
      const t = e.createdTime ? new Date(e.createdTime).getTime() : 0
      return t > 0 ? acc + (Date.now() - t) / 60000 : acc
    }, 0)
    return Math.round(sum / filteredExams.length)
  }, [filteredExams])
  const slaExceedRate = useMemo(() => {
    if (filteredExams.length === 0) return 0
    return Math.round((slaBuckets.reduce((s, b) => s + (b.name !== '<30min' ? b.value : 0), 0) / filteredExams.length) * 100)
  }, [filteredExams, slaBuckets])

  // ---- B2.5 近 7 日 SLA 趋势 (按 createdTime 日聚合超期/完成) ----
  const slaTrend7d = useMemo(() => {
    const days: Array<{ date: string; overdue: number; total: number; rate: number }> = []
    for (let i = 6; i >= 0; i -= 1) {
      const d = new Date(Date.now() - i * 86400000)
      const key = d.toISOString().slice(0, 10)
      days.push({ date: key, overdue: 0, total: 0, rate: 0 })
    }
    const dayIndex = (iso: string) => days.findIndex(d => d.date === (iso || '').slice(0, 10))
    exams.forEach(e => {
      const idx = dayIndex(e.createdTime)
      if (idx < 0) return
      const slot = days[idx]
      if (!slot) return
      const info = getSLAInfo(e.createdTime)
      slot.total += 1
      if (info.status !== 'normal') slot.overdue += 1
    })
    days.forEach(d => { d.rate = d.total > 0 ? Math.round((d.overdue / d.total) * 100) : 0 })
    return days.map(d => ({
      day: `${Number(d.date.slice(5, 7))}/${Number(d.date.slice(8, 10))}`,
      rate: d.rate,
      overdue: d.overdue,
      total: d.total,
    }))
  }, [exams])
  const slaTrendPeak = useMemo(() => slaTrend7d.reduce((best, d) => (d.rate > best.rate ? d : best), slaTrend7d[0] ?? { day: '-', rate: 0, overdue: 0, total: 0 }), [slaTrend7d])

  // ---- B3. 今日进度 (完成/总数) ----
  const todayProgress = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const todayExams = exams.filter(e => (e.examDate || '').slice(0, 10) === today)
    const done = todayExams.filter(e => normalizeExamStatus(e.status) === 'COMPLETED').length
    return {
      total: todayExams.length,
      done,
      percent: todayExams.length > 0 ? Math.round((done / todayExams.length) * 100) : 0,
      pending: todayExams.length - done,
    }
  }, [exams])

  // ---- B4. 批量操作扩展卡: 今日已签/已开始计数 ----
  const todayBatchCounts = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    let checkedIn = 0
    let started = 0
    exams.forEach(e => {
      if ((e.examDate || '').slice(0, 10) !== today) return
      const st = normalizeExamStatus(e.status)
      if (st === 'ARRIVED') checkedIn += 1
      if (st === 'IN_PROGRESS' || st === 'COMPLETED') started += 1
    })
    // 服务端统计合并 (worklistApi.getStats → completedToday)
    const serverCompleted = serverStats ? Number((serverStats as { completedToday?: number }).completedToday ?? 0) : 0
    return { checkedIn, started, serverCompleted }
  }, [exams, serverStats])

  // ---- B5. 模态 SLA 概况 (各模态超期/待办计数) ----
  const modalitySla = useMemo(() => {
    const map: Record<string, { modality: string; total: number; critical: number; avgWait: number }> = {}
    filteredExams.forEach(e => {
      const m = e.modality || '其他'
      const info = getSLAInfo(e.createdTime)
      const slot = map[m] ?? { modality: m, total: 0, critical: 0, avgWait: 0 }
      slot.total += 1
      if (info.status !== 'normal') slot.critical += 1
      map[m] = slot
    })
    return Object.values(map)
      .map(s => ({ ...s, avgWait: 0 }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 6)
  }, [filteredExams])

  // ---- B6. 今日小时分布 (按 createdTime 小时聚合) ----
  const todayHourly = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    const hours: Array<{ hour: string; count: number }> = []
    for (let h = 7; h <= 20; h += 1) {
      hours.push({ hour: `${h}时`, count: 0 })
    }
    exams.forEach(e => {
      if ((e.examDate || '').slice(0, 10) !== today) return
      const t = e.createdTime ? new Date(e.createdTime).getHours() : -1
      if (t >= 7 && t <= 20) {
        const slot = hours[t - 7]
        if (slot) slot.count += 1
      }
    })
    const peak = hours.reduce((best, h) => (h.count > best.count ? h : best), hours[0] ?? { hour: '-', count: 0 })
    return { hours, peakHour: peak.hour, peakCount: peak.count }
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
      recordBatchActivity('导出Excel', ids.length, 'local')
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
        recordBatchActivity('分配检查室', ids.length, 'api')
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
        recordBatchActivity('修改优先级', ids.length, 'api')
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
  // [v3.0.6.11-95 Wave1B] 签到/开始/完成改走批量端点
  //   POST /worklist/batch-checkin|start|complete { ids[] } → { succeeded[], failed[] }
  //   取消无批量端点, 保留逐条
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
    try {
      if (action === 'assign' || action === 'start' || action === 'complete') {
        const batch = action === 'assign'
          ? await worklistApi.batchCheckIn(ids)
          : action === 'start'
            ? await worklistApi.batchStart(ids)
            : await worklistApi.batchComplete(ids)
        if (batch.success) {
          const data = (batch.data ?? { succeeded: [], failed: [] }) as { succeeded?: Array<{ id: string }>; failed?: Array<{ id: string; message: string }> }
          okCount = data.succeeded?.length ?? 0
          failCount = data.failed?.length ?? 0
          ;(data.failed ?? []).slice(0, 20).forEach(f => results.push(`${f.id}: ${f.message}`))
          ;(data.succeeded ?? []).forEach(s => log(action, s.id))
        } else {
          failCount = ids.length
          results.push(batch.error?.message ?? `批量${labels[action] ?? action}失败`)
        }
      } else {
        for (const id of ids) {
          let res: { success: boolean; error?: { message?: string } }
          try {
            res = await examApi.cancel(id, '批量取消')
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
      }
    } catch (err) {
      failCount = ids.length
      results.push(err instanceof Error ? err.message : `批量${labels[action] ?? action}失败`)
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
    recordBatchActivity(action, ids.length, 'api')
    void runBatchApiAction(action, ids)
  }, [selectedIds, runBatchApiAction, recordBatchActivity])

  const batchActionQuick = useCallback((action: string) => {
    if (selectedIds.size === 0) {
      setConfirmModalConfig({ open: true, title: '提示', message: t('worklistPage.msg.selectForBatch'), onConfirm: () => setConfirmModalConfig(null) })
      return
    }
    handleBatchAction(action)
  }, [selectedIds, handleBatchAction])

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
          title: t('worklistPage.msg.saveFailed'),
          message: res.error?.message ?? t('worklistPage.msg.editPatientFailed'),
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: t('worklistPage.msg.saveFailed'),
        message: err instanceof Error ? err.message : t('worklistPage.msg.editPatientFailed'),
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
          title: t('worklistPage.msg.operationFailed'),
          message: res.error?.message ?? t('worklistPage.msg.assignDeviceFailed'),
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: t('worklistPage.msg.operationFailed'),
        message: err instanceof Error ? err.message : t('worklistPage.msg.assignDeviceFailed'),
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
          title: t('worklistPage.msg.operationFailed'),
          message: res.error?.message ?? t('worklistPage.msg.assignDoctorFailed'),
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: t('worklistPage.msg.operationFailed'),
        message: err instanceof Error ? err.message : t('worklistPage.msg.assignDoctorFailed'),
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
          title: t('worklistPage.msg.operationFailed'),
          message: res.error?.message ?? t('worklistPage.msg.submitFailed'),
          onConfirm: () => setConfirmModalConfig(null),
        })
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: t('worklistPage.msg.operationFailed'),
        message: err instanceof Error ? err.message : t('worklistPage.msg.submitFailed'),
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
        message: t('worklistPage.msg.selectPrintReports'),
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
      style={viewMode === mode ? undefined : { color: 'var(--text-secondary)' }}
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
          title: t('worklistPage.msg.operationFailed'),
          message: res.error?.message ?? `无法切换到「${EXAM_STATUS_TO_CN[target] ?? target}」`,
          onConfirm: () => setConfirmModalConfig(null),
        })
        void refreshAfterMutation()
      }
    } catch (err) {
      setConfirmModalConfig({
        open: true,
        title: t('worklistPage.msg.operationFailed'),
        message: err instanceof Error ? err.message : t('worklistPage.msg.statusSwitchFailed'),
        onConfirm: () => setConfirmModalConfig(null),
      })
      void refreshAfterMutation()
    }
  }, [log, refreshAfterMutation])

  const handleStartExam = useCallback((exam: RadiologyExam) => {
    setConfirmModalConfig({
      open: true,
      title: t('worklistPage.msg.startExam'),
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
      title: t('worklistPage.msg.cancelExam'),
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
    { key: 'assign', label: t('worklistPage.batch.signin'), icon: <UserCheck size={14} />, confirm: t('worklistPage.batch.confirmSignin') },
    { key: 'start', label: t('worklistPage.batch.start'), icon: <Play size={14} />, confirm: t('worklistPage.batch.confirmStart') },
    { key: 'complete', label: t('worklistPage.batch.complete'), icon: <CheckCircle size={14} />, confirm: t('worklistPage.batch.confirmComplete') },
    { key: 'cancel', label: t('worklistPage.batch.cancel'), icon: <X size={14} />, confirm: t('worklistPage.batch.confirmCancel') },
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
    { sequence: ['g', 'w'], action: () => { window.location.href = '/worklist' }, description: t('worklistPage.nav.worklist') },
    { sequence: ['g', 'e'], action: () => { window.location.href = '/exams' }, description: t('worklistPage.nav.exams') },
    { sequence: ['g', 'r'], action: () => { window.location.href = '/reports' }, description: t('worklistPage.nav.reports') },
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
        <ErrorBanner message={`${loadError} (t('worklistPage.errorFallback')`} />
      )}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
      }}>
    <PageHeader
      variant="flex"
      icon={<ClipboardList size={24} />}
      title={t('worklistPage.header.title')}
      subtitle={
        <>
          <span>{t('worklistPage.header.subtitle.dicom')}</span>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <span>{t('worklistPage.header.subtitle.his')}</span>
          <span style={{ color: '#cbd5e1' }}>·</span>
          <span>{t('worklistPage.header.subtitle.realtime')}</span>
        </>
      }
      breadcrumb={[
        { label: t('worklistPage.header.breadcrumb.home'), onClick: () => navigate('/') },
        { label: t('worklistPage.header.breadcrumb.worklist') },
      ]}
      style={{ marginBottom: 0 }}
    />
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 12px',
            background: 'var(--color-success-bg)',
            borderRadius: 8,
            fontSize: 12,
            color: '#059669',
            fontWeight: 500,
            border: '1px solid #d1fae5',
          }}>
            <Wifi size={12} />
            {t('worklistPage.dicomConnected')}
          </div>

          <div style={{
            display: 'flex',
            background: 'var(--bg-card)',
            borderRadius: 8,
            border: '1px solid var(--border-color)',
            overflow: 'hidden',
          }}>
            <ViewModeButton mode="list" icon={<LayoutList size={14} />} label={t('worklistPage.viewMode.list')} />
            <ViewModeButton mode="card" icon={<LayoutGrid size={14} />} label={t('worklistPage.viewMode.card')} />
            <ViewModeButton mode="kanban" icon={<Kanban size={14} />} label={t('worklistPage.viewMode.kanban')} />
          </div>

          {/* [G005 v3.0.6.11-99 Wave 10E-1] 列配置面板入口 */}
          <AppButton
            variant="default"
            size="compact"
            onClick={() => setShowColumnConfig(true)}
            icon={<LayoutList size={12} />}
            title={allColumnsShown ? '配置列表列显隐' : `已隐藏 ${hiddenColumnKeys.length} 列`}
            testId="column-config-btn"
          >
            {t('worklistPage.columnConfig.title')}{!allColumnsShown && <span style={{ color: '#d97706', marginLeft: 4 }}>({hiddenColumnKeys.length})</span>}
          </AppButton>

          <ActionButton
            action="refresh"
            size="compact"
            onClick={handleRefresh}
          >
            刷新列表
          </ActionButton>

          {/* [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 影像预取按钮 (勾选行或全部) */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <AppButton
              variant="default"
              size="compact"
              onClick={() => void handlePrefetch('selected')}
              disabled={prefetchBusy}
              icon={<Download size={12} />}
              testId="prefetch-selected"
              title={`预取已勾选的 ${selectedIds.size} 项检查影像`}
            >
              {t('worklistPage.btn.prefetch')}{selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
            </AppButton>
            <AppButton
              variant="default"
              size="compact"
              onClick={() => void handlePrefetch('all')}
              disabled={prefetchBusy}
              icon={<CloudDownload size={12} />}
              testId="prefetch-all"
              title="预取当前列表全部检查影像"
            >
              预取全部
            </AppButton>
          </div>
        </div>
      </div>

      {/* [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 预取状态指示条: cached/total 进度 + 完成 Tag */}
      {prefetchStats && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 12, padding: '10px 16px', marginBottom: 12, fontSize: 12,
        }} data-testid="prefetch-status-bar">
          <span style={{ fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 4 }}>
            <CloudDownload size={13} /> {t('worklistPage.prefetch.title')}
          </span>
          <div style={{ flex: 1, minWidth: 160, background: 'var(--bg-deep)', borderRadius: 999, height: 8, overflow: 'hidden', position: 'relative' }}>
            <div style={{
              height: '100%', width: `${prefetchStats.total > 0 ? Math.round((prefetchStats.cached / prefetchStats.total) * 100) : 0}%`,
              background: prefetchStats.pending > 0 ? '#3b82f6' : '#22c55e', transition: 'width 0.4s',
            }} />
          </div>
          <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
            {t('worklistPage.prefetch.cached')} <b style={{ color: prefetchStats.pending > 0 ? '#2563eb' : '#059669' }}>{prefetchStats.cached}</b>/{prefetchStats.total}
            {prefetchStats.pending > 0 && <span style={{ color: '#d97706', marginLeft: 6 }}>{t('worklistPage.prefetch.queuing')} {prefetchStats.pending}</span>}
          </span>
          {prefetchStats.pending === 0 && prefetchStats.total > 0 && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999,
              background: '#dcfce7', color: '#059669', fontWeight: 700, whiteSpace: 'nowrap',
            }} data-testid="prefetch-done-tag">
              <CheckCircle2 size={12} /> {t('worklistPage.prefetch.done')}
            </span>
          )}
          {prefetchBusy && <span style={{ color: '#64748b', whiteSpace: 'nowrap' }}>{t('worklistPage.prefetch.submitting')}</span>}
        </div>
      )}
      {prefetchMsg && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
          padding: '8px 14px', marginBottom: 12, fontSize: 12, color: '#1e40af',
        }} data-testid="prefetch-msg" role="status">
          <CheckCircle size={13} /> {prefetchMsg}
        </div>
      )}

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
        <Card bordered={false}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: [] }))}
          style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: [] }))}
         styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1e40af', lineHeight: 1 }}>{stats.total}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('worklistPage.stats.totalExams')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {t('worklistPage.stats.waiting')}: {stats.waiting}
              </div>
            </div>
            <MiniSparkline color="#3b82f6" />
          </div>
        </Card>
        <Card bordered={false}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, priorities: ['危重', '紧急'] }))}
          style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, priorities: ['危重', '紧急'] }))}
         styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#dc2626', lineHeight: 1 }}>{stats.critical}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('worklistPage.stats.criticalUrgent')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {t('worklistPage.stats.slaOverdue')}: {slaCriticalExams.length}
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
        </Card>
        <Card bordered={false}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'] }))}
          style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: ['SCHEDULED', 'ARRIVED', 'IN_PROGRESS'] }))}
         styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#d97706', lineHeight: 1 }}>{stats.pending}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('worklistPage.stats.pending')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {t('worklistPage.stats.avgWait')}: {filteredExams.length > 0 ? Math.round(filteredExams.reduce((s, e) => {
                  const t = e.createdTime ? new Date(e.createdTime).getTime() : 0;
                  return t > 0 ? s + (Date.now() - t) / 60000 : s
                }, 0) / filteredExams.length) : 0}min
              </div>
            </div>
            <MiniSparkline color="#d97706" />
          </div>
        </Card>
        <Card bordered={false}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && setFilters(f => ({ ...f, statuses: ['COMPLETED'] }))}
          style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '16px 20px',
          border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          cursor: 'pointer',
        }}
          onClick={() => setFilters(f => ({ ...f, statuses: ['COMPLETED'] }))}
         styles={{ body: { padding: 0 } }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#059669', lineHeight: 1 }}>{stats.completed}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{t('worklistPage.stats.completed')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {t('worklistPage.stats.inProgress')}: {stats.inProgress}{t('worklistPage.stats.items')}
              </div>
            </div>
            <MiniSparkline color="#059669" />
          </div>
        </Card>
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] B2. SLA 分析卡: 超时分布直方图 + 平均等待 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }} data-testid="sla-analysis-card">
        <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Clock size={13} /> {t('worklistPage.sla.title')}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {t('worklistPage.sla.avgWait')} <b style={{ color: avgWaitMinutes > 30 ? '#d97706' : '#059669' }}>{avgWaitMinutes}</b> min
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 96 }}>
            {slaBuckets.map(b => (
              <div key={b.name} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 800, color: b.color }}>{b.value}</span>
                <div style={{
                  width: '70%', height: `${Math.max(6, b.value)}px`, minHeight: 4, maxHeight: 60,
                  background: b.color, borderRadius: '4px 4px 0 0', transition: 'height 0.3s',
                }} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{b.name}</span>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
            <span>{t('worklistPage.sla.exceedRate')} <b style={{ color: slaExceedRate > 30 ? '#dc2626' : '#059669' }}>{slaExceedRate}%</b></span>
            <span>{t('worklistPage.sla.threshold')}</span>
          </div>
          {/* 近 7 日超时率迷你趋势 */}
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px dashed var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{t('worklistPage.sla.last7days')}</span>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {t('worklistPage.sla.peak')} <b style={{ color: '#d97706' }}>{slaTrendPeak.day}</b> {slaTrendPeak.rate}%
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34 }}>
              {slaTrend7d.map(d => (
                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.day}: ${d.overdue}/${d.total} 超期`}>
                  <div style={{
                    width: '72%', height: Math.max(2, Math.round((d.rate / 100) * 28)), borderRadius: 2,
                    background: d.rate > 50 ? '#dc2626' : d.rate > 25 ? '#d97706' : '#22c55e',
                  }} />
                  <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>{d.day}</span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* B3. 今日进度条 */}
        <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <CheckCircle2 size={13} /> {t('worklistPage.todayProgress.title')}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#059669', lineHeight: 1 }}>
            {todayProgress.percent}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '6px 0 10px' }}>
            {t('worklistPage.todayProgress.done')} <b style={{ color: '#059669' }}>{todayProgress.done}</b> / {todayProgress.total} {t('worklistPage.stats.items')}
            {todayProgress.pending > 0 && <span style={{ color: '#d97706' }}> · {t('worklistPage.todayProgress.pending')} {todayProgress.pending}</span>}
          </div>
          <div style={{ height: 8, borderRadius: 999, background: 'var(--bg-deep)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${todayProgress.percent}%`, borderRadius: 999,
              background: todayProgress.percent >= 80 ? '#22c55e' : '#3b82f6', transition: 'width 0.5s',
            }} />
          </div>
        </Card>

        {/* B4. 批量操作扩展卡 */}
        <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <UserCheck size={13} /> {t('worklistPage.todayBatch.title')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div style={{ background: 'var(--color-info-bg)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#2563eb', lineHeight: 1.2 }}>{todayBatchCounts.checkedIn}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t('worklistPage.todayBatch.checkedIn')}</div>
            </div>
            <div style={{ background: 'var(--color-success-bg)', borderRadius: 8, padding: '8px 10px' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#059669', lineHeight: 1.2 }}>{todayBatchCounts.started}</div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{t('worklistPage.todayBatch.started')}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <AppButton variant="default" size="compact" icon={<UserCheck size={11} />} onClick={() => batchActionQuick('assign')}>{t('worklistPage.todayBatch.signin')}</AppButton>
            <AppButton variant="default" size="compact" icon={<Play size={11} />} onClick={() => batchActionQuick('start')}>{t('worklistPage.todayBatch.start')}</AppButton>
            <AppButton variant="default" size="compact" icon={<CheckCircle size={11} />} onClick={() => batchActionQuick('complete')}>{t('worklistPage.todayBatch.complete')}</AppButton>
          </div>
          {serverStats && Number((serverStats as { completedToday?: number }).completedToday ?? 0) > 0 && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text-secondary)' }}>
              {t('worklistPage.todayBatch.serverCompleted')}: <b style={{ color: '#059669' }}>{todayBatchCounts.serverCompleted}</b>
            </div>
          )}
        </Card>
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] B5/B6/B7. 模态 SLA + 今日小时分布 + 批量动态 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 16,
        marginBottom: 16,
      }} data-testid="worklist-deep-row2">
        <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <Monitor size={13} /> {t('worklistPage.modalitySla.title')}
          </div>
          {modalitySla.length === 0 ? (
            <EmptyState type="nodata" style={{ padding: '12px 0', gap: 6 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modalitySla.map(m => {
                const rate = m.total > 0 ? Math.round((m.critical / m.total) * 100) : 0
                return (
                  <div key={m.modality} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 40, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{m.modality}</span>
                    <div style={{ flex: 1, height: 8, background: 'var(--bg-deep)', borderRadius: 999, overflow: 'hidden' }}>
                      <div style={{
                        width: `${rate}%`, height: '100%', borderRadius: 999,
                        background: rate > 50 ? '#dc2626' : rate > 25 ? '#d97706' : '#22c55e', transition: 'width 0.4s',
                      }} />
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 110, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {m.total} 项 · 超时 {m.critical} ({rate}%)
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardList size={13} /> {t('worklistPage.hourly.title')} (7-20时)
            {todayHourly.peakCount > 0 && (
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                {t('worklistPage.hourly.peak')} <b style={{ color: '#d97706' }}>{todayHourly.peakHour}</b> ({todayHourly.peakCount} 项)
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 110 }}>
            {todayHourly.hours.map(h => {
              const max = todayHourly.peakCount || 1
              const hgt = h.count > 0 ? Math.max(6, Math.round((h.count / max) * 96)) : 3
              return (
                <div key={h.hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 10, color: h.count > 0 ? '#1e40af' : 'var(--text-secondary)', fontWeight: 600 }}>{h.count}</span>
                  <div style={{
                    width: '78%', height: hgt, borderRadius: '3px 3px 0 0',
                    background: h.hour === todayHourly.peakHour && h.count > 0 ? '#d97706' : '#3b82f6',
                    opacity: h.count > 0 ? 0.75 + (h.count / max) * 0.25 : 0.25,
                  }} />
                  <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{h.hour.replace('时', '')}</span>
                </div>
              )
            })}
          </div>
        </Card>

        <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
          background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
              <History size={13} /> {t('worklistPage.batchActivity.title')}
            </div>
            {batchActivity.length > 0 && (
              <button onClick={clearBatchActivity} style={{
                border: 'none', background: 'none', fontSize: 11, color: 'var(--text-secondary)', cursor: 'pointer', textDecoration: 'underline',
              }}>{t('worklistPage.batchActivity.clear')}</button>
            )}
          </div>
          {batchActivity.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>
              暂无批量操作记录 · 使用上方「批量签到/开始/完成」后自动记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflow: 'auto' }}>
              {batchActivity.map((a, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, padding: '6px 8px', background: 'var(--content-bg)', borderRadius: 6 }}>
                  <span style={{
                    padding: '1px 6px', borderRadius: 4, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
                    background: a.source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                    color: a.source === 'api' ? '#059669' : '#d97706',
                  }}>{a.source === 'api' ? 'API' : '本地'}</span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {a.action === 'assign' ? '批量签到' : a.action === 'start' ? '批量开始' : a.action === 'complete' ? '批量完成' : a.action === 'cancel' ? '批量取消' : a.action}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', marginLeft: 'auto', whiteSpace: 'nowrap' }}>{a.count} 项</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: 11, whiteSpace: 'nowrap' }}>
                    {new Date(a.time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* [G005 v3.0.6.11-99 Wave 10E-1] 数据源徽标 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, fontSize: 12,
        padding: '6px 12px', borderRadius: 8,
        background: dataSourceIsReal ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
        color: dataSourceIsReal ? '#059669' : '#d97706',
        border: `1px solid ${dataSourceIsReal ? '#bbf7d0' : '#fde68a'}`,
      }} data-testid="worklist-data-source-badge">
        <Wifi size={12} />
        {dataSourceIsReal ? '数据源: 真实接口 (/exams + /worklist) · 列配置/视图模式已本地持久化' : '数据源: 本地 initialData 回退 (后端不可用) · 分析卡基于回退数据'}
      </div>

      {/* [W1-B] 服务器状态分布: GET /worklist/stats */}
      {serverStats && (
        <Card bordered={false} style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12,
          padding: '10px 16px', marginBottom: 16, fontSize: 12,
        }} styles={{ body: { padding: 0 } }}>
          <span style={{ fontWeight: 700, color: '#1e40af' }}>服务器统计</span>
          <span style={{ color: 'var(--text-secondary)' }}>总量: <b style={{ color: 'var(--text-primary)' }}>{serverStats.total}</b></span>
          {Object.entries(serverStats.byStatus ?? {}).map(([status, count]) => (
            <span key={status} style={{
              padding: '2px 10px', borderRadius: 999, background: 'var(--bg-card)', color: 'var(--text-secondary)',
            }}>
              {status}: <b>{count}</b>
            </span>
          ))}
          {Object.keys(serverStats.byStatus ?? {}).length === 0 && (
            <span style={{ color: 'var(--text-secondary)' }}>暂无状态分布数据</span>
          )}
        </Card>
      )}

      {/* [v3.0.6.11-103 Wave 1B] 今日总览 / 模态分组 / 技师明细:
          GET /worklist/overview · GET /worklist/by-modality · GET /worklist/technician-stats */}
      {(overview || byModality.length > 0 || technicianStats) && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 16,
          marginBottom: 16,
        }} data-testid="worklist-overview-panel">
          {/* 今日总览 */}
          <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
            background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <LayoutDashboard size={13} /> {t('worklist.overview.title')}
              {overview?.date && (
                <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>{overview.date}</span>
              )}
            </div>
            {!overview ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>暂无数据</div>
            ) : (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
                  {[
                    [t('worklist.overview.todayExams'), `${overview.todayTotal}`],
                    [t('worklist.overview.todayCompleted'), `${overview.completedToday}`],
                    [t('worklist.overview.completedRate'), `${overview.completedRate}%`],
                    [t('worklist.overview.avgDuration'), `${overview.avgDurationMin}min`],
                  ].map(([label, value]) => (
                    <div key={label} style={{ background: 'var(--content-bg)', borderRadius: 8, padding: '8px 10px' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: '#1e40af', lineHeight: 1.2 }}>{value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 44, marginBottom: 8 }}>
                  {(overview.byHour ?? []).filter(h => {
                    const hour = Number(h.hour.slice(0, 2))
                    return hour >= 8 && hour <= 20
                  }).map(h => (
                    <div key={h.hour} title={`${h.hour} 共 ${h.count} 项`} style={{
                      flex: 1, height: `${Math.max(3, Math.min(100, Math.round((h.count / Math.max(1, Math.max(...(overview.byHour ?? []).map(x => x.count), 1))) * 100)))}%`,
                      background: '#3b82f6', borderRadius: '2px 2px 0 0', opacity: 0.75,
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {Object.entries(overview.byStatus ?? {}).map(([status, count]) => (
                    <span key={status} style={{
                      padding: '2px 10px', borderRadius: 999, background: 'var(--content-bg)',
                      color: 'var(--text-secondary)', fontSize: 11,
                    }}>
                      {status}: <b>{count}</b>
                    </span>
                  ))}
                  {Object.keys(overview.byStatus ?? {}).length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>暂无状态分布</span>
                  )}
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                    {t('worklist.overview.peakHour', { hour: overview.peakHour })}
                  </span>
                </div>
              </div>
            )}
          </Card>

          {/* 模态分组 */}
          <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
            background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Table2 size={13} /> {t('worklist.byModality.title')}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                GET /worklist/by-modality
              </span>
            </div>
            {byModality.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>暂无数据</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {byModality.map(m => {
                  const maxTotal = Math.max(1, ...byModality.map(x => x.total))
                  return (
                    <div key={m.modality} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 40, fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{m.modality}</span>
                      <div style={{ flex: 1, height: 8, background: 'var(--bg-deep)', borderRadius: 999, overflow: 'hidden' }}>
                        <div style={{
                          width: `${Math.round((m.total / maxTotal) * 100)}%`, height: '100%', borderRadius: 999,
                          background: m.inProgress > 0 ? '#d97706' : '#3b82f6', transition: 'width 0.4s',
                        }} />
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 150, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {m.total} 项 · {t('worklist.byModality.inProgress')} {m.inProgress} · {t('worklist.byModality.todayCompleted')} {m.todayCompleted}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 60, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {t('worklist.byModality.avgDuration', { min: m.avgDurationMin })}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </Card>

          {/* 技师维度明细 */}
          <Card bordered={false} styles={{ body: { padding: 0 } }} style={{
            background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px',
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={13} /> {t('worklist.technicianStats.title')}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>
                GET /worklist/technician-stats
              </span>
            </div>
            {!technicianStats || (technicianStats.technicians ?? []).length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', padding: '16px 0', textAlign: 'center' }}>暂无数据</div>
            ) : (
              <div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 999, background: 'var(--color-success-bg)',
                    color: '#059669', fontSize: 11,
                  }}>{t('worklist.technicianStats.completed', { count: technicianStats.summary?.totalCompleted })}</span>
                  <span style={{
                    padding: '2px 10px', borderRadius: 999, background: 'var(--color-warning-bg)',
                    color: '#d97706', fontSize: 11,
                  }}>{t('worklist.technicianStats.retake', { count: technicianStats.summary?.totalRetake, rate: technicianStats.summary?.retakeRate })}</span>
                  <span style={{
                    padding: '2px 10px', borderRadius: 999, background: 'var(--color-info-bg)',
                    color: '#2563eb', fontSize: 11,
                  }}>{t('worklist.technicianStats.avg', { min: technicianStats.summary?.avgDurationMin, count: technicianStats.summary?.technicianCount })}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {technicianStats.technicians.slice(0, 6).map(tech => {
                    const maxDone = Math.max(1, ...technicianStats.technicians.map(x => x.completedCount))
                    return (
                      <div key={tech.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ width: 56, fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{tech.name}</span>
                        <div style={{ flex: 1, height: 7, background: 'var(--bg-deep)', borderRadius: 999, overflow: 'hidden' }}>
                          <div style={{
                            width: `${Math.round((tech.completedCount / maxDone) * 100)}%`, height: '100%', borderRadius: 999,
                            background: tech.retakeCount > 0 ? '#f59e0b' : '#22c55e', transition: 'width 0.4s',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 130, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {t('worklist.technicianStats.row', {
                            done: tech.completedCount,
                            min: tech.avgDurationMin,
                            retake: tech.retakeCount > 0 ? t('worklist.technicianStats.retakeSuffix', { count: tech.retakeCount }) : '',
                          })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </Card>
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
          prefetchStatus={prefetchStatusMap}
          transferStatus={transferStatusMap}
          hiddenColumns={hiddenColumnKeys}
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
          // [G005 放射流程P0] 检查→报告: 改跳完整书写页 (原内联弹窗保留组件不删)
          navigate(`/reports/v3-write?examId=${encodeURIComponent(exam.id)}&patientId=${encodeURIComponent(exam.patientId)}`)
        }}
        onStartExam={handleStartExam}
        onCancelExam={handleCancelExam}
        onStatusChanged={() => void refreshAfterMutation()}
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

        <AppButton
          variant="primary"
          size="compact"
          onClick={handleRefresh}
          style={{ width: 48, height: 48, borderRadius: 12, boxShadow: '0 4px 12px rgba(30,58,95,0.3)' }}
          title="刷新数据"
          testId="fab-refresh"
        >
          <RefreshCw size={20} />
        </AppButton>
      </div>

      <div style={{
        marginTop: 20, padding: '12px 0', textAlign: 'center',
        fontSize: 12, color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)',
      }}>
        {t('worklistPage.footer', { date: new Date().toLocaleDateString('zh-CN') })}
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
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{t('worklistPage.patientInfo.title')}</h3>
              <button onClick={() => setPatientInfoModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.patientInfo.name')}</span><input value={patientForm?.name ?? ''} onChange={e => setPatientForm(f => f ? { ...f, name: e.target.value } : f)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.patientInfo.gender')}</span><input value={patientForm?.gender ?? ''} onChange={e => setPatientForm(f => f ? { ...f, gender: e.target.value } : f)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.patientInfo.age')}</span><input value={patientForm?.age ?? ''} onChange={e => setPatientForm(f => f ? { ...f, age: e.target.value } : f)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.patientInfo.type')}</span><input value={patientForm?.patientType ?? ''} onChange={e => setPatientForm(f => f ? { ...f, patientType: e.target.value } : f)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', width: '100%' }} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <ActionButton action="cancel" size="compact" onClick={() => setPatientInfoModalExam(null)}>{t('worklistPage.confirm.cancel')}</ActionButton>
              <ActionButton action="save" size="compact" onClick={() => void savePatientInfo()}>{t('worklistPage.patientInfo.save')}</ActionButton>
            </div>
          </Card>
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
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 400, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{t('worklistPage.deviceSelect.title')}</h3>
              <button onClick={() => setDeviceSelectModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>{t('worklistPage.deviceSelect.currentExam')}{deviceSelectModalExam.examItemName}</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {initialModalityDevices.filter(d => d.modality === deviceSelectModalExam.modality).map(device => (
                <div
                  key={device.id}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && void assignDevice(deviceSelectModalExam, device.id)}
                  style={{
                  padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 8
                }} onClick={() => void assignDevice(deviceSelectModalExam, device.id)}>
                  <Monitor size={16} style={{ color: '#1e40af' }} />
                  <span style={{ fontSize: 13 }}>{device.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{device.status}</span>
                </div>
              ))}
            </div>
          </Card>
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
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 420, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{t('worklistPage.doctorSelect.title')}</h3>
              <button onClick={() => setDoctorSelectModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, color: 'var(--text-secondary)', fontSize: 13 }}>
              {t('worklistPage.doctorSelect.currentExam')}{doctorSelectModalExam.examItemName}（{doctorSelectModalExam.patientName}）
              <span style={{ marginLeft: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
                {t('worklistPage.doctorSelect.currentDoctor')}{doctorSelectModalExam.radiologistName || (doctorSelectModalExam.radiologistId ? doctorSelectModalExam.radiologistId : '未分配')}
              </span>
            </div>
            {doctorOptionsLoading && (
              <div style={{ padding: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center' }}>{t('worklistPage.doctorSelect.loading')}</div>
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
                      padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: isAssigned ? '#f0f7ff' : '#fff',
                    }} onClick={() => void assignDoctor(doctorSelectModalExam, doctor.id)}>
                    <Stethoscope size={16} style={{ color: '#1e40af' }} />
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{doctor.name}</span>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
                      {doctor.title || t('worklistPage.doctorSelect.radioDoctor')}
                      {isAssigned ? ` · ${t('worklistPage.doctorSelect.assigned')}` : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {reportModalExam && (
        <div
          ref={reportFocusRef}
          role="dialog"
          aria-modal="true"
          aria-label={normalizeExamStatus(reportModalExam.status) === 'COMPLETED' ? t('worklistPage.report.writeReport') : t('worklistPage.report.viewReport')}
          style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}
          onKeyDown={(e) => { if (e.key === 'Escape') setReportModalExam(null); }}
          onClick={() => setReportModalExam(null)}>
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>
                {normalizeExamStatus(reportModalExam.status) === 'COMPLETED' ? t('worklistPage.report.writeReport') : t('worklistPage.report.viewReport')}
              </h3>
              <button onClick={() => setReportModalExam(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ display: 'grid', gap: 12 }}>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.report.patient')}</span>{reportModalExam.patientName}（{reportModalExam.gender}，{reportModalExam.age}岁）</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.report.examItem')}</span>{reportModalExam.examItemName}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.report.clinicalDiag')}</span>{reportModalExam.clinicalDiagnosis}</div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.report.findings')}</span><textarea value={reportForm?.findings ?? ''} onChange={e => setReportForm(f => f ? { ...f, findings: e.target.value } : f)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', width: '100%', height: 80 }} placeholder={t('worklistPage.report.findingsPlaceholder')} /></div>
              <div><span style={{ color: 'var(--text-secondary)' }}>{t('worklistPage.report.diagnosis')}</span><textarea value={reportForm?.conclusion ?? ''} onChange={e => setReportForm(f => f ? { ...f, conclusion: e.target.value } : f)} style={{ border: '1px solid var(--border-color)', borderRadius: 6, padding: '6px 10px', width: '100%', height: 60 }} placeholder={t('worklistPage.report.diagnosisPlaceholder')} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <ActionButton action="cancel" size="compact" onClick={() => setReportModalExam(null)}>{t('worklistPage.confirm.cancel')}</ActionButton>
              <ActionButton action="submit" size="compact" onClick={() => void submitReport()}>{t('worklistPage.report.submit')}</ActionButton>
            </div>
          </Card>
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
          <Card bordered={false} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 400 }} styles={{ body: { padding: 0 } }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{confirmModalConfig.title}</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--text-secondary)' }}>{confirmModalConfig.message}</p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <ActionButton action="cancel" size="compact" onClick={() => setConfirmModalConfig(null)}>{t('worklistPage.confirm.cancel')}</ActionButton>
              <ActionButton
                action={confirmModalConfig.variant === 'danger' ? 'delete' : 'submit'}
                variant={confirmModalConfig.variant === 'danger' ? 'danger' : 'primary'}
                size="compact"
                onClick={confirmModalConfig.onConfirm}
              >{t('worklistPage.confirm.confirm')}</ActionButton>
            </div>
          </Card>
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
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 480
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{t('worklistPage.batchResult.title')}</h3>
              <button onClick={() => setBatchResultModalData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, padding: 16, background: 'var(--color-success-bg)', borderRadius: 8, border: '1px solid #bbf7d0' }}>
              <CheckCircle size={20} style={{ color: '#22c55e', marginBottom: 8 }} />
              <div style={{ fontSize: 14, color: '#166534' }}>{t('worklistPage.batchResult.done')}</div>
              <div style={{ fontSize: 13, color: '#15803d', marginTop: 4 }}>{batchResultModalData.results[0]}</div>
              {batchResultModalData.results.length > 1 && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#b45309', maxHeight: 120, overflow: 'auto' }}>
                  {batchResultModalData.results.slice(1).map((r, i) => <div key={i}>{r}</div>)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <ActionButton action="submit" size="compact" onClick={() => setBatchResultModalData(null)}>{t('worklistPage.batchResult.ok')}</ActionButton>
            </div>
          </Card>
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
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 600, maxHeight: '80vh', overflow: 'auto'
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af' }}>{t('worklistPage.printPreview.title')}</h3>
              <button onClick={() => setPrintPreviewModalData(null)} style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}>
              {t('worklistPage.printPreview.count', { count: printPreviewModalData.examIds.length })}
            </div>
            <div style={{ background: 'var(--content-bg)', padding: 16, borderRadius: 8, border: '1px solid var(--border-color)', marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('worklistPage.printPreview.content')}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {t('worklistPage.printPreview.reportList')}: {printPreviewModalData.examIds.join(', ')}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <ActionButton action="cancel" size="compact" onClick={() => setPrintPreviewModalData(null)}>{t('worklistPage.confirm.cancel')}</ActionButton>
              <ActionButton action="print" size="compact" onClick={() => { window.print(); setPrintPreviewModalData(null) }}>{t('worklistPage.printPreview.print')}</ActionButton>
            </div>
          </Card>
        </div>
      )}

      {showSortCompare && (
        <SortCompareModal
          items={sortCompareItems}
          onClose={() => setShowSortCompare(false)}
        />
      )}

      {/* [G005 v3.0.6.11-99 Wave 10E-1] B1. 列配置面板 (localStorage 持久化) */}
      {showColumnConfig && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="列配置"
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
          }}
          onKeyDown={(e) => { if (e.key === 'Escape') setShowColumnConfig(false); }}
          onClick={() => setShowColumnConfig(false)}
        >
          <Card bordered={false} style={{
            background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 520, maxHeight: '80vh', overflow: 'auto',
          }} onClick={e => e.stopPropagation()} styles={{ body: { padding: 0 } }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
                <SlidersHorizontal size={16} /> {t('worklistPage.columnConfig.panelTitle')}
              </h3>
              <button onClick={() => setShowColumnConfig(false)} style={{ border: 'none', background: 'none', cursor: 'pointer' }} aria-label="关闭">
                <X size={18} />
              </button>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              选择列表视图要显示的列（配置自动保存到本地，刷新后保留）
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 16 }}>
              {WORKLIST_COLUMNS.map(c => {
                const isOn = c.key in columnConfig ? columnConfig[c.key] : c.default
                return (
                  <label key={c.key} style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8,
                    border: `1px solid ${isOn ? '#bfdbfe' : 'var(--border-color)'}`,
                    background: isOn ? '#eff6ff' : 'var(--bg-card)', cursor: 'pointer', fontSize: 13,
                  }}>
                    <input
                      type="checkbox"
                      checked={isOn}
                      onChange={() => toggleColumn(c.key)}
                      style={{ accentColor: '#1e40af', cursor: 'pointer' }}
                    />
                    <span style={{ color: isOn ? '#1e40af' : 'var(--text-secondary)', fontWeight: isOn ? 600 : 400 }}>{c.label}</span>
                    {c.key === 'actions' && <span style={{ fontSize: 11, color: 'var(--text-secondary)', marginLeft: 'auto' }}>{t('worklistPage.columnConfig.alwaysShow')}</span>}
                  </label>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <ActionButton action="refresh" variant="default" size="compact" onClick={resetColumnConfig}>{t('worklistPage.btn.resetDefault')}</ActionButton>
              <ActionButton action="submit" size="compact" onClick={() => setShowColumnConfig(false)}>{t('worklistPage.btn.apply')}</ActionButton>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  )
}
