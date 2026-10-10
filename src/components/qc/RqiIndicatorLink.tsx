import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Link } from "react-router-dom";
import { Target, ExternalLink } from "lucide-react";
import { t } from "../../i18n/appI18n";
import { rqi2024Api, type RqiIndicator, type RqiIndicatorStatus } from "../../services/api/rqi2024Api";

// [v3.0.6.11-105 Wave 2C] 国标指标(2024) 子功能联动提示卡
//   在 5 个子功能页内嵌「对应国标指标」当前值 / 目标 / 达标徽标 + 查看链接。
//   数据源: rqi2024Api.getIndicators() (复用 W2B 封装); 失败静默降级 (不渲染), 不影响原页面功能。

export const RQI_STATUS_COLOR: Record<RqiIndicatorStatus, string> = {
  pass: "#16a34a",
  warn: "#d97706",
  fail: "#dc2626",
};

function statusColor(status: RqiIndicatorStatus | string): string {
  return RQI_STATUS_COLOR[status as RqiIndicatorStatus] ?? "#64748b";
}

function targetText(item: RqiIndicator): string {
  return `${item.direction === "higher" ? "≥" : "≤"}${item.target}${item.unit}`;
}

export interface RqiIndicatorLinkProps {
  /** 国标指标编码, 如 RQI-IIA-01 */
  code: string;
  /** 视觉基调: light (默认) / dark (深色主题页面, 如对比剂工作站) */
  tone?: "light" | "dark";
  /** 查看链接目标, 默认深链 /qc?tab=rqi2024 */
  to?: string;
  testId?: string;
  style?: CSSProperties;
}

export function RqiIndicatorLink({
  code,
  tone = "light",
  to = "/qc?tab=rqi2024",
  testId,
  style,
}: RqiIndicatorLinkProps) {
  const [indicator, setIndicator] = useState<RqiIndicator | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await rqi2024Api.getIndicators();
        if (cancelled) return;
        if (res.success && res.data?.indicators) {
          setIndicator(res.data.indicators.find((item) => item.code === code) ?? null);
        } else {
          setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  // 静默降级: 加载中 / 失败 / 未匹配 → 不渲染区块
  if (failed || !indicator) return null;

  const accent = statusColor(indicator.status);
  const dark = tone === "dark";
  const textPrimary = dark ? "#f0f6fc" : "var(--text-primary, #0f172a)";
  const textSecondary = dark ? "#8b949e" : "var(--text-secondary, #475569)";
  const border = dark ? "1px solid #30363d" : `1px solid ${accent}55`;
  const background = dark ? "rgba(22,27,34,0.6)" : `${accent}0f`;

  return (
    <div
      data-testid={testId ?? `rqi-link-${code}`}
      style={{
        marginBottom: 16,
        padding: "12px 16px",
        borderRadius: 10,
        border,
        background,
        display: "flex",
        alignItems: "center",
        gap: 14,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 10,
          background: `${accent}22`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: accent,
          flexShrink: 0,
        }}
      >
        <Target size={18} />
      </div>
      <div style={{ flex: 1, minWidth: 200 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: textSecondary, letterSpacing: 0.3 }}>
          {t("rqi.link.title")} · {indicator.code}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: textPrimary, marginTop: 2 }}>
          {indicator.name}
        </div>
        <div style={{ fontSize: 12, color: textSecondary, marginTop: 2 }}>
          {t("rqi.link.target")} {targetText(indicator)} · {t("rqi.link.period")} {indicator.period}
        </div>
      </div>
      <div style={{ textAlign: "right", minWidth: 96 }}>
        <div
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: accent,
            lineHeight: 1.1,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {indicator.rate}
          <span style={{ fontSize: 12, fontWeight: 600, marginLeft: 1 }}>{indicator.unit}</span>
        </div>
        <span
          style={{
            display: "inline-block",
            marginTop: 4,
            padding: "1px 8px",
            borderRadius: 10,
            fontSize: 11,
            fontWeight: 700,
            color: accent,
            background: `${accent}22`,
          }}
        >
          {t(`rqi.status.${indicator.status}`)}
        </span>
      </div>
      <Link
        to={to}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          fontSize: 12,
          fontWeight: 600,
          color: accent,
          textDecoration: "none",
          whiteSpace: "nowrap",
        }}
      >
        {t("rqi.link.view")} <ExternalLink size={12} />
      </Link>
    </div>
  );
}

export default RqiIndicatorLink;
