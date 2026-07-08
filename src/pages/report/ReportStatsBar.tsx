import React from 'react'

const PRIMARY = '#1e3a5f'
const GRAY = '#64748b'
const WHITE = '#ffffff'

export interface ReportStatCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
  sub?: string
  onClick?: () => void
}

export default function ReportStatsBar({ cards }: { cards: ReportStatCardProps[] }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards.length, 6)}, 1fr)`,
      gap: 12, marginBottom: 14,
    }}>
      {cards.map((c, i) => (
        <StatCard key={i} {...c} />
      ))}
    </div>
  )
}

export function StatCard({ label, value, icon, color, sub, onClick }: ReportStatCardProps) {
  return (
    <div onClick={onClick} style={{
      background: WHITE, borderRadius: 10, padding: '14px 18px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: onClick ? 'pointer' : 'default', transition: 'all 0.2s',
      flex: 1, minWidth: 160,
    }}
      onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(30,58,95,0.12)' }}
      onMouseLeave={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 3px rgba(0,0,0,0.05)' }}
    >
      <div style={{ width: 44, height: 44, borderRadius: 10, background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: PRIMARY, lineHeight: 1, marginBottom: 3 }}>{value}</div>
        <div style={{ fontSize: 12, color: GRAY, fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>{sub}</div>}
      </div>
    </div>
  )
}
