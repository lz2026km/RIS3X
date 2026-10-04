/**
 * UI-3 — SeverityTag
 *
 * Unified clinical-severity chip built on antd <Tag> and driven by the single
 * authoritative palette in `@/theme/statusTokens`.
 *
 *   <SeverityTag level="critical" />
 *   <SeverityTag level="warning" dot />
 *   <SeverityTag tone={severityTone("high")}>高危</SeverityTag>
 *
 * Accepts the full aliased severity ladder
 * (life_threatening | critical | high | urgent | warning | info | normal ...)
 * via `normalizeSeverity`. Labels are never altered.
 */
import { Tag } from "antd";
import type { CSSProperties, MouseEvent, ReactNode } from "react";
import {
  severityTone,
  severityToAntd,
  type StatusMode,
  type StatusTone,
} from "@/theme/statusTokens";

export type SeverityTagSize = "sm" | "md";

export interface SeverityTagProps {
  /** Severity level or alias (e.g. "critical", "life_threatening", "高危"). */
  level?: string;
  /** Explicit resolved tone (overrides `level`). */
  tone?: StatusTone | null;
  /** Theme mode used to resolve the tone. */
  mode?: StatusMode;
  /** Optional leading severity dot. */
  dot?: boolean;
  /** Compact (sm, default) or slightly larger (md). */
  size?: SeverityTagSize;
  /** Use antd preset Tag color instead of the exact statusTokens palette. */
  preset?: boolean;
  /** Explicit antd color override (implies `preset`). */
  color?: string;
  /** Remove the border. */
  bordered?: boolean;
  /** Label override; defaults to `level`. */
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  title?: string;
  testId?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
}

const SIZE_MAP: Record<SeverityTagSize, CSSProperties> = {
  sm: { fontSize: 11, lineHeight: "18px", padding: "0 7px", borderRadius: 6 },
  md: { fontSize: 12, lineHeight: "20px", padding: "0 9px", borderRadius: 8 },
};

export function SeverityTag({
  level,
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
  onClick,
}: SeverityTagProps) {
  const resolved: StatusTone = tone ?? severityTone(level, mode);
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
      color={usePreset ? color ?? severityToAntd(level) : undefined}
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
      {children ?? level}
    </Tag>
  );
}

export default SeverityTag;
