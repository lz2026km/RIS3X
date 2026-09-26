// ============================================================
// G005 放射科RIS系统 - 首页 v1.0.0
// 放射科信息管理系统 - 汉东省人民医院
// ============================================================
import { useState, useEffect, useCallback, type FC } from 'react'

const HOSPITAL_NAME = (typeof window !== 'undefined' && (window as unknown as { __HOSPITAL_NAME__?: string }).__HOSPITAL_NAME__) || '汉东省人民医院'
const today = new Date()
const BUILD_DATE = today.toLocaleDateString('zh-CN')
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import {
  Activity, FileText, AlertTriangle,
  TrendingUp, Clock, CheckCircle, BarChart3, Calendar,
  Scan, Radio, Monitor, CalendarClock,
  ShieldAlert, AlertCircle, ListChecks,
  LayoutDashboard, Settings,
  DollarSign,
  Image, BookOpen, Eye, Timer, ImageIcon,
  UserCheck, ClipboardList, CheckSquare,
  // [v3.0.6.11-99 Wave10B] 首页深化: 工作清单/科室动态/快捷增强/趋势细化/绩效卡/数据源徽标
  Megaphone, Users, UserPlus, Target, CalendarRange,
  Stethoscope, Crosshair, ClipboardPlus, Sparkles, Award,
  Gauge, Database, FileCheck2, RefreshCcw
} from 'lucide-react'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area
} from 'recharts'
import {
  initialRadiologyExams,
  initialModalityDevices,
  initialCriticalValues,
  initialDoctorSchedules,
  initialUsers,
  initialExamRooms
} from '../data/initialData'
import { list } from '../services/mockBackend/store'
import { statsApi } from '../services/api'
import { biApi } from '../services/api/biApi'
import { reportApi } from '../services/api/reportApi'
import { worklistApi } from '../services/api/worklistApi'
import { deptApi, type DeptAnnouncement, type OnCallSchedule } from '../services/api/deptApi'
import { criticalApi } from '../services/api/criticalApi'
import { PageContainer } from '../components/common/PageContainer'
import { t } from '../i18n/appI18n'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { ChartContainer } from '../components/charts'
// [v3.0.6.11-103 Wave 5] 放射专业主题组件接入
import { PageHeader } from '../components/common/PageHeader'
import { StatCard as KpiCard, EmptyState } from '../components/common'
import {
  IconScanning, IconPending, IconNormal, IconCritical,
  IconDr, IconXRayBeam, IconReview, IconRadiationSign,
} from '../components/icons/radiologyIcons'

// ============================================================
// 样式常量
// ============================================================
const COLORS = {
  // 主题化: 全部指向 design-system 主题变量, 浅色/深色/高对比自动跟随 (data-theme)
  primary: 'var(--color-accent)',
  primaryLight: 'var(--color-primary-600)',
  primaryDark: 'var(--color-primary-800)',
  white: '#ffffff', // 仅用于品牌渐变/警示色背景上的文字
  background: 'var(--bg-deep)', // 次级面板底色
  text: 'var(--text-primary)',
  textMuted: 'var(--text-secondary)',
  textLight: 'var(--text-muted)',
  border: 'var(--border-color)',
  success: 'var(--color-success)',
  successBg: 'var(--color-success-bg)',
  warning: 'var(--color-warning)',
  warningBg: 'var(--color-warning-bg)',
  danger: 'var(--color-error)',
  dangerBg: 'var(--color-error-bg)',
  info: 'var(--color-info)',
  infoBg: 'var(--color-info-bg)',
  purple: 'var(--color-modality-mr)',
  purpleBg: 'rgba(139, 92, 246, 0.12)',
}

const MODALITY_COLORS: Record<string, string> = {
  CT: '#3b82f6',
  MR: '#8b5cf6',
  DR: '#22c55e',
  DSA: '#f59e0b',
  'MG': '#ec4899',
  'GI': '#14b8a6',
  PET: '#f97316'
}

// [v3.0.6.11-99 Wave10B] 近 7 日模态堆叠回退数据 (模块级常量, 避免 TDZ)
const MODAL_STACK_FALLBACK: Array<Record<string, string | number>> = [
  { day: '周一', CT: 98, MR: 45, DR: 85, DSA: 8, MG: 5, 合计: 241 },
  { day: '周二', CT: 105, MR: 52, DR: 90, DSA: 10, MG: 6, 合计: 263 },
  { day: '周三', CT: 112, MR: 48, DR: 78, DSA: 12, MG: 8, 合计: 258 },
  { day: '周四', CT: 95, MR: 55, DR: 82, DSA: 9, MG: 5, 合计: 246 },
  { day: '周五', CT: 108, MR: 50, DR: 88, DSA: 11, MG: 7, 合计: 264 },
  { day: '周六', CT: 60, MR: 25, DR: 40, DSA: 3, MG: 3, 合计: 131 },
  { day: '周日', CT: 30, MR: 10, DR: 20, DSA: 1, MG: 1, 合计: 62 },
]

// 通用卡片样式
const cardStyle: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 12,
  padding: 20,
  boxShadow: 'var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.06))',
  border: `1px solid ${COLORS.border}`,
}

// 卡片标题头样式
const headerStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: `1px solid ${COLORS.border}`,
}

// 卡片标题样式
const cardTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: COLORS.primary,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
}

// 徽章样式
const badgeStyle: React.CSSProperties = {
  padding: '2px 10px',
  borderRadius: 10,
  fontSize: 12,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
}

// ============================================================
// 类型定义
// ============================================================
interface QuickActionProps {
  icon: React.ReactNode
  label: string
  color: string
  bg: string
  badge?: string
  badgeColor?: string
  onClick?: () => void
}

// ============================================================
// 子组件：快捷入口按钮
// ============================================================
const QuickActionButton: React.FC<QuickActionProps> = ({
  icon, label, color, bg, badge, badgeColor, onClick
}) => {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'var(--bg-card)',
        borderRadius: 12,
        padding: '16px 12px',
        boxShadow: hovered ? '0 8px 24px rgba(0,0,0,0.1)' : '0 1px 4px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        transition: 'all 0.25s ease',
        border: `1px solid ${hovered ? color : COLORS.border}`,
        transform: hovered ? 'translateY(-4px)' : 'translateY(0)',
        position: 'relative',
        overflow: 'hidden',
        color: 'inherit',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {badge && (
        <div style={{
          position: 'absolute',
          top: 6,
          right: 6,
          background: badgeColor || COLORS.danger,
          color: COLORS.white,
          borderRadius: 8,
          padding: '1px 5px',
          fontSize: 12,
          fontWeight: 700,
        }}>
          {badge}
        </div>
      )}
      <div style={{
        width: 48,
        height: 48,
        borderRadius: 12,
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: color,
        transition: 'all 0.25s ease',
        transform: hovered ? 'scale(1.1)' : 'scale(1)',
      }}>
        {icon}
      </div>
      <span style={{
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.text,
        textAlign: 'center',
        lineHeight: 1.3,
      }}>
        {label}
      </span>
    </button>
  )
}

// ============================================================
// 子组件：设备状态指示灯
// ============================================================
const StatusIndicator: React.FC<{ status: string }> = ({ status }) => {
  const getStatusConfig = () => {
    switch (status) {
      case '使用中':
        return { color: '#3b82f6', bg: '#3b82f622', label: t('homePage.stInUse') }
      case '空闲':
        return { color: '#22c55e', bg: '#22c55e22', label: t('homePage.stIdle') }
      case '维护中':
      case '维修中':
        return { color: '#f59e0b', bg: '#f59e0b22', label: t('homePage.stMaint') }
      case '故障':
        return { color: '#ef4444', bg: '#ef444422', label: t('homePage.stFault') }
      default:
        return { color: '#94a3b8', bg: '#94a3b824', label: t('homePage.stUnknown') }
    }
  }

  const config = getStatusConfig()

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
    }}>
      <div style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: config.color,
        boxShadow: `0 0 6px ${config.color}80`,
        animation: status === '使用中' ? 'pulse 2s infinite' : undefined,
      }} />
      <span style={{
        ...badgeStyle,
        background: config.bg,
        color: config.color,
      }}>
        {config.label}
      </span>
    </div>
  )
}

// ============================================================
// 子组件：优先级标签
// ============================================================
const PriorityBadge: React.FC<{ priority: string }> = ({ priority }) => {
  const getConfig = () => {
    switch (priority) {
      case '危重':
      case '紧急':
        return { color: COLORS.danger, bg: COLORS.dangerBg }
      case '急迫':
        return { color: COLORS.warning, bg: COLORS.warningBg }
      default:
        return { color: COLORS.textMuted, bg: COLORS.background }
    }
  }

  const config = getConfig()

  return (
    <span style={{
      ...badgeStyle,
      background: config.bg,
      color: config.color,
      fontWeight: 700,
    }}>
      {priority}
    </span>
  )
}

// ============================================================
// 主组件
// ============================================================
const HomePage: FC = () => {
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()

  // 数据初始化
  const [exams] = useState(initialRadiologyExams)
  const devices = initialModalityDevices
  const criticalValues = initialCriticalValues
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [stats, setStats] = useState(() => {
    const dailyKpis = list<any>('dailyKpi');
    if (dailyKpis.length > 0) {
      const latest = dailyKpis[dailyKpis.length - 1];
      const exams = latest.examCount || 0;
      const reports = latest.reportCount || 0;
      return {
        today: { exams, reports, pending: Math.max(0, exams - reports), critical: latest.criticalCount || 0 },
        week: { exams: 0, reports: 0, pending: 0 },
        month: { exams: 0, reports: 0, pending: 0, revenue: 0 },
        byModality: {} as Record<string, number>,
        avgReportTime: 0,
        criticalPending: 0,
        worklist: [],
      };
    }
    return { today: { exams: 0, reports: 0, pending: 0, critical: 0 }, week: { exams: 0, reports: 0, pending: 0 }, month: { exams: 0, reports: 0, pending: 0, revenue: 0 }, byModality: {} as Record<string, number>, avgReportTime: 0, criticalPending: 0, worklist: [] };
  })
  const [workload] = useState(() => {
    const examsData = list<any>('exams');
    const reportsData = list<any>('reports');
    return {
      examsCompleted: examsData.length > 0 ? Math.min(examsData.length, 150) : 0,
      reportsWritten: reportsData.length > 0 ? Math.min(reportsData.length, 100) : 0,
      pendingReviews: reportsData.filter((r: any) => r.status === '审核中' || r.status === '初审中').length || 0,
    };
  })

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 首页深化: 区块11-16 数据状态
  // 全部接入真实 API (reportApi/worklistApi/criticalApi/deptApi/biApi),
  // 失败回退 mockBackend store / initialData, 徽标标注数据源。
  // ============================================================
  const [workSource, setWorkSource] = useState<'real' | 'demo'>('demo')
  const [deptSource, setDeptSource] = useState<'real' | 'demo'>('demo')
  const [trendSource, setTrendSource] = useState<'real' | 'demo'>('demo')
  const [perfSource, setPerfSource] = useState<'real' | 'demo'>('demo')

  // 区块11: 今日工作清单 (个人待办)
  const [myTodos, setMyTodos] = useState<{
    pendingReports: Array<{ id: string; patientName: string; examItem: string; createdAt: string; priority?: string }>
    pendingReviews: Array<{ id: string; patientName: string; examItem: string; createdAt: string; state?: string }>
    pendingCriticals: Array<{ id: string; patientName: string; finding: string; triggeredAt: string; severity: string }>
  }>(() => {
    const reports = list<any>('reports')
    let criticals: any[] = []
    try { criticals = list<any>('criticalEvents') } catch { criticals = [] }
    return {
      pendingReports: reports.filter((r: any) => ['WRITING', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'SUBMITTED'].includes(String(r.state ?? r.status ?? '')))
        .slice(0, 8).map((r: any) => ({ id: r.id, patientName: r.patientName ?? '未知', examItem: r.examItem ?? '影像检查', createdAt: r.createdAt ?? '', priority: r.priority })),
      pendingReviews: reports.filter((r: any) => ['INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW'].includes(String(r.state ?? '')) || String(r.status ?? '') === '审核中')
        .slice(0, 8).map((r: any) => ({ id: r.id, patientName: r.patientName ?? '未知', examItem: r.examItem ?? '影像检查', createdAt: r.createdAt ?? '', state: r.state })),
      pendingCriticals: (criticals.length > 0 ? criticals : initialCriticalValues)
        .filter((c: any) => !['已处理', '已通知', 'RESOLVED', 'CLOSED_LOOP'].includes(String(c.status ?? c.state ?? '')))
        .slice(0, 8).map((c: any) => ({ id: c.id, patientName: c.patientName ?? '未知', finding: c.findingDetails ?? c.finding ?? '', triggeredAt: c.triggeredAt ?? c.reportedTime ?? '', severity: c.severity ?? '危急' })),
    }
  })
  const [myTodoLoading, setMyTodoLoading] = useState(false)
  const [myTodoError, setMyTodoError] = useState<string | null>(null)

  // 区块12: 科室动态 (公告 + 今日值班)
  const [deptAnnouncements, setDeptAnnouncements] = useState<Array<{ id: string; title: string; content: string; category: string; author: string; createdAt: string; pinned?: boolean }>>([])
  const [todayOnCall, setTodayOnCall] = useState<Array<{ id: string; doctorName: string; shift: string; role: string }>>([])
  const [deptLoading, setDeptLoading] = useState(false)
  const [deptError, setDeptError] = useState<string | null>(null)

  // 区块14: 近 7 日按模态堆叠
  const [modalStackData, setModalStackData] = useState<Array<Record<string, string | number>>>(() => MODAL_STACK_FALLBACK.map(r => ({ ...r })))
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)

  // 区块15: 个人绩效卡
  const [perfCard, setPerfCard] = useState(() => {
    const reports = list<any>('reports')
    const myReports = reports.filter((r: any) => r.radiologistId === currentUser?.id || r.doctorId === currentUser?.id)
    return {
      todayReports: myReports.length > 0 ? Math.min(myReports.length, 20) : workload.reportsWritten,
      todayExams: workload.examsCompleted,
      rvu: Math.round((myReports.length > 0 ? myReports.length : workload.reportsWritten) * 4.2),
      qualityScore: 0,
      timelinessMin: 0,
      doctorName: currentUser?.name ?? '当前用户',
    }
  })
  const [perfLoading, setPerfLoading] = useState(false)
  const [perfError, setPerfError] = useState<string | null>(null)

  // 区块16: 数据源徽标汇总
  const dataSourceBadges = [
    { key: 'work', label: t('homePage.srcWork'), real: workSource === 'real' },
    { key: 'dept', label: t('homePage.srcDept'), real: deptSource === 'real' },
    { key: 'trend', label: t('homePage.srcTrend'), real: trendSource === 'real' },
    { key: 'perf', label: t('homePage.srcPerf'), real: perfSource === 'real' },
  ]

  const fetchStats = async () => {
    const res = await statsApi.getDaily()
    if (res.success && res.data) {
      const examCount = res.data!.examCount
      const reportCount = res.data!.reportCount
      setStats(prev => ({
        ...prev,
        today: {
          ...prev.today,
          exams: examCount,
          reports: reportCount,
          pending: Math.max(0, examCount - reportCount),
          critical: res.data!.criticalCount,
        },
      }))
      setLoadError(null)
    } else {
      if (!loadError) setLoadError(t('homePage.apiUnavailable'))
    }
  }

  useEffect(() => {
    setLoading(true)
    void fetchStats()
    setLoading(false)
  }, [])

  useEffect(() => {
    let isHidden = document.visibilityState === 'hidden'
    let timer: ReturnType<typeof setInterval> | null = null

    const startTimer = () => {
      if (isHidden) return
      timer = setInterval(() => { void fetchStats() }, 30000)
    }
    const stopTimer = () => {
      if (timer) { clearInterval(timer); timer = null }
    }
    const onVisibilityChange = () => {
      isHidden = document.visibilityState === 'hidden'
      if (isHidden) {
        stopTimer()
      } else {
        void fetchStats()
        startTimer()
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    startTimer()
    return () => {
      stopTimer()
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块11: 今日工作清单 (个人待办) 数据加载
  // reportApi.list (待报告/待审核) + criticalApi.list (待处置危急值)
  // ============================================================
  const loadMyTodos = useCallback(async () => {
    setMyTodoLoading(true)
    let anyReal = false
    try {
      const [repRes, cvRes] = await Promise.allSettled([
        reportApi.list({ pageSize: 100 }),
        criticalApi.list({ take: 100 }),
      ])
      const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null
      const rawReports = settled(repRes)
      const rawCriticals = settled(cvRes)
      const reports: any[] = Array.isArray(rawReports) ? rawReports
        : Array.isArray((rawReports as any)?.items) ? (rawReports as any).items : []
      const criticals: any[] = Array.isArray(rawCriticals)
        ? rawCriticals
        : Array.isArray((rawCriticals as any)?.items) ? (rawCriticals as any).items : []
      if (reports.length > 0 || criticals.length > 0) anyReal = true

      const pendingReports = reports
        .filter((r: any) => ['WRITING', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'SUBMITTED', 'INITIAL_REVIEW', 'FINAL_REVIEW'].includes(String(r.state ?? '')))
        .slice(0, 8)
      const pendingReviews = reports
        .filter((r: any) => ['INITIAL_REVIEW', 'FINAL_REVIEW', 'CO_SIGN_REVIEW'].includes(String(r.state ?? '')))
        .slice(0, 8)
      const pendingCriticals = criticals
        .filter((c: any) => !['RESOLVED', 'CLOSED_LOOP', 'ACKNOWLEDGED'].includes(String(c.state ?? '')))
        .slice(0, 8)
        .map((c: any) => ({
          id: c.id,
          patientName: c.patientName ?? '未知',
          finding: c.finding ?? c.description ?? '',
          triggeredAt: c.triggeredAt ?? '',
          severity: c.severity ?? '危急',
        }))

      setMyTodos(prev => ({
        pendingReports: pendingReports.length > 0 ? pendingReports.map((r: any) => ({ id: r.id, patientName: r.patientName ?? '未知', examItem: r.examItem ?? r.examName ?? '影像检查', createdAt: r.createdAt ?? '', priority: r.priority })) : prev.pendingReports,
        pendingReviews: pendingReviews.length > 0 ? pendingReviews.map((r: any) => ({ id: r.id, patientName: r.patientName ?? '未知', examItem: r.examItem ?? r.examName ?? '影像检查', createdAt: r.createdAt ?? '', state: r.state })) : prev.pendingReviews,
        pendingCriticals: pendingCriticals.length > 0 ? pendingCriticals : prev.pendingCriticals,
      }))
      setWorkSource(anyReal ? 'real' : 'demo')
      if (anyReal) setMyTodoError(null)
      else if (!myTodoError) setMyTodoError(t('homePage.workListErr'))
    } catch (err) {
      setMyTodoError(t('homePage.workListLoadErr', { msg: (err as Error)?.message ?? '网络错误' }))
      setWorkSource('demo')
    } finally {
      setMyTodoLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadMyTodos() }, [loadMyTodos])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块12: 科室动态 (公告 + 今日值班) 数据加载
  // deptApi.listActiveAnnouncements + deptApi.listSchedules(本月)
  // ============================================================
  const loadDeptNews = useCallback(async () => {
    setDeptLoading(true)
    let anyReal = false
    try {
      const [annRes, schedRes] = await Promise.allSettled([
        deptApi.listActiveAnnouncements(),
        deptApi.listSchedules(new Date().toISOString().slice(0, 7)),
      ])
      const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null
      const ann = settled(annRes)
      const sched = settled(schedRes)
      const annList: DeptAnnouncement[] = Array.isArray(ann) ? ann : Array.isArray((ann as any)?.items) ? (ann as any).items : []
      const schedList: OnCallSchedule[] = Array.isArray(sched) ? sched : Array.isArray((sched as any)?.items) ? (sched as any).items : []
      if (annList.length > 0 || schedList.length > 0) anyReal = true

      if (annList.length > 0) {
        setDeptAnnouncements(annList.slice(0, 5).map(a => ({
          id: a.id, title: a.title, content: a.content, category: a.category,
          author: a.author, createdAt: a.createdAt, pinned: a.pinned,
        })))
      }
      const todayStr = new Date().toISOString().slice(0, 10)
      const todaySched = schedList.filter(s => (s.date ?? '').slice(0, 10) === todayStr)
      if (todaySched.length > 0) {
        setTodayOnCall(todaySched.map(s => ({ id: s.id, doctorName: s.doctorName, shift: s.shift, role: s.role })))
      }
      setDeptSource(anyReal ? 'real' : 'demo')
      if (anyReal) setDeptError(null)
      else if (!deptError) setDeptError(t('homePage.deptErr'))
    } catch (err) {
      setDeptError(t('homePage.deptLoadErr', { msg: (err as Error)?.message ?? '网络错误' }))
      setDeptSource('demo')
    } finally {
      setDeptLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadDeptNews() }, [loadDeptNews])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块14: 近 7 日检查量趋势 (按模态堆叠)
  // statsApi.getTrend(7) + statsApi.getByModality → 堆叠柱状
  // ============================================================
  const loadModalTrend = useCallback(async () => {
    setTrendLoading(true)
    try {
      const [trendRes, modRes] = await Promise.allSettled([
        statsApi.getTrend(7),
        statsApi.getByModality(),
      ])
      const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null
      const trendRaw: unknown = settled(trendRes)
      const trend: any[] = Array.isArray(trendRaw) ? trendRaw as any[] : []
      const byMod: any = settled(modRes) ?? {}
      if (trend.length > 0) {
        const keys = Object.keys(byMod ?? {}).length > 0
          ? Object.keys(byMod).slice(0, 6)
          : ['CT', 'MR', 'DR', 'DSA', 'MG']
        const rows = trend.slice(-7).map((d: any) => {
          const row: Record<string, string | number> = {
            day: String(d.date ?? '').slice(5) || '—',
            合计: toNumber(d.examCount),
          }
          keys.forEach((k) => {
            const share = byMod && typeof byMod[k] === 'object' && byMod[k] !== null
              ? Number((byMod[k] as any)?.total ?? (byMod[k] as any)?.count ?? 0) || 0
              : Number(byMod?.[k] ?? 0) || 0
            const total = Object.values(byMod ?? {}).reduce((s: number, v: any) => s + (typeof v === 'number' ? v : Number(v?.total ?? v?.count ?? 0)), 0)
            row[k] = total > 0 ? Math.round(toNumber(d.examCount) * (share / total)) : 0
          })
          return row
        })
        if (rows.length > 0) {
          setModalStackData(rows)
          setTrendSource('real')
          setTrendError(null)
          return
        }
      }
      setModalStackData(MODAL_STACK_FALLBACK.map(r => ({ ...r })))
      setTrendSource('demo')
      if (!trendError) setTrendError(t('homePage.trendErr'))
    } catch (err) {
      setTrendError(t('homePage.trendLoadErr', { msg: (err as Error)?.message ?? '网络错误' }))
      setTrendSource('demo')
    } finally {
      setTrendLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { void loadModalTrend() }, [loadModalTrend])

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块15: 个人绩效卡
  // biApi.getPhysicianPerformance / getReportTimeliness → RVU 预估
  // ============================================================
  const loadPerfCard = useCallback(async () => {
    setPerfLoading(true)
    try {
      const [perfRes, timingRes, wlRes] = await Promise.allSettled([
        biApi.getPhysicianPerformance(),
        biApi.getReportTimeliness(),
        worklistApi.getStats(),
      ])
      const settled = <T,>(r: PromiseSettledResult<T>): T | null =>
        r.status === 'fulfilled' && r.value && (r.value as any)?.success !== false ? (r.value as any)?.data ?? null : null
      const perf = settled(perfRes)
      const timing = settled(timingRes)
      const wl = settled(wlRes)
      const me = currentUser?.name ?? ''
      const myRow = Array.isArray((perf as any)?.byPhysician)
        ? (perf as any).byPhysician.find((p: any) => p.doctorName === me || (me && (p.doctorName ?? '').includes(me)))
        : null
      if (myRow) {
        setPerfCard({
          todayReports: toNumber(myRow.reportCount),
          todayExams: toNumber((wl as any)?.completedToday ?? 0),
          rvu: Math.round(toNumber(myRow.rvu)),
          qualityScore: Math.round(toNumber(myRow.qualityScore ?? 0)),
          timelinessMin: Math.round(toNumber(myRow.avgTurnaround ?? 0)),
          doctorName: myRow.doctorName ?? me,
        })
        setPerfSource('real')
        setPerfError(null)
        return
      }
      if (perf) {
        setPerfCard(prev => ({
          ...prev,
          rvu: Math.round(toNumber((perf as any)?.totalRvu ?? 0) / Math.max(1, ((perf as any)?.byPhysician ?? []).length || 1)),
          qualityScore: Math.round(toNumber((perf as any)?.qualityScore ?? 0)),
          timelinessMin: Math.round(toNumber((perf as any)?.avgTurnaround ?? 0)),
        }))
        setPerfSource('real')
        setPerfError(null)
        return
      }
      if (timing) {
        setPerfCard(prev => ({
          ...prev,
          timelinessMin: Math.round(toNumber((timing as any)?.medianMinutes ?? 0)),
        }))
        setPerfSource('real')
        setPerfError(null)
        return
      }
      setPerfSource('demo')
      if (!perfError) setPerfError(t('homePage.perfErr'))
    } catch (err) {
      setPerfError(t('homePage.perfLoadErr', { msg: (err as Error)?.message ?? '网络错误' }))
      setPerfSource('demo')
    } finally {
      setPerfLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser])

  useEffect(() => { void loadPerfCard() }, [loadPerfCard])

  // 数值化辅助 (区块14/15 共用)
  function toNumber(v: unknown): number {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  // 计算统计数据
  const pendingExams = exams.filter((e: Record<string, unknown>) =>
    ['已登记', '待检查', '检查中'].includes(e.status as string)
  ).sort((a, b) => {
    const priorityOrder: Record<string, number> = { '危重': 0, '紧急': 1, '急迫': 2, '普通': 3 }
    return (priorityOrder[a.priority as string] || 3) - (priorityOrder[b.priority as string] || 3)
  })

  const criticalPending = criticalValues.filter(c =>
    c.status !== '已处理' && c.status !== '已通知'
  )

  // 设备状态统计
  const deviceInUse = devices.filter(d => d.status === '使用中').length
  const deviceIdle = devices.filter(d => d.status === '空闲').length
  const deviceMaintenance = devices.filter(d =>
    ['维护中', '维修中', '故障'].includes(d.status)
  ).length

  // 图表数据
  const hourlyData = [
    { hour: '08:00', today: 12, yesterday: 10 },
    { hour: '09:00', today: 28, yesterday: 25 },
    { hour: '10:00', today: 45, yesterday: 42 },
    { hour: '11:00', today: 52, yesterday: 48 },
    { hour: '12:00', today: 38, yesterday: 35 },
    { hour: '13:00', today: 42, yesterday: 40 },
    { hour: '14:00', today: 58, yesterday: 55 },
    { hour: '15:00', today: 65, yesterday: 60 },
    { hour: '16:00', today: 48, yesterday: 45 },
    { hour: '17:00', today: 35, yesterday: 32 },
  ]

  const weeklyBarData = [
    { day: '周一', CT: 98, MR: 45, DR: 85, DSA: 8, 乳腺: 5 },
    { day: '周二', CT: 105, MR: 52, DR: 90, DSA: 10, 乳腺: 6 },
    { day: '周三', CT: 112, MR: 48, DR: 78, DSA: 12, 乳腺: 8 },
    { day: '周四', CT: 95, MR: 55, DR: 82, DSA: 9, 乳腺: 5 },
    { day: '周五', CT: 108, MR: 50, DR: 88, DSA: 11, 乳腺: 7 },
    { day: '周六', CT: 60, MR: 25, DR: 40, DSA: 3, 乳腺: 3 },
    { day: '周日', CT: 30, MR: 10, DR: 20, DSA: 1, 乳腺: 1 },
  ]

  void ([
    { name: 'CT', value: stats.byModality['CT'], color: MODALITY_COLORS['CT'] },
    { name: 'MR', value: stats.byModality['MR'], color: MODALITY_COLORS['MR'] },
    { name: 'DR', value: stats.byModality['DR'], color: MODALITY_COLORS['DR'] },
    { name: 'DSA', value: stats.byModality['DSA'], color: MODALITY_COLORS['DSA'] },
    { name: '乳腺', value: stats.byModality['MG'], color: MODALITY_COLORS['MG'] },
  ])

  const qualityData = [
    { name: t('homePage.qualityExcellent'), value: 85, color: '#22c55e' },
    { name: t('homePage.qualityGood'), value: 12, color: '#3b82f6' },
    { name: t('homePage.qualityPass'), value: 3, color: '#f59e0b' },
  ]

  const revenueData = [
    { period: t('homePage.periodToday'), value: 285000, target: 300000 },
    { period: t('homePage.periodWeek'), value: 1680000, target: 1800000 },
    { period: t('homePage.periodMonth'), value: 8960000, target: 9500000 },
  ]

  const revenueTrendData = [
    { day: '周一', revenue: 125000, exams: 142 },
    { day: '周二', revenue: 138000, exams: 155 },
    { day: '周三', revenue: 142000, exams: 160 },
    { day: '周四', revenue: 128000, exams: 145 },
    { day: '周五', revenue: 145000, exams: 165 },
    { day: '周六', revenue: 82000, exams: 90 },
    { day: '周日', revenue: 45000, exams: 52 },
  ]

  // 今日日期格式化
  const today = new Date()
  const dateString = today.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  // 当前时间
  const currentTime = today.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
  })

  // ============================================================
  // 区块1：顶部问候区
  // ============================================================
  const renderGreetingSection = () => (
    <div style={{
      ...cardStyle,
      marginBottom: 24,
      background: 'linear-gradient(135deg, var(--color-primary-800) 0%, var(--color-primary-600) 100%)',
      border: 'none',
      padding: 0,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {/* 背景装饰 */}
      <div style={{
        position: 'absolute',
        top: -50,
        right: -50,
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.05)',
      }} />
      <div style={{
        position: 'absolute',
        bottom: -30,
        right: 100,
        width: 100,
        height: 100,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.03)',
      }} />

      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 28,
        position: 'relative',
        zIndex: 1,
      }}>
        {/* 左侧：logo和标题 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* 放射科Logo */}
          <div style={{
            width: 64,
            height: 64,
            borderRadius: 16,
            background: 'rgba(255,255,255,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(10px)',
            border: '2px solid rgba(255,255,255,0.2)',
          }}>
            <Radio size={32} color="#ffffff" />
          </div>

          <div>
            <div style={{
              fontSize: 20,
              fontWeight: 700,
              color: COLORS.white,
              marginBottom: 4,
              letterSpacing: '0.5px',
            }}>
              {t('homePage.systemName')}
            </div>
            <div style={{
              fontSize: 14,
              color: 'rgba(255,255,255,0.8)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <span>{HOSPITAL_NAME}</span>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
              <span>{t('homePage.deptName')}</span>
            </div>
          </div>
        </div>

        {/* 中间：用户信息 */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 26,
            fontWeight: 700,
            color: COLORS.white,
            marginBottom: 4,
          }}>
              {t('homePage.greeting', { name: currentUser?.name ?? t('w9a.homePage.userFallback'), title: currentUser?.title ? ` ${currentUser.title}` : '' })}
          </div>
          <div style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.85)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
          }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Calendar size={14} />
              {dateString}
            </span>
            <span style={{ color: 'rgba(255,255,255,0.5)' }}>|</span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <Clock size={14} />
              {currentTime}
            </span>
          </div>
        </div>

        {/* 右侧：快捷统计 */}
        <div style={{
          display: 'flex',
          gap: 16,
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '12px 20px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.white,
            }}>
              {criticalPending.length}
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 2,
            }}>
              {t('homePage.criticalPending')}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '12px 20px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.white,
            }}>
              {pendingExams.length}
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 2,
            }}>
              {t('homePage.pendingExams')}
            </div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.12)',
            borderRadius: 12,
            padding: '12px 20px',
            textAlign: 'center',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(255,255,255,0.15)',
          }}>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.white,
            }}>
              {deviceInUse}/{devices.length}
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.8)',
              marginTop: 2,
            }}>
              {t('homePage.devicesInUse')}
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // 区块1.5：个人工作量统计
  // ============================================================
  const renderPersonalWorkload = () => (
    <div style={{
      ...cardStyle,
      marginBottom: 24,
      padding: 16,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 24,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: COLORS.infoBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.info,
          }}>
            <Scan size={20} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{workload.examsCompleted}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('homePage.todayExamsDone')}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: COLORS.border }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: COLORS.successBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.success,
          }}>
            <FileText size={20} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{workload.reportsWritten}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('homePage.todayReportsWritten')}</div>
          </div>
        </div>
        <div style={{ width: 1, height: 32, background: COLORS.border }} />
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 10,
            background: COLORS.warningBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: COLORS.warning,
          }}>
            <AlertTriangle size={20} />
          </div>
          <div>
            <div style={{ fontSize: 28, fontWeight: 700, color: COLORS.primary }}>{workload.pendingReviews}</div>
            <div style={{ fontSize: 12, color: COLORS.textMuted }}>{t('homePage.pendingReviews')}</div>
          </div>
        </div>
      </div>
    </div>
  )

  // ============================================================
  // 区块2：快捷入口
  // ============================================================
  const renderQuickActions = () => (
    <div style={{
      ...cardStyle,
      marginBottom: 24,
      padding: 20,
    }}>
      <div style={headerStyle}>
        <span style={cardTitleStyle}>
          <LayoutDashboard size={18} color={COLORS.primary} />
          {t('homePage.quickActions')}
        </span>
        <span style={{
          fontSize: 12,
          color: COLORS.textMuted,
        }}>
          {t('homePage.quickActionsHint')}
        </span>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(8, 1fr)',
        gap: 12,
      }}>
        <QuickActionButton
          icon={<ListChecks size={24} />}
          label={t('homePage.qaWorklist')}
          color={MODALITY_COLORS['CT']!}
          bg="#3b82f622"
          badge="12"
          badgeColor={COLORS.info}
          onClick={() => navigate('/worklist')}
        />
        <QuickActionButton
          icon={<FileText size={24} />}
          label={t('homePage.qaWriteReport')}
          color={MODALITY_COLORS['MR']!}
          bg="#8b5cf622"
          badge="8"
          badgeColor={COLORS.purple}
          onClick={() => navigate('/write-report')}
        />
        <QuickActionButton
          icon={<ShieldAlert size={24} />}
          label={t('homePage.qaCriticalValue')}
          color={COLORS.danger}
          bg={COLORS.dangerBg}
          badge={String(criticalPending.length)}
          badgeColor={COLORS.danger}
          onClick={() => navigate('/critical-value')}
        />
        <QuickActionButton
          icon={<BarChart3 size={24} />}
          label={t('homePage.qaStatistics')}
          color={COLORS.success}
          bg={COLORS.successBg}
          onClick={() => navigate('/statistics')}
        />
        <QuickActionButton
          icon={<Monitor size={24} />}
          label={t('homePage.qaDeviceStatus')}
          color={MODALITY_COLORS['DR']!}
          bg={COLORS.warningBg}
          onClick={() => navigate('/devices')}
        />
        <QuickActionButton
          icon={<CalendarClock size={24} />}
          label={t('homePage.qaAppointment')}
          color={MODALITY_COLORS['DSA']!}
          bg="#f59e0b22"
          onClick={() => navigate('/appointments')}
        />
        <QuickActionButton
          icon={<BookOpen size={24} />}
          label={t('homePage.qaReports')}
          color={MODALITY_COLORS['MG']!}
          bg="#ec489922"
          onClick={() => navigate('/reports')}
        />
        <QuickActionButton
          icon={<Image size={24} />}
          label={t('homePage.qaViewer')}
          color={COLORS.info}
          bg={COLORS.infoBg}
          onClick={() => navigate('/dicom-viewer')}
        />
      </div>
    </div>
  )

  // ============================================================
  // 区块3：今日概况统计卡片
  // ============================================================
  const renderTodayStats = () => (
    <div aria-live="polite" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
      gap: 16,
      marginBottom: 24,
    }}>
      <KpiCard
        title={t('homePage.kpiMorningExams')}
        value={stats.today.exams}
        sub={t('homePage.kpiVsYesterday', { count: Math.round(stats.today.exams * 0.08) })}
        icon={<IconScanning size={24} />}
        color={MODALITY_COLORS['CT']!}
        iconBg="#3b82f622"
        gradient
        trend={{ value: 8, direction: 'up' }}
        onClick={() => navigate('/worklist')}
      />
      <KpiCard
        title={t('homePage.kpiPendingReports')}
        value={stats.today.pending}
        sub={t('homePage.kpiTodayShare', { count: Math.round(stats.today.pending / stats.today.exams * 100) })}
        icon={<IconPending size={24} />}
        color={MODALITY_COLORS['MR']!}
        iconBg="#8b5cf622"
        gradient
        trend={{ value: 3, direction: 'down' }}
        onClick={() => navigate('/worklist')}
      />
      <KpiCard
        title={t('homePage.kpiReported')}
        value={stats.today.reports}
        sub={t('homePage.kpiCompletion', { count: Math.round(stats.today.reports / stats.today.exams * 100) })}
        icon={<IconNormal size={24} />}
        color={COLORS.success}
        iconBg={COLORS.successBg}
        gradient
        trend={{ value: 12, direction: 'up' }}
        onClick={() => navigate('/reports')}
      />
      <KpiCard
        title={t('homePage.kpiCritical')}
        value={stats.today.critical}
        sub={t('homePage.kpiCriticalPending', { count: criticalPending.length })}
        icon={<IconCritical size={24} />}
        color={COLORS.danger}
        iconBg={COLORS.dangerBg}
        gradient
        onClick={() => navigate('/critical-value')}
      />
      <KpiCard
        title={t('homePage.kpiDeviceUtil')}
        value={`${Math.round(deviceInUse / devices.length * 100)}%`}
        sub={t('homePage.kpiDeviceDetail', { inUse: deviceInUse, total: devices.length })}
        icon={<IconDr size={24} />}
        color={MODALITY_COLORS['DR']!}
        iconBg={COLORS.warningBg}
        gradient
        trend={{ value: 5, direction: 'up' }}
        onClick={() => navigate('/devices')}
      />
      <KpiCard
        title={t('homePage.kpiRevenue')}
        value={t('w9a.statsPage.currencyWan', { value: (285000 / 10000).toFixed(1) })}
        sub={t('homePage.kpiRevenueTarget')}
        icon={<IconXRayBeam size={24} />}
        color={COLORS.success}
        iconBg={COLORS.successBg}
        gradient
        trend={{ value: 5, direction: 'down' }}
        onClick={() => navigate('/statistics')}
      />
      <KpiCard
        title={t('homePage.kpiTat')}
        value="45"
        suffix="min"
        sub={t('homePage.kpiTatDelta')}
        icon={<IconReview size={24} />}
        color={COLORS.purple}
        iconBg={COLORS.purpleBg}
        gradient
        trend={{ value: 8, direction: 'down' }}
        onClick={() => navigate('/reports')}
      />
    </div>
  )

  // ============================================================
  // 区块4：检查量趋势图
  // ============================================================
  const renderExamTrendCharts = () => (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 20,
      marginBottom: 24,
    }}>
      {/* 4a: 今日每小时趋势双折线图 */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <TrendingUp size={16} color={COLORS.primary} />
            {t('homePage.trendToday')}
          </span>
          <div style={{ display: 'flex', gap: 12 }}>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              <div style={{
                width: 10,
                height: 3,
                borderRadius: 2,
                background: COLORS.info,
              }} />
              {t('homePage.today')}
            </span>
            <span style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              <div style={{
                width: 10,
                height: 3,
                borderRadius: 2,
                background: COLORS.textLight,
              }} />
              {t('homePage.yesterday')}
            </span>
          </div>
        </div>
        <ChartContainer height={220}>
          <LineChart data={hourlyData}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis
              dataKey="hour"
              tick={{ fontSize: 12, fill: COLORS.textMuted }}
              axisLine={{ stroke: COLORS.border }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: COLORS.textMuted }}
              axisLine={{ stroke: COLORS.border }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
              formatter={(value: number) => [t('homePage.examCases', { count: value }), '']}
            />
            <Line
              type="monotone"
              dataKey="today"
              stroke="var(--color-primary-500)"
              strokeWidth={2.5}
              dot={{ fill: 'var(--color-primary-500)', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, fill: 'var(--color-primary-500)' }}
              name={t('homePage.today')}
            />
            <Line
              type="monotone"
              dataKey="yesterday"
              stroke={COLORS.textLight}
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name={t('homePage.yesterday')}
            />
          </LineChart>
        </ChartContainer>
      </div>

      {/* 4b: 7天柱状图（按设备类型） */}
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <BarChart3 size={16} color={COLORS.primary} />
            {t('homePage.weekStats')}
          </span>
          <span style={{
            ...badgeStyle,
            background: COLORS.infoBg,
            color: COLORS.info,
          }}>
            {t('homePage.weekExams', { count: stats.week.exams })}
          </span>
        </div>
        <ChartContainer height={220}>
          <BarChart data={weeklyBarData}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis
              dataKey="day"
              tick={{ fontSize: 12, fill: COLORS.textMuted }}
              axisLine={{ stroke: COLORS.border }}
            />
            <YAxis
              tick={{ fontSize: 12, fill: COLORS.textMuted }}
              axisLine={{ stroke: COLORS.border }}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: 'var(--bg-card)',
                color: 'var(--text-primary)',
                fontSize: 12,
              }}
            />
            <Legend
              iconSize={10}
              iconType="circle"
              wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }}
            />
            <Bar dataKey="CT" name="CT" fill={MODALITY_COLORS['CT']} radius={[4, 4, 0, 0]} />
            <Bar dataKey="MR" name="MR" fill={MODALITY_COLORS['MR']} radius={[4, 4, 0, 0]} />
            <Bar dataKey="DR" name="DR" fill={MODALITY_COLORS['DR']} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ChartContainer>
      </div>
    </div>
  )

  // ============================================================
  // 区块5：设备状态监控
  // ============================================================
  const renderDeviceStatus = () => (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={cardTitleStyle}>
          <Monitor size={16} color={COLORS.primary} />
          {t('homePage.deviceMonitor')}
        </span>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{
            ...badgeStyle,
            background: '#3b82f622',
            color: 'var(--color-info)',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#3b82f6',
            }} />
            {t('homePage.inUseCount', { count: deviceInUse })}
          </span>
          <span style={{
            ...badgeStyle,
            background: '#22c55e22',
            color: 'var(--color-success)',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#22c55e',
            }} />
            {t('homePage.idleCount', { count: deviceIdle })}
          </span>
          <span style={{
            ...badgeStyle,
            background: '#f59e0b22',
            color: 'var(--color-warning)',
          }}>
            <div style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: '#f59e0b',
            }} />
            {t('homePage.maintCount', { count: deviceMaintenance })}
          </span>
        </div>
      </div>

      {/* 设备状态总览 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 16,
      }}>
        <div style={{
          background: 'var(--bg-deep)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#3b82f622',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Activity size={22} color="#3b82f6" />
          </div>
          <div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.primary,
            }}>
              {deviceInUse}
            </div>
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              {t('homePage.stInUse')}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-deep)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#22c55e22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CheckCircle size={22} color="#22c55e" />
          </div>
          <div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.primary,
            }}>
              {deviceIdle}
            </div>
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              {t('homePage.stIdle')}
            </div>
          </div>
        </div>

        <div style={{
          background: 'var(--bg-deep)',
          borderRadius: 10,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <div style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: '#f59e0b22',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Settings size={22} color="#d97706" />
          </div>
          <div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.primary,
            }}>
              {deviceMaintenance}
            </div>
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
            }}>
              {t('homePage.stMaint')}
            </div>
          </div>
        </div>
      </div>

      {/* 设备列表（可滚动） */}
      <div style={{
        maxHeight: 280,
        overflowY: 'auto',
      }} tabIndex={0} aria-label={t('homePage.ariaDeviceList')}>
        {devices.map((device) => (
          <div
            key={device.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '12px 0',
              borderBottom: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 4,
              }}>
                <span style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: COLORS.text,
                }}>
                  {device.name.split('（')[0]}
                </span>
                <span style={{
                  ...badgeStyle,
                  background: `${MODALITY_COLORS[device.modality] || '#94a3b8'}15`,
                  color: MODALITY_COLORS[device.modality] || COLORS.textMuted,
                  fontWeight: 600,
                }}>
                  {device.modality}
                </span>
              </div>
              <div style={{
                fontSize: 12,
                color: COLORS.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>{device.manufacturer}</span>
                <span>|</span>
                <span>{device.location}</span>
                {device.status === '使用中' && (
                  <>
                    <span>|</span>
                    <span style={{ color: COLORS.info }}>
                      {t('homePage.currentPatient', { patient: initialExamRooms.find(r => r.deviceId === device.id)?.currentPatient || '-' })}
                    </span>
                  </>
                )}
              </div>
            </div>
            <StatusIndicator status={device.status} />
          </div>
        ))}
      </div>
    </div>
  )

  // ============================================================
  // 区块6：今日待处理检查列表
  // ============================================================
  const renderPendingExams = () => (
    <div aria-live="polite" style={cardStyle}>
      <div style={headerStyle}>
        <span style={cardTitleStyle}>
          <ClipboardList size={16} color={COLORS.primary} />
          {t('homePage.pendingExamTitle')}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{
            ...badgeStyle,
            background: COLORS.dangerBg,
            color: COLORS.danger,
          }}>
            {t('homePage.urgentCount', { count: pendingExams.filter(e => e.priority === '紧急' || e.priority === '危重').length })}
          </span>
          <span style={{
            ...badgeStyle,
            background: COLORS.infoBg,
            color: COLORS.info,
          }}>
            {t('homePage.totalCount', { count: pendingExams.length })}
          </span>
        </div>
      </div>

      <div style={{ maxHeight: 400, overflowY: 'auto' }} tabIndex={0} aria-label={t('homePage.ariaPendingExamList')}>
        {pendingExams.map((exam, index) => (
          <div
            key={exam.id}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '14px 0',
              borderBottom: index < pendingExams.length - 1 ? `1px solid ${COLORS.border}` : 'none',
              background: exam.priority === '危重' || exam.priority === '紧急'
                ? 'rgba(239, 68, 68, 0.08)'
                : 'transparent',
              margin: exam.priority === '危重' || exam.priority === '紧急'
                ? '0 -8px'
                : '0',
              paddingLeft: exam.priority === '危重' || exam.priority === '紧急' ? 8 : 0,
              paddingRight: exam.priority === '危重' || exam.priority === '紧急' ? 8 : 0,
              borderRadius: exam.priority === '危重' || exam.priority === '紧急' ? 6 : 0,
            }}
          >
            {/* 左侧：患者信息 */}
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 6,
              }}>
                {exam.priority === '危重' && (
                  <AlertCircle size={14} color={COLORS.danger} />
                )}
                {exam.priority === '紧急' && (
                  <AlertTriangle size={14} color="#f59e0b" />
                )}
                <span style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: COLORS.text,
                }}>
                  {exam.patientName}
                </span>
                <span style={{
                  ...badgeStyle,
                  background: `${MODALITY_COLORS[exam.modality] || '#94a3b8'}15`,
                  color: MODALITY_COLORS[exam.modality] || COLORS.textMuted,
                  fontWeight: 600,
                  fontSize: 12,
                }}>
                  {exam.modality}
                </span>
                <PriorityBadge priority={exam.priority} />
              </div>
              <div style={{
                fontSize: 12,
                color: COLORS.textMuted,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}>
                <span>{exam.examItemName}</span>
                <span>|</span>
                <span>{exam.patientType}</span>
                <span>|</span>
                <span style={{ color: exam.priority === '危重' || exam.priority === '紧急'
                  ? COLORS.danger
                  : COLORS.textMuted
                }}>
                  {exam.clinicalDiagnosis || t('homePage.pending')}
                </span>
              </div>
            </div>

            {/* 中间：设备信息 */}
            <div style={{
              textAlign: 'center',
              padding: '0 20px',
            }}>
              <div style={{
                fontSize: 12,
                fontWeight: 600,
                color: COLORS.text,
                marginBottom: 2,
              }}>
                {exam.roomName}
              </div>
              <div style={{
                fontSize: 12,
                color: COLORS.textMuted,
              }}>
                {exam.deviceName?.split('（')[0]}
              </div>
            </div>

            {/* 右侧：时间和状态 */}
            <div style={{
              textAlign: 'right',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <div>
                <div style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: COLORS.primary,
                }}>
                  {exam.examTime}
                </div>
                <div style={{
                  fontSize: 12,
                  color: COLORS.textMuted,
                }}>
                  {exam.examDate}
                </div>
              </div>
              <span style={{
                ...badgeStyle,
                background: exam.status === '检查中'
                  ? COLORS.infoBg
                  : exam.status === '待检查'
                  ? COLORS.warningBg
                  : COLORS.background,
                color: exam.status === '检查中'
                  ? COLORS.info
                  : exam.status === '待检查'
                  ? COLORS.warning
                  : COLORS.textMuted,
                fontWeight: 600,
                minWidth: 60,
                justifyContent: 'center',
              }}>
                {exam.status}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )

  // ============================================================
  // 区块7：危急值预警面板
  // ============================================================
  const renderCriticalValuePanel = () => (
    <div style={{
      ...cardStyle,
      border: `2px solid ${COLORS.danger}`,
      background: 'var(--bg-card)',
    }}>
      <div style={{
        ...headerStyle,
        borderBottom: `2px solid rgba(239, 68, 68, 0.15)`,
        marginBottom: 16,
        paddingBottom: 12,
      }}>
        <span style={{
          ...cardTitleStyle,
          color: COLORS.danger,
        }}>
          <ShieldAlert size={18} color={COLORS.danger} />
          {t('homePage.criticalPanel')}
          <span style={{
            ...badgeStyle,
            background: COLORS.danger,
            color: COLORS.white,
            marginLeft: 4,
            fontSize: 12,
            padding: '2px 8px',
          }}>
            {t('homePage.criticalPendingBadge', { count: criticalPending.length })}
          </span>
        </span>
        <span style={{
          fontSize: 12,
          color: COLORS.textMuted,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <Timer size={12} />
          {t('homePage.processPrompt')}
        </span>
      </div>

      {criticalPending.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 0',
          color: COLORS.success,
        }}>
          <CheckCircle size={48} style={{ marginBottom: 12 }} />
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('homePage.noCritical')}</div>
          <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 4 }}>
            {t('homePage.allCriticalDone')}
          </div>
        </div>
      ) : (
        <div style={{ maxHeight: 320, overflowY: 'auto' }} tabIndex={0} aria-label={t('homePage.ariaCriticalList')}>
          {criticalPending.map((cv, index) => (
            <div
              key={cv.id}
              style={{
                padding: '16px',
                marginBottom: index < criticalPending.length - 1 ? 12 : 0,
                background: 'rgba(239, 68, 68, 0.05)',
                borderRadius: 10,
                border: '1px solid rgba(239, 68, 68, 0.15)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* 左侧紧急色条 */}
              <div style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 4,
                background: cv.severity === '危急' ? COLORS.danger : COLORS.warning,
              }} />

              {/* 头部：患者信息和危急级别 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: 10,
                paddingLeft: 8,
              }}>
                <div>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 4,
                  }}>
                    <span style={{
                      fontSize: 15,
                      fontWeight: 800,
                      color: COLORS.text,
                    }}>
                      {cv.patientName}
                    </span>
                    <span style={{
                      ...badgeStyle,
                      background: `${MODALITY_COLORS[cv.modality] || '#94a3b8'}15`,
                      color: MODALITY_COLORS[cv.modality] || COLORS.textMuted,
                    }}>
                      {cv.modality}
                    </span>
                    <span style={{
                      ...badgeStyle,
                      background: cv.severity === '危急' ? COLORS.dangerBg : COLORS.warningBg,
                      color: cv.severity === '危急' ? COLORS.danger : COLORS.warning,
                      fontWeight: 700,
                    }}>
                      {cv.severity}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12,
                    color: COLORS.textMuted,
                  }}>
                    {cv.examItemName}
                  </div>
                </div>
                <span style={{
                  ...badgeStyle,
                  background: cv.status === '已接收' ? COLORS.successBg : COLORS.warningBg,
                  color: cv.status === '已接收' ? COLORS.success : COLORS.warning,
                  fontWeight: 600,
                }}>
                  {cv.status}
                </span>
              </div>

              {/* 危急描述 */}
              <div style={{
                fontSize: 12,
                color: COLORS.text,
                lineHeight: 1.6,
                padding: '10px 12px',
                background: 'var(--bg-card)',
                borderRadius: 6,
                marginBottom: 10,
                border: `1px solid ${COLORS.border}`,
                paddingLeft: 8,
              }}>
                {cv.findingDetails}
              </div>

              {/* 底部：报告医生和时间 */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                fontSize: 12,
                color: COLORS.textMuted,
                paddingLeft: 8,
              }}>
                <span>
                  {t('homePage.reportDoctor', { name: cv.reportedByName, time: cv.reportedTime })}
                </span>
                <span style={{ color: COLORS.danger }}>
                  {t('homePage.receivedBy', { name: cv.receivingDoctorName, time: cv.receivingTime })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 底部操作按钮 */}
      <div style={{
        marginTop: 16,
        paddingTop: 16,
        borderTop: `1px solid ${COLORS.border}`,
        display: 'flex',
        justifyContent: 'center',
        gap: 12,
      }}>
        <button
          onClick={() => navigate('/critical-value')}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: `1px solid ${COLORS.danger}`,
            background: 'var(--bg-card)',
            color: COLORS.danger,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <Eye size={14} />
          {t('homePage.viewAllCritical')}
        </button>
        <button
          onClick={() => navigate('/critical-value?action=process')}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            background: COLORS.danger,
            color: COLORS.white,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <CheckSquare size={14} />
          {t('homePage.processCritical')}
        </button>
      </div>
    </div>
  )

  // ============================================================
  // 区块8：医生排班表
  // ============================================================
  const renderDoctorSchedule = () => {
    // 筛选今日排班
    const todayStr = new Date().toISOString().slice(0, 10)
    const todaySchedule = initialDoctorSchedules.filter(
      s => s.date === todayStr
    )

    // 医生映射
    const doctorMap: Record<string, typeof initialUsers[0]> = {}
    initialUsers.forEach(u => { doctorMap[u.id] = u })

    // 上午班
    const morningShift = todaySchedule.filter(s =>
      s.timeSlot === '上午' || s.timeSlot === '全天'
    )
    // 下午班
    const afternoonShift = todaySchedule.filter(s =>
      s.timeSlot === '下午' || s.timeSlot === '全天'
    )

    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <UserCheck size={16} color={COLORS.primary} />
            {t('homePage.todaySchedule')}
          </span>
          <span style={{
            fontSize: 12,
            color: COLORS.textMuted,
          }}>
             {dateString}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 20 }}>
          {/* 上午班 */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 12,
              padding: '8px 12px',
              background: '#f59e0b22',
              borderRadius: 8,
            }}>
              <Clock size={14} style={{ color: 'var(--color-warning)' }} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-warning)',
              }}>
                {t('homePage.morningShift')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {morningShift.map((schedule) => (
                <div
                  key={schedule.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: COLORS.background,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: COLORS.text,
                      marginBottom: 2,
                    }}>
                      {schedule.doctorName}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}>
                      {doctorMap[schedule.doctorId]?.title || t('homePage.doctorTitle')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 12,
                      color: COLORS.text,
                      fontWeight: 600,
                    }}>
                      {schedule.modality}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}>
                      {schedule.room}
                    </div>
                  </div>
                  <span style={{
                    ...badgeStyle,
                    background: COLORS.successBg,
                    color: COLORS.success,
                  }}>
                    {t('homePage.onDuty')}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 下午班 */}
          <div style={{ flex: 1 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 12,
              padding: '8px 12px',
              background: '#3b82f622',
              borderRadius: 8,
            }}>
              <Clock size={14} style={{ color: 'var(--color-accent)' }} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-accent)',
              }}>
                {t('homePage.afternoonShift')}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {afternoonShift.map((schedule) => (
                <div
                  key={schedule.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: COLORS.background,
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: 13,
                      fontWeight: 700,
                      color: COLORS.text,
                      marginBottom: 2,
                    }}>
                      {schedule.doctorName}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}>
                      {doctorMap[schedule.doctorId]?.title || t('homePage.doctorTitle')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 12,
                      color: COLORS.text,
                      fontWeight: 600,
                    }}>
                      {schedule.modality}
                    </div>
                    <div style={{
                      fontSize: 12,
                      color: COLORS.textMuted,
                    }}>
                      {schedule.room}
                    </div>
                  </div>
                  <span style={{
                    ...badgeStyle,
                    background: COLORS.successBg,
                    color: COLORS.success,
                  }}>
                    {t('homePage.onDuty')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 区块9：影像质量统计
  // ============================================================
  const renderImageQuality = () => {
    // v3.0.6.8-23c (A8-P2-2): 移除错误的"100% 优良率"中心文字
    // 改为显示真实优良率 = 优秀% + 良好% (前两项)
    const top = qualityData[0]?.value ?? 0
    const second = qualityData[1]?.value ?? 0
    const excellentRate = top + second

    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <ImageIcon size={16} color={COLORS.primary} />
            {t('homePage.imageQuality')}
          </span>
          <span style={{
            ...badgeStyle,
            background: COLORS.successBg,
            color: COLORS.success,
          }}>
            {t('homePage.excellentRateBadge', { count: excellentRate })}
          </span>
        </div>

        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}>
          {/* 饼图 */}
          <div style={{ position: 'relative', width: 160, height: 160, flexShrink: 0 }}>
            <ChartContainer height={160} state={qualityData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('homePage.noQualityData')}>
              <PieChart>
                <Pie
                  data={qualityData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {qualityData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [`${value}%`, '']}
                  contentStyle={{
                    borderRadius: 8,
                    border: `1px solid ${COLORS.border}`,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ChartContainer>
            {/* 中心文字 - v3.0.6.8-23c (A8-P2-2): 显示真实优良率 */}
            <div style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
              pointerEvents: 'none',
            }}>
              <div style={{
                fontSize: 28,
                fontWeight: 700,
                color: COLORS.primary,
              }}>
                {excellentRate}%
              </div>
              <div style={{
                fontSize: 12,
                color: COLORS.textMuted,
              }}>
                {t('homePage.excellentRate')}
              </div>
            </div>
          </div>

          {/* 图例和数据 */}
          <div style={{ flex: 1 }}>
            {qualityData.map((item, index) => (
              <div
                key={item.name}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 0',
                  borderBottom: index < qualityData.length - 1
                    ? `1px solid ${COLORS.border}`
                    : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: item.color,
                  }} />
                  <span style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: COLORS.text,
                  }}>
                    {item.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 100,
                    height: 6,
                    background: COLORS.background,
                    borderRadius: 3,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${item.value}%`,
                      height: '100%',
                      background: item.color,
                      borderRadius: 3,
                    }} />
                  </div>
                  <span style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: COLORS.primary,
                    minWidth: 36,
                    textAlign: 'right',
                  }}>
                    {item.value}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ============================================================
  // 区块10：收入统计
  // ============================================================
  const renderRevenueStats = () => (
    <div style={cardStyle}>
      <div style={headerStyle}>
        <span style={cardTitleStyle}>
          <DollarSign size={16} color={COLORS.primary} />
          {t('homePage.revenueStats')}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {revenueData.map((item) => (
            <span
              key={item.period}
              style={{
                ...badgeStyle,
                background: item.value >= item.target
                  ? COLORS.successBg
                  : COLORS.warningBg,
                color: item.value >= item.target
                  ? COLORS.success
                  : COLORS.warning,
              }}
            >
              {item.period}
              {item.value >= item.target ? ' ✓' : ''}
            </span>
          ))}
        </div>
      </div>

      {/* 收入概览卡片 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
        marginBottom: 20,
      }}>
        {revenueData.map((item) => (
          <div
            key={item.period}
            style={{
              padding: '16px',
              background: COLORS.background,
              borderRadius: 10,
              textAlign: 'center',
            }}
          >
            <div style={{
              fontSize: 12,
              color: COLORS.textMuted,
              marginBottom: 6,
            }}>
              {item.period}
            </div>
            <div style={{
              fontSize: 28,
              fontWeight: 700,
              color: COLORS.primary,
              marginBottom: 4,
            }}>
              ¥{(item.value / 10000).toFixed(1)}{t('homePage.tenThousandUnit')}
            </div>
            <div style={{
              fontSize: 12,
              color: COLORS.textLight,
            }}>
              {t('homePage.targetAmount', { count: (item.target / 10000).toFixed(0) })}
            </div>
            <div style={{
              marginTop: 8,
              height: 4,
              background: COLORS.border,
              borderRadius: 2,
              overflow: 'hidden',
            }}>
              <div style={{
                width: `${Math.min(100, (item.value / item.target) * 100)}%`,
                height: '100%',
                background: item.value >= item.target
                  ? COLORS.success
                  : COLORS.warning,
                borderRadius: 2,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* 收入趋势图 */}
      <div style={{
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.textMuted,
        marginBottom: 12,
      }}>
        {t('homePage.weekRevenueTrend')}
      </div>
      <ChartContainer height={200} state={revenueTrendData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('homePage.noRevenueData')}>
        <AreaChart data={revenueTrendData}>
          <defs>
            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.success} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS.success} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 12, fill: COLORS.textMuted }}
            axisLine={{ stroke: COLORS.border }}
          />
          <YAxis
            tick={{ fontSize: 12, fill: COLORS.textMuted }}
            axisLine={{ stroke: COLORS.border }}
            tickFormatter={(value) => t('w9a.statsPage.currencyWan', { value: (value / 10000).toFixed(1) })}
          />
          <Tooltip
            formatter={(value: number) => [`¥${value.toLocaleString()}`, t('homePage.revenue')]}
            contentStyle={{
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="revenue"
            stroke={COLORS.success}
            strokeWidth={2.5}
            fill="url(#revenueGradient)"
            name={t('homePage.revenue')}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  )

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块11：今日工作清单（个人待办）
  // 待报告 / 待审核 / 待处置危急值 —— reportApi + criticalApi 真实派生
  // ============================================================
  const renderMyWorkList = () => {
    const todoCols = [
      {
        key: 'pendingReports',
        title: t('homePage.todoPendingReports'),
        icon: <ClipboardList size={16} />,
        color: COLORS.info,
        bg: COLORS.infoBg,
        items: myTodos.pendingReports.map((td, i) => ({ id: `pr-${i}`, title: td.patientName, sub: td.examItem, time: (td.createdAt ?? '').slice(11, 16) || '—', badge: td.priority === '紧急' || td.priority === '危重' ? t('homePage.urgentBadge') : undefined, badgeColor: COLORS.danger })),
        href: '/write-report',
      },
      {
        key: 'pendingReviews',
        title: t('homePage.todoPendingReviews'),
        icon: <FileCheck2 size={16} />,
        color: COLORS.purple,
        bg: COLORS.purpleBg,
        items: myTodos.pendingReviews.map((td, i) => ({ id: `rv-${i}`, title: td.patientName, sub: td.examItem, time: (td.createdAt ?? '').slice(11, 16) || '—', badge: td.state === 'CO_SIGN_REVIEW' ? t('homePage.cosignBadge') : undefined, badgeColor: COLORS.warning })),
        href: '/review-center',
      },
      {
        key: 'pendingCriticals',
        title: t('homePage.todoPendingCriticals'),
        icon: <ShieldAlert size={16} />,
        color: COLORS.danger,
        bg: COLORS.dangerBg,
        items: myTodos.pendingCriticals.map((td, i) => ({ id: `cv-${i}`, title: td.patientName, sub: td.finding || t('homePage.criticalFinding'), time: (td.triggeredAt ?? '').slice(11, 16) || '—', badge: td.severity === '危急' ? t('homePage.criticalBadge') : t('homePage.warningBadge'), badgeColor: td.severity === '危急' ? COLORS.danger : COLORS.warning })),
        href: '/critical-value',
      },
    ]
    return (
      <div aria-live="polite" style={cardStyle}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <ListChecks size={18} color={COLORS.primary} />
            {t('homePage.workListTitle')}
            <span style={{
              ...badgeStyle,
              background: workSource === 'real' ? COLORS.successBg : COLORS.warningBg,
              color: workSource === 'real' ? COLORS.success : COLORS.warning,
              marginLeft: 4,
            }}>
              {workSource === 'real' ? t('homePage.apiReal') : t('homePage.localFallback')}
            </span>
            {myTodoLoading && (
              <span style={{ fontSize: 11, color: COLORS.textLight }}>{t('homePage.syncing')}</span>
            )}
          </span>
          <button
            onClick={() => void loadMyTodos()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              border: `1px solid ${COLORS.border}`, background: 'var(--bg-card)',
              color: COLORS.textMuted, borderRadius: 6, padding: '4px 10px', fontSize: 12,
            }}
          >
            <RefreshCcw size={12} /> {t('homePage.refresh')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {todoCols.map(col => (
            <div key={col.key} style={{
              background: 'var(--bg-deep)',
              borderRadius: 10,
              border: `1px solid ${COLORS.border}`,
              padding: 14,
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                paddingBottom: 10, borderBottom: `1px solid ${COLORS.border}`,
              }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, background: col.bg,
                  color: col.color, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {col.icon}
                </div>
                <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{col.title}</span>
                <span style={{
                  marginLeft: 'auto', fontSize: 12, fontWeight: 700,
                  background: col.color, color: '#fff', borderRadius: 10,
                  padding: '1px 8px', minWidth: 20, textAlign: 'center',
                }}>
                  {col.items.length}
                </span>
              </div>
              <div style={{ maxHeight: 320, overflowY: 'auto' }} tabIndex={0} aria-label={t('w9a.homePage.listSuffix', { title: col.title })}>
                {col.items.length === 0 ? (
                  <EmptyState
                    type="nodata"
                    description={t('homePage.noTodoItems', { title: col.title })}
                    style={{ padding: '12px 0', gap: 4 }}
                  />
                ) : col.items.slice(0, 6).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => navigate(col.href)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      gap: 8, padding: '9px 10px', marginBottom: 6,
                      background: 'var(--bg-card)', borderRadius: 8,
                      border: `1px solid ${COLORS.border}`, cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = col.color }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = COLORS.border }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 600, color: COLORS.text,
                        display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.title}
                        {item.badge && (
                          <span style={{ ...badgeStyle, background: `${item.badgeColor}22`, color: item.badgeColor, fontSize: 10, padding: '0 6px' }}>
                            {item.badge}
                          </span>
                        )}
                      </div>
                      <div style={{
                        fontSize: 11, color: COLORS.textMuted, marginTop: 2,
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {item.sub}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: COLORS.textLight, flexShrink: 0 }}>{item.time}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        {myTodoError && (
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> {myTodoError}
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块12：科室动态（公告 + 今日值班）
  // deptApi.listActiveAnnouncements + listSchedules(今日)
  // ============================================================
  const renderDeptNews = () => {
    const CATEGORY_LABEL: Record<string, string> = {
      notice: t('homePage.catNotice'), meeting: t('homePage.catMeeting'), policy: t('homePage.catPolicy'), urgent: t('homePage.catUrgent'), other: t('homePage.catOther'),
    }
    const CATEGORY_COLOR: Record<string, string> = {
      notice: COLORS.info, meeting: COLORS.purple, policy: COLORS.success, urgent: COLORS.danger, other: COLORS.textMuted,
    }
    const SHIFT_LABEL: Record<string, string> = { DAY: t('homePage.shiftDay'), NIGHT: t('homePage.shiftNight'), WEEKEND: t('homePage.shiftWeekend') }
    return (
      <div style={cardStyle}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <Megaphone size={18} color={COLORS.primary} />
            {t('homePage.deptNews')}
            <span style={{
              ...badgeStyle,
              background: deptSource === 'real' ? COLORS.successBg : COLORS.warningBg,
              color: deptSource === 'real' ? COLORS.success : COLORS.warning,
              marginLeft: 4,
            }}>
              {deptSource === 'real' ? t('homePage.apiReal') : t('homePage.localFallback')}
            </span>
            {deptLoading && (
              <span style={{ fontSize: 11, color: COLORS.textLight }}>{t('homePage.syncing')}</span>
            )}
          </span>
          <span style={{ fontSize: 12, color: COLORS.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
            <Calendar size={12} /> {dateString}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 20 }}>
          {/* 左侧: 科室公告 */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Users size={14} color={COLORS.info} /> {t('homePage.deptAnnouncements')}
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }} tabIndex={0} aria-label={t('homePage.ariaAnnouncementList')}>
              {deptAnnouncements.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '30px 0', color: COLORS.textMuted, fontSize: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <Megaphone size={30} />
                  {t('homePage.noAnnouncements')}
                </div>
              ) : deptAnnouncements.slice(0, 5).map(a => (
                <div key={a.id} style={{
                  padding: '10px 12px', marginBottom: 8, background: 'var(--bg-deep)',
                  borderRadius: 8, border: `1px solid ${a.pinned ? `${COLORS.warning}66` : COLORS.border}`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      ...badgeStyle, fontSize: 10, padding: '0 8px',
                      background: `${CATEGORY_COLOR[a.category] ?? COLORS.textMuted}1a`,
                      color: CATEGORY_COLOR[a.category] ?? COLORS.textMuted,
                    }}>
                      {CATEGORY_LABEL[a.category] ?? a.category}
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.pinned ? '📌 ' : ''}{a.title}
                    </span>
                    <span style={{ fontSize: 11, color: COLORS.textLight, flexShrink: 0 }}>
                      {(a.createdAt ?? '').slice(5, 16).replace('T', ' ')}
                    </span>
                  </div>
                  <div style={{
                    fontSize: 12, color: COLORS.textMuted, lineHeight: 1.5,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                  }}>
                    {a.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 右侧: 今日值班 */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: COLORS.text, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <CalendarClock size={14} color={COLORS.warning} /> {t('homePage.todayOnCall')}
            </div>
            <div style={{ maxHeight: 260, overflowY: 'auto' }} tabIndex={0} aria-label={t('homePage.ariaOnCallList')}>
              {todayOnCall.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '30px 0', color: COLORS.textMuted, fontSize: 12,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                }}>
                  <CalendarClock size={30} />
                  {t('homePage.noOnCall')}
                </div>
              ) : todayOnCall.map(s => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  marginBottom: 8, background: 'var(--bg-deep)', borderRadius: 8,
                  border: `1px solid ${COLORS.border}`,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: s.shift === 'NIGHT' ? '#312e8133' : COLORS.infoBg,
                    color: s.shift === 'NIGHT' ? COLORS.purple : COLORS.info,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14,
                    flexShrink: 0,
                  }}>
                    {(s.doctorName ?? t('w9a.homePage.valueFallback')).slice(0, 1)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{s.doctorName}</div>
                    <div style={{ fontSize: 11, color: COLORS.textMuted }}>{s.role || t('homePage.onCallDoctor')}</div>
                  </div>
                  <span style={{
                    ...badgeStyle, fontSize: 11,
                    background: s.shift === 'NIGHT' ? COLORS.purpleBg : s.shift === 'WEEKEND' ? COLORS.warningBg : COLORS.successBg,
                    color: s.shift === 'NIGHT' ? COLORS.purple : s.shift === 'WEEKEND' ? COLORS.warning : COLORS.success,
                  }}>
                    {SHIFT_LABEL[s.shift] ?? s.shift}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {deptError && (
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> {deptError}
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块13：快捷操作增强（第二排入口）
  // 预约 / 登记 / 质控 / 排班 / 随访 / 病灶追踪
  // ============================================================
  const renderQuickActionsEnhanced = () => {
    const moreActions = [
      { icon: <Calendar size={20} />, label: t('homePage.actAppointment'), color: '#3b82f6', bg: '#3b82f622', href: '/appointments' },
      { icon: <UserPlus size={20} />, label: t('homePage.actRegister'), color: '#8b5cf6', bg: '#8b5cf622', href: '/exams' },
      { icon: <Target size={20} />, label: t('homePage.actQc'), color: '#10b981', bg: '#10b98122', href: '/qc' },
      { icon: <CalendarRange size={20} />, label: t('homePage.actSchedule'), color: '#f59e0b', bg: '#f59e0b22', href: '/schedule' },
      { icon: <Stethoscope size={20} />, label: t('homePage.actFollowUp'), color: '#ec4899', bg: '#ec489922', href: '/follow-up' },
      { icon: <Crosshair size={20} />, label: t('homePage.actLesion'), color: '#06b6d4', bg: '#06b6d422', href: '/patients' },
      { icon: <ClipboardPlus size={20} />, label: t('homePage.actTemplate'), color: '#6366f1', bg: '#6366f122', href: '/templates' },
      { icon: <BookOpen size={20} />, label: t('homePage.actCases'), color: '#a855f7', bg: '#a855f722', href: '/typical-cases' },
    ]
    return (
      <div style={{ ...cardStyle, marginBottom: 24, padding: 16 }}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <LayoutDashboard size={16} color={COLORS.primary} />
            {t('homePage.moreActions')}
          </span>
          <span style={{ fontSize: 12, color: COLORS.textMuted }}>{t('homePage.moreActionsHint')}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 10 }}>
          {moreActions.map(a => (
            <QuickActionButton
              key={a.label}
              icon={a.icon}
              label={a.label}
              color={a.color}
              bg={a.bg}
              onClick={() => navigate(a.href)}
            />
          ))}
        </div>
      </div>
    )
  }

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块14：检查量趋势细化（近 7 日按模态堆叠）
  // statsApi.getTrend(7) + getByModality → 堆叠柱状图
  // ============================================================
  const renderModalStackTrend = () => {
    const keys = Object.keys(modalStackData[0] ?? {}).filter(k => k !== 'day' && k !== '合计')
    const totalOfDay = (row: Record<string, string | number>) =>
      keys.reduce((s, k) => s + (Number(row[k]) || 0), 0)
    const maxTotal = Math.max(...modalStackData.map(r => totalOfDay(r)), 1)
    return (
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <BarChart3 size={16} color={COLORS.primary} />
            {t('homePage.modalTrendTitle')}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              ...badgeStyle,
              background: trendSource === 'real' ? COLORS.successBg : COLORS.warningBg,
              color: trendSource === 'real' ? COLORS.success : COLORS.warning,
            }}>
              {trendSource === 'real' ? t('homePage.apiReal') : t('homePage.localFallback')}
            </span>
            {trendLoading && (
              <span style={{ fontSize: 11, color: COLORS.textLight }}>{t('homePage.syncing')}</span>
            )}
            <button
              onClick={() => void loadModalTrend()}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
                border: `1px solid ${COLORS.border}`, background: 'var(--bg-card)',
                color: COLORS.textMuted, borderRadius: 6, padding: '4px 10px', fontSize: 12,
              }}
            >
              <RefreshCcw size={12} /> {t('homePage.refresh')}
            </button>
          </div>
        </div>

        <ChartContainer height={240} state={modalStackData.length === 0 ? 'empty' : 'ready'} emptyDescription={t('homePage.noTrendData')}>
          <BarChart data={modalStackData as unknown as Array<Record<string, unknown>>}>
            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.border} />
            <XAxis dataKey="day" tick={{ fontSize: 12, fill: COLORS.textMuted }} axisLine={{ stroke: COLORS.border }} />
            <YAxis tick={{ fontSize: 12, fill: COLORS.textMuted }} axisLine={{ stroke: COLORS.border }} />
            <Tooltip
              contentStyle={{
                borderRadius: 8, border: `1px solid ${COLORS.border}`,
                background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 12,
              }}
            />
            <Legend iconSize={10} iconType="circle" wrapperStyle={{ fontSize: 12, color: 'var(--text-secondary)' }} />
            {keys.map(k => (
              <Bar key={k} dataKey={k} name={k} stackId="modal" fill={MODALITY_COLORS[k] ?? '#94a3b8'} radius={[0, 0, 0, 0]} />
            ))}
            <Bar dataKey="合计" name={t('homePage.totalLabel')} fill="transparent" stroke="var(--color-primary-500)" strokeWidth={2} stackId="none" radius={[0, 0, 0, 0]} />
          </BarChart>
        </ChartContainer>

        {/* 每日合计摘要条 */}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          {modalStackData.slice(-7).map(row => (
            <div key={String(row.day)} style={{
              flex: 1, minWidth: 90, textAlign: 'center', padding: '8px 4px',
              background: 'var(--bg-deep)', borderRadius: 8, border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>{String(row.day)}</div>
              <div style={{
                fontSize: 18, fontWeight: 700, color: COLORS.primary,
                position: 'relative', overflow: 'hidden',
              }}>
                {Number(row.合计) || totalOfDay(row as Record<string, string | number>)}
                <div style={{
                  position: 'absolute', bottom: -2, left: '20%', right: '20%', height: 3, borderRadius: 2,
                  background: 'linear-gradient(90deg, var(--color-primary-500), var(--color-success))',
                  width: `${((Number(row.合计) || totalOfDay(row as Record<string, string | number>)) / maxTotal) * 60}%`,
                  margin: '0 auto',
                }} />
              </div>
            </div>
          ))}
        </div>
        {trendError && (
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> {trendError}
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块15：个人绩效卡（今日完成报告 / RVU 预估）
  // biApi.getPhysicianPerformance + worklistApi.getStats
  // ============================================================
  const renderPerfCard = () => {
    const perfItems = [
      {
        label: t('homePage.perfTodayReports'),
        value: String(perfCard.todayReports),
        unit: t('w9a.homePage.unitReports'),
        icon: <FileText size={22} />,
        color: COLORS.purple,
        bg: COLORS.purpleBg,
      },
      {
        label: t('homePage.perfRvu'),
        value: String(perfCard.rvu),
        unit: t('w9a.homePage.unitPoints'),
        icon: <Sparkles size={22} />,
        color: COLORS.warning,
        bg: COLORS.warningBg,
      },
      {
        label: t('homePage.perfQuality'),
        value: perfCard.qualityScore > 0 ? String(perfCard.qualityScore) : '—',
        unit: '',
        icon: <Award size={22} />,
        color: COLORS.success,
        bg: COLORS.successBg,
      },
      {
        label: t('homePage.perfAvgTat'),
        value: perfCard.timelinessMin > 0 ? String(perfCard.timelinessMin) : '—',
        unit: t('w9a.homePage.unitMinutes'),
        icon: <Timer size={22} />,
        color: COLORS.info,
        bg: COLORS.infoBg,
      },
    ]
    return (
      <div style={{ ...cardStyle, marginBottom: 24 }}>
        <div style={headerStyle}>
          <span style={cardTitleStyle}>
            <Gauge size={16} color={COLORS.primary} />
            {t('homePage.perfTitle')}
            <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textMuted, marginLeft: 4 }}>
              {perfCard.doctorName}
            </span>
            <span style={{
              ...badgeStyle,
              background: perfSource === 'real' ? COLORS.successBg : COLORS.warningBg,
              color: perfSource === 'real' ? COLORS.success : COLORS.warning,
              marginLeft: 4,
            }}>
              {perfSource === 'real' ? t('homePage.apiReal') : t('homePage.localEstimate')}
            </span>
            {perfLoading && (
              <span style={{ fontSize: 11, color: COLORS.textLight }}>{t('homePage.syncing')}</span>
            )}
          </span>
          <button
            onClick={() => void loadPerfCard()}
            style={{
              display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer',
              border: `1px solid ${COLORS.border}`, background: 'var(--bg-card)',
              color: COLORS.textMuted, borderRadius: 6, padding: '4px 10px', fontSize: 12,
            }}
          >
            <RefreshCcw size={12} /> {t('homePage.refresh')}
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          {perfItems.map(item => (
            <div key={item.label} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              background: 'var(--bg-deep)', borderRadius: 10,
              padding: '14px 16px', border: `1px solid ${COLORS.border}`,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: 10, background: item.bg,
                color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {item.icon}
              </div>
              <div>
                <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.primary, lineHeight: 1.2 }}>
                  {item.value}
                  <span style={{ fontSize: 12, fontWeight: 500, color: COLORS.textMuted, marginLeft: 3 }}>{item.unit}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textMuted, marginTop: 2 }}>{item.label}</div>
              </div>
            </div>
          ))}
        </div>
        {perfError && (
          <div style={{ marginTop: 10, fontSize: 11, color: COLORS.warning, display: 'flex', alignItems: 'center', gap: 4 }}>
            <AlertTriangle size={11} /> {perfError}
          </div>
        )}
      </div>
    )
  }

  // ============================================================
  // [v3.0.6.11-99 Wave10B] 区块16：数据源徽标（真实/演示）
  // ============================================================
  const renderDataSourceBadges = () => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16,
      padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8,
      border: `1px solid ${COLORS.border}`, flexWrap: 'wrap',
    }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, display: 'flex', alignItems: 'center', gap: 6 }}>
        <Database size={13} color={COLORS.info} /> {t('homePage.dataSource')}
      </span>
      {dataSourceBadges.map(b => (
        <span key={b.key} style={{
          ...badgeStyle,
          background: b.real ? COLORS.successBg : COLORS.warningBg,
          color: b.real ? COLORS.success : COLORS.warning,
          fontSize: 11,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: b.real ? COLORS.success : COLORS.warning,
          }} />
          {b.label}: {b.real ? t('homePage.badgeReal') : t('homePage.badgeDemo')}
        </span>
      ))}
      <span style={{ fontSize: 11, color: COLORS.textLight, marginLeft: 'auto' }}>
        statsApi · reportApi · criticalApi · deptApi · biApi · worklistApi
      </span>
    </div>
  )

  // ============================================================
  // 渲染主页面
  // ============================================================
  return (
    <PageContainer
      background="slate"
      maxWidth="standard"
      testId="home-page"
    >
      {/* [v3.0.6.11-103 Wave 5] 页面头: 面包屑 + 标题图标 + 子标题 */}
      <PageHeader
        variant="flex"
        icon={<IconRadiationSign size={24} color={COLORS.primary} />}
        title={t('homePage.pageTitle')}
        subtitle={`${HOSPITAL_NAME} · ${t('homePage.deptName')} · ${dateString}`}
        breadcrumb={[{ label: t('homePage.breadcrumbHome') }]}
        style={{ marginBottom: 16 }}
      />
      {loading && <LoadingBanner message={t('homePage.loadingStats')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {loadError && !loading && (
        <div style={{ marginTop: 8, padding: '8px 14px', borderRadius: 8, background: 'var(--color-warning-bg)', border: '1px solid var(--color-warning)', fontSize: 12, color: '#b45309', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={14} />
          <span><b>{t('w9a.homePage.demoData')}</b>：{t('homePage.demoNotice')}</span>
        </div>
      )}
      {/* CSS动画 */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      {/* 区块1：顶部问候区 */}
      {renderGreetingSection()}

      {/* 区块1.5：个人工作量统计 */}
      {renderPersonalWorkload()}

      {/* 区块2：快捷入口 */}
      {renderQuickActions()}

      {/* 区块3：今日概况 */}
      {renderTodayStats()}

      {/* 区块4：检查量趋势图 */}
      {renderExamTrendCharts()}

      {/* 区块5：设备状态监控 & 区块6：待处理检查 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        marginBottom: 24,
      }}>
        {renderDeviceStatus()}
        {renderPendingExams()}
      </div>

      {/* 区块7：危急值预警面板 */}
      {renderCriticalValuePanel()}

      {/* 区块8：医生排班表 & 区块9：影像质量统计 */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 20,
        marginBottom: 24,
      }}>
        {renderDoctorSchedule()}
        {renderImageQuality()}
      </div>

      {/* 区块10：收入统计 */}
      {renderRevenueStats()}

      {/* [v3.0.6.11-99 Wave10B] 区块16：数据源徽标 */}
      {renderDataSourceBadges()}

      {/* [v3.0.6.11-99 Wave10B] 区块11：今日工作清单（个人待办） */}
      {renderMyWorkList()}

      {/* [v3.0.6.11-99 Wave10B] 区块12：科室动态（公告 + 今日值班） */}
      {renderDeptNews()}

      {/* [v3.0.6.11-99 Wave10B] 区块13：快捷操作增强 */}
      {renderQuickActionsEnhanced()}

      {/* [v3.0.6.11-99 Wave10B] 区块14：检查量趋势细化（近7日按模态堆叠） */}
      {renderModalStackTrend()}

      {/* [v3.0.6.11-99 Wave10B] 区块15：个人绩效卡 */}
      {renderPerfCard()}

      {/* 页脚 */}
      <div style={{
        textAlign: 'center',
        padding: '24px 0 8px',
        fontSize: 12,
        color: COLORS.textLight,
      }}>
        {t('homePage.footer', { hospital: HOSPITAL_NAME, date: BUILD_DATE })}
      </div>
    </PageContainer>
  )
}

export default HomePage
