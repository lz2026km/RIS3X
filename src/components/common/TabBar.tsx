import type { ReactNode } from 'react'

interface Tab {
  key: string
  label: string
  icon?: ReactNode
  badge?: number
}

interface TabBarProps {
  tabs: Tab[]
  activeKey: string
  onChange: (key: string) => void
}

export function TabBar({ tabs, activeKey, onChange }: TabBarProps) {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-1, 4px)', borderBottom: '2px solid #e2e8f0', marginBottom: 18 }}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: activeKey === tab.key ? 700 : 500,
            background: 'transparent',
            color: activeKey === tab.key ? 'var(--color-primary-800)' : '#475569',
            borderBottom: `3px solid ${activeKey === tab.key ? 'var(--color-primary-800)' : 'transparent'}`,
            marginBottom: -2, transition: 'all 0.2s',
          }}
        >
          {tab.icon}{tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span style={{ background: 'var(--color-warning-600)', color: '#fff', fontSize: 12, fontWeight: 800, padding: '1px 5px', borderRadius: 10 }}>{tab.badge}</span>
          )}
        </button>
      ))}
    </div>
  )
}
