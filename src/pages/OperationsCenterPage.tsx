// @ts-nocheck
// ============================================================
// G005 放射科RIS系统 - 运营指挥中心大屏
// 科室主任/院长驾驶舱 - 放射科实时数据监控
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import {
  Activity, AlertTriangle, ArrowUp, ArrowDown, Bell,
  Clock, Package, TrendingUp, TrendingDown, AlertCircle,
  CheckCircle, XCircle, RefreshCw, Monitor, Users,
  Zap, Wrench, MessageSquare, Gauge, Minus, Scan, Film
} from 'lucide-react'
// [W2-A] 真实 API 接入: statsApi/occupancyApi/biApi/oeeApi/criticalExtApi/deviceMgmtApi
import { statsApi } from '../services/api/statsApi'
import { biApi } from '../services/api/biApi'
import { occupancyApi } from '../services/api/occupancyApi'
import { oeeApi } from '../services/api/oeeApi'
import { criticalExtApi } from '../services/api/criticalExtApi'
import { deviceMgmtApi } from '../services/api/deviceMgmtApi'

// ==================== 模拟数据 ====================
const KPI_DATA = [
  { label: '今日检查量', value: 326, unit: '例', yesterday: 298, trend: 'up' },
  { label: '今日预约量', value: 358, unit: '例', yesterday: 342, trend: 'up' },
  { label: '在检人数', value: 24, unit: '人', trend: 'neutral' },
  { label: '等待人数', value: 86, unit: '人', trend: 'down' },
  { label: '设备利用率', value: 91.2, unit: '%', trend: 'up' },
  { label: '平均候诊时间', value: 12, unit: '分钟', trend: 'down' },
]

const ROOMS = [
  { name: 'CT1室', status: '检查中', patient: '王建国', color: '#4ade80' },
  { name: 'CT2室', status: '空闲', patient: '-', color: 'var(--text-secondary)' },
  { name: 'MRI1室', status: '准备中', patient: '李秀英', color: '#fbbf24' },
  { name: 'MRI2室', status: '检查中', patient: '张志明', color: '#4ade80' },
  { name: 'X线室', status: '检查中', patient: '陈晓燕', color: '#4ade80' },
  { name: '乳腺室', status: '空闲', patient: '-', color: 'var(--text-secondary)' },
]

const QUEUE_DATA = [
  { time: '8:00', count: 8 },
  { time: '9:00', count: 22 },
  { time: '10:00', count: 38 },
  { time: '11:00', count: 52 },
  { time: '12:00', count: 28 },
  { time: '13:00', count: 25 },
  { time: '14:00', count: 45 },
  { time: '15:00', count: 58 },
  { time: '16:00', count: 62 },
  { time: '17:00', count: 48 },
]

const HOURLY_DATA = [
  { hour: '0', today: 0, yesterday: 0 },
  { hour: '1', today: 0, yesterday: 0 },
  { hour: '2', today: 0, yesterday: 0 },
  { hour: '3', today: 0, yesterday: 0 },
  { hour: '4', today: 0, yesterday: 0 },
  { hour: '5', today: 1, yesterday: 0 },
  { hour: '6', today: 5, yesterday: 3 },
  { hour: '7', today: 12, yesterday: 10 },
  { hour: '8', today: 32, yesterday: 28 },
  { hour: '9', today: 52, yesterday: 48 },
  { hour: '10', today: 68, yesterday: 62 },
  { hour: '11', today: 75, yesterday: 72 },
  { hour: '12', today: 48, yesterday: 42 },
  { hour: '13', today: 55, yesterday: 50 },
  { hour: '14', today: 72, yesterday: 68 },
  { hour: '15', today: 82, yesterday: 78, peak: true },
  { hour: '16', today: 65, yesterday: 70 },
  { hour: '17', today: 48, yesterday: 52 },
  { hour: '18', today: 28, yesterday: 25 },
  { hour: '19', today: 15, yesterday: 12 },
  { hour: '20', today: 8, yesterday: 6 },
  { hour: '21', today: 3, yesterday: 2 },
  { hour: '22', today: 1, yesterday: 0 },
  { hour: '23', today: 0, yesterday: 0 },
]

const DOCTOR_RANKING = [
  { rank: 1, name: '刘德伟', exams: 52, reports: 48, rate: 92.3 },
  { rank: 2, name: '赵红梅', exams: 48, reports: 46, rate: 95.8 },
  { rank: 3, name: '王明远', exams: 45, reports: 42, rate: 93.3 },
  { rank: 4, name: '陈晓燕', exams: 42, reports: 40, rate: 95.2 },
  { rank: 5, name: '李秀英', exams: 38, reports: 35, rate: 92.1 },
  { rank: 6, name: '张志明', exams: 35, reports: 32, rate: 91.4 },
]

const PROJECT_DATA = [
  { name: 'CT', value: 128, color: '#3b82f6' },
  { name: 'MRI', value: 85, color: '#4ade80' },
  { name: 'X线', value: 72, color: '#fbbf24' },
  { name: 'MG', value: 28, color: '#f97316' },
  { name: '其他', value: 13, color: '#8b5cf6' },
]

const QUALITY_DATA = [
  { label: '危急值', value: 2, icon: AlertTriangle, color: '#ef4444', status: 'warning' },
  { label: '院感事件', value: 0, icon: Activity, color: '#4ade80', status: 'normal' },
  { label: '设备故障', value: 0, icon: Wrench, color: '#fbbf24', status: 'warning' },
  { label: '投诉/建议', value: 1, icon: MessageSquare, color: '#3b82f6', status: 'info' },
]

const EFFICIENCY_DATA = {
  equipmentUsage: 91.2,
  roomOccupancy: 78.5,
  avgExamTime: 22,
  reportTimelyRate: 96.5,
}

const ALERT_MATERIALS = [
  { name: 'CT胶片', stock: 45, threshold: 100 },
  { name: 'MRI造影剂', stock: 8, threshold: 20 },
  { name: '钼靶胶片', stock: 12, threshold: 30 },
  { name: 'X线胶片', stock: 25, threshold: 50 },
]

const PIE_COLORS = ['#3b82f6', '#4ade80', '#fbbf24', '#f97316', '#8b5cf6']

// [W2-A] 检查室状态映射 (occupancyApi)
const ROOM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  occupied: { label: '检查中', color: '#4ade80' },
  idle: { label: '空闲', color: 'var(--text-secondary)' },
  disinfecting: { label: '消毒中', color: '#fbbf24' },
  fault: { label: '故障', color: '#ef4444' },
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ==================== 样式 ====================
const s: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #0d1117 0%, #1a1f2e 100%)',
    color: '#f1f5f9',
    padding: '20px 24px',
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
  },
  // 顶部标题栏
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    padding: '12px 24px',
    background: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    border: '1px solid rgba(71, 85, 105, 0.5)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  headerText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#f1f5f9',
    margin: 0,
    letterSpacing: 2,
  },
  headerSub: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginTop: 2,
  },
  headerTime: {
    fontSize: 20,
    fontWeight: 600,
    color: '#4ade80',
    fontFamily: '"Roboto Mono", monospace',
  },
  // KPI指标条
  kpiBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: 16,
    marginBottom: 20,
  },
  kpiCard: {
    background: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    padding: '20px 24px',
    border: '1px solid rgba(71, 85, 105, 0.5)',
    position: 'relative',
    overflow: 'hidden',
  },
  kpiGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    background: 'linear-gradient(90deg, #3b82f6, #4ade80)',
  },
  kpiLabel: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  kpiValue: {
    fontSize: 48,
    fontWeight: 800,
    color: '#f1f5f9',
    lineHeight: 1,
  },
  kpiUnit: {
    fontSize: 20,
    fontWeight: 400,
    color: 'var(--text-secondary)',
    marginLeft: 4,
  },
  kpiTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 14,
    marginTop: 8,
  },
  kpiTrendUp: { color: '#4ade80' },
  kpiTrendDown: { color: '#ef4444' },
  // 主内容区
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    gap: 20,
    marginBottom: 20,
  },
  // 面板通用样式
  panel: {
    background: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    padding: 20,
    border: '1px solid rgba(71, 85, 105, 0.5)',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#f1f5f9',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 12,
    borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
  },
  // 叫号区域
  callingCard: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))',
    borderRadius: 12,
    padding: 24,
    textAlign: 'center',
    marginBottom: 20,
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  callingLabel: {
    fontSize: 16,
    color: 'var(--text-secondary)',
    marginBottom: 12,
  },
  callingPatient: {
    fontSize: 56,
    fontWeight: 800,
    color: '#3b82f6',
    marginBottom: 8,
  },
  callingRoom: {
    fontSize: 28,
    fontWeight: 700,
    color: '#4ade80',
  },
  // 检查室状态
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
    marginBottom: 20,
  },
  roomCard: {
    background: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  roomDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
  },
  roomInfo: {
    flex: 1,
  },
  roomName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f1f5f9',
  },
  roomStatus: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  // 柱状图
  barChart: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 4,
    height: 100,
    padding: '8px 0',
  },
  barItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  bar: {
    width: '100%',
    borderRadius: '4px 4px 0 0',
    transition: 'height 0.3s ease',
  },
  barLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  // 折线图区域
  lineChartArea: {
    height: 200,
    position: 'relative',
    marginTop: 16,
  },
  lineChartSvg: {
    width: '100%',
    height: '100%',
  },
  // 饼图
  pieChartContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 24,
    marginTop: 16,
  },
  pieChart: {
    width: 140,
    height: 140,
    position: 'relative',
  },
  pieLegend: {
    flex: 1,
  },
  pieLegendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  pieLegendText: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    flex: 1,
  },
  pieLegendValue: {
    fontSize: 14,
    fontWeight: 600,
    color: '#f1f5f9',
  },
  // 表格
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    color: 'var(--text-secondary)',
    fontWeight: 600,
    borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
  },
  td: {
    padding: '10px 8px',
    color: '#f1f5f9',
    borderBottom: '1px solid rgba(71, 85, 105, 0.3)',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 12,
  },
  // 质量指标卡片
  qualityGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  qualityCard: {
    background: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 10,
    padding: 16,
    textAlign: 'center',
  },
  qualityIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 8px',
  },
  qualityValue: {
    fontSize: 28,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  qualityLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  // 进度条
  progressItem: {
    marginBottom: 16,
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 13,
    color: 'var(--text-secondary)',
    marginBottom: 6,
  },
  progressBar: {
    height: 8,
    background: 'rgba(51, 65, 85, 0.8)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.5s ease',
  },
  // 耗材预警
  alertList: {
    marginTop: 12,
  },
  alertItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    marginBottom: 8,
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  alertName: {
    fontSize: 14,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  alertStock: {
    fontSize: 14,
    fontWeight: 700,
    color: '#ef4444',
  },
  // 底部区域
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 20,
  },
}

// ==================== 组件 ====================

// KPI卡片
function KPICard({ data }: { data: typeof KPI_DATA[0] }) {
  const trendColor = data.trend === 'up' ? '#4ade80' : data.trend === 'down' ? '#ef4444' : '#94a3b8'
  const TrendIcon = data.trend === 'up' ? ArrowUp : data.trend === 'down' ? ArrowDown : Minus
  const diff = data.value - (data.yesterday ?? 0)
  const percent = data.yesterday ? Math.abs((diff / data.yesterday) * 100).toFixed(1) : '0.0'

  return (
    <div style={s.kpiCard}>
      <div style={s.kpiGlow} />
      <div style={s.kpiLabel}>{data.label}</div>
      <div style={s.kpiValue}>
        {data.value}
        <span style={s.kpiUnit}>{data.unit}</span>
      </div>
      <div style={{ ...s.kpiTrend, color: trendColor }}>
        <TrendIcon size={16} />
        <span>{diff > 0 ? '+' : ''}{diff} ({percent}%)</span>
        <span style={{ color: 'var(--text-secondary)', marginLeft: 4 }}>较昨日</span>
      </div>
    </div>
  )
}

// 检查室状态卡片
function RoomCard({ room }: { room: typeof ROOMS[0] }) {
  return (
    <div style={s.roomCard}>
      <div style={{ ...s.roomDot, background: room.color }} />
      <div style={s.roomInfo}>
        <div style={s.roomName}>{room.name}</div>
        <div style={s.roomStatus}>{room.status} {room.patient !== '-' && `/ ${room.patient}`}</div>
      </div>
    </div>
  )
}

// 队列柱状图
function QueueChart({ data }: { data: typeof QUEUE_DATA }) {
  const maxCount = Math.max(1, ...data.map(d => d.count))
  
  return (
    <div style={s.barChart}>
      {data.map((item, idx) => (
        <div key={idx} style={s.barItem}>
          <div
            style={{
              ...s.bar,
              height: `${(item.count / maxCount) * 80}px`,
              background: idx === data.length - 1 ? '#4ade80' : '#3b82f6',
            }}
          />
          <div style={s.barLabel}>{item.time}</div>
        </div>
      ))}
    </div>
  )
}

// 折线图（CSS模拟）
function TrendChart({ data }: { data: typeof HOURLY_DATA }) {
  const maxValue = Math.max(...data.map(d => Math.max(d.today, d.yesterday)))
  const width = 100
  const height = 100
  const padding = 5
  
  const pointsToday = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - (d.today / maxValue) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const pointsYesterday = data.map((d, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2)
    const y = height - padding - (d.yesterday / maxValue) * (height - padding * 2)
    return `${x},${y}`
  }).join(' ')

  const peakIndex = data.findIndex(d => d.peak)
  const peak = peakIndex >= 0 ? data[peakIndex] : data.reduce((m, p) => (p.today > m.today ? p : m), data[0] || { hour: '-', today: 0 })
  const peakX = padding + ((peakIndex >= 0 ? peakIndex : Math.max(0, data.findIndex(d => d === peak))) / (data.length - 1)) * (width - padding * 2)
  const peakY = height - padding - (peak.today / maxValue) * (height - padding * 2)

  return (
    <div style={{ position: 'relative', width: '100%', height: 220 }}>
      <svg viewBox={`0 0 ${width} ${height}`} style={s.lineChartSvg} preserveAspectRatio="none">
        {/* 网格线 */}
        {[0, 25, 50, 75, 100].map((y) => (
          <line
            key={y}
            x1={padding}
            y1={height - padding - (y / 100) * (height - padding * 2)}
            x2={width - padding}
            y2={height - padding - (y / 100) * (height - padding * 2)}
            stroke="rgba(71, 85, 105, 0.3)"
            strokeWidth="0.3"
          />
        ))}
        {/* 昨日数据线 */}
        <polyline
          points={pointsYesterday}
          fill="none"
          stroke="#64748b"
          strokeWidth="0.8"
          strokeDasharray="2,1"
        />
        {/* 今日数据线 */}
        <polyline
          points={pointsToday}
          fill="none"
          stroke="#4ade80"
          strokeWidth="1.2"
        />
        {/* 峰值标注 */}
        <circle cx={peakX} cy={peakY} r="2" fill="#fbbf24" />
        <text x={peakX} y={peakY - 3} fill="#fbbf24" fontSize="3" textAnchor="middle">峰值</text>
      </svg>
      {/* X轴标签 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', padding: '0 5px' }}>
        <span>{data[0]?.hour}</span>
        <span>{data[Math.floor((data.length - 1) / 3)]?.hour}</span>
        <span>{data[Math.floor((data.length - 1) / 2)]?.hour}</span>
        <span>{data[Math.floor((2 * (data.length - 1)) / 3)]?.hour}</span>
        <span>{data[data.length - 1]?.hour}</span>
      </div>
      {/* 图例 */}
      <div style={{ display: 'flex', gap: 24, justifyContent: 'center', marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 3, background: '#4ade80', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>今日</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 3, background: '#64748b', borderRadius: 2, borderBottom: '2px dashed #64748b' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>昨日</span>
        </div>
      </div>
    </div>
  )
}

// 饼图
function PieChartComponent({ data }: { data: typeof PROJECT_DATA }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  let accumulatedPercent = 0
  
  const paths = data.map((item) => {
    const percent = (item.value / total) * 100
    const startAngle = accumulatedPercent * 3.6 - 90
    const endAngle = (accumulatedPercent + percent) * 3.6 - 90
    accumulatedPercent += percent
    
    const start = polarToCartesian(50, 50, 45, endAngle)
    const end = polarToCartesian(50, 50, 45, startAngle)
    const largeArcFlag = percent > 50 ? 1 : 0
    
    return {
      ...item,
      startAngle,
      endAngle,
      path: `M 50 50 L ${start.x} ${start.y} A 45 45 0 ${largeArcFlag} 0 ${end.x} ${end.y} Z`
    }
  })

  return (
    <div style={s.pieChartContainer}>
      <div style={s.pieChart}>
        <svg viewBox="0 0 100 100">
          {paths.map((p, i) => (
            <path key={i} d={p.path} fill={p.color} />
          ))}
          <circle cx="50" cy="50" r="25" fill="#1e293b" />
          <text x="50" y="48" textAnchor="middle" fill="#f1f5f9" fontSize="10" fontWeight="700">{total}</text>
          <text x="50" y="56" textAnchor="middle" fill="#64748b" fontSize="5">总检查</text>
        </svg>
      </div>
      <div style={s.pieLegend}>
        {data.map((item, i) => (
          <div key={i} style={s.pieLegendItem}>
            <div style={{ ...s.pieLegendDot, background: item.color }} />
            <span style={s.pieLegendText}>{item.name}</span>
            <span style={s.pieLegendValue}>{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function polarToCartesian(cx: number, cy: number, r: number, angle: number) {
  const rad = (angle * Math.PI) / 180
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad)
  }
}

// 质量指标卡片
function QualityCard({ item }: { item: typeof QUALITY_DATA[0] }) {
  const Icon = item.icon
  return (
    <div style={s.qualityCard}>
      <div style={{ ...s.qualityIcon, background: `${item.color}20` }}>
        <Icon size={20} color={item.color} />
      </div>
      <div style={{ ...s.qualityValue, color: item.color }}>{item.value}</div>
      <div style={s.qualityLabel}>{item.label}</div>
    </div>
  )
}

// 进度条
function ProgressBar({ label, value, color }: { label: string, value: number, color: string }) {
  return (
    <div style={s.progressItem}>
      <div style={s.progressLabel}>
        <span>{label}</span>
        <span style={{ color }}>{value}%</span>
      </div>
      <div style={s.progressBar}>
        <div style={{ ...s.progressFill, width: `${value}%`, background: color }} />
      </div>
    </div>
  )
}

// ==================== 主页面 ====================
export default function OperationsCenterPage() {
  const [currentTime, setCurrentTime] = useState(() => new Date())
  // [W2-A] 实时数据状态 (API 加载失败时回退静态演示数据)
  const [loading, setLoading] = useState(true)
  const [dataSource, setDataSource] = useState<'api' | 'demo'>('demo')
  const [apiError, setApiError] = useState('')
  const [kpiData, setKpiData] = useState(KPI_DATA)
  const [rooms, setRooms] = useState(ROOMS)
  const [queueData, setQueueData] = useState(QUEUE_DATA)
  const [hourlyData, setHourlyData] = useState(HOURLY_DATA)
  const [hourlyCaption, setHourlyCaption] = useState('每小时检查量统计（0-24时）')
  const [doctorRanking, setDoctorRanking] = useState(DOCTOR_RANKING)
  const [projectData, setProjectData] = useState(PROJECT_DATA)
  const [qualityData, setQualityData] = useState(QUALITY_DATA)
  const [efficiencyData, setEfficiencyData] = useState(EFFICIENCY_DATA)
  const [alertMaterials, setAlertMaterials] = useState(ALERT_MATERIALS)
  const [peakText, setPeakText] = useState('高峰时段: 15:00 (82例)')
  const [todayTotal, setTodayTotal] = useState(326)
  const [yesterdayTotal, setYesterdayTotal] = useState(298)
  const [growthText, setGrowthText] = useState('+9.4%')
  const [summaryOverview, setSummaryOverview] = useState({ adverse: 0, normal: 324, safety: 100 })

  // [W2-A] 并发拉取 statsApi/occupancyApi/biApi/oeeApi/criticalExtApi/deviceMgmtApi,
  // 任一成功即切换为 API 数据源; 全部失败保留静态演示数据并标注。
  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setApiError('')
    try {
      const results = await Promise.allSettled([
        statsApi.getDaily(),
        statsApi.getTrend(2),
        biApi.getKpi(),
        biApi.getReportTimeliness(),
        occupancyApi.getRooms(),
        occupancyApi.getTrends(),
        oeeApi.getStats(),
        statsApi.getWorkload(),
        statsApi.getByModality(),
        criticalExtApi.getStats(),
        deviceMgmtApi.listDeviceFaults(),
        deviceMgmtApi.listMaterials(),
        statsApi.getTrend(7),
      ])
      const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null

      const daily = settled(results[0])
      const trend2 = Array.isArray(settled(results[1])) ? settled(results[1]) : []
      const bi = settled(results[2])?.data ?? null // BiEnvelope: { source, data }
      const timing = settled(results[3])?.data ?? null
      const occRooms = Array.isArray(settled(results[4])) ? settled(results[4]) : []
      const occTrends = Array.isArray(settled(results[5])) ? settled(results[5]) : []
      const oee = settled(results[6])
      const workload = Array.isArray(settled(results[7])) ? settled(results[7]) : []
      const byModality = settled(results[8])
      const cvStats = settled(results[9])
      const faults = Array.isArray(settled(results[10])) ? settled(results[10]) : []
      const materials = Array.isArray(settled(results[11])) ? settled(results[11]) : []
      const trend7 = Array.isArray(settled(results[12])) ? settled(results[12]) : []

      const anyReal = Boolean(daily || bi || occRooms.length || occTrends.length || oee || workload.length)
      if (!anyReal) {
        setDataSource('demo')
        setApiError('API 暂不可用，当前展示内置演示数据')
        return
      }
      setDataSource('api')

      // ---- KPI 指标条 ----
      const todayExam = toNum(bi?.examCount ?? daily?.examCount)
      const yestExam = trend2.length >= 2 ? toNum(trend2[trend2.length - 2]?.examCount) : undefined
      const occupiedRooms = occRooms.filter((r: any) => r.status === 'occupied').length
      const lastOcc = occTrends.length ? occTrends[occTrends.length - 1] : null
      const waitingCount = lastOcc ? Math.max(0, toNum(lastOcc.total) - toNum(lastOcc.occupied)) : undefined
      const avgTAT = toNum(daily?.avgTAT ?? timing?.medianMinutes)
      setKpiData([
        { label: '今日检查量', value: todayExam || KPI_DATA[0].value, unit: '例', yesterday: (yestExam ?? todayExam) || KPI_DATA[0].yesterday, trend: 'up' },
        { label: '今日预约量', value: toNum(daily?.examCount) || KPI_DATA[1].value, unit: '例', yesterday: todayExam || KPI_DATA[1].yesterday, trend: 'up' },
        { label: '在检人数', value: occupiedRooms, unit: '人', trend: 'neutral', yesterday: occupiedRooms },
        { label: '等待人数', value: waitingCount ?? KPI_DATA[3].value, unit: '人', trend: 'neutral', yesterday: waitingCount ?? KPI_DATA[3].value },
        { label: '设备利用率', value: toNum(oee?.average) || KPI_DATA[4].value, unit: '%', trend: 'neutral', yesterday: toNum(oee?.average) || KPI_DATA[4].value },
        { label: '平均报告时间', value: avgTAT || KPI_DATA[5].value, unit: '分钟', trend: 'neutral', yesterday: avgTAT || KPI_DATA[5].value },
      ])

      // ---- 检查室状态 (occupancyApi) ----
      if (occRooms.length > 0) {
        setRooms(occRooms.slice(0, 6).map((r: any) => {
          const st = ROOM_STATUS_MAP[String(r.status)] || { label: String(r.status), color: 'var(--text-secondary)' }
          return { name: r.roomNo, status: st.label, patient: r.currentPatient || '-', color: st.color }
        }))
      }

      // ---- 等待队列 (occupancyApi/trends) ----
      if (occTrends.length > 0) {
        setQueueData(occTrends.slice(-10).map((p: any) => ({
          time: String(p.time ?? '').slice(0, 5),
          count: Math.max(0, toNum(p.total) - toNum(p.occupied)),
        })))
      }

      // ---- 7 日检查趋势 (statsApi/trend) ----
      if (trend7.length > 0) {
        const pts = trend7.map((d: any, i: number) => ({
          hour: String(d.date ?? '').slice(5),
          today: toNum(d.examCount),
          yesterday: i > 0 ? toNum(trend7[i - 1]?.examCount) : 0,
          peak: false,
        }))
        setHourlyData(pts)
        setHourlyCaption('近7日每日检查量对比（API 实时）')
        const peak = pts.reduce((m, p) => (p.today > m.today ? p : m), pts[0] || { hour: '-', today: 0 })
        setPeakText(`高峰日: ${peak.hour} (${peak.today}例)`)
      } else {
        setHourlyCaption('每小时检查量统计（0-24时）· 演示数据')
      }

      // ---- 医生工作量排行 (statsApi/workload) ----
      if (workload.length > 0) {
        setDoctorRanking(workload.slice(0, 6).map((w: any, i: number) => ({
          rank: i + 1,
          name: w.doctorName || String(w.doctorId || '-'),
          exams: toNum(w.totalReports ?? w.reportCount),
          reports: toNum(w.totalCritical),
          rate: Math.round(toNum(w.avgQCScore) * 10) / 10,
        })))
      }

      // ---- 检查项目分布 (statsApi/by-modality) ----
      const modalityEntries = Object.entries(byModality || {}).slice(0, 5)
        .map(([name, v]: [string, any], i: number) => ({ name, value: Math.round(toNum(v?.total ?? v)), color: PIE_COLORS[i % PIE_COLORS.length] }))
        .filter((d) => d.value > 0)
      if (modalityEntries.length > 0) setProjectData(modalityEntries)

      // ---- 质量与安全 (criticalExtApi + deviceMgmtApi) ----
      setQualityData(QUALITY_DATA.map((item, i) => {
        if (i === 0) return { ...item, value: toNum(cvStats?.total ?? daily?.criticalCount) }
        if (i === 2) return { ...item, value: faults.length }
        return { ...item }
      }))

      // ---- 资源与效率 (oeeApi + occupancyApi + biApi) ----
      const occupancyRate = lastOcc ? toNum(lastOcc.rate) : 0
      const timelyPct = Array.isArray(timing?.buckets)
        ? Math.round((timing.buckets as any[])
            .filter((b: any) => ['<30min', '30min-1h', '1h-2h'].includes(String(b.bucket)))
            .reduce((s: number, b: any) => s + toNum(b.percent), 0) * 10) / 10
        : 0
      setEfficiencyData({
        equipmentUsage: toNum(oee?.average) || EFFICIENCY_DATA.equipmentUsage,
        roomOccupancy: occupancyRate || EFFICIENCY_DATA.roomOccupancy,
        avgExamTime: EFFICIENCY_DATA.avgExamTime,
        reportTimelyRate: timelyPct || EFFICIENCY_DATA.reportTimelyRate,
      })

      // ---- 耗材预警 (deviceMgmtApi/materials) ----
      const mats = materials
        .filter((m: any) => toNum(m.minStock) > 0)
        .map((m: any) => ({ name: m.name, stock: toNum(m.quantity), threshold: toNum(m.minStock) }))
        .slice(0, 4)
      if (mats.length > 0) setAlertMaterials(mats)

      // ---- 底部统计卡 ----
      setTodayTotal(todayExam || 326)
      setYesterdayTotal(yestExam ?? 298)
      const growth = yestExam ? ((todayExam - yestExam) / yestExam) * 100 : 0
      setGrowthText(`${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%`)
      const defectCount = toNum(daily?.defectCount)
      setSummaryOverview({
        adverse: defectCount,
        normal: todayExam || 324,
        safety: todayExam ? Math.round(((todayExam - defectCount) / todayExam) * 100) : 100,
      })
    } catch (e) {
      setApiError(e instanceof Error ? e.message : '数据加载失败，已回退演示数据')
      setDataSource('demo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={s.root}>
      {/* 顶部标题栏 */}
      <div style={s.headerBar}>
        <div style={s.headerTitle}>
          <Scan size={32} color="#3b82f6" />
          <div>
            <h1 style={s.headerText}>运营指挥中心</h1>
            <p style={s.headerSub}>放射科 | 实时数据监控</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          {loading && (
            <span style={{ fontSize: 12, color: '#fbbf24' }}>
              <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2, animation: 'spin 1s linear infinite' }} />
              数据同步中...
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>当前时间</div>
            <div style={s.headerTime}>
              {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
            </div>
          </div>
          <RefreshCw size={20} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={() => void loadDashboard()} />
        </div>
      </div>

      {/* 数据源状态条 [W2-A] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
          background: dataSource === 'api' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
          color: dataSource === 'api' ? '#4ade80' : '#fbbf24', fontWeight: 600,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? '#4ade80' : '#fbbf24' }} />
          数据源: {dataSource === 'api' ? 'API 实时 (statsApi/occupancyApi/biApi/oeeApi)' : '演示数据'}
        </span>
        {apiError && (
          <span style={{ color: '#ef4444' }}>
            {apiError}
            <button onClick={() => void loadDashboard()} style={{ marginLeft: 8, padding: '2px 10px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 12 }}>重试</button>
          </span>
        )}
      </div>

      {/* KPI指标条 */}
      <div style={s.kpiBar}>
        {kpiData.map((item, idx) => (
          <KPICard key={idx} data={item} />
        ))}
      </div>

      {/* 主内容区 */}
      <div style={s.mainGrid}>
        {/* 左侧：实时叫号与候诊态势 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Bell size={20} color="#3b82f6" />
            实时叫号与候诊态势
          </div>
          
          <div style={s.callingCard}>
            <div style={s.callingLabel}>当前呼叫</div>
            <div style={s.callingPatient}>张志明</div>
            <div style={s.callingRoom}>MRI2室 检查中</div>
          </div>

          <div style={s.roomGrid}>
            {rooms.map((room, idx) => (
              <RoomCard key={idx} room={room} />
            ))}
          </div>

          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>等待队列变化（过去1小时）</div>
            <QueueChart data={queueData} />
          </div>
        </div>

        {/* 中央：今日检查趋势 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <TrendingUp size={20} color="#4ade80" />
            今日检查趋势
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{hourlyCaption}</span>
            <span style={{ fontSize: 12, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 4 }}>
              <Zap size={14} /> {peakText}
            </span>
          </div>
          <TrendChart data={hourlyData} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 24 }}>
            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{todayTotal}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>今日总检查</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{yesterdayTotal}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>昨日总检查</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{growthText}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>环比增长</div>
            </div>
            <div style={{ textAlign: 'center', padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>{peakText.split('(')[0].replace('高峰日: ', '').trim()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>高峰时段</div>
            </div>
          </div>
        </div>

        {/* 右侧：科室工作量排行 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Gauge size={20} color="#8b5cf6" />
            科室工作量排行
          </div>
          
          <table style={s.table}>
            <thead>
              <tr>
                <th style={{ ...s.th, width: 40 }}>#</th>
                <th style={s.th}>医生</th>
                <th style={s.th}>报告</th>
                <th style={s.th}>危急值</th>
                <th style={s.th}>QC评分</th>
              </tr>
            </thead>
            <tbody>
              {doctorRanking.map((doc, idx) => (
                <tr key={idx}>
                  <td style={s.td}>
                    <span style={{
                      ...s.rankBadge,
                      background: idx === 0 ? '#fbbf24' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c32' : 'rgba(71, 85, 105, 0.5)',
                      color: idx < 3 ? '#0f172a' : '#94a3b8'
                    }}>
                      {doc.rank}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontWeight: 600 }}>{doc.name}</td>
                  <td style={s.td}>{doc.exams}</td>
                  <td style={s.td}>{doc.reports}</td>
                  <td style={{ ...s.td, color: doc.rate >= 90 ? '#4ade80' : doc.rate >= 80 ? '#fbbf24' : '#ef4444' }}>
                    {doc.rate}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ marginTop: 24 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>检查项目分布</div>
            <PieChartComponent data={projectData} />
          </div>
        </div>
      </div>

      {/* 底部区域 */}
      <div style={s.bottomGrid}>
        {/* 左下：质量与安全指标 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Shield size={20} color="#ef4444" />
            质量与安全指标
          </div>
          <div style={s.qualityGrid}>
            {qualityData.map((item, idx) => (
              <QualityCard key={idx} item={item} />
            ))}
          </div>
          
          <div style={{ marginTop: 20, padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 12 }}>今日概览</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{summaryOverview.adverse}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>不良事件</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{summaryOverview.normal}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>正常检查</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 28, fontWeight: 700, color: '#fbbf24' }}>{summaryOverview.safety}%</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>安全率</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右下：资源与效率 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Activity size={20} color="#4ade80" />
            资源与效率
          </div>
          
          <ProgressBar label="设备使用率" value={efficiencyData.equipmentUsage} color="#3b82f6" />
          <ProgressBar label="诊室占用率" value={efficiencyData.roomOccupancy} color="#8b5cf6" />
          <ProgressBar label="报告及时率" value={efficiencyData.reportTimelyRate} color="#4ade80" />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 8 }}>
            <div style={{ padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8, textAlign: 'center' }}>
              <Clock size={20} color="#fbbf24" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{efficiencyData.avgExamTime}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>平均检查时长(分钟)</div>
            </div>
            <div style={{ padding: 16, background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8, textAlign: 'center' }}>
              <CheckCircle size={20} color="#4ade80" style={{ marginBottom: 8 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: '#4ade80' }}>{efficiencyData.reportTimelyRate}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>报告及时率</div>
            </div>
          </div>

          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 14, color: '#ef4444', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={16} />
              耗材消耗预警
            </div>
            <div style={s.alertList}>
              {alertMaterials.map((item, idx) => (
                <div key={idx} style={s.alertItem}>
                  <div style={s.alertName}>
                    <Film size={14} color="#ef4444" />
                    {item.name}
                  </div>
                  <div style={s.alertStock}>
                    {item.stock} / {item.threshold}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 底部状态栏 */}
      <div style={{
        marginTop: 20,
        padding: '12px 24px',
        background: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid rgba(71, 85, 105, 0.5)',
      }}>
        <div style={{ display: 'flex', gap: 32 }}>
          <span style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            系统正常运行
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>数据更新: {new Date().toLocaleTimeString('zh-CN')} · 数据源: {dataSource === 'api' ? 'API 实时' : '演示数据'}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          G005 放射科RIS系统 v0.7.0 | 运营指挥中心
        </div>
      </div>
    </div>
  )
}

// 添加缺失的Shield图标组件
function Shield({ size = 24, color = '#fff' }: { size?: number, color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}
