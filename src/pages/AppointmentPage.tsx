import { Card } from 'antd'
import { PageHeader } from "../components/common/PageHeader";
// G005 放射科RIS系统 - 检查预约管理 v2.1.0
// 完整模拟放射科检查预约流程：日历/列表视图 + 新建预约表单 + 规则设置 + 预约提醒管理
import { useState, useMemo, useEffect } from "react";
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
} from "lucide-react";
import {
  initialModalityDevices,
} from "../data/initialData";
import { appointmentApi, type AppointmentDto } from "../services/api";
import { invalidateApiCacheByPrefix } from "../services/api/client";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import {
  replayOrderEvent,
  validateOrderStatus,
} from "../utils/orderStateAdapter";
import AppointmentCalendar from "./AppointmentCalendar";
import AppointmentForm from "./AppointmentForm";
import { formatDateObj } from '../utils/date';

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
    label: "待确认",
    bg: "#f59e0b22",
    color: "#ca8a04",
    border: "#fef08a",
  },
  confirmed: {
    label: "已确认",
    bg: "#22c55e22",
    color: "#059669",
    border: "#6ee7b7",
  },
  "checked-in": {
    label: "已到检",
    bg: "#3b82f622", color: "#3b82f6",
    border: "#93c5fd",
  },
  checkedIn: {
    label: "已到检",
    bg: "#3b82f622", color: "#3b82f6",
    border: "#93c5fd",
  },
  cancelled: {
    label: "已取消",
    bg: "var(--bg-deep)", color: "var(--text-secondary)",
    border: "var(--border-color)",
  },
  "no-show": {
    label: "违约",
    bg: "#ef444422", color: "#ef4444",
    border: "#fca5a5",
  },
  noShow: { label: "违约", bg: "#ef444422", color: "#ef4444", border: "#fca5a5" },
  completed: {
    label: "已完成",
    bg: "#8b5cf622",
    color: "#7c3aed",
    border: "#c4b5fd",
  },
  "in-progress": {
    label: "进行中",
    bg: "#f59e0b22", color: "#f59e0b",
    border: "#fcd34d",
  },
  rescheduled: {
    label: "已改期",
    bg: "#ec489922",
    color: "#be185d",
    border: "#f9a8d4",
  },
  default: {
    label: "未知",
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
  critical: { label: "危重", bg: "#ef444422", color: "#ef4444" },
  urgent: { label: "紧急", bg: "#f59e0b22", color: "#f59e0b" },
  normal: { label: "普通", bg: "var(--bg-deep)", color: "var(--text-secondary)" },
  default: { label: "普通", bg: "var(--bg-deep)", color: "var(--text-secondary)" },
};
const getPriorityConfig = (priority: string) =>
  PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.default!;

const CANCEL_REASONS = [
  { value: "patient", label: "患者主动取消" },
  { value: "device", label: "设备故障" },
  { value: "doctor", label: "医生取消" },
  { value: "reschedule", label: "改期" },
  { value: "other", label: "其他" },
];

const REMINDER_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  已发送: { label: "已发送", bg: "#3b82f622", color: "#1d4ed8" },
  已确认: { label: "已确认", bg: "#22c55e22", color: "#059669" },
  已改期: { label: "已改期", bg: "#f59e0b22", color: "#f59e0b" },
  已取消: { label: "已取消", bg: "var(--bg-deep)", color: "var(--text-secondary)" },
  default: { label: "未知", bg: "var(--bg-deep)", color: "var(--text-secondary)" },
};
const getReminderStatusConfig = (status: string) =>
  REMINDER_STATUS_CONFIG[status] || REMINDER_STATUS_CONFIG.default!;

const RESCHEDULE_REASON_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  patient: { label: "患者主动", bg: "#3b82f622", color: "#1d4ed8" },
  doctor: { label: "医生调整", bg: "#f59e0b22", color: "#f59e0b" },
  device: { label: "设备故障", bg: "#ef444422", color: "#ef4444" },
  default: { label: "其他", bg: "var(--bg-deep)", color: "var(--text-secondary)" },
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
  const [viewMode, setViewMode] = useState<"calendar" | "list" | "reminders">(
    "calendar",
  );
  const [selectedDevice, setSelectedDevice] = useState<string>("all");
  const [listFilterDate] = useState<string>("");
  const [listFilterStatus] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

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
          setLoadError(aptRes.error?.message || "加载预约数据失败");
        }
        if (rulesRes.success && Array.isArray(rulesRes.data)) {
          setRules(rulesRes.data as unknown as AppointmentRules[]);
        }
      } catch {
        if (!cancelled) setLoadError("加载预约数据失败");
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
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
          `辅助数据加载失败: ${failures
            .map((f) => f.error?.message || "未知错误")
            .join("；")}`,
        );
      }
    })().catch((e: unknown) => {
      if (!cancelled)
        setTabError(
          `辅助数据加载失败: ${(e as Error)?.message || String(e)}`,
        );
    });
    return () => { cancelled = true; };
  }, []);

  // 右侧面板
  const [showForm, setShowForm] = useState(false);
  const [showRules, setShowRules] = useState(false);
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

  // 冲突检测
  const [conflictModal, setConflictModal] = useState<{
    show: boolean;
    result: ConflictResult | null;
  }>({ show: false, result: null });
  const [preventSubmitOnConflict, setPreventSubmitOnConflict] = useState(false);

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
  });

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
    });
  };

  const submitAppointment = async (force: boolean) => {
    const errs: Record<string, string> = {};
    if (!formData.patientName.trim()) errs.patientName = "请输入患者姓名";
    if (
      formData.idCard &&
      formData.idCard.length > 0 &&
      formData.idCard.length !== 18
    ) {
      errs.idCard = "身份证号需 18 位";
    }
    if (formData.phone && !/^1[3-9]\d{9}$/.test(formData.phone)) {
      errs.phone = "手机号格式不正确 (11位, 1[3-9] 开头)";
    }
    if (!formData.examItemId) errs.examItemId = "请选择检查项目";
    if (!formData.deviceId) errs.deviceId = "请选择检查设备";
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      setValidationError("请检查必填字段 (红色边框)");
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
      setValidationError("预约时间无效");
      return;
    }
    const res = await appointmentApi.create(payload);
    if (!res.success) {
      setValidationError(res.error?.message || "创建预约失败，请重试");
      return;
    }
    // 以服务端返回为准: 联动 Exam 已创建, 失效工作列表缓存
    setAppointments((prev) => [...prev, toLocalAppointment(res.data)]);
    await invalidateApiCacheByPrefix("/worklist");
    setShowForm(false);
    setFormErrors({});
    resetAppointmentForm();
  };

  const handleCreateAppointment = () => void submitAppointment(false);

  // 取消预约
  const handleCancelAppointment = async () => {
    if (!selectedAppointment || !cancelReason) {
      setCancelReasonError("请选择取消原因");
      return;
    }
    // orderMachine: approved/scheduled/confirmed → cancelled via CANCEL (with reason)
    const newState = replayOrderEvent(selectedAppointment.status, {
      type: "CANCEL",
      reason: cancelReason,
      by: "system",
    });
    if (!validateOrderStatus(newState)) {
      setCancelReasonError("当前状态不允许取消");
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

  // 颜色定义
  const primaryBlue = "#1e40af";
const lightBlue = "var(--color-info-bg)";
const borderGray = "var(--border-color)";
  const textGray = "#64748b";
  const whiteBg = "var(--bg-card)";

  // ====== 渲染 ======
  return (
    <div
      data-testid="appointment-page"
      style={{
        padding: 0,
        minHeight: "100vh",
        background: "var(--bg-card)",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {loading && <LoadingBanner message="正在从 API 加载预约数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {tabError && <ErrorBanner message={tabError} />}

      {/* [W2-4] 一键预约横幅: 从患者详情跳转时展示 */}
      {patientPreset && (
        <div style={{ background: 'var(--color-info-bg)', borderBottom: '1px solid #bfdbfe', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#1e40af' }}>
          <CalendarPlus size={16} />
          <span>已从患者详情进入: <b>{patientPreset.patientName || patientPreset.patientId}</b>（{patientPreset.patientId}），预约表单已自动填充，直接选择检查项目即可提交。</span>
          <button onClick={() => setPatientPreset(null)} style={{ marginLeft: 'auto', border: 'none', background: 'transparent', color: '#1e40af', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            关闭
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
            icon={<CalendarClock size={22} style={{ color: "#d97706" }} />}
            title="检查预约管理"
            subtitle="预约排程 · 设备分配 · 时间段管理 · 冲突检测 · 预约提醒"
            style={{ marginBottom: 0 }}
          />
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
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
              <Upload size={13} /> 批量导入
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
              <Settings size={13} /> 预约规则
            </button>
            <button
              onClick={() => {
                setShowForm(!showForm);
                setShowRules(false);
              }}
              style={{
                padding: "7px 16px",
                background: "#d97706",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 4px rgba(217,119,6,0.3)",
              }}
            >
              <Plus size={14} /> {showForm ? "取消新建" : "新建预约"}
            </button>
          </div>
        </div>
      </div>

      {/* ====== 主体内容 ====== */}
      <div style={{ maxWidth: 1600, margin: "0 auto", padding: "16px 24px" }}>
        {/* 统计卡片 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(6, 1fr)",
            gap: 12,
            marginBottom: 16,
          }}
        >
          {[
            {
              label: "今日预约",
              value: todayStats.total,
              icon: CalendarClock,
              color: "#1e40af",
              bg: lightBlue,
            },
            {
              label: "待确认",
              value: todayStats.pending,
              icon: Clock,
              color: "#ca8a04",
              bg: "#f59e0b22",
            },
            {
              label: "已确认",
              value: todayStats.confirmed,
              icon: CheckCircle,
              color: "#059669",
              bg: "#22c55e22",
            },
            {
              label: "违约",
              value: todayStats.noShow,
              icon: XCircle,
              color: "#ef4444", bg: "#ef444422",
            },
            {
              label: "平均等待",
              value: todayStats.avgWaitTime,
              icon: Clock,
              color: "#7c3aed",
              bg: "#8b5cf622",
            },
            {
              label: "使用率",
              value: `${todayStats.utilizationRate}%`,
              icon: BarChart3,
              color: "#0891b2",
              bg: "#06b6d422",
            },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                background: whiteBg,
                borderRadius: 10,
                padding: "14px 16px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                border: `1px solid ${borderGray}`,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 10,
                  background: stat.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <stat.icon size={20} style={{ color: stat.color }} />
              </div>
              <div>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 800,
                    color: stat.color,
                    lineHeight: 1,
                  }}
                >
                  {stat.value}
                </div>
                <div style={{ fontSize: 12, color: textGray, marginTop: 3 }}>
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
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
              statsData={[
                { label: "今日预约", value: appointments.filter(a => a.examDate === formatDateObj(new Date())).length, color: primaryBlue, bg: lightBlue },
                { label: "已到检", value: appointments.filter(a => a.examDate === formatDateObj(new Date()) && a.status === "checked-in").length, color: "#059669", bg: "#22c55e22" },
                { label: "待确认", value: appointments.filter(a => a.status === "pending").length, color: "#f59e0b", bg: "#f59e0b22" },
                { label: "违约", value: appointments.filter(a => a.status === "no-show").length, color: "#ef4444", bg: "#ef444422" },
                { label: "今日已约", value: appointments.filter(a => a.examDate === formatDateObj(new Date()) && a.status !== "cancelled").length, color: "#7c3aed", bg: "#8b5cf622" },
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
                  marginTop: 12,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    gap: 4,
                    padding: "10px 12px",
                    borderBottom: `1px solid ${borderGray}`,
                    background: "var(--bg-card)",
                    flexWrap: "wrap",
                  }}
                >
                  {(
                    [
                      ["reminders", "提醒记录"],
                      ["reschedules", "改期记录"],
                      ["cancellations", "取消记录"],
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
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-card)", borderBottom: `2px solid ${borderGray}` }}>
                          {["患者", "电话", "检查项目", "检查时间", "提醒时间", "渠道", "状态", "响应时间"].map((h) => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: textGray, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReminderRecords.map((r) => (
                          <tr key={r.id} style={{ borderBottom: `1px solid ${borderGray}` }}>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: primaryBlue }}>{r.patientName}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.phone}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.examType}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.examDate} {r.examTime}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.reminderTime}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.channel}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...getReminderStatusConfig(r.status) }}>{r.status}</span>
                            </td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.responseTime}</td>
                          </tr>
                        ))}
                        {filteredReminderRecords.length === 0 && (
                          <tr>
                            <td colSpan={8} style={{ padding: 24, textAlign: "center", color: textGray }}>暂无提醒记录</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {reminderTab === "reschedules" && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-card)", borderBottom: `2px solid ${borderGray}` }}>
                          {["患者", "电话", "检查项目", "原时间", "新时间", "原因", "操作时间"].map((h) => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: textGray, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rescheduleRecords.map((r) => (
                          <tr key={r.id} style={{ borderBottom: `1px solid ${borderGray}` }}>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: primaryBlue }}>{r.patientName}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.phone}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.examType}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.originalDate} {r.originalTime}</td>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: primaryBlue }}>{r.newDate} {r.newTime}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, ...getRescheduleReasonConfig(r.reason) }}>{getRescheduleReasonConfig(r.reason).label}</span>
                            </td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.operateTime}</td>
                          </tr>
                        ))}
                        {rescheduleRecords.length === 0 && (
                          <tr>
                            <td colSpan={7} style={{ padding: 24, textAlign: "center", color: textGray }}>暂无改期记录</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {reminderTab === "cancellations" && (
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 820 }}>
                      <thead>
                        <tr style={{ background: "var(--bg-card)", borderBottom: `2px solid ${borderGray}` }}>
                          {["患者", "电话", "检查项目", "取消时间", "原因", "是否改约"].map((h) => (
                            <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: textGray, whiteSpace: "nowrap" }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cancellationRecords.map((r) => (
                          <tr key={r.id} style={{ borderBottom: `1px solid ${borderGray}` }}>
                            <td style={{ padding: "8px 10px", fontWeight: 700, color: primaryBlue }}>{r.patientName}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.phone}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.examType}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.cancelTime}</td>
                            <td style={{ padding: "8px 10px", color: textGray }}>{r.reason}</td>
                            <td style={{ padding: "8px 10px" }}>
                              <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 12, fontWeight: 700, background: r.rebooked === "是" ? "var(--color-success-bg)" : r.rebooked === "否" ? "var(--bg-primary)" : "var(--color-warning-bg)", color: r.rebooked === "是" ? "#059669" : r.rebooked === "否" ? "#64748b" : "#d97706" }}>{r.rebooked}</span>
                            </td>
                          </tr>
                        ))}
                        {cancellationRecords.length === 0 && (
                          <tr>
                            <td colSpan={6} style={{ padding: 24, textAlign: "center", color: textGray }}>暂无取消记录</td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>{/* ====== 右侧面板 (40%) ====== */}          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
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
                    <Settings size={15} /> 预约规则设置
                  </div>
                  <button
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
                    padding: 12,
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
                      style={{ display: "inline", marginRight: 4 }}
                    />
                    预约规则针对每台设备独立设置。修改后即时生效。
                  </div>
                  {/* 搜索 */}
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      placeholder="搜索设备…"
                      onChange={() => {}}
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 6,
                        fontSize: 12,
                        outline: "none",
                        color: primaryBlue,
                      }}
                    />
                  </div>
                  {rules.map((rule) => {
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
                            marginBottom: 8,
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
                            <span style={{ fontSize: 12, color: textGray }}>
                              {device?.modality || ""}
                            </span>
                          </div>
                          <label
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
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
                            <span
                              style={{
                                fontSize: 12,
                                color: rule.enabled ? "#059669" : "#94a3b8",
                              }}
                            >
                              {rule.enabled ? "启用" : "停用"}
                            </span>
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
                              每天最大预约量
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
                                fontSize: 12,
                                outline: "none",
                                color: primaryBlue,
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
                              每时段最大检查数
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
                                fontSize: 12,
                                outline: "none",
                                color: primaryBlue,
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
                              最早提前天数
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
                                fontSize: 12,
                                outline: "none",
                                color: primaryBlue,
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
                              最晚提前天数
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
                                fontSize: 12,
                                outline: "none",
                                color: primaryBlue,
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
                              违约扣款 (元/次)
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
                                fontSize: 12,
                                outline: "none",
                                color: primaryBlue,
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
                    onClick={() => setShowRules(false)}
                    style={{
                      padding: "8px",
                      background: primaryBlue,
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Save size={13} /> 保存规则
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
                    <Upload size={15} /> 批量导入预约
                  </div>
                  <button
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
                <div style={{ padding: 20, textAlign: "center" }}>
                  <div
                    style={{
                      border: `2px dashed ${borderGray}`,
                      borderRadius: 10,
                      padding: "30px 20px",
                      marginBottom: 16,
                      cursor: "pointer",
                      transition: "border-color 0.2s",
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLDivElement).style.borderColor =
                        "#3b82f6")
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
                        fontSize: 13,
                        fontWeight: 700,
                        color: primaryBlue,
                        marginBottom: 4,
                      }}
                    >
                      点击上传Excel文件
                    </div>
                    <div style={{ fontSize: 12, color: textGray }}>
                      支持 .xlsx, .xls
                      格式，每行包含：姓名/性别/年龄/检查项目/设备/日期/时段/电话
                    </div>
                    <button
                      style={{
                        marginTop: 12,
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
                        input.accept = ".xlsx,.xls";
                        input.onchange = async (e) => {
                          const file = (e.target as HTMLInputElement)
                            .files?.[0];
                          if (!file) return;
                          const btn =
                            document.activeElement as HTMLButtonElement;
                          const orig = btn.innerHTML;
                          btn.innerHTML = "⏳ 上传中...";
                          btn.disabled = true;
                          await new Promise((r) => setTimeout(r, 1500));
                          const uploads = (() => {
                            try {
                              return JSON.parse(
                                localStorage.getItem("g005_appointment_uploads") ||
                                  "[]",
                              )
                            } catch { return [] }
                          })();
                          uploads.push({
                            name: file.name,
                            timestamp: new Date().toISOString(),
                          });
                          localStorage.setItem(
                            "g005_appointment_uploads",
                            JSON.stringify(uploads),
                          );
                          btn.innerHTML = "✅ 已上传";
                          setTimeout(() => {
                            btn.innerHTML = orig;
                            btn.disabled = false;
                          }, 2000);
                        };
                        input.click();
                      }}
                    >
                      选择文件
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
                      导入说明
                    </div>
                    <div
                      style={{ fontSize: 12, color: textGray, lineHeight: 1.8 }}
                    >
                      1. 请先下载模板文件，按格式填写预约信息
                      <br />
                      2. 姓名、设备、日期、时段为必填项
                      <br />
                      3. 检查项目需与系统现有项目匹配
                      <br />
                      4. 导入前请确保设备在该时段有可用名额
                      <br />
                      5. 重复预约将自动跳过并记录在错误日志中
                    </div>
                  </div>
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      gap: 8,
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
                        gap: 4,
                      }}
                      onClick={async (evt) => {
                        const btn = (evt?.target ||
                          evt?.currentTarget) as HTMLButtonElement;
                        btn.disabled = true;
                        const orig = btn.innerHTML;
                        btn.innerHTML = "⏳ 生成中...";
                        await new Promise((r) => setTimeout(r, 1500));
                        const template =
                          "姓名,性别,年龄,检查项目,设备,日期,时段,电话\n张三,男,45,CT增强,CT-1,2026-05-10,上午,13800001234";
                        const blob = new Blob(["\ufeff" + template], {
                          type: "text/csv;charset=utf-8",
                        });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = "预约导入模板.csv";
                        a.click();
                        URL.revokeObjectURL(url);
                        btn.innerHTML = "✅ 已下载";
                        setTimeout(() => {
                          btn.innerHTML = orig;
                          btn.disabled = false;
                        }, 2000);
                      }}
                    >
                      <Download size={12} /> 下载模板
                    </button>
                    <button
                      onClick={() => setShowBatchImport(false)}
                      style={{
                        padding: "6px 14px",
                        background: "#d97706",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Check size={12} /> 开始导入
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
                    <User size={15} /> 等候名单 ({waitlist.length})
                  </div>
                  <button
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
                <div style={{ padding: 12, maxHeight: 400, overflowY: "auto" }}>
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
                          marginBottom: 4,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 13,
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
                                ? "#dc2626"
                                : w.priority === "urgent"
                                  ? "#d97706"
                                  : "#64748b",
                          }}
                        >
                          {w.priority === "critical"
                            ? "危重"
                            : w.priority === "urgent"
                              ? "紧急"
                              : "普通"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                        {w.examItemName} · {w.modality}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--text-secondary)",
                          marginBottom: 4,
                        }}
                      >
                        期望: {w.preferredDate} {w.preferredTime}
                      </div>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button
                          onClick={async () => {
                            setWaitlistNotifyLoading(w.id);
                            await new Promise((r) => setTimeout(r, 1000));
                            setWaitlistNotifyLoading(null);
                          }}
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
                                ? "#d97706"
                                : "#2563eb",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 3,
                          }}
                        >
                          {waitlistNotifyLoading === w.id ? (
                            "⏳"
                          ) : (
                            <Bell size={10} />
                          )}{" "}
                          通知
                        </button>
                        <button
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
                          自动分配
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
                    当有空闲时段时，系统将自动通知等候患者
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
                    <CalendarClock size={15} /> 今日概览
                  </div>
                </div>
                <div style={{ padding: 12 }}>
                  {/* 设备占用 */}
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: primaryBlue,
                      marginBottom: 8,
                    }}
                  >
                    各设备今日预约
                  </div>
                  {filteredDevices.map((device) => {
                    const stats = getDeviceDayStats(new Date(), device.id);
                    const rule = rules.find((r) => r.deviceId === device.id);
                    return (
                      <div key={device.id} style={{ marginBottom: 8 }}>
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
                            人次
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
                                  ? "#dc2626"
                                  : stats.occupancy > 60
                                    ? "#d97706"
                                    : "#3b82f6",
                              borderRadius: 3,
                              transition: "width 0.3s",
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {/* 快捷操作 */}
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: primaryBlue,
                        marginBottom: 8,
                      }}
                    >
                      快捷操作
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 6,
                      }}
                    >
                      {[
                        {
                          label: "新建预约",
                          icon: Plus,
                          action: () => setShowForm(true),
                          color: "#f59e0b", bg: "#f59e0b22",
                        },
                        {
                          label: "批量导入",
                          icon: Upload,
                          action: () => setShowBatchImport(true),
                          color: "#3b82f6", bg: "#3b82f622",
                        },
                        {
                          label: "预约规则",
                          icon: Settings,
                          action: () => {
                            setShowRules(true);
                            setShowForm(false);
                          },
                          color: "#1e40af",
                          bg: lightBlue,
                        },
                        {
                          label: "导出数据",
                          icon: Download,
                          action: async () => {
                            const btn =
                              document.activeElement as HTMLButtonElement;
                            btn.disabled = true;
                            const orig = btn.innerHTML;
                            btn.innerHTML = "⏳ 导出中...";
                            await new Promise((r) => setTimeout(r, 1500));
                            localStorage.setItem(
                              "g005_appointment_export",
                              JSON.stringify({
                                timestamp: new Date().toISOString(),
                              }),
                            );
                            btn.innerHTML = "✅ 导出成功";
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
                  fontSize: 15,
                  fontWeight: 800,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Eye size={15} /> 预约详情
              </div>
              <button
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
                    marginBottom: 8,
                  }}
                >
                  <div
                    style={{
                      fontSize: 15,
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
                    gap: 4,
                  }}
                >
                  <span>
                    {selectedAppointment.gender} / {selectedAppointment.age}岁
                  </span>
                  <span>ID: {selectedAppointment.patientId}</span>
                  <span>预约号: {selectedAppointment.id}</span>
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
                    gap: 4,
                  }}
                >
                  <Scan size={13} /> 检查信息
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
                    ["检查项目", selectedAppointment.examItemName],
                    ["设备类型", selectedAppointment.modality],
                    ["检查部位", selectedAppointment.bodyPart],
                    ["设备", selectedAppointment.deviceName?.split("（")[0]],
                    ["预约日期", selectedAppointment.examDate],
                    ["预约时间", selectedAppointment.examTime],
                    ["检查室", selectedAppointment.roomName],
                    [
                      "申请医生",
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
                      <div style={{ fontSize: 12, color: textGray }}>
                        {label}
                      </div>
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
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: primaryBlue,
                      marginBottom: 6,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <AlertCircle size={13} /> 临床诊断
                  </div>
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
                      gap: 4,
                    }}
                  >
                    <Bell size={13} /> 备注
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
                        color: "#dc2626",
                        marginBottom: 6,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <XCircle size={13} /> 取消原因
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
                    gap: 4,
                  }}
                >
                  <Clock size={13} /> 记录时间
                </div>
                <div style={{ fontSize: 12, color: textGray }}>
                  <div>创建: {selectedAppointment.createdAt}</div>
                  <div>更新: {selectedAppointment.updatedAt}</div>
                </div>
              </div>

              {/* 操作 */}
              {selectedAppointment.status !== "cancelled" &&
                selectedAppointment.status !== "no-show" && (
                  <div
                    style={{
                      display: "flex",
                      gap: 8,
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
                        color: "#dc2626",
                        border: "none",
                        borderRadius: 8,
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 4,
                      }}
                    >
                      <XCircle size={13} /> 取消预约
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
                        gap: 4,
                      }}
                    >
                      <Edit2 size={13} /> 修改预约
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
                background: "#dc2626",
                color: "#fff",
                borderRadius: "12px 12px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              <XCircle size={16} /> 取消预约
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 4 }}>
                  预约信息
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
                      fontSize: 13,
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
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: primaryBlue,
                    marginBottom: 8,
                  }}
                >
                  取消原因 *
                </div>
                {cancelReasonError && (
                  <div
                    style={{ color: "#dc2626", fontSize: 12, marginBottom: 8 }}
                  >
                    {cancelReasonError}
                  </div>
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
                        gap: 8,
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
              <div style={{ display: "flex", gap: 8 }}>
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
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  返回
                </button>
                <button
                  onClick={handleCancelAppointment}
                  disabled={!cancelReason}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: cancelReason ? "#dc2626" : "var(--bg-primary)",
                    color: cancelReason ? "#fff" : "#94a3b8",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: cancelReason ? "pointer" : "not-allowed",
                  }}
                >
                  确认取消
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
                background: "#dc2626",
                color: "#fff",
                borderRadius: "12px 12px 0 0",
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 15,
                fontWeight: 800,
              }}
            >
              <AlertTriangle size={16} /> 时间冲突检测
            </div>
            <div style={{ padding: 18 }}>
              <div style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: textGray, marginBottom: 8 }}>
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
                      <div style={{ fontSize: 12, color: "#7f1d1d" }}>
                        {c.examItemName} · {c.examDate} {c.examTime}
                      </div>
                      <div style={{ fontSize: 12, color: "#7f1d1d" }}>
                        设备: {c.deviceName?.split("（")[0]} | 状态:{" "}
                        {STATUS_CONFIG[c.status]?.label}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--color-warning-bg)",
                  borderRadius: 6,
                  border: "1px solid var(--color-warning-border)",
                  fontSize: 12,
                  color: "#92400e",
                  marginBottom: 14,
                }}
              >
                检测到该时段存在冲突预约。建议选择其他时段或设备。
              </div>
              <div style={{ display: "flex", gap: 8 }}>
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
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  返回修改
                </button>
                <button
                  onClick={() => {
                    setConflictModal({ show: false, result: null });
                    setPreventSubmitOnConflict(false);
                    void submitAppointment(true);
                  }}
                  style={{
                    flex: 1,
                    padding: "8px",
                    background: "#d97706",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  强制预约（忽略冲突）
                </button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
