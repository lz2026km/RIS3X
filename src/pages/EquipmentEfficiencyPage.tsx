// G005 放射科RIS系统 - 设备效率分析页面（对标英飞达/锐科）
// [W3-B] 接入 oeeApi / biApi / statsApi / deviceMgmtApi 真实数据 (loading/error + 演示数据回退)
import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Activity, Clock, TrendingUp, Timer, Zap, Download,
  Grid3x3, Calendar, AlertTriangle, RefreshCw
} from 'lucide-react'
import { oeeApi } from '../services/api/oeeApi'
import { biApi } from '../services/api/biApi'
import { statsApi } from '../services/api/statsApi'
import { deviceMgmtApi } from '../services/api/deviceMgmtApi'
// [v3.0.6.8-28] 主数据池 + 生成器
import { DEVICE_MASTER } from '../data/master'
import { DAILY_KPI_PRE } from '../data/_generators'
import { seededUnit } from '../utils/seededRandom'
import { t } from '../i18n/appI18n'

// ============================================================
// 样式常量
// ============================================================
const C = {
  primary: '#1e40af',
  primaryDark: '#1e3a8a',
  primaryLight: '#3b82f6',
  accent: '#1e40af',
  white: '#ffffff',
  bg: '#0f172a',
  bgLight: '#1e293b',
  bgCard: '#1e293b',
  border: '#334155',
  borderLight: '#475569',
  textDark: '#f8fafc',
  textMid: '#cbd5e1',
  textLight: '#94a3b8',
  success: '#22c55e',
  successLight: '#86efac',
  warning: '#eab308',
  warningLight: '#fde047',
  danger: '#ef4444',
  dangerLight: '#fca5a5',
  info: '#06b6d4',
  infoLight: '#67e8f9',
  gray: '#6b7280',
  grayLight: '#9ca3af',
  // 热力图配色
  heatmapHigh: '#15803d',    // ≥90% 深绿色
  heatmapMid: '#4ade80',     // 70-89% 浅绿色
  heatmapLow: '#facc15',     // 50-69% 黄色
  heatmapVeryLow: '#ef4444', // <50% 红色
}

const STATUS_COLORS: Record<string, string> = {
  '运行中': C.success,
  '待机': C.warning,
  '维护': C.gray,
  '故障': C.danger,
}

// ============================================================
// 类型定义
// ============================================================
interface Device {
  id: string
  name: string
  model: string
  type: string
  utilization: number
  status: string
}

interface HeatmapCell {
  deviceId: string
  deviceName: string
  date: string
  utilization: number
  examCount: number
}

interface BookingRateData {
  deviceId: string
  deviceName: string
  fullRate: number
  fullDays: number
  totalDays: number
}

interface FailureRecord {
  id: string
  deviceId: string
  deviceName: string
  date: string
  type: '硬件故障' | '软件故障' | '定期保养' | '紧急维修'
  cost: number
  duration: number
}

interface FailureStats {
  normal: number
  minor: number
  major: number
  scrapped: number
}

// ============================================================
// 模拟数据
// ============================================================

// 设备列表 - 来源: DEVICE_MASTER (35 台三甲设备)
// [v3.0.6.8-28] 取前 8 台映射到本地 Device 结构
const STATIC_DEVICES: Device[] = DEVICE_MASTER.slice(0, 8).map((d) => ({
  id: d.id,
  name: d.id.split('-').slice(-1)[0] || d.model,
  model: `${d.brand} ${d.model}`,
  type: d.modality === 'US' ? 'US' : d.modality,
  utilization: Math.round((100 - (d.monthlyDowntime / 720) * 100) * 10) / 10,
  status: d.status === '运行中' ? '运行中' : d.status === '维护中' ? '维护' : '待机',
}))

// 效率指标
const STATIC_EFFICIENCY_METRICS = {
  avgExamTime: 18.5,
  dailyMax: 326,
  bedTurnover: 4.2,
  standbyHours: 2.3,
}

// 7天使用率趋势数据 - 来源: DAILY_KPI_PRE.topDevices
// [v3.0.6.8-28] 固定设备键 (CT1/CT2/MRI1/DSA/DR) 与 TrendLineChart 组件约定一致
const STATIC_UTILIZATION_TREND = (() => {
  // 按模态聚合 DAILY_KPI_PRE 的 byModality, 映射到固定设备键
  return DAILY_KPI_PRE.slice(-7).map((d, idx) => {
    const total = d.examCount || 1;
    const pct = (m: number | undefined) => {
      if (!m) return 70 + idx % 5;
      const v = (m / total) * 100;
      return Math.max(50, Math.min(100, Math.round(v)));
    };
    return {
      date: d.date.slice(5), // MM-DD
      CT1: pct(d.byModality.CT * 0.6),
      CT2: pct(d.byModality.CT * 0.4),
      MRI1: pct(d.byModality.MR * 0.7),
      DSA: pct(d.byModality.DSA * 5),
      DR: pct(d.byModality.DR),
    };
  });
})()

// 时段分析数据
const TIME_SEGMENT_DATA = [
  { period: '白班 08-18', CT: 156, MRI: 124, DSA: 45, DR: 189, total: 514 },
  { period: '夜班 18-08', CT: 68, MRI: 42, DSA: 18, DR: 72, total: 200 },
  { period: '周末', CT: 45, MRI: 38, DSA: 12, DR: 52, total: 147 },
]

// 设备负荷排行榜 - 来源: DEVICE_MASTER 按 monthlyScans 降序
const STATIC_LOAD_RANKING = (() => {
  return [...DEVICE_MASTER]
    .sort((a, b) => b.monthlyScans - a.monthlyScans)
    .slice(0, 5)
    .map((d, idx) => ({
      rank: idx + 1,
      deviceId: d.id,
      deviceName: `${d.modality}-${d.id.split('-').pop()}`,
      totalExams: d.monthlyScans,
      avgUtilization: Math.round((100 - (d.monthlyDowntime / 720) * 100) * 10) / 10,
      avgWaitTime: Math.round(d.avgScanDurationMin * 0.5),
      score: Math.round((100 - d.defectRate * 30) * 10) / 10,
    }));
})()

// ============================================================
// 生成30天热力图数据
// ============================================================
const generateHeatmapData = (): HeatmapCell[] => {
  const data: HeatmapCell[] = []
  const today = new Date('2026-05-03')

  for (let d = 29; d >= 0; d--) {
    const date = new Date(today)
    date.setDate(date.getDate() - d)
    const dateStr = `${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    STATIC_DEVICES.forEach((device) => {
      let baseUtil = device.utilization
      let variance = 15
      if (device.status === '维护') variance = 30
      if (device.status === '待机') variance = 20

      const randomOffset = (seededUnit(`heat-${device.id}-${dateStr}`) - 0.5) * 2 * variance
      const utilization = Math.max(10, Math.min(100, baseUtil + randomOffset))
      const examCount = Math.round((utilization / 100) * 24) // 假设每天最多24个检查

      data.push({
        deviceId: device.id,
        deviceName: device.name,
        date: dateStr,
        utilization: Math.round(utilization * 10) / 10,
        examCount,
      })
    })
  }

  return data
}

const HEATMAP_DATA = generateHeatmapData()

// ============================================================
// 预约满员率数据 (30天统计)
// ============================================================
const BOOKING_FULL_RATE: BookingRateData[] = [
  { deviceId: 'SY-CT-001', deviceName: 'CT-1', fullRate: 85.2, fullDays: 26, totalDays: 30 },
  { deviceId: 'SY-MR-001', deviceName: 'MRI-1', fullRate: 92.5, fullDays: 28, totalDays: 30 },
  { deviceId: 'SY-US-001', deviceName: '超声', fullRate: 78.3, fullDays: 24, totalDays: 30 },
  { deviceId: 'SY-DR-001', deviceName: 'DR-1', fullRate: 71.6, fullDays: 22, totalDays: 30 },
  { deviceId: 'SY-CT-002', deviceName: 'CT-2', fullRate: 65.0, fullDays: 20, totalDays: 30 },
  { deviceId: 'SY-MR-002', deviceName: 'MRI-2', fullRate: 58.3, fullDays: 18, totalDays: 30 },
  { deviceId: 'SY-DSA-001', deviceName: 'DSA', fullRate: 52.0, fullDays: 16, totalDays: 30 },
  { deviceId: 'SY-DR-002', deviceName: 'DR-2', fullRate: 45.0, fullDays: 14, totalDays: 30 },
]

// ============================================================
// 设备故障统计数据
// ============================================================
const FAILURE_STATS: FailureStats = {
  normal: 5,   // 正常
  minor: 2,    // 小故障
  major: 1,    // 大修
  scrapped: 0, // 报废
}

// ============================================================
// 设备故障记录列表
// ============================================================
const STATIC_FAILURE_RECORDS: FailureRecord[] = [
  { id: 'FR-001', deviceId: 'SY-CT-002', deviceName: 'CT-2', date: '2026-04-28', type: '硬件故障', cost: 45000, duration: 72 },
  { id: 'FR-002', deviceId: 'SY-DSA-001', deviceName: 'DSA', date: '2026-04-25', type: '紧急维修', cost: 82000, duration: 96 },
  { id: 'FR-003', deviceId: 'SY-MR-002', deviceName: 'MRI-2', date: '2026-04-20', type: '软件故障', cost: 12000, duration: 8 },
  { id: 'FR-004', deviceId: 'SY-DR-002', deviceName: 'DR-2', date: '2026-04-15', type: '定期保养', cost: 8000, duration: 24 },
  { id: 'FR-005', deviceId: 'SY-CT-001', deviceName: 'CT-1', date: '2026-04-10', type: '硬件故障', cost: 35000, duration: 48 },
  { id: 'FR-006', deviceId: 'SY-DSA-001', deviceName: 'DSA', date: '2026-04-05', type: '定期保养', cost: 15000, duration: 36 },
]

// ============================================================
// 获取热力图颜色
// ============================================================
const getHeatmapColor = (utilization: number): string => {
  if (utilization >= 90) return C.heatmapHigh
  if (utilization >= 70) return C.heatmapMid
  if (utilization >= 50) return C.heatmapLow
  return C.heatmapVeryLow
}

// ============================================================
// SVG折线图组件
// ============================================================
interface TrendRow { date: string; CT1: number; CT2: number; MRI1: number; DSA: number; DR: number }
const TrendLineChart: React.FC<{ data: TrendRow[] }> = ({ data }) => {
  const width = 600
  const height = 200
  const padding = { top: 20, right: 30, bottom: 30, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxVal = 100
  const minVal = 50

  const scaleX = (i: number) => padding.left + (i / (data.length - 1)) * chartWidth
  const scaleY = (v: number) => padding.top + chartHeight - ((v - minVal) / (maxVal - minVal)) * chartHeight

  const devices = ['CT1', 'CT2', 'MRI1', 'DSA', 'DR']
  const colors = [C.primary, C.warning, C.success, C.info, '#a855f7']

  const createPath = (deviceKey: keyof typeof data[0]) => {
    return data.map((d, i) => {
      const val = d[deviceKey] as number
      const x = scaleX(i)
      const y = scaleY(val)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    }).join(' ')
  }

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {/* 网格线 */}
      {[50, 60, 70, 80, 90, 100].map(v => (
        <g key={v}>
          <line
            x1={padding.left} y1={scaleY(v)}
            x2={width - padding.right} y2={scaleY(v)}
            stroke={C.border} strokeWidth={1} strokeDasharray="4,4"
          />
          <text x={padding.left - 8} y={scaleY(v) + 4} fill={C.textLight} fontSize={10} textAnchor="end">
            {v}%
          </text>
        </g>
      ))}

      {/* X轴标签 */}
      {data.map((d, i) => (
        <text
          key={d.date}
          x={scaleX(i)} y={height - 5}
          fill={C.textLight} fontSize={10} textAnchor="middle"
        >
          {d.date}
        </text>
      ))}

      {/* 数据线 */}
      {devices.map((device, idx) => (
        <path
          key={device}
          d={createPath(device as keyof typeof data[0])}
          fill="none"
          stroke={colors[idx]}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}

      {/* 数据点 */}
      {devices.map((device, deviceIdx) => (
        data.map((d, i) => {
          const val = d[device as keyof typeof d] as number
          return (
            <circle
              key={`${device}-${i}`}
              cx={scaleX(i)}
              cy={scaleY(val)}
              r={4}
              fill={colors[deviceIdx]}
              stroke={C.bg} strokeWidth={2}
            />
          )
        })
      ))}

      {/* 图例 */}
      <g transform={`translate(${padding.left}, ${height + 15})`}>
        {devices.map((device, idx) => (
          <g key={device} transform={`translate(${idx * 90}, 0)`}>
            <line x1={0} y1={0} x2={20} y2={0} stroke={colors[idx]} strokeWidth={2} />
            <text x={25} y={4} fill={C.textLight} fontSize={10}>
              {device === 'CT1' ? 'CT-1' : device === 'CT2' ? 'CT-2' : device === 'MRI1' ? 'MRI-1' : device}
            </text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// ============================================================
// 时段分析柱状图
// ============================================================
const TimeSegmentChart: React.FC<{ data: typeof TIME_SEGMENT_DATA }> = ({ data }) => {
  const width = 500
  const height = 180
  const padding = { top: 15, right: 20, bottom: 30, left: 40 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const maxVal = 600
  const barGroupWidth = chartWidth / data.length
  const barWidth = 40
  const barGap = 8

  const devices = ['CT', 'MRI', 'DSA', 'DR']
  const colors = [C.primary, C.success, C.warning, C.info]

  return (
    <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
      {/* 网格线 */}
      {[0, 150, 300, 450, 600].map(v => (
        <g key={v}>
          <line
            x1={padding.left} y1={padding.top + chartHeight - (v / maxVal) * chartHeight}
            x2={width - padding.right} y2={padding.top + chartHeight - (v / maxVal) * chartHeight}
            stroke={C.border} strokeWidth={1} strokeDasharray="4,4"
          />
          <text
            x={padding.left - 8}
            y={padding.top + chartHeight - (v / maxVal) * chartHeight + 4}
            fill={C.textLight} fontSize={10} textAnchor="end"
          >
            {v}
          </text>
        </g>
      ))}

      {/* 柱状图 */}
      {data.map((d, i) => {
        const groupX = padding.left + i * barGroupWidth + barGroupWidth / 2 - (barWidth * 2 + barGap * 1.5)
        return (
          <g key={d.period}>
            {devices.map((device, j) => {
              const val = d[device as keyof typeof d] as number
              const barHeight = (val / maxVal) * chartHeight
              return (
                <rect
                  key={device}
                  x={groupX + j * (barWidth + barGap)}
                  y={padding.top + chartHeight - barHeight}
                  width={barWidth}
                  height={barHeight}
                  fill={colors[j]}
                  rx={3}
                />
              )
            })}
            <text
              x={padding.left + i * barGroupWidth + barGroupWidth / 2}
              y={height - 8}
              fill={C.textLight} fontSize={9} textAnchor="middle"
            >
              {d.period}
            </text>
          </g>
        )
      })}

      {/* 图例 */}
      <g transform={`translate(${padding.left}, ${height + 12})`}>
        {devices.map((device, idx) => (
          <g key={device} transform={`translate(${idx * 60}, 0)`}>
            <rect x={0} y={-8} width={12} height={12} fill={colors[idx]} rx={2} />
            <text x={16} y={2} fill={C.textLight} fontSize={10}>{device}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

// ============================================================
// 设备使用率热力图组件
// ============================================================
const HeatmapChart: React.FC = () => {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; data: HeatmapCell } | null>(null)

  // 获取所有日期（最近30天）
  const dates = Array.from(new Set(HEATMAP_DATA.map(d => d.date))).sort()

  // 设备列表
  const devices = STATIC_DEVICES

  const cellSize = 32
  const cellGap = 2
  const labelWidth = 60
  const dateLabelHeight = 30

  const gridWidth = dates.length * (cellSize + cellGap)
  const gridHeight = devices.length * (cellSize + cellGap)

  return (
    <div style={{ position: 'relative' }}>
      <svg
        width="100%"
        height={gridHeight + dateLabelHeight + 40}
        viewBox={`0 0 ${labelWidth + gridWidth + 20} ${dateLabelHeight + gridHeight + 40}`}
        style={{ overflow: 'visible' }}
      >
        {/* 日期标签 (横向) */}
        {dates.map((date, i) => (
          <text
            key={date}
            x={labelWidth + i * (cellSize + cellGap) + cellSize / 2}
            y={dateLabelHeight - 8}
            fill={C.textLight}
            fontSize={9}
            textAnchor="middle"
            transform={`rotate(-45, ${labelWidth + i * (cellSize + cellGap) + cellSize / 2}, ${dateLabelHeight - 8})`}
          >
            {date}
          </text>
        ))}

        {/* 设备行标签 */}
        {devices.map((device, i) => (
          <text
            key={device.id}
            x={labelWidth - 8}
            y={dateLabelHeight + i * (cellSize + cellGap) + cellSize / 2 + 4}
            fill={C.textMid}
            fontSize={11}
            textAnchor="end"
          >
            {device.name}
          </text>
        ))}

        {/* 热力图格子 */}
        {devices.map((device, deviceIdx) =>
          dates.map((date, dateIdx) => {
            const cell = HEATMAP_DATA.find(h => h.deviceId === device.id && h.date === date)
            if (!cell) return null

            const x = labelWidth + dateIdx * (cellSize + cellGap)
            const y = dateLabelHeight + deviceIdx * (cellSize + cellGap)
            const color = getHeatmapColor(cell.utilization)

            return (
              <rect
                key={`${device.id}-${date}`}
                x={x}
                y={y}
                width={cellSize}
                height={cellSize}
                fill={color}
                rx={3}
                style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect()
                  setTooltip({
                    x: rect.left + rect.width / 2,
                    y: rect.top,
                    data: cell,
                  })
                }}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })
        )}

        {/* 色标 */}
        <g transform={`translate(${labelWidth}, ${dateLabelHeight + gridHeight + 15})`}>
          {[
            { label: '≥90%', color: C.heatmapHigh },
            { label: '70-89%', color: C.heatmapMid },
            { label: '50-69%', color: C.heatmapLow },
            { label: '<50%', color: C.heatmapVeryLow },
          ].map((item, i) => (
            <g key={item.label} transform={`translate(${i * 80}, 0)`}>
              <rect x={0} y={0} width={16} height={16} fill={item.color} rx={2} />
              <text x={22} y={13} fill={C.textLight} fontSize={10}>{item.label}</text>
            </g>
          ))}
        </g>
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x,
            top: tooltip.y - 10,
            transform: 'translate(-50%, -100%)',
            backgroundColor: C.bgCard,
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: '10px 14px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
            zIndex: 1000,
            pointerEvents: 'none',
          }}
        >
          <p style={{ margin: 0, color: C.textDark, fontWeight: 600, fontSize: 13 }}>{tooltip.data.deviceName}</p>
          <p style={{ margin: '4px 0 0', color: C.textLight, fontSize: 12 }}>{tooltip.data.date}</p>
          <p style={{ margin: '6px 0 0', color: C.primary, fontSize: 14, fontWeight: 600 }}>
            {t('equipEfficiency.usage')}: {tooltip.data.utilization}%
          </p>
          <p style={{ margin: '4px 0 0', color: C.textMid, fontSize: 12 }}>
            {t('equipEfficiency.examCount')}: {tooltip.data.examCount} {t('equipEfficiency.cases')}
          </p>
        </div>
      )}
    </div>
  )
}

// ============================================================
// 预约满员率排名柱状图组件
// ============================================================
const BookingRateChart: React.FC = () => {
  const sortedData = [...BOOKING_FULL_RATE].sort((a, b) => b.fullRate - a.fullRate)
  const maxRate = 100

  const width = 600
  const height = 280
  const padding = { top: 30, right: 30, bottom: 60, left: 50 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  const barWidth = chartWidth / sortedData.length - 20

  return (
    <div>
      <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} style={{ overflow: 'visible' }}>
        {/* 网格线 */}
        {[0, 25, 50, 75, 100].map(v => (
          <g key={v}>
            <line
              x1={padding.left}
              y1={padding.top + chartHeight - (v / maxRate) * chartHeight}
              x2={width - padding.right}
              y2={padding.top + chartHeight - (v / maxRate) * chartHeight}
              stroke={C.border}
              strokeWidth={1}
              strokeDasharray="4,4"
            />
            <text
              x={padding.left - 8}
              y={padding.top + chartHeight - (v / maxRate) * chartHeight + 4}
              fill={C.textLight}
              fontSize={10}
              textAnchor="end"
            >
              {v}%
            </text>
          </g>
        ))}

        {/* 70%标线 (警示线) */}
        <line
          x1={padding.left}
          y1={padding.top + chartHeight - (70 / maxRate) * chartHeight}
          x2={width - padding.right}
          y2={padding.top + chartHeight - (70 / maxRate) * chartHeight}
          stroke={C.danger}
          strokeWidth={1}
          strokeDasharray="6,4"
        />
        <text
          x={width - padding.right + 4}
          y={padding.top + chartHeight - (70 / maxRate) * chartHeight + 4}
          fill={C.danger}
          fontSize={9}
        >
          {t('equipEfficiency.warningLine')}
        </text>

        {/* 柱状图 */}
        {sortedData.map((item, i) => {
          const barHeight = (item.fullRate / maxRate) * chartHeight
          const x = padding.left + i * (chartWidth / sortedData.length) + 10
          const isLow = item.fullRate < 70

          return (
            <g key={item.deviceId}>
              <rect
                x={x}
                y={padding.top + chartHeight - barHeight}
                width={barWidth}
                height={barHeight}
                fill={isLow ? C.danger : C.primary}
                rx={4}
              />
              {/* 数值标签 */}
              <text
                x={x + barWidth / 2}
                y={padding.top + chartHeight - barHeight - 8}
                fill={isLow ? C.danger : C.primary}
                fontSize={11}
                fontWeight={600}
                textAnchor="middle"
              >
                {item.fullRate}%
              </text>
              {/* 设备名 */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 20}
                fill={C.textMid}
                fontSize={10}
                textAnchor="middle"
              >
                {item.deviceName}
              </text>
              {/* 满员天数 */}
              <text
                x={x + barWidth / 2}
                y={height - padding.bottom + 34}
                fill={C.textLight}
                fontSize={9}
                textAnchor="middle"
              >
                {item.fullDays}/{item.totalDays}{t('equipEfficiency.days')}
              </text>
            </g>
          )
        })}
      </svg>

      {/* 每日满员次数统计 */}
      <div
        style={{
          marginTop: 20,
          paddingTop: 16,
          borderTop: `1px solid ${C.border}`,
        }}
      >
        <h4 style={{ margin: '0 0 12px', color: C.textDark, fontSize: 16, fontWeight: 600 }}>
          {t('equipEfficiency.dailyFullStats')}
        </h4>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          {sortedData.map(item => (
            <div key={item.deviceId} style={{ textAlign: 'center' }}>
              <p style={{ margin: 0, color: C.textLight, fontSize: 12 }}>{item.deviceName}</p>
              <p style={{ margin: '4px 0 0', color: C.primary, fontSize: 28, fontWeight: 700 }}>
                {item.fullDays}
              </p>
              <p style={{ margin: 0, color: C.textLight, fontSize: 12 }}>{t('equipEfficiency.timesFull')}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 设备故障率统计组件 (饼图文字版) — [W3-B] 故障记录由 deviceMgmtApi.faults 实时提供
// ============================================================
const FailureStatsChart: React.FC<{ records: FailureRecord[] }> = ({ records }) => {
  const total = FAILURE_STATS.normal + FAILURE_STATS.minor + FAILURE_STATS.major + FAILURE_STATS.scrapped

  const segments = [
    { label: t('equipEfficiency.normal'), value: FAILURE_STATS.normal, color: C.success },
    { label: t('equipEfficiency.minorFault'), value: FAILURE_STATS.minor, color: C.warning },
    { label: t('equipEfficiency.majorRepair'), value: FAILURE_STATS.major, color: C.danger },
    { label: t('equipEfficiency.scrapped'), value: FAILURE_STATS.scrapped, color: C.gray },
  ]

  return (
    <div>
      {/* 饼图文字版 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 32,
          marginBottom: 24,
          padding: 20,
          backgroundColor: C.bgLight,
          borderRadius: 12,
        }}
      >
        {/* 环形图 */}
        <svg width={160} height={160} viewBox="0 0 160 160">
          {segments.reduce((acc, segment, _i) => {
            const percentage = segment.value / total
            const dashArray = percentage * 2 * Math.PI * 60
            const dashOffset = acc.offset

            acc.elements.push(
              <circle
                key={segment.label}
                cx={80}
                cy={80}
                r={60}
                fill="none"
                stroke={segment.color}
                strokeWidth={16}
                strokeDasharray={`${dashArray} ${2 * Math.PI * 60 - dashArray}`}
                strokeDashoffset={-dashOffset}
                transform="rotate(-90 80 80)"
              />
            )

            acc.offset += dashArray
            return acc
          }, { elements: [] as React.ReactNode[], offset: 0 }).elements}
          <text x={80} y={76} fill={C.textDark} fontSize={20} fontWeight={700} textAnchor="middle">
            {total}
          </text>
          <text x={80} y={94} fill={C.textLight} fontSize={11} textAnchor="middle">
            {t('equipEfficiency.units')}
          </text>
        </svg>

        {/* 图例 */}
        <div style={{ flex: 1 }}>
          {segments.map(segment => (
            <div
              key={segment.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 0',
                borderBottom: `1px solid ${C.border}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: 3,
                    backgroundColor: segment.color,
                  }}
                />
                <span style={{ color: C.textMid, fontSize: 13 }}>{segment.label}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ color: C.textDark, fontSize: 15, fontWeight: 600 }}>
                  {segment.value} {t('equipEfficiency.units')}
                </span>
                <span style={{ color: C.textLight, fontSize: 12, minWidth: 40, textAlign: 'right' }}>
                  ({Math.round((segment.value / total) * 100)}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 故障记录列表 */}
      <div>
        <h4 style={{ margin: '0 0 16px', color: C.textDark, fontSize: 16, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} color={C.warning} />
          {t('equipEfficiency.failureRecords')}
        </h4>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.device')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.date')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.faultType')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.repairCost')}</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.repairDuration')}</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record, idx) => (
                <tr
                  key={record.id}
                  style={{
                    borderBottom: `1px solid ${C.border}`,
                    backgroundColor: idx % 2 === 0 ? 'transparent' : `${C.bg}40`,
                  }}
                >
                  <td style={{ padding: '12px', color: C.textDark, fontWeight: 500 }}>
                    {record.deviceName}
                  </td>
                  <td style={{ padding: '12px', color: C.textLight, fontFamily: 'monospace', fontSize: 12 }}>
                    {record.date}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        backgroundColor:
                          record.type === '硬件故障' ? `${C.danger}20` :
                          record.type === '软件故障' ? `${C.info}20` :
                          record.type === '紧急维修' ? `${C.warning}20` :
                          `${C.success}20`,
                        color:
                          record.type === '硬件故障' ? C.danger :
                          record.type === '软件故障' ? C.info :
                          record.type === '紧急维修' ? C.warning :
                          C.success,
                      }}
                    >
                      {record.type}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: C.textDark }}>
                    {record.cost > 0 ? '¥' + record.cost.toLocaleString() : '—'}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', color: C.textDark }}>
                    {record.duration > 0 ? record.duration + ' 小时' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ============================================================
// 设备状态灯组件
// ============================================================
const StatusLight: React.FC<{ status: string }> = ({ status }) => {
  const color = STATUS_COLORS[status] || C.gray
  const pulse = status === '运行中' ? 'pulse' : ''

  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: color,
        marginRight: 6,
        boxShadow: `0 0 6px ${color}`,
        animation: pulse ? 'pulse 2s infinite' : 'none',
      }}
    />
  )
}

// ============================================================
// [W3-B] deviceMgmtApi.faults severity → 故障类型
// ============================================================
const severityToType = (sev: string): FailureRecord['type'] => {
  if (sev === 'CRITICAL' || sev === 'HIGH') return '紧急维修'
  if (sev === 'MEDIUM') return '硬件故障'
  if (sev === 'LOW') return '软件故障'
  return '定期保养'
}

// ============================================================
// 主页面组件
// ============================================================
export default function EquipmentEfficiencyPage() {
  const [selectedPeriod, setSelectedPeriod] = useState('7d')
  const [selectedTab, setSelectedTab] = useState<'trend' | 'heatmap' | 'booking' | 'failure'>('trend')

  // [W3-B] 实时数据 (oeeApi / biApi / statsApi / deviceMgmtApi)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [oeeDevices, setOeeDevices] = useState<any[]>([])
  const [oeeStats, setOeeStats] = useState<any>(null)
  const [biDevices, setBiDevices] = useState<any[]>([])
  const [topDevices, setTopDevices] = useState<any[]>([])
  const [faults, setFaults] = useState<any[]>([])

  const periodDays = selectedPeriod === '7d' ? 7 : selectedPeriod === '14d' ? 14 : 30

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [l, s, bi, top, f] = await Promise.allSettled([
        oeeApi.list(),
        oeeApi.getStats(),
        biApi.getDeviceOee(periodDays),
        statsApi.getTopDevices(10),
        deviceMgmtApi.listDeviceFaults(),
      ])
      const lv = l.status === 'fulfilled' && l.value.success === true ? l.value.data : null
      const sv = s.status === 'fulfilled' && s.value.success === true ? s.value.data : null
      const bv = bi.status === 'fulfilled' && bi.value.success === true ? bi.value.data : null
      const tv = top.status === 'fulfilled' && top.value.success === true ? top.value.data : null
      const fv = f.status === 'fulfilled' && f.value.success === true ? f.value.data : null
      setOeeDevices(Array.isArray(lv) ? lv : [])
      setOeeStats(sv)
      setBiDevices(Array.isArray(bv?.data?.devices) ? bv.data.devices : [])
      setTopDevices(Array.isArray(tv) ? tv : [])
      setFaults(Array.isArray(fv) ? fv : Array.isArray((fv as unknown as { items?: unknown[] } | null)?.items) ? (fv as unknown as { items: unknown[] }).items : [])
    } catch (e) {
      setError((e instanceof Error ? e.message : '加载失败') + ' — 已回退演示数据')
    } finally {
      setLoading(false)
    }
  }, [periodDays])

  useEffect(() => { void load() }, [load])

  // 设备卡: oeeApi.list 实时 (availability→使用率), 空则演示数据
  const DEVICES: Device[] = useMemo(() => {
    if (!oeeDevices.length) return STATIC_DEVICES
    return oeeDevices.slice(0, 8).map((d) => {
      const availability = Number(d.availability ?? 0)
      return {
        id: String(d.id),
        name: String(d.name).split(' ').pop() || String(d.id),
        model: String(d.name),
        type: String(d.modality),
        utilization: Math.round(availability),
        status: availability >= 85 ? '运行中' : availability >= 70 ? '待机' : '维护',
      }
    })
  }, [oeeDevices])

  // 效率指标: oeeApi.stats 实时 (平均/最高/最低OEE + 设备数)
  const EFFICIENCY_METRICS = useMemo(() => {
    if (!oeeStats) return STATIC_EFFICIENCY_METRICS
    return {
      avgExamTime: oeeStats.average,
      dailyMax: oeeStats.highest,
      bedTurnover: oeeStats.lowest,
      standbyHours: oeeStats.totalDevices,
    }
  }, [oeeStats])

  // 使用率趋势: biApi.device-oee 实时 (按模态映射 CT1/CT2/MRI1/DSA/DR)
  const UTILIZATION_TREND = useMemo<TrendRow[]>(() => {
    if (!biDevices.length) return STATIC_UTILIZATION_TREND as unknown as TrendRow[]
    const bucket: Record<string, any[]> = {}
    for (const d of biDevices) {
      const mod = String(d.modality ?? '')
      ;(bucket[mod] ??= []).push(d)
    }
    const pick = (mod: string, i: number) => bucket[mod]?.[i] ?? bucket[mod]?.[0]
    const series: Record<string, any> = { CT1: pick('CT', 0), CT2: pick('CT', 1), MRI1: pick('MR', 0), DSA: pick('DSA', 0), DR: pick('DR', 0) }
    const dates = [...new Set(biDevices.flatMap((d) => (d.trend ?? []).map((t: any) => t.date)))].sort()
    if (!dates.length) return STATIC_UTILIZATION_TREND as unknown as TrendRow[]
    return dates.map((date) => {
      const row: any = { date: String(date).slice(5) }
      for (const key of Object.keys(series)) {
        const dev = series[key]
        const pt = dev?.trend?.find((t: any) => t.date === date)
        row[key] = Math.round(Number(pt?.availability ?? 0)) || 70
      }
      return row as TrendRow
    })
  }, [biDevices])

  // 设备负荷排行: oeeApi.list × statsApi.top-devices 检查量
  const LOAD_RANKING = useMemo(() => {
    if (!oeeDevices.length) return STATIC_LOAD_RANKING
    const counts = new Map(topDevices.map((td) => [String(td.deviceId), Number(td.count) || 0]))
    return [...oeeDevices]
      .map((d, idx) => ({
        rank: idx + 1,
        deviceId: String(d.id),
        deviceName: String(d.name),
        totalExams: counts.get(String(d.id)) ?? 0,
        avgUtilization: Math.round(Number(d.availability ?? 0)),
        avgWaitTime: 0,
        score: Math.round(Number(d.oee ?? 0)),
      }))
      .sort((a, b) => b.score - a.score)
      .map((row, i) => ({ ...row, rank: i + 1 }))
  }, [oeeDevices, topDevices])

  // 故障记录: deviceMgmtApi.faults 实时, 空则演示数据
  const FAILURE_RECORDS: FailureRecord[] = useMemo(() => {
    if (!faults.length) return STATIC_FAILURE_RECORDS
    return faults.map((f, i) => ({
      id: String(f.id ?? `FA-${i}`),
      deviceId: String(f.deviceId ?? ''),
      deviceName: String(f.deviceName ?? f.description ?? f.id ?? '').slice(0, 16),
      date: String(f.createdAt ?? '').slice(0, 10) || '—',
      type: severityToType(String(f.severity ?? '')),
      cost: 0,
      duration: 0,
    }))
  }, [faults])

  const isLive = oeeDevices.length > 0 || oeeStats != null || biDevices.length > 0 || faults.length > 0

  // [v3.0.6.11-98 Wave3B P1] 导出报表: 设备负荷排行 → 真实 CSV 下载 (BOM 保证 Excel 中文)
  const handleExportReport = () => {
    const header = ['排名', '设备编号', '设备名称', '总检查量', '平均使用率(%)', '平均等待时间(分)', '综合评分']
    const rows = LOAD_RANKING.map((r) => [r.rank, r.deviceId, r.deviceName, r.totalExams, r.avgUtilization, r.avgWaitTime, r.score])
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const csv = '\ufeff' + [header.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `设备负荷报表_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const tabs = [
    { id: 'trend', label: t('equipEfficiency.tabTrend'), icon: TrendingUp },
    { id: 'heatmap', label: t('equipEfficiency.tabHeatmap'), icon: Grid3x3 },
    { id: 'booking', label: t('equipEfficiency.tabBooking'), icon: Calendar },
    { id: 'failure', label: t('equipEfficiency.tabFailure'), icon: AlertTriangle },
  ] as const

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: C.bg,
        color: C.textDark,
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        padding: 24,
      }}
    >
      {/* 页面标题 */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: C.textDark,
              marginBottom: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <Activity size={28} color={C.primary} />
            {t('equipEfficiency.title')}
          </h1>
          <p style={{ color: C.textLight, fontSize: 14 }}>
            {t('equipEfficiency.subtitle')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {loading && <span style={{ fontSize: 12, color: C.textLight }}>{t('equipEfficiency.loading')}</span>}
          <span style={{
            padding: '5px 12px', borderRadius: 999, fontSize: 12, fontWeight: 600,
            background: isLive ? '#22c55e20' : '#f59e0b20',
            color: isLive ? C.success : C.warning,
          }}>
            {isLive ? t('equipEfficiency.live') : t('equipEfficiency.demoFallback')}
          </span>
          <button
            onClick={() => void load()}
            style={{
              padding: '8px 14px', borderRadius: 8, border: `1px solid ${C.border}`,
              background: C.bgCard, color: C.textMid, fontSize: 12, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            <RefreshCw size={13} />{t('equipEfficiency.refresh')}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ marginBottom: 16, padding: '10px 16px', borderRadius: 8, background: '#ef444420', border: `1px solid ${C.danger}`, color: C.dangerLight, fontSize: 13 }}>
          {error}
          <button onClick={() => void load()} style={{ marginLeft: 12, padding: '3px 10px', borderRadius: 4, border: `1px solid ${C.danger}`, background: 'transparent', color: C.dangerLight, cursor: 'pointer', fontSize: 12 }}>重试</button>
        </div>
      )}

      {/* 设备卡片行 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {DEVICES.slice(0, 4).map((device) => (
          <div
            key={device.id}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${C.border}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 状态指示条 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: STATUS_COLORS[device.status],
              }}
            />

            {/* 设备名称和状态 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 2 }}>{device.name}</h3>
                <p style={{ fontSize: 12, color: C.textLight }}>{device.model}</p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: `${STATUS_COLORS[device.status]}20`,
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                <StatusLight status={device.status} />
                <span style={{ fontSize: 12, color: STATUS_COLORS[device.status] }}>{device.status}</span>
              </div>
            </div>

            {/* 使用率 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.textLight }}>{t('equipEfficiency.usage')}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>{device.utilization}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  backgroundColor: C.border,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${device.utilization}%`,
                    height: '100%',
                    backgroundColor: C.primary,
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* 设备ID */}
            <div
              style={{
                fontSize: 12,
                color: C.textLight,
                fontFamily: 'monospace',
                marginTop: 12,
              }}
            >
              {device.id}
            </div>
          </div>
        ))}
      </div>

      {/* 第二行设备卡片 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {DEVICES.slice(4).map((device) => (
          <div
            key={device.id}
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 12,
              padding: 20,
              border: `1px solid ${C.border}`,
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* 状态指示条 */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                backgroundColor: STATUS_COLORS[device.status],
              }}
            />

            {/* 设备名称和状态 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 2 }}>{device.name}</h3>
                <p style={{ fontSize: 12, color: C.textLight }}>{device.model}</p>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: `${STATUS_COLORS[device.status]}20`,
                  padding: '4px 10px',
                  borderRadius: 12,
                }}
              >
                <StatusLight status={device.status} />
                <span style={{ fontSize: 12, color: STATUS_COLORS[device.status] }}>{device.status}</span>
              </div>
            </div>

            {/* 使用率 */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: C.textLight }}>{t('equipEfficiency.usage')}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.primary }}>{device.utilization}%</span>
              </div>
              <div
                style={{
                  height: 6,
                  backgroundColor: C.border,
                  borderRadius: 3,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${device.utilization}%`,
                    height: '100%',
                    backgroundColor: C.primary,
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>

            {/* 设备ID */}
            <div
              style={{
                fontSize: 12,
                color: C.textLight,
                fontFamily: 'monospace',
                marginTop: 12,
              }}
            >
              {device.id}
            </div>
          </div>
        ))}
      </div>

      {/* 效率指标行 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 20,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: `${C.primary}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Timer size={24} color={C.primary} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{t('equipEfficiency.avgOee')} {isLive && <span style={{ color: C.success }}>· {t('equipEfficiency.realtime')}</span>}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: C.textDark }}>
              {EFFICIENCY_METRICS.avgExamTime}
              <span style={{ fontSize: 14, color: C.textLight, marginLeft: 4 }}>%</span>
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 20,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: `${C.success}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Zap size={24} color={C.success} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{t('equipEfficiency.maxOee')} {isLive && <span style={{ color: C.success }}>· {t('equipEfficiency.realtime')}</span>}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: C.textDark }}>
              {EFFICIENCY_METRICS.dailyMax}
              <span style={{ fontSize: 14, color: C.textLight, marginLeft: 4 }}>%</span>
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 20,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: `${C.warning}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <TrendingUp size={24} color={C.warning} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{t('equipEfficiency.minOee')} {isLive && <span style={{ color: C.success }}>· {t('equipEfficiency.realtime')}</span>}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: C.textDark }}>
              {EFFICIENCY_METRICS.bedTurnover}
              <span style={{ fontSize: 14, color: C.textLight, marginLeft: 4 }}>%</span>
            </p>
          </div>
        </div>

        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 20,
            border: `1px solid ${C.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              backgroundColor: `${C.info}20`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Clock size={24} color={C.info} />
          </div>
          <div>
            <p style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{t('equipEfficiency.monitoredDevices')} {isLive && <span style={{ color: C.success }}>· {t('equipEfficiency.realtime')}</span>}</p>
            <p style={{ fontSize: 28, fontWeight: 700, color: C.textDark }}>
              {EFFICIENCY_METRICS.standbyHours}
              <span style={{ fontSize: 14, color: C.textLight, marginLeft: 4 }}>{t('equipEfficiency.unitsShort')}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
          borderBottom: `1px solid ${C.border}`,
          paddingBottom: 12,
        }}
      >
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = selectedTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 8,
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                backgroundColor: isActive ? C.primary : 'transparent',
                color: isActive ? C.white : C.textLight,
                transition: 'all 0.2s ease',
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Tab 内容 */}
      {selectedTab === 'trend' && (
        <>
          {/* 图表区域：使用率趋势 + 时段分析 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1.5fr 1fr',
              gap: 16,
              marginBottom: 24,
            }}
          >
            {/* 使用率趋势折线图 */}
            <div
              style={{
                backgroundColor: C.bgCard,
                borderRadius: 12,
                padding: 24,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t('equipEfficiency.utilizationTrend')}</h3>
                  <p style={{ fontSize: 12, color: C.textLight }}>
                    {t('equipEfficiency.trendDescPrefix')}{selectedPeriod === '7d' ? '7' : selectedPeriod === '14d' ? '14' : '30'}{t('equipEfficiency.trendDescSuffix')} {isLive && <span style={{ color: C.success }}>{t('equipEfficiency.realtime')}</span>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['7d', '14d', '30d'].map((period) => (
                    <button
                      key={period}
                      onClick={() => setSelectedPeriod(period)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        border: 'none',
                        fontSize: 12,
                        cursor: 'pointer',
                        backgroundColor: selectedPeriod === period ? C.primary : C.border,
                        color: selectedPeriod === period ? C.white : C.textLight,
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <TrendLineChart data={UTILIZATION_TREND} />
              </div>
            </div>

            {/* 检查量时段分析 */}
            <div
              style={{
                backgroundColor: C.bgCard,
                borderRadius: 12,
                padding: 24,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t('equipEfficiency.timeSegment')}</h3>
                <p style={{ fontSize: 12, color: C.textLight }}>{t('equipEfficiency.timeSegmentDesc')}</p>
              </div>
              <TimeSegmentChart data={TIME_SEGMENT_DATA} />

              {/* 时段汇总 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 12,
                  marginTop: 16,
                  paddingTop: 16,
                  borderTop: `1px solid ${C.border}`,
                }}
              >
                {TIME_SEGMENT_DATA.map((item) => (
                  <div key={item.period} style={{ textAlign: 'center' }}>
                    <p style={{ fontSize: 12, color: C.textLight, marginBottom: 4 }}>{item.period}</p>
                    <p style={{ fontSize: 18, fontWeight: 600, color: C.primary }}>{item.total}</p>
                    <p style={{ fontSize: 12, color: C.textLight }}>{t('equipEfficiency.cases')}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* 设备负荷排行榜 */}
          <div
            style={{
              backgroundColor: C.bgCard,
              borderRadius: 12,
              padding: 24,
              border: `1px solid ${C.border}`,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t('equipEfficiency.loadRanking')}</h3>
                <p style={{ fontSize: 12, color: C.textLight }}>
                  {t('equipEfficiency.loadRankingDesc')} {isLive && <span style={{ color: C.success }}>{t('equipEfficiency.realtime')}</span>}
                </p>
              </div>
              <button
                onClick={handleExportReport}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  backgroundColor: 'transparent',
                  color: C.textLight,
                  fontSize: 12,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Download size={14} />
                {t('equipEfficiency.exportReport')}
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: 13,
                }}
              >
                <thead>
                  <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.rank')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.deviceId')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'left', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.deviceName')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.totalExams')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.avgUtilization')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.avgWaitTime')}</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center', color: C.textLight, fontWeight: 500 }}>{t('equipEfficiency.overallScore')}</th>
                  </tr>
                </thead>
                <tbody>
                  {LOAD_RANKING.map((item, idx) => (
                    <tr
                      key={item.deviceId}
                      style={{
                        borderBottom: `1px solid ${C.border}`,
                        backgroundColor: idx === 0 ? `${C.primary}08` : 'transparent',
                      }}
                    >
                      <td style={{ padding: '14px 16px' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            backgroundColor:
                              idx === 0 ? C.primary : idx === 1 ? C.warning : idx === 2 ? C.info : C.border,
                            color: idx < 3 ? C.bg : C.textLight,
                            fontWeight: 600,
                            fontSize: 12,
                          }}
                        >
                          {item.rank}
                        </div>
                      </td>
                      <td style={{ padding: '14px 16px', color: C.textLight, fontFamily: 'monospace', fontSize: 12 }}>
                        {item.deviceId}
                      </td>
                      <td style={{ padding: '14px 16px', color: C.textDark, fontWeight: 500 }}>
                        {item.deviceName}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: C.textDark }}>
                        {item.totalExams > 0 ? item.totalExams.toLocaleString() + ' 例' : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '4px 10px',
                            borderRadius: 4,
                            backgroundColor:
                              item.avgUtilization >= 85 ? `${C.success}20` :
                              item.avgUtilization >= 70 ? `${C.primary}20` : `${C.warning}20`,
                            color:
                              item.avgUtilization >= 85 ? C.success :
                              item.avgUtilization >= 70 ? C.primary : C.warning,
                            fontSize: 12,
                            fontWeight: 500,
                          }}
                        >
                          {item.avgUtilization}%
                        </span>
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', color: C.textDark }}>
                        {item.avgWaitTime > 0 ? item.avgWaitTime + ' 分钟' : '—'}
                      </td>
                      <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              width: 100,
                              height: 6,
                              backgroundColor: C.border,
                              borderRadius: 3,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${item.score}%`,
                                height: '100%',
                                backgroundColor:
                                  item.score >= 90 ? C.success :
                                  item.score >= 75 ? C.primary : C.warning,
                                borderRadius: 3,
                              }}
                            />
                          </div>
                          <span
                            style={{
                              fontWeight: 600,
                              color:
                                item.score >= 90 ? C.success :
                                item.score >= 75 ? C.primary : C.warning,
                              fontSize: 13,
                            }}
                          >
                            {item.score}
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 底部统计 */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 20,
                paddingTop: 16,
                borderTop: `1px solid ${C.border}`,
                fontSize: 12,
                color: C.textLight,
              }}
            >
              <span>{t('equipEfficiency.statPeriod')}{periodDays}{t('equipEfficiency.days')}{isLive ? ` · ${t('equipEfficiency.oeeApiRealtime')}` : ` · ${t('equipEfficiency.demoData')}`}</span>
              <span>{t('equipEfficiency.dataUpdated')}{new Date().toLocaleString('zh-CN')}</span>
            </div>
          </div>
        </>
      )}

      {selectedTab === 'heatmap' && (
        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 24,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t('equipEfficiency.heatmapTitle')}</h3>
            <p style={{ fontSize: 12, color: C.textLight }}>{t('equipEfficiency.heatmapDesc')}</p>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <HeatmapChart />
          </div>
        </div>
      )}

      {selectedTab === 'booking' && (
        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 24,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t('equipEfficiency.bookingTitle')}</h3>
            <p style={{ fontSize: 12, color: C.textLight }}>
              {t('equipEfficiency.bookingDesc')}
            </p>
          </div>
          <BookingRateChart />
        </div>
      )}

      {selectedTab === 'failure' && (
        <div
          style={{
            backgroundColor: C.bgCard,
            borderRadius: 12,
            padding: 24,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, marginBottom: 4 }}>{t('equipEfficiency.failureTitle')}</h3>
            <p style={{ fontSize: 12, color: C.textLight }}>
              {t('equipEfficiency.failureDesc')} {isLive && <span style={{ color: C.success }}>{t('equipEfficiency.realtime')}</span>}
            </p>
          </div>
          <FailureStatsChart records={FAILURE_RECORDS} />
        </div>
      )}

      {/* CSS动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
