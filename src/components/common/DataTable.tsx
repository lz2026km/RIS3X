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
import { useCallback, useMemo, useState } from "react";
import { Table, Skeleton, Button, Tooltip, Segmented } from "antd";
import type {
  TableProps,
  TableColumnsType,
  TablePaginationConfig,
  TableColumnType,
  TableColumnGroupType,
} from "antd";
import type { ReactNode, CSSProperties } from "react";
import { Download, Rows3, Rows4 } from "lucide-react";
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
}

export type TableDensity = "compact" | "comfortable";

export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** 数值列识别: dataIndex 以 Amount/Count/Rate/Score/数量/率/分/量 等结尾 */
const NUMERIC_SUFFIX_RE =
  /(amount|count|rate|score|qty|quantity|total|num|number|percent|ratio|数量|总数|金额|次数|例数|率|分|量|数)$/i;

function lastDataIndexSegment(dataIndex: unknown): string {
  if (Array.isArray(dataIndex)) return String(dataIndex[dataIndex.length - 1] ?? "");
  return dataIndex === undefined || dataIndex === null ? "" : String(dataIndex);
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
  showDensity = true,
  density: densityProp,
  defaultDensity = "compact",
  onDensityChange,
  disableAutoNumericAlign = false,
  pagination: paginationProp,
  locale,
  scroll,
  loading,
  className,
  onRow: onRowProp,
  ...restProps
}: DataTableProps<RecordType>) {
  const [internalDensity, setInternalDensity] = useState<TableDensity>(defaultDensity);
  const density = densityProp ?? internalDensity;

  const handleDensityChange = useCallback(
    (value: TableDensity) => {
      if (densityProp === undefined) setInternalDensity(value);
      onDensityChange?.(value);
    },
    [densityProp, onDensityChange],
  );

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
  const effectiveColumns = useMemo(
    () => applyNumericAlign(baseColumns, !disableAutoNumericAlign),
    [baseColumns, disableAutoNumericAlign],
  );
  // [W14-UX] 右键上下文菜单
  const { open: openContextMenu, menu: contextMenuNode } = useContextMenu(
    contextMenuTestId ?? "data-table-context-menu",
  );

  const hasData = dataSource.length > 0;
  const handleExport = useCallback(() => {
    exportCsv(effectiveColumns, dataSource, exportFileName);
  }, [effectiveColumns, dataSource, exportFileName]);

  const showExportBtn = showExport && hasData;
  const showDensityToggle = showDensity;
  const showAuditActions = showExportBtn || showDensityToggle;
  const showToolbar = Boolean(toolbar || toolbarExtra || columnConfigKey || showAuditActions);

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
          {showDensityToggle && (
            <Tooltip title={t("ui4Tables.density.tooltip")}>
              <Segmented<string>
                size="small"
                value={density}
                onChange={(v) => handleDensityChange(v as TableDensity)}
                data-testid="data-table-density"
                options={[
                  {
                    value: "compact",
                    label: (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
                        <Rows3 size={14} />
                        {t("ui4Tables.density.compact")}
                      </span>
                    ),
                  },
                  {
                    value: "comfortable",
                    label: (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 'var(--space-1, 4px)' }}>
                        <Rows4 size={14} />
                        {t("ui4Tables.density.comfortable")}
                      </span>
                    ),
                  },
                ]}
              />
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
              style={{ padding: "36px 16px" }}
              testId="data-table-empty"
            />
          ),
          ...locale,
        }}
        scroll={{ x: "max-content", y: fixedHeader, ...scroll }}
        size={density === "compact" ? "small" : "middle"}
        loading={
          loading
            ? {
                spinning: true,
                indicator: (
                  <div style={{ padding: 'var(--space-6, 24px)', maxWidth: 720 }}>
                    <Skeleton active title={false} paragraph={{ rows: 8 }} />
                  </div>
                ),
                ...(typeof loading === "object" ? loading : {}),
              }
            : false
        }
        rowClassName={
          zebra
            ? (_record, index) => (index % 2 === 1 ? "dt-zebra" : "")
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
    showSizeChanger: true,
    pageSizeOptions: [...TABLE_PAGE_SIZE_OPTIONS],
    showTotal: (total) => `共 ${total} 条`,
    size: paginationSize,
  };
  if (paginationProp === false) return false;
  return { ...base, ...(paginationProp ?? {}) };
}

export default DataTable;
