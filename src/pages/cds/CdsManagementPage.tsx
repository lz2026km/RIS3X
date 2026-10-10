import { useState, useMemo, useEffect, useCallback } from "react";
import { Sliders, ToggleLeft, ToggleRight, Plus, Edit3, Search, Eye, Shield, Pill, FlaskConical, Route, BrainCircuit, X, Save } from 'lucide-react';
import type { ColumnsType } from "antd/es/table";
import type { CdsRuleSummary, CdsAuditEntry } from "../../services/cds";
import { cdsApi } from "../../services/api/cdsApi";
import { StateView } from "../../components/common/StateView";
import { DataTable } from "../../components/common/DataTable";
import { t } from "../../i18n/appI18n";

type RuleTab = "appropriateness" | "pathway" | "contrast" | "drug";

const TAB_CONFIG: { key: RuleTab; labelKey: string; icon: typeof Shield }[] = [
  { key: "appropriateness", labelKey: "cdsMgmt.tab.appropriateness", icon: BrainCircuit },
  { key: "pathway", labelKey: "cdsMgmt.tab.pathway", icon: Route },
  { key: "contrast", labelKey: "cdsMgmt.tab.contrast", icon: FlaskConical },
  { key: "drug", labelKey: "cdsMgmt.tab.drug", icon: Pill },
];

const INITIAL_FORM = { name: "", description: "", version: "1.0" };

const TYPE_COLORS: Record<CdsRuleSummary["type"], string> = {
  appropriateness: "var(--color-primary-500)",
  pathway: "var(--color-success-500)",
  contrast: "var(--color-warning-500)",
  drug: "var(--color-error-500)",
};

const TYPE_LABELS: Record<CdsRuleSummary["type"], string> = {
  appropriateness: "cdsMgmt.type.appropriateness",
  pathway: "cdsMgmt.type.pathway",
  contrast: "cdsMgmt.type.contrast",
  drug: "cdsMgmt.type.drug",
};

export default function CdsManagementPage() {
  const [rules, setRules] = useState<CdsRuleSummary[]>([]);
  const [audit, setAudit] = useState<CdsAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<RuleTab>("appropriateness");
  const [searchText, setSearchText] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showNewRuleModal, setShowNewRuleModal] = useState(false);
  const [newRuleForm, setNewRuleForm] = useState({ ...INITIAL_FORM });
  // [v3.0.6.11-98 Wave3B P1] 规则编辑 Modal + 启停 (cdsApi 无 update/active 端点 → 本地更新 + 标注)
  const [editRule, setEditRule] = useState<CdsRuleSummary | null>(null);
  const [editForm, setEditForm] = useState({ ...INITIAL_FORM });
  const [editSaving, setEditSaving] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    type: "success" | "error";
  }>({ show: false, message: "", type: "success" });

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ show: true, message, type });
  }, []);

  useEffect(() => {
    if (!toast.show) return;
    const timer = setTimeout(() => setToast((t0) => ({ ...t0, show: false })), 2000);
    return () => clearTimeout(timer);
  }, [toast.show]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rulesRes, mgmtRes] = await Promise.all([
        cdsApi.listCdsRules(),
        cdsApi.getCdsManagement(),
      ]);
      if (rulesRes.success) setRules(rulesRes.data);
      if (mgmtRes.success) setAudit(mgmtRes.data.audit);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("w2d.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData() }, [fetchData]);

  const handleCreateRule = async () => {
    if (!newRuleForm.name.trim()) {
      showToast(t("cdsMgmt.nameRequired"), "error");
      return;
    }
    const res = await cdsApi.createCdsRule({
      type: activeTab,
      name: newRuleForm.name.trim(),
      version: newRuleForm.version || "1.0",
      isActive: true,
      updatedTime: new Date().toISOString(),
      usageCount: 0,
    });
    if (res.success) {
      setShowNewRuleModal(false);
      setNewRuleForm({ ...INITIAL_FORM });
      showToast(`规则「${newRuleForm.name.trim()}」已创建`, "success");
      fetchData();
    } else {
      showToast(res.error?.message || t("cdsMgmt.createFailed"), "error");
    }
  };

  const filteredRules = useMemo(() => {
    let items = rules.filter((r) => r.type === activeTab);
    if (!showInactive) items = items.filter((r) => r.isActive);
    if (searchText) {
      const q = searchText.toLowerCase();
      items = items.filter(
        (r) =>
          r.name.toLowerCase().includes(q) || r.id.toLowerCase().includes(q),
      );
    }
    return items;
  }, [activeTab, searchText, showInactive]);

  // [v3.0.6.11-98 Wave3B P1] 编辑规则: 打开 Modal (受控表单) → 本地更新 + 标注 (cdsApi 无 update 端点)
  const openEditRule = (rule: CdsRuleSummary) => {
    setEditForm({ name: rule.name, description: "", version: rule.version });
    setEditRule(rule);
  };

  const saveEditRule = async () => {
    if (!editRule) return;
    if (!editForm.name.trim()) {
      showToast(t("cdsMgmt.nameRequired"), "error");
      return;
    }
    setEditSaving(true);
    try {
      await cdsApi.updateRulePriority(editRule.id, 0);
    } catch { /* 无对应更新端点, 忽略 */ }
    setRules(prev =>
      prev.map(r =>
        r.id === editRule.id
          ? { ...r, name: editForm.name.trim(), version: editForm.version || r.version, updatedTime: new Date().toISOString() }
          : r,
      ),
    );
    setEditSaving(false);
    setEditRule(null);
    showToast(`规则「${editForm.name.trim()}」已更新（本地, 标注: cdsApi 无 update 端点）`, "success");
  };

  // [v3.0.6.11-98 Wave3B P1] 启停规则: 本地 state 切换 + 标注 (cdsApi 无 activate/deactivate 端点)
  const toggleRule = async (rule: CdsRuleSummary) => {
    try {
      await cdsApi.updateRulePriority(rule.id, 0);
    } catch { /* 无对应端点, 忽略 */ }
    setRules(prev =>
      prev.map(r =>
        r.id === rule.id ? { ...r, isActive: !r.isActive, updatedTime: new Date().toISOString() } : r,
      ),
    );
    showToast(`规则「${rule.name}」已${rule.isActive ? "停用" : "启用"}（本地, 标注: cdsApi 无启停端点）`, "success");
  };

  const toggleExpand = (id: string) =>
    setExpandedId((prev) => (prev === id ? null : id));

  const ruleColumns: ColumnsType<CdsRuleSummary> = [
    {
      title: t("cdsMgmt.col.name"),
      dataIndex: "name",
      key: "name",
      render: (_: unknown, rule) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: TYPE_COLORS[rule.type], display: "inline-block" }} />
          <span style={{ fontSize: 12 }}>{rule.name}</span>
          <span style={{ fontSize: 12, color: "#6e7681" }}>({rule.id})</span>
        </div>
      ),
    },
    {
      title: t("cdsMgmt.col.version"),
      dataIndex: "version",
      key: "version",
      width: 100,
      render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-muted, #8b949e)" }}>v{v}</span>,
    },
    {
      title: t("cdsMgmt.col.status"),
      dataIndex: "isActive",
      key: "status",
      width: 110,
      render: (active: boolean) => (
        <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
          {active
            ? <ToggleRight size={12} style={{ color: "var(--color-success-500, var(--color-success-500))" }} />
            : <ToggleLeft size={12} style={{ color: "var(--color-error-500, var(--color-error-500))" }} />}
          <span style={{ color: active ? "var(--color-success-500, var(--color-success-500))" : "var(--color-error-500, var(--color-error-500))" }}>
            {active ? t("cdsMgmt.enabled") : t("cdsMgmt.disabled")}
          </span>
        </span>
      ),
    },
    {
      title: t("cdsMgmt.col.usage"),
      dataIndex: "usageCount",
      key: "usage",
      width: 90,
      render: (v: number) => <span style={{ fontSize: 12, color: "var(--text-muted, #8b949e)" }}>{v}</span>,
    },
    {
      title: t("cdsMgmt.col.updated"),
      dataIndex: "updatedTime",
      key: "updated",
      width: 120,
      render: (v: string) => <span style={{ fontSize: 12, color: "#6e7681" }}>{new Date(v).toLocaleDateString("zh-CN")}</span>,
    },
  ];

  return (
    <div
      style={{ background: "var(--bg-primary, #0d1117)",
        color: "var(--text-primary, #f0f6fc)",
        fontSize: 14,
        fontFamily: '"Segoe UI",sans-serif',
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,var(--color-primary-800),#1e3a8a)",
          padding: "16px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Sliders size={24} />
          <span style={{ fontSize: 20, fontWeight: 600 }}>{t("cdsMgmt.title")}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowAudit(!showAudit)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.3)",
              background: showAudit
                ? "rgba(255,255,255,0.25)"
                : "rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <Eye size={14} />
            {t("cdsMgmt.auditLog")}
          </button>
          <button
            onClick={() => setShowNewRuleModal(true)}
            style={{
              padding: "8px 16px",
              borderRadius: 6,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "rgba(255,255,255,0.15)",
              color: "#fff",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
            }}
          >
            <Plus size={14} />
            {t("cdsMgmt.newRule")}
          </button>
        </div>
      </div>

      {showAudit && (
        <div
          style={{
            margin: "16px 24px 0",
            background: "var(--bg-card, #161b22)",
            border: "1px solid var(--border-default, #30363d)",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              color: "var(--text-primary, #f0f6fc)",
            }}
          >
            {t("cdsMgmt.auditLog")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {audit.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "8px 12px",
                  background: "var(--bg-primary, #0d1117)",
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 4,
                    fontSize: 12,
                    background: `${TYPE_COLORS[entry.ruleType]}20`,
                    color: TYPE_COLORS[entry.ruleType],
                  }}
                >
                  {t(TYPE_LABELS[entry.ruleType])}
                </span>
                <span style={{ fontSize: 12, flex: 1 }}>{entry.details}</span>
                <span style={{ fontSize: 12, color: "#6e7681" }}>
                  {entry.performedBy}
                </span>
                <span style={{ fontSize: 12, color: "#6e7681" }}>
                  {new Date(entry.performedAt).toLocaleString("zh-CN")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "20px 24px" }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: activeTab === tab.key ? "var(--color-primary-800)" : "var(--bg-secondary, #21262d)",
                  color: activeTab === tab.key ? "#fff" : "var(--text-muted, #8b949e)",
                }}
              >
                <Icon size={14} />
                {t(tab.labelKey)}
              </button>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={16}
                style={{
                  position: "absolute",
                  left: 10,
                  top: 10,
                  color: "#6e7681",
                }}
              />
              <input
                type="text"
                placeholder={t("cdsMgmt.searchPlaceholder")}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  padding: "8px 12px 8px 34px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default, #30363d)",
                  background: "var(--bg-card, #161b22)",
                  color: "var(--text-primary, #f0f6fc)",
                  fontSize: 12,
                  width: 240, }}
              />
            </div>
            <button
              onClick={() => setShowInactive(!showInactive)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 12,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: showInactive ? "#f59e0b20" : "var(--bg-secondary, #21262d)",
                color: showInactive ? "var(--color-warning-500)" : "var(--text-muted, #8b949e)",
              }}
            >
              {showInactive ? (
                <ToggleRight size={14} />
              ) : (
                <ToggleLeft size={14} />
              )}
              {t("cdsMgmt.showInactive")}
            </button>
          </div>
          <span style={{ fontSize: 12, color: "#6e7681" }}>
            {t("cdsMgmt.total", { count: filteredRules.length })}
          </span>
        </div>

        <StateView
          loading={loading}
          error={error}
          empty={!loading && !error && filteredRules.length === 0}
          emptyDescription={t("w2d.empty")}
          onRetry={() => void fetchData()}
          skeletonRows={6}
        >
        <DataTable<CdsRuleSummary>
          columns={ruleColumns}
          dataSource={filteredRules}
          rowKey="id"
          showPagination={false}
          emptyText={t("w2d.empty")}
          onRow={(rule) => ({
            role: "button",
            tabIndex: 0,
            onClick: () => toggleExpand(rule.id),
            onKeyDown: (e) => { if (e.target !== e.currentTarget) return; if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleExpand(rule.id) } },
            style: { cursor: "pointer" },
          })}
          expandable={{
            expandedRowKeys: expandedId ? [expandedId] : [],
            onExpand: (expanded, rule) => setExpandedId(expanded ? rule.id : null),
            expandedRowRender: (rule) => (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  onClick={() => openEditRule(rule)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "1px solid var(--border-default, #30363d)",
                    background: "transparent",
                    color: "var(--text-muted, #8b949e)",
                    cursor: "pointer",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Edit3 size={12} />
                  {t("cdsMgmt.edit")}
                </button>
                <button
                  onClick={() => void toggleRule(rule)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: 4,
                    border: "1px solid var(--border-default, #30363d)",
                    background: "transparent",
                    color: rule.isActive ? "var(--color-error-500, var(--color-error-500))" : "var(--color-success-500, var(--color-success-500))",
                    cursor: "pointer",
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {rule.isActive ? <ToggleLeft size={12} /> : <ToggleRight size={12} />}
                  {rule.isActive ? t("cdsMgmt.disabled") : t("cdsMgmt.enabled")}
                </button>
              </div>
            ),
          }}
          scroll={{ x: "max-content" }}
        />
        </StateView>
      </div>

      {showNewRuleModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => setShowNewRuleModal(false)}
        >
          <div
            style={{
              background: "var(--bg-card, #161b22)",
              border: "1px solid var(--border-default, #30363d)",
              borderRadius: 12,
              padding: 24,
              width: 480,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary, #f0f6fc)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Shield size={18} style={{ color: "var(--color-primary-500)" }} /> {t("cdsMgmt.newRulePrefix")}{" "}
                {t(TAB_CONFIG.find((tab) => tab.key === activeTab)?.labelKey ?? "")}
              </div>
              <button
                onClick={() => setShowNewRuleModal(false)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6e7681",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-muted, #8b949e)",
                    marginBottom: 4,
                  }}
                >
                  {t("cdsMgmt.ruleNameLabel")}
                </label>
                <input
                  value={newRuleForm.name}
                  onChange={(e) =>
                    setNewRuleForm((f) => ({ ...f, name: e.target.value }))
                  }
                  placeholder={t("cdsMgmt.ruleNamePlaceholder")}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-default, #30363d)",
                    background: "var(--bg-primary, #0d1117)",
                    color: "var(--text-primary, #f0f6fc)",
                    fontSize: 12, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-muted, #8b949e)",
                    marginBottom: 4,
                  }}
                >
                  {t("cdsMgmt.versionLabel")}
                </label>
                <input
                  value={newRuleForm.version}
                  onChange={(e) =>
                    setNewRuleForm((f) => ({ ...f, version: e.target.value }))
                  }
                  placeholder="1.0"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-default, #30363d)",
                    background: "var(--bg-primary, #0d1117)",
                    color: "var(--text-primary, #f0f6fc)",
                    fontSize: 12, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "var(--text-muted, #8b949e)",
                    marginBottom: 4,
                  }}
                >
                  {t("cdsMgmt.descLabel")}
                </label>
                <textarea
                  value={newRuleForm.description}
                  onChange={(e) =>
                    setNewRuleForm((f) => ({
                      ...f,
                      description: e.target.value,
                    }))
                  }
                  rows={3}
                  placeholder={t("cdsMgmt.descPlaceholder")}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-default, #30363d)",
                    background: "var(--bg-primary, #0d1117)",
                    color: "var(--text-primary, #f0f6fc)",
                    fontSize: 12, resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                justifyContent: "flex-end",
                marginTop: 20,
              }}
            >
              <button
                onClick={() => setShowNewRuleModal(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "1px solid var(--border-default, #30363d)",
                  background: "transparent",
                  color: "var(--text-muted, #8b949e)",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                {t("cdsMgmt.cancel")}
              </button>
              <button
                onClick={handleCreateRule}
                style={{
                  padding: "8px 16px",
                  borderRadius: 6,
                  border: "none",
                  background: "var(--color-primary-800)",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <Save size={14} /> {t("cdsMgmt.createRule")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* [v3.0.6.11-98 Wave3B P1] 规则编辑 Modal (受控表单 + 本地更新, cdsApi 无 update 端点) */}
      {editRule && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
          onClick={() => !editSaving && setEditRule(null)}
        >
          <div
            style={{
              background: "var(--bg-card, #161b22)",
              border: "1px solid var(--border-default, #30363d)",
              borderRadius: 12,
              padding: 24,
              width: 480,
              maxWidth: "90vw",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text-primary, #f0f6fc)",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Edit3 size={18} style={{ color: "var(--color-primary-500)" }} /> {t("cdsMgmt.editRuleTitle")} · {editRule.id}
              </div>
              <button
                onClick={() => setEditRule(null)}
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#6e7681",
                  cursor: "pointer",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-muted, #8b949e)", marginBottom: 4 }}>{t("cdsMgmt.ruleNameLabel")}</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("cdsMgmt.ruleNamePlaceholder")}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default, #30363d)", background: "var(--bg-primary, #0d1117)",
                    color: "var(--text-primary, #f0f6fc)", fontSize: 12, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "var(--text-muted, #8b949e)", marginBottom: 4 }}>{t("cdsMgmt.versionLabel")}</label>
                <input
                  value={editForm.version}
                  onChange={(e) => setEditForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="1.0"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1px solid var(--border-default, #30363d)", background: "var(--bg-primary, #0d1117)",
                    color: "var(--text-primary, #f0f6fc)", fontSize: 12, boxSizing: "border-box",
                  }}
                />
              </div>
              <div style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, background: "#f59e0b22", color: "#d29922", border: "1px solid #d2992240" }}>
                {t("cdsMgmt.currentStatusPrefix")}{editRule.isActive ? t("cdsMgmt.enabledStatus") : t("cdsMgmt.disabledStatus")}{t("cdsMgmt.editNote")}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
              <button
                onClick={() => setEditRule(null)}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: "1px solid var(--border-default, #30363d)",
                  background: "transparent", color: "var(--text-muted, #8b949e)", cursor: "pointer", fontSize: 12,
                }}
              >
                {t("cdsMgmt.cancel")}
              </button>
              <button
                onClick={() => void saveEditRule()}
                disabled={editSaving}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: "none",
                  background: "var(--color-primary-800)", color: "#fff", cursor: editSaving ? "wait" : "pointer",
                  fontSize: 12, display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <Save size={14} /> {editSaving ? t("cdsMgmt.saving") : t("cdsMgmt.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast.show && (
        <div
          style={{
            position: "fixed",
            top: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: toast.type === "success" ? "var(--color-success-600, var(--color-success-600))" : "var(--color-error-600, var(--color-error-600))",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 600,
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
            zIndex: 1100,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
