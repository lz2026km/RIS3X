import { ProTable, type ProColumn } from "../../components/data/ProTable";
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
} from "lucide-react";
import { useMemo, useState } from "react";
import { Inbox } from 'lucide-react'
import { useNavigate } from "react-router-dom";

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; order: number }
> = {
  SCHEDULED: { bg: "#3b82f622", color: "#3b82f6", label: "已登记", order: 0 },
  ARRIVED: { bg: "#8b5cf622", color: "#7c3aed", label: "已报到", order: 1 },
  IN_PROGRESS: { bg: "#ec489922", color: "#db2777", label: "检查中", order: 2 },
  // [v3.0.6.11-95 Wave 1A P1] 暂停态 + 影像质控态映射
  PAUSED: { bg: "#f59e0b22", color: "#f59e0b", label: "已暂停", order: 2.5 },
  IMAGE_READY: { bg: "#10b98122", color: "#0f766e", label: "图像可用", order: 3.5 },
  QC_REJECT: { bg: "#ef444422", color: "#dc2626", label: "质控退回", order: 3.6 },
  QC_PASS: { bg: "#0ea5e922", color: "#0369a1", label: "质控通过", order: 3.7 },
  PENDING_REPORT: { bg: "#f59e0b22", color: "#ca8a04", label: "待报告", order: 3.8 },
  COMPLETED: { bg: "#22c55e22", color: "#059669", label: "已完成", order: 3 },
  CANCELLED: { bg: "#ef444422", color: "#ef4444", label: "已取消", order: 8 },
  已登记: { bg: "#3b82f622", color: "#3b82f6", label: "已登记", order: 0 },
  待检查: { bg: "#8b5cf622", color: "#7c3aed", label: "待检查", order: 1 },
  检查中: { bg: "#ec489922", color: "#db2777", label: "检查中", order: 2 },
  待报告: { bg: "#f59e0b22", color: "#ca8a04", label: "待报告", order: 3 },
  已报告: { bg: "#22c55e22", color: "#059669", label: "已报告", order: 4 },
  已发布: { bg: "#22c55e22", color: "#047857", label: "已发布", order: 5 },
  published: { bg: "#22c55e22", color: "#047857", label: "已发布", order: 5 },
  submitted: { bg: "#22c55e22", color: "#059669", label: "已提交", order: 4.5 },
  reviewed: { bg: "#22c55e22", color: "#047857", label: "已审核", order: 5.5 },
  inProgress: { bg: "#ec489922", color: "#db2777", label: "检查中", order: 2 },
  completed: { bg: "#22c55e22", color: "#059669", label: "已完成", order: 4.5 },
  已暂停: { bg: "#f59e0b22", color: "#f59e0b", label: "已暂停", order: 7 },
  质控退回: { bg: "#ef444422", color: "#ef4444", label: "质控退回", order: 8 },
};

const PRIORITY_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; order: number }
> = {
  普通: { bg: "var(--bg-deep)", color: "var(--text-secondary)", label: "普通", order: 0 },
  紧急: { bg: "#f59e0b22", color: "#f59e0b", label: "紧急", order: 1 },
  危重: { bg: "#ef444422", color: "#ef4444", label: "危重", order: 2 },
  会诊: { bg: "#8b5cf622", color: "#7c3aed", label: "会诊", order: 3 },
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
    return { elapsedMinutes, status: "critical", color: "#dc2626" };
  }
  if (elapsedMinutes > 30) {
    return { elapsedMinutes, status: "warning", color: "#d97706" };
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
  if (score >= 70) return { score, color: "#ef4444", bg: "#ef444422" };
  if (score >= 45) return { score, color: "#f59e0b", bg: "#f59e0b22" };
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
          gap: 4,
          fontSize: 12,
          color: exam.imagesAcquired > 0 ? "#1e40af" : "#94a3b8",
          cursor: "default",
        }}
      >
        {exam.thumbnailUrl ? (
          <img
            src={exam.thumbnailUrl}
            alt="缩略图"
            style={{ width: 34, height: 26, objectFit: "cover", borderRadius: 4, border: "1px solid var(--border-color)" }}
          />
        ) : (
          <ImageIcon size={12} color="var(--text-secondary)" />
        )}
        {exam.imagesAcquired > 0 ? `${exam.imagesAcquired}幅` : "-"}
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
              alt={`${exam.patientName} 影像缩略图`}
              style={{ width: "100%", height: 96, objectFit: "cover", borderRadius: 6 }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: 96,
                borderRadius: 6,
                background: "linear-gradient(135deg, #1e40af 0%, #2563eb 100%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                gap: 4,
              }}
            >
              <ImagePlus size={22} style={{ opacity: 0.8 }} />
              <span style={{ fontSize: 11, opacity: 0.9 }}>{exam.modality} 影像</span>
              <span style={{ fontSize: 10, opacity: 0.7 }}>{exam.imagesAcquired || 0} 帧</span>
            </div>
          )}
          <div style={{ marginTop: 8, fontSize: 11, color: "var(--text-secondary)", textAlign: "center" }}>
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
}: ListViewProps) {
  // [W3-C] 受控分页: 工作列表 (全量数据前端切片)
  const listPagination = usePagination(exams, 10);
  const navigate = useNavigate();
  const columns = useMemo<ProColumn<RadiologyExam>[]>(() => [
    {
      title: "优先级",
      dataIndex: "priority",
      key: "priority",
      width: 90,
      sorter: (a, b) =>
        (PRIORITY_CONFIG[a.priority]?.order ?? 99) -
        (PRIORITY_CONFIG[b.priority]?.order ?? 99),
      filters: Object.keys(PRIORITY_CONFIG).map((value) => ({ text: value, value })),
      onFilter: (value, record) => record.priority === value,
      render: (value) => {
        const priority = PRIORITY_CONFIG[String(value)] ?? PRIORITY_CONFIG.普通!;
        return (
          <span style={{ background: priority.bg, color: priority.color, padding: "3px 8px", borderRadius: 6, fontSize: 12, fontWeight: 700 }}>
            {priority.label}
          </span>
        );
      },
    },
    {
      title: "患者姓名",
      dataIndex: "patientName",
      key: "patientName",
      width: 130,
      searchable: true,
      sorter: (a, b) => a.patientName.localeCompare(b.patientName, "zh-CN"),
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#1e40af" }}>
          <User size={12} color="var(--text-secondary)" />
          {String(value)}
          {exam.priority === "危重" && <AlertTriangle size={12} color="#dc2626" />}
        </span>
      ),
    },
    {
      title: "性别/年龄",
      dataIndex: "gender",
      key: "demographics",
      width: 100,
      render: (value, exam) => <span>{String(value)} / {exam.age}岁</span>,
    },
    {
      title: "检查项目+部位",
      dataIndex: "examItemName",
      key: "examItemName",
      width: 190,
      searchable: true,
      sorter: (a, b) => a.examItemName.localeCompare(b.examItemName, "zh-CN"),
      render: (value, exam) => (
        <div>
          <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{String(value)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: 12 }}>
            <Scan size={10} /> {exam.modality} · {exam.bodyPart}
          </div>
        </div>
      ),
    },
    {
      title: "设备",
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
      title: "检查室",
      dataIndex: "roomId",
      key: "roomId",
      width: 90,
      render: (value) => (
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Radio size={11} color="var(--text-secondary)" />
          {getRoomById(String(value ?? ""))?.roomNumber || "-"}
        </span>
      ),
    },
    {
      title: "影像",
      dataIndex: "imagesAcquired",
      key: "images",
      width: 80,
      render: (_value, exam) => <ImagePreviewCell exam={exam} />,
    },
    // [G005 v3.0.6.11-91 Wave 4A (PACS P0-2)] 影像预取状态列 (按 prefetch/status 渲染)
    {
      title: "预取",
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
          return <Tag color="success" style={{ marginInlineEnd: 0, fontWeight: 600 }} icon={<CheckCircle2 size={12} />}>已缓存</Tag>;
        }
        if (state === "queued") {
          return <Tag color="processing" style={{ marginInlineEnd: 0, fontWeight: 600 }} icon={<CloudDownload size={12} />}>排队中</Tag>;
        }
        return <span style={{ fontSize: 12, color: "#cbd5e1" }}>未预取</span>;
      },
    },
    {
      title: "患者类型",
      dataIndex: "patientType",
      key: "patientType",
      width: 100,
      filters: ["门诊", "住院", "急诊", "体检"].map((value) => ({ text: value, value })),
      onFilter: (value, record) => record.patientType === value,
      render: (value) => {
        const type = String(value);
        const background = type === "急诊" ? "var(--color-error-bg)" : type === "住院" ? "var(--color-info-bg)" : "var(--bg-deep)";
        const color = type === "急诊" ? "#dc2626" : type === "住院" ? "#2563eb" : "#64748b";
        return <span style={{ background, color, padding: "3px 8px", borderRadius: 6, fontWeight: 600 }}>{type}</span>;
      },
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 100,
      sorter: (a, b) =>
        (STATUS_CONFIG[a.status]?.order ?? 99) -
        (STATUS_CONFIG[b.status]?.order ?? 99),
      filters: [...new Set(exams.map((exam) => exam.status))].map((value) => ({ text: displayExamStatus(value), value })),
      onFilter: (value, record) => record.status === value,
      render: (value) => {
        const status = STATUS_CONFIG[String(value)] ?? { bg: "var(--bg-deep)", color: "var(--text-secondary)", label: displayExamStatus(String(value)) };
        return <span style={{ background: status.bg, color: status.color, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{status.label}</span>;
      },
    },
    {
      title: "危急值",
      dataIndex: "criticalFinding",
      key: "criticalFinding",
      width: 90,
      filters: [
        { text: "有危急值", value: "true" },
        { text: "无危急值", value: "false" },
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
            危急值
          </Tag>
        ) : (
          <span style={{ fontSize: 12, color: "#cbd5e1" }}>-</span>
        ),
    },
    {
      title: "申请医生",
      dataIndex: "technologistName",
      key: "technologistName",
      width: 120,
      searchable: true,
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Stethoscope size={11} color="var(--text-secondary)" />
          {String(value || getDoctorById(exam.technologistId || "")?.name || "-")}
        </span>
      ),
    },
    {
      title: "报告医生",
      dataIndex: "radiologistId",
      key: "radiologistId",
      width: 110,
      searchable: true,
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <UserCheck size={11} color="var(--text-secondary)" />
          <span style={{ color: exam.radiologistId ? "#1e40af" : "#94a3b8" }}>
            {exam.radiologistName || getDoctorById(String(value ?? ""))?.name || "未分配"}
          </span>
        </span>
      ),
    },
    {
      title: "登记时间",
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
      title: "操作",
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
            阅片
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
            查看
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
            分配医生
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
            申请单
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
            历史
          </Button>
        </div>
      ),
    },
  ], [exams, onRowClick, onAssignDoctor, onViewRequisition, onViewHistory, onCriticalValueClick, prefetchStatus]);

  return (
    <ProTable<RadiologyExam>
      columns={columns}
      dataSource={listPagination.pageData}
      rowKey="id"
      loading={{ spinning: loading, indicator: <div style={{ padding: 24 }}><Skeleton active title={false} paragraph={{ rows: 8 }} /></div> }}
      showToolbar={false}
      size="small"
      sticky
      pagination={listPagination.pagination}
      scroll={{ x: 1800, y: "calc(100vh - 400px)" }}
      rowSelection={{
        preserveSelectedRowKeys: true,
        selectedRowKeys: [...selectedIds],
        onChange: (keys) => onSelect(new Set(keys.map(String))),
      }}
      locale={{
        emptyText: <Empty image={<Inbox size={48} style={{opacity:0.4}}/>} description="暂无符合条件的检查记录" />,
      }}
      onRow={(exam) => ({
        onClick: () => onRowClick(exam),
        style: { cursor: "pointer" },
      })}
    />
  );
}
