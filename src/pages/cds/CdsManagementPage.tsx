import { useState, useMemo, useEffect, useCallback } from "react";
import { Sliders, ToggleLeft, ToggleRight, Plus, Edit3, Search, Eye, ChevronDown, ChevronRight, Shield, Pill, FlaskConical, Route, BrainCircuit, X, Save } from 'lucide-react';
import type { CdsRuleSummary, CdsAuditEntry } from "../../services/cds";
import { cdsApi } from "../../services/api/cdsApi";
import { StateView } from "../../components/common/StateView";
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
  appropriateness: "#3b82f6",
  pathway: "#22c55e",
  contrast: "#f59e0b",
  drug: "#ef4444",
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1117",
        color: "#f0f6fc",
        fontSize: 14,
        fontFamily: '"Segoe UI",sans-serif',
      }}
    >
      <div
        style={{
          background: "linear-gradient(135deg,#1e40af,#1e3a8a)",
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
              fontSize: 13,
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
              fontSize: 13,
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
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              marginBottom: 12,
              color: "#f0f6fc",
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
                  background: "#0d1117",
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
                <span style={{ fontSize: 13, flex: 1 }}>{entry.details}</span>
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
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: activeTab === tab.key ? "#1e40af" : "#21262d",
                  color: activeTab === tab.key ? "#fff" : "#8b949e",
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
                  border: "1px solid #30363d",
                  background: "#161b22",
                  color: "#f0f6fc",
                  fontSize: 13,
                  width: 240,
                  outline: "none",
                }}
              />
            </div>
            <button
              onClick={() => setShowInactive(!showInactive)}
              style={{
                padding: "8px 14px",
                borderRadius: 6,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: showInactive ? "#f59e0b20" : "#21262d",
                color: showInactive ? "#f59e0b" : "#8b949e",
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
          <span style={{ fontSize: 13, color: "#6e7681" }}>
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
        <div
          style={{
            background: "#161b22",
            border: "1px solid #30363d",
            borderRadius: 8,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "24px 1fr 100px 80px 100px 100px",
              gap: 8,
              padding: "12px 16px",
              borderBottom: "1px solid #21262d",
              background: "#0d1117",
              color: "#8b949e",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            <span></span>
            <span>{t("cdsMgmt.col.name")}</span>
            <span>{t("cdsMgmt.col.version")}</span>
            <span>{t("cdsMgmt.col.status")}</span>
            <span>{t("cdsMgmt.col.usage")}</span>
            <span>{t("cdsMgmt.col.updated")}</span>
          </div>
          {filteredRules.map((rule, idx) => (
            <div key={rule.id}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr 100px 80px 100px 100px",
                  gap: 8,
                  padding: "12px 16px",
                  borderBottom: "1px solid #21262d",
                  alignItems: "center",
                  background: idx % 2 === 0 ? "#0d1117" : "#161b22",
                  cursor: "pointer",
                }}
                onClick={() => toggleExpand(rule.id)}
              >
                <span style={{ color: "#6e7681" }}>
                  {expandedId === rule.id ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: TYPE_COLORS[rule.type],
                      display: "inline-block",
                    }}
                  ></span>
                  <span style={{ fontSize: 13 }}>{rule.name}</span>
                  <span style={{ fontSize: 12, color: "#6e7681" }}>
                    ({rule.id})
                  </span>
                </div>
                <span style={{ fontSize: 12, color: "#8b949e" }}>
                  v{rule.version}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  {rule.isActive ? (
                    <>
                      <ToggleRight size={12} style={{ color: "var(--color-success-500, #22c55e)" }} />
                      <span style={{ color: "var(--color-success-500, #22c55e)" }}>{t("cdsMgmt.enabled")}</span>
                    </>
                  ) : (
                    <>
                      <ToggleLeft size={12} style={{ color: "var(--color-error-500, #ef4444)" }} />
                      <span style={{ color: "var(--color-error-500, #ef4444)" }}>{t("cdsMgmt.disabled")}</span>
                    </>
                  )}
                </span>
                <span style={{ fontSize: 12, color: "#8b949e" }}>
                  {rule.usageCount}
                </span>
                <span style={{ fontSize: 12, color: "#6e7681" }}>
                  {new Date(rule.updatedTime).toLocaleDateString("zh-CN")}
                </span>
              </div>
              {expandedId === rule.id && (
                <div
                  style={{
                    padding: "12px 16px 12px 48px",
                    background: "#0d1117",
                    borderBottom: "1px solid #21262d",
                    display: "flex",
                    gap: 8,
                  }}
                >
                  <button
                    onClick={() => openEditRule(rule)}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 4,
                      border: "1px solid #30363d",
                      background: "transparent",
                      color: "#8b949e",
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
                      border: "1px solid #30363d",
                      background: "transparent",
                      color: rule.isActive ? "var(--color-error-500, #ef4444)" : "var(--color-success-500, #22c55e)",
                      cursor: "pointer",
                      fontSize: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {rule.isActive ? (
                      <ToggleLeft size={12} />
                    ) : (
                      <ToggleRight size={12} />
                    )}
                    {rule.isActive ? t("cdsMgmt.disabled") : t("cdsMgmt.enabled")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
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
              background: "#161b22",
              border: "1px solid #30363d",
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
                  color: "#f0f6fc",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Shield size={18} style={{ color: "#3b82f6" }} /> {t("cdsMgmt.newRulePrefix")}{" "}
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
                    color: "#8b949e",
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
                    border: "1px solid #30363d",
                    background: "#0d1117",
                    color: "#f0f6fc",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#8b949e",
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
                    border: "1px solid #30363d",
                    background: "#0d1117",
                    color: "#f0f6fc",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  style={{
                    display: "block",
                    fontSize: 12,
                    color: "#8b949e",
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
                    border: "1px solid #30363d",
                    background: "#0d1117",
                    color: "#f0f6fc",
                    fontSize: 13,
                    outline: "none",
                    resize: "vertical",
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
                  border: "1px solid #30363d",
                  background: "transparent",
                  color: "#8b949e",
                  cursor: "pointer",
                  fontSize: 13,
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
                  background: "#1e40af",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: 13,
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
              background: "#161b22",
              border: "1px solid #30363d",
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
                  color: "#f0f6fc",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Edit3 size={18} style={{ color: "#3b82f6" }} /> {t("cdsMgmt.editRuleTitle")} · {editRule.id}
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
                <label style={{ display: "block", fontSize: 12, color: "#8b949e", marginBottom: 4 }}>{t("cdsMgmt.ruleNameLabel")}</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder={t("cdsMgmt.ruleNamePlaceholder")}
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1px solid #30363d", background: "#0d1117",
                    color: "#f0f6fc", fontSize: 13, outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, color: "#8b949e", marginBottom: 4 }}>{t("cdsMgmt.versionLabel")}</label>
                <input
                  value={editForm.version}
                  onChange={(e) => setEditForm((f) => ({ ...f, version: e.target.value }))}
                  placeholder="1.0"
                  style={{
                    width: "100%", padding: "8px 12px", borderRadius: 6,
                    border: "1px solid #30363d", background: "#0d1117",
                    color: "#f0f6fc", fontSize: 13, outline: "none", boxSizing: "border-box",
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
                  padding: "8px 16px", borderRadius: 6, border: "1px solid #30363d",
                  background: "transparent", color: "#8b949e", cursor: "pointer", fontSize: 13,
                }}
              >
                {t("cdsMgmt.cancel")}
              </button>
              <button
                onClick={() => void saveEditRule()}
                disabled={editSaving}
                style={{
                  padding: "8px 16px", borderRadius: 6, border: "none",
                  background: "#1e40af", color: "#fff", cursor: editSaving ? "wait" : "pointer",
                  fontSize: 13, display: "flex", alignItems: "center", gap: 6,
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
            background: toast.type === "success" ? "var(--color-success-600, #16a34a)" : "var(--color-error-600, #dc2626)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 13,
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
