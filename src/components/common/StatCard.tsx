/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 5 - StatCard
 * 放射专业主题升级:
 *   - 渐变背景 (gradient / gradientFrom / gradientTo, 全可选)
 *   - 趋势指示 up/down/flat (trend.direction 扩展 flat)
 *   - 图标 + 点击跳转 (onClick) 保持既有用法
 *
 * 统一规范:
 *   - bg-card + radius 8 + shadow-sm
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
  direction?: "up" | "down" | "flat";
  /** 兼容旧字段 */
  isUp?: boolean;
}

export interface StatCardProps {
  title?: ReactNode;
  /** 兼容旧字段 (等价 title) */
  label?: ReactNode;
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
  /** 兼容旧字段 (等价 sub) */
  subValue?: ReactNode;
  /** 趋势 { value, direction: up|down|flat } 或旧写法 "up"|"down"|"flat" */
  trend?: StatCardTrend | "up" | "down" | "flat";
  /** 兼容旧字段: 配合字符串 trend 使用 */
  trendValue?: number | string;
  /** 边框 (默认有) */
  bordered?: boolean;
  /** 变体 */
  variant?: StatCardVariant;
  /** 点击 */
  onClick?: (e: MouseEvent<HTMLDivElement>) => void;
  /** 风格预设 (默认 default) */
  size?: "sm" | "md" | "lg";
  /** [Wave5] 渐变背景 (135deg 从语义色淡化) */
  gradient?: boolean;
  /** [Wave5] 渐变起始色 (默认语义色 12% 透明度) */
  gradientFrom?: string;
  /** [Wave5] 渐变结束色 (默认透明) */
  gradientTo?: string;
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

/** 渐变底色 (预设对应的实际 hex, 用于生成淡化渐变) */
const PRESET_HEX: Record<StatCardColor, string> = {
  primary: "#2563eb",
  success: "#16a34a",
  warning: "#d97706",
  error: "#dc2626",
  info: "#0891b2",
};

/** #rrggbb → 8 位 hex + alpha */
function withAlpha(hex: string, alpha: number): string {
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
    return `${hex}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
  }
  return hex;
}

export function StatCard({
  title,
  label,
  value,
  suffix,
  loading,
  icon,
  color = "primary",
  iconBg,
  sub,
  subValue,
  trend,
  trendValue,
  bordered = true,
  variant = "default",
  onClick,
  size = "md",
  gradient = false,
  gradientFrom,
  gradientTo,
  style,
  className,
  testId,
  ariaLabel,
}: StatCardProps) {
  const sizeCfg = SIZE_MAP[size];
  const preset = (COLOR_PRESET as Record<string, { fg: string; bg: string } | undefined>)[color];
  const fgColor = preset ? preset.fg : color;
  const fallbackBg = preset ? preset.bg : `${color}1A`;

  const resolvedTitle = title ?? label;
  const resolvedSub = sub ?? subValue;
  const trendCfg: StatCardTrend | undefined =
    typeof trend === "string" ? { value: trendValue ?? 0, direction: trend } : trend;

  const isFlat = trendCfg?.direction === "flat";
  const isUp = trendCfg?.direction !== "down" && trendCfg?.direction !== "flat" && trendCfg?.isUp !== false;
  const trendColor = isFlat
    ? "var(--text-muted, #94a3b8)"
    : trendCfg && (trendCfg.direction === "down" || trendCfg.isUp === false)
      ? "var(--color-error-600, #dc2626)"
      : "var(--color-success-600, #059669)";

  const baseStyle: CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 8,
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

  // 渐变背景: 135deg 语义色淡化 → 透明, 叠加在卡片底色上
  let background: CSSProperties["background"] = undefined;
  if (gradient && variant !== "ghost") {
    const baseHex = preset ? PRESET_HEX[color as StatCardColor] : color;
    const from = gradientFrom ?? withAlpha(baseHex, 0.12);
    const to = gradientTo ?? "transparent";
    background = `linear-gradient(135deg, ${from} 0%, ${to} 100%), var(--bg-card, #ffffff)`;
  }

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
      style={{ ...baseStyle, ...variantStyle, background: background ?? baseStyle.background, ...style }}
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
            {resolvedTitle}
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
          {resolvedSub && (
            <div
              style={{
                fontSize: 12,
                color: "var(--color-gray-400, #94a3b8)",
                marginTop: 4,
              }}
            >
              {resolvedSub}
            </div>
          )}
          {trendCfg && (
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
              <span>{isFlat ? "→" : isUp ? "↑" : "↓"}</span>
              <span>{Math.abs(Number(trendCfg.value))}{typeof trendCfg.value === "number" ? "%" : ""}</span>
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
  columns,
  gap = 16,
  style,
  className,
  testId,
}: {
  children: ReactNode;
  minWidth?: number;
  columns?: number;
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
        gridTemplateColumns: columns
          ? `repeat(${columns}, minmax(0, 1fr))`
          : `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
        gap,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default StatCard;
