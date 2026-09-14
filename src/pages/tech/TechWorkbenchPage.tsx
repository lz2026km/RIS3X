// [v3.0.6.11-103 Wave 11] 技师工作站 - 端到端应用流程贯通
// Tab 化: 今日检查 / 房间状态 / 重拍登记 / 交接班 / 紧急插队
// 顶部: 技师今日概览卡 (进行中/待检/已完成/重拍数)
// 一键流转: 报到→开始→完成 (每步确认 + 可附注); 完成强制检查项; 重拍登记; 危急置顶
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Empty, Input, InputNumber, Modal, Radio, Select, Spin, Tag, Tooltip, message } from 'antd'
import {
  Activity, AlertTriangle, ArrowRightLeft, CheckCircle2, ClipboardList,
  DoorOpen, FileText, Flame, Gauge, ListOrdered, Play, RefreshCw,
  ShieldCheck, Siren, StickyNote, UserCheck, Zap,
} from 'lucide-react'
import { PageContainer } from '../../components/common/PageContainer'
import { PageHeader } from '../../components/common/PageHeader'
import { StatCard, StatCardGrid } from '../../components/common/StatCard'
import { TabBar } from '../../components/common/TabBar'
import FlowStatusBar, { examStatusToStep, type FlowAction } from '../../components/tech/FlowStatusBar'
import {
  worklistApi,
  type WorklistItemDto,
  type WorklistOverviewDto,
  type WorklistTechnicianStatsDto,
  type TimeoutChecklistDto,
  type TimeoutChecklistKey,
  RETAKE_REASON_OPTIONS,
} from '../../services/api/worklistApi'
import { techOpsApi, type EmergencyRecord, type EmergencySuggestion, type ExamPriority } from '../../services/api/techOpsApi'
import { invalidateApiCacheByPrefix } from '../../services/api/client'
import { userApi } from '../../services/api/userApi'
import type { UserDto } from '../../types/dto'
import { realtime } from '../../services/realtime'
import { t } from '../../i18n/appI18n'
import { normalizeExamStatus, displayExamStatus } from '../../utils/statusMaps'
import { useAuth } from '../../hooks/useAuth'
import ExamRoomStatusBoard from './ExamRoomStatusBoard'
import RetakeRateAnalyticsPage from './RetakeRateAnalyticsPage'
// [v3.0.6.11-104 Wave 3D] 检查流程模板面板 (登记核对/妊娠询问/摆位/质控)
import WorkflowTemplatePanel from '../../components/common/WorkflowTemplatePanel'

// ============================================================
// 工具
// ============================================================
const PRIORITY_META: Record<string, { label: string; color: string; bg: string; rank: number }> = {
  STAT: { label: '危重', color: '#dc2626', bg: '#fee2e2', rank: 0 },
  URGENT: { label: '紧急', color: '#d97706', bg: '#fef3c7', rank: 1 },
  ROUTINE: { label: '普通', color: '#64748b', bg: '#f1f5f9', rank: 2 },
  危重: { label: '危重', color: '#dc2626', bg: '#fee2e2', rank: 0 },
  紧急: { label: '紧急', color: '#d97706', bg: '#fef3c7', rank: 1 },
  普通: { label: '普通', color: '#64748b', bg: '#f1f5f9', rank: 2 },
}

const priorityOf = (exam: WorklistItemDto): string => String(exam.priority ?? 'ROUTINE')
const isCritical = (exam: WorklistItemDto): boolean => (PRIORITY_META[priorityOf(exam)]?.rank ?? 9) <= 1

const waitMin = (exam: WorklistItemDto): number => {
  const ts = exam.startedAt ?? exam.createdAt
  if (!ts) return 0
  try { return Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 60000)) } catch { return 0 }
}

const fmtTime = (iso: string) => {
  if (!iso) return '--'
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

const fmtMin = (min: number) => {
  const m = ((Math.round(min) % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

// 演示回退: 紧急插队建议 (API 不可用时保证页面可用, 与 TechOpsPage 风格一致)
function buildDemoSuggestions(modality: string, durationMin: number): EmergencySuggestion[] {
  const now = Date.now()
  const base = [
    { id: 'DEMO-S1', strategy: 'INSERT_NOW' as const, strategyLabel: '立即插入', deviceId: 'DEV-CT2', deviceName: 'CT-2 检查室', modality, technician: '赵志刚', startInMin: 8, waitMin: 8, conflictCount: 1, conflicts: [], feasibility: 'CONFLICT' as const, note: '当前检查预计 8 分钟后完成, 可直接插入' },
    { id: 'DEMO-S2', strategy: 'NEXT_FREE' as const, strategyLabel: '最近空闲', deviceId: 'DEV-DR1', deviceName: 'DR-1 检查室', modality: 'DR', technician: '王磊', startInMin: 20, waitMin: 20, conflictCount: 0, conflicts: [], feasibility: 'OK' as const, note: 'DR-1 检查室 20 分钟后空闲' },
    { id: 'DEMO-S3', strategy: 'SPARE_DEVICE' as const, strategyLabel: '备用设备', deviceId: 'DEV-CT3', deviceName: 'CT-3 备用检查室', modality, technician: '备用', startInMin: 0, waitMin: 0, conflictCount: 0, conflicts: [], feasibility: 'OK' as const, note: '备用设备立即可用' },
  ]
  return base.map((s, i) => ({
    ...s,
    startMin: i * 20,
    startAt: new Date(now + s.startInMin * 60000).toISOString(),
    endMin: s.startInMin + durationMin,
    endAt: new Date(now + (s.startInMin + durationMin) * 60000).toISOString(),
  }))
}

const DEMO_RECORDS: EmergencyRecord[] = [
  {
    id: 'EMG-WB-1', patientName: '马建军', examItem: '头颅CT平扫', modality: 'CT', priority: 'STAT',
    deviceId: 'DEV-CT2', deviceName: 'CT-2 检查室', technician: '赵志刚',
    startMin: 0, startAt: new Date().toISOString(), endMin: 25, endAt: new Date().toISOString(),
    status: 'INSERTED', conflictCount: 0, adjustments: [], reason: '脑外伤疑似出血', createdAt: new Date().toISOString(),
  },
]

// ============================================================
// 主页面
// ============================================================
type WorkbenchTab = 'today' | 'rooms' | 'retake' | 'handover' | 'emergency'

interface TransitionModalState {
  exam: WorklistItemDto
  action: 'checkin' | 'start'
  note: string
}

interface CompleteModalState {
  exam: WorklistItemDto
  quality: 'ok' | 'retake' | null
  dlp: string
  ctdivol: string
  note: string
  retakeReason: string
}

interface RetakeModalState {
  exam: WorklistItemDto
  reason: string
  note: string
}

// [v3.0.6.11-104 Wave 3A] 检查前核对 (Time-Out) 弹窗状态
interface TimeoutModalState {
  exam: WorklistItemDto
  loading: boolean
  data: TimeoutChecklistDto | null
  checks: Partial<Record<TimeoutChecklistKey, boolean>>
}

const TIMEOUT_ITEM_LABEL: Record<TimeoutChecklistKey, string> = {
  identity: 'techWorkbench.timeoutIdentity',
  bodyPart: 'techWorkbench.timeoutBodyPart',
  allergy: 'techWorkbench.timeoutAllergy',
  pregnancy: 'techWorkbench.timeoutPregnancy',
  isolation: 'techWorkbench.timeoutIsolation',
  consent: 'techWorkbench.timeoutConsent',
}

export default function TechWorkbenchPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('today')

  // ---- 今日检查数据 ----
  const [exams, setExams] = useState<WorklistItemDto[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [overview, setOverview] = useState<WorklistOverviewDto | null>(null)
  const [techStats, setTechStats] = useState<WorklistTechnicianStatsDto | null>(null)
  const [detail, setDetail] = useState<{ techNotes?: string; doseDlp?: number; doseCtdivol?: number } | null>(null)
  const [selectedExam, setSelectedExam] = useState<WorklistItemDto | null>(null)
  const mountedRef = useRef(true)

  const fetchToday = useCallback(async () => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const tomorrow = new Date(today.getTime() + 86400000)
    try {
      const res = await worklistApi.list({
        page: 1,
        pageSize: 200,
        dateFrom: today.toISOString().slice(0, 10),
        dateTo: tomorrow.toISOString().slice(0, 10),
      })
      if (!mountedRef.current) return
      const items = (res.data as { items?: WorklistItemDto[] } | null)?.items ?? []
      if (res.success) {
        setExams(items)
        setLoadError(null)
      } else {
        setLoadError(res.error?.message ?? '加载失败')
      }
    } catch (err) {
      if (!mountedRef.current) return
      setLoadError(err instanceof Error ? err.message : '加载失败')
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }, [])

  const fetchOverview = useCallback(async () => {
    try {
      const [ov, ts] = await Promise.all([worklistApi.getOverview(), worklistApi.getTechnicianStats()])
      if (!mountedRef.current) return
      if (ov.success && ov.data) setOverview(ov.data)
      if (ts.success && ts.data) setTechStats(ts.data)
    } catch { /* 概览不可用不阻断 */ }
  }, [])

  const refresh = useCallback(async () => {
    await invalidateApiCacheByPrefix('/worklist')
    await invalidateApiCacheByPrefix('/exams')
    await Promise.all([fetchToday(), fetchOverview()])
  }, [fetchToday, fetchOverview])

  useEffect(() => {
    mountedRef.current = true
    void refresh()
    realtime.connect()
    const offRefresh = realtime.subscribe('worklist-refresh', () => void fetchToday())
    const offRooms = realtime.subscribe('room-status-refresh', () => void fetchToday())
    const timer = window.setInterval(() => void fetchToday(), 60_000)
    return () => {
      mountedRef.current = false
      window.clearInterval(timer)
      offRefresh()
      offRooms()
    }
  }, [refresh, fetchToday])

  // ---- 一键流转 ----
  const [busy, setBusy] = useState(false)
  const [transitionModal, setTransitionModal] = useState<TransitionModalState | null>(null)
  const [completeModal, setCompleteModal] = useState<CompleteModalState | null>(null)
  const [retakeModal, setRetakeModal] = useState<RetakeModalState | null>(null)
  const [handoverModal, setHandoverModal] = useState<{ exam: WorklistItemDto; toId: string; note: string } | null>(null)
  const [timeoutModal, setTimeoutModal] = useState<TimeoutModalState | null>(null)
  const [techOptions, setTechOptions] = useState<Array<{ id: string; name: string }>>([])

  useEffect(() => {
    let cancelled = false
    userApi.list(0, 200).then(res => {
      if (cancelled) return
      const raw = res.data as unknown
      const items = Array.isArray(raw) ? raw : ((raw as { items?: unknown[] } | null)?.items ?? [])
      const list = (items as UserDto[]).map(u => ({ id: u.id, name: u.fullName ?? u.id }))
      setTechOptions(list.length > 0 ? list : [{ id: 'tech-seed-1', name: '王技师' }])
    }).catch(() => { if (!cancelled) setTechOptions([]) })
    return () => { cancelled = true }
  }, [])

  const saveNoteIfAny = async (examId: string, note: string) => {
    const trimmed = note.trim()
    if (!trimmed) return
    await worklistApi.saveNotes(examId, trimmed)
  }

  // [v3.0.6.11-104 Wave 3A] 检查前核对: 拉取清单 (无条件非必填项默认勾选)
  const openTimeoutModal = useCallback(async (exam: WorklistItemDto) => {
    setTimeoutModal({ exam, loading: true, data: null, checks: {} })
    try {
      const res = await worklistApi.getTimeoutChecklist(exam.id)
      if (!mountedRef.current) return
      if (res.success && res.data) {
        const data = res.data
        const checks: Partial<Record<TimeoutChecklistKey, boolean>> = {}
        data.items.forEach((i) => { checks[i.key] = !i.required })
        setTimeoutModal({ exam, loading: false, data, checks })
      } else {
        message.error(res.error?.message ?? t('techWorkbench.timeoutLoadFailed'))
        setTimeoutModal(null)
      }
    } catch (err) {
      if (!mountedRef.current) return
      message.error(err instanceof Error ? err.message : t('techWorkbench.timeoutLoadFailed'))
      setTimeoutModal(null)
    }
  }, [])

  // [v3.0.6.11-104 Wave 3A] 提交核对 → 通过后自动进入开始确认
  const executeTimeout = useCallback(async () => {
    const state = timeoutModal
    if (!state || !state.data) return
    const missing = state.data.items.filter((i) => i.required && state.checks[i.key] !== true)
    if (missing.length > 0) {
      message.warning(t('techWorkbench.timeoutConfirmAll'))
      return
    }
    setBusy(true)
    try {
      const res = await worklistApi.verifyTimeout(state.exam.id, {
        verifiedBy: user?.name ?? user?.id ?? '当前用户',
        checklist: state.checks,
      })
      if (!res.success) {
        message.error(res.error?.message ?? t('techWorkbench.timeoutFailed'))
        return
      }
      message.success(t('techWorkbench.timeoutSuccess'))
      const verifiedExam = { ...state.exam, timeoutVerified: true }
      setTimeoutModal(null)
      await refresh()
      setTransitionModal({ exam: verifiedExam, action: 'start', note: '' })
    } catch (err) {
      message.error(err instanceof Error ? err.message : t('techWorkbench.timeoutFailed'))
    } finally {
      setBusy(false)
    }
  }, [timeoutModal, user, refresh])

  const timeoutItemDetail = useCallback((state: TimeoutChecklistDto, key: TimeoutChecklistKey): string => {
    switch (key) {
      case 'identity':
        return `${state.patient.name} · ${state.patient.identitySecondary ?? '--'}`
      case 'bodyPart':
        return state.exam.bodyPart ?? '--'
      case 'allergy':
        return state.patient.allergyHistory ?? t('techWorkbench.timeoutNoAllergy')
      case 'pregnancy':
        return t(`techWorkbench.timeoutPregnancy_${state.patient.pregnancyStatus}`)
      case 'isolation':
        return state.patient.isolationFlag ? t('techWorkbench.timeoutIsolationYes') : t('techWorkbench.timeoutIsolationNo')
      case 'consent':
        return t(`techWorkbench.timeoutConsent_${state.consent.status}`)
      default:
        return '--'
    }
  }, [])

  const executeTransition = async (state: TransitionModalState) => {
    setBusy(true)
    try {
      const res = state.action === 'checkin' ? await worklistApi.checkIn(state.exam.id) : await worklistApi.start(state.exam.id)
      if (!res.success) {
        message.error(res.error?.message ?? '操作失败')
        return
      }
      await saveNoteIfAny(state.exam.id, state.note)
      message.success(state.action === 'checkin' ? t('techWorkbench.actionCheckin') + ' ✓' : t('techWorkbench.actionStart') + ' ✓')
      setTransitionModal(null)
      await refresh()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const saveDoseIfAny = async (examId: string, dlp: string, ctdivol: string) => {
    const fields: Record<string, unknown> = {}
    if (dlp.trim() !== '') fields.doseDlp = Number(dlp)
    if (ctdivol.trim() !== '') fields.doseCtdivol = Number(ctdivol)
    if (Object.keys(fields).length === 0) return
    await worklistApi.patch(examId, fields)
  }

  const executeComplete = async (state: CompleteModalState) => {
    if (!state.quality) {
      message.warning(t('techWorkbench.qualityRequired'))
      return
    }
    if (state.quality === 'ok') {
      if (state.dlp.trim() === '' && state.ctdivol.trim() === '') {
        message.warning(t('techWorkbench.doseRequired'))
        return
      }
      if (state.note.trim() === '') {
        message.warning(t('techWorkbench.noteRequired'))
        return
      }
    } else if (!state.retakeReason) {
      message.warning(t('techWorkbench.retakeReasonRequired'))
      return
    }
    setBusy(true)
    try {
      if (state.quality === 'ok') {
        await saveDoseIfAny(state.exam.id, state.dlp, state.ctdivol)
        await saveNoteIfAny(state.exam.id, state.note)
        const res = await worklistApi.complete(state.exam.id)
        if (!res.success) {
          message.error(res.error?.message ?? '完成失败')
          return
        }
        message.success(t('techWorkbench.completedMsg'))
      } else {
        // 重拍: 影像不合格 → QC_REJECT → 重拍登记 (IN_PROGRESS, retakeCount+1, 新检查任务)
        const qc = await worklistApi.updateState(state.exam.id, 'QC_REJECT', state.note || '技师评定图像不合格')
        if (!qc.success) {
          message.error(qc.error?.message ?? '重拍登记失败')
          return
        }
        const rt = await worklistApi.updateState(state.exam.id, 'IN_PROGRESS', state.note || undefined, { retakeReason: state.retakeReason })
        if (!rt.success) {
          message.error(rt.error?.message ?? '重拍登记失败')
          return
        }
        message.success(t('techWorkbench.retakeNote'))
      }
      setCompleteModal(null)
      setSelectedExam(null)
      await refresh()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const executeRetake = async (state: RetakeModalState) => {
    setBusy(true)
    try {
      const qc = await worklistApi.updateState(state.exam.id, 'QC_REJECT', state.note || '质控退回后重拍登记')
      if (!qc.success) {
        message.error(qc.error?.message ?? '重拍登记失败')
        return
      }
      const rt = await worklistApi.updateState(state.exam.id, 'IN_PROGRESS', state.note || undefined, { retakeReason: state.reason })
      if (!rt.success) {
        message.error(rt.error?.message ?? '重拍登记失败')
        return
      }
      message.success(t('techWorkbench.retakeNote'))
      setRetakeModal(null)
      setSelectedExam(null)
      await refresh()
    } catch (err) {
      message.error(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  const handleFlowAction = (action: FlowAction, exam: WorklistItemDto) => {
    if (action === 'start') {
      // [v3.0.6.11-104 Wave 3A] 检查前核对门禁: 未核对先弹 Time-Out, 不允许直接开始
      if (!exam.timeoutVerified) {
        message.warning(t('techWorkbench.timeoutRequiredHint'))
        void openTimeoutModal(exam)
        return
      }
      setTransitionModal({ exam, action, note: '' })
    } else if (action === 'checkin') {
      setTransitionModal({ exam, action, note: '' })
    } else if (action === 'complete') {
      setCompleteModal({ exam, quality: null, dlp: '', ctdivol: '', note: '', retakeReason: '' })
    } else if (action === 'retake') {
      setRetakeModal({ exam, reason: '', note: '' })
    } else if (action === 'resume') {
      void (async () => {
        setBusy(true)
        try {
          const res = await worklistApi.resumeExam(exam.id)
          if (res.success) {
            message.success(t('techWorkbench.actionStart') + ' ✓')
            await refresh()
          } else {
            message.error(res.error?.message ?? '操作失败')
          }
        } catch (err) {
          message.error(err instanceof Error ? err.message : '操作失败')
        } finally {
          setBusy(false)
        }
      })()
    }
  }

  const executeHandover = async () => {
    const state = handoverModal
    if (!state) return
    if (!state.toId) {
      message.warning(t('techWorkbench.techRequired'))
      return
    }
    const fromId = String(state.exam.primaryTechnicianId ?? user?.id ?? '')
    if (!fromId) {
      message.warning(t('techWorkbench.handoverFrom'))
      return
    }
    setBusy(true)
    try {
      const res = await worklistApi.handover(state.exam.id, { fromId, toId: state.toId, note: state.note })
      if (res.success) {
        message.success(t('techWorkbench.handoverSuccess', { from: fromId, to: state.toId }))
        setHandoverModal(null)
        await refresh()
      } else {
        message.error(res.error?.message ?? '交接失败')
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : '交接失败')
    } finally {
      setBusy(false)
    }
  }

  // ---- 概览卡 ----
  const todayStats = useMemo(() => {
    const byStatus = (s: string[]) => exams.filter(e => s.includes(normalizeExamStatus(String(e.state ?? e.status)))).length
    return {
      waiting: byStatus(['SCHEDULED', 'ARRIVED']),
      inProgress: byStatus(['IN_PROGRESS', 'PAUSED']),
      completed: exams.filter(e => normalizeExamStatus(String(e.state ?? e.status)) === 'COMPLETED').length,
      retake: 0,
      total: exams.length,
    }
  }, [exams])

  // ---- 排序: 危急置顶 + 高亮 ----
  const orderedExams = useMemo(() => {
    const active = exams.filter(e => !['COMPLETED', 'CANCELLED', 'PENDING_REPORT', 'QC_PASS'].includes(normalizeExamStatus(String(e.state ?? e.status))))
    const done = exams.filter(e => !active.includes(e))
    const rank = (e: WorklistItemDto) => PRIORITY_META[priorityOf(e)]?.rank ?? 9
    const byTime = (a: WorklistItemDto, b: WorklistItemDto) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? ''))
    return [...active].sort((a, b) => rank(a) - rank(b) || byTime(a, b)).concat([...done].sort(byTime))
  }, [exams])

  const inProgressExams = useMemo(() => exams.filter(e => ['IN_PROGRESS', 'PAUSED'].includes(normalizeExamStatus(String(e.state ?? e.status)))), [exams])

  // ---- 紧急插队 ----
  const [emgForm, setEmgForm] = useState({ modality: 'CT', durationMin: 15, patientName: '', examItem: '', priority: 'URGENT' as ExamPriority, reason: '' })
  const [suggestions, setSuggestions] = useState<EmergencySuggestion[] | null>(null)
  const [suggesting, setSuggesting] = useState(false)
  const [emgRecords, setEmgRecords] = useState<EmergencyRecord[]>(DEMO_RECORDS)
  const [emgTarget, setEmgTarget] = useState<EmergencySuggestion | null>(null)
  const [emgInserting, setEmgInserting] = useState(false)

  const loadEmgRecords = useCallback(async () => {
    try {
      const res = await techOpsApi.records()
      if (res.success) setEmgRecords(res.data)
    } catch { /* 保留演示记录 */ }
  }, [])

  useEffect(() => { void loadEmgRecords() }, [loadEmgRecords])

  const handleSuggest = async () => {
    setSuggesting(true)
    setSuggestions(null)
    try {
      const res = await techOpsApi.suggest({ modality: emgForm.modality, durationMin: emgForm.durationMin })
      if (!res.success) throw new Error('suggest failed')
      setSuggestions(res.data)
    } catch {
      setSuggestions(buildDemoSuggestions(emgForm.modality, emgForm.durationMin))
    } finally {
      setSuggesting(false)
    }
  }

  const handleEmgInsert = async () => {
    if (!emgTarget) return
    setEmgInserting(true)
    try {
      const res = await techOpsApi.insert({
        patientName: emgForm.patientName || '急诊患者',
        examItem: emgForm.examItem || undefined,
        modality: emgForm.modality,
        deviceId: emgTarget.deviceId,
        startMin: emgTarget.startMin,
        durationMin: emgForm.durationMin,
        priority: emgForm.priority,
        reason: emgForm.reason || undefined,
        force: emgTarget.conflictCount > 0,
      })
      if (res.success) {
        message.success(t('techWorkbench.emergencySuccess', { device: emgTarget.deviceName, time: fmtTime(emgTarget.startAt) }))
        void invalidateApiCacheByPrefix('/tech-ops')
        void loadEmgRecords()
      } else {
        message.error(t('techWorkbench.emergencyFailed', { msg: res.data.message }))
      }
      setEmgTarget(null)
    } catch (err) {
      message.error(t('techWorkbench.emergencyFailed', { msg: (err as Error)?.message ?? '未知错误' }))
    } finally {
      setEmgInserting(false)
    }
  }

  // ---- 详情抽屉 ----
  useEffect(() => {
    if (!selectedExam) return
    let cancelled = false
    worklistApi.getById(selectedExam.id)
      .then(res => {
        if (cancelled) return
        const d = (res.data ?? {}) as unknown as Record<string, unknown>
        setDetail({
          techNotes: typeof d.techNotes === 'string' ? d.techNotes : '',
          doseDlp: typeof d.doseDlp === 'number' ? d.doseDlp : undefined,
          doseCtdivol: typeof d.doseCtdivol === 'number' ? d.doseCtdivol : undefined,
        })
      })
      .catch(() => { if (!cancelled) setDetail(null) })
    return () => { cancelled = true }
  }, [selectedExam])

  const renderToday = () => (
    <div>
      {/* 概览卡 */}
      <StatCardGrid minWidth={200} gap={14} style={{ marginBottom: 16 }} testId="tech-workbench-stats">
        <StatCard title={t('techWorkbench.statWaiting')} value={todayStats.waiting} icon={<ListOrdered size={18} />} color="info" sub={t('techWorkbench.statTotal') + ` ${todayStats.total}`} />
        <StatCard title={t('techWorkbench.statInProgress')} value={todayStats.inProgress} icon={<Activity size={18} />} color="warning" sub={overview ? `${t('techWorkbench.statCompleted')} ${overview.completedToday}` : undefined} />
        <StatCard title={t('techWorkbench.statCompleted')} value={overview?.completedToday ?? todayStats.completed} icon={<CheckCircle2 size={18} />} color="success" sub={overview ? `${overview.completedRate}%` : undefined} />
        <StatCard title={t('techWorkbench.statRetake')} value={techStats?.summary?.totalRetake ?? 0} icon={<RefreshCw size={18} />} color="error" sub={techStats ? `${techStats.summary?.retakeRate}%` : undefined} />
      </StatCardGrid>

      {exams.some(isCritical) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 14px', borderRadius: 8,
          background: '#fef2f2', border: '1px solid #fecaca', fontSize: 12, color: '#dc2626', fontWeight: 600,
        }} data-testid="critical-pinned-banner">
          <Siren size={13} /> {t('techWorkbench.emergencyAlert')} ({exams.filter(isCritical).length})
        </div>
      )}

      {/* [v3.0.6.11-104 Wave 3D] 检查流程模板 (登记核对/妊娠询问/摆位/质控) */}
      <WorkflowTemplatePanel style={{ marginBottom: 16 }} />

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
        }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6 }}>
            <ClipboardList size={14} /> {t('techWorkbench.tabToday')}
            <Tag color="blue" style={{ marginLeft: 4 }}>{exams.length}</Tag>
          </span>
          <Button size="small" icon={<RefreshCw size={12} />} loading={loading} onClick={() => void refresh()}>
            {t('techWorkbench.refresh')}
          </Button>
        </div>
        {loading ? (
          <div style={{ padding: 60, textAlign: 'center' }}><Spin tip={t('techWorkbench.loading')} /></div>
        ) : loadError && exams.length === 0 ? (
          <Empty description={`${loadError} · ${t('techWorkbench.emptyToday')}`} style={{ padding: 40 }} />
        ) : orderedExams.length === 0 ? (
          <Empty description={t('techWorkbench.emptyToday')} style={{ padding: 40 }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 980, fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', background: 'var(--content-bg)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thPriority')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thPatient')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thExamItem')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thModality')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thDevice')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thStatus')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thWait')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {orderedExams.map(exam => {
                  const normalized = normalizeExamStatus(String(exam.state ?? exam.status))
                  const crit = isCritical(exam)
                  const pm = PRIORITY_META[priorityOf(exam)] ?? PRIORITY_META.ROUTINE!
                  return (
                    <tr
                      key={exam.id}
                      data-testid={crit ? 'critical-exam-row' : 'exam-row'}
                      style={{
                        borderBottom: '1px solid var(--border-color)',
                        background: crit ? '#fef2f2' : 'var(--bg-card)',
                        borderLeft: crit ? '4px solid #dc2626' : '4px solid transparent',
                        cursor: 'pointer',
                      }}
                      onClick={() => setSelectedExam(exam)}
                    >
                      <td style={{ padding: '10px 12px' }}>
                        <Tag color={pm.color} style={{ background: pm.bg, color: pm.color, border: 'none', fontWeight: 700 }}>
                          {crit && <Zap size={10} style={{ verticalAlign: -1, marginRight: 2 }} />}{pm.label}
                        </Tag>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{exam.patientName}</td>
                      <td style={{ padding: '10px 12px' }}>{exam.examName}</td>
                      <td style={{ padding: '10px 12px' }}><Tag color="geekblue">{exam.modality}</Tag></td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{exam.device?.name ?? exam.deviceName ?? '--'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Tag color={normalized === 'IN_PROGRESS' ? 'magenta' : normalized === 'ARRIVED' ? 'purple' : normalized === 'COMPLETED' ? 'green' : 'blue'}>
                          {displayExamStatus(normalized)}
                        </Tag>
                      </td>
                      <td style={{ padding: '10px 12px', color: waitMin(exam) > 30 ? '#dc2626' : 'var(--text-secondary)' }}>
                        {waitMin(exam) > 0 ? `${waitMin(exam)}min` : '--'}
                      </td>
                      <td style={{ padding: '10px 12px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {normalized === 'SCHEDULED' && (
                            <Button size="small" type="primary" icon={<UserCheck size={11} />} disabled={busy} onClick={() => handleFlowAction('checkin', exam)}>
                              {t('techWorkbench.actionCheckin')}
                            </Button>
                          )}
                          {normalized === 'ARRIVED' && (
                            <>
                              {exam.timeoutVerified ? (
                                <Tag color="green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                  <ShieldCheck size={11} />{t('techWorkbench.timeoutVerifiedTag')}
                                </Tag>
                              ) : (
                                <Tooltip title={t('techWorkbench.timeoutRequiredHint')}>
                                  <Button size="small" icon={<ShieldCheck size={11} />} disabled={busy} onClick={() => void openTimeoutModal(exam)}>
                                    {t('techWorkbench.timeoutAction')}
                                  </Button>
                                </Tooltip>
                              )}
                              <Tooltip title={exam.timeoutVerified ? '' : t('techWorkbench.timeoutRequiredHint')}>
                                <Button size="small" type="primary" icon={<Play size={11} />} disabled={busy || !exam.timeoutVerified} onClick={() => handleFlowAction('start', exam)}>
                                  {t('techWorkbench.actionStart')}
                                </Button>
                              </Tooltip>
                            </>
                          )}
                          {normalized === 'IN_PROGRESS' && (
                            <Button size="small" type="primary" style={{ background: '#059669' }} icon={<CheckCircle2 size={11} />} disabled={busy} onClick={() => handleFlowAction('complete', exam)}>
                              {t('techWorkbench.actionComplete')}
                            </Button>
                          )}
                          {normalized === 'QC_REJECT' && (
                            <Button size="small" danger icon={<RefreshCw size={11} />} disabled={busy} onClick={() => handleFlowAction('retake', exam)}>
                              {t('techWorkbench.actionRetake')}
                            </Button>
                          )}
                          <Button size="small" icon={<FileText size={11} />} onClick={() => setSelectedExam(exam)}>
                            {t('techWorkbench.actionDetail')}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  const renderHandover = () => (
    <div>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
        padding: '14px 18px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <ArrowRightLeft size={14} /> {t('techWorkbench.handoverTitle')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('techWorkbench.handoverDesc')}</div>
      </div>
      {inProgressExams.length === 0 ? (
        <Empty description={t('techWorkbench.handoverNoExam')} style={{ padding: 40 }} />
      ) : (
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760, fontSize: 12.5 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)', background: 'var(--content-bg)' }}>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thPatient')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thExamItem')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thStatus')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.handoverFrom')}</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px' }}>{t('techWorkbench.thActions')}</th>
                </tr>
              </thead>
              <tbody>
                {inProgressExams.map(exam => {
                  const fromId = String(exam.primaryTechnicianId ?? user?.id ?? '')
                  return (
                    <tr key={exam.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{exam.patientName}</td>
                      <td style={{ padding: '10px 12px' }}>{exam.examName}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <Tag color={normalizeExamStatus(String(exam.state ?? exam.status)) === 'PAUSED' ? 'orange' : 'magenta'}>
                          {displayExamStatus(String(exam.state ?? exam.status))}
                        </Tag>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        {exam.primaryTechnician?.fullName ?? exam.primaryTechnicianId ?? '--'}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <Button size="small" icon={<ArrowRightLeft size={11} />} disabled={!fromId || busy} onClick={() => setHandoverModal({ exam, toId: '', note: '' })}>
                          {t('techWorkbench.actionHandover')}
                        </Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )

  const renderEmergency = () => (
    <div>
      <div style={{
        background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)',
        padding: '14px 18px', marginBottom: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Siren size={14} /> {t('techWorkbench.emergencyTitle')}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('techWorkbench.emergencyDesc')}</div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            size="small" style={{ width: 90 }} value={emgForm.modality}
            onChange={v => setEmgForm(f => ({ ...f, modality: v }))}
            options={['CT', 'MR', 'DR', 'DSA', 'MG'].map(m => ({ value: m, label: m }))}
          />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('techOps.duration')}</span>
          <InputNumber size="small" min={5} max={90} value={emgForm.durationMin} onChange={v => setEmgForm(f => ({ ...f, durationMin: v ?? 15 }))} style={{ width: 80 }} addonAfter={t('techOps.min')} />
          <Input size="small" style={{ width: 130 }} placeholder={t('techOps.patientName')} value={emgForm.patientName} onChange={e => setEmgForm(f => ({ ...f, patientName: e.target.value }))} />
          <Input size="small" style={{ width: 150 }} placeholder={t('techOps.examItem')} value={emgForm.examItem} onChange={e => setEmgForm(f => ({ ...f, examItem: e.target.value }))} />
          <Select
            size="small" style={{ width: 90 }} value={emgForm.priority}
            onChange={v => setEmgForm(f => ({ ...f, priority: v }))}
            options={(['STAT', 'URGENT'] as ExamPriority[]).map(p => ({ value: p, label: t(`techOps.priority.${p}`) }))}
          />
          <Button size="small" type="primary" icon={<Flame size={12} />} loading={suggesting} onClick={() => void handleSuggest()}>
            {t('techOps.getSuggestions')}
          </Button>
        </div>
      </div>

      {suggestions !== null && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
            {t('techOps.suggestionTitle')}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {suggestions.length === 0 ? (
              <Empty description={t('techOps.noSlot')} />
            ) : suggestions.map(s => (
              <div key={s.id} style={{
                background: 'var(--bg-card)', border: `1px solid ${s.conflictCount > 0 ? '#f59e0b' : 'var(--border-color)'}`,
                borderRadius: 10, padding: 12,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <Tag color={s.strategy === 'INSERT_NOW' ? 'red' : s.strategy === 'NEXT_FREE' ? 'green' : 'blue'}>{s.strategyLabel}</Tag>
                  {s.conflictCount > 0
                    ? <Tag color="orange" icon={<AlertTriangle size={10} />}>{t('techOps.conflicts', { count: s.conflictCount })}</Tag>
                    : <Tag color="green" icon={<CheckCircle2 size={10} />}>{t('techOps.noConflict')}</Tag>}
                </div>
                <div style={{ fontSize: 12.5, marginBottom: 6 }}>
                  <b>{s.deviceName}</b> <Tag color="geekblue">{s.modality}</Tag>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>
                  {t('techOps.start')} <b style={{ color: s.startInMin <= 10 ? '#059669' : undefined }}>{fmtTime(s.startAt)}</b> ·
                  {t('techOps.wait')} <b style={{ color: '#d97706' }}>{t('techOps.waitMin', { count: s.startInMin })}</b>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 8, minHeight: 28 }}>{s.note}</div>
                <Button size="small" type="primary" block icon={<Siren size={12} />} onClick={() => setEmgTarget(s)}>
                  {t('techOps.insertNow')}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-color)', padding: '14px 18px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1e40af', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <Gauge size={14} /> {t('techWorkbench.emergencyRecords')}
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 400 }}>({emgRecords.length})</span>
        </div>
        {emgRecords.length === 0 ? (
          <Empty description={t('techWorkbench.emergencyEmpty')} style={{ padding: 20 }} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 640, fontSize: 12 }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOps.thPatient')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOps.thItem')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOps.thDevice')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOps.thPriority')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOps.thStart')}</th>
                  <th style={{ textAlign: 'left', padding: '6px 10px' }}>{t('techOps.thRemark')}</th>
                </tr>
              </thead>
              <tbody>
                {emgRecords.map(r => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 600 }}>{r.patientName}</td>
                    <td style={{ padding: '8px 10px' }}>{r.examItem}</td>
                    <td style={{ padding: '8px 10px' }}>{r.deviceName}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <Tag color={r.priority === 'STAT' ? 'red' : 'orange'}>{t(`techOps.priority.${r.priority}`)}</Tag>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#059669' }}>{fmtTime(r.startAt)}</td>
                    <td style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>{r.reason ?? '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <PageContainer background="slate" maxWidth="full" testId="tech-workbench-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <PageHeader
          variant="flex"
          icon={<Zap size={22} />}
          title={t('techWorkbench.title')}
          subtitle={<span style={{ color: 'var(--text-secondary)' }}>{t('techWorkbench.subtitle')}</span>}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button icon={<ClipboardList size={13} />} onClick={() => { window.location.href = '/worklist' }}>
            {t('techWorkbench.openWorklist')}
          </Button>
          <Button icon={<RefreshCw size={13} />} loading={loading} onClick={() => void refresh()}>
            {t('techWorkbench.refresh')}
          </Button>
        </div>
      </div>

      <TabBar
        tabs={[
          { key: 'today', label: t('techWorkbench.tabToday'), icon: <ClipboardList size={13} />, badge: todayStats.waiting + todayStats.inProgress },
          { key: 'rooms', label: t('techWorkbench.tabRooms'), icon: <DoorOpen size={13} /> },
          { key: 'retake', label: t('techWorkbench.tabRetake'), icon: <RefreshCw size={13} /> },
          { key: 'handover', label: t('techWorkbench.tabHandover'), icon: <ArrowRightLeft size={13} />, badge: inProgressExams.length },
          { key: 'emergency', label: t('techWorkbench.tabEmergency'), icon: <Siren size={13} /> },
        ]}
        activeKey={activeTab}
        onChange={k => setActiveTab(k as WorkbenchTab)}
      />

      {activeTab === 'today' && renderToday()}
      {activeTab === 'rooms' && <ExamRoomStatusBoard />}
      {activeTab === 'retake' && <RetakeRateAnalyticsPage />}
      {activeTab === 'handover' && renderHandover()}
      {activeTab === 'emergency' && renderEmergency()}

      {/* ================= 详情抽屉 ================= */}
      <Modal
        open={selectedExam !== null}
        title={t('techWorkbench.detailTitle')}
        onCancel={() => setSelectedExam(null)}
        footer={null}
        width={760}
        destroyOnClose
      >
        {selectedExam && (
          <div>
            <FlowStatusBar
              status={String(selectedExam.state ?? selectedExam.status)}
              busy={busy}
              onAction={action => handleFlowAction(action, selectedExam)}
            />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14, fontSize: 12.5 }}>
              {[
                [t('techWorkbench.thPatient'), `${selectedExam.patientName} (${selectedExam.patient?.gender ?? selectedExam.gender ?? '--'}${selectedExam.age ? `, ${selectedExam.age}岁` : ''})`],
                [t('techWorkbench.thExamItem'), selectedExam.examName],
                [t('techWorkbench.thModality'), selectedExam.modality],
                [t('techWorkbench.thDevice'), selectedExam.device?.name ?? selectedExam.deviceName ?? '--'],
                [t('techWorkbench.thStatus'), displayExamStatus(String(selectedExam.state ?? selectedExam.status))],
                ['检查号', selectedExam.accessionNumber || selectedExam.accessionNo || '--'],
                [t('techWorkbench.doseSection'), detail ? `${detail.doseDlp ?? '--'} ${t('techWorkbench.doseUnitDlp')} / ${detail.doseCtdivol ?? '--'} ${t('techWorkbench.doseUnitCt')}` : t('techWorkbench.dosePlaceholder')],
                [t('techWorkbench.thWait'), `${waitMin(selectedExam)}min`],
              ].map(([label, value]) => (
                <div key={String(label)} style={{ background: 'var(--content-bg)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 600 }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, background: 'var(--content-bg)', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <StickyNote size={11} /> 技师备注
              </div>
              <div style={{ fontSize: 12, whiteSpace: 'pre-wrap', maxHeight: 120, overflow: 'auto', color: 'var(--text-secondary)' }}>
                {detail?.techNotes || '--'}
              </div>
            </div>
            {examStatusToStep(String(selectedExam.state ?? selectedExam.status)) >= 3 && (
              <div style={{ marginTop: 10, fontSize: 11, color: '#059669' }}>
                ✓ {t('techWorkbench.completedMsg')}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ================= 报到/开始确认 (含附注) ================= */}
      <Modal
        open={transitionModal !== null}
        title={transitionModal ? (transitionModal.action === 'checkin' ? t('techWorkbench.actionCheckin') : t('techWorkbench.actionStart')) : ''}
        onCancel={() => setTransitionModal(null)}
        onOk={() => transitionModal && void executeTransition(transitionModal)}
        okText={transitionModal ? (transitionModal.action === 'checkin' ? t('techWorkbench.actionCheckin') : t('techWorkbench.actionStart')) : ''}
        confirmLoading={busy}
        okButtonProps={{ disabled: busy }}
        destroyOnClose
      >
        {transitionModal && (
          <div>
            <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-secondary)' }}>
              {t(transitionModal.action === 'checkin' ? 'techWorkbench.confirmCheckin' : 'techWorkbench.confirmStart', {
                name: transitionModal.exam.patientName,
                item: transitionModal.exam.examName,
              })}
            </div>
            <Input.TextArea
              rows={2}
              value={transitionModal.note}
              onChange={e => setTransitionModal(s => s ? { ...s, note: e.target.value } : s)}
              placeholder={t('techWorkbench.notePlaceholder')}
              maxLength={500}
            />
          </div>
        )}
      </Modal>

      {/* ================= [v3.0.6.11-104 Wave 3A] 检查前核对 (Time-Out) ================= */}
      <Modal
        open={timeoutModal !== null}
        title={<span><ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 6 }} />{t('techWorkbench.timeoutTitle')}</span>}
        onCancel={() => setTimeoutModal(null)}
        onOk={() => void executeTimeout()}
        okText={t('techWorkbench.timeoutConfirm')}
        confirmLoading={busy}
        okButtonProps={{ disabled: busy || timeoutModal?.loading }}
        width={580}
        destroyOnClose
      >
        {timeoutModal?.loading ? (
          <div style={{ textAlign: 'center', padding: 32 }}><Spin /></div>
        ) : timeoutModal?.data ? (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('techWorkbench.timeoutDesc')}</div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14, fontSize: 12.5,
              background: 'var(--content-bg)', borderRadius: 8, padding: '10px 12px',
            }}>
              <div><b>{t('techWorkbench.timeoutIdentityName')}</b>: {timeoutModal.data.patient.name}</div>
              <div><b>{t('techWorkbench.timeoutIdentitySecondary')}</b>: {timeoutModal.data.patient.identitySecondary ?? '--'}</div>
              <div><b>{t('techWorkbench.timeoutBodyPart')}</b>: {timeoutModal.data.exam.bodyPart ?? '--'}</div>
              <div><b>{t('techWorkbench.timeoutAllergy')}</b>: {timeoutModal.data.patient.allergyHistory ?? t('techWorkbench.timeoutNoAllergy')}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timeoutModal.data.items.map(item => (
                <label key={item.key} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12.5, cursor: 'pointer' }}>
                  <Checkbox
                    checked={timeoutModal.checks[item.key] === true}
                    onChange={e => setTimeoutModal(s => s ? { ...s, checks: { ...s.checks, [item.key]: e.target.checked } } : s)}
                  />
                  <span>
                    <b>{t(TIMEOUT_ITEM_LABEL[item.key])}</b>
                    {item.required && <span style={{ color: '#dc2626', marginLeft: 4 }}>*</span>}
                    <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>{timeoutItemDetail(timeoutModal.data!, item.key)}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </Modal>

      {/* ================= 完成检查确认 (强制检查项) ================= */}
      <Modal
        open={completeModal !== null}
        title={t('techWorkbench.completeTitle')}
        onCancel={() => setCompleteModal(null)}
        onOk={() => completeModal && void executeComplete(completeModal)}
        okText={t('techWorkbench.actionComplete')}
        okButtonProps={{ disabled: busy }}
        confirmLoading={busy}
        width={520}
        destroyOnClose
      >
        {completeModal && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {t('techWorkbench.completeDesc')}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>
                <CheckCircle2 size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('techWorkbench.qualityLabel')}
              </div>
              <Radio.Group
                value={completeModal.quality}
                onChange={e => setCompleteModal(s => s ? { ...s, quality: e.target.value } : s)}
                options={[
                  { value: 'ok', label: t('techWorkbench.qualityOk') },
                  { value: 'retake', label: t('techWorkbench.qualityRetake') },
                ]}
              />
            </div>
            {completeModal.quality === 'ok' && (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 8 }}>
                  <Activity size={12} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('techWorkbench.doseSection')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('techWorkbench.dlp')}</div>
                    <InputNumber
                      style={{ width: '100%' }} min={0} max={100000} value={completeModal.dlp ? Number(completeModal.dlp) : undefined}
                      onChange={v => setCompleteModal(s => s ? { ...s, dlp: v !== null && v !== undefined ? String(v) : '' } : s)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('techWorkbench.ctdivol')}</div>
                    <InputNumber
                      style={{ width: '100%' }} min={0} max={10000} value={completeModal.ctdivol ? Number(completeModal.ctdivol) : undefined}
                      onChange={v => setCompleteModal(s => s ? { ...s, ctdivol: v !== null && v !== undefined ? String(v) : '' } : s)}
                    />
                  </div>
                </div>
              </>
            )}
            {completeModal.quality === 'retake' && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('techWorkbench.retakeReason')}</div>
                <Select
                  style={{ width: '100%' }} placeholder={t('techWorkbench.retakeReason')} value={completeModal.retakeReason || undefined}
                  onChange={v => setCompleteModal(s => s ? { ...s, retakeReason: v } : s)}
                  options={RETAKE_REASON_OPTIONS}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>
                <StickyNote size={11} style={{ verticalAlign: -2, marginRight: 4 }} /> {t('techWorkbench.handoverNote')} *
              </div>
              <Input.TextArea
                rows={2}
                value={completeModal.note}
                onChange={e => setCompleteModal(s => s ? { ...s, note: e.target.value } : s)}
                placeholder={t('techWorkbench.notePlaceholder')}
                maxLength={500}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* ================= 重拍登记确认 ================= */}
      <Modal
        open={retakeModal !== null}
        title={t('techWorkbench.actionRetake')}
        onCancel={() => setRetakeModal(null)}
        onOk={() => retakeModal && void executeRetake(retakeModal)}
        okText={t('techWorkbench.actionRetake')}
        okButtonProps={{ disabled: busy, danger: true }}
        confirmLoading={busy}
        destroyOnClose
      >
        {retakeModal && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 12 }}>
              {t('techWorkbench.retakeNote')}
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('techWorkbench.retakeReason')}</div>
              <Select
                style={{ width: '100%' }} placeholder={t('techWorkbench.retakeReason')} value={retakeModal.reason || undefined}
                onChange={v => setRetakeModal(s => s ? { ...s, reason: v } : s)}
                options={RETAKE_REASON_OPTIONS}
              />
            </div>
            <Input.TextArea
              rows={2}
              value={retakeModal.note}
              onChange={e => setRetakeModal(s => s ? { ...s, note: e.target.value } : s)}
              placeholder={t('techWorkbench.notePlaceholder')}
              maxLength={500}
            />
          </div>
        )}
      </Modal>

      {/* ================= 交接班 ================= */}
      <Modal
        open={handoverModal !== null}
        title={t('techWorkbench.handoverTitle')}
        onCancel={() => setHandoverModal(null)}
        onOk={() => void executeHandover()}
        okText={t('techWorkbench.handoverBtn')}
        okButtonProps={{ disabled: busy }}
        confirmLoading={busy}
        destroyOnClose
      >
        {handoverModal && (
          <div>
            <div style={{ marginBottom: 10, fontSize: 13 }}>
              {t('techWorkbench.handoverSelectExam')}: <b>{handoverModal.exam.patientName} · {handoverModal.exam.examName}</b>
            </div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('techWorkbench.handoverTo')}</div>
              <Select
                style={{ width: '100%' }} placeholder={t('techWorkbench.techSelect')} value={handoverModal.toId || undefined}
                onChange={v => setHandoverModal(s => s ? { ...s, toId: v } : s)}
                options={techOptions.map(tech => ({ value: tech.id, label: tech.name }))}
                showSearch optionFilterProp="label"
              />
            </div>
            <Input.TextArea
              rows={2}
              value={handoverModal.note}
              onChange={e => setHandoverModal(s => s ? { ...s, note: e.target.value } : s)}
              placeholder={t('techWorkbench.handoverNote')}
              maxLength={500}
            />
          </div>
        )}
      </Modal>

      {/* ================= 紧急插入确认 ================= */}
      <Modal
        open={emgTarget !== null}
        title={t('techWorkbench.emergencyTitle')}
        onCancel={() => setEmgTarget(null)}
        onOk={() => void handleEmgInsert()}
        okText={t('techOps.insertNow')}
        okButtonProps={{ disabled: emgInserting, danger: true }}
        confirmLoading={emgInserting}
        destroyOnClose
      >
        {emgTarget && (
          <div style={{ fontSize: 13 }}>
            <div style={{ marginBottom: 8 }}>
              {t('techOps.device')} <b>{emgTarget.deviceName}</b>
            </div>
            <div style={{ marginBottom: 8 }}>
              {t('techOps.start')} <b style={{ color: '#059669' }}>{fmtMin(emgTarget.startMin)}</b> · {t('techOps.end')} <b>{fmtMin(emgTarget.endMin)}</b>
              {emgTarget.conflictCount > 0 && (
                <span style={{ color: '#d97706', marginLeft: 8 }}>
                  <AlertTriangle size={11} style={{ verticalAlign: -2 }} /> {t('techOps.conflicts', { count: emgTarget.conflictCount })}
                </span>
              )}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emgTarget.note}</div>
          </div>
        )}
      </Modal>
    </PageContainer>
  )
}
