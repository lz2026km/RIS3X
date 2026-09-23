// G005 放射科RIS - 叫号管理页面
// 检查室状态面板 + 叫号队列列表 + 呼叫/重呼/完成按钮 + 统计面板
// 深蓝主色 #1e40af

import { Card } from 'antd'
import { useState, useEffect, useCallback } from 'react'
import { 
  Monitor, Users, Volume2, VolumeX, RefreshCw,
  Phone, Activity,
  CheckCircle, User,
  BarChart3, PieChart
} from 'lucide-react'
import { initialQueueCalls } from '../data/initialData'
import { queueApi } from '../services/api'
import { LoadingBanner, ErrorBanner } from '../components/feedback'
import { t } from '../i18n/appI18n'

// ============================================================
// 类型定义
// ============================================================

interface QueueCallItem {
  id: string
  queueNum: string
  patientId: string
  patientName: string
  gender: string
  age: number
  modality: string
  examItemName: string
  examRoom: string
  roomId: string
  status: '等待中' | '已呼叫' | '检查中' | '已完成' | '跳过'
  registerTime: string
  waitMinutes: number
  priority: '普通' | '紧急' | '危重'
  patientType: '急诊' | '住院' | '门诊' | '体检'
  calledCount: number
  lastCalledTime?: string
}

interface ExamRoomStatus {
  id: string
  name: string
  roomNumber: string
  modality: string[]
  status: '空闲' | '使用中' | '暂停' | '维护中'
  currentPatient: string | null
  currentQueueNum: string | null
  completedToday: number
  waitCount: number
  doctorName: string
}

// ============================================================
// 样式常量
// ============================================================
const PRIMARY = '#1e40af'
const PRIMARY_LIGHT = '#3b82f6'
const PRIMARY_DARK = '#1e3a8a'
const ACCENT_GREEN = '#22c55e'
const ACCENT_YELLOW = '#f59e0b'
const ACCENT_RED = '#ef4444'
const ACCENT_ORANGE = '#f97316'
const BG_LIGHT = 'var(--bg-card)'
const BG_CARD = '#ffffff'
const TEXT_DARK = '#1e293b'
const TEXT_MUTED = '#64748b'

// ============================================================
// 内联样式对象
// ============================================================
const styles: Record<string, React.CSSProperties> = {
  // 根容器
  root: {
    minHeight: '100vh',
    background: `linear-gradient(135deg, ${BG_LIGHT} 0%, #e2e8f0 100%)`,
    fontFamily: '"PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
  },

  // 顶部导航
  header: {
    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
    padding: '0 24px',
    height: 64,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    boxShadow: '0 4px 20px rgba(30, 64, 175, 0.3)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  headerLogo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    color: '#fff',
  },
  headerLogoIcon: {
    width: 40,
    height: 40,
    background: 'rgba(255,255,255,0.15)',
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
  },
  headerSubtitle: {
    fontSize: 12,
    opacity: 0.7,
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 20,
  },
  headerTime: {
    color: '#fff',
    textAlign: 'right' as const,
  },
  headerTimeValue: {
    fontSize: 20,
    fontWeight: 700,
    fontFamily: '"Roboto Mono", monospace',
  },
  headerDateValue: {
    fontSize: 12,
    opacity: 0.7,
  },
  headerBtn: {
    background: 'rgba(255,255,255,0.1)',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: 8,
    padding: '8px 16px',
    color: '#fff',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 13,
    fontWeight: 500,
  },

  // 主内容区
  mainContent: {
    display: 'flex',
    gap: 20,
    padding: 20,
    maxWidth: 1600,
    margin: '0 auto',
  },

  // 左侧面板 (65%)
  leftPanel: {
    flex: '0 0 65%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },

  // 右侧面板 (35%)
  rightPanel: {
    flex: '0 0 35%',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 20,
  },

  // 卡片通用样式
  card: {
    background: BG_CARD,
    borderRadius: 16,
    boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
    border: '1px solid var(--border-color)',
    overflow: 'hidden',
  },
  cardHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--border-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: PRIMARY,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  cardBody: {
    padding: 16,
  },

  // 检查室状态面板
  roomGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  roomCard: {
    background: BG_LIGHT,
    borderRadius: 12,
    padding: 16,
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  roomCardActive: {
    border: `2px solid ${PRIMARY}`,
    background: 'var(--color-info-bg)',
  },
  roomCardHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  roomName: {
    fontSize: 14,
    fontWeight: 700,
    color: TEXT_DARK,
  },
  roomStatus: {
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  roomStatusIdle: {
    background: 'var(--color-success-bg)',
    color: '#166534',
  },
  roomStatusBusy: {
    background: 'var(--color-warning-bg)',
    color: '#92400e',
  },
  roomStatusPause: {
    background: 'var(--color-error-bg)',
    color: '#991b1b',
  },
  roomInfo: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginBottom: 4,
  },
  roomPatient: {
    fontSize: 13,
    fontWeight: 600,
    color: TEXT_DARK,
    marginTop: 8,
  },
  roomStats: {
    display: 'flex',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTop: '1px solid var(--border-color)',
  },
  roomStat: {
    textAlign: 'center' as const,
    flex: 1,
  },
  roomStatValue: {
    fontSize: 18,
    fontWeight: 700,
    color: PRIMARY,
  },
  roomStatLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },

  // 当前叫号大屏
  callBanner: {
    background: `linear-gradient(135deg, ${PRIMARY} 0%, ${PRIMARY_DARK} 100%)`,
    borderRadius: 20,
    padding: '32px 40px',
    color: '#fff',
    position: 'relative',
    overflow: 'hidden',
    textAlign: 'center' as const,
  },
  callBannerBg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.1,
    backgroundImage: `radial-gradient(circle at 30% 50%, ${PRIMARY_LIGHT} 0%, transparent 50%), radial-gradient(circle at 70% 50%, #8b5cf6 0%, transparent 50%)`,
  },
  callLabel: {
    fontSize: 14,
    opacity: 0.8,
    letterSpacing: 4,
    marginBottom: 8,
  },
  callNumber: {
    fontSize: 100,
    fontWeight: 900,
    lineHeight: 1,
    textShadow: '0 4px 30px rgba(0,0,0,0.3)',
    letterSpacing: -2,
  },
  callPatientName: {
    fontSize: 42,
    fontWeight: 700,
    marginTop: 8,
    letterSpacing: 6,
  },
  callInfo: {
    fontSize: 18,
    opacity: 0.9,
    marginTop: 12,
  },
  callRoom: {
    fontSize: 16,
    opacity: 0.7,
    marginTop: 8,
  },
  callEmpty: {
    textAlign: 'center' as const,
    padding: '48px 24px',
  },
  callEmptyIcon: {
    width: 80,
    height: 80,
    background: 'rgba(255,255,255,0.1)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 16px',
  },
  callEmptyText: {
    fontSize: 20,
    opacity: 0.6,
  },
  callEmptySubtext: {
    fontSize: 14,
    opacity: 0.4,
    marginTop: 4,
  },

  // 候诊队列列表
  queueList: {
    maxHeight: 400,
    overflowY: 'auto' as const,
  },
  queueItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
    gap: 12,
    transition: 'background 0.15s ease',
  },
  queueItemHover: {
    background: 'var(--bg-card)',
  },
  queueNum: {
    fontSize: 16,
    fontWeight: 800,
    color: PRIMARY,
    width: 60,
  },
  queueInfo: {
    flex: 1,
  },
  queuePatientName: {
    fontSize: 14,
    fontWeight: 600,
    color: TEXT_DARK,
  },
  queueExam: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 2,
  },
  queueMeta: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  queueTag: {
    padding: '2px 8px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  queueTagEmergency: {
    background: 'var(--color-error-bg)',
    color: '#991b1b',
  },
  queueTagUrgent: {
    background: 'var(--color-warning-bg)',
    color: '#92400e',
  },
  queueTagNormal: {
    background: 'var(--border-color)',
    color: 'var(--text-secondary)',
  },
  queueWait: {
    fontSize: 12,
    color: TEXT_MUTED,
  },
  queueActions: {
    display: 'flex',
    gap: 6,
  },

  // 操作按钮
  btnCall: {
    background: PRIMARY,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  btnRecall: {
    background: ACCENT_ORANGE,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  btnComplete: {
    background: ACCENT_GREEN,
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },

  // 统计面板
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: 12,
  },
  statCard: {
    background: BG_LIGHT,
    borderRadius: 12,
    padding: 16,
    textAlign: 'center' as const,
  },
  statValue: {
    fontSize: 26,
    fontWeight: 700,
    color: PRIMARY,
  },
  statLabel: {
    fontSize: 12,
    color: TEXT_MUTED,
    marginTop: 4,
  },
  statChange: {
    fontSize: 12,
    marginTop: 4,
  },
  statChangeUp: {
    color: ACCENT_GREEN,
  },
  statChangeDown: {
    color: ACCENT_RED,
  },

  // 优先级徽章
  priorityBadge: {
    padding: '4px 8px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 700,
  },
  priorityCritical: {
    background: 'var(--color-error-bg)',
    color: '#991b1b',
  },
  priorityUrgent: {
    background: 'var(--color-warning-bg)',
    color: '#92400e',
  },
  priorityNormal: {
    background: 'var(--border-color)',
    color: 'var(--text-secondary)',
  },

  // 患者类型标签
  typeBadge: {
    padding: '2px 6px',
    borderRadius: 4,
    fontSize: 12,
    fontWeight: 600,
  },
  typeEmergency: { background: 'var(--color-error-bg)', color: '#dc2626' },
  typeInpatient: { background: 'var(--color-info-bg)', color: '#2563eb' },
  typeOutpatient: { background: 'var(--color-success-bg)', color: '#16a34a' },
  typeCheckup: { background: 'var(--color-warning-bg)', color: '#d97706' },

  // 状态标签
  statusBadge: {
    padding: '4px 10px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
  },
  statusWaiting: { background: 'var(--border-color)', color: 'var(--text-secondary)' },
  statusCalled: { background: 'var(--color-info-bg)', color: '#2563eb' },
  statusExamining: { background: 'var(--color-warning-bg)', color: '#d97706' },
  statusDone: { background: 'var(--color-success-bg)', color: '#16a34a' },
  statusSkipped: { background: '#8b5cf622', color: '#7c3aed' },

  // 工具栏
  toolbar: {
    display: 'flex',
    gap: 8,
    padding: '12px 16px',
    borderBottom: '1px solid var(--border-light)',
    background: 'var(--bg-card)',
  },
  searchInput: {
    flex: 1,
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
  },
  filterSelect: {
    padding: '8px 12px',
    border: '1px solid var(--border-color)',
    borderRadius: 8,
    fontSize: 13,
    outline: 'none',
    background: 'var(--bg-card)',
  },
}

// ============================================================
// 辅助函数
// ============================================================
const getPriorityStyle = (priority: string) => {
  switch (priority) {
    case '危重': return styles.priorityCritical
    case '紧急': return styles.priorityUrgent
    default: return styles.priorityNormal
  }
}

const getTypeStyle = (type: string) => {
  switch (type) {
    case '急诊': return styles.typeEmergency
    case '住院': return styles.typeInpatient
    case '门诊': return styles.typeOutpatient
    case '体检': return styles.typeCheckup
    default: return styles.priorityNormal
  }
}

const getStatusStyle = (status: string) => {
  switch (status) {
    case '等待中': return styles.statusWaiting
    case '已呼叫': return styles.statusCalled
    case '检查中': return styles.statusExamining
    case '已完成': return styles.statusDone
    case '跳过': return styles.statusSkipped
    default: return styles.statusWaiting
  }
}

const getRoomStatusStyle = (status: string) => {
  switch (status) {
    case '空闲': return styles.roomStatusIdle
    case '使用中': return styles.roomStatusBusy
    case '暂停': return styles.roomStatusPause
    default: return styles.roomStatusIdle
  }
}

const formatTime = (date: Date) => {
  return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

const formatDate = (date: Date) => {
  return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short' })
}

// ============================================================
// 组件定义
// ============================================================
export default function QueueCallPage() {
  const [queueCalls, setQueueCalls] = useState<QueueCallItem[]>([])
  const [currentTime, setCurrentTime] = useState(() => new Date())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterModality, setFilterModality] = useState('全部')
  const [filterStatus, setFilterStatus] = useState('全部')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true)

  // API 加载排队数据
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  // [G005 W1-C] 检查室状态: 接入 queueApi.getRoomStatus (GET /queue/rooms, 后端 queue.controller)
  const [examRooms, setExamRooms] = useState<ExamRoomStatus[]>([])
  const [roomsFromApi, setRoomsFromApi] = useState(false)

  // [G005 Wave1A P0] 房间明细: GET /queue/:roomId + GET /queue/:roomId/status (点击检查室卡片加载)
  const [roomDetail, setRoomDetail] = useState<{ roomId: string; roomName: string; queue: any[] } | null>(null)
  const [roomDetailStatus, setRoomDetailStatus] = useState<any | null>(null)
  const [roomDetailLoading, setRoomDetailLoading] = useState(false)

  // [G005 Wave1A P0] 选中房间 → 拉取房间队列与实时状态
  useEffect(() => {
    if (!selectedRoom) { setRoomDetail(null); setRoomDetailStatus(null); return }
    let cancelled = false
    setRoomDetailLoading(true)
    setRoomDetail(null)
    void (async () => {
      try {
        const [q, s] = await Promise.all([
          queueApi.getRoomQueue(selectedRoom),
          queueApi.getRoomStatusDetail(selectedRoom),
        ])
        if (cancelled) return
        if (q.success && q.data) setRoomDetail(q.data as any)
        if (s.success && s.data) setRoomDetailStatus(s.data)
      } catch { /* 静默 */ }
      if (!cancelled) setRoomDetailLoading(false)
    })()
    return () => { cancelled = true }
  }, [selectedRoom])

  // 模拟检查室数据 (API 不可用时回退)
  const mockExamRooms: ExamRoomStatus[] = [
    { id: 'ROOM-CT1', name: 'CT室1', roomNumber: 'CT-01', modality: ['CT'], status: '使用中', currentPatient: '王芳', currentQueueNum: 'Q002', completedToday: 12, waitCount: 5, doctorName: '李明辉' },
    { id: 'ROOM-MR1', name: 'MR室1', roomNumber: 'MR-01', modality: ['MR'], status: '空闲', currentPatient: null, currentQueueNum: null, completedToday: 8, waitCount: 3, doctorName: '王秀峰' },
    { id: 'ROOM-DR1', name: 'DR室1', roomNumber: 'DR-01', modality: ['DR'], status: '空闲', currentPatient: null, currentQueueNum: null, completedToday: 15, waitCount: 7, doctorName: '张海涛' },
    { id: 'ROOM-DSA1', name: 'DSA室1', roomNumber: 'DSA-01', modality: ['DSA'], status: '使用中', currentPatient: '刘洋', currentQueueNum: 'Q004', completedToday: 3, waitCount: 2, doctorName: '刘芳' },
    { id: 'ROOM-MG1', name: '钼靶室1', roomNumber: 'MG-01', modality: ['MG'], status: '空闲', currentPatient: null, currentQueueNum: null, completedToday: 6, waitCount: 4, doctorName: '赵晓敏' },
    { id: 'ROOM-CT2', name: 'CT室2', roomNumber: 'CT-02', modality: ['CT'], status: '暂停', currentPatient: null, currentQueueNum: null, completedToday: 10, waitCount: 0, doctorName: '陈志强' },
  ]

  // [G005 W1-C] 加载房间状态 (后端 /queue/rooms, 失败回退本地演示数据)
  const loadRooms = useCallback(async () => {
    try {
      const res = await queueApi.getRoomStatus()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        const mapped = (res.data as unknown as Array<Record<string, unknown>>).map((r) => ({
          id: String(r.id ?? ''),
          name: String(r.name ?? r.roomNumber ?? '检查室'),
          roomNumber: String(r.roomNumber ?? r.id ?? ''),
          modality: Array.isArray(r.modality) ? r.modality as string[] : [String(r.modality ?? '')],
          status: (['空闲', '使用中', '暂停', '维护中'].includes(String(r.status)) ? String(r.status) : String(r.status)) as ExamRoomStatus['status'],
          currentPatient: (r.currentPatient as string | null) ?? null,
          currentQueueNum: (r.currentQueueNum as string | null) ?? null,
          completedToday: Number(r.completedToday ?? 0),
          waitCount: Number(r.waitCount ?? r.queueCount ?? 0),
          doctorName: '--',
        })).filter((r) => r.id)
        if (mapped.length > 0) {
          setExamRooms(mapped)
          setRoomsFromApi(true)
          return
        }
      }
    } catch { /* fallback 本地演示数据 */ }
    if (examRooms.length === 0) {
      setExamRooms(mockExamRooms)
      setRoomsFromApi(false)
    }
  }, [examRooms.length])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await queueApi.list()
      if (cancelled) return
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setQueueCalls(res.data as unknown as QueueCallItem[])
        setLoadError(null)
      } else {
        setQueueCalls(initialQueueCalls)
        setLoadError(t('queueCall.loadFailedLocal'))
      }
      setLoading(false)
    })()
    void loadRooms()
    return () => { cancelled = true }
  }, [loadRooms])

  // 实时轮询更新队列
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await queueApi.list()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setQueueCalls(res.data as unknown as QueueCallItem[])
      }
      void loadRooms()
    }, 15000)
    return () => clearInterval(interval)
  }, [loadRooms])

  // 定时更新时钟(后台标签暂停刷新,1 分钟粒度)
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') setCurrentTime(new Date())
    }, 60000)
    return () => clearInterval(timer)
  }, [])

  // 统计数据
  const stats = {
    totalWaiting: queueCalls.filter(q => q.status === '等待中').length,
    totalCalled: queueCalls.filter(q => q.status === '已呼叫').length,
    totalCompleted: queueCalls.filter(q => q.status === '已完成').length,
    avgWaitMinutes: Math.round(
      queueCalls.filter(q => q.status !== '已完成').reduce((sum, q) => sum + q.waitMinutes, 0) / 
      (queueCalls.filter(q => q.status !== '已完成').length || 1)
    ),
  }

  // [G005 W1-C] 检查室数据来源: queueApi.getRoomStatus() 后端 /queue/rooms, 失败回退本地演示数据
  // (examRooms 由 state + loadRooms 提供, 见上方)

  // 当前呼叫的患者（已呼叫状态中等待最久的）
  const currentCalled = queueCalls
    .filter(q => q.status === '已呼叫')
    .sort((a, b) => a.waitMinutes - b.waitMinutes)[0]

  // 筛选后的队列
  const filteredQueue = queueCalls.filter(q => {
    const matchesSearch = q.patientName.includes(searchTerm) || q.queueNum.includes(searchTerm)
    const matchesModality = filterModality === '全部' || q.modality === filterModality
    const matchesStatus = filterStatus === '全部' || q.status === filterStatus
    return matchesSearch && matchesModality && matchesStatus
  })

  // 叫号操作
  const handleCall = async (item: QueueCallItem) => {
    await queueApi.call(item.roomId, item.patientId ? { patientId: item.patientId } : undefined)
    setQueueCalls(prev => prev.map(q => 
      q.id === item.id 
        ? { ...q, status: '已呼叫' as const, calledCount: q.calledCount + 1, lastCalledTime: currentTime.toLocaleString('zh-CN') }
        : q
    ))
  }

  // 重呼操作
  const handleRecall = async (item: QueueCallItem) => {
    await queueApi.recall(item.id)
    setQueueCalls(prev => prev.map(q => 
      q.id === item.id 
        ? { ...q, calledCount: q.calledCount + 1, lastCalledTime: currentTime.toLocaleString('zh-CN') }
        : q
    ))
  }

  // 完成操作
  const handleComplete = async (item: QueueCallItem) => {
    await queueApi.complete(item.id)
    setQueueCalls(prev => prev.map(q => 
      q.id === item.id ? { ...q, status: '已完成' as const } : q
    ))
  }

  // [v3.0.6.11-104 Wave 2D] 调整排队优先级 (POST /queue/:id/priority)
  const handleSetPriority = async (item: QueueCallItem, priority: QueueCallItem['priority']) => {
    const res = await queueApi.setPriority(item.id, priority)
    if (res.success) {
      setQueueCalls(prev => prev.map(q => (q.id === item.id ? { ...q, priority } : q)))
    } else {
      setLoadError(res.error?.message ?? t('queueCall.priorityUpdateFailed'))
    }
  }

  return (
    <div data-testid="queue-call-page" style={styles.root}>
      {loading && <LoadingBanner message={t('queueCall.loading')} />}
      {loadError && !loading && <ErrorBanner message={loadError} />}
      {/* 顶部导航 */}
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <div style={styles.headerLogo}>
            <div style={styles.headerLogoIcon}>
              <Phone size={22} color="#fff" />
            </div>
            <div>
              <div style={styles.headerTitle}>{t('queueCall.title')}</div>
              <div style={styles.headerSubtitle}>{t('queueCall.subtitle')}</div>
            </div>
          </div>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.headerTime}>
            <div style={styles.headerTimeValue}>{formatTime(currentTime)}</div>
            <div style={styles.headerDateValue}>{formatDate(currentTime)}</div>
          </div>
          <button style={styles.headerBtn} onClick={() => { setQueueCalls([...queueCalls]); }}>
            <RefreshCw size={14} />
            {t('queueCall.refresh')}
          </button>
          <button style={styles.headerBtn} onClick={() => { setIsVoiceEnabled(!isVoiceEnabled); }}>
            <Volume2 size={14} />
            {t('queueCall.voice')}
          </button>
        </div>
      </header>

      {/* 主内容区 */}
      <main style={styles.mainContent}>
        {/* 左侧面板 */}
        <div style={styles.leftPanel}>
          {/* 当前叫号大屏 */}
          <div style={styles.card}>
            {currentCalled ? (
              <div style={styles.callBanner}>
                <div style={styles.callBannerBg} />
                <div style={styles.callLabel}>{t('queueCall.goToRoom')}</div>
                <div style={styles.callNumber}>{currentCalled.queueNum}</div>
                <div style={styles.callPatientName}>{currentCalled.patientName}</div>
                <div style={styles.callInfo}>{currentCalled.examItemName} · {currentCalled.modality}</div>
                <div style={styles.callRoom}>{currentCalled.examRoom}</div>
              </div>
            ) : (
              <div style={styles.callBanner}>
                <div style={styles.callBannerBg} />
                <div style={styles.callEmpty}>
                  <div style={styles.callEmptyIcon}>
                    <VolumeX size={36} color="rgba(255,255,255,0.5)" />
                  </div>
                  <div style={styles.callEmptyText}>{t('queueCall.noWaiting')}</div>
                  <div style={styles.callEmptySubtext}>{t('queueCall.selectHint')}</div>
                </div>
              </div>
            )}
          </div>

          {/* 叫号队列列表 */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <Users size={18} />
                {t('queueCall.queueTitle', { count: filteredQueue.length })}
              </div>
            </div>
            
            {/* 工具栏 */}
            <div style={styles.toolbar}>
              <input 
                style={styles.searchInput}
                placeholder={t('queueCall.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <select 
                style={styles.filterSelect}
                value={filterModality}
                onChange={e => setFilterModality(e.target.value)}
              >
                <option value="全部">{t('queueCall.allTypes')}</option>
                <option value="CT">CT</option>
                <option value="MR">MR</option>
                <option value="DR">DR</option>
                <option value="DSA">DSA</option>
                <option value="乳腺钼靶">乳腺钼靶</option>
              </select>
              <select 
                style={styles.filterSelect}
                value={filterStatus}
                onChange={e => setFilterStatus(e.target.value)}
              >
                <option value="全部">{t('queueCall.allStatus')}</option>
                <option value="等待中">等待中</option>
                <option value="已呼叫">已呼叫</option>
                <option value="检查中">检查中</option>
              </select>
            </div>

            {/* 队列列表 */}
            <div style={styles.queueList}>
              {filteredQueue.slice(0, 20).map((item) => (
                <div 
                  key={item.id} 
                  style={styles.queueItem}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  <div style={styles.queueNum}>{item.queueNum}</div>
                  <div style={styles.queueInfo}>
                    <div style={styles.queuePatientName}>{item.patientName}</div>
                    <div style={styles.queueExam}>{item.examItemName} · {item.modality}</div>
                    <div style={styles.queueMeta}>
                      <span style={{ ...styles.typeBadge, ...getTypeStyle(item.patientType) }}>
                        {item.patientType}
                      </span>
                      <span style={{ ...styles.priorityBadge, ...getPriorityStyle(item.priority) }}>
                        {item.priority}
                      </span>
                      {/* [v3.0.6.11-104 Wave 2D] 优先级调整 (POST /queue/:id/priority) */}
                      <select
                        value={item.priority}
                        onChange={(e) => void handleSetPriority(item, e.target.value as QueueCallItem['priority'])}
                        title={t('queueCall.priorityTitle')}
                        style={{
                          fontSize: 12, borderRadius: 4, padding: '1px 4px',
                          border: '1px solid var(--border-color)',
                          background: 'var(--bg-card)', color: 'var(--text-primary)', cursor: 'pointer',
                        }}
                      >
                        <option value="普通">普通</option>
                        <option value="紧急">紧急</option>
                        <option value="危重">危重</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' as const, minWidth: 80 }}>
                    <div style={{ ...styles.statusBadge, ...getStatusStyle(item.status) }}>
                      {item.status}
                    </div>
                    <div style={styles.queueWait}>{t('queueCall.waitMinutes', { n: item.waitMinutes })}</div>
                  </div>
                  <div style={styles.queueActions}>
                    {item.status === '等待中' && (
                      <button 
                        style={styles.btnCall}
                        onClick={() => handleCall(item)}
                      >
                        <Phone size={12} /> {t('queueCall.call')}
                      </button>
                    )}
                    {item.status === '已呼叫' && (
                      <>
                        <button 
                          style={styles.btnRecall}
                          onClick={() => handleRecall(item)}
                        >
                          <RefreshCw size={12} /> {t('queueCall.recall')}
                        </button>
                        <button 
                          style={styles.btnComplete}
                          onClick={() => handleComplete(item)}
                        >
                          <CheckCircle size={12} /> 完成
                        </button>
                      </>
                    )}
                    {item.status === '检查中' && (
                      <button 
                        style={styles.btnComplete}
                        onClick={() => handleComplete(item)}
                      >
                        <CheckCircle size={12} /> {t('queueCall.complete')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {filteredQueue.length === 0 && (
                <div style={{ ...styles.callEmpty, padding: 32 }}>
                  <div style={styles.callEmptyText}>{t('queueCall.noMatch')}</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 右侧面板 */}
        <div style={styles.rightPanel}>
          {/* 检查室状态面板 */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <Monitor size={18} />
                {t('queueCall.roomStatus')}
              </div>
              <span style={{ fontSize: 12, color: TEXT_MUTED }}>{t('queueCall.roomCount', { count: examRooms.length })} {roomsFromApi ? t('queueCall.realtime') : t('queueCall.demoData')}</span>
            </div>
            <div style={{ ...styles.cardBody, padding: 12 }}>
              <div style={styles.roomGrid}>
                {examRooms.map(room => (
                  <Card
                    key={room.id}
                    bordered={false}
                    style={{
                      ...styles.roomCard,
                      ...(selectedRoom === room.id ? styles.roomCardActive : {})
                    }}
                    styles={{ body: { padding: 0 } }}
                    onClick={() => setSelectedRoom(selectedRoom === room.id ? null : room.id)}
                  >
                    <div style={styles.roomCardHeader}>
                      <div style={styles.roomName}>{room.name}</div>
                      <div style={{ ...styles.roomStatus, ...getRoomStatusStyle(room.status) }}>
                        {room.status}
                      </div>
                    </div>
                    <div style={styles.roomInfo}>{room.modality.join('/')}</div>
                    {room.currentPatient && (
                      <div style={styles.roomPatient}>
                        <User size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />
                        {room.currentPatient} ({room.currentQueueNum})
                      </div>
                    )}
                    <div style={styles.roomStats}>
                      <div style={styles.roomStat}>
                        <div style={styles.roomStatValue}>{room.completedToday}</div>
                        <div style={styles.roomStatLabel}>{t('queueCall.todayCompleted')}</div>
                      </div>
                      <div style={styles.roomStat}>
                        <div style={styles.roomStatValue}>{room.waitCount}</div>
                        <div style={styles.roomStatLabel}>{t('queueCall.waitingCount')}</div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
              {/* [G005 Wave1A P0] 房间明细: 房间队列 (GET /queue/:roomId) + 实时状态 (GET /queue/:roomId/status) */}
              {selectedRoom && (
                <div style={{ marginTop: 12, padding: 12, background: 'var(--color-info-bg)', borderRadius: 10, border: `1px solid ${PRIMARY_LIGHT}40` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: PRIMARY }}>
                      {roomDetail?.roomName ?? selectedRoom} {t('queueCall.roomDetail')}
                    </span>
                    <button
                      style={{ background: 'none', border: 'none', color: TEXT_MUTED, fontSize: 12, cursor: 'pointer' }}
                      onClick={() => setSelectedRoom(null)}
                    >
                      {t('queueCall.close')}
                    </button>
                  </div>
                  {roomDetailLoading ? (
                    <div style={{ fontSize: 12, color: TEXT_MUTED }}>{t('queueCall.loadingRoomQueue')}</div>
                  ) : (
                    <>
                      {roomDetailStatus && (
                        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: TEXT_MUTED, marginBottom: 8 }}>
                          <span>{t('queueCall.statusLabel')} <b style={{ color: getRoomStatusStyle(roomDetailStatus.status) === styles.roomStatusBusy ? ACCENT_YELLOW : ACCENT_GREEN }}>{roomDetailStatus.status ?? '-'}</b></span>
                          <span>{t('queueCall.currentPatient')} <b style={{ color: TEXT_DARK }}>{roomDetailStatus.currentPatient ?? t('queueCall.none')}</b></span>
                          <span>{t('queueCall.waitLabel')} <b style={{ color: TEXT_DARK }}>{roomDetailStatus.waitCount ?? 0}</b></span>
                        </div>
                      )}
                      <div style={{ maxHeight: 220, overflowY: 'auto' as const }}>
                        {(roomDetail?.queue ?? []).length === 0 ? (
                          <div style={{ fontSize: 12, color: TEXT_MUTED }}>{t('queueCall.emptyRoomQueue')}</div>
                        ) : (roomDetail?.queue ?? []).map((q: any, idx: number) => (
                          <div key={q.id ?? idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border-color)' }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: PRIMARY, width: 50 }}>{q.queueNum ?? '-'}</span>
                            <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{q.patientName ?? '-'}</span>
                            <span style={{ fontSize: 12, color: TEXT_MUTED }}>{q.examItemName ?? q.examItem ?? ''}</span>
                            <span style={{ ...styles.statusBadge, ...getStatusStyle(q.status) }}>{q.status ?? '-'}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 统计面板 */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <BarChart3 size={18} />
                {t('queueCall.todayStats')}
              </div>
            </div>
            <div style={styles.cardBody}>
              <div style={styles.statsGrid}>
                <Card bordered={false} style={styles.statCard} styles={{ body: { padding: 0 } }}>
                  <div style={{ ...styles.statValue, color: ACCENT_ORANGE }}>
                    {stats.totalWaiting}
                  </div>
                  <div style={styles.statLabel}>{t('queueCall.stat.waiting')}</div>
                </Card>
                <Card bordered={false} style={styles.statCard} styles={{ body: { padding: 0 } }}>
                  <div style={{ ...styles.statValue, color: PRIMARY_LIGHT }}>
                    {stats.totalCalled}
                  </div>
                  <div style={styles.statLabel}>{t('queueCall.stat.called')}</div>
                </Card>
                <Card bordered={false} style={styles.statCard} styles={{ body: { padding: 0 } }}>
                  <div style={{ ...styles.statValue, color: ACCENT_GREEN }}>
                    {stats.totalCompleted}
                  </div>
                  <div style={styles.statLabel}>{t('queueCall.stat.completed')}</div>
                </Card>
                <Card bordered={false} style={styles.statCard} styles={{ body: { padding: 0 } }}>
                  <div style={styles.statValue}>
                    {stats.avgWaitMinutes}
                  </div>
                  <div style={styles.statLabel}>{t('queueCall.stat.avgWait')}</div>
                </Card>
              </div>
            </div>
          </div>

          {/* 类型分布 */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <PieChart size={18} />
                {t('queueCall.typeDistribution')}
              </div>
            </div>
            <div style={styles.cardBody}>
              {['急诊', '住院', '门诊', '体检'].map(type => {
                const count = queueCalls.filter(q => q.patientType === type && q.status !== '已完成').length
                const total = queueCalls.filter(q => q.status !== '已完成').length
                const percent = total > 0 ? Math.round((count / total) * 100) : 0
                return (
                  <div key={type} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ ...styles.typeBadge, ...getTypeStyle(type) }}>{type}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{count}{t('queueCall.personSuffix')}</span>
                    </div>
                    <div style={{ background: 'var(--border-color)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: PRIMARY,
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* 优先级分布 */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <div style={styles.cardTitle}>
                <Activity size={18} />
                {t('queueCall.priorityDistribution')}
              </div>
            </div>
            <div style={styles.cardBody}>
              {['危重', '紧急', '普通'].map(priority => {
                const count = queueCalls.filter(q => q.priority === priority && q.status !== '已完成').length
                const total = queueCalls.filter(q => q.status !== '已完成').length
                const percent = total > 0 ? Math.round((count / total) * 100) : 0
                const color = priority === '危重' ? ACCENT_RED : priority === '紧急' ? ACCENT_YELLOW : PRIMARY
                return (
                  <div key={priority} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ ...styles.priorityBadge, ...getPriorityStyle(priority) }}>{priority}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: TEXT_DARK }}>{count}{t('queueCall.personSuffix')}</span>
                    </div>
                    <div style={{ background: 'var(--border-color)', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${percent}%`, 
                        height: '100%', 
                        background: color,
                        borderRadius: 4,
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
