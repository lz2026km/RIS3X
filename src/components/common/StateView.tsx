/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 7 - StateView
 * 三态组件: loading (Skeleton) / error (重试按钮) / empty (EmptyState) 统一切换
 *
 * 用法:
 *   <StateView loading={loading} error={error} empty={!data.length}
 *     onRetry={reload} emptyDescription="暂无检查数据">
 *     <Table ... />
 *   </StateView>
 */
import { Skeleton, Alert } from "antd";
import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { AppButton } from "./AppButton";
import { EmptyState } from "./EmptyState";

export interface StateViewProps {
  /** 加载中 → Skeleton */
  loading?: boolean;
  /** 错误文案 → Alert + 重试按钮 */
  error?: string | null;
  /** 空态 → EmptyState */
  empty?: boolean;
  emptyIcon?: ReactNode;
  emptyDescription?: ReactNode;
  emptyAction?: ReactNode;
  /** 错误/加载占位最小高度 */
  minHeight?: number;
  /** 加载骨架行数 */
  skeletonRows?: number;
  /** 重试回调 */
  onRetry?: () => void;
  retryText?: string;
  children?: ReactNode;
}

export function StateView({
  loading = false,
  error,
  empty = false,
  emptyIcon,
  emptyDescription,
  emptyAction,
  minHeight = 240,
  skeletonRows = 4,
  onRetry,
  retryText = "重试",
  children,
}: StateViewProps) {
  if (loading) {
    return (
      <div
        style={{
          minHeight,
          padding: "24px 16px",
          background: "var(--bg-card)",
          borderRadius: 12,
          border: "1px solid var(--border-color)",
        }}
        role="status"
        aria-label="加载中"
        data-testid="state-view-loading"
      >
        <Skeleton active paragraph={{ rows: skeletonRows }} />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          minHeight,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 14,
          padding: 24,
        }}
        data-testid="state-view-error"
      >
        <Alert
          type="error"
          showIcon
          message={error}
          style={{ maxWidth: 480, width: "100%" }}
        />
        {onRetry && (
          <AppButton
            variant="default"
            icon={<RefreshCw size={16} />}
            onClick={onRetry}
          >
            {retryText}
          </AppButton>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <EmptyState
        icon={emptyIcon}
        description={emptyDescription}
        action={emptyAction}
        style={{ minHeight }}
      />
    );
  }

  return <>{children}</>;
}

export default StateView;
