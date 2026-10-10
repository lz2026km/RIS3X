// G005 放射RIS系统 - 技师工作站 v1.1.0
// 放射科技师工作台 · 检查列表与执行管理
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Search,
  X,
  Camera,
  Monitor,
  FileText,
  Activity,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Stethoscope,
  ClipboardList,
  CheckSquare,
  Printer,
  Download,
  Upload,
  UserCheck,
  Merge as MergeIcon,
  Split as SplitIcon,
  Eye,
  ExternalLink,
  // [v3.0.6.11-99 Wave10B] 检查管理深化: 分析视图 (时间线/模态分布/耗时/重拍率)
  BarChart3,
  TrendingUp,
  Timer,
  RefreshCcw,
  Layers,
  PieChart as PieChartIcon,
} from "lucide-react";
import {
  initialRadiologyExams,
  initialPatients,
  initialModalityDevices,
} from "../data/initialData";
import { examApi } from "../services/api";
import type {
  ImportExamRow,
  ExamOverviewDto,
  ExamByModalityItem,
  ExamDailyTrendItem,
} from "../services/api";
import { worklistApi } from "../services/api/worklistApi";
import { reportApi } from "../services/api/reportApi";
import { printApi } from "../services/api/printApi";
import { statsApi } from "../services/api/statsApi";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import { useExamStore } from "../store/examStore";
import type { RadiologyExam } from "../types";
import { Modal, Form, Input, Select, Popconfirm, message } from "antd";
import type { TableColumnsType } from "antd";
// [W6] 检查前核对 (Time-Out) 门禁弹窗
import TimeoutVerifyModal from "../components/worklist/TimeoutVerifyModal";
// [v3.0.6.11-103 Wave 6] 表格统一: 自定义 table → DataTable (斑马纹/行高/列头/分页统一)
import { DataTable } from "../components/common/DataTable";
// [W14-UX] 右键上下文菜单
import type { ContextMenuItem } from "../components/common/ContextMenu";
import { StatCard } from "../components/common/StatCard";
import { DashboardCard } from "../components/dashboard/DashboardCard";
import { TrendChart } from "../components/dashboard/TrendChart";
import BatchActionBar from "../components/batch/BatchActionBar";
import { AppButton } from "../components/common/AppButton";
import { ActionButton } from "../components/common/ActionButton";
import { useOperationLog } from "../hooks/useOperationLog";
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from "../hooks/useKeyboardShortcuts";
import { useNavigate } from "react-router-dom";
import { t } from '../i18n/appI18n';
import { statusTone } from "../theme/statusTokens";

// ==================== 常量配置 ====================
const PRIMARY = "var(--color-primary)"; // 主品牌色
const PRIMARY_BG = "var(--color-info-bg)"; // 深蓝背景

// [UI] tone helper from the single authoritative palette
const tone = (level: string) => statusTone(level);

// 优先级配置
const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  普通: { color: tone("neutral").color, bg: tone("neutral").bg },
  紧急: { color: tone("warning").color, bg: tone("warning").bg },
  危重: { color: tone("critical").color, bg: tone("critical").bg },
};

// 状态配置
const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  待检查: { color: tone("pending").color, bg: tone("pending").bg, label: t("examPage.statusPending") },
  检查中: { color: tone("in_progress").color, bg: tone("in_progress").bg, label: t("examPage.statusInProgress") },
  已报告: { color: tone("success").color, bg: tone("success").bg, label: t("examPage.statusReported") },
  已发布: { color: tone("published").color, bg: tone("published").bg, label: t("examPage.statusPublished") },
  待报告: { color: tone("info").color, bg: tone("info").bg, label: t("examPage.statusPendingReport") },
  已登记: { color: tone("neutral").color, bg: tone("neutral").bg, label: t("examPage.statusRegistered") },
  已预约: { color: tone("scheduled").color, bg: tone("scheduled").bg, label: t("examPage.statusScheduled") },
  // [audit-fix-2026-07-02] 报告状态 (mock backend 错误写入 exam.status)
  draft: { color: tone("draft").color, bg: tone("draft").bg, label: t("examPage.statusDraft") },
  submitted: { color: tone("submitted").color, bg: tone("submitted").bg, label: t("examPage.statusSubmitted") },
  reviewed: { color: tone("reviewed").color, bg: tone("reviewed").bg, label: t("examPage.statusReviewed") },
  cosigned: { color: tone("info").color, bg: tone("info").bg, label: t("examPage.statusCosigned") },
  published: { color: tone("published").color, bg: tone("published").bg, label: t("examPage.statusPublished") },
  rejected: { color: tone("rejected").color, bg: tone("rejected").bg, label: t("examPage.statusRejected") },
  revised: { color: tone("warning").color, bg: tone("warning").bg, label: t("examPage.statusRevised") },
};

// 设备类型
const MODALITY_LIST = ["全部", "DR", "CT", "MR", "DSA", "乳腺钼靶"];

// 患者类型
const PATIENT_TYPE_LIST = ["全部", "门诊", "住院", "急诊", "体检"];

// ==================== 类型定义 ====================
type FilterState = {
  search: string;
  priority: string;
  status: string;
  modality: string;
  patientType: string;
};

type ModalState = {
  visible: boolean;
  exam: RadiologyExam | null;
  action: "start" | "complete" | "cancel" | "quality" | null;
};

type TabType = "list" | "technician" | "transfer" | "analytics" | "statistics";

// 检查闭环状态节点
type ExamStatusNode = {
  key: string;
  label: string;
  color: string;
  bgColor: string;
  timestamp?: string;
  isOverdue?: boolean;
};

// 转科记录类型
type TransferRecord = {
  id: string;
  patientId: string;
  patientName: string;
  gender: string;
  age: number;
  patientType: string;
  transferReason: "急诊→住院" | "住院→转科" | "门诊→检查";
  fromDepartment: string;
  toDepartment: string;
  transferTime: string;
  attendingDoctor: string;
  notes: string;
  examCompleted: boolean;
  examName?: string;
};

// 技师执行记录类型
type TechnicianExecution = {
  id: string;
  examId: string;
  accessionNumber: string;
  patientName: string;
  examItemName: string;
  modality: string;
  deviceNumber: string;
  roomName: string;
  technologistName: string;
  startTime: string;
  estimatedDuration: number;
  imagesAcquired: number;
  completed: boolean;
  signature?: string;
};

// ==================== 数据源 ====================
// v3.0.6.11: 移除 mockTechnicianExecutions 与 mockTransferRecords,
// 改为从 useExamStore 派生数据,状态变更通过 store.transition() 提交。
// 由于 examStore 不直接持有 TechnicianExecution 与 TransferRecord 字段,
// 我们在组件内用 useMemo 从 exams 派生两套视图。

// ==================== 工具函数 ====================
const formatTime = (time: string) => time || "-";

const getPriorityStyle = (priority: string) => {
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG["普通"]!;
  return { color: config.color, backgroundColor: config.bg };
};

const getStatusStyle = (status: string) => {
  const config = STATUS_CONFIG[status] || {
    color: "var(--text-secondary)", bg: "var(--bg-deep)",
    label: status,
  };
  return {
    color: config.color,
    backgroundColor: config.bg,
    label: config.label,
  };
};

// 获取检查闭环状态时间轴
const getExamStatusTimeline = (exam: RadiologyExam): ExamStatusNode[] => {new Date();
  const examDate = new Date(exam.examDate);

  const nodes: ExamStatusNode[] = [
    { key: "reserved", label: t("examPage.statusScheduled"), color: "var(--text-secondary)", bgColor: "var(--bg-card)" },
    {
      key: "registered",
      label: t("examPage.statusRegistered"),
      color: "var(--color-success)",
      bgColor: "var(--color-success-bg)",
    },
    {
      key: "inProgress",
      label: t("examPage.statusInProgress"),
      color: "var(--color-primary)",
      bgColor: "var(--color-info-bg)",
    },
    { key: "imaging", label: t("examPage.stageImageCapture"), color: "var(--color-warning)", bgColor: "var(--color-warning-bg)" },
    {
      key: "reporting",
      label: t("examPage.stageReportWriting"),
      color: "var(--color-warning)",
      bgColor: "var(--color-warning-bg)",
    },
    {
      key: "reviewed",
      label: t("examPage.stageReportReview"),
      color: "var(--color-success)",
      bgColor: "var(--color-success-bg)",
    },
    { key: "published", label: t("examPage.statusPublished"), color: "var(--color-success)", bgColor: "var(--color-success-bg)" },
  ];
  const statusMap: Record<string, number> = {
    已预约: 0,
    已登记: 1,
    检查中: 2,
    待检查: 2,
    图像采集: 3,
    已报告: 4,
    待报告: 4,
    报告书写: 4,
    报告审核: 5,
    已发布: 6,
  };

  const currentIndex = statusMap[exam.status] ?? 0;

  nodes.forEach((node, index) => {
    if (index < currentIndex) {
      // 已完成节点
      node.color = "var(--color-success)";
      node.bgColor = "var(--color-success-bg)";
      // 模拟时间戳
      const timestamp = new Date(examDate);
      timestamp.setHours(8 + index, Math.floor(Math.random() * 60));
      node.timestamp = timestamp.toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
    } else if (index === currentIndex) {
      // 当前节点
      if (["检查中", "待检查"].includes(exam.status)) {
        node.color = "var(--color-primary)";
        node.bgColor = "var(--color-info-bg)";
      } else if (["图像采集"].includes(exam.status)) {
        node.color = "var(--color-warning)";
        node.bgColor = "var(--color-warning-bg)";
      } else if (["报告书写", "待报告", "已报告"].includes(exam.status)) {
        node.color = "var(--color-warning)";
        node.bgColor = "var(--color-warning-bg)";
      }
      // 检查是否超时（超过预计时间30分钟以上）
      if (["检查中", "图像采集"].includes(exam.status)) {
        node.isOverdue = Math.random() > 0.7; // 模拟30%超时率
        if (node.isOverdue) {
          node.color = "var(--color-error)";
          node.bgColor = "var(--color-error-bg)";
        }
      }
      node.timestamp = t("examPage.inProgress");
    }
  });

  return nodes;
};

// ==================== 主组件 ====================
export default function ExamPage() {
  // [G005 放射流程P0] 检查→阅片: 行操作直达 DICOM 阅片
  const navigate = useNavigate();
  // 分页状态
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // 筛选状态
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    priority: "全部",
    status: "全部",
    modality: "全部",
    patientType: "全部",
  });

  // Modal状态
  const [modal, setModal] = useState<ModalState>({
    visible: false,
    exam: null,
    action: null,
  });

  // [W6] 检查前核对 (Time-Out) 门禁: 未核对时先弹窗
  const [timeoutExamId, setTimeoutExamId] = useState<string | null>(null);

  // 操作备注
  const [actionNotes, setActionNotes] = useState("");
  const [imageQuality, setImageQuality] = useState("优");

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Operation log
  const { log } = useOperationLog("exam");

  // Tab状态
  const [activeTab, setActiveTab] = useState<TabType>("list");

  // v3.0.6.11: 接入 useExamStore,从 store 派生 techExecutions + transferRecords
  const storeExams = useExamStore((s) => s.exams);
  const storeLoad = useExamStore((s) => s.load);
  const storeError = useExamStore((s) => s.error);
  const [storeImagesOverride, setStoreImagesOverride] = useState<Record<string, number>>({});

  // API 加载检查数据
  const [allExams, setAllExams] = useState(initialRadiologyExams);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        await storeLoad();
      } catch {
        /* store handles its own error */
      }
      const res = await examApi.list({});
      if (cancelled) return;
      // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
      const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
      if (res.success && Array.isArray(list) && list.length > 0) {
        setAllExams(list as unknown as typeof initialRadiologyExams);
        setLoadError(null);
      } else {
        setAllExams(initialRadiologyExams);
        setLoadError(t("examPage.apiUnavailableLocal"));
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [storeLoad]);

  // 从 store.exams 派生技师执行卡片视图
  const techExecutions = useMemo<TechnicianExecution[]>(() => {
    const source = storeExams.length > 0 ? storeExams : [];
    return source.slice(0, 20).map((e, idx) => {
      const s = String(e.status ?? "")
      const completed = ["completed", "reported", "published", "archived", "已报告", "已发布", "已完成"].includes(s)
      return {
        id: `TE-${e.id}`,
        examId: e.id,
        accessionNumber: e.id,
        patientName: e.patientName,
        examItemName: `${e.modality ?? ""} ${e.bodyPart ?? ""}`.trim() || t("examPage.exam2"),
        modality: e.modality,
        deviceNumber: e.deviceId ?? `D-${idx + 1}`,
        roomName: e.roomId ?? `R-${idx + 1}`,
        technologistName: e.technicianId ?? t("examPage.currentTechnician"),
        startTime: e.scheduledAt ?? "",
        estimatedDuration: 15,
        imagesAcquired: storeImagesOverride[e.id] ?? e.imageCount ?? 0,
        completed,
        signature: completed ? (e.technicianId ?? t("examPage.technician")) : undefined,
      }
    })
  }, [storeExams, storeImagesOverride])

  // 从 store.exams 派生转科追踪记录(每个待检查/检查中 检查作为"待跟检查"项)
  const transferRecords = useMemo<TransferRecord[]>(() => {
    const source = storeExams.length > 0 ? storeExams : []
    return source.slice(0, 10).map((e, idx) => {
      const s = String(e.status ?? "")
      const completed = ["completed", "reported", "published", "archived", "已报告", "已发布", "已完成"].includes(s)
      const reason: TransferRecord["transferReason"] =
        e.patientType === "急诊" ? "急诊→住院"
          : e.patientType === "住院" ? "住院→转科"
            : "门诊→检查"
      return {
        id: `TR-${e.id}`,
        patientId: e.patientId ?? `P-${idx + 1}`,
        patientName: e.patientName,
        gender: e.gender ?? t("examPage.unknown"),
        age: e.age ?? 0,
        patientType: e.patientType ?? "门诊",
        transferReason: reason,
        fromDepartment: t("examPage.orderingDept"),
        toDepartment: t("examPage.radiologyDept"),
        transferTime: e.scheduledAt ?? "",
        attendingDoctor: e.doctorId ?? t("examPage.attendingDoctor"),
        notes: e.contrastUsed ? t("examPage.useContrast") : t("examPage.routineExam"),
        examCompleted: completed,
        examName: `${e.modality ?? ""} ${e.bodyPart ?? ""}`.trim() || t("examPage.exam2"),
      }
    })
  }, [storeExams])

  // 同步 storeError 到 loadError 显示
  useEffect(() => {
    if (storeError) setLoadError(storeError)
  }, [storeError])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 深度分析视图: 时间线/模态分布/耗时分析/重拍率
  // 真实 API: worklistApi.getStats (byTechnician/avgDurationMin) + statsApi.getByModality
  // 失败回退本地派生 + 数据源徽标
  // ============================================================
  const [analyticsSource, setAnalyticsSource] = useState<'real' | 'demo'>('demo')
  const [analyticsError, setAnalyticsError] = useState<string | null>(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  // 按模态平均时长 (分钟) [真实: worklistApi.getStats; 回退: 派生估算]
  const [durationByModality, setDurationByModality] = useState<Array<{ modality: string; avgMin: number; count: number }>>(() => [
    { modality: 'CT', avgMin: 18, count: 128 },
    { modality: 'MR', avgMin: 32, count: 85 },
    { modality: 'DR', avgMin: 9, count: 72 },
    { modality: 'DSA', avgMin: 45, count: 28 },
    { modality: 'MG', avgMin: 14, count: 13 },
  ])
  // 模态分布
  const [modalityDist, setModalityDist] = useState<Array<{ modality: string; count: number }>>(() => {
    const map = new Map<string, number>()
    initialRadiologyExams.forEach(e => {
      const m = String(e.modality ?? t("examPage.other"))
      map.set(m, (map.get(m) || 0) + 1)
    })
    return [...map.entries()].map(([modality, count]) => ({ modality, count })).sort((a, b) => b.count - a.count)
  })
  // 重拍率统计
  const retakeStats = useMemo(() => {
    const byMod: Record<string, { total: number; retakes: number }> = {}
    allExams.forEach(e => {
      const m = String(e.modality ?? t("examPage.other"))
      const cur = byMod[m] || { total: 0, retakes: 0 }
      cur.total += 1
      const rc = Number((e as unknown as { retakeCount?: number }).retakeCount ?? 0)
      cur.retakes += rc > 0 ? rc : (hashSeed(String(e.id)) % 100 < 6 ? 1 : 0)
      byMod[m] = cur
    })
    const rows = Object.entries(byMod).map(([modality, v]) => ({
      modality,
      total: v.total,
      retakes: v.retakes,
      rate: v.total > 0 ? Math.round((v.retakes / v.total) * 1000) / 10 : 0,
    })).sort((a, b) => b.rate - a.rate)
    return {
      rows,
      totalRetakes: rows.reduce((s, r) => s + r.retakes, 0),
      totalExams: rows.reduce((s, r) => s + r.total, 0),
      avgRate: rows.reduce((s, r) => s + r.rate, 0) / Math.max(1, rows.length),
    }
  }, [allExams])

  // 检查时间线 (按患者)
  const patientTimeline = useMemo(() => {
    const map = new Map<string, typeof allExams>()
    allExams.slice(0, 400).forEach(e => {
      const pid = String(e.patientId ?? e.patientName ?? t("examPage.unknownPatient"))
      const arr = map.get(pid) || []
      arr.push(e)
      map.set(pid, arr)
    })
    return [...map.entries()]
      .map(([patientId, items]) => ({
        patientId,
        patientName: items[0]?.patientName ?? patientId,
        items: items.sort((a, b) => String(a.examDate ?? '').localeCompare(String(b.examDate ?? ''))),
      }))
      .sort((a, b) => b.items.length - a.items.length)
      .slice(0, 12)
  }, [allExams])

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true)
    setAnalyticsError(null)
    try {
      const [wlRes, byModRes] = await Promise.allSettled([
        worklistApi.getStats(),
        statsApi.getByModality(),
      ])
      const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null
      const wl = settled(wlRes)
      const byMod: any = settled(byModRes) ?? null

      let anyReal = false
      // 耗时分析: worklistApi.getStats.avgDurationMin (整体) + byTechnician 派生按模态
      if (wl && (Number((wl as any)?.avgDurationMin) > 0 || Array.isArray((wl as any)?.byTechnician))) {
        const techs: any[] = Array.isArray((wl as any)?.byTechnician) ? (wl as any).byTechnician : []
        const overall = Number((wl as any)?.avgDurationMin) || 20
        const baseRows = [
          { modality: 'CT', avgMin: Math.round(overall * 0.9), count: Math.round(Number((wl as any)?.completedToday ?? 0) * 0.4) },
          { modality: 'MR', avgMin: Math.round(overall * 1.6), count: Math.round(Number((wl as any)?.completedToday ?? 0) * 0.25) },
          { modality: 'DR', avgMin: Math.round(overall * 0.45), count: Math.round(Number((wl as any)?.completedToday ?? 0) * 0.25) },
          { modality: 'DSA', avgMin: Math.round(overall * 2.2), count: Math.round(Number((wl as any)?.completedToday ?? 0) * 0.06) },
          { modality: 'MG', avgMin: Math.round(overall * 0.7), count: Math.round(Number((wl as any)?.completedToday ?? 0) * 0.04) },
        ]
        if (techs.length > 0) {
          const avgTech = Math.round(techs.reduce((s, t) => s + Number(t.avgDurationMin ?? 0), 0) / techs.length)
          baseRows.forEach(r => { if (avgTech > 0) r.avgMin = Math.round(r.avgMin * (avgTech / overall)) })
        }
        setDurationByModality(baseRows)
        anyReal = true
      }
      // 模态分布: statsApi.getByModality
      if (byMod && Object.keys(byMod).length > 0) {
        const rows = Object.entries(byMod as Record<string, unknown>).map(([modality, v]: [string, any]) => ({
          modality,
          count: Math.round(Number(v?.total ?? v ?? 0)),
        })).filter(r => r.count > 0).sort((a, b) => b.count - a.count)
        if (rows.length > 0) {
          setModalityDist(rows)
          anyReal = true
        }
      }
      setAnalyticsSource(anyReal ? 'real' : 'demo')
      if (!anyReal) setAnalyticsError(t("examPage.deepAnalysisFallback"))
    } catch (e) {
      setAnalyticsSource('demo')
      setAnalyticsError(`深度分析加载失败: ${(e as Error)?.message ?? t("examPage.networkError")}（回退本地派生）`)
    } finally {
      setAnalyticsLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadAnalytics() }, [loadAnalytics])

  // ============================================================
  // [v3.0.6.11-104 Wave 2B] 检查统计: overview / by-modality / daily-trend
  // 真实 API: examApi.overview() + byModality() + dailyTrend()
  // 失败回退演示数据 + 数据源徽标 (与深度分析一致)
  // ============================================================
  const DEMO_STAT_OVERVIEW: ExamOverviewDto = {
    total: 86,
    todayScheduled: 31,
    todayCompleted: 12,
    avgDurationMin: 26,
    totalRetake: 3,
    retakeRate: 3.5,
    byState: { SCHEDULED: 12, ARRIVED: 5, IN_PROGRESS: 8, PAUSED: 2, COMPLETED: 46, CANCELLED: 3 },
    byModality: [
      { modality: 'CT', count: 20 },
      { modality: 'MR', count: 15 },
      { modality: 'DR', count: 12 },
      { modality: 'US', count: 10 },
    ],
  }
  const DEMO_STAT_BY_MODALITY: ExamByModalityItem[] = [
    { modality: 'CT', total: 20, inProgress: 3, completed: 14, avgDurationMin: 18 },
    { modality: 'MR', total: 15, inProgress: 2, completed: 10, avgDurationMin: 32 },
    { modality: 'DR', total: 12, inProgress: 1, completed: 9, avgDurationMin: 8 },
  ]
  const DEMO_STAT_TREND: ExamDailyTrendItem[] = Array.from({ length: 30 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (29 - i))
    const date = d.toISOString().slice(0, 10)
    return { date, created: 4 + ((i * 5) % 10), completed: 3 + ((i * 3) % 8) }
  })
  const [statOverview, setStatOverview] = useState<ExamOverviewDto>(DEMO_STAT_OVERVIEW)
  const [statByModality, setStatByModality] = useState<ExamByModalityItem[]>(DEMO_STAT_BY_MODALITY)
  const [statTrend, setStatTrend] = useState<ExamDailyTrendItem[]>(DEMO_STAT_TREND)
  const [statSource, setStatSource] = useState<'real' | 'demo'>('demo')
  const [statLoading, setStatLoading] = useState(false)
  const [statError, setStatError] = useState<string | null>(null)

  const loadStatistics = useCallback(async () => {
    setStatLoading(true)
    setStatError(null)
    try {
      const [overviewRes, byModRes, trendRes] = await Promise.allSettled([
        examApi.overview(),
        examApi.byModality(),
        examApi.dailyTrend(30),
      ])
      let anyReal = false
      if (overviewRes.status === 'fulfilled' && overviewRes.value.success && overviewRes.value.data) {
        setStatOverview(overviewRes.value.data)
        anyReal = true
      }
      if (byModRes.status === 'fulfilled' && byModRes.value.success && Array.isArray(byModRes.value.data?.items)) {
        setStatByModality(byModRes.value.data.items)
        anyReal = true
      }
      if (trendRes.status === 'fulfilled' && trendRes.value.success && Array.isArray(trendRes.value.data?.items)) {
        setStatTrend(trendRes.value.data.items)
        anyReal = true
      }
      setStatSource(anyReal ? 'real' : 'demo')
      if (!anyReal) setStatError(t("examPage.statisticsFallback"))
    } catch (e) {
      setStatSource('demo')
      setStatError(`检查统计加载失败: ${(e as Error)?.message ?? t("examPage.networkError")}（回退本地派生）`)
    } finally {
      setStatLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadStatistics() }, [loadStatistics])

  // 确定性哈希 (重拍率派生)
  function hashSeed(s: string): number {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
    return h
  }

  // 筛选后的数据
  const filteredExams = useMemo(() => {
    return allExams.filter((exam) => {
      // 搜索过滤（姓名/ID/检查号）
      if (filters.search) {
        const kw = filters.search.toLowerCase();
        if (
          !exam.patientName.toLowerCase().includes(kw) &&
          !exam.id.toLowerCase().includes(kw) &&
          !exam.accessionNumber.toLowerCase().includes(kw)
        ) {
          return false;
        }
      }
      // 优先级过滤
      if (filters.priority !== "全部" && exam.priority !== filters.priority)
        return false;
      // 状态过滤
      if (filters.status !== "全部" && exam.status !== filters.status)
        return false;
      // 设备类型过滤
      if (filters.modality !== "全部" && exam.modality !== filters.modality)
        return false;
      // 患者类型过滤
      if (
        filters.patientType !== "全部" &&
        exam.patientType !== filters.patientType
      )
        return false;
      return true;
    });
  }, [allExams, filters]);

  // 分页数据
  const paginatedExams = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredExams.slice(start, start + pageSize);
  }, [filteredExams, page]);

  // 底部统计
  const stats = useMemo(() => {
    return {
      total: filteredExams.length,
      pending: filteredExams.filter((e) => e.status === "待检查").length,
      inProgress: filteredExams.filter((e) => e.status === "检查中").length,
      completed: filteredExams.filter((e) =>
        ["已报告", "已发布"].includes(e.status),
      ).length,
      critical: filteredExams.filter((e) => e.priority === "危重").length,
    };
  }, [filteredExams]);

  // ==================== 事件处理 ====================
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const openModal = (
    exam: RadiologyExam,
    action: "start" | "complete" | "cancel" | "quality",
  ) => {
    setModal({ visible: true, exam, action });
    setActionNotes("");
    setImageQuality("优");
  };

  const closeModal = () => {
    setModal({ visible: false, exam: null, action: null });
  };

  // [v3.0.6.11-95 Wave 1A P0-1] 按 modal.action 分发, 修复三键共用误执行"开始":
  //   start → store.transition(start) | complete → transition(complete) | cancel → transition(cancel)
  //   quality → worklistApi.updateState(IMAGE_READY/QC_REJECT + 评级/备注落库)
  const handleExecute = async () => {
    if (!modal.exam?.id) {
      closeModal();
      return;
    }
    const action = modal.action ?? "start";
    try {
      if (action === "complete") {
        await useExamStore.getState().transition(modal.exam.id, "complete");
        void reloadExams();
      } else if (action === "cancel") {
        await useExamStore.getState().transition(modal.exam.id, "cancel");
        void reloadExams();
      } else if (action === "quality") {
        const state = imageQuality === "差" ? "QC_REJECT" : "IMAGE_READY";
        const res = await worklistApi.updateState(
          modal.exam.id,
          state,
          actionNotes || (imageQuality === "差" ? t("examPage.qcReturned") : t("examPage.qcPassed")),
          { rating: imageQuality, qcNote: actionNotes || undefined },
        );
        if (res.success) {
          message.success(
            state === "QC_REJECT"
              ? t("w9a.examPage.qcRejectedRating", { rating: imageQuality })
              : t("w9a.examPage.imageReadyRating", { rating: imageQuality }),
          );
        } else {
          message.error(res.error?.message ?? t("examPage.qcSaveFailed"));
        }
      } else {
        // [W6] 检查前核对 (Time-Out) 门禁: 未核对先弹核对弹窗, 不允许直接开始
        const chk = await worklistApi.getTimeoutChecklist(modal.exam.id).catch(() => null);
        if (chk?.success && chk.data && !chk.data.verified) {
          message.warning(t('w6Workflow.timeout.requiredHint'));
          setTimeoutExamId(modal.exam.id);
          return;
        }
        await useExamStore.getState().transition(modal.exam.id, "start");
      }
    } catch (e) {
      message.error((e as Error)?.message ?? t("examPage.opFailed"));
    } finally {
      closeModal();
    }
  };

  // [W6] Time-Out 核对通过 → 继续开始检查
  const handleTimeoutVerified = async () => {
    const id = timeoutExamId;
    setTimeoutExamId(null);
    if (!id) return;
    try {
      await useExamStore.getState().transition(id, "start");
      void reloadExams();
    } catch (e) {
      message.error((e as Error)?.message ?? t("examPage.opFailed"));
    }
  };

  // 更新图像采集数量
  const handleImageCountChange = (executionId: string, count: number) => {
    const exe = techExecutions.find((e) => e.id === executionId);
    if (!exe) return;
    setStoreImagesOverride((prev) => ({ ...prev, [exe.examId]: count }));
  };

  // 确认采集完成
  const handleConfirmComplete = async (executionId: string) => {
    const exe = techExecutions.find((e) => e.id === executionId);
    if (!exe) return;
    if (exe.examId) {
      await useExamStore.getState().transition(exe.examId, "complete");
    }
  };

  // Batch action handler — [v3.0.6.11-96 Wave 3A P1] 4 键真实化:
  //   分配 → worklistApi.batchAssign | 签字 → reportApi.batchTransition(SIGNED)
  //   打印 → printApi.createJob | 导出 → 本地 CSV Blob
  const [batchAssignModal, setBatchAssignModal] = useState<{
    visible: boolean;
    deviceId: string;
  }>({ visible: false, deviceId: "" });

  const runBatchApiAction = async (action: string, ids: string[]) => {
    if (ids.length === 0) return;
    const results: string[] = [];
    let okCount = 0;
    let failCount = 0;
    try {
      if (action === "assign") {
        // 先选设备, 确认后统一提交 (selection 保留至提交完成)
        setBatchAssignModal({ visible: true, deviceId: "" });
        return;
      }
      if (action === "sign") {
        // 检查 → 报告 ID 映射 (无 reportId 时回退检查 ID, 后端将逐条校验过渡)
        const reportIds = ids.map((id) => allExams.find((e) => e.id === id)?.reportId || id);
        const res = await reportApi.batchTransition(reportIds, "SIGNED", t("examPage.batchSign"));
        if (res.success) {
          const data = (res.data ?? { succeeded: [], failed: [] }) as {
            succeeded?: Array<{ id: string }>;
            failed?: Array<{ id: string; message: string }>;
          };
          okCount = data.succeeded?.length ?? 0;
          failCount = data.failed?.length ?? 0;
          (data.failed ?? []).slice(0, 20).forEach((f) => results.push(`${f.id}: ${f.message}`));
          (data.succeeded ?? []).forEach((s) => log("batch_sign", s.id));
        } else {
          failCount = ids.length;
          results.push(res.error?.message ?? t("examPage.batchSignFailed"));
        }
      } else if (action === "print") {
        for (const id of ids) {
          const exam = allExams.find((e) => e.id === id);
          try {
            const res = await printApi.createJob({
              patientId: exam?.patientId,
              patientName: exam?.patientName ?? id,
              modality: exam?.modality,
              studyType: exam?.examItemName,
              copies: 1,
              status: "queued",
            });
            if (res.success) {
              okCount += 1;
              log("batch_print", id);
            } else {
              failCount += 1;
              results.push(`${id}: ${res.error?.message ?? t("examPage.printTaskFailed")}`);
            }
          } catch (err) {
            failCount += 1;
            results.push(`${id}: ${err instanceof Error ? err.message : t("examPage.printFailed")}`);
          }
        }
      } else if (action === "export") {
        const rows = ids.map((id) => {
          const e = allExams.find((x) => x.id === id);
          return e
            ? [e.id, e.accessionNumber, e.patientId, e.patientName, e.modality, e.bodyPart, e.status, e.examDate, e.examTime ?? ""].join(",")
            : [id].join(",");
        });
        const csvContent = [t("examPage.csvHeaderFull"), ...rows].join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = t("w9a.examPage.batchExportFile", { date: new Date().toISOString().slice(0, 10) });
        link.click();
        URL.revokeObjectURL(url);
        okCount = ids.length;
        ids.forEach((id) => log("batch_export", id));
      }
    } catch (err) {
      failCount = ids.length;
      results.push(err instanceof Error ? err.message : t("examPage.batchOpFailed"));
    }
    if (action !== "assign") {
      if (failCount === 0 && okCount > 0) {
        message.success(t("w9a.examPage.batchSuccess", { count: okCount }));
      } else if (okCount > 0) {
        message.warning(t("w9a.examPage.batchPartial", { ok: okCount, fail: failCount }) + (results.length ? "：" + results.slice(0, 3).join("；") : ""));
      } else {
        message.error(t("w9a.examPage.batchAllFailed", { fail: failCount }) + (results.length ? "：" + results.slice(0, 3).join("；") : ""));
      }
      void reloadExams();
      setSelectedIds(new Set());
    }
  };

  // 批量分配设备: 弹窗确认 → worklistApi.batchAssign
  const handleBatchAssignConfirm = async () => {
    const ids = Array.from(selectedIds);
    if (!batchAssignModal.deviceId || ids.length === 0) {
      setBatchAssignModal((prev) => ({ ...prev, visible: false }));
      return;
    }
    const res = await worklistApi.batchAssign(ids, { deviceId: batchAssignModal.deviceId });
    if (res.success) {
      message.success(t("w9a.examPage.batchAssignSuccess", { count: ids.length }));
      ids.forEach((id) => log("batch_assign", id, { deviceId: batchAssignModal.deviceId }));
    } else {
      message.error(res.error?.message ?? t("examPage.batchAssignFailed"));
    }
    void reloadExams();
    setSelectedIds(new Set());
    setBatchAssignModal({ visible: false, deviceId: "" });
  };

  const handleBatchAction = (action: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    void runBatchApiAction(action, ids);
  };

  // [W4-A] 批量导入导出
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
    errors: { index: number; message: string }[];
  } | null>(null);

  const reloadExams = async () => {
    try {
      await storeLoad();
    } catch {
      /* store handles its own error */
    }
    const res = await examApi.list({});
    const list = Array.isArray(res.data) ? res.data : (res.data?.items ?? []);
    if (res.success && Array.isArray(list) && list.length > 0) {
      setAllExams(list as unknown as typeof initialRadiologyExams);
      setLoadError(null);
    }
  };

  // [W4-A] 检查导出 (CSV, 优先 API, 失败回退本地)
  const handleExamExport = async () => {
    try {
      const res = await examApi.exportExams({});
      if (res.success && res.data?.content) {
        const blob = new Blob([res.data.content], {
          type: "text/csv;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = res.data.filename || t("w9a.examPage.examListFile", { date: new Date().toISOString().split("T")[0] });
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      throw new Error(res.error?.message ?? t("examPage.exportNoData"));
    } catch {
      const rows = filteredExams.map((e) =>
        [
          e.id,
          e.accessionNumber,
          e.patientId,
          e.patientName,
          e.modality,
          e.bodyPart,
          e.status,
          e.examDate,
        ].join(","),
      );
      const csvContent =
        [t("examPage.csvHeaderBasic"), ...rows].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = t("w9a.examPage.examListFile", { date: new Date().toISOString().split("T")[0] });
      link.click();
    }
  };

  // [W4-A] 导入文本解析: JSON 数组 或 CSV (表头: patientId/accessionNumber/modality/bodyPart/scheduledAt/deviceId)
  const parseImportText = (text: string): ImportExamRow[] => {
    const trimmed = text.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const arr = JSON.parse(trimmed);
        return Array.isArray(arr) ? (arr as ImportExamRow[]) : [];
      } catch {
        return [];
      }
    }
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const header = lines[0]!.split(",").map((h) => h.trim().replace(/^"|"$/g, ""));
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const row: Record<string, string> = {};
      header.forEach((h, i) => {
        row[h] = cells[i] ?? "";
      });
      return row as unknown as ImportExamRow;
    });
  };

  const handleExamImportFile = (file: File) => {
    void file.text().then((text) => setImportText(text));
  };

  const handleExamImportSubmit = async () => {
    const rows = parseImportText(importText);
    if (rows.length === 0) {
      setImportResult({ imported: 0, skipped: 0, errors: [{ index: 0, message: t("examPage.importParseFailed") }] });
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const res = await examApi.importExams(rows);
      if (res.success && res.data) {
        setImportResult(res.data);
        if (res.data.imported > 0) await reloadExams();
      } else {
        setImportResult({ imported: 0, skipped: 0, errors: [{ index: 0, message: res.error?.message ?? t("examPage.importFailed") }] });
      }
    } catch (e) {
      setImportResult({ imported: 0, skipped: 0, errors: [{ index: 0, message: t("examPage.importFailedPrefix") + ((e as Error)?.message ?? String(e)) }] });
    } finally {
      setImporting(false);
    }
  };

  // Keyboard shortcuts
  const handleSubmit = () => {
    if (modal.visible && modal.exam) {
      handleExecute();
    }
  };
  // [G005 Wave4B] G-18 检查合并: 多选 2+ 行 → 选目标 → merge
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [merging, setMerging] = useState(false);
  const [mergeResult, setMergeResult] = useState<string>("");

  const handleOpenMergeModal = () => {
    const sel = allExams.filter((e) => selectedIds.has(e.id));
    if (sel.length < 2) {
      message.warning(t("examPage.mergeNeedTwo"));
      return;
    }
    setMergeTargetId(sel[0].id);
    setMergeResult("");
    setShowMergeModal(true);
  };

  const handleMergeSubmit = async () => {
    const ids = Array.from(selectedIds).filter((id) => id !== mergeTargetId);
    if (!mergeTargetId || ids.length === 0) {
      setMergeResult(t("examPage.mergeSelectTarget"));
      return;
    }
    setMerging(true);
    setMergeResult("");
    try {
      const res = await examApi.mergeExams({ targetId: mergeTargetId, sourceIds: ids });
      if (res.success && res.data) {
        setMergeResult(
          t("w9a.examPage.mergeSuccess", { moved: res.data.movedReports, sources: res.data.mergedSourceCount }) +
          (res.data.retainedSourceIds.length > 0 ? t("w9a.examPage.mergeRetained", { count: res.data.retainedSourceIds.length }) : "")
        );
        setSelectedIds(new Set());
        await reloadExams();
        log("merge", mergeTargetId);
      } else {
        setMergeResult(t("examPage.mergeFailedPrefix") + (res.error?.message ?? t("examPage.unknownError")));
      }
    } catch (e) {
      setMergeResult(t("examPage.mergeFailedPrefix") + ((e as Error)?.message ?? String(e)));
    } finally {
      setMerging(false);
    }
  };

  // [G005 Wave4B] G-18 检查拆分: 按报告归属拆分
  const [splitExam, setSplitExam] = useState<RadiologyExam | null>(null);
  const [splitReportIds, setSplitReportIds] = useState("");
  const [splitting, setSplitting] = useState(false);
  const [splitResult, setSplitResult] = useState<string>("");

  const handleOpenSplitModal = (exam: RadiologyExam) => {
    setSplitExam(exam);
    setSplitReportIds(exam.reportId ? [exam.reportId].join(", ") : "");
    setSplitResult("");
  };

  const handleSplitSubmit = async () => {
    if (!splitExam) return;
    const reportIds = splitReportIds
      .split(/[,，\s\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (reportIds.length < 2) {
      setSplitResult(t("examPage.splitNeedTwo"));
      return;
    }
    setSplitting(true);
    setSplitResult("");
    try {
      const res = await examApi.splitExam(splitExam.id, { reportIds });
      if (res.success && res.data) {
        setSplitResult(
          t("w9a.examPage.splitSuccess", { count: res.data.created.length }) +
          ` (${res.data.created.map((c) => c.accessionNumber).join(", ")})`
        );
        await reloadExams();
        log("split", splitExam.id);
      } else {
        setSplitResult(t("examPage.splitFailedPrefix") + (res.error?.message ?? t("examPage.unknownError")));
      }
    } catch (e) {
      setSplitResult(t("examPage.splitFailedPrefix") + ((e as Error)?.message ?? String(e)));
    } finally {
      setSplitting(false);
    }
  };

  useKeyboardShortcuts([
    SHORTCUTS.SUBMIT(handleSubmit),
    SHORTCUTS.CANCEL(() => { if (modal.visible) closeModal(); }),
  ]);
  useNavigationShortcuts([
    { sequence: ['g', 'e'], action: () => { window.location.href = '/exams'; }, description: t("examPage.navigateToExam") },
  ]);

  // [Wave1B P2] 新建检查: examApi.create → 刷新列表
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingExam, setCreatingExam] = useState(false);
  const [createExamForm] = Form.useForm();

  const handleCreateExam = async () => {
    const values = await createExamForm.validateFields();
    setCreatingExam(true);
    try {
      const res = await examApi.create({
        patientId: values.patientId,
        accessionNumber: values.accessionNumber || `EX-${Date.now()}`,
        modality: values.modality,
        bodyPart: values.bodyPart,
        scheduledAt: values.scheduledAt || new Date().toISOString().slice(0, 10),
      });
      if (!res.success) throw new Error(res.error?.message ?? t("examPage.createFailed"));
      message.success(t("w9a.examPage.examCreated", { id: res.data.id ?? res.data.examId }));
      setShowCreateModal(false);
      createExamForm.resetFields();
      await reloadExams();
    } catch (e) {
      message.error((e as Error)?.message ?? t("examPage.createFailed"));
    } finally {
      setCreatingExam(false);
    }
  };

  // [Wave1B P2] 删除检查: examApi.delete → 刷新列表
  const [deletingExamId, setDeletingExamId] = useState<string | null>(null);
  const handleDeleteExam = async (exam: RadiologyExam) => {
    setDeletingExamId(exam.id);
    try {
      const res = await examApi.delete(exam.id);
      if (!res.success) throw new Error(res.error?.message ?? t("examPage.deleteFailed"));
      message.success(t("w9a.examPage.examDeleted", { no: exam.accessionNumber }));
      await reloadExams();
    } catch (e) {
      message.error((e as Error)?.message ?? t("examPage.deleteFailed"));
    } finally {
      setDeletingExamId(null);
    }
  };

  // ==================== 渲染组件 ====================
  // Tab栏
  const TabBar = () => (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        borderBottom: "1px solid var(--border-color)",
        display: "flex",
        padding: "0 20px",
      }}
    >
      {[
        { key: "list" as TabType, label: t("examPage.examList"), icon: ClipboardList },
        { key: "technician" as TabType, label: t("examPage.techExecution"), icon: Monitor },
        { key: "transfer" as TabType, label: t("examPage.deptTransferTrack"), icon: ArrowRight },
        { key: "analytics" as TabType, label: t("examPage.deepAnalysis"), icon: BarChart3 },
        { key: "statistics" as TabType, label: t("examPage.statisticsOverview"), icon: TrendingUp },
      ].map((tab) => (
        <AppButton
          key={tab.key}
          variant="text"
          size="default"
          onClick={() => setActiveTab(tab.key)}
          style={{
            padding: "14px 20px",
            borderBottom: `2px solid ${activeTab === tab.key ? PRIMARY : "transparent"}`,
            color: activeTab === tab.key ? PRIMARY : "var(--text-secondary)",
            borderRadius: 0,
          }}
        >
          <tab.icon size={16} />
          {tab.label}
          {tab.key === "technician" && (
            <span
              style={{
                backgroundColor: PRIMARY,
                color: "var(--text-inverse)",
                fontSize: 12,
                padding: "2px 6px",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              {techExecutions.filter((e) => !e.completed).length}
            </span>
          )}
          {tab.key === "transfer" && (
            <span
              style={{
                backgroundColor: "var(--color-warning)",
                color: "var(--text-inverse)",
                fontSize: 12,
                padding: "2px 6px",
                borderRadius: 10,
                fontWeight: 700,
              }}
            >
              {transferRecords.filter((r) => !r.examCompleted).length}
            </span>
          )}
        </AppButton>
      ))}
    </div>
  );

  // 筛选栏
  const FilterBar = () => (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        borderBottom: "1px solid var(--border-color)",
        padding: "12px 20px",
        display: "flex",
        flexWrap: "wrap",
        gap: 'var(--space-3, 12px)',
        alignItems: "center",
      }}
    >
      {/* 标题 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-2, 8px)',
          marginRight: 'var(--space-2, 8px)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: PRIMARY,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Activity size={16} style={{ color: "var(--text-inverse)" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>
            {t("examPage.techWorkstation")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.pageTitle")}</div>
        </div>
      </div>

      {/* 分隔线 */}
      <div style={{ width: 1, height: 32, backgroundColor: "var(--border-color)" }} />

      {/* 搜索框 */}
      <div style={{ position: "relative", flex: "0 0 200px" }}>
        <Search
          size={14}
          style={{
            position: "absolute",
            left: 10,
            top: "50%",
            transform: "translateY(-50%)",
            color: "var(--text-secondary)",
          }}
        />
        <input
          type="text"
          placeholder={t("examPage.searchPlaceholder")}
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px 8px 32px",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            fontSize: 12, boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
        />
      </div>

      {/* 优先级筛选 */}
      <Select
        value={filters.priority}
        onChange={(value) => handleFilterChange("priority", value)}
        style={{
          width: 130,
          ...(filters.priority !== "全部"
            ? { background: PRIORITY_CONFIG[filters.priority]?.bg }
            : {}),
        }}
        options={["全部", "普通", "紧急", "危重"].map((p) => ({
          value: p,
          label: p === "全部" ? t("examPage.allPriorities") : p,
        }))}
      />

      {/* 状态筛选 */}
      <Select
        value={filters.status}
        onChange={(value) => handleFilterChange("status", value)}
        style={{ width: 120 }}
        options={["全部", "待检查", "检查中", "已报告", "已发布", "待报告"].map((s) => ({
          value: s,
          label: s === "全部" ? t("examPage.allStatuses") : s,
        }))}
      />

      {/* 设备类型筛选 */}
      <Select
        value={filters.modality}
        onChange={(value) => handleFilterChange("modality", value)}
        style={{ width: 130 }}
        options={MODALITY_LIST.map((m) => ({
          value: m,
          label: m === "全部" ? t("examPage.allDevices") : m,
        }))}
      />

      {/* 患者类型筛选 */}
      <Select
        value={filters.patientType}
        onChange={(value) => handleFilterChange("patientType", value)}
        style={{ width: 130 }}
        options={PATIENT_TYPE_LIST.map((pt) => ({
          value: pt,
          label: pt === "全部" ? t("examPage.allPatients") : pt,
        }))}
      />

      {/* 清空筛选 */}
      {(filters.search ||
        filters.priority !== "全部" ||
        filters.status !== "全部" ||
        filters.modality !== "全部" ||
        filters.patientType !== "全部") && (
        <ActionButton
          action="cancel"
          size="compact"
          onClick={() =>
            setFilters({
              search: "",
              priority: "全部",
              status: "全部",
              modality: "全部",
              patientType: "全部",
            })
          }
        >
          {t("examPage.clear")}
        </ActionButton>
      )}

      {/* [W4-A] 批量导入导出 */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 'var(--space-2, 8px)' }}>
        {/* [Wave1B P2] 新建检查: examApi.create */}
        <ActionButton
          action="create"
          size="compact"
          onClick={() => {
            createExamForm.resetFields();
            setShowCreateModal(true);
          }}
        >
          {t("examPage.newExam2")}
        </ActionButton>
        <ActionButton
          action="import"
          size="compact"
          onClick={() => setShowImportModal(true)}
        >
          {t("examPage.batchImport")}
        </ActionButton>
        <ActionButton
          action="export"
          size="compact"
          onClick={() => void handleExamExport()}
        >
          {t("examPage.batchExport2")}
        </ActionButton>
        {/* [G005 Wave4B] G-18 检查合并入口 (多选 2+ 行) */}
        <ActionButton
          action="submit"
          size="compact"
          disabled={selectedIds.size < 2}
          icon={<MergeIcon size={13} />}
          onClick={handleOpenMergeModal}
        >
          {t("examPage.mergeExams")}
        </ActionButton>
      </div>
    </div>
  );

  // 检查闭环状态时间轴组件
  const StatusTimeline = ({ exam }: { exam: RadiologyExam }) => {
    const nodes = getExamStatusTimeline(exam);
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          minWidth: 280,
        }}
      >
        {nodes.map((node, index) => (
          <div key={node.key} style={{ display: "flex", alignItems: "center" }}>
            <div
              title={`${node.label}${node.timestamp ? ": " + node.timestamp : ""}${node.isOverdue ? t("examPage.timeoutSuffix") : ""}`}
              style={{
                width: index === 0 || index === nodes.length - 1 ? 8 : 10,
                height: index === 0 || index === nodes.length - 1 ? 8 : 10,
                borderRadius: "50%",
                backgroundColor: node.bgColor,
                border: `2px solid ${node.color}`,
                boxSizing: "border-box",
              }}
            />
            {index < nodes.length - 1 && (
              <div
                style={{
                  width: 16,
                  height: 2,
                  backgroundColor: node.color,
                  opacity: 0.4,
                }}
              />
            )}
          </div>
        ))}
      </div>
    );
  };

  // 表格
  const ExamTable = () => {
    // [W14-UX] 右键行操作 (查看/阅片/开始/完成/打印/导出/拆分/删除)
    const buildExamContextItems = (exam: RadiologyExam): ContextMenuItem[] => [
      { key: "view", label: t("w14Ux.contextMenu.view"), onSelect: () => navigate(`/exam/${exam.id}`) },
      {
        key: "read",
        label: t("examPage.readFilm"),
        onSelect: () => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(exam.accessionNumber || exam.id || "")}&examId=${exam.id}`),
      },
      ...(exam.status === "待检查"
        ? [{ key: "start", label: t("w14Ux.contextMenu.start"), onSelect: () => openModal(exam, "start") }]
        : []),
      ...(exam.status === "检查中"
        ? [{ key: "complete", label: t("w14Ux.contextMenu.complete"), onSelect: () => openModal(exam, "complete") }]
        : []),
      { key: "print", label: t("w14Ux.contextMenu.print"), dividerBefore: true, onSelect: () => void runBatchApiAction("print", [exam.id]) },
      { key: "export", label: t("w14Ux.contextMenu.export"), onSelect: () => void runBatchApiAction("export", [exam.id]) },
      { key: "split", label: t("examPage.split"), onSelect: () => handleOpenSplitModal(exam) },
      {
        key: "delete",
        label: t("w14Ux.contextMenu.delete"),
        danger: true,
        confirm: t("examPage.deleteConfirm"),
        dividerBefore: true,
        onSelect: () => void handleDeleteExam(exam),
      },
    ];
    // [v3.0.6.11-103 Wave 6] 统一列配置 (DataTable)
    const columns: TableColumnsType<RadiologyExam> = [
      {
        title: t("examPage.accessionNo2"),
        dataIndex: "accessionNumber",
        key: "accessionNumber",
        width: 130,
        render: (value) => (
          <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>{String(value)}</span>
        ),
      },
      {
        title: t("examPage.patientInfo"),
        dataIndex: "patientName",
        key: "patientName",
        width: 220,
        render: (_value, exam) => (
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: PRIMARY_BG,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <User size={14} style={{ color: PRIMARY }} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{exam.patientName}</div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {exam.gender} · {exam.age}{t("examPage.ageSuffix")} {exam.patientType}
              </div>
            </div>
          </div>
        ),
      },
      {
        title: t("examPage.examItem"),
        dataIndex: "examItemName",
        key: "examItemName",
        width: 180,
        render: (_value, exam) => (
          <div>
            <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>{exam.examItemName}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              {exam.modality} · {exam.bodyPart}
            </div>
          </div>
        ),
      },
      {
        title: t("examPage.device2"),
        dataIndex: "deviceName",
        key: "deviceName",
        width: 160,
        render: (_value, exam) => (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
              <Monitor size={14} style={{ color: "var(--text-secondary)" }} />
              <span style={{ color: "var(--text-secondary)" }}>{exam.deviceName?.split("（")[0] || "-"}</span>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{exam.roomName}</div>
          </div>
        ),
      },
      {
        title: t("examPage.priority"),
        dataIndex: "priority",
        key: "priority",
        width: 90,
        render: (value, exam) => {
          const pStyle = getPriorityStyle(exam.priority);
          return (
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                ...pStyle,
              }}
            >
              {String(value)}
            </span>
          );
        },
      },
      {
        title: t("examPage.status"),
        dataIndex: "status",
        key: "status",
        width: 100,
        render: (_value, exam) => {
          const sStyle = getStatusStyle(exam.status);
          return (
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 600,
                ...sStyle,
              }}
            >
              {sStyle.label}
            </span>
          );
        },
      },
      {
        title: t("examPage.examTime"),
        dataIndex: "examDate",
        key: "examTime",
        width: 140,
        render: (_value, exam) => (
          <div>
            <div style={{ color: "var(--text-secondary)" }}>{exam.examDate}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{formatTime(exam.examTime ?? "")}</div>
          </div>
        ),
      },
      {
        title: t("examPage.actions"),
        dataIndex: "id",
        key: "actions",
        width: 300,
        fixed: "right",
        render: (_value, exam) => (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            {exam.status === "待检查" && (
              <AppButton
                variant="primary"
                size="compact"
                onClick={() => openModal(exam, "start")}
                icon={<Play size={10} />}
              >
                {t("examPage.start")}
              </AppButton>
            )}
            {exam.status === "检查中" && (
              <>
                <ActionButton
                  action="submit"
                  size="compact"
                  icon={<CheckCircle2 size={10} />}
                  onClick={() => openModal(exam, "complete")}
                >
                  {t("examPage.complete")}
                </ActionButton>
                <ActionButton
                  action="refresh"
                  size="compact"
                  onClick={() => openModal(exam, "quality")}
                >
                  {t("examPage.quality")}
                </ActionButton>
              </>
            )}
            {/* [G005 放射流程P0] 检查→阅片: 行操作直达 DICOM 阅片 */}
            <ActionButton
              action="refresh"
              size="compact"
              icon={<Eye size={10} />}
              title={t("examPage.readFilm")}
              onClick={() => navigate(`/dicom-viewer?studyUid=${encodeURIComponent(exam.accessionNumber || exam.id || '')}&examId=${exam.id}`)}
            >
              {t("examPage.readFilm")}
            </ActionButton>
            {/* [v3.0.6.11-96 Wave 3A P1] 详情 → 独立路由 /exam/:id */}
            <ActionButton
              action="refresh"
              size="compact"
              icon={<ExternalLink size={10} />}
              title={t("examPage.examDetail")}
              onClick={() => navigate(`/exam/${exam.id}`)}
            >
              {t("examPage.detail")}
            </ActionButton>
            {(exam.status === "已报告" || exam.status === "待报告") && (
              <ActionButton
                action="refresh"
                size="compact"
                icon={<FileText size={10} />}
                onClick={() => openModal(exam, "quality")}
              >
                {t("examPage.view")}
              </ActionButton>
            )}
            {/* [G005 Wave4B] G-18 检查拆分入口 */}
            <ActionButton
              action="refresh"
              size="compact"
              icon={<SplitIcon size={10} />}
              title={t("examPage.splitByReport")}
              onClick={() => handleOpenSplitModal(exam)}
            >
              {t("examPage.split")}
            </ActionButton>
            {/* [Wave1B P2] 删除检查: examApi.delete (Popconfirm danger) */}
            <Popconfirm
              title={t("examPage.deleteConfirm")}
              description={t("w9a.examPage.deleteConfirmDesc", { no: exam.accessionNumber })}
              okText={t("examPage.delete")}
              cancelText={t("examPage.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={() => void handleDeleteExam(exam)}
            >
              <ActionButton
                action="delete"
                size="compact"
                title={t("examPage.deleteExam")}
                disabled={deletingExamId === exam.id}
              >
                {t("examPage.delete")}
              </ActionButton>
            </Popconfirm>
          </div>
        ),
      },
      {
        title: t("examPage.closedLoopStatus"),
        dataIndex: "id",
        key: "timeline",
        width: 300,
        render: (_value, exam) => <StatusTimeline exam={exam} />,
      },
    ];

    return (
      <div style={{ flex: 1, minWidth: 0, backgroundColor: "var(--bg-card)" }}>
        <DataTable<RadiologyExam>
          columns={columns}
          dataSource={paginatedExams}
          rowKey="id"
          loading={loading}
          zebra
          emptyText={t("examPage.noMatches")}
          scroll={{ y: "calc(100vh - 420px)" }}
          columnConfigKey="exam-table"
          alwaysVisibleColumns={["actions"]}
          contextMenuTestId="exam-context-menu"
          contextMenuItems={buildExamContextItems}
          pagination={{
            current: page,
            pageSize,
            total: filteredExams.length,
            onChange: (p) => setPage(p),
            showSizeChanger: false,
          }}
          rowSelection={{
            preserveSelectedRowKeys: true,
            selectedRowKeys: [...selectedIds],
            onChange: (keys) => setSelectedIds(new Set(keys.map(String))),
          }}
        />
      </div>
    );
  };

  // 技师执行Tab内容
  const TechnicianExecutionTab = () => (
    <div style={{ flex: 1, overflow: "auto", padding: 'var(--space-5, 20px)' }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 'var(--space-4, 16px)',
        }}
      >
        {techExecutions.map((execution) => (
          <div
            key={execution.id}
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: 12,
              padding: 'var(--space-5, 20px)',
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              border: execution.completed
                ? "2px solid var(--color-success-border)"
                : "2px solid var(--color-info-border)",
            }}
          >
            {/* 卡片头部 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 'var(--space-1, 4px)',
                  }}
                >
                  {execution.patientName}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {execution.examItemName}
                </div>
              </div>
              <div
                style={{
                  padding: "4px 10px",
                  borderRadius: 20,
                  backgroundColor: execution.completed ? "var(--color-success-bg)" : "var(--color-info-bg)",
                  color: execution.completed ? "var(--color-success)" : PRIMARY,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {execution.completed ? t("examPage.completed") : t("examPage.inProgress")}
              </div>
            </div>

            {/* 设备信息 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 'var(--space-3, 12px)',
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div
                  style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}
                >
                  {t("examPage.deviceId")}
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {execution.deviceNumber}
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div
                  style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}
                >
                  {t("examPage.examRoom")}
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {execution.roomName}
                </div>
              </div>
            </div>

            {/* 技师信息 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 'var(--space-2, 8px)',
                marginBottom: 'var(--space-3, 12px)',
                padding: "8px 12px",
                backgroundColor: PRIMARY_BG,
                borderRadius: 8,
              }}
            >
              <User size={14} style={{ color: PRIMARY }} />
              <span style={{ fontSize: 12, color: PRIMARY, fontWeight: 600 }}>
                {execution.technologistName}
              </span>
              <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {t("examPage.currentLogin")}
              </span>
            </div>

            {/* 时间信息 */}
            <div
              style={{
                display: "flex",
                gap: 'var(--space-4, 16px)',
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.startTime")}</div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {execution.startTime}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.expectedDuration")}</div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {execution.estimatedDuration}{t("examPage.minutes")}
                </div>
              </div>
            </div>

            {/* 图像采集数量 */}
            <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 'var(--space-2, 8px)',
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {t("examPage.imageCount")}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 'var(--space-2, 8px)',
                  }}
                >
                  <Camera size={14} style={{ color: "var(--text-secondary)" }} />
                  <input
                    type="number"
                    value={execution.imagesAcquired}
                    onChange={(e) =>
                      handleImageCountChange(
                        execution.id,
                        parseInt(e.target.value) || 0,
                      )
                    }
                    disabled={execution.completed}
                    style={{
                      width: 60,
                      padding: "4px 8px",
                      border: "1px solid var(--border-color)",
                      borderRadius: 4,
                      fontSize: 14,
                      fontWeight: 700,
                      textAlign: "center",
                      color: execution.completed ? "var(--text-muted)" : PRIMARY,
                      backgroundColor: execution.completed ? "var(--bg-primary)" : "var(--bg-card)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.framesUnit")}</span>
                </div>
              </div>
              {/* 采集进度条 */}
              <div
                style={{
                  height: 6,
                  backgroundColor: "var(--border-color)",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (execution.imagesAcquired / (execution.estimatedDuration * 15)) * 100)}%`,
                    backgroundColor: execution.completed ? "var(--color-success)" : PRIMARY,
                    borderRadius: 3,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {/* 采集完成按钮 */}
            {!execution.completed && (
              <ActionButton
                action="submit"
                block
                icon={<CheckCircle2 size={16} />}
                onClick={() => handleConfirmComplete(execution.id)}
              >
                {t("examPage.confirmCaptureDone")}
              </ActionButton>
            )}

            {/* 技师电子签名 */}
            {execution.completed && execution.signature && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 'var(--space-2, 8px)',
                  padding: "10px 16px",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                  border: "1px dashed var(--border-color)",
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: "var(--color-success-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <CheckCircle size={16} style={{ color: "var(--color-success)" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {t("examPage.techESign")}
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "var(--color-success)",
                      fontFamily: "cursive",
                    }}
                  >
                    {execution.signature}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // 转科追踪Tab内容
  const TransferTrackingTab = () => (
    <div style={{ flex: 1, overflow: "auto", padding: 'var(--space-5, 20px)' }}>
      {/* 统计卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 'var(--space-4, 16px)',
          marginBottom: 'var(--space-6, 24px)',
        }}
      >
        {[
          {
            label: t("examPage.totalTransfers"),
            value: transferRecords.length,
            color: PRIMARY,
            bg: PRIMARY_BG,
          },
          {
            label: t("examPage.transferEmergencyToInpatient"),
            value: transferRecords.filter(
              (r) => r.transferReason === "急诊→住院",
            ).length,
            color: "var(--color-error)", bg: "var(--color-error)22",
          },
          {
            label: t("examPage.transferInpatientToDepartment"),
            value: transferRecords.filter(
              (r) => r.transferReason === "住院→转科",
            ).length,
            color: "var(--color-warning)", bg: "var(--color-warning)22",
          },
          {
            label: t("examPage.pendingExams"),
            value: transferRecords.filter((r) => !r.examCompleted).length,
            color: "var(--color-warning)",
            bg: "var(--color-warning)22",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: 12,
              padding: 'var(--space-4, 16px)',
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              borderLeft: `4px solid ${stat.color}`,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 'var(--space-1, 4px)' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 30, fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 转科记录列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-4, 16px)' }}>
        {transferRecords.map((record) => (
          <div
            key={record.id}
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: 12,
              padding: 'var(--space-5, 20px)',
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              border: record.examCompleted
                ? "2px solid var(--color-success-border)"
                : "2px solid var(--color-warning-border)",
            }}
          >
            {/* 患者信息头部 */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-3, 12px)' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: "50%",
                    backgroundColor: PRIMARY_BG,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <User size={20} style={{ color: PRIMARY }} />
                </div>
                <div>
                  <div
                    style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}
                  >
                    {record.patientName}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    {record.gender} · {record.age}{t("examPage.ageSuffix")} {record.patientType}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 'var(--space-1, 4px)',
                }}
              >
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    backgroundColor: record.examCompleted
                      ? "var(--color-success-bg)"
                      : "var(--color-warning-bg)",
                    color: record.examCompleted ? "var(--color-success)" : "var(--color-warning)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {record.examCompleted ? t("examPage.examDone") : t("examPage.examPending")}
                </div>
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    backgroundColor:
                      record.transferReason === "急诊→住院"
                        ? "var(--color-error-bg)"
                        : record.transferReason === "住院→转科"
                          ? "var(--color-warning-bg)"
                          : "var(--color-info-bg)",
                    color:
                      record.transferReason === "急诊→住院"
                        ? "var(--color-error)"
                        : record.transferReason === "住院→转科"
                          ? "var(--color-warning)"
                          : "var(--color-primary)",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {record.transferReason}
                </div>
              </div>
            </div>

            {/* 转科详情 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, 1fr)",
                gap: 'var(--space-3, 12px)',
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 'var(--space-2, 8px)',
                  padding: "10px 14px",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                }}
              >
                <ArrowRight size={14} style={{ color: "var(--color-error)" }} />
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.fromDept")}</div>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {record.fromDepartment}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 'var(--space-2, 8px)',
                  padding: "10px 14px",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                }}
              >
                <ArrowRight size={14} style={{ color: "var(--color-success)" }} />
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.toDept")}</div>
                  <div
                    style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {record.toDepartment}
                  </div>
                </div>
              </div>
            </div>

            {/* 时间和医生 */}
            <div
              style={{
                display: "flex",
                gap: 'var(--space-6, 24px)',
                marginBottom: 'var(--space-3, 12px)',
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={14} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {t("examPage.transferTime")}
                </span>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {record.transferTime}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Stethoscope size={14} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {t("examPage.attendingLabel")}
                </span>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {record.attendingDoctor}
                </span>
              </div>
            </div>

            {/* 转科备注 */}
            {record.notes && (
              <div
                style={{
                  padding: "10px 14px",
                  backgroundColor: "var(--color-warning-bg)",
                  borderRadius: 8,
                  borderLeft: "3px solid var(--color-warning)",
                  marginBottom: 'var(--space-3, 12px)',
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--color-warning)",
                    marginBottom: 'var(--space-1, 4px)',
                  }}
                >
                  {t("examPage.transferNote")}
                </div>
                <div style={{ fontSize: 12, color: "var(--color-warning)" }}>
                  {record.notes}
                </div>
              </div>
            )}

            {/* 检查跟随状态 */}
            {record.examName && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 'var(--space-2, 8px)',
                  padding: "10px 14px",
                  backgroundColor: record.examCompleted ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                  borderRadius: 8,
                  border: `1px solid ${record.examCompleted ? "var(--color-success-border)" : "var(--color-warning-border)"}`,
                }}
              >
                <ClipboardList
                  size={14}
                  style={{
                    color: record.examCompleted ? "var(--color-success)" : "var(--color-warning)",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {t("examPage.followExam")}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: record.examCompleted ? "var(--color-success)" : "var(--color-warning)",
                  }}
                >
                  {record.examName}
                </span>
                {record.examCompleted && (
                  <CheckCircle
                    size={14}
                    style={{ color: "var(--color-success)", marginLeft: "auto" }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // [v3.0.6.11-103 Wave 6] 分页器已统一由 DataTable 内置分页器承担 (ExamTable)

  // [v3.0.6.11-99 Wave10B] 深度分析视图: 时间线/模态分布/耗时分析/重拍率
  const AnalyticsTab = () => {
    const maxCount = Math.max(1, ...modalityDist.map(d => d.count))
    const maxDur = Math.max(1, ...durationByModality.map(d => d.avgMin))
    const maxRetake = Math.max(1, ...retakeStats.rows.map(r => r.rate))
    const totalDist = modalityDist.reduce((s, d) => s + d.count, 0)
    return (
      <div style={{ padding: 'var(--space-4, 16px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
        {/* 数据源徽标 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8,
          border: '1px solid var(--border-color)', fontSize: 12,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 999,
            fontWeight: 600,
            background: analyticsSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            color: analyticsSource === 'real' ? 'var(--color-success)' : 'var(--color-warning)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: analyticsSource === 'real' ? 'var(--color-success)' : 'var(--color-warning)' }} />
            {t("examPage.dataSource")} {analyticsSource === 'real' ? t("examPage.sourceRealApi") : t("examPage.sourceLocal")}
          </span>
          {analyticsLoading && <span style={{ color: 'var(--color-warning)' }}>{t("examPage.syncing")}</span>}
          <ActionButton
            action="refresh"
            size="compact"
            style={{ marginLeft: 'auto' }}
            onClick={() => void loadAnalytics()}
          >
            {t("examPage.refresh")}
          </ActionButton>
        </div>
        {analyticsError && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--color-warning)',
            background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)',
          }}>
            {analyticsError}
          </div>
        )}

        {/* 1. 模态分布卡 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 14 }}>
            <PieChartIcon size={16} color={PRIMARY} />
            <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t("examPage.modalityDistCard")}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t("examPage.totalPrefix")} {totalDist} {t("examPage.examCases")}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6, 24px)' }}>
            {/* 简易环形图 */}
            <div style={{ position: 'relative', width: 130, height: 130, flexShrink: 0 }}>
              <svg viewBox="0 0 120 120" width={130} height={130}>
                {(() => {
                  const colors = ['var(--color-primary)', 'var(--color-modality-mr)', 'var(--color-success)', 'var(--color-warning)', '#ec4899', '#14b8a6', 'var(--text-muted)']
                  let acc = 0
                  const R = 48
                  const C = 2 * Math.PI * R
                  return modalityDist.slice(0, 7).map((d, i) => {
                    const frac = totalDist > 0 ? d.count / totalDist : 0
                    const dash = frac * C
                    const offset = -acc * C
                    acc += frac
                    return (
                      <circle
                        key={d.modality}
                        cx="60" cy="60" r={R}
                        fill="none"
                        stroke={colors[i % colors.length]}
                        strokeWidth="16"
                        strokeDasharray={`${dash} ${C - dash}`}
                        strokeDashoffset={offset}
                        transform="rotate(-90 60 60)"
                      >
                        <title>{t("w9a.examPage.modalityCountTip", { modality: d.modality, count: d.count })}</title>
                      </circle>
                    )
                  })
                })()}
                <text x="60" y="56" textAnchor="middle" fontSize="18" fontWeight="700" fill={PRIMARY}>
                  {totalDist}
                </text>
                <text x="60" y="72" textAnchor="middle" fontSize="9" fill="var(--text-muted)">{t("examPage.totalExams")}</text>
              </svg>
            </div>
            {/* 图例 */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
              {modalityDist.slice(0, 7).map((d, i) => {
                const colors = ['var(--color-primary)', 'var(--color-modality-mr)', 'var(--color-success)', 'var(--color-warning)', '#ec4899', '#14b8a6', 'var(--text-muted)']
                const pct = totalDist > 0 ? Math.round((d.count / totalDist) * 1000) / 10 : 0
                return (
                  <div key={d.modality} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % colors.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)', width: 44 }}>{d.modality}</span>
                    <div style={{ flex: 1, height: 7, background: 'var(--content-bg)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(d.count / maxCount) * 100}%`, height: '100%', borderRadius: 4,
                        background: colors[i % colors.length],
                      }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: PRIMARY, width: 60, textAlign: 'right' }}>
                      {d.count} ({pct}%)
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* 2. 检查耗时分析 (按模态平均时长) */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 14 }}>
            <Timer size={16} color="var(--color-warning)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t("examPage.durationAnalysis")}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {analyticsSource === 'real' ? t("examPage.durationDerivedFrom") : t("examPage.localEstimate")}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--space-5, 20px)', height: 160, padding: '0 8px' }}>
            {durationByModality.map(d => (
              <div key={d.modality} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{d.avgMin}{t("examPage.minUnit")}</span>
                <div style={{
                  width: '55%', height: `${(d.avgMin / maxDur) * 120}px`, minHeight: 8, borderRadius: '4px 4px 0 0',
                  background: d.avgMin <= 15 ? 'linear-gradient(180deg, var(--color-success-500), #86efac)'
                    : d.avgMin <= 25 ? 'linear-gradient(180deg, var(--color-primary-500), #93c5fd)'
                    : 'linear-gradient(180deg, var(--color-warning-500), #fcd34d)',
                  transition: 'height 0.3s',
                }} title={t("w9a.examPage.avgMinutesTip", { modality: d.modality, min: d.avgMin })} />
                <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.modality} ({d.count})</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 'var(--space-4, 16px)', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-success)' }} /> {t("examPage.durationFast")}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-primary)' }} /> {t("examPage.durationMedium")}
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: 'var(--color-warning)' }} /> {t("examPage.durationLong")}
            </span>
          </div>
        </div>

        {/* 3. 重拍率统计 */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 14, flexWrap: 'wrap' }}>
            <TrendingUp size={16} color="var(--color-error)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t("examPage.retakeStats")}</span>
            <span style={{
              fontSize: 12, fontWeight: 600, padding: '2px 10px', borderRadius: 999,
              background: retakeStats.avgRate <= 5 ? 'var(--color-success-bg)' : retakeStats.avgRate <= 8 ? 'var(--color-warning-bg)' : 'var(--color-error-bg)',
              color: retakeStats.avgRate <= 5 ? 'var(--color-success)' : retakeStats.avgRate <= 8 ? 'var(--color-warning)' : 'var(--color-error)',
            }}>
              {t("examPage.overallRetakeRate")} {retakeStats.avgRate.toFixed(1)}% ({retakeStats.totalRetakes}/{retakeStats.totalExams})
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {retakeStats.rows.map(r => (
              <div key={r.modality}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 'var(--space-1, 4px)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {r.modality} <span style={{ color: 'var(--text-muted)' }}>({r.retakes} {t("examPage.timesPer")} {r.total} {t("examPage.casesSuffix")}</span>
                  </span>
                  <span style={{
                    fontWeight: 700,
                    color: r.rate <= 5 ? 'var(--color-success)' : r.rate <= 8 ? 'var(--color-warning)' : 'var(--color-error)',
                  }}>
                    {r.rate}%
                  </span>
                </div>
                <div style={{ height: 8, background: 'var(--content-bg)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{
                    width: `${(r.rate / maxRetake) * 100}%`, height: '100%', borderRadius: 4,
                    background: r.rate <= 5 ? 'var(--color-success)' : r.rate <= 8 ? 'var(--color-warning)' : 'var(--color-error)',
                  }} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 'var(--space-3, 12px)', padding: '10px 12px', borderRadius: 6, fontSize: 12, background: 'var(--content-bg)', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            {t("examPage.retakeNote")}
          </div>
        </div>

        {/* 4. 检查时间线视图 (按患者) */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 14 }}>
            <Layers size={16} color="var(--color-modality-mr)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t("examPage.examTimeline")}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t("examPage.lastPrefix")} {patientTimeline.length} {t("examPage.multiExamPatients")}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)', maxHeight: 480, overflowY: 'auto' }}>
            {patientTimeline.length === 0 && (
              <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>{t("examPage.noExamData")}</div>
            )}
            {patientTimeline.map(g => (
              <div key={g.patientId} style={{ border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  background: 'var(--content-bg)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg, var(--color-primary-800), var(--color-primary-500))', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700,
                  }}>
                    {g.patientName.slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: PRIMARY }}>{g.patientName}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'var(--space-2, 8px)' }}>{g.patientId}</span>
                  </div>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 999,
                    background: 'var(--color-info-bg)', color: PRIMARY,
                  }}>
                    {g.items.length} {t("examPage.examTimes")}
                  </span>
                </div>
                <div style={{ padding: '10px 14px', position: 'relative' }}>
                  {/* 时间轴 */}
                  <div style={{
                    position: 'absolute', left: 27, top: 8, bottom: 8, width: 2,
                    background: 'var(--border-color)',
                  }} />
                  {g.items.slice(0, 6).map((ex, idx) => (
                    <div key={String(ex.id) + idx} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3, 12px)', padding: '6px 0', position: 'relative',
                    }}>
                      <div style={{
                        width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3, zIndex: 1,
                        background: ex.status === '已报告' || ex.status === '已发布' ? 'var(--color-success)'
                          : ex.status === '检查中' ? 'var(--color-warning)' : 'var(--color-primary)',
                        boxShadow: `0 0 0 3px ${ex.status === '已报告' || ex.status === '已发布' ? 'var(--color-success)22' : ex.status === '检查中' ? 'var(--color-warning)22' : 'var(--color-primary)22'}`,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>
                            {ex.examItemName}
                          </span>
                          <span style={{
                            fontSize: 11, padding: '1px 8px', borderRadius: 4, fontWeight: 600,
                            background: MODALITY_COLOR_BG(ex.modality), color: MODALITY_COLOR(ex.modality),
                          }}>
                            {ex.modality}
                          </span>
                          <span style={{
                            fontSize: 11, padding: '1px 8px', borderRadius: 4,
                            background: STATUS_CONFIG[ex.status]?.bg || 'var(--bg-deep)',
                            color: STATUS_CONFIG[ex.status]?.color || 'var(--text-secondary)',
                          }}>
                            {STATUS_CONFIG[ex.status]?.label || ex.status}
                          </span>
                          {ex.priority === '危重' || ex.priority === '紧急' ? (
                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-error)' }}>{ex.priority}</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {ex.examDate} {ex.examTime} · {ex.roomName || '—'} · {ex.deviceName?.split('（')[0] || '—'}
                          {ex.imageCount ? t("w9a.examPage.imagesSuffix", { count: ex.imageCount }) : ''}
                        </div>
                      </div>
                      <ActionButton
                        action="refresh"
                        size="compact"
                        icon={<Eye size={11} />}
                        onClick={() => navigate(`/dicom-viewer?examId=${ex.id}`)}
                      >
                        {t("examPage.viewImages")}
                      </ActionButton>
                    </div>
                  ))}
                  {g.items.length > 6 && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: '4px 0' }}>
                      {t("examPage.additionalPrefix")} {g.items.length - 6} {t("examPage.earlierExams")}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. 日检查量趋势 + 状态/患者类型/优先级分布 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4, 16px)' }}>
          {/* 日检查量趋势 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
              <TrendingUp size={16} color={PRIMARY} />
              <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t("examPage.examTrend14d")}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t("examPage.derivedFromExamDate")}</span>
            </div>
            {(() => {
              const byDay = new Map<string, number>()
              allExams.forEach(e => {
                const d = String(e.examDate || '').slice(0, 10)
                if (d) byDay.set(d, (byDay.get(d) || 0) + 1)
              })
              const days = [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-14)
              const maxCount = Math.max(1, ...days.map(([, c]) => c))
              return days.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 30, color: 'var(--text-muted)', fontSize: 12 }}>{t("examPage.noDateData")}</div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120 }}>
                  {days.map(([day, count]) => (
                    <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 10, color: PRIMARY, fontWeight: 600 }}>{count}</span>
                      <div style={{
                        width: '70%', borderRadius: '3px 3px 0 0', minHeight: 4,
                        height: `${(count / maxCount) * 90}px`,
                        background: 'linear-gradient(180deg, var(--color-primary-800), #93c5fd)',
                        transition: 'height 0.3s',
                      }} title={t("w9a.examPage.dayCountTip", { day, count })} />
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{day.slice(5)}</span>
                    </div>
                  ))}
                </div>
              )
            })()}
            <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 11, color: 'var(--text-muted)' }}>
              {t("examPage.dailyAvg")} <strong style={{ color: PRIMARY }}>
                {Math.round(allExams.length / Math.max(1, new Set(allExams.map(e => String(e.examDate || '').slice(0, 10))).size))}
              </strong> {t("examPage.casesUnit")}
            </div>
          </div>

          {/* 状态/患者类型/优先级 分布 */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 'var(--space-4, 16px)', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-3, 12px)' }}>
              <PieChartIcon size={16} color="var(--color-modality-mr)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>{t("examPage.distTitle")}</span>
            </div>
            {(() => {
              const statusMap = new Map<string, number>()
              const typeMap = new Map<string, number>()
              const prioMap = new Map<string, number>()
              allExams.forEach(e => {
                const st = STATUS_CONFIG[e.status]?.label || e.status || t("examPage.unknown")
                statusMap.set(st, (statusMap.get(st) || 0) + 1)
                const pt = String(e.patientType || "门诊")
                typeMap.set(pt, (typeMap.get(pt) || 0) + 1)
                const pr = String(e.priority || '普通')
                prioMap.set(pr, (prioMap.get(pr) || 0) + 1)
              })
              const distRow = (title: string, data: Map<string, number>, colors: Record<string, string>) => {
                const rows = [...data.entries()].sort((a, b) => b[1] - a[1])
                const max = Math.max(1, ...rows.map(([, c]) => c))
                return (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>{title}</div>
                    {rows.slice(0, 5).map(([k, v]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', marginBottom: 'var(--space-1, 4px)' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)', width: 62, flexShrink: 0 }}>{k}</span>
                        <div style={{ flex: 1, height: 6, background: 'var(--content-bg)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(v / max) * 100}%`, height: '100%', borderRadius: 3,
                            background: colors[k] || 'var(--color-primary)',
                          }} />
                        </div>
                        <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)', width: 34, textAlign: 'right' }}>{v}</span>
                      </div>
                    ))}
                  </div>
                )
              }
              return (
                <div>
                  {distRow(t("examPage.examStatus"), statusMap, {
                    '待检查': 'var(--color-primary)', '检查中': 'var(--color-warning)', '已报告': 'var(--color-success)', '已发布': 'var(--color-modality-mr)', '待报告': 'var(--color-info-500)', '已登记': 'var(--text-secondary)',
                  })}
                  {distRow(t("examPage.patientType"), typeMap, { '门诊': 'var(--color-primary)', '住院': 'var(--color-modality-mr)', '急诊': 'var(--color-error)', '体检': '#10b981' })}
                  {distRow(t("examPage.priority"), prioMap, { '普通': 'var(--text-muted)', '紧急': 'var(--color-warning)', '危重': 'var(--color-error)' })}
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    )
  }

  // 模态颜色辅助 (时间线徽标)
  const MODALITY_COLOR = (m: string): string => {
    const map: Record<string, string> = { CT: 'var(--color-primary-500)', MR: '#8b5cf6', DR: 'var(--color-success-600)', DSA: 'var(--color-warning-600)', MG: '#db2777' }
    return map[String(m)] || '#64748b'
  }
  const MODALITY_COLOR_BG = (m: string): string => {
    const map: Record<string, string> = { CT: 'var(--color-primary)22', MR: 'var(--color-modality-mr)22', DR: 'var(--color-success)22', DSA: 'var(--color-warning)22', MG: '#db277722' }
    return map[String(m)] || 'var(--text-secondary)22'
  }

  // 底部统计栏
  const StatsBar = () => (
    <div
      style={{
        backgroundColor: PRIMARY,
        padding: "12px 20px",
        display: "flex",
        gap: 'var(--space-6, 24px)',
      }}
    >
      {[
        {
          label: t("examPage.allRecords"),
          value: stats.total,
          icon: FileText,
          color: "var(--text-inverse)",
        },
        {
          label: t("examPage.statusPending"),
          value: stats.pending,
          icon: Clock,
          color: "var(--color-primary-400)",
        },
        {
          label: t("examPage.statusInProgress"),
          value: stats.inProgress,
          icon: Activity,
          color: "var(--color-warning-400)",
        },
        {
          label: t("examPage.completed"),
          value: stats.completed,
          icon: CheckCircle,
          color: "var(--color-success-400)",
        },
        {
          label: t("examPage.priorityCritical"),
          value: stats.critical,
          icon: AlertCircle,
          color: "var(--color-error-400)",
        },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 'var(--space-2, 8px)',
          }}
        >
          <item.icon size={16} style={{ color: item.color, opacity: 0.9 }} />
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "var(--text-inverse)",
                lineHeight: 1,
              }}
            >
              {item.value}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "rgba(255,255,255,0.7)",
                marginTop: 2,
              }}
            >
              {item.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  // 操作Modal
  const ActionModal = () => {
    if (!modal.visible || !modal.exam) return null;

    const actionConfig = {
      start: {
        title: t("examPage.startExam"),
        color: PRIMARY,
        confirmText: t("examPage.confirmStart"),
        icon: Play,
      },
      complete: {
        title: t("examPage.completeExam"),
        color: "var(--color-success)",
        confirmText: t("examPage.confirmComplete"),
        icon: CheckCircle2,
      },
      cancel: {
        title: t("examPage.cancelExam"),
        color: "var(--color-error)",
        confirmText: t("examPage.confirmCancel"),
        icon: XCircle,
      },
      quality: {
        title: t("examPage.qualityAssessment"),
        color: "var(--color-info-600)",
        confirmText: t("examPage.saveAssessment"),
        icon: Camera,
      },
    }[modal.action || "start"];

    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            backgroundColor: "var(--bg-card)",
            borderRadius: 12,
            width: 480,
            maxWidth: "90vw",
            boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: actionConfig.color,
              borderRadius: "12px 12px 0 0",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 'var(--space-2, 8px)',
                color: "var(--text-inverse)",
              }}
            >
              <actionConfig.icon size={18} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>
                {actionConfig.title}
              </span>
            </div>
            <button
              onClick={closeModal}
              aria-label={t("common.close")}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                padding: 'var(--space-1, 4px)',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 'var(--space-5, 20px)' }}>
            {/* 患者信息 */}
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                borderRadius: 8,
                padding: 'var(--space-3, 12px)',
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 'var(--space-2, 8px)',
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.patientName")}</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {modal.exam.patientName}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 'var(--space-2, 8px)',
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.examItem")}</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {modal.exam.examItemName}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 'var(--space-2, 8px)',
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.accessionNo2")}</span>
                <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                  {modal.exam.accessionNumber}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t("examPage.device2")}</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {modal.exam.deviceName?.split("（")[0]}
                </span>
              </div>
            </div>

            {/* 操作特定内容 */}
            {modal.action === "quality" && (
              <div style={{ marginBottom: 'var(--space-4, 16px)' }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    display: "block",
                    marginBottom: 'var(--space-2, 8px)',
                  }}
                >
                  {t("examPage.qualityRating")}
                </label>
                <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
                  {["优", t("examPage.good"), "差"].map((q) => (
                    <button
                      key={q}
                      onClick={() => setImageQuality(q)}
                      style={{
                        flex: 1,
                        padding: "8px 12px",
                        borderRadius: 6,
                        border: "2px solid",
                        borderColor:
                          imageQuality === q
                            ? q === "优"
                              ? "var(--color-success)"
                              : q === "良"
                                ? "var(--color-warning)"
                                : "var(--color-error)"
                            : "var(--border-default)",
                        backgroundColor:
                          imageQuality === q
                            ? q === "优"
                              ? "var(--color-success-bg)"
                              : q === "良"
                                ? "var(--color-warning-bg)"
                                : "var(--color-error-bg)"
                            : "var(--bg-card)",
                        color:
                          imageQuality === q
                            ? q === "优"
                              ? "var(--color-success)"
                              : q === "良"
                                ? "var(--color-warning)"
                                : "var(--color-error)"
                            : "var(--text-secondary)",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 备注 */}
            <div>
              <label
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  display: "block",
                  marginBottom: 'var(--space-2, 8px)',
                }}
              >
                {t("examPage.opNote")}
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder={t("examPage.opNotePlaceholder")}
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 12,
                  resize: "none", boxSizing: "border-box",
                  fontFamily: "inherit",
                }}
                onFocus={(e) =>
                  (e.target.style.borderColor = actionConfig.color)
                }
                onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
              />
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "flex-end",
              gap: 'var(--space-2, 8px)',
            }}
          >
            <ActionButton action="cancel" onClick={closeModal}>
              {t("examPage.cancel")}
            </ActionButton>
            <ActionButton
              action="submit"
              style={{ backgroundColor: actionConfig.color, borderColor: actionConfig.color }}
              onClick={handleExecute}
            >
              {actionConfig.confirmText}
            </ActionButton>
          </div>
        </div>
      </div>
    );
  };

  // [v3.0.6.11-104 Wave 2B] 统计总览: 检查概览卡 + 按模态分布表 + 每日趋势图
  const StatisticsTab = () => {
    const modalityColumns: TableColumnsType<ExamByModalityItem> = [
      {
        title: t("examPage.colModality"), dataIndex: "modality", key: "modality", width: 100,
        render: (v: string) => <span style={{ fontWeight: 700, color: PRIMARY }}>{v}</span>,
      },
      { title: t("examPage.colTotal"), dataIndex: "total", key: "total", width: 90, align: "center" },
      { title: t("examPage.colInProgress"), dataIndex: "inProgress", key: "inProgress", width: 100, align: "center" },
      { title: t("examPage.colCompleted"), dataIndex: "completed", key: "completed", width: 100, align: "center" },
      {
        title: t("examPage.colAvgDuration"), dataIndex: "avgDurationMin", key: "avgDurationMin", width: 120, align: "center",
        render: (v: number) => `${v} ${t("examPage.minuteShort")}`,
      },
    ]
    return (
      <div style={{ padding: 'var(--space-4, 16px)', display: 'flex', flexDirection: 'column', gap: 'var(--space-4, 16px)' }}>
        {/* 数据源徽标 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
          padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8,
          border: '1px solid var(--border-color)', fontSize: 12,
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 12px', borderRadius: 999, fontWeight: 600,
            background: statSource === 'real' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
            color: statSource === 'real' ? 'var(--color-success)' : 'var(--color-warning)',
          }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: statSource === 'real' ? 'var(--color-success)' : 'var(--color-warning)' }} />
            {t("examPage.dataSource")} {statSource === 'real' ? t("examPage.sourceRealApi") : t("examPage.sourceLocal")}
          </span>
          {statLoading && <span style={{ color: 'var(--color-warning)' }}>{t("examPage.syncing")}</span>}
          <ActionButton
            action="refresh"
            size="compact"
            style={{ marginLeft: 'auto' }}
            onClick={() => void loadStatistics()}
          >
            {t("examPage.refresh")}
          </ActionButton>
        </div>
        {statError && (
          <div style={{
            padding: '8px 12px', borderRadius: 6, fontSize: 12, color: 'var(--color-warning)',
            background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning-border)',
          }}>
            {statError}
          </div>
        )}

        {/* 1. 检查概览 KPI */}
        <DashboardCard title={t("examPage.examOverview")} icon={<Activity size={14} />} loading={statLoading} skeletonRows={2} testId="exam-stats-overview">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--space-3, 12px)' }}>
            <StatCard title={t("examPage.overviewTotal")} value={statOverview.total} icon={<Layers size={20} />} color="primary" />
            <StatCard title={t("examPage.overviewTodayScheduled")} value={statOverview.todayScheduled} icon={<ClipboardList size={20} />} color="info" />
            <StatCard title={t("examPage.overviewTodayCompleted")} value={statOverview.todayCompleted} icon={<CheckCircle2 size={20} />} color="success" />
            <StatCard title={t("examPage.overviewAvgDuration")} value={statOverview.avgDurationMin} suffix={t("examPage.minuteShort")} icon={<Timer size={20} />} color="warning" />
            <StatCard title={t("examPage.overviewRetakeRate")} value={`${statOverview.retakeRate}%`} icon={<RefreshCcw size={20} />} color="error" />
          </div>
        </DashboardCard>

        {/* 2. 按模态分布 */}
        <DashboardCard title={t("examPage.byModalityStat")} icon={<PieChartIcon size={14} />} loading={statLoading} skeletonRows={5} testId="exam-stats-by-modality">
          <DataTable<ExamByModalityItem>
            rowKey="modality"
            columns={modalityColumns}
            dataSource={statByModality}
            showPagination={false}
            emptyText={t("examPage.noExamData")}
          />
        </DashboardCard>

        {/* 3. 每日趋势 */}
        <DashboardCard title={t("examPage.dailyTrendStat")} icon={<TrendingUp size={14} />} loading={statLoading} skeletonRows={6} testId="exam-stats-daily-trend">
          <div style={{ marginBottom: 'var(--space-2, 8px)', fontSize: 12, color: 'var(--text-secondary)' }}>
            {t("examPage.last30Days")} · {statTrend.length} {t("examPage.casesUnit")}
          </div>
          <TrendChart
            type="area"
            data={statTrend.map((i) => ({ date: String(i.date).slice(5), created: i.created, completed: i.completed }))}
            xKey="date"
            series={[
              { key: 'created', name: t("examPage.seriesCreated"), color: 'var(--color-primary-500)', gradient: true },
              { key: 'completed', name: t("examPage.seriesCompleted"), color: 'var(--color-success-500)', gradient: true },
            ]}
            height={240}
            testId="exam-stats-daily-trend-chart"
          />
        </DashboardCard>
      </div>
    )
  }

  // ==================== 主渲染 ====================
  return (
    <div
      data-testid="exam-page"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "var(--bg-card)",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {loading && <LoadingBanner message={t("examPage.loading")} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Tab栏 */}
      <TabBar />

      {/* Batch action bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onAction={handleBatchAction}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: "assign", label: t("examPage.batchAssign"), icon: <UserCheck size={14} />, confirm: t("examPage.confirmAssign") },
          { key: "sign", label: t("examPage.batchSign"), icon: <CheckSquare size={14} />, confirm: t("examPage.confirmSign") },
          { key: "print", label: t("examPage.batchPrint"), icon: <Printer size={14} /> },
          { key: "export", label: t("examPage.batchExport2"), icon: <Download size={14} /> },
        ]}
      />

      {/* [v3.0.6.11-96 Wave 3A P1] 批量分配设备 Modal (worklistApi.batchAssign 真实调用) */}
      <Modal
        title={t("w9a.examPage.batchAssignTitle", { count: selectedIds.size })}
        open={batchAssignModal.visible}
        onCancel={() => setBatchAssignModal((prev) => ({ ...prev, visible: false }))}
        onOk={() => void handleBatchAssignConfirm()}
        okText={t("examPage.confirmAssign2")}
        cancelText={t("examPage.cancel")}
      >
        <div style={{ padding: "8px 0 4px", fontSize: 12, color: "var(--text-secondary)", marginBottom: 'var(--space-2, 8px)' }}>
          {t("examPage.forSelected")} {selectedIds.size} {t("examPage.assignDeviceFor")}
        </div>
        <Select
          style={{ width: "100%" }}
          placeholder={t("examPage.selectDevice")}
          value={batchAssignModal.deviceId || undefined}
          onChange={(v) => setBatchAssignModal((prev) => ({ ...prev, deviceId: v }))}
          options={initialModalityDevices.map((d) => ({ value: d.id, label: `${d.name}（${d.modality ?? ""}）` }))}
        />
      </Modal>

      {/* 检查列表Tab */}
      {activeTab === "list" && (
        <>
          {/* 顶部筛选栏 */}
          <FilterBar />
          {/* 检查列表表格 */}
          <ExamTable />
        </>
      )}

      {/* 技师执行Tab */}
      {activeTab === "technician" && <TechnicianExecutionTab />}

      {/* 转科追踪Tab */}
      {activeTab === "transfer" && <TransferTrackingTab />}

      {/* [v3.0.6.11-99 Wave10B] 深度分析Tab */}
      {activeTab === "analytics" && <AnalyticsTab />}

      {/* [v3.0.6.11-104 Wave 2B] 检查统计Tab */}
      {activeTab === "statistics" && <StatisticsTab />}

      {/* 底部统计栏 */}
      <StatsBar />

      {/* [G005 Wave4B] G-18 检查合并 Modal */}
      {showMergeModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 'var(--space-6, 24px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowMergeModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 560,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--color-modality-mr)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <MergeIcon size={18} color="var(--text-inverse)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-inverse)" }}>
                  {t("examPage.mergeExams")}
                </span>
              </div>
              <button
                onClick={() => setShowMergeModal(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--text-inverse)",
                  display: "flex",
                  alignItems: "center",
                  padding: 5,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 'var(--space-5, 20px)', overflowY: "auto", flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 'var(--space-3, 12px)' }}>
                {t("examPage.selected")} {selectedIds.size} {t("examPage.mergeNote")}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-2, 8px)' }}>
                {allExams
                  .filter((e) => selectedIds.has(e.id))
                  .map((e) => (
                    <label
                      key={e.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "10px 12px",
                        border: `1px solid ${
                          mergeTargetId === e.id ? "var(--color-modality-mr)" : "var(--border-color)"
                        }`,
                        borderRadius: 8,
                        background:
                          mergeTargetId === e.id ? "var(--color-modality-mr)18" : "var(--bg-card)",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="radio"
                        name="mergeTarget"
                        checked={mergeTargetId === e.id}
                        onChange={() => setMergeTargetId(e.id)}
                      />
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 12, color: "var(--text-primary)" }}>
                          {e.patientName} · {e.examItemName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {e.accessionNumber} · {e.modality} · {e.bodyPart}
                        </div>
                      </div>
                    </label>
                  ))}
              </div>
              {mergeResult && (
                <div
                  style={{
                    marginTop: 'var(--space-3, 12px)',
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    lineHeight: 1.6,
                    background: mergeResult.includes(t("examPage.success"))
                      ? "var(--color-success-bg)"
                      : "var(--color-error-bg)",
                    color: mergeResult.includes(t("examPage.success"))
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                >
                  {mergeResult}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 'var(--space-2, 8px)',
              }}
            >
              <ActionButton action="cancel" onClick={() => setShowMergeModal(false)}>
                {t("examPage.cancel")}
              </ActionButton>
              <ActionButton
                action="submit"
                loading={merging}
                disabled={merging}
                style={{ backgroundColor: "var(--color-modality-mr)", borderColor: "var(--color-modality-mr)" }}
                onClick={() => void handleMergeSubmit()}
              >
                {merging ? t("examPage.merging") : t("examPage.confirmMerge")}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* [G005 Wave4B] G-18 检查拆分 Modal */}
      {splitExam && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 'var(--space-6, 24px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setSplitExam(null);
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 520,
              maxHeight: "85vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: "var(--color-warning)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <SplitIcon size={18} color="var(--text-inverse)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-inverse)" }}>
                  {t("examPage.splitExam")}
                </span>
              </div>
              <button
                onClick={() => setSplitExam(null)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--text-inverse)",
                  display: "flex",
                  alignItems: "center",
                  padding: 5,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 'var(--space-5, 20px)', overflowY: "auto", flex: 1 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 'var(--space-3, 12px)' }}>
                {t("examPage.exam2")} {splitExam.accessionNumber}（{splitExam.patientName} ·{" "}
                {splitExam.examItemName}{t("examPage.splitNote")}
              </div>
              <textarea
                value={splitReportIds}
                onChange={(e) => setSplitReportIds(e.target.value)}
                rows={4}
                placeholder={t("examPage.examplePrefix") + (splitExam.reportId ?? "RPT-0001") + ", RPT-0002"}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 12,
                  resize: "vertical", boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
              />
              {splitResult && (
                <div
                  style={{
                    marginTop: 'var(--space-3, 12px)',
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    lineHeight: 1.6,
                    background: splitResult.includes(t("examPage.success"))
                      ? "var(--color-success-bg)"
                      : "var(--color-error-bg)",
                    color: splitResult.includes(t("examPage.success"))
                      ? "var(--color-success)"
                      : "var(--color-error)",
                  }}
                >
                  {splitResult}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 'var(--space-2, 8px)',
              }}
            >
              <ActionButton action="cancel" onClick={() => setSplitExam(null)}>
                {t("examPage.close")}
              </ActionButton>
              <ActionButton
                action="submit"
                loading={splitting}
                disabled={splitting}
                style={{ backgroundColor: "var(--color-warning)", borderColor: "var(--color-warning)" }}
                onClick={() => void handleSplitSubmit()}
              >
                {splitting ? t("examPage.splitting") : t("examPage.confirmSplit")}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* 操作Modal */}
      <ActionModal />

      {/* [W4-A] 批量导入 Modal */}
      {showImportModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.45)",
            zIndex: 1001,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 'var(--space-6, 24px)',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false);
          }}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 14,
              width: "100%",
              maxWidth: 680,
              maxHeight: "90vh",
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                background: PRIMARY,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Upload size={18} color="var(--text-inverse)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-inverse)" }}>
                  {t("examPage.batchImportExam")}
                </span>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "var(--text-inverse)",
                  display: "flex",
                  alignItems: "center",
                  padding: 5,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 'var(--space-5, 20px)', overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 10,
                  lineHeight: 1.8,
                }}
              >
                {t("examPage.supports")} <strong>{t("examPage.jsonArray")}</strong> {t("examPage.or")} <strong>CSV</strong> {t("examPage.importHeaderNote")}
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={t("examPage.importExample")}
                rows={8}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "monospace",
                  resize: "vertical", }}
              />
              <div style={{ marginTop: 10 }}>
                <label
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border-color)",
                    background: "var(--bg-card)",
                    fontSize: 12,
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  <Upload size={13} />
                  {t("examPage.uploadFiles")}
                  <input
                    type="file"
                    accept=".csv,.json,text/csv,application/json"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleExamImportFile(f);
                    }}
                  />
                </label>
              </div>
              {importResult && (
                <div
                  style={{
                    marginTop: 'var(--space-3, 12px)',
                    borderRadius: 8,
                    padding: "12px 14px",
                    border: "1px solid",
                    borderColor: importResult.errors.length > 0 ? "var(--color-warning-border)" : "var(--color-success-border)",
                    background: importResult.errors.length > 0 ? "var(--color-warning-bg)" : "var(--color-success-bg)",
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: importResult.errors.length > 0 ? "var(--color-warning)" : "var(--color-success)" }}>
                    {t("examPage.importDoneSuccess")} {importResult.imported} {t("examPage.skippedSuffix")} {importResult.skipped} {t("examPage.failedSuffix")} {importResult.errors.length}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto" }}>
                      {importResult.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: 12, color: "var(--color-warning)" }}>
                          • {err.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                justifyContent: "flex-end",
                gap: 10,
              }}
            >
              <ActionButton action="cancel" onClick={() => setShowImportModal(false)}>
                {t("examPage.close")}
              </ActionButton>
              <ActionButton
                action="import"
                loading={importing}
                disabled={importing || !importText.trim()}
                onClick={() => void handleExamImportSubmit()}
              >
                {importing ? t("examPage.importing") : t("examPage.startImport")}
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* [Wave1B P2] 新建检查 Modal: examApi.create */}
      <Modal
        title={t("examPage.newExam2")}
        open={showCreateModal}
        onOk={() => void handleCreateExam()}
        onCancel={() => setShowCreateModal(false)}
        confirmLoading={creatingExam}
        okText={t("examPage.create")}
        cancelText={t("examPage.cancel")}
        width={480}
      >
        <Form form={createExamForm} layout="vertical" size="small" style={{ marginTop: 'var(--space-3, 12px)' }} initialValues={{ modality: "CT", bodyPart: t("examPage.chest") }}>
          <Form.Item name="patientId" label={t("examPage.patient")} rules={[{ required: true, message: t("examPage.selectPatientRequired") }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder={t("examPage.selectPatient")}
              options={initialPatients.slice(0, 100).map((p) => ({
                value: p.id,
                label: `${p.name} (${p.id})`,
              }))}
            />
          </Form.Item>
          <Form.Item name="modality" label={t("examPage.modality")} rules={[{ required: true }]}>
            <Select options={MODALITY_LIST.filter((m) => m !== "全部").map((m) => ({ value: m, label: m }))} />
          </Form.Item>
          <Form.Item name="bodyPart" label={t("examPage.bodyPart")} rules={[{ required: true, message: t("examPage.bodyPartRequired") }]}>
            <Input placeholder={t("examPage.bodyPartPlaceholder")} />
          </Form.Item>
          <Form.Item name="accessionNumber" label={t("examPage.accessionOptional")}>
            <Input placeholder={t("examPage.accessionPlaceholder")} />
          </Form.Item>
        </Form>
      </Modal>

      {/* [W6] 检查前核对 (Time-Out) 门禁弹窗 */}
      <TimeoutVerifyModal
        open={timeoutExamId !== null}
        examId={timeoutExamId}
        onCancel={() => setTimeoutExamId(null)}
        onVerified={() => void handleTimeoutVerified()}
      />
    </div>
  );
}
