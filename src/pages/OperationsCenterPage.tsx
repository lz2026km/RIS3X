// ============================================================
// G005 放射科RIS系统 - 运营指挥中心大屏
// 科室主任/院长驾驶舱 - 放射科实时数据监控
// ============================================================
import { useState, useEffect, useCallback } from 'react'
import type { TableColumnsType } from 'antd'
import { Typography } from 'antd'
import {
  Activity, AlertTriangle, ArrowUp, ArrowDown, Bell,
  Clock, TrendingUp,
  CheckCircle, RefreshCw, Monitor, Users,
  Zap, Wrench, MessageSquare, Gauge, Minus, Scan, Film,
  // [v3.0.6.11-99 Wave10B] 运营指挥中心深化: 多Tab看板/12KPI/预警/急诊通道
  LayoutDashboard, ShieldCheck, Siren, WifiOff, TimerReset, Shield as ShieldGlyph,
  BadgeAlert, Stethoscope, HeartPulse
} from 'lucide-react'
// [W2-A] 真实 API 接入: statsApi/occupancyApi/biApi/oeeApi/criticalExtApi/deviceMgmtApi
import { statsApi } from '../services/api/statsApi'
import { biApi } from '../services/api/biApi'
import { occupancyApi } from '../services/api/occupancyApi'
import { oeeApi } from '../services/api/oeeApi'
import { criticalExtApi } from '../services/api/criticalExtApi'
import { deviceMgmtApi } from '../services/api/deviceMgmtApi'
// [v3.0.6.11-99 Wave10B] 深化数据源: 急诊通道 / 检查耗时 / 危急值SLA
import { emergencyChannelApi, type EmergencyTriggerRecord } from '../services/api/emergencyChannelApi'
import { worklistApi } from '../services/api/worklistApi'
import { t } from '../i18n/appI18n'
import { DataTable } from '../components/common'

// ==================== 模拟数据 ====================
const KPI_DATA = [
  { label: t('opsCenter.kpiTodayExams'), value: 326, unit: t('opsCenter.unitExam'), yesterday: 298, trend: 'up' },
  { label: t('opsCenter.kpiTodayAppointments'), value: 358, unit: t('opsCenter.unitExam'), yesterday: 342, trend: 'up' },
  { label: t('opsCenter.kpiInProgress'), value: 24, unit: t('opsCenter.unitPeople'), trend: 'neutral' },
  { label: t('opsCenter.kpiWaiting'), value: 86, unit: t('opsCenter.unitPeople'), trend: 'down' },
  { label: t('opsCenter.kpiEquipmentUsage'), value: 91.2, unit: '%', trend: 'up' },
  { label: t('opsCenter.kpiAvgWait'), value: 12, unit: t('opsCenter.unitMinute'), trend: 'down' },
]

const ROOMS = [
  { name: 'CT1室', status: t('opsCenter.roomOccupied'), patient: '王建国', color: '#4ade80' },
  { name: 'CT2室', status: t('opsCenter.roomIdle'), patient: '-', color: 'var(--text-secondary)' },
  { name: 'MRI1室', status: t('opsCenter.roomPreparing'), patient: '李秀英', color: 'var(--color-warning-400)' },
  { name: 'MRI2室', status: t('opsCenter.roomOccupied'), patient: '张志明', color: '#4ade80' },
  { name: 'X线室', status: t('opsCenter.roomOccupied'), patient: '陈晓燕', color: '#4ade80' },
  { name: '乳腺室', status: t('opsCenter.roomIdle'), patient: '-', color: 'var(--text-secondary)' },
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
  { name: 'CT', value: 128, color: 'var(--color-primary-500)' },
  { name: 'MRI', value: 85, color: '#4ade80' },
  { name: t('opsCenter.projXray'), value: 72, color: 'var(--color-warning-400)' },
  { name: 'MG', value: 28, color: '#f97316' },
  { name: t('opsCenter.projOther'), value: 13, color: '#8b5cf6' },
]

const QUALITY_DATA = [
  { label: t('opsCenter.qCritical'), value: 2, icon: AlertTriangle, color: 'var(--color-error-500)', status: 'warning' },
  { label: t('opsCenter.qInfection'), value: 0, icon: Activity, color: '#4ade80', status: 'normal' },
  { label: t('opsCenter.qFault'), value: 0, icon: Wrench, color: 'var(--color-warning-400)', status: 'warning' },
  { label: t('opsCenter.qComplaint'), value: 1, icon: MessageSquare, color: 'var(--color-primary-500)', status: 'info' },
]

const EFFICIENCY_DATA = {
  equipmentUsage: 91.2,
  roomOccupancy: 78.5,
  avgExamTime: 22,
  reportTimelyRate: 96.5,
}

const ALERT_MATERIALS = [
  { name: t('opsCenter.matCtFilm'), stock: 45, threshold: 100 },
  { name: t('opsCenter.matMriContrast'), stock: 8, threshold: 20 },
  { name: t('opsCenter.matMammoFilm'), stock: 12, threshold: 30 },
  { name: t('opsCenter.matXrayFilm'), stock: 25, threshold: 50 },
]

const PIE_COLORS = ['var(--color-primary-500)', '#4ade80', 'var(--color-warning-400)', '#f97316', '#8b5cf6']

// [W2-A] 检查室状态映射 (occupancyApi)
const ROOM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  occupied: { label: t('opsCenter.roomOccupied'), color: '#4ade80' },
  idle: { label: t('opsCenter.roomIdle'), color: 'var(--text-secondary)' },
  disinfecting: { label: t('opsCenter.roomDisinfecting'), color: 'var(--color-warning-400)' },
  fault: { label: t('opsCenter.roomFault'), color: 'var(--color-error-500)' },
}

function toNum(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

// ==================== 样式 ====================
const s: Record<string, React.CSSProperties> = {
  root: { background: 'linear-gradient(135deg, var(--bg-primary, #0d1117) 0%, #1a1f2e 100%)',
    color: '#f1f5f9',
    padding: '20px 24px',
    fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
  },
  // 顶部标题栏
  headerBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 'var(--space-5, 20px)',
    padding: '12px 24px',
    background: 'rgba(30, 41, 59, 0.8)',
    borderRadius: 12,
    border: '1px solid rgba(71, 85, 105, 0.5)',
  },
  headerTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3, 12px)',
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
    gap: 'var(--space-4, 16px)',
    marginBottom: 'var(--space-5, 20px)',
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
    background: 'linear-gradient(90deg, var(--color-primary-500), #4ade80)',
  },
  kpiLabel: {
    fontSize: 14,
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-2, 8px)',
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
    marginLeft: 'var(--space-1, 4px)',
  },
  kpiTrend: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1, 4px)',
    fontSize: 14,
    marginTop: 'var(--space-2, 8px)',
  },
  kpiTrendUp: { color: '#4ade80' },
  kpiTrendDown: { color: 'var(--color-error-500)' },
  // 主内容区
  mainGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 2fr 1fr',
    gap: 'var(--space-5, 20px)',
    marginBottom: 'var(--space-5, 20px)',
  },
  // 面板通用样式
  panel: {
    background: 'rgba(30, 41, 59, 0.9)',
    borderRadius: 12,
    padding: 'var(--space-5, 20px)',
    border: '1px solid rgba(71, 85, 105, 0.5)',
  },
  panelTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#f1f5f9',
    marginBottom: 'var(--space-4, 16px)',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2, 8px)',
    paddingBottom: 'var(--space-3, 12px)',
    borderBottom: '1px solid rgba(71, 85, 105, 0.5)',
  },
  // 叫号区域
  callingCard: {
    background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2), rgba(59, 130, 246, 0.05))',
    borderRadius: 12,
    padding: 'var(--space-6, 24px)',
    textAlign: 'center',
    marginBottom: 'var(--space-5, 20px)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
  },
  callingLabel: {
    fontSize: 16,
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-3, 12px)',
  },
  callingPatient: {
    fontSize: 56,
    fontWeight: 800,
    color: 'var(--color-primary-500)',
    marginBottom: 'var(--space-2, 8px)',
  },
  callingRoom: {
    fontSize: 30,
    fontWeight: 700,
    color: '#4ade80',
  },
  // 检查室状态
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 'var(--space-3, 12px)',
    marginBottom: 'var(--space-5, 20px)',
  },
  roomCard: {
    background: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 8,
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3, 12px)',
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
    gap: 'var(--space-1, 4px)',
    height: 100,
    padding: '8px 0',
  },
  barItem: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-1, 4px)',
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
    marginTop: 'var(--space-4, 16px)',
  },
  lineChartSvg: {
    width: '100%',
    height: '100%',
  },
  // 饼图
  pieChartContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-6, 24px)',
    marginTop: 'var(--space-4, 16px)',
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
    gap: 'var(--space-2, 8px)',
    marginBottom: 'var(--space-2, 8px)',
  },
  pieLegendDot: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  pieLegendText: {
    fontSize: 12,
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
    fontSize: 12,
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
    gap: 'var(--space-3, 12px)',
  },
  qualityCard: {
    background: 'rgba(51, 65, 85, 0.5)',
    borderRadius: 10,
    padding: 'var(--space-4, 16px)',
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
    fontSize: 30,
    fontWeight: 700,
    color: '#f1f5f9',
  },
  qualityLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 'var(--space-1, 4px)',
  },
  // 进度条
  progressItem: {
    marginBottom: 'var(--space-4, 16px)',
  },
  progressLabel: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: 12,
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
    marginTop: 'var(--space-3, 12px)',
  },
  alertItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    background: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 8,
    marginBottom: 'var(--space-2, 8px)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  alertName: {
    fontSize: 14,
    color: '#f1f5f9',
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2, 8px)',
  },
  alertStock: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--color-error-500)',
  },
  // 底部区域
  bottomGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 'var(--space-5, 20px)',
  },
}

// ==================== 组件 ====================

// KPI卡片
function KPICard({ data }: { data: typeof KPI_DATA[0] }) {
  const trendColor = data.trend === 'up' ? '#4ade80' : data.trend === 'down' ? 'var(--color-error-500)' : '#94a3b8'
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
        <span style={{ color: 'var(--text-secondary)', marginLeft: 'var(--space-1, 4px)' }}>{t('opsCenter.vsYesterday')}</span>
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
              background: idx === data.length - 1 ? '#4ade80' : 'var(--color-primary-500)',
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
  const peak = (peakIndex >= 0 ? data[peakIndex] : data.reduce((m, p) => (p.today > m.today ? p : m), data[0] || { hour: '-', today: 0 })) ?? { hour: '-', today: 0 }
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
        <circle cx={peakX} cy={peakY} r="2" fill="var(--color-warning-400)" />
        <text x={peakX} y={peakY - 3} fill="var(--color-warning-400)" fontSize="3" textAnchor="middle">{t('opsCenter.peakLabel')}</text>
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
      <div style={{ display: 'flex', gap: 'var(--space-6, 24px)', justifyContent: 'center', marginTop: 'var(--space-3, 12px)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 3, background: '#4ade80', borderRadius: 2 }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.legendToday')}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 20, height: 3, background: '#64748b', borderRadius: 2, borderBottom: '2px dashed #64748b' }} />
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.legendYesterday')}</span>
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
          <text x="50" y="56" textAnchor="middle" fill="#64748b" fontSize="5">{t('opsCenter.pieTotal')}</text>
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
  const [hourlyCaption, setHourlyCaption] = useState(t('opsCenter.hourlyCaptionDemo'))
  const [doctorRanking, setDoctorRanking] = useState(DOCTOR_RANKING)
  const [projectData, setProjectData] = useState(PROJECT_DATA)
  const [qualityData, setQualityData] = useState(QUALITY_DATA)
  const [efficiencyData, setEfficiencyData] = useState(EFFICIENCY_DATA)
  const [alertMaterials, setAlertMaterials] = useState(ALERT_MATERIALS)
  const [peakText, setPeakText] = useState(`${t('opsCenter.peakHourPrefix')}15:00 (82例)`)
  const [todayTotal, setTodayTotal] = useState(326)
  const [yesterdayTotal, setYesterdayTotal] = useState(298)
  const [growthText, setGrowthText] = useState('+9.4%')
  const [summaryOverview, setSummaryOverview] = useState({ adverse: 0, normal: 324, safety: 100 })

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 深化状态: 多Tab看板 / 12KPI / 预警 / 急诊通道
  // ============================================================
  type OpsSection = 'overview' | 'equipment' | 'manpower' | 'quality' | 'emergency'
  const [activeSection, setActiveSection] = useState<OpsSection>('overview')
  const [extSource, setExtSource] = useState<'api' | 'demo'>('demo')
  const [extError, setExtError] = useState('')
  const [extLoading, setExtLoading] = useState(false)

  // 12 KPI: 在既有 6 项基础上追加 6 项 (开机率/技师效率/报告及时率/危急值闭环率/报告积压/设备故障)
  interface KpiExtItem { label: string; value: number; unit: string; yesterday: number; trend: 'up' | 'down' | 'neutral' }
  const [kpiExt, setKpiExt] = useState<KpiExtItem[]>([
    { label: t('opsCenter.kpiUptime'), value: 96.4, unit: '%', yesterday: 95.8, trend: 'up' as const },
    { label: t('opsCenter.kpiTechEfficiency'), value: 18, unit: t('opsCenter.unitMinute'), yesterday: 20, trend: 'up' as const },
    { label: t('opsCenter.kpiReportTimely'), value: 96.5, unit: '%', yesterday: 95.2, trend: 'up' as const },
    { label: t('opsCenter.kpiCriticalClosure'), value: 100, unit: '%', yesterday: 98.6, trend: 'up' as const },
    { label: t('opsCenter.kpiPendingReports'), value: 8, unit: t('opsCenter.unitReport'), yesterday: 12, trend: 'down' as const },
    { label: t('opsCenter.kpiDeviceFaults'), value: 0, unit: t('opsCenter.unitDevice'), yesterday: 1, trend: 'down' as const },
  ])

  // 预警面板 (设备离线/超时排队/危急值超时)
  const [alerts, setAlerts] = useState<Array<{ id: string; type: string; level: 'danger' | 'warning' | 'info'; title: string; detail: string; time: string }>>([
    { id: 'a-1', type: 'device', level: 'warning', title: t('opsCenter.alertDeviceOffline'), detail: t('opsCenter.alertDetailHeartbeat', { n: 12 }), time: t('opsCenter.timeMinutesAgo', { n: 12 }) },
    { id: 'a-2', type: 'queue', level: 'warning', title: t('opsCenter.alertQueueTimeout'), detail: t('opsCenter.alertDetailQueue', { room: 'CT3', n: 6, m: 30 }), time: t('opsCenter.timeMinutesAgo', { n: 8 }) },
    { id: 'a-3', type: 'critical', level: 'danger', title: t('opsCenter.alertCriticalTimeout'), detail: t('opsCenter.alertDetailCritical', { n: 1, m: 10 }), time: t('opsCenter.timeMinutesAgo', { n: 15 }) },
  ])

  // 急诊通道记录 (emergencyChannelApi.listRecords)
  const [emergencyRecords, setEmergencyRecords] = useState<EmergencyTriggerRecord[]>([])
  const [emergencyConfig, setEmergencyConfig] = useState<{ autoTrigger: boolean; keywords: string[]; channels: number }>({ autoTrigger: true, keywords: ['脑出血', '主动脉夹层', '肺栓塞'], channels: 4 })
  // [v3.0.6.11-99 Wave10B] 急诊通道渠道明细 + SLA 统计
  const [channelDetail, setChannelDetail] = useState<Array<{ type: string; label: string; enabled: boolean; priority: number; targetRole: string }>>([
    { type: 'in-app', label: t('opsCenter.channelInApp'), enabled: true, priority: 1, targetRole: t('opsCenter.roleOnDuty') },
    { type: 'phone', label: t('opsCenter.channelPhone'), enabled: true, priority: 2, targetRole: t('opsCenter.roleOnDuty') },
    { type: 'sms', label: t('opsCenter.channelSms'), enabled: true, priority: 3, targetRole: t('opsCenter.roleDeptHead') },
    { type: 'wechat', label: t('opsCenter.channelWechat'), enabled: true, priority: 4, targetRole: t('opsCenter.roleMedAffairs') },
  ])
  const [emergencySummary, setEmergencySummary] = useState({
    total: 0, acknowledged: 0, completed: 0, avgMinutes: 0, slaMin: 10,
    byType: [] as Array<[string, number]>,
    todayCount: 0,
  })

  // 设备维度看板 (deviceMgmtApi)
  const [deviceBoard, setDeviceBoard] = useState<Array<{ id: string; name: string; modality: string; status: string; utilization: number; faultCount: number; lastHeartbeat: string }>>([])
  // 人力维度看板 (statsApi/workload + worklistApi/stats)
  const [manpowerBoard, setManpowerBoard] = useState<Array<{ id: string; name: string; role: string; completedCount: number; avgDurationMin: number; online: boolean }>>([])
  // 质量维度看板 (criticalExtApi + biApi)
  const [qualityBoard, setQualityBoard] = useState<Array<{ id: string; label: string; value: number; unit: string; ok: boolean }>>([])

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
      const settled = (r: PromiseSettledResult<any>): any =>
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
        setApiError(t('opsCenter.apiUnavailable'))
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
        { label: t('opsCenter.kpiTodayExams'), value: todayExam || KPI_DATA[0]!.value, unit: t('opsCenter.unitExam'), yesterday: (yestExam ?? todayExam) || KPI_DATA[0]!.yesterday, trend: 'up' },
        { label: t('opsCenter.kpiTodayAppointments'), value: toNum(daily?.examCount) || KPI_DATA[1]!.value, unit: t('opsCenter.unitExam'), yesterday: todayExam || KPI_DATA[1]!.yesterday, trend: 'up' },
        { label: t('opsCenter.kpiInProgress'), value: occupiedRooms, unit: t('opsCenter.unitPeople'), trend: 'neutral', yesterday: occupiedRooms },
        { label: t('opsCenter.kpiWaiting'), value: waitingCount ?? KPI_DATA[3]!.value, unit: t('opsCenter.unitPeople'), trend: 'neutral', yesterday: waitingCount ?? KPI_DATA[3]!.value },
        { label: t('opsCenter.kpiEquipmentUsage'), value: toNum(oee?.average) || KPI_DATA[4]!.value, unit: '%', trend: 'neutral', yesterday: toNum(oee?.average) || KPI_DATA[4]!.value },
        { label: t('opsCenter.kpiAvgReportTime'), value: avgTAT || KPI_DATA[5]!.value, unit: t('opsCenter.unitMinute'), trend: 'neutral', yesterday: avgTAT || KPI_DATA[5]!.value },
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
        setHourlyCaption(t('opsCenter.hourlyCaptionApi'))
        const peak = pts.reduce((m: any, p: any) => (p.today > m.today ? p : m), pts[0] || { hour: '-', today: 0 })
        setPeakText(`${t('opsCenter.peakDayPrefix')}${peak.hour} (${peak.today}${t('opsCenter.unitExam')})`)
      } else {
        setHourlyCaption(t('opsCenter.hourlyCaptionDemo'))
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
        .map(([name, v]: [string, any], i: number) => ({ name, value: Math.round(toNum(v?.total ?? v)), color: PIE_COLORS[i % PIE_COLORS.length] ?? 'var(--color-primary-500)' }))
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
      setApiError(e instanceof Error ? e.message : t('opsCenter.loadFailed'))
      setDataSource('demo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadDashboard() }, [loadDashboard])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 深化数据加载: 急诊通道/预警/KPI扩展/设备-人力-质量看板
  // emergencyChannelApi + biApi.getCriticalSla + worklistApi.getStats + oeeApi + deviceMgmtApi
  // ============================================================
  const loadOpsExt = useCallback(async () => {
    setExtLoading(true)
    setExtError('')
    try {
      const results = await Promise.allSettled([
        emergencyChannelApi.listRecords(),
        emergencyChannelApi.getConfig(),
        biApi.getCriticalSla(),
        worklistApi.getStats(),
        oeeApi.getStats(),
        deviceMgmtApi.listDeviceFaults(),
        deviceMgmtApi.listDevices(),
        statsApi.getWorkload(),
        criticalExtApi.getStats(),
        statsApi.getDaily(),
      ])
      const settled = (r: PromiseSettledResult<any>): any =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null
      const ecRecords = settled(results[0])
      const ecConfig = settled(results[1])
      const cvSla = settled(results[2])
      const wlStats = settled(results[3])
      const oee = settled(results[4])
      const faults = Array.isArray(settled(results[5])) ? settled(results[5]) : []
      const devices = Array.isArray(settled(results[6])) ? settled(results[6]) : []
      const workload = Array.isArray(settled(results[7])) ? settled(results[7]) : []
      const cvStats = settled(results[8])
      const daily = settled(results[9])

      const anyReal = Boolean(ecRecords || ecConfig || cvSla || wlStats || oee || faults.length || devices.length || workload.length)
      if (!anyReal) {
        setExtSource('demo')
        setExtError(t('opsCenter.extUnavailable'))
        return
      }
      setExtSource('api')

      // ---- 急诊通道记录 ----
      const recList: EmergencyTriggerRecord[] = Array.isArray(ecRecords) ? ecRecords : Array.isArray((ecRecords as any)?.items) ? (ecRecords as any).items : []
      if (recList.length > 0) setEmergencyRecords(recList.slice(-8).reverse())
      if (ecConfig) {
        setEmergencyConfig({
          autoTrigger: Boolean((ecConfig as any)?.autoTrigger?.enabled),
          keywords: Array.isArray((ecConfig as any)?.autoTrigger?.keywords) ? (ecConfig as any).autoTrigger.keywords : [],
          channels: Array.isArray((ecConfig as any)?.channels) ? (ecConfig as any).channels.filter((c: any) => c.enabled).length : 0,
        })
        // [v3.0.6.11-99 Wave10B] 渠道明细 (优先级排序)
        if (Array.isArray((ecConfig as any)?.channels) && (ecConfig as any).channels.length > 0) {
          setChannelDetail([...(ecConfig as any).channels]
            .sort((a: any, b: any) => toNum(a.priority) - toNum(b.priority))
            .map((c: any) => ({
              type: String(c.type ?? ''),
              label: String(c.label ?? c.type ?? ''),
              enabled: Boolean(c.enabled),
              priority: toNum(c.priority),
              targetRole: String(c.targetRole ?? ''),
            })))
        }
      }
      // [v3.0.6.11-99 Wave10B] 急诊通道统计: 状态/类型/今日/平均响应
      if (recList.length > 0) {
        const byTypeMap: Record<string, number> = {}
        let today = 0
        const todayStr = new Date().toISOString().slice(0, 10)
        recList.forEach(r => {
          byTypeMap[String(r.type ?? '其他')] = (byTypeMap[String(r.type ?? '其他')] || 0) + 1
          if (String(r.triggeredAt ?? '').startsWith(todayStr)) today += 1
        })
        setEmergencySummary({
          total: recList.length,
          acknowledged: recList.filter(r => r.status === 'acknowledged').length,
          completed: recList.filter(r => r.status === 'completed').length,
          avgMinutes: Math.round(recList.reduce((s, r) => s + toNum((r as any).responseMinutes ?? 0), 0) / Math.max(1, recList.length)),
          slaMin: toNum((cvSla as any)?.slaMinutes ?? 10),
          byType: Object.entries(byTypeMap).sort((a, b) => b[1] - a[1]),
          todayCount: today,
        })
      }

      // ---- 预警面板 ----
      const nextAlerts: Array<{ id: string; type: string; level: 'danger' | 'warning' | 'info'; title: string; detail: string; time: string }> = []
      faults.slice(0, 3).forEach((f: any, i: number) => {
        nextAlerts.push({
          id: `dev-${i}`, type: 'device', level: 'danger',
          title: t('opsCenter.alertFaultOffline'), detail: t('opsCenter.alertDetailFault', { name: f.deviceName ?? f.name ?? '设备', reason: f.faultType ?? f.description ?? f.reason ?? '异常' }),
          time: String(f.createdAt ?? f.reportedAt ?? '').slice(5, 16).replace('T', ' ') || t('opsCenter.alertJustNow'),
        })
      })
      const overdue = Array.isArray((cvSla as any)?.overdue) ? (cvSla as any).overdue.filter((o: any) => toNum(o.responseMinutes) > toNum((cvSla as any)?.slaMinutes)) : []
      if (overdue.length > 0) {
        nextAlerts.push({
          id: 'cv-timeout', type: 'critical', level: 'danger',
          title: t('opsCenter.alertCriticalTimeout'),
          detail: t('opsCenter.alertDetailCritical', { n: overdue.length, m: toNum((cvSla as any)?.slaMinutes) }),
          time: t('opsCenter.alertTimeout'),
        })
      }
      const waiting = toNum(daily?.waitingCount ?? 0)
      if (waiting > 50) {
        nextAlerts.push({
          id: 'queue-timeout', type: 'queue', level: 'warning',
          title: t('opsCenter.alertQueueBacklog'), detail: t('opsCenter.alertDetailBacklog', { n: waiting, m: 50 }),
          time: t('opsCenter.alertRealtime'),
        })
      }
      if (nextAlerts.length > 0) setAlerts(nextAlerts)

      // ---- 12 KPI 扩展 ----
      const availability = toNum(oee?.availability ?? 0)
      const techEfficiency = Array.isArray((wlStats as any)?.byTechnician) && (wlStats as any).byTechnician.length > 0
        ? Math.round((wlStats as any).byTechnician.reduce((s: number, t: any) => s + toNum(t.avgDurationMin), 0) / (wlStats as any).byTechnician.length)
        : 0
      const timelyPct = toNum((wlStats as any)?.completedToday ?? 0) > 0 || daily ? toNum(daily?.timelyRate ?? 0) : 0
      const cvClosure = toNum((cvSla as any)?.complianceRate ?? 0)
      const pendingReports = toNum((daily as any)?.pendingCount ?? (biApi ? 0 : 0))
      setKpiExt([
        { label: t('opsCenter.kpiUptime'), value: availability || kpiExt[0]!.value, unit: '%', yesterday: availability || kpiExt[0]!.yesterday, trend: 'neutral' as const },
        { label: t('opsCenter.kpiTechEfficiency'), value: techEfficiency || kpiExt[1]!.value, unit: t('opsCenter.unitMinute'), yesterday: techEfficiency || kpiExt[1]!.yesterday, trend: 'neutral' as const },
        { label: t('opsCenter.kpiReportTimely'), value: timelyPct || kpiExt[2]!.value, unit: '%', yesterday: timelyPct || kpiExt[2]!.yesterday, trend: 'neutral' as const },
        { label: t('opsCenter.kpiCriticalClosure'), value: cvClosure || kpiExt[3]!.value, unit: '%', yesterday: cvClosure || kpiExt[3]!.yesterday, trend: 'neutral' as const },
        { label: t('opsCenter.kpiPendingReports'), value: pendingReports || kpiExt[4]!.value, unit: t('opsCenter.unitReport'), yesterday: pendingReports || kpiExt[4]!.yesterday, trend: 'neutral' as const },
        { label: t('opsCenter.kpiDeviceFaults'), value: faults.length, unit: t('opsCenter.unitDevice'), yesterday: kpiExt[5]!.yesterday, trend: faults.length === 0 ? 'down' : 'neutral' as const },
      ])

      // ---- 设备维度看板 ----
      if (devices.length > 0) {
        setDeviceBoard(devices.slice(0, 8).map((d: any, i: number) => ({
          id: d.id ?? `d-${i}`,
          name: d.name ?? d.deviceName ?? '设备',
          modality: d.modality ?? '—',
          status: d.status ?? d.state ?? '未知',
          utilization: toNum(d.utilizationRate ?? d.usageRate ?? 0),
          faultCount: faults.filter((f: any) => (f.deviceId ?? f.device?.id) === d.id).length,
          lastHeartbeat: String(d.lastHeartbeat ?? d.updatedAt ?? '').slice(11, 19) || '—',
        })))
      }

      // ---- 人力维度看板 ----
      const techRows = Array.isArray((wlStats as any)?.byTechnician) ? (wlStats as any).byTechnician : []
      if (techRows.length > 0 || workload.length > 0) {
        const merged = new Map<string, any>()
        techRows.forEach((t: any) => merged.set(String(t.id ?? t.name), { ...t, role: '技师' }))
        workload.forEach((w: any) => {
          const key = String(w.doctorId ?? w.doctorName ?? '')
          const existing = merged.get(key)
          merged.set(key, existing ? { ...existing, ...w, role: existing.role || '医师' } : { ...w, id: key, name: w.doctorName, role: '医师' })
        })
        setManpowerBoard([...merged.values()].slice(0, 8).map((m: any) => ({
          id: m.id ?? m.doctorId ?? '—',
          name: m.name ?? m.doctorName ?? '—',
          role: m.role ?? '医师',
          completedCount: toNum(m.completedCount ?? m.reportCount ?? m.examCount),
          avgDurationMin: Math.round(toNum(m.avgDurationMin ?? m.avgTime ?? 0)),
          online: true,
        })))
      }

      // ---- 质量维度看板 ----
      setQualityBoard([
        { id: 'q1', label: t('opsCenter.kpiCriticalClosure'), value: cvClosure || 100, unit: '%', ok: cvClosure >= 95 || cvClosure === 0 },
        { id: 'q2', label: t('opsCenter.kpiReportTimely'), value: timelyPct || 96.5, unit: '%', ok: true },
        { id: 'q3', label: t('opsCenter.kpiEquipmentUsage'), value: toNum(oee?.average ?? 0) || 91.2, unit: '%', ok: true },
        { id: 'q4', label: t('opsCenter.qCritical'), value: toNum(cvStats?.total ?? daily?.criticalCount ?? 0), unit: t('opsCenter.unitExam'), ok: true },
      ])
    } catch (e) {
      setExtError(e instanceof Error ? e.message : t('opsCenter.extLoadFailed'))
      setExtSource('demo')
    } finally {
      setExtLoading(false)
    }
  }, [])

  useEffect(() => { void loadOpsExt() }, [loadOpsExt])

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 渲染: 多 Tab 看板 (总览/设备/人力/质量/急诊通道)
  // ============================================================
  const renderSectionTabs = () => {
    const tabs: Array<{ key: OpsSection; label: string; icon: React.ReactNode }> = [
      { key: 'overview', label: t('opsCenter.tabOverview'), icon: <LayoutDashboard size={14} /> },
      { key: 'equipment', label: t('opsCenter.tabEquipment'), icon: <Monitor size={14} /> },
      { key: 'manpower', label: t('opsCenter.tabManpower'), icon: <Users size={14} /> },
      { key: 'quality', label: t('opsCenter.tabQuality'), icon: <ShieldCheck size={14} /> },
      { key: 'emergency', label: t('opsCenter.tabEmergency'), icon: <Siren size={14} /> },
    ]
    return (
      <div style={{
        display: 'flex', gap: 6, marginBottom: 'var(--space-4, 16px)', padding: 6,
        background: 'rgba(30, 41, 59, 0.9)', borderRadius: 10,
        border: '1px solid rgba(71, 85, 105, 0.5)', width: 'fit-content',
      }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveSection(tab.key)}
            style={{
              padding: '8px 18px', borderRadius: 6, border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600,
              background: activeSection === tab.key ? 'var(--color-primary-500)' : 'transparent',
              color: activeSection === tab.key ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
        {extSource === 'api' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
            background: 'rgba(34,197,94,0.15)', color: '#4ade80', fontWeight: 600, fontSize: 12, marginLeft: 'var(--space-2, 8px)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            {t('opsCenter.extApiBadge')}
          </span>
        )}
        {extSource === 'demo' && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
            background: 'rgba(245,158,11,0.15)', color: 'var(--color-warning-400)', fontWeight: 600, fontSize: 12, marginLeft: 'var(--space-2, 8px)',
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--color-warning-400)' }} />
            {t('opsCenter.extDemoBadge')}
          </span>
        )}
        {extLoading && <span style={{ fontSize: 12, color: 'var(--color-warning-400)', alignSelf: 'center' }}>{t('opsCenter.extSyncing')}</span>}
      </div>
    )
  }

  // 渲染: 12 KPI 扩展条 (新增 6 项)
  const renderKpiExt = () => (
    <div style={s.kpiBar}>
      {kpiExt.map((item, idx) => <KPICard key={`ext-${idx}`} data={item} />)}
    </div>
  )

  // 渲染: 预警面板
  const renderAlertsPanel = () => (
    <div style={{ ...s.panel, marginBottom: 'var(--space-4, 16px)' }}>
      <div style={s.panelTitle}>
        <BadgeAlert size={18} color={alerts.some(a => a.level === 'danger') ? 'var(--color-error-500)' : 'var(--color-warning-400)'} />
        {t('opsCenter.alertsTitle')}
        <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {t('opsCenter.alertsPending', { n: alerts.length })}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2, 8px)' }}>
        {alerts.length === 0 && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#4ade80', fontSize: 12 }}>
            <CheckCircle size={20} style={{ marginBottom: 6 }} /> {t('opsCenter.noAlerts')}
          </div>
        )}
        {alerts.map(a => (
          <div key={a.id} style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: '10px 14px', borderRadius: 8,
            background: a.level === 'danger' ? 'rgba(239,68,68,0.12)' : a.level === 'warning' ? 'rgba(245,158,11,0.12)' : 'rgba(59,130,246,0.12)',
            border: `1px solid ${a.level === 'danger' ? 'rgba(239,68,68,0.4)' : a.level === 'warning' ? 'rgba(245,158,11,0.4)' : 'rgba(59,130,246,0.4)'}`,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 8, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: a.level === 'danger' ? '#ef444422' : a.level === 'warning' ? '#f59e0b22' : '#3b82f622',
              color: a.level === 'danger' ? 'var(--color-error-500)' : a.level === 'warning' ? 'var(--color-warning-500)' : 'var(--color-primary-500)',
            }}>
              {a.type === 'device' ? <WifiOff size={18} /> : a.type === 'queue' ? <TimerReset size={18} /> : <AlertTriangle size={18} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9', display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
                {a.title}
                <span style={{
                  padding: '1px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                  background: a.level === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                  color: a.level === 'danger' ? 'var(--color-error-500)' : 'var(--color-warning-400)',
                }}>
                  {a.level === 'danger' ? t('opsCenter.alertUrgent') : t('opsCenter.alertAttention')}
                </span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.detail}
              </div>
            </div>
            <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0 }}>{a.time}</span>
          </div>
        ))}
      </div>
      {extError && (
        <div style={{ marginTop: 10, fontSize: 11, color: 'var(--color-warning-400)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
          <AlertTriangle size={11} /> {extError}
          <button onClick={() => void loadOpsExt()} style={{ marginLeft: 'var(--space-2, 8px)', padding: '1px 8px', borderRadius: 4, border: '1px solid var(--color-warning-400)', background: 'transparent', color: 'var(--color-warning-400)', cursor: 'pointer', fontSize: 11 }}>{t('opsCenter.retry')}</button>
        </div>
      )}
    </div>
  )

  const deviceBoardColumns: TableColumnsType<any> = [
    { title: t('opsCenter.thDevice'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('opsCenter.thModality'), dataIndex: 'modality', key: 'modality' },
    {
      title: t('opsCenter.thStatus'), dataIndex: 'status', key: 'status',
      render: (v: string) => (
        <span style={{
          padding: '2px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600,
          background: v === '运行中' || v === 'online' || v === '正常' ? 'rgba(34,197,94,0.15)' : v === '故障' || v === 'fault' || v === '离线' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)',
          color: v === '运行中' || v === 'online' || v === '正常' ? '#4ade80' : v === '故障' || v === 'fault' || v === '离线' ? 'var(--color-error-500)' : 'var(--color-warning-400)',
        }}>{v}</span>
      ),
    },
    {
      title: t('opsCenter.thUtilization'), dataIndex: 'utilization', key: 'utilization',
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <div style={{ width: 80, height: 6, background: 'rgba(51,65,85,0.8)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ width: `${Math.min(100, v)}%`, height: '100%', background: v >= 80 ? '#4ade80' : v >= 50 ? 'var(--color-warning-400)' : 'var(--color-primary-500)', borderRadius: 3 }} />
          </div>
          <span style={{ fontSize: 12 }}>{v}%</span>
        </div>
      ),
    },
    { title: t('opsCenter.thFaultCount'), dataIndex: 'faultCount', key: 'faultCount', render: (v: number) => <span style={{ color: v > 0 ? 'var(--color-error-500)' : 'inherit' }}>{v}</span> },
    { title: t('opsCenter.thHeartbeat'), dataIndex: 'lastHeartbeat', key: 'lastHeartbeat' },
  ]

  const manpowerColumns: TableColumnsType<any> = [
    { title: t('opsCenter.thPerson'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    {
      title: t('opsCenter.thRole'), dataIndex: 'role', key: 'role',
      render: (v: string) => (
        <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: v === t('opsCenter.roleTech') ? 'rgba(139,92,246,0.15)' : 'rgba(59,130,246,0.15)', color: v === t('opsCenter.roleTech') ? '#a78bfa' : '#60a5fa' }}>
          {v}
        </span>
      ),
    },
    { title: t('opsCenter.thCompletedToday'), dataIndex: 'completedCount', key: 'completedCount', render: (v: number) => `${v} ${t('opsCenter.unitExam')}` },
    {
      title: t('opsCenter.thAvgDuration'), key: 'avgDuration',
      render: (_v: unknown, m: any) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)' }}>
          <div style={{ width: 80, height: 6, background: 'rgba(51,65,85,0.8)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, m.avgDurationMin ? (30 / m.avgDurationMin) * 100 : 50)}%`,
              height: '100%', borderRadius: 3,
              background: m.avgDurationMin && m.avgDurationMin <= 20 ? '#4ade80' : m.avgDurationMin && m.avgDurationMin <= 30 ? 'var(--color-warning-400)' : 'var(--color-error-500)',
            }} />
          </div>
          <span style={{ fontSize: 12 }}>{m.avgDurationMin || '—'} {t('opsCenter.unitMinute')}</span>
        </div>
      ),
    },
    {
      title: t('opsCenter.thStatus'), key: 'online',
      render: (_v: unknown, m: any) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: m.online ? '#4ade80' : 'var(--color-warning-400)' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: m.online ? '#4ade80' : 'var(--color-warning-400)' }} />
          {m.online ? t('opsCenter.statusOnline') : t('opsCenter.statusOffline')}
        </span>
      ),
    },
  ]

  const channelColumns: TableColumnsType<any> = [
    {
      title: t('opsCenter.thPriority'), dataIndex: 'priority', key: 'priority',
      render: (v: number) => (
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 24, height: 24, borderRadius: '50%', fontSize: 12, fontWeight: 700,
          background: v === 1 ? 'rgba(239,68,68,0.2)' : v <= 3 ? 'rgba(245,158,11,0.2)' : 'rgba(59,130,246,0.2)',
          color: v === 1 ? 'var(--color-error-500)' : v <= 3 ? 'var(--color-warning-400)' : '#60a5fa',
        }}>
          {v}
        </span>
      ),
    },
    { title: t('opsCenter.thChannel'), dataIndex: 'label', key: 'label', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('opsCenter.thTargetRole'), dataIndex: 'targetRole', key: 'targetRole', render: (v: string) => v || '—' },
    {
      title: t('opsCenter.thStatus'), dataIndex: 'enabled', key: 'enabled',
      render: (v: boolean) => (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: v ? '#4ade80' : '#94a3b8' }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: v ? '#4ade80' : '#94a3b8' }} />
          {v ? t('opsCenter.ecEnabled') : t('opsCenter.ecDisabled')}
        </span>
      ),
    },
  ]

  const doctorRankingColumns: TableColumnsType<any> = [
    {
      title: '#', key: 'rank', width: 40,
      render: (_v: unknown, _doc: any, idx: number) => (
        <span style={{
          ...s.rankBadge,
          background: idx === 0 ? 'var(--color-warning-400)' : idx === 1 ? '#94a3b8' : idx === 2 ? '#cd7c32' : 'rgba(71, 85, 105, 0.5)',
          color: idx < 3 ? '#0f172a' : '#94a3b8'
        }}>
          {_doc.rank}
        </span>
      ),
    },
    { title: t('opsCenter.thDoctor'), dataIndex: 'name', key: 'name', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: t('opsCenter.thReports'), dataIndex: 'exams', key: 'exams' },
    { title: t('opsCenter.thCritical'), dataIndex: 'reports', key: 'reports' },
    { title: t('opsCenter.thQcScore'), dataIndex: 'rate', key: 'rate', render: (v: number) => <span style={{ color: v >= 90 ? '#4ade80' : v >= 80 ? 'var(--color-warning-400)' : 'var(--color-error-500)' }}>{v}%</span> },
  ]

  // 渲染: 设备维度看板
  const renderEquipmentView = () => (
    <div style={s.panel}>
      <div style={s.panelTitle}>
        <Monitor size={18} color="var(--color-primary-500)" />
        {t('opsCenter.equipmentBoardTitle')}
        <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {t('opsCenter.equipmentBoardSub')}
        </span>
      </div>
      {deviceBoard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          {t('opsCenter.equipmentNoData')}
        </div>
      ) : (
        <DataTable<any>
          columns={deviceBoardColumns}
          dataSource={deviceBoard}
          rowKey="id"
        />
      )}
      {/* [v3.0.6.11-99 Wave10B] 开机率/利用率 7 日趋势 (oeeApi dailyTrend 回退演示) */}
      <div style={{ marginTop: 'var(--space-4, 16px)' }}>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Zap size={14} color="var(--color-warning-400)" /> {t('opsCenter.uptimeTrend')}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, height: 130 }}>
          {[
            { day: 'D-6', uptime: 95.2, util: 88.1 },
            { day: 'D-5', uptime: 96.1, util: 90.3 },
            { day: 'D-4', uptime: 94.8, util: 87.6 },
            { day: 'D-3', uptime: 96.7, util: 91.2 },
            { day: 'D-2', uptime: 95.9, util: 89.4 },
            { day: 'D-1', uptime: 96.3, util: 90.8 },
            { day: t('opsCenter.todayLabel'), uptime: kpiExt[0]!.value, util: kpiExt[2]!.value || 91.2 },
          ].map(d => (
            <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 100 }}>
                <div style={{
                  width: 12, borderRadius: '3px 3px 0 0', height: `${d.uptime}px`,
                  background: 'linear-gradient(180deg, #4ade80, var(--color-success-600))', opacity: 0.9,
                }} title={t('opsCenter.uptimeTooltip', { n: d.uptime })} />
                <div style={{
                  width: 12, borderRadius: '3px 3px 0 0', height: `${d.util}px`,
                  background: 'linear-gradient(180deg, #60a5fa, var(--color-primary-600))', opacity: 0.85,
                }} title={t('opsCenter.utilTooltip', { n: d.util })} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{d.day}</span>
              <span style={{ fontSize: 10, color: '#4ade80' }}>{d.uptime}%</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)', fontSize: 11, color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#4ade80' }} /> {t('opsCenter.legendUptime')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: 2, background: '#60a5fa' }} /> {t('opsCenter.legendUtilization')}
          </span>
        </div>
      </div>
    </div>
  )

  // 渲染: 人力维度看板
  const renderManpowerView = () => (
    <div style={s.panel}>
      <div style={s.panelTitle}>
        <Users size={18} color="#8b5cf6" />
        {t('opsCenter.manpowerBoardTitle')}
        <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
          {t('opsCenter.manpowerBoardSub')}
        </span>
      </div>
      {manpowerBoard.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          {t('opsCenter.manpowerNoData')}
        </div>
      ) : (
        <DataTable<any>
          columns={manpowerColumns}
          dataSource={manpowerBoard}
          rowKey="id"
        />
      )}
    </div>
  )

  // 渲染: 质量维度看板
  const renderQualityView = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5, 20px)' }}>
      <div style={s.panel}>
        <div style={s.panelTitle}>
          <ShieldCheck size={18} color="#4ade80" />
          {t('opsCenter.qualityMetrics')}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3, 12px)' }}>
          {qualityBoard.map(q => (
            <div key={q.id} style={{
              padding: 18, borderRadius: 10, textAlign: 'center',
              background: q.ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${q.ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
            }}>
              <div style={{ fontSize: 30, fontWeight: 800, color: q.ok ? '#4ade80' : 'var(--color-error-500)' }}>
                {q.value}
                <span style={{ fontSize: 14, fontWeight: 400, marginLeft: 2 }}>{q.unit}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>{q.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 'var(--space-4, 16px)', display: 'flex', gap: 'var(--space-3, 12px)', flexWrap: 'wrap' }}>
          {qualityBoard.map(q => (
            <span key={q.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12,
              color: q.ok ? '#4ade80' : 'var(--color-error-500)', padding: '4px 10px', borderRadius: 999,
              background: q.ok ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            }}>
              <CheckCircle size={12} /> {q.label} {q.ok ? t('opsCenter.qOk') : t('opsCenter.qAttention')}
            </span>
          ))}
        </div>
      </div>
      <div style={s.panel}>
        <div style={s.panelTitle}>
          <Gauge size={18} color="var(--color-warning-400)" />
          {t('opsCenter.qualityDetailSub')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[
            { label: t('opsCenter.kpiCriticalClosure'), value: kpiExt[3]!.value, color: '#4ade80' },
            { label: t('opsCenter.kpiReportTimely'), value: kpiExt[2]!.value, color: 'var(--color-primary-500)' },
            { label: t('opsCenter.kpiUptime'), value: kpiExt[0]!.value, color: '#8b5cf6' },
            { label: t('opsCenter.qTechEfficiency'), value: kpiExt[1]!.value > 0 && kpiExt[1]!.value <= 25 ? 100 : 80, color: 'var(--color-warning-400)' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                <span>{item.label}</span>
                <span style={{ color: item.color, fontWeight: 700 }}>{item.value}%</span>
              </div>
              <div style={{ height: 8, background: 'rgba(51,65,85,0.8)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${Math.min(100, item.value)}%`, height: '100%', background: item.color, borderRadius: 4, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // 渲染: 急诊通道看板
  const renderEmergencyView = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 20px)' }}>
      {/* [v3.0.6.11-99 Wave10B] 急诊通道统计条 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 'var(--space-3, 12px)' }}>
        {[
          { label: t('opsCenter.ecTotal'), value: emergencySummary.total, color: 'var(--color-primary-500)', unit: t('opsCenter.ecUnit') },
          { label: t('opsCenter.ecToday'), value: emergencySummary.todayCount, color: 'var(--color-warning-400)', unit: t('opsCenter.ecUnit') },
          { label: t('opsCenter.ecAcknowledged'), value: emergencySummary.acknowledged, color: '#60a5fa', unit: t('opsCenter.ecUnit') },
          { label: t('opsCenter.ecCompleted'), value: emergencySummary.completed, color: '#4ade80', unit: t('opsCenter.ecUnit') },
          { label: t('opsCenter.ecAvgResponse'), value: emergencySummary.avgMinutes, color: '#a78bfa', unit: t('opsCenter.ecAvgUnit', { n: emergencySummary.slaMin }) },
        ].map(s => (
          <div key={s.label} style={{
            padding: 'var(--space-4, 16px)', textAlign: 'center', borderRadius: 10,
            background: 'rgba(51,65,85,0.5)', border: '1px solid rgba(71,85,105,0.5)',
          }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>
              {s.label}{s.unit ? ` (${s.unit})` : ''}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 'var(--space-5, 20px)' }}>
      <div style={s.panel}>
        <div style={s.panelTitle}>
          <Siren size={18} color="var(--color-error-500)" />
          {t('opsCenter.ecConfigTitle')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
          <div style={{
            padding: 14, borderRadius: 8,
            background: emergencyConfig.autoTrigger ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.1)',
            border: `1px solid ${emergencyConfig.autoTrigger ? 'rgba(34,197,94,0.3)' : 'rgba(148,163,184,0.3)'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>
              <HeartPulse size={16} color={emergencyConfig.autoTrigger ? '#4ade80' : '#94a3b8'} />
              {t('opsCenter.ecAutoTrigger')}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: emergencyConfig.autoTrigger ? '#4ade80' : '#94a3b8' }}>
                {emergencyConfig.autoTrigger ? t('opsCenter.ecOn') : t('opsCenter.ecOff')}
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-2, 8px)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {t('opsCenter.ecKeywords')}
              {emergencyConfig.keywords.length === 0 && <span>—</span>}
              {emergencyConfig.keywords.map(k => (
                <span key={k} style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(239,68,68,0.15)', color: 'var(--color-error-500)', fontSize: 11 }}>
                  {k}
                </span>
              ))}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 'var(--space-2, 8px)' }}>
              <span dangerouslySetInnerHTML={{ __html: t('opsCenter.ecChannelsEnabled', { n: emergencyConfig.channels }) }} />
            </div>
          </div>
          <div style={{
            padding: 14, borderRadius: 8, background: 'rgba(51,65,85,0.5)',
            border: '1px solid rgba(71,85,105,0.5)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6,
          }}>
            <span dangerouslySetInnerHTML={{ __html: t('opsCenter.ecConfigDesc') }} />
          </div>
        </div>
      </div>
      <div style={s.panel}>
        <div style={s.panelTitle}>
          <Stethoscope size={18} color="var(--color-primary-500)" />
          {t('opsCenter.ecRecordsTitle')}
          <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>
            emergencyChannelApi.listRecords
          </span>
        </div>
        {emergencyRecords.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
            <CheckCircle size={28} color="#4ade80" style={{ margin: '0 auto 10px', display: 'block' }} />
            {t('opsCenter.ecNoRecords')}
            <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 'var(--space-1, 4px)' }}>{t('opsCenter.ecNoRecordsSub')}</div>
          </div>
        ) : (
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {emergencyRecords.map(r => (
              <div key={r.id} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--space-3, 12px)', padding: '12px 0',
                borderBottom: '1px solid rgba(71,85,105,0.3)',
              }}>
                <div style={{
                  width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: r.status === 'completed' ? 'rgba(34,197,94,0.15)' : r.status === 'acknowledged' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                  color: r.status === 'completed' ? '#4ade80' : r.status === 'acknowledged' ? '#60a5fa' : 'var(--color-error-500)',
                }}>
                  {r.status === 'completed' ? <CheckCircle size={18} /> : r.status === 'acknowledged' ? <Bell size={18} /> : <AlertTriangle size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#f1f5f9' }}>
                    {r.patientName || r.patientId}
                    <span style={{ marginLeft: 'var(--space-2, 8px)', fontSize: 11, color: 'var(--color-error-500)', background: 'rgba(239,68,68,0.15)', padding: '1px 8px', borderRadius: 999 }}>{r.type}</span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.reason} · {r.channels.join(' / ')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2 }}>
                    {String(r.triggeredAt ?? '').slice(5, 16).replace('T', ' ')} · {t('opsCenter.ecTriggeredBy', { name: r.triggeredBy })}
                  </div>
                </div>
                <span style={{
                  padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, flexShrink: 0,
                  background: r.status === 'completed' ? 'rgba(34,197,94,0.15)' : r.status === 'acknowledged' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                  color: r.status === 'completed' ? '#4ade80' : r.status === 'acknowledged' ? '#60a5fa' : 'var(--color-error-500)',
                }}>
                {r.status === 'completed' ? t('opsCenter.ecStatusCompleted') : r.status === 'acknowledged' ? t('opsCenter.ecStatusAcknowledged') : t('opsCenter.ecStatusSent')}
              </span>
            </div>
          ))}
        </div>
        )}
      </div>
      </div>

      {/* [v3.0.6.11-99 Wave10B] 通知渠道明细 + 触发类型分布 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5, 20px)' }}>
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Bell size={18} color="#60a5fa" />
            {t('opsCenter.ecChannelsTitle')}
          </div>
          <DataTable<any>
            columns={channelColumns}
            dataSource={channelDetail}
            rowKey="type"
          />
          <div style={{ marginTop: 'var(--space-3, 12px)', fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            {t('opsCenter.ecEscalationDesc')}
          </div>
        </div>
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <HeartPulse size={18} color="var(--color-error-500)" />
            {t('opsCenter.ecTypeDist')}
          </div>
          {emergencySummary.byType.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-secondary)', fontSize: 12 }}>
              {t('opsCenter.ecNoTypeData')}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3, 12px)' }}>
              {emergencySummary.byType.slice(0, 6).map(([type, count]) => {
                const maxType = Math.max(1, ...emergencySummary.byType.map(([, c]) => c))
                return (
                  <div key={type}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                      <span>{type}</span>
                      <span style={{ color: 'var(--color-error-500)', fontWeight: 700 }}>{count} {t('opsCenter.ecUnit')}</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(51,65,85,0.8)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{
                        width: `${(count / maxType) * 100}%`, height: '100%', borderRadius: 4,
                        background: 'linear-gradient(90deg, var(--color-error-500), #f97316)', transition: 'width 0.4s',
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
          <div style={{
            marginTop: 'var(--space-4, 16px)', padding: 'var(--space-3, 12px)', borderRadius: 8, fontSize: 12, lineHeight: 1.7,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#fecaca',
          }}>
            <span dangerouslySetInnerHTML={{ __html: t('opsCenter.ecClosureReq', { n: emergencySummary.slaMin || 10 }) }} />
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div style={s.root}>
      {/* 顶部标题栏 */}
      <div style={s.headerBar}>
        <div style={s.headerTitle}>
          <Scan size={32} color="var(--color-primary-500)" />
          <div>
            <Typography.Title level={4} style={{ margin: 0, letterSpacing: 2 }}>{t('opsCenter.headerTitle')}</Typography.Title>
            <p style={s.headerSub}>{t('opsCenter.headerSub')}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-6, 24px)' }}>
          {loading && (
            <span style={{ fontSize: 12, color: 'var(--color-warning-400)' }}>
              <RefreshCw size={14} style={{ marginRight: 6, verticalAlign: -2, animation: 'spin 1s linear infinite' }} />
              {t('opsCenter.syncing')}
            </span>
          )}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.currentTime')}</div>
            <div style={s.headerTime}>
              {currentTime.toLocaleTimeString('zh-CN', { hour12: false })}
            </div>
          </div>
          <RefreshCw size={20} color="var(--text-secondary)" style={{ cursor: 'pointer' }} onClick={() => void loadDashboard()} />
        </div>
      </div>

      {/* 数据源状态条 [W2-A] */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 'var(--space-4, 16px)', fontSize: 12, flexWrap: 'wrap' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 999,
          background: dataSource === 'api' ? 'rgba(34,197,94,0.15)' : 'rgba(245,158,11,0.15)',
          color: dataSource === 'api' ? '#4ade80' : 'var(--color-warning-400)', fontWeight: 600,
        }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dataSource === 'api' ? '#4ade80' : 'var(--color-warning-400)' }} />
          {dataSource === 'api' ? t('opsCenter.dataSourceApi') : t('opsCenter.dataSourceDemo')}
        </span>
        {apiError && (
          <span style={{ color: 'var(--color-error-500)' }}>
            {apiError}
            <button onClick={() => void loadDashboard()} style={{ marginLeft: 'var(--space-2, 8px)', padding: '2px 10px', borderRadius: 4, border: '1px solid var(--color-error-500)', background: 'transparent', color: 'var(--color-error-500)', cursor: 'pointer', fontSize: 12 }}>{t('opsCenter.retry')}</button>
          </span>
        )}
      </div>

      {/* KPI指标条 */}
      <div style={s.kpiBar}>
        {kpiData.map((item, idx) => (
          <KPICard key={idx} data={item} />
        ))}
      </div>

      {/* [v3.0.6.11-99 Wave10B] 12 KPI 扩展条: 开机率/技师效率/报告及时率/危急值闭环率/报告积压/设备故障 */}
      {renderKpiExt()}

      {/* [v3.0.6.11-99 Wave10B] 多 Tab 看板切换 */}
      {renderSectionTabs()}

      {/* [v3.0.6.11-99 Wave10B] 预警面板 (设备离线/超时排队/危急值超时) */}
      {renderAlertsPanel()}

      {/* [v3.0.6.11-99 Wave10B] Tab 内容: 总览为原有主体, 其余按维度 */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5, 20px)' }}>
      {/* 主内容区 */}
      <div style={s.mainGrid}>
        {/* 左侧：实时叫号与候诊态势 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Bell size={20} color="var(--color-primary-500)" />
            {t('opsCenter.callingTitle')}
          </div>
          
          <div style={s.callingCard}>
            <div style={s.callingLabel}>{t('opsCenter.callingNow')}</div>
            <div style={s.callingPatient}>张志明</div>
            <div style={s.callingRoom}>MRI2室 {t('opsCenter.roomOccupied')}</div>
          </div>

          <div style={s.roomGrid}>
            {rooms.map((room, idx) => (
              <RoomCard key={idx} room={room} />
            ))}
          </div>

          <div style={{ marginTop: 'var(--space-4, 16px)' }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-3, 12px)' }}>{t('opsCenter.queueChange')}</div>
            <QueueChart data={queueData} />
          </div>
        </div>

        {/* 中央：今日检查趋势 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <TrendingUp size={20} color="#4ade80" />
            {t('opsCenter.todayTrend')}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2, 8px)' }}>
            <span style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{hourlyCaption}</span>
            <span style={{ fontSize: 12, color: 'var(--color-warning-400)', display: 'flex', alignItems: 'center', gap: 'var(--space-1, 4px)' }}>
              <Zap size={14} /> {peakText}
            </span>
          </div>
          <TrendChart data={hourlyData} />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-6, 24px)' }}>
            <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#4ade80' }}>{todayTotal}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.todayTotal')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-500)' }}>{yesterdayTotal}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.yesterdayTotal')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: '#4ade80' }}>{growthText}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.momGrowth')}</div>
            </div>
            <div style={{ textAlign: 'center', padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
              <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-warning-400)' }}>{(peakText.split('(')[0] ?? '').replace(t('opsCenter.peakDayPrefix'), '').replace(t('opsCenter.peakHourPrefix'), '').trim()}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.peakPeriod')}</div>
            </div>
          </div>
        </div>

        {/* 右侧：科室工作量排行 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Gauge size={20} color="#8b5cf6" />
            {t('opsCenter.workloadRanking')}
          </div>
          
          <DataTable<any>
            columns={doctorRankingColumns}
            dataSource={doctorRanking}
            rowKey="rank"
          />

          <div style={{ marginTop: 'var(--space-6, 24px)' }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-3, 12px)' }}>{t('opsCenter.projectDistribution')}</div>
            <PieChartComponent data={projectData} />
          </div>
        </div>
      </div>

      {/* 底部区域 */}
      <div style={s.bottomGrid}>
        {/* 左下：质量与安全指标 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Shield size={20} color="var(--color-error-500)" />
            {t('opsCenter.qualitySafetyTitle')}
          </div>
          <div style={s.qualityGrid}>
            {qualityData.map((item, idx) => (
              <QualityCard key={idx} item={item} />
            ))}
          </div>
          
          <div style={{ marginTop: 'var(--space-5, 20px)', padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8 }}>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 'var(--space-3, 12px)' }}>{t('opsCenter.todayOverview')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4, 16px)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: '#4ade80' }}>{summaryOverview.adverse}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.adverseEvents')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-primary-500)' }}>{summaryOverview.normal}</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.normalExams')}</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 30, fontWeight: 700, color: 'var(--color-warning-400)' }}>{summaryOverview.safety}%</div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.safetyRate')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 右下：资源与效率 */}
        <div style={s.panel}>
          <div style={s.panelTitle}>
            <Activity size={20} color="#4ade80" />
            {t('opsCenter.resourcesEfficiency')}
          </div>
          
          <ProgressBar label={t('opsCenter.progressEquipmentUsage')} value={efficiencyData.equipmentUsage} color="var(--color-primary-500)" />
          <ProgressBar label={t('opsCenter.progressRoomOccupancy')} value={efficiencyData.roomOccupancy} color="#8b5cf6" />
          <ProgressBar label={t('opsCenter.progressReportTimely')} value={efficiencyData.reportTimelyRate} color="#4ade80" />
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--space-4, 16px)', marginTop: 'var(--space-2, 8px)' }}>
            <div style={{ padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8, textAlign: 'center' }}>
              <Clock size={20} color="var(--color-warning-400)" style={{ marginBottom: 'var(--space-2, 8px)' }} />
              <div style={{ fontSize: 30, fontWeight: 700, color: '#f1f5f9' }}>{efficiencyData.avgExamTime}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.avgExamTime')}</div>
            </div>
            <div style={{ padding: 'var(--space-4, 16px)', background: 'rgba(51, 65, 85, 0.5)', borderRadius: 8, textAlign: 'center' }}>
              <CheckCircle size={20} color="#4ade80" style={{ marginBottom: 'var(--space-2, 8px)' }} />
              <div style={{ fontSize: 30, fontWeight: 700, color: '#4ade80' }}>{efficiencyData.reportTimelyRate}%</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.progressReportTimely')}</div>
            </div>
          </div>

          <div style={{ marginTop: 'var(--space-5, 20px)' }}>
            <div style={{ fontSize: 14, color: 'var(--color-error-500)', marginBottom: 'var(--space-2, 8px)', display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertTriangle size={16} />
              {t('opsCenter.materialAlert')}
            </div>
            <div style={s.alertList}>
              {alertMaterials.map((item, idx) => (
                <div key={idx} style={s.alertItem}>
                  <div style={s.alertName}>
                    <Film size={14} color="var(--color-error-500)" />
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
        </div>
      )}

      {/* [v3.0.6.11-99 Wave10B] 设备维度看板 */}
      {activeSection === 'equipment' && renderEquipmentView()}

      {/* [v3.0.6.11-99 Wave10B] 人力维度看板 */}
      {activeSection === 'manpower' && renderManpowerView()}

      {/* [v3.0.6.11-99 Wave10B] 质量维度看板 */}
      {activeSection === 'quality' && renderQualityView()}

      {/* [v3.0.6.11-99 Wave10B] 急诊通道看板 */}
      {activeSection === 'emergency' && renderEmergencyView()}

      {/* 底部状态栏 */}
      <div style={{
        marginTop: 'var(--space-5, 20px)',
        padding: '12px 24px',
        background: 'rgba(30, 41, 59, 0.8)',
        borderRadius: 8,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid rgba(71, 85, 105, 0.5)',
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-8, 32px)' }}>
          <span style={{ fontSize: 12, color: '#4ade80', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ade80' }} />
            {t('opsCenter.systemNormal')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('opsCenter.dataUpdated', { time: new Date().toLocaleTimeString('zh-CN'), source: dataSource === 'api' ? t('opsCenter.dataSourceApiShort') : t('opsCenter.dataSourceDemoShort') })}</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {t('opsCenter.footer')}
        </div>
      </div>
    </div>
  )
}

// 添加缺失的Shield图标组件
function Shield({ size = 24, color = '#fff' }: { size?: number, color?: string }) {
  return <ShieldGlyph size={size} color={color} />
}
