// [v3.0.6.11-103 Wave 6] 表格统一: ProTable → DataTable (斑马纹/行高/列头/分页统一)
import { DataTable } from "../../components/common/DataTable";
import type { ProColumn } from "../../components/data/ProTable";
import type { TableColumnsType } from "antd";
import {
  initialModalityDevices,
  initialExamRooms,
  initialUsers,
} from "../../data/initialData";
import { usePagination } from "../../hooks/usePagination";
import type { RadiologyExam } from "../../types";
import { displayExamStatus } from "../../utils/statusMaps";
import { Button, Empty, Skeleton, Tag } from "antd";
import {
  User,
  Scan,
  Monitor,
  Radio,
  Stethoscope,
  AlertTriangle,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  FileText,
  History,
  UserCheck,
  AlertOctagon,
  CheckCircle2,
  CloudDownload,
  ExternalLink,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Inbox } from 'lucide-react'
import { useNavigate } from "react-router-dom";
import { t } from "../../i18n/appI18n";
// [W14-UX] 右键上下文菜单
import { useContextMenu, type ContextMenuItem } from "../../components/common/ContextMenu";
// [W14-UX] 统一状态色 (消除本页重复色值映射, 与报告/审核域一致)
import { getReportStatusColor } from "../../components/report/statusMeta";

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; order: number }
> = {
  SCHEDULED: { bg: "#3b82f622", color: "var(--color-primary-500)", label: "wl.statusRegistered", order: 0 },
  ARRIVED: { bg: "#8b5cf622", color: "#7c3aed", label: "wl.statusArrived", order: 1 },
  IN_PROGRESS: { bg: "#ec489922", color: "#db2777", label: "wl.statusInProgress", order: 2 },
  // [v3.0.6.11-95 Wave 1A P1] 暂停态 + 影像质控态映射
  PAUSED: { bg: "#f59e0b22", color: "var(--color-warning-500)", label: "wl.statusPaused", order: 2.5 },
  IMAGE_READY: { bg: "#10b98122", color: "#0f766e", label: "wl.statusImageReady", order: 3.5 },
  QC_REJECT: { bg: "#ef444422", color: "var(--color-error-600)", label: "wl.statusQcReject", order: 3.6 },
  QC_PASS: { bg: "#0ea5e922", color: "#0369a1", label: "wl.statusQcPass", order: 3.7 },
  PENDING_REPORT: { bg: "#f59e0b22", color: "#ca8a04", label: "wl.statusPendingReport", order: 3.8 },
  COMPLETED: { bg: "#22c55e22", color: "#059669", label: "wl.statusCompleted", order: 3 },
  CANCELLED: { bg: "#ef444422", color: "var(--color-error-500)", label: "wl.statusCancelled", order: 8 },
  已登记: { bg: "#3b82f622", color: "var(--color-primary-500)", label: "wl.statusRegistered", order: 0 },
  待检查: { bg: "#8b5cf622", color: "#7c3aed", label: "wl.statusWaitingExam", order: 1 },
  检查中: { bg: "#ec489922", color: "#db2777", label: "wl.statusInProgress", order: 2 },
  待报告: { bg: "#f59e0b22", color: "#ca8a04", label: "wl.statusPendingReport", order: 3 },
  已报告: { bg: "#22c55e22", color: "#059669", label: "wl.statusReported", order: 4 },
  已发布: { bg: "#22c55e22", color: "#047857", label: "wl.statusPublished", order: 5 },
  published: { bg: "#22c55e22", color: "#047857", label: "wl.statusPublished", order: 5 },
  submitted: { bg: "#22c55e22", color: "#059669", label: "wl.statusSubmitted", order: 4.5 },
  reviewed: { bg: "#22c55e22", color: "#047857", label: "wl.statusReviewed", order: 5.5 },
  inProgress: { bg: "#ec489922", color: "#db2777", label: "wl.statusInProgress", order: 2 },
  completed: { bg: "#22c55e22", color: "#059669", label: "wl.statusCompleted", order: 4.5 },
  已暂停: { bg: "#f59e0b22", color: "var(--color-warning-500)", label: "wl.statusPaused", order: 7 },
  质控退回: { bg: "#ef444422", color: "var(--color-error-500)", label: "wl.statusQcReject", order: 8 },
};

const PRIORITY_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; order: number }
> = {
  普通: { bg: "var(--bg-deep)", color: "var(--text-secondary)", label: "wl.priorityNormal", order: 0 },
  紧急: { bg: "#f59e0b22", color: "var(--color-warning-500)", label: "wl.priorityUrgent", order: 1 },
  危重: { bg: "#ef444422", color: "var(--color-error-500)", label: "wl.priorityCritical", order: 2 },
  会诊: { bg: "#8b5cf622", color: "#7c3aed", label: "wl.priorityConsult", order: 3 },
};

const getDeviceById = (deviceId: string) =>
  initialModalityDevices.find((device) => device.id === deviceId);
const getRoomById = (roomId: string) =>
  initialExamRooms.find((room) => room.id === roomId);
const getDoctorById = (doctorId: string) =>
  initialUsers.find((user) => user.id === doctorId);

function getSLAInfo(createdTime: string) {
  const created = new Date(createdTime).getTime();
  const elapsedMinutes = Number.isFinite(created)
    ? Math.max(0, Math.floor((Date.now() - created) / 60000))
    : 0;
  if (elapsedMinutes > 60) {
    return { elapsedMinutes, status: "critical", color: "var(--color-error-600)" };
  }
  if (elapsedMinutes > 30) {
    return { elapsedMinutes, status: "warning", color: "var(--color-warning-600)" };
  }
  return { elapsedMinutes, status: "normal", color: "#059669" };
}

function calculatePriority(exam: RadiologyExam) {
  const ageScore = exam.age >= 70 ? 30 : exam.age >= 60 ? 20 : exam.age >= 50 ? 10 : 0;
  const created = new Date(exam.createdTime).getTime();
  const waitMinutes = Number.isFinite(created) ? (Date.now() - created) / 60000 : 0;
  const waitScore = waitMinutes > 120 ? 25 : waitMinutes > 60 ? 15 : waitMinutes > 30 ? 8 : 0;
  const typeScore = exam.patientType === "急诊" ? 25 : exam.patientType === "住院" ? 15 : 5;
  const partScore = ["头颅", "心脏", "血管"].includes(exam.bodyPart) ? 20 : 10;
  const score = ageScore + waitScore + typeScore + partScore;
  if (score >= 70) return { score, color: "var(--color-error-500)", bg: "#ef444422" };
  if (score >= 45) return { score, color: "var(--color-warning-500)", bg: "#f59e0b22" };
  if (score >= 25) return { score, color: "var(--text-secondary)", bg: "var(--bg-deep)" };
  return { score, color: "#059669", bg: "#22c55e22" };
}

interface ListViewProps {
  exams: RadiologyExam[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onRowClick: (exam: RadiologyExam) => void;
  loading?: boolean;
  onAssignDoctor?: (exam: RadiologyExam) => void;
  onViewRequisition?: (exam: RadiologyExam) => void;
  onViewHistory?: (exam: RadiologyExam) => void;
  onCriticalValueClick?: (exam: RadiologyExam) => void;
  /** [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 行内影像预取状态: examId -> cached/queued/none */
  prefetchStatus?: Record<string, 'cached' | 'queued' | 'none'>;
  /** [G005 v3.0.6.11-96 Wave 2B (D)] C-STORE 传输状态 (从 listTransfers 派生): examId|accessionNumber -> queued/sending/paused/failed/completed/canceled */
  transferStatus?: Record<string, string>;
  /** [G005 v3.0.6.11-99 Wave 10E-1] 列配置面板: 隐藏列 key 集合 (actions 列恒显示) */
  hiddenColumns?: string[];
  /** [W14-UX] 右键上下文菜单动作 (查看/分配/打印/导出/危急值/重排/取消) */
  contextActions?: {
    onView?: (exam: RadiologyExam) => void;
    onAssign?: (exam: RadiologyExam) => void;
    onPrint?: (exam: RadiologyExam) => void;
    onExport?: (exam: RadiologyExam) => void;
    onCritical?: (exam: RadiologyExam) => void;
    onReschedule?: (exam: RadiologyExam) => void;
    onCancel?: (exam: RadiologyExam) => void;
  };
}

// 影像缩略图预览: 有 thumbnail 用图, 无则显示模态图标 + 帧数
function ImagePreviewCell({ exam }: { exam: RadiologyExam }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 'var(--space-1, 4px)',
          fontSize: 12,
          color: exam.imagesAcquired > 0 ? "var(--color-primary-800)" : "#94a3b8",
          cursor: "default",
        }}
      >
        {exam.thumbnailUrl ? (
          <img
            src={exam.thumbnailUrl}
            alt={t('wl.thumbnail')}
            style={{ width: 34, height: 26, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border-color)" }}
          />
        ) : (
          <ImageIcon size={12} color="var(--text-secondary)" />
        )}
        {exam.imagesAcquired > 0 ? `${exam.imagesAcquired}${t('wl.imagesUnit')}` : "-"}
      </span>
      {hover && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 60,
            width: 160,
            padding: 10,
            background: "var(--bg-card)",
            borderRadius: 10,
            border: "1px solid var(--border-color)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          }}
        >
          {exam.thumbnailUrl ? (
            <img
              src={exam.thumbnailUrl}
              alt={`${exam.patientName} ${t('wl.thumbnail')}`}
              style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 6 }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 96,
                borderRadius: 6,
                background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                gap: 'var(--space-1, 4px)',
              }}
            >
              <ImagePlus size={22} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: 11, opacity: 0.9 }}>{exam.modality} {t('wl.image')}</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{exam.imagesAcquired || 0} {t('wl.frames')}</span>
            </div>
          )}
          <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
            {exam.examItemName}
          </div>
        </div>
      )}
    </div>
  );
}

export function ListView({
  exams,
  selectedIds,
  onSelect,
  onRowClick,
  loading = false,
  onAssignDoctor,
  onViewRequisition,
  onViewHistory,
  onCriticalValueClick,
  prefetchStatus,
  transferStatus,
  // [G005 v3.0.6.11-99 Wave 10E-1] 列配置面板: 隐藏列 key 集合 (由 WorklistPage 传入)
  hiddenColumns,
  contextActions,
}: ListViewProps) {
  // [W3-C] 受控分页: 工作列表 (全量数据前端切片)
  const listPagination = usePagination(exams, 10);
  const navigate = useNavigate();
  // [W14-UX] 右键菜单
  const { open: openContextMenu, menu: contextMenuNode } = useContextMenu("worklist-context-menu");

  const buildContextItems = (exam: RadiologyExam): ContextMenuItem[] => [
    { key: "view", label: t("w14Ux.contextMenu.view"), onSelect: () => (contextActions?.onView ?? onRowClick)(exam) },
    { key: "assign", label: t("w14Ux.contextMenu.assignDoctor"), onSelect: () => onAssignDoctor?.(exam) },
    { key: "print", label: t("w14Ux.contextMenu.printBarcode"), onSelect: () => contextActions?.onPrint?.(exam) },
    { key: "export", label: t("w14Ux.contextMenu.export"), onSelect: () => contextActions?.onExport?.(exam) },
    { key: "critical", label: t("w14Ux.contextMenu.markCritical"), onSelect: () => onCriticalValueClick?.(exam), dividerBefore: true },
    { key: "reschedule", label: t("w14Ux.contextMenu.reschedule"), onSelect: () => contextActions?.onReschedule?.(exam) },
    {
      key: "cancel",
      label: t("w14Ux.contextMenu.cancel"),
      danger: true,
      confirm: t("w14Ux.contextMenu.confirmDelete"),
      dividerBefore: true,
      onSelect: () => contextActions?.onCancel?.(exam),
    },
  ];
  const baseColumns = useMemo<ProColumn<RadiologyExam>[]>(() => [
    {
      title: t("wl.colPriority"),
      dataIndex: "priority",
      key: "priority",
      width: 90,
      sorter: (a, b) =>
        (PRIORITY_CONFIG[a.priority]?.order ?? 99) -
        (PRIORITY_CONFIG[b.priority]?.order ?? 99),
      filters: Object.keys(PRIORITY_CONFIG).map((value) => ({ text: t(PRIORITY_CONFIG[value]?.label ?? value), value })),
      onFilter: (value, record) => record.priority === value,
      render: (value) => {
        const priority = PRIORITY_CONFIG[String(value)] ?? PRIORITY_CONFIG.普通!;
        return (
          <span style={{ background: priority.bg, color: priority.color, padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
            {t(priority.label)}
          </span>
        );
      },
    },
    {
      title: t("wl.colPatientName"),
      dataIndex: "patientName",
      key: "patientName",
      width: 130,
      searchable: true,
      sorter: (a, b) => a.patientName.localeCompare(b.patientName, "zh-CN"),
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "var(--color-primary-800)" }}>
          <User size={12} color="var(--text-secondary)" />
          {String(value)}
          {exam.priority === "危重" && <AlertTriangle size={12} color="var(--color-error-600)" />}
        </span>
      ),
    },
    {
      title: t("wl.colDemographics"),
      dataIndex: "gender",
      key: "demographics",
      width: 100,
      render: (value, exam) => <span>{String(value)} / {exam.age}{t("wl.years")}</span>,
    },
    {
      title: t("wl.colExamItem"),
      dataIndex: "examItemName",
      key: "examItemName",
      width: 190,
      searchable: true,
      sorter: (a, b) => a.examItemName.localeCompare(b.examItemName, "zh-CN"),
      render: (value, exam) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{String(value)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)', color: "var(--text-secondary)", fontSize: 12 }}>
            <Scan size={10} /> {exam.modality} · {exam.bodyPart}
          </div>
        </div>
      ),
    },
    {
      title: t("wl.colDevice"),
      dataIndex: "modality",
      key: "device",
      width: 150,
      sorter: (a, b) => a.modality.localeCompare(b.modality),
      filters: [...new Set(exams.map((exam) => exam.modality))].map((value) => ({ text: value, value })),
      onFilter: (value, record) => record.modality === value,
      render: (_value, exam) => {
        const device = getDeviceById(exam.deviceId ?? "");
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Monitor size={12} color="var(--text-secondary)" />
            {device?.name?.split("（")[0] || "-"}
          </span>
        );
      },
    },
    {
      title: t("wl.colRoom"),
      dataIndex: "roomId",
      key: "roomId",
      width: 90,
      render: (value) => (
        <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
          <Radio size={11} color="var(--text-secondary)" />
          {getRoomById(String(value ?? ""))?.roomNumber || "-"}
        </span>
      ),
    },
    {
      title: t("wl.colImage"),
      dataIndex: "imagesAcquired",
      key: "images",
      width: 80,
      render: (_value, exam) => <ImagePreviewCell exam={exam} />,
    },
    // [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 影像预取状态列 (按 prefetch/status 渲染)
    {
      title: t("wl.colPrefetch"),
      dataIndex: "id",
      key: "prefetch",
      width: 90,
      sorter: (a, b) => {
        const order = { cached: 0, queued: 1, none: 2 };
        return (order[prefetchStatus?.[a.id] ?? "none"] ?? 2) - (order[prefetchStatus?.[b.id] ?? "none"] ?? 2);
      },
      render: (_value, exam) => {
        const state = prefetchStatus?.[exam.id] ?? "none";
        if (state === "cached") {
          return <Tag color="success" style={{ marginInlineEnd: 0, fontWeight: 600 }} icon={<CheckCircle2 size={12} />}>{t("wl.prefetchCached")}</Tag>;
        }
        if (state === "queued") {
          return <Tag color="processing" style={{ marginInlineEnd: 0, fontWeight: 600 }} icon={<CloudDownload size={12} />}>{t("wl.prefetchQueued")}</Tag>;
        }
        return <span style={{ fontSize: 12, color: "#cbd5e1" }}>{t("wl.prefetchNone")}</span>;
      },
    },
    // [G005 v3.0.6.11-96 Wave 2B (D)] C-STORE 传输状态列 (按 examId/检查号匹配传输队列, 从 listTransfers 派生)
    {
      title: t("wl.colTransfer"),
      dataIndex: "id",
      key: "transfer",
      width: 96,
      render: (_value, exam) => {
        const key1 = String(exam.id ?? "");
        const key2 = String(exam.accessionNumber ?? "");
        const state = transferStatus?.[key1] ?? (key2 ? transferStatus?.[key2] : undefined) ?? "none";
        const meta: Record<string, { color: string; label: string }> = {
          queued: { color: "default", label: "wl.transferQueued" },
          sending: { color: "processing", label: "wl.transferSending" },
          paused: { color: "warning", label: "wl.statusPaused" },
          failed: { color: "error", label: "wl.transferFailed" },
          completed: { color: "success", label: "wl.statusCompleted" },
          canceled: { color: "default", label: "wl.statusCancelled" },
        };
        if (state === "none") return <span style={{ fontSize: 12, color: "#cbd5e1" }}>-</span>;
        const m = meta[state] ?? { color: "default", label: state };
        return <Tag color={m.color} style={{ marginInlineEnd: 0, fontWeight: 600 }}>{t(m.label)}</Tag>;
      },
    },
    {
      title: t("wl.colPatientType"),
      dataIndex: "patientType",
      key: "patientType",
      width: 100,
      filters: ["门诊", "住院", "急诊", "体检"].map((value) => ({ text: value, value })),
      onFilter: (value, record) => record.patientType === value,
      render: (value) => {
        const type = String(value);
        const background = type === "急诊" ? "var(--color-error-bg)" : type === "住院" ? "var(--color-info-bg)" : "var(--bg-deep)";
        const color = type === "急诊" ? "var(--color-error-600)" : type === "住院" ? "var(--color-primary-600)" : "#64748b";
        return <span style={{ background, color, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>{type}</span>;
      },
    },
    {
      title: t("wl.colStatus"),
      dataIndex: "status",
      key: "status",
      width: 100,
      sorter: (a, b) =>
        (STATUS_CONFIG[a.status]?.order ?? 99) -
        (STATUS_CONFIG[b.status]?.order ?? 99),
      filters: [...new Set(exams.map((exam) => exam.status))].map((value) => ({ text: displayExamStatus(value), value })),
      onFilter: (value, record) => record.status === value,
      render: (value) => {
        // [W14-UX] 统一状态色回退: 命中本页 STATUS_CONFIG 时保留标签 i18n, 否则走共享状态色工具
        const local = STATUS_CONFIG[String(value)];
        if (local) {
          return <span style={{ background: local.bg, color: local.color, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{t(local.label)}</span>;
        }
        const shared = getReportStatusColor(String(value));
        return <span style={{ background: shared.bg, color: shared.color, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{shared.label || displayExamStatus(String(value))}</span>;
      },
    },
    {
      title: t("wl.colCritical"),
      dataIndex: "criticalFinding",
      key: "criticalFinding",
      width: 90,
      filters: [
        { text: t("wl.criticalYes"), value: "true" },
        { text: t("wl.criticalNo"), value: "false" },
      ],
      onFilter: (value, record) => record.criticalFinding === (value === "true"),
      render: (_value, exam) =>
        exam.criticalFinding ? (
          <Tag
            color="error"
            style={{ cursor: "pointer", marginInlineEnd: 0, fontWeight: 600 }}
            icon={<AlertOctagon size={12} />}
            onClick={(e) => {
              e.stopPropagation();
              onCriticalValueClick?.(exam);
            }}
          >
            {t("wl.criticalValue")}
          </Tag>
        ) : (
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>-</span>
        ),
    },
    {
      title: t("wl.colReferringDoctor"),
      dataIndex: "technologistName",
      key: "technologistName",
      width: 120,
      searchable: true,
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
          <Stethoscope size={11} color="var(--text-secondary)" />
          {String(value || getDoctorById(exam.technologistId || "")?.name || "-")}
        </span>
      ),
    },
    {
      title: t("wl.colRadiologist"),
      dataIndex: "radiologistId",
      key: "radiologistId",
      width: 110,
      searchable: true,
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
          <UserCheck size={11} color="var(--text-secondary)" />
          <span style={{ color: exam.radiologistId ? "var(--color-primary-800)" : "#94a3b8" }}>
            {exam.radiologistName || getDoctorById(String(value ?? ""))?.name || t("wl.unassigned")}
          </span>
        </span>
      ),
    },
    {
      title: t("wl.colRegisteredAt"),
      dataIndex: "createdTime",
      key: "createdTime",
      width: 155,
      defaultSortOrder: "descend",
      sorter: (a, b) => String(a.createdTime).localeCompare(String(b.createdTime)),
      render: (value) => String(value || "-"),
    },
    {
      title: "SLA",
      dataIndex: "createdTime",
      key: "sla",
      width: 100,
      sorter: (a, b) => getSLAInfo(a.createdTime).elapsedMinutes - getSLAInfo(b.createdTime).elapsedMinutes,
      render: (_value, exam) => {
        const sla = getSLAInfo(exam.createdTime);
        const priority = calculatePriority(exam);
        return (
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: sla.color, boxShadow: sla.status === "critical" ? `0 0 4px ${sla.color}` : "none" }} />
            <strong style={{ color: sla.color }}>{sla.elapsedMinutes}m</strong>
            <span style={{ padding: "1px 4px", borderRadius: 3, background: priority.bg, color: priority.color }}>{priority.score}</span>
          </span>
        );
      },
    },
    {
      title: t("wl.colActions"),
      dataIndex: "id",
      key: "actions",
      width: 340,
      fixed: "right",
      render: (_value, exam) => (
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* [G005 放射流程P0] 检查→阅片: 行操作直达 DICOM 阅片 */}
          <Button
            type="link"
            size="small"
            icon={<ImageIcon size={12} />}
            onClick={(event) => {
              event.stopPropagation();
              navigate(`/dicom-viewer?studyUid=${encodeURIComponent(exam.accessionNumber || exam.id || '')}&examId=${exam.id}`);
            }}
          >
            {t("wl.actionRead")}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<Eye size={12} />}
            onClick={(event) => {
              event.stopPropagation();
              onRowClick(exam);
            }}
          >
            {t("wl.actionView")}
          </Button>
          {/* [v3.0.6.11-96 Wave 3A P1] 详情 → 独立路由 /exam/:id (新标签打开) */}
          <Button
            type="link"
            size="small"
            icon={<ExternalLink size={12} />}
            onClick={(event) => {
              event.stopPropagation();
              window.open(`/exam/${encodeURIComponent(exam.id)}`, "_blank");
            }}
          >
            {t("wl.actionDetail")}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<UserCheck size={12} />}
            onClick={(event) => {
              event.stopPropagation();
              onAssignDoctor?.(exam);
            }}
          >
            {t("wl.actionAssignDoctor")}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<FileText size={12} />}
            onClick={(event) => {
              event.stopPropagation();
              onViewRequisition?.(exam);
            }}
          >
            {t("wl.actionRequisition")}
          </Button>
          <Button
            type="link"
            size="small"
            icon={<History size={12} />}
            onClick={(event) => {
              event.stopPropagation();
              onViewHistory?.(exam);
            }}
          >
            {t("wl.actionHistory")}
          </Button>
        </div>
      ),
    },
  ], [exams, onRowClick, onAssignDoctor, onViewRequisition, onViewHistory, onCriticalValueClick, prefetchStatus]);

  // [G005 v3.0.6.11-99 Wave 10E-1] 列显隐: 过滤隐藏列 (actions 列固定右侧不可隐藏, 保证操作可达)
  const columns = useMemo<ProColumn<RadiologyExam>[]>(() => {
    if (!hiddenColumns || hiddenColumns.length === 0) return baseColumns;
    const hidden = new Set(hiddenColumns.filter((k) => k !== "actions"));
    const filtered = baseColumns.filter((c) => !hidden.has(String(c.key ?? c.dataIndex ?? "")));
    return filtered;
  }, [baseColumns, hiddenColumns]);

  return (
    <>
      {contextMenuNode}
      <DataTable<RadiologyExam>
        columns={columns as unknown as TableColumnsType<RadiologyExam>}
        dataSource={listPagination.pageData}
        rowKey="id"
        loading={{ spinning: loading, indicator: <div style={{ padding: 'var(--space-6, 24px)' }}><Skeleton active title={false} paragraph={{ rows: 8 }} /></div> }}
        sticky
        pagination={listPagination.pagination}
        scroll={{ x: 1800, y: "calc(100vh - 400px)" }}
        rowSelection={{
          preserveSelectedRowKeys: true,
          selectedRowKeys: [...selectedIds],
          onChange: (keys) => onSelect(new Set(keys.map(String))),
        }}
        locale={{
          emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description={t("wl.empty")} />,
        }}
        onRow={(exam) => ({
          onClick: () => onRowClick(exam),
          onContextMenu: (e) => openContextMenu(e, buildContextItems(exam)),
          style: { cursor: "pointer" },
        })}
      />
    </>
  );
}
