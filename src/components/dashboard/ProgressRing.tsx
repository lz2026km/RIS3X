/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - ProgressRing
 * 环形进度 (SVG): 设备利用率 / 报告及时率等
 * 自动语义色: >= 85 绿 / >= 70 黄 / < 70 红 (可通过 color 覆盖)
 */
import type { CSSProperties, ReactNode } from "react";

export interface ProgressRingProps {
  /** 0-100 */
  percent: number;
  size?: number;
  strokeWidth?: number;
  /** 覆盖自动语义色 */
  color?: string;
  /** 轨道色 */
  trackColor?: string;
  /** 中心内容 (默认百分比) */
  label?: ReactNode;
  /** 中心文字下方副标签 */
  subLabel?: ReactNode;
  showPercent?: boolean;
  style?: CSSProperties;
  testId?: string;
}

function autoColor(percent: number): string {
  if (percent >= 85) return "var(--color-success-600, var(--color-success-600))";
  if (percent >= 70) return "var(--color-warning-600, var(--color-warning-600))";
  return "var(--color-error-600, var(--color-error-600))";
}

export function ProgressRing({
  percent,
  size = 96,
  strokeWidth = 10,
  color,
  trackColor = "var(--color-gray-200, #e2e8f0)",
  label,
  subLabel,
  showPercent = true,
  style,
  testId,
}: ProgressRingProps) {
  const clamped = Math.min(100, Math.max(0, percent));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);
  const ringColor = color ?? autoColor(clamped);

  return (
    <div
      data-testid={testId}
      style={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        ...style,
      }}
    >
      <div style={{ position: "relative", width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }} role="img" aria-label={`进度 ${clamped}%`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease, stroke 0.3s" }}
          />
        </svg>
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
          }}
        >
          {label ?? (
            <span
              style={{
                fontSize: size >= 100 ? 22 : 18,
                fontWeight: 700,
                color: ringColor,
                fontVariantNumeric: "tabular-nums",
                lineHeight: 1,
              }}
            >
              {showPercent ? `${Math.round(clamped)}%` : String(clamped)}
            </span>
          )}
          {subLabel && (
            <span style={{ fontSize: 11, color: "var(--text-secondary, #64748b)" }}>{subLabel}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProgressRing;
