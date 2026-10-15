/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - DataTable
 * UI-4 表格统一规范封装 (antd Table 默认配置):
 *   - 专业列头 (neutral gray / 600 字重 / sticky) / 36-40px 高密度行 / 斑马纹 / hover + 选中染色
 *   - 数值列自动右对齐 + tabular-nums (列 meta align 支持, 或按 dataIndex 结尾自动推断 Amount/Count/Rate/Score/数量/率/分/量)
 *   - scroll 处理 (横向 max-content, 纵向 scroll.y 时表头自动 sticky)
 *   - 空态 (EmptyState) / 加载态 (Skeleton) / 分页器统一 (共 N 条, 10/20/50/100)
 *   - 内置工具栏: 导出 CSV (当前视图) + 密度切换 (compact/comfortable)
 * 兼容 ProTable / VirtualTable 常用调用方式。
 */
import { useCallback, useMemo } from "react";
import { Table, Skeleton, Button, Tooltip } from "antd";
import type {
  TableProps,
  TableColumnsType,
  TablePaginationConfig,
  TableColumnType,
  TableColumnGroupType,
} from "antd";
import type { ReactNode, CSSProperties } from "react";
import { Download } from "lucide-react";
import "../../styles/data-table.css";
import { EmptyState } from "./EmptyState";
// [W14-UX] 列配置/保存视图 + 右键上下文菜单
import { useContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useTableColumnConfig, type ColumnLike } from "../data/useTableColumnConfig";
import { t } from "../../i18n/appI18n";

type AnyColumn<RecordType extends object> = TableColumnType<RecordType> | TableColumnGroupType<RecordType>;
type HiddenColumn = { hidden?: boolean };

export interface DataTableProps<RecordType extends object>
  extends Omit<TableProps<RecordType>, "size" | "pagination" | "locale" | "rowClassName"> {
  columns: TableColumnsType<RecordType>;
  dataSource: RecordType[];
  rowKey: TableProps<RecordType>["rowKey"];
  /** 行 className 回调 (与斑马纹共存: 选中行等场景) */
  rowClassName?: TableProps<RecordType>["rowClassName"];
  /** 分页配置 (antd TablePaginationConfig 或 false; 默认统一配置) */
  pagination?: TableProps<RecordType>["pagination"];
  /** 分页器 locale 覆盖 (空态等; 默认 EmptyState) */
  locale?: TableProps<RecordType>["locale"];
  /** 分页每页条数 (默认 20) */
  pageSize?: number;
  /** 是否显示分页器 (默认 true; 传 pagination 时以 pagination 为准) */
  showPagination?: boolean;
  /** 分页器大小 (默认 small) */
  paginationSize?: "small" | "large";
  /** 斑马纹 (默认 true) */
  zebra?: boolean;
  /** 空态描述 */
  emptyText?: ReactNode;
  /** 表格顶部工具栏 (可选) */
  toolbar?: ReactNode;
  /** [W14-UX] 工具栏额外内容 (显示在列配置按钮左侧) */
  toolbarExtra?: ReactNode;
  /** 固定表头滚动高度 (等价 scroll.y, 传 scroll 时以 scroll 为准) */
  fixedHeader?: number | string;
  /** [W14-UX] 启用列显隐/排序 + 保存视图 (提供稳定 storageKey) */
  columnConfigKey?: string;
  /** [W14-UX] 列配置中始终显示的列 key */
  alwaysVisibleColumns?: string[];
  /** [W14-UX] 保存视图时读取当前 filter/sort 状态 */
  getViewState?: () => Record<string, unknown>;
  /** [W14-UX] 应用保存视图时恢复 filter/sort */
  applyViewState?: (state: Record<string, unknown>) => void;
  /** [W14-UX] 行右键菜单项 (danger + confirm 支持二次确认) */
  contextMenuItems?: (record: RecordType, index: number) => ContextMenuItem[];
  /** [W14-UX] 右键菜单测试 id */
  contextMenuTestId?: string;
  /** [UI-4] 显示导出 CSV 按钮 (默认 true, 有数据时显示) */
  showExport?: boolean;
  /** [UI-4] 导出文件名 (不含扩展名, 默认 table) */
  exportFileName?: string;
  /** [UI-4] 显示密度切换 (默认 true) */
  showDensity?: boolean;
  /** [UI-4] 受控密度 */
  density?: TableDensity;
  /** [UI-4] 非受控默认密度 (默认 compact) */
  defaultDensity?: TableDensity;
  /** [UI-4] 密度变化回调 */
  onDensityChange?: (density: TableDensity) => void;
  /** [UI-4] 关闭数值列自动右对齐 */
  disableAutoNumericAlign?: boolean;
  /**
   * [v3.0.6.15-5] 单元格文本溢出策略:
   *  - `ellipsis` (默认): 单元格单行 + 省略号 + tooltip, 行高整齐
   *  - `wrap`: 允许换行 (整表关闭截断)
   * 单列可用 `className="dt-wrap"` 单独退出。
   */
  cellWrap?: "ellipsis" | "wrap";
  /**
   * [v3.0.6.15-5] 列宽归一基准容器宽度 (px)。默认取 1200,
   * 弹窗内表格可传更小的值以获得更紧凑的列宽。
   */
  layoutWidth?: number;
}

export type TableDensity = "compact" | "comfortable";

export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** 数值列识别: dataIndex 以 Amount/Count/Rate/Score/数量/率/分/量 等结尾 */
const NUMERIC_SUFFIX_RE =
  /(amount|count|rate|score|qty|quantity|total|num|number|percent|ratio|数量|总数|金额|次数|例数|率|分|量|数)$/i;

/** [v3.0.6.15-5] 归一列宽时的最小列宽 (px) */
const MIN_COL_WIDTH = 120;
/** [v3.0.6.15-5] 归一列宽时的最大列宽 (px), 防止少量列时单列过宽 */
const MAX_COL_WIDTH = 420;

function lastDataIndexSegment(dataIndex: unknown): string {
  if (Array.isArray(dataIndex)) return String(dataIndex[dataIndex.length - 1] ?? "");
  return dataIndex === undefined || dataIndex === null ? "" : String(dataIndex);
}

function hasWrapOptOut<RecordType extends object>(col: AnyColumn<RecordType>): boolean {
  return String((col as TableColumnType<RecordType>).className ?? "").includes("dt-wrap");
}

function isNumericColumn<RecordType extends object>(col: AnyColumn<RecordType>): boolean {
  const keyBase = String((col as TableColumnType<RecordType>).key ?? "");
  const base = lastDataIndexSegment((col as TableColumnType<RecordType>).dataIndex) || keyBase;
  if (!base) return false;
  return NUMERIC_SUFFIX_RE.test(base);
}

/** 为数值列补齐 align:'right' + dt-num (tabular-nums), 递归处理分组列 */
function applyNumericAlign<RecordType extends object>(
  columns: TableColumnsType<RecordType>,
  enabled: boolean,
): TableColumnsType<RecordType> {
  return columns.map((col) => {
    const anyCol = col as TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    };
    const next: TableColumnType<RecordType> & { children?: TableColumnsType<RecordType> } = { ...anyCol };
    if (Array.isArray(anyCol.children)) {
      next.children = applyNumericAlign(anyCol.children, enabled);
    }
    if (enabled) {
      const numeric = isNumericColumn(anyCol);
      const alignRight = anyCol.align === "right";
      if (numeric && !anyCol.align) next.align = "right";
      if ((numeric || alignRight) && !String(anyCol.className ?? "").includes("dt-num")) {
        next.className = anyCol.className ? `${anyCol.className} dt-num` : "dt-num";
      }
    }
    return next;
  }) as TableColumnsType<RecordType>;
}

/**
 * [v3.0.6.15-5] 为文本类列补齐默认 ellipsis (超长省略 + tooltip)。
 *
 * 变更要点: 此前对 **所有带 render 的列** 直接跳过 (旧实现 `return col`),
 * 而 render 列恰是绝大多数 (Tag / 状态 / 操作 / 组合文本), 这些单元格
 * 因无 nowrap 约束会换行, 导致同一张表内行高 36px~120px 混杂 ("不均匀")。
 * 现在 render 列同样纳入, 仅以下情况退出:
 *   - 操作列 (右侧图标按钮组)
 *   - 数值列 (右对齐 + tabular-nums, 省略会干扰读数)
 *   - 显式声明 ellipsis 的列
 *   - 列 className 含 dt-wrap (确需多行的单元格)
 * 递归处理分组列。
 */
export function applyDefaultEllipsis<RecordType extends object>(
  columns: TableColumnsType<RecordType>,
  enabled: boolean,
): TableColumnsType<RecordType> {
  if (!enabled) return columns;
  return columns.map((col) => {
    const anyCol = col as TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    };
    if (Array.isArray(anyCol.children)) {
      const next: TableColumnType<RecordType> & { children?: TableColumnsType<RecordType> } = { ...anyCol };
      next.children = applyDefaultEllipsis(anyCol.children, enabled);
      return next;
    }
    if (anyCol.ellipsis !== undefined) return col;
    if (isActionColumn(anyCol as AnyColumn<object>)) return col;
    if (isNumericColumn(anyCol)) return col;
    if (hasWrapOptOut(anyCol)) return col;
    const next: TableColumnType<RecordType> & { children?: TableColumnsType<RecordType> } = { ...anyCol };
    next.ellipsis = { showTitle: true };
    return next;
  }) as TableColumnsType<RecordType>;
}

/**
 * [v3.0.6.15-5] 列宽归一化。
 *
 * 背景: 全站此前 **0 处** 设置 tableLayout, 约 346 张表也没有 scroll.x,
 * antd 回退 tableLayout="auto" 由浏览器按内容分配列宽 —— 长短列剧烈波动
 * ("不均匀")。归一后:
 *   - 叶子列总宽固定, 未声明 width 的列按可用空间等分 (夹在 120~420px)
 *   - 已声明 width 的列原样保留, 剩余空间分配给未声明的列
 * 返回归一后的列宽总和, 供 scroll.x 取代 'max-content'。
 */
export function normalizeColumnWidths<RecordType extends object>(
  columns: TableColumnsType<RecordType>,
  containerWidth: number,
): { columns: TableColumnsType<RecordType>; totalWidth: number } {
  type Flat = { col: AnyColumn<RecordType>; declared: number | null };
  const leaves: Flat[] = [];
  const walk = (cols: TableColumnsType<RecordType>): void => {
    for (const col of cols) {
      const anyCol = col as TableColumnType<RecordType> & {
        children?: TableColumnsType<RecordType>;
      };
      if (Array.isArray(anyCol.children)) {
        walk(anyCol.children);
        continue;
      }
      const w = (anyCol as { width?: number | string }).width;
      leaves.push({
        col,
        declared: typeof w === "number" && w > 0 ? w : null,
      });
    }
  };
  walk(columns);
  if (leaves.length === 0) return { columns, totalWidth: 0 };

  const declaredSum = leaves.reduce((s, l) => s + (l.declared ?? 0), 0);
  const undeclared = leaves.filter((l) => l.declared === null);

  // 全部列都声明了宽度 -> 直接采用声明值之和
  if (undeclared.length === 0) {
    return { columns, totalWidth: declaredSum };
  }

  const available = Math.max(containerWidth, MIN_COL_WIDTH * leaves.length);
  const remaining = Math.max(available - declaredSum, MIN_COL_WIDTH * undeclared.length);
  const each = Math.min(Math.max(Math.floor(remaining / undeclared.length), MIN_COL_WIDTH), MAX_COL_WIDTH);

  const nextColumns = columns.map((col) => {
    const anyCol = col as TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    };
    if (Array.isArray(anyCol.children)) {
      const n: TableColumnType<RecordType> & { children?: TableColumnsType<RecordType> } = { ...anyCol };
      n.children = normalizeColumnWidths(anyCol.children, containerWidth).columns;
      return n;
    }
    const w = (anyCol as { width?: number | string }).width;
    if (typeof w === "number" && w > 0) return col;
    if (hasWrapOptOut(anyCol)) return col;
    return { ...anyCol, width: each };
  }) as TableColumnsType<RecordType>;

  return { columns: nextColumns, totalWidth: declaredSum + each * undeclared.length };
}


function getColumnValue(row: object, dataIndex: unknown): unknown {
  if (dataIndex === undefined || dataIndex === null) return undefined;
  const path = Array.isArray(dataIndex) ? dataIndex : String(dataIndex).split(".");
  return path.reduce<unknown>(
    (value, key) =>
      value && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined,
    row,
  );
}

function isActionColumn(col: AnyColumn<object>): boolean {
  const c = col as TableColumnType<object>;
  const key = String(c.key ?? lastDataIndexSegment(c.dataIndex) ?? "").toLowerCase();
  return ["action", "actions", "operation", "operations", "操作"].includes(key);
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const raw = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${raw.replace(/"/g, '""')}"`;
}

/** 从可见列 + 当前数据导出 CSV (当前视图) */
function exportCsv<RecordType extends object>(
  columns: TableColumnsType<RecordType>,
  dataSource: RecordType[],
  fileName: string,
): void {
  type FlatCol = { title: unknown; dataIndex: unknown };
  const flat: FlatCol[] = [];
  const walk = (cols: TableColumnsType<RecordType>): void => {
    for (const col of cols) {
      const c = col as TableColumnType<RecordType> & {
        children?: TableColumnsType<RecordType>;
      };
      if (Array.isArray(c.children)) {
        walk(c.children);
        continue;
      }
      if (c.dataIndex === undefined || c.dataIndex === null) continue;
      if ((c as HiddenColumn).hidden) continue;
      if (isActionColumn(c as AnyColumn<object>)) continue;
      flat.push({ title: c.title, dataIndex: c.dataIndex });
    }
  };
  walk(columns);

  const header = flat.map((c) => csvCell(typeof c.title === "string" ? c.title : "")).join(",");
  const body = dataSource
    .map((row) => flat.map((c) => csvCell(getColumnValue(row, c.dataIndex))).join(","))
    .join("\r\n");
  const csv = `\uFEFF${header}\r\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function DataTable<RecordType extends object>({
  columns,
  dataSource,
  rowKey,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  showPagination = true,
  paginationSize = "small",
  zebra = true,
  emptyText = "暂无数据",
  toolbar,
  toolbarExtra,
  fixedHeader,
  columnConfigKey,
  alwaysVisibleColumns,
  getViewState,
  applyViewState,
  contextMenuItems,
  contextMenuTestId,
  showExport = true,
  exportFileName = "table",
  density: densityProp,
  defaultDensity = "compact",
  disableAutoNumericAlign = false,
  cellWrap = "ellipsis",
  layoutWidth = 1200,
  tableLayout = "fixed",
  pagination: paginationProp,
  locale,
  scroll,
  loading,
  className,
  rowClassName: rowClassNameProp,
  onRow: onRowProp,
  ...restProps
}: DataTableProps<RecordType>) {
  const density = densityProp ?? "compact";

  const pagination = useMemoPagination(showPagination, paginationProp, pageSize, paginationSize);
  // [W14-UX] 列配置 + 保存视图
  const columnConfig = useTableColumnConfig<ColumnLike>({
    columns: columns as unknown as ColumnLike[],
    storageKey: columnConfigKey ?? "__datatable_default__",
    getTitle: (c) => c.title ?? "",
    alwaysVisible: alwaysVisibleColumns,
    getViewState,
    applyViewState,
  });
  const baseColumns = columnConfigKey
    ? (columnConfig.visibleColumns as unknown as TableColumnsType<RecordType>)
    : columns;
  // [v3.0.6.15-5] 列宽归一 -> 消除 tableLayout:auto 的列宽波动
  const normalized = useMemo(
    () => normalizeColumnWidths(baseColumns, layoutWidth),
    [baseColumns, layoutWidth],
  );
  const effectiveColumns = useMemo(
    () =>
      applyDefaultEllipsis(
        applyNumericAlign(normalized.columns, !disableAutoNumericAlign),
        cellWrap === "ellipsis",
      ),
    [normalized.columns, disableAutoNumericAlign, cellWrap],
  );
  // [v3.0.6.15-5] 调用方普遍传 scroll.x='max-content' (全站 299 处),
  // 它会让表格按内容撑开、忽略容器, 且使 ellipsis 永远不触发 —— 这正是
  // "表格肥大 / 弹窗内不协调" 的主因。此处统一替换为归一后的列宽总和。
  const resolvedScroll = useMemo(() => {
    const next = { ...scroll } as NonNullable<TableProps<RecordType>["scroll"]>;
    if (next.x === "max-content" && normalized.totalWidth > 0) {
      next.x = normalized.totalWidth;
    }
    return next;
  }, [scroll, normalized.totalWidth]);

  // [W14-UX] 右键上下文菜单
  const { open: openContextMenu, menu: contextMenuNode } = useContextMenu(
    contextMenuTestId ?? "data-table-context-menu",
  );

  const hasData = dataSource.length > 0;
  const handleExport = useCallback(() => {
    exportCsv(effectiveColumns, dataSource, exportFileName);
  }, [effectiveColumns, dataSource, exportFileName]);

  const showExportBtn = showExport && hasData;
  // [K-1] 工具栏仅在用户显式传入 toolbar/toolbarExtra/columnConfigKey 时显示
  // 密度切换已移除（受控 prop density 仍可用）；导出按钮随工具栏显隐
  const showToolbar = Boolean(toolbar || toolbarExtra || columnConfigKey);

  const toolbarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 'var(--space-2, 8px)',
    padding: "8px 12px",
    borderBottom: "1px solid var(--border-color, #e2e8f0)",
    background: "var(--bg-card)",
    flexWrap: "wrap",
  };

  return (
    <div className={`data-table data-table--${density} ${className ?? ""}`}>
      {contextMenuNode}
      {showToolbar && (
        <div style={toolbarStyle} data-testid="data-table-toolbar">
          {toolbar}
          <div style={{ flex: 1 }} />
          {toolbarExtra}
          {columnConfigKey && columnConfig.toolbar}
          {showExportBtn && (
            <Tooltip title={t("ui4Tables.export.tooltip")}>
              <Button
                size="small"
                type="text"
                icon={<Download size={14} />}
                onClick={handleExport}
                data-testid="data-table-export"
                aria-label={t("ui4Tables.export.label")}
              >
                {t("ui4Tables.export.label")}
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      <Table<RecordType>
        {...restProps}
        rowKey={rowKey}
        columns={effectiveColumns}
        dataSource={dataSource}
        pagination={pagination}
        locale={{
          emptyText: (
            <EmptyState
              description={emptyText}
              style={{ padding: "12px 16px" }}
              testId="data-table-empty"
            />
          ),
          ...locale,
        }}
        scroll={{ y: fixedHeader, ...resolvedScroll }}
        tableLayout={tableLayout}
        size={density === "compact" ? "small" : "middle"}
        loading={
          loading
            ? {
                spinning: true,
                indicator: (
                  <div style={{ padding: 'var(--space-4, 16px)', maxWidth: 720 }}>
                    <Skeleton active title={false} paragraph={{ rows: 4 }} />
                  </div>
                ),
                ...(typeof loading === "object" ? loading : {}),
              }
            : false
        }
        rowClassName={
          zebra || rowClassNameProp
            ? (record, index) => {
                const zebraCls = zebra && index % 2 === 1 ? "dt-zebra" : "";
                const custom =
                  typeof rowClassNameProp === "function"
                    ? (rowClassNameProp as (r: RecordType, i: number, s: number) => string)(record, index, -1)
                    : rowClassNameProp ?? "";
                return [zebraCls, custom].filter(Boolean).join(" ");
              }
            : undefined
        }
        onRow={(record, index) => {
          const base = onRowProp?.(record, index) ?? {};
          if (!contextMenuItems) return base;
          return {
            ...base,
            onContextMenu: (event) => {
              event.preventDefault();
              const items = contextMenuItems(record, index ?? 0);
              if (items.length > 0) openContextMenu(event, items);
            },
          };
        }}
      />
    </div>
  );
}

function useMemoPagination(
  showPagination: boolean,
  paginationProp: TableProps<object>["pagination"],
  pageSize: number,
  paginationSize: "small" | "large"
): TablePaginationConfig | false {
  if (!showPagination && paginationProp === undefined) return false;
  const base: TablePaginationConfig = {
    pageSize,
    showSizeChanger: false,
    pageSizeOptions: [...TABLE_PAGE_SIZE_OPTIONS],
    showTotal: (total) => `共 ${total} 条`,
    size: paginationSize,
  };
  if (paginationProp === false) return false;
  return { ...base, ...(paginationProp ?? {}) };
}

export default DataTable;
