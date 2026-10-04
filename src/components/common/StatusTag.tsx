/**
 * UI-3 — StatusTag
 *
 * Unified, compact workflow/status chip built on antd <Tag> and driven by the
 * single authoritative palette in `@/theme/statusTokens`.
 *
 *   <StatusTag status="resolved" />
 *   <StatusTag status="failed" dot />
 *   <StatusTag tone={statusTone("pending")}>待处理</StatusTag>
 *
 * Visual contract: small radius, tinted semantic background, matching border
 * and AA foreground. Optional leading dot. Labels are never altered — callers
 * keep exactly the text they rendered before.
 */
import { Tag } from "antd";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  statusTone,
  toneToAntd,
  type StatusMode,
  type StatusTone,
} from "@/theme/statusTokens";

export type StatusTagSize = "sm" | "md";

export interface StatusTagProps {
  /** Workflow / lifecycle status key (e.g. "resolved", "pending"). */
  status?: string;
  /** Explicit resolved tone (overrides `status`). */
  tone?: StatusTone | null;
  /** Theme mode used to resolve the tone. */
  mode?: StatusMode;
  /** Optional leading status dot. */
  dot?: boolean;
  /** Compact (sm, default) or slightly larger (md). */
  size?: StatusTagSize;
  /** Use antd preset Tag color instead of the exact statusTokens palette. */
  preset?: boolean;
  /** Explicit antd color override (implies `preset`). */
  color?: string;
  /** Remove the border. */
  bordered?: boolean;
  /** Label override; defaults to `status`. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  testId?: string;
  closable?: boolean;
  onClose?: (e: MouseEvent<HTMLElement>) => void;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

const SIZE_MAP: Record<StatusTagSize, CSSProperties> = {
  sm: { fontSize: 11, lineHeight: "18px", padding: "0 7px", borderRadius: 6 },
  md: { fontSize: 12, lineHeight: "20px", padding: "0 9px", borderRadius: 8 },
};

export function StatusTag({
  status,
  tone,
  mode = "light",
  dot = false,
  size = "sm",
  preset = false,
  color,
  bordered = true,
  children,
  className,
  style,
  title,
  testId,
  closable,
  onClose,
  onClick,
}: StatusTagProps) {
  const resolved: StatusTone = tone ?? statusTone(status, mode);
  const usePreset = preset || color != null;

  const tagStyle: CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    margin: 0,
    fontWeight: 600,
    whiteSpace: "nowrap",
    verticalAlign: "middle",
    ...SIZE_MAP[size],
    ...(usePreset
      ? {}
      : {
          background: resolved.bg,
          color: resolved.color,
          borderColor: bordered ? resolved.border : "transparent",
        }),
    ...style,
  };

  return (
    <Tag
      className={className}
      style={tagStyle}
      color={usePreset ? color ?? toneToAntd(status) : undefined}
      closable={closable}
      onClose={onClose}
      onClick={onClick}
      data-testid={testId}
      title={title}
    >
      {dot && (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: usePreset ? "currentColor" : resolved.dot,
            flexShrink: 0,
          }}
        />
      )}
      {children ?? status}
    </Tag>
  );
}

export default StatusTag;
