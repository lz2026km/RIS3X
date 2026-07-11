// @ts-nocheck
// ============================================================
// G005 放射科早癌筛查平台
// 放射科早癌筛查 - 肺癌LDCT/乳腺癌/消化道癌筛查管理
// ============================================================
import { useState, useMemo } from 'react'
import {
  Users, AlertTriangle, Target, Heart, MapPin, TrendingUp,
  Plus, Search, Filter, Download, RefreshCw,
  Activity, Shield, Clock, CheckCircle, XCircle, PauseCircle,
  ArrowUp, ArrowDown, AlertCircle, Microscope, Calendar,
  ChevronDown, ChevronRight, Edit, Trash2, Eye, ClipboardList,
  Circle, FileSearch, UserCheck, Inbox, Wind, Scan, FileImage
} from 'lucide-react'

// ---------- 统计数据 ----------
const statsData = [
  { label: 'LDCT筛查人数', value: '8,642', unit: '人', icon: Wind, color: '#2563eb', bg: '#eff6ff' },
  { label: '乳腺筛查人数', value: '5,826', unit: '人', sub: '含钼靶/超声', icon: Heart, color: '#ec4899', bg: '#fdf2f8' },
  { label: '高危结节检出', value: '1,284', unit: '例', sub: 'LDCT 14.9%', icon: AlertTriangle, color: '#ea580c', bg: '#fff7ed' },
  { label: '早癌/疑似早癌', value: '326', unit: '例', sub: '检出率2.37%', icon: Target, color: '#dc2626', bg: '#fef2f2' },
  { label: 'BI-RADS 4+', value: '412', unit: '例', icon: Scan, color: '#7c3aed', bg: '#f5f3ff' },
  { label: '本月新增筛查', value: '628', unit: '人', trend: 'up', icon: TrendingUp, color: '#0891b2', bg: '#ecfeff' },
]

// ---------- 样式 ----------
const s: Record<string, React.CSSProperties> = {
  root: { padding: 0 },
  header: { marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 20, fontWeight: 700, color: '#1a3a5c', margin: 0 },
  subtitle: { fontSize: 13, color: '#64748b', marginTop: 4 },
  // 统计卡片行
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 24 },
  statCard: {
    background: '#fff', borderRadius: 12, padding: '18px 14px',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', overflow: 'hidden',
  },
  statIcon: { width: 40, height: 40, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  statValue: { fontSize: 26, fontWeight: 800, color: '#1a3a5c', lineHeight: 1.1 },
  statLabel: { fontSize: 12, color: '#64748b', marginTop: 4 },
  statSub: { fontSize: 12, color: '#94a3b8', marginTop: 2 },
  statTrend: { position: 'absolute', top: 14, right: 14, fontSize: 12, fontWeight: 600 },
  // 功能区分区
  section: { background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#1a3a5c', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 },
  // 任务管理
  taskGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  taskLeft: {},
  taskRight: {},
  taskToolbar: { display: 'flex', gap: 8, marginBottom: 12 },
  searchInput: {
    flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0',
    fontSize: 13, outline: 'none',
  },
  btn: {
    padding: '8px 14px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex',
    alignItems: 'center', gap: 6, fontWeight: 500,
  },
  btnPrimary: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '10px 8px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' },
  td: { padding: '10px 8px', borderBottom: '1px solid #f8fafc', color: '#334155' },
  statusBadge: { padding: '3px 8px', borderRadius: 20, fontSize: 12, fontWeight: 600 },
  // 高危评估
  assessGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  assessForm: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  formItem: {},
  formLabel: { fontSize: 12, color: '#64748b', marginBottom: 4 },
  formSelect: { width: '100%', padding: '8px 10px', borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', background: '#fff' },
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
    gap: 8, padding: '10px 8px', borderBottom: '1px solid #f1f5f9', alignItems: 'center', fontSize: 12,
  },
  detectionHeader: { background: '#f8fafc', borderRadius: 8, marginBottom: 4, fontWeight: 600, color: '#64748b', fontSize: 12 },
  tag: { padding: '3px 8px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'inline-block', textAlign: 'center' },
  // 地图
  mapGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 },
  mapSvg: { position: 'relative', background: '#f8fafc', borderRadius: 12, padding: 16, minHeight: 400 },
  mapPlaceholder: { display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  mapProvince: { padding: '6px 10px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'default' },
  provinceTable: { fontSize: 12 },
  provinceTh: { textAlign: 'left', padding: '8px 10px', borderBottom: '2px solid #f1f5f9', color: '#64748b', fontWeight: 600 },
  provinceTd: { padding: '8px 10px', borderBottom: '1px solid #f8fafc', color: '#334155' },
  // 滚动容器
  scrollBox: { maxHeight: 320, overflowY: 'auto' },
  // 空状态
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    color: '#94a3b8',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
  },
  emptyStateIcon: { opacity: 0.35, marginBottom: 4 },
  emptyStateText: { fontSize: 14, color: '#64748b', fontWeight: 500 },
  emptyStateHint: { fontSize: 12, color: '#94a3b8', marginTop: 4 },
  // 筛查类型标签
  screenTypeTag: { padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 },
}

// ---------- 组件 ----------
const StatCard = ({ label, value, unit, sub, icon: Icon, color, bg, trend }: typeof statsData[0]) => (
  <div style={s.statCard}>
    <div style={{ ...s.statIcon, background: bg }}>
      <Icon size={20} color={color} />
    </div>
    <div style={s.statValue}>{value}<span style={{ fontSize: 14, fontWeight: 400, color: '#64748b' }}>{unit}</span></div>
    <div style={s.statLabel}>{label}</div>
    {sub && <div style={s.statSub}>{sub}</div>}
    {trend && <div style={{ ...s.statTrend, color: trend === 'up' ? '#16a34a' : '#dc2626' }}><ArrowUp size={12} />{trend === 'up' ? '↑' : '↓'}</div>}
  </div>
)

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, { bg: string; text: string }> = {
    '招募中': { bg: '#fefce8', text: '#ca8a04' },
    '进行中': { bg: '#eff6ff', text: '#2563eb' },
    '已完成': { bg: '#f0fdf4', text: '#16a34a' },
    '已终止': { bg: '#fef2f2', text: '#dc2626' },
  }
  const c = colors[status] || { bg: '#f1f5f9', text: '#64748b' }
  return <span style={{ ...s.statusBadge, background: c.bg, color: c.text }}>{status}</span>
}

// 筛查类型图标与颜色
const screenTypeConfig: Record<string, { bg: string; text: string; icon: typeof Wind }> = {
  'LDCT': { bg: '#eff6ff', text: '#2563eb', icon: Wind },
  'MG': { bg: '#fdf2f8', text: '#ec4899', icon: Heart },
  '乳腺超声': { bg: '#fdf2f8', text: '#db2777', icon: Scan },
  '消化道': { bg: '#f0fdf4', text: '#16a34a', icon: Circle },
}

const ScreenTypeBadge = ({ type }: { type: string }) => {
  const cfg = screenTypeConfig[type] || { bg: '#f1f5f9', text: '#64748b', icon: FileImage }
  const Icon = cfg.icon
  return (
    <span style={{ ...s.screenTypeTag, background: cfg.bg, color: cfg.text }}>
      <Icon size={12} />{type}
    </span>
  )
}

// Lung-RADS / BI-RADS 颜色
const radsColors: Record<string, { bg: string; text: string }> = {
  'Lung-RADS 2': { bg: '#f0fdf4', text: '#16a34a' },
  'Lung-RADS 3': { bg: '#fefce8', text: '#ca8a04' },
  'Lung-RADS 4A': { bg: '#fff7ed', text: '#ea580c' },
  'Lung-RADS 4B': { bg: '#fef2f2', text: '#dc2626' },
  'BI-RADS 2': { bg: '#f0fdf4', text: '#16a34a' },
  'BI-RADS 3': { bg: '#fefce8', text: '#ca8a04' },
  'BI-RADS 4A': { bg: '#fff7ed', text: '#ea580c' },
  'BI-RADS 4B': { bg: '#fef2f2', text: '#dc2626' },
  'BI-RADS 5': { bg: '#fef2f2', text: '#dc2626' },
  '待定': { bg: '#f1f5f9', text: '#64748b' },
}

const RadsBadge = ({ rads }: { rads: string }) => {
  const cfg = radsColors[rads] || { bg: '#f1f5f9', text: '#64748b' }
  return <span style={{ ...s.tag, background: cfg.bg, color: cfg.text }}>{rads}</span>
}

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
  const [lastSync, setLastSync] = useState<Date>(new Date())

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ---------- 数据 ----------
  const taskStatuses = ['招募中', '进行中', '已完成', '已终止']
  const screenTypes = ['LDCT', 'MG', '乳腺超声', '消化道']
  const regions = ['山东省', '河南省', '内蒙古', '青海省', '四川省', '广东省', '江苏省', '浙江省', '安徽省', '福建省', '江西省', '湖南省', '湖北省', '河北省', '山西省', '陕西省', '辽宁省', '吉林省']

  const tasks = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const status = taskStatuses[Math.floor(Math.random() * 4)]
    const type = screenTypes[i % 4]
    const target = 150 + Math.floor(Math.random() * 600)
    const completed = status === '已完成' ? target : status === '已终止' ? Math.floor(target * Math.random() * 0.3) : Math.floor(target * (0.1 + Math.random() * 0.85))
    const year = i < 30 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 10 + (i % 18)
    return {
      id: i + 1,
      name: `${regions[i % regions.length]}${type}早癌筛查`,
      region: regions[i % regions.length],
      target,
      completed,
      rate: Math.round((completed / target) * 100),
      status,
      startDate: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      type,
      doctor: `张${['伟', '磊', '涛', '勇', '强', '军', '波', '辉', '彬', '龙'][i % 10]}医生`,
    }
  }), [])

  const riskColors: Record<string, string> = { '低危': '#16a34a', '中危': '#ca8a04', '高危': '#ea580c', '极高危': '#dc2626' }
  const riskBgColors: Record<string, string> = { '低危': '#f0fdf4', '中危': '#fefce8', '高危': '#fff7ed', '极高危': '#fef2f2' }
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
    { key: 'age', label: '年龄', options: [{ v: 0, l: '<40岁' }, { v: 1, l: '40-50岁' }, { v: 2, l: '50-60岁' }, { v: 3, l: '>60岁' }] },
    { key: 'gender', label: '性别', options: [{ v: 0, l: '女' }, { v: 1, l: '男' }] },
    { key: 'smoking', label: '吸烟史', options: [{ v: 0, l: '无' }, { v: 1, l: '已戒' }, { v: 3, l: '正在吸' }] },
    { key: 'family', label: '肿瘤家族史', options: [{ v: 0, l: '无' }, { v: 3, l: '有' }] },
    { key: 'exposure', label: '职业暴露', options: [{ v: 0, l: '无' }, { v: 2, l: '有' }] },
    { key: 'symptoms', label: '呼吸道症状', options: [{ v: 0, l: '无' }, { v: 2, l: '轻微' }, { v: 4, l: '明显' }] },
    { key: 'history', label: '既往肺病史', options: [{ v: 0, l: '无' }, { v: 2, l: 'COPD/结核' }, { v: 4, l: '其他' }] },
    { key: 'region', label: '地区风险', options: [{ v: 0, l: '低风险' }, { v: 2, l: '中风险' }, { v: 4, l: '高风险' }] },
  ]

  // 早癌/高危结节检出数据
  const lesionTypes = ['肺结节(早期肺癌)', '乳腺结节(早期乳腺癌)', '胃早癌', '结直肠早癌', '癌前病变', '肺GGN', '乳腺钙化']
  const radsList = ['Lung-RADS 2', 'Lung-RADS 3', 'Lung-RADS 4A', 'Lung-RADS 4B', 'BI-RADS 3', 'BI-RADS 4A', 'BI-RADS 4B', 'BI-RADS 5', '待定']
  const locations = ['右肺上叶', '右肺中叶', '右肺下叶', '左肺上叶', '左肺下叶', '左肺舌段', '右乳外上', '右乳内上', '左乳外上', '左乳内上', '胃窦', '胃体', '直肠', '乙状结肠']
  const treatments = ['定期随访', '穿刺活检', '手术切除', '微创消融', '放化疗', '待定']
  const treatmentColors: Record<string, { bg: string; text: string }> = {
    '定期随访': { bg: '#eff6ff', text: '#2563eb' },
    '穿刺活检': { bg: '#fefce8', text: '#ca8a04' },
    '手术切除': { bg: '#fef2f2', text: '#dc2626' },
    '微创消融': { bg: '#f5f3ff', text: '#7c3aed' },
    '放化疗': { bg: '#fff7ed', text: '#ea580c' },
    '待定': { bg: '#f8fafc', text: '#64748b' },
  }
  const followUpStatuses = ['随访中', '失访', '治愈', '进展']
  const followUpColors: Record<string, { bg: string; text: string }> = {
    '随访中': { bg: '#eff6ff', text: '#2563eb' },
    '失访': { bg: '#fef2f2', text: '#dc2626' },
    '治愈': { bg: '#f0fdf4', text: '#16a34a' },
    '进展': { bg: '#fef2f2', text: '#dc2626' },
  }
  const patientNames = ['李秀英', '王德明', '张建华', '刘玉兰', '陈国庆', '杨文军', '赵桂英', '黄伟东', '周丽娟', '吴洪波', '徐海峰', '孙桂芳', '马志远', '朱秀云', '胡金生', '郭彩霞', '林国强', '何春梅', '高建波', '罗素芳']

  const detections = useMemo(() => Array.from({ length: 25 }, (_, i) => {
    const year = i < 12 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 5 + (i % 20)
    const type = lesionTypes[i % lesionTypes.length]
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
      rads: rList[Math.floor(Math.random() * rList.length)],
      treatment: treatments[i % treatments.length],
      followUp: followUpStatuses[Math.floor(Math.random() * 4)],
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

  const screenStatuses = ['待审核', '已登记', '筛查中', '已完成', '异常']
  const screeningPatients = useMemo(() => Array.from({ length: 60 }, (_, i) => {
    const status = screenStatuses[Math.floor(Math.random() * 5)]
    const type = screenTypes[i % 4]
    const year = i < 30 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 5 + (i % 20)
    return {
      id: i + 1,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      name: ['王秀兰', '李建国', '张桂英', '刘志明', '陈丽娟', '杨文华', '赵德福', '黄秀云', '周小刚', '吴翠花', '徐志远', '孙丽芳', '马金龙', '朱秀英', '胡金生', '郭彩霞', '林国强', '何春梅', '高建波', '罗素芳', '郑成文', '梁晓燕', '宋立功', '唐桂英', '许志鹏', '韩素芳', '邓小刚', '冯翠花', '曹德华', '彭丽华', '田秀英', '董建军', '蒋桂花', '熊国强', '韩秀英', '龚志鹏', '万翠花', '韦小刚', '郎丽芳', '戚秀英', '焦建军', '甄桂花', '令狐国强', '端木秀英', '上官志鹏', '欧阳翠花', '司马小刚', '公孙丽芳', '赫连秀英', '呼延建军', '闾丘桂花', '公冶国强', '子车秀英', '颛孙志鹏', '端星翠花', '谷梁小刚', '百里丽芳', '东郭秀英', '南门建军'][i % 60],
      age: 30 + Math.floor(Math.random() * 50),
      gender: i % 2 === 0 ? '男' : '女',
      phone: `138${String(1000 + i).padStart(4, '0')}${String(100 + (i * 7) % 900).padStart(3, '0')}`,
      type,
      result: status === '已完成' ? (Math.random() > 0.6 ? '阳性' : '阴性') : status === '异常' ? '需进一步' : '-',
      status,
      institution: ['山东省立医院影像科', '河南省人民医院放射科', '内蒙古医学院附院影像科', '青海大学附院放射科', '华西医院放射科', '广东省人民医院影像科', '南京鼓楼医院放射科', '浙大一院影像科', '安医大一附院放射科', '福建协和医院影像科', '南昌大一附院放射科', '湘雅医院影像科', '武汉同济医院放射科', '河北医大一院影像科', '山西大医院放射科', '西京医院影像科', '中国医大一院放射科', '长春吉大一院影像科'][i % 18],
    }
  }), [])

  const followUpModes = ['电话随访', '门诊随访', '住院随访', '在线随访']
  const followUpResults = ['稳定', '好转', '恶化', '失访']
  const followUps = useMemo(() => Array.from({ length: 40 }, (_, i) => {
    const year = i < 20 ? 2025 : 2026
    const month = 1 + (i % 11)
    const day = 8 + (i % 18)
    const result = followUpResults[Math.floor(Math.random() * 4)]
    const type = screenTypes[i % 4]
    return {
      id: i + 1,
      date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      nextDate: `${year + (month > 10 ? 1 : 0)}-${String((month + 2) % 12 || 12).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
      patientName: patientNames[i % 20],
      phone: `139${String(2000 + i).padStart(4, '0')}${String(200 + (i * 11) % 800).padStart(3, '0')}`,
      mode: followUpModes[i % 4],
      type,
      result,
      notes: result === '失访' ? '多次联系未果' : result === '稳定' ? '影像学稳定' : result === '好转' ? '病灶明显缩小' : '病情进展需密切观察',
      doctor: `王${['敏', '娜', '霞', '琳', '燕', '芳', '娟', '玲', '婷', '颖'][i % 10]}医生`,
    }
  }), [])

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

  const coveredColors: Record<string, string> = { '已覆盖': '#16a34a', '覆盖中': '#ca8a04', '未覆盖': '#e2e8f0' }

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
  )

  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>放射科早癌筛查平台</h1>
          <p style={s.subtitle}>Radiology Early Cancer Screening Platform · 肺癌LDCT / 乳腺癌 / 消化道癌筛查 · 数据更新于 2026-05-02</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={s.btn} onClick={() => { setLastSync(new Date()); showToast('数据同步成功', 'success') }}><RefreshCw size={14} /> 同步数据</button>
          <button style={s.btn} onClick={() => setShowExportModal(true)}><Download size={14} /> 导出报告</button>
        </div>
      </div>

      {/* 6大指标卡片 */}
      <div style={s.statsRow}>
        {statsData.map((stat, i) => <StatCard key={i} {...stat} />)}
      </div>

      {/* 功能区Tab导航 */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#f1f5f9', padding: 4, borderRadius: 10 }}>
        {[
          { label: '筛查任务管理', icon: Target },
          { label: '高危评估', icon: AlertTriangle },
          { label: '早癌/结节检出', icon: Microscope },
          { label: '影像数据地图', icon: MapPin },
        ].map((t, i) => (
          <button
            key={i}
            onClick={() => setTab(i + 1)}
            style={{
              flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none',
              background: tab === i + 1 ? '#fff' : 'transparent',
              color: tab === i + 1 ? '#2563eb' : '#64748b',
              fontWeight: tab === i + 1 ? 700 : 500, cursor: 'pointer',
              fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
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
          <div style={s.sectionTitle}><Target size={16} color='#dc2626' />筛查任务管理</div>
          <div style={s.taskToolbar}>
            <input
              style={s.searchInput}
              placeholder='搜索任务名称、地区或类型...'
              value={taskSearch}
              onChange={e => setTaskSearch(e.target.value)}
            />
            <button style={{ ...s.btn, minHeight: 44, padding: '8px 16px', fontSize: 14 }} onClick={() => setShowFilterModal(true)}><Filter size={16} />筛选条件</button>
            <button style={{ ...s.btnPrimary, minHeight: 44, padding: '8px 20px', fontSize: 14 }} onClick={() => setShowNewModal(true)}><Plus size={16} />新建筛查任务</button>
          </div>
          <div style={s.scrollBox}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>任务名称</th>
                  <th style={s.th}>筛查类型</th>
                  <th style={s.th}>地区</th>
                  <th style={s.th}>目标人数</th>
                  <th style={s.th}>完成人数</th>
                  <th style={s.th}>完成率</th>
                  <th style={s.th}>状态</th>
                  <th style={s.th}>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredTasks.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={s.emptyState}>
                      <FileSearch size={48} style={s.emptyStateIcon} />
                      <div style={s.emptyStateText}>未找到匹配的任务记录</div>
                      <div style={s.emptyStateHint}>请尝试调整搜索关键词或筛选条件</div>
                    </td>
                  </tr>
                ) : filteredTasks.slice(0, 15).map(task => (
                  <tr key={task.id}>
                    <td style={s.td}>{task.name}</td>
                    <td style={s.td}><ScreenTypeBadge type={task.type} /></td>
                    <td style={s.td}>{task.region}</td>
                    <td style={s.td}>{task.target}</td>
                    <td style={s.td}>{task.completed}</td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 60, height: 6, background: '#f1f5f9', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${task.rate}%`, height: '100%', background: task.rate >= 100 ? '#16a34a' : task.rate >= 50 ? '#2563eb' : '#ca8a04', borderRadius: 3 }} />
                        </div>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{task.rate}%</span>
                      </div>
                    </td>
                    <td style={s.td}><StatusBadge status={task.status} /></td>
                    <td style={s.td}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={{ ...s.btn, padding: '4px 8px', fontSize: 12 }} onClick={() => setShowDetailModal(true)}><Eye size={12} /></button>
                        <button style={{ ...s.btn, padding: '4px 8px', fontSize: 12 }} onClick={() => setShowEditModal(true)}><Edit size={12} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, fontSize: 12, color: '#94a3b8', textAlign: 'right' }}>
            显示 1-15 条，共 {filteredTasks.length} 条任务
          </div>
        </div>
      )}

      {/* ========== 功能区2: 高危评估 ========== */}
      {tab === 2 && (
        <div style={s.section}>
          <div style={s.sectionTitle}><AlertTriangle size={16} color='#ea580c' />高危评估</div>
          <div style={s.assessGrid}>
            {/* 左: 评估表单 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 }}>当前评估（基于LDCT筛查标准）</div>
              <div style={s.assessForm}>
                {assessmentDimensions.map(dim => (
                  <div key={dim.key} style={s.formItem}>
                    <div style={s.formLabel}>{dim.label}</div>
                    <select
                      style={s.formSelect}
                      value={assessmentForm[dim.key as keyof typeof assessmentForm]}
                      onChange={e => handleDimChange(dim.key, dim.options.findIndex(o => o.l === e.target.value))}
                    >
                      {dim.options.map(opt => (
                        <option key={opt.l} value={opt.l}>{opt.l}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16, padding: '12px 16px', background: riskBgColors[currentRisk], borderRadius: 10, textAlign: 'center', border: `2px solid ${riskColors[currentRisk]}` }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: riskColors[currentRisk] }}>评估结果</div>
                <div style={{ fontSize: 32, fontWeight: 800, color: riskColors[currentRisk], lineHeight: 1.2, marginTop: 4 }}>{currentRisk}</div>
                <div style={{ fontSize: 12, color: riskColors[currentRisk], opacity: 0.8, marginTop: 4 }}>风险评分: {currentScore} 分</div>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                <button style={{ ...s.btnPrimary, minHeight: 44, padding: '10px 20px', fontSize: 14 }} onClick={() => { setShowConfirmModal(true); showToast('评估已提交，等待审核', 'success') }}><CheckCircle size={16} />提交评估</button>
                <button style={{ ...s.btn, minHeight: 44, padding: '10px 20px', fontSize: 14 }} onClick={() => { setCurrentScore(0); setCurrentRisk('低危'); setAssessmentForm({ age: 55, gender: '男', smoking: '无', family: '无', exposure: '无', symptoms: '无', history: '无', region: '低风险' }) }}>重置评估</button>
              </div>
            </div>
            {/* 右: 历史评估记录 */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 }}>历史评估 ({assessments.length}条)</div>
              <div style={s.scrollBox}>
                {assessments.length === 0 ? (
                  <div style={s.emptyState}>
                    <ClipboardList size={44} style={s.emptyStateIcon} />
                    <div style={s.emptyStateText}>暂无评估记录</div>
                    <div style={s.emptyStateHint}>完成高危评估后将显示历史记录</div>
                  </div>
                ) : assessments.map(a => (
                  <div key={a.id} style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{a.name} <span style={{ fontSize: 12, color: '#94a3b8' }}>({a.age}岁)</span></div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{a.date} · {a.doctor}</div>
                    </div>
                    <span style={{ ...s.tag, background: riskBgColors[a.risk], color: riskColors[a.risk] }}>{a.risk} ({a.totalScore}分)</span>
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
          <div style={s.sectionTitle}><Microscope size={16} color='#dc2626' />早癌/结节检出追踪</div>
          {detections.length === 0 ? (
            <div style={s.emptyState}>
              <Inbox size={48} style={s.emptyStateIcon} />
              <div style={s.emptyStateText}>暂无早癌/结节检出记录</div>
              <div style={s.emptyStateHint}>完成筛查任务后发现早癌或高危结节将自动显示在此</div>
            </div>
          ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={s.detectionGrid}>
              <div style={s.detectionHeader}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 60px 80px 120px 80px 70px 70px 80px', gap: 8 }}>
                  <div>日期</div><div>姓名</div><div>年龄</div><div>性别</div><div>病变类型</div><div>部位</div><div>分级</div><div>处理</div><div>随访</div>
                </div>
              </div>
              {detections.map(d => (
                <div key={d.id} style={s.detectionRow}>
                  <div style={{ display: 'grid', gridTemplateColumns: '100px 80px 60px 80px 120px 80px 70px 70px 80px', gap: 8, alignItems: 'center' }}>
                    <div style={{ fontSize: 12 }}>{d.date}</div>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{d.name}</div>
                    <div style={{ fontSize: 12 }}>{d.age}</div>
                    <div style={{ fontSize: 12 }}>{d.gender}</div>
                    <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 600 }}>{d.lesionType}</div>
                    <div style={{ fontSize: 12 }}>{d.location}</div>
                    <div><RadsBadge rads={d.rads} /></div>
                    <div><span style={{ ...s.tag, background: treatmentColors[d.treatment]?.bg, color: treatmentColors[d.treatment]?.text }}>{d.treatment}</span></div>
                    <div><span style={{ ...s.tag, background: followUpColors[d.followUp]?.bg, color: followUpColors[d.followUp]?.text }}>{d.followUp}</span></div>
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
          <div style={s.sectionTitle}><MapPin size={16} color='#7c3aed' />影像数据地图</div>
          <div style={s.mapGrid}>
            {/* 省份列表 */}
            <div style={s.mapSvg}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 12 }}>各省份覆盖情况</div>
              <div style={{ overflowY: 'auto', maxHeight: 400 }}>
                <table style={s.provinceTable}>
                  <thead>
                    <tr>
                      <th style={s.provinceTh}>省份</th>
                      <th style={s.provinceTh}>覆盖状态</th>
                      <th style={s.provinceTh}>机构数</th>
                      <th style={s.provinceTh}>累计筛查</th>
                      <th style={s.provinceTh}>检出率</th>
                    </tr>
                  </thead>
                  <tbody>
                    {provinces.map(p => (
                      <tr key={p.name}>
                        <td style={s.provinceTd}>{p.name}</td>
                        <td style={s.provinceTd}>
                          <span style={{ ...s.tag, background: coveredColors[p.covered] + '22', color: coveredColors[p.covered] }}>{p.covered}</span>
                        </td>
                        <td style={s.provinceTd}>{p.instCount}家</td>
                        <td style={s.provinceTd}>{p.screenCount.toLocaleString()}人</td>
                        <td style={s.provinceTd}>{p.rate > 0 ? `${p.rate}%` : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 12, display: 'flex', gap: 16, fontSize: 12, color: '#64748b' }}>
                <span>机构总数: <strong>404家</strong></span>
                <span>累计筛查: <strong>36,248人</strong></span>
                <span>整体检出率: <strong>2.37%</strong></span>
              </div>
            </div>
            {/* 右侧：影像筛查类型分布 */}
            <div style={{ ...s.mapSvg, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>各筛查类型统计</div>
              {[
                { type: 'LDCT', icon: Wind, count: 8642, color: '#2563eb', bg: '#eff6ff' },
                { type: 'MG', icon: Heart, count: 3426, color: '#ec4899', bg: '#fdf2f8' },
                { type: '乳腺超声', icon: Scan, count: 2400, color: '#db2777', bg: '#fdf2f8' },
                { type: '消化道', icon: Circle, count: 2480, color: '#16a34a', bg: '#f0fdf4' },
              ].map(item => {
                const Icon = item.icon
                return (
                  <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: item.bg, borderRadius: 10 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 10, background: item.color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={20} color={item.color} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#334155' }}>{item.type}筛查</div>
                      <div style={{ fontSize: 12, color: '#64748b' }}>占比{Math.round(item.count / 100).toLocaleString()}%</div>
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: item.color }}>{item.count.toLocaleString()}</div>
                  </div>
                )
              })}
              <div style={{ marginTop: 8, padding: '12px 16px', background: '#f8fafc', borderRadius: 10, border: '1px dashed #e2e8f0' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 8 }}>本年月度筛查趋势（最近6个月）</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 60 }}>
                  {monthlyData.slice(-6).map((m, i) => {
                    const maxS = Math.max(...monthlyData.slice(-6).map(x => x.screenings))

// 月度筛查趋势数据
const monthlyScreenData = [
  { month: '2025-07', ldct: 245, breast: 189, gastroscopy: 128, colonoscopy: 156 },
  { month: '2025-08', ldct: 268, breast: 205, gastroscopy: 142, colonoscopy: 168 },
  { month: '2025-09', ldct: 285, breast: 218, gastroscopy: 155, colonoscopy: 178 },
  { month: '2025-10', ldct: 302, breast: 225, gastroscopy: 162, colonoscopy: 185 },
  { month: '2025-11', ldct: 318, breast: 238, gastroscopy: 175, colonoscopy: 192 },
  { month: '2025-12', ldct: 335, breast: 252, gastroscopy: 188, colonoscopy: 205 },
  { month: '2026-01', ldct: 328, breast: 248, gastroscopy: 182, colonoscopy: 198 },
  { month: '2026-02', ldct: 312, breast: 235, gastroscopy: 172, colonoscopy: 188 },
  { month: '2026-03', ldct: 356, breast: 268, gastroscopy: 195, colonoscopy: 215 },
  { month: '2026-04', ldct: 378, breast: 285, gastroscopy: 208, colonoscopy: 228 },
];

// 各省市筛查覆盖率
const regionalCoverage = [
  { region: '东华区', ldct: 98.5, breast: 95.2, total: 12856 },
  { region: '西城区', ldct: 92.8, breast: 88.5, total: 8642 },
  { region: '南山区', ldct: 96.2, breast: 92.8, total: 10258 },
  { region: '北湖区', ldct: 89.5, breast: 85.2, total: 7856 },
  { region: '中州市', ldct: 94.8, breast: 91.5, total: 9342 },
  { region: '滨海市', ldct: 87.2, breast: 82.5, total: 6825 },
  { region: '山城区', ldct: 91.5, breast: 87.8, total: 7892 },
  { region: '水乡区', ldct: 85.8, breast: 80.2, total: 5632 },
];

// 高危结节Lung-RADS分级统计
const lungRadsStats = [
  { grade: 'Lung-RADS 2', count: 856, percent: 68.5, color: '#3fb950' },
  { grade: 'Lung-RADS 3', count: 245, percent: 19.6, color: '#f0b429' },
  { grade: 'Lung-RADS 4A', count: 86, percent: 6.9, color: '#f97316' },
  { grade: 'Lung-RADS 4B', count: 42, percent: 3.4, color: '#ef4444' },
  { grade: 'Lung-RADS 4X', count: 21, percent: 1.7, color: '#dc2626' },
];

// 乳腺癌BI-RADS分级统计
const biRadsStats = [
  { grade: 'BI-RADS 1', count: 1256, percent: 72.3, color: '#3fb950' },
  { grade: 'BI-RADS 2', count: 285, percent: 16.4, color: '#58a6ff' },
  { grade: 'BI-RADS 3', count: 128, percent: 7.4, color: '#f0b429' },
  { grade: 'BI-RADS 4A', count: 38, percent: 2.2, color: '#f97316' },
  { grade: 'BI-RADS 4B', count: 18, percent: 1.0, color: '#ef4444' },
  { grade: 'BI-RADS 5', count: 12, percent: 0.7, color: '#dc2626' },
];

                    return (
                      <div key={m.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                        <div style={{ width: '100%', background: '#e2e8f0', borderRadius: 4, height: 50, position: 'relative' }}>
                          <div style={{ position: 'absolute', bottom: 0, width: '100%', background: '#2563eb', borderRadius: 4, height: `${(m.screenings / maxS) * 50}px` }} />
                        </div>
                        <div style={{ fontSize: 12, color: '#94a3b8' }}>{m.month.slice(5)}</div>
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
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>筛选条件</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>筛查类型</div>
                <select style={{ ...s.formSelect, width: '100%' }}>
                  <option>全部</option><option>LDCT</option><option>乳腺钼靶</option><option>乳腺超声</option><option>消化道</option>
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>地区</div>
                <select style={{ ...s.formSelect, width: '100%' }}>
                  <option>全部地区</option>{regions.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>状态</div>
                <select style={{ ...s.formSelect, width: '100%' }}>
                  <option>全部</option>{taskStatuses.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowFilterModal(false)}>取消</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={() => { setShowFilterModal(false); showToast('筛选已应用', 'success') }}>应用筛选</button>
            </div>
          </div>
        </div>
      )}

      {/* 新增Modal */}
      {showNewModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 450 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>新建筛查任务</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>任务名称</div><input style={{ ...s.formSelect, width: '100%' }} placeholder="请输入任务名称" /></div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>筛查类型</div>
                <select style={{ ...s.formSelect, width: '100%' }}>
                  <option>LDCT</option><option>乳腺钼靶</option><option>乳腺超声</option><option>消化道</option>
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>地区</div>
                <select style={{ ...s.formSelect, width: '100%' }}>
                  {regions.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>目标人数</div><input style={{ ...s.formSelect, width: '100%' }} type="number" placeholder="请输入目标人数" /></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowNewModal(false)}>取消</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={() => { setShowNewModal(false); showToast('筛查任务创建成功', 'success') }}>创建任务</button>
            </div>
          </div>
        </div>
      )}

      {/* 详情Modal */}
      {showDetailModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>任务详情</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 12, color: '#94a3b8' }}>任务名称</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>山东省LDCT早癌筛查</div></div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 12, color: '#94a3b8' }}>筛查类型</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>LDCT</div></div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 12, color: '#94a3b8' }}>目标人数</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>500人</div></div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 12, color: '#94a3b8' }}>完成人数</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>326人 (65.2%)</div></div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 12, color: '#94a3b8' }}>地区</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>山东省</div></div>
              <div style={{ padding: 12, background: '#f8fafc', borderRadius: 8 }}><div style={{ fontSize: 12, color: '#94a3b8' }}>负责人</div><div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>张伟医生</div></div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowDetailModal(false)}>关闭</button>
            </div>
          </div>
        </div>
      )}

      {/* 编辑Modal */}
      {showEditModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 450 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>编辑任务</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>任务名称</div><input style={{ ...s.formSelect, width: '100%' }} defaultValue="山东省LDCT早癌筛查" /></div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>目标人数</div><input style={{ ...s.formSelect, width: '100%' }} type="number" defaultValue="500" /></div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>筛查类型</div>
                <select style={{ ...s.formSelect, width: '100%' }} defaultValue="LDCT">
                  <option>LDCT</option><option>乳腺钼靶</option><option>乳腺超声</option><option>消化道</option>
                </select>
              </div>
              <div><div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>地区</div>
                <select style={{ ...s.formSelect, width: '100%' }} defaultValue="山东省">
                  {regions.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 20, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowEditModal(false)}>取消</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={() => { setShowEditModal(false); showToast('任务已更新', 'success') }}>保存修改</button>
            </div>
          </div>
        </div>
      )}

      {/* 导出预览Modal */}
      {showExportModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 500 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>导出报告预览</div>
            <div style={{ background: '#f8fafc', borderRadius: 8, padding: 16, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>报告概要</div>
              <div style={{ fontSize: 12, color: '#64748b', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <span>LDCT筛查人数: 8,642人</span><span>乳腺筛查人数: 5,826人</span>
                <span>高危结节检出: 1,284例</span><span>早癌/疑似早癌: 326例</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowExportModal(false)}>取消</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={() => { setShowExportModal(false); showToast('报告导出成功', 'success') }}>确认导出</button>
            </div>
          </div>
        </div>
      )}

      {/* 确认Modal */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, minWidth: 400 }}>
            <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 12 }}>确认提交评估</div>
            <div style={{ fontSize: 13, color: '#64748b', marginBottom: 20 }}>当前风险评估结果为「{currentRisk}」（{currentScore}分），确认提交审核吗？</div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button style={{ ...s.btn, padding: '8px 16px' }} onClick={() => setShowConfirmModal(false)}>取消</button>
              <button style={{ ...s.btnPrimary, padding: '8px 16px' }} onClick={() => { setShowConfirmModal(false); showToast('评估已提交成功', 'success') }}>确认提交</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast提示 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24, background: toast.type === 'success' ? '#16a34a' : '#dc2626',
          color: '#fff', padding: '12px 20px', borderRadius: 8, fontSize: 13, fontWeight: 500, zIndex: 2000,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)', animation: 'fadeIn 0.3s'
        }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

export default CancerScreenPage
