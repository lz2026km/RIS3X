/**
 * G005 放射RIS系统 [UI-5] - Card
 * 统一卡片基元 (唯一权威): 标题 / 副标题 / 图标 / 右侧操作 / 变体 / 内边距
 * 全部走语义令牌 --bg-card / --border-default / --radius-md / --shadow-sm,
 * 通过 CSS 变量自动适配 浅色 / 深色 / 高对比度 主题。
 *
 * 无标题时直接渲染 children (外层即卡片), 便于替换既有 ad-hoc `<div>` 卡片;
 * 有标题时渲染 header + body 结构。
 */
import type { ReactNode, CSSProperties } from "react";

export type CardVariant = "default" | "outlined" | "flat" | "elevated";
export type CardPadding = "none" | "sm" | "md" | "lg";

const PADDING: Record<CardPadding, number> = {
  none: 0,
  sm: 12,
  md: 16,
  lg: 20,
};

export interface CardProps {
  /** 卡片标题 */
  title?: ReactNode;
  /** 副标题 (标题下方小字) */
  subtitle?: ReactNode;
  /** 标题左侧图标 */
  icon?: ReactNode;
  /** 右侧操作区 (按钮 / 标签 / 链接) */
  extra?: ReactNode;
  /** 内边距预设 (默认 md=16) */
  padding?: CardPadding;
  /** 视觉变体 (默认 default) */
  variant?: CardVariant;
  /** 悬浮抬升 (默认 false) */
  hoverable?: boolean;
  /** 是否可点击 (配合 hoverable, 展示手型) */
  onClick?: () => void;
  /** 语义标签 (默认 div) */
  as?: "div" | "section" | "article";
  /** 透传 testid */
  testId?: string;
  /** aria-label */
  ariaLabel?: string;
  className?: string;
  style?: CSSProperties;
  /** 标题容器额外样式 */
  headerStyle?: CSSProperties;
  children?: ReactNode;
}

function variantStyle(variant: CardVariant): CSSProperties {
  switch (variant) {
    case "outlined":
      return { boxShadow: "none" };
    case "flat":
      return { boxShadow: "none", border: "none" };
    case "elevated":
      return { boxShadow: "var(--shadow-md, 0 4px 8px 0 rgb(0 0 0 / 0.1))" };
    case "default":
    default:
      return { boxShadow: "var(--shadow-sm, 0 1px 3px 0 rgb(0 0 0 / 0.08))" };
  }
}

export function Card({
  title,
  subtitle,
  icon,
  extra,
  padding = "md",
  variant = "default",
  hoverable = false,
  onClick,
  as: As = "div",
  testId,
  ariaLabel,
  className,
  style,
  headerStyle,
  children,
}: CardProps) {
  const pad = PADDING[padding];
  const hasHeader = title !== undefined || subtitle !== undefined || icon !== undefined || extra !== undefined;

  const base: CSSProperties = {
    boxSizing: "border-box",
    color: "var(--text-primary, #1e293b)",
    background: "var(--bg-card, #ffffff)",
    border: "1px solid var(--border-default, rgba(0,0,0,0.1))",
    borderRadius: "var(--radius-md, 8px)",
    transition: "box-shadow 0.18s ease, transform 0.18s ease",
    ...variantStyle(variant),
  };

  if (!hasHeader) {
    return (
      <As
        data-testid={testId}
        aria-label={ariaLabel}
        className={[hoverable ? "ui5-card-hover" : "", className].filter(Boolean).join(" ")}
        onClick={onClick}
        style={{
          ...base,
          padding: pad,
          cursor: hoverable ? "pointer" : undefined,
          ...style,
        }}
      >
        {children}
      </As>
    );
  }

  return (
    <As
      data-testid={testId}
      aria-label={ariaLabel}
      className={[hoverable ? "ui5-card-hover" : "", className].filter(Boolean).join(" ")}
      onClick={onClick}
      style={{
        ...base,
        cursor: hoverable ? "pointer" : undefined,
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: pad,
          paddingBottom: subtitle !== undefined ? Math.max(6, pad - 6) : pad,
          ...headerStyle,
        }}
      >
        {icon !== undefined && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "var(--radius-sm, 6px)",
              background: "var(--color-primary-50, #eff6ff)",
              color: "var(--color-primary-700, #1d4ed8)",
              flexShrink: 0,
            }}
            aria-hidden="true"
          >
            {icon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {title !== undefined && (
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                lineHeight: 1.35,
                color: "var(--text-primary, #1e293b)",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </div>
          )}
          {subtitle !== undefined && (
            <div
              style={{
                fontSize: 12,
                color: "var(--text-muted, #64748b)",
                marginTop: title !== undefined ? 2 : 0,
                lineHeight: 1.45,
              }}
            >
              {subtitle}
            </div>
          )}
        </div>
        {extra !== undefined && <div style={{ flexShrink: 0 }}>{extra}</div>}
      </div>
      <div style={{ padding: pad, paddingTop: 0 }}>{children}</div>
    </As>
  );
}

export default Card;
