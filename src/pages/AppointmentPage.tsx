import { Card, message, Button, Modal, Tabs, Input, Select, Empty, Tooltip, Tag, Space, Spin } from 'antd'
import type { TableColumnsType } from 'antd'
import { PageHeader } from "../components/common/PageHeader";
import { StatCard } from "../components/common/StatCard";
import { AppText } from "../components/common/AppText";
// G005 放射科RIS系统 - 检查预约管理 v2.1.0
// 完整模拟放射科检查预约流程：日历/列表视图 + 新建预约表单 + 规则设置 + 预约提醒管理
import { useState, useMemo, useEffect, useCallback, type CSSProperties } from "react";
import {
  CalendarClock,
  Plus,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  User,
  Scan,
  Bell,
  Edit2,
  Eye,
  Upload,
  Download,
  Settings,
  Save,
  Monitor,
  Check,
  AlertTriangle,
  BarChart3,
  CalendarPlus,
  RefreshCw,
  Send,
  ListChecks,
  Building2,
  Zap,
} from "lucide-react";
import {
  initialModalityDevices,
} from "../data/initialData";
import { appointmentApi, type AppointmentDto, type RoomDto, type WaitlistEntryDto, type ReminderPlanDto, type GreenChannelReservationDto } from "../services/api";
import { notificationsApi } from "../services/api/notificationsApi";
import { invalidateApiCacheByPrefix } from "../services/api/client";
import { getCurrentUser } from "../utils/auth";
import { uniqueId } from "../utils/uniqueId";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import {
  replayOrderEvent,
  validateOrderStatus,
} from "../utils/orderStateAdapter";
import AppointmentCalendar from "./AppointmentCalendar";
import AppointmentForm from "./AppointmentForm";
// [W5] 资源甘特 + 运营面板 (等候/提醒/失约)
import ResourceGantt from "../components/appointments/ResourceGantt";
import AppointmentOpsPanels from "../components/appointments/AppointmentOpsPanels";
// [v3.0.6.11-103 Wave 10] 重复页合并: AppointmentManagementPage (冲突检测/统计/管理) 嵌入为 AppointmentPage "预约管理" 视图, 旧路由 /appointment-management redirect → /appointments
import AppointmentManagementPage from "./AppointmentManagementPage";
import { formatDateObj } from '../utils/date';
import { ActionButton } from "../components/common/ActionButton";
import { InlineEditCell } from "../components/common/InlineEditCell";
import { DataTable } from "../components/common";
import { useUndoActions } from "../components/UndoToast";
import { t } from '../i18n/appI18n';
import { PageContainer } from "../components/common";
// [W-D8] 诊室/候补/提醒/绿色通道 面板: 状态色统一走 @/theme/statusTokens (单一来源)
import { toneToAntd, statusColor } from "../theme/statusTokens";

// ==================== 类型定义 ====================
interface Appointment {
  id: string;
  patientId: string;
  patientName: string;
  patientInitials: string;
  gender: string;
  age: number;
  idCard: string;
  phone: string;
  examItemId: string;
  examItemName: string;
  modality: string;
  bodyPart: string;
  examDate: string;
  examTime: string;
  deviceId: string;
  deviceName: string;
  roomId: string;
  roomName: string;
  referringDoctorId: string;
  referringDoctorName: string;
  clinicalDiagnosis: string;
  notes: string;
  status: "pending" | "confirmed" | "checked-in" | "cancelled" | "no-show";
  priority: "normal" | "urgent" | "critical";
  cancelReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface AppointmentRules {
  deviceId: string;
  deviceName: string;
  maxDailyAppointments: number;
  maxPerTimeSlot: number;
  minAdvanceDays: number;
  maxAdvanceDays: number;
  noShowPenalty: number;
  enabled: boolean;
}

// 提醒记录类型
type ReminderStatus = "已发送" | "已确认" | "已改期" | "已取消";
type ReminderChannel = "短信" | "微信" | "APP推送";

interface ReminderRecord {
  id: string;
  patientName: string;
  phone: string;
  examType: string;
  examDate: string;
  examTime: string;
  reminderTime: string;
  channel: ReminderChannel;
  status: ReminderStatus;
  responseTime: string; // 患者响应时间
}

// 改期记录类型
interface RescheduleRecord {
  id: string;
  patientName: string;
  phone: string;
  examType: string;
  originalDate: string;
  originalTime: string;
  newDate: string;
  newTime: string;
  reason: "patient" | "doctor" | "device";
  operateTime: string;
  /** [W14-UX] 行内编辑备注 */
  note?: string;
}

// 取消记录类型
interface CancellationRecord {
  id: string;
  patientName: string;
  phone: string;
  examType: string;
  cancelTime: string;
  reason: string;
  rebooked: "是" | "否" | "待确认";
  /** [W14-UX] 行内编辑备注 */
  note?: string;
}

// ==================== 批量导入工具 ====================
// [v3.0.6.11-99 Wave8A P1] CSV/JSON 真实解析 → appointmentApi.create 逐条导入 (xlsx 二进制暂不支持, 提示导出 CSV/JSON)
function parseCsv(text: string): Record<string, unknown>[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0]!.split(/[,，\t]/).map((h) => h.trim());
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i]!.split(/[,，\t]/).map((c) => c.trim());
    const row: Record<string, unknown> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    if (Object.values(row).some((v) => String(v) !== "")) rows.push(row);
  }
  return rows;
}

// 导入行 → AppointmentDto 载荷 (字段宽松匹配: 中文/英文表头)
function rowToAppointment(row: Record<string, unknown>): Omit<AppointmentDto, "id" | "state" | "createdAt" | "updatedAt"> | null {
  const get = (...keys: string[]) => {
    for (const k of keys) {
      const v = row[k] ?? row[k.toLowerCase()] ?? row[k.toUpperCase()];
      if (v !== undefined && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  const patientName = get("姓名", "患者姓名", "name", "patientName");
  const deviceName = get("设备", "deviceName", "device");
  const dateStr = get("日期", "date", "examDate");
  const timeStr = get("时段", "时间", "time", "examTime");
  if (!patientName || !deviceName || !dateStr || !timeStr) return null;
  const startAt = `${dateStr} ${timeStr.includes(":") ? timeStr : timeStr.slice(0, 2) + ":00"}`;
  const start = new Date(startAt.replace(" ", "T"));
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  if (Number.isNaN(start.getTime())) return null;
  const device =
    initialModalityDevices.find((d) => String(d.name).includes(deviceName)) ??
    initialModalityDevices.find((d) => deviceName.includes(String(d.modality)));
  return {
    patientName,
    patientId: get("患者ID", "patientId", "idCard") || uniqueId("P"),
    modality: (device?.modality ?? get("检查项目", "检查类型", "modality", "examItemName")) || "CT",
    bodyPart: get("部位", "bodyPart", "检查项目", "examItemName") || "",
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    deviceId: device?.id ?? uniqueId("DEV-IMP"),
    deviceName,
    room: device?.location ?? undefined,
    priority: "ROUTINE",
    note: get("备注", "note") || undefined,
    referringDoctor: get("申请医生", "referringDoctor") || undefined,
    createdById: getCurrentUser()?.id ?? "unknown",
  };
}

// ==================== 工具函数 ====================
const getWeekDates = (baseDate: Date): Date[] => {
  const day = baseDate.getDay();
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - (day === 0 ? 6 : day - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
};



const formatDateCht = (d: Date): string => {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${d.getMonth() + 1}月${d.getDate()}日${weekdays[d.getDay()]}`;
};

// [W2-4] 修复: 日历视图引用 formatDate 但未定义 → 运行时 ReferenceError 导致页面崩溃
const formatDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const getNameInitials = (name: string): string => {
  if (!name) return "";
  const parts = name.split(/[\s·]/);
  if (parts.length >= 2) return parts[0]!.charAt(0) + parts[1]!.charAt(0);
  return name.slice(0, 2);
};

const timeSlots = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string; border: string }
> = {
  pending: {
    label: t("apptPage.status.pending"),
    bg: "#f59e0b22",
    color: "#ca8a04",
    border: "#fef08a",
  },
  confirmed: {
    label: t("apptPage.status.confirmed"),
    bg: "#22c55e22",
    color: "#059669",
    border: "#6ee7b7",
  },
  "checked-in": {
    label: t("apptPage.status.checkedIn"),
    bg: "#3b82f622", color: "var(--color-primary-500)",
    border: "#93c5fd",
  },
  checkedIn: {
    label: t("apptPage.status.checkedIn"),
    bg: "#3b82f622", color: "var(--color-primary-500)",
    border: "#93c5fd",
  },
  cancelled: {
    label: t("apptPage.status.cancelled"),
    bg: "var(--bg-deep)", color: "var(--text-secondary)",
    border: "var(--border-color)",
  },
  "no-show": {
    label: t("apptPage.status.noShow"),
    bg: "#ef444422", color: "var(--color-error-500)",
    border: "#fca5a5",
  },
  noShow: { label: t("apptPage.status.noShow"), bg: "#ef444422", color: "var(--color-error-500)", border: "#fca5a5" },
  completed: {
    label: t("apptPage.status.completed"),
    bg: "#8b5cf622",
    color: "#7c3aed",
    border: "#c4b5fd",
  },
  "in-progress": {
    label: t("apptPage.status.inProgress"),
    bg: "#f59e0b22", color: "var(--color-warning-500)",
    border: "var(--color-warning-300, #fcd34d)",
  },
  rescheduled: {
    label: t("apptPage.status.rescheduled"),
    bg: "#ec489922",
    color: "#be185d",
    border: "#f9a8d4",
  },
  default: {
    label: t("apptPage.status.unknown"),
    bg: "var(--bg-deep)", color: "var(--text-secondary)",
    border: "var(--border-color)",
  },
};
const getStatusConfig = (status: string) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.default!;

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  critical: { label: t("apptPage.priority.critical"), bg: "#ef444422", color: "var(--color-error-500)" },
  urgent: { label: t("apptPage.priority.urgent"), bg: "#f59e0b22", color: "var(--color-warning-500)" },
  normal: { label: t("apptPage.priority.normal"), bg: "var(--bg-deep)", color: "var(--text-secondary)" },
  default: { label: t("apptPage.priority.normal"), bg: "var(--bg-deep)", color: "var(--text-secondary)" },
};
const getPriorityConfig = (priority: string) =>
  PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.default!;

const CANCEL_REASONS = [
  { value: "patient", label: t("apptPage.cancelReason.patient") },
  { value: "device", label: t("apptPage.cancelReason.device") },
  { value: "doctor", label: t("apptPage.cancelReason.doctor") },
  { value: "reschedule", label: t("apptPage.cancelReason.reschedule") },
  { value: "other", label: t("apptPage.cancelReason.other") },
];

const REMINDER_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  已发送: { label: t("apptPage.reminderStatus.sent"), bg: "#3b82f622", color: "var(--color-primary-700)" },
  已确认: { label: t("apptPage.reminderStatus.confirmed"), bg: "#22c55e22", color: "#059669" },
  已改期: { label: t("apptPage.reminderStatus.rescheduled"), bg: "#f59e0b22", color: "var(--color-warning-500)" },
  已取消: { label: t("apptPage.reminderStatus.cancelled"), bg: "var(--bg-deep)", color: "var(--text-secondary)" },
  default: { label: t("apptPage.reminderStatus.unknown"), bg: "var(--bg-deep)", color: "var(--text-secondary)" },
};
const getReminderStatusConfig = (status: string) =>
  REMINDER_STATUS_CONFIG[status] || REMINDER_STATUS_CONFIG.default!;

const RESCHEDULE_REASON_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  patient: { label: t("apptPage.rescheduleReason.patient"), bg: "#3b82f622", color: "var(--color-primary-700)" },
  doctor: { label: t("apptPage.rescheduleReason.doctor"), bg: "#f59e0b22", color: "var(--color-warning-500)" },
  device: { label: t("apptPage.rescheduleReason.device"), bg: "#ef444422", color: "var(--color-error-500)" },
  default: { label: t("apptPage.rescheduleReason.other"), bg: "var(--bg-deep)", color: "var(--text-secondary)" },
};
const getRescheduleReasonConfig = (reason: string) =>
  RESCHEDULE_REASON_CONFIG[reason] || RESCHEDULE_REASON_CONFIG.default!;

// ==================== 冲突检测函数 ====================
interface ConflictResult {
  hasConflict: boolean;
  conflictingAppointments: Appointment[];
  message: string;
}

const findConflicts = (
  newDate: string,
  newTime: string,
  newDeviceId: string,
  newRoomId: string,
  existingAppointments: Appointment[],
  excludeId?: string,
): ConflictResult => {
  const conflicting = existingAppointments.filter(
    (a) =>
      a.id !== excludeId &&
      a.examDate === newDate &&
      a.examTime === newTime &&
      (a.deviceId === newDeviceId || a.roomId === newRoomId) &&
      a.status !== "cancelled" &&
      a.status !== "no-show",
  );
  if (conflicting.length > 0) {
    return {
      hasConflict: true,
      conflictingAppointments: conflicting,
      message: `时间冲突: 该时段已有 ${conflicting.length} 个预约`,
    };
  }
  return { hasConflict: false, conflictingAppointments: [], message: "" };
};

// ==================== 候诊(等候名单)类型定义 ====================
interface WaitlistPatient {
  id: string;
  patientName: string;
  phone: string;
  examItemName: string;
  modality: string;
  preferredDate: string;
  preferredTime: string;
  priority: "normal" | "urgent" | "critical";
  addedAt: string;
  notified: boolean;
}


// ==================== 模拟预约数据 ====================

// ==================== 模拟设备规则 ====================

// ==================== 虚构提醒记录数据（30条）====================

// ==================== 虚构改期记录数据 ====================

// ==================== 虚构取消记录数据 ====================

// ==================== 主组件 ====================
export default function AppointmentPage() {
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    return monday;
  });
  // [v3.0.6.11-103 Wave 10] 重复页合并: + "management" 视图 (嵌入 AppointmentManagementPage)
  const [viewMode, setViewMode] = useState<
    "calendar" | "list" | "reminders" | "management"
  >("calendar");
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [listFilterDate] = useState<string>("");
  const [listFilterStatus] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  // [W14-UX] 批量选择 + 撤销
  const [selectedAptIds, setSelectedAptIds] = useState<Set<string>>(new Set());
  const { showUndo } = useUndoActions();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const [aptRes, rulesRes] = await Promise.all([
          appointmentApi.list(),
          appointmentApi.getRules(),
        ]);
        if (cancelled) return;
        // [G005 P0] 列表形状兼容: MSW 裸数组 / Nest {items,total}
        const aptItems = (aptRes.data as { items?: unknown[] } | null)?.items ?? aptRes.data;
        if (aptRes.success && Array.isArray(aptItems)) {
          setAppointments(aptItems as unknown as Appointment[]);
          setLoadError(null);
        } else {
          setAppointments([]);
          setLoadError(aptRes.error?.message || t("apptPage.loadFailed"));
        }
        if (rulesRes.success && Array.isArray(rulesRes.data)) {
          setRules(rulesRes.data as unknown as AppointmentRules[]);
          // [v3.0.6.11-99 Wave8A P1] 本地持久化规则优先 (后端无规则保存端点, 标注: 待后端规则 CRUD)
          try {
            const saved = JSON.parse(localStorage.getItem("g005_appointment_rules") || "null");
            if (Array.isArray(saved) && saved.length > 0) setRules(saved as AppointmentRules[]);
          } catch { /* ignore */ }
        }
      } catch {
        if (!cancelled) setLoadError(t("apptPage.loadFailed"));
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadTick]);
  const [rules, setRules] = useState<AppointmentRules[]>([]);

  // [W2-4] 一键预约: 支持 /appointments?patientId=xxx 从患者详情直达预约表单
  const [patientPreset, setPatientPreset] = useState<{
    patientId: string;
    patientName: string;
    gender: string;
    age: string;
    phone: string;
    idCard: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pid = new URLSearchParams(window.location.search).get("patientId");
    if (!pid) return;
    void (async () => {
      try {
        const res = await (await import("../services/api")).patientApi.getById(pid);
        if (cancelled || !res.success || !res.data) return;
        const p = res.data as unknown as Record<string, unknown>;
        const name = String(p.name ?? p.patientName ?? "");
        const gender = String(p.gender ?? "男");
        setPatientPreset({
          patientId: pid,
          patientName: name,
          gender: gender.includes("女") ? "女" : gender.includes("男") ? "男" : "男",
          age: String(p.age ?? ""),
          phone: String(p.phone ?? ""),
          idCard: String(p.idCard ?? ""),
        });
        setFormData((prev) => ({
          ...prev,
          patientName: name,
          gender: gender.includes("女") ? "女" : "男",
          age: String(p.age ?? ""),
          phone: String(p.phone ?? ""),
          idCard: String(p.idCard ?? ""),
        }));
        setShowForm(true);
        setSearchKeyword(pid);
      } catch {
        setPatientPreset({ patientId: pid, patientName: "", gender: "男", age: "", phone: "", idCard: "" });
        setSearchKeyword(pid);
        setShowForm(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // 加载辅助数据 (等候名单/提醒/改期/取消) - P0: 接真实端点, 失败显式提示
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setTabError(null);
      const [wlRes, remRes, rsRes, cxRes] = await Promise.all([
        appointmentApi.getWaitlist(),
        appointmentApi.getReminderRecords(),
        appointmentApi.getRescheduleRecords(),
        appointmentApi.getCancellationRecords(),
      ]);
      if (cancelled) return;
      if (wlRes.success && Array.isArray(wlRes.data)) setWaitlist(wlRes.data as unknown as WaitlistPatient[]);
      if (remRes.success && Array.isArray(remRes.data)) setReminderRecords(remRes.data as unknown as ReminderRecord[]);
      if (rsRes.success && Array.isArray(rsRes.data)) setRescheduleRecords(rsRes.data as unknown as RescheduleRecord[]);
      if (cxRes.success && Array.isArray(cxRes.data)) setCancellationRecords(cxRes.data as unknown as CancellationRecord[]);
      const failures = [wlRes, remRes, rsRes, cxRes].filter((r) => !r.success);
      if (failures.length > 0) {
        setTabError(
          `${t("apptPage.auxLoadFailed")}: ${failures
            .map((f) => f.error?.message || t("apptPage.unknownError"))
            .join("；")}`,
        );
      }
    })().catch((e: unknown) => {
      if (!cancelled)
        setTabError(
          `${t("apptPage.auxLoadFailed")}: ${(e as Error)?.message || String(e)}`,
        );
    });
    return () => { cancelled = true; };
  }, [reloadTick]);

  // 右侧面板
  const [showForm, setShowForm] = useState(false);
  const [showRules, setShowRules] = useState(false);
  // [G005] 预约规则面板设备搜索: 状态接入下方规则列表过滤
  const [ruleSearch, setRuleSearch] = useState("");
  const [showBatchImport, setShowBatchImport] = useState(false);

  // 预约详情/修改
  const [selectedAppointment, setSelectedAppointment] =
    useState<Appointment | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [validationError, setValidationError] = useState("");
  const [cancelReasonError, setCancelReasonError] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // 日历子视图: day/week/month
  const [calendarSubView, setCalendarSubView] = useState<
    "day" | "week" | "month"
  >("week");

  // 等候名单
  const [waitlist, setWaitlist] = useState<WaitlistPatient[]>([]);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistNotifyLoading, setWaitlistNotifyLoading] = useState<
    string | null
  >(null);

  // [v3.0.6.11-98 Wave3B P1] 候补通知: notificationsApi.create 真实发送 (失败回退本地标记)
  const handleWaitlistNotify = async (w: WaitlistPatient) => {
    setWaitlistNotifyLoading(w.id);
    try {
      const res = await notificationsApi.create({
        userId: `patient-${w.id}`,
        type: "APPOINTMENT",
        severity: "INFO",
        title: t("apptPage.waitlistNotifyTitle"),
        content: `${w.patientName} 的 ${w.examItemName}（${w.modality}），期望 ${w.preferredDate} ${w.preferredTime}，现已有空位，请及时来院。`,
        targetId: w.id,
      });
      setWaitlist((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, notified: true } : x)),
      );
      if (res.success) {
        message.success(`${t("apptPage.notifySent")} ${w.patientName}`);
      } else {
        message.warning(t("apptPage.notifyUnavailable"));
      }
    } catch {
      setWaitlist((prev) =>
        prev.map((x) => (x.id === w.id ? { ...x, notified: true } : x)),
      );
      message.warning(t("apptPage.notifyUnavailable"));
    } finally {
      setWaitlistNotifyLoading(null);
    }
  };

  // [v3.0.6.11-98 Wave3B P1] 自动排序: 候补名单按优先级(危重>紧急>普通) + 登记时间升序 本地排序
  const handleWaitlistAutoSort = () => {
    const priorityOrder: Record<string, number> = {
      critical: 0,
      urgent: 1,
      normal: 2,
    };
    const sorted = [...waitlist].sort(
      (a, b) =>
        (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3) ||
        String(a.addedAt).localeCompare(String(b.addedAt)),
    );
    setWaitlist(sorted);
    message.success(t("apptPage.waitlistSorted"));
  };

  // 冲突检测
  const [conflictModal, setConflictModal] = useState<{
    show: boolean;
    result: ConflictResult | null;
  }>({ show: false, result: null });
  const [preventSubmitOnConflict, setPreventSubmitOnConflict] = useState(false);
  const [creatingAppt, setCreatingAppt] = useState(false);

  // 提醒相关状态
  const [reminderRecords, setReminderRecords] = useState<ReminderRecord[]>([]);
  const [rescheduleRecords, setRescheduleRecords] = useState<RescheduleRecord[]>([]);
  const [cancellationRecords, setCancellationRecords] = useState<CancellationRecord[]>([]);
  const [tabError, setTabError] = useState<string | null>(null);
  const [reminderTab, setReminderTab] = useState<
    "reminders" | "reschedules" | "cancellations"
  >("reminders");
  const [reminderFilterStatus] =
    useState<string>("all");
  const [reminderFilterChannel] =
    useState<string>("all");

  // 新建预约表单状态
  const [formData, setFormData] = useState({
    patientName: "",
    gender: "男",
    age: "",
    idCard: "",
    phone: "",
    examType: "CT",
    examItemId: "",
    examItemName: "",
    bodyPart: "",
    examDate: formatDateObj(new Date()),
    examTime: "08:00",
    deviceId: "",
    deviceName: "",
    roomId: "",
    roomName: "",
    referringDoctorId: "",
    referringDoctorName: "",
    clinicalDiagnosis: "",
    notes: "",
    priority: "normal",
    // [W5] 资源/安全/医保/绿色通道字段
    technicianId: "",
    technicianName: "",
    durationMin: 30,
    bufferMin: 0,
    prepInstruction: "",
    consentRequired: false,
    insuranceType: "城镇职工医保",
    insurancePreAuthNo: "",
    greenChannel: false,
    allergyHistory: "",
    pregnant: false,
    renalFunction: "",
    contrastAgent: false,
    clinicalIndication: "",
    weightKg: "",
    heightCm: "",
  });

  // [W5] 视图开关: 资源甘特 + 运营面板 (不改动既有 viewMode 联合类型, 降低回归风险)
  const [showGantt, setShowGantt] = useState(false);
  const [showOps, setShowOps] = useState(false);
  // [W-D8] 诊室 / 候补 / 提醒 / 绿色通道 资源面板
  const [showResourceOps, setShowResourceOps] = useState(false);

  const weekDates = useMemo(
    () => getWeekDates(currentWeekStart),
    [currentWeekStart],
  );

  // 过滤后的设备
  const filteredDevices = useMemo(() => {
    if (selectedDevice === "all")
      return initialModalityDevices.filter((d) => d.status !== "维护中");
    return initialModalityDevices.filter(
      (d) => d.id === selectedDevice && d.status !== "维护中",
    );
  }, [selectedDevice]);

  // 按日期和设备分组的预约
  const appointmentsByDateDevice = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((apt) => {
      const key = `${apt.examDate}::${apt.deviceId}`;
      if (!map[key]) map[key] = [];
      map[key].push(apt);
    });
    return map;
  }, [appointments]);

  // 今日统计
  const todayStats = useMemo(() => {
    const today = formatDateObj(new Date());
    const todayApts = appointments.filter((a) => a.examDate === today);
    const checkedIn = todayApts.filter((a) => a.status === "checked-in");
    const totalCapacity = rules.reduce(
      (sum, r) => sum + (r.enabled ? r.maxDailyAppointments : 0),
      0,
    );
    const occupied = todayApts.filter((a) => a.status !== "cancelled").length;
    const utilizationRate =
      totalCapacity > 0 ? Math.round((occupied / totalCapacity) * 100) : 0;
    return {
      total: todayApts.length,
      pending: todayApts.filter((a) => a.status === "pending").length,
      confirmed: todayApts.filter((a) => a.status === "confirmed").length,
      checkedIn: checkedIn.length,
      noShow: todayApts.filter((a) => a.status === "no-show").length,
      cancelled: todayApts.filter((a) => a.status === "cancelled").length,
      utilizationRate,
      avgWaitTime: checkedIn.length > 0 ? "12min" : "—",
    };
  }, [appointments, rules]);

  // 列表视图过滤
  const filteredListAppointments = useMemo(() => {
    let list = [...appointments];
    if (searchKeyword) {
      const kw = searchKeyword.toLowerCase();
      list = list.filter(
        (a) =>
          a.patientName.toLowerCase().includes(kw) ||
          a.id.includes(kw) ||
          a.phone.includes(kw) ||
          a.examItemName.includes(kw),
      );
    }
    if (listFilterDate) {
      list = list.filter((a) => a.examDate === listFilterDate);
    }
    if (listFilterStatus !== "all") {
      list = list.filter((a) => a.status === listFilterStatus);
    }
    if (selectedDevice !== "all") {
      list = list.filter((a) => a.deviceId === selectedDevice);
    }
    return list.sort((a, b) => {
      const dateCmp = a.examDate.localeCompare(b.examDate);
      if (dateCmp !== 0) return dateCmp;
      return a.examTime.localeCompare(b.examTime);
    });
  }, [
    appointments,
    searchKeyword,
    listFilterDate,
    listFilterStatus,
    selectedDevice,
  ]);

  // 日历视图使用今日预约
  const filteredAppointments = useMemo(() => {
    const today = formatDateObj(new Date());
    return appointments.filter(a => a.examDate === today);
  }, [appointments]);

  // 过滤后的提醒记录
  const filteredReminderRecords = useMemo(() => {
    let list = [...reminderRecords];
    if (reminderFilterStatus !== "all") {
      list = list.filter((r) => r.status === reminderFilterStatus);
    }
    if (reminderFilterChannel !== "all") {
      list = list.filter((r) => r.channel === reminderFilterChannel);
    }
    return list;
  }, [reminderRecords, reminderFilterStatus, reminderFilterChannel]);

  const reminderColumns: TableColumnsType<ReminderRecord> = [
    { title: t("apptPage.colPatient"), dataIndex: "patientName", key: "patientName", render: (v: string) => <span style={{ fontWeight: 700, color: primaryBlue }}>{v}</span> },
    { title: t("apptPage.colPhone"), dataIndex: "phone", key: "phone", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colExamItem"), dataIndex: "examType", key: "examType", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colExamTime"), key: "examTime", render: (_v, r) => <span style={{ color: textGray }}>{r.examDate} {r.examTime}</span> },
    { title: t("apptPage.colReminderTime"), dataIndex: "reminderTime", key: "reminderTime", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colChannel"), dataIndex: "channel", key: "channel", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colStatus"), dataIndex: "status", key: "status", render: (v: string) => <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...getReminderStatusConfig(v) }}>{v}</span> },
    { title: t("apptPage.colResponseTime"), dataIndex: "responseTime", key: "responseTime", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
  ]

  const rescheduleColumns: TableColumnsType<RescheduleRecord> = [
    { title: t("apptPage.colPatient"), dataIndex: "patientName", key: "patientName", render: (v: string) => <span style={{ fontWeight: 700, color: primaryBlue }}>{v}</span> },
    { title: t("apptPage.colPhone"), dataIndex: "phone", key: "phone", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colExamItem"), dataIndex: "examType", key: "examType", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colOriginalTime"), key: "originalTime", render: (_v, r) => <span style={{ color: textGray }}>{r.originalDate} {r.originalTime}</span> },
    { title: t("apptPage.colNewTime"), key: "newTime", render: (_v, r) => <span style={{ fontWeight: 600, color: primaryBlue }}>{r.newDate} {r.newTime}</span> },
    {
      title: t("apptPage.colReason"), dataIndex: "reason", key: "reason",
      render: (v: RescheduleRecord["reason"]) => {
        const cfg = getRescheduleReasonConfig(v)
        return <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...cfg }}>{cfg.label}</span>
      },
    },
    {
      title: t("w14Ux.inline.save"), key: "note", width: 120,
      render: (_v, r) => (
        <InlineEditCell
          value={r.note ?? ""}
          inputType="text"
          placeholder={t("w14Ux.inline.doubleClick")}
          ariaLabel={t("w14Ux.inline.save")}
          onSave={(next) => {
            const snapshot = rescheduleRecords;
            setRescheduleRecords((prev) => prev.map((x) => (x.id === r.id ? { ...x, note: next } : x)));
            showUndo(t("w14Ux.undo.updated", { name: r.patientName }), () => setRescheduleRecords(snapshot));
          }}
        />
      ),
    },
    { title: t("apptPage.colOperateTime"), dataIndex: "operateTime", key: "operateTime", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
  ]

  const cancellationColumns: TableColumnsType<CancellationRecord> = [
    { title: t("apptPage.colPatient"), dataIndex: "patientName", key: "patientName", render: (v: string) => <span style={{ fontWeight: 700, color: primaryBlue }}>{v}</span> },
    { title: t("apptPage.colPhone"), dataIndex: "phone", key: "phone", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colExamItem"), dataIndex: "examType", key: "examType", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colCancelTime"), dataIndex: "cancelTime", key: "cancelTime", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    { title: t("apptPage.colReason"), dataIndex: "reason", key: "reason", render: (v: string) => <span style={{ color: textGray }}>{v}</span> },
    {
      title: t("apptPage.colRebooked"), dataIndex: "rebooked", key: "rebooked",
      render: (v: string) => (
        <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: v === "是" ? "var(--color-success-bg)" : v === "否" ? "var(--bg-primary)" : "var(--color-warning-bg)", color: v === "是" ? "#059669" : v === "否" ? "#64748b" : "var(--color-warning-600)" }}>{v}</span>
      ),
    },
  ]

  // 统计某日某设备的预约数
  const getDeviceDayStats = (date: Date, deviceId: string) => {
    const dateStr = formatDateObj(date);
    const key = `${dateStr}::${deviceId}`;
    const dayApts = appointmentsByDateDevice[key] || [];
    const total = dayApts.length;
    const rule = rules.find((r) => r.deviceId === deviceId);
    const capacity = rule?.maxDailyAppointments || 60;
    const occupancy = capacity > 0 ? Math.round((total / capacity) * 100) : 0;
    return { total, occupancy };
  };

  // 新建预约提交 (P0): 参数与后端 schema 对齐, 以服务端返回对象更新列表
  const buildCreatePayload = (): Omit<AppointmentDto, "id" | "state" | "createdAt" | "updatedAt"> | null => {
    const device = initialModalityDevices.find((d) => d.id === formData.deviceId);
    const startAt = new Date(`${formData.examDate}T${formData.examTime || "08:00"}:00`);
    if (Number.isNaN(startAt.getTime())) return null;
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const priority: AppointmentDto["priority"] =
      formData.priority === "urgent"
        ? "URGENT"
        : formData.priority === "critical"
          ? "STAT"
          : "ROUTINE";
    return {
      patientName: formData.patientName,
      // [W2-4] 一键预约: 优先使用患者详情传入的 patientId, 保证预约与患者关联
      patientId: patientPreset?.patientId || `RAD-P${Date.now()}`,
      modality: formData.examType,
      bodyPart: formData.bodyPart || undefined,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      deviceId: formData.deviceId,
      deviceName: formData.deviceName || device?.name || "",
      room: device?.location || undefined,
      priority,
      note: formData.notes || undefined,
      referringDoctor: formData.referringDoctorName || undefined,
      createdById: "current-user",
      // [W5] 资源/安全/医保/绿色通道
      roomId: formData.roomId || undefined,
      roomName: formData.roomName || undefined,
      technicianId: formData.technicianId || undefined,
      technicianName: formData.technicianName || undefined,
      durationMin: Number(formData.durationMin) || 30,
      bufferMin: Number(formData.bufferMin) || 0,
      prepInstruction: formData.prepInstruction || undefined,
      consentRequired: !!formData.consentRequired,
      insuranceType: formData.insuranceType || undefined,
      insurancePreAuthNo: formData.insurancePreAuthNo || undefined,
      greenChannel: !!formData.greenChannel,
      weightKg: formData.weightKg === "" ? undefined : Number(formData.weightKg),
      heightCm: formData.heightCm === "" ? undefined : Number(formData.heightCm),
      allergyHistory: formData.allergyHistory || undefined,
      pregnant: !!formData.pregnant,
      renalFunction: formData.renalFunction || undefined,
      contrastAgent: !!formData.contrastAgent,
      clinicalIndication: formData.clinicalIndication || undefined,
    };
  };

  // 服务端返回对象 → 本地 Appointment (列表/日历展示)
  const toLocalAppointment = (dto: AppointmentDto): Appointment => {
    const start = new Date(dto.startAt);
    const date = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
    const time = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
    const statusMap: Record<string, string> = {
      SCHEDULED: "pending",
      CONFIRMED: "confirmed",
      REGISTERED: "pending",
      CHECKED_IN: "checked-in",
      IN_PROGRESS: "checked-in",
      COMPLETED: "completed",
      CANCELLED: "cancelled",
      NO_SHOW: "no-show",
    };
    const priority: Appointment["priority"] =
      dto.priority === "STAT" ? "critical" : dto.priority === "URGENT" ? "urgent" : "normal";
    return {
      id: dto.id,
      patientId: dto.patientId,
      patientName: dto.patientName,
      patientInitials: getNameInitials(dto.patientName),
      gender: formData.gender,
      age: parseInt(formData.age) || 0,
      idCard: formData.idCard,
      phone: formData.phone,
      examItemId: "",
      examItemName: dto.bodyPart ? `${dto.modality} ${dto.bodyPart}` : dto.modality,
      modality: dto.modality,
      bodyPart: dto.bodyPart || "",
      examDate: date,
      examTime: time,
      deviceId: dto.deviceId,
      deviceName: dto.deviceName,
      roomId: "",
      roomName: dto.room || "",
      referringDoctorId: "",
      referringDoctorName: dto.referringDoctor || "",
      clinicalDiagnosis: dto.note || "",
      notes: dto.note || "",
      status: (statusMap[dto.state] ?? "pending") as Appointment["status"],
      priority,
      createdAt: dto.createdAt || new Date().toLocaleString("zh-CN"),
      updatedAt: dto.updatedAt || new Date().toLocaleString("zh-CN"),
    };
  };

  const resetAppointmentForm = () => {
    setFormData({
      patientName: "",
      gender: "男",
      age: "",
      idCard: "",
      phone: "",
      examType: "CT",
      examItemId: "",
      examItemName: "",
      bodyPart: "",
      examDate: formatDateObj(new Date()),
      examTime: "08:00",
      deviceId: "",
      deviceName: "",
      roomId: "",
      roomName: "",
      referringDoctorId: "",
      referringDoctorName: "",
      clinicalDiagnosis: "",
      notes: "",
      priority: "normal",
      technicianId: "",
      technicianName: "",
      durationMin: 30,
      bufferMin: 0,
      prepInstruction: "",
      consentRequired: false,
      insuranceType: "城镇职工医保",
      insurancePreAuthNo: "",
      greenChannel: false,
      allergyHistory: "",
      pregnant: false,
      renalFunction: "",
      contrastAgent: false,
      clinicalIndication: "",
      weightKg: "",
      heightCm: "",
    });
  };

  const submitAppointment = async (force: boolean) => {
    setCreatingAppt(true);
    try {
      const errs: Record<string, string> = {};
      if (!formData.patientName.trim()) errs.patientName = t("apptPage.errPatientName");
      if (
        formData.idCard &&
        formData.idCard.length > 0 &&
        formData.idCard.length !== 18
      ) {
        errs.idCard = t("apptPage.errIdCard");
      }
      if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
        errs.phone = t("apptPage.errPhone");
      }
      if (!formData.examItemId) errs.examItemId = t("apptPage.errExamItem");
      if (!formData.deviceId) errs.deviceId = t("apptPage.errDevice");
      setFormErrors(errs);
      if (Object.keys(errs).length > 0) {
        setValidationError(t("apptPage.errRequired"));
        return;
      }
      setValidationError("");
      if (!force) {
        const conflict = findConflicts(
          formData.examDate,
          formData.examTime,
          formData.deviceId,
          formData.roomId,
          appointments,
        );
        if (conflict.hasConflict) {
          setConflictModal({ show: true, result: conflict });
          setPreventSubmitOnConflict(true);
          return;
        }
      }
      const payload = buildCreatePayload();
      if (!payload) {
        setValidationError(t("apptPage.errInvalidTime"));
        return;
      }
      const res = await appointmentApi.create(payload);
      if (!res.success) {
        setValidationError(res.error?.message || t("apptPage.createFailed"));
        return;
      }
      // 以服务端返回为准: 联动 Exam 已创建, 失效工作列表缓存
      setAppointments((prev) => [...prev, toLocalAppointment(res.data)]);
      await invalidateApiCacheByPrefix("/worklist");
      setShowForm(false);
      setFormErrors({});
      resetAppointmentForm();
    } finally {
      setCreatingAppt(false);
    }
  };

  const handleCreateAppointment = () => void submitAppointment(false);

  // 取消预约
  const handleCancelAppointment = async () => {
    if (!selectedAppointment || !cancelReason) {
      setCancelReasonError(t("apptPage.errCancelReason"));
      return;
    }
    // orderMachine: approved/scheduled/confirmed → cancelled via CANCEL (with reason)
    const newState = replayOrderEvent(selectedAppointment.status, {
      type: "CANCEL",
      reason: cancelReason,
      by: "system",
    });
    if (!validateOrderStatus(newState)) {
      setCancelReasonError(t("apptPage.errCancelNotAllowed"));
      return;
    }
    await appointmentApi.cancel(selectedAppointment.id);
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === selectedAppointment.id
          ? {
              ...a,
              status: "cancelled",
              cancelReason,
              updatedAt: new Date().toLocaleString("zh-CN"),
            }
          : a,
      ),
    );
    setShowCancelModal(false);
    setCancelReason("");
    setSelectedAppointment(null);
  };

  // 打开详情
  const openDetail = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowDetailModal(true);
  };

  // ====== [W14-UX] 右键上下文操作 + 批量操作 ======
  const checkInAppointment = async (apt: { id: string }) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === apt.id ? { ...a, status: "checked-in", updatedAt: new Date().toLocaleString("zh-CN") } : a)),
    );
    await appointmentApi.update(apt.id, { state: "CHECKED_IN" }).catch(() => null);
    message.success(t("apptPage.status.checkedIn"));
  };

  const rescheduleAppointment = (apt: Appointment) => {
    const d = new Date(apt.examDate);
    if (!Number.isNaN(d.getTime())) d.setDate(d.getDate() + 1);
    const newDate = Number.isNaN(d.getTime()) ? apt.examDate : formatDateObj(d);
    setAppointments((prev) =>
      prev.map((a) => (a.id === apt.id ? { ...a, examDate: newDate, updatedAt: new Date().toLocaleString("zh-CN") } : a)),
    );
    message.success(t("w14Ux.batch.done", { count: 1, action: t("w14Ux.batch.reschedule") }));
  };

  const cancelAppointmentDirect = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowCancelModal(true);
  };

  const printAppointment = () => {
    window.print();
  };

  const handleAppointmentBatch = async (action: string, ids: string[]) => {
    const targets = appointments.filter((a) => ids.includes(a.id));
    if (action === "checkin") {
      for (const apt of targets) {
        await appointmentApi.update(apt.id, { state: "CHECKED_IN" }).catch(() => null);
      }
      setAppointments((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, status: "checked-in" } : a)));
      message.success(t("w14Ux.batch.done", { count: targets.length, action: t("w14Ux.batch.checkIn") }));
    } else if (action === "cancel") {
      for (const apt of targets) {
        await appointmentApi.cancel(apt.id).catch(() => null);
      }
      setAppointments((prev) => prev.map((a) => (ids.includes(a.id) ? { ...a, status: "cancelled" } : a)));
      message.success(t("w14Ux.batch.done", { count: targets.length, action: t("w14Ux.batch.cancel") }));
    } else if (action === "reschedule") {
      setAppointments((prev) =>
        prev.map((a) => {
          if (!ids.includes(a.id)) return a;
          const d = new Date(a.examDate);
          if (!Number.isNaN(d.getTime())) d.setDate(d.getDate() + 1);
          return { ...a, examDate: Number.isNaN(d.getTime()) ? a.examDate : formatDateObj(d) };
        }),
      );
      message.success(t("w14Ux.batch.done", { count: targets.length, action: t("w14Ux.batch.reschedule") }));
    }
    setSelectedAptIds(new Set());
  };

  // 颜色定义
  const primaryBlue = "var(--color-primary-800)";
const lightBlue = "var(--color-info-bg)";
const borderGray = "var(--border-color)";
  const textGray = "#64748b";
  const whiteBg = "var(--bg-card)";

  // ====== 渲染 ======
  return (
    <PageContainer
      background="none"
      maxWidth="fluid"
      padding={0}
      minHeight="auto"
      testId="appointment-page"
      style={{
        background: "var(--bg-card)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {loading && <LoadingBanner message={t("apptPage.loadingData")} />}
      {loadError && !loading && <ErrorBanner message={loadError} onRetry={() => setReloadTick(n => n + 1)} retryLabel={t('w9.states.retry')} />}
      {tabError && <ErrorBanner message={tabError} onRetry={() => setReloadTick(n => n + 1)} retryLabel={t('w9.states.retry')} />}

      {/* [W2-4] 一键预约横幅: 从患者详情跳转时展示 */}
      {patientPreset && (
        <div style={{ background: 'var(--color-info-bg)', borderBottom: '1px solid #bfdbfe', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--color-primary-800)' }}>
          <CalendarPlus size={16} />
          <span>{t("apptPage.presetPrefix")}<b>{patientPreset.patientName || patientPreset.patientId}</b>（{patientPreset.patientId}）{t("apptPage.presetSuffix")}</span>
          <button onClick={() => setPatientPreset(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: 'var(--color-primary-800)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            {t("apptPage.close")}
          </button>
        </div>
      )}

      {/* ====== 顶部标题栏 ====== */}
      <div
        style={{
          background: whiteBg,
          borderBottom: `1px solid ${borderGray}`,
          padding: "16px 24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            maxWidth: 1600,
            margin: "0 auto",
          }}
        >
          <PageHeader
            variant="flex"
            icon={<CalendarClock size={22} style={{ color: "var(--color-warning-600)" }} />}
            title={t("apptPage.title")}
            subtitle={t("apptPage.subtitle")}
            style={{ marginBottom: 0 }}
          />
          <div style={{ display: "flex", gap: 'var(--space-2, 8px)', alignItems: "center" }}>
            <button
              onClick={() => {
                setShowBatchImport(true);
              }}
              style={{
                padding: "7px 14px",
                background: whiteBg,
                color: primaryBlue,
                border: `1px solid ${borderGray}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Upload size={13} /> {t("apptPage.batchImport")}
            </button>
            <button
              onClick={() => {
                setShowRules(!showRules);
                setShowForm(false);
              }}
              style={{
                padding: "7px 14px",
                background: showRules ? primaryBlue : whiteBg,
                color: showRules ? "#fff" : primaryBlue,
                border: `1px solid ${primaryBlue}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Settings size={13} /> {t("apptPage.rules")}
            </button>
            {/* [v3.0.6.11-103 Wave 10] 重复页合并: 预约管理视图 (嵌入 AppointmentManagementPage) */}
            <button
              onClick={() => {
                setViewMode(viewMode === "management" ? "calendar" : "management");
                setShowForm(false);
                setShowRules(false);
              }}
              style={{
                padding: "7px 14px",
                background: viewMode === "management" ? primaryBlue : whiteBg,
                color: viewMode === "management" ? "#fff" : primaryBlue,
                border: `1px solid ${primaryBlue}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <BarChart3 size={13} /> {t("apptPage.management")}
            </button>
            {/* [W5] 资源甘特视图开关 */}
            <button
              data-testid="toggle-gantt"
              onClick={() => { setShowGantt(!showGantt); setShowForm(false); setShowRules(false); }}
              style={{
                padding: "7px 14px",
                background: showGantt ? primaryBlue : whiteBg,
                color: showGantt ? "#fff" : primaryBlue,
                border: `1px solid ${primaryBlue}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <BarChart3 size={13} /> {t("w5Appt.ganttTitle")}
            </button>
            {/* [W5] 运营面板开关 */}
            <button
              data-testid="toggle-ops"
              onClick={() => { setShowOps(!showOps); setShowForm(false); setShowRules(false); }}
              style={{
                padding: "7px 14px",
                background: showOps ? primaryBlue : whiteBg,
                color: showOps ? "#fff" : primaryBlue,
                border: `1px solid ${primaryBlue}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Bell size={13} /> {t("w5Appt.opsTitle")}
            </button>
            {/* [W-D8] 诊室 / 候补 / 提醒 / 绿色通道 资源面板 */}
            <button
              data-testid="toggle-resource-ops"
              onClick={() => { setShowResourceOps(!showResourceOps); setShowForm(false); setShowRules(false); }}
              style={{
                padding: "7px 14px",
                background: showResourceOps ? primaryBlue : whiteBg,
                color: showResourceOps ? "#fff" : primaryBlue,
                border: `1px solid ${showResourceOps ? primaryBlue : borderGray}`,
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <Building2 size={13} /> 诊室/候补/提醒
            </button>
            <ActionButton
              action={showForm ? "cancel" : "create"}
              onClick={() => {
                setShowForm(!showForm);
                setShowRules(false);
              }}
              style={{
                background: "var(--color-warning-600)",
                borderColor: "var(--color-warning-600)",
                boxShadow: "0 2px 4px rgba(217,119,6,0.3)",
              }}
            >
              {showForm ? t("apptPage.cancelNew") : t("apptPage.newAppointment")}
            </ActionButton>
          </div>
        </div>
      </div>

      {/* ====== 主体内容 ====== */}
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "16px 24px" }}>
        {/* [v3.0.6.11-103 Wave 10] 重复页合并: 预约管理视图 = 嵌入 AppointmentManagementPage */}
        {viewMode === "management" ? (
          <AppointmentManagementPage />
        ) : (
          <>
        {/* 统计卡片 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 'var(--space-3, 12px)',
            marginBottom: 'var(--space-4, 16px)',
          }}
        >
          <StatCard
            title={t("apptPage.todayAppointments")}
            value={todayStats.total}
            icon={<CalendarClock size={20} />}
            color="primary"
          />
          <StatCard
            title={t("apptPage.pendingConfirm")}
            value={todayStats.pending}
            icon={<Clock size={20} />}
            color="warning"
          />
          <StatCard
            title={t("apptPage.confirmed")}
            value={todayStats.confirmed}
            icon={<CheckCircle size={20} />}
            color="success"
          />
          <StatCard
            title={t("apptPage.noShow")}
            value={todayStats.noShow}
            icon={<XCircle size={20} />}
            color="error"
          />
          <StatCard
            title={t("apptPage.avgWait")}
            value={todayStats.avgWaitTime}
            icon={<Clock size={20} />}
            color="info"
          />
          <StatCard
            title={t("apptPage.utilization")}
            value={todayStats.utilizationRate}
            suffix="%"
            icon={<BarChart3 size={20} />}
            color="info"
          />
        </div>

        {/* [W5] 资源排班甘特 (设备/机房/技师) */}
        {showGantt && (
          <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <ResourceGantt
              appointments={appointments as unknown as Array<Record<string, unknown>>}
              onCreate={({ rowId, dimension, startMin, date }) => {
                const hh = String(Math.floor(startMin / 60)).padStart(2, "0");
                const mm = String(startMin % 60).padStart(2, "0");
                setFormData((prev) => ({
                  ...prev,
                  examDate: date,
                  examTime: `${hh}:${mm}`,
                  ...(dimension === "ROOM" ? { roomId: rowId } : {}),
                  ...(dimension === "DEVICE" ? { deviceId: rowId } : {}),
                  ...(dimension === "TECH" ? { technicianId: rowId } : {}),
                }));
                setShowForm(true);
                setShowGantt(false);
              }}
            />
          </div>
        )}

        {/* [W5] 预约运营面板 (等候队列/提醒计划/失约清单) */}
        {showOps && (
          <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <AppointmentOpsPanels />
          </div>
        )}

        {/* [W-D8] 诊室 / 候补 / 提醒 / 绿色通道 资源面板 */}
        {showResourceOps && (
          <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
            <AppointmentResourcePanel />
          </div>
        )}

        <div style={{ display: "flex", gap: 'var(--space-4, 16px)', alignItems: "flex-start" }}>
          {/* ====== 左侧面板 (60%) ====== */}
          <div style={{ flex: "0 0 60%" }}>
            <AppointmentCalendar
              viewMode={viewMode}
              setViewMode={setViewMode}
              calendarSubView={calendarSubView}
              setCalendarSubView={setCalendarSubView}
              weekDates={weekDates}
              setCurrentWeekStart={setCurrentWeekStart}
              currentWeekStart={currentWeekStart}
              selectedDevice={selectedDevice}
              setSelectedDevice={setSelectedDevice}
              searchKeyword={searchKeyword}
              setSearchKeyword={setSearchKeyword}
              appointments={appointments}
              getStatusConfig={getStatusConfig}
              formatDate={formatDate}
              formatDateCht={formatDateCht}
              timeSlots={timeSlots}
              openDetail={openDetail}
              showWaitlist={showWaitlist}
              setShowWaitlist={setShowWaitlist}
              filteredAppointments={filteredAppointments}
              filteredListAppointments={filteredListAppointments}
              selectedIds={selectedAptIds}
              onToggleSelect={(id) =>
                setSelectedAptIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              onToggleSelectAll={(checked) =>
                setSelectedAptIds(checked ? new Set(filteredListAppointments.map((a) => a.id)) : new Set())
              }
              onBatchAction={(action, ids) => void handleAppointmentBatch(action, ids)}
              contextActions={{
                onView: openDetail,
                onCheckIn: (apt) => void checkInAppointment(apt),
                onCancel: cancelAppointmentDirect,
                onReschedule: rescheduleAppointment,
                onPrint: printAppointment,
              }}
              statsData={[
                { label: t("apptPage.todayAppointments"), value: appointments.filter(a => a.examDate === formatDateObj(new Date())).length, color: primaryBlue, bg: lightBlue },
                { label: t("apptPage.status.checkedIn"), value: appointments.filter(a => a.examDate === formatDateObj(new Date()) && a.status === "checked-in").length, color: "#059669", bg: "#22c55e22" },
                { label: t("apptPage.pendingConfirm"), value: appointments.filter(a => a.status === "pending").length, color: "var(--color-warning-500)", bg: "#f59e0b22" },
                { label: t("apptPage.noShow"), value: appointments.filter(a => a.status === "no-show").length, color: "var(--color-error-500)", bg: "#ef444422" },
                { label: t("apptPage.todayBooked"), value: appointments.filter(a => a.examDate === formatDateObj(new Date()) && a.status !== "cancelled").length, color: "#7c3aed", bg: "#8b5cf622" },
              ]}
            />
            {viewMode === "reminders" && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                  marginTop: 'var(--space-3, 12px)',
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 'var(--space-1, 4px)',
                    padding: "10px 12px",
                    borderBottom: `1px solid ${borderGray}`,
                    background: "var(--bg-card)",
                    flexWrap: "wrap",
                  }}
                >
                  {(
                    [
                      ["reminders", t("apptPage.reminderRecords")],
                      ["reschedules", t("apptPage.rescheduleRecords")],
                      ["cancellations", t("apptPage.cancellationRecords")],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setReminderTab(key)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 700,
                        background: reminderTab === key ? primaryBlue : lightBlue,
                        color: reminderTab === key ? "#fff" : primaryBlue,
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                {reminderTab === "reminders" && (
                  <div style={{ overflowX: "auto" }}>
                    <DataTable<ReminderRecord>
                      columns={reminderColumns}
                      dataSource={filteredReminderRecords}
                      rowKey="id"
                      emptyText={t("apptPage.noReminders")}
                    />
                  </div>
                )}
                {reminderTab === "reschedules" && (
                  <div style={{ overflowX: "auto" }}>
                    <DataTable<RescheduleRecord>
                      columns={rescheduleColumns}
                      dataSource={rescheduleRecords}
                      rowKey="id"
                      emptyText={t("apptPage.noReschedules")}
                    />
                  </div>
                )}
                {reminderTab === "cancellations" && (
                  <div style={{ overflowX: "auto" }}>
                    <DataTable<CancellationRecord>
                      columns={cancellationColumns}
                      dataSource={cancellationRecords}
                      rowKey="id"
                      emptyText={t("apptPage.noCancellations")}
                    />
                  </div>
                )}
              </div>
            )}
          </div>{/* ====== 右侧面板 (40%) ====== */}          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
              gap: 'var(--space-3, 12px)',
            }}
          >
            <AppointmentForm
              showForm={showForm}
              setShowForm={setShowForm}
              formData={formData}
              setFormData={setFormData}
              validationError={validationError}
              formErrors={formErrors}
              setFormErrors={setFormErrors}
              setValidationError={setValidationError}
              handleSubmit={handleCreateAppointment}
              submitting={creatingAppt}
              timeSlots={timeSlots}
            />{/* ====== 预约规则设置 ====== */}
            {showRules && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: primaryBlue,
                    color: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    <Settings size={15} /> {t("apptPage.rulesTitle")}
                  </div>
                  <button aria-label="关闭"
                    onClick={() => setShowRules(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div
                  style={{
                    padding: 'var(--space-3, 12px)',
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    maxHeight: 600,
                    overflowY: "auto",
                  }}
                >
                  {/* 全局说明 */}
                  <div
                    style={{
                      background: "var(--color-warning-bg)",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#92400e",
                      border: "1px solid var(--color-warning-border)",
                    }}
                  >
                    <AlertTriangle
                      size={12}
                      style={{ display: "inline", marginRight: 'var(--space-1, 4px)' }}
                    />
                    {t("apptPage.rulesNote")}
                  </div>
                  {/* 搜索 */}
                  <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
                    <input
                      placeholder={t("apptPage.searchDevice")}
                      value={ruleSearch}
                      onChange={(e) => setRuleSearch(e.target.value)}
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 6,
                        fontSize: 12, color: primaryBlue,
                      }}
                    />
                  </div>
                  {rules
                    .filter((rule) => {
                      const kw = ruleSearch.trim().toLowerCase();
                      if (!kw) return true;
                      const device = initialModalityDevices.find(
                        (d) => d.id === rule.deviceId,
                      );
                      return (
                        (rule.deviceName ?? "").toLowerCase().includes(kw) ||
                        (rule.deviceId ?? "").toLowerCase().includes(kw) ||
                        (device?.modality ?? "").toLowerCase().includes(kw)
                      );
                    })
                    .map((rule) => {
                    const device = initialModalityDevices.find(
                      (d) => d.id === rule.deviceId,
                    );
                    return (
                      <div
                        key={rule.deviceId}
                        style={{
                          background: "var(--bg-card)",
                          borderRadius: 8,
                          padding: 10,
                          border: `1px solid ${borderGray}`,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 'var(--space-2, 8px)',
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <Monitor size={12} style={{ color: primaryBlue }} />
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: primaryBlue,
                              }}
                            >
                              {rule.deviceName.split("（")[0]}
                            </span>
                            <AppText size="xs" color="secondary" as="span">
                              {device?.modality || ""}
                            </AppText>
                          </div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 'var(--space-1, 4px)',
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={rule.enabled}
                              onChange={(e) => {
                                setRules((prev) =>
                                  prev.map((r) =>
                                    r.deviceId === rule.deviceId
                                      ? { ...r, enabled: e.target.checked }
                                      : r,
                                  ),
                                );
                              }}
                              style={{ cursor: "pointer" }}
                            />
                            <AppText size="xs" as="span" style={{ color: rule.enabled ? "#059669" : "#94a3b8" }}>
                              {rule.enabled ? t("apptPage.enabled") : t("apptPage.disabled")}
                            </AppText>
                          </label>
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: 6,
                          }}
                        >
                          <div>
                            <label
                              style={{
                                fontSize: 12,
                                color: textGray,
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              {t("apptPage.maxDaily")}
                            </label>
                            <input
                              type="number"
                              value={rule.maxDailyAppointments}
                              disabled={!rule.enabled}
                              onChange={(e) =>
                                setRules((prev) =>
                                  prev.map((r) =>
                                    r.deviceId === rule.deviceId
                                      ? {
                                          ...r,
                                          maxDailyAppointments:
                                            parseInt(e.target.value) || 0,
                                        }
                                      : r,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "4px 6px",
                                border: `1px solid ${borderGray}`,
                                borderRadius: 4,
                                fontSize: 12, color: primaryBlue,
                                background: rule.enabled ? whiteBg : "var(--bg-primary)",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                fontSize: 12,
                                color: textGray,
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              {t("apptPage.maxPerSlot")}
                            </label>
                            <input
                              type="number"
                              value={rule.maxPerTimeSlot}
                              disabled={!rule.enabled}
                              onChange={(e) =>
                                setRules((prev) =>
                                  prev.map((r) =>
                                    r.deviceId === rule.deviceId
                                      ? {
                                          ...r,
                                          maxPerTimeSlot:
                                            parseInt(e.target.value) || 0,
                                        }
                                      : r,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "4px 6px",
                                border: `1px solid ${borderGray}`,
                                borderRadius: 4,
                                fontSize: 12, color: primaryBlue,
                                background: rule.enabled ? whiteBg : "var(--bg-primary)",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                fontSize: 12,
                                color: textGray,
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              {t("apptPage.minAdvance")}
                            </label>
                            <input
                              type="number"
                              value={rule.minAdvanceDays}
                              disabled={!rule.enabled}
                              onChange={(e) =>
                                setRules((prev) =>
                                  prev.map((r) =>
                                    r.deviceId === rule.deviceId
                                      ? {
                                          ...r,
                                          minAdvanceDays:
                                            parseInt(e.target.value) || 0,
                                        }
                                      : r,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "4px 6px",
                                border: `1px solid ${borderGray}`,
                                borderRadius: 4,
                                fontSize: 12, color: primaryBlue,
                                background: rule.enabled ? whiteBg : "var(--bg-primary)",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <div>
                            <label
                              style={{
                                fontSize: 12,
                                color: textGray,
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              {t("apptPage.maxAdvance")}
                            </label>
                            <input
                              type="number"
                              value={rule.maxAdvanceDays}
                              disabled={!rule.enabled}
                              onChange={(e) =>
                                setRules((prev) =>
                                  prev.map((r) =>
                                    r.deviceId === rule.deviceId
                                      ? {
                                          ...r,
                                          maxAdvanceDays:
                                            parseInt(e.target.value) || 0,
                                        }
                                      : r,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "4px 6px",
                                border: `1px solid ${borderGray}`,
                                borderRadius: 4,
                                fontSize: 12, color: primaryBlue,
                                background: rule.enabled ? whiteBg : "var(--bg-primary)",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label
                              style={{
                                fontSize: 12,
                                color: textGray,
                                display: "block",
                                marginBottom: 2,
                              }}
                            >
                              {t("apptPage.noShowPenalty")}
                            </label>
                            <input
                              type="number"
                              value={rule.noShowPenalty}
                              disabled={!rule.enabled}
                              onChange={(e) =>
                                setRules((prev) =>
                                  prev.map((r) =>
                                    r.deviceId === rule.deviceId
                                      ? {
                                          ...r,
                                          noShowPenalty:
                                            parseInt(e.target.value) || 0,
                                        }
                                      : r,
                                  ),
                                )
                              }
                              style={{
                                width: "100%",
                                padding: "4px 6px",
                                border: `1px solid ${borderGray}`,
                                borderRadius: 4,
                                fontSize: 12, color: primaryBlue,
                                background: rule.enabled ? whiteBg : "var(--bg-primary)",
                                boxSizing: "border-box",
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  <button
                    onClick={() => {
                      // [v3.0.6.11-99 Wave8A P1] 规则受控表单已就绪: localStorage 持久化 + toast (后端无规则保存端点, 标注)
                      try {
                        localStorage.setItem("g005_appointment_rules", JSON.stringify(rules));
                      } catch { /* ignore */ }
                      message.success(t("apptPage.rulesSaved"));
                      setShowRules(false);
                    }}
                    style={{
                      padding: "8px",
                      background: primaryBlue,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Save size={13} /> {t("apptPage.saveRules")}
                  </button>
                </div>
              </div>
            )}

            {/* ====== 批量导入 ====== */}
            {showBatchImport && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: primaryBlue,
                    color: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 14,
                      fontWeight: 700,
                    }}
                  >
                    <Upload size={15} /> {t("apptPage.batchImportTitle")}
                  </div>
                  <button aria-label="关闭"
                    onClick={() => setShowBatchImport(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ padding: 'var(--space-5, 20px)', textAlign: "center" }}>
                  <div
                    style={{
                      border: `2px dashed ${borderGray}`,
                      borderRadius: 10,
                      padding: "30px 20px",
                      marginBottom: 'var(--space-4, 16px)',
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.borderColor =
                        "var(--color-primary-500)")
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.borderColor =
                        borderGray)
                    }
                  >
                    <Upload
                      size={32}
                      style={{
                        color: textGray,
                        margin: "0 auto 10px",
                        display: "block",
                      }}
                    />
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: primaryBlue,
                        marginBottom: 'var(--space-1, 4px)',
                      }}
                    >
                      {t("apptPage.clickUpload")}
                    </div>
                    <AppText size="xs" color="secondary" as="div">
                      {t("apptPage.uploadHint")}
                    </AppText>
                    <button
                      style={{
                        marginTop: 'var(--space-3, 12px)',
                        padding: "6px 16px",
                        background: lightBlue,
                        color: primaryBlue,
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = ".csv,.json,.xlsx,.xls";
                        // [v3.0.6.11-99 Wave8A P1] 真实导入: CSV/JSON 解析 → appointmentApi.create 逐条 (xlsx 二进制不支持, 提示)
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
                          if (!file) return;
                          if (/\.(xlsx|xls)$/i.test(file.name)) {
                            message.warning(t("apptPage.importXlsxWarn"));
                            return;
                          }
                          let rows: Record<string, unknown>[] = [];
                          try {
                            const text = await file.text();
                            if (file.name.toLowerCase().endsWith(".json")) {
                              const parsed = JSON.parse(text);
                              rows = Array.isArray(parsed)
                                ? parsed
                                : Array.isArray((parsed as any)?.rows)
                                  ? (parsed as any).rows
                                  : [];
                            } else {
                              rows = parseCsv(text);
                            }
                          } catch {
                            message.error(t("apptPage.parseFailed"));
                            return;
                          }
                          if (rows.length === 0) {
                            message.warning(t("apptPage.noImportRows"));
                            return;
                          }
                          let ok = 0;
                          let fail = 0;
                          const errors: string[] = [];
                          for (const row of rows) {
                            const payload = rowToAppointment(row);
                            if (!payload) { fail++; errors.push(t("apptPage.missingFields")); continue; }
                            try {
                              const res = await appointmentApi.create(payload);
                              if (res.success) ok++;
                              else { fail++; errors.push(res.error?.message ?? t("apptPage.createFailed2")); }
                            } catch {
                              fail++;
                              errors.push(t("apptPage.apiError"));
                            }
                          }
                          message.success(t("apptPage.importDone", { ok, fail }));
                          if (fail > 0) {
                            message.warning(errors.slice(0, 3).join("；") + (errors.length > 3 ? ` 等 ${errors.length} 条错误` : ""));
                          }
                          if (ok > 0) {
                            try {
                              const reloadRes = await appointmentApi.list();
                              const items = (reloadRes.data as { items?: unknown[] } | null)?.items ?? reloadRes.data;
                              if (reloadRes.success && Array.isArray(items)) setAppointments(items as unknown as Appointment[]);
                            } catch { /* 列表刷新失败不阻断 */ }
                            setShowBatchImport(false);
                          }
                        };
                        input.click();
                      }}
                    >
                      {t("apptPage.selectFile")}
                    </button>
                  </div>
                  <div
                    style={{
                      background: "var(--bg-card)",
                      borderRadius: 6,
                      padding: "10px 12px",
                      textAlign: "left",
                      border: `1px solid ${borderGray}`,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: primaryBlue,
                        marginBottom: 6,
                      }}
                    >
                      {t("apptPage.importGuide")}
                    </div>
                    <AppText size="xs" color="secondary" as="div" style={{ lineHeight: 1.8 }}>
                      {t("apptPage.importStep1")}
                      <br />
                      {t("apptPage.importStep2")}
                      <br />
                      {t("apptPage.importStep3")}
                      <br />
                      {t("apptPage.importStep4")}
                      <br />
                      {t("apptPage.importStep5")}
                    </AppText>
                  </div>
                  <div
                    style={{
                      marginTop: 'var(--space-3, 12px)',
                      display: "flex",
                      gap: 'var(--space-2, 8px)',
                      justifyContent: "center",
                    }}
                  >
                    <button
                      style={{
                        padding: "6px 14px",
                        background: whiteBg,
                        color: primaryBlue,
                        border: `1px solid ${borderGray}`,
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--space-1, 4px)',
                      }}
                      onClick={async (evt) => {
                        const btn = (evt?.target ||
                          evt?.currentTarget) as HTMLButtonElement;
                        btn.disabled = true;
                        const orig = btn.innerHTML;
                        btn.innerHTML = t("apptPage.generating");
                        await new Promise((r) => setTimeout(r, 1500));
                        const template =
                          "姓名,性别,年龄,检查项目,设备,日期,时段,电话\n张三,男,45,CT增强,CT-1,2026-05-10,上午,13800001234";
                        const blob = new Blob(["\ufeff" + template], {
                          type: "text/csv;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = t("apptPage.templateFilename");
                        a.click();
                        URL.revokeObjectURL(url);
                        btn.innerHTML = t("apptPage.downloaded");
                        setTimeout(() => {
                          btn.innerHTML = orig;
                          btn.disabled = false;
                        }, 2000);
                      }}
                    >
                      <Download size={12} /> {t("apptPage.downloadTemplate")}
                    </button>
                    <button
                      onClick={() => setShowBatchImport(false)}
                      style={{
                        padding: "6px 14px",
                        background: "var(--color-warning-600)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--space-1, 4px)',
                      }}
                    >
                      <Check size={12} /> {t("apptPage.startImport")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ====== 等候名单面板 ====== */}
            {showWaitlist && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: "#7c3aed",
                    color: "#fff",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <User size={15} /> {t("apptPage.waitlist")} ({waitlist.length})
                  </div>
                  <button aria-label="关闭"
                    onClick={() => setShowWaitlist(false)}
                    style={{
                      background: "transparent",
                      border: "none",
                      color: "#fff",
                      cursor: "pointer",
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
                <div style={{ padding: 'var(--space-3, 12px)', maxHeight: 400, overflowY: "auto" }}>
                  {waitlist.map((w) => (
                    <div
                      key={w.id}
                      style={{
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: `1px solid ${borderGray}`,
                        marginBottom: 6,
                        background: "var(--bg-card)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: 'var(--space-1, 4px)',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                          }}
                        >
                          {w.patientName}
                        </span>
                        <span
                          style={{
                            padding: "1px 6px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 700,
                            background:
                              w.priority === "critical"
                                ? "var(--color-error-bg)"
                                : w.priority === "urgent"
                                  ? "var(--color-warning-bg)"
                                  : "var(--bg-primary)",
                            color:
                              w.priority === "critical"
                                ? "var(--color-error-600)"
                                : w.priority === "urgent"
                                  ? "var(--color-warning-600)"
                                  : "#64748b",
                          }}
                        >
                          {w.priority === "critical"
                            ? t("apptPage.priority.critical")
                            : w.priority === "urgent"
                              ? t("apptPage.priority.urgent")
                              : t("apptPage.priority.normal")}
                        </span>
                      </div>
                      <AppText size="xs" color="secondary" as="div">
                        {w.examItemName} · {w.modality}
                      </AppText>
                      <AppText size="xs" color="secondary" as="div" style={{ marginBottom: 'var(--space-1, 4px)' }}>
                        {t("apptPage.expect")} {w.preferredDate} {w.preferredTime}
                      </AppText>
                      <div style={{ display: "flex", gap: 'var(--space-1, 4px)' }}>
                        <button
                          onClick={() => void handleWaitlistNotify(w)}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 4,
                            border: "none",
                            background:
                              waitlistNotifyLoading === w.id
                                ? "var(--color-warning-bg)"
                                : "var(--color-info-bg)",
                            color:
                              waitlistNotifyLoading === w.id
                                ? "var(--color-warning-600)"
                                : "var(--color-primary-600)",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          {waitlistNotifyLoading === w.id ? (
                            ""
                          ) : (
                            <Bell size={10} />
                          )}{" "}
                          {t("apptPage.notify")}
                        </button>
                        <button
                          onClick={handleWaitlistAutoSort}
                          style={{
                            padding: "3px 10px",
                            borderRadius: 4,
                            border: "1px solid var(--border-color)",
                            background: "var(--bg-card)",
                            color: "#059669",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          {t("apptPage.autoAssign")}
                        </button>
                      </div>
                    </div>
                  ))}
                  <div
                    style={{
                      fontSize: 12,
                      color: "var(--text-secondary)",
                      textAlign: "center",
                      marginTop: 6,
                    }}
                  >
                    {t("apptPage.waitlistHint")}
                  </div>
                </div>
              </div>
            )}

            {/* ====== 今日概览卡片（非表单/规则时显示） ====== */}
            {!showForm && !showRules && !showBatchImport && !showWaitlist && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "12px 16px",
                    background: primaryBlue,
                    color: "#fff",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <CalendarClock size={15} /> {t("apptPage.overview")}
                  </div>
                </div>
                <div style={{ padding: 'var(--space-3, 12px)' }}>
                  {/* 设备占用 */}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: primaryBlue,
                      marginBottom: 'var(--space-2, 8px)',
                    }}
                  >
                    {t("apptPage.deviceToday")}
                  </div>
                  {filteredDevices.map((device) => {
                    const stats = getDeviceDayStats(new Date(), device.id);
                    const rule = rules.find((r) => r.deviceId === device.id);
                    return (
                      <div key={device.id} style={{ marginBottom: 'var(--space-2, 8px)' }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            marginBottom: 3,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: "var(--text-primary)",
                            }}
                          >
                            {device.name.split("（")[0]}
                          </span>
                          <span style={{ fontSize: 12, color: textGray }}>
                            {stats.total} / {rule?.maxDailyAppointments || 60}{" "}
                            {t("apptPage.personTimes")}
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "var(--border-color)",
                            borderRadius: 3,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${stats.occupancy}%`,
                              background:
                                stats.occupancy > 85
                                  ? "var(--color-error-600)"
                                  : stats.occupancy > 60
                                    ? "var(--color-warning-600)"
                                    : "var(--color-primary-500)",
                              borderRadius: 3,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {/* 快捷操作 */}
                  <div style={{ marginTop: 'var(--space-4, 16px)' }}>
                    <AppText size="xs" weight={700} as="div" style={{ color: primaryBlue, marginBottom: 'var(--space-2, 8px)' }}>
                      {t("apptPage.quickActions")}
                    </AppText>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      {[
                        {
                          label: t("apptPage.newAppointment"),
                          icon: Plus,
                          action: () => setShowForm(true),
                          color: "var(--color-warning-500)", bg: "#f59e0b22",
                        },
                        {
                          label: t("apptPage.batchImport"),
                          icon: Upload,
                          action: () => setShowBatchImport(true),
                          color: "var(--color-primary-500)", bg: "#3b82f622",
                        },
                        {
                          label: t("apptPage.rules"),
                          icon: Settings,
                          action: () => {
                            setShowRules(true);
                            setShowForm(false);
                          },
                          color: "var(--color-primary-800)",
                          bg: lightBlue,
                        },
                        {
                          label: t("apptPage.exportData"),
                          icon: Download,
                          action: async () => {
                            const btn =
                              document.activeElement as HTMLButtonElement;
                            btn.disabled = true;
                            const orig = btn.innerHTML;
                            btn.innerHTML = t("apptPage.exporting");
                            await new Promise((r) => setTimeout(r, 1500));
                            localStorage.setItem(
                              "g005_appointment_export",
                              JSON.stringify({
                                timestamp: new Date().toISOString(),
                              }),
                            );
                            btn.innerHTML = t("apptPage.exportSuccess");
                            setTimeout(() => {
                              btn.innerHTML = orig;
                              btn.disabled = false;
                            }, 2000);
                          },
                          color: "#059669",
                          bg: "#22c55e22",
                        },
                      ].map((item, i) => (
                        <button
                          key={i}
                          onClick={item.action}
                          style={{
                            padding: "8px 6px",
                            background: item.bg,
                            color: item.color,
                            border: "none",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          <item.icon size={15} />
                          {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
          </>
        )}
      </div>

      {/* ====== 预约详情弹窗 ====== */}
      {showDetailModal && selectedAppointment && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowDetailModal(false)}
        >
          <Card bordered={false}
            style={{
              background: whiteBg,
              borderRadius: 12,
              width: 520,
              maxHeight: "85vh",
              overflowY: "auto",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              border: `1px solid ${borderGray}`,
            }}
            onClick={(e) => e.stopPropagation()}
           styles={{ body: { padding: 0 } }}>
            <div
              style={{
                padding: "14px 18px",
                background: primaryBlue,
                color: "#fff",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: "12px 12px 0 0",
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Eye size={15} /> {t("apptPage.detailTitle")}
              </div>
              <button aria-label="关闭"
                onClick={() => setShowDetailModal(false)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 18 }}>
              {/* 基本信息 */}
              <div
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 8,
                  padding: "10px 12px",
                  marginBottom: 14,
                  border: `1px solid ${borderGray}`,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 'var(--space-2, 8px)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 800,
                      color: primaryBlue,
                    }}
                  >
                    {selectedAppointment.patientName}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        background: getStatusConfig(selectedAppointment.status)
                          .bg,
                        color: getStatusConfig(selectedAppointment.status)
                          .color,
                      }}
                    >
                      {getStatusConfig(selectedAppointment.status).label}
                    </span>
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: 10,
                        fontSize: 12,
                        fontWeight: 700,
                        background: getPriorityConfig(
                          selectedAppointment.priority,
                        ).bg,
                        color: getPriorityConfig(selectedAppointment.priority)
                          .color,
                      }}
                    >
                      {getPriorityConfig(selectedAppointment.priority).label}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: textGray,
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 'var(--space-1, 4px)',
                  }}
                >
                  <span>
                    {selectedAppointment.gender} / {selectedAppointment.age}{t("apptPage.ageSuffix")}
                  </span>
                  <span>ID: {selectedAppointment.patientId}</span>
                  <span>{t("apptPage.apptNo")}{selectedAppointment.id}</span>
                </div>
              </div>

              {/* 检查信息 */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: primaryBlue,
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 'var(--space-1, 4px)',
                  }}
                >
                  <Scan size={13} /> {t("apptPage.examInfo")}
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 6,
                    fontSize: 12,
                  }}
                >
                  {[
                    [t("apptPage.labelExamItem"), selectedAppointment.examItemName],
                    [t("apptPage.labelModality"), selectedAppointment.modality],
                    [t("apptPage.labelBodyPart"), selectedAppointment.bodyPart],
                    [t("apptPage.labelDevice"), selectedAppointment.deviceName?.split("（")[0]],
                    [t("apptPage.labelApptDate"), selectedAppointment.examDate],
                    [t("apptPage.labelApptTime"), selectedAppointment.examTime],
                    [t("apptPage.labelRoom"), selectedAppointment.roomName],
                    [
                      t("apptPage.labelReferringDoctor"),
                      selectedAppointment.referringDoctorName || "-",
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        background: "var(--bg-card)",
                        borderRadius: 6,
                        padding: "5px 8px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <AppText size="xs" color="secondary" as="div">
                        {label}
                      </AppText>
                      <div
                        style={{
                          fontWeight: 700,
                          color: primaryBlue,
                          marginTop: 1,
                        }}
                      >
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 临床诊断 */}
              {selectedAppointment.clinicalDiagnosis && (
                <div style={{ marginBottom: 14 }}>
                  <AppText size="xs" weight={700} as="div" style={{ color: primaryBlue, marginBottom: 6, display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
                    <AlertCircle size={13} /> {t("apptPage.clinicalDiagnosis")}
                  </AppText>
                  <div
                    style={{
                      background: "var(--color-warning-bg)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "#92400e",
                      border: "1px solid var(--color-warning-border)",
                    }}
                  >
                    {selectedAppointment.clinicalDiagnosis}
                  </div>
                </div>
              )}

              {/* 备注 */}
              {selectedAppointment.notes && (
                <div style={{ marginBottom: 14 }}>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: primaryBlue,
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 'var(--space-1, 4px)',
                    }}
                  >
                    <Bell size={13} /> {t("apptPage.notes")}
                  </div>
                  <div
                    style={{
                      background: "var(--color-info-bg)",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: primaryBlue,
                      border: "1px solid #bfdbfe",
                    }}
                  >
                    {selectedAppointment.notes}
                  </div>
                </div>
              )}

              {/* 取消原因 */}
              {selectedAppointment.status === "cancelled" &&
                selectedAppointment.cancelReason && (
                  <div style={{ marginBottom: 14 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "var(--color-error-600)",
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--space-1, 4px)',
                      }}
                    >
                      <XCircle size={13} /> {t("apptPage.cancelReasonLabel")}
                    </div>
                    <div
                      style={{
                        background: "var(--color-error-bg)",
                        borderRadius: 6,
                        padding: "6px 10px",
                        fontSize: 12,
                        color: "#991b1b",
                        border: "1px solid #fca5a5",
                      }}
                    >
                      {CANCEL_REASONS.find(
                        (r) => r.value === selectedAppointment.cancelReason,
                      )?.label || selectedAppointment.cancelReason}
                    </div>
                  </div>
                )}

              {/* 时间线 */}
              <div style={{ marginBottom: 14 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: primaryBlue,
                    marginBottom: 6,
                    display: "flex",
                    alignItems: "center",
                    gap: 'var(--space-1, 4px)',
                  }}
                >
                  <Clock size={13} /> {t("apptPage.recordTime")}
                </div>
                <div style={{ fontSize: 12, color: textGray }}>
                  <div>{t("apptPage.createdAt")}{selectedAppointment.createdAt}</div>
                  <div>{t("apptPage.updatedAt")}{selectedAppointment.updatedAt}</div>
                </div>
              </div>

              {/* 操作 */}
              {selectedAppointment.status !== "cancelled" &&
                selectedAppointment.status !== "no-show" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 'var(--space-2, 8px)',
                      borderTop: `1px solid ${borderGray}`,
                      paddingTop: 14,
                    }}
                  >
                    <button
                      onClick={() => {
                        setShowDetailModal(false);
                        setShowCancelModal(true);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: "var(--color-error-bg)",
                        color: "var(--color-error-600)",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 'var(--space-1, 4px)',
                      }}
                    >
                      <XCircle size={13} /> {t("apptPage.cancelAppointment")}
                    </button>
                    <button
                      onClick={() => {
                        setFormData((prev) => ({
                          ...prev,
                          patientName: selectedAppointment.patientName,
                          gender: selectedAppointment.gender,
                          age: String(selectedAppointment.age),
                          phone: selectedAppointment.phone,
                          idCard: selectedAppointment.idCard,
                          examType: selectedAppointment.modality,
                          examItemName: selectedAppointment.examItemName,
                          bodyPart: selectedAppointment.bodyPart,
                          examDate: selectedAppointment.examDate,
                          examTime: selectedAppointment.examTime,
                          deviceId: selectedAppointment.deviceId,
                          deviceName: selectedAppointment.deviceName,
                          clinicalDiagnosis:
                            selectedAppointment.clinicalDiagnosis,
                          notes: selectedAppointment.notes,
                          priority: selectedAppointment.priority,
                        }));
                        setShowDetailModal(false);
                        setShowForm(true);
                      }}
                      style={{
                        flex: 1,
                        padding: "8px",
                        background: lightBlue,
                        color: primaryBlue,
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 'var(--space-1, 4px)',
                      }}
                    >
                      <Edit2 size={13} /> {t("apptPage.editAppointment")}
                    </button>
                  </div>
                )}
            </div>
          </Card>
        </div>
      )}

      {/* ====== 取消预约弹窗 ====== */}
      {showCancelModal && selectedAppointment && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
          }}
          onClick={() => {
            setShowCancelModal(false);
            setCancelReason("");
          }}
        >
          <Card bordered={false}
            style={{
              background: whiteBg,
              borderRadius: 12,
              width: 420,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              border: `1px solid ${borderGray}`,
            }}
            onClick={(e) => e.stopPropagation()}
           styles={{ body: { padding: 0 } }}>
            <div
              style={{
                padding: "14px 18px",
                background: "var(--color-error-600)",
                color: "#fff",
                borderRadius: "12px 12px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              <XCircle size={16} /> {t("apptPage.cancelTitle")}
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 'var(--space-1, 4px)' }}>
                  {t("apptPage.apptInfo")}
                </div>
                <div
                  style={{
                    background: "var(--bg-card)",
                    borderRadius: 6,
                    padding: "8px 10px",
                    border: `1px solid ${borderGray}`,
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: primaryBlue,
                    }}
                  >
                    {selectedAppointment.patientName}
                  </div>
                  <div style={{ fontSize: 12, color: textGray, marginTop: 2 }}>
                    {selectedAppointment.examItemName} ·{" "}
                    {selectedAppointment.examDate}{" "}
                    {selectedAppointment.examTime}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <AppText size="xs" weight={700} as="div" style={{ color: primaryBlue, marginBottom: 'var(--space-2, 8px)' }}>
                  {t("apptPage.cancelReasonRequired")}
                </AppText>
                {cancelReasonError && (
                  <AppText size="xs" color="error" as="div" style={{ marginBottom: 'var(--space-2, 8px)' }}>
                    {cancelReasonError}
                  </AppText>
                )}
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 6 }}
                >
                  {CANCEL_REASONS.map((reason) => (
                    <label
                      key={reason.value}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--space-2, 8px)',
                        padding: "6px 10px",
                        background:
                          cancelReason === reason.value ? "var(--color-warning-bg)" : "var(--bg-primary)",
                        borderRadius: 6,
                        border: `1px solid ${cancelReason === reason.value ? "var(--color-warning-border)" : borderGray}`,
                        cursor: "pointer",
                        fontSize: 12,
                        color: primaryBlue,
                      }}
                    >
                      <input
                        type="radio"
                        name="cancelReason"
                        value={reason.value}
                        checked={cancelReason === reason.value}
                        onChange={(e) => setCancelReason(e.target.value)}
                        style={{ cursor: "pointer" }}
                      />
                      {reason.label}
                    </label>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
                <button
                  onClick={() => {
                    setShowCancelModal(false);
                    setCancelReason("");
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: whiteBg,
                    color: primaryBlue,
                    border: `1px solid ${borderGray}`,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("apptPage.back")}
                </button>
                <button
                  onClick={handleCancelAppointment}
                  disabled={!cancelReason}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: cancelReason ? "var(--color-error-600)" : "var(--bg-primary)",
                    color: cancelReason ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: cancelReason ? "pointer" : "not-allowed",
                  }}
                >
                  {t("apptPage.confirmCancel")}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* ====== 冲突检测弹窗 ====== */}
      {conflictModal.show && conflictModal.result && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1002,
          }}
          onClick={() => setConflictModal({ show: false, result: null })}
        >
          <Card bordered={false}
            style={{
              background: whiteBg,
              borderRadius: 12,
              width: 500,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
           styles={{ body: { padding: 0 } }}>
            <div
              style={{
                padding: "14px 18px",
                background: "var(--color-error-600)",
                color: "#fff",
                borderRadius: "12px 12px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 14,
                fontWeight: 800,
              }}
            >
              <AlertTriangle size={16} /> {t("apptPage.conflictTitle")}
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 'var(--space-2, 8px)' }}>
                  {conflictModal.result.message}
                </div>
                <div style={{ maxHeight: 200, overflowY: "auto" }}>
                  {conflictModal.result.conflictingAppointments.map((c) => (
                    <div
                      key={c.id}
                      style={{
                        padding: "8px 10px",
                        background: "var(--color-error-bg)",
                        borderRadius: 6,
                        marginBottom: 6,
                        border: "1px solid #fca5a5",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#991b1b",
                        }}
                      >
                        {c.patientName}
                      </div>
                      <AppText size="xs" as="div" style={{ color: "#7f1d1d" }}>
                        {c.examItemName} · {c.examDate} {c.examTime}
                      </AppText>
                      <AppText size="xs" as="div" style={{ color: "#7f1d1d" }}>
                        {t("apptPage.deviceLabel")}{c.deviceName?.split("（")[0]} | {t("apptPage.statusLabel")}{" "}
                        {STATUS_CONFIG[c.status]?.label}
                      </AppText>
                    </div>
                  ))}
                </div>
              </div>
              <AppText size="xs" color="warning" as="div" style={{ padding: "10px 12px", background: "var(--color-warning-bg)", borderRadius: 6, border: "1px solid var(--color-warning-border)", marginBottom: 14 }}>
                {t("apptPage.conflictHint")}
              </AppText>
              <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
                <button
                  onClick={() => {
                    setConflictModal({ show: false, result: null });
                    if (preventSubmitOnConflict)
                      setPreventSubmitOnConflict(false);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: whiteBg,
                    color: primaryBlue,
                    border: `1px solid ${borderGray}`,
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {t("apptPage.backToEdit")}
                </button>
                <button
                  disabled={creatingAppt}
                  onClick={() => {
                    setConflictModal({ show: false, result: null });
                    setPreventSubmitOnConflict(false);
                    void submitAppointment(true);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "var(--color-warning-600)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: creatingAppt ? "wait" : "pointer",
                    opacity: creatingAppt ? 0.6 : 1,
                  }}
                >
                  {t("apptPage.forceBook")}
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}

// ==================== [W-D8] 诊室 / 候补 / 提醒 / 绿色通道 资源面板 ====================
type ResourceOpsTab = "waitlist" | "reminder" | "green";

const RES_BLUE = "var(--color-primary-800)";
const RES_BORDER = "var(--border-color)";

const MODALITY_OPTIONS = ["CT", "MR", "DR", "MG", "US", "DSA"].map((v) => ({ value: v, label: v }));
const WAIT_PRIORITY_OPTIONS = [
  { value: "normal", label: "普通" },
  { value: "urgent", label: "加急" },
  { value: "critical", label: "危急" },
];
const REMINDER_CHANNEL_OPTIONS = [
  { value: "SMS", label: "短信" },
  { value: "WECHAT", label: "微信" },
  { value: "PHONE", label: "电话" },
];
const ROOM_STATUS_OPTIONS = [
  { value: "ACTIVE", label: "启用" },
  { value: "MAINTENANCE", label: "维护中" },
  { value: "CLOSED", label: "关闭" },
];

const RES_LABEL: CSSProperties = { fontSize: 12, color: "var(--text-secondary)", fontWeight: 600 };

const toIsoOrNull = (value: string): string | undefined => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
};

function AppointmentResourcePanel() {
  const [tab, setTab] = useState<ResourceOpsTab>("waitlist");
  const [busy, setBusy] = useState(false);

  const [rooms, setRooms] = useState<RoomDto[]>([]);
  const [waitlist, setWaitlist] = useState<WaitlistEntryDto[]>([]);
  const [nextWait, setNextWait] = useState<WaitlistEntryDto | null>(null);
  const [reminders, setReminders] = useState<ReminderPlanDto[]>([]);
  const [greenList, setGreenList] = useState<GreenChannelReservationDto[]>([]);

  const [roomOpen, setRoomOpen] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: "", modality: "CT", location: "", maxPerSlot: "", status: "ACTIVE" });

  const [waitForm, setWaitForm] = useState({ patientName: "", phone: "", modality: "CT", priority: "normal", preferredDate: "" });

  const [remOpen, setRemOpen] = useState(false);
  const [remForm, setRemForm] = useState({ patientName: "", phone: "", channel: "SMS", scheduledAt: "" });

  const [greenOpen, setGreenOpen] = useState(false);
  const [greenForm, setGreenForm] = useState({ patientName: "", patientId: "", modality: "CT", bodyPart: "", deviceId: "", startAt: "" });

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const [roomRes, waitRes, nextRes, remRes, greenRes] = await Promise.all([
        appointmentApi.getRooms(),
        appointmentApi.getWaitlist(),
        appointmentApi.getNextWaitlist(),
        appointmentApi.getReminderPlans(),
        appointmentApi.getGreenChannel(),
      ]);
      if (roomRes.success && Array.isArray(roomRes.data)) setRooms(roomRes.data);
      if (waitRes.success && Array.isArray(waitRes.data)) setWaitlist(waitRes.data);
      if (nextRes.success) setNextWait(nextRes.data ?? null);
      if (remRes.success && Array.isArray(remRes.data)) setReminders(remRes.data);
      if (greenRes.success && Array.isArray(greenRes.data)) setGreenList(greenRes.data);
    } catch {
      /* 后端不可用: 保留既有数据, 面板维持空态 */
    }
    setBusy(false);
  }, []);

  useEffect(() => { void load() }, [load]);

  const handleCreateRoom = async () => {
    if (!roomForm.name.trim() || !roomForm.modality) {
      message.warning("请填写诊室名称与模态");
      return;
    }
    const res = await appointmentApi.createRoom({
      name: roomForm.name.trim(),
      modality: roomForm.modality,
      location: roomForm.location || undefined,
      maxPerSlot: roomForm.maxPerSlot ? Number(roomForm.maxPerSlot) : undefined,
      status: roomForm.status as RoomDto["status"],
    });
    if (res.success) {
      message.success("诊室已创建");
      setRoomForm({ name: "", modality: "CT", location: "", maxPerSlot: "", status: "ACTIVE" });
      void load();
    } else {
      message.error(res.error?.message ?? "创建诊室失败");
    }
  };

  const handleDeleteRoom = async (id: string) => {
    const res = await appointmentApi.deleteRoom(id);
    if (res.success) {
      message.success("诊室已删除");
      void load();
    } else {
      message.error(res.error?.message ?? "删除诊室失败");
    }
  };

  const handleAddWaitlist = async () => {
    if (!waitForm.patientName.trim()) {
      message.warning("请填写患者姓名");
      return;
    }
    const res = await appointmentApi.addWaitlist({
      patientName: waitForm.patientName.trim(),
      modality: waitForm.modality,
      phone: waitForm.phone || undefined,
      priority: waitForm.priority,
      preferredDate: waitForm.preferredDate || undefined,
    });
    if (res.success) {
      message.success("已加入候补队列");
      setWaitForm({ patientName: "", phone: "", modality: "CT", priority: "normal", preferredDate: "" });
      void load();
    } else {
      message.error(res.error?.message ?? "加入候补失败");
    }
  };

  const handleAssignWait = async (id: string) => {
    const res = await appointmentApi.assignWaitlist(id);
    if (res.success) {
      message.success("候补患者已分配");
      void load();
    } else {
      message.error(res.error?.message ?? "分配失败");
    }
  };

  const handleCreateReminder = async () => {
    const at = toIsoOrNull(remForm.scheduledAt);
    if (!remForm.patientName.trim() || !at) {
      message.warning("请填写患者姓名与提醒时间");
      return;
    }
    const res = await appointmentApi.createReminderPlan({
      patientName: remForm.patientName.trim(),
      phone: remForm.phone || undefined,
      channel: remForm.channel as ReminderPlanDto["channel"],
      scheduledAt: at,
    });
    if (res.success) {
      message.success("提醒计划已创建");
      setRemForm({ patientName: "", phone: "", channel: "SMS", scheduledAt: "" });
      setRemOpen(false);
      void load();
    } else {
      message.error(res.error?.message ?? "创建提醒计划失败");
    }
  };

  const handleFireOne = async (id: string) => {
    const res = await appointmentApi.fireReminderPlan(id);
    if (res.success) {
      message.success("提醒已发送");
      void load();
    } else {
      message.error(res.error?.message ?? "发送提醒失败");
    }
  };

  const handleFireDue = async () => {
    const res = await appointmentApi.fireDueReminders();
    if (res.success) {
      const count = Array.isArray(res.data) ? res.data.length : 0;
      message.success(`已发送 ${count} 条到期提醒`);
      void load();
    } else {
      message.error(res.error?.message ?? "发送到期提醒失败");
    }
  };

  const handleCreateGreen = async () => {
    const at = toIsoOrNull(greenForm.startAt);
    if (!greenForm.patientName.trim() || !greenForm.modality || !greenForm.deviceId.trim()) {
      message.warning("请填写患者姓名、模态与设备");
      return;
    }
    const res = await appointmentApi.createGreenChannel({
      patientName: greenForm.patientName.trim(),
      patientId: greenForm.patientId || undefined,
      modality: greenForm.modality,
      bodyPart: greenForm.bodyPart || undefined,
      deviceId: greenForm.deviceId.trim(),
      startAt: at,
    });
    if (res.success) {
      message.success("绿色通道预约已创建");
      setGreenForm({ patientName: "", patientId: "", modality: "CT", bodyPart: "", deviceId: "", startAt: "" });
      setGreenOpen(false);
      void load();
    } else {
      message.error(res.error?.message ?? "创建绿色通道失败");
    }
  };

  const roomColumns: TableColumnsType<RoomDto> = [
    { title: "诊室", dataIndex: "name", key: "name" },
    { title: "模态", dataIndex: "modality", key: "modality", width: 90 },
    { title: "位置", key: "location", render: (_v: unknown, r: RoomDto) => r.location || "-" },
    { title: "单时段上限", dataIndex: "maxPerSlot", key: "maxPerSlot", width: 110, render: (v: unknown) => (v === undefined || v === null ? "-" : String(v)) },
    { title: "开放时间", key: "openTime", width: 150, render: (_v: unknown, r: RoomDto) => `${r.openTime ?? "--:--"} ~ ${r.closeTime ?? "--:--"}` },
    { title: "状态", dataIndex: "status", key: "status", width: 110, render: (v: unknown) => <Tag color={toneToAntd(v)}>{String(v ?? "-")}</Tag> },
    {
      title: "操作", key: "action", width: 80,
      render: (_v: unknown, r: RoomDto) => (
        <Button size="small" danger type="link" disabled={!r.id} onClick={() => { if (r.id) void handleDeleteRoom(r.id) }}>
          删除
        </Button>
      ),
    },
  ];

  const waitColumns: TableColumnsType<WaitlistEntryDto> = [
    { title: "序号", key: "seq", width: 70, render: (_v: unknown, r: WaitlistEntryDto) => r.seq ?? "-" },
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "模态", dataIndex: "modality", key: "modality", width: 80 },
    {
      title: "优先级", dataIndex: "priority", key: "priority", width: 90,
      render: (v: unknown) => <Tag color={toneToAntd(v)}>{String(v ?? "normal")}</Tag>,
    },
    {
      title: "期望时间", key: "preferred", width: 170,
      render: (_v: unknown, r: WaitlistEntryDto) => `${r.preferredDate ?? "-"} ${r.preferredTime ?? ""}`.trim(),
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 100,
      render: (v: unknown) => <Tag color={toneToAntd(v)}>{String(v ?? "WAITING")}</Tag>,
    },
    {
      title: "操作", key: "action", width: 90,
      render: (_v: unknown, r: WaitlistEntryDto) =>
        r.status === "ASSIGNED" ? (
          <Tag color={toneToAntd("success")}>已分配</Tag>
        ) : (
          <Button size="small" type="link" onClick={() => void handleAssignWait(r.id)}>分配</Button>
        ),
    },
  ];

  const reminderColumns: TableColumnsType<ReminderPlanDto> = [
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "渠道", dataIndex: "channel", key: "channel", width: 90 },
    {
      title: "计划时间", dataIndex: "scheduledAt", key: "scheduledAt", width: 170,
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleString("zh-CN") : "-"),
    },
    {
      title: "状态", dataIndex: "status", key: "status", width: 100,
      render: (v: unknown) => <Tag color={toneToAntd(v)}>{String(v ?? "-")}</Tag>,
    },
    {
      title: "操作", key: "action", width: 90,
      render: (_v: unknown, r: ReminderPlanDto) =>
        r.status === "SENT" ? (
          <Tag color={toneToAntd("success")}>已发送</Tag>
        ) : (
          <Button size="small" type="link" icon={<Send size={12} />} onClick={() => void handleFireOne(r.id)}>发送</Button>
        ),
    },
  ];

  const greenColumns: TableColumnsType<GreenChannelReservationDto> = [
    { title: "患者", dataIndex: "patientName", key: "patientName" },
    { title: "模态", dataIndex: "modality", key: "modality", width: 80 },
    { title: "部位", dataIndex: "bodyPart", key: "bodyPart", render: (v: unknown) => String(v ?? "-") },
    {
      title: "设备", key: "device",
      render: (_v: unknown, r: GreenChannelReservationDto) => r.deviceName || r.deviceId,
    },
    {
      title: "预留开始", dataIndex: "reservedStartAt", key: "reservedStartAt", width: 170,
      render: (v: unknown) => (v ? new Date(String(v)).toLocaleString("zh-CN") : "-"),
    },
    {
      title: "优先级", dataIndex: "priority", key: "priority", width: 90,
      render: (v: unknown) => <Tag color={toneToAntd(v)}>{String(v ?? "STAT")}</Tag>,
    },
  ];

  const kpis = [
    { title: "诊室资源", value: rooms.length, color: "primary" as const },
    { title: "候补队列", value: waitlist.length, color: "warning" as const },
    { title: "提醒计划", value: reminders.length, color: "info" as const },
    { title: "绿色通道", value: greenList.length, color: "error" as const },
  ];

  return (
    <div
      data-testid="appointment-resource-panel"
      style={{
        background: "var(--bg-card)",
        borderRadius: 10,
        border: `1px solid ${RES_BORDER}`,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 14px",
          borderBottom: `1px solid ${RES_BORDER}`,
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2, 8px)",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: RES_BLUE,
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--space-1, 4px)",
          }}
        >
          <Building2 size={14} /> 诊室 / 候补 / 提醒 / 绿色通道
        </span>
        <Tooltip title="机房资源维护 (列表 + 新建)">
          <Button size="small" icon={<Settings size={13} />} onClick={() => setRoomOpen(true)}>诊室管理</Button>
        </Tooltip>
        <div style={{ marginLeft: "auto" }}>
          <Button size="small" icon={<RefreshCw size={13} />} loading={busy} onClick={() => void load()}>刷新</Button>
        </div>
      </div>

      <Spin spinning={busy}>
        <div style={{ padding: "var(--space-3, 12px)" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: "var(--space-3, 12px)",
              marginBottom: "var(--space-3, 12px)",
            }}
          >
            {kpis.map((k) => (
              <StatCard key={k.title} title={k.title} value={k.value} color={k.color} />
            ))}
          </div>

          <Tabs
            size="small"
            activeKey={tab}
            onChange={(k) => setTab(k as ResourceOpsTab)}
            items={[
              {
                key: "waitlist",
                label: <span><ListChecks size={13} /> 候补队列</span>,
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}>
                    <div style={{ display: "flex", gap: "var(--space-2, 8px)", flexWrap: "wrap", alignItems: "flex-end" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
                        <span style={RES_LABEL}>患者姓名</span>
                        <Input
                          size="small"
                          style={{ width: 140 }}
                          value={waitForm.patientName}
                          onChange={(e) => setWaitForm({ ...waitForm, patientName: e.target.value })}
                          placeholder="必填"
                          data-testid="wait-add-name"
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
                        <span style={RES_LABEL}>联系电话</span>
                        <Input
                          size="small"
                          style={{ width: 140 }}
                          value={waitForm.phone}
                          onChange={(e) => setWaitForm({ ...waitForm, phone: e.target.value })}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
                        <span style={RES_LABEL}>模态</span>
                        <Select
                          size="small"
                          style={{ width: 110 }}
                          value={waitForm.modality}
                          onChange={(v) => setWaitForm({ ...waitForm, modality: v })}
                          options={MODALITY_OPTIONS}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
                        <span style={RES_LABEL}>优先级</span>
                        <Select
                          size="small"
                          style={{ width: 110 }}
                          value={waitForm.priority}
                          onChange={(v) => setWaitForm({ ...waitForm, priority: v })}
                          options={WAIT_PRIORITY_OPTIONS}
                        />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
                        <span style={RES_LABEL}>期望日期</span>
                        <Input
                          size="small"
                          type="date"
                          style={{ width: 150 }}
                          value={waitForm.preferredDate}
                          onChange={(e) => setWaitForm({ ...waitForm, preferredDate: e.target.value })}
                        />
                      </div>
                      <Button size="small" type="primary" icon={<Plus size={13} />} onClick={() => void handleAddWaitlist()}>
                        加入候补
                      </Button>
                    </div>

                    <div
                      style={{
                        padding: "var(--space-3, 12px)",
                        border: `1px dashed ${RES_BORDER}`,
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--space-3, 12px)",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontSize: 12, fontWeight: 700, color: RES_BLUE }}>下一位候补</span>
                      {nextWait ? (
                        <>
                          <Tag color={toneToAntd(nextWait.priority)}>{String(nextWait.priority)}</Tag>
                          <b style={{ fontSize: 14 }}>{nextWait.patientName}</b>
                          <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                            {nextWait.modality} · {nextWait.preferredDate} {nextWait.preferredTime}
                          </span>
                          <span style={{ fontSize: 12, color: statusColor("urgent"), fontWeight: 700 }}>
                            {nextWait.phone || "未登记电话"}
                          </span>
                          <Button size="small" onClick={() => void handleAssignWait(nextWait.id)}>立即分配</Button>
                        </>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无待分配候补" />
                      )}
                    </div>

                    <DataTable<WaitlistEntryDto>
                      dataSource={waitlist}
                      rowKey="id"
                      columns={waitColumns}
                      exportFileName="appointment-waitlist"
                      emptyText="暂无候补记录"
                    />
                  </div>
                ),
              },
              {
                key: "reminder",
                label: <span><Bell size={13} /> 提醒计划</span>,
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}>
                    <Space wrap>
                      <Button size="small" type="primary" icon={<Plus size={13} />} onClick={() => setRemOpen(true)}>
                        新建提醒计划
                      </Button>
                      <Button size="small" icon={<Send size={13} />} onClick={() => void handleFireDue()}>
                        发送全部到期提醒
                      </Button>
                    </Space>
                    <DataTable<ReminderPlanDto>
                      dataSource={reminders}
                      rowKey="id"
                      columns={reminderColumns}
                      exportFileName="appointment-reminders"
                      emptyText="暂无提醒计划"
                    />
                  </div>
                ),
              },
              {
                key: "green",
                label: <span><Zap size={13} /> 绿色通道</span>,
                children: (
                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}>
                    <Space wrap>
                      <Button size="small" type="primary" icon={<Plus size={13} />} onClick={() => setGreenOpen(true)}>
                        新建绿色通道
                      </Button>
                    </Space>
                    <DataTable<GreenChannelReservationDto>
                      dataSource={greenList}
                      rowKey="id"
                      columns={greenColumns}
                      exportFileName="appointment-green-channel"
                      emptyText="暂无绿色通道预约"
                    />
                  </div>
                ),
              },
            ]}
          />
        </div>
      </Spin>

      {/* [W-D8] 诊室管理 Modal (列表 + 新建) */}
      <Modal
        title="诊室管理"
        open={roomOpen}
        onCancel={() => setRoomOpen(false)}
        footer={null}
        width={860}
        destroyOnClose
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "var(--space-3, 12px)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
              <span style={RES_LABEL}>诊室名称 *</span>
              <Input size="small" value={roomForm.name} onChange={(e) => setRoomForm({ ...roomForm, name: e.target.value })} placeholder="如 CT-1 检查室" data-testid="room-name" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
              <span style={RES_LABEL}>模态 *</span>
              <Select size="small" value={roomForm.modality} onChange={(v) => setRoomForm({ ...roomForm, modality: v })} options={MODALITY_OPTIONS} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
              <span style={RES_LABEL}>位置</span>
              <Input size="small" value={roomForm.location} onChange={(e) => setRoomForm({ ...roomForm, location: e.target.value })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
              <span style={RES_LABEL}>单时段上限</span>
              <Input size="small" type="number" value={roomForm.maxPerSlot} onChange={(e) => setRoomForm({ ...roomForm, maxPerSlot: e.target.value })} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
              <span style={RES_LABEL}>状态</span>
              <Select size="small" value={roomForm.status} onChange={(v) => setRoomForm({ ...roomForm, status: v })} options={ROOM_STATUS_OPTIONS} />
            </div>
            <div style={{ display: "flex", alignItems: "flex-end" }}>
              <Button size="small" type="primary" icon={<Plus size={13} />} onClick={() => void handleCreateRoom()}>
                新建诊室
              </Button>
            </div>
          </div>

          <DataTable<RoomDto>
            dataSource={rooms}
            rowKey={(r) => r.id ?? `${r.name}-${r.modality}`}
            columns={roomColumns}
            exportFileName="appointment-rooms"
            emptyText="暂无诊室资源"
          />
        </div>
      </Modal>

      {/* [W-D8] 新建提醒计划 Modal */}
      <Modal
        title="新建提醒计划"
        open={remOpen}
        onCancel={() => setRemOpen(false)}
        onOk={() => void handleCreateReminder()}
        okText="创建"
        width={480}
        destroyOnClose
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)", paddingTop: "var(--space-2, 8px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>患者姓名 *</span>
            <Input size="small" value={remForm.patientName} onChange={(e) => setRemForm({ ...remForm, patientName: e.target.value })} data-testid="reminder-patient" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>手机号</span>
            <Input size="small" value={remForm.phone} onChange={(e) => setRemForm({ ...remForm, phone: e.target.value })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>提醒渠道 *</span>
            <Select size="small" value={remForm.channel} onChange={(v) => setRemForm({ ...remForm, channel: v })} options={REMINDER_CHANNEL_OPTIONS} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>提醒时间 *</span>
            <Input size="small" type="datetime-local" value={remForm.scheduledAt} onChange={(e) => setRemForm({ ...remForm, scheduledAt: e.target.value })} data-testid="reminder-time" />
          </div>
        </div>
      </Modal>

      {/* [W-D8] 新建绿色通道 Modal */}
      <Modal
        title="新建绿色通道预约"
        open={greenOpen}
        onCancel={() => setGreenOpen(false)}
        onOk={() => void handleCreateGreen()}
        okText="创建"
        width={520}
        destroyOnClose
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3, 12px)", paddingTop: "var(--space-2, 8px)" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>患者姓名 *</span>
            <Input size="small" value={greenForm.patientName} onChange={(e) => setGreenForm({ ...greenForm, patientName: e.target.value })} data-testid="green-patient" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>患者 ID</span>
            <Input size="small" value={greenForm.patientId} onChange={(e) => setGreenForm({ ...greenForm, patientId: e.target.value })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>模态 *</span>
            <Select size="small" value={greenForm.modality} onChange={(v) => setGreenForm({ ...greenForm, modality: v })} options={MODALITY_OPTIONS} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>检查部位</span>
            <Input size="small" value={greenForm.bodyPart} onChange={(e) => setGreenForm({ ...greenForm, bodyPart: e.target.value })} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>设备 ID *</span>
            <Input size="small" value={greenForm.deviceId} onChange={(e) => setGreenForm({ ...greenForm, deviceId: e.target.value })} placeholder="如 DEV-CT-01" />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1, 4px)" }}>
            <span style={RES_LABEL}>预留开始时间</span>
            <Input size="small" type="datetime-local" value={greenForm.startAt} onChange={(e) => setGreenForm({ ...greenForm, startAt: e.target.value })} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

