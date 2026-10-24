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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Table, Button, Tooltip, Drawer, Descriptions, Space } from "antd";
import type {
  TableProps,
  TableColumnsType,
  TablePaginationConfig,
  TableColumnType,
  TableColumnGroupType,
} from "antd";
import type { ReactNode, CSSProperties } from "react";
import { AlignJustify, Download } from "lucide-react";
import "../../styles/data-table.css";
import { EmptyState } from "./EmptyState";
// [W14-UX] 列配置/保存视图 + 右键上下文菜单
import { useContextMenu, type ContextMenuItem } from "./ContextMenu";
import {
  useTableColumnConfig,
  type ColumnLike,
} from "../data/useTableColumnConfig";
import { AppSkeleton } from "../feedback/Toast";
import { t } from "../../i18n/appI18n";
import {
  EXAM_STATUS_MAP,
  REPORT_STATUS_MAP,
  displayReportStatus,
} from "../../utils/statusMaps";

type AnyColumn<RecordType extends object> =
  TableColumnType<RecordType> | TableColumnGroupType<RecordType>;
type HiddenColumn = { hidden?: boolean };

export interface DataTableProps<RecordType extends object> extends Omit<
  TableProps<RecordType>,
  "size" | "pagination" | "locale" | "rowClassName"
> {
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
  /**
   * [v3.0.6.16-6] 完全隐藏工具栏 (导出 + 列设置)。
   * 默认 false —— 全站表格默认提供导出与列配置。
   */
  hideToolbar?: boolean;
  /**
   * [v3.0.6.16-6] 关闭自动列配置 (列显隐/排序/保存视图)。
   * 默认 false —— 未传 columnConfigKey 时按「路由 + 列签名」自动派生存储键。
   */
  disableColumnConfig?: boolean;
  /**
   * [v3.0.6.16-6] 自动排序: 为「有 dataIndex + 数据为标量」的列自动挂 sorter,
   * 免去每个页面手写 sorter。默认 true; 单列可传 `sorter: false` 退出, 整表传
   * `disableAutoSort` 退出。
   */
  autoSort?: boolean;
  /** [v3.0.6.16-6] 关闭自动排序 */
  disableAutoSort?: boolean;
  /**
   * [v3.0.6.16-6] 行选择 + 批量操作条。
   * 传 true 即开启勾选列; 选中 >=1 行时表格上方出现批量操作条。
   */
  selectable?: boolean;
  /** [v3.0.6.16-6] 批量操作条内容 (selectedKeys / selectedRows / clear) */
  bulkActions?: (
    selectedKeys: React.Key[],
    selectedRows: RecordType[],
    clear: () => void,
  ) => ReactNode;
  /** [v3.0.6.16-6] 受控选中行 */
  selectedRowKeys?: React.Key[];
  /** [v3.0.6.16-6] 选中行变化回调 */
  onSelectionChange?: (keys: React.Key[], rows: RecordType[]) => void;
  /**
   * [v3.0.6.16-6] 行钻取: 点击行打开详情抽屉。
   *  - `true`: 用内置抽屉展示该行全部字段 (key/value)
   *  - 函数: 自定义钻取行为 (如跳转/打开业务抽屉)
   */
  drillDown?: boolean | ((record: RecordType) => void);
  /** [v3.0.6.16-6] 内置钻取抽屉标题 */
  drillDownTitle?: (record: RecordType) => ReactNode;
  /** [v3.0.6.16-6] 内置钻取抽屉字段 (默认取全部标量字段) */
  drillDownFields?: Array<{
    label: string;
    key: string;
    render?: (value: unknown, record: RecordType) => ReactNode;
  }>;
}

export type TableDensity = "compact" | "comfortable";

export const DEFAULT_TABLE_PAGE_SIZE = 20;
export const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

/** [v3.0.6.16-6] 数值列识别: dataIndex 以 Amount/Count/Rate/Score/数量/率/分/量 等结尾 */
const NUMERIC_SUFFIX_RE =
  /(amount|count|rate|score|qty|quantity|total|num|number|percent|ratio|数量|总数|金额|次数|例数|率|分|量|数)$/i;

/** FNV-1a 字符串散列 (用于自动生成稳定的列配置 storageKey) */
function hashKey(input: string): string {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * [v3.0.6.16-6] 自动派生列配置 storageKey。
 *
 * 背景: 全站 672 张表只有 9 张传了 `columnConfigKey`, 导致「列设置」在
 * 98.7% 的表格上不可用 —— 客户点进长尾页会发现"这不是同一个产品"。
 * 这里按「当前路由 + 列 key 集合」派生稳定键: 同一张表刷新/重进保持配置,
 * 不同表互不干扰。
 */
function deriveColumnConfigKey(columns: TableColumnsType<object>): string {
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  const colSig = columns
    .map((c, i) => {
      const anyCol = c as TableColumnType<object> & {
        children?: TableColumnsType<object>;
      };
      if (Array.isArray(anyCol.children)) {
        return anyCol.children
          .map((ch, j) =>
            String(
              (ch as { key?: unknown }).key ??
                (ch as { dataIndex?: unknown }).dataIndex ??
                j,
            ),
          )
          .join("+");
      }
      return String(anyCol.key ?? anyCol.dataIndex ?? i);
    })
    .join("|");
  return `dt:${path}:${hashKey(colSig)}`;
}

/** [v3.0.6.15-5] 归一列宽时的最小列宽 (px) */
const MIN_COL_WIDTH = 120;
/** [v3.0.6.16-0] 单轮加权增量的步长 (px)。water-filling 逐轮分配, 避免一次性
 * 取模造成的列宽抖动; 该值仅影响分配粒度, 不构成上限。 */
const WIDTH_STEP = 20;

function lastDataIndexSegment(dataIndex: unknown): string {
  if (Array.isArray(dataIndex))
    return String(dataIndex[dataIndex.length - 1] ?? "");
  return dataIndex === undefined || dataIndex === null ? "" : String(dataIndex);
}

function hasWrapOptOut<RecordType extends object>(
  col: AnyColumn<RecordType>,
): boolean {
  return String((col as TableColumnType<RecordType>).className ?? "").includes(
    "dt-wrap",
  );
}

function isNumericColumn<RecordType extends object>(
  col: AnyColumn<RecordType>,
): boolean {
  const keyBase = String((col as TableColumnType<RecordType>).key ?? "");
  const base =
    lastDataIndexSegment((col as TableColumnType<RecordType>).dataIndex) ||
    keyBase;
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
    const next: TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    } = { ...anyCol };
    if (Array.isArray(anyCol.children)) {
      next.children = applyNumericAlign(anyCol.children, enabled);
    }
    if (enabled) {
      const numeric = isNumericColumn(anyCol);
      const alignRight = anyCol.align === "right";
      if (numeric && !anyCol.align) next.align = "right";
      if (
        (numeric || alignRight) &&
        !String(anyCol.className ?? "").includes("dt-num")
      ) {
        next.className = anyCol.className
          ? `${anyCol.className} dt-num`
          : "dt-num";
      }
    }
    return next;
  }) as TableColumnsType<RecordType>;
}

/**
 * [v3.0.6.16-6] 自动排序: 为「有 dataIndex + 首行取到标量值」的列自动挂 sorter。
 *
 * 目的: 全站 672 张表此前只有极少数手写了 sorter, 客户点列头无法排序 ——
 * 这在企业级 RIS 里是硬缺失。此处按首行数据推断列类型:
 *   - number  -> 数值比较
 *   - string  -> 本地化字符串比较 (zh-CN, 数字感知)
 *   - 其他/缺失 -> 不挂 sorter
 * 显式 `sorter: false` 的列、操作列 (无 dataIndex)、分组列的父节点不处理。
 */
function applyAutoSort<RecordType extends object>(
  columns: TableColumnsType<RecordType>,
  dataSource: RecordType[],
  enabled: boolean,
): TableColumnsType<RecordType> {
  if (!enabled || dataSource.length === 0) return columns;
  const sample = dataSource[0] as Record<string, unknown>;
  return columns.map((col) => {
    const anyCol = col as TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    };
    const next: TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    } = { ...anyCol };
    if (Array.isArray(anyCol.children)) {
      next.children = applyAutoSort(anyCol.children, dataSource, enabled);
      return next as TableColumnsType<RecordType>[number];
    }
    if (anyCol.sorter !== undefined && anyCol.sorter !== null)
      return next as TableColumnsType<RecordType>[number];
    if (anyCol.sorter === false)
      return next as TableColumnsType<RecordType>[number];
    const di = anyCol.dataIndex;
    if (typeof di !== "string" || di.length === 0)
      return next as TableColumnsType<RecordType>[number];
    const probe = sample[di];
    if (typeof probe === "number") {
      next.sorter = (a: RecordType, b: RecordType) =>
        ((a as Record<string, unknown>)[di] as number) -
        ((b as Record<string, unknown>)[di] as number);
    } else if (typeof probe === "string") {
      next.sorter = (a: RecordType, b: RecordType) =>
        String((a as Record<string, unknown>)[di] ?? "").localeCompare(
          String((b as Record<string, unknown>)[di] ?? ""),
          "zh-CN",
          { numeric: true },
        );
    }
    return next as TableColumnsType<RecordType>[number];
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
      const next: TableColumnType<RecordType> & {
        children?: TableColumnsType<RecordType>;
      } = { ...anyCol };
      next.children = applyDefaultEllipsis(anyCol.children, enabled);
      return next;
    }
    if (anyCol.ellipsis !== undefined) return col;
    if (isActionColumn(anyCol as AnyColumn<object>)) return col;
    if (isNumericColumn(anyCol)) return col;
    if (hasWrapOptOut(anyCol)) return col;
    const next: TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    } = { ...anyCol };
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
/**
 * [v3.0.6.16-0] 列类型权重 —— 等分不再"一刀切"
 *
 * v3.0.6.15-5 的等分算法给所有未声明 width 的列同一个 `each`, 导致
 * "操作列(按钮组) / 短 Tag / 长文本" 共享同一宽度 —— 实测 111 个操作列
 * 被等分到 120~200px 而按钮组本身需要 230px+, 只能溢出。
 * 现按列语义分配权重:
 *   - 操作列 (key = action/操作/…) 权重最高, 且有保底宽度
 *   - 状态/Tag 列权重低 (内容只有几个字)
 *   - 短 ID / 数字列权重低
 *   - 长文本 (声明了 ellipsis) 权重高
 */
const ACTION_COLUMN_MIN_WIDTH = 160;

function columnWeight<RecordType extends object>(
  col: AnyColumn<RecordType>,
): number {
  const c = col as TableColumnType<RecordType>;
  if (isActionColumn(c as AnyColumn<object>)) return 2.2;
  if (c.ellipsis !== undefined) return 1.8;
  if (isNumericColumn(c)) return 0.7;
  // 标题很短 + 无 ellipsis 的列, 通常是状态/Tag, 给窄一些
  const titleText = typeof c.title === "string" ? c.title : "";
  if (
    titleText.length > 0 &&
    titleText.length <= 6 &&
    c.ellipsis === undefined &&
    !c.render
  ) {
    return 0.85;
  }
  return 1;
}

/**
 * [v3.0.6.16-0] 列宽归一化 (water-filling 加权分配)
 *
 * 相对 v3.0.6.15-5 修掉 4 个算法缺陷:
 *  - **T2 截断不回收**: 旧实现 `Math.min(..., MAX_COL_WIDTH)` 之后剩余空间直接
 *    丢弃, 61 张表右侧永久留白。现改为 water-filling: 先给每列 MIN, 再按权重
 *    逐轮 +10px 分配, 直到预算用尽 —— 不存在"丢弃"。
 *  - **T3 反向撑爆**: 旧实现 `Math.max(containerWidth, MIN*n)`, 列数 ≥11 时
 *    1200 被 120×11=1320 反超。现直接以 containerWidth 为预算。
 *  - **T4 dt-wrap 计数不一致**: dt-wrap 列原先计入除数与 totalWidth 却不被赋值,
 *    现从分配中完全排除。
 *  - **T5/T6 无列类型感知**: 现按 columnWeight 分配, 操作列有保底宽度。
 */
export function normalizeColumnWidths<RecordType extends object>(
  columns: TableColumnsType<RecordType>,
  containerWidth: number,
): { columns: TableColumnsType<RecordType>; totalWidth: number } {
  type Flat = {
    col: AnyColumn<RecordType>;
    declared: number | null;
    weight: number;
    /** dt-wrap 列不参与分配, 也不计入 totalWidth */
    wrap: boolean;
  };
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
      const wrap = hasWrapOptOut(anyCol);
      leaves.push({
        col,
        declared: typeof w === "number" && w > 0 ? w : null,
        weight: wrap ? 0 : columnWeight(anyCol),
        wrap,
      });
    }
  };
  walk(columns);
  if (leaves.length === 0) return { columns, totalWidth: 0 };

  // 预算 = 容器宽度 (不再用 MIN*n 反超)
  let budget = Math.max(containerWidth, 0);
  const assigned = new Map<AnyColumn<RecordType>, number>();

  // ---- 1) 已声明宽度的列直接落位 ----
  for (const l of leaves) {
    if (l.declared !== null) {
      assigned.set(l.col, l.declared);
      budget -= l.declared;
    }
  }

  // ---- 2) 未声明宽度的列: water-filling 加权分配 ----
  const pending = leaves.filter((l) => l.declared === null && !l.wrap);
  if (pending.length > 0) {
    // 操作列保底
    let left = budget;
    for (const l of pending) {
      if (isActionColumn(l.col as AnyColumn<object>)) {
        assigned.set(l.col, ACTION_COLUMN_MIN_WIDTH);
        left -= ACTION_COLUMN_MIN_WIDTH;
      }
    }
    const rest = pending.filter((l) => assigned.get(l.col) === undefined);
    if (rest.length > 0) {
      let remaining = Math.max(left, MIN_COL_WIDTH * rest.length);
      // 每列先取 MIN
      for (const l of rest) assigned.set(l.col, MIN_COL_WIDTH);
      remaining -= MIN_COL_WIDTH * rest.length;
      // 加权增量: 每轮 +20px, 按权重比例分配, 直到预算耗尽
      const STEP = WIDTH_STEP;
      const totalWeight = rest.reduce((s, l) => s + l.weight, 0) || 1;
      while (remaining > 0 && totalWeight > 0) {
        let distributed = 0;
        for (const l of rest) {
          const add = Math.max(
            1,
            Math.round((remaining * l.weight) / totalWeight),
          );
          const cur = assigned.get(l.col) ?? MIN_COL_WIDTH;
          const next = Math.min(cur + add, cur + STEP);
          if (next > cur) {
            assigned.set(l.col, next);
            remaining -= next - cur;
            distributed += next - cur;
          }
        }
        if (distributed === 0) break; // 全部触顶, 退出避免死循环
      }
    }
  }

  // ---- 3) 回写 columns (含分组列递归) ----
  const totalWidth = Array.from(assigned.values()).reduce((s, v) => s + v, 0);
  const nextColumns = columns.map((col) => {
    const anyCol = col as TableColumnType<RecordType> & {
      children?: TableColumnsType<RecordType>;
    };
    if (Array.isArray(anyCol.children)) {
      // 分组列: 子列共享父级配额, 避免"整表 containerWidth 传入子列"导致撑爆
      const childBudget = Array.from(assigned.values()).reduce(
        (s, v) => s + v,
        0,
      );
      const n: TableColumnType<RecordType> & {
        children?: TableColumnsType<RecordType>;
      } = { ...anyCol };
      n.children = normalizeColumnWidths(
        anyCol.children,
        Math.max(childBudget, MIN_COL_WIDTH),
      ).columns;
      return n;
    }
    const w = assigned.get(col);
    if (w === undefined) return col; // dt-wrap / 无法确定宽度
    const current = (anyCol as { width?: number | string }).width;
    if (typeof current === "number" && current > 0) return col; // 已声明, 保持原样
    // [v3.0.6.16-0] T6: 操作列统一打上 dt-actions, 由 CSS 放行换行/横向滚动,
    // 避免"被排除 ellipsis + 全局 nowrap"导致的按钮组溢出。
    const next: TableColumnType<RecordType> = { ...anyCol, width: w };
    if (isActionColumn(anyCol as AnyColumn<object>)) {
      next.className = anyCol.className
        ? `${anyCol.className} dt-actions`
        : "dt-actions";
    }
    return next;
  }) as TableColumnsType<RecordType>;

  return { columns: nextColumns, totalWidth };
}

function getColumnValue(row: object, dataIndex: unknown): unknown {
  if (dataIndex === undefined || dataIndex === null) return undefined;
  const path = Array.isArray(dataIndex)
    ? dataIndex
    : String(dataIndex).split(".");
  return path.reduce<unknown>(
    (value, key) =>
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[key]
        : undefined,
    row,
  );
}

function isActionColumn(col: AnyColumn<object>): boolean {
  const c = col as TableColumnType<object>;
  const key = String(
    c.key ?? lastDataIndexSegment(c.dataIndex) ?? "",
  ).toLowerCase();
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

  const header = flat
    .map((c) => csvCell(typeof c.title === "string" ? c.title : ""))
    .join(",");
  const body = dataSource
    .map((row) =>
      flat.map((c) => csvCell(getColumnValue(row, c.dataIndex))).join(","),
    )
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
  showDensity = true,
  exportFileName = "table",
  density: densityProp,
  defaultDensity = "compact",
  onDensityChange,
  disableAutoNumericAlign = false,
  cellWrap = "ellipsis",
  layoutWidth = 1200,
  hideToolbar = false,
  disableColumnConfig = false,
  autoSort = true,
  disableAutoSort = false,
  selectable = false,
  bulkActions,
  selectedRowKeys: selectedRowKeysProp,
  onSelectionChange,
  drillDown,
  drillDownTitle,
  drillDownFields,
  tableLayout = "fixed",
  pagination: paginationProp,
  locale,
  scroll,
  loading,
  className,
  rowClassName: rowClassNameProp,
  onRow: onRowProp,
  rowSelection,
  ...restProps
}: DataTableProps<RecordType>) {
  // [v3.0.6.16-6] 密度: 受控优先, 非受控写内部 state, 切换后通知外部
  const [innerDensity, setInnerDensity] =
    useState<TableDensity>(defaultDensity);
  const density = densityProp ?? innerDensity;
  const toggleDensity = useCallback(() => {
    const next: TableDensity =
      density === "compact" ? "comfortable" : "compact";
    if (densityProp === undefined) setInnerDensity(next);
    onDensityChange?.(next);
  }, [density, densityProp, onDensityChange]);

  const pagination = useMemoPagination(
    showPagination,
    paginationProp,
    pageSize,
    paginationSize,
  );
  // [v3.0.6.16-6] 列配置默认启用: 未显式传 columnConfigKey 时按「路由 + 列签名」自动派生,
  // 使全站 672 张表都具备「列显隐 / 列排序 / 保存视图」(此前仅 9 张表可用)。
  const autoColumnConfigKey = useMemo(
    () => deriveColumnConfigKey(columns as unknown as TableColumnsType<object>),
    [columns],
  );
  const resolvedColumnConfigKey = disableColumnConfig
    ? null
    : (columnConfigKey ?? autoColumnConfigKey);
  // [W14-UX] 列配置 + 保存视图
  const columnConfig = useTableColumnConfig<ColumnLike>({
    columns: columns as unknown as ColumnLike[],
    storageKey: resolvedColumnConfigKey ?? "__datatable_default__",
    getTitle: (c) => c.title ?? "",
    alwaysVisible: alwaysVisibleColumns,
    getViewState,
    applyViewState,
  });
  const baseColumns = resolvedColumnConfigKey
    ? (columnConfig.visibleColumns as unknown as TableColumnsType<RecordType>)
    : columns;
  // [v3.0.6.16-0] T5: 用 ResizeObserver 实测容器宽度替代硬编码 1200。
  // 29 张表位于 420~960px 的 Modal 内、61 张位于半宽 Col 内, 按 1200 预算算
  // 会造成 1.3~2 倍横向溢出。首帧用 layoutWidth 兜底, 挂载后立即以实测值覆盖。
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [measuredWidth, setMeasuredWidth] = useState(0);
  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width);
      // 忽略 0 与明显异常值, 避免隐藏态/未布局时把预算压成 0
      if (w > 0) setMeasuredWidth(w);
    };
    measure();
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const effectiveLayoutWidth = measuredWidth > 0 ? measuredWidth : layoutWidth;

  // [v3.0.6.15-5] 列宽归一 -> 消除 tableLayout:auto 的列宽波动
  const normalized = useMemo(
    () => normalizeColumnWidths(baseColumns, effectiveLayoutWidth),
    [baseColumns, effectiveLayoutWidth],
  );
  // [v3.0.6.16-6] 自动排序: 按首行数据推断标量列, 自动挂 sorter (数字按数值, 其余按本地化字符串)
  const sortedColumns = useMemo(
    () =>
      applyAutoSort(
        normalized.columns,
        dataSource,
        autoSort && !disableAutoSort,
      ),
    [normalized.columns, dataSource, autoSort, disableAutoSort],
  );
  const effectiveColumns = useMemo(
    () =>
      applyDefaultEllipsis(
        applyNumericAlign(sortedColumns, !disableAutoNumericAlign),
        cellWrap === "ellipsis",
      ),
    [sortedColumns, disableAutoNumericAlign, cellWrap],
  );
  // [v3.0.6.16-0] T1 修复: **无条件**用归一后的列宽总和覆盖 scroll.x。
  // v3.0.6.15-5 只替换 x === 'max-content', 而全站还有 41 处调用点传了
  // 字面量数字 (如 scroll={{x:390}}); 归一后列宽总和与该数字严重不符时,
  // table-layout:fixed 会把列按比例压缩 (实测有表格被压到 ~78px/列)。
  const resolvedScroll = useMemo(() => {
    const next = { ...scroll } as NonNullable<TableProps<RecordType>["scroll"]>;
    if (normalized.totalWidth > 0) {
      // rowSelection / expandable 会额外插入列, 必须计入否则右侧留缝
      const extra = (rowSelection ? 48 : 0) + (restProps.expandable ? 48 : 0);
      next.x = normalized.totalWidth + extra;
    }
    return next;
  }, [scroll, normalized.totalWidth, rowSelection, restProps.expandable]);

  // [W14-UX] 右键上下文菜单
  const { open: openContextMenu, menu: contextMenuNode } = useContextMenu(
    contextMenuTestId ?? "data-table-context-menu",
  );

  // [v3.0.6.16-6] 行选择 (非受控兜底) + 钻取抽屉
  const [innerSelectedKeys, setInnerSelectedKeys] = useState<React.Key[]>([]);
  const selectedKeys = selectedRowKeysProp ?? innerSelectedKeys;
  const [drillRecord, setDrillRecord] = useState<RecordType | null>(null);

  const clearSelection = useCallback(() => {
    setInnerSelectedKeys([]);
    onSelectionChange?.([], []);
  }, [onSelectionChange]);

  const resolvedRowSelection = useMemo<
    TableProps<RecordType>["rowSelection"]
  >(() => {
    if (!selectable) return rowSelection;
    const base = (rowSelection ?? {}) as NonNullable<
      TableProps<RecordType>["rowSelection"]
    >;
    return {
      ...base,
      selectedRowKeys: selectedKeys,
      onChange: (keys, rows) => {
        if (selectedRowKeysProp === undefined) setInnerSelectedKeys(keys);
        onSelectionChange?.(keys, rows);
        (
          base.onChange as
            ((k: React.Key[], r: RecordType[]) => void) | undefined
        )?.(keys, rows);
      },
    };
  }, [
    selectable,
    rowSelection,
    selectedKeys,
    selectedRowKeysProp,
    onSelectionChange,
  ]);

  const selectedRows = useMemo(() => {
    if (!selectable || selectedKeys.length === 0) return [] as RecordType[];
    const keyOf = (r: RecordType, i: number): React.Key => {
      if (typeof rowKey === "function") return rowKey(r);
      const k = (r as Record<string, unknown>)[rowKey as string];
      return (k as React.Key) ?? i;
    };
    return dataSource.filter((r, i) => selectedKeys.includes(keyOf(r, i)));
  }, [selectable, selectedKeys, dataSource, rowKey]);

  const openDrillDown = useCallback(
    (record: RecordType) => {
      if (typeof drillDown === "function") drillDown(record);
      else setDrillRecord(record);
    },
    [drillDown],
  );

  const hasData = dataSource.length > 0;
  const handleExport = useCallback(() => {
    exportCsv(effectiveColumns, dataSource, exportFileName);
  }, [effectiveColumns, dataSource, exportFileName]);

  const showExportBtn = showExport && hasData;
  // [v3.0.6.16-6] 工具栏默认显示: 全站 672 张表此前 0 处传 toolbar, 导致
  // 「导出 CSV」按钮 (showExportBtn 挂在 showToolbar 内) 在 98.7% 的表格上
  // 永不渲染 —— 客户在任意页面右上角找不到导出。现默认渲染工具栏, 内含
  // 导出 + 列设置; 需要完全隐藏时传 hideToolbar。
  const showToolbar = !hideToolbar;

  const toolbarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2, 8px)",
    padding: "8px 12px",
    borderBottom: "1px solid var(--border-color, #e2e8f0)",
    background: "var(--bg-card)",
    flexWrap: "wrap",
  };

  // [v3.0.6.16-6] 批量操作条样式 (与工具栏同构, 用主色底以示"已进入批量态")
  const bulkBarStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "var(--space-2, 8px)",
    padding: "8px 12px",
    borderBottom: "1px solid var(--color-primary-200, #bfdbfe)",
    background: "var(--color-primary-50, #eff6ff)",
    flexWrap: "wrap",
  };

  return (
    <div
      ref={wrapRef}
      className={`data-table data-table--${density} ${className ?? ""}`}
    >
      {contextMenuNode}
      {/* [v3.0.6.16-6] 批量操作条: 选中 >=1 行时出现 */}
      {selectable && selectedKeys.length > 0 && (
        <div style={bulkBarStyle} data-testid="data-table-bulk-bar">
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--color-primary-700, #1d4ed8)",
            }}
          >
            {t("ui4Tables.bulk.selected").replace(
              "{n}",
              String(selectedKeys.length),
            )}
          </span>
          <div style={{ flex: 1 }} />
          <Space size={8}>
            {bulkActions?.(selectedKeys, selectedRows, clearSelection)}
            <Button
              size="small"
              type="text"
              onClick={clearSelection}
              data-testid="data-table-bulk-clear"
            >
              {t("ui4Tables.bulk.clear")}
            </Button>
          </Space>
        </div>
      )}
      {showToolbar && (
        <div style={toolbarStyle} data-testid="data-table-toolbar">
          {toolbar}
          <div style={{ flex: 1 }} />
          {toolbarExtra}
          {resolvedColumnConfigKey && columnConfig.toolbar}
          {showDensity && (
            <Tooltip title={t("ui4Tables.density.tooltip")}>
              <Button
                size="small"
                type="text"
                icon={<AlignJustify size={14} />}
                onClick={toggleDensity}
                data-testid="data-table-density"
                aria-label={t("ui4Tables.density.label")}
              >
                {density === "compact"
                  ? t("ui4Tables.density.compact")
                  : t("ui4Tables.density.comfortable")}
              </Button>
            </Tooltip>
          )}
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
        rowSelection={resolvedRowSelection}
        loading={
          loading
            ? {
                spinning: true,
                indicator: (
                  <div
                    style={{
                      padding: "var(--space-4, 16px)",
                      maxWidth: 720,
                      width: "100%",
                    }}
                  >
                    <AppSkeleton rows={4} columns={4} />
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
                    ? (
                        rowClassNameProp as (
                          r: RecordType,
                          i: number,
                          s: number,
                        ) => string
                      )(record, index, -1)
                    : (rowClassNameProp ?? "");
                return [zebraCls, custom].filter(Boolean).join(" ");
              }
            : undefined
        }
        onRow={(record, index) => {
          const base = onRowProp?.(record, index) ?? {};
          const next: Record<string, unknown> = { ...base };
          if (contextMenuItems) {
            next["onContextMenu"] = (event: React.MouseEvent) => {
              event.preventDefault();
              const items = contextMenuItems(record, index ?? 0);
              if (items.length > 0) openContextMenu(event, items);
            };
          }
          // [v3.0.6.16-6] 行钻取: 整行可点 (原有 onClick 优先, 不覆盖调用方行为)
          if (drillDown && !base.onClick) {
            next["onClick"] = () => openDrillDown(record);
            next["style"] = {
              ...(base.style as CSSProperties | undefined),
              cursor: "pointer",
            };
          }
          return next as ReturnType<
            NonNullable<TableProps<RecordType>["onRow"]>
          >;
        }}
      />
      {/* [v3.0.6.16-6] 内置钻取抽屉: drillDown={true} 时展示该行全部标量字段 */}
      {drillDown === true && (
        <Drawer
          open={drillRecord !== null}
          onClose={() => setDrillRecord(null)}
          width={560}
          destroyOnClose
          title={
            drillRecord
              ? (drillDownTitle?.(drillRecord) ??
                t("ui4Tables.drillDown.title"))
              : t("ui4Tables.drillDown.title")
          }
          data-testid="data-table-drill-down"
        >
          {drillRecord && (
            <Descriptions column={1} size="small" bordered>
              {(
                drillDownFields ??
                (inferDrillDownFields(
                  drillRecord,
                  effectiveColumns as unknown as TableColumnsType<object>,
                ) as Array<{
                  label: string;
                  key: string;
                  render?: (value: unknown, record: RecordType) => ReactNode;
                }>)
              ).map((f) => (
                <Descriptions.Item key={f.key} label={f.label}>
                  {f.render
                    ? f.render(
                        (drillRecord as Record<string, unknown>)[f.key],
                        drillRecord,
                      )
                    : formatDrillDownValue(
                        (drillRecord as Record<string, unknown>)[f.key],
                      )}
                </Descriptions.Item>
              ))}
            </Descriptions>
          )}
        </Drawer>
      )}
    </div>
  );
}

/**
 * [v3.0.6.16-6] 未显式提供 drillDownFields 时, 取该行全部标量字段。
 *
 * [F-9] 字段标签优先取列定义的 title (页面已给出中文表头), 操作列跳过;
 *       没有对应列的字段用键名人性化, 绝不把机器键 (createdTime) 直接当标签。
 */
function inferDrillDownFields(
  record: object,
  columns: TableColumnsType<object>,
): Array<{ label: string; key: string }> {
  const titleMap = buildColumnTitleMap(columns);
  return Object.entries(record)
    .filter(
      ([, v]) =>
        v === null || ["string", "number", "boolean"].includes(typeof v),
    )
    .map(([key]) => ({
      label: titleMap.get(key) ?? humanizeFieldKey(key),
      key,
    }));
}

/** [F-9] 列定义 → 字段名/标题 映射 (递归分组列, 跳过操作列) */
function buildColumnTitleMap(
  columns: TableColumnsType<object>,
): Map<string, string> {
  const map = new Map<string, string>();
  const walk = (cols: TableColumnsType<object>): void => {
    for (const col of cols) {
      const anyCol = col as TableColumnType<object> & {
        children?: TableColumnsType<object>;
      };
      if (Array.isArray(anyCol.children)) {
        walk(anyCol.children);
        continue;
      }
      if (isActionColumn(anyCol as AnyColumn<object>)) continue;
      const title = anyCol.title;
      if (typeof title !== "string" || title.trim() === "") continue;
      const keys: string[] = [];
      if (typeof anyCol.dataIndex === "string" && anyCol.dataIndex) {
        keys.push(anyCol.dataIndex);
      }
      if (typeof anyCol.key === "string" && anyCol.key) keys.push(anyCol.key);
      for (const key of keys) {
        if (!map.has(key)) map.set(key, title.trim());
      }
    }
  };
  walk(columns);
  return map;
}

/** [F-9] 键名人性化兜底 (createdTime → Created Time) */
function humanizeFieldKey(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  if (!words) return key;
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * [F-9] 已知临床枚举 → 本地化标签 (复用仓库既有状态映射, 不另造映射表)。
 * 未命中的值原样返回。
 */
function formatDrillDownEnum(value: string): string {
  const key = value.trim();
  if (!key) return value;
  if (typeof REPORT_STATUS_MAP[key] === "string")
    return displayReportStatus(key);
  if (typeof EXAM_STATUS_MAP[key] === "string") return EXAM_STATUS_MAP[key];
  return value;
}

function formatDrillDownValue(value: unknown): ReactNode {
  if (value === null || value === undefined) return "-";
  if (typeof value === "boolean") return value ? "是" : "否";
  if (typeof value === "string") return formatDrillDownEnum(value);
  return String(value);
}

function useMemoPagination(
  showPagination: boolean,
  paginationProp: TableProps<object>["pagination"],
  pageSize: number,
  paginationSize: "small" | "large",
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
