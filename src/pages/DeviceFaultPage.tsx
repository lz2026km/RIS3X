// @ts-nocheck
import { Card } from 'antd'
// G005 放射科RIS系统 - 设备故障登记页面（故障报修→维修→验收闭环管理）
import { useState, useEffect } from 'react'
import {
  AlertTriangle, Wrench, Activity, Clock, Search, CheckCircle,
  XCircle, RefreshCw, Plus, Filter, ChevronDown, ChevronUp,
  BarChart2, PieChart as PieChartIcon, TrendingUp, Timer,
  User, Settings, Eye, Check, X, AlertCircle, Bell,
  FileText, Calendar, Zap, Gauge, Download, Send
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, PieChart as RePieChart, Pie, Cell, Legend,
  AreaChart, Area
} from 'recharts'
import { deviceMgmtApi, type DeviceFault } from '../services/api/deviceMgmtApi'
import { ChartContainer } from '../components/charts'

// ============================================================
// 样式常量
// ============================================================
const C = {
  primary: '#1e40af',
  primaryLight: '#3b82f6',
  primaryLighter: 'var(--color-info-bg)',
  accent: '#2563eb',
  white: 'var(--bg-card)',
  bg: 'var(--bg-deep)',
  border: 'var(--border-color)',
  textDark: '#1e293b',
  textMid: '#475569',
  textLight: '#94a3b8',
  success: '#059669',
  successLight: 'var(--color-success-bg)',
  warning: '#d97706',
  warningLight: 'var(--color-warning-bg)',
  danger: '#dc2626',
  dangerLight: 'var(--color-error-bg)',
  info: '#0284c7',
  infoLight: 'var(--color-info-bg)',
}

const STATUS_COLORS: Record<string, string> = {
  '待处理': C.warning,
  '维修中': C.info,
  '待验收': C.primary,
  '已完成': C.success,
  '已取消': C.textLight,
}

const PRIORITY_COLORS: Record<string, string> = {
  '紧急': C.danger,
  '高': C.warning,
  '中': C.primary,
  '低': C.textLight,
}

const PIE_COLORS = [C.danger, C.warning, C.primary, C.success, C.info, '#7c3aed', '#0891b2']

// ============================================================
// 模拟数据
// ============================================================

// 故障登记记录
const INITIAL_FAULT_RECORDS = [
  { id: 'F001', deviceId: 'DEV-CT-01', deviceName: 'CT-1（GE Revolution CT）', faultTime: '2026-04-28 09:15', reporter: '王医生', faultType: '硬件故障', description: '球管曝光异常，发出错误代码E-1042', priority: '紧急', status: '维修中', assignEngineer: '张工', repairStartTime: '2026-04-28 10:30', estimatedCost: 85000, faultSymptoms: '曝光时球管发出异常声响，控制台显示E-1042错误' },
  { id: 'F002', deviceId: 'DEV-MR-01', deviceName: 'MR-1（西门子MAGNETOM Vida）', faultTime: '2026-04-27 14:20', reporter: '李技师', faultType: '软件故障', description: '图像重建失败，提示梯度模块通信异常', priority: '高', status: '待验收', assignEngineer: '李工', repairStartTime: '2026-04-27 15:00', repairCompleteTime: '2026-04-28 11:00', acceptanceTime: null, estimatedCost: 12000, faultSymptoms: '梯度放大器通信超时，图像重建中断' },
  { id: 'F003', deviceId: 'DEV-DR-01', deviceName: 'DR-1（飞利浦DigitalDiagnost）', faultTime: '2026-04-26 08:30', reporter: '张护士', faultType: '机械故障', description: '探测器面板无法复位，卡片堵塞', priority: '中', status: '已完成', assignEngineer: '王工', repairStartTime: '2026-04-26 09:00', repairCompleteTime: '2026-04-26 14:30', acceptanceTime: '2026-04-26 16:00', actualCost: 1800, faultSymptoms: '探测器面板卡住，无法完成复位流程' },
  { id: 'F004', deviceId: 'DEV-DSA-01', deviceName: 'DSA-1（飞利浦Azurion 7）', faultTime: '2026-04-25 16:45', reporter: '赵医生', faultType: '电气故障', description: 'C型臂移动时出现异响，位置传感器漂移', priority: '高', status: '已完成', assignEngineer: '赵工', repairStartTime: '2026-04-25 18:00', repairCompleteTime: '2026-04-27 10:00', acceptanceTime: '2026-04-27 14:00', actualCost: 35000, faultSymptoms: 'C型臂驱动马达磨损，位置传感器精度下降' },
  { id: 'F005', deviceId: 'DEV-CT-02', deviceName: 'CT-2（西门子SOMATOM Force）', faultTime: '2026-04-24 11:00', reporter: '钱医生', faultType: '硬件故障', description: '滑环接触不良，导致图像伪影', priority: '高', status: '待验收', assignEngineer: '张工', repairStartTime: '2026-04-24 13:00', repairCompleteTime: '2026-04-25 16:00', acceptanceTime: null, actualCost: 42000, faultSymptoms: '图像出现环状伪影，滑环信号传输不稳定' },
  { id: 'F006', deviceId: 'DEV-MR-02', deviceName: 'MR-2（飞利浦Ingenia）', faultTime: '2026-04-23 09:30', reporter: '孙技师', faultType: '系统故障', description: '液氦压力异常告警，需要补充液氦', priority: '中', status: '已完成', assignEngineer: '李工', repairStartTime: '2026-04-23 10:00', repairCompleteTime: '2026-04-23 15:00', acceptanceTime: '2026-04-23 17:00', actualCost: 5500, faultSymptoms: '液氦压力低于警戒线，冷头效率下降' },
  { id: 'F007', deviceId: 'DEV-DR-02', deviceName: 'DR-2（GE Optima）', faultTime: '2026-04-22 13:20', reporter: '周护士', faultType: '软件故障', description: '工作站软件崩溃，无法调取历史图像', priority: '低', status: '已完成', assignEngineer: '王工', repairStartTime: '2026-04-22 14:00', repairCompleteTime: '2026-04-22 16:30', acceptanceTime: '2026-04-22 17:30', actualCost: 500, faultSymptoms: '工作站程序无响应，需要重启服务' },
  { id: 'F008', deviceId: 'DEV-MG-01', deviceName: '乳腺钼靶（GE Senographe）', faultTime: '2026-04-21 10:10', reporter: '吴医生', faultType: '机械故障', description: '压迫器力度传感器失效', priority: '中', status: '待处理', assignEngineer: null, estimatedCost: 3000, faultSymptoms: '压迫力度无法精确控制，安全联锁失效' },
]

// 维修工程师列表
const ENGINEERS = [
  { id: 'E001', name: '张工', specialty: 'CT/DR', phone: '138-0001-1001', completedCount: 156 },
  { id: 'E002', name: '李工', specialty: 'MR/DSA', phone: '138-0001-1002', completedCount: 134 },
  { id: 'E003', name: '王工', specialty: 'DR/X光', phone: '138-0001-1003', completedCount: 189 },
  { id: 'E004', name: '赵工', specialty: 'DSA/介入', phone: '138-0001-1004', completedCount: 98 },
  { id: 'E005', name: '陈工', specialty: '乳腺/胃肠', phone: '138-0001-1005', completedCount: 76 },
]

// 设备列表（用于下拉选择）
const DEVICES = [
  { id: 'DEV-CT-01', name: 'CT-1（GE Revolution CT）', modality: 'CT' },
  { id: 'DEV-CT-02', name: 'CT-2（西门子SOMATOM Force）', modality: 'CT' },
  { id: 'DEV-MR-01', name: 'MR-1（西门子MAGNETOM Vida）', modality: 'MR' },
  { id: 'DEV-MR-02', name: 'MR-2（飞利浦Ingenia）', modality: 'MR' },
  { id: 'DEV-DR-01', name: 'DR-1（飞利浦DigitalDiagnost）', modality: 'DR' },
  { id: 'DEV-DR-02', name: 'DR-2（GE Optima）', modality: 'DR' },
  { id: 'DEV-DSA-01', name: 'DSA-1（飞利浦Azurion 7）', modality: 'DSA' },
  { id: 'DEV-MG-01', name: 'MG（GE Senographe）', modality: 'MG' },
]

// 故障类型统计
const FAULT_TYPE_STATS = [
  { name: '硬件故障', value: 35, color: C.danger },
  { name: '软件故障', value: 25, color: C.info },
  { name: '机械故障', value: 20, color: C.warning },
  { name: '电气故障', value: 12, color: C.primary },
  { name: '系统故障', value: 8, color: C.success },
]

// 月度故障趋势
const MONTHLY_FAULT_TREND = [
  { month: '1月', faults: 8, repairs: 7, avgRepairHours: 18.5 },
  { month: '2月', faults: 6, repairs: 6, avgRepairHours: 15.2 },
  { month: '3月', faults: 10, repairs: 9, avgRepairHours: 22.3 },
  { month: '4月', faults: 12, repairs: 11, avgRepairHours: 19.8 },
  { month: '5月', faults: 7, repairs: 8, avgRepairHours: 16.5 },
  { month: '6月', faults: 5, repairs: 5, avgRepairHours: 14.0 },
]

// 各设备故障次数
const DEVICE_FAULT_COUNT = [
  { deviceName: 'CT-1', faultCount: 8, avgDowntime: 24, cost: 125000 },
  { deviceName: 'MR-1', faultCount: 5, avgDowntime: 36, cost: 85000 },
  { deviceName: 'DR-1', faultCount: 6, avgDowntime: 8, cost: 18000 },
  { deviceName: 'DSA-1', faultCount: 4, avgDowntime: 48, cost: 156000 },
  { deviceName: 'CT-2', faultCount: 3, avgDowntime: 20, cost: 68000 },
  { deviceName: 'MR-2', faultCount: 2, avgDowntime: 12, cost: 22000 },
  { deviceName: 'DR-2', faultCount: 3, avgDowntime: 4, cost: 8500 },
  { deviceName: 'MG', faultCount: 2, avgDowntime: 6, cost: 12000 },
]

// 维修费用统计
const REPAIR_COST_STATS = [
  { month: '1月', parts: 45000, labor: 12000, total: 57000 },
  { month: '2月', parts: 32000, labor: 8000, total: 40000 },
  { month: '3月', parts: 68000, labor: 18000, total: 86000 },
  { month: '4月', parts: 78000, labor: 22000, total: 100000 },
  { month: '5月', parts: 38000, labor: 10000, total: 48000 },
  { month: '6月', parts: 25000, labor: 7000, total: 32000 },
]

// ============================================================
// 子组件
// ============================================================

/** 标签页按钮 */
function TabBtn({ label, active, onClick, icon, count }: { label: string; active: boolean; onClick: () => void; icon: React.ReactNode; count?: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 18px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 13, fontWeight: active ? 700 : 500,
        background: active ? C.primary : 'transparent',
        color: active ? '#fff' : C.textMid,
        transition: 'all 0.2s',
        boxShadow: active ? '0 2px 8px rgba(30,64,175,0.3)' : 'none',
      }}
    >
      {icon}
      {label}
      {count !== undefined && (
        <span style={{
          background: active ? 'rgba(255,255,255,0.25)' : C.primary,
          color: active ? '#fff' : C.primary,
          padding: '1px 6px', borderRadius: 10, fontSize: 12, fontWeight: 700
        }}>{count}</span>
      )}
    </button>
  )
}

/** 统计卡片 */
function StatCard({ label, value, icon, color, subtitle, trend }: {
  label: string; value: string | number; icon: React.ReactNode; color: string; subtitle?: string; trend?: 'up' | 'down' | 'stable'
}) {
  return (
    <Card bordered={false} style={{
      background: C.white, borderRadius: 12, padding: '16px 18px', border: `1px solid ${C.border}`,
      boxShadow: '0 1px 4px rgba(30,64,175,0.06)', display: 'flex', alignItems: 'center', gap: 14
    }} styles={{ body: { padding: 0 } }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: `${color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color, flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 24, fontWeight: 800, color: C.textDark }}>{value}</span>
          {trend && (
            <TrendingUp size={14} color={trend === 'up' ? C.success : trend === 'down' ? C.danger : C.textLight}
              style={{ transform: trend === 'down' ? 'rotate(180deg)' : 'none' }} />
          )}
        </div>
        <div style={{ fontSize: 12.5, color: C.textLight }}>{label}</div>
        {subtitle && <div style={{ fontSize: 12, color: C.textLight, marginTop: 1 }}>{subtitle}</div>}
      </div>
    </Card>
  )
}

/** 状态徽章 */
function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] || '#94a3b8'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
      background: `${color}15`, color,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {status}
    </span>
  )
}

/** 优先级徽章 */
function PriorityBadge({ priority }: { priority: string }) {
  const color = PRIORITY_COLORS[priority] || C.textLight
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '2px 8px', borderRadius: 6, fontSize: 12.5, fontWeight: 700,
      background: `${color}15`, color,
    }}>
      {priority === '紧急' && <Zap size={10} />}
      {priority}
    </span>
  )
}

/** 进度条 */
function ProgressBar({ value, max = 100, color }: { value: number; max?: number; color?: string }) {
  const pct = Math.min(100, Math.max(0, Math.round((value / max) * 100)))
  const barColor = color || (pct > 90 ? C.danger : pct > 70 ? C.warning : C.success)
  return (
    <div style={{ height: 6, background: C.border, borderRadius: 3, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${pct}%`, background: barColor,
        borderRadius: 3, transition: 'width 0.4s ease'
      }} />
    </div>
  )
}

/** 空状态 */
function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', color: C.textLight
    }}>
      <div style={{ marginBottom: 12, opacity: 0.5 }}>{icon}</div>
      <div style={{ fontSize: 14 }}>{message}</div>
    </div>
  )
}

// ============================================================
// 主组件
// ============================================================
export default function DeviceFaultPage() {
  const [activeTab, setActiveTab] = useState<'list' | 'progress' | 'stats'>('list')
  const [faultRecords, setFaultRecords] = useState(INITIAL_FAULT_RECORDS)
  const [searchKeyword, setSearchKeyword] = useState('')
  const [filterStatus, setFilterStatus] = useState('全部')
  const [filterPriority, setFilterPriority] = useState('全部')
  const [showAddModal, setShowAddModal] = useState(false)
  const [selectedRecord, setSelectedRecord] = useState<typeof INITIAL_FAULT_RECORDS[0] | null>(null)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [apiFaults, setApiFaults] = useState<DeviceFault[]>([])

  useEffect(() => {
    deviceMgmtApi.listDeviceFaults().then(res => {
      if (res.success && res.data) setApiFaults(res.data);
    }).catch((err) => { console.error('[F04]', err); });
  }, []);

  // 新增故障表单状态
  const [newFault, setNewFault] = useState({
    deviceId: '', faultType: '硬件故障', description: '', priority: '中',
    faultSymptoms: '', estimatedCost: ''
  })

  // 过滤后的记录
  const filteredRecords = faultRecords.filter(record => {
    const matchKeyword = !searchKeyword ||
      record.deviceName.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      record.description.toLowerCase().includes(searchKeyword.toLowerCase()) ||
      record.reporter.toLowerCase().includes(searchKeyword.toLowerCase())
    const matchStatus = filterStatus === '全部' || record.status === filterStatus
    const matchPriority = filterPriority === '全部' || record.priority === filterPriority
    return matchKeyword && matchStatus && matchPriority
  })

  // 统计数据
  const totalFaults = faultRecords.length
  const pendingCount = faultRecords.filter(r => r.status === '待处理' || r.status === '维修中').length
  const completedCount = faultRecords.filter(r => r.status === '已完成').length
  const totalCost = faultRecords.reduce((sum, r) => sum + (r.actualCost || r.estimatedCost || 0), 0)

  // 维修进度计算
  const getProgressPercent = (record: typeof INITIAL_FAULT_RECORDS[0]) => {
    if (record.status === '已完成') return 100
    if (record.status === '待处理') return 0
    if (record.status === '维修中') return 60
    if (record.status === '待验收') return 90
    return 30
  }

  // 新增故障记录
  const handleAddFault = () => {
    if (!newFault.deviceId || !newFault.description) return
    const device = DEVICES.find(d => d.id === newFault.deviceId)
    const now = new Date().toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(/\//g, '-')
    const newRecord = {
      id: `F00${faultRecords.length + 1}`,
      deviceId: newFault.deviceId,
      deviceName: device?.name || newFault.deviceId,
      faultTime: now,
      reporter: '当前用户',
      faultType: newFault.faultType,
      description: newFault.description,
      priority: newFault.priority,
      status: '待处理',
      assignEngineer: null,
      estimatedCost: parseInt(newFault.estimatedCost) || 0,
      faultSymptoms: newFault.faultSymptoms,
    }
    setFaultRecords([newRecord, ...faultRecords])
    setShowAddModal(false)
    setNewFault({ deviceId: '', faultType: '硬件故障', description: '', priority: '中', faultSymptoms: '', estimatedCost: '' })
  }

  // 验收操作
  const handleAccept = (id: string) => {
    setFaultRecords(records => records.map(r =>
      r.id === id ? { ...r, status: '已完成', acceptanceTime: new Date().toLocaleString('zh-CN') } : r
    ))
  }

  // 分配工程师
  const handleAssign = (id: string, engineer: string) => {
    setFaultRecords(records => records.map(r =>
      r.id === id ? { ...r, assignEngineer: engineer, status: r.status === '待处理' ? '维修中' : r.status, repairStartTime: new Date().toLocaleString('zh-CN') } : r
    ))
  }

  // 打开详情
  const handleOpenDetail = (record: typeof INITIAL_FAULT_RECORDS[0]) => {
    setSelectedRecord(record)
    setShowDetailModal(true)
  }

  return (
    <div style={{ minHeight: '100vh', background: C.bg, padding: '20px 24px' }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: C.textDark, margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
          <AlertTriangle size={24} color={C.primary} />
          设备故障管理
        </h1>
        <p style={{ fontSize: 13, color: C.textMid, margin: '4px 0 0 34px' }}>
          设备故障报修 → 维修处理 → 验收归档 全流程闭环管理
        </p>
      </div>

      {/* 统计卡片 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        <StatCard label="故障总数" value={totalFaults} icon={<AlertTriangle size={20} />} color={C.danger} trend="stable" subtitle="本月新增" />
        <StatCard label="待处理/维修中" value={pendingCount} icon={<Wrench size={20} />} color={C.warning} trend="down" subtitle="需要关注" />
        <StatCard label="已完成" value={completedCount} icon={<CheckCircle size={20} />} color={C.success} trend="up" subtitle="本月完成" />
        <StatCard label="总费用(元)" value={totalCost.toLocaleString()} icon={<Activity size={20} />} color={C.primary} subtitle="维修支出" />
      </div>

      {/* 标签页 */}
      <Card bordered={false} style={{ display: 'flex', gap: 4, marginBottom: 20, background: C.white, padding: '6px 8px', borderRadius: 12, border: `1px solid ${C.border}` }} styles={{ body: { padding: 0 } }}>
        <TabBtn label="故障登记" active={activeTab === 'list'} onClick={() => setActiveTab('list')} icon={<AlertCircle size={16} />} count={faultRecords.length} />
        <TabBtn label="维修进度" active={activeTab === 'progress'} onClick={() => setActiveTab('progress')} icon={<Timer size={16} />} />
        <TabBtn label="统计分析" active={activeTab === 'stats'} onClick={() => setActiveTab('stats')} icon={<BarChart2 size={16} />} />
      </Card>

      {/* ==================== 故障登记列表 ==================== */}
      {activeTab === 'list' && (
        <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, overflow: 'hidden' }} styles={{ body: { padding: 0 } }}>
          {/* 工具栏 */}
          <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 240px' }}>
              <Search size={16} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: C.textLight }} />
              <input
                type="text"
                placeholder="搜索设备名称、故障描述、报修人..."
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                style={{ width: '100%', padding: '8px 12px 8px 34px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
              />
            </div>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.textMid, outline: 'none', cursor: 'pointer', background: C.white }}>
              <option value="全部">全部状态</option>
              <option value="待处理">待处理</option>
              <option value="维修中">维修中</option>
              <option value="待验收">待验收</option>
              <option value="已完成">已完成</option>
            </select>
            <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, color: C.textMid, outline: 'none', cursor: 'pointer', background: C.white }}>
              <option value="全部">全部优先级</option>
              <option value="紧急">紧急</option>
              <option value="高">高</option>
              <option value="中">中</option>
              <option value="低">低</option>
            </select>
            <button
              onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8, border: 'none', background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              <Plus size={16} />
              新增故障
            </button>
          </div>

          {/* 表格 */}
          {filteredRecords.length === 0 ? (
            <EmptyState icon={<AlertTriangle size={48} />} message="暂无故障记录" />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-card)' }}>
                  {['设备名称', '故障时间', '故障类型', '故障描述', '优先级', '状态', '工程师', '操作'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', fontSize: 12, fontWeight: 700, color: C.textMid, textAlign: 'left', borderBottom: `1px solid ${C.border}` }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((record, idx) => (
<tr key={record.id} style={{ background: idx % 2 === 0 ? C.white : 'var(--bg-primary)', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget.style.background = C.primaryLighter)}
                onMouseLeave={e => (e.currentTarget.style.background = idx % 2 === 0 ? C.white : 'var(--bg-primary)')}>
                    <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.textDark }}>{record.deviceName.split('（')[0]}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMid }}>{record.faultTime}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMid }}>{record.faultType}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMid, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{record.description}</td>
                    <td style={{ padding: '12px 16px' }}><PriorityBadge priority={record.priority} /></td>
                    <td style={{ padding: '12px 16px' }}><StatusBadge status={record.status} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.textMid }}>{record.assignEngineer || '-'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button onClick={() => handleOpenDetail(record)} style={{ padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: C.white, fontSize: 12, color: C.textMid, cursor: 'pointer' }}>详情</button>
                        {record.status === '待验收' && (
                          <button onClick={() => handleAccept(record.id)} style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: C.success, fontSize: 12, color: '#fff', cursor: 'pointer' }}>验收</button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      )}

      {/* ==================== 维修进度跟踪 ==================== */}
      {activeTab === 'progress' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {/* 进度列表 */}
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }} styles={{ body: { padding: 0 } }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Timer size={18} color={C.primary} />
              维修进度跟踪
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {faultRecords.filter(r => r.status !== '已完成' && r.status !== '已取消').map(record => (
                <div key={record.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 14, background: 'var(--bg-card)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark }}>{record.deviceName.split('（')[0]}</div>
                      <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{record.faultTime}</div>
                    </div>
                    <StatusBadge status={record.status} />
                  </div>
                  <div style={{ fontSize: 12, color: C.textMid, marginBottom: 10, lineHeight: 1.5 }}>{record.description}</div>
                  {/* 进度条 */}
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: C.textMid }}>维修进度</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: C.primary }}>{getProgressPercent(record)}%</span>
                    </div>
                    <ProgressBar value={getProgressPercent(record)} color={C.primary} />
                  </div>
                  {/* 工程师选择 */}
                  {record.status === '待处理' && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                      <select
                        onChange={e => handleAssign(record.id, e.target.value)}
                        style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: `1px solid ${C.border}`, fontSize: 12, color: C.textMid, outline: 'none', background: C.white }}>
                        <option value="">选择工程师</option>
                        {ENGINEERS.map(eng => <option key={eng.id} value={eng.name}>{eng.name}</option>)}
                      </select>
                    </div>
                  )}
                  {record.assignEngineer && (
                    <div style={{ fontSize: 12, color: C.textMid, marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <User size={11} />
                      <span>负责工程师：<b>{record.assignEngineer}</b></span>
                    </div>
                  )}
                </div>
              ))}
              {faultRecords.filter(r => r.status !== '已完成' && r.status !== '已取消').length === 0 && (
                <EmptyState icon={<CheckCircle size={40} />} message="暂无进行中的维修任务" />
              )}
            </div>
          </Card>

          {/* 工程师工作状态 */}
          <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }} styles={{ body: { padding: 0 } }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} color={C.primary} />
              工程师工作状态
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ENGINEERS.map(eng => {
                const assignedCount = faultRecords.filter(r => r.assignEngineer === eng.name && (r.status === '维修中' || r.status === '待验收')).length
                return (
                  <div key={eng.id} style={{ border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', background: `${C.primary}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.primary, fontWeight: 800, fontSize: 14 }}>
                      {eng.name[0]}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.textDark }}>{eng.name}</div>
                      <div style={{ fontSize: 12, color: C.textLight, marginTop: 2 }}>{eng.specialty} · {eng.phone}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 18, fontWeight: 800, color: assignedCount > 0 ? C.warning : C.success }}>{assignedCount}</div>
                      <div style={{ fontSize: 12, color: C.textLight }}>进行中</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* 快速验收列表 */}
            <div style={{ marginTop: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, color: C.textDark, margin: '0 0 12px 0' }}>待验收任务</h4>
              {faultRecords.filter(r => r.status === '待验收').map(record => (
                <div key={record.id} style={{ border: `1px solid ${C.border}`, borderRadius: 8, padding: 10, marginBottom: 8, background: `${C.success}05` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: C.textDark }}>{record.deviceName.split('（')[0]}</div>
                      <div style={{ fontSize: 12, color: C.textMid, marginTop: 2 }}>{record.description.substring(0, 30)}...</div>
                    </div>
                    <button onClick={() => handleAccept(record.id)}
                      style={{ padding: '6px 12px', borderRadius: 6, border: 'none', background: C.success, color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      验收
                    </button>
                  </div>
                </div>
              ))}
              {faultRecords.filter(r => r.status === '待验收').length === 0 && (
                <div style={{ fontSize: 12, color: C.textLight, textAlign: 'center', padding: '20px 0' }}>暂无待验收任务</div>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ==================== 统计分析 ==================== */}
      {activeTab === 'stats' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 第一行：故障类型分布 + 月度趋势 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 20 }}>
            {/* 故障类型饼图 */}
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }} styles={{ body: { padding: 0 } }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <PieChartIcon size={18} color={C.primary} />
                故障类型分布
              </h3>
              <div style={{ height: 220 }}>
                <ChartContainer height={220} state={FAULT_TYPE_STATS.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无故障类型数据">
                  <RePieChart>
                    <Pie data={FAULT_TYPE_STATS} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                      {FAULT_TYPE_STATS.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => `${value} 次`} />
                  </RePieChart>
                </ChartContainer>
              </div>
            </Card>

            {/* 月度故障趋势 */}
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }} styles={{ body: { padding: 0 } }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrendingUp size={18} color={C.primary} />
                月度故障与维修趋势
              </h3>
              <div style={{ height: 220 }}>
                <ChartContainer height={220} state={MONTHLY_FAULT_TREND.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无故障趋势数据">
                  <AreaChart data={MONTHLY_FAULT_TREND}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMid }} />
                    <YAxis tick={{ fontSize: 12, fill: C.textMid }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="faults" stroke={C.danger} fill={C.dangerLight} name="故障次数" />
                    <Area type="monotone" dataKey="repairs" stroke={C.success} fill={C.successLight} name="维修完成" />
                  </AreaChart>
                </ChartContainer>
              </div>
            </Card>
          </div>

          {/* 第二行：设备故障排行 + 维修费用统计 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* 设备故障次数排行 */}
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }} styles={{ body: { padding: 0 } }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gauge size={18} color={C.primary} />
                设备故障次数排行
              </h3>
              <div style={{ height: 220 }}>
                <ChartContainer height={220} state={DEVICE_FAULT_COUNT.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无设备故障排行数据">
                  <BarChart data={DEVICE_FAULT_COUNT} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: C.textMid }} />
                    <YAxis dataKey="deviceName" type="category" tick={{ fontSize: 12, fill: C.textMid }} width={70} />
                    <Tooltip formatter={(value: number) => `${value} 次`} />
                    <Bar dataKey="faultCount" fill={C.danger} name="故障次数" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            </Card>

            {/* 维修费用统计 */}
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 20 }} styles={{ body: { padding: 0 } }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: C.textDark, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Activity size={18} color={C.primary} />
                维修费用统计（万元）
              </h3>
              <div style={{ height: 220 }}>
                <ChartContainer height={220} state={REPAIR_COST_STATS.length === 0 ? 'empty' : 'ready'} emptyDescription="暂无维修费用数据">
                  <BarChart data={REPAIR_COST_STATS}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.textMid }} />
                    <YAxis tick={{ fontSize: 12, fill: C.textMid }} />
                    <Tooltip formatter={(value: number) => `${(value / 10000).toFixed(1)} 万`} />
                    <Bar dataKey="parts" stackId="a" fill={C.primary} name="配件费用" />
                    <Bar dataKey="labor" stackId="a" fill={C.info} name="人工费用" />
                  </BarChart>
                </ChartContainer>
              </div>
            </Card>
          </div>

          {/* 关键指标 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.primary }}>18.5h</div>
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>平均维修时长</div>
            </Card>
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.success }}>94.2%</div>
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>一次修复率</div>
            </Card>
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.warning }}>4.2次</div>
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>月均故障次数</div>
            </Card>
            <Card bordered={false} style={{ background: C.white, borderRadius: 12, border: `1px solid ${C.border}`, padding: 16, textAlign: 'center' }} styles={{ body: { padding: 0 } }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: C.danger }}>¥46.2万</div>
              <div style={{ fontSize: 12, color: C.textMid, marginTop: 4 }}>年度维修费用</div>
            </Card>
          </div>
        </div>
      )}

      {/* ==================== 新增故障弹窗 ==================== */}
      {showAddModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowAddModal(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 24, width: 520, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textDark, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={18} color={C.danger} />
                新增故障登记
              </h3>
              <button onClick={() => setShowAddModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
                <X size={20} color={C.textLight} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>设备名称 *</label>
                <select value={newFault.deviceId} onChange={e => setNewFault({ ...newFault, deviceId: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                  <option value="">请选择设备</option>
                  {DEVICES.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>故障类型</label>
                  <select value={newFault.faultType} onChange={e => setNewFault({ ...newFault, faultType: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                    {['硬件故障', '软件故障', '机械故障', '电气故障', '系统故障'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>优先级</label>
                  <select value={newFault.priority} onChange={e => setNewFault({ ...newFault, priority: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}>
                    {['紧急', '高', '中', '低'].map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>故障描述 *</label>
                <textarea value={newFault.description} onChange={e => setNewFault({ ...newFault, description: e.target.value })}
                  placeholder="请详细描述故障现象..."
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', resize: 'vertical', minHeight: 80, boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>故障症状</label>
                <input type="text" value={newFault.faultSymptoms} onChange={e => setNewFault({ ...newFault, faultSymptoms: e.target.value })}
                  placeholder="如：错误代码、异常声响等"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.textMid, display: 'block', marginBottom: 4 }}>预估费用（元）</label>
                <input type="number" value={newFault.estimatedCost} onChange={e => setNewFault({ ...newFault, estimatedCost: e.target.value })}
                  placeholder="预估维修费用"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowAddModal(false)} style={{ padding: '8px 20px', borderRadius: 8, border: `1px solid ${C.border}`, background: C.white, fontSize: 13, color: C.textMid, cursor: 'pointer' }}>取消</button>
              <button onClick={handleAddFault} style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.danger, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}><Send size={13} />提交报修</button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== 详情弹窗 ==================== */}
      {showDetailModal && selectedRecord && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }} onClick={() => setShowDetailModal(false)}>
          <div style={{ background: C.white, borderRadius: 16, padding: 24, width: 600, maxHeight: '80vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: C.textDark, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={18} color={C.primary} />
                故障详情 - {selectedRecord.id}
              </h3>
              <button onClick={() => setShowDetailModal(false)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', padding: 4 }}>
                <X size={20} color={C.textLight} />
              </button>
            </div>
            {/* 基本信息 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>设备名称</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginTop: 2 }}>{selectedRecord.deviceName}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>故障类型</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginTop: 2 }}>{selectedRecord.faultType}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>故障时间</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginTop: 2 }}>{selectedRecord.faultTime}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>报修人</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.textDark, marginTop: 2 }}>{selectedRecord.reporter}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>优先级</div>
                <div style={{ marginTop: 4 }}><PriorityBadge priority={selectedRecord.priority} /></div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>当前状态</div>
                <div style={{ marginTop: 4 }}><StatusBadge status={selectedRecord.status} /></div>
              </div>
            </div>
            {/* 故障描述 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>故障描述</div>
              <div style={{ background: 'var(--bg-card)', padding: 12, borderRadius: 8, fontSize: 13, color: C.textDark, lineHeight: 1.6 }}>{selectedRecord.description}</div>
            </div>
            {/* 故障症状 */}
            {selectedRecord.faultSymptoms && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 6 }}>故障症状</div>
                <div style={{ background: `${C.warning}08`, padding: 12, borderRadius: 8, fontSize: 13, color: C.textDark, lineHeight: 1.6, borderLeft: `3px solid ${C.warning}` }}>{selectedRecord.faultSymptoms}</div>
              </div>
            )}
            {/* 维修进度 */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: C.textMid, marginBottom: 8 }}>维修进度</div>
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.textMid }}>完成度</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: C.primary }}>{getProgressPercent(selectedRecord)}%</span>
                </div>
                <ProgressBar value={getProgressPercent(selectedRecord)} color={C.primary} />
              </div>
              {/* 时间线 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                {[
                  { label: '故障时间', value: selectedRecord.faultTime, color: C.danger },
                  { label: '开始维修', value: selectedRecord.repairStartTime, color: C.warning },
                  { label: '维修完成', value: selectedRecord.repairCompleteTime, color: C.success },
                  { label: '验收时间', value: selectedRecord.acceptanceTime, color: C.primary },
                ].map(item => item.value && (
                  <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, color: C.textLight, width: 60 }}>{item.label}</span>
                    <span style={{ fontSize: 12, color: C.textDark, fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
            {/* 费用信息 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>预估费用</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.warning, marginTop: 2 }}>¥{(selectedRecord.estimatedCost || 0).toLocaleString()}</div>
              </div>
              <div style={{ background: 'var(--bg-card)', padding: 10, borderRadius: 8 }}>
                <div style={{ fontSize: 12, color: C.textLight }}>实际费用</div>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.success, marginTop: 2 }}>
                  {selectedRecord.actualCost ? `¥${selectedRecord.actualCost.toLocaleString()}` : '-'}
                </div>
              </div>
            </div>
            {/* 操作按钮 */}
            {selectedRecord.status === '待验收' && (
              <div style={{ display: 'flex', gap: 10, marginTop: 20, justifyContent: 'flex-end' }}>
                <button onClick={() => { handleAccept(selectedRecord.id); setShowDetailModal(false) }}
                  style={{ padding: '10px 24px', borderRadius: 8, border: 'none', background: C.success, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  确认验收
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
