// G005 放射科RIS系统 - 核医学科专项统计 v1.0.0
// 科室专项统计：检查数量/药物消耗/设备利用率/阳性率/SUV统计，12月趋势
// [v3.0.6.11-54] Phase 2: 接入 nuclearStatsApi 真实数据 (mock 回退)
import { useState, useEffect, useCallback } from 'react'
import { replayDeviceEvent } from '../utils/deviceStateAdapter'
import {
  BarChart3, TrendingUp, Activity, Calendar,
  Radio, Droplets, AlertCircle, Download, RefreshCw,
  TrendingDown, Percent, Pill, Gauge, Eye, Target
} from 'lucide-react'
import {
  nuclearStatsApi,
  type NuclearSummary,
} from '../services/api/nuclearStatsApi'
import { t } from '../i18n/appI18n'
import { DataTable } from '../components/common/DataTable'
import { ChartContainer } from '../components/charts'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts'

// ============================================================
// 样式常量
// ============================================================
const C = {
  primary: '#1e40af',
  primaryLight: '#2563eb',
  accent: '#0891b2',       // cyan-600 核医学主题色
  accentLight: '#ecfeff',  // cyan-50
  white: '#ffffff',
  background: 'var(--bg-card)',
  text: '#1e293b',
  textMuted: '#64748b',
  textLight: '#94a3b8',
  border: 'var(--border-color)',
  success: '#059669',
  successBg: 'var(--color-success-bg)',
  warning: '#d97706',
  warningBg: 'var(--color-warning-bg)',
  danger: '#dc2626',
  dangerBg: 'var(--color-error-bg)',
  info: '#0891b2',
  infoBg: 'var(--color-info-bg)',
  purple: '#7c3aed',
  purpleBg: 'var(--color-info-bg)',
}

const DEVICE_COLORS = ['#0891b2', '#3b82f6', '#60a5fa', '#22c55e', '#f59e0b', '#ec4899']

// ============================================================
// 12月每日统计数据（模拟数据）
// ============================================================
const DECEMBER_DATA = [
  { date: '12-01', exams: 42, petct: 18, spect: 14, drug: 2850, positive: 67.2, suvAvg: 5.8, utilization: 78 },
  { date: '12-02', exams: 45, petct: 20, spect: 15, drug: 3020, positive: 68.5, suvAvg: 6.1, utilization: 82 },
  { date: '12-03', exams: 48, petct: 22, spect: 16, drug: 3180, positive: 64.8, suvAvg: 5.5, utilization: 85 },
  { date: '12-04', exams: 44, petct: 19, spect: 15, drug: 2950, positive: 70.1, suvAvg: 6.3, utilization: 80 },
  { date: '12-05', exams: 50, petct: 24, spect: 16, drug: 3350, positive: 65.4, suvAvg: 5.9, utilization: 88 },
  { date: '12-06', exams: 38, petct: 16, spect: 12, drug: 2580, positive: 71.2, suvAvg: 6.5, utilization: 72 },
  { date: '12-07', exams: 22, petct: 8, spect: 8, drug: 1520, positive: 62.3, suvAvg: 5.2, utilization: 45 },
  { date: '12-08', exams: 40, petct: 17, spect: 13, drug: 2720, positive: 69.0, suvAvg: 6.0, utilization: 76 },
  { date: '12-09', exams: 46, petct: 21, spect: 15, drug: 3080, positive: 66.8, suvAvg: 5.7, utilization: 84 },
  { date: '12-10', exams: 52, petct: 25, spect: 17, drug: 3480, positive: 68.2, suvAvg: 6.2, utilization: 90 },
  { date: '12-11', exams: 47, petct: 23, spect: 14, drug: 3150, positive: 72.5, suvAvg: 6.8, utilization: 86 },
  { date: '12-12', exams: 43, petct: 18, spect: 15, drug: 2890, positive: 65.1, suvAvg: 5.6, utilization: 79 },
  { date: '12-13', exams: 36, petct: 15, spect: 11, drug: 2450, positive: 70.8, suvAvg: 6.4, utilization: 70 },
  { date: '12-14', exams: 20, petct: 7, spect: 7, drug: 1380, positive: 61.5, suvAvg: 5.0, utilization: 42 },
  { date: '12-15', exams: 41, petct: 18, spect: 13, drug: 2780, positive: 67.5, suvAvg: 5.9, utilization: 77 },
  { date: '12-16', exams: 44, petct: 19, spect: 15, drug: 2960, positive: 69.3, suvAvg: 6.1, utilization: 81 },
  { date: '12-17', exams: 49, petct: 23, spect: 16, drug: 3280, positive: 66.0, suvAvg: 5.8, utilization: 87 },
  { date: '12-18', exams: 51, petct: 24, spect: 17, drug: 3420, positive: 71.8, suvAvg: 6.6, utilization: 89 },
  { date: '12-19', exams: 46, petct: 21, spect: 15, drug: 3100, positive: 68.4, suvAvg: 6.0, utilization: 83 },
  { date: '12-20', exams: 39, petct: 16, spect: 13, drug: 2650, positive: 73.2, suvAvg: 6.9, utilization: 74 },
  { date: '12-21', exams: 21, petct: 8, spect: 7, drug: 1450, positive: 60.8, suvAvg: 4.9, utilization: 44 },
  { date: '12-22', exams: 43, petct: 19, spect: 14, drug: 2900, positive: 67.8, suvAvg: 5.8, utilization: 78 },
  { date: '12-23', exams: 47, petct: 22, spect: 15, drug: 3160, positive: 69.6, suvAvg: 6.2, utilization: 85 },
  { date: '12-24', exams: 55, petct: 28, spect: 17, drug: 3680, positive: 74.5, suvAvg: 7.2, utilization: 95 },
  { date: '12-25', exams: 25, petct: 10, spect: 9, drug: 1720, positive: 63.2, suvAvg: 5.3, utilization: 52 },
  { date: '12-26', exams: 42, petct: 18, spect: 14, drug: 2840, positive: 68.0, suvAvg: 5.9, utilization: 76 },
  { date: '12-27', exams: 37, petct: 15, spect: 12, drug: 2520, positive: 70.5, suvAvg: 6.3, utilization: 71 },
  { date: '12-28', exams: 19, petct: 7, spect: 6, drug: 1320, positive: 62.0, suvAvg: 5.1, utilization: 40 },
  { date: '12-29', exams: 41, petct: 17, spect: 14, drug: 2760, positive: 66.5, suvAvg: 5.7, utilization: 75 },
  { date: '12-30', exams: 48, petct: 22, spect: 16, drug: 3220, positive: 69.8, suvAvg: 6.4, utilization: 86 },
  { date: '12-31', exams: 30, petct: 12, spect: 10, drug: 2050, positive: 64.0, suvAvg: 5.4, utilization: 58 },
]

// 设备信息 — status 字符串经 deviceMachine 校验/转换,确保只能是 idle/inUse/maintenance/broken/offline
export const DEVICES = [
  { id: 'PET-CT 1', name: 'GE Discovery MI', type: 'PET-CT', utilization: 92, status: 'running' as const },
  { id: 'PET-CT 2', name: '西门子Biography', type: 'PET-CT', utilization: 88, status: 'running' as const },
  { id: 'SPECT 1', name: 'GE Discovery NM', type: 'SPECT', utilization: 76, status: 'running' as const },
  { id: 'SPECT 2', name: '西门子Symbia', type: 'SPECT', utilization: 68, status: replayDeviceEvent('idle', { type: 'START_MAINTENANCE', notes: '探测器季度校准', by: 'system' }) as 'maintenance' },
  { id: '回旋加速器', name: '西门子Eclipse', type: '回旋加速器', utilization: 85, status: 'running' as const },
]

interface DrugStat {
  name: string
  consumption: number
  unit: string
  percent: number
  color: string
  usage?: string
}

interface SuvStats {
  avg: number
  max: number
  min: number
  std: number
  tumorAvg: number
  inflammationAvg: number
  threshold?: number
  distribution?: { range: string; count: number }[]
}

interface DeviceStat {
  name: string
  utilization: number
  exams?: number
  cycles?: number
  positive?: number
  avgSuv?: number
  output?: number
  purity?: number
  status?: string
}

// 药物消耗数据
const DRUG_DATA: DrugStat[] = [
  { name: '¹⁸F-FDG', consumption: 48520, unit: 'mCi', percent: 62, color: '#0891b2' },
  { name: '⁹⁹mTc-MDP', consumption: 18250, unit: 'mCi', percent: 23, color: '#3b82f6' },
  { name: '¹³¹I', consumption: 5800, unit: 'mCi', percent: 7, color: '#8b5cf6' },
  { name: '¹¹C-PIB', consumption: 3200, unit: 'mCi', percent: 4, color: '#22c55e' },
  { name: '其他', consumption: 2430, unit: 'mCi', percent: 4, color: 'var(--text-secondary)' },
]

// SUV 桶中点 (与 label 对应), 用于从分布反推肿瘤/炎症平均 SUVmax
const SUV_BUCKET_MIDPOINTS: { range: string; mid: number }[] = [
  { range: '0-2', mid: 1 },
  { range: '2-4', mid: 3 },
  { range: '4-6', mid: 5 },
  { range: '6-8', mid: 7 },
  { range: '8-10', mid: 9 },
  { range: '>10', mid: 11 },
]

// SUV统计数据
const SUV_STATS: SuvStats = {
  avg: 6.1,
  max: 12.8,
  min: 2.1,
  std: 2.3,
  tumorAvg: 7.8,
  inflammationAvg: 3.2,
  distribution: [
    { range: '0-2', count: 8 },
    { range: '2-4', count: 22 },
    { range: '4-6', count: 45 },
    { range: '6-8', count: 38 },
    { range: '8-10', count: 18 },
    { range: '>10', count: 7 },
  ],
}

// ============================================================
// SVG柱状图组件
// ============================================================
type ChartDatum = Record<string, string | number>

interface BarChartSVGProps {
  data: ChartDatum[]
  width?: number
  height?: number
  barColor?: string
  valueKey?: string
  labelKey?: string
}

const BarChartSVG = ({ data, width = 600, height = 200, barColor = C.accent, valueKey = 'value', labelKey = 'label' }: BarChartSVGProps) => {
  if (!data || data.length === 0) return null
  const maxVal = Math.max(...data.map(d => Number(d[valueKey] ?? 0)))
  if (!(maxVal > 0)) return null
  const barWidth = Math.max(2, Math.min(30, (width - 60) / data.length - 4))
  const chartHeight = height - 50

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* Y轴网格线 */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line
            x1={40} y1={chartHeight - ratio * chartHeight}
            x2={width - 10} y2={chartHeight - ratio * chartHeight}
            stroke={C.border} strokeDasharray="4,4"
          />
          <text x={35} y={chartHeight - ratio * chartHeight + 4} textAnchor="end" fontSize={10} fill={C.textMuted}>
            {(maxVal * ratio).toFixed(0)}
          </text>
        </g>
      ))}
      {/* 柱子 */}
      {data.map((d, i) => {
        const barH = (Number(d[valueKey] ?? 0) / maxVal) * chartHeight
        const x = 45 + i * ((width - 55) / data.length)
        return (
          <g key={i}>
            <rect
              x={x} y={chartHeight - barH}
              width={barWidth} height={barH}
              fill={barColor} rx={3}
            />
            <text x={x + barWidth / 2} y={chartHeight - barH - 5} textAnchor="middle" fontSize={9} fill={C.textMuted}>
              {d[valueKey]}
            </text>
            <text x={x + barWidth / 2} y={chartHeight + 14} textAnchor="middle" fontSize={9} fill={C.textMuted}>
              {d[labelKey]}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ============================================================
// SVG折线图组件
// ============================================================
interface LineChartSVGProps {
  data: ChartDatum[]
  width?: number
  height?: number
  lineColor?: string
  valueKey?: string
  labelKey?: string
  showArea?: boolean
}

const LineChartSVG = ({ data, width = 600, height = 200, lineColor = C.accent, valueKey = 'value', labelKey = 'label', showArea = true }: LineChartSVGProps) => {
  if (!data || data.length < 2) return null
  const maxVal = Math.max(...data.map(d => Number(d[valueKey] ?? 0)))
  const minVal = Math.min(...data.map(d => Number(d[valueKey] ?? 0)))
  if (!Number.isFinite(maxVal) || !Number.isFinite(minVal)) return null
  const range = maxVal - minVal || 1
  const chartHeight = height - 50
  const chartWidth = width - 60

  const points = data.map((d, i) => ({
    x: 45 + (i / (data.length - 1)) * chartWidth,
    y: chartHeight - ((Number(d[valueKey] ?? 0) - minVal) / range) * chartHeight,
    value: d[valueKey],
    label: d[labelKey],
  }))

  const firstPoint = points[0]
  const lastPoint = points[points.length - 1]
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
  const areaD = firstPoint && lastPoint ? `${pathD} L ${lastPoint.x} ${chartHeight} L ${firstPoint.x} ${chartHeight} Z` : ''

  return (
    <svg width={width} height={height} style={{ overflow: 'visible' }}>
      {/* 网格线 */}
      {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => (
        <g key={i}>
          <line
            x1={40} y1={chartHeight - ratio * chartHeight}
            x2={width - 10} y2={chartHeight - ratio * chartHeight}
            stroke={C.border} strokeDasharray="4,4"
          />
          <text x={35} y={chartHeight - ratio * chartHeight + 4} textAnchor="end" fontSize={10} fill={C.textMuted}>
            {(minVal + range * ratio).toFixed(1)}
          </text>
        </g>
      ))}
      {/* 面积 */}
      {showArea && (
        <path d={areaD} fill={lineColor} fillOpacity={0.1} />
      )}
      {/* 线 */}
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* 数据点 */}
      {points.filter((_, i) => i % 5 === 0 || i === points.length - 1).map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={4} fill={lineColor} />
          <text x={p.x} y={p.y - 10} textAnchor="middle" fontSize={9} fill={C.textMuted}>
            {p.value}
          </text>
          <text x={p.x} y={chartHeight + 14} textAnchor="middle" fontSize={9} fill={C.textMuted}>
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ============================================================
// SVG饼图组件
// ============================================================
interface PieDatum {
  name: string
  value: number
  color: string
}

interface PieChartSVGProps {
  data: PieDatum[]
  size?: number
  /** 饼图各切片值本身的单位（中心展示），如 '例' / '%' */
  unit?: string
  /** 中心显示的数值；默认取切片值之和 */
  centerValue?: number
}

const PieChartSVG = ({ data, size = 160, unit, centerValue }: PieChartSVGProps) => {
  if (!data || data.length === 0) return null
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const center = centerValue ?? total
  const cx = size / 2, cy = size / 2, r = size / 2 - 10
  let startAngle = -90

  const slices = data.map(d => {
    const angle = total > 0 ? (d.value / total) * 360 : 0
    const endAngle = startAngle + angle
    const x1 = cx + r * Math.cos((startAngle * Math.PI) / 180)
    const y1 = cy + r * Math.sin((startAngle * Math.PI) / 180)
    const x2 = cx + r * Math.cos((endAngle * Math.PI) / 180)
    const y2 = cy + r * Math.sin((endAngle * Math.PI) / 180)
    const largeArc = angle > 180 ? 1 : 0
    const pathD = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`
    const slice = { ...d, pathD, startAngle, endAngle }
    startAngle = endAngle
    return slice
  })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <svg width={size} height={size}>
        {slices.map((s, i) => (
          <path key={i} d={s.pathD} fill={s.color} stroke={C.white} strokeWidth={2}
            style={{ transition: 'transform 0.2s', transformOrigin: `${cx}px ${cy}px` }}
          />
        ))}
        <circle cx={cx} cy={cy} r={r * 0.5} fill={C.white} />
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={C.text}>{center}</text>
        {unit && <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fill={C.textMuted}>{unit}</text>}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', justifyContent: 'center', maxWidth: 200 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: d.color }} />
            <span style={{ fontSize: 12, color: C.textMuted }}>{d.name} {d.value}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
// 进度条组件
// ============================================================
interface ProgressBarProps {
  value: number
  max?: number
  color?: string
  label?: string
  showPercent?: boolean
}

const ProgressBar = ({ value, max = 100, color = C.accent, label, showPercent = true }: ProgressBarProps) => {
  const percent = Math.min((value / max) * 100, 100)
  return (
    <div style={{ width: '100%' }}>
      {label && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ fontSize: 12, color: C.textMuted }}>{label}</span>
          {showPercent && <span style={{ fontSize: 12, color: C.text, fontWeight: 600 }}>{percent.toFixed(0)}%</span>}
        </div>
      )}
      <div style={{ width: '100%', height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${percent}%`, height: '100%', background: color, borderRadius: 4, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================

// 设备统计数据 (加载失败回退)
const DEVICE_FALLBACK: DeviceStat[] = [
  { name: 'PET-CT 1', exams: 328, utilization: 92, positive: 71.5, avgSuv: 6.8 },
  { name: 'PET-CT 2', exams: 285, utilization: 88, positive: 69.2, avgSuv: 6.4 },
  { name: 'SPECT 1', exams: 245, utilization: 76, positive: 58.3, avgSuv: 3.2 },
  { name: 'SPECT 2', exams: 168, utilization: 68, positive: 55.8, avgSuv: 3.0 },
  { name: '回旋加速器', cycles: 62, utilization: 85, output: 48520, purity: 98.5 },
]

// 月度趋势数据 (加载失败回退)
const MONTHLY_FALLBACK = [
  { month: '7月', exams: 1180, positive: 62.3, utilization: 72 },
  { month: '8月', exams: 1250, positive: 63.8, utilization: 75 },
  { month: '9月', exams: 1320, positive: 65.2, utilization: 78 },
  { month: '10月', exams: 1280, positive: 64.5, utilization: 76 },
  { month: '11月', exams: 1350, positive: 66.8, utilization: 80 },
  { month: '12月', exams: 1248, positive: 67.8, utilization: 77 },
]

export default function NuclearStatsPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [summary] = useState<NuclearSummary | null>(null)
  const [daily, setDaily] = useState(DECEMBER_DATA)
  const [monthly, setMonthly] = useState(MONTHLY_FALLBACK)
  const [devices, setDevices] = useState(DEVICE_FALLBACK)
  const [suv, setSuv] = useState(SUV_STATS)
  const [drugs, setDrugs] = useState(DRUG_DATA)
  // [G005 Wave2A P1] DECEMBER_DATA 等 fallback 兜底 → 回退态显示演示徽标
  const [usingFallback, setUsingFallback] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [, d, m, dv, sv, dr] = await Promise.allSettled([
        nuclearStatsApi.getSummary(), nuclearStatsApi.getDaily(), nuclearStatsApi.getMonthly(),
        nuclearStatsApi.getDevices(), nuclearStatsApi.getSuv(), nuclearStatsApi.getDrugs(),
      ])
      const dOk = d.status === 'fulfilled' && d.value.success && Array.isArray(d.value.data) && d.value.data.length > 0
      const mOk = m.status === 'fulfilled' && m.value.success && Array.isArray(m.value.data) && m.value.data.length > 0
      const dvOk = dv.status === 'fulfilled' && dv.value.success && Array.isArray(dv.value.data) && dv.value.data.length > 0
      const svOk = sv.status === 'fulfilled' && sv.value.success && !!sv.value.data
      const drOk = dr.status === 'fulfilled' && dr.value.success && Array.isArray(dr.value.data) && dr.value.data.length > 0
      if (dOk) setDaily(d.value.data)
      if (mOk) setMonthly(m.value.data)
      if (dvOk) setDevices(dv.value.data)
      if (svOk) setSuv(sv.value.data)
      if (drOk) setDrugs(dr.value.data)
      setUsingFallback(!(dOk && mOk && dvOk && svOk && drOk))
    } catch (e) {
      setError((e as Error)?.message ?? t('nuclearStats.loadFailed'))
      setUsingFallback(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load() }, [load])

  // 统计数据汇总
  const totalExams = daily.reduce((sum, d) => sum + d.exams, 0)
  const totalDrug = daily.reduce((sum, d) => sum + d.drug, 0)
  const avgUtilization = daily.length ? (daily.reduce((sum, d) => sum + d.utilization, 0) / daily.length).toFixed(1) : '0'
  const avgPositive = daily.length ? (daily.reduce((sum, d) => sum + d.positive, 0) / daily.length).toFixed(1) : '0'

  // [P0] SUV 分布归一: 保证桶计数为正整数, 并由桶反推肿瘤/炎症平均 (与分布口径一致)
  const suvDistribution = (suv?.distribution?.length ? suv.distribution : SUV_STATS.distribution!)
    .map((b) => ({ range: b.range, count: Math.max(0, Math.round(Number(b.count) || 0)) }))
  const suvBucketTotal = suvDistribution.reduce((s, b) => s + b.count, 0)
  const threshold = suv?.threshold ?? 4.5
  const suvTumorAvg = (() => {
    const buckets = suvDistribution
      .map((b) => ({ ...b, mid: SUV_BUCKET_MIDPOINTS.find((m) => m.range === b.range)?.mid ?? (b.range === '>10' ? 11 : 0) }))
      .filter((b) => b.mid > threshold && b.count > 0)
    const n = buckets.reduce((s, b) => s + b.count, 0)
    if (n === 0) return suv?.tumorAvg ?? 0
    return Math.round((buckets.reduce((s, b) => s + b.mid * b.count, 0) / n) * 10) / 10
  })()
  const suvInflammationAvg = (() => {
    const buckets = suvDistribution
      .map((b) => ({ ...b, mid: SUV_BUCKET_MIDPOINTS.find((m) => m.range === b.range)?.mid ?? (b.range === '>10' ? 11 : 0) }))
      .filter((b) => b.mid > 0 && b.mid <= threshold && b.count > 0)
    const n = buckets.reduce((s, b) => s + b.count, 0)
    if (n === 0) return suv?.inflammationAvg ?? 0
    return Math.round((buckets.reduce((s, b) => s + b.mid * b.count, 0) / n) * 10) / 10
  })()

  const tabs = [
    { key: 'overview', label: t('nuclearStats.tabOverview'), icon: <BarChart3 size={15} /> },
    { key: 'exams', label: t('nuclearStats.tabExams'), icon: <Activity size={15} /> },
    { key: 'drug', label: t('nuclearStats.tabDrug'), icon: <Pill size={15} /> },
    { key: 'equipment', label: t('nuclearStats.tabEquipment'), icon: <Gauge size={15} /> },
    { key: 'positive', label: t('nuclearStats.tabPositive'), icon: <Target size={15} /> },
    { key: 'suv', label: t('nuclearStats.tabSuv'), icon: <TrendingUp size={15} /> },
  ]

  const nuclearColumns = [
    { title: t('w1tables.nuclear.date'), dataIndex: 'date', key: 'date' },
    { title: t('w1tables.nuclear.exams'), dataIndex: 'exams', key: 'exams', align: 'right' as const },
    { title: t('w1tables.nuclear.petct'), dataIndex: 'petct', key: 'petct', align: 'right' as const },
    { title: t('w1tables.nuclear.spect'), dataIndex: 'spect', key: 'spect', align: 'right' as const },
    { title: t('w1tables.nuclear.drug'), dataIndex: 'drug', key: 'drug', align: 'right' as const },
    { title: t('w1tables.nuclear.positive'), dataIndex: 'positive', key: 'positive', align: 'right' as const },
    { title: t('w1tables.nuclear.suv'), dataIndex: 'suvAvg', key: 'suvAvg', align: 'right' as const },
    { title: t('w1tables.nuclear.utilization'), dataIndex: 'utilization', key: 'utilization', align: 'right' as const },
  ]

  if (loading) return <div role="status" data-testid="nuclear-loading" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>{t('nuclearStats.loading')}</div>;
  if (error) return <div role="alert" data-testid="nuclear-error" style={{ padding: 40, textAlign: 'center', color: '#dc2626' }}>{error}</div>;
  if (!daily || daily.length === 0) {
    return (
      <div data-testid="nuclear-empty" style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
        <div style={{ fontSize: 14, marginBottom: 12 }}>{t('nuclearStats.noDataTitle')}</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('nuclearStats.noDataDesc')}</div>
      </div>
    );
  }

  return (
    <div style={{ background: C.background, padding: 24 }}>
      {/* 标题栏 */}
      <div style={{ background: C.white, borderRadius: 12, padding: '20px 24px', marginBottom: 20, borderLeft: `4px solid ${C.accent}` }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ background: C.accentLight, padding: 12, borderRadius: 10 }}>
              <Radio size={28} color={C.accent} />
            </div>
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.primary, margin: '0 0 4px' }}>{t('nuclearStats.title')}
                {usingFallback && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--color-warning-bg)', color: '#d97706', fontWeight: 600, marginLeft: 8, verticalAlign: 'middle' }}>{t('nuclearStats.demoTag')}</span>}
              </h1>
              <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{t('nuclearStats.subtitle')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', background: C.accentLight, borderRadius: 8 }}>
              <Calendar size={15} color={C.accent} />
              <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{t('nuclearStats.period')}</span>
            </div>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.white, color: C.accent, border: `1px solid ${C.accent}`, borderRadius: 8, cursor: 'pointer', fontSize: 12 }}
              onClick={() => {
                const data = JSON.stringify({ summary, daily, monthly, devices, suv, drugs }, null, 2)
                const blob = new Blob([data], { type: 'application/json;charset=utf-8' })
                const url = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = url
                a.download = `nuclear-stats-${new Date().toISOString().slice(0, 10)}.json`
                a.click()
                URL.revokeObjectURL(url)
              }}>
              <Download size={15} /> {t('nuclearStats.exportReport')}
            </button>
            <button style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', background: C.accent, color: C.white, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 12 }} onClick={() => void load()}>
              <RefreshCw size={15} /> {t('nuclearStats.refreshData')}
            </button>
          </div>
        </div>
      </div>

      {/* 标签页 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, background: C.white, padding: '8px 12px', borderRadius: 10 }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px',
              background: activeTab === tab.key ? C.accent : 'transparent',
              color: activeTab === tab.key ? C.white : C.textMuted,
              border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: activeTab === tab.key ? 600 : 400,
              transition: 'all 0.2s'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* 总览 */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 核心指标卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
            {[
              { label: t('nuclearStats.statTotalExams'), value: totalExams.toLocaleString(), sub: t('nuclearStats.momCompare', { value: summary?.examMoM != null ? (summary.examMoM > 0 ? '+' : '') + summary.examMoM + '%' : '-7.6%' }), icon: <Activity size={20} />, color: C.accent, bg: C.accentLight, trend: 'down' },
              { label: t('nuclearStats.statDrugConsumption'), value: (totalDrug / 1000).toFixed(1), unit: 'Ci', sub: t('nuclearStats.dailyAvg'), icon: <Droplets size={20} />, color: '#3b82f6', bg: '#3b82f622', trend: 'up' },
              { label: t('nuclearStats.statEquipmentUtilization'), value: `${avgUtilization}%`, sub: t('nuclearStats.target80'), icon: <Gauge size={20} />, color: '#22c55e', bg: '#22c55e22', trend: 'up' },
              { label: t('nuclearStats.statPositiveRate'), value: `${avgPositive}%`, sub: t('nuclearStats.momUp'), icon: <Target size={20} />, color: '#f59e0b', bg: '#f59e0b22', trend: 'up' },
              { label: t('nuclearStats.statAvgSuv'), value: (suv?.avg ?? 0).toFixed(1), sub: t('nuclearStats.rangeSub', { min: suv?.min ?? 2.1, max: suv?.max ?? 12.8 }), icon: <TrendingUp size={20} />, color: '#8b5cf6', bg: '#8b5cf622', trend: 'stable' },
            ].map((card, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 12, padding: 16, borderTop: `3px solid ${card.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ background: card.bg, padding: 10, borderRadius: 8 }}>
                    <div style={{ color: card.color }}>{card.icon}</div>
                  </div>
                  {card.trend === 'up' && <TrendingUp size={16} color="#22c55e" />}
                  {card.trend === 'down' && <TrendingDown size={16} color="#dc2626" />}
                  {card.trend === 'stable' && <div style={{ width: 16, height: 2, background: C.textMuted, borderRadius: 1 }} />}
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 4px' }}>{card.label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: C.text }}>{card.value}</span>
                  {card.unit && <span style={{ fontSize: 14, color: C.textMuted }}>{card.unit}</span>}
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>{card.sub}</p>
              </div>
            ))}
          </div>

          {/* 12月趋势图 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: 0 }}>{t('nuclearStats.dailyTrendTitle')}</h3>
              <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { label: t('nuclearStats.legendExams'), color: C.accent },
                  { label: t('nuclearStats.legendPositive'), color: '#f59e0b' },
                  { label: t('nuclearStats.legendUtilization'), color: '#22c55e' },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 12, height: 3, background: item.color, borderRadius: 2 }} />
                    <span style={{ fontSize: 12, color: C.textMuted }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* [P0] 单一 recharts 组合图 (柱=检查量, 双轴折线=阳性率%/利用率%), 共享 X 轴, 无固定像素叠加 */}
            <ChartContainer height={260} state={daily.length >= 2 && totalExams > 0 ? 'ready' : 'empty'} emptyDescription={t('nuclearStats.noDataTitle')}>
              <ComposedChart data={daily} margin={{ top: 8, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: C.textMuted }} interval="preserveStartEnd" />
                <YAxis yAxisId="left" tick={{ fontSize: 11, fill: C.textMuted }} allowDecimals={false} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: C.textMuted }} domain={[0, 100]} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="exams" name={t('nuclearStats.legendExams')} fill={C.accent} radius={[3, 3, 0, 0]} opacity={0.7} />
                <Line yAxisId="right" type="monotone" dataKey="positive" name={t('nuclearStats.legendPositive')} stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line yAxisId="right" type="monotone" dataKey="utilization" name={t('nuclearStats.legendUtilization')} stroke="#22c55e" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ChartContainer>
          </div>

          {/* 设备利用率排名 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>{t('nuclearStats.equipmentRankTitle')}</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {devices.slice(0, 4).map((device, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: i === 0 ? C.accent : C.border, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: i === 0 ? C.white : C.textMuted }}>
                    {i + 1}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.text, fontWeight: 500 }}>{device.name}</span>
                      <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{device.utilization}%</span>
                    </div>
                    <ProgressBar value={device.utilization} color={i === 0 ? C.accent : DEVICE_COLORS[i + 1]} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 统计结果明细表 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>{t('w1tables.nuclear.title')}</h3>
            <DataTable dataSource={daily} rowKey="date" columns={nuclearColumns} pagination={{ pageSize: 10, showSizeChanger: false }} emptyText={t('w1tables.noData')} />
          </div>
        </div>
      )}

      {/* 检查数量 */}
      {activeTab === 'exams' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 设备检查分布 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.deviceExamDistTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <div>
                <BarChartSVG
                  data={[
                    { label: 'PET-CT', value: 356 },
                    { label: 'SPECT', value: 248 },
                    { label: t('nuclearStats.boneDensity'), value: 156 },
                    { label: t('nuclearStats.renalDynamic'), value: 98 },
                    { label: t('nuclearStats.myocardialPerfusion'), value: 86 },
                  ]}
                  width={380} height={220}
                  barColor={C.accent}
                  valueKey="value"
                  labelKey="label"
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
                {[
                  { name: 'PET-CT', count: 356, color: C.accent, percent: 42 },
                  { name: 'SPECT', count: 248, color: '#3b82f6', percent: 29 },
                  { name: t('nuclearStats.boneDensity'), count: 156, color: '#8b5cf6', percent: 19 },
                  { name: t('nuclearStats.renalDynamic'), count: 98, color: '#22c55e', percent: 12 },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: item.color }} />
                    <span style={{ width: 60, fontSize: 12, color: C.text }}>{item.name}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 8, background: C.border, borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ width: `${item.percent}%`, height: '100%', background: item.color, borderRadius: 4 }} />
                      </div>
                    </div>
                    <span style={{ width: 50, textAlign: 'right', fontSize: 12, fontWeight: 600, color: C.text }}>{item.count}</span>
                    <span style={{ width: 35, fontSize: 12, color: C.textMuted }}>{item.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 月度趋势 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.monthlyExamTrendTitle')}</h3>
            <BarChartSVG
              data={monthly.map(m => ({ label: m.month, value: m.exams }))}
              width={900} height={200}
              barColor={C.accent}
              valueKey="value"
              labelKey="label"
            />
          </div>
        </div>
      )}

      {/* 药物消耗 */}
      {activeTab === 'drug' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 药物消耗概览 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[
              { label: '¹⁸F-FDG', value: 48520, unit: 'mCi', usage: t('nuclearStats.usagePetCtImaging'), color: C.accent },
              { label: '⁹⁹mTc-MDP', value: 18250, unit: 'mCi', usage: t('nuclearStats.usageBoneScan'), color: '#3b82f6' },
              { label: '¹³¹I', value: 5800, unit: 'mCi', usage: t('nuclearStats.usageThyroid'), color: '#8b5cf6' },
            ].map((item, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 12, padding: 20, borderLeft: `4px solid ${item.color}` }}>
                <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 8px' }}>{item.label}</p>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 30, fontWeight: 700, color: C.text }}>{(item.value / 1000).toFixed(1)}</span>
                  <span style={{ fontSize: 14, color: C.textMuted }}>{item.unit}</span>
                </div>
                <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{t('nuclearStats.usageLabel')}{item.usage}</p>
              </div>
            ))}
          </div>

          {/* 消耗占比 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.drugShareTitle')}</h3>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 40 }}>
              <PieChartSVG
                data={drugs.map(d => ({ name: d.name, value: d.percent, color: d.color }))}
                size={180}
                unit="%"
                centerValue={100}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                {drugs.map((d, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 12, height: 12, borderRadius: 3, background: d.color }} />
                    <span style={{ width: 80, fontSize: 12, color: C.text }}>{d.name}</span>
                    <span style={{ width: 60, fontSize: 12, fontWeight: 600, color: C.text }}>{(d.consumption / 1000).toFixed(1)}k</span>
                    <span style={{ fontSize: 12, color: C.textMuted }}>{d.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 每日消耗趋势 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.dailyDrugTrendTitle')}</h3>
            <BarChartSVG
              data={daily.map(d => ({ label: d.date, value: d.drug }))}
              width={1100} height={220}
              barColor={C.accent}
              valueKey="value"
              labelKey="label"
            />
          </div>
        </div>
      )}

      {/* 设备利用率 */}
      {activeTab === 'equipment' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 设备状态卡片 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {devices.map((device, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 12, padding: 20, borderTop: `4px solid ${DEVICE_COLORS[i]}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 4px' }}>{device.name}</h4>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>
                      {device.name.includes('CT') ? t('nuclearStats.petCtSystem') : device.name.includes('SPECT') ? t('nuclearStats.spectSystem') : t('nuclearStats.cyclotron')}
                    </p>
                  </div>
                  <div style={{ padding: '4px 10px', background: device.utilization >= 80 ? C.successBg : C.warningBg, borderRadius: 12 }}>
                    <span style={{ fontSize: 12, color: device.utilization >= 80 ? C.success : C.warning, fontWeight: 600 }}>
                      {device.utilization >= 80 ? t('nuclearStats.normal') : t('nuclearStats.maintenance')}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div style={{ background: C.background, padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 4px' }}>{t('nuclearStats.examVolume')}</p>
                    <p style={{ fontSize: 30, fontWeight: 700, color: C.text, margin: 0 }}>{device.exams || device.cycles || '-'}</p>
                  </div>
                  <div style={{ background: C.background, padding: 12, borderRadius: 8, textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 4px' }}>{t('nuclearStats.utilizationLabel')}</p>
                    <p style={{ fontSize: 30, fontWeight: 700, color: device.utilization >= 80 ? C.success : C.warning, margin: 0 }}>{device.utilization}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 利用率趋势 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.dailyUtilTrendTitle')}</h3>
            <LineChartSVG
              data={daily.map(d => ({ label: d.date, value: d.utilization }))}
              width={1100} height={220}
              lineColor="#22c55e"
              valueKey="value"
              labelKey="label"
            />
          </div>
        </div>
      )}

      {/* 阳性率 */}
      {activeTab === 'positive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 阳性率概览 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.positiveOverviewTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: t('nuclearStats.avgPositiveRate'), value: `${avgPositive}%`, color: C.accent },
                { label: t('nuclearStats.maxPositiveRate'), value: '74.5%', color: C.success },
                { label: t('nuclearStats.minPositiveRate'), value: '60.8%', color: C.warning },
                { label: t('nuclearStats.positiveCaseCount'), value: (totalExams * parseFloat(avgPositive) / 100).toFixed(0), color: C.danger },
              ].map((item, i) => (
                <div key={i} style={{ background: C.background, padding: 16, borderRadius: 10, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '0 0 8px' }}>{item.label}</p>
                  <p style={{ fontSize: 30, fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
                </div>
              ))}
            </div>

            {/* 阳性率趋势 */}
            <h4 style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 16px' }}>{t('nuclearStats.dailyPositiveTrendTitle')}</h4>
            <LineChartSVG
              data={daily.map(d => ({ label: d.date, value: d.positive }))}
              width={1100} height={220}
              lineColor="#f59e0b"
              valueKey="value"
              labelKey="label"
            />
          </div>

          {/* 检查类型阳性率 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.byTypePositiveTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {[
                { type: t('nuclearStats.typePetCtWholeBody'), positive: 71.5, exams: 356, trend: '+2.3%' },
                { type: t('nuclearStats.typePetCtHeart'), positive: 85.2, exams: 86, trend: '+5.1%' },
                { type: t('nuclearStats.typeSpectBoneScan'), positive: 58.3, exams: 248, trend: '-1.2%' },
                { type: t('nuclearStats.typeRenalDynamicImaging'), positive: 42.5, exams: 98, trend: '+0.8%' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: 16, background: C.background, borderRadius: 10 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, color: C.text, fontWeight: 500 }}>{item.type}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 16, fontWeight: 700, color: item.positive >= 60 ? C.success : C.warning }}>{item.positive}%</span>
                        <span style={{ fontSize: 12, color: item.trend.startsWith('+') ? C.success : C.danger }}>{item.trend}</span>
                      </div>
                    </div>
                    <ProgressBar value={item.positive} color={item.positive >= 60 ? C.success : C.warning} />
                    <p style={{ fontSize: 12, color: C.textMuted, margin: '6px 0 0' }}>{t('nuclearStats.examCount', { count: item.exams })}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SUV统计 */}
      {activeTab === 'suv' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* SUV统计概览 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {[
              { label: t('nuclearStats.avgSuvmax'), value: (suv?.avg ?? 0).toFixed(1), icon: <TrendingUp size={20} />, color: C.accent, bg: C.accentLight },
              { label: t('nuclearStats.maxSuvmax'), value: suv?.max ?? 0, icon: <TrendingUp size={20} />, color: C.danger, bg: C.dangerBg },
              { label: t('nuclearStats.minSuvmax'), value: suv?.min ?? 0, icon: <TrendingDown size={20} />, color: C.success, bg: C.successBg },
              { label: t('nuclearStats.stdDev'), value: (suv?.std ?? 0).toFixed(1), icon: <Percent size={20} />, color: C.purple, bg: C.purpleBg },
            ].map((item, i) => (
              <div key={i} style={{ background: C.white, borderRadius: 12, padding: 20, borderTop: `3px solid ${item.color}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div style={{ background: item.bg, padding: 10, borderRadius: 8, color: item.color }}>
                    {item.icon}
                  </div>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: 0 }}>{item.label}</p>
                </div>
                <p style={{ fontSize: 30, fontWeight: 700, color: item.color, margin: 0 }}>{item.value}</p>
              </div>
            ))}
          </div>

          {/* SUV分布 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.suvDistTitle')}</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              {/* 病灶SUV分布 */}
              <div>
                <h4 style={{ fontSize: 12, fontWeight: 600, color: C.text, margin: '0 0 12px' }}>
                  {t('nuclearStats.lesionSuvDistTitle')}
                  <span style={{ fontSize: 12, color: C.textMuted, fontWeight: 400, marginLeft: 8 }}>
                    ({t('nuclearStats.unitCases')}={suvBucketTotal})
                  </span>
                </h4>
                <BarChartSVG
                  data={suvDistribution.map(x => ({ label: x.range, value: x.count }))}
                  width={320} height={180}
                  barColor={C.accent}
                  valueKey="value"
                  labelKey="label"
                />
              </div>
              {/* SUV对比 */}
              <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16 }}>
                <div style={{ background: C.accentLight, padding: 16, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Target size={18} color={C.accent} />
                    <span style={{ fontSize: 12, color: C.accent, fontWeight: 600 }}>{t('nuclearStats.tumorUptakeAvg')}</span>
                  </div>
                  <p style={{ fontSize: 30, fontWeight: 700, color: C.accent, margin: 0 }}>{suvTumorAvg}</p>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>SUVmax</p>
                </div>
                <div style={{ background: C.successBg, padding: 16, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <AlertCircle size={18} color={C.success} />
                    <span style={{ fontSize: 12, color: C.success, fontWeight: 600 }}>{t('nuclearStats.inflammationUptakeAvg')}</span>
                  </div>
                  <p style={{ fontSize: 30, fontWeight: 700, color: C.success, margin: 0 }}>{suvInflammationAvg}</p>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>SUVmax</p>
                </div>
                <div style={{ background: C.warningBg, padding: 16, borderRadius: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <Eye size={18} color={C.warning} />
                    <span style={{ fontSize: 12, color: C.warning, fontWeight: 600 }}>{t('nuclearStats.thresholdLabel')}</span>
                  </div>
                  <p style={{ fontSize: 30, fontWeight: 700, color: C.warning, margin: 0 }}>{threshold}</p>
                  <p style={{ fontSize: 12, color: C.textMuted, margin: '4px 0 0' }}>{t('nuclearStats.thresholdDesc')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* SUV趋势 */}
          <div style={{ background: C.white, borderRadius: 12, padding: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.text, margin: '0 0 20px' }}>{t('nuclearStats.dailySuvTrendTitle')}</h3>
            <LineChartSVG
              data={daily.map(d => ({ label: d.date, value: d.suvAvg }))}
              width={1100} height={220}
              lineColor={C.accent}
              valueKey="value"
              labelKey="label"
            />
          </div>
        </div>
      )}
    </div>
  )
}
