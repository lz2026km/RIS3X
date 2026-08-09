/**
 * G005 放射RIS系统 v3.0.6.8-23c - PageContainer
 * Stage 2 - Agent A6: 页面外壳统一
 *
 * 收敛原 25+ 页面中散落的:
 *   - 5 种 maxWidth (1400 / 1440 / 1600 / 1200 / 无)
 *   - 7 种 background (#f8fafc / #f1f5f9 / #f7fafc / #f0f9ff / #e8e8e8 / #0f172a / 无)
 *   - 不同的 padding / minHeight
 */
import type { ReactNode, CSSProperties } from "react";

export type PageBackground =
  | "default"
  | "slate"
  | "blue"
  | "sky"
  | "gray"
  | "dark"
  | "white"
  | "none";

export type PageMaxWidth =
  | "narrow" // 1200
  | "standard" // 1400
  | "wide" // 1440
  | "full" // 1600
  | "fluid"; // 100%

const BG_MAP: Record<PageBackground, string | undefined> = {
  default: "var(--bg-primary, #f8fafc)", // 默认浅灰 (随主题)
  slate: "var(--bg-primary, #f8fafc)", // 兼容旧 #f8fafc (随主题)
  blue: "var(--color-primary-50, #eff6ff)", // #eff6ff
  sky: "var(--color-info-50, #ecfeff)", // #ecfeff / #f0f9ff
  gray: "#e8e8e8", // 兼容 AIAssistPage 浅灰
  dark: "#0f172a", // 兼容 AIMarketplacePage / AIOrchestrationPage
  white: "#ffffff",
  none: "transparent",
};

const MAX_WIDTH_PX: Record<Exclude<PageMaxWidth, "fluid">, number> = {
  narrow: 1200,
  standard: 1400,
  wide: 1440,
  full: 1600,
};

export interface PageContainerProps {
  children: ReactNode;
  /** 预设背景 (默认 default = #f8fafc) */
  background?: PageBackground;
  /** 最大宽度 (默认 full = 1600) */
  maxWidth?: PageMaxWidth;
  /** 内部 padding (默认 24) */
  padding?: number | string;
  /** 最小高度 (默认 100vh) */
  minHeight?: number | string;
  /** 底部分页器 / FAB 留白 (默认 0) */
  fabPadding?: boolean;
  /** 留白值 (默认 96, 给 FAB + 分页器让位) */
  fabPaddingBottom?: number;
  /** 直接覆盖 style */
  style?: CSSProperties;
  className?: string;
  /** 透传给 data-testid (便于 Playwright) */
  testId?: string;
}

export function PageContainer({
  children,
  background = "default",
  maxWidth = "full",
  padding = 24,
  minHeight = "100vh",
  fabPadding = false,
  fabPaddingBottom = 96,
  style,
  className,
  testId,
}: PageContainerProps) {
  const bg = BG_MAP[background] ?? BG_MAP.default;
  const maxW =
    maxWidth === "fluid"
      ? "100%"
      : `${MAX_WIDTH_PX[maxWidth as Exclude<PageMaxWidth, "fluid">]}px`;
  const paddingBottom =
    fabPadding && typeof padding === "number"
      ? padding + fabPaddingBottom
      : padding;

  return (
    <div
      data-testid={testId}
      className={className}
      style={{
        padding,
        paddingBottom,
        maxWidth: maxW,
        margin: "0 auto",
        background: bg,
        minHeight,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default PageContainer;
