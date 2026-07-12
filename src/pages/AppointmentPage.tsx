// G005 放射科RIS系统 - 检查预约管理 v2.1.0
// 完整模拟放射科检查预约流程：日历/列表视图 + 新建预约表单 + 规则设置 + 预约提醒管理
import { useState, useMemo, useEffect } from "react";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  List,
  Filter,
  Plus,
  Search,
  X,
  CheckCircle,
  Clock,
  AlertCircle,
  XCircle,
  User,
  Stethoscope,
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
  ArrowRightLeft,
  MessageSquare,
  BellRing,
  CalendarCheck,
  TrendingUp,
  BarChart3,
} from "lucide-react";
import {
  initialModalityDevices,
  initialExamItems,
  initialUsers,
} from "../data/initialData";
import { appointmentApi, type AppointmentDto } from "../services/api";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import {
  replayOrderEvent,
  validateOrderStatus,
} from "../utils/orderStateAdapter";
import AppointmentCalendar from "./AppointmentCalendar";
import AppointmentForm from "./AppointmentForm";

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

interface TimeSlot {
  time: string;
  available: boolean;
  booked: number;
  max: number;
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

// 提醒配置类型
interface ReminderConfig {
  before24hEnabled: boolean;
  before24hTime: string;
  before2hEnabled: boolean;
  before2hTime: string;
  before30minEnabled: boolean;
  before30minTime: string;
  recheck1dayEnabled: boolean;
  smsEnabled: boolean;
  wechatEnabled: boolean;
  appEnabled: boolean;
  template24h: string;
  template2h: string;
  template30min: string;
  templatRecheck: string;
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

const formatDate = (d: Date): string => {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDateCht = (d: Date): string => {
  const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
  return `${d.getMonth() + 1}月${d.getDate()}日${weekdays[d.getDay()]}`;
};

const getNameInitials = (name: string): string => {
  if (!name) return "";
  const parts = name.split(/[\s·]/);
  if (parts.length >= 2) return parts[0][0] + parts[1][0];
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
    bg: "#fef9c3",
    color: "#ca8a04",
    border: "#fef08a",
  },
  confirmed: {
    label: "已确认",
    bg: "#d1fae5",
    color: "#059669",
    border: "#6ee7b7",
  },
  "checked-in": {
    label: "已到检",
    bg: "#dbeafe",
    color: "#2563eb",
    border: "#93c5fd",
  },
  checkedIn: {
    label: "已到检",
    bg: "#dbeafe",
    color: "#2563eb",
    border: "#93c5fd",
  },
  cancelled: {
    label: "已取消",
    bg: "#f1f5f9",
    color: "#64748b",
    border: "#cbd5e1",
  },
  "no-show": {
    label: "违约",
    bg: "#fee2e2",
    color: "#dc2626",
    border: "#fca5a5",
  },
  noShow: { label: "违约", bg: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  completed: {
    label: "已完成",
    bg: "#ede9fe",
    color: "#7c3aed",
    border: "#c4b5fd",
  },
  "in-progress": {
    label: "进行中",
    bg: "#fef3c7",
    color: "#d97706",
    border: "#fcd34d",
  },
  rescheduled: {
    label: "已改期",
    bg: "#fce7f3",
    color: "#be185d",
    border: "#f9a8d4",
  },
  default: {
    label: "未知",
    bg: "#f1f5f9",
    color: "#64748b",
    border: "#cbd5e1",
  },
};
const getStatusConfig = (status: string) =>
  STATUS_CONFIG[status] || STATUS_CONFIG.default;

const PRIORITY_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  critical: { label: "危重", bg: "#fee2e2", color: "#dc2626" },
  urgent: { label: "紧急", bg: "#fef3c7", color: "#d97706" },
  normal: { label: "普通", bg: "#f1f5f9", color: "#64748b" },
  default: { label: "普通", bg: "#f1f5f9", color: "#64748b" },
};
const getPriorityConfig = (priority: string) =>
  PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.default;

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
  已发送: { label: "已发送", bg: "#dbeafe", color: "#1d4ed8" },
  已确认: { label: "已确认", bg: "#d1fae5", color: "#059669" },
  已改期: { label: "已改期", bg: "#fef3c7", color: "#d97706" },
  已取消: { label: "已取消", bg: "#f1f5f9", color: "#64748b" },
  default: { label: "未知", bg: "#f1f5f9", color: "#64748b" },
};
const getReminderStatusConfig = (status: string) =>
  REMINDER_STATUS_CONFIG[status] || REMINDER_STATUS_CONFIG.default;

const RESCHEDULE_REASON_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  patient: { label: "患者主动", bg: "#dbeafe", color: "#1d4ed8" },
  doctor: { label: "医生调整", bg: "#fef3c7", color: "#d97706" },
  device: { label: "设备故障", bg: "#fee2e2", color: "#dc2626" },
  default: { label: "其他", bg: "#f1f5f9", color: "#64748b" },
};
const getRescheduleReasonConfig = (reason: string) =>
  RESCHEDULE_REASON_CONFIG[reason] || RESCHEDULE_REASON_CONFIG.default;

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

const generateMockWaitlist = (): WaitlistPatient[] => [
  {
    id: "WL-001",
    patientName: "钱伟明",
    phone: "13800138090",
    examItemName: "头颅CT平扫",
    modality: "CT",
    preferredDate: "2026-05-01",
    preferredTime: "08:00",
    priority: "urgent",
    addedAt: "2026-04-30 09:00",
    notified: false,
  },
  {
    id: "WL-002",
    patientName: "陈丽娟",
    phone: "13800138091",
    examItemName: "腰椎MR平扫",
    modality: "MR",
    preferredDate: "2026-05-01",
    preferredTime: "10:00",
    priority: "normal",
    addedAt: "2026-04-30 10:00",
    notified: false,
  },
  {
    id: "WL-003",
    patientName: "林志鹏",
    phone: "13800138092",
    examItemName: "胸部DR正侧位",
    modality: "DR",
    preferredDate: "2026-05-02",
    preferredTime: "09:00",
    priority: "normal",
    addedAt: "2026-04-30 11:00",
    notified: false,
  },
  {
    id: "WL-004",
    patientName: "黄晓东",
    phone: "13800138093",
    examItemName: "冠脉CTA",
    modality: "CT",
    preferredDate: "2026-05-02",
    preferredTime: "14:00",
    priority: "critical",
    addedAt: "2026-04-30 12:00",
    notified: false,
  },
  {
    id: "WL-005",
    patientName: "徐秀兰",
    phone: "13800138094",
    examItemName: "乳腺钼靶",
    modality: "乳腺钼靶",
    preferredDate: "2026-05-03",
    preferredTime: "10:00",
    priority: "normal",
    addedAt: "2026-04-30 14:00",
    notified: false,
  },
];

// ==================== 模拟预约数据 ====================
const generateMockAppointments = (): Appointment[] => {
  const today = new Date();
  const base = formatDate(today);
  return [
    {
      id: "APT-001",
      patientId: "RAD-P001",
      patientName: "张志刚",
      patientInitials: "张志",
      gender: "男",
      age: 62,
      idCard: "3101011964021XXXXX",
      phone: "13800138001",
      examItemId: "EI-CT-006",
      examItemName: "冠脉CTA",
      modality: "CT",
      bodyPart: "心脏",
      examDate: base,
      examTime: "09:00",
      deviceId: "DEV-CT-01",
      deviceName: "CT-1（GE Revolution CT）",
      roomId: "ROOM-CT1",
      roomName: "CT室1",
      referringDoctorId: "R001",
      referringDoctorName: "李明辉",
      clinicalDiagnosis: "冠心病待查",
      notes: "需控制心率",
      status: "confirmed",
      priority: "urgent",
      createdAt: "2026-04-28 10:00",
      updatedAt: "2026-04-28 10:00",
    },
    {
      id: "APT-002",
      patientId: "RAD-P002",
      patientName: "李秀英",
      patientInitials: "李秀",
      gender: "女",
      age: 55,
      idCard: "3101021970021XXXXX",
      phone: "13800138002",
      examItemId: "EI-MR-001",
      examItemName: "头颅MR平扫",
      modality: "MR",
      bodyPart: "头颅",
      examDate: base,
      examTime: "10:00",
      deviceId: "DEV-MR-01",
      deviceName: "MR-1（西门子MAGNETOM Vida）",
      roomId: "ROOM-MR1",
      roomName: "MR室1",
      referringDoctorId: "R002",
      referringDoctorName: "王秀峰",
      clinicalDiagnosis: "头痛待查",
      notes: "",
      status: "pending",
      priority: "normal",
      createdAt: "2026-04-29 08:00",
      updatedAt: "2026-04-29 08:00",
    },
    {
      id: "APT-003",
      patientId: "RAD-P003",
      patientName: "王建国",
      patientInitials: "王建",
      gender: "男",
      age: 58,
      idCard: "3101031968011XXXXX",
      phone: "13800138003",
      examItemId: "EI-DR-001",
      examItemName: "胸部DR正侧位",
      modality: "DR",
      bodyPart: "胸部",
      examDate: base,
      examTime: "09:30",
      deviceId: "DEV-DR-01",
      deviceName: "DR-1（飞利浦DigitalDiagnost）",
      roomId: "ROOM-DR1",
      roomName: "DR室1",
      referringDoctorId: "R003",
      referringDoctorName: "张海涛",
      clinicalDiagnosis: "健康体检",
      notes: "",
      status: "checked-in",
      priority: "normal",
      createdAt: "2026-04-27 14:00",
      updatedAt: "2026-04-30 07:30",
    },
    {
      id: "APT-004",
      patientId: "RAD-P004",
      patientName: "赵晓敏",
      patientInitials: "赵晓",
      gender: "女",
      age: 45,
      idCard: "3101041978011XXXXX",
      phone: "13800138004",
      examItemId: "EI-CT-001",
      examItemName: "头颅CT平扫",
      modality: "CT",
      bodyPart: "头颅",
      examDate: base,
      examTime: "11:00",
      deviceId: "DEV-CT-01",
      deviceName: "CT-1（GE Revolution CT）",
      roomId: "ROOM-CT1",
      roomName: "CT室1",
      referringDoctorId: "R004",
      referringDoctorName: "刘芳",
      clinicalDiagnosis: "外伤后头晕",
      notes: "急诊绿色通道",
      status: "confirmed",
      priority: "critical",
      createdAt: "2026-05-01 06:00",
      updatedAt: "2026-05-01 06:00",
    },
    {
      id: "APT-005",
      patientId: "RAD-P005",
      patientName: "周玉芬",
      patientInitials: "周玉",
      gender: "女",
      age: 52,
      idCard: "3101051973021XXXXX",
      phone: "13800138005",
      examItemId: "EI-CT-003",
      examItemName: "腹部CT平扫+增强",
      modality: "CT",
      bodyPart: "腹部",
      examDate: base,
      examTime: "14:00",
      deviceId: "DEV-CT-02",
      deviceName: "CT-2（西门子SOMATOM Force）",
      roomId: "ROOM-CT2",
      roomName: "CT室2",
      referringDoctorId: "R001",
      referringDoctorName: "李明辉",
      clinicalDiagnosis: "肝占位待查",
      notes: "空腹4h，增强需留置针",
      status: "pending",
      priority: "urgent",
      createdAt: "2026-04-30 09:00",
      updatedAt: "2026-04-30 09:00",
    },
    {
      id: "APT-006",
      patientId: "RAD-P006",
      patientName: "孙伟",
      patientInitials: "孙伟",
      gender: "男",
      age: 35,
      idCard: "3101061990011XXXXX",
      phone: "13800138006",
      examItemId: "EI-MR-003",
      examItemName: "腰椎MR平扫",
      modality: "MR",
      bodyPart: "脊柱",
      examDate: base,
      examTime: "15:00",
      deviceId: "DEV-MR-01",
      deviceName: "MR-1（西门子MAGNETOM Vida）",
      roomId: "ROOM-MR1",
      roomName: "MR室1",
      referringDoctorId: "R003",
      referringDoctorName: "张海涛",
      clinicalDiagnosis: "腰痛待查",
      notes: "",
      status: "confirmed",
      priority: "normal",
      createdAt: "2026-04-30 11:00",
      updatedAt: "2026-04-30 11:00",
    },
    {
      id: "APT-007",
      patientId: "RAD-P007",
      patientName: "吴婷",
      patientInitials: "吴婷",
      gender: "女",
      age: 42,
      idCard: "3101071978021XXXXX",
      phone: "13800138007",
      examItemId: "EI-MG-001",
      examItemName: "乳腺钼靶",
      modality: "乳腺钼靶",
      bodyPart: "胸部",
      examDate: base,
      examTime: "10:00",
      deviceId: "DEV-MG-01",
      deviceName: "乳腺钼靶（GE Senographe）",
      roomId: "ROOM-MG1",
      roomName: "钼靶室1",
      referringDoctorId: "R004",
      referringDoctorName: "刘芳",
      clinicalDiagnosis: "乳腺结节随访",
      notes: "月经结束后7-10天最佳",
      status: "confirmed",
      priority: "normal",
      createdAt: "2026-04-29 15:00",
      updatedAt: "2026-04-29 15:00",
    },
    {
      id: "APT-008",
      patientId: "RAD-P008",
      patientName: "郑丽",
      patientInitials: "郑丽",
      gender: "女",
      age: 38,
      idCard: "3101081982021XXXXX",
      phone: "13800138008",
      examItemId: "EI-DR-002",
      examItemName: "腹部立卧位平片",
      modality: "DR",
      bodyPart: "腹部",
      examDate: base,
      examTime: "08:00",
      deviceId: "DEV-DR-02",
      deviceName: "DR-2（GE Optima）",
      roomId: "ROOM-DR2",
      roomName: "DR室2",
      referringDoctorId: "R002",
      referringDoctorName: "王秀峰",
      clinicalDiagnosis: "肠梗阻待查",
      notes: "急查",
      status: "no-show",
      priority: "urgent",
      createdAt: "2026-05-01 07:00",
      updatedAt: "2026-05-01 08:30",
    },
    {
      id: "APT-009",
      patientId: "RAD-P001",
      patientName: "张志刚",
      patientInitials: "张志",
      gender: "男",
      age: 62,
      idCard: "3101011964021XXXXX",
      phone: "13800138001",
      examItemId: "EI-DSA-001",
      examItemName: "冠脉造影",
      modality: "DSA",
      bodyPart: "心脏",
      examDate: formatDate(new Date(today.getTime() + 86400000)),
      examTime: "08:30",
      deviceId: "DEV-DSA-01",
      deviceName: "DSA-1（飞利浦Azurion 7）",
      roomId: "ROOM-DSA1",
      roomName: "DSA室1",
      referringDoctorId: "R001",
      referringDoctorName: "李明辉",
      clinicalDiagnosis: "冠心病三支病变",
      notes: "支架治疗前评估",
      status: "confirmed",
      priority: "urgent",
      createdAt: "2026-04-28 10:00",
      updatedAt: "2026-04-28 10:00",
    },
    {
      id: "APT-010",
      patientId: "RAD-P002",
      patientName: "李秀英",
      patientInitials: "李秀",
      gender: "女",
      age: 55,
      idCard: "3101021970021XXXXX",
      phone: "13800138002",
      examItemId: "EI-CT-002",
      examItemName: "胸部CT平扫",
      modality: "CT",
      bodyPart: "胸部",
      examDate: formatDate(new Date(today.getTime() + 86400000)),
      examTime: "09:30",
      deviceId: "DEV-CT-01",
      deviceName: "CT-1（GE Revolution CT）",
      roomId: "ROOM-CT1",
      roomName: "CT室1",
      referringDoctorId: "R002",
      referringDoctorName: "王秀峰",
      clinicalDiagnosis: "肺炎复查",
      notes: "",
      status: "pending",
      priority: "normal",
      createdAt: "2026-04-30 16:00",
      updatedAt: "2026-04-30 16:00",
    },
    {
      id: "APT-011",
      patientId: "RAD-P003",
      patientName: "王建国",
      patientInitials: "王建",
      gender: "男",
      age: 58,
      idCard: "3101031968011XXXXX",
      phone: "13800138003",
      examItemId: "EI-CT-005",
      examItemName: "脊柱CT",
      modality: "CT",
      bodyPart: "脊柱",
      examDate: formatDate(new Date(today.getTime() + 86400000)),
      examTime: "14:00",
      deviceId: "DEV-CT-02",
      deviceName: "CT-2（西门子SOMATOM Force）",
      roomId: "ROOM-CT2",
      roomName: "CT室2",
      referringDoctorId: "R003",
      referringDoctorName: "张海涛",
      clinicalDiagnosis: "腰椎间盘突出",
      notes: "",
      status: "confirmed",
      priority: "normal",
      createdAt: "2026-04-30 14:00",
      updatedAt: "2026-04-30 14:00",
    },
    {
      id: "APT-012",
      patientId: "RAD-P004",
      patientName: "赵晓敏",
      patientInitials: "赵晓",
      gender: "女",
      age: 45,
      idCard: "3101041978011XXXXX",
      phone: "13800138004",
      examItemId: "EI-MR-002",
      examItemName: "腹部MR平扫+增强",
      modality: "MR",
      bodyPart: "腹部",
      examDate: formatDate(new Date(today.getTime() + 86400000 * 2)),
      examTime: "10:00",
      deviceId: "DEV-MR-01",
      deviceName: "MR-1（西门子MAGNETOM Vida）",
      roomId: "ROOM-MR1",
      roomName: "MR室1",
      referringDoctorId: "R004",
      referringDoctorName: "刘芳",
      clinicalDiagnosis: "肝占位增强",
      notes: "空腹6h",
      status: "pending",
      priority: "urgent",
      createdAt: "2026-05-01 08:00",
      updatedAt: "2026-05-01 08:00",
    },
    {
      id: "APT-013",
      patientId: "RAD-P005",
      patientName: "周玉芬",
      patientInitials: "周玉",
      gender: "女",
      age: 52,
      idCard: "3101051973021XXXXX",
      phone: "13800138005",
      examItemId: "EI-RF-001",
      examItemName: "上消化道造影",
      modality: "胃肠造影",
      bodyPart: "腹部",
      examDate: formatDate(new Date(today.getTime() + 86400000)),
      examTime: "15:00",
      deviceId: "DEV-RF-01",
      deviceName: "胃肠造影（岛津Flexavision）",
      roomId: "ROOM-RF1",
      roomName: "造影室1",
      referringDoctorId: "R001",
      referringDoctorName: "李明辉",
      clinicalDiagnosis: "消化不良待查",
      notes: "",
      status: "cancelled",
      priority: "normal",
      cancelReason: "reschedule",
      createdAt: "2026-04-29 10:00",
      updatedAt: "2026-05-01 09:00",
    },
  ];
};

// ==================== 模拟设备规则 ====================
const generateDefaultRules = (): AppointmentRules[] => {
  return [
    {
      deviceId: "DEV-CT-01",
      deviceName: "CT-1（GE Revolution CT）",
      maxDailyAppointments: 60,
      maxPerTimeSlot: 4,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 50,
      enabled: true,
    },
    {
      deviceId: "DEV-CT-02",
      deviceName: "CT-2（西门子SOMATOM Force）",
      maxDailyAppointments: 50,
      maxPerTimeSlot: 4,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 50,
      enabled: true,
    },
    {
      deviceId: "DEV-MR-01",
      deviceName: "MR-1（西门子MAGNETOM Vida）",
      maxDailyAppointments: 35,
      maxPerTimeSlot: 2,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 80,
      enabled: true,
    },
    {
      deviceId: "DEV-MR-02",
      deviceName: "MR-2（飞利浦Ingenia）",
      maxDailyAppointments: 35,
      maxPerTimeSlot: 2,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 80,
      enabled: false,
    },
    {
      deviceId: "DEV-DR-01",
      deviceName: "DR-1（飞利浦DigitalDiagnost）",
      maxDailyAppointments: 120,
      maxPerTimeSlot: 8,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 20,
      enabled: true,
    },
    {
      deviceId: "DEV-DR-02",
      deviceName: "DR-2（GE Optima）",
      maxDailyAppointments: 100,
      maxPerTimeSlot: 8,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 20,
      enabled: true,
    },
    {
      deviceId: "DEV-DSA-01",
      deviceName: "DSA-1（飞利浦Azurion 7）",
      maxDailyAppointments: 10,
      maxPerTimeSlot: 1,
      minAdvanceDays: 1,
      maxAdvanceDays: 14,
      noShowPenalty: 200,
      enabled: true,
    },
    {
      deviceId: "DEV-MG-01",
      deviceName: "乳腺钼靶（GE Senographe）",
      maxDailyAppointments: 25,
      maxPerTimeSlot: 2,
      minAdvanceDays: 0,
      maxAdvanceDays: 30,
      noShowPenalty: 30,
      enabled: true,
    },
    {
      deviceId: "DEV-RF-01",
      deviceName: "胃肠造影（岛津Flexavision）",
      maxDailyAppointments: 20,
      maxPerTimeSlot: 2,
      minAdvanceDays: 0,
      maxAdvanceDays: 14,
      noShowPenalty: 30,
      enabled: true,
    },
  ];
};

// ==================== 虚构提醒记录数据（30条）====================
const generateMockReminderRecords = (): ReminderRecord[] => {
  const today = new Date();
  const base = formatDate(today);
  const names = [
    "张志刚",
    "李秀英",
    "王建国",
    "赵晓敏",
    "周玉芬",
    "孙伟",
    "吴婷",
    "郑丽",
    "钱伟明",
    "陈丽娟",
    "林志鹏",
    "黄晓东",
    "徐秀兰",
    "高峰",
    "曹建国",
    "丁娜",
    "唐志远",
    "彭海军",
    "冯玉英",
    "韩志明",
    "杨丽华",
    "朱志鹏",
    "秦晓峰",
    "许秀英",
    "何建国",
    "罗玉芬",
    "蒋志刚",
    "韦秀英",
    "宋志明",
    "杜丽娟",
  ];
  const phones = [
    "13800138001",
    "13800138002",
    "13800138003",
    "13800138004",
    "13800138005",
    "13800138006",
    "13800138007",
    "13800138008",
    "13800138009",
    "13800138010",
    "13800138011",
    "13800138012",
    "13800138013",
    "13800138014",
    "13800138015",
    "13800138016",
    "13800138017",
    "13800138018",
    "13800138019",
    "13800138020",
    "13800138021",
    "13800138022",
    "13800138023",
    "13800138024",
    "13800138025",
    "13800138026",
    "13800138027",
    "13800138028",
    "13800138029",
    "13800138030",
  ];
  const examTypes = [
    "冠脉CTA",
    "头颅CT平扫",
    "胸部CT平扫",
    "头颅MR平扫",
    "腰椎MR平扫",
    "乳腺钼靶",
    "腹部CT平扫+增强",
    "冠脉造影",
    "胸部DR正侧位",
    "上消化道造影",
  ];
  const channels: ReminderChannel[] = ["短信", "微信", "APP推送"];
  const statuses: ReminderStatus[] = ["已发送", "已确认", "已改期", "已取消"];
  const responseHours = [
    "0.5h",
    "1h",
    "2h",
    "3h",
    "5h",
    "8h",
    "12h",
    "24h",
    "未响应",
  ];

  return Array.from({ length: 30 }, (_, i) => {
    const examDate = formatDate(new Date(today.getTime() - (i % 7) * 86400000));
    const examTime = ["08:00", "09:00", "10:00", "14:00", "15:00"][i % 5];
    const reminderDate = formatDate(
      new Date(new Date(examDate).getTime() - 86400000),
    );
    const channel = channels[i % 3];
    const status = statuses[Math.floor(Math.random() * 10)] as ReminderStatus;
    const responseIdx =
      status === "已确认"
        ? Math.floor(Math.random() * 7)
        : status === "已发送"
          ? 8
          : status === "已改期"
            ? Math.floor(Math.random() * 6)
            : 8;

    return {
      id: `REM-${String(i + 1).padStart(3, "0")}`,
      patientName: names[i],
      phone: phones[i],
      examType: examTypes[i % examTypes.length],
      examDate,
      examTime,
      reminderTime: `${reminderDate} ${["08:00", "09:00", "10:00", "14:00"][i % 4]}`,
      channel,
      status,
      responseTime: responseHours[responseIdx],
    };
  });
};

// ==================== 虚构改期记录数据 ====================
const generateMockRescheduleRecords = (): RescheduleRecord[] => {
  const today = new Date();
  const base = formatDate(today);
  const names = [
    "张志刚",
    "李秀英",
    "王建国",
    "赵晓敏",
    "周玉芬",
    "孙伟",
    "吴婷",
    "郑丽",
    "钱伟明",
    "陈丽娟",
  ];
  const phones = [
    "13800138001",
    "13800138002",
    "13800138003",
    "13800138004",
    "13800138005",
    "13800138006",
    "13800138007",
    "13800138008",
    "13800138009",
    "13800138010",
  ];
  const examTypes = [
    "冠脉CTA",
    "头颅CT平扫",
    "胸部CT平扫",
    "头颅MR平扫",
    "腰椎MR平扫",
    "乳腺钼靶",
    "腹部CT平扫+增强",
    "冠脉造影",
    "胸部DR正侧位",
    "上消化道造影",
  ];
  const reasons: ("patient" | "doctor" | "device")[] = [
    "patient",
    "doctor",
    "device",
  ];

  return Array.from({ length: 15 }, (_, i) => {
    const originalDate = formatDate(
      new Date(today.getTime() - (i + 1) * 86400000),
    );
    const newDate = formatDate(new Date(today.getTime() - i * 86400000));
    return {
      id: `RS-${String(i + 1).padStart(3, "0")}`,
      patientName: names[i % names.length],
      phone: phones[i % phones.length],
      examType: examTypes[i % examTypes.length],
      originalDate,
      originalTime: ["08:00", "09:00", "10:00", "14:00", "15:00"][i % 5],
      newDate,
      newTime: ["08:30", "09:30", "10:30", "14:30", "15:30"][i % 5],
      reason: reasons[i % 3],
      operateTime: `${formatDate(new Date(today.getTime() - i * 43200000))} ${["10:00", "11:00", "14:00", "15:00", "16:00"][i % 5]}`,
    };
  });
};

// ==================== 虚构取消记录数据 ====================
const generateMockCancellationRecords = (): CancellationRecord[] => {
  const today = new Date();
  const names = [
    "张志刚",
    "李秀英",
    "王建国",
    "赵晓敏",
    "周玉芬",
    "孙伟",
    "吴婷",
    "郑丽",
    "钱伟明",
    "陈丽娟",
    "林志鹏",
    "黄晓东",
  ];
  const phones = [
    "13800138001",
    "13800138002",
    "13800138003",
    "13800138004",
    "13800138005",
    "13800138006",
    "13800138007",
    "13800138008",
    "13800138009",
    "13800138010",
    "13800138011",
    "13800138012",
  ];
  const examTypes = [
    "冠脉CTA",
    "头颅CT平扫",
    "胸部CT平扫",
    "头颅MR平扫",
    "腰椎MR平扫",
    "乳腺钼靶",
    "腹部CT平扫+增强",
    "冠脉造影",
    "胸部DR正侧位",
    "上消化道造影",
    "脊柱CT",
    "腹部立卧位平片",
  ];
  const cancelReasons = [
    "患者主动取消",
    "患者主动取消",
    "患者临时有事",
    "设备故障",
    "医生调整时间",
    "患者主动取消",
    "患者需复查后决定",
    "患者主动取消",
    "设备维护",
    "医生调整时间",
    "患者主动取消",
    "患者转院",
  ];

  return Array.from({ length: 12 }, (_, i) => {
    const cancelDate = formatDate(
      new Date(today.getTime() - (i + 1) * 86400000),
    );
    return {
      id: `CXL-${String(i + 1).padStart(3, "0")}`,
      patientName: names[i],
      phone: phones[i],
      examType: examTypes[i % examTypes.length],
      cancelTime: `${cancelDate} ${["09:00", "10:00", "11:00", "14:00", "15:00", "16:00"][i % 6]}`,
      reason: cancelReasons[i],
      rebooked: (i % 3 === 0 ? "是" : i % 3 === 1 ? "否" : "待确认") as
        | "是"
        | "否"
        | "待确认",
    };
  });
};

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
  const [listFilterDate, setListFilterDate] = useState<string>("");
  const [listFilterStatus, setListFilterStatus] = useState<string>("all");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>(
    generateMockAppointments(),
  );
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await appointmentApi.list();
      if (cancelled) return;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setAppointments(res.data as unknown as Appointment[]);
        setLoadError(null);
      } else {
        setAppointments(generateMockAppointments());
        setLoadError("API 不可用,使用本地 mock 数据");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [rules, setRules] = useState<AppointmentRules[]>(
    generateDefaultRules(),
  );

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

  const fieldError = (key: string) => formErrors[key];
  const borderColor = (key: string) =>
    formErrors[key] ? "#dc2626" : borderGray;

  // 日历子视图: day/week/month
  const [calendarSubView, setCalendarSubView] = useState<
    "day" | "week" | "month"
  >("week");
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());

  // 等候名单
  const [waitlist] = useState<WaitlistPatient[]>(generateMockWaitlist());
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
  const [reminderRecords] = useState<ReminderRecord[]>(
    generateMockReminderRecords(),
  );
  const [rescheduleRecords] = useState<RescheduleRecord[]>(
    generateMockRescheduleRecords(),
  );
  const [cancellationRecords] = useState<CancellationRecord[]>(
    generateMockCancellationRecords(),
  );
  const [reminderFilterStatus, setReminderFilterStatus] =
    useState<string>("all");
  const [reminderFilterChannel, setReminderFilterChannel] =
    useState<string>("all");
  const [rescheduleFilterReason, setRescheduleFilterReason] =
    useState<string>("all");
  const [cancelFilterRebooked, setCancelFilterRebooked] =
    useState<string>("all");

  // 提醒配置
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>({
    before24hEnabled: true,
    before24hTime: "20:00",
    before2hEnabled: true,
    before2hTime: "07:00",
    before30minEnabled: false,
    before30minTime: "07:30",
    recheck1dayEnabled: true,
    smsEnabled: true,
    wechatEnabled: true,
    appEnabled: false,
    template24h:
      "尊敬的{患者姓名}您好，您预约的{检查项目}将于明天{预约时间}进行，请准时到达。",
    template2h: "提醒：您的{检查项目}将于{预约时间}开始，请提前到检。",
    template30min: "紧急提醒：您的{检查项目}将于30分钟后开始，请立即到检。",
    templatRecheck: "您的复查项目{检查项目}已可预约，请点击链接选择时间。",
  });

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
    examDate: formatDate(new Date()),
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
    const today = formatDate(new Date());
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
    const today = formatDate(new Date());
    return appointments.filter(a => a.examDate === today);
  }, [appointments]);

  // 提醒统计
  const reminderStats = useMemo(() => {
    const total = reminderRecords.length;
    const confirmed = reminderRecords.filter(
      (r) => r.status === "已确认",
    ).length;
    const noShow = reminderRecords.filter((r) => r.status === "已取消").length;
    const rescheduled = reminderRecords.filter(
      (r) => r.status === "已改期",
    ).length;
    const confirmedRate = total > 0 ? Math.round((confirmed / total) * 100) : 0;
    const noShowRate = total > 0 ? Math.round((noShow / total) * 100) : 0;
    // 平均响应时间
    const respondedRecords = reminderRecords.filter(
      (r) => r.responseTime !== "未响应",
    );
    const responseSum = respondedRecords.reduce((acc, r) => {
      const hours = parseFloat(r.responseTime.replace("h", ""));
      return acc + hours;
    }, 0);
    const avgResponseTime =
      respondedRecords.length > 0
        ? (responseSum / respondedRecords.length).toFixed(1)
        : "0";
    return {
      total,
      confirmed,
      noShow,
      rescheduled,
      confirmedRate,
      noShowRate,
      avgResponseTime,
    };
  }, [reminderRecords]);

  // 渠道效果对比
  const channelStats = useMemo(() => {
    const channels: ReminderChannel[] = ["短信", "微信", "APP推送"];
    return channels.map((ch) => {
      const records = reminderRecords.filter((r) => r.channel === ch);
      const total = records.length;
      const confirmed = records.filter((r) => r.status === "已确认").length;
      return {
        channel: ch,
        total,
        confirmed,
        rate: total > 0 ? Math.round((confirmed / total) * 100) : 0,
      };
    });
  }, [reminderRecords]);

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

  // 导航函数
  const goToPrevWeek = () => {
    const prev = new Date(currentWeekStart);
    prev.setDate(prev.getDate() - 7);
    setCurrentWeekStart(prev);
  };
  const goToNextWeek = () => {
    const next = new Date(currentWeekStart);
    next.setDate(next.getDate() + 7);
    setCurrentWeekStart(next);
  };
  const goToToday = () => {
    const today = new Date();
    const day = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    setCurrentWeekStart(monday);
  };

  // 统计某日某设备的预约数
  const getDeviceDayStats = (date: Date, deviceId: string) => {
    const dateStr = formatDate(date);
    const key = `${dateStr}::${deviceId}`;
    const dayApts = appointmentsByDateDevice[key] || [];
    const total = dayApts.length;
    const rule = rules.find((r) => r.deviceId === deviceId);
    const capacity = rule?.maxDailyAppointments || 60;
    const occupancy = capacity > 0 ? Math.round((total / capacity) * 100) : 0;
    return { total, occupancy };
  };

  // 新建预约提交
  const handleCreateAppointment = async () => {
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
    const device = initialModalityDevices.find(
      (d) => d.id === formData.deviceId,
    );
    const newApt: Appointment = {
      id: `APT-${String(appointments.length + 1).padStart(3, "0")}`,
      patientId: `RAD-P${String(appointments.length + 1).padStart(3, "0")}`,
      patientName: formData.patientName,
      patientInitials: getNameInitials(formData.patientName),
      gender: formData.gender,
      age: parseInt(formData.age) || 0,
      idCard: formData.idCard,
      phone: formData.phone,
      examItemId: formData.examItemId,
      examItemName: formData.examItemName,
      modality: formData.examType,
      bodyPart: formData.bodyPart,
      examDate: formData.examDate,
      examTime: formData.examTime,
      deviceId: formData.deviceId,
      deviceName: formData.deviceName || device?.name || "",
      roomId: device?.id.replace("DEV", "ROOM").replace("-01", "-01") || "",
      roomName: device?.location || "",
      referringDoctorId: formData.referringDoctorId,
      referringDoctorName: formData.referringDoctorName,
      clinicalDiagnosis: formData.clinicalDiagnosis,
      notes: formData.notes,
      status: "pending",
      priority: formData.priority as "normal" | "urgent" | "critical",
      createdAt: new Date().toLocaleString("zh-CN"),
      updatedAt: new Date().toLocaleString("zh-CN"),
    };
    await appointmentApi.create(newApt);
    setAppointments((prev) => [...prev, newApt]);
    setShowForm(false);
    setFormErrors({});
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
      examDate: formatDate(new Date()),
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

  // 修改预约
  const handleModifyAppointment = (
    apt: Appointment,
    newDate: string,
    newTime: string,
    newDeviceId: string,
  ) => {
    const device = initialModalityDevices.find((d) => d.id === newDeviceId);
    setAppointments((prev) =>
      prev.map((a) =>
        a.id === apt.id
          ? {
              ...a,
              examDate: newDate,
              examTime: newTime,
              deviceId: newDeviceId,
              deviceName: device?.name || a.deviceName,
              roomId: device?.id.replace("DEV", "ROOM") || a.roomId,
              roomName: device?.location || a.roomName,
              updatedAt: new Date().toLocaleString("zh-CN"),
            }
          : a,
      ),
    );
    setShowDetailModal(false);
    setSelectedAppointment(null);
  };

  // 打开详情
  const openDetail = (apt: Appointment) => {
    setSelectedAppointment(apt);
    setShowDetailModal(true);
  };

  // 设备切换时更新设备名
  const handleDeviceChange = (deviceId: string) => {
    const device = initialModalityDevices.find((d) => d.id === deviceId);
    setFormData((prev) => ({
      ...prev,
      deviceId,
      deviceName: device?.name || "",
      roomId: device?.id.replace("DEV", "ROOM") || "",
      roomName: device?.location || "",
    }));
  };

  // 设备ID → 模拟时段占用
  const getSlotStatus = (
    deviceId: string,
    date: string,
    time: string,
  ): { available: boolean; booked: number; max: number } => {
    const rule = rules.find((r) => r.deviceId === deviceId);
    const max = rule?.maxPerTimeSlot || 4;
    const key = `${date}::${deviceId}`;
    const dayApts = appointmentsByDateDevice[key] || [];
    const booked = dayApts.filter(
      (a) => a.examTime === time && a.status !== "cancelled",
    ).length;
    return { available: booked < max, booked, max };
  };

  // 颜色定义
  const primaryBlue = "#1e40af";
  const lightBlue = "#e8f0f8";
  const borderGray = "#e2e8f0";
  const textGray = "#64748b";
  const whiteBg = "#ffffff";

  // ====== 渲染 ======
  return (
    <div
      data-testid="appointment-page"
      style={{
        padding: 0,
        minHeight: "100vh",
        background: "#f0f4f8",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {loading && <LoadingBanner message="正在从 API 加载预约数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

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
          <div>
            <h1
              style={{
                fontSize: 20,
                fontWeight: 800,
                color: primaryBlue,
                margin: "0 0 4px",
                display: "flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <CalendarClock size={22} style={{ color: "#d97706" }} />
              检查预约管理
            </h1>
            <p style={{ fontSize: 12, color: textGray, margin: 0 }}>
              预约排程 · 设备分配 · 时间段管理 · 冲突检测 · 预约提醒
            </p>
          </div>
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
              bg: "#e8f0f8",
            },
            {
              label: "待确认",
              value: todayStats.pending,
              icon: Clock,
              color: "#ca8a04",
              bg: "#fef9c3",
            },
            {
              label: "已确认",
              value: todayStats.confirmed,
              icon: CheckCircle,
              color: "#059669",
              bg: "#d1fae5",
            },
            {
              label: "违约",
              value: todayStats.noShow,
              icon: XCircle,
              color: "#dc2626",
              bg: "#fee2e2",
            },
            {
              label: "平均等待",
              value: todayStats.avgWaitTime,
              icon: Clock,
              color: "#7c3aed",
              bg: "#f5f3ff",
            },
            {
              label: "使用率",
              value: `${todayStats.utilizationRate}%`,
              icon: BarChart3,
              color: "#0891b2",
              bg: "#ecfeff",
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
                { label: "今日预约", value: appointments.filter(a => a.examDate === formatDate(new Date())).length, color: primaryBlue, bg: lightBlue },
                { label: "已到检", value: appointments.filter(a => a.examDate === formatDate(new Date()) && a.status === "checked-in").length, color: "#059669", bg: "#d1fae5" },
                { label: "待确认", value: appointments.filter(a => a.status === "pending").length, color: "#d97706", bg: "#fef3c7" },
                { label: "违约", value: appointments.filter(a => a.status === "no-show").length, color: "#dc2626", bg: "#fee2e2" },
                { label: "今日已约", value: appointments.filter(a => a.examDate === formatDate(new Date()) && a.status !== "cancelled").length, color: "#7c3aed", bg: "#ede9fe" },
              ]}
            />
          </div>{/* ====== 右侧面板 (40%) ====== */}
          <div
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
              findConflicts={findConflicts}
              appointments={appointments}
              timeSlots={timeSlots}
              formatDate={formatDate}
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
                      background: "#fef9c3",
                      borderRadius: 6,
                      padding: "8px 10px",
                      fontSize: 12,
                      color: "#92400e",
                      border: "1px solid #fde68a",
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
                          background: "#f8fafc",
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
                                background: rule.enabled ? whiteBg : "#f1f5f9",
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
                                background: rule.enabled ? whiteBg : "#f1f5f9",
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
                                background: rule.enabled ? whiteBg : "#f1f5f9",
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
                                background: rule.enabled ? whiteBg : "#f1f5f9",
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
                                background: rule.enabled ? whiteBg : "#f1f5f9",
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
                          const uploads = JSON.parse(
                            localStorage.getItem("g005_appointment_uploads") ||
                              "[]",
                          );
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
                      background: "#f8fafc",
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
                        background: "#fafbfc",
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
                                ? "#fee2e2"
                                : w.priority === "urgent"
                                  ? "#fef3c7"
                                  : "#f1f5f9",
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
                      <div style={{ fontSize: 12, color: "#64748b" }}>
                        {w.examItemName} · {w.modality}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "#94a3b8",
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
                                ? "#fef3c7"
                                : "#dbeafe",
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
                            border: "1px solid #e2e8f0",
                            background: "#fff",
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
                      color: "#94a3b8",
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
                              color: "#334155",
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
                            background: "#e2e8f0",
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
                          color: "#d97706",
                          bg: "#fef3c7",
                        },
                        {
                          label: "批量导入",
                          icon: Upload,
                          action: () => setShowBatchImport(true),
                          color: "#2563eb",
                          bg: "#dbeafe",
                        },
                        {
                          label: "预约规则",
                          icon: Settings,
                          action: () => {
                            setShowRules(true);
                            setShowForm(false);
                          },
                          color: "#1e3a5f",
                          bg: "#e8f0f8",
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
                          bg: "#d1fae5",
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
          <div
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
          >
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
                  background: "#f8fafc",
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
                        background: "#f8fafc",
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
                      background: "#fef9c3",
                      borderRadius: 6,
                      padding: "6px 10px",
                      fontSize: 12,
                      color: "#92400e",
                      border: "1px solid #fde68a",
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
                      background: "#f0f7ff",
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
                        background: "#fee2e2",
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
                        background: "#fee2e2",
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
          </div>
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
          <div
            style={{
              background: whiteBg,
              borderRadius: 12,
              width: 420,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              border: `1px solid ${borderGray}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                    background: "#f8fafc",
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
                          cancelReason === reason.value ? "#fef9c3" : "#f8fafc",
                        borderRadius: 6,
                        border: `1px solid ${cancelReason === reason.value ? "#fde68a" : borderGray}`,
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
                    background: cancelReason ? "#dc2626" : "#f1f5f9",
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
          </div>
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
          <div
            style={{
              background: whiteBg,
              borderRadius: 12,
              width: 500,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
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
                        background: "#fee2e2",
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
                  background: "#fef3c7",
                  borderRadius: 6,
                  border: "1px solid #fde68a",
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
                    if (preventSubmitOnConflict) {
                      const device = initialModalityDevices.find(
                        (d) => d.id === formData.deviceId,
                      );
                      const newApt: Appointment = {
                        id: `APT-${String(appointments.length + 1).padStart(3, "0")}`,
                        patientId: `RAD-P${String(appointments.length + 1).padStart(3, "0")}`,
                        patientName: formData.patientName,
                        patientInitials: getNameInitials(formData.patientName),
                        gender: formData.gender,
                        age: parseInt(formData.age) || 0,
                        idCard: formData.idCard,
                        phone: formData.phone,
                        examItemId: formData.examItemId,
                        examItemName: formData.examItemName,
                        modality: formData.examType,
                        bodyPart: formData.bodyPart,
                        examDate: formData.examDate,
                        examTime: formData.examTime,
                        deviceId: formData.deviceId,
                        deviceName: formData.deviceName || device?.name || "",
                        roomId:
                          device?.id
                            .replace("DEV", "ROOM")
                            .replace("-01", "-01") || "",
                        roomName: device?.location || "",
                        referringDoctorId: formData.referringDoctorId,
                        referringDoctorName: formData.referringDoctorName,
                        clinicalDiagnosis: formData.clinicalDiagnosis,
                        notes: formData.notes,
                        status: "pending",
                        priority: formData.priority as
                          | "normal"
                          | "urgent"
                          | "critical",
                        createdAt: new Date().toLocaleString("zh-CN"),
                        updatedAt: new Date().toLocaleString("zh-CN"),
                      };
                      setAppointments((prev) => [...prev, newApt]);
                      setShowForm(false);
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
                        examDate: formatDate(new Date()),
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
                    }
                    setConflictModal({ show: false, result: null });
                    setPreventSubmitOnConflict(false);
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
          </div>
        </div>
      )}
    </div>
  );
}
