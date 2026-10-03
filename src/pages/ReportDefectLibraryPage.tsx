// ============================================================
// G005 放射科RIS系统 v1.0.4 - 报告缺陷分类字典
// Phase R4：缺陷分类管理 + 解决方案 + 统计
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import {
  AlertOctagon,
  AlertCircle,
  Plus,
  Edit2,
  Trash2,
  Search,
  FileText,
  Eye,
  Hash,
  BookOpen,
  Lightbulb,
  ListChecks,
  TrendingUp,
  MessageSquare,
  Activity,
  Save,
} from "lucide-react";
import {
  DEFECT_LIBRARY,
  QUALITY_KPI,
  type DefectItem,
  type DefectCategory,
} from "../data/qualityScoreMock";
import { AppModal } from "../components/common/AppModal";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { LoadingBanner, ErrorBanner } from "../components/feedback";
import { DataTable } from "../components/common/DataTable";
import type { ColumnsType } from "antd/es/table";
import { Drawer, Tag } from "antd";
import { reportQualityApi } from "../services/api";
import { qualityScoringCenterApi } from "../services/api/qualityScoringCenterApi";
import { t } from "../i18n/appI18n";

// [G005 W4A] /defect-library/items/:id 详情形状 (后端 DefectItem)
interface LibraryDefectDetail {
  id: string;
  code: string;
  categoryCode: string;
  name: string;
  severity: string;
  description: string;
  standard?: string;
  checkMethod?: string;
}

const PAGE_TO_LIBRARY_CATEGORY: Record<string, string> = {
  description: 'STRUCT',
  terminology: 'TERM',
  format: 'STRUCT',
  logic: 'ACCUR',
  critical: 'PROC',
  completeness: 'STRUCT',
}

const PAGE_TO_LIBRARY_SEVERITY: Record<string, 'low' | 'medium' | 'high' | 'critical'> = {
  minor: 'low',
  major: 'medium',
  critical: 'critical',
}

// ============================================================
// 分类配置
// ============================================================
const CATEGORY_CONFIG: Record<
  DefectCategory,
  { labelKey: string; color: string; bg: string; icon: any }
> = {
  description: {
    labelKey: "reportDefect.cat.description",
    color: "#3b82f6",
    bg: "#3b82f622",
    icon: FileText,
  },
  terminology: {
    labelKey: "reportDefect.cat.terminology",
    color: "#7c3aed",
    bg: "#8b5cf622",
    icon: BookOpen,
  },
  format: { labelKey: "reportDefect.cat.format", color: "#0891b2", bg: "#06b6d422", icon: Hash },
  logic: {
    labelKey: "reportDefect.cat.logic",
    color: "#ef4444", bg: "#ef444422",
    icon: AlertOctagon,
  },
  critical: {
    labelKey: "reportDefect.cat.critical",
    color: "#7f1d1d",
    bg: "#ef444422",
    icon: AlertCircle,
  },
  completeness: {
    labelKey: "reportDefect.cat.completeness",
    color: "#f59e0b", bg: "#f59e0b22",
    icon: ListChecks,
  },
};

const SEVERITY_CONFIG = {
  minor: { labelKey: "reportDefect.sev.minor", color: "#3b82f6", bg: "#3b82f622" },
  major: { labelKey: "reportDefect.sev.major", color: "#f59e0b", bg: "#f59e0b22" },
  critical: { labelKey: "reportDefect.sev.critical", color: "#ef4444", bg: "#ef444422" },
};

// ============================================================
// 主组件
// ============================================================
export default function ReportDefectLibraryPage() {
  const [defects] = useState<DefectItem[]>(DEFECT_LIBRARY);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [defectList, setDefects] = useState<DefectItem[]>(defects);
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [apiKpi, setApiKpi] = useState(QUALITY_KPI);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedDefect, setSelectedDefect] = useState<DefectItem | null>(
    defects[0] || null,
  );
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTriggersModal, setShowTriggersModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<DefectItem | null>(null);
  // [G005 W4A] 缺陷库单项详情 (GET /defect-library/items/:id)
  const [libraryDetail, setLibraryDetail] = useState<LibraryDefectDetail | null>(null);
  const [libraryDetailOpen, setLibraryDetailOpen] = useState(false);
  const [libraryDetailLoading, setLibraryDetailLoading] = useState(false);
  const [formState, setFormState] = useState({
    code: "",
    name: "",
    category: "description" as DefectCategory,
    severity: "minor" as DefectItem["severity"],
    description: "",
    solution: "",
  });
  const [toast, setToast] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  }>({ show: false, type: "success", message: "" });

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(
      () => setToast((t0) => ({ ...t0, show: false })),
      2400,
    );
    return () => clearTimeout(timer);
  }, [toast.show]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await reportQualityApi.getDefectLibrary()
        // [G005 P1] 列表双形状兼容: MSW 裸数组 / 后端 { items, total }
        const entries = Array.isArray(res.data) ? res.data : (res.data?.items ?? [])
        if (!cancelled && res.success && Array.isArray(entries) && entries.length) {
          const mapped: DefectItem[] = entries.map((entry, i) => {
            const detail = (entry.detail || {}) as Record<string, unknown>
            return {
              id: entry.id,
              code: (detail.code as string) || `DEF-${i + 1}`,
              name: (detail.name as string) || t('reportDefect.unknown'),
              category: (detail.category as DefectCategory) || 'description',
              severity: (detail.severity as DefectItem['severity']) || 'minor',
              description: (detail.description as string) || '',
              examples: (detail.examples as string[]) || [],
              solution: (detail.solution as string) || '',
              count: (detail.count as number) || 0,
            }
          })
          setDefects(mapped)
        }
        const statsRes = await reportQualityApi.getStats()
        if (!cancelled && statsRes.success && statsRes.data) {
          const stats = statsRes.data
          setApiKpi(prev => ({ ...prev, totalEvaluated: stats.total, avgScore: stats.avgScore }))
        }
        if (!cancelled) setLoadError(null)
      } catch {
        if (!cancelled) setLoadError(t('w9.states.error'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const resetForm = () => {
    setFormState({
      code: "",
      name: "",
      category: "description",
      severity: "minor",
      description: "",
      solution: "",
    });
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (d: DefectItem) => {
    setSelectedDefect(d);
    setFormState({
      code: d.code,
      name: d.name,
      category: d.category,
      severity: d.severity,
      description: d.description,
      solution: d.solution,
    });
    setShowEditModal(true);
  };

  // [G005 W4A] 打开缺陷库单项详情 (GET /defect-library/items/:id)
  const openLibraryDetail = async (d: DefectItem) => {
    setLibraryDetailOpen(true)
    setLibraryDetailLoading(true)
    setLibraryDetail(null)
    try {
      const res = await qualityScoringCenterApi.getDefectItem(d.id)
      if (res.success && res.data) setLibraryDetail(res.data as unknown as LibraryDefectDetail)
    } catch {
      setLibraryDetail(null)
    } finally {
      setLibraryDetailLoading(false)
    }
  }

  const handleSaveNew = async () => {
    if (!formState.code.trim() || !formState.name.trim()) {
      setToast({ show: true, type: "error", message: "编码与名称必填" });
      return;
    }
    const newDefect: DefectItem = {
      id: `def-${Date.now()}`,
      code: formState.code.trim(),
      name: formState.name.trim(),
      category: formState.category,
      severity: formState.severity,
      description: formState.description.trim(),
      solution: formState.solution.trim(),
      examples: [],
      count: 0,
    };
    setDefects((prev) => [newDefect, ...prev]);
    setSelectedDefect(newDefect);
    setShowAddModal(false);
    setToast({
      show: true,
      type: "success",
      message: `已新增缺陷：${newDefect.name}`,
    });
    await reportQualityApi.createDefectEntry(newDefect);
  };

  const handleSaveEdit = async () => {
    if (!selectedDefect) return;
    setDefects((prev) =>
      prev.map((x) =>
        x.id === selectedDefect.id
          ? {
              ...x,
              code: formState.code.trim() || x.code,
              name: formState.name.trim() || x.name,
              category: formState.category,
              severity: formState.severity,
              description: formState.description.trim(),
              solution: formState.solution.trim(),
            }
          : x,
      ),
    );
    setShowEditModal(false);
    setToast({
      show: true,
      type: "success",
      message: `已更新：${formState.name || selectedDefect.name}`,
    });
    await reportQualityApi.updateDefectEntry(selectedDefect.id, {
      code: formState.code.trim() || selectedDefect.code,
      name: formState.name.trim() || selectedDefect.name,
      category: formState.category,
      severity: formState.severity,
      description: formState.description.trim(),
      solution: formState.solution.trim(),
    });
    // [G005 W4A] 同步缺陷库单项 (PATCH /defect-library/items/:id)
    await qualityScoringCenterApi.updateDefectItem(selectedDefect.id, {
      name: formState.name.trim() || selectedDefect.name,
      categoryCode: PAGE_TO_LIBRARY_CATEGORY[formState.category] ?? 'STRUCT',
      severity: PAGE_TO_LIBRARY_SEVERITY[formState.severity] ?? 'medium',
      description: formState.description.trim(),
    }).catch(() => null);
  };

  const confirmDeleteDefect = (d: DefectItem) => {
    setSelectedDefect(d);
    setConfirmDelete(d);
  };

  const performDelete = () => {
    if (!confirmDelete) return;
    const name = confirmDelete.name;
    setDefects((prev) => prev.filter((x) => x.id !== confirmDelete.id));
    setSelectedDefect((prev) => (prev?.id === confirmDelete.id ? null : prev));
    const deletedId = confirmDelete.id;
    setConfirmDelete(null);
    setToast({ show: true, type: "success", message: `已删除：${name}` });
    // [G005 W4A] 同步删除缺陷库单项 (DELETE /defect-library/items/:id)
    void qualityScoringCenterApi.deleteDefectItem(deletedId).catch(() => null);
  };

  // [G005 P1] 修复: filteredDefects 依赖 defectList (API 数据源), 否则 useMemo 不随 API 更新重算
  const filteredDefects = useMemo(() => {
    return defectList.filter((d) => {
      if (filterCategory !== "all" && d.category !== filterCategory)
        return false;
      if (filterSeverity !== "all" && d.severity !== filterSeverity)
        return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !d.name.toLowerCase().includes(q) &&
          !d.code.toLowerCase().includes(q) &&
          !d.description.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [defectList, search, filterCategory, filterSeverity]);

  // 分类统计
  const categoryStats = useMemo(() => {
    const stats: Record<string, { count: number; totalCount: number }> = {};
    for (const d of defectList) {
      if (!stats[d.category]) stats[d.category] = { count: 0, totalCount: 0 };
      const bucket = stats[d.category]!;
      bucket.count += 1;
      bucket.totalCount += d.count;
    }
    return stats;
  }, [defectList]);

  const defectColumns: ColumnsType<DefectItem> = [
    {
      title: t("w3tables.col.category"), dataIndex: "category", key: "category", width: 150,
      render: (_: unknown, d) => {
        const cConf = CATEGORY_CONFIG[d.category] ?? CATEGORY_CONFIG.description;
        const sConf = SEVERITY_CONFIG[d.severity] ?? SEVERITY_CONFIG.minor;
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "1px 5px", borderRadius: 2, background: cConf.bg, color: cConf.color, fontWeight: 600 }}>{t(cConf.labelKey)}</span>
            <span style={{ fontSize: 12, padding: "1px 4px", borderRadius: 2, background: sConf.bg, color: sConf.color, fontWeight: 700 }}>{t(sConf.labelKey)}</span>
          </div>
        );
      },
    },
    { title: t("w3tables.col.name"), dataIndex: "name", key: "name", render: (v: string) => <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{v}</span> },
    { title: t("w3tables.col.code"), dataIndex: "code", key: "code", width: 110, render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v}</span> },
    { title: t("w3tables.col.count"), dataIndex: "count", key: "count", width: 80, align: "right", render: (v: number) => <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-secondary)" }}>×{v}</span> },
  ];

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto" }}>
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}

      {/* 顶部 */}
      <div
        style={{
          marginBottom: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h1
            style={{
              fontSize: 20,
              color: "var(--text-primary)",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertOctagon size={20} color="#dc2626" /> {t('reportDefect.title')}
            <span
              style={{
                fontSize: 12,
                padding: "2px 6px",
                background: "#10b981",
                color: "#fff",
                borderRadius: 3,
                fontWeight: 700,
              }}
            >
              R4
            </span>
          </h1>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {t('reportDefect.summary', { count: defectList.length, evaluated: apiKpi.totalEvaluated })}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={openAddModal}
            style={{
              padding: "6px 12px",
              border: "none",
              borderRadius: 6,
              background: "#3b82f6",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Plus size={12} /> {t('reportDefect.addDefect')}
          </button>
        </div>
      </div>

      {/* 分类统计卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(6, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        {Object.entries(CATEGORY_CONFIG).map(([key, conf]) => {
          const stat = categoryStats[key] || { count: 0, totalCount: 0 };
          const Icon = conf.icon;
          return (
            <div
              key={key}
              onClick={() =>
                setFilterCategory(key === filterCategory ? "all" : key)
              }
              style={{
                background: "var(--bg-card)",
                padding: 12,
                borderRadius: 8,
                border: `2px solid ${filterCategory === key ? conf.color : "#e2e8f0"}`,
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: `${conf.color}15`,
                    color: conf.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon size={14} />
                </div>
                <div
                  style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}
                >
                  {t(conf.labelKey)}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                <span
                  style={{ fontSize: 18, fontWeight: 700, color: conf.color }}
                >
                  {stat.count}
                </span>
                <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {t('reportDefect.categoryStat', { count: stat.totalCount })}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Top 5 触发排行 */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--color-warning-bg) 0%, var(--color-warning-bg) 100%)",
          borderRadius: 8,
          padding: 12,
          marginBottom: 16,
          border: "1px solid #fcd34d",
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: "#92400e",
            marginBottom: 8,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <TrendingUp size={13} /> {t('reportDefect.top5')}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, 1fr)",
            gap: 8,
          }}
        >
          {apiKpi.defectTopList.map((d, i) => {
            const defect = defectList.find((x) => x.code === d.code);
            return (
              <div
                key={d.code}
                style={{
                  background: "var(--bg-card)",
                  borderRadius: 6,
                  padding: 8,
                  border: "1px solid #fbbf24",
                }}
              >
                <div style={{ fontSize: 12, color: "#92400e", fontWeight: 700 }}>
                  {t('reportDefect.rank', { n: i + 1 })}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--text-primary)",
                    fontWeight: 600,
                    marginTop: 2,
                  }}
                >
                  {d.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{d.code}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#dc2626",
                    marginTop: 4,
                  }}
                >
                  {d.count}
                </div>
                {defect && (
                  <span
                    style={{
                      fontSize: 12,
                      padding: "1px 4px",
                      borderRadius: 2,
                      background: SEVERITY_CONFIG[defect.severity].bg,
                      color: SEVERITY_CONFIG[defect.severity].color,
                      fontWeight: 700,
                      marginTop: 4,
                      display: "inline-block",
                    }}
                  >
                    {t(SEVERITY_CONFIG[defect.severity].labelKey)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 12 }}
      >
        {/* 左：缺陷列表 */}
        <div
          style={{
            background: "var(--bg-card)",
            borderRadius: 8,
            border: "1px solid var(--border-color)",
            overflow: "hidden",
          }}
        >
          <div
            style={{ padding: "8px 12px", borderBottom: "1px solid var(--border-color)" }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                marginBottom: 6,
              }}
            >
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={11}
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 8,
                    color: "var(--text-secondary)",
                  }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t('reportDefect.searchPlaceholder')}
                  style={{
                    width: "100%",
                    padding: "5px 8px 5px 26px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 12,
                    outline: "none",
                  }}
                />
              </div>
              <select
                value={filterSeverity}
                onChange={(e) => setFilterSeverity(e.target.value)}
                style={selectStyle}
              >
                <option value="all">{t('reportDefect.all')}</option>
                <option value="critical">{t('reportDefect.sev.critical')}</option>
                <option value="major">{t('reportDefect.sev.major')}</option>
                <option value="minor">{t('reportDefect.sev.minor')}</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <strong style={{ color: "#1e40af" }}>
                {filteredDefects.length}
              </strong>{" "}
              {t('reportDefect.ofItems', { count: defects.length })}
            </div>
          </div>
          <DataTable<DefectItem>
            columns={defectColumns}
            dataSource={filteredDefects}
            rowKey="id"
            loading={loading}
            showPagination={false}
            emptyText={t('w9.states.noResults')}
            onRow={(d) => ({
              onClick: () => setSelectedDefect(d),
              style: {
                cursor: "pointer",
                background: selectedDefect?.id === d.id ? "var(--color-info-bg)" : undefined,
                borderLeft: selectedDefect?.id === d.id ? "3px solid #3b82f6" : "3px solid transparent",
              },
            })}
            scroll={{ x: "max-content" }}
          />
        </div>

        {/* 右：详情 */}
        {selectedDefect && (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 8,
              padding: 16,
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 10,
                  background: `${CATEGORY_CONFIG[selectedDefect.category].color}15`,
                  color: CATEGORY_CONFIG[selectedDefect.category].color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {(() => {
                  const Icon = CATEGORY_CONFIG[selectedDefect.category].icon;
                  return <Icon size={24} />;
                })()}
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}
                >
                  {selectedDefect.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {t('reportDefect.codeLabel')}{selectedDefect.code}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{t('reportDefect.triggerCount')}</div>
                <div
                  style={{ fontSize: 24, fontWeight: 700, color: "#dc2626" }}
                >
                  {selectedDefect.count}
                </div>
              </div>
            </div>

            {/* 标签行 */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <span
                style={{
                  fontSize: 12,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background: CATEGORY_CONFIG[selectedDefect.category].bg,
                  color: CATEGORY_CONFIG[selectedDefect.category].color,
                  fontWeight: 600,
                }}
              >
                {t(CATEGORY_CONFIG[selectedDefect.category].labelKey)}
              </span>
              <span
                style={{
                  fontSize: 12,
                  padding: "3px 10px",
                  borderRadius: 12,
                  background: SEVERITY_CONFIG[selectedDefect.severity].bg,
                  color: SEVERITY_CONFIG[selectedDefect.severity].color,
                  fontWeight: 600,
                }}
              >
                {t('reportDefect.severityLabel')}{t(SEVERITY_CONFIG[selectedDefect.severity].labelKey)}
              </span>
            </div>

            {/* 描述 */}
            <div
              style={{
                marginBottom: 12,
                padding: 10,
                background: "var(--bg-card)",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                {t('reportDefect.description')}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.6 }}>
                {selectedDefect.description}
              </div>
            </div>

            {/* 示例 */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "#1e40af",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <MessageSquare size={12} /> {t('reportDefect.examples')}
              </div>
              {selectedDefect.examples.map((ex, i) => (
                <div
                  key={i}
                  style={{
                    padding: 8,
                    marginBottom: 4,
                    background: "var(--color-error-bg)",
                    borderLeft: "3px solid #dc2626",
                    borderRadius: 4,
                    fontSize: 12,
                    color: "#7f1d1d",
                  }}
                >
                  ❌ {ex}
                </div>
              ))}
            </div>

            {/* 解决方案 */}
            <div
              style={{
                padding: 10,
                background: "var(--color-success-bg)",
                border: "1px solid #bbf7d0",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#047857",
                  fontWeight: 700,
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Lightbulb size={12} /> {t('reportDefect.solution')}
              </div>
              <div style={{ fontSize: 12, color: "#065f46", lineHeight: 1.6 }}>
                {selectedDefect.solution}
              </div>
            </div>

            {/* 操作按钮 */}
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 12,
                paddingTop: 12,
                borderTop: "1px solid var(--border-color)",
              }}
            >
              <button
                onClick={() => openEditModal(selectedDefect)}
                style={{
                  padding: "5px 10px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Edit2 size={11} /> {t('reportDefect.edit')}
              </button>
              <button
                onClick={() => void openLibraryDetail(selectedDefect)}
                style={{
                  padding: "5px 10px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Eye size={11} /> {t('w4a.defect.viewDetail')}
              </button>
              <button
                onClick={() => {
                  setSelectedDefect(selectedDefect);
                  setShowTriggersModal(true);
                }}
                style={{
                  padding: "5px 10px",
                  border: "1px solid var(--border-color)",
                  borderRadius: 4,
                  background: "var(--bg-card)",
                  color: "var(--text-secondary)",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Eye size={11} /> {t('reportDefect.triggers')}
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteDefect(selectedDefect)}
                style={{
                  padding: "5px 10px",
                  border: "1px solid #dc2626",
                  borderRadius: 4,
                  background: "var(--bg-card)",
                  color: "#dc2626",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginLeft: "auto",
                }}
              >
                <Trash2 size={14} /> {t('reportDefect.delete')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* [G005 W4A] 缺陷库单项详情 Drawer (GET /defect-library/items/:id) */}
      <Drawer
        title={`${t('w4a.defect.viewDetail')}${libraryDetail ? ` · ${libraryDetail.code}` : ''}`}
        width={460}
        open={libraryDetailOpen}
        onClose={() => setLibraryDetailOpen(false)}
      >
        {libraryDetailLoading ? (
          <LoadingBanner message={t('w9.states.loading')} />
        ) : libraryDetail ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{libraryDetail.name}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 6 }}>
                <Tag>{libraryDetail.code}</Tag>
                <Tag color="geekblue">{libraryDetail.categoryCode}</Tag>
                <Tag color={libraryDetail.severity === "critical" ? "red" : libraryDetail.severity === "high" ? "orange" : libraryDetail.severity === "medium" ? "blue" : "default"}>{libraryDetail.severity}</Tag>
                <Tag color="green">{t('w4a.defect.libraryLoaded')}</Tag>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{t('reportDefect.description')}</div>
              <div style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-primary)" }}>{libraryDetail.description}</div>
            </div>
            {libraryDetail.standard && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{t('w4a.defect.standard')}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{libraryDetail.standard}</div>
              </div>
            )}
            {libraryDetail.checkMethod && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>{t('w4a.defect.checkMethod')}</div>
                <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{libraryDetail.checkMethod}</div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 24, color: "var(--text-secondary)", fontSize: 12 }}>{t('w9.states.noResults')}</div>
        )}
      </Drawer>

      {/* 新增缺陷 Modal */}
      <AppModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={t('reportDefect.addTitle')}
        icon={<Plus size={18} />}
        iconBg="var(--color-info-bg)"
        iconColor="#1e40af"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowAddModal(false)}
              style={{
                padding: "8px 18px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t('reportDefect.cancel')}
            </button>
            <button
              onClick={handleSaveNew}
              style={{
                padding: "8px 18px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Save size={12} /> {t('reportDefect.save')}
            </button>
          </>
        }
      >
        <DefectFormFields
          formState={formState}
          onChange={setFormState}
          idPrefix="new-"
        />
      </AppModal>

      {/* 编辑缺陷 Modal */}
      <AppModal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title={t('reportDefect.editTitle')}
        icon={<Edit2 size={18} />}
        iconBg="var(--color-warning-bg)"
        iconColor="#b45309"
        size="md"
        footer={
          <>
            <button
              onClick={() => setShowEditModal(false)}
              style={{
                padding: "8px 18px",
                border: "1px solid var(--border-color)",
                background: "var(--bg-card)",
                color: "var(--text-secondary)",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {t('reportDefect.cancel')}
            </button>
            <button
              onClick={handleSaveEdit}
              style={{
                padding: "8px 18px",
                border: "none",
                background: "#3b82f6",
                color: "#fff",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Save size={12} /> {t('reportDefect.saveEdit')}
            </button>
          </>
        }
      >
        <DefectFormFields
          formState={formState}
          onChange={setFormState}
          idPrefix="edit-"
        />
      </AppModal>

      {/* 触发记录 Modal */}
      <AppModal
        open={showTriggersModal}
        onClose={() => setShowTriggersModal(false)}
        title={t('reportDefect.triggers')}
        icon={<Activity size={18} />}
        iconBg="var(--color-success-bg)"
        iconColor="#15803d"
        width={680}
      >
        {selectedDefect ? (
          <div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 8,
                padding: 12,
                border: "1px solid var(--border-color)",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                {selectedDefect.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {t('reportDefect.codeInline', { code: selectedDefect.code, count: selectedDefect.count })}
              </div>
            </div>
            {selectedDefect.count > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {Array.from({ length: Math.min(5, selectedDefect.count) }).map(
                  (_, i) => (
                    <div
                      key={i}
                      style={{
                        padding: 10,
                        border: "1px solid var(--border-color)",
                        borderRadius: 6,
                        fontSize: 12,
                        color: "var(--text-primary)",
                        background: "var(--bg-card)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{t('reportDefect.triggerRecord', { n: i + 1 })}</span>
                        <span
                          style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}
                        >
                          2026-05-{(i + 1).toString().padStart(2, "0")} 09:
                          {10 + i * 3}
                        </span>
                      </div>
                      <div style={{ color: "var(--text-secondary)", marginTop: 4 }}>
                        {t('reportDefect.operatorInfo', { id: 1000 + i })}
                      </div>
                    </div>
                  ),
                )}
              </div>
            ) : (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  color: "var(--text-secondary)",
                  fontSize: 12,
                }}
              >
                {t('reportDefect.noTriggers')}
              </div>
            )}
          </div>
        ) : null}
      </AppModal>

      {/* 删除确认 Modal */}
      <ConfirmDialog
        open={!!confirmDelete}
        title={t('reportDefect.deleteTitle')}
        message={`确定删除缺陷 "${confirmDelete?.name}" 吗?该操作不可撤销。`}
        confirmText={t('reportDefect.delete')}
        variant="danger"
        onCancel={() => setConfirmDelete(null)}
        onConfirm={performDelete}
      />

      {toast.show && (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "success" ? "#059669" : "#dc2626",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            zIndex: "var(--z-toast, 800)",
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}

interface DefectFormFieldsProps {
  formState: {
    code: string;
    name: string;
    category: DefectCategory;
    severity: DefectItem["severity"];
    description: string;
    solution: string;
  };
  onChange: (next: DefectFormFieldsProps["formState"]) => void;
  idPrefix: string;
}

function DefectFormFields({
  formState,
  onChange,
  idPrefix,
}: DefectFormFieldsProps) {
  const set = <K extends keyof DefectFormFieldsProps["formState"]>(
    key: K,
    value: DefectFormFieldsProps["formState"][K],
  ) => {
    onChange({ ...formState, [key]: value });
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: 6,
    border: "1px solid var(--border-color)",
    fontSize: 12,
    outline: "none",
    boxSizing: "border-box",
  };
  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: 4,
    display: "block",
  };
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label htmlFor={`${idPrefix}code`} style={labelStyle}>
            {t('reportDefect.field.code')}
          </label>
          <input
            id={`${idPrefix}code`}
            value={formState.code}
            onChange={(e) => set("code", e.target.value)}
            placeholder={t('reportDefect.field.codePlaceholder')}
            style={inputStyle}
          />
        </div>
        <div>
          <label htmlFor={`${idPrefix}name`} style={labelStyle}>
            {t('reportDefect.field.name')}
          </label>
          <input
            id={`${idPrefix}name`}
            value={formState.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder={t('reportDefect.field.namePlaceholder')}
            style={inputStyle}
          />
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <label htmlFor={`${idPrefix}category`} style={labelStyle}>
            {t('reportDefect.field.category')}
          </label>
          <select
            id={`${idPrefix}category`}
            value={formState.category}
            onChange={(e) => set("category", e.target.value as DefectCategory)}
            style={inputStyle}
          >
            {Object.entries(CATEGORY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v.labelKey)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={`${idPrefix}severity`} style={labelStyle}>
            {t('reportDefect.field.severity')}
          </label>
          <select
            id={`${idPrefix}severity`}
            value={formState.severity}
            onChange={(e) =>
              set("severity", e.target.value as DefectItem["severity"])
            }
            style={inputStyle}
          >
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>
                {t(v.labelKey)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor={`${idPrefix}description`} style={labelStyle}>
          {t('reportDefect.field.description')}
        </label>
        <textarea
          id={`${idPrefix}description`}
          value={formState.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          placeholder={t('reportDefect.field.descriptionPlaceholder')}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>
      <div>
        <label htmlFor={`${idPrefix}solution`} style={labelStyle}>
          {t('reportDefect.field.solution')}
        </label>
        <textarea
          id={`${idPrefix}solution`}
          value={formState.solution}
          onChange={(e) => set("solution", e.target.value)}
          rows={2}
          placeholder={t('reportDefect.field.solutionPlaceholder')}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
        />
      </div>
    </div>
  );
}

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: "3px 8px",
  border: "1px solid var(--border-color)",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
};
