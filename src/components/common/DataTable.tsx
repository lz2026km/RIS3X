/**
 * G005 放射RIS系统 v3.0.6.11-103 Wave 6 - DataTable
 * 表格统一规范封装 (antd Table 默认配置):
 *   - size="middle" / 斑马纹 / 统一行高 / 列头样式 / hover 高亮
 *   - scroll 处理 (横向 max-content, 纵向固定表头由调用方 scroll.y 控制)
 *   - 空态 (EmptyState) / 加载态 (Skeleton) / 分页器统一 (showTotal + 每页条数)
 * 兼容 ProTable / VirtualTable 常用调用方式。
 */
import { Table, Skeleton } from "antd";
import type { TableProps, TableColumnsType, TablePaginationConfig } from "antd";
import type { ReactNode } from "react";
import "../../styles/data-table.css";
import { EmptyState } from "./EmptyState";
// [W14-UX] 列配置/保存视图 + 右键上下文菜单
import { useContextMenu, type ContextMenuItem } from "./ContextMenu";
import { useTableColumnConfig, type ColumnLike } from "../data/useTableColumnConfig";

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
}

export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

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
  pagination: paginationProp,
  locale,
  scroll,
  loading,
  className,
  onRow: onRowProp,
  ...restProps
}: DataTableProps<RecordType>) {
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
  const effectiveColumns = columnConfigKey
    ? (columnConfig.visibleColumns as unknown as TableColumnsType<RecordType>)
    : columns;
  // [W14-UX] 右键上下文菜单
  const { open: openContextMenu, menu: contextMenuNode } = useContextMenu(
    contextMenuTestId ?? "data-table-context-menu",
  );
  const showToolbar = Boolean(toolbar || toolbarExtra || columnConfigKey);

  return (
    <div className={`data-table ${className ?? ""}`}>
      {contextMenuNode}
      {showToolbar && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color, #e2e8f0)",
            background: "var(--bg-card)",
            flexWrap: "wrap",
          }}
        >
          {toolbar}
          <div style={{ flex: 1 }} />
          {toolbarExtra}
          {columnConfigKey && columnConfig.toolbar}
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
        size="middle"
        loading={
          loading
            ? {
                spinning: true,
                indicator: (
                  <div style={{ padding: 24, maxWidth: 720 }}>
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
