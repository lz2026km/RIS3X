/**
 * [W14-UX] ContextMenu - 可复用的右键上下文菜单
 * ------------------------------------------------------------------
 * - 定位于鼠标位置 (fixed), 自动避让视口边界
 * - 支持图标/危险项/禁用项/分组分隔
 * - 危险操作二次确认 (confirm 文案), 避免误删
 * - 键盘可达 (Enter/Space 触发, Esc 关闭, 上下方向键移动)
 * - 点击外部 / 滚动 / 窗口尺寸变化 / 路由变化时自动关闭
 * - createPortal 渲染到 body, 不受父级 overflow 裁剪
 *
 * 用法:
 *   const { open, menu } = useContextMenu()
 *   <tr onContextMenu={(e) => open(e, items)} />
 *   {menu}
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
// [W14-UX] 使用 appI18n 的 t (命名空间 w14Ux 合并进 appI18n)
import { t } from "../../i18n/appI18n";

export interface ContextMenuItem {
  /** 唯一 key */
  key: string;
  /** 展示文案 */
  label: ReactNode;
  /** 左侧图标 */
  icon?: ReactNode;
  /** 危险操作 (红色) */
  danger?: boolean;
  /** 禁用 */
  disabled?: boolean;
  /** 点击处理 */
  onSelect?: () => void;
  /** 二次确认文案 (点击后按钮变为此文案, 再次点击执行) */
  confirm?: string;
  /** 在此项之前插入分隔线 */
  dividerBefore?: boolean;
  /** 隐藏 */
  hidden?: boolean;
}

export interface ContextMenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

export interface ContextMenuProps {
  /** 菜单坐标 (fixed) */
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
  /** 菜单宽度, 默认 200 */
  width?: number;
  /** 额外测试 id */
  testId?: string;
}

const MENU_MAX_HEIGHT = 360;
const VIEWPORT_PAD = 8;

export function ContextMenu({
  x,
  y,
  items,
  onClose,
  width = 208,
  testId = "context-menu",
}: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [confirmKey, setConfirmKey] = useState<string | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [activeIndex, setActiveIndex] = useState(0);

  const visibleItems = useMemo(
    () => items.filter((it) => !it.hidden),
    [items],
  );

  // 计算避让视口的位置
  useLayoutEffect(() => {
    const el = ref.current;
    const w = el?.offsetWidth ?? width;
    const h = el?.offsetHeight ?? 0;
    let left = x;
    let top = y;
    if (typeof window !== "undefined") {
      if (left + w + VIEWPORT_PAD > window.innerWidth) {
        left = Math.max(VIEWPORT_PAD, window.innerWidth - w - VIEWPORT_PAD);
      }
      if (top + h + VIEWPORT_PAD > window.innerHeight) {
        top = Math.max(VIEWPORT_PAD, window.innerHeight - h - VIEWPORT_PAD);
      }
    }
    setPos({ left, top });
  }, [x, y, width, visibleItems.length]);

  // 点击外部 / Esc / 滚动 / resize 关闭
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, visibleItems.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" || e.key === " ") {
        const it = visibleItems[activeIndex];
        if (it && !it.disabled) {
          e.preventDefault();
          trigger(it);
        }
      }
    };
    const onScrollOrResize = () => onClose();
    document.addEventListener("mousedown", onDocDown, true);
    document.addEventListener("contextmenu", onDocDown, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onDocDown, true);
      document.removeEventListener("contextmenu", onDocDown, true);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [onClose, visibleItems, activeIndex, confirmKey]);

  const trigger = useCallback(
    (item: ContextMenuItem) => {
      if (item.disabled) return;
      if (item.confirm && confirmKey !== item.key) {
        setConfirmKey(item.key);
        return;
      }
      onClose();
      item.onSelect?.();
    },
    [confirmKey, onClose],
  );

  const node = (
    <div
      ref={ref}
      role="menu"
      aria-label={t("w14Ux.contextMenu.label")}
      data-testid={testId}
      style={{
        position: "fixed",
        left: pos.left,
        top: pos.top,
        minWidth: width,
        maxHeight: MENU_MAX_HEIGHT,
        overflowY: "auto",
        zIndex: 2000,
        background: "var(--bg-card, #ffffff)",
        border: "1px solid var(--border-default, rgba(0,0,0,0.1))",
        borderRadius: 8,
        boxShadow: "var(--shadow-lg, 0 8px 16px rgba(0,0,0,0.12))",
        padding: 'var(--space-1, 4px)',
      }}
    >
      {visibleItems.map((item, idx) => {
        const isConfirm = confirmKey === item.key;
        return (
          <div key={item.key}>
            {item.dividerBefore && (
              <div
                role="separator"
                style={{
                  height: 1,
                  margin: "4px 6px",
                  background: "var(--border-subtle, rgba(0,0,0,0.06))",
                }}
              />
            )}
            <button
              type="button"
              role="menuitem"
              disabled={item.disabled}
              aria-label={typeof item.label === "string" ? item.label : undefined}
              onMouseEnter={() => setActiveIndex(idx)}
              onClick={() => trigger(item)}
              onMouseLeave={() => {
                if (isConfirm) setConfirmKey(null);
              }}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 'var(--space-2, 8px)',
                padding: "7px 10px",
                borderRadius: 6,
                border: "none",
                background:
                  isConfirm
                    ? "var(--color-error-bg, #fef2f2)"
                    : idx === activeIndex
                      ? "var(--bg-hover, rgba(0,0,0,0.04))"
                      : "transparent",
                color: item.disabled
                  ? "var(--text-muted, #94a3b8)"
                  : item.danger || isConfirm
                    ? "var(--color-error, var(--color-error-600))"
                    : "var(--text-primary, #1e293b)",
                fontSize: 12,
                fontWeight: isConfirm ? 600 : 500,
                cursor: item.disabled ? "not-allowed" : "pointer",
                textAlign: "left",
              }}
            >
              {item.icon && (
                <span style={{ display: "inline-flex", flexShrink: 0 }}>
                  {item.icon}
                </span>
              )}
              <span style={{ flex: 1, whiteSpace: "nowrap" }}>
                {isConfirm ? item.confirm : item.label}
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );

  if (typeof document === "undefined") return node;
  return createPortal(node, document.body);
}

export interface UseContextMenuResult {
  /** 在事件上打开菜单 */
  open: (
    e: { clientX: number; clientY: number; preventDefault?: () => void },
    items: ContextMenuItem[],
  ) => void;
  close: () => void;
  isOpen: boolean;
  /** 渲染此节点 (portal) */
  menu: ReactNode;
}

/**
 * 右键菜单 hook: 返回 open/close 与待渲染的菜单节点。
 */
export function useContextMenu(testId?: string): UseContextMenuResult {
  const [state, setState] = useState<ContextMenuState | null>(null);

  const open = useCallback(
    (
      e: { clientX: number; clientY: number; preventDefault?: () => void },
      items: ContextMenuItem[],
    ) => {
      e.preventDefault?.();
      const visible = items.filter((it) => !it.hidden);
      if (visible.length === 0) return;
      setState({ x: e.clientX, y: e.clientY, items });
    },
    [],
  );

  const close = useCallback(() => setState(null), []);

  const menu = state
    ? (
        <ContextMenu
          x={state.x}
          y={state.y}
          items={state.items}
          onClose={close}
          testId={testId}
        />
      )
    : null;

  return { open, close, isOpen: Boolean(state), menu };
}

/**
 * 全局右键菜单上下文: 允许任意位置打开同一菜单实例。
 */
interface ContextMenuContextValue {
  open: UseContextMenuResult["open"];
  close: UseContextMenuResult["close"];
}

const ContextMenuContext = createContext<ContextMenuContextValue | null>(null);

export function useContextMenuGlobal(): ContextMenuContextValue {
  const ctx = useContext(ContextMenuContext);
  if (!ctx) throw new Error("useContextMenuGlobal 必须在 ContextMenuProvider 内使用");
  return ctx;
}

export function ContextMenuProvider({ children }: { children: ReactNode }) {
  const { open, close, menu } = useContextMenu();
  const value = useMemo(() => ({ open, close }), [open, close]);
  return (
    <ContextMenuContext.Provider value={value}>
      {children}
      {menu}
    </ContextMenuContext.Provider>
  );
}

export default ContextMenu;
