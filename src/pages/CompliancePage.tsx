import { Card, Typography } from "antd";

const { Title } = Typography;
import { useState, useEffect, useMemo } from "react";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import {
  Shield,
  FileText,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Download,
} from "lucide-react";
import { complianceApi } from "../services/api/complianceApi";
import type {
  ComplianceReportDto,
  ComplianceDocDto,
} from "../services/api/complianceApi";
import { THEME_TOKENS } from "../components/common/ThemeTokens";
import { DataTable } from "../components/common";
import { FilterBar } from "../components/common/FilterBar";

const COLORS = {
  primary: "var(--color-primary-800)",
  accent: "var(--color-primary-500)",
  success: "#10b981",
  danger: "var(--color-error-500)",
  warning: "var(--color-warning-500)",
  border: "var(--border-color)",
  textDark: "#1e293b",
  textMid: "#475569",
  textLight: "#94a3b8",
  white: THEME_TOKENS.bgCard,
};

export default function CompliancePage() {
  const [activeTab, setActiveTab] = useState<"report" | "docs">("report");
  const [report, setReport] = useState<ComplianceReportDto | null>(null);
  const [docs, setDocs] = useState<ComplianceDocDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // [v3.0.6.16-6] 审计明细筛选: 关键词/模块/状态/级别/时间范围
  const [keyword, setKeyword] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [dateRange, setDateRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [repRes, docRes] = await Promise.all([
        complianceApi.getReport(),
        complianceApi.listDocs(),
      ]);
      if (cancelled) return;
      if (repRes.success && repRes.data) setReport(repRes.data);
      if (docRes.success && docRes.data) setDocs(docRes.data);
      if (!repRes.success && !docRes.success) setLoadError("API 不可用");
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const reportStats = report?.summary;
  const passedRate = reportStats
    ? ((reportStats.passed / reportStats.totalAudits) * 100).toFixed(1)
    : "--";

  // [v3.0.6.16-6] 审计明细筛选 (不改动原数组)
  const filteredDetails = useMemo(() => {
    const rows = report?.details ?? [];
    const kw = keyword.trim().toLowerCase();
    return rows.filter((d) => {
      const matchKw =
        !kw ||
        d.module.toLowerCase().includes(kw) ||
        d.checkItem.toLowerCase().includes(kw) ||
        d.description.toLowerCase().includes(kw);
      const matchModule =
        !filterValues.module || d.module === filterValues.module;
      const matchStatus =
        !filterValues.status || d.status === filterValues.status;
      const matchSeverity =
        !filterValues.severity || d.severity === filterValues.severity;
      let matchDate = true;
      if (dateRange && (dateRange[0] || dateRange[1])) {
        const day = dayjs(d.checkedAt);
        if (!day.isValid()) matchDate = false;
        else {
          if (dateRange[0] && day.isBefore(dateRange[0].startOf("day")))
            matchDate = false;
          if (dateRange[1] && day.isAfter(dateRange[1].endOf("day")))
            matchDate = false;
        }
      }
      return (
        matchKw && matchModule && matchStatus && matchSeverity && matchDate
      );
    });
  }, [report, keyword, filterValues, dateRange]);

  const detailModuleOptions = useMemo(
    () =>
      Array.from(new Set((report?.details ?? []).map((d) => d.module)))
        .filter(Boolean)
        .map((v) => ({ value: v, label: v })),
    [report],
  );
  const detailStatusOptions = useMemo(
    () =>
      Array.from(new Set((report?.details ?? []).map((d) => d.status)))
        .filter(Boolean)
        .map((v) => ({
          value: v,
          label: v === "PASS" ? "通过" : v === "FAIL" ? "未通过" : "警告",
        })),
    [report],
  );
  const detailSeverityOptions = useMemo(
    () =>
      Array.from(new Set((report?.details ?? []).map((d) => d.severity)))
        .filter(Boolean)
        .map((v) => ({
          value: v,
          label: v === "CRITICAL" ? "严重" : v === "MAJOR" ? "主要" : "轻微",
        })),
    [report],
  );

  const handleExport = () => {
    if (!report) return;
    const csv =
      "模块,检查项,状态,严重级别,描述,检查时间\n" +
      report.details
        .map(
          (d) =>
            `${d.module},${d.checkItem},${d.status},${d.severity},${d.description},${d.checkedAt}`,
        )
        .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `合规报告_${report.generatedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: COLORS.textLight,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 14 }}>加载中...</div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        style={{
          padding: "var(--space-6, 24px)",
          maxWidth: 1200,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            padding: "var(--space-10, 40px)",
            textAlign: "center",
            color: COLORS.textLight,
          }}
        >
          <AlertTriangle
            size={32}
            style={{ marginBottom: "var(--space-2, 8px)" }}
          />
          <div>无法加载合规数据，请稍后重试</div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "var(--space-6, 24px)",
        maxWidth: 1400,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "var(--space-5, 20px)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3, 12px)",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background:
                "linear-gradient(135deg, var(--color-primary-800), var(--color-primary-500))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <Title level={4} style={{ margin: 0 }}>
              合规管理
            </Title>
            <span style={{ color: COLORS.textLight, fontSize: 12 }}>
              合规检查与文档管理
            </span>
          </div>
        </div>
        {activeTab === "report" && report && (
          <button
            onClick={handleExport}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.white,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: COLORS.textMid,
            }}
          >
            <Download size={14} /> 导出报告
          </button>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: "var(--space-1, 4px)",
          marginBottom: "var(--space-5, 20px)",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        {[
          {
            key: "report" as const,
            label: "合规报告",
            icon: <Shield size={14} />,
          },
          {
            key: "docs" as const,
            label: "合规文档",
            icon: <FileText size={14} />,
          },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab.key ? COLORS.primary : "transparent"}`,
              background: "none",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 700 : 500,
              color: activeTab === tab.key ? COLORS.primary : COLORS.textLight,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "report" && report && (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "var(--space-4, 16px)",
              marginBottom: "var(--space-5, 20px)",
            }}
          >
            {[
              {
                label: "审计总数",
                value: reportStats?.totalAudits ?? "--",
                color: COLORS.primary,
                bg: "#3b82f622",
              },
              {
                label: "通过",
                value: reportStats?.passed ?? "--",
                color: COLORS.success,
                bg: "#22c55e22",
              },
              {
                label: "未通过",
                value: reportStats?.failed ?? "--",
                color: COLORS.danger,
                bg: "#ef444422",
              },
              {
                label: "合规率",
                value: `${passedRate}%`,
                color: COLORS.warning,
                bg: "#f59e0b22",
              },
            ].map((stat) => (
              <Card
                bordered={false}
                key={stat.label}
                style={{
                  background: COLORS.white,
                  borderRadius: 12,
                  padding: "16px 20px",
                  border: `1px solid ${COLORS.border}`,
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
                styles={{ body: { padding: 0 } }}
              >
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: stat.color }}
                >
                  {stat.value}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: COLORS.textLight,
                    marginTop: "var(--space-1, 4px)",
                  }}
                >
                  {stat.label}
                </div>
              </Card>
            ))}
          </div>

          <Card
            bordered={false}
            style={{
              background: COLORS.white,
              borderRadius: 12,
              border: `1px solid ${COLORS.border}`,
              overflow: "hidden",
            }}
            styles={{ body: { padding: 0 } }}
            size="small"
          >
            <div
              style={{
                padding: "14px 20px",
                borderBottom: `1px solid ${COLORS.border}`,
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.primary,
              }}
            >
              审计明细 ({report.details.length})
            </div>
            <div style={{ padding: "12px 20px 0" }}>
              <FilterBar
                searchPlaceholder="搜索模块 / 检查项 / 描述…"
                searchValue={keyword}
                onSearchChange={setKeyword}
                dateRange={{
                  value: dateRange,
                  onChange: setDateRange,
                  placeholder: ["检查开始", "检查结束"],
                }}
                filters={[
                  {
                    key: "module",
                    label: "模块",
                    options: detailModuleOptions,
                  },
                  {
                    key: "status",
                    label: "状态",
                    options: detailStatusOptions,
                  },
                  {
                    key: "severity",
                    label: "级别",
                    options: detailSeverityOptions,
                  },
                ]}
                filterValues={filterValues}
                onFilterChange={(k, v) =>
                  setFilterValues((prev) => ({ ...prev, [k]: v }))
                }
                onReset={() => {
                  setKeyword("");
                  setFilterValues({});
                  setDateRange(null);
                }}
                summary={`共 ${filteredDetails.length} / ${report.details.length} 条`}
              />
            </div>
            <div style={{ overflowX: "auto" }}>
              <DataTable
                rowKey="id"
                dataSource={filteredDetails}
                showPagination={false}
                columns={[
                  {
                    title: "模块",
                    dataIndex: "module",
                    key: "module",
                    render: (v: string) => (
                      <span style={{ fontWeight: 600 }}>{v}</span>
                    ),
                  },
                  { title: "检查项", dataIndex: "checkItem", key: "checkItem" },
                  {
                    title: "状态",
                    dataIndex: "status",
                    key: "status",
                    render: (v: string) => (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "var(--space-1, 4px)",
                          padding: "2px 8px",
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: 600,
                          background:
                            v === "PASS"
                              ? "#ecfdf5"
                              : v === "FAIL"
                                ? "#fef2f2"
                                : "var(--color-warning-bg, #fffbeb)",
                          color:
                            v === "PASS"
                              ? COLORS.success
                              : v === "FAIL"
                                ? COLORS.danger
                                : COLORS.warning,
                        }}
                      >
                        {v === "PASS" ? (
                          <CheckCircle size={10} />
                        ) : v === "FAIL" ? (
                          <XCircle size={10} />
                        ) : (
                          <AlertTriangle size={10} />
                        )}
                        {v === "PASS"
                          ? "通过"
                          : v === "FAIL"
                            ? "未通过"
                            : "警告"}
                      </span>
                    ),
                  },
                  {
                    title: "严重级别",
                    dataIndex: "severity",
                    key: "severity",
                    render: (v: string) => (
                      <span
                        style={{
                          padding: "2px 8px",
                          borderRadius: 4,
                          fontSize: 12,
                          fontWeight: 600,
                          background:
                            v === "CRITICAL"
                              ? "#fef2f2"
                              : v === "MAJOR"
                                ? "var(--color-warning-bg, #fffbeb)"
                                : "var(--bg-primary, #f8fafc)",
                          color:
                            v === "CRITICAL"
                              ? COLORS.danger
                              : v === "MAJOR"
                                ? COLORS.warning
                                : COLORS.textMid,
                        }}
                      >
                        {v === "CRITICAL"
                          ? "严重"
                          : v === "MAJOR"
                            ? "主要"
                            : "轻微"}
                      </span>
                    ),
                  },
                  {
                    title: "描述",
                    dataIndex: "description",
                    key: "description",
                    render: (v: string) => (
                      <span style={{ color: COLORS.textMid }}>{v}</span>
                    ),
                  },
                  {
                    title: "检查时间",
                    dataIndex: "checkedAt",
                    key: "checkedAt",
                    render: (v: string) => (
                      <span style={{ color: COLORS.textLight }}>
                        {new Date(v).toLocaleDateString("zh-CN")}
                      </span>
                    ),
                  },
                ]}
              />
            </div>
          </Card>
        </div>
      )}

      {activeTab === "docs" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: "var(--space-4, 16px)",
          }}
        >
          {docs.map((doc) => (
            <Card
              bordered={false}
              key={doc.id}
              style={{
                background: COLORS.white,
                borderRadius: 12,
                border: `1px solid ${COLORS.border}`,
                padding: "var(--space-5, 20px)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              }}
              styles={{ body: { padding: 0 } }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "var(--space-3, 12px)",
                }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 600,
                    background:
                      doc.status === "CURRENT"
                        ? "#ecfdf5"
                        : doc.status === "DRAFT"
                          ? "var(--color-warning-bg, #fffbeb)"
                          : "var(--bg-primary, #f8fafc)",
                    color:
                      doc.status === "CURRENT"
                        ? COLORS.success
                        : doc.status === "DRAFT"
                          ? COLORS.warning
                          : COLORS.textLight,
                  }}
                >
                  {doc.status === "CURRENT"
                    ? "当前版本"
                    : doc.status === "DRAFT"
                      ? "草稿"
                      : "已归档"}
                </span>
                <span style={{ fontSize: 12, color: COLORS.textLight }}>
                  v{doc.version}
                </span>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.textDark,
                  marginBottom: 6,
                }}
              >
                {doc.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textMid,
                  marginBottom: "var(--space-3, 12px)",
                }}
              >
                {doc.category}
              </div>
              <div style={{ fontSize: 12, color: COLORS.textLight }}>
                更新于 {new Date(doc.updatedAt).toLocaleDateString("zh-CN")}
              </div>
            </Card>
          ))}
          {docs.length === 0 && (
            <div
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "var(--space-10, 40px)",
                color: COLORS.textLight,
              }}
            >
              暂无合规文档
            </div>
          )}
        </div>
      )}
    </div>
  );
}
