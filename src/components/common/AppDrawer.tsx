import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type CSSProperties,
} from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "@/a11y/SkipLink";

export type DrawerPlacement = "left" | "right" | "top" | "bottom";

export interface AppDrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  placement?: DrawerPlacement;
  width?: number | string;
  height?: number | string;
  closeOnMaskClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  fullScreenOnMobile?: boolean;
  zIndex?: number;
  testId?: string;
  headerStyle?: CSSProperties;
  contentStyle?: CSSProperties;
  /** [v3.0.6.11-103 Wave 7] 统一宽度三档: sm=480 / md=720 / lg=960 */
  size?: "sm" | "md" | "lg";
}

const DEFAULT_WIDTH = 480;
const DEFAULT_HEIGHT = 360;
const MOBILE_BREAKPOINT = 768;
const Z_DRAWER = "var(--z-modal, 500)";

/** [v3.0.6.11-103 Wave 7] 统一宽度三档: 480 / 720 / 960 */
const SIZE_WIDTH: Record<NonNullable<AppDrawerProps["size"]>, number> = {
  sm: 480,
  md: 720,
  lg: 960,
};

const useIsMobile = (): boolean => {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    if (mql.addEventListener) mql.addEventListener("change", handler);
    else mql.addListener(handler);
    return () => {
      if (mql.removeEventListener) mql.removeEventListener("change", handler);
      else mql.removeListener(handler);
    };
  }, []);
  return isMobile;
};

export function AppDrawer({
  open,
  onClose,
  title,
  children,
  footer,
  placement = "right",
  width,
  height = DEFAULT_HEIGHT,
  closeOnMaskClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  fullScreenOnMobile = true,
  zIndex,
  testId,
  headerStyle,
  contentStyle,
  size,
}: AppDrawerProps) {
  const containerRef = useFocusTrap(open);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const isMobile = useIsMobile();
  const isFullScreen = fullScreenOnMobile && isMobile;
  const resolvedWidth = width ?? (size ? SIZE_WIDTH[size] : DEFAULT_WIDTH);

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
    background: "rgba(15, 23, 42, 0.45)",
    zIndex: zIndex ?? Z_DRAWER,
    animation: "appDrawerFadeIn 0.15s ease-out",
  };

  const horizontal: "left" | "right" = placement === "left" ? "left" : "right";
  const vertical: "top" | "bottom" = placement === "top" ? "top" : "bottom";

  const panelBase: CSSProperties = {
    position: "fixed",
    background: "var(--bg-card)",
    boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    // [G005 放射流程P0] 面板须高于遮罩层, 否则点击被 overlay 拦截
    zIndex: zIndex ? zIndex + 1 : "calc(var(--z-modal, 500) + 1)",
  };

  let panelStyle: CSSProperties;
  if (isFullScreen) {
    panelStyle = { ...panelBase, inset: 0, width: "100vw", height: "100vh" };
  } else if (placement === "left" || placement === "right") {
    const w = typeof resolvedWidth === "number" ? Math.min(resolvedWidth, 1000) : resolvedWidth;
    panelStyle = {
      ...panelBase,
      top: 0,
      bottom: 0,
      [horizontal]: 0,
      width: w,
      maxWidth: "100vw",
      animation: `appDrawerSlideIn${horizontal === "right" ? "Right" : "Left"} 0.22s ease-out`,
    };
  } else {
    const h = typeof height === "number" ? Math.min(height, 800) : height;
    panelStyle = {
      ...panelBase,
      left: 0,
      right: 0,
      [vertical]: 0,
      height: h,
      maxHeight: "100vh",
      animation: `appDrawerSlideIn${vertical === "top" ? "Top" : "Bottom"} 0.22s ease-out`,
    };
  }

  return (
    <>
      <div
        style={overlayStyle}
        onClick={handleMaskClick}
        data-testid={testId ? `${testId}-overlay` : "app-drawer-overlay"}
        aria-hidden="true"
      />
      <aside
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "app-drawer-title" : undefined}
        tabIndex={-1}
        style={panelStyle}
        onClick={handleContentClick}
        data-testid={testId ?? "app-drawer"}
      >
        {title !== undefined && title !== null && (
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 12,
              ...headerStyle,
            }}
          >
            <div
              id="app-drawer-title"
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1e293b",
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {title}
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
                  border: "1px solid var(--border-color)",
                  background: "var(--bg-card)",
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
          style={{ flex: 1, overflowY: "auto", padding: 20, ...contentStyle }}
        >
          {children}
        </div>
        {footer !== undefined && footer !== null && (
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
        )}
      </aside>
      <style>{`
        @keyframes appDrawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes appDrawerSlideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes appDrawerSlideInLeft  { from { transform: translateX(-100%); } to { transform: translateX(0); } }
        @keyframes appDrawerSlideInTop    { from { transform: translateY(-100%); } to { transform: translateY(0); } }
        @keyframes appDrawerSlideInBottom { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
    </>
  );
}

export default AppDrawer;
