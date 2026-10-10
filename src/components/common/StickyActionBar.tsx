/**
 * G005 RIS v3.0.6.8-26 - StickyActionBar 组件
 *
 * 固定在页面顶部/底部的操作栏，解决 v25 33 button force-click 问题
 * (长页面 primary CTA 在 fold 之下无法触达)
 *
 * 特性：
 * - 支持顶部/底部固定
 * - 渐变背景 + 阴影，区分主操作区
 * - 响应式: <768px 自动堆叠
 * - a11y: role="toolbar" + 焦点环
 */
import React from "react";

export type StickyActionBarVariant = "top" | "bottom";
export type StickyActionBarTheme = "light" | "primary" | "warning";

export interface StickyActionBarAction {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick?: () => void;
  type?: "primary" | "default" | "dashed" | "link" | "text";
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  ariaLabel?: string;
}

export interface StickyActionBarProps {
  actions: StickyActionBarAction[];
  variant?: StickyActionBarVariant;
  theme?: StickyActionBarTheme;
  title?: React.ReactNode;
  extra?: React.ReactNode;
  offsetTop?: number;
  className?: string;
}

const themeStyles: Record<
  StickyActionBarTheme,
  { background: string; border: string; shadow: string; text: string }
> = {
  light: {
    background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
    border: "1px solid #e2e8f0",
    shadow: "0 2px 8px rgba(0,0,0,0.06)",
    text: "#1e293b",
  },
  primary: {
    background: "linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-500) 100%)",
    border: "1px solid var(--color-primary-600)",
    shadow: "0 2px 12px rgba(30,64,175,0.25)",
    text: "#ffffff",
  },
  warning: {
    background: "linear-gradient(135deg, var(--color-error-600) 0%, var(--color-warning-500) 100%)",
    border: "1px solid var(--color-error-600)",
    shadow: "0 2px 12px rgba(220,38,38,0.25)",
    text: "#ffffff",
  },
};

export function StickyActionBar({
  actions,
  variant = "top",
  theme = "light",
  title,
  extra,
  offsetTop = 56,
  className,
}: StickyActionBarProps) {
  const s = themeStyles[theme];
  const position =
    variant === "top"
      ? { top: offsetTop, left: 0, right: 0 }
      : { bottom: 0, left: 0, right: 0 };

  const buttonStyle: React.CSSProperties = {
    background: theme === "primary" || theme === "warning" ? "rgba(255,255,255,0.15)" : "#fff",
    color: s.text,
    border: theme === "primary" || theme === "warning" ? "1px solid rgba(255,255,255,0.3)" : "1px solid #cbd5e1",
    borderRadius: 6,
    padding: "6px 14px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    transition: "all 0.15s",
    opacity: 1,
  };

  return (
    <div
      role="toolbar"
      aria-label={typeof title === "string" ? title : "操作栏"}
      className={className}
      style={{
        position: "sticky",
        ...position,
        zIndex: 100,
        background: s.background,
        borderBottom: variant === "top" ? s.border : "none",
        borderTop: variant === "bottom" ? s.border : "none",
        boxShadow: s.shadow,
        padding: "8px 16px",
        display: "flex",
        alignItems: "center",
        gap: 'var(--space-3, 12px)',
        flexWrap: "wrap",
        minHeight: 48,
      }}
    >
      {title && (
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: s.text,
            marginRight: 'var(--space-2, 8px)',
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {title}
        </div>
      )}
      <div style={{ display: "flex", gap: 'var(--space-2, 8px)', flexWrap: "wrap", flex: 1 }}>
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            disabled={a.disabled || a.loading}
            aria-label={a.ariaLabel || a.label}
            onClick={a.onClick}
            style={{
              ...buttonStyle,
              opacity: a.disabled ? 0.5 : 1,
              cursor: a.disabled ? "not-allowed" : "pointer",
              background:
                a.type === "primary"
                  ? theme === "primary" || theme === "warning"
                    ? "#ffffff"
                    : "var(--color-primary-600)"
                  : a.danger
                    ? "var(--color-error-600)"
                    : buttonStyle.background,
              color:
                a.type === "primary"
                  ? theme === "primary" || theme === "warning"
                    ? "var(--color-primary-800)"
                    : "#fff"
                  : a.danger
                    ? "#fff"
                    : buttonStyle.color,
            }}
            onMouseEnter={(e) => {
              if (!a.disabled && !a.loading) {
                e.currentTarget.style.transform = "translateY(-1px)";
                e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.1)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "none";
            }}
          >
            {a.icon}
            {a.label}
          </button>
        ))}
      </div>
      {extra && <div>{extra}</div>}
    </div>
  );
}

export default StickyActionBar;