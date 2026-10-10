/**
 * [W14-UX] ShortcutHelpModal - 全局快捷键帮助浮层
 * 通过 ? 或 F1 打开, 按 Esc / 点击遮罩关闭。
 */
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Keyboard, Search, X } from "lucide-react";
// [W14-UX] 使用 appI18n 的 t (命名空间 w14Ux 由 import.meta.glob 合并进 appI18n, 而非 react-i18next resources)
import { t } from "../../i18n/appI18n";
import type { GlobalShortcutDef, ShortcutGroup } from "../../hooks/useGlobalShortcuts";

export interface ShortcutHelpModalProps {
  open: boolean;
  onClose: () => void;
  shortcuts: GlobalShortcutDef[];
}

const GROUP_ORDER: ShortcutGroup[] = ["navigation", "actions", "view", "help"];
const GROUP_LABEL: Record<ShortcutGroup, string> = {
  navigation: "w14Ux.shortcuts.group.navigation",
  actions: "w14Ux.shortcuts.group.actions",
  view: "w14Ux.shortcuts.group.view",
  help: "w14Ux.shortcuts.group.help",
};

function KeyCap({ keys }: { keys: string }) {
  const parts = keys.split(/\s+/);
  return (
    <span style={{ display: "inline-flex", gap: 4, flexShrink: 0 }}>
      {parts.map((p, i) => (
        <kbd
          key={`${p}-${i}`}
          style={{
            fontFamily: "var(--font-family-mono, monospace)",
            fontSize: 12,
            fontWeight: 600,
            lineHeight: 1,
            padding: "4px 7px",
            borderRadius: 6,
            background: "var(--bg-elevated, #f1f5f9)",
            border: "1px solid var(--border-default, rgba(0,0,0,0.12))",
            borderBottomWidth: 2,
            color: "var(--text-primary, #1e293b)",
            whiteSpace: "nowrap",
          }}
        >
          {p}
        </kbd>
      ))}
    </span>
  );
}

export function ShortcutHelpModal({ open, onClose, shortcuts }: ShortcutHelpModalProps) {
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<ShortcutGroup, GlobalShortcutDef[]>();
    for (const sc of shortcuts) {
      const label = t(sc.labelKey);
      if (q && !label.toLowerCase().includes(q) && !sc.keys.toLowerCase().includes(q)) {
        continue;
      }
      const list = map.get(sc.group) ?? [];
      list.push(sc);
      map.set(sc.group, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({
      group: g,
      items: map.get(g)!,
    }));
  }, [shortcuts, query, t]);

  if (!open || typeof document === "undefined") return null;

  const overlay: CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 3000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(15,23,42,0.45)",
    padding: 16,
  };

  return createPortal(
    <div style={overlay} onClick={onClose} data-testid="shortcut-help-overlay">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("w14Ux.shortcuts.title")}
        data-testid="shortcut-help-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "min(720px, 100%)",
          maxHeight: "82vh",
          display: "flex",
          flexDirection: "column",
          background: "var(--bg-card, #ffffff)",
          color: "var(--text-primary, #1e293b)",
          borderRadius: 14,
          border: "1px solid var(--border-default, rgba(0,0,0,0.1))",
          boxShadow: "0 24px 48px rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "16px 20px",
            borderBottom: "1px solid var(--border-subtle, rgba(0,0,0,0.06))",
          }}
        >
          <Keyboard size={20} style={{ color: "var(--color-primary-600, #2563eb)" }} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{t("w14Ux.shortcuts.title")}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary, #475569)" }}>
              {t("w14Ux.shortcuts.subtitle")}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "4px 10px",
              borderRadius: 8,
              background: "var(--bg-deep, #f1f5f9)",
              border: "1px solid var(--border-default, rgba(0,0,0,0.1))",
            }}
          >
            <Search size={13} style={{ color: "var(--text-muted, #94a3b8)" }} aria-hidden="true" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("common.search")}
              aria-label={t("common.search")}
              style={{
                border: "none", background: "transparent",
                color: "inherit",
                fontSize: 13,
                width: 140,
              }}
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("w14Ux.shortcuts.close")}
            title={t("w14Ux.shortcuts.close")}
            style={{
              display: "flex",
              padding: 6,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-secondary, #475569)",
            }}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: "8px 20px 20px" }}>
          {grouped.length === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              {t("common.noData")}
            </div>
          )}
          {grouped.map(({ group, items }) => (
            <section key={group} style={{ marginTop: 16 }}>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--color-primary-600, #2563eb)",
                  marginBottom: 8,
                }}
              >
                {t(GROUP_LABEL[group])}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", rowGap: 6, columnGap: 16 }}>
                {items.map((sc) => (
                  <div key={sc.id} style={{ display: "contents" }}>
                    <span style={{ fontSize: 13, color: "var(--text-primary, #1e293b)" }}>
                      {t(sc.labelKey)}
                    </span>
                    <KeyCap keys={sc.keys} />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}

export default ShortcutHelpModal;
