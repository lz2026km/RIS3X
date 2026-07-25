import { useMemo } from "react";
import { Button, Empty } from "antd";
import {
  User,
  Scan,
  Monitor,
  Radio,
  Stethoscope,
  AlertTriangle,
  Eye,
} from "lucide-react";
import {
  initialModalityDevices,
  initialExamRooms,
  initialUsers,
} from "../../data/initialData";
import type { RadiologyExam } from "../../types";
import { ProTable, type ProColumn } from "../../components/data/ProTable";

const STATUS_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; order: number }
> = {
  已登记: { bg: "#dbeafe", color: "#2563eb", label: "已登记", order: 0 },
  待检查: { bg: "#ede9fe", color: "#7c3aed", label: "待检查", order: 1 },
  检查中: { bg: "#fce7f3", color: "#db2777", label: "检查中", order: 2 },
  待报告: { bg: "#fef9c3", color: "#ca8a04", label: "待报告", order: 3 },
  已报告: { bg: "#d1fae5", color: "#059669", label: "已报告", order: 4 },
  已发布: { bg: "#ecfdf5", color: "#047857", label: "已发布", order: 5 },
  published: { bg: "#ecfdf5", color: "#047857", label: "已发布", order: 5 },
  submitted: { bg: "#d1fae5", color: "#059669", label: "已提交", order: 4.5 },
  reviewed: { bg: "#ecfdf5", color: "#047857", label: "已审核", order: 5.5 },
  inProgress: { bg: "#fce7f3", color: "#db2777", label: "检查中", order: 2 },
  completed: { bg: "#d1fae5", color: "#059669", label: "已完成", order: 4.5 },
  已暂停: { bg: "#fef3c7", color: "#f59e0b", label: "已暂停", order: 7 },
  质控退回: { bg: "#fee2e2", color: "#ef4444", label: "质控退回", order: 8 },
};

const PRIORITY_CONFIG: Record<
  string,
  { bg: string; color: string; label: string; order: number }
> = {
  普通: { bg: "#f1f5f9", color: "#64748b", label: "普通", order: 0 },
  紧急: { bg: "#fef3c7", color: "#d97706", label: "紧急", order: 1 },
  危重: { bg: "#fee2e2", color: "#dc2626", label: "危重", order: 2 },
  会诊: { bg: "#ede9fe", color: "#7c3aed", label: "会诊", order: 3 },
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
  if (score >= 70) return { score, color: "#dc2626", bg: "#fee2e2" };
  if (score >= 45) return { score, color: "#d97706", bg: "#fef3c7" };
  if (score >= 25) return { score, color: "#64748b", bg: "#f1f5f9" };
  return { score, color: "#059669", bg: "#d1fae5" };
}

interface ListViewProps {
  exams: RadiologyExam[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onRowClick: (exam: RadiologyExam) => void;
  loading?: boolean;
}

export function ListView({
  exams,
  selectedIds,
  onSelect,
  onRowClick,
  loading = false,
}: ListViewProps) {
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
        <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600, color: "#1e3a5f" }}>
          <User size={12} color="#94a3b8" />
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
          <div style={{ fontWeight: 600, color: "#334155" }}>{String(value)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#94a3b8", fontSize: 12 }}>
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
            <Monitor size={12} color="#94a3b8" />
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
          <Radio size={11} color="#94a3b8" />
          {getRoomById(String(value ?? ""))?.roomNumber || "-"}
        </span>
      ),
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
        const background = type === "急诊" ? "#fee2e2" : type === "住院" ? "#dbeafe" : "#f1f5f9";
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
      filters: [...new Set(exams.map((exam) => exam.status))].map((value) => ({ text: value, value })),
      onFilter: (value, record) => record.status === value,
      render: (value) => {
        const status = STATUS_CONFIG[String(value)] ?? { bg: "#f1f5f9", color: "#64748b", label: String(value) };
        return <span style={{ background: status.bg, color: status.color, padding: "3px 10px", borderRadius: 12, fontWeight: 600 }}>{status.label}</span>;
      },
    },
    {
      title: "申请医生",
      dataIndex: "technologistName",
      key: "technologistName",
      width: 120,
      searchable: true,
      render: (value, exam) => (
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <Stethoscope size={11} color="#94a3b8" />
          {String(value || getDoctorById(exam.technologistId || "")?.name || "-")}
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
      width: 90,
      fixed: "right",
      render: (_value, exam) => (
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
      ),
    },
  ], [exams, onRowClick]);

  return (
    <ProTable<RadiologyExam>
      columns={columns}
      dataSource={exams}
      rowKey="id"
      loading={loading}
      showToolbar={false}
      size="small"
      sticky
      pagination={{ pageSize: 20 }}
      scroll={{ x: 1400, y: "calc(100vh - 400px)" }}
      rowSelection={{
        preserveSelectedRowKeys: true,
        selectedRowKeys: [...selectedIds],
        onChange: (keys) => onSelect(new Set(keys.map(String))),
      }}
      locale={{
        emptyText: <Empty description="暂无符合条件的检查记录" />,
      }}
      onRow={(exam) => ({
        onClick: () => onRowClick(exam),
        style: { cursor: "pointer" },
      })}
    />
  );
}
