// v3.0.4: 拆分为子组件 (critical/*)
// G005 放射RIS系统 - 危急值全生命周期管理 v4.0.0
// 借鉴岱嘉医学+东软双闭环设计，完整模拟危急值管理流程
// 依据国家卫健委2024年版质控指标增强：主动脉夹层/肺栓塞/张力性气胸等危急值条目
// 配色方案：#1e40af (主色)
// 升级：转随访按钮 + 5节点闭环时间轴 + 增强统计卡片
// v1.0.5 (R5) 集成：跳转至 RulePage/StatsPage/SpecialAssessment
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShieldAlert,
  AlertTriangle,
  Phone,
  Clock,
  CheckCircle,
  Bell,
  Search,
  X,
  ChevronRight,
  FileText,
  User,
  Calendar,
  Activity,
  Settings,
  BarChart3,
  TrendingUp,
  PieChart as PieChartIcon,
  CheckSquare,
  Square,
  Upload,
  Download,
  Send,
  Eye,
  Edit3,
  Plus,
  Filter,
  PhoneCall,
  MessageSquare,
  Circle,
  ClipboardList,
  Image as ImageIcon,
  Stethoscope,
  Timer,
  AlertCircle,
  PhoneIncoming,
  PhoneOutgoing,
  ArrowUp,
  AlertOctagon,
  Users,
  Workflow,
  Target,
  Heart,
  Wind,
  Siren,
  Brain,
  Bone,
  ArrowUpRight,
  Mail,
  Smartphone,
  MessageCircle,
  CheckSquare as CheckSquareIcon,
} from "lucide-react";
import { message } from "antd";
import {
  initialCriticalValues,
  initialUsers,
  initialRadiologyExams,
} from "../data/initialData";
import { criticalApi } from "../services/api";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import { useCriticalStore } from "../store";
import { CN_STATUS_TO_STORE } from "./critical/types";
import type { NotificationMethod } from "../services/api/criticalApi";
import {
  CriticalValueList,
  FilterBar,
  DetailPanel,
  ClosedLoopTracker,
  ClosedLoopTracker5Nodes,
  TransferToFollowUpModal,
} from "./critical";
import type {
  CriticalValue,
  TimelineEvent,
  DocumentItem,
  FollowUpRecord,
} from "./critical";
import BatchActionBar from "../components/batch/BatchActionBar";
import { useOperationLog } from "../hooks/useOperationLog";
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from "../hooks/useKeyboardShortcuts";

// ============ 国家卫健委2024年版放射科危急值目录 ============
const NATIONAL_CRITICAL_ITEMS = {
  "CT/MR": [
    {
      code: "CV-RAD-001",
      name: "主动脉夹层",
      icon: Heart,
      color: "#dc2626",
      description: "主动脉内膜片影，真假腔形成",
    },
    {
      code: "CV-RAD-002",
      name: "肺栓塞",
      icon: Wind,
      color: "#dc2626",
      description: "肺动脉内血栓或脂肪栓塞",
    },
    {
      code: "CV-RAD-003",
      name: "张力性气胸",
      icon: Siren,
      color: "#dc2626",
      description: "患侧肺完全受压，纵隔移位",
    },
    {
      code: "CV-RAD-004",
      name: "急性脑疝",
      icon: Brain,
      color: "#dc2626",
      description: "中线偏移>5mm，脑室受压",
    },
    {
      code: "CV-RAD-005",
      name: "脑血管栓塞/梗死",
      icon: Brain,
      color: "#d97706",
      description: "大血管闭塞或大面积梗死",
    },
    {
      code: "CV-RAD-006",
      name: "消化道穿孔",
      icon: AlertTriangle,
      color: "#dc2626",
      description: "腹腔游离气体",
    },
    {
      code: "CV-RAD-007",
      name: "肠系膜栓塞",
      icon: AlertTriangle,
      color: "#d97706",
      description: "肠系膜血管栓塞伴肠管扩张",
    },
    {
      code: "CV-RAD-008",
      name: "腹部脏器急性出血",
      icon: AlertOctagon,
      color: "#dc2626",
      description: "腹腔或腹膜后血肿",
    },
  ],
  "DR/CR": [
    {
      code: "CV-RAD-009",
      name: "气胸(≥30%)",
      icon: Siren,
      color: "#dc2626",
      description: "肺压缩≥30%",
    },
    {
      code: "CV-RAD-010",
      name: "骨折急性并发症",
      icon: Bone,
      color: "#d97706",
      description: "长骨干骨折伴血管神经损伤",
    },
    {
      code: "CV-RAD-011",
      name: "心影增大伴心衰",
      icon: Heart,
      color: "#d97706",
      description: "心胸比>0.6伴肺水肿",
    },
  ],
  "DSA/介入": [
    {
      code: "CV-RAD-012",
      name: "介入术后血管急性闭塞",
      icon: AlertOctagon,
      color: "#dc2626",
      description: "支架内急性血栓形成",
    },
    {
      code: "CV-RAD-013",
      name: "对比剂严重过敏反应",
      icon: AlertTriangle,
      color: "#dc2626",
      description: "喉头水肿或过敏性休克",
    },
  ],
  超声: [
    {
      code: "CV-RAD-014",
      name: "急性心包填塞",
      icon: Heart,
      color: "#dc2626",
      description: "心包积液伴右心受压",
    },
    {
      code: "CV-RAD-015",
      name: "宫外孕破裂",
      icon: AlertOctagon,
      color: "#dc2626",
      description: "腹腔积血",
    },
  ],
};

type CriticalItemType =
  | "主动脉夹层"
  | "肺栓塞"
  | "张力性气胸"
  | "急性脑疝"
  | "脑血管栓塞"
  | "消化道穿孔"
  | "肠系膜栓塞"
  | "腹部出血"
  | "气胸"
  | "骨折"
  | "心衰"
  | "血管闭塞"
  | "对比剂过敏"
  | "心包填塞"
  | "宫外孕"
  | "其他";

interface CriticalValueRule {
  id: string;
  modality: string;
  examItem: string;
  resultName: string;
  normalMin: string;
  normalMax: string;
  criticalMin: string;
  criticalMax: string;
  unit: string;
  notifyTimeout: number;
  notifyMethods: string[];
  enabled: boolean;
}

interface ChartData {
  label: string;
  value: number;
  color: string;
}

interface EscalationRule {
  id: string;
  level: number;
  triggerCondition: string;
  escalateTo: string;
  escalateMethod: string[];
  timeoutMinutes: number;
  enabled: boolean;
}

interface MissedReportStats {
  totalExams: number;
  missedCount: number;
  missedRate: string;
  topMissedReasons: { reason: string; count: number }[];
}

interface NotificationCompletionStats {
  totalCount: number;
  completedWithin10Min: number;
  completionRate: string;
  avgNotificationTime: string;
  todayCount: number;
  todayCompleted: number;
  todayRate: string;
}

const PRIMARY_COLOR = "#1e40af";
const PRIMARY_LIGHT = "#3b82f6";
const PRIMARY_BG = "#eff6ff";

/** 把中文/旧版 status 映射到 criticalStore 英文 status key */
function toStoreStatus(raw: string): string {
  if (!raw) return raw
  if (raw in CN_STATUS_TO_STORE) return CN_STATUS_TO_STORE[raw]
  return raw
}

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; icon: any }
> = {
  pending: { bg: "#fee2e2", color: "#dc2626", label: "待处理", icon: Bell },
  notified: { bg: "#fef3c7", color: "#d97706", label: "已通知", icon: Send },
  acknowledged: { bg: "#dbeafe", color: "#2563eb", label: "已接收", icon: CheckSquare },
  resolving: { bg: "#fef3c7", color: "#d97706", label: "处理中", icon: Clock },
  resolved: {
    bg: "#d1fae5",
    color: "#059669",
    label: "已处理",
    icon: CheckCircle,
  },
  closed_loop: { bg: "#dcfce7", color: "#047857", label: "已闭环", icon: CheckCircle },
  escalated: { bg: "#fecaca", color: "#991b1b", label: "已升级", icon: AlertTriangle },
  cancelled: { bg: "#f1f5f9", color: "#64748b", label: "已取消", icon: X },
  overdue: { bg: "#fecaca", color: "#991b1b", label: "超时", icon: AlertTriangle },
  // legacy Chinese 兼容
  待处理: { bg: "#fee2e2", color: "#dc2626", label: "待处理", icon: Bell },
  处理中: { bg: "#fef3c7", color: "#d97706", label: "处理中", icon: Clock },
  已处理: {
    bg: "#d1fae5",
    color: "#059669",
    label: "已处理",
    icon: CheckCircle,
  },
  超时: { bg: "#fecaca", color: "#991b1b", label: "超时", icon: AlertTriangle },
};

const SEVERITY_CONFIG: Record<
  string,
  { bg: string; color: string; borderColor: string; slaMinutes: number; label: string }
> = {
  '危及生命': { bg: "#fef2f2", color: "#dc2626", borderColor: "#dc2626", slaMinutes: 5, label: '危及生命' },
  '危急': { bg: "#fee2e2", color: "#ef4444", borderColor: "#ef4444", slaMinutes: 10, label: '危急' },
  '高危': { bg: "#fffbeb", color: "#f97316", borderColor: "#f97316", slaMinutes: 30, label: '高危' },
  '紧急': { bg: "#eff6ff", color: "#eab308", borderColor: "#eab308", slaMinutes: 120, label: '紧急' },
  '警告': { bg: "#f0f9ff", color: "#3b82f6", borderColor: "#3b82f6", slaMinutes: 1440, label: '警告' },
};

const MODALITY_LIST = ["全部", "CT", "MR", "DR", "DSA", "超声"];
const SEVERITY_LIST = ["全部", "危及生命", "危急", "高危", "紧急", "警告"];
// v3.0.6.11: status filter 使用 criticalStore 英文状态 key
const STATUS_LIST = ["全部", "pending", "resolving", "resolved", "overdue"];
const STATUS_LABEL_CN: Record<string, string> = {
  pending: "待处理",
  notified: "已通知",
  acknowledged: "已接收",
  resolving: "处理中",
  resolved: "已处理",
  closed_loop: "已闭环",
  escalated: "已升级",
  cancelled: "已取消",
  overdue: "超时",
};
const TIME_RANGE_LIST = ["全部", "30分钟内", "1小时内", "2小时内", "超时"];

// ============ 模拟数据扩展 ============
const generateMockCriticalValues = (): CriticalValue[] => {
  const baseData = (initialCriticalValues as unknown as CriticalValue[]).map(
    (cv, idx) => {
      const exam = initialRadiologyExams.find((e) => e.id === cv.examId);
      const patient = {
        gender: "男",
        age: 45 + idx * 5,
        patientType: "住院",
        phone: "138****1234",
        contactPerson: "家属电话",
      };
      const reportDoctor = initialUsers.find((u) => u.id === cv.reportedBy);
      const receivingDoctor = cv.receivingDoctorId
        ? initialUsers.find((u) => u.id === cv.receivingDoctorId)
        : null;

      const baseTime = new Date("2026-05-01 10:00");
      baseTime.setMinutes(baseTime.getMinutes() - idx * 35);

      const timeline: TimelineEvent[] = [
        {
          time: exam?.createdTime || "2026-05-01 08:30",
          event: "检查完成",
          user: exam?.technologistName || "刘建国",
          detail: "影像采集完成",
        },
        {
          time: cv.reportedTime,
          event: "发现危急值",
          user: cv.reportedByName,
          detail: cv.findingDetails.substring(0, 30) + "...",
        },
        {
          time:
            String(baseTime.getHours()).padStart(2, "0") +
            ":" +
            String(baseTime.getMinutes() + 2).padStart(2, "0"),
          event: "系统预警",
          user: "系统",
          detail: "自动触发危急值预警流程",
        },
        {
          time: cv.receivingTime || "",
          event: "通知临床",
          user: cv.receivingDoctorName || "待通知",
          detail: "已通过" + (cv.notificationMethod || "系统通知") + "方式通知",
        },
        {
          time: cv.acknowledgedTime || "",
          event: "临床接收",
          user: cv.acknowledgedBy || "待确认",
          detail: "临床已收到危急值通报",
        },
        {
          time: cv.processingTime || "",
          event: "处理完成",
          user: cv.processingDoctorName || "",
          detail: cv.processingResult || "处置措施已记录",
        },
      ].filter((t) => t.time);

      const documents: DocumentItem[] =
        idx === 0
          ? [
              {
                id: "DOC001",
                name: "CT检查报告单.pdf",
                type: "application/pdf",
                uploadTime: "2026-05-01 12:35",
              },
              {
                id: "DOC002",
                name: "CT影像截图.png",
                type: "image/png",
                uploadTime: "2026-05-01 12:36",
              },
            ]
          : [];

      return {
        ...cv,
        gender: patient.gender,
        age: patient.age,
        patientType: patient.patientType,
        phone: patient.phone,
        contactPerson: patient.contactPerson,
        examDoctor: exam?.technologistId,
        examDoctorName: exam?.technologistName,
        examTime: exam?.examTime,
        deviceName: exam?.deviceName,
        accessionNumber: exam?.accessionNumber,
        notificationMethod: cv.notificationMethod || "系统通知",
        receivingDepartment: cv.receivingDoctorId ? "心内科" : "神经内科",
        timeline,
        documents,
        resultValue:
          idx === 0
            ? "85%"
            : idx === 1
              ? "3.5×2.8cm"
              : idx === 2
                ? "2.1×1.8cm"
                : "3.5cm",
        resultUnit: idx === 0 ? "狭窄率" : "cm",
        normalRange: idx === 0 ? "<50%" : "无",
        criticalRange: idx === 0 ? ">70%" : "有占位即危急",
        exceedRatio: idx === 0 ? "超标121%" : "发现即超标",
        processingDoctor: cv.receivingDoctorId,
        processingDoctorName: cv.receivingDoctorName,
        processingTime: cv.receivingTime,
        processingDepartment: cv.receivingDoctorId ? "心内科" : "神经内科",
        processingMeasure:
          idx === 0
            ? "建议急诊CAG+PCI"
            : idx === 1
              ? "急诊开颅血肿清除术"
              : "进一步检查明确诊断",
        processingResult:
          idx === 0
            ? "已转心内科进一步治疗"
            : idx === 1
              ? "手术顺利完成"
              : "密切随访中",
        processingDuration:
          idx === 0 ? "35分钟" : idx === 1 ? "2小时" : "24小时",
        acknowledgedBy: idx < 2 ? "李明辉" : idx === 2 ? "王秀峰" : "刘芳",
        acknowledgedTime: cv.receivingTime,
      } as CriticalValue;
    },
  );

  const extraData: Partial<CriticalValue>[] = [
    {
      id: "CV005",
      reportId: "RAD-RPT008",
      examId: "RAD-EX005",
      patientId: "RAD-P005",
      patientName: "周玉芬",
      modality: "CT",
      examItemName: "腹部CT平扫+增强",
      criticalFinding: "true",
      findingDetails:
        "肝右叶见约6.5×5.8cm低密度影，边界不清，增强扫描呈不均匀强化。门静脉右支受累。腹腔淋巴结肿大。考虑原发性肝癌。",
      severity: "危急",
      reportedBy: "R002",
      reportedByName: "王秀峰",
      reportedTime: "2026-05-01 15:20",
      receivingDoctorId: "R001",
      receivingDoctorName: "李明辉",
      receivingTime: "2026-05-01 15:25",
      status: "处理中",
      resultValue: "6.5×5.8cm",
      resultUnit: "cm",
      normalRange: "无占位",
      criticalRange: "有占位即危急",
      exceedRatio: "发现即超标",
    },
  ];

  const extraCVs = extraData.map((data, idx) => {
    const exam = initialRadiologyExams.find((e) => e.id === data.examId);
    const cvIdx = baseData.length + idx;
    const timeline: TimelineEvent[] = [
      {
        time: data.reportedTime,
        event: "发现危急值",
        user: data.reportedByName || "",
        detail: data.findingDetails?.substring(0, 30) + "...",
      },
      {
        time: data.receivingTime || "",
        event: "通知临床",
        user: data.receivingDoctorName || "待通知",
        detail: "已通知临床科室",
      },
      {
        time: data.processingTime || "",
        event: "处理完成",
        user: data.processingDoctorName || "",
        detail: data.processingResult || "",
      },
    ].filter((t) => t.time);

    const documents: DocumentItem[] =
      data.id === "CV005"
        ? [
            {
              id: "DOC003",
              name: "腹部CT增强报告.pdf",
              type: "application/pdf",
              uploadTime: "2026-05-01 15:25",
            },
          ]
        : [];

    return {
      ...data,
      gender: "男",
      age: 50,
      patientType: "住院",
      phone: "138****5678",
      contactPerson: "家属电话",
      examDoctorName: exam?.technologistName,
      examTime: exam?.examTime,
      deviceName: exam?.deviceName,
      accessionNumber: exam?.accessionNumber,
      notificationMethod: "系统通知",
      receivingDepartment: "肿瘤科",
      timeline,
      documents,
      acknowledged: data.status !== "待处理" && data.status !== "超时",
      acknowledgedBy: data.receivingDoctorName,
      acknowledgedTime: data.receivingTime,
    } as CriticalValue;
  });

  return [...baseData, ...extraCVs];
};

const MOCK_CRITICAL_VALUES = generateMockCriticalValues();

// ============ 模拟回访记录数据 ============
const MOCK_FOLLOWUP_RECORDS: FollowUpRecord[] = [
  {
    id: "FU001",
    time: "2026-05-01 16:30",
    type: "电话回访",
    result: "已回复",
    operator: "李明辉",
    content: "患者已接收通知，临床已安排急诊CAG检查。",
    relatedCVId: "CV001",
    followUpDate: "2026-05-30",
  },
  {
    id: "FU002",
    time: "2026-05-01 15:45",
    type: "短信确认",
    result: "已回复",
    operator: "王秀峰",
    content: "患者家属已收到短信提醒，确认前往医院途中。",
    relatedCVId: "CV002",
  },
  {
    id: "FU003",
    time: "2026-05-01 14:20",
    type: "电话回访",
    result: "无响应",
    operator: "刘芳",
    content: "首次电话无人接听，已发送短信通知，准备二次回访。",
    relatedCVId: "CV003",
  },
  {
    id: "FU004",
    time: "2026-05-01 11:00",
    type: "系统通知",
    result: "已回复",
    operator: "系统",
    content: "临床医生已通过系统确认接收危急值通报。",
    relatedCVId: "CV004",
  },
  {
    id: "FU005",
    time: "2026-04-30 17:30",
    type: "现场走访",
    result: "转接成功",
    operator: "张海涛",
    content: "急诊科医生接收患者，现场交接完成。",
    relatedCVId: "CV007",
  },
  {
    id: "FU-001",
    time: "2026-05-30 14:00",
    type: "电话回访",
    result: "已回复",
    operator: "李明辉",
    content: "冠脉支架术后1个月随访，患者无胸闷胸痛，可自行活动。",
    relatedCVId: "CV007",
    followUpDate: "2026-05-30",
  },
  {
    id: "FU-002",
    time: "2026-06-03 09:45",
    type: "电话回访",
    result: "已回复",
    operator: "王秀峰",
    content: "肺栓塞溶栓后1个月随访，血氧正常，抗凝治疗中。",
    relatedCVId: "CV010",
    followUpDate: "2026-06-03",
  },
];

const MOCK_ESCALATION_RULES: EscalationRule[] = [
  {
    id: "ES001",
    level: 1,
    triggerCondition: "30分钟内未确认",
    escalateTo: "科室主任",
    escalateMethod: ["电话通知", "短信通知"],
    timeoutMinutes: 30,
    enabled: true,
  },
  {
    id: "ES002",
    level: 2,
    triggerCondition: "1小时内未处理",
    escalateTo: "医务科",
    escalateMethod: ["电话通知", "系统通知"],
    timeoutMinutes: 60,
    enabled: true,
  },
  {
    id: "ES003",
    level: 3,
    triggerCondition: "2小时内未完成",
    escalateTo: "分管院长",
    escalateMethod: ["电话通知", "短信通知", "邮件通知"],
    timeoutMinutes: 120,
    enabled: true,
  },
  {
    id: "ES004",
    level: 4,
    triggerCondition: "24小时内未闭环",
    escalateTo: "院长",
    escalateMethod: ["电话通知", "短信通知", "邮件通知", "现场走访"],
    timeoutMinutes: 1440,
    enabled: false,
  },
];

const MOCK_MISSED_STATS: MissedReportStats = {
  totalExams: 1247,
  missedCount: 12,
  missedRate: "0.96%",
  topMissedReasons: [
    { reason: "医生未及时查阅报告", count: 5 },
    { reason: "系统通知发送失败", count: 3 },
    { reason: "患者联系方式缺失", count: 2 },
    { reason: "其他", count: 2 },
  ],
};

const MOCK_NOTIFICATION_STATS: NotificationCompletionStats = {
  totalCount: 156,
  completedWithin10Min: 142,
  completionRate: "91.0%",
  avgNotificationTime: "6.5分钟",
  todayCount: 8,
  todayCompleted: 7,
  todayRate: "87.5%",
};

// ============ 子组件：国家卫健委危急值目录 ============
const CriticalItemsDirectory = () => {
  const [expandedCategory, setExpandedCategory] = useState<string | null>(
    "CT/MR",
  );
  const [showModal, setShowModal] = useState(false);

  const categoryIcons: Record<string, unknown> = {
    "CT/MR": Activity,
    "DR/CR": FileText,
    "DSA/介入": Workflow,
    超声: Activity,
  };

  return (
    <>
      <div
        style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          marginBottom: 16,
        }}
      >
        <div
          style={{
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`,
            borderRadius: "12px 12px 0 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <ShieldAlert size={18} style={{ color: "#fff" }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
              国家卫健委2024年版危急值目录
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: "6px 12px",
                borderRadius: 6,
                border: "1px solid rgba(255,255,255,0.3)",
                background: "rgba(255,255,255,0.15)",
                color: "#fff",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Eye size={12} />
              完整目录
            </button>
          </div>
        </div>
        <div style={{ padding: 12 }}>
          {Object.entries(NATIONAL_CRITICAL_ITEMS).map(([category, items]) => {
            const CategoryIcon =
              (categoryIcons[category] as React.ComponentType<{
                size?: number;
                style?: React.CSSProperties;
              }>) || AlertTriangle;
            const isExpanded = expandedCategory === category;
            return (
              <div key={category} style={{ marginBottom: 8 }}>
                <div
                  onClick={() =>
                    setExpandedCategory(isExpanded ? null : category)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "8px 12px",
                    background: isExpanded ? "#eff6ff" : "#f8fafc",
                    borderRadius: 8,
                    cursor: "pointer",
                    border: `1px solid ${isExpanded ? "#bfdbfe" : "#e2e8f0"}`,
                  }}
                >
                  <CategoryIcon size={14} style={{ color: PRIMARY_COLOR }} />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#1e40af",
                    }}
                  >
                    {category}
                  </span>
                  <span
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      background: "#f1f5f9",
                      padding: "2px 8px",
                      borderRadius: 10,
                    }}
                  >
                    {items.length}项
                  </span>
                  <ChevronRight
                    size={14}
                    style={{
                      color: "#64748b",
                      transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                      transition: "transform 0.2s",
                    }}
                  />
                </div>
                {isExpanded && (
                  <div
                    style={{
                      padding: "8px 12px",
                      display: "grid",
                      gridTemplateColumns: "repeat(2, 1fr)",
                      gap: 8,
                      background: "#fafafa",
                      borderRadius: "0 0 8px 8px",
                      border: "1px solid #e2e8f0",
                      borderTop: "none",
                    }}
                  >
                    {items.map((item) => {
                      const ItemIcon = item.icon;
                      return (
                        <div
                          key={item.code}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "6px 8px",
                            background: "#fff",
                            borderRadius: 6,
                            border: "1px solid #f1f5f9",
                          }}
                        >
                          <div
                            style={{
                              width: 28,
                              height: 28,
                              borderRadius: 6,
                              background: item.color + "15",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <ItemIcon size={14} style={{ color: item.color }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: "#334155",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.name}
                            </div>
                            <div
                              style={{
                                fontSize: 12,
                                color: "#94a3b8",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.code}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {showModal && (
        <div
          onClick={() => setShowModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="国家卫健委2024年版放射科危急值目录"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "var(--z-modal, 500)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 700,
              maxHeight: "80vh",
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ShieldAlert size={20} style={{ color: "#fff" }} />
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                    国家卫健委2024年版放射科危急值目录
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "rgba(255,255,255,0.8)",
                      marginTop: 2,
                    }}
                  >
                    共{Object.values(NATIONAL_CRITICAL_ITEMS).flat().length}
                    项危急值条目
                  </div>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={18} style={{ color: "#fff" }} />
              </button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
              {Object.entries(NATIONAL_CRITICAL_ITEMS).map(
                ([category, items]) => {
                  const CategoryIcon =
                    (categoryIcons[category] as React.ComponentType<{
                      size?: number;
                      style?: React.CSSProperties;
                    }>) || AlertTriangle;
                  return (
                    <div key={category} style={{ marginBottom: 20 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          marginBottom: 12,
                          paddingBottom: 8,
                          borderBottom: "2px solid " + PRIMARY_COLOR,
                        }}
                      >
                        <CategoryIcon
                          size={16}
                          style={{ color: PRIMARY_COLOR }}
                        />
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: PRIMARY_COLOR,
                          }}
                        >
                          {category}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "#fff",
                            background: PRIMARY_COLOR,
                            padding: "2px 8px",
                            borderRadius: 10,
                          }}
                        >
                          {items.length}项
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 8,
                        }}
                      >
                        {items.map((item) => {
                          const ItemIcon = item.icon;
                          return (
                            <div
                              key={item.code}
                              style={{
                                display: "flex",
                                alignItems: "flex-start",
                                gap: 12,
                                padding: 12,
                                background: "#f8fafc",
                                borderRadius: 8,
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <div
                                style={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 8,
                                  background: item.color + "15",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0,
                                }}
                              >
                                <ItemIcon
                                  size={18}
                                  style={{ color: item.color }}
                                />
                              </div>
                              <div style={{ flex: 1 }}>
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    marginBottom: 4,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      color: "#1e40af",
                                    }}
                                  >
                                    {item.name}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "#fff",
                                      background: item.color,
                                      padding: "1px 6px",
                                      borderRadius: 4,
                                    }}
                                  >
                                    {item.code}
                                  </span>
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    color: "#64748b",
                                    lineHeight: 1.5,
                                  }}
                                >
                                  {item.description}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                },
              )}
            </div>
            <div
              style={{
                padding: "16px 24px",
                borderTop: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "center",
                gap: 12,
              }}
            >
              <button
                onClick={() => setShowModal(false)}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                关闭
              </button>
              <button
                onClick={() => {
                  const dataStr = JSON.stringify(
                    NATIONAL_CRITICAL_ITEMS,
                    null,
                    2,
                  );
                  const blob = new Blob([dataStr], {
                    type: "application/json",
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "危急值目录.json";
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                style={{
                  padding: "10px 24px",
                  borderRadius: 8,
                  border: "1px solid " + PRIMARY_COLOR,
                  background: PRIMARY_COLOR,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Download size={14} />
                导出目录
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

// ============ 子组件：统计卡片 ============
interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  trend?: string;
  suffix?: string;
}

const StatCard = ({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  trend,
  suffix,
}: StatCardProps) => (
  <div
    style={{
      background: "#fff",
      borderRadius: 12,
      padding: "16px 20px",
      border: "1px solid #e2e8f0",
      boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      display: "flex",
      alignItems: "center",
      gap: 16,
      transition: "box-shadow 0.2s",
      cursor: "pointer",
    }}
    onMouseEnter={(e) =>
      (e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.1)")
    }
    onMouseLeave={(e) =>
      (e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.05)")
    }
  >
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: bgColor,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={24} style={{ color }} />
    </div>
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontSize: 28,
          fontWeight: 800,
          color: "#1e3a5f",
          lineHeight: 1,
        }}
      >
        {value}
        {suffix || ""}
      </div>
      <div style={{ fontSize: 13, color: "#64748b", marginTop: 4 }}>
        {label}
      </div>
    </div>
    {trend && (
      <div
        style={{
          fontSize: 12,
          color: trend.startsWith("+") ? "#059669" : "#dc2626",
          background: trend.startsWith("+") ? "#d1fae5" : "#fee2e2",
          padding: "2px 8px",
          borderRadius: 10,
          fontWeight: 600,
        }}
      >
        {trend}
      </div>
    )}
  </div>
);

// ============ 子组件：统计图表区 ============
interface StatisticsChartsProps {
  data: CriticalValue[];
}

const StatisticsCharts = ({ data }: StatisticsChartsProps) => {
  const [activeChart, setActiveChart] = useState<
    "trend" | "modality" | "time" | "missed" | "notification"
  >("trend");

  const pendingCount = data.filter((c) => toStoreStatus(String(c.status)) === "pending").length;
  const processingCount = data.filter((c) => toStoreStatus(String(c.status)) === "resolving").length;
  const resolvedCount = data.filter((c) => toStoreStatus(String(c.status)) === "resolved").length;
  const overdueCount = data.filter((c) => toStoreStatus(String(c.status)) === "overdue").length;
  const transferredCount = data.filter((c) => c.transferredToFollowUp).length;
  const overdueProcessingCount = data.filter(
    (c) =>
      toStoreStatus(String(c.status)) === "resolving" &&
      c.processingDuration &&
      parseInt(String(c.processingDuration || 0)) > 60,
  ).length;

  const thisMonthCount = 8;
  const timelyRate = "87.5%";

  const trendData = [
    { day: "04-25", count: 18 },
    { day: "04-26", count: 17 },
    { day: "04-27", count: 15 },
    { day: "04-28", count: 16 },
    { day: "04-29", count: 14 },
    { day: "04-30", count: 12 },
    { day: "05-01", count: data.length },
  ];
  const maxTrend = Math.max(...trendData.map((d) => d.count));

  const modalityData: ChartData[] = [
    {
      label: "CT",
      value: data.filter((d) => d.modality === "CT").length,
      color: "#1e40af",
    },
    {
      label: "MR",
      value: data.filter((d) => d.modality === "MR").length,
      color: "#2563eb",
    },
    {
      label: "DR",
      value: data.filter((d) => d.modality === "DR").length,
      color: "#059669",
    },
    {
      label: "DSA",
      value: data.filter((d) => d.modality === "DSA").length,
      color: "#d97706",
    },
  ];
  const totalModality = modalityData.reduce((sum, d) => sum + d.value, 0);

  const timeData: ChartData[] = [
    { label: "30分钟内", value: 3, color: "#059669" },
    { label: "1小时内", value: 4, color: "#2563eb" },
    { label: "2小时内", value: 2, color: "#d97706" },
    { label: "超时", value: overdueCount || 1, color: "#dc2626" },
  ];
  const maxTime = Math.max(...timeData.map((d) => d.value));

  const chartTabs = [
    { key: "trend", label: "趋势", icon: TrendingUp },
    { key: "modality", label: "设备分布", icon: PieChartIcon },
    { key: "time", label: "处理时效", icon: BarChart3 },
    { key: "notification", label: "10分钟通报", icon: Timer },
    { key: "missed", label: "漏报率", icon: AlertOctagon },
  ];

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        padding: 16,
        border: "1px solid #e2e8f0",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        marginBottom: 16,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div
          style={{
            background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
            borderRadius: 10,
            padding: 14,
            color: "#fff",
          }}
        >
          <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
            本月新增危急值
          </div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{thisMonthCount}</div>
          <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>例</div>
        </div>
        <div
          style={{
            background: "#d1fae5",
            borderRadius: 10,
            padding: 14,
            border: "1px solid #a7f3d0",
          }}
        >
          <div style={{ fontSize: 12, color: "#059669", marginBottom: 4 }}>
            及时处理率
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>
            {timelyRate}
          </div>
          <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>
            目标≥85%
          </div>
        </div>
        <div
          style={{
            background: "#f5f3ff",
            borderRadius: 10,
            padding: 14,
            border: "1px solid #ddd6fe",
          }}
        >
          <div style={{ fontSize: 12, color: "#7c3aed", marginBottom: 4 }}>
            已转随访数
          </div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#7c3aed" }}>
            {transferredCount}
          </div>
          <div style={{ fontSize: 12, color: "#a855f7", marginTop: 2 }}>例</div>
        </div>
        <div
          style={{
            background: overdueProcessingCount > 0 ? "#fef2f2" : "#f0fdf4",
            borderRadius: 10,
            padding: 14,
            border: `1px solid ${overdueProcessingCount > 0 ? "#fecaca" : "#bbf7d0"}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: overdueProcessingCount > 0 ? "#dc2626" : "#059669",
              marginBottom: 4,
            }}
          >
            处理中超期数
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 800,
              color: overdueProcessingCount > 0 ? "#dc2626" : "#059669",
            }}
          >
            {overdueProcessingCount}
          </div>
          <div
            style={{
              fontSize: 12,
              color: overdueProcessingCount > 0 ? "#f87171" : "#4ade80",
              marginTop: 2,
            }}
          >
            {overdueProcessingCount > 0 ? "需要关注" : "全部正常"}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {chartTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveChart(tab.key as typeof activeChart)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 14px",
                borderRadius: 8,
                border: `1px solid ${activeChart === tab.key ? "#1e3a5f" : "#e2e8f0"}`,
                background: activeChart === tab.key ? "#1e3a5f" : "#fff",
                color: activeChart === tab.key ? "#fff" : "#64748b",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeChart === "trend" && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1e3a5f",
              marginBottom: 12,
            }}
          >
            本月危急值数量趋势（近7天）
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 8,
              height: 100,
            }}
          >
            {trendData.map((d, idx) => (
              <div
                key={d.day}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: `${(d.count / maxTrend) * 80}px`,
                    background:
                      idx === trendData.length - 1 ? "#dc2626" : "#1e3a5f",
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s",
                    minHeight: 4,
                  }}
                />
                <span style={{ fontSize: 12, color: "#94a3b8" }}>{d.day}</span>
                <span
                  style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f" }}
                >
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === "modality" && (
        <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
          <div style={{ position: "relative", width: 120, height: 120 }}>
            <svg viewBox="0 0 120 120" style={{ transform: "rotate(-90deg)" }}>
              {
                modalityData.reduce(
                  (acc, d, idx) => {
                    const pct = d.value / totalModality;
                    const dashArray = pct * 377;
                    const dashOffset = acc.offset;
                    acc.elements.push(
                      <circle
                        key={d.label}
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke={d.color}
                        strokeWidth="20"
                        strokeDasharray={`${dashArray} ${377 - dashArray}`}
                        strokeDashoffset={-dashOffset}
                      />,
                    );
                    acc.offset += dashArray;
                    return acc;
                  },
                  { elements: [] as React.ReactNode[], offset: 0 },
                ).elements
              }
            </svg>
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, color: "#1e3a5f" }}>
                {totalModality}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>总计</div>
            </div>
          </div>
          <div style={{ flex: 1 }}>
            {modalityData.map((d) => (
              <div
                key={d.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 10,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: d.color,
                  }}
                />
                <div style={{ flex: 1, fontSize: 12, color: "#334155" }}>
                  {d.label}
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f" }}
                >
                  {d.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#94a3b8",
                    width: 40,
                    textAlign: "right",
                  }}
                >
                  {Math.round((d.value / totalModality) * 100)}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === "time" && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1e3a5f",
              marginBottom: 12,
            }}
          >
            处理时效分布
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 12,
              height: 100,
            }}
          >
            {timeData.map((d) => (
              <div
                key={d.label}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    width: "100%",
                    maxWidth: 48,
                    height: `${(d.value / maxTime) * 80}px`,
                    background: d.color,
                    borderRadius: "4px 4px 0 0",
                    transition: "height 0.3s",
                    minHeight: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <span
                    style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}
                  >
                    {d.value}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: 12,
                    color: "#64748b",
                    textAlign: "center",
                  }}
                >
                  {d.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeChart === "missed" && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1e3a5f",
              marginBottom: 12,
            }}
          >
            漏报率统计
          </div>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <div
              style={{
                flex: 1,
                background: "#f8fafc",
                borderRadius: 10,
                padding: 14,
                border: "1px solid #e2e8f0",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                本月检查总数
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#1e40af" }}>
                {MOCK_MISSED_STATS.totalExams}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                人次
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "#fef2f2",
                borderRadius: 10,
                padding: 14,
                border: "1px solid #fecaca",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                漏报次数
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#dc2626" }}>
                {MOCK_MISSED_STATS.missedCount}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                次
              </div>
            </div>
            <div
              style={{
                flex: 1,
                background: "#d1fae5",
                borderRadius: 10,
                padding: 14,
                border: "1px solid #a7f3d0",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}>
                漏报率
              </div>
              <div style={{ fontSize: 24, fontWeight: 800, color: "#059669" }}>
                {MOCK_MISSED_STATS.missedRate}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                低于目标1%
              </div>
            </div>
          </div>
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "#1e3a5f",
              marginBottom: 10,
            }}
          >
            漏报原因分析
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {MOCK_MISSED_STATS.topMissedReasons.map((item, idx) => {
              const pct = Math.round(
                (item.count / MOCK_MISSED_STATS.missedCount) * 100,
              );
              return (
                <div
                  key={item.reason}
                  style={{ display: "flex", alignItems: "center", gap: 10 }}
                >
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: "50%",
                      background:
                        idx === 0
                          ? "#dc2626"
                          : idx === 1
                            ? "#d97706"
                            : idx === 2
                              ? "#2563eb"
                              : "#64748b",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 12,
                      fontWeight: 700,
                      color: "#fff",
                    }}
                  >
                    {idx + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: 3,
                      }}
                    >
                      <span style={{ fontSize: 12, color: "#334155" }}>
                        {item.reason}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#1e40af",
                        }}
                      >
                        {item.count}次
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        background: "#f1f5f9",
                        borderRadius: 3,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          background:
                            idx === 0
                              ? "#dc2626"
                              : idx === 1
                                ? "#d97706"
                                : idx === 2
                                  ? "#2563eb"
                                  : "#64748b",
                          borderRadius: 3,
                          transition: "width 0.3s",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeChart === "notification" && (
        <div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: "#1e40af",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Timer size={16} style={{ color: "#1e40af" }} />
            10分钟通报完成率统计
            <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 400 }}>
              国家卫健委2024年版质控指标
            </span>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                background: `linear-gradient(135deg, ${PRIMARY_COLOR} 0%, ${PRIMARY_LIGHT} 100%)`,
                borderRadius: 10,
                padding: 14,
                textAlign: "center",
                color: "#fff",
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.9, marginBottom: 4 }}>
                本月通报总数
              </div>
              <div style={{ fontSize: 28, fontWeight: 800 }}>
                {MOCK_NOTIFICATION_STATS.totalCount}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>例</div>
            </div>
            <div
              style={{
                background: "#d1fae5",
                borderRadius: 10,
                padding: 14,
                textAlign: "center",
                border: "1px solid #a7f3d0",
              }}
            >
              <div style={{ fontSize: 12, color: "#059669", marginBottom: 4 }}>
                10分钟内完成
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#059669" }}>
                {MOCK_NOTIFICATION_STATS.completedWithin10Min}
              </div>
              <div style={{ fontSize: 12, color: "#059669", marginTop: 2 }}>
                例
              </div>
            </div>
            <div
              style={{
                background: "#eff6ff",
                borderRadius: 10,
                padding: 14,
                textAlign: "center",
                border: "1px solid #bfdbfe",
              }}
            >
              <div style={{ fontSize: 12, color: "#1e40af", marginBottom: 4 }}>
                完成率
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#1e40af" }}>
                {MOCK_NOTIFICATION_STATS.completionRate}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                目标≥90%
              </div>
            </div>
            <div
              style={{
                background: "#fef3c7",
                borderRadius: 10,
                padding: 14,
                textAlign: "center",
                border: "1px solid #fde68a",
              }}
            >
              <div style={{ fontSize: 12, color: "#d97706", marginBottom: 4 }}>
                平均通报时间
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#d97706" }}>
                {MOCK_NOTIFICATION_STATS.avgNotificationTime}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>
                分钟
              </div>
            </div>
          </div>
          <div
            style={{
              background: "#f8fafc",
              borderRadius: 10,
              padding: 14,
              border: "1px solid #e2e8f0",
              marginBottom: 16,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#1e40af",
                marginBottom: 12,
              }}
            >
              今日通报情况
            </div>
            <div style={{ display: "flex", gap: 24, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  今日通报
                </div>
                <div
                  style={{ fontSize: 24, fontWeight: 800, color: "#1e40af" }}
                >
                  {MOCK_NOTIFICATION_STATS.todayCount}
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    color: "#64748b",
                  }}
                >
                  <span>完成进度</span>
                  <span style={{ fontWeight: 700, color: "#059669" }}>
                    {MOCK_NOTIFICATION_STATS.todayCompleted}/
                    {MOCK_NOTIFICATION_STATS.todayCount}
                  </span>
                </div>
                <div
                  style={{
                    height: 8,
                    background: "#e2e8f0",
                    borderRadius: 4,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(MOCK_NOTIFICATION_STATS.todayCompleted / MOCK_NOTIFICATION_STATS.todayCount) * 100}%`,
                      height: "100%",
                      background:
                        "linear-gradient(90deg, #1e40af 0%, #3b82f6 100%)",
                      borderRadius: 4,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  完成率
                </div>
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 800,
                    color:
                      parseFloat(MOCK_NOTIFICATION_STATS.todayRate) >= 90
                        ? "#059669"
                        : "#d97706",
                  }}
                >
                  {MOCK_NOTIFICATION_STATS.todayRate}
                </div>
              </div>
            </div>
          </div>
          <div
            style={{
              background: "#eff6ff",
              borderRadius: 10,
              padding: 12,
              border: "1px solid #bfdbfe",
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#1e40af",
                marginBottom: 8,
              }}
            >
              📋 国家卫健委2024年版质控指标说明
            </div>
            <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.6 }}>
              <div style={{ marginBottom: 4 }}>
                •{" "}
                <span style={{ fontWeight: 600, color: "#334155" }}>
                  10分钟通报完成率
                </span>
                ：自发现危急值至通报临床时间&lt;=10分钟的比例
              </div>
              <div style={{ marginBottom: 4 }}>
                •{" "}
                <span style={{ fontWeight: 600, color: "#334155" }}>
                  达标标准
                </span>
                ：三级医院≥90%，二级医院≥85%
              </div>
              <div>
                •{" "}
                <span style={{ fontWeight: 600, color: "#334155" }}>
                  超时处理
                </span>
                ：&gt;30分钟未通报需启动升级机制
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============ 子组件：规则设置弹窗 ============
interface RulesSettingsModalProps {
  onClose: () => void;
  showToast: (message: string, type?: "success" | "error") => void;
}

const RulesSettingsModal = ({
  onClose,
  showToast,
}: RulesSettingsModalProps) => {
  const [activeSection, setActiveSection] = useState<
    "range" | "timeout" | "notify" | "escalation"
  >("range");
  const [rules, setRules] = useState<CriticalValueRule[]>([
    {
      id: "R001",
      modality: "CT",
      examItem: "冠脉CTA",
      resultName: "冠脉狭窄率",
      normalMin: "0",
      normalMax: "50",
      criticalMin: "70",
      criticalMax: "100",
      unit: "%",
      notifyTimeout: 30,
      notifyMethods: ["系统通知", "短信通知"],
      enabled: true,
    },
    {
      id: "R002",
      modality: "CT",
      examItem: "头颅CT平扫",
      resultName: "中线偏移",
      normalMin: "0",
      normalMax: "5",
      criticalMin: "5",
      criticalMax: "20",
      unit: "mm",
      notifyTimeout: 15,
      notifyMethods: ["系统通知", "电话通知"],
      enabled: true,
    },
    {
      id: "R003",
      modality: "MR",
      examItem: "头颅MR平扫",
      resultName: "占位大小",
      normalMin: "0",
      normalMax: "0",
      criticalMin: "1",
      criticalMax: "200",
      unit: "cm",
      notifyTimeout: 30,
      notifyMethods: ["系统通知"],
      enabled: true,
    },
  ]);

  const sections = [
    { key: "range", label: "危急值范围", icon: AlertTriangle },
    { key: "timeout", label: "超时提醒", icon: Timer },
    { key: "notify", label: "通知方式", icon: Bell },
    { key: "escalation", label: "升级规则", icon: ArrowUp },
  ];

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="危急值规则设置"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: "var(--z-modal, 500)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 800,
          maxHeight: "80vh",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#1e3a5f",
            borderRadius: "16px 16px 0 0",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Settings size={20} style={{ color: "#fff" }} />
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
                危急值规则设置
              </div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)" }}>
                配置各类检查结果的危急值范围及通知规则
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.1)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} style={{ color: "#fff" }} />
          </button>
        </div>

        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #e2e8f0",
            background: "#f8fafc",
          }}
        >
          {sections.map((sec) => {
            const Icon = sec.icon;
            return (
              <div
                key={sec.key}
                onClick={() =>
                  setActiveSection(sec.key as typeof activeSection)
                }
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  textAlign: "center",
                  cursor: "pointer",
                  borderBottom:
                    activeSection === sec.key
                      ? "2px solid #1e3a5f"
                      : "2px solid transparent",
                  background:
                    activeSection === sec.key ? "#fff" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <Icon
                  size={16}
                  style={{
                    color: activeSection === sec.key ? "#1e3a5f" : "#94a3b8",
                  }}
                />
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: activeSection === sec.key ? 700 : 500,
                    color: activeSection === sec.key ? "#1e3a5f" : "#94a3b8",
                  }}
                >
                  {sec.label}
                </span>
              </div>
            );
          })}
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
          {activeSection === "range" && (
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={() => message.info("危急值规则管理功能为模拟实现")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #1e3a5f",
                    background: "#1e3a5f",
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  添加规则
                </button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    {[
                      "设备",
                      "检查项目",
                      "指标名称",
                      "正常范围",
                      "危急范围",
                      "单位",
                      "状态",
                      "操作",
                    ].map((h) => (
                      <th
                        key={h}
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          fontWeight: 700,
                          color: "#64748b",
                          textAlign: "left",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rules.map((rule) => (
                    <tr
                      key={rule.id}
                      style={{ borderBottom: "1px solid #f1f5f9" }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#334155",
                        }}
                      >
                        {rule.modality}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#334155",
                        }}
                      >
                        {rule.examItem}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#334155",
                        }}
                      >
                        {rule.resultName}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#059669",
                        }}
                      >
                        {rule.normalMin}~{rule.normalMax}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#dc2626",
                          fontWeight: 600,
                        }}
                      >
                        {rule.criticalMin}~{rule.criticalMax}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          fontSize: 12,
                          color: "#64748b",
                        }}
                      >
                        {rule.unit}
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <span
                          style={{
                            padding: "2px 8px",
                            borderRadius: 10,
                            fontSize: 12,
                            fontWeight: 600,
                            background: rule.enabled ? "#d1fae5" : "#fee2e2",
                            color: rule.enabled ? "#059669" : "#dc2626",
                          }}
                        >
                          {rule.enabled ? "已启用" : "已禁用"}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px" }}>
                        <button
                          onClick={() =>
                            message.info("危急值规则管理功能为模拟实现")
                          }
                          style={{
                            padding: "4px 8px",
                            borderRadius: 4,
                            border: "1px solid #e2e8f0",
                            background: "#fff",
                            color: "#64748b",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          编辑
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeSection === "timeout" && (
            <div>
              <div
                style={{
                  background: "#eff6ff",
                  borderRadius: 10,
                  padding: 16,
                  border: "1px solid #bfdbfe",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e3a5f",
                    marginBottom: 12,
                  }}
                >
                  超时提醒时间设置
                </div>
                <div style={{ display: "flex", gap: 16 }}>
                  {[
                    { label: "紧急提醒", minutes: 15, color: "#dc2626" },
                    { label: "危急提醒", minutes: 30, color: "#d97706" },
                    { label: "超时提醒", minutes: 60, color: "#2563eb" },
                  ].map((item) => (
                    <div
                      key={item.label}
                      style={{
                        flex: 1,
                        padding: 14,
                        background: "#fff",
                        borderRadius: 8,
                        border: `1px solid ${item.color}`,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 12,
                          color: "#64748b",
                          marginBottom: 6,
                        }}
                      >
                        {item.label}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <input
                          type="number"
                          defaultValue={item.minutes}
                          style={{
                            width: 60,
                            padding: "6px 10px",
                            borderRadius: 6,
                            border: "1px solid #e2e8f0",
                            fontSize: 14,
                            fontWeight: 700,
                            color: "#1e3a5f",
                            textAlign: "center",
                          }}
                        />
                        <span style={{ fontSize: 12, color: "#64748b" }}>
                          分钟
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeSection === "notify" && (
            <div>
              <div
                style={{
                  background: "#f8fafc",
                  borderRadius: 10,
                  padding: 16,
                  border: "1px solid #e2e8f0",
                }}
              >
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1e3a5f",
                    marginBottom: 16,
                  }}
                >
                  通知方式配置
                </div>
                {[
                  {
                    name: "系统通知",
                    desc: "RIS系统内即时消息推送",
                    icon: Bell,
                    color: "#1e3a5f",
                  },
                  {
                    name: "短信通知",
                    desc: "发送到临床医生手机号码",
                    icon: MessageSquare,
                    color: "#2563eb",
                  },
                  {
                    name: "电话通知",
                    desc: "自动拨打电话确认接收",
                    icon: PhoneCall,
                    color: "#d97706",
                  },
                ].map((method) => (
                  <div
                    key={method.name}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: 14,
                      background: "#fff",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      marginBottom: 10,
                    }}
                  >
                    <div
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        background: method.color + "15",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <method.icon size={20} style={{ color: method.color }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          color: "#1e3a5f",
                        }}
                      >
                        {method.name}
                      </div>
                      <div style={{ fontSize: 12, color: "#94a3b8" }}>
                        {method.desc}
                      </div>
                    </div>
                    <div
                      style={{
                        width: 48,
                        height: 24,
                        borderRadius: 12,
                        background: "#1e3a5f",
                        position: "relative",
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: "#fff",
                          position: "absolute",
                          top: 2,
                          right: 2,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeSection === "escalation" && (
            <div>
              <div
                style={{
                  background: "#fffbeb",
                  borderRadius: 10,
                  padding: 16,
                  border: "1px solid #fde68a",
                  marginBottom: 16,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <ArrowUp size={16} style={{ color: "#d97706" }} />
                  <span
                    style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f" }}
                  >
                    升级规则说明
                  </span>
                </div>
                <div
                  style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7 }}
                >
                  当危急值在规定时间内未得到确认或处理时，系统将自动按照以下规则逐级升级通知，确保危急值得到及时响应。升级规则按照紧急程度分为4个层级。
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 12,
                }}
              >
                <button
                  onClick={() => message.info("危急值规则管理功能为模拟实现")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #d97706",
                    background: "#fffbeb",
                    color: "#d97706",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  添加规则
                </button>
              </div>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                {MOCK_ESCALATION_RULES.map((rule) => (
                  <div
                    key={rule.id}
                    style={{
                      background: "#f8fafc",
                      borderRadius: 10,
                      padding: 16,
                      border: `1px solid ${rule.enabled ? "#a7f3d0" : "#e2e8f0"}`,
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: 4,
                        height: "100%",
                        background:
                          rule.level === 1
                            ? "#dc2626"
                            : rule.level === 2
                              ? "#d97706"
                              : rule.level === 3
                                ? "#2563eb"
                                : "#64748b",
                      }}
                    />
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: 8,
                          background:
                            rule.level === 1
                              ? "#dc2626"
                              : rule.level === 2
                                ? "#d97706"
                                : rule.level === 3
                                  ? "#2563eb"
                                  : "#64748b",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 800,
                            color: "#fff",
                          }}
                        >
                          {rule.level}
                        </span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            marginBottom: 6,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: 700,
                              color: "#1e3a5f",
                            }}
                          >
                            升级至：{rule.escalateTo}
                          </span>
                          <span
                            style={{
                              padding: "2px 8px",
                              borderRadius: 10,
                              fontSize: 12,
                              fontWeight: 600,
                              background: rule.enabled ? "#d1fae5" : "#f1f5f9",
                              color: rule.enabled ? "#059669" : "#94a3b8",
                            }}
                          >
                            {rule.enabled ? "已启用" : "已禁用"}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#64748b",
                            marginBottom: 8,
                          }}
                        >
                          触发条件：
                          <span style={{ color: "#334155", fontWeight: 600 }}>
                            {rule.triggerCondition}
                          </span>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 16,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              gap: 6,
                              flexWrap: "wrap",
                            }}
                          >
                            {rule.escalateMethod.map((m) => (
                              <span
                                key={m}
                                style={{
                                  padding: "2px 8px",
                                  background: "#e2e8f0",
                                  borderRadius: 4,
                                  fontSize: 12,
                                  color: "#64748b",
                                }}
                              >
                                {m}
                              </span>
                            ))}
                          </div>
                          <div
                            style={{
                              marginLeft: "auto",
                              fontSize: 12,
                              color: "#94a3b8",
                            }}
                          >
                            超时{" "}
                            <span style={{ fontWeight: 700, color: "#1e3a5f" }}>
                              {rule.timeoutMinutes}
                            </span>{" "}
                            分钟触发
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          message.info("危急值规则管理功能为模拟实现")
                        }
                        style={{
                          padding: "4px 8px",
                          borderRadius: 4,
                          border: "1px solid #e2e8f0",
                          background: "#fff",
                          color: "#64748b",
                          fontSize: 12,
                          cursor: "pointer",
                        }}
                      >
                        编辑
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              background: "#fff",
              color: "#64748b",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            取消
          </button>
          <button
            onClick={() => {
              showToast("规则设置已保存");
              onClose();
            }}
            style={{
              padding: "10px 24px",
              borderRadius: 8,
              border: "1px solid #1e3a5f",
              background: "#1e3a5f",
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ 主组件 ============
export default function CriticalValuePage() {
  const navigate = useNavigate();
  const { log } = useOperationLog("critical_value");
  const [statusFilter, setStatusFilter] = useState<string>("全部");
  const [modalityFilter, setModalityFilter] = useState<string>("全部");
  const [severityFilter, setSeverityFilter] = useState<string>("全部");
  const [timeRangeFilter, setTimeRangeFilter] = useState<string>("全部");
  const [dateRange, setDateRange] = useState("2026-05-01");
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedCV, setSelectedCV] = useState<CriticalValue | null>(null);
  const [detailTab, setDetailTab] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [showProcessModal, setShowProcessModal] = useState(false);
  const [processCV, setProcessCV] = useState<CriticalValue | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferCV, setTransferCV] = useState<CriticalValue | null>(null);
  const [criticalValues, setCriticalValues] =
    useState<CriticalValue[]>(MOCK_CRITICAL_VALUES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const res = await criticalApi.list();
      if (cancelled) return;
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setCriticalValues(res.data as unknown as CriticalValue[]);
        setLoadError(null);
      } else {
        setCriticalValues(MOCK_CRITICAL_VALUES);
        setLoadError("API 不可用,使用本地 mock 数据");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });
  const [showNotifyModal, setShowNotifyModal] = useState(false);
  const [notifyCV, setNotifyCV] = useState<CriticalValue | null>(null);
  const [notifyPhone, setNotifyPhone] = useState("");
  const [notifyNotes, setNotifyNotes] = useState("");
  const [notifyMethod, setNotifyMethod] = useState<string>("SYSTEM");
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmType, setConfirmType] = useState<"notify" | "process">(
    "notify",
  );
  const [confirmMessage, setConfirmMessage] = useState("");

  const stats = {
    pending: criticalValues.filter((c) => toStoreStatus(String(c.status)) === "pending").length,
    processing: criticalValues.filter((c) => toStoreStatus(String(c.status)) === "resolving").length,
    resolved: criticalValues.filter((c) => toStoreStatus(String(c.status)) === "resolved").length,
    overdue: criticalValues.filter((c) => toStoreStatus(String(c.status)) === "overdue").length,
    thisMonth: 8,
    timelyRate: "87.5%",
    transferred: criticalValues.filter((c) => c.transferredToFollowUp).length,
    overdueProcessing: criticalValues.filter(
      (c) =>
        toStoreStatus(String(c.status)) === "resolving" &&
        c.processingDuration &&
        parseInt(String(c.processingDuration || 0)) > 60,
    ).length,
  };

  const filtered = criticalValues.filter((cv) => {
    if (search) {
      const s = search.toLowerCase();
      if (
        !cv.patientName.toLowerCase().includes(s) &&
        !cv.id.toLowerCase().includes(s) &&
        !cv.accessionNumber?.toLowerCase().includes(s)
      )
        return false;
    }
    // v3.0.6.11: 过滤时将 cv.status 规范化到 store 状态 key,然后比较
    const cvStoreStatus = toStoreStatus(String(cv.status));
    if (statusFilter !== "全部" && cvStoreStatus !== statusFilter) return false;
    if (modalityFilter !== "全部" && cv.modality !== modalityFilter)
      return false;
    if (severityFilter !== "全部" && cv.severity !== severityFilter)
      return false;
    return true;
  });

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((c) => c.id)));
  };

  const handleProcess = (cv: CriticalValue) => {
    setProcessCV(cv);
    setShowProcessModal(true);
  };
  const handleViewDetail = (cv: CriticalValue) => {
    setSelectedCV(cv);
    setDetailTab(0);
  };

  const showToast = (
    message: string,
    type: "success" | "error" = "success",
  ) => {
    setToast({ show: true, message, type });
    setTimeout(
      () => setToast({ show: false, message: "", type: "success" }),
      3000,
    );
  };

  const handleContactClinical = (cv: CriticalValue) => {
    setNotifyCV(cv);
    setNotifyPhone(cv.phone || "");
    setNotifyNotes("");
    setNotifyMethod("SYSTEM");
    setShowNotifyModal(true);
  };

  const handleConfirmNotify = async () => {
    if (notifyCV) {
      await useCriticalStore
        .getState()
        .notify(notifyCV.id, notifyMethod as NotificationMethod);
      log("notify", notifyCV.id, { method: notifyMethod });
      showToast("已发送通知");
    }
    setShowNotifyModal(false);
    setNotifyCV(null);
  };

  const handleConfirmProcess = async () => {
    if (processCV) {
      await useCriticalStore.getState().resolve(processCV.id);
      log("resolve", processCV.id);
      showToast("已处理");
    }
    setShowProcessModal(false);
    setProcessCV(null);
  };

  const handleTransferToFollowUp = (cv: CriticalValue) => {
    setTransferCV(cv);
    setShowTransferModal(true);
  };

  const handleConfirmTransfer = (followUpDate: string) => {
    if (!transferCV) return;
    const followUpId = `FU-${String(criticalValues.filter((c) => c.transferredToFollowUp).length + 1).padStart(3, "0")}`;
    setCriticalValues((prev) =>
      prev.map((cv) =>
        cv.id === transferCV.id
          ? { ...cv, transferredToFollowUp: true, followUpId, followUpDate }
          : cv,
      ),
    );
    const newFollowUpRecord: FollowUpRecord = {
      id: followUpId,
      time: new Date().toISOString().replace("T", " ").substring(0, 16),
      type: "系统通知",
      result: "已回复",
      operator: "系统",
      content: `危急值 ${transferCV.id} 已转随访，计划随访日期：${followUpDate}`,
      relatedCVId: transferCV.id,
      followUpDate,
    };
    MOCK_FOLLOWUP_RECORDS.push(newFollowUpRecord);
    showToast(
      `转随访成功！随访编号：${followUpId}，计划随访日期：${followUpDate}`,
    );
    setShowTransferModal(false);
    setTransferCV(null);
  };

  const handleBatchNotify = () => {
    setConfirmType("notify");
    setConfirmMessage(`确定要批量发送通知给 ${selectedIds.size} 个危急值吗？`);
    setShowConfirmModal(true);
  };
  const handleBatchProcess = () => {
    setConfirmType("process");
    setConfirmMessage(`确定要批量标记处理 ${selectedIds.size} 个危急值吗？`);
    setShowConfirmModal(true);
  };

  const handleConfirm = async () => {
    if (confirmType === "notify") {
      for (const id of Array.from(selectedIds)) {
        await useCriticalStore.getState().notify(id, "SYSTEM");
        log("batch_notify", id);
      }
      showToast(`已成功发送 ${selectedIds.size} 条通知`);
    } else {
      for (const id of Array.from(selectedIds)) {
        await useCriticalStore.getState().resolve(id);
        log("batch_resolve", id);
      }
      showToast(`已成功标记处理 ${selectedIds.size} 条记录`);
    }
    setSelectedIds(new Set());
    setShowConfirmModal(false);
  };

  // Keyboard shortcuts
  useKeyboardShortcuts([
    SHORTCUTS.SUBMIT(() => {
      if (showProcessModal && processCV) {
        handleConfirmProcess();
      } else if (showConfirmModal) {
        handleConfirm();
      }
    }),
    SHORTCUTS.CANCEL(() => {
      setShowProcessModal(false);
      setProcessCV(null);
      setShowNotifyModal(false);
      setNotifyCV(null);
      setShowConfirmModal(false);
      setShowSettings(false);
      setSelectedCV(null);
    }),
    SHORTCUTS.REFRESH(() => {
      window.location.reload();
    }),
  ]);
  useNavigationShortcuts([
    { sequence: ['g', 'c'], action: () => { window.location.href = '/critical-value' }, description: '导航到危急值' },
    { sequence: ['g', 'r'], action: () => { window.location.href = '/reports' }, description: '导航到报告' },
  ]);

  // Batch actions
  const handleBatchAction = (action: string) => {
    const ids = Array.from(selectedIds);
    if (action === 'acknowledge') {
      setConfirmType('notify');
      setConfirmMessage(`确定要批量确认 ${ids.length} 个危急值吗？`);
    } else if (action === 'resolve') {
      setConfirmType('process');
      setConfirmMessage(`确定要批量处理 ${ids.length} 个危急值吗？`);
    }
    ids.forEach((id) => log('batch_' + action, id));
    setShowConfirmModal(true);
  };

  const headerStyle: React.CSSProperties = {
    padding: "10px 16px",
    fontSize: 12,
    fontWeight: 700,
    color: "#64748b",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    display: "flex",
    alignItems: "center",
  };

  return (
    <div
      data-testid="critical-value-page"
      style={{ padding: 24, background: "#f1f5f9", minHeight: "100vh" }}
    >
      {loading && <LoadingBanner message="正在从 API 加载危急值数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.1); } }`}</style>

      <div
        style={{
          background: "linear-gradient(135deg, #7c2d12 0%, #dc2626 100%)",
          borderRadius: 10,
          padding: 12,
          marginBottom: 12,
          display: "flex",
          alignItems: "center",
          gap: 12,
          color: "#fff",
        }}
      >
        <div style={{ fontSize: 18 }}>🚨</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700 }}>
            v1.0.5 危急值子系统升级 · 18 条规则 + 10分钟通报率 + 8 大分类评估
          </div>
          <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
            国家卫健委 2024 版危急值目录 ·
            BI-RADS/Lung-RADS/PI-RADS/CAD-RADS/TI-RADS/RECIST/骨龄/心脏 CTA
          </div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={() => navigate("/critical-value-rule")}
            style={{
              padding: "5px 10px",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 4,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            规则配置
          </button>
          <button
            onClick={() => navigate("/critical-value-stats")}
            style={{
              padding: "5px 10px",
              border: "1px solid rgba(255,255,255,0.4)",
              borderRadius: 4,
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            统计大屏
          </button>
          <button
            onClick={() => navigate("/special-assessment?system=birads")}
            style={{
              padding: "5px 10px",
              border: "none",
              borderRadius: 4,
              background: "#fff",
              color: "#dc2626",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            8 大分类评估
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 4,
          }}
        >
          <ShieldAlert size={22} style={{ color: "#dc2626" }} />
          <h1
            style={{
              fontSize: 20,
              fontWeight: 800,
              color: "#1e40af",
              margin: 0,
            }}
          >
            危急值管理
          </h1>
          <span
            style={{
              fontSize: 12,
              color: "#fff",
              background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
              padding: "3px 10px",
              borderRadius: 10,
              fontWeight: 600,
            }}
          >
            v4.0 转随访+5节点闭环
          </span>
        </div>
        <p
          style={{ fontSize: 12, color: "#64748b", margin: 0, paddingLeft: 32 }}
        >
          危急值发现 · 即时预警 · 双环闭环 · 转随访管理 · 5节点追踪 ·
          全生命周期管理
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="待处理危急值"
          value={stats.pending}
          icon={Bell}
          color="#dc2626"
          bgColor="#fee2e2"
          trend={stats.pending > 0 ? "+" + stats.pending : undefined}
        />
        <StatCard
          label="处理中"
          value={stats.processing}
          icon={Clock}
          color="#d97706"
          bgColor="#fef3c7"
        />
        <StatCard
          label="已处理"
          value={stats.resolved}
          icon={CheckCircle}
          color="#059669"
          bgColor="#d1fae5"
          trend="+3"
        />
        <StatCard
          label="超时未处理"
          value={stats.overdue}
          icon={AlertTriangle}
          color="#991b1b"
          bgColor="#fecaca"
          trend={stats.overdue > 0 ? "+" + stats.overdue : undefined}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 16,
        }}
      >
        <StatCard
          label="本月新增危急值"
          value={stats.thisMonth}
          icon={TrendingUp}
          color="#1e40af"
          bgColor="#dbeafe"
        />
        <StatCard
          label="及时处理率"
          value={stats.timelyRate}
          icon={Target}
          color="#059669"
          bgColor="#d1fae5"
          suffix="%"
        />
        <StatCard
          label="已转随访数"
          value={stats.transferred}
          icon={ArrowUpRight}
          color="#7c3aed"
          bgColor="#f5f3ff"
        />
        <StatCard
          label="处理中超期数"
          value={stats.overdueProcessing}
          icon={Timer}
          color={stats.overdueProcessing > 0 ? "#dc2626" : "#059669"}
          bgColor={stats.overdueProcessing > 0 ? "#fef2f2" : "#d1fae5"}
        />
      </div>

      <BatchActionBar
        selectedCount={selectedIds.size}
        onAction={handleBatchAction}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: "acknowledge", label: "批量确认", icon: <CheckSquareIcon size={14} />, confirm: "确认批量确认?" },
          { key: "resolve", label: "批量处理", icon: <CheckCircle size={14} />, confirm: "确认批量处理?" },
        ]}
      />

      <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
        <div style={{ width: 280, flexShrink: 0 }}>
          <CriticalItemsDirectory />
        </div>

        <div
          style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <StatisticsCharts data={criticalValues} />

          <FilterBar
            search={search}
            setSearch={setSearch}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            modalityFilter={modalityFilter}
            setModalityFilter={setModalityFilter}
            severityFilter={severityFilter}
            setSeverityFilter={setSeverityFilter}
            timeRangeFilter={timeRangeFilter}
            setTimeRangeFilter={setTimeRangeFilter}
            dateRange={dateRange}
            setDateRange={setDateRange}
            onBatchNotify={handleBatchNotify}
            onBatchProcess={handleBatchProcess}
            selectedCount={selectedIds.size}
            onOpenSettings={() => setShowSettings(true)}
          />

          <CriticalValueList
            filtered={filtered}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onProcess={handleProcess}
            onViewDetail={handleViewDetail}
            onContactClinical={handleContactClinical}
            onTransferToFollowUp={handleTransferToFollowUp}
            criticalValues={criticalValues}
          />
        </div>

        {selectedCV && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 16,
              width: 480,
            }}
          >
            <ClosedLoopTracker5Nodes cv={selectedCV} />
            <DetailPanel
              cv={selectedCV}
              onClose={() => setSelectedCV(null)}
              activeTab={detailTab}
              setActiveTab={setDetailTab}
              mockFollowUpRecords={MOCK_FOLLOWUP_RECORDS}
            />
          </div>
        )}
      </div>

      {showSettings && (
        <RulesSettingsModal
          onClose={() => setShowSettings(false)}
          showToast={showToast}
        />
      )}

      {showTransferModal && transferCV && (
        <TransferToFollowUpModal
          cv={transferCV}
          onClose={() => {
            setShowTransferModal(false);
            setTransferCV(null);
          }}
          onConfirm={handleConfirmTransfer}
        />
      )}

      {showProcessModal && processCV && (
        <div
          onClick={() => {
            setShowProcessModal(false);
            setProcessCV(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="处理危急值"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "var(--z-modal, 500)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 500,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#d1fae5",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <CheckCircle size={20} style={{ color: "#059669" }} />
                <div>
                  <div
                    style={{ fontSize: 15, fontWeight: 800, color: "#059669" }}
                  >
                    处理危急值
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b" }}>
                    {processCV.id} · {processCV.patientName}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowProcessModal(false);
                  setProcessCV(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} style={{ color: "#64748b" }} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  危急值摘要
                </div>
                <div
                  style={{
                    background: "#fef2f2",
                    borderRadius: 8,
                    padding: 12,
                    border: "1px solid #fecaca",
                    fontSize: 13,
                    color: "#334155",
                  }}
                >
                  {processCV.findingDetails.substring(0, 100)}...
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  处理科室
                </div>
                <input
                  type="text"
                  defaultValue={processCV.receivingDepartment}
                  placeholder="请输入处理科室"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  处理措施
                </div>
                <textarea
                  placeholder="请输入处理措施..."
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{ fontSize: 12, color: "#94a3b8", marginBottom: 4 }}
                >
                  处理结果
                </div>
                <textarea
                  placeholder="请输入处理结果..."
                  rows={2}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowProcessModal(false);
                    setProcessCV(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={handleConfirmProcess}
                  style={{
                    flex: 1,
                    padding: "12px 20px",
                    borderRadius: 8,
                    border: "1px solid #059669",
                    background: "#059669",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  确认处理完成
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "success" ? "#059669" : "#dc2626",
            color: "#fff",
            padding: "12px 24px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: "var(--z-toast, 800)",
          }}
        >
          {toast.message}
        </div>
      )}

      {showNotifyModal && notifyCV && (
        <div
          onClick={() => {
            setShowNotifyModal(false);
            setNotifyCV(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-label="通知临床"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "var(--z-modal, 500)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 420,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Phone size={20} style={{ color: "#fff" }} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                    通知临床
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.8)" }}>
                    {notifyCV.patientName} ·{" "}
                    {notifyCV.receivingDoctorName || "待通知"}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowNotifyModal(false);
                  setNotifyCV(null);
                }}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.1)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <X size={16} style={{ color: "#fff" }} />
              </button>
            </div>
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  通知方式
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  {(
                    [
                      { value: "PHONE", label: "电话", icon: Phone },
                      { value: "SMS", label: "短信", icon: MessageSquare },
                      { value: "SYSTEM", label: "系统", icon: Bell },
                      { value: "EMAIL", label: "邮件", icon: Mail },
                      { value: "WECHAT", label: "微信", icon: Smartphone },
                      { value: "DINGTALK", label: "钉钉", icon: MessageCircle },
                    ] as {
                      value: NotificationMethod;
                      label: string;
                      icon: any;
                    }[]
                  ).map((opt) => {
                    const Icon = opt.icon;
                    const active = notifyMethod === opt.value;
                    return (
                      <button
                        key={opt.value}
                        onClick={() => setNotifyMethod(opt.value)}
                        style={{
                          padding: "10px 8px",
                          borderRadius: 8,
                          border:
                            "1px solid " + (active ? "#1e40af" : "#e2e8f0"),
                          background: active ? "#eff6ff" : "#fff",
                          color: active ? "#1e40af" : "#64748b",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                        }}
                      >
                        <Icon size={14} /> {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div style={{ marginBottom: 16 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  联系电话
                </div>
                <input
                  type="text"
                  value={notifyPhone}
                  onChange={(e) => setNotifyPhone(e.target.value)}
                  placeholder="请输入联系电话"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 6,
                  }}
                >
                  通知备注
                </div>
                <textarea
                  value={notifyNotes}
                  onChange={(e) => setNotifyNotes(e.target.value)}
                  placeholder="请输入通知备注（如特殊情况说明）"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    fontSize: 14,
                    outline: "none",
                    resize: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={() => {
                    setShowNotifyModal(false);
                    setNotifyCV(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                    color: "#64748b",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  取消
                </button>
                <button
                  onClick={handleConfirmNotify}
                  style={{
                    flex: 1,
                    padding: "10px 20px",
                    borderRadius: 8,
                    border: "1px solid #1e40af",
                    background: "#1e40af",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                >
                  <Phone size={14} /> 确认通知
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showConfirmModal && (
        <div
          onClick={() => setShowConfirmModal(false)}
          role="dialog"
          aria-modal="true"
          aria-label="确认操作"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: "var(--z-modal, 500)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 400,
              background: "#fff",
              borderRadius: 16,
              boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "20px 24px",
                borderBottom: "1px solid #e2e8f0",
                background: "#fffbeb",
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <AlertTriangle size={22} style={{ color: "#d97706" }} />
              <div>
                <div
                  style={{ fontSize: 15, fontWeight: 800, color: "#92400e" }}
                >
                  确认操作
                </div>
                <div style={{ fontSize: 12, color: "#92400e", marginTop: 2 }}>
                  {confirmMessage}
                </div>
              </div>
            </div>
            <div style={{ padding: 20, display: "flex", gap: 10 }}>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  color: "#64748b",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                style={{
                  flex: 1,
                  padding: "10px 20px",
                  borderRadius: 8,
                  border: "1px solid #1e3a5f",
                  background: "#1e3a5f",
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
