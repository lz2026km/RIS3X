/**
 * [W14-UX] useTableColumnConfig - 表格列显隐/排序 + 命名保存视图 (per-user, localStorage)
 * ------------------------------------------------------------------
 * - 列显示/隐藏、列顺序调整, 自动持久化到 localStorage
 * - 命名视图 (列配置 + 可选 filter/sort 状态) 保存 / 应用 / 删除
 * - 与 antd Table / DataTable / ProTable 通用 (基于列 key/dataIndex 派生稳定 id)
 *
 * 用法:
 *   const col = useTableColumnConfig({
 *     columns,
 *     storageKey: 'patient-table',
 *     getTitle: (c) => c.title,
 *     alwaysVisible: ['actions'],
 *     getViewState: () => ({ search, status }),
 *     applyViewState: (s) => { setSearch(s.search); setStatus(s.status); },
 *   })
 *   <DataTable columns={col.visibleColumns} ... toolbar={col.toolbar} />
 */
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Popover, Checkbox, Button, Input, Select, Tooltip, message } from "antd";
import { ArrowDown, ArrowUp, Columns3, RotateCcw, Save, Trash2, Bookmark } from "lucide-react";
// [W14-UX] 使用 appI18n 的 t
import { t } from "../../i18n/appI18n";

export interface ColumnLike {
  key?: unknown;
  dataIndex?: unknown;
  title?: ReactNode;
  hidden?: boolean;
}

export interface SavedView {
  id: string;
  name: string;
  order: string[];
  visibility: Record<string, boolean>;
  viewState?: Record<string, unknown>;
  createdAt: number;
}

export interface UseTableColumnConfigOptions<T extends ColumnLike> {
  columns: T[];
  storageKey: string;
  getKey?: (col: T, index: number) => string;
  getTitle?: (col: T) => ReactNode;
  alwaysVisible?: string[];
  /** 读取当前页 filter/sort 状态, 用于保存到视图 */
  getViewState?: () => Record<string, unknown>;
  /** 应用视图时恢复 filter/sort */
  applyViewState?: (state: Record<string, unknown>) => void;
}

export interface UseTableColumnConfigResult<T extends ColumnLike> {
  visibleColumns: T[];
  toolbar: ReactNode;
  order: string[];
  visibility: Record<string, boolean>;
  savedViews: SavedView[];
  hiddenCount: number;
  resetColumns: () => void;
}

interface PersistShape {
  order?: string[];
  visibility?: Record<string, boolean>;
  views?: SavedView[];
}

export function columnKeyOf(
  col: ColumnLike,
  index: number,
): string {
  if (col.key !== undefined && col.key !== null && String(col.key).length > 0) {
    return String(col.key);
  }
  const di = col.dataIndex;
  if (Array.isArray(di)) return di.join(".");
  if (di !== undefined && di !== null) return String(di);
  return `__col_${index}`;
}

function readStorage(key: string): PersistShape {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistShape;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeStorage(key: string, value: PersistShape): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota / privacy mode */
  }
}

export function useTableColumnConfig<T extends ColumnLike>(
  options: UseTableColumnConfigOptions<T>,
): UseTableColumnConfigResult<T> {
  const {
    columns,
    storageKey,
    getKey = columnKeyOf,
    getTitle,
    alwaysVisible = [],
    getViewState,
    applyViewState,
  } = options;

  const keys = useMemo(
    () => columns.map((c, i) => getKey(c, i)),
    [columns, getKey],
  );
  const titleOf = useCallback(
    (key: string): ReactNode => {
      const idx = keys.indexOf(key);
      if (idx < 0) return key;
      const col = columns[idx];
      if (!col) return key;
      if (getTitle) return getTitle(col);
      return col.title ?? key;
    },
    [keys, columns, getTitle],
  );

  const [order, setOrder] = useState<string[]>(() => {
    const stored = readStorage(storageKey).order;
    if (stored && stored.length) return stored;
    return keys;
  });
  const [visibility, setVisibility] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    for (const k of keys) {
      if (alwaysVisible.includes(k)) init[k] = true;
      else init[k] = columns[keys.indexOf(k)]?.hidden ? false : true;
    }
    const stored = readStorage(storageKey).visibility;
    return stored ? { ...init, ...stored } : init;
  });
  const [savedViews, setSavedViews] = useState<SavedView[]>(
    () => readStorage(storageKey).views ?? [],
  );
  const [viewName, setViewName] = useState("");

  // 列集合变化时, 合并新列 (additive, 不丢失既有配置)
  useEffect(() => {
    setOrder((prev) => {
      const next = prev.filter((k) => keys.includes(k));
      for (const k of keys) if (!next.includes(k)) next.push(k);
      return next.length ? next : keys;
    });
    setVisibility((prev) => {
      const next = { ...prev };
      for (const k of keys) if (!(k in next)) next[k] = true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join("|")]);

  // 持久化
  useEffect(() => {
    writeStorage(storageKey, { order, visibility, views: savedViews });
  }, [storageKey, order, visibility, savedViews]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map<string, T>();
    const fallback: string[] = [];
    columns.forEach((c, i) => {
      const k = getKey(c, i);
      byKey.set(k, c);
      if (!keys.includes(k)) fallback.push(k);
    });
    const orderedKeys = [
      ...order.filter((k) => byKey.has(k)),
      ...keys.filter((k) => !order.includes(k)),
    ];
    return orderedKeys
      .filter((k) => visibility[k] !== false || alwaysVisible.includes(k))
      .map((k) => byKey.get(k))
      .filter((c): c is T => Boolean(c));
  }, [columns, keys, order, visibility, alwaysVisible, getKey]);

  const hiddenCount = useMemo(
    () => keys.filter((k) => visibility[k] === false && !alwaysVisible.includes(k)).length,
    [keys, visibility, alwaysVisible],
  );

  const move = useCallback((key: string, dir: -1 | 1) => {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      if (idx < 0) return prev;
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const a = next[idx] as string;
      const b = next[target] as string;
      next[idx] = b;
      next[target] = a;
      return next;
    });
  }, []);

  const resetColumns = useCallback(() => {
    setOrder(keys);
    const init: Record<string, boolean> = {};
    for (const k of keys) init[k] = true;
    setVisibility(init);
  }, [keys]);

  const saveView = useCallback(() => {
    const name = viewName.trim();
    if (!name) {
      message.warning(t("w14Ux.views.nameRequired"));
      return;
    }
    const view: SavedView = {
      id: `view-${Date.now()}`,
      name,
      order,
      visibility,
      viewState: getViewState?.(),
      createdAt: Date.now(),
    };
    setSavedViews((prev) => [...prev.filter((v) => v.name !== name), view]);
    setViewName("");
    message.success(t("w14Ux.views.saved", { name }));
  }, [viewName, order, visibility, getViewState, t]);

  const applyView = useCallback(
    (id: string) => {
      const view = savedViews.find((v) => v.id === id);
      if (!view) return;
      setOrder(view.order);
      setVisibility((prev) => ({ ...prev, ...view.visibility }));
      if (view.viewState && applyViewState) applyViewState(view.viewState);
    },
    [savedViews, applyViewState],
  );

  const removeView = useCallback(
    (id: string) => {
      const view = savedViews.find((v) => v.id === id);
      setSavedViews((prev) => prev.filter((v) => v.id !== id));
      if (view) message.success(t("w14Ux.views.removed", { name: view.name }));
    },
    [savedViews, t],
  );

  const columnPanel = (
    <div style={{ width: 300, maxHeight: 380, overflowY: "auto" }} data-testid="column-config-panel">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontWeight: 700, fontSize: 12 }}>{t("w14Ux.columns.title")}</span>
        <Button type="link" size="small" icon={<RotateCcw size={12} />} onClick={resetColumns}>
          {t("w14Ux.columns.reset")}
        </Button>
      </div>
      <div style={{ fontSize: 11, color: "var(--text-muted, #94a3b8)", marginBottom: 8 }}>
        {t("w14Ux.columns.dragHint")}
      </div>
      {order.map((k, i) => {
        const locked = alwaysVisible.includes(k);
        return (
          <div
            key={k}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 2px",
            }}
          >
            <Checkbox
              checked={visibility[k] !== false}
              disabled={locked}
              aria-label={String(titleOf(k) ?? k)}
              onChange={(e) =>
                setVisibility((prev) => ({ ...prev, [k]: e.target.checked }))
              }
            />
            <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary, #1e293b)" }}>
              {titleOf(k)}
            </span>
            <Tooltip title={t("w14Ux.columns.moveUp")}>
              <button
                type="button"
                aria-label={`${t("w14Ux.columns.moveUp")}: ${String(titleOf(k) ?? k)}`}
                disabled={i === 0}
                onClick={() => move(k, -1)}
                style={iconBtnStyle(i === 0)}
              >
                <ArrowUp size={13} />
              </button>
            </Tooltip>
            <Tooltip title={t("w14Ux.columns.moveDown")}>
              <button
                type="button"
                aria-label={`${t("w14Ux.columns.moveDown")}: ${String(titleOf(k) ?? k)}`}
                disabled={i === order.length - 1}
                onClick={() => move(k, 1)}
                style={iconBtnStyle(i === order.length - 1)}
              >
                <ArrowDown size={13} />
              </button>
            </Tooltip>
          </div>
        );
      })}

      <div style={{ borderTop: "1px solid var(--border-subtle, rgba(0,0,0,0.08))", marginTop: 10, paddingTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <Bookmark size={13} style={{ color: "var(--color-primary-600, #2563eb)" }} />
          <span style={{ fontWeight: 700, fontSize: 12 }}>{t("w14Ux.views.title")}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
          <Input
            size="small"
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            placeholder={t("w14Ux.views.namePlaceholder")}
            aria-label={t("w14Ux.views.namePlaceholder")}
            onPressEnter={saveView}
          />
          <Button size="small" type="primary" icon={<Save size={12} />} onClick={saveView}>
            {t("w14Ux.views.saveShort")}
          </Button>
        </div>
        {savedViews.length > 0 && (
          <Select
            size="small"
            style={{ width: "100%" }}
            placeholder={t("w14Ux.views.manage")}
            aria-label={t("w14Ux.views.manage")}
            options={savedViews.map((v) => ({ value: v.id, label: v.name }))}
            onSelect={(id) => applyView(id)}
            dropdownRender={(menu) => (
              <div>
                {menu}
                <div style={{ borderTop: "1px solid rgba(0,0,0,0.06)", padding: 4 }}>
                  {savedViews.map((v) => (
                    <div
                      key={v.id}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "2px 6px" }}
                    >
                      <button
                        type="button"
                        onClick={() => applyView(v.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-primary, #1e293b)", textAlign: "left", flex: 1 }}
                      >
                        {v.name}
                      </button>
                      <button
                        type="button"
                        aria-label={`${t("w14Ux.views.delete")}: ${v.name}`}
                        onClick={() => removeView(v.id)}
                        style={{ border: "none", background: "none", cursor: "pointer", color: "var(--color-error, #dc2626)", display: "flex" }}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );

  const toolbar = (
    <Popover content={columnPanel} trigger="click" placement="bottomRight">
      <Button size="small" icon={<Columns3 size={13} />} data-testid="column-config-button">
        {t("w14Ux.columns.configure")}
        {hiddenCount > 0 && (
          <span style={{ color: "var(--color-warning-600, #d97706)", marginLeft: 4 }}>
            ({hiddenCount})
          </span>
        )}
      </Button>
    </Popover>
  );

  return {
    visibleColumns,
    toolbar,
    order,
    visibility,
    savedViews,
    hiddenCount,
    resetColumns,
  };
}

function iconBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 22,
    height: 22,
    border: "1px solid var(--border-default, rgba(0,0,0,0.12))",
    borderRadius: 6,
    background: "transparent",
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
    color: "var(--text-secondary, #475569)",
  };
}

export default useTableColumnConfig;
