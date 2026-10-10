// v3.0.6: Shell component - orchestrates sub-components
import { useState, useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  ShieldAlert, CheckCircle, CheckSquare, Activity, ListOrdered, AlarmClock, BarChart3,
} from "lucide-react"
import { message, Typography } from "antd"
import { t } from "../../i18n/appI18n"
// [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-RCV-04 危急值 10min 通报完成率
import { RqiIndicatorLink } from "../../components/qc/RqiIndicatorLink"
import { useCriticalStore } from "../../store"
import { realtime, type RealtimePayload } from "../../services/realtime"
import { LoadingBanner, ErrorBanner } from "../../components/feedback"
import { toStoreStatus } from "./types"
import type { CriticalValue, FollowUpRecord } from "./types"
import type { NotificationMethod } from "../../services/api/criticalApi"
import { criticalApi } from "../../services/api/criticalApi"
import { CriticalValueStatsSection } from "./CriticalValueStatsSection"
import { CriticalValueListSection } from "./CriticalValueListSection"
import { CriticalValueModals } from "./CriticalValueModals"
import BatchActionBar from "../../components/batch/BatchActionBar"
import { useOperationLog } from "../../hooks/useOperationLog"
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from "../../hooks/useKeyboardShortcuts"
import { canApprove } from "../../services/auth/rbacService"
import { ClosedLoopTracker5Nodes } from "./CriticalValueTimeline"
import { DetailPanel } from "./CriticalValueDetail"
import { criticalExtApi } from "../../services/api"
// [G005 v3.0.6.11-104 Wave 5B] 危急值多入口收敛: 4 个旧页面内嵌为 Tab
// 旧路由 /critical-value-center /critical-value-5step /critical-alert /critical-value-stats → /critical-value?tab=xxx
import CriticalValueCenterPage from "../CriticalValueCenterPage"
import CriticalValue5StepPage from "./CriticalValue5StepPage"
import CriticalAlertPage from "./CriticalAlertPage"
import CriticalValueStatsPage from "../CriticalValueStatsPage"

const { Title } = Typography

const TABS = [
  { key: "workbench", label: t("critical.tabWorkbench"), icon: <ShieldAlert size={15} /> },
  // [v3.0.6.11-104 Wave 5B] 吸收 CriticalValueCenterPage (旧 /critical-value-center)
  { key: "center", label: t("critical.tabCenter"), icon: <Activity size={15} /> },
  // [v3.0.6.11-104 Wave 5B] 吸收 CriticalValue5StepPage (旧 /critical-value-5step)
  { key: "5step", label: t("critical.tab5Step"), icon: <ListOrdered size={15} /> },
  // [v3.0.6.11-104 Wave 5B] 吸收 CriticalAlertPage 聚合列表 (旧 /critical-alert, 含 W2C)
  { key: "alert", label: t("critical.tabAlert"), icon: <AlarmClock size={15} /> },
  // [v3.0.6.11-104 Wave 5B] 吸收 CriticalValueStatsPage 统计扩展 (旧 /critical-value-stats, 含 W2D)
  { key: "stats", label: t("critical.tabStats"), icon: <BarChart3 size={15} /> },
]

export default function CriticalValuePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { log } = useOperationLog("critical_value")
  // [G005 v3.0.6.11-104 Wave 5B] Tab 枢纽: ?tab=workbench|center|5step|alert|stats
  const [activeTab, setActiveTab] = useState<string>(() => searchParams.get("tab") ?? "workbench")
  const [statusFilter, setStatusFilter] = useState<string>("全部")
  const [modalityFilter, setModalityFilter] = useState<string>("全部")
  const [severityFilter, setSeverityFilter] = useState<string>("全部")
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("全部")
  const [dateRange, setDateRange] = useState("2026-05-01")
  const [search, setSearch] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedCV, setSelectedCV] = useState<CriticalValue | null>(null)
  const [detailTab, setDetailTab] = useState(0)
  const [showSettings, setShowSettings] = useState(false)
  const [showProcessModal, setShowProcessModal] = useState(false)
  const [processCV, setProcessCV] = useState<CriticalValue | null>(null)
  const [showTransferModal, setShowTransferModal] = useState(false)
  const [transferCV, setTransferCV] = useState<CriticalValue | null>(null)
  const [criticalValues, setCriticalValues] = useState<CriticalValue[]>([])
  const [followUpRecords, setFollowUpRecords] = useState<FollowUpRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toast, setToast] = useState<{ show: boolean; message: string; type: "success" | "error" }>({ show: false, message: "", type: "success" })
  const [showNotifyModal, setShowNotifyModal] = useState(false)
  const [notifyCV, setNotifyCV] = useState<CriticalValue | null>(null)
  const [notifyPhone, setNotifyPhone] = useState("")
  const [notifyNotes, setNotifyNotes] = useState("")
  const [notifyMethod, setNotifyMethod] = useState<string>("SYSTEM")
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [confirmType, setConfirmType] = useState<"notify" | "process">("notify")
  const [confirmMessage, setConfirmMessage] = useState("")
  const [showVoiceCallModal, setShowVoiceCallModal] = useState(false)
  const [voiceCallCV, setVoiceCallCV] = useState<CriticalValue | null>(null)
  const [voiceCallPhone, setVoiceCallPhone] = useState("")
  const [showReceiptModal, setShowReceiptModal] = useState(false)
  const [receiptCV, setReceiptCV] = useState<CriticalValue | null>(null)
  const [receiptDoctor, setReceiptDoctor] = useState("")
  const [receiptComment, setReceiptComment] = useState("")
  // [W2-A] 升级操作 (POST /criticals/escalate)
  const [showEscalateModal, setShowEscalateModal] = useState(false)
  const [escalateCV, setEscalateCV] = useState<CriticalValue | null>(null)
  const [escalateTo, setEscalateTo] = useState("")
  const [escalateDept, setEscalateDept] = useState("")
  const [escalateReason, setEscalateReason] = useState("")
  // [W2-A] 详情完整信息 + 操作历史 (GET /criticals/:id + /criticals/:id/history)
  const [historyEvents, setHistoryEvents] = useState<{ time: string; event: string; user: string; detail?: string }[]>([])
  const [cvActionBusy, setCvActionBusy] = useState(false)

  // [W2-1] 支持从工作列表跳转携带筛选: ?search=<患者姓名/检查号>&patientId=&examId=
  useEffect(() => {
    const q = searchParams.get("search") ?? searchParams.get("q")
    if (q) setSearch(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      await useCriticalStore.getState().load()
      if (cancelled) return
      const { values, error } = useCriticalStore.getState()
      if (values.length > 0) {
        setCriticalValues(values as unknown as CriticalValue[])
        setLoadError(null)
      } else {
        setLoadError(error ?? t("common.empty.noData"))
      }
      setLoading(false)
      // [W2-4] 患者详情"危急值"跳转: /critical-value?cvId=xxx 自动打开该危急值详情
      const cvId = new URLSearchParams(window.location.search).get("cvId")
      if (cvId) {
        const target = (values as unknown as CriticalValue[]).find((c) => c.id === cvId)
        if (target) setSelectedCV(target)
      }
    })()
    return () => {
      cancelled = true
      // [G005 PERF1] 卸载时释放: 停止 actor + 清除 60s 升级定时器, 防止内存泄漏
      useCriticalStore.getState().dispose?.()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await criticalExtApi.listFollowUpRecords()
        // [G005 P0] 列表形状兼容: MSW 裸数组 / Nest {items,total}
        const followUpItems = Array.isArray(res.data)
          ? (res.data as unknown[])
          : ((res.data as { items?: unknown[] } | null)?.items ?? [])
        if (!cancelled && res.success) {
          setFollowUpRecords(followUpItems as FollowUpRecord[])
        }
      } catch {
        // API may not be available
      }
    })()
    return () => { cancelled = true }
  }, [])

  // [W4-2] 实时推送: 危急值新事件 (创建/通知/升级/回执/状态更新) 即时提示 + 自动刷新
  useEffect(() => {
    realtime.connect()
    const offNotify = realtime.subscribe("notify", (payload: RealtimePayload) => {
      if (payload?.type !== "CRITICAL") return
      const title = typeof payload.title === "string" ? payload.title : t("criticalValuePage.criticalEvent")
      const content = typeof payload.content === "string" ? payload.content : ""
      message.warning({ content: `${title}${content ? "：" + content : ""}`, duration: 6 })
      void useCriticalStore.getState().load()
    })
    const offWorklist = realtime.subscribe("worklist-refresh", () => {
      void useCriticalStore.getState().load()
    })
    return () => {
      offNotify()
      offWorklist()
    }
  }, [])

  // [G005] 危急值时间解析: createdAt 优先, 缺失回退 reportedTime
  const cvTimeMs = (cv: CriticalValue): number => {
    const raw = cv.createdAt || cv.reportedTime || ""
    const ts = Date.parse(raw.includes("T") ? raw : raw.replace(" ", "T"))
    return Number.isNaN(ts) ? Number.NaN : ts
  }

  const filtered = criticalValues.filter((cv) => {
    if (search) {
      const s = search.toLowerCase()
      if (!cv.patientName.toLowerCase().includes(s) && !cv.id.toLowerCase().includes(s) && !cv.accessionNumber?.toLowerCase().includes(s)) return false
    }
    const cvStoreStatus = toStoreStatus(String(cv.status))
    if (statusFilter !== "全部" && cvStoreStatus !== statusFilter) return false
    if (modalityFilter !== "全部" && cv.modality !== modalityFilter) return false
    if (severityFilter !== "全部" && cv.severity !== severityFilter) return false
    // [G005] 时限筛选: createdAt 相对时间窗 (30分钟内/1小时内/2小时内/超时)
    if (timeRangeFilter !== "全部") {
      const ts = cvTimeMs(cv)
      if (!Number.isNaN(ts)) {
        const ageMs = Date.now() - ts
        const WINDOW: Record<string, number> = {
          "30分钟内": 30 * 60 * 1000,
          "1小时内": 60 * 60 * 1000,
          "2小时内": 120 * 60 * 1000,
        }
        if (timeRangeFilter === "超时") {
          if (ageMs <= (WINDOW["2小时内"] ?? 0)) return false
        } else {
          const limitMs = WINDOW[timeRangeFilter]
          if (limitMs !== undefined && ageMs > limitMs) return false
        }
      }
    }
    // [G005] 日期筛选: 只保留所选日期当天及之后创建的危急值
    if (dateRange) {
      const dayStart = Date.parse(`${dateRange}T00:00:00`)
      const ts = cvTimeMs(cv)
      if (!Number.isNaN(dayStart) && !Number.isNaN(ts) && ts < dayStart) return false
    }
    return true
  })

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id)
    setSelectedIds(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(filtered.map((c) => c.id)))
  }

  const handleProcess = (cv: CriticalValue) => { setProcessCV(cv); setShowProcessModal(true) }
  // [W2-A] 详情: 先本地列表即时展示, 再并行拉取完整信息 + 操作历史
  const handleViewDetail = (cv: CriticalValue) => {
    setSelectedCV(cv); setDetailTab(0); setHistoryEvents([])
    void (async () => {
      const [detailRes, historyRes] = await Promise.allSettled([
        criticalApi.getById(cv.id),
        criticalApi.listHistory(cv.id),
      ])
      const detail = detailRes.status === 'fulfilled' ? detailRes.value : null
      if (detail?.success && detail.data) {
        const dto = detail.data as unknown as Record<string, unknown>
        const safe: Record<string, unknown> = {}
        for (const k of ['description', 'finding', 'state', 'notifiedAt', 'voiceCalledAt', 'voiceCalledBy', 'acknowledgedAt', 'confirmedBy', 'confirmedAt', 'confirmedSignature', 'confirmedComment', 'resolvedAt', 'notifiedTo', 'ackedBy', 'resolvedBy']) {
          const v = dto[k]
          if (v !== undefined && v !== null && v !== '') safe[k] = v
        }
        setSelectedCV((prev) => (prev && prev.id === cv.id ? { ...prev, ...safe } : prev))
      }
      const history = historyRes.status === 'fulfilled' ? historyRes.value : null
      if (history?.success && Array.isArray(history.data)) {
        setHistoryEvents((history.data as Array<Record<string, unknown>>).map((h) => ({
          time: String(h.at ?? h.time ?? h.createdAt ?? ''),
          event: String(h.action ?? h.type ?? h.event ?? t('criticalValuePage.operation')),
          user: String(h.by ?? h.user ?? h.operator ?? ''),
          detail: [h.note, h.message, h.detail].find((x) => typeof x === 'string' && x) as string | undefined,
        })))
      }
    })()
  }

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000)
  }

  const handleVoiceCall = (cv: CriticalValue) => {
    setVoiceCallCV(cv); setVoiceCallPhone(cv.phone || ""); setShowVoiceCallModal(true)
  }

  const handleConfirmVoiceCall = async () => {
    setCvActionBusy(true)
    try {
      if (voiceCallCV) {
        await useCriticalStore.getState().voiceCall(voiceCallCV.id, voiceCallPhone)
        log("voice_call", voiceCallCV.id, { phone: voiceCallPhone })
        showToast(t("criticalValuePage.phoneRecorded"))
      }
      setShowVoiceCallModal(false); setVoiceCallCV(null); setVoiceCallPhone("")
    } finally {
      setCvActionBusy(false)
    }
  }

  const handleAcknowledge = async (cv: CriticalValue) => {
    setCvActionBusy(true)
    try {
      await useCriticalStore.getState().acknowledge(cv.id)
      log("acknowledge", cv.id)
      showToast(t("criticalValuePage.clinicalAck"))
    } finally {
      setCvActionBusy(false)
    }
  }

  const handleClinicalReceipt = (cv: CriticalValue) => {
    setReceiptCV(cv); setReceiptDoctor(""); setReceiptComment(""); setShowReceiptModal(true)
  }

  const handleConfirmReceipt = async () => {
    setCvActionBusy(true)
    try {
      if (receiptCV && receiptDoctor) {
        await useCriticalStore.getState().clinicalReceipt(receiptCV.id, { confirmedBy: receiptDoctor, comment: receiptComment })
        log("clinical_receipt", receiptCV.id, { confirmedBy: receiptDoctor })
        showToast(t("criticalValuePage.receiptRecorded"))
      }
      setShowReceiptModal(false); setReceiptCV(null); setReceiptDoctor(""); setReceiptComment("")
    } finally {
      setCvActionBusy(false)
    }
  }

  const handleContactClinical = (cv: CriticalValue) => {
    setNotifyCV(cv); setNotifyPhone(cv.phone || ""); setNotifyNotes(""); setNotifyMethod("SYSTEM"); setShowNotifyModal(true)
  }

  const handleConfirmNotify = async () => {
    setCvActionBusy(true)
    try {
      if (notifyCV) {
        await useCriticalStore.getState().notify(notifyCV.id, notifyMethod as NotificationMethod)
        log("notify", notifyCV.id, { method: notifyMethod })
        showToast(t("criticalValuePage.notifySent"))
      }
      setShowNotifyModal(false); setNotifyCV(null)
    } finally {
      setCvActionBusy(false)
    }
  }

  // [W2-A] 升级: 输入升级对象 + 原因 → POST /criticals/escalate
  const handleEscalate = (cv: CriticalValue) => {
    setEscalateCV(cv); setEscalateTo(""); setEscalateDept(""); setEscalateReason(t("criticalValuePage.escalateTimeout")); setShowEscalateModal(true)
  }

  const handleConfirmEscalate = async () => {
    setCvActionBusy(true)
    try {
      if (escalateCV) {
        const res = await criticalApi.escalate(escalateCV.id, escalateTo, escalateReason || t("criticalValuePage.manualEscalate"))
        log("escalate", escalateCV.id, { to: escalateTo, reason: escalateReason })
        if (res.success) {
          showToast(t("criticalValuePage.escalateSent"))
          setSelectedCV((prev) => (prev && prev.id === escalateCV.id ? { ...prev, status: "escalated", escalatedTo: escalateTo } : prev))
          void useCriticalStore.getState().load()
        } else {
          showToast(res.error?.message ?? t("criticalValuePage.escalateFailed"), "error")
        }
      }
      setShowEscalateModal(false); setEscalateCV(null); setEscalateTo(""); setEscalateDept(""); setEscalateReason("")
    } finally {
      setCvActionBusy(false)
    }
  }

  // [W2-A] 闭环: PATCH /criticals/:id state=CLOSED_LOOP (5 步页可直达, 列表亦可闭环)
  const handleCloseLoop = async (cv: CriticalValue) => {
    setCvActionBusy(true)
    try {
      const res = await criticalApi.closeLoop(cv.id, "current-user")
      log("close_loop", cv.id)
      if (res.success) {
        showToast(t("criticalValuePage.closedLoop"))
        setSelectedCV((prev) => (prev && prev.id === cv.id ? { ...prev, status: "closed_loop" } : prev))
        void useCriticalStore.getState().load()
      } else {
        showToast(res.error?.message ?? t("criticalValuePage.closeFailed"), "error")
      }
    } finally {
      setCvActionBusy(false)
    }
  }

  // [W2-A] 删除: DELETE /criticals/:id
  const handleDelete = async (cv: CriticalValue) => {
    setCvActionBusy(true)
    try {
      const res = await criticalApi.delete(cv.id)
      log("delete", cv.id)
      if (res.success) {
        showToast(t("criticalValuePage.deleted"))
        setSelectedIds((prev) => { const n = new Set(prev); n.delete(cv.id); return n })
        setSelectedCV((prev) => (prev && prev.id === cv.id ? null : prev))
        void useCriticalStore.getState().load()
      } else {
        showToast(res.error?.message ?? t("criticalValuePage.deleteFailed"), "error")
      }
    } finally {
      setCvActionBusy(false)
    }
  }

  // [W2-A] 直达 5 步闭环工作流
  // [G005 v3.0.6.11-104 Wave 5B] 收敛: 内嵌 Tab 直达 (旧 /critical-value-5step redirect → /critical-value?tab=5step)
  const handleGo5Step = (cv: CriticalValue) => {
    setActiveTab("5step")
    navigate(`/critical-value?tab=5step&cvId=${encodeURIComponent(cv.id)}`)
  }

  const handleConfirmProcess = async () => {
    setCvActionBusy(true)
    try {
      if (processCV) {
        const currentUserId = "current-user-id"
        if (!canApprove(currentUserId, processCV.reportedBy ?? '')) {
          message.error(t('criticalValuePage.selfApproveForbidden'))
          setShowProcessModal(false); setProcessCV(null); return
        }
        await useCriticalStore.getState().resolve(processCV.id)
        log("resolve", processCV.id)
        showToast(t("criticalValuePage.processed"))
      }
      setShowProcessModal(false); setProcessCV(null)
    } finally {
      setCvActionBusy(false)
    }
  }

  const handleTransferToFollowUp = (cv: CriticalValue) => { setTransferCV(cv); setShowTransferModal(true) }

  const handleConfirmTransfer = (followUpDate: string) => {
    if (!transferCV) return
    const followUpId = `FU-${String(criticalValues.filter((c) => c.transferredToFollowUp).length + 1).padStart(3, "0")}`
    setCriticalValues((prev) => prev.map((cv) => cv.id === transferCV.id ? { ...cv, transferredToFollowUp: true, followUpId, followUpDate } : cv))
    const newFollowUpRecord: FollowUpRecord = {
      id: followUpId, time: new Date().toISOString().replace("T", " ").substring(0, 16),
      type: t("criticalValuePage.followUpType") as FollowUpRecord["type"], result: t("criticalValuePage.followUpResult") as FollowUpRecord["result"], operator: t("criticalValuePage.followUpOperator"),
      content: t('w9c.critical.transferredFollowUp', { id: transferCV.id, date: followUpDate }),
      relatedCVId: transferCV.id, followUpDate,
    }
    setFollowUpRecords(prev => [...prev, newFollowUpRecord])
    showToast(t('w9c.critical.transferFollowUpSuccess', { id: followUpId, date: followUpDate }))
    setShowTransferModal(false); setTransferCV(null)
  }

  const handleBatchNotify = () => { setConfirmType("notify"); setConfirmMessage(t('w9c.critical.confirmBatchNotify', { count: selectedIds.size })); setShowConfirmModal(true) }
  const handleBatchProcess = () => { setConfirmType("process"); setConfirmMessage(t('w9c.critical.confirmBatchProcess', { count: selectedIds.size })); setShowConfirmModal(true) }

  const handleConfirm = async () => {
    setCvActionBusy(true)
    try {
      if (confirmType === "notify") {
        for (const id of Array.from(selectedIds)) { await useCriticalStore.getState().notify(id, "SYSTEM"); log("batch_notify", id) }
        showToast(t('w9c.critical.batchNotifySuccess', { count: selectedIds.size }))
      } else {
        for (const id of Array.from(selectedIds)) { await useCriticalStore.getState().resolve(id); log("batch_resolve", id) }
        showToast(t('w9c.critical.batchProcessSuccess', { count: selectedIds.size }))
      }
      setSelectedIds(new Set()); setShowConfirmModal(false)
    } finally {
      setCvActionBusy(false)
    }
  }

  useKeyboardShortcuts([
    SHORTCUTS.SUBMIT(() => { if (showProcessModal && processCV) handleConfirmProcess(); else if (showConfirmModal) handleConfirm() }),
    SHORTCUTS.CANCEL(() => { setShowProcessModal(false); setProcessCV(null); setShowNotifyModal(false); setNotifyCV(null); setShowVoiceCallModal(false); setVoiceCallCV(null); setShowReceiptModal(false); setReceiptCV(null); setShowConfirmModal(false); setShowSettings(false); setSelectedCV(null) }),
    SHORTCUTS.REFRESH(() => { setSelectedIds(new Set()) }),
  ])
  useNavigationShortcuts([
    { sequence: ['g', 'c'], action: () => { window.location.href = '/critical-value' }, description: t('criticalValuePage.navCritical') },
    { sequence: ['g', 'r'], action: () => { window.location.href = '/reports' }, description: t('criticalValuePage.navReport') },
  ])

  const handleBatchAction = (action: string) => {
    if (action === 'acknowledge') { setConfirmType('notify'); setConfirmMessage(t('w9c.critical.confirmBatchAck', { count: selectedIds.size })) }
    else if (action === 'resolve') { setConfirmType('process'); setConfirmMessage(t('w9c.critical.confirmBatchResolve', { count: selectedIds.size })) }
    selectedIds.forEach((id) => log('batch_' + action, id))
    setShowConfirmModal(true)
  }

  return (
    <div data-testid="critical-value-page" style={{ padding: 'var(--space-6, 24px)', background: 'var(--bg-primary)',}}>
      {loading && <LoadingBanner message={t("criticalValuePage.loading")} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <style>{'@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }'}</style>

      <div style={{ background: 'linear-gradient(135deg, #7c2d12 0%, var(--color-error-600) 100%)', borderRadius: 10, padding: 'var(--space-3, 12px)', marginBottom: 'var(--space-3, 12px)', display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', color: '#fff' }}>
        <div style={{ fontSize: 18 }}></div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{t("criticalValuePage.bannerTitle")}</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>{t("criticalValuePage.bannerDesc")}</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate('/critical-value-rule')} style={{ padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("criticalValuePage.ruleConfig")}</button>
          <button onClick={() => setActiveTab('stats')} style={{ padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("criticalValuePage.statsBoard")}</button>
          <button onClick={() => navigate('/special-assessment?system=birads')} style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--color-error-600)', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>{t("criticalValuePage.assessment8")}</button>
        </div>
      </div>

      <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-1, 4px)' }}>
          <ShieldAlert size={22} style={{ color: 'var(--color-error-600)' }} />
          <Title level={4} style={{ margin: 0 }}>{t("criticalValuePage.title")}</Title>
          <span style={{ fontSize: 12, color: '#fff', background: 'linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-500) 100%)', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>{t("criticalValuePage.versionBadge")}</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted, #64748b)', margin: 0, paddingLeft: 'var(--space-8, 32px)' }}>{t("criticalValuePage.subtitle")}</p>
      </div>

      {/* [v3.0.6.11-105 Wave 2C] 国标指标联动: RQI-RCV-04 危急值 10min 通报完成率 */}
      <RqiIndicatorLink code="RQI-RCV-04" />

      {/* [G005 v3.0.6.11-104 Wave 5B] 多入口收敛: Tab 枢纽导航 (照 QCPage 内嵌模式) */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 6, marginBottom: 'var(--space-4, 16px)', display: 'flex', gap: 'var(--space-1, 4px)', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
                background: isActive ? 'var(--color-error-600)' : 'transparent',
                color: isActive ? '#fff' : '#64748b',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'all 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </div>

      {activeTab === 'workbench' && (
        <>
      <CriticalValueStatsSection data={criticalValues} />

      <BatchActionBar
        selectedCount={selectedIds.size}
        onAction={handleBatchAction}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: 'acknowledge', label: t('criticalValuePage.batchAck'), icon: <CheckSquare size={14} />, confirm: t('criticalValuePage.batchAckConfirm') },
          { key: 'resolve', label: t('criticalValuePage.batchProcess'), icon: <CheckCircle size={14} />, confirm: t('criticalValuePage.batchProcessConfirm') },
        ]}
      />

      <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', alignItems: 'flex-start' }}>
        <CriticalValueListSection
          search={search} setSearch={setSearch}
          statusFilter={statusFilter} setStatusFilter={setStatusFilter}
          modalityFilter={modalityFilter} setModalityFilter={setModalityFilter}
          severityFilter={severityFilter} setSeverityFilter={setSeverityFilter}
          timeRangeFilter={timeRangeFilter} setTimeRangeFilter={setTimeRangeFilter}
          dateRange={dateRange} setDateRange={setDateRange}
          onBatchNotify={handleBatchNotify} onBatchProcess={handleBatchProcess}
          selectedCount={selectedIds.size} onOpenSettings={() => setShowSettings(true)}
          filtered={filtered} selectedIds={selectedIds}
          onToggleSelect={toggleSelect} onToggleSelectAll={toggleSelectAll}
          onProcess={handleProcess} onViewDetail={handleViewDetail}
          onContactClinical={handleContactClinical} onVoiceCall={handleVoiceCall} onClinicalReceipt={handleClinicalReceipt} onAcknowledge={handleAcknowledge} onTransferToFollowUp={handleTransferToFollowUp}
          onEscalate={handleEscalate} onCloseLoop={handleCloseLoop} onDelete={handleDelete} onGo5Step={handleGo5Step}
          actionBusy={cvActionBusy}
          criticalValues={criticalValues}
        />
        {selectedCV && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)', width: 480 }}>
            <ClosedLoopTracker5Nodes cv={selectedCV} />
            <DetailPanel cv={selectedCV} onClose={() => setSelectedCV(null)} activeTab={detailTab} setActiveTab={setDetailTab} followUpRecords={followUpRecords} historyEvents={historyEvents} />
          </div>
        )}
      </div>
        </>
      )}

      {/* [G005 v3.0.6.11-104 Wave 5B] 内嵌 Tab: 危急值中心 (旧 /critical-value-center) */}
      {activeTab === 'center' && (
        <div data-testid="critical-value-center-embedded"><CriticalValueCenterPage /></div>
      )}

      {/* [G005 v3.0.6.11-104 Wave 5B] 内嵌 Tab: 5 步闭环 (旧 /critical-value-5step) */}
      {activeTab === '5step' && (
        <div data-testid="critical-value-5step-embedded"><CriticalValue5StepPage /></div>
      )}

      {/* [G005 v3.0.6.11-104 Wave 5B] 内嵌 Tab: 告警列表 (旧 /critical-alert, 保留 W2C 聚合列表) */}
      {activeTab === 'alert' && (
        <div data-testid="critical-alert-embedded"><CriticalAlertPage /></div>
      )}

      {/* [G005 v3.0.6.11-104 Wave 5B] 内嵌 Tab: 统计大屏 (旧 /critical-value-stats, 保留 W2D 统计扩展) */}
      {activeTab === 'stats' && (
        <div data-testid="critical-value-stats-embedded"><CriticalValueStatsPage /></div>
      )}

      <CriticalValueModals
        toast={toast}
        confirmBusy={cvActionBusy}
        showProcessModal={showProcessModal} processCV={processCV}
        onConfirmProcess={handleConfirmProcess} onCancelProcess={() => { setShowProcessModal(false); setProcessCV(null) }}
        showNotifyModal={showNotifyModal} notifyCV={notifyCV}
        notifyPhone={notifyPhone} notifyNotes={notifyNotes} notifyMethod={notifyMethod}
        onSetNotifyPhone={setNotifyPhone} onSetNotifyNotes={setNotifyNotes} onSetNotifyMethod={setNotifyMethod}
        onConfirmNotify={handleConfirmNotify} onCancelNotify={() => { setShowNotifyModal(false); setNotifyCV(null) }}
        showVoiceCallModal={showVoiceCallModal} voiceCallCV={voiceCallCV}
        voiceCallPhone={voiceCallPhone} onSetVoiceCallPhone={setVoiceCallPhone}
        onConfirmVoiceCall={handleConfirmVoiceCall} onCancelVoiceCall={() => { setShowVoiceCallModal(false); setVoiceCallCV(null); setVoiceCallPhone("") }}
        showReceiptModal={showReceiptModal} receiptCV={receiptCV}
        receiptDoctor={receiptDoctor} receiptComment={receiptComment}
        onSetReceiptDoctor={setReceiptDoctor} onSetReceiptComment={setReceiptComment}
        onConfirmReceipt={handleConfirmReceipt} onCancelReceipt={() => { setShowReceiptModal(false); setReceiptCV(null); setReceiptDoctor(""); setReceiptComment("") }}
        showConfirmModal={showConfirmModal} confirmMessage={confirmMessage}
        onConfirm={handleConfirm} onCancelConfirm={() => setShowConfirmModal(false)}
        showSettings={showSettings} onCloseSettings={() => setShowSettings(false)} showToastFn={showToast}
        showTransferModal={showTransferModal} transferCV={transferCV}
        onCloseTransfer={() => { setShowTransferModal(false); setTransferCV(null) }}
        onConfirmTransfer={handleConfirmTransfer}
        showEscalateModal={showEscalateModal} escalateCV={escalateCV}
        escalateTo={escalateTo} escalateDept={escalateDept} escalateReason={escalateReason}
        onSetEscalateTo={setEscalateTo} onSetEscalateDept={setEscalateDept} onSetEscalateReason={setEscalateReason}
        onConfirmEscalate={handleConfirmEscalate} onCancelEscalate={() => { setShowEscalateModal(false); setEscalateCV(null) }}
      />
    </div>
  )
}
