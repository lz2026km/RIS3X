// G005 放射RIS系统 - 技师工作站 v1.1.0
// 放射科技师工作台 · 检查列表与执行管理
import { useState, useMemo, useEffect } from "react";
import {
  User,
  Clock,
  AlertCircle,
  CheckCircle,
  Play,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
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
} from "lucide-react";
import { initialRadiologyExams } from "../data/initialData";
import { examApi } from "../services/api";
import type { ImportExamRow } from "../services/api";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import { useExamStore } from "../store/examStore";
import type { RadiologyExam } from "../types";
import BatchActionBar from "../components/batch/BatchActionBar";
import { AppButton } from "../components/common/AppButton";
import { useOperationLog } from "../hooks/useOperationLog";
import { useKeyboardShortcuts, useNavigationShortcuts, SHORTCUTS } from "../hooks/useKeyboardShortcuts";

// ==================== 常量配置 ====================
const PRIMARY = "#1e40af"; // 浅蓝
const PRIMARY_BG = "var(--color-info-bg)"; // 深蓝背景

// 优先级配置
const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  普通: { color: "var(--text-secondary)", bg: "var(--bg-deep)" },
  紧急: { color: "#f59e0b", bg: "#f59e0b22" },
  危重: { color: "#ef4444", bg: "#ef444422" },
};

// 状态配置
const STATUS_CONFIG: Record<
  string,
  { color: string; bg: string; label: string }
> = {
  待检查: { color: "#3b82f6", bg: "#3b82f622", label: "待检查" },
  检查中: { color: "#f59e0b", bg: "#f59e0b22", label: "检查中" },
  已报告: { color: "#16a34a", bg: "#22c55e22", label: "已报告" },
  已发布: { color: "#7c3aed", bg: "#8b5cf622", label: "已发布" },
  待报告: { color: "#0891b2", bg: "#06b6d422", label: "待报告" },
  已登记: { color: "var(--text-secondary)", bg: "var(--bg-deep)", label: "已登记" },
  已预约: { color: "var(--text-secondary)", bg: "var(--bg-deep)", label: "已预约" },
  // [audit-fix-2026-07-02] 报告状态 (mock backend 错误写入 exam.status)
  draft: { color: "var(--text-secondary)", bg: "var(--bg-deep)", label: "草稿" },
  submitted: { color: "#d1fae5", bg: "#059669", label: "已提交" },
  reviewed: { color: "#ecfdf5", bg: "#047857", label: "已审核" },
  cosigned: { color: "#dbeafe", bg: "#2563eb", label: "已会签" },
  published: { color: "#ecfdf5", bg: "#047857", label: "已发布" },
  rejected: { color: "#fee2e2", bg: "#dc2626", label: "已驳回" },
  revised: { color: "#fef3c7", bg: "#f59e0b", label: "已修订" },
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

type TabType = "list" | "technician" | "transfer";

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
  const config = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG["普通"];
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
    { key: "reserved", label: "已预约", color: "var(--text-secondary)", bgColor: "var(--bg-card)" },
    {
      key: "registered",
      label: "已登记",
      color: "#22c55e",
      bgColor: "var(--color-success-bg)",
    },
    {
      key: "inProgress",
      label: "检查中",
      color: "#3b82f6",
      bgColor: "var(--color-info-bg)",
    },
    { key: "imaging", label: "图像采集", color: "#eab308", bgColor: "var(--color-warning-bg)" },
    {
      key: "reporting",
      label: "报告书写",
      color: "#f97316",
      bgColor: "var(--color-warning-bg)",
    },
    {
      key: "reviewed",
      label: "报告审核",
      color: "#22c55e",
      bgColor: "var(--color-success-bg)",
    },
    { key: "published", label: "已发布", color: "#22c55e", bgColor: "#dcfce7" },
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
      node.color = "#22c55e";
      node.bgColor = "#dcfce7";
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
        node.color = "#3b82f6";
        node.bgColor = "#dbeafe";
      } else if (["图像采集"].includes(exam.status)) {
        node.color = "#eab308";
        node.bgColor = "#fef9c3";
      } else if (["报告书写", "待报告", "已报告"].includes(exam.status)) {
        node.color = "#f97316";
        node.bgColor = "#ffedd5";
      }
      // 检查是否超时（超过预计时间30分钟以上）
      if (["检查中", "图像采集"].includes(exam.status)) {
        node.isOverdue = Math.random() > 0.7; // 模拟30%超时率
        if (node.isOverdue) {
          node.color = "#dc2626";
          node.bgColor = "var(--color-error-bg)";
        }
      }
      node.timestamp = "进行中";
    }
  });

  return nodes;
};

// ==================== 主组件 ====================
export default function ExamPage() {
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
        setLoadError("API 不可用，使用本地数据");
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
        examItemName: `${e.modality ?? ""} ${e.bodyPart ?? ""}`.trim() || "检查",
        modality: e.modality,
        deviceNumber: e.deviceId ?? `D-${idx + 1}`,
        roomName: e.roomId ?? `R-${idx + 1}`,
        technologistName: e.technicianId ?? "当前技师",
        startTime: e.scheduledAt ?? "",
        estimatedDuration: 15,
        imagesAcquired: storeImagesOverride[e.id] ?? e.imageCount ?? 0,
        completed,
        signature: completed ? (e.technicianId ?? "技师") : undefined,
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
        gender: e.gender ?? "未知",
        age: e.age ?? 0,
        patientType: e.patientType ?? "门诊",
        transferReason: reason,
        fromDepartment: "开单科室",
        toDepartment: "放射科",
        transferTime: e.scheduledAt ?? "",
        attendingDoctor: e.doctorId ?? "主治医生",
        notes: e.contrastUsed ? "使用对比剂" : "常规检查",
        examCompleted: completed,
        examName: `${e.modality ?? ""} ${e.bodyPart ?? ""}`.trim() || "检查",
      }
    })
  }, [storeExams])

  // 同步 storeError 到 loadError 显示
  useEffect(() => {
    if (storeError) setLoadError(storeError)
  }, [storeError])

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

  // 总页数
  const totalPages = Math.max(1, Math.ceil(filteredExams.length / pageSize));

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

  const handleExecute = async () => {
    if (modal.exam?.id) {
      await useExamStore.getState().transition(modal.exam.id, "start");
    }
    closeModal();
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

  // Batch action handler
  const handleBatchAction = (action: string) => {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => log(action, id));
    setSelectedIds(new Set());
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
        link.download = res.data.filename || `检查列表_${new Date().toISOString().split("T")[0]}.csv`;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      throw new Error(res.error?.message ?? "导出接口无数据");
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
        ["检查ID,检查号,患者ID,患者姓名,设备,部位,状态,检查日期", ...rows].join("\n");
      const blob = new Blob(["\ufeff" + csvContent], {
        type: "text/csv;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `检查列表_${new Date().toISOString().split("T")[0]}.csv`;
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
      setImportResult({ imported: 0, skipped: 0, errors: [{ index: 0, message: "未解析到检查数据, 请检查 JSON/CSV 格式 (patientId/accessionNumber/modality/bodyPart 为必填)" }] });
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
        setImportResult({ imported: 0, skipped: 0, errors: [{ index: 0, message: res.error?.message ?? "导入失败" }] });
      }
    } catch (e) {
      setImportResult({ imported: 0, skipped: 0, errors: [{ index: 0, message: "导入失败: " + ((e as Error)?.message ?? String(e)) }] });
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
  useKeyboardShortcuts([
    SHORTCUTS.SUBMIT(handleSubmit),
    SHORTCUTS.CANCEL(() => { if (modal.visible) closeModal(); }),
  ]);
  useNavigationShortcuts([
    { sequence: ['g', 'e'], action: () => { window.location.href = '/exam'; }, description: '导航到检查' },
  ]);

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
        { key: "list" as TabType, label: "检查列表", icon: ClipboardList },
        { key: "technician" as TabType, label: "技师执行", icon: Monitor },
        { key: "transfer" as TabType, label: "转科追踪", icon: ArrowRight },
      ].map((tab) => (
        <AppButton
          key={tab.key}
          variant="text"
          size="default"
          onClick={() => setActiveTab(tab.key)}
          style={{
            padding: "14px 20px",
            borderBottom: `2px solid ${activeTab === tab.key ? PRIMARY : "transparent"}`,
            color: activeTab === tab.key ? PRIMARY : "#64748b",
            borderRadius: 0,
          }}
        >
          <tab.icon size={16} />
          {tab.label}
          {tab.key === "technician" && (
            <span
              style={{
                backgroundColor: PRIMARY,
                color: "#fff",
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
                backgroundColor: "#f97316",
                color: "#fff",
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
        gap: 12,
        alignItems: "center",
      }}
    >
      {/* 标题 */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginRight: 8,
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
          <Activity size={16} style={{ color: "#fff" }} />
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: PRIMARY }}>
            技师工作站
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>检查执行管理</div>
        </div>
      </div>

      {/* 分隔线 */}
      <div style={{ width: 1, height: 32, backgroundColor: "#e2e8f0" }} />

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
          placeholder="搜索患者/检查号..."
          value={filters.search}
          onChange={(e) => handleFilterChange("search", e.target.value)}
          style={{
            width: "100%",
            padding: "8px 10px 8px 32px",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            fontSize: 12,
            outline: "none",
            boxSizing: "border-box",
          }}
          onFocus={(e) => (e.target.style.borderColor = PRIMARY)}
          onBlur={(e) => (e.target.style.borderColor = "var(--border-color)")}
        />
      </div>

      {/* 优先级筛选 */}
      <select
        value={filters.priority}
        onChange={(e) => handleFilterChange("priority", e.target.value)}
        style={{
          padding: "8px 12px",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          fontSize: 12,
          outline: "none",
          cursor: "pointer",
          backgroundColor:
            filters.priority !== "全部"
              ? PRIORITY_CONFIG[filters.priority]?.bg
              : "var(--bg-card)",
        }}
      >
        {["全部", "普通", "紧急", "危重"].map((p) => (
          <option key={p} value={p}>
            {p === "全部" ? "全部优先级" : `⚑ ${p}`}
          </option>
        ))}
      </select>

      {/* 状态筛选 */}
      <select
        value={filters.status}
        onChange={(e) => handleFilterChange("status", e.target.value)}
        style={{
          padding: "8px 12px",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          fontSize: 12,
          outline: "none",
          cursor: "pointer",
        }}
      >
        {["全部", "待检查", "检查中", "已报告", "已发布", "待报告"].map((s) => (
          <option key={s} value={s}>
            {s === "全部" ? "全部状态" : s}
          </option>
        ))}
      </select>

      {/* 设备类型筛选 */}
      <select
        value={filters.modality}
        onChange={(e) => handleFilterChange("modality", e.target.value)}
        style={{
          padding: "8px 12px",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          fontSize: 12,
          outline: "none",
          cursor: "pointer",
        }}
      >
        {MODALITY_LIST.map((m) => (
          <option key={m} value={m}>
            {m === "全部" ? "全部设备" : m}
          </option>
        ))}
      </select>

      {/* 患者类型筛选 */}
      <select
        value={filters.patientType}
        onChange={(e) => handleFilterChange("patientType", e.target.value)}
        style={{
          padding: "8px 12px",
          border: "1px solid var(--border-color)",
          borderRadius: 6,
          fontSize: 12,
          outline: "none",
          cursor: "pointer",
        }}
      >
        {PATIENT_TYPE_LIST.map((t) => (
          <option key={t} value={t}>
            {t === "全部" ? "全部患者" : t}
          </option>
        ))}
      </select>

      {/* 清空筛选 */}
      {(filters.search ||
        filters.priority !== "全部" ||
        filters.status !== "全部" ||
        filters.modality !== "全部" ||
        filters.patientType !== "全部") && (
        <button
          onClick={() =>
            setFilters({
              search: "",
              priority: "全部",
              status: "全部",
              modality: "全部",
              patientType: "全部",
            })
          }
          style={{
            padding: "8px 12px",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            fontSize: 12,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
            backgroundColor: "var(--bg-card)",
            color: "var(--text-secondary)",
          }}
        >
          <X size={12} /> 清空
        </button>
      )}

      {/* [W4-A] 批量导入导出 */}
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          onClick={() => setShowImportModal(true)}
          style={{
            padding: "8px 14px",
            border: "1px solid #059669",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "var(--bg-card)",
            color: "#059669",
          }}
        >
          <Upload size={13} /> 批量导入
        </button>
        <button
          onClick={() => void handleExamExport()}
          style={{
            padding: "8px 14px",
            border: "1px solid var(--border-color)",
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            backgroundColor: "var(--bg-card)",
            color: PRIMARY,
          }}
        >
          <Download size={13} /> 批量导出
        </button>
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
              title={`${node.label}${node.timestamp ? ": " + node.timestamp : ""}${node.isOverdue ? " (超时)" : ""}`}
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
  const ExamTable = () => (
    <div style={{ flex: 1, overflow: "auto", backgroundColor: "var(--bg-card)" }}>
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
              backgroundColor: PRIMARY_BG,
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            {[
              "",
              "检查号",
              "患者信息",
              "检查项目",
              "设备",
              "优先级",
              "状态",
              "检查时间",
              "操作",
            ].map((h, _i) => (
              <th
                key={h}
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: PRIMARY,
                  borderBottom: `2px solid ${PRIMARY}`,
                  whiteSpace: "nowrap",
                }}
              >
                {h}
              </th>
            ))}
            {/* 批量选择 */}
            <th style={{ padding: "10px 12px", textAlign: "center", borderBottom: `2px solid ${PRIMARY}`, width: 40 }}>
              <input
                type="checkbox"
                checked={paginatedExams.length > 0 && paginatedExams.every((e) => selectedIds.has(e.id))}
                onChange={() => {
                  if (paginatedExams.every((e) => selectedIds.has(e.id))) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(paginatedExams.map((e) => e.id)));
                  }
                }}
                style={{ cursor: "pointer", width: 16, height: 16 }}
              />
            </th>
            {/* 新增：状态时间轴表头 */}
            <th
              style={{
                padding: "10px 12px",
                textAlign: "left",
                fontWeight: 600,
                color: PRIMARY,
                borderBottom: `2px solid ${PRIMARY}`,
                whiteSpace: "nowrap",
              }}
            >
              闭环状态
            </th>
          </tr>
        </thead>
        <tbody>
          {paginatedExams.length === 0 ? (
            <tr>
              <td
                  colSpan={10}
                  style={{
                  padding: "40px 12px",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Search size={32} style={{ opacity: 0.5 }} />
                  <div>未找到符合条件的检查记录</div>
                </div>
              </td>
            </tr>
          ) : (
            paginatedExams.map((exam, idx) => {
              const pStyle = getPriorityStyle(exam.priority);
              const sStyle = getStatusStyle(exam.status);
              return (
                <tr
                  key={exam.id}
                  style={{
                    backgroundColor: idx % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)",
                    transition: "background-color 0.15s",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = PRIMARY_BG)
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor =
                      idx % 2 === 0 ? "var(--bg-card)" : "var(--bg-primary)")
                  }
                >
                  {/* 批量选择 */}
                  <td style={{ padding: "10px 12px", textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(exam.id)}
                      onChange={() => {
                        const next = new Set(selectedIds);
                        if (next.has(exam.id)) next.delete(exam.id);
                        else next.add(exam.id);
                        setSelectedIds(next);
                      }}
                      style={{ cursor: "pointer", width: 16, height: 16 }}
                    />
                  </td>
                  {/* 检查号 */}
                  <td
                    style={{
                      padding: "10px 12px",
                      fontFamily: "monospace",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {exam.accessionNumber}
                  </td>
                  {/* 患者信息 */}
                  <td style={{ padding: "10px 12px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          backgroundColor: PRIMARY_BG,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <User size={14} style={{ color: PRIMARY }} />
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                          {exam.patientName}
                        </div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                          {exam.gender} · {exam.age}岁 · {exam.patientType}
                        </div>
                      </div>
                    </div>
                  </td>
                  {/* 检查项目 */}
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ fontWeight: 500, color: "var(--text-primary)" }}>
                      {exam.examItemName}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {exam.modality} · {exam.bodyPart}
                    </div>
                  </td>
                  {/* 设备 */}
                  <td style={{ padding: "10px 12px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Monitor size={12} style={{ color: "var(--text-secondary)" }} />
                      <span style={{ color: "var(--text-secondary)" }}>
                        {exam.deviceName?.split("（")[0] || "-"}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {exam.roomName}
                    </div>
                  </td>
                  {/* 优先级 */}
                  <td style={{ padding: "10px 12px" }}>
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
                      {exam.priority}
                    </span>
                  </td>
                  {/* 状态 */}
                  <td style={{ padding: "10px 12px" }}>
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
                  </td>
                  {/* 检查时间 */}
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ color: "var(--text-secondary)" }}>{exam.examDate}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      {formatTime(exam.examTime)}
                    </div>
                  </td>
                  {/* 操作 */}
                  <td style={{ padding: "10px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      {exam.status === "待检查" && (
                        <AppButton
                          variant="primary"
                          size="compact"
                          onClick={() => openModal(exam, "start")}
                          icon={<Play size={10} />}
                        >
                          开始
                        </AppButton>
                      )}
                      {exam.status === "检查中" && (
                        <>
                          <button
                            onClick={() => openModal(exam, "complete")}
                            style={{
                              padding: "4px 10px",
                              borderRadius: 4,
                              border: "none",
                              backgroundColor: "#16a34a",
                              color: "#fff",
                              fontSize: 12,
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "flex",
                              alignItems: "center",
                              gap: 4,
                            }}
                          >
                            <CheckCircle2 size={10} /> 完成
                          </button>
                          <button
                            onClick={() => openModal(exam, "quality")}
                            style={{
                              padding: "4px 8px",
                              borderRadius: 4,
                              border: "1px solid var(--border-color)",
                              backgroundColor: "var(--bg-card)",
                              color: "var(--text-secondary)",
                              fontSize: 12,
                              cursor: "pointer",
                            }}
                          >
                            质量
                          </button>
                        </>
                      )}
                      {(exam.status === "已报告" ||
                        exam.status === "待报告") && (
                        <button
                          onClick={() => openModal(exam, "quality")}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 4,
                            border: "1px solid var(--border-color)",
                            backgroundColor: "var(--bg-card)",
                            color: "var(--text-secondary)",
                            fontSize: 12,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FileText size={10} /> 查看
                        </button>
                      )}
                    </div>
                  </td>
                  {/* 闭环状态时间轴 */}
                  <td style={{ padding: "10px 12px" }}>
                    <StatusTimeline exam={exam} />
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );

  // 技师执行Tab内容
  const TechnicianExecutionTab = () => (
    <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}
      >
        {techExecutions.map((execution) => (
          <div
            key={execution.id}
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: 12,
              padding: 20,
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
                marginBottom: 16,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                    marginBottom: 4,
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
                  color: execution.completed ? "#16a34a" : PRIMARY,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                {execution.completed ? "已完成" : "进行中"}
              </div>
            </div>

            {/* 设备信息 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
                marginBottom: 16,
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
                  设备编号
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
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
                  检查室
                </div>
                <div
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
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
                gap: 8,
                marginBottom: 12,
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
                （当前登录）
              </span>
            </div>

            {/* 时间信息 */}
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 16,
              }}
            >
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>开始时间</div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {execution.startTime}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>预计时长</div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {execution.estimatedDuration}分钟
                </div>
              </div>
            </div>

            {/* 图像采集数量 */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  图像采集数量
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
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
                      color: execution.completed ? "#94a3b8" : PRIMARY,
                      backgroundColor: execution.completed ? "var(--bg-primary)" : "var(--bg-card)",
                    }}
                  />
                  <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>帧</span>
                </div>
              </div>
              {/* 采集进度条 */}
              <div
                style={{
                  height: 6,
                  backgroundColor: "#e2e8f0",
                  borderRadius: 3,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, (execution.imagesAcquired / (execution.estimatedDuration * 15)) * 100)}%`,
                    backgroundColor: execution.completed ? "#16a34a" : PRIMARY,
                    borderRadius: 3,
                    transition: "width 0.3s",
                  }}
                />
              </div>
            </div>

            {/* 采集完成按钮 */}
            {!execution.completed && (
              <button
                onClick={() => handleConfirmComplete(execution.id)}
                style={{
                  width: "100%",
                  padding: "10px 16px",
                  borderRadius: 8,
                  border: "none",
                  backgroundColor: PRIMARY,
                  color: "#fff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                <CheckCircle2 size={16} />
                确认采集完成
              </button>
            )}

            {/* 技师电子签名 */}
            {execution.completed && execution.signature && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
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
                  <CheckCircle size={16} style={{ color: "#16a34a" }} />
                </div>
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                    技师电子签名
                  </div>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: "#16a34a",
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
    <div style={{ flex: 1, overflow: "auto", padding: 20 }}>
      {/* 统计卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 16,
          marginBottom: 24,
        }}
      >
        {[
          {
            label: "转科总数",
            value: transferRecords.length,
            color: PRIMARY,
            bg: PRIMARY_BG,
          },
          {
            label: "急诊→住院",
            value: transferRecords.filter(
              (r) => r.transferReason === "急诊→住院",
            ).length,
            color: "#ef4444", bg: "#ef444422",
          },
          {
            label: "住院→转科",
            value: transferRecords.filter(
              (r) => r.transferReason === "住院→转科",
            ).length,
            color: "#f59e0b", bg: "#f59e0b22",
          },
          {
            label: "待完成检查",
            value: transferRecords.filter((r) => !r.examCompleted).length,
            color: "#f97316",
            bg: "#f9731622",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: 12,
              padding: 16,
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              borderLeft: `4px solid ${stat.color}`,
            }}
          >
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* 转科记录列表 */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {transferRecords.map((record) => (
          <div
            key={record.id}
            style={{
              backgroundColor: "var(--bg-card)",
              borderRadius: 12,
              padding: 20,
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
                marginBottom: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                    {record.gender} · {record.age}岁 · {record.patientType}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 4,
                }}
              >
                <div
                  style={{
                    padding: "4px 10px",
                    borderRadius: 20,
                    backgroundColor: record.examCompleted
                      ? "var(--color-success-bg)"
                      : "var(--color-warning-bg)",
                    color: record.examCompleted ? "#16a34a" : "#d97706",
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  {record.examCompleted ? "✓ 检查已完成" : "⏳ 检查待完成"}
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
                        ? "#dc2626"
                        : record.transferReason === "住院→转科"
                          ? "#d97706"
                          : "#2563eb",
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
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                }}
              >
                <ArrowRight size={14} style={{ color: "#dc2626" }} />
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>转出科室</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
                  >
                    {record.fromDepartment}
                  </div>
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 14px",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: 8,
                }}
              >
                <ArrowRight size={14} style={{ color: "#16a34a" }} />
                <div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>转入科室</div>
                  <div
                    style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}
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
                gap: 24,
                marginBottom: 12,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Clock size={12} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  转科时间：
                </span>
                <span
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {record.transferTime}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Stethoscope size={12} style={{ color: "var(--text-secondary)" }} />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  主治医生：
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
                  borderLeft: "3px solid #eab308",
                  marginBottom: 12,
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#a16207",
                    marginBottom: 4,
                  }}
                >
                  转科备注
                </div>
                <div style={{ fontSize: 12, color: "#78500b" }}>
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
                  gap: 8,
                  padding: "10px 14px",
                  backgroundColor: record.examCompleted ? "var(--color-success-bg)" : "var(--color-warning-bg)",
                  borderRadius: 8,
                  border: `1px solid ${record.examCompleted ? "#bbf7d0" : "#fed7aa"}`,
                }}
              >
                <ClipboardList
                  size={14}
                  style={{
                    color: record.examCompleted ? "#16a34a" : "#f97316",
                  }}
                />
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  跟随检查：
                </span>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: record.examCompleted ? "#16a34a" : "#f97316",
                  }}
                >
                  {record.examName}
                </span>
                {record.examCompleted && (
                  <CheckCircle
                    size={14}
                    style={{ color: "#16a34a", marginLeft: "auto" }}
                  />
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  // 分页组件
  const Pagination = () => (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        borderTop: "1px solid var(--border-color)",
        padding: "10px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}
    >
      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
        共{" "}
        <span style={{ fontWeight: 600, color: PRIMARY }}>
          {filteredExams.length}
        </span>{" "}
        条记录， 第{" "}
        <span style={{ fontWeight: 600, color: PRIMARY }}>{page}</span> /{" "}
        {totalPages} 页
      </div>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={() => setPage(1)}
          disabled={page === 1}
          style={{
            padding: "6px 10px",
            borderRadius: 4,
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-card)",
            color: page === 1 ? "#cbd5e1" : PRIMARY,
            fontSize: 12,
            cursor: page === 1 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ChevronLeft size={14} />
          <ChevronLeft size={14} />
        </button>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            padding: "6px 10px",
            borderRadius: 4,
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-card)",
            color: page === 1 ? "#cbd5e1" : PRIMARY,
            fontSize: 12,
            cursor: page === 1 ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ChevronLeft size={14} />
        </button>
        {/* 页码 */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let p;
          if (totalPages <= 5) {
            p = i + 1;
          } else if (page <= 3) {
            p = i + 1;
          } else if (page >= totalPages - 2) {
            p = totalPages - 4 + i;
          } else {
            p = page - 2 + i;
          }
          return (
            <button
              key={p}
              onClick={() => setPage(p)}
              style={{
                minWidth: 32,
                padding: "6px 8px",
                borderRadius: 4,
                border: "1px solid",
                borderColor: page === p ? PRIMARY : "#e2e8f0",
                backgroundColor: page === p ? PRIMARY : "var(--bg-card)",
                color: page === p ? "#fff" : "#64748b",
                fontSize: 12,
                cursor: "pointer",
                fontWeight: page === p ? 600 : 400,
              }}
            >
              {p}
            </button>
          );
        })}
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            padding: "6px 10px",
            borderRadius: 4,
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-card)",
            color: page === totalPages ? "#cbd5e1" : PRIMARY,
            fontSize: 12,
            cursor: page === totalPages ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ChevronRight size={14} />
        </button>
        <button
          onClick={() => setPage(totalPages)}
          disabled={page === totalPages}
          style={{
            padding: "6px 10px",
            borderRadius: 4,
            border: "1px solid var(--border-color)",
            backgroundColor: "var(--bg-card)",
            color: page === totalPages ? "#cbd5e1" : PRIMARY,
            fontSize: 12,
            cursor: page === totalPages ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <ChevronRight size={14} />
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );

  // 底部统计栏
  const StatsBar = () => (
    <div
      style={{
        backgroundColor: PRIMARY,
        padding: "12px 20px",
        display: "flex",
        gap: 24,
      }}
    >
      {[
        {
          label: "全部记录",
          value: stats.total,
          icon: FileText,
          color: "#fff",
        },
        {
          label: "待检查",
          value: stats.pending,
          icon: Clock,
          color: "#60a5fa",
        },
        {
          label: "检查中",
          value: stats.inProgress,
          icon: Activity,
          color: "#fbbf24",
        },
        {
          label: "已完成",
          value: stats.completed,
          icon: CheckCircle,
          color: "#4ade80",
        },
        {
          label: "危重",
          value: stats.critical,
          icon: AlertCircle,
          color: "#f87171",
        },
      ].map((item) => (
        <div
          key={item.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <item.icon size={16} style={{ color: item.color, opacity: 0.9 }} />
          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: "#fff",
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
        title: "开始检查",
        color: PRIMARY,
        confirmText: "确认开始",
        icon: Play,
      },
      complete: {
        title: "完成检查",
        color: "#16a34a",
        confirmText: "确认完成",
        icon: CheckCircle2,
      },
      cancel: {
        title: "取消检查",
        color: "#dc2626",
        confirmText: "确认取消",
        icon: XCircle,
      },
      quality: {
        title: "图像质量评定",
        color: "#0891b2",
        confirmText: "保存评定",
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
                gap: 8,
                color: "#fff",
              }}
            >
              <actionConfig.icon size={18} />
              <span style={{ fontWeight: 600, fontSize: 15 }}>
                {actionConfig.title}
              </span>
            </div>
            <button
              onClick={closeModal}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.8)",
                cursor: "pointer",
                padding: 4,
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 20 }}>
            {/* 患者信息 */}
            <div
              style={{
                backgroundColor: "var(--bg-card)",
                borderRadius: 8,
                padding: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>患者姓名</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                  {modal.exam.patientName}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>检查项目</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {modal.exam.examItemName}
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>检查号</span>
                <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                  {modal.exam.accessionNumber}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>设备</span>
                <span style={{ color: "var(--text-primary)" }}>
                  {modal.exam.deviceName?.split("（")[0]}
                </span>
              </div>
            </div>

            {/* 操作特定内容 */}
            {modal.action === "quality" && (
              <div style={{ marginBottom: 16 }}>
                <label
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    display: "block",
                    marginBottom: 8,
                  }}
                >
                  图像质量评级
                </label>
                <div style={{ display: "flex", gap: 8 }}>
                  {["优", "良", "差"].map((q) => (
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
                              ? "#16a34a"
                              : q === "良"
                                ? "#d97706"
                                : "#dc2626"
                            : "#e2e8f0",
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
                              ? "#16a34a"
                              : q === "良"
                                ? "#d97706"
                                : "#dc2626"
                            : "#64748b",
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
                  marginBottom: 8,
                }}
              >
                操作备注
              </label>
              <textarea
                value={actionNotes}
                onChange={(e) => setActionNotes(e.target.value)}
                placeholder="请输入操作备注（可选）..."
                rows={3}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 12,
                  resize: "none",
                  outline: "none",
                  boxSizing: "border-box",
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
              gap: 8,
            }}
          >
            <button
              onClick={closeModal}
              style={{
                padding: "8px 16px",
                borderRadius: 6,
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--bg-card)",
                color: "var(--text-secondary)",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={handleExecute}
              style={{
                padding: "8px 20px",
                borderRadius: 6,
                border: "none",
                backgroundColor: actionConfig.color,
                color: "#fff",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {actionConfig.confirmText}
            </button>
          </div>
        </div>
      </div>
    );
  };

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
      {loading && <LoadingBanner message="正在从 API 加载检查数据..." />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* Tab栏 */}
      <TabBar />

      {/* Batch action bar */}
      <BatchActionBar
        selectedCount={selectedIds.size}
        onAction={handleBatchAction}
        onClear={() => setSelectedIds(new Set())}
        actions={[
          { key: "assign", label: "批量分配", icon: <UserCheck size={14} />, confirm: "确认分配?" },
          { key: "sign", label: "批量签字", icon: <CheckSquare size={14} />, confirm: "确认签字?" },
          { key: "print", label: "批量打印", icon: <Printer size={14} /> },
          { key: "export", label: "批量导出", icon: <Download size={14} /> },
        ]}
      />

      {/* 检查列表Tab */}
      {activeTab === "list" && (
        <>
          {/* 顶部筛选栏 */}
          <FilterBar />
          {/* 检查列表表格 */}
          <ExamTable />
          {/* 分页 */}
          <Pagination />
        </>
      )}

      {/* 技师执行Tab */}
      {activeTab === "technician" && <TechnicianExecutionTab />}

      {/* 转科追踪Tab */}
      {activeTab === "transfer" && <TransferTrackingTab />}

      {/* 底部统计栏 */}
      <StatsBar />

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
            padding: 24,
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
                <Upload size={18} color="#fff" />
                <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  批量导入检查
                </span>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  background: "rgba(255,255,255,0.15)",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer",
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  padding: 5,
                }}
              >
                <X size={16} />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  marginBottom: 10,
                  lineHeight: 1.8,
                }}
              >
                支持 <strong>JSON 数组</strong> 或 <strong>CSV</strong> (表头:
                patientId/accessionNumber/modality/bodyPart/scheduledAt/deviceId)。
                患者不存在将报错列出, 检查号重复自动跳过。
              </div>
              <textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={'[\n  { "patientId": "P000001", "accessionNumber": "ACC-2026-0001", "modality": "CT", "bodyPart": "胸部", "scheduledAt": "2026-08-07T09:00:00.000Z" }\n]'}
                rows={8}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "10px 12px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 8,
                  fontSize: 12,
                  fontFamily: "monospace",
                  resize: "vertical",
                  outline: "none",
                }}
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
                  上传 .csv / .json 文件
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
                    marginTop: 12,
                    borderRadius: 8,
                    padding: "12px 14px",
                    border: "1px solid",
                    borderColor: importResult.errors.length > 0 ? "#fde68a" : "#bbf7d0",
                    background: importResult.errors.length > 0 ? "var(--color-warning-bg)" : "var(--color-success-bg)",
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 700, color: importResult.errors.length > 0 ? "#92400e" : "#166534" }}>
                    导入完成: 成功 {importResult.imported} / 跳过 {importResult.skipped} / 失败 {importResult.errors.length}
                  </div>
                  {importResult.errors.length > 0 && (
                    <div style={{ marginTop: 6, maxHeight: 120, overflowY: "auto" }}>
                      {importResult.errors.map((err, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#d97706" }}>
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
              <button
                onClick={() => setShowImportModal(false)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                关闭
              </button>
              <button
                onClick={() => void handleExamImportSubmit()}
                disabled={importing || !importText.trim()}
                style={{
                  padding: "8px 20px",
                  borderRadius: 8,
                  border: "none",
                  background: importing || !importText.trim() ? "#94a3b8" : PRIMARY,
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  cursor: importing || !importText.trim() ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Upload size={13} />
                {importing ? "导入中..." : "开始导入"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
