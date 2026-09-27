// G005 放射科RIS系统 - 科室排班管理页面 v1.0.0
// 功能：技师/医师班次管理、节假日配置、代班换班、排班统计
import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import {
  Calendar, Clock, Settings, ChevronLeft, ChevronRight,
  Plus, X, Check, Search, RefreshCw, AlertCircle, CheckCircle,
  Trash2, ArrowRightLeft, BarChart3,
  CalendarDays, CalendarClock, Sun, Moon, Sunset, Coffee,
  TrendingUp, UserPlus, Shield, Download, Zap, DollarSign, Save, Send
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  PieChart as RePieChart, Pie, Cell, Legend
} from 'recharts'
import { initialUsers } from '../data/initialData'
import { deviceApi, userApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { ChartContainer } from '../components/charts'
import { formatDateObj } from '../utils/date';
import { t } from '../i18n/appI18n'
// [W14-UX] 批量排班操作栏 + 撤销
import BatchActionBar from '../components/batch/BatchActionBar'
import { useUndoActions } from '../components/UndoToast'
// [v3.0.6.11-103 Wave 10] 重复页合并: TechSchedulePage (技师排班/工作量/人员/设备) 嵌入为 SchedulePage 新 Tab, 旧路由 /ops/tech-schedule redirect → /schedule
import TechSchedulePage from './ops/TechSchedulePage'

// ============================================================
// 样式常量 (WIN10风格)
// ============================================================
const C = {
  primary: '#1e40af',       // 深蓝主色
  primaryLight: '#3b82f6',  // 浅蓝
  primaryLighter: 'var(--color-info-bg)', // 更浅蓝
  accent: '#0891b2',        // 青色辅色
  accentLight: '#06b6d4',
  white: '#ffffff',
  bg: 'var(--bg-deep)',            // 浅灰背景
  bgLight: 'var(--content-bg)',
  border: 'var(--border-color)',
  borderLight: '#e5e5e5',
  textDark: 'var(--text-primary)',
  textMid: 'var(--text-secondary)',
  textLight: 'var(--text-muted)',
  success: '#059669',
  successLight: 'var(--color-success-bg)',
  warning: '#d97706',
  warningLight: 'var(--color-warning-bg)',
  danger: '#dc2626',
  dangerLight: 'var(--color-error-bg)',
  info: '#2563eb',
  infoLight: 'var(--color-info-bg)',
}

// ============================================================
// 类型定义
// ============================================================
interface ScheduleRecord {
  id: string
  staffId: string
  staffName: string
  role: string
  department: string
  modality: string  // CT/MR/DR/DSA/钼靶
  date: string
  shift: ShiftType
  status: 'confirmed' | 'pending' | 'cancelled'
  note?: string
}

interface SwapRequest {
  id: string
  requesterId: string
  requesterName: string
  targetId: string
  targetName: string
  requesterDate: string
  targetDate: string
  requesterShift: ShiftType
  targetShift: ShiftType
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  requestDate: string
  approveDate?: string
  approverId?: string
  approverName?: string
}

interface HolidayConfig {
  date: string
  name: string
  type: 'legal' | 'adjustment' // 法定节假日/调休工作日
}

type ShiftType = 'morning' | 'afternoon' | 'night' | 'fullday' | 'off'

// ============================================================
// Phase 4b - 新增类型定义
// ============================================================

interface AutoScheduleCandidate {
  staffId: string
  staffName: string
  shift: ShiftType
  skillScore: number
  conflicts: string[]
}

interface ShiftTemplate {
  id: string
  name: string
  description: string
  pattern: Array<{ staffId: string; shift: ShiftType; modality: string }>
  createdAt: string
}

interface LeaveRequestType {
  id: string
  staffId: string
  staffName: string
  type: 'annual' | 'sick' | 'personal'
  startDate: string
  endDate: string
  days: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  balance: number
  applyDate: string
  approveDate?: string
  approverName?: string
}

interface LeaveBalance {
  staffId: string
  staffName: string
  annualTotal: number
  annualUsed: number
  sickTotal: number
  sickUsed: number
  personalTotal: number
  personalUsed: number
}

interface ComplianceViolation {
  type: 'max_consecutive' | 'rest_period' | 'overtime'
  staffName: string
  date: string
  detail: string
  severity: 'warning' | 'critical'
}

interface ComplianceResult {
  score: number
  maxConsecutiveAlerts: ComplianceViolation[]
  restPeriodViolations: ComplianceViolation[]
  overtimeAlerts: ComplianceViolation[]
  violations: number
}

interface CostData {
  staffId: string
  staffName: string
  regularHours: number
  overtimeHours: number
  regularCost: number
  overtimeCost: number
  shiftDifferential: number
  totalCost: number
}

interface CostTrend {
  month: string
  regular: number
  overtime: number
  differential: number
}

// ============================================================
// 常量定义
// ============================================================

// 班次类型配置
const SHIFT_CONFIG: Record<ShiftType, { label: string; color: string; bg: string; icon: React.ReactNode; time: string }> = {
  morning: { label: t('schedulePage.shiftMorning'), color: '#f59e0b', bg: '#f59e0b22', icon: <Sun size={14} />, time: '08:00-12:00' },
  afternoon: { label: t('schedulePage.shiftAfternoon'), color: '#3b82f6', bg: '#3b82f622', icon: <Sunset size={14} />, time: '14:00-18:00' },
  night: { label: t('schedulePage.shiftNight'), color: '#3b82f6', bg: '#3b82f622', icon: <Moon size={14} />, time: '18:00-次日08:00' },
  fullday: { label: t('schedulePage.shiftFullDay'), color: '#059669', bg: '#22c55e22', icon: <Clock size={14} />, time: '08:00-18:00' },
  off: { label: t('schedulePage.shiftOff'), color: 'var(--text-secondary)', bg: 'var(--bg-deep)', icon: <Coffee size={14} />, time: t('schedulePage.shiftOffTime') },
}

// 设备类型配置
const MODALITY_CONFIG: Record<string, { label: string; color: string }> = {
  CT: { label: 'CT', color: '#7c3aed' },
  MR: { label: 'MR', color: '#2563eb' },
  DR: { label: 'DR', color: '#059669' },
  DSA: { label: 'DSA', color: '#dc2626' },
  'MG': { label: 'MG', color: '#d97706' },
  钼靶: { label: 'MG', color: '#d97706' },
}

// 设备类型列表
const MODALITY_LIST = ['CT', 'MR', 'DR', 'DSA', 'MG']

// 技师/医师列表（从initialUsers筛选） - 必须在 STAFF_SKILLS 等依赖它的常量之前声明
const STAFF_LIST = initialUsers.filter(u => u.role === 'technologist' || u.role === 'radiologist').map(u => ({
  ...u,
  initials: u.name.slice(0, 2),
  label: `${u.name}（${u.title}）`,
}))

// ============================================================
// Phase 4b - 常量定义（技能矩阵、费率、模板等）
// ============================================================

// 员工技能矩阵：各员工对不同 modality 的认证
const STAFF_SKILLS: Record<string, string[]> = {}
STAFF_LIST.forEach(s => {
  const assigned: string[] = []
  const idx = STAFF_LIST.indexOf(s)
  MODALITY_LIST.forEach((m, mi) => {
    if ((idx + mi) % 3 !== 0) assigned.push(m)
  })
  STAFF_SKILLS[s.id] = assigned
})

// 默认模板
const DEFAULT_TEMPLATES: ShiftTemplate[] = [
  {
    id: 'TPL-001', name: '标准白班', description: '上午/下午班交替，每人每周5天',
    pattern: STAFF_LIST.slice(0, 6).map(s => ({ staffId: s.id, shift: 'morning' as ShiftType, modality: 'CT' })),
    createdAt: '2026-01-01',
  },
  {
    id: 'TPL-002', name: '夜班专配', description: '固定夜班组，保证充足休息',
    pattern: STAFF_LIST.slice(0, 4).map(s => ({ staffId: s.id, shift: 'night' as ShiftType, modality: 'MR' })),
    createdAt: '2026-01-15',
  },
  {
    id: 'TPL-003', name: '周末精简', description: '周末减半人力的高效排班',
    pattern: STAFF_LIST.slice(0, 3).map(s => ({ staffId: s.id, shift: 'fullday' as ShiftType, modality: 'DR' })),
    createdAt: '2026-02-01',
  },
]

// 默认请假余额
const DEFAULT_LEAVE_BALANCES: LeaveBalance[] = STAFF_LIST.slice(0, 10).map((s, i) => ({
  staffId: s.id,
  staffName: s.name,
  annualTotal: 15, annualUsed: Math.floor(i * 1.2),
  sickTotal: 10, sickUsed: Math.floor(i * 0.3),
  personalTotal: 5, personalUsed: Math.floor(i * 0.2),
}))

// 初始请假申请
const INITIAL_LEAVE_REQUESTS: LeaveRequestType[] = [
  { id: 'LV-001', staffId: STAFF_LIST[0]?.id || 'R005', staffName: STAFF_LIST[0]?.name || '刘建国', type: 'annual', startDate: '2026-05-11', endDate: '2026-05-13', days: 3, reason: '年假旅游', status: 'pending', balance: 15, applyDate: '2026-04-28' },
  { id: 'LV-002', staffId: STAFF_LIST[1]?.id || 'R006', staffName: STAFF_LIST[1]?.name || '陈小红', type: 'sick', startDate: '2026-05-07', endDate: '2026-05-07', days: 1, reason: '身体不适', status: 'approved', balance: 10, applyDate: '2026-04-29', approveDate: '2026-04-30', approverName: '李明辉' },
  { id: 'LV-003', staffId: STAFF_LIST[2]?.id || 'R007', staffName: STAFF_LIST[2]?.name || '张建军', type: 'personal', startDate: '2026-05-15', endDate: '2026-05-16', days: 2, reason: '家庭事务', status: 'rejected', balance: 5, applyDate: '2026-04-25', approveDate: '2026-04-27', approverName: '李明辉' },
]

// 合规规则
const COMPLIANCE_RULES = {
  maxConsecutiveDays: 6,
  minRestHours: 12,
  maxWeeklyHours: 48,
  maxOvertimePerMonth: 36,
  shiftRestHours: { morning: 12, afternoon: 12, night: 24, fullday: 12 },
}

// 费率配置（元/小时）
const PAY_RATES = {
  regular: 45,
  overtime: 75,
  shiftDifferential: { morning: 0, afternoon: 5, night: 20, fullday: 8, off: 0 },
}

// 月度成本趋势
const INITIAL_COST_TREND: CostTrend[] = [
  { month: '2026-01', regular: 128000, overtime: 18400, differential: 9600 },
  { month: '2026-02', regular: 115000, overtime: 15200, differential: 8200 },
  { month: '2026-03', regular: 132000, overtime: 21000, differential: 10500 },
  { month: '2026-04', regular: 126000, overtime: 19300, differential: 9800 },
  { month: '2026-05', regular: 131000, overtime: 20500, differential: 10200 },
  { month: '2026-06', regular: 124000, overtime: 17800, differential: 9100 },
]

// ============================================================
// 工具函数
// ============================================================

// 获取当前周的周一日期
const getWeekStart = (date: Date): Date => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

// 格式化日期为 YYYY-MM-DD


// 获取日期的中文表示
const formatDateCht = (d: Date): string => {
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  return `${d.getMonth() + 1}月${d.getDate()}日${weekdays[d.getDay()]}`
}

// 判断是否为周末
const isWeekend = (d: Date): boolean => {
  const day = d.getDay()
  return day === 0 || day === 6
}

// 判断是否为法定节假日
const isLegalHoliday = (dateStr: string, holidays: HolidayConfig[]): boolean => {
  return holidays.some(h => h.date === dateStr && h.type === 'legal')
}

// 判断是否为调休工作日
const isAdjustmentWorkday = (dateStr: string, holidays: HolidayConfig[]): boolean => {
  return holidays.some(h => h.date === dateStr && h.type === 'adjustment')
}

// 获取周日期范围
const getWeekDates = (startDate: Date): Date[] => {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    return d
  })
}

// ============================================================
// 模拟数据
// ============================================================

// 节假日配置
const HOLIDAY_CONFIG: HolidayConfig[] = [
  { date: '2026-05-01', name: '劳动节', type: 'legal' },
  { date: '2026-05-02', name: '劳动节', type: 'legal' },
  { date: '2026-05-03', name: '劳动节', type: 'legal' },
  { date: '2026-05-04', name: '劳动节', type: 'legal' },
  { date: '2026-05-05', name: '劳动节', type: 'legal' },
  { date: '2026-04-26', name: '调休上班', type: 'adjustment' },
  { date: '2026-05-09', name: '调休上班', type: 'adjustment' },
]

// 技师/医师列表（从initialUsers筛选）- 已在模块顶部提前声明，供 STAFF_SKILLS 等常量使用

// 生成一周的排班数据（约20条记录）
const generateWeekSchedule = (weekDates: Date[]): ScheduleRecord[] => {
  const schedules: ScheduleRecord[] = []
  const shifts: ShiftType[] = ['morning', 'afternoon', 'night', 'fullday', 'off']
  
  // 为每个员工每天分配一个班次
  weekDates.forEach((date, dayIndex) => {
    const dateStr = formatDateObj(date)
    const isWeekendDay = isWeekend(date)
    const isHoliday = isLegalHoliday(dateStr, HOLIDAY_CONFIG)
    const isAdjustment = isAdjustmentWorkday(dateStr, HOLIDAY_CONFIG)
    
    STAFF_LIST.forEach((staff, staffIndex) => {
      // 跳过周末或节假日的部分员工
      if (isWeekendDay && !isAdjustment && Math.random() > 0.3) {
        // 周末休息
        schedules.push({
          id: `SCH-${dateStr}-${staff.id}`,
          staffId: staff.id,
          staffName: staff.name,
          role: staff.role,
          department: staff.department,
          modality: dayIndex % 2 === 0 ? 'CT' : 'MR', // 轮换设备类型
          date: dateStr,
          shift: 'off',
          status: 'confirmed',
        })
      } else if (isHoliday && !isAdjustment) {
        // 节假日休息
        schedules.push({
          id: `SCH-${dateStr}-${staff.id}`,
          staffId: staff.id,
          staffName: staff.name,
          role: staff.role,
          department: staff.department,
          modality: 'CT',
          date: dateStr,
          shift: 'off',
          status: 'confirmed',
        })
      } else {
        // 正常工作日
        const shiftIndex = (staffIndex + dayIndex) % shifts.length
        const shift: ShiftType = shifts[shiftIndex] || 'off'
        schedules.push({
          id: `SCH-${dateStr}-${staff.id}`,
          staffId: staff.id,
          staffName: staff.name,
          role: staff.role,
          department: staff.department,
          modality: MODALITY_LIST[staffIndex % MODALITY_LIST.length] || 'CT',
          date: dateStr,
          shift: shift,
          status: 'confirmed',
        })
      }
    })
  })
  
  return schedules
}

// 代班换班申请记录
const INITIAL_SWAP_REQUESTS: SwapRequest[] = [
  {
    id: 'SWAP-001',
    requesterId: 'R005',
    requesterName: '刘建国',
    targetId: 'R006',
    targetName: '陈小红',
    requesterDate: '2026-05-06',
    targetDate: '2026-05-08',
    requesterShift: 'morning',
    targetShift: 'morning',
    reason: '家中有事，需要临时调换班次',
    status: 'pending',
    requestDate: '2026-05-01',
  },
  {
    id: 'SWAP-002',
    requesterId: 'R007',
    requesterName: '张建军',
    targetId: 'R005',
    targetName: '刘建国',
    requesterDate: '2026-05-10',
    targetDate: '2026-05-12',
    requesterShift: 'afternoon',
    targetShift: 'morning',
    reason: '参加学术会议，需要换班',
    status: 'approved',
    requestDate: '2026-04-28',
    approveDate: '2026-04-29',
    approverId: 'R001',
    approverName: '李明辉',
  },
  {
    id: 'SWAP-003',
    requesterId: 'R006',
    requesterName: '陈小红',
    targetId: 'R007',
    targetName: '张建军',
    requesterDate: '2026-05-15',
    targetDate: '2026-05-16',
    requesterShift: 'night',
    targetShift: 'night',
    reason: '身体不适，需要休息',
    status: 'pending',
    requestDate: '2026-05-02',
  },
]

// 排班统计数据
const generateScheduleStats = (schedules: ScheduleRecord[]) => {
  // 个人出勤统计
  const staffStats = STAFF_LIST.map(staff => {
    const staffSchedules = schedules.filter(s => s.staffId === staff.id)
    const shiftCount: Record<ShiftType, number> = {
      morning: 0, afternoon: 0, night: 0, fullday: 0, off: 0
    }
    staffSchedules.forEach(s => {
      if (s.shift in shiftCount) shiftCount[s.shift as ShiftType]++
    })
    
    return {
      staffId: staff.id,
      staffName: staff.name,
      title: staff.title,
      totalShifts: staffSchedules.filter(s => s.shift !== 'off').length,
      ...shiftCount,
    }
  })

  // 设备利用率统计
  const modalityUtilization = MODALITY_LIST.map(mod => {
    const modSchedules = schedules.filter(s => s.modality === mod && s.shift !== 'off')
    const totalSlots = schedules.length / MODALITY_LIST.length * 7 // 粗略估算
    return {
      modality: mod,
      label: MODALITY_CONFIG[mod]?.label || mod,
      count: modSchedules.length,
      utilization: Math.round((modSchedules.length / totalSlots) * 100),
    }
  })

  // 班次分布统计
  const shiftDistribution = [
    { name: '上午班', value: schedules.filter(s => s.shift === 'morning').length, color: '#f59e0b' },
    { name: '下午班', value: schedules.filter(s => s.shift === 'afternoon').length, color: '#3b82f6' },
    { name: '夜班', value: schedules.filter(s => s.shift === 'night').length, color: '#3b82f6' },
    { name: '全天班', value: schedules.filter(s => s.shift === 'fullday').length, color: '#059669' },
    { name: '休息', value: schedules.filter(s => s.shift === 'off').length, color: 'var(--text-secondary)' },
  ]

  return { staffStats, modalityUtilization, shiftDistribution }
}

// ============================================================
// 子组件
// ============================================================

/** 标签页按钮 */
function TabBtn({ label, active, onClick, icon }: { label: string; active: boolean; onClick: () => void; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 16px',
        border: 'none',
        borderBottom: active ? `2px solid ${C.primary}` : '2px solid transparent',
        background: active ? 'var(--bg-card)' : 'transparent',
        color: active ? C.primary : C.textMid,
        cursor: 'pointer',
        fontSize: 14,
        fontWeight: active ? 600 : 400,
        transition: 'all 0.2s',
      }}
    >
      {icon}
      {label}
    </button>
  )
}

/** 班次标签 */
function ShiftBadge({ shift, size = 'default' }: { shift: ShiftType; size?: 'small' | 'default' }) {
  const config = SHIFT_CONFIG[shift]
  const padding = size === 'small' ? '2px 6px' : '4px 10px'
  const fontSize = size === 'small' ? 11 : 12
  
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      padding,
      background: config.bg,
      color: config.color,
      borderRadius: 4,
      fontSize,
      fontWeight: 500,
      border: `1px solid ${config.color}30`,
    }}>
      {config.icon}
      {config.label}
    </span>
  )
}

/** 状态徽章 */
function StatusBadge({ status }: { status: SwapRequest['status'] }) {
  const config = {
    pending: { label: t('w9b.schedule.swapPending'), bg: C.warningLight, color: C.warning },
    approved: { label: t('w9b.schedule.swapApproved'), bg: C.successLight, color: C.success },
    rejected: { label: t('w9b.schedule.swapRejected'), bg: C.dangerLight, color: C.danger },
  }[status]
  
  return (
    <span style={{
      padding: '2px 8px',
      background: config.bg,
      color: config.color,
      borderRadius: 10,
      fontSize: 12,
      fontWeight: 500,
    }}>
      {config.label}
    </span>
  )
}

/** 设备类型标签 */
function ModalityBadge({ modality }: { modality: string }) {
  const config = MODALITY_CONFIG[modality] || { label: modality, color: 'var(--text-secondary)' }
  return (
    <span style={{
      padding: '2px 8px',
      background: config.color + '20',
      color: config.color,
      borderRadius: 4,
      fontSize: 12,
      fontWeight: 500,
    }}>
      {config.label}
    </span>
  )
}

/** 周导航器 */
function WeekNavigator({ weekStart, onPrev, onNext, onToday }: { 
  weekStart: Date; 
  onPrev: () => void; 
  onNext: () => void; 
  onToday: () => void;
}) {
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 6)
  
  const formatRange = () => {
    const startMonth = weekStart.getMonth() + 1
    const startDay = weekStart.getDate()
    const endMonth = weekEnd.getMonth() + 1
    const endDay = weekEnd.getDate()
    
    if (startMonth === endMonth) {
      return `${startMonth}月${startDay}日 - ${endDay}日`
    }
    return `${startMonth}月${startDay}日 - ${endMonth}月${endDay}日`
  }
  
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <button onClick={onPrev} aria-label={t('schedulePage.prevWeek')} style={btnStyle(C.primary)}>
        <ChevronLeft size={16} />
      </button>
      <span style={{ fontSize: 15, fontWeight: 600, color: C.textDark, minWidth: 180, textAlign: 'center' }}>
        {formatRange()}
      </span>
      <button onClick={onNext} aria-label={t('schedulePage.nextWeek')} style={btnStyle(C.primary)}>
        <ChevronRight size={16} />
      </button>
      <button onClick={onToday} style={{ ...btnStyle(C.textMid), fontSize: 12 }}>
        {t('schedulePage.today')}
      </button>
    </div>
  )
}

// 按钮样式
const btnStyle = (bg: string) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '6px 10px',
  background: bg,
  color: C.white,
  border: 'none',
  borderRadius: 4,
  cursor: 'pointer',
  fontSize: 13,
  gap: 4,
})

// ============================================================
// 主组件
// ============================================================
export default function SchedulePage() {
  // 状态定义
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(new Date()))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoading(true)
      const [devRes, userRes] = await Promise.all([deviceApi.list(), userApi.list()])
      if (cancelled) return
      if (devRes.success || userRes.success) {
        setLoadError(null)
      } else {
        setLoadError(t('schedulePage.apiUnavailable'))
      }
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [])
  const [activeTab, setActiveTab] = useState<'schedule' | 'holiday' | 'swap' | 'stats' | 'auto' | 'templates' | 'leave' | 'compliance' | 'cost' | 'tech'>('schedule')
  const [selectedModality, setSelectedModality] = useState<string>('all')
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [searchKeyword, setSearchKeyword] = useState('')
  const [swapRequests, setSwapRequests] = useState<SwapRequest[]>(INITIAL_SWAP_REQUESTS)
  const [holidays, setHolidays] = useState<HolidayConfig[]>(HOLIDAY_CONFIG)
  
  // 换班弹窗状态
  const [showSwapModal, setShowSwapModal] = useState(false)
  const [swapForm, setSwapForm] = useState({
    requesterId: '',
    targetId: '',
    requesterDate: '',
    targetDate: '',
    requesterShift: 'morning' as ShiftType,
    targetShift: 'morning' as ShiftType,
    reason: '',
  })
  
  // 节假日弹窗状态
  const [showHolidayModal, setShowHolidayModal] = useState(false)
  const [holidayForm, setHolidayForm] = useState({
    date: '',
    name: '',
    type: 'legal' as 'legal' | 'adjustment',
  })
  const [swapError, setSwapError] = useState('')
  const [, setHolidayError] = useState('')

  // Phase 4b - 自动排班状态
  const [autoResult, setAutoResult] = useState<AutoScheduleCandidate[][] | null>(null)
  const [autoRunning, setAutoRunning] = useState(false)

  // Phase 4b - 模板状态
  const [templates, setTemplates] = useState<ShiftTemplate[]>(DEFAULT_TEMPLATES)
  const [showTemplateModal, setShowTemplateModal] = useState(false)
  const [templateForm, setTemplateForm] = useState({ name: '', description: '', shifts: [] as Array<{ staffId: string; shift: ShiftType; modality: string }> })

  // Phase 4b - 请假状态
  const [leaveRequests, setLeaveRequests] = useState<LeaveRequestType[]>(INITIAL_LEAVE_REQUESTS)
  const [leaveBalances, setLeaveBalances] = useState<LeaveBalance[]>(DEFAULT_LEAVE_BALANCES)
  const [showLeaveModal, setShowLeaveModal] = useState(false)
  const [leaveForm, setLeaveForm] = useState({ staffId: '', type: 'annual' as 'annual' | 'sick' | 'personal', startDate: '', endDate: '', reason: '' })

  // Phase 4b - 合规状态
  const [complianceResult, setComplianceResult] = useState<ComplianceResult | null>(null)

  // Phase 4b - 成本状态
  const [costData, setCostData] = useState<CostData[]>([])
  const [costTrend] = useState<CostTrend[]>(INITIAL_COST_TREND)

  // 计算当前周的日期
  const weekDates = useMemo(() => getWeekDates(currentWeekStart), [currentWeekStart])

  // 生成排班数据
  const [allSchedules, setAllSchedules] = useState(() => generateWeekSchedule(weekDates))
  useEffect(() => { setAllSchedules(generateWeekSchedule(weekDates)) }, [weekDates])

  // [G005 Wave2A P1] 导出排班: 用当前周排班数据生成真实 CSV 并下载, 进度弹窗完成后关闭
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const exportIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  useEffect(() => { return () => { if (exportIntervalRef.current) clearInterval(exportIntervalRef.current) } }, [])
  const handleExport = useCallback(() => {
    setShowExportModal(true); setExportProgress(0)
    const headers = [t('schedulePage.csvStaff'), t('schedulePage.csvTitle'), t('schedulePage.csvDate'), t('schedulePage.csvWeekday'), t('schedulePage.csvShift'), t('schedulePage.csvShiftTime'), t('schedulePage.csvModality'), t('schedulePage.csvStatus')]
    const rows = allSchedules.map(s => [
      s.staffName,
      STAFF_LIST.find(x => x.id === s.staffId)?.title || s.role || '',
      s.date,
      formatDateCht(new Date(s.date + 'T00:00:00')),
      SHIFT_CONFIG[s.shift]?.label || s.shift,
      SHIFT_CONFIG[s.shift]?.time || '',
      s.modality,
      s.status === 'confirmed' ? t('schedulePage.statusConfirmed') : s.status,
    ])
    const csv = [headers, ...rows]
      .map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `排班表-${formatDateObj(currentWeekStart)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    let p = 0
    exportIntervalRef.current = setInterval(() => {
      p = Math.min(p + 25, 100)
      setExportProgress(p)
      if (p >= 100) {
        if (exportIntervalRef.current) clearInterval(exportIntervalRef.current)
        exportIntervalRef.current = null
        setTimeout(() => setShowExportModal(false), 500)
      }
    }, 120)
  }, [allSchedules, currentWeekStart])

  // 筛选后的排班数据
  const filteredSchedules = useMemo(() => {
    return allSchedules.filter(s => {
      if (selectedModality !== 'all' && s.modality !== selectedModality) return false
      if (selectedStaff !== 'all' && s.staffId !== selectedStaff) return false
      if (searchKeyword && !s.staffName.includes(searchKeyword)) return false
      return true
    })
  }, [allSchedules, selectedModality, selectedStaff, searchKeyword])
  
  // 统计数据
  const stats = useMemo(() => generateScheduleStats(allSchedules), [allSchedules])
  
  // ====== [W14-UX] 批量排班操作 (按人员多选) ======
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set())
  const { showUndo } = useUndoActions()

  const visibleStaff = useMemo(
    () => (selectedStaff === 'all' ? STAFF_LIST : STAFF_LIST.filter(s => s.id === selectedStaff)),
    [selectedStaff],
  )

  const toggleStaffSelect = (id: string) => {
    setSelectedStaffIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const handleBatchSchedule = (action: string) => {
    const ids = Array.from(selectedStaffIds)
    if (ids.length === 0) return
    if (action === 'generate') {
      const existing = new Set(allSchedules.map(s => `${s.staffId}|${s.date}`))
      const additions: ScheduleRecord[] = []
      weekDates.forEach((date, dayIdx) => {
        const dateStr = formatDateObj(date)
        visibleStaff.filter(s => ids.includes(s.id)).forEach(staff => {
          if (existing.has(`${staff.id}|${dateStr}`)) return
          additions.push({
            id: `SCH-${dateStr}-${staff.id}`,
            staffId: staff.id,
            staffName: staff.name,
            role: staff.role,
            department: staff.department,
            modality: dayIdx % 2 === 0 ? 'CT' : 'MR',
            date: dateStr,
            shift: dayIdx % 2 === 0 ? 'morning' : 'afternoon',
            status: 'confirmed',
          })
        })
      })
      setAllSchedules(prev => [...prev, ...additions])
      if (additions.length > 0) {
        const snapshot = allSchedules
        showUndo(t('w14Ux.batch.done', { count: additions.length, action: t('schedulePage.batchGenerate') }), () => setAllSchedules(snapshot))
      }
    } else if (action === 'off') {
      const snapshot = allSchedules
      setAllSchedules(prev => prev.map(s => ids.includes(s.staffId) ? { ...s, shift: 'off' as ShiftType } : s))
      showUndo(t('w14Ux.batch.done', { count: ids.length, action: t('schedulePage.batchSetOff') }), () => setAllSchedules(snapshot))
    } else if (action === 'export') {
      handleExport()
    }
    setSelectedStaffIds(new Set())
  }
  
  // 周导航函数
  const goToPrevWeek = () => {
    const prev = new Date(currentWeekStart)
    prev.setDate(prev.getDate() - 7)
    setCurrentWeekStart(prev)
  }
  
  const goToNextWeek = () => {
    const next = new Date(currentWeekStart)
    next.setDate(next.getDate() + 7)
    setCurrentWeekStart(next)
  }
  
  const goToToday = () => {
    setCurrentWeekStart(getWeekStart(new Date()))
  }
  
  // 处理换班申请
  const handleSwapSubmit = () => {
    const requester = STAFF_LIST.find(s => s.id === swapForm.requesterId)
    const target = STAFF_LIST.find(s => s.id === swapForm.targetId)
    
    if (!requester || !target) {
      setSwapError(t('schedulePage.warnSelectStaff'))
      return
    }
    
    const newRequest: SwapRequest = {
      id: `SWAP-${String(swapRequests.length + 1).padStart(3, '0')}`,
      requesterId: requester.id,
      requesterName: requester.name,
      targetId: target.id,
      targetName: target.name,
      requesterDate: swapForm.requesterDate,
      targetDate: swapForm.targetDate,
      requesterShift: swapForm.requesterShift,
      targetShift: swapForm.targetShift,
      reason: swapForm.reason,
      status: 'pending',
      requestDate: formatDateObj(new Date()),
    }
    
    setSwapRequests([...swapRequests, newRequest])
    setShowSwapModal(false)
    setSwapForm({
      requesterId: '',
      targetId: '',
      requesterDate: '',
      targetDate: '',
      requesterShift: 'morning',
      targetShift: 'morning',
      reason: '',
    })
  }
  
  // 处理换班审批
  const handleSwapApprove = (id: string, approved: boolean) => {
    setSwapRequests(requests => requests.map(r => {
      if (r.id === id) {
        return {
          ...r,
          status: approved ? 'approved' : 'rejected',
          approveDate: formatDateObj(new Date()),
          approverId: 'R001',
          approverName: '李明辉',
        }
      }
      return r
    }))
  }
  
  // 添加节假日
  const handleHolidaySubmit = () => {
    if (!holidayForm.date || !holidayForm.name) {
      setHolidayError('请填写完整信息')
      return
    }
    
    const existing = holidays.findIndex(h => h.date === holidayForm.date)
    if (existing >= 0) {
      const updated = [...holidays]
      updated[existing] = holidayForm
      setHolidays(updated)
    } else {
      setHolidays([...holidays, holidayForm])
    }
    
    setShowHolidayModal(false)
    setHolidayForm({ date: '', name: '', type: 'legal' })
  }
  
  // 删除节假日
  const handleHolidayDelete = (date: string) => {
    setHolidays(holidays.filter(h => h.date !== date))
  }
  
  // 获取某天的日期类型
  const getDateType = (date: Date): { isWeekend: boolean; isHoliday: boolean; isAdjustment: boolean; holidayName?: string } => {
    const dateStr = formatDateObj(date)
    const isWeekendDay = isWeekend(date)
    const holiday = holidays.find(h => h.date === dateStr)
    
    return {
      isWeekend: isWeekendDay,
      isHoliday: holiday?.type === 'legal' || false,
      isAdjustment: holiday?.type === 'adjustment' || false,
      holidayName: holiday?.name,
    }
  }

  // ============================================================
  // Phase 4b - 自动排班算法
  // ============================================================

  const runAutoSchedule = () => {
    setAutoRunning(true)
    setTimeout(() => {
      const weekDts = weekDates
      const result: AutoScheduleCandidate[][] = weekDts.map((date) => {
        const dateStr = formatDateObj(date)
        const dayOfWeek = date.getDay()
        const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6
        const holiday = holidays.find(h => h.date === dateStr)
        const isOffDay = holiday?.type === 'legal' || (isWeekendDay && holiday?.type !== 'adjustment')

        const assignments: AutoScheduleCandidate[] = STAFF_LIST
          .filter(s => s.role === 'technologist' || s.role === 'radiologist')
          .map(s => {
            const skills = STAFF_SKILLS[s.id] || []
            const shift: ShiftType = isOffDay ? 'off' : (dayOfWeek >= 5 ? ['morning', 'afternoon'][Math.floor(Math.random() * 2)] as ShiftType : ['morning', 'afternoon', 'fullday'][Math.floor(Math.random() * 3)] as ShiftType)
            const conflicts: string[] = []
            const existingLeave = leaveRequests.find(l => l.staffId === s.id && l.status === 'approved' && dateStr >= l.startDate && dateStr <= l.endDate)
            if (existingLeave) conflicts.push(`当日有请假(${existingLeave.type})`)
            if (isOffDay) conflicts.push('法定节假日/周末')
            return { staffId: s.id, staffName: s.name, shift, skillScore: skills.length * 20 + Math.random() * 10, conflicts }
          })
        return assignments
      })
      setAutoResult(result)
      setAutoRunning(false)
    }, 1200)
  }

  // ============================================================
  // Phase 4b - 模板处理
  // ============================================================

  const handleSaveTemplate = () => {
    if (!templateForm.name) return
    const newTpl: ShiftTemplate = {
      id: `TPL-${String(templates.length + 1).padStart(3, '0')}`,
      name: templateForm.name,
      description: templateForm.description,
      pattern: templateForm.shifts.length > 0 ? templateForm.shifts : STAFF_LIST.slice(0, 6).map(s => ({ staffId: s.id, shift: 'morning' as ShiftType, modality: 'CT' })),
      createdAt: formatDateObj(new Date()),
    }
    setTemplates([...templates, newTpl])
    setShowTemplateModal(false)
    setTemplateForm({ name: '', description: '', shifts: [] })
  }

  const handleDeleteTemplate = (id: string) => {
    setTemplates(templates.filter(t => t.id !== id))
  }

  const handleApplyTemplate = (tpl: ShiftTemplate) => {
    const newSchedules = [...allSchedules]
    tpl.pattern.forEach(p => {
      weekDates.forEach(d => {
        const ds = formatDateObj(d)
        const existing = newSchedules.findIndex(s => s.staffId === p.staffId && s.date === ds)
        if (existing >= 0) {
          const prev = newSchedules[existing]!
          newSchedules[existing] = { ...prev, shift: p.shift, modality: p.modality }
        }
      })
    })
    setAllSchedules(newSchedules)
    setAutoResult(t('schedulePage.templateApplied', { name: tpl.name, count: tpl.pattern.length }) as unknown as AutoScheduleCandidate[][])
  }

  // ============================================================
  // Phase 4b - 请假处理
  // ============================================================

  const handleLeaveSubmit = () => {
    const staff = STAFF_LIST.find(s => s.id === leaveForm.staffId)
    if (!staff || !leaveForm.startDate || !leaveForm.endDate) return
    const start = new Date(leaveForm.startDate)
    const end = new Date(leaveForm.endDate)
    const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1)
    const balance = leaveBalances.find(b => b.staffId === leaveForm.staffId)
    let available = 0
    if (leaveForm.type === 'annual') available = (balance?.annualTotal || 15) - (balance?.annualUsed || 0)
    else if (leaveForm.type === 'sick') available = (balance?.sickTotal || 10) - (balance?.sickUsed || 0)
    else available = (balance?.personalTotal || 5) - (balance?.personalUsed || 0)
    if (days > available) return

    const newLeave: LeaveRequestType = {
      id: `LV-${String(leaveRequests.length + 1).padStart(3, '0')}`,
      staffId: staff.id, staffName: staff.name,
      type: leaveForm.type,
      startDate: leaveForm.startDate, endDate: leaveForm.endDate,
      days, reason: leaveForm.reason,
      status: 'pending', balance: available,
      applyDate: formatDateObj(new Date()),
    }
    setLeaveRequests([...leaveRequests, newLeave])
    setShowLeaveModal(false)
    setLeaveForm({ staffId: '', type: 'annual', startDate: '', endDate: '', reason: '' })
  }

  const handleLeaveApprove = (id: string) => {
    setLeaveRequests(reqs => reqs.map(r => {
      if (r.id !== id) return r
      const lb = leaveBalances.find(b => b.staffId === r.staffId)
      if (lb) {
        const usedKey = r.type === 'annual' ? 'annualUsed' : r.type === 'sick' ? 'sickUsed' : 'personalUsed'
        setLeaveBalances(prev => prev.map(b => b.staffId === r.staffId ? { ...b, [usedKey]: b[usedKey] + r.days } : b))
      }
      return { ...r, status: 'approved' as const, approveDate: formatDateObj(new Date()), approverName: '李明辉' }
    }))
  }

  const handleLeaveReject = (id: string) => {
    setLeaveRequests(reqs => reqs.map(r => r.id === id ? { ...r, status: 'rejected' as const, approveDate: formatDateObj(new Date()), approverName: '李明辉' } : r))
  }

  // ============================================================
  // Phase 4b - 合规检查
  // ============================================================

  const runComplianceCheck = () => {
    const maxConsecutiveAlerts: ComplianceViolation[] = []
    const restPeriodViolations: ComplianceViolation[] = []
    const overtimeAlerts: ComplianceViolation[] = []

    STAFF_LIST.forEach(s => {
      let consecutive = 0
      weekDates.forEach(d => {
        const ds = formatDateObj(d)
        const sch = allSchedules.find(sc => sc.staffId === s.id && sc.date === ds)
        if (sch && sch.shift !== 'off') {
          consecutive++
          if (consecutive > COMPLIANCE_RULES.maxConsecutiveDays) {
            maxConsecutiveAlerts.push({ type: 'max_consecutive', staffName: s.name, date: ds, detail: `连续工作${consecutive}天超过${COMPLIANCE_RULES.maxConsecutiveDays}天上限`, severity: 'critical' })
          }
        } else {
          consecutive = 0
        }
      })
      const leave = leaveRequests.find(l => l.staffId === s.id && l.status === 'approved')
      if (leave && leave.days < 1) {
        restPeriodViolations.push({ type: 'rest_period', staffName: s.name, date: leave.startDate, detail: '请假期间休息不足', severity: 'warning' })
      }
    })

    weekDates.forEach(d => {
      const ds = formatDateObj(d)
      const daySch = allSchedules.filter(s => s.date === ds && s.shift !== 'off')
      if (daySch.length > 0) {
        if (daySch.length > STAFF_LIST.length * 0.5) {
          overtimeAlerts.push({ type: 'overtime', staffName: '多人', date: ds, detail: `当日排班人数${daySch.length}超过50%，存在加班风险`, severity: 'warning' })
        }
      }
    })

    const totalViolations = maxConsecutiveAlerts.length + restPeriodViolations.length + overtimeAlerts.length
    const score = Math.max(0, 100 - totalViolations * 15)
    setComplianceResult({ score, maxConsecutiveAlerts, restPeriodViolations, overtimeAlerts, violations: totalViolations })
  }

  // ============================================================
  // Phase 4b - 成本计算
  // ============================================================

  const calculateCosts = () => {
    const data: CostData[] = STAFF_LIST.slice(0, 8).map(s => {
      const schs = allSchedules.filter(sc => sc.staffId === s.id)
      const regularHours = schs.filter(sc => sc.shift !== 'off').length * 8
      const overtimeHours = schs.filter(sc => sc.shift === 'fullday').length * 2
      const regCost = regularHours * PAY_RATES.regular
      const otCost = overtimeHours * PAY_RATES.overtime
      const diff = schs.reduce((sum, sc) => sum + (PAY_RATES.shiftDifferential[sc.shift] || 0) * 8, 0)
      return { staffId: s.id, staffName: s.name, regularHours, overtimeHours, regularCost: regCost, overtimeCost: otCost, shiftDifferential: diff, totalCost: regCost + otCost + diff }
    })
    setCostData(data)
  }

  return (
    <div data-testid="schedule-page" style={{ minHeight: '100vh', background: C.bg, padding: 20 }}>
      {loading && <LoadingBanner message={t('schedulePage.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 顶部标题栏 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 8,
        padding: '16px 20px',
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <CalendarClock size={28} style={{ color: C.primary }} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textDark, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {t('schedulePage.title')}
                <span style={{ fontSize: 11, fontWeight: 600, color: '#d97706', background: '#fffbeb', border: '1px solid #fcd34d', borderRadius: 10, padding: '2px 8px' }}>
                  {t('schedulePage.demoBadge')}
                </span>
              </h1>
              <p style={{ fontSize: 13, color: C.textMid, margin: '4px 0 0 0' }}>
                {t('schedulePage.subtitle')}
              </p>
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button style={btnStyle(C.primary)} onClick={() => setShowSwapModal(true)}>
              <ArrowRightLeft size={16} />
              {t('schedulePage.applySwap')}
            </button>
            <button style={btnStyle(C.accent)} onClick={() => setShowHolidayModal(true)}>
              <Calendar size={16} />
              {t('schedulePage.holidayConfig')}
            </button>
            <button style={btnStyle(C.textMid)} onClick={handleExport}>
              <Download size={16} />
              {t('schedulePage.exportSchedule')}
            </button>
          </div>
        </div>
      </div>
      
      {/* 标签页 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '8px 8px 0 0',
        padding: '0 20px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <TabBtn 
            label={t('schedulePage.tabSchedule')} 
            active={activeTab === 'schedule'} 
            onClick={() => setActiveTab('schedule')}
            icon={<Calendar size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabHoliday')} 
            active={activeTab === 'holiday'} 
            onClick={() => setActiveTab('holiday')}
            icon={<Settings size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabSwap')} 
            active={activeTab === 'swap'} 
            onClick={() => setActiveTab('swap')}
            icon={<ArrowRightLeft size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabStats')} 
            active={activeTab === 'stats'} 
            onClick={() => setActiveTab('stats')}
            icon={<BarChart3 size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabAuto')} 
            active={activeTab === 'auto'} 
            onClick={() => setActiveTab('auto')}
            icon={<Zap size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabTemplates')} 
            active={activeTab === 'templates'} 
            onClick={() => setActiveTab('templates')}
            icon={<CalendarDays size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabLeave')} 
            active={activeTab === 'leave'} 
            onClick={() => setActiveTab('leave')}
            icon={<UserPlus size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabCompliance')} 
            active={activeTab === 'compliance'} 
            onClick={() => setActiveTab('compliance')}
            icon={<Shield size={16} />}
          />
          <TabBtn 
            label={t('schedulePage.tabCost')} 
            active={activeTab === 'cost'} 
            onClick={() => setActiveTab('cost')}
            icon={<TrendingUp size={16} />}
          />
          {/* [v3.0.6.11-103 Wave 10] 重复页合并: 技师排班 (嵌入 TechSchedulePage) */}
          <TabBtn 
            label={t('schedulePage.tabTech')} 
            active={activeTab === 'tech'} 
            onClick={() => setActiveTab('tech')}
            icon={<CalendarClock size={16} />}
          />
        </div>
      </div>
      
      {/* 主内容区 */}
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '0 0 8px 8px',
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        minHeight: 600,
      }}>
        {/* ========== 排班表视图 ========== */}
        {activeTab === 'schedule' && (
          <div>
            {/* 筛选工具栏 */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 16,
              gap: 16,
            }}>
              <WeekNavigator 
                weekStart={currentWeekStart} 
                onPrev={goToPrevWeek}
                onNext={goToNextWeek}
                onToday={goToToday}
              />
              
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {/* 搜索框 */}
                <div style={{ position: 'relative' }}>
                  <Search size={16} style={{ 
                    position: 'absolute', 
                    left: 10, 
                    top: '50%', 
                    transform: 'translateY(-50%)',
                    color: C.textLight,
                  }} />
                  <input
                    type="text"
                    placeholder={t('schedulePage.searchStaffPlaceholder')}
                    value={searchKeyword}
                    onChange={e => setSearchKeyword(e.target.value)}
                    style={{
                      padding: '6px 12px 6px 32px',
                      border: `1px solid ${C.border}`,
                      borderRadius: 4,
                      fontSize: 13,
                      width: 160,
                      outline: 'none',
                    }}
                  />
                </div>
                
                {/* 设备类型筛选 */}
                <select
                  value={selectedModality}
                  onChange={e => setSelectedModality(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">{t('schedulePage.allModalities')}</option>
                  {MODALITY_LIST.map(m => (
                    <option key={m} value={m}>{MODALITY_CONFIG[m]?.label || m}</option>
                  ))}
                </select>
                
                {/* 人员筛选 */}
                <select
                  value={selectedStaff}
                  onChange={e => setSelectedStaff(e.target.value)}
                  style={{
                    padding: '6px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 4,
                    fontSize: 13,
                    outline: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <option value="all">{t('schedulePage.allStaff')}</option>
                  {STAFF_LIST.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>
            
            {/* 排班表 */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ 
                width: '100%', 
                borderCollapse: 'collapse',
                fontSize: 13,
              }}>
                <thead>
                  <tr style={{ background: C.bgLight }}>
                    <th style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderBottom: `2px solid ${C.border}`,
                      fontWeight: 600,
                      color: C.textDark,
                      width: 40,
                    }}>
                      <input
                        type="checkbox"
                        aria-label={t('schedulePage.selectAllStaff')}
                        checked={visibleStaff.length > 0 && visibleStaff.every(s => selectedStaffIds.has(s.id))}
                        onChange={(e) => setSelectedStaffIds(e.target.checked ? new Set(visibleStaff.map(s => s.id)) : new Set())}
                      />
                    </th>
                    <th style={{ 
                      padding: '10px 12px', 
                      textAlign: 'left',
                      borderBottom: `2px solid ${C.border}`,
                      fontWeight: 600,
                      color: C.textDark,
                      width: 120,
                    }}>
                      {t('schedulePage.thStaff')}
                    </th>
                    {weekDates.map((date, i) => {
                      const dateType = getDateType(date)
                      const bgColor = dateType.isHoliday ? C.dangerLight 
                        : dateType.isAdjustment ? C.successLight 
                        : dateType.isWeekend ? C.bgLight 
                        : 'var(--bg-card)'
                      
                      return (
                        <th key={i} style={{
                          padding: '10px 8px',
                          textAlign: 'center',
                          borderBottom: `2px solid ${C.border}`,
                          fontWeight: 600,
                          color: dateType.isHoliday ? C.danger : C.textDark,
                          background: bgColor,
                          minWidth: 100,
                        }}>
                          <div>{formatDateCht(date)}</div>
                          <div style={{ fontSize: 12, fontWeight: 400, marginTop: 2 }}>
                            {dateType.isHoliday && `(${dateType.holidayName})`}
                            {dateType.isAdjustment && t('schedulePage.workdayHint')}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {(selectedStaff === 'all' ? STAFF_LIST : STAFF_LIST.filter(s => s.id === selectedStaff)).map((staff, staffIdx) => (
                    <tr key={staff.id} style={{ 
                      background: selectedStaffIds.has(staff.id) ? 'var(--color-info-bg)' : staffIdx % 2 === 0 ? 'var(--bg-card)' : C.bgLight,
                    }}>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
                        <input
                          type="checkbox"
                          aria-label={`选择 ${staff.name}`}
                          checked={selectedStaffIds.has(staff.id)}
                          onChange={() => toggleStaffSelect(staff.id)}
                        />
                      </td>
                      <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
                        <div style={{ fontWeight: 500, color: C.textDark }}>{staff.name}</div>
                        <div style={{ fontSize: 12, color: C.textMid }}>{staff.title}</div>
                      </td>
                      {weekDates.map((date, dayIdx) => {
                        const dateStr = formatDateObj(date)
                        const schedule = filteredSchedules.find(
                          s => s.staffId === staff.id && s.date === dateStr
                        )
                        const dateType = getDateType(date)
                        const bgColor = dateType.isHoliday ? C.dangerLight + '50'
                          : dateType.isAdjustment ? C.successLight + '50'
                          : dateType.isWeekend && !dateType.isAdjustment ? C.bgLight
                          : 'var(--bg-card)'
                        
                        return (
                          <td key={dayIdx} style={{
                            padding: '8px',
                            textAlign: 'center',
                            borderBottom: `1px solid ${C.borderLight}`,
                            background: bgColor,
                          }}>
                            {schedule ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                                <ShiftBadge shift={schedule.shift} size="small" />
                                <ModalityBadge modality={schedule.modality} />
                              </div>
                            ) : (
                              <span style={{ color: C.textLight, fontSize: 12 }}>-</span>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {/* 班次图例 */}
            <div style={{
              marginTop: 16,
              padding: '12px 16px',
              background: C.bgLight,
              borderRadius: 6,
              display: 'flex',
              gap: 20,
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 12, color: C.textMid, fontWeight: 500 }}>{t('schedulePage.shiftLegend')}</span>
              {Object.entries(SHIFT_CONFIG).map(([key, config]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    padding: '2px 8px',
                    background: config.bg,
                    color: config.color,
                    borderRadius: 4,
                    fontSize: 12,
                  }}>
                    {config.icon}
                    {config.label}
                  </span>
                  <span style={{ fontSize: 12, color: C.textMid }}>{config.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* [W14-UX] 批量排班操作栏 */}
        {activeTab === 'schedule' && selectedStaffIds.size > 0 && (
          <BatchActionBar
            selectedCount={selectedStaffIds.size}
            onAction={handleBatchSchedule}
            onClear={() => setSelectedStaffIds(new Set())}
            actions={[
              { key: 'generate', label: t('schedulePage.batchGenerate'), icon: <Zap size={13} /> },
              { key: 'off', label: t('schedulePage.batchSetOff'), icon: <Coffee size={13} />, confirm: t('w14Ux.batch.confirm') },
              { key: 'export', label: t('w14Ux.batch.export'), icon: <Download size={13} /> },
            ]}
          />
        )}
        
        {/* ========== 节假日配置视图 ========== */}
        {activeTab === 'holiday' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.holidayTitle')}
              </h3>
              <button style={btnStyle(C.primary)} onClick={() => setShowHolidayModal(true)}>
                <Plus size={16} />
                {t('schedulePage.addHoliday')}
              </button>
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
              {/* 法定节假日 */}
              <div style={{
                padding: 16,
                background: C.bgLight,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <h4 style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: C.danger, 
                  margin: '0 0 12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: C.danger,
                  }} />
                  {t('schedulePage.legalHolidays')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {holidays.filter(h => h.type === 'legal').map(h => (
                    <div key={h.date} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: 4,
                      border: `1px solid ${C.border}`,
                    }}>
                      <div>
                        <span style={{ fontWeight: 500, color: C.textDark }}>{h.name}</span>
                        <span style={{ marginLeft: 12, color: C.textMid, fontSize: 13 }}>{h.date}</span>
                      </div>
                      <button 
                        onClick={() => handleHolidayDelete(h.date)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: C.danger,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {holidays.filter(h => h.type === 'legal').length === 0 && (
                    <div style={{ color: C.textLight, fontSize: 13, padding: 12, textAlign: 'center' }}>
                      {t('schedulePage.noLegalHolidays')}
                    </div>
                  )}
                </div>
              </div>
              
              {/* 调休工作日 */}
              <div style={{
                padding: 16,
                background: C.bgLight,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <h4 style={{ 
                  fontSize: 14, 
                  fontWeight: 600, 
                  color: C.success, 
                  margin: '0 0 12px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: C.success,
                  }} />
                  {t('schedulePage.adjustmentWorkdays')}
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {holidays.filter(h => h.type === 'adjustment').map(h => (
                    <div key={h.date} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: 4,
                      border: `1px solid ${C.border}`,
                    }}>
                      <div>
                        <span style={{ fontWeight: 500, color: C.textDark }}>{h.name}</span>
                        <span style={{ marginLeft: 12, color: C.textMid, fontSize: 13 }}>{h.date}</span>
                      </div>
                      <button 
                        onClick={() => handleHolidayDelete(h.date)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: C.danger,
                          cursor: 'pointer',
                          padding: 4,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  {holidays.filter(h => h.type === 'adjustment').length === 0 && (
                    <div style={{ color: C.textLight, fontSize: 13, padding: 12, textAlign: 'center' }}>
                      {t('schedulePage.noAdjustments')}
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            {/* 节假日说明 */}
            <div style={{
              marginTop: 20,
              padding: 16,
              background: C.infoLight,
              borderRadius: 6,
              border: `1px solid ${C.info}30`,
            }}>
              <h5 style={{ fontSize: 13, fontWeight: 600, color: C.info, margin: '0 0 8px 0' }}>
                {t('schedulePage.configNote')}
              </h5>
              <ul style={{ fontSize: 12, color: C.textMid, margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
                <li>{t('schedulePage.noteLegal')}</li>
                <li>{t('schedulePage.noteAdjustment')}</li>
                <li>{t('schedulePage.noteEffect')}</li>
              </ul>
            </div>
          </div>
        )}
        
        {/* ========== 换班申请视图 ========== */}
        {activeTab === 'swap' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.swapTitle')}
              </h3>
              <button style={btnStyle(C.primary)} onClick={() => setShowSwapModal(true)}>
                <Plus size={16} />
                {t('schedulePage.newRequest')}
              </button>
            </div>
            
            {/* 换班统计卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: t('schedulePage.allRequests'), value: swapRequests.length, color: C.primary },
                { label: t('schedulePage.pendingApproval'), value: swapRequests.filter(r => r.status === 'pending').length, color: C.warning },
                { label: t('schedulePage.approved'), value: swapRequests.filter(r => r.status === 'approved').length, color: C.success },
                { label: t('schedulePage.rejected'), value: swapRequests.filter(r => r.status === 'rejected').length, color: C.danger },
              ].map(stat => (
                <div key={stat.label} style={{
                  padding: 16,
                  background: 'var(--bg-card)',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  textAlign: 'center',
                }}>
                  <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>{stat.label}</div>
                </div>
              ))}
            </div>
            
            {/* 换班申请列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {swapRequests.map(request => (
                <div key={request.id} style={{
                  padding: 16,
                  background: 'var(--bg-card)',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  borderLeft: `4px solid ${
                    request.status === 'pending' ? C.warning 
                    : request.status === 'approved' ? C.success 
                    : C.danger
                  }`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontWeight: 600, color: C.textDark }}>
                          {request.requesterName}
                        </span>
                        <ArrowRightLeft size={16} style={{ color: C.textMid }} />
                        <span style={{ fontWeight: 600, color: C.textDark }}>
                          {request.targetName}
                        </span>
                        <StatusBadge status={request.status} />
                      </div>
                      
                      <div style={{ fontSize: 13, color: C.textMid, display: 'flex', gap: 20 }}>
                        <span>
                          {request.requesterName}：{request.requesterDate} 
                          <ShiftBadge shift={request.requesterShift} size="small" />
                        </span>
                        <span>
                          {request.targetName}：{request.targetDate}
                          <ShiftBadge shift={request.targetShift} size="small" />
                        </span>
                      </div>
                      
                      {request.reason && (
                        <div style={{ marginTop: 8, fontSize: 12, color: C.textMid }}>
                           {t('schedulePage.reasonPrefix', { reason: request.reason })}
                        </div>
                      )}
                      
                      <div style={{ marginTop: 8, fontSize: 12, color: C.textLight }}>
                        {t('schedulePage.applyTime', { time: request.requestDate })}
                        {request.approveDate && t('schedulePage.approveTime', { time: request.approveDate, name: request.approverName })}
                      </div>
                    </div>
                    
                    {request.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button 
                          onClick={() => handleSwapApprove(request.id, true)}
                          style={{
                            ...btnStyle(C.success),
                            padding: '6px 12px',
                            fontSize: 12,
                          }}
                        >
                          <Check size={14} />
                          {t('schedulePage.approve')}
                        </button>
                        <button 
                          onClick={() => handleSwapApprove(request.id, false)}
                          style={{
                            ...btnStyle(C.danger),
                            padding: '6px 12px',
                            fontSize: 12,
                          }}
                        >
                          <X size={14} />
                          {t('schedulePage.deny')}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {swapRequests.length === 0 && (
                <div style={{ 
                  textAlign: 'center', 
                  padding: 40, 
                  color: C.textLight,
                  fontSize: 14,
                }}>
                  {t('schedulePage.noSwapRequests')}
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* ========== 排班统计视图 ========== */}
        {activeTab === 'stats' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: '0 0 20px 0' }}>
              {t('schedulePage.statsTitle')}
            </h3>
            
            {/* 统计卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: t('schedulePage.totalShifts'), value: allSchedules.length, icon: <Calendar size={20} />, color: C.primary },
                { label: t('schedulePage.attendanceCount'), value: allSchedules.filter(s => s.shift !== 'off').length, icon: <CheckCircle size={20} />, color: C.success },
                { label: t('schedulePage.restCount'), value: allSchedules.filter(s => s.shift === 'off').length, icon: <Coffee size={20} />, color: C.warning },
                { label: t('schedulePage.swapCount'), value: swapRequests.length, icon: <ArrowRightLeft size={20} />, color: C.accent },
              ].map(stat => (
                <div key={stat.label} style={{
                  padding: 16,
                  background: 'var(--bg-card)',
                  borderRadius: 8,
                  border: `1px solid ${C.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}>
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: 8,
                    background: stat.color + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                  }}>
                    {stat.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              {/* 个人出勤统计 */}
              <div style={{
                padding: 16,
                background: C.bgLight,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 16px 0' }}>
                  {t('schedulePage.staffStats')}
                </h4>
                <div style={{ maxHeight: 300, overflowY: 'auto' }}>
                  {stats.staffStats.map((stat, idx) => (
                    <div key={stat.staffId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: 'var(--bg-card)',
                      borderRadius: 6,
                      marginBottom: 8,
                      gap: 12,
                    }}>
                      <div style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: C.primaryLighter,
                        color: C.primary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {idx + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 500, color: C.textDark, fontSize: 13 }}>{stat.staffName}</div>
                        <div style={{ fontSize: 12, color: C.textMid }}>{stat.title}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <span style={{
                          padding: '2px 6px',
                          background: C.successLight,
                          color: C.success,
                          borderRadius: 4,
                          fontSize: 12,
                        }}>
                          {t('schedulePage.attendanceDays', { count: stat.totalShifts })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* 班次分布饼图 */}
              <div style={{
                padding: 16,
                background: C.bgLight,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 16px 0' }}>
                  {t('schedulePage.shiftDistribution')}
                </h4>
                <ChartContainer height={260} state={stats.shiftDistribution.length === 0 ? 'empty' : 'ready'} emptyDescription={t('schedulePage.noDistributionData')}>
                  <RePieChart>
                    <Pie
                      data={stats.shiftDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {stats.shiftDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </RePieChart>
                </ChartContainer>
              </div>
              
              {/* 设备利用率 */}
              <div style={{
                padding: 16,
                background: C.bgLight,
                borderRadius: 8,
                border: `1px solid ${C.border}`,
                gridColumn: 'span 2',
              }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 16px 0' }}>
                  {t('schedulePage.modalityDist')}
                </h4>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
                  {stats.modalityUtilization.map(mod => (
                    <div key={mod.modality} style={{
                      padding: 16,
                      background: 'var(--bg-card)',
                      borderRadius: 8,
                      textAlign: 'center',
                    }}>
                      <div style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: (MODALITY_CONFIG[mod.modality]?.color || '#6b7280') + '20',
                        color: MODALITY_CONFIG[mod.modality]?.color || '#6b7280',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 8px',
                        fontSize: 18,
                        fontWeight: 700,
                      }}>
                        {mod.label.slice(0, 2)}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{mod.label}</div>
                      <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>
                        {t('schedulePage.personTimes', { count: mod.count })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ========== 智能排班视图 ========== */}
        {activeTab === 'auto' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.autoTitle')}
              </h3>
              <button
                onClick={runAutoSchedule}
                disabled={autoRunning}
                style={{
                  ...btnStyle(autoRunning ? C.textLight : C.primary),
                  opacity: autoRunning ? 0.6 : 1,
                }}
              >
                <Zap size={16} />
                {autoRunning ? t('schedulePage.scheduling') : t('schedulePage.generateAuto')}
              </button>
            </div>

            {/* 技能矩阵 */}
            <div style={{ marginBottom: 20, padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 12px 0' }}>{t('schedulePage.skillMatrix')}</h4>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {STAFF_LIST.slice(0, 10).map(s => (
                  <div key={s.id} style={{ padding: '8px 12px', background: 'var(--bg-card)', borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>
                      {(STAFF_SKILLS[s.id] || []).join(' · ') || t('schedulePage.noCert')}
                    </div>
                    <div style={{ fontSize: 12, color: C.success, marginTop: 2 }}>{t('schedulePage.skillPoints', { count: (STAFF_SKILLS[s.id]?.length || 0) * 20 })}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* 排班结果 */}
            {autoRunning && (
              <div style={{ textAlign: 'center', padding: 40, color: C.textMid }}>
                <RefreshCw size={32} style={{ animation: 'spin 1s linear infinite', marginBottom: 12 }} />
                <div>{t('schedulePage.runningAlgorithm')}</div>
              </div>
            )}
            {autoResult && !autoRunning && (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: C.bgLight }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thStaff')}</th>
                      {weekDates.map((d, i) => (
                        <th key={i} style={{ padding: '10px 8px', textAlign: 'center', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark, minWidth: 100 }}>
                          {formatDateCht(d)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {autoResult[0]?.map((cand, si) => (
                      <tr key={cand.staffId} style={{ background: si % 2 === 0 ? 'var(--bg-card)' : C.bgLight }}>
                        <td style={{ padding: '10px 12px', borderBottom: `1px solid ${C.borderLight}` }}>
                          <div style={{ fontWeight: 500, color: C.textDark }}>{cand.staffName}</div>
                          <div style={{ fontSize: 12, color: C.textLight }}>{t('schedulePage.scoreLabel', { score: cand.skillScore.toFixed(0) })}</div>
                        </td>
                        {autoResult.map((day, di) => {
                          const dayCand = day[si]
                          return (
                            <td key={di} style={{ padding: 8, textAlign: 'center', borderBottom: `1px solid ${C.borderLight}` }}>
                              {dayCand && dayCand.shift !== 'off' ? (
                                <div>
                                  <ShiftBadge shift={dayCand.shift} size="small" />
                                  {dayCand.conflicts.length > 0 && (
                                    <div style={{ fontSize: 12, color: C.danger, marginTop: 2 }}>{dayCand.conflicts[0]}</div>
                                  )}
                                </div>
                              ) : (
                                <span style={{ color: C.textLight, fontSize: 12 }}>{t('schedulePage.rest')}</span>
                              )}
                            </td>
                          )
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ========== 班次模板视图 ========== */}
        {activeTab === 'templates' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.templatesTitle')}
              </h3>
              <button style={btnStyle(C.primary)} onClick={() => setShowTemplateModal(true)}>
                <Plus size={16} />
                {t('schedulePage.newTemplate')}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
              {templates.map(tpl => (
                <div key={tpl.id} style={{ padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: C.textDark }}>{tpl.name}</div>
                      <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{tpl.description}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleApplyTemplate(tpl)} style={{ ...btnStyle(C.success), padding: '4px 8px', fontSize: 12 }} title={t('schedulePage.applyToWeek')}>
                        <CalendarDays size={14} />
                      </button>
                      <button onClick={() => handleDeleteTemplate(tpl.id)} style={{ ...btnStyle(C.danger), padding: '4px 8px', fontSize: 12 }} title={t('schedulePage.deleteTitle')}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: C.textLight }}>
                    {t('schedulePage.createdAt', { date: tpl.createdAt, count: tpl.pattern.length })}
                  </div>
                  <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {tpl.pattern.slice(0, 6).map((p, i) => {
                      const staff = STAFF_LIST.find(s => s.id === p.staffId)
                      return (
                        <span key={i} style={{ padding: '2px 6px', background: 'var(--bg-card)', borderRadius: 4, fontSize: 12, border: `1px solid ${C.borderLight}` }}>
                          {staff?.name || p.staffId}:{SHIFT_CONFIG[p.shift]?.label?.slice(0, 2) || p.shift}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ========== 请假管理视图 ========== */}
        {activeTab === 'leave' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.leaveTitle')}
              </h3>
              <button style={btnStyle(C.primary)} onClick={() => setShowLeaveModal(true)}>
                <Plus size={16} />
                {t('schedulePage.newLeave')}
              </button>
            </div>

            {/* 余额概览 */}
            <div style={{ marginBottom: 20, padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}` }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 12px 0' }}>{t('schedulePage.leaveBalance')}</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {leaveBalances.slice(0, 8).map(lb => (
                  <div key={lb.staffId} style={{ padding: 12, background: 'var(--bg-card)', borderRadius: 6, border: `1px solid ${C.borderLight}` }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: C.textDark }}>{lb.staffName}</div>
                    <div style={{ fontSize: 12, color: C.textMid, marginTop: 4, display: 'flex', gap: 8 }}>
                      <span>{t('schedulePage.annualLeave')} {lb.annualUsed}/{lb.annualTotal}</span>
                      <span>{t('schedulePage.sickLeave')} {lb.sickUsed}/{lb.sickTotal}</span>
                      <span>{t('schedulePage.personalLeave')} {lb.personalUsed}/{lb.personalTotal}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 请假列表 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {leaveRequests.map(lr => {
                const statusCfg = { pending: { label: t('schedulePage.leavePending'), color: C.warning, bg: C.warningLight }, approved: { label: t('schedulePage.leaveApproved'), color: C.success, bg: C.successLight }, rejected: { label: t('schedulePage.leaveRejected'), color: C.danger, bg: C.dangerLight } }[lr.status]
                return (
                  <div key={lr.id} style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 8, border: `1px solid ${C.border}`, borderLeft: `4px solid ${statusCfg.color}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                          <span style={{ fontWeight: 600, color: C.textDark }}>{lr.staffName}</span>
                          <span style={{ padding: '2px 8px', background: C.primaryLighter, color: C.primary, borderRadius: 4, fontSize: 12 }}>
                            {lr.type === 'annual' ? t('schedulePage.annualLeave') : lr.type === 'sick' ? t('schedulePage.sickLeave') : t('schedulePage.personalLeave')}
                          </span>
                          <span style={{ padding: '2px 8px', background: statusCfg.bg, color: statusCfg.color, borderRadius: 4, fontSize: 12 }}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: C.textMid }}>
                          {t('schedulePage.leaveDays', { start: lr.startDate, end: lr.endDate, count: lr.days })}
                        </div>
                        {lr.reason && <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>{t('schedulePage.leaveReason', { reason: lr.reason })}</div>}
                        <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>
                          {t('schedulePage.leaveApplyTime', { time: lr.applyDate })}{lr.approveDate && t('schedulePage.leaveApproveTime', { time: lr.approveDate, name: lr.approverName })}
                        </div>
                      </div>
                      {lr.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => handleLeaveApprove(lr.id)} style={{ ...btnStyle(C.success), padding: '6px 12px', fontSize: 12 }}>
                            <Check size={14} />{t('schedulePage.approveLeave')}
                          </button>
                          <button onClick={() => handleLeaveReject(lr.id)} style={{ ...btnStyle(C.danger), padding: '6px 12px', fontSize: 12 }}>
                            <X size={14} />{t('schedulePage.rejectLeave')}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ========== 合规检查视图 ========== */}
        {activeTab === 'compliance' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.complianceTitle')}
              </h3>
              <button style={btnStyle(complianceResult ? C.accent : C.primary)} onClick={runComplianceCheck}>
                <Shield size={16} />
                {complianceResult ? t('schedulePage.recheck') : t('schedulePage.runCheck')}
              </button>
            </div>

            {complianceResult ? (
              <div>
                {/* 合规分数 */}
                <div style={{
                  textAlign: 'center', padding: 32, marginBottom: 20,
                  background: complianceResult.score >= 80 ? C.successLight : complianceResult.score >= 50 ? C.warningLight : C.dangerLight,
                  borderRadius: 12, border: `2px solid ${complianceResult.score >= 80 ? C.success : complianceResult.score >= 50 ? C.warning : C.danger}`,
                }}>
                  <div style={{ fontSize: 48, fontWeight: 700, color: complianceResult.score >= 80 ? C.success : complianceResult.score >= 50 ? C.warning : C.danger }}>
                    {complianceResult.score}%
                  </div>
                  <div style={{ fontSize: 14, color: C.textMid, marginTop: 8 }}>
                    {t('schedulePage.complianceScore')}
                    {complianceResult.score >= 80 ? t('schedulePage.scoreGood') : complianceResult.score >= 50 ? t('schedulePage.scoreImprove') : t('schedulePage.scoreFail')}
                  </div>
                  <div style={{ fontSize: 12, color: C.textLight, marginTop: 4 }}>
                    {t('schedulePage.violationsFound', { count: complianceResult.violations })}
                  </div>
                </div>

                {/* 违规详情 */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                  {[
                    { title: t('schedulePage.violMaxConsecutive'), data: complianceResult.maxConsecutiveAlerts, icon: <AlertCircle size={16} />, color: C.danger },
                    { title: t('schedulePage.violRestPeriod'), data: complianceResult.restPeriodViolations, icon: <Coffee size={16} />, color: C.warning },
                    { title: t('schedulePage.violOvertime'), data: complianceResult.overtimeAlerts, icon: <TrendingUp size={16} />, color: C.info },
                  ].map(section => (
                    <div key={section.title} style={{ padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}` }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: section.color, margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                        {section.icon}
                        {section.title}
                        <span style={{ fontSize: 12, color: C.textLight, fontWeight: 400 }}>{t('schedulePage.violCount', { count: section.data.length })}</span>
                      </h4>
                      {section.data.length === 0 ? (
                        <div style={{ fontSize: 12, color: C.success, fontStyle: 'italic' }}>{t('schedulePage.noViolations')}</div>
                      ) : (
                        section.data.slice(0, 5).map((v, i) => (
                          <div key={i} style={{ padding: '6px 8px', background: 'var(--bg-card)', borderRadius: 4, marginBottom: 4, fontSize: 12, color: C.textMid, border: `1px solid ${C.borderLight}` }}>
                            <span style={{ fontWeight: 500, color: C.textDark }}>{v.staffName}</span> · {v.date}<br />
                            {v.detail}
                          </div>
                        ))
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: 60, color: C.textLight }}>
                <Shield size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
                <div style={{ fontSize: 14 }}>{t('schedulePage.complianceHint')}</div>
              </div>
            )}
          </div>
        )}

        {/* ========== 成本分析视图 ========== */}
        {activeTab === 'cost' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.costTitle')}
              </h3>
              <button style={btnStyle(C.primary)} onClick={calculateCosts}>
                <DollarSign size={16} />
                {t('schedulePage.calcCost')}
              </button>
            </div>

            {/* 成本卡片 */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
              {[
                { label: t('schedulePage.totalLaborCost'), value: `¥${(costData.reduce((s, c) => s + c.totalCost, 0) / 10000).toFixed(2)}万`, color: C.primary, icon: DollarSign },
                { label: t('schedulePage.overtimeShare'), value: costData.length > 0 ? `${((costData.reduce((s, c) => s + c.overtimeCost, 0) / costData.reduce((s, c) => s + c.totalCost, 1)) * 100).toFixed(1)}%` : '-', color: C.warning, icon: TrendingUp },
                { label: t('schedulePage.avgShiftCost'), value: costData.length > 0 ? `¥${Math.round(costData.reduce((s, c) => s + c.totalCost, 0) / costData.length)}` : '-', color: C.info, icon: Clock },
                { label: t('schedulePage.monthlyTrend'), value: `${costTrend.length}个月`, color: C.accent, icon: Calendar },
              ].map(stat => (
                <div key={stat.label} style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 8, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: stat.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                    <stat.icon size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                    <div style={{ fontSize: 12, color: C.textMid }}>{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* 月度成本趋势图 */}
            {costTrend.length > 0 && (
              <div style={{ padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}`, marginBottom: 20 }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 16px 0' }}>{t('schedulePage.costTrendTitle')}</h4>
                <ChartContainer height={280} state={costTrend.length === 0 ? 'empty' : 'ready'} emptyDescription={t('schedulePage.noCostData')}>
                  <BarChart data={costTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(v: number) => `¥${v.toLocaleString()}`} />
                    <Legend />
                    <Bar dataKey="regular" name={t('schedulePage.costRegular')} fill={C.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="overtime" name={t('schedulePage.costOvertime')} fill={C.warning} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="differential" name={t('schedulePage.costDifferential')} fill={C.accent} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}

            {/* 个人成本明细 */}
            {costData.length > 0 && (
              <div style={{ padding: 16, background: C.bgLight, borderRadius: 8, border: `1px solid ${C.border}` }}>
                <h4 style={{ fontSize: 14, fontWeight: 600, color: C.textDark, margin: '0 0 12px 0' }}>{t('schedulePage.costDetail')}</h4>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead>
                      <tr style={{ background: 'var(--bg-card)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thName')}</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thRegularHours')}</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thOvertimeHours')}</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thRegularCost')}</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thOvertimeCost')}</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thDifferential')}</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', borderBottom: `2px solid ${C.border}`, fontWeight: 600, color: C.textDark }}>{t('schedulePage.thTotal')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {costData.map((c, i) => (
                        <tr key={c.staffId} style={{ background: i % 2 === 0 ? 'var(--bg-card)' : C.bgLight }}>
                          <td style={{ padding: '8px 12px', borderBottom: `1px solid ${C.borderLight}`, fontWeight: 500, color: C.textDark }}>{c.staffName}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${C.borderLight}`, color: C.textMid }}>{c.regularHours}h</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${C.borderLight}`, color: C.warning }}>{c.overtimeHours}h</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${C.borderLight}`, color: C.textMid }}>¥{c.regularCost.toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${C.borderLight}`, color: C.warning }}>¥{c.overtimeCost.toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${C.borderLight}`, color: C.accent }}>¥{c.shiftDifferential.toLocaleString()}</td>
                          <td style={{ padding: '8px 12px', textAlign: 'right', borderBottom: `1px solid ${C.borderLight}`, fontWeight: 700, color: C.primary }}>¥{c.totalCost.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* [v3.0.6.11-103 Wave 10] 重复页合并: 技师排班视图 = 嵌入 TechSchedulePage */}
        {activeTab === 'tech' && <TechSchedulePage />}
      </div>
      
      {/* ========== 换班申请弹窗 ========== */}
      {showSwapModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            padding: 24,
            width: 480,
            maxHeight: '80vh',
            overflowY: 'auto',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.applySwap')}
              </h3>
              <button onClick={() => setShowSwapModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} style={{ color: C.textMid }} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {swapError && <div style={{ color: '#dc2626', fontSize: 13, padding: '8px 12px', background: 'var(--color-error-bg)', borderRadius: 6, border: '1px solid #fca5a5' }}>{swapError}</div>}
              {/* 申请人 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.requester')}
                </label>
                <select
                  value={swapForm.requesterId}
                  onChange={e => setSwapForm({ ...swapForm, requesterId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="">{t('w9b.schedule.selectApplicant')}</option>
                  {STAFF_LIST.map(s => (
                    <option key={s.id} value={s.id}>{s.name}（{s.title}）</option>
                  ))}
                </select>
              </div>
              
              {/* 申请人班次日期 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.requesterDate')}
                </label>
                <input
                  type="date"
                  value={swapForm.requesterDate}
                  onChange={e => setSwapForm({ ...swapForm, requesterDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              
              {/* 申请人班次类型 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.requesterShift')}
                </label>
                <select
                  value={swapForm.requesterShift}
                  onChange={e => setSwapForm({ ...swapForm, requesterShift: e.target.value as ShiftType })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  {Object.entries(SHIFT_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}（{config.time}）</option>
                  ))}
                </select>
              </div>
              
              <div style={{ textAlign: 'center', color: C.textMid }}>
                <ArrowRightLeft size={20} />
              </div>
              
              {/* 被换班人 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.targetStaff')}
                </label>
                <select
                  value={swapForm.targetId}
                  onChange={e => setSwapForm({ ...swapForm, targetId: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="">{t('schedulePage.selectTarget')}</option>
                  {STAFF_LIST.filter(s => s.id !== swapForm.requesterId).map(s => (
                    <option key={s.id} value={s.id}>{s.name}（{s.title}）</option>
                  ))}
                </select>
              </div>
              
              {/* 被换班人班次日期 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.targetDate')}
                </label>
                <input
                  type="date"
                  value={swapForm.targetDate}
                  onChange={e => setSwapForm({ ...swapForm, targetDate: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              
              {/* 被换班人班次类型 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.targetShift')}
                </label>
                <select
                  value={swapForm.targetShift}
                  onChange={e => setSwapForm({ ...swapForm, targetShift: e.target.value as ShiftType })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  {Object.entries(SHIFT_CONFIG).map(([key, config]) => (
                    <option key={key} value={key}>{config.label}（{config.time}）</option>
                  ))}
                </select>
              </div>
              
              {/* 换班原因 */}
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.swapReason')}
                </label>
                <textarea
                  value={swapForm.reason}
                  onChange={e => setSwapForm({ ...swapForm, reason: e.target.value })}
                  placeholder={t('schedulePage.placeholderSwapReason')}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button 
                  onClick={() => setShowSwapModal(false)}
                  style={{
                    padding: '8px 20px',
                    background: C.bgLight,
                    color: C.textMid,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {t('schedulePage.cancel')}
                </button>
                <button 
                  onClick={handleSwapSubmit}
                  style={{
                    padding: '8px 20px',
                    background: C.primary,
                    color: C.white,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {t('schedulePage.submitRequest')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ========== 节假日配置弹窗 ========== */}
      {showHolidayModal && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: 12,
            padding: 24,
            width: 400,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>
                {t('schedulePage.addHoliday')}
              </h3>
              <button onClick={() => setShowHolidayModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} style={{ color: C.textMid }} />
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.holidayDate')}
                </label>
                <input
                  type="date"
                  value={holidayForm.date}
                  onChange={e => setHolidayForm({ ...holidayForm, date: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.holidayName')}
                </label>
                <input
                  type="text"
                  value={holidayForm.name}
                  onChange={e => setHolidayForm({ ...holidayForm, name: e.target.value })}
                  placeholder={t('schedulePage.placeholderHolidayName')}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>
                  {t('schedulePage.holidayType')}
                </label>
                <select
                  value={holidayForm.type}
                  onChange={e => setHolidayForm({ ...holidayForm, type: e.target.value as 'legal' | 'adjustment' })}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    fontSize: 13,
                    outline: 'none',
                  }}
                >
                  <option value="legal">{t('schedulePage.legalHolidays')}</option>
                  <option value="adjustment">{t('schedulePage.adjustmentWorkdays')}</option>
                </select>
              </div>
              
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button 
                  onClick={() => setShowHolidayModal(false)}
                  style={{
                    padding: '8px 20px',
                    background: C.bgLight,
                    color: C.textMid,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                  }}
                >
                  {t('schedulePage.cancel')}
                </button>
                <button 
                  onClick={handleHolidaySubmit}
                  style={{
                    padding: '8px 20px',
                    background: C.primary,
                    color: C.white,
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: 500,
                  }}
                >
                  {t('schedulePage.save')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 新建模板弹窗 ========== */}
      {showTemplateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>{t('schedulePage.newTemplateTitle')}</h3>
              <button onClick={() => setShowTemplateModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} style={{ color: C.textMid }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.templateName')}</label>
                <input type="text" value={templateForm.name} onChange={e => setTemplateForm({ ...templateForm, name: e.target.value })}
                  placeholder={t('schedulePage.placeholderTemplateName')} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.templateDesc')}</label>
                <input type="text" value={templateForm.description} onChange={e => setTemplateForm({ ...templateForm, description: e.target.value })}
                  placeholder={t('schedulePage.placeholderTemplateDesc')} style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }} />
              </div>
              <div style={{ fontSize: 12, color: C.textLight, padding: 8, background: C.bgLight, borderRadius: 6 }}>
                {t('schedulePage.templateHint')}
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowTemplateModal(false)} style={{ padding: '8px 20px', background: C.bgLight, color: C.textMid, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>{t('schedulePage.cancel')}</button>
                <button onClick={handleSaveTemplate} style={{ padding: '8px 20px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Save size={13} />{t('schedulePage.saveTemplate')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 请假申请弹窗 ========== */}
      {showLeaveModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
        }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>{t('schedulePage.newLeave')}</h3>
              <button onClick={() => setShowLeaveModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} style={{ color: C.textMid }} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.leaveApplicant')}</label>
                <select value={leaveForm.staffId} onChange={e => setLeaveForm({ ...leaveForm, staffId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}>
                  <option value="">{t('schedulePage.selectRequester')}</option>
                  {STAFF_LIST.map(s => (
                    <option key={s.id} value={s.id}>{s.name}（{s.title}）</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.leaveType')}</label>
                <select value={leaveForm.type} onChange={e => setLeaveForm({ ...leaveForm, type: e.target.value as 'annual' | 'sick' | 'personal' })}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }}>
                  <option value="annual">{t('schedulePage.annualLeave')}</option>
                  <option value="sick">{t('schedulePage.sickLeave')}</option>
                  <option value="personal">{t('schedulePage.personalLeave')}</option>
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.leaveStartDate')}</label>
                  <input type="date" value={leaveForm.startDate} onChange={e => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.leaveEndDate')}</label>
                  <input type="date" value={leaveForm.endDate} onChange={e => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none' }} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 13, color: C.textMid, marginBottom: 6 }}>{t('schedulePage.leaveReasonLabel')}</label>
                <textarea value={leaveForm.reason} onChange={e => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder={t('schedulePage.placeholderLeaveReason')} rows={3}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, outline: 'none', resize: 'vertical' }} />
              </div>
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 8 }}>
                <button onClick={() => setShowLeaveModal(false)} style={{ padding: '8px 20px', background: C.bgLight, color: C.textMid, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>{t('schedulePage.cancel')}</button>
                <button onClick={handleLeaveSubmit} style={{ padding: '8px 20px', background: C.primary, color: C.white, border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}><Send size={13} />{t('schedulePage.submitRequest')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 导出排班弹窗 ========== */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: C.textDark, margin: 0 }}>{t('schedulePage.exportTitle')}</h3>
              <button onClick={() => setShowExportModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={20} style={{ color: C.textMid }} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: C.textMid, marginBottom: 12 }}>
              {exportProgress < 100 ? t('schedulePage.exportProgressMsg', { count: allSchedules.length }) : t('schedulePage.exportDoneMsg')}
            </div>
            <div style={{ height: 8, background: C.bgLight, borderRadius: 4, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ width: `${exportProgress}%`, height: '100%', background: C.primary, borderRadius: 4, transition: 'width 0.15s ease-out' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              {exportProgress >= 100 ? (
                <button onClick={() => setShowExportModal(false)} style={btnStyle(C.primary)}>{t('schedulePage.close')}</button>
              ) : (
                <button onClick={() => setShowExportModal(false)} style={{ padding: '6px 10px', background: C.bgLight, color: C.textMid, border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 13 }}>{t('schedulePage.cancel')}</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
