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
  primary: '#3b82f6',
  success: '#22c55e',
  warning: '#d97706',
  danger: '#ef4444',
  info: '#3b82f6',
  purple: '#7c3aed',
  cyan: '#0891b2',
  amber: '#ca8a04',
  pink: '#db2777',
  gray: '#94a3b8',
  grayDark: '#475569',
  deepBlue: '#1e40af',
  error: '#ef4444',
}

export const CHART_PALETTE: string[] = [
  '#3b82f6',
  '#22c55e',
  '#ef4444',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#1e40af',
  '#94a3b8',
]

export const CHART_SEMANTIC = {
  success: '#22c55e',
  successBg: '#22c55e18',
  warning: '#d97706',
  warningBg: '#d9770618',
  danger: '#ef4444',
  dangerBg: '#ef444418',
  info: '#3b82f6',
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
