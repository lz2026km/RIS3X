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
import { appointmentApi } from "../services/api";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import {
  replayOrderEvent,
  validateOrderStatus,
} from "../utils/orderStateAdapter";

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
            {/* 顶部操作栏 */}
            <div
              style={{
                background: whiteBg,
                borderRadius: 10,
                padding: "12px 16px",
                marginBottom: 12,
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                border: `1px solid ${borderGray}`,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                }}
              >
                {/* 日期导航 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={goToPrevWeek}
                    style={{
                      padding: "5px 8px",
                      background: lightBlue,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <ChevronLeft size={16} style={{ color: primaryBlue }} />
                  </button>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: primaryBlue,
                      minWidth: 120,
                      textAlign: "center",
                    }}
                  >
                    {currentWeekStart.getMonth() + 1}月
                    {currentWeekStart.getDate()}日 —{" "}
                    {new Date(
                      currentWeekStart.getTime() + 6 * 86400000,
                    ).getMonth() + 1}
                    月
                    {new Date(
                      currentWeekStart.getTime() + 6 * 86400000,
                    ).getDate()}
                    日
                  </span>
                  <button
                    onClick={goToNextWeek}
                    style={{
                      padding: "5px 8px",
                      background: lightBlue,
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                    }}
                  >
                    <ChevronRight size={16} style={{ color: primaryBlue }} />
                  </button>
                  <button
                    onClick={goToToday}
                    style={{
                      padding: "5px 10px",
                      background: primaryBlue,
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    今天
                  </button>
                </div>

                {/* 视图切换 */}
                <div
                  style={{
                    display: "flex",
                    background: "#f1f5f9",
                    borderRadius: 8,
                    padding: 2,
                  }}
                >
                  <button
                    onClick={() => setViewMode("calendar")}
                    style={{
                      padding: "4px 12px",
                      background:
                        viewMode === "calendar" ? whiteBg : "transparent",
                      color: viewMode === "calendar" ? primaryBlue : textGray,
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      boxShadow:
                        viewMode === "calendar"
                          ? "0 1px 2px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <CalendarDays size={13} /> 日历
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    style={{
                      padding: "4px 12px",
                      background: viewMode === "list" ? whiteBg : "transparent",
                      color: viewMode === "list" ? primaryBlue : textGray,
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      boxShadow:
                        viewMode === "list"
                          ? "0 1px 2px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <List size={13} /> 列表
                  </button>
                  <button
                    onClick={() => setViewMode("reminders")}
                    style={{
                      padding: "4px 12px",
                      background:
                        viewMode === "reminders" ? whiteBg : "transparent",
                      color: viewMode === "reminders" ? primaryBlue : textGray,
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      boxShadow:
                        viewMode === "reminders"
                          ? "0 1px 2px rgba(0,0,0,0.1)"
                          : "none",
                    }}
                  >
                    <BellRing size={13} /> 预约提醒
                  </button>
                  <button
                    onClick={() => setShowWaitlist(!showWaitlist)}
                    style={{
                      padding: "4px 12px",
                      background: showWaitlist ? whiteBg : "transparent",
                      color: showWaitlist ? primaryBlue : textGray,
                      border: "none",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      boxShadow: showWaitlist
                        ? "0 1px 2px rgba(0,0,0,0.1)"
                        : "none",
                    }}
                  >
                    <User size={13} /> 等候名单
                  </button>
                </div>
                {/* 日历子视图切换 (仅日历模式) */}
                {viewMode === "calendar" && (
                  <div
                    style={{
                      display: "flex",
                      background: "#e8f0f8",
                      borderRadius: 6,
                      padding: 1,
                    }}
                  >
                    {(["day", "week", "month"] as const).map((v) => (
                      <button
                        key={v}
                        onClick={() => setCalendarSubView(v)}
                        style={{
                          padding: "3px 10px",
                          background:
                            calendarSubView === v ? whiteBg : "transparent",
                          color: calendarSubView === v ? primaryBlue : textGray,
                          border: "none",
                          borderRadius: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        {v === "day" ? "日" : v === "week" ? "周" : "月"}
                      </button>
                    ))}
                  </div>
                )}

                {/* 设备筛选 */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Filter size={14} style={{ color: textGray }} />
                  <select
                    value={selectedDevice}
                    onChange={(e) => setSelectedDevice(e.target.value)}
                    style={{
                      padding: "5px 10px",
                      border: `1px solid ${borderGray}`,
                      borderRadius: 6,
                      fontSize: 12,
                      color: primaryBlue,
                      background: whiteBg,
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    <option value="all">全部设备</option>
                    {initialModalityDevices
                      .filter((d) => d.status !== "维护中")
                      .map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.name.split("（")[0]} · {d.modality}
                        </option>
                      ))}
                  </select>
                </div>

                {/* 搜索 */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#f8fafc",
                    border: `1px solid ${borderGray}`,
                    borderRadius: 6,
                    padding: "4px 10px",
                  }}
                >
                  <Search size={13} style={{ color: textGray }} />
                  <input
                    type="text"
                    placeholder="搜索患者/电话/项目…"
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    style={{
                      border: "none",
                      background: "transparent",
                      fontSize: 12,
                      outline: "none",
                      color: primaryBlue,
                      width: 140,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* ====== 日历视图 ====== */}
            {viewMode === "calendar" && calendarSubView === "week" && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                {/* 7天表头 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(7, 1fr)",
                    background: lightBlue,
                    borderBottom: `1px solid ${borderGray}`,
                  }}
                >
                  {weekDates.map((d, i) => {
                    const isToday = formatDate(d) === formatDate(new Date());
                    return (
                      <div
                        key={i}
                        style={{
                          padding: "8px 4px",
                          textAlign: "center",
                          borderRight:
                            i < 6 ? `1px solid ${borderGray}` : "none",
                          background: isToday ? "#dbeafe" : "transparent",
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelectedDay(d);
                          setCalendarSubView("day");
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            color: textGray,
                            fontWeight: 600,
                          }}
                        >
                          {formatDateCht(d)}
                        </div>
                        {isToday && (
                          <div
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: "50%",
                              background: "#3b82f6",
                              margin: "2px auto 0",
                            }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* 设备行 */}
                {filteredDevices.map((device, di) => (
                  <div
                    key={device.id}
                    style={{
                      borderBottom:
                        di < filteredDevices.length - 1
                          ? `1px solid ${borderGray}`
                          : "none",
                    }}
                  >
                    {/* 设备标题 */}
                    <div
                      style={{
                        padding: "6px 10px",
                        background: "#f8fafc",
                        borderBottom: `1px solid ${borderGray}`,
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
                        }}
                      >
                        <Monitor size={13} style={{ color: primaryBlue }} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                          }}
                        >
                          {device.name.split("（")[0]}
                        </span>
                        <span style={{ fontSize: 12, color: textGray }}>
                          {device.modality}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <span style={{ fontSize: 12, color: textGray }}>
                          {getDeviceDayStats(new Date(), device.id).total} /{" "}
                          {rules.find((r) => r.deviceId === device.id)
                            ?.maxDailyAppointments || 60}
                        </span>
                        <div
                          style={{
                            width: 50,
                            height: 4,
                            background: "#e2e8f0",
                            borderRadius: 2,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${getDeviceDayStats(new Date(), device.id).occupancy}%`,
                              background: "#3b82f6",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                    {/* 7天格子 */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(7, 1fr)",
                      }}
                    >
                      {weekDates.map((d, di) => {
                        const dateStr = formatDate(d);
                        const key = `${dateStr}::${device.id}`;
                        const dayApts = appointmentsByDateDevice[key] || [];
                        const isToday = dateStr === formatDate(new Date());
                        return (
                          <div
                            key={di}
                            style={{
                              minHeight: 90,
                              padding: 4,
                              borderRight:
                                di < 6 ? `1px solid ${borderGray}` : "none",
                              background: isToday ? "#f8f9ff" : "transparent",
                            }}
                          >
                            {dayApts
                              .filter((a) => a.status !== "cancelled")
                              .map((apt) => {
                                const sc = getStatusConfig(apt.status);
                                const pc = getPriorityConfig(apt.priority);
                                return (
                                  <div
                                    key={apt.id}
                                    onClick={() => openDetail(apt)}
                                    style={{
                                      marginBottom: 3,
                                      padding: "3px 5px",
                                      borderRadius: 4,
                                      fontSize: 12,
                                      background: sc.bg,
                                      borderLeft: `3px solid ${sc.color}`,
                                      cursor: "pointer",
                                      overflow: "hidden",
                                      transition: "box-shadow 0.15s",
                                    }}
                                    onMouseEnter={(e) =>
                                      ((
                                        e.currentTarget as HTMLDivElement
                                      ).style.boxShadow =
                                        "0 1px 4px rgba(0,0,0,0.15)")
                                    }
                                    onMouseLeave={(e) =>
                                      ((
                                        e.currentTarget as HTMLDivElement
                                      ).style.boxShadow = "none")
                                    }
                                  >
                                    <div
                                      style={{
                                        fontWeight: 700,
                                        color: primaryBlue,
                                        fontSize: 12,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {apt.patientInitials ||
                                        apt.patientName.slice(0, 2)}
                                    </div>
                                    <div
                                      style={{
                                        color: "#475569",
                                        fontSize: 12,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {
                                        apt.examItemName
                                          .split("平扫")[0]
                                          .split("MR")[0]
                                          .split("CT")[0]
                                          .split("DR")[0]
                                      }
                                    </div>
                                    <div
                                      style={{ color: textGray, fontSize: 12 }}
                                    >
                                      {apt.examTime}
                                    </div>
                                  </div>
                                );
                              })}
                            {dayApts.filter((a) => a.status !== "cancelled")
                              .length === 0 && (
                              <div
                                style={{
                                  color: "#cbd5e1",
                                  fontSize: 12,
                                  textAlign: "center",
                                  paddingTop: 20,
                                }}
                              >
                                —
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* 日历底部说明 */}
                <div
                  style={{
                    padding: "8px 12px",
                    background: "#f8fafc",
                    borderTop: `1px solid ${borderGray}`,
                    display: "flex",
                    gap: 16,
                    alignItems: "center",
                  }}
                >
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                    <div
                      key={k}
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <div
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 2,
                          background: v.bg,
                          border: `1px solid ${v.color}`,
                        }}
                      />
                      <span style={{ fontSize: 12, color: textGray }}>
                        {v.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ====== 日视图 ====== */}
            {viewMode === "calendar" && calendarSubView === "day" && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "10px 14px",
                    background: lightBlue,
                    borderBottom: `1px solid ${borderGray}`,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => {
                      const d = new Date(selectedDay);
                      d.setDate(d.getDate() - 1);
                      setSelectedDay(d);
                    }}
                    style={{
                      padding: "3px 6px",
                      background: whiteBg,
                      border: `1px solid ${borderGray}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    &lt;
                  </button>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: primaryBlue,
                      flex: 1,
                      textAlign: "center",
                    }}
                  >
                    {formatDateCht(selectedDay)}
                  </span>
                  <button
                    onClick={() => {
                      const d = new Date(selectedDay);
                      d.setDate(d.getDate() + 1);
                      setSelectedDay(d);
                    }}
                    style={{
                      padding: "3px 6px",
                      background: whiteBg,
                      border: `1px solid ${borderGray}`,
                      borderRadius: 4,
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    &gt;
                  </button>
                  <button
                    onClick={() => setCalendarSubView("week")}
                    style={{
                      padding: "3px 8px",
                      background: primaryBlue,
                      color: "#fff",
                      border: "none",
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    返回周
                  </button>
                </div>
                <div style={{ padding: 8 }}>
                  {timeSlots.map((slot) => {
                    const dateStr = formatDate(selectedDay);
                    const slotApts = appointments.filter(
                      (a) =>
                        a.examDate === dateStr &&
                        a.examTime === slot &&
                        a.status !== "cancelled",
                    );
                    return (
                      <div
                        key={slot}
                        style={{
                          display: "flex",
                          alignItems: "flex-start",
                          borderBottom: `1px solid ${borderGray}`,
                          padding: "4px 0",
                        }}
                      >
                        <div
                          style={{
                            width: 50,
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                            paddingTop: 4,
                          }}
                        >
                          {slot}
                        </div>
                        <div
                          style={{
                            flex: 1,
                            display: "flex",
                            gap: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          {slotApts.length > 0 ? (
                            slotApts.map((apt) => (
                              <div
                                key={apt.id}
                                onClick={() => openDetail(apt)}
                                style={{
                                  padding: "4px 8px",
                                  borderRadius: 4,
                                  background: getStatusConfig(apt.status).bg,
                                  borderLeft: `3px solid ${getStatusConfig(apt.status).color}`,
                                  cursor: "pointer",
                                  fontSize: 12,
                                  minWidth: 120,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 700,
                                    color: primaryBlue,
                                  }}
                                >
                                  {apt.patientName}
                                </div>
                                <div style={{ color: textGray, fontSize: 12 }}>
                                  {apt.examItemName}
                                </div>
                              </div>
                            ))
                          ) : (
                            <span
                              style={{
                                fontSize: 12,
                                color: "#cbd5e1",
                                padding: 4,
                              }}
                            >
                              空闲
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ====== 月视图 ====== */}
            {viewMode === "calendar" && calendarSubView === "month" && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                {(() => {
                  const now = new Date(selectedDay);
                  const year = now.getFullYear();
                  const month = now.getMonth();
                  const firstDay = new Date(year, month, 1);
                  const startDay = firstDay.getDay();
                  const daysInMonth = new Date(year, month + 1, 0).getDate();
                  const days: (number | null)[] = [];
                  for (let i = 0; i < startDay; i++) days.push(null);
                  for (let d = 1; d <= daysInMonth; d++) days.push(d);
                  return (
                    <>
                      <div
                        style={{
                          padding: "10px 14px",
                          background: lightBlue,
                          borderBottom: `1px solid ${borderGray}`,
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <button
                          onClick={() =>
                            setSelectedDay(new Date(year, month - 1, 1))
                          }
                          style={{
                            padding: "3px 6px",
                            background: whiteBg,
                            border: `1px solid ${borderGray}`,
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          &lt;
                        </button>
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                            color: primaryBlue,
                            flex: 1,
                            textAlign: "center",
                          }}
                        >
                          {year}年{month + 1}月
                        </span>
                        <button
                          onClick={() =>
                            setSelectedDay(new Date(year, month + 1, 1))
                          }
                          style={{
                            padding: "3px 6px",
                            background: whiteBg,
                            border: `1px solid ${borderGray}`,
                            borderRadius: 4,
                            cursor: "pointer",
                            fontSize: 12,
                          }}
                        >
                          &gt;
                        </button>
                        <button
                          onClick={() => setCalendarSubView("week")}
                          style={{
                            padding: "3px 8px",
                            background: primaryBlue,
                            color: "#fff",
                            border: "none",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          返回周
                        </button>
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(7, 1fr)",
                          background: "#f8fafc",
                          borderBottom: `1px solid ${borderGray}`,
                        }}
                      >
                        {["日", "一", "二", "三", "四", "五", "六"].map((d) => (
                          <div
                            key={d}
                            style={{
                              padding: "6px 4px",
                              textAlign: "center",
                              fontSize: 12,
                              fontWeight: 700,
                              color: textGray,
                            }}
                          >
                            {d}
                          </div>
                        ))}
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(7, 1fr)",
                        }}
                      >
                        {days.map((d, i) => {
                          if (d === null)
                            return (
                              <div
                                key={`e${i}`}
                                style={{
                                  minHeight: 70,
                                  background: "#fafbfc",
                                  borderBottom: `1px solid ${borderGray}`,
                                  borderRight:
                                    i % 7 < 6
                                      ? `1px solid ${borderGray}`
                                      : "none",
                                }}
                              />
                            );
                          const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
                          const isToday = dateStr === formatDate(new Date());
                          const dayApts = appointments.filter(
                            (a) =>
                              a.examDate === dateStr &&
                              a.status !== "cancelled",
                          );
                          return (
                            <div
                              key={d}
                              style={{
                                minHeight: 70,
                                padding: 3,
                                borderBottom: `1px solid ${borderGray}`,
                                borderRight:
                                  i % 7 < 6
                                    ? `1px solid ${borderGray}`
                                    : "none",
                                background: isToday ? "#f8f9ff" : "transparent",
                                cursor: "pointer",
                              }}
                              onClick={() => {
                                setSelectedDay(new Date(year, month, d));
                                setCalendarSubView("day");
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 700,
                                  color: isToday ? "#3b82f6" : primaryBlue,
                                  marginBottom: 2,
                                }}
                              >
                                {d}
                              </div>
                              {dayApts.slice(0, 3).map((apt) => (
                                <div
                                  key={apt.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetail(apt);
                                  }}
                                  style={{
                                    padding: "1px 3px",
                                    borderRadius: 3,
                                    fontSize: 12,
                                    background: getStatusConfig(apt.status).bg,
                                    borderLeft: `2px solid ${getStatusConfig(apt.status).color}`,
                                    marginBottom: 1,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {apt.patientName} {apt.examTime}
                                </div>
                              ))}
                              {dayApts.length > 3 && (
                                <div style={{ fontSize: 12, color: textGray }}>
                                  +{dayApts.length - 3}更多
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ====== 列表视图 ====== */}
            {viewMode === "list" && (
              <div
                style={{
                  background: whiteBg,
                  borderRadius: 10,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                  border: `1px solid ${borderGray}`,
                  overflow: "hidden",
                }}
              >
                {/* 列表筛选栏 */}
                <div
                  style={{
                    padding: "10px 14px",
                    background: "#f8fafc",
                    borderBottom: `1px solid ${borderGray}`,
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 12, color: textGray }}>日期:</span>
                    <input
                      type="date"
                      value={listFilterDate}
                      onChange={(e) => setListFilterDate(e.target.value)}
                      style={{
                        padding: "4px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 5,
                        fontSize: 12,
                        outline: "none",
                        color: primaryBlue,
                      }}
                    />
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <span style={{ fontSize: 12, color: textGray }}>状态:</span>
                    <select
                      value={listFilterStatus}
                      onChange={(e) => setListFilterStatus(e.target.value)}
                      style={{
                        padding: "4px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 5,
                        fontSize: 12,
                        outline: "none",
                        color: primaryBlue,
                        background: whiteBg,
                      }}
                    >
                      <option value="all">全部</option>
                      <option value="pending">待确认</option>
                      <option value="confirmed">已确认</option>
                      <option value="checked-in">已到检</option>
                      <option value="cancelled">已取消</option>
                      <option value="no-show">违约</option>
                    </select>
                  </div>
                  {listFilterDate || listFilterStatus !== "all" ? (
                    <button
                      onClick={() => {
                        setListFilterDate("");
                        setListFilterStatus("all");
                      }}
                      style={{
                        padding: "3px 8px",
                        background: "transparent",
                        color: textGray,
                        border: "none",
                        fontSize: 12,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                    >
                      <X size={11} /> 清除筛选
                    </button>
                  ) : null}
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: 12,
                      color: textGray,
                    }}
                  >
                    共 {filteredListAppointments.length} 条记录
                  </span>
                </div>

                {/* 表格 */}
                <div style={{ overflowX: "auto" }}>
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      fontSize: 12,
                      minWidth: 900,
                    }}
                  >
                    <thead>
                      <tr
                        style={{
                          background: "#f8fafc",
                          borderBottom: `1px solid ${borderGray}`,
                        }}
                      >
                        {[
                          "预约ID",
                          "患者姓名",
                          "联系方式",
                          "检查项目",
                          "设备",
                          "预约日期",
                          "时段",
                          "申请医生",
                          "状态",
                          "操作",
                        ].map((h) => (
                          <th
                            key={h}
                            style={{
                              padding: "9px 10px",
                              textAlign: "left",
                              fontWeight: 700,
                              color: "#475569",
                              fontSize: 12,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredListAppointments.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            style={{
                              padding: "32px",
                              textAlign: "center",
                              color: textGray,
                              fontSize: 12,
                            }}
                          >
                            <CalendarClock
                              size={24}
                              style={{
                                margin: "0 auto 8px",
                                display: "block",
                                opacity: 0.4,
                              }}
                            />
                            暂无预约记录
                          </td>
                        </tr>
                      ) : (
                        filteredListAppointments.map((apt) => {
                          const sc = getStatusConfig(apt.status);
                          return (
                            <tr
                              key={apt.id}
                              style={{
                                borderBottom: `1px solid ${borderGray}`,
                              }}
                              onMouseEnter={(e) =>
                                ((
                                  e.currentTarget as HTMLTableRowElement
                                ).style.background = "#f0f7ff")
                              }
                              onMouseLeave={(e) =>
                                ((
                                  e.currentTarget as HTMLTableRowElement
                                ).style.background = "#fff")
                              }
                            >
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontWeight: 600,
                                  color: primaryBlue,
                                  fontSize: 12,
                                }}
                              >
                                {apt.id}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <div
                                  style={{
                                    fontWeight: 600,
                                    color: primaryBlue,
                                    fontSize: 12,
                                  }}
                                >
                                  {apt.patientName}
                                </div>
                                <div style={{ fontSize: 12, color: textGray }}>
                                  {apt.gender} / {apt.age}岁
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontSize: 12,
                                  color: "#475569",
                                }}
                              >
                                {apt.phone}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <div style={{ fontSize: 12, color: "#334155" }}>
                                  {apt.examItemName}
                                </div>
                                <div style={{ fontSize: 12, color: textGray }}>
                                  {apt.modality} · {apt.bodyPart}
                                </div>
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontSize: 12,
                                  color: "#475569",
                                }}
                              >
                                {apt.deviceName?.split("（")[0] || "-"}
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontSize: 12,
                                  color: "#475569",
                                }}
                              >
                                {apt.examDate}
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontSize: 12,
                                  color: "#475569",
                                }}
                              >
                                {apt.examTime}
                              </td>
                              <td
                                style={{
                                  padding: "8px 10px",
                                  fontSize: 12,
                                  color: "#475569",
                                }}
                              >
                                {apt.referringDoctorName || "-"}
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: sc.bg,
                                    color: sc.color,
                                  }}
                                >
                                  {sc.label}
                                </span>
                              </td>
                              <td style={{ padding: "8px 10px" }}>
                                <div style={{ display: "flex", gap: 4 }}>
                                  <button
                                    onClick={() => openDetail(apt)}
                                    style={{
                                      padding: "3px 8px",
                                      background: lightBlue,
                                      color: primaryBlue,
                                      border: "none",
                                      borderRadius: 4,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 3,
                                    }}
                                  >
                                    <Eye size={10} /> 详情
                                  </button>
                                  {apt.status !== "cancelled" &&
                                    apt.status !== "no-show" && (
                                      <button
                                        onClick={() => {
                                          setSelectedAppointment(apt);
                                          setShowCancelModal(true);
                                        }}
                                        style={{
                                          padding: "3px 8px",
                                          background: "#fee2e2",
                                          color: "#dc2626",
                                          border: "none",
                                          borderRadius: 4,
                                          fontSize: 12,
                                          fontWeight: 600,
                                          cursor: "pointer",
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 3,
                                        }}
                                      >
                                        <XCircle size={10} /> 取消
                                      </button>
                                    )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ====== 预约提醒视图 ====== */}
            {viewMode === "reminders" && (
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {/* 提醒效果统计 */}
                <div
                  style={{
                    background: whiteBg,
                    borderRadius: 10,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    border: `1px solid ${borderGray}`,
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: primaryBlue,
                      marginBottom: 14,
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <TrendingUp size={16} /> 提醒效果统计
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        background: "#e8f0f8",
                        borderRadius: 8,
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: primaryBlue,
                        }}
                      >
                        {reminderStats.confirmedRate}%
                      </div>
                      <div
                        style={{ fontSize: 12, color: textGray, marginTop: 4 }}
                      >
                        总体确认率
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#fee2e2",
                        borderRadius: 8,
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: "#dc2626",
                        }}
                      >
                        {reminderStats.noShowRate}%
                      </div>
                      <div
                        style={{ fontSize: 12, color: textGray, marginTop: 4 }}
                      >
                        爽约率
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#d1fae5",
                        borderRadius: 8,
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: "#059669",
                        }}
                      >
                        {reminderStats.avgResponseTime}h
                      </div>
                      <div
                        style={{ fontSize: 12, color: textGray, marginTop: 4 }}
                      >
                        平均响应时间
                      </div>
                    </div>
                    <div
                      style={{
                        background: "#fef3c7",
                        borderRadius: 8,
                        padding: "12px",
                        textAlign: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 28,
                          fontWeight: 800,
                          color: "#d97706",
                        }}
                      >
                        {reminderStats.rescheduled}
                      </div>
                      <div
                        style={{ fontSize: 12, color: textGray, marginTop: 4 }}
                      >
                        改期数
                      </div>
                    </div>
                  </div>

                  {/* 各渠道效果对比 */}
                  <div style={{ marginTop: 16 }}>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: primaryBlue,
                        marginBottom: 10,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <BarChart3 size={13} /> 各渠道效果对比
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, 1fr)",
                        gap: 12,
                      }}
                    >
                      {channelStats.map((ch) => (
                        <div
                          key={ch.channel}
                          style={{
                            background: "#f8fafc",
                            borderRadius: 8,
                            padding: "10px 12px",
                            border: `1px solid ${borderGray}`,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: 6,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: primaryBlue,
                              }}
                            >
                              {ch.channel}
                            </span>
                            <span style={{ fontSize: 12, color: textGray }}>
                              {ch.total}条
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              background: "#e2e8f0",
                              borderRadius: 3,
                              overflow: "hidden",
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                height: "100%",
                                width: `${ch.rate}%`,
                                background:
                                  ch.rate > 60
                                    ? "#059669"
                                    : ch.rate > 40
                                      ? "#d97706"
                                      : "#dc2626",
                                borderRadius: 3,
                                transition: "width 0.3s",
                              }}
                            />
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: textGray,
                              textAlign: "right",
                            }}
                          >
                            确认率:{" "}
                            <span
                              style={{ fontWeight: 700, color: primaryBlue }}
                            >
                              {ch.rate}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 提醒配置面板 */}
                <div
                  style={{
                    background: whiteBg,
                    borderRadius: 10,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
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
                      <BellRing size={15} /> 提醒配置
                    </div>
                    <button
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#fff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <Save size={15} />
                    </button>
                  </div>
                  <div
                    style={{
                      padding: 14,
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: 14,
                    }}
                  >
                    {/* 检查前24小时提醒 */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
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
                          <Clock size={13} style={{ color: primaryBlue }} />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: primaryBlue,
                            }}
                          >
                            检查前24小时提醒
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
                            checked={reminderConfig.before24hEnabled}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                before24hEnabled: e.target.checked,
                              }))
                            }
                            style={{
                              cursor: "pointer",
                              accentColor: primaryBlue,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: reminderConfig.before24hEnabled
                                ? "#059669"
                                : "#94a3b8",
                            }}
                          >
                            {reminderConfig.before24hEnabled
                              ? "已启用"
                              : "已停用"}
                          </span>
                        </label>
                      </div>
                      {reminderConfig.before24hEnabled && (
                        <div style={{ marginTop: 6 }}>
                          <label
                            style={{
                              fontSize: 12,
                              color: textGray,
                              display: "block",
                              marginBottom: 2,
                            }}
                          >
                            发送时间
                          </label>
                          <input
                            type="time"
                            value={reminderConfig.before24hTime}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                before24hTime: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "4px 6px",
                              border: `1px solid ${borderGray}`,
                              borderRadius: 4,
                              fontSize: 12,
                              outline: "none",
                              color: primaryBlue,
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 检查前2小时提醒 */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
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
                          <Clock size={13} style={{ color: "#d97706" }} />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: primaryBlue,
                            }}
                          >
                            检查前2小时提醒
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
                            checked={reminderConfig.before2hEnabled}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                before2hEnabled: e.target.checked,
                              }))
                            }
                            style={{
                              cursor: "pointer",
                              accentColor: primaryBlue,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: reminderConfig.before2hEnabled
                                ? "#059669"
                                : "#94a3b8",
                            }}
                          >
                            {reminderConfig.before2hEnabled
                              ? "已启用"
                              : "已停用"}
                          </span>
                        </label>
                      </div>
                      {reminderConfig.before2hEnabled && (
                        <div style={{ marginTop: 6 }}>
                          <label
                            style={{
                              fontSize: 12,
                              color: textGray,
                              display: "block",
                              marginBottom: 2,
                            }}
                          >
                            发送时间
                          </label>
                          <input
                            type="time"
                            value={reminderConfig.before2hTime}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                before2hTime: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "4px 6px",
                              border: `1px solid ${borderGray}`,
                              borderRadius: 4,
                              fontSize: 12,
                              outline: "none",
                              color: primaryBlue,
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 检查前30分钟提醒 */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
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
                          <Clock size={13} style={{ color: "#dc2626" }} />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: primaryBlue,
                            }}
                          >
                            检查前30分钟提醒
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
                            checked={reminderConfig.before30minEnabled}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                before30minEnabled: e.target.checked,
                              }))
                            }
                            style={{
                              cursor: "pointer",
                              accentColor: primaryBlue,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: reminderConfig.before30minEnabled
                                ? "#059669"
                                : "#94a3b8",
                            }}
                          >
                            {reminderConfig.before30minEnabled
                              ? "已启用"
                              : "已停用"}
                          </span>
                        </label>
                      </div>
                      {reminderConfig.before30minEnabled && (
                        <div style={{ marginTop: 6 }}>
                          <label
                            style={{
                              fontSize: 12,
                              color: textGray,
                              display: "block",
                              marginBottom: 2,
                            }}
                          >
                            发送时间
                          </label>
                          <input
                            type="time"
                            value={reminderConfig.before30minTime}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                before30minTime: e.target.value,
                              }))
                            }
                            style={{
                              width: "100%",
                              padding: "4px 6px",
                              border: `1px solid ${borderGray}`,
                              borderRadius: 4,
                              fontSize: 12,
                              outline: "none",
                              color: primaryBlue,
                              boxSizing: "border-box",
                            }}
                          />
                        </div>
                      )}
                    </div>

                    {/* 复查前1天提醒 */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
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
                          <CalendarCheck
                            size={13}
                            style={{ color: "#059669" }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 700,
                              color: primaryBlue,
                            }}
                          >
                            复查前1天提醒
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
                            checked={reminderConfig.recheck1dayEnabled}
                            onChange={(e) =>
                              setReminderConfig((prev) => ({
                                ...prev,
                                recheck1dayEnabled: e.target.checked,
                              }))
                            }
                            style={{
                              cursor: "pointer",
                              accentColor: primaryBlue,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: reminderConfig.recheck1dayEnabled
                                ? "#059669"
                                : "#94a3b8",
                            }}
                          >
                            {reminderConfig.recheck1dayEnabled
                              ? "已启用"
                              : "已停用"}
                          </span>
                        </label>
                      </div>
                    </div>

                    {/* 多渠道开关 */}
                    <div
                      style={{
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 8,
                        }}
                      >
                        <MessageSquare
                          size={13}
                          style={{ color: primaryBlue }}
                        />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                          }}
                        >
                          多渠道发送
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: 12 }}>
                        {[
                          { key: "smsEnabled", label: "短信" },
                          { key: "wechatEnabled", label: "微信" },
                          { key: "appEnabled", label: "APP推送" },
                        ].map((ch) => (
                          <label
                            key={ch.key}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                              cursor: "pointer",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={
                                reminderConfig[
                                  ch.key as keyof ReminderConfig
                                ] as boolean
                              }
                              onChange={(e) =>
                                setReminderConfig((prev) => ({
                                  ...prev,
                                  [ch.key]: e.target.checked,
                                }))
                              }
                              style={{
                                cursor: "pointer",
                                accentColor: primaryBlue,
                              }}
                            />
                            <span style={{ fontSize: 12, color: primaryBlue }}>
                              {ch.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* 24小时模板 */}
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <Bell size={12} style={{ color: primaryBlue }} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                          }}
                        >
                          24小时提醒模板
                        </span>
                      </div>
                      <textarea
                        value={reminderConfig.template24h}
                        onChange={(e) =>
                          setReminderConfig((prev) => ({
                            ...prev,
                            template24h: e.target.value,
                          }))
                        }
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          border: `1px solid ${borderGray}`,
                          borderRadius: 4,
                          fontSize: 12,
                          outline: "none",
                          color: primaryBlue,
                          resize: "none",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>

                    {/* 2小时模板 */}
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <Bell size={12} style={{ color: "#d97706" }} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                          }}
                        >
                          2小时提醒模板
                        </span>
                      </div>
                      <textarea
                        value={reminderConfig.template2h}
                        onChange={(e) =>
                          setReminderConfig((prev) => ({
                            ...prev,
                            template2h: e.target.value,
                          }))
                        }
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          border: `1px solid ${borderGray}`,
                          borderRadius: 4,
                          fontSize: 12,
                          outline: "none",
                          color: primaryBlue,
                          resize: "none",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>

                    {/* 30分钟模板 */}
                    <div
                      style={{
                        gridColumn: "1 / -1",
                        background: "#f8fafc",
                        borderRadius: 8,
                        padding: "10px 12px",
                        border: `1px solid ${borderGray}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          marginBottom: 6,
                        }}
                      >
                        <Bell size={12} style={{ color: "#dc2626" }} />
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: 700,
                            color: primaryBlue,
                          }}
                        >
                          30分钟提醒模板
                        </span>
                      </div>
                      <textarea
                        value={reminderConfig.template30min}
                        onChange={(e) =>
                          setReminderConfig((prev) => ({
                            ...prev,
                            template30min: e.target.value,
                          }))
                        }
                        rows={2}
                        style={{
                          width: "100%",
                          padding: "5px 8px",
                          border: `1px solid ${borderGray}`,
                          borderRadius: 4,
                          fontSize: 12,
                          outline: "none",
                          color: primaryBlue,
                          resize: "none",
                          boxSizing: "border-box",
                          fontFamily: "inherit",
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* 提醒记录表格 */}
                <div
                  style={{
                    background: whiteBg,
                    borderRadius: 10,
                    boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                    border: `1px solid ${borderGray}`,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 16px",
                      background: "#f8fafc",
                      borderBottom: `1px solid ${borderGray}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: primaryBlue,
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <BellRing size={14} /> 提醒记录
                    </div>
                    <div
                      style={{ display: "flex", gap: 8, alignItems: "center" }}
                    >
                      <select
                        value={reminderFilterChannel}
                        onChange={(e) =>
                          setReminderFilterChannel(e.target.value)
                        }
                        style={{
                          padding: "3px 8px",
                          border: `1px solid ${borderGray}`,
                          borderRadius: 5,
                          fontSize: 12,
                          outline: "none",
                          color: primaryBlue,
                          background: whiteBg,
                        }}
                      >
                        <option value="all">全部渠道</option>
                        <option value="短信">短信</option>
                        <option value="微信">微信</option>
                        <option value="APP推送">APP推送</option>
                      </select>
                      <select
                        value={reminderFilterStatus}
                        onChange={(e) =>
                          setReminderFilterStatus(e.target.value)
                        }
                        style={{
                          padding: "3px 8px",
                          border: `1px solid ${borderGray}`,
                          borderRadius: 5,
                          fontSize: 12,
                          outline: "none",
                          color: primaryBlue,
                          background: whiteBg,
                        }}
                      >
                        <option value="all">全部状态</option>
                        <option value="已发送">已发送</option>
                        <option value="已确认">已确认</option>
                        <option value="已改期">已改期</option>
                        <option value="已取消">已取消</option>
                      </select>
                      <span style={{ fontSize: 12, color: textGray }}>
                        共 {filteredReminderRecords.length} 条
                      </span>
                    </div>
                  </div>
                  <div style={{ overflowX: "auto" }}>
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: 12,
                        minWidth: 900,
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: `1px solid ${borderGray}`,
                          }}
                        >
                          {[
                            "记录ID",
                            "患者姓名",
                            "手机号",
                            "检查类型",
                            "预约时间",
                            "提醒时间",
                            "提醒渠道",
                            "状态",
                            "响应时间",
                          ].map((h) => (
                            <th
                              key={h}
                              style={{
                                padding: "8px 10px",
                                textAlign: "left",
                                fontWeight: 700,
                                color: "#475569",
                                fontSize: 12,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredReminderRecords.map((rec) => {
                          const sc = getReminderStatusConfig(rec.status);
                          return (
                            <tr
                              key={rec.id}
                              style={{
                                borderBottom: `1px solid ${borderGray}`,
                              }}
                              onMouseEnter={(e) =>
                                ((
                                  e.currentTarget as HTMLTableRowElement
                                ).style.background = "#f0f7ff")
                              }
                              onMouseLeave={(e) =>
                                ((
                                  e.currentTarget as HTMLTableRowElement
                                ).style.background = "#fff")
                              }
                            >
                              <td
                                style={{
                                  padding: "7px 10px",
                                  fontWeight: 600,
                                  color: primaryBlue,
                                }}
                              >
                                {rec.id}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color: "#334155",
                                  fontWeight: 600,
                                }}
                              >
                                {rec.patientName}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color: "#475569",
                                }}
                              >
                                {rec.phone}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color: "#475569",
                                }}
                              >
                                {rec.examType}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color: "#475569",
                                }}
                              >
                                {rec.examDate} {rec.examTime}
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color: "#475569",
                                }}
                              >
                                {rec.reminderTime}
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span
                                  style={{
                                    padding: "2px 6px",
                                    borderRadius: 8,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background:
                                      rec.channel === "短信"
                                        ? "#dbeafe"
                                        : rec.channel === "微信"
                                          ? "#d1fae5"
                                          : "#fef3c7",
                                    color:
                                      rec.channel === "短信"
                                        ? "#1d4ed8"
                                        : rec.channel === "微信"
                                          ? "#059669"
                                          : "#d97706",
                                  }}
                                >
                                  {rec.channel}
                                </span>
                              </td>
                              <td style={{ padding: "7px 10px" }}>
                                <span
                                  style={{
                                    padding: "2px 8px",
                                    borderRadius: 10,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    background: sc.bg,
                                    color: sc.color,
                                  }}
                                >
                                  {sc.label}
                                </span>
                              </td>
                              <td
                                style={{
                                  padding: "7px 10px",
                                  color:
                                    rec.responseTime === "未响应"
                                      ? "#dc2626"
                                      : "#059669",
                                  fontWeight: 600,
                                  fontSize: 12,
                                }}
                              >
                                {rec.responseTime}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* 改期/取消记录面板 */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                  }}
                >
                  {/* 改期记录 */}
                  <div
                    style={{
                      background: whiteBg,
                      borderRadius: 10,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      border: `1px solid ${borderGray}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#fef3c7",
                        borderBottom: `1px solid #fde68a`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#92400e",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <ArrowRightLeft size={14} /> 改期记录
                      </div>
                      <select
                        value={rescheduleFilterReason}
                        onChange={(e) =>
                          setRescheduleFilterReason(e.target.value)
                        }
                        style={{
                          padding: "2px 6px",
                          border: `1px solid #fde68a`,
                          borderRadius: 4,
                          fontSize: 12,
                          outline: "none",
                          color: "#92400e",
                          background: whiteBg,
                        }}
                      >
                        <option value="all">全部原因</option>
                        <option value="patient">患者主动</option>
                        <option value="doctor">医生调整</option>
                        <option value="device">设备故障</option>
                      </select>
                    </div>
                    <div
                      style={{
                        overflowX: "auto",
                        maxHeight: 320,
                        overflowY: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "#fffbf0",
                              borderBottom: `1px solid #fde68a`,
                            }}
                          >
                            {[
                              "患者",
                              "原时间",
                              "新时间",
                              "原因",
                              "操作时间",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  fontWeight: 700,
                                  color: "#92400e",
                                  fontSize: 12,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {rescheduleRecords
                            .filter(
                              (r) =>
                                rescheduleFilterReason === "all" ||
                                r.reason === rescheduleFilterReason,
                            )
                            .map((rec) => {
                              const rc = getRescheduleReasonConfig(rec.reason);
                              return (
                                <tr
                                  key={rec.id}
                                  style={{
                                    borderBottom: `1px solid ${borderGray}`,
                                  }}
                                  onMouseEnter={(e) =>
                                    ((
                                      e.currentTarget as HTMLTableRowElement
                                    ).style.background = "#fffbf0")
                                  }
                                  onMouseLeave={(e) =>
                                    ((
                                      e.currentTarget as HTMLTableRowElement
                                    ).style.background = "#fff")
                                  }
                                >
                                  <td
                                    style={{
                                      padding: "5px 8px",
                                      color: "#334155",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {rec.patientName}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 8px",
                                      color: "#64748b",
                                    }}
                                  >
                                    {rec.originalDate}
                                    <br />
                                    {rec.originalTime}
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 8px",
                                      color: "#059669",
                                      fontWeight: 600,
                                    }}
                                  >
                                    {rec.newDate}
                                    <br />
                                    {rec.newTime}
                                  </td>
                                  <td style={{ padding: "5px 8px" }}>
                                    <span
                                      style={{
                                        padding: "1px 6px",
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: 700,
                                        background: rc.bg,
                                        color: rc.color,
                                      }}
                                    >
                                      {rc.label}
                                    </span>
                                  </td>
                                  <td
                                    style={{
                                      padding: "5px 8px",
                                      color: "#64748b",
                                    }}
                                  >
                                    {rec.operateTime}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* 取消记录 */}
                  <div
                    style={{
                      background: whiteBg,
                      borderRadius: 10,
                      boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      border: `1px solid ${borderGray}`,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 14px",
                        background: "#fee2e2",
                        borderBottom: `1px solid #fca5a5`,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#991b1b",
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <XCircle size={14} /> 取消记录
                      </div>
                      <select
                        value={cancelFilterRebooked}
                        onChange={(e) =>
                          setCancelFilterRebooked(e.target.value)
                        }
                        style={{
                          padding: "2px 6px",
                          border: `1px solid #fca5a5`,
                          borderRadius: 4,
                          fontSize: 12,
                          outline: "none",
                          color: "#991b1b",
                          background: whiteBg,
                        }}
                      >
                        <option value="all">全部</option>
                        <option value="是">已重新预约</option>
                        <option value="否">未重新预约</option>
                        <option value="待确认">待确认</option>
                      </select>
                    </div>
                    <div
                      style={{
                        overflowX: "auto",
                        maxHeight: 320,
                        overflowY: "auto",
                      }}
                    >
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          fontSize: 12,
                        }}
                      >
                        <thead>
                          <tr
                            style={{
                              background: "#fff5f5",
                              borderBottom: `1px solid #fca5a5`,
                            }}
                          >
                            {[
                              "患者",
                              "检查类型",
                              "取消时间",
                              "取消原因",
                              "重新预约",
                            ].map((h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "6px 8px",
                                  textAlign: "left",
                                  fontWeight: 700,
                                  color: "#991b1b",
                                  fontSize: 12,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {cancellationRecords
                            .filter(
                              (r) =>
                                cancelFilterRebooked === "all" ||
                                r.rebooked === cancelFilterRebooked,
                            )
                            .map((rec) => (
                              <tr
                                key={rec.id}
                                style={{
                                  borderBottom: `1px solid ${borderGray}`,
                                }}
                                onMouseEnter={(e) =>
                                  ((
                                    e.currentTarget as HTMLTableRowElement
                                  ).style.background = "#fff5f5")
                                }
                                onMouseLeave={(e) =>
                                  ((
                                    e.currentTarget as HTMLTableRowElement
                                  ).style.background = "#fff")
                                }
                              >
                                <td
                                  style={{
                                    padding: "5px 8px",
                                    color: "#334155",
                                    fontWeight: 600,
                                  }}
                                >
                                  {rec.patientName}
                                </td>
                                <td
                                  style={{
                                    padding: "5px 8px",
                                    color: "#64748b",
                                  }}
                                >
                                  {rec.examType}
                                </td>
                                <td
                                  style={{
                                    padding: "5px 8px",
                                    color: "#64748b",
                                  }}
                                >
                                  {rec.cancelTime}
                                </td>
                                <td
                                  style={{
                                    padding: "5px 8px",
                                    color: "#991b1b",
                                    fontSize: 12,
                                  }}
                                >
                                  {rec.reason}
                                </td>
                                <td style={{ padding: "5px 8px" }}>
                                  <span
                                    style={{
                                      padding: "1px 6px",
                                      borderRadius: 8,
                                      fontSize: 12,
                                      fontWeight: 700,
                                      background:
                                        rec.rebooked === "是"
                                          ? "#d1fae5"
                                          : rec.rebooked === "否"
                                            ? "#fee2e2"
                                            : "#fef3c7",
                                      color:
                                        rec.rebooked === "是"
                                          ? "#059669"
                                          : rec.rebooked === "否"
                                            ? "#dc2626"
                                            : "#d97706",
                                    }}
                                  >
                                    {rec.rebooked}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ====== 右侧面板 (40%) ====== */}
          <div
            style={{
              flex: "0 0 40%",
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            {/* ====== 新建预约表单 ====== */}
            {showForm && (
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
                    background: "#1e3a5f",
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
                    <Plus size={15} /> 新建预约
                  </div>
                  <button
                    onClick={() => {
                      setShowForm(false);
                      setFormErrors({});
                      setValidationError("");
                    }}
                    aria-label="关闭"
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
                    padding: 16,
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {validationError && (
                    <div
                      role="alert"
                      style={{
                        color: "#dc2626",
                        fontSize: 12,
                        padding: "8px 12px",
                        background: "#fee2e2",
                        borderRadius: 6,
                        border: "1px solid #fca5a5",
                      }}
                    >
                      {validationError}
                    </div>
                  )}

                  {/* 患者信息 */}
                  <div>
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
                      <User size={12} /> 患者信息
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label
                          htmlFor="apt-patientName"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          姓名{" "}
                          <span style={{ color: "#dc2626" }} aria-label="必填">
                            *
                          </span>
                        </label>
                        <input
                          id="apt-patientName"
                          aria-label="患者姓名"
                          aria-required="true"
                          aria-invalid={!!fieldError("patientName")}
                          placeholder="请输入姓名"
                          value={formData.patientName}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              patientName: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderColor("patientName")}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                        {fieldError("patientName") && (
                          <div
                            role="alert"
                            style={{
                              fontSize: 12,
                              color: "#dc2626",
                              marginTop: 2,
                            }}
                          >
                            {fieldError("patientName")}
                          </div>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="apt-gender"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          性别
                        </label>
                        <select
                          id="apt-gender"
                          aria-label="性别"
                          value={formData.gender}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              gender: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderGray}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            background: whiteBg,
                            width: "100%",
                          }}
                        >
                          <option value="男">男</option>
                          <option value="女">女</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="apt-age"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          年龄
                        </label>
                        <input
                          id="apt-age"
                          aria-label="年龄"
                          placeholder="年龄"
                          type="number"
                          min={0}
                          max={150}
                          value={formData.age}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              age: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderGray}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="apt-phone"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          联系电话
                        </label>
                        <input
                          id="apt-phone"
                          aria-label="联系电话"
                          aria-invalid={!!fieldError("phone")}
                          placeholder="请输入手机号"
                          maxLength={11}
                          value={formData.phone}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              phone: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderColor("phone")}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                        {fieldError("phone") && (
                          <div
                            role="alert"
                            style={{
                              fontSize: 12,
                              color: "#dc2626",
                              marginTop: 2,
                            }}
                          >
                            {fieldError("phone")}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: 6 }}>
                      <label
                        htmlFor="apt-idCard"
                        style={{
                          fontSize: 12,
                          color: textGray,
                          display: "block",
                          marginBottom: 2,
                        }}
                      >
                        身份证号
                      </label>
                      <input
                        id="apt-idCard"
                        aria-label="身份证号"
                        aria-invalid={!!fieldError("idCard")}
                        placeholder="18位身份证号"
                        maxLength={18}
                        value={formData.idCard}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            idCard: e.target.value,
                          }))
                        }
                        style={{
                          padding: "6px 8px",
                          border: `1px solid ${borderColor("idCard")}`,
                          borderRadius: 6,
                          fontSize: 12,
                          outline: "none",
                          color: primaryBlue,
                          width: "100%",
                          boxSizing: "border-box",
                        }}
                      />
                      {fieldError("idCard") && (
                        <div
                          role="alert"
                          style={{
                            fontSize: 12,
                            color: "#dc2626",
                            marginTop: 2,
                          }}
                        >
                          {fieldError("idCard")}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 检查信息 */}
                  <div>
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
                      <Scan size={12} /> 检查信息
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label
                          htmlFor="apt-examType"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          检查类型
                        </label>
                        <select
                          id="apt-examType"
                          aria-label="检查类型"
                          value={formData.examType}
                          onChange={(e) => {
                            const t = e.target.value;
                            setFormData((prev) => ({
                              ...prev,
                              examType: t,
                              examItemId: "",
                              examItemName: "",
                              bodyPart: "",
                              deviceId: "",
                              deviceName: "",
                            }));
                          }}
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderGray}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            background: whiteBg,
                            width: "100%",
                          }}
                        >
                          <option value="CT">CT</option>
                          <option value="MR">MR</option>
                          <option value="DR">DR</option>
                          <option value="DSA">DSA</option>
                          <option value="乳腺钼靶">乳腺钼靶</option>
                          <option value="胃肠造影">胃肠造影</option>
                        </select>
                      </div>
                      <div>
                        <label
                          htmlFor="apt-examItem"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          检查项目{" "}
                          <span style={{ color: "#dc2626" }} aria-label="必填">
                            *
                          </span>
                        </label>
                        <select
                          id="apt-examItem"
                          aria-label="检查项目"
                          aria-required="true"
                          aria-invalid={!!fieldError("examItemId")}
                          value={formData.examItemId}
                          onChange={(e) => {
                            const item = initialExamItems.find(
                              (i) => i.id === e.target.value,
                            );
                            setFormData((prev) => ({
                              ...prev,
                              examItemId: e.target.value,
                              examItemName: item?.name || "",
                              bodyPart: item?.bodyPart || "",
                            }));
                          }}
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderColor("examItemId")}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            background: whiteBg,
                            width: "100%",
                          }}
                        >
                          <option value="">请选择检查项目</option>
                          {initialExamItems
                            .filter((i) => i.modality === formData.examType)
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name}
                              </option>
                            ))}
                        </select>
                        {fieldError("examItemId") && (
                          <div
                            role="alert"
                            style={{
                              fontSize: 12,
                              color: "#dc2626",
                              marginTop: 2,
                            }}
                          >
                            {fieldError("examItemId")}
                          </div>
                        )}
                      </div>
                      <div>
                        <label
                          htmlFor="apt-bodyPart"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          检查部位
                        </label>
                        <input
                          id="apt-bodyPart"
                          aria-label="检查部位"
                          placeholder="检查部位"
                          value={formData.bodyPart}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              bodyPart: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderGray}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="apt-priority"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          优先级
                        </label>
                        <select
                          id="apt-priority"
                          aria-label="优先级"
                          value={formData.priority}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              priority: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderGray}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            background: whiteBg,
                            width: "100%",
                          }}
                        >
                          <option value="normal">普通</option>
                          <option value="urgent">紧急</option>
                          <option value="critical">危重</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* 日期/设备/时段 */}
                  <div>
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
                      <CalendarDays size={12} /> 预约时间
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        gap: 8,
                      }}
                    >
                      <div>
                        <label
                          htmlFor="apt-examDate"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          检查日期
                        </label>
                        <input
                          id="apt-examDate"
                          aria-label="检查日期"
                          type="date"
                          value={formData.examDate}
                          onChange={(e) =>
                            setFormData((prev) => ({
                              ...prev,
                              examDate: e.target.value,
                            }))
                          }
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderGray}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            width: "100%",
                            boxSizing: "border-box",
                          }}
                        />
                      </div>
                      <div>
                        <label
                          htmlFor="apt-device"
                          style={{
                            fontSize: 12,
                            color: textGray,
                            display: "block",
                            marginBottom: 2,
                          }}
                        >
                          设备{" "}
                          <span style={{ color: "#dc2626" }} aria-label="必填">
                            *
                          </span>
                        </label>
                        <select
                          id="apt-device"
                          aria-label="检查设备"
                          aria-required="true"
                          aria-invalid={!!fieldError("deviceId")}
                          value={formData.deviceId}
                          onChange={(e) => handleDeviceChange(e.target.value)}
                          style={{
                            padding: "6px 8px",
                            border: `1px solid ${borderColor("deviceId")}`,
                            borderRadius: 6,
                            fontSize: 12,
                            outline: "none",
                            color: primaryBlue,
                            background: whiteBg,
                            width: "100%",
                          }}
                        >
                          <option value="">请选择设备</option>
                          {initialModalityDevices
                            .filter(
                              (d) =>
                                d.modality === formData.examType &&
                                d.status !== "维护中",
                            )
                            .map((d) => (
                              <option key={d.id} value={d.id}>
                                {d.name.split("（")[0]}
                              </option>
                            ))}
                        </select>
                        {fieldError("deviceId") && (
                          <div
                            role="alert"
                            style={{
                              fontSize: 12,
                              color: "#dc2626",
                              marginTop: 2,
                            }}
                          >
                            {fieldError("deviceId")}
                          </div>
                        )}
                      </div>
                    </div>
                    {/* 时段选择 */}
                    {formData.deviceId && formData.examDate && (
                      <div
                        style={{
                          marginTop: 8,
                          display: "grid",
                          gridTemplateColumns: "repeat(4, 1fr)",
                          gap: 4,
                        }}
                      >
                        {timeSlots.map((slot) => {
                          const slotStatus = getSlotStatus(
                            formData.deviceId,
                            formData.examDate,
                            slot,
                          );
                          const isSelected = formData.examTime === slot;
                          return (
                            <button
                              key={slot}
                              onClick={() => {
                                if (slotStatus.available || isSelected) {
                                  setFormData((prev) => ({
                                    ...prev,
                                    examTime: slot,
                                  }));
                                }
                              }}
                              disabled={!slotStatus.available && !isSelected}
                              style={{
                                padding: "4px 2px",
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                border: `1px solid ${isSelected ? primaryBlue : slotStatus.available ? borderGray : "#f1f5f9"}`,
                                background: isSelected
                                  ? primaryBlue
                                  : slotStatus.available
                                    ? whiteBg
                                    : "#f8fafc",
                                color: isSelected
                                  ? "#fff"
                                  : slotStatus.available
                                    ? primaryBlue
                                    : "#cbd5e1",
                                cursor:
                                  slotStatus.available || isSelected
                                    ? "pointer"
                                    : "not-allowed",
                                textAlign: "center",
                              }}
                            >
                              {slot}
                              {!slotStatus.available && !isSelected && (
                                <div style={{ fontSize: 8, color: "#94a3b8" }}>
                                  已满
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* 时段占用提示 */}
                    {formData.deviceId && formData.examDate && (
                      <div
                        style={{ marginTop: 6, fontSize: 12, color: textGray }}
                      >
                        已选时段:{" "}
                        <span style={{ fontWeight: 700, color: primaryBlue }}>
                          {formData.examTime}
                        </span>
                        {formData.deviceId &&
                          (() => {
                            const rule = rules.find(
                              (r) => r.deviceId === formData.deviceId,
                            );
                            return rule
                              ? ` | ${rule.deviceName.split("（")[0]} 每天最大${rule.maxDailyAppointments}人次，每时段最大${rule.maxPerTimeSlot}人次`
                              : "";
                          })()}
                      </div>
                    )}
                  </div>

                  {/* 申请医生 */}
                  <div>
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
                      <Stethoscope size={12} /> 申请医生
                    </div>
                    <label
                      htmlFor="apt-doctor"
                      style={{
                        fontSize: 12,
                        color: textGray,
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      申请医生
                    </label>
                    <select
                      id="apt-doctor"
                      aria-label="申请医生"
                      value={formData.referringDoctorId}
                      onChange={(e) => {
                        const doc = initialUsers.find(
                          (u) => u.id === e.target.value,
                        );
                        setFormData((prev) => ({
                          ...prev,
                          referringDoctorId: e.target.value,
                          referringDoctorName: doc?.name || "",
                        }));
                      }}
                      style={{
                        padding: "6px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 6,
                        fontSize: 12,
                        outline: "none",
                        color: primaryBlue,
                        background: whiteBg,
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    >
                      <option value="">选择申请医生</option>
                      {initialUsers
                        .filter((u) =>
                          ["radiologist", "technologist"].includes(u.role),
                        )
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} - {u.title} ({u.department})
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* 临床诊断 */}
                  <div>
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
                      <AlertCircle size={12} /> 临床诊断
                    </div>
                    <label
                      htmlFor="apt-diagnosis"
                      style={{
                        fontSize: 12,
                        color: textGray,
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      临床诊断
                    </label>
                    <textarea
                      id="apt-diagnosis"
                      aria-label="临床诊断"
                      placeholder="请输入临床诊断信息"
                      maxLength={500}
                      value={formData.clinicalDiagnosis}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          clinicalDiagnosis: e.target.value,
                        }))
                      }
                      rows={2}
                      style={{
                        padding: "6px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 6,
                        fontSize: 12,
                        outline: "none",
                        color: primaryBlue,
                        width: "100%",
                        resize: "none",
                        boxSizing: "border-box",
                        fontFamily: "inherit",
                      }}
                    />
                  </div>

                  {/* 备注 */}
                  <div>
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
                      <Bell size={12} /> 预约备注
                    </div>
                    <label
                      htmlFor="apt-notes"
                      style={{
                        fontSize: 12,
                        color: textGray,
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      备注
                    </label>
                    <input
                      id="apt-notes"
                      aria-label="预约备注"
                      placeholder="备注信息（如：空腹、需留置针等）"
                      maxLength={200}
                      value={formData.notes}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          notes: e.target.value,
                        }))
                      }
                      style={{
                        padding: "6px 8px",
                        border: `1px solid ${borderGray}`,
                        borderRadius: 6,
                        fontSize: 12,
                        outline: "none",
                        color: primaryBlue,
                        width: "100%",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  {/* 提交 */}
                  <button
                    type="button"
                    aria-label="确认预约"
                    onClick={handleCreateAppointment}
                    style={{
                      padding: "9px",
                      background: "#d97706",
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
                      boxShadow: "0 2px 4px rgba(217,119,6,0.3)",
                      minWidth: 120,
                      maxWidth: 160,
                      margin: "0 auto",
                    }}
                  >
                    <CheckCircle size={14} /> 确认预约
                  </button>
                </div>
              </div>
            )}

            {/* ====== 预约规则设置 ====== */}
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
