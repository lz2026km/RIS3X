import type { ReactNode } from "react";
import { Search, RotateCcw } from "lucide-react";
import { DatePicker } from "antd";
import type { Dayjs } from "dayjs";
import { AppSelectField } from "./AppSelectField";

const { RangePicker } = DatePicker;

interface FilterOption {
  key: string;
  label: string;
  options: Array<{ value: string; label: string }>;
}

interface FilterBarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filters?: FilterOption[];
  filterValues?: Record<string, string>;
  onFilterChange?: (key: string, value: string) => void;
  /**
   * [v3.0.6.16-6] 时间范围 (对标企业 RIS 的 6 维筛选: 时间/关键词/状态/类型/科室/人员)
   */
  dateRange?: {
    value?: [Dayjs | null, Dayjs | null] | null;
    onChange?: (range: [Dayjs | null, Dayjs | null] | null) => void;
    placeholder?: [string, string];
    width?: number;
  };
  /** [v3.0.6.16-6] 额外筛选控件 (科室/人员等业务字段选择器) */
  extra?: ReactNode;
  /** [v3.0.6.16-6] 重置: 传了才显示「重置」按钮 */
  onReset?: () => void;
  resetLabel?: string;
  /** [v3.0.6.16-6] 已生效筛选条件的摘要 (如「共 128 条 / 已筛选 32 条」) */
  summary?: ReactNode;
  actions?: ReactNode;
}

export function FilterBar({
  searchPlaceholder = "搜索...",
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  dateRange,
  extra,
  onReset,
  resetLabel = "重置",
  summary,
  actions,
}: FilterBarProps) {
  return (
    <div
      data-testid="filter-bar"
      style={{
        background: "var(--bg-card)",
        borderRadius: 12,
        padding: "12px 16px",
        border: "1px solid var(--border-color)",
        marginBottom: "var(--space-4, 16px)",
        display: "flex",
        gap: 10,
        flexWrap: "wrap",
        alignItems: "center",
      }}
    >
      {onSearchChange && (
        <div style={{ position: "relative", flex: "0 0 220px" }}>
          <Search
            size={13}
            color="#94a3b8"
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
            }}
          />
          <input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            style={{
              width: "100%",
              padding: "7px 10px 7px 32px",
              borderRadius: 8,
              border: "1px solid #e2e8f0",
              fontSize: 12,
              boxSizing: "border-box",
            }}
          />
        </div>
      )}
      {dateRange && (
        <RangePicker
          value={dateRange.value ?? null}
          onChange={(range) =>
            dateRange.onChange?.(
              range ? [range[0] ?? null, range[1] ?? null] : null,
            )
          }
          placeholder={dateRange.placeholder ?? ["开始日期", "结束日期"]}
          style={{ width: dateRange.width ?? 240 }}
          size="small"
        />
      )}
      {filters.map((f) => (
        <AppSelectField
          key={f.key}
          value={filterValues[f.key] || ""}
          onChange={(v) => onFilterChange?.(f.key, String(v ?? ""))}
          placeholder={f.label}
          aria-label={f.label}
          style={{
            padding: "7px 10px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            color: "#475569",
            cursor: "pointer",
          }}
          options={f.options}
        />
      ))}
      {extra}
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          data-testid="filter-bar-reset"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "7px 12px",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            background: "var(--bg-card)",
            color: "#475569",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <RotateCcw size={12} />
          {resetLabel}
        </button>
      )}
      {summary && (
        <span style={{ fontSize: 12, color: "#64748b" }}>{summary}</span>
      )}
      {actions && <div style={{ marginLeft: "auto" }}>{actions}</div>}
    </div>
  );
}
