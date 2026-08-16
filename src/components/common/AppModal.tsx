import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/a11y/SkipLink";
import { ActionButton } from "./ActionButton";

export interface AppModalProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  width?: number | string;
  icon?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  headerBg?: string;
  headerColor?: string;
  closeOnMaskClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  destroyOnHidden?: boolean;
  className?: string;
  contentStyle?: CSSProperties;
  zIndex?: number;
  /** 统一宽度四档: sm=420 / md=560 / lg=720 / xl=960 */
  size?: "sm" | "md" | "lg" | "xl";
  testId?: string;
  /* ---- [v3.0.6.11-103 Wave 7] footer 标准按钮预设 (footer 未传时生效) ---- */
  /** 确认按钮文案 (默认 "确认") */
  confirmText?: string;
  /** 取消按钮文案 (默认 "取消") */
  cancelText?: string;
  /** 确认回调 (标准 footer: 取消 + 确认) */
  onOk?: () => void;
  /** 取消回调 (默认走 onClose) */
  onCancel?: () => void;
  /** 确认按钮加载态 */
  okLoading?: boolean;
  /** 确认按钮禁用 */
  okDisabled?: boolean;
  /** 危险确认 (确认按钮变 danger variant) */
  danger?: boolean;
}

/** [v3.0.6.11-103 Wave 7] 统一宽度四档: 420 / 560 / 720 / 960 */
const SIZE_WIDTH: Record<NonNullable<AppModalProps["size"]>, number> = {
  sm: 420,
  md: 560,
  lg: 720,
  xl: 960,
};

const Z_MODAL = "var(--z-modal, 500)";

export function AppModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width,
  icon,
  iconBg,
  iconColor,
  headerBg,
  headerColor,
  closeOnMaskClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  destroyOnHidden = false,
  className,
  contentStyle,
  zIndex,
  size = "md",
  testId,
  confirmText = "确认",
  cancelText = "取消",
  onOk,
  onCancel,
  okLoading = false,
  okDisabled = false,
  danger = false,
}: AppModalProps) {
  const containerRef = useFocusTrap(open);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const resolvedWidth = width ?? SIZE_WIDTH[size];

  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    restoreFocusRef.current = document.activeElement as HTMLElement | null;

    if (!closeOnEsc) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      if (
        restoreFocusRef.current &&
        typeof restoreFocusRef.current.focus === "function"
      ) {
        try {
          restoreFocusRef.current.focus();
        } catch {
          /* noop */
        }
      }
    };
  }, [open, closeOnEsc, onClose]);

  useEffect(() => {
    if (!open) return;
    if (typeof document === "undefined") return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open && destroyOnHidden) return null;
  if (!open) return null;

  const handleMaskClick = () => {
    if (closeOnMaskClick) onClose();
  };
  const handleContentClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const overlayStyle: CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(15, 23, 42, 0.55)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: zIndex ?? Z_MODAL,
    padding: 16,
    animation: "appModalFadeIn 0.15s ease-out",
  };

  const panelStyle: CSSProperties = {
    background: "var(--bg-card)",
    borderRadius: 14,
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    width:
      typeof resolvedWidth === "number"
        ? Math.min(resolvedWidth, 1000)
        : resolvedWidth,
    maxWidth: "calc(100vw - 32px)",
    maxHeight: "calc(100vh - 32px)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    animation: "appModalScaleIn 0.18s ease-out",
  };

  const headerBgResolved = headerBg ?? (iconBg ? iconBg : "var(--bg-card)");
  const headerColorResolved =
    headerColor ?? (iconColor ? iconColor : "#1e293b");

  return (
    <>
      <div
        style={overlayStyle}
        onClick={handleMaskClick}
        data-testid={testId ? `${testId}-overlay` : "app-modal-overlay"}
      >
        <div
          ref={containerRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "app-modal-title" : undefined}
          tabIndex={-1}
          className={className}
          style={panelStyle}
          onClick={handleContentClick}
          data-testid={testId ?? "app-modal"}
        >
          {title !== undefined && title !== null && (
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border-color)",
                background: headerBgResolved,
                color: headerColorResolved,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  minWidth: 0,
                }}
              >
                {icon && (
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: iconBg ?? "rgba(255,255,255,0.18)",
                      color: iconColor ?? "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {icon}
                  </div>
                )}
                <div style={{ minWidth: 0 }}>
                  <div
                    id="app-modal-title"
                    style={{
                      fontSize: 15,
                      fontWeight: 700,
                      color: headerColorResolved,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {title}
                  </div>
                  {subtitle !== undefined && subtitle !== null && (
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.8,
                        marginTop: 2,
                        color: headerColorResolved,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {subtitle}
                    </div>
                  )}
                </div>
              </div>
              {showCloseButton && (
                <button
                  type="button"
                  aria-label="关闭"
                  onClick={onClose}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 8,
                    border: "1px solid rgba(0,0,0,0.08)",
                    background: "rgba(255,255,255,0.6)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#64748b",
                    flexShrink: 0,
                  }}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          )}
          <div
            style={{
              padding: 20,
              overflowY: "auto",
              flex: 1,
              ...contentStyle,
            }}
          >
            {children}
          </div>
          {footer !== undefined && footer !== null ? (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              {footer}
            </div>
          ) : onOk ? (
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border-color)",
                background: "var(--bg-primary)",
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
              }}
            >
              <ActionButton
                action="cancel"
                onClick={onCancel ?? onClose}
                data-testid={testId ? `${testId}-footer-cancel` : undefined}
              >
                {cancelText}
              </ActionButton>
              <ActionButton
                action={danger ? "delete" : "submit"}
                variant={danger ? "danger" : "primary"}
                loading={okLoading}
                disabled={okDisabled}
                onClick={onOk}
                data-testid={testId ? `${testId}-footer-ok` : undefined}
              >
                {confirmText}
              </ActionButton>
            </div>
          ) : null}
        </div>
      </div>
      <style>{`
        @keyframes appModalFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes appModalScaleIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }
      `}</style>
    </>
  );
}

export default AppModal;
