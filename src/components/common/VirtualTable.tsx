/**
 * G005 放射RIS系统 v3.0.6.11-100 Wave 5A - VirtualTable
 * UI 组件化: 长表虚拟滚动 wrapper
 *
 * 基于 antd Table + scroll={{ y }} 固定表头滚动,
 * pagination 精简 (默认 20/页, 不渲染分页器时传入 showPagination=false)。
 */
import { Table } from "antd";
import type { TableColumnsType, TablePaginationConfig } from "antd";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { normalizeColumnWidths, applyDefaultEllipsis } from "./DataTable";
import "../../styles/data-table.css";

export interface VirtualTableProps<RecordType extends object> {
  /** antd 列配置 */
  columns: TableColumnsType<RecordType>;
  /** 数据源 */
  dataSource: RecordType[];
  /** 行 key */
  rowKey: string | ((record: RecordType) => string | number);
  /** 滚动区高度 (px) */
  height: number;
  /** 每页条数 (默认 20) */
  pageSize?: number;
  /** 是否显示分页器 (默认 true) */
  showPagination?: boolean;
  /** 行选择 */
  rowSelection?: object;
  /** 加载中 */
  loading?: boolean;
  /** 空状态占位 */
  emptyText?: ReactNode;
  /** 表格宽度 (默认 100%) */
  width?: number | string;
  /** 行点击 */
  onRow?: (record: RecordType, index?: number) => React.HTMLAttributes<HTMLElement>;
}

export function VirtualTable<RecordType extends object>({
  columns,
  dataSource,
  rowKey,
  height,
  pageSize = 20,
  showPagination = true,
  rowSelection,
  loading,
  emptyText,
  width = "100%",
  onRow,
}: VirtualTableProps<RecordType>) {
  const pagination: TablePaginationConfig | false = showPagination
    ? {
        pageSize,
        showSizeChanger: false,
        showTotal: (total) => `共 ${total} 条`,
        size: "small",
      }
    : false;

  // [v3.0.6.16-0] 接入列宽归一: 此前 VirtualTable 完全不调用 normalizeColumnWidths
  // 也不设 tableLayout, 7 个调用点的表格游离在统一规范之外 (无紧凑密度 / 无
  // 列宽分层 / 可被 scroll.x 压扁)。现与 DataTable 共用同一归一算法。
  const normalized = useMemo(
    () => normalizeColumnWidths(columns, typeof width === 'number' ? width : 1200),
    [columns, width],
  );
  const finalColumns = useMemo(
    () => applyDefaultEllipsis(normalized.columns, true),
    [normalized.columns],
  );
  const resolvedX = useMemo(() => {
    const declared = width === '100%' ? undefined : width;
    if (normalized.totalWidth > 0 && declared === undefined) return normalized.totalWidth;
    return declared as number | string | undefined;
  }, [width, normalized.totalWidth]);

  return (
    <div className="data-table virtual-table" style={{ width: '100%' }}>
      <Table<RecordType>
        rowKey={rowKey}
        columns={finalColumns}
        dataSource={dataSource}
        rowSelection={rowSelection}
        loading={loading}
        onRow={onRow}
        pagination={pagination}
        locale={emptyText ? { emptyText } : undefined}
        scroll={{ y: height, x: resolvedX }}
        tableLayout="fixed"
        size="small"
        style={{ width: '100%' }}
      />
    </div>
  );
}

export default VirtualTable;
