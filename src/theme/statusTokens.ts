/**
 * UI-1 — Single authoritative severity / status color source.
 *
 * Enterprise medical high-density design language:
 *   - One canonical semantic palette (light + dark) for critical values,
 *     severity levels and generic workflow statuses.
 *   - Framework-agnostic: plain objects only, no antd / React imports, so
 *     pages, components and non-React code can all consume it.
 *   - Replaces the 20+ ad-hoc local `SEVERITY_COLOR` / `STATUS_COLORS` maps
 *     that drifted apart. Migration is opt-in; this module is additive.
 *
 * Usage:
 *   import { statusColor, severityColor, toneToAntd } from "@/theme/statusTokens";
 *   <Tag color={toneToAntd(exam.status)}>{label}</Tag>
 *   <span style={{ color: statusColor(exam.status, "dark") }} />
 */

export type StatusMode = "light" | "dark";

/** A fully-resolved status chip: background, border, foreground text and dot. */
export interface StatusTone {
  /** Tinted background for banners / chips. */
  bg: string;
  /** Border color matching the tone. */
  border: string;
  /** Foreground / text color (meets AA on the tinted bg). */
  color: string;
  /** Solid accent used for dots, bars and indicators. */
  dot: string;
}

/** Canonical severity ladder (critical-value / RADS style). */
export type SeverityLevel =
  | "life_threatening"
  | "critical"
  | "high"
  | "urgent"
  | "warning"
  | "info"
  | "normal"
  | "success"
  | "neutral";

/** Ordered from most to least severe (useful for sorting / legends). */
export const SEVERITY_LEVELS: readonly SeverityLevel[] = [
  "life_threatening",
  "critical",
  "high",
  "urgent",
  "warning",
  "info",
  "normal",
  "success",
  "neutral",
] as const;

/**
 * Canonical medical semantic hex values (authoritative contract).
 * These exact values are the single source of truth for severity colors.
 */
export const SEVERITY_HEX: Record<SeverityLevel, string> = {
  life_threatening: "#dc2626",
  critical: "#dc2626",
  high: "#ea580c",
  urgent: "#ea580c",
  warning: "#d97706",
  info: "#2563eb",
  normal: "#059669",
  success: "#059669",
  neutral: "#64748b",
};

function tone(color: string, bg: string, border: string): StatusTone {
  return { bg, border, color, dot: color };
}

/** Light-theme tones. */
export const SEVERITY_TONES_LIGHT: Record<SeverityLevel, StatusTone> = {
  life_threatening: tone("#dc2626", "#fef2f2", "rgba(220, 38, 38, 0.35)"),
  critical: tone("#dc2626", "#fef2f2", "rgba(220, 38, 38, 0.35)"),
  high: tone("#ea580c", "#fff7ed", "rgba(234, 88, 12, 0.35)"),
  urgent: tone("#ea580c", "#fff7ed", "rgba(234, 88, 12, 0.35)"),
  warning: tone("#d97706", "#fffbeb", "rgba(217, 119, 6, 0.35)"),
  info: tone("#2563eb", "#eff6ff", "rgba(37, 99, 235, 0.32)"),
  normal: tone("#059669", "#ecfdf5", "rgba(5, 150, 105, 0.32)"),
  success: tone("#059669", "#ecfdf5", "rgba(5, 150, 105, 0.32)"),
  neutral: tone("#64748b", "#f8fafc", "rgba(100, 116, 139, 0.28)"),
};

/** Dark-theme tones (lightened foregrounds, translucent tinted backgrounds). */
export const SEVERITY_TONES_DARK: Record<SeverityLevel, StatusTone> = {
  life_threatening: tone("#f87171", "rgba(248, 113, 113, 0.14)", "rgba(248, 113, 113, 0.42)"),
  critical: tone("#f87171", "rgba(248, 113, 113, 0.14)", "rgba(248, 113, 113, 0.42)"),
  high: tone("#fb923c", "rgba(251, 146, 60, 0.14)", "rgba(251, 146, 60, 0.42)"),
  urgent: tone("#fb923c", "rgba(251, 146, 60, 0.14)", "rgba(251, 146, 60, 0.42)"),
  warning: tone("#fbbf24", "rgba(251, 191, 36, 0.14)", "rgba(251, 191, 36, 0.42)"),
  info: tone("#60a5fa", "rgba(96, 165, 250, 0.14)", "rgba(96, 165, 250, 0.42)"),
  normal: tone("#4ade80", "rgba(74, 222, 128, 0.14)", "rgba(74, 222, 128, 0.42)"),
  success: tone("#4ade80", "rgba(74, 222, 128, 0.14)", "rgba(74, 222, 128, 0.42)"),
  neutral: tone("#94a3b8", "rgba(148, 163, 184, 0.14)", "rgba(148, 163, 184, 0.38)"),
};

/** Severity tone lookup by theme. */
export const SEVERITY_TONES: Record<StatusMode, Record<SeverityLevel, StatusTone>> = {
  light: SEVERITY_TONES_LIGHT,
  dark: SEVERITY_TONES_DARK,
};

const SEVERITY_ALIASES: Record<string, SeverityLevel> = {
  life_threatening: "life_threatening",
  lifethreatening: "life_threatening",
  life_threat: "life_threatening",
  stat: "life_threatening",
  emergency: "life_threatening",
  危及生命: "life_threatening",
  critical: "critical",
  crit: "critical",
  severe: "critical",
  危急: "critical",
  high: "high",
  high_risk: "high",
  高危: "high",
  urgent: "urgent",
  紧急: "urgent",
  warning: "warning",
  warn: "warning",
  medium: "warning",
  moderate: "warning",
  mid: "warning",
  警告: "warning",
  中危: "warning",
  info: "info",
  informational: "info",
  notice: "info",
  信息: "info",
  low: "normal",
  mild: "normal",
  normal: "normal",
  正常: "normal",
  success: "success",
  ok: "success",
  healthy: "success",
  neutral: "neutral",
  default: "neutral",
  none: "neutral",
  unknown: "neutral",
  na: "neutral",
};

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

/** Resolve an arbitrary severity label to a canonical level (fallback: neutral). */
export function normalizeSeverity(level: unknown): SeverityLevel {
  const key = normalizeKey(level);
  return SEVERITY_ALIASES[key] ?? "neutral";
}

/** Resolve an arbitrary severity label to its tone for the given theme. */
export function severityTone(level: unknown, mode: StatusMode = "light"): StatusTone {
  return SEVERITY_TONES[mode][normalizeSeverity(level)];
}

/** Canonical hex color for a severity level (defaults to light theme). */
export function severityColor(level: unknown, mode: StatusMode = "light"): string {
  return severityTone(level, mode).color;
}

/**
 * Generic workflow / lifecycle status → canonical severity level.
 * Open-ended by design: unknown statuses degrade to `neutral`.
 */
export const STATUS_LEVEL: Record<string, SeverityLevel> = {
  // pending / in-flight
  pending: "info",
  queued: "info",
  waiting: "info",
  new: "info",
  scheduled: "info",
  submitted: "info",
  processing: "info",
  in_progress: "info",
  inprogress: "info",
  active: "info",
  running: "info",
  sending: "info",
  assigned: "info",
  open: "info",
  drafting: "info",
  // resolved / success
  resolved: "success",
  completed: "success",
  complete: "success",
  done: "success",
  success: "success",
  delivered: "success",
  published: "success",
  signed: "success",
  reviewed: "success",
  approved: "success",
  passed: "success",
  verified: "success",
  // attention / warning
  warning: "warning",
  warn: "warning",
  at_risk: "warning",
  atrisk: "warning",
  on_hold: "warning",
  onhold: "warning",
  paused: "warning",
  hold: "warning",
  delayed: "warning",
  returned: "warning",
  retry: "warning",
  retrying: "warning",
  negotiating: "warning",
  // failed / critical
  rejected: "critical",
  failed: "critical",
  failure: "critical",
  error: "critical",
  overdue: "critical",
  escalated: "critical",
  breached: "critical",
  blocked: "critical",
  fatal: "critical",
  critical: "critical",
  life_threatening: "life_threatening",
  urgent: "urgent",
  high: "high",
  // closed / inactive
  draft: "neutral",
  closed: "neutral",
  archived: "neutral",
  cancelled: "neutral",
  canceled: "neutral",
  expired: "neutral",
  inactive: "neutral",
  disabled: "neutral",
  deleted: "neutral",
  suspended: "neutral",
  withdrawn: "neutral",
  obsolete: "neutral",
  unknown: "neutral",
  default: "neutral",
  neutral: "neutral",
  none: "neutral",
};

/** Resolve a generic status to its canonical severity level. */
export function statusLevel(status: unknown): SeverityLevel {
  const key = normalizeKey(status);
  if ((SEVERITY_LEVELS as readonly string[]).includes(key)) {
    return key as SeverityLevel;
  }
  return STATUS_LEVEL[key] ?? "neutral";
}

/** Resolve a generic status to a tone for the given theme. */
export function statusTone(status: unknown, mode: StatusMode = "light"): StatusTone {
  return severityTone(statusLevel(status), mode);
}

/** Canonical hex color for a generic status (defaults to light theme). */
export function statusColor(status: unknown, mode: StatusMode = "light"): string {
  return statusTone(status, mode).color;
}

function buildToneMap(mode: StatusMode): Record<string, StatusTone> {
  const out: Record<string, StatusTone> = {};
  for (const key of Object.keys(STATUS_LEVEL)) {
    out[key] = severityTone(STATUS_LEVEL[key], mode);
  }
  return out;
}

/** Ready-made generic status tones (light) for direct object access. */
export const STATUS_TONES_LIGHT: Record<string, StatusTone> = buildToneMap("light");
/** Ready-made generic status tones (dark) for direct object access. */
export const STATUS_TONES_DARK: Record<string, StatusTone> = buildToneMap("dark");
/** Generic status tones by theme. */
export const STATUS_TONES: Record<StatusMode, Record<string, StatusTone>> = {
  light: STATUS_TONES_LIGHT,
  dark: STATUS_TONES_DARK,
};

const LEVEL_TO_ANTD: Record<SeverityLevel, string> = {
  life_threatening: "red",
  critical: "red",
  high: "volcano",
  urgent: "volcano",
  warning: "orange",
  info: "blue",
  normal: "green",
  success: "green",
  neutral: "default",
};

/**
 * Map any status / severity label to an antd `<Tag color>` name.
 * Keeps Tag usage consistent without importing antd here.
 */
export function toneToAntd(status: unknown): string {
  return LEVEL_TO_ANTD[statusLevel(status)];
}

/** Explicit severity → antd Tag color (alias of toneToAntd for readability). */
export function severityToAntd(level: unknown): string {
  return LEVEL_TO_ANTD[normalizeSeverity(level)];
}

export default STATUS_TONES;
