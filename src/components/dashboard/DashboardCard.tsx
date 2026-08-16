/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - DashboardCard
 * 仪表盘卡片容器: 标题栏 (图标 + 标题 + 操作区) + 内容区
 * 三态: loading (骨架) / error (错误 + 重试) / empty (空态)
 */
import type { CSSProperties, ReactNode } from "react";
import { AlertTriangle, Inbox, RefreshCw } from "lucide-react";
import { SkeletonCard } from "./SkeletonCard";

export interface DashboardCardProps {
  title?: ReactNode;
  /** 标题栏图标 */
  icon?: ReactNode;
  /** 标题栏右侧操作区 */
  extra?: ReactNode;
  /** 加载态 (骨架屏) */
  loading?: boolean;
  /** 加载骨架行数 */
  skeletonRows?: number;
  /** 错误态 */
  error?: ReactNode;
  /** 错误重试回调 */
  onRetry?: () => void;
  /** 空态: 无数据时展示 (需同时传 empty 或由外部控制) */
  empty?: boolean;
  /** 空态描述 */
  emptyDescription?: ReactNode;
  /** 内容区 padding (默认 16) */
  bodyPadding?: number | string;
  /** 无默认边框背景 (用于嵌套场景) */
  flat?: boolean;
  style?: CSSProperties;
  bodyStyle?: CSSProperties;
  className?: string;
  testId?: string;
  children?: ReactNode;
}

export function DashboardCard({
  title,
  icon,
  extra,
  loading = false,
  skeletonRows = 4,
  error,
  onRetry,
  empty = false,
  emptyDescription = "暂无数据",
  bodyPadding = 16,
  flat = false,
  style,
  bodyStyle,
  className,
  testId,
  children,
}: DashboardCardProps) {
  if (loading) {
    return (
      <SkeletonCard
        title={!!title || !!icon}
        rows={skeletonRows}
        testId={testId ? `${testId}-loading` : undefined}
        className={className}
        style={style}
      />
    );
  }

  return (
    <section
      data-testid={testId}
      className={className}
      style={{
        background: flat ? "transparent" : "var(--bg-card)",
        borderRadius: 12,
        border: flat ? "none" : "1px solid var(--color-gray-200, #e2e8f0)",
        boxShadow: flat ? "none" : "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
        overflow: "hidden",
        ...style,
      }}
    >
      {(title || icon || extra) && (
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "14px 16px",
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          {icon && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 28,
                height: 28,
                borderRadius: 8,
                background: "var(--color-primary-50, #eff6ff)",
                color: "var(--color-primary-700, #1d4ed8)",
                flexShrink: 0,
              }}
            >
              {icon}
            </span>
          )}
          {title && (
            <h3
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                color: "var(--text-primary)",
                flex: 1,
                minWidth: 0,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {title}
            </h3>
          )}
          {extra && <div style={{ display: "flex", alignItems: "center", gap: 8 }}>{extra}</div>}
        </header>
      )}

      <div style={{ padding: bodyPadding, ...bodyStyle }}>
        {error ? (
          <div
            role="alert"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "28px 16px",
              textAlign: "center",
            }}
          >
            <span style={{ color: "var(--color-error-500, #ef4444)", opacity: 0.7 }}>
              <AlertTriangle size={32} strokeWidth={1.5} />
            </span>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              {typeof error === "string" ? error : "数据加载失败"}
            </div>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "6px 14px",
                  borderRadius: 6,
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  color: "var(--color-primary-700, #1d4ed8)",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <RefreshCw size={12} /> 重试
              </button>
            )}
          </div>
        ) : empty ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "28px 16px",
              textAlign: "center",
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ opacity: 0.4 }}>
              <Inbox size={36} strokeWidth={1.5} />
            </span>
            <span style={{ fontSize: 13 }}>{emptyDescription}</span>
          </div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

export default DashboardCard;
