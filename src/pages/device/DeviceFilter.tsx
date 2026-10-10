import { C, DEVICE_CATEGORIES, DEVICE_STATUSES } from './DeviceStatusBadge'

interface DeviceFilterProps {
  search: string
  onSearchChange: (value: string) => void
  filterType: string
  onFilterTypeChange: (value: string) => void
  filterStatus: string
  onFilterStatusChange: (value: string) => void
  filterMfg: string
  onFilterMfgChange: (value: string) => void
  manufacturers: string[]
  deviceCount: number
}

export function DeviceFilter({
  search, onSearchChange,
  filterType, onFilterTypeChange,
  filterStatus, onFilterStatusChange,
  filterMfg, onFilterMfgChange,
  manufacturers, deviceCount,
}: DeviceFilterProps) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, padding: '12px 16px', border: `1px solid ${C.border}`,
      marginBottom: 'var(--space-4, 16px)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center'
    }}>
      <div style={{ position: 'relative', flex: '0 0 200px' }}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            width: 13, height: 13, position: 'absolute', left: 10, top: '50%',
            transform: 'translateY(-50%)', color: C.textLight
          }}
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="搜索设备名称/型号/厂商..."
          style={{
            width: '100%', padding: '7px 10px 7px 32px', borderRadius: 8,
            border: `1px solid ${C.border}`, fontSize: 12, boxSizing: 'border-box',
          }}
        />
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        {DEVICE_CATEGORIES.map(cat => (
          <button key={cat} onClick={() => onFilterTypeChange(cat)} style={{
            padding: '5px 12px', borderRadius: 20, border: `1px solid ${filterType === cat ? C.accent : C.border}`,
            background: filterType === cat ? `${C.accent}10` : 'transparent',
            color: filterType === cat ? C.accent : C.textMid, fontSize: 12, fontWeight: filterType === cat ? 700 : 500,
            cursor: 'pointer', transition: 'all 0.15s'
          }}>{cat}</button>
        ))}
      </div>
      <select value={filterStatus} onChange={e => onFilterStatusChange(e.target.value)} style={{
        padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12,
        color: C.textMid, cursor: 'pointer'
      }}>
        {DEVICE_STATUSES.map(s => <option key={s}>{s}</option>)}
      </select>
      <select value={filterMfg} onChange={e => onFilterMfgChange(e.target.value)} style={{
        padding: '7px 10px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 12,
        color: C.textMid, cursor: 'pointer'
      }}>
        {manufacturers.map(m => <option key={m}>{m}</option>)}
      </select>
      <span style={{ fontSize: 12, color: C.textLight, marginLeft: 'auto' }}>
        共 {deviceCount} 台设备
      </span>
    </div>
  )
}
