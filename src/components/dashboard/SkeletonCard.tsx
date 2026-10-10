/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - SkeletonCard
 * 仪表盘骨架屏: 卡片加载占位 (标题栏 + 内容骨架)
 */
import type { CSSProperties, ReactNode } from "react";

export interface SkeletonCardProps {
  /** 是否显示标题占位 (默认 true) */
  title?: boolean;
  /** 内容骨架行数 (默认 4) */
  rows?: number;
  /** 高度 */
  height?: number | string;
  style?: CSSProperties;
  className?: string;
  testId?: string;
  children?: ReactNode;
}

const pulse = {
  borderRadius: 6,
  background: "var(--skeleton-bg, #e2e8f0)",
  animation: "pulse 1.5s ease-in-out infinite",
} as const;

export function SkeletonCard({
  title = true,
  rows = 4,
  height,
  style,
  className,
  testId,
  children,
}: SkeletonCardProps) {
  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--color-gray-200, #e2e8f0)",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
        padding: 'var(--space-5, 20px)',
        height,
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 'var(--space-2, 8px)',
            paddingBottom: 'var(--space-3, 12px)',
            marginBottom: 'var(--space-4, 16px)',
            borderBottom: "1px solid var(--border-color)",
          }}
        >
          <div style={{ ...pulse, width: 24, height: 24, borderRadius: 6 }} />
          <div style={{ ...pulse, width: 120, height: 16 }} />
          <div style={{ flex: 1 }} />
          <div style={{ ...pulse, width: 64, height: 22 }} />
        </div>
      )}
      {children ??
        Array.from({ length: rows }, (_, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ ...pulse, width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ ...pulse, width: "100%", height: 12, marginBottom: 6 }} />
              <div style={{ ...pulse, width: "70%", height: 12 }} />
            </div>
          </div>
        ))}
    </div>
  );
}

/**
 * SkeletonKpi: KPI 卡骨架 (数值 + 图标占位)
 */
export function SkeletonKpi({ testId }: { testId?: string }) {
  return (
    <div
      data-testid={testId}
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        border: "1px solid var(--color-gray-200, #e2e8f0)",
        boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))",
        padding: "14px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...pulse, width: 72, height: 12, marginBottom: 10 }} />
          <div style={{ ...pulse, width: 120, height: 26, marginBottom: 'var(--space-2, 8px)' }} />
          <div style={{ ...pulse, width: 96, height: 12 }} />
        </div>
        <div style={{ ...pulse, width: 40, height: 40, borderRadius: "50%" }} />
      </div>
    </div>
  );
}

export default SkeletonCard;
