
import { List, LayoutGrid, BarChart3, AlertOctagon, Printer, Download, CheckCircle, XCircle, ShieldCheck, PenLine, Send } from 'lucide-react';
import type { RadiologyReport } from "../../types";
import { PRIMARY, GRAY, ACCENT, DANGER, SUCCESS, WHITE } from "./reportUtils";
import { normalizeReportStatus } from "../../components/report/statusMeta";
import { useNavigate } from "react-router-dom";

export interface ReportToolbarProps {
  viewMode: "list" | "kanban";
  setViewMode: (v: "list" | "kanban") => void;
  avgQuality: number;
  criticalCount: number;
  selectedIds: Set<string>;
  filteredStats: { critical: number; pending: number; published: number };
  filteredReports: RadiologyReport[];
  allReports: RadiologyReport[];
  setDetailReport: (r: RadiologyReport | null) => void;
  setReviewReport: (r: RadiologyReport | null) => void;
  setExportModal: (v: {
    show: boolean;
    title: string;
    message: string;
    complete: boolean;
  }) => void;
  setPrintModal: (v: { show: boolean; title: string; message: string }) => void;
  setBulkActionModal: (v: {
    show: boolean;
    action: string;
    count: number;
    loading: boolean;
  }) => void;
  showToast: (msg: string, type: "success" | "error" | "info") => void;
  setStatusFilter: (v: string) => void;
  // [W2-3] 批量导出真实化
  onBulkExport?: (list: RadiologyReport[]) => void;
}

export default function ReportToolbar({
  viewMode,
  setViewMode,
  avgQuality,
  criticalCount,
  selectedIds,
  filteredReports,
  allReports,
  setDetailReport,
  setExportModal,
  setBulkActionModal,
  onBulkExport,
}: ReportToolbarProps) {useNavigate();

  return (
    <div
      style={{
        background: WHITE,
        borderRadius: 10,
        padding: "10px 14px",
        border: "1px solid #e2e8f0",
        marginBottom: 14,
        display: "flex",
        alignItems: "center",
        gap: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          display: "flex",
          background: "var(--bg-primary)",
          borderRadius: 7,
          padding: 3,
        }}
      >
        {[
          { key: "list", label: "列表视图", icon: <List size={14} /> },
          { key: "kanban", label: "看板视图", icon: <LayoutGrid size={14} /> },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setViewMode(v.key as typeof viewMode)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "none",
              background: viewMode === v.key ? WHITE : "transparent",
              color: viewMode === v.key ? PRIMARY : GRAY,
              fontSize: 12,
              fontWeight: viewMode === v.key ? 700 : 500,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 5,
              boxShadow:
                viewMode === v.key ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
              transition: "all 0.15s",
            }}
          >
            {v.icon}
            {v.label}
          </button>
        ))}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginLeft: 8,
          paddingLeft: 12,
          borderLeft: "1px solid #e2e8f0",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 6,
            background: "var(--bg-card)",
            border: "1px solid #e2e8f0",
          }}
        >
          <BarChart3 size={13} style={{ color: "#64748b" }} />
          <span style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>
            质量
          </span>
          <span
            style={{
              padding: "1px 6px",
              borderRadius: 4,
              fontSize: 12,
              fontWeight: 800,
              background:
                avgQuality >= 90
                  ? "#d1fae5"
                  : avgQuality >= 80
                    ? "#fef3c7"
                    : "#fee2e2",
              color:
                avgQuality >= 90
                  ? "#047857"
                  : avgQuality >= 80
                    ? "#b45309"
                    : "#dc2626",
            }}
          >
            {avgQuality}
          </span>
          <span style={{ fontSize: 12, color: "#94a3b8" }}>/100</span>
        </div>

        {criticalCount > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              borderRadius: 6,
              background: "#fff5f5",
              border: "1px solid #fed7d7",
              animation: "criticalPulse 2s infinite",
            }}
          >
            <AlertOctagon size={13} style={{ color: DANGER }} />
            <span style={{ fontSize: 12, fontWeight: 700, color: DANGER }}>
              ⚠ 危急值 {criticalCount} 例
            </span>
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 6, marginLeft: 8, flexWrap: "wrap" }}>
        {[
          {
            label: "全部",
            count: filteredReports.length,
            color: GRAY,
            key: "__all",
          },
          {
            label: "待分配",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "待分配").length,
            color: "#6b7280",
            key: "待分配",
          },
          {
            label: "已分配",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "已分配").length,
            color: "#0369a1",
            key: "已分配",
          },
          {
            label: "书写中",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "书写中").length,
            color: "#1e40af",
            key: "书写中",
          },
          {
            label: "初审中",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "初审中").length,
            color: "#7c2d12",
            key: "初审中",
          },
          {
            label: "终审中",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "终审中").length,
            color: "#a16207",
            key: "终审中",
          },
          {
            label: "已签发",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "已签发").length,
            color: "#047857",
            key: "已签发",
          },
          {
            label: "已发布",
            count: filteredReports.filter((r) => normalizeReportStatus(r.status) === "已发布").length,
            color: SUCCESS,
            key: "已发布",
          },
        ].map((s) => (
          <div
            key={s.key}
            style={{
              padding: "3px 10px",
              borderRadius: 6,
              background: `${s.color}12`,
              border: `1px solid ${s.color}30`,
            }}
          >
            <span style={{ fontSize: 12, color: s.color, fontWeight: 600 }}>
              {s.label}:{" "}
            </span>
            <span style={{ fontSize: 12, fontWeight: 800, color: s.color }}>
              {s.count}
            </span>
          </div>
        ))}
      </div>

      <div
        style={{
          marginLeft: "auto",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        {selectedIds.size > 0 && (
          <>
            <span style={{ fontSize: 12, color: ACCENT, fontWeight: 600 }}>
              已选 {selectedIds.size} 份报告
            </span>
            <button
              onClick={() => {
                const toPrint = allReports.filter((r) => selectedIds.has(r.id));
                toPrint.forEach((r) => {
                  setDetailReport(r);
                  setTimeout(() => window.print(), 100);
                });
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: GRAY,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Printer size={12} /> 批量打印
            </button>
            <button
              onClick={() => {
                const list = allReports.filter((r) => selectedIds.has(r.id));
                if (onBulkExport) onBulkExport(list);
                else {
                  setExportModal({
                    show: true,
                    title: "批量导出",
                    message: `正在导出 ${selectedIds.size} 份报告 PDF...`,
                    complete: false,
                  });
                  setTimeout(() => {
                    setExportModal((m) => ({
                      ...m,
                      complete: true,
                      message: `已导出 ${selectedIds.size} 份报告 PDF`,
                    }));
                    setTimeout(
                      () => setExportModal((m) => ({ ...m, show: false })),
                      2000,
                    );
                  }, 1500);
                }
              }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: GRAY,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Download size={12} /> 批量导出
            </button>
            <button
              onClick={() =>
                setBulkActionModal({
                  show: true,
                  action: "review",
                  count: selectedIds.size,
                  loading: false,
                })
              }
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: "#6d28d9",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <ShieldCheck size={12} /> 批量审核
            </button>
            <button
              onClick={() =>
                setBulkActionModal({
                  show: true,
                  action: "sign",
                  count: selectedIds.size,
                  loading: false,
                })
              }
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: "#0284c7",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <PenLine size={12} /> 批量签署
            </button>
            <button
              onClick={() =>
                setBulkActionModal({
                  show: true,
                  action: "publish",
                  count: selectedIds.size,
                  loading: false,
                })
              }
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: SUCCESS,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <CheckCircle size={12} /> 批量发布
            </button>
            <button
              onClick={() =>
                setBulkActionModal({
                  show: true,
                  action: "submit",
                  count: selectedIds.size,
                  loading: false,
                })
              }
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: "#4338ca",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <Send size={12} /> 批量提交审核
            </button>
            <button
              onClick={() =>
                setBulkActionModal({
                  show: true,
                  action: "delete",
                  count: selectedIds.size,
                  loading: false,
                })
              }
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "1px solid #e2e8f0",
                background: WHITE,
                color: DANGER,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <XCircle size={12} /> 批量删除
            </button>
          </>
        )}
      </div>
    </div>
  );
}
