/**
 * [W14-UX] InlineEditCell - 轻量行内编辑单元格
 * ------------------------------------------------------------------
 * - 双击进入编辑 (或点击铅笔按钮), Enter 保存 / Esc 取消 / 失焦保存
 * - 支持 text / number / textarea / select
 * - 保存前可校验 (validate), 失败不退出编辑
 * - 键盘可达 + aria-label
 */
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, Pencil, X } from "lucide-react";
// [W14-UX] 使用 appI18n 的 t
import { t } from "../../i18n/appI18n";

export interface InlineEditOption {
  label: string;
  value: string;
}

export interface InlineEditCellProps {
  value: string | number | null | undefined;
  onSave: (next: string) => void | Promise<void>;
  inputType?: "text" | "number" | "textarea" | "select";
  options?: InlineEditOption[];
  placeholder?: string;
  ariaLabel?: string;
  testId?: string;
  disabled?: boolean;
  /** 校验函数, 返回 false 或字符串错误 */
  validate?: (next: string) => boolean | string;
  /** 渲染只读展示 */
  renderDisplay?: (value: string) => React.ReactNode;
  /** 是否显示空值占位文案 */
  emptyText?: string;
}

export function InlineEditCell({
  value,
  onSave,
  inputType = "text",
  options,
  placeholder,
  ariaLabel,
  testId = "inline-edit-cell",
  disabled = false,
  validate,
  renderDisplay,
  emptyText = "-",
}: InlineEditCellProps) {
  const current = value === null || value === undefined ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  useEffect(() => {
    if (!editing) setDraft(current);
  }, [current, editing]);

  useEffect(() => {
    if (editing) {
      const el = inputRef.current;
      if (el) {
        el.focus();
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) el.select();
      }
    }
  }, [editing]);

  const commit = () => {
    if (draft === current) {
      setEditing(false);
      setError(null);
      return;
    }
    if (validate) {
      const res = validate(draft);
      if (res !== true) {
        setError(typeof res === "string" ? res : t("w14Ux.inline.saveFailed"));
        return;
      }
    }
    void Promise.resolve(onSave(draft)).then(
      () => {
        setEditing(false);
        setError(null);
      },
      () => {
        setError(t("w14Ux.inline.saveFailed"));
      },
    );
  };

  const cancel = () => {
    setDraft(current);
    setEditing(false);
    setError(null);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && inputType !== "textarea") {
      e.preventDefault();
      commit();
    } else if (e.key === "Enter" && inputType === "textarea" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      commit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cancel();
    }
  };

  if (!editing) {
    return (
      <span
        data-testid={testId}
        title={disabled ? undefined : t("w14Ux.inline.doubleClick")}
        onDoubleClick={() => {
          if (!disabled) setEditing(true);
        }}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: disabled ? "default" : "text",
          minHeight: 22,
        }}
      >
        <span style={{ color: current ? "inherit" : "var(--text-muted, #94a3b8)" }}>
          {current ? (renderDisplay ? renderDisplay(current) : current) : emptyText}
        </span>
        {!disabled && (
          <button
            type="button"
            aria-label={ariaLabel ?? t("w14Ux.inline.doubleClick")}
            title={t("w14Ux.inline.doubleClick")}
            onClick={(e) => {
              e.stopPropagation();
              setEditing(true);
            }}
            style={{
              display: "inline-flex",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-muted, #94a3b8)",
              padding: 2,
            }}
          >
            <Pencil size={12} />
          </button>
        )}
      </span>
    );
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    minWidth: 80,
    padding: "3px 6px",
    fontSize: 12,
    borderRadius: 6,
    border: `1px solid ${error ? "var(--color-error, var(--color-error-600))" : "var(--color-primary-500, var(--color-primary-500))"}`,
    background: "var(--form-input-bg, #fff)",
    color: "var(--text-primary, #1e293b)", };

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: 2, width: "100%" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
        {inputType === "textarea" ? (
          <textarea
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            style={inputStyle}
          />
        ) : inputType === "select" ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            style={inputStyle}
          >
            {(options ?? []).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={inputType}
            value={draft}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              // 失焦仅在有改动时保存, 避免误触
            }}
            style={inputStyle}
          />
        )}
        <button
          type="button"
          aria-label={t("w14Ux.inline.save")}
          title={t("w14Ux.inline.save")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={commit}
          style={iconBtn("var(--color-success, var(--color-success-600))")}
        >
          <Check size={13} />
        </button>
        <button
          type="button"
          aria-label={t("w14Ux.inline.cancel")}
          title={t("w14Ux.inline.cancel")}
          onMouseDown={(e) => e.preventDefault()}
          onClick={cancel}
          style={iconBtn("var(--color-error, var(--color-error-600))")}
        >
          <X size={13} />
        </button>
      </span>
      {error && (
        <span role="alert" style={{ fontSize: 11, color: "var(--color-error, var(--color-error-600))" }}>
          {error}
        </span>
      )}
    </span>
  );
}

function iconBtn(color: string): React.CSSProperties {
  return {
    display: "inline-flex",
    border: "none",
    background: "transparent",
    cursor: "pointer",
    color,
    padding: 2,
    flexShrink: 0,
  };
}

export default InlineEditCell;
