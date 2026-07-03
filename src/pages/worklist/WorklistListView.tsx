import { useState, useMemo } from "react";
import {
  User,
  Scan,
  Monitor,
  Radio,
  Stethoscope,
  AlertTriangle,
  CheckSquare,
  Square,
  Eye,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  initialModalityDevices,
  initialExamRooms,
} from "../../data/initialData";
import { initialUsers } from "../../data/initialData";
import type { RadiologyExam } from "../../types";

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
  published: { bg: '#ecfdf5', color: '#047857', label: '已发布', order: 5 },
  submitted: { bg: '#d1fae5', color: '#059669', label: '已提交', order: 4.5 },
  reviewed: { bg: '#ecfdf5', color: '#047857', label: '已审核', order: 5.5 },
  inProgress: { bg: '#fce7f3', color: '#db2777', label: '检查中', order: 2 },
  completed: { bg: '#d1fae5', color: '#059669', label: '已完成', order: 4.5 },
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
  initialModalityDevices.find((d) => d.id === deviceId);
const getRoomById = (roomId: string) =>
  initialExamRooms.find((r) => r.id === roomId);
const getDoctorById = (doctorId: string) =>
  initialUsers.find((u) => u.id === doctorId);

interface SLAInfo {
  elapsedMinutes: number;
  status: "normal" | "warning" | "critical";
  color: string;
  label: string;
}

const getSLAInfo = (createdTime: string): SLAInfo => {
  try {
    if (!createdTime) return { elapsedMinutes: 0, status: 'normal', color: '#059669', label: 'N/A' };
    const created = new Date(createdTime).getTime();
    const now = Date.now();
    const elapsedMinutes = Math.floor((now - created) / 60000);
    if (elapsedMinutes > 60)
      return {
        elapsedMinutes,
        status: "critical",
        color: "#dc2626",
        label: ">60min",
      };
    if (elapsedMinutes > 30)
      return {
        elapsedMinutes,
        status: "warning",
        color: "#d97706",
        label: "30-60min",
      };
    return {
      elapsedMinutes,
      status: "normal",
      color: "#059669",
      label: "<30min",
    };
  } catch {
    return {
      elapsedMinutes: 0,
      status: "normal",
      color: "#059669",
      label: "<30min",
    };
  }
};

interface PriorityScore {
  level: "低" | "普通" | "紧急" | "危重";
  score: number;
  color: string;
  bg: string;
}

const calculatePriority = (exam: RadiologyExam): PriorityScore => {
  const ageScore =
    exam.age >= 70 ? 30 : exam.age >= 60 ? 20 : exam.age >= 50 ? 10 : 0;
  let waitScore = 0;
  try {
    const created = new Date(exam.createdTime).getTime();
    const now = Date.now();
    const waitMinutes = (now - created) / 60000;
    waitScore =
      waitMinutes > 120 ? 25 : waitMinutes > 60 ? 15 : waitMinutes > 30 ? 8 : 0;
  } catch {
    /* ignore */
  }
  const typeScore =
    exam.patientType === "急诊" ? 25 : exam.patientType === "住院" ? 15 : 5;
  const partScore =
    exam.bodyPart === "头颅" ||
    exam.bodyPart === "心脏" ||
    exam.bodyPart === "血管"
      ? 20
      : 10;
  const totalScore = ageScore + waitScore + typeScore + partScore;
  if (totalScore >= 70)
    return {
      level: "危重",
      score: totalScore,
      color: "#dc2626",
      bg: "#fee2e2",
    };
  if (totalScore >= 45)
    return {
      level: "紧急",
      score: totalScore,
      color: "#d97706",
      bg: "#fef3c7",
    };
  if (totalScore >= 25)
    return {
      level: "普通",
      score: totalScore,
      color: "#64748b",
      bg: "#f1f5f9",
    };
  return { level: "低", score: totalScore, color: "#059669", bg: "#d1fae5" };
};

// ============================================================
// ListView
// ============================================================
interface ListViewProps {
  exams: RadiologyExam[];
  selectedIds: Set<string>;
  onSelect: (ids: Set<string>) => void;
  onRowClick: (exam: RadiologyExam) => void;
  allSelected: boolean;
}

export function ListView({
  exams,
  selectedIds,
  onSelect,
  onRowClick,
  allSelected,
}: ListViewProps) {
  const [sort, setSort] = useState({
    key: "createdTime",
    dir: "desc" as "asc" | "desc",
  });

  const SortableHeader = ({
    label,
    sortKey,
    currentSort,
    onSort,
  }: {
    label: string;
    sortKey: string;
    currentSort: { key: string; dir: "asc" | "desc" };
    onSort: (key: string) => void;
  }) => (
    <th
      scope="col"
      onClick={() => onSort(sortKey)}
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 600,
        color: "#475569",
        fontSize: 12,
        whiteSpace: "nowrap",
        cursor: "pointer",
        userSelect: "none",
        background: currentSort.key === sortKey ? "#f0f7ff" : "#f8fafc",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <ArrowUp
            size={10}
            style={{
              color:
                currentSort.key === sortKey && currentSort.dir === "asc"
                  ? "#1e3a5f"
                  : "#cbd5e1",
              marginBottom: -2,
            }}
          />
          <ArrowDown
            size={10}
            style={{
              color:
                currentSort.key === sortKey && currentSort.dir === "desc"
                  ? "#1e3a5f"
                  : "#cbd5e1",
            }}
          />
        </div>
      </div>
    </th>
  );

  const sortedExams = useMemo(() => {
    return [...exams].sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      switch (sort.key) {
        case "patientName":
          aVal = a.patientName;
          bVal = b.patientName;
          break;
        case "priority":
          aVal = PRIORITY_CONFIG[a.priority]?.order ?? 99;
          bVal = PRIORITY_CONFIG[b.priority]?.order ?? 99;
          break;
        case "status":
          aVal = STATUS_CONFIG[a.status]?.order ?? 99;
          bVal = STATUS_CONFIG[b.status]?.order ?? 99;
          break;
        case "examTime":
          aVal = a.examTime || "";
          bVal = b.examTime || "";
          break;
        case "createdTime":
          aVal = a.createdTime || "";
          bVal = b.createdTime || "";
          break;
        case "modality":
          aVal = a.modality;
          bVal = b.modality;
          break;
        default:
          aVal = a.createdTime ?? "";
          bVal = b.createdTime ?? "";
      }
      if (sort.dir === "asc") return aVal > bVal ? 1 : -1;
      return aVal < bVal ? 1 : -1;
    });
  }, [exams, sort]);

  const handleSort = (key: string) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "desc" },
    );
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onSelect(newSet);
  };

  const handleSelectAll = () => {
    if (allSelected) {
      onSelect(new Set());
    } else {
      onSelect(new Set(exams.map((e) => e.id)));
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          overflowX: "auto",
          overflowY: "auto",
          maxHeight: "calc(100vh - 320px)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "separate",
            borderSpacing: 0,
            fontSize: 12,
            minWidth: 1200,
          }}
        >
          <thead>
            <tr
              style={{
                background: "#f8fafc",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <th
                scope="col"
                aria-label="选择"
                style={{
                  padding: "10px 12px",
                  width: 40,
                  position: "sticky",
                  top: 0,
                  background: "#f8fafc",
                  zIndex: 1,
                }}
              >
                <div
                  onClick={handleSelectAll}
                  role="button"
                  tabIndex={0}
                  aria-label={allSelected ? "取消全选" : "全选"}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleSelectAll();
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: allSelected ? "#1e3a5f" : "#cbd5e1",
                  }}
                >
                  {allSelected ? (
                    <CheckSquare size={16} />
                  ) : (
                    <Square size={16} />
                  )}
                </div>
              </th>
              <SortableHeader
                label="优先级"
                sortKey="priority"
                currentSort={sort}
                onSort={handleSort}
              />
              <SortableHeader
                label="患者姓名"
                sortKey="patientName"
                currentSort={sort}
                onSort={handleSort}
              />
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                性别/年龄
              </th>
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                检查项目+部位
              </th>
              <SortableHeader
                label="设备"
                sortKey="modality"
                currentSort={sort}
                onSort={handleSort}
              />
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                检查室
              </th>
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                患者类型
              </th>
              <SortableHeader
                label="状态"
                sortKey="status"
                currentSort={sort}
                onSort={handleSort}
              />
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "left",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                申请医生
              </th>
              <SortableHeader
                label="登记时间"
                sortKey="createdTime"
                currentSort={sort}
                onSort={handleSort}
              />
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                SLA
              </th>
              <th
                scope="col"
                style={{
                  padding: "10px 12px",
                  textAlign: "center",
                  fontWeight: 600,
                  color: "#475569",
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  background: "#f8fafc",
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                }}
              >
                操作
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedExams.map((exam, idx) => {
              const device = getDeviceById(exam.deviceId ?? "");
              const room = getRoomById(exam.roomId ?? "");
              const sc = STATUS_CONFIG[exam.status] || {
                bg: "#f1f5f9",
                color: "#64748b",
                label: exam.status,
              };
              const pc =
                PRIORITY_CONFIG[exam.priority] || PRIORITY_CONFIG["普通"]!;
              const isSelected = selectedIds.has(exam.id);

              return (
                <tr
                  key={exam.id}
                  onClick={() => onRowClick(exam)}
                  style={{
                    borderBottom: "1px solid #f1f5f9",
                    cursor: "pointer",
                    background: isSelected
                      ? "#f0f7ff"
                      : idx % 2 === 0
                        ? "#fff"
                        : "#fafbfc",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background = "#f0f7ff";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background =
                        idx % 2 === 0 ? "#fff" : "#fafbfc";
                  }}
                >
                  <td style={{ padding: "8px 12px" }}>
                    <div
                      onClick={(e) => toggleSelect(exam.id, e)}
                      style={{
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: isSelected ? "#1e3a5f" : "#cbd5e1",
                      }}
                    >
                      {isSelected ? (
                        <CheckSquare size={16} />
                      ) : (
                        <Square size={16} />
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        ...pc,
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        display: "inline-block",
                      }}
                    >
                      {pc.label}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        color: "#1e3a5f",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      <User size={12} style={{ color: "#94a3b8" }} />
                      {exam.patientName}
                      {exam.priority === "危重" && (
                        <AlertTriangle size={12} style={{ color: "#dc2626" }} />
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px", color: "#64748b" }}>
                    <span style={{ fontWeight: 500 }}>{exam.gender}</span>
                    <span style={{ margin: "0 4px", color: "#cbd5e1" }}>/</span>
                    <span>{exam.age}岁</span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontWeight: 600, color: "#334155" }}>
                      {exam.examItemName}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginTop: 2,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Scan size={10} />
                      {exam.modality} · {exam.bodyPart}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <Monitor size={12} style={{ color: "#94a3b8" }} />
                      <div>
                        <div
                          style={{
                            color: "#334155",
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {device?.name?.split("（")[0] || "-"}
                        </div>
                        <div style={{ fontSize: 12, color: "#94a3b8" }}>
                          {device?.modality || ""}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Radio size={11} style={{ color: "#94a3b8" }} />
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {room?.roomNumber || "-"}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        padding: "3px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background:
                          exam.patientType === "急诊"
                            ? "#fee2e2"
                            : exam.patientType === "住院"
                              ? "#dbeafe"
                              : "#f1f5f9",
                        color:
                          exam.patientType === "急诊"
                            ? "#dc2626"
                            : exam.patientType === "住院"
                              ? "#2563eb"
                              : "#64748b",
                      }}
                    >
                      {exam.patientType}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <span
                      style={{
                        ...sc,
                        padding: "3px 10px",
                        borderRadius: 12,
                        fontSize: 12,
                        fontWeight: 600,
                        display: "inline-block",
                      }}
                    >
                      {sc.label}
                    </span>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <Stethoscope size={11} style={{ color: "#94a3b8" }} />
                      <span style={{ fontSize: 12, color: "#64748b" }}>
                        {exam.technologistName ||
                          getDoctorById(exam.technologistId || "")?.name ||
                          "-"}
                      </span>
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {exam.createdTime || "-"}
                    </div>
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    {(() => {
                      const sla = getSLAInfo(exam.createdTime);
                      const autoPri = calculatePriority(exam);
                      return (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <div
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "50%",
                              background: sla.color,
                              boxShadow:
                                sla.status === "critical"
                                  ? `0 0 4px ${sla.color}`
                                  : "none",
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: sla.color,
                            }}
                          >
                            {sla.elapsedMinutes}m
                          </span>
                          <span
                            style={{
                              fontSize: 12,
                              padding: "1px 4px",
                              borderRadius: 3,
                              background: autoPri.bg,
                              color: autoPri.color,
                            }}
                          >
                            {autoPri.score}
                          </span>
                        </div>
                      );
                    })()}
                  </td>
                  <td style={{ padding: "8px 12px" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRowClick(exam);
                        }}
                        style={{
                          padding: "4px 10px",
                          background: "#eff6ff",
                          color: "#2563eb",
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
                        <Eye size={11} />
                        查看
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {sortedExams.length === 0 && (
          <div
            role="status"
            aria-live="polite"
            style={{ padding: 60, textAlign: "center", color: "#94a3b8" }}
          >
            <Scan
              size={48}
              style={{ margin: "0 auto 16px", display: "block", opacity: 0.4 }}
              aria-hidden
            />
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
              暂无符合条件的检查记录
            </div>
            <div style={{ fontSize: 12 }}>请调整筛选条件后重试</div>
          </div>
        )}
      </div>
      {sortedExams.length > 20 && <PaginationBar total={sortedExams.length} />}
    </div>
  );
}

function PaginationBar({ total }: { total: number }) {
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, total);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 16px",
        borderTop: "1px solid #e2e8f0",
        background: "#f8fafc",
        fontSize: 12,
        color: "#64748b",
        flexWrap: "wrap",
        gap: 8,
      }}
    >
      <span>
        显示 {start}-{end} / 共 {total} 条
      </span>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={safePage <= 1}
          aria-label="上一页"
          style={{
            padding: "4px 10px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            background: safePage <= 1 ? "#f1f5f9" : "#fff",
            color: safePage <= 1 ? "#cbd5e1" : "#475569",
            cursor: safePage <= 1 ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          上一页
        </button>
        <span
          style={{
            padding: "4px 10px",
            fontWeight: 600,
            color: "#1e3a5f",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {safePage} / {totalPages}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          disabled={safePage >= totalPages}
          aria-label="下一页"
          style={{
            padding: "4px 10px",
            border: "1px solid #e2e8f0",
            borderRadius: 6,
            background: safePage >= totalPages ? "#f1f5f9" : "#fff",
            color: safePage >= totalPages ? "#cbd5e1" : "#475569",
            cursor: safePage >= totalPages ? "not-allowed" : "pointer",
            fontSize: 12,
          }}
        >
          下一页
        </button>
      </div>
    </div>
  );
}
