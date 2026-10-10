import type { QuickTimeValue } from './types'
import {
  ACCENT, GRAY, WHITE, ACTION_TYPES, MODULES, LOG_SOURCES, QUICK_TIME_FILTERS
} from './constants'
import { Search, X, RefreshCw } from 'lucide-react'

interface LogFilterProps {
  searchText: string
  onSearchChange: (v: string) => void
  actionFilter: string
  onActionFilterChange: (v: string) => void
  moduleFilter: string
  onModuleFilterChange: (v: string) => void
  userFilter: string
  onUserFilterChange: (v: string) => void
  sourceFilter: string
  onSourceFilterChange: (v: string) => void
  dateFrom: string
  onDateFromChange: (v: string) => void
  dateTo: string
  onDateToChange: (v: string) => void
  quickTimeFilter: QuickTimeValue
  onQuickTimeFilter: (v: QuickTimeValue) => void
  onReset: () => void
  allUserNames: string[]
}

const filterBtnStyle = (active: boolean) => ({
  padding: '5px 12px', borderRadius: 6, border: `1px solid ${active ? ACCENT : '#e2e8f0'}`,
  background: active ? `${ACCENT}15` : WHITE, color: active ? ACCENT : GRAY,
  fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s',
})

const inputStyle = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
  background: WHITE, color: 'var(--color-primary-800)', fontSize: 12, width: '100%' as const,
}

const selectStyle = {
  padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
  background: WHITE, color: 'var(--color-primary-800)', fontSize: 12, cursor: 'pointer' as const,
}

export default function LogFilter({
  searchText, onSearchChange,
  actionFilter, onActionFilterChange,
  moduleFilter, onModuleFilterChange,
  userFilter, onUserFilterChange,
  sourceFilter, onSourceFilterChange,
  dateFrom, onDateFromChange,
  dateTo, onDateToChange,
  quickTimeFilter, onQuickTimeFilter,
  onReset, allUserNames,
}: LogFilterProps) {
  return (
    <div style={{
      background: WHITE, borderRadius: 10, padding: 'var(--space-4, 16px)', border: '1px solid #e2e8f0',
      marginBottom: 'var(--space-4, 16px)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY, marginRight: 'var(--space-1, 4px)' }}>快捷筛选:</span>
          {QUICK_TIME_FILTERS.map(filter => (
            <button
              key={filter.value}
              onClick={() => onQuickTimeFilter(filter.value)}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: `1px solid ${quickTimeFilter === filter.value ? ACCENT : '#e2e8f0'}`,
                background: quickTimeFilter === filter.value ? `${ACCENT}15` : WHITE,
                color: quickTimeFilter === filter.value ? ACCENT : GRAY,
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)',
          border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 12px', background: '#fafbfc',
        }}>
          <Search size={14} style={{ color: '#94a3b8', flexShrink: 0 }} />
          <input
            value={searchText}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜索用户 / 目标 / 日志ID..."
            style={{ border: 'none', fontSize: 12, width: '100%', background: 'transparent' }}
          />
          {searchText && (
            <button onClick={() => onSearchChange('')} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              <X size={14} color={GRAY} />
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>操作类型:</span>
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', flexWrap: 'wrap' }}>
            {ACTION_TYPES.map(type => (
              <button
                key={type}
                onClick={() => onActionFilterChange(type)}
                style={filterBtnStyle(actionFilter === type)}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>来源:</span>
          <div style={{ display: 'flex', gap: 'var(--space-1, 4px)' }}>
            {LOG_SOURCES.map(source => (
              <button
                key={source}
                onClick={() => onSourceFilterChange(source)}
                style={filterBtnStyle(sourceFilter === source)}
              >
                {source}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>模块:</span>
          <select
            value={moduleFilter}
            onChange={e => onModuleFilterChange(e.target.value)}
            style={selectStyle}
          >
            {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>用户:</span>
          <select
            value={userFilter}
            onChange={e => onUserFilterChange(e.target.value)}
            style={selectStyle}
          >
            {allUserNames.map(name => <option key={name} value={name}>{name}</option>)}
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 12, color: GRAY, whiteSpace: 'nowrap' }}>日期:</span>
          <input
            type="date"
            value={dateFrom}
            onChange={e => onDateFromChange(e.target.value)}
            style={inputStyle}
          />
          <span style={{ color: GRAY }}>-</span>
          <input
            type="date"
            value={dateTo}
            onChange={e => onDateToChange(e.target.value)}
            style={inputStyle}
          />
        </div>

        <button
          onClick={onReset}
          style={{
            padding: '6px 12px', borderRadius: 6, border: '1px solid #e2e8f0',
            background: WHITE, color: GRAY, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
          }}
        >
          <RefreshCw size={12} />
          重置筛选
        </button>
      </div>
    </div>
  )
}
