/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 5 - PageHeader
 * 放射专业主题升级:
 *   - 面包屑 (breadcrumb) + 返回按钮 (showBack/onBack) + 标题图标 (icon)
 *   - 右侧操作区插槽 (actions) — 全可选, 不破坏既有 props 兼容
 *
 * 收敛原 4 种变体:
 *   - banner  大渐变 Banner (DicomPrintPage 等)
 *   - flex    普通 flex 标题 + 工具栏 (HomePage / WorklistPage / ReportPage 等)
 *   - inline  极简 inline (EyeRisPage / EyeWorkspace 等)
 *   - minimal 无 actions 时
 */
import { Fragment } from "react";
import { ChevronLeft } from "lucide-react";
import type { ReactNode, CSSProperties } from "react";

export type PageHeaderVariant = "banner" | "flex" | "inline" | "minimal";
export type PageHeaderSize = "md" | "lg";
export type PageHeaderAlign = "left" | "center" | "right";

export interface PageHeaderCrumb {
  label: ReactNode;
  /** 可点击面包屑 (否则为静态文本) */
  onClick?: () => void;
}

export interface PageHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  variant?: PageHeaderVariant;
  /** 标题尺寸 (md: 20/700 默认, lg: 24/700) */
  size?: PageHeaderSize;
  /** 对齐方式 (flex 变体生效) */
  align?: PageHeaderAlign;
  /** 自定义背景 (banner 变体生效) */
  bannerBg?: string;
  /** 自定义前景色 (banner 变体生效) */
  bannerColor?: string;
  /** 自定义容器样式 */
  style?: CSSProperties;
  /** 透传 testid */
  testId?: string;
  /** 标签层级 (h1/h2/h3) */
  as?: "h1" | "h2" | "h3";
  /** 标签 (用于 a11y / 测试) */
  ariaLabel?: string;
  /** [Wave5] 面包屑 (首页 / 模块 / 当前页) */
  breadcrumb?: PageHeaderCrumb[];
  /** [Wave5] 显示返回按钮 */
  showBack?: boolean;
  /** [Wave5] 返回按钮回调 (默认 window.history.back) */
  onBack?: () => void;
  /** [Wave5] 返回按钮 aria-label */
  backLabel?: string;
}

/** 标题字号映射 (统一 700 字重) */
const HEADING_FONT: Record<PageHeaderSize, number> = {
  md: 20,
  lg: 24,
};

export function PageHeader({
  title,
  subtitle,
  actions,
  icon,
  variant = "flex",
  size = "md",
  align = "left",
  bannerBg,
  bannerColor = "#ffffff",
  style,
  testId,
  as: As = "h1",
  ariaLabel,
  breadcrumb,
  showBack,
  onBack,
  backLabel = "返回上一页",
}: PageHeaderProps) {
  const headingFont = HEADING_FONT[size];
  const justifyAlign: CSSProperties["justifyContent"] =
    align === "center" ? "center" : align === "right" ? "flex-end" : "flex-start";

  const handleBack = () => {
    if (onBack) onBack();
    else if (typeof window !== "undefined" && window.history.length > 1) window.history.back();
  };

  const backButton = showBack && (
    <button
      type="button"
      aria-label={backLabel}
      onClick={handleBack}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        borderRadius: 8,
        border: "1px solid var(--border-color, #e2e8f0)",
        background: "var(--bg-card, #ffffff)",
        color: "var(--text-secondary, #475569)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s, color 0.15s",
      }}
    >
      <ChevronLeft size={16} />
    </button>
  );

  const renderBreadcrumb = (color?: string) =>
    breadcrumb && breadcrumb.length > 0 ? (
      <nav
        aria-label="面包屑"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          flexWrap: "wrap",
          marginBottom: 6,
          color: color ?? "var(--text-muted, #94a3b8)",
        }}
      >
        {breadcrumb.map((item, i) => {
          const isLast = i === breadcrumb.length - 1;
          return (
            <Fragment key={i}>
              {i > 0 && <span style={{ opacity: 0.45 }}>/</span>}
              {item.onClick ? (
                <button
                  type="button"
                  onClick={item.onClick}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: isLast ? 600 : 400,
                    opacity: isLast ? 1 : 0.75,
                    color: color ?? "var(--text-secondary, #475569)",
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </button>
              ) : (
                <span
                  style={{
                    fontWeight: isLast ? 600 : 400,
                    opacity: isLast ? 1 : 0.75,
                  }}
                >
                  {item.label}
                </span>
              )}
            </Fragment>
          );
        })}
      </nav>
    ) : null;

  if (variant === "banner") {
    const bg = bannerBg ?? "linear-gradient(135deg, var(--color-primary-800), var(--color-primary-600))";
    return (
      <div
        data-testid={testId}
        aria-label={ariaLabel}
        style={{
          background: bg,
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: 16,
          color: bannerColor,
          borderRadius: 8,
          marginBottom: 16,
          ...style,
        }}
      >
        {renderBreadcrumb("rgba(255,255,255,0.8)")}
        {backButton && (
          <div style={{ marginLeft: breadcrumb ? 0 : -8 }}>{backButton}</div>
        )}
        {icon && (
          <div
            style={{
              width: 48,
              height: 48,
              background: "rgba(255,255,255,0.15)",
              borderRadius: 12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {icon}
          </div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <As style={{ margin: 0, fontSize: headingFont, fontWeight: 700, color: bannerColor }}>
            {title}
          </As>
          {subtitle && (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 14,
                color: bannerColor,
                opacity: 0.85,
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>{actions}</div>
        )}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <div
        data-testid={testId}
        aria-label={ariaLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          marginBottom: 16,
          flexWrap: "wrap",
          ...style,
        }}
      >
        {renderBreadcrumb()}
        {backButton}
        {icon}
        <As
          style={{
            margin: 0,
            fontSize: headingFont,
            fontWeight: 700,
            color: "var(--color-gray-900, #0f172a)",
          }}
        >
          {title}
        </As>
        {subtitle && (
          <span style={{ fontSize: 12, color: "var(--color-gray-500, #64748b)" }}>
            {subtitle}
          </span>
        )}
        {actions && (
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              gap: 8,
              alignItems: "center",
            }}
          >
            {actions}
          </div>
        )}
      </div>
    );
  }

  // flex (默认) / minimal: 标题左 / 工具栏右
  const isMinimal = variant === "minimal" || !actions;
  return (
    <div
      data-testid={testId}
      aria-label={ariaLabel}
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: isMinimal ? "center" : "flex-start",
        marginBottom: 20,
        gap: 16,
        flexWrap: "wrap",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          justifyContent: justifyAlign,
        }}
      >
        {renderBreadcrumb()}
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          {backButton}
          {icon}
          <div style={{ minWidth: 0 }}>
            <As
              style={{
                margin: 0,
                fontSize: headingFont,
                fontWeight: 700,
                color: "var(--color-primary-900, var(--color-primary-800))",
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </As>
            {subtitle && (
              <p
                style={{
                  margin: "4px 0 0",
                  fontSize: 12,
                  color: "var(--color-gray-500, #64748b)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>
      </div>
      {actions && (
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
