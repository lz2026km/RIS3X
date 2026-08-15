/**
 * G005 放射RIS系统 v3.0.6.11-100 Wave 5A - EmptyState
 * UI 组件化: 统一空状态 (Inbox 48 + opacity 0.4 + 中文描述)
 */
import { Inbox } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

export interface EmptyStateProps {
  icon?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  style?: CSSProperties;
  testId?: string;
}

export function EmptyState({
  icon,
  description = "暂无数据",
  action,
  style,
  testId,
}: EmptyStateProps) {
  return (
    <div
      data-testid={testId}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 16px",
        gap: 12,
        textAlign: "center",
        ...style,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: 0.4,
          color: "var(--text-secondary, #475569)",
        }}
      >
        {icon ?? <Inbox size={48} strokeWidth={1.5} />}
      </div>
      <div
        style={{
          fontSize: 13,
          color: "var(--text-secondary, #475569)",
          maxWidth: 320,
          lineHeight: 1.5,
        }}
      >
        {description}
      </div>
      {action && <div style={{ marginTop: 4 }}>{action}</div>}
    </div>
  );
}

export default EmptyState;
