/**
 * G005 放射RIS系统 v3.0.6.8-23c - StandardTable 组件
 *
 * 通用表格封装: sticky header + 分页 + Empty + Skeleton + 排序 + 列对齐。
 * 基于 antd Table + StickyHeader 双轨支持,业务页可任选其一。
 *
 * 契约 (A6-A11 引用):
 *  - dataSource / columns / rowKey
 *  - pagination: current + pageSize + total + onChange + showSizeChanger
 *  - sortField + sortOrder + onSortChange
 *  - emptyText / loading / sticky
 */
import { type ReactNode, type CSSProperties, useMemo, useState } from "react";
import { Table, Pagination } from "antd";
import type { TableProps, ColumnType } from "antd/es/table";
import { Empty } from "antd";
import {
  StickyHeader,
  type StickyHeaderColumn,
  type SortDirection,
  type ColumnAlign,
} from "./StickyHeader";
import { ColumnSettingsPanel, type ColumnSetting } from "../common/ColumnSettings";

export interface StandardTableColumn<T = Record<string, unknown>> {
  key: string;
  dataIndex?: ColumnType<T>["dataIndex"];
  title: ReactNode;
  /** 列宽 */
  width?: number | string;
  /** 对齐方式 */
  align?: ColumnAlign;
  /** 是否可排序 */
  sortable?: boolean;
  filters?: ColumnType<T>["filters"];
  onFilter?: ColumnType<T>["onFilter"];
  filterMultiple?: boolean;
  /** 是否 fixed 锁定列 */
  fixed?: "left" | "right";
  /** ellipsis */
  ellipsis?: boolean;
  /** 自定义渲染 */
  render?: (value: unknown, row: T, index: number) => ReactNode;
}

export interface StandardTablePagination {
  current: number;
  pageSize: number;
  total: number;
  /** 默认 [10, 20, 50, 100] */
  pageSizeOptions?: number[];
  showSizeChanger?: boolean;
  showQuickJumper?: boolean;
  onChange: (page: number, pageSize: number) => void;
}

export interface StandardTableProps<T extends { id?: string | number }> {
  /** 数据源 */
  dataSource: T[];
  /** 列定义 (Standard 模式) */
  columns?: StandardTableColumn<T>[];
  /** rowKey 取值 */
  rowKey?: string | ((row: T) => string);
  /** 是否加载中 */
  loading?: boolean;
  /** 空状态文本 */
  emptyText?: string;
  /** 自定义空状态 */
  emptyRender?: ReactNode;
  /** 是否启用 sticky header */
  sticky?: boolean;
  /** sticky top 偏移 */
  stickyTop?: number;
  /** 分页 */
  pagination?: StandardTablePagination | false;
  /** 排序字段 */
  sortField?: string;
  /** 排序方向 */
  sortOrder?: SortDirection;
  /** 排序回调 */
  onSortChange?: (field: string, order: SortDirection) => void;
  /** 是否可选择 (checkbox) */
  selectable?: boolean;
  /** 已选 keys */
  selectedKeys?: Array<string | number>;
  /** 选择回调 */
  onSelectionChange?: (keys: Array<string | number>, rows: T[]) => void;
  /** 行点击 */
  onRowClick?: (row: T, index: number) => void;
  /** size */
  size?: "small" | "middle" | "large";
  /** antd 透传 */
  antdProps?: TableProps<T>;
  /** 自定义容器 className */
  className?: string;
  /** 自定义容器 style */
  style?: CSSProperties;
  /** skeleton 行数 */
  skeletonRows?: number;
  /** sticky header 主题 */
  theme?: "light" | "dark";
  /** 列设置 tableId（启用列设置齿轮图标） */
  tableId?: string;
  /** 列设置变化回调 */
  onColumnSettingsChange?: (settings: ColumnSetting[]) => void;
}

const STICKY_HEADER_STYLE: CSSProperties = {
  position: "sticky",
  top: 0,
  background: "#fff",
  zIndex: 2,
};

function getRowKey<T extends { id?: string | number }>(
  row: T,
  rowKey: string | ((row: T) => string) | undefined,
): string {
  if (typeof rowKey === "function") return rowKey(row);
  if (typeof rowKey === "string") {
    return String((row as unknown as Record<string, unknown>)[rowKey] ?? "");
  }
  return String(row.id ?? "");
}

export function StandardTable<T extends { id?: string | number }>({
  dataSource,
  columns = [],
  rowKey = "id",
  loading = false,
  emptyText = "暂无数据",
  emptyRender,
  sticky = false,
  stickyTop = 0,
  pagination,
  sortField,
  sortOrder,
  onSortChange,
  selectable = false,
  selectedKeys,
  onSelectionChange,
  onRowClick,
  size = "middle",
  antdProps,
  className,
  style,
  skeletonRows = 5,
  theme = "light",
  tableId,
  onColumnSettingsChange,
}: StandardTableProps<T>) {
  const [colSettings, setColSettings] = useState<ColumnSetting[]>(() =>
    tableId && columns.length > 0
      ? columns.map((c) => ({ key: c.key, title: String(c.title ?? ""), visible: true, fixed: false }))
      : [],
  );

  const visibleColumns = useMemo(() => {
    if (!tableId || colSettings.length === 0) return columns;
    const visMap = new Map(colSettings.map((s) => [s.key, s]));
    return columns.filter((c) => visMap.get(c.key)?.visible !== false);
  }, [columns, colSettings, tableId]);

  const handleColSettingsChange = (settings: ColumnSetting[]) => {
    setColSettings(settings);
    onColumnSettingsChange?.(settings);
  };
  const stickyHeaderColumns: StickyHeaderColumn<T>[] = useMemo(() => {
    const cols: StickyHeaderColumn<T>[] = [];
    if (selectable) {
      cols.push({
        key: "__select__",
        title: "",
        checkboxColumn: true,
        align: "center",
        width: 40,
      });
    }
    visibleColumns.forEach((c) => {
      cols.push({
        key: c.key,
        title: c.title,
        align: c.align,
        sortable: c.sortable,
        width: c.width,
      });
    });
    return cols;
  }, [visibleColumns, selectable]);

  const allSelected = useMemo(() => {
    if (!selectedKeys || dataSource.length === 0) return false;
    return dataSource.every((r) =>
      selectedKeys.includes(getRowKey(r, rowKey) as never),
    );
  }, [dataSource, selectedKeys, rowKey]);

  const indeterminate = useMemo(() => {
    if (!selectedKeys || dataSource.length === 0) return false;
    const selectedCount = dataSource.filter((r) =>
      selectedKeys.includes(getRowKey(r, rowKey) as never),
    ).length;
    return selectedCount > 0 && selectedCount < dataSource.length;
  }, [dataSource, selectedKeys, rowKey]);

  const handleSort = (key: string) => {
    if (!onSortChange) return;
    if (sortField !== key) {
      onSortChange(key, "asc");
      return;
    }
    if (sortOrder === "asc") onSortChange(key, "desc");
    else if (sortOrder === "desc") onSortChange(key, null);
    else onSortChange(key, "asc");
  };

  const handleToggleSelectAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      onSelectionChange([], []);
    } else {
      const keys = dataSource.map((r) => getRowKey(r, rowKey));
      onSelectionChange(keys, dataSource);
    }
  };

  const antdColumns: ColumnType<T>[] = useMemo(() => {
    const cols: ColumnType<T>[] = [];
    if (selectable) {
      cols.push({
        key: "__select__",
        title: "",
        align: "center",
        width: 40,
        render: (_v, row) => {
          const k = getRowKey(row, rowKey);
          const checked = selectedKeys?.includes(k as never);
          return (
            <input
              type="checkbox"
              checked={!!checked}
              aria-label="选择行"
              onChange={(e) => {
                if (!onSelectionChange) return;
                const set = new Set(selectedKeys ?? []);
                if (e.target.checked) set.add(k as never);
                else set.delete(k as never);
                onSelectionChange(
                  Array.from(set),
                  dataSource.filter((r) =>
                    set.has(getRowKey(r, rowKey) as never),
                  ),
                );
              }}
              onClick={(e) => e.stopPropagation()}
            />
          );
        },
      });
    }
    visibleColumns.forEach((c) => {
      const isNumeric = c.align === "right";
      const isAction = ["action", "actions", "operation", "operations", "操作"].includes(c.key.toLowerCase());
      const col: ColumnType<T> = {
        key: c.key,
        title: c.title,
        dataIndex: c.dataIndex ?? c.key,
        width: typeof c.width === "number" ? c.width : undefined,
        align: c.align,
        fixed: c.fixed ?? (isAction ? "right" : undefined),
        ellipsis: c.ellipsis,
        sorter: !!c.sortable,
        filters: c.filters,
        onFilter: c.onFilter,
        filterMultiple: c.filterMultiple,
        sortOrder:
          sortField === c.key
            ? sortOrder === "asc"
              ? "ascend"
              : sortOrder === "desc"
                ? "descend"
                : undefined
            : undefined,
        showSorterTooltip: false,
        render: c.render
          ? (value, row, index) => c.render!(value, row, index)
          : (value) =>
              value === null || value === undefined || value === ""
                ? "-"
                : isNumeric
                  ? Number(value).toLocaleString()
                  : String(value),
      };
      cols.push(col);
    });
    return cols;
  }, [
    visibleColumns,
    selectable,
    selectedKeys,
    dataSource,
    rowKey,
    onSelectionChange,
    sortField,
    sortOrder,
  ]);

  const antdPagination = useMemo(() => {
    if (pagination === false) return false;
    if (!pagination) return false;
    const opts = pagination.pageSizeOptions ?? [10, 20, 50, 100];
    return {
      current: pagination.current,
      pageSize: pagination.pageSize,
      total: pagination.total,
      size: "small" as const,
      showSizeChanger: pagination.showSizeChanger ?? true,
      showQuickJumper: pagination.showQuickJumper ?? true,
      pageSizeOptions: opts.map(String),
      showTotal: (total: number) => `共 ${total} 条`,
      onChange: pagination.onChange,
    };
  }, [pagination]);

  const isEmpty = !loading && dataSource.length === 0;

  // ============ Native mode (sticky + custom sort + checkbox) ============
  if (sticky) {
    return (
      <div
        className={className}
        style={{ overflow: "auto", maxHeight: "calc(100vh - 200px)", position: "relative", ...style }}
      >
        {tableId && (
          <div style={{ position: "absolute", top: 4, right: 4, zIndex: 10 }}>
            <ColumnSettingsPanel
              tableId={tableId}
              columns={columns.map((c) => ({ key: c.key, title: String(c.title ?? "") }))}
              value={colSettings}
              onChange={handleColSettingsChange}
            />
          </div>
        )}
        <StickyHeader
          columns={stickyHeaderColumns}
          sortKey={sortField}
          sortOrder={sortOrder}
          onSort={handleSort}
          allSelected={allSelected}
          indeterminate={indeterminate}
          onToggleSelectAll={handleToggleSelectAll}
          top={stickyTop}
          theme={theme}
        />
        {loading ? (
          <Skeleton rows={skeletonRows} />
        ) : isEmpty ? (
          emptyRender ? (
            <>{emptyRender}</>
          ) : (
            <div style={{ padding: "40px 12px" }}>
              <Empty description={emptyText} />
            </div>
          )
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "separate",
              borderSpacing: 0,
              fontSize: 12,
            }}
          >
            <tbody>
              {dataSource.map((row, index) => {
                const key = getRowKey(row, rowKey);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick?.(row, index)}
                    style={{
                      borderBottom: "1px solid #f1f5f9",
                      cursor: onRowClick ? "pointer" : "default",
                      background: index % 2 === 0 ? "#fff" : "#fafbfc",
                    }}
                  >
                    {selectable && (
                      <td
                        style={{
                          padding: "8px 12px",
                          textAlign: "center",
                          width: 40,
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={
                            selectedKeys?.includes(key as never) ?? false
                          }
                          aria-label="选择行"
                          onChange={(e) => {
                            if (!onSelectionChange) return;
                            const set = new Set(selectedKeys ?? []);
                            if (e.target.checked) set.add(key as never);
                            else set.delete(key as never);
                            onSelectionChange(
                              Array.from(set),
                              dataSource.filter((r) =>
                                set.has(getRowKey(r, rowKey) as never),
                              ),
                            );
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </td>
                    )}
                    {visibleColumns.map((c) => {
                      const dataKey = typeof c.dataIndex === "string" ? c.dataIndex : c.key;
                      const raw = (row as unknown as Record<string, unknown>)[dataKey];
                      const isNumeric = c.align === "right";
                      return (
                        <td
                          key={c.key}
                          style={{
                            padding: "8px 12px",
                            textAlign: c.align ?? "left",
                            color: "#334155",
                          }}
                        >
                          {c.render
                            ? c.render(raw, row, index)
                            : raw === null || raw === undefined || raw === ""
                              ? "-"
                              : isNumeric
                                ? Number(raw).toLocaleString()
                                : String(raw)}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {antdPagination && (
          <div style={{ position: "sticky", bottom: 0, padding: "12px 16px", background: "#fff", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
            <Pagination {...antdPagination} />
          </div>
        )}
      </div>
    );
  }

  // ============ antd mode ============
  return (
    <div className={className} style={{ position: "relative", ...style }}>
      {tableId && (
        <div style={{ position: "absolute", top: 0, right: 0, zIndex: 10 }}>
          <ColumnSettingsPanel
            tableId={tableId}
            columns={columns.map((c) => ({ key: c.key, title: String(c.title ?? "") }))}
            value={colSettings}
            onChange={handleColSettingsChange}
          />
        </div>
      )}
      <Table<T>
        size={size}
        rowKey={
          typeof rowKey === "string" ? rowKey : (row) => getRowKey(row, rowKey)
        }
        dataSource={
          loading
            ? Array.from({ length: skeletonRows }).map(
                (_, i) => ({ id: `__sk_${i}` }) as unknown as T,
              )
            : dataSource
        }
        columns={antdColumns}
        loading={loading}
        pagination={antdPagination}
        onChange={(_pagination, _filters, sorter) => {
          if (Array.isArray(sorter)) return;
          if (!sorter || !sorter.columnKey || !onSortChange) return;
          const field = String(sorter.columnKey);
          const order =
            sorter.order === "ascend"
              ? "asc"
              : sorter.order === "descend"
                ? "desc"
                : null;
          onSortChange(field, order);
        }}
        locale={{
          emptyText: emptyRender ?? <Empty description={emptyText} />,
        }}
        onRow={(record, index) =>
          onRowClick
            ? {
                onClick: () => onRowClick(record, index ?? 0),
                style: { cursor: "pointer" },
              }
            : {}
        }
        components={{
          header: {
            cell: ({ children, ...rest }) => (
              <th
                {...rest}
                style={{ ...STICKY_HEADER_STYLE, ...(rest.style ?? {}) }}
              >
                {children}
              </th>
            ),
          },
        }}
        {...antdProps}
      />
    </div>
  );
}

// ============= Skeleton 子组件 =============
function Skeleton({ rows }: { rows: number }) {
  return (
    <div style={{ padding: 12 }}>
      {Array.from({ length: rows }).map((_, i: number) => (
        <div
          key={i}
          style={{
            height: 32,
            marginBottom: 8,
            background:
              "linear-gradient(90deg, #f1f5f9 0%, #e2e8f0 50%, #f1f5f9 100%)",
            backgroundSize: "200% 100%",
            animation: "std-skel 1.4s ease-in-out infinite",
            borderRadius: 4,
          }}
        />
      ))}
      <style>{`@keyframes std-skel { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
    </div>
  );
}

export default StandardTable;
