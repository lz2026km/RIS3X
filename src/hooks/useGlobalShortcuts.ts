/**
 * [W14-UX] useGlobalShortcuts - 全局键盘快捷键注册中心
 * ------------------------------------------------------------------
 * - 集中登记全站快捷键 (导航序列键 g+w, 组合键 Ctrl+K, 帮助 ? / F1 ...)
 * - 自动避让输入框 (INPUT/TEXTAREA/SELECT/contentEditable), 但 F1 / ? 仍可用
 * - 与页面局部 useKeyboardShortcuts / useNavigationShortcuts 兼容:
 *   本 hook 仅在未匹配到页面局部处理时生效, 不应注册冲突组合
 * - 提供 helpOpen 状态 + 排序分组, 供 ShortcutHelpModal 渲染
 */
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export type ShortcutGroup = "navigation" | "actions" | "view" | "help";

export interface GlobalShortcutDef {
  id: string;
  /** 展示用按键字符串, 如 "Ctrl+K" / "g w" / "?" */
  keys: string;
  /** i18n key (w14Ux.shortcuts.*) */
  labelKey: string;
  group: ShortcutGroup;
  /** 组合键定义 */
  combo?: {
    key: string;
    ctrl?: boolean;
    shift?: boolean;
    alt?: boolean;
    meta?: boolean;
  };
  /** 序列键定义 (依次按, 如 ["g","w"]) */
  sequence?: string[];
  run: () => void;
}

export interface GlobalShortcutOptions {
  navigate?: (path: string) => void;
  /** Ctrl+K 全局搜索; 缺省跳转 /enterprise-search */
  onSearch?: () => void;
  /** 刷新当前页 (Ctrl+Alt+R, 避开浏览器 Ctrl+R) */
  onRefresh?: () => void;
  onToggleTheme?: () => void;
  /** 禁用整个注册中心 */
  enabled?: boolean;
}

const IGNORE_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

function isEditable(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  if (IGNORE_TAGS.includes(el.tagName)) return true;
  if (el.isContentEditable) return true;
  return false;
}

/** 构建默认全局快捷键列表 */
export function buildGlobalShortcuts(
  opts: GlobalShortcutOptions,
): GlobalShortcutDef[] {
  const go = (path: string) => () => {
    if (opts.navigate) opts.navigate(path);
    else if (typeof window !== "undefined") window.location.assign(path);
  };

  return [
    {
      id: "global-search",
      keys: "Ctrl+K",
      labelKey: "w14Ux.shortcuts.search",
      group: "actions",
      combo: { key: "k", ctrl: true },
      run: () => {
        if (opts.onSearch) opts.onSearch();
        else go("/enterprise-search")();
      },
    },
    {
      id: "go-worklist",
      keys: "g w",
      labelKey: "w14Ux.shortcuts.worklist",
      group: "navigation",
      sequence: ["g", "w"],
      run: go("/worklist"),
    },
    {
      id: "go-exams",
      keys: "g e",
      labelKey: "w14Ux.shortcuts.exams",
      group: "navigation",
      sequence: ["g", "e"],
      run: go("/exams"),
    },
    {
      id: "go-reports",
      keys: "g r",
      labelKey: "w14Ux.shortcuts.reports",
      group: "navigation",
      sequence: ["g", "r"],
      run: go("/reports"),
    },
    {
      id: "go-patients",
      keys: "g p",
      labelKey: "w14Ux.shortcuts.patients",
      group: "navigation",
      sequence: ["g", "p"],
      run: go("/patients"),
    },
    {
      id: "go-dashboard",
      keys: "g d",
      labelKey: "w14Ux.shortcuts.dashboard",
      group: "navigation",
      sequence: ["g", "d"],
      run: go("/workbench"),
    },
    {
      id: "go-appointments",
      keys: "g a",
      labelKey: "w14Ux.shortcuts.appointments",
      group: "navigation",
      sequence: ["g", "a"],
      run: go("/appointments"),
    },
    {
      id: "go-devices",
      keys: "g v",
      labelKey: "w14Ux.shortcuts.devices",
      group: "navigation",
      sequence: ["g", "v"],
      run: go("/devices"),
    },
    {
      id: "refresh",
      keys: "Ctrl+Alt+R",
      labelKey: "w14Ux.shortcuts.refresh",
      group: "actions",
      combo: { key: "r", ctrl: true, alt: true },
      run: () => {
        if (opts.onRefresh) opts.onRefresh();
      },
    },
    {
      id: "toggle-theme",
      keys: "Alt+T",
      labelKey: "w14Ux.shortcuts.theme",
      group: "view",
      combo: { key: "t", alt: true },
      run: () => opts.onToggleTheme?.(),
    },
    {
      id: "help",
      keys: "? / F1",
      labelKey: "w14Ux.shortcuts.help",
      group: "help",
      combo: { key: "?" },
      run: () => {},
    },
  ];
}

export interface UseGlobalShortcutsResult {
  shortcuts: GlobalShortcutDef[];
  helpOpen: boolean;
  setHelpOpen: (open: boolean) => void;
  openHelp: () => void;
  closeHelp: () => void;
}

export function useGlobalShortcuts(
  opts: GlobalShortcutOptions = {},
): UseGlobalShortcutsResult {
  const { enabled = true } = opts;
  const [helpOpen, setHelpOpen] = useState(false);
  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);

  const shortcuts = useMemo(
    () => buildGlobalShortcuts(opts),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      opts.navigate,
      opts.onSearch,
      opts.onRefresh,
      opts.onToggleTheme,
    ],
  );

  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    if (!enabled) return;
    let buffer: string[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;

    const clearBuffer = () => {
      buffer = [];
      if (timer) clearTimeout(timer);
    };

    const handler = (e: KeyboardEvent) => {
      const editable = isEditable(e.target);

      // 帮助: ? (Shift+/) 或 F1 — 即使在输入框也可用? 仅非输入态触发 ?, F1 始终可用
      if (e.key === "F1") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (!editable && e.key === "?") {
        e.preventDefault();
        setHelpOpen(true);
        return;
      }
      if (editable) {
        clearBuffer();
        return;
      }

      // 组合键匹配
      for (const sc of shortcutsRef.current) {
        if (!sc.combo) continue;
        const c = sc.combo;
        if (
          e.key.toLowerCase() === c.key.toLowerCase() &&
          Boolean(c.ctrl) === e.ctrlKey &&
          Boolean(c.shift) === e.shiftKey &&
          Boolean(c.alt) === e.altKey &&
          Boolean(c.meta) === e.metaKey
        ) {
          e.preventDefault();
          clearBuffer();
          sc.run();
          return;
        }
      }

      // 序列键匹配 (无修饰键)
      if (e.ctrlKey || e.altKey || e.metaKey) return;
      const key = e.key.toLowerCase();
      const seqs = shortcutsRef.current.filter((s) => s.sequence);

      // 仅当已有缓冲或以某序列首键开始时才处理, 避免吞掉普通按键
      const next = [...buffer, key];
      let matchedPartial = false;
      for (const sc of seqs) {
        const seq = sc.sequence!;
        if (seq.length < next.length) continue;
        const isPrefix = next.every((k, i) => seq[i] === k);
        if (!isPrefix) continue;
        if (next.length === seq.length) {
          e.preventDefault();
          clearBuffer();
          sc.run();
          return;
        }
        matchedPartial = true;
      }
      if (matchedPartial) {
        buffer = next;
        e.preventDefault();
        if (timer) clearTimeout(timer);
        timer = setTimeout(clearBuffer, 1000);
      } else {
        clearBuffer();
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      if (timer) clearTimeout(timer);
    };
  }, [enabled]);

  return { shortcuts, helpOpen, setHelpOpen, openHelp, closeHelp };
}

export default useGlobalShortcuts;
