/**
 * G005 Radiology RIS - Unified Chart Color Palette (v3.0.6.8-23c)
 * Single source of truth, aligned with design-system.css --color-chart-1..N
 * and semantic tokens (success/warning/danger).
 */

export type ChartColorKey =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'purple'
  | 'cyan'
  | 'amber'
  | 'pink'
  | 'gray'
  | 'grayDark'
  | 'deepBlue'
  | 'error'

export const CHART_COLORS: Record<ChartColorKey, string> = {
  primary: 'var(--color-primary-500)',
  success: 'var(--color-success-500)',
  warning: 'var(--color-warning-600)',
  danger: 'var(--color-error-500)',
  info: 'var(--color-primary-500)',
  purple: '#7c3aed',
  cyan: 'var(--color-info-600)',
  amber: '#ca8a04',
  pink: '#db2777',
  gray: '#94a3b8',
  grayDark: '#475569',
  deepBlue: 'var(--color-primary-800)',
  error: 'var(--color-error-500)',
}

export const CHART_PALETTE: string[] = [
  'var(--color-primary-500)',
  'var(--color-success-500)',
  'var(--color-error-500)',
  'var(--color-warning-600)',
  '#7c3aed',
  'var(--color-info-600)',
  '#ca8a04',
  '#db2777',
  'var(--color-primary-800)',
  '#94a3b8',
]

export const CHART_SEMANTIC = {
  success: 'var(--color-success-500)',
  successBg: '#22c55e18',
  warning: 'var(--color-warning-600)',
  warningBg: '#d9770618',
  danger: 'var(--color-error-500)',
  dangerBg: '#ef444418',
  info: 'var(--color-primary-500)',
  infoBg: '#3b82f618',
  neutral: '#94a3b8',
  neutralBg: '#94a3b818',
} as const

export function getChartColor(index: number): string {
  return CHART_PALETTE[index % CHART_PALETTE.length]!
}

export function chartColorWithAlpha(hex: string, alpha: number): string {
  const cleaned = hex.replace('#', '')
  const r = parseInt(cleaned.substring(0, 2), 16)
  const g = parseInt(cleaned.substring(2, 4), 16)
  const b = parseInt(cleaned.substring(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
