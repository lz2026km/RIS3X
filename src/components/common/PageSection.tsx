/**
 * G005 放射RIS系统 [UI-D v3.0.6.13-0] - PageSection
 * 页面区块垂直节奏原语: flex column + gap 令牌, 替代散落的 `marginBottom: 16`。
 * 可选区块标题 / 副标题 / 右侧操作。
 */
import type { ReactNode, CSSProperties } from "react";

export interface PageSectionProps {
  /** 区块标题 */
  title?: ReactNode;
  /** 副标题 */
  subtitle?: ReactNode;
  /** 右侧操作 */
  extra?: ReactNode;
  /** 子内容 */
  children?: ReactNode;
  /** 区块间距 (默认 16, 建议 12/16/24) */
  gap?: number;
  className?: string;
  style?: CSSProperties;
  testId?: string;
}

export function PageSection({
  title,
  subtitle,
  extra,
  children,
  gap = 16,
  className,
  style,
  testId,
}: PageSectionProps) {
  const hasHeader = title !== undefined || subtitle !== undefined || extra !== undefined;
  return (
    <section
      data-testid={testId}
      className={className}
      style={{ display: "flex", flexDirection: "column", gap, ...style }}
    >
      {hasHeader && (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {title !== undefined && (
              <div style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.35, color: "var(--text-primary, #1e293b)" }}>
                {title}
              </div>
            )}
            {subtitle !== undefined && (
              <div style={{ fontSize: 12, color: "var(--text-secondary, #475569)", marginTop: 2 }}>{subtitle}</div>
            )}
          </div>
          {extra !== undefined && <div style={{ flexShrink: 0 }}>{extra}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

export default PageSection;
