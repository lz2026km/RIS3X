/**
 * G005 放射RIS系统 [UI-5] - PageTemplate
 * 唯一权威页面模板: PageContainer > PageHeader > toolbar > StateView > children
 *
 * 统一: 内边距 / 最大宽度 / 面包屑 / 返回 / 页头 / 工具栏 / 三态占位。
 * 兼容 PageContainer 既有 props (background / maxWidth / padding / minHeight /
 * fabPadding / testId / style), 可原地替换 `<PageContainer>` 实现渐进式采纳。
 *
 * 当页面自带页头时, 传 `showHeader={false}` (或不传 title) 即仅保留容器 + 三态。
 */
import type { ReactNode, CSSProperties } from "react";
import {
  PageContainer,
  type PageBackground,
  type PageMaxWidth,
} from "./PageContainer";
import {
  PageHeader,
  type PageHeaderCrumb,
  type PageHeaderSize,
  type PageHeaderVariant,
} from "./PageHeader";
import { StateView } from "./StateView";

export interface PageTemplateProps {
  /* ── 页头 ── */
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: PageHeaderCrumb[];
  showBack?: boolean;
  onBack?: () => void;
  backLabel?: string;
  headerVariant?: PageHeaderVariant;
  headerSize?: PageHeaderSize;
  /** 是否渲染页头 (默认: 有 title 才渲染) */
  showHeader?: boolean;
  headerStyle?: CSSProperties;

  /* ── 工具栏 (页头下方独立区块) ── */
  toolbar?: ReactNode;
  toolbarStyle?: CSSProperties;

  /* ── 容器 (兼容 PageContainer) ── */
  container?: boolean;
  background?: PageBackground;
  maxWidth?: PageMaxWidth;
  padding?: number | string;
  minHeight?: number | string;
  fabPadding?: boolean;
  testId?: string;
  className?: string;
  style?: CSSProperties;

  /* ── 三态 (StateView) ── */
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  onRetry?: () => void;
  minStateHeight?: number;
  skeletonRows?: number;

  children?: ReactNode;
}

export function PageTemplate({
  title,
  subtitle,
  icon,
  actions,
  breadcrumb,
  showBack,
  onBack,
  backLabel,
  headerVariant = "flex",
  headerSize = "md",
  showHeader,
  headerStyle,
  toolbar,
  toolbarStyle,
  container = true,
  background = "default",
  maxWidth = "full",
  padding = 24,
  minHeight = "100%",
  fabPadding = false,
  testId,
  className,
  style,
  loading,
  error,
  empty,
  emptyDescription,
  emptyAction,
  onRetry,
  minStateHeight,
  skeletonRows,
  children,
}: PageTemplateProps) {
  const headerVisible =
    (showHeader ?? title !== undefined) &&
    (title !== undefined ||
      subtitle !== undefined ||
      icon !== undefined ||
      actions !== undefined ||
      (breadcrumb !== undefined && breadcrumb.length > 0));

  const body = (
    <>
      {headerVisible && (
        <PageHeader
          variant={headerVariant}
          size={headerSize}
          title={title}
          subtitle={subtitle}
          icon={icon}
          actions={actions}
          breadcrumb={breadcrumb}
          showBack={showBack}
          onBack={onBack}
          backLabel={backLabel}
          style={headerStyle}
        />
      )}
      {toolbar !== undefined && (
        <div
          className="page-template-toolbar no-print"
          style={{ marginBottom: 'var(--space-4, 16px)', ...toolbarStyle }}
        >
          {toolbar}
        </div>
      )}
      <StateView
        loading={loading}
        error={error}
        empty={empty}
        emptyDescription={emptyDescription}
        emptyAction={emptyAction}
        onRetry={onRetry}
        minHeight={minStateHeight}
        skeletonRows={skeletonRows}
      >
        {children}
      </StateView>
    </>
  );

  if (!container) {
    return (
      <div data-testid={testId} className={className} style={style}>
        {body}
      </div>
    );
  }

  return (
    <PageContainer
      background={background}
      maxWidth={maxWidth}
      padding={padding}
      minHeight={minHeight}
      fabPadding={fabPadding}
      className={className}
      testId={testId}
      style={style}
    >
      {body}
    </PageContainer>
  );
}

export default PageTemplate;
