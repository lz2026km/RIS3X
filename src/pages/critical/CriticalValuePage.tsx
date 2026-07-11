// v3.0.6: Shell component - orchestrates sub-components
import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  ShieldAlert, CheckCircle, CheckSquare,
} from "lucide-react"
import { message } from "antd"
import { criticalApi } from "../../services/api"
import { LoadingBanner, ErrorBanner } from "../../components/feedback"
import { useCriticalStore } from "../../store"
import { toStoreStatus } from "./types"
import type { CriticalValue, FollowUpRecord } from "./types"
import type { NotificationMethod } from "../../services/api/criticalApi"
import { CriticalValueStatsSection } from "./CriticalValueStatsSection"
import { CriticalValueListSection } from "./CriticalValueListSection"
import { CriticalValueModals } from "./CriticalValueModals"
import BatchActionBar from "../../components/batch/BatchActionBar"
import { useOperationLog } from "../../hooks/useOperationLog"
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from "../../hooks/useKeyboardShortcuts"
import { canApprove } from "../../services/auth/rbacService"
import { ClosedLoopTracker5Nodes, DetailPanel } from "."

const MOCK_FOLLOWUP_RECORDS: FollowUpRecord[] = [
  { id: "FU001", time: "2026-05-01 16:30", type: "电话回访", result: "已回复", operator: "李明辉", content: "患者已接收通知，临床已安排急诊CAG检查。", relatedCVId: "CV001", followUpDate: "2026-05-30" },
  { id: "FU002", time: "2026-05-01 15:45", type: "短信确认", result: "已回复", operator: "王秀峰", content: "患者家属已收到短信提醒，确认前往医院途中。", relatedCVId: "CV002" },
  { id: "FU003", time: "2026-05-01 14:20", type: "电话回访", result: "无响应", operator: "刘芳", content: "首次电话无人接听，已发送短信通知，准备二次回访。", relatedCVId: "CV003" },
  { id: "FU004", time: "2026-05-01 11:00", type: "系统通知", result: "已回复", operator: "系统", content: "临床医生已通过系统确认接收危急值通报。", relatedCVId: "CV004" },
  { id: "FU005", time: "2026-04-30 17:30", type: "现场走访", result: "转接成功", operator: "张海涛", content: "急诊科医生接收患者，现场交接完成。", relatedCVId: "CV007" },
  { id: "FU-001", time: "2026-05-30 14:00", type: "电话回访", result: "已回复", operator: "李明辉", content: "冠脉支架术后1个月随访，患者无胸闷胸痛，可自行活动。", relatedCVId: "CV007", followUpDate: "2026-05-30" },
  { id: "FU-002", time: "2026-06-03 09:45", type: "电话回访", result: "已回复", operator: "王秀峰", content: "肺栓塞溶栓后1个月随访，血氧正常，抗凝治疗中。", relatedCVId: "CV010", followUpDate: "2026-06-03" },
]

export default function CriticalValuePage() {
  const navigate = useNavigate()
  const { log } = useOperationLog("critical_value")
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

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const res = await criticalApi.list()
      if (cancelled) return
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setCriticalValues(res.data as unknown as CriticalValue[])
        setLoadError(null)
      } else {
        setLoadError("API 不可用")
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const filtered = criticalValues.filter((cv) => {
    if (search) {
      const s = search.toLowerCase()
      if (!cv.patientName.toLowerCase().includes(s) && !cv.id.toLowerCase().includes(s) && !cv.accessionNumber?.toLowerCase().includes(s)) return false
    }
    const cvStoreStatus = toStoreStatus(String(cv.status))
    if (statusFilter !== "全部" && cvStoreStatus !== statusFilter) return false
    if (modalityFilter !== "全部" && cv.modality !== modalityFilter) return false
    if (severityFilter !== "全部" && cv.severity !== severityFilter) return false
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
  const handleViewDetail = (cv: CriticalValue) => { setSelectedCV(cv); setDetailTab(0) }

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ show: true, message, type })
    setTimeout(() => setToast({ show: false, message: "", type: "success" }), 3000)
  }

  const handleContactClinical = (cv: CriticalValue) => {
    setNotifyCV(cv); setNotifyPhone(cv.phone || ""); setNotifyNotes(""); setNotifyMethod("SYSTEM"); setShowNotifyModal(true)
  }

  const handleConfirmNotify = async () => {
    if (notifyCV) {
      await useCriticalStore.getState().notify(notifyCV.id, notifyMethod as NotificationMethod)
      log("notify", notifyCV.id, { method: notifyMethod })
      showToast("已发送通知")
    }
    setShowNotifyModal(false); setNotifyCV(null)
  }

  const handleConfirmProcess = async () => {
    if (processCV) {
      const currentUserId = "current-user-id"
      if (!canApprove(currentUserId, processCV.reportedBy ?? '')) {
        message.error('禁止自审：不能处理自己报告的危急值')
        setShowProcessModal(false); setProcessCV(null); return
      }
      await useCriticalStore.getState().resolve(processCV.id)
      log("resolve", processCV.id)
      showToast("已处理")
    }
    setShowProcessModal(false); setProcessCV(null)
  }

  const handleTransferToFollowUp = (cv: CriticalValue) => { setTransferCV(cv); setShowTransferModal(true) }

  const handleConfirmTransfer = (followUpDate: string) => {
    if (!transferCV) return
    const followUpId = `FU-${String(criticalValues.filter((c) => c.transferredToFollowUp).length + 1).padStart(3, "0")}`
    setCriticalValues((prev) => prev.map((cv) => cv.id === transferCV.id ? { ...cv, transferredToFollowUp: true, followUpId, followUpDate } : cv))
    const newFollowUpRecord: FollowUpRecord = {
      id: followUpId, time: new Date().toISOString().replace("T", " ").substring(0, 16),
      type: "系统通知", result: "已回复", operator: "系统",
      content: `危急值 ${transferCV.id} 已转随访，计划随访日期：${followUpDate}`,
      relatedCVId: transferCV.id, followUpDate,
    }
    MOCK_FOLLOWUP_RECORDS.push(newFollowUpRecord)
    showToast(`转随访成功！随访编号：${followUpId}，计划随访日期：${followUpDate}`)
    setShowTransferModal(false); setTransferCV(null)
  }

  const handleBatchNotify = () => { setConfirmType("notify"); setConfirmMessage(`确定要批量发送通知给 ${selectedIds.size} 个危急值吗？`); setShowConfirmModal(true) }
  const handleBatchProcess = () => { setConfirmType("process"); setConfirmMessage(`确定要批量标记处理 ${selectedIds.size} 个危急值吗？`); setShowConfirmModal(true) }

  const handleConfirm = async () => {
    if (confirmType === "notify") {
      for (const id of Array.from(selectedIds)) { await useCriticalStore.getState().notify(id, "SYSTEM"); log("batch_notify", id) }
      showToast(`已成功发送 ${selectedIds.size} 条通知`)
    } else {
      for (const id of Array.from(selectedIds)) { await useCriticalStore.getState().resolve(id); log("batch_resolve", id) }
      showToast(`已成功标记处理 ${selectedIds.size} 条记录`)
    }
    setSelectedIds(new Set()); setShowConfirmModal(false)
  }

  useKeyboardShortcuts([
    SHORTCUTS.SUBMIT(() => { if (showProcessModal && processCV) handleConfirmProcess(); else if (showConfirmModal) handleConfirm() }),
    SHORTCUTS.CANCEL(() => { setShowProcessModal(false); setProcessCV(null); setShowNotifyModal(false); setNotifyCV(null); setShowConfirmModal(false); setShowSettings(false); setSelectedCV(null) }),
    SHORTCUTS.REFRESH(() => { setSelectedIds(new Set()) }),
  ])
  useNavigationShortcuts([
    { sequence: ['g', 'c'], action: () => { window.location.href = '/critical-value' }, description: '导航到危急值' },
    { sequence: ['g', 'r'], action: () => { window.location.href = '/reports' }, description: '导航到报告' },
  ])

  const handleBatchAction = (action: string) => {
    if (action === 'acknowledge') { setConfirmType('notify'); setConfirmMessage(`确定要批量确认 ${selectedIds.size} 个危急值吗？`) }
    else if (action === 'resolve') { setConfirmType('process'); setConfirmMessage(`确定要批量处理 ${selectedIds.size} 个危急值吗？`) }
    selectedIds.forEach((id) => log('batch_' + action, id))
    setShowConfirmModal(true)
  }

  return (
    <div data-testid="critical-value-page" style={{ padding: 24, background: '#f1f5f9', minHeight: '100vh' }}>
      {loading && <LoadingBanner message="正在从 API 加载危急值数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <style>{'@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }'}</style>

      <div style={{ background: 'linear-gradient(135deg, #7c2d12 0%, #dc2626 100%)', borderRadius: 10, padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, color: '#fff' }}>
        <div style={{ fontSize: 18 }}>🚨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>v1.0.5 危急值子系统升级 · 18 条规则 + 10分钟通报率 + 8 大分类评估</div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>国家卫健委 2024 版危急值目录 · BI-RADS/Lung-RADS/PI-RADS/CAD-RADS/TI-RADS/RECIST/骨龄/心脏 CTA</div>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => navigate('/critical-value-rule')} style={{ padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>规则配置</button>
          <button onClick={() => navigate('/critical-value-stats')} style={{ padding: '5px 10px', border: '1px solid rgba(255,255,255,0.4)', borderRadius: 4, background: 'rgba(255,255,255,0.15)', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>统计大屏</button>
          <button onClick={() => navigate('/special-assessment?system=birads')} style={{ padding: '5px 10px', border: 'none', borderRadius: 4, background: '#fff', color: '#dc2626', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>8 大分类评估</button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <ShieldAlert size={22} style={{ color: '#dc2626' }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, color: '#1e40af', margin: 0 }}>危急值管理</h1>
          <span style={{ fontSize: 12, color: '#fff', background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', padding: '3px 10px', borderRadius: 10, fontWeight: 600 }}>v4.0 转随访+5节点闭环</span>
        </div>
        <p style={{ fontSize: 12, color: '#64748b', margin: 0, paddingLeft: 32 }}>危急值发现 · 即时预警 · 双环闭环 · 转随访管理 · 5节点追踪 · 全生命周期管理</p>
      </div>

      <CriticalValueStatsSection data={criticalValues} />

      <BatchActionBar
        selectedCount={selectedIds.size}
        onAction={handleBatchAction}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: 'acknowledge', label: '批量确认', icon: <CheckSquare size={14} />, confirm: '确认批量确认?' },
          { key: 'resolve', label: '批量处理', icon: <CheckCircle size={14} />, confirm: '确认批量处理?' },
        ]}
      />

      <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
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
          onContactClinical={handleContactClinical} onTransferToFollowUp={handleTransferToFollowUp}
          criticalValues={criticalValues}
        />
        {selectedCV && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, width: 480 }}>
            <ClosedLoopTracker5Nodes cv={selectedCV} />
            <DetailPanel cv={selectedCV} onClose={() => setSelectedCV(null)} activeTab={detailTab} setActiveTab={setDetailTab} mockFollowUpRecords={MOCK_FOLLOWUP_RECORDS} />
          </div>
        )}
      </div>

      <CriticalValueModals
        toast={toast}
        showProcessModal={showProcessModal} processCV={processCV}
        onConfirmProcess={handleConfirmProcess} onCancelProcess={() => { setShowProcessModal(false); setProcessCV(null) }}
        showNotifyModal={showNotifyModal} notifyCV={notifyCV}
        notifyPhone={notifyPhone} notifyNotes={notifyNotes} notifyMethod={notifyMethod}
        onSetNotifyPhone={setNotifyPhone} onSetNotifyNotes={setNotifyNotes} onSetNotifyMethod={setNotifyMethod}
        onConfirmNotify={handleConfirmNotify} onCancelNotify={() => { setShowNotifyModal(false); setNotifyCV(null) }}
        showConfirmModal={showConfirmModal} confirmMessage={confirmMessage}
        onConfirm={handleConfirm} onCancelConfirm={() => setShowConfirmModal(false)}
        showSettings={showSettings} onCloseSettings={() => setShowSettings(false)} showToastFn={showToast}
        showTransferModal={showTransferModal} transferCV={transferCV}
        onCloseTransfer={() => { setShowTransferModal(false); setTransferCV(null) }}
        onConfirmTransfer={handleConfirmTransfer}
      />
    </div>
  )
}
