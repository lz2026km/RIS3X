// [v3.0.6.11-96 Wave 3A P1] 检查执行详情公共视图:
// WorklistDetailDrawer (AppDrawer) 与 ExamDetailPage (/exam/:id 独立路由) 共用。
// 四页签: 基本信息/影像信息/历史检查/操作日志 + 状态流转 + 行操作按钮。
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  User,
  AlertTriangle,
  Zap,
  UserCog,
  Stethoscope,
  Image,
  Images,
  History,
  Clipboard,
  ClipboardList,
  Edit3,
  UserCheck,
  FileText,
  ArrowLeftRight,
  XCircle,
  Printer,
  Play,
  Pause,
  RefreshCw,
  CheckCircle,
  CalendarPlus,
  Clock,
  StickyNote,
  Activity,
} from "lucide-react";
import {
  initialModalityDevices,
  initialExamRooms,
  initialUsers,
} from "../../data/initialData";
import type { RadiologyExam } from "../../types";
import { normalizeExamStatus } from "../../utils/statusMaps";
import { examApi } from "../../services/api/examApi";
import { worklistApi } from "../../services/api/worklistApi";
import { RETAKE_REASON_OPTIONS } from "../../services/api/worklistApi";
import { t } from "../../i18n/appI18n";
import { Input, InputNumber, Modal, Radio, Select, message } from "antd";
import type { ExamDto } from "../../types/dto";
// [v3.0.6.11-100 Wave 1B] 设备维护提醒横幅 (设备信息存在时展示)
import DeviceMaintenanceBanner from "../../components/tech/DeviceMaintenanceBanner";
// [G005 W7-Exec] 检查执行面板 (协议/序列/曝光/序列级 QC/剂量)
import { ExecutionPanel } from "../../components/tech/ExecutionPanel";
// [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配 + 交接班
import TechnicianAssignmentEditor from "../../components/worklist/TechnicianAssignmentEditor";
// [v3.0.6.11-103 Wave 11] 技师工作站: 流程状态条 (7 态 + 一键流转)
import FlowStatusBar from "../../components/tech/FlowStatusBar";
// [W6] 检查前核对 (Time-Out) 门禁弹窗
import TimeoutVerifyModal from "../../components/worklist/TimeoutVerifyModal";

const getDoctorById = (doctorId: string) => initialUsers.find(u => u.id === doctorId)

// [v3.0.6.11-96 Wave 3A P1] 导出 DTO → RadiologyExam 转换, 供 ExamDetailPage 复用
export const toRadiologyExamFromDto = (dto: ExamDto & Record<string, unknown>): RadiologyExam => {
  const patient = (dto.patient ?? {}) as Record<string, unknown> | undefined
  return {
    id: String(dto.id ?? dto.examId ?? ''),
    patientId: String(dto.patientId ?? ''),
    patientName: String(patient?.name ?? dto.patientName ?? '未知患者'),
    gender: String(patient?.gender ?? dto.gender ?? '其他') as RadiologyExam['gender'],
    age: Number(patient?.age ?? dto.age ?? 0),
    patientType: String(patient?.patientType ?? dto.patientType ?? '门诊') as RadiologyExam['patientType'],
    // [v3.0.6.11-98 Wave3B P2] 患者扩展信息 (DTO patient 字段, 无则 undefined → 页面 `--`)
    patientPhone: patient?.phone ? String(patient.phone) : undefined,
    patientBirthDate: patient?.birthDate ? String(patient.birthDate).slice(0, 10) : undefined,
    patientWeight: patient?.weight ? String(patient.weight) : undefined,
    examItemId: String(dto.examItemCode ?? ''),
    examItemName: String(dto.examItemName ?? dto.examItem ?? '检查'),
    modality: String(dto.modality ?? 'CT') as RadiologyExam['modality'],
    bodyPart: String(dto.bodyPart ?? '') as RadiologyExam['bodyPart'],
    examDate: String(dto.scheduledAt ?? dto.examDate ?? '').slice(0, 10),
    priority: String(dto.priority ?? '普通') as RadiologyExam['priority'],
    clinicalDiagnosis: dto.clinicalDiagnosis ? String(dto.clinicalDiagnosis) : undefined,
    deviceId: dto.deviceId ? String(dto.deviceId) : undefined,
    roomId: dto.roomId ? String(dto.roomId) : undefined,
    // [v3.0.6.11-92 Wave1B P0] 兼容后端 exam.state 字段 (worklistApi 返回 raw exam)
    status: normalizeExamStatus(String(dto.status ?? dto.state ?? 'SCHEDULED')) as RadiologyExam['status'],
    imagesAcquired: Number(dto.imageCount ?? 0),
    accessionNumber: String(dto.accessionNumber ?? ''),
    // [W6] Time-Out 门禁状态透出 (后端 start 前必须完成核对)
    timeoutVerified: (dto as { timeoutVerified?: boolean }).timeoutVerified === undefined
      ? undefined
      : Boolean((dto as { timeoutVerified?: boolean }).timeoutVerified),
    retakeStatus: ((dto as { retakeStatus?: string | null }).retakeStatus ?? null) as RadiologyExam['retakeStatus'],
    createdTime: String(dto.scheduledAt ?? ''),
    updatedTime: String(dto.updatedAt ?? ''),
  }
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  SCHEDULED: { bg: "#3b82f622", color: "var(--color-primary-500)", label: "examDetail.statusScheduled" },
  ARRIVED: { bg: "#8b5cf622", color: "#7c3aed", label: "examDetail.statusArrived" },
  IN_PROGRESS: { bg: "#ec489922", color: "#db2777", label: "examDetail.statusInProgress" },
  // [v3.0.6.11-95 Wave 1A P1] 暂停态 (backend PAUSED)
  PAUSED: { bg: "#f59e0b22", color: "var(--color-warning-500)", label: "examDetail.statusPaused" },
  COMPLETED: { bg: "#22c55e22", color: "#059669", label: "examDetail.statusCompleted" },
  CANCELLED: { bg: "#ef444422", color: "var(--color-error-500)", label: "examDetail.statusCancelled" },
  // [v3.0.6.11-92 Wave1B P0] 影像质控回写状态 (backend worklist PATCH :id/state)
  IMAGE_READY: { bg: "#10b98122", color: "#0f766e", label: "examDetail.statusImageReady" },
  QC_REJECT: { bg: "#ef444422", color: "var(--color-error-600)", label: "examDetail.statusQcReject" },
  QC_PASS: { bg: "#0ea5e922", color: "#0369a1", label: "examDetail.statusPendingReport" },
  PENDING_REPORT: { bg: "#0ea5e922", color: "#0369a1", label: "examDetail.statusPendingReport" },
  已登记: { bg: "#3b82f622", color: "var(--color-primary-500)", label: "examDetail.statusScheduled" },
  待检查: { bg: "#8b5cf622", color: "#7c3aed", label: "examDetail.statusPendingExam" },
  检查中: { bg: "#ec489922", color: "#db2777", label: "examDetail.statusInProgress" },
  待报告: { bg: "#f59e0b22", color: "#ca8a04", label: "examDetail.statusPendingReport" },
  已报告: { bg: "#22c55e22", color: "#059669", label: "examDetail.statusReported" },
  已发布: { bg: "#22c55e22", color: "#047857", label: "examDetail.statusPublished" },
  已暂停: { bg: "#f59e0b22", color: "var(--color-warning-500)", label: "examDetail.statusPaused" },
  质控退回: { bg: "#ef444422", color: "var(--color-error-500)", label: "examDetail.statusQcReject" },
  图像可用: { bg: "#10b98122", color: "#0f766e", label: "examDetail.statusImageReady" },
};

const PRIORITY_CONFIG: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  普通: { bg: "var(--bg-deep)", color: "var(--text-secondary)", label: "examDetail.priorityNormal" },
  紧急: { bg: "#f59e0b22", color: "var(--color-warning-500)", label: "examDetail.priorityUrgent" },
  危重: { bg: "#ef444422", color: "var(--color-error-500)", label: "examDetail.priorityCritical" },
  会诊: { bg: "#8b5cf622", color: "#7c3aed", label: "examDetail.priorityConsult" },
};

const getDeviceById = (deviceId: string) =>
  initialModalityDevices.find((d) => d.id === deviceId);
const getRoomById = (roomId: string) =>
  initialExamRooms.find((r) => r.id === roomId);

// ============================================================
// ExamDetailView (Drawer 主体 / 独立页共用)
// ============================================================
export interface ExamDetailViewProps {
  exam: RadiologyExam | null;
  onEditInfo?: (exam: RadiologyExam) => void;
  onAssignDevice?: (exam: RadiologyExam) => void;
  onAssignDoctor?: (exam: RadiologyExam) => void;
  onViewRequisition?: (exam: RadiologyExam) => void;
  onWriteReport?: (exam: RadiologyExam) => void;
  onStartExam?: (exam: RadiologyExam) => void;
  onCancelExam?: (exam: RadiologyExam) => void;
  // [G005 Wave1A W9] 状态流转成功后的刷新回调
  onStatusChanged?: () => void;
  // [v3.0.6.11-96 Wave 3A P1] 状态流转成功后的收尾回调 (Drawer: 关闭; 独立页: 重载详情)
  onStatusSuccess?: () => void;
  initialTab?: "info" | "images" | "history" | "log" | "timeline";
}

export function ExamDetailView({
  exam,
  onEditInfo,
  onAssignDevice,
  onAssignDoctor,
  onViewRequisition,
  onWriteReport,
  onStartExam,
  onCancelExam,
  onStatusChanged,
  onStatusSuccess,
  initialTab = "info",
}: ExamDetailViewProps) {
  const [activeTab, setActiveTab] = useState<
    "info" | "images" | "history" | "log" | "timeline"
  >(initialTab);
  const [historyExams, setHistoryExams] = useState<RadiologyExam[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const lastExamIdRef = useRef<string | null>(null)

  // [v3.0.6.11-103 Wave 1B] 检查时间线: GET /worklist/timeline/:id (登记→签到→开始→暂停→完成→质控 事件流)
  const [timelineEvents, setTimelineEvents] = useState<Array<{ type: string; label: string; timestamp: string; actor?: string; note?: string }>>([])
  const [timelineLoading, setTimelineLoading] = useState(false)
  const [timelineError, setTimelineError] = useState<string | null>(null)

  // [v3.0.6.11-103 Wave 1B] 技师备注: GET /worklist/:id → techNotes + POST /worklist/:id/notes
  const [techNotes, setTechNotes] = useState("")
  const [notesText, setNotesText] = useState("")
  const [notesSaving, setNotesSaving] = useState(false)

  // [v3.0.6.11-98 Wave3B P2] 操作日志: worklistApi.getById 返回 ops[] (op/createdAt/actor.fullName),
  //   无数据时展示「暂无操作记录」空态 (替代 -96 伪造时间线)
  const [opsLog, setOpsLog] = useState<Array<{ time: string; event: string; operator: string }>>([])
  const [opsLoading, setOpsLoading] = useState(false)

  // [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师 (worklistApi.getById → primaryTechnician/backupTechnician)
  const [techAssignment, setTechAssignment] = useState<{
    primary?: { id: string; fullName: string } | null
    backup?: { id: string; fullName: string } | null
  }>({ primary: null, backup: null })
  const [techEditorOpen, setTechEditorOpen] = useState(false)
  const [techEditorMode, setTechEditorMode] = useState<"assign" | "handover">("assign")

  useEffect(() => {
    if (!exam) return
    let cancelled = false
    worklistApi.getById(exam.id)
      .then((res) => {
        if (cancelled) return
        const d = res.data
        setTechAssignment({ primary: d?.primaryTechnician ?? null, backup: d?.backupTechnician ?? null })
      })
      .catch(() => { if (!cancelled) setTechAssignment({ primary: null, backup: null }) })
    return () => { cancelled = true }
  }, [exam?.id])

  // [G005 Wave1A W9] 状态流转: worklistApi checkin/start/complete/cancel (后端 POST /worklist/:id/*)
  // [v3.0.6.11-95 Wave 1A P1] + pause/resume (暂停/继续), retake (QC_REJECT → 重拍登记)
  const [statusBusy, setStatusBusy] = useState<"checkin" | "start" | "complete" | "cancel" | "pause" | "resume" | "retake" | null>(null)

  // [v3.0.6.11-104 Wave 3D] 重拍审批状态 (pending/approved/rejected)
  const [retakeStatus, setRetakeStatus] = useState<string | null>(null)

  // [W6] 检查前核对 (Time-Out) 门禁弹窗
  const [timeoutOpen, setTimeoutOpen] = useState(false)
  const forceTimeoutRef = useRef(false)

  // [v3.0.6.11-103 Wave 11] 剂量记录 (DLP / CTDIvol) + 完成检查强制检查项
  const [doseDlp, setDoseDlp] = useState<string>("")
  const [doseCtdivol, setDoseCtdivol] = useState<string>("")
  const [doseSaving, setDoseSaving] = useState(false)
  const [completeModal, setCompleteModal] = useState<{
    quality: "ok" | "retake" | null
    dlp: string
    ctdivol: string
    note: string
    retakeReason: string
  } | null>(null)
  const [completeBusy, setCompleteBusy] = useState(false)

  // [v3.0.6.11-103 Wave 11] 打开详情时回显剂量记录 (PATCH /worklist/:id 落库, 新列未迁移回退内存)
  useEffect(() => {
    if (!exam) return
    let cancelled = false
    worklistApi.getById(exam.id)
      .then(res => {
        if (cancelled) return
        const raw = (res.data ?? {}) as unknown as Record<string, unknown>
        setDoseDlp(typeof raw.doseDlp === "number" ? String(raw.doseDlp) : "")
        setDoseCtdivol(typeof raw.doseCtdivol === "number" ? String(raw.doseCtdivol) : "")
        setRetakeStatus(typeof raw.retakeStatus === "string" ? raw.retakeStatus : null)
      })
      .catch(() => { if (!cancelled) { setDoseDlp(""); setDoseCtdivol(""); setRetakeStatus(null) } })
    return () => { cancelled = true }
  }, [exam?.id])

  const handleSaveDose = async () => {
    if (!exam) return
    const fields: Record<string, unknown> = {}
    if (doseDlp.trim() !== "") fields.doseDlp = Number(doseDlp)
    if (doseCtdivol.trim() !== "") fields.doseCtdivol = Number(doseCtdivol)
    if (Object.keys(fields).length === 0) {
      message.warning(t("examDetail.enterDoseValue"))
      return
    }
    setDoseSaving(true)
    try {
      const res = await worklistApi.patch(exam.id, fields)
      if (res.success) {
        message.success(t("examDetail.doseSaved"))
        onStatusChanged?.()
      } else {
        message.error(res.error?.message ?? t("examDetail.doseSaveFailed"))
      }
    } catch {
      message.error(t("examDetail.doseSaveFailed"))
    } finally {
      setDoseSaving(false)
    }
  }

  const saveDoseSilently = async (dlp: string, ctdivol: string) => {
    const fields: Record<string, unknown> = {}
    if (dlp.trim() !== "") fields.doseDlp = Number(dlp)
    if (ctdivol.trim() !== "") fields.doseCtdivol = Number(ctdivol)
    if (Object.keys(fields).length === 0) return
    await worklistApi.patch(exam!.id, fields)
  }

  const executeComplete = async () => {
    const state = completeModal
    if (!state || !exam) return
    if (!state.quality) {
      message.warning(t("examDetail.selectQuality"))
      return
    }
    if (state.quality === "ok") {
      if (state.dlp.trim() === "" && state.ctdivol.trim() === "") {
        message.warning(t("examDetail.doseRequiredWhenOk"))
        return
      }
      if (state.note.trim() === "") {
        message.warning(t("examDetail.noteRequired"))
        return
      }
    } else if (!state.retakeReason) {
      message.warning(t("examDetail.retakeReasonRequired"))
      return
    }
    setCompleteBusy(true)
    try {
      if (state.quality === "ok") {
        await saveDoseSilently(state.dlp, state.ctdivol)
        if (state.note.trim() !== "") await worklistApi.saveNotes(exam.id, state.note)
        const res = await worklistApi.complete(exam.id)
        if (!res.success) {
          message.error(res.error?.message ?? t("examDetail.completeFailed"))
          return
        }
        message.success(t("examDetail.examCompleted"))
      } else {
        const qc = await worklistApi.updateState(exam.id, "QC_REJECT", state.note || "技师评定图像不合格")
        if (!qc.success) {
          message.error(qc.error?.message ?? t("examDetail.qcRejectFailed"))
          return
        }
        // [v3.0.6.11-104 Wave 3D] 重拍登记改为提交重拍申请 (审批通过后才能流转 IN_PROGRESS)
        const req = await worklistApi.requestRetake(exam.id, { reason: state.retakeReason, note: state.note || undefined })
        if (!req.success) {
          message.error(req.error?.message ?? t("examDetail.retakeRequestFailed"))
          return
        }
        setRetakeStatus("pending")
        message.success(t("examDetail.retakeRequested"))
      }
      setCompleteModal(null)
      onStatusChanged?.()
      onStatusSuccess?.()
    } catch {
      message.error(t("examDetail.operationFailed"))
    } finally {
      setCompleteBusy(false)
    }
  }

  const handleStatusAction = async (action: "checkin" | "start" | "complete" | "cancel" | "pause" | "resume" | "retake") => {
    if (!exam) return
    // [v3.0.6.11-103 Wave 11] 完成检查 → 强制检查项 (图像合格/剂量/技师备注)
    if (action === "complete") {
      setCompleteModal({ quality: null, dlp: doseDlp, ctdivol: doseCtdivol, note: "", retakeReason: "" })
      return
    }
    // [W6] 检查前核对 (Time-Out) 门禁: 未核对时先弹核对弹窗, 不允许直接开始
    if (action === "start" && exam.timeoutVerified === false && !forceTimeoutRef.current) {
      message.warning(t("w6Workflow.timeout.requiredHint"))
      setTimeoutOpen(true)
      return
    }
    if (action === "start") forceTimeoutRef.current = false
    setStatusBusy(action)
    try {
      const res =
        action === "checkin"
          ? await worklistApi.checkIn(exam.id)
          : action === "start"
            ? await worklistApi.start(exam.id)
            : action === "pause"
              ? await worklistApi.pauseExam(exam.id)
              : action === "resume"
                ? await worklistApi.resumeExam(exam.id)
                : action === "retake"
                  ? await worklistApi.requestRetake(exam.id, { reason: "other", note: "详情抽屉提交重拍申请" })
                  : await worklistApi.cancel(exam.id, "详情抽屉取消")
      if (res.success) {
        if (action === "retake") setRetakeStatus("pending")
    const actionMessages: Record<string, string> = {
      pause: t("examDetail.examPaused"),
      resume: t("examDetail.examResumed"),
      retake: t("examDetail.retakeRequestedPending"),
    }
        message.success(actionMessages[action] ?? t("examDetail.statusUpdated"))
        onStatusChanged?.()
        onStatusSuccess?.()
      } else if (action === "start" && (res.error?.message ?? "").includes("TIMEOUT_NOT_VERIFIED")) {
        message.warning(t("w6Workflow.timeout.requiredHint"))
        setTimeoutOpen(true)
      } else {
        message.error(res.error?.message ?? t("examDetail.operationFailed"))
      }
    } catch {
      message.error(t("examDetail.operationFailed"))
    }
    setStatusBusy(null)
  }

  // 每次切换检查对象时, 回到 initialTab (行内"历史"按钮 → history 页签)
  useEffect(() => {
    if (exam && exam.id !== lastExamIdRef.current) {
      lastExamIdRef.current = exam.id
      setActiveTab(initialTab)
    }
  }, [exam, initialTab])

  // 历史检查: examApi.list 按 patientId 过滤
  useEffect(() => {
    if (!exam) return
    if (activeTab !== "history") return
    let cancelled = false
    setHistoryLoading(true)
    setHistoryError(null)
    examApi.list({ patientId: exam.patientId, pageSize: 20 } as never)
      .then(res => {
        if (cancelled) return
        const raw = res.data as unknown
        const items = Array.isArray(raw)
          ? raw
          : ((raw as { items?: unknown[] } | null)?.items ?? [])
        const list = (items as Array<ExamDto & Record<string, unknown>>)
          .map(toRadiologyExamFromDto)
          .filter(h => h.id !== exam.id)
        setHistoryExams(list)
        setHistoryLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setHistoryError(t("examDetail.historyLoadFailed"))
        setHistoryLoading(false)
      })
    return () => { cancelled = true }
  }, [exam, activeTab])

  // [v3.0.6.11-98 Wave3B P2] 操作日志页签: worklistApi.getById → ops[] (后端 -95 已加)
  useEffect(() => {
    if (!exam) return
    if (activeTab !== "log") return
    let cancelled = false
    setOpsLoading(true)
    worklistApi.getById(exam.id)
      .then(res => {
        if (cancelled) return
        const raw = (res.data ?? {}) as unknown as Record<string, unknown> & {
          ops?: Array<{ op?: string; createdAt?: string; actor?: { fullName?: string } }>
        }
        setOpsLog(Array.isArray(raw.ops) ? raw.ops.map(o => ({
          time: o.createdAt ? new Date(o.createdAt).toLocaleString("zh-CN", { hour12: false }) : "",
          event: String(o.op ?? t("examDetail.statusChange")),
          operator: o.actor?.fullName ?? t("examDetail.system"),
        })) : [])
        setOpsLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setOpsLog([])
        setOpsLoading(false)
      })
    return () => { cancelled = true }
  }, [exam, activeTab])

  // [v3.0.6.11-103 Wave 1B] 检查时间线页签: GET /worklist/timeline/:id
  useEffect(() => {
    if (!exam) return
    if (activeTab !== "timeline") return
    let cancelled = false
    setTimelineLoading(true)
    setTimelineError(null)
    worklistApi.getTimeline(exam.id)
      .then(res => {
        if (cancelled) return
        if (res.success && res.data) {
          setTimelineEvents(Array.isArray(res.data.events) ? res.data.events.map(e => ({
            type: e.type,
            label: e.label,
            timestamp: e.timestamp,
            actor: e.actor,
            note: e.note,
          })) : [])
        } else {
          setTimelineEvents([])
          setTimelineError(res.error?.message ?? t("examDetail.timelineLoadFailed"))
        }
        setTimelineLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setTimelineEvents([])
        setTimelineError(t("examDetail.timelineLoadFailed"))
        setTimelineLoading(false)
      })
    return () => { cancelled = true }
  }, [exam, activeTab])

  // [v3.0.6.11-103 Wave 1B] 技师备注: 打开详情时回显已有 techNotes
  useEffect(() => {
    if (!exam) return
    let cancelled = false
    worklistApi.getById(exam.id)
      .then(res => {
        if (cancelled) return
        const raw = (res.data ?? {}) as unknown as Record<string, unknown>
        const existing = typeof raw.techNotes === "string" ? raw.techNotes : ""
        setTechNotes(existing)
        setNotesText("")
      })
      .catch(() => { if (!cancelled) setTechNotes("") })
    return () => { cancelled = true }
  }, [exam?.id])

  // [v3.0.6.11-103 Wave 1B] 保存技师备注: POST /worklist/:id/notes (追加带时间戳)
  const handleSaveNotes = async () => {
    if (!exam) return
    const trimmed = notesText.trim()
    if (!trimmed) {
      message.warning(t("examDetail.enterNote"))
      return
    }
    setNotesSaving(true)
    try {
      const res = await worklistApi.saveNotes(exam.id, trimmed)
      if (res.success) {
        const saved = (res.data as { techNotes?: string } | null)?.techNotes
        setTechNotes(typeof saved === "string" ? saved : techNotes ? `${techNotes}\n${trimmed}` : trimmed)
        setNotesText("")
        onStatusChanged?.()
        message.success(t("examDetail.notesSaved"))
      } else {
        message.error(res.error?.message ?? t("examDetail.notesSaveFailed"))
      }
    } catch {
      message.error(t("examDetail.notesSaveFailed"))
    } finally {
      setNotesSaving(false)
    }
  }

  // [v3.0.6.11-98 Wave3B P1] 打印条码: 无 barcode 库 → canvas 绘制确定性条码图并下载 PNG
  const handlePrintBarcode = () => {
    if (!exam) return
    const text = exam.accessionNumber || exam.id
    const canvas = document.createElement("canvas")
    canvas.width = 560
    canvas.height = 160
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    let seed = 0
    for (let i = 0; i < text.length; i++) seed = (seed * 31 + text.charCodeAt(i)) >>> 0
    let x = 24
    let barIdx = 0
    while (x < 536) {
      const w = 1 + ((seed >>> (barIdx * 3)) & 7) % 3
      ctx.fillStyle = barIdx % 2 === 0 ? "#111827" : "#ffffff"
      ctx.fillRect(x, 18, w, 104)
      x += w + 1
      barIdx++
      if (barIdx > 15) { seed = (seed >>> 1) ^ 0x9e3779b9 }
    }
    ctx.fillStyle = "#111827"
    ctx.font = "14px 'Microsoft YaHei', sans-serif"
    ctx.textAlign = "center"
    ctx.fillText(`${exam.patientName}  ${exam.examItemName}  ${text}`, canvas.width / 2, 138)
    const url = canvas.toDataURL("image/png")
    const a = document.createElement("a")
    a.href = url
    a.download = `条码_${text || exam.patientName}.png`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    message.success(t("examDetail.barcodeGenerated"))
  }

  if (!exam) return null;

  const device = getDeviceById(exam.deviceId ?? "");
  const room = getRoomById(exam.roomId ?? "");

  const sc = STATUS_CONFIG[exam.status] || {
    bg: "var(--bg-deep)", color: "var(--text-secondary)",
    label: exam.status,
  };
  const pc = PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG["普通"]!;

  // [v3.0.6.11-98 Wave3B P2] 操作日志: 改用 worklistApi.getById 返回的 ops[] (空 → 空态)
  const examLogs = opsLog

  const DrawerTab = ({
    label,
    tabKey,
    icon,
  }: {
    label: string;
    tabKey: typeof activeTab;
    icon: ReactNode;
  }) => (
    <button
      onClick={() => setActiveTab(tabKey)}
      style={{
        padding: "8px 14px",
        border: "none",
        background: activeTab === tabKey ? "var(--color-primary-800)" : "transparent",
        color: activeTab === tabKey ? "#fff" : "#64748b",
        fontSize: 12,
        fontWeight: 600,
        cursor: "pointer",
        borderRadius: 6,
        display: "flex",
        alignItems: "center",
        gap: 6,
        transition: "all 0.15s",
      }}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-light)",
          background: "var(--content-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--color-primary-800)",
                display: "flex",
                alignItems: "center",
                gap: 'var(--space-2, 8px)',
              }}
            >
              {exam.patientName}
              {exam.priority === "危重" && (
                <AlertTriangle size={18} style={{ color: "var(--color-error-600)" }} />
              )}
              {exam.priority === "紧急" && (
                <Zap size={18} style={{ color: "var(--color-warning-600)" }} />
              )}
            </div>
            <div
              style={{
                display: "flex",
                gap: 'var(--space-2, 8px)',
                marginTop: 'var(--space-2, 8px)',
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  padding: "3px 10px",
                  background: "var(--content-bg)",
                  color: "var(--text-secondary)",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {exam.gender} / {exam.age}{t("examDetail.years")}
              </span>
              <span
                style={{
                  padding: "3px 10px",
                  background:
                    exam.patientType === "急诊"
                      ? "var(--color-error-bg)"
                      : exam.patientType === "住院"
                        ? "var(--color-info-bg)"
                        : "var(--bg-deep)",
                  color:
                    exam.patientType === "急诊"
                      ? "var(--color-error-600)"
                      : exam.patientType === "住院"
                        ? "var(--color-primary-600)"
                        : "#64748b",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {exam.patientType}
              </span>
              <span
                style={{
                  ...pc,
                  padding: "3px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t(pc.label)}
              </span>
              <span
                style={{
                  ...sc,
                  padding: "3px 10px",
                  borderRadius: 12,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {t(sc.label)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* [v3.0.6.11-103 Wave 11] 流程状态条: 7 态 + 一键流转 */}
      <div style={{ padding: "12px 20px 0", background: "var(--content-bg)" }}>
        <FlowStatusBar
          status={exam.status}
          busy={statusBusy !== null}
          onAction={(action) => void handleStatusAction(action)}
        />
      </div>

      {/* [v3.0.6.11-100 Wave 1B] 设备维护提醒 (设备信息存在时) */}
      {exam.deviceId && (
        <div style={{ padding: "12px 20px 0", background: "var(--content-bg)" }}>
          <DeviceMaintenanceBanner deviceId={exam.deviceId} deviceName={device?.name} />
        </div>
      )}

      <div
        style={{
          padding: "12px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          gap: 'var(--space-2, 8px)',
          background: "var(--bg-card)",
        }}
      >
        <DrawerTab label={t("examDetail.tabInfo")} tabKey="info" icon={<User size={12} />} />
        <DrawerTab
          label={t("examDetail.tabImages")}
          tabKey="images"
          icon={<Images size={12} />}
        />
        <DrawerTab
          label={t("examDetail.tabHistory")}
          tabKey="history"
          icon={<History size={12} />}
        />
        <DrawerTab
          label={t("examDetail.tabLog")}
          tabKey="log"
          icon={<Clipboard size={12} />}
        />
        <DrawerTab
          label={t("examDetail.tabTimeline")}
          tabKey="timeline"
          icon={<Clock size={12} />}
        />
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 'var(--space-5, 20px)' }}>
        {activeTab === "info" && (
          <div>
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-primary-800)",
                  marginBottom: 'var(--space-3, 12px)',
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <UserCog size={14} />
                {t("examDetail.patientInfo")}
              </div>
              <div
                style={{
                  background: "var(--content-bg)",
                  borderRadius: 10,
                  padding: 14,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 'var(--space-3, 12px)',
                }}
              >
                {[
                  [t("examDetail.patientId"), exam.patientId],
                  [t("examDetail.name"), exam.patientName],
                  [t("examDetail.gender"), exam.gender],
                  [t("examDetail.age"), exam.age + t("examDetail.years")],
                  [t("examDetail.patientType"), exam.patientType],
                  // [v3.0.6.11-98 Wave3B P2] 患者扩展信息: 真实渲染 (无 → `--`)
                  [t("examDetail.phone"), exam.patientPhone || "--"],
                  [t("examDetail.birthDate"), exam.patientBirthDate || "--"],
                  [t("examDetail.weight"), exam.patientWeight || "--"],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                      }}
                    >
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-primary-800)",
                  marginBottom: 'var(--space-3, 12px)',
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Stethoscope size={14} />
                {t("examDetail.examInfo")}
              </div>
              <div
                style={{ background: "var(--content-bg)", borderRadius: 10, padding: 14 }}
              >
                {[
                  [t("examDetail.examItem"), exam.examItemName],
                  [t("examDetail.examDevice"), device?.name || "-"],
                  [t("examDetail.examRoom"), room?.name || "-"],
                  [t("examDetail.examDate"), exam.examDate],
                  [t("examDetail.examTime"), exam.examTime || "-"],
                  [t("examDetail.deviceType"), exam.modality],
                  [t("examDetail.bodyPart"), exam.bodyPart],
                  [t("examDetail.referringDoctor"), exam.referringDoctorName || getDoctorById(exam.referringDoctorId ?? "")?.name || "-"],
                  [t("examDetail.radiologist"), exam.radiologistName || getDoctorById(exam.radiologistId ?? "")?.name || t("examDetail.unassigned")],
                  [t("examDetail.clinicalDiagnosis"), exam.clinicalDiagnosis || "-"],
                  [t("examDetail.clinicalHistory"), exam.clinicalHistory || "-"],
                  [t("examDetail.examIndications"), exam.examIndications || "-"],
                ].map(([label, value], idx, arr) => (
                  <div
                    key={label}
                    style={{
                      padding: "8px 0",
                      borderBottom:
                        idx < arr.length - 1 ? "1px solid #e2e8f0" : "none",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "var(--text-secondary)",
                        marginBottom: 2,
                      }}
                    >
                      {label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师 + 交接班 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-primary-800)",
                  marginBottom: 'var(--space-3, 12px)',
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <UserCog size={14} />
                {t("examDetail.techCollab")}
              </div>
              <div
                style={{ background: "var(--content-bg)", borderRadius: 10, padding: 14 }}
                data-testid="tech-collab-section"
              >
                <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-3, 12px)', flexWrap: "wrap" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examDetail.primaryTech")}:</span>
                    {techAssignment.primary ? (
                      <span
                        style={{
                          padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: "#2563eb22", color: "var(--color-primary-600)",
                        }}
                        data-testid="tech-primary-tag"
                      >
                        {techAssignment.primary.fullName}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examDetail.unassigned")}</span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examDetail.backupTech")}:</span>
                    {techAssignment.backup ? (
                      <span
                        style={{
                          padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600,
                          background: "#7c3aed22", color: "#7c3aed",
                        }}
                        data-testid="tech-backup-tag"
                      >
                        {techAssignment.backup.fullName}
                      </span>
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examDetail.unassigned")}</span>
                    )}
                  </div>
                  <div style={{ marginLeft: "auto", display: "flex", gap: 'var(--space-2, 8px)' }}>
                    <button
                      onClick={() => { setTechEditorMode("assign"); setTechEditorOpen(true) }}
                      style={{
                        padding: "4px 12px", borderRadius: 6, border: "none", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, background: "var(--color-primary-600)", color: "#fff",
                        display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)',
                      }}
                      data-testid="tech-assign-btn"
                    >
                      <UserCog size={12} /> {t("examDetail.assignTech")}
                    </button>
                    <button
                      onClick={() => { setTechEditorMode("handover"); setTechEditorOpen(true) }}
                      style={{
                        padding: "4px 12px", borderRadius: 6, border: "1px solid var(--color-warning-600)", cursor: "pointer",
                        fontSize: 12, fontWeight: 600, background: "#f59e0b18", color: "var(--color-warning-600)",
                        display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)',
                      }}
                      data-testid="tech-handover-btn"
                    >
                      <ArrowLeftRight size={12} /> {t("examDetail.handover")}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* [v3.0.6.11-103 Wave 11] 剂量记录: DLP / CTDIvol 输入 + 保存 (PATCH /worklist/:id) */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }} data-testid="dose-record-section">
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-primary-800)",
                  marginBottom: 'var(--space-3, 12px)',
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Activity size={14} />
                {t("examDetail.doseRecord")}
              </div>
              <div
                style={{ background: "var(--content-bg)", borderRadius: 10, padding: 14 }}
              >
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>
                      DLP (mGy·cm) {exam.modality === "CT" && <span style={{ color: "var(--color-error-600)" }}>*</span>}
                    </div>
                    <InputNumber
                      style={{ width: "100%" }} min={0} max={100000}
                      value={doseDlp !== "" ? Number(doseDlp) : undefined}
                      onChange={(v) => setDoseDlp(v !== null && v !== undefined ? String(v) : "")}
                      placeholder="0.0"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>
                      CTDIvol (mGy) {exam.modality === "CT" && <span style={{ color: "var(--color-error-600)" }}>*</span>}
                    </div>
                    <InputNumber
                      style={{ width: "100%" }} min={0} max={10000}
                      value={doseCtdivol !== "" ? Number(doseCtdivol) : undefined}
                      onChange={(v) => setDoseCtdivol(v !== null && v !== undefined ? String(v) : "")}
                      placeholder="0.0"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 'var(--space-2, 8px)', flexWrap: "wrap" }}>
                  <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    {exam.modality === "CT" ? t("examDetail.ctDoseRequired") : t("examDetail.nonCtDoseOptional")}
                  </span>
                  <button
                    onClick={() => void handleSaveDose()}
                    disabled={doseSaving}
                    style={{
                      padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, background: "#0d9488", color: "#fff",
                      display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)',
                    }}
                    data-testid="dose-save-btn"
                  >
                    <Activity size={12} /> {doseSaving ? t("examDetail.saving") : t("examDetail.saveDose")}
                  </button>
                </div>
              </div>
            </div>

            {/* [G005 W7-Exec] 检查执行: 协议/序列/曝光参数/序列级 QC/剂量 + 图像数校验 */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <ExecutionPanel examId={exam.id} accessionNumber={exam.accessionNumber} />
            </div>

            {/* [v3.0.6.11-103 Wave 1B] 技师备注: 回显 techNotes + POST /worklist/:id/notes */}
            <div style={{ marginBottom: 'var(--space-5, 20px)' }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--color-primary-800)",
                  marginBottom: 'var(--space-3, 12px)',
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <StickyNote size={14} />
                {t("examDetail.techNotes")}
              </div>
              <div
                style={{ background: "var(--content-bg)", borderRadius: 10, padding: 14 }}
                data-testid="tech-notes-section"
              >
                {techNotes ? (
                  <div
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-color)",
                      borderRadius: 8,
                      padding: "10px 12px",
                      marginBottom: 10,
                      maxHeight: 140,
                      overflow: "auto",
                      fontFamily: "monospace",
                    }}
                  >
                    {techNotes}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
                    {t("examDetail.noTechNotes")}
                  </div>
                )}
                <textarea
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  placeholder={t("examDetail.notesPlaceholder")}
                  style={{
                    width: "100%",
                    minHeight: 64,
                    padding: "8px 10px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 8,
                    fontSize: 12,
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                    resize: "vertical",
                  }}
                />
                <div style={{ display: "flex", gap: 'var(--space-2, 8px)', marginTop: 10, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => void handleSaveNotes()}
                    disabled={notesSaving}
                    style={{
                      padding: "6px 16px", borderRadius: 6, border: "none", cursor: "pointer",
                      fontSize: 12, fontWeight: 600, background: "var(--color-primary-800)", color: "#fff",
                      display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)',
                    }}
                    data-testid="tech-notes-save-btn"
                  >
                    <StickyNote size={12} /> {notesSaving ? t("examDetail.saving") : t("examDetail.saveNotes")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "images" && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-primary-800)",
                marginBottom: 'var(--space-3, 12px)',
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Images size={14} />
              {t("examDetail.imagesAcquired")}
            </div>
            <div
              style={{
                background: "var(--content-bg)",
                borderRadius: 10,
                padding: 'var(--space-5, 20px)',
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: 12,
                  background: "#e2e8f0",
                  margin: "0 auto 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image size={32} style={{ color: "var(--text-secondary)" }} />
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--color-primary-800)" }}>
                {exam.imagesAcquired}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 'var(--space-1, 4px)' }}>
                {t("examDetail.imageCount")}
              </div>
              <div
                style={{
                  marginTop: 'var(--space-4, 16px)',
                  padding: "8px 12px",
                  background: "var(--bg-card)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  border: "1px dashed var(--border-color)",
                }}
              >
                {t("examDetail.viewImageHint")}
              </div>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-primary-800)",
                marginBottom: 'var(--space-3, 12px)',
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <History size={14} />
              {t("examDetail.historyRecords")}
              {!historyLoading && !historyError && (
                <span style={{ fontSize: 12, color: "var(--text-secondary)", fontWeight: 400 }}>
                  {t("examDetail.historyCount", { count: historyExams.length })}
                </span>
              )}
            </div>
            {historyLoading ? (
              <div style={{ background: "var(--content-bg)", borderRadius: 10, padding: 'var(--space-10, 40px)', textAlign: "center", color: "var(--text-secondary)", fontSize: 12 }}>
                {t("examDetail.loadingHistory")}
              </div>
            ) : historyError ? (
              <div style={{ background: "var(--color-error-bg)", borderRadius: 10, padding: 'var(--space-10, 40px)', textAlign: "center", color: "var(--color-error-600)", fontSize: 12 }}>
                {historyError}
              </div>
            ) : historyExams.length > 0 ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                {historyExams.map((hist) => {
                  const histSc = STATUS_CONFIG[hist.status] || {
                    bg: "var(--bg-deep)", color: "var(--text-secondary)",
                    label: hist.status,
                  };
                  return (
                    <div
                      key={hist.id}
                      style={{
                        background: "var(--content-bg)",
                        borderRadius: 10,
                        padding: 'var(--space-3, 12px)',
                        border: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          marginBottom: 'var(--space-2, 8px)',
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            fontSize: 12,
                          }}
                        >
                          {hist.examItemName}
                        </div>
                        <span
                          style={{
                            ...histSc,
                            padding: "2px 8px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {t(histSc.label)}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1fr 1fr",
                          gap: 6,
                          fontSize: 12,
                          color: "var(--text-secondary)",
                        }}
                      >
                        <span>{hist.examDate}</span>
                        <span>{hist.modality}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  background: "var(--content-bg)",
                  borderRadius: 10,
                  padding: 'var(--space-10, 40px)',
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                <History
                  size={32}
                  style={{ margin: "0 auto 12px", opacity: 0.4 }}
                />
                <div style={{ fontSize: 12 }}>{t("examDetail.noHistoryRecords")}</div>
              </div>
            )}
          </div>
        )}

        {activeTab === "log" && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-primary-800)",
                marginBottom: 'var(--space-3, 12px)',
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <ClipboardList size={14} />
              {t("examDetail.operationLog")}
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 11,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "#e2e8f0",
                }}
              />
              {opsLoading ? (
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 10,
                    padding: 'var(--space-10, 40px)',
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: 12 }}>{t("examDetail.loadingLogs")}</div>
                </div>
              ) : examLogs.length === 0 ? (
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 10,
                    padding: 'var(--space-10, 40px)',
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  <ClipboardList
                    size={32}
                    style={{ margin: "0 auto 12px", opacity: 0.4 }}
                  />
                  {/* [v3.0.6.11-98 Wave3B P2] 无 ops 数据空态 */}
                  <div style={{ fontSize: 12 }}>{t("examDetail.noLogs")}</div>
                </div>
              ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {examLogs.map((log, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: "flex",
                      gap: 'var(--space-4, 16px)',
                      paddingBottom: idx < examLogs.length - 1 ? 20 : 0,
                      position: "relative",
                    }}
                  >
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: "50%",
                        background: "var(--color-primary-800)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        flexShrink: 0,
                        zIndex: 1,
                      }}
                    >
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          background: "var(--content-bg)",
                          borderRadius: 8,
                          padding: "10px 14px",
                          border: "1px solid var(--border-color)",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            marginBottom: 'var(--space-1, 4px)',
                          }}
                        >
                          {log.event}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>{log.operator}</span>
                          <span style={{ fontFamily: "monospace" }}>
                            {log.time}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "timeline" && (
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "var(--color-primary-800)",
                marginBottom: 'var(--space-3, 12px)',
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Clock size={14} />
              {t("examDetail.examTimeline")}
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: "var(--text-secondary)" }}>
                GET /worklist/timeline/:id
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <div
                style={{
                  position: "absolute",
                  left: 11,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "#e2e8f0",
                }}
              />
              {timelineLoading ? (
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 10,
                    padding: 'var(--space-10, 40px)',
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ fontSize: 12 }}>{t("examDetail.loadingTimeline")}</div>
                </div>
              ) : timelineError ? (
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 10,
                    padding: 'var(--space-10, 40px)',
                    textAlign: "center",
                    color: "var(--color-error-600)",
                  }}
                >
                  <div style={{ fontSize: 12 }}>{timelineError}</div>
                </div>
              ) : timelineEvents.length === 0 ? (
                <div
                  style={{
                    background: "var(--content-bg)",
                    borderRadius: 10,
                    padding: 'var(--space-10, 40px)',
                    textAlign: "center",
                    color: "var(--text-secondary)",
                  }}
                >
                  <Clock size={32} style={{ margin: "0 auto 12px", opacity: 0.4 }} />
                  <div style={{ fontSize: 12 }}>{t("examDetail.noTimelineEvents")}</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {timelineEvents.map((ev, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        gap: 'var(--space-4, 16px)',
                        paddingBottom: idx < timelineEvents.length - 1 ? 20 : 0,
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: "50%",
                          background: idx === timelineEvents.length - 1 ? "#059669" : "var(--color-primary-800)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          flexShrink: 0,
                          zIndex: 1,
                        }}
                      >
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            background: "var(--content-bg)",
                            borderRadius: 8,
                            padding: "10px 14px",
                            border: "1px solid var(--border-color)",
                          }}
                        >
                          <div
                            style={{
                              fontWeight: 600,
                              color: "var(--text-secondary)",
                              fontSize: 12,
                              marginBottom: 'var(--space-1, 4px)',
                              display: "flex",
                              justifyContent: "space-between",
                              gap: 'var(--space-2, 8px)',
                            }}
                          >
                            <span>{ev.label}</span>
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--text-secondary)",
                                fontFamily: "monospace",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {ev.timestamp ? new Date(ev.timestamp).toLocaleString("zh-CN", { hour12: false }) : ""}
                            </span>
                          </div>
                          {ev.note && (
                            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>
                              {ev.note}
                            </div>
                          )}
                          {ev.actor && (
                            <div style={{ fontSize: 11, color: 'var(--text-muted, #64748b)' }}>{t("examDetail.operator")}: {ev.actor}</div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "16px 16px 0",
          borderTop: "1px solid var(--border-color)",
          background: "var(--content-bg)",
        }}
      >
        {/* [G005 Wave1A W9] 状态流转: worklistApi (POST /worklist/:id/checkin|start|complete|cancel) */}
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--color-primary-800)", marginBottom: 'var(--space-2, 8px)', display: "flex", alignItems: "center", gap: 6 }}>
          <ArrowLeftRight size={12} /> {t("examDetail.statusFlow")}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 10,
          }}
        >
          <button
            onClick={() => void handleStatusAction("checkin")}
            disabled={normalizeExamStatus(exam.status) !== "SCHEDULED" || statusBusy !== null}
            style={{
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: normalizeExamStatus(exam.status) === "SCHEDULED" ? "var(--text-secondary)" : "#94a3b8",
              cursor: normalizeExamStatus(exam.status) === "SCHEDULED" ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <UserCheck size={12} />
            {t("examDetail.checkIn")}
          </button>
          <button
            onClick={() => void handleStatusAction("start")}
            disabled={normalizeExamStatus(exam.status) !== "ARRIVED" || statusBusy !== null}
            style={{
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: normalizeExamStatus(exam.status) === "ARRIVED" ? "var(--text-secondary)" : "#94a3b8",
              cursor: normalizeExamStatus(exam.status) === "ARRIVED" ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Play size={12} />
            {t("examDetail.start")}
          </button>
          <button
            onClick={() => void handleStatusAction("complete")}
            disabled={normalizeExamStatus(exam.status) !== "IN_PROGRESS" || statusBusy !== null}
            style={{
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: normalizeExamStatus(exam.status) === "IN_PROGRESS" ? "var(--text-secondary)" : "#94a3b8",
              cursor: normalizeExamStatus(exam.status) === "IN_PROGRESS" ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <CheckCircle size={12} />
            {t("examDetail.complete")}
          </button>
          <button
            onClick={() => void handleStatusAction("cancel")}
            disabled={!["SCHEDULED", "ARRIVED", "IN_PROGRESS", "PAUSED"].includes(normalizeExamStatus(exam.status)) || statusBusy !== null}
            style={{
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid #fee2e2",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: ["SCHEDULED", "ARRIVED", "IN_PROGRESS", "PAUSED"].includes(normalizeExamStatus(exam.status)) ? "var(--color-error-600)" : "#94a3b8",
              cursor: ["SCHEDULED", "ARRIVED", "IN_PROGRESS", "PAUSED"].includes(normalizeExamStatus(exam.status)) ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <XCircle size={12} />
            {t("examDetail.cancel")}
          </button>
          {/* [v3.0.6.11-95 Wave 1A P1] 暂停 (IN_PROGRESS → PAUSED) */}
          <button
            onClick={() => void handleStatusAction("pause")}
            disabled={normalizeExamStatus(exam.status) !== "IN_PROGRESS" || statusBusy !== null}
            style={{
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: normalizeExamStatus(exam.status) === "IN_PROGRESS" ? "var(--color-warning-600)" : "#94a3b8",
              cursor: normalizeExamStatus(exam.status) === "IN_PROGRESS" ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Pause size={12} />
            {t("examDetail.pause")}
          </button>
          {/* [v3.0.6.11-95 Wave 1A P1] 继续 (PAUSED → IN_PROGRESS) */}
          <button
            onClick={() => void handleStatusAction("resume")}
            disabled={normalizeExamStatus(exam.status) !== "PAUSED" || statusBusy !== null}
            style={{
              padding: "10px 16px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              color: normalizeExamStatus(exam.status) === "PAUSED" ? "var(--color-success-600)" : "#94a3b8",
              cursor: normalizeExamStatus(exam.status) === "PAUSED" ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            <Play size={12} />
            {t("examDetail.resume")}
          </button>
        </div>
        {/* [v3.0.6.11-104 Wave 3D] QC_REJECT → 重拍申请/审批 (未审批不得流转 IN_PROGRESS) */}
        {normalizeExamStatus(exam.status) === "QC_REJECT" && (
          retakeStatus === "pending" ? (
            <div style={{ marginTop: 10, width: "100%", padding: "10px 16px", background: "#f59e0b18", border: "1px solid #f59e0b40", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "var(--color-warning-600)", textAlign: "center" }}>
              {t("examDetail.retakeRequestPending")}
            </div>
          ) : retakeStatus === "approved" ? (
            <button
              onClick={() => void (async () => {
                setStatusBusy("retake")
                try {
                  const res = await worklistApi.updateState(exam.id, "IN_PROGRESS", "重拍采集")
                  if (res.success) { message.success(t("examDetail.enteredRetake")); onStatusChanged?.(); onStatusSuccess?.() }
                  else message.error(res.error?.message ?? t("examDetail.retakeCollectFailed"))
                } catch { message.error(t("examDetail.retakeCollectFailed")) }
                setStatusBusy(null)
              })()}
              disabled={statusBusy !== null}
              style={{ marginTop: 10, width: "100%", padding: "10px 16px", background: "var(--color-success-600)", border: "none", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#fff", cursor: statusBusy !== null ? "not-allowed" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
            >
              <RefreshCw size={12} />
              {t("examDetail.executeRetake")}
            </button>
          ) : (
            <button
              onClick={() => void handleStatusAction("retake")}
              disabled={statusBusy !== null}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "10px 16px",
                background: "var(--color-error-600)",
                border: "none",
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <RefreshCw size={12} />
              {retakeStatus === "rejected" ? t("examDetail.resubmitRetake") : t("examDetail.submitRetake")}
            </button>
          )
        )}
      </div>

      <div
        style={{
          padding: 'var(--space-4, 16px)',
          borderTop: "1px solid var(--border-color)",
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
          background: "var(--content-bg)",
        }}
      >
        <button
          onClick={() => onEditInfo?.(exam)}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Edit3 size={12} />
          {t("examDetail.editInfo")}
        </button>
        <button
          onClick={() => onAssignDevice?.(exam)}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <UserCheck size={12} />
          {t("examDetail.assignDevice")}
        </button>
        <button
          onClick={() => onAssignDoctor?.(exam)}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <UserCheck size={12} />
          {t("examDetail.assignDoctor")}
        </button>
        <button
          onClick={() => onViewRequisition?.(exam)}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <FileText size={12} />
          {t("examDetail.requisition")}
        </button>
        <button
          onClick={() => onWriteReport?.(exam)}
          style={{
            padding: "10px 16px",
            background: normalizeExamStatus(exam.status) === "COMPLETED" ? "var(--color-primary-800)" : "#e2e8f0",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: normalizeExamStatus(exam.status) === "COMPLETED" ? "#fff" : "#94a3b8",
            cursor: normalizeExamStatus(exam.status) === "COMPLETED" ? "pointer" : "not-allowed",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <FileText size={12} />
          {normalizeExamStatus(exam.status) === "COMPLETED" ? t("examDetail.writeReport") : t("examDetail.viewReport")}
        </button>
        <button
          onClick={() => onStartExam?.(exam)}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <ArrowLeftRight size={12} />
          {t("examDetail.startExam")}
        </button>
        <button
          onClick={() => onCancelExam?.(exam)}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid #fee2e2",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--color-error-600)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <XCircle size={12} />
          {t("examDetail.cancelExam")}
        </button>
        <button
          onClick={handlePrintBarcode}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "var(--text-secondary)",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <Printer size={12} />
          {t("examDetail.printBarcode")}
        </button>
        {/* [v3.0.6.11-99 Wave3B] 检查联动: 检查详情 → 创建随访计划 (跳转 /follow-up?examId=..) */}
        <button
          onClick={() => {
            const q = new URLSearchParams({ examId: exam.id, patientId: exam.patientId });
            window.location.href = `/follow-up?${q.toString()}`;
          }}
          style={{
            padding: "10px 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            color: "#059669",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
          }}
        >
          <CalendarPlus size={12} />
          {t("examDetail.createFollowUp")}
        </button>
      </div>

      {/* [v3.0.6.11-103 Wave 11] 完成检查确认: 强制检查项 (图像是否合格/剂量已记录/技师备注) */}
      <Modal
        open={completeModal !== null}
        title={t("examDetail.completeConfirmTitle")}
        onCancel={() => setCompleteModal(null)}
        onOk={() => void executeComplete()}
        okText={t("examDetail.complete")}
        okButtonProps={{ disabled: completeBusy }}
        confirmLoading={completeBusy}
        width={520}
        destroyOnClose
      >
        {completeModal && (
          <div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 'var(--space-3, 12px)' }}>
              {t("examDetail.completeChecklist")}
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                <CheckCircle size={12} style={{ verticalAlign: -2, marginRight: 'var(--space-1, 4px)' }} /> {t("examDetail.imageQualified")}
              </div>
              <Radio.Group
                value={completeModal.quality}
                onChange={(e) => setCompleteModal(s => s ? { ...s, quality: e.target.value } : s)}
                options={[
                  { value: "ok", label: t("examDetail.qualified") },
                  { value: "retake", label: t("examDetail.retake") },
                ]}
              />
            </div>
            {completeModal.quality === "ok" && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 'var(--space-2, 8px)' }}>
                  <Activity size={12} style={{ verticalAlign: -2, marginRight: 'var(--space-1, 4px)' }} /> {t("examDetail.doseRecord")}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>DLP (mGy·cm)</div>
                    <InputNumber
                      style={{ width: "100%" }} min={0} max={100000}
                      value={completeModal.dlp !== "" ? Number(completeModal.dlp) : undefined}
                      onChange={(v) => setCompleteModal(s => s ? { ...s, dlp: v !== null && v !== undefined ? String(v) : "" } : s)}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>CTDIvol (mGy)</div>
                    <InputNumber
                      style={{ width: "100%" }} min={0} max={10000}
                      value={completeModal.ctdivol !== "" ? Number(completeModal.ctdivol) : undefined}
                      onChange={(v) => setCompleteModal(s => s ? { ...s, ctdivol: v !== null && v !== undefined ? String(v) : "" } : s)}
                    />
                  </div>
                </div>
              </>
            )}
            {completeModal.quality === "retake" && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>{t("examDetail.retakeReason")}</div>
                <Select
                  style={{ width: "100%" }} placeholder={t("examDetail.selectRetakeReason")} value={completeModal.retakeReason || undefined}
                  onChange={(v) => setCompleteModal(s => s ? { ...s, retakeReason: v } : s)}
                  options={RETAKE_REASON_OPTIONS}
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>
                <StickyNote size={11} style={{ verticalAlign: -2, marginRight: 'var(--space-1, 4px)' }} /> {t("examDetail.techNotes")} *
              </div>
              <Input.TextArea
                rows={2}
                value={completeModal.note}
                onChange={(e) => setCompleteModal(s => s ? { ...s, note: e.target.value } : s)}
                placeholder={t("examDetail.notesPlaceholderShort")}
                maxLength={500}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* [v3.0.6.11-100 Wave 1A] 多技师协作: 主备技师分配 / 交接班 */}
      <TechnicianAssignmentEditor
        examId={exam.id}
        open={techEditorOpen}
        mode={techEditorMode}
        currentPrimary={techAssignment.primary ? { id: techAssignment.primary.id, fullName: techAssignment.primary.fullName } : null}
        currentBackup={techAssignment.backup ? { id: techAssignment.backup.id, fullName: techAssignment.backup.fullName } : null}
        onClose={() => setTechEditorOpen(false)}
        onSaved={() => {
          // 保存后刷新主备技师信息
          worklistApi.getById(exam.id)
            .then((res) => {
              const d = res.data
              setTechAssignment({ primary: d?.primaryTechnician ?? null, backup: d?.backupTechnician ?? null })
            })
            .catch(() => undefined)
          onStatusChanged?.()
        }}
      />

      {/* [W6] 检查前核对 (Time-Out) 门禁弹窗 */}
      <TimeoutVerifyModal
        open={timeoutOpen}
        examId={exam?.id ?? null}
        onCancel={() => setTimeoutOpen(false)}
        onVerified={() => {
          setTimeoutOpen(false)
          forceTimeoutRef.current = true
          void handleStatusAction("start")
        }}
      />
    </div>
  );
}

export default ExamDetailView;
