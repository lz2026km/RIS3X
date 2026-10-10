/**
 * G005 放射RIS系统 v3.0.6.8-23c - SectionDivider
 * Stage 2 - Agent A6: Section 切分统一
 *
 * 收敛原页面散落的:
 *   - 1px solid #e2e8f0  divider
 *   - <Space size="large" />  留白
 *   - borderTop 切分
 *
 * 用法:
 *   <SectionDivider />                 // 横线
 *   <SectionDivider label="分组标题" /> // 标题 + 横线
 *   <SectionDivider variant="space" />  // 仅留白
 */
import type { ReactNode, CSSProperties } from "react";

export type SectionDividerVariant = "line" | "space" | "label" | "double";

export interface SectionDividerProps {
  label?: ReactNode;
  variant?: SectionDividerVariant;
  /** Space 变体下垂直间距大小 (px), 默认 16 */
  spacing?: number;
  /** 主色 (默认 #e2e8f0) */
  color?: string;
  /** 自定义 style */
  style?: CSSProperties;
  className?: string;
  testId?: string;
}

export function SectionDivider({
  label,
  variant = "line",
  spacing = 16,
  color = "var(--color-gray-200, #e2e8f0)",
  style,
  className,
  testId,
}: SectionDividerProps) {
  if (variant === "space") {
    return (
      <div
        data-testid={testId}
        className={className}
        aria-hidden="true"
        style={{ height: spacing, ...style }}
      />
    );
  }

  if (variant === "label") {
    return (
      <div
        data-testid={testId}
        className={className}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 'var(--space-3, 12px)',
          margin: "16px 0",
          ...style,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            flex: 1,
            height: 1,
            background: color,
          }}
        />
        {label && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-gray-500, #64748b)",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </span>
        )}
        <div
          aria-hidden="true"
          style={{
            flex: 1,
            height: 1,
            background: color,
          }}
        />
      </div>
    );
  }

  if (variant === "double") {
    return (
      <div
        data-testid={testId}
        className={className}
        aria-hidden="true"
        style={{
          borderTop: `1px solid ${color}`,
          borderBottom: `1px solid ${color}`,
          height: 3,
          margin: "16px 0",
          ...style,
        }}
      />
    );
  }

  // default: line
  return (
    <div
      data-testid={testId}
      className={className}
      aria-hidden="true"
      style={{
        height: 1,
        background: color,
        margin: "16px 0",
        ...style,
      }}
    />
  );
}

export default SectionDivider;
