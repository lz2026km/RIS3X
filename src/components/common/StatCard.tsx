/**
 * G005 放射RIS系统 v3.0.6.8-23c - StatCard
 * Stage 2 - Agent A6: 卡片样式统一
 *
 * 收敛原 4 种卡片样式:
 *   - radius:  8 / 10 / 12
 *   - shadow:  0 1px 3px / 0 1px 4px / 0 8px 24px hover
 *   - border:  1px solid #e2e8f0 / 1px solid #d1d5db / none
 *
 * 配套 KPI 网格列数统一为:
 *   gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))'
 */
import type { ReactNode, CSSProperties, MouseEvent } from "react";

export type StatCardVariant = "default" | "compact" | "elevated" | "ghost";

export interface StatCardProps {
  title: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  /** 主色 (用于 icon 背景) */
  color?: string;
  /** icon 背景色 (默认 `${color}18`) */
  iconBg?: string;
  /** 副标题 (小字) */
  sub?: ReactNode;
  /** 趋势 { value, isUp? } */
  trend?: { value: number; isUp?: boolean };
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
  md: { padding: "14px 18px", valueFont: 24, iconBox: 40 },
  lg: { padding: "20px", valueFont: 30, iconBox: 52 },
};

export function StatCard({
  title,
  value,
  icon,
  color = "#3b82f6",
  iconBg,
  sub,
  trend,
  variant = "default",
  onClick,
  size = "md",
  style,
  className,
  testId,
  ariaLabel,
}: StatCardProps) {
  const sizeCfg = SIZE_MAP[size];

  const baseStyle: CSSProperties = {
    background: "var(--color-gray-0, #ffffff)",
    borderRadius: 12,
    padding: sizeCfg.padding,
    boxSizing: "border-box",
    transition: "box-shadow 0.2s, transform 0.2s",
    cursor: onClick ? "pointer" : "default",
  };

  const variantStyle: CSSProperties = {
    default: {
      border: "1px solid var(--color-gray-200, #e2e8f0)",
      boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
    },
    compact: {
      border: "1px solid var(--color-gray-200, #e2e8f0)",
      boxShadow: "none",
    },
    elevated: {
      border: "1px solid var(--color-gray-200, #e2e8f0)",
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
              color: "var(--color-gray-500, #64748b)",
              marginBottom: 4,
              fontWeight: 500,
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: sizeCfg.valueFont,
              fontWeight: 800,
              color: "var(--color-primary-900, #1e40af)",
              lineHeight: 1.2,
              letterSpacing: "-0.01em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {value}
          </div>
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
                color: trend.isUp === false
                  ? "var(--color-error-600, #dc2626)"
                  : "var(--color-success-600, #059669)",
              }}
            >
              <span>{trend.isUp === false ? "↓" : "↑"}</span>
              <span>{Math.abs(trend.value)}%</span>
            </div>
          )}
        </div>
        {icon && (
          <div
            style={{
              width: sizeCfg.iconBox,
              height: sizeCfg.iconBox,
              borderRadius: 10,
              background: iconBg ?? `${color}1A`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color,
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
 * 原: 6 列 / 8 列 / 4 列 硬编码
 * 现: repeat(auto-fit, minmax(220px, 1fr)) 自适应
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
