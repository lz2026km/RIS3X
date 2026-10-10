import { severityColor } from '../../theme/statusTokens'

export const C = {
  primary: 'var(--color-primary-800)',
  primaryLight: '#2d5a87',
  primaryLighter: '#e8f0f8',
  accent: 'var(--color-primary-500)',
  white: 'var(--bg-card)',
  bg: 'var(--bg-primary)',
  border: 'var(--border-color)',
  textDark: 'var(--color-primary-800)',
  textMid: 'var(--text-secondary)',
  textLight: 'var(--text-muted)',
  success: '#059669',
  warning: 'var(--color-warning-600)',
  danger: 'var(--color-error-600)',
  info: 'var(--color-primary-600)',
}

export const STATUS_COLORS: Record<string, string> = {
  '使用中': severityColor('success'),
  '空闲': severityColor('info'),
  '维护中': severityColor('warning'),
  '维修中': severityColor('critical'),
  '已报废': severityColor('neutral'),
}

export const MODALITY_LABELS: Record<string, { label: string; color: string }> = {
  'CT': { label: 'CT', color: '#7c3aed' },
  'MR': { label: 'MR', color: 'var(--color-primary-600)' },
  'DR': { label: 'DR', color: '#059669' },
  'DSA': { label: 'DSA', color: 'var(--color-error-600)' },
  'MG': { label: 'MG', color: 'var(--color-warning-600)' },
  'GI': { label: 'GI', color: 'var(--color-info-600)' },
  '骨密度': { label: '骨密度', color: '#4f46e5' },
}

export const DEVICE_CATEGORIES = ['全部', 'CT', 'MR', 'DR', 'DSA', 'MG', 'GI', '骨密度']

export const DEVICE_STATUSES = ['全部', '空闲', '使用中', '维护中', '故障', '停用']

export const PIE_COLORS = ['var(--color-primary-500)', '#059669', 'var(--color-warning-600)', 'var(--color-error-600)', '#60a5fa', 'var(--color-info-600)', '#ea580c', '#4f46e5']

export function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--space-1, 4px)',
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: `${color}18`, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}

export function ModalityBadge({ modality }: { modality: string }) {
  const cfg = MODALITY_LABELS[modality] || { label: modality, color: 'var(--text-muted, #94a3b8)' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 6,
      fontSize: 12, fontWeight: 700,
      background: `${cfg.color}15`, color: cfg.color, letterSpacing: 0.3
    }}>
      {cfg.label}
    </span>
  )
}

export function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  const barColor = color || (pct > 90 ? C.danger : pct > 70 ? C.warning : C.success)
  return (
    <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: barColor,
        borderRadius: 3, transition: 'width 0.4s ease'
      }} />
    </div>
  )
}

export function StatCard({ label, value, icon, color, subtitle }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; subtitle?: string
}) {
  return (
    <div style={{
      background: C.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(30,58,95,0.06)', display: 'flex', alignItems: 'center', gap: 14
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 24, fontWeight: 800, color: C.textDark, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{label}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.textLight, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
  )
}
