import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { AppSelectField } from "./AppSelectField";

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
  actions?: ReactNode;
}

export function FilterBar({
  searchPlaceholder = "搜索...",
  searchValue = "",
  onSearchChange,
  filters = [],
  filterValues = {},
  onFilterChange,
  actions,
}: FilterBarProps) {
  return (
    <div
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
      {filters.map((f) => (
        <AppSelectField
          key={f.key}
          value={filterValues[f.key] || ""}
          onChange={(v) => onFilterChange?.(f.key, String(v ?? ""))}
          placeholder={f.label}
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
      {actions && <div style={{ marginLeft: "auto" }}>{actions}</div>}
    </div>
  );
}
