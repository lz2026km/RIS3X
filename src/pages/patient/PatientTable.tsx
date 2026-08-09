
import { ChevronLeft, ChevronRight, CheckSquare, Square, Search, Eye, Edit2, PlusCircle, FileText, Download, Printer, X, GitFork, User, Phone, CreditCard, Calendar, MapPin, Contact, Shield, Activity, AlertTriangle } from 'lucide-react';
import type { Patient } from "../../types";
import type { RadiologyExam } from "../../types";
import type { DuplicateMatch, ToastInfo } from "./types";
import { getPatientExams } from "./utils";

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

function Pagination({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 16px",
        borderTop: "1px solid #e2e8f0",
        background: "#f8fafc",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          color: "#64748b",
        }}
      >
        {onPageSizeChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span>每页</span>
            <select
              aria-label="每页条数"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: "2px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                fontSize: 12,
                background: "#fff",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {[10, 20, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {s} 条
                </option>
              ))}
            </select>
          </div>
        )}
        <span>
          显示 {startItem}-{endItem} 条，共 {totalItems} 条记录
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="上一页"
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#fff",
            cursor: currentPage === 1 ? "not-allowed" : "pointer",
            opacity: currentPage === 1 ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronLeft size={16} color="#64748b" />
        </button>
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          let pageNum = i + 1;
          if (totalPages > 5) {
            if (currentPage > 3) pageNum = currentPage - 2 + i;
            if (currentPage > totalPages - 2) pageNum = totalPages - 4 + i;
          }
          if (pageNum < 1 || pageNum > totalPages) return null;
          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              aria-label={`第 ${pageNum} 页`}
              aria-current={currentPage === pageNum ? "page" : undefined}
              style={{
                minWidth: 32,
                height: 32,
                borderRadius: 6,
                border: "1px solid",
                borderColor: currentPage === pageNum ? "#1e40af" : "#e2e8f0",
                background: currentPage === pageNum ? "#1e40af" : "#fff",
                color: currentPage === pageNum ? "#fff" : "#64748b",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                padding: "0 8px",
              }}
            >
              {pageNum}
            </button>
          );
        })}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="下一页"
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "#fff",
            cursor: currentPage === totalPages ? "not-allowed" : "pointer",
            opacity: currentPage === totalPages ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ChevronRight size={16} color="#64748b" />
        </button>
      </div>
    </div>
  );
}

export interface PatientTableProps {
  patients: Patient[];
  paginatedPatients: Patient[];
  filteredPatientsLength: number;
  selectedPatientIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onViewPatient: (patient: Patient) => void;
  onEditPatient: (patient: Patient) => void;
  exams: RadiologyExam[];
  visibleDuplicates: DuplicateMatch[];
  onDismissAllDuplicates: () => void;
  selectedPatient: Patient | null;
  onSelectPatient: (patient: Patient | null) => void;
  onToast: (toast: ToastInfo) => void;
}

export function PatientTable({
  patients,
  paginatedPatients,
  filteredPatientsLength,
  selectedPatientIds,
  onSelectionChange,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onViewPatient,
  onEditPatient,
  exams,
  visibleDuplicates,
  onDismissAllDuplicates,
  selectedPatient,
  onSelectPatient,
  onToast,
}: PatientTableProps) {
  const allSelected =
    paginatedPatients.length > 0 &&
    paginatedPatients.every((p) => selectedPatientIds.has(p.id));

  const toggleSelectPatient = (id: string) => {
    const newSet = new Set(selectedPatientIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    onSelectionChange(newSet);
  };

  const toggleSelectAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(paginatedPatients.map((p) => p.id)));
  };

  const handleBulkExport = () => {
    const selected = patients.filter((p) => selectedPatientIds.has(p.id));
    const csvContent = [
      [
        "患者ID",
        "姓名",
        "性别",
        "年龄",
        "身份证",
        "电话",
        "患者类型",
        "建档日期",
      ].join(","),
      ...selected.map((p) =>
        [
          p.id,
          p.name,
          p.gender,
          p.age,
          p.idCard,
          p.phone,
          p.patientType,
          p.registrationDate,
        ].join(","),
      ),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `批量导出_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    onSelectionChange(new Set());
    onToast({
      show: true,
      type: "success",
      message: `成功导出 ${selected.length} 条患者记录`,
    });
  };

  const handleBulkPrint = () => {
    onToast({
      show: true,
      type: "info",
      message: `已发送 ${selectedPatientIds.size} 个标签到打印队列`,
    });
    onSelectionChange(new Set());
  };

  return (
    <>
      {visibleDuplicates.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: "12px 16px",
            background: "#fffbeb",
            border: "1px solid #fde68a",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <GitFork size={18} color="#d97706" />
            <span style={{ fontSize: 13, fontWeight: 600, color: "#92400e" }}>
              检测到 {visibleDuplicates.length} 组重复患者记录
            </span>
            <span style={{ fontSize: 12, color: "#78716c" }}>
              建议合并或核实
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {visibleDuplicates.slice(0, 3).map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  background: "#fff",
                  borderRadius: 4,
                  border: "1px solid #fde68a",
                  color: "#92400e",
                }}
              >
                {d.patients[0].name} ~ {d.patients[1].name} ({d.score}分)
              </span>
            ))}
            {visibleDuplicates.length > 3 && (
              <span
                style={{ fontSize: 12, color: "#78716c", alignSelf: "center" }}
              >
                等{visibleDuplicates.length}组
              </span>
            )}
            <button
              onClick={onDismissAllDuplicates}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: "#fff",
                fontSize: 12,
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <X size={12} /> 忽略
            </button>
          </div>
        </div>
      )}

      {selectedPatientIds.size > 0 && (
        <div
          style={{
            marginBottom: 12,
            padding: "10px 16px",
            background: "linear-gradient(135deg, #1e40af, #2563eb)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 12,
            boxShadow: "0 4px 12px rgba(30,58,95,0.3)",
          }}
        >
          <span
            style={{
              color: "#fff",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <CheckSquare size={16} color="#4ade80" />
            已选{" "}
            <span style={{ fontSize: 18, fontWeight: 800 }}>
              {selectedPatientIds.size}
            </span>{" "}
            项
          </span>
          <div
            style={{
              width: 1,
              height: 24,
              background: "rgba(255,255,255,0.2)",
            }}
          />
          <button
            onClick={handleBulkExport}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 12,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Download size={12} />
            批量导出
          </button>
          <button
            onClick={handleBulkPrint}
            style={{
              padding: "6px 14px",
              borderRadius: 6,
              background: "rgba(255,255,255,0.15)",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 12,
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Printer size={12} />
            打印标签
          </button>
          <button
            onClick={() => onSelectionChange(new Set())}
            style={{
              marginLeft: "auto",
              padding: "6px 12px",
              borderRadius: 6,
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              fontSize: 12,
              color: "rgba(255,255,255,0.7)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <X size={12} />
            清除
          </button>
        </div>
      )}

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
          <div style={{ overflowX: "auto" }}><table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 12,
              minWidth: 1150,
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
                    padding: "12px 10px",
                    width: 40,
                    textAlign: "center",
                    position: "sticky",
                    top: 0,
                    background: "#f8fafc",
                    zIndex: 1,
                  }}
                >
                  <div
                    onClick={toggleSelectAll}
                    role="button"
                    tabIndex={0}
                    aria-label={allSelected ? "取消全选" : "全选"}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleSelectAll();
                      }
                    }}
                    style={{
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: allSelected ? "#1e40af" : "#cbd5e1",
                    }}
                  >
                    {allSelected ? (
                      <CheckSquare size={16} />
                    ) : (
                      <Square size={16} />
                    )}
                  </div>
                </th>
                {[
                  { key: "id", label: "患者ID", align: "left" as const },
                  { key: "name", label: "姓名", align: "left" as const },
                  { key: "gender", label: "性别", align: "center" as const },
                  { key: "age", label: "年龄", align: "right" as const },
                  { key: "idCard", label: "身份证", align: "left" as const },
                  { key: "phone", label: "联系电话", align: "left" as const },
                  {
                    key: "patientType",
                    label: "患者类型",
                    align: "center" as const,
                  },
                  {
                    key: "registrationDate",
                    label: "建档日期",
                    align: "left" as const,
                  },
                  {
                    key: "totalExamCount",
                    label: "检查次数",
                    align: "right" as const,
                  },
                  {
                    key: "lastExamDate",
                    label: "最近检查",
                    align: "left" as const,
                  },
                  { key: "actions", label: "操作", align: "center" as const },
                ].map((h) => (
                  <th
                    key={h.key}
                    scope="col"
                    style={{
                      padding: "12px 14px",
                      textAlign: h.align,
                      fontWeight: 700,
                      color: "#475569",
                      fontSize: 12,
                      whiteSpace: "nowrap",
                      position: "sticky",
                      top: 0,
                      background: "#f8fafc",
                      zIndex: 1,
                    }}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedPatients.map((p, idx) => {getPatientExams(p.id, exams);
                const isSelected = selectedPatientIds.has(p.id);
                return (
                  <tr
                    key={p.id}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      cursor: "pointer",
                      background: isSelected
                        ? "#f0f7ff"
                        : idx % 2 === 0
                          ? "#fff"
                          : "#fafbfc",
                    }}
                    onClick={() => onSelectPatient(p)}
                    onMouseEnter={(e) => {
                      if (!isSelected)
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.background = "#f0f7ff";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected)
                        (
                          e.currentTarget as HTMLTableRowElement
                        ).style.background = idx % 2 === 0 ? "#fff" : "#fafbfc";
                    }}
                  >
                    <td style={{ padding: "10px 10px", textAlign: "center" }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectPatient(p.id);
                        }}
                        role="button"
                        tabIndex={0}
                        aria-label={`选择 ${p.name}`}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            e.stopPropagation();
                            toggleSelectPatient(p.id);
                          }
                        }}
                        style={{
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isSelected ? "#1e40af" : "#cbd5e1",
                        }}
                      >
                        {isSelected ? (
                          <CheckSquare size={16} />
                        ) : (
                          <Square size={16} />
                        )}
                      </div>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      {p.id}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            width: 28,
                            height: 28,
                            borderRadius: "50%",
                            background:
                              p.gender === "男" ? "#dbeafe" : "#fce7f3",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 12,
                            fontWeight: 700,
                            color: p.gender === "男" ? "#1e40af" : "#be185d",
                          }}
                        >
                          {p.name.slice(0, 1)}
                        </div>
                        <span style={{ fontWeight: 600, color: "#1e40af" }}>
                          {p.name}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          background: p.gender === "男" ? "#dbeafe" : "#fce7f3",
                          color: p.gender === "男" ? "#1e40af" : "#be185d",
                        }}
                      >
                        {p.gender}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        color: "#334155",
                        fontWeight: 500,
                      }}
                    >
                      {p.age}岁
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        fontFamily: "monospace",
                        fontSize: 12,
                        color: "#64748b",
                      }}
                    >
                      {p.idCard}
                    </td>
                    <td style={{ padding: "10px 14px", color: "#334155" }}>
                      {p.phone}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {p.patientType}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      {p.registrationDate}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        textAlign: "right",
                        fontWeight: 700,
                        color: "#1e40af",
                      }}
                    >
                      {(p.totalExamCount || 0).toLocaleString()}
                    </td>
                    <td
                      style={{
                        padding: "10px 14px",
                        color: "#64748b",
                        fontSize: 12,
                      }}
                    >
                      {p.lastExamDate || "-"}
                    </td>
                    <td style={{ padding: "10px 14px", textAlign: "center" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          justifyContent: "center",
                        }}
                      >
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewPatient(p);
                          }}
                          aria-label={`查看 ${p.name}`}
                          style={{
                            padding: "6px 10px",
                            background: "#eff6ff",
                            color: "#2563eb",
                            border: "none",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Eye size={12} />
                          查看
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditPatient(p);
                          }}
                          aria-label={`编辑 ${p.name}`}
                          style={{
                            padding: "6px 10px",
                            background: "#f0fdf4",
                            color: "#16a34a",
                            border: "none",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Edit2 size={12} />
                          编辑
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          aria-label={`新增检查 ${p.name}`}
                          style={{
                            padding: "6px 10px",
                            background: "#fef3c7",
                            color: "#d97706",
                            border: "none",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <PlusCircle size={12} />
                          检查
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                          }}
                          aria-label={`查看报告 ${p.name}`}
                          style={{
                            padding: "6px 10px",
                            background: "#f5f3ff",
                            color: "#7c3aed",
                            border: "none",
                            borderRadius: 4,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <FileText size={12} />
                          报告
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedPatients.length === 0 && (
                <tr>
                  <td
                    colSpan={12}
                    style={{
                      padding: "40px 14px",
                      textAlign: "center",
                      color: "#94a3b8",
                    }}
                  >
                    <div
                      role="status"
                      aria-live="polite"
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Search size={32} color="#cbd5e1" aria-hidden />
                      <div style={{ fontSize: 13 }}>未找到匹配的患者记录</div>
                      <div style={{ fontSize: 12 }}>暂无数据</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table></div>
        </div>

        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredPatientsLength}
          pageSize={pageSize}
          onPageChange={onPageChange}
          onPageSizeChange={onPageSizeChange}
        />
      </div>

      {selectedPatient && (
        <div
          style={{
            marginTop: 16,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            padding: 20,
            boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #1e40af, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span style={{ fontSize: 20, fontWeight: 700, color: "#fff" }}>
                  {selectedPatient.name.slice(0, 1)}
                </span>
              </div>
              <div>
                <div
                  style={{ fontSize: 16, fontWeight: 700, color: "#1e40af" }}
                >
                  {selectedPatient.name}
                </div>
                <div style={{ fontSize: 12, color: "#64748b" }}>
                  {selectedPatient.gender} · {selectedPatient.age}岁 ·{" "}
                  {selectedPatient.patientType}
                </div>
              </div>
            </div>
            <button
              onClick={() => onSelectPatient(null)}
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
              <X size={16} color="#64748b" />
            </button>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
            }}
          >
            {[
              {
                label: "患者ID",
                value: selectedPatient.id,
                icon: <User size={14} />,
              },
              {
                label: "联系电话",
                value: selectedPatient.phone,
                icon: <Phone size={14} />,
              },
              {
                label: "身份证号",
                value: selectedPatient.idCard,
                icon: <CreditCard size={14} />,
              },
              {
                label: "建档日期",
                value: selectedPatient.registrationDate,
                icon: <Calendar size={14} />,
              },
              {
                label: "家庭住址",
                value: selectedPatient.address,
                icon: <MapPin size={14} />,
              },
              {
                label: "联系人",
                value: `${selectedPatient.emergencyContact} (${selectedPatient.emergencyPhone})`,
                icon: <Contact size={14} />,
              },
              {
                label: "医保类型",
                value: selectedPatient.insuranceType || "-",
                icon: <Shield size={14} />,
              },
              {
                label: "累计检查",
                value: `${selectedPatient.totalExamCount || 0} 次`,
                icon: <Activity size={14} />,
              },
            ].map((item) => (
              <div
                key={item.label}
                style={{ padding: 12, background: "#f8fafc", borderRadius: 8 }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>{item.icon}</span>
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>
                    {item.label}
                  </span>
                </div>
                <div
                  style={{ fontSize: 12, color: "#334155", fontWeight: 500 }}
                >
                  {item.value}
                </div>
              </div>
            ))}
          </div>
          {selectedPatient.allergyHistory &&
            selectedPatient.allergyHistory !== "无" && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 16px",
                  background: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: 8,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <AlertTriangle size={16} color="#dc2626" />
                <span
                  style={{ fontSize: 12, color: "#991b1b", fontWeight: 600 }}
                >
                  过敏史：
                </span>
                <span style={{ fontSize: 12, color: "#991b1b" }}>
                  {selectedPatient.allergyHistory}
                </span>
              </div>
            )}
          <div style={{ marginTop: 16 }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#1e40af",
                marginBottom: 8,
              }}
            >
              既往史
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#334155",
                padding: 12,
                background: "#f8fafc",
                borderRadius: 8,
              }}
            >
              {selectedPatient.medicalHistory || "无"}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
