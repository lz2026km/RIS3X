/**
 * v3.0.6.8-23c: 按 Esc 关闭 + FocusTrap (useFocusTrap from @/a11y/SkipLink) 命令面板
 * G005 Radiology RIS System v3.0.0
 *
 * Modal overlay that lets users search and execute all available
 * keyboard shortcuts / commands. Styled to match existing app patterns.
 */

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "@/a11y/SkipLink";
import {
  Command,
  Save,
  SendHorizonal,
  Undo2,
  Redo2,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Search,
  Maximize2,
  PanelLeft,
  PanelRight,
  Hash,
  FileText,
  Sparkles,
  Printer,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  SHORTCUT_LIST,
  SHORTCUT_GROUPS,
  formatShortcut,
  type ShortcutDef,
} from "../../config/shortcuts";

// ---- Icon map for each action ----
const ACTION_ICONS: Record<string, LucideIcon> = {
  bold: Bold,
  italic: Italic,
  underline: Underline,
  strikethrough: Strikethrough,
  undo: Undo2,
  redo: Redo2,
  save: Save,
  submit: SendHorizonal,
  openCommandPalette: Command,
  findReplace: Search,
  fullscreen: Maximize2,
  toggleLeftPanel: PanelLeft,
  toggleRightPanel: PanelRight,
  switchToMeasurements: Hash,
  switchToTemplates: FileText,
  switchToAiAssist: Sparkles,
  printPreview: Printer,
  focusSearch: Search,
};

// ---- Props ----
export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  /** Map of action name -> handler. Only commands with handlers show up. */
  handlers?: Record<string, () => void>;
}

/**
 * Command Palette modal
 */
export function CommandPalette({
  open,
  onClose,
  handlers = {},
}: CommandPaletteProps) {
  const { i18n } = useTranslation();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const containerRef = useFocusTrap(open);

  const isZh = i18n.language?.startsWith("zh");

  // Filter commands that have a handler and match query
  const filtered = useMemo(() => {
    const list = SHORTCUT_LIST.filter((s) => handlers[s.action]);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter(
      (s) =>
        s.action.toLowerCase().includes(q) ||
        s.descriptionZh.toLowerCase().includes(q) ||
        s.descriptionEn.toLowerCase().includes(q) ||
        formatShortcut(s).toLowerCase().includes(q),
    );
  }, [query, handlers]);

  // Reset state when opening
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Keyboard navigation within the palette
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex(
          (i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1),
        );
        return;
      }
      if (e.key === "Enter" && filtered[selectedIndex]) {
        e.preventDefault();
        const action = filtered[selectedIndex].action;
        handlers[action]?.();
        onClose();
        return;
      }
    },
    [filtered, selectedIndex, handlers, onClose],
  );

  const executeCommand = useCallback(
    (action: string) => {
      handlers[action]?.();
      onClose();
    },
    [handlers, onClose],
  );

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, ShortcutDef[]>>((acc, s) => {
    (acc[s.group] ??= []).push(s);
    return acc;
  }, {});

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
        zIndex: 'var(--z-overlay)' as unknown as number,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={isZh ? "命令面板" : "Command Palette"}
    >
      <div
        ref={containerRef}
        style={{
          background: "var(--bg-card)",
          borderRadius: 12,
          width: 560,
          maxWidth: "90vw",
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
          animation: "cmdPaletteIn 0.12s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* ---- Search Input ---- */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 16px",
            borderBottom: "1px solid #e2e8f0",
          }}
        >
          <Command size={18} style={{ color: "#94a3b8", flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={isZh ? "搜索命令..." : "Search commands..."}
            aria-label={isZh ? "搜索命令" : "Search commands"}
            style={{
              flex: 1,
              border: "none",
              fontSize: 15,
              background: "transparent",
              color: "#1e293b",
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#94a3b8",
                padding: 2,
                display: "flex",
              }}
              aria-label={isZh ? "清除" : "Clear"}
            >
              <X size={16} />
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94a3b8",
              padding: 4,
              display: "flex",
              borderRadius: 4,
              flexShrink: 0,
            }}
            aria-label={isZh ? "关闭" : "Close"}
          >
            <X size={18} />
          </button>
        </div>

        {/* ---- Results List ---- */}
        <div
          ref={listRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "8px 0",
          }}
        >
          {filtered.length === 0 && (
            <div
              style={{
                textAlign: "center",
                color: "#94a3b8",
                padding: "32px 16px",
                fontSize: 14,
              }}
            >
              {isZh ? "没有匹配的命令" : "No matching commands"}
            </div>
          )}

          {Object.entries(grouped).map(([group, items]) => (
            <div key={group}>
              <div
                style={{
                  padding: "6px 16px 4px",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#94a3b8",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {isZh
                  ? SHORTCUT_GROUPS[group]?.labelZh
                  : SHORTCUT_GROUPS[group]?.labelEn}
              </div>
              {items.map((shortcut) => {
                const globalIdx = filtered.indexOf(shortcut);
                const isSelected = globalIdx === selectedIndex;
                const IconComp = ACTION_ICONS[shortcut.action] || Command;
                return (
                  <div
                    key={shortcut.action}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => executeCommand(shortcut.action)}
                    onMouseEnter={() => setSelectedIndex(globalIdx)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 12,
                      padding: "8px 16px",
                      cursor: "pointer",
                      background: isSelected ? "#f1f5f9" : "transparent",
                      transition: "background 0.1s",
                    }}
                  >
                    <IconComp
                      size={16}
                      style={{
                        color: isSelected ? "#3b82f6" : "#64748b",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 14,
                        color: "#1e293b",
                      }}
                    >
                      {isZh ? shortcut.descriptionZh : shortcut.descriptionEn}
                    </span>
                    <kbd
                      style={{
                        fontSize: 12,
                        padding: "2px 6px",
                        borderRadius: 4,
                        background: "var(--bg-primary)",
                        color: "#64748b",
                        border: "1px solid var(--border-color)",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatShortcut(shortcut)}
                    </kbd>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        {/* ---- Footer hint ---- */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid #e2e8f0",
            display: "flex",
            gap: 16,
            fontSize: 12,
            color: "#94a3b8",
          }}
        >
          <span>
            <kbd style={kbdStyle}>{'\u2191'}</kbd>{' '}
            <kbd style={kbdStyle}>{'\u2193'}</kbd>{' '}
            {isZh ? "导航" : "Navigate"}
          </span>
          <span>
            <kbd style={kbdStyle}>Enter</kbd> {isZh ? "执行" : "Execute"}
          </span>
          <span>
            <kbd style={kbdStyle}>Esc</kbd> {isZh ? "关闭" : "Close"}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes cmdPaletteIn {
          from { transform: translateY(-10px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const kbdStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 18,
  height: 18,
  padding: "0 4px",
  borderRadius: 3,
  background: "var(--bg-primary)",
  border: "1px solid var(--border-color)",
  fontFamily: "inherit",
  fontSize: 12,
  color: "#64748b",
  lineHeight: 1,
};

export default CommandPalette;