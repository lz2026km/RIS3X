/**
 * G005 放射RIS系统 v3.0.6.11-100 Wave 5A - AppText
 * UI 组件化: 统一文本排版 (字号 / 字重 / 语义色)
 *
 * 映射 design-system.css token:
 *   size:  xs 12 / sm 13 / md 14 / lg 16 / xl 20
 *   color: primary  --text-primary / secondary --text-secondary /
 *          muted --text-muted / success --color-success-600 /
 *          error --color-error-600 / warning --color-warning-600
 */
import type { CSSProperties, ReactNode } from "react";

export type AppTextSize = "xs" | "sm" | "md" | "lg" | "xl";
export type AppTextWeight = 400 | 500 | 600 | 700;
export type AppTextColor = "primary" | "secondary" | "muted" | "success" | "error" | "warning";

export interface AppTextProps {
  size?: AppTextSize;
  weight?: AppTextWeight;
  color?: AppTextColor;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** 透传 testid */
  testId?: string;
  /** 标签 (span/div/p) */
  as?: "span" | "div" | "p";
}

export const TEXT_SIZE: Record<AppTextSize, number> = {
  xs: 12,
  sm: 13,
  md: 14,
  lg: 16,
  xl: 20,
};

export const TEXT_COLOR: Record<AppTextColor, string> = {
  primary: "var(--text-primary, #1e293b)",
  secondary: "var(--text-secondary, #475569)",
  muted: "var(--text-muted, #94a3b8)",
  success: "var(--color-success-600, #16a34a)",
  error: "var(--color-error-600, #dc2626)",
  warning: "var(--color-warning-600, #d97706)",
};

export function AppText({
  size = "md",
  weight = 400,
  color = "primary",
  className,
  style,
  children,
  testId,
  as: As = "span",
}: AppTextProps) {
  return (
    <As
      data-testid={testId}
      className={className}
      style={{
        fontSize: TEXT_SIZE[size],
        fontWeight: weight,
        color: TEXT_COLOR[color],
        lineHeight: 1.5,
        ...style,
      }}
    >
      {children}
    </As>
  );
}

export default AppText;
