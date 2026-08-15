/**
 * G005 放射RIS系统 v3.0.6.11-100 Wave 5A - StatCard
 * UI 组件化: 统一 KPI 卡片视觉
 *
 * 统一规范:
 *   - bg-card + radius 12 + shadow-sm
 *   - 图标圆底 + 大数值 (26/700) + tabular-nums
 *   - color 支持语义预设: primary/success/warning/error/info (或自定义色值)
 *
 * 兼容旧 props: sub / trend.isUp / variant / size / iconBg / onClick
 */
import type { ReactNode, CSSProperties, MouseEvent } from "react";

export type StatCardVariant = "default" | "compact" | "elevated" | "ghost";
export type StatCardColor = "primary" | "success" | "warning" | "error" | "info";

export interface StatCardTrend {
  value: number | string;
  direction?: "up" | "down";
  /** 兼容旧字段 */
  isUp?: boolean;
}

export interface StatCardProps {
  title: ReactNode;
  value: ReactNode;
  /** 数值后缀 (如 % / 例 / 次) */
  suffix?: ReactNode;
  /** 加载中 (骨架占位) */
  loading?: boolean;
  icon?: ReactNode;
  /** 语义色预设 (primary/success/warning/error/info) 或自定义色值 */
  color?: StatCardColor | string;
  /** icon 背景色 (默认 `${color}18`) */
  iconBg?: string;
  /** 副标题 (小字) */
  sub?: ReactNode;
  /** 趋势 { value, direction: up|down } */
  trend?: StatCardTrend;
  /** 边框 (默认有) */
  bordered?: boolean;
  /** 变体 */
  variant?: StatCardVariant;
  /** 点击 */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  /** 风格预设 (默认 default) */
  size?: "sm" | "md" | "lg";
  style?: CSSProperties;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}

const SIZE_MAP: Record<NonNullable<StatCardProps["size"]>, { padding: string; valueFont: number; iconBox: number }> = {
  sm: { padding: "12px 16px", valueFont: 20, iconBox: 36 },
  md: { padding: "14px 18px", valueFont: 26, iconBox: 40 },
  lg: { padding: "20px", valueFont: 30, iconBox: 52 },
};

/** 语义色 → CSS 变量 (与 design-system.css 对齐) */
const COLOR_PRESET: Record<StatCardColor, { fg: string; bg: string }> = {
  primary: { fg: "var(--color-primary-700, #1d4ed8)", bg: "var(--color-primary-50, #eff6ff)" },
  success: { fg: "var(--color-success-600, #16a34a)", bg: "var(--color-success-50, #f0fdf4)" },
  warning: { fg: "var(--color-warning-600, #d97706)", bg: "var(--color-warning-50, #fffbeb)" },
  error: { fg: "var(--color-error-600, #dc2626)", bg: "var(--color-error-50, #fef2f2)" },
  info: { fg: "var(--color-info-600, #0891b2)", bg: "var(--color-info-50, #ecfeff)" },
};

export function StatCard({
  title,
  value,
  suffix,
  loading,
  icon,
  color = "primary",
  iconBg,
  sub,
  trend,
  bordered = true,
  variant = "default",
  onClick,
  size = "md",
  style,
  className,
  testId,
  ariaLabel,
}: StatCardProps) {
  const sizeCfg = SIZE_MAP[size];
  const preset = (COLOR_PRESET as Record<string, { fg: string; bg: string } | undefined>)[color];
  const fgColor = preset ? preset.fg : color;
  const fallbackBg = preset ? preset.bg : `${color}1A`;

  const isUp = trend?.direction !== "down" && trend?.isUp !== false;
  const trendColor =
    trend && (trend.direction === "down" || trend.isUp === false)
      ? "var(--color-error-600, #dc2626)"
      : "var(--color-success-600, #059669)";

  const baseStyle: CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 12,
    padding: sizeCfg.padding,
    boxSizing: "border-box",
    transition: "box-shadow 0.2s, transform 0.2s",
    cursor: onClick ? "pointer" : "default",
  };

  const variantStyle: CSSProperties = {
    default: {
      border: bordered ? "1px solid var(--color-gray-200, #e2e8f0)" : "none",
      boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
    },
    compact: {
      border: bordered ? "1px solid var(--color-gray-200, #e2e8f0)" : "none",
      boxShadow: "none",
    },
    elevated: {
      border: bordered ? "1px solid var(--color-gray-200, #e2e8f0)" : "none",
      boxShadow: "var(--shadow-md, 0 4px 8px rgba(0,0,0,0.08))",
    },
    ghost: {
      border: "1px dashed var(--color-gray-300, #cbd5e1)",
      background: "transparent",
    },
  }[variant];

  return (
    <div
      data-testid={testId}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-label={ariaLabel}
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
      style={{ ...baseStyle, ...variantStyle, ...style }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 10,
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-secondary, #475569)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            {title}
          </div>
          {loading ? (
            <div
              data-testid={`${testId ?? "stat"}-loading`}
              style={{
                height: sizeCfg.valueFont,
                borderRadius: 6,
                background: "var(--skeleton-bg, #e2e8f0)",
                animation: "pulse 1.5s ease-in-out infinite",
                maxWidth: 120,
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
                <span style={{ fontSize: 13, fontWeight: 600, marginLeft: 2, color: "var(--text-secondary)" }}>
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
              <span>{isUp ? "↑" : "↓"}</span>
              <span>{Math.abs(Number(trend.value))}{typeof trend.value === "number" ? "%" : ""}</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: sizeCfg.iconBox,
              height: sizeCfg.iconBox,
              borderRadius: "50%",
              background: iconBg ?? fallbackBg,
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
    </div>
  );
}

/**
 * KPI 网格容器 (auto-fit 自适应列数)
 */
export function StatCardGrid({
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

export default StatCard;
