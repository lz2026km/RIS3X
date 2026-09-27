
import { ChevronLeft, ChevronRight, CheckSquare, Search, Eye, Edit2, PlusCircle, FileText, Download, Printer, X, GitFork, User, Phone, CreditCard, Calendar, MapPin, Contact, Shield, Activity, AlertTriangle, Trash2 } from 'lucide-react';
import { Popconfirm } from 'antd';
import type { TableColumnsType } from 'antd';
// [v3.0.6.11-103 Wave 6] 表格统一: 自定义 table → DataTable (斑马纹/行高/列头/分页统一)
import { DataTable } from "../../components/common/DataTable";
// [W14-UX] 右键上下文菜单项类型
import type { ContextMenuItem } from "../../components/common/ContextMenu";
import type { Patient } from "../../types";
import type { RadiologyExam } from "../../types";
import type { DuplicateMatch, ToastInfo } from "./types";
import { getPatientExams } from "./utils";
import { t } from "../../i18n/appI18n";

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
        background: "var(--bg-primary)",
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
            <span>{t("patientTable.pagination.perPage")}</span>
            <select
              aria-label={t("patientTable.pagination.perPageAria")}
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              style={{
                padding: "2px 6px",
                border: "1px solid #e2e8f0",
                borderRadius: 4,
                fontSize: 12,
                background: "var(--bg-card)",
                color: "#334155",
                cursor: "pointer",
              }}
            >
              {[10, 20, 50, 100].map((s) => (
                <option key={s} value={s}>
                  {t("patientTable.pagination.rows", { count: s })}
                </option>
              ))}
            </select>
          </div>
        )}
        <span>
          {t("patientTable.pagination.summary", { start: startItem, end: endItem, total: totalItems })}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label={t("patientTable.pagination.prev")}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "var(--bg-card)",
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
                background: currentPage === pageNum ? "#1e40af" : "var(--bg-card)",
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
          aria-label={t("patientTable.pagination.next")}
          style={{
            width: 32,
            height: 32,
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            background: "var(--bg-card)",
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
  // [Wave1B P2] 删除患者 (patientApi.delete)
  onDeletePatient?: (patient: Patient) => void;
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
  onDeletePatient,
  exams,
  visibleDuplicates,
  onDismissAllDuplicates,
  selectedPatient,
  onSelectPatient,
  onToast,
}: PatientTableProps) {
  // [v3.0.6.11-103 Wave 6] 全选/行选已由 DataTable rowSelection 接管 (antd 复选框)
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

  // [v3.0.6.11-103 Wave 6] 统一列配置 (DataTable), 复用原自定义表格单元格渲染
  // [W14-UX] 右键行操作 (查看/编辑/导出/打印/删除)
  const buildPatientContextItems = (p: Patient): ContextMenuItem[] => [
    { key: "view", label: t("patientTable.action.view"), onSelect: () => onViewPatient(p) },
    { key: "edit", label: t("patientTable.action.edit"), onSelect: () => onEditPatient(p) },
    {
      key: "export",
      label: t("w14Ux.contextMenu.export"),
      dividerBefore: true,
      onSelect: () =>
        onToast({ show: true, type: "success", message: `已导出患者 ${p.name} 档案` }),
    },
    {
      key: "print",
      label: t("w14Ux.contextMenu.print"),
      onSelect: () =>
        onToast({ show: true, type: "info", message: `已将 ${p.name} 标签发送到打印队列` }),
    },
    ...(onDeletePatient
      ? [
          {
            key: "delete",
            label: t("patientTable.action.delete"),
            danger: true,
            confirm: t("patientTable.deleteConfirmTitle"),
            dividerBefore: true,
            onSelect: () => onDeletePatient(p),
          } as ContextMenuItem,
        ]
      : []),
  ];
  const columns: TableColumnsType<Patient> = [
    {
      title: t("patientTable.col.id"),
      dataIndex: "id",
      key: "id",
      width: 110,
      render: (value) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>
          {String(value)}
        </span>
      ),
    },
    {
      title: t("patientTable.col.name"),
      dataIndex: "name",
      key: "name",
      width: 130,
      render: (_value, p) => {
        getPatientExams(p.id, exams);
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: p.gender === "男" ? "#dbeafe" : "#fce7f3",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 700,
                color: p.gender === "男" ? "#1e40af" : "#be185d",
                flexShrink: 0,
              }}
            >
              {p.name.slice(0, 1)}
            </div>
            <span style={{ fontWeight: 600, color: "#1e40af" }}>{p.name}</span>
          </div>
        );
      },
    },
    {
      title: t("patientTable.col.gender"),
      dataIndex: "gender",
      key: "gender",
      width: 70,
      align: "center",
      render: (value) => (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            background: value === "男" ? "#dbeafe" : "#fce7f3",
            color: value === "男" ? "#1e40af" : "#be185d",
          }}
        >
          {String(value)}
        </span>
      ),
    },
    {
      title: t("patientTable.col.age"),
      dataIndex: "age",
      key: "age",
      width: 70,
      align: "right",
      render: (value) => (
        <span style={{ color: "#334155", fontWeight: 500 }}>{String(value)}{t("patientTable.ageSuffix")}</span>
      ),
    },
    {
      title: t("patientTable.col.idCard"),
      dataIndex: "idCard",
      key: "idCard",
      width: 180,
      render: (value) => (
        <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>
          {String(value)}
        </span>
      ),
    },
    {
      title: t("patientTable.col.phone"),
      dataIndex: "phone",
      key: "phone",
      width: 130,
      render: (value) => <span style={{ color: "#334155" }}>{String(value)}</span>,
    },
    {
      title: t("patientTable.col.patientType"),
      dataIndex: "patientType",
      key: "patientType",
      width: 90,
      align: "center",
      render: (value) => (
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 12,
            fontWeight: 600,
            background: "var(--bg-primary)",
            color: "#475569",
          }}
        >
          {String(value)}
        </span>
      ),
    },
    {
      title: t("patientTable.col.registrationDate"),
      dataIndex: "registrationDate",
      key: "registrationDate",
      width: 110,
      render: (value) => (
        <span style={{ color: "#64748b", fontSize: 12 }}>{String(value)}</span>
      ),
    },
    {
      title: t("patientTable.col.examCount"),
      dataIndex: "totalExamCount",
      key: "totalExamCount",
      width: 90,
      align: "right",
      render: (value) => (
        <span style={{ fontWeight: 700, color: "#1e40af" }}>
          {(Number(value) || 0).toLocaleString()}
        </span>
      ),
    },
    {
      title: t("patientTable.col.lastExam"),
      dataIndex: "lastExamDate",
      key: "lastExamDate",
      width: 110,
      render: (value) => (
        <span style={{ color: "#64748b", fontSize: 12 }}>{String(value || "-")}</span>
      ),
    },
    {
      title: t("patientTable.col.actions"),
      dataIndex: "id",
      key: "actions",
      width: 300,
      fixed: "right",
      align: "center",
      render: (_value, p) => (
        <div style={{ display: "flex", gap: 4, justifyContent: "center" }}>
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
            <Eye size={14} />
            {t("patientTable.action.view")}
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
            <Edit2 size={14} />
            {t("patientTable.action.edit")}
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
            <PlusCircle size={14} />
            {t("patientTable.action.exam")}
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
            <FileText size={14} />
            {t("patientTable.action.report")}
          </button>
          {onDeletePatient && (
            <Popconfirm
              title={t("patientTable.deleteConfirmTitle")}
              description={`确定删除患者 "${p.name}" 吗？关联数据将一并处理。`}
              okText={t("patientTable.action.delete")}
              cancelText={t("patientTable.cancel")}
              okButtonProps={{ danger: true }}
              onConfirm={() => onDeletePatient(p)}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                }}
                aria-label={`删除患者 ${p.name}`}
                style={{
                  padding: "6px 10px",
                  background: "#fef2f2",
                  color: "#dc2626",
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
                <Trash2 size={14} />
                {t("patientTable.action.delete")}
              </button>
            </Popconfirm>
          )}
        </div>
      ),
    },
  ];

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
              {t("patientTable.duplicates.detected", { count: visibleDuplicates.length })}
            </span>
            <span style={{ fontSize: 12, color: "#78716c" }}>
              {t("patientTable.duplicates.advice")}
            </span>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {visibleDuplicates.slice(0, 3).map((d, i) => (
              <span
                key={i}
                style={{
                  fontSize: 12,
                  padding: "3px 8px",
                  background: "var(--bg-card)",
                  borderRadius: 4,
                  border: "1px solid #fde68a",
                  color: "#92400e",
                }}
              >
                {d.patients?.[0]?.name ?? ''} ~ {d.patients?.[1]?.name ?? ''} ({d.score}{t("patientTable.duplicates.scoreSuffix")})
              </span>
            ))}
            {visibleDuplicates.length > 3 && (
              <span
                style={{ fontSize: 12, color: "#78716c", alignSelf: "center" }}
              >
                {t("patientTable.duplicates.andMore", { count: visibleDuplicates.length })}
              </span>
            )}
            <button
              onClick={onDismissAllDuplicates}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: "var(--bg-card)",
                fontSize: 12,
                cursor: "pointer",
                color: "#64748b",
              }}
            >
              <X size={14} /> {t("patientTable.duplicates.ignore")}
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
            {t("patientTable.selected")}{" "}
            <span style={{ fontSize: 18, fontWeight: 800 }}>
              {selectedPatientIds.size}
            </span>{" "}
            {t("patientTable.selectedSuffix")}
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
            <Download size={14} />
            {t("patientTable.bulkExport")}
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
            <Printer size={14} />
            {t("patientTable.bulkPrint")}
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
            <X size={14} />
            {t("patientTable.clear")}
          </button>
        </div>
      )}

      <div
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <DataTable<Patient>
          columns={columns}
          dataSource={paginatedPatients}
          rowKey="id"
          pagination={false}
          scroll={{ x: 1150, y: "calc(100vh - 320px)" }}
          columnConfigKey="patient-table"
          alwaysVisibleColumns={["actions"]}
          contextMenuTestId="patient-context-menu"
          contextMenuItems={buildPatientContextItems}
          rowSelection={{
            preserveSelectedRowKeys: true,
            selectedRowKeys: [...selectedPatientIds],
            onChange: (keys) => onSelectionChange(new Set(keys.map(String))),
          }}
          onRow={(p) => ({
            onClick: () => onSelectPatient(p),
            style: { cursor: "pointer" },
          })}
          emptyText={
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
              <div style={{ fontSize: 13 }}>{t("patientTable.empty.noMatch")}</div>
              <div style={{ fontSize: 12 }}>{t("patientTable.empty.noData")}</div>
            </div>
          }
        />

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
            background: "var(--bg-card)",
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
                  {selectedPatient.gender} · {selectedPatient.age}{t("patientTable.ageSuffix")} ·{" "}
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
                background: "var(--bg-card)",
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
                labelKey: "patientTable.col.id",
                value: selectedPatient.id,
                icon: <User size={14} />,
              },
              {
                labelKey: "patientTable.col.phone",
                value: selectedPatient.phone,
                icon: <Phone size={14} />,
              },
              {
                labelKey: "patientTable.info.idCard",
                value: selectedPatient.idCard,
                icon: <CreditCard size={14} />,
              },
              {
                labelKey: "patientTable.col.registrationDate",
                value: selectedPatient.registrationDate,
                icon: <Calendar size={14} />,
              },
              {
                labelKey: "patientTable.info.address",
                value: selectedPatient.address,
                icon: <MapPin size={14} />,
              },
              {
                labelKey: "patientTable.info.contact",
                value: `${selectedPatient.emergencyContact} (${selectedPatient.emergencyPhone})`,
                icon: <Contact size={14} />,
              },
              {
                labelKey: "patientTable.info.insuranceType",
                value: selectedPatient.insuranceType || "-",
                icon: <Shield size={14} />,
              },
              {
                labelKey: "patientTable.info.totalExams",
                value: `${selectedPatient.totalExamCount || 0} 次`,
                icon: <Activity size={14} />,
              },
            ].map((item) => (
              <div
                key={item.labelKey}
                style={{ padding: 12, background: "var(--bg-primary)", borderRadius: 8 }}
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
                    {t(item.labelKey)}
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
                  background: "var(--color-error-bg)",
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
                  {t("patientTable.allergyHistory")}
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
              {t("patientTable.pastHistory")}
            </div>
            <div
              style={{
                fontSize: 12,
                color: "#334155",
                padding: 12,
                background: "var(--bg-primary)",
                borderRadius: 8,
              }}
            >
              {selectedPatient.medicalHistory || t("patientTable.none")}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
