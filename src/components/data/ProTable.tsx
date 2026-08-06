/**
 * G005 放射RIS系统 v3.0.0 - Data 业务组件
 * Phase T2-W4: ProTable / Statistic / Descriptions / Tabs / Collapse
 */

import { useState, useMemo, type ReactNode } from 'react';
import {
  Table,
  Statistic as AntStatistic,
  Descriptions,
  Tabs,
  Collapse,
  Input,
  Space,
  Segmented,
  Empty,
  type TableProps,
  type TablePaginationConfig,
} from 'antd';
import type { ColumnType } from 'antd/es/table';
import { SearchOutlined, ReloadOutlined, DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useDebounce } from '@utils/performance';

// ============= ProTable 业务封装(搜索 + 筛选 + 分页 + 导出) =============
export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

export interface ProTableProps<T extends object = Record<string, unknown>> extends Omit<TableProps<T>, 'dataSource' | 'columns' | 'rowKey'> {
  dataSource: T[];
  columns: ProColumn<T>[];
  rowKey: TableProps<T>['rowKey'];
  searchFields?: (keyof T)[];
  searchPlaceholder?: string;
  showToolbar?: boolean;
  onExport?: (data: T[]) => void;
  onRefresh?: () => void;
  pageSize?: number;
  rowSelection?: TableProps<T>['rowSelection'];
}

export interface ProColumn<T extends object = Record<string, unknown>> {
  title: ReactNode;
  dataIndex?: keyof T | string | readonly string[];
  key?: string;
  width?: number | string;
  fixed?: 'left' | 'right';
  sorter?: ColumnType<T>['sorter'];
  sortOrder?: ColumnType<T>['sortOrder'];
  defaultSortOrder?: ColumnType<T>['defaultSortOrder'];
  filters?: ColumnType<T>['filters'];
  onFilter?: ColumnType<T>['onFilter'];
  filterMultiple?: boolean;
  filteredValue?: ColumnType<T>['filteredValue'];
  defaultFilteredValue?: ColumnType<T>['defaultFilteredValue'];
  render?: (value: unknown, record: T, index: number) => ReactNode;
  align?: 'left' | 'center' | 'right';
  ellipsis?: boolean;
  searchable?: boolean;
  hidden?: boolean;
}

function getColumnValue<T extends object>(row: T, field: keyof T | string | readonly string[]): unknown {
  const path = Array.isArray(field) ? field : String(field).split('.');
  return path.reduce<unknown>((value, key) =>
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)[key]
      : undefined, row);
}

function isActionColumn<T extends object>(column: ProColumn<T>): boolean {
  const dataIndex = Array.isArray(column.dataIndex)
    ? column.dataIndex[column.dataIndex.length - 1]
    : column.dataIndex;
  const key = String(column.key ?? dataIndex ?? '').toLowerCase();
  return ['action', 'actions', 'operation', 'operations', '操作'].includes(key);
}

export function ProTable<T extends object = Record<string, unknown>>({
  dataSource,
  columns,
  rowKey,
  searchFields,
  searchPlaceholder,
  showToolbar = true,
  onExport,
  onRefresh,
  pageSize = DEFAULT_TABLE_PAGE_SIZE,
  rowSelection,
  pagination: paginationProp,
  locale,
  scroll,
  size = 'middle',
  ...restProps
}: ProTableProps<T>) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);

  // 过滤 + 搜索
  const filteredData = useMemo(() => {
    if (!debouncedSearch.trim()) return dataSource;
    const q = debouncedSearch.toLowerCase();
    const fields = (searchFields ?? columns
      .filter((c) => c.searchable && c.dataIndex && !Array.isArray(c.dataIndex))
      .map((c) => c.dataIndex as keyof T));
    if (fields.length === 0) {
      return dataSource.filter((row) =>
        Object.values(row).some((value) =>
          typeof value === 'string' && value.toLowerCase().includes(q)
        )
      );
    }
    return dataSource.filter((row) =>
      fields.some((field) => {
        const value = getColumnValue(row, field);
        return String(value ?? '').toLowerCase().includes(q);
      })
    );
  }, [dataSource, debouncedSearch, columns, searchFields]);

  const visibleColumns = useMemo(
    () => columns
      .filter((column) => !column.hidden)
      .map((column) => isActionColumn(column) && !column.fixed
        ? { ...column, fixed: 'right' as const }
        : column),
    [columns]
  );

  const pagination = useMemo<TablePaginationConfig | false>(() => {
    if (paginationProp === false) return false;
    return {
      pageSize,
      showSizeChanger: true,
      showQuickJumper: true,
      showTotal: (total) => `${t('common.total')} ${total} ${t('common.records')}`,
      pageSizeOptions: [...TABLE_PAGE_SIZE_OPTIONS],
      ...paginationProp,
    };
  }, [pageSize, paginationProp, t]);

  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)' }}>
      {showToolbar && (
        <div
          style={{
            display: 'flex',
            gap: 8,
            padding: 16,
            borderBottom: '1px solid var(--border-subtle)',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Input
            prefix={<SearchOutlined />}
            placeholder={searchPlaceholder ?? t('common.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ width: 280 }}
            aria-label={t('common.search')}
          />
          <div style={{ flex: 1 }} />
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              style={{
                border: '1px solid var(--border-default)',
                background: 'transparent',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              aria-label={t('common.refresh')}
            >
              <ReloadOutlined /> {t('common.refresh')}
            </button>
          )}
          {onExport && filteredData.length > 0 && (
            <button
              type="button"
              onClick={() => onExport(filteredData)}
              style={{
                border: '1px solid var(--border-default)',
                background: 'transparent',
                padding: '4px 12px',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              aria-label={t('common.export')}
            >
              <DownloadOutlined /> {t('common.export')}
            </button>
          )}
        </div>
      )}

      <Table<T>
        {...restProps}
        rowKey={rowKey}
        columns={visibleColumns as never}
        dataSource={filteredData}
        pagination={pagination}
        rowSelection={rowSelection}
        scroll={{ x: 'max-content', ...scroll }}
        size={size}
        locale={{ emptyText: <Empty description={t('common.noData')} />, ...locale }}
      />
    </div>
  );
}

// ============= Statistic 业务封装 =============
export interface AppStatisticProps {
  title: ReactNode;
  value: number | string;
  precision?: number;
  prefix?: ReactNode;
  suffix?: ReactNode;
  /** 趋势(对比上一周期) */
  trend?: { value: number; positive: boolean };
  /** 颜色 */
  color?: string;
  /** 帮助 */
  help?: ReactNode;
  /** 加载 */
  loading?: boolean;
}

export function AppStatistic({
  title,
  value,
  precision = 0,
  prefix,
  suffix,
  trend,
  color,
  loading = false,
}: AppStatisticProps) {
  return (
    <AntStatistic
      title={
        <span style={{ color: 'var(--color-gray-600)' }}>{title}</span>
      }
      value={value}
      precision={precision}
      prefix={prefix}
      suffix={suffix}
      loading={loading}
      styles={{ content: {  color: color ?? 'var(--color-gray-900)', fontSize: 28, fontWeight: 600  } }}
    >
      {trend && (
        <div
          style={{
            fontSize: 12,
            color: trend.positive ? 'var(--color-success-600)' : 'var(--color-error-600)',
            marginTop: 4,
          }}
        >
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value)}% 较上期
        </div>
      )}
    </AntStatistic>
  );
}

// ============= Descriptions 业务封装 =============
export interface AppDescriptionsProps {
  title?: ReactNode;
  items: Array<{
    key: string;
    label: ReactNode;
    value: ReactNode;
    span?: number;
  }>;
  column?: number;
  bordered?: boolean;
  size?: 'default' | 'middle' | 'small';
}

export function AppDescriptions({
  title,
  items,
  column = 2,
  bordered = true,
  size = 'default',
}: AppDescriptionsProps) {
  return (
    <Descriptions
      title={title}
      column={column}
      bordered={bordered}
      size={size}
      items={items.map((item) => ({
        key: item.key,
        label: item.label,
        children: item.value,
        span: item.span,
      }))}
    />
  );
}

// ============= Tabs 业务封装 =============
export interface AppTabsProps {
  items: Array<{
    key: string;
    label: ReactNode;
    children: ReactNode;
    disabled?: boolean;
  }>;
  defaultActiveKey?: string;
  onChange?: (key: string) => void;
  type?: 'line' | 'card' | 'editable-card';
  size?: 'default' | 'small' | 'large';
  position?: 'top' | 'right' | 'bottom' | 'left';
  tabBarExtraContent?: ReactNode;
}

export function AppTabs({
  items,
  defaultActiveKey,
  onChange,
  type = 'line',
  size = 'default',
  position = 'top',
  tabBarExtraContent,
}: AppTabsProps) {
  return (
    <Tabs
      items={items.map((item) => ({
        key: item.key,
        label: item.label,
        children: item.children,
        disabled: item.disabled,
      }))}
      defaultActiveKey={defaultActiveKey}
      onChange={onChange}
      type={type}
      size={size}
      tabPosition={position}
      tabBarExtraContent={tabBarExtraContent}
    />
  );
}

// ============= Collapse 业务封装 =============
export interface AppCollapseProps {
  items: Array<{
    key: string;
    label: ReactNode;
    children: ReactNode;
    extra?: ReactNode;
    disabled?: boolean;
  }>;
  defaultActiveKey?: string | string[];
  accordion?: boolean;
  bordered?: boolean;
}

export function AppCollapse({
  items,
  defaultActiveKey,
  accordion = false,
  bordered = true,
}: AppCollapseProps) {
  return (
    <Collapse
      items={items.map((item) => ({
        key: item.key,
        label: item.label,
        children: item.children,
        extra: item.extra,
        disabled: item.disabled,
      }))}
      defaultActiveKey={defaultActiveKey as never}
      accordion={accordion}
      bordered={bordered}
    />
  );
}

// ============= Segmented Filter(业务) =============
export interface AppSegmentedFilterProps<T extends string> {
  options: Array<{ label: string; value: T }>;
  value: T;
  onChange: (value: T) => void;
}

export function AppSegmentedFilter<T extends string>({
  options,
  value,
  onChange,
}: AppSegmentedFilterProps<T>) {
  return (
    <Segmented
      options={options}
      value={value}
      onChange={(v) => onChange(v as T)}
    />
  );
}

// ============= PageContainer(页面容器) =============
export interface PageContainerProps {
  title?: ReactNode;
  extra?: ReactNode;
  breadcrumb?: ReactNode;
  children: ReactNode;
  /** 是否有 padding */
  noPadding?: boolean;
  /** 是否有 background */
  noBackground?: boolean;
}

export function PageContainer({
  title,
  extra,
  breadcrumb,
  children,
  noPadding = false,
  noBackground = false,
}: PageContainerProps) {
  return (
    <div
      style={{
        background: noBackground ? 'transparent' : 'var(--content-bg, var(--color-gray-50))',
        minHeight: '100%',
        padding: noPadding ? 0 : 'var(--space-6)',
      }}
    >
      {(title || extra) && (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {breadcrumb}
          {title && (
            <h1
              style={{
                fontSize: 'var(--font-size-3xl)',
                fontWeight: 700,
                color: 'var(--content-fg, var(--color-gray-900))',
                margin: 0,
              }}
            >
              {title}
            </h1>
          )}
          {extra && <Space>{extra}</Space>}
        </header>
      )}
      {children}
    </div>
  );
}
