/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - KpiCard
 * 仪表盘 KPI 卡: 数值 + 单位 + 环比趋势 + 迷你趋势图 + 图标
 * 与 StatCard 同一视觉语言 (bg-card + radius 12 + 圆底图标 + tabular-nums)
 */
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";

export type KpiCardColor = "primary" | "success" | "warning" | "error" | "info";

export interface KpiCardTrend {
  /** 环比值 (如 8 表示 +8%) */
  value: number | string;
  direction?: "up" | "down";
  /** 是否为利好 (默认 up 利好绿 / down 利空红) */
  goodWhenDown?: boolean;
}

export interface KpiCardProps {
  title: ReactNode;
  value: ReactNode;
  /** 数值单位/后缀 (如 % / 例 / 分钟) */
  suffix?: ReactNode;
  icon?: ReactNode;
  color?: KpiCardColor | string;
  /** 副标题 */
  sub?: ReactNode;
  trend?: KpiCardTrend;
  /** 迷你趋势图数据点 */
  sparkline?: number[];
  /** 加载态 (骨架占位) */
  loading?: boolean;
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
  className?: string;
  testId?: string;
}

const SIZE_MAP = {
  sm: { padding: "12px 16px", valueFont: 20, iconBox: 36, sparkH: 34 },
  md: { padding: "14px 18px", valueFont: 26, iconBox: 40, sparkH: 40 },
  lg: { padding: "20px", valueFont: 30, iconBox: 52, sparkH: 48 },
} as const;

const COLOR_PRESET: Record<KpiCardColor, { fg: string; bg: string }> = {
  primary: { fg: "var(--color-primary-700, #1d4ed8)", bg: "var(--color-primary-50, #eff6ff)" },
  success: { fg: "var(--color-success-600, #16a34a)", bg: "var(--color-success-50, #f0fdf4)" },
  warning: { fg: "var(--color-warning-600, #d97706)", bg: "var(--color-warning-50, #fffbeb)" },
  error: { fg: "var(--color-error-600, #dc2626)", bg: "var(--color-error-50, #fef2f2)" },
  info: { fg: "var(--color-info-600, #0891b2)", bg: "var(--color-info-50, #ecfeff)" },
};

function Sparkline({
  data,
  color,
  width = 120,
  height,
  testId,
}: {
  data: number[];
  color: string;
  width?: number;
  height: number;
  testId?: string;
}) {
  if (!data || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - 4 - ((v - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const lastY = pts.split(" ").at(-1)?.split(",")[1] ?? String(height / 2);
  const lastX = pts.split(" ").at(-1)?.split(",")[0] ?? String(width);
  return (
    <svg
      data-testid={testId}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ display: "block", overflow: "visible" }}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.85}
        points={pts}
      />
      <circle cx={lastX} cy={lastY} r={2.4} fill={color} />
    </svg>
  );
}

export function KpiCard({
  title,
  value,
  suffix,
  icon,
  color = "primary",
  sub,
  trend,
  sparkline,
  loading = false,
  onClick,
  size = "md",
  style,
  className,
  testId,
}: KpiCardProps) {
  const sizeCfg = SIZE_MAP[size];
  const preset = (COLOR_PRESET as Record<string, { fg: string; bg: string } | undefined>)[color];
  const fgColor = preset ? preset.fg : color;
  const iconBg = preset ? preset.bg : `${color}1A`;

  const isUp = trend ? (trend.goodWhenDown ? trend.direction !== "up" : trend.direction !== "down") : true;
  const trendColor =
    trend && (trend.goodWhenDown ? trend.direction === "up" : trend.direction === "down")
      ? "var(--color-error-600, #dc2626)"
      : "var(--color-success-600, #059669)";

  const showSpark = !!sparkline && sparkline.length >= 2;

  return (
    <div
      data-testid={testId}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as unknown as MouseEvent<HTMLDivElement>);
              }
            }
          : undefined
      }
      className={className}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--color-gray-200, #e2e8f0)",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
        padding: sizeCfg.padding,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "stretch",
        gap: 12,
        cursor: onClick ? "pointer" : "default",
        transition: "box-shadow 0.2s, transform 0.2s",
        ...style,
      }}
    >
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <div
          style={{
            fontSize: 12,
            color: "var(--text-secondary, #475569)",
            marginBottom: 4,
            fontWeight: 500,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {title}
        </div>
        {loading ? (
          <div
            data-testid={`${testId ?? "kpi"}-loading`}
            style={{
              height: sizeCfg.valueFont,
              borderRadius: 6,
              background: "var(--skeleton-bg, #e2e8f0)",
              animation: "pulse 1.5s ease-in-out infinite",
              maxWidth: 130,
              marginBottom: 6,
            }}
          />
        ) : (
          <div
            style={{
              fontSize: sizeCfg.valueFont,
              fontWeight: 700,
              color: fgColor,
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {value}
            {suffix !== undefined && (
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  marginLeft: 2,
                  color: "var(--text-secondary)",
                }}
              >
                {suffix}
              </span>
            )}
          </div>
        )}
        {sub && (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-gray-400, #94a3b8)",
              marginTop: 4,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sub}
          </div>
        )}
        {trend && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginTop: 4,
              fontSize: 12,
              fontWeight: 600,
              color: trendColor,
            }}
          >
            {isUp ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            <span>
              {Math.abs(Number(trend.value))}
              {typeof trend.value === "number" ? "%" : ""}
            </span>
            <span style={{ fontWeight: 400, color: "var(--color-gray-400, #94a3b8)" }}>环比</span>
          </div>
        )}
        <div style={{ flex: 1 }} />
        {showSpark && (
          <div style={{ marginTop: 8 }}>
            <Sparkline data={sparkline!} color={fgColor} height={sizeCfg.sparkH} />
          </div>
        )}
      </div>
      {icon && (
        <div
          style={{
            width: sizeCfg.iconBox,
            height: sizeCfg.iconBox,
            borderRadius: "50%",
            background: iconBg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: fgColor,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      )}
    </div>
  );
}

/**
 * KPI 卡网格容器 (auto-fit 自适应)
 */
export function KpiCardGrid({
  children,
  minWidth = 220,
  gap = 16,
  style,
  className,
  testId,
}: {
  children: ReactNode;
  minWidth?: number;
  gap?: number;
  style?: CSSProperties;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default KpiCard;
