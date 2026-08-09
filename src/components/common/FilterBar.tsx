import type { ReactNode } from 'react'

interface FilterOption {
  key: string
  label: string
  options: Array<{ value: string; label: string }>
}

interface FilterBarProps {
  searchPlaceholder?: string
  searchValue?: string
  onSearchChange?: (value: string) => void
  filters?: FilterOption[]
  filterValues?: Record<string, string>
  onFilterChange?: (key: string, value: string) => void
  actions?: ReactNode
}

export function FilterBar({ searchPlaceholder = '搜索...', searchValue = '', onSearchChange, filters = [], filterValues = {}, onFilterChange, actions }: FilterBarProps) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '12px 16px', border: '1px solid var(--border-color)', marginBottom: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
      {onSearchChange && (
        <div style={{ position: 'relative', flex: '0 0 220px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input value={searchValue} onChange={(e) => onSearchChange(e.target.value)} placeholder={searchPlaceholder}
            style={{ width: '100%', padding: '7px 10px 7px 32px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, outline: 'none', boxSizing: 'border-box' }} />
        </div>
      )}
      {filters.map((f) => (
        <select key={f.key} value={filterValues[f.key] || ''} onChange={(e) => onFilterChange?.(f.key, e.target.value)}
          style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12, color: '#475569', outline: 'none', cursor: 'pointer' }}>
          <option value="">{f.label}</option>
          {f.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ))}
      {actions && <div style={{ marginLeft: 'auto' }}>{actions}</div>}
    </div>
  )
}
