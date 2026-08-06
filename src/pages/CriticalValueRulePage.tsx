// ============================================================
// G005 放射科RIS系统 v1.0.5 - 危急值规则配置
// Phase R5：18 条危急值规则 · 7 类别 · 多渠道通报 · 响应时限
// ============================================================

import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertOctagon, Settings, Edit2, Trash2, Save, Search, Phone, MessageSquare, Bell, Smartphone, Clock, Activity, BarChart3, Zap, CheckCircle2, CheckCircle } from 'lucide-react';
import {
  CRITICAL_VALUE_RULES,
  CRITICAL_VALUE_KPI,
  type CriticalValueRule,
} from "../data/criticalValueAssessmentMock";
import { AppModal } from "../components/common/AppModal";
import { ConfirmDialog } from "../components/ConfirmDialog";

// ============================================================
// 类别配置
// ============================================================
const CATEGORY_CONFIG: Record<
  string,
  { label: string; color: string; bg: string }
> = {
  neuro: { label: "神经", color: "#7c3aed", bg: "#ede9fe" },
  cardio: { label: "心血管", color: "#dc2626", bg: "#fee2e2" },
  pulmo: { label: "胸部", color: "#0891b2", bg: "#cffafe" },
  abdomen: { label: "腹部", color: "#f59e0b", bg: "#fef3c7" },
  trauma: { label: "创伤", color: "#7f1d1d", bg: "#fecaca" },
  vascular: { label: "血管", color: "#3b82f6", bg: "#dbeafe" },
  contrast: { label: "造影剂", color: "#a855f7", bg: "#f3e8ff" },
};

const SEVERITY_CONFIG = {
  high: { label: "高级", color: "#f59e0b", bg: "#fef3c7" },
  critical: { label: "危急", color: "#dc2626", bg: "#fee2e2" },
};

const CHANNEL_ICONS: Record<string, any> = {
  phone: Phone,
  sms: MessageSquare,
  wechat: Smartphone,
  inApp: Bell,
};

const CHANNEL_LABELS: Record<string, string> = {
  phone: "电话",
  sms: "短信",
  wechat: "微信",
  inApp: "站内",
};

// ============================================================
// 主组件
// ============================================================
export default function CriticalValueRulePage() {
  const navigate = useNavigate();
  const [ruleList, setRuleList] =
    useState<CriticalValueRule[]>(CRITICAL_VALUE_RULES);
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

  return (
    <div style={{ padding: 20, maxWidth: 1600, margin: "0 auto" }}>
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
              fontSize: 22,
              color: "#1e293b",
              margin: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Settings size={20} color="#7c2d12" /> 危急值规则配置
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
          </h1>
          <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0 0" }}>
            {ruleList.length} 条危急值规则 · 7 类别 · 4 通报渠道 · 自动触发 +
            人工标识
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => navigate("/critical-value-stats")}
            style={{
              padding: "6px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              color: "#475569",
              fontSize: 12,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <BarChart3 size={12} /> 统计大屏
          </button>
          <button
            onClick={() => navigate("/critical-value")}
            style={{
              padding: "6px 12px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              background: "#fff",
              color: "#475569",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            返回危急值
          </button>
        </div>
      </div>

      {/* KPI 卡片 */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, 1fr)",
          gap: 8,
          marginBottom: 16,
        }}
      >
        <KpiCard
          icon={AlertOctagon}
          label="本月危急值"
          value={kpi.totalThisMonth}
          color="#dc2626"
        />
        <KpiCard
          icon={Clock}
          label="待通报"
          value={kpi.pendingCount}
          color="#f59e0b"
          alert
        />
        <KpiCard
          icon={CheckCircle2}
          label="已处理"
          value={kpi.resolvedCount}
          color="#10b981"
        />
        <KpiCard
          icon={Zap}
          label="10分钟通报率"
          value={`${kpi.onTimeNotificationRate}%`}
          color="#7c3aed"
          good
        />
        <KpiCard
          icon={Activity}
          label="平均响应"
          value={`${kpi.avgResponseTimeMinutes}m`}
          color="#0891b2"
        />
      </div>

      <div
        style={{ display: "grid", gridTemplateColumns: "440px 1fr", gap: 12 }}
      >
        {/* 左：规则列表 */}
        <div
          style={{
            background: "#fff",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            overflow: "hidden",
          }}
        >
          <div
            style={{ padding: "8px 12px", borderBottom: "1px solid #e2e8f0" }}
          >
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search
                  size={11}
                  style={{
                    position: "absolute",
                    left: 8,
                    top: 8,
                    color: "#94a3b8",
                  }}
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="搜索规则/所见..."
                  style={{
                    width: "100%",
                    padding: "5px 8px 5px 26px",
                    border: "1px solid #cbd5e1",
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
                <option value="all">全部</option>
                <option value="critical">危急</option>
                <option value="high">高级</option>
              </select>
            </div>
            <div style={{ fontSize: 12, color: "#64748b" }}>
              <strong style={{ color: "#7c2d12" }}>
                {filteredRules.length}
              </strong>{" "}
              / {ruleList.length} 条
            </div>
          </div>
          <div style={{ maxHeight: 600, overflowY: "auto" }}>
            {filteredRules.map((r) => {
              const cConf = CATEGORY_CONFIG[r.category];
              const sConf = SEVERITY_CONFIG[r.severity];
              const isSelected = r.id === selectedRuleId;
              return (
                <div
                  key={r.id}
                  onClick={() => setSelectedRuleId(r.id)}
                  style={{
                    padding: 10,
                    borderBottom: "1px solid #f1f5f9",
                    background: isSelected ? "#fef2f2" : "transparent",
                    borderLeft: isSelected
                      ? `3px solid ${sConf.color}`
                      : "3px solid transparent",
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background: cConf.bg,
                        color: cConf.color,
                        fontWeight: 600,
                      }}
                    >
                      {cConf.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        padding: "1px 4px",
                        borderRadius: 2,
                        background: sConf.bg,
                        color: sConf.color,
                        fontWeight: 700,
                      }}
                    >
                      {sConf.label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        color: "#94a3b8",
                        marginLeft: "auto",
                      }}
                    >
                      {r.code}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#1e293b",
                      marginBottom: 2,
                    }}
                  >
                    {r.name}
                  </div>
                  <div
                    style={{
                      fontSize: 12,
                      color: "#64748b",
                      display: "flex",
                      gap: 6,
                      alignItems: "center",
                    }}
                  >
                    <Clock size={9} color={sConf.color} />
                    <span>{r.responseDeadline}m</span>
                    <span>·</span>
                    {r.notificationChannels.slice(0, 2).map((c) => {
                      const Icon = CHANNEL_ICONS[c];
                      return <Icon key={c} size={9} />;
                    })}
                    {r.notificationChannels.length > 2 && (
                      <span>+{r.notificationChannels.length - 2}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 右：规则详情 */}
        {selectedRule && (
          <div
            style={{
              background: "#fff",
              borderRadius: 8,
              padding: 16,
              border: "1px solid #e2e8f0",
            }}
          >
            {/* 头部 */}
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
                  style={{ fontSize: 20, fontWeight: 700, color: "#1e293b" }}
                >
                  {selectedRule.name}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  编码：{selectedRule.code}
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
                {SEVERITY_CONFIG[selectedRule.severity].label}级
              </span>
            </div>

            {/* 元信息 */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 10,
                marginBottom: 12,
              }}
            >
              <InfoCell
                label="分类"
                value={CATEGORY_CONFIG[selectedRule.category].label}
              />
              <InfoCell
                label="响应时限"
                value={`${selectedRule.responseDeadline} 分钟`}
                color="#dc2626"
              />
              <InfoCell
                label="状态"
                value={selectedRule.isActive ? "✓ 已启用" : "✗ 已停用"}
                color={selectedRule.isActive ? "#10b981" : "#94a3b8"}
              />
            </div>

            {/* 适用设备 */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                适用设备
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {selectedRule.modality.map((m) => (
                  <span
                    key={m}
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "#dbeafe",
                      color: "#1e40af",
                      fontWeight: 600,
                    }}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>

            {/* 关键字 */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                触发关键字
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {selectedRule.keywords.map((k) => (
                  <span
                    key={k}
                    style={{
                      fontSize: 12,
                      padding: "2px 8px",
                      borderRadius: 10,
                      background: "#fee2e2",
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
                marginBottom: 12,
                padding: 10,
                background: "#f8fafc",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                触发所见模式
              </div>
              <div style={{ fontSize: 12, color: "#1e293b" }}>
                {selectedRule.findings}
              </div>
            </div>

            {/* 通报渠道 */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 12,
                  color: "#64748b",
                  fontWeight: 600,
                  marginBottom: 4,
                }}
              >
                通报渠道（同时触发）
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
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
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
                marginBottom: 12,
                padding: 10,
                background: "#fef3c7",
                border: "1px solid #fcd34d",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  color: "#92400e",
                  fontWeight: 700,
                  marginBottom: 4,
                }}
              >
                📋 临床意义
              </div>
              <div style={{ fontSize: 12, color: "#78350f" }}>
                {selectedRule.description}
              </div>
            </div>

            {/* 参考 */}
            <div
              style={{
                marginBottom: 12,
                padding: 8,
                background: "#eff6ff",
                borderRadius: 4,
                fontSize: 12,
                color: "#1e40af",
              }}
            >
              📖 {selectedRule.reference}
            </div>

            {/* 操作 */}
            <div
              style={{
                display: "flex",
                gap: 8,
                paddingTop: 12,
                borderTop: "1px solid #e2e8f0",
              }}
            >
              <button
                onClick={() => openEditRule(selectedRule)}
                style={{
                  padding: "5px 10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#fff",
                  color: "#475569",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Edit2 size={11} /> 编辑
              </button>
              <button
                onClick={() => setRuleTriggers(selectedRule)}
                style={{
                  padding: "5px 10px",
                  border: "1px solid #cbd5e1",
                  borderRadius: 4,
                  background: "#fff",
                  color: "#475569",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Activity size={11} /> 触发记录
              </button>
              <button
                onClick={() =>
                  setSaveDialog({
                    open: true,
                    message: `规则已保存: ${selectedRule.name}`,
                  })
                }
                style={{
                  padding: "5px 10px",
                  border: "none",
                  borderRadius: 4,
                  background: "#3b82f6",
                  color: "#fff",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginLeft: "auto",
                }}
              >
                <Save size={11} /> 保存
              </button>
              <button
                onClick={() => setConfirmDisable(selectedRule)}
                style={{
                  padding: "5px 10px",
                  border: "1px solid #dc2626",
                  borderRadius: 4,
                  background: "#fff",
                  color: "#dc2626",
                  fontSize: 12,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Trash2 size={11} /> 停用
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 编辑规则 Modal */}
      <AppModal
        open={!!ruleEdit}
        onClose={() => setRuleEdit(null)}
        title="编辑规则"
        subtitle={
          ruleEdit
            ? `${ruleEdit.code} · ${CATEGORY_CONFIG[ruleEdit.category]?.label || ""}`
            : ""
        }
        icon={<Edit2 size={18} />}
        iconBg="#dbeafe"
        iconColor="#1e40af"
        size="md"
        footer={
          <>
            <button
              onClick={() => setRuleEdit(null)}
              style={{
                padding: "8px 18px",
                border: "1px solid #e2e8f0",
                background: "#fff",
                color: "#64748b",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={saveEditRule}
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
              <Save size={12} /> 保存修改
            </button>
          </>
        }
      >
        {ruleEdit && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label
                htmlFor="rule-name"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 4,
                  display: "block",
                }}
              >
                规则名称
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
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
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
                    color: "#334155",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  响应时限 (分钟)
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
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <div>
                <label
                  htmlFor="rule-status"
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#334155",
                    marginBottom: 4,
                    display: "block",
                  }}
                >
                  状态
                </label>
                <select
                  id="rule-status"
                  value={editForm.isActive ? "active" : "inactive"}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      isActive: e.target.value === "active",
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 6,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                    boxSizing: "border-box",
                  }}
                >
                  <option value="active">已启用</option>
                  <option value="inactive">已停用</option>
                </select>
              </div>
            </div>
            <div>
              <label
                htmlFor="rule-description"
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#334155",
                  marginBottom: 4,
                  display: "block",
                }}
              >
                临床意义
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
                  border: "1px solid #cbd5e1",
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box",
                }}
              />
            </div>
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 6,
                padding: 10,
                border: "1px solid #e2e8f0",
                fontSize: 12,
                color: "#475569",
              }}
            >
              <div>
                触发关键字：
                <code
                  style={{
                    background: "#fff",
                    padding: "1px 6px",
                    borderRadius: 3,
                  }}
                >
                  {ruleEdit.keywords.join(", ")}
                </code>
              </div>
              <div style={{ marginTop: 4 }}>
                通报渠道：
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
        title="触发记录"
        subtitle={ruleTriggers?.name}
        icon={<Activity size={18} />}
        iconBg="#dcfce7"
        iconColor="#15803d"
        width={680}
      >
        {ruleTriggers && (
          <div>
            <div
              style={{
                background: "#f8fafc",
                borderRadius: 8,
                padding: 12,
                border: "1px solid #e2e8f0",
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>
                {ruleTriggers.name}
              </div>
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                编码 {ruleTriggers.code} · 响应时限{" "}
                {ruleTriggers.responseDeadline}m
              </div>
            </div>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                style={{
                  padding: 10,
                  border: "1px solid #e2e8f0",
                  borderRadius: 6,
                  fontSize: 12,
                  color: "#334155",
                  background: "#fff",
                  marginBottom: 6,
                }}
              >
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <span>触发 #{i + 1}</span>
                  <span style={{ fontFamily: "monospace", color: "#94a3b8" }}>
                    2026-05-{(i + 1).toString().padStart(2, "0")} 0{i + 1}:
                    {(i * 7) % 60}
                  </span>
                </div>
                <div style={{ color: "#64748b", marginTop: 4 }}>
                  患者：测试 {String.fromCharCode(0x41 + i)} · 设备：
                  {ruleTriggers.modality[i % ruleTriggers.modality.length]} ·
                  通报渠道：
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
        title="保存成功"
        icon={<CheckCircle size={18} />}
        iconBg="#dcfce7"
        iconColor="#15803d"
        width={420}
        footer={
          <button
            onClick={() => setSaveDialog((s) => ({ ...s, open: false }))}
            style={{
              padding: "8px 18px",
              border: "none",
              background: "#3b82f6",
              color: "#fff",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            知道了
          </button>
        }
      >
        <div style={{ fontSize: 13, color: "#334155", padding: "4px 0" }}>
          {saveDialog.message}
        </div>
        <div style={{ marginTop: 8, fontSize: 12, color: "#64748b" }}>
          规则配置已保存至系统,变更将立即生效。
        </div>
      </AppModal>

      {/* 停用确认 Modal */}
      <ConfirmDialog
        open={!!confirmDisable}
        title="停用规则"
        message={`确定停用规则 "${confirmDisable?.name}" 吗?停用后该规则将不再触发危急值通报。`}
        confirmText="停用"
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

// ============================================================
// 样式
// ============================================================
const selectStyle: React.CSSProperties = {
  padding: "4px 8px",
  border: "1px solid #cbd5e1",
  borderRadius: 4,
  fontSize: 12,
  outline: "none",
};

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
}> = ({ icon: Icon, label, value, color, alert, good }) => (
  <div
    style={{
      background: "#fff",
      padding: 12,
      borderRadius: 8,
      border: "1px solid #e2e8f0",
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}
  >
    <div
      style={{
        width: 36,
        height: 36,
        borderRadius: 8,
        background: `${color}15`,
        color: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Icon size={18} />
    </div>
    <div>
      <div style={{ fontSize: 12, color: "#64748b" }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 700,
          color: good ? "#10b981" : alert ? "#dc2626" : "#1e293b",
        }}
      >
        {value}
      </div>
    </div>
  </div>
);

// ============================================================
// 信息单元
// ============================================================
const InfoCell: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color,
}) => (
  <div>
    <div style={{ fontSize: 12, color: "#94a3b8" }}>{label}</div>
    <div
      style={{
        fontSize: 12,
        color: color || "#1e293b",
        fontWeight: 600,
        marginTop: 1,
      }}
    >
      {value}
    </div>
  </div>
);
