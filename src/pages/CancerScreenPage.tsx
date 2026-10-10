// ============================================================
// G005 放射科早癌筛查平台
// 放射科早癌筛查 - 肺癌LDCT/乳腺癌/消化道癌筛查管理
// ============================================================
import { useState, useMemo, useEffect, useCallback } from 'react'
import { Spin, message as antdMessage, Select } from 'antd'
import {
  AlertTriangle, Target, Heart, MapPin, TrendingUp,
  Plus, Search, Filter, Download, RefreshCw,
  CheckCircle, ArrowUp, Microscope,
  Edit, Eye, ClipboardList,
  Circle, FileSearch, Inbox, Wind, Scan, FileImage,
  ListOrdered, Flag
} from 'lucide-react'
import { screeningApi, type ScreeningTrendDto } from '../services/api/screeningApi'
import { t } from '../i18n/appI18n'
import { uniqueId } from '../utils/uniqueId'
import { StatCard as CommonStatCard } from '../components/common/StatCard'
import { DataTable } from '../components/common/DataTable'
import { StatusTag } from '../components/common/StatusTag'
import { SeverityTag } from '../components/common/SeverityTag'
import { severityColor, severityTone } from '../theme/statusTokens'

// ---------- 统计数据 ----------
const statsData = [
  { label: t('cancerScreen.statLdct'), value: '8,642', unit: '人', icon: Wind, color: 'var(--color-primary-600)', bg: '#3b82f622' },
  { label: t('cancerScreen.statBreast'), value: '5,826', unit: '人', sub: '含钼靶/超声', icon: Heart, color: '#ec4899', bg: '#ec489922' },
  { label: t('cancerScreen.statHighRisk'), value: '1,284', unit: '例', sub: 'LDCT 14.9%', icon: AlertTriangle, color: '#ea580c', bg: '#f9731622' },
  { label: t('cancerScreen.statEarlyCancer'), value: '326', unit: '例', sub: '检出率2.37%', icon: Target, color: 'var(--color-error-600)', bg: '#ef444422' },
  { label: t('cancerScreen.statBirads'), value: '412', unit: '例', icon: Scan, color: '#7c3aed', bg: '#8b5cf622' },
  { label: t('cancerScreen.statMonthlyNew'), value: '628', unit: '人', trend: 'up', icon: TrendingUp, color: 'var(--color-info-600)', bg: '#06b6d422' },
]

// ---------- 样式 ----------
const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: 'var(--color-primary-800)', margin: 0 },
  subtitle: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  // 统计卡片行
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: {
    background: 'var(--bg-card)', borderRadius: 12, padding: '18px 14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 30, fontWeight: 700, color: 'var(--color-primary-800)', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  statSub: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 },
  statTrend: { position: 'absolute', top: 14, right: 14, fontSize: 12, fontWeight: 600 },
  // 功能区分区
  section: { background: 'var(--bg-card)', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: 'var(--color-primary-800)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  // 任务管理
  taskGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  taskLeft: {},
  taskRight: {},
  taskToolbar: { display: 'flex', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)',
    fontSize: 12, },
  btn: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border-color)',
    background: 'var(--bg-card)', cursor: 'pointer', fontSize: 12, display: 'flex',
    alignItems: 'center', gap: 6, fontWeight: 500,
  },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: 'var(--color-primary)', color: 'var(--text-inverse)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '10px 8px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' },
  statusBadge: { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  // 高危评估
  assessGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  assessForm: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formItem: {},
  formLabel: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 },
  formSelect: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: 12, background: 'var(--bg-card)' },
  riskCard: {
    borderRadius: 12, padding: 20, textAlign: 'center', marginBottom: 16,
    border: '2px solid transparent', cursor: 'pointer', transition: 'all 0.2s',
  },
  riskValue: { fontSize: 48, fontWeight: 800, lineHeight: 1 },
  riskLabel: { fontSize: 14, marginTop: 6, fontWeight: 600 },
  riskScore: { fontSize: 12, marginTop: 4, opacity: 0.8 },
  // 早癌检出
  detectionGrid: { display: 'grid', gridTemplateColumns: '1fr', gap: 0 },
  detectionRow: {
    display: 'grid', gridTemplateColumns: '100px 80px 60px 80px 120px 80px 70px 70px 80px',
    gap: 8, padding: '10px 8px', borderBottom: '1px solid var(--border-light)', alignItems: 'center', fontSize: 12,
  },
  detectionHeader: { background: 'var(--content-bg)', borderRadius: 8, marginBottom: 4, fontWeight: 600, color: 'var(--text-secondary)', fontSize: 12 },
  tag: { padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'inline-block', textAlign: 'center' },
  // 地图
  mapGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  mapSvg: { position: 'relative', background: 'var(--content-bg)', borderRadius: 12, padding: 16, minHeight: 400 },
  mapPlaceholder: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  mapProvince: { padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'default' },
  provinceTable: { fontSize: 12 },
  provinceTh: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid var(--border-light)', color: 'var(--text-secondary)', fontWeight: 600 },
  provinceTd: { padding: '8px 10px', borderBottom: '1px solid var(--border-light)', color: 'var(--text-secondary)' },
  // 滚动容器
  scrollBox: { maxHeight: 320, overflowY: 'auto' },
  // 空状态
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    color: 'var(--text-secondary)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyStateIcon: { opacity: 0.35, marginBottom: 4 },
  emptyStateText: { fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 },
  emptyStateHint: { fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 },
  // 筛查类型标签
  screenTypeTag: { padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 },
}

// ---------- 组件 ----------
// [UI-4] 收敛至公共 StatCard (保留数值/单位/标签/趋势)
const StatCard = ({ label, value, unit, sub, icon: Icon, color, bg, trend }: typeof statsData[0]) => (
  <CommonStatCard
    title={label}
    value={value}
    suffix={unit}
    sub={
      (sub || trend) ? (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {sub}
          {trend && (
            <span style={{ color: trend === 'up' ? severityColor('success') : severityColor('critical'), fontWeight: 600 }}>
              <ArrowUp size={12} />{trend === 'up' ? '↑' : '↓'}
            </span>
          )}
        </span>
      ) : undefined
    }
    icon={<Icon size={20} color={color} />}
    color={color}
    iconBg={bg}
  />
)

// [UI] task status colors unified via @/theme/statusTokens (single source)
const TASK_STATUS_LEVEL: Record<string, string> = {
  '招募中': 'warning',
  '进行中': 'info',
  '已完成': 'success',
  '已终止': 'critical',
}

const StatusBadge = ({ status }: { status: string }) => (
  <StatusTag status={status} tone={severityTone(TASK_STATUS_LEVEL[status] ?? 'neutral')}>{status}</StatusTag>
)

// [UI] queue workflow status → canonical level
const QUEUE_STATUS_LEVEL: Record<string, string> = {
  '已登记': 'info',
  '筛查中': 'info',
  '已完成': 'success',
  '异常': 'critical',
  '待审核': 'warning',
}

// 筛查类型图标与颜色
const screenTypeConfig: Record<string, { bg: string; text: string; icon: typeof Wind }> = {
  'LDCT': { bg: '#3b82f622', text: 'var(--color-primary-600)', icon: Wind },
  'MG': { bg: '#ec489922', text: '#ec4899', icon: Heart },
  '乳腺超声': { bg: '#ec489922', text: '#db2777', icon: Scan },
  '消化道': { bg: '#22c55e22', text: 'var(--color-success-600)', icon: Circle },
}

const ScreenTypeBadge = ({ type }: { type: string }) => {
  const cfg = screenTypeConfig[type] || { bg: 'var(--bg-deep)', text: '#64748b', icon: FileImage }
  const Icon = cfg.icon
  return (
    <span style={{ ...s.screenTypeTag, background: cfg.bg, color: cfg.text }}>
      <Icon size={12} />{type}
    </span>
  )
}

// Lung-RADS / BI-RADS severity — mapped to the canonical severity ladder
const RADS_LEVEL: Record<string, string> = {
  'Lung-RADS 2': 'normal',
  'Lung-RADS 3': 'warning',
  'Lung-RADS 4A': 'high',
  'Lung-RADS 4B': 'critical',
  'BI-RADS 2': 'normal',
  'BI-RADS 3': 'warning',
  'BI-RADS 4A': 'high',
  'BI-RADS 4B': 'critical',
  'BI-RADS 5': 'critical',
  '待定': 'neutral',
}

const RadsBadge = ({ rads }: { rads: string }) => (
  <SeverityTag level={RADS_LEVEL[rads] ?? 'neutral'}>{rads}</SeverityTag>
)

const CancerScreenPage = () => {
  const [tab, setTab] = useState(1)
  const [taskSearch, setTaskSearch] = useState('')
  const [currentScore, setCurrentScore] = useState(0)
  const [currentRisk, setCurrentRisk] = useState<'低危' | '中危' | '高危' | '极高危'>('低危')
  // 弹窗状态
  const [showFilterModal, setShowFilterModal] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showExportModal, setShowExportModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [, setLastSync] = useState<Date>(new Date())
  const [syncing, setSyncing] = useState(false)
  // [Wave2A] 任务筛选条件 (受控表单) + 新建/编辑任务表单
  const [filterForm, setFilterForm] = useState({ type: '全部', region: '全部地区', status: '全部' })
  const [taskFilters, setTaskFilters] = useState({ type: '全部', region: '全部地区', status: '全部' })
  const [newTaskForm, setNewTaskForm] = useState({ name: '', type: 'LDCT', region: '山东省', target: 500 })
  const [editTaskForm, setEditTaskForm] = useState({ id: 0, name: '', type: 'LDCT', region: '山东省', target: 500, status: '招募中' })

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // [Phase 2] 真实 API 数据：统计 + 筛查队列
  const [liveStats, setLiveStats] = useState<typeof statsData | null>(null)
  const [queue, setQueue] = useState<any[]>([])
  const [queueLoading, setQueueLoading] = useState(false)
  const [queueError, setQueueError] = useState<string | null>(null)
  const [queueStatusFilter, setQueueStatusFilter] = useState('全部')
  const [queueTypeFilter, setQueueTypeFilter] = useState('全部')
  const [queueKeyword, setQueueKeyword] = useState('')
  // [G005 W3-B] 筛查月度趋势: GET /screening/trend (screeningApi.getTrend)
  const [trend, setTrend] = useState<ScreeningTrendDto[]>([])
  const [trendLoading, setTrendLoading] = useState(false)
  const [trendError, setTrendError] = useState<string | null>(null)

  const loadTrend = useCallback(async () => {
    setTrendLoading(true)
    setTrendError(null)
    try {
      const res = await screeningApi.getTrend()
      if (res.success && Array.isArray(res.data) && res.data.length > 0) setTrend(res.data)
      else setTrendError(t('cancerScreen.errTrendLoad'))
    } catch {
      setTrendError(t('cancerScreen.errTrendRetry'))
    } finally {
      setTrendLoading(false)
    }
  }, [])

  const loadQueue = useCallback(async () => {
    setQueueLoading(true)
    setQueueError(null)
    try {
      const res = await screeningApi.listQueue({
        status: queueStatusFilter === '全部' ? undefined : queueStatusFilter,
        screenType: queueTypeFilter === '全部' ? undefined : queueTypeFilter,
        keyword: queueKeyword || undefined,
      })
      if (res.success && Array.isArray(res.data)) setQueue(res.data)
      else setQueueError(t('cancerScreen.errQueueLoad'))
    } catch {
      setQueueError(t('cancerScreen.errQueueRetry'))
    } finally {
      setQueueLoading(false)
    }
  }, [queueStatusFilter, queueTypeFilter, queueKeyword])

  useEffect(() => {
    void (async () => {
      const [statsRes, queueRes] = await Promise.all([screeningApi.getStats(), screeningApi.listQueue()])
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data as any
        setLiveStats([
          { label: t('cancerScreen.statLdct'), value: d.ldctCount.toLocaleString(), unit: '人', icon: Wind, color: 'var(--color-primary-600)', bg: '#3b82f622' },
          { label: t('cancerScreen.statBreast'), value: d.breastCount.toLocaleString(), unit: '人', sub: '含钼靶/超声', icon: Heart, color: '#ec4899', bg: '#ec489922' },
          { label: t('cancerScreen.statHighRisk'), value: d.highRiskCount.toLocaleString(), unit: '例', sub: 'LDCT 14.9%', icon: AlertTriangle, color: '#ea580c', bg: '#f9731622' },
          { label: t('cancerScreen.statEarlyCancer'), value: d.earlyCancerCount.toLocaleString(), unit: '例', sub: '检出率2.37%', icon: Target, color: 'var(--color-error-600)', bg: '#ef444422' },
          { label: t('cancerScreen.statBirads'), value: d.birads4Plus.toLocaleString(), unit: '例', icon: Scan, color: '#7c3aed', bg: '#8b5cf622' },
          { label: t('cancerScreen.statMonthlyNew'), value: d.monthlyNew.toLocaleString(), unit: '人', trend: 'up', icon: TrendingUp, color: 'var(--color-info-600)', bg: '#06b6d422' },
        ])
      }
      if (queueRes.success && Array.isArray(queueRes.data)) setQueue(queueRes.data)
      else setQueueError(t('cancerScreen.errQueueLoad'))
      void loadTrend()
    })()
  }, [loadTrend])

  const handleMarkScreening = async (item: any) => {
    try {
      const res = await screeningApi.markScreening(item.id, { screenType: item.screenType, doctor: '张伟医生' })
      if (res.success && res.data) {
        showToast(t('cancerScreen.markedMsg', { name: res.data.patientName, type: res.data.screenType }), 'success')
        void loadQueue()
      } else {
        antdMessage.error(res.error?.message || t('cancerScreen.errMark'))
      }
    } catch {
      antdMessage.error(t('cancerScreen.errMarkService'))
    }
  }

  const handleQueueStatus = async (item: any, status: string) => {
    try {
      const res = await screeningApi.updateStatus(item.id, { status })
      if (res.success) {
        showToast(t('cancerScreen.statusUpdated', { name: item.patientName, status }), 'success')
        void loadQueue()
      } else {
        antdMessage.error(res.error?.message || t('cancerScreen.errUpdate'))
      }
    } catch {
      antdMessage.error(t('cancerScreen.errUpdateService'))
    }
  }

  // [W1-B] 登记筛查: screeningApi.create (POST /screening/queue)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [regForm, setRegForm] = useState({ patientId: '', patientName: '', age: 50, gender: '女', screenType: 'LDCT', screenDate: new Date().toISOString().split('T')[0] })
  const [regSaving, setRegSaving] = useState(false)

  const handleRegisterScreening = async () => {
    if (!regForm.patientId.trim() || !regForm.patientName.trim()) { antdMessage.warning(t('cancerScreen.warnRegisterFields')); return }
    setRegSaving(true)
    try {
      const res = await screeningApi.create({
        patientId: regForm.patientId.trim(),
        patientName: regForm.patientName.trim(),
        age: Number(regForm.age) || 0,
        gender: regForm.gender,
        screenType: regForm.screenType,
        screenDate: regForm.screenDate,
        status: '已登记',
      })
      if (res.success && res.data) {
        showToast(t('cancerScreen.registeredMsg', { name: res.data.patientName, type: res.data.screenType }), 'success')
        setShowRegisterModal(false)
        setRegForm({ patientId: '', patientName: '', age: 50, gender: '女', screenType: 'LDCT', screenDate: new Date().toISOString().split('T')[0] })
        void loadQueue()
      } else {
        antdMessage.error(res.error?.message || t('cancerScreen.errRegister'))
      }
    } catch {
      antdMessage.error(t('cancerScreen.errRegisterService'))
    } finally {
      setRegSaving(false)
    }
  }

  // ---------- 数据 ----------
  const taskStatuses = ['招募中', '进行中', '已完成', '已终止']
  const screenTypes = ['LDCT', 'MG', '乳腺超声', '消化道']
  const regions = ['山东省', '河南省', '内蒙古', '青海省', '四川省', '广东省', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '湖南省', '湖北省', '河北省', '山西省', '陕西省', '辽宁省', '吉林省']

  const [tasks, setTasks] = useState(() => Array.from({ length: 60 }, (_, i) => {
    const status = taskStatuses[Math.floor(Math.random() * 4)]!
    const type = screenTypes[i % 4]!
    const target = 150 + Math.floor(Math.random() * 600)
    const completed = status === '已完成' ? target : status === '已终止' ? Math.floor(target * Math.random() * 0.3) : Math.floor(target * (0.1 + Math.random() * 0.85))
    const year = i < 30 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 10 + (i % 18)
    return {
      id: i + 1,
      name: `${regions[i % regions.length]!}${type}早癌筛查`,
      region: regions[i % regions.length]!,
      target,
      completed,
      rate: Math.round((completed / target) * 100),
      status,
      startDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      type,
      doctor: `张${['伟', '磊', '涛', '勇', '强', '军', '波', '辉', '彬', '龙'][i % 10]}医生`,
    }
  }))

  // [UI] risk severity colors unified via @/theme/statusTokens (single source)
  const riskTone = (risk: string) => severityTone(
    risk === '极高危' ? 'critical' : risk === '高危' ? 'high' : risk === '中危' ? 'warning' : 'normal'
  )
  const names = ['王建国', '李明华', '张秀英', '刘德伟', '陈淑芳', '杨志国', '赵丽娟', '黄文博', '周玉珍', '吴洪亮', '徐海燕', '孙志远', '马晓东', '朱艳红', '胡金生', '郭彩云', '林国栋', '何秀兰', '高建新', '罗春梅', '郑成文', '梁晓燕', '宋立功', '唐桂英', '许志鹏', '韩素芳', '邓小刚', '冯翠花', '曹德华', '彭丽华']

  const assessments = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const totalScore = 5 + Math.floor(Math.random() * 45)
    let risk: string
    if (totalScore < 15) risk = '低危'
    else if (totalScore < 25) risk = '中危'
    else if (totalScore < 35) risk = '高危'
    else risk = '极高危'
    const year = i < 15 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 10 + (i % 18)
    return {
      id: i + 1,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      name: names[i],
      age: 35 + Math.floor(Math.random() * 40),
      totalScore,
      risk,
      doctor: `李${['敏', '娜', '霞', '琳', '燕', '芳', '娟', '玲', '婷', '颖'][i % 10]}医生`,
    }
  }), [])

  const [assessmentForm, setAssessmentForm] = useState({
    age: 55, gender: '男', smoking: '无', family: '无', exposure: '无', symptoms: '无', history: '无', region: '低风险'
  })
  const assessmentDimensions = [
    { key: 'age', label: t('w9a.cancerScreen.dimAge'), options: [{ v: 0, l: '<40岁' }, { v: 1, l: '40-50岁' }, { v: 2, l: '50-60岁' }, { v: 3, l: '>60岁' }] },
    { key: 'gender', label: t('w9a.cancerScreen.dimGender'), options: [{ v: 0, l: '女' }, { v: 1, l: '男' }] },
    { key: 'smoking', label: t('w9a.cancerScreen.dimSmoking'), options: [{ v: 0, l: '无' }, { v: 1, l: '已戒' }, { v: 3, l: '正在吸' }] },
    { key: 'family', label: t('w9a.cancerScreen.dimFamily'), options: [{ v: 0, l: '无' }, { v: 3, l: '有' }] },
    { key: 'exposure', label: t('w9a.cancerScreen.dimExposure'), options: [{ v: 0, l: '无' }, { v: 2, l: '有' }] },
    { key: 'symptoms', label: t('w9a.cancerScreen.dimSymptoms'), options: [{ v: 0, l: '无' }, { v: 2, l: '轻微' }, { v: 4, l: '明显' }] },
    { key: 'history', label: t('w9a.cancerScreen.dimHistory'), options: [{ v: 0, l: '无' }, { v: 2, l: 'COPD/结核' }, { v: 4, l: '其他' }] },
    { key: 'region', label: t('w9a.cancerScreen.dimRegion'), options: [{ v: 0, l: '低风险' }, { v: 2, l: '中风险' }, { v: 4, l: '高风险' }] },
  ]

  // 早癌/高危结节检出数据
  const lesionTypes = ['肺结节(早期肺癌)', '乳腺结节(早期乳腺癌)', '胃早癌', '结直肠早癌', '癌前病变', '肺GGN', '乳腺钙化']
  const locations = ['右肺上叶', '右肺中叶', '右肺下叶', '左肺上叶', '左肺下叶', '左肺舌段', '右乳外上', '右乳内上', '左乳外上', '左乳内上', '胃窦', '胃体', '直肠', '乙状结肠']
  const treatments = ['定期随访', '穿刺活检', '手术切除', '微创消融', '放化疗', '待定']
  const treatmentColors: Record<string, { bg: string; text: string }> = {
    '定期随访': { bg: '#3b82f622', text: 'var(--color-primary-600)' },
    '穿刺活检': { bg: '#f59e0b22', text: '#ca8a04' },
    '手术切除': { bg: '#ef444422', text: 'var(--color-error-600)' },
    '微创消融': { bg: '#8b5cf622', text: '#7c3aed' },
    '放化疗': { bg: '#f9731622', text: '#ea580c' },
    '待定': { bg: 'var(--bg-deep)', text: '#64748b' },
  }
  const followUpStatuses = ['随访中', '失访', '治愈', '进展']
  // [UI] follow-up status colors unified via @/theme/statusTokens (single source)
  const FOLLOWUP_LEVEL: Record<string, string> = { '随访中': 'info', '失访': 'critical', '治愈': 'success', '进展': 'high' }
  const followUpTone = (status: string) => severityTone(FOLLOWUP_LEVEL[status] ?? 'neutral')
  const patientNames = ['李秀英', '王德明', '张建华', '刘玉兰', '陈国庆', '杨文军', '赵桂英', '黄伟东', '周丽娟', '吴洪波', '徐海峰', '孙桂芳', '马志远', '朱秀云', '胡金生', '郭彩霞', '林国强', '何春梅', '高建波', '罗素芳']

  const detections = useMemo(() => Array.from({ length: 25 }, (_, i) => {
    const year = i < 12 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 5 + (i % 20)
    const type = lesionTypes[i % lesionTypes.length]!
    const isLung = type.includes('肺')
    const isBreast = type.includes('乳腺')
    const rList = isLung ? ['Lung-RADS 2', 'Lung-RADS 3', 'Lung-RADS 4A', 'Lung-RADS 4B'] : isBreast ? ['BI-RADS 3', 'BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 5'] : ['待定']
    return {
      id: i + 1,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      name: patientNames[i],
      age: 30 + Math.floor(Math.random() * 45),
      gender: i % 2 === 0 ? '男' : '女',
      lesionType: type,
      location: locations[i % locations.length],
      rads: rList[Math.floor(Math.random() * rList.length)]!,
      treatment: treatments[i % treatments.length]!,
      followUp: followUpStatuses[Math.floor(Math.random() * 4)]!,
    }
  }), [])

  const provinces = [
    { name: '山东', covered: '已覆盖', instCount: 32, screenCount: 3256, rate: 2.4 },
    { name: '河南', covered: '已覆盖', instCount: 28, screenCount: 2892, rate: 2.6 },
    { name: '内蒙古', covered: '覆盖中', instCount: 14, screenCount: 856, rate: 2.1 },
    { name: '青海', covered: '覆盖中', instCount: 8, screenCount: 424, rate: 1.8 },
    { name: '四川', covered: '已覆盖', instCount: 38, screenCount: 3432, rate: 2.9 },
    { name: '广东', covered: '已覆盖', instCount: 42, screenCount: 4654, rate: 2.5 },
    { name: '江苏', covered: '已覆盖', instCount: 35, screenCount: 3286, rate: 2.7 },
    { name: '浙江', covered: '已覆盖', instCount: 30, screenCount: 3034, rate: 2.6 },
    { name: '安徽', covered: '已覆盖', instCount: 22, screenCount: 1856, rate: 2.2 },
    { name: '福建', covered: '覆盖中', instCount: 16, screenCount: 982, rate: 2.0 },
    { name: '江西', covered: '已覆盖', instCount: 18, screenCount: 1524, rate: 2.1 },
    { name: '湖南', covered: '已覆盖', instCount: 24, screenCount: 2168, rate: 2.3 },
    { name: '湖北', covered: '已覆盖', instCount: 26, screenCount: 2482, rate: 2.5 },
    { name: '河北', covered: '已覆盖', instCount: 21, screenCount: 1742, rate: 2.1 },
    { name: '山西', covered: '覆盖中', instCount: 12, screenCount: 724, rate: 1.9 },
    { name: '陕西', covered: '已覆盖', instCount: 19, screenCount: 1686, rate: 2.4 },
    { name: '辽宁', covered: '已覆盖', instCount: 25, screenCount: 2134, rate: 2.2 },
    { name: '吉林', covered: '未覆盖', instCount: 0, screenCount: 0, rate: 0 },
  ]

  const monthlyData = [
    { month: '2025-01', screenings: 620, detections: 18, rate: 2.9 },
    { month: '2025-02', screenings: 580, detections: 16, rate: 2.8 },
    { month: '2025-03', screenings: 720, detections: 22, rate: 3.1 },
    { month: '2025-04', screenings: 686, detections: 20, rate: 2.9 },
    { month: '2025-05', screenings: 820, detections: 26, rate: 3.2 },
    { month: '2025-06', screenings: 880, detections: 28, rate: 3.2 },
    { month: '2025-07', screenings: 760, detections: 24, rate: 3.2 },
    { month: '2025-08', screenings: 850, detections: 27, rate: 3.2 },
    { month: '2025-09', screenings: 920, detections: 30, rate: 3.3 },
    { month: '2025-10', screenings: 880, detections: 28, rate: 3.2 },
    { month: '2025-11', screenings: 980, detections: 32, rate: 3.3 },
    { month: '2025-12', screenings: 1050, detections: 35, rate: 3.3 },
    { month: '2026-01', screenings: 860, detections: 26, rate: 3.0 },
    { month: '2026-02', screenings: 780, detections: 24, rate: 3.1 },
    { month: '2026-03', screenings: 960, detections: 30, rate: 3.1 },
  ]

  // [UI] coverage status colors unified via @/theme/statusTokens (single source)
  const coveredTone = (covered: string) => severityTone(
    covered === '已覆盖' ? 'success' : covered === '覆盖中' ? 'warning' : 'neutral'
  )

  const calcRisk = (score: number) => {
    if (score < 15) return '低危'
    if (score < 25) return '中危'
    if (score < 35) return '高危'
    return '极高危'
  }

  const handleDimChange = (key: string, val: number) => {
    const newForm = { ...assessmentForm, [key]: val }
    setAssessmentForm(newForm as typeof assessmentForm)
    const score = Object.entries(newForm).reduce((acc, [k, v]) => {
      const dim = assessmentDimensions.find(d => d.key === k)
      if (!dim) return acc
      const opt = dim.options.find(o => o.l === v)
      return acc + (opt?.v || 0)
    }, 0)
    setCurrentScore(score)
    setCurrentRisk(calcRisk(score))
  }

  const filteredTasks = tasks.filter(t =>
    t.name.includes(taskSearch) || t.region.includes(taskSearch) || t.type.includes(taskSearch)
  ).filter(t =>
    (taskFilters.type === '全部' || t.type === taskFilters.type) &&
    (taskFilters.region === '全部地区' || t.region === taskFilters.region) &&
    (taskFilters.status === '全部' || t.status === taskFilters.status)
  )

  // ===== [Wave2A] 假按钮真实化 =====
  // 1) 同步数据: 重拉 screeningApi.getStats + listQueue
  const handleSyncData = async () => {
    setSyncing(true)
    try {
      const [statsRes, queueRes] = await Promise.all([screeningApi.getStats(), screeningApi.listQueue()])
      let synced = false
      if (statsRes.success && statsRes.data) {
        const d = statsRes.data as any
        setLiveStats([
          { label: t('cancerScreen.statLdct'), value: d.ldctCount.toLocaleString(), unit: '人', icon: Wind, color: 'var(--color-primary-600)', bg: '#3b82f622' },
          { label: t('cancerScreen.statBreast'), value: d.breastCount.toLocaleString(), unit: '人', sub: '含钼靶/超声', icon: Heart, color: '#ec4899', bg: '#ec489922' },
          { label: t('cancerScreen.statHighRisk'), value: d.highRiskCount.toLocaleString(), unit: '例', sub: 'LDCT 14.9%', icon: AlertTriangle, color: '#ea580c', bg: '#f9731622' },
          { label: t('cancerScreen.statEarlyCancer'), value: d.earlyCancerCount.toLocaleString(), unit: '例', sub: '检出率2.37%', icon: Target, color: 'var(--color-error-600)', bg: '#ef444422' },
          { label: t('cancerScreen.statBirads'), value: d.birads4Plus.toLocaleString(), unit: '例', icon: Scan, color: '#7c3aed', bg: '#8b5cf622' },
          { label: t('cancerScreen.statMonthlyNew'), value: d.monthlyNew.toLocaleString(), unit: '人', trend: 'up', icon: TrendingUp, color: 'var(--color-info-600)', bg: '#06b6d422' },
        ])
        synced = true
      }
      if (queueRes.success && Array.isArray(queueRes.data)) {
        setQueue(queueRes.data)
        synced = true
      } else {
        setQueueError(t('cancerScreen.errQueueLoad'))
      }
      setLastSync(new Date())
      showToast(synced ? t('cancerScreen.syncSuccess', { time: new Date().toLocaleTimeString('zh-CN') }) : t('cancerScreen.syncPartial'), synced ? 'success' : 'error')
    } catch {
      showToast(t('cancerScreen.errSync'), 'error')
    } finally {
      setSyncing(false)
    }
  }

  // 2) 应用筛选: 受控表单真实过滤
  const handleApplyFilter = () => {
    setTaskFilters({ ...filterForm })
    setShowFilterModal(false)
    showToast(t('cancerScreen.filterApplied', { type: filterForm.type, region: filterForm.region, status: filterForm.status }), 'success')
  }

  // 3) 创建任务: 受控表单 + screeningApi.create 真实登记
  const [taskCreating, setTaskCreating] = useState(false)
  const handleCreateTask = async () => {
    if (!newTaskForm.name.trim()) { antdMessage.warning(t('cancerScreen.warnTaskName')); return }
    if (!newTaskForm.target || newTaskForm.target <= 0) { antdMessage.warning(t('cancerScreen.warnTarget')); return }
    setTaskCreating(true)
    try {
      const res = await screeningApi.create({
        patientId: uniqueId('TASK'),
        patientName: newTaskForm.name.trim(),
        age: 0,
        gender: '—',
        screenType: newTaskForm.type,
        screenDate: new Date().toISOString().split('T')[0],
        status: '已登记',
        institution: newTaskForm.region,
      })
      if (res.success) {
        const newTask = {
          id: Date.now(),
          name: newTaskForm.name.trim(),
          region: newTaskForm.region,
          target: Number(newTaskForm.target),
          completed: 0,
          rate: 0,
          status: '招募中',
          startDate: new Date().toISOString().slice(0, 10),
          type: newTaskForm.type,
          doctor: '当前用户',
        }
        setTasks(prev => [newTask, ...prev])
        void loadQueue()
        showToast(t('cancerScreen.taskCreated', { name: newTask.name }), 'success')
        setShowNewModal(false)
        setNewTaskForm({ name: '', type: 'LDCT', region: '山东省', target: 500 })
      } else {
        antdMessage.error(res.error?.message || t('cancerScreen.errCreateTask'))
      }
    } catch {
      antdMessage.error(t('cancerScreen.errCreateService'))
    } finally {
      setTaskCreating(false)
    }
  }

  // 4) 保存修改: 真实变更 (队列状态同步 + 本地任务更新)
  const handleSaveEdit = async () => {
    if (!editTaskForm.name.trim() || editTaskForm.target <= 0) { antdMessage.warning(t('cancerScreen.warnEditFields')); return }
    const targetTask = tasks.find(t => t.id === editTaskForm.id)
    try {
      await screeningApi.create({
        patientId: `EDIT-${editTaskForm.id}`,
        patientName: editTaskForm.name,
        screenType: editTaskForm.type,
        screenDate: new Date().toISOString().split('T')[0],
        status: editTaskForm.status === '已完成' ? '已完成' : '已登记',
      })
      void loadQueue()
    } catch { /* 后端不可用时仅本地更新 */ }
    if (targetTask) {
      setTasks(prev => prev.map(t => t.id === editTaskForm.id ? {
        ...t,
        name: editTaskForm.name,
        type: editTaskForm.type,
        region: editTaskForm.region,
        target: Number(editTaskForm.target),
        status: editTaskForm.status,
        rate: t.completed > 0 ? Math.round((t.completed / Number(editTaskForm.target)) * 100) : 0,
      } : t))
    }
    showToast(t('cancerScreen.taskUpdated', { name: editTaskForm.name }), 'success')
    setShowEditModal(false)
  }

  // 5) 确认导出: 真实 CSV Blob 下载
  const handleExportConfirm = () => {
    const csvRows: string[][] = []
    csvRows.push([t('cancerScreen.csvStatHeader'), t('cancerScreen.csvValueHeader')])
    ;(liveStats || statsData).forEach(st => csvRows.push([st.label, st.value + (st.unit || '')]))
    csvRows.push([])
    csvRows.push([t('cancerScreen.csvRegNo'), t('cancerScreen.csvPatient'), t('cancerScreen.csvGenderAge'), t('cancerScreen.csvScreenType'), t('cancerScreen.csvExamDate'), t('cancerScreen.csvStatus'), t('cancerScreen.csvResult'), t('cancerScreen.csvRads')])
    queue.forEach(item => csvRows.push([
      item.examId || item.id, item.patientName,
      `${item.gender || ''}/${item.age ?? ''}`, item.screenType,
      item.screenDate || '', item.status || '',
      item.result || '-', item.rads || '-',
    ]))
    const csv = csvRows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = t('w9a.cancerScreen.exportFileName', { date: new Date().toISOString().slice(0, 10) })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    showToast(t('cancerScreen.exportSuccess', { count: queue.length }), 'success')
    setShowExportModal(false)
  }

  // 6) 提交评估/确认提交: screeningApi.create 真实登记评估记录 + 刷新
  const [submitting, setSubmitting] = useState(false)
  const handleSubmitAssessment = async () => {
    setSubmitting(true)
    try {
      const res = await screeningApi.create({
        patientId: uniqueId('ASSESS'),
        patientName: `评估-${currentRisk}`,
        age: Number(assessmentForm.age) || 0,
        gender: assessmentForm.gender,
        screenType: 'LDCT',
        screenDate: new Date().toISOString().split('T')[0],
        status: '已完成',
        result: currentRisk,
        rads: currentRisk === '极高危' || currentRisk === '高危' ? 'Lung-RADS 4A' : 'Lung-RADS 2',
      })
      if (res.success) {
        void loadQueue()
        showToast(t('cancerScreen.assessSubmitted', { risk: currentRisk, score: currentScore }), 'success')
        setShowConfirmModal(false)
      } else {
        antdMessage.error(res.error?.message || t('cancerScreen.errSubmit'))
      }
    } catch {
      antdMessage.error(t('cancerScreen.errSubmitService'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>{t('cancerScreen.title')}</h1>
          <p style={s.subtitle}>{t('cancerScreen.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn} onClick={() => void handleSyncData()} disabled={syncing}><RefreshCw size={14} /> {syncing ? t('cancerScreen.syncing') : t('cancerScreen.syncData')}</button>
          <button style={s.btn} onClick={() => setShowExportModal(true)}><Download size={14} /> {t('cancerScreen.exportReport')}</button>
        </div>
      </div>

      {/* 6大指标卡片 */}
      <div style={s.statsRow}>
        {(liveStats || statsData).map((stat, i) => <StatCard key={i} {...stat} />)}
      </div>

      {/* 功能区Tab导航 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--content-bg)', padding: 4, borderRadius: 10 }}>
        {[
          { label: t('cancerScreen.tabTaskManage'), icon: Target },
          { label: t('cancerScreen.tabRiskAssess'), icon: AlertTriangle },
          { label: t('cancerScreen.tabDetection'), icon: Microscope },
          { label: t('cancerScreen.tabDataMap'), icon: MapPin },
          { label: t('cancerScreen.tabQueue', { count: queue.length }), icon: ListOrdered },
          // [G005 W3-B] 筛查趋势: GET /screening/trend (screeningApi.getTrend)
          { label: t('w3b.screenTrend'), icon: TrendingUp },
        ].map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i + 1)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
              background: tab === i + 1 ? 'var(--bg-card)' : 'transparent',
              color: tab === i + 1 ? 'var(--color-primary)' : 'var(--text-secondary)',
              fontWeight: tab === i + 1 ? 700 : 500, cursor: 'pointer',
              fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              boxShadow: tab === i + 1 ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.2s',
            }}
          >
            <t.icon size={15} />{t.label}
          </button>
        ))}
      </div>

      {/* ========== 功能区1: 筛查任务管理 ========== */}
      {tab === 1 && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Target size={16} color={severityColor('critical')} />{t('cancerScreen.tabTaskManage')}</div>
          <div style={s.taskToolbar}>
            <input
              style={s.searchInput}
              placeholder={t('cancerScreen.searchTaskPlaceholder')}
              value={taskSearch}
              onChange={e => setTaskSearch(e.target.value)}
            />
            <button style={{ ...s.btn, minHeight: 44, padding: '8px 16px', fontSize: 14 }} onClick={() => setShowFilterModal(true)}><Filter size={16} />{t('cancerScreen.filter')}</button>
            <button style={{ ...s.btnPrimary, minHeight: 44, padding: '8px 20px', fontSize: 14 }} onClick={() => setShowNewModal(true)}><Plus size={16} />{t('cancerScreen.newTask')}</button>
          </div>
          <DataTable
            rowKey="id"
            dataSource={filteredTasks.slice(0, 15)}
            fixedHeader={320}
            showPagination={false}
            showExport={false}
            showDensity={false}
            emptyText={
              <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                <FileSearch size={40} style={s.emptyStateIcon} />
                <span>{t('cancerScreen.noTaskMatch')}</span>
                <span style={{ fontSize: 12 }}>{t('cancerScreen.taskMatchHint')}</span>
              </span>
            }
            columns={[
              { title: t('cancerScreen.thTaskName'), dataIndex: 'name' },
              { title: t('cancerScreen.thScreenType'), key: 'type', render: (_v, task) => <ScreenTypeBadge type={task.type} /> },
              { title: t('cancerScreen.thRegion'), dataIndex: 'region' },
              { title: t('cancerScreen.thTarget'), dataIndex: 'target', align: 'right' },
              { title: t('cancerScreen.thCompleted'), dataIndex: 'completed', align: 'right' },
              {
                title: t('cancerScreen.thRate'),
                dataIndex: 'rate',
                align: 'right',
                render: (value: number) => (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                    <div style={{ width: 60, height: 6, background: 'var(--content-bg)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${value}%`, height: '100%', background: value >= 100 ? severityColor('success') : value >= 50 ? 'var(--color-primary)' : severityColor('warning'), borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{value}%</span>
                  </div>
                ),
              },
              { title: t('cancerScreen.thStatus'), key: 'status', render: (_v, task) => <StatusBadge status={task.status} /> },
              {
                title: t('cancerScreen.thAction'),
                key: 'action',
                render: (_v, task) => (
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={{ ...s.btn, padding: '4px 8px', fontSize: 12 }} onClick={() => setShowDetailModal(true)}><Eye size={12} /></button>
                    <button style={{ ...s.btn, padding: '4px 8px', fontSize: 12 }} onClick={() => { setEditTaskForm({ id: task.id, name: task.name, type: task.type, region: task.region, target: task.target, status: task.status }); setShowEditModal(true) }}><Edit size={12} /></button>
                  </div>
                ),
              },
            ]}
          />
          <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-secondary)', textAlign: 'right' }}>
            {t('cancerScreen.showingTasks', { count: filteredTasks.length })}
          </div>
        </div>
      )}

      {/* ========== 功能区2: 高危评估 ========== */}
      {tab === 2 && (
        <div style={s.section}>
          <div style={s.sectionTitle}><AlertTriangle size={16} color={severityColor('high')} />{t('cancerScreen.riskAssess')}</div>
          <div style={s.assessGrid}>
            {/* 左: 评估表单 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('cancerScreen.currentAssess')}</div>
              <div style={s.assessForm}>
                {assessmentDimensions.map(dim => (
                  <div key={dim.key} style={s.formItem}>
                    <div style={s.formLabel}>{dim.label}</div>
                    <Select
                      style={{ width: '100%' }}
                      value={assessmentForm[dim.key as keyof typeof assessmentForm]}
                      onChange={(v) => handleDimChange(dim.key, dim.options.findIndex(o => o.l === v))}
                      options={dim.options.map(opt => ({ value: opt.l, label: opt.l }))}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', background: riskTone(currentRisk).bg, borderRadius: 10, textAlign: 'center', border: `2px solid ${riskTone(currentRisk).color}` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: riskTone(currentRisk).color }}>{t('cancerScreen.assessResult')}</div>
                <div style={{ fontSize: 30, fontWeight: 700, color: riskTone(currentRisk).color, lineHeight: 1.2, marginTop: 4 }}>{currentRisk}</div>
                <div style={{ fontSize: 12, color: riskTone(currentRisk).color, opacity: 0.8, marginTop: 4 }}>{t('cancerScreen.riskScore', { score: currentScore })}</div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button style={{ ...s.btnPrimary, minHeight: 44, padding: '10px 20px', fontSize: 14 }} onClick={() => setShowConfirmModal(true)}><CheckCircle size={16} />{t('cancerScreen.submitAssess')}</button>
                <button style={{ ...s.btn, minHeight: 44, padding: '10px 20px', fontSize: 14 }} onClick={() => { setCurrentScore(0); setCurrentRisk('低危'); setAssessmentForm({ age: 55, gender: '男', smoking: '无', family: '无', exposure: '无', symptoms: '无', history: '无', region: '低风险' }) }}>{t('cancerScreen.resetAssess')}</button>
              </div>
            </div>
            {/* 右: 历史评估记录 */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('cancerScreen.historyAssess', { count: assessments.length })}</div>
              <div style={s.scrollBox}>
                {assessments.length === 0 ? (
                  <div style={s.emptyState}>
                    <ClipboardList size={44} style={s.emptyStateIcon} />
                    <div style={s.emptyStateText}>{t('cancerScreen.noAssess')}</div>
                    <div style={s.emptyStateHint}>{t('cancerScreen.assessHint')}</div>
                  </div>
                ) : assessments.map(a => (
                  <div key={a.id} style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{a.name} <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>({t('cancerScreen.yearsOld', { age: a.age })})</span></div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{a.date} · {a.doctor}</div>
                    </div>
                    <span style={{ ...s.tag, background: riskTone(a.risk).bg, color: riskTone(a.risk).color }}>{a.risk} {t('cancerScreen.scorePoints', { score: a.totalScore })}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== 功能区3: 早癌/结节检出追踪 ========== */}
      {tab === 3 && (
        <div style={s.section}>
          <div style={s.sectionTitle}><Microscope size={16} color={severityColor('critical')} />{t('cancerScreen.detectionTrack')}</div>
          {detections.length === 0 ? (
            <div style={s.emptyState}>
              <Inbox size={48} style={s.emptyStateIcon} />
              <div style={s.emptyStateText}>{t('cancerScreen.noDetection')}</div>
              <div style={s.emptyStateHint}>{t('cancerScreen.detectionHint')}</div>
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={s.detectionGrid}>
              <div style={s.detectionHeader}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 60px 80px 120px 80px 70px 70px 80px', gap: 8 }}>
                  <div>{t('cancerScreen.thDate')}</div><div>{t('cancerScreen.thName')}</div><div>{t('cancerScreen.thAge')}</div><div>{t('cancerScreen.thGender')}</div><div>{t('cancerScreen.thLesion')}</div><div>{t('cancerScreen.thLocation')}</div><div>{t('cancerScreen.thGrade')}</div><div>{t('cancerScreen.thTreatment')}</div><div>{t('cancerScreen.thFollowUp')}</div>
                </div>
              </div>
              {detections.map(d => (
                <div key={d.id} style={s.detectionRow}>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 60px 80px 120px 80px 70px 70px 80px', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12 }}>{d.date}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12 }}>{d.age}</div>
                    <div style={{ fontSize: 12 }}>{d.gender}</div>
                    <div style={{ fontSize: 12, color: severityColor('critical'), fontWeight: 600 }}>{d.lesionType}</div>
                    <div style={{ fontSize: 12 }}>{d.location}</div>
                    <div><RadsBadge rads={d.rads} /></div>
                    <div><span style={{ ...s.tag, background: treatmentColors[d.treatment]?.bg, color: treatmentColors[d.treatment]?.text }}>{d.treatment}</span></div>
                    <div><span style={{ ...s.tag, background: followUpTone(d.followUp).bg, color: followUpTone(d.followUp).color }}>{d.followUp}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          )}
        </div>
      )}

      {/* ========== 功能区4: 影像数据地图 ========== */}
      {tab === 4 && (
        <div style={s.section}>
          <div style={s.sectionTitle}><MapPin size={16} color='#7c3aed' />{t('cancerScreen.dataMap')}</div>
          <div style={s.mapGrid}>
            {/* 省份列表 */}
            <div style={s.mapSvg}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12 }}>{t('cancerScreen.provinceCoverage')}</div>
              <DataTable
                rowKey="name"
                dataSource={provinces}
                fixedHeader={400}
                showPagination={false}
                showExport={false}
                showDensity={false}
                columns={[
                  { title: t('cancerScreen.thProvince'), dataIndex: 'name' },
                  {
                    title: t('cancerScreen.thCoverage'),
                    dataIndex: 'covered',
                    render: (value: string) => (
                      <span style={{ ...s.tag, background: coveredTone(value).bg, color: coveredTone(value).color }}>{value}</span>
                    ),
                  },
                  {
                    title: t('cancerScreen.thInstCount'),
                    dataIndex: 'instCount',
                    align: 'right',
                    render: (value: number) => t('cancerScreen.instCountSuffix', { count: value }),
                  },
                  {
                    title: t('cancerScreen.thTotalScreen'),
                    dataIndex: 'screenCount',
                    align: 'right',
                    render: (value: number) => t('cancerScreen.peopleSuffix', { count: value.toLocaleString() }),
                  },
                  {
                    title: t('cancerScreen.thDetectionRate'),
                    dataIndex: 'rate',
                    align: 'right',
                    render: (value: number) => (value > 0 ? `${value}%` : '-'),
                  },
                ]}
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span>{t('cancerScreen.totalInsts')} <strong>404家</strong></span>
                <span>{t('cancerScreen.totalScreenCount')} <strong>36,248人</strong></span>
                <span>{t('cancerScreen.overallRate')} <strong>2.37%</strong></span>
              </div>
            </div>
            {/* 右侧：影像筛查类型分布 */}
            <div style={{ ...s.mapSvg, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('cancerScreen.typeStats')}</div>
              {[
                { type: 'LDCT', icon: Wind, count: 8642, color: 'var(--color-primary-600)', bg: '#3b82f622' },
                { type: 'MG', icon: Heart, count: 3426, color: '#ec4899', bg: '#ec489922' },
                { type: '乳腺超声', icon: Scan, count: 2400, color: '#db2777', bg: '#ec489922' },
                { type: '消化道', icon: Circle, count: 2480, color: 'var(--color-success-600)', bg: '#22c55e22' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: item.bg, borderRadius: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: item.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={item.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>{t('cancerScreen.typeScreenSuffix', { type: item.type })}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.sharePercent', { pct: Math.round(item.count / 100).toLocaleString() })}</div>
                    </div>
                    <div style={{ fontSize: 30, fontWeight: 700, color: item.color }}>{item.count.toLocaleString()}</div>
                  </div>
                )
              })}
              <div style={{ marginTop: 8, padding: '12px 16px', background: 'var(--content-bg)', borderRadius: 10, border: '1px dashed var(--border-color)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{t('cancerScreen.monthlyTrend')}</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 60 }}>
                  {monthlyData.slice(-6).map((m) => {
                    const maxS = Math.max(...monthlyData.slice(-6).map(x => x.screenings))

// 月度筛查趋势数据

                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', background: 'var(--border-default)', borderRadius: 4, height: 50, position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: 0, width: '100%', background: 'var(--color-primary-600)', borderRadius: 4, height: `${(m.screenings / maxS) * 50}px` }} />
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{m.month.slice(5)}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* 筛选Modal */}
      {showFilterModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('cancerScreen.filterTitle')}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.screenType')}</div>
                <Select style={{ width: '100%' }} value={filterForm.type} onChange={(v) => setFilterForm({ ...filterForm, type: v })} options={['全部', 'LDCT', 'MG', '乳腺超声', '消化道'].map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.region')}</div>
                <Select style={{ width: '100%' }} value={filterForm.region} onChange={(v) => setFilterForm({ ...filterForm, region: v })} options={['全部地区', ...regions].map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.status')}</div>
                <Select style={{ width: '100%' }} value={filterForm.status} onChange={(v) => setFilterForm({ ...filterForm, status: v })} options={['全部', ...taskStatuses].map(v => ({ value: v, label: v }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowFilterModal(false)}>{t('cancerScreen.cancel')}</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={handleApplyFilter}>{t('cancerScreen.applyFilter')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 450 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('cancerScreen.newTaskTitle')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.taskName')}</div><input style={{ ...s.formSelect, width: '100%' }} placeholder={t('cancerScreen.placeholderTaskName')} value={newTaskForm.name} onChange={e => setNewTaskForm({ ...newTaskForm, name: e.target.value })} /></div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.screenType')}</div>
                <Select style={{ width: '100%' }} value={newTaskForm.type} onChange={(v) => setNewTaskForm({ ...newTaskForm, type: v })} options={['LDCT', 'MG', '乳腺超声', '消化道'].map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.region')}</div>
                <Select style={{ width: '100%' }} value={newTaskForm.region} onChange={(v) => setNewTaskForm({ ...newTaskForm, region: v })} options={regions.map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.target')}</div><input style={{ ...s.formSelect, width: '100%' }} type="number" placeholder={t('cancerScreen.placeholderTarget')} value={newTaskForm.target} onChange={e => setNewTaskForm({ ...newTaskForm, target: Number(e.target.value) })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowNewModal(false)}>{t('cancerScreen.cancel')}</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} disabled={taskCreating} onClick={() => void handleCreateTask()}>{taskCreating ? t('cancerScreen.creating') : t('cancerScreen.createTask')}</button>
            </div>
          </div>
        </div>
      )}

      {/* [W1-B] 登记筛查 Modal: screeningApi.create */}
      {showRegisterModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowRegisterModal(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 480, maxHeight: '85vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('cancerScreen.registerScreen')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={s.formLabel}>{t('cancerScreen.patientIdRequired')}</div><input style={{ ...s.formSelect, width: '100%' }} value={regForm.patientId} onChange={e => setRegForm({ ...regForm, patientId: e.target.value })} placeholder={t('cancerScreen.placeholderPatientId')} /></div>
              <div><div style={s.formLabel}>{t('cancerScreen.patientNameRequired')}</div><input style={{ ...s.formSelect, width: '100%' }} value={regForm.patientName} onChange={e => setRegForm({ ...regForm, patientName: e.target.value })} placeholder={t('cancerScreen.placeholderPatientName')} /></div>
              <div><div style={s.formLabel}>{t('cancerScreen.age')}</div><input type="number" style={{ ...s.formSelect, width: '100%' }} value={regForm.age} onChange={e => setRegForm({ ...regForm, age: Number(e.target.value) })} /></div>
              <div><div style={s.formLabel}>{t('cancerScreen.gender')}</div>
                <Select style={{ width: '100%' }} value={regForm.gender} onChange={(v) => setRegForm({ ...regForm, gender: v })} options={['女', '男'].map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={s.formLabel}>{t('cancerScreen.screenType')}</div>
                <Select style={{ width: '100%' }} value={regForm.screenType} onChange={(v) => setRegForm({ ...regForm, screenType: v })} options={['LDCT', 'MG', '乳腺超声', '消化道'].map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={s.formLabel}>{t('cancerScreen.screenDate')}</div><input type="date" style={{ ...s.formSelect, width: '100%' }} value={regForm.screenDate} onChange={e => setRegForm({ ...regForm, screenDate: e.target.value })} /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowRegisterModal(false)}>{t('cancerScreen.cancel')}</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} disabled={regSaving} onClick={() => void handleRegisterScreening()}>{regSaving ? t('cancerScreen.registering') : t('cancerScreen.confirmRegister')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 详情Modal */}
      {showDetailModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('cancerScreen.taskDetail')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.taskName')}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>山东省LDCT早癌筛查</div></div>
              <div style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.screenType')}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>LDCT</div></div>
              <div style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.target')}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>500人</div></div>
              <div style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.thCompleted')}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>326人 (65.2%)</div></div>
              <div style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.region')}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>山东省</div></div>
              <div style={{ padding: 12, background: 'var(--content-bg)', borderRadius: 8 }}><div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{t('cancerScreen.leader')}</div><div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>张伟医生</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowDetailModal(false)}>{t('cancerScreen.close')}</button>
            </div>
          </div>
        </div>
      )}

      {/* ========== 功能区5: 筛查队列（真实 API） ========== */}
      {tab === 5 && (
        <div style={s.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={s.sectionTitle}><ListOrdered size={16} color="var(--color-primary)" />{t('cancerScreen.queueTitle')}</div>
            <button style={{ ...s.btn, padding: '6px 12px' }} onClick={() => void loadQueue()}><RefreshCw size={13} /> {t('cancerScreen.refresh')}</button>
          </div>
          <div style={s.taskToolbar}>
            <input
              style={s.searchInput}
              placeholder={t('cancerScreen.searchQueuePlaceholder')}
              value={queueKeyword}
              onChange={e => setQueueKeyword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && void loadQueue()}
            />
            <Select style={{ width: 140 }} value={queueStatusFilter} onChange={(v) => setQueueStatusFilter(v)} options={['全部', '已登记', '筛查中', '已完成', '异常', '待审核'].map(st => ({ value: st, label: st }))} />
            <Select style={{ width: 140 }} value={queueTypeFilter} onChange={(v) => setQueueTypeFilter(v)} options={['全部', 'LDCT', 'MG', '乳腺超声', '消化道'].map(ty => ({ value: ty, label: ty }))} />
            <button style={{ ...s.btnPrimary, padding: '6px 14px' }} onClick={() => void loadQueue()}><Search size={13} /> {t('cancerScreen.query')}</button>
            <button style={{ ...s.btnPrimary, padding: '6px 14px', background: 'var(--color-success)' }} onClick={() => setShowRegisterModal(true)}><Plus size={13} /> {t('cancerScreen.registerScreenBtn')}</button>
          </div>

          {queueLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin tip={t('cancerScreen.loadingQueue')}><div style={{ height: 40 }} /></Spin></div>
          ) : queueError ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-error)', fontSize: 12 }}>{queueError}</div>
          ) : (
            <DataTable
              rowKey="id"
              dataSource={queue}
              fixedHeader={320}
              showPagination={false}
              showExport={false}
              showDensity={false}
              emptyText={t('cancerScreen.noQueue')}
              columns={[
                {
                  title: t('cancerScreen.thRegNo'),
                  dataIndex: 'examId',
                  render: (value: string, item: any) => (
                    <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{value || item.id}</span>
                  ),
                },
                {
                  title: t('cancerScreen.thPatient'),
                  dataIndex: 'patientName',
                  render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
                },
                {
                  title: t('cancerScreen.thGenderAge'),
                  key: 'genderAge',
                  render: (_v, item: any) => <>{item.gender} / {t('cancerScreen.yearsOld', { age: item.age })}</>,
                },
                { title: t('cancerScreen.thScreenType'), key: 'screenType', render: (_v, item: any) => <ScreenTypeBadge type={item.screenType} /> },
                { title: t('cancerScreen.thExamDate'), dataIndex: 'screenDate' },
                {
                  title: t('cancerScreen.thStatus'),
                  key: 'status',
                  render: (_v, item: any) => (
                    <StatusTag status={item.status} tone={severityTone(QUEUE_STATUS_LEVEL[item.status] ?? 'neutral')}>{item.status}</StatusTag>
                  ),
                },
                {
                  title: t('cancerScreen.thResult'),
                  key: 'result',
                  render: (_v, item: any) =>
                    item.result && item.result !== '-'
                      ? <SeverityTag level={item.result === '阳性' ? 'critical' : 'normal'}>{item.result}</SeverityTag>
                      : <span style={{ color: 'var(--text-secondary)' }}>-</span>,
                },
                {
                  title: 'RADS',
                  key: 'rads',
                  render: (_v, item: any) =>
                    item.rads && item.rads !== '-'
                      ? <RadsBadge rads={item.rads} />
                      : <span style={{ color: 'var(--text-secondary)' }}>-</span>,
                },
                { title: t('cancerScreen.thInstitution'), dataIndex: 'institution', render: (value: string) => value || '-' },
                {
                  title: t('cancerScreen.thAction'),
                  key: 'action',
                  render: (_v, item: any) => (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button style={{ ...s.tag, background: 'var(--color-info-bg)', color: 'var(--color-primary)', cursor: 'pointer', border: 'none' }} onClick={() => void handleMarkScreening(item)}>
                        <Flag size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />{t('cancerScreen.mark')}
                      </button>
                      {item.status !== '已完成' && (
                        <button style={{ ...s.tag, background: 'var(--color-success-bg)', color: 'var(--color-success)', cursor: 'pointer', border: 'none' }} onClick={() => void handleQueueStatus(item, '已完成')}>
                          <CheckCircle size={11} style={{ verticalAlign: 'middle', marginRight: 2 }} />{t('cancerScreen.complete')}
                        </button>
                      )}
                      {item.status !== '异常' && item.status !== '已完成' && (
                        <button style={{ ...s.tag, background: 'var(--color-error-bg)', color: 'var(--color-error)', cursor: 'pointer', border: 'none' }} onClick={() => void handleQueueStatus(item, '异常')}>
                          {t('cancerScreen.abnormal')}
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          )}
        </div>
      )}

      {/* ========== 功能区6: 筛查趋势 ========== */}
      {tab === 6 && (
        <div style={s.section}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={s.sectionTitle}><TrendingUp size={16} color='var(--color-info-600)' />{t('w3b.screenTrendTitle')} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--text-secondary)' }}>{t('w3b.screenTrendSub')}（GET /screening/trend）</span></div>
            <button style={{ ...s.btn, padding: '6px 12px' }} onClick={() => void loadTrend()}><RefreshCw size={13} /> {t('w3b.refresh')}</button>
          </div>
          {trendLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><Spin tip={t('cancerScreen.loadingTrend')}><div style={{ height: 40 }} /></Spin></div>
          ) : trendError ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-error)', fontSize: 12 }}>{trendError}</div>
          ) : trend.length === 0 ? (
            <div style={s.emptyState}>
              <FileSearch size={48} style={s.emptyStateIcon} />
              <div style={s.emptyStateText}>{t('cancerScreen.noTrend')}</div>
            </div>
          ) : (
            <>
              {/* 概览指标 */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
                {[
                  { label: t('w3b.screenCount'), value: trend.reduce((s, t) => s + (t.screenings ?? 0), 0).toLocaleString(), unit: '人', color: 'var(--color-primary-600)' },
                  { label: t('w3b.screenDetections'), value: trend.reduce((s, t) => s + (t.detections ?? 0), 0).toLocaleString(), unit: '例', color: 'var(--color-error-600)' },
                  { label: t('w3b.screenRate'), value: (trend.reduce((s, t) => s + (t.rate ?? 0), 0) / trend.length).toFixed(2), unit: '%', color: '#ea580c' },
                  { label: t('w3b.screenMonth'), value: String(trend.length), unit: '月', color: 'var(--color-info-600)' },
                ].map((item, i) => (
                  <div key={i} style={{ background: 'var(--content-bg)', borderRadius: 10, padding: 16, textAlign: 'center' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 8 }}>{item.label}</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: item.color }}>{item.value}<span style={{ fontSize: 12, fontWeight: 400 }}>{item.unit}</span></div>
                  </div>
                ))}
              </div>
              {/* 柱状趋势图 (筛查量 + 检出量) */}
              <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 16, minWidth: Math.max(560, trend.length * 56) }}>
                  {trend.map((tr, i) => {
                    const maxS = Math.max(...trend.map(x => x.screenings ?? 0), 1)
                    const maxD = Math.max(...trend.map(x => x.detections ?? 0), 1)
                    const hS = Math.round(((tr.screenings ?? 0) / maxS) * 140)
                    const hD = Math.round(((tr.detections ?? 0) / maxD) * 140)
                    return (
                      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 150 }}>
                          <div title={t('cancerScreen.tooltipScreenCount', { count: tr.screenings })} style={{ width: 16, height: hS, background: 'var(--color-primary-600)', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                          <div title={t('cancerScreen.tooltipDetectionCount', { count: tr.detections })} style={{ width: 16, height: hD, background: 'var(--color-error-600)', borderRadius: '4px 4px 0 0', opacity: 0.85 }} />
                        </div>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', marginTop: 6 }}>{tr.month}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-primary-600)' }}>{tr.screenings ?? 0}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-error-600)' }}>{tr.detections ?? 0}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-secondary)' }}>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-primary-600)', borderRadius: 2, marginRight: 4 }} />{t('w3b.screenCount')}</span>
                <span><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--color-error-600)', borderRadius: 2, marginRight: 4 }} />{t('w3b.screenDetections')}</span>
                <span>{t('w3b.screenRate')}: {trend[trend.length - 1]?.rate ?? '-'}% ({t('w3b.screenMonth')})</span>
              </div>
              {/* 明细表 */}
              <div style={{ marginTop: 20 }}>
                <DataTable
                  rowKey="month"
                  dataSource={trend}
                  showPagination={false}
                  showExport={false}
                  showDensity={false}
                  columns={[
                    {
                      title: t('w3b.screenMonth'),
                      dataIndex: 'month',
                      render: (value: string) => <span style={{ fontWeight: 600 }}>{value}</span>,
                    },
                    {
                      title: `${t('w3b.screenCount')} (人)`,
                      dataIndex: 'screenings',
                      align: 'right',
                      render: (value?: number) => value ?? 0,
                    },
                    {
                      title: `${t('w3b.screenDetections')} (例)`,
                      dataIndex: 'detections',
                      align: 'right',
                      render: (value?: number) => value ?? 0,
                    },
                    {
                      title: `${t('w3b.screenRate')} (%)`,
                      dataIndex: 'rate',
                      align: 'right',
                      render: (value?: number) => (
                        <SeverityTag level={(value ?? 0) >= 3 ? 'critical' : 'normal'}>{(value ?? 0).toFixed(2)}%</SeverityTag>
                      ),
                    },
                  ]}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* 编辑Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 450 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('cancerScreen.editTask')}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.taskName')}</div><input style={{ ...s.formSelect, width: '100%' }} value={editTaskForm.name} onChange={e => setEditTaskForm({ ...editTaskForm, name: e.target.value })} /></div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.target')}</div><input style={{ ...s.formSelect, width: '100%' }} type="number" value={editTaskForm.target} onChange={e => setEditTaskForm({ ...editTaskForm, target: Number(e.target.value) })} /></div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.screenType')}</div>
                <Select style={{ width: '100%' }} value={editTaskForm.type} onChange={(v) => setEditTaskForm({ ...editTaskForm, type: v })} options={['LDCT', 'MG', '乳腺超声', '消化道'].map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.region')}</div>
                <Select style={{ width: '100%' }} value={editTaskForm.region} onChange={(v) => setEditTaskForm({ ...editTaskForm, region: v })} options={regions.map(v => ({ value: v, label: v }))} />
              </div>
              <div><div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 4 }}>{t('cancerScreen.status')}</div>
                <Select style={{ width: '100%' }} value={editTaskForm.status} onChange={(v) => setEditTaskForm({ ...editTaskForm, status: v })} options={taskStatuses.map(v => ({ value: v, label: v }))} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowEditModal(false)}>{t('cancerScreen.cancel')}</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={() => void handleSaveEdit()}>{t('cancerScreen.saveEdit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 导出预览Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>{t('cancerScreen.exportPreview')}</div>
            <div style={{ background: 'var(--content-bg)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>{t('cancerScreen.reportSummary')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <span>{t('cancerScreen.exportStatLdct')}</span><span>{t('cancerScreen.exportStatBreast')}</span>
                <span>{t('cancerScreen.exportStatHighRisk')}</span><span>{t('cancerScreen.exportStatEarly')}</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowExportModal(false)}>{t('cancerScreen.cancel')}</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={handleExportConfirm}>{t('cancerScreen.confirmExport')}</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认Modal */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, minWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>{t('cancerScreen.confirmSubmitTitle')}</div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 20 }}>{t('cancerScreen.confirmSubmitText', { risk: currentRisk, score: currentScore })}</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowConfirmModal(false)}>{t('cancerScreen.cancel')}</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} disabled={submitting} onClick={() => void handleSubmitAssessment()}>{submitting ? t('cancerScreen.submitting') : t('cancerScreen.confirmSubmit')}</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast提示 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 12, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'fadeIn 0.3s'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

export default CancerScreenPage
