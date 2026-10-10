import { useState, useMemo } from "react";
import { Zap, ArrowUpDown, Brain, Info, Settings, Sliders, ChevronDown, ChevronUp, Check } from 'lucide-react';
import { worklistSmartApi, type SmartWeightConfig } from '../../services/api/worklistSmartApi';

const WEIGHT_KEYS = ['urgencyWeight', 'waitWeight', 'ageWeight', 'examTypeWeight'] as const;
type SmartWeightKey = (typeof WEIGHT_KEYS)[number];

interface SmartSortPanelProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  explanations: Array<{ id: string; text: string; score: number }>;
  onCompare: () => void;
  role?: string;
}

export function SmartSortPanel({
  enabled,
  onToggle,
  explanations,
  onCompare,
  role,
}: SmartSortPanelProps) {
  const [showExplanations, setShowExplanations] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [weights, setWeights] = useState<SmartWeightConfig>({
    urgencyWeight: 0.35,
    waitWeight: 0.3,
    ageWeight: 0.15,
    examTypeWeight: 0.2,
  });
  const [saving, setSaving] = useState(false);

  const isAdmin = role === "ADMIN";

  const handleWeightChange = (key: SmartWeightKey, value: number) => {
    const clamped = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
    const newWeights = { ...weights, [key]: clamped };
    setWeights(newWeights);
  };

  const handleSaveWeights = async () => {
    setSaving(true);
    try {
      const res = await worklistSmartApi.setWeights(weights);
      if (res.success) setWeights(res.data as SmartWeightConfig);
    } catch (err) {
      console.warn("[SmartSortPanel] setWeights failed", err);
    }
    setSaving(false);
  };

  const totalWeight = useMemo(
    () =>
      weights.urgencyWeight +
      weights.waitWeight +
      weights.ageWeight +
      weights.examTypeWeight,
    [weights],
  );

  const weightLabels: Record<SmartWeightKey, string> = {
    urgencyWeight: "紧急度",
    waitWeight: "等待时间",
    ageWeight: "患者年龄",
    examTypeWeight: "检查类型",
  };

  return (
    <div
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid #e2e8f0",
        marginBottom: 'var(--space-4, 16px)',
        overflow: "hidden",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
      }}
    >
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-3, 12px)',
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 'var(--space-2, 8px)' }}>
          <Brain size={18} color={enabled ? "#7c3aed" : "#94a3b8"} />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-primary-800)" }}>
            智能排序
          </span>
        </div>

        <button
          onClick={() => onToggle(!enabled)}
          style={{
            padding: "5px 14px",
            borderRadius: 20,
            border: "none",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: enabled ? "#7c3aed" : "#f1f5f9",
            color: enabled ? "#fff" : "#64748b",
            transition: "all 0.2s",
          }}
        >
          <Zap size={12} />
          {enabled ? "已开启" : "已关闭"}
        </button>

        {enabled && explanations.length > 0 && (
          <button
            onClick={() => setShowExplanations(!showExplanations)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#64748b",
              cursor: "pointer",
              background: "var(--bg-card)",
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-1, 4px)',
            }}
          >
            <Info size={12} />
            排序解释
            {showExplanations ? (
              <ChevronUp size={12} />
            ) : (
              <ChevronDown size={12} />
            )}
          </button>
        )}

        <button
          onClick={onCompare}
          style={{
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            color: "#64748b",
            cursor: "pointer",
            background: "var(--bg-card)",
            display: "flex",
            alignItems: "center",
            gap: 'var(--space-1, 4px)',
          }}
        >
          <ArrowUpDown size={12} />
          对比效果
        </button>

        {isAdmin && (
          <button
            onClick={() => setShowWeights(!showWeights)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              color: "#64748b",
              cursor: "pointer",
              background: "var(--bg-card)",
              display: "flex",
              alignItems: "center",
              gap: 'var(--space-1, 4px)',
            }}
          >
            <Sliders size={12} />
            加权因子
            {showWeights ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        )}
      </div>

      {enabled && showExplanations && explanations.length > 0 && (
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            padding: "12px 16px",
            background: "#faf5ff",
            maxHeight: 200,
            overflowY: "auto",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#7c3aed",
              marginBottom: 'var(--space-2, 8px)',
            }}
          >
            排序理由
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 'var(--space-1, 4px)' }}>
            {explanations.slice(0, 10).map((exp) => (
              <div
                key={exp.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: 12,
                  color: "#475569",
                  padding: "3px 0",
                }}
              >
                <span>{exp.text}</span>
                <span
                  style={{
                    fontWeight: 700,
                    color:
                      exp.score >= 70
                        ? "var(--color-error-600)"
                        : exp.score >= 45
                          ? "var(--color-warning-600)"
                          : "#059669",
                  }}
                >
                  {exp.score}分
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && showWeights && (
        <div
          style={{
            borderTop: "1px solid #f1f5f9",
            padding: "16px",
            background: "var(--bg-primary)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--color-primary-800)",
              marginBottom: 'var(--space-3, 12px)',
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Settings size={14} />
            加权因子配置
            {totalWeight !== 1 && (
              <span style={{ color: "var(--color-error-600)", fontWeight: 600, fontSize: 11 }}>
                (权重之和={totalWeight.toFixed(2)}，应为1.00)
              </span>
            )}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            {WEIGHT_KEYS.map(
              (key) => (
                <div
                  key={key}
                  style={{ display: "flex", alignItems: "center", gap: 'var(--space-3, 12px)' }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      minWidth: 80,
                      flexShrink: 0,
                    }}
                  >
                    {weightLabels[key]}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[key]}
                    onChange={(e) =>
                      handleWeightChange(key, parseFloat(e.target.value))
                    }
                    style={{ flex: 1, height: 4, accentColor: "#7c3aed" }}
                  />
                  <input
                    type="number"
                    min={0}
                    max={1}
                    step={0.05}
                    value={weights[key]}
                    onChange={(e) =>
                      handleWeightChange(key, parseFloat(e.target.value || "0"))
                    }
                    style={{
                      width: 60,
                      padding: "4px 6px",
                      border: "1px solid #e2e8f0",
                      borderRadius: 4,
                      fontSize: 12,
                      textAlign: "center",
                    }}
                  />
                </div>
              ),
            )}
          </div>
          <button
            onClick={handleSaveWeights}
            disabled={saving || Math.abs(totalWeight - 1) > 0.01}
            style={{
              marginTop: 'var(--space-3, 12px)',
              padding: "6px 16px",
              borderRadius: 6,
              border: "none",
              background:
                Math.abs(totalWeight - 1) > 0.01 ? "#cbd5e1" : "#7c3aed",
              color: "#fff",
              fontSize: 12,
              fontWeight: 600,
              cursor:
                Math.abs(totalWeight - 1) > 0.01 ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Check size={12} />
            {saving ? "保存中..." : "保存权重"}
          </button>
        </div>
      )}
    </div>
  );
}
