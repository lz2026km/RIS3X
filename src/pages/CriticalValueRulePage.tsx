// ============================================================
// G005 放射科RIS系统 v1.0.5 - 危急值规则配置
// Phase R5：18 条危急值规则 · 7 类别 · 多渠道通报 · 响应时限
// [v3.0.6.11-82] W3-C: 接入 criticalExtApi.listRules (/critical-ext/rules 真实后端), 失败回退演示数据
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, Settings, Edit2, Search, Phone, MessageSquare, Bell, Smartphone, Clock, Activity, BarChart3, Zap, CheckCircle2, CheckCircle } from 'lucide-react';
import { LoadingBanner } from "../components/feedback";
import { DataTable } from "../components/common/DataTable";
import type { ColumnsType } from "antd/es/table";
import {
  CRITICAL_VALUE_RULES,
  CRITICAL_VALUE_KPI,
  type CriticalValueRule,
} from "../data/criticalValueAssessmentMock";
import { criticalExtApi } from "../services/api/criticalExtApi";
import { Select, Typography } from "antd";
import { AppModal } from "../components/common/AppModal";
import { ActionButton } from "../components/common/ActionButton";
import { StatCard } from "../components/common";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { t } from "../i18n/appI18n";

const { Title } = Typography

// ============================================================
// 类别配置
// ============================================================
const CATEGORY_CONFIG: Record<
  CriticalValueRule['category'],
  { label: string; color: string; bg: string }
> = {
  neuro: { label: t("cvRule.cat.neuro"), color: "#7c3aed", bg: "#8b5cf622" },
  cardio: { label: t("cvRule.cat.cardio"), color: "var(--color-error-500)", bg: "#ef444422" },
  pulmo: { label: t("cvRule.cat.pulmo"), color: "var(--color-info-600)", bg: "#06b6d422" },
  abdomen: { label: t("cvRule.cat.abdomen"), color: "var(--color-warning-500)", bg: "#f59e0b22" },
  trauma: { label: t("cvRule.cat.trauma"), color: "#7f1d1d", bg: "#ef444422" },
  vascular: { label: t("cvRule.cat.vascular"), color: "var(--color-primary-500)", bg: "#3b82f622" },
  contrast: { label: t("cvRule.cat.contrast"), color: "#a855f7", bg: "#8b5cf622" },
};

const SEVERITY_CONFIG = {
  high: { label: t("cvRule.sev.high"), color: "var(--color-warning-500)", bg: "#f59e0b22" },
  critical: { label: t("cvRule.sev.critical"), color: "var(--color-error-500)", bg: "#ef444422" },
};

const CHANNEL_ICONS: Record<string, any> = {
  phone: Phone,
  sms: MessageSquare,
  wechat: Smartphone,
  inApp: Bell,
};

const CHANNEL_LABELS: Record<string, string> = {
  phone: t("cvRule.channel.phone"),
  sms: t("cvRule.channel.sms"),
  wechat: t("cvRule.channel.wechat"),
  inApp: t("cvRule.channel.inApp"),
};

// ============================================================
// 主组件
// ============================================================
export default function CriticalValueRulePage() {
  const navigate = useNavigate();
  const [ruleList, setRuleList] =
    useState<CriticalValueRule[]>(CRITICAL_VALUE_RULES);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [source, setSource] = useState<'api' | 'demo'>('demo');
  const [search, setSearch] = useState("");
  const [filterCategory] = useState("all");
  const [filterSeverity, setFilterSeverity] = useState("all");
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>("cv-001");
  const [ruleEdit, setRuleEdit] = useState<CriticalValueRule | null>(null);
  const [ruleTriggers, setRuleTriggers] = useState<CriticalValueRule | null>(
    null,
  );
  const [saveDialog, setSaveDialog] = useState<{
    open: boolean;
    message: string;
  }>({ open: false, message: "" });
  const [confirmDisable, setConfirmDisable] =
    useState<CriticalValueRule | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    responseDeadline: number;
    description: string;
    isActive: boolean;
  }>({ name: "", responseDeadline: 10, description: "", isActive: true });
  const [toast, setToast] = useState<{
    show: boolean;
    type: "success" | "error";
    message: string;
  }>({ show: false, type: "success", message: "" });

  useEffect(() => {
    if (!toast.show) return;
    const t = setTimeout(
      () => setToast((t0) => ({ ...t0, show: false })),
      2400,
    );
    return () => clearTimeout(t);
  }, [toast.show]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await criticalExtApi.listRules();
        if (cancelled) return;
        const raw = Array.isArray(res.data) ? res.data : (res.data as { items?: unknown[] } | null)?.items;
        if (res.success && Array.isArray(raw) && raw.length > 0) {
          const mapped: CriticalValueRule[] = (raw as Array<Record<string, any>>).map((r, i) => {
            const demo = CRITICAL_VALUE_RULES.find((d) => d.name === r.name) ?? CRITICAL_VALUE_RULES[i % CRITICAL_VALUE_RULES.length]!;
            return {
              id: r.id ?? `cv-api-${i + 1}`,
              name: r.name ?? demo.name,
              code: demo.code,
              category: demo.category,
              severity: r.severity === 'critical' ? 'critical' : 'high',
              responseDeadline: demo.responseDeadline,
              notificationChannels: demo.notificationChannels,
              keywords: demo.keywords,
              findings: r.condition ?? demo.findings,
              modality: demo.modality,
              bodyPart: demo.bodyPart,
              description: r.action ?? demo.description,
              isActive: r.enabled ?? true,
              reference: demo.reference,
            };
          });
          setRuleList(mapped);
          setSource('api');
        } else {
          setLoadError(res.error?.message ?? t("cvRule.apiUnavailable"));
        }
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : t("cvRule.apiUnavailable"));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const openEditRule = (rule: CriticalValueRule) => {
    setRuleEdit(rule);
    setEditForm({
      name: rule.name,
      responseDeadline: rule.responseDeadline,
      description: rule.description,
      isActive: rule.isActive,
    });
  };

  const saveEditRule = () => {
    if (!ruleEdit) return;
    setRuleList((prev) =>
      prev.map((r) =>
        r.id === ruleEdit.id
          ? {
              ...r,
              name: editForm.name,
              responseDeadline: editForm.responseDeadline,
              description: editForm.description,
              isActive: editForm.isActive,
            }
          : r,
      ),
    );
    setRuleEdit(null);
    setSaveDialog({ open: true, message: `规则已更新：${editForm.name}` });
  };

  const performDisable = () => {
    if (!confirmDisable) return;
    setRuleList((prev) =>
      prev.map((r) =>
        r.id === confirmDisable.id ? { ...r, isActive: false } : r,
      ),
    );
    setToast({
      show: true,
      type: "success",
      message: `已停用：${confirmDisable.name}`,
    });
    setConfirmDisable(null);
  };

  // 过滤
  const filteredRules = useMemo(() => {
    return ruleList.filter((r) => {
      if (filterCategory !== "all" && r.category !== filterCategory)
        return false;
      if (filterSeverity !== "all" && r.severity !== filterSeverity)
        return false;
      if (search) {
        const t = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(t) &&
          !r.code.toLowerCase().includes(t) &&
          !r.findings.toLowerCase().includes(t)
        )
          return false;
      }
      return true;
    });
  }, [ruleList, search, filterCategory, filterSeverity]);

  const selectedRule = ruleList.find((r) => r.id === selectedRuleId);
  const kpi = CRITICAL_VALUE_KPI;

  const ruleColumns: ColumnsType<CriticalValueRule> = [
    {
      title: t("w3tables.col.category"), dataIndex: "category", key: "category", width: 120,
      render: (_: unknown, r) => {
        const cConf = CATEGORY_CONFIG[r.category];
        const sConf = SEVERITY_CONFIG[r.severity];
        return (
          <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-1, 4px)', flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, padding: "1px 4px", borderRadius: 2, background: cConf.bg, color: cConf.color, fontWeight: 600 }}>{cConf.label}</span>
            <span style={{ fontSize: 12, padding: "1px 4px", borderRadius: 2, background: sConf.bg, color: sConf.color, fontWeight: 700 }}>{sConf.label}</span>
          </div>
        );
      },
    },
    { title: t("w3tables.col.name"), dataIndex: "name", key: "name", render: (v: string) => <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{v}</span> },
    { title: t("w3tables.col.code"), dataIndex: "code", key: "code", width: 100, render: (v: string) => <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>{v}</span> },
    {
      title: t("w3tables.col.time"), dataIndex: "responseDeadline", key: "responseDeadline", width: 130,
      render: (_: unknown, r) => {
        const sConf = SEVERITY_CONFIG[r.severity];
        return (
          <div style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 12, color: "var(--text-secondary)" }}>
            <Clock size={9} color={sConf.color} />
            <span>{r.responseDeadline}m</span>
            <span>·</span>
            {r.notificationChannels.slice(0, 2).map((c) => {
              const Icon = CHANNEL_ICONS[c];
              return Icon ? <Icon key={c} size={9} /> : null;
            })}
            {r.notificationChannels.length > 2 && <span>+{r.notificationChannels.length - 2}</span>}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 'var(--space-5, 20px)', maxWidth: 1600, margin: "0 auto" }}>
      {loading && <LoadingBanner message={t('w9.states.loading')} />}
      {/* 顶部 */}
      <div
        style={{
          marginBottom: 'var(--space-4, 16px)',
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div>
          <Title
            level={4}
            style={{
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-2, 8px)',
            }}
          >
            <Settings size={20} color="#7c2d12" /> {t("cvRule.title")}
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
              R5
            </span>
            <span
              style={{
                fontSize: 12,
                padding: "2px 8px",
                borderRadius: 10,
                fontWeight: 600,
                background: source === 'api' ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
                color: source === 'api' ? 'var(--color-success-600)' : 'var(--color-warning-600)',
              }}
            >
              {source === 'api' ? t("cvRule.sourceApi") : t("cvRule.sourceDemo")}
            </span>
          </Title>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", margin: "4px 0 0" }}>
            {t("cvRule.subtitle", { count: ruleList.length })}
            {loading && t("cvRule.loadingSuffix")}
            {loadError && <span style={{ color: "var(--color-error-600)", marginLeft: 'var(--space-2, 8px)' }}>{loadError}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 'var(--space-2, 8px)' }}>
          <ActionButton
            action="refresh"
            size="compact"
            icon={<BarChart3 size={12} />}
            onClick={() => navigate("/critical-value-stats")}
          >
            {t("cvRule.statsScreen")}
          </ActionButton>
          <ActionButton
            action="cancel"
            size="compact"
            onClick={() => navigate("/critical-value")}
          >
            {t("cvRule.backToCritical")}
          </ActionButton>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 'var(--space-2, 8px)',
          marginBottom: 'var(--space-4, 16px)',
        }}
      >
        <KpiCard
          icon={AlertOctagon}
          label={t("cvRule.kpiMonthly")}
          value={kpi.totalThisMonth}
          color="var(--color-error-600)"
        />
        <KpiCard
          icon={Clock}
          label={t("cvRule.kpiPending")}
          value={kpi.pendingCount}
          color="var(--color-warning-500)"
          alert
        />
        <KpiCard
          icon={CheckCircle2}
          label={t("cvRule.kpiResolved")}
          value={kpi.resolvedCount}
          color="#10b981"
        />
        <KpiCard
          icon={Zap}
          label={t("cvRule.kpiOnTime")}
          value={`${kpi.onTimeNotificationRate}%`}
          color="#7c3aed"
          good
        />
        <KpiCard
          icon={Activity}
          label={t("cvRule.kpiAvgResponse")}
          value={`${kpi.avgResponseTimeMinutes}m`}
          color="var(--color-info-600)"
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "440px 1fr", gap: 'var(--space-3, 12px)' }}
      >
        {/* 左：规则列表 */}
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
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
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
                  placeholder={t("cvRule.searchPlaceholder")}
                  style={{
                    width: "100%",
                    padding: "5px 8px 5px 26px",
                    border: "1px solid var(--border-color)",
                    borderRadius: 4,
                    fontSize: 12, }}
                />
              </div>
              <Select
                value={filterSeverity}
                onChange={(value) => setFilterSeverity(value)}
                style={{ width: 120 }}
                options={[
                  { value: "all", label: t("cvRule.filterAll") },
                  { value: "critical", label: t("cvRule.sev.critical") },
                  { value: "high", label: t("cvRule.sev.high") },
                ]}
              />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
              <strong style={{ color: "#7c2d12" }}>
                {filteredRules.length}
              </strong>{" "}
              / {ruleList.length} {t("cvRule.itemUnit")}
            </div>
          </div>
          <DataTable<CriticalValueRule>
            columns={ruleColumns}
            dataSource={filteredRules}
            rowKey="id"
            loading={loading}
            showPagination={false}
            emptyText={t("w9.states.noResults")}
            onRow={(r) => ({
              onClick: () => setSelectedRuleId(r.id),
              style: {
                cursor: "pointer",
                background: r.id === selectedRuleId ? "#fef2f2" : undefined,
                borderLeft: r.id === selectedRuleId ? `3px solid ${SEVERITY_CONFIG[r.severity].color}` : "3px solid transparent",
              },
            })}
            scroll={{ x: "max-content" }}
          />
        </div>

        {/* 右：规则详情 */}
        {selectedRule && (
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: 8,
              padding: 'var(--space-4, 16px)',
              border: "1px solid var(--border-color)",
            }}
          >
            {/* 头部 */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 'var(--space-3, 12px)',
                marginBottom: 'var(--space-4, 16px)',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 12,
                  background: `${CATEGORY_CONFIG[selectedRule.category].color}15`,
                  color: CATEGORY_CONFIG[selectedRule.category].color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertOctagon size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div
                  style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)" }}
                >
                  {selectedRule.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                  {t("cvRule.codeLabel")}{selectedRule.code}
                </div>
              </div>
              <span
                style={{
                  fontSize: 12,
                  padding: "3px 10px",
                  borderRadius: 4,
                  background: SEVERITY_CONFIG[selectedRule.severity].bg,
                  color: SEVERITY_CONFIG[selectedRule.severity].color,
                  fontWeight: 700,
                }}
              >
                {SEVERITY_CONFIG[selectedRule.severity].label}{t("cvRule.severityLevel")}
              </span>
            </div>

            {/* 元信息 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginBottom: 'var(--space-3, 12px)',
              }}
            >
              <InfoCell
                label={t("cvRule.category")}
                value={CATEGORY_CONFIG[selectedRule.category].label}
              />
              <InfoCell
                label={t("cvRule.responseDeadline")}
                value={`${selectedRule.responseDeadline} ${t("cvRule.minutes")}`}
                color="var(--color-error-600)"
              />
              <InfoCell
                label={t("cvRule.status")}
                value={selectedRule.isActive ? t("cvRule.enabled") : t("cvRule.disabled")}
                color={selectedRule.isActive ? "#10b981" : "#94a3b8"}
              />
            </div>

            {/* 适用设备 */}
            <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  marginBottom: 'var(--space-1, 4px)',
                }}
              >
                {t("cvRule.applicableModalities")}
              </div>
              <div style={{ display: "flex", gap: 'var(--space-1, 4px)', flexWrap: "wrap" }}>
                {selectedRule.modality.map((m) => (
                  <span
                    key={m}
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "var(--color-info-bg)",
                      color: "var(--color-primary-800)",
                      fontWeight: 600,
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 关键字 */}
            <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  marginBottom: 'var(--space-1, 4px)',
                }}
              >
                {t("cvRule.triggerKeywords")}
              </div>
              <div style={{ display: "flex", gap: 'var(--space-1, 4px)', flexWrap: "wrap" }}>
                {selectedRule.keywords.map((k) => (
                  <span
                    key={k}
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "var(--color-error-bg)",
                      color: "#b91c1c",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    {k}
                  </span>
                ))}
              </div>
            </div>

            {/* 触发所见 */}
            <div
              style={{
                marginBottom: 'var(--space-3, 12px)',
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
                  marginBottom: 'var(--space-1, 4px)',
                }}
              >
                {t("cvRule.triggerFindings")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-primary)" }}>
                {selectedRule.findings}
              </div>
            </div>

            {/* 通报渠道 */}
            <div style={{ marginBottom: 'var(--space-3, 12px)' }}>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  marginBottom: 'var(--space-1, 4px)',
                }}
              >
                {t("cvRule.notifyChannels")}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                {selectedRule.notificationChannels.map((c) => {
                  const Icon = CHANNEL_ICONS[c];
                  return (
                    <div
                      key={c}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        background: "var(--color-success-bg)",
                        border: "1px solid #bbf7d0",
                        display: "flex",
                        alignItems: "center",
                        gap: 'var(--space-1, 4px)',
                        fontSize: 12,
                        color: "#047857",
                        fontWeight: 600,
                      }}
                    >
                      <Icon size={11} /> {CHANNEL_LABELS[c]}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 描述 */}
            <div
              style={{
                marginBottom: 'var(--space-3, 12px)',
                padding: 10,
                background: "var(--color-warning-bg)",
                border: "1px solid #fcd34d",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#92400e",
                  fontWeight: 700,
                  marginBottom: 'var(--space-1, 4px)',
                }}
              >
                {t("cvRule.clinicalSignificance")}
              </div>
              <div style={{ fontSize: 12, color: "#78350f" }}>
                {selectedRule.description}
              </div>
            </div>

            {/* 参考 */}
            <div
              style={{
                marginBottom: 'var(--space-3, 12px)',
                padding: 'var(--space-2, 8px)',
                background: "var(--color-info-bg)",
                borderRadius: 4,
                fontSize: 12,
                color: "var(--color-primary-800)",
              }}
            >
              {selectedRule.reference}
            </div>

            {/* 操作 */}
            <div
              style={{
                display: "flex",
                gap: 'var(--space-2, 8px)',
                paddingTop: 'var(--space-3, 12px)',
                borderTop: "1px solid var(--border-color)",
              }}
            >
              <ActionButton
                action="edit"
                size="compact"
                onClick={() => openEditRule(selectedRule)}
              >
                {t("cvRule.edit")}
              </ActionButton>
              <ActionButton
                action="refresh"
                size="compact"
                icon={<Activity size={12} />}
                onClick={() => setRuleTriggers(selectedRule)}
              >
                {t("cvRule.triggerRecords")}
              </ActionButton>
              <ActionButton
                action="save"
                size="compact"
                style={{ marginLeft: "auto" }}
                onClick={() =>
                  setSaveDialog({
                    open: true,
                    message: `规则已保存: ${selectedRule.name}`,
                  })
                }
              >
                {t("cvRule.save")}
              </ActionButton>
              <ActionButton
                action="delete"
                size="compact"
                onClick={() => setConfirmDisable(selectedRule)}
              >
                {t("cvRule.disable")}
              </ActionButton>
            </div>
          </div>
        )}
      </div>

      {/* 编辑规则 Modal */}
      <AppModal
        open={!!ruleEdit}
        onClose={() => setRuleEdit(null)}
        title={t("cvRule.editRule")}
        subtitle={
          ruleEdit
            ? `${ruleEdit.code} · ${CATEGORY_CONFIG[ruleEdit.category]?.label || ""}`
            : ""
        }
        icon={<Edit2 size={18} />}
        iconBg="var(--color-info-bg)"
        iconColor="var(--color-primary-800)"
        size="md"
        footer={
          <>
            <ActionButton
              action="cancel"
              onClick={() => setRuleEdit(null)}
            >
              {t("cvRule.cancel")}
            </ActionButton>
            <ActionButton
              action="save"
              onClick={saveEditRule}
            >
              {t("cvRule.saveChanges")}
            </ActionButton>
          </>
        }
      >
        {ruleEdit && (
          <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-3, 12px)' }}>
            <div>
              <label
                htmlFor="rule-name"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 'var(--space-1, 4px)',
                  display: "block",
                }}
              >
                {t("cvRule.ruleName")}
              </label>
              <input
                id="rule-name"
                value={editForm.name}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, name: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  fontSize: 12, boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              <div>
                <label
                  htmlFor="rule-deadline"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 'var(--space-1, 4px)',
                    display: "block",
                  }}
                >
                  {t("cvRule.responseDeadlineMin")}
                </label>
                <input
                  id="rule-deadline"
                  type="number"
                  min={1}
                  value={editForm.responseDeadline}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      responseDeadline: Math.max(
                        1,
                        Number(e.target.value) || 1,
                      ),
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid var(--border-color)",
                    fontSize: 12, boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="rule-status"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                    marginBottom: 'var(--space-1, 4px)',
                    display: "block",
                  }}
                >
                  {t("cvRule.status")}
                </label>
                <Select
                  id="rule-status"
                  value={editForm.isActive ? "active" : "inactive"}
                  onChange={(value) =>
                    setEditForm((f) => ({
                      ...f,
                      isActive: value === "active",
                    }))
                  }
                  style={{ width: "100%" }}
                  options={[
                    { value: "active", label: t("cvRule.enabled") },
                    { value: "inactive", label: t("cvRule.disabled") },
                  ]}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="rule-description"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text-primary)",
                  marginBottom: 'var(--space-1, 4px)',
                  display: "block",
                }}
              >
                {t("cvRule.clinicalSignificance")}
              </label>
              <textarea
                id="rule-description"
                rows={3}
                value={editForm.description}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, description: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "8px 12px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  fontSize: 12, resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 6,
                padding: 10,
                border: "1px solid var(--border-color)",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              <div>
                {t("cvRule.triggerKeywordsLabel")}
                <code
                  style={{
                    background: "var(--bg-card)",
                    padding: "1px 6px",
                    borderRadius: 3,
                  }}
                >
                  {ruleEdit.keywords.join(", ")}
                </code>
              </div>
              <div style={{ marginTop: 'var(--space-1, 4px)' }}>
                {t("cvRule.notifyChannelsLabel")}
                {ruleEdit.notificationChannels
                  .map((c) => CHANNEL_LABELS[c])
                  .join("、")}
              </div>
            </div>
          </div>
        )}
      </AppModal>

      {/* 触发记录 Modal */}
      <AppModal
        open={!!ruleTriggers}
        onClose={() => setRuleTriggers(null)}
        title={t("cvRule.triggerRecords")}
        subtitle={ruleTriggers?.name}
        icon={<Activity size={18} />}
        iconBg="var(--color-success-bg)"
        iconColor="#15803d"
        width={680}
      >
        {ruleTriggers && (
          <div>
            <div
              style={{
                background: "var(--bg-card)",
                borderRadius: 8,
                padding: 'var(--space-3, 12px)',
                border: "1px solid var(--border-color)",
                marginBottom: 'var(--space-3, 12px)',
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>
                {ruleTriggers.name}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {t("cvRule.codeInline")}{ruleTriggers.code}{t("cvRule.responseDeadlineInline")}{" "}
                {ruleTriggers.responseDeadline}m
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  border: "1px solid var(--border-color)",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "var(--text-primary)",
                  background: "var(--bg-card)",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>{t("cvRule.triggerHash")}{i + 1}</span>
                  <span style={{ fontFamily: "monospace", color: "var(--text-secondary)" }}>
                    2026-05-{(i + 1).toString().padStart(2, "0")} 0{i + 1}:
                    {(i * 7) % 60}
                  </span>
                </div>
                <div style={{ color: "var(--text-secondary)", marginTop: 'var(--space-1, 4px)' }}>
                  {t("cvRule.patientTest")}{String.fromCharCode(0x41 + i)}{t("cvRule.deviceInline")}
                  {ruleTriggers.modality[i % ruleTriggers.modality.length]} ·
                  {t("cvRule.notifyChannelsLabel")}
                  {ruleTriggers.notificationChannels
                    .map((c) => CHANNEL_LABELS[c])
                    .join("、")}
                </div>
              </div>
            ))}
          </div>
        )}
      </AppModal>

      {/* 保存成功确认 Modal */}
      <AppModal
        open={saveDialog.open}
        onClose={() => setSaveDialog((s) => ({ ...s, open: false }))}
        title={t("cvRule.saveSuccess")}
        icon={<CheckCircle size={18} />}
        iconBg="var(--color-success-bg)"
        iconColor="#15803d"
        width={420}
        footer={
          <ActionButton
            action="submit"
            icon={<CheckCircle size={14} />}
            onClick={() => setSaveDialog((s) => ({ ...s, open: false }))}
          >
            {t("cvRule.gotIt")}
          </ActionButton>
        }
      >
        <div style={{ fontSize: 12, color: "var(--text-primary)", padding: "4px 0" }}>
          {saveDialog.message}
        </div>
        <div style={{ marginTop: 'var(--space-2, 8px)', fontSize: 12, color: "var(--text-secondary)" }}>
          {t("cvRule.savedNote")}
        </div>
      </AppModal>

      {/* 停用确认 Modal */}
      <ConfirmDialog
        open={!!confirmDisable}
        title={t("cvRule.disableRule")}
        message={`确定停用规则 "${confirmDisable?.name}" 吗?停用后该规则将不再触发危急值通报。`}
        confirmText={t("cvRule.disable")}
        variant="danger"
        onCancel={() => setConfirmDisable(null)}
        onConfirm={performDisable}
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
            background: toast.type === "success" ? "#059669" : "var(--color-error-600)",
            color: "#fff",
            padding: "10px 20px",
            borderRadius: 8,
            fontSize: 12,
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

// ============================================================
// 样式
// ============================================================

// ============================================================
// KPI 卡片
// ============================================================
const KpiCard: React.FC<{
  icon: any;
  label: string;
  value: number | string;
  color: string;
  alert?: boolean;
  good?: boolean;
}> = ({ icon: Icon, label, value, color, alert, good }) => {
  const c = ({
    'var(--color-error-600)': 'error', 'var(--color-error-500)': 'error', '#ff4d4f': 'error', '#cf1322': 'error',
    'var(--color-warning-500)': 'warning', '#faad14': 'warning', '#fa8c16': 'warning', '#ed8936': 'warning',
    'var(--color-success-600)': 'success', 'var(--color-success-500)': 'success', '#52c41a': 'success', '#10b981': 'success',
    'var(--color-primary-600)': 'primary', '#1890ff': 'primary', 'var(--color-primary-700)': 'primary',
  } as Record<string, string>)[color] ?? color;
  const rendered = good ? <span style={{ color: "#10b981" }}>{value}</span> : alert ? <span style={{ color: "var(--color-error-600)" }}>{value}</span> : value;
  return <StatCard title={label} value={rendered} icon={<Icon size={18} />} color={c} />;
};

// ============================================================
// 信息单元
// ============================================================
const InfoCell: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div>
    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{label}</div>
    <div
      style={{
        fontSize: 12,
        color: color || "var(--text-primary)",
        fontWeight: 600,
        marginTop: 1,
      }}
    >
      {value}
    </div>
  </div>
);
