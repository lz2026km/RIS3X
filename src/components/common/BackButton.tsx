/**
 * G005 RIS v3.0.6.8-26 - BackButton 组件
 *
 * 统一返回按钮 (navigate(-1) + aria-label + 多种 variant)
 */
import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, X } from "lucide-react";

export type BackButtonVariant = "back" | "close";
export type BackButtonSize = "small" | "middle" | "large";

export interface BackButtonProps {
  to?: string;
  variant?: BackButtonVariant;
  size?: BackButtonSize;
  label?: string;
  disabled?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
  style?: React.CSSProperties;
}

export function BackButton({
  to,
  variant = "back",
  size = "middle",
  label,
  disabled,
  onClick,
  ariaLabel,
  style,
}: BackButtonProps) {
  const navigate = useNavigate();
  const handle = () => {
    if (onClick) onClick();
    else if (to) navigate(to);
    else navigate(-1);
  };
  const padding = size === "small" ? "4px 10px" : size === "large" ? "8px 18px" : "6px 12px";
  const fontSize = size === "small" ? 12 : size === "large" ? 14 : 13;
  const iconSize = size === "small" ? 14 : size === "large" ? 18 : 16;
  const Icon = variant === "back" ? ArrowLeft : X;
  const text = label || (variant === "back" ? "返回" : "关闭");

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={handle}
      aria-label={ariaLabel || text}
      style={{
        padding,
        fontSize,
        fontWeight: 600,
        background: "var(--bg-card, #fff)",
        color: "#475569",
        border: "1px solid #cbd5e1",
        borderRadius: 6,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "#f1f5f9";
        e.currentTarget.style.borderColor = "#94a3b8";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#fff";
        e.currentTarget.style.borderColor = "#cbd5e1";
      }}
    >
      <Icon size={iconSize} />
      {text}
    </button>
  );
}

export default BackButton;