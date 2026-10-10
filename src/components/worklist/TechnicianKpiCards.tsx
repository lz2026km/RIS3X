// [G005 v3.0.6.11-100 Wave 1A] 技师 KPI 卡块: 完成数/平均时长/重拍率/设备占用率/按时签到率/平均等待
import { CheckCircle2, Clock, RefreshCw, Monitor, CalendarCheck, Timer } from 'lucide-react'

export interface KpiTotals {
  completedCount: number
  avgDurationMin: number
  retakeRate: number
  avgWaitTime: number
  deviceUtilization: number
  onTimeRate: number
}

interface Props {
  totals: KpiTotals | null
  loading?: boolean
}

const CARD_DEFS = (t: KpiTotals) => [
  { key: 'completedCount', label: '完成检查数', value: String(t.completedCount), unit: '项', color: '#059669', icon: <CheckCircle2 size={16} /> },
  { key: 'avgDurationMin', label: '平均检查时长', value: String(t.avgDurationMin), unit: 'min', color: 'var(--color-primary-600)', icon: <Timer size={16} /> },
  { key: 'retakeRate', label: '重拍率', value: String(t.retakeRate), unit: '%', color: 'var(--color-error-600)', icon: <RefreshCw size={16} /> },
  { key: 'deviceUtilization', label: '设备占用率', value: String(t.deviceUtilization), unit: '%', color: '#7c3aed', icon: <Monitor size={16} /> },
  { key: 'onTimeRate', label: '按时签到率', value: String(t.onTimeRate), unit: '%', color: '#0d9488', icon: <CalendarCheck size={16} /> },
  { key: 'avgWaitTime', label: '平均等待', value: String(t.avgWaitTime), unit: 'min', color: 'var(--color-warning-600)', icon: <Clock size={16} /> },
]

export default function TechnicianKpiCards({ totals, loading }: Props) {
  if (loading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }} data-testid="tech-kpi-cards">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} style={{
            height: 96, borderRadius: 12, background: 'var(--bg-deep)',
            border: '1px solid var(--border-color)', animation: 'pulse 1.2s ease-in-out infinite',
          }} />
        ))}
      </div>
    )
  }
  if (!totals) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }} data-testid="tech-kpi-cards">
      {CARD_DEFS(totals).map((c) => (
        <div key={c.key} style={{
          background: 'var(--bg-card)', borderRadius: 12, padding: '14px 16px',
          border: '1px solid var(--border-color)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }} data-testid={`tech-kpi-${c.key}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.color, fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
            {c.icon}
            <span>{c.label}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>{c.value}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{c.unit}</span>
          </div>
        </div>
      ))}
    </div>
  )
}
